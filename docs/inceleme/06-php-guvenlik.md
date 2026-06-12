# 06 — PHP / FTP Hosting Güvenlik İncelemesi

Kapsam: `ftp-hosting/`

## Bulgular

### Yüksek — PHP export yardımcılarında SCORM 2004 dalı hala duruyor

- Durum: Düzeltildi (commit atılmadı).
- TTKB/ürün kuralı riski: Evet
- Kanıt türü: Statik analiz
- Dosya:satır:
  - `ftp-hosting/api/index.php:1776`
  - `ftp-hosting/api/index.php:1781`
  - `ftp-hosting/api/index.php:1797`
  - `ftp-hosting/api/index.php:1880`
  - `ftp-hosting/api/index.php:1883`
- Sorun: Ürün kuralı yalnızca SCORM 1.2 iken `normalize_scorm_standard()` girdi içinde
  `2004` geçerse `scorm2004` döndürüyor ve `build_scorm_manifest()` SCORM 2004
  namespace/manifest dalını üretiyor.
- Etki: Bu yol endpoint düzeyinde şu an kapalı/dormant olsa bile ileride yeniden
  bağlanırsa veya eski state ile tetiklenirse ürün kuralına aykırı SCORM 2004 paket
  üretilebilir. Kılavuzdaki "SCORM çıktısı yalnızca SCORM 1.2" maddesine aykırı.
- Önerilen düzeltme: PHP yardımcılarında SCORM 2004 dalını kaldır. `normalize_scorm_standard()`
  yalnızca `scorm12` döndürsün veya 1.2 dışı girdiyi açık hata olarak reddetsin.
- Yapılan düzeltme: SCORM 2004 manifest dalı kaldırıldı; normalizasyon yalnızca
  `scorm12` döndürüyor.

### Bilgi — Harici URL kabul eden içerik alanları TTKB uyarısı gerektirir

- Kanıt türü: Statik analiz
- Dosya:satır: `ftp-hosting/api/index.php:1702`, `ftp-hosting/api/index.php:1703`
- Sorun: HTTP/HTTPS ile başlayan kullanıcı içerik varlıkları kabul edilebiliyor.
  Politika açısından kullanıcı manuel eklediyse yasak değil; ancak SCORM export
  öncesinde TTKB/KVKK/telif uyarısı gerektirir.
- Etki: Uyarı atlanırsa kritik kabul edilmeli. Bu turda PHP export yolu canlı
  koşturulmadığı için uyarı davranışı fiilen doğrulanmadı.
- Önerilen düzeltme: Aktif export akışı ve PHP fallback akışı için dış link/embed
  varlığında uyarı/engel davranışı otomatik testle doğrulansın.

## İncelenen Dosya Grupları

- `ftp-hosting/api/index.php`
- `ftp-hosting/scorm/`
