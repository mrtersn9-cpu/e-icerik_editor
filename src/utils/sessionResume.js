/**
 * Session Resume Utility for E-İçerik Editörü
 * Provides try/catch safe localStorage tracking of active editing session
 * for server-verified resume flow on SQL connection.
 */

export function getUserResumeStorageKey(userId) {
  return `e_icerik_resume_${userId || 'guest'}`;
}

export function getActiveSessionNavigationKey(userId, sessionId) {
  return `e_icerik_active_navigation_${userId || 'guest'}_${sessionId || 'none'}`;
}

export function saveSessionResume(userId, data) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const key = getUserResumeStorageKey(userId);
    if (!data || (!data.pubId && !data.bookId && !data.actId)) {
      // Leaving the editor canvas must not erase the last resumable activity.
      // Explicit dismissals and invalid targets are removed via clearSessionResume.
      return;
    }
    window.localStorage.setItem(key, JSON.stringify({
      pubId: data.pubId || null,
      bookId: data.bookId || null,
      actId: data.actId || null,
      projectId: data.projectId || null,
      projectName: data.projectName || null,
      bookName: data.bookName || null,
      activityName: data.activityName || null,
      timestamp: Date.now()
    }));
  } catch (err) {
    console.warn('Session resume save failed:', err);
  }
}

export function getSessionResume(userId) {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const key = getUserResumeStorageKey(userId);
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Session resume read failed:', err);
    return null;
  }
}

export function clearSessionResume(userId) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const key = getUserResumeStorageKey(userId);
    window.localStorage.removeItem(key);
  } catch (err) {
    console.warn('Session resume clear failed:', err);
  }
}

export function saveActiveSessionNavigation(userId, sessionId, data = {}) {
  if (typeof window === 'undefined' || !window.sessionStorage || !userId || !sessionId) return;
  try {
    window.sessionStorage.setItem(
      getActiveSessionNavigationKey(userId, sessionId),
      JSON.stringify({
        pubId: data.pubId || null,
        bookId: data.bookId || null,
        actId: data.actId || null,
      })
    );
  } catch (err) {
    console.warn('Active session navigation save failed:', err);
  }
}

export function getActiveSessionNavigation(userId, sessionId) {
  if (typeof window === 'undefined' || !window.sessionStorage || !userId || !sessionId) return null;
  try {
    const raw = window.sessionStorage.getItem(getActiveSessionNavigationKey(userId, sessionId));
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn('Active session navigation read failed:', err);
    return null;
  }
}

export function clearActiveSessionNavigation(userId, sessionId) {
  if (typeof window === 'undefined' || !window.sessionStorage || !userId || !sessionId) return;
  try {
    window.sessionStorage.removeItem(getActiveSessionNavigationKey(userId, sessionId));
  } catch (err) {
    console.warn('Active session navigation clear failed:', err);
  }
}

export function validateSessionResumeTarget(resume, workspaceState = {}) {
  const hasTarget = !!(resume && (resume.pubId || resume.bookId || resume.actId));
  if (!hasTarget) return { hasTarget: false, valid: false };

  const publishers = Array.isArray(workspaceState.publishers) ? workspaceState.publishers : [];
  const books = Array.isArray(workspaceState.books) ? workspaceState.books : [];
  const activities = Array.isArray(workspaceState.activities) ? workspaceState.activities : [];
  const publisher = resume.pubId
    ? publishers.find((item) => item.id === resume.pubId)
    : null;
  const book = resume.bookId ? books.find((item) => item.id === resume.bookId) : null;
  const activity = resume.actId
    ? activities.find((item) => item.id === resume.actId)
    : null;

  return {
    hasTarget: true,
    valid:
      (!resume.pubId || !!publisher) &&
      (!resume.bookId || (!!book && (!resume.pubId || book.publisherId === resume.pubId))) &&
      (!resume.actId || (!!activity && (!resume.bookId || activity.bookId === resume.bookId))),
  };
}

export function resetNavigationForResumePrompt(state = {}) {
  return {
    ...state,
    selPubId: null,
    selBookId: null,
    selActId: null,
  };
}

export function restoreSessionResumeNavigation(state = {}, resume = {}) {
  const validation = validateSessionResumeTarget(resume, state);
  if (!validation.hasTarget) return state;
  if (!validation.valid) return state;
  return {
    ...state,
    selPubId: resume.pubId || null,
    selBookId: resume.bookId || null,
    selActId: resume.actId || null,
  };
}

export function restoreActiveSessionNavigation(state = {}, navigation = null) {
  if (!navigation) return state;
  const validation = validateSessionResumeTarget(navigation, state);
  if (validation.hasTarget && !validation.valid) {
    return resetNavigationForResumePrompt(state);
  }
  return restoreSessionResumeNavigation(state, navigation);
}
