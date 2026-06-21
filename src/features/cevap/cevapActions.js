import { SLIDE_STATE_KEYS } from '../../constants';
import { createObjectFromActivity } from '../../logic/dragDrop';
import { createCanvasShapeObject } from '../../logic/factories';
import { uid } from '../../utils/editorHelpers';

export function patchActivity(activity, onUpdate, patch) {
  if (!activity || !onUpdate) return;
  const next = { ...activity, ...patch };
  // SLIDE_STATE_KEYS icerigini root ve slide arasinda senkronize tut
  const slideKeys = new Set(SLIDE_STATE_KEYS);
  const slidePatch = {};
  Object.keys(patch).forEach((key) => {
    if (slideKeys.has(key)) slidePatch[key] = patch[key];
  });
  if (Object.keys(slidePatch).length && Array.isArray(activity.slides) && activity.slides.length) {
    const targetId = activity.currentSlideId || activity.slides[0]?.id;
    next.slides = activity.slides.map((slide) =>
      slide.id === targetId ? { ...slide, ...slidePatch } : slide
    );
  }
  onUpdate(next);
}

function normalizeAnswerKey(value = '') {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]/g, '');
}

// Seçim seçeneklerinden sahnedeki interaktif nesneleri "reconcile" eder:
// - Eşleşen mevcut nesne -> yalnızca içerik (label/selectionCorrect/selectionChoice)
//   güncellenir; konum/boyut/stil (elle düzenlenebilen geometri) KORUNUR.
// - Yeni seçenek -> mevcut kardeşlerin x/width/height'ini miras alıp en alta yeni
//   interaktif nesne üretir.
// - Silinen seçenek -> yalnızca o nesne kaldırılır.
// Böylece "Sahneye Uygula" gibi manuel/yıkıcı bir adıma gerek kalmaz; üretim seçenek
// değişiminin doğal parçası olur.
const SELECTION_OPTION_LAYOUT = { startX: 120, startY: 160, width: 680, height: 64, gap: 12 };

export const SELECTION_OPTION_STYLE = {
  background: '#ffffff',
  borderColor: '#cbd5e1',
  color: '#1e293b',
  borderStyle: 'solid',
  borderRadius: 10,
  borderWidth: 1,
  fontSize: 22,
  fontWeight: 600,
  textAlign: 'left',
  paddingLeft: 16,
};

function getSelectionOptionLabel(option = {}, index = 0) {
  // Freeform: etiket temiz tutulur (harf öneki yok); şıkkın kendi metni kullanılır.
  return String(option.label || `Seçenek ${index + 1}`).trim();
}

function buildSelectionOptionObject(questionId, option, index, frame) {
  return {
    ...createCanvasShapeObject(
      getSelectionOptionLabel(option, index),
      frame.x,
      frame.y,
      frame.width,
      frame.height,
      SELECTION_OPTION_STYLE
    ),
    shapeKind: 'roundedRect',
    layerId: 'base',
    selectionQuestionId: questionId,
    selectionOptionId: option.id,
    selectionChoice: option.label || String.fromCharCode(65 + index),
    selectionCorrect: !!option.isCorrect,
    imageData: option.image || null,
    optionFeedback: option.feedback || '',
    generatedBy: 'selection-option',
    zIndex: frame.zIndex,
  };
}

