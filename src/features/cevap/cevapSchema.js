export const DEFAULT_ANSWER_CONTROL = {
  checkButtonText: 'Kontrol Et',
  showAnswerText: 'Cevabı Göster',
  restartText: 'Yeniden Başlat',
  maxAttempts: 3,
  autoCheck: false,
  lockAfterCheck: false,
};

export const DEFAULT_ANSWER_FEEDBACK = {
  correctMessage: 'Harika! Doğru cevap.',
  incorrectMessage: 'Tekrar dene. Cevabını kontrol et.',
  partialMessage: 'Bazı cevaplar eksik veya hatalı.',
  correctSound: 'success.mp3',
  incorrectSound: 'error.mp3',
  animation: 'Confetti',
};

export const DEFAULT_ANSWER_SCORING = {
  fullScore: 100,
  partialScore: true,
  passingScore: 70,
  penalty: 0,
};

export const DEFAULT_ANSWER_HINTS = {
  hintText: '',
  hintTiming: 'manual',
  explanationText: '',
};

export const DEFAULT_ANSWER_ACCESSIBILITY = {
  label: '',
  screenReaderText: '',
  keyboardMode: true,
  highContrast: false,
};

export function getAnswerControl(activity = {}) {
  return {
    ...DEFAULT_ANSWER_CONTROL,
    maxAttempts: activity.settings?.maxAttempts ?? DEFAULT_ANSWER_CONTROL.maxAttempts,
    checkButtonText: activity.settings?.checkButtonText || DEFAULT_ANSWER_CONTROL.checkButtonText,
    showAnswerText: activity.settings?.answerButtonText || DEFAULT_ANSWER_CONTROL.showAnswerText,
    restartText: activity.settings?.restartFlowText || DEFAULT_ANSWER_CONTROL.restartText,
    ...(activity.answerControl || {}),
  };
}

export function getAnswerFeedback(activity = {}) {
  return {
    ...DEFAULT_ANSWER_FEEDBACK,
    correctMessage: activity.resultScreens?.successBody || DEFAULT_ANSWER_FEEDBACK.correctMessage,
    incorrectMessage:
      activity.resultScreens?.failureBody || DEFAULT_ANSWER_FEEDBACK.incorrectMessage,
    ...(activity.answerFeedback || {}),
  };
}

export function getAnswerScoring(activity = {}) {
  return {
    ...DEFAULT_ANSWER_SCORING,
    fullScore: activity.settings?.scorePoints ?? DEFAULT_ANSWER_SCORING.fullScore,
    passingScore: activity.lmsConfig?.passingScore ?? DEFAULT_ANSWER_SCORING.passingScore,
    ...(activity.answerScoring || {}),
  };
}

export function getAnswerHints(activity = {}) {
  return { ...DEFAULT_ANSWER_HINTS, ...(activity.answerHints || {}) };
}

export function getAnswerAccessibility(activity = {}) {
  return {
    ...DEFAULT_ANSWER_ACCESSIBILITY,
    label: activity.accessibilityLabel || DEFAULT_ANSWER_ACCESSIBILITY.label,
    ...(activity.answerAccessibility || {}),
  };
}

export function withAnswerControl(activity = {}, patch = {}) {
  const next = { ...getAnswerControl(activity), ...patch };
  return {
    answerControl: next,
    settings: {
      ...(activity.settings || {}),
      maxAttempts: Number(next.maxAttempts) || 0,
      checkButtonText: next.checkButtonText,
      answerButtonText: next.showAnswerText,
      restartFlowText: next.restartText,
    },
  };
}

export function withAnswerFeedback(activity = {}, patch = {}) {
  const next = { ...getAnswerFeedback(activity), ...patch };
  return {
    answerFeedback: next,
    resultScreens: {
      ...(activity.resultScreens || {}),
      successBody: next.correctMessage,
      failureBody: next.incorrectMessage,
    },
  };
}

export function withAnswerScoring(activity = {}, patch = {}) {
  const next = { ...getAnswerScoring(activity), ...patch };
  return {
    answerScoring: next,
    settings: {
      ...(activity.settings || {}),
      scorePoints: Number(next.fullScore) || 0,
    },
    lmsConfig: {
      ...(activity.lmsConfig || {}),
      passingScore: Number(next.passingScore) || 0,
    },
  };
}

export function withAnswerHints(activity = {}, patch = {}) {
  return { answerHints: { ...getAnswerHints(activity), ...patch } };
}

export function withAnswerAccessibility(activity = {}, patch = {}) {
  const next = { ...getAnswerAccessibility(activity), ...patch };
  return {
    answerAccessibility: next,
    accessibilityLabel: next.label,
  };
}

