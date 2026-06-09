import { parseAndEvaluate } from '../logic/formulaEngine';

import {
  findRuntimeLayerByKeys,
  getRuntimeButtonAction,
  normalizeRuntimeActionLabel,
} from './storylineRuntime';

const DEFAULT_STORYLINE_DRAG_DROP_SETTINGS = {
  isolateScopes: true,
  allowCrossScope: false,
  allowMultipleItemsPerDrop: false,
  allowMultipleTargetsPerDrag: false,
};

export function getStorylineRuntimeKey(value = '') {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]/g, '');
}

export function isStorylineRuntimeDropTargetLikeObject(object = {}) {
  if (!object) return false;
  if (object.type === 'dropzone') return true;
  if (
    object.type === 'draggable' ||
    object.isPdfBackground ||
    object.isPdfMask ||
    object.visible === false
  )
    return false;
  if (
    object.isCheckButton ||
    object.selectionQuestionId ||
    object.type === 'video' ||
    object.type === 'audio' ||
    object.type === 'embed'
  )
    return false;

  const label = String(object.label || '').trim();
  const labelKey = getStorylineRuntimeKey(label);
  const width = Number(object.width) || 0;
  const height = Number(object.height) || 0;
  const style = object.style || {};
  const colorText =
    `${style.background || ''} ${style.borderColor || ''} ${style.color || ''}`.toLowerCase();
  const isBlankAnswerShape = !label && width >= 90 && height >= 20 && height <= 90;
  const isNamedAnswerShape = ['bosluk', 'birak', 'drop', 'cevap'].some((term) =>
    labelKey.includes(term)
  );
  const looksOrange = /#ea5b0c|#f97316|#fb923c|orange|rgb\(234,\s*91,\s*12\)/i.test(colorText);
  return (isBlankAnswerShape || isNamedAnswerShape) && looksOrange;
}

export function getStorylineRuntimeObjectKey(object = {}) {
  return String(object?.__runtimeId || object?.__previewId || object?.id || '');
}

export function withStorylineRuntimeObjectKeys(objects = []) {
  const seen = {};
  const usedRuntimeIds = new Set();
  return (objects || []).map((object, index) => {
    if (!object) return object;
    const existingRuntimeId = String(object.__runtimeId || '').trim();
    if (existingRuntimeId && !usedRuntimeIds.has(existingRuntimeId)) {
      usedRuntimeIds.add(existingRuntimeId);
      return { ...object, __runtimeId: existingRuntimeId };
    }
    const base = String(object.__previewId || object.id || object.type || 'obj');
    seen[base] = (seen[base] || 0) + 1;
    let runtimeId = seen[base] === 1 ? base : `${base}__runtime_${seen[base]}_${index}`;
    while (usedRuntimeIds.has(runtimeId)) {
      seen[base] += 1;
      runtimeId = `${base}__runtime_${seen[base]}_${index}`;
    }
    usedRuntimeIds.add(runtimeId);
    return { ...object, __runtimeId: runtimeId };
  });
}

export function normalizeStorylineDragDropMatchValue(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))];
  }
  const raw = String(value || '').trim();
  return raw ? [raw] : [];
}

export function getStorylineDragDropPairKey(dragId = '', dropId = '') {
  return `${dragId}__${dropId}`;
}

export function getStorylineDragDropPairsFromMatches(matches = {}) {
  const seen = new Set();
  return Object.entries(matches || {}).flatMap(([dragId, raw]) =>
    normalizeStorylineDragDropMatchValue(raw).flatMap((dropId) => {
      const pairKey = getStorylineDragDropPairKey(dragId, dropId);
      if (seen.has(pairKey)) return [];
      seen.add(pairKey);
      return [{ dragId, dropId }];
    })
  );
}

function getDragDropSettings(slide = {}) {
  return {
    ...DEFAULT_STORYLINE_DRAG_DROP_SETTINGS,
    ...(slide?.dragDropSettings || {}),
  };
}

function areScopesCompatible(slide = {}, drag = {}, drop = {}) {
  const settings = getDragDropSettings(slide);
  if (!settings.isolateScopes || settings.allowCrossScope) return true;
  const dragScope = getStorylineRuntimeKey(drag?.scope || '');
  const dropScope = getStorylineRuntimeKey(drop?.scope || '');
  if (!dragScope && !dropScope) return true;
  return !!dragScope && !!dropScope && dragScope === dropScope;
}

function isDragReusable(slide = {}, drag = {}) {
  const settings = getDragDropSettings(slide);
  return !!(drag?.allowMultipleTargets || settings.allowMultipleTargetsPerDrag);
}

function getDropCapacityLimit(slide = {}, drop = {}) {
  const settings = getDragDropSettings(slide);
  const explicit = Number(drop?.capacity);
  if (Number.isFinite(explicit) && explicit > 0) return Math.max(1, Math.round(explicit));
  return settings.allowMultipleItemsPerDrop ? 0 : 1;
}

function getBaseRuntimeObjects(slide = {}, objects = null) {
  return withStorylineRuntimeObjectKeys(objects || slide?.objects || [])
    .filter(
      (object) => object && object.visible !== false && !object.isPdfBackground && !object.isPdfMask
    )
    .filter((object) => (object.layerId || 'base') === 'base');
}

export function buildStorylineRuntimeAutoDragMatches({ slide = {}, objects = null } = {}) {
  const baseObjects = getBaseRuntimeObjects(slide, objects);
  const drags = baseObjects.filter((object) => object.type === 'draggable');
  const drops = baseObjects.filter(isStorylineRuntimeDropTargetLikeObject);
  const preferArrays = drags.some((drag) => isDragReusable(slide, drag));
  const usedDropCounts = {};
  const grouped = {};

  drags.forEach((drag, index) => {
    const scopeFiltered = drops.filter((drop) => areScopesCompatible(slide, drag, drop));
    if (!scopeFiltered.length) return;

    const sameGroup = drag.group
      ? scopeFiltered.filter(
          (drop) =>
            getStorylineRuntimeKey(drop.group || '') === getStorylineRuntimeKey(drag.group || '')
        )
      : [];
    const sameLabel = drag.label
      ? scopeFiltered.filter(
          (drop) =>
            getStorylineRuntimeKey(drop.label || '') === getStorylineRuntimeKey(drag.label || '')
        )
      : [];
    const basePool = sameGroup.length ? sameGroup : sameLabel.length ? sameLabel : scopeFiltered;
    const reusable = isDragReusable(slide, drag);
    const acceptedDropIds = [];

    basePool.forEach((drop, candidateIndex) => {
      const capacity = getDropCapacityLimit(slide, drop);
      const currentCount = usedDropCounts[drop.id] || 0;
      const canUseDrop = capacity === 0 || currentCount < capacity;
      const isFallbackCandidate = !sameGroup.length && !sameLabel.length;
      if (!canUseDrop) return;
      if (!reusable && candidateIndex > 0) return;
      if (reusable && isFallbackCandidate && candidateIndex > 0) return;
      acceptedDropIds.push(drop.id);
      usedDropCounts[drop.id] = currentCount + 1;
    });

    if (!acceptedDropIds.length) {
      const fallback = scopeFiltered[index] || scopeFiltered[0];
      if (!fallback) return;
      const capacity = getDropCapacityLimit(slide, fallback);
      const currentCount = usedDropCounts[fallback.id] || 0;
      if (capacity !== 0 && currentCount >= capacity) return;
      acceptedDropIds.push(fallback.id);
      usedDropCounts[fallback.id] = currentCount + 1;
    }

    acceptedDropIds.forEach((dropId) => {
      grouped[drag.id] = grouped[drag.id] || [];
      if (!grouped[drag.id].includes(dropId)) grouped[drag.id].push(dropId);
    });
  });

  return Object.fromEntries(
    Object.entries(grouped).map(([dragId, dropIds]) => [
      dragId,
      preferArrays || dropIds.length > 1 ? dropIds : dropIds[0],
    ])
  );
}

