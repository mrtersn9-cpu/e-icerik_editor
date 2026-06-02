import {
  clearActiveSessionNavigation,
  clearSessionResume,
  getActiveSessionNavigation,
  getSessionResume,
  getUserResumeStorageKey,
  resetNavigationForResumePrompt,
  restoreActiveSessionNavigation,
  restoreSessionResumeNavigation,
  saveActiveSessionNavigation,
  saveSessionResume,
  validateSessionResumeTarget,
} from '../utils/sessionResume';

describe('session resume storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  test('round-trips a user resume target and clears it explicitly', () => {
    saveSessionResume('editor-1', {
      pubId: 'pub-1',
      bookId: 'book-1',
      actId: 'act-1',
      projectId: 'project-1',
    });

    expect(getSessionResume('editor-1')).toMatchObject({
      pubId: 'pub-1',
      bookId: 'book-1',
      actId: 'act-1',
      projectId: 'project-1',
    });

    clearSessionResume('editor-1');
    expect(getSessionResume('editor-1')).toBeNull();
  });

  test('keeps the last activity target while navigation temporarily has no selection', () => {
    saveSessionResume('editor-1', {
      pubId: 'pub-1',
      bookId: 'book-1',
      actId: 'act-1',
      activityName: 'Son etkinlik',
    });

    saveSessionResume('editor-1', {
      pubId: null,
      bookId: null,
      actId: null,
    });

    expect(getSessionResume('editor-1')).toMatchObject({
      pubId: 'pub-1',
      bookId: 'book-1',
      actId: 'act-1',
      activityName: 'Son etkinlik',
    });
  });

  test('does not open an invalid serialized target', () => {
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
    window.localStorage.setItem(getUserResumeStorageKey('editor-1'), '{invalid');

    expect(getSessionResume('editor-1')).toBeNull();
    expect(warning).toHaveBeenCalled();
    warning.mockRestore();
  });

  test('validates a stored target against workspace content even when the workspace is already selected', () => {
    const workspace = {
      publishers: [{ id: 'pub-1' }],
      books: [{ id: 'book-1', publisherId: 'pub-1' }],
      activities: [{ id: 'act-1', bookId: 'book-1' }],
      selPubId: 'pub-1',
      selBookId: 'book-1',
      selActId: 'act-1',
    };

    expect(
      validateSessionResumeTarget(
        { pubId: 'pub-1', bookId: 'book-1', actId: 'act-1' },
        workspace
      )
    ).toEqual({ hasTarget: true, valid: true });
    expect(resetNavigationForResumePrompt(workspace)).toMatchObject({
      selPubId: null,
      selBookId: null,
      selActId: null,
      publishers: workspace.publishers,
      books: workspace.books,
      activities: workspace.activities,
    });
  });

  test('rejects resume navigation when its stored hierarchy no longer exists', () => {
    expect(
      validateSessionResumeTarget(
        { pubId: 'pub-1', bookId: 'book-2', actId: 'act-1' },
        {
          publishers: [{ id: 'pub-1' }],
          books: [{ id: 'book-1', publisherId: 'pub-1' }],
          activities: [{ id: 'act-1', bookId: 'book-1' }],
        }
      )
    ).toEqual({ hasTarget: true, valid: false });
  });

  test('restores the saved navigation silently on refresh without removing workspace data', () => {
    const workspace = {
      publishers: [{ id: 'pub-1' }],
      books: [{ id: 'book-1', publisherId: 'pub-1' }],
      activities: [{ id: 'act-1', bookId: 'book-1' }],
      selPubId: null,
      selBookId: null,
      selActId: null,
    };

    expect(
      restoreSessionResumeNavigation(workspace, {
        pubId: 'pub-1',
        bookId: 'book-1',
        actId: 'act-1',
      })
    ).toMatchObject({
      selPubId: 'pub-1',
      selBookId: 'book-1',
      selActId: 'act-1',
      activities: workspace.activities,
    });
  });

  test('leaves current navigation untouched when a stale resume target is restored', () => {
    const workspace = {
      publishers: [{ id: 'pub-1' }],
      books: [{ id: 'book-1', publisherId: 'pub-1' }],
      activities: [{ id: 'act-1', bookId: 'book-1' }],
      selPubId: 'pub-1',
      selBookId: 'book-1',
      selActId: 'act-1',
    };

    expect(
      restoreSessionResumeNavigation(workspace, {
        pubId: 'old-pub',
        bookId: 'old-book',
        actId: 'old-act',
      })
    ).toMatchObject({
      selPubId: 'pub-1',
      selBookId: 'book-1',
      selActId: 'act-1',
    });
  });

  test('tracks current same-session navigation including the publisher root for refresh', () => {
    saveActiveSessionNavigation('editor-1', 'session-1', {
      pubId: 'pub-1',
      bookId: 'book-1',
      actId: 'act-1',
    });
    expect(getActiveSessionNavigation('editor-1', 'session-1')).toEqual({
      pubId: 'pub-1',
      bookId: 'book-1',
      actId: 'act-1',
    });

    saveActiveSessionNavigation('editor-1', 'session-1', {
      pubId: null,
      bookId: null,
      actId: null,
    });
    expect(getActiveSessionNavigation('editor-1', 'session-1')).toEqual({
      pubId: null,
      bookId: null,
      actId: null,
    });

    clearActiveSessionNavigation('editor-1', 'session-1');
    expect(getActiveSessionNavigation('editor-1', 'session-1')).toBeNull();
  });

  test('opens the publisher root when a refresh navigation target was deleted', () => {
    expect(
      restoreActiveSessionNavigation(
        {
          publishers: [{ id: 'pub-1' }],
          books: [],
          activities: [],
          selPubId: 'pub-1',
          selBookId: null,
          selActId: null,
        },
        { pubId: 'pub-1', bookId: 'deleted-book', actId: 'deleted-activity' }
      )
    ).toMatchObject({
      selPubId: null,
      selBookId: null,
      selActId: null,
    });
  });
});
