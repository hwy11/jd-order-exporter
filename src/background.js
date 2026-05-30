import { getExportContent, getExportExtension, getExportMime } from './shared/exporters.js';
import { buildDateRange, isOrderInRange, shouldStopAtOrder } from './shared/date-range.js';
import { DEFAULT_FIELDS, normalizeSelectedFields } from './shared/fields.js';
import { buildSegmentQueue } from './shared/segments.js';
import { filterExportableOrders } from './shared/order-filter.js';
import { detectBlockingStateFromHtml, parseOrdersFromHtml } from './content/order-parser.js';
import { filterInvoiceDownloads, invoiceFilename, parseInvoiceCenterLinks, parseInvoiceDownloads } from './shared/invoices.js';
import { renderConsumptionReport } from './shared/report-template.js';
import { createZip } from './shared/zip.js';

const PAGE_DELAY_MS = 250;
const MAX_PAGES_PER_SEGMENT = 200;
const MAX_INVOICE_CENTER_PAGES = 30;

const state = {
  status: 'idle',
  orders: [],
  pagesScanned: 0,
  segmentsScanned: 0,
  currentSegmentLabel: '',
  invoiceStatus: '',
  invoiceDownloading: false,
  segmentQueue: [],
  selectedFields: DEFAULT_FIELDS,
  rangeOptions: { mode: 'all' },
  range: buildDateRange({ mode: 'all' }),
  lastError: '',
  stopAfterCurrentPage: false
};

const hydrated = hydrateState();
let activeScanId = 0;
let activeAbortController = null;
let activeInvoiceId = 0;
let activeInvoiceAbortController = null;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message).then(sendResponse);
  return true;
});

async function handleMessage(message) {
  await hydrated;
  if (message?.type === 'JD_EXPORTER_GET_STATE') return snapshot();
  if (message?.type === 'JD_EXPORTER_START') return startScan(message.options || {});
  if (message?.type === 'JD_EXPORTER_STOP') return stopScan();
  if (message?.type === 'JD_EXPORTER_EXPORT') return exportOrders(message.format || 'excelCsv');
  if (message?.type === 'JD_EXPORTER_REPORT') return exportConsumptionReport();
  if (message?.type === 'JD_EXPORTER_DOWNLOAD_INVOICES') return downloadInvoices(message.options || {});
  return { ok: false, error: '未知消息类型' };
}

async function startScan(options) {
  state.status = 'scanning';
  state.orders = [];
  state.pagesScanned = 0;
  state.segmentsScanned = 0;
  state.selectedFields = normalizeSelectedFields(options.fields);
  state.rangeOptions = options.range || { mode: 'all' };
  state.range = buildDateRange(state.rangeOptions);
  state.scanOptions = { autoAdvance: true, pageDelayMs: 450 };
  state.segmentQueue = buildSegmentQueue(state.rangeOptions, 'https://order.jd.com/center/list.action');
  state.currentSegmentLabel = '';
  state.lastError = '';
  state.stopAfterCurrentPage = false;
  await persistState();

  const scanId = activeScanId + 1;
  activeScanId = scanId;
  activeAbortController?.abort();
  activeAbortController = new AbortController();
  runSilentScan(scanId, activeAbortController.signal).catch((error) => {
    if (error.name === 'AbortError') return;
    state.status = 'blocked';
    state.lastError = error.message || '后台扫描失败。';
    persistState();
  });

  return { ok: true, state: snapshot() };
}

async function stopScan() {
  state.status = 'stopped';
  state.stopAfterCurrentPage = true;
  activeAbortController?.abort();
  activeInvoiceAbortController?.abort();
  if (state.invoiceDownloading) {
    state.invoiceDownloading = false;
    state.invoiceStatus = '发票打包已停止。';
  }
  await persistState();
  return { ok: true, state: snapshot() };
}

async function exportOrders(format) {
  const content = getExportContent(state.orders, state.selectedFields, format);
  const extension = getExportExtension(format);
  const filename = `jd-orders-${new Date().toISOString().slice(0, 10)}.${extension}`;
  const url = `data:${getExportMime(format)},${encodeURIComponent(content)}`;
  await chrome.downloads.download({ url, filename, saveAs: true });
  return { ok: true, state: snapshot() };
}

