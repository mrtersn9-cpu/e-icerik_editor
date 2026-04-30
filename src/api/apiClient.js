import { readStoredAuth } from '../hooks/useAuth';

const API_PORT = Number(process.env.REACT_APP_API_PORT || 4001);

function normalizeApiPath(path = '') {
  let normalized = String(path || '/').trim() || '/';
  if (!normalized.startsWith('/')) normalized = `/${normalized}`;
  if (normalized === '/api') return '/';
  if (normalized.startsWith('/api/')) normalized = normalized.slice(4) || '/';
  return normalized;
}

function getApiBase() {
  if (typeof window === 'undefined') return `http://localhost:${API_PORT}/api`;
  const isLocalHost =
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (isLocalHost && window.location.port !== String(API_PORT)) {
    return `http://localhost:${API_PORT}/api`;
  }
  const { origin, pathname } = window.location;
  const trimmedPath = pathname.replace(/\/+$|^\/+/g, '');
  const lastSegment = trimmedPath.split('/').pop() || '';
  const hasFileExtension = lastSegment.includes('.');
  let basePath = '';
  if (trimmedPath && trimmedPath !== '') {
    basePath = hasFileExtension ? trimmedPath.slice(0, trimmedPath.lastIndexOf('/')) : trimmedPath;
  }
  return `${origin}${basePath ? `/${basePath}` : ''}/api`;
}

function getApiUrl(path = '') {
  const normalizedPath = normalizeApiPath(path);
  if (typeof window === 'undefined') return `${getApiBase()}${normalizedPath}`;
  const isLocalHost =
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (isLocalHost && window.location.port !== String(API_PORT)) {
    return `${getApiBase()}${normalizedPath}`;
  }

  const [routePath, queryString = ''] = normalizedPath.split('?');
  const params = new URLSearchParams(queryString);
  params.set('route', routePath || '/');
  return `${getApiBase()}/index.php?${params.toString()}`;
}

async function safeParseJson(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function apiRequest(path, options = {}) {
  const auth = readStoredAuth();
  const headers = {
    'Content-Type': 'application/json',
    ...(auth?.token ? { Authorization: `Bearer ${auth.token}` } : {}),
    ...(auth?.userId ? { 'X-User-Id': auth.userId } : {}),
    ...(auth?.sessionId ? { 'X-Session-Id': auth.sessionId } : {}),
    ...(options.headers || {}),
  };
  const response = await fetch(getApiUrl(path), {
    ...options,
    headers,
  });

  const contentType = response.headers.get('Content-Type') || '';
  const payload = contentType.includes('application/json')
    ? await safeParseJson(response)
    : await safeParseJson(response);

  if (!response.ok) {
    const statusFallbackMessages = {
      509: 'Sunucu kaynak/bant genisligi limiti dolmus gorunuyor. Biraz bekleyip tekrar deneyin veya hosting panelindeki limitleri kontrol edin.',
    };
    const message =
      payload?.error ||
      payload?.message ||
      statusFallbackMessages[response.status] ||
      `API ${response.status}`;
    const error = new Error(message);
    error.apiPath = path;
    error.status = response.status;
    error.code = payload?.code || '';
    error.session = payload?.session || null;
    error.lock = payload?.lock || null;
    error.waitSeconds = payload?.waitSeconds ?? null;
    error.kickPending = payload?.kickPending || false;
    throw error;
  }

  return payload;
}

export async function adminApiRequest(path, options = {}) {
  const { adminToken = '', headers: optionHeaders = {}, ...requestOptions } = options;
  const headers = {
    'Content-Type': 'application/json',
    'X-Admin-Token': adminToken,
    ...optionHeaders,
  };
  const response = await fetch(getApiUrl(path), {
    ...requestOptions,
    headers,
  });
  const contentType = response.headers.get('Content-Type') || '';
  const payload = contentType.includes('application/json')
    ? await safeParseJson(response)
    : await safeParseJson(response);

  if (!response.ok) {
    const statusFallbackMessages = {
      509: 'Sunucu kaynak/bant genisligi limiti dolmus gorunuyor. Biraz bekleyip tekrar deneyin veya hosting panelindeki limitleri kontrol edin.',
    };
    const message =
      payload?.error ||
      payload?.message ||
      statusFallbackMessages[response.status] ||
      `API ${response.status}`;
    const error = new Error(message);
    error.apiPath = path;
    error.status = response.status;
    error.code = payload?.code || '';
    throw error;
  }

  return payload;
}

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Dosya okunamadi.'));
    reader.readAsDataURL(file);
  });
}

export async function uploadMediaFile(file) {
  if (!file) return '';
  try {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(getApiUrl('/upload'), {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      throw new Error(`Upload ${response.status}`);
    }
    const data = await safeParseJson(response);
    if (data?.ok && data?.url) return data.url;
    throw new Error(data?.error || 'Upload basarisiz');
  } catch (error) {
    // upload failed, fall back to data URL
    return fileToDataUrl(file);
  }
}
