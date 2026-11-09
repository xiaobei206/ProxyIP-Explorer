'use strict';

const net = require('node:net');

const REGION_FALLBACK = {
  AF: '非洲', AN: '南极洲', AS: '亚洲', EU: '欧洲', NA: '北美洲', OC: '大洋洲', SA: '南美洲'
};

const COUNTRY_REGION = {
  AD:'欧洲', AE:'亚洲', AF:'亚洲', AG:'北美洲', AI:'北美洲', AL:'欧洲', AM:'亚洲', AO:'非洲', AQ:'南极洲', AR:'南美洲', AS:'大洋洲', AT:'欧洲', AU:'大洋洲', AW:'北美洲', AX:'欧洲', AZ:'亚洲',
  BA:'欧洲', BB:'北美洲', BD:'亚洲', BE:'欧洲', BF:'非洲', BG:'欧洲', BH:'亚洲', BI:'非洲', BJ:'非洲', BL:'北美洲', BM:'北美洲', BN:'亚洲', BO:'南美洲', BQ:'北美洲', BR:'南美洲', BS:'北美洲', BT:'亚洲', BV:'南极洲', BW:'非洲', BY:'欧洲', BZ:'北美洲',
  CA:'北美洲', CC:'亚洲', CD:'非洲', CF:'非洲', CG:'非洲', CH:'欧洲', CI:'非洲', CK:'大洋洲', CL:'南美洲', CM:'非洲', CN:'亚洲', CO:'南美洲', CR:'北美洲', CU:'北美洲', CV:'非洲', CW:'北美洲', CX:'亚洲', CY:'亚洲', CZ:'欧洲',
  DE:'欧洲', DJ:'非洲', DK:'欧洲', DM:'北美洲', DO:'北美洲', DZ:'非洲',
  EC:'南美洲', EE:'欧洲', EG:'非洲', EH:'非洲', ER:'非洲', ES:'欧洲', ET:'非洲',
  FI:'欧洲', FJ:'大洋洲', FK:'南美洲', FM:'大洋洲', FO:'欧洲', FR:'欧洲',
  GA:'非洲', GB:'欧洲', GD:'北美洲', GE:'亚洲', GF:'南美洲', GG:'欧洲', GH:'非洲', GI:'欧洲', GL:'北美洲', GM:'非洲', GN:'非洲', GP:'北美洲', GQ:'非洲', GR:'欧洲', GS:'南极洲', GT:'北美洲', GU:'大洋洲', GW:'非洲', GY:'南美洲',
  HK:'亚洲', HM:'南极洲', HN:'北美洲', HR:'欧洲', HT:'北美洲', HU:'欧洲',
  ID:'亚洲', IE:'欧洲', IL:'亚洲', IM:'欧洲', IN:'亚洲', IO:'亚洲', IQ:'亚洲', IR:'亚洲', IS:'欧洲', IT:'欧洲',
  JE:'欧洲', JM:'北美洲', JO:'亚洲', JP:'亚洲',
  KE:'非洲', KG:'亚洲', KH:'亚洲', KI:'大洋洲', KM:'非洲', KN:'北美洲', KP:'亚洲', KR:'亚洲', KW:'亚洲', KY:'北美洲', KZ:'亚洲',
  LA:'亚洲', LB:'亚洲', LC:'北美洲', LI:'欧洲', LK:'亚洲', LR:'非洲', LS:'非洲', LT:'欧洲', LU:'欧洲', LV:'欧洲', LY:'非洲',
  MA:'非洲', MC:'欧洲', MD:'欧洲', ME:'欧洲', MF:'北美洲', MG:'非洲', MH:'大洋洲', MK:'欧洲', ML:'非洲', MM:'亚洲', MN:'亚洲', MO:'亚洲', MP:'大洋洲', MQ:'北美洲', MR:'非洲', MS:'北美洲', MT:'欧洲', MU:'非洲', MV:'亚洲', MW:'非洲', MX:'北美洲', MY:'亚洲', MZ:'非洲',
  NA:'非洲', NC:'大洋洲', NE:'非洲', NF:'大洋洲', NG:'非洲', NI:'北美洲', NL:'欧洲', NO:'欧洲', NP:'亚洲', NR:'大洋洲', NU:'大洋洲', NZ:'大洋洲',
  OM:'亚洲',
  PA:'北美洲', PE:'南美洲', PF:'大洋洲', PG:'大洋洲', PH:'亚洲', PK:'亚洲', PL:'欧洲', PM:'北美洲', PN:'大洋洲', PR:'北美洲', PS:'亚洲', PT:'欧洲', PW:'大洋洲', PY:'南美洲',
  QA:'亚洲',
  RE:'非洲', RO:'欧洲', RS:'欧洲', RU:'欧洲', RW:'非洲',
  SA:'亚洲', SB:'大洋洲', SC:'非洲', SD:'非洲', SE:'欧洲', SG:'亚洲', SH:'非洲', SI:'欧洲', SJ:'欧洲', SK:'欧洲', SL:'非洲', SM:'欧洲', SN:'非洲', SO:'非洲', SR:'南美洲', SS:'非洲', ST:'非洲', SV:'北美洲', SX:'北美洲', SY:'亚洲', SZ:'非洲',
  TC:'北美洲', TD:'非洲', TF:'南极洲', TG:'非洲', TH:'亚洲', TJ:'亚洲', TK:'大洋洲', TL:'亚洲', TM:'亚洲', TN:'非洲', TO:'大洋洲', TR:'亚洲', TT:'北美洲', TV:'大洋洲', TW:'亚洲', TZ:'非洲',
  UA:'欧洲', UG:'非洲', UM:'大洋洲', US:'北美洲', UY:'南美洲', UZ:'亚洲',
  VA:'欧洲', VC:'北美洲', VE:'南美洲', VG:'北美洲', VI:'北美洲', VN:'亚洲', VU:'大洋洲',
  WF:'大洋洲', WS:'大洋洲',
  YE:'亚洲', YT:'非洲',
  ZA:'非洲', ZM:'非洲', ZW:'非洲'
};

