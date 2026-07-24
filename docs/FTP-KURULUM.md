# FTP Kurulum

Bu proje FTP ile yüklenebilen PHP + MySQL hosting için hazırlanır. Yerel Node.js sunucusu ile FTP/PHP yayını aynı editörü çalıştırır, ancak veri katmanları farklıdır.

## 1. Veritabanı

- Hosting panelinden bir MySQL veritabanı oluştur (bu adım otomatikleştirilemez — hosting
  panelinizden yapılmalı).
- Tablolar (`app_state`, `projects`, `book_locks`, `user_sessions`, `project_versions`,
  `editor_users`) ELLE OLUŞTURULMASINA GEREK YOKTUR — site ilk kez açıldığında (§ 4'teki
  yükleme sonrası tarayıcıda siteyi ziyaret ettiğinizde) frontend otomatik olarak bir
  hazırlık isteği gönderir ve eksik tablolar kendiliğinden oluşur/`api/.env`'deki
  kullanıcı bilgileriyle tohumlanır. `ftp-hosting/mysql-schema.sql` yalnızca elle/manuel
  kurulum tercih edenler için referans olarak durur.

## 2. API Ayarı

- Veritabanı, kullanıcı, admin token ve izinli origin bilgileri artık `api/config.php`'nin
  içine değil, aynı klasördeki `api/.env` dosyasına yazılır (`config.php` bunu otomatik okur).
- **Yerelde**, proje kökündeki `ftp-hosting/api/.env.example` dosyasını
  `ftp-hosting/api/.env` olarak kopyala, gerçek değerleri gir (bkz.
  `docs/GUVENLIK-AYARLARI.md` § FTP/PHP + MySQL, anahtar listesi için).
- `ftp-hosting/api/.env` parola içerdiği için Git tarafından izlenmez, ama paket hazırlama
  adımına (§ 3) DAHİL edilir — yani bir kez yerelde doldurduktan sonra her `build.bat`/
  `hazirla-ftp.ps1` çalıştırmasında otomatik olarak deploy paketine girer.

## 3. Paket Hazırlama

PowerShell'de proje klasöründe şu komutu çalıştır:

```powershell
.\scripts\hazirla-ftp.ps1
```

Bu komut:

1. `yedekle.ps1` ile kaynak kod yedeği alır.
2. Temiz bir React production build üretir.
3. `ftp-hosting/` şablonu ile build çıktısını `deploy-ftp/` altında birleştirir.
4. `api/config.php`'yi DAHİL EDER (artık sır içermiyor, yalnız `.env` okuma mantığı var).
   `api/.env` yerelde varsa (§ 2) pakete DAHİL EDİLİR; yoksa yalnız secretsiz
   `api/.env.example` şablonu pakette kalır.
5. `deploy-ftp/DEPLOY-KONTROL.txt` içine build doğrulama bilgisini (`.env`'in dahil olup
   olmadığı dahil) yazar.

`scripts/build.bat` aynı adımları çalıştırıp sonucu `deploy-ftp/` yerine `dist/` klasörüne
taşır — sunucuya yüklenecek klasör budur.

**Dikkat:** `api/.env` artık pakete dahil olduğu için `dist/`/`deploy-ftp/` klasörü gerçek
veritabanı şifresi/token içerebilir. Bu klasörleri e-posta, zip, genel bir depo vb. ile
paylaşmayın; yalnızca FTP ile hedef sunucuya yükleyin.

## 4. FTP Yükleme

- `deploy-ftp/` (veya `build.bat` ile üretilen `dist/`) içindeki dosyaları sitenin ana
  klasörüne yükle — `api/config.php` ve `api/.env` (paketteyse) birlikte gider, ayrıca elle
  yüklemeye gerek yok.
- `index.html`, `static/`, `api/` ve `.htaccess` aynı kök dizinde olmalı.
- **ÖNEMLİ — FTP istemcinizi kontrol edin:** yükleme "senkronize et / yansıt" (mirror/sync)
  modundaysa VE yerel `dist/api/.env` boşsa (siz doldurmadıysanız), FTP istemciniz
  sunucudaki gerçek `.env`'i SİLEBİLİR. Normal "yükle/üzerine yaz" (upload/merge) modunu
  kullanın, mirror modundan kaçının.
- Eğer sunucudaki `api/.env` değerleri yereldekinden farklıysa (ör. sunucuda elle
  değiştirdiyseniz), bir sonraki yüklemede yereldeki paket sunucudakini ÜZERİNE YAZAR — önce
  senkronize edin.
- Yükleme sonrası sunucudaki `DEPLOY-KONTROL.txt` ile yerel dosyayı karşılaştır.

## 5. Sonuç

- Site: `https://alanadin.com` (örnek/placeholder — kendi alan adınızı kullanın)
- API: `https://alanadin.com/api/index.php?route=/state`
- Bu projenin gerçek çalışan canlı URL'i: `https://editori.hepsibirdijital.com/`
  (`api/.env`'deki `ALLOWED_ORIGINS` bu URL'i içermeli).

Frontend canlı ortamda aynı domain altındaki PHP API yolunu otomatik kullanır.
