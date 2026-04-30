export function parseCssColorSamples(value = '') {
  const raw = String(value || '');
  const samples = [];
  raw.replace(/#([0-9a-f]{3}|[0-9a-f]{6})\b/gi, (_, hexValue) => {
    const full =
      hexValue.length === 3
        ? hexValue
            .split('')
            .map((char) => char + char)
            .join('')
        : hexValue;
    const intValue = parseInt(full, 16);
    samples.push([(intValue >> 16) & 255, (intValue >> 8) & 255, intValue & 255]);
    return _;
  });
  raw.replace(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/gi, (_, r, g, b) => {
    samples.push([Number(r), Number(g), Number(b)]);
    return _;
  });
  return samples.filter(([r, g, b]) => [r, g, b].every((channel) => Number.isFinite(channel)));
}

export function relativeLuminance([r, g, b] = [255, 255, 255]) {
  const channel = (value) => {
    const normalized = Math.max(0, Math.min(255, value)) / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatioForColors(first = [255, 255, 255], second = [0, 0, 0]) {
  const a = relativeLuminance(first);
  const b = relativeLuminance(second);
  const light = Math.max(a, b);
  const dark = Math.min(a, b);
  return (light + 0.05) / (dark + 0.05);
}

export function readableTextColorForBackground(background = '', preferred = '') {
  const samples = parseCssColorSamples(background);
  if (!samples.length) return preferred || '#ffffff';
  const darkest = samples.reduce(
    (selected, item) => (relativeLuminance(item) < relativeLuminance(selected) ? item : selected),
    samples[0]
  );
  const lightest = samples.reduce(
    (selected, item) => (relativeLuminance(item) > relativeLuminance(selected) ? item : selected),
    samples[0]
  );
  const averageLum =
    samples.reduce((sum, item) => sum + relativeLuminance(item), 0) / samples.length;
  const backgroundSample = averageLum < 0.35 ? darkest : lightest;
  const preferredSamples = parseCssColorSamples(preferred);
  const preferredIsNeutral =
    preferredSamples.length &&
    (() => {
      const [r, g, b] = preferredSamples[0];
      return Math.max(r, g, b) - Math.min(r, g, b) <= 18;
    })();
  if (preferredIsNeutral && contrastRatioForColors(backgroundSample, preferredSamples[0]) >= 4.5)
    return preferred;
  return contrastRatioForColors(backgroundSample, [255, 255, 255]) >=
    contrastRatioForColors(backgroundSample, [15, 23, 42])
    ? '#ffffff'
    : '#0f172a';
}

export function contrastSafeButtonStyle(style = {}) {
  const color = readableTextColorForBackground(style.background, style.color);
  return {
    ...style,
    color,
    textShadow: color === '#ffffff' ? '0 1px 0 rgba(0,0,0,.34)' : '0 1px 0 rgba(255,255,255,.72)',
    boxShadow:
      'inset 0 2px 0 rgba(255,255,255,.48), inset 0 -4px 0 rgba(15,23,42,.16), 0 8px 16px rgba(15,23,42,.14)',
  };
}

export function ensureTtkbButtonTextContrast(style = {}) {
  const color = readableTextColorForBackground(style.background, style.color);
  const textShadow =
    color === '#ffffff' ? '0 1px 0 rgba(0,0,0,.34)' : '0 1px 0 rgba(255,255,255,.72)';
  return {
    ...style,
    color,
    textShadow: style.textShadow || textShadow,
  };
}

export function cssColorWithAlpha(value = '', alpha = 0.98, fallback = 'rgba(255,255,255,.98)') {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  const hex = raw.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const full =
      hex[1].length === 3
        ? hex[1]
            .split('')
            .map((char) => char + char)
            .join('')
        : hex[1];
    const intValue = parseInt(full, 16);
    return `rgba(${(intValue >> 16) & 255},${(intValue >> 8) & 255},${intValue & 255},${alpha})`;
  }
  const rgb = raw.match(/^rgba?\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,)]+)/i);
  if (rgb) return `rgba(${rgb[1]},${rgb[2]},${rgb[3]},${alpha})`;
  return fallback;
}