let countryNamesZh;
let countryNamesEn;
try {
  countryNamesZh = new Intl.DisplayNames(['zh-CN'], { type: 'region' });
  countryNamesEn = new Intl.DisplayNames(['en'], { type: 'region' });
} catch {
  countryNamesZh = null;
  countryNamesEn = null;
}

const COUNTRY_NAME_TO_CODE = new Map();
for (const code of Object.keys(COUNTRY_REGION)) {
  for (const name of [countryNamesZh?.of(code), countryNamesEn?.of(code)]) {
    if (name) COUNTRY_NAME_TO_CODE.set(name.trim().toLowerCase(), code);
  }
}
for (const [name, code] of Object.entries({
  'usa': 'US', 'u.s.a.': 'US', 'united states of america': 'US',
  'uk': 'GB', 'u.k.': 'GB', 'south korea': 'KR', 'republic of korea': 'KR',
  'north korea': 'KP', 'russia': 'RU', 'viet nam': 'VN',
  'uae': 'AE', 'taiwan': 'TW', 'hong kong': 'HK', 'macao': 'MO', 'macau': 'MO',
  'estonia': 'EE', 'eesti': 'EE', 'republic of estonia': 'EE',
  '爱沙尼亚': 'EE', '爱沙尼亚共和国': 'EE'
})) COUNTRY_NAME_TO_CODE.set(name, code);

