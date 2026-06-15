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

## Tur 2 — Derin Güvenlik İncelemesi (OWASP odaklı, 2026-06-15)

### B6-K1 — KRİTİK: İçerik uçlarında yetkilendirme yok (yetkilendirme atlama) [DÜZELTİLDİ ✓]

> **DURUM (2026-06-15): Düzeltildi ve gerçek XAMPP PHP 8.2 + MySQL ortamında doğrulandı.**
> `require_active_session($pdo)` geçidi eklendi (dispatch başında, `/auth/*` ve `/admin/backup`
> hariç tüm uçlara); `apiClient.uploadMediaFile` oturum başlığı gönderiyor. Test: oturumsuz/sahte
> → 401, login → 200, geçerli oturum → 200, oturumsuz `/upload` → 401. Detay: 99-BIRLESIK-RAPOR.md.


- Dosya:satır: `ftp-hosting/api/index.php:173` (ve tüm veri uçları)
- Kanıt türü: Statik analiz + **manuel doğrulama** (grep: tek auth kapısı satır 164
  `require_admin_token`, yalnız `/admin/backup` için).
- Sorun: `/auth/login` + `user_sessions` tablosuyla bir oturum mekanizması kurulmuş ama
  **yalnız `/admin/backup`** korunuyor. `/workspace`, `/state` (GET+PUT), `/projects`
  (GET/POST/DELETE), `/projects/{id}/draft` (PUT), `/versions`, `/publish`, `/restore`,
  `/duplicate`, `/upload` — **hiçbiri kimlik/oturum kontrolü yapmıyor.** `.htaccess`'te de
  Basic auth yok.
- Etki: API URL'sini bilen herkes (paylaşımlı FTP host'ta tahmin edilebilir) tüm projeleri
  okuyabilir, değiştirebilir, silebilir ve dosya yükleyebilir. Login akışı fiilen
  gösterimlik. **Üretim ortamı PHP/MySQL paylaşımlı FTP olduğundan canlı ve ciddi.**
- Önerilen düzeltme: admin/backup dışındaki tüm yazma (ve tercihen okuma) uçlarının başına
  `X-User-Id` + `X-Session-Id`'yi `user_sessions`'a karşı doğrulayan ortak bir
  `require_active_session($pdo)` geçidi ekle; geçersiz/süresi dolmuş oturumda 401 dön.

### B6-Y1 — Kitap kilidinde kimlik doğrulanmadan başlık güveniliyor (kilit sahteciliği)

- `ftp-hosting/api/index.php:431` — `lock`/`unlock` `HTTP_X_USER_ID`/`HTTP_X_SESSION_ID`'yi
  doğrudan alıp yalnız boş olup olmadığını kontrol ediyor; `user_sessions`'a karşı
  doğrulamıyor. Saldırgan rastgele başlık üretip başkasının kitabını kilitleyebilir/kilidini
  çalabilir. **Fix:** işlemden önce oturumu doğrula, `user_name`'i doğrulanmış kayıttan türet.

### B6-Y2 — Kimliksiz dosya yükleme ucu (kimlik yok + sınırsız)

- `ftp-hosting/api/index.php:360` — `/upload` oturum/kimlik kontrolü yapmıyor; herkese açık.
  MIME `finfo` ile doğrulanıyor ve dosya adı `random_bytes` ile üretiliyor (iyi), ama kimlik
  doğrulaması olmadığından internetten herkes diski doldurabilir (DoS) ve `/static/uploads`
  altında kalıcı servis edilen dosya bırakabilir. Boyut/oran sınırı yok. B6-K1 ile birleşince
  somut kötüye kullanım yüzeyi. **Fix:** aktif oturum şartı + sunucu tarafı boyut/oran sınırı.

### Orta

- `ftp-hosting/api/index.php` — (B6 Orta bulguları workflow çıktısında; çoğunlukla giriş
  doğrulama ve hata mesajı detayları)

> Not: Gizli değerler (varsa) rapora yazılmadı; yalnız dosya:satır + risk türü belirtildi.
> `config.php` tarafında sabit kodlanmış kritik secret tespit edilmedi (yalnız Düşük notlar).

## İncelenen Dosya Grupları

- `ftp-hosting/api/index.php` (1859 satır — tamamı)
- `ftp-hosting/api/config.php`
- `ftp-hosting/scorm/`
