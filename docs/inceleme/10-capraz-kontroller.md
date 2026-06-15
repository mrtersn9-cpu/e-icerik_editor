# 10 — Çapraz Kontroller

## Komut Sonuçları

### Tur 1 (Codex, 2026-06-12)

- `npm run lint`: Başarılı, uyarısız.
- `npm run test -- --runInBand`: Başarılı. 39 test suite, 299 test geçti.
- `npm run build`: Başarılı (bundle size + `fs.F_OK` uyarısı).
- `npm audit --omit=dev`: `0 vulnerabilities` (bkz. Tur 2 çelişkisi).

### Tur 2 (Derin denetim, 2026-06-15)

- `npm run lint`: **Başarılı, uyarısız.**
- `npm test`: **Başarılı. 39 suite / 302 test geçti** (Codex'ten 3 test fazla — yeni
  eklenen SCORM/font testleri).
- `npm run build`: **Başarılı, "Compiled successfully".** `fs.F_OK` deprecation uyarısı.
- `npm audit --omit=dev`: **41 açık (9 düşük, 12 orta, 18 yüksek, 2 KRİTİK).**
  - ÇELİŞKİ: Codex "0 vulnerability" demişti; taze çalıştırmada 41 açık görüldü.
  - Kök neden: `react-scripts` ve geçişli bağımlılıkları (`webpack-dev-server` → `ws`
    vb.) `package.json`'da **dependencies** altında olduğu için `--omit=dev` bunları
    elemiyor. Bunlar **build/geliştirme aracı** bağımlılıkları; üretilen statik SCORM
    paketine GİRMEZ, dolayısıyla öğrenci/runtime güvenlik riski oluşturmaz.
  - Yine de "2 kritik + 18 yüksek" geliştirme ortamı riski olarak Orta öncelikli
    bulgudur (B-DEV-AUDIT). `npm audit fix` veya CRA'dan Vite'a geçiş değerlendirilmeli.

## Dış Bağlantı Taraması

Kaynak taramasında `http://`, `https://`, `ftp://`, `ws://`, `wss://` ve protokolsüz
dış URL kalıpları arandı.

### SCORM/öğrenci çıktısı açısından

- `src/utils/scormExport.js:255-259`: SCORM 1.2 XML namespace/schema URL'leri var.
  Bunlar normalde runtime dış istek değildir ve XSD dosyaları pakete ekleniyor; ancak
  çok katı dış URL denetiminde yanlış pozitif olabilir.
- `ftp-hosting/api/index.php:1797-1809`: SCORM 2004 manifest dalı var. Bu ürün kuralına
  aykırı olduğu için birleşik raporda yüksek öncelikli bulguya dönüştürüldü.

### Editör tarafı bilgi notları

- `public/index.html`: Google Fonts preconnect/stylesheet kaldırıldı.
- `src/constants/fonts.js`: CDN fallback kaldırıldı; yalnız yerel `public/fonts/fonts.css`
  deneniyor.
- `scripts/download-fonts.mjs:29`, `scripts/download-fonts.mjs:72`: Google Fonts
  indirme aracı olarak kalıyor; bu runtime/editor açılış yolu değildir.

Mevcut politika editör tarafındaki dış kaynakları SCORM dış link yasağına dahil
etmiyor; bu yüzden ihlal değil, bilgi notudur.

### Tur 2 — Taze dış bağlantı taraması (2026-06-15)

Sıkı tarama (`fetch/XMLHttpRequest/.src=/new Image/href=/src=/@import/url()` + dış
domain) yapıldı. Bulgular:

- **Editör kaynağında (src/, public/) kod-kaynaklı dış fetch YOK.** Tüm gerçek
  `https://` referansları:
  - `FormatRightPanel.jsx:269`, `InteractionBuilderDialog.jsx:214,753`: "URL Aç"
    tetikleyicisi için **placeholder** (`'https://'`). Bu kullanıcının manuel
    ekleyeceği içerik linkidir — izinli istisna; SCORM export'ta uyarı tetiklemeli.
  - `widgetZipParser.js:114`: widget zip'lerinde harici CDN/HTTP **engelleme**
    kontrolü (koruyucu, olumlu).
  - `editorHelpers.js:123-124`: `http(s)` ön ek **kontrolü** (fetch değil).
  - Test fixture'ları (`ornek.com`, `cdn.example.com`, `evil.example`): kasıtlı
    güvenlik testi girdileri, üretime girmez.
- **B-006 doğrulandı:** `public/index.html` Google Fonts içermiyor;
  `src/constants/fonts.js:147` "dış CDN fallback'i yoktur" notuyla yalnız yerel
  `public/fonts/fonts.css` kullanıyor.
- KESİN KURAL (SCORM dış link yasağı) editör kaynağında **statik olarak karşılanıyor.**
  Kesin teyit için gerçek SCORM zip'i üretip tarayıcıda çevrimdışı ağ trafiği
  izlenmeli (Aşama 3/5 canlı kısmı — bu turda yapılmadı).

## SCORM Paketi

Bu turda gerçek zip paket üretilip açılmadı ve tarayıcıda çevrimdışı ağ trafiği
izlenmedi. Statik kaynak kontrolünde JS exporter SCORM 1.2 manifest üretiyor; PHP
yardımcılarındaki SCORM 2004 dalı kaldırıldı.

## Güvenlik / Gizli Bilgi

Bu raporlara API anahtarı, token, FTP şifresi veya gizli değer yazılmadı. Kaynak
taramasında rapora değer olarak taşınması gereken bir gizli bilgi paylaşılmadı.
