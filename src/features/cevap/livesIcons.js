// Can/hak simgeleri — 10 hazır seçenek + özel resim.
// Emoji glyph'leri kullanılır: hem editör React önizlemesinde hem SCORM düz HTML
// çıktısında ek varlık gerektirmeden aynı şekilde render olur.
export const LIVES_ICON_PRESETS = [
  { id: 'heart', label: 'Kalp', glyph: '❤️' },
  { id: 'star', label: 'Yıldız', glyph: '⭐' },
  { id: 'diamond', label: 'Elmas', glyph: '💎' },
  { id: 'apple', label: 'Elma', glyph: '🍎' },
  { id: 'bolt', label: 'Şimşek', glyph: '⚡' },
  { id: 'trophy', label: 'Kupa', glyph: '🏆' },
  { id: 'crown', label: 'Taç', glyph: '👑' },
  { id: 'flower', label: 'Çiçek', glyph: '🌸' },
  { id: 'balloon', label: 'Balon', glyph: '🎈' },
  { id: 'medal', label: 'Madalya', glyph: '🏅' },
];

export const DEFAULT_LIVES_ICON_ID = 'heart';
export const DEFAULT_LIVES_COUNT = 3;

export function getLivesIconPreset(id) {
  return LIVES_ICON_PRESETS.find((item) => item.id === id) || LIVES_ICON_PRESETS[0];
}

// Can ayarlarını normalize ederek okur. Birincil kaynak activity.answerControl'dur
// (SCORM runtime'a taşınan anahtar); activity.settings yalnızca geriye-dönük yedektir.
// Editör, önizleme ve SCORM çıktısı bu tek mantığı kullanır.
export function getLivesConfig(activity = {}) {
  const ac = activity?.answerControl || {};
  const settings = activity?.settings || {};
  const pick = (key) => (ac[key] !== undefined ? ac[key] : settings[key]);
  // Katı boolean: içe aktarılan/eski verideki "true"/1 gibi truthy kalıntılar
  // can sistemini istemeden açmasın (önizlemede beklenmedik 3 kalp şikâyeti).
  const enabled = pick('livesEnabled') === true;
  const count = Math.max(1, Math.min(99, Number(pick('livesCount')) || DEFAULT_LIVES_COUNT));
  const iconId = pick('livesIconId') || DEFAULT_LIVES_ICON_ID;
  const rawCustom = pick('livesCustomImage');
  const customImage = typeof rawCustom === 'string' ? rawCustom : '';
  const useCustom = iconId === 'custom' && !!customImage;
  const glyph = useCustom ? '' : getLivesIconPreset(iconId).glyph;
  const behaviorOnZero = pick('livesBehaviorOnZero') || 'lock'; // 'lock' | 'restart' | 'show-answer'
  return { enabled, count, iconId, glyph, customImage, useCustom, behaviorOnZero };
}

// Kalan can sayısından tek bir simgenin (dolu/boş) HTML/JSX-bağımsız metin gösterimi
// için yardımcı: SCORM tarafı bu glyph'i metin olarak basar.
export function buildLivesGlyphRow(config, remaining) {
  const total = config.count;
  const filled = Math.max(0, Math.min(total, remaining));
  return { total, filled, empty: total - filled };
}
