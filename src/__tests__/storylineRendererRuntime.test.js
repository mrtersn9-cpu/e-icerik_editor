import { STORYLINE_RENDERER_CORE_SCRIPT } from '../generated/storylineRendererCore.js';
import { STORYLINE_RUNTIME_CORE_SCRIPT } from '../generated/storylineRuntimeCore.js';
import { STORYLINE_RUNTIME_ENGINE_SCRIPT } from '../generated/storylineRuntimeEngine.js';
import { getSharedStorylineRendererRuntimeApi } from '../utils/storylineRenderer';

function loadRuntimeRenderer(i18n = null) {
  // Runtime bundles are generated as script strings; this test evaluates that generated runtime API.
  // eslint-disable-next-line no-new-func
  return new Function(`
    ${i18n ? `const PAYLOAD = ${JSON.stringify({ i18n })};` : ''}
    ${STORYLINE_RUNTIME_CORE_SCRIPT}
    ${STORYLINE_RUNTIME_ENGINE_SCRIPT}
    ${STORYLINE_RENDERER_CORE_SCRIPT}
    return {
      storylineRendererEvaluate,
      storylineRendererObjectHtml,
      storylineRendererObjectKey,
      storylineRendererVisibleObjects,
      storylineRuntimeCommandsForObject,
    };
  `)();
}

