# Git Akışı

Bu depoda `origin` remote tanımlıdır. Scriptler sabit bir dal adına bağlı değildir; çalışılan dalı algılayıp aynı dala push dener.

## Elle Kayıt

```powershell
.\scripts\kaydet.ps1 -Mesaj "Kısa sürüm notu"
```

`kaydet.ps1` şu sırayı izler:

1. Değişiklikleri listeler.
2. Varsayılan olarak `hazirla-ftp.ps1` çalıştırır.
3. `docs/CHANGELOG.md` başına sürüm notu ekler.
4. `git add -A` ve commit çalıştırır.
5. `origin` varsa aktif dalı push eder.

Seçenekler:

- `-NoPrepare`: Build, yedek ve FTP paketi hazırlamayı atlar.
- `-NoPush`: Commit alır, push yapmaz.
- `-Watch`: `oto-kaydet.ps1` izleme modunu açar.

## Otomatik Kayıt

```powershell
.\scripts\oto-kaydet.ps1 -BeklemeSaniye 8
```

Bu script dosya sistemini izler ve kısa bir beklemeden sonra `kaydet.ps1 -Auto` çalıştırır. `.git`, `node_modules`, `build`, `deploy-ftp`, `deploy-ftp-temp`, `docs/CHANGELOG.md` ve `data/pdf-output-*` yolları izleme dışında tutulur.

## Dikkat

- `docs/CHANGELOG.md` otomatik oluşan tarihsel kayıttır; güncel sistem mimarisini anlatan kaynak değildir.
- Büyük ve deneysel çalışma sırasında her otomatik kayıtta build ve yedek alınmasını istemiyorsan `-NoPrepare` kullan.
- Yayın paketi gerekiyorsa en az bir kez `.\scripts\hazirla-ftp.ps1` çalıştırıp build sonucunu doğrula.
