import {
  normalizePdfText,
  detectPdfDraftKind,
  detectPdfInteractionType,
  extractPdfAnswerTerms,
  extractPdfDragTerms,
  extractPdfQuestionAnchors,
  extractDeveloperNote,
  extractTrueFalseItems,
  extractCheckboxItems,
  extractOrderingItems,
  findDottedBlankSegments,
  buildStoryboardConfig,
} from './pdfParser';

describe('PDF Parser Utility Functions', () => {
  describe('normalizePdfText', () => {
    it('normalizes turkish characters and trims whitespace', () => {
      expect(normalizePdfText(' ÇçĞğİıÖöŞşÜü ')).toBe('ccggiioossuu');
    });

    it('replaces dashes with standard hyphens', () => {
      expect(normalizePdfText('deneme-test-yeni')).toBe('deneme-test-yeni');
    });
  });

  describe('detectPdfDraftKind', () => {
    it('detects video kind', () => {
      expect(detectPdfDraftKind([{ text: 'video slayt' }])).toBe('video');
      expect(detectPdfDraftKind([], 1, { kindHint: 'video' })).toBe('video');
    });

    it('detects drag-drop kind', () => {
      expect(detectPdfDraftKind([{ text: 'sürükleyiniz ve bırakınız' }])).toBe('drag-drop');
      expect(detectPdfDraftKind([{ text: 'SÜRÜKLENEBİLİR ÖĞELER' }])).toBe('drag-drop');
    });

    it('detects sequence kind correctly', () => {
      expect(detectPdfDraftKind([{ text: 'Karışık olan beytlerini sıraya koyunuz' }])).toBe('sequence');
      expect(detectPdfDraftKind([{ text: 'Olayları sıralayınız.' }])).toBe('sequence');
    });

    it('detects selection kind', () => {
      expect(detectPdfDraftKind([{ text: 'Doğru ise D, yanlış ise Y kutucuğunu işaretleyiniz' }])).toBe('selection');
    });

    it('detects reading kind if multiple pages', () => {
      expect(detectPdfDraftKind([{ text: 'Normal metin' }], 2)).toBe('reading');
    });

    it('defaults to unknown', () => {
      expect(detectPdfDraftKind([{ text: 'Normal metin' }], 1)).toBe('unknown');
    });
  });

  describe('extractPdfAnswerTerms', () => {
    it('extracts terms with standard numbering format', () => {
      const lines = [
        { text: 'Doğru eşleştirme' },
        { text: '1. Elma 2. Armut 3. Çilek' }
      ];
      const terms = extractPdfAnswerTerms(lines);
      expect(terms).toEqual(['Elma', 'Armut', 'Çilek']);
    });

    it('handles list items without commas', () => {
      const lines = [
        { text: 'DOĞRU EŞLEŞTİRME' },
        { text: '1. Aslan 2. Kaplan 3. Leopar' }
      ];
      const terms = extractPdfAnswerTerms(lines);
      expect(terms).toEqual(['Aslan', 'Kaplan', 'Leopar']);
    });

    it('returns empty array if marker not found', () => {
      const lines = [
        { text: 'Normal metin' },
        { text: '1. Aslan 2. Kaplan' }
      ];
      const terms = extractPdfAnswerTerms(lines);
      expect(terms).toEqual([]);
    });

    it('handles alternative list formats', () => {
      const lines = [
        { text: 'Doğru eşleştirme' },
        { text: 'a) Muz b) Kivi' }
      ];
      const terms = extractPdfAnswerTerms(lines);
      expect(terms).toEqual(['Muz', 'Kivi']);
    });
  });

  describe('extractPdfDragTerms', () => {
    it('strips numbering prefixes from draggable terms', () => {
      const lines = [
        { text: 'Sürüklenebilir Öğeler' },
        { text: '1) Elma' },
        { text: '2- Armut' },
        { text: 'a) Çilek' },
        { text: 'Doğru Eşleştirme' }
      ];

      expect(extractPdfDragTerms(lines)).toEqual(['Elma', 'Armut', 'Çilek']);
    });

    it('ignores e-icerik logo lines without stopping extraction', () => {
      const lines = [
        { text: 'Sürüklenebilir Öğeler' },
        { text: 'e-İçerik' },
        { text: 'Ulusal Kimlik ve Kültürü Yansıtması' },
        { text: 'Toplumu Etkileyen Olaylara Dayanması' }
      ];

      expect(extractPdfDragTerms(lines)).toEqual([
        'Ulusal Kimlik ve Kültürü Yansıtması',
        'Toplumu Etkileyen Olaylara Dayanması'
      ]);
    });
  });

  describe('extractPdfQuestionAnchors', () => {
    it('detects question anchors with alternative numbering', () => {
      const lines = [
        { text: '1) İlk ifade', x: 120, y: 140, height: 24, width: 180 },
        { text: '2- İkinci ifade', x: 120, y: 220, height: 24, width: 200 }
      ];

      expect(extractPdfQuestionAnchors(lines, 1080)).toEqual([
        expect.objectContaining({ text: '1) İlk ifade', x: 120, y: 140, order: 1 }),
        expect.objectContaining({ text: '2- İkinci ifade', x: 120, y: 220, order: 2 })
      ]);
    });
  });

  describe('storyboard extraction helpers', () => {
    it('detects target interaction types for storyboard pages', () => {
      expect(detectPdfInteractionType([{ text: 'Yargılar D Y' }])).toBe('TrueFalse');
      expect(detectPdfInteractionType([{ text: 'Sürüklenebilir Ögeler' }])).toBe('DragDrop');
      expect(detectPdfInteractionType([{ text: 'Kutucuğu işaretleyiniz' }])).toBe('Checkbox');
      expect(detectPdfInteractionType([{ text: 'Numaralandırınız ve sıralayınız' }])).toBe('Ordering');
    });

    it('extracts developer notes from page text', () => {
      const note = extractDeveloperNote([
        { text: 'YAZILIMCIYA NOT: Bu slaytta seslendirme olacak.' },
        { text: 'Arka planda hafif müzik kullanılabilir.' },
      ]);
      expect(note).toContain('seslendirme olacak');
      expect(note).toContain('hafif müzik');
    });

    it('extracts true false rows with answers', () => {
      const items = extractTrueFalseItems([
        { text: 'Yargılar D Y' },
        { text: '1. Destanlar sözlü gelenekte oluşur.' },
        { text: 'D' },
        { text: '2. Mesneviler tek dörtlükten oluşur.' },
        { text: 'Y' },
      ]);
      expect(items).toEqual([
        expect.objectContaining({ statement: 'Destanlar sözlü gelenekte oluşur.', correctAnswer: 'D' }),
        expect.objectContaining({ statement: 'Mesneviler tek dörtlükten oluşur.', correctAnswer: 'Y' }),
      ]);
    });

    it('extracts checkbox and ordering items', () => {
      expect(extractCheckboxItems([
        { text: 'Yanındaki kutucuğu işaretleyiniz.' },
        { text: '☑ Doğru bilgi' },
        { text: '☐ Yanlış bilgi' },
      ])).toEqual([
        expect.objectContaining({ text: 'Doğru bilgi', correctAnswer: true }),
        expect.objectContaining({ text: 'Yanlış bilgi', correctAnswer: false }),
      ]);

      expect(extractOrderingItems([
        { text: '1. İlk olay' },
        { text: '2. İkinci olay' },
      ])).toEqual([
        expect.objectContaining({ text: 'İlk olay', correctOrder: 1 }),
        expect.objectContaining({ text: 'İkinci olay', correctOrder: 2 }),
      ]);
    });

    it('detects dotted blank segments for masking', () => {
      const segments = findDottedBlankSegments([
        { text: '1. Gazelin en yaygın nazım şekli .....', x: 100, y: 200, width: 400, height: 18 },
      ]);
      expect(segments[0]).toEqual(expect.objectContaining({ x: expect.any(Number), y: 200, width: expect.any(Number) }));
    });

    it('builds storyboard json pages for drag-drop and notes', () => {
      const config = buildStoryboardConfig({
        document: 'output_cleaned.pdf',
        pages: [{
          pageNumber: 9,
          lines: [
            { text: 'YAZILIMCIYA NOT: Seslendirme ile açılacak.' },
            { text: 'Divan edebiyatıyla ilgili verilen ifadelerin sonundaki boş bırakılan yerlere uygun kavramları sürükleyiniz.' },
            { text: '1. Divan şiirinin en yaygın nazım şeklidir .....' },
            { text: 'Sürüklenebilir Ögeler' },
            { text: 'Gazel' },
            { text: 'Şarkı' },
            { text: 'Doğru eşleştirme: 1. Gazel' },
          ],
        }],
      });

      expect(config.pages[0]).toEqual(expect.objectContaining({
        interactionType: 'DragDrop',
        developerNote: expect.stringContaining('Seslendirme ile açılacak'),
      }));
      expect(config.pages[0].draggableItems).toContain('Gazel');
      expect(config.pages[0].dropZones[0]).toEqual(expect.objectContaining({ correctAnswer: 'Gazel' }));
    });
  });
});