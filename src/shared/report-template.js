import { buildConsumptionReportData } from './report-data.js';

export function renderConsumptionReport(orders) {
  const report = buildConsumptionReportData(orders);
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>京东订单消费报告</title>
<style>
:root{--bg:#0f1117;--panel:#171a23;--panel2:#1f2430;--text:#eef2ff;--muted:#9aa4b2;--line:#2b3142;--accent:#7c9cff;--accent2:#7cf0c5;--warn:#ffcf6e}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 15% 0%,rgba(124,156,255,.18),transparent 32%),radial-gradient(circle at 90% 10%,rgba(124,240,197,.12),transparent 28%),var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",Arial,sans-serif}
.wrapper{max-width:1180px;margin:0 auto;padding:38px 24px 64px}.hero{padding:34px;border:1px solid var(--line);border-radius:28px;background:linear-gradient(135deg,rgba(255,255,255,.08),rgba(255,255,255,.03));box-shadow:0 22px 80px rgba(0,0,0,.28)}
.kicker{color:var(--accent2);font-weight:700;letter-spacing:.08em;font-size:13px}h1{margin:10px 0 12px;font-size:44px;line-height:1.08}.subtitle{color:var(--muted);font-size:17px;line-height:1.8;max-width:860px}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-top:22px}.card{background:rgba(23,26,35,.82);border:1px solid var(--line);border-radius:22px;padding:20px}.metric .label{color:var(--muted);font-size:13px}.metric .num{font-size:30px;font-weight:800;margin-top:8px}.metric .hint{color:var(--muted);font-size:12px;margin-top:7px;line-height:1.5}
.section{margin-top:24px;display:grid;grid-template-columns:1.15fr .85fr;gap:18px}.full{grid-column:1/-1}h2{font-size:23px;margin:0 0 14px}p{color:#cdd5e5;line-height:1.8;margin:8px 0 0}.insight{border-left:4px solid var(--accent2);padding-left:14px;color:#e9eefc}
.chart{width:100%;height:auto;overflow:visible}.bar{fill:var(--accent);opacity:.9}.value{fill:#dfe6ff;font-size:12px}.axis{fill:var(--muted);font-size:12px}.gridline{stroke:var(--line);stroke-width:1}.line{stroke:var(--accent2);stroke-width:3.5;stroke-linecap:round;stroke-linejoin:round}.area{fill:rgba(124,240,197,.12)}.dot{fill:var(--accent2);stroke:#0f1117;stroke-width:2}
table{width:100%;border-collapse:collapse;font-size:13px}th,td{border-bottom:1px solid var(--line);padding:11px 9px;text-align:left;vertical-align:top}th{color:#dfe6ff;font-weight:700;background:rgba(255,255,255,.03)}td{color:#c7d0df}.tagrow{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}.tag{padding:8px 11px;border-radius:999px;background:rgba(124,156,255,.13);border:1px solid rgba(124,156,255,.25);color:#dfe6ff;font-size:13px}.footer{color:var(--muted);margin-top:24px;font-size:12px;line-height:1.7}
@media(max-width:900px){.grid,.section{grid-template-columns:1fr}h1{font-size:34px}}
</style>
</head>
<body>
<div class="wrapper">
  <div class="hero">
    <div class="kicker">JD ORDER LIFELOG · ${escapeHtml(report.dateRange.start || '未开始')}–${escapeHtml(report.dateRange.end || '未结束')}</div>
    <h1>你的京东消费画像报告</h1>
    <div class="subtitle">这不是普通账单，而是一份“生活轨迹数据”。本报告只统计金额有效的订单，并优先过滤取消、退款、退货等记录，避免把账面数据做虚高。</div>
    <div class="grid">
      ${metricCard('有效订单', `${formatInteger(report.validOrderCount)} 单`, `原始记录 ${formatInteger(report.rawOrderCount)} 条`)}
      ${metricCard('累计消费', formatMoney(report.totalAmount), `${report.dateRange.start || '-'} 到 ${report.dateRange.end || '-'}`)}
      ${metricCard('单均消费', formatMoney(report.averageAmount), `中位数 ${formatMoney(report.medianAmount)}`)}
      ${metricCard('最大单笔', formatMoney(report.maxOrderAmount), `Top10 订单贡献 ${formatPercent(report.top10Share)} 消费`)}
    </div>
  </div>

  <div class="section">
    <div class="card">
      <h2>年度消费趋势</h2>
      ${lineChart(report.yearTrend, { width: 760, height: 300, maxTicks: 9 })}
      <p class="insight">${escapeHtml(yearInsight(report))}</p>
    </div>
    <div class="card">
      <h2>消费人格初判</h2>
      <p>${escapeHtml(report.persona.summary)}</p>
      <div class="tagrow">${report.persona.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>
    </div>
  </div>

  <div class="section">
    <div class="card">
      <h2>钱主要花在哪些品类</h2>
      ${barChart(report.categories.slice(0, 8), { width: 760, rowHeight: 33 })}
    </div>
    <div class="card">
      <h2>品类明细</h2>
      ${categoryTable(report.categories.slice(0, 8))}
    </div>
  </div>

  <div class="section">
    <div class="card">
      <h2>月度消费波动</h2>
      ${lineChart(report.monthTrend, { width: 760, height: 290, maxTicks: 9, compactLabel: true })}
      <p class="insight">这张图最适合回看“哪几个月突然花多了”。如果某个月异常抬头，通常就是换设备、囤货、搬家、旅行或情绪消费留下的痕迹。</p>
    </div>
    <div class="card">
      <h2>购物时间偏好</h2>
      ${barChart(report.timeBuckets, { width: 760, rowHeight: 33 })}
      <p>${escapeHtml(timeInsight(report))}</p>
    </div>
  </div>

  <div class="section">
    <div class="card full">
      <h2>最烧钱的订单</h2>
      ${topOrdersTable(report.topOrders)}
    </div>
  </div>

  <div class="section">
    <div class="card">
      <h2>店铺消费排行</h2>
      ${barChart(report.shops, { width: 760, rowHeight: 33 })}
    </div>
    <div class="card">
      <h2>复购榜</h2>
      ${repeatTable(report.repeatItems)}
      <p class="insight">复购榜比最大金额榜更能暴露真实生活习惯：不是偶尔买，而是反复选择。</p>
    </div>
  </div>

  <div class="section">
    <div class="card full">
      <h2>可以怎么理解这份报告</h2>
      <p>总金额只是入口，真正有意思的是消费结构：你长期把钱投向什么，哪些月份出现异常波峰，哪些东西不断复购。它们拼起来，往往比记账软件更像一个人的生活切片。</p>
    </div>
  </div>

  <div class="footer">说明：品类由商品标题关键词自动归类，会有误差；“未知店铺/商品名缺失”来自原始订单字段。报告在本地生成，不需要联网。</div>
</div>
</body>
</html>`;
}

function metricCard(label, number, hint) {
  return `<div class="card metric"><div class="label">${escapeHtml(label)}</div><div class="num">${escapeHtml(number)}</div><div class="hint">${escapeHtml(hint)}</div></div>`;
}

function lineChart(items, options) {
  const width = options.width;
  const height = options.height;
  const left = 55;
  const right = width - 25;
  const top = 20;
  const bottom = height - 45;
  const max = niceMax(Math.max(...items.map((item) => item.amount), 0));
  const points = items.map((item, index) => {
    const x = items.length <= 1 ? left : left + ((right - left) * index) / (items.length - 1);
    const y = bottom - ((bottom - top) * item.amount) / max;
    return { ...item, x, y };
  });
  const grid = [1, 0.75, 0.5, 0.25, 0].map((ratio) => {
    const y = top + (bottom - top) * (1 - ratio);
    return `<line x1="${left}" y1="${round(y)}" x2="${right}" y2="${round(y)}" class="gridline"/><text x="${left - 8}" y="${round(y + 4)}" text-anchor="end" class="axis">${formatAxis(max * ratio)}</text>`;
  }).join('');
  const area = points.length ? `<polygon points="${left},${bottom} ${points.map((point) => `${round(point.x)},${round(point.y)}`).join(' ')} ${right},${bottom}" class="area"/>` : '';
  const line = points.length ? `<polyline points="${points.map((point) => `${round(point.x)},${round(point.y)}`).join(' ')}" fill="none" class="line"/>` : '';
  const dots = points.map((point) => `<circle cx="${round(point.x)}" cy="${round(point.y)}" r="4.2" class="dot"><title>${formatMoney(point.amount)}</title></circle>`).join('');
  const labels = pickLabels(points, options.maxTicks || 8).map((point) => `<text x="${round(point.x)}" y="${height - 18}" text-anchor="middle" class="axis">${escapeHtml(formatLineLabel(point.label, options.compactLabel))}</text>`).join('');
  return `<svg viewBox="0 0 ${width} ${height}" class="chart linechart" role="img">${grid}${area}${line}${dots}${labels}</svg>`;
}

function barChart(items, options) {
  const width = options.width;
  const left = 135;
  const rowHeight = options.rowHeight;
  const height = Math.max(70, items.length * rowHeight + 38);
  const max = Math.max(...items.map((item) => item.amount), 1);
  const maxBar = width - left - 30;
  const rows = items.map((item, index) => {
    const y = 18 + index * rowHeight;
    const barWidth = Math.max(4, (item.amount / max) * maxBar);
    return `<text x="${left - 10}" y="${y + 15}" text-anchor="end" class="axis">${escapeHtml(shorten(item.label, 12))}</text><rect x="${left}" y="${y}" width="${round(barWidth)}" height="22" rx="8" class="bar"/><text x="${round(left + barWidth + 8)}" y="${y + 15}" class="value">${formatMoney(item.amount)}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${width} ${height}" class="chart" role="img">${rows}</svg>`;
}

function categoryTable(items) {
  return `<table><thead><tr><th>品类</th><th>金额</th><th>订单数</th><th>占比</th></tr></thead><tbody>${items.map((item) => `<tr><td>${escapeHtml(item.label)}</td><td>${formatMoney(item.amount)}</td><td>${formatInteger(item.count)}</td><td>${formatPercent(item.share)}</td></tr>`).join('')}</tbody></table>`;
}

function topOrdersTable(items) {
  return `<table><thead><tr><th>日期</th><th>店铺名</th><th>商品</th><th>金额</th><th>品类</th></tr></thead><tbody>${items.map((order) => `<tr><td>${escapeHtml(order.date)}</td><td>${escapeHtml(order.shopName)}</td><td>${escapeHtml(shorten(order.title || '商品名缺失', 58))}</td><td>${formatMoney(order.amount)}</td><td>${escapeHtml(order.category)}</td></tr>`).join('')}</tbody></table>`;
}

function repeatTable(items) {
  if (!items.length) return '<p>当前订单里还没有明显复购商品。</p>';
  return `<table><thead><tr><th>商品</th><th>复购次数</th><th>估算金额</th><th>最近购买</th></tr></thead><tbody>${items.map((item) => `<tr><td>${escapeHtml(shorten(item.label, 42))}</td><td>${formatInteger(item.count)}</td><td>${formatMoney(item.amount)}</td><td>${escapeHtml(item.lastDate)}</td></tr>`).join('')}</tbody></table>`;
}

function yearInsight(report) {
  const peak = report.yearTrend.toSorted((a, b) => b.amount - a.amount)[0];
  if (!peak) return '订单还不够多，先扫描更多历史订单，报告会更有味道。';
  return `${peak.label} 年是当前消费峰值，累计 ${formatMoney(peak.amount)}。如果这一年出现大额数码、家电或搬家类订单，它通常会把年度曲线直接抬起来。`;
}

function timeInsight(report) {
  const peak = report.timeBuckets.toSorted((a, b) => b.amount - a.amount)[0];
  return peak ? `你的消费金额最集中在「${peak.label}」，累计 ${formatMoney(peak.amount)}。` : '暂时看不出明显购物时段偏好。';
}

function pickLabels(points, maxCount) {
  if (points.length <= maxCount) return points;
  const step = (points.length - 1) / (maxCount - 1);
  return Array.from({ length: maxCount }, (_item, index) => points[Math.round(index * step)]);
}

function formatLineLabel(label, compact) {
  if (!compact) return label;
  return String(label).replace(/^20/, '').replace('-', '-');
}

function niceMax(value) {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / power) * power;
}

function formatAxis(value) {
  if (value >= 10000) return `${Math.round(value / 10000)}w`;
  if (value >= 1000) return `${Math.round(value / 1000)}k`;
  return String(Math.round(value));
}

function formatMoney(value) {
  return `¥${Math.round(value).toLocaleString('zh-CN')}`;
}

function formatInteger(value) {
  return Math.round(value).toLocaleString('zh-CN');
}

function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function shorten(value, length) {
  const text = String(value || '');
  return text.length > length ? `${text.slice(0, length)}...` : text;
}

function round(value) {
  return Number(value).toFixed(1);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
