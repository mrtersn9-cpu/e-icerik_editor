import {
  BUTTON_PACKAGES,
  DEFAULT_THEME_PACKAGE_ITEMS,
  DEFAULT_DRAG_DROP_SETTINGS,
  DEFAULT_SELECTION_UI,
  DRAGGABLE_STRONG_STYLE,
  DROPZONE_STRONG_STYLE,
  OBJ_PRESETS,
  RIBBON_SHAPE_PRESETS,
  BUTTON_STYLE_PRESETS,
  DEFAULT_ACTIVITY_SETTINGS,
  ACCESSIBILITY_DEFAULTS,
} from '../constants';
import { createDefaultChartData } from '../utils/chartSvg';
import { uid, clamp } from '../utils/editorHelpers'; // eslint-disable-line
import { createDefaultTableData } from '../utils/tableHtml';

const AUTO_LAYER_NAME_PRESETS = ['menu', 'explanation', 'normal', 'Correct', 'Incorrect', 'cevap'];

function createDefaultThemePackageItems() {
  return DEFAULT_THEME_PACKAGE_ITEMS.map((item) => ({ ...item }));
}

function resolveThemePackageItems(screen = {}) {
  const source = Array.isArray(screen?.items) ? screen.items : [];
  return DEFAULT_THEME_PACKAGE_ITEMS.map((item) => {
    const override = source.find((entry) => entry?.id === item.id) || {};
    return {
      ...item,
      ...override,
      icon: String(override.icon ?? item.icon),
      label: String(override.label ?? item.label),
      desc: String(override.desc ?? item.desc),
    };
  });
}
function normalizeLayerNameKey(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function getBaseLayerAutoName(activity = {}) {
  const candidates = [activity.sceneName, activity.name, 'Base Layer'];
  for (const candidate of candidates) {
    const resolved = String(candidate || '').trim();
    if (resolved) return resolved;
  }
  return 'Base Layer';
}
function normalizeStyleToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

function upgradeDragDropStyle(type, style = {}) {
  const base = type === 'draggable' ? DRAGGABLE_STRONG_STYLE : DROPZONE_STRONG_STYLE;
  const next = { ...style };
  const background = normalizeStyleToken(style.background);
  const borderColor = normalizeStyleToken(style.borderColor);
  const color = normalizeStyleToken(style.color);
  const borderStyle = normalizeStyleToken(style.borderStyle);
  // Not: '#ffffff' kasıtlı olarak listede yok — kullanıcı bir öğeyi açıkça beyaz
  // yaptığında bu "legacy/boş" sayılıp güçlü varsayılana (turuncu/mavi) dönmesin.
  const legacyBackgrounds =
    type === 'draggable'
      ? new Set([
          '',
          'transparent',
          '#dbeafe',
          'rgba(255,255,255,.14)',
          'rgba(255,255,255,.92)',
        ])
      : new Set(['', 'transparent', '#fed7aa', 'rgba(255,255,255,.92)']);
  const legacyBorderColors =
    type === 'draggable'
      ? new Set(['', '#2563eb', '#ec4899'])
      : new Set(['', '#f97316', '#f59e0b']);
  const legacyTextColors =
    type === 'draggable'
      ? new Set(['', '#1e40af', '#ec4899'])
      : new Set(['', '#9a3412', '#f59e0b']);
  const legacyBorderStyles = new Set(['', 'dashed']);

  if (legacyBackgrounds.has(background)) next.background = base.background;
  if (legacyBorderColors.has(borderColor)) next.borderColor = base.borderColor;
  if (legacyTextColors.has(color)) next.color = base.color;
  if (legacyBorderStyles.has(borderStyle) || !style.borderStyle)
    next.borderStyle = base.borderStyle;
  if (!style.borderRadius || style.borderRadius < base.borderRadius)
    next.borderRadius = base.borderRadius;
  if (!style.fontSize) next.fontSize = base.fontSize;

  return { ...base, ...next };
}

function createDragDropDefaults() {
  return {
    draggable: {
      width: OBJ_PRESETS.draggable.w,
      height: OBJ_PRESETS.draggable.h,
      style: { ...upgradeDragDropStyle('draggable', OBJ_PRESETS.draggable.style) },
    },
    dropzone: {
      width: OBJ_PRESETS.dropzone.w,
      height: OBJ_PRESETS.dropzone.h,
      style: { ...upgradeDragDropStyle('dropzone', OBJ_PRESETS.dropzone.style) },
    },
  };
}
function getNextAutomaticOverlayLayerName(usedNames = new Set()) {
  for (const presetName of AUTO_LAYER_NAME_PRESETS) {
    if (!usedNames.has(normalizeLayerNameKey(presetName))) {
      return presetName;
    }
  }

  let layerNumber = 1;
  while (usedNames.has(normalizeLayerNameKey(`Layer ${layerNumber}`))) {
    layerNumber += 1;
  }
  return `Layer ${layerNumber}`;
}

function isDefaultOverlayLayerName(value = '') {
  return AUTO_LAYER_NAME_PRESETS.some(
    (presetName) => normalizeLayerNameKey(presetName) === normalizeLayerNameKey(value)
  );
}

function buildResolvedLayerNameMap(layers = [], activity = {}) {
  const resolvedNames = {};
  const usedNames = new Set();

  layers.forEach((layer, index) => {
    const layerId = layer?.id || (index === 0 ? 'base' : `layer-${index + 1}`);
    const isBase =
      (layer?.kind || (index === 0 ? 'base' : 'overlay')) === 'base' || layerId === 'base';
    if (isBase) {
      const baseName = getBaseLayerAutoName(activity);
      resolvedNames[layerId] = baseName;
      usedNames.add(normalizeLayerNameKey(baseName));
      return;
    }

    const rawName = String(layer?.name || '').trim();
    const shouldAutoName = layer?.autoName === true || (!rawName && layer?.autoName !== false);
    const resolvedName = shouldAutoName ? getNextAutomaticOverlayLayerName(usedNames) : rawName;
    resolvedNames[layerId] = resolvedName || getNextAutomaticOverlayLayerName(usedNames);
    usedNames.add(normalizeLayerNameKey(resolvedNames[layerId]));
  });

  return resolvedNames;
}

function createLayer(name = 'Katman', index = 0, options = {}) {
  const isBase = options.kind ? options.kind === 'base' : index === 0;
  const resolvedName = String(name || '').trim();
  return {
    id: isBase ? 'base' : options.id || uid(),
    name: isBase ? '' : resolvedName,
    kind: isBase ? 'base' : 'overlay',
    autoName: isBase
      ? true
      : typeof options.autoName === 'boolean'
        ? options.autoName
        : !resolvedName,
    visible: options.visible !== false,
  };
}

function createDefaultSlideLayers() {
  return [
    createLayer('', 0),
    ...AUTO_LAYER_NAME_PRESETS.map((layerName, index) =>
      createLayer(layerName, index + 1, { autoName: false })
    ),
  ];
}

function ensureSlideDefaultLayers(layers = [], activity = {}) {
  const normalizedLayers =
    Array.isArray(layers) && layers.length ? layers : createDefaultSlideLayers();
  if (activity?.autoLayers === false) {
    return normalizedLayers.map((layer, index) => ({
      ...layer,
      id: index === 0 || layer?.kind === 'base' ? 'base' : layer.id || uid(),
      kind: index === 0 || layer?.kind === 'base' ? 'base' : layer.kind || 'overlay',
      autoName: index === 0 || layer?.kind === 'base' ? true : !!layer.autoName,
      visible: layer.visible !== false,
    }));
  }
  const resolvedNames = buildResolvedLayerNameMap(normalizedLayers, activity);
  const baseLayer =
    normalizedLayers.find((layer) => layer?.kind === 'base' || layer?.id === 'base') ||
    createLayer('', 0); // prettier-ignore
  const overlayLayers = normalizedLayers.filter(
    (layer) => layer?.id !== baseLayer.id && layer?.kind !== 'base'
  );
  const claimedIds = new Set();
  const orderedDefaultLayers = AUTO_LAYER_NAME_PRESETS.map((presetName) => {
    const existing = overlayLayers.find((layer) => {
      if (!layer || claimedIds.has(layer.id)) return false;
      const effectiveName = resolvedNames[layer.id] || layer.name || '';
      return normalizeLayerNameKey(effectiveName) === normalizeLayerNameKey(presetName);
    });
    if (existing) {
      claimedIds.add(existing.id);
      return { ...existing, name: presetName, autoName: false };
    }
    return createLayer(presetName, claimedIds.size + 1, { autoName: false });
  });
  const extraLayers = overlayLayers.filter((layer) => !claimedIds.has(layer.id));
  return [
    { ...baseLayer, id: 'base', kind: 'base', autoName: true },
    ...orderedDefaultLayers,
    ...extraLayers,
  ];
}

function createObject(type = 'text') {
  const preset = OBJ_PRESETS[type] || OBJ_PRESETS.text;
  return {
    id: uid(),
    type,
    x: 80 + Math.random() * 120,
    y: 80 + Math.random() * 100,
    width: preset.w,
    height: preset.h,
    rotation: 0,
    label: preset.label,
    locked: false,
    visible: true,
    zIndex: 1,
    imageData: null,
    mediaUrl: '',
    mediaName: '',
    group: '',
    scope: '',
    allowMultipleTargets: false,
    capacity: type === 'dropzone' ? 1 : 0,
    layerId: 'base',
    showPlayerControls: type === 'video',
    embedUrl: type === 'embed' ? '' : undefined,
    sliderMin: type === 'slider' ? 0 : undefined,
    sliderMax: type === 'slider' ? 100 : undefined,
    sliderValue: type === 'slider' ? 50 : undefined,
    sliderStep: type === 'slider' ? 1 : undefined,
    sliderVariable: type === 'slider' ? '' : undefined,
    autoPlay: type === 'audio',
    muted: type === 'video',
    loop: false,
    tableData: type === 'table' ? createDefaultTableData() : undefined,
    chartType: type === 'chart' ? 'bar' : undefined,
    chartData: type === 'chart' ? createDefaultChartData() : undefined,
    style: { ...preset.style },
    stateStyles: {},
    // Accessibility
    accessibility: { ...ACCESSIBILITY_DEFAULTS },
  };
}

function createShapeObject(kind = 'roundedRect') {
  const preset =
    RIBBON_SHAPE_PRESETS.find((item) => item.kind === kind) ||
    RIBBON_SHAPE_PRESETS.find((item) => item.kind === 'roundedRect');
  const object = createObject('shape');
  const defaultVectorPoints = [
    { x: 10, y: 86 },
    { x: 24, y: 24 },
    { x: 50, y: 10 },
    { x: 76, y: 24 },
    { x: 90, y: 86 },
  ];

  if (kind === 'customPath') {
    return {
      ...object,
      shapeKind: 'customPath',
      showShapeLabel: false,
      label: 'Custom Path',
      width: 220,
      height: 140,
      vectorPoints: defaultVectorPoints,
      vectorPath: buildVectorPathFromPoints(defaultVectorPoints, true),
      style: {
        ...object.style,
        background: 'transparent',
        borderColor: '#0284c7',
        borderWidth: 4,
        color: 'transparent',
      },
    };
  }

  return {
    ...object,
    shapeKind: preset.kind,
    showShapeLabel: false,
    label: preset.label,
    width: preset.w,
    height: preset.h,
    style: {
      ...object.style,
      ...preset.style,
      color: 'transparent',
    },
  };
}

function createButtonPresetObject(presetId = 'btn-blue') {
  const preset =
    BUTTON_STYLE_PRESETS.find((item) => item.id === presetId) || BUTTON_STYLE_PRESETS[0];
  const object = createObject('button');
  return {
    ...object,
    label: 'Button',
    width: preset?.w || object.width,
    height: preset?.h || object.height,
    style: {
      ...object.style,
      ...(preset?.style || {}),
    },
    stateStyles: {
      hover: {
        filter: 'brightness(1.06)',
        boxShadow:
          preset?.style?.boxShadow && preset.style.boxShadow !== 'none'
            ? preset.style.boxShadow
            : '0 8px 16px rgba(15,23,42,.16)',
      },
      down: {
        transform: 'translateY(1px)',
        filter: 'brightness(.94)',
      },
      disabled: {
        opacity: 0.52,
      },
    },
  };
}

function normalizeVectorPoint(point = {}, fallback = { x: 50, y: 50 }) {
  const normalizeControl = (control, controlFallback) => {
    if (!control) return null;
    const cx = Number(control?.x);
    const cy = Number(control?.y);
    return {
      x: clamp(Number.isFinite(cx) ? cx : controlFallback.x, 0, 100),
      y: clamp(Number.isFinite(cy) ? cy : controlFallback.y, 0, 100),
    };
  };
  const x = Number(point?.x);
  const y = Number(point?.y);
  const mode = point?.mode === 'curve' ? 'curve' : 'line';
  const anchor = {
    x: clamp(Number.isFinite(x) ? x : fallback.x, 0, 100),
    y: clamp(Number.isFinite(y) ? y : fallback.y, 0, 100),
  };
  return {
    x: anchor.x,
    y: anchor.y,
    mode,
    cpIn: normalizeControl(point?.cpIn, anchor),
    cpOut: normalizeControl(point?.cpOut, anchor),
  };
}

function parseVectorPathToPoints(path = '') {
  const numbers = String(path || '').match(/-?\d*\.?\d+/g);
  if (!numbers || numbers.length < 4) {
    return [
      { x: 10, y: 86 },
      { x: 24, y: 24 },
      { x: 50, y: 10 },
      { x: 76, y: 24 },
      { x: 90, y: 86 },
    ];
  }
  const rawPoints = [];
  for (let i = 0; i < numbers.length - 1; i += 2) {
    const x = Number(numbers[i]);
    const y = Number(numbers[i + 1]);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      rawPoints.push({ x, y });
    }
  }
  if (rawPoints.length < 2) {
    return [
      { x: 10, y: 86 },
      { x: 24, y: 24 },
      { x: 50, y: 10 },
      { x: 76, y: 24 },
      { x: 90, y: 86 },
    ];
  }

  const hasOutOfRange = rawPoints.some(
    (point) => point.x < 0 || point.x > 100 || point.y < 0 || point.y > 100
  );
  if (!hasOutOfRange) {
    return rawPoints.map((point) => normalizeVectorPoint(point));
  }

  const minX = Math.min(...rawPoints.map((point) => point.x));
  const maxX = Math.max(...rawPoints.map((point) => point.x));
  const minY = Math.min(...rawPoints.map((point) => point.y));
  const maxY = Math.max(...rawPoints.map((point) => point.y));
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);

  return rawPoints.map((point) =>
    normalizeVectorPoint({
      x: 5 + ((point.x - minX) / spanX) * 90,
      y: 5 + ((point.y - minY) / spanY) * 90,
    })
  );
}

