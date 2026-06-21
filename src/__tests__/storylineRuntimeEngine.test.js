import { getRuntimeButtonAction } from '../utils/storylineRuntime';
import {
  evaluateStorylineRuntimeDragDrop,
  evaluateStorylineRuntimeSlider,
  evaluateStorylineRuntimeShortcut,
  evaluateStorylineRuntimeTextEntry,
  normalizeShortcutCombo,
  shortcutComboFromEvent,
  findStorylineRuntimeDropTarget,
  getStorylineRuntimeCommandsForObject,
  getStorylineRuntimeCommandsForDrop,
  getStorylineRuntimeCorrectDragMatches,
  getStorylineRuntimeSnapPosition,
} from '../utils/storylineRuntimeEngine';

describe('storyline runtime engine', () => {
  const slide = {
    layers: [
      { id: 'base', name: 'Base Layer', kind: 'base' },
      { id: 'answer-layer', name: 'cevap', kind: 'overlay' },
      { id: 'help-layer', name: 'help', kind: 'overlay' },
    ],
    triggers: [
      { when: 'onClick', target: 'nextBtn', action: 'SliderGec', value: '__next__' },
      { when: 'onClick', target: 'hideMe', action: 'Gizle', value: 'targetObj' },
      { when: 'onClick', target: 'score', action: 'DegiskenArttir', value: 'points', extra: 2 },
    ],
  };

  test('maps runtime action buttons to shared commands', () => {
    expect(
      getStorylineRuntimeCommandsForObject({
        slide,
        sourceId: 'answerBtn',
        sourceObject: { id: 'answerBtn', type: 'button', runtimeAction: 'answer' },
        state: {},
      })
    ).toEqual([
      { type: 'resetAttempt', reason: 'runtime-answer-button' },
      { type: 'setLayer', layerId: 'answer-layer' },
    ]);

    expect(
      getStorylineRuntimeCommandsForObject({
        slide,
        sourceId: 'homeBtn',
        sourceObject: { id: 'homeBtn', type: 'button', runtimeAction: 'home' },
        state: {},
      })
    ).toEqual([{ type: 'goHome', reason: 'runtime-home-button' }]);
  });

  test('maps trigger actions to shared commands', () => {
    expect(
      getStorylineRuntimeCommandsForObject({
        slide,
        sourceId: 'nextBtn',
        sourceObject: { id: 'nextBtn', type: 'button' },
        state: {},
      })
    ).toEqual([{ type: 'goRelative', direction: 1 }]);

    expect(
      getStorylineRuntimeCommandsForObject({
        slide,
        sourceId: 'score',
        sourceObject: { id: 'score', type: 'button' },
        state: { variables: { points: 1 } },
      })
    ).toEqual([{ type: 'addVariable', variableId: 'points', delta: 2 }]);
  });

  test('widget event triggers can send commands with resolved payload variables', () => {
    const widgetSlide = {
      objects: [
        { id: 'obj_widget_dice_1', type: 'custom-widget' },
        { id: 'obj_widget_bird_1', type: 'custom-widget' },
      ],
      triggers: [
        {
          when: 'onWidgetEvent',
          target: 'obj_widget_dice_1',
          eventName: 'diceRolled',
          action: 'sendWidgetCommand',
          value: 'obj_widget_bird_1',
          extra: 'flyWithFlaps',
          payload: { flapCount: '{{diceValue}}' },
        },
      ],
    };

    expect(
      getStorylineRuntimeCommandsForObject({
        slide: widgetSlide,
        sourceId: 'obj_widget_dice_1',
        sourceObject: widgetSlide.objects[0],
        when: 'onWidgetEvent',
        eventName: 'diceRolled',
        state: { variables: { diceValue: 6 } },
      })
    ).toEqual([
      {
        type: 'sendWidgetCommand',
        widgetId: 'obj_widget_bird_1',
        command: 'flyWithFlaps',
        payload: { flapCount: 6 },
      },
    ]);
  });

  test('manual click triggers override inferred button label actions', () => {
    const menuSlide = {
      layers: [
        { id: 'base', name: 'Base Layer', kind: 'base' },
        { id: 'guide-layer', name: 'yardim', kind: 'overlay' },
        { id: 'menu-layer', name: 'menu', kind: 'overlay' },
      ],
      triggers: [{ when: 'onClick', target: 'menuBtn', action: 'KatmanaGec', value: 'menu-layer' }],
    };

    expect(
      getStorylineRuntimeCommandsForObject({
        slide: menuSlide,
        sourceId: 'menuBtn',
        sourceObject: { id: 'menuBtn', type: 'button', label: 'KULLANIM KILAVUZU' },
        state: {},
      })
    ).toEqual([{ type: 'setLayer', layerId: 'menu-layer' }]);
  });

  test('manual linked button trigger overrides icon runtimeAction', () => {
    const linkedSlide = {
      layers: [
        { id: 'base', name: 'Base Layer', kind: 'base' },
        { id: 'answer-layer', name: 'cevap', kind: 'overlay' },
      ],
      objects: [
        {
          id: 'answerIcon',
          type: 'button',
          label: '⌂',
          runtimeAction: 'home',
          linkedActionTargetId: 'answerLabel',
          linkedHoverGroup: 'row-1',
        },
        {
          id: 'answerLabel',
          type: 'button',
          label: 'Çözümü Göster',
          linkedActionTargetId: 'answerLabel',
          linkedHoverGroup: 'row-1',
        },
      ],
      triggers: [
        { when: 'onClick', target: 'answerLabel', action: 'KatmanaGec', value: 'answer-layer' },
      ],
    };

    expect(
      getStorylineRuntimeCommandsForObject({
        slide: linkedSlide,
        sourceId: 'answerIcon',
        sourceObject: linkedSlide.objects[0],
        state: {},
      })
    ).toEqual([
      { type: 'resetAttempt', reason: 'trigger-answer-layer' },
      { type: 'setLayer', layerId: 'answer-layer' },
    ]);
  });

  test('generated linked button triggers run before automatic runtimeAction fallback', () => {
    const linkedSlide = {
      layers: [
        { id: 'base', name: 'Base Layer', kind: 'base' },
        { id: 'answer-layer', name: 'cevap', kind: 'overlay' },
      ],
      objects: [
        {
          id: 'generatedIcon',
          type: 'button',
          label: '⌂',
          runtimeAction: 'home',
          linkedActionTargetId: 'generatedLabel',
          linkedHoverGroup: 'generated-row',
        },
        {
          id: 'generatedLabel',
          type: 'button',
          label: 'Çözümü Göster',
          linkedActionTargetId: 'generatedLabel',
          linkedHoverGroup: 'generated-row',
        },
      ],
      triggers: [
        {
          when: 'onClick',
          target: 'generatedLabel',
          action: 'KatmanaGec',
          value: 'answer-layer',
          generatedBy: 'answer-template',
        },
      ],
    };

    expect(
      getStorylineRuntimeCommandsForObject({
        slide: linkedSlide,
        sourceId: 'generatedIcon',
        sourceObject: linkedSlide.objects[0],
        state: {},
      })
    ).toEqual([
      { type: 'resetAttempt', reason: 'trigger-answer-layer' },
      { type: 'setLayer', layerId: 'answer-layer' },
    ]);
  });

  test('manual trigger with unsupported action blocks automatic fallback', () => {
    const manualSlide = {
      layers: [{ id: 'base', name: 'Base Layer', kind: 'base' }],
      objects: [{ id: 'menuBtn', type: 'button', label: 'Menü', runtimeAction: 'home' }],
      triggers: [{ when: 'onClick', target: 'menuBtn', action: 'LightboxAc', value: '' }],
    };

    expect(
      getStorylineRuntimeCommandsForObject({
        slide: manualSlide,
        sourceId: 'menuBtn',
        sourceObject: manualSlide.objects[0],
        state: {},
      })
    ).toEqual([]);
  });

  test('runtimeAction none disables inferred demo button actions', () => {
    expect(
      getRuntimeButtonAction({
        id: 'guideDemo',
        type: 'button',
        label: 'KULLANIM KILAVUZU',
        runtimeAction: 'none',
      })
    ).toBe('');

    expect(
      getStorylineRuntimeCommandsForObject({
        slide,
        sourceId: 'guideDemo',
        sourceObject: {
          id: 'guideDemo',
          type: 'button',
          label: 'KULLANIM KILAVUZU',
          runtimeAction: 'none',
        },
        state: {},
      })
    ).toEqual([]);
  });

  test('explicit runtime actions work on launch template objects', () => {
    expect(
      getRuntimeButtonAction({
        id: 'customLaunchButton',
        type: 'button',
        label: 'Ozel Buton',
        generatedBy: 'scene-template',
        sceneTemplateId: 'launch-page',
        sceneTemplateSlotId: 'launch-page:custom-button',
        runtimeAction: 'restart',
      })
    ).toBe('restart');
  });

  test('button intro template demo buttons stay decorative for existing pages', () => {
    expect(
      getRuntimeButtonAction({
        id: 'oldGuideDemo',
        type: 'button',
        label: 'KULLANIM KILAVUZU',
        generatedBy: 'scene-template',
        sceneTemplateId: 'button-intro',
        sceneTemplateSlotId: 'button-intro:slot-8',
      })
    ).toBe('');
  });

  test('button intro check demo button does not run answer checking', () => {
    expect(
      getStorylineRuntimeCommandsForObject({
        slide,
        sourceId: 'checkDemo',
        sourceObject: {
          id: 'checkDemo',
          type: 'button',
          label: 'Kontrol Et',
          generatedBy: 'scene-template',
          sceneTemplateId: 'button-intro',
          sceneTemplateSlotId: 'button-intro:slot-1',
        },
        state: {},
      })
    ).toEqual([]);
  });

  test('button intro media demo buttons only toggle their visual state', () => {
    expect(
      getStorylineRuntimeCommandsForObject({
        slide,
        sourceId: 'muteDemo',
        sourceObject: {
          id: 'muteDemo',
          type: 'button',
          label: 'Sesi Kapat',
          generatedBy: 'scene-template',
          sceneTemplateId: 'button-intro',
          sceneTemplateSlotId: 'button-intro:slot-12',
          sceneTemplateDemoAction: 'toggle-mute',
        },
        state: {},
      })
    ).toEqual([{ type: 'toggleDemoButtonState', objectId: 'muteDemo' }]);
  });

  test('button intro grouped demo icon toggles the shared label state', () => {
    expect(
      getStorylineRuntimeCommandsForObject({
        slide,
        sourceId: 'muteIcon',
        sourceObject: {
          id: 'muteIcon',
          type: 'button',
          label: '🔊',
          generatedBy: 'scene-template',
          sceneTemplateId: 'button-intro',
          sceneTemplateSlotId: 'button-intro:menu-demo-2-icon',
          sceneTemplateDemoAction: 'toggle-mute',
          linkedActionTargetId: 'muteLabel',
        },
        state: {},
      })
    ).toEqual([{ type: 'toggleDemoButtonState', objectId: 'muteLabel' }]);
  });

  test('button intro demo buttons stay passive unless a manual click trigger is assigned', () => {
    const introSlide = {
      ...slide,
      triggers: [
        { when: 'onClick', target: 'guideDemo', action: 'SliderGec', value: '__next__' },
        { when: 'onClick', target: 'muteDemo', action: 'SliderGec', value: '__next__' },
      ],
    };

    expect(
      getStorylineRuntimeCommandsForObject({
        slide: introSlide,
        sourceId: 'guideDemo',
        sourceObject: {
          id: 'guideDemo',
          type: 'button',
          label: 'KULLANIM KILAVUZU',
          runtimeAction: 'restart',
          generatedBy: 'scene-template',
          sceneTemplateId: 'button-intro',
          sceneTemplateSlotId: 'button-intro:menu-demo-0-label',
        },
        state: {},
      })
    ).toEqual([{ type: 'goRelative', direction: 1 }]);

    expect(
      getStorylineRuntimeCommandsForObject({
        slide: introSlide,
        sourceId: 'muteDemo',
        sourceObject: {
          id: 'muteDemo',
          type: 'button',
          label: 'Sesi Kapat',
          runtimeAction: 'restart',
          generatedBy: 'scene-template',
          sceneTemplateId: 'button-intro',
          sceneTemplateSlotId: 'button-intro:menu-demo-2-label',
          sceneTemplateDemoAction: 'toggle-mute',
        },
        state: {},
      })
    ).toEqual([{ type: 'goRelative', direction: 1 }]);
  });

  test('button intro start and close controls can still run navigation triggers', () => {
    const introSlide = {
      ...slide,
      triggers: [
        { when: 'onClick', target: 'startIcon', action: 'SliderGec', value: '__next__' },
        { when: 'onClick', target: 'closeButton', action: 'SliderGec', value: '__next__' },
      ],
    };

    expect(
      getStorylineRuntimeCommandsForObject({
        slide: introSlide,
        sourceId: 'startIcon',
        sourceObject: {
          id: 'startIcon',
          type: 'button',
          label: '▶',
          generatedBy: 'scene-template',
          sceneTemplateId: 'button-intro',
          sceneTemplateSlotId: 'button-intro:start-icon',
        },
        state: {},
      })
    ).toEqual([{ type: 'goRelative', direction: 1 }]);

    expect(
      getStorylineRuntimeCommandsForObject({
        slide: introSlide,
        sourceId: 'closeButton',
        sourceObject: {
          id: 'closeButton',
          type: 'button',
          label: '×',
          generatedBy: 'scene-template',
          sceneTemplateId: 'button-intro',
          sceneTemplateSlotId: 'button-intro:close-button',
        },
        state: {},
      })
    ).toEqual([{ type: 'goRelative', direction: 1 }]);
  });

  test('check buttons use the shared checkAnswer command', () => {
    expect(
      getStorylineRuntimeCommandsForObject({
        slide,
        sourceId: 'check',
        sourceObject: { id: 'check', type: 'button', label: 'Kontrol Et' },
        state: {},
      })
    ).toEqual([{ type: 'checkAnswer' }]);
  });

  test('selection overlays use the shared toggleSelection command', () => {
    expect(
      getStorylineRuntimeCommandsForObject({
        slide,
        sourceId: 'choice-1',
        sourceObject: { id: 'choice-1', type: 'shape', selectionQuestionId: 'soru-1' },
        state: {},
      })
    ).toEqual([{ type: 'toggleSelection', objectId: 'choice-1' }]);
  });

  test('evaluates drag-drop answers in the shared engine', () => {
    const dragDropSlide = {
      stageWidth: 800,
      stageHeight: 450,
      dragDropMatches: { drag1: 'drop1' },
      objects: [
        { id: 'drag1', type: 'draggable', label: 'A', x: 20, y: 20, width: 90, height: 40 },
        { id: 'drop1', type: 'dropzone', label: 'A', x: 300, y: 80, width: 120, height: 52 },
        { id: 'drop2', type: 'dropzone', label: 'B', x: 300, y: 160, width: 120, height: 52 },
      ],
    };

    expect(
      evaluateStorylineRuntimeDragDrop({
        slide: dragDropSlide,
        state: { dropAssignments: { drag1: 'drop1' } },
      })
    ).toMatchObject({
      success: true,
      expectedCount: 1,
      placementResult: { drag1__drop1: true },
    });

    expect(
      evaluateStorylineRuntimeDragDrop({
        slide: dragDropSlide,
        state: { dropAssignments: { drag1: 'drop2' } },
      })
    ).toMatchObject({
      success: false,
      placementResult: { drag1__drop2: false },
    });
  });

  test('resolves clone keys for multi-target drags', () => {
    const slide = {
      stageWidth: 800,
      stageHeight: 450,
      dragDropMatches: { drag1: ['drop1', 'drop2'] },
      objects: [
        { id: 'drag1', type: 'draggable', label: 'A', x: 20, y: 20, width: 90, height: 40 },
        { id: 'drop1', type: 'dropzone', label: 'A', x: 300, y: 80, width: 120, height: 52 },
        { id: 'drop2', type: 'dropzone', label: 'B', x: 300, y: 160, width: 120, height: 52 },
      ],
    };
    const result = evaluateStorylineRuntimeDragDrop({
      slide,
      state: { dropAssignments: { 'drag1@@a': 'drop1', 'drag1@@b': 'drop2' } },
    });
    expect(result.success).toBe(true);
    expect(result.placements).toHaveLength(2);
    expect(Object.values(result.placementResult).every(Boolean)).toBe(true);
  });

  test('accepts equivalent duplicate drags in group mode', () => {
    const dragDropSlide = {
      stageWidth: 800,
      stageHeight: 450,
      dragDropMode: 'multi-group',
      dragDropMatches: { drag1: 'drop1', drag2: 'drop1' },
      objects: [
        {
          id: 'drag1',
          type: 'draggable',
          label: 'Kahramanların Yüceltilmesi',
          group: 'Kahramanların Yüceltilmesi',
          x: 20,
          y: 20,
          width: 90,
          height: 40,
        },
        {
          id: 'drag2',
          type: 'draggable',
          label: 'Kahramanların Yüceltilmesi',
          group: 'Kahramanların Yüceltilmesi',
          x: 20,
          y: 80,
          width: 90,
          height: 40,
        },
        {
          id: 'drop1',
          type: 'dropzone',
          label: 'Hedef 1',
          group: 'Kahramanların Yüceltilmesi',
          x: 300,
          y: 80,
          width: 120,
          height: 52,
        },
      ],
    };

    expect(
      evaluateStorylineRuntimeDragDrop({
        slide: dragDropSlide,
        state: { dropAssignments: { drag2: 'drop1' } },
      })
    ).toMatchObject({
      success: true,
      expectedCount: 1,
      placementResult: { drag2__drop1: true },
    });
  });

  test('accepts selected group answers even when imported group metadata is stale', () => {
    const dragDropSlide = {
      stageWidth: 800,
      stageHeight: 450,
      dragDropMode: 'multi-group',
      dragDropMatches: { drag1: 'drop1' },
      objects: [
        {
          id: 'drag1',
          type: 'draggable',
          label: 'Kahramanların Yüceltilmesi',
          group: 'eski-cevap',
          x: 20,
          y: 20,
          width: 90,
          height: 40,
        },
        {
          id: 'drag2',
          type: 'draggable',
          label: 'Kahramanların Yüceltilmesi',
          group: 'baska-eski-cevap',
          x: 20,
          y: 80,
          width: 90,
          height: 40,
        },
        {
          id: 'drop1',
          type: 'dropzone',
          label: 'Hedef 1',
          group: 'Kahramanların Yüceltilmesi',
          x: 300,
          y: 80,
          width: 120,
          height: 52,
        },
      ],
    };

    expect(
      evaluateStorylineRuntimeDragDrop({
        slide: dragDropSlide,
        state: { dropAssignments: { drag2: 'drop1' } },
      })
    ).toMatchObject({
      success: true,
      expectedCount: 1,
      placementResult: { drag2__drop1: true },
    });
  });

  test('shares drop target inference and snap math', () => {
    const drag = { id: 'drag1', type: 'draggable', x: 10, y: 10, width: 80, height: 32 };
    const inferredDrop = {
      id: 'blank1',
      type: 'shape',
      label: '',
      x: 240,
      y: 90,
      width: 160,
      height: 42,
      style: { background: '#ea5b0c' },
    };
    const slide = { objects: [drag, inferredDrop] };

    expect(getStorylineRuntimeCorrectDragMatches({ slide })).toEqual({ drag1: 'blank1' });
    expect(
      findStorylineRuntimeDropTarget({
        drag,
        drops: [inferredDrop],
        x: 250,
        y: 94,
        pointerX: 280,
        pointerY: 108,
      })?.id
    ).toBe('blank1');
    expect(
      getStorylineRuntimeSnapPosition({
        drag,
        drop: inferredDrop,
        stageWidth: 800,
        stageHeight: 450,
      })
    ).toEqual({ x: 280, y: 95 });
  });

  test('maps onDrop correctness triggers without coercing them into click triggers', () => {
    const dragDropSlide = {
      stageWidth: 800,
      stageHeight: 450,
      layers: [
        { id: 'base', name: 'Base Layer', kind: 'base' },
        { id: 'correct-layer', name: 'Correct', kind: 'overlay' },
        { id: 'incorrect-layer', name: 'Incorrect', kind: 'overlay' },
      ],
      dragDropMatches: { drag1: 'drop1' },
      triggers: [
        { when: 'onClick', target: 'drag1', action: 'KatmanaGec', value: 'click-layer' },
        { when: 'onDropCorrect', target: 'drag1', action: 'KatmanaGec', value: 'correct-layer' },
        {
          when: 'onDropIncorrect',
          target: 'drag1',
          action: 'KatmanaGec',
          value: 'incorrect-layer',
        },
      ],
      objects: [
        { id: 'drag1', type: 'draggable', label: 'A', x: 20, y: 20, width: 90, height: 40 },
        { id: 'drop1', type: 'dropzone', label: 'A', x: 300, y: 80, width: 120, height: 52 },
        { id: 'drop2', type: 'dropzone', label: 'B', x: 300, y: 160, width: 120, height: 52 },
      ],
    };
    const [drag1, drop1, drop2] = dragDropSlide.objects;

    expect(
      getStorylineRuntimeCommandsForDrop({
        slide: dragDropSlide,
        dragObject: drag1,
        dropObject: drop1,
        state: { dropAssignments: { drag1: 'drop1' } },
      })
    ).toEqual([{ type: 'setLayer', layerId: 'correct-layer' }]);

    expect(
      getStorylineRuntimeCommandsForDrop({
        slide: dragDropSlide,
        dragObject: drag1,
        dropObject: drop2,
        state: { dropAssignments: { drag1: 'drop2' } },
      })
    ).toEqual([{ type: 'setLayer', layerId: 'incorrect-layer' }]);

    expect(
      getStorylineRuntimeCommandsForDrop({
        slide: dragDropSlide,
        dragObject: drag1,
        dropObject: null,
        state: { dropAssignments: {} },
      })
    ).toEqual([]);
  });

  test('does not fire generic selected-object drop triggers', () => {
    const dragDropSlide = {
      stageWidth: 800,
      stageHeight: 450,
      layers: [
        { id: 'base', name: 'Base Layer', kind: 'base' },
        { id: 'incorrect-layer', name: 'Incorrect', kind: 'overlay' },
      ],
      dragDropMatches: { drag1: 'drop1' },
      triggers: [
        {
          when: 'onDropIncorrect',
          target: 'Secili Nesne',
          action: 'KatmanaGec',
          value: 'incorrect-layer',
        },
      ],
      objects: [
        { id: 'drag1', type: 'draggable', label: 'A', x: 20, y: 20, width: 90, height: 40 },
        { id: 'drop2', type: 'dropzone', label: 'B', x: 300, y: 160, width: 120, height: 52 },
      ],
    };
    const [drag1, drop2] = dragDropSlide.objects;

    expect(
      getStorylineRuntimeCommandsForDrop({
        slide: dragDropSlide,
        dragObject: drag1,
        dropObject: drop2,
        state: { dropAssignments: { drag1: 'drop2' } },
      })
    ).toEqual([]);
  });
});

