# Güvenlik Ayarları

Yerel Node.js sunucusu ve FTP/PHP yayını farklı veri katmanları kullanır. Canlı ortamda varsayılan geliştirme değerleriyle çalışmayın.

## Yerel Node.js + SQLite

`server.mjs` başlarken proje kökündeki `.env` dosyasını (varsa) otomatik okur
(`process.loadEnvFile`, ek paket gerekmez). Kurulum: `.env.example`'ı `.env` olarak
kopyalayıp değerleri doldurun (`cp .env.example .env`). `.env` git'e eklenmez
(`.gitignore`), yalnız `.env.example` (secretsiz şablon) depoda tutulur.

`server.mjs` için zorunlu canlı ortam değişkenleri:

- `EICERIK_USER1_PASSWORD`: İlk editör kullanıcısının şifresi.
- `EICERIK_USER2_PASSWORD`: İkinci editör kullanıcısının şifresi.
- `EICERIK_SESSION_TOKEN_SECRET`: İmzalı oturum tokenları için uzun ve rastgele secret.
- `EICERIK_ADMIN_TOKEN`: `/api/admin/*` yönetim endpointleri için admin token.
- `EICERIK_ALLOWED_ORIGINS`: Virgülle ayrılmış izinli origin listesi.

Önerilen değişkenler:

- `EICERIK_SESSION_TTL_MS`: Aktif heartbeat oturum kilidi süresi. Varsayılan `60000`.
- `EICERIK_SESSION_TOKEN_TTL_MS`: Bearer token geçerlilik süresi. Varsayılan 8 saat.
- `EICERIK_LOGIN_RATE_MAX_ATTEMPTS`: Rate limit penceresindeki hatalı giriş sınırı. Varsayılan `5`.
- `EICERIK_LOGIN_RATE_WINDOW_MS`: Rate limit penceresi. Varsayılan 5 dakika.
- `EICERIK_LOGIN_RATE_LOCK_MS`: Kilit süresi. Varsayılan 10 dakika.
- `EICERIK_BODY_LIMIT_BYTES`: API JSON body limiti. Varsayılan `10000000`.
- `EICERIK_DATA_DIR`: SQLite veritabanı ve güvenlik log klasörü.

Node sunucusu güvenlik olaylarını `data/security-events.log` dosyasına JSON Lines formatında yazar. Loglara parola, admin token veya session token yazılmaz.

Node admin endpointleri:

- `GET /api/admin/users`
- `POST /api/admin/users`
- `PATCH /api/admin/users/:id`
- `PUT /api/admin/users/:id/password`
- `GET /api/admin/security-events`
- `GET /api/admin/backup`

## FTP/PHP + MySQL

Canlı hosting ayarları `api/config.php` üzerinden okunur, ama gerçek değerler artık
`api/config.php`'nin içine değil, aynı klasördeki `api/.env` dosyasına yazılır
(`config.php` bu dosyayı otomatik okur, satırları `KEY=VALUE` formatındadır).
Kurulum: sunucuda `api/.env.example`'ı `api/.env` olarak kopyalayıp değerleri doldurun.

`.env` içindeki anahtarlar:

- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`, `DB_CHARSET`, `DB_CONNECT_TIMEOUT`
- `ADMIN_TOKEN`
- `USER1_NAME`, `USER1_PASSWORD`, `USER2_NAME`, `USER2_PASSWORD`
- `ALLOWED_ORIGINS` (virgülle ayrılmış), örn. canlı URL: `https://editori.hepsibirdijital.com`
- `PDF_ANALYSIS_MODE`

