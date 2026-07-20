import { evaluateStorylineRuntimeDragDrop } from '../../utils/storylineRuntimeEngine';
import { getCanvasObjects, getCorrectDragMatches } from '../activityHelpers';
import { getDragDropAssignments } from '../activityScoring';
import { getDragDropPairsFromMatches, getDragDropPairKey, isDragReusable, buildDragDropMatchMapFromPairs } from '../dragDrop';
export function layoutDragPositionsForMatches(activity, matches = {}) {
  const canvasObjects = getCanvasObjects(activity);
  const drags = canvasObjects.filter((o) => o.type === 'draggable');
  const drops = canvasObjects.filter((o) => o.type === 'dropzone');
  const dragById = Object.fromEntries(drags.map((d) => [d.id, d]));
  const dropById = Object.fromEntries(drops.map((dz) => [dz.id, dz]));
  const grouped = {};

  getDragDropPairsFromMatches(matches).forEach(({ dragId, dropId }) => {
    if (!dragById[dragId] || !dropById[dropId]) return;
    grouped[dropId] = grouped[dropId] || [];
    grouped[dropId].push({ dragId, pairKey: getDragDropPairKey(dragId, dropId) });
  });

  const positioned = {};

  Object.entries(grouped).forEach(([dropId, dragEntries]) => {
    const drop = dropById[dropId];
    const count = dragEntries.length;
    if (!drop || count === 0) return;

    const cols = count === 1 ? 1 : count === 2 ? 2 : Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    const cellWidth = drop.width / cols;
    const cellHeight = drop.height / rows;
    const padding = Math.max(6, Math.min(drop.width, drop.height) * 0.05);

    dragEntries.forEach(({ dragId, pairKey }, index) => {
      const drag = dragById[dragId];
      if (!drag) return;

      const col = index % cols;
      const row = Math.floor(index / cols);
      const slotX = drop.x + col * cellWidth;
      const slotY = drop.y + row * cellHeight;
      const maxX = drop.x + drop.width - drag.width - padding;
      const maxY = drop.y + drop.height - drag.height - padding;
      const targetX = slotX + (cellWidth - drag.width) / 2;
      const targetY = slotY + (cellHeight - drag.height) / 2;

      positioned[pairKey] = {
        x: Math.max(drop.x + padding, Math.min(targetX, maxX)),
        y: Math.max(drop.y + padding, Math.min(targetY, maxY)),
      };
    });
  });

  return positioned;
}

// eslint-disable-next-line no-unused-vars -- Runtime engine now owns this; retained for dormant editor migrations.
export function buildAutoDragMatches(activity) {
  const preferArrays = !!getDragDropAssignments(activity).some(({ drag }) =>
    isDragReusable(activity, drag)
  );
  return buildDragDropMatchMapFromPairs(
    getDragDropAssignments(activity).map(({ drag, drop }) => ({
      dragId: drag.id,
      dropId: drop.id,
    })),
    preferArrays
  );
}




export function buildDragDropPlacementLayout(activity, placements = {}, activeLayerId = null) {
  const canvasObjects = getCanvasObjects(activeLayerId ? { ...activity, activeLayerId } : activity);
  const drags = canvasObjects.filter((item) => item.type === 'draggable');
  const drops = canvasObjects.filter((item) => item.type === 'dropzone');
  const dragById = Object.fromEntries(drags.map((item) => [item.id, item]));
  const dropById = Object.fromEntries(drops.map((item) => [item.id, item]));
  const grouped = {};
  const frames = {};

  (placements || []).forEach((entry) => {
    if (!entry?.id || !dragById[entry.dragId] || !dropById[entry.dropId]) return;
    grouped[entry.dropId] = grouped[entry.dropId] || [];
    grouped[entry.dropId].push(entry);
  });

  Object.entries(grouped).forEach(([dropId, entries]) => {
    const drop = dropById[dropId];
    if (!drop) return;
    const count = entries.length;
    const cols = count === 1 ? 1 : count === 2 ? 2 : Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    const cellWidth = drop.width / cols;
    const cellHeight = drop.height / rows;
    const padding = Math.max(6, Math.min(drop.width, drop.height) * 0.05);

    entries.forEach((entry, index) => {
      const drag = dragById[entry.dragId];
      if (!drag) return;
      const col = index % cols;
      const row = Math.floor(index / cols);
      const slotX = drop.x + col * cellWidth;
      const slotY = drop.y + row * cellHeight;
      const maxX = drop.x + drop.width - drag.width - padding;
      const maxY = drop.y + drop.height - drag.height - padding;
      const targetX = slotX + (cellWidth - drag.width) / 2;
      const targetY = slotY + (cellHeight - drag.height) / 2;
      frames[entry.id] = {
        x: Math.max(drop.x + padding, Math.min(targetX, maxX)),
        y: Math.max(drop.y + padding, Math.min(targetY, maxY)),
        width: drag.width,
        height: drag.height,
        drag,
        drop,
      };
    });
  });

  return frames;
}

// eslint-disable-next-line no-unused-vars -- Runtime engine now owns live scoring; retained for older editor flows.
export function evaluateDragDropPlacements(
  activity,
  placements = [],
  expectedMatches = getCorrectDragMatches(activity)
) {
  const dropAssignments = Object.fromEntries(
    (placements || []).map((entry) => [
      entry.dragKey || entry.dragId,
      entry.dropKey || entry.dropId,
    ])
  );
  return evaluateStorylineRuntimeDragDrop({
    slide: activity,
    objects: getCanvasObjects(activity, 'base'),
    dropAssignments,
    expectedMatches,
  });
}
