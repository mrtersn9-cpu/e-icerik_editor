// Timeline satırlarında nesne tipini net gösteren Türkçe rozet etiketi.
// Tek harf ikon yerine "SVG / Resim / Sürüklenebilir / Hazır Buton" gibi
// ayrım yapan kısa etiketler üretir; renk tonu getTimelineClipTone'dan gelir.

const TYPE_LABELS = {
  draggable: 'Sürüklenebilir',
  dropzone: 'Bırakma Alanı',
  text: 'Metin',
  shape: 'Şekil',
  audio: 'Ses',
  video: 'Video',
  hotspot: 'Hotspot',
  table: 'Tablo',
  chart: 'Grafik',
  embed: 'Gömülü',
  'custom-widget': 'Widget',
};

export function getTrackBadge(object = {}) {
  if (!object || typeof object !== 'object') return { key: 'none', label: 'Nesne' };
  const type = String(object.type || '');

  if (type === 'image') {
    const isSvg =
      /^data:image\/svg\+xml/i.test(String(object.imageData || '')) ||
      /\.svg(\?|#|$)/i.test(String(object.mediaUrl || ''));
    return isSvg ? { key: 'svg', label: 'SVG' } : { key: 'image', label: 'Resim' };
  }

  if (type === 'button') {
    // Hazır butonlar: preset/şablon kaynaklı veya ikon-etiket çifti bağlı butonlar.
    const isReady = !!(
      object.readyButtonPresetId ||
      object.sceneTemplateSlotId ||
      object.linkedHoverGroup ||
      String(object.generatedBy || '').trim()
    );
    return isReady ? { key: 'ready-button', label: 'Hazır Buton' } : { key: 'button', label: 'Düğme' };
  }

  return { key: type || 'none', label: TYPE_LABELS[type] || 'Nesne' };
}
