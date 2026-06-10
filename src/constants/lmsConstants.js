// ─── Player Chrome / Skin ─────────────────────────────────────────────────────

export const PLAYER_CHROME_DEFAULTS = {
  showSidebar: true,
  showSeekbar: true,
  showMenu: true,
  showResources: false,
  showNotes: false,
  showGlossary: false,
  showLogo: false,
  logoUrl: '',
  primaryColor: '#2563eb',
  secondaryColor: '#1e40af',
  textColor: '#ffffff',
  backgroundColor: '#0f172a',
  sidebarPosition: 'left',
  sidebarWidth: 240,
  seekbarHeight: 6,
  seekbarColor: '#3b82f6',
  volumeControl: true,
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 14,
  closedCaptionsEnabled: false,
  closedCaptionsDefault: false,
};

export const PLAYER_SKIN_PRESETS = [
  {
    id: 'modern-dark',
    name: 'Modern Koyu',
    primaryColor: '#3b82f6',
    backgroundColor: '#0f172a',
    textColor: '#f1f5f9',
  },
  {
    id: 'modern-light',
    name: 'Modern Açık',
    primaryColor: '#2563eb',
    backgroundColor: '#ffffff',
    textColor: '#1e293b',
  },
  {
    id: 'minimal',
    name: 'Minimal',
    primaryColor: '#6366f1',
    backgroundColor: '#fafafa',
    textColor: '#334155',
  },
  {
    id: 'classic',
    name: 'Klasik',
    primaryColor: '#0284c7',
    backgroundColor: '#f0f4f8',
    textColor: '#1e3a5f',
  },
  {
    id: 'high-contrast',
    name: 'Yüksek Kontrast',
    primaryColor: '#facc15',
    backgroundColor: '#000000',
    textColor: '#ffffff',
  },
];

// ─── Closed Captions ──────────────────────────────────────────────────────────

export const CAPTION_LANGUAGE_OPTIONS = [
  { value: 'tr', label: 'Türkçe' },
  { value: 'en', label: 'English' },
  { value: 'de', label: 'Deutsch' },
  { value: 'fr', label: 'Français' },
  { value: 'ar', label: 'العربية' },
];

// ─── Slide Advance / Revisit ──────────────────────────────────────────────────

export const SLIDE_ADVANCE_OPTIONS = [
  { value: 'user', label: 'Kullanici tiklamasi' },
  { value: 'auto', label: 'Otomatik (sureli)' },
  { value: 'both', label: 'Her ikisi' },
];

export const SLIDE_REVISIT_OPTIONS = [
  { value: 'reset', label: 'Bastan baslat' },
  { value: 'resume', label: 'Kaldigindan devam' },
  { value: 'auto-advance', label: 'Otomatik atla' },
];

// ─── Slide Transitions ────────────────────────────────────────────────────────

