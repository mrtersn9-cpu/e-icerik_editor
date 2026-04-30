import { DEFAULT_SELECTION_UI } from '../constants';
import { castVariableValue } from './factories';
import {
  getActivityLayers,
  getCanvasObjects,
  isObjectTimelineActive,
  getTimelineMotionStyle,
} from './timeline';

// ─── Selection UI helpers (co-located so RuntimeObjectLayer stays self-contained) ───

function getSelectionUi(activity = {}) {
  return { ...DEFAULT_SELECTION_UI, ...(activity.selectionUi || {}) };
}

function getSelectionMarkGlyph(mark = 'check') {
  if (mark === 'cross') return '✗';
  if (mark === 'dot') return '●';
  return '✓';
}

function getSelectionOppositeMark(mark = 'check') {
  if (mark === 'cross') return 'check';
  if (mark === 'dot') return 'cross';
  return 'cross';
}

function resolveWrongSelectionGlyph(selectionUi = {}, selectedMark = 'check') {
  const mode = selectionUi.wrongMarkMode || 'opposite';
  if (mode === 'none') return '';
  if (mode === 'same') return getSelectionMarkGlyph(selectedMark);
  return getSelectionMarkGlyph(getSelectionOppositeMark(selectedMark));
}

// ─── Requested functions extracted from EIcerikEditor.jsx ───────────────────────────

function getInitialPreviewPhase(activity) {
  if (activity.introScreen?.enabled !== false) return 'intro';
  if (
    activity.settings?.showButtonPackageIntro !== false &&
    activity.buttonPackageScreen?.enabled !== false
  )
    return 'package';
  if (activity.settings?.showMenuScreen !== false && activity.menuScreen?.enabled !== false)
    return 'menu';
  return 'play';
}

function getVariableDefinition(variableDefinitions = [], variableId = '') {
  return variableDefinitions.find((variable) => variable.id === variableId) || null;
}

function buildRuntimeVariableMap(variableDefinitions = []) {
  return Object.fromEntries(
    variableDefinitions.map((variable) => [
      variable.id,
      castVariableValue(variable.type, variable.value),
    ])
  );
}

function normalizeRuntimeValue(value) {
  if (typeof value === 'boolean' || typeof value === 'number') return value;
  const raw = String(value ?? '').trim();
  if (raw === '') return '';
  const lowered = raw.toLowerCase();
  if (['true', 'false'].includes(lowered)) return lowered === 'true';
  const numeric = Number(raw);
  return Number.isFinite(numeric) && raw !== '' ? numeric : raw;
}

function getRuntimeObjectStateValue(
  objectStates = {},
  hiddenObjectIds = new Set(),
  objectId = '',
  stateKey = 'visited'
) {
  if (!objectId) return null;
  if (stateKey === 'hidden') return hiddenObjectIds?.has?.(objectId) || false;
  return objectStates?.[objectId]?.[stateKey] ?? false;
}

function evaluateTriggerCondition(condition, context) {
  const {
    variables = {},
    variableDefinitions = [],
    objectStates = {},
    hiddenObjectIds = new Set(),
  } = context;
  const sourceType = condition?.sourceType || 'variable';
  const operator = condition?.operator || 'eq';
  let left = '';

  if (sourceType === 'objectState') {
    left = getRuntimeObjectStateValue(
      objectStates,
      hiddenObjectIds,
      condition?.sourceId || '',
      condition?.stateKey || 'visited'
    );
  } else {
    const variable = getVariableDefinition(variableDefinitions, condition?.sourceId || '');
    left = variable
      ? castVariableValue(variable.type, variables?.[variable.id])
      : (variables?.[condition?.sourceId || ''] ?? '');
  }

  const right = normalizeRuntimeValue(condition?.value ?? '');

  if (operator === 'truthy') return !!left;
  if (operator === 'falsy') return !left;
  if (operator === 'contains')
    return String(left ?? '')
      .toLowerCase()
      .includes(String(right ?? '').toLowerCase());
  if (operator === 'eq') return left === right;
  if (operator === 'neq') return left !== right;

  const leftNum = Number(left);
  const rightNum = Number(right);
  if (!Number.isFinite(leftNum) || !Number.isFinite(rightNum)) return false;
  if (operator === 'gt') return leftNum > rightNum;
  if (operator === 'gte') return leftNum >= rightNum;
  if (operator === 'lt') return leftNum < rightNum;
  if (operator === 'lte') return leftNum <= rightNum;
  return false;
}

function evaluateTriggerConditions(trigger, context) {
  const conditions = Array.isArray(trigger?.conditions) ? trigger.conditions : [];
  if (conditions.length === 0) return true;
  const mode = trigger?.conditionMode === 'any' ? 'any' : 'all';
  return mode === 'any'
    ? conditions.some((condition) => evaluateTriggerCondition(condition, context))
    : conditions.every((condition) => evaluateTriggerCondition(condition, context));
}