export function reconcileSelectionObjects(activity = {}, nextOptions = []) {
  const objects = Array.isArray(activity.objects) ? activity.objects : [];
  const selectionObjects = objects.filter((item) => item?.selectionQuestionId);
  const nonSelection = objects.filter((item) => !item?.selectionQuestionId);

  // Seçenek kalmadıysa tüm seçim nesnelerini kaldır.
  if (!nextOptions.length) return nonSelection;

  const questionId = selectionObjects[0]?.selectionQuestionId || `mc-${activity.id || 'soru'}`;
  const sortedByY = [...selectionObjects].sort(
    (left, right) =>
      (Number(left.y) || 0) - (Number(right.y) || 0) ||
      (Number(left.x) || 0) - (Number(right.x) || 0)
  );

  const claimed = new Set();
  const claim = (obj) => {
    if (obj) claimed.add(obj.id);
    return obj;
  };
  const findMatch = (option) => {
    const byOptionId = sortedByY.find(
      (obj) => !claimed.has(obj.id) && obj.selectionOptionId === option.id
    );
    if (byOptionId) return claim(byOptionId);
    const key = normalizeAnswerKey(option.label);
    const byLabel =
      key &&
      sortedByY.find(
        (obj) =>
          !claimed.has(obj.id) &&
          !obj.selectionOptionId &&
          (normalizeAnswerKey(obj.selectionChoice) === key ||
            normalizeAnswerKey(obj.label) === key)
      );
    if (byLabel) return claim(byLabel);
    const positional = sortedByY.find((obj) => !claimed.has(obj.id));
    return positional ? claim(positional) : null;
  };

  const last = sortedByY[sortedByY.length - 1];
  const frameX = Number(last?.x) || SELECTION_OPTION_LAYOUT.startX;
  const frameW = Number(last?.width) || SELECTION_OPTION_LAYOUT.width;
  const frameH = Number(last?.height) || SELECTION_OPTION_LAYOUT.height;
  let nextY = last
    ? (Number(last.y) || 0) + frameH + SELECTION_OPTION_LAYOUT.gap
    : SELECTION_OPTION_LAYOUT.startY;
  let zCursor = objects.reduce((max, item) => Math.max(max, Number(item.zIndex) || 0), 0);

  const matchedById = new Map();
  const brandNew = [];
  nextOptions.forEach((option, index) => {
    const match = findMatch(option);
    if (match) {
      matchedById.set(match.id, {
        ...match,
        label: getSelectionOptionLabel(option, index),
        selectionQuestionId: match.selectionQuestionId || questionId,
        selectionOptionId: option.id,
        selectionChoice: option.label || String.fromCharCode(65 + index),
        selectionCorrect: !!option.isCorrect,
        imageData: option.image || null,
        optionFeedback: option.feedback || '',
      });
      return;
    }
    zCursor += 1;
    brandNew.push(
      buildSelectionOptionObject(questionId, option, index, {
        x: frameX,
        y: nextY,
        width: frameW,
        height: frameH,
        zIndex: zCursor,
      })
    );
    nextY += frameH + SELECTION_OPTION_LAYOUT.gap;
  });

  // Orijinal sırayı koru: seçim olmayan nesneler yerinde; eşleşen seçim nesneleri
  // güncellenmiş haliyle yerinde; eşleşmeyen (silinen) seçim nesneleri atlanır;
  // yeni üretilenler sona eklenir.
  const result = [];
  objects.forEach((item) => {
    if (!item?.selectionQuestionId) {
      result.push(item);
    } else if (matchedById.has(item.id)) {
      result.push(matchedById.get(item.id));
    }
  });
  return [...result, ...brandNew];
}

// ─── FREEFORM (Articulate) cevap modeli ─────────────────────────────────────
// Bir "seçenek" = base katmanda selectionQuestionId etiketli HERHANGİ bir nesne.
// Doğruluk yalnızca nesnenin selectionCorrect alanında tutulur; bu yüzden tüm
// freeform yardımcıları mcOptions'ı BOŞALTIR (eval, mcOptions boşken selectionCorrect'e
// bakar — getCorrectSelectionChoiceKeys null döner). Böylece nesneler tek doğru kaynaktır.

export function getSelectionQuestionId(activity = {}) {
  const objects = Array.isArray(activity.objects) ? activity.objects : [];
  const existing = objects.find((item) => item?.selectionQuestionId);
  return existing?.selectionQuestionId || `mc-${activity.id || 'soru'}`;
}

export function getChoiceObjects(activity = {}) {
  const objects = Array.isArray(activity.objects) ? activity.objects : [];
  return objects
    .filter((item) => item?.selectionQuestionId && (item.layerId || 'base') === 'base')
    .sort(
      (left, right) =>
        (Number(left.y) || 0) - (Number(right.y) || 0) ||
        (Number(left.x) || 0) - (Number(right.x) || 0)
    );
}