export function getStorylineRuntimeCorrectDragMatches({ slide = {}, objects = null } = {}) {
  const explicit = slide?.dragDropMatches || {};
  const drags = getBaseRuntimeObjects(slide, objects).filter(
    (object) => object.type === 'draggable'
  );
  const hasExplicit = drags.some(
    (drag) => normalizeStorylineDragDropMatchValue(explicit[drag.id]).length
  );
  return hasExplicit ? explicit : buildStorylineRuntimeAutoDragMatches({ slide, objects });
}

function getSelectionLetter(index = 0) {
  return String.fromCharCode(65 + index);
}

function getCorrectSelectionChoiceKeys(slide = {}) {
  const correctOptions = (slide.mcOptions || [])
    .map((option, index) => ({ option, index }))
    .filter(({ option }) => option?.isCorrect);
  if (correctOptions.length) {
    return new Set(
      correctOptions.flatMap(({ option, index }) =>
        [
          option.id,
          option.label,
          getSelectionLetter(index),
          String(index + 1),
        ].map(getStorylineRuntimeKey)
      )
    );
  }

  const slots = Array.isArray(slide.selectionSlots)
    ? slide.selectionSlots.filter((slot) => String(slot?.correctChoice || '').trim())
    : [];
  if (slots.length) {
    return new Set(
      slots.flatMap((slot) =>
        [slot.id, slot.correctChoice, slot.correctLabel].map(getStorylineRuntimeKey)
      )
    );
  }

  return null;
}

export function evaluateStorylineRuntimeSelection({ slide = {}, objects = null, state = {} } = {}) {
  const baseObjects = getBaseRuntimeObjects(slide, objects);
  const selectionObjects = baseObjects.filter((object) => object?.selectionQuestionId);
  const correctChoiceKeys = getCorrectSelectionChoiceKeys(slide);
  const expected = selectionObjects
    .filter((object, index) => {
      if (correctChoiceKeys) {
        const keys = [
          object.id,
          object.selectionChoice,
          object.label,
          getSelectionLetter(index),
          String(index + 1),
        ].map(getStorylineRuntimeKey);
        return keys.some((key) => correctChoiceKeys.has(key));
      }
      return object.selectionCorrect === true;
    })
    .map((object) => getStorylineRuntimeObjectKey(object));
  const expectedSet = new Set(expected);
  const selected = selectionObjects
    .filter((object) => {
      const key = getStorylineRuntimeObjectKey(object);
      return !!(
        state.objectStates?.[key]?.selected ||
        state.objectStates?.[object.id]?.selected
      );
    })
    .map((object) => getStorylineRuntimeObjectKey(object));
  const selectedSet = new Set(selected);
  const missing = expected.filter((key) => !selectedSet.has(key));
  const extra = selected.filter((key) => !expectedSet.has(key));
  const hasSelectionTask = selectionObjects.length > 0 && expected.length > 0;
  return {
    type: 'selection',
    success: hasSelectionTask && missing.length === 0 && extra.length === 0,
    expected,
    selected,
    missing,
    extra,
    expectedCount: expected.length,
  };
}

export function getStorylineRuntimeSnapPosition({
  drag = {},
  drop = {},
  stageWidth = 1920,
  stageHeight = 1080,
} = {}) {
  const objW = Number(drag.width) || 1;
  const objH = Number(drag.height) || 1;
  const x = (Number(drop.x) || 0) + ((Number(drop.width) || 1) - objW) / 2;
  const y = (Number(drop.y) || 0) + ((Number(drop.height) || 1) - objH) / 2;
  return {
    x: Math.max(0, Math.min(x, (Number(stageWidth) || 1920) - objW)),
    y: Math.max(0, Math.min(y, (Number(stageHeight) || 1080) - objH)),
  };
}

