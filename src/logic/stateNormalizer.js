import {
  BUTTON_PACKAGES,
  ANSWER_LAYER_STYLE_PRESETS,
  BUTTON_PACKAGE_MOTION_PRESETS,
  DEFAULT_ACTIVITY_SETTINGS,
  DEFAULT_SELECTION_UI,
  INITIAL_STATE,
  BOOK_LAYER_PRESET_KEYS,
  TEXT_STUDIO_SETTING_KEYS,
} from '../constants';
import {
  uid,
} from '../utils/editorHelpers';
import {
  normalizeScorm12LmsConfig,
  maskLmsSecrets,
  REDACTED_SECRET_VALUE,
  hasLmsSecrets,
} from '../utils/lmsSecurity';
import {
  enforceTtkbEditorState,
  enforceTtkbActivityCompliance,
  restyleActivityButtonsForPackage,
} from '../utils/ttkbCompliance';

import {
  isGeneratedSceneTemplateObject,
} from './activityFactory';
import {
  materializeActivity,
  commitMaterializedActivity,
} from './activityHelpers';
import {
  ensureStandardActivityScaffold,
} from './activityTemplateGenerators';
import {
  getActivityDragDropDefaults,
  getDragDropPairKey,
} from './dragDrop';
import {
  safeClone,
  getAnswerPlacementFrames,
  normalizeButtonPairLayoutForActivity,
} from './editorHelpers';
import {
  createActivity,
} from './factories';
import {
  normalizeVariable,
} from './normalize';
import {
  applySceneTemplateToSlide,
  SCENE_TEMPLATE_BUTTON_INTRO_ID,
  SCENE_TEMPLATE_LAUNCH_PAGE_ID,
  SCENE_TEMPLATE_VERSION,
  DEFAULT_ANSWER_LAYER_STYLE_PRESET_ID,
} from './sceneTemplates';
import {
  normalizeSlide,
  pickSlideState,
} from './slideNormalization';


// ─── Internal Helpers ────────────────────────────────────────────────────────

function isLegacyDefaultActivityScaffold(activity = {}) {
  const slides = Array.isArray(activity.slides) ? activity.slides : [];
  if (slides.length !== 1) return false;
  const slide = slides[0] || {};
  const name = String(slide.name || '').trim();
  if (name !== 'Slider 1' && name !== 'Slayt 1' && name !== 'Slayt') return false;
  const objects = Array.isArray(slide.objects) ? slide.objects : [];
  if (objects.length !== 2) return false;
  const hasVideo = objects.some((item) => item.type === 'video');
  const hasAudio = objects.some((item) => item.type === 'audio');
  return hasVideo && hasAudio;
}

function stripLegacyDefaultActivitySlide(slide = {}) {
  const objects = Array.isArray(slide.objects) ? slide.objects : [];
  return {
    ...slide,
    objects: objects.filter((item) => item.type !== 'video' && item.type !== 'audio'),
  };
}

function isBlankLegacySingleSlideActivity(activity = {}) {
  const slides = Array.isArray(activity.slides) ? activity.slides : [];
  if (slides.length !== 1) return false;
  const slide = slides[0] || {};
  const name = String(slide.name || '').trim();
  if (name !== 'Slider 1' && name !== 'Slayt 1' && name !== 'Slayt') return false;
  const objects = Array.isArray(slide.objects) ? slide.objects : [];
  return objects.length === 0;
}

// ─── Exported Normalizer Functions ───────────────────────────────────────────

export function syncAnswerPlacementObjects(activity = {}) {
  const objects = Array.isArray(activity.objects) ? activity.objects : [];
  if (!objects.some((item) => item.generatedBy === 'answer-placement')) return activity;
  const frames = getAnswerPlacementFrames(activity);
  const frameEntries = Object.entries(frames);
  const usedFrameKeys = new Set();

  return {
    ...activity,
    objects: objects.map((item) => {
      if (item.generatedBy !== 'answer-placement') return item;
      const baseItem = {
        ...item,
        answerStatic: true,
        disableDrag: false,
        locked: false,
      };
      if (!frameEntries.length) return baseItem;
      let pairKey =
        item.answerPairKey ||
        getDragDropPairKey(
          item.sourceDragId || item.dragId || '',
          item.targetDropId || item.dropId || ''
        );
      let frame = frames[pairKey];
      if (!frame) {
        const legacyMatch = frameEntries.find(
          ([key, entry]) =>
            !usedFrameKeys.has(key) &&
            (entry.drag.id === item.sourceDragId ||
              (String(entry.drag.label || '').trim() &&
                String(entry.drag.label || '').trim() === String(item.label || '').trim()))
        );
        if (legacyMatch) {
          pairKey = legacyMatch[0];
          frame = legacyMatch[1];
        }
      }
      if (!frame) return baseItem;
      usedFrameKeys.add(pairKey);
      const manualPlacement = item.answerPlacementManual === true;
      return {
        ...baseItem,
        x: manualPlacement ? item.x : frame.x,
        y: manualPlacement ? item.y : frame.y,
        width: manualPlacement ? item.width : frame.width,
        height: manualPlacement ? item.height : frame.height,
        sourceDragId: item.sourceDragId || frame.drag.id,
        targetDropId: item.targetDropId || frame.drop.id,
        answerPairKey: pairKey,
      };
    }),
  };
}

