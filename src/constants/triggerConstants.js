// ─── Değişken ve Trigger Sabitleri ────────────────────────────────────────────

export const VARIABLE_TYPES = [
  { value: 'text', label: 'Metin' },
  { value: 'number', label: 'Sayı' },
  { value: 'boolean', label: 'Doğru/Yanlış' },
];

export const TRIGGER_ACTION_OPTIONS = [
  // Navigation
  { value: 'YenidenBaslat', label: 'Yeniden Başlat', group: 'nav' },
  { value: 'SliderGec', label: 'Sahneye Geç', group: 'nav' },
  { value: 'SayfaGec', label: 'Sayfaya Geç', group: 'nav' },
  { value: 'KatmanaGec', label: 'Katmana Geç', group: 'nav' },
  { value: 'LightboxAc', label: 'Lightbox Aç', group: 'nav' },
  { value: 'URLAc', label: 'URL / Bağlantı Aç', group: 'nav' },
  // Visibility
  { value: 'Goster', label: 'Nesne Göster', group: 'viz' },
  { value: 'Gizle', label: 'Nesne Gizle', group: 'viz' },
  { value: 'NesneDurumuAyarla', label: 'Nesne Durumu Ayarla', group: 'viz' },
  { value: 'NesneToggle', label: 'Görünürlüğü Değiştir', group: 'viz' },
  // Variables
  { value: 'DegiskenAta', label: 'Değişken Ata', group: 'var' },
  { value: 'DegiskenArttir', label: 'Değişken Artır', group: 'var' },
  { value: 'DegiskenAzalt', label: 'Değişken Azalt', group: 'var' },
  // Media
  { value: 'SesCal', label: 'Ses Çal', group: 'media' },
  { value: 'SesDurdur', label: 'Ses Durdur', group: 'media' },
  { value: 'VideoCal', label: 'Video Oynat', group: 'media' },
  { value: 'VideoDurdur', label: 'Video Duraklat', group: 'media' },
  { value: 'AnimasyonBaslat', label: 'Animasyon Başlat', group: 'media' },
  // Timeline
  { value: 'ZamanCizelgesiBaslat', label: 'Zaman Çizelgesini Başlat', group: 'timeline' },
  { value: 'ZamanCizelgesiDurdur', label: 'Zaman Çizelgesini Durdur', group: 'timeline' },
  { value: 'ZamanCizelgesiAtla', label: 'İşaret Noktasına Atla', group: 'timeline' },
  // LMS / Quiz
  { value: 'SonucGonder', label: 'Sonuç Gönder (LMS)', group: 'lms' },
  { value: 'TamamlaGonder', label: 'Tamamlama Gönder', group: 'lms' },
  // Advanced
  { value: 'Yazdir', label: 'Sayfayı Yazdır', group: 'advanced' },
  { value: 'ScrollTo', label: 'Nesneye Kaydır', group: 'advanced' },
  // Widget
  { value: 'sendWidgetCommand', label: 'Widget Komut Gönder', group: 'widget' },
];

export const TRIGGER_WHEN_OPTIONS = [
  { value: 'onClick', label: 'Tıklandığında', group: 'user' },
  { value: 'onHover', label: 'Üzerine gelince', group: 'user' },
  { value: 'onDrop', label: 'Bırakılınca', group: 'user' },
  { value: 'onDragEnter', label: 'Sürükle girince', group: 'user' },
  { value: 'onDragLeave', label: 'Sürükle çıkınca', group: 'user' },
  { value: 'onKeypress', label: 'Tuşa basılınca', group: 'user' },
  { value: 'onDoubleClick', label: 'Çift tıklanınca', group: 'user' },
  { value: 'onLoad', label: 'Sahne yüklenince', group: 'scene' },
  { value: 'onOffSlide', label: 'Sahneden çıkınca', group: 'scene' },
  { value: 'onTimer', label: 'Zamanlayıcı dolunca', group: 'scene' },
  { value: 'onTimelineEnd', label: 'Timeline bitince', group: 'scene' },
  { value: 'onMediaEnd', label: 'Medya bitince', group: 'media' },
  { value: 'onMediaStart', label: 'Medya başladığında', group: 'media' },
  { value: 'onStateChange', label: 'Durum değişince', group: 'data' },
  { value: 'onVariableChange', label: 'Değişken değişince', group: 'data' },
  { value: 'onDropCorrect', label: 'Doğru bırakma', group: 'quiz' },
  { value: 'onDropIncorrect', label: 'Yanlış bırakma', group: 'quiz' },
  { value: 'onSubmit', label: 'Gönderildiğinde', group: 'quiz' },
  { value: 'onWidgetEvent', label: 'Widget olayı', group: 'widget' },
];

export const TRIGGER_OPERATOR_OPTIONS = [
  { value: 'eq', label: 'Eşittir' },
  { value: 'neq', label: 'Eşit değil' },
  { value: 'gt', label: 'Büyüktür' },
  { value: 'gte', label: 'Büyük eşittir' },
  { value: 'lt', label: 'Küçüktür' },
  { value: 'lte', label: 'Küçük eşittir' },
  { value: 'contains', label: 'İçerir' },
  { value: 'truthy', label: 'Doğru' },
  { value: 'falsy', label: 'Yanlış' },
];

export const OBJECT_STATE_OPTIONS = [
  { value: 'normal', label: 'Normal' },
  { value: 'hover', label: 'Üzerine Gelindi' },
  { value: 'visited', label: 'Ziyaret Edildi' },
  { value: 'selected', label: 'Seçildi' },
  { value: 'disabled', label: 'Devre Dışı' },
  { value: 'hidden', label: 'Gizli' },
  { value: 'dropCorrect', label: 'Doğru Bırakma' },
  { value: 'dropIncorrect', label: 'Yanlış Bırakma' },
  { value: 'dragOver', label: 'Sürükle Üzerinde' },
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
  { value: 'right', label: 'Sağdan' },
  { value: 'up', label: 'Yukarıdan' },
  { value: 'down', label: 'Aşağıdan' },
  { value: 'center', label: 'Merkez' },
  { value: 'topLeft', label: 'Sol Üst' },
  { value: 'topRight', label: 'Sağ Üst' },
  { value: 'bottomLeft', label: 'Sol Alt' },
  { value: 'bottomRight', label: 'Sağ Alt' },
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
  { value: 'cubicBezier', label: 'Özel Cubic Bezier' },
];
