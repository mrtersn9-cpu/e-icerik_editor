# 10 — Çapraz Kontroller

## Komut Sonuçları

- `npm run lint`: Başarılı, uyarısız.
- `npm run test -- --runInBand`: Başarılı. 39 test suite, 299 test geçti.
- `npm run build`: Başarılı. Uyarılar:
  - CRA bundle size uyarısı: build çıktısı önerilenden büyük.
  - Node tarafında `fs.F_OK` deprecation uyarısı.
- `npm audit --omit=dev`: `0 vulnerabilities`.

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

## SCORM Paketi

Bu turda gerçek zip paket üretilip açılmadı ve tarayıcıda çevrimdışı ağ trafiği
izlenmedi. Statik kaynak kontrolünde JS exporter SCORM 1.2 manifest üretiyor; PHP
yardımcılarındaki SCORM 2004 dalı kaldırıldı.

## Güvenlik / Gizli Bilgi

Bu raporlara API anahtarı, token, FTP şifresi veya gizli değer yazılmadı. Kaynak
taramasında rapora değer olarak taşınması gereken bir gizli bilgi paylaşılmadı.
