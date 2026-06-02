// Tablo eleman tipi için ortak yardımcılar.
// HTML üretimi editör (StageCanvas, dangerouslySetInnerHTML) tarafında kullanılır; SCORM runtime/önizleme
// aynı mantığı generated storylineRendererCore.js içindeki storylineRendererTableHtml ile birebir tekrarlar.

const HEADER_BG = '#f1f5f9';

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// tableData'yı güvenli/normalize bir şekle getirir: { headerRow, rows: string[][] }.
export function normalizeTableData(tableData) {
  const data = tableData && typeof tableData === 'object' ? tableData : {};
  const rows = Array.isArray(data.rows) ? data.rows.map((row) => (Array.isArray(row) ? row.map((c) => String(c ?? '')) : [])) : [];
  return { headerRow: data.headerRow !== false, rows };
}

export function createDefaultTableData() {
  return {
    headerRow: true,
    rows: [
      ['Başlık 1', 'Başlık 2', 'Başlık 3'],
      ['Hücre', 'Hücre', 'Hücre'],
      ['Hücre', 'Hücre', 'Hücre'],
    ],
  };
}

// Bir tablo nesnesinden tam <table> HTML'i üretir.
export function buildTableHtml(obj, options = {}) {
  const { headerRow, rows } = normalizeTableData(obj?.tableData);
  const style = obj?.style || {};
  const borderColor = style.borderColor || '#cbd5e1';
  const color = style.color || '#1f2937';
  const fontSize = options.fontSize || style.fontSize || 14;
  const body = rows
    .map((row, rowIndex) => {
      const isHeader = headerRow && rowIndex === 0;
      const tag = isHeader ? 'th' : 'td';
      const cellStyle = `border:1px solid ${borderColor};padding:6px 10px;text-align:left;vertical-align:top;${isHeader ? `background:${HEADER_BG};font-weight:800;` : ''}`;
      const cells = row.map((cell) => `<${tag} style="${cellStyle}">${escapeHtml(cell)}</${tag}>`).join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');
  return `<table style="border-collapse:collapse;width:100%;height:100%;font-size:${fontSize}px;color:${color};table-layout:fixed">${body}</table>`;
}

// ─── Tablo düzenleme işlemleri (ribbon + editör modalı tarafından paylaşılır) ──

function columnCount(rows) {
  return rows.reduce((max, row) => Math.max(max, row.length), 0);
}

export function tableAddRow(tableData) {
  const { headerRow, rows } = normalizeTableData(tableData);
  const cols = Math.max(1, columnCount(rows));
  return { headerRow, rows: [...rows, Array.from({ length: cols }, () => 'Hücre')] };
}

export function tableRemoveRow(tableData) {
  const { headerRow, rows } = normalizeTableData(tableData);
  if (rows.length <= 1) return { headerRow, rows };
  return { headerRow, rows: rows.slice(0, -1) };
}

export function tableAddColumn(tableData) {
  const { headerRow, rows } = normalizeTableData(tableData);
  return {
    headerRow,
    rows: rows.map((row, rowIndex) => [...row, headerRow && rowIndex === 0 ? 'Başlık' : 'Hücre']),
  };
}

export function tableRemoveColumn(tableData) {
  const { headerRow, rows } = normalizeTableData(tableData);
  if (columnCount(rows) <= 1) return { headerRow, rows };
  return { headerRow, rows: rows.map((row) => row.slice(0, -1)) };
}

export function tableSetCell(tableData, rowIndex, colIndex, value) {
  const { headerRow, rows } = normalizeTableData(tableData);
  const nextRows = rows.map((row, r) =>
    r === rowIndex ? row.map((cell, c) => (c === colIndex ? value : cell)) : row
  );
  return { headerRow, rows: nextRows };
}

export function tableToggleHeader(tableData) {
  const { headerRow, rows } = normalizeTableData(tableData);
  return { headerRow: !headerRow, rows };
}