describe('storyline runtime kaydırıcı (slider) değerlendirmesi', () => {
  const slide = { type: 'slider', sliderMin: 0, sliderMax: 100, sliderCorrectValue: 50, sliderTolerance: 5 };

  test('tolerans dahilindeki değer doğru sayılır', () => {
    expect(evaluateStorylineRuntimeSlider({ slide, state: { sliderValue: 53 } }).success).toBe(true);
    expect(evaluateStorylineRuntimeSlider({ slide, state: { sliderValue: 45 } }).success).toBe(true);
  });

  test('tolerans dışındaki değer yanlış sayılır', () => {
    expect(evaluateStorylineRuntimeSlider({ slide, state: { sliderValue: 60 } }).success).toBe(false);
  });

  test('tolerans 0 ise tam değer gerekir', () => {
    const exact = { type: 'slider', sliderMin: 0, sliderMax: 10, sliderCorrectValue: 7, sliderTolerance: 0 };
    expect(evaluateStorylineRuntimeSlider({ slide: exact, state: { sliderValue: 7 } }).success).toBe(true);
    expect(evaluateStorylineRuntimeSlider({ slide: exact, state: { sliderValue: 6 } }).success).toBe(false);
  });

  test('boş/geçersiz değer başarısızdır', () => {
    expect(evaluateStorylineRuntimeSlider({ slide, state: {} }).success).toBe(false);
  });

  test('notlandırılmayan kaydırıcı her zaman başarılıdır', () => {
    const ungraded = { type: 'slider', sliderGraded: false, sliderMin: 0, sliderMax: 100 };
    expect(evaluateStorylineRuntimeSlider({ slide: ungraded, state: { sliderValue: 0 } }).success).toBe(true);
    expect(evaluateStorylineRuntimeSlider({ slide: ungraded, state: {} }).success).toBe(true);
  });
});

