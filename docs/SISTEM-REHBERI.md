# E-İçerik Editörü Sistem Rehberi

Son doğrulama: 2026-06-01

Bu dosya projenin güncel giriş noktasıdır. Ayrıntılı alt belgeleri tek yerde toplar ve hangi bilginin bağlayıcı olduğunu açıklar.

## Belge Önceliği

1. [../AGENTS.md](../AGENTS.md): Ajanların uyması gereken bağlayıcı çalışma kuralları.
2. [TTKB-UYUM-POLITIKASI.md](TTKB-UYUM-POLITIKASI.md): Öğrenci önizlemesi, HTML ve SCORM çıktıları için bağlayıcı TTKB politikası.
3. [SISTEM-REHBERI.md](SISTEM-REHBERI.md): Güncel mimari, akışlar ve bilinen riskler.
4. Operasyon belgeleri: FTP, Git, güvenlik, PDF ve widget ayrıntıları.
5. `CHANGELOG.md`: Yalnız tarihsel kayıt. Güncel mimari kaynağı değildir.

## Sistem Özeti

Proje React tabanlı bir e-içerik editörüdür. Editör; kitap, etkinlik, sahne, katman, nesne, tetikleyici, soru, PDF entegrasyonu ve özel widget akışlarını yönetir. Öğrenci önizlemesi ile SCORM çıktısının ortak runtime mantığını kullanması temel ilkedir.

Ana alanlar:

- `src/EIcerikEditor.jsx`: Editör orkestrasyonu ve üst seviye akışlar.
- `src/features/`, `src/components/`: Editör panelleri ve arayüz parçaları.
- `src/logic/`: Sahne, tema, PDF, drag-drop, timeline ve normalizasyon mantığı.
- `src/utils/storylineRuntime*.js`: Önizleme ve öğrenci runtime davranışı.
- `src/utils/scormExport.js`: Tarayıcı tarafında SCORM 1.2 ZIP üretimi.
- `src/utils/ttkbCompliance.js`: Editör verisi için TTKB denetimi ve normalizasyonu.
- `src/PdfCleanStudio.jsx`: Tam ekran PDF düzenleme stüdyosu.
- `src/widgets/`, `public/widgets/`: Özel widget protokolü, doğrulayıcı ve yerleşik widgetlar.

## Çalışma Ortamları

### Yerel Geliştirme

```powershell
npm install
npm start
```

`npm start`, `dev.mjs` üzerinden boş portları bulur. Varsayılan başlangıç noktaları editör için `http://localhost:3000`, API için `http://localhost:4001` adresidir. Port doluysa sonraki boş port seçilir.

Yerel API:

- `server.mjs`
- SQLite verisi: `data/e-icerik-editor.sqlite`
- Güvenlik logu: `data/security-events.log`

### FTP/PHP Yayını

```powershell
.\scripts\hazirla-ftp.ps1
```

Bu akış yedek alır, temiz build üretir ve `deploy-ftp/` klasörünü hazırlar. Canlı API PHP + MySQL kullanır. Sunucudaki `api/config.php` deploy paketine eklenmez ve ayrıca korunmalıdır.

Ayrıntı: [FTP-KURULUM.md](FTP-KURULUM.md)

## Yayın ve SCORM

- Ürün yalnızca SCORM 1.2 paket üretir.
- SCORM ZIP tarayıcı tarafında `src/utils/scormExport.js` ile oluşturulur.
- PHP API içindeki eski SCORM export endpointleri kapalıdır ve `410` döndürür.
- Önizleme ve SCORM aynı runtime kararlarını kullanmalıdır.
- Harici HTTP/HTTPS link veya embed bulunduğunda paketleme öncesi TTKB/KVKK/telif uyarısı zorunludur.
- TTKB düzeltmesi yalnız preview veya yalnız SCORM katmanına eklenmez; editör verisi ve editör kontrolleri kaynak kabul edilir.

## TTKB Kontrolü

Öğrenciye görünen her değişiklikte [../AGENTS.md](../AGENTS.md) ve [TTKB-UYUM-POLITIKASI.md](TTKB-UYUM-POLITIKASI.md) uygulanır.

Asgari kontrol:

- İçerik hukuki, etik, bilimsel ve pedagojik açıdan uygun.
- Metinler tutarlı, okunur ve hedef sınıf seviyesine uygun.
- Buton yazıları tek satırda kalıyor.
- Kontrast, semantik ikon ve klavye/ekran okuyucu etiketleri yeterli.
- Popup ve katmanlar açıldığında base layer etkileşimi sızmıyor.
- Aynı paketteki butonlar ortak hareket profili kullanıyor.
- Link, tetikleyici, yeniden başlatma, cevap kontrolü ve SCORM başlangıcı deneniyor.

