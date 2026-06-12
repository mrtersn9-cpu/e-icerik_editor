// Ortak renk seçici paleti: tema renkleri + standart (varsayılan) renkler.
// Kullanıcı renkleri serbest kodla değil bu hazır kodlarla seçebilsin diye
// tüm renk girişleri (ribbon + sağ panel) aynı paleti kullanır. Çevrimdışı
// kural gereği dış bağımlılık yok; son kullanılanlar localStorage'da tutulur.

export const THEME_COLOR_SWATCHES = [
  '#ffffff',
  '#eff6ff',
  '#f0fdf4',
  '#fff7ed',
  '#f8fafc',
  '#111827',
];

export const STANDARD_COLOR_SWATCHES = [
  '#000000',
  '#334155',
  '#64748b',
  '#dc2626',
  '#f97316',
  '#f59e0b',
  '#fde047',
  '#16a34a',
  '#0d9488',
  '#0ea5e9',
  '#2563eb',
  '#7c3aed',
  '#db2777',
  '#92400e',
  '#fecaca',
  '#bfdbfe',
  '#bbf7d0',
  '#fef3c7',
];

export const RECENT_COLORS_STORAGE_KEY = 'eicerik_recent_colors';
export const RECENT_COLORS_MAX = 10;

export function normalizeHexColor(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(raw)) return raw;
  // #abc → #aabbcc kısaltması da kabul edilir
  const short = raw.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
  return '';
}

// Saf liste mantığı: başa ekle, tekrarı öne taşı, RECENT_COLORS_MAX ile sınırla.
export function appendRecentColor(list = [], color) {
  const normalized = normalizeHexColor(color);
  if (!normalized) return Array.isArray(list) ? list : [];
  const rest = (Array.isArray(list) ? list : []).filter(
    (item) => normalizeHexColor(item) && normalizeHexColor(item) !== normalized
  );
  return [normalized, ...rest].slice(0, RECENT_COLORS_MAX);
}

export function readRecentColors() {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_COLORS_STORAGE_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeHexColor).filter(Boolean).slice(0, RECENT_COLORS_MAX);
  } catch {
    return [];
  }
}

export function pushRecentColor(color) {
  const next = appendRecentColor(readRecentColors(), color);
  try {
    localStorage.setItem(RECENT_COLORS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Gizli mod / dolu depolama: son renkler kalıcı olmaz, seçim yine çalışır.
  }
  return next;
}
