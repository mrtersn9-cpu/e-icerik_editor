import { defaultsForType } from '../features/cevap/panels/KarmaCevapPanel';

describe('KarmaCevapPanel — defaultsForType', () => {
  it('selection tipi için en az 2 boş/örnek seçenek döner', () => {
    const result = defaultsForType('selection');
    expect(Array.isArray(result.options)).toBe(true);
    expect(result.options.length).toBeGreaterThanOrEqual(2);
    result.options.forEach((opt) => {
      expect(opt).toHaveProperty('id');
      expect(opt).toHaveProperty('label');
      expect(opt).toHaveProperty('isCorrect');
    });
    expect(result.pairs).toBeUndefined();
    expect(result.acceptedAnswers).toBeUndefined();
    expect(result.sentence).toBeUndefined();
  });

  it('drag-drop tipi için en az 1 eşleştirme çifti döner', () => {
    const result = defaultsForType('drag-drop');
    expect(Array.isArray(result.pairs)).toBe(true);
    expect(result.pairs.length).toBeGreaterThanOrEqual(1);
    result.pairs.forEach((pair) => {
      expect(pair).toHaveProperty('id');
      expect(pair).toHaveProperty('left');
      expect(pair).toHaveProperty('right');
    });
    expect(result.options).toBeUndefined();
  });

  it('text-entry tipi için tek boş kabul edilen cevap döner', () => {
    const result = defaultsForType('text-entry');
    expect(result.acceptedAnswers).toEqual(['']);
  });

  it('numeric tipi için varsayılan "0" kabul edilen cevap döner', () => {
    const result = defaultsForType('numeric');
    expect(result.acceptedAnswers).toEqual(['0']);
  });

  it('fill-blank tipi için varsayılan cümle döner', () => {
    const result = defaultsForType('fill-blank');
    expect(typeof result.sentence).toBe('string');
    expect(result.sentence.length).toBeGreaterThan(0);
  });

  it('bilinmeyen tip için boş obje döner (alanları sessizce silmez ama ekstra da uydurmaz)', () => {
    expect(defaultsForType('bilinmeyen-tip')).toEqual({});
  });

  it('her çağrıda benzersiz id üretir (referans paylaşımı yok)', () => {
    const a = defaultsForType('selection');
    const b = defaultsForType('selection');
    expect(a.options[0].id).not.toBe(b.options[0].id);
  });

  it('tip değiştirme senaryosu: selection -> drag-drop geçişinde options silinir, pairs dolu gelir', () => {
    const existingItem = {
      id: 'item-1',
      type: 'selection',
      question: 'Soru?',
      options: [{ id: 'o1', label: 'A', isCorrect: true }],
    };
    const nextType = 'drag-drop';
    const next = { id: existingItem.id, type: nextType, question: existingItem.question, ...defaultsForType(nextType) };

    expect(next.options).toBeUndefined();
    expect(next.pairs.length).toBeGreaterThanOrEqual(1);
    expect(next.question).toBe('Soru?');
  });
});
