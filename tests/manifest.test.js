import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('manifest declares a JD-only Manifest V3 extension', () => {
  const manifest = JSON.parse(fs.readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));

  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.permissions.includes('downloads'), true);
  assert.equal(manifest.host_permissions.some((pattern) => pattern.includes('jd.com')), true);
  assert.deepEqual(manifest.content_scripts, []);
});

test('extension entry files exist', () => {
  for (const path of [
    '../src/background.js',
    '../src/content/content.js',
    '../src/popup/popup.html',
    '../src/popup/popup.css',
    '../src/popup/popup.js'
  ]) {
    assert.equal(fs.existsSync(new URL(path, import.meta.url)), true, `${path} should exist`);
  }
});
