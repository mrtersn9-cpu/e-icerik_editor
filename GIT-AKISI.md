# Git Akisi

Projede iki temel script var:

- `.\kaydet.ps1`
  - Degisiklikleri listeler.
  - Surum notunu sorar veya otomatik uretir.
  - `CHANGELOG.md` dosyasina yeni kayit ekler.
  - Commit alir.
  - `origin` remote varsa push dener.

- `.\oto-kaydet.ps1`
  - Belirli araliklarla repo durumunu kontrol eder.
  - Degisiklik bulursa `kaydet.ps1 -Auto` ile otomatik commit alir.
  - Ornek: `.\oto-kaydet.ps1 -AralikSaniye 300`

Notlar:

- Bu makinede su an GitHub CLI (`gh`) kurulu degil.
- Bu nedenle uzak GitHub reposu otomatik olusturulmadi.
- Uzak repo baglandiginda `kaydet.ps1` ve `oto-kaydet.ps1` push da yapar.

Onerilen ilk adimlar:

1. GitHub'da repo olustur.
2. `git remote add origin <repo-url>` komutunu calistir.
3. `.\kaydet.ps1 "Ilk senkron"` ile ilk push'u gonder.
