import { getActivitySlides, selectActivitySlide } from '../../logic/activityHelpers';
import { normalizeSlide } from '../../logic/slideNormalization';
import { uid } from '../../utils/editorHelpers';

const DEMO_DICE_ID = 'obj_widget_dice_1';
const DEMO_BIRD_ID = 'obj_widget_bird_1';
const DEMO_LAYER_ID = 'layer_question';

function reserveDemoId(preferredId, objects = []) {
  const ids = new Set((objects || []).map((object) => object?.id).filter(Boolean));
  if (!ids.has(preferredId)) return preferredId;
  return `${preferredId}_${uid().slice(0, 6)}`;
}

function isPracticeSlide(slide = {}) {
  const name = String(slide.name || slide.sceneName || '').trim().toLocaleLowerCase('tr-TR');
  return !slide.sceneTemplateId && ['etkinlik 1', 'uygulama', 'practice'].includes(name);
}

function pickDemoSlide(slides = [], currentSlideId = '') {
  return (
    slides.find(isPracticeSlide) ||
    slides.find((slide) => !slide.sceneTemplateId) ||
    slides.find((slide) => slide.id === currentSlideId) ||
    slides[0]
  );
}

export function generateDiceBirdDemoTemplate(activity = {}) {
  const slides = getActivitySlides(activity);
  const targetSlide = pickDemoSlide(slides, activity.currentSlideId) || activity;
  const targetObjects = Array.isArray(targetSlide.objects) ? targetSlide.objects : [];
  const diceId = reserveDemoId(DEMO_DICE_ID, targetObjects);
  const birdId = reserveDemoId(DEMO_BIRD_ID, targetObjects);
  const stageW = Number(activity.stageWidth) || 1920;
  const stageH = Number(activity.stageHeight) || 1080;

  const diceObj = {
    id: diceId,
    type: 'custom-widget',
    name: 'Zar Atma',
    label: 'Zar Atma',
    x: Math.round(stageW * 0.15),
    y: Math.round(stageH * 0.25),
    width: 300,
    height: 260,
    zIndex: 10,
    visible: true,
    layerId: 'base',
    generatedBy: 'custom-widget-demo',
    widget: {
      widgetId: 'dice-v1',
      widgetName: 'Zar Atma',
      basePath: '/widgets/builtins/dice-v1',
      entry: 'index.html',
      props: { min: 1, max: 10, animated: true },
    },
    bindings: {
      'diceRolled.value': 'diceValue',
    },
  };

  const birdObj = {
    id: birdId,
    type: 'custom-widget',
    name: 'Kuş Uçuş Animasyonu',
    label: 'Kuş Uçuş Animasyonu',
    x: Math.round(stageW * 0.55),
    y: Math.round(stageH * 0.15),
    width: 500,
    height: 320,
    zIndex: 11,
    visible: true,
    layerId: 'base',
    generatedBy: 'custom-widget-demo',
    widget: {
      widgetId: 'bird-flight-v1',
      widgetName: 'Kuş Uçuş Animasyonu',
      basePath: '/widgets/builtins/bird-flight-v1',
      entry: 'index.html',
      props: { speed: 1 },
    },
    bindings: {},
  };

  const introTextObj = {
    id: `obj_text_intro_${uid().slice(0, 6)}`,
    type: 'text',
    name: 'Tanıtım Metni',
    label: 'Zarı at. Gelen sayı kadar kuş kanat çırparak uçacak. Uçuş tamamlandığında soruyu cevapla.',
    x: Math.round(stageW * 0.1),
    y: Math.round(stageH * 0.05),
    width: Math.round(stageW * 0.8),
    height: 80,
    zIndex: 5,
    visible: true,
    layerId: 'base',
    generatedBy: 'custom-widget-demo',
    style: {
      fontSize: 24,
      fontWeight: 700,
      color: '#0c4a6e',
      textAlign: 'center',
      background: 'transparent',
    },
  };

  const questionTextObj = {
    id: `obj_widget_question_${uid().slice(0, 6)}`,
    type: 'text',
    name: 'Widget Demo Sonuç Metni',
    label: 'Uçuş tamamlandı. Şimdi soruyu cevaplayabilirsin.',
    x: Math.round(stageW * 0.18),
    y: Math.round(stageH * 0.34),
    width: Math.round(stageW * 0.64),
    height: 90,
    zIndex: 20,
    visible: true,
    layerId: DEMO_LAYER_ID,
    generatedBy: 'custom-widget-demo',
    style: {
      fontSize: 30,
      fontWeight: 800,
      color: '#0f172a',
      textAlign: 'center',
      background: '#f8fafc',
      borderColor: '#38bdf8',
      borderRadius: 12,
    },
  };

  const triggers = [
    {
      id: `trg_dice_to_bird_${uid().slice(0, 6)}`,
      when: 'onWidgetEvent',
      target: diceId,
      eventName: 'diceRolled',
      action: 'sendWidgetCommand',
      value: birdId,
      extra: 'flyWithFlaps',
      payload: { flapCount: '{{diceValue}}' },
    },
    {
      id: `trg_bird_to_layer_${uid().slice(0, 6)}`,
      when: 'onWidgetEvent',
      target: birdId,
      eventName: 'flightComplete',
      action: 'KatmanaGec',
      value: DEMO_LAYER_ID,
    },
  ];

  const variables = [
    {
      id: 'diceValue',
      name: 'diceValue',
      label: 'Zar Değeri',
      type: 'number',
      value: 0,
      initialValue: 0,
    },
  ];

  const objects = [
    introTextObj,
    diceObj,
    birdObj,
    questionTextObj,
    ...targetObjects.filter(
      (object) => object?.generatedBy !== 'custom-widget-demo' && object?.type !== 'custom-widget'
    ),
  ];
  const layers = [
    ...(Array.isArray(targetSlide.layers) && targetSlide.layers.length
      ? targetSlide.layers
      : [{ id: 'base', name: '', kind: 'base', autoName: true, visible: true }]),
  ];
  if (!layers.some((layer) => layer.id === DEMO_LAYER_ID)) {
    layers.push({
      id: DEMO_LAYER_ID,
      name: 'Soru',
      kind: 'overlay',
      autoName: false,
      visible: true,
    });
  }

  const nextSlide = normalizeSlide(
    {
      ...targetSlide,
      type: 'custom-interaction',
      layers,
      activeLayerId: 'base',
      objects,
      variables,
      triggers,
    },
    Math.max(0, slides.findIndex((slide) => slide.id === targetSlide.id))
  );
  const nextSlides = slides.map((slide, index) =>
    slide.id === nextSlide.id ? nextSlide : normalizeSlide(slide, index)
  );
  const selectedActivity = selectActivitySlide(
    {
      ...activity,
      type: 'custom-interaction',
      slides: nextSlides,
      currentSlideId: nextSlide.id,
      startSlideId: nextSlides[0]?.id || activity.startSlideId || '',
    },
    nextSlide.id
  );

  return {
    ...selectedActivity,
    type: 'custom-interaction',
    customInteraction: {
      templateId: 'dice-animation',
      templateName: 'Zar ve Animasyon',
      widgets: [diceObj.widget, birdObj.widget],
      settings: { zipImportReady: false, runtimeReady: true },
      events: [
        { sourceId: diceId, eventName: 'diceRolled' },
        { sourceId: birdId, eventName: 'flapComplete' },
        { sourceId: birdId, eventName: 'flightComplete' },
      ],
      commands: [
        { targetId: birdId, command: 'flyWithFlaps' },
        { targetId: birdId, command: 'reset' },
      ],
      variables,
      triggers,
    },
    variables,
    triggers,
  };
}
