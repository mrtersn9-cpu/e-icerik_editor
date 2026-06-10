import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from 'react';

import {
  DEFAULT_SELECTION_UI,
  ACCESSIBILITY_DEFAULTS,
} from '../../constants';
import {
  getActivitySlides,
  getActivityLayers,
  getCanvasObjects,
  getCorrectDragMatches,
  materializeActivitySlide,
} from '../../logic/activityHelpers';
import {
  isButtonIntroPlayPauseDemoButton,
} from '../../logic/buttonStyling';
import {
  getDragDropAnimationPreset,
  getDragDropPairsFromMatches,
} from '../../logic/dragDrop';
import {
  buildVectorPathFromPoints,
  getObjectVectorPoints,
  normalizeLayerNameKey,
} from '../../logic/factories';
import {
  castVariableValue,
} from '../../logic/normalize';
import {
  isButtonIntroDemoButton,
} from '../../logic/sceneTemplates';
import {
  SCENE_TEMPLATE_LAUNCH_PAGE_ID,
  SCENE_TEMPLATE_BUTTON_INTRO_ID,
} from '../../logic/sceneTemplates';
import {
  createTimelineKeyframe,
  getTimelineItemForObject,
} from '../../logic/timeline';
import { buildChartSvg } from '../../utils/chartSvg';
import {
  clamp,
  sanitizeSvgMarkup,
} from '../../utils/editorHelpers';
import {
  getSharedStorylineRendererRuntimeApi,
  getStorylinePreviewRenderData,
  isStorylineDropTargetLikeObject,
  buildStorylineObjectRenderModel,
} from '../../utils/storylineRenderer';
import {
  getRuntimeButtonAction,
  withStableRuntimeSlideObjectIds,
} from '../../utils/storylineRuntime';
import {
  findStorylineRuntimeDropTarget,
  getStorylineRuntimeSnapPosition,
  evaluateStorylineRuntimeDragDrop,
  evaluateStorylineRuntimeSelection,
  getStorylineRuntimeDropResultStates,
  getStorylineRuntimeCommandsForObject,
} from '../../utils/storylineRuntimeEngine';
import { buildTableHtml } from '../../utils/tableHtml';
import WidgetHost from '../../widgets/WidgetHost';
import { buildWidgetIframeSrc } from '../../widgets/WidgetRegistry';
import RuntimeVideoElement from '../editor/RuntimeVideoElement';
import {
  PreviewMatchingFlow,
  PreviewSequenceFlow,
  PreviewTextEntryFlow,
  PreviewFillBlankFlow,
  PreviewPuzzleOverlay,
  PreviewNumericFlow,
  PreviewSurveyFlow,
  PreviewHotspotFlow,
  PreviewMixedFlow,
} from '../preview/PreviewExtraFlows';
import { ShapePreviewIcon } from '../ui';

export function isButtonIntroInteractiveSlot(item = {}) {
  const slotId = String(item.sceneTemplateSlotId || '');
  const label = String(item.label || '').trim();
  const normalizedLabel = label.toLocaleUpperCase('tr-TR');
  return (
    slotId.endsWith(':start-button') ||
    slotId.endsWith(':start-icon') ||
    slotId.endsWith(':close-button') ||
    normalizedLabel.includes('ETKİNLİĞİ BAŞLAT') ||
    ['×', 'X', '✕', '✖'].includes(label)
  );
}

export function isLaunchIntroControl(item = {}) {
  const slotId = String(item.sceneTemplateSlotId || '');
  const label = String(item.label || '')
    .trim()
    .toLocaleUpperCase('tr-TR');
  return (
    slotId.endsWith(':intro-button') ||
    slotId.endsWith(':intro-icon') ||
    slotId.endsWith(':intro-icon-bg') ||
    slotId.endsWith(':intro-icon-text') ||
    label.includes('ETKİNLİK TANITIMI')
  );
}

export function isLaunchStartControl(item = {}) {
  const slotId = String(item.sceneTemplateSlotId || '');
  const label = String(item.label || '')
    .trim()
    .toLocaleUpperCase('tr-TR');
  return (
    slotId.endsWith(':start-button') ||
    slotId.endsWith(':start-icon') ||
    slotId.endsWith(':start-icon-bg') ||
    slotId.endsWith(':start-icon-text') ||
    label.includes('ETKİNLİĞİ BAŞLAT')
  );
}

function isLaunchInteractiveSlot(item = {}) {
  return isLaunchIntroControl(item) || isLaunchStartControl(item);
}

export function getFitScale(stageWidth, stageHeight, maxWidth, maxHeight) {
  const safeWidth = Math.max(320, maxWidth || 0);
  const safeHeight = Math.max(240, maxHeight || 0);
  const sw = Math.max(1, stageWidth || 1);
  const sh = Math.max(1, stageHeight || 1);
  return Math.max(0.1, Math.min(safeWidth / sw, safeHeight / sh));
}

export function getSelectionUi(activity = {}) {
  return { ...DEFAULT_SELECTION_UI, ...(activity.selectionUi || {}) };
}

export function getSelectionMarkGlyph(mark = 'check') {
  if (mark === 'cross') return '✗';
  if (mark === 'dot') return '●';
  return '✓';
}

function getSelectionOppositeMark(mark = 'check') {
  if (mark === 'cross') return 'check';
  if (mark === 'dot') return 'cross';
  return 'cross';
}

export function resolveWrongSelectionGlyph(selectionUi = {}, selectedMark = 'check') {
  const mode = selectionUi.wrongMarkMode || 'opposite';
  if (mode === 'none') return '';
  if (mode === 'same') return getSelectionMarkGlyph(selectedMark);
  return getSelectionMarkGlyph(getSelectionOppositeMark(selectedMark));
}

export function shouldObjectPersistAfterTimeline(clip = null) {
  if (!clip) return true;
  return (clip.exitEffect || 'none') === 'none';
}

export function isObjectTimelineActive(activity = {}, objectId = '', currentTime = 0) {
  const clip = getTimelineItemForObject(activity, objectId);
  if (!clip) return true;
  const start = Number(clip.start || 0);
  const end = start + Math.max(0.2, Number(clip.duration || 0));
  if (currentTime < start) return false;
  if (currentTime > end) return shouldObjectPersistAfterTimeline(clip);
  return true;
}

function applyTimelineEasing(progress = 0, easing = 'linear') {
  const p = clamp(progress, 0, 1);
  if (easing === 'easeIn') return p * p;
  if (easing === 'easeOut') return 1 - Math.pow(1 - p, 2);
  if (easing === 'easeInOut') return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
  if (easing === 'cubicBezier') {
    // Default cubic-bezier(0.42, 0, 0.58, 1) if no custom points
    const [x1, y1, x2, y2] = arguments[2] || [0.42, 0, 0.58, 1];
    const sampleCurve = (t) => {
      const e = 1 - t;
      return 3 * e * e * t * y1 + 3 * e * t * t * y2 + t * t * t;
    };
    let lo = 0,
      hi = 1,
      mid;
    for (let i = 0; i < 16; i++) {
      mid = (lo + hi) / 2;
      const xm =
        3 * (1 - mid) * (1 - mid) * mid * x1 + 3 * (1 - mid) * mid * mid * x2 + mid * mid * mid;
      if (xm < p) lo = mid;
      else hi = mid;
    }
    return sampleCurve((lo + hi) / 2);
  }
  return p;
}

function getTimelineDirectionOffset(direction = 'left', distance = 56) {
  if (direction === 'right') return { x: distance, y: 0 };
  if (direction === 'up') return { x: 0, y: -distance };
  if (direction === 'down') return { x: 0, y: distance };
  return { x: -distance, y: 0 };
}

export function getTimelineMotionStyle(activity = {}, objectId = '', currentTime = 0, options = {}) {
  const clip = getTimelineItemForObject(activity, objectId);
  if (!clip) return { opacity: 1, translateX: 0, translateY: 0, scale: 1 };
  const suppressBoundaryEffects = options?.suppressBoundaryEffects === true;

  const start = Number(clip.start || 0);
  const duration = Math.max(0.2, Number(clip.duration || 0.2));
  const end = start + duration;
  const ramp = Math.min(Math.max(duration * 0.22, 0.24), duration / 2);

  let opacity = 1;
  let translateX = 0;
  let translateY = 0;
  let scaleValue = 1;
  const keyframes =
    Array.isArray(clip.keyframes) && clip.keyframes.length
      ? clip.keyframes
      : [createTimelineKeyframe(0, 0), createTimelineKeyframe(duration, 1)];
  const finalFrame = keyframes[keyframes.length - 1] ||
    keyframes[0] || { x: 0, y: 0, scale: 1, opacity: 1 };

  if (currentTime < start) {
    return { opacity: 0, translateX: 0, translateY: 0, scale: 1 };
  }

  if (currentTime > end) {
    if (!shouldObjectPersistAfterTimeline(clip)) {
      return { opacity: 0, translateX: 0, translateY: 0, scale: 1 };
    }
    return {
      opacity: clamp(finalFrame.opacity ?? 1, 0, 1),
      translateX: Number(finalFrame.x || 0),
      translateY: Number(finalFrame.y || 0),
      scale: Number(finalFrame.scale || 1),
    };
  }

  const applyEffect = (
    effect = 'none',
    progress = 1,
    reverse = false,
    direction = 'left',
    easing = 'linear',
    bezierPts
  ) => {
    const eased = applyTimelineEasing(progress, easing, bezierPts);
    const amount = reverse ? eased : 1 - eased;
    if (effect === 'fade') {
      opacity *= reverse ? Math.max(0, 1 - eased) : eased;
      return;
    }
    if (effect === 'slide') {
      const offset = getTimelineDirectionOffset(direction, 72);
      translateX += offset.x * amount;
      translateY += offset.y * amount;
      return;
    }
    if (effect === 'scale') {
      const nextScale = reverse ? 1 - 0.28 * eased : 0.72 + 0.28 * eased;
      scaleValue *= nextScale;
      return;
    }
    if (effect === 'grow') {
      scaleValue *= reverse ? 1 - 0.6 * eased : 0.4 + 0.6 * eased;
      opacity *= reverse ? Math.max(0, 1 - eased) : eased;
      return;
    }
    if (effect === 'shrink') {
      scaleValue *= reverse ? 1 + 0.5 * eased : 1.5 - 0.5 * eased;
      opacity *= reverse ? Math.max(0, 1 - eased) : eased;
      return;
    }
    if (effect === 'fly') {
      const offset = getTimelineDirectionOffset(direction, 220);
      translateX += offset.x * amount;
      translateY += offset.y * amount;
      opacity *= reverse ? Math.max(0, 1 - eased) : eased;
    }
  };

  const localTime = clamp(currentTime - start, 0, duration);
  const currentFrameIndex = keyframes.findIndex((frame, index) => {
    const next = keyframes[index + 1];
    return !next || (localTime >= frame.time && localTime <= next.time);
  });
  const fromFrame = keyframes[Math.max(0, currentFrameIndex)] || keyframes[0];
  const toFrame =
    keyframes[Math.min(keyframes.length - 1, Math.max(0, currentFrameIndex + 1))] || fromFrame;
  const frameDuration = Math.max(0.001, (toFrame.time || 0) - (fromFrame.time || 0));
  const frameProgress =
    fromFrame.id === toFrame.id ? 1 : (localTime - (fromFrame.time || 0)) / frameDuration;
  const easedFrameProgress = applyTimelineEasing(
    frameProgress,
    clip.easing || 'linear',
    clip.cubicBezier
  );

  translateX = (fromFrame.x || 0) + ((toFrame.x || 0) - (fromFrame.x || 0)) * easedFrameProgress;
  translateY = (fromFrame.y || 0) + ((toFrame.y || 0) - (fromFrame.y || 0)) * easedFrameProgress;
  scaleValue =
    (fromFrame.scale || 1) + ((toFrame.scale || 1) - (fromFrame.scale || 1)) * easedFrameProgress;
  opacity =
    (fromFrame.opacity ?? 1) +
    ((toFrame.opacity ?? 1) - (fromFrame.opacity ?? 1)) * easedFrameProgress;

  if (!suppressBoundaryEffects && clip.entryEffect !== 'none' && currentTime <= start + ramp) {
    const progress = (currentTime - start) / ramp;
    applyEffect(clip.entryEffect, progress, false, clip.direction, clip.easing, clip.cubicBezier);
  }

  if (!suppressBoundaryEffects && clip.exitEffect !== 'none' && currentTime >= end - ramp) {
    const progress = (currentTime - (end - ramp)) / ramp;
    applyEffect(clip.exitEffect, progress, true, clip.direction, clip.easing, clip.cubicBezier);
  }

  return {
    opacity: clamp(opacity, 0, 1),
    translateX,
    translateY,
    scale: scaleValue,
  };
}

function buildRuntimeVariableMap(variableDefinitions = []) {
  return Object.fromEntries(
    variableDefinitions.map((variable) => [
      variable.id,
      castVariableValue(variable.type, variable.value),
    ])
  );
}

function getRuntimeObjectVisualState(
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

const RUNTIME_OBJECT_STATE_ORDER = [
  'normal',
  'visited',
  'hover',
  'selected',
  'dragOver',
  'dropIncorrect',
  'dropCorrect',
  'disabled',
];

function resolveRuntimeObjectStyle(obj = {}, runtimeState = {}) {
  const baseStyle = { ...(obj.style || {}) };
  const stateStyles = obj.stateStyles || {};
  const activeStateKeys = RUNTIME_OBJECT_STATE_ORDER.filter(
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

  if (isRuntimeOverlayPopupPanel(obj, resolved)) {
    resolved = makeRuntimePanelOpaque(resolved);
  }

  return resolved;
}

function isRuntimeOverlayPopupPanel(obj = {}, style = {}) {
  if (obj.type !== 'shape' || (obj.shapeKind || 'roundedRect') !== 'roundedRect') return false;
  if ((obj.layerId || 'base') === 'base') return false;
  const width = Number(obj.width) || 0;
  const height = Number(obj.height) || 0;
  if (width < 220 || height < 55) return false;
  const x = Number(obj.x) || 0;
  const y = Number(obj.y) || 0;
  if (x <= 2 && y <= 2 && width >= 1600 && height >= 900) return false;
  const background = String(style.background || '');
  return !!background && background !== 'transparent';
}

function makeRuntimePanelOpaque(style = {}) {
  const background = String(style.background || '');
  return {
    ...style,
    background: background
      .replace(/rgba\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,]+)\s*,\s*[^)]+\)/gi, 'rgba($1,$2,$3,.98)')
      .replace(/rgb\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^)]+)\)/gi, 'rgba($1,$2,$3,.98)'),
    opacity: 1,
  };
}