// Eski mcOptions kayıtlarını bir kez sahne nesnesine "doğurur", sonra mcOptions'ı
// boşaltır. İdempotent: choice nesnesi zaten varsa yalnızca mcOptions kalıntısını siler.
// Göçecek bir şey yoksa null döner (patch uygulanmaz).
export function migrateMcOptionsToChoices(activity = {}) {
  const objects = Array.isArray(activity.objects) ? activity.objects : [];
  const mcOptions = Array.isArray(activity.mcOptions) ? activity.mcOptions : [];
  const hasChoices = objects.some((item) => item?.selectionQuestionId);
  if (hasChoices) return mcOptions.length ? { mcOptions: [] } : null;
  if (!mcOptions.length) return null;
  return { objects: reconcileSelectionObjects(activity, mcOptions), mcOptions: [] };
}

export function applyMcOptionsMigration(activity, onUpdate) {
  const patch = migrateMcOptionsToChoices(activity);
  if (patch) patchActivity(activity, onUpdate, patch);
}

// Sahnedeki bir veya birden çok nesneyi seçenek yapar (sağ tık / ribbon / panel).
export function tagObjectsAsChoices(activity, onUpdate, ids = []) {
  const idSet = new Set(Array.isArray(ids) ? ids : [ids]);
  if (!idSet.size) return;
  const migration = migrateMcOptionsToChoices(activity);
  const baseObjects = migration?.objects || activity.objects || [];
  const questionId = getSelectionQuestionId({ ...activity, objects: baseObjects });
  const nextObjects = baseObjects.map((item) => {
    if (!idSet.has(item.id) || item.selectionQuestionId) return item;
    return {
      ...item,
      selectionQuestionId: questionId,
      selectionOptionId: item.selectionOptionId || uid(),
      selectionChoice: item.label || item.text || 'Seçenek',
      selectionCorrect: false,
    };
  });
  patchActivity(activity, onUpdate, { objects: nextObjects, mcOptions: [] });
}

export function tagObjectAsChoice(activity, onUpdate, objectId) {
  tagObjectsAsChoices(activity, onUpdate, [objectId]);
}

export function untagObjectAsChoice(activity, onUpdate, objectId) {
  const objects = Array.isArray(activity.objects) ? activity.objects : [];
  const nextObjects = objects.map((item) => {
    if (item.id !== objectId) return item;
    const next = { ...item };
    delete next.selectionQuestionId;
    delete next.selectionOptionId;
    delete next.selectionChoice;
    delete next.selectionCorrect;
    delete next.optionFeedback;
    if (next.generatedBy === 'selection-option') delete next.generatedBy;
    return next;
  });
  patchActivity(activity, onUpdate, { objects: nextObjects });
}

// Bir seçeneği doğru/yanlış işaretler. Tekli modda (radyo) aynı soru grubundaki
// diğerlerini sıfırlar.
export function setChoiceCorrect(activity, onUpdate, objectId, isCorrect) {
  const objects = Array.isArray(activity.objects) ? activity.objects : [];
  const target = objects.find((item) => item.id === objectId);
  if (!target) return;
  const multi = (activity.mcMode || 'single') === 'multi';
  const questionId = target.selectionQuestionId;
  const nextObjects = objects.map((item) => {
    if (item.id === objectId) return { ...item, selectionCorrect: !!isCorrect };
    if (!multi && isCorrect && item.selectionQuestionId === questionId) {
      return { ...item, selectionCorrect: false };
    }
    return item;
  });
  patchActivity(activity, onUpdate, { objects: nextObjects, mcOptions: [] });
}

// Bir seçenek nesnesinin alanlarını günceller (etiket/geri bildirim/görsel).
export function patchChoiceObject(activity, onUpdate, objectId, patch) {
  const objects = Array.isArray(activity.objects) ? activity.objects : [];
  const nextObjects = objects.map((item) => (item.id === objectId ? { ...item, ...patch } : item));
  patchActivity(activity, onUpdate, { objects: nextObjects });
}

