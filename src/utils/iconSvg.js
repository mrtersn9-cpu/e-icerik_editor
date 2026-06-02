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
