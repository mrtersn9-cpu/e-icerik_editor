import { ACTIVITY_TYPES } from '../../constants';

export function getActivityTypeLabel(activity = {}) {
  // Doğru-Yanlış etkinlikleri veri modelinde type='selection' + activityKind='true-false'
  // olarak saklanır; generic "Seçme" etiketi yerine doğru türü göster.
  if (isTrueFalseActivity(activity)) return 'Doğru-Yanlış';
  return ACTIVITY_TYPES.find((type) => type.id === activity.type)?.label || 'Etkinlik';
}

export function isTrueFalseActivity(activity = {}) {
  if (activity.answerControl?.activityKind === 'true-false') return true;
  if (activity.type !== 'selection') return false;
  // Freeform: önce sahnedeki seçenek nesnelerine bak; yoksa eski mcOptions'a düş.
  const objects = Array.isArray(activity.objects) ? activity.objects : [];
  const choices = objects.filter(
    (item) => item?.selectionQuestionId && (item.layerId || 'base') === 'base'
  );
  const source = choices.length
    ? choices.map((item) => String(item.selectionChoice || item.label || ''))
    : (activity.mcOptions || []).map((option) => String(option.label || ''));
  if (source.length !== 2 || (activity.mcMode || 'single') !== 'single') return false;
  const labels = source.map((label) => label.trim().toLocaleLowerCase('tr-TR'));
  return labels.some((label) => ['dogru', 'doğru', 'true', 'd'].includes(label)) &&
    labels.some((label) => ['yanlis', 'yanlış', 'false', 'y'].includes(label));
}

export function getAnswerSummary(activity = {}) {
  const objects = activity.objects || [];
  const byVisualOrder = (a, b) =>
    (Number(a.y) || 0) - (Number(b.y) || 0) ||
    (Number(a.x) || 0) - (Number(b.x) || 0);
  const draggables = objects
    .filter((item) => item.type === 'draggable' && (item.layerId || 'base') === 'base')
    .sort(byVisualOrder);
  const dropzones = objects
    .filter((item) => item.type === 'dropzone' && (item.layerId || 'base') === 'base')
    .sort(byVisualOrder);
  const matches = activity.dragDropMatches || {};
  const options = activity.mcOptions || [];
  const correctOptions = options.filter((item) => item.isCorrect);
  // Freeform seçenekler: selectionQuestionId taşıyan base-katman nesneleri.
  const choices = objects
    .filter((item) => item?.selectionQuestionId && (item.layerId || 'base') === 'base')
    .sort(byVisualOrder);
  const correctChoices = choices.filter((item) => item.selectionCorrect === true);
  const sequenceItems = activity.sequenceItems || [];
  const matchingPairs = activity.matchingPairs || [];
  const fillBlankAnswers = activity.fillBlankAnswers || [];
  return {
    objects,
    draggables,
    dropzones,
    matches,
    options,
    correctOptions,
    choices,
    correctChoices,
    sequenceItems,
    matchingPairs,
    fillBlankAnswers,
    surveyQuestions: activity.surveyQuestions || [],
    textAnswers: activity.textEntryAcceptedAnswers || [],
  };
}

export function getFooterMeta(activity = {}, lastSaved = null) {
  return {
    id: activity.id || '-',
    version: activity.version || '1.0.0',
    lastSavedText: lastSaved ? lastSaved.toLocaleTimeString('tr-TR') : 'Az once',
  };
}
