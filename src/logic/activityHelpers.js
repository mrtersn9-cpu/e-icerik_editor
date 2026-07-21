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

// Bir sahnenin (slide) katman/nesne/tetikleyici/zaman çizelgesi id'lerini yeniden üretir ve
// bu id'lere yapılan tüm iç referansları (layerId, linkedActionTargetId, timeline.objectId,
// triggers[].target/value, triggers[].conditions[].sourceId/value, dragDropMatches) yeni
// id'lere göre eşler. `cloneActivitySlideForPaste` (tek sahne yapıştırma) ve
// `cloneActivityForDuplicate` (tüm etkinliği kopyalama) bu tek yardımcıyı paylaşır, böylece
// remap mantığı iki yerde tekrar edilmez.
//
// `slideIdMap` verilirse (etkinlik geneli kopyalamada olduğu gibi), "SliderGec" tetikleyici
// action'ının `value` alanı (bir SAHNE id'sine referans) da bu haritayla güncellenir. Tek sahne
// yapıştırmada slideIdMap verilmez; diğer sahnelerin id'leri değişmediği için SliderGec değeri
// olduğu gibi kalır.
function buildSlideRemap(source = {}, { slideIdMap } = {}) {
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
      // "SayfaGec" action'ının value'su BAŞKA bir etkinliğin id'sidir (kopyalanmıyor) — bilerek
      // dokunulmuyor. "SliderGec" action'ının value'su BU etkinliğin bir sahne id'sidir; slideIdMap
      // verildiyse (tüm etkinlik kopyalanırken) yeni sahne id'sine eşlenir.
      value:
        trigger.action === 'SliderGec' && slideIdMap
          ? slideIdMap.get(trigger.value) || trigger.value
          : remapReference(trigger.value, objectIdMap, layerMap),
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

  return {
    layers: nextLayers.length ? nextLayers : source.layers,
    activeLayerId: remapReference(source.activeLayerId || 'base', objectIdMap, layerMap),
    objects: nextObjects,
    selectedObjectId: remapReference(source.selectedObjectId, objectIdMap, layerMap),
    timeline: nextTimeline,
    triggers: nextTriggers,
    dragDropMatches: remapIdRecord(source.dragDropMatches, objectIdMap),
    objectIdMap,
    layerMap,
  };
}

export function cloneActivitySlideForPaste(sourceSlide = {}, insertIndex = 0) {
  const source = clonePlain(sourceSlide) || {};
  const remap = buildSlideRemap(source);

  return normalizeSlide(
    {
      ...source,
      id: uid(),
      name: `${source.name || 'Sahne'} Kopya`,
      sceneName: `${source.sceneName || source.name || 'Sahne'} Kopya`,
      layers: remap.layers,
      activeLayerId: remap.activeLayerId,
      objects: remap.objects,
      selectedObjectId: remap.selectedObjectId,
      timeline: remap.timeline,
      triggers: remap.triggers,
      dragDropMatches: remap.dragDropMatches,
    },
    insertIndex
  );
}

// Bir etkinliğin TAMAMINI (tüm sahneleriyle birlikte) kopyalar; her sahne için ayrı bir
// nesne/katman id haritası kurar, id'leri yeniden üretir ve bu id'lere yapılan tüm iç
// referansları (bkz. buildSlideRemap) günceller. Etkinlik seviyesindeki (slide dışı,
// activity.objects/activity.triggers/... alanlarındaki) ayna veriler de mevcut sahneyle
// tutarlı kalacak şekilde güncellenir.
//
// DİKKAT: "SayfaGec" tetikleyicisinin value'su başka bir ETKİNLİĞE (kopyalanmayan) referans
// verebilir — bilerek değiştirilmiyor. "DegiskenAta/DegiskenArttir/DegiskenAzalt" value'su bir
// DEĞİŞKEN id'sidir; değişkenler bu fonksiyonda yeniden üretilmediği için (aynı activity.variables
// tanımları korunuyor) remap gerekmez ve zaten objectIdMap/layerMap içinde bulunmadıkları için
// remapReference bu değerlere dokunmaz.
export function cloneActivityForDuplicate(activity = {}) {
  const source = clonePlain(activity) || {};
  const copy = { ...source, id: uid() };

  const sourceSlides = Array.isArray(source.slides) ? source.slides : [];
  const slideIdMap = new Map();
  sourceSlides.forEach((slide) => {
    if (slide?.id) slideIdMap.set(slide.id, uid());
  });

  if (sourceSlides.length) {
    const nextSlides = sourceSlides.map((slide, index) => {
      const remap = buildSlideRemap(slide, { slideIdMap });
      return normalizeSlide(
        {
          ...slide,
          id: slideIdMap.get(slide.id) || uid(),
          layers: remap.layers,
          activeLayerId: remap.activeLayerId,
          objects: remap.objects,
          selectedObjectId: remap.selectedObjectId,
          timeline: remap.timeline,
          triggers: remap.triggers,
          dragDropMatches: remap.dragDropMatches,
        },
        index
      );
    });

    copy.slides = nextSlides;
    copy.currentSlideId = slideIdMap.get(source.currentSlideId) || nextSlides[0]?.id || '';
    copy.startSlideId = slideIdMap.get(source.startSlideId) || nextSlides[0]?.id || '';

    // Etkinlik köküne aynalanan (materializeActivity/commitMaterializedActivity tarafından
    // yazılan) slide-dışı objects/triggers/... alanları, kopyadaki GÜNCEL sahneyle senkron
    // kalsın diye o sahnenin yeni id'leriyle değiştirilir — aksi halde eski (artık var olmayan)
    // id'lere işaret eden bayat bir kopya kalır.
    const currentSlide =
      nextSlides.find((slide) => slide.id === copy.currentSlideId) || nextSlides[0];
    if (currentSlide) {
      copy.layers = currentSlide.layers;
      copy.activeLayerId = currentSlide.activeLayerId;
      copy.objects = currentSlide.objects;
      copy.selectedObjectId = currentSlide.selectedObjectId;
      copy.timeline = currentSlide.timeline;
      copy.triggers = currentSlide.triggers;
      copy.dragDropMatches = currentSlide.dragDropMatches;
    }
  } else {
    // Sahnesiz (legacy) etkinlik: doğrudan kök seviyedeki objects/triggers/... alanlarını
    // aynı mantıkla yeniden üret.
    const remap = buildSlideRemap(source, { slideIdMap });
    copy.layers = remap.layers;
    copy.activeLayerId = remap.activeLayerId;
    copy.objects = remap.objects;
    copy.selectedObjectId = remap.selectedObjectId;
    copy.timeline = remap.timeline;
    copy.triggers = remap.triggers;
    copy.dragDropMatches = remap.dragDropMatches;
  }

  return copy;
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
