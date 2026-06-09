import { clamp } from '../utils/editorHelpers';

import { getCorrectDragMatches } from './activityHelpers';
import {
  getDragDropSettings,
  getDragDropPairsFromMatches,
  getDragDropPairKey,
} from './dragDrop';
import {
  SCENE_TEMPLATE_BUTTON_INTRO_ID,
  getButtonPairSemanticIcon,
  normalizeSingleButtonIcon,
} from './sceneTemplates';

export const EDUCATION_BUTTON_ICON_SIZE = 28;

export function safeClone(value, fallback = {}) {
  try {
    return JSON.parse(JSON.stringify(value ?? fallback));
  } catch {
    return fallback;
  }
}

export function getEditorLinkedSelectionIds(activity = {}, objectId = '') {
  const objects = Array.isArray(activity?.objects) ? activity.objects : [];
  const current = objects.find((item) => item.id === objectId) || null;
  if (!current) return new Set(objectId ? [objectId] : []);

  const layerId = current.layerId || 'base';
  const linkedActionTargetId = String(current.linkedActionTargetId || '').trim();
  const linkedHoverGroup = String(current.linkedHoverGroup || '').trim();
  const groupId = String(current.groupId || '').trim();
  const selectionIds = new Set([current.id]);

  // Kullanıcı gruplaması: aynı groupId'li ögeler birlikte seçilir/taşınır (gruplama
  // komutu groupId atıyor ama eskiden seçim mantığı groupId'yi hiç kullanmıyordu).
  if (groupId) {
    objects.forEach((item) => {
      if ((item.layerId || 'base') !== layerId) return;
      if (String(item.groupId || '').trim() === groupId) selectionIds.add(item.id);
    });
  }

  if (linkedActionTargetId) {
    objects.forEach((item) => {
      if ((item.layerId || 'base') !== layerId) return;
      if (
        item.id === linkedActionTargetId ||
        String(item.linkedActionTargetId || '').trim() === linkedActionTargetId
      ) {
        selectionIds.add(item.id);
      }
    });
  }

  if (linkedHoverGroup) {
    objects.forEach((item) => {
      if ((item.layerId || 'base') !== layerId) return;
      if (String(item.linkedHoverGroup || '').trim() === linkedHoverGroup) {
        selectionIds.add(item.id);
      }
    });
  }

  return selectionIds;
}

export function getEditorPrimaryObjectId(activity = {}, objectId = '') {
  const objects = Array.isArray(activity?.objects) ? activity.objects : [];
  const current = objects.find((item) => item.id === objectId) || null;
  if (!current) return objectId || '';

  const linkedActionTargetId = String(current.linkedActionTargetId || '').trim();
  if (linkedActionTargetId && objects.some((item) => item.id === linkedActionTargetId)) {
    return linkedActionTargetId;
  }

  const linkedIds = [...getEditorLinkedSelectionIds(activity, objectId)];
  const labelCandidate = linkedIds
    .map((id) => objects.find((item) => item.id === id))
    .find((item) => item && String(item.sceneTemplateSlotId || '').endsWith('-label'));
  if (labelCandidate?.id) return labelCandidate.id;

  return current.id;
}

export function getEditorGroupedObjectEntries(activity = {}, inputObjects = []) {
  const objects = Array.isArray(inputObjects) ? inputObjects : [];
  const seen = new Set();
  const entries = [];

  objects.forEach((item) => {
    if (!item) return;
    const ids = [...getEditorLinkedSelectionIds(activity, item.id)];
    const primaryId = getEditorPrimaryObjectId(activity, item.id) || item.id;
    if (seen.has(primaryId)) return;
    seen.add(primaryId);
    const primaryObject =
      objects.find((candidate) => candidate.id === primaryId) ||
      (Array.isArray(activity?.objects)
        ? activity.objects.find((candidate) => candidate.id === primaryId)
        : null) ||
      item;
    entries.push({
      primaryId,
      ids,
      object: primaryObject,
    });
  });

  return entries;
}

export function canObjectBeSelectionShape(obj = {}) {
  return ['shape', 'button', 'text'].includes(obj.type) || !!obj.selectionQuestionId;
}