**Kullanıcı giriş bilgileri artık veritabanında (`editor_users` tablosu, bcrypt hash) tutulur,
`.env`/`config.php` yalnızca İLK KURULUM tohumlaması için kaynak.** Site ilk açıldığında
(`GET /health?requireDatabase=1` — frontend bunu otomatik çağırır, elle bir şey yapmaya gerek
yok) `editor_users` tablosu yoksa otomatik oluşturulur ve o an `.env`'deki
`USER1_PASSWORD`/`USER2_PASSWORD` değerleriyle tohumlanır (`ftp-hosting/api/index.php`:
`ensure_editor_users_schema`). **Bu tohumlama yalnızca tablo BOŞKEN çalışır** — ilk açılıştan
sonra `.env`'deki şifreyi değiştirmek veritabanındakini GÜNCELLEMEZ. Şifre değiştirmek için:
```sql
-- yeni_hash degerini once `php -r "echo password_hash('YeniSifre123', PASSWORD_DEFAULT);"`
-- ile uretin, sonra asagidaki UPDATE'e yapistirin.
UPDATE editor_users SET password_hash = '<yeni_hash>' WHERE id = 'kullanici1';
```
Bu yüzden ilk deploy'dan ÖNCE `.env`'deki `USER1_PASSWORD`/`USER2_PASSWORD` alanlarının gerçek,
güçlü değerlerle dolu olduğundan emin olun — boş bırakılırsa placeholder değerler
(`GUCLU_SIFRE_1`/`GUCLU_SIFRE_2`, bu depoda herkese açık) veritabanına kalıcı olarak yazılır.
Tüm diğer tablolar (`app_state`, `projects`, `book_locks`, `user_sessions`,
`project_versions`) da aynı otomatik kontrolle oluşturulur — `ftp-hosting/mysql-schema.sql`'i
elle çalıştırmaya GEREK YOKTUR, yalnız referans/manuel kurulum tercih edenler içindir.

`api/.env` parola içerir ve Git'e eklenmez (`.gitignore`). `scripts/hazirla-ftp.ps1`/`build.bat`
ile üretilen deploy paketine (`deploy-ftp/` veya `dist/`) **yerelde `api/.env` varsa dahil edilir**
(sunucuya yüklendiğinde birlikte gider); yoksa yalnız secretsiz `api/.env.example` şablonu
pakette kalır. `dist/`/`deploy-ftp/` klasörleri de Git'e eklenmez, ama bu klasörleri elle
paylaşırken/yedeklerken (ör. e-posta, zip, başka bir depoya kopyalama) içinde gerçek `.env`
olabileceğini unutmayın. `api/config.php`'nin kendisi (kaynak dosya, sır içermez) artık deploy
paketine DAHİL edilir (eskiden hariç tutuluyordu; bu, "senkronize et" modunda FTP yükleyen
istemcilerde sunucudaki `config.php`'nin tamamen silinip API'nin her istekte fatal hata
vermesine yol açabiliyordu — 2026-07-23'te düzeltildi). `.env` yokken `config.php` eski
placeholder değerlere (`veritabani_adi` vb.) düşer — bu durumda API veritabanına bağlanmayı
reddeder (`has_placeholder_database_config` kontrolü). FTP/PHP API ile
Node API güvenlik özellikleri birebir aynı kabul edilmemelidir; canlıya çıkmadan önce hedef
ortamda oturum, origin, admin yedeği ve yetki kontrolleri denenmelidir.

## Öğrenci Çıktıları

- Editör yedeği için `Dışa Aktar` kullanılır.
- Cevap anahtarlarını ayıran JSON için `Güvenli LMS` kullanılır.
- LMS'e yüklenecek paket için yalnızca `SCORM 1.2 ZIP` kullanılır.
- SCORM dışa aktarımı tarayıcıda üretilir; PHP tarafındaki eski SCORM export endpointleri kapalıdır.
- Harici HTTP/HTTPS link veya embed varsa SCORM üretiminden önce TTKB/KVKK/telif uyarısı gösterilir.

Tamamen çevrimdışı ve tarayıcı içinde otomatik puanlayan içerikte cevap anahtarını teknik olarak bütünüyle gizlemek mümkün değildir. Öğrenciye dağıtılacak çıktı türünü amaca göre seçin.
