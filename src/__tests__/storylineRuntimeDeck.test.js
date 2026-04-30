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
});
