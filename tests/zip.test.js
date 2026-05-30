import test from 'node:test';
import assert from 'node:assert/strict';
import { createZip } from '../src/shared/zip.js';

test('creates a ZIP archive with local and central directory records', () => {
  const zip = createZip([{ name: 'jd-invoices/a.txt', data: new TextEncoder().encode('hello') }]);
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);

  assert.equal(view.getUint32(0, true), 0x04034b50);
  assert.equal(view.getUint32(zip.byteLength - 22, true), 0x06054b50);
  assert.equal(new TextDecoder().decode(zip).includes('jd-invoices/a.txt'), true);
});
