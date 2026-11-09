'use strict';

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const net = require('node:net');
const tls = require('node:tls');
const crypto = require('node:crypto');
const { performance } = require('node:perf_hooks');
const { parseCatalogJson, parseCatalogTxt, mergeCatalogs } = require('./src/catalog.cjs');
const { probeCandidate } = require('./src/probe.cjs');

const APP_VERSION = app.getVersion();
const JSON_URL = 'https://zip.cm.edu.kg/all.json';
const TXT_URL = 'https://zip.cm.edu.kg/all.txt';
const MAX_CATALOG_BYTES = 40 * 1024 * 1024;
const MAX_SWEEP_TARGETS = 12000;
let mainWindow = null;
let activeRun = null;

function makeWindow() {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 1120,
    minHeight: 720,
    backgroundColor: '#0b1018',
    title: 'ProxyIP Explorer',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow && mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = null; });
}

function sendToRenderer(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
}

function timeoutSignal(ms) {
  return AbortSignal.timeout(ms);
}

async function fetchText(url, timeoutMs = 45000) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': `ProxyIP-Explorer/${APP_VERSION}`,
      'Accept': url.endsWith('.json') ? 'application/json' : 'text/plain,*/*'
    },
    signal: timeoutSignal(timeoutMs),
    redirect: 'follow'
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
  const declared = Number(response.headers.get('content-length') || 0);
  if (declared > MAX_CATALOG_BYTES) throw new Error(`资源文件过大（${declared} bytes）`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > MAX_CATALOG_BYTES) throw new Error(`资源文件超过大小限制（${buffer.length} bytes）`);
  return buffer.toString('utf8');
}

async function getCachePath() {
  const dir = app.getPath('userData');
  await fs.mkdir(dir, { recursive: true });
  return path.join(dir, 'catalog-cache.json');
}

async function saveCatalogCache(catalog) {
  try {
    const cachePath = await getCachePath();
    await fs.writeFile(cachePath, JSON.stringify({ cachedAt: new Date().toISOString(), catalog }), 'utf8');
  } catch (error) {
    console.warn('[cache] failed to save catalog:', error.message);
  }
}

async function readCatalogCache() {
  try {
    const cachePath = await getCachePath();
    const text = await fs.readFile(cachePath, 'utf8');
    const saved = JSON.parse(text);
    if (saved && saved.catalog && Array.isArray(saved.catalog.items)) {
      return { ...saved.catalog, cachedAt: saved.cachedAt || null, fromCache: true };
    }
  } catch { /* no usable cache */ }
  return null;
}

async function loadCatalog() {
  const warnings = [];
  let jsonCatalog = null;
  let txtCatalog = null;
  let jsonError = null;
  try {
    const text = await fetchText(JSON_URL);
    jsonCatalog = parseCatalogJson(JSON.parse(text));
    if (!jsonCatalog.items.length) throw new Error('JSON 中未解析到有效 IP/端口记录');
  } catch (error) {
    jsonError = error;
    warnings.push(`JSON 获取失败：${error.message}`);
  }

  const jsonItems = jsonCatalog?.items || [];
  const countryTagged = jsonItems.filter(item => /^[A-Z]{2}$/.test(String(item.cca2 || ''))).length;
  const cityTagged = jsonItems.filter(item => item.city && item.city !== '城市未标注').length;
  const geoMetadataLow = jsonItems.length > 0 &&
    (countryTagged / jsonItems.length < 0.85 || cityTagged / jsonItems.length < 0.60);

  if (!jsonItems.length || geoMetadataLow) {
    try {
      const text = await fetchText(TXT_URL);
      txtCatalog = parseCatalogTxt(text);
      if (!txtCatalog.items.length) throw new Error('TXT 中未解析到有效 IP/端口记录');
      if (jsonItems.length) {
        warnings.push(`JSON 已解析 ${jsonItems.length.toLocaleString('zh-CN')} 个节点，但地理标签覆盖偏低（国家 ${Math.round(countryTagged / jsonItems.length * 100)}%，城市 ${Math.round(cityTagged / jsonItems.length * 100)}%）。已读取 TXT 作为补充，补齐可识别的国家代码；TXT 本身不含城市信息，缺失城市不会被伪造。`);
      } else {
        warnings.push('当前使用 TXT 兜底数据：可根据国家代码分类，但 TXT 本身不含城市/IATA 等细分信息。');
      }
    } catch (error) {
      warnings.push(`TXT 获取/补充失败：${error.message}`);
    }
  }

  let catalog = mergeCatalogs(jsonCatalog, txtCatalog);
  if (catalog.items.length) {
    catalog.source = jsonCatalog && jsonCatalog.items.length ? JSON_URL : TXT_URL;
    catalog.supplementedFromTxt = Boolean(jsonCatalog?.items.length && txtCatalog?.items.length);
    catalog.locationCoverage = {
      country: catalog.items.length ? Math.round(catalog.items.filter(item => /^[A-Z]{2}$/.test(String(item.cca2 || ''))).length / catalog.items.length * 100) : 0,
      city: catalog.items.length ? Math.round(catalog.items.filter(item => item.city && item.city !== '城市未标注').length / catalog.items.length * 100) : 0
    };
    catalog.warnings = warnings;
    catalog.fromCache = false;
    catalog.cachedAt = new Date().toISOString();
    await saveCatalogCache(catalog);
    return catalog;
  }

  const cached = await readCatalogCache();
  if (cached) {
    cached.warnings = [...warnings, '在线资源暂时不可用，已加载本机上次成功获取的缓存。'];
    cached.source = cached.source || '本地缓存';
    return cached;
  }

  throw new Error(warnings.join('\n') || jsonError?.message || '无法加载 ProxyIP 数据');
}

