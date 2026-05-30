if (!window.__jdOrderExporterLoaded) {
window.__jdOrderExporterLoaded = true;

(async () => {
  const parser = await import(chrome.runtime.getURL('src/content/order-parser.js'));
  let stopRequested = false;

  chrome.runtime.sendMessage({ type: 'JD_EXPORTER_CONTENT_READY' }).then((response) => {
    if (response?.shouldScan) {
      runScan(response.options || {}, parser);
    }
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'JD_EXPORTER_START_SCAN') {
      stopRequested = false;
      runScan(message.options || {}, parser).then(sendResponse);
      return true;
    }

    if (message?.type === 'JD_EXPORTER_STOP_SCAN') {
      stopRequested = true;
      sendResponse({ ok: true });
    }

    return false;
  });

  async function runScan(options, orderParser) {
    const blocking = orderParser.detectBlockingState(document);
    if (blocking.type !== 'ok') {
      chrome.runtime.sendMessage({ type: 'JD_EXPORTER_BLOCKED', blocking });
      return { ok: false, reason: blocking.type };
    }

    const orders = orderParser.parseOrdersFromDocument(document);
    const recordResponse = await chrome.runtime.sendMessage({
      type: 'JD_EXPORTER_PAGE_SCANNED',
      orders,
      pageUrl: location.href
    });

    if (stopRequested || recordResponse?.state?.status !== 'scanning') return { ok: true, stopped: true };

    const nextUrl = orderParser.findNextPageLink(document);
    if (!options.autoAdvance || !nextUrl) {
      chrome.runtime.sendMessage({ type: 'JD_EXPORTER_SCAN_DONE' });
      return { ok: true, done: true };
    }

    await delay(Number(options.pageDelayMs || 1200));
    if (!stopRequested) location.href = nextUrl;
    return { ok: true, advancing: true, nextUrl };
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
})();
}
