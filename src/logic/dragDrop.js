import { DEFAULT_DRAG_DROP_SETTINGS } from '../constants';
import { uid } from '../utils/editorHelpers';
import { isGeneratedAnswerTemplateObject } from '../utils/storylineRuntime';
import {
  normalizeStorylineDragDropMatchValue,
  getStorylineRuntimeKey,
  getStorylineDragDropPairKey,
  getStorylineDragDropPairsFromMatches,
} from '../utils/storylineRuntimeEngine';

import { createObject, createDragDropDefaults, upgradeDragDropStyle } from './factories';

function getActivityDragDropDefaults(activity = {}) {
  const fallback = createDragDropDefaults();
  const source = activity?.dragDropDefaults || {};
  const objects = Array.isArray(activity?.objects) ? activity.objects : [];

  const buildEntry = (type) => {
    const base = fallback[type];
    const existing = objects.find((item) => item?.type === type);
    const sourceEntry = source?.[type] || {};
    return {
      width: Math.max(20, Number(sourceEntry.width ?? existing?.width ?? base.width) || base.width),
      height: Math.max(
        20,
        Number(sourceEntry.height ?? existing?.height ?? base.height) || base.height
      ),
      style: upgradeDragDropStyle(type, {
        ...base.style,
        ...(existing?.style || {}),
        ...(sourceEntry.style || {}),
      }),
    };
  };

  return {
    draggable: buildEntry('draggable'),
    dropzone: buildEntry('dropzone'),
  };
}
function getDragDropSettings(activity = {}) {
  return {
    ...DEFAULT_DRAG_DROP_SETTINGS,
    ...(activity?.dragDropSettings || {}),
  };
}
const DRAG_DROP_ANIMATION_PRESETS = [
  {
    id: 'funReturn',
    label: 'Eğlenceli Dönüş',
    icon: '★',
    activeScale: 1.045,
    settleDuration: 285,
    returnDuration: 330,
    activeShadow: '0 20px 36px rgba(37,99,235,.28), 0 0 0 4px rgba(56,189,248,.18)',
    settledShadow: '0 12px 26px rgba(34,197,94,.18), 0 0 0 2px rgba(34,197,94,.18)',
    pulseColor: '37,99,235',
    hoverFilter: 'brightness(1.055) saturate(1.04)',
    previewAnimation: '_ddPreviewFunReturn',
    previewDuration: 1040,
  },
  {
    id: 'soft',
    label: 'Yumuşak',
    icon: 'S',
    activeScale: 1.035,
    settleDuration: 220,
    returnDuration: 240,
    activeShadow: '0 18px 34px rgba(15,23,42,.34), 0 0 0 3px rgba(59,130,246,.18)',
    settledShadow: '0 10px 24px rgba(15,23,42,.2), 0 0 0 2px rgba(34,197,94,.18)',
    pulseColor: '34,197,94',
    hoverFilter: 'brightness(1.04)',
    previewAnimation: '_ddPreviewSoft',
    previewDuration: 980,
  },
  {
    id: 'spring',
    label: 'Yaylı',
    icon: 'Y',
    activeScale: 1.06,
    settleDuration: 340,
    returnDuration: 360,
    activeShadow: '0 22px 40px rgba(15,23,42,.38), 0 0 0 4px rgba(168,85,247,.18)',
    settledShadow: '0 12px 28px rgba(15,23,42,.22), 0 0 0 2px rgba(168,85,247,.20)',
    pulseColor: '168,85,247',
    hoverFilter: 'brightness(1.07)',
    previewAnimation: '_ddPreviewSpring',
    previewDuration: 1100,
  },
  {
    id: 'snap',
    label: 'Net',
    icon: 'N',
    activeScale: 1.018,
    settleDuration: 150,
    returnDuration: 180,
    activeShadow: '0 14px 26px rgba(15,23,42,.30), 0 0 0 2px rgba(14,165,233,.18)',
    settledShadow: '0 8px 18px rgba(15,23,42,.18), 0 0 0 1px rgba(14,165,233,.18)',
    pulseColor: '14,165,233',
    hoverFilter: 'brightness(1.03)',
    previewAnimation: '_ddPreviewSnap',
    previewDuration: 760,
  },
  {
    id: 'pop',
    label: 'Pop',
    icon: 'P',
    activeScale: 1.075,
    settleDuration: 250,
    returnDuration: 260,
    activeShadow: '0 20px 38px rgba(15,23,42,.34), 0 0 0 4px rgba(244,114,182,.20)',
    settledShadow: '0 12px 26px rgba(15,23,42,.20), 0 0 0 2px rgba(244,114,182,.18)',
    pulseColor: '244,114,182',
    hoverFilter: 'brightness(1.08) saturate(1.08)',
    previewAnimation: '_ddPreviewPop',
    previewDuration: 920,
  },
  {
    id: 'glow',
    label: 'Parıltı',
    icon: 'I',
    activeScale: 1.035,
    settleDuration: 280,
    returnDuration: 280,
    activeShadow: '0 18px 34px rgba(15,23,42,.30), 0 0 18px rgba(34,211,238,.46)',
    settledShadow: '0 10px 22px rgba(15,23,42,.18), 0 0 14px rgba(34,211,238,.32)',
    pulseColor: '34,211,238',
    hoverFilter: 'brightness(1.1)',
    previewAnimation: '_ddPreviewGlow',
    previewDuration: 1050,
  },
  {
    id: 'elastic',
    label: 'Elastik',
    icon: 'E',
    activeScale: 1.08,
    settleDuration: 420,
    returnDuration: 420,
    activeShadow: '0 24px 42px rgba(15,23,42,.36), 0 0 0 4px rgba(251,191,36,.20)',
    settledShadow: '0 13px 28px rgba(15,23,42,.20), 0 0 0 2px rgba(251,191,36,.22)',
    pulseColor: '251,191,36',
    hoverFilter: 'brightness(1.08)',
    previewAnimation: '_ddPreviewElastic',
    previewDuration: 1180,
  },
  {
    id: 'slide',
    label: 'Kaydır',
    icon: 'K',
    activeScale: 1.025,
    settleDuration: 260,
    returnDuration: 260,
    activeShadow: '0 16px 30px rgba(15,23,42,.30), 0 0 0 3px rgba(99,102,241,.18)',
    settledShadow: '0 9px 20px rgba(15,23,42,.18), 0 0 0 2px rgba(99,102,241,.16)',
    pulseColor: '99,102,241',
    hoverFilter: 'brightness(1.04)',
    previewAnimation: '_ddPreviewSlide',
    previewDuration: 900,
  },
  {
    id: 'pulse',
    label: 'Nabız',
    icon: 'B',
    activeScale: 1.045,
    settleDuration: 300,
    returnDuration: 300,
    activeShadow: '0 18px 34px rgba(15,23,42,.30), 0 0 0 5px rgba(239,68,68,.16)',
    settledShadow: '0 10px 22px rgba(15,23,42,.18), 0 0 0 2px rgba(239,68,68,.18)',
    pulseColor: '239,68,68',
    hoverFilter: 'brightness(1.06)',
    previewAnimation: '_ddPreviewPulse',
    previewDuration: 1080,
  },
  {
    id: 'float',
    label: 'Uçuş',
    icon: 'U',
    activeScale: 1.035,
    settleDuration: 360,
    returnDuration: 360,
    activeShadow: '0 26px 42px rgba(15,23,42,.28), 0 0 0 3px rgba(45,212,191,.18)',
    settledShadow: '0 12px 30px rgba(15,23,42,.16), 0 0 0 2px rgba(45,212,191,.16)',
    pulseColor: '45,212,191',
    hoverFilter: 'brightness(1.05)',
    previewAnimation: '_ddPreviewFloat',
    previewDuration: 1180,
  },
  {
    id: 'calm',
    label: 'Sade',
    icon: 'D',
    activeScale: 1,
    settleDuration: 1,
    returnDuration: 1,
    activeShadow: '0 8px 18px rgba(15,23,42,.18)',
    settledShadow: '',
    pulseColor: '148,163,184',
    hoverFilter: 'brightness(1)',
    previewAnimation: '_ddPreviewCalm',
    previewDuration: 700,
  },
];

