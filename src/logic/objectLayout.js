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
  getSelectionUnits,
  alignActivitySelection,
  distributeActivitySelection,
  getSelectionGroupState,
  groupActivitySelection,
  ungroupActivitySelection,
};

// Bir ögenin ait olduğu grup anahtarı: önce kullanıcı grubu (groupId), yoksa
// hazır buton çiftlerini bağlayan linkedHoverGroup. İkisi de yoksa boş döner.
function groupKeyOf(item = {}) {
  return String(item.groupId || '').trim() || String(item.linkedHoverGroup || '').trim();
}

// Seçimi hizalama/dağıtma BİRİMLERİNE ayırır: aynı grup anahtarını paylaşan
// ögeler tek birimdir (birlikte taşınır), bağımsız ögeler kendi birimidir.
function getSelectionUnits(objects = [], selectedIds = new Set()) {
  const ids = selectedIds instanceof Set ? selectedIds : new Set(selectedIds || []);
  const unitMap = new Map();
  objects.forEach((item) => {
    if (!ids.has(item.id)) return;
    const key = groupKeyOf(item) || `__tek_${item.id}`;
    if (!unitMap.has(key)) unitMap.set(key, []);
    unitMap.get(key).push(item);
  });
  return [...unitMap.values()].map((members) => ({
    members,
    bounds: getObjectSelectionBounds(members),
  }));
}

// Seçimin grup durumunu tek yerde hesaplar; hem ribbon (`can`) hem sağ tık menüsü
// aynı kararı kullansın diye paylaşılır. linkedHoverGroup'lu hazır buton çiftleri
// de "gruplu" sayılır: Ayır bu bağı da çözer (ungroupActivitySelection temizliyor).
function getSelectionGroupState(activity = {}, selectedIds = new Set()) {
  const ids = selectedIds instanceof Set ? selectedIds : new Set(selectedIds || []);
  const objects = Array.isArray(activity.objects) ? activity.objects : [];
  const selected = objects.filter((item) => ids.has(item.id));
  const groupIds = new Set(selected.map(groupKeyOf).filter(Boolean));
  const groupedCount = selected.filter((item) => groupKeyOf(item)).length;
  const allOneGroup = selected.length > 1 && groupIds.size === 1 && groupedCount === selected.length;
  return {
    canGroup: selected.length > 1 && !allOneGroup,
    canUngroup: groupedCount > 0,
    unitCount: getSelectionUnits(objects, ids).length,
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

// Hizalama: birden çok birim seçiliyse seçim bbox'ına, TEK birim (tek öge veya
// komple bir grup) seçiliyse SAHNEYE (çalışma alanına) göre hizalar. Gruplar tek
// birim olarak taşınır — üyelerin birbirine göre konumu bozulmaz.
function alignActivitySelection(activity = {}, selectedIds = new Set(), mode = 'left') {
  const ids = selectedIds instanceof Set ? selectedIds : new Set(selectedIds || []);
  if (!ids.size) return activity;
  const objects = Array.isArray(activity.objects) ? activity.objects : [];
  const units = getSelectionUnits(objects, ids).filter((unit) => unit.bounds);
  if (!units.length) return activity;

  const bounds =
    units.length === 1
      ? {
          left: 0,
          top: 0,
          right: Number(activity.stageWidth) || 1920,
          bottom: Number(activity.stageHeight) || 1080,
        }
      : getObjectSelectionBounds(objects.filter((item) => ids.has(item.id)));
  if (!bounds) return activity;
  const boundsWidth = bounds.right - bounds.left;
  const boundsHeight = bounds.bottom - bounds.top;

  const deltaById = new Map();
  units.forEach((unit) => {
    const ub = unit.bounds;
    let dx = 0;
    let dy = 0;
    if (mode === 'left') dx = bounds.left - ub.left;
    if (mode === 'center') dx = bounds.left + (boundsWidth - ub.width) / 2 - ub.left;
    if (mode === 'right') dx = bounds.right - ub.width - ub.left;
    if (mode === 'top') dy = bounds.top - ub.top;
    if (mode === 'middle') dy = bounds.top + (boundsHeight - ub.height) / 2 - ub.top;
    if (mode === 'bottom') dy = bounds.bottom - ub.height - ub.top;
    unit.members.forEach((member) => deltaById.set(member.id, { dx, dy }));
  });

  return {
    ...activity,
    objects: objects.map((item) => {
      const delta = deltaById.get(item.id);
      if (!delta || (!delta.dx && !delta.dy)) return item;
      return {
        ...item,
        x: (Number(item.x) || 0) + delta.dx,
        y: (Number(item.y) || 0) + delta.dy,
      };
    }),
  };
}

// Dağıtma: birimler (grup = tek birim) arasındaki boşlukları eşitler.
// En az 3 birim gerekir; birim üyeleri birlikte taşınır.
function distributeActivitySelection(activity = {}, selectedIds = new Set(), axis = 'horizontal') {
  const ids = selectedIds instanceof Set ? selectedIds : new Set(selectedIds || []);
  const objects = Array.isArray(activity.objects) ? activity.objects : [];
  const units = getSelectionUnits(objects, ids).filter((unit) => unit.bounds);
  if (units.length < 3) return activity;

  const isHorizontal = axis === 'horizontal';
  const ordered = [...units].sort((a, b) =>
    isHorizontal ? a.bounds.left - b.bounds.left : a.bounds.top - b.bounds.top
  );
  const first = ordered[0].bounds;
  const last = ordered[ordered.length - 1].bounds;
  const start = isHorizontal ? first.left : first.top;
  const end = isHorizontal ? last.right : last.bottom;
  const totalSize = ordered.reduce(
    (sum, unit) => sum + (isHorizontal ? unit.bounds.width : unit.bounds.height),
    0
  );
  const gap = (end - start - totalSize) / Math.max(1, ordered.length - 1);

  let cursor = start;
  const deltaById = new Map();
  ordered.forEach((unit) => {
    const pos = isHorizontal ? unit.bounds.left : unit.bounds.top;
    const delta = cursor - pos;
    unit.members.forEach((member) => deltaById.set(member.id, delta));
    cursor += (isHorizontal ? unit.bounds.width : unit.bounds.height) + gap;
  });

  return {
    ...activity,
    objects: objects.map((item) => {
      if (!deltaById.has(item.id)) return item;
      const delta = deltaById.get(item.id);
      if (!delta) return item;
      return isHorizontal
        ? { ...item, x: (Number(item.x) || 0) + delta }
        : { ...item, y: (Number(item.y) || 0) + delta };
    }),
  };
}
