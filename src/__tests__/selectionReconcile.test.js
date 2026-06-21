import { reconcileSelectionObjects } from '../features/cevap/cevapActions';

// reconcileSelectionObjects: seçeneklerden interaktif sahne nesnelerini üretir/günceller.
// Çekirdek garanti: elle taşıma/boyut KORUNUR; ekle/sil yalnızca ilgili nesneyi etkiler.

const opt = (id, label, isCorrect = false) => ({ id, label, isCorrect });

describe('reconcileSelectionObjects', () => {
  test('boş sahnede her seçenek için interaktif nesne üretir', () => {
    const activity = { id: 'a1', objects: [] };
    const objects = reconcileSelectionObjects(activity, [opt('o1', 'Elma', true), opt('o2', 'Armut')]);
    expect(objects).toHaveLength(2);
    objects.forEach((object) => {
      expect(object.selectionQuestionId).toBeTruthy();
      expect(object.layerId).toBe('base');
      expect(object.generatedBy).toBe('selection-option');
    });
    expect(objects[0].selectionOptionId).toBe('o1');
    expect(objects[0].selectionCorrect).toBe(true);
    expect(objects[1].selectionCorrect).toBe(false);
    // Doğru cevap stille vurgulanmaz (önizlemede önceden seçili görünmemeli).
    expect(objects[0].style.background).toBe(objects[1].style.background);
  });

  test('metin değişiminde label güncellenir, geometri SABİT kalır', () => {
    const activity = { id: 'a1', objects: [] };
    const first = reconcileSelectionObjects(activity, [opt('o1', 'Elma', true), opt('o2', 'Armut')]);
    // Kullanıcı ilk nesneyi elle taşıyıp boyutlandırmış gibi davran.
    const moved = first.map((object) =>
      object.selectionOptionId === 'o1'
        ? { ...object, x: 999, y: 888, width: 321, height: 77, answerPlacementManual: true }
        : object
    );
    const next = reconcileSelectionObjects(
      { ...activity, objects: moved },
      [opt('o1', 'Elma Değişti', true), opt('o2', 'Armut')]
    );
    const o1 = next.find((object) => object.selectionOptionId === 'o1');
    expect(o1.label).toContain('Elma Değişti');
    expect(o1.x).toBe(999);
    expect(o1.y).toBe(888);
    expect(o1.width).toBe(321);
    expect(o1.height).toBe(77);
    expect(o1.answerPlacementManual).toBe(true);
  });

  test('seçenek eklemek mevcutları bozmaz; yeni nesne eklenir', () => {
    const activity = { id: 'a1', objects: [] };
    const first = reconcileSelectionObjects(activity, [opt('o1', 'Elma', true)]);
    const movedFirst = first.map((object) => ({ ...object, x: 50, y: 60 }));
    const next = reconcileSelectionObjects(
      { ...activity, objects: movedFirst },
      [opt('o1', 'Elma', true), opt('o2', 'Armut')]
    );
    expect(next).toHaveLength(2);
    const o1 = next.find((object) => object.selectionOptionId === 'o1');
    expect(o1.x).toBe(50);
    expect(o1.y).toBe(60);
    expect(next.find((object) => object.selectionOptionId === 'o2')).toBeTruthy();
  });

  test('seçenek silmek yalnızca o nesneyi kaldırır', () => {
    const activity = { id: 'a1', objects: [] };
    const first = reconcileSelectionObjects(activity, [opt('o1', 'Elma', true), opt('o2', 'Armut'), opt('o3', 'Kiraz')]);
    const next = reconcileSelectionObjects({ ...activity, objects: first }, [opt('o1', 'Elma', true), opt('o3', 'Kiraz')]);
    expect(next).toHaveLength(2);
    expect(next.find((object) => object.selectionOptionId === 'o2')).toBeUndefined();
    expect(next.find((object) => object.selectionOptionId === 'o1')).toBeTruthy();
    expect(next.find((object) => object.selectionOptionId === 'o3')).toBeTruthy();
  });

  test('doğru cevap değişimi selectionCorrect damgasını günceller, geometriyi korur', () => {
    const activity = { id: 'a1', objects: [] };
    const first = reconcileSelectionObjects(activity, [opt('o1', 'Elma', true), opt('o2', 'Armut')]);
    const geomBefore = first.map(({ id, x, y, width, height }) => ({ id, x, y, width, height }));
    const next = reconcileSelectionObjects({ ...activity, objects: first }, [opt('o1', 'Elma', false), opt('o2', 'Armut', true)]);
    expect(next.find((object) => object.selectionOptionId === 'o1').selectionCorrect).toBe(false);
    expect(next.find((object) => object.selectionOptionId === 'o2').selectionCorrect).toBe(true);
    next.forEach((object) => {
      const before = geomBefore.find((g) => g.id === object.id);
      if (before) {
        expect(object.x).toBe(before.x);
        expect(object.y).toBe(before.y);
      }
    });
  });

  test('seçenek olmayan nesneler korunur', () => {
    const other = { id: 'shape-1', type: 'shape', layerId: 'base', label: 'Başlık' };
    const activity = { id: 'a1', objects: [other] };
    const next = reconcileSelectionObjects(activity, [opt('o1', 'Elma', true)]);
    expect(next.find((object) => object.id === 'shape-1')).toEqual(other);
    expect(next.filter((object) => object.selectionQuestionId)).toHaveLength(1);
  });

  test('tüm seçenekler kaldırılınca seçim nesneleri temizlenir', () => {
    const activity = { id: 'a1', objects: [] };
    const first = reconcileSelectionObjects(activity, [opt('o1', 'Elma', true)]);
    const next = reconcileSelectionObjects({ ...activity, objects: first }, []);
    expect(next.filter((object) => object.selectionQuestionId)).toHaveLength(0);
  });

  test('görsel ve seçeneğe özel geri bildirim nesneye taşınır ve güncellenir', () => {
    const activity = { id: 'a1', objects: [] };
    const first = reconcileSelectionObjects(activity, [
      { id: 'o1', label: 'Elma', isCorrect: true, image: 'data:image/png;base64,AAA', feedback: 'Doğru şık' },
    ]);
    expect(first[0].imageData).toContain('data:image');
    expect(first[0].optionFeedback).toBe('Doğru şık');
    // Güncelleme: görsel kaldırılır, feedback değişir; nesne aynı kalır.
    const next = reconcileSelectionObjects({ ...activity, objects: first }, [
      { id: 'o1', label: 'Elma', isCorrect: true, image: '', feedback: 'Yeni mesaj' },
    ]);
    const o1 = next.find((object) => object.selectionOptionId === 'o1');
    expect(o1.imageData).toBeNull();
    expect(o1.optionFeedback).toBe('Yeni mesaj');
  });
});
