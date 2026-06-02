import { getActivitySlides } from '../logic/activityHelpers';
import {
  ensureSceneTemplateSlide,
  ensureStandardActivityScaffold,
  SCENE_TEMPLATE_BUTTON_INTRO_ID,
  SCENE_TEMPLATE_LAUNCH_PAGE_ID,
} from '../logic/activityTemplateGenerators';
import { createActivity, createSlide } from '../logic/factories';
import { SCENE_TEMPLATE_VERSION } from '../logic/sceneTemplates';

function generatedButton(slotId, templateId) {
  return {
    id: `${slotId}:old`,
    type: 'button',
    label: 'ETKİNLİĞİ BAŞLAT',
    layerId: 'base',
    x: 100,
    y: 100,
    width: 240,
    height: 56,
    generatedBy: 'scene-template',
    sceneTemplateId: templateId,
    sceneTemplateSlotId: slotId,
    sceneTemplateVersion: SCENE_TEMPLATE_VERSION,
    style: {},
  };
}

function manualNote(id = 'manual-note') {
  return {
    id,
    type: 'text',
    label: 'Manuel not',
    layerId: 'base',
    x: 20,
    y: 20,
    width: 180,
    height: 44,
    style: {},
  };
}

function generatedAnswerTemplateObject(id = 'answer-template-dim') {
  return {
    id,
    type: 'shape',
    label: '',
    layerId: 'normal-layer',
    x: 0,
    y: 0,
    width: 1920,
    height: 1080,
    generatedBy: 'answer-template',
    style: {
      background: 'rgba(15,23,42,.92)',
    },
  };
}

function templateSlide(name, templateId, objects = []) {
  return {
    ...createSlide(name, 0),
    id: `${templateId}-slide`,
    name,
    sceneName: name,
    sceneTemplateId: templateId,
    sceneTemplatePresetId: 'aurora-glass',
    answerLayerStylePresetId: 'aurora-glass',
    sceneTemplateVersion: SCENE_TEMPLATE_VERSION,
    objects,
  };
}

function activityWithTemplates(overrides = {}) {
  const launch = templateSlide('Etkinlik Girişi', SCENE_TEMPLATE_LAUNCH_PAGE_ID, [
    generatedButton(`${SCENE_TEMPLATE_LAUNCH_PAGE_ID}:start-button`, SCENE_TEMPLATE_LAUNCH_PAGE_ID),
    manualNote('manual-launch'),
  ]);
  const intro = templateSlide('Etkinlik Tanıtımı', SCENE_TEMPLATE_BUTTON_INTRO_ID, [
    generatedButton(`${SCENE_TEMPLATE_BUTTON_INTRO_ID}:start-button`, SCENE_TEMPLATE_BUTTON_INTRO_ID),
    manualNote('manual-intro'),
  ]);
  const practice = {
    ...createSlide('Uygulama', 2),
    id: 'practice-slide',
    name: 'Uygulama',
    sceneName: 'Uygulama',
    dragDropSettings: { dragAnimationPreset: 'soft' },
  };
  return {
    id: 'activity-1',
    type: 'drag-drop',
    currentSlideId: practice.id,
    answerLayerStylePresetId: 'aurora-glass',
    stageWidth: 1920,
    stageHeight: 1080,
    slides: [launch, intro, practice],
    ...overrides,
  };
}

function slotIds(slide) {
  return new Set((slide.objects || []).map((item) => item.sceneTemplateSlotId).filter(Boolean));
}

