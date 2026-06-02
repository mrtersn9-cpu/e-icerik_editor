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
});