async function exportConsumptionReport() {
  if (state.orders.length === 0) {
    state.lastError = '请先扫描订单，再生成消费报告。';
    await persistState();
    return { ok: false, error: state.lastError, state: snapshot() };
  }

  const html = renderConsumptionReport(state.orders);
  const filename = `jd-consumption-report-${new Date().toISOString().slice(0, 10)}.html`;
  const url = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
  await chrome.downloads.download({ url, filename, saveAs: true });
  return { ok: true, state: snapshot() };
}

function filterOrders(orders) {
  return filterExportableOrders(orders).filter((order) => isOrderInRange(order.orderTime, state.range));
}

function dedupeOrders(orders) {
  const seen = new Set();
  return orders.filter((order) => {
    const key = order.orderId || `${order.orderTime}-${order.shopName}-${order.totalAmount}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function snapshot() {
  return {
    status: state.status,
    ordersCount: state.orders.length,
    pagesScanned: state.pagesScanned,
    segmentsRemaining: state.segmentQueue.length,
    segmentsScanned: state.segmentsScanned,
    currentSegmentLabel: state.currentSegmentLabel,
    invoiceStatus: state.invoiceStatus,
    invoiceDownloading: state.invoiceDownloading,
    invoiceOrdersCount: countInvoiceOrders(),
    selectedFields: state.selectedFields,
    lastError: state.lastError
  };
}

async function hydrateState() {
  const stored = await chrome.storage.local.get('jdOrderExporterState');
  const saved = stored.jdOrderExporterState;
  if (!saved) return;

  state.status = saved.status || 'idle';
  state.orders = Array.isArray(saved.orders) ? saved.orders : [];
  state.pagesScanned = Number(saved.pagesScanned || 0);
  state.segmentsScanned = Number(saved.segmentsScanned || 0);
  state.segmentQueue = Array.isArray(saved.segmentQueue) ? saved.segmentQueue : [];
  state.currentSegmentLabel = saved.currentSegmentLabel || '';
  state.invoiceStatus = saved.invoiceStatus || '';
  state.invoiceDownloading = false;
  state.selectedFields = normalizeSelectedFields(saved.selectedFields);
  state.rangeOptions = saved.rangeOptions || { mode: 'all' };
  state.range = buildDateRange(state.rangeOptions);
  state.lastError = saved.lastError || '';
  state.stopAfterCurrentPage = Boolean(saved.stopAfterCurrentPage);
  state.scanOptions = saved.scanOptions || { autoAdvance: true, pageDelayMs: 450 };
}

function persistState() {
  return chrome.storage.local.set({
    jdOrderExporterState: {
      status: state.status,
      orders: state.orders,
      pagesScanned: state.pagesScanned,
      segmentsScanned: state.segmentsScanned,
      segmentQueue: state.segmentQueue,
      currentSegmentLabel: state.currentSegmentLabel,
      invoiceStatus: state.invoiceStatus,
      invoiceDownloading: false,
      selectedFields: state.selectedFields,
      rangeOptions: state.rangeOptions,
      lastError: state.lastError,
      stopAfterCurrentPage: state.stopAfterCurrentPage,
      scanOptions: state.scanOptions
    }
  });
}

async function runSilentScan(scanId, signal) {
  while (state.status === 'scanning' && state.segmentQueue.length > 0) {
    assertCurrentScan(scanId);
    const segment = state.segmentQueue.shift();
    state.currentSegmentLabel = segment.label;
    state.segmentsScanned += 1;
    await persistState();
    await scanSegment(segment, scanId, signal);
  }

  if (state.status === 'scanning' && scanId === activeScanId) {
    state.status = 'done';
    state.currentSegmentLabel = '';
    await persistState();
  }
}

async function scanSegment(segment, scanId, signal) {
  const seenInSegment = new Set();

  for (let page = 1; page <= MAX_PAGES_PER_SEGMENT; page += 1) {
    assertCurrentScan(scanId);
    if (state.status !== 'scanning') return;

    const url = urlWithPage(segment.url, page);
    const html = await fetchOrderHtml(url, signal);
    const blocking = detectBlockingStateFromHtml(html, url);
    if (blocking.type !== 'ok') {
      state.status = 'blocked';
      state.lastError = blocking.message;
      await persistState();
      return;
    }

    const parsedOrders = parseOrdersFromHtml(html, url);
    if (parsedOrders.length === 0) break;

    const pageOrderIds = parsedOrders.map((order) => order.orderId).filter(Boolean);
    if (page > 1 && pageOrderIds.length > 0 && pageOrderIds.every((orderId) => seenInSegment.has(orderId))) {
      break;
    }
    pageOrderIds.forEach((orderId) => seenInSegment.add(orderId));

    state.pagesScanned += 1;
    state.orders = dedupeOrders([...state.orders, ...filterOrders(parsedOrders)]);

    if (parsedOrders.some((order) => shouldStopAtOrder(order.orderTime, state.range))) {
      await persistState();
      break;
    }

    await persistState();
    await delay(PAGE_DELAY_MS, signal);
  }
}

async function fetchOrderHtml(url, signal) {
  const response = await fetch(url, {
    credentials: 'include',
    cache: 'no-store',
    signal
  });
  if (!response.ok) {
    throw new Error(`京东订单页请求失败：HTTP ${response.status}`);
  }
  return response.text();
}

function urlWithPage(segmentUrl, page) {
  const url = new URL(segmentUrl);
  url.searchParams.set('page', String(page));
  return url.href;
}

function assertCurrentScan(scanId) {
  if (scanId !== activeScanId) {
    throw new DOMException('扫描已被新的任务替换。', 'AbortError');
  }
}

function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timeout);
      reject(new DOMException('扫描已停止。', 'AbortError'));
    }, { once: true });
  });
}

function countInvoiceOrders() {
  return state.orders.filter((order) => order.invoiceStatus || order.invoiceUrl).length;
}

async function downloadInvoices(options = {}) {
  if (state.invoiceDownloading) {
    return { ok: false, error: '发票正在打包中，请先停止当前任务。', state: snapshot() };
  }

  const includeXml = Boolean(options.includeXml);
  const invoiceOrders = state.orders.filter((order) => order.invoiceStatus || order.invoiceUrl);
  if (invoiceOrders.length === 0) {
    state.invoiceStatus = '没有可下载的发票。';
    await persistState();
    return { ok: false, error: state.invoiceStatus, state: snapshot() };
  }

  const invoiceId = activeInvoiceId + 1;
  activeInvoiceId = invoiceId;
  activeInvoiceAbortController?.abort();
  activeInvoiceAbortController = new AbortController();
  const { signal } = activeInvoiceAbortController;
  state.invoiceDownloading = true;
  state.invoiceStatus = '正在建立发票索引...';
  await persistState();

  try {
    const invoiceIndex = await buildInvoiceIndex(invoiceOrders, signal);
    const files = [];
    let missing = 0;
    let failed = 0;

    for (let index = 0; index < invoiceOrders.length; index += 1) {
      assertCurrentInvoice(invoiceId);
      const order = invoiceOrders[index];
      const invoiceUrl = order.invoiceUrl || invoiceIndex.get(order.orderId);
      if (!invoiceUrl) {
        missing += 1;
        continue;
      }

      state.invoiceStatus = `正在收集发票：${index + 1}/${invoiceOrders.length}`;
      await persistState();
      const detailHtml = await fetchOrderHtml(invoiceUrl, signal);
      const downloads = filterInvoiceDownloads(parseInvoiceDownloads(detailHtml, invoiceUrl), { includeXml });
      if (downloads.length === 0) {
        missing += 1;
        continue;
      }

      for (const download of downloads) {
        assertCurrentInvoice(invoiceId);
        try {
          const data = await fetchInvoiceFile(download.url, signal);
          files.push({ name: invoiceFilename(order, download), data });
        } catch {
          failed += 1;
        }
        await delay(80, signal);
      }
    }

    if (files.length === 0) {
      state.invoiceStatus = `没有成功收集到发票文件，${missing} 个订单未找到下载链接。`;
      state.invoiceDownloading = false;
      await persistState();
      return { ok: false, error: state.invoiceStatus, state: snapshot() };
    }

    state.invoiceStatus = `正在打包 ${files.length} 个文件为 ZIP...`;
    await persistState();
    const zipBytes = createZip(uniquifyZipFiles(files));
    const filename = `jd-invoices-${new Date().toISOString().slice(0, 10)}.zip`;
    await downloadZip(zipBytes, filename);

    state.invoiceStatus = `发票 ZIP 已生成：${files.length} 个文件，${missing} 个订单无链接，${failed} 个文件失败。`;
    state.invoiceDownloading = false;
    await persistState();
    return { ok: true, state: snapshot() };
  } catch (error) {
    if (error.name === 'AbortError') {
      state.invoiceStatus = '发票打包已停止。';
      state.invoiceDownloading = false;
      await persistState();
      return { ok: false, error: state.invoiceStatus, state: snapshot() };
    }
    state.invoiceStatus = error.message || '发票打包失败。';
    state.invoiceDownloading = false;
    await persistState();
    return { ok: false, error: state.invoiceStatus, state: snapshot() };
  } finally {
    if (invoiceId === activeInvoiceId) {
      state.invoiceDownloading = false;
      await persistState();
    }
  }
}

async function buildInvoiceIndex(orders, signal) {
  const wantedIds = new Set(orders.map((order) => order.orderId).filter(Boolean));
  const index = new Map();
  for (const order of orders) {
    if (order.invoiceUrl) index.set(order.orderId, order.invoiceUrl);
  }

  for (let page = 1; page <= MAX_INVOICE_CENTER_PAGES && index.size < wantedIds.size; page += 1) {
    const url = `https://myivc.jd.com/fpzz.html?page=${page}`;
    const html = await fetchOrderHtml(url, signal);
    const links = parseInvoiceCenterLinks(html, url);
    if (links.length === 0) break;
    for (const link of links) {
      if (wantedIds.has(link.orderId) && !index.has(link.orderId)) {
        index.set(link.orderId, link.invoiceUrl);
      }
    }
    await delay(120, signal);
  }
  return index;
}

function assertCurrentInvoice(invoiceId) {
  if (invoiceId !== activeInvoiceId) {
    throw new DOMException('发票任务已被新的任务替换。', 'AbortError');
  }
}

async function fetchInvoiceFile(url, signal) {
  const response = await fetch(url, {
    credentials: 'include',
    cache: 'no-store',
    signal
  });
  if (!response.ok) {
    throw new Error(`发票文件请求失败：HTTP ${response.status}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

function uniquifyZipFiles(files) {
  const seen = new Map();
  return files.map((file) => {
    const count = seen.get(file.name) || 0;
    seen.set(file.name, count + 1);
    if (count === 0) return file;
    const dot = file.name.lastIndexOf('.');
    const name = dot > -1 ? `${file.name.slice(0, dot)}-${count + 1}${file.name.slice(dot)}` : `${file.name}-${count + 1}`;
    return { ...file, name };
  });
}

async function downloadZip(zipBytes, filename) {
  await ensureOffscreenDocument();
  const response = await chrome.runtime.sendMessage({
    type: 'JD_EXPORTER_CREATE_ZIP_URL',
    zipBuffer: zipBytes.buffer
  });
  if (!response?.ok || !response.url) {
    throw new Error('创建 ZIP 下载链接失败。');
  }

  try {
    await chrome.downloads.download({
      url: response.url,
      filename,
      conflictAction: 'uniquify',
      saveAs: true
    });
  } finally {
    setTimeout(() => {
      chrome.runtime.sendMessage({ type: 'JD_EXPORTER_REVOKE_ZIP_URL', url: response.url }).catch(() => {});
    }, 30_000);
  }
}

async function ensureOffscreenDocument() {
  if (!chrome.offscreen) return;
  if (chrome.offscreen.hasDocument && await chrome.offscreen.hasDocument()) return;
  await chrome.offscreen.createDocument({
    url: 'src/offscreen.html',
    reasons: ['BLOBS'],
    justification: '把批量京东发票打包成一个 ZIP 后下载，避免触发大量单文件下载。'
  });
}
