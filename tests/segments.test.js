import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSegmentQueue } from '../src/shared/segments.js';

test('all orders scans every JD year segment instead of the default recent-three-month segment', () => {
  const queue = buildSegmentQueue(
    { mode: 'all' },
    'https://order.jd.com/center/list.action?d=1&s=4096&page=6',
    new Date('2026-05-30T12:00:00+08:00')
  );

  assert.equal(queue[0].url, 'https://order.jd.com/center/list.action?d=2&s=4096&page=1');
  assert.equal(queue[1].url, 'https://order.jd.com/center/list.action?d=2025&s=4096&page=1');
  assert.equal(queue.at(-1).url, 'https://order.jd.com/center/list.action?d=3&s=4096&page=1');
  assert.equal(queue.some((segment) => segment.url.includes('d=1&')), false);
});

test('custom range scans only overlapping year buckets', () => {
  const queue = buildSegmentQueue(
    { mode: 'custom', startDate: '2024-01-01', endDate: '2025-12-31' },
    'https://order.jd.com/center/list.action',
    new Date('2026-05-30T12:00:00+08:00')
  );

  assert.deepEqual(queue.map((segment) => segment.url), [
    'https://order.jd.com/center/list.action?d=2025&s=4096&page=1',
    'https://order.jd.com/center/list.action?d=2024&s=4096&page=1'
  ]);
});

test('segment queue pages can be advanced without mutating the original segment', () => {
  const [segment] = buildSegmentQueue(
    { mode: 'custom', startDate: '2025-01-01', endDate: '2025-12-31' },
    'https://order.jd.com/center/list.action',
    new Date('2026-05-30T12:00:00+08:00')
  );

  const pageTwo = new URL(segment.url);
  pageTwo.searchParams.set('page', '2');

  assert.equal(segment.url, 'https://order.jd.com/center/list.action?d=2025&s=4096&page=1');
  assert.equal(pageTwo.href, 'https://order.jd.com/center/list.action?d=2025&s=4096&page=2');
});