function getRuntimeObjectVisualState(
  objectStates = {},
  hiddenObjectIds = new Set(),
  objectId = ''
) {
  return {
    visited: !!objectStates?.[objectId]?.visited,
    selected: !!objectStates?.[objectId]?.selected,
    disabled: !!objectStates?.[objectId]?.disabled,
    hidden: hiddenObjectIds?.has?.(objectId) || false,
  };
}

function getTriggerSourceMatches(trigger, objectId) {
  const source = trigger?.target || 'Secili Nesne';
  if (objectId === '__activity__')
    return source === '__activity__' || source === 'Sahne' || source === 'Secili Nesne';
  return (
    source === objectId ||
    source === 'Secili Nesne' ||
    source === 'TiklananNesne' ||
    source === 'selected'
  );
}

function runPreviewTriggers({
  activity,
  activities,
  objectId,
  when = 'onClick',
  onNextActivity,
  onGoToActivity,
  onGoToSlide,
  setActiveLayerId,
  hiddenObjectIds,
  setHiddenObjectIds,
  variables,
  setVariables,
  variableDefinitions,
  objectStates,
  setObjectStates,
}) {
  const triggers = (activity?.triggers || [])
    .filter(
      (trigger) =>
        (trigger.when || 'onClick') === when && getTriggerSourceMatches(trigger, objectId)
    )
    .filter((trigger) =>
      evaluateTriggerConditions(trigger, {
        variables,
        variableDefinitions,
        objectStates,
        hiddenObjectIds,
      })
    );
  if (triggers.length === 0) return false;

  triggers.forEach((trigger) => {
    const action = trigger.action || 'Goster';
    const value = trigger.value || '';

    if (action === 'SayfaGec') {
      if (value === '__next__') {
        onNextActivity?.();
        return;
      }
      if (activities?.some?.((item) => item.id === value)) onGoToActivity?.(value);
      return;
    }

    if (action === 'SliderGec') {
      onGoToSlide?.(value || '__next__');
      return;
    }

    if (action === 'KatmanaGec') {
      const layerExists = getActivityLayers(activity).some((layer) => layer.id === value);
      if (layerExists) setActiveLayerId?.(value);
      return;
    }

    if (action === 'Goster') {
      setHiddenObjectIds?.((prev) => {
        const next = new Set(prev);
        next.delete(value);
        return next;
      });
      return;
    }

    if (action === 'Gizle') {
      setHiddenObjectIds?.((prev) => {
        const next = new Set(prev);
        if (value) next.add(value);
        return next;
      });
      return;
    }

    if (action === 'DegiskenAta') {
      const variable = getVariableDefinition(variableDefinitions, value);
      if (!variable) return;
      setVariables?.((prev) => ({
        ...prev,
        [value]: castVariableValue(variable.type, trigger.extra ?? ''),
      }));
      return;
    }

    if (action === 'DegiskenArttir' || action === 'DegiskenAzalt') {
      const variable = getVariableDefinition(variableDefinitions, value);
      if (!variable) return;
      const delta = Number(trigger.extra ?? 1) || 1;
      setVariables?.((prev) => ({
        ...prev,
        [value]:
          (Number(prev?.[value] ?? variable.value ?? 0) || 0) +
          (action === 'DegiskenArttir' ? delta : -delta),
      }));
      return;
    }

    if (action === 'NesneDurumuAyarla') {
      const stateKey = trigger.stateKey || 'visited';
      const nextStateValue = normalizeRuntimeValue(trigger.stateValue ?? 'true');
      if (stateKey === 'hidden') {
        setHiddenObjectIds?.((prev) => {
          const next = new Set(prev);
          if (nextStateValue) next.add(value);
          else next.delete(value);
          return next;
        });
        return;
      }
      setObjectStates?.((prev) => ({
        ...prev,
        [value]: {
          ...(prev?.[value] || {}),
          [stateKey]: !!nextStateValue,
        },
      }));
    }
  });

  return true;
}

