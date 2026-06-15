import { TextEncoder } from 'util';

global.TextEncoder = TextEncoder;

// The exporter instantiates TextEncoder at module load time.
// eslint-disable-next-line global-require
const { buildStorylinePlayerHtml } = require('../utils/scormExport');

describe('SCORM typed activity player', () => {
  test('embeds typed learner controls and editor-approved activity data', () => {
    const html = buildStorylinePlayerHtml(
      {
        selActId: 'puzzle-1',
        activities: [
          {
            id: 'puzzle-1',
            name: 'Bulmaca',
            type: 'puzzle',
            puzzleType: 'crossword',
            puzzleGrid: { rows: 1, cols: 1, cells: [[{ letter: 'A' }]] },
            puzzlePlaced: [{ id: 'word-1', question: 'İlk harf', startRow: 0, startCol: 0 }],
          },
        ],
      },
      { packageName: 'Test Paketi' }
    );

    expect(html).toContain('function typedActivitySupported');
    expect(html).toContain('function renderTypedActivity');
    expect(html).toContain('"type":"puzzle"');
    expect(html).toContain('"puzzleType":"crossword"');
    expect(html).toContain('✓ Doğru');
    expect(html).toContain('× Yanlış');
  });

  test('renders and evaluates a fill-blank answer inside exported vanilla player HTML', () => {
    const html = buildStorylinePlayerHtml({
      selActId: 'fill-1',
      activities: [
        {
          id: 'fill-1',
          name: 'Boşluk Doldurma',
          type: 'fill-blank',
          fillBlankSentence: 'Türkiye başkenti ___ şehridir.',
          fillBlankAnswers: [{ id: 'blank-0', acceptedValues: ['Ankara'] }],
        },
      ],
    });
    const script = html.match(/<script>([\s\S]*)<\/script>/)?.[1];

    document.body.innerHTML =
      '<div id="stage"></div><div id="complete"><button id="closeComplete">Kapat</button></div>';
    // eslint-disable-next-line no-new-func
    new Function(script)();

    const input = document.querySelector('.typed-blank');
    expect(input).toBeTruthy();
    input.value = 'Ankara';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('.typed-actions .typed-btn').click();

    expect(document.querySelector('.typed-feedback.correct')?.textContent).toContain('✓ Doğru');
  });

  test('B-321: wordsearch için Kontrol Et butonu render edilir ve tamamlanır', () => {
    const html = buildStorylinePlayerHtml({
      selActId: 'ws-1',
      activities: [
        {
          id: 'ws-1',
          name: 'Kelime Avı',
          type: 'puzzle',
          puzzleType: 'wordsearch',
          puzzleGrid: { rows: 1, cols: 3, cells: [[{ letter: 'A' }, { letter: 'L' }, { letter: 'P' }]] },
          puzzlePlaced: [{ id: 'w1', answer: 'ALP' }],
        },
      ],
    });
    const script = html.match(/<script>([\s\S]*)<\/script>/)?.[1];

    document.body.innerHTML =
      '<div id="stage"></div><div id="complete"><button id="closeComplete">Kapat</button></div>';
    // eslint-disable-next-line no-new-func
    new Function(script)();

    // Fix öncesi typedRenderWordsearch typedActions çağırmadığı için bu buton yoktu.
    const checkBtn = document.querySelector('.typed-actions .typed-btn');
    expect(checkBtn).toBeTruthy();

    // Kelimeyi bul: ilk ve son hücreye tıkla (A..P -> "ALP")
    const cells = document.querySelectorAll('.typed-word-cell');
    expect(cells.length).toBe(3);
    cells[0].click();
    document.querySelectorAll('.typed-word-cell')[2].click();

    // Kontrol Et -> tamamlandı geri bildirimi
    document.querySelector('.typed-actions .typed-btn').click();
    expect(document.querySelector('.typed-feedback.correct')?.textContent).toContain('✓ Doğru');
  });

  test('carries ready button typography into typed SCORM player controls', () => {
    const html = buildStorylinePlayerHtml({
      selActId: 'fill-typography',
      activities: [
        {
          id: 'fill-typography',
          name: 'Buton Font Testi',
          type: 'fill-blank',
          readyButtonTextColor: '#fde047',
          readyButtonFontFamily: 'Verdana',
          readyButtonFontSize: 18,
          readyButtonFontWeight: 700,
          fillBlankSentence: 'Türkiye başkenti ___ şehridir.',
          fillBlankAnswers: [{ id: 'blank-0', acceptedValues: ['Ankara'] }],
        },
      ],
    });
    const script = html.match(/<script>([\s\S]*)<\/script>/)?.[1];

    expect(html).toContain('"readyButtonTextColor":"#fde047"');
    expect(html).toContain('"readyButtonFontFamily":"Verdana"');
    expect(html).toContain('"readyButtonFontSize":18');
    expect(html).toContain('"readyButtonFontWeight":700');

    document.body.innerHTML =
      '<div id="stage"></div><div id="complete"><button id="closeComplete">Kapat</button></div>';
    // eslint-disable-next-line no-new-func
    new Function(script)();

    const root = document.querySelector('.typed-activity');
    const button = document.querySelector('.typed-actions .typed-btn');
    expect(root).toBeTruthy();
    expect(button).toBeTruthy();
    expect(root.style.getPropertyValue('--typed-button-text-color')).toBe('#fde047');
    expect(root.style.getPropertyValue('--typed-button-secondary-text-color')).toBe('#fde047');
    expect(root.style.getPropertyValue('--typed-button-font-family')).toBe('Verdana');
    expect(root.style.getPropertyValue('--typed-button-font-size')).toBe('18px');
    expect(root.style.getPropertyValue('--typed-button-font-weight')).toBe('700');
  });
});
