'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeTarget, hostMatchesPattern, certificateMatchesHost, parseHttpResponse, calculateConnectLatency, getExitFamily } = require('../src/probe.cjs');

test('validates IPv4 and IPv6 probe targets', () => {
  assert.deepEqual(normalizeTarget({ ip: '1.2.3.4', port: 443 }), { host: '1.2.3.4', port: 443 });
  assert.deepEqual(normalizeTarget({ ip: '2606:4700::1', port: 8443 }), { host: '2606:4700::1', port: 8443 });
  assert.throws(() => normalizeTarget({ ip: 'bad', port: 443 }));
});

test('matches exact and one-label wildcard certificate names', () => {
  assert.equal(hostMatchesPattern('ipv4.090227.xyz', '*.090227.xyz'), true);
  assert.equal(hostMatchesPattern('a.b.090227.xyz', '*.090227.xyz'), false);
  assert.equal(certificateMatchesHost({ subjectaltname: 'DNS:*.090227.xyz, DNS:example.org' }, 'ipv6.090227.xyz'), true);
  assert.equal(certificateMatchesHost({ subjectaltname: 'DNS:example.org' }, 'ipv6.090227.xyz'), false);
});

test('parses HTTP JSON probe response', () => {
  const body = Buffer.from(JSON.stringify({ ip: '203.0.113.8', country: 'US' }));
  const header = Buffer.from(`HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ${body.length}\r\nConnection: close\r\n\r\n`);
  const parsed = parseHttpResponse(Buffer.concat([header, body]), false);
  assert.equal(parsed.complete, true);
  assert.equal(parsed.exitIp, '203.0.113.8');
});


test('reports measured TCP latency from successful connects even if another probe fails', () => {
  assert.equal(calculateConnectLatency([{ connectMs: 42.1 }, { connectMs: null }]), 43);
  assert.equal(calculateConnectLatency([{ connectMs: 41 }, { connectMs: 61 }]), 51);
  assert.equal(calculateConnectLatency([{ connectMs: null }, { connectMs: undefined }]), null);
});


test('detects probe exit family from ipType or returned IP', () => {
  assert.equal(getExitFamily({ ok: true, exit: { ip: '203.0.113.8' } }), 'ipv4');
  assert.equal(getExitFamily({ ok: true, exit: { ip: '2001:db8::8' } }), 'ipv6');
  assert.equal(getExitFamily({ ok: true, exit: { ip: '203.0.113.8', ipType: 'ipv6' } }), 'ipv6');
  assert.equal(getExitFamily({ ok: false, exit: { ip: '203.0.113.8' } }), null);
});