function getDragDropAnimationPreset(activity = {}) {
  const settings = getDragDropSettings(activity);
  const presetId =
    settings.dragAnimationPreset || DEFAULT_DRAG_DROP_SETTINGS.dragAnimationPreset || 'soft';
  return (
    DRAG_DROP_ANIMATION_PRESETS.find((preset) => preset.id === presetId) ||
    DRAG_DROP_ANIMATION_PRESETS[0]
  );
}
function normalizeDragDropMatchValue(value) {
  return normalizeStorylineDragDropMatchValue(value);
}
function getDragDropScopeKey(value = '') {
  return getStorylineRuntimeKey(value);
}
function areDragDropScopesCompatible(activity, drag, drop) {
  const settings = getDragDropSettings(activity);
  if (!settings.isolateScopes || settings.allowCrossScope) return true;
  const dragScope = getDragDropScopeKey(drag?.scope);
  const dropScope = getDragDropScopeKey(drop?.scope);
  if (!dragScope && !dropScope) return true;
  return !!dragScope && !!dropScope && dragScope === dropScope;
}
function isDragReusable(activity, drag = {}) {
  const settings = getDragDropSettings(activity);
  return !!(drag?.allowMultipleTargets || settings.allowMultipleTargetsPerDrag);
}
function getDropCapacityLimit(activity, drop = {}) {
  const settings = getDragDropSettings(activity);
  const explicit = Number(drop?.capacity);
  if (Number.isFinite(explicit) && explicit > 0) return Math.max(1, Math.round(explicit));
  return settings.allowMultipleItemsPerDrop ? 0 : 1;
}
function getDragDropPairKey(dragId = '', dropId = '') {
  return getStorylineDragDropPairKey(dragId, dropId);
}
function getDragDropPairsFromMatches(matches = {}) {
  return getStorylineDragDropPairsFromMatches(matches);
}
function buildDragDropMatchMapFromPairs(pairs = [], preferArrays = false) {
  const grouped = {};
  pairs.forEach(({ dragId, dropId }) => {
    if (!dragId || !dropId) return;
    grouped[dragId] = grouped[dragId] || [];
    if (!grouped[dragId].includes(dropId)) grouped[dragId].push(dropId);
  });
  return Object.fromEntries(
    Object.entries(grouped).map(([dragId, dropIds]) => [
      dragId,
      preferArrays || dropIds.length > 1 ? dropIds : dropIds[0],
    ])
  );
}
function createDragDropPlacement(dragId, dropId) {
  return { id: uid(), dragId, dropId };
}
function buildDragDropPlacementsFromMatches(matches = {}) {
  return getDragDropPairsFromMatches(matches).map(({ dragId, dropId }) =>
    createDragDropPlacement(dragId, dropId)
  );
}