function RuntimeObjectLayer({
  activity,
  activeLayerId,
  hiddenObjectIds,
  objectStates = {},
  onRunTriggers,
  onSelectionChoice,
  selectedObjectIds = [],
  hintObjectIds = [],
  selectionFeedbackById = {},
  scale,
  includeDragDrop = false,
  currentTime = 0,
}) {
  const objects = getCanvasObjects(activity, activeLayerId, hiddenObjectIds)
    .filter((obj) => isObjectTimelineActive(activity, obj.id, currentTime))
    .filter((obj) => obj.visible !== false)
    .filter((obj) => includeDragDrop || (obj.type !== 'draggable' && obj.type !== 'dropzone'))
    .sort((a, b) => a.zIndex - b.zIndex);
  const selectionUi = getSelectionUi(activity);

  return objects.map((obj) => {
    const st = obj.style || {};
    const isImage = !!obj.imageData;
    const runtimeState = getRuntimeObjectVisualState(objectStates, hiddenObjectIds, obj.id);
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
    const clickable =
      !runtimeState.disabled &&
      (isSelectionOverlay ||
        (activity.triggers || []).some(
          (trigger) =>
            (trigger.when || 'onClick') === 'onClick' && getTriggerSourceMatches(trigger, obj.id)
        ));
    const hoverable =
      !runtimeState.disabled &&
      (activity.triggers || []).some(
        (trigger) =>
          (trigger.when || 'onClick') === 'onHover' && getTriggerSourceMatches(trigger, obj.id)
      );

    return (
      <div
        key={obj.id}
        onClick={
          clickable
            ? () => {
                if (isSelectionOverlay) {
                  onSelectionChoice?.(obj.id);
                  return;
                }
                onRunTriggers?.(obj.id, 'onClick');
              }
            : undefined
        }
        onMouseEnter={hoverable ? () => onRunTriggers?.(obj.id, 'onHover') : undefined}
        style={{
          position: 'absolute',
          left: obj.x * scale,
          top: obj.y * scale,
          width: obj.width * scale,
          height: obj.height * scale,
          transform: `translate(${motionStyle.translateX * scale}px, ${motionStyle.translateY * scale}px) rotate(${obj.rotation || 0}deg) scale(${motionStyle.scale})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: isImage
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
          border: `${obj.type === 'hotspot' ? 2 : 1}px ${st.borderStyle || 'solid'} ${st.borderColor || 'transparent'}`,
          borderRadius: (st.borderRadius || 0) * scale,
          boxSizing: 'border-box',
          color: st.color || '#111',
          fontSize: Math.max(10, (st.fontSize || 13) * scale),
          fontWeight: obj.type === 'button' ? 700 : 600,
          textAlign: 'center',
          padding: isImage ? 0 : `${6 * scale}px`,
          cursor: clickable ? 'pointer' : 'default',
          pointerEvents: clickable || hoverable ? 'auto' : 'none',
          opacity: (runtimeState.disabled ? 0.45 : 1) * motionStyle.opacity,
          boxShadow: isSelected
            ? '0 0 0 3px rgba(255,255,255,.55), 0 12px 30px rgba(15,23,42,.18)'
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
            }}
          >
            {isWrongFeedback
              ? wrongGlyph
              : isCorrectFeedback || isSelected
                ? getSelectionMarkGlyph(selectionMark)
                : ''}
          </span>
        ) : obj.type === 'video' && obj.mediaUrl ? (
          <video
            src={obj.mediaUrl}
            controls={obj.showPlayerControls !== false}
            autoPlay={!!obj.autoPlay}
            muted={obj.muted !== false}
            loop={!!obj.loop}
            playsInline
            preload="metadata"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              pointerEvents: 'auto',
              background: '#020617',
            }}
          />
        ) : obj.type === 'audio' && obj.mediaUrl ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '0 12px',
              background: 'linear-gradient(135deg,#082f49,#0f172a)',
              color: '#e0f2fe',
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 999,
                background: 'rgba(56,189,248,.18)',
                border: '1px solid rgba(56,189,248,.42)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
                flexShrink: 0,
              }}
            >
              ♪
            </div>
            <audio
              src={obj.mediaUrl}
              controls={obj.showPlayerControls !== false}
              autoPlay={!!obj.autoPlay}
              muted={obj.muted !== false}
              loop={!!obj.loop}
              preload="metadata"
              style={{ width: '100%' }}
            />
          </div>
        ) : obj.type === 'shape' ? (
          <span style={{ pointerEvents: 'none' }}>{obj.label || 'Sekil'}</span>
        ) : isImage ? (
          <img
            src={obj.imageData}
            alt={obj.label || obj.type}
            style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }}
          />
        ) : (
          <span
            style={{
              pointerEvents: 'none',
              color: st.color || '#111',
            }}
          >
            {obj.label || obj.type}
          </span>
        )}
      </div>
    );
  });
}

export {
  getInitialPreviewPhase,
  getVariableDefinition,
  buildRuntimeVariableMap,
  normalizeRuntimeValue,
  getRuntimeObjectStateValue,
  evaluateTriggerCondition,
  evaluateTriggerConditions,
  getRuntimeObjectVisualState,
  getTriggerSourceMatches,
  runPreviewTriggers,
  RuntimeObjectLayer,
};
