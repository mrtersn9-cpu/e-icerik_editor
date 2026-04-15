# Git Akisi

Projede iki temel script var:

- `.\kaydet.ps1`
  - Degisiklikleri listeler.
  - Varsayilan olarak `.\hazirla-ftp.ps1` calistirir.
  - Surum notunu sorar veya otomatik uretir.
  - `CHANGELOG.md` dosyasina yeni kayit ekler.
  - Commit alir.
  - `origin` remote varsa push dener.
  - Gerekirse `-NoPrepare` ile FTP hazirlamayi kapatabilirsin.
  - `-Watch` ile anlik izleme modunu baslatir.

- `.\oto-kaydet.ps1`
  - Dosya sistemini anlik izler.
  - Kod degisikliklerinden sonra kisa bir bekleme suresiyle `kaydet.ps1 -Auto` calistirir.
  - Kendi olusturdugu `build`, `deploy-ftp`, `CHANGELOG.md` ve benzeri dosyalari izleme disinda tutar.
  - Ornek: `.\oto-kaydet.ps1`
  - Bekleme suresi degistirmek icin: `.\oto-kaydet.ps1 -BeklemeSaniye 8`

Notlar:

- Bu makinede su an GitHub CLI (`gh`) kurulu degil.
- Bu nedenle uzak GitHub reposu otomatik olusturulmadi.
- Uzak repo baglandiginda `kaydet.ps1` ve `oto-kaydet.ps1` push da yapar.
- `deploy-ftp/` otomatik izleme disinda tutulur; boylece FTP hazirlama sonrasi sonsuz commit dongusu olusmaz.

Onerilen ilk adimlar:

1. GitHub'da repo olustur.
2. `git remote add origin <repo-url>` komutunu calistir.
3. `.\kaydet.ps1 "Ilk senkron"` ile ilk push'u gonder.
4. Surekli otomatik kayit icin `.\kaydet.ps1 -Watch` komutunu acik bir terminalde calistir.
