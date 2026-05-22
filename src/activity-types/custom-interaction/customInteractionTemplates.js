import { uid } from '../../utils/editorHelpers';

export function generateDiceBirdDemoTemplate(activity = {}) {
  const diceId = `obj_widget_dice_${uid().slice(0, 6)}`;
  const birdId = `obj_widget_bird_${uid().slice(0, 6)}`;
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
    style: {
      fontSize: 24,
      fontWeight: 700,
      color: '#0c4a6e',
      textAlign: 'center',
      background: 'transparent',
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
      value: 'layer_question',
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
    ...(activity.objects || []).filter((o) => !o.generatedBy && o.type !== 'custom-widget'),
  ];

  return {
    ...activity,
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
    objects,
  };
}
