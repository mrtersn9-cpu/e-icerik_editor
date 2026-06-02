import {
  assertDatabaseReadyPayload,
  BOOT_DATABASE_WARNING_MS,
  createBootWaitingPayload,
  isDatabaseReadyPayload,
  isRemoteWorkspaceMutationLocked,
  requiresFreshEditorSession,
  shouldKeepBootVisibleForWorkspace,
} from '../utils/bootReadiness';

describe('boot database readiness guard', () => {
  test('accepts only explicit database ready payloads', () => {
    expect(
      isDatabaseReadyPayload({
        ok: true,
        api: 'ready',
        database: 'ready',
        databaseRequired: true,
      })
    ).toBe(true);

    expect(isDatabaseReadyPayload({ ok: true })).toBe(false);
    expect(
      isDatabaseReadyPayload({
        ok: true,
        api: 'ready',
        database: 'unavailable',
        databaseRequired: true,
      })
    ).toBe(false);
    expect(isDatabaseReadyPayload('<html>fallback</html>')).toBe(false);
  });

  test('throws for HTTP-200 payloads that do not prove database readiness', () => {
    expect(() => assertDatabaseReadyPayload({ ok: true })).toThrow(
      'SQL baglantisi dogrulanamadi'
    );
    expect(() =>
      assertDatabaseReadyPayload({
        ok: false,
        code: 'db_connection_failed',
        error: 'Database connection failed',
      })
    ).toThrow('Database connection failed');
  });

  test('keeps the waiting copy until the 60 second database threshold', () => {
    const error = { status: 503, code: 'db_connection_failed', message: 'Unavailable' };
    const initial = createBootWaitingPayload(BOOT_DATABASE_WARNING_MS - 1, error);
    const warning = createBootWaitingPayload(BOOT_DATABASE_WARNING_MS, error);

    expect(initial.title).toBe('Arayüz hazırlanıyor...');
    expect(initial.detail).toBe('');
    expect(warning.title).toBe('SQL bağlantısı sağlanamadı');
    expect(warning.detail).toContain('db_connection_failed');
  });

  test('locks remote edits while a signed-in workspace is connecting', () => {
    expect(isRemoteWorkspaceMutationLocked('editor-1', 'connecting')).toBe(true);
    expect(isRemoteWorkspaceMutationLocked('editor-1', 'reconnecting')).toBe(true);
    expect(isRemoteWorkspaceMutationLocked('editor-1', 'connected')).toBe(false);
    expect(isRemoteWorkspaceMutationLocked('', 'reconnecting')).toBe(false);
  });

  test('keeps the boot surface visible only while the first remote workspace is loading', () => {
    expect(shouldKeepBootVisibleForWorkspace('editor-1', 'connecting', false)).toBe(true);
    expect(shouldKeepBootVisibleForWorkspace('editor-1', 'reconnecting', false)).toBe(true);
    expect(shouldKeepBootVisibleForWorkspace('editor-1', 'reconnecting', true)).toBe(false);
    expect(shouldKeepBootVisibleForWorkspace('', 'connecting', false)).toBe(false);
  });

  test('sends expired or invalid authenticated workspaces back to login', () => {
    expect(requiresFreshEditorSession({ code: 'SESSION_EXPIRED' })).toBe(true);
    expect(requiresFreshEditorSession({ code: 'INVALID_SESSION_TOKEN' })).toBe(true);
    expect(requiresFreshEditorSession({ status: 401 })).toBe(true);
    expect(requiresFreshEditorSession({ code: 'db_connection_failed', status: 503 })).toBe(false);
  });
});