function getObjectVectorPoints(object = null) {
  if (Array.isArray(object?.vectorPoints) && object.vectorPoints.length >= 2) {
    return object.vectorPoints.map((point) => normalizeVectorPoint(point));
  }
  return parseVectorPathToPoints(object?.vectorPath || '');
}

function buildVectorPathFromPoints(points = [], closePath = true) {
  const normalizedPoints = (Array.isArray(points) ? points : [])
    .map((point, index) => normalizeVectorPoint(point, { x: 10 + index * 12, y: 50 }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));

  if (normalizedPoints.length < 2) {
    return 'M 10 86 L 24 24 L 50 10 L 76 24 L 90 86 Z';
  }

  const path = [`M ${normalizedPoints[0].x.toFixed(2)} ${normalizedPoints[0].y.toFixed(2)}`];
  const appendSegment = (fromPoint, toPoint) => {
    const isCurve = fromPoint?.mode === 'curve' || toPoint?.mode === 'curve';
    if (isCurve) {
      const cp1 = fromPoint?.cpOut || { x: fromPoint.x, y: fromPoint.y };
      const cp2 = toPoint?.cpIn || { x: toPoint.x, y: toPoint.y };
      path.push(
        `C ${cp1.x.toFixed(2)} ${cp1.y.toFixed(2)} ${cp2.x.toFixed(2)} ${cp2.y.toFixed(2)} ${toPoint.x.toFixed(2)} ${toPoint.y.toFixed(2)}`
      );
      return;
    }
    path.push(`L ${toPoint.x.toFixed(2)} ${toPoint.y.toFixed(2)}`);
  };

  for (let i = 1; i < normalizedPoints.length; i += 1) {
    appendSegment(normalizedPoints[i - 1], normalizedPoints[i]);
  }
  if (closePath) {
    appendSegment(normalizedPoints[normalizedPoints.length - 1], normalizedPoints[0]);
    path.push('Z');
  }
  return path.join(' ');
}