// Seçeneği kaldırır: panelin ürettiği seçenek nesnesini tamamen siler; kullanıcının
// elle etiketlediği nesneyi yalnızca rolünden çıkarır (sahnede kalır).
export function removeChoice(activity, onUpdate, objectId) {
  const objects = Array.isArray(activity.objects) ? activity.objects : [];
  const target = objects.find((item) => item.id === objectId);
  if (!target) return;
  if (target.generatedBy === 'selection-option') {
    patchActivity(activity, onUpdate, {
      objects: objects.filter((item) => item.id !== objectId),
      mcOptions: [],
    });
    return;
  }
  untagObjectAsChoice(activity, onUpdate, objectId);
}

// "+ N boş seçenek ekle": mevcut seçeneklerin altına etiketli choice nesneleri ekler.
export function addQuickChoices(activity, onUpdate, count = 3) {
  const migration = migrateMcOptionsToChoices(activity);
  const baseObjects = migration?.objects || activity.objects || [];
  const questionId = getSelectionQuestionId({ ...activity, objects: baseObjects });
  const existingChoices = baseObjects
    .filter((item) => item?.selectionQuestionId && (item.layerId || 'base') === 'base')
    .sort((left, right) => (Number(left.y) || 0) - (Number(right.y) || 0));
  const last = existingChoices[existingChoices.length - 1];
  const frameX = Number(last?.x) || SELECTION_OPTION_LAYOUT.startX;
  const frameW = Number(last?.width) || SELECTION_OPTION_LAYOUT.width;
  const frameH = Number(last?.height) || SELECTION_OPTION_LAYOUT.height;
  let nextY = last
    ? (Number(last.y) || 0) + frameH + SELECTION_OPTION_LAYOUT.gap
    : SELECTION_OPTION_LAYOUT.startY;
  let zCursor = baseObjects.reduce((max, item) => Math.max(max, Number(item.zIndex) || 0), 0);
  const startIndex = existingChoices.length;
  const created = [];
  for (let i = 0; i < count; i += 1) {
    zCursor += 1;
    const index = startIndex + i;
    created.push(
      buildSelectionOptionObject(
        questionId,
        { id: uid(), label: `Seçenek ${index + 1}`, isCorrect: false },
        index,
        { x: frameX, y: nextY, width: frameW, height: frameH, zIndex: zCursor }
      )
    );
    nextY += frameH + SELECTION_OPTION_LAYOUT.gap;
  }
  patchActivity(activity, onUpdate, { objects: [...baseObjects, ...created], mcOptions: [] });
}

// Soru havuzundan kayıtlı bir soruyu sahneye yükler: mevcut choice nesnelerini
// kaldırıp verilen seçeneklerden yenilerini üretir (mcOptions boş kalır).
export function loadChoicesFromOptions(activity, onUpdate, options = [], mcMode = 'single', question = '') {
  const objects = Array.isArray(activity.objects) ? activity.objects : [];
  const nonChoice = objects.filter((item) => !item?.selectionQuestionId);
  const nextObjects = reconcileSelectionObjects({ ...activity, objects: nonChoice }, options);
  patchActivity(activity, onUpdate, {
    mcQuestion: question,
    mcMode: mcMode || 'single',
    mcOptions: [],
    objects: nextObjects,
  });
}

export function patchMcOption(activity, onUpdate, optionId, patch) {
  const nextOptions = (activity.mcOptions || []).map((option) =>
    option.id === optionId ? { ...option, ...patch } : option
  );
  patchActivity(activity, onUpdate, {
    mcOptions: nextOptions,
    objects: reconcileSelectionObjects(activity, nextOptions),
  });
}

export function addMcOption(activity, onUpdate) {
  const options = activity.mcOptions || [];
  const nextOptions = [
    ...options,
    { id: uid(), label: `Seçenek ${options.length + 1}`, isCorrect: false },
  ];
  patchActivity(activity, onUpdate, {
    mcOptions: nextOptions,
    objects: reconcileSelectionObjects(activity, nextOptions),
  });
}

export function removeMcOption(activity, onUpdate, optionId) {
  const nextOptions = (activity.mcOptions || []).filter((option) => option.id !== optionId);
  patchActivity(activity, onUpdate, {
    mcOptions: nextOptions,
    objects: reconcileSelectionObjects(activity, nextOptions),
  });
}