export function findStorylineRuntimeDropTarget({
  slide = {},
  drag = {},
  drops = [],
  x = 0,
  y = 0,
  pointerX = null,
  pointerY = null,
} = {}) {
  const dragW = Number(drag.width) || 1;
  const dragH = Number(drag.height) || 1;
  const compatibleDrops = (drops || []).filter(isStorylineRuntimeDropTargetLikeObject);

  if (Number.isFinite(pointerX) && Number.isFinite(pointerY)) {
    // İmleç doğrudan bir hedefin içindeyse onu seç. Komşu/yakın hedeflerde yanlış
    // hedefe bırakmayı önlemek için isabet alanını genişletmiyoruz; birden çok
    // hedef üst üste biniyorsa merkezi imlece en yakın olanı seçeriz. Gevşeklik,
    // aşağıdaki "öğe merkezi içerme" ve "en yakın hedef" geri dönüşleriyle sağlanır.
    const pointerDrops = compatibleDrops.filter(
      (drop) =>
        pointerX >= (Number(drop.x) || 0) &&
        pointerX <= (Number(drop.x) || 0) + (Number(drop.width) || 0) &&
        pointerY >= (Number(drop.y) || 0) &&
        pointerY <= (Number(drop.y) || 0) + (Number(drop.height) || 0)
    );
    if (pointerDrops.length === 1) return pointerDrops[0];
    if (pointerDrops.length > 1) {
      let bestPointerDrop = null;
      let bestPointerDist = Infinity;
      pointerDrops.forEach((drop) => {
        const cx = (Number(drop.x) || 0) + (Number(drop.width) || 0) / 2;
        const cy = (Number(drop.y) || 0) + (Number(drop.height) || 0) / 2;
        const dist = Math.hypot(pointerX - cx, pointerY - cy);
        if (dist < bestPointerDist) {
          bestPointerDist = dist;
          bestPointerDrop = drop;
        }
      });
      return bestPointerDrop;
    }
  }

  const dragCenterX = x + dragW / 2;
  const dragCenterY = y + dragH / 2;
  const containing = compatibleDrops.find(
    (drop) =>
      dragCenterX >= (Number(drop.x) || 0) &&
      dragCenterX <= (Number(drop.x) || 0) + (Number(drop.width) || 0) &&
      dragCenterY >= (Number(drop.y) || 0) &&
      dragCenterY <= (Number(drop.y) || 0) + (Number(drop.height) || 0)
  );
  if (containing) return containing;

  let bestDrop = null;
  let bestOverlap = 0;
  compatibleDrops.forEach((drop) => {
    const left = Math.max(x, Number(drop.x) || 0);
    const top = Math.max(y, Number(drop.y) || 0);
    const right = Math.min(x + dragW, (Number(drop.x) || 0) + (Number(drop.width) || 0));
    const bottom = Math.min(y + dragH, (Number(drop.y) || 0) + (Number(drop.height) || 0));
    const overlap = Math.max(0, right - left) * Math.max(0, bottom - top);
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      bestDrop = drop;
    }
  });
  if (bestOverlap > 0) return bestDrop;

  if (Number.isFinite(pointerX) && Number.isFinite(pointerY)) {
    let nearestDrop = null;
    let nearestDistance = Infinity;
    compatibleDrops.forEach((drop) => {
      const dropCenterX = (Number(drop.x) || 0) + (Number(drop.width) || 0) / 2;
      const dropCenterY = (Number(drop.y) || 0) + (Number(drop.height) || 0) / 2;
      const distance = Math.hypot(pointerX - dropCenterX, pointerY - dropCenterY);
      const settings = getDragDropSettings(slide);
      const threshold = Math.max(
        10,
        Math.min(
          500,
          (settings.snapTolerance || 20) * 3
        )
      );
      if (distance <= threshold && distance < nearestDistance) {
        nearestDistance = distance;
        nearestDrop = drop;
      }
    });
    if (nearestDrop) return nearestDrop;
  }

  return null;
}

export function evaluateStorylineRuntimeDragDrop({
  slide = {},
  objects = null,
  state = {},
  dropAssignments = null,
  expectedMatches = null,
} = {}) {
  const baseObjects = getBaseRuntimeObjects(slide, objects);
  const byKey = Object.fromEntries(
    baseObjects.map((object) => [getStorylineRuntimeObjectKey(object), object])
  );
  const byId = {};
  baseObjects.forEach((object) => {
    byId[object.id] = byId[object.id] || object;
  });
  const expected = getStorylineDragDropPairsFromMatches(
    expectedMatches || getStorylineRuntimeCorrectDragMatches({ slide, objects: baseObjects })
  );
  const isGroupMode = ['group', 'multi-group'].includes(slide?.dragDropMode);
  const expectedDropIds = [...new Set(expected.map((entry) => entry.dropId).filter(Boolean))];
  const objectAnswerTokens = (object = {}) =>
    [
      object?.label,
      object?.name,
      object?.group,
      object?.id,
    ]
      .map(getStorylineRuntimeKey)
      .filter(Boolean);
  const isGroupEquivalentPlacement = (entry) => {
    if (!isGroupMode) return false;
    const placedDrag = byKey[entry.dragKey] || byId[entry.dragId] || null;
    const placedTokens = objectAnswerTokens(placedDrag);
    if (!placedTokens.length) return false;
    return expected.some(({ dragId, dropId }) => {
      if (dropId !== entry.dropId) return false;
      const expectedDrag = byId[dragId] || byKey[dragId] || null;
      const expectedTokens = new Set(objectAnswerTokens(expectedDrag));
      return placedTokens.some((token) => expectedTokens.has(token));
    });
  };
  const expectedCounts = {};
  expected.forEach(({ dragId, dropId }) => {
    const key = getStorylineDragDropPairKey(dragId, dropId);
    expectedCounts[key] = (expectedCounts[key] || 0) + 1;
  });

  const assignments = dropAssignments || state.dropAssignments || {};
  const placements = Object.entries(assignments)
    .filter(([dragKey, dropKey]) => dragKey && dropKey)
    .map(([dragKey, dropKey]) => {
      // "Aynı öğe çoklu hedefe" klonları `${baseKey}@@${uniq}` anahtarıyla
      // saklanır. Eşleşme için temel (base) sürüklenebilir kimliğini çözeriz;
      // dragKey'i (klon anahtarı) ise durum/highlight için olduğu gibi tutarız.
      const baseDragKey = dragKey.includes('@@') ? dragKey.split('@@')[0] : dragKey;
      const drag = byKey[baseDragKey] || byId[baseDragKey] || null;
      const drop = byKey[dropKey] || byId[dropKey] || null;
      return {
        id: getStorylineDragDropPairKey(dragKey, dropKey),
        dragKey,
        dropKey,
        dragId: drag?.id || baseDragKey,
        dropId: drop?.id || dropKey,
      };
    });

  const placementResult = {};
  const correctDropIds = new Set();
  placements.forEach((entry) => {
    const key = getStorylineDragDropPairKey(entry.dragId, entry.dropId);
    if (expectedCounts[key] > 0) {
      placementResult[entry.id] = true;
      expectedCounts[key] -= 1;
      correctDropIds.add(entry.dropId);
    } else if (isGroupEquivalentPlacement(entry)) {
      placementResult[entry.id] = true;
      correctDropIds.add(entry.dropId);
    } else {
      placementResult[entry.id] = false;
    }
  });

  const allExpectedUsed = isGroupMode
    ? expectedDropIds.length > 0 && expectedDropIds.every((dropId) => correctDropIds.has(dropId))
    : Object.values(expectedCounts).every((count) => count === 0);
  const allPlacedCorrect = placements.every((entry) => placementResult[entry.id] === true);
  return {
    success: expected.length > 0 && allExpectedUsed && allPlacedCorrect,
    placements,
    placementResult,
    expectedCount: isGroupMode ? expectedDropIds.length : expected.length,
  };
}

export function getStorylineRuntimeDropResultStates(result = {}) {
  return (result.placements || []).reduce((states, entry) => {
    const correct = !!result.placementResult?.[entry.id];
    states[entry.dragKey] = {
      ...(states[entry.dragKey] || {}),
      dropCorrect: correct,
      dropIncorrect: !correct,
    };
    states[entry.dropKey] = {
      ...(states[entry.dropKey] || {}),
      dropCorrect: correct,
      dropIncorrect: !correct,
    };
    return states;
  }, {});
}

