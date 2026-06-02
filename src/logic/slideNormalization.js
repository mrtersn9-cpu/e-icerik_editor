import {
  SLIDE_STATE_KEYS,
  SLIDE_TRANSITION_OPTIONS,
  TIMELINE_DIRECTION_OPTIONS,
} from '../constants';
import { uid } from '../utils/editorHelpers';

import { createTriggerItem, createTriggerConditionItem } from './activityFactory';
import { createSlide, createLayer, ensureSlideDefaultLayers } from './factories';
import { normalizeObject } from './normalize';
import { syncTimelineWithObjects } from './timeline';

function normalizeSlideObjectsForLayers(objects = [], layers = []) {
  const layerIds = new Set((layers || []).map((layer) => layer.id).filter(Boolean));
  return (objects || []).map((object, index) => {
    const width = Math.max(1, Number(object.width ?? 1) || 1);
    const height = Math.max(1, Number(object.height ?? 1) || 1);
    const x = Number.isFinite(Number(object.x)) ? Number(object.x) : 0;
    const y = Number.isFinite(Number(object.y)) ? Number(object.y) : 0;
    const layerId = layerIds.has(object.layerId) ? object.layerId : 'base';
    return {
      ...object,
      id: object.id || uid(),
      x,
      y,
      width,
      height,
      zIndex: Number.isFinite(Number(object.zIndex)) ? Number(object.zIndex) : index + 1,
      layerId,
      visible: object.visible !== false,
      locked: !!object.locked,
    };
  });
}

function normalizeSlideTriggersForScene(triggers = [], objects = [], layers = []) {
  const objectIds = new Set((objects || []).map((object) => object.id).filter(Boolean));
  const layerIds = new Set((layers || []).map((layer) => layer.id).filter(Boolean));
  const staticSources = new Set([
    'Secili Nesne',
    'TiklananNesne',
    'selected',
    '__activity__',
    'Sahne',
  ]);
  const validWhens = new Set([
    'onClick',
    'onHover',
    'onDrop',
    'onDragEnter',
    'onDragLeave',
    'onKeypress',
    'onDoubleClick',
    'onLoad',
    'onOffSlide',
    'onTimer',
    'onTimelineEnd',
    'onMediaEnd',
    'onMediaStart',
    'onStateChange',
    'onVariableChange',
    'onWidgetEvent',
    'onDropCorrect',
    'onDropIncorrect',
    'onSubmit',
  ]);

  return (Array.isArray(triggers) ? triggers : []).map((trigger, indexValue) => {
    trigger = trigger && typeof trigger === 'object' ? trigger : {};
    const when = validWhens.has(trigger.when) ? trigger.when : 'onClick';
    const action = trigger.action || 'SayfaGec';
    let target = when === 'onLoad' ? '__activity__' : trigger.target || 'Secili Nesne';
    let value = trigger.value ?? '';

    if (!staticSources.has(target) && !objectIds.has(target)) {
      target = when === 'onLoad' ? '__activity__' : 'Secili Nesne';
    }

    if (action === 'KatmanaGec' && !layerIds.has(value)) {
      value = layerIds.has('base') ? 'base' : layers[0]?.id || '';
    }

    if (
      (action === 'Goster' || action === 'Gizle' || action === 'NesneDurumuAyarla') &&
      !objectIds.has(value)
    ) {
      value = '';
    }

    if ((action === 'SayfaGec' || action === 'SliderGec') && !value) {
      value = '__next__';
    }

    return {
      ...createTriggerItem(indexValue),
      ...trigger,
      when,
      target,
      action,
      value,
      conditions: Array.isArray(trigger.conditions)
        ? trigger.conditions.map((condition, conditionIndex) => ({
            ...createTriggerConditionItem(conditionIndex),
            ...(condition && typeof condition === 'object' ? condition : {}),
          }))
        : [],
    };
  });
}

function pickSlideState(source = {}) {
  source = source && typeof source === 'object' ? source : {};
  return Object.fromEntries(SLIDE_STATE_KEYS.map((key) => [key, source[key]]));
}

