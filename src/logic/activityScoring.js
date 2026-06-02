// Etkinlik puanlama motorları ve otomatik cevap yardımcıları.
// Bu modül EIcerikEditor.jsx içinden çıkarılan saf (state'siz) fonksiyonları barındırır.
// Davranış birebir korunmuştur.

import { normalizePdfText } from '../pdfParser';

import { getCanvasObjects, getCorrectDragMatches } from './activityHelpers';
import {
  areDragDropScopesCompatible,
  isDragReusable,
  getDropCapacityLimit,
  getDragDropPairsFromMatches,
} from './dragDrop';

// Sürükle-bırak nesnelerini olası eşleşme çiftlerine göre hizalar.
export function getDragDropAssignments(activity) {
  const canvasObjects = getCanvasObjects(activity);
  const drags = canvasObjects.filter((o) => o.type === 'draggable');
  const drops = canvasObjects.filter((o) => o.type === 'dropzone');
  const usedDropCounts = {};
  const pairs = [];

  drags.forEach((drag, index) => {
    const scopeFiltered = drops.filter((drop) => areDragDropScopesCompatible(activity, drag, drop));
    if (!scopeFiltered.length) return;

    const sameGroup = drag.group
      ? scopeFiltered.filter(
          (drop) => normalizePdfText(drop.group || '') === normalizePdfText(drag.group || '')
        )
      : [];
    const sameLabel = drag.label
      ? scopeFiltered.filter(
          (drop) => normalizePdfText(drop.label || '') === normalizePdfText(drag.label || '')
        )
      : [];
    const basePool = sameGroup.length ? sameGroup : sameLabel.length ? sameLabel : scopeFiltered;
    const reusable = isDragReusable(activity, drag);
    const acceptedDropIds = [];

    basePool.forEach((drop, candidateIndex) => {
      const capacity = getDropCapacityLimit(activity, drop);
      const currentCount = usedDropCounts[drop.id] || 0;
      const canUseDrop = capacity === 0 || currentCount < capacity;
      const isFallbackCandidate = !sameGroup.length && !sameLabel.length;
      if (!canUseDrop) return;
      if (!reusable && candidateIndex > 0) return;
      if (reusable && isFallbackCandidate && candidateIndex > 0) return;
      acceptedDropIds.push(drop.id);
      usedDropCounts[drop.id] = currentCount + 1;
    });

    if (!acceptedDropIds.length) {
      const fallback = scopeFiltered[index] || scopeFiltered[0];
      if (!fallback) return;
      const capacity = getDropCapacityLimit(activity, fallback);
      const currentCount = usedDropCounts[fallback.id] || 0;
      if (capacity !== 0 && currentCount >= capacity) return;
      acceptedDropIds.push(fallback.id);
      usedDropCounts[fallback.id] = currentCount + 1;
    }

    acceptedDropIds.forEach((dropId) => {
      const drop = drops.find((item) => item.id === dropId);
      if (drop) pairs.push({ drag, drop });
    });
  });

  return pairs;
}

// Etkinlik türüne göre doğru cevap özetini (kullanıcıya gösterilecek satırlar) üretir.
export function getAutoAnswerSummary(activity) {
  if (activity.type === 'drag-drop' || activity.type === 'mixed') {
    const dragById = Object.fromEntries(
      getCanvasObjects(activity)
        .filter((item) => item.type === 'draggable')
        .map((item) => [item.id, item])
    );
    const dropById = Object.fromEntries(
      getCanvasObjects(activity)
        .filter((item) => item.type === 'dropzone')
        .map((item) => [item.id, item])
    );
    const pairs = getDragDropPairsFromMatches(getCorrectDragMatches(activity)).map(
      ({ dragId, dropId }) =>
        `${dragById[dragId]?.label || 'Surukle'} → ${dropById[dropId]?.label || 'Birak'}`
    );
    return pairs.length ? pairs : ['Dogru eslesme henuz olusmadi.'];
  }
  const selectedOptionLabels = (activity.mcOptions || [])
    .filter((o) => o.isCorrect)
    .map((o) => o.label || 'Secenek');
  if (selectedOptionLabels.length) return [selectedOptionLabels.join(', ')];
  if (Array.isArray(activity.selectionSlots) && activity.selectionSlots.length) {
    const labels = activity.selectionSlots.map((slot, index) => {
      if (!slot?.correctChoice) return `${index + 1}. soru: anahtar okunamadi`;
      return `${index + 1}. soru: ${slot.correctLabel || String(slot.correctChoice).toUpperCase()}`;
    });
    return labels.length ? labels : ['Dogru secenek henuz tanimlanmadi.'];
  }
  return ['Dogru secenek henuz tanimlanmadi.'];
}

