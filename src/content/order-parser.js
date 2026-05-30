export function parseOrdersFromDocument(documentRef = document) {
  return parseOrdersFromHtml(documentRef.documentElement?.outerHTML || '', documentRef.location?.href || location.href);
}

export function parseOrdersFromHtml(html, baseUrl) {
  return getOrderBlocks(html).map((block) => parseOrderBlock(block, baseUrl, html)).filter((order) => order.orderId || order.items.length);
}

export function findNextPageLink(documentRef = document) {
  const baseUrl = documentRef.location?.href || location.href;
  const anchors = Array.from(documentRef.querySelectorAll('a'));
  for (const anchor of anchors) {
    const text = normalizeText(anchor.textContent || '');
    const className = anchor.className || '';
    if (!/下一页|pn-next|next/i.test(`${text} ${className}`)) continue;
    if (/disabled|disable|curr|badge-list-next/i.test(className)) continue;
    if (!isVisibleElement(anchor)) continue;
    const href = anchor.getAttribute('href') || '';
    if (href && href !== '#' && !/^javascript:/i.test(href)) return absolutizeUrl(href, baseUrl);
  }
  return findNextPageLinkFromHtml(documentRef.documentElement?.outerHTML || '', baseUrl);
}

export function findNextPageLinkFromHtml(html, baseUrl) {
  for (const anchor of getAnchorTags(html)) {
    const text = normalizeText(stripTags(anchor.html));
    const className = getAttr(anchor.tag, 'class');
    if (!/下一页|pn-next|next/i.test(`${text} ${className}`)) continue;
    if (/disabled|disable|curr|badge-list-next/i.test(className)) continue;
    const href = getAttr(anchor.tag, 'href');
    if (href && href !== '#' && !/^javascript:/i.test(href)) return absolutizeUrl(href, baseUrl);
  }
  return '';
}

export function detectBlockingState(documentRef = document) {
  return detectBlockingStateFromHtml(documentRef.documentElement?.outerHTML || '', documentRef.location?.href || location.href);
}