## PDF Akışı

İki offline yol vardır:

- Editör içindeki PDF düzenleme stüdyosu: `src/PdfCleanStudio.jsx`
- Ek komut satırı ayrıştırıcısı: `npm run pdf:storyboard`

Komut satırı ayrıntısı: [PDF-STORYBOARD-IMPORT.md](PDF-STORYBOARD-IMPORT.md)

`data/pdf-output-*` klasörleri geçici çıktıdır; kalıcı sistem belgesi değildir.

## Widget Akışı

- Yerleşik widgetlar: `public/widgets/builtins/`
- Editör içi ZIP yükleme: `src/widgets/widgetZipParser.js`
- Widget iletişimi: `EicerikWidget` postMessage protokolü
- Widget doğrudan SCORM API, ana React state veya ana DOM yönetmez.

Ayrıntı: [EICERIK_WIDGET_SDK.md](EICERIK_WIDGET_SDK.md)

## Güvenlik

- Yerel Node sunucusu için parola, session token secret, admin token ve allowed origins ayarlanmalıdır.
- FTP/PHP yayını için sunucudaki `api/config.php` ayrıca korunmalıdır.
- `ftp-hosting/api/config.php`, SQLite verileri, loglar, build ve deploy çıktıları Git'e eklenmez.
- `Dışa Aktar`, editör yedeğidir.
- `Güvenli LMS`, cevap anahtarlarını ayıran öğrenci JSON çıktısıdır.
- `SCORM 1.2 ZIP`, LMS'e yüklenecek pakettir.

Ayrıntı: [GUVENLIK-AYARLARI.md](GUVENLIK-AYARLARI.md)

## Temel Komutlar

```powershell
npm start
npm run test -- --runInBand
npm run lint
npm run build
.\scripts\hazirla-ftp.ps1
.\scripts\kaydet.ps1 -Mesaj "Kısa sürüm notu"
```

## Bilinen Riskler

1. Widget içeren SCORM çıktıları yayın için hazır değildir. `src/utils/scormExport.js` içinde `customWidgetFiles` hazırlanıyor, fakat nihai ZIP dosya listesine eklenmiyor.
2. `ftp-hosting/api/index.php` içinde erişilemeyen eski sunucu tarafı SCORM yardımcıları hâlâ duruyor. Endpointler `410` döndürüyor; bu kod tekrar bağlanmamalı ve ayrı bir temizlik işinde kaldırılmalı.
3. Node.js + SQLite ile FTP/PHP + MySQL güvenlik özellikleri birebir aynı değildir. Yayın öncesi hedef ortam testi zorunludur.

## Aktif Belgeler

Kök dizinde yalnızca [../AGENTS.md](../AGENTS.md) ve [../CLAUDE.md](../CLAUDE.md) kalır — bu
ikisi ajan araçlarının (Claude Code, Codex vb.) otomatik olarak kök dizinde aradığı özel
dosyalardır, taşınamaz. Geri kalan tüm belgeler bu klasördedir (`docs/`):

- [../AGENTS.md](../AGENTS.md)
- [SISTEM-REHBERI.md](SISTEM-REHBERI.md)
- [PROJE-DURUM-RAPORU.md](PROJE-DURUM-RAPORU.md) — çalışan/yarıda kalmış/çalışmayan
  özellikler ve kritik noktalar (son doğrulama: 2026-07-20)
- [CHANGELOG.md](CHANGELOG.md)
- [TTKB-UYUM-POLITIKASI.md](TTKB-UYUM-POLITIKASI.md)
- [UI_DIL_REHBERI.md](UI_DIL_REHBERI.md)
- [FTP-KURULUM.md](FTP-KURULUM.md)
- [GIT-AKISI.md](GIT-AKISI.md)
- [GUVENLIK-AYARLARI.md](GUVENLIK-AYARLARI.md)
- [PDF-STORYBOARD-IMPORT.md](PDF-STORYBOARD-IMPORT.md)
- [EICERIK_WIDGET_SDK.md](EICERIK_WIDGET_SDK.md)
- [MD-DOSYALARI-ANALIZI.md](MD-DOSYALARI-ANALIZI.md)
- [INCELEME-KILAVUZU.md](INCELEME-KILAVUZU.md)

Scriptler `scripts/` altındadır (`hazirla-ftp.ps1`, `kaydet.ps1`, `oto-kaydet.ps1`,
`yedekle.ps1`, `baslat.bat`).
