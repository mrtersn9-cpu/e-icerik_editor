// Etkinlik (soru) düzenleyiciler için ORTAK görünüm sabitleri.
// Amaç: her editörün kendi sabit rengini/kartını yazması yerine tek kaynak →
// tutarlı kart, başlık ve kontrol (checkbox) rengi. Tüm değerler token tabanlıdır.

export const editorCardStyle = {
  background: 'var(--eic-light-panel)',
  border: '1px solid var(--eic-light-border-soft)',
  borderRadius: 14,
  padding: 14,
  boxShadow: '0 10px 22px rgba(15, 23, 42, 0.05)',
};

// Kart içi bölüm başlığı (örn. "SORU AYARLARI") — tek tip, küçük, büyük harf.
export const editorTitleStyle = {
  fontSize: 11,
  fontWeight: 800,
  color: 'var(--eic-light-accent)',
  textTransform: 'uppercase',
  letterSpacing: '0.4px',
  marginBottom: 8,
};

// Checkbox / radio / range gibi kontrollerin vurgu rengi — tüm editörlerde aynı.
export const EDITOR_ACCENT = 'var(--eic-light-accent)';
