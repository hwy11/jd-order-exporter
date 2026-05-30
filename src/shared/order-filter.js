export function shouldKeepOrder(order) {
  const status = `${order.status || ''} ${order.refundStatus || ''}`;
  return !/(已取消|取消|退款|退货|退单|交易关闭)/.test(status);
}

export function filterExportableOrders(orders) {
  return orders.filter(shouldKeepOrder);
}
