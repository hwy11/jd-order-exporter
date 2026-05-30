const objectUrls = new Map();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'JD_EXPORTER_CREATE_ZIP_URL') {
    const blob = new Blob([message.zipBuffer], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    objectUrls.set(url, true);
    sendResponse({ ok: true, url });
    return false;
  }

  if (message?.type === 'JD_EXPORTER_REVOKE_ZIP_URL') {
    if (objectUrls.has(message.url)) {
      URL.revokeObjectURL(message.url);
      objectUrls.delete(message.url);
    }
    sendResponse({ ok: true });
    return false;
  }

  return false;
});
