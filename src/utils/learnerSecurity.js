export const REDACTED_ANSWER_VALUE = '__ANSWER_REDACTED__';

const ANSWER_KEY_BLOCKLIST = new Set([
  'isCorrect',
  'selectionCorrect',
  'correctAnswer',
  'correctAnswers',
  'correctOrder',
  'correctChoice',
  'correctLabel',
  'correctMatches',
  'correctPairs',
  'correctPlacements',
  'dragDropMatches',
  'matchingPairs',
  'textEntryAcceptedAnswers',
  'numericCorrectValue',
  'numericTolerance',
  'fillBlankAnswers',
  'answerTerms',
  'answerScreen',
  'result',
  'detail',
  'expected',
  'placementResult',
]);

const SECRET_KEY_BLOCKLIST = new Set([
  'xapiEndpoint',
  'xapiKey',
  'xapiSecret',
  'xapiActivityId',
  'cmi5FetchUrl',
  'cmi5MoveOn',
  'ltiLaunchUrl',
  'ltiConsumerKey',
  'ltiSharedSecret',
]);

const ANSWER_ACTION_VALUES = new Set(['answer', 'solution']);

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function scrubActionValue(value) {
  return ANSWER_ACTION_VALUES.has(String(value || '')) ? 'none' : value;
}

function sanitizeSettings(settings = {}) {
  const next = sanitizeLearnerPayload(settings);
  return {
    ...next,
    showAnswerLayer: false,
    answerButtonAction: scrubActionValue(next.answerButtonAction),
    solutionButtonAction: scrubActionValue(next.solutionButtonAction),
  };
}

function sanitizeTrigger(trigger = {}) {
  const next = sanitizeLearnerPayload(trigger);
  const action = String(next.action || next.value || '').trim();
  if (ANSWER_ACTION_VALUES.has(action)) {
    return { ...next, action: 'none', value: 'none' };
  }
  return next;
}

export function sanitizeLearnerPayload(value) {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeLearnerPayload(item));
  }

  if (!isPlainObject(value)) {
    return value;
  }

  return Object.entries(value).reduce((acc, [key, entry]) => {
    if (ANSWER_KEY_BLOCKLIST.has(key) || SECRET_KEY_BLOCKLIST.has(key)) {
      return acc;
    }
    if (key === 'settings' && isPlainObject(entry)) {
      acc[key] = sanitizeSettings(entry);
      return acc;
    }
    if (key === 'triggers' && Array.isArray(entry)) {
      acc[key] = entry.map((item) => sanitizeTrigger(item));
      return acc;
    }
    if (key === 'sequenceItems' && Array.isArray(entry)) {
      acc[key] = entry
        .map((item) => sanitizeLearnerPayload(item))
        .sort((a, b) =>
          String(a?.id || a?.label || '').localeCompare(String(b?.id || b?.label || ''))
        );
      return acc;
    }
    acc[key] = sanitizeLearnerPayload(entry);
    return acc;
  }, {});
}

export function sanitizeLearnerActivity(activity = {}) {
  const next = sanitizeLearnerPayload(activity);
  const safeLmsConfig = sanitizeLearnerPayload(next.lmsConfig || {});
  return {
    ...next,
    lmsConfig: {
      ...safeLmsConfig,
      standard: 'scorm12',
      secureLearnerMode: true,
    },
    settings: sanitizeSettings(next.settings || {}),
  };
}

export function createLearnerSafeStateForExport(state = {}) {
  const next = sanitizeLearnerPayload(state);
  return {
    ...next,
    lmsConfig: {
      ...(next.lmsConfig || {}),
      standard: 'scorm12',
      secureLearnerMode: true,
    },
    activities: Array.isArray(next.activities)
      ? next.activities.map((activity) => sanitizeLearnerActivity(activity))
      : [],
  };
}

export function sanitizeLmsRuntimeRecord(record = {}) {
  return sanitizeLearnerPayload(record);
}
