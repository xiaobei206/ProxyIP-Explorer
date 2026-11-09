'use strict';

const tls = require('node:tls');
const net = require('node:net');
const { performance } = require('node:perf_hooks');
const APP_VERSION = require('../package.json').version;

const PROBE_TARGETS = [
  { family: 'ipv4', host: 'ipv4.090227.xyz' },
  { family: 'ipv6', host: 'ipv6.090227.xyz' }
];
const READ_LIMIT = 64 * 1024;

function normalizeTarget(target) {
  let host = String(target?.ip || '').trim();
  const port = Number(target?.port);
  host = host.replace(/^\[|\]$/g, '');
  if (!host || net.isIP(host) === 0) throw new Error(`无效 IP：${host}`);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`无效端口：${target?.port}`);
  return { host, port };
}

function hostMatchesPattern(host, pattern) {
  const candidate = String(pattern || '').trim().toLowerCase().replace(/\.$/, '');
  const name = String(host || '').trim().toLowerCase().replace(/\.$/, '');
  if (!candidate) return false;
  if (candidate === name) return true;
  if (!candidate.startsWith('*.')) return false;
  const suffix = candidate.slice(1);
  if (!name.endsWith(suffix)) return false;
  const label = name.slice(0, name.length - suffix.length);
  return Boolean(label) && !label.includes('.');
}

function certificateMatchesHost(cert, expectedHost) {
  if (!cert || !expectedHost) return true;
  const names = [];
  if (cert.subjectaltname) {
    for (const match of cert.subjectaltname.matchAll(/DNS:([^,]+)/gi)) names.push(match[1].trim());
  }
  if (!names.length && cert.subject?.CN) names.push(cert.subject.CN);
  if (!names.length) return true; // Match upstream's tolerant behavior when names cannot be extracted.
  return names.some(name => hostMatchesPattern(expectedHost, name));
}

function buildRequest(host) {
  return [
    `GET / HTTP/1.1`,
    `Host: ${host}`,
    'Accept: application/json, text/plain, */*',
    'Accept-Language: en-US,en;q=0.9',
    `User-Agent: ProxyIP-Explorer/${APP_VERSION} (Windows; local TLS probe)`,
    'Accept-Encoding: identity',
    'Connection: close',
    '',
    ''
  ].join('\r\n');
}

function decodeChunked(buffer) {
  const chunks = [];
  let offset = 0;
  while (offset < buffer.length) {
    const lineEnd = buffer.indexOf('\r\n', offset, 'ascii');
    if (lineEnd < 0) return null;
    const sizeText = buffer.subarray(offset, lineEnd).toString('ascii').split(';', 1)[0].trim();
    const size = Number.parseInt(sizeText, 16);
    if (!Number.isFinite(size) || size < 0) throw new Error('HTTP chunk 长度无效');
    if (size === 0) return Buffer.concat(chunks);
    const bodyStart = lineEnd + 2;
    const bodyEnd = bodyStart + size;
    if (bodyEnd + 2 > buffer.length) return null;
    chunks.push(buffer.subarray(bodyStart, bodyEnd));
    offset = bodyEnd + 2;
  }
  return null;
}

function parseHttpResponse(buffer, ended = false) {
  const headerEnd = buffer.indexOf('\r\n\r\n');
  if (headerEnd < 0) return ended ? { complete: true, error: 'HTTP 响应头不完整' } : null;
  const headerText = buffer.subarray(0, headerEnd).toString('latin1');
  const lines = headerText.split('\r\n');
  const statusMatch = lines[0].match(/^HTTP\/\d(?:\.\d)?\s+(\d{3})/i);
  if (!statusMatch) return { complete: true, error: '无法识别 HTTP 状态行' };
  const statusCode = Number(statusMatch[1]);
  const headers = {};
  for (const line of lines.slice(1)) {
    const separator = line.indexOf(':');
    if (separator > 0) headers[line.slice(0, separator).trim().toLowerCase()] = line.slice(separator + 1).trim();
  }
  let body = buffer.subarray(headerEnd + 4);
  if (/chunked/i.test(headers['transfer-encoding'] || '')) {
    const decoded = decodeChunked(body);
    if (!decoded) return ended ? { complete: true, error: 'HTTP chunked 响应不完整', statusCode } : null;
    body = decoded;
  } else if (headers['content-length'] !== undefined) {
    const expected = Number(headers['content-length']);
    if (Number.isFinite(expected) && expected >= 0) {
      if (body.length < expected) return ended ? { complete: true, error: 'HTTP 响应正文长度不足', statusCode } : null;
      body = body.subarray(0, expected);
    }
  } else if (!ended) {
    return null;
  }
  if (body.length > READ_LIMIT) body = body.subarray(0, READ_LIMIT);
  const bodyText = body.toString('utf8').trim();
  if (statusCode !== 200) return { complete: true, statusCode, error: `HTTP ${statusCode}`, bodyText: bodyText.slice(0, 160) };
  try {
    const payload = JSON.parse(bodyText);
    const exitIp = payload?.ip ?? payload?.ipAddress ?? null;
    if (!exitIp || typeof exitIp !== 'string') return { complete: true, statusCode, error: '探针 JSON 缺少出口 IP' };
    return { complete: true, statusCode, payload, exitIp };
  } catch (error) {
    return { complete: true, statusCode, error: `探针 JSON 无效：${error.message}` };
  }
}

