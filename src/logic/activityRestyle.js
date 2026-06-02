// Etkinlik normalleştirme ve buton yeniden stillendirme yardımcıları.
// Bu fonksiyonlar daha önce EIcerikEditor.jsx içinde modül düzeyinde tanımlıydı;
// ActivityTextEditor bileşeni ayrı dosyaya taşınırken paylaşılan bir modüle çıkarıldılar.
// Davranış birebir korunmuştur, yalnızca konum değişti.

import {
  BUTTON_PACKAGES,
  BUTTON_PACKAGE_MOTION_PRESETS,
  DEFAULT_ACTIVITY_SETTINGS,
  DEFAULT_SELECTION_UI,
} from '../constants';
import { uid } from '../utils/editorHelpers';

import { isGeneratedSceneTemplateObject } from './activityFactory';
import {
  materializeActivity,
  commitMaterializedActivity,
  selectActivitySlide,
  getActivitySlides,
} from './activityHelpers';
import {
  restyleAllButtonsForPackage,
  getButtonPackageMotion,
  getButtonMotionProfile,
  getActivityButtonMotion,
} from './buttonStyling';
import { getActivityDragDropDefaults } from './dragDrop';
import { normalizeButtonPairLayoutForActivity } from './editorHelpers';
import { createActivity } from './factories';
import {
  SCENE_TEMPLATE_VERSION,
  SCENE_TEMPLATE_BUTTON_INTRO_ID,
  SCENE_TEMPLATE_LAUNCH_PAGE_ID,
  DEFAULT_ANSWER_LAYER_STYLE_PRESET_ID,
  applySceneTemplateToSlide,
} from './sceneTemplates';
import { normalizeSlide, pickSlideState } from './slideNormalization';
import { syncTimelineWithObjects } from './timeline';

// Etkinliği güvenli varsayılanlarla normalleştirir; sahneleri, paketleri ve
// ayarları tutarlı bir hale getirir.
export function normalizeActivity(activity = {}) {
  const fallback = createActivity(activity.name || 'Etkinlik', activity.type || 'selection');
  const legacySlide = normalizeSlide(
    {
      ...pickSlideState({ ...fallback, ...activity }),
      id: activity.currentSlideId || activity.startSlideId || uid(),
      name: 'Slider 1',
    },
    0
  );
  const normalizedSlides =
    Array.isArray(activity.slides) && activity.slides.length
      ? activity.slides.map((slide, index) => normalizeSlide(slide, index))
      : [legacySlide];
  const activeSceneTemplatePresetId =
    activity.answerLayerStylePresetId || DEFAULT_ANSWER_LAYER_STYLE_PRESET_ID;
  const syncedSlides = normalizedSlides.map((slide, index) => {
    const templateId = String(slide.sceneTemplateId || '').trim();
    const hasTemplateObjects =
      Array.isArray(slide.objects) && slide.objects.some(isGeneratedSceneTemplateObject);

    if (!templateId) {
      if (!hasTemplateObjects) return slide;
      return normalizeSlide(
        applySceneTemplateToSlide(slide, {
          templateId: '',
          presetId: activeSceneTemplatePresetId,
          slides: normalizedSlides,
          currentSlideId: slide.id,
        }),
        index
      );
    }

    if (
      templateId !== SCENE_TEMPLATE_BUTTON_INTRO_ID &&
      templateId !== SCENE_TEMPLATE_LAUNCH_PAGE_ID
    )
      return slide;

    if (
      slide.sceneTemplatePresetId === activeSceneTemplatePresetId &&
      Number(slide.sceneTemplateVersion || 0) === SCENE_TEMPLATE_VERSION &&
      hasTemplateObjects
    )
      return slide;

    return normalizeSlide(
      applySceneTemplateToSlide(slide, {
        templateId,
        presetId: activeSceneTemplatePresetId,
        preserveNonGenerated: true,
        replaceExisting: false,
        slides: normalizedSlides,
        currentSlideId: slide.id,
      }),
      index
    );
  });
  const startSlideId = syncedSlides[0]?.id;
  const currentSlideId = syncedSlides.some((slide) => slide.id === activity.currentSlideId)
    ? activity.currentSlideId
    : startSlideId;
  const currentSlide =
    syncedSlides.find((slide) => slide.id === currentSlideId) || syncedSlides[0] || legacySlide;
  const normalizedPackageId = BUTTON_PACKAGES.some((item) => item.id === activity.buttonPackageId)
    ? activity.buttonPackageId
    : fallback.buttonPackageId || BUTTON_PACKAGES[0]?.id || 'pkg-1';
  const normalizedAnimationProfileId = BUTTON_PACKAGE_MOTION_PRESETS[
    activity.buttonAnimationProfileId
  ]
    ? activity.buttonAnimationProfileId
    : BUTTON_PACKAGES.find((item) => item.id === normalizedPackageId)?.animationProfileId ||
      fallback.buttonAnimationProfileId ||
      'calmLift';
  const slideState = pickSlideState(currentSlide);
  const dragDropDefaults = getActivityDragDropDefaults({
    ...fallback,
    ...activity,
    ...slideState,
  });
  const nextActivity = {
    ...fallback,
    ...activity,
    ...slideState,
    buttonPackageId: normalizedPackageId,
    buttonAnimationProfileId: normalizedAnimationProfileId,
    settings: { ...DEFAULT_ACTIVITY_SETTINGS, ...(activity.settings || {}) },
    introScreen: { ...fallback.introScreen, ...(activity.introScreen || {}) },
    buttonPackageScreen: {
      ...fallback.buttonPackageScreen,
      ...(activity.buttonPackageScreen || {}),
    },
    menuScreen: { ...fallback.menuScreen, ...(activity.menuScreen || {}) },
    playScreen: { ...fallback.playScreen, ...(activity.playScreen || {}) },
    resultScreens: { ...fallback.resultScreens, ...(activity.resultScreens || {}) },
    answerScreen: { ...fallback.answerScreen, ...(activity.answerScreen || {}) },
    slides: syncedSlides,
    currentSlideId,
    startSlideId,
    dragDropDefaults,
    dragDropMode: activity.dragDropMode || 'single',
    dragDropMatches: activity.dragDropMatches ?? slideState.dragDropMatches ?? {},
    selectionUi: { ...DEFAULT_SELECTION_UI, ...(activity.selectionUi || slideState.selectionUi || {}) },
    mcOptions:
      Array.isArray(activity.mcOptions) && activity.mcOptions.length
        ? activity.mcOptions.map((opt) => ({ ...opt, id: opt.id || uid() }))
        : Array.isArray(slideState.mcOptions) && slideState.mcOptions.length
          ? slideState.mcOptions.map((opt) => ({ ...opt, id: opt.id || uid() }))
          : fallback.mcOptions,
  };
  return normalizeButtonPairLayoutForActivity(materializeActivity(nextActivity));
}

