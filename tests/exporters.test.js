import test from 'node:test';
import assert from 'node:assert/strict';
import { exportCsv, exportExcelCsv, exportJson } from '../src/shared/exporters.js';
import { DEFAULT_FIELDS } from '../src/shared/fields.js';

const orders = [
  {
    orderId: '123',
    orderTime: '2026-01-02 10:30:00',
    shopName: '自营,旗舰店',
    status: '已完成',
    totalAmount: '￥199.00',
    detailUrl: 'https://order.jd.com/detail?id=123',
    invoiceStatus: '可开票',
    invoiceUrl: 'https://invoice.jd.com/123',
    items: [
      { name: '商品"A"', quantity: '2', unitPrice: '￥99.50' },
      { name: '第二件\n换行', quantity: '1', unitPrice: '￥0.00' }
    ]
  }
];

test('exports one CSV row per item with escaped values', () => {
  const csv = exportCsv(orders, DEFAULT_FIELDS);

  assert.match(csv, /^订单号,下单时间,店铺名,商品名称,/);
  assert.match(csv, /"自营,旗舰店"/);
  assert.match(csv, /"商品""A"""/);
  assert.match(csv, /"第二件\n换行"/);
});

test('exports Excel-compatible CSV with UTF-8 BOM', () => {
  const csv = exportExcelCsv(orders, DEFAULT_FIELDS);

  assert.equal(csv.charCodeAt(0), 0xfeff);
});

test('exports valid JSON while preserving nested items', () => {
  const parsed = JSON.parse(exportJson(orders));

  assert.equal(parsed[0].items.length, 2);
  assert.equal(parsed[0].items[0].name, '商品"A"');
});

test('sanitizes HTML entities before writing CSV cells', () => {
  const csv = exportCsv([
    {
      orderId: 'entity',
      orderTime: '2026-05-29 08:37:28',
      shopName: '京东',
      totalAmount: '&yen;27.08',
      status: '已完成',
      detailUrl: 'https://details.jd.com/normal/item.action?orderid=1&amp;PassKey=demo-pass-key',
      items: [{ name: 'A&nbsp;B', quantity: '1', unitPrice: '&yen;1.00' }]
    }
  ], ['totalAmount', 'detailUrl', 'itemName', 'unitPrice']);

  assert.match(csv, /¥27.08/);
  assert.match(csv, /PassKey=demo-pass-key/);
  assert.match(csv, /A B/);
  assert.match(csv, /¥1.00/);
});
