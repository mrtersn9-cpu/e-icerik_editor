// Türkçe-duyarlı arama normalizasyonu: locale küçük harf + ı/ş/ç/ö/ü/ğ -> ASCII katlama.
// Mevcut normalizeAiText (aiService.js) ve normalizeSearchText (libraryUtils.js) ile aynı
// mantık; ikon araması ve gelecekteki aramalar için paylaşılan tek kaynak.
export function foldSearchText(value) {
  return String(value == null ? '' : value)
    .toLocaleLowerCase('tr-TR')
    .replace(/[çÇ]/g, 'c')
    .replace(/[ğĞ]/g, 'g')
    .replace(/[ıİ]/g, 'i')
    .replace(/[öÖ]/g, 'o')
    .replace(/[şŞ]/g, 's')
    .replace(/[üÜ]/g, 'u')
    .trim();
}
