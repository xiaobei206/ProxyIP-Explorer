'use strict';

const state = {
  catalog: null,
  items: [],
  filtered: [],
  page: 1,
  pageSize: 100,
  filter: { region: null, cca2: null, city: null },
  search: '',
  status: 'all',
  sort: 'smart',
  probeResults: new Map(),
  running: false,
  runId: null,
  latestProgress: null,
  toastTimer: null,
  renderQueued: false
};

const $ = id => document.getElementById(id);
const elements = {
  navAll: $('navAll'), allCount: $('allCount'), regionList: $('regionList'), currentGroup: $('currentGroup'),
  generatedAt: $('generatedAt'), sourceStatus: $('sourceStatus'), sourceShort: $('sourceShort'), notice: $('notice'),
  statTargets: $('statTargets'), statCountries: $('statCountries'), statCities: $('statCities'), statOnline: $('statOnline'), statChecked: $('statChecked'),
  refreshBtn: $('refreshBtn'), startBtn: $('startBtn'), liveState: $('liveState'), liveStateText: $('liveStateText'),
  progressFill: $('progressFill'), progressText: $('progressText'), monitorDescription: $('monitorDescription'),
  searchInput: $('searchInput'), statusFilter: $('statusFilter'), sortSelect: $('sortSelect'), scopeSelect: $('scopeSelect'),
  concurrencySelect: $('concurrencySelect'), timeoutSelect: $('timeoutSelect'), intervalSelect: $('intervalSelect'), continuousToggle: $('continuousToggle'),
  resultCount: $('resultCount'), nodesBody: $('nodesBody'), pageInfo: $('pageInfo'), pageNumber: $('pageNumber'),
  prevPage: $('prevPage'), nextPage: $('nextPage'), pageSize: $('pageSize'), exportBtn: $('exportBtn'), openSource: $('openSource'),
  appVersion: $('appVersion'), aboutLink: $('aboutLink'), aboutModal: $('aboutModal'), closeAbout: $('closeAbout'), aboutOk: $('aboutOk'), toast: $('toast')
};

function fmtNumber(value) { return Number(value || 0).toLocaleString('zh-CN'); }
function fmtDate(value) {
  if (!value) return '上游未提供';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('zh-CN', { hour12: false });
}
function fmtLatency(value) {
  if (!Number.isFinite(Number(value))) return '—';
  const n = Number(value);
  return `${n < 10 ? n.toFixed(1) : Math.round(n)} ms`;
}
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add('show');
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => elements.toast.classList.remove('show'), 2200);
}
function setNotice(message, isError = false) {
  if (!message) { elements.notice.hidden = true; elements.notice.textContent = ''; return; }
  elements.notice.hidden = false;
  elements.notice.classList.toggle('error', isError);
  elements.notice.textContent = message;
}
function setRunning(running, mode = 'idle') {
  state.running = running;
  elements.startBtn.innerHTML = running ? '<span class="button-icon">■</span>停止检测' : '<span class="button-icon">▶</span>开始检测';
  elements.startBtn.classList.toggle('button-primary', !running);
  elements.startBtn.classList.toggle('button-quiet', running);
  elements.liveState.className = `live-state ${mode}`;
  if (!running && mode === 'idle') elements.liveStateText.textContent = '尚未开始检测';
  if (!running && mode === 'done') elements.liveStateText.textContent = '本轮检测已完成';
  if (running) elements.liveStateText.textContent = '本机检测运行中';
  if (mode === 'waiting') elements.liveStateText.textContent = '等待下一轮检测';
  if (mode === 'error') elements.liveStateText.textContent = '检测出现错误';
}
function scheduleRender() {
  if (state.renderQueued) return;
  state.renderQueued = true;
  requestAnimationFrame(() => { state.renderQueued = false; renderTable(); renderStats(); });
}

function countUnique(items, selector) { return new Set(items.map(selector).filter(Boolean)).size; }
function renderStats() {
  const online = [...state.probeResults.values()].filter(result => result.success).length;
  const checked = state.probeResults.size;
  elements.statTargets.textContent = fmtNumber(state.items.length);
  elements.statCountries.textContent = fmtNumber(countUnique(state.items, item => /^[A-Z]{2}$/.test(String(item.cca2 || '')) ? item.cca2 : ''));
  elements.statCities.textContent = fmtNumber(countUnique(state.items, item => item.city && item.city !== '城市未标注' ? `${item.cca2}|${item.city}|${item.iata}` : ''));
  elements.statOnline.textContent = fmtNumber(online);
  elements.statChecked.textContent = checked ? `已检测 ${fmtNumber(checked)} 个地址` : '尚无检测结果';
  elements.allCount.textContent = fmtNumber(state.items.length);
}