function getRuntimeAccessibilityProps(obj = {}, { clickable = false, isImage = false } = {}) {
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

function getTriggerSourceMatches(trigger, objectId) {
  const source = trigger?.target || 'Secili Nesne';
  if (objectId === '__activity__')
    return source === '__activity__' || source === 'Sahne';
  return (
    source === objectId ||
    source === 'TiklananNesne' ||
    source === 'selected'
  );
}

function applyVariableBindings(obj, runtimeVariables = {}) {
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

function getDemoButtonDisplayLabel(obj = {}, objectStates = {}, fallbackLabel = '') {
  const demoAction = isButtonIntroPlayPauseDemoButton(obj)
    ? 'toggle-play-pause'
    : String(obj.sceneTemplateDemoAction || '');
  if (!demoAction) return fallbackLabel;
  const stateId =
    obj.linkedActionTargetId && obj.linkedActionTargetId !== obj.id
      ? obj.linkedActionTargetId
      : obj.id;
  const active = !!objectStates?.[stateId]?.selected;
  if (demoAction === 'toggle-mute') {
    const label = active
      ? obj.soundOnLabel || 'SESİ AÇ'
      : obj.soundOffLabel || fallbackLabel || 'SESİ KAPAT';
    const icon = active ? obj.soundOnIcon || '🔇︎' : obj.soundOffIcon || '🔊︎';
    if (String(obj.soundIconMode || '') === 'icon-only') return icon;
    if (String(obj.soundIconMode || '') === 'external') return label;
    return `${icon ? `${icon}  ` : ''}${label}`;
  }
  if (demoAction === 'toggle-play-pause') {
    const icon = active ? obj.pauseIcon || '❚❚' : obj.playIcon || '▶';
    return icon;
  }
  return fallbackLabel;
}

// Legacy preview layer kept for renderer parity checks while the shared stage path is active.
// eslint-disable-next-line no-unused-vars
function RuntimeObjectLayer({
  activity,
  activeLayerId,
  hiddenObjectIds,
  objectStates = {},
  onRunTriggers,
  onSelectionChoice,
  onHoverChange,
  selectedObjectIds = [],
  hintObjectIds = [],
  selectionFeedbackById = {},
  scale,
  includeDragDrop = false,
  includeAllLayers = false,
  currentTime = 0,
  ignoreTimeline = false,
  captionsEnabled = false,
  runtimeVariables = {},
}) {
  const sourceObjects = includeAllLayers
    ? (activity?.objects || []).filter(
        (obj) =>
          !hiddenObjectIds?.has?.(obj.id) &&
          !obj?.isPdfMask &&
          !obj?.isPdfBackground &&
          !obj?.isStageBackground
      )
    : getCanvasObjects(activity, activeLayerId, hiddenObjectIds);
  const objects = sourceObjects
    .filter((obj) => ignoreTimeline || isObjectTimelineActive(activity, obj.id, currentTime))
    .map((obj) => applyVariableBindings(obj, runtimeVariables))
    .filter((obj) => obj.visible !== false)
    .filter((obj) => includeDragDrop || (obj.type !== 'draggable' && obj.type !== 'dropzone'))
    .sort((a, b) => a.zIndex - b.zIndex);
  const selectionUi = getSelectionUi(activity);
  const getLinkedObjectIds = useCallback(
    (obj = {}) => {
      const group = String(obj.linkedHoverGroup || '').trim();
      if (!group) return [obj.id].filter(Boolean);
      const ids = objects
        .filter((item) => String(item.linkedHoverGroup || '').trim() === group)
        .map((item) => item.id)
        .filter(Boolean);
      return ids.length ? [...new Set(ids)] : [obj.id].filter(Boolean);
    },
    [objects]
  );
  const getLinkedActionTargetId = useCallback(
    (obj = {}) => {
      if (obj.linkedActionTargetId) return obj.linkedActionTargetId;
      const group = String(obj.linkedHoverGroup || '').trim();
      if (!group) return obj.id;
      const candidates = objects.filter(
        (item) => String(item.linkedHoverGroup || '').trim() === group
      );
      const labelCandidate =
        candidates.find((item) => String(item.sceneTemplateSlotId || '').endsWith('-label')) ||
        candidates.find((item) => String(item.soundIconMode || '') === 'external') ||
        candidates.find((item) => Number(item.width || 0) >= Number(obj.width || 0));
      return labelCandidate?.id || obj.id;
    },
    [objects]
  );

  return objects.map((obj) => {
    const isImage = !!obj.imageData;
    const runtimeState = getRuntimeObjectVisualState(objectStates, hiddenObjectIds, obj.id);
    const st = resolveRuntimeObjectStyle(obj, runtimeState);
    const motionStyle = getTimelineMotionStyle(activity, obj.id, currentTime);
    const isSelectionOverlay = !!obj.selectionQuestionId;
    const selectionMark = obj.selectionMark || selectionUi.controlMark;
    const wrongGlyph = resolveWrongSelectionGlyph(selectionUi, selectionMark);
    const overlaySelected = isSelectionOverlay && selectedObjectIds.includes(obj.id);
    const hintSelected = hintObjectIds.includes(obj.id);
    const isSelected = runtimeState.selected || overlaySelected;
    const feedbackState = selectionFeedbackById[obj.id] || null;
    const isCorrectFeedback = feedbackState === 'correct';
    const isWrongFeedback = feedbackState === 'wrong';
    const actionSourceIds = [
      obj.id,
      getLinkedActionTargetId(obj),
      ...getLinkedObjectIds(obj),
    ].filter(Boolean);
    const clickable =
      !runtimeState.disabled &&
      (isSelectionOverlay ||
        !!getRuntimeButtonAction(obj) ||
        (activity.triggers || []).some(
          (trigger) =>
            (trigger.when || 'onClick') === 'onClick' &&
            actionSourceIds.some((sourceId) => getTriggerSourceMatches(trigger, sourceId))
        ));
    const hoverable =
      !runtimeState.disabled &&
      (activity.triggers || []).some(
        (trigger) =>
          (trigger.when || 'onClick') === 'onHover' &&
          getLinkedObjectIds(obj).some((sourceId) => getTriggerSourceMatches(trigger, sourceId))
      );
    const hasNativeInteraction = ['video', 'audio', 'embed', 'slider'].includes(obj.type);
    const hasHoverState = !!obj.stateStyles?.hover;
    const pointerActive = clickable || hoverable || hasNativeInteraction;
    const stateScale = Math.max(0.1, Number(st.scale ?? 1) || 1);
    const stateOpacity = clamp(Number(st.opacity ?? 1) || 1, 0, 1);
    const shapeKind = obj.type === 'shape' ? obj.shapeKind || 'roundedRect' : '';
    const shapeBackground = String(st.background || '');
    const canRenderShapeAsCssBox =
      obj.type === 'shape' &&
      ['rect', 'roundedRect', 'ellipse'].includes(shapeKind) &&
      /gradient|url\(/i.test(shapeBackground);
    const usesShapeSvg = obj.type === 'shape' && !!shapeKind && !canRenderShapeAsCssBox;
    const shapeStrokeWidth = Math.max(
      1,
      Number(
        st.borderWidth ??
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
            ((Number(st.borderRadius || 0) || 0) /
              Math.max(1, Math.min(Number(obj.width) || 1, Number(obj.height) || 1))) *
              100
          )
        )
      : 0;
    const shapeVectorPath =
      shapeKind === 'customPath'
        ? buildVectorPathFromPoints(getObjectVectorPoints(obj), true)
        : obj.vectorPath || '';
    const showShapeLabel =
      usesShapeSvg &&
      obj.showShapeLabel !== false &&
      !shapeKind.startsWith('line') &&
      !shapeKind.includes('arrow') &&
      shapeKind !== 'curve';
    const accessibility = getRuntimeAccessibilityProps(obj, { clickable, isImage });
    const renderedLabel = getDemoButtonDisplayLabel(obj, objectStates, obj.label || obj.type);
    const handleActivate = () => {
      if (isSelectionOverlay) {
        onSelectionChoice?.(obj.id);
        return;
      }
      onRunTriggers?.(actionSourceIds, 'onClick');
    };

    return (
      <div
        key={obj.id}
        data-object-id={obj.id}
        data-runtime-state={RUNTIME_OBJECT_STATE_ORDER.filter(
          (stateKey) => runtimeState[stateKey]
        ).join(' ')}
        role={accessibility.role}
        aria-label={accessibility.ariaLabel || undefined}
        aria-describedby={accessibility.ariaDescribedBy || undefined}
        aria-hidden={accessibility.ariaHidden || undefined}
        tabIndex={accessibility.tabIndex}
        lang={accessibility.lang}
        onClick={clickable ? handleActivate : undefined}
        onKeyDown={
          clickable
            ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  handleActivate();
                }
              }
            : undefined
        }
        onMouseEnter={
          hoverable || hasHoverState
            ? () => {
                getLinkedObjectIds(obj).forEach((id) => {
                  onHoverChange?.(id, true);
                  if (hoverable) onRunTriggers?.(id, 'onHover');
                });
              }
            : undefined
        }
        onMouseLeave={
          hoverable || hasHoverState
            ? () => getLinkedObjectIds(obj).forEach((id) => onHoverChange?.(id, false))
            : undefined
        }
        style={{
          position: 'absolute',
          left: obj.x * scale,
          top: obj.y * scale,
          width: obj.width * scale,
          height: obj.height * scale,
          transform: `translate(${motionStyle.translateX * scale}px, ${motionStyle.translateY * scale}px) rotate(${obj.rotation || 0}deg) scale(${motionStyle.scale * stateScale})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background:
            isImage || usesShapeSvg
              ? 'transparent'
              : isSelectionOverlay
                ? isWrongFeedback
                  ? '#fef2f2'
                  : isCorrectFeedback
                    ? '#ecfdf5'
                    : isSelected
                      ? '#e0f2fe'
                      : st.background || '#f8fbff'
                : st.background || 'transparent',
          border: usesShapeSvg
            ? 'none'
            : `${obj.type === 'hotspot' ? 2 : 1}px ${st.borderStyle || 'solid'} ${st.borderColor || 'transparent'}`,
          borderRadius: usesShapeSvg
            ? 0
            : shapeKind === 'ellipse'
              ? 999
              : (st.borderRadius || 0) * scale,
          boxSizing: 'border-box',
          color: st.color || '#111',
          fontSize: Math.max(10, (st.fontSize || 13) * scale),
          fontWeight: obj.type === 'button' ? 700 : 600,
          textDecoration: st.textDecoration || 'none',
          textAlign: 'center',
          padding: isImage || usesShapeSvg ? 0 : `${6 * scale}px`,
          cursor: clickable ? 'pointer' : hasNativeInteraction ? 'auto' : 'default',
          pointerEvents: pointerActive ? 'auto' : 'none',
          zIndex: Math.max(1, Number(obj.zIndex) || 1),
          opacity: (runtimeState.disabled ? 0.45 : 1) * motionStyle.opacity * stateOpacity,
          boxShadow: isSelected
            ? '0 0 0 3px rgba(255,255,255,.55), 0 12px 30px rgba(15,23,42,.18)'
            : runtimeState.dropCorrect
              ? '0 0 0 2px rgba(74,222,128,.65), 0 12px 30px rgba(22,163,74,.18)'
              : runtimeState.dropIncorrect
                ? '0 0 0 2px rgba(248,113,113,.6), 0 12px 30px rgba(220,38,38,.16)'
                : runtimeState.dragOver || runtimeState.hover
                  ? '0 0 0 2px rgba(96,165,250,.55), 0 12px 28px rgba(37,99,235,.16)'
                  : hintSelected
                    ? '0 0 0 2px rgba(74,222,128,.85), 0 0 0 6px rgba(74,222,128,.16)'
                    : clickable
                      ? '0 10px 24px rgba(15,23,42,.16)'
                      : 'none',
          filter: runtimeState.visited ? 'saturate(1.08)' : 'none',
        }}
      >
        {isSelectionOverlay ? (
          <span
            style={{
              pointerEvents: 'none',
              fontWeight: 900,
              fontSize: Math.max(18, (st.fontSize || 13) * scale),
              color: isWrongFeedback
                ? '#dc2626'
                : isCorrectFeedback || isSelected
                  ? '#16a34a'
                  : 'rgba(37,99,235,.18)',
              display: 'inline-block',
              width: '100%',
              textAlign: 'center',
            }}
          >
            {isWrongFeedback
              ? wrongGlyph
              : isCorrectFeedback || isSelected
                ? getSelectionMarkGlyph(selectionMark)
                : ''}
          </span>
        ) : obj.type === 'video' && obj.mediaUrl ? (
          <RuntimeVideoElement
            obj={obj}
            accessibility={accessibility}
            captionsEnabled={captionsEnabled}
          />
        ) : obj.type === 'audio' && obj.mediaUrl ? null : obj.type === 'embed' && obj.embedUrl ? (
          <iframe
            src={obj.embedUrl}
            title={accessibility.ariaLabel || obj.label || 'Embed'}
            sandbox="allow-scripts allow-forms allow-popups allow-presentation"
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              borderRadius: 'inherit',
              pointerEvents: 'auto',
            }}
          />
        ) : obj.type === 'embed' ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#94a3b8',
              fontSize: 12 * scale,
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <span style={{ fontSize: 24 * scale }}>🌐</span>
            <span>Web URL girin</span>
          </div>
        ) : obj.type === 'slider' ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              padding: '0 8px',
            }}
          >
            <input
              type="range"
              min={obj.sliderMin ?? 0}
              max={obj.sliderMax ?? 100}
              step={obj.sliderStep ?? 1}
              defaultValue={obj.sliderValue ?? 50}
              aria-label={accessibility.ariaLabel || obj.label || 'Slider'}
              style={{ width: '100%', accentColor: '#3b82f6', pointerEvents: 'auto' }}
            />
          </div>
        ) : obj.type === 'shape' ? (
          <>
            <ShapePreviewIcon
              kind={shapeKind}
              fill={st.background || '#0ea5e9'}
              stroke={st.borderColor || '#0284c7'}
              strokeWidth={shapeStrokeWidth}
              strokeLinejoin={st.strokeLinejoin || 'round'}
              strokeLinecap={st.strokeLinecap || 'round'}
              cornerRadius={shapeCornerRadius}
              nonScalingStroke
              fullBleed
              vectorPath={shapeVectorPath}
            />
            {showShapeLabel && (
              <span
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                  padding: '0 8px',
                  color: st.color || '#111',
                }}
              >
                {renderedLabel || 'Şekil'}
              </span>
            )}
          </>
        ) : isImage ? (
          <img
            src={obj.imageData}
            alt={obj.accessibility?.altText || accessibility.ariaLabel || obj.label || obj.type}
            style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }}
          />
        ) : (
          <span
            style={{
              pointerEvents: 'none',
              color: st.color || '#111',
              display: 'inline-block',
              width: '100%',
              textAlign: 'center',
            }}
          >
            {renderedLabel}
          </span>
        )}
      </div>
    );
  });
}

function StorylinePreviewObjectLayer({
  activity,
  slide,
  rawActivity,
  activeLayerId,
  hiddenObjectIds,
  objectStates = {},
  onRunTriggers,
  onSelectionChoice,
  onHoverChange,
  dragPositions = {},
  activeDragId = '',
  onDragStart,
  onDragEnd,
  onDragPositionChange,
  onDropAssign,
  onDragDebug,
  scale,
  captionsEnabled = false,
  runtimeVariables = {},
  onWidgetEvent,
  widgetRefs,
}) {
  const previewRenderData = useMemo(
    () =>
      getStorylinePreviewRenderData({
        activity,
        slide,
        rawActivity,
        activeLayerId,
        hiddenObjectIds,
        dragPositions,
        runtimeVariables,
      }),
    [activity, activeLayerId, dragPositions, hiddenObjectIds, rawActivity, runtimeVariables, slide]
  );
  const {
    objects,
    selectionUi,
    stageWidth,
    stageHeight,
    activeLayerDisplayName,
    isAnswerLayerActive,
    hiddenBaseDraggableCount,
  } = previewRenderData;
  const dropzones = objects.filter(isStorylineDropTargetLikeObject);
  const draggables =
    activeLayerId === 'base'
      ? objects.filter((item) => item.type === 'draggable' && !item.disableDrag)
      : [];
  const explicitDropzones = objects.filter((item) => item.type === 'dropzone');
  const inferredDropTargets = dropzones.filter((item) => item.type !== 'dropzone');

  useEffect(() => {
    onDragDebug?.({
      type: 'summary',
      code: 'DD_SUMMARY',
      level: dropzones.length ? 'info' : 'warn',
      message: `${draggables.length} sürüklenebilir, ${dropzones.length} bırakma hedefi`,
      data: {
        objectCount: objects.length,
        draggableCount: draggables.length,
        dropTargetCount: dropzones.length,
        explicitDropzoneCount: explicitDropzones.length,
        inferredDropTargetCount: inferredDropTargets.length,
        activeLayerId,
        activeLayerName: activeLayerDisplayName,
        answerLayerStaticMode: isAnswerLayerActive,
        hiddenBaseDraggableCount,
        stageWidth,
        stageHeight,
        scale: Number(scale.toFixed?.(4) || scale),
      },
    });
  }, [
    activeLayerDisplayName,
    activeLayerId,
    draggables.length,
    dropzones.length,
    explicitDropzones.length,
    hiddenBaseDraggableCount,
    inferredDropTargets.length,
    isAnswerLayerActive,
    objects.length,
    onDragDebug,
    scale,
    stageHeight,
    stageWidth,
  ]);

  const dragPositionSignature = Object.entries(dragPositions || {})
    .filter(
      ([, position]) =>
        position && Number.isFinite(Number(position.x)) && Number.isFinite(Number(position.y))
    )
    .sort(([left], [right]) => left.localeCompare(right))
    .map(
      ([id, position]) =>
        `${id}:${Math.round(Number(position.x) || 0)},${Math.round(Number(position.y) || 0)}`
    )
    .join('|');
  const draggableNodeSignature = draggables
    .map((item) => `${item.id}:${item.__previewId}`)
    .join('|');

  useEffect(() => {
    if (!dragPositionSignature || typeof document === 'undefined') return undefined;
    const escapeSelectorValue = (value = '') => String(value).replace(/["\\]/g, '\\$&');
    const applyLockedPositions = (reason = 'render') => {
      let applied = 0;
      draggables.forEach((item) => {
        const previewId = item.__previewId || item.id;
        const position = dragPositions[item.id] || dragPositions[previewId];
        if (!position) return;
        const node =
          document.querySelector(
            `[data-object-id="${escapeSelectorValue(item.id)}"][data-object-type="draggable"]`
          ) ||
          document.querySelector(`[data-preview-object-id="${escapeSelectorValue(previewId)}"]`);
        if (!node) return;
        node.style.left = `${(Number(position.x) || 0) * scale}px`;
        node.style.top = `${(Number(position.y) || 0) * scale}px`;
        node.style.zIndex = String(Math.max(9000, Number(node.style.zIndex) || 0));
        node.dataset.dropLocked = 'true';
        applied += 1;
      });
      if (applied) {
        onDragDebug?.({
          type: 'live',
          code: 'DD_DOM_POSITION_LOCK',
          level: 'success',
          message: `${applied} yerleşmiş öğe DOM konumuna kilitlendi.`,
          data: { applied, reason, dragPositionSignature },
        });
      }
    };

    applyLockedPositions('effect');
    const frame =
      typeof window !== 'undefined'
        ? window.requestAnimationFrame(() => applyLockedPositions('raf'))
        : 0;
    const timer =
      typeof window !== 'undefined'
        ? window.setTimeout(() => applyLockedPositions('delayed'), 120)
        : 0;
    return () => {
      if (frame && typeof window !== 'undefined') window.cancelAnimationFrame(frame);
      if (timer && typeof window !== 'undefined') window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Signature deps keep the DOM lock current without a debug-update render loop.
  }, [activeLayerId, dragPositionSignature, draggableNodeSignature, onDragDebug, scale]);

  const describeDebugObject = (item = {}) => ({
    id: item.id || '',
    previewId: item.__previewId || '',
    type: item.type || '',
    label: String(item.label || item.group || item.type || '').slice(0, 80),
    layerId: item.layerId || 'base',
    x: Math.round(Number(item.x) || 0),
    y: Math.round(Number(item.y) || 0),
    width: Math.round(Number(item.width) || 0),
    height: Math.round(Number(item.height) || 0),
  });

  const getDragClientRect = (stageRect, x, y, dragWidth, dragHeight, clientScale) =>
    stageRect
      ? {
          left: stageRect.left + x * clientScale,
          top: stageRect.top + y * clientScale,
          right: stageRect.left + (x + dragWidth) * clientScale,
          bottom: stageRect.top + (y + dragHeight) * clientScale,
        }
      : null;

  const findCapturedDropTarget = (
    entries = [],
    pointerClientX = null,
    pointerClientY = null,
    dragClientRect = null
  ) => {
    let pointerDrop = null;
    if (Number.isFinite(pointerClientX) && Number.isFinite(pointerClientY)) {
      pointerDrop =
        entries.find(
          (entry) =>
            pointerClientX >= entry.rect.left &&
            pointerClientX <= entry.rect.right &&
            pointerClientY >= entry.rect.top &&
            pointerClientY <= entry.rect.bottom
        )?.drop || null;
    }
    if (pointerDrop) return pointerDrop;

    if (!dragClientRect) return null;
    let bestDrop = null;
    let bestOverlap = 0;
    entries.forEach((entry) => {
      const left = Math.max(dragClientRect.left, entry.rect.left);
      const top = Math.max(dragClientRect.top, entry.rect.top);
      const right = Math.min(dragClientRect.right, entry.rect.right);
      const bottom = Math.min(dragClientRect.bottom, entry.rect.bottom);
      const overlap = Math.max(0, right - left) * Math.max(0, bottom - top);
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        bestDrop = entry.drop;
      }
    });
    return bestOverlap > 0 ? bestDrop : null;
  };

  const findDropTarget = (
    drag,
    x,
    y,
    pointerX = null,
    pointerY = null,
    pointerClientX = null,
    pointerClientY = null,
    dragClientRect = null,
    container = null
  ) => {
    const compatibleDrops = dropzones;
    const dragWidth = Number(drag.width) || 1;
    const dragHeight = Number(drag.height) || 1;
    const queryRoot = container || (typeof document !== 'undefined' ? document : null);
    if (Number.isFinite(pointerClientX) && Number.isFinite(pointerClientY) && queryRoot) {
      const domPointerDrop = compatibleDrops.find((drop) => {
        const node = queryRoot.querySelector(`[data-preview-object-id="${drop.__previewId}"]`);
        const rect = node?.getBoundingClientRect?.();
        if (!rect) return false;
        const margin = Math.max(12, Math.min(80, Math.max(dragWidth, dragHeight) * scale * 0.45));
        return (
          pointerClientX >= rect.left - margin &&
          pointerClientX <= rect.right + margin &&
          pointerClientY >= rect.top - margin &&
          pointerClientY <= rect.bottom + margin
        );
      });
      if (domPointerDrop) return domPointerDrop;

      if (dragClientRect) {
        let bestDomDrop = null;
        let bestDomOverlap = 0;
        compatibleDrops.forEach((drop) => {
          const node = queryRoot.querySelector(`[data-preview-object-id="${drop.__previewId}"]`);
          const rect = node?.getBoundingClientRect?.();
          if (!rect) return;
          const left = Math.max(dragClientRect.left, rect.left);
          const top = Math.max(dragClientRect.top, rect.top);
          const right = Math.min(dragClientRect.right, rect.right);
          const bottom = Math.min(dragClientRect.bottom, rect.bottom);
          const overlap = Math.max(0, right - left) * Math.max(0, bottom - top);
          if (overlap > bestDomOverlap) {
            bestDomOverlap = overlap;
            bestDomDrop = drop;
          }
        });
        if (bestDomOverlap > 0) return bestDomDrop;
      }
    }

    return findStorylineRuntimeDropTarget({
      slide,
      drag,
      drops: compatibleDrops,
      x,
      y,
      pointerX,
      pointerY,
    });
  };

  const findNearestDropTarget = (drag, x, y, pointerX = null, pointerY = null) => {
    return findStorylineRuntimeDropTarget({ slide, drag, drops: dropzones, x, y, pointerX, pointerY });
  };

  const getDropSnapPosition = (drag, drop) => {
    return getStorylineRuntimeSnapPosition({ drag, drop, stageWidth, stageHeight });
  };

  return objects.map((obj) => {
    const renderModel = buildStorylineObjectRenderModel(obj, {
      activity,
      rawActivity,
      objectStates,
      hiddenObjectIds,
      activeLayerId,
      activeDragId,
      dragPositions,
      scale,
      selectionUi,
      isAnswerLayerActive,
      getVectorPath: (shapeObject) =>
        buildVectorPathFromPoints(getObjectVectorPoints(shapeObject), true),
    });
    const {
      runtimeState,
      style: st,
      isImage,
      isSelectionOverlay,
      selectionMark,
      isSelected,
      clickable,
      hoverable,
      hasNativeInteraction,
      previewId,
      objectX,
      objectY,
      isPlacedDrag,
      isStaticEvidenceDrag,
      canDragObject,
      isAnimatedButton,
      buttonMotion,
      pointerActive,
      isActiveDrag,
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
    } = renderModel;
    const renderedDisplayLabel = getDemoButtonDisplayLabel(obj, objectStates, displayLabel);
    const dragAnimationPreset = getDragDropAnimationPreset(activity || rawActivity || {});
    const rotation = Number(obj.rotation) || 0;
    const baseTransform = `rotate(${rotation}deg)`;
    const activeDragTransform = `${baseTransform} scale(${dragAnimationPreset.activeScale || 1})`;
    const dragTransition = canDragObject
      ? isActiveDrag
        ? 'none'
        : `left ${dragAnimationPreset.settleDuration || 1}ms cubic-bezier(.2,.82,.2,1), top ${dragAnimationPreset.settleDuration || 1}ms cubic-bezier(.2,.82,.2,1), transform 170ms ease, box-shadow 170ms ease, filter 170ms ease`
      : 'none';
    const settledDragShadow = isPlacedDrag ? dragAnimationPreset.settledShadow || '' : '';
    const activeDragShadow = dragAnimationPreset.activeShadow || '0 18px 34px rgba(15,23,42,.34)';
    const activeDragFilter = dragAnimationPreset.hoverFilter || 'brightness(1.04)';
    const canUseDefaultInteractionShadow = obj.type === 'button' || obj.type === 'draggable';
    const baseBoxShadow =
      st.boxShadow ||
      (isActiveDrag
        ? activeDragShadow
        : settledDragShadow ||
          (clickable && canUseDefaultInteractionShadow ? '0 8px 20px rgba(15,23,42,.16)' : 'none'));
    const resolvedButtonMotion = isAnimatedButton
      ? {
          hoverScale: Math.max(
            1.005,
            Number(
              buttonMotion?.hoverScale ??
                Math.min(1.04, Math.max(1.01, Number(dragAnimationPreset.activeScale || 1.02)))
            ) || 1.02
          ),
          pressScale: Math.max(0.92, Number(buttonMotion?.pressScale ?? 0.98) || 0.98),
          liftY: Math.max(0, Number(buttonMotion?.liftY ?? 1) || 1),
          hoverFilter: String(
            buttonMotion?.hoverFilter || dragAnimationPreset.hoverFilter || 'brightness(1.04)'
          ),
          hoverShadow: String(
            buttonMotion?.hoverShadow || dragAnimationPreset.activeShadow || baseBoxShadow
          ),
          duration: Math.max(
            120,
            Number(
              buttonMotion?.duration ??
                Math.max(140, Math.min(260, dragAnimationPreset.settleDuration || 180))
            ) || 180
          ),
          easing: String(buttonMotion?.easing || 'cubic-bezier(.2,.82,.2,1)'),
        }
      : null;
    const objectTransition = canDragObject
      ? dragTransition
      : isAnimatedButton
        ? `transform ${resolvedButtonMotion?.duration || 150}ms ${resolvedButtonMotion?.easing || 'ease'}, box-shadow ${resolvedButtonMotion?.duration || 150}ms ${resolvedButtonMotion?.easing || 'ease'}, filter ${resolvedButtonMotion?.duration || 150}ms ${resolvedButtonMotion?.easing || 'ease'}`
        : isStaticEvidenceDrag
          ? 'filter 140ms ease, opacity 140ms ease, box-shadow 140ms ease'
          : 'none';
    const handleActivate = () => {
      if (isSelectionOverlay) {
        onSelectionChoice?.(obj.id);
        return;
      }
      onRunTriggers?.([obj.linkedActionTargetId, obj.id].filter(Boolean), 'onClick');
    };
    const getLinkedHoverElements = (currentTarget) => {
      if (!obj.linkedHoverGroup || !currentTarget) return [currentTarget].filter(Boolean);
      const root = currentTarget.closest?.('[data-preview-stage]') || currentTarget.parentElement;
      if (!root?.querySelectorAll) return [currentTarget];
      const group = String(obj.linkedHoverGroup).replace(/"/g, '\\"');
      const nodes = Array.from(root.querySelectorAll(`[data-linked-hover-group="${group}"]`));
      return nodes.length ? nodes : [currentTarget];
    };
    const applyLinkedHoverMotion = (currentTarget, hovering) => {
      getLinkedHoverElements(currentTarget).forEach((node) => {
        const nodeBaseTransform = node.dataset.baseTransform || 'rotate(0deg)';
        const nodeBaseShadow = node.dataset.baseShadow || 'none';
        const nodeBaseFilter = node.dataset.baseFilter || 'brightness(1)';
        if (hovering) {
          node.style.transform = `${nodeBaseTransform} translateY(-${resolvedButtonMotion?.liftY || 1}px) scale(${resolvedButtonMotion?.hoverScale || 1.02})`;
          node.style.boxShadow = resolvedButtonMotion?.hoverShadow || nodeBaseShadow;
          node.style.filter = resolvedButtonMotion?.hoverFilter || 'brightness(1.04)';
        } else {
          node.style.transform = nodeBaseTransform;
          node.style.boxShadow = nodeBaseShadow;
          node.style.filter = nodeBaseFilter;
        }
      });
    };
    const handleButtonPointerDown = isAnimatedButton
      ? (event) => {
          getLinkedHoverElements(event.currentTarget).forEach((node) => {
            const nodeBaseTransform = node.dataset.baseTransform || baseTransform;
            node?.animate?.(
              [
                {
                  transform: `${nodeBaseTransform} translateY(-${resolvedButtonMotion?.liftY || 0}px) scale(${resolvedButtonMotion?.hoverScale || 1.02})`,
                },
                {
                  transform: `${nodeBaseTransform} scale(${resolvedButtonMotion?.pressScale || 0.98})`,
                  offset: 0.48,
                },
                { transform: `${nodeBaseTransform} scale(1)` },
              ],
              {
                duration:
                  resolvedButtonMotion?.duration ||
                  Math.max(140, Math.min(260, dragAnimationPreset.settleDuration || 180)),
                easing: resolvedButtonMotion?.easing || 'cubic-bezier(.2,.82,.2,1)',
              }
            );
          });
        }
      : undefined;
    const handleStaticEvidenceEvent = undefined;
    const handleObjectMouseEnter = (event) => {
      if (hoverable || obj.stateStyles?.hover) {
        onHoverChange?.(obj.id, true);
        if (hoverable) onRunTriggers?.(obj.id, 'onHover');
      }
      if (isAnimatedButton) {
        applyLinkedHoverMotion(event.currentTarget, true);
      }
    };
    const handleObjectMouseLeave = (event) => {
      if (hoverable || obj.stateStyles?.hover) onHoverChange?.(obj.id, false);
      if (isAnimatedButton) {
        applyLinkedHoverMotion(event.currentTarget, false);
      }
    };
    const handleDragPointerDown = canDragObject
      ? (event) => {
          event.preventDefault();
          event.stopPropagation();
          const draggedElement = event.currentTarget;
          draggedElement.style.transition = 'none';
          draggedElement.style.transform = activeDragTransform;
          draggedElement.style.boxShadow = activeDragShadow;
          draggedElement.style.filter = activeDragFilter;
          try {
            draggedElement?.setPointerCapture?.(event.pointerId);
          } catch (error) {
            onDragDebug?.({
              code: 'DD_POINTER_CAPTURE_ERROR',
              level: 'error',
              message: 'Pointer capture alınamadı.',
              data: {
                error: String(error?.message || error),
                pointerId: event.pointerId,
                drag: describeDebugObject(obj),
              },
            });
          }
          onDragStart?.(previewId);
          onDragDebug?.({
            code: 'DD_POINTER_DOWN',
            level: 'info',
            message: `Öğe seçildi: ${displayLabel || previewId}`,
            data: {
              pointerId: event.pointerId,
              clientX: Math.round(event.clientX),
              clientY: Math.round(event.clientY),
              drag: describeDebugObject(obj),
              activeLayerId,
            },
          });
          const capturedStageEl =
            event.currentTarget?.closest?.('[data-preview-stage]') ||
            event.currentTarget?.parentElement ||
            null;
          const capturedStageRect = capturedStageEl?.getBoundingClientRect?.() || null;
          const clientScaleX = capturedStageRect
            ? capturedStageRect.width / Math.max(1, stageWidth)
            : scale;
          const clientScaleY = capturedStageRect
            ? capturedStageRect.height / Math.max(1, stageHeight)
            : scale;
          const clientScale = Math.max(
            0.001,
            Math.min(clientScaleX || scale, clientScaleY || scale)
          );
          const queryRoot = capturedStageEl || (typeof document !== 'undefined' ? document : null);
          const dropTargetRects = !queryRoot
            ? []
            : dropzones
                .map((drop) => {
                  const node = queryRoot.querySelector(
                    `[data-preview-object-id="${drop.__previewId}"]`
                  );
                  const rect = node?.getBoundingClientRect?.();
                  return rect ? { drop, rect } : null;
                })
                .filter(Boolean);
          if (!dropTargetRects.length) {
            onDragDebug?.({
              code: 'DD_DROP_RECTS_EMPTY',
              level: 'warn',
              message: "Bırakma hedefi DOM rect'i bulunamadı.",
              data: {
                dropTargetCount: dropzones.length,
                explicitDropzoneCount: explicitDropzones.length,
                inferredDropTargetCount: inferredDropTargets.length,
                activeLayerId,
              },
            });
          }
          const startClientX = event.clientX;
          const startClientY = event.clientY;
          const startX = objectX;
          const startY = objectY;
          const rect = event.currentTarget?.getBoundingClientRect?.();
          const pointerOffsetX = rect
            ? clamp(
                (event.clientX - rect.left) / Math.max(0.001, clientScale),
                0,
                Number(obj.width) || 1
              )
            : (Number(obj.width) || 1) / 2;
          const pointerOffsetY = rect
            ? clamp(
                (event.clientY - rect.top) / Math.max(0.001, clientScale),
                0,
                Number(obj.height) || 1
              )
            : (Number(obj.height) || 1) / 2;
          let latestX = startX;
          let latestY = startY;
          let latestPointerX = startX + (Number(obj.width) || 1) / 2;
          let latestPointerY = startY + (Number(obj.height) || 1) / 2;
          let latestDrop = null;
          let latestMoveClientX = startClientX;
          let latestMoveClientY = startClientY;
          let moveFrame = 0;
          let moveCount = 0;
          let lastDebugDropId = '';
          const animateDropTarget = (drop) => {
            const dropNode =
              drop &&
              capturedStageEl?.querySelector?.(`[data-preview-object-id="${drop.__previewId}"]`);
            const pulseColor = dragAnimationPreset.pulseColor || '34,197,94';
            dropNode?.animate?.(
              [
                { boxShadow: `0 0 0 0 rgba(${pulseColor},.48)` },
                { boxShadow: `0 0 0 12px rgba(${pulseColor},0)` },
              ],
              {
                duration: Math.max(180, (dragAnimationPreset.settleDuration || 220) + 100),
                easing: 'ease-out',
              }
            );
          };
          const animateSuccessfulSettle = () => {
            if (!draggedElement?.animate) return;
            if ((dragAnimationPreset.settleDuration || 0) <= 1) return;
            const liftedScale = Math.max(1, Number(dragAnimationPreset.activeScale || 1) + 0.02);
            draggedElement.animate(
              [
                { transform: `${baseTransform} scale(${liftedScale})`, filter: 'brightness(1.08)' },
                {
                  transform: `${baseTransform} scale(.99)`,
                  filter: 'brightness(1.02)',
                  offset: 0.72,
                },
                { transform: baseTransform, filter: 'brightness(1)' },
              ],
              {
                duration: Math.max(180, (dragAnimationPreset.settleDuration || 220) + 40),
                easing: 'cubic-bezier(.2,.9,.2,1)',
              }
            );
          };
          const animateReturnSettle = () => {
            if (!draggedElement?.animate) return;
            if ((dragAnimationPreset.returnDuration || 0) <= 1) return;
            draggedElement.animate(
              [
                { transform: `${baseTransform} translateX(0) scale(1.02)` },
                { transform: `${baseTransform} translateX(-8px) scale(1.01)`, offset: 0.3 },
                { transform: `${baseTransform} translateX(7px) scale(1)`, offset: 0.58 },
                { transform: baseTransform },
              ],
              {
                duration: Math.max(180, dragAnimationPreset.returnDuration || 240),
                easing: 'ease-out',
              }
            );
          };
          const prepareSettleTransition = (duration = 220) => {
            if (!draggedElement) return;
            draggedElement.style.transition = `left ${duration}ms cubic-bezier(.2,.82,.2,1), top ${duration}ms cubic-bezier(.2,.82,.2,1), transform 180ms ease, box-shadow 180ms ease, filter 180ms ease`;
            draggedElement.style.transform = baseTransform;
            draggedElement.style.boxShadow =
              settledDragShadow || st.boxShadow || '0 8px 18px rgba(15,23,42,.18)';
            draggedElement.style.filter = 'brightness(1)';
          };
          const applyLivePosition = () => {
            moveFrame = 0;
            if (!draggedElement) return;
            draggedElement.style.left = `${latestX * scale}px`;
            draggedElement.style.top = `${latestY * scale}px`;
          };
          const move = (moveEvent) => {
            latestMoveClientX = Number.isFinite(moveEvent.clientX)
              ? moveEvent.clientX
              : latestMoveClientX;
            latestMoveClientY = Number.isFinite(moveEvent.clientY)
              ? moveEvent.clientY
              : latestMoveClientY;
            const dx = (latestMoveClientX - startClientX) / Math.max(0.001, clientScale);
            const dy = (latestMoveClientY - startClientY) / Math.max(0.001, clientScale);
            latestX = clamp(startX + dx, 0, Math.max(0, stageWidth - (Number(obj.width) || 1)));
            latestY = clamp(startY + dy, 0, Math.max(0, stageHeight - (Number(obj.height) || 1)));
            latestPointerX = latestX + pointerOffsetX;
            latestPointerY = latestY + pointerOffsetY;
            const dragClientRect = getDragClientRect(
              capturedStageRect,
              latestX,
              latestY,
              Number(obj.width) || 1,
              Number(obj.height) || 1,
              clientScale
            );
            latestDrop =
              findCapturedDropTarget(
                dropTargetRects,
                latestMoveClientX,
                latestMoveClientY,
                dragClientRect
              ) ||
              findDropTarget(
                obj,
                latestX,
                latestY,
                latestPointerX,
                latestPointerY,
                latestMoveClientX,
                latestMoveClientY,
                dragClientRect,
                capturedStageEl
              );
            moveCount += 1;
            const nextDebugDropId = latestDrop?.__previewId || latestDrop?.id || '';
            if (moveCount === 1 || nextDebugDropId !== lastDebugDropId || moveCount % 20 === 0) {
              lastDebugDropId = nextDebugDropId;
              onDragDebug?.({
                type: 'live',
                code: nextDebugDropId ? 'DD_TARGET_HOVER' : 'DD_TARGET_NONE',
                level: nextDebugDropId ? 'info' : 'warn',
                message: nextDebugDropId
                  ? `Hedef algılandı: ${latestDrop?.label || latestDrop?.group || latestDrop?.type || 'hedef'}`
                  : 'Henüz hedef algılanmadı.',
                data: {
                  moveCount,
                  x: Math.round(latestX),
                  y: Math.round(latestY),
                  pointerX: Math.round(latestPointerX),
                  pointerY: Math.round(latestPointerY),
                  clientX: Math.round(latestMoveClientX),
                  clientY: Math.round(latestMoveClientY),
                  drop: latestDrop ? describeDebugObject(latestDrop) : null,
                },
              });
            }
            if (!moveFrame && typeof window !== 'undefined') {
              moveFrame = window.requestAnimationFrame(applyLivePosition);
            }
          };
          function finish(upEvent) {
            if (moveFrame && typeof window !== 'undefined') {
              window.cancelAnimationFrame(moveFrame);
              moveFrame = 0;
            }
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', finish);
            window.removeEventListener('pointercancel', cancel);
            draggedElement?.removeEventListener?.('pointermove', move);
            draggedElement?.removeEventListener?.('pointerup', finish);
            draggedElement?.removeEventListener?.('pointercancel', cancel);
            try {
              draggedElement?.releasePointerCapture?.(event.pointerId);
            } catch (error) {
              onDragDebug?.({
                code: 'DD_POINTER_RELEASE_ERROR',
                level: 'error',
                message: 'Pointer capture bırakılamadı.',
                data: { error: String(error?.message || error), pointerId: event.pointerId },
              });
            }
            const finishClientX = Number.isFinite(upEvent?.clientX)
              ? upEvent.clientX
              : latestMoveClientX;
            const finishClientY = Number.isFinite(upEvent?.clientY)
              ? upEvent.clientY
              : latestMoveClientY;
            const finishEvent = upEvent
              ? { ...upEvent, clientX: finishClientX, clientY: finishClientY }
              : null;
            if (upEvent) {
              const dx = (finishClientX - startClientX) / Math.max(0.001, clientScale);
              const dy = (finishClientY - startClientY) / Math.max(0.001, clientScale);
              latestX = clamp(startX + dx, 0, Math.max(0, stageWidth - (Number(obj.width) || 1)));
              latestY = clamp(startY + dy, 0, Math.max(0, stageHeight - (Number(obj.height) || 1)));
              latestPointerX = latestX + pointerOffsetX;
              latestPointerY = latestY + pointerOffsetY;
            }
            const pointerStageX = latestPointerX;
            const pointerStageY = latestPointerY;
            const dragClientRect = capturedStageRect
              ? {
                  left: capturedStageRect.left + latestX * clientScale,
                  top: capturedStageRect.top + latestY * clientScale,
                  right:
                    capturedStageRect.left + (latestX + (Number(obj.width) || 1)) * clientScale,
                  bottom:
                    capturedStageRect.top + (latestY + (Number(obj.height) || 1)) * clientScale,
                }
              : null;
            // Primary: use browser hit-test at pointer release position
            let drop = latestDrop;
            if (!drop && upEvent && typeof document !== 'undefined') {
              const hits = document.elementsFromPoint(finishClientX, finishClientY);
              for (const el of hits) {
                if (el.dataset?.dropTarget === 'true') {
                  drop =
                    dropzones.find((dz) => dz.__previewId === el.dataset.previewObjectId) || null;
                  if (drop) break;
                }
              }
            }
            // Fallback: pointer inside captured rect
            if (!drop && upEvent) {
              drop = findCapturedDropTarget(dropTargetRects, finishClientX, finishClientY, null);
            }
            // Fallback: best overlap between drag rect and captured dropzone rects
            if (!drop && dragClientRect) {
              drop = findCapturedDropTarget(dropTargetRects, null, null, dragClientRect);
            }
            // Last resort: stage-coordinate geometry
            if (!drop)
              drop = findDropTarget(
                obj,
                latestX,
                latestY,
                pointerStageX,
                pointerStageY,
                finishEvent?.clientX,
                finishEvent?.clientY,
                dragClientRect,
                capturedStageEl
              );
            if (!drop)
              drop = findNearestDropTarget(obj, latestX, latestY, pointerStageX, pointerStageY);
            if (drop) {
              const snapPosition = getDropSnapPosition(obj, drop);
              latestX = snapPosition.x;
              latestY = snapPosition.y;
              prepareSettleTransition(dragAnimationPreset.settleDuration || 1);
              applyLivePosition();
              animateSuccessfulSettle();
              animateDropTarget(drop);
              onDragPositionChange?.(obj.id, snapPosition);
              onDropAssign?.(previewId, drop.__previewId || drop.id, snapPosition, {
                dragId: obj.id,
                dropId: drop.id,
              });
              onDragDebug?.({
                code: 'DD_DROP_SUCCESS',
                level: 'success',
                message: `Bırakıldı: ${drop.label || drop.group || drop.type || 'hedef'}`,
                data: {
                  drag: describeDebugObject(obj),
                  drop: describeDebugObject(drop),
                  snapPosition: { x: Math.round(snapPosition.x), y: Math.round(snapPosition.y) },
                  moveCount,
                  finishClientX: Math.round(finishClientX),
                  finishClientY: Math.round(finishClientY),
                },
              });
            } else {
              latestX = startX;
              latestY = startY;
              prepareSettleTransition(dragAnimationPreset.returnDuration || 1);
              applyLivePosition();
              animateReturnSettle();
              onDragPositionChange?.(obj.id, { x: startX, y: startY });
              onDropAssign?.(previewId, '', null, { dragId: obj.id, dropId: '' });
              onDragDebug?.({
                code: 'DD_DROP_FREE',
                level: 'warn',
                message: 'Hedef bulunamadı; öğe başlangıç konumuna döndü.',
                data: {
                  drag: describeDebugObject(obj),
                  returnPosition: { x: Math.round(startX), y: Math.round(startY) },
                  moveCount,
                  dropTargetCount: dropzones.length,
                  finishClientX: Math.round(finishClientX),
                  finishClientY: Math.round(finishClientY),
                },
              });
            }
            onDragEnd?.(previewId);
            if (draggedElement && typeof window !== 'undefined') {
              window.setTimeout(
                () => {
                  draggedElement.style.transition = '';
                  draggedElement.style.transform = '';
                  draggedElement.style.boxShadow = '';
                  draggedElement.style.filter = '';
                },
                Math.max(
                  320,
                  dragAnimationPreset.returnDuration || 1,
                  dragAnimationPreset.settleDuration || 1
                )
              );
            }
          }
          function cancel(cancelEvent) {
            finish(cancelEvent);
          }
          window.addEventListener('pointermove', move);
          window.addEventListener('pointerup', finish);
          window.addEventListener('pointercancel', cancel);
          draggedElement?.addEventListener?.('pointermove', move);
          draggedElement?.addEventListener?.('pointerup', finish);
          draggedElement?.addEventListener?.('pointercancel', cancel);
        }
      : undefined;

    return (
      <div
        key={previewId}
        data-object-id={obj.id}
        data-preview-object-id={previewId}
        data-object-type={isStaticEvidenceDrag ? 'answer-placement' : obj.type || ''}
        data-linked-hover-group={obj.linkedHoverGroup || undefined}
        data-linked-action-target={obj.linkedActionTargetId || undefined}
        data-scene-template-slot-id={obj.sceneTemplateSlotId || undefined}
        data-sound-icon-mode={obj.soundIconMode || undefined}
        data-base-transform={baseTransform}
        data-base-shadow={baseBoxShadow}
        data-base-filter={isActiveDrag ? activeDragFilter : 'brightness(1)'}
        data-answer-static={isStaticEvidenceDrag ? 'true' : undefined}
        data-drop-target={isStorylineDropTargetLikeObject(obj) ? 'true' : undefined}
        data-preview-layer={obj.layerId || 'base'}
        role={accessibility.role}
        aria-label={accessibility.ariaLabel || undefined}
        aria-hidden={accessibility.ariaHidden || undefined}
        tabIndex={accessibility.tabIndex}
        title={undefined}
        onClick={handleStaticEvidenceEvent || (clickable ? handleActivate : undefined)}
        onKeyDown={
          clickable
            ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  handleActivate();
                }
              }
            : undefined
        }
        onMouseEnter={
          hoverable || obj.stateStyles?.hover || isAnimatedButton
            ? handleObjectMouseEnter
            : undefined
        }
        onMouseLeave={
          hoverable || obj.stateStyles?.hover || isAnimatedButton
            ? handleObjectMouseLeave
            : undefined
        }
        onMouseDown={handleStaticEvidenceEvent}
        onPointerDown={
          handleStaticEvidenceEvent || handleDragPointerDown || handleButtonPointerDown
        }
        onPointerUp={handleStaticEvidenceEvent}
        style={{
          position: 'absolute',
          left: objectX * scale,
          top: objectY * scale,
          width: Math.max(1, (Number(obj.width) || 1) * scale),
          height: Math.max(1, (Number(obj.height) || 1) * scale),
          transform: isActiveDrag ? activeDragTransform : baseTransform,
          transformOrigin: 'center',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: isImage || usesShapeSvg ? 'transparent' : st.background || 'transparent',
          border: usesShapeSvg
            ? 'none'
            : `${Math.max(1, Number(st.borderWidth || (obj.type === 'hotspot' ? 2 : 1)))}px ${st.borderStyle || 'solid'} ${st.borderColor || 'transparent'}`,
          borderRadius: usesShapeSvg ? 0 : (Number(st.borderRadius || 0) || 0) * scale,
          boxSizing: 'border-box',
          color: st.color || '#111111',
          fontSize: Math.max(8, (Number(st.fontSize) || 13) * scale),
          fontWeight: obj.type === 'button' || obj.type === 'draggable' ? 800 : 600,
          textDecoration: st.textDecoration || 'none',
          textAlign: st.textAlign || 'center',
          padding:
            isImage || usesShapeSvg
              ? 0
              : `${Math.max(0, Number(st.padding ?? (obj.type === 'text' ? 0 : 6)) * scale)}px`,
          lineHeight: st.lineHeight || (obj.type === 'text' ? 1.22 : 1.15),
          cursor: canDragObject
            ? activeDragId === previewId
              ? 'grabbing'
              : 'grab'
            : clickable
              ? 'pointer'
              : hasNativeInteraction
                ? 'auto'
                : 'default',
          pointerEvents:
            pointerActive || (obj.type === 'dropzone' && !!activeDragId) ? 'auto' : 'none',
          transition: objectTransition,
          zIndex: previewZIndex,
          opacity: runtimeState.disabled ? 0.45 : clamp(Number(st.opacity ?? 1) || 1, 0, 1),
          overflow: usesShapeSvg || evidenceBadge ? 'visible' : 'hidden',
          boxShadow: baseBoxShadow,
          filter: isActiveDrag ? activeDragFilter : 'brightness(1)',
          userSelect: 'none',
          touchAction: canDragObject ? 'none' : 'auto',
        }}
      >
        {isSelectionOverlay ? (
          <span
            style={{
              pointerEvents: 'none',
              fontWeight: 900,
              fontSize: Math.max(18, (Number(st.fontSize) || 13) * scale),
              color: isSelected ? '#16a34a' : 'rgba(37,99,235,.18)',
              display: 'inline-block',
              width: '100%',
              textAlign: 'center',
            }}
          >
            {isSelected ? getSelectionMarkGlyph(selectionMark) : ''}
          </span>
        ) : obj.type === 'video' && obj.mediaUrl ? (
          <RuntimeVideoElement
            obj={obj}
            accessibility={accessibility}
            captionsEnabled={captionsEnabled}
          />
        ) : obj.type === 'audio' && obj.mediaUrl ? null : obj.type === 'embed' && obj.embedUrl ? (
          <iframe
            src={obj.embedUrl}
            title={accessibility.ariaLabel || obj.label || 'Embed'}
            sandbox="allow-scripts allow-forms allow-popups allow-presentation"
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              borderRadius: 'inherit',
              pointerEvents: 'auto',
            }}
          />
        ) : obj.type === 'slider' ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              padding: '0 8px',
            }}
          >
            <input
              type="range"
              min={obj.sliderMin ?? 0}
              max={obj.sliderMax ?? 100}
              step={obj.sliderStep ?? 1}
              defaultValue={obj.sliderValue ?? 50}
              aria-label={accessibility.ariaLabel || obj.label || 'Slider'}
              style={{ width: '100%', accentColor: '#3b82f6', pointerEvents: 'auto' }}
            />
          </div>
        ) : obj.type === 'custom-widget' ? (
          <WidgetHost
            src={buildWidgetIframeSrc({
              widgetId: obj.widget?.widgetId,
              basePath: obj.widget?.basePath,
              entry: obj.widget?.entry,
              entryUrl: obj.widget?.entryUrl,
              instanceId: obj.id,
              props: obj.widget?.props || {},
            })}
            widgetInstanceId={obj.id}
            onEvent={(eventName, payload) => onWidgetEvent?.(obj, eventName, payload)}
            ref={(el) => {
              if (el) widgetRefs?.current?.set(obj.id, el);
              else widgetRefs?.current?.delete(obj.id);
            }}
            style={{ width: '100%', height: '100%', borderRadius: 'inherit' }}
          />
        ) : obj.type === 'shape' ? (
          <>
            <ShapePreviewIcon
              kind={shapeKind}
              fill={st.background || '#0ea5e9'}
              stroke={st.borderColor || '#0284c7'}
              strokeWidth={shapeStrokeWidth}
              strokeLinejoin={st.strokeLinejoin || 'round'}
              strokeLinecap={st.strokeLinecap || 'round'}
              cornerRadius={shapeCornerRadius}
              nonScalingStroke
              fullBleed
              vectorPath={shapeVectorPath}
            />
            {showShapeLabel && (
              <span
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                  padding: '0 8px',
                  color: st.color || '#111111',
                }}
              >
                {renderedDisplayLabel}
              </span>
            )}
          </>
        ) : obj.type === 'table' ? (
          <div
            style={{ pointerEvents: 'none', width: '100%', height: '100%', overflow: 'auto' }}
            dangerouslySetInnerHTML={{
              __html: buildTableHtml(obj, { fontSize: (st.fontSize || 14) * scale }),
            }}
          />
        ) : obj.type === 'chart' ? (
          <div
            style={{ pointerEvents: 'none', width: '100%', height: '100%' }}
            dangerouslySetInnerHTML={{ __html: buildChartSvg(obj) }}
          />
        ) : isImage ? (
          <img
            src={obj.imageData}
            alt={obj.accessibility?.altText || accessibility.ariaLabel || obj.label || obj.type}
            style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }}
          />
        ) : obj.icon?.svg && obj.iconPosition && obj.iconPosition !== 'none' ? (
          <span
            style={{
              pointerEvents: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: obj.iconPosition === 'only' ? 0 : '.4em',
              padding: '0 6px',
              width: '100%',
            }}
          >
            {(obj.iconPosition === 'left' || obj.iconPosition === 'only') && (
              <span
                style={{ width: '1.15em', height: '1.15em', flexShrink: 0, display: 'inline-flex' }}
                dangerouslySetInnerHTML={{ __html: sanitizeSvgMarkup(obj.icon.svg) }}
              />
            )}
            {obj.iconPosition !== 'only' && <span>{renderedDisplayLabel}</span>}
            {obj.iconPosition === 'right' && (
              <span
                style={{ width: '1.15em', height: '1.15em', flexShrink: 0, display: 'inline-flex' }}
                dangerouslySetInnerHTML={{ __html: sanitizeSvgMarkup(obj.icon.svg) }}
              />
            )}
          </span>
        ) : (
          <span
            style={{
              pointerEvents: 'none',
              color: st.color || '#111111',
              maxWidth: '100%',
              overflow: 'hidden',
              textOverflow: st.whiteSpace === 'pre-line' ? 'clip' : 'ellipsis',
              whiteSpace: st.whiteSpace || 'nowrap',
              lineHeight: 'inherit',
              padding: 0,
              display: 'inline-block',
              width: '100%',
              textAlign: 'center',
            }}
          >
            {renderedDisplayLabel}
          </span>
        )}
        {evidenceBadge && (
          <span
            aria-hidden="true"
            title={evidenceBadge.label}
            style={{
              position: 'absolute',
              right: -(evidenceBadgeSize / 2),
              top: '50%',
              width: evidenceBadgeSize,
              height: evidenceBadgeSize,
              transform: 'translateY(-50%)',
              borderRadius: 999,
              background: evidenceBadge.bg,
              color: '#ffffff',
              border: `${Math.max(2, 2 * scale)}px solid #ffffff`,
              boxShadow: `0 8px 18px rgba(15,23,42,.24), 0 0 0 ${Math.max(2, 3 * scale)}px ${evidenceBadge.ring}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: Math.max(13, evidenceBadgeSize * 0.7),
              fontWeight: 950,
              lineHeight: 1,
              pointerEvents: 'none',
              zIndex: 2,
            }}
          >
            {evidenceBadge.glyph}
          </span>
        )}
      </div>
    );
  });
}

function StorylinePreviewSharedRuntimeStage({
  activity,
  stageRef,
  activeLayerId,
  hiddenObjectIds,
  objectStates = {},
  dragPositions = {},
  dropAssignments = {},
  runtimeVariables = {},
  runtimeMuted = false,
  scale = 1,
  displayWidth = 0,
  displayHeight = 0,
  stageBackgroundColor = '#ffffff',
  onRunTriggers,
  onHoverChange,
  onDragStart,
  onDragEnd,
  onDragPositionChange,
  onDropAssign,
  onDragDebug,
  onMediaEndAction,
  onPointerDownCapture,
}) {
  const runtimeApi = useMemo(() => getSharedStorylineRendererRuntimeApi(), []);
  const hiddenMap = useMemo(
    () => Object.fromEntries([...(hiddenObjectIds || [])].map((id) => [id, true])),
    [hiddenObjectIds]
  );
  const hasExplicitLayerBackdrop = useMemo(() => {
    if (!activity || !activeLayerId || activeLayerId === 'base') return false;
    const stageWidth = Number(activity?.stageWidth) || 1920;
    const stageHeight = Number(activity?.stageHeight) || 1080;
    return (activity.objects || []).some((object) => {
      const layerId = object?.layerId || 'base';
      if (layerId !== activeLayerId || object?.type !== 'shape' || object?.visible === false)
        return false;
      const bg = String(object?.style?.background || '').toLowerCase();
      const coversStage =
        (Number(object?.x) || 0) <= 2 &&
        (Number(object?.y) || 0) <= 2 &&
        (Number(object?.width) || 0) >= stageWidth - 2 &&
        (Number(object?.height) || 0) >= stageHeight - 2;
      const darkBackdrop =
        bg.includes('rgba(0,0,0') ||
        bg.includes('rgba(15,23,42') ||
        bg === '#000' ||
        bg === '#000000';
      const alphaMatch = bg.match(/rgba\([^)]*,\s*([.\d]+)\s*\)/);
      const alpha = alphaMatch ? Number(alphaMatch[1]) : 1;
      return coversStage && darkBackdrop && alpha >= 0.05;
    });
  }, [activeLayerId, activity]);

  useEffect(() => {
    const stage = stageRef?.current;
    if (!stage || !activity) return undefined;

    const runtimeState = {
      activeLayerId,
      hidden: { ...hiddenMap },
      objectStates: { ...(objectStates || {}) },
      dragPositions: { ...(dragPositions || {}) },
      dropAssignments: { ...(dropAssignments || {}) },
      variables: { ...(runtimeVariables || {}) },
      muted: !!runtimeMuted,
    };

    const allObjects = Array.isArray(activity.objects) ? activity.objects : [];
    const activeDragRef = { current: '' };
    const visibleObjects = runtimeApi.storylineRendererVisibleObjects({
      slide: activity,
      state: runtimeState,
    });
    const byKey = Object.fromEntries(
      visibleObjects.map((object) => [runtimeApi.storylineRendererObjectKey(object), object])
    );
    const byId = Object.fromEntries(
      allObjects.filter((object) => object?.id).map((object) => [object.id, object])
    );
    const resolveObject = (key = '') => byKey[key] || byId[key] || null;
    const resolveActualId = (key = '') => resolveObject(key)?.id || key || '';

    onDragDebug?.({
      type: 'summary',
      code: 'DD_SUMMARY_SHARED_RUNTIME',
      level: visibleObjects.some(runtimeApi.storylineRendererIsDropTargetLike) ? 'info' : 'warn',
      message: `${visibleObjects.filter((object) => object.type === 'draggable').length} sürüklenebilir, ${visibleObjects.filter(runtimeApi.storylineRendererIsDropTargetLike).length} bırakma hedefi`,
      data: {
        objectCount: visibleObjects.length,
        draggableCount: visibleObjects.filter((object) => object.type === 'draggable').length,
        dropTargetCount: visibleObjects.filter(runtimeApi.storylineRendererIsDropTargetLike).length,
        activeLayerId,
        sharedDomRuntime: true,
      },
    });

    const syncRuntimeDragState = () => {
      const runtimeVisibleObjects = runtimeApi.storylineRendererVisibleObjects({
        slide: activity,
        state: runtimeState,
      });
      const runtimeByKey = Object.fromEntries(
        runtimeVisibleObjects.map((object) => [
          runtimeApi.storylineRendererObjectKey(object),
          object,
        ])
      );
      const resolveRuntimeObject = (key = '') => runtimeByKey[key] || byId[key] || null;
      const dragKeys = new Set([
        ...Object.keys(dragPositions || {}),
        ...Object.keys(runtimeState.dragPositions || {}),
        ...Object.keys(dropAssignments || {}),
        ...Object.keys(runtimeState.dropAssignments || {}),
      ]);

      dragKeys.forEach((dragKey) => {
        const dragObject = resolveRuntimeObject(dragKey);
        const actualDragId = dragObject?.id || dragKey;
        const previousPosition = dragPositions[actualDragId] || dragPositions[dragKey] || null;
        const nextPosition =
          runtimeState.dragPositions[dragKey] || runtimeState.dragPositions[actualDragId] || null;
        const normalizedNextPosition = nextPosition
          ? {
              x: Number(nextPosition.x) || 0,
              y: Number(nextPosition.y) || 0,
            }
          : null;

        if (normalizedNextPosition) {
          const changed =
            !previousPosition ||
            (Number(previousPosition.x) || 0) !== normalizedNextPosition.x ||
            (Number(previousPosition.y) || 0) !== normalizedNextPosition.y;
          if (changed) onDragPositionChange?.(actualDragId, normalizedNextPosition);
        } else if (previousPosition && dragObject) {
          const fallbackPosition = {
            x: Number(dragObject.x) || 0,
            y: Number(dragObject.y) || 0,
          };
          if (
            (Number(previousPosition.x) || 0) !== fallbackPosition.x ||
            (Number(previousPosition.y) || 0) !== fallbackPosition.y
          ) {
            onDragPositionChange?.(actualDragId, fallbackPosition);
          }
        }

        const previousDropId = resolveActualId(
          dropAssignments[actualDragId] || dropAssignments[dragKey] || ''
        );
        const nextDropKey =
          runtimeState.dropAssignments[dragKey] || runtimeState.dropAssignments[actualDragId] || '';
        const nextDropObject = resolveRuntimeObject(nextDropKey);
        const nextDropId = nextDropObject?.id || nextDropKey || '';
        if (previousDropId === nextDropId) return;
        if (nextDropId) {
          onDropAssign?.(actualDragId, nextDropId, normalizedNextPosition, {
            dragId: actualDragId,
            dropId: nextDropId,
          });
        } else {
          onDropAssign?.(actualDragId, '', null, {
            dragId: actualDragId,
            dropId: '',
          });
        }
      });
    };

    runtimeApi.storylineRenderSlide({
      slide: activity,
      state: runtimeState,
      stage,
      replaceVars: (value) =>
        String(value == null ? '' : value).replace(
          /\{\{\s*([^}]+?)\s*\}\}/g,
          (match, name) => runtimeState.variables[name] ?? match
        ),
      attachRuntime: true,
      afterInteraction: () => {
        syncRuntimeDragState();
        if (activeDragRef.current) {
          onDragEnd?.(activeDragRef.current);
          activeDragRef.current = '';
        }
      },
      isInteractive: (object) => {
        const triggers = activity.triggers || [];
        const actionSourceIds = [
          object.id,
          object.linkedActionTargetId,
          ...(object.linkedHoverGroup
            ? (activity.objects || [])
                .filter(
                  (item) =>
                    String(item.linkedHoverGroup || '').trim() ===
                    String(object.linkedHoverGroup || '').trim()
                )
                .map((item) => item.id)
            : []),
        ].filter(Boolean);
        const hasExplicitClickTrigger = triggers.some(
          (trigger) =>
            (trigger.when || 'onClick') === 'onClick' &&
            actionSourceIds.some((sourceId) => getTriggerSourceMatches(trigger, sourceId))
        );
        const isLaunchTemplateObject =
          object?.generatedBy === 'scene-template' &&
          object?.sceneTemplateId === SCENE_TEMPLATE_LAUNCH_PAGE_ID;
        if (
          isLaunchTemplateObject &&
          !isLaunchInteractiveSlot(object) &&
          !hasExplicitClickTrigger &&
          !getRuntimeButtonAction(object)
        ) {
          // Launch page should only respond on intro/start controls unless the editor assigns an explicit task.
          return false;
        }
        const isButtonIntroTemplateObject =
          object?.generatedBy === 'scene-template' &&
          object?.sceneTemplateId === SCENE_TEMPLATE_BUTTON_INTRO_ID;
        if (isButtonIntroTemplateObject && !isButtonIntroInteractiveSlot(object)) {
          return isButtonIntroDemoButton(object);
        }
        return (
          !!object.selectionQuestionId ||
          runtimeApi.storylineRendererIsCheckButton(object) ||
          object.type === 'draggable' ||
          runtimeApi.storylineRendererIsDropTargetLike(object) ||
          isButtonIntroDemoButton(object) ||
          !!getRuntimeButtonAction(object) ||
          hasExplicitClickTrigger
        );
      },
    });

    const audioObjects = runtimeApi
      .storylineRendererVisibleObjects({ slide: activity, state: runtimeState })
      .filter((object) => object?.type === 'audio' && object.mediaUrl);
    audioObjects.forEach((object) => {
      const mediaKey = runtimeApi.storylineRendererObjectKey(object);
      const hasExplicitMediaTrigger = (activity.triggers || []).some((trigger) => {
        const when = trigger.when || 'onClick';
        return (
          trigger.value === object.id ||
          trigger.target === object.id ||
          ((when === 'onMediaEnd' || when === 'onMediaStart') &&
            (trigger.target === object.id || trigger.target === mediaKey))
        );
      });
      const audio = document.createElement('audio');
      audio.dataset.runtimeAudio = 'true';
      audio.dataset.mediaObjectId = object.id || '';
      audio.dataset.mediaRuntimeKey = mediaKey;
      audio.src = object.mediaUrl;
      audio.preload = 'auto';
      audio.loop = !!object.loop;
      audio.muted = !!runtimeState.muted || !!object.muted;
      audio.style.display = 'none';
      audio.addEventListener('ended', () => {
        onRunTriggers?.(object.id, 'onMediaEnd');
        onMediaEndAction?.(object);
      });
      audio.addEventListener('play', () => onRunTriggers?.(object.id, 'onMediaStart'));
      stage.appendChild(audio);
      if (object.autoPlay === true || !hasExplicitMediaTrigger) {
        const result = audio.play?.();
        if (result?.catch) result.catch(() => {});
      }
    });

    const removers = [];
    const addListener = (node, type, handler) => {
      node.addEventListener(type, handler);
      removers.push(() => node.removeEventListener(type, handler));
    };

    stage.querySelectorAll('.obj').forEach((node) => {
      const sourceId = node.dataset.objectId || node.dataset.sourceId || node.dataset.id || '';
      if (!sourceId) return;
      if (node.dataset.interactive === 'true') {
        const getLinkedActionSourceIds = () => {
          const ids = [sourceId];
          const explicitTarget = String(node.dataset.linkedActionTarget || '').trim();
          if (explicitTarget) ids.push(explicitTarget);
          const linkedGroup = String(node.dataset.linkedHoverGroup || '').trim();
          if (linkedGroup) {
            const linkedNodes = Array.from(
              stage.querySelectorAll(`[data-linked-hover-group="${linkedGroup}"]`)
            );
            const labelNode =
              linkedNodes.find((item) =>
                String(item.dataset.sceneTemplateSlotId || '').endsWith('-label')
              ) ||
              linkedNodes.find((item) => String(item.dataset.soundIconMode || '') === 'external') ||
              linkedNodes.find(
                (item) => Number(item.offsetWidth || 0) >= Number(node.offsetWidth || 0)
              );
            ids.push(
              labelNode?.dataset.objectId ||
                labelNode?.dataset.sourceId ||
                labelNode?.dataset.id ||
                ''
            );
            linkedNodes.forEach((item) =>
              ids.push(item.dataset.objectId || item.dataset.sourceId || item.dataset.id || '')
            );
          }
          return [...new Set(ids.filter(Boolean))];
        };
        addListener(node, 'click', (event) => {
          event.stopPropagation();
          onRunTriggers?.(getLinkedActionSourceIds(), 'onClick');
        });
        const getLinkedHoverSourceIds = () => {
          const linkedGroup = String(node.dataset.linkedHoverGroup || '').trim();
          if (!linkedGroup) return [sourceId];
          const linkedNodes = Array.from(
            stage.querySelectorAll(`[data-linked-hover-group="${linkedGroup}"]`)
          );
          const linkedIds = linkedNodes
            .map((item) => item.dataset.objectId || item.dataset.sourceId || item.dataset.id || '')
            .filter(Boolean);
          return linkedIds.length ? [...new Set(linkedIds)] : [sourceId];
        };
        addListener(node, 'mouseenter', () => {
          getLinkedHoverSourceIds().forEach((id) => {
            onHoverChange?.(id, true);
            onRunTriggers?.(id, 'onHover');
          });
        });
        addListener(node, 'mouseleave', () => {
          getLinkedHoverSourceIds().forEach((id) => onHoverChange?.(id, false));
        });
      }
      if (node.dataset.objectType === 'draggable') {
        addListener(node, 'pointerdown', () => {
          activeDragRef.current = sourceId;
          onDragStart?.(sourceId);
        });
      }
    });

    return () => {
      removers.forEach((remove) => remove());
    };
  }, [
    activeLayerId,
    activity,
    dragPositions,
    dropAssignments,
    hiddenMap,
    objectStates,
    onDragDebug,
    onDragEnd,
    onDragPositionChange,
    onDragStart,
    onDropAssign,
    onHoverChange,
    onMediaEndAction,
    onRunTriggers,
    runtimeApi,
    runtimeMuted,
    runtimeVariables,
    hasExplicitLayerBackdrop,
    stageRef,
  ]);

  return (
    <div
      style={{
        width: displayWidth,
        height: displayHeight,
        position: 'relative',
        background: stageBackgroundColor,
        overflow: 'hidden',
        boxShadow: '0 2px 0 rgba(255,255,255,.55), 0 18px 46px rgba(15,23,42,.35)',
        border: '1px solid rgba(71,85,105,.45)',
      }}
    >
      <div
        ref={stageRef}
        data-preview-stage="true"
        onPointerDownCapture={onPointerDownCapture}
        style={{
          width: Number(activity?.stageWidth) || 1920,
          height: Number(activity?.stageHeight) || 1080,
          position: 'absolute',
          left: 0,
          top: 0,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          overflow: 'hidden',
          background: stageBackgroundColor,
        }}
      />
    </div>
  );
}

export function StorylineSystemPreview({ open, onClose, activity, activities = [], variables = [] }) {
  const frameRef = useRef(null);
  const stageRef = useRef(null);
  const previewActivities = useMemo(() => {
    const source =
      Array.isArray(activities) && activities.length ? activities : activity ? [activity] : [];
    return source.filter(Boolean);
  }, [activities, activity]);
  const [viewport, setViewport] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1280,
    height: typeof window !== 'undefined' ? window.innerHeight : 720,
  }));
  const [frameSize, setFrameSize] = useState({ width: 960, height: 540 });
  const [selectedActivityId, setSelectedActivityId] = useState(
    () => activity?.id || previewActivities[0]?.id || ''
  );
  const selectedActivity =
    previewActivities.find((item) => item.id === selectedActivityId) ||
    previewActivities[0] ||
    activity ||
    null;
  const slides = useMemo(() => getActivitySlides(selectedActivity || {}), [selectedActivity]);
  const [selectedSlideId, setSelectedSlideId] = useState(() => slides[0]?.id || '');
  const currentSlide = slides.find((slide) => slide.id === selectedSlideId) || slides[0] || null;
  const previewActivity = useMemo(
    () =>
      selectedActivity
        ? materializeActivitySlide(selectedActivity, currentSlide?.id || selectedSlideId)
        : null,
    [currentSlide?.id, selectedActivity, selectedSlideId]
  );
  const layers = useMemo(() => getActivityLayers(previewActivity || {}), [previewActivity]);
  const [selectedLayerId, setSelectedLayerId] = useState('base');
  const [hiddenObjectIds, setHiddenObjectIds] = useState(() => new Set());
  const [objectStates, setObjectStates] = useState({});
  const [dragPositions, setDragPositions] = useState({});
  const [activeDragId, setActiveDragId] = useState('');
  const [dropAssignments, setDropAssignments] = useState({});
  const [, setDragDebug] = useState({ summary: {}, live: null, logs: [] });
  const [runtimeVariables, setRuntimeVariables] = useState(() =>
    buildRuntimeVariableMap(variables)
  );
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [runtimeMuted, setRuntimeMuted] = useState(false);
  const previewOpenedRef = useRef(false);
  const previewRuntimeResetRef = useRef(false);
  const dragRuntimeDebugStateRef = useRef({ signature: '', positionCount: 0, assignmentCount: 0 });
  const persistentDragPositionsRef = useRef({});
  const persistentDropAssignmentsRef = useRef({});
  const activeLayerId = layers.some((layer) => layer.id === selectedLayerId)
    ? selectedLayerId
    : layers.some((layer) => layer.id === 'base')
      ? 'base'
      : layers[0]?.id || 'base';
  const stageWidth = Number(previewActivity?.stageWidth) || 1920;
  const stageHeight = Number(previewActivity?.stageHeight) || 1080;
  const scale = getFitScale(
    stageWidth,
    stageHeight,
    Math.max(260, frameSize.width - 24),
    Math.max(180, frameSize.height - 24)
  );
  const displayWidth = Math.round(stageWidth * scale);
  const displayHeight = Math.round(stageHeight * scale);
  const isPhonePortrait = viewport.width <= 820 && viewport.height > viewport.width;
  const isCompactPreview = viewport.width <= 980;
  const activityIndex = Math.max(
    0,
    previewActivities.findIndex((item) => item.id === selectedActivity?.id)
  );
  const slideIndex = Math.max(
    0,
    slides.findIndex((slide) => slide.id === currentSlide?.id)
  );
  const previewScopeKey = `${selectedActivity?.id || selectedActivityId || 'activity'}::${currentSlide?.id || selectedSlideId || 'slide'}`;
  const effectiveDragPositions = useMemo(
    () => ({
      ...((persistentDragPositionsRef.current &&
        persistentDragPositionsRef.current[previewScopeKey]) ||
        {}),
      ...(dragPositions || {}),
    }),
    [dragPositions, previewScopeKey]
  );
  const effectiveDropAssignments = useMemo(
    () => ({
      ...((persistentDropAssignmentsRef.current &&
        persistentDropAssignmentsRef.current[previewScopeKey]) ||
        {}),
      ...(dropAssignments || {}),
    }),
    [dropAssignments, previewScopeKey]
  );
  const positionedPreviewObjects = useMemo(() => {
    if (!Array.isArray(previewActivity?.objects)) return [];
    return previewActivity.objects.map((object) => {
      let nextObject =
        runtimeMuted && (object?.type === 'video' || object?.type === 'audio')
          ? { ...object, muted: true }
          : object;
      const position = object?.type === 'draggable' ? effectiveDragPositions[object.id] : null;
      if (!position) return nextObject;
      return {
        ...nextObject,
        x: Number(position.x) || 0,
        y: Number(position.y) || 0,
        zIndex: Math.max(Number(object.zIndex) || 0, 9000),
      };
    });
  }, [effectiveDragPositions, previewActivity, runtimeMuted]);
  useEffect(() => {
    if (!open) return undefined;
    const handleResize = () =>
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const node = frameRef.current;
    if (!node) return undefined;
    const updateSize = () =>
      setFrameSize({ width: node.clientWidth || 960, height: node.clientHeight || 540 });
    updateSize();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateSize);
      return () => window.removeEventListener('resize', updateSize);
    }
    const observer = new ResizeObserver(updateSize);
    observer.observe(node);
    return () => observer.disconnect();
  }, [open, isPhonePortrait]);

  useEffect(() => {
    if (!open) {
      previewOpenedRef.current = false;
      return;
    }
    if (previewOpenedRef.current || !previewActivities.length) return;
    previewOpenedRef.current = true;
    const startActivity =
      previewActivities.find((item) => item.id === activity?.id) || previewActivities[0];
    const startSlides = getActivitySlides(startActivity || {});
    const startSlideId = startSlides[0]?.id || '';
    setSelectedActivityId(startActivity?.id || '');
    setSelectedSlideId(startSlideId);
    setSelectedLayerId('base');
  }, [activity?.id, open, previewActivities]);

  useEffect(() => {
    if (!open || !previewActivities.length) return;
    if (!previewActivities.some((item) => item.id === selectedActivityId)) {
      const fallbackActivity =
        previewActivities.find((item) => item.id === activity?.id) || previewActivities[0];
      const fallbackSlides = getActivitySlides(fallbackActivity || {});
      const fallbackSlideId = fallbackSlides[0]?.id || '';
      setSelectedActivityId(fallbackActivity?.id || '');
      setSelectedSlideId(fallbackSlideId);
      setSelectedLayerId('base');
    }
  }, [activity?.id, open, previewActivities, selectedActivityId]);

  useEffect(() => {
    if (!open || !selectedActivity) return;
    const nextSlides = getActivitySlides(selectedActivity);
    const preferredId = nextSlides[0]?.id || '';
    if (!nextSlides.some((slide) => slide.id === selectedSlideId)) {
      setSelectedSlideId(preferredId);
    }
  }, [open, selectedActivity, selectedSlideId]);

  useEffect(() => {
    if (!open || !previewActivity) return;
    if (!layers.some((layer) => layer.id === selectedLayerId)) {
      setSelectedLayerId(
        layers.some((layer) => layer.id === 'base') ? 'base' : layers[0]?.id || 'base'
      );
    }
  }, [layers, open, previewActivity, selectedLayerId]);

  useEffect(() => {
    if (!open) {
      previewRuntimeResetRef.current = false;
      return;
    }
    if (previewRuntimeResetRef.current) return;
    previewRuntimeResetRef.current = true;
    persistentDragPositionsRef.current = {};
    persistentDropAssignmentsRef.current = {};
    dragRuntimeDebugStateRef.current = { signature: '', positionCount: 0, assignmentCount: 0 };
    setHiddenObjectIds(new Set());
    setObjectStates({});
    setDragPositions({});
    setActiveDragId('');
    setDropAssignments({});
    setDragDebug((current) => {
      const resetLog = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        time: new Date().toLocaleTimeString('tr-TR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        code: 'DD_RUNTIME_RESET',
        level: 'info',
        message: "Önizleme runtime state'i açılış için temizlendi.",
        data: { reason: 'open-transition' },
      };
      return {
        ...current,
        summary: {},
        live: null,
        logs: [resetLog, ...(current.logs || [])].slice(0, 120),
      };
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setRuntimeVariables(buildRuntimeVariableMap(variables));
  }, [open, variables]);

  const handleDragDebug = useCallback((entry = {}) => {
    const code = entry.code || 'DD_EVENT';
    const level = entry.level || 'info';
    const normalized = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      time: new Date().toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      code,
      level,
      message: entry.message || '',
      data: entry.data || null,
    };
    setDragDebug((current) => {
      if (entry.type === 'summary') {
        return {
          ...current,
          summary: { ...(current.summary || {}), ...(entry.data || {}) },
          summaryCode: code,
          summaryLevel: level,
          summaryMessage: entry.message || '',
        };
      }
      if (entry.type === 'dom-summary') {
        const nextSummary = { ...(current.summary || {}), ...(entry.data || {}) };
        const nextLog = normalized;
        const shouldLog = entry.log !== false;
        return {
          ...current,
          summary: nextSummary,
          live: current.live || normalized,
          logs: shouldLog ? [nextLog, ...(current.logs || [])].slice(0, 120) : current.logs || [],
        };
      }
      if (entry.type === 'live') {
        return { ...current, live: normalized };
      }
      return {
        ...current,
        live: normalized,
        logs: [normalized, ...(current.logs || [])].slice(0, 120),
      };
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    const positionKeys = Object.keys(dragPositions || {}).sort();
    const assignmentKeys = Object.keys(dropAssignments || {}).sort();
    const signature = `${positionKeys.join('|')}::${assignmentKeys.join('|')}`;
    const previous = dragRuntimeDebugStateRef.current || {
      signature: '',
      positionCount: 0,
      assignmentCount: 0,
    };
    if (signature === previous.signature) return;
    const positionCount = positionKeys.length;
    const assignmentCount = assignmentKeys.length;
    dragRuntimeDebugStateRef.current = { signature, positionCount, assignmentCount };
    if (positionCount || assignmentCount) {
      if (positionCount) {
        persistentDragPositionsRef.current = {
          ...(persistentDragPositionsRef.current || {}),
          [previewScopeKey]: {
            ...((persistentDragPositionsRef.current &&
              persistentDragPositionsRef.current[previewScopeKey]) ||
              {}),
            ...(dragPositions || {}),
          },
        };
      }
      if (assignmentCount) {
        persistentDropAssignmentsRef.current = {
          ...(persistentDropAssignmentsRef.current || {}),
          [previewScopeKey]: {
            ...((persistentDropAssignmentsRef.current &&
              persistentDropAssignmentsRef.current[previewScopeKey]) ||
              {}),
            ...(dropAssignments || {}),
          },
        };
      }
      const mergedDragPositions = {
        ...((persistentDragPositionsRef.current &&
          persistentDragPositionsRef.current[previewScopeKey]) ||
          {}),
      };
      const mergedDropAssignments = {
        ...((persistentDropAssignmentsRef.current &&
          persistentDropAssignmentsRef.current[previewScopeKey]) ||
          {}),
      };
      handleDragDebug({
        code: 'DD_STATE_COMMIT',
        level: 'success',
        message: `Drag/drop state commit: ${Object.keys(mergedDragPositions).length} konum, ${Object.keys(mergedDropAssignments).length} eşleşme.`,
        data: {
          positionKeys: Object.keys(mergedDragPositions).sort(),
          assignmentKeys: Object.keys(mergedDropAssignments).sort(),
          dragPositions: mergedDragPositions,
          dropAssignments: mergedDropAssignments,
        },
      });
      return;
    }
    if (previous.positionCount || previous.assignmentCount) {
      const fallbackPositions =
        (persistentDragPositionsRef.current &&
          persistentDragPositionsRef.current[previewScopeKey]) ||
        {};
      const fallbackAssignments =
        (persistentDropAssignmentsRef.current &&
          persistentDropAssignmentsRef.current[previewScopeKey]) ||
        {};
      if (Object.keys(fallbackPositions).length || Object.keys(fallbackAssignments).length) {
        handleDragDebug({
          code: 'DD_STATE_RESTORED',
          level: 'warn',
          message: 'Drag/drop state boşaldı; son başarılı bırakma konumu geri yüklendi.',
          data: { previous, fallbackPositions, fallbackAssignments },
        });
        setDragPositions(fallbackPositions);
        setDropAssignments(fallbackAssignments);
        return;
      }
      handleDragDebug({
        code: 'DD_STATE_CLEARED',
        level: 'warn',
        message: 'Drag/drop state boşaltıldı.',
        data: { previous },
      });
    }
  }, [dragPositions, dropAssignments, handleDragDebug, open, previewScopeKey]);

  const handleStagePointerDownCapture = useCallback(
    (event) => {
      const target = event.target;
      const element = target?.nodeType === 1 ? target : target?.parentElement;
      const draggableEl = element?.closest?.('[data-object-type="draggable"]') || null;
      const dropEl =
        element?.closest?.('[data-drop-target="true"], [data-object-type="dropzone"]') || null;
      const stageEl = stageRef.current;
      const targetStyle =
        element && typeof window !== 'undefined' ? window.getComputedStyle(element) : null;
      const dragStyle =
        draggableEl && typeof window !== 'undefined' ? window.getComputedStyle(draggableEl) : null;
      const stageRect = stageEl?.getBoundingClientRect?.();
      const targetRect = element?.getBoundingClientRect?.();
      const dragRect = draggableEl?.getBoundingClientRect?.();
      const toStagePoint = (clientX, clientY) =>
        stageRect
          ? {
              x: Math.round((clientX - stageRect.left) / Math.max(0.001, scale)),
              y: Math.round((clientY - stageRect.top) / Math.max(0.001, scale)),
            }
          : null;
      const rectSummary = (rect) =>
        rect
          ? {
              left: Math.round(rect.left),
              top: Math.round(rect.top),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            }
          : null;

      handleDragDebug({
        code: draggableEl ? 'DD_STAGE_POINTER_ON_DRAGGABLE' : 'DD_STAGE_POINTER_MISS',
        level: draggableEl ? 'info' : 'warn',
        message: draggableEl
          ? 'Sahne pointerdown: draggable üstünde.'
          : 'Sahne pointerdown: draggable yakalanmadı.',
        data: {
          clientX: Math.round(event.clientX),
          clientY: Math.round(event.clientY),
          stagePoint: toStagePoint(event.clientX, event.clientY),
          pointerId: event.pointerId,
          pointerType: event.pointerType,
          target: {
            tag: String(element?.tagName || '').toLowerCase(),
            text: String(element?.textContent || '')
              .replace(/\s+/g, ' ')
              .trim()
              .slice(0, 100),
            objectType: element?.dataset?.objectType || '',
            previewObjectId: element?.dataset?.previewObjectId || '',
            dropTarget: element?.dataset?.dropTarget || '',
            pointerEvents: targetStyle?.pointerEvents || '',
            zIndex: targetStyle?.zIndex || '',
            rect: rectSummary(targetRect),
          },
          draggable: draggableEl
            ? {
                text: String(draggableEl.textContent || '')
                  .replace(/\s+/g, ' ')
                  .trim()
                  .slice(0, 100),
                objectId: draggableEl.dataset?.objectId || '',
                previewObjectId: draggableEl.dataset?.previewObjectId || '',
                pointerEvents: dragStyle?.pointerEvents || '',
                zIndex: dragStyle?.zIndex || '',
                rect: rectSummary(dragRect),
              }
            : null,
          dropTarget: dropEl
            ? {
                objectId: dropEl.dataset?.objectId || '',
                previewObjectId: dropEl.dataset?.previewObjectId || '',
                objectType: dropEl.dataset?.objectType || '',
                dropTarget: dropEl.dataset?.dropTarget || '',
              }
            : null,
        },
      });
    },
    [handleDragDebug, scale]
  );

  const scanPreviewStageDragDrop = useCallback(() => {
    const stage = stageRef.current;
    if (!stage || typeof window === 'undefined') return;
    const stageRect = stage.getBoundingClientRect?.();
    if (!stageRect) return;
    const nodes = [...stage.querySelectorAll('*')];
    const reactDraggables = stage.querySelectorAll('[data-object-type="draggable"]').length;
    const reactDropTargets = stage.querySelectorAll(
      '[data-drop-target="true"], [data-object-type="dropzone"]'
    ).length;
    const toStageBox = (rect) => ({
      x: Math.round((rect.left - stageRect.left) / Math.max(0.001, scale)),
      y: Math.round((rect.top - stageRect.top) / Math.max(0.001, scale)),
      width: Math.round(rect.width / Math.max(0.001, scale)),
      height: Math.round(rect.height / Math.max(0.001, scale)),
    });
    const hasColor = (text, kind) => {
      const raw = String(text || '').toLowerCase();
      if (kind === 'orange' && /#ea5b0c|#f97316|#fb923c|#f26a21|orange/.test(raw)) return true;
      if (kind === 'blue' && /#1d4ed8|#2563eb|#005c98|#2b50d8|blue/.test(raw)) return true;
      const matches = [...raw.matchAll(/rgba?\((\d+),\s*(\d+),\s*(\d+)/g)];
      return matches.some((match) => {
        const r = Number(match[1]);
        const g = Number(match[2]);
        const b = Number(match[3]);
        if (kind === 'orange') return r >= 180 && g >= 45 && g <= 150 && b <= 90;
        return b >= 130 && r <= 110 && g <= 180;
      });
    };
    const summarizeNode = (node, rect) => {
      const box = toStageBox(rect);
      const text = String(node.textContent || '')
        .replace(/\s+/g, ' ')
        .trim();
      return {
        tag: String(node.tagName || '').toLowerCase(),
        id: node.id || '',
        className: typeof node.className === 'string' ? node.className.slice(0, 80) : '',
        text: text.slice(0, 90),
        ...box,
      };
    };
    const visualDrags = [];
    const visualDrops = [];

    nodes.forEach((node) => {
      const rect = node.getBoundingClientRect?.();
      if (!rect || rect.width < 80 || rect.height < 18) return;
      if (
        rect.right < stageRect.left ||
        rect.left > stageRect.right ||
        rect.bottom < stageRect.top ||
        rect.top > stageRect.bottom
      )
        return;
      const tag = String(node.tagName || '').toLowerCase();
      const text = String(node.textContent || '')
        .replace(/\s+/g, ' ')
        .trim();
      const computed = window.getComputedStyle?.(node);
      const colorText = [
        node.getAttribute?.('fill'),
        node.getAttribute?.('stroke'),
        node.getAttribute?.('style'),
        computed?.fill,
        computed?.stroke,
        computed?.backgroundColor,
        computed?.borderColor,
      ]
        .filter(Boolean)
        .join(' ');
      const isTextContainer = text.length > 160;
      const isShapeLike = ['rect', 'path', 'polygon', 'polyline', 'button', 'div'].includes(tag);
      const looksBlue = hasColor(colorText, 'blue');
      const looksOrange = hasColor(colorText, 'orange');
      const box = toStageBox(rect);
      if (node.closest?.('[data-answer-static="true"]')) return;

      if (
        looksBlue &&
        isShapeLike &&
        !isTextContainer &&
        box.width >= 120 &&
        box.height >= 24 &&
        box.height <= 90
      ) {
        visualDrags.push(summarizeNode(node, rect));
      }
      if (
        looksOrange &&
        isShapeLike &&
        !isTextContainer &&
        box.width >= 120 &&
        box.height >= 20 &&
        box.height <= 90
      ) {
        visualDrops.push(summarizeNode(node, rect));
      }
    });

    handleDragDebug({
      type: 'dom-summary',
      code: 'DD_DOM_SCAN',
      level:
        (reactDraggables || visualDrags.length) && (reactDropTargets || visualDrops.length)
          ? 'info'
          : 'warn',
      message: `DOM/SVG taraması: ${visualDrags.length} görsel öğe, ${visualDrops.length} görsel hedef`,
      data: {
        reactDraggableDomCount: reactDraggables,
        reactDropTargetDomCount: reactDropTargets,
        visualDraggableCandidateCount: visualDrags.length,
        visualDropCandidateCount: visualDrops.length,
        visualDraggableCandidates: visualDrags.slice(0, 12),
        visualDropCandidates: visualDrops.slice(0, 12),
      },
      log: true,
    });
  }, [handleDragDebug, scale]);

  useEffect(() => {
    if (!open || !previewActivity) return undefined;
    const first = window.setTimeout(scanPreviewStageDragDrop, 80);
    const second = window.setTimeout(scanPreviewStageDragDrop, 450);
    return () => {
      window.clearTimeout(first);
      window.clearTimeout(second);
    };
  }, [
    activeLayerId,
    displayHeight,
    displayWidth,
    open,
    previewActivity,
    scanPreviewStageDragDrop,
    selectedSlideId,
  ]);

  const resetPreviewRuntime = useCallback(
    (reason = 'manual') => {
      persistentDragPositionsRef.current = {};
      persistentDropAssignmentsRef.current = {};
      dragRuntimeDebugStateRef.current = { signature: '', positionCount: 0, assignmentCount: 0 };
      setSelectedLayerId('base');
      setHiddenObjectIds(new Set());
      setObjectStates({});
      setDragPositions({});
      setActiveDragId('');
      setDropAssignments({});
      setRuntimeMuted(false);
      setRuntimeVariables(buildRuntimeVariableMap(variables));
      setDragDebug((current) => {
        const resetLog = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          time: new Date().toLocaleTimeString('tr-TR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
          code: 'PREVIEW_RUNTIME_RESET',
          level: 'info',
          message: "Önizleme başlangıç state'i temizlendi.",
          data: { reason },
        };
        return {
          ...current,
          summary: {},
          live: null,
          logs: [resetLog, ...(current.logs || [])].slice(0, 120),
        };
      });
    },
    [variables]
  );

  const restartPreviewFromStart = useCallback(
    (reason = 'manual') => {
      const startActivity =
        previewActivities.find((item) => item.id === activity?.id) || previewActivities[0];
      const startSlides = getActivitySlides(startActivity || {});
      const startSlideId = startSlides[1]?.id || startSlides[0]?.id || '';
      setSelectedActivityId(startActivity?.id || '');
      setSelectedSlideId(startSlideId);
      resetPreviewRuntime(reason);
    },
    [activity?.id, previewActivities, resetPreviewRuntime]
  );

  const goHomePreview = useCallback(
    (reason = 'runtime-home') => {
      const startActivity =
        previewActivities.find((item) => item.id === activity?.id) || previewActivities[0];
      const startSlides = getActivitySlides(startActivity || {});
      const startSlideId = startSlides[0]?.id || '';
      setSelectedActivityId(startActivity?.id || '');
      setSelectedSlideId(startSlideId);
      resetPreviewRuntime(reason);
    },
    [activity?.id, previewActivities, resetPreviewRuntime]
  );

  const logPreviewRuntimeAction = useCallback((action, message, data = {}) => {
    setDragDebug((current) => {
      const entry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        time: new Date().toLocaleTimeString('tr-TR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        code: `RUNTIME_${String(action || 'ACTION').toUpperCase()}`,
        level: 'info',
        message,
        data,
      };
      return { ...current, logs: [entry, ...(current.logs || [])].slice(0, 120) };
    });
  }, []);

  const resetPreviewAttemptState = useCallback((reason = 'answer-layer') => {
    persistentDragPositionsRef.current = {};
    persistentDropAssignmentsRef.current = {};
    dragRuntimeDebugStateRef.current = { signature: '', positionCount: 0, assignmentCount: 0 };
    setObjectStates({});
    setDragPositions({});
    setActiveDragId('');
    setDropAssignments({});
    setDragDebug((current) => ({
      ...current,
      summary: { ...(current.summary || {}), runtimeAttemptReset: true },
      live: null,
      logs: [
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          time: new Date().toLocaleTimeString('tr-TR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
          code: 'PREVIEW_ATTEMPT_RESET',
          level: 'info',
          message: "Cevap katmanına geçerken işaretler ve drag/drop deneme state'i sıfırlandı.",
          data: { reason },
        },
        ...(current.logs || []),
      ].slice(0, 120),
    }));
  }, []);

  const goToActivity = useCallback(
    (nextActivityId) => {
      const nextActivity = previewActivities.find((item) => item.id === nextActivityId);
      if (!nextActivity) return;
      const nextSlides = getActivitySlides(nextActivity);
      const nextSlideId = nextSlides[0]?.id || '';
      persistentDragPositionsRef.current = {};
      persistentDropAssignmentsRef.current = {};
      dragRuntimeDebugStateRef.current = { signature: '', positionCount: 0, assignmentCount: 0 };
      setSelectedActivityId(nextActivity.id);
      setSelectedSlideId(nextSlideId);
      setSelectedLayerId('base');
      setDragPositions({});
      setActiveDragId('');
      setDropAssignments({});
      setDragDebug((current) => ({
        ...current,
        summary: {},
        live: null,
        logs: current.logs || [],
      }));
      setObjectStates({});
    },
    [previewActivities]
  );

  const goToSlide = useCallback(
    (nextSlideId) => {
      const nextSlide = slides.find((slide) => slide.id === nextSlideId);
      if (!nextSlide) return;
      persistentDragPositionsRef.current = {};
      persistentDropAssignmentsRef.current = {};
      dragRuntimeDebugStateRef.current = { signature: '', positionCount: 0, assignmentCount: 0 };
      setSelectedSlideId(nextSlide.id);
      setSelectedLayerId('base');
      setDragPositions({});
      setActiveDragId('');
      setDropAssignments({});
      setDragDebug((current) => ({
        ...current,
        summary: {},
        live: null,
        logs: current.logs || [],
      }));
      setObjectStates({});
    },
    [slides]
  );

  const goRelative = useCallback(
    (direction = 1) => {
      const nextSlide = slides[slideIndex + direction];
      if (nextSlide) {
        goToSlide(nextSlide.id);
        return;
      }
      const nextActivity = previewActivities[activityIndex + direction];
      if (nextActivity) goToActivity(nextActivity.id);
    },
    [activityIndex, goToActivity, goToSlide, previewActivities, slideIndex, slides]
  );

  const handleDragPositionChange = useCallback(
    (dragId, position) => {
      if (!dragId || !position) return;
      const normalizedPosition = {
        x: Number(position.x) || 0,
        y: Number(position.y) || 0,
      };
      persistentDragPositionsRef.current = {
        ...(persistentDragPositionsRef.current || {}),
        [previewScopeKey]: {
          ...((persistentDragPositionsRef.current &&
            persistentDragPositionsRef.current[previewScopeKey]) ||
            {}),
          [dragId]: normalizedPosition,
        },
      };
      setDragPositions((current) => ({ ...current, [dragId]: normalizedPosition }));
    },
    [previewScopeKey]
  );

  const handleDragStart = useCallback((dragId) => {
    setActiveDragId(dragId || '');
  }, []);

  const handleDragEnd = useCallback((dragId) => {
    setActiveDragId((current) => (current === dragId ? '' : current));
  }, []);

  const handleDropAssign = useCallback(
    (dragId, dropId, snapPosition = null, sourceIds = {}) => {
      if (!previewActivity || !dragId) return;
      const actualDragId = sourceIds?.dragId || dragId;
      const actualDropId = sourceIds?.dropId || dropId;
      if (!actualDropId) {
        const nextAssignments = {
          ...((persistentDropAssignmentsRef.current &&
            persistentDropAssignmentsRef.current[previewScopeKey]) ||
            {}),
        };
        delete nextAssignments[actualDragId];
        if (dragId !== actualDragId) delete nextAssignments[dragId];
        persistentDropAssignmentsRef.current = {
          ...(persistentDropAssignmentsRef.current || {}),
          [previewScopeKey]: nextAssignments,
        };
        setDropAssignments({ ...nextAssignments });
        handleDragDebug({
          code: 'DD_STATE_CLEAR',
          level: 'info',
          message: "Bırakma eşleşmesi state'ten temizlendi.",
          data: { dragId, actualDragId },
        });
        return;
      }
      const drag = (previewActivity.objects || []).find((item) => item.id === actualDragId);
      const drop = (previewActivity.objects || []).find((item) => item.id === actualDropId);
      handleDragDebug({
        code: 'DD_STATE_ASSIGN',
        level: 'info',
        message: "Bırakma eşleşmesi state'e yazılıyor.",
        data: {
          dragId,
          dropId,
          actualDragId,
          actualDropId,
          snapPosition: snapPosition
            ? {
                x: Math.round(Number(snapPosition.x) || 0),
                y: Math.round(Number(snapPosition.y) || 0),
              }
            : null,
        },
      });
      // Kapasite/yer değiştirme (swap) kuralları paylaşılan runtime core'unda
      // (storylineRendererAttachDragDrop) uygulanır; burada yalnızca core'un
      // runtime durumunu React state'ine aynalıyoruz. Böylece önizleme ile
      // SCORM çıktısı birebir aynı davranır.
      persistentDropAssignmentsRef.current = {
        ...(persistentDropAssignmentsRef.current || {}),
        [previewScopeKey]: {
          ...((persistentDropAssignmentsRef.current &&
            persistentDropAssignmentsRef.current[previewScopeKey]) ||
            {}),
          [actualDragId]: actualDropId,
        },
      };
      setDropAssignments({
        ...((persistentDropAssignmentsRef.current &&
          persistentDropAssignmentsRef.current[previewScopeKey]) ||
          {}),
      });
      if (snapPosition) {
        const normalizedPosition = {
          x: Number(snapPosition.x) || 0,
          y: Number(snapPosition.y) || 0,
        };
        const nextPersistentPositions = {
          ...((persistentDragPositionsRef.current &&
            persistentDragPositionsRef.current[previewScopeKey]) ||
            {}),
        };
        if (dragId !== actualDragId) delete nextPersistentPositions[dragId];
        nextPersistentPositions[actualDragId] = normalizedPosition;
        persistentDragPositionsRef.current = {
          ...(persistentDragPositionsRef.current || {}),
          [previewScopeKey]: nextPersistentPositions,
        };
        setDragPositions({ ...nextPersistentPositions });
      } else if (drag && drop) {
        const normalizedPosition = {
          x: Number(drop.x) || 0,
          y: Number(drop.y) || 0,
        };
        const nextPersistentPositions = {
          ...((persistentDragPositionsRef.current &&
            persistentDragPositionsRef.current[previewScopeKey]) ||
            {}),
        };
        if (dragId !== actualDragId) delete nextPersistentPositions[dragId];
        nextPersistentPositions[actualDragId] = normalizedPosition;
        persistentDragPositionsRef.current = {
          ...(persistentDragPositionsRef.current || {}),
          [previewScopeKey]: nextPersistentPositions,
        };
        setDragPositions({ ...nextPersistentPositions });
      }
    },
    [handleDragDebug, previewActivity, previewScopeKey]
  );

  const handleCheckAnswer = useCallback(() => {
    if (!previewActivity) return;
    const selectionResult = evaluateStorylineRuntimeSelection({
      slide: previewActivity,
      objects: getCanvasObjects(previewActivity, 'base'),
      state: { objectStates },
    });
    const expectedMatches = getCorrectDragMatches(previewActivity);
    const expectedPairs = getDragDropPairsFromMatches(expectedMatches);
    const findLayerByName = (name) => {
      const wanted = normalizeLayerNameKey(name);
      return layers.find(
        (layer) =>
          normalizeLayerNameKey(layer.name || (layer.id === 'base' ? 'base' : '')) === wanted
      );
    };
    const result = selectionResult.expectedCount
      ? selectionResult
      : evaluateStorylineRuntimeDragDrop({
      slide: previewActivity,
      objects: getCanvasObjects(previewActivity, 'base'),
      state: { dropAssignments: effectiveDropAssignments },
      expectedMatches,
        });
    handleDragDebug({
      code: result.success ? 'DD_CHECK_CORRECT' : 'DD_CHECK_INCORRECT',
      level: result.success ? 'success' : 'warn',
      message: result.success
        ? 'Kontrol: doğru katmana gidiliyor.'
        : 'Kontrol: eksik veya yanlış yerleşim, yanlış katmanına gidiliyor.',
      data: {
        expectedCount: result.expectedCount ?? expectedPairs.length,
        placementCount: result.placements?.length || result.selected?.length || 0,
        success: result.success,
        targetLayer: result.success ? 'Correct' : 'Incorrect',
        placements: result.placements || [],
        selection: result.type === 'selection' ? result : null,
        placementResult: result.placementResult,
      },
    });
    if (result.type !== 'selection') {
      const nextStates = getStorylineRuntimeDropResultStates(result);
      setObjectStates((current) => ({ ...current, ...nextStates }));
    }
    const hasAnswerAttempt =
      result.type === 'selection' ? result.selected.length > 0 : result.placements.length > 0;
    const targetLayer = !hasAnswerAttempt
      ? findLayerByName('normal')
      : findLayerByName(result.success ? 'Correct' : 'Incorrect');
    if (targetLayer) setSelectedLayerId(targetLayer.id);
  }, [effectiveDropAssignments, handleDragDebug, layers, objectStates, previewActivity]);

  const applyPreviewRuntimeCommands = useCallback(
    (commands = []) => {
      for (const command of commands) {
        if (!command?.type) continue;
        if (command.type === 'checkAnswer') {
          handleCheckAnswer();
        } else if (command.type === 'restart') {
          restartPreviewFromStart(command.reason || 'runtime-restart');
        } else if (command.type === 'goHome') {
          goHomePreview(command.reason || 'runtime-home');
        } else if (command.type === 'resetAttempt') {
          resetPreviewAttemptState(command.reason || 'runtime-attempt-reset');
        } else if (command.type === 'setLayer' && command.layerId) {
          setSelectedLayerId(command.layerId);
        } else if (command.type === 'toggleMute') {
          setRuntimeMuted((current) => !current);
          logPreviewRuntimeAction('mute', 'Ses durumu değiştirildi.', command);
        } else if (command.type === 'togglePlayback') {
          const mediaNodes = Array.from(
            document.querySelectorAll(
              "[data-preview-stage='true'] video, [data-preview-stage='true'] audio"
            )
          );
          const shouldPlay = mediaNodes.some((node) => node.paused);
          mediaNodes.forEach((node) => {
            if (shouldPlay) {
              const result = node.play?.();
              if (result?.catch) result.catch(() => {});
            } else {
              node.pause?.();
            }
          });
          logPreviewRuntimeAction(
            'playback',
            shouldPlay ? 'Medya oynatıldı.' : 'Medya duraklatıldı.',
            command
          );
        } else if (
          (command.type === 'playMedia' || command.type === 'pauseMedia') &&
          command.objectId
        ) {
          const mediaNodes = Array.from(
            document.querySelectorAll(
              `[data-preview-stage='true'] video[data-object-id='${command.objectId}'], [data-preview-stage='true'] audio[data-object-id='${command.objectId}'], [data-preview-stage='true'] audio[data-media-object-id='${command.objectId}']`
            )
          );
          mediaNodes.forEach((node) => {
            if (command.type === 'playMedia') {
              const result = node.play?.();
              if (result?.catch) result.catch(() => {});
            } else {
              node.pause?.();
            }
          });
          logPreviewRuntimeAction(
            command.type,
            command.type === 'playMedia' ? 'Medya oynatıldı.' : 'Medya durduruldu.',
            command
          );
        } else if (command.type === 'complete') {
          logPreviewRuntimeAction(
            'complete',
            'Tamamla aksiyonu çalıştı. SCORM çıktısında LMS completion gönderilir.',
            command
          );
        } else if (command.type === 'goRelative') {
          goRelative(command.direction || 1);
        } else if (command.type === 'goToSlide' && command.slideId) {
          goToSlide(command.slideId);
        } else if (command.type === 'goToActivity' && command.activityId) {
          goToActivity(command.activityId);
        } else if (command.type === 'show' && command.objectId) {
          setHiddenObjectIds((current) => {
            const next = new Set(current);
            next.delete(command.objectId);
            return next;
          });
        } else if (command.type === 'hide' && command.objectId) {
          setHiddenObjectIds((current) => new Set(current).add(command.objectId));
        } else if (command.type === 'toggleHidden' && command.objectId) {
          setHiddenObjectIds((current) => {
            const next = new Set(current);
            if (next.has(command.objectId)) next.delete(command.objectId);
            else next.add(command.objectId);
            return next;
          });
        } else if (command.type === 'toggleSelection' && command.objectId) {
          setObjectStates((current) => ({
            ...current,
            [command.objectId]: {
              ...(current[command.objectId] || {}),
              selected: !current[command.objectId]?.selected,
            },
          }));
        } else if (command.type === 'toggleDemoButtonState' && command.objectId) {
          setObjectStates((current) => ({
            ...current,
            [command.objectId]: {
              ...(current[command.objectId] || {}),
              selected: !current[command.objectId]?.selected,
            },
          }));
        } else if (command.type === 'setObjectState' && command.objectId) {
          setObjectStates((current) => ({
            ...current,
            [command.objectId]: {
              ...(current[command.objectId] || {}),
              [command.stateKey || 'visited']: command.value,
            },
          }));
        } else if (command.type === 'setVariable' && command.variableId) {
          setRuntimeVariables((current) => ({ ...current, [command.variableId]: command.value }));
        } else if (command.type === 'addVariable' && command.variableId) {
          setRuntimeVariables((current) => {
            const currentValue = Number(current[command.variableId] || 0) || 0;
            return {
              ...current,
              [command.variableId]: currentValue + (Number(command.delta) || 0),
            };
          });
        } else if (command.type === 'openUrl' && command.url) {
          window.open(command.url, '_blank', 'noopener,noreferrer');
        } else if (command.type === 'print') {
          window.print();
        } else if (command.type === 'sendWidgetCommand') {
          const widgetRef = widgetRefs.current.get(command.widgetId || command.objectId);
          if (widgetRef?.sendCommand) {
            widgetRef.sendCommand(command.command, command.payload);
          }
        } else if (command.type === 'log') {
          logPreviewRuntimeAction(
            command.action || 'log',
            command.message || 'Runtime aksiyonu notu.',
            command.data || command
          );
        }
      }
    },
    [
      goHomePreview,
      goRelative,
      goToActivity,
      goToSlide,
      handleCheckAnswer,
      logPreviewRuntimeAction,
      resetPreviewAttemptState,
      restartPreviewFromStart,
    ]
  );

  const handleRunTriggers = useCallback(
    (sourceId, when = 'onClick') => {
      if (!previewActivity) return;
      const sourceIds = (Array.isArray(sourceId) ? sourceId : [sourceId]).filter(Boolean);
      const sourceObjects = Object.fromEntries(
        (previewActivity.objects || [])
          .filter((item) => item?.id)
          .map((item) => [item.id, item])
      );
      const firstSourceObject =
        sourceObjects[sourceIds[0]] ||
        (previewActivity.objects || []).find((item) => item.__runtimeId === sourceIds[0]) ||
        null;
      const commands = getStorylineRuntimeCommandsForObject({
        slide: previewActivity,
        sourceId: firstSourceObject?.id || sourceIds[0] || '',
        sourceIds,
        sourceObject: firstSourceObject,
        sourceObjects,
        when,
        state: {
          variables: runtimeVariables,
          objectStates,
          hiddenObjectIds,
        },
        variableDefinitions: variables,
      });
      applyPreviewRuntimeCommands(commands);
    },
    [
      applyPreviewRuntimeCommands,
      hiddenObjectIds,
      objectStates,
      previewActivity,
      runtimeVariables,
      variables,
    ]
  );

  const widgetRefs = useRef(new Map());

  const handleWidgetEvent = useCallback(
    (widgetObj, eventName, payload) => {
      const bindings = widgetObj?.bindings || {};
      const updates = {};
      Object.entries(bindings).forEach(([eventPath, variableId]) => {
        const [evt, key] = eventPath.split('.');
        if (evt === eventName && key && payload && payload[key] !== undefined) {
          updates[variableId] = payload[key];
        }
      });
      if (Object.keys(updates).length) {
        setRuntimeVariables((current) => ({ ...current, ...updates }));
      }
      setTimeout(() => {
        if (!previewActivity) return;
        const sourceObjects = Object.fromEntries(
          (previewActivity.objects || [])
            .filter((item) => item?.id)
            .map((item) => [item.id, item])
        );
        const commands = getStorylineRuntimeCommandsForObject({
          slide: previewActivity,
          sourceId: widgetObj.id,
          sourceIds: [widgetObj.id],
          sourceObject: widgetObj,
          sourceObjects,
          when: 'onWidgetEvent',
          eventName,
          state: {
            variables: { ...runtimeVariables, ...updates },
            objectStates,
            hiddenObjectIds,
          },
          variableDefinitions: variables,
        });
        applyPreviewRuntimeCommands(commands);
      }, 0);
    },
    [
      applyPreviewRuntimeCommands,
      hiddenObjectIds,
      objectStates,
      previewActivity,
      runtimeVariables,
      variables,
    ]
  );

  const handleMediaEndAction = useCallback((object = {}) => {
    if (!object || object.mediaEndAction === 'none') return;
    if (object.mediaEndAction === 'close-layer' && (object.layerId || 'base') !== 'base') {
      setSelectedLayerId('base');
    }
  }, []);

  if (!open) return null;

  if (!previewActivity) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1200,
          background: 'rgba(15,23,42,.86)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#e5edf8',
        }}
      >
        <div
          style={{
            width: 'min(420px, 90vw)',
            borderRadius: 16,
            background: '#ffffff',
            color: '#0f172a',
            padding: 22,
            boxShadow: '0 28px 70px rgba(0,0,0,.42)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 8 }}>
            Önizleme için sahne yok
          </div>
          <button
            onClick={onClose}
            style={{
              height: 34,
              padding: '0 16px',
              borderRadius: 9,
              border: 'none',
              background: '#0f172a',
              color: '#ffffff',
              fontSize: 12,
              fontWeight: 900,
              cursor: 'pointer',
            }}
          >
            Kapat
          </button>
        </div>
      </div>
    );
  }

  const sharedRuntimeActivity = previewActivity
    ? {
        ...previewActivity,
        objects: withStableRuntimeSlideObjectIds(
          positionedPreviewObjects,
          previewActivity.currentSlideId || previewActivity.id || 'preview-slide'
        ),
        activeLayerId,
      }
    : null;
  const useSharedRuntimeDom = true;
  const layerName =
    layers.find((layer) => layer.id === activeLayerId)?.name ||
    (activeLayerId === 'base' ? 'Temel Katman' : 'Katman');
  const previewPdfBackgroundObject =
    (previewActivity.objects || [])
      .filter((item) => (item?.isPdfBackground || item?.isStageBackground) && item?.imageData)
      .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))[0] || null;
  const rawStageBackground = String(previewActivity.backgroundColor || '')
    .trim()
    .toLowerCase();
  const stageBackgroundColor =
    !rawStageBackground ||
    rawStageBackground === 'transparent' ||
    rawStageBackground === 'rgba(0,0,0,0)' ||
    rawStageBackground === 'rgba(0, 0, 0, 0)'
      ? '#ffffff'
      : previewActivity.backgroundColor;
  const runtimeHiddenObjectIds = new Set(hiddenObjectIds);
  (previewActivity.objects || []).forEach((item) => {
    if (item?.isPdfBackground || item?.isStageBackground) runtimeHiddenObjectIds.add(item.id);
  });

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
        background: '#202833',
        color: '#1f2937',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Segoe UI',Tahoma,Geneva,Verdana,sans-serif",
      }}
    >
      <div
        style={{
          minHeight: 48,
          borderBottom: '1px solid #151b24',
          background: 'linear-gradient(180deg,#f8fafc,#e5ebf3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          padding: '0 12px',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 6,
              border: '1px solid #b8c5d4',
              background: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0f6fb5',
              fontWeight: 900,
            }}
          >
            ▶
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 900,
                color: '#0f172a',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              Önizleme
            </div>
            <div
              style={{
                fontSize: 11,
                color: '#64748b',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {selectedActivity?.name || 'Etkinlik'} · {currentSlide?.name || 'Sahne'} · {layerName}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => setCaptionsEnabled((current) => !current)}
            style={{
              height: 30,
              padding: '0 10px',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              background: captionsEnabled ? '#e0f2fe' : '#ffffff',
              color: captionsEnabled ? '#0369a1' : '#475569',
              fontSize: 11,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            CC
          </button>
          <button
            onClick={onClose}
            style={{
              height: 32,
              padding: '0 14px',
              borderRadius: 7,
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#0f172a',
              fontSize: 12,
              fontWeight: 900,
              cursor: 'pointer',
            }}
          >
            Kapat
          </button>
        </div>
      </div>

      {isPhonePortrait ? (
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 22,
            background: '#c9d0d8',
          }}
        >
          <div
            style={{
              width: 'min(360px, 92vw)',
              borderRadius: 18,
              background: '#ffffff',
              border: '1px solid #d5dee9',
              boxShadow: '0 24px 58px rgba(15,23,42,.25)',
              padding: 22,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 32, lineHeight: 1, marginBottom: 10 }}>↻</div>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#0f172a', marginBottom: 6 }}>
              Telefonu yatay çevirin
            </div>
            <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
              Önizleme telefonda yalnızca yatay ekranda çalışır.
            </div>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', background: '#bfc8d1' }}>
          <main
            style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}
          >
            <div
              ref={frameRef}
              style={{
                flex: 1,
                minHeight: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: isCompactPreview ? 8 : 16,
                overflow: 'hidden',
              }}
            >
              {useSharedRuntimeDom ? (
                <StorylinePreviewSharedRuntimeStage
                  activity={sharedRuntimeActivity}
                  stageRef={stageRef}
                  activeLayerId={activeLayerId}
                  hiddenObjectIds={runtimeHiddenObjectIds}
                  objectStates={objectStates}
                  dragPositions={effectiveDragPositions}
                  dropAssignments={effectiveDropAssignments}
                  runtimeVariables={runtimeVariables}
                  runtimeMuted={runtimeMuted}
                  scale={scale}
                  displayWidth={displayWidth}
                  displayHeight={displayHeight}
                  stageBackgroundColor={stageBackgroundColor}
                  onRunTriggers={handleRunTriggers}
                  onHoverChange={(objectId, hovered) =>
                    setObjectStates((current) => ({
                      ...current,
                      [objectId]: { ...(current[objectId] || {}), hover: hovered },
                    }))
                  }
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onDragPositionChange={handleDragPositionChange}
                  onDropAssign={handleDropAssign}
                  onMediaEndAction={handleMediaEndAction}
                  onPointerDownCapture={handleStagePointerDownCapture}
                />
              ) : (
                <div
                  ref={stageRef}
                  data-preview-stage="true"
                  onPointerDownCapture={handleStagePointerDownCapture}
                  style={{
                    width: displayWidth,
                    height: displayHeight,
                    position: 'relative',
                    background: stageBackgroundColor,
                    overflow: 'hidden',
                    boxShadow: '0 2px 0 rgba(255,255,255,.55), 0 18px 46px rgba(15,23,42,.35)',
                    border: '1px solid rgba(71,85,105,.45)',
                  }}
                >
                  {previewPdfBackgroundObject && (
                    <img
                      src={previewPdfBackgroundObject.imageData}
                      alt={previewPdfBackgroundObject.label || 'PDF Zemin'}
                      style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        pointerEvents: 'none',
                        userSelect: 'none',
                        zIndex: 0,
                      }}
                    />
                  )}
                  {previewActivity.svgMarkup && (
                    <div
                      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}
                      dangerouslySetInnerHTML={{
                        __html: sanitizeSvgMarkup(previewActivity.svgMarkup),
                      }}
                    />
                  )}
                  <StorylinePreviewObjectLayer
                    activity={sharedRuntimeActivity}
                    slide={currentSlide}
                    rawActivity={selectedActivity}
                    activeLayerId={activeLayerId}
                    hiddenObjectIds={runtimeHiddenObjectIds}
                    objectStates={objectStates}
                    onRunTriggers={handleRunTriggers}
                    onSelectionChoice={(objectId) =>
                      setObjectStates((current) => ({
                        ...current,
                        [objectId]: {
                          ...(current[objectId] || {}),
                          selected: !current[objectId]?.selected,
                        },
                      }))
                    }
                    onHoverChange={(objectId, hovered) =>
                      setObjectStates((current) => ({
                        ...current,
                        [objectId]: { ...(current[objectId] || {}), hover: hovered },
                      }))
                    }
                    dragPositions={effectiveDragPositions}
                    activeDragId={activeDragId}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onDragPositionChange={handleDragPositionChange}
                    onDropAssign={handleDropAssign}
                    scale={scale}
                    captionsEnabled={captionsEnabled}
                    runtimeVariables={runtimeVariables}
                    onWidgetEvent={handleWidgetEvent}
                    widgetRefs={widgetRefs}
                  />
                  {['matching', 'sequence', 'text-entry', 'fill-blank', 'puzzle', 'numeric', 'survey', 'hotspot', 'mixed'].includes(selectedActivity?.type) && (
                    <div style={{ position: 'absolute', inset: 0, zIndex: 100, background: '#f8fafc', overflow: 'auto', padding: 24 }}>
                      {selectedActivity?.type === 'matching' && <PreviewMatchingFlow activity={selectedActivity} />}
                      {selectedActivity?.type === 'sequence' && <PreviewSequenceFlow activity={selectedActivity} />}
                      {selectedActivity?.type === 'text-entry' && <PreviewTextEntryFlow activity={selectedActivity} />}
                      {selectedActivity?.type === 'fill-blank' && <PreviewFillBlankFlow activity={selectedActivity} />}
                      {selectedActivity?.type === 'puzzle' && <PreviewPuzzleOverlay activity={selectedActivity} />}
                      {selectedActivity?.type === 'numeric' && <PreviewNumericFlow activity={selectedActivity} />}
                      {selectedActivity?.type === 'survey' && <PreviewSurveyFlow activity={selectedActivity} />}
                      {selectedActivity?.type === 'hotspot' && <PreviewHotspotFlow activity={selectedActivity} />}
                      {selectedActivity?.type === 'mixed' && <PreviewMixedFlow activity={selectedActivity} />}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div
              style={{
                minHeight: 52,
                borderTop: '1px solid #aab5c1',
                background: '#eef2f6',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 10px',
                flexWrap: 'wrap',
              }}
            >
              <button
                onClick={() => goRelative(-1)}
                disabled={activityIndex === 0 && slideIndex === 0}
                style={{
                  height: 32,
                  padding: '0 12px',
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                  background: activityIndex === 0 && slideIndex === 0 ? '#f1f5f9' : '#ffffff',
                  color: activityIndex === 0 && slideIndex === 0 ? '#94a3b8' : '#0f172a',
                  fontSize: 12,
                  fontWeight: 900,
                  cursor: activityIndex === 0 && slideIndex === 0 ? 'default' : 'pointer',
                }}
              >
                ‹ Geri
              </button>
              <button
                onClick={() => goRelative(1)}
                disabled={
                  activityIndex === previewActivities.length - 1 && slideIndex === slides.length - 1
                }
                style={{
                  height: 32,
                  padding: '0 12px',
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                  background:
                    activityIndex === previewActivities.length - 1 &&
                    slideIndex === slides.length - 1
                      ? '#f1f5f9'
                      : '#ffffff',
                  color:
                    activityIndex === previewActivities.length - 1 &&
                    slideIndex === slides.length - 1
                      ? '#94a3b8'
                      : '#0f172a',
                  fontSize: 12,
                  fontWeight: 900,
                  cursor:
                    activityIndex === previewActivities.length - 1 &&
                    slideIndex === slides.length - 1
                      ? 'default'
                      : 'pointer',
                }}
              >
                İleri ›
              </button>
              <select
                value={selectedActivity?.id || ''}
                onChange={(e) => goToActivity(e.target.value)}
                style={{
                  height: 32,
                  minWidth: 190,
                  maxWidth: isCompactPreview ? 220 : 280,
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#334155',
                  fontSize: 12,
                  fontWeight: 800,
                  padding: '0 8px',
                }}
              >
                {previewActivities.map((item, index) => (
                  <option key={item.id} value={item.id}>
                    {index + 1}. {item.name || `Sahne ${index + 1}`}
                  </option>
                ))}
              </select>
              <select
                value={currentSlide?.id || ''}
                onChange={(e) => goToSlide(e.target.value)}
                style={{
                  height: 32,
                  minWidth: 140,
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#334155',
                  fontSize: 12,
                  fontWeight: 800,
                  padding: '0 8px',
                }}
              >
                {slides.map((slide, index) => (
                  <option key={slide.id} value={slide.id}>
                    {index + 1}. {slide.name || `Slider ${index + 1}`}
                  </option>
                ))}
              </select>
              <select
                value={activeLayerId}
                onChange={(e) => setSelectedLayerId(e.target.value)}
                style={{
                  height: 32,
                  minWidth: 140,
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#334155',
                  fontSize: 12,
                  fontWeight: 800,
                  padding: '0 8px',
                }}
              >
                {layers.map((layer) => (
                  <option key={layer.id} value={layer.id}>
                    {layer.kind === 'base' ? 'Temel Katman' : layer.name || 'Katman'}
                  </option>
                ))}
              </select>
              <div style={{ marginLeft: 'auto', fontSize: 11, color: '#64748b', fontWeight: 800 }}>
                {Math.round(scale * 100)}%
              </div>
            </div>
          </main>
        </div>
      )}
    </div>
  );
}
