const STORAGE_KEY = 'e-icerik-v4';
const AUTH_STORAGE_KEY = 'e-icerik-auth-v1';

export function getUserStorageKey(userId) {
  return `${STORAGE_KEY}:${userId || 'guest'}`;
}

export function createSessionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createSessionLabel() {
  if (typeof window === 'undefined') return 'Editor Oturumu';
  const platform = window.navigator?.platform || 'Masaustu';
  return `${platform} / ${window.location.host || 'local'}`;
}

export function readStoredAuth() {
  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeStoredAuth(auth) {
  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
  } catch {
    // Ignore storage failures on restricted browsers.
  }
}

export function clearStoredAuth() {
  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // Ignore storage failures on restricted browsers.
  }
}
