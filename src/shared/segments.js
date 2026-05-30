export function buildSegmentQueue(rangeOptions, currentUrl, now = new Date()) {
  const baseUrl = new URL(currentUrl || 'https://order.jd.com/center/list.action');
  const currentYear = now.getFullYear();
  const options = rangeOptions || { mode: 'all' };
  let segmentValues = [];

  if (options.mode === 'all') {
    segmentValues = ['2', ...descendingYears(currentYear - 1, 2014), '3'];
  } else if (options.mode === 'recentYear') {
    segmentValues = ['2', String(currentYear - 1)];
  } else if (options.mode === 'custom') {
    segmentValues = segmentValuesForCustomRange(options, currentYear);
  } else {
    segmentValues = ['1'];
  }

  return [...new Set(segmentValues)].map((value) => ({
    label: labelForSegment(value, currentYear),
    url: urlForSegment(baseUrl, value)
  }));
}

function segmentValuesForCustomRange(options, currentYear) {
  const startYear = yearFromDate(options.startDate) || 2014;
  const endYear = yearFromDate(options.endDate) || currentYear;
  const values = [];

  if (endYear >= currentYear) values.push('2');
  for (const year of descendingYears(Math.min(endYear, currentYear - 1), Math.max(startYear, 2014))) {
    values.push(String(year));
  }
  if (startYear < 2014) values.push('3');
  return values.length ? values : ['1'];
}

function descendingYears(start, end) {
  const years = [];
  for (let year = start; year >= end; year -= 1) years.push(String(year));
  return years;
}

function yearFromDate(value) {
  const match = String(value || '').match(/^(\d{4})/);
  return match ? Number(match[1]) : null;
}

function labelForSegment(value, currentYear) {
  if (value === '1') return '近三个月订单';
  if (value === '2') return `${currentYear} 年订单`;
  if (value === '3') return '2014 年以前订单';
  return `${value} 年订单`;
}

function urlForSegment(baseUrl, value) {
  const url = new URL('/center/list.action', baseUrl.origin);
  url.searchParams.set('d', value);
  url.searchParams.set('s', '4096');
  url.searchParams.set('page', '1');
  return url.href;
}
