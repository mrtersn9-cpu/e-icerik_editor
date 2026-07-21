import { patchActivity } from '../features/cevap/cevapActions';
import {
  cloneActivityForDuplicate,
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

describe('cloneActivityForDuplicate', () => {
  test('remaps cross-slide/object/layer trigger references to the fresh copy ids, but leaves activity-id and variable-id references untouched', () => {
    const slide1 = {
      id: 'slide-1',
      name: 'Soru',
      sceneName: 'Soru',
      activeLayerId: 'layer-1',
      layers: [
        { id: 'base', name: 'Base Layer', kind: 'base' },
        { id: 'layer-1', name: 'Cevap', kind: 'overlay' },
      ],
      objects: [
        { id: 'btn-1', type: 'button', label: 'Kontrol', layerId: 'base' },
        { id: 'drop-1', type: 'dropzone', label: 'Hedef', layerId: 'layer-1' },
      ],
      dragDropMatches: { 'btn-1': 'drop-1' },
      timeline: [{ id: 'tl-1', objectId: 'btn-1', keyframes: [{ id: 'kf-1', time: 0 }] }],
      triggers: [
        // object referansı ("Goster" -> value bir nesne id'sidir)
        { id: 'trg-object', target: 'btn-1', when: 'onClick', action: 'Goster', value: 'drop-1' },
        // katman referansı ("KatmanaGec" -> value bir katman id'sidir)
        { id: 'trg-layer', target: 'btn-1', when: 'onClick', action: 'KatmanaGec', value: 'layer-1' },
        // AYNI etkinlik içindeki başka bir SAHNE referansı ("SliderGec" -> value bir slide id'sidir)
        { id: 'trg-slide', target: 'btn-1', when: 'onClick', action: 'SliderGec', value: 'slide-2' },
        // BAŞKA bir ETKİNLİĞE referans ("SayfaGec" -> value bir activity id'sidir) — DEĞİŞMEMELİ
        { id: 'trg-activity', target: 'btn-1', when: 'onClick', action: 'SayfaGec', value: 'other-activity-id' },
        // DEĞİŞKEN referansı — DEĞİŞMEMELİ (değişkenler bu fonksiyonda yeniden üretilmiyor)
        { id: 'trg-variable', target: 'btn-1', when: 'onClick', action: 'DegiskenAta', value: 'var-1' },
      ],
    };
    const slide2 = { id: 'slide-2', name: 'Sonuç', objects: [] };
    const activity = {
      id: 'act-dup',
      name: 'Orijinal Etkinlik',
      currentSlideId: 'slide-1',
      startSlideId: 'slide-1',
      slides: [slide1, slide2],
      // Etkinlik köküne aynalanmış (materializeActivity tarafından yazılan) slide-1 verisi
      layers: slide1.layers,
      activeLayerId: slide1.activeLayerId,
      objects: slide1.objects,
      triggers: slide1.triggers,
      timeline: slide1.timeline,
      dragDropMatches: slide1.dragDropMatches,
    };

    const copy = cloneActivityForDuplicate(activity);

    // Etkinlik ve sahne id'leri yeni
    expect(copy.id).not.toBe(activity.id);
    expect(copy.slides).toHaveLength(2);
    expect(copy.slides[0].id).not.toBe('slide-1');
    expect(copy.slides[1].id).not.toBe('slide-2');
    expect(copy.currentSlideId).toBe(copy.slides[0].id);
    expect(copy.startSlideId).toBe(copy.slides[0].id);

    const newBtn = copy.slides[0].objects.find((object) => object.label === 'Kontrol');
    const newDrop = copy.slides[0].objects.find((object) => object.label === 'Hedef');
    expect(newBtn.id).not.toBe('btn-1');
    expect(newDrop.id).not.toBe('drop-1');

    const triggerByOldId = Object.fromEntries(
      slide1.triggers.map((trigger, index) => [trigger.id, copy.slides[0].triggers[index]])
    );

    // Nesne referansı yeni nesne id'sine güncellendi
    expect(triggerByOldId['trg-object'].value).toBe(newDrop.id);
    expect(triggerByOldId['trg-object'].value).not.toBe('drop-1');

    // Katman referansı yeni katman id'sine güncellendi (drop nesnesinin layerId'siyle aynı katman)
    expect(triggerByOldId['trg-layer'].value).toBe(newDrop.layerId);
    expect(triggerByOldId['trg-layer'].value).not.toBe('layer-1');

    // Aynı etkinlik içindeki sahne referansı yeni sahne id'sine güncellendi
    expect(triggerByOldId['trg-slide'].value).toBe(copy.slides[1].id);
    expect(triggerByOldId['trg-slide'].value).not.toBe('slide-2');

    // Başka bir etkinliğe referans DEĞİŞMEDİ (o etkinlik kopyalanmıyor)
    expect(triggerByOldId['trg-activity'].value).toBe('other-activity-id');

    // Değişken referansı DEĞİŞMEDİ
    expect(triggerByOldId['trg-variable'].value).toBe('var-1');

    // dragDropMatches ve timeline yeni nesne id'lerine göre güncellendi
    expect(Object.keys(copy.slides[0].dragDropMatches)).toEqual([newBtn.id]);
    expect(copy.slides[0].dragDropMatches[newBtn.id]).toBe(newDrop.id);
    expect(copy.slides[0].timeline[0].objectId).toBe(newBtn.id);

    // Etkinlik köküne aynalanan alanlar güncel sahneyle senkron (bayat id kalmıyor)
    expect(copy.objects).toEqual(copy.slides[0].objects);
    expect(copy.triggers).toEqual(copy.slides[0].triggers);

    // Orijinal etkinlik değişmedi (saf/immutable kopyalama)
    expect(activity.slides[0].id).toBe('slide-1');
    expect(activity.slides[0].objects[0].id).toBe('btn-1');
    expect(activity.slides[0].triggers[0].value).toBe('drop-1');
  });
});
