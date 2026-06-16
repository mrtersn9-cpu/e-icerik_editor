const STORAGE_KEY = 'e-icerik-v4';
const AUTH_STORAGE_KEY = 'e-icerik-auth-v1';

function readStorageValue(storageName) {
  if (typeof window === 'undefined') return null;
  try {
    return window[storageName]?.getItem(AUTH_STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

function writeStorageValue(storageName, value) {
  if (typeof window === 'undefined') return;
  try {
    window[storageName]?.setItem(AUTH_STORAGE_KEY, value);
  } catch {
    // Ignore storage failures on restricted browsers.
  }
}

function removeStorageValue(storageName) {
  if (typeof window === 'undefined') return;
  try {
    window[storageName]?.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // Ignore storage failures on restricted browsers.
  }
}

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
  const localValue = readStorageValue('localStorage');
  const sessionValue = readStorageValue('sessionStorage');
  const raw = localValue || sessionValue;
  if (!raw) return null;
  try {
    const auth = JSON.parse(raw);
    // Iki depoyu senkronla (sekme-kapsamli oturum gocu) — yalniz FARKLIYSA yaz; her
    // okumada gereksiz storage yazimi yapma.
    if (localValue !== raw) writeStorageValue('localStorage', raw);
    if (sessionValue !== raw) writeStorageValue('sessionStorage', raw);
    return auth;
  } catch {
    return null;
  }
}

export function writeStoredAuth(auth) {
  const serialized = JSON.stringify(auth);
  writeStorageValue('localStorage', serialized);
  writeStorageValue('sessionStorage', serialized);
}

export function clearStoredAuth() {
  removeStorageValue('localStorage');
  removeStorageValue('sessionStorage');
}
