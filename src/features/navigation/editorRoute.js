import { slugify } from '../../utils/editorHelpers';

export const EIC_NAV_VERSION = 1;

// URL segmenti: okunabilirlik icin "slug~id" melezi. Ayrac '~' (URL-guvenli, ne slug'da
// ne uid id'sinde bulunur) oldugu icin id her zaman son '~' sonrasidir; slug'siz/eski
// (yalniz id) URL'ler de calismaya devam eder. Kanonik anahtar daima id'dir.
const ID_SLUG_SEPARATOR = '~';

function buildRouteSegment(id, name) {
  const encodedId = encodeURIComponent(id);
  const slug = slugify(name || '');
  return slug ? `${slug}${ID_SLUG_SEPARATOR}${encodedId}` : encodedId;
}

function extractRouteId(rawSegment) {
  const decoded = decodeURIComponent(String(rawSegment || ''));
  const sepIndex = decoded.lastIndexOf(ID_SLUG_SEPARATOR);
  return sepIndex >= 0 ? decoded.slice(sepIndex + 1) : decoded;
}

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
    pubId: extractRouteId(pubMatch[1]),
    bookId: bookMatch ? extractRouteId(bookMatch[1]) : null,
    actId: actMatch ? extractRouteId(actMatch[1]) : null,
  });
}

export function buildEditorHashRoute(route = {}) {
  const normalized = normalizeEditorRoute(route);
  if (normalized.textStudio) return '#text-studio';
  if (!normalized.pubId) return '';

  // route.pubName/bookName/actName verilirse okunabilir slug eklenir (slug~id);
  // verilmezse yalniz id yazilir (geriye donuk uyum). Lookup daima id ile yapilir.
  let hash = `#/publisher/${buildRouteSegment(normalized.pubId, route.pubName)}`;
  if (normalized.bookId) hash += `/book/${buildRouteSegment(normalized.bookId, route.bookName)}`;
  if (normalized.bookId && normalized.actId) {
    hash += `/activity/${buildRouteSegment(normalized.actId, route.actName)}`;
  }
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