function probeOne(target, host, timeoutMs) {
  return new Promise(resolve => {
    const started = performance.now();
    let connectMs = null;
    let tlsMs = null;
    let settled = false;
    let tlsStarted = null;
    let response = Buffer.alloc(0);
    let socket;
    let timer;

    const finish = result => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { socket?.destroy(); } catch { /* ignored */ }
      resolve({
        family: target.family,
        host,
        connectMs,
        tlsMs,
        httpMs: result.httpMs ?? null,
        statusCode: result.statusCode ?? null,
        ok: Boolean(result.ok),
        exit: result.exit || null,
        error: result.error || null
      });
    };

    timer = setTimeout(() => finish({ error: `探测超时（${timeoutMs}ms）` }), timeoutMs);
    try {
      socket = tls.connect({
        host: target.hostAddress,
        port: target.port,
        servername: host,
        rejectUnauthorized: false,
        ALPNProtocols: ['http/1.1'],
        minVersion: 'TLSv1.2'
      });
      socket.once('connect', () => {
        connectMs = Math.max(0, performance.now() - started);
        tlsStarted = performance.now();
      });
      socket.once('secureConnect', () => {
        tlsMs = Math.max(0, performance.now() - (tlsStarted ?? started));
        const cert = socket.getPeerCertificate(true);
        if (!certificateMatchesHost(cert, host)) {
          finish({ error: `证书名称与 ${host} 不匹配` });
          return;
        }
        const httpStarted = performance.now();
        socket.write(buildRequest(host));
        socket.on('data', chunk => {
          response = Buffer.concat([response, chunk]);
          if (response.length > READ_LIMIT) {
            finish({ error: `HTTP 响应超过 ${READ_LIMIT} bytes`, httpMs: performance.now() - httpStarted });
            return;
          }
          try {
            const parsed = parseHttpResponse(response, false);
            if (parsed?.complete) {
              finish({ ok: !parsed.error, statusCode: parsed.statusCode, exit: parsed.payload, error: parsed.error, httpMs: performance.now() - httpStarted });
            }
          } catch (error) {
            finish({ error: error.message, httpMs: performance.now() - httpStarted });
          }
        });
        socket.once('end', () => {
          const parsed = parseHttpResponse(response, true);
          finish({ ok: !parsed?.error, statusCode: parsed?.statusCode, exit: parsed?.payload, error: parsed?.error, httpMs: performance.now() - httpStarted });
        });
      });
      socket.once('error', error => finish({ error: error.message }));
      socket.once('timeout', () => finish({ error: `Socket 超时（${timeoutMs}ms）` }));
      socket.setTimeout(timeoutMs);
    } catch (error) {
      finish({ error: error.message });
    }
  });
}

function calculateConnectLatency(results) {
  const samples = (Array.isArray(results) ? results : [])
    .map(item => item?.connectMs)
    .filter(value => Number.isFinite(value) && value >= 0);
  if (!samples.length) return null;
  return Math.ceil(samples.reduce((sum, value) => sum + value, 0) / samples.length);
}

async function probeCandidate(target, timeoutMs = 4500) {
  const { host, port } = normalizeTarget(target);
  const started = performance.now();
  const results = await Promise.all(PROBE_TARGETS.map(probe => probeOne({ ...probe, targetHost: probe.host, hostAddress: host, port }, probe.host, timeoutMs)));
  const [ipv4, ipv6] = results;
  // Report measured TCP connects even when TLS/HTTP/probe validation fails.
  // If neither address established TCP, there is no latency measurement to display.
  const responseTime = calculateConnectLatency(results);
  const success = results.some(item => item.ok);
  return {
    id: target.id || `${host}:${port}`,
    candidate: `${host}:${port}`,
    success,
    responseTime,
    connectMs: responseTime,
    ipv4,
    ipv6,
    supportsIPv4: ipv4.ok,
    supportsIPv6: ipv6.ok,
    exitIPv4: ipv4.exit || null,
    exitIPv6: ipv6.exit || null,
    elapsedMs: Math.round(performance.now() - started),
    checkedAt: new Date().toISOString(),
    error: success ? null : [ipv4.error, ipv6.error].filter(Boolean).join(' / ') || '探针失败'
  };
}

module.exports = { probeCandidate, normalizeTarget, hostMatchesPattern, certificateMatchesHost, parseHttpResponse, calculateConnectLatency };
