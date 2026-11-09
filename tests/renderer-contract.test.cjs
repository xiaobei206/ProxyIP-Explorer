'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const pathUtil = require('node:path');

const root = pathUtil.resolve(__dirname, '..');
const renderer = fs.readFileSync(pathUtil.join(root, 'src', 'renderer.js'), 'utf8');

test('smart sorting puts checked failures before untested nodes', () => {
  assert.match(renderer, /const rank = r => !r \? 2 : r\.success \? 0 : 1;/);
  assert.match(renderer, /const failureText = result && !result\.success/);
});

test('probe results expose success, failure, and checked counts', () => {
  assert.match(renderer, /成功 \$\{fmtNumber\(online\)\} · 失败 \$\{fmtNumber\(failed\)\} · 已测/);
  assert.match(renderer, /result\.error \|\| '探针未通过'/);
});

test('catalog source status exposes actual country and city metadata coverage', () => {
  assert.match(renderer, /国家 ' \+ coverage\.country \+ '% \/ 城市 ' \+ coverage\.city \+ '%'/);
});
