const objectTypeLabels = {
  audio: 'Ses',
  button: 'Buton',
  draggable: 'Sürükle',
  dropzone: 'Bırakma',
  embed: 'Web',
  hotspot: 'Hotspot',
  image: 'Resim',
  shape: 'Şekil',
  text: 'Metin',
  video: 'Video',
};

const runtimeActionLabels = {
  'runtime:complete': 'Etkinliği kapat',
  'runtime:help': 'Menü / Yardım',
  'runtime:restart': 'Yeniden başlat',
  'runtime:show-answer': 'Cevabı göster',
  'runtime:toggle-mute': 'Sesi kapat/aç',
  'runtime:toggle-play-pause': 'Oynat / Duraklat',
};

function safeText(value = '') {
  return String(value || '').trim();
}

function looksLikeRawId(value = '') {
  const text = safeText(value);
  return /^[a-z0-9_-]{8,}$/i.test(text) && !/\s/.test(text);
}

function objectLabel(object = null) {
  if (!object) return '';
  const candidates = [object.editorName, object.label, object.name, object.text]
    .map((value) => safeText(value))
    .filter((value) => value && !looksLikeRawId(value));
  return candidates[0] || objectTypeLabels[object.type] || 'Nesne';
}

function slideLabel(slide = null, index = 0) {
  if (!slide) return '';
  return safeText(slide.name) || safeText(slide.sceneName) || `${index + 1}. Sahne`;
}

function layerLabel(layer = null, index = 0, resolvedNames = {}) {
  if (!layer) return '';
  return resolvedNames[layer.id] || (layer.kind === 'base' ? 'Temel Katman' : safeText(layer.name) || `${index + 1}. Katman`);
}

function activityLabel(activity = null, index = 0) {
  if (!activity) return '';
  return safeText(activity.name) || safeText(activity.sceneName) || `Etkinlik ${index + 1}`;
}

function specialValueLabel(value = '') {
  const text = safeText(value);
  if (!text) return 'Hedef seçilmemiş';
  if (text === '__next__') return 'Sonraki sahne';
  if (text === '__prev__') return 'Önceki sahne';
  if (text === '__activity__') return 'Sahne';
  if (text === 'Secili Nesne') return 'Seçili nesne';
  if (text === 'none') return 'Hedef yok';
  return '';
}

export function getFriendlyTriggerSourceLabel(trigger = {}, context = {}) {
  const when = trigger.when || 'onClick';
  if (when === 'onLoad') return 'Sahne açılınca';
  if (when === 'onHover') return 'Üzerine gelince';
  if (when === 'onTimelineStart') return 'Zaman çizelgesi başlangıcı';
  if (when === 'onTimelineEnd') return 'Zaman çizelgesi sonu';

  const sourceValue = trigger.source || trigger.target || 'Secili Nesne';
  const special = specialValueLabel(sourceValue);
  if (special) return special;

  const object = (context.objects || []).find((item) => item.id === sourceValue);
  if (object) return objectLabel(object);
  return looksLikeRawId(sourceValue) ? 'Silinmiş nesne' : safeText(sourceValue) || 'Seçili nesne';
}

export function getFriendlyTriggerValueLabel(trigger = {}, context = {}) {
  const value = trigger.value;
  const special = specialValueLabel(value);
  if (special) return special;

  if (trigger.action === 'KatmanaGec') {
    const layerIndex = (context.layers || []).findIndex((item) => item.id === value);
    if (layerIndex >= 0) return layerLabel(context.layers[layerIndex], layerIndex, context.resolvedLayerNames || {});
    return value ? 'Silinmiş katman' : 'Katman seçilmemiş';
  }

  if (trigger.action === 'SliderGec') {
    const slideIndex = (context.slides || []).findIndex((item) => item.id === value);
    if (slideIndex >= 0) return slideLabel(context.slides[slideIndex], slideIndex);
    return value ? 'Silinmiş sahne' : 'Sahne seçilmemiş';
  }

  if (trigger.action === 'SayfaGec') {
    const activityIndex = (context.activities || []).findIndex((item) => item.id === value);
    if (activityIndex >= 0) return activityLabel(context.activities[activityIndex], activityIndex);
    return value ? 'Silinmiş etkinlik' : 'Etkinlik seçilmemiş';
  }

  if (runtimeActionLabels[trigger.action]) return runtimeActionLabels[trigger.action];

  const object = (context.objects || []).find((item) => item.id === value);
  if (object) return objectLabel(object);

  return looksLikeRawId(value) ? 'Silinmiş hedef' : safeText(value) || 'Hedef seçilmemiş';
}
