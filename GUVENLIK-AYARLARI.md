# Guvenlik Ayarlari

Canli ortamda varsayilan gelistirme degerleriyle calistirmayin. Sunucuyu baslatmadan once asagidaki ortam degiskenlerini tanimlayin.

## Zorunlu

- `EICERIK_USER1_PASSWORD`: Ilk editor kullanicisinin sifresi.
- `EICERIK_USER2_PASSWORD`: Ikinci editor kullanicisinin sifresi.
- `EICERIK_SESSION_TOKEN_SECRET`: Imzali oturum tokenlari icin uzun ve rastgele secret.
- `EICERIK_ADMIN_TOKEN`: `/api/admin/*` kullanici yonetimi endpointleri icin admin token.
- `EICERIK_ALLOWED_ORIGINS`: Virgulle ayrilmis izinli origin listesi.

## Onerilen

- `EICERIK_SESSION_TTL_MS`: Aktif heartbeat oturum kilidi suresi. Varsayilan `60000`.
- `EICERIK_SESSION_TOKEN_TTL_MS`: Bearer token gecerlilik suresi. Varsayilan 8 saat.
- `EICERIK_LOGIN_RATE_MAX_ATTEMPTS`: Rate limit penceresindeki hatali giris siniri. Varsayilan `5`.
- `EICERIK_LOGIN_RATE_WINDOW_MS`: Rate limit penceresi. Varsayilan 5 dakika.
- `EICERIK_LOGIN_RATE_LOCK_MS`: Kilit suresi. Varsayilan 10 dakika.
- `EICERIK_BODY_LIMIT_BYTES`: API JSON body limiti. Varsayilan `10000000`.
- `EICERIK_DATA_DIR`: Veritabani ve guvenlik log klasoru. Test/servis ayrimi icin kullanilabilir.

## Guvenlik Loglari

Sunucu guvenlik olaylarini `data/security-events.log` dosyasina JSON Lines formatinda yazar. Loglara parola, admin token veya session token yazilmaz. Yonetim modalinda olay tipi, kullanici ID ve tarih araligi ile filtreleme yapilabilir.

Kaydedilen baslica olaylar:

- Basarili ve basarisiz girisler
- Login rate limit
- Oturum cikisi, kick istegi ve zorla devralma
- Admin kullanici olusturma, guncelleme ve sifre degistirme
- Izin verilmeyen origin denemeleri

## Admin API

Admin endpointleri `X-Admin-Token` header'i ister. `EICERIK_ADMIN_TOKEN` tanimli degilse admin API `ADMIN_DISABLED` yaniti verir.

- `GET /api/admin/users`
- `POST /api/admin/users`
- `PATCH /api/admin/users/:id`
- `PUT /api/admin/users/:id/password`
- `GET /api/admin/security-events?limit=100&type=login&userId=user1&from=2026-04-01&to=2026-04-20`

## LMS Ogrenci Ciktisi

Editor yedegi icin normal `Dışa Aktar`, ogrenciye verilecek LMS/JSON paketi icin `Güvenli LMS` kullanin. Guvenli cikti cevap anahtari alanlarini, cozum/cevap goster aksiyonlarini ve LMS gizli anahtarlarini dosyadan cikarir; runtime eventlerinde de cevap detayi ve secret alanlari inspect edilebilir objelere yazilmaz.

Not: Tamamen offline ve client-side otomatik puanlama isteyen bir pakette cevap anahtari tarayiciya verilirse teknik olarak gizlenemez. Bu nedenle ogrenciye dagitilacak guvenli cikti cevap anahtarini paketten ayirir.