export function castStorylineRuntimeValue(type = 'text', value = '') {
  if (type === 'number') {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }
  if (type === 'boolean') {
    if (typeof value === 'boolean') return value;
    const normalized = String(value).trim().toLowerCase();
    return ['true', '1', 'evet', 'yes', 'on'].includes(normalized);
  }
  return String(value ?? '');
}

export function buildStorylineRuntimeVariableMap(variableDefinitions = []) {
  return Object.fromEntries(
    (variableDefinitions || []).map((variable) => [
      variable.id,
      castStorylineRuntimeValue(variable.type, variable.value),
    ])
  );
}

export function normalizeStorylineRuntimeValue(value) {
  if (typeof value === 'boolean' || typeof value === 'number') return value;
  const raw = String(value ?? '').trim();
  if (raw === '') return '';
  const lowered = raw.toLowerCase();
  if (['true', 'false'].includes(lowered)) return lowered === 'true';
  const numeric = Number(raw);
  return Number.isFinite(numeric) && raw !== '' ? numeric : raw;
}

export function getStorylineTriggerSourceMatches(trigger = {}, objectId = '') {
  const source = trigger?.target || '';
  const sourceKey = normalizeRuntimeActionLabel(source);
  if (objectId === '__activity__') {
    return source === '__activity__' || sourceKey === 'sahne';
  }
  return (
    source === objectId ||
    sourceKey === 'tiklanannesne' ||
    sourceKey === 'selected'
  );
}

function getStorylineRuntimeObjectById(objects = [], objectId = '') {
  if (!objectId) return null;
  return (
    (objects || []).find(
      (object) =>
        object?.id === objectId ||
        object?.__runtimeId === objectId ||
        object?.__previewId === objectId
    ) || null
  );
}

function getStorylineRuntimeSourceCandidates({
  slide = {},
  sourceId = '',
  sourceObject = null,
  sourceIds = null,
  sourceObjects = null,
} = {}) {
  const slideObjects = Array.isArray(slide?.objects) ? slide.objects : [];
  const explicitObjects = Array.isArray(sourceObjects)
    ? sourceObjects
    : sourceObjects && typeof sourceObjects === 'object'
      ? Object.values(sourceObjects)
      : [];
  const objectPool = [...explicitObjects, ...slideObjects].filter(Boolean);
  const candidates = [];
  const seen = new Set();
  const findObject = (id = '') =>
    getStorylineRuntimeObjectById(objectPool, id) ||
    (sourceObject &&
    (sourceObject.id === id ||
      sourceObject.__runtimeId === id ||
      sourceObject.__previewId === id)
      ? sourceObject
      : null);
  const addCandidate = (id = '', object = null) => {
    const resolvedObject = object || findObject(id);
    const resolvedId = String(resolvedObject?.id || id || '').trim();
    if (!resolvedId || seen.has(resolvedId)) return;
    seen.add(resolvedId);
    candidates.push({ id: resolvedId, object: resolvedObject || null });
  };

  const rawSourceIds =
    Array.isArray(sourceIds) && sourceIds.length ? sourceIds : [sourceId].filter(Boolean);
  rawSourceIds.forEach((id) => addCandidate(id));
  if (sourceObject?.id) addCandidate(sourceObject.id, sourceObject);
  if (sourceObject && sourceId) addCandidate(sourceId, sourceObject);

  for (const candidate of [...candidates]) {
    const object = candidate.object || findObject(candidate.id);
    if (!object) continue;
    const linkedActionTargetId = String(object.linkedActionTargetId || '').trim();
    if (linkedActionTargetId) addCandidate(linkedActionTargetId);

    const linkedHoverGroup = String(object.linkedHoverGroup || '').trim();
    if (linkedHoverGroup) {
      slideObjects.forEach((item) => {
        if (String(item?.linkedHoverGroup || '').trim() === linkedHoverGroup) {
          addCandidate(item.id, item);
        }
      });
    }
  }

  return candidates.length
    ? candidates
    : sourceId
      ? [{ id: sourceId, object: sourceObject || null }]
      : [];
}

function getStorylineDropTriggerSourceMatches(trigger = {}, objectId = '') {
  const source = trigger?.target || '';
  if (!objectId || !source) return false;
  return source === objectId;
}

function isHidden(runtimeState = {}, objectId = '') {
  const hiddenObjectIds = runtimeState.hiddenObjectIds;
  if (hiddenObjectIds?.has?.(objectId)) return true;
  return !!runtimeState.hidden?.[objectId];
}

export function getStorylineRuntimeObjectStateValue(
  runtimeState = {},
  objectId = '',
  stateKey = 'visited'
) {
  if (!objectId) return null;
  if (stateKey === 'hidden') return isHidden(runtimeState, objectId);
  return runtimeState.objectStates?.[objectId]?.[stateKey] ?? false;
}

function getVariableDefinition(variableDefinitions = [], variableId = '') {
  return (variableDefinitions || []).find((variable) => variable.id === variableId) || null;
}

export function evaluateStorylineTriggerCondition(condition = {}, context = {}) {
  const {
    variables = {},
    variableDefinitions = [],
    objectStates = {},
    hiddenObjectIds = new Set(),
    hidden = {},
  } = context;
  const sourceType = condition?.sourceType || 'variable';
  const operator = condition?.operator || 'eq';
  let left = '';

  if (sourceType === 'objectState') {
    left = getStorylineRuntimeObjectStateValue(
      { objectStates, hiddenObjectIds, hidden },
      condition?.sourceId || '',
      condition?.stateKey || 'visited'
    );
  } else {
    const variable = getVariableDefinition(variableDefinitions, condition?.sourceId || '');
    left = variable
      ? castStorylineRuntimeValue(variable.type, variables?.[variable.id])
      : (variables?.[condition?.sourceId || ''] ?? '');
  }

  const right = normalizeStorylineRuntimeValue(condition?.value ?? '');

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

export function evaluateStorylineTriggerConditions(trigger = {}, context = {}) {
  const conditions = Array.isArray(trigger?.conditions) ? trigger.conditions : [];
  if (conditions.length === 0) return true;
  const mode = trigger?.conditionMode === 'any' ? 'any' : 'all';
  return mode === 'any'
    ? conditions.some((condition) => evaluateStorylineTriggerCondition(condition, context))
    : conditions.every((condition) => evaluateStorylineTriggerCondition(condition, context));
}

function isStorylineCheckButton(object = {}) {
  if (
    object?.generatedBy === 'scene-template' &&
    object?.sceneTemplateId === 'button-intro' &&
    !isButtonIntroRuntimeControl(object)
  )
    return false;
  const labelKey = normalizeRuntimeActionLabel(object?.label || object?.text || '');
  return !!(object?.isCheckButton || labelKey.includes('kontrol'));
}

function isButtonIntroRuntimeControl(object = {}) {
  const slotId = String(object?.sceneTemplateSlotId || '');
  return (
    slotId.endsWith(':start-button') ||
    slotId.endsWith(':start-icon') ||
    slotId.endsWith(':close-button')
  );
}

function isButtonIntroPlayPauseDemoButton(object = {}) {
  if (!object || (object.type && object.type !== 'button')) return false;
  if (object.sceneTemplateDemoAction === 'toggle-play-pause') return true;
  if (object.sceneTemplateId !== 'button-intro') return false;
  const raw = String(object.label || object.text || '');
  const labelKey = normalizeRuntimeActionLabel(raw);
  return (
    raw.includes('❚❚') ||
    labelKey.includes('play') ||
    labelKey.includes('pause') ||
    labelKey.includes('oynat') ||
    labelKey.includes('duraklat')
  );
}

function getButtonIntroDemoStateTargetId(sourceId = '', object = {}) {
  const linkedTargetId = String(object?.linkedActionTargetId || '').trim();
  return linkedTargetId || sourceId;
}

export function getStorylineRuntimeCommandsForAction(
  action = '',
  { slide = {}, reasonPrefix = 'runtime' } = {}
) {
  if (action === 'restart')
    // "Yeniden Başlat" butonu: başka slayta gitmek yerine mevcut slaytın
    // denemesini sıfırlayıp base layer'a döner.
    return [
      { type: 'resetAttempt', reason: `${reasonPrefix}-restart-button` },
      { type: 'setLayer', layerId: 'base' },
    ];
  if (action === 'home') return [{ type: 'goHome', reason: `${reasonPrefix}-home-button` }];
  if (action === 'answer') {
    const layer = findRuntimeLayerByKeys(slide.layers || [], ['cevap', 'answer']);
    return layer
      ? [
          { type: 'resetAttempt', reason: `${reasonPrefix}-answer-button` },
          { type: 'setLayer', layerId: layer.id },
        ]
      : [{ type: 'log', action, message: "Cevap layer'ı bulunamadı.", data: { action } }];
  }
  if (action === 'help') {
    const layer = findRuntimeLayerByKeys(slide.layers || [], [
      'explanation',
      'aciklama',
      'help',
      'yardim',
      'kilavuz',
      'kullanimkilavuzu',
      'menu',
    ]);
    return layer
      ? [{ type: 'setLayer', layerId: layer.id }]
      : [
          {
            type: 'log',
            action,
            message: "Kullanım kılavuzu/help layer'ı bulunamadı.",
            data: { action },
          },
        ];
  }
  if (action === 'mute') return [{ type: 'toggleMute' }];
  if (action === 'playback') return [{ type: 'togglePlayback' }];
  if (action === 'complete') return [{ type: 'complete' }];
  return [];
}

function getRuntimeTriggerAction(action = '') {
  const value = String(action || '').replace(/^runtime:/i, '').trim().toLowerCase();
  if (value === 'show-answer') return 'answer';
  if (value === 'toggle-mute') return 'mute';
  if (value === 'toggle-play-pause') return 'playback';
  if (value === 'restart' || value === 'home' || value === 'complete' || value === 'help')
    return value;
  return value;
}

function resolveStorylineRuntimeTemplate(value, variables = {}) {
  if (Array.isArray(value)) {
    return value.map((item) => resolveStorylineRuntimeTemplate(item, variables));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        resolveStorylineRuntimeTemplate(item, variables),
      ])
    );
  }
  if (typeof value !== 'string') return value;
  const exact = value.match(/^\{\{\s*([^}]+?)\s*\}\}$/);
  if (exact) return variables[exact[1]] ?? '';
  return value.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, variableId) =>
    String(variables[variableId] ?? '')
  );
}

function getCommandsForTrigger(trigger = {}, slide = {}, context = {}) {
  if (String(trigger.action || '').startsWith('runtime:')) {
    return getStorylineRuntimeCommandsForAction(getRuntimeTriggerAction(trigger.action), {
      slide,
      reasonPrefix: 'trigger',
    });
  }
  if (trigger.action === 'YenidenBaslat') return [{ type: 'restart', reason: 'trigger-restart' }];
  if (trigger.action === 'KatmanaGec' && trigger.value) {
    const answerLayer = findRuntimeLayerByKeys(slide.layers || [], ['cevap', 'answer']);
    return [
      ...(answerLayer?.id === trigger.value
        ? [{ type: 'resetAttempt', reason: 'trigger-answer-layer' }]
        : []),
      { type: 'setLayer', layerId: trigger.value },
    ];
  }
  if (trigger.action === 'SliderGec') {
    if (trigger.value === '__next__') return [{ type: 'goRelative', direction: 1 }];
    if (trigger.value === '__prev__') return [{ type: 'goRelative', direction: -1 }];
    return trigger.value ? [{ type: 'goToSlide', slideId: trigger.value }] : [];
  }
  if (trigger.action === 'SayfaGec') {
    if (trigger.value === '__next__') return [{ type: 'goRelative', direction: 1 }];
    if (trigger.value === '__prev__') return [{ type: 'goRelative', direction: -1 }];
    return trigger.value ? [{ type: 'goToActivity', activityId: trigger.value }] : [];
  }
  if (trigger.action === 'Goster' && trigger.value)
    return [{ type: 'show', objectId: trigger.value }];
  if (trigger.action === 'Gizle' && trigger.value)
    return [{ type: 'hide', objectId: trigger.value }];
  if ((trigger.action === 'SesCal' || trigger.action === 'VideoCal') && trigger.value)
    return [{ type: 'playMedia', objectId: trigger.value }];
  if ((trigger.action === 'SesDurdur' || trigger.action === 'VideoDurdur') && trigger.value)
    return [{ type: 'pauseMedia', objectId: trigger.value }];
  if (trigger.action === 'NesneToggle' && trigger.value)
    return [{ type: 'toggleHidden', objectId: trigger.value }];
  if (trigger.action === 'NesneDurumuAyarla' && trigger.value) {
    return [
      {
        type: 'setObjectState',
        objectId: trigger.value,
        stateKey: trigger.stateKey || 'visited',
        value: castStorylineRuntimeValue('boolean', trigger.stateValue ?? 'true'),
      },
    ];
  }
  if (trigger.action === 'DegiskenAta' && trigger.value) {
    let evaluatedValue = normalizeStorylineRuntimeValue(trigger.extra);
    try {
      const varMap = {};
      const definitions = context.variableDefinitions || [];
      const values = context.variables || {};
      
      definitions.forEach((def) => {
        if (def?.id) {
          const currentVal = def.id in values ? values[def.id] : def.value;
          varMap[def.id] = currentVal;
          if (def.name) {
            varMap[def.name] = currentVal;
          }
        }
      });
      
      Object.entries(values).forEach(([id, val]) => {
        varMap[id] = val;
      });

      evaluatedValue = parseAndEvaluate(trigger.extra, varMap);
    } catch (e) {
      // Formül geçerli değilse veya parse hatası verirse, fallback olarak normalize edilmiş değeri kullan
    }
    return [
      {
        type: 'setVariable',
        variableId: trigger.value,
        value: evaluatedValue,
      },
    ];
  }
  if (
    (trigger.action === 'DegiskenArttir' || trigger.action === 'DegiskenAzalt') &&
    trigger.value
  ) {
    return [
      {
        type: 'addVariable',
        variableId: trigger.value,
        delta: (trigger.action === 'DegiskenArttir' ? 1 : -1) * (Number(trigger.extra || 1) || 1),
      },
    ];
  }
  if (trigger.action === 'TamamlaGonder' || trigger.action === 'SonucGonder')
    return [{ type: 'complete' }];
  if (trigger.action === 'URLAc' && trigger.value)
    return [{ type: 'openUrl', url: trigger.value }];
  if (trigger.action === 'Yazdir') return [{ type: 'print' }];
  if (trigger.action === 'sendWidgetCommand' && trigger.value) {
    return [
      {
        type: 'sendWidgetCommand',
        widgetId: trigger.value,
        command: trigger.extra || '',
        payload: resolveStorylineRuntimeTemplate(trigger.payload || {}, context.variables || {}),
      },
    ];
  }
  return [];
}

