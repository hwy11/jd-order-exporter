import { FIELD_DEFINITIONS, DEFAULT_FIELDS } from '../shared/fields.js';

const fieldsEl = document.querySelector('#fields');
const rangeModeEl = document.querySelector('#range-mode');
const customRangeEl = document.querySelector('#custom-range');
const statusEl = document.querySelector('#status');
const segmentEl = document.querySelector('#segment');
const segmentsRemainingEl = document.querySelector('#segments-remaining');
const invoiceStatusEl = document.querySelector('#invoice-status');
const pagesEl = document.querySelector('#pages');
const ordersEl = document.querySelector('#orders');
const errorEl = document.querySelector('#error');
const includeXmlEl = document.querySelector('#include-xml');

renderFields();
bindEvents();
refreshState();
setInterval(refreshState, 1000);

function renderFields() {
  fieldsEl.innerHTML = FIELD_DEFINITIONS.map((field) => `
    <label>
      <input type="checkbox" value="${field.key}" ${DEFAULT_FIELDS.includes(field.key) ? 'checked' : ''}>
      ${field.label}
    </label>
  `).join('');
}

function bindEvents() {
  rangeModeEl.addEventListener('change', () => {
    customRangeEl.classList.toggle('visible', rangeModeEl.value === 'custom');
  });

  document.querySelector('#start').addEventListener('click', async () => {
    const response = await sendMessage({ type: 'JD_EXPORTER_START', options: collectOptions() });
    renderState(response.state);
  });

  document.querySelector('#stop').addEventListener('click', async () => {
    const response = await sendMessage({ type: 'JD_EXPORTER_STOP' });
    renderState(response.state);
  });

  document.querySelectorAll('[data-export]').forEach((button) => {
    button.addEventListener('click', async () => {
      const response = await sendMessage({ type: 'JD_EXPORTER_EXPORT', format: button.dataset.export });
      renderState(response.state);
    });
  });

  document.querySelector('#download-invoices').addEventListener('click', async () => {
    const latestState = await sendMessage({ type: 'JD_EXPORTER_GET_STATE' });
    renderState(latestState);
    if (latestState.invoiceDownloading) {
      errorEl.textContent = '发票正在打包中，如需中断请点“停止”。';
      return;
    }

    const invoiceOrdersCount = latestState.invoiceOrdersCount || 0;
    if (invoiceOrdersCount === 0) {
      errorEl.textContent = '当前没有可打包的发票。';
      return;
    }

    const includeXml = includeXmlEl.checked;
    const message = includeXml
      ? `将把 ${invoiceOrdersCount} 个订单的发票 PDF 和 XML 打成一个 ZIP，只会下载 1 个文件。继续？`
      : `将把 ${invoiceOrdersCount} 个订单的发票 PDF 打成一个 ZIP，只会下载 1 个文件。继续？`;
    if (!confirm(message)) return;

    const response = await sendMessage({
      type: 'JD_EXPORTER_DOWNLOAD_INVOICES',
      options: { includeXml }
    });
    renderState(response.state);
  });
}

async function refreshState() {
  try {
    const response = await sendMessage({ type: 'JD_EXPORTER_GET_STATE' });
    renderState(response);
  } catch (error) {
    errorEl.textContent = error.message || '读取状态失败';
  }
}

function collectOptions() {
  return {
    range: {
      mode: rangeModeEl.value,
      startDate: document.querySelector('#start-date').value,
      endDate: document.querySelector('#end-date').value
    },
    fields: Array.from(fieldsEl.querySelectorAll('input:checked'), (input) => input.value)
  };
}

function renderState(state = {}) {
  statusEl.textContent = statusText(state.status);
  segmentEl.textContent = state.currentSegmentLabel || '-';
  segmentsRemainingEl.textContent = state.segmentsRemaining ?? 0;
  invoiceStatusEl.textContent = state.invoiceStatus || '-';
  pagesEl.textContent = state.pagesScanned || 0;
  ordersEl.textContent = state.ordersCount || 0;
  errorEl.textContent = state.lastError || '';
}

function statusText(status) {
  return {
    idle: '空闲',
    scanning: '扫描中',
    stopped: '已停止',
    done: '已完成',
    blocked: '需要处理'
  }[status] || '空闲';
}

function sendMessage(message) {
  return chrome.runtime.sendMessage(message);
}
