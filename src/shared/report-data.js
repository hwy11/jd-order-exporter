const CATEGORY_RULES = [
  { name: '电脑/数码/外设', keywords: ['手机', '电脑', '笔记本', '键盘', '鼠标', '耳机', '充电', '数据线', '显示器', '路由器', '平板', '相机', '小米', 'Apple', 'ThinkPad', 'vivo', '一加', '索尼'] },
  { name: '食品饮料/零食', keywords: ['食品', '零食', '饮料', '咖啡', '茶', '牛奶', '酸奶', '水果', '蓝莓', '米饭', '盖饭', '鸡', '牛肉', '猪肉', '水'] },
  { name: '日用清洁/家居', keywords: ['洗衣', '纸巾', '抽纸', '清洁', '家居', '收纳', '垃圾袋', '餐具', '支架', '桌面', '椅', '床'] },
  { name: '服饰鞋包', keywords: ['衣', '裤', '鞋', '袜', '包', '外套', 'T恤', '卫衣', '骆驼'] },
  { name: '健康护理/药品', keywords: ['药', '牙膏', '牙刷', '护理', '口腔', '维生素', '医用', '健康'] },
  { name: '学习/办公/书籍', keywords: ['书', '教材', '办公', '笔记本', '文具', '打印', '纸'] },
  { name: '服务/充值/会员', keywords: ['会员', '充值', '服务', '话费', '流量', 'PLUS'] }
];

const TIME_BUCKETS = [
  { key: '深夜 0-6', start: 0, end: 6 },
  { key: '上午 6-12', start: 6, end: 12 },
  { key: '下午 12-18', start: 12, end: 18 },
  { key: '晚上 18-24', start: 18, end: 24 }
];

export function buildConsumptionReportData(orders) {
  const normalizedOrders = Array.isArray(orders) ? orders : [];
  const validOrders = normalizedOrders
    .map(normalizeOrder)
    .filter((order) => order.amount > 0 && order.date);

  const totalAmount = sum(validOrders.map((order) => order.amount));
  const topOrders = validOrders.toSorted((a, b) => b.amount - a.amount).slice(0, 12);
  const top10Total = sum(topOrders.slice(0, 10).map((order) => order.amount));
  const amounts = validOrders.map((order) => order.amount).toSorted((a, b) => a - b);
  const dateRange = buildDateRange(validOrders);

  return {
    generatedAt: new Date().toISOString(),
    rawOrderCount: normalizedOrders.length,
    validOrderCount: validOrders.length,
    totalAmount,
    averageAmount: validOrders.length ? totalAmount / validOrders.length : 0,
    medianAmount: median(amounts),
    maxOrderAmount: topOrders[0]?.amount || 0,
    top10Share: totalAmount ? top10Total / totalAmount : 0,
    dateRange,
    yearTrend: aggregateBy(validOrders, (order) => order.date.slice(0, 4)),
    monthTrend: aggregateBy(validOrders, (order) => order.date.slice(0, 7)).slice(-60),
    categories: aggregateCategories(validOrders, totalAmount),
    shops: aggregateBy(validOrders, (order) => order.shopName || '未知店铺').slice(0, 10),
    timeBuckets: aggregateTimeBuckets(validOrders),
    topOrders,
    repeatItems: aggregateRepeatItems(validOrders).slice(0, 12),
    persona: buildPersona(validOrders)
  };
}

