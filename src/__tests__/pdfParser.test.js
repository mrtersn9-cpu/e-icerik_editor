import {
  normalizePdfText,
  sanitizePdfText,
  extractPdfDragTerms,
  extractPdfAnswerTerms,
  extractPdfQuestionAnchors,
  detectPdfInteractionType,
} from '../pdfParser';

describe('pdfParser utilities', () => {
  test('normalizePdfText converts Turkish characters and trims whitespace', () => {
    expect(normalizePdfText('  Çalışma Örneği  ')).toBe('calisma ornegi');
  });

  test('sanitizePdfText removes trailing nulls and extra spaces', () => {
    expect(sanitizePdfText('  test\u0000\u0000  ')).toBe('test');
  });

  test('extractPdfDragTerms skips non-term lines and list prefixes', () => {
    const lines = [
      { text: 'Suruklenebilir Ogeler' },
      { text: '1) kapi' },
      { text: '2) pencere' },
      { text: 'E-icerik' },
    ];
    expect(extractPdfDragTerms(lines)).toEqual(['kapi', 'pencere']);
  });

  test('extractPdfAnswerTerms parses answer sections', () => {
    const lines = [{ text: 'Dogru eslestirme:' }, { text: '1) A 2) B 3) C' }];
    expect(extractPdfAnswerTerms(lines)).toEqual(['A', 'B', 'C']);
  });

  test('extractPdfQuestionAnchors returns ordered anchors', () => {
    const anchors = extractPdfQuestionAnchors([
      { text: '1.', x: 50, y: 10, width: 20, height: 12 },
      { text: '2.', x: 60, y: 30, width: 20, height: 12 },
    ]);
    expect(anchors[0].order).toBe(1);
    expect(anchors[1].order).toBe(2);
  });

  test('detectPdfInteractionType identifies DragDrop and Checkbox', () => {
    expect(detectPdfInteractionType([{ text: 'Suruklenebilir ogeler' }])).toBe('DragDrop');
    expect(detectPdfInteractionType([{ text: 'Kutucugu isaretleyiniz' }])).toBe('Checkbox');
  });
});