function collapseStorylineNavigationCommands(commands = []) {
  const list = Array.isArray(commands) ? commands : [];
  const navigationPriority = (command) => {
    if (
      command?.type === 'goToSlide' ||
      command?.type === 'goToActivity' ||
      command?.type === 'goHome' ||
      command?.type === 'restart'
    )
      return 4;
    if (command?.type === 'goRelative') return 3;
    if (command?.type === 'complete') return 2;
    return 0;
  };
  let selectedNavigationIndex = -1;
  let selectedNavigationPriority = 0;
  list.forEach((command, index) => {
    const priority = navigationPriority(command);
    if (priority && priority >= selectedNavigationPriority) {
      selectedNavigationIndex = index;
      selectedNavigationPriority = priority;
    }
  });
  if (selectedNavigationIndex < 0) return list;
  return list.filter(
    (command, index) => !navigationPriority(command) || index === selectedNavigationIndex
  );
}

export function getStorylineRuntimeCommandsForObject({
  slide = {},
  sourceId = '',
  sourceObject = null,
  sourceIds = null,
  sourceObjects = null,
  when = 'onClick',
  eventName = '',
  state = {},
  variableDefinitions = [],
} = {}) {
  if (!slide) return [];

  const candidates = getStorylineRuntimeSourceCandidates({
    slide,
    sourceId,
    sourceObject,
    sourceIds,
    sourceObjects,
  });
  const candidateIds = candidates.map((candidate) => candidate.id).filter(Boolean);

  const context = {
    variables: state.variables || {},
    variableDefinitions,
    objectStates: state.objectStates || {},
    hiddenObjectIds: state.hiddenObjectIds || new Set(),
    hidden: state.hidden || {},
  };

  let matchingTriggers = (slide.triggers || [])
    .filter(
      (trigger) =>
        (trigger?.when || 'onClick') === when &&
        candidateIds.some((candidateId) => getStorylineTriggerSourceMatches(trigger, candidateId))
    )
    .filter((trigger) => evaluateStorylineTriggerConditions(trigger, context));

  if (when === 'onWidgetEvent' && eventName) {
    matchingTriggers = matchingTriggers.filter((trigger) => trigger.eventName === eventName);
  }
  const manualTriggers = matchingTriggers.filter((trigger) => !trigger.generatedBy);
  const manualTriggerCommands = collapseStorylineNavigationCommands(
    manualTriggers.flatMap((trigger) => getCommandsForTrigger(trigger, slide, context))
  );
  if (manualTriggers.length) return manualTriggerCommands;

  const triggerCommands = collapseStorylineNavigationCommands(
    matchingTriggers.flatMap((trigger) => getCommandsForTrigger(trigger, slide, context))
  );
  if (triggerCommands.length) return triggerCommands;

  if (when === 'onClick') {
    const selectionCandidate = candidates.find((candidate) => candidate.object?.selectionQuestionId);
    if (selectionCandidate)
      return [{ type: 'toggleSelection', objectId: selectionCandidate.object?.id || selectionCandidate.id }];

    const checkCandidate = candidates.find((candidate) => isStorylineCheckButton(candidate.object));
    if (checkCandidate) return [{ type: 'checkAnswer' }];

    const buttonIntroCandidate = candidates.find(
      (candidate) =>
        candidate.object?.generatedBy === 'scene-template' &&
        candidate.object?.sceneTemplateId === 'button-intro' &&
        !isButtonIntroRuntimeControl(candidate.object)
    );
    if (buttonIntroCandidate) {
      const object = buttonIntroCandidate.object;
      if (object?.sceneTemplateDemoAction || isButtonIntroPlayPauseDemoButton(object)) {
        return [
          {
            type: 'toggleDemoButtonState',
            objectId: getButtonIntroDemoStateTargetId(buttonIntroCandidate.id, object),
          },
        ];
      }
      return [];
    }

    for (const candidate of candidates) {
      const sourceRuntimeAction = getRuntimeButtonAction(candidate.object || {});
      const actionCommands = getStorylineRuntimeCommandsForAction(sourceRuntimeAction, { slide });
      if (actionCommands.length) return actionCommands;
    }
  }

  return [];
}

export function evaluateStorylineRuntimeMatching({ slide = {}, state = {} } = {}) {
  const pairs = slide.matchingPairs || [];
  const selections = state.matchingSelections || {};
  const expected = pairs.map((pair) => pair.id);
  let correctCount = 0;
  expected.forEach((pairId) => {
    const selected = selections[pairId];
    const pair = pairs.find((p) => p.id === pairId);
    if (pair && selected && getStorylineRuntimeKey(selected) === getStorylineRuntimeKey(pair.right)) {
      correctCount += 1;
    }
  });
  const total = expected.length;
  return {
    type: 'matching',
    success: total > 0 && correctCount === total,
    correctCount,
    total,
    selections,
  };
}

export function evaluateStorylineRuntimeSequence({ slide = {}, state = {} } = {}) {
  const items = slide.sequenceItems || [];
  const userOrder = state.sequenceOrder || items.map((item) => item.id);
  const correctOrder = items.map((item) => item.id);
  const success =
    userOrder.length === correctOrder.length &&
    userOrder.every((id, index) => id === correctOrder[index]);
  return {
    type: 'sequence',
    success: success && correctOrder.length > 0,
    completed: true,
    userOrder,
    correctOrder,
  };
}

