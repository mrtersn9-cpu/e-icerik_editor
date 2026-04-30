export function getAssetBaseUrl() {
  if (
    typeof window !== 'undefined' &&
    typeof window.__EIC_ASSET_BASE__ === 'string' &&
    window.__EIC_ASSET_BASE__
  ) {
    return window.__EIC_ASSET_BASE__;
  }

  if (typeof globalThis !== 'undefined' && typeof globalThis.location?.href === 'string') {
    return new URL('./', globalThis.location.href).href;
  }

  return '/';
}

export function getAssetUrl(relativePath = '') {
  const cleanPath = String(relativePath || '').replace(/^\/+/, '');
  return new URL(cleanPath, getAssetBaseUrl()).href;
}
