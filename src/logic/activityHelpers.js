import { uid } from '../utils/editorHelpers';
import { getStorylineRuntimeCorrectDragMatches } from '../utils/storylineRuntimeEngine';

import { createActivity, createSlide, createLayer } from './factories';
import { pickSlideState, normalizeSlide } from './slideNormalization';

export function materializeActivity(activity = {}) {
  const fallback = createActivity(activity.name || 'Etkinlik', activity.type || 'selection');
  const slides = Array.isArray(activity.slides) && activity.slides.length ? activity.slides : [];
  const startSlideId = slides[0]?.id || '';
  const currentSlide = slides.length
    ? slides.find((slide) => slide.id === activity.currentSlideId) ||
      slides.find((slide) => slide.id === startSlideId) ||
      slides[0]
    : null;
  return currentSlide
    ? {
        ...activity,
        ...pickSlideState(currentSlide),
        currentSlideId: currentSlide.id,
        startSlideId,
      }
    : { ...fallback, ...activity, startSlideId: fallback.startSlideId };
}

export function commitMaterializedActivity(activity = {}) {
  const fallback = createActivity(activity.name || 'Etkinlik', activity.type || 'selection');
  const existingSlides =
    Array.isArray(activity.slides) && activity.slides.length
      ? activity.slides
      : [{ ...createSlide('Slider 1', 0), ...pickSlideState({ ...fallback, ...activity }) }];
  const currentSlideId = existingSlides.some((slide) => slide.id === activity.currentSlideId)
    ? activity.currentSlideId
    : existingSlides[0].id;
  const startSlideId = existingSlides[0].id;
  const slidePatch = pickSlideState({ ...fallback, ...activity });
  const slides = existingSlides.map((slide, index) =>
    slide.id === currentSlideId
      ? normalizeSlide(
          { ...slide, ...slidePatch, name: slide.name || `Slider ${index + 1}` },
          index
        )
      : normalizeSlide(slide, index)
  );
  return { ...activity, slides, currentSlideId, startSlideId };
}

export function selectActivitySlide(activity = {}, slideId = '') {
  const slides = Array.isArray(activity.slides) ? activity.slides : [];
  const target = slides.find((slide) => slide.id === slideId) || slides[0];
  if (!target) return activity;
  return { ...activity, currentSlideId: target.id, ...pickSlideState(target) };
}

export function getActivitySlides(activity = {}) {
  return Array.isArray(activity?.slides) && activity.slides.length
    ? activity.slides.map((slide, index) => normalizeSlide(slide, index))
    : [normalizeSlide(pickSlideState(activity), 0)];
}

export function getActivitySlideTarget(activity = {}, value = '__next__') {
  const slides = getActivitySlides(activity);
  if (!slides.length) return null;
  const currentIndex = Math.max(
    0,
    slides.findIndex((slide) => slide.id === activity?.currentSlideId)
  );
  if (value === '__next__') return slides[currentIndex + 1] || null;
  if (value === '__prev__') return slides[currentIndex - 1] || null;
  return slides.find((slide) => slide.id === value) || null;
}

export function materializeActivitySlide(activity = {}, slideId = '') {
  const committed = commitMaterializedActivity(activity);
  const target = getActivitySlideTarget(committed, slideId || committed.currentSlideId);
  return target ? materializeActivity({ ...committed, currentSlideId: target.id }) : committed;
}

function clonePlain(value) {
  if (value == null) return value;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

function remapReference(value, idMap, layerMap) {
  if (typeof value !== 'string') return value;
  return idMap.get(value) || layerMap.get(value) || value;
}

function remapIdRecord(record = {}, idMap) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return record || {};
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      idMap.get(key) || key,
      typeof value === 'string' ? idMap.get(value) || value : value,
    ])
  );
}

