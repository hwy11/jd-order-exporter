import test from 'node:test';
import assert from 'node:assert/strict';
import { parseOrdersFromHtml, findNextPageLinkFromHtml, detectBlockingStateFromHtml } from '../src/content/order-parser.js';

test('parses representative JD order cards', () => {
  const html = `
    <table>
      <tbody class="order-tbody" data-orderid="JD-001">
        <tr class="tr-th">
          <td colspan="7">
            <span class="dealtime" title="2026-01-02 10:30:00">2026-01-02 10:30:00</span>
            <span class="number">订单号：<a href="//order.jd.com/center/list.action?search=JD-001">JD-001</a></span>
            <span class="shop-txt"><a>京东自营旗舰店</a></span>
          </td>
        </tr>
        <tr class="tr-bd">
          <td class="goods-item"><a class="name" href="//item.jd.com/1.html">机械键盘</a></td>
          <td class="goods-number">x2</td>
          <td class="amount"><span>￥299.00</span></td>
          <td class="status"><span>已完成</span></td>
          <td class="operate">
            <a href="//order.jd.com/center/detail.action?orderid=JD-001">订单详情</a>
            <a href="//invoice.jd.com/apply/JD-001">申请发票</a>
          </td>
        </tr>
        <tr class="tr-bd">
          <td class="goods-item"><a class="name">鼠标</a></td>
          <td class="goods-number">x1</td>
        </tr>
      </tbody>
    </table>
  `;

  const orders = parseOrdersFromHtml(html, 'https://order.jd.com/center/list.action');

  assert.equal(orders.length, 1);
  assert.equal(orders[0].orderId, 'JD-001');
  assert.equal(orders[0].orderTime, '2026-01-02 10:30:00');
  assert.equal(orders[0].shopName, '京东自营旗舰店');
  assert.equal(orders[0].status, '已完成');
  assert.equal(orders[0].totalAmount, '￥299.00');
  assert.equal(orders[0].detailUrl, 'https://order.jd.com/center/detail.action?orderid=JD-001');
  assert.equal(orders[0].invoiceUrl, 'https://invoice.jd.com/apply/JD-001');
  assert.deepEqual(orders[0].items, [
    { name: '机械键盘', quantity: '2', unitPrice: '' },
    { name: '鼠标', quantity: '1', unitPrice: '' }
  ]);
});

test('parses current JD tbody id order layout', () => {
  const html = `
    <table class="td-void order-tb">
      <tbody id="tb-JD-20260529-001">
        <tr class="tr-th">
          <td colspan="5">
            <span class="dealtime" title="2026-05-29 08:37:28">2026-05-29 08:37:28</span>
            <span class="number">订单号：<a href="//details.jd.com/normal/item.action?orderid=JD-20260529-001">JD-20260529-001</a></span>
            <span class="order-shop"><span class="shop-txt">京东</span></span>
          </td>
        </tr>
        <tr class="tr-bd">
          <td>
            <div class="goods-item">
              <div class="p-name"><a title="毕亚兹平板支架">毕亚兹平板支架</a></div>
            </div>
            <div class="goods-number">x1</div>
          </td>
          <td><div class="consignee"><span class="txt">张三</span><p class="detailedAddress">示例地址</p></div></td>
          <td><div class="amount"><span class="spmMoney">¥27.08</span><br><span class="ftx-13">在线支付</span></div></td>
          <td><div class="status"><span class="order-status">已完成</span><a href="//details.jd.com/normal/item.action?orderid=JD-20260529-001">订单详情</a></div></td>
          <td><div class="operate"><a href="//myivc.jd.com/fpzz/ivcLand.action?orderId=JD-20260529-001">查看发票</a></div></td>
        </tr>
      </tbody>
    </table>
  `;

  const orders = parseOrdersFromHtml(html, 'https://order.jd.com/center/list.action');

  assert.equal(orders.length, 1);
  assert.equal(orders[0].orderId, 'JD-20260529-001');
  assert.equal(orders[0].shopName, '京东');
  assert.equal(orders[0].receiver, '张三');
  assert.equal(orders[0].address, '示例地址');
  assert.equal(orders[0].paymentMethod, '在线支付');
  assert.equal(orders[0].items[0].name, '毕亚兹平板支架');
});

