// Değişken paneli için saf yardımcı fonksiyonlar (etiketleme, biçimlendirme,
// kullanım sayımı ve yerleşik değişken satırlarının üretimi).
// EIcerikEditor.jsx içinden çıkarıldı; davranış birebir korunmuştur.

import { VARIABLE_TYPES } from '../constants';

import { getActivitySlides, getActivityLayers } from './activityHelpers';

// Değişken türü kodunu kullanıcıya gösterilecek etikete çevirir.
export function getVariableTypeLabel(type = 'text') {
  return VARIABLE_TYPES.find((item) => item.value === type)?.label || type;
}

// Değişken değerini türüne göre okunabilir metne biçimlendirir.
export function formatVariableValue(value, type = 'text') {
  if (type === 'boolean') return value ? 'True' : 'False';
  if (type === 'number') return Number.isFinite(Number(value)) ? String(Number(value)) : '0';
  return String(value ?? '');
}

// Renk seçici için geçerli bir #RRGGBB değeri ayıklar; yoksa yedek rengi döndürür.
export function resolveColorPickerValue(value, fallback = '#111111') {
  const match = String(value || '').match(/#[0-9a-fA-F]{6}/);
  return match ? match[0] : fallback;
}

// Tetikleyiciler üzerinden her değişkenin kaç kez kullanıldığını sayar.
export function buildVariableUsageCountMap(activities = []) {
  return (activities || []).reduce((counts, activity) => {
    getActivitySlides(activity).forEach((slide) => {
      (slide.triggers || []).forEach((trigger) => {
        if (
          ['DegiskenAta', 'DegiskenArttir', 'DegiskenAzalt'].includes(trigger?.action) &&
          trigger?.value
        ) {
          counts[trigger.value] = (counts[trigger.value] || 0) + 1;
        }
        (trigger?.conditions || []).forEach((condition) => {
          if (condition?.sourceType === 'variable' && condition?.sourceId) {
            counts[condition.sourceId] = (counts[condition.sourceId] || 0) + 1;
          }
        });
      });
    });
    return counts;
  }, {});
}

// Proje/kitap/etkinlik bağlamından yerleşik (built-in) değişken satırlarını oluşturur.
export function buildBuiltInVariableRows({ activity = {}, projectName = '', bookName = '' } = {}) {
  const slides = getActivitySlides(activity);
  const currentSlideIndex =
    Math.max(
      0,
      slides.findIndex((slide) => slide.id === activity?.currentSlideId)
    ) + 1;
  return [
    {
      id: 'builtin.project',
      name: 'Project.Title',
      type: 'text',
      value: projectName || 'İsimsiz Proje',
      useCount: 0,
    },
    {
      id: 'builtin.book',
      name: 'Book.Title',
      type: 'text',
      value: bookName || 'İsimsiz Kitap',
      useCount: 0,
    },
    {
      id: 'builtin.activity',
      name: 'Activity.Name',
      type: 'text',
      value: activity?.name || 'İsimsiz Etkinlik',
      useCount: 0,
    },
    {
      id: 'builtin.scene',
      name: 'Scene.Name',
      type: 'text',
      value: activity?.sceneName || 'İsimsiz Sahne',
      useCount: 0,
    },
    {
      id: 'builtin.slideIndex',
      name: 'Slide.Index',
      type: 'number',
      value: currentSlideIndex,
      useCount: 0,
    },
    {
      id: 'builtin.slideCount',
      name: 'Slide.Count',
      type: 'number',
      value: slides.length,
      useCount: 0,
    },
    {
      id: 'builtin.layerCount',
      name: 'Layer.Count',
      type: 'number',
      value: getActivityLayers(activity).length,
      useCount: 0,
    },
    {
      id: 'builtin.objectCount',
      name: 'Object.Count',
      type: 'number',
      value: Array.isArray(activity?.objects) ? activity.objects.length : 0,
      useCount: 0,
    },
  ];
}
