const DAY_MS = 24 * 60 * 60 * 1000;

export function buildDateRange(options = {}) {
  const mode = options.mode || 'all';
  if (mode === 'recentYear') {
    const now = options.now instanceof Date ? options.now : new Date();
    const start = new Date(now.getTime() - 365 * DAY_MS);
    return {
      mode,
      start: startOfDay(start),
      end: endOfDay(now)
    };
  }

  if (mode === 'custom') {
    return {
      mode,
      start: options.startDate ? startOfDay(parseDate(options.startDate)) : null,
      end: options.endDate ? endOfDay(parseDate(options.endDate)) : null
    };
  }

  return { mode: 'all', start: null, end: null };
}

export function isOrderInRange(orderTime, range) {
  const date = parseDate(orderTime);
  if (!date) return true;
  if (range?.start && date < range.start) return false;
  if (range?.end && date > range.end) return false;
  return true;
}

export function shouldStopAtOrder(orderTime, range) {
  const date = parseDate(orderTime);
  return Boolean(date && range?.start && date < range.start);
}

export function parseDate(value) {
  if (!value) return null;
  const normalized = String(value).trim().replace(/\./g, '-').replace(/\//g, '-');
  const match = normalized.match(/(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (!match) return null;
  const [, year, month, day, hour = '0', minute = '0', second = '0'] = match;
  return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
}

function startOfDay(date) {
  if (!date) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfDay(date) {
  if (!date) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}