function getBezierPointAt(fromPoint, toPoint, t = 0.5) {
  const start = { x: fromPoint.x, y: fromPoint.y };
  const cpOut = fromPoint.cpOut || start;
  const cpIn = toPoint.cpIn || { x: toPoint.x, y: toPoint.y };
  const end = { x: toPoint.x, y: toPoint.y };
  const u = 1 - t;
  return {
    x: u ** 3 * start.x + 3 * u ** 2 * t * cpOut.x + 3 * u * t ** 2 * cpIn.x + t ** 3 * end.x,
    y: u ** 3 * start.y + 3 * u ** 2 * t * cpOut.y + 3 * u * t ** 2 * cpIn.y + t ** 3 * end.y,
  };
}

function getSegmentMidPoint(points = [], fromIndex = 0, closePath = true) {
  if (!Array.isArray(points) || points.length < 2) return null;
  const toIndex = fromIndex + 1 < points.length ? fromIndex + 1 : closePath ? 0 : -1;
  if (toIndex < 0) return null;
  const fromPoint = normalizeVectorPoint(points[fromIndex]);
  const toPoint = normalizeVectorPoint(points[toIndex]);
  if (fromPoint.mode === 'curve' || toPoint.mode === 'curve') {
    const mid = getBezierPointAt(fromPoint, toPoint, 0.5);
    return { x: Number(mid.x.toFixed(2)), y: Number(mid.y.toFixed(2)) };
  }
  return {
    x: Number(((fromPoint.x + toPoint.x) / 2).toFixed(2)),
    y: Number(((fromPoint.y + toPoint.y) / 2).toFixed(2)),
  };
}

