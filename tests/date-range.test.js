import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDateRange, isOrderInRange, shouldStopAtOrder } from '../src/shared/date-range.js';

test('includes orders inside a custom inclusive date range', () => {
  const range = buildDateRange({ mode: 'custom', startDate: '2026-01-01', endDate: '2026-01-31' });

  assert.equal(isOrderInRange('2026-01-01 00:00:00', range), true);
  assert.equal(isOrderInRange('2026-01-31 23:59:59', range), true);
  assert.equal(isOrderInRange('2025-12-31 23:59:59', range), false);
  assert.equal(isOrderInRange('2026-02-01 00:00:00', range), false);
});

test('recent-year range is anchored to the supplied current date', () => {
  const range = buildDateRange({ mode: 'recentYear', now: new Date('2026-05-30T12:00:00+08:00') });

  assert.equal(isOrderInRange('2025-05-30 00:00:00', range), true);
  assert.equal(isOrderInRange('2025-05-29 23:59:59', range), false);
});

test('stops scanning once descending order history is older than the range start', () => {
  const range = buildDateRange({ mode: 'custom', startDate: '2026-01-01', endDate: '2026-01-31' });

  assert.equal(shouldStopAtOrder('2025-12-31 23:59:59', range), true);
  assert.equal(shouldStopAtOrder('2026-01-15 12:00:00', range), false);
});
