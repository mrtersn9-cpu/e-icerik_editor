import { orderBackDismissEntries } from '../features/navigation/backDismissStack';
import {
  buildEditorHashRoute,
  deriveLibraryMobileColumn,
  getEditorHistoryState,
  getParentEditorRoute,
  parseEditorHashRoute,
  resolveEditorRoute,
  resolveNavigationWriteMode,
  routeFromSelection,
  routesEqual,
  shouldWarnBeforeLeavingEditor,
  createEditorHistoryState,
} from '../features/navigation/editorRoute';

const state = {
  publishers: [{ id: 'pub-1', name: 'Yayınevi' }],
  books: [{ id: 'book-1', publisherId: 'pub-1', name: 'Kitap' }],
  activities: [{ id: 'act-1', bookId: 'book-1', name: 'Etkinlik' }],
};

test('editor route parse and build keep existing hash contract', () => {
  const route = parseEditorHashRoute('#/publisher/pub-1/book/book-1/activity/act-1');
  expect(route).toEqual({ pubId: 'pub-1', bookId: 'book-1', actId: 'act-1', textStudio: false });
  expect(buildEditorHashRoute(route)).toBe('#/publisher/pub-1/book/book-1/activity/act-1');
  expect(parseEditorHashRoute('#text-studio')).toEqual({
    pubId: null,
    bookId: null,
    actId: null,
    textStudio: true,
  });
});

test('invalid routes resolve to nearest valid library level', () => {
  expect(resolveEditorRoute({ pubId: 'pub-1', bookId: 'book-1', actId: 'missing' }, state)).toEqual({
    pubId: 'pub-1',
    bookId: 'book-1',
    actId: null,
    textStudio: false,
  });
  expect(resolveEditorRoute({ pubId: 'pub-1', bookId: 'missing', actId: 'act-1' }, state)).toEqual({
    pubId: 'pub-1',
    bookId: null,
    actId: null,
    textStudio: false,
  });
  expect(resolveEditorRoute({ pubId: 'missing', bookId: 'book-1', actId: 'act-1' }, state)).toEqual({
    pubId: null,
    bookId: null,
    actId: null,
    textStudio: false,
  });
});

test('route helpers derive parent and mobile column without touching activity focus', () => {
  const activityRoute = routeFromSelection({ selPubId: 'pub-1', selBookId: 'book-1', selActId: 'act-1' });
  expect(getParentEditorRoute(activityRoute)).toEqual({
    pubId: 'pub-1',
    bookId: 'book-1',
    actId: null,
    textStudio: false,
  });
  expect(deriveLibraryMobileColumn(activityRoute)).toBe('activities');
  expect(deriveLibraryMobileColumn({ pubId: 'pub-1' })).toBe('books');
  expect(routesEqual(activityRoute, parseEditorHashRoute(buildEditorHashRoute(activityRoute)))).toBe(true);
});

test('history state and leave warning predicates are deterministic', () => {
  const historyState = createEditorHistoryState({ pubId: 'pub-1' }, 7, 'overlay-guard', 'modal-a');
  expect(getEditorHistoryState(historyState)).toEqual({
    version: 1,
    kind: 'overlay-guard',
    route: { pubId: 'pub-1', bookId: null, actId: null, textStudio: false },
    cursor: 7,
    overlayId: 'modal-a',
  });
  expect(resolveNavigationWriteMode('pop')).toBe('none');
  expect(resolveNavigationWriteMode('replace')).toBe('replace');
  expect(resolveNavigationWriteMode('push')).toBe('push');
  expect(shouldWarnBeforeLeavingEditor({ dbStatus: 'connected' })).toBe(false);
  expect(shouldWarnBeforeLeavingEditor({ remoteSavePending: true })).toBe(true);
  expect(shouldWarnBeforeLeavingEditor({ dbStatus: 'reconnecting' })).toBe(true);
});

test('back dismiss entries close by priority and then lifo order', () => {
  const ordered = orderBackDismissEntries([
    { id: 'modal-a', priority: 10, order: 1 },
    { id: 'modal-b', priority: 10, order: 2 },
    { id: 'drawer', priority: 20, order: 1 },
  ]);
  expect(ordered.map((entry) => entry.id)).toEqual(['drawer', 'modal-b', 'modal-a']);
});
