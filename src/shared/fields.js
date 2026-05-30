export const FIELD_DEFINITIONS = [
  { key: 'orderId', label: '订单号', scope: 'order', default: true },
  { key: 'orderTime', label: '下单时间', scope: 'order', default: true },
  { key: 'shopName', label: '店铺名', scope: 'order', default: true },
  { key: 'itemName', label: '商品名称', scope: 'item', default: true },
  { key: 'itemQuantity', label: '商品数量', scope: 'item', default: true },
  { key: 'totalAmount', label: '订单总金额', scope: 'order', default: true },
  { key: 'status', label: '订单状态', scope: 'order', default: true },
  { key: 'detailUrl', label: '订单详情链接', scope: 'order', default: true },
  { key: 'unitPrice', label: '商品单价', scope: 'item', default: false },
  { key: 'receiver', label: '收货人', scope: 'order', default: false },
  { key: 'address', label: '收货地址', scope: 'order', default: false },
  { key: 'paymentMethod', label: '支付方式', scope: 'order', default: false },
  { key: 'invoiceStatus', label: '发票状态', scope: 'order', default: false },
  { key: 'invoiceUrl', label: '发票入口链接', scope: 'order', default: false }
];

export const DEFAULT_FIELDS = FIELD_DEFINITIONS.filter((field) => field.default).map((field) => field.key);

export function getFieldDefinition(key) {
  return FIELD_DEFINITIONS.find((field) => field.key === key);
}

export function normalizeSelectedFields(fields) {
  const known = new Set(FIELD_DEFINITIONS.map((field) => field.key));
  const selected = Array.isArray(fields) ? fields.filter((field) => known.has(field)) : [];
  return selected.length ? selected : DEFAULT_FIELDS;
}
