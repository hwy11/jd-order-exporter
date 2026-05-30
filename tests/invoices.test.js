import test from 'node:test';
import assert from 'node:assert/strict';
import { filterInvoiceDownloads, invoiceFilename, parseInvoiceCenterLinks, parseInvoiceDownloads } from '../src/shared/invoices.js';

test('parses invoice detail links from JD invoice center page', () => {
  const links = parseInvoiceCenterLinks(`
    <a href="//myivc.jd.com/fpzz/ivcLand.action?orderId=JD-20260529-001&amp;tagStr=demo-tag">发票详情</a>
    <a href="#none">该订单暂不支持发票开具业务</a>
  `, 'https://myivc.jd.com/fpzz.html');

  assert.deepEqual(links, [
    {
      orderId: 'JD-20260529-001',
      invoiceUrl: 'https://myivc.jd.com/fpzz/ivcLand.action?orderId=JD-20260529-001&tagStr=demo-tag'
    }
  ]);
});

test('parses PDF and XML download links from invoice detail page', () => {
  const downloads = parseInvoiceDownloads(`
    <a class="download-trigger" href="https://example.com/digital_1.pdf?token=abc">查看发票</a>
    <a class="download-trigger" href="https://example.com/invoice_1.xml?token=abc">查看XML</a>
  `, 'https://myivc.jd.com/fpzz/ivcLand.action');

  assert.deepEqual(downloads, [
    { type: 'pdf', url: 'https://example.com/digital_1.pdf?token=abc', label: '查看发票' },
    { type: 'xml', url: 'https://example.com/invoice_1.xml?token=abc', label: '查看XML' }
  ]);
});

test('filters invoice downloads to PDF only by default', () => {
  const downloads = [
    { type: 'pdf', url: 'https://example.com/1.pdf', label: 'PDF' },
    { type: 'xml', url: 'https://example.com/1.xml', label: 'XML' }
  ];

  assert.deepEqual(filterInvoiceDownloads(downloads), [
    { type: 'pdf', url: 'https://example.com/1.pdf', label: 'PDF' }
  ]);
  assert.deepEqual(filterInvoiceDownloads(downloads, { includeXml: true }), downloads);
});

test('builds safe invoice filenames', () => {
  const filename = invoiceFilename(
    { orderId: 'JD-20260529-001', orderTime: '2026-05-29 08:37:28', shopName: '京东/自营' },
    { type: 'pdf', url: 'https://example.com/a.pdf' }
  );

  assert.equal(filename, 'jd-invoices/20260529-JD-20260529-001-京东-自营-pdf.pdf');
});