function shiftVectorPointControls(point = {}, dx = 0, dy = 0) {
  const normalized = normalizeVectorPoint(point);
  const shiftControl = (control) => {
    if (!control) return null;
    return {
      x: clamp(Number((control.x + dx).toFixed(2)), 0, 100),
      y: clamp(Number((control.y + dy).toFixed(2)), 0, 100),
    };
  };
  return {
    ...normalized,
    cpIn: shiftControl(normalized.cpIn),
    cpOut: shiftControl(normalized.cpOut),
  };
}

function alignVectorAnchors(points = [], indices = [], mode = 'left') {
  if (!Array.isArray(points) || !points.length || !Array.isArray(indices) || !indices.length) {
    return points;
  }
  const uniqueIndices = [...new Set(indices)].filter(
    (index) => index >= 0 && index < points.length
  );
  if (!uniqueIndices.length) return points;
  const selected = uniqueIndices.map((index) => ({
    index,
    point: normalizeVectorPoint(points[index]),
  }));
  const xs = selected.map((item) => item.point.x);
  const ys = selected.map((item) => item.point.y);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const xMid = (xMin + xMax) / 2;
  const yMid = (yMin + yMax) / 2;

  return points.map((entry, index) => {
    const normalized = normalizeVectorPoint(entry);
    if (!uniqueIndices.includes(index)) return normalized;
    let nextX = normalized.x;
    let nextY = normalized.y;
    if (mode === 'left') nextX = xMin;
    if (mode === 'center') nextX = xMid;
    if (mode === 'right') nextX = xMax;
    if (mode === 'top') nextY = yMin;
    if (mode === 'middle') nextY = yMid;
    if (mode === 'bottom') nextY = yMax;
    const dx = nextX - normalized.x;
    const dy = nextY - normalized.y;
    const shifted = shiftVectorPointControls(normalized, dx, dy);
    return {
      ...shifted,
      x: Number(nextX.toFixed(2)),
      y: Number(nextY.toFixed(2)),
    };
  });
}

