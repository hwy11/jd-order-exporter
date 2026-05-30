import { getFieldDefinition, normalizeSelectedFields } from './fields.js';

const BOM = '\ufeff';

export function exportCsv(orders, fields) {
  const selectedFields = normalizeSelectedFields(fields);
  const rows = flattenOrders(orders, selectedFields);
  const header = selectedFields.map((key) => getFieldDefinition(key)?.label || key);
  return [header, ...rows].map((row) => row.map(escapeCsvValue).join(',')).join('\n');
}

export function exportExcelCsv(orders, fields) {
  return BOM + exportCsv(orders, fields);
}

export function exportJson(orders) {
  return JSON.stringify(orders, null, 2);
}

export function getExportMime(format) {
  if (format === 'json') return 'application/json;charset=utf-8';
  return 'text/csv;charset=utf-8';
}

export function getExportContent(orders, fields, format) {
  if (format === 'json') return exportJson(orders);
  if (format === 'excelCsv') return exportExcelCsv(orders, fields);
  return exportCsv(orders, fields);
}

export function getExportExtension(format) {
  return format === 'json' ? 'json' : 'csv';
}

function flattenOrders(orders, selectedFields) {
  return orders.flatMap((order) => {
    const items = order.items?.length ? order.items : [{}];
    return items.map((item) => selectedFields.map((field) => getFieldValue(order, item, field)));
  });
}

function getFieldValue(order, item, field) {
  if (field === 'itemName') return item.name || '';
  if (field === 'itemQuantity') return item.quantity || '';
  if (field === 'unitPrice') return item.unitPrice || '';
  return order[field] || '';
}

function escapeCsvValue(value) {
  const text = decodeEntities(String(value ?? ''));
  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function decodeEntities(text) {
  return text
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
