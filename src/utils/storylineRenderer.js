import {
  ACCESSIBILITY_DEFAULTS,
  DEFAULT_SELECTION_UI,
  DRAGGABLE_STRONG_STYLE,
  DROPZONE_STRONG_STYLE,
} from '../constants';
import { STORYLINE_RENDERER_CORE_SCRIPT } from '../generated/storylineRendererCore';
import { STORYLINE_RUNTIME_CORE_SCRIPT } from '../generated/storylineRuntimeCore';
import { STORYLINE_RUNTIME_ENGINE_SCRIPT } from '../generated/storylineRuntimeEngine';

import { getRuntimeButtonAction, normalizeRuntimeActionLabel } from './storylineRuntime';
import { isStorylineRuntimeDropTargetLikeObject } from './storylineRuntimeEngine';

export const STORYLINE_RENDER_STATE_ORDER = [
  'normal',
  'visited',
  'hover',
  'selected',
  'dragOver',
  'dropIncorrect',
  'dropCorrect',
  'disabled',
];
let sharedStorylineRendererRuntimeApi = null;

function clampValue(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function rendererKey(value = '') {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9_-]+/g, '_');
}

function layerKey(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function normalizeStyleToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

function getSelectionGlyph(mark = 'check') {
  if (mark === 'cross') return '×';
  if (mark === 'dot') return '●';
  return '✓';
}

export function upgradeStorylineDragDropStyle(type, style = {}) {
  const base = type === 'draggable' ? DRAGGABLE_STRONG_STYLE : DROPZONE_STRONG_STYLE;
  const next = { ...style };
  const background = normalizeStyleToken(style.background);
  const borderColor = normalizeStyleToken(style.borderColor);
  const color = normalizeStyleToken(style.color);
  const legacyBackgrounds =
    type === 'draggable'
      ? new Set([
          '',
          'transparent',
          '#dbeafe',
          '#ffffff',
          'rgba(255,255,255,.14)',
          'rgba(255,255,255,.92)',
        ])
      : new Set(['', 'transparent', '#fed7aa', '#ffffff', 'rgba(255,255,255,.92)']);
  const legacyBorderColors =
    type === 'draggable'
      ? new Set(['', '#2563eb', '#ec4899'])
      : new Set(['', '#f97316', '#f59e0b']);
  const legacyTextColors =
    type === 'draggable'
      ? new Set(['', '#1e40af', '#ec4899'])
      : new Set(['', '#9a3412', '#f59e0b']);

  if (legacyBackgrounds.has(background)) next.background = base.background;
  if (legacyBorderColors.has(borderColor)) next.borderColor = base.borderColor;
  if (legacyTextColors.has(color)) next.color = base.color;
  if (!style.fontSize) next.fontSize = base.fontSize;

  return { ...base, ...next };
}

export function applyStorylineVariableBindings(obj = {}, runtimeVariables = {}) {
  const bindings = obj.variableBindings;
  if (!bindings || typeof bindings !== 'object') return obj;
  let patched = obj;
  for (const [prop, varId] of Object.entries(bindings)) {
    if (!varId || !(varId in runtimeVariables)) continue;
    const val = runtimeVariables[varId];
    if (prop.startsWith('style.')) {
      const styleProp = prop.slice(6);
      patched =
        patched === obj
          ? { ...obj, style: { ...obj.style, [styleProp]: val } }
          : { ...patched, style: { ...patched.style, [styleProp]: val } };
    } else if (prop === 'visible') {
      const boolVal = val === true || val === 'true' || val === 1;
      patched = patched === obj ? { ...obj, visible: boolVal } : { ...patched, visible: boolVal };
    } else {
      patched = patched === obj ? { ...obj, [prop]: val } : { ...patched, [prop]: val };
    }
  }
  return patched;
}

export function getStorylineRuntimeObjectState(
  objectStates = {},
  hiddenObjectIds = new Set(),
  objectId = ''
) {
  const rawState = objectStates?.[objectId] || {};
  return {
    normal: rawState.normal !== false,
    hover: !!rawState.hover,
    visited: !!rawState.visited,
    selected: !!rawState.selected,
    disabled: !!rawState.disabled,
    hidden: hiddenObjectIds?.has?.(objectId) || false,
    dropCorrect: !!rawState.dropCorrect,
    dropIncorrect: !!rawState.dropIncorrect,
    dragOver: !!rawState.dragOver,
  };
}

export function resolveStorylineObjectStyle(obj = {}, runtimeState = {}) {
  const baseStyle = { ...(obj.style || {}) };
  const stateStyles = obj.stateStyles || {};
  const activeStateKeys = STORYLINE_RENDER_STATE_ORDER.filter(
    (stateKey) => stateKey !== 'normal' && runtimeState?.[stateKey]
  );
  let resolved = { ...baseStyle };

  if (stateStyles.normal && (runtimeState?.normal || activeStateKeys.length === 0)) {
    resolved = { ...resolved, ...stateStyles.normal };
  }

  activeStateKeys.forEach((stateKey) => {
    if (stateStyles[stateKey]) {
      resolved = { ...resolved, ...stateStyles[stateKey] };
    }
  });

  return resolved;
}

export function getStorylineAccessibilityProps(
  obj = {},
  { clickable = false, isImage = false } = {}
) {
  const accessibility = { ...ACCESSIBILITY_DEFAULTS, ...(obj.accessibility || {}) };
  const decorative = accessibility.role === 'none';
  const computedRole = decorative
    ? 'presentation'
    : accessibility.role && accessibility.role !== 'presentation'
      ? accessibility.role
      : clickable
        ? 'button'
        : undefined;
  const ariaLabel =
    accessibility.ariaLabel ||
    accessibility.altText ||
    (isImage ? obj.label || obj.type : obj.label || '');
  const focusable = accessibility.focusable !== false && !accessibility.ariaHidden;
  const parsedTabIndex = Number(accessibility.tabIndex);
  const tabIndex = focusable
    ? Number.isFinite(parsedTabIndex)
      ? parsedTabIndex
      : clickable
        ? 0
        : -1
    : -1;

  return {
    accessibility,
    role: computedRole,
    ariaLabel,
    ariaDescribedBy: accessibility.ariaDescribedBy || undefined,
    ariaHidden: !!accessibility.ariaHidden,
    tabIndex,
    lang: accessibility.lang || undefined,
  };
}

function getBaseLayerAutoName(activity = {}) {
  const candidates = [activity.sceneName, activity.name, 'Base Layer'];
  for (const candidate of candidates) {
    const resolved = String(candidate || '').trim();
    if (resolved) return resolved;
  }
  return 'Base Layer';
}

function getRendererLayers(activity = {}) {
  return Array.isArray(activity?.layers) && activity.layers.length
    ? activity.layers
    : [{ id: 'base', name: 'Katman', kind: 'base', visible: true }];
}

function buildLayerNameMap(layers = [], activity = {}) {
  const resolvedNames = {};
  const usedNames = new Set();
  const presets = ['menu', 'explanation', 'normal', 'Correct', 'Incorrect', 'cevap'];
  const nextName = () =>
    presets.find((name) => !usedNames.has(layerKey(name))) || `Layer ${usedNames.size + 1}`;

  layers.forEach((layer, index) => {
    const layerId = layer?.id || (index === 0 ? 'base' : `layer-${index + 1}`);
    const isBase =
      (layer?.kind || (index === 0 ? 'base' : 'overlay')) === 'base' || layerId === 'base';
    if (isBase) {
      const baseName = getBaseLayerAutoName(activity);
      resolvedNames[layerId] = baseName;
      usedNames.add(layerKey(baseName));
      return;
    }
    const rawName = String(layer?.name || '').trim();
    const shouldAutoName = layer?.autoName === true || (!rawName && layer?.autoName !== false);
    const resolvedName = shouldAutoName ? nextName() : rawName;
    resolvedNames[layerId] = resolvedName || nextName();
    usedNames.add(layerKey(resolvedNames[layerId]));
  });

  return resolvedNames;
}

function hasRenderableObjects(objects) {
  return (
    Array.isArray(objects) &&
    objects.some((object) => !object?.isPdfMask && !object?.isPdfBackground)
  );
}

export function buildStorylinePreviewObjectId(obj = {}, index = 0) {
  const layerId = obj.layerId || 'base';
  const label = rendererKey(obj.label || obj.group || obj.type || '').slice(0, 80);
  const geometry = [obj.x, obj.y, obj.width, obj.height]
    .map((value) => Math.round(Number(value) || 0))
    .join('-');
  return `preview__${obj.type || 'object'}__${layerId}__${index}__${label}__${geometry}`;
}

export function getStorylinePreviewRenderData({
  activity = null,
  slide = null,
  rawActivity = null,
  activeLayerId = 'base',
  hiddenObjectIds = null,
  dragPositions = {},
  runtimeVariables = {},
} = {}) {
  const objectMap = new Map();
  const objectSources = hasRenderableObjects(activity?.objects)
    ? [activity.objects]
    : hasRenderableObjects(slide?.objects)
      ? [slide.objects]
      : hasRenderableObjects(rawActivity?.objects)
        ? [rawActivity.objects]
        : [activity?.objects, slide?.objects, rawActivity?.objects];

  objectSources.forEach((objects) => {
    if (!Array.isArray(objects)) return;
    objects.forEach((object) => {
      if (!object?.id) return;
      objectMap.set(object.id, { ...(objectMap.get(object.id) || {}), ...object });
    });
  });

  const previewLayerSource = activity || rawActivity || slide || {};
  const previewLayers = getRendererLayers(previewLayerSource);
  const previewLayerNames = buildLayerNameMap(previewLayers, previewLayerSource);
  const activeLayerNameKey = layerKey(
    previewLayerNames[activeLayerId] ||
      previewLayers.find((layer) => layer.id === activeLayerId)?.name ||
      (activeLayerId === 'base' ? 'base' : '')
  );
  const activeLayerDisplayName = previewLayerNames[activeLayerId] || '';
  const isAnswerLayerActive = activeLayerNameKey === 'cevap';
  const mergedPreviewObjects = [...objectMap.values()];
  const hiddenBaseDraggableCount = isAnswerLayerActive
    ? mergedPreviewObjects.filter(
        (obj) =>
          (obj.layerId || 'base') === 'base' && obj.type === 'draggable' && obj.visible !== false
      ).length
    : 0;

  const objects = mergedPreviewObjects
    .filter((obj) => !hiddenObjectIds?.has?.(obj.id))
    .filter((obj) => !obj?.isPdfMask && !obj?.isPdfBackground)
    .filter((obj) => {
      const objectLayerId = obj.layerId || 'base';
      if (
        isAnswerLayerActive &&
        activeLayerId !== 'base' &&
        objectLayerId === 'base' &&
        obj.type === 'draggable' &&
        !dragPositions[obj.id]
      )
        return false;
      return (
        objectLayerId === 'base' || (activeLayerId !== 'base' && objectLayerId === activeLayerId)
      );
    })
    .map((obj) => applyStorylineVariableBindings(obj, runtimeVariables))
    .filter((obj) => obj.visible !== false)
    .sort((a, b) => (Number(a.zIndex) || 0) - (Number(b.zIndex) || 0))
    .map((obj, index) => ({ ...obj, __previewId: buildStorylinePreviewObjectId(obj, index) }));

  return {
    objects,
    selectionUi: { ...DEFAULT_SELECTION_UI, ...(previewLayerSource.selectionUi || {}) },
    stageWidth: Number(
      activity?.stageWidth || slide?.stageWidth || rawActivity?.stageWidth || 1920
    ),
    stageHeight: Number(
      activity?.stageHeight || slide?.stageHeight || rawActivity?.stageHeight || 1080
    ),
    activeLayerDisplayName,
    activeLayerNameKey,
    isAnswerLayerActive,
    hiddenBaseDraggableCount,
  };
}

export function isStorylineDropTargetLikeObject(item = {}) {
  return isStorylineRuntimeDropTargetLikeObject(item);
}

function triggerMatches(trigger, objectId) {
  const source = trigger?.target || '';
  const sourceKey = normalizeRuntimeActionLabel(source);
  if (objectId === '__activity__') {
    return source === '__activity__' || sourceKey === 'sahne' || sourceKey === 'secilinesne';
  }
  return source === objectId;
}

export function buildStorylineObjectRenderModel(
  obj = {},
  {
    activity = null,
    rawActivity = null,
    objectStates = {},
    hiddenObjectIds = null,
    activeLayerId = 'base',
    activeDragId = '',
    dragPositions = {},
    scale = 1,
    selectionUi = DEFAULT_SELECTION_UI,
    isAnswerLayerActive = false,
    getVectorPath = null,
  } = {}
) {
  const runtimeState = getStorylineRuntimeObjectState(objectStates, hiddenObjectIds, obj.id);
  const baseStyle = resolveStorylineObjectStyle(obj, runtimeState);
  let style =
    obj.type === 'draggable' || obj.type === 'dropzone'
      ? upgradeStorylineDragDropStyle(obj.type, baseStyle)
      : baseStyle;
  if (obj.type === 'draggable' && runtimeState.dropCorrect) {
    style = {
      ...style,
      background: 'linear-gradient(180deg,#dcfce7,#86efac)',
      borderColor: '#16a34a',
      color: '#14532d',
      boxShadow: '0 12px 26px rgba(22,163,74,.22), 0 0 0 2px rgba(22,163,74,.22)',
    };
  } else if (obj.type === 'draggable' && runtimeState.dropIncorrect) {
    style = {
      ...style,
      background: 'linear-gradient(180deg,#fee2e2,#fca5a5)',
      borderColor: '#dc2626',
      color: '#7f1d1d',
      boxShadow: '0 12px 26px rgba(220,38,38,.22), 0 0 0 2px rgba(220,38,38,.20)',
    };
  }
  const isImage = !!obj.imageData;
  const isSelectionOverlay = !!obj.selectionQuestionId;
  const selectionMark = obj.selectionMark || selectionUi.controlMark;
  const isSelected = runtimeState.selected;
  const isCheckButton = obj.isCheckButton || layerKey(obj.label).includes('kontrol');
  const objectLayerId = obj.layerId || 'base';
  const isInactiveBaseLayerObject = activeLayerId !== 'base' && objectLayerId === 'base';
  const triggers = activity?.triggers || [];
  const clickable =
    !isInactiveBaseLayerObject &&
    !runtimeState.disabled &&
    (isCheckButton ||
      isSelectionOverlay ||
      !!getRuntimeButtonAction(obj) ||
      triggers.some(
        (trigger) => (trigger.when || 'onClick') === 'onClick' && triggerMatches(trigger, obj.id)
      ));
  const hoverable =
    !isInactiveBaseLayerObject &&
    !runtimeState.disabled &&
    triggers.some(
      (trigger) => (trigger.when || 'onClick') === 'onHover' && triggerMatches(trigger, obj.id)
    );
  const hasNativeInteraction =
    !isInactiveBaseLayerObject && ['video', 'audio', 'embed', 'slider'].includes(obj.type);
  const previewId = obj.__previewId || obj.id;
  const runtimePosition =
    obj.type === 'draggable' ? dragPositions[obj.id] || dragPositions[previewId] || null : null;
  const objectX = runtimePosition ? runtimePosition.x : Number(obj.x) || 0;
  const objectY = runtimePosition ? runtimePosition.y : Number(obj.y) || 0;
  const isPlacedDrag =
    obj.type === 'draggable' && !!(dragPositions[obj.id] || dragPositions[previewId]);
  const isOverlayLayerDraggable = activeLayerId !== 'base' && obj.type === 'draggable';
  const isStaticEvidenceDrag =
    isOverlayLayerDraggable || (isAnswerLayerActive && obj.type === 'draggable');
  const canDragObject = obj.type === 'draggable' && !isStaticEvidenceDrag && !obj.disableDrag;
  const buttonMotion =
    obj.buttonMotion && typeof obj.buttonMotion === 'object' ? obj.buttonMotion : null;
  const isAnimatedButton = !isInactiveBaseLayerObject && !!buttonMotion && !runtimeState.disabled;
  const pointerActive = clickable || hoverable || hasNativeInteraction || canDragObject;
  const isActiveOverlayObject = activeLayerId !== 'base' && objectLayerId === activeLayerId;
  const isActiveDrag = canDragObject && activeDragId === previewId;
  const maxBaseLayerZ =
    activeLayerId !== 'base' && activity?.objects
      ? (activity.objects || []).reduce(
          (max, item) =>
            (item?.layerId || 'base') === 'base' ? Math.max(max, Number(item.zIndex) || 0) : max,
          0
        )
      : 0;
  const layerZIndex = isActiveOverlayObject ? Math.max(100000000, maxBaseLayerZ + 100000) : 0;
  const previewZIndex =
    obj.type === 'draggable'
      ? isActiveDrag
        ? 40000
        : isPlacedDrag
          ? 32000
          : layerZIndex + 7000
      : layerZIndex +
        (obj.type === 'dropzone'
          ? Math.max(5, Number(obj.zIndex) || 1)
          : Math.max(20, Number(obj.zIndex) || 1));
  const labelText = obj.label ?? '';
  const fallbackLabel = obj.type === 'draggable' || obj.type === 'dropzone' ? '' : obj.type;
  const displayLabel = String(labelText || fallbackLabel);
  const selectionGlyph = isSelectionOverlay && isSelected ? getSelectionGlyph(selectionMark) : '';
  const evidenceBadge =
    obj.type === 'draggable' && (runtimeState.dropCorrect || runtimeState.dropIncorrect)
      ? {
          glyph: runtimeState.dropCorrect ? '✓' : '×',
          bg: runtimeState.dropCorrect ? '#16a34a' : '#dc2626',
          ring: runtimeState.dropCorrect ? 'rgba(22,163,74,.26)' : 'rgba(220,38,38,.24)',
          label: runtimeState.dropCorrect ? 'Doğru' : 'Yanlış',
        }
      : null;
  const evidenceBadgeSize = evidenceBadge
    ? Math.max(18, Math.min(36, (Number(obj.height) || 1) * scale * 0.68))
    : 0;
  const shapeKind = obj.type === 'shape' ? obj.shapeKind || 'roundedRect' : '';
  const shapeBackground = String(style.background || '');
  const canRenderShapeAsCssBox =
    obj.type === 'shape' &&
    ['rect', 'roundedRect', 'ellipse'].includes(shapeKind) &&
    /gradient|url\(/i.test(shapeBackground);
  const usesShapeSvg = obj.type === 'shape' && !!shapeKind && !canRenderShapeAsCssBox;
  const shapeStrokeWidth = Math.max(
    1,
    Number(
      style.borderWidth ??
        (shapeKind.startsWith('line') || shapeKind.includes('arrow') || shapeKind === 'curve'
          ? 7
          : 4)
    ) || 1
  );
  const shapeCornerRadius = usesShapeSvg
    ? Math.max(
        0,
        Math.min(
          34,
          ((Number(style.borderRadius || 0) || 0) /
            Math.max(1, Math.min(Number(obj.width) || 1, Number(obj.height) || 1))) *
            100
        )
      )
    : 0;
  const shapeVectorPath =
    shapeKind === 'customPath' && typeof getVectorPath === 'function'
      ? getVectorPath(obj)
      : obj.vectorPath || '';
  const showShapeLabel =
    usesShapeSvg &&
    obj.showShapeLabel !== false &&
    !shapeKind.startsWith('line') &&
    !shapeKind.includes('arrow') &&
    shapeKind !== 'curve';
  const accessibility = getStorylineAccessibilityProps(obj, { clickable, isImage });

  return {
    runtimeState,
    baseStyle,
    style,
    isImage,
    isSelectionOverlay,
    selectionMark,
    selectionGlyph,
    isSelected,
    isCheckButton,
    clickable,
    hoverable,
    hasNativeInteraction,
    previewId,
    runtimePosition,
    objectX,
    objectY,
    objectLayerId,
    isPlacedDrag,
    isOverlayLayerDraggable,
    isStaticEvidenceDrag,
    canDragObject,
    isAnimatedButton,
    buttonMotion,
    pointerActive,
    isActiveOverlayObject,
    isActiveDrag,
    layerZIndex,
    previewZIndex,
    displayLabel,
    evidenceBadge,
    evidenceBadgeSize,
    shapeKind,
    usesShapeSvg,
    shapeStrokeWidth,
    shapeCornerRadius,
    shapeVectorPath,
    showShapeLabel,
    accessibility,
    source: activity || rawActivity || {},
    opacity: runtimeState.disabled ? 0.45 : clampValue(Number(style.opacity ?? 1) || 1, 0, 1),
  };
}

export function getSharedStorylineRendererRuntimeApi() {
  if (sharedStorylineRendererRuntimeApi) return sharedStorylineRendererRuntimeApi;
  // eslint-disable-next-line no-new-func -- Preview must execute the exact same runtime bundle SCORM uses.
  sharedStorylineRendererRuntimeApi = new Function(`
    ${STORYLINE_RUNTIME_CORE_SCRIPT}
    ${STORYLINE_RUNTIME_ENGINE_SCRIPT}
    ${STORYLINE_RENDERER_CORE_SCRIPT}
    return {
      storylineRenderSlide,
      storylineRendererAttachDragDrop,
      storylineRendererCheckAnswer,
      storylineRendererEvaluate,
      storylineRendererIsCheckButton,
      storylineRendererIsDropTargetLike,
      storylineRendererObjectKey,
      storylineRendererVisibleObjects,
      storylineRuntimeCommandsForObject,
      storylineRuntimeCommandsForDrop,
    };
  `)();
  return sharedStorylineRendererRuntimeApi;
}
