// Timeline satır sıralamasının saf çekirdeği: objects dizisinde source'u
// target'ın önüne/arkasına taşır. zIndex yazımı çağıran tarafta yapılır
// (nextObjectsWithZIndex) — burada yalnız dizi sırası hesaplanır.
export function reorderObjectsByTrack(objects = [], sourceObjectId, targetObjectId, placeAfter = false) {
  const list = Array.isArray(objects) ? objects : [];
  if (!sourceObjectId || !targetObjectId || sourceObjectId === targetObjectId) return null;
  const sourceIndex = list.findIndex((object) => object?.id === sourceObjectId);
  const targetIndex = list.findIndex((object) => object?.id === targetObjectId);
  if (sourceIndex < 0 || targetIndex < 0) return null;
  if (list[sourceIndex]?.locked) return null;
  const next = [...list];
  const [moved] = next.splice(sourceIndex, 1);
  let insertIndex = next.findIndex((object) => object?.id === targetObjectId);
  if (insertIndex < 0) return null;
  if (placeAfter) insertIndex += 1;
  next.splice(insertIndex, 0, moved);
  return next;
}
