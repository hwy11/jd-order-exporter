export function parseInvoiceCenterLinks(html, baseUrl) {
  const links = [];
  for (const anchor of getAnchorTags(html)) {
    const href = getAttr(anchor.tag, 'href');
    const text = normalizeText(stripTags(anchor.html));
    if (!href || !/ivcLand\.action/i.test(href) || !/发票详情|查看发票|详情/.test(text)) continue;
    const url = absolutizeUrl(href, baseUrl);
    const orderId = new URL(url).searchParams.get('orderId') || '';
    if (orderId) links.push({ orderId, invoiceUrl: url });
  }
  return dedupeByOrderId(links);
}

export function parseInvoiceDownloads(html, baseUrl) {
  const downloads = [];
  for (const anchor of getAnchorTags(html)) {
    const href = getAttr(anchor.tag, 'href');
    if (!href) continue;
    const text = normalizeText(stripTags(anchor.html));
    const url = absolutizeUrl(href, baseUrl);
    if (/\.(pdf)(?:\?|$)/i.test(url) || /查看发票|PDF/i.test(text)) {
      downloads.push({ type: 'pdf', url, label: text || '发票PDF' });
    } else if (/\.(xml)(?:\?|$)/i.test(url) || /XML/i.test(text)) {
      downloads.push({ type: 'xml', url, label: text || '发票XML' });
    }
  }
  return dedupeDownloads(downloads);
}

export function filterInvoiceDownloads(downloads, options = {}) {
  const includeXml = Boolean(options.includeXml);
  return downloads.filter((download) => download.type === 'pdf' || (includeXml && download.type === 'xml'));
}

export function invoiceFilename(order, download) {
  const extension = download.type === 'xml' ? 'xml' : 'pdf';
  const orderId = sanitizeFilename(order.orderId || 'unknown-order');
  const date = sanitizeFilename((order.orderTime || '').slice(0, 10).replaceAll('-', ''));
  const shop = sanitizeFilename(order.shopName || '京东');
  const suffix = download.type === 'xml' ? 'xml' : 'pdf';
  return `jd-invoices/${date ? `${date}-` : ''}${orderId}-${shop}-${suffix}.${extension}`;
}

function dedupeByOrderId(links) {
  const seen = new Set();
  return links.filter((link) => {
    if (seen.has(link.orderId)) return false;
    seen.add(link.orderId);
    return true;
  });
}

function dedupeDownloads(downloads) {
  const seen = new Set();
  return downloads.filter((download) => {
    if (seen.has(download.url)) return false;
    seen.add(download.url);
    return true;
  });
}

function getAnchorTags(html) {
  const anchors = [];
  const regex = /(<a\b[^>]*>)([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = regex.exec(html))) anchors.push({ tag: match[1], html: match[2] });
  return anchors;
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

function sanitizeFilename(value) {
  return String(value || '')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}