export function detectBlockingStateFromHtml(html, url = '') {
  const text = normalizeText(stripTags(html));
  const hasOrders = getOrderBlocks(html).length > 0;
  const isPassportLoginUrl = /passport\.jd\.com|login\.aspx/i.test(url);
  const hasNamedLoginForm = /<form[^>]+(?:id|name)=["']?(?:formlogin|loginform|login)["']?[^>]*>/i.test(html);
  const hasLoginInputs = /<input[^>]+(?:id|name)=["']?loginname["']?[^>]*>/i.test(html) && /<input[^>]+type=["']?password["']?/i.test(html);
  const hasLoginForm = hasNamedLoginForm || hasLoginInputs;

  if (isPassportLoginUrl || (!hasOrders && hasLoginForm)) {
    return { type: 'login', message: '请先登录京东后再继续扫描。' };
  }
  if (/验证码|安全验证|滑块|verify|captcha/i.test(text)) {
    return { type: 'captcha', message: '京东要求安全验证，请手动处理后再继续。' };
  }
  return { type: 'ok', message: '' };
}

function parseOrderBlock(block, baseUrl, pageHtml = block) {
  const header = matchFirst(block, /<tr[^>]*class=["'][^"']*tr-th[^"']*["'][^>]*>([\s\S]*?)<\/tr>/i) || block;
  const rows = matchAll(block, /<tr[^>]*class=["'][^"']*tr-bd[^"']*["'][^>]*>([\s\S]*?)<\/tr>/gi);
  const consigneeBlock = extractCellByClass(block, /consignee/);
  const amountBlock = extractCellByClass(block, /amount/);
  const orderId = getAttr(block, 'data-orderid') || extractOrderId(header) || extractOrderId(block);
  const orderTime = getAttr(matchTag(header, /<span[^>]*(?:class=["'][^"']*dealtime[^"']*["']|title=["'][^"']*\d{4}[-/.]\d{1,2}[-/.]\d{1,2}[^"']*["'])[^>]*>/i), 'title') || extractDate(header);
  const detailUrl = findLink(block, /订单详情|orderid|detail/i, baseUrl);
  const invoiceUrl = findInvoiceLink(block, orderId, baseUrl);
  const invoiceStatus = invoiceUrl ? '有发票入口' : hasInvoiceInConfig(pageHtml, orderId) ? '有发票' : '';

  return {
    orderId,
    orderTime,
    shopName: extractShopName(header),
    status: extractByClass(block, /status/) || '',
    totalAmount: extractMoney(amountBlock || block),
    detailUrl,
    invoiceStatus,
    invoiceUrl,
    receiver: extractByClass(consigneeBlock, /txt/) || '',
    address: extractByClass(consigneeBlock, /detailedAddress/) || '',
    paymentMethod: extractByClass(amountBlock, /ftx-13/) || '',
    items: rows.map((row) => parseItem(row)).filter((item) => item.name)
  };
}

function parseItem(row) {
  return {
    name: getAttr(matchTag(row, /<a[^>]+title=["'][^"']+["'][^>]*>/i), 'title') || extractByClass(row, /p-name|name|goods/) || firstAnchorText(row),
    quantity: cleanQuantity(extractByClass(row, /goods-number|quantity|count/) || ''),
    unitPrice: extractByClass(row, /price|unit/) || ''
  };
}

function getOrderBlocks(html) {
  const tbodyBlocks = extractOrderTbodyBlocks(html);
  if (tbodyBlocks.length) return tbodyBlocks;
  return matchAll(html, /<div\b[^>]*(?:order|order-item)[^>]*>[\s\S]*?<\/div>/gi);
}

function extractOrderTbodyBlocks(html) {
  const startPattern = /<tbody\b[^>]*(?:(?:class=["'][^"']*order-tbody)|(?:data-orderid)|(?:id=["']tb-[^"']+))[^>]*>/gi;
  const starts = Array.from(html.matchAll(startPattern), (match) => match.index).filter((index) => typeof index === 'number');
  return starts.map((start, index) => {
    const nextStart = starts[index + 1] ?? html.length;
    return html.slice(start, nextStart).trim();
  });
}

function getAnchorTags(html) {
  const anchors = [];
  const regex = /(<a\b[^>]*>)([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = regex.exec(html))) anchors.push({ tag: match[1], html: match[2] });
  return anchors;
}

function findLink(html, pattern, baseUrl) {
  for (const anchor of getAnchorTags(html)) {
    const href = getAttr(anchor.tag, 'href');
    const haystack = `${href} ${stripTags(anchor.html)}`;
    if (href && pattern.test(haystack)) return absolutizeUrl(href, baseUrl);
  }
  return '';
}

function findInvoiceLink(html, orderId, baseUrl) {
  for (const anchor of getAnchorTags(html)) {
    const href = getAttr(anchor.tag, 'href');
    const text = stripTags(anchor.html);
    const haystack = `${href} ${text} ${anchor.tag}`;
    if (!href) continue;
    if (/发票|invoice|fpzz|myivc/i.test(haystack) && (!orderId || haystack.includes(orderId))) {
      return absolutizeUrl(href, baseUrl);
    }
  }
  return findLink(html, /发票|invoice|fpzz|myivc/i, baseUrl);
}

function hasInvoiceInConfig(html, orderId) {
  return Boolean(orderId && new RegExp(`invoiceDetailsOrders[\\s\\S]{0,500}${escapeRegExp(orderId)}`).test(html));
}

function extractShopName(html) {
  const shopTag = matchFirst(html, /<(?:span|div)[^>]*class=["'][^"']*shop[^"']*["'][^>]*>([\s\S]*?)<\/(?:span|div)>/i);
  return normalizeText(stripTags(shopTag || ''));
}

function extractByClass(html, classPattern) {
  const regex = new RegExp(`<[^>]+class=["'][^"']*(?:${classPattern.source})[^"']*["'][^>]*>([\\s\\S]*?)<\\/[^>]+>`, 'i');
  return normalizeText(stripTags(matchFirst(html, regex) || ''));
}

function extractMoney(html) {
  return extractByClass(html, /spmMoney/) || matchFirst(html, /([¥￥]\s*[\d,.]+)/) || '';
}

function extractElementByClass(html, classPattern) {
  const regex = new RegExp(`<[^>]+class=["'][^"']*(?:${classPattern.source})[^"']*["'][^>]*>[\\s\\S]*?<\\/[^>]+>`, 'i');
  return html.match(regex)?.[0] || '';
}

function extractCellByClass(html, classPattern) {
  const regex = new RegExp(`<td[^>]*>(?:(?!<\\/td>)[\\s\\S])*<[^>]+class=["'][^"']*(?:${classPattern.source})[^"']*["'][^>]*>(?:(?!<\\/td>)[\\s\\S])*<\\/td>`, 'i');
  return html.match(regex)?.[0] || extractElementByClass(html, classPattern);
}

function firstAnchorText(html) {
  const anchor = getAnchorTags(html)[0];
  return normalizeText(stripTags(anchor?.html || ''));
}

function extractOrderId(html) {
  return matchFirst(html, /订单号[:：\s]*(?:<[^>]+>)*([A-Z0-9-]{6,})/i) || matchFirst(html, /orderid=([A-Z0-9-]+)/i) || '';
}

function extractDate(html) {
  return matchFirst(html, /(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\s+\d{1,2}:\d{1,2}(?::\d{1,2})?)/) || '';
}

function cleanQuantity(value) {
  return normalizeText(value).replace(/^x/i, '').trim();
}

function matchTag(html, pattern) {
  return html.match(pattern)?.[0] || '';
}

function matchFirst(html, pattern) {
  return html.match(pattern)?.[1]?.trim() || '';
}

function matchAll(html, pattern) {
  return Array.from(html.matchAll(pattern), (match) => match[0] || match[1]).map((value) => value.trim());
}

function getAttr(tag, name) {
  const pattern = new RegExp(`${name}=["']([^"']+)["']`, 'i');
  return decodeEntities(tag?.match(pattern)?.[1]?.trim() || '');
}

function stripTags(html) {
  return String(html || '').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ');
}

function normalizeText(text) {
  return decodeEntities(text).replace(/\s+/g, ' ').trim();
}

function decodeEntities(text) {
  return String(text || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&yen;/g, '¥')
    .replace(/&mdash;/g, '—')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number.parseInt(code, 10)));
}

function absolutizeUrl(href, baseUrl) {
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return href;
  }
}

function isVisibleElement(element) {
  const rect = element.getBoundingClientRect();
  const style = element.ownerDocument.defaultView.getComputedStyle(element);
  return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
