import {
  TIMELINE_EFFECT_OPTIONS,
  TIMELINE_DIRECTION_OPTIONS,
  TIMELINE_EASING_OPTIONS,
} from '../constants';
import { uid, clamp } from '../utils/editorHelpers';

function createTimelineKeyframe(time = 0, index = 0) {
  return {
    id: uid(),
    name: `Kare ${index + 1}`,
    time,
    x: 0,
    y: 0,
    scale: 1,
    opacity: 1,
  };
}
function createTimelineItem(index = 0, object = null) {
  const objectLabel =
    object?.label ||
    (object?.type === 'video'
      ? 'Video'
      : object?.type
        ? `${object.type} nesnesi`
        : `Nesne ${index + 1}`);
  const duration = object?.type === 'video' ? 8 : 4;
  return {
    id: uid(),
    objectId: object?.id || '',
    name: objectLabel,
    start: 0,
    duration,
    track: index,
    entryEffect: object?.type === 'video' ? 'fade' : 'fade',
    exitEffect: object?.type === 'video' ? 'fade' : 'none',
    direction: 'left',
    easing: 'easeOut',
    keyframes: [createTimelineKeyframe(0, 0), createTimelineKeyframe(duration, 1)],
  };
}
function normalizeTimelineItem(item = {}, index = 0, objects = []) {
  const fallbackObject = objects[index] || null;
  const objectId = item.objectId || fallbackObject?.id || '';
  const linkedObject = objects.find((object) => object.id === objectId) || fallbackObject || null;
  const fallback = createTimelineItem(index, linkedObject);
  const nextDuration = Math.max(
    0.2,
    Number(item.duration ?? fallback.duration) || fallback.duration
  );
  const rawKeyframes =
    Array.isArray(item.keyframes) && item.keyframes.length ? item.keyframes : fallback.keyframes;
  const keyframes = rawKeyframes
    .map((frame, frameIndex) => ({
      ...createTimelineKeyframe(0, frameIndex),
      ...frame,
      time: clamp(Number(frame?.time ?? 0) || 0, 0, nextDuration),
      x: Number(frame?.x ?? 0) || 0,
      y: Number(frame?.y ?? 0) || 0,
      scale: Math.max(0.1, Number(frame?.scale ?? 1) || 1),
      opacity: clamp(Number(frame?.opacity ?? 1) || 0, 0, 1),
    }))
    .sort((a, b) => a.time - b.time);

  const seededKeyframes = keyframes.length > 0 ? keyframes : fallback.keyframes;

  if (seededKeyframes[0].time !== 0) {
    seededKeyframes.unshift({
      ...createTimelineKeyframe(0, 0),
      ...seededKeyframes[0],
      id: uid(),
      time: 0,
      name: 'Baslangic',
    });
  }
  if (seededKeyframes[seededKeyframes.length - 1].time !== nextDuration) {
    seededKeyframes.push({
      ...createTimelineKeyframe(nextDuration, seededKeyframes.length),
      ...seededKeyframes[seededKeyframes.length - 1],
      id: uid(),
      time: nextDuration,
      name: 'Bitis',
    });
  }

  return {
    ...fallback,
    ...item,
    objectId,
    name: item.name || linkedObject?.label || fallback.name,
    start: Math.max(0, Number(item.start ?? fallback.start) || 0),
    duration: nextDuration,
    track: index,
    entryEffect: TIMELINE_EFFECT_OPTIONS.some((option) => option.value === item.entryEffect)
      ? item.entryEffect
      : fallback.entryEffect,
    exitEffect: TIMELINE_EFFECT_OPTIONS.some((option) => option.value === item.exitEffect)
      ? item.exitEffect
      : fallback.exitEffect,
    direction: TIMELINE_DIRECTION_OPTIONS.some((option) => option.value === item.direction)
      ? item.direction
      : fallback.direction,
    easing: TIMELINE_EASING_OPTIONS.some((option) => option.value === item.easing)
      ? item.easing
      : fallback.easing,
    keyframes: seededKeyframes,
  };
}
function syncTimelineWithObjects(activity = {}) {
  const objects = Array.isArray(activity.objects) ? activity.objects : [];
  const existing = Array.isArray(activity.timeline)
    ? activity.timeline.map((item, index) => normalizeTimelineItem(item, index, objects))
    : [];
  const existingByObject = new Map(
    existing.filter((item) => item.objectId).map((item) => [item.objectId, item])
  );

  return objects.map((object, index) => {
    const clip = existingByObject.get(object.id);
    return normalizeTimelineItem(clip || createTimelineItem(index, object), index, objects);
  });
}

function getActivityTimeline(activity = {}) {
  return syncTimelineWithObjects(activity);
}

function getTimelineItemForObject(activity = {}, objectId = '') {
  return getActivityTimeline(activity).find((item) => item.objectId === objectId) || null;
}

function getTimelineDuration(activity = {}) {
  const timeline = getActivityTimeline(activity);
  const duration = timeline.reduce(
    (maxValue, item) => Math.max(maxValue, (item.start || 0) + (item.duration || 0)),
    0
  );
  return Math.max(5, Number(duration.toFixed(2)) || 5);
}

export {
  createTimelineKeyframe,
  createTimelineItem,
  normalizeTimelineItem,
  syncTimelineWithObjects,
  getActivityTimeline,
  getTimelineItemForObject,
  getTimelineDuration,
};

