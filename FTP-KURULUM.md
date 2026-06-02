# FTP Kurulum

Bu proje FTP ile yüklenebilen PHP + MySQL hosting için hazırlanır. Yerel Node.js sunucusu ile FTP/PHP yayını aynı editörü çalıştırır, ancak veri katmanları farklıdır.

## 1. Veritabanı

- Hosting panelinden bir MySQL veritabanı oluştur.
- İlk kurulumda `ftp-hosting/mysql-schema.sql` dosyasını phpMyAdmin üzerinden çalıştır.

## 2. API Ayarı

- Sunucudaki `api/config.php` dosyasına veritabanı, kullanıcı, admin token ve izinli origin bilgilerini yaz.
- Yerelde örnek almak gerekiyorsa `ftp-hosting/api/config.php` kullanılabilir.
- `ftp-hosting/api/config.php` parola içerebildiği için Git tarafından izlenmez.

## 3. Paket Hazırlama

PowerShell'de proje klasöründe şu komutu çalıştır:

```powershell
.\hazirla-ftp.ps1
```

Bu komut:

1. `.\yedekle.ps1` ile kaynak kod yedeği alır.
2. Temiz bir React production build üretir.
3. `ftp-hosting/` şablonu ile build çıktısını `deploy-ftp/` altında birleştirir.
4. `api/config.php` dosyasını deploy paketine eklemez.
5. `deploy-ftp/DEPLOY-KONTROL.txt` içine build doğrulama bilgisini yazar.

## 4. FTP Yükleme

- `deploy-ftp/` içindeki dosyaları sitenin ana klasörüne yükle.
- `index.html`, `static/`, `api/` ve `.htaccess` aynı kök dizinde olmalı.
- Sunucudaki mevcut `api/config.php` dosyasını silme veya üzerine yazma.
- İlk kurulumda `api/config.php` dosyasını ayrıca, güvenli biçimde sunucuya yerleştir.
- Yükleme sonrası sunucudaki `DEPLOY-KONTROL.txt` ile yerel dosyayı karşılaştır.

## 5. Sonuç

- Site: `https://alanadin.com`
- API: `https://alanadin.com/api/index.php?route=/state`

Frontend canlı ortamda aynı domain altındaki PHP API yolunu otomatik kullanır.