test('decodes JD HTML entities and extracts invoice links from current layout', () => {
  const html = `
    <tbody id="tb-JD-20260529-001">
      <tr class="tr-th">
        <td colspan="5">
          <span class="dealtime" title="2026-05-29 08:37:28">2026-05-29 08:37:28</span>
          <span class="number">订单号：<a href="//details.jd.com/normal/item.action?orderid=JD-20260529-001&amp;PassKey=demo-pass-key">JD-20260529-001</a></span>
          <span class="shop-txt">京东</span>
        </td>
      </tr>
      <tr class="tr-bd">
        <td><div class="p-name"><a title="支架">支架</a></div><div class="goods-number">x1</div></td>
        <td><div class="amount"><span class="spmMoney">&yen;27.08</span><span class="ftx-13">在线支付</span></div></td>
        <td><div class="status"><span>已完成</span><a href="//details.jd.com/normal/item.action?orderid=JD-20260529-001&amp;PassKey=demo-pass-key">订单详情</a></div></td>
        <td><div class="operate"><a href="//myivc.jd.com/fpzz/ivcLand.action?orderId=JD-20260529-001&amp;tagStr=demo-tag" clstag="click|keycount|orderinfo|invoice_show">查看发票</a></div></td>
      </tr>
    </tbody>
  `;

  const [order] = parseOrdersFromHtml(html, 'https://order.jd.com/center/list.action');

  assert.equal(order.totalAmount, '¥27.08');
  assert.equal(order.detailUrl, 'https://details.jd.com/normal/item.action?orderid=JD-20260529-001&PassKey=demo-pass-key');
  assert.equal(order.invoiceStatus, '有发票入口');
  assert.equal(order.invoiceUrl, 'https://myivc.jd.com/fpzz/ivcLand.action?orderId=JD-20260529-001&tagStr=demo-tag');
});

test('marks invoice status from JD invoice config when the invoice link is not rendered', () => {
  const html = `
    <script>$ORDER_CONFIG['invoiceDetailsOrders']='JD-20260529-001,JD-EXTRA-001';</script>
    <tbody id="tb-JD-20260529-001">
      <tr class="tr-th"><td><span class="dealtime" title="2026-05-29 08:37:28"></span>订单号：<a>JD-20260529-001</a><span class="shop-txt">京东</span></td></tr>
      <tr class="tr-bd"><td><div class="p-name"><a title="支架">支架</a></div><div class="goods-number">x1</div></td><td><div class="status"><span>已完成</span></div></td></tr>
    </tbody>
  `;

  const [order] = parseOrdersFromHtml(html, 'https://order.jd.com/center/list.action');

  assert.equal(order.invoiceStatus, '有发票');
  assert.equal(order.invoiceUrl, '');
});

test('parses a final JD tbody even when the HTML omits the closing tbody tag', () => {
  const html = `
    <table>
      <tbody id="tb-JD-20251216-001">
        <tr class="tr-th"><td><span class="dealtime" title="2025-12-16 09:11:19">2025-12-16 09:11:19</span>订单号：<a>JD-20251216-001</a><span class="shop-txt">京东</span></td></tr>
        <tr class="tr-bd"><td><div class="p-name"><a title="魅蓝耳放">魅蓝耳放</a></div><div class="goods-number">x1</div></td><td><div class="status"><span>已完成</span></div></td></tr>
  `;

  const orders = parseOrdersFromHtml(html, 'https://order.jd.com/center/list.action');

  assert.equal(orders.length, 1);
  assert.equal(orders[0].orderId, 'JD-20251216-001');
  assert.equal(orders[0].items[0].name, '魅蓝耳放');
});

test('finds available next page link and ignores disabled pagination', () => {
  const html = `
    <a class="badge-list-next" href="javascript:void(0);">&gt;</a>
    <a class="pn-next" href="/center/list.action?page=2">下一页</a>
    <a class="pn-next disabled" href="/center/list.action?page=3">下一页</a>
  `;

  assert.equal(findNextPageLinkFromHtml(html, 'https://order.jd.com/center/list.action?page=1'), 'https://order.jd.com/center/list.action?page=2');
});

test('detects login and captcha blocking states', () => {
  assert.equal(detectBlockingStateFromHtml('<form id="loginname"></form>', 'https://passport.jd.com/new/login.aspx').type, 'login');
  assert.equal(detectBlockingStateFromHtml('<div>请完成安全验证</div>', 'https://order.jd.com/center/list.action').type, 'captcha');
});

test('does not treat a logged-in order page with login-related hidden markup as login blocked', () => {
  const html = `
    <input id="loginname" type="hidden" value="">
    <tbody class="order-tbody" data-orderid="JD-20260529-001">
      <tr class="tr-th"><td>2026-05-29 08:37:28 订单号：JD-20260529-001</td></tr>
      <tr class="tr-bd"><td class="goods-item"><a class="name">桌面支架</a></td></tr>
    </tbody>
  `;

  assert.equal(detectBlockingStateFromHtml(html, 'https://order.jd.com/center/list.action').type, 'ok');
});