export function parseMoney(value) {
  const text = decodeEntities(String(value || '')).replace(/,/g, '');
  const match = text.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function normalizeOrder(order) {
  const items = Array.isArray(order.items) ? order.items : [];
  const itemNames = items.map((item) => cleanText(item.name)).filter(Boolean);
  const title = itemNames.join(' ');
  const amount = parseMoney(order.totalAmount);
  const date = parseDate(order.orderTime);
  return {
    orderId: order.orderId || '',
    date,
    yearMonth: date ? date.slice(0, 7) : '',
    hour: parseHour(order.orderTime),
    shopName: cleanText(order.shopName) || '未知店铺',
    status: cleanText(order.status),
    amount,
    title,
    itemNames,
    category: categorize(title)
  };
}

function parseDate(value) {
  const match = String(value || '').match(/\d{4}-\d{2}-\d{2}/);
  return match?.[0] || '';
}

function parseHour(value) {
  const match = String(value || '').match(/\d{4}-\d{2}-\d{2}\s+(\d{1,2})/);
  return match ? Number(match[1]) : null;
}

function categorize(title) {
  const text = title.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((keyword) => text.includes(keyword.toLowerCase()))) return rule.name;
  }
  return '其他/难分类';
}

function aggregateBy(orders, keyGetter) {
  const groups = new Map();
  for (const order of orders) {
    const key = keyGetter(order) || '未知';
    const item = groups.get(key) || { label: key, amount: 0, count: 0 };
    item.amount += order.amount;
    item.count += 1;
    groups.set(key, item);
  }
  return Array.from(groups.values()).sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'));
}

function aggregateCategories(orders, totalAmount) {
  const categories = aggregateBy(orders, (order) => order.category).toSorted((a, b) => b.amount - a.amount);
  return categories.map((category) => ({
    ...category,
    share: totalAmount ? category.amount / totalAmount : 0
  }));
}

function aggregateTimeBuckets(orders) {
  return TIME_BUCKETS.map((bucket) => {
    const matched = orders.filter((order) => order.hour !== null && order.hour >= bucket.start && order.hour < bucket.end);
    return {
      label: bucket.key,
      amount: sum(matched.map((order) => order.amount)),
      count: matched.length
    };
  });
}

function aggregateRepeatItems(orders) {
  const groups = new Map();
  for (const order of orders) {
    const uniqueNames = new Set(order.itemNames.map((name) => name.slice(0, 80)));
    const amountShare = uniqueNames.size ? order.amount / uniqueNames.size : order.amount;
    for (const name of uniqueNames) {
      const item = groups.get(name) || { label: name, count: 0, amount: 0, lastDate: '' };
      item.count += 1;
      item.amount += amountShare;
      item.lastDate = item.lastDate > order.date ? item.lastDate : order.date;
      groups.set(name, item);
    }
  }
  return Array.from(groups.values())
    .filter((item) => item.count > 1)
    .sort((a, b) => b.count - a.count || b.amount - a.amount);
}

function buildPersona(orders) {
  const categoryAmounts = aggregateCategories(orders, sum(orders.map((order) => order.amount)));
  const topCategory = categoryAmounts[0]?.label || '生活消费';
  const evening = aggregateTimeBuckets(orders).find((bucket) => bucket.label === '晚上 18-24');
  const tags = [topCategory.replace('/外设', ''), '本地私密报告'];
  if ((evening?.amount || 0) > sum(orders.map((order) => order.amount)) * 0.35) tags.push('夜间消费明显');
  if (orders.length >= 300) tags.push('高频购物');
  if (categoryAmounts[0]?.share > 0.35) tags.push('偏好集中');
  return {
    title: `${topCategory} 型消费者`,
    summary: `你的消费重心落在「${topCategory}」。这份报告更像一张生活轨迹图：哪些年份花得多、哪些月份突然抬头、哪些商品反复出现，会比单纯的总金额更有意思。`,
    tags: Array.from(new Set(tags)).slice(0, 5)
  };
}

function buildDateRange(orders) {
  if (orders.length === 0) return { start: '', end: '' };
  const dates = orders.map((order) => order.date).sort();
  return { start: dates[0], end: dates.at(-1) };
}

function median(values) {
  if (!values.length) return 0;
  const middle = Math.floor(values.length / 2);
  return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function cleanText(value) {
  return decodeEntities(String(value || '')).replace(/\s+/g, ' ').trim();
}

function decodeEntities(text) {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&yen;/g, '¥')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number.parseInt(code, 10)));
}
