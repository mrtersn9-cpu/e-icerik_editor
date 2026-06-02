import { clearStoredAuth, readStoredAuth, writeStoredAuth } from '../hooks/useAuth';

const AUTH_STORAGE_KEY = 'e-icerik-auth-v1';

describe('auth storage persistence', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  test('stores an authenticated session durably without storing a password', () => {
    const auth = {
      userId: 'kullanici1',
      sessionId: 'session-1',
      token: 'token-1',
    };

    writeStoredAuth(auth);

    expect(JSON.parse(window.localStorage.getItem(AUTH_STORAGE_KEY))).toEqual(auth);
    expect(JSON.parse(window.sessionStorage.getItem(AUTH_STORAGE_KEY))).toEqual(auth);
    expect(window.localStorage.getItem(AUTH_STORAGE_KEY)).not.toContain('password');
  });

  test('restores a session after the tab scoped copy is lost', () => {
    const auth = { userId: 'kullanici1', sessionId: 'session-1' };
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));

    expect(readStoredAuth()).toEqual(auth);
    expect(JSON.parse(window.sessionStorage.getItem(AUTH_STORAGE_KEY))).toEqual(auth);
  });

  test('migrates an existing sessionStorage login to durable storage', () => {
    const auth = { userId: 'kullanici1', sessionId: 'legacy-session' };
    window.sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));

    expect(readStoredAuth()).toEqual(auth);
    expect(JSON.parse(window.localStorage.getItem(AUTH_STORAGE_KEY))).toEqual(auth);
  });

  test('logout removes both durable and tab scoped copies', () => {
    writeStoredAuth({ userId: 'kullanici1', sessionId: 'session-1' });

    clearStoredAuth();

    expect(window.localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    expect(window.sessionStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
  });
});
