const BUILTIN_WIDGETS = [
  {
    id: 'dice-v1',
    name: 'Zar Atma',
    version: '1.0.0',
    basePath: '/widgets/builtins/dice-v1',
    entry: 'index.html',
    defaultWidth: 300,
    defaultHeight: 260,
    props: [
      { name: 'min', type: 'number', label: 'Minimum', default: 1 },
      { name: 'max', type: 'number', label: 'Maksimum', default: 10 },
      { name: 'animated', type: 'boolean', label: 'Animasyonlu', default: true },
    ],
    commands: [
      { name: 'roll', label: 'Zarı At' },
      { name: 'reset', label: 'Sıfırla' },
    ],
    events: [
      { name: 'diceRolled', label: 'Zar Atıldı' },
    ],
  },
  {
    id: 'bird-flight-v1',
    name: 'Kuş Uçuş Animasyonu',
    version: '1.0.0',
    basePath: '/widgets/builtins/bird-flight-v1',
    entry: 'index.html',
    defaultWidth: 500,
    defaultHeight: 320,
    props: [
      { name: 'speed', type: 'number', label: 'Hız', default: 1 },
    ],
    commands: [
      { name: 'flyWithFlaps', label: 'Kanat çırparak uç', params: { flapCount: 'number' } },
      { name: 'reset', label: 'Sıfırla' },
    ],
    events: [
      { name: 'flapComplete', label: 'Kanat Çırpma Tamamlandı' },
      { name: 'flightComplete', label: 'Uçuş Tamamlandı' },
    ],
  },
];

export function getBuiltinWidgetManifest(widgetId) {
  return BUILTIN_WIDGETS.find((w) => w.id === widgetId) || null;
}

export function getBuiltinWidgetEntryUrl(widgetId) {
  const manifest = getBuiltinWidgetManifest(widgetId);
  if (!manifest) return '';
  const base = manifest.basePath || `/widgets/builtins/${widgetId}`;
  const entry = manifest.entry || 'index.html';
  return `${base}/${entry}`;
}

export function getAllBuiltinWidgets() {
  return BUILTIN_WIDGETS.map((w) => ({ ...w }));
}

export function buildWidgetIframeSrc(widgetConfig = {}) {
  const widgetId = widgetConfig.widgetId || '';
  const basePath = widgetConfig.basePath || '';
  const entry = widgetConfig.entry || 'index.html';
  const entryUrl = String(widgetConfig.entryUrl || '').trim();
  const props = widgetConfig.props || {};

  let src = basePath ? `${basePath}/${entry}` : entryUrl || getBuiltinWidgetEntryUrl(widgetId);
  if (!src) return '';
  if (/^(blob:|data:)/i.test(src)) return src;

  const params = new URLSearchParams();
  params.set('instanceId', widgetConfig.instanceId || '');
  if (Object.keys(props).length) {
    params.set('props', encodeURIComponent(JSON.stringify(props)));
  }

  const separator = src.includes('?') ? '&' : '?';
  return `${src}${separator}${params.toString()}`;
}