function buildTree(items) {
  const regions = new Map();
  for (const item of items) {
    const region = item.region || '未分类';
    if (!regions.has(region)) regions.set(region, new Map());
    const countries = regions.get(region);
    const cc = item.cca2 || '??';
    if (!countries.has(cc)) countries.set(cc, { name: item.country || '未知国家', flag: item.flag || '🌐', items: [], cities: new Map() });
    const country = countries.get(cc);
    country.items.push(item);
    const cityKey = item.city || '城市未标注';
    country.cities.set(cityKey, (country.cities.get(cityKey) || 0) + 1);
  }
  return [...regions.entries()].sort((a, b) => a[0].localeCompare(b[0], 'zh-CN')).map(([name, countries]) => ({
    name,
    count: [...countries.values()].reduce((sum, country) => sum + country.items.length, 0),
    countries: [...countries.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name, 'zh-CN')).map(([code, country]) => ({ code, ...country }))
  }));
}

function renderSidebar() {
  const tree = buildTree(state.items);
  if (!tree.length) { elements.regionList.innerHTML = '<div class="side-placeholder">暂无地区数据</div>'; return; }
  elements.regionList.innerHTML = tree.map(region => {
    const selectedRegion = state.filter.region === region.name && !state.filter.cca2;
    const expanded = state.filter.region === region.name;
    const children = expanded ? `<div class="country-list">${region.countries.map(country => {
      const selectedCountry = state.filter.cca2 === country.code;
      const cities = selectedCountry ? `<div class="city-list">${[...country.cities.entries()].sort((a,b) => a[0].localeCompare(b[0], 'zh-CN')).map(([city, count]) => `<button class="city-button ${state.filter.city === city ? 'selected' : ''}" type="button" data-city="${escapeHtml(city)}">⌁ ${escapeHtml(city)}<span class="region-count">${fmtNumber(count)}</span></button>`).join('')}</div>` : '';
      return `<div><button class="country-button ${selectedCountry ? 'selected' : ''}" type="button" data-country="${escapeHtml(country.code)}"><span>${country.flag}</span><span>${escapeHtml(country.name)}</span><span class="region-count">${fmtNumber(country.items.length)}</span></button>${cities}</div>`;
    }).join('')}</div>` : '';
    const emoji = ({ '亚洲':'🌏', '欧洲':'🌍', '非洲':'🌍', '北美洲':'🌎', '南美洲':'🌎', '大洋洲':'🌏', '南极洲':'🧊', '未分类':'🌐' })[region.name] || '🌐';
    return `<div class="region-group"><button class="region-button ${selectedRegion ? 'selected' : ''}" type="button" data-region="${escapeHtml(region.name)}"><span class="region-caret">${expanded ? '▾' : '▸'}</span><span class="region-emoji">${emoji}</span><span>${escapeHtml(region.name)}</span><span class="region-count">${fmtNumber(region.count)}</span></button>${children}</div>`;
  }).join('');
}