function normalizeSlide(slide = {}, index = 0) {
  slide = slide && typeof slide === 'object' ? slide : {};
  const fallback = createSlide(slide.name || `Slider ${index + 1}`, index);
  const rawLayers =
    Array.isArray(slide.layers) && slide.layers.length
      ? slide.layers.map((layer, layerIndex) => {
          layer = layer && typeof layer === 'object' ? layer : {};
          return {
            ...createLayer('Katman', layerIndex),
            ...layer,
            id: layerIndex === 0 ? 'base' : layer.id || uid(),
            kind: layerIndex === 0 ? 'base' : layer.kind || 'overlay',
            autoName:
              layerIndex === 0
                ? true
                : typeof layer.autoName === 'boolean'
                  ? layer.autoName
                  : !String(layer.name || '').trim(),
          };
        })
      : fallback.layers;
  const layers = ensureSlideDefaultLayers(rawLayers, slide);
  let normalizedObjects = Array.isArray(slide.objects)
    ? slide.objects.map(normalizeObject)
    : fallback.objects;
  const sourceStageWidth = Math.max(1, Number(slide.stageWidth || fallback.stageWidth || 1920));
  const sourceStageHeight = Math.max(1, Number(slide.stageHeight || fallback.stageHeight || 1080));
  const hasPdfBackground = normalizedObjects.some(
    (object) => object?.isPdfBackground && object?.imageData
  );
  if (hasPdfBackground && (sourceStageWidth !== 1920 || sourceStageHeight !== 1080)) {
    const scaleX = 1920 / sourceStageWidth;
    const scaleY = 1080 / sourceStageHeight;
    normalizedObjects = normalizedObjects.map((object) => ({
      ...object,
      x: Number(object.x || 0) * scaleX,
      y: Number(object.y || 0) * scaleY,
      width: object.isPdfBackground ? 1920 : Math.max(1, Number(object.width || 0) * scaleX),
      height: object.isPdfBackground ? 1080 : Math.max(1, Number(object.height || 0) * scaleY),
    }));
  }
  normalizedObjects = normalizeSlideObjectsForLayers(normalizedObjects, layers);
  const objectIds = new Set(normalizedObjects.map((object) => object.id));
  const selectedObjectId = objectIds.has(slide.selectedObjectId) ? slide.selectedObjectId : null;
  const normalizedTriggers = normalizeSlideTriggersForScene(
    slide.triggers,
    normalizedObjects,
    layers
  );
  const nextSlide = {
    ...fallback,
    ...slide,
    name: slide.name || fallback.name,
    sceneName: slide.sceneName || fallback.sceneName,
    stageWidth: hasPdfBackground ? 1920 : Number(slide.stageWidth || fallback.stageWidth || 1920),
    stageHeight: hasPdfBackground
      ? 1080
      : Number(slide.stageHeight || fallback.stageHeight || 1080),
    layers,
    activeLayerId: layers.some((layer) => layer.id === slide.activeLayerId)
      ? slide.activeLayerId
      : 'base',
    nextActivityId: slide.nextActivityId || '',
    objects: normalizedObjects,
    selectedObjectId,
    timeline: Array.isArray(slide.timeline) ? slide.timeline : [],
    triggers: normalizedTriggers,
    audioUrl: slide.audioUrl || '',
    audioName: slide.audioName || '',
    audioAutoPlay: slide.audioAutoPlay !== false,
    audioLoop: !!slide.audioLoop,
    slideTransitionEffect: SLIDE_TRANSITION_OPTIONS.some(
      (option) => option.value === slide.slideTransitionEffect
    )
      ? slide.slideTransitionEffect
      : 'fade',
    slideTransitionDirection: TIMELINE_DIRECTION_OPTIONS.some(
      (option) => option.value === slide.slideTransitionDirection
    )
      ? slide.slideTransitionDirection
      : 'left',
    slideTransitionDuration: Math.min(
      2.5,
      Math.max(0, Number(slide.slideTransitionDuration ?? 0.45) || 0)
    ),
  };
  return {
    ...nextSlide,
    timeline: syncTimelineWithObjects({
      ...nextSlide,
      objects: normalizedObjects,
    }),
  };
}

export {
  normalizeSlideObjectsForLayers,
  normalizeSlideTriggersForScene,
  pickSlideState,
  normalizeSlide,
};
