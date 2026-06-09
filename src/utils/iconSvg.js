// lucide ikon "node" verisinden (React'siz) standalone SVG markup üretir.
// Üretilen SVG: stroke="currentColor" → mevcut "Metin rengi" kontrolüyle renklenir,
// width/height="100%" → nesne boyutuyla ölçeklenir. Hem editör hem SCORM export için güvenli.

const LUCIDE_ROOT_ATTRS = {
  xmlns: 'http://www.w3.org/2000/svg',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
};

function toKebabAttr(key) {
  return String(key).replace(/[A-Z]/g, (match) => '-' + match.toLowerCase());
}

function escapeAttr(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function nodeChildToMarkup(child) {
  if (!Array.isArray(child)) return '';
  const [tag, attrs] = child;
  if (!tag || typeof tag !== 'string') return '';
  const safeTag = tag.replace(/[^a-zA-Z0-9]/g, '');
  if (!safeTag) return '';
  const attrString = Object.entries(attrs || {})
    .filter(([attrKey]) => attrKey !== 'key')
    .map(([attrKey, attrValue]) => `${toKebabAttr(attrKey)}="${escapeAttr(attrValue)}"`)
    .join(' ');
  return `<${safeTag}${attrString ? ' ' + attrString : ''} />`;
}

// Semantik buton eylemleri → lucide iconNode verisi (ağır React import'u olmadan kullanılır).
const SEMANTIC_ICON_NODES = {
  restart:   [["path",{"d":"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"}],["path",{"d":"M3 3v5h5"}]],
  home:      [["path",{"d":"M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"}],["path",{"d":"M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"}]],
  menu:      [["line",{"x1":"4","x2":"20","y1":"12","y2":"12"}],["line",{"x1":"4","x2":"20","y1":"6","y2":"6"}],["line",{"x1":"4","x2":"20","y1":"18","y2":"18"}]],
  check:     [["path",{"d":"M20 6 9 17l-5-5"}]],
  complete:  [["path",{"d":"M21.801 10A10 10 0 1 1 17 3.335"}],["path",{"d":"m9 11 3 3L22 4"}]],
  next:      [["path",{"d":"m9 18 6-6-6-6"}]],
  prev:      [["path",{"d":"m15 18-6-6 6-6"}]],
  sound:     [["path",{"d":"M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"}],["path",{"d":"M16 9a5 5 0 0 1 0 6"}],["path",{"d":"M19.364 18.364a9 9 0 0 0 0-12.728"}]],
  mute:      [["path",{"d":"M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"}],["line",{"x1":"22","x2":"16","y1":"9","y2":"15"}],["line",{"x1":"16","x2":"22","y1":"9","y2":"15"}]],
  answer:    [["path",{"d":"M12 20h9"}],["path",{"d":"M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"}]],
  help:      [["circle",{"cx":"12","cy":"12","r":"10"}],["path",{"d":"M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"}],["path",{"d":"M12 17h.01"}]],
  play:      [["polygon",{"points":"6 3 20 12 6 21 6 3"}]],
  pause:     [["rect",{"x":"14","y":"4","width":"4","height":"16","rx":"1"}],["rect",{"x":"6","y":"4","width":"4","height":"16","rx":"1"}]],
  close:     [["path",{"d":"M18 6 6 18"}],["path",{"d":"m6 6 12 12"}]],
  start:     [["circle",{"cx":"12","cy":"12","r":"10"}],["polygon",{"points":"10 8 16 12 10 16 10 8"}]],
  info:      [["circle",{"cx":"12","cy":"12","r":"10"}],["path",{"d":"M12 16v-4"}],["path",{"d":"M12 8h.01"}]],
};

// Eylem/etiket anahtarından semantik SVG markup döndürür (yoksa '').
export function getSemanticSvgIcon(actionKey = '', labelKey = '', opts = {}) {
  const action = String(actionKey || '').toLowerCase().replace(/[^a-z]/g, '');
  const label = String(labelKey || '').toLowerCase().replace(/[^a-z]/g, '');
  let nodeKey = null;
  if (label.includes('anasayfa') || label.includes('home') || action === 'home') nodeKey = 'home';
  else if (label.includes('menu') || action.includes('menu')) nodeKey = 'menu';
  else if (label.includes('yenidenbaslat') || label.includes('tekrarla') || label.includes('retry') || action.includes('restart')) nodeKey = 'restart';
  // "Etkinliği Başlat" — restart'tan SONRA gelmeli ('yenidenbaslat' içindeki 'baslat' çakışmasın).
  else if (label.includes('etkinligibaslat') || label.includes('baslat') || action === 'start') nodeKey = 'start';
  else if (label.includes('cozum') || label.includes('cevap') || action.includes('answer') || action.includes('showanswer')) nodeKey = 'answer';
  else if (label.includes('tamamla') || label.includes('kontrol') || action.includes('complete')) nodeKey = 'complete';
  else if (label.includes('ileri') || label.includes('next') || action.includes('next')) nodeKey = 'next';
  else if (label.includes('geri') || label.includes('prev') || action.includes('prev')) nodeKey = 'prev';
  else if (action.includes('mute') || label.includes('seskapat')) nodeKey = 'mute';
  else if (label.includes('ses') || action.includes('sound')) nodeKey = 'sound';
  else if (label.includes('etkinliktanitimi') || label.includes('tanitim') || label.includes('intro') || action.includes('intro')) nodeKey = 'info';
  else if (label.includes('play') || label.includes('oynat') || action.includes('play')) nodeKey = 'play';
  else if (label.includes('pause') || label.includes('duraklat') || action.includes('pause')) nodeKey = 'pause';
  else if (label.includes('kapat') || label.includes('close') || action.includes('close')) nodeKey = 'close';
  else if (label.includes('check') || label.includes('kontrol') || action.includes('check')) nodeKey = 'check';
  const node = nodeKey ? SEMANTIC_ICON_NODES[nodeKey] : null;
  return node ? iconNodeToSvgMarkup(node, opts) : '';
}

// node: lucide iconNode dizisi ([["path",{d:"..."}], ...]).
// opts: { strokeWidth?:number, size?:string }. Dönüş: standalone <svg> markup (string).
export function iconNodeToSvgMarkup(node, opts = {}) {
  if (!Array.isArray(node) || node.length === 0) return '';
  const strokeWidth = opts.strokeWidth != null ? opts.strokeWidth : 2;
  const size = opts.size || '100%';
  const rootAttrs = {
    ...LUCIDE_ROOT_ATTRS,
    'stroke-width': strokeWidth,
    width: size,
    height: size,
  };
  const rootAttrString = Object.entries(rootAttrs)
    .map(([key, value]) => `${key}="${escapeAttr(value)}"`)
    .join(' ');
  const children = node.map(nodeChildToMarkup).join('');
  return `<svg ${rootAttrString}>${children}</svg>`;
}
