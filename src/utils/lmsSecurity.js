import { DEFAULT_LMS_CONFIG } from '../constants';


export const REDACTED_SECRET_VALUE = '__REDACTED_SECRET__';
export const SENSITIVE_LMS_KEYS = ['xapiKey', 'xapiSecret', 'ltiConsumerKey', 'ltiSharedSecret'];
export const EXTERNAL_URL_RE = /^https?:\/\//i;

export function hasLmsSecrets(value = {}) {
  return SENSITIVE_LMS_KEYS.some(
    (key) => String(value?.[key] || '').trim() && value[key] !== REDACTED_SECRET_VALUE
  );
}

export function maskLmsSecrets(config = {}, redactionValue = '') {
  const next = { ...(config || {}) };
  SENSITIVE_LMS_KEYS.forEach((key) => {
    if (next[key] === REDACTED_SECRET_VALUE || String(next[key] || '').trim()) {
      next[key] = redactionValue;
    }
  });
  return next;
}

export function clearRedactedLmsSecrets(config = {}) {
  const next = { ...(config || {}) };
  SENSITIVE_LMS_KEYS.forEach((key) => {
    if (next[key] === REDACTED_SECRET_VALUE) next[key] = '';
  });
  return next;
}

export function normalizeScorm12LmsConfig(config = {}) {
  const next = clearRedactedLmsSecrets({ ...DEFAULT_LMS_CONFIG, ...(config || {}) });
  SENSITIVE_LMS_KEYS.forEach((key) => {
    delete next[key];
  });
  delete next.xapiEndpoint;
  delete next.xapiActivityId;
  delete next.cmi5FetchUrl;
  delete next.cmi5MoveOn;
  delete next.ltiLaunchUrl;
  return {
    ...next,
    standard: 'scorm12',
  };
}

export function collectExternalUrls(value, path = '', found = new Map()) {
  if (value == null) return found;
  if (typeof value === 'string') {
    const matches = value.match(/https?:\/\/[^\s"'<>]+/gi) || [];
    matches.forEach((url) => {
      const list = found.get(url) || [];
      list.push(path || 'state');
      found.set(url, list);
    });
    if (!matches.length) {
      const trimmed = value.trim();
      if (EXTERNAL_URL_RE.test(trimmed)) {
        const list = found.get(trimmed) || [];
        list.push(path || 'state');
        found.set(trimmed, list);
      }
    }
    return found;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectExternalUrls(item, `${path}[${index}]`, found));
    return found;
  }
  if (typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) => {
      if (SENSITIVE_LMS_KEYS.includes(key)) return;
      collectExternalUrls(item, path ? `${path}.${key}` : key, found);
    });
  }
  return found;
}

export function summarizeExternalUrlsForScorm(state = {}) {
  return [...collectExternalUrls(state).entries()].map(([url, paths]) => ({
    url,
    paths: [...new Set(paths)].slice(0, 3),
  }));
}