export function cloneActivitySlideForPaste(sourceSlide = {}, insertIndex = 0) {
  const source = clonePlain(sourceSlide) || {};
  const layerMap = new Map([['base', 'base']]);
  const objectIdMap = new Map();
  const groupIdMap = new Map();

  const layers = Array.isArray(source.layers) ? source.layers : [];
  const nextLayers = layers.map((layer, index) => {
    const sourceId = layer?.id || (index === 0 ? 'base' : '');
    const nextId = index === 0 ? 'base' : uid();
    if (sourceId) layerMap.set(sourceId, nextId);
    return { ...layer, id: nextId };
  });

  const sourceObjects = Array.isArray(source.objects) ? source.objects : [];
  sourceObjects.forEach((object) => {
    if (object?.id) objectIdMap.set(object.id, uid());
  });

  const nextObjects = sourceObjects.map((object, index) => {
    const sourceGroupId = String(object?.groupId || '').trim();
    if (sourceGroupId && !groupIdMap.has(sourceGroupId)) groupIdMap.set(sourceGroupId, uid());
    const nextId = objectIdMap.get(object.id) || uid();
    return {
      ...object,
      id: nextId,
      groupId: sourceGroupId ? groupIdMap.get(sourceGroupId) : object.groupId || '',
      layerId: remapReference(object.layerId || 'base', objectIdMap, layerMap),
      linkedActionTargetId: remapReference(object.linkedActionTargetId, objectIdMap, layerMap),
      style: object.style ? { ...object.style } : object.style,
      zIndex: Number.isFinite(Number(object.zIndex)) ? Number(object.zIndex) : index + 1,
    };
  });

  const nextTimeline = (Array.isArray(source.timeline) ? source.timeline : []).map((item, index) => ({
    ...item,
    id: uid(),
    objectId: remapReference(item.objectId, objectIdMap, layerMap),
    track: index,
    keyframes: Array.isArray(item.keyframes)
      ? item.keyframes.map((frame) => ({ ...frame, id: uid() }))
      : [],
  }));

  const nextTriggers = (Array.isArray(source.triggers) ? source.triggers : []).map(
    (trigger, index) => ({
      ...trigger,
      id: uid(),
      target: remapReference(trigger.target, objectIdMap, layerMap),
      value: remapReference(trigger.value, objectIdMap, layerMap),
      name: trigger.name || `Tetik ${index + 1}`,
      conditions: Array.isArray(trigger.conditions)
        ? trigger.conditions.map((condition) => ({
            ...condition,
            id: uid(),
            sourceId: remapReference(condition.sourceId, objectIdMap, layerMap),
            value: remapReference(condition.value, objectIdMap, layerMap),
          }))
        : [],
    })
  );

  return normalizeSlide(
    {
      ...source,
      id: uid(),
      name: `${source.name || 'Sahne'} Kopya`,
      sceneName: `${source.sceneName || source.name || 'Sahne'} Kopya`,
      layers: nextLayers.length ? nextLayers : source.layers,
      activeLayerId: remapReference(source.activeLayerId || 'base', objectIdMap, layerMap),
      objects: nextObjects,
      selectedObjectId: remapReference(source.selectedObjectId, objectIdMap, layerMap),
      timeline: nextTimeline,
      triggers: nextTriggers,
      dragDropMatches: remapIdRecord(source.dragDropMatches, objectIdMap),
    },
    insertIndex
  );
}

export function pasteActivitySlide(activity = {}, sourceSlide = null, afterSlideId = '') {
  if (!sourceSlide) return activity;
  const slides = getActivitySlides(activity);
  const currentIndex = slides.findIndex(
    (slide) => slide.id === (afterSlideId || activity.currentSlideId)
  );
  const insertAt = currentIndex >= 0 ? currentIndex + 1 : slides.length;
  const nextSlide = cloneActivitySlideForPaste(sourceSlide, insertAt);
  const nextSlides = [...slides];
  nextSlides.splice(insertAt, 0, nextSlide);
  return selectActivitySlide(
    {
      ...activity,
      slides: nextSlides.map((slide, index) => normalizeSlide(slide, index)),
      currentSlideId: nextSlide.id,
    },
    nextSlide.id
  );
}

export function getActivityLayers(activity) {
  return Array.isArray(activity?.layers) && activity.layers.length
    ? activity.layers
    : [createLayer('Katman', 0)];
}

export function getCanvasObjects(
  activity,
  activeLayerId = activity?.activeLayerId || 'base',
  hiddenObjectIds = null
) {
  return (activity?.objects || []).filter((obj) => {
    const layerId = obj.layerId || 'base';
    if (hiddenObjectIds?.has?.(obj.id)) return false;
    if (obj?.isPdfMask) return false;
    return layerId === 'base' || layerId === activeLayerId;
  });
}

export function getCorrectDragMatches(activity) {
  return getStorylineRuntimeCorrectDragMatches({
    slide: activity,
    objects: getCanvasObjects(activity, 'base'),
  });
}
