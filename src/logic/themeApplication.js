import {
  commitMaterializedActivity,
  getActivityLayers,
  getActivitySlides,
  selectActivitySlide,
} from './activityHelpers';
import {
  restyleAnswerLayerObjectsForPreset,
  restyleReadyButtonsForPreset,
} from './buttonStyling';
import { buildResolvedLayerNameMap } from './factories';
import {
  applySceneTemplateToSlide,
  SCENE_TEMPLATE_BUTTON_INTRO_ID,
  SCENE_TEMPLATE_LAUNCH_PAGE_ID,
} from './sceneTemplates';
import { normalizeSlide } from './slideNormalization';
import { syncTimelineWithObjects } from './timeline';

const GENERATED_TEMPLATE_IDS = new Set([
  SCENE_TEMPLATE_BUTTON_INTRO_ID,
  SCENE_TEMPLATE_LAUNCH_PAGE_ID,
]);

function restyleGeneratedObjectsForPreset(slide = {}, presetId = '', options = {}) {
  const layers = getActivityLayers(slide);
  const resolvedLayerNames = buildResolvedLayerNameMap(layers, slide);
  const readyStyled = restyleReadyButtonsForPreset(slide.objects || [], presetId, options);
  return restyleAnswerLayerObjectsForPreset(
    readyStyled,
    layers,
    resolvedLayerNames,
    presetId,
    options
  );
}

export function applyGeneratedThemeToActivity(activity = {}, presetId = '') {
  if (!presetId) return activity;

  const committed = commitMaterializedActivity(activity);
  // Kullanıcının seçtiği global hazır-buton yazı rengi (varsa) tüm butonlara uygulanır.
  const styleOptions = { textColor: committed.readyButtonTextColor || '' };
  const slides = getActivitySlides(committed);
  const currentSlideId = committed.currentSlideId || slides[0]?.id || '';
  const contextSlides = slides.map((slide, index) =>
    normalizeSlide(
      {
        ...slide,
        answerLayerStylePresetId: presetId,
        sceneTemplatePresetId: slide.sceneTemplateId ? presetId : slide.sceneTemplatePresetId,
      },
      index
    )
  );

  const nextSlides = contextSlides.map((slide, index) => {
    const templateId = String(slide.sceneTemplateId || '');
    let nextSlide = slide;

    if (GENERATED_TEMPLATE_IDS.has(templateId)) {
      nextSlide = applySceneTemplateToSlide(slide, {
        currentSlideId: slide.id,
        preserveNonGenerated: true,
        presetId,
        replaceExisting: false,
        respectDeletedSlots: false,
        slides: contextSlides,
        templateId,
      });
    }

    const objects = restyleGeneratedObjectsForPreset(nextSlide, presetId, styleOptions);
    return normalizeSlide(
      {
        ...nextSlide,
        answerLayerStylePresetId: presetId,
        sceneTemplatePresetId: GENERATED_TEMPLATE_IDS.has(templateId)
          ? presetId
          : nextSlide.sceneTemplatePresetId,
        objects,
        timeline: syncTimelineWithObjects({ ...nextSlide, objects }),
      },
      index
    );
  });

  return selectActivitySlide(
    {
      ...committed,
      answerLayerStylePresetId: presetId,
      sceneTemplatePresetId: presetId,
      slides: nextSlides,
      currentSlideId,
      startSlideId: nextSlides[0]?.id || committed.startSlideId || '',
    },
    currentSlideId
  );
}
