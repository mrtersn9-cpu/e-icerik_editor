/**
 * Mobil canvas dokunma ayarları — StageCanvas `touchMode` açıkken kullanılır.
 * Masaüstü (touchMode=false) bu değerleri kullanmaz; davranış değişmez.
 */
export const MOBILE_CANVAS = {
  // Yeniden boyutlandırma tutamacı görünür boyutu (dokunma hedefi ~44px hissi)
  handleSize: 20,
  handleBorder: 2,
  // Pinch zoom sınırları
  minScale: 0.1,
  maxScale: 4,
  // Tek parmak arka plan: bu eşiği geçince pan, altında tap (deselect)
  panThreshold: 5,
  tapMaxMove: 6,
};