describe('scene template generation', () => {
  test('fresh activity scaffold keeps only fixed practice controls on the base and fills answer layers', () => {
    const result = ensureStandardActivityScaffold(createActivity('Yeni Etkinlik', 'selection'), {
      select: 'practice',
    });
    const slides = getActivitySlides(result);
    const launch = slides.find((slide) => slide.sceneTemplateId === SCENE_TEMPLATE_LAUNCH_PAGE_ID);
    const intro = slides.find(
      (slide) => slide.sceneTemplateId === SCENE_TEMPLATE_BUTTON_INTRO_ID
    );
    const practice = slides.find((slide) => slide.name === 'Etkinlik 1');
    const baseObjects = (practice?.objects || []).filter(
      (item) => (item.layerId || 'base') === 'base'
    );
    const baseControlLabels = baseObjects.map((item) => item.label);
    const nonControlBaseObjects = baseObjects.filter(
      (item) => item.answerTemplateRole !== 'practice-control'
    );
    const layerNames = (practice?.layers || []).map((layer) => String(layer.name || ''));

    expect(launch.objects.every((item) => item.generatedBy === 'scene-template')).toBe(true);
    expect(intro.objects.every((item) => item.generatedBy === 'scene-template')).toBe(true);
    expect(practice).toBeTruthy();
    expect(practice.name).toBe('Etkinlik 1');
    expect(practice.sceneName).toBe('Etkinlik 1');
    expect(nonControlBaseObjects).toHaveLength(0);
    expect(baseControlLabels).toEqual(expect.arrayContaining(['☰', 'MENÜ', '✓', 'KONTROL ET']));
    expect((practice.objects || []).every((item) => item.generatedBy === 'answer-template')).toBe(
      true
    );
    expect((practice.objects || []).some((item) => item.generatedBy === 'answer-template')).toBe(
      true
    );
    expect(layerNames).toEqual(
      expect.arrayContaining(['menu', 'explanation', 'normal', 'Correct', 'Incorrect', 'cevap'])
    );
  });

  test('fresh activity scaffold does not duplicate fixed practice controls when regenerated', () => {
    const first = ensureStandardActivityScaffold(createActivity('Yeni Etkinlik', 'selection'), {
      select: 'practice',
    });
    const second = ensureStandardActivityScaffold(first, { select: 'practice' });
    const practice = getActivitySlides(second).find((slide) => slide.name === 'Etkinlik 1');
    const controlObjects = (practice?.objects || []).filter(
      (item) =>
        (item.layerId || 'base') === 'base' && item.answerTemplateRole === 'practice-control'
    );

    expect(controlObjects).toHaveLength(4);
    expect(controlObjects.filter((item) => item.readyButtonPresetId === 'menu')).toHaveLength(2);
    expect(controlObjects.filter((item) => item.readyButtonPresetId === 'check')).toHaveLength(2);
  });

  test('template creation keeps the original practice slide instead of converting it to launch', () => {
    const practiceObject = manualNote('question-object');
    const practiceSlide = {
      ...createSlide('Soru 1', 0),
      id: 'practice-source',
      name: 'Soru 1',
      sceneName: 'Soru 1',
      objects: [practiceObject],
    };
    const result = ensureSceneTemplateSlide(
      {
        id: 'activity-fresh',
        type: 'selection',
        currentSlideId: practiceSlide.id,
        answerLayerStylePresetId: 'aurora-glass',
        slides: [practiceSlide],
      },
      SCENE_TEMPLATE_BUTTON_INTRO_ID,
      { forceRebuildGenerated: true }
    );
    const slides = getActivitySlides(result);
    const launch = slides.find((slide) => slide.sceneTemplateId === SCENE_TEMPLATE_LAUNCH_PAGE_ID);
    const intro = slides.find((slide) => slide.sceneTemplateId === SCENE_TEMPLATE_BUTTON_INTRO_ID);
    const practice = slides.find((slide) => slide.id === 'practice-source');

    expect(launch).toBeTruthy();
    expect(intro).toBeTruthy();
    expect(practice).toBeTruthy();
    expect(practice.objects.some((item) => item.id === 'question-object')).toBe(true);
    expect(launch.objects.some((item) => item.id === 'question-object')).toBe(false);
    expect(intro.objects.some((item) => item.id === 'question-object')).toBe(false);
  });

  test('force rebuild removes generated answer layer leftovers from template slides', () => {
    const contaminatedIntro = templateSlide('Etkinlik Tanıtımı', SCENE_TEMPLATE_BUTTON_INTRO_ID, [
      generatedButton(`${SCENE_TEMPLATE_BUTTON_INTRO_ID}:start-button`, SCENE_TEMPLATE_BUTTON_INTRO_ID),
      generatedAnswerTemplateObject(),
      manualNote('manual-intro'),
    ]);
    contaminatedIntro.layers = [
      { id: 'base', name: '', kind: 'base', visible: true },
      { id: 'normal-layer', name: 'Normal', kind: 'overlay', visible: true },
    ];
    contaminatedIntro.activeLayerId = 'normal-layer';
    contaminatedIntro.triggers = [
      {
        id: 'answer-trigger',
        when: 'onClick',
        target: 'answer-template-dim',
        action: 'KatmanaGec',
        value: 'base',
        generatedBy: 'answer-template',
      },
    ];

    const result = ensureSceneTemplateSlide(
      activityWithTemplates({
        currentSlideId: contaminatedIntro.id,
        slides: [
          templateSlide('Etkinlik Girişi', SCENE_TEMPLATE_LAUNCH_PAGE_ID),
          contaminatedIntro,
          createSlide('Uygulama', 2),
        ],
      }),
      SCENE_TEMPLATE_BUTTON_INTRO_ID,
      { forceRebuildGenerated: true }
    );
    const intro = getActivitySlides(result).find(
      (slide) => slide.sceneTemplateId === SCENE_TEMPLATE_BUTTON_INTRO_ID
    );

    expect(intro.activeLayerId).toBe('base');
    expect(intro.layers).toHaveLength(1);
    expect(intro.objects.some((item) => item.generatedBy === 'answer-template')).toBe(false);
    expect(intro.triggers.some((item) => item.generatedBy === 'answer-template')).toBe(false);
    expect(intro.objects.some((item) => item.id === 'manual-intro')).toBe(true);
  });

  test('force rebuild completes a partial button intro template and keeps manual objects', () => {
    const result = ensureSceneTemplateSlide(
      activityWithTemplates(),
      SCENE_TEMPLATE_BUTTON_INTRO_ID,
      { forceRebuildGenerated: true }
    );
    const intro = getActivitySlides(result).find(
      (slide) => slide.sceneTemplateId === SCENE_TEMPLATE_BUTTON_INTRO_ID
    );
    const slots = slotIds(intro);

    expect(slots.has(`${SCENE_TEMPLATE_BUTTON_INTRO_ID}:start-button`)).toBe(true);
    expect(slots.has(`${SCENE_TEMPLATE_BUTTON_INTRO_ID}:start-icon`)).toBe(true);
    expect(slots.has(`${SCENE_TEMPLATE_BUTTON_INTRO_ID}:close-button`)).toBe(true);
    expect(slots.has(`${SCENE_TEMPLATE_BUTTON_INTRO_ID}:check-demo-label`)).toBe(true);
    expect(intro.objects.some((item) => item.id === 'manual-intro')).toBe(true);
  });

  test('force rebuild completes a partial launch template and keeps manual objects', () => {
    const result = ensureSceneTemplateSlide(
      activityWithTemplates(),
      SCENE_TEMPLATE_LAUNCH_PAGE_ID,
      { forceRebuildGenerated: true }
    );
    const launch = getActivitySlides(result).find(
      (slide) => slide.sceneTemplateId === SCENE_TEMPLATE_LAUNCH_PAGE_ID
    );
    const slots = slotIds(launch);

    expect(slots.has(`${SCENE_TEMPLATE_LAUNCH_PAGE_ID}:start-button`)).toBe(true);
    expect(slots.has(`${SCENE_TEMPLATE_LAUNCH_PAGE_ID}:start-icon`)).toBe(true);
    expect(slots.has(`${SCENE_TEMPLATE_LAUNCH_PAGE_ID}:intro-button`)).toBe(true);
    expect(slots.has(`${SCENE_TEMPLATE_LAUNCH_PAGE_ID}:intro-icon`)).toBe(true);
    expect(launch.objects.some((item) => item.id === 'manual-launch')).toBe(true);
  });

});