export function setSingleCorrectOption(activity, onUpdate, optionId) {
  const nextOptions = (activity.mcOptions || []).map((option) => ({
    ...option,
    isCorrect: option.id === optionId,
  }));
  patchActivity(activity, onUpdate, {
    mcMode: 'single',
    mcOptions: nextOptions,
    objects: reconcileSelectionObjects(activity, nextOptions),
  });
}

// Freeform doğru-yanlış: sahnede 2 seçenek nesnesi (Doğru/Yanlış) olduğundan emin olur,
// activityKind'i ayarlar ve mcOptions'ı boşaltır. İdempotent (gereksiz patch yapmaz).
export function ensureTrueFalseChoices(activity, onUpdate) {
  const choices = getChoiceObjects(activity);
  if (choices.length >= 2) {
    const needsKind = activity.answerControl?.activityKind !== 'true-false';
    const hasStaleOptions = (activity.mcOptions || []).length > 0;
    if (needsKind || hasStaleOptions) {
      patchActivity(activity, onUpdate, {
        type: 'selection',
        mcMode: 'single',
        answerControl: { ...(activity.answerControl || {}), activityKind: 'true-false' },
        mcOptions: [],
      });
    }
    return;
  }
  const tfOptions = [
    { id: uid(), label: 'Doğru', isCorrect: true },
    { id: uid(), label: 'Yanlış', isCorrect: false },
  ];
  const objects = Array.isArray(activity.objects) ? activity.objects : [];
  const nonChoice = objects.filter((item) => !item?.selectionQuestionId);
  patchActivity(activity, onUpdate, {
    type: 'selection',
    mcMode: 'single',
    answerControl: { ...(activity.answerControl || {}), activityKind: 'true-false' },
    mcOptions: [],
    objects: reconcileSelectionObjects({ ...activity, objects: nonChoice }, tfOptions),
  });
}

export function ensureTrueFalseOptions(activity, onUpdate) {
  const options = activity.mcOptions || [];
  if (options.length === 2 && activity.answerControl?.activityKind === 'true-false') return;
  if (options.length === 2) {
    patchActivity(activity, onUpdate, {
      type: 'selection',
      mcMode: 'single',
      answerControl: { ...(activity.answerControl || {}), activityKind: 'true-false' },
      objects: reconcileSelectionObjects(activity, options),
    });
    return;
  }
  const trueFalseOptions = [
    { id: uid(), label: 'Doğru', isCorrect: true },
    { id: uid(), label: 'Yanlış', isCorrect: false },
  ];
  patchActivity(activity, onUpdate, {
    type: 'selection',
    mcMode: 'single',
    answerControl: { ...(activity.answerControl || {}), activityKind: 'true-false' },
    mcOptions: trueFalseOptions,
    objects: reconcileSelectionObjects(activity, trueFalseOptions),
  });
}

// ─── EŞLEŞTİRME = SÜRÜKLE-BIRAK ──────────────────────────────────────────────
// Eşleştirme aslında bir sürükle-bırak: sol öğeler (draggable) sağ alanlara (dropzone)
// taşınır. Eski form verisini (matchingPairs) sahnedeki draggable/dropzone nesnelerine
// + dragDropMatches'e göçürür. Böylece mevcut sürükle-bırak motoru (sahne + grading +
// SCORM) aynen kullanılır; yeni eval/runtime gerekmez.
const MATCH_LAYOUT = { leftX: 200, rightX: 820, startY: 160, height: 84, gap: 28 };

