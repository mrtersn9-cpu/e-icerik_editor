import { buildStorylineRuntimeDeck } from '../utils/storylineRuntime';

describe('storyline runtime deck', () => {
  test('prefers materialized activity state for the current slide', () => {
    const state = {
      selActId: 'act-1',
      activities: [
        {
          id: 'act-1',
          currentSlideId: 'slide-1',
          objects: [
            { id: 'drag-a', type: 'draggable', x: 10, y: 20 },
            { id: 'drag-b', type: 'draggable', x: 120, y: 20 },
          ],
          slides: [
            {
              id: 'slide-1',
              objects: [
                { id: 'dup', type: 'draggable', x: 0, y: 0 },
                { id: 'dup', type: 'draggable', x: 40, y: 0 },
              ],
            },
          ],
        },
      ],
    };

    const deck = buildStorylineRuntimeDeck(state);

    expect(deck).toHaveLength(1);
    expect(deck[0].objects.map((object) => object.id)).toEqual(['drag-a', 'drag-b']);
  });

  test('assigns stable runtime ids to exported slide objects', () => {
    const state = {
      selActId: 'act-1',
      activities: [
        {
          id: 'act-1',
          currentSlideId: 'slide-1',
          slides: [
            {
              id: 'slide-1',
              objects: [
                { id: 'same-id', type: 'draggable', x: 0, y: 0 },
                { id: 'same-id', type: 'draggable', x: 50, y: 0 },
                { id: 'drop-a', type: 'dropzone', x: 120, y: 0 },
              ],
            },
          ],
        },
      ],
    };

    const [slide] = buildStorylineRuntimeDeck(state);

    expect(slide.objects.map((object) => object.__runtimeId)).toEqual([
      'slide-1__same-id__1__0',
      'slide-1__same-id__2__1',
      'slide-1__drop-a__1__2',
    ]);
  });

  test('carries drag-drop answer mode into runtime slides', () => {
    const deck = buildStorylineRuntimeDeck({
      activities: [
        {
          id: 'activity-1',
          type: 'drag-drop',
          dragDropMode: 'multi-group',
          dragDropSettings: { allowMultipleItemsPerDrop: true },
          dragDropMatches: { drag1: 'drop1', drag2: 'drop1' },
          objects: [
            { id: 'drag1', type: 'draggable', label: 'A', group: 'A' },
            { id: 'drag2', type: 'draggable', label: 'A', group: 'A' },
            { id: 'drop1', type: 'dropzone', label: 'Hedef', group: 'A' },
          ],
        },
      ],
      selActId: 'activity-1',
    });

    expect(deck[0]).toMatchObject({
      dragDropMode: 'multi-group',
      dragDropSettings: { allowMultipleItemsPerDrop: true },
      dragDropMatches: { drag1: 'drop1', drag2: 'drop1' },
    });
  });

  test('carries typed activity data required by SCORM evaluation', () => {
    const [slide] = buildStorylineRuntimeDeck({
      selActId: 'mixed-1',
      activities: [
        {
          id: 'mixed-1',
          type: 'mixed',
          mixedItems: [{ id: 'item-1', type: 'text-entry', acceptedAnswers: ['Ankara'] }],
          fillBlankSentence: 'Başkent ___ şehridir.',
          fillBlankAnswers: [{ id: 'blank-0', acceptedValues: ['Ankara'] }],
          puzzleType: 'crossword',
          puzzleGrid: { rows: 1, cols: 1, cells: [[{ letter: 'A' }]] },
          puzzlePlaced: [{ id: 'p-1', question: 'Başkent', startRow: 0, startCol: 0 }],
          hotspotImage: 'data:image/png;base64,test',
          hotspotImageAlt: 'Türkiye haritası',
        },
      ],
    });

    expect(slide).toMatchObject({
      type: 'mixed',
      mixedItems: [{ id: 'item-1', type: 'text-entry', acceptedAnswers: ['Ankara'] }],
      fillBlankSentence: 'Başkent ___ şehridir.',
      puzzleType: 'crossword',
      puzzleGrid: { rows: 1, cols: 1 },
      hotspotImageAlt: 'Türkiye haritası',
    });
  });

  test('can/hak ayarlarını answerControl içinde SCORM deck’ine taşır', () => {
    const [slide] = buildStorylineRuntimeDeck({
      selActId: 'sel-1',
      activities: [
        {
          id: 'sel-1',
          type: 'selection',
          answerControl: {
            livesEnabled: true,
            livesCount: 4,
            livesIconId: 'star',
            livesBehaviorOnZero: 'restart',
            correctAnswers: ['A'],
          },
          mcOptions: [{ id: 'A', label: 'A', isCorrect: true }],
        },
      ],
    });
    expect(slide.answerControl).toMatchObject({
      livesEnabled: true,
      livesCount: 4,
      livesIconId: 'star',
      livesBehaviorOnZero: 'restart',
    });
    // Cevap anahtarı alanı (correctAnswers) runtime'a taşınmamalı.
    expect(slide.answerControl.correctAnswers).toBeUndefined();
  });

  test('can kapalıyken answerControl boş taşınır', () => {
    const [slide] = buildStorylineRuntimeDeck({
      selActId: 'sel-2',
      activities: [{ id: 'sel-2', type: 'selection', answerControl: { maxAttempts: 3 }, mcOptions: [] }],
    });
    expect(slide.answerControl).toEqual({});
  });
});
