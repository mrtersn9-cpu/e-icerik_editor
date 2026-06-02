import { getActivitySlides, selectActivitySlide } from './activityHelpers';
import { generateLegacyAnswerSceneSet } from './answerSceneSetGenerator';
import {
  createLayer,
  createSlide,
} from './factories';
import {
  applySceneTemplateToSlide,
  SCENE_TEMPLATE_BUTTON_INTRO_ID,
  SCENE_TEMPLATE_LAUNCH_PAGE_ID,
} from './sceneTemplates';
import { normalizeSlide } from './slideNormalization';

const templateLabels = {
  [SCENE_TEMPLATE_LAUNCH_PAGE_ID]: 'Etkinlik Girişi',
  [SCENE_TEMPLATE_BUTTON_INTRO_ID]: 'Etkinlik Tanıtımı',
};
const practiceSlideLabel = 'Etkinlik 1';
const legacyPracticeSlideLabels = new Set([safeText(practiceSlideLabel), safeText('Uygulama')]);

function baseOnlyLayers() {
  return [createLayer('', 0, { kind: 'base' })];
}

function safeText(value = '') {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('tr-TR');
}

function isTemplateName(slide = {}, templateId = '') {
  return safeText(slide.name || slide.sceneName) === safeText(templateLabels[templateId]);
}

function isPracticeName(slide = {}) {
  return legacyPracticeSlideLabels.has(safeText(slide.name || slide.sceneName));
}

function cloneOrCreateSlide(source, name, index) {
  const slide = source || createSlide(name, index);
  return {
    ...slide,
    name,
    sceneName: name,
  };
}

function ensureTemplateBaseSlide(slide = {}, templateId = '', index = 0, presetId = '') {
  const label = templateLabels[templateId] || 'Sahne';
  return normalizeSlide(
    {
      ...cloneOrCreateSlide(slide, label, index),
      sceneTemplateId: templateId,
      sceneTemplatePresetId: presetId,
      answerLayerStylePresetId: presetId,
      autoLayers: false,
      layers: baseOnlyLayers(),
      activeLayerId: 'base',
    },
    index
  );
}

function ensureAnswerLayerSetForSlide(slide = {}, activityType = '') {
  const nextSlide = {
    ...slide,
    type: slide.type || activityType || 'selection',
    name: slide.name || practiceSlideLabel,
    sceneName: slide.sceneName || slide.name || practiceSlideLabel,
    autoLayers: true,
    sceneTemplateId: '',
    sceneTemplatePresetId: '',
  };

  return generateLegacyAnswerSceneSet(nextSlide, { confirmExisting: false });
}

function takeSlide(slides, predicate, fallbackIndex = -1, fallbackName = 'Sahne') {
  const foundIndex = slides.findIndex(predicate);
  if (foundIndex >= 0) {
    const [slide] = slides.splice(foundIndex, 1);
    return slide;
  }
  if (fallbackIndex >= 0 && slides[fallbackIndex]) {
    const [slide] = slides.splice(fallbackIndex, 1);
    return slide;
  }
  return createSlide(fallbackName, fallbackIndex >= 0 ? fallbackIndex : 0);
}

function applyTemplatesWithContext(slides = [], presetId = '', options = {}) {
  const contextSlides = slides.map((slide, index) => normalizeSlide(slide, index));
  const forceRebuildGenerated = options.forceRebuildGenerated === true;
  return contextSlides.map((slide, index) => {
    if (![SCENE_TEMPLATE_LAUNCH_PAGE_ID, SCENE_TEMPLATE_BUTTON_INTRO_ID].includes(slide.sceneTemplateId)) {
      return normalizeSlide(slide, index);
    }
    return normalizeSlide(
      applySceneTemplateToSlide(slide, {
        currentSlideId: slide.id,
        preserveNonGenerated: true,
        presetId: slide.sceneTemplatePresetId || presetId,
        replaceExisting: false,
        respectDeletedSlots: !forceRebuildGenerated,
        slides: contextSlides,
        templateId: slide.sceneTemplateId,
      }),
      index
    );
  });
}

export function ensureSceneTemplateSlide(activity = {}, templateId = '', options = {}) {
  if (![SCENE_TEMPLATE_LAUNCH_PAGE_ID, SCENE_TEMPLATE_BUTTON_INTRO_ID].includes(templateId)) {
    return activity;
  }
  const presetId = activity.answerLayerStylePresetId || activity.sceneTemplatePresetId || '';
  const slides = getActivitySlides(activity);
  const targetIndex = slides.findIndex(
    (slide) => slide.sceneTemplateId === templateId || isTemplateName(slide, templateId)
  );
  const nextSlides =
    targetIndex >= 0
      ? slides.map((slide, index) =>
          index === targetIndex ? ensureTemplateBaseSlide(slide, templateId, index, presetId) : slide
        )
      : [
          ...slides,
          ensureTemplateBaseSlide(
            createSlide(templateLabels[templateId], slides.length),
            templateId,
            slides.length,
            presetId
          ),
        ];

  const orderedSlides = ensureStandardActivityScaffold(
    {
      ...activity,
      slides: nextSlides,
    },
    { select: templateId, forceRebuildGenerated: options.forceRebuildGenerated === true }
  );
  return orderedSlides;
}

