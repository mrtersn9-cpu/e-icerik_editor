# 05 — Sunucu ve Araçlar İncelemesi

Kapsam: `server.mjs`, `dev.mjs`, `scripts/`, `public/` (`public/fonts/` hariç)

## Bulgular

### Bilgi — Editör kabuğu Google Fonts'a bağlanıyor

- Durum: Düzeltildi (commit atılmadı).
- TTKB/SCORM ihlali: Hayır, mevcut politika editör uygulamasını bu kesin kuralın
  dışında bırakıyor.
- Kanıt türü: Statik analiz
- Dosya:satır:
  - `public/index.html:7`
  - `public/index.html:9`
  - `src/constants/fonts.js:165`
  - `scripts/download-fonts.mjs:29`
- Sorun: Editör shell'i ve font indirme aracı Google Fonts/Google Static kaynaklarını
  kullanıyor. Kılavuz gereği yalnızca bilgi notu olarak listelendi.
- Etki: İnternetsiz editör kullanımında font yüklenmemesi veya gizlilik/telemetri
  hassasiyeti olan ortamlarda operasyonel risk oluşabilir. SCORM paketine sızdığına
  dair bu turda kanıt bulunmadı.
- Önerilen düzeltme: Editör de tamamen çevrimdışı hedeflenirse Google Fonts preload
  yerine yerel font manifesti kullanılmalı. SCORM export tarafında gerçek zip paketi
  üretilip dosya ve ağ trafiği ayrıca doğrulanmalı.
- Yapılan düzeltme: Editör giriş HTML'indeki Google Fonts linkleri kaldırıldı; font
  loader CDN fallback kullanmıyor.

### Düşük — Build çıktısı boyut uyarısı veriyor

- Kanıt türü: Build sonucu
- Dosya:satır: `package.json` scriptleri, CRA build çıktısı
- Sorun: `npm run build` başarılı oldu ancak paket boyutunun önerilenden büyük olduğuna
  dair standart CRA uyarısı verdi.
- Etki: Doğrudan hata değil; düşük performans ve ilk yükleme süresi riski.
- Önerilen düzeltme: İnceleme sonrası ayrı performans turunda code splitting ve büyük
  bağımlılık analizi yapılabilir.

## İncelenen Dosya Grupları

- `server.mjs`
- `dev.mjs`
- `scripts/download-fonts.mjs`
- `public/index.html`
- `public/widgets/`
- `public/widget-sdk/`
