import { materializeActivitySlide } from '../logic/activityHelpers';

describe('materializeActivitySlide', () => {
  test('keeps answer-control fields on the active slide', () => {
    const activity = {
      id: 'act1',
      type: 'drag-drop',
      currentSlideId: 'slide1',
      dragDropMode: 'multi-group',
      dragDropSettings: { allowMultipleItemsPerDrop: true },
      dragDropMatches: { drag1: 'drop1' },
      mcOptions: [{ id: 'a', isCorrect: true }],
      selectionSlots: [{ id: 'slot1', correctChoice: 'A' }],
      selectionUi: { controlMark: 'check' },
      slides: [
        {
          id: 'slide1',
          name: 'Soru',
          dragDropMode: 'multi-group',
          dragDropSettings: { allowMultipleItemsPerDrop: true },
          dragDropMatches: { drag1: 'drop1' },
          mcOptions: [{ id: 'a', isCorrect: true }],
          selectionSlots: [{ id: 'slot1', correctChoice: 'A' }],
          selectionUi: { controlMark: 'check' },
          objects: [
            { id: 'drag1', type: 'draggable', label: 'A', layerId: 'base' },
            { id: 'drop1', type: 'dropzone', label: 'Hedef', layerId: 'base' },
          ],
        },
      ],
    };

    expect(materializeActivitySlide(activity, 'slide1')).toMatchObject({
      dragDropMode: 'multi-group',
      dragDropSettings: { allowMultipleItemsPerDrop: true },
      dragDropMatches: { drag1: 'drop1' },
      mcOptions: [{ id: 'a', isCorrect: true }],
      selectionSlots: [{ id: 'slot1', correctChoice: 'A' }],
      selectionUi: { controlMark: 'check' },
    });
  });
});