export function ensureAnswerSceneLayerSet(activity = {}) {
  const slides = getActivitySlides(activity);
  if (slides.length <= 1 && !Array.isArray(activity.slides)) {
    return ensureAnswerLayerSetForSlide(activity, activity.type);
  }

  const preferredIndex = Math.max(
    0,
    slides.findIndex(
      (slide) =>
        isPracticeName(slide) ||
        ![SCENE_TEMPLATE_LAUNCH_PAGE_ID, SCENE_TEMPLATE_BUTTON_INTRO_ID].includes(
          String(slide.sceneTemplateId || '')
        )
    )
  );
  const targetSlide = slides[preferredIndex] || slides[0];
  const nextSlides = slides.map((slide, index) =>
    slide.id === targetSlide.id
      ? normalizeSlide(ensureAnswerLayerSetForSlide(slide, activity.type), index)
      : slide
  );
  return selectActivitySlide(
    {
      ...activity,
      slides: nextSlides,
      currentSlideId: targetSlide.id,
      startSlideId: nextSlides[0]?.id || activity.startSlideId || '',
    },
    targetSlide.id
  );
}

export function ensureStandardActivityScaffold(activity = {}, options = {}) {
  const presetId = activity.answerLayerStylePresetId || activity.sceneTemplatePresetId || '';
  const sourceSlides = [...getActivitySlides(activity)];
  const launch = ensureTemplateBaseSlide(
    takeSlide(
      sourceSlides,
      (slide) => slide.sceneTemplateId === SCENE_TEMPLATE_LAUNCH_PAGE_ID || isTemplateName(slide, SCENE_TEMPLATE_LAUNCH_PAGE_ID),
      -1,
      'Etkinlik Girişi'
    ),
    SCENE_TEMPLATE_LAUNCH_PAGE_ID,
    0,
    presetId
  );
  const intro = ensureTemplateBaseSlide(
    takeSlide(
      sourceSlides,
      (slide) => slide.sceneTemplateId === SCENE_TEMPLATE_BUTTON_INTRO_ID || isTemplateName(slide, SCENE_TEMPLATE_BUTTON_INTRO_ID),
      -1,
      'Etkinlik Tanıtımı'
    ),
    SCENE_TEMPLATE_BUTTON_INTRO_ID,
    1,
    presetId
  );
  const practiceSource = takeSlide(sourceSlides, isPracticeName, 0, practiceSlideLabel);
  const practice = normalizeSlide(
    ensureAnswerLayerSetForSlide({
      ...cloneOrCreateSlide(practiceSource, practiceSlideLabel, 2),
      type: practiceSource.type || activity.type || 'selection',
      sceneTemplateId: '',
      sceneTemplatePresetId: '',
    }),
    2
  );
  const orderedSlides = applyTemplatesWithContext(
    [launch, intro, practice, ...sourceSlides].map((slide, index) => normalizeSlide(slide, index)),
    presetId,
    { forceRebuildGenerated: options.forceRebuildGenerated === true }
  );
  const selectOption = options.select;
  const selectedSlide =
    selectOption === SCENE_TEMPLATE_LAUNCH_PAGE_ID
      ? orderedSlides.find((slide) => slide.sceneTemplateId === SCENE_TEMPLATE_LAUNCH_PAGE_ID)
      : selectOption === SCENE_TEMPLATE_BUTTON_INTRO_ID
        ? orderedSlides.find((slide) => slide.sceneTemplateId === SCENE_TEMPLATE_BUTTON_INTRO_ID)
        : selectOption === 'practice'
          ? orderedSlides.find(isPracticeName)
          : orderedSlides.find((slide) => slide.id === activity.currentSlideId) || orderedSlides[0];

  return selectActivitySlide(
    {
      ...activity,
      slides: orderedSlides,
      currentSlideId: selectedSlide?.id || orderedSlides[0]?.id || activity.currentSlideId,
      startSlideId: orderedSlides[0]?.id || activity.startSlideId || '',
    },
    selectedSlide?.id || orderedSlides[0]?.id || ''
  );
}

export { SCENE_TEMPLATE_BUTTON_INTRO_ID, SCENE_TEMPLATE_LAUNCH_PAGE_ID };
