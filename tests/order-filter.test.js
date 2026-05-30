import test from 'node:test';
import assert from 'node:assert/strict';
import { filterExportableOrders, shouldKeepOrder } from '../src/shared/order-filter.js';

test('keeps completed orders', () => {
  assert.equal(shouldKeepOrder({ status: '已完成' }), true);
});

test('drops cancelled, refunded, and returned orders', () => {
  assert.equal(shouldKeepOrder({ status: '已取消' }), false);
  assert.equal(shouldKeepOrder({ status: '退款完成' }), false);
  assert.equal(shouldKeepOrder({ status: '退货中' }), false);
});

test('filters exportable orders from a mixed list', () => {
  const orders = filterExportableOrders([
    { orderId: '1', status: '已完成' },
    { orderId: '2', status: '已取消' },
    { orderId: '3', status: '退款完成' }
  ]);

  assert.deepEqual(orders.map((order) => order.orderId), ['1']);
});
