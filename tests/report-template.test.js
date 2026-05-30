import test from 'node:test';
import assert from 'node:assert/strict';
import { renderConsumptionReport } from '../src/shared/report-template.js';

test('renders a standalone Chinese HTML consumption report', () => {
  const html = renderConsumptionReport([
    {
      orderId: '1',
      orderTime: '2025-01-02 21:30:00',
      shopName: '京东',
      status: '已完成',
      totalAmount: '￥199.00',
      items: [{ name: '机械键盘', quantity: '1' }]
    }
  ]);

  assert.match(html, /^<!doctype html>/);
  assert.match(html, /你的京东消费画像报告/);
  assert.match(html, /年度消费趋势/);
  assert.match(html, /机械键盘/);
  assert.doesNotMatch(html, /<script/i);
});

test('escapes user-controlled text in report HTML', () => {
  const html = renderConsumptionReport([
    {
      orderId: '1',
      orderTime: '2025-01-02 21:30:00',
      shopName: '<img src=x onerror=alert(1)>',
      status: '已完成',
      totalAmount: '￥199.00',
      items: [{ name: '<script>alert(1)</script>', quantity: '1' }]
    }
  ]);

  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;alert/);
  assert.match(html, /&lt;img src=x/);
});
