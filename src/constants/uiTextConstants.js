// Kullanıcıya görünen editör metinleri ve oluşturma ekranı grupları.
// Not: Bu dosyadaki preset id'leri UI seçimleri içindir; runtime/action key değildir.

export const UI_TERMS = {
  object: 'nesne',
  slide: 'sahne',
  layer: 'katman',
  trigger: 'tetikleyici',
  canvas: 'çalışma alanı',
  widget: 'özel etkileşim',
  runtimePreview: 'önizleme',
  runtimeRun: 'çalıştırma',
  scorm: 'SCORM',
  ttkb: 'TTKB',
};

export const STANDARD_ACTIVITY_CREATE_PRESETS = [
  {
    id: 'true-false',
    activityType: 'selection',
    label: 'Doğru/Yanlış',
    desc: 'İki seçenekli hızlı seçim etkinliği',
    icon: 'D/Y',
  },
  {
    id: 'multiple-choice',
    activityType: 'selection',
    label: 'Çoktan Seçmeli',
    desc: 'Tek veya çoklu doğru seçenekli soru',
    icon: '✓',
  },
  {
    id: 'drag-drop',
    activityType: 'drag-drop',
    label: 'Sürükle-Bırak',
    desc: 'Öğeleri hedef alanlara taşıma',
    icon: '↕',
  },
  {
    id: 'matching',
    activityType: 'matching',
    label: 'Eşleştirme',
    desc: 'Sol ve sağ çiftleri eşleştirme',
    icon: '⇔',
  },
  {
    id: 'sequence',
    activityType: 'sequence',
    label: 'Sıralama',
    desc: 'Öğeleri doğru sıraya dizme',
    icon: '⇅',
  },
  {
    id: 'fill-blank',
    activityType: 'fill-blank',
    label: 'Boşluk Doldurma',
    desc: 'Cümle içi boşlukları tamamlama',
    icon: '___',
  },
  {
    id: 'text-entry',
    activityType: 'text-entry',
    label: 'Kısa Cevap',
    desc: 'Serbest metin yanıtı alma',
    icon: '✎',
  },
  {
    id: 'numeric',
    activityType: 'numeric',
    label: 'Sayısal Cevap',
    desc: 'Sayı tabanlı yanıt kontrolü',
    icon: '#',
  },
  {
    id: 'puzzle',
    activityType: 'puzzle',
    label: 'Bulmaca',
    desc: 'Kelime, sudoku veya labirent türleri',
    icon: '▦',
  },
];

export const OTHER_ACTIVITY_CREATE_PRESETS = [
  {
    id: 'hotspot',
    activityType: 'hotspot',
    label: 'Etkin Alan',
    desc: 'Görsel üzerinde tıklanabilir alan',
    icon: '⊕',
  },
  {
    id: 'survey',
    activityType: 'survey',
    label: 'Anket',
    desc: 'Puansız geri bildirim toplama',
    icon: '◩',
  },
  {
    id: 'mixed',
    activityType: 'mixed',
    label: 'Karma',
    desc: 'Birden fazla soru tipini birlikte kullanma',
    icon: '⊞',
  },
];

export const CUSTOM_INTERACTION_TEMPLATES = [
  {
    id: 'blank',
    label: 'Boş Özel Etkileşim',
    desc: 'Sıfırdan özel etkileşim taslağı',
    icon: '□',
  },
  {
    id: 'dice-animation',
    label: 'Zar ve Animasyon',
    desc: 'Rastgele sonuç ve hareket iskeleti',
    icon: '▣',
  },
  {
    id: 'coin-flip',
    label: 'Yazı Tura',
    desc: 'İki sonuçlu etkileşim taslağı',
    icon: '○',
  },
  {
    id: 'spin-wheel',
    label: 'Çark Çevirme',
    desc: 'Dilimli seçim akışı iskeleti',
    icon: '◌',
  },
  {
    id: 'letter-tracing',
    label: 'Harf Çizme',
    desc: 'İz sürme ve çizim hazırlığı',
    icon: 'A',
  },
  {
    id: 'measure-tool',
    label: 'Ölçme Aracı',
    desc: 'Cetvel veya ölçüm aracı iskeleti',
    icon: '⌁',
  },
  {
    id: 'plant-growth',
    label: 'Bitki Büyütme',
    desc: 'Aşamalı gelişim etkileşimi',
    icon: '↟',
  },
];

export const DEFAULT_ACTIVITY_CREATE_PRESET_ID = 'multiple-choice';
export const DEFAULT_CUSTOM_INTERACTION_TEMPLATE_ID = 'blank';