// Çoktan seçmeli etkinlikte doğru seçeneklerin id listesini döndürür.
export function getCorrectSelectionIds(activity) {
  return (activity.mcOptions || []).filter((o) => o.isCorrect).map((o) => o.id);
}

// ─── Yeni Soru Türleri için Puanlama Motorları ────────────────────────────────────

export function scoreSequence(activity, userOrder) {
  const correct = (activity.sequenceItems || []).map((i) => i.id);
  if (!correct.length) return { success: false, score: 0, total: 0, detail: [] };
  const detail = correct.map((id, idx) => ({ id, correct: userOrder[idx] === id }));
  const score = detail.filter((d) => d.correct).length;
  return { success: score === correct.length, score, total: correct.length, detail };
}

export function scoreMatching(activity, userPairs) {
  const correct = (activity.matchingPairs || []).map((p) => ({ left: p.left, right: p.right }));
  if (!correct.length) return { success: false, score: 0, total: 0, detail: [] };
  const detail = correct.map((cp) => {
    const match = (userPairs || []).find((up) => up.left === cp.left);
    return {
      left: cp.left,
      expected: cp.right,
      given: match?.right || '',
      correct: match?.right === cp.right,
    };
  });
  const score = detail.filter((d) => d.correct).length;
  return { success: score === correct.length, score, total: correct.length, detail };
}

export function scoreTextEntry(activity, userText) {
  const accepted = (activity.textEntryAcceptedAnswers || []).filter(Boolean);
  if (!accepted.length) return { success: false, score: 0, total: 1 };
  const caseSensitive = !!activity.textEntryCaseSensitive;
  const normalize = (s) => (caseSensitive ? s.trim() : s.trim().toLowerCase());
  const match = accepted.some((a) => normalize(a) === normalize(userText || ''));
  return { success: match, score: match ? 1 : 0, total: 1 };
}

export function scoreNumeric(activity, userValue) {
  const correct = activity.numericCorrectValue ?? null;
  if (correct === null) return { success: false, score: 0, total: 1 };
  const tolerance = activity.numericTolerance ?? 0;
  const val = parseFloat(userValue);
  if (isNaN(val)) return { success: false, score: 0, total: 1 };
  const match = Math.abs(val - correct) <= tolerance;
  return { success: match, score: match ? 1 : 0, total: 1 };
}

export function scoreFillBlank(activity, userBlanks) {
  const blanks = activity.fillBlankAnswers || [];
  if (!blanks.length) return { success: false, score: 0, total: 0, detail: [] };
  const detail = blanks.map((blank, idx) => {
    const accepted = blank.acceptedValues || [];
    const user = (userBlanks || [])[idx] || '';
    const caseSensitive = !!blank.caseSensitive;
    const normalize = (s) => (caseSensitive ? s.trim() : s.trim().toLowerCase());
    const correct = accepted.some((a) => normalize(a) === normalize(user));
    return { blankIndex: idx, correct, given: user };
  });
  const score = detail.filter((d) => d.correct).length;
  return { success: score === blanks.length, score, total: blanks.length, detail };
}

export function scoreSurvey() {
  return { success: true, score: 0, total: 0, isSurvey: true };
}

export function scoreActivity(activity, userResponse) {
  switch (activity.type) {
    case 'sequence':
      return scoreSequence(activity, userResponse.order || []);
    case 'matching':
      return scoreMatching(activity, userResponse.pairs || []);
    case 'text-entry':
      return scoreTextEntry(activity, userResponse.text || '');
    case 'numeric':
      return scoreNumeric(activity, userResponse.value);
    case 'fill-blank':
      return scoreFillBlank(activity, userResponse.blanks || []);
    case 'survey':
      return scoreSurvey();
    default:
      return null;
  }
}
