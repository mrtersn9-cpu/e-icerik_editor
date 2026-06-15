// Grafik (chart) eleman tipi için ortak yardımcılar — harici kütüphane olmadan saf inline SVG.
// HTML üretimi editör (StageCanvas) tarafında kullanılır; SCORM runtime/önizleme aynı mantığı generated
// storylineRendererCore.js içindeki storylineRendererChartHtml ile birebir tekrarlar.

export const CHART_PALETTE = ['#2563eb', '#16a34a', '#f97316', '#db2777', '#7c3aed', '#0891b2', '#eab308', '#ef4444'];

const VIEW_W = 320;
const VIEW_H = 200;
const PAD = 26;

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// chartData'yı normalize edilmiş bir nokta dizisine getirir: [{ label, value, color }].
export function normalizeChartData(chartData) {
  const data = chartData && typeof chartData === 'object' ? chartData : {};
  const labels = Array.isArray(data.labels) ? data.labels : [];
  const values = Array.isArray(data.values) ? data.values : [];
  const colors = Array.isArray(data.colors) ? data.colors : [];
  const count = Math.max(labels.length, values.length);
  const points = [];
  for (let i = 0; i < count; i += 1) {
    points.push({
      label: String(labels[i] == null ? `#${i + 1}` : labels[i]),
      value: Number(values[i]) || 0,
      color: colors[i] || CHART_PALETTE[i % CHART_PALETTE.length],
    });
  }
  return points;
}

export function createDefaultChartData() {
  return { labels: ['Oca', 'Şub', 'Mar', 'Nis'], values: [40, 65, 30, 80], colors: [] };
}

export const CHART_TYPES = [
  { value: 'bar', label: 'Sütun' },
  { value: 'line', label: 'Çizgi' },
  { value: 'pie', label: 'Pasta' },
];

// ─── Grafik veri düzenleme işlemleri (editör modalı tarafından kullanılır) ─────

function cloneChartData(chartData) {
  const data = chartData && typeof chartData === 'object' ? chartData : {};
  return {
    labels: Array.isArray(data.labels) ? [...data.labels] : [],
    values: Array.isArray(data.values) ? [...data.values] : [],
    colors: Array.isArray(data.colors) ? [...data.colors] : [],
  };
}

export function chartAddPoint(chartData) {
  const next = cloneChartData(chartData);
  next.labels.push(`#${next.labels.length + 1}`);
  next.values.push(0);
  return next;
}

export function chartRemovePoint(chartData) {
  const next = cloneChartData(chartData);
  if (next.labels.length <= 1) return next;
  next.labels.pop();
  next.values.pop();
  return next;
}

export function chartSetLabel(chartData, index, label) {
  const next = cloneChartData(chartData);
  next.labels[index] = label;
  return next;
}

export function chartSetValue(chartData, index, value) {
  const next = cloneChartData(chartData);
  next.values[index] = Number(value) || 0;
  return next;
}

function renderBar(points) {
  const max = Math.max(1, ...points.map((p) => p.value));
  const baseY = VIEW_H - PAD;
  const chartH = VIEW_H - 2 * PAD;
  const chartW = VIEW_W - 2 * PAD;
  const slot = chartW / Math.max(1, points.length);
  const barW = slot * 0.6;
  const bars = points
    .map((p, i) => {
      const x = PAD + i * slot + (slot - barW) / 2;
      const h = (p.value / max) * chartH;
      const y = baseY - h;
      const label = `<text x="${x + barW / 2}" y="${VIEW_H - PAD + 12}" font-size="9" fill="#64748b" text-anchor="middle">${esc(p.label)}</text>`;
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(0, h).toFixed(1)}" rx="2" fill="${esc(p.color)}"/>${label}`;
    })
    .join('');
  return `<line x1="${PAD}" y1="${baseY}" x2="${VIEW_W - PAD}" y2="${baseY}" stroke="#cbd5e1"/>${bars}`;
}

function renderLine(points) {
  const max = Math.max(1, ...points.map((p) => p.value));
  const baseY = VIEW_H - PAD;
  const chartH = VIEW_H - 2 * PAD;
  const chartW = VIEW_W - 2 * PAD;
  const step = points.length > 1 ? chartW / (points.length - 1) : 0;
  const coords = points.map((p, i) => ({
    x: PAD + i * step,
    y: baseY - (p.value / max) * chartH,
    p,
  }));
  const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
  const dots = coords
    .map(
      (c) =>
        `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="3" fill="${esc(c.p.color)}"/>` +
        `<text x="${c.x.toFixed(1)}" y="${VIEW_H - PAD + 12}" font-size="9" fill="#64748b" text-anchor="middle">${esc(c.p.label)}</text>`
    )
    .join('');
  return (
    `<line x1="${PAD}" y1="${baseY}" x2="${VIEW_W - PAD}" y2="${baseY}" stroke="#cbd5e1"/>` +
    `<path d="${path}" fill="none" stroke="${esc(points[0]?.color || CHART_PALETTE[0])}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>${dots}`
  );
}

function renderPie(points) {
  const total = points.reduce((sum, p) => sum + Math.max(0, p.value), 0) || 1;
  const cx = VIEW_W / 2;
  const cy = VIEW_H / 2;
  const r = Math.min(VIEW_W, VIEW_H) / 2 - PAD;
  let angle = -Math.PI / 2;
  if (points.length === 1) {
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${esc(points[0].color)}"/>`;
  }
  return points
    .map((p) => {
      const slice = (Math.max(0, p.value) / total) * Math.PI * 2;
      const x1 = cx + r * Math.cos(angle);
      const y1 = cy + r * Math.sin(angle);
      angle += slice;
      const x2 = cx + r * Math.cos(angle);
      const y2 = cy + r * Math.sin(angle);
      const largeArc = slice > Math.PI ? 1 : 0;
      return `<path d="M${cx} ${cy} L${x1.toFixed(1)} ${y1.toFixed(1)} A${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z" fill="${esc(p.color)}"/>`;
    })
    .join('');
}

// Bir grafik nesnesinden tam <svg> grafiği üretir.
export function buildChartSvg(obj) {
  const points = normalizeChartData(obj?.chartData);
  const type = obj?.chartType || 'bar';
  let inner = '';
  if (!points.length) {
    inner = `<text x="${VIEW_W / 2}" y="${VIEW_H / 2}" font-size="11" fill="#94a3b8" text-anchor="middle">Veri yok</text>`;
  } else if (type === 'pie') {
    inner = renderPie(points);
  } else if (type === 'line') {
    inner = renderLine(points);
  } else {
    inner = renderBar(points);
  }
  return `<svg viewBox="0 0 ${VIEW_W} ${VIEW_H}" preserveAspectRatio="xMidYMid meet" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
}