function createBaseOnlySlide(name = 'Sahne', index = 0) {
  return {
    ...createSlide(name, index),
    name,
    sceneName: name,
    autoLayers: false,
    layers: [createLayer('', 0, { kind: 'base' })],
    activeLayerId: 'base',
  };
}

function createDefaultActivitySlides() {
  const practiceSlideName = 'Etkinlik 1';
  return [
    createBaseOnlySlide('Etkinlik Girişi', 0),
    createBaseOnlySlide('Etkinlik Tanıtımı', 1),
    {
      ...createSlide(practiceSlideName, 2),
      name: practiceSlideName,
      sceneName: practiceSlideName,
      objects: [],
      triggers: [],
    },
  ];
}

function createActivity(name, type = 'selection') {
  const defaultSlides = createDefaultActivitySlides();
  const firstSlide = defaultSlides[0];
  const base = {
    id: uid(),
    name,
    type,
    notes: '',
    sceneName: firstSlide.sceneName,
    sceneTemplateId: firstSlide.sceneTemplateId,
    sceneTemplatePresetId: firstSlide.sceneTemplatePresetId,
    sceneTemplateVersion: firstSlide.sceneTemplateVersion,
    buttonPackageId: BUTTON_PACKAGES[0].id,
    buttonAnimationProfileId: BUTTON_PACKAGES[0]?.animationProfileId || 'calmLift',
    contentLanguage: 'tr',
    stageWidth: firstSlide.stageWidth,
    stageHeight: firstSlide.stageHeight,
    backgroundColor: firstSlide.backgroundColor,
    svgMarkup: firstSlide.svgMarkup,
    svgName: firstSlide.svgName,
    layers: firstSlide.layers,
    activeLayerId: firstSlide.activeLayerId,
    nextActivityId: firstSlide.nextActivityId,
    objects: firstSlide.objects,
    selectedObjectId: firstSlide.selectedObjectId,
    timeline: firstSlide.timeline,
    triggers: firstSlide.triggers,
    slides: defaultSlides,
    currentSlideId: firstSlide.id,
    startSlideId: firstSlide.id,
    settings: { ...DEFAULT_ACTIVITY_SETTINGS },
    dragDropDefaults: createDragDropDefaults(),
    dragDropMode: 'single',
    dragDropSettings: { ...DEFAULT_DRAG_DROP_SETTINGS },
    dragDropMatches: {},
    selectionUi: { ...DEFAULT_SELECTION_UI },
    introScreen: {
      enabled: true,
      title: `${name} Etkinliğine Hoş Geldin`,
      body: 'Hazır olduğunda başla ve soruyu tamamla.',
      buttonText: 'Başla',
    },
    buttonPackageScreen: {
      enabled: true,
      title: 'Tema Paketi Tanıtımı',
      body: 'Etkinlikte kullanacağın tema paketini ve buton davranışlarını önce incele.',
      buttonText: 'Menüye Geç',
      backButtonText: 'Geri Dön',
      items: createDefaultThemePackageItems(),
    },
    menuScreen: {
      enabled: true,
      title: `${name} Menüsü`,
      body: 'Kuralları gözden geçir ve etkinliği başlat.',
      buttonText: 'Etkinliğe Geç',
    },
    playScreen: { title: '', body: '' },
    resultScreens: {
      successTitle: 'Harika!',
      successBody: 'Doğru cevabı buldun.',
      failureTitle: 'Tekrar Deneyelim',
      failureBody: 'Doğru cevaba biraz daha yakınsın.',
      retryText: 'Tekrar Dene',
      continueText: 'Devam Et',
      showScore: true,
      showStats: true,
      showReviewButton: true,
    },
    answerScreen: {
      title: 'Doğru Cevap',
      body: 'Sistem doğru cevabı otomatik olarak hazırladı.',
      buttonText: 'Yeniden Başlat',
    },
    mcQuestion: '',
    mcMode: 'single',
    mcOptions: [
      { id: uid(), label: 'Seçenek 1', isCorrect: true },
      { id: uid(), label: 'Seçenek 2', isCorrect: false },
    ],
    // Slide properties
    slideAdvance: 'user',
    slideRevisit: 'resume',
    slideAutoAdvanceDelay: 5,
    // Accessibility
    accessibilityLevel: 'AA',
    speakerNotes: '',
  };

  // Type-specific data
  if (type === 'selection') {
    base.mcQuestion = "Türkiye'nin başkenti hangi şehirdir?";
    base.mcOptions = [
      { id: uid(), label: 'Ankara', isCorrect: true },
      { id: uid(), label: 'İstanbul', isCorrect: false },
      { id: uid(), label: 'İzmir', isCorrect: false },
      { id: uid(), label: 'Bursa', isCorrect: false },
    ];
  }

  if (type === 'sequence') {
    base.mcQuestion = 'Su döngüsü adımlarını doğru sırayla düzenleyin.';
    base.sequenceItems = [
      { id: uid(), label: 'Buharlaşma', order: 1 },
      { id: uid(), label: 'Yoğunlaşma', order: 2 },
      { id: uid(), label: 'Yağış', order: 3 },
      { id: uid(), label: 'Akış', order: 4 },
    ];
    base.sequenceShuffle = true;
    base.sequenceDirection = 'vertical';
  }

  if (type === 'matching') {
    base.mcQuestion = 'Ülkeleri başkentleriyle eşleştirin.';
    base.matchingPairs = [
      { id: uid(), left: 'Türkiye', right: 'Ankara' },
      { id: uid(), left: 'Fransa', right: 'Paris' },
      { id: uid(), left: 'Almanya', right: 'Berlin' },
      { id: uid(), left: 'İtalya', right: 'Roma' },
    ];
    base.matchingShuffle = true;
  }

  if (type === 'text-entry') {
    base.textEntryPrompt = 'Türkiye\'nin en büyük gölü hangisidir?';
    base.textEntryAcceptedAnswers = ['Van Gölü', 'Van', 'Van Golu'];
    base.textEntryCaseSensitive = false;
    base.textEntryMaxLength = 500;
  }

  if (type === 'numeric') {
    base.numericPrompt = 'Bir dik üçgende dik açı kaç derecedir?';
    base.numericCorrectValue = 90;
    base.numericTolerance = 0;
    base.numericMin = null;
    base.numericMax = null;
  }

  if (type === 'fill-blank') {
    base.fillBlankSentence = "Türkiye'nin başkenti ___ şehridir.";
    base.fillBlankAnswers = [
      { id: uid(), blankIndex: 0, acceptedValues: ['Ankara'], caseSensitive: false },
    ];
  }

  if (type === 'puzzle') {
    base.puzzleType = 'crossword';
    base.puzzleQuestions = [
      { id: uid(), clue: 'Türkiye\'nin başkenti', answer: 'ANKARA', direction: 'across', row: 0, col: 0 },
      { id: uid(), clue: 'Dünyanın en büyük okyanusu', answer: 'PASIFIK', direction: 'down', row: 0, col: 2 },
    ];
    base.puzzleGrid = { rows: 10, cols: 10, cells: [] };
    base.puzzleSettings = {
      showClues: true,
      showNumbers: true,
      allowHints: true,
      timeLimitEnabled: false,
      timeLimitMinutes: 5,
      maxAttempts: 0,
      shuffleQuestions: false,
    };
    base.settings.showFeedback = true;
    base.settings.allowRetry = true;
  }

  if (type === 'mixed') {
    base.mixedItems = [];
    base.mixedMode = 'auto';
  }

  if (type === 'hotspot') {
    base.hotspotQuestion = 'Görseldeki doğru alanları işaretleyin.';
    base.hotspotImage = null;
    const hotspotObj = createObject('hotspot');
    hotspotObj.x = 200;
    hotspotObj.y = 150;
    hotspotObj.width = 120;
    hotspotObj.height = 80;
    hotspotObj.label = 'Doğru Alan';
    hotspotObj.hotspotCorrect = true;
    base.objects = [...(base.objects || []), hotspotObj];
  }

  if (type === 'survey') {
    base.surveyQuestions = [
      {
        id: uid(),
        prompt: 'Bu etkinliği nasıl buldunuz?',
        type: 'likert',
        options: ['Çok kötü', 'Kötü', 'Orta', 'İyi', 'Çok iyi'],
      },
      { id: uid(), prompt: 'Ek görüşleriniz:', type: 'open-text', options: [] },
    ];
    base.surveyAnonymous = true;
    base.settings.showFeedback = false;
  }

  if (type === 'custom-interaction') {
    base.customInteraction = {
      templateId: 'blank',
      templateName: 'Boş Özel Etkileşim',
      widgets: [],
      settings: {
        zipImportReady: false,
        runtimeReady: false,
      },
      events: [],
      commands: [],
      variables: [],
      triggers: [],
      test: {
        status: 'not-run',
      },
    };
  }

  return base;
}

