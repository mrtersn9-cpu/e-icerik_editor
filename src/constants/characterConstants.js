// ─── Character Library ────────────────────────────────────────────────────────

export const CHARACTER_LIBRARY = [
  {
    id: 'char-teacher-f',
    name: 'Öğretmen (K)',
    category: 'education',
    poses: ['stand', 'point', 'explain', 'wave', 'think'],
    thumbnail: '👩‍🏫',
  },
  {
    id: 'char-teacher-m',
    name: 'Öğretmen (E)',
    category: 'education',
    poses: ['stand', 'point', 'explain', 'wave', 'think'],
    thumbnail: '👨‍🏫',
  },
  {
    id: 'char-student-f',
    name: 'Öğrenci (K)',
    category: 'education',
    poses: ['stand', 'read', 'write', 'raise-hand', 'sit'],
    thumbnail: '👩‍🎓',
  },
  {
    id: 'char-student-m',
    name: 'Öğrenci (E)',
    category: 'education',
    poses: ['stand', 'read', 'write', 'raise-hand', 'sit'],
    thumbnail: '👨‍🎓',
  },
  {
    id: 'char-doctor-f',
    name: 'Doktor (K)',
    category: 'health',
    poses: ['stand', 'explain', 'point', 'check'],
    thumbnail: '👩‍⚕️',
  },
  {
    id: 'char-doctor-m',
    name: 'Doktor (E)',
    category: 'health',
    poses: ['stand', 'explain', 'point', 'check'],
    thumbnail: '👨‍⚕️',
  },
  {
    id: 'char-engineer-f',
    name: 'Mühendis (K)',
    category: 'business',
    poses: ['stand', 'present', 'laptop', 'think'],
    thumbnail: '👩‍💻',
  },
  {
    id: 'char-engineer-m',
    name: 'Mühendis (E)',
    category: 'business',
    poses: ['stand', 'present', 'laptop', 'think'],
    thumbnail: '👨‍💻',
  },
  {
    id: 'char-child-f',
    name: 'Çocuk (K)',
    category: 'general',
    poses: ['stand', 'wave', 'jump', 'sit', 'read'],
    thumbnail: '👧',
  },
  {
    id: 'char-child-m',
    name: 'Çocuk (E)',
    category: 'general',
    poses: ['stand', 'wave', 'jump', 'sit', 'read'],
    thumbnail: '👦',
  },
];

export const CHARACTER_CATEGORIES = [
  { value: 'education', label: 'Eğitim' },
  { value: 'health', label: 'Sağlık' },
  { value: 'business', label: 'İş Dünyası' },
  { value: 'general', label: 'Genel' },
];

// ─── Content Library / Stock Assets ───────────────────────────────────────────

export const CONTENT_LIBRARY_CATEGORIES = [
  { value: 'backgrounds', label: 'Arka Planlar', icon: '🖼️' },
  { value: 'icons', label: 'İkonlar', icon: '⭐' },
  { value: 'shapes', label: 'Şekiller', icon: '△' },
  { value: 'buttons', label: 'Butonlar', icon: '🔘' },
  { value: 'markers', label: 'İşaretçiler', icon: '📍' },
  { value: 'arrows', label: 'Oklar', icon: '➜' },
];

export const STOCK_ASSET_ITEMS = [
  {
    id: 'bg-gradient-blue',
    category: 'backgrounds',
    name: 'Mavi Gradyan',
    type: 'background',
    value: 'linear-gradient(135deg, #667eea, #764ba2)',
  },
  {
    id: 'bg-gradient-green',
    category: 'backgrounds',
    name: 'Yeşil Gradyan',
    type: 'background',
    value: 'linear-gradient(135deg, #11998e, #38ef7d)',
  },
  {
    id: 'bg-gradient-sunset',
    category: 'backgrounds',
    name: 'Gün Batımı',
    type: 'background',
    value: 'linear-gradient(135deg, #f093fb, #f5576c)',
  },
  {
    id: 'bg-gradient-ocean',
    category: 'backgrounds',
    name: 'Okyanus',
    type: 'background',
    value: 'linear-gradient(135deg, #4facfe, #00f2fe)',
  },
  {
    id: 'bg-dark-elegant',
    category: 'backgrounds',
    name: 'Koyu Zarif',
    type: 'background',
    value: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)',
  },
  {
    id: 'bg-warm-paper',
    category: 'backgrounds',
    name: 'Sıcak Kağıt',
    type: 'background',
    value: 'linear-gradient(135deg, #fdfcfb, #e2d1c3)',
  },
  { id: 'icon-check', category: 'icons', name: 'Onay', type: 'text', value: '✓' },
  { id: 'icon-cross', category: 'icons', name: 'Çarpı', type: 'text', value: '✕' },
  { id: 'icon-star', category: 'icons', name: 'Yıldız', type: 'text', value: '★' },
  { id: 'icon-heart', category: 'icons', name: 'Kalp', type: 'text', value: '♥' },
  { id: 'icon-bulb', category: 'icons', name: 'Ampul', type: 'text', value: '💡' },
  { id: 'icon-info', category: 'icons', name: 'Bilgi', type: 'text', value: 'ℹ️' },
  { id: 'icon-warning', category: 'icons', name: 'Uyarı', type: 'text', value: '⚠️' },
  { id: 'icon-trophy', category: 'icons', name: 'Kupa', type: 'text', value: '🏆' },
  { id: 'shape-circle', category: 'shapes', name: 'Daire', type: 'shape', value: 'circle' },
  { id: 'shape-hexagon', category: 'shapes', name: 'Altıgen', type: 'shape', value: 'hexagon' },
  { id: 'shape-star', category: 'shapes', name: 'Yıldız Şekil', type: 'shape', value: 'star' },
  {
    id: 'btn-rounded',
    category: 'buttons',
    name: 'Yuvarlak Buton',
    type: 'button',
    value: { borderRadius: 999, background: '#3b82f6', color: '#fff' },
  },
  {
    id: 'btn-outline',
    category: 'buttons',
    name: 'Çerçeve Buton',
    type: 'button',
    value: {
      borderRadius: 10,
      background: 'transparent',
      borderColor: '#3b82f6',
      color: '#3b82f6',
    },
  },
  {
    id: 'btn-gradient',
    category: 'buttons',
    name: 'Gradyan Buton',
    type: 'button',
    value: {
      borderRadius: 12,
      background: 'linear-gradient(90deg,#6366f1,#8b5cf6)',
      color: '#fff',
    },
  },
  { id: 'marker-pin', category: 'markers', name: 'Pin İşaretçi', type: 'text', value: '📍' },
  { id: 'marker-number', category: 'markers', name: 'Numaralı', type: 'text', value: '①' },
  { id: 'arrow-right', category: 'arrows', name: 'Sağ Ok', type: 'text', value: '➜' },
  { id: 'arrow-curved', category: 'arrows', name: 'Eğri Ok', type: 'text', value: '↪' },
];
