'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseCatalogJson, parseCatalogTxt, mergeCatalogs, normalizeRegion, flagEmoji } = require('../src/catalog.cjs');

test('parses structured JSON locations and multiple ports', () => {
  const catalog = parseCatalogJson({
    generated_at: '2025-07-28T06:29:43.607159',
    list: { ips: 1 },
    data: [{
      ip: '162.19.227.28',
      port: [2053, 8443],
      locations: { iata: 'FRA', lat: 50.0264, lon: 8.5431, cca2: 'DE', region: '欧洲', city: '法兰克福' }
    }]
  });
  assert.equal(catalog.items.length, 2);
  assert.equal(catalog.items[0].city, '法兰克福');
  assert.equal(catalog.items[0].region, '欧洲');
  assert.equal(catalog.items[0].country, '德国');
  assert.equal(catalog.items[1].port, 8443);
});

test('parses fallback TXT with country codes', () => {
  const catalog = parseCatalogTxt('103.102.228.113:443#NL\n103.102.228.121:2053#NL\ninvalid#US\n');
  assert.equal(catalog.items.length, 2);
  assert.equal(catalog.items[0].region, '欧洲');
  assert.equal(catalog.items[0].country, '荷兰');
  assert.equal(catalog.items[0].city, '城市未标注');
});

test('merges TXT fallback and keeps richer JSON city metadata', () => {
  const json = parseCatalogJson({ data: [{ ip: '103.102.228.113', port: [443], locations: { cca2: 'NL', city: '阿姆斯特丹', region: '欧洲' } }] });
  const txt = parseCatalogTxt('103.102.228.113:443#NL\n104.0.0.1:443#US');
  const merged = mergeCatalogs(json, txt);
  assert.equal(merged.items.length, 2);
  assert.equal(merged.items.find(item => item.ip === '103.102.228.113').city, '阿姆斯特丹');
});

test('normalizes known continents and flags', () => {
  assert.equal(normalizeRegion('Europe', 'DE'), '欧洲');
  assert.equal(normalizeRegion('', 'JP'), '亚洲');
  assert.equal(flagEmoji('JP'), '🇯🇵');
});


test('parses map-wrapped records and alternate flat geo field names', () => {
  const catalog = parseCatalogJson({
    data: {
      '1.2.3.4': { ports: [443, 8443], country_code: 'US', continent: 'North America', city_name: 'Seattle', latitude: 47.6062, longitude: -122.3321 },
      '5.6.7.8': { port: 443, location: [{ country: 'Germany', city: 'Frankfurt', region: 'Europe', iata: 'FRA' }] }
    }
  });
  assert.equal(catalog.items.length, 3);
  const seattle = catalog.items.find(item => item.ip === '1.2.3.4');
  assert.equal(seattle.cca2, 'US');
  assert.equal(seattle.country, '美国');
  assert.equal(seattle.region, '北美洲');
  assert.equal(seattle.city, 'Seattle');
  const frankfurt = catalog.items.find(item => item.ip === '5.6.7.8');
  assert.equal(frankfurt.cca2, 'DE');
  assert.equal(frankfurt.city, 'Frankfurt');
});

test('JSON and TXT merge should keep country metadata if JSON city metadata is absent', () => {
  const json = parseCatalogJson({ data: [{ ip: '9.9.9.9', port: 443, locations: { city: '', region: '' } }] });
  const txt = parseCatalogTxt('9.9.9.9:443#JP');
  const merged = mergeCatalogs(json, txt);
  assert.equal(merged.items[0].cca2, 'JP');
  assert.equal(merged.items[0].country, '日本');
  assert.equal(merged.items[0].region, '亚洲');
});
