// Köşe yuvarlaklığı tek doğruluk kaynağı: kullanıcı değeri piksel olarak saklanır,
// her render noktası bu yardımcı ile kelepçeler (0 .. kısa kenarın yarısı).
// CSS border-radius'u tarayıcı zaten kelepçeler; SVG rx için bu fonksiyon şarttır.
export function resolveCornerRadiusPx(radius, width, height) {
  const r = Math.max(0, Number(radius) || 0);
  const minSide = Math.max(1, Math.min(Number(width) || 1, Number(height) || 1));
  return Math.min(r, minSide / 2);
}