export function convertMatchingToDragDrop(activity = {}) {
  const objects = Array.isArray(activity.objects) ? activity.objects : [];
  const pairs = Array.isArray(activity.matchingPairs) ? activity.matchingPairs : [];
  const hasDragObjects = objects.some(
    (item) => item.type === 'draggable' || item.type === 'dropzone'
  );
  // Zaten nesne-tabanlı: yalnızca eski matchingPairs kalıntısını temizle.
  if (hasDragObjects) return pairs.length ? { matchingPairs: [] } : null;
  if (!pairs.length) return null;

  const created = [];
  const matches = {};
  let zCursor = objects.reduce((max, item) => Math.max(max, Number(item.zIndex) || 0), 0);
  pairs.forEach((pair, index) => {
    const y = MATCH_LAYOUT.startY + index * (MATCH_LAYOUT.height + MATCH_LAYOUT.gap);
    const drag = createObjectFromActivity(activity, 'draggable');
    drag.label = pair.left || pair.leftLabel || `Öğe ${index + 1}`;
    drag.x = MATCH_LAYOUT.leftX;
    drag.y = y;
    drag.layerId = 'base';
    drag.zIndex = (zCursor += 1);
    const drop = createObjectFromActivity(activity, 'dropzone');
    drop.label = pair.right || pair.rightLabel || `Hedef ${index + 1}`;
    drop.x = MATCH_LAYOUT.rightX;
    drop.y = y;
    drop.layerId = 'base';
    drop.zIndex = (zCursor += 1);
    created.push(drag, drop);
    matches[drag.id] = drop.id;
  });
  return {
    objects: [...objects, ...created],
    dragDropMatches: matches,
    dragDropMode: 'single',
    matchingPairs: [],
  };
}

export function applyMatchingMigration(activity, onUpdate) {
  const patch = convertMatchingToDragDrop(activity);
  if (patch) patchActivity(activity, onUpdate, patch);
}

export function getAnswerTypeKey(activity = {}) {
  if (activity.answerControl?.activityKind === 'true-false') return 'true-false';
  return activity.type || 'selection';
}

