import { patchActivity } from '../features/cevap/cevapActions';
import {
  commitMaterializedActivity,
  materializeActivitySlide,
  pasteActivitySlide,
} from '../logic/activityHelpers';
import { normalizeActivity } from '../logic/stateNormalizer';

describe('materializeActivitySlide', () => {
  test('answer panel item patches update the active slide immediately', () => {
    const activity = {
      id: 'act-answer-panel',
      type: 'matching',
      currentSlideId: 'slide-1',
      matchingPairs: [],
      slides: [{ id: 'slide-1', name: 'Soru', matchingPairs: [], objects: [] }],
    };
    const nextPairs = [{ id: 'pair-1', left: 'Left', right: 'Right' }];
    let updated = null;

    patchActivity(activity, (next) => {
      updated = next;
    }, { matchingPairs: nextPairs });

    expect(updated.matchingPairs).toEqual(nextPairs);
    expect(updated.slides[0].matchingPairs).toEqual(nextPairs);
  });

  test('commits typed answer item changes to the active slide', () => {
    const activity = {
      id: 'act-sequence',
      type: 'sequence',
      currentSlideId: 'slide-1',
      sequenceItems: [
        { id: 'step-1', label: 'First', order: 1 },
        { id: 'step-2', label: 'Second', order: 2 },
      ],
      sequenceShuffle: false,
      slides: [
        {
          id: 'slide-1',
          name: 'Soru',
          sequenceItems: [{ id: 'old-step', label: 'Old', order: 1 }],
          sequenceShuffle: true,
          objects: [],
        },
      ],
    };

    const committed = commitMaterializedActivity(activity);

    expect(committed.slides[0].sequenceItems).toEqual(activity.sequenceItems);
    expect(committed.slides[0].sequenceShuffle).toBe(false);
    expect(materializeActivitySlide(committed, 'slide-1')).toMatchObject({
      sequenceItems: activity.sequenceItems,
      sequenceShuffle: false,
    });
  });

  test('keeps root typed answer data when loading a legacy slide without those fields', () => {
    const activity = {
      id: 'act-matching',
      type: 'matching',
      currentSlideId: 'slide-1',
      matchingPairs: [{ id: 'pair-1', left: 'A', right: 'B' }],
      matchingShuffle: false,
      slides: [
        {
          id: 'slide-1',
          name: 'Soru',
          objects: [],
        },
      ],
    };

    const normalized = normalizeActivity(activity);

    expect(normalized.matchingPairs).toEqual(activity.matchingPairs);
    expect(normalized.matchingShuffle).toBe(false);
  });

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

  test('pastes a copied slide after the current slide and selects the new copy', () => {
    const source = {
      id: 'slide-1',
      name: 'Soru',
      sceneName: 'Soru',
      objects: [{ id: 'text-1', type: 'text', label: 'Soru', layerId: 'base' }],
    };
    const activity = {
      id: 'act-1',
      currentSlideId: 'slide-1',
      slides: [source, { id: 'slide-2', name: 'Sonuc', objects: [] }],
    };

    const next = pasteActivitySlide(activity, source, 'slide-1');

    expect(next.slides).toHaveLength(3);
    expect(next.slides[1].id).not.toBe('slide-1');
    expect(next.slides[1].name).toContain('Kopya');
    expect(next.currentSlideId).toBe(next.slides[1].id);
  });

  test('pastes a copied slide with fresh object, trigger and answer ids', () => {
    const source = {
      id: 'slide-1',
      name: 'Soru',
      sceneName: 'Soru',
      activeLayerId: 'layer-1',
      layers: [
        { id: 'base', name: 'Base Layer', kind: 'base' },
        { id: 'layer-1', name: 'Cevap', kind: 'overlay' },
      ],
      objects: [
        { id: 'drag-1', type: 'draggable', label: 'A', layerId: 'base', groupId: 'grp-1' },
        { id: 'drop-1', type: 'dropzone', label: 'Hedef', layerId: 'layer-1', groupId: 'grp-1' },
        {
          id: 'btn-1',
          type: 'button',
          label: 'Kontrol',
          layerId: 'base',
          linkedActionTargetId: 'drop-1',
        },
      ],
      dragDropMatches: { 'drag-1': 'drop-1' },
      timeline: [{ id: 'tl-1', objectId: 'drag-1', keyframes: [{ id: 'kf-1', time: 0 }] }],
      triggers: [
        {
          id: 'trigger-1',
          target: 'btn-1',
          action: 'KatmanaGec',
          value: 'layer-1',
          conditions: [{ id: 'cond-1', sourceId: 'drag-1', value: 'drop-1' }],
        },
      ],
    };
    const activity = {
      id: 'act-2',
      currentSlideId: 'target-slide',
      slides: [{ id: 'target-slide', name: 'Hedef Etkinlik', objects: [] }],
    };

    const next = pasteActivitySlide(activity, source, 'target-slide');
    const pasted = next.slides[1];
    const pastedIds = pasted.objects.map((object) => object.id);

    expect(pasted.id).not.toBe(source.id);
    expect(pastedIds).not.toEqual(expect.arrayContaining(['drag-1', 'drop-1', 'btn-1']));
    expect(Object.keys(pasted.dragDropMatches)).not.toContain('drag-1');
    expect(Object.values(pasted.dragDropMatches)).not.toContain('drop-1');
    expect(pasted.timeline[0].objectId).toBe(pasted.objects[0].id);
    expect(pasted.triggers[0].target).toBe(pasted.objects[2].id);
    expect(pasted.triggers[0].value).not.toBe('layer-1');
    expect(pasted.layers.some((layer) => layer.id === pasted.triggers[0].value)).toBe(true);
    expect(pasted.triggers[0].conditions[0].sourceId).toBe(pasted.objects[0].id);
    expect(pasted.objects[2].linkedActionTargetId).toBe(pasted.objects[1].id);
  });
});
