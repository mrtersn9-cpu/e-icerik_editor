import {
  addQuickChoices,
  convertMatchingToDragDrop,
  ensureTrueFalseChoices,
  migrateMcOptionsToChoices,
  removeChoice,
  setChoiceCorrect,
  tagObjectAsChoice,
  untagObjectAsChoice,
} from '../features/cevap/cevapActions';
import { evaluateStorylineRuntimeSelection } from '../utils/storylineRuntimeEngine';

// Freeform (Articulate) cevap modeli: bir "seçenek" = selectionQuestionId etiketli nesne.
// Doğruluk nesnenin selectionCorrect alanında; mcOptions her zaman boşaltılır.

function capture(fn) {
  let next = null;
  fn((value) => {
    next = value;
  });
  return next;
}

const findObj = (activity, id) => activity.objects.find((object) => object.id === id);

describe('freeform seçenek yardımcıları', () => {
  test('tagObjectAsChoice: herhangi bir nesneyi seçenek yapar, mcOptions boşalır', () => {
    const activity = {
      id: 'a',
      mcOptions: [{ id: 'x', label: 'eski', isCorrect: true }],
      objects: [{ id: 't1', type: 'text', label: 'Elma' }],
    };
    const next = capture((onUpdate) => tagObjectAsChoice(activity, onUpdate, 't1'));
    const tagged = findObj(next, 't1');
    expect(tagged.selectionQuestionId).toBeTruthy();
    expect(tagged.selectionCorrect).toBe(false);
    expect(tagged.selectionChoice).toBe('Elma');
    expect(next.mcOptions).toEqual([]);
  });

  test('setChoiceCorrect tekli mod: radyo gibi diğerlerini sıfırlar', () => {
    const activity = {
      id: 'a',
      mcMode: 'single',
      objects: [
        { id: 'c1', selectionQuestionId: 'q', selectionCorrect: true },
        { id: 'c2', selectionQuestionId: 'q', selectionCorrect: false },
      ],
    };
    const next = capture((onUpdate) => setChoiceCorrect(activity, onUpdate, 'c2', true));
    expect(findObj(next, 'c1').selectionCorrect).toBe(false);
    expect(findObj(next, 'c2').selectionCorrect).toBe(true);
  });

  test('setChoiceCorrect çoklu mod: yalnızca hedefi değiştirir', () => {
    const activity = {
      id: 'a',
      mcMode: 'multi',
      objects: [
        { id: 'c1', selectionQuestionId: 'q', selectionCorrect: true },
        { id: 'c2', selectionQuestionId: 'q', selectionCorrect: false },
      ],
    };
    const next = capture((onUpdate) => setChoiceCorrect(activity, onUpdate, 'c2', true));
    expect(findObj(next, 'c1').selectionCorrect).toBe(true);
    expect(findObj(next, 'c2').selectionCorrect).toBe(true);
  });

  test('removeChoice: üretilmiş seçeneği siler, etiketlenmiş nesneyi yalnızca rolünden çıkarır', () => {
    const generated = capture((onUpdate) =>
      removeChoice(
        { id: 'a', objects: [{ id: 'g', selectionQuestionId: 'q', generatedBy: 'selection-option' }, { id: 'keep', type: 'text' }] },
        onUpdate,
        'g'
      )
    );
    expect(findObj(generated, 'g')).toBeUndefined();
    expect(findObj(generated, 'keep')).toBeTruthy();

    const untagged = capture((onUpdate) =>
      removeChoice(
        { id: 'a', objects: [{ id: 'u', type: 'text', label: 'X', selectionQuestionId: 'q', selectionCorrect: true }] },
        onUpdate,
        'u'
      )
    );
    const obj = findObj(untagged, 'u');
    expect(obj).toBeTruthy();
    expect(obj.selectionQuestionId).toBeUndefined();
    expect(obj.selectionCorrect).toBeUndefined();
  });

  test('untagObjectAsChoice: cevap alanlarını temizler, nesneyi korur', () => {
    const next = capture((onUpdate) =>
      untagObjectAsChoice(
        { id: 'a', objects: [{ id: 'u', type: 'image', selectionQuestionId: 'q', selectionCorrect: true, optionFeedback: 'x' }] },
        onUpdate,
        'u'
      )
    );
    const obj = findObj(next, 'u');
    expect(obj.type).toBe('image');
    expect(obj.selectionQuestionId).toBeUndefined();
    expect(obj.optionFeedback).toBeUndefined();
  });

  test('addQuickChoices: N seçenek nesnesi ekler', () => {
    const next = capture((onUpdate) => addQuickChoices({ id: 'a', objects: [], mcOptions: [] }, onUpdate, 3));
    expect(next.objects.filter((object) => object.selectionQuestionId)).toHaveLength(3);
    expect(next.mcOptions).toEqual([]);
  });

  test('migrateMcOptionsToChoices: form verisini nesneye doğurur, mcOptions boşalır, idempotenttir', () => {
    const patch = migrateMcOptionsToChoices({
      id: 'a',
      objects: [],
      mcOptions: [
        { id: 'o1', label: 'Doğru', isCorrect: true },
        { id: 'o2', label: 'Yanlış', isCorrect: false },
      ],
    });
    expect(patch.mcOptions).toEqual([]);
    expect(patch.objects.filter((object) => object.selectionQuestionId)).toHaveLength(2);
    // İkinci çağrı (nesneler hazır, mcOptions boş) -> yapacak iş yok.
    expect(migrateMcOptionsToChoices({ id: 'a', objects: patch.objects, mcOptions: [] })).toBeNull();
  });

  test('ensureTrueFalseChoices: sahnede yoksa Doğru/Yanlış seçenekleri üretir', () => {
    const next = capture((onUpdate) =>
      ensureTrueFalseChoices({ id: 'a', objects: [], answerControl: {} }, onUpdate)
    );
    const choices = next.objects.filter((object) => object.selectionQuestionId);
    expect(choices).toHaveLength(2);
    expect(next.answerControl.activityKind).toBe('true-false');
    expect(choices.filter((object) => object.selectionCorrect)).toHaveLength(1);
  });

  test('convertMatchingToDragDrop: çiftler draggable+dropzone nesnelerine göçer', () => {
    const patch = convertMatchingToDragDrop({
      id: 'a',
      objects: [],
      matchingPairs: [
        { id: 'p1', left: 'Elma', right: 'Apple' },
        { id: 'p2', left: 'Armut', right: 'Pear' },
      ],
    });
    expect(patch.matchingPairs).toEqual([]);
    expect(patch.dragDropMode).toBe('single');
    expect(patch.objects.filter((object) => object.type === 'draggable')).toHaveLength(2);
    expect(patch.objects.filter((object) => object.type === 'dropzone')).toHaveLength(2);
    expect(Object.keys(patch.dragDropMatches)).toHaveLength(2);
    // İdempotent: nesneler varken yalnızca eski matchingPairs temizlenir.
    expect(convertMatchingToDragDrop({ id: 'a', objects: patch.objects, matchingPairs: [] })).toBeNull();
  });

  test('uçtan uca: mcOptions boşken eval selectionCorrect ile derecelendirir', () => {
    const slide = {
      id: 's',
      mcOptions: [],
      objects: [
        { id: 'c1', selectionQuestionId: 'q', selectionChoice: 'A', selectionCorrect: true },
        { id: 'c2', selectionQuestionId: 'q', selectionChoice: 'B', selectionCorrect: false },
      ],
    };
    const ok = evaluateStorylineRuntimeSelection({
      slide,
      objects: slide.objects,
      state: { objectStates: { c1: { selected: true } } },
    });
    expect(ok.success).toBe(true);
    const wrong = evaluateStorylineRuntimeSelection({
      slide,
      objects: slide.objects,
      state: { objectStates: { c2: { selected: true } } },
    });
    expect(wrong.success).toBe(false);
  });
});