export function resetNavigationForStartup(state = {}) {
  return {
    ...state,
    selPubId: null,
    selBookId: null,
    selActId: null,
  };
}

export function normalizeActivity(activity = {}) {
  if (isLegacyDefaultActivityScaffold(activity)) {
    return normalizeActivity(
      ensureStandardActivityScaffold({
        ...activity,
        slides: activity.slides.map(stripLegacyDefaultActivitySlide),
      })
    );
  }

  if (isBlankLegacySingleSlideActivity(activity)) {
    return normalizeActivity(ensureStandardActivityScaffold(activity));
  }

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
  const normalizedAnswerLayerStylePresetId = ANSWER_LAYER_STYLE_PRESETS.some(
    (item) => item.id === activity.answerLayerStylePresetId
  )
    ? activity.answerLayerStylePresetId
    : DEFAULT_ANSWER_LAYER_STYLE_PRESET_ID;
  const activeSceneTemplatePresetId = normalizedAnswerLayerStylePresetId;
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
    answerLayerStylePresetId: normalizedAnswerLayerStylePresetId,
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

export function normalizeBook(book = {}, index = 0) {
  const pkgId = BUTTON_PACKAGES.some((item) => item.id === book.buttonPackageId)
    ? book.buttonPackageId
    : BUTTON_PACKAGES[0].id;
  const defaultAnswerLayerStylePresetId = ANSWER_LAYER_STYLE_PRESETS.some(
    (item) => item.id === book.defaultAnswerLayerStylePresetId
  )
    ? book.defaultAnswerLayerStylePresetId
    : DEFAULT_ANSWER_LAYER_STYLE_PRESET_ID;
  const name = String(book.name || '').trim() || `Kitap ${index + 1}`;
  return {
    ...book,
    id: book.id || uid(),
    publisherId: book.publisherId || '',
    name,
    description: book.description || '',
    buttonPackageId: pkgId,
    defaultAnswerLayerStylePresetId,
    pdfImports: Array.isArray(book.pdfImports) ? book.pdfImports : [],
    layerPresets: Array.isArray(book.layerPresets)
      ? book.layerPresets.map(normalizeLayerPreset)
      : [],
  };
}

export function pickBookLayerPresetPayload(activity = {}) {
  const normalizedActivity = normalizeButtonPairLayoutForActivity(activity);
  return BOOK_LAYER_PRESET_KEYS.reduce((acc, key) => {
    acc[key] = safeClone(
      normalizedActivity?.[key],
      Array.isArray(normalizedActivity?.[key]) ? [] : ''
    );
    return acc;
  }, {});
}

export function normalizeLayerPreset(preset = {}, index = 0) {
  const name = String(preset.name || '').trim() || `Katman Seti ${index + 1}`;
  const payload = pickBookLayerPresetPayload(
    normalizeButtonPairLayoutForActivity(
      normalizeActivity({
        name,
        type: preset.type || 'selection',
        ...(safeClone(preset.payload, {}) || {}),
      })
    )
  );
  return {
    id: preset.id || uid(),
    name,
    createdAt: preset.createdAt || new Date().toISOString(),
    updatedAt: preset.updatedAt || preset.createdAt || new Date().toISOString(),
    payload,
  };
}

export function applyBookLayerPresetToActivity(activity = {}, preset = null) {
  if (!preset?.payload) return activity;
  const payload = safeClone(preset.payload, {});
  return normalizeButtonPairLayoutForActivity(
    normalizeActivity({
      ...activity,
      ...payload,
      id: activity.id,
      name: activity.name,
      type: activity.type,
      bookId: activity.bookId,
      notes: activity.notes,
    })
  );
}

export function pickTextStudioDesign(activity = {}) {
  const settings = { ...DEFAULT_ACTIVITY_SETTINGS, ...(activity.settings || {}) };
  return {
    buttonPackageId: activity.buttonPackageId || BUTTON_PACKAGES[0]?.id || 'classic',
    introScreen: safeClone(activity.introScreen || {}),
    buttonPackageScreen: safeClone(activity.buttonPackageScreen || {}),
    menuScreen: safeClone(activity.menuScreen || {}),
    playScreen: safeClone(activity.playScreen || {}),
    resultScreens: safeClone(activity.resultScreens || {}),
    answerScreen: safeClone(activity.answerScreen || {}),
    settings: TEXT_STUDIO_SETTING_KEYS.reduce((acc, key) => {
      acc[key] = settings[key];
      return acc;
    }, {}),
  };
}

export function normalizeTextStudioPreset(preset = {}, index = 0) {
  const name = String(preset.name || '').trim() || `Tasarım ${index + 1}`;
  return {
    id: preset.id || uid(),
    name,
    createdAt: preset.createdAt || new Date().toISOString(),
    updatedAt: preset.updatedAt || preset.createdAt || new Date().toISOString(),
    payload: pickTextStudioDesign(preset.payload || preset.design || preset),
  };
}

export function applyTextStudioPreset(activity = {}, preset = {}) {
  const payload = preset?.payload || preset || {};
  const nextPackageId = payload.buttonPackageId || activity.buttonPackageId;
  const nextActivity = normalizeActivity({
    ...activity,
    buttonPackageId: nextPackageId,
    introScreen: safeClone(payload.introScreen, activity.introScreen || {}),
    buttonPackageScreen: safeClone(payload.buttonPackageScreen, activity.buttonPackageScreen || {}),
    menuScreen: safeClone(payload.menuScreen, activity.menuScreen || {}),
    playScreen: safeClone(payload.playScreen, activity.playScreen || {}),
    resultScreens: safeClone(payload.resultScreens, activity.resultScreens || {}),
    answerScreen: safeClone(payload.answerScreen, activity.answerScreen || {}),
    settings: {
      ...DEFAULT_ACTIVITY_SETTINGS,
      ...(activity.settings || {}),
      ...(payload.settings || {}),
    },
  });
  return nextPackageId
    ? restyleActivityButtonsForPackage(nextActivity, nextPackageId)
    : nextActivity;
}

export function normalizeState(state = {}) {
  const normalizedLmsConfig = normalizeScorm12LmsConfig(state.lmsConfig || {});
  return enforceTtkbEditorState({
    ...INITIAL_STATE,
    ...state,
    publishers: Array.isArray(state.publishers) ? state.publishers : [],
    books: Array.isArray(state.books) ? state.books.map(normalizeBook) : [],
    variables: Array.isArray(state.variables) ? state.variables.map(normalizeVariable) : [],
    activities: Array.isArray(state.activities) ? state.activities.map(normalizeActivity) : [],
    lmsConfig: normalizedLmsConfig,
  });
}

export function normalizeActivityForRuntimeSnapshot(activity = {}) {
  return enforceTtkbActivityCompliance(
    syncAnswerPlacementObjects(normalizeActivity(commitMaterializedActivity(activity)))
  );
}

export function createRuntimeStateSnapshot(state = {}, currentActivitySnapshot = null) {
  const normalized = normalizeState(state);
  const overrideActivity = currentActivitySnapshot?.id
    ? normalizeActivityForRuntimeSnapshot(currentActivitySnapshot)
    : null;
  const activities = (normalized.activities || []).map((activity) =>
    overrideActivity && activity.id === overrideActivity.id
      ? overrideActivity
      : normalizeActivityForRuntimeSnapshot(activity)
  );
  const hasOverride = !!(
    overrideActivity && activities.some((activity) => activity.id === overrideActivity.id)
  );
  return {
    ...normalized,
    activities: hasOverride
      ? activities
      : overrideActivity
        ? [...activities, overrideActivity]
        : activities,
    selActId: overrideActivity?.id || normalized.selActId || activities[0]?.id || '',
  };
}

export function createSafeStateForStorage(state = {}) {
  const normalized = resetNavigationForStartup(normalizeState(state));
  return {
    ...normalized,
    lmsConfig: maskLmsSecrets(normalized.lmsConfig, ''),
    activities: normalized.activities.map((activity) =>
      activity?.lmsConfig
        ? {
            ...activity,
            lmsConfig: normalizeScorm12LmsConfig(maskLmsSecrets(activity.lmsConfig, '')),
          }
        : activity
    ),
  };
}

export function createSafeStateForExport(state = {}) {
  const normalized = normalizeState(state);
  return {
    ...normalized,
    lmsConfig: maskLmsSecrets(normalized.lmsConfig, REDACTED_SECRET_VALUE),
    activities: normalized.activities.map((activity) =>
      activity?.lmsConfig
        ? {
            ...activity,
            lmsConfig: normalizeScorm12LmsConfig(
              maskLmsSecrets(activity.lmsConfig, REDACTED_SECRET_VALUE)
            ),
          }
        : activity
    ),
  };
}

export function stateHasLmsSecrets(state = {}) {
  return (
    hasLmsSecrets(state.lmsConfig) ||
    (Array.isArray(state.activities) &&
      state.activities.some((activity) => hasLmsSecrets(activity?.lmsConfig)))
  );
}