const RAW_SLIDE_TRANSITION_OPTIONS = [
  // ── Temel ──
  { value: 'none', label: 'Yok', group: 'Temel' },
  { value: 'fade', label: 'Fade', group: 'Temel' },
  { value: 'fade-black', label: 'Fade Through Black', group: 'Temel' },
  { value: 'fade-white', label: 'Fade Through White', group: 'Temel' },
  { value: 'cut', label: 'Cut', group: 'Temel' },
  // ── Subtle (Hafif) ──
  { value: 'slide', label: 'Kaydır (Push)', group: 'Hafif' },
  { value: 'slide-left', label: 'Sola Kaydır', group: 'Hafif' },
  { value: 'slide-right', label: 'Sağa Kaydır', group: 'Hafif' },
  { value: 'slide-up', label: 'Yukarı Kaydır', group: 'Hafif' },
  { value: 'slide-down', label: 'Aşağı Kaydır', group: 'Hafif' },
  { value: 'cover-left', label: 'Sola Kapat', group: 'Hafif' },
  { value: 'cover-right', label: 'Sağa Kapat', group: 'Hafif' },
  { value: 'cover-up', label: 'Yukarı Kapat', group: 'Hafif' },
  { value: 'cover-down', label: 'Aşağı Kapat', group: 'Hafif' },
  { value: 'uncover-left', label: 'Sola Aç', group: 'Hafif' },
  { value: 'uncover-right', label: 'Sağa Aç', group: 'Hafif' },
  { value: 'uncover-up', label: 'Yukarı Aç', group: 'Hafif' },
  { value: 'uncover-down', label: 'Aşağı Aç', group: 'Hafif' },
  { value: 'reveal', label: 'Reveal', group: 'Hafif' },
  { value: 'morph', label: 'Morph', group: 'Hafif' },
  // ── Exciting (Heyecanlı) ──
  { value: 'zoom-in', label: 'Zoom In', group: 'Heyecanlı' },
  { value: 'zoom-out', label: 'Zoom Out', group: 'Heyecanlı' },
  { value: 'zoom-rotate', label: 'Zoom & Rotate', group: 'Heyecanlı' },
  { value: 'spin', label: 'Spin', group: 'Heyecanlı' },
  { value: 'flip-horizontal', label: 'Yatay Çevir', group: 'Heyecanlı' },
  { value: 'flip-vertical', label: 'Dikey Çevir', group: 'Heyecanlı' },
  { value: 'bounce', label: 'Bounce', group: 'Heyecanlı' },
  { value: 'swing', label: 'Swing', group: 'Heyecanlı' },
  { value: 'drop', label: 'Drop', group: 'Heyecanlı' },
  { value: 'fly-in-left', label: 'Sol Uçuş', group: 'Heyecanlı' },
  { value: 'fly-in-right', label: 'Sağ Uçuş', group: 'Heyecanlı' },
  { value: 'fly-in-top', label: 'Üst Uçuş', group: 'Heyecanlı' },
  { value: 'fly-in-bottom', label: 'Alt Uçuş', group: 'Heyecanlı' },
  // ── Wipe (Silme) ──
  { value: 'wipe-left', label: 'Sola Sil', group: 'Silme' },
  { value: 'wipe-right', label: 'Sağa Sil', group: 'Silme' },
  { value: 'wipe-up', label: 'Yukarı Sil', group: 'Silme' },
  { value: 'wipe-down', label: 'Aşağı Sil', group: 'Silme' },
  { value: 'barn-in', label: 'Barn In (Kapanış)', group: 'Silme' },
  { value: 'barn-out', label: 'Barn Out (Açılış)', group: 'Silme' },
  { value: 'blinds-horizontal', label: 'Yatay Jalüzi', group: 'Silme' },
  { value: 'blinds-vertical', label: 'Dikey Jalüzi', group: 'Silme' },
  { value: 'checkerboard', label: 'Dama Tahtası', group: 'Silme' },
  { value: 'random-bars-h', label: 'Rastgele Çubuk (Yatay)', group: 'Silme' },
  { value: 'random-bars-v', label: 'Rastgele Çubuk (Dikey)', group: 'Silme' },
  // ── Shape (Şekil) ──
  { value: 'circle-in', label: 'Daire İçe', group: 'Şekil' },
  { value: 'circle-out', label: 'Daire Dışa', group: 'Şekil' },
  { value: 'diamond-in', label: 'Elmas İçe', group: 'Şekil' },
  { value: 'diamond-out', label: 'Elmas Dışa', group: 'Şekil' },
  { value: 'box-in', label: 'Kutu İçe', group: 'Şekil' },
  { value: 'box-out', label: 'Kutu Dışa', group: 'Şekil' },
  { value: 'plus-in', label: 'Artı İçe', group: 'Şekil' },
  { value: 'plus-out', label: 'Artı Dışa', group: 'Şekil' },
  { value: 'star-in', label: 'Yıldız İçe', group: 'Şekil' },
  { value: 'star-out', label: 'Yıldız Dışa', group: 'Şekil' },
  { value: 'heart-in', label: 'Kalp İçe', group: 'Şekil' },
  { value: 'heart-out', label: 'Kalp Dışa', group: 'Şekil' },
  // ── Split & Dissolve ──
  { value: 'split-horizontal-in', label: 'Yatay Bölme İçe', group: 'Bölme' },
  { value: 'split-horizontal-out', label: 'Yatay Bölme Dışa', group: 'Bölme' },
  { value: 'split-vertical-in', label: 'Dikey Bölme İçe', group: 'Bölme' },
  { value: 'split-vertical-out', label: 'Dikey Bölme Dışa', group: 'Bölme' },
  { value: 'dissolve', label: 'Dissolve', group: 'Bölme' },
  { value: 'pixelate', label: 'Pixelate', group: 'Bölme' },
  // ── Clock & Wheel (Saat) ──
  { value: 'clock-cw', label: 'Saat Yönü', group: 'Saat' },
  { value: 'clock-ccw', label: 'Saat Tersi', group: 'Saat' },
  { value: 'wheel-2', label: "2'li Çark", group: 'Saat' },
  { value: 'wheel-4', label: "4'lü Çark", group: 'Saat' },
  { value: 'wheel-8', label: "8'li Çark", group: 'Saat' },
  // ── 3D & Perspective ──
  { value: 'cube-left', label: 'Küp Sol', group: '3D' },
  { value: 'cube-right', label: 'Küp Sağ', group: '3D' },
  { value: 'cube-up', label: 'Küp Yukarı', group: '3D' },
  { value: 'cube-down', label: 'Küp Aşağı', group: '3D' },
  { value: 'rotate-left', label: 'Döndür Sol', group: '3D' },
  { value: 'rotate-right', label: 'Döndür Sağ', group: '3D' },
  { value: 'doors-horizontal', label: 'Kapı Yatay', group: '3D' },
  { value: 'doors-vertical', label: 'Kapı Dikey', group: '3D' },
  { value: 'page-curl', label: 'Sayfa Kıvrım', group: '3D' },
  { value: 'conveyor-left', label: 'Bant Sol', group: '3D' },
  { value: 'conveyor-right', label: 'Bant Sağ', group: '3D' },
  // ── Special ──
  { value: 'glitter', label: 'Glitter / Parlak', group: 'Özel' },
  { value: 'shatter', label: 'Kırılma', group: 'Özel' },
  { value: 'curtain', label: 'Perde', group: 'Özel' },
  { value: 'newspaper', label: 'Gazete Dönüş', group: 'Özel' },
  { value: 'vortex', label: 'Girdap', group: 'Özel' },
  { value: 'ripple', label: 'Dalga', group: 'Özel' },
  { value: 'honeycomb', label: 'Bal Peteği', group: 'Özel' },
];