function findCountryCode(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const upper = raw.toUpperCase();
  if (/^[A-Z]{2}$/.test(upper)) return upper;
  if (/^[A-Z]{3}$/.test(upper)) {
    const iso3 = { USA:'US', GBR:'GB', DEU:'DE', FRA:'FR', NLD:'NL', JPN:'JP', KOR:'KR', CHN:'CN', SGP:'SG', HKG:'HK', TWN:'TW', CAN:'CA', AUS:'AU', IND:'IN', BRA:'BR', RUS:'RU', TUR:'TR', ESP:'ES', ITA:'IT', CHE:'CH', SWE:'SE', NOR:'NO', FIN:'FI', POL:'PL', AUT:'AT', BEL:'BE', IRL:'IE', PRT:'PT', MEX:'MX', IDN:'ID', THA:'TH', MYS:'MY', PHL:'PH', VNM:'VN' };
    if (iso3[upper]) return iso3[upper];
  }
  return COUNTRY_NAME_TO_CODE.get(raw.toLowerCase()) || '';
}

function countryName(code) {
  const cc = String(code || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return cc || '未知国家';
  return countryNamesZh?.of(cc) || cc;
}

function flagEmoji(code) {
  const cc = String(code || '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return '🌐';
  return String.fromCodePoint(...[...cc].map(char => 127397 + char.charCodeAt(0)));
}

function normalizeRegion(value, cc) {
  const raw = String(value || '').trim();
  if (raw) {
    const normalized = raw.toLowerCase();
    const map = {
      europe: '欧洲', eu: '欧洲', asia: '亚洲', as: '亚洲', africa: '非洲', af: '非洲',
      'north america': '北美洲', 'north-america': '北美洲', na: '北美洲',
      'south america': '南美洲', 'south-america': '南美洲', sa: '南美洲',
      oceania: '大洋洲', oc: '大洋洲', antarctica: '南极洲', an: '南极洲'
    };
    return map[normalized] || raw;
  }
  return COUNTRY_REGION[String(cc || '').toUpperCase()] || '未分类';
}

function normalizeIp(value) {
  const ip = String(value || '').trim().replace(/^\[|\]$/g, '');
  if (!ip || net.isIP(ip) === 0) return null;
  return ip.toLowerCase();
}

function normalizePorts(portValue) {
  const values = Array.isArray(portValue) ? portValue : [portValue ?? 443];
  return [...new Set(values.map(value => Number(value)).filter(port => Number.isInteger(port) && port >= 1 && port <= 65535))];
}

function firstValue(...values) {
  return values.find(value => value !== undefined && value !== null && String(value).trim() !== '');
}

function hasLocationFields(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return ['cca2','countryCode','country_code','iso2','country','countryName','country_name',
    'region','continent','city','cityName','city_name','town','locality','iata','lat','latitude','lon','lng','longitude']
    .some(key => value[key] !== undefined && value[key] !== null && String(value[key]).trim() !== '');
}

function normalizeLocationObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const location = { ...value };
  if (location.country && typeof location.country === 'object') {
    const nestedCountry = location.country;
    location.cca2 ??= nestedCountry.cca2 ?? nestedCountry.code ?? nestedCountry.iso2;
    location.countryName ??= nestedCountry.name ?? nestedCountry.name_en;
    location.country = nestedCountry.name ?? nestedCountry.name_en ?? nestedCountry.code ?? '';
  }
  if (location.continent && typeof location.continent === 'object') {
    location.region ??= location.continent.name ?? location.continent.code;
  }
  return location;
}

function findLocationObject(value, depth = 0) {
  if (!value || typeof value !== 'object' || depth > 3) return null;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findLocationObject(entry, depth + 1);
      if (found) return found;
    }
    return null;
  }
  const normalized = normalizeLocationObject(value);
  if (hasLocationFields(normalized)) return normalized;
  for (const key of ['location','locations','geo','geolocation','geoip','data','result','loc','items']) {
    const found = findLocationObject(value[key], depth + 1);
    if (found) return found;
  }
  for (const entry of Object.values(value)) {
    const found = findLocationObject(entry, depth + 1);
    if (found) return found;
  }
  return null;
}