function createCanvasTextObject(label, x, y, width, height, style = {}) {
  const object = createObject('text');
  return {
    ...object,
    label,
    x,
    y,
    width,
    height,
    style: { ...object.style, ...style },
  };
}

function createCanvasButtonObject(label, x, y, width, height, style = {}) {
  const object = createObject('button');
  return {
    ...object,
    label,
    x,
    y,
    width,
    height,
    style: { ...object.style, ...style },
  };
}

function createCanvasShapeObject(label, x, y, width, height, style = {}) {
  const object = createObject('shape');
  return {
    ...object,
    label,
    x,
    y,
    width,
    height,
    style: { ...object.style, ...style },
  };
}

function createSlide(name = 'Slider 1', index = 0) {
  return {
    id: uid(),
    name: name || `Slider ${index + 1}`,
    sceneName: `Sahne ${index + 1}`,
    sceneTemplateId: '',
    sceneTemplatePresetId: '',
    sceneTemplateVersion: 0,
    stageWidth: 1920,
    stageHeight: 1080,
    backgroundColor: '#ffffff',
    svgMarkup: '',
    svgName: '',
    layers: createDefaultSlideLayers(),
    activeLayerId: 'base',
    nextActivityId: '',
    objects: [],
    selectedObjectId: null,
    timeline: [],
    triggers: [],
    audioUrl: '',
    audioName: '',
    audioAutoPlay: true,
    audioLoop: false,
    slideTransitionEffect: 'fade',
    slideTransitionDirection: 'left',
    slideTransitionDuration: 0.45,
  };
}