describe('SCORM storyline renderer runtime ids', () => {
  test('builds a shared renderer runtime api for preview and SCORM', () => {
    const runtimeApi = getSharedStorylineRendererRuntimeApi();
    const stage = document.createElement('div');
    const slide = {
      stageWidth: 800,
      stageHeight: 450,
      objects: [
        { id: 'drag-1', type: 'draggable', label: 'A', x: 20, y: 30, width: 100, height: 40 },
        { id: 'drop-1', type: 'dropzone', x: 260, y: 80, width: 120, height: 48 },
        {
          id: 'choice-1',
          type: 'shape',
          selectionQuestionId: 'soru-1',
          x: 460,
          y: 80,
          width: 48,
          height: 48,
        },
      ],
    };
    const state = {
      activeLayerId: 'base',
      hidden: {},
      objectStates: {},
      dragPositions: {},
      dropAssignments: {},
      variables: {},
      muted: false,
    };

    runtimeApi.storylineRenderSlide({ slide, state, stage, attachRuntime: false });

    expect(stage.querySelectorAll('.obj').length).toBe(3);
    expect(stage.innerHTML).toContain('data-object-type="draggable"');
    expect(stage.innerHTML).toContain('data-selection-overlay="true"');
  });

  test('writes object font family into runtime style', () => {
    const renderer = loadRuntimeRenderer();
    const html = renderer.storylineRendererObjectHtml(
      {
        id: 'button-1',
        type: 'button',
        label: 'Kontrol Et',
        x: 10,
        y: 20,
        width: 180,
        height: 44,
        style: {
          fontFamily: 'Open Sans',
          fontSize: 18,
          fontWeight: 800,
        },
      },
      {
        state: {
          activeLayerId: 'base',
          hidden: {},
          objectStates: {},
          variables: {},
        },
      }
    );

    expect(html).toContain('font-family:&quot;Open Sans&quot;, sans-serif');
  });

  test('uses production-language sound fallback labels in renderer runtime', () => {
    const renderer = loadRuntimeRenderer({
      soundOnLabel: 'Sound On',
      soundOffLabel: 'Sound Off',
    });

    const html = renderer.storylineRendererObjectHtml(
      {
        id: 'mute-1',
        type: 'button',
        label: '',
        runtimeAction: 'toggle-mute',
        x: 10,
        y: 20,
        width: 180,
        height: 44,
      },
      {
        state: {
          activeLayerId: 'base',
          hidden: {},
          objectStates: {},
          variables: {},
          muted: false,
        },
      }
    );

    expect(html).toContain('Sound Off');
    expect(html).not.toContain('SESİ KAPAT');
  });

  test('renders clone nodes for multi-target (reusable) drag placements', () => {
    const runtimeApi = getSharedStorylineRendererRuntimeApi();
    const stage = document.createElement('div');
    const slide = {
      stageWidth: 800,
      stageHeight: 450,
      dragDropSettings: { allowMultipleTargetsPerDrag: true },
      objects: [
        { id: 'drag-1', type: 'draggable', label: 'A', x: 20, y: 30, width: 100, height: 40 },
        { id: 'drop-a', type: 'dropzone', x: 260, y: 80, width: 120, height: 48 },
        { id: 'drop-b', type: 'dropzone', x: 260, y: 160, width: 120, height: 48 },
      ],
    };
    const state = {
      activeLayerId: 'base',
      hidden: {},
      objectStates: {},
      dragPositions: { 'drag-1@@a': { x: 270, y: 84 }, 'drag-1@@b': { x: 270, y: 164 } },
      dropAssignments: { 'drag-1@@a': 'drop-a', 'drag-1@@b': 'drop-b' },
      variables: {},
      muted: false,
    };

    runtimeApi.storylineRenderSlide({ slide, state, stage, attachRuntime: false });

    const clones = stage.querySelectorAll('[data-clone-of]');
    expect(clones.length).toBe(2);
    clones.forEach((clone) => {
      expect(clone.dataset.cloneOf).toBe('drag-1');
      expect(clone.dataset.objectType).toBe('draggable');
    });
    // Orijinal (tepsi) öğesi de hâlâ render edilmeli (yeniden sürüklenebilsin).
    const base = Array.from(stage.querySelectorAll('[data-object-type="draggable"]')).filter(
      (el) => !el.dataset.cloneOf
    );
    expect(base.length).toBe(1);
  });

  test('keeps active layer backdrop below its interactive elements', () => {
    const runtimeApi = getSharedStorylineRendererRuntimeApi();
    const stage = document.createElement('div');
    const slide = {
      stageWidth: 800,
      stageHeight: 450,
      layers: [
        { id: 'base', name: 'Ana' },
        { id: 'L1', name: 'Yanlış' },
      ],
      objects: [
        // Tam sahneyi kaplayan koyu backdrop ama yüksek zIndex ile yazılmış.
        {
          id: 'dim-1',
          type: 'shape',
          shapeKind: 'rect',
          layerId: 'L1',
          x: 0,
          y: 0,
          width: 800,
          height: 450,
          zIndex: 90,
          style: { background: 'rgba(15,23,42,.45)' },
        },
        {
          id: 'btn-1',
          type: 'button',
          label: 'TEKRAR',
          layerId: 'L1',
          x: 320,
          y: 200,
          width: 160,
          height: 56,
          zIndex: 2,
        },
      ],
    };
    const state = {
      activeLayerId: 'L1',
      hidden: {},
      objectStates: {},
      dragPositions: {},
      dropAssignments: {},
      variables: {},
      muted: false,
    };

    runtimeApi.storylineRenderSlide({ slide, state, stage, attachRuntime: false });

    const dimZ = Number(stage.querySelector('[data-object-id="dim-1"]').style.zIndex);
    const btnZ = Number(stage.querySelector('[data-object-id="btn-1"]').style.zIndex);
    expect(dimZ).toBeLessThan(btnZ);
  });

  test('keeps duplicate draggable ids from sharing one drag position', () => {
    const renderer = loadRuntimeRenderer();
    const slide = {
      stageWidth: 800,
      stageHeight: 450,
      objects: [
        {
          id: 'same-id',
          type: 'draggable',
          label: 'A',
          x: 10,
          y: 20,
          width: 80,
          height: 32,
          zIndex: 1,
        },
        {
          id: 'same-id',
          type: 'draggable',
          label: 'B',
          x: 140,
          y: 20,
          width: 80,
          height: 32,
          zIndex: 2,
        },
      ],
    };
    const state = {
      activeLayerId: 'base',
      hidden: {},
      objectStates: {},
      dragPositions: {},
      dropAssignments: {},
      variables: {},
    };

    const objects = renderer.storylineRendererVisibleObjects({ slide, state });
    const firstKey = renderer.storylineRendererObjectKey(objects[0]);
    const secondKey = renderer.storylineRendererObjectKey(objects[1]);

    expect(firstKey).not.toBe(secondKey);

    state.dragPositions[firstKey] = { x: 310, y: 90 };

    const firstHtml = renderer.storylineRendererObjectHtml(objects[0], { slide, state });
    const secondHtml = renderer.storylineRendererObjectHtml(objects[1], { slide, state });

    expect(firstHtml).toContain('left:310px');
    expect(secondHtml).toContain('left:140px');
  });

  test('regenerates duplicate stale runtime ids', () => {
    const renderer = loadRuntimeRenderer();
    const slide = {
      stageWidth: 800,
      stageHeight: 450,
      objects: [
        {
          id: 'drag-a',
          __runtimeId: 'stale',
          type: 'draggable',
          label: 'A',
          x: 10,
          y: 20,
          width: 80,
          height: 32,
          zIndex: 1,
        },
        {
          id: 'drag-b',
          __runtimeId: 'stale',
          type: 'draggable',
          label: 'B',
          x: 140,
          y: 20,
          width: 80,
          height: 32,
          zIndex: 2,
        },
      ],
    };
    const state = {
      activeLayerId: 'base',
      hidden: {},
      objectStates: {},
      dragPositions: {},
      dropAssignments: {},
      variables: {},
    };

    const objects = renderer.storylineRendererVisibleObjects({ slide, state });

    expect(renderer.storylineRendererObjectKey(objects[0])).toBe('stale');
    expect(renderer.storylineRendererObjectKey(objects[1])).not.toBe('stale');
    expect(renderer.storylineRendererObjectKey(objects[1])).not.toBe(
      renderer.storylineRendererObjectKey(objects[0])
    );
  });

  test('uses shared engine evaluation with runtime ids', () => {
    const renderer = loadRuntimeRenderer();
    const slide = {
      stageWidth: 800,
      stageHeight: 450,
      dragDropMatches: { 'same-id': 'drop-a' },
      objects: [
        {
          id: 'same-id',
          type: 'draggable',
          label: 'A',
          x: 10,
          y: 20,
          width: 80,
          height: 32,
          zIndex: 1,
        },
        {
          id: 'same-id',
          type: 'draggable',
          label: 'B',
          x: 140,
          y: 20,
          width: 80,
          height: 32,
          zIndex: 2,
        },
        { id: 'drop-a', type: 'dropzone', x: 310, y: 90, width: 100, height: 40, zIndex: 3 },
      ],
    };
    const state = {
      activeLayerId: 'base',
      hidden: {},
      objectStates: {},
      dragPositions: {},
      dropAssignments: {},
      variables: {},
    };
    const objects = renderer.storylineRendererVisibleObjects({ slide, state });
    const firstKey = renderer.storylineRendererObjectKey(objects[0]);

    state.dropAssignments[firstKey] = 'drop-a';

    expect(renderer.storylineRendererEvaluate({ slide, state })).toMatchObject({
      success: true,
      expectedCount: 1,
    });
  });

  test('check answer routes to normal layer when nothing is placed', () => {
    const runtimeApi = getSharedStorylineRendererRuntimeApi();
    const stage = document.createElement('div');
    const slide = {
      stageWidth: 800,
      stageHeight: 450,
      layers: [
        { id: 'base', name: 'Katman 1', kind: 'base' },
        { id: 'layer-normal', name: 'normal', kind: 'overlay' },
        { id: 'layer-correct', name: 'Correct', kind: 'overlay' },
        { id: 'layer-incorrect', name: 'Incorrect', kind: 'overlay' },
      ],
      dragDropMatches: { 'drag-1': 'drop-1' },
      objects: [
        { id: 'drag-1', type: 'draggable', label: 'A', x: 20, y: 30, width: 100, height: 40 },
        { id: 'drop-1', type: 'dropzone', x: 260, y: 80, width: 120, height: 48 },
      ],
    };
    const state = {
      activeLayerId: 'base',
      hidden: {},
      objectStates: {},
      dragPositions: {},
      dropAssignments: {},
      variables: {},
      muted: false,
    };

    runtimeApi.storylineRendererCheckAnswer({ slide, state, stage, render: () => {} });

    expect(state.activeLayerId).toBe('layer-normal');
  });

  test('routes puzzle evaluation with the activity-shaped slide contract', () => {
    const runtimeApi = getSharedStorylineRendererRuntimeApi();
    const state = {
      activeLayerId: 'base',
      hidden: {},
      objectStates: {},
      dragPositions: {},
      dropAssignments: {},
      puzzleGrid: { '0,0': 'A' },
    };
    const result = runtimeApi.storylineRendererCheckAnswer({
      slide: {
        type: 'puzzle',
        puzzleType: 'crossword',
        puzzleGrid: { cells: [[{ letter: 'A' }]] },
        puzzlePlaced: [],
        layers: [{ id: 'base', name: 'base', kind: 'base' }],
        objects: [],
      },
      state,
      stage: document.createElement('div'),
      render: () => {},
    });

    expect(result).toMatchObject({ success: true, correct: 1, total: 1 });
  });

  test('keeps placed drag visible on feedback layer and shows result badge', () => {
    const renderer = loadRuntimeRenderer();
    const slide = {
      stageWidth: 800,
      stageHeight: 450,
      layers: [
        { id: 'base', name: 'Katman 1', kind: 'base' },
        { id: 'layer-incorrect', name: 'Incorrect', kind: 'overlay' },
      ],
      objects: [
        {
          id: 'drag-1',
          type: 'draggable',
          label: 'A',
          x: 20,
          y: 30,
          width: 100,
          height: 40,
          zIndex: 1,
        },
        {
          id: 'drag-2',
          type: 'draggable',
          label: 'B',
          x: 20,
          y: 90,
          width: 100,
          height: 40,
          zIndex: 2,
        },
        { id: 'drop-1', type: 'dropzone', x: 260, y: 80, width: 120, height: 48, zIndex: 3 },
      ],
    };
    const state = {
      activeLayerId: 'layer-incorrect',
      hidden: {},
      objectStates: {
        'drag-1': { dropIncorrect: true },
      },
      dragPositions: {
        'drag-1': { x: 310, y: 120 },
      },
      dropAssignments: {
        'drag-1': 'drop-1',
      },
      variables: {},
    };

    const objects = renderer.storylineRendererVisibleObjects({ slide, state });
    const drag1 = objects.find((object) => object.id === 'drag-1');
    const drag2 = objects.find((object) => object.id === 'drag-2');

    expect(drag1).toBeTruthy();
    expect(drag2).toBeTruthy();

    const drag1Html = renderer.storylineRendererObjectHtml(drag1, { slide, state });
    const drag2Html = renderer.storylineRendererObjectHtml(drag2, { slide, state });

    expect(drag1Html).toContain('left:310px');
    expect(drag1Html).toContain('×');
    expect(drag1Html).toContain('#dc2626');
    expect(drag2Html).toContain('left:20px');
  });

  test('renders shape objects with svg markup like editor canvas', () => {
    const renderer = loadRuntimeRenderer();
    const slide = {
      stageWidth: 800,
      stageHeight: 450,
      objects: [
        {
          id: 'shape-1',
          type: 'shape',
          shapeKind: 'roundedRect',
          label: 'Basla',
          x: 40,
          y: 50,
          width: 180,
          height: 64,
          style: {
            background: '#0f172a',
            borderColor: '#1e293b',
            borderWidth: 4,
            color: '#ffffff',
            borderRadius: 16,
          },
        },
      ],
    };
    const state = {
      activeLayerId: 'base',
      hidden: {},
      objectStates: {},
      dragPositions: {},
      dropAssignments: {},
      variables: {},
    };

    const objects = renderer.storylineRendererVisibleObjects({ slide, state });
    const html = renderer.storylineRendererObjectHtml(objects[0], { slide, state });

    expect(html).toContain('<svg');
    expect(html).toContain('<rect');
    expect(html).toContain('Basla');
  });

  test('renders table objects as html tables in export html', () => {
    const renderer = loadRuntimeRenderer();
    const slide = {
      stageWidth: 800,
      stageHeight: 450,
      objects: [
        {
          id: 'table-1',
          type: 'table',
          x: 40,
          y: 50,
          width: 420,
          height: 160,
          tableData: {
            headerRow: true,
            rows: [
              ['Ad', 'Soyad'],
              ['Ali', 'Veli'],
            ],
          },
          style: { borderColor: '#cbd5e1', color: '#1f2937', fontSize: 14 },
        },
      ],
    };
    const state = {
      activeLayerId: 'base',
      hidden: {},
      objectStates: {},
      dragPositions: {},
      dropAssignments: {},
      variables: {},
    };

    const objects = renderer.storylineRendererVisibleObjects({ slide, state });
    const html = renderer.storylineRendererObjectHtml(objects[0], { slide, state });

    expect(html).toContain('<table');
    expect(html).toContain('<th');
    expect(html).toContain('Ad');
    expect(html).toContain('Veli');
  });

  test('renders chart objects as inline svg in export html', () => {
    const renderer = loadRuntimeRenderer();
    const slide = {
      stageWidth: 800,
      stageHeight: 450,
      objects: [
        {
          id: 'chart-1',
          type: 'chart',
          chartType: 'bar',
          x: 40,
          y: 50,
          width: 360,
          height: 240,
          chartData: { labels: ['A', 'B'], values: [10, 20], colors: [] },
          style: {},
        },
      ],
    };
    const state = {
      activeLayerId: 'base',
      hidden: {},
      objectStates: {},
      dragPositions: {},
      dropAssignments: {},
      variables: {},
    };

    const objects = renderer.storylineRendererVisibleObjects({ slide, state });
    const html = renderer.storylineRendererObjectHtml(objects[0], { slide, state });

    expect(html).toContain('<svg');
    expect(html).toContain('<rect');
    expect(html).toContain('>A<');
  });

  test('renders icon objects and button icons as inline svg in export html', () => {
    const renderer = loadRuntimeRenderer();
    const iconSvg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke="currentColor"><path d="M5 12h14"/></svg>';
    const slide = {
      stageWidth: 800,
      stageHeight: 450,
      objects: [
        { id: 'icon-1', type: 'text', label: 'İkon', iconSvg, x: 40, y: 40, width: 80, height: 80 },
        {
          id: 'btn-1',
          type: 'button',
          label: 'Devam',
          icon: { name: 'arrow-right', svg: iconSvg },
          iconPosition: 'left',
          x: 200,
          y: 40,
          width: 160,
          height: 48,
        },
      ],
    };
    const state = {
      activeLayerId: 'base',
      hidden: {},
      objectStates: {},
      dragPositions: {},
      dropAssignments: {},
      variables: {},
    };

    const objects = renderer.storylineRendererVisibleObjects({ slide, state });
    const iconHtml = renderer.storylineRendererObjectHtml(objects[0], { slide, state });
    const buttonHtml = renderer.storylineRendererObjectHtml(objects[1], { slide, state });

    // İkon nesnesi: SVG render edilir, metin etiketi gösterilmez.
    expect(iconHtml).toContain('<svg');
    expect(iconHtml).toContain('d="M5 12h14"');
    expect(iconHtml).not.toContain('İkon');

    // Buton: hem ikon SVG'si hem metin yan yana.
    expect(buttonHtml).toContain('d="M5 12h14"');
    expect(buttonHtml).toContain('Devam');
  });

  test('keeps overlay objects above base without adding runtime-only dim layers', () => {
    const runtimeApi = getSharedStorylineRendererRuntimeApi();
    const stage = document.createElement('div');
    const slide = {
      stageWidth: 800,
      stageHeight: 450,
      layers: [
        { id: 'base', name: 'Katman 1', kind: 'base' },
        { id: 'layer-menu', name: 'menu-2', kind: 'overlay' },
      ],
      objects: [
        {
          id: 'base-button',
          type: 'button',
          label: 'Base',
          x: 40,
          y: 40,
          width: 160,
          height: 48,
          zIndex: 200000000,
        },
        {
          id: 'overlay-button',
          type: 'button',
          layerId: 'layer-menu',
          label: 'Overlay',
          x: 120,
          y: 120,
          width: 180,
          height: 52,
          zIndex: 1,
        },
      ],
    };
    const state = {
      activeLayerId: 'layer-menu',
      hidden: {},
      objectStates: {},
      dragPositions: {},
      dropAssignments: {},
      variables: {},
      muted: false,
    };

    runtimeApi.storylineRenderSlide({ slide, state, stage, attachRuntime: false });

    expect(stage.innerHTML).not.toContain('background: rgba(15, 23, 42, 0.07);');
    expect(stage.innerHTML).toContain('z-index:200100001');
  });

  test('preserves generated button text color from editor data', () => {
    const runtimeApi = getSharedStorylineRendererRuntimeApi();
    const stage = document.createElement('div');
    const slide = {
      stageWidth: 800,
      stageHeight: 450,
      layers: [
        { id: 'base', name: 'Katman 1', kind: 'base' },
        { id: 'layer-menu', name: 'menu', kind: 'overlay' },
      ],
      objects: [
        {
          id: 'dark-menu-button',
          type: 'button',
          layerId: 'layer-menu',
          label: 'MENÜ',
          runtimeAction: 'restart',
          x: 120,
          y: 120,
          width: 180,
          height: 52,
          zIndex: 1,
          style: {
            background: 'linear-gradient(180deg,#111827,#020617)',
            color: '#000000',
          },
        },
      ],
    };
    const state = {
      activeLayerId: 'layer-menu',
      hidden: {},
      objectStates: {},
      dragPositions: {},
      dropAssignments: {},
      variables: {},
    };

    runtimeApi.storylineRenderSlide({ slide, state, stage, attachRuntime: false });

    const button = stage.querySelector('[data-id="dark-menu-button"]');
    expect(button.style.color).toBe('rgb(0, 0, 0)');
  });

  test('escapes quoted CSS backgrounds in runtime style attributes', () => {
    const renderer = loadRuntimeRenderer();
    const slide = {
      stageWidth: 800,
      stageHeight: 450,
      objects: [
        {
          id: 'decor-bg',
          type: 'shape',
          shapeKind: 'rect',
          x: 0,
          y: 0,
          width: 800,
          height: 450,
          zIndex: 1,
          style: {
            background:
              'url("data:image/svg+xml,%3Csvg%2F%3E"), linear-gradient(135deg,#ecfdf5,#99f6e4)',
            borderWidth: 0,
          },
        },
      ],
    };
    const state = {
      activeLayerId: 'base',
      hidden: {},
      objectStates: {},
      dragPositions: {},
      dropAssignments: {},
      variables: {},
    };

    const objects = renderer.storylineRendererVisibleObjects({ slide, state });
    const html = renderer.storylineRendererObjectHtml(objects[0], { slide, state });

    expect(html).toContain('url(&quot;data:image/svg+xml');
    expect(html).toContain('linear-gradient(135deg,#ecfdf5,#99f6e4)');
  });

  test('preserves answer-template popup panel opacity from editor data', () => {
    const renderer = loadRuntimeRenderer();
    const html = renderer.storylineRendererObjectHtml(
      {
        id: 'normal-panel',
        generatedBy: 'answer-template',
        type: 'shape',
        shapeKind: 'roundedRect',
        layerId: 'normal-layer',
        x: 100,
        y: 100,
        width: 320,
        height: 120,
        style: {
          background: 'linear-gradient(180deg,rgba(255,255,255,.42),rgba(248,250,252,.36))',
          borderColor: '#d8e5f0',
          borderRadius: 18,
        },
      },
      {
        state: {
          activeLayerId: 'normal-layer',
          hidden: {},
          objectStates: {},
          variables: {},
        },
      }
    );

    expect(html).toContain('rgba(255,255,255,.42)');
    expect(html).toContain('rgba(248,250,252,.36)');
    expect(html).not.toContain('rgba(255,255,255,.98)');
    expect(html).not.toContain('rgba(248,250,252,.98)');
  });

  test('preserves existing overlay popup panel opacity without template metadata', () => {
    const renderer = loadRuntimeRenderer();
    const html = renderer.storylineRendererObjectHtml(
      {
        id: 'old-normal-panel',
        type: 'shape',
        shapeKind: 'roundedRect',
        layerId: 'normal-layer',
        x: 720,
        y: 390,
        width: 620,
        height: 252,
        style: {
          background: 'linear-gradient(180deg,rgba(255,255,255,.28),rgba(248,250,252,.22))',
          borderColor: '#d8e5f0',
          borderRadius: 18,
          opacity: 0.5,
        },
      },
      {
        state: {
          activeLayerId: 'normal-layer',
          hidden: {},
          objectStates: {},
          variables: {},
        },
      }
    );

    expect(html).toContain('rgba(255,255,255,.28)');
    expect(html).toContain('rgba(248,250,252,.22)');
    expect(html).toContain('opacity:0.5');
    expect(html).not.toContain('rgba(255,255,255,.98)');
    expect(html).not.toContain('rgba(248,250,252,.98)');
  });

  test('keeps answer-layer draggables passive without blocking popup cursors', () => {
    const renderer = loadRuntimeRenderer();
    const slide = {
      stageWidth: 800,
      stageHeight: 450,
      layers: [
        { id: 'base', name: 'Katman 1', kind: 'base' },
        { id: 'layer-answer', name: 'cevap', kind: 'overlay' },
      ],
      objects: [
        {
          id: 'drag-1',
          type: 'draggable',
          layerId: 'base',
          label: 'A',
          x: 20,
          y: 30,
          width: 100,
          height: 40,
          zIndex: 1,
        },
      ],
    };
    const state = {
      activeLayerId: 'layer-answer',
      hidden: {},
      objectStates: {},
      dragPositions: {
        'drag-1': { x: 180, y: 120 },
      },
      dropAssignments: {},
      variables: {},
    };

    const objects = renderer.storylineRendererVisibleObjects({ slide, state });
    const html = renderer.storylineRendererObjectHtml(objects[0], { slide, state });

    expect(html).toContain('cursor:default');
    expect(html).toContain('pointer-events:none');
    expect(html).toContain('left:180px');
  });

  test('uses editor-parity text defaults in shared preview and SCORM renderer', () => {
    const utils = loadRuntimeRenderer();
    const slide = {
      stageWidth: 800,
      stageHeight: 450,
      objects: [
        {
          id: 'button-1',
          type: 'button',
          label: 'Kontrol Et',
          x: 20,
          y: 30,
          width: 160,
          height: 48,
          zIndex: 1,
          style: { fontSize: 18 },
        },
      ],
    };
    const state = {
      activeLayerId: 'base',
      hidden: {},
      objectStates: {},
      dragPositions: {},
      dropAssignments: {},
      variables: {},
    };

    const visibleItems = utils.storylineRendererVisibleObjects({ slide, state });
    const markup = utils.storylineRendererObjectHtml(visibleItems[0], { slide, state });

    expect(markup).toContain('font-weight:600');
    expect(markup).toContain('padding:0');
    expect(markup).toContain('style="pointer-events:none;padding:0 6px"');
  });

  test('generated runtime keeps manual linked trigger ahead of icon runtimeAction', () => {
    const renderer = loadRuntimeRenderer();
    const slide = {
      objects: [
        { id: 'icon', type: 'button', label: '⌂', runtimeAction: 'home', linkedActionTargetId: 'label', linkedHoverGroup: 'row' },
        { id: 'label', type: 'button', label: 'Çözümü Göster', linkedActionTargetId: 'label', linkedHoverGroup: 'row' },
      ],
      layers: [{ id: 'answer-layer', name: 'Cevap' }],
      triggers: [{ when: 'onClick', target: 'label', action: 'KatmanaGec', value: 'answer-layer' }],
    };
    expect(renderer.storylineRuntimeCommandsForObject({
      slide, sourceId: 'icon', sourceObject: slide.objects[0], state: {}, variableDefinitions: [],
    })).toEqual([
      { type: 'resetAttempt', reason: 'trigger-answer-layer' },
      { type: 'setLayer', layerId: 'answer-layer' },
    ]);
  });
});