export function evaluateStorylineRuntimeTextEntry({ slide = {}, state = {} } = {}) {
  const acceptedAnswers = slide.textEntryAcceptedAnswers || [];
  const userText = String(state.textEntryValue || '').trim();
  const caseSensitive = !!slide.textEntryCaseSensitive;
  const normalize = (text) => {
    let result = String(text || '').trim();
    if (!caseSensitive) result = result.toLocaleLowerCase('tr-TR');
    if (slide.textEntryTurkishTolerance) {
      result = result
        .replace(/ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/ş/g, 's')
        .replace(/ı/g, 'i')
        .replace(/ö/g, 'o')
        .replace(/ç/g, 'c');
    }
    return result;
  };
  const normalizedUser = normalize(userText);
  const matched = acceptedAnswers.some((answer) => normalize(answer) === normalizedUser);
  return {
    type: 'text-entry',
    success: matched && acceptedAnswers.length > 0,
    userText,
    matched,
  };
}

export function evaluateStorylineRuntimeFillBlank({ slide = {}, state = {} } = {}) {
  let answers = slide.fillBlankAnswers || [];
  if (answers.length === 0 && slide.fillBlankSentence) {
    const tokens = slide.fillBlankSentence.match(/\{(.+?)\}/g);
    if (tokens) {
      answers = tokens.map((t, i) => ({
        id: `blank-${i}`,
        acceptedValues: [t.slice(1, -1)]
      }));
    }
  }
  const userValues = state.fillBlankValues || {};
  const results = answers.map((answer) => {
    const userValue = String(userValues[answer.id] || '').trim();
    const accepted = (answer.acceptedValues || []).map((v) => String(v || '').trim());
    const caseSensitive = !!answer.caseSensitive;
    const normalize = (text) => {
      let result = String(text || '').trim();
      if (!caseSensitive) result = result.toLocaleLowerCase('tr-TR');
      if (slide.fillBlankTurkishTolerance) {
        result = result
          .replace(/ğ/g, 'g')
          .replace(/ü/g, 'u')
          .replace(/ş/g, 's')
          .replace(/ı/g, 'i')
          .replace(/ö/g, 'o')
          .replace(/ç/g, 'c');
      }
      if (slide.fillBlankTrim !== false) result = result.replace(/^\s+|\s+$/g, '');
      return result;
    };
    const normalizedUser = normalize(userValue);
    const matched = accepted.some((val) => normalize(val) === normalizedUser);
    return { id: answer.id, matched, userValue, points: answer.points || 1 };
  });
  const allCorrect = results.every((r) => r.matched);
  const totalPoints = results.reduce((sum, r) => sum + r.points, 0);
  const earnedPoints = results.filter((r) => r.matched).reduce((sum, r) => sum + r.points, 0);
  const completed = answers.length > 0 && answers.every((ans) => String(userValues[ans.id] || '').trim() !== '');
  return {
    type: 'fill-blank',
    success: allCorrect && answers.length > 0,
    completed,
    results,
    totalPoints,
    earnedPoints,
  };
}

export function getStorylineRuntimeCommandsForDrop({
  slide = {},
  dragObject = null,
  dropObject = null,
  state = {},
  variableDefinitions = [],
  objects = null,
} = {}) {
  if (!slide || !dragObject || !dropObject) return [];

  const context = {
    variables: state.variables || {},
    variableDefinitions,
    objectStates: state.objectStates || {},
    hiddenObjectIds: state.hiddenObjectIds || new Set(),
    hidden: state.hidden || {},
  };

  const sourceIds = [dragObject?.id, dropObject?.id].filter(Boolean);
  const result = evaluateStorylineRuntimeDragDrop({ slide, objects, state });
  const dragKey = getStorylineRuntimeObjectKey(dragObject);
  const activePlacement = (result.placements || []).find(
    (entry) => entry.dragId === dragObject?.id || entry.dragKey === dragKey
  );
  const isCorrectDrop = !!(activePlacement && result.placementResult?.[activePlacement.id]);
  const dropWhen = !dropObject ? null : isCorrectDrop ? 'onDropCorrect' : 'onDropIncorrect';

  return (slide.triggers || [])
    .filter((trigger) => {
      const when = trigger?.when || 'onClick';
      if (when === 'onDrop')
        return sourceIds.some((sourceId) =>
          getStorylineDropTriggerSourceMatches(trigger, sourceId)
        );
      if (dropWhen && when === dropWhen)
        return sourceIds.some((sourceId) =>
          getStorylineDropTriggerSourceMatches(trigger, sourceId)
        );
      return false;
    })
    .filter((trigger) => evaluateStorylineTriggerConditions(trigger, context))
    .flatMap((trigger) => getCommandsForTrigger(trigger, slide, context));
}

export function evaluateStorylineRuntimePuzzle({ activity = {}, state = {} } = {}) {
  const puzzleType = activity.puzzleType || 'crossword';
  const grid = activity.puzzleGrid?.cells || [];
  const placed = activity.puzzlePlaced || [];

  if (puzzleType === 'crossword') {
    const total = placed.length;
    if (total > 0) {
      let correct = 0;
      let revealed = 0;

      placed.forEach((p) => {
        const status = state.puzzleQuestionStatus?.[p.id];
        if (status === 'correct') {
          correct++;
        } else if (status === 'revealed') {
          revealed++;
        }
      });

      const completed = correct + revealed === total;
      const success = correct === total;
      const score = total > 0 ? correct / total : 0;

      return {
        type: 'puzzle',
        puzzleType: 'crossword',
        success,
        completed,
        correct,
        revealed,
        total,
        score
      };
    } else {
      let correct = 0;
      let totalCells = 0;
      for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < (grid[r]?.length || 0); c++) {
          const cell = grid[r]?.[c];
          if (cell?.letter) {
            totalCells++;
            if (state.puzzleGrid?.[r + ',' + c] === cell.letter) correct++;
          }
        }
      }
      const success = correct === totalCells && totalCells > 0;
      return {
        type: 'puzzle',
        puzzleType: 'crossword',
        success,
        completed: success,
        correct,
        revealed: 0,
        total: totalCells,
        score: totalCells > 0 ? correct / totalCells : 0
      };
    }
  }

  if (puzzleType === 'wordsearch') {
    const found = state.puzzleFoundWords || [];
    const total = placed.length;
    const success = found.length === total && total > 0;
    return {
      type: 'puzzle',
      puzzleType: 'wordsearch',
      success,
      completed: success,
      correct: found.length,
      revealed: 0,
      total,
      score: total > 0 ? found.length / total : 0
    };
  }

  if (puzzleType === 'sudoku') {
    const solution = activity.puzzleSolution;
    if (!solution) {
      return {
        type: 'puzzle',
        puzzleType: 'sudoku',
        success: false,
        completed: false,
        correct: 0,
        revealed: 0,
        total: 81,
        score: 0
      };
    }
    let correct = 0;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (Number(state.puzzleGrid?.[r + ',' + c]) === solution[r][c]) correct++;
      }
    }
    const success = correct === 81;
    return {
      type: 'puzzle',
      puzzleType: 'sudoku',
      success,
      completed: success,
      correct,
      revealed: 0,
      total: 81,
      score: correct / 81
    };
  }

  if (puzzleType === 'maze') {
    const reachedEnd = state.puzzleMazeReachedEnd || false;
    const success = reachedEnd;
    return {
      type: 'puzzle',
      puzzleType: 'maze',
      success,
      completed: success,
      correct: reachedEnd ? 1 : 0,
      revealed: 0,
      total: 1,
      score: reachedEnd ? 1 : 0
    };
  }

  if (puzzleType === 'memory') {
    const matched = state.puzzleMemoryMatched || [];
    const total = (placed.length || 0) / 2;
    const success = matched.length === total && total > 0;
    return {
      type: 'puzzle',
      puzzleType: 'memory',
      success,
      completed: success,
      correct: matched.length,
      revealed: 0,
      total,
      score: total > 0 ? matched.length / total : 0
    };
  }

  return { success: false, correct: 0, total: 0 };
}

