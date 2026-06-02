export const EIC_NAV_VERSION = 1;

export function normalizeEditorRoute(route = {}) {
  return {
    pubId: route.pubId || null,
    bookId: route.bookId || null,
    actId: route.actId || null,
    textStudio: Boolean(route.textStudio),
  };
}

export function parseEditorHashRoute(hash = '') {
  if (!hash || hash === '#' || hash === '#/') return normalizeEditorRoute();
  if (hash === '#text-studio') return normalizeEditorRoute({ textStudio: true });

  const path = String(hash).replace(/^#\/?/, '');
  const pubMatch = path.match(/^publisher\/([^/]+)/);
  if (!pubMatch) return normalizeEditorRoute();

  const bookMatch = path.match(/\/book\/([^/]+)/);
  const actMatch = path.match(/\/activity\/([^/]+)/);

  return normalizeEditorRoute({
    pubId: decodeURIComponent(pubMatch[1]),
    bookId: bookMatch ? decodeURIComponent(bookMatch[1]) : null,
    actId: actMatch ? decodeURIComponent(actMatch[1]) : null,
  });
}

export function buildEditorHashRoute(route = {}) {
  const normalized = normalizeEditorRoute(route);
  if (normalized.textStudio) return '#text-studio';
  if (!normalized.pubId) return '';

  let hash = `#/publisher/${encodeURIComponent(normalized.pubId)}`;
  if (normalized.bookId) hash += `/book/${encodeURIComponent(normalized.bookId)}`;
  if (normalized.bookId && normalized.actId) hash += `/activity/${encodeURIComponent(normalized.actId)}`;
  return hash;
}

export function buildEditorUrl(route = {}, locationLike = null) {
  const hash = buildEditorHashRoute(route);
  if (!locationLike) return hash;
  const base = `${locationLike.pathname || ''}${locationLike.search || ''}`;
  return hash ? `${base}${hash}` : base || './';
}

export function routeFromSelection(selection = {}) {
  return normalizeEditorRoute({
    pubId: selection.selPubId || null,
    bookId: selection.selBookId || null,
    actId: selection.selActId || null,
  });
}

export function routesEqual(a = {}, b = {}) {
  const left = normalizeEditorRoute(a);
  const right = normalizeEditorRoute(b);
  return (
    left.pubId === right.pubId &&
    left.bookId === right.bookId &&
    left.actId === right.actId &&
    left.textStudio === right.textStudio
  );
}

export function getParentEditorRoute(route = {}) {
  const normalized = normalizeEditorRoute(route);
  if (normalized.textStudio) return normalizeEditorRoute({
    pubId: normalized.pubId,
    bookId: normalized.bookId,
    actId: normalized.actId,
  });
  if (normalized.actId) return normalizeEditorRoute({ pubId: normalized.pubId, bookId: normalized.bookId });
  if (normalized.bookId) return normalizeEditorRoute({ pubId: normalized.pubId });
  return normalizeEditorRoute();
}

export function deriveLibraryMobileColumn(route = {}) {
  const normalized = normalizeEditorRoute(route);
  if (normalized.bookId || normalized.actId) return 'activities';
  if (normalized.pubId) return 'books';
  return 'publishers';
}

export function resolveEditorRoute(route = {}, state = {}) {
  const normalized = normalizeEditorRoute(route);
  if (normalized.textStudio) return normalized;

  const publishers = Array.isArray(state.publishers) ? state.publishers : [];
  const books = Array.isArray(state.books) ? state.books : [];
  const activities = Array.isArray(state.activities) ? state.activities : [];

  if (!normalized.pubId) return normalizeEditorRoute();

  const publisher = publishers.find((item) => item.id === normalized.pubId);
  if (!publisher) return normalizeEditorRoute();

  if (!normalized.bookId) return normalizeEditorRoute({ pubId: normalized.pubId });

  const book = books.find((item) => item.id === normalized.bookId && item.publisherId === normalized.pubId);
  if (!book) return normalizeEditorRoute({ pubId: normalized.pubId });

  if (!normalized.actId) return normalizeEditorRoute({ pubId: normalized.pubId, bookId: normalized.bookId });

  const activity = activities.find((item) => item.id === normalized.actId && item.bookId === normalized.bookId);
  if (!activity) return normalizeEditorRoute({ pubId: normalized.pubId, bookId: normalized.bookId });

  return normalized;
}

export function createEditorHistoryState(route = {}, cursor = 0, kind = 'route', overlayId = '') {
  return {
    eicNav: {
      version: EIC_NAV_VERSION,
      kind,
      route: normalizeEditorRoute(route),
      cursor,
      overlayId: overlayId || undefined,
    },
  };
}

export function getEditorHistoryState(state = null) {
  const nav = state?.eicNav;
  if (!nav || nav.version !== EIC_NAV_VERSION) return null;
  return {
    version: nav.version,
    kind: nav.kind === 'overlay-guard' ? 'overlay-guard' : 'route',
    route: normalizeEditorRoute(nav.route || {}),
    cursor: Number(nav.cursor) || 0,
    overlayId: nav.overlayId || '',
  };
}

export function resolveNavigationWriteMode(source = 'push') {
  if (source === 'pop') return 'none';
  if (source === 'replace') return 'replace';
  return 'push';
}

export function shouldWarnBeforeLeavingEditor({ remoteSavePending = false, offlineDraftPending = false, dbStatus = '' } = {}) {
  return Boolean(remoteSavePending || offlineDraftPending || dbStatus === 'reconnecting');
}