describe('storyline runtime kısayol tuşu değerlendirmesi', () => {
  test('combo değiştirici sırasından bağımsız kanonikleşir', () => {
    expect(normalizeShortcutCombo('Shift+Ctrl+S')).toBe('ctrl+shift+s');
    expect(normalizeShortcutCombo('CMD+Z')).toBe('meta+z');
    expect(normalizeShortcutCombo('Return')).toBe('enter');
    expect(normalizeShortcutCombo('Ctrl+Space')).toBe('ctrl+space');
  });

  test('event\'ten combo üretir, saf değiştirici basışını yok sayar', () => {
    expect(shortcutComboFromEvent({ ctrlKey: true, key: 's' })).toBe('ctrl+s');
    expect(shortcutComboFromEvent({ ctrlKey: true, key: 'Control' })).toBe('ctrl');
    expect(shortcutComboFromEvent({ ctrlKey: true, altKey: true, key: 'Delete' })).toBe('ctrl+alt+delete');
  });

  test('kabul edilen kombinasyonlardan biri eşleşince doğru sayılır', () => {
    const slide = { type: 'shortcut-key', shortcutAnswers: [{ combo: 'Ctrl+S' }, { combo: 'Cmd+S' }] };
    expect(evaluateStorylineRuntimeShortcut({ slide, state: { shortcutPressed: 'meta+s' } }).success).toBe(true);
    expect(evaluateStorylineRuntimeShortcut({ slide, state: { shortcutPressed: 'ctrl+s' } }).success).toBe(true);
    expect(evaluateStorylineRuntimeShortcut({ slide, state: { shortcutPressed: 'ctrl+x' } }).success).toBe(false);
  });

  test('boş basış başarısızdır', () => {
    const slide = { type: 'shortcut-key', shortcutAnswers: [{ combo: 'Ctrl+S' }] };
    expect(evaluateStorylineRuntimeShortcut({ slide, state: {} }).success).toBe(false);
  });
});

describe('storyline runtime kısa cevap eşleşme modu', () => {
  test('tam eşleşme modunda yalnız birebir kabul edilir', () => {
    const slide = { type: 'text-entry', textEntryAcceptedAnswers: ['başkent'] };
    expect(evaluateStorylineRuntimeTextEntry({ slide, state: { textEntryValue: 'başkent' } }).success).toBe(true);
    expect(evaluateStorylineRuntimeTextEntry({ slide, state: { textEntryValue: 'ülkenin başkenti' } }).success).toBe(false);
  });

  test('içerir modunda anahtar ifade metnin içinde geçiyorsa kabul edilir', () => {
    const slide = { type: 'text-entry', textEntryMatchMode: 'contains', textEntryAcceptedAnswers: ['başkent'] };
    expect(evaluateStorylineRuntimeTextEntry({ slide, state: { textEntryValue: 'ankara ülkenin başkentidir' } }).success).toBe(true);
    expect(evaluateStorylineRuntimeTextEntry({ slide, state: { textEntryValue: 'istanbul' } }).success).toBe(false);
  });
});