function makeItem(ipValue, port, location = {}) {
  const ip = normalizeIp(ipValue);
  if (!ip) return null;
  const rawCountry = firstValue(location.cca2, location.countryCode, location.country_code, location.iso2,
    location.cc, location.iso, location.country, location.countryName, location.country_name, location.nation);
  const cca2 = findCountryCode(rawCountry);
  const literalCountry = firstValue(location.countryName, location.country_cn, location.country_name, location.nation,
    rawCountry && !cca2 ? rawCountry : null);
  const city = String(firstValue(location.city, location.cityName, location.city_name, location.town,
    location.locality, location.municipality, location.name) || '').trim();
  const region = normalizeRegion(firstValue(location.region, location.continent, location.regionName, location.continent_name), cca2);
  const portNumber = Number(port);
  if (!Number.isInteger(portNumber) || portNumber < 1 || portNumber > 65535) return null;
  const latValue = firstValue(location.lat, location.latitude);
  const lonValue = firstValue(location.lon, location.lng, location.longitude);
  return {
    id: `${ip}:${portNumber}`,
    ip,
    port: portNumber,
    cca2,
    country: cca2 ? countryName(cca2) : String(literalCountry || '未知国家'),
    flag: flagEmoji(cca2),
    region,
    city: city || '城市未标注',
    iata: String(firstValue(location.iata, location.airport, location.airport_code) || '').trim().toUpperCase(),
    lat: latValue !== undefined && Number.isFinite(Number(latValue)) ? Number(latValue) : null,
    lon: lonValue !== undefined && Number.isFinite(Number(lonValue)) ? Number(lonValue) : null
  };
}

function flattenRecords(data) {
  if (Array.isArray(data)) return data.filter(value => value && typeof value === 'object' && !Array.isArray(value));
  if (!data || typeof data !== 'object') return [];
  for (const key of ['data','items','records','nodes','ips','proxies','results']) {
    if (Array.isArray(data[key])) return flattenRecords(data[key]);
  }
  const entries = Object.entries(data).filter(([key, value]) =>
    value && typeof value === 'object' && !Array.isArray(value) &&
    (value.ip || value.address || value.host || value.ipAddress || value.ip_address || net.isIP(key))
  );
  return entries.map(([key, value]) => ({ ...value, ip: value.ip ?? value.address ?? value.host ?? value.ipAddress ?? value.ip_address ?? key }));
}

function parseCatalogJson(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('无效的 JSON 根对象');
  let records = [];
  for (const key of ['data','items','ips','records','nodes','proxies','results']) {
    records = flattenRecords(payload[key]);
    if (records.length) break;
  }
  if (!records.length) records = flattenRecords(payload);
  const itemsById = new Map();
  for (const record of records) {
    if (!record || typeof record !== 'object') continue;
    const ip = record.ip ?? record.address ?? record.host ?? record.ipAddress ?? record.ip_address ?? record.proxyIP ?? record.proxyip;
    const portValue = record.port ?? record.ports ?? record.portRemote ?? record.remotePort ?? 443;
    const ports = normalizePorts(typeof portValue === 'string' && /[,;\s]/.test(portValue.trim())
      ? portValue.split(/[,;\s]+/).filter(Boolean) : portValue);
    // Current zip.cm.edu.kg/all.json schema stores geographic data in record.meta.
    // Keep legacy schemas as fallbacks, but prefer meta fields for the live upstream format.
    const meta = normalizeLocationObject(record.meta) || {};
    const location = findLocationObject(record.locations) || findLocationObject(record.location) ||
      findLocationObject(record.geo) || findLocationObject(record.geolocation) ||
      findLocationObject(record.meta?.location) || findLocationObject(record.meta?.geo) || {};
    const locations = {
      ...record,
      ...meta,
      ...location,
      countryName: firstValue(location.countryName, meta.country_cn, meta.countryName, meta.country_name, record.country_cn),
      iata: firstValue(location.iata, meta.iata, meta.colo?.iata, record.iata),
      lat: firstValue(location.lat, meta.lat, meta.latitude, record.lat),
      lon: firstValue(location.lon, meta.lon, meta.longitude, record.lon)
    };
    for (const port of ports) {
      const item = makeItem(ip, port, locations);
      if (!item) continue;
      const existing = itemsById.get(item.id);
      if (!existing) itemsById.set(item.id, item);
      else itemsById.set(item.id, mergeNodeLocations(existing, item));
    }
  }
  const items = [...itemsById.values()];
  return {
    items,
    generatedAt: payload.generated_at || payload.generatedAt || null,
    declaredIpCount: Number(payload.list?.ips || payload.list?.ip_count || 0) || null,
    countryCounts: payload.list?.country || payload.list?.cca2 || null,
    sourceFormat: 'json'
  };
}

