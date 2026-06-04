import { SLIDE_STATE_KEYS } from '../../constants';
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

function syncSelectionObjectsWithOptions(activity = {}, nextOptions = []) {
  const objects = Array.isArray(activity.objects) ? activity.objects : [];
  const selectionObjects = objects.filter((item) => item?.selectionQuestionId);
  if (!selectionObjects.length || !nextOptions.length) return objects;

  const optionsByKey = new Map();
  nextOptions.forEach((option, index) => {
    [
      option.id,
      option.label,
      String.fromCharCode(65 + index),
      String(index + 1),
    ].forEach((key) => {
      const normalized = normalizeAnswerKey(key);
      if (normalized && !optionsByKey.has(normalized)) optionsByKey.set(normalized, option);
    });
  });

  const sortedSelectionIds = [...selectionObjects]
    .sort(
      (left, right) =>
        (Number(left.y) || 0) - (Number(right.y) || 0) ||
        (Number(left.x) || 0) - (Number(right.x) || 0)
    )
    .map((item) => item.id);
  const selectionIndexById = new Map(sortedSelectionIds.map((id, index) => [id, index]));

  return objects.map((item) => {
    if (!item?.selectionQuestionId) return item;
    const directOption =
      optionsByKey.get(normalizeAnswerKey(item.selectionChoice)) ||
      optionsByKey.get(normalizeAnswerKey(item.label));
    const fallbackOption = nextOptions[selectionIndexById.get(item.id) || 0] || null;
    const option = directOption || fallbackOption;
    if (!option) return item;
    return { ...item, selectionCorrect: !!option.isCorrect };
  });
}

export function patchMcOption(activity, onUpdate, optionId, patch) {
  const nextOptions = (activity.mcOptions || []).map((option) =>
    option.id === optionId ? { ...option, ...patch } : option
  );
  patchActivity(activity, onUpdate, {
    mcOptions: nextOptions,
    objects: syncSelectionObjectsWithOptions(activity, nextOptions),
  });
}

export function addMcOption(activity, onUpdate) {
  const options = activity.mcOptions || [];
  patchActivity(activity, onUpdate, {
    mcOptions: [
      ...options,
      { id: uid(), label: `Seçenek ${options.length + 1}`, isCorrect: false },
    ],
  });
}

export function removeMcOption(activity, onUpdate, optionId) {
  const nextOptions = (activity.mcOptions || []).filter((option) => option.id !== optionId);
  patchActivity(activity, onUpdate, {
    mcOptions: nextOptions,
    objects: syncSelectionObjectsWithOptions(activity, nextOptions),
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
    objects: syncSelectionObjectsWithOptions(activity, nextOptions),
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
    });
    return;
  }
  patchActivity(activity, onUpdate, {
    type: 'selection',
    mcMode: 'single',
    answerControl: { ...(activity.answerControl || {}), activityKind: 'true-false' },
    mcOptions: [
      { id: uid(), label: 'Doğru', isCorrect: true },
      { id: uid(), label: 'Yanlış', isCorrect: false },
    ],
  });
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
    patchActivity(activity, onUpdate, {
      ...basePatch,
      mcMode: activity.mcMode || 'single',
      mcOptions:
        activity.mcOptions?.length
          ? activity.mcOptions
          : [
              { id: uid(), label: 'Seçenek 1', isCorrect: true },
              { id: uid(), label: 'Seçenek 2', isCorrect: false },
            ],
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
    patchActivity(activity, onUpdate, {
      ...basePatch,
      matchingPairs: activity.matchingPairs || [],
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
