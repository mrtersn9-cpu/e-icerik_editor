export const BOOT_DATABASE_WARNING_MS = 60_000;

export function isDatabaseReadyPayload(payload) {
  return (
    payload &&
    payload.ok === true &&
    payload.api === 'ready' &&
    payload.database === 'ready' &&
    payload.databaseRequired === true
  );
}

export function assertDatabaseReadyPayload(payload) {
  if (isDatabaseReadyPayload(payload)) return payload;

  const error = new Error(
    payload?.error ||
      payload?.message ||
      'SQL baglantisi dogrulanamadi. Veritabani hazir cevabi alinmadi.'
  );
  error.code = payload?.code || 'db_not_ready';
  error.payload = payload;
  throw error;
}

export function createBootWaitingPayload(elapsedMs, error = null) {
  const warning = Number(elapsedMs) >= BOOT_DATABASE_WARNING_MS;
  let detail = '';

  if (warning && error) {
    const code = error.code ? ` (${error.code})` : '';
    const status = error.status ? `HTTP ${error.status}` : 'İstek başarısız';
    detail = `${status}${code}: ${error.message || 'SQL bağlantısı doğrulanamadı'}`;
  }

  return {
    tone: warning ? 'warning' : '',
    badge: warning ? 'SQL Bağlantısı Bekleniyor' : 'Editör Başlatılıyor',
    title: warning ? 'SQL bağlantısı sağlanamadı' : 'Arayüz hazırlanıyor...',
    body: warning
      ? 'Bağlantı bekleniyor. SQL hazır olduğunda editör otomatik açılacak.'
      : 'SQL bağlantısı doğrulanıyor. Çalışma alanı hazır olunca editör açılacak.',
    detail,
  };
}

export function isRemoteWorkspaceMutationLocked(userId, dbStatus) {
  return !!userId && (dbStatus === 'connecting' || dbStatus === 'reconnecting');
}

export function shouldKeepBootVisibleForWorkspace(userId, dbStatus, hasLoadedRemoteWorkspace) {
  return isRemoteWorkspaceMutationLocked(userId, dbStatus) && !hasLoadedRemoteWorkspace;
}

export function requiresFreshEditorSession(error) {
  return (
    error?.status === 401 ||
    error?.code === 'INVALID_SESSION_TOKEN' ||
    error?.code === 'SESSION_EXPIRED'
  );
}
