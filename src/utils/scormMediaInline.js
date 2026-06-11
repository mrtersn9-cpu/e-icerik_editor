// SCORM paketleri çevrimdışı (internetsiz LMS) çalışabilmeli: sunucuya yüklenmiş
// medya (http/https URL) dışa aktarım öncesi indirilip data URL olarak pakete
// gömülür. Yalnızca bilinen MEDYA alanları gömülür; `embedUrl` / tetikleyici
// `openUrl` gibi gerçek web bağlantıları bilinçli olarak kapsam DIŞIDIR.

export const INLINE_MEDIA_FIELDS = [
  'mediaUrl',
  'imageData',
  'livesCustomImage',
  'audioUrl',
  'hotspotImage',
];

const HTTP_PATTERN = /^https?:\/\//i;

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Dosya okunamadı'));
    reader.readAsDataURL(blob);
  });
}

async function fetchAsDataUrl(url, maxBytesPerFile) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const blob = await response.blob();
  if (maxBytesPerFile && blob.size > maxBytesPerFile) {
    throw new Error(`Dosya çok büyük (${Math.round(blob.size / (1024 * 1024))} MB)`);
  }
  return { dataUrl: await blobToDataUrl(blob), bytes: blob.size };
}

// Derin gezinme: INLINE_MEDIA_FIELDS alanlarındaki http(s) değerlerin
// (tutucu nesne, alan adı, yol) referanslarını toplar. data:/blob:/göreli
// yollar zaten paket içinde çalıştığından atlanır.
function collectInlineTargets(value, path, found) {
  if (!value) return found;
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectInlineTargets(item, `${path}[${index}]`, found));
    return found;
  }
  if (typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) => {
      const childPath = path ? `${path}.${key}` : key;
      if (
        INLINE_MEDIA_FIELDS.includes(key) &&
        typeof item === 'string' &&
        HTTP_PATTERN.test(item.trim())
      ) {
        const url = item.trim();
        if (!found.has(url)) found.set(url, []);
        found.get(url).push({ holder: value, key, path: childPath });
        return;
      }
      collectInlineTargets(item, childPath, found);
    });
  }
  return found;
}

// Yalnızca tarama (mutasyon yok): gömülebilir harici medya URL'lerinin listesi.
// TTKB denetçisi medya (gömülebilir) ile web bağlantısını ayırmak için kullanır.
export function collectExternalMediaUrls(value = {}) {
  return [...collectInlineTargets(value, '', new Map()).keys()];
}

// Durumdaki tüm harici medya URL'lerini data URL'e çevirir.
// Dönüş: { state, inlined: [{url, paths, bytes}], failed: [{url, paths, error}] }
// Başarısız indirmelerde orijinal URL korunur (failed listesi UI'da gösterilir).
export async function inlineExternalMediaForExport(
  state = {},
  { maxBytesPerFile = 25 * 1024 * 1024 } = {}
) {
  const next = JSON.parse(JSON.stringify(state));
  const found = collectInlineTargets(next, '', new Map());
  const inlined = [];
  const failed = [];
  for (const [url, targets] of found.entries()) {
    try {
      // URL başına TEK indirme; aynı URL'yi kullanan tüm alanlara yazılır.
      const { dataUrl, bytes } = await fetchAsDataUrl(url, maxBytesPerFile);
      targets.forEach(({ holder, key }) => {
        holder[key] = dataUrl;
      });
      inlined.push({ url, paths: targets.map((t) => t.path).slice(0, 3), bytes });
    } catch (error) {
      failed.push({
        url,
        paths: targets.map((t) => t.path).slice(0, 3),
        error: error?.message || String(error),
      });
    }
  }
  return { state: next, inlined, failed };
}

// Tekil etkinlik varyantı (TTKB panelindeki "Düzelt" eylemi için).
export async function inlineExternalMediaForActivity(activity = {}, options = {}) {
  const result = await inlineExternalMediaForExport({ activities: [activity] }, options);
  return {
    activity: result.state.activities?.[0] || activity,
    inlined: result.inlined,
    failed: result.failed,
  };
}
