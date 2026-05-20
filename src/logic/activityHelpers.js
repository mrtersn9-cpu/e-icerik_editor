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