function applyFilters() {
  const query = state.search.trim().toLowerCase();
  state.filtered = state.items.filter(item => {
    if (state.filter.region && item.region !== state.filter.region) return false;
    if (state.filter.cca2 && item.cca2 !== state.filter.cca2) return false;
    if (state.filter.city && item.city !== state.filter.city) return false;
    if (query) {
      const haystack = `${item.ip} ${item.port} ${item.cca2} ${item.country} ${item.region} ${item.city} ${item.iata}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    const result = state.probeResults.get(item.id);
    if (state.status === 'online' && !result?.success) return false;
    if (state.status === 'failed' && (!result || result.success)) return false;
    if (state.status === 'untested' && result) return false;
    return true;
  });
  const sort = state.sort;
  state.filtered.sort((a, b) => {
    const ra = state.probeResults.get(a.id);
    const rb = state.probeResults.get(b.id);
    if (sort === 'ip') return a.ip.localeCompare(b.ip, undefined, { numeric: true }) || a.port - b.port;
    if (sort === 'country') return `${a.region}|${a.country}|${a.city}`.localeCompare(`${b.region}|${b.country}|${b.city}`, 'zh-CN') || a.ip.localeCompare(b.ip, undefined, { numeric: true });
    if (sort === 'latency') {
      const va = Number.isFinite(ra?.responseTime) ? ra.responseTime : Number.POSITIVE_INFINITY;
      const vb = Number.isFinite(rb?.responseTime) ? rb.responseTime : Number.POSITIVE_INFINITY;
      return va - vb || a.ip.localeCompare(b.ip, undefined, { numeric: true });
    }
    // smart: verified reachable nodes first, sorted by measured TCP latency; then untested, then failed.
    const rank = r => !r ? 1 : r.success ? 0 : 2;
    const diff = rank(ra) - rank(rb);
    if (diff) return diff;
    if (ra?.success && rb?.success) return ra.responseTime - rb.responseTime;
    return a.ip.localeCompare(b.ip, undefined, { numeric: true }) || a.port - b.port;
  });
  const pages = Math.max(1, Math.ceil(state.filtered.length / state.pageSize));
  state.page = Math.min(state.page, pages);
}

function probeTooltip(label, probe) {
  if (!probe) return label + '：未检测';
  const exit = probe.exit || {};
  const detail = [
    probe.ok ? '探针成功' : '探针失败',
    probe.statusCode ? 'HTTP ' + probe.statusCode : '',
    probe.error || '',
    exit.ip ? '出口 IP ' + exit.ip : '',
    [exit.country, exit.city, exit.colo ? 'CF ' + exit.colo : ''].filter(Boolean).join(' / ')
  ].filter(Boolean);
  return label + '：' + detail.join('；');
}

function renderTable() {
  applyFilters();
  const total = state.filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
  const start = (state.page - 1) * state.pageSize;
  const pageItems = state.filtered.slice(start, start + state.pageSize);
  elements.resultCount.textContent = `${fmtNumber(total)} 个节点`;
  elements.pageInfo.textContent = total ? `显示 ${fmtNumber(start + 1)}–${fmtNumber(Math.min(start + pageItems.length, total))} / ${fmtNumber(total)}` : '没有符合条件的节点';
  elements.pageNumber.textContent = `${state.page} / ${totalPages}`;
  elements.prevPage.disabled = state.page <= 1;
  elements.nextPage.disabled = state.page >= totalPages;
  if (!pageItems.length) {
    elements.nodesBody.innerHTML = `<tr><td colspan="7" class="empty-cell"><div class="empty-icon">⌕</div><b>没有找到匹配的 ProxyIP</b><span>请清除搜索文字或调整左侧地区筛选。</span></td></tr>`;
    return;
  }
  elements.nodesBody.innerHTML = pageItems.map(item => {
    const result = state.probeResults.get(item.id);
    const status = !result ? '<span class="status-pill">未检测</span>' : result.success ? '<span class="status-pill online" title="至少一条探针成功并返回出口 IP">可用</span>' : '<span class="status-pill failed" title="IPv4/IPv6 探针均未能完成有效响应">失败</span>';
    const exit = result?.exitIPv4 || result?.exitIPv6 || result?.ipv4?.exit || result?.ipv6?.exit;
    const exitIp = exit?.ip || exit?.ipAddress || '';
    const exitLocation = [exit?.country || exit?.country_name, exit?.city, exit?.colo ? 'CF ' + exit.colo : ''].filter(Boolean).join(' · ');
    const exitTitle = [exitLocation, exit?.asOrganization || exit?.org, exit?.asn ? 'ASN ' + exit.asn : '', exitIp].filter(Boolean).join(' / ');
    const exitLine = exit ? '<span class="probe-exit" title="' + escapeHtml(exitTitle) + '">探针出口：' + escapeHtml(exitLocation || '已返回出口信息') + (exitIp ? ' · ' + escapeHtml(exitIp) : '') + '</span>' : '';
    const probes = result
      ? '<span class="probe-tag ' + (result.supportsIPv4 ? 'ok' : '') + '" title="' + escapeHtml(probeTooltip('IPv4', result.ipv4)) + '">IPv4 ' + (result.supportsIPv4 ? '✓' : '×') + '</span>' +
        '<span class="probe-tag ' + (result.supportsIPv6 ? 'ok' : '') + '" title="' + escapeHtml(probeTooltip('IPv6', result.ipv6)) + '">IPv6 ' + (result.supportsIPv6 ? '✓' : '×') + '</span>' + exitLine
      : '<span class="probe-tag">等待检测</span>';
    const latencyMeasured = Number.isFinite(result?.responseTime);
    const latency = latencyMeasured
      ? '<span class="latency ' + (result.responseTime < 100 ? 'fast' : result.responseTime < 250 ? 'medium' : 'slow') + '" title="' + (result.success ? '本机到候选 IP:端口的 TCP 建连延迟；不是 ICMP Ping' : 'TCP 建连确实测到了，但 TLS/HTTP/出口探针未完整通过；可用性和延迟是两个指标') + '">' + fmtLatency(result.responseTime) + '</span>'
      : '<span class="latency" title="两路探针均未建立 TCP 连接，因此没有可报告的延迟">—</span>';
    const iata = item.iata ? ` · ${escapeHtml(item.iata)}` : '';
    return `<tr data-id="${escapeHtml(item.id)}">
      <td><div class="ip-cell"><div><span class="ip-main">${escapeHtml(item.ip)}</span><button class="copy-mini" data-copy="${escapeHtml(item.id)}" title="复制 IP:端口">⧉</button></div><span class="ip-sub">PORT ${item.port}</span></div></td>
      <td><div class="location-cell"><span class="flag">${item.flag || '🌐'}</span><div class="location-text"><b>${escapeHtml(item.country || '未知国家')}</b><span>${escapeHtml(item.city || '城市未标注')}${iata}</span></div></div></td>
      <td><span class="region-tag">${escapeHtml(item.region || '未分类')}</span></td>
      <td><div class="probe-tags">${probes}</div></td>
      <td>${latency}</td>
      <td>${status}</td>
      <td><button class="row-action" data-copy="${escapeHtml(item.id)}" type="button">复制</button></td>
    </tr>`;
  }).join('');
}

function getCurrentTargets() {
  applyFilters();
  if (elements.scopeSelect.value === 'filtered') return state.filtered;
  const start = (state.page - 1) * state.pageSize;
  return state.filtered.slice(start, start + state.pageSize);
}

async function loadCatalog(isRefresh = false) {
  elements.refreshBtn.disabled = true;
  elements.refreshBtn.textContent = '读取中…';
  if (!state.items.length) elements.sourceStatus.textContent = '正在读取全球数据';
  setNotice('');
  try {
    const catalog = isRefresh ? await window.proxyApp.refreshCatalog() : await window.proxyApp.loadCatalog();
    state.catalog = catalog;
    state.items = Array.isArray(catalog.items) ? catalog.items : [];
    state.page = 1;
    renderSidebar();
    renderStats();
    renderTable();
    elements.generatedAt.textContent = fmtDate(catalog.generatedAt || catalog.cachedAt);
    elements.sourceStatus.textContent = catalog.fromCache ? '本机缓存数据' : (catalog.supplementedFromTxt ? 'JSON + TXT 国家标签补充' : (catalog.sourceFormat === 'json' ? '结构化 JSON 数据' : 'TXT 兜底数据'));
    elements.sourceShort.textContent = catalog.fromCache ? '本机缓存' : 'zip.cm.edu.kg';
    if (catalog.warnings?.length) setNotice(catalog.warnings.join('\n'));
    else setNotice('');
    showToast(`已载入 ${fmtNumber(state.items.length)} 个 IP:端口地址`);
  } catch (error) {
    elements.sourceStatus.textContent = '资源加载失败';
    setNotice(`无法加载全球 ProxyIP 资源：${error.message}`, true);
    elements.nodesBody.innerHTML = `<tr><td colspan="7" class="empty-cell"><div class="empty-icon">!</div><b>无法连接上游资源库</b><span>请检查网络后点击“更新资源”。</span></td></tr>`;
  } finally {
    elements.refreshBtn.disabled = false;
    elements.refreshBtn.innerHTML = '<span class="button-icon">↻</span>更新资源';
  }
}

async function startProbe() {
  if (state.running) {
    await window.proxyApp.stopProbe();
    return;
  }
  const targets = getCurrentTargets();
  if (!targets.length) { showToast('当前筛选没有节点可检测'); return; }
  if (elements.scopeSelect.value === 'filtered' && targets.length > 1000) {
    const ok = window.confirm(`当前筛选包含 ${fmtNumber(targets.length)} 个 IP:端口地址。\n每个地址会进行 IPv4 和 IPv6 两路 TLS/HTTP 探针，可能需要较长时间并产生较多网络连接。\n\n确定开始吗？`);
    if (!ok) return;
  }
  if (targets.length > 12000) { showToast('单轮最多检测 12,000 个地址，请缩小筛选范围'); return; }
  const continuous = elements.continuousToggle.checked;
  elements.startBtn.disabled = true;
  try {
    const result = await window.proxyApp.startProbe({
      targets: targets.map(item => ({ id: item.id, ip: item.ip, port: item.port })),
      concurrency: Number(elements.concurrencySelect.value),
      timeoutMs: Number(elements.timeoutSelect.value),
      intervalSeconds: Number(elements.intervalSelect.value),
      continuous
    });
    state.runId = result.runId;
    state.latestProgress = { completed: 0, total: result.total, online: 0 };
    setRunning(true);
    elements.monitorDescription.textContent = `${fmtNumber(result.total)} 个节点正在本机检测；每个地址执行 IPv4 / IPv6 两路 TCP + TLS + HTTP 探针。`;
    elements.progressFill.style.width = '0%';
    elements.progressText.textContent = `第 1 轮 · 0 / ${fmtNumber(result.total)}`;
  } catch (error) {
    showToast(`启动失败：${error.message}`);
  } finally {
    elements.startBtn.disabled = false;
  }
}

function updateProgress(payload) {
  if (!payload || payload.runId !== state.runId) return;
  state.latestProgress = payload;
  const percent = payload.total ? Math.min(100, payload.completed / payload.total * 100) : 0;
  elements.progressFill.style.width = `${percent}%`;
  elements.progressText.textContent = `第 ${payload.cycle} 轮 · ${fmtNumber(payload.completed)} / ${fmtNumber(payload.total)} · 可用 ${fmtNumber(payload.online)}`;
  if (payload.completed === payload.total) {
    elements.monitorDescription.textContent = `本轮完成：${fmtNumber(payload.online)} / ${fmtNumber(payload.total)} 个节点至少通过一条探针。`;
  }
}

function downloadFile(filename, content, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportFiltered() {
  applyFilters();
  if (!state.filtered.length) { showToast('没有可导出的数据'); return; }
  const headers = ['IP', 'Port', 'CountryCode', 'Country', 'Region', 'City', 'IATA', 'TCPConnectMs', 'IPv4Probe', 'IPv6Probe', 'ProbeExitIP', 'ProbeExitCountry', 'ProbeExitCity', 'ProbeExitColo', 'Status', 'CheckedAt'];
  const quote = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const rows = state.filtered.map(item => {
    const r = state.probeResults.get(item.id);
    const exit = r?.exitIPv4 || r?.exitIPv6 || r?.ipv4?.exit || r?.ipv6?.exit;
    return [item.ip, item.port, item.cca2, item.country, item.region, item.city, item.iata, r?.responseTime ?? '', r?.supportsIPv4 ? 'OK' : 'NO', r?.supportsIPv6 ? 'OK' : 'NO', exit?.ip || '', exit?.country || '', exit?.city || '', exit?.colo || '', !r ? 'Untested' : r.success ? 'Online' : 'Failed', r?.checkedAt || ''];
  });
  downloadFile(`ProxyIP-${new Date().toISOString().slice(0, 10)}.csv`, '\uFEFF' + [headers, ...rows].map(row => row.map(quote).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
  showToast(`已导出 ${fmtNumber(state.filtered.length)} 个节点`);
}

async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
    showToast(`已复制：${value}`);
  } catch {
    showToast('复制失败，请检查系统剪贴板权限');
  }
}

function updateSelectedTitle() {
  if (state.filter.city) elements.currentGroup.textContent = state.filter.city;
  else if (state.filter.cca2) {
    const sample = state.items.find(item => item.cca2 === state.filter.cca2);
    elements.currentGroup.textContent = sample?.country || state.filter.cca2;
  } else if (state.filter.region) elements.currentGroup.textContent = state.filter.region;
  else elements.currentGroup.textContent = '全球节点';
}

function installEvents() {
  elements.navAll.addEventListener('click', () => {
    state.filter = { region: null, cca2: null, city: null };
    state.page = 1; renderSidebar(); updateSelectedTitle(); scheduleRender();
  });
  elements.regionList.addEventListener('click', event => {
    const regionBtn = event.target.closest('[data-region]');
    const countryBtn = event.target.closest('[data-country]');
    const cityBtn = event.target.closest('[data-city]');
    if (regionBtn) {
      const region = regionBtn.dataset.region;
      state.filter = state.filter.region === region && !state.filter.cca2 ? { region: null, cca2: null, city: null } : { region, cca2: null, city: null };
    } else if (countryBtn) {
      const cca2 = countryBtn.dataset.country;
      const item = state.items.find(node => node.cca2 === cca2);
      state.filter = { region: item?.region || state.filter.region, cca2, city: null };
    } else if (cityBtn) {
      state.filter.city = cityBtn.dataset.city;
    } else return;
    state.page = 1; renderSidebar(); updateSelectedTitle(); scheduleRender();
  });
  elements.searchInput.addEventListener('input', () => { state.search = elements.searchInput.value; state.page = 1; scheduleRender(); });
  elements.statusFilter.addEventListener('change', () => { state.status = elements.statusFilter.value; state.page = 1; scheduleRender(); });
  elements.sortSelect.addEventListener('change', () => { state.sort = elements.sortSelect.value; state.page = 1; scheduleRender(); });
  elements.pageSize.addEventListener('change', () => { state.pageSize = Number(elements.pageSize.value); state.page = 1; scheduleRender(); });
  elements.prevPage.addEventListener('click', () => { state.page = Math.max(1, state.page - 1); scheduleRender(); });
  elements.nextPage.addEventListener('click', () => { state.page += 1; scheduleRender(); });
  elements.refreshBtn.addEventListener('click', () => loadCatalog(true));
  elements.startBtn.addEventListener('click', startProbe);
  elements.exportBtn.addEventListener('click', exportFiltered);
  elements.openSource.addEventListener('click', () => window.proxyApp.openExternal('https://zip.cm.edu.kg/all.json'));
  elements.aboutLink.addEventListener('click', event => { event.preventDefault(); elements.aboutModal.hidden = false; });
  elements.closeAbout.addEventListener('click', () => { elements.aboutModal.hidden = true; });
  elements.aboutOk.addEventListener('click', () => { elements.aboutModal.hidden = true; });
  elements.aboutModal.addEventListener('click', event => { if (event.target === elements.aboutModal) elements.aboutModal.hidden = true; });
  elements.nodesBody.addEventListener('click', event => {
    const button = event.target.closest('[data-copy]');
    if (button) copyText(button.dataset.copy);
  });
  document.addEventListener('click', event => {
    const link = event.target.closest('[data-external]');
    if (link) { event.preventDefault(); window.proxyApp.openExternal(link.href); }
  });
}

function installProbeListeners() {
  window.proxyApp.onProbeResult(({ runId, result }) => {
    if (runId !== state.runId || !result) return;
    state.probeResults.set(result.id, result);
    scheduleRender();
  });
  window.proxyApp.onProbeProgress(updateProgress);
  window.proxyApp.onProbeCycle(payload => {
    if (payload.runId !== state.runId) return;
    setRunning(true);
    elements.progressFill.style.width = '0%';
    elements.progressText.textContent = `第 ${payload.cycle} 轮 · 0 / ${fmtNumber(payload.total)}`;
    elements.monitorDescription.textContent = `第 ${payload.cycle} 轮：正在检测 ${fmtNumber(payload.total)} 个地址。`;
  });
  window.proxyApp.onProbeWaiting(payload => {
    if (payload.runId !== state.runId) return;
    setRunning(true, 'waiting');
    elements.progressText.textContent = `第 ${payload.cycle} 轮完成 · ${payload.nextInSeconds} 秒后开始下一轮`;
    elements.monitorDescription.textContent = `本轮完成，可用 ${fmtNumber(payload.summary.online)} / ${fmtNumber(payload.summary.completed)}；持续检测已开启。`;
  });
  window.proxyApp.onProbeStopped(payload => {
    if (payload.runId !== state.runId) return;
    setRunning(false, payload.cancelled ? 'idle' : 'done');
    elements.monitorDescription.textContent = payload.cancelled ? '检测已停止。' : '本轮检测已完成。';
    if (!elements.continuousToggle.checked || payload.cancelled) elements.progressText.textContent = '检测结束';
  });
  window.proxyApp.onProbeError(payload => {
    if (payload.runId !== state.runId) return;
    setRunning(false, 'error');
    showToast(`检测错误：${payload.error}`);
  });
}

async function init() {
  installEvents();
  installProbeListeners();
  elements.appVersion.textContent = `v${await window.proxyApp.getVersion()}`;
  await loadCatalog(false);
}

init();
