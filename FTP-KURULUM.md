# FTP Kurulum

Bu proje, FTP ile yuklenebilen PHP + MySQL hosting icin hazirlandi.

## 1. Veritabani

- Hosting panelinden bir MySQL veritabani olustur.
- `ftp-hosting/mysql-schema.sql` dosyasini phpMyAdmin uzerinden calistir.

## 2. API ayari

- `ftp-hosting/api/config.php` icine veritabani bilgilerini yaz.

## 3. Paket hazirlama

PowerShell'de proje klasorunde su komutu calistir:

```powershell
.\hazirla-ftp.ps1
```

Bu komut `deploy-ftp/` klasorunu olusturur.

## 4. FTP yukleme

- `deploy-ftp/` klasorunun icindeki tum dosyalari sitenin ana klasorune yukle.
- `index.html`, `static/`, `api/` ve `.htaccess` ayni kok dizinde olmali.

## 5. Sonuc

- Site: `https://alanadin.com`
- API: `https://alanadin.com/api/state`

Frontend artik ayni domain altindaki `/api` yolunu kullanir.