export function getAnswerPlacementFrames(activity = {}) {
  if (!activity || (activity.type !== 'drag-drop' && activity.type !== 'mixed')) return {};
  const canvasObjects = (activity.objects || []).filter((item) => (item.layerId || 'base') === 'base');
  const dragById = Object.fromEntries(
    canvasObjects.filter((item) => item.type === 'draggable').map((item) => [item.id, item])
  );
  const dropById = Object.fromEntries(
    canvasObjects.filter((item) => item.type === 'dropzone').map((item) => [item.id, item])
  );
  const pairs = getDragDropPairsFromMatches(getCorrectDragMatches(activity));
  const layout = getDragDropSettings(activity).answerPlacementLayout || 'stack';
  const dropStackById = {};
  const stageW = Number(activity.stageWidth) || 1920;
  const stageH = Number(activity.stageHeight) || 1080;
  const frames = {};

  pairs.forEach((pair) => {
    const drag = dragById[pair.dragId];
    const drop = dropById[pair.dropId];
    if (!drag || !drop) return;

    const dragWidth = Number(drag.width) || 1;
    const dragHeight = Number(drag.height) || 1;
    const dropWidth = Number(drop.width) || dragWidth;
    const dropHeight = Number(drop.height) || dragHeight;
    const stackIndex = dropStackById[drop.id] || 0;
    dropStackById[drop.id] = stackIndex + 1;
    const gap = 8;
    const rowCount = Math.max(1, Math.floor((dropWidth + gap) / Math.max(1, dragWidth + gap)));
    const gridRow = Math.floor(stackIndex / rowCount);
    const gridCol = stackIndex % rowCount;

    let targetX = Math.round((Number(drop.x) || 0) + (dropWidth - dragWidth) / 2);
    let targetY = Math.round((Number(drop.y) || 0) + (dropHeight - dragHeight) / 2);
    if (layout === 'row') {
      targetX = Math.round((Number(drop.x) || 0) + 4 + stackIndex * (dragWidth + gap));
      targetY = Math.round((Number(drop.y) || 0) + (dropHeight - dragHeight) / 2);
    }
    if (layout === 'grid') {
      targetX = Math.round((Number(drop.x) || 0) + 4 + gridCol * (dragWidth + gap));
      targetY = Math.round((Number(drop.y) || 0) + 4 + gridRow * (dragHeight + gap));
    }

    frames[getDragDropPairKey(pair.dragId, pair.dropId)] = {
      x: clamp(targetX, 0, Math.max(0, stageW - dragWidth)),
      y: clamp(targetY, 0, Math.max(0, stageH - dragHeight)),
      width: dragWidth,
      height: dragHeight,
      drag,
      drop,
    };
  });

  return frames;
}

export function normalizeButtonPairLayoutForActivity(activity = {}) {
  const objects = Array.isArray(activity.objects) ? activity.objects : [];
  if (!objects.length) return activity;

  const byGroup = new Map();
  objects.forEach((object) => {
    if (!object || object.type !== 'button') return;
    const group = String(object.linkedHoverGroup || '').trim();
    if (!group) return;
    byGroup.set(group, [...(byGroup.get(group) || []), object]);
  });

  const patches = new Map();
  byGroup.forEach((groupObjects, groupId) => {
    const buttons = groupObjects.filter((item) => item?.type === 'button');
    if (buttons.length < 2) return;
    const generatedPair =
      groupId.startsWith('answer-template:') ||
      groupId.startsWith('button-intro:') ||
      groupId.startsWith('ready:') ||
      buttons.some(
        (item) =>
          item.generatedBy === 'answer-template' ||
          item.sceneTemplateId === SCENE_TEMPLATE_BUTTON_INTRO_ID ||
          String(item.sceneTemplateSlotId || '').startsWith('ready-button:')
      );
    if (!generatedPair) return;

    const labelObject =
      buttons.find((item) => String(item.sceneTemplateSlotId || '').endsWith('-label')) ||
      buttons.find((item) => String(item.soundIconMode || '') === 'external') ||
      [...buttons].sort((left, right) => (Number(right.width) || 0) - (Number(left.width) || 0))[0];
    const iconObject = buttons.find((item) => item.id !== labelObject?.id);
    if (!labelObject || !iconObject) return;

    const iconHeight = Math.max(1, Number(iconObject.height || labelObject.height || 58) || 58);
    const nextIconWidth = Math.max(
      48,
      Math.min(Number(iconObject.width || iconHeight) || iconHeight, Math.round(iconHeight * 1.35))
    );
    const gap = Math.max(10, Math.round(iconHeight * 0.18));
    const nextLabelX = Math.round((Number(iconObject.x) || 0) + nextIconWidth + gap);
    const currentRight = Math.max(
      (Number(iconObject.x) || 0) + (Number(iconObject.width) || nextIconWidth),
      (Number(labelObject.x) || 0) + (Number(labelObject.width) || 0)
    );
    const nextLabelWidth = Math.max(96, Math.round(currentRight - nextLabelX));
    const iconLabel = getButtonPairSemanticIcon(iconObject, labelObject);

    patches.set(iconObject.id, {
      label: normalizeSingleButtonIcon(iconLabel, iconLabel),
      text: iconObject.text ? normalizeSingleButtonIcon(iconLabel, iconLabel) : iconObject.text,
      width: nextIconWidth,
      style: {
        ...(iconObject.style || {}),
        padding: 0,
        lineHeight: 1,
        textAlign: 'center',
        whiteSpace: 'nowrap',
        borderRadius: Number(iconObject.style?.borderRadius ?? 999),
      },
    });
    patches.set(labelObject.id, {
      x: nextLabelX,
      width: nextLabelWidth,
      style: {
        ...(labelObject.style || {}),
        paddingLeft: 0,
        paddingRight: 0,
        textAlign: 'center',
        whiteSpace: 'nowrap',
      },
    });
  });

  if (!patches.size) return activity;
  return {
    ...activity,
    objects: objects.map((object) =>
      patches.has(object.id) ? { ...object, ...patches.get(object.id) } : object
    ),
  };
}
