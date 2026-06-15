import {
  TIMELINE_EFFECT_OPTIONS,
  TIMELINE_DIRECTION_OPTIONS,
  TIMELINE_EASING_OPTIONS,
} from '../constants';
import { uid, clamp } from '../utils/editorHelpers';

const TIMELINE_DEFAULT_DURATION = 5;
const TIMELINE_MIN_CLIP_DURATION = 0.2;

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
    TIMELINE_MIN_CLIP_DURATION,
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

  // Diziyi kopyala: bos durumda fallback.keyframes referansina unshift/push ile in-place
  // mutasyon, ...fallback ile donen nesneyle paylasilan referansi bozuyordu (undo/redo riski).
  const seededKeyframes = [...(keyframes.length > 0 ? keyframes : fallback.keyframes)];

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

function formatTimelineTime(seconds = 0) {
  const totalCentiseconds = Math.max(0, Math.round((Number(seconds) || 0) * 100));
  const minutes = Math.floor(totalCentiseconds / 6000);
  const wholeSeconds = Math.floor((totalCentiseconds % 6000) / 100);
  const centiseconds = totalCentiseconds % 100;
  return `${String(minutes).padStart(2, '0')}:${String(wholeSeconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
}

function normalizeTimelineCuePoints(cuePoints = [], duration = TIMELINE_DEFAULT_DURATION) {
  const maxTime = Math.max(TIMELINE_DEFAULT_DURATION, Number(duration) || TIMELINE_DEFAULT_DURATION);
  return (Array.isArray(cuePoints) ? cuePoints : [])
    .map((cue, index) => ({
      id: cue?.id || uid(),
      time: clamp(Number(cue?.time ?? 0) || 0, 0, maxTime),
      label: cue?.label || `Cue ${index + 1}`,
    }))
    .sort((a, b) => a.time - b.time)
    .map((cue, index) => ({
      ...cue,
      label: cue.label && !/^Cue \d+$/i.test(cue.label) ? cue.label : `Cue ${index + 1}`,
    }));
}

function getObjectMediaDuration(object = {}) {
  const candidates = [
    object.mediaDuration,
    object.mediaDurationSeconds,
    object.audioDuration,
    object.videoDuration,
    object.durationSeconds,
  ];
  const value = candidates.find((item) => Number(item) > 0);
  return Number(value) || 0;
}

function getTimelineAutoDuration(activity = {}) {
  const timeline = getActivityTimeline(activity);
  const clipDuration = timeline.reduce(
    (maxValue, item) => Math.max(maxValue, (item.start || 0) + (item.duration || 0)),
    0
  );
  const mediaDuration = (activity.objects || []).reduce((maxValue, object) => {
    if (!['audio', 'video'].includes(object?.type)) return maxValue;
    return Math.max(maxValue, getObjectMediaDuration(object));
  }, 0);
  return Math.max(TIMELINE_DEFAULT_DURATION, Number(Math.max(clipDuration, mediaDuration).toFixed(2)) || 0);
}

function getTimelineDuration(activity = {}) {
  const autoDuration = getTimelineAutoDuration(activity);
  const manualDuration = Number(activity.timelineDuration);
  return Math.max(autoDuration, Number.isFinite(manualDuration) ? manualDuration : 0);
}

function fitTimelineDuration(activity = {}) {
  return {
    ...activity,
    timelineDuration: getTimelineAutoDuration(activity),
  };
}

function resetTimelineDuration(activity = {}) {
  return {
    ...activity,
    timelineDuration: getTimelineAutoDuration({ ...activity, timelineDuration: TIMELINE_DEFAULT_DURATION }),
  };
}

function getTimelineSnapValue(
  time = 0,
  { cuePoints = [], duration = TIMELINE_DEFAULT_DURATION, enabled = true, step = 0.1 } = {}
) {
  const safeTime = clamp(Number(time) || 0, 0, Math.max(duration, TIMELINE_DEFAULT_DURATION));
  if (!enabled) return Number(safeTime.toFixed(2));
  const nearestCue = cuePoints
    .map((cue) => ({ cue, delta: Math.abs((Number(cue.time) || 0) - safeTime) }))
    .sort((a, b) => a.delta - b.delta)[0];
  if (nearestCue && nearestCue.delta <= Math.max(0.06, step / 2)) {
    return Number((Number(nearestCue.cue.time) || 0).toFixed(2));
  }
  const safeStep = Math.max(0.01, Number(step) || 0.1);
  return Number((Math.round(safeTime / safeStep) * safeStep).toFixed(2));
}

function alignTimelineItemToPlayhead(timeline = [], itemId = '', playheadTime = 0, mode = 'start') {
  return timeline.map((item) => {
    if (item.id !== itemId) return item;
    const duration = Math.max(TIMELINE_MIN_CLIP_DURATION, Number(item.duration) || TIMELINE_MIN_CLIP_DURATION);
    const playhead = Math.max(0, Number(playheadTime) || 0);
    if (mode === 'end') {
      return { ...item, start: Math.max(0, Number((playhead - duration).toFixed(2))) };
    }
    if (mode === 'playhead-to-start' || mode === 'playhead-to-end') {
      return item;
    }
    return { ...item, start: Number(playhead.toFixed(2)) };
  });
}

function moveTimelineItemTrack(timeline = [], itemId = '', direction = 0) {
  const index = timeline.findIndex((item) => item.id === itemId);
  if (index < 0) return timeline;
  const nextIndex = clamp(index + direction, 0, timeline.length - 1);
  if (nextIndex === index) return timeline;
  const nextTimeline = [...timeline];
  const [item] = nextTimeline.splice(index, 1);
  nextTimeline.splice(nextIndex, 0, item);
  return nextTimeline.map((entry, track) => ({ ...entry, track }));
}

function canEditTimelineItem(item = {}, objects = []) {
  const object = objects.find((entry) => entry.id === item.objectId);
  return object?.locked !== true;
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

export {
  TIMELINE_DEFAULT_DURATION,
  TIMELINE_MIN_CLIP_DURATION,
  alignTimelineItemToPlayhead,
  canEditTimelineItem,
  createTimelineKeyframe,
  createTimelineItem,
  fitTimelineDuration,
  formatTimelineTime,
  normalizeTimelineItem,
  normalizeTimelineCuePoints,
  getTimelineAutoDuration,
  syncTimelineWithObjects,
  getActivityTimeline,
  getTimelineItemForObject,
  getTimelineDuration,
  getTimelineSnapValue,
  moveTimelineItemTrack,
  resetTimelineDuration,
};

