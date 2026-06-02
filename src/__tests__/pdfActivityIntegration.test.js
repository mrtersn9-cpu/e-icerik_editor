import { createActivity } from '../logic/factories';
import {
  applyPdfIntegrationToActivity,
  buildPdfIntegrationPlan,
  findDuplicatePdfIntegration,
  getLargestEtkinlikNumber,
  hashPdfIntegrationContent,
  sanitizeSvgForPdfIntegration,
} from '../utils/pdfActivityIntegration';

describe('PDF activity integration helpers', () => {
  const book = { id: 'book-1', name: '5. Sınıf Matematik' };

  test('finds the largest existing Etkinlik number inside the book', () => {
    expect(
      getLargestEtkinlikNumber(
        [
          { bookId: 'book-1', name: 'Etkinlik 1' },
          { bookId: 'book-1', name: 'Etkinlik 12' },
          { bookId: 'book-2', name: 'Etkinlik 99' },
          { bookId: 'book-1', name: 'Alıştırma 20' },
        ],
        'book-1'
      )
    ).toBe(12);
  });

  test('skips excluded, deleted and duplicate pages without consuming activity numbers', () => {
    const hash = hashPdfIntegrationContent('<svg><text>A</text></svg>');
    const existing = {
      id: 'activity-existing',
      bookId: book.id,
      name: 'Etkinlik 1',
      integratedPdfSource: {
        bookId: book.id,
        bookName: book.name,
        pdfPageId: `pdf:math:page:1:${hash}`,
        originalPageNumber: 1,
        pageHash: hash,
      },
    };
    const plan = buildPdfIntegrationPlan({
      book,
      activities: [existing],
      pages: [
        {
          bookId: book.id,
          bookName: book.name,
          pageNumber: 1,
          originalPageNumber: 1,
          include: true,
          flow: 'new',
          pdfPageId: `pdf:math:page:1:${hash}`,
          pageHash: hash,
        },
        { pageNumber: 2, originalPageNumber: 2, include: false, flow: 'new' },
        {
          pageNumber: 3,
          originalPageNumber: 3,
          include: false,
          deleted: true,
          flow: 'new',
        },
        { pageNumber: 4, originalPageNumber: 4, include: true, flow: 'new', pageHash: 'hash_3' },
        {
          pageNumber: 5,
          originalPageNumber: 5,
          include: true,
          flow: 'continue',
          pageHash: 'hash_4',
        },
      ],
    });

    expect(plan.duplicateCount).toBe(1);
    expect(plan.excludedCount).toBe(2);
    expect(plan.createEntries.map((entry) => entry.activityName)).toEqual([
      'Etkinlik 2',
      'Etkinlik 3',
    ]);
    expect(plan.createEntries[0].hasBackButton).toBe(false);
    expect(plan.createEntries[0].hasForwardButton).toBe(true);
    expect(plan.createEntries[1].hasBackButton).toBe(true);
    expect(plan.createEntries[1].hasForwardButton).toBe(false);
  });

  test('detects duplicate by book name, original page number and hash', () => {
    const duplicate = findDuplicatePdfIntegration(
      {
        bookName: book.name,
        originalPageNumber: 7,
        pageHash: 'hash_same',
      },
      [
        {
          id: 'activity-7',
          name: 'Etkinlik 7',
          slides: [
            {
              integratedPdfSource: {
                bookName: book.name,
                originalPageNumber: 7,
                pageHash: 'hash_same',
              },
            },
          ],
        },
      ],
      book
    );

    expect(duplicate.activityName).toBe('Etkinlik 7');
  });

  test('adds PDF SVG only to practice slide and places nav buttons on correct layers', () => {
    const base = createActivity('Etkinlik 2', 'selection');
    const integrated = applyPdfIntegrationToActivity(
      { ...base, bookId: book.id },
      {
        activityName: 'Etkinlik 2',
        originalPageNumber: 2,
        groupId: 'group-1',
        groupIndex: 1,
        groupSize: 3,
        hasBackButton: true,
        hasForwardButton: true,
        page: {
          bookId: book.id,
          bookName: book.name,
          pdfPageId: 'pdf:math:page:2:hash',
          pageHash: 'hash',
          svgContent: '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
        },
      },
      { previousActivityId: 'prev-activity', nextActivityId: 'next-activity' }
    );

    expect(integrated.slides[0].svgMarkup).toBe('');
    expect(integrated.slides[1].svgMarkup).toBe('');
    expect(integrated.slides[2].svgMarkup).toContain('<svg');
    expect(integrated.slides[2].background.type).toBe('pdf-integrated-svg');
    expect(integrated.slides[2].integratedPdfSource.originalPageNumber).toBe(2);

    const back = integrated.slides[2].objects.find((object) => object.label === 'Geri');
    const forward = integrated.slides[2].objects.find((object) => object.label === 'İleri');
    expect(back.layerId).toBe('base');
    expect(forward.layerId).not.toBe('base');
    expect(
      integrated.slides[2].triggers.some(
        (trigger) => trigger.action === 'SayfaGec' && trigger.value === 'next-activity'
      )
    ).toBe(true);
  });

  test('reports and removes risky SVG content', () => {
    const { svgContent, sanitizeReport } = sanitizeSvgForPdfIntegration(
      '<svg onload="alert(1)"><script>alert(1)</script><foreignObject /><a href="javascript:bad()">x</a><image href="https://example.com/a.png" /></svg>'
    );

    expect(svgContent).not.toMatch(/script|foreignObject|onload|javascript:/i);
    expect(sanitizeReport.removedScripts).toBe(1);
    expect(sanitizeReport.removedEventHandlers).toBe(1);
    expect(sanitizeReport.removedForeignObjects).toBe(1);
    expect(sanitizeReport.externalReferences).toEqual(['https://example.com/a.png']);
  });
});
