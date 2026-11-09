'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

test('project metadata and UI version are aligned', () => {
  assert.equal(pkg.version, '0.1.3');
  const html = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  assert.match(html, new RegExp(`id="appVersion">v${pkg.version}<`));
  assert.match(readme, new RegExp(`ProxyIP Explorer ${pkg.version}`));
});

test('Windows dependency installer entry points and diagnostic script exist', () => {
  for (const file of ['安装依赖.bat', '启动软件.bat', '打包便携版EXE.bat', 'scripts/install-deps.ps1']) {
    assert.ok(fs.existsSync(path.join(root, file)), `missing ${file}`);
  }
  const installer = fs.readFileSync(path.join(root, 'scripts', 'install-deps.ps1'), 'utf8');
  assert.match(installer, /install-dependencies\.log/);
  assert.match(installer, /registry\.npmmirror\.com/);
  assert.match(installer, /registry\.npmjs\.org/);
  assert.match(installer, /node_modules.*electron.*install\.js/s);
  assert.match(installer, /Invoke-ElectronBinaryDownload/);
  assert.match(installer, /electron\.exe/);
});
