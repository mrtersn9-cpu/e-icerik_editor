export const T = {
  bg: '#f7faff',
  surface: '#ffffff',
  surfaceAlt: '#f8fafc',
  surfaceHover: '#f1f5f9',
  shell: '#eef4fb',
  shellSoft: '#f6f9fd',
  pasteboard: '#0d1726',
  pasteboardAlt: '#111c2d',
  border: '#d8e2ef',
  borderHi: '#e5edf6',
  text: '#0f172a',
  muted: '#64748b',
  accent: '#2563eb',
  accentBg: '#eff6ff',
  accentBorder: '#93c5fd',
  success: '#16a34a',
  warn: '#d97706',
  danger: '#dc2626',
};

export const PDF_PAGE_SIDEBAR_WIDTH = 240;
export const PDF_RIGHT_PANEL_WIDTH = 300;

// ── Etkileşim/render sabitleri (önceden dosyaya dağılmış magic number'lar)
export const SCALE_CLAMP_MIN = 0.4; // sayfa fit raster ölçeği alt sınırı
export const SCALE_CLAMP_MAX = 2.6; // sayfa fit raster ölçeği üst sınırı
export const STAGE_FIT_PADDING = 80; // sayfayı kaba sığdırırken bırakılan boşluk (px)
export const PASTE_OFFSET = 18; // kopyala/yapıştır ötelemesi (normalize birim)
export const SNAP_THRESHOLD = 8; // hizalama yakalama eşiği (normalize birim)
export const MIN_BOX_SIZE = 10; // resize sırasında minimum kutu genişlik/yükseklik (normalize birim)
export const NUDGE_STEP = 1; // ok tuşuyla ince kaydırma (normalize birim)
export const NUDGE_STEP_LARGE = 10; // Shift+ok tuşuyla kaba kaydırma (normalize birim)
export const ZOOM_MIN = 0.25; // kullanıcı görüntü zoom'u alt sınırı
export const ZOOM_MAX = 8; // kullanıcı görüntü zoom'u üst sınırı
export const ZOOM_WHEEL_SENSITIVITY = 0.0015; // Ctrl+tekerlek zoom hassasiyeti
export const ZOOM_SHARPEN_THRESHOLD = 1.8; // bu zoom üstünde netlik için yeniden raster tetiklenir
export const RENDER_SCALES = {
  auto: 1.6, // otomatik tarama raster ölçeği
  png: 2.6, // PNG dışa aktarma
  jpeg: 2.4, // JPEG dışa aktarma
  pdf: 2.4, // temizlenmiş PDF dışa aktarma
  thumb: 0.22, // küçük resim ölçeği
  svg: 2, // SVG dışa aktarma raster ölçeği
};

export const WORKFLOW_PILL_STYLE = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 9px',
  borderRadius: 999,
  border: `1px solid ${T.border}`,
  background: '#f1f5f9',
  color: T.text,
  fontSize: 11,
  fontWeight: 800,
  whiteSpace: 'nowrap',
};