const TTKB_SAFE_SLIDE_TRANSITION_VALUES = new Set([
  'none',
  'fade',
  'fade-black',
  'fade-white',
  'cut',
  'slide',
  'slide-left',
  'slide-right',
  'slide-up',
  'slide-down',
  'cover-left',
  'cover-right',
  'cover-up',
  'cover-down',
  'uncover-left',
  'uncover-right',
  'uncover-up',
  'uncover-down',
  'reveal',
  'zoom-in',
  'zoom-out',
  'fly-in-left',
  'fly-in-right',
  'fly-in-top',
  'fly-in-bottom',
  'wipe-left',
  'wipe-right',
  'wipe-up',
  'wipe-down',
  'barn-in',
  'barn-out',
  'circle-in',
  'circle-out',
  'diamond-in',
  'diamond-out',
  'box-in',
  'box-out',
  'split-horizontal-in',
  'split-horizontal-out',
  'split-vertical-in',
  'split-vertical-out',
  'clock-cw',
  'clock-ccw',
  'wheel-2',
  'wheel-4',
  'wheel-8',
  'conveyor-left',
  'conveyor-right',
  'curtain',
]);

export const SLIDE_TRANSITION_OPTIONS = RAW_SLIDE_TRANSITION_OPTIONS.filter((option) =>
  TTKB_SAFE_SLIDE_TRANSITION_VALUES.has(option.value)
).map((option) => ({ ...option, ttkbCompliant: true, visualPolicy: 'ttkb-safe-editor' }));

// Geçiş sesi: ribbon (Geçişler) ve sağ panel (Geçiş Ayarları) tek listeden beslensin;
// daha önce iki yerde farklı değer kümeleri vardı ve seçimler birbirini tutmuyordu.
export const SLIDE_TRANSITION_SOUND_OPTIONS = [
  { value: 'none', label: 'Ses yok' },
  { value: 'soft', label: 'Yumuşak' },
  { value: 'click', label: 'Tık' },
  { value: 'page', label: 'Sayfa geçişi' },
  { value: 'chime', label: 'Kısa uyarı' },
];

// İzleme yöntemi: scormExport `completion`/`score`/`completion+score` değerlerini bekliyor
// (varsayılan 'completion+score'). Ribbon ve sağ panel tek listeden beslensin; daha önce
// panel farklı değerler (slides-viewed vb.) yazıp paketi yanlış yapılandırıyordu.
export const LMS_TRACKING_MODE_OPTIONS = [
  { value: 'completion', label: 'Tamamlama' },
  { value: 'score', label: 'Puan' },
  { value: 'completion+score', label: 'Tamamlama + Puan' },
];