function splitHostPort(raw) {
  const value = String(raw || '').trim();
  if (value.startsWith('[')) {
    const match = value.match(/^\[([^\]]+)\]:(\d+)$/);
    if (!match) return null;
    return { ip: match[1], port: Number(match[2]) };
  }
  const index = value.lastIndexOf(':');
  if (index <= 0) return null;
  return { ip: value.slice(0, index), port: Number(value.slice(index + 1)) };
}

function locationFieldMissing(value) {
  return value === undefined || value === null || value === '' ||
    value === '城市未标注' || value === '未知国家' || value === '未分类';
}

function mergeNodeLocations(oldItem, newItem) {
  const merged = { ...oldItem, ...newItem };
  for (const key of ['cca2','country','flag','region','city','iata','lat','lon']) {
    if (locationFieldMissing(newItem[key]) && !locationFieldMissing(oldItem[key])) merged[key] = oldItem[key];
  }
  if (merged.cca2 && /^[A-Z]{2}$/.test(merged.cca2)) merged.flag = flagEmoji(merged.cca2);
  if (newItem.lat === null && oldItem.lat !== null) merged.lat = oldItem.lat;
  if (newItem.lon === null && oldItem.lon !== null) merged.lon = oldItem.lon;
  return merged;
}

function parseCatalogTxt(text) {
  const itemsById = new Map();
  for (const line of String(text || '').split(/\r?\n/)) {
    const cleaned = line.trim();
    if (!cleaned || cleaned.startsWith('#') || cleaned.startsWith(';')) continue;
    const [targetPart, countryPart = ''] = cleaned.split('#', 2);
    const target = splitHostPort(targetPart);
    if (!target) continue;
    const countryText = countryPart.trim();
    const countryCode = countryText.match(/^([A-Z]{2})\b/i)?.[1] || countryText;
    const item = makeItem(target.ip, target.port, { cca2: countryCode });
    if (item) itemsById.set(item.id, item);
  }
  return {
    items: [...itemsById.values()],
    generatedAt: null,
    declaredIpCount: null,
    countryCounts: null,
    sourceFormat: 'txt'
  };
}

function mergeCatalogs(primary, secondary) {
  const items = new Map();
  for (const item of [...(secondary?.items || []), ...(primary?.items || [])]) {
    const old = items.get(item.id);
    if (!old) items.set(item.id, item);
    else items.set(item.id, mergeNodeLocations(old, item));
  }
  const base = primary?.items?.length ? primary : secondary;
  return {
    items: [...items.values()],
    generatedAt: primary?.generatedAt || secondary?.generatedAt || null,
    declaredIpCount: primary?.declaredIpCount || secondary?.declaredIpCount || null,
    countryCounts: primary?.countryCounts || secondary?.countryCounts || null,
    sourceFormat: base?.sourceFormat || 'none'
  };
}

module.exports = {
  parseCatalogJson,
  parseCatalogTxt,
  mergeCatalogs,
  normalizeRegion,
  countryName,
  flagEmoji,
  normalizeIp,
  findCountryCode
};