function createCanvasPuzzleCellObject(label, x, y, width, height, style = {}) {
  const object = createObject('puzzle-cell');
  return {
    ...object,
    label,
    x,
    y,
    width: width || 36,
    height: height || 36,
    style: { ...object.style, ...style },
  };
}

function createCanvasPuzzleInputObject(label, x, y, width, height, style = {}) {
  const object = createObject('puzzle-input');
  return {
    ...object,
    label,
    x,
    y,
    width: width || 36,
    height: height || 36,
    style: { ...object.style, ...style },
  };
}

function createCanvasPuzzleClueObject(label, x, y, width, height, style = {}) {
  const object = createObject('puzzle-clue');
  return {
    ...object,
    label,
    x,
    y,
    width: width || 200,
    height: height || 28,
    style: { ...object.style, ...style },
  };
}

export {
  createDefaultThemePackageItems,
  resolveThemePackageItems,
  normalizeLayerNameKey,
  getBaseLayerAutoName,
  normalizeStyleToken,
  upgradeDragDropStyle,
  createDragDropDefaults,
  getNextAutomaticOverlayLayerName,
  isDefaultOverlayLayerName,
  buildResolvedLayerNameMap,
  createLayer,
  createDefaultSlideLayers,
  ensureSlideDefaultLayers,
  createObject,
  createShapeObject,
  createButtonPresetObject,
  normalizeVectorPoint,
  parseVectorPathToPoints,
  getObjectVectorPoints,
  buildVectorPathFromPoints,
  getBezierPointAt,
  getSegmentMidPoint,
  shiftVectorPointControls,
  alignVectorAnchors,
  createActivity,
  createCanvasTextObject,
  createCanvasButtonObject,
  createCanvasShapeObject,
  createCanvasPuzzleCellObject,
  createCanvasPuzzleInputObject,
  createCanvasPuzzleClueObject,
  createSlide,
};
