import { uid } from '../utils/editorHelpers';

function getObjectSelectionBounds(items = []) {
  if (!items.length) return null;
  const left = Math.min(...items.map((item) => Number(item.x) || 0));
  const top = Math.min(...items.map((item) => Number(item.y) || 0));
  const right = Math.max(...items.map((item) => (Number(item.x) || 0) + (Number(item.width) || 0)));
  const bottom = Math.max(
    ...items.map((item) => (Number(item.y) || 0) + (Number(item.height) || 0))
  );
  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
  };
}

export {
  getObjectSelectionBounds,
  alignActivitySelection,
  distributeActivitySelection,
  getSelectionGroupState,
  groupActivitySelection,
  ungroupActivitySelection,
};

// Seçimin grup durumunu tek yerde hesaplar; hem ribbon (`can`) hem sağ tık menüsü
// aynı kararı kullansın diye paylaşılır.
function getSelectionGroupState(activity = {}, selectedIds = new Set()) {
  const ids = selectedIds instanceof Set ? selectedIds : new Set(selectedIds || []);
  const objects = Array.isArray(activity.objects) ? activity.objects : [];
  const selected = objects.filter((item) => ids.has(item.id));
  const groupIds = new Set(
    selected.map((item) => String(item.groupId || '').trim()).filter(Boolean)
  );
  const groupedCount = selected.filter((item) => String(item.groupId || '').trim()).length;
  const allOneGroup = selected.length > 1 && groupIds.size === 1 && groupedCount === selected.length;
  return {
    canGroup: selected.length > 1 && !allOneGroup,
    canUngroup: groupedCount > 0,
  };
}

function groupActivitySelection(activity = {}, selectedIds = new Set()) {
  const ids = selectedIds instanceof Set ? selectedIds : new Set(selectedIds || []);
  if (ids.size < 2) return activity;
  const groupId = uid();
  return {
    ...activity,
    objects: (activity.objects || []).map((item) =>
      ids.has(item.id) ? { ...item, groupId } : item
    ),
  };
}

function ungroupActivitySelection(activity = {}, selectedIds = new Set()) {
  const ids = selectedIds instanceof Set ? selectedIds : new Set(selectedIds || []);
  if (!ids.size) return activity;
  // Sadece groupId değil; hazır ikon/etiket butonları linkedHoverGroup ve
  // linkedActionTargetId ile bağlı. Grubu gerçekten çözebilmek için bu bağları da temizliyoruz.
  return {
    ...activity,
    objects: (activity.objects || []).map((item) =>
      ids.has(item.id)
        ? { ...item, groupId: '', linkedHoverGroup: '', linkedActionTargetId: '' }
        : item
    ),
  };
}

function alignActivitySelection(activity = {}, selectedIds = new Set(), mode = 'left') {
  const ids = selectedIds instanceof Set ? selectedIds : new Set(selectedIds || []);
  if (ids.size < 2) return activity;
  const objects = Array.isArray(activity.objects) ? activity.objects : [];
  const selectedObjects = objects.filter((item) => ids.has(item.id));
  const bounds = getObjectSelectionBounds(selectedObjects);
  if (!bounds) return activity;

  return {
    ...activity,
    objects: objects.map((item) => {
      if (!ids.has(item.id)) return item;
      if (mode === 'left') return { ...item, x: bounds.left };
      if (mode === 'center') return { ...item, x: bounds.left + (bounds.width - item.width) / 2 };
      if (mode === 'right') return { ...item, x: bounds.right - item.width };
      if (mode === 'top') return { ...item, y: bounds.top };
      if (mode === 'middle') return { ...item, y: bounds.top + (bounds.height - item.height) / 2 };
      if (mode === 'bottom') return { ...item, y: bounds.bottom - item.height };
      return item;
    }),
  };
}

function distributeActivitySelection(activity = {}, selectedIds = new Set(), axis = 'horizontal') {
  const ids = selectedIds instanceof Set ? selectedIds : new Set(selectedIds || []);
  if (ids.size < 3) return activity;
  const objects = Array.isArray(activity.objects) ? activity.objects : [];
  const selectedObjects = objects.filter((item) => ids.has(item.id));
  if (selectedObjects.length < 3) return activity;

  const isHorizontal = axis === 'horizontal';
  const ordered = [...selectedObjects].sort((left, right) =>
    isHorizontal
      ? left.x - right.x || left.zIndex - right.zIndex
      : left.y - right.y || left.zIndex - right.zIndex
  );
  const start = isHorizontal ? ordered[0].x : ordered[0].y;
  const end = isHorizontal
    ? ordered[ordered.length - 1].x + ordered[ordered.length - 1].width
    : ordered[ordered.length - 1].y + ordered[ordered.length - 1].height;
  const totalSize = ordered.reduce(
    (sum, item) => sum + (isHorizontal ? item.width : item.height),
    0
  );
  const gap = (end - start - totalSize) / Math.max(1, ordered.length - 1);
  let cursor = start;
  const positionMap = new Map();

  ordered.forEach((item) => {
    positionMap.set(item.id, cursor);
    cursor += (isHorizontal ? item.width : item.height) + gap;
  });

  return {
    ...activity,
    objects: objects.map((item) => {
      if (!positionMap.has(item.id)) return item;
      return isHorizontal
        ? { ...item, x: positionMap.get(item.id) }
        : { ...item, y: positionMap.get(item.id) };
    }),
  };
}