export function evaluateStorylineRuntimeNumeric({ slide = {}, state = {} } = {}) {
  const correctValue = Number(slide.numericCorrectValue ?? 0);
  const tolerance = Number(slide.numericTolerance ?? 0);
  const min = slide.numericMin != null ? Number(slide.numericMin) : -Infinity;
  const max = slide.numericMax != null ? Number(slide.numericMax) : Infinity;
  const userValue = Number(state.numericValue);

  if (!Number.isFinite(userValue)) {
    return { type: 'numeric', success: false, score: 0, feedback: 'empty' };
  }

  const inRange = userValue >= min && userValue <= max;
  const withinTolerance = tolerance === 0
    ? userValue === correctValue
    : Math.abs(userValue - correctValue) <= tolerance;

  const success = inRange && withinTolerance;
  return {
    type: 'numeric',
    success,
    score: success ? 1 : 0,
    userValue,
    correctValue,
    tolerance,
    feedback: success ? 'correct' : 'incorrect',
  };
}

export function evaluateStorylineRuntimeSurvey({ state = {} } = {}) {
  const responses = state.surveyResponses || {};
  const answeredCount = Object.values(responses).filter(Boolean).length;
  return {
    type: 'survey',
    success: true,
    score: 0,
    responses,
    answeredCount,
    feedback: 'submitted',
  };
}

export function evaluateStorylineRuntimeHotspot({ slide = {}, objects = null, state = {} } = {}) {
  const baseObjects = getBaseRuntimeObjects(slide, objects);
  const hotspots = baseObjects.filter((obj) => obj.type === 'hotspot');
  const clickedHotspots = state.clickedHotspots || [];

  const correctHotspots = hotspots.filter((h) => h.hotspotCorrect !== false);
  const incorrectHotspots = hotspots.filter((h) => h.hotspotCorrect === false);

  const correctClicks = clickedHotspots.filter((id) =>
    correctHotspots.some((h) => h.id === id)
  ).length;
  const incorrectClicks = clickedHotspots.filter((id) =>
    incorrectHotspots.some((h) => h.id === id)
  ).length;

  const allCorrectClicked = correctHotspots.every((h) => clickedHotspots.includes(h.id));
  const noIncorrectClicked = incorrectClicks === 0;
  const success = allCorrectClicked && noIncorrectClicked && correctHotspots.length > 0;

  return {
    type: 'hotspot',
    success,
    completed: clickedHotspots.length > 0,
    score: success ? 1 : 0,
    correctClicks,
    incorrectClicks,
    totalCorrect: correctHotspots.length,
    clickedCount: clickedHotspots.length,
    feedback: success ? 'correct' : 'incorrect',
  };
}

export function evaluateStorylineRuntimeMixed({ slide = {}, state = {} } = {}) {
  const items = slide.mixedItems || [];
  const userAnswers = state.mixedAnswers || {};
  let totalPoints = 0;
  let earnedPoints = 0;

  const results = items.map((item) => {
    const userAns = userAnswers[item.id];
    let matched = false;
    const points = item.points || 1;
    totalPoints += points;

    if (item.type === 'selection') {
      const options = item.options || [];
      const correctIds = options.filter(o => o.isCorrect).map(o => o.id);
      const userSelected = Array.isArray(userAns) ? userAns : (userAns ? [userAns] : []);
      matched = correctIds.length === userSelected.length && correctIds.every(id => userSelected.includes(id));
    } else if (item.type === 'drag-drop') {
      const pairs = item.pairs || [];
      const userPairs = userAns || {};
      matched = pairs.length > 0 && pairs.every(p => 
        String(userPairs[p.id] || '').trim().toLowerCase() === String(p.right || '').trim().toLowerCase()
      );
    } else if (item.type === 'text-entry' || item.type === 'numeric') {
      const accepted = (item.acceptedAnswers || []).map(v => String(v || '').trim().toLowerCase());
      matched = accepted.includes(String(userAns || '').trim().toLowerCase());
    } else if (item.type === 'fill-blank') {
      const accepted = (item.acceptedAnswers || []).map(v => String(v || '').trim().toLowerCase());
      const userBlanks = userAns || {};
      matched = accepted.length > 0 && accepted.every((val, idx) => 
        String(userBlanks[idx] || '').trim().toLowerCase() === val
      );
    }
    if (matched) earnedPoints += points;
    return { id: item.id, matched, points };
  });

  const completed = items.length > 0 && items.every((item) => {
    const userAns = userAnswers[item.id];
    if (userAns == null) return false;
    if (item.type === 'selection') {
      const arr = Array.isArray(userAns) ? userAns : [userAns];
      return arr.filter(Boolean).length > 0;
    }
    if (item.type === 'drag-drop') {
      const pairs = item.pairs || [];
      return pairs.length > 0 && pairs.every(p => userAns[p.id] != null && String(userAns[p.id]).trim() !== '');
    }
    if (item.type === 'fill-blank') {
      let blankCount = 0;
      String(item.sentence || '').split(/(___|\\{.+?\\})/g).filter(Boolean).forEach(part => {
        const blank = part === '___' || (part.charAt(0) === '{' && part.charAt(part.length - 1) === '}');
        if (blank) blankCount++;
      });
      for (let i = 0; i < blankCount; i++) {
        if (userAns[i] == null || String(userAns[i]).trim() === '') return false;
      }
      return true;
    }
    return String(userAns).trim() !== '';
  });

  return {
    type: 'mixed',
    success: results.length > 0 && results.every(r => r.matched),
    completed,
    results,
    totalPoints,
    earnedPoints
  };
}