export function changeActivityAnswerType(activity, onUpdate, nextType) {
  if (!activity || !onUpdate || !nextType) return;
  if (nextType === 'true-false') {
    const options = activity.mcOptions || [];
    const trueFalseOptions =
      options.length === 2
        ? options
        : [
            { id: uid(), label: 'Doğru', isCorrect: true },
            { id: uid(), label: 'Yanlış', isCorrect: false },
          ];
    patchActivity(activity, onUpdate, {
      type: 'selection',
      mcMode: 'single',
      mcOptions: trueFalseOptions,
      answerControl: { ...(activity.answerControl || {}), activityKind: 'true-false' },
      objects: reconcileSelectionObjects(activity, trueFalseOptions),
    });
    return;
  }

  const answerControlWithoutKind = { ...(activity.answerControl || {}) };
  delete answerControlWithoutKind.activityKind;
  const basePatch = {
    type: nextType,
    answerControl: answerControlWithoutKind,
  };

  if (nextType === 'selection') {
    const mcOptions = activity.mcOptions?.length
      ? activity.mcOptions
      : [
          { id: uid(), label: 'Seçenek 1', isCorrect: true },
          { id: uid(), label: 'Seçenek 2', isCorrect: false },
        ];
    patchActivity(activity, onUpdate, {
      ...basePatch,
      mcMode: activity.mcMode || 'single',
      mcOptions,
      objects: reconcileSelectionObjects(activity, mcOptions),
    });
    return;
  }

  if (nextType === 'sequence') {
    patchActivity(activity, onUpdate, {
      ...basePatch,
      sequenceItems: activity.sequenceItems || [],
    });
    return;
  }

  if (nextType === 'matching') {
    // Eşleştirme artık sürükle-bırak: eski çiftler panel açılınca nesnelere göçer.
    patchActivity(activity, onUpdate, {
      ...basePatch,
      matchingPairs: activity.matchingPairs || [],
      dragDropMode: activity.dragDropMode || 'single',
    });
    return;
  }

  if (nextType === 'slider') {
    // Kaydırıcı/kadran: min-max aralığında değer; tolerans dahilinde doğru değer.
    patchActivity(activity, onUpdate, {
      ...basePatch,
      sliderMode: activity.sliderMode || 'slider',
      sliderMin: activity.sliderMin != null ? activity.sliderMin : 0,
      sliderMax: activity.sliderMax != null ? activity.sliderMax : 100,
      sliderStep: activity.sliderStep != null ? activity.sliderStep : 1,
      sliderCorrectValue: activity.sliderCorrectValue != null ? activity.sliderCorrectValue : 50,
      sliderTolerance: activity.sliderTolerance != null ? activity.sliderTolerance : 0,
      sliderGraded: activity.sliderGraded !== false,
      sliderUnit: activity.sliderUnit || '',
      sliderPrompt: activity.sliderPrompt || '',
    });
    return;
  }

  if (nextType === 'shortcut-key') {
    // Kısayol tuşu: öğrenci doğru klavye kombinasyonunu basar.
    patchActivity(activity, onUpdate, {
      ...basePatch,
      shortcutPrompt: activity.shortcutPrompt || '',
      shortcutAnswers: activity.shortcutAnswers?.length
        ? activity.shortcutAnswers
        : [{ id: uid(), combo: 'Ctrl+S' }],
    });
    return;
  }

  if (nextType === 'line-match' || nextType === 'dropdown-match') {
    // Çizgi/Açılır eşleştirme: sol/sağ çiftler (matchingPairs) + ilgili runtime.
    patchActivity(activity, onUpdate, {
      ...basePatch,
      matchingPairs: activity.matchingPairs || [],
    });
    return;
  }

  if (nextType === 'flashcard') {
    // Bilgi kartı: çevirmeli kart destesi (puansız çalışma etkinliği).
    patchActivity(activity, onUpdate, {
      ...basePatch,
      flashcards: activity.flashcards?.length
        ? activity.flashcards
        : [{ id: uid(), front: 'Ön yüz', back: 'Arka yüz' }],
      settings: { ...(activity.settings || {}), showFeedback: false },
    });
    return;
  }

  if (nextType === 'labeled-image') {
    // Etiketli görsel: görsel + tıklanınca bilgi açan işaretçiler (puansız).
    patchActivity(activity, onUpdate, {
      ...basePatch,
      labeledImage: activity.labeledImage || '',
      labeledMarkers: activity.labeledMarkers || [],
      settings: { ...(activity.settings || {}), showFeedback: false },
    });
    return;
  }

  if (nextType === 'content-tabs') {
    // Sekme/akordeon/süreç/zaman çizelgesi: gezinmeli bilgi içeriği (puansız).
    patchActivity(activity, onUpdate, {
      ...basePatch,
      contentLayout: activity.contentLayout || 'tabs',
      contentItems: activity.contentItems?.length
        ? activity.contentItems
        : [
            { id: uid(), title: 'Başlık 1', body: 'İçerik metni…', image: '' },
            { id: uid(), title: 'Başlık 2', body: 'İçerik metni…', image: '' },
          ],
      contentRequireAll: activity.contentRequireAll || false,
      settings: { ...(activity.settings || {}), showFeedback: false },
    });
    return;
  }

  if (nextType === 'fill-blank') {
    patchActivity(activity, onUpdate, {
      ...basePatch,
      fillBlankAnswers: activity.fillBlankAnswers || [],
    });
    return;
  }

  if (nextType === 'word-bank') {
    // Kelime bankası: boşluk doldurmanın drag'li hâli (aynı fillBlank veri modeli + eval).
    patchActivity(activity, onUpdate, {
      ...basePatch,
      fillBlankSentence: activity.fillBlankSentence || '',
      fillBlankAnswers: activity.fillBlankAnswers || [],
      wordBankExtra: activity.wordBankExtra || '',
    });
    return;
  }

  if (nextType === 'text-entry') {
    patchActivity(activity, onUpdate, {
      ...basePatch,
      textEntryAcceptedAnswers: activity.textEntryAcceptedAnswers || [],
    });
    return;
  }

  if (nextType === 'survey') {
    patchActivity(activity, onUpdate, {
      ...basePatch,
      surveyQuestions: activity.surveyQuestions || [],
    });
    return;
  }

  if (nextType === 'puzzle') {
    patchActivity(activity, onUpdate, {
      ...basePatch,
      puzzleType: activity.puzzleType || 'crossword',
      puzzleQuestions: activity.puzzleQuestions || [],
      puzzleGrid: activity.puzzleGrid || { rows: 10, cols: 10, cells: [] },
      puzzleSettings: activity.puzzleSettings || {
        showClues: true,
        showNumbers: true,
        allowHints: true,
        timeLimitEnabled: false,
        timeLimitMinutes: 5,
        maxAttempts: 0,
        shuffleQuestions: false,
      },
    });
    return;
  }

  patchActivity(activity, onUpdate, basePatch);
}
