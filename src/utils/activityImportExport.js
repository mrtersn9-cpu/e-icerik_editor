import { uid } from './editorHelpers';

const EXPORT_VERSION = '1.0';

export function exportActivityToJSON(activity) {
  const base = {
    version: EXPORT_VERSION,
    type: activity.type || 'selection',
    name: activity.name || '',
  };

  if (activity.type === 'selection') {
    base.questions = [
      {
        question: activity.mcQuestion || '',
        options: (activity.mcOptions || []).map((o) => o.label),
        correctIndices: (activity.mcOptions || [])
          .map((o, i) => (o.isCorrect ? i : -1))
          .filter((i) => i >= 0),
      },
    ];
  } else if (activity.type === 'matching') {
    base.questions = [
      {
        question: activity.mcQuestion || '',
        pairs: (activity.matchingPairs || []).map((p) => ({ left: p.left, right: p.right })),
      },
    ];
  } else if (activity.type === 'sequence') {
    base.questions = [
      {
        question: activity.mcQuestion || '',
        items: (activity.sequenceItems || []).map((i) => i.label),
      },
    ];
  } else if (activity.type === 'text-entry') {
    base.questions = [
      {
        question: activity.textEntryPrompt || '',
        acceptedAnswers: activity.textEntryAcceptedAnswers || [],
      },
    ];
  } else if (activity.type === 'numeric') {
    base.questions = [
      {
        question: activity.numericPrompt || '',
        correctValue: activity.numericCorrectValue ?? 0,
        tolerance: activity.numericTolerance ?? 0,
      },
    ];
  } else if (activity.type === 'fill-blank') {
    base.questions = [
      {
        sentence: activity.fillBlankSentence || '',
        answers: (activity.fillBlankAnswers || []).map((a) => ({
          blankIndex: a.blankIndex,
          acceptedValues: a.acceptedValues || [],
        })),
      },
    ];
  } else if (activity.type === 'survey') {
    base.questions = (activity.surveyQuestions || []).map((q) => ({
      prompt: q.prompt || '',
      type: q.type || 'likert',
      options: q.options || [],
    }));
  } else {
    base.raw = JSON.parse(JSON.stringify(activity));
  }

  return JSON.stringify(base, null, 2);
}

export function importActivityFromJSON(jsonText) {
  let data;
  try {
    data = JSON.parse(jsonText);
  } catch {
    return { success: false, error: 'Geçersiz JSON formatı.' };
  }

  if (!data.version || !data.type) {
    return { success: false, error: 'Eksik version veya type alanı.' };
  }

  const type = data.type;
  const name = data.name || 'İçe Aktarılan Etkinlik';

  const base = {
    id: uid(),
    name,
    type,
    notes: '',
    contentLanguage: 'tr',
    settings: { showFeedback: true, allowRetry: true },
  };

  const firstQuestion = data.questions?.[0] || {};

  if (type === 'selection') {
    base.mcQuestion = firstQuestion.question || '';
    base.mcMode = 'single';
    base.mcOptions = (firstQuestion.options || []).map((label, index) => ({
      id: uid(),
      label: String(label),
      isCorrect: (firstQuestion.correctIndices || []).includes(index),
    }));
    if (!base.mcOptions.some((o) => o.isCorrect) && base.mcOptions.length > 0) {
      base.mcOptions[0].isCorrect = true;
    }
  } else if (type === 'matching') {
    base.mcQuestion = firstQuestion.question || '';
    base.matchingPairs = (firstQuestion.pairs || []).map((p) => ({
      id: uid(),
      left: String(p.left || ''),
      right: String(p.right || ''),
    }));
    base.matchingShuffle = true;
  } else if (type === 'sequence') {
    base.mcQuestion = firstQuestion.question || '';
    base.sequenceItems = (firstQuestion.items || []).map((label, order) => ({
      id: uid(),
      label: String(label),
      order: order + 1,
    }));
    base.sequenceShuffle = true;
    base.sequenceDirection = 'vertical';
  } else if (type === 'text-entry') {
    base.textEntryPrompt = firstQuestion.question || '';
    base.textEntryAcceptedAnswers = (firstQuestion.acceptedAnswers || []).map(String);
    base.textEntryCaseSensitive = false;
    base.textEntryMaxLength = 500;
  } else if (type === 'numeric') {
    base.numericPrompt = firstQuestion.question || '';
    base.numericCorrectValue = Number(firstQuestion.correctValue ?? 0);
    base.numericTolerance = Number(firstQuestion.tolerance ?? 0);
    base.numericMin = null;
    base.numericMax = null;
  } else if (type === 'fill-blank') {
    base.fillBlankSentence = firstQuestion.sentence || '';
    base.fillBlankAnswers = (firstQuestion.answers || []).map((a) => ({
      id: uid(),
      blankIndex: Number(a.blankIndex ?? 0),
      acceptedValues: (a.acceptedValues || []).map(String),
      caseSensitive: false,
    }));
  } else if (type === 'survey') {
    base.surveyQuestions = (data.questions || []).map((q) => ({
      id: uid(),
      prompt: q.prompt || '',
      type: q.type || 'likert',
      options: Array.isArray(q.options) ? q.options.map(String) : [],
    }));
    base.surveyAnonymous = true;
    base.settings.showFeedback = false;
  } else {
    return { success: false, error: `Desteklenmeyen etkinlik türü: ${type}` };
  }

  return { success: true, activity: base };
}