function isGeneratedSceneTemplateObject(item = {}) {
  return item?.generatedBy === 'scene-template';
}

function createObjectFromActivity(activity = {}, type = 'text') {
  const object = createObject(type);
  if (type !== 'draggable' && type !== 'dropzone') return object;
  const family = getActivityDragDropDefaults(activity)[type];
  return {
    ...object,
    width: family.width,
    height: family.height,
    style: { ...family.style },
  };
}

function updateActivityObject(activity = {}, objectId = '', patch = {}, options = {}) {
  const objects = Array.isArray(activity?.objects) ? activity.objects : [];
  const target = objects.find((item) => item.id === objectId);
  if (!target) return activity;

  const shouldSyncFamily =
    !!options.syncDragDropFamily && (target.type === 'draggable' || target.type === 'dropzone');
  let nextActivity = activity;

  if (shouldSyncFamily) {
    const familyDefaults = getActivityDragDropDefaults(activity)[target.type];
    const familyPatch = {};

    if (Object.prototype.hasOwnProperty.call(patch, 'width')) {
      familyPatch.width = Math.max(20, Number(patch.width) || familyDefaults.width);
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'height')) {
      familyPatch.height = Math.max(20, Number(patch.height) || familyDefaults.height);
    }
    if (patch.style) {
      familyPatch.style = upgradeDragDropStyle(target.type, {
        ...familyDefaults.style,
        ...patch.style,
      });
    }

    if (Object.keys(familyPatch).length) {
      const nextDefaults = {
        ...familyDefaults,
        ...familyPatch,
        style: familyPatch.style ? { ...familyPatch.style } : familyDefaults.style,
      };
      nextActivity = {
        ...activity,
        dragDropDefaults: {
          ...getActivityDragDropDefaults(activity),
          [target.type]: nextDefaults,
        },
        objects: objects.map((item) =>
          item.type === target.type
            ? {
                ...item,
                ...(Object.prototype.hasOwnProperty.call(familyPatch, 'width')
                  ? { width: nextDefaults.width }
                  : {}),
                ...(Object.prototype.hasOwnProperty.call(familyPatch, 'height')
                  ? { height: nextDefaults.height }
                  : {}),
                ...(familyPatch.style ? { style: { ...nextDefaults.style } } : {}),
              }
            : item
        ),
      };
    }
  }

  const objectPatch = { ...patch };
  if (shouldSyncFamily) {
    delete objectPatch.width;
    delete objectPatch.height;
    delete objectPatch.style;
  }

  if (!Object.keys(objectPatch).length) return nextActivity;

  return {
    ...nextActivity,
    objects: (nextActivity.objects || []).map((item) => {
      if (item.id !== objectId) return item;
      const nextItem = { ...item, ...objectPatch };
      if (!options.preserveGeneratedBy && isGeneratedAnswerTemplateObject(item)) {
        delete nextItem.generatedBy;
        nextItem.userEditedTemplate = true;
      }
      if (!options.preserveGeneratedBy && isGeneratedSceneTemplateObject(item)) {
        nextItem.userEditedSceneTemplate = true;
      }
      return nextItem;
    }),
  };
}

export {
  DRAG_DROP_ANIMATION_PRESETS,
  getActivityDragDropDefaults,
  getDragDropSettings,
  getDragDropAnimationPreset,
  normalizeDragDropMatchValue,
  getDragDropScopeKey,
  areDragDropScopesCompatible,
  isDragReusable,
  getDropCapacityLimit,
  getDragDropPairKey,
  getDragDropPairsFromMatches,
  buildDragDropMatchMapFromPairs,
  createDragDropPlacement,
  buildDragDropPlacementsFromMatches,
  isGeneratedSceneTemplateObject,
  createObjectFromActivity,
  updateActivityObject,
};