function safeNumber(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runSweep(run, targets, options) {
  let cursor = 0;
  let completed = 0;
  let online = 0;
  const startedAt = Date.now();
  const workerCount = Math.min(options.concurrency, targets.length);

  async function worker() {
    while (!run.cancelled) {
      const index = cursor++;
      if (index >= targets.length) return;
      const target = targets[index];
      let result;
      try {
        result = await probeCandidate(target, options.timeoutMs);
      } catch (error) {
        result = {
          id: target.id,
          candidate: `${target.ip}:${target.port}`,
          success: false,
          responseTime: null,
          connectMs: null,
          tlsMs: null,
          ipv4: { ok: false, error: error.message },
          ipv6: { ok: false, error: error.message },
          error: error.message,
          checkedAt: new Date().toISOString()
        };
      }
      if (result.success) online++;
      completed++;
      sendToRenderer('probe:result', { runId: run.id, result });
      sendToRenderer('probe:progress', {
        runId: run.id,
        cycle: run.cycle,
        completed,
        total: targets.length,
        online,
        active: Math.min(workerCount, targets.length - completed),
        elapsedMs: Date.now() - startedAt
      });
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return { completed, online, elapsedMs: Date.now() - startedAt, cancelled: run.cancelled };
}

async function runMonitor(run, targets, options) {
  try {
    while (!run.cancelled) {
      run.cycle += 1;
      sendToRenderer('probe:cycle', { runId: run.id, cycle: run.cycle, total: targets.length });
      const summary = await runSweep(run, targets, options);
      if (run.cancelled || !options.continuous) break;
      sendToRenderer('probe:waiting', {
        runId: run.id,
        cycle: run.cycle,
        nextInSeconds: options.intervalSeconds,
        summary
      });
      for (let elapsed = 0; elapsed < options.intervalSeconds * 10 && !run.cancelled; elapsed++) {
        await sleep(100);
      }
    }
  } catch (error) {
    sendToRenderer('probe:error', { runId: run.id, error: error.message });
  } finally {
    sendToRenderer('probe:stopped', { runId: run.id, cancelled: run.cancelled });
    if (activeRun && activeRun.id === run.id) activeRun = null;
  }
}

ipcMain.handle('catalog:load', async () => loadCatalog());
ipcMain.handle('catalog:refresh', async () => loadCatalog());
ipcMain.handle('app:version', () => APP_VERSION);
ipcMain.handle('app:openExternal', async (_event, url) => {
  try {
    const parsed = new URL(String(url));
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    await shell.openExternal(parsed.toString());
    return true;
  } catch { return false; }
});
ipcMain.handle('probe:start', async (event, payload = {}) => {
  if (activeRun) activeRun.cancelled = true;
  const targets = Array.isArray(payload.targets) ? payload.targets.slice(0, MAX_SWEEP_TARGETS) : [];
  if (!targets.length) throw new Error('没有可检测的节点');
  const options = {
    concurrency: safeNumber(payload.concurrency, 16, 1, 64),
    timeoutMs: safeNumber(payload.timeoutMs, 4500, 1000, 15000),
    intervalSeconds: safeNumber(payload.intervalSeconds, 30, 10, 600),
    continuous: Boolean(payload.continuous)
  };
  const run = {
    id: crypto.randomUUID(),
    cancelled: false,
    cycle: 0,
    webContentsId: event.sender.id
  };
  activeRun = run;
  // Let the renderer receive runId and install its event filter before very
  // fast connection failures/results can be emitted from the worker loop.
  setTimeout(() => runMonitor(run, targets, options), 150);
  return { runId: run.id, total: targets.length, options };
});
ipcMain.handle('probe:stop', async () => {
  if (activeRun) activeRun.cancelled = true;
  return { stopping: Boolean(activeRun) };
});

app.whenReady().then(() => {
  makeWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) makeWindow();
  });
});

app.on('before-quit', () => {
  if (activeRun) activeRun.cancelled = true;
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
