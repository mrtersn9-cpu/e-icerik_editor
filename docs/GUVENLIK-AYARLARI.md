# Güvenlik Ayarları

Yerel Node.js sunucusu ve FTP/PHP yayını farklı veri katmanları kullanır. Canlı ortamda varsayılan geliştirme değerleriyle çalışmayın.

## Yerel Node.js + SQLite

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

Canlı hosting ayarları sunucudaki `api/config.php` dosyasında tutulur:

- `db_host`, `db_port`, `db_name`, `db_user`, `db_pass`
- `admin_token`
- `users`
- `allowed_origins`
- `pdf_analysis_mode`

`api/config.php` parola içerebilir. Git'e eklenmez, deploy paketine yazılmaz ve sunucuda ayrıca korunur. FTP/PHP API ile Node API güvenlik özellikleri birebir aynı kabul edilmemelidir; canlıya çıkmadan önce hedef ortamda oturum, origin, admin yedeği ve yetki kontrolleri denenmelidir.

## Öğrenci Çıktıları

- Editör yedeği için `Dışa Aktar` kullanılır.
- Cevap anahtarlarını ayıran JSON için `Güvenli LMS` kullanılır.
- LMS'e yüklenecek paket için yalnızca `SCORM 1.2 ZIP` kullanılır.
- SCORM dışa aktarımı tarayıcıda üretilir; PHP tarafındaki eski SCORM export endpointleri kapalıdır.
- Harici HTTP/HTTPS link veya embed varsa SCORM üretiminden önce TTKB/KVKK/telif uyarısı gösterilir.

Tamamen çevrimdışı ve tarayıcı içinde otomatik puanlayan içerikte cevap anahtarını teknik olarak bütünüyle gizlemek mümkün değildir. Öğrenciye dağıtılacak çıktı türünü amaca göre seçin.