// Etkinlikteki tüm butonları seçilen tema paketine göre yeniden stillendirir.
export function restyleActivityButtonsForPackage(
  activity = {},
  pkgId = BUTTON_PACKAGES[0]?.id || 'pkg-1'
) {
  const committed = commitMaterializedActivity(activity);
  const motion =
    getActivityButtonMotion({ ...committed, buttonPackageId: pkgId }) ||
    getButtonPackageMotion(pkgId);
  const currentSlideId = committed.currentSlideId || committed.slides?.[0]?.id || '';
  const nextSlides = getActivitySlides(committed).map((slide, index) => {
    const nextObjects = restyleAllButtonsForPackage(slide.objects || [], pkgId).map((object) =>
      object?.type === 'button' && motion ? { ...object, buttonMotion: { ...motion } } : object
    );
    return normalizeSlide(
      {
        ...slide,
        objects: nextObjects,
        timeline: syncTimelineWithObjects({ ...slide, objects: nextObjects }),
      },
      index
    );
  });
  return selectActivitySlide(
    {
      ...committed,
      buttonPackageId: pkgId,
      buttonAnimationProfileId:
        committed.buttonAnimationProfileId ||
        BUTTON_PACKAGES.find((item) => item.id === pkgId)?.animationProfileId ||
        '',
      slides: nextSlides,
      startSlideId: nextSlides[0]?.id || committed.startSlideId || '',
      currentSlideId,
    },
    currentSlideId
  );
}

// Etkinlikteki butonların hareket profilini (animasyonunu) toplu olarak değiştirir.
export function restyleActivityButtonMotion(activity = {}, profileId = '') {
  const motion = getButtonMotionProfile(profileId);
  if (!motion)
    return normalizeActivity({
      ...activity,
      buttonAnimationProfileId: profileId || activity.buttonAnimationProfileId || '',
    });
  const committed = commitMaterializedActivity(activity);
  const currentSlideId = committed.currentSlideId || committed.slides?.[0]?.id || '';
  const nextSlides = getActivitySlides(committed).map((slide, index) => {
    const nextObjects = (slide.objects || []).map((object) =>
      object?.type === 'button' ? { ...object, buttonMotion: { ...motion } } : object
    );
    return normalizeSlide(
      {
        ...slide,
        objects: nextObjects,
        timeline: syncTimelineWithObjects({ ...slide, objects: nextObjects }),
      },
      index
    );
  });
  return selectActivitySlide(
    {
      ...committed,
      buttonAnimationProfileId: profileId,
      slides: nextSlides,
      currentSlideId,
      startSlideId: nextSlides[0]?.id || committed.startSlideId || '',
    },
    currentSlideId
  );
}
