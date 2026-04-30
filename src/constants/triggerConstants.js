// ─── Değişken ve Trigger Sabitleri ────────────────────────────────────────────

export const VARIABLE_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'True/False' },
];

export const TRIGGER_ACTION_OPTIONS = [
  // Navigation
  { value: 'YenidenBaslat', label: 'Yeniden Baslat', group: 'nav' },
  { value: 'SliderGec', label: 'Slidera Gec', group: 'nav' },
  { value: 'SayfaGec', label: 'Sayfaya Gec', group: 'nav' },
  { value: 'KatmanaGec', label: 'Katmana Gec', group: 'nav' },
  { value: 'LightboxAc', label: 'Lightbox Ac', group: 'nav' },
  { value: 'URLAc', label: 'URL / Baglanti Ac', group: 'nav' },
  // Visibility
  { value: 'Goster', label: 'Nesne Goster', group: 'viz' },
  { value: 'Gizle', label: 'Nesne Gizle', group: 'viz' },
  { value: 'NesneDurumuAyarla', label: 'Nesne Durumu Ayarla', group: 'viz' },
  { value: 'NesneToggle', label: 'Gorunurlugu Degistir', group: 'viz' },
  // Variables
  { value: 'DegiskenAta', label: 'Degisken Ata', group: 'var' },
  { value: 'DegiskenArttir', label: 'Degisken Arttir', group: 'var' },
  { value: 'DegiskenAzalt', label: 'Degisken Azalt', group: 'var' },
  // Media
  { value: 'SesCal', label: 'Ses Cal', group: 'media' },
  { value: 'SesDurdur', label: 'Ses Durdur', group: 'media' },
  { value: 'VideoCal', label: 'Video Oynat', group: 'media' },
  { value: 'VideoDurdur', label: 'Video Duraklat', group: 'media' },
  { value: 'AnimasyonBaslat', label: 'Animasyon Baslat', group: 'media' },
  // Timeline
  { value: 'ZamanCizelgesiBaslat', label: 'Timeline Baslat', group: 'timeline' },
  { value: 'ZamanCizelgesiDurdur', label: 'Timeline Durdur', group: 'timeline' },
  { value: 'ZamanCizelgesiAtla', label: 'Cue Noktasina Atla', group: 'timeline' },
  // LMS / Quiz
  { value: 'SonucGonder', label: 'Sonuc Gonder (LMS)', group: 'lms' },
  { value: 'TamamlaGonder', label: 'Tamamlama Gonder', group: 'lms' },
  // Advanced
  { value: 'Yazdir', label: 'Sayfayi Yazdir', group: 'advanced' },
  { value: 'ScrollTo', label: 'Nesneye Kaydir', group: 'advanced' },
];

export const TRIGGER_WHEN_OPTIONS = [
  { value: 'onClick', label: 'Tiklandiginda', group: 'user' },
  { value: 'onHover', label: 'Uzerine gelince', group: 'user' },
  { value: 'onDrop', label: 'Birakilinca', group: 'user' },
  { value: 'onDragEnter', label: 'Surukle girdi', group: 'user' },
  { value: 'onDragLeave', label: 'Surukle cikti', group: 'user' },
  { value: 'onKeypress', label: 'Tusa basilinca', group: 'user' },
  { value: 'onDoubleClick', label: 'Cift tiklaninca', group: 'user' },
  { value: 'onLoad', label: 'Sahne yuklenince', group: 'scene' },
  { value: 'onOffSlide', label: 'Sahneden cikinca', group: 'scene' },
  { value: 'onTimer', label: 'Zamanlayici dolunca', group: 'scene' },
  { value: 'onTimelineEnd', label: 'Timeline bitince', group: 'scene' },
  { value: 'onMediaEnd', label: 'Medya bitince', group: 'media' },
  { value: 'onMediaStart', label: 'Medya basladiginda', group: 'media' },
  { value: 'onStateChange', label: 'Durum degisince', group: 'data' },
  { value: 'onVariableChange', label: 'Degisken degisince', group: 'data' },
  { value: 'onDropCorrect', label: 'Dogru birakma', group: 'quiz' },
  { value: 'onDropIncorrect', label: 'Yanlis birakma', group: 'quiz' },
  { value: 'onSubmit', label: 'Gonderildiginde', group: 'quiz' },
];

