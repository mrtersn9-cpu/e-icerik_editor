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

  test('B-320: formül motoru (parseAndEvaluate) SCORM bundle\'ına gömülür', () => {
    const html = buildStorylinePlayerHtml({
      selActId: 'f1',
      activities: [
        {
          id: 'f1',
          name: 'Form',
          type: 'fill-blank',
          fillBlankSentence: 'A ___',
          fillBlankAnswers: [{ id: 'b0', acceptedValues: ['x'] }],
        },
      ],
    });
    // DegiskenAta formul yolu parseAndEvaluate cagiriyor; bundle'da tanimli olmali.
    expect(html).toContain('function parseAndEvaluate');
    expect(html).toContain('function tokenize');
    expect(html).toContain('function evaluateRPN');
    // Bundle'in butun olarak gecerli kosmasi mevcut jsdom-exec testleriyle dogrulaniyor.
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

  test('içerik dili=en iken wordsearch sayacı İngilizce (Bulunan değil Found)', () => {
    const html = buildStorylinePlayerHtml({
      selActId: 'ws-en',
      activities: [
        {
          id: 'ws-en',
          name: 'Word Search',
          type: 'puzzle',
          puzzleType: 'wordsearch',
          contentLanguage: 'en',
          puzzleGrid: { rows: 1, cols: 3, cells: [[{ letter: 'A' }, { letter: 'L' }, { letter: 'P' }]] },
          puzzlePlaced: [{ id: 'w1', answer: 'ALP' }],
        },
      ],
    });
    // i18n paketi seçilen dille gelmeli
    expect(html).toContain('"foundLabel":"Found"');
    const script = html.match(/<script>([\s\S]*)<\/script>/)?.[1];
    document.body.innerHTML =
      '<div id="stage"></div><div id="complete"><button id="closeComplete">Close</button></div>';
    // eslint-disable-next-line no-new-func
    new Function(script)();
    const counter = document.querySelector('.typed-counter');
    expect(counter).toBeTruthy();
    expect(counter.textContent).toContain('Found');
    expect(counter.textContent).not.toContain('Bulunan');
  });

  test('B-323: Türkçe i-varyantı (ızgara I, cevap İ) fold ile eşleşir', () => {
    const html = buildStorylinePlayerHtml({
      selActId: 'ws-tr',
      activities: [
        {
          id: 'ws-tr',
          name: 'Kelime',
          type: 'puzzle',
          puzzleType: 'wordsearch',
          // Izgara düz 'I' harfleriyle, cevap dotlu 'İ' ile saklanmış (uyumsuzluk senaryosu)
          puzzleGrid: { rows: 1, cols: 3, cells: [[{ letter: 'I' }, { letter: 'L' }, { letter: 'K' }]] },
          puzzlePlaced: [{ id: 'w1', answer: 'İLK' }],
        },
      ],
    });
    expect(html).toContain('function typedFold');
    const script = html.match(/<script>([\s\S]*)<\/script>/)?.[1];
    document.body.innerHTML =
      '<div id="stage"></div><div id="complete"><button id="closeComplete">Kapat</button></div>';
    // eslint-disable-next-line no-new-func
    new Function(script)();
    const cells = document.querySelectorAll('.typed-word-cell');
    expect(cells.length).toBe(3);
    cells[0].click();
    document.querySelectorAll('.typed-word-cell')[2].click();
    // Fold öncesi 'İLK' !== 'ILK' idi (bulunamazdı); fold ile bulunur -> sayaç 1/1
    expect(document.querySelector('.typed-counter')?.textContent).toContain('1 / 1');
  });

  test('slider: dışa aktarılan SCORM oynatıcıda kaydırıcı değeri tolerans dahilinde doğru sayılır', () => {
    const html = buildStorylinePlayerHtml({
      selActId: 'sl-1',
      activities: [
        {
          id: 'sl-1',
          name: 'Kaydırıcı',
          type: 'slider',
          sliderMode: 'slider',
          sliderMin: 0,
          sliderMax: 100,
          sliderStep: 1,
          sliderCorrectValue: 50,
          sliderTolerance: 0,
        },
      ],
    });
    const script = html.match(/<script>([\s\S]*)<\/script>/)?.[1];
    document.body.innerHTML =
      '<div id="stage"></div><div id="complete"><button id="closeComplete">Kapat</button></div>';
    // eslint-disable-next-line no-new-func
    new Function(script)();

    const range = document.querySelector('input[type="range"]');
    expect(range).toBeTruthy();
    range.value = '50';
    range.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('.typed-actions .typed-btn').click();
    expect(document.querySelector('.typed-feedback.correct')?.textContent).toContain('✓ Doğru');
  });

  test('dropdown-match: doğru açılır menü seçimleri SCORM oynatıcıda doğru sayılır', () => {
    const html = buildStorylinePlayerHtml({
      selActId: 'dm-1',
      activities: [
        {
          id: 'dm-1',
          name: 'Açılır Eşleştirme',
          type: 'dropdown-match',
          matchingShuffle: false,
          matchingPairs: [
            { id: 'p1', left: 'A', right: '1' },
            { id: 'p2', left: 'B', right: '2' },
          ],
        },
      ],
    });
    const script = html.match(/<script>([\s\S]*)<\/script>/)?.[1];
    document.body.innerHTML =
      '<div id="stage"></div><div id="complete"><button id="closeComplete">Kapat</button></div>';
    // eslint-disable-next-line no-new-func
    new Function(script)();

    let selects = document.querySelectorAll('select');
    expect(selects.length).toBe(2);
    selects[0].value = '1';
    selects[0].dispatchEvent(new Event('change', { bubbles: true }));
    // change render() tetikler; DOM yeniden kurulur, tekrar sorgula
    selects = document.querySelectorAll('select');
    selects[1].value = '2';
    selects[1].dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelector('.typed-actions .typed-btn').click();
    expect(document.querySelector('.typed-feedback.correct')?.textContent).toContain('✓ Doğru');
  });

  test('content-tabs: "tümünü görüntüle" gerektiren içerik tüm sekmeler açılınca tamamlanır', () => {
    const html = buildStorylinePlayerHtml({
      selActId: 'ct-1',
      activities: [
        {
          id: 'ct-1',
          name: 'Sekmeler',
          type: 'content-tabs',
          contentLayout: 'tabs',
          contentRequireAll: true,
          contentItems: [
            { id: 'i1', title: 'A', body: 'x' },
            { id: 'i2', title: 'B', body: 'y' },
          ],
        },
      ],
    });
    const script = html.match(/<script>([\s\S]*)<\/script>/)?.[1];
    document.body.innerHTML =
      '<div id="stage"></div><div id="complete"><button id="closeComplete">Kapat</button></div>';
    // eslint-disable-next-line no-new-func
    new Function(script)();

    // İlk render yalnız ilk sekmeyi görüntülenmiş sayar → 2'den 1'i → henüz başarısız
    document.querySelector('.typed-actions .typed-btn').click();
    expect(document.querySelector('.typed-feedback.correct')).toBeFalsy();

    // İkinci sekmeyi aç (tab bar butonları: [tab0, tab1])
    const tabButtons = Array.from(document.querySelectorAll('button')).filter((b) => !b.classList.contains('typed-btn') && b.id !== 'closeComplete');
    tabButtons[1].click();
    document.querySelector('.typed-actions .typed-btn').click();
    expect(document.querySelector('.typed-feedback.correct')?.textContent).toContain('✓ Doğru');
  });

  test('shortcut-key: doğru klavye kısayolu SCORM oynatıcıda doğru sayılır', () => {
    const html = buildStorylinePlayerHtml({
      selActId: 'sc-1',
      activities: [
        {
          id: 'sc-1',
          name: 'Kısayol',
          type: 'shortcut-key',
          shortcutAnswers: [{ combo: 'Ctrl+S' }],
        },
      ],
    });
    const script = html.match(/<script>([\s\S]*)<\/script>/)?.[1];
    document.body.innerHTML =
      '<div id="stage"></div><div id="complete"><button id="closeComplete">Kapat</button></div>';
    // eslint-disable-next-line no-new-func
    new Function(script)();

    const captureBox = Array.from(document.querySelectorAll('button')).find((b) => !b.classList.contains('typed-btn') && b.id !== 'closeComplete');
    expect(captureBox).toBeTruthy();
    captureBox.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true }));
    document.querySelector('.typed-actions .typed-btn').click();
    expect(document.querySelector('.typed-feedback.correct')?.textContent).toContain('✓ Doğru');
    // Regresyon: shortcut-key tamamlanma alanı (completed) eksikti, kurs hiç
    // "tamamlandı" durumuna geçmiyordu. Tek sahneli pakette doğru tuş basıldıktan
    // sonra kurs tamamlanma ekranı görünür olmalı.
    expect(document.getElementById('complete')?.classList.contains('show')).toBe(true);
  });

  test('shortcut-key: completionMode "optional" iken hiç yanıtlanmasa da kurs tamamlanabilir', () => {
    const html = buildStorylinePlayerHtml({
      selActId: 'sc-optional',
      activities: [
        {
          id: 'sc-optional',
          name: 'İsteğe Bağlı Kısayol',
          type: 'shortcut-key',
          shortcutAnswers: [{ combo: 'Ctrl+S' }],
          settings: { completionMode: 'optional' },
        },
      ],
    });
    const script = html.match(/<script>([\s\S]*)<\/script>/)?.[1];
    document.body.innerHTML =
      '<div id="stage"></div><div id="complete"><button id="closeComplete">Kapat</button></div>';
    // eslint-disable-next-line no-new-func
    new Function(script)();

    // Hiçbir etkileşim yapılmadan (kısayol basılmadan), yalnızca sahne render'ı
    // sonrası kurs tamamlanmış sayılmalı — çünkü etkinlik isteğe bağlı.
    expect(document.getElementById('complete')?.classList.contains('show')).toBe(true);
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
