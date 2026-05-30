import test from 'node:test';
import assert from 'node:assert/strict';
import { buildConsumptionReportData, parseMoney } from '../src/shared/report-data.js';

const orders = [
  {
    orderId: '1',
    orderTime: '2025-01-02 21:30:00',
    shopName: '京东',
    status: '已完成',
    totalAmount: '￥4,999.00',
    items: [{ name: 'Apple 手机', quantity: '1' }]
  },
  {
    orderId: '2',
    orderTime: '2025-02-03 09:10:00',
    shopName: '超市',
    status: '已完成',
    totalAmount: '&yen;99.50',
    items: [{ name: '农夫山泉饮用水', quantity: '1' }]
  },
  {
    orderId: '3',
    orderTime: '2026-03-04 23:00:00',
    shopName: '京东',
    status: '已完成',
    totalAmount: '￥99.50',
    items: [{ name: '农夫山泉饮用水', quantity: '1' }]
  }
];

test('parses money strings from JD exports', () => {
  assert.equal(parseMoney('￥4,999.00'), 4999);
  assert.equal(parseMoney('&yen;27.08'), 27.08);
  assert.equal(parseMoney(''), 0);
});

test('builds consumption report metrics and rankings', () => {
  const report = buildConsumptionReportData(orders);

  assert.equal(report.rawOrderCount, 3);
  assert.equal(report.validOrderCount, 3);
  assert.equal(report.totalAmount, 5198);
  assert.equal(report.maxOrderAmount, 4999);
  assert.equal(report.yearTrend.map((item) => item.label).join(','), '2025,2026');
  assert.equal(report.categories[0].label, '电脑/数码/外设');
  assert.equal(report.repeatItems[0].label, '农夫山泉饮用水');
  assert.equal(report.timeBuckets.find((item) => item.label === '晚上 18-24').count, 2);
});