export const TRIGGER_OPERATOR_OPTIONS = [
  { value: 'eq', label: 'Esittir' },
  { value: 'neq', label: 'Esit degil' },
  { value: 'gt', label: 'Buyuktur' },
  { value: 'gte', label: 'Buyuk esittir' },
  { value: 'lt', label: 'Kucuktur' },
  { value: 'lte', label: 'Kucuk esittir' },
  { value: 'contains', label: 'Icerir' },
  { value: 'truthy', label: 'Dogru' },
  { value: 'falsy', label: 'Yanlis' },
];

export const OBJECT_STATE_OPTIONS = [
  { value: 'normal', label: 'Normal' },
  { value: 'hover', label: 'Hover' },
  { value: 'visited', label: 'Visited' },
  { value: 'selected', label: 'Selected' },
  { value: 'disabled', label: 'Disabled' },
  { value: 'hidden', label: 'Hidden' },
  { value: 'dropCorrect', label: 'Drop Correct' },
  { value: 'dropIncorrect', label: 'Drop Incorrect' },
  { value: 'dragOver', label: 'Drag Over' },
];

export const TIMELINE_EFFECT_OPTIONS = [
  { value: 'none', label: 'Yok', group: 'basic' },
  { value: 'fade', label: 'Fade', group: 'basic' },
  { value: 'slide', label: 'Slide', group: 'basic' },
  { value: 'scale', label: 'Scale', group: 'basic' },
  { value: 'grow', label: 'Grow', group: 'emphasis' },
  { value: 'shrink', label: 'Shrink', group: 'emphasis' },
  { value: 'bounce', label: 'Bounce', group: 'emphasis' },
  { value: 'pulse', label: 'Pulse', group: 'emphasis' },
  { value: 'spin', label: 'Spin', group: 'emphasis' },
  { value: 'flip', label: 'Flip', group: 'emphasis' },
  { value: 'wipe', label: 'Wipe', group: 'motion' },
  { value: 'blur', label: 'Blur', group: 'motion' },
  { value: 'fly', label: 'Fly', group: 'motion' },
  { value: 'zigzag', label: 'Zigzag', group: 'motion' },
  { value: 'swirl', label: 'Swirl', group: 'motion' },
  { value: 'typewriter', label: 'Typewriter', group: 'text' },
];

export const TIMELINE_DIRECTION_OPTIONS = [
  { value: 'left', label: 'Soldan' },
  { value: 'right', label: 'Sagdan' },
  { value: 'up', label: 'Yukaridan' },
  { value: 'down', label: 'Asagidan' },
  { value: 'center', label: 'Merkez' },
  { value: 'topLeft', label: 'Sol Ust' },
  { value: 'topRight', label: 'Sag Ust' },
  { value: 'bottomLeft', label: 'Sol Alt' },
  { value: 'bottomRight', label: 'Sag Alt' },
];

export const TIMELINE_EASING_OPTIONS = [
  { value: 'linear', label: 'Linear' },
  { value: 'easeIn', label: 'Ease In' },
  { value: 'easeOut', label: 'Ease Out' },
  { value: 'easeInOut', label: 'Ease In Out' },
  { value: 'easeInBack', label: 'Ease In Back' },
  { value: 'easeOutBack', label: 'Ease Out Back' },
  { value: 'easeOutBounce', label: 'Ease Out Bounce' },
  { value: 'easeInOutElastic', label: 'Elastic' },
  { value: 'spring', label: 'Spring' },
  { value: 'steps', label: 'Steps' },
  { value: 'cubicBezier', label: 'Custom Cubic Bezier' },
];
