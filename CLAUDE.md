Always respond in Turkish. Write all commit messages, PR descriptions,
and code comments in Turkish.

# Proje Özeti

React + Zustand tabanlı bir e-içerik/SCORM editörü. Kitap → sahne → katman → nesne →
tetikleyici → cevap modeliyle çalışır; öğrenci önizlemesi ve SCORM 1.2 çıktısı ortak
runtime mantığını paylaşır. Ürün yalnızca SCORM 1.2 paketi üretir (SCORM 2004/xAPI/cmi5/LTI
yok).

**Bağlayıcı belge sırası** (bu dosyadan önce gelir, çelişki olursa onlar kazanır):

1. [AGENTS.md](AGENTS.md) — TTKB (öğrenciye görünen içerik) politikası, ajan kuralları.
2. [docs/TTKB-UYUM-POLITIKASI.md](docs/TTKB-UYUM-POLITIKASI.md) — önizleme/HTML/SCORM
   çıktısı için bağlayıcı uyum politikası.
3. [docs/SISTEM-REHBERI.md](docs/SISTEM-REHBERI.md) — mimari, çalışma ortamları, komutlar,
   bilinen riskler için tek giriş noktası.

Kod mimarisi, dosya yapısı ve komutlar için tekrar üretmek yerine docs/SISTEM-REHBERI.md'ye
bakılmalı; burada yalnız güncel durum özeti tutulur.

## Güncel Durum (son doğrulama: 2026-07-21)

Ayrıntılı kanıtlı rapor: **[docs/PROJE-DURUM-RAPORU.md](docs/PROJE-DURUM-RAPORU.md)**
(çalışan/yarıda kalmış/çalışmayan özellikler + kritik noktalar + mimari temizlik özeti,
dosya:satır referanslı — 2026-07-20 tarihli, bazı maddeler 2026-07-21'de düzeltildi, bkz.
aşağı). Denetim geçmişi: [docs/inceleme/](docs/inceleme/) (99-BIRLESIK-RAPOR.md).

**Sağlık:** 368/368 test yeşil (45 dosya), lint temiz, `npm run build` başarılı.
`CI=true npm run build` hâlâ ESLint uyarılarını hataya çevirdiği için başarısız oluyor
(bkz. rapor § 4.6) — CI'ya bağlanmadan önce düzeltilmeli.

**2026-07-20 mimari temizliği** (rapor § 9): ölü/yetim kod ve 11 tehlikeli tek-seferlik
script silindi; `server.mjs` sır temizleme + token doğrulama açıkları ve PHP upload boyut
sınırı kapatıldı; `PreviewExtraFlows.jsx`/`PdfCleanStudio.jsx`/`EIcerikEditor.jsx`
modüllere bölündü; ID üretimi ve zayıf shuffle konsolide edildi; kök dizindeki `.md`/
`.ps1`/`.bat` dosyaları `docs/`/`scripts/` altına taşındı.

**2026-07-21: aşağıdaki maddeler düzeltildi** (önceden "çalışmayan/kırık" ve "yarıda kalmış"
listesindeydi):
- `shortcut-key` etkinlik tipi artık SCORM'da doğru tamamlanıyor (`completed:true` eksikliği
  giderildi) — `scormTypedActivityPlayer.js`, `storylineRuntimeEngine.js`.
- `completionMode` (opsiyonel/zorunlu) artık typed SCORM player tarafından okunuyor —
  `storylineRuntime.js` (PAYLOAD'a taşıma), `scormTypedActivityPlayer.js`.
- `duplicateActivity` artık kopyalanan etkinlikteki trigger/nesne/timeline referanslarını
  doğru remap ediyor — `LibraryWorkspace.jsx`, `src/logic/activityHelpers.js`.
- Karma etkinlikte tip değişimi artık cevap alanlarını silmiyor, seçenek/eşleştirme ekleme
  butonları eklendi — `KarmaCevapPanel.jsx`.
- "URL Aç" tetikleyicisine Bağlantı Adresi (URL) alanı eklendi — `FormatRightPanel.jsx`.
- Bul-Değiştir artık çok-sahneli etkinliklerde `slides[].objects`'i de tarıyor —
  `useRibbonController.js`, yeni `src/logic/objectTextSearch.js`.
- Renk paleti: 9 modalin ortak slate/blue paleti `var(--eic-light-x)` token'larına
  bağlandı (bileşene özgü renkler bilinçli olarak dokunulmadı).
- `scripts/build.bat` eklendi — çalıştırınca sunucuya yüklemeye hazır `dist/` klasörü üretir
  (mevcut `hazirla-ftp.ps1`'i sarmalıyor; `deploy-ftp/` artık kopyalanmıyor, `dist/`e
  taşınıyor — tek klasör kalıyor).
- Zaman çizelgesi (timeline) klip/cue point sürüklemesi artık her `pointermove`'da değil,
  sürükleme bitince TEK SEFER geri al (undo) geçmişine commit ediyor — `useTimelineController.js`.
- Önizlemede audio elemanları artık efekt yeniden çalışmadan/unmount'tan önce durdurulup
  DOM'dan kaldırılıyor (hayalet ses düzeltmesi) — `storyline-preview/index.jsx`.
- `ReviewThreadsModal`'da API hataları artık kullanıcıya banner ile gösteriliyor, sessizce
  yutulmuyor — `ReviewThreadsModal.jsx`.

**Kritik yeni bulgu (ayrı, acil teknik borç):** `src/generated/` paketi kaynak dosyalardan
**sapmış** — üretilen `storylineRuntimeCore.js` içinde zaman çizelgesi kodu
(`runtimeStartTimeline`/`runtimeStopTimeline`) var ama bu artık hiçbir kaynak dosyada
(`src/utils/storylineRuntime.js`) tanımlı değil. `node scripts/extract-runtime-inline.mjs`
yeniden çalıştırılırsa bu fonksiyonlar paketten düşer ve gerçek SCORM paketlerinde
`ReferenceError: runtimeStopTimeline is not defined` regresyonuna yol açar. Kaynağı
(muhtemelen `src/generated/` bir noktada elle düzenlenmiş veya kaynaktaki bir yeniden
adlandırma script'e yansıtılmamış) araştırılıp giderilene kadar **bu script'i
çalıştırmayın**; mevcut committed `src/generated/*.js` dosyaları şu an doğru/çalışır
durumda, dokunulmadı.

**Yarıda kalmış (değişmedi):**
- Yeni Articulate freeform cevap sistemi (`bce2715`, 8 etkinlik tipi) genel olarak beta
  seviyesinde; `completionMode` artık okunuyor ama sistemin geneli hâlâ olgunlaşma
  aşamasında.
- Toast sistemi (6 dosya, `showToast` prop-drilling) konsolide edilmedi.

**Güvenlik:** B-301, B-310..B-314, B-350, B-351, B-353 düzeltildi ve doğrulandı.
`scormTypedActivityPlayer.js` içindeki 3 zayıf shuffle bilinçli olarak dokunulmadı (SCORM'a
gömülen template-literal script).

**2026-07-21/23: `.env` tabanlı yapılandırma eklendi.** Hem Node hem PHP tarafındaki
sır/veritabanı bilgileri artık `.env` dosyalarından okunuyor (ikisi de `.gitignore`'da):
- `server.mjs` başlarken proje kökündeki `.env`'i (varsa) `process.loadEnvFile` ile otomatik
  yükler; şablon için `.env.example` eklendi.
- `ftp-hosting/api/config.php` artık aynı klasördeki `.env`'i okuyor (satır-satır parser,
  dizinin şekli/placeholder varsayılanları birebir korundu, `index.php`'ye dokunulmadı);
  şablon için `ftp-hosting/api/.env.example` eklendi.
- `scripts/build.bat` / `hazirla-ftp.ps1`: `ftp-hosting/api/.env` YERELDE varsa artık pakete
  DAHİL EDİLİYOR (kullanıcı isteğiyle 2026-07-23'te değiştirildi — amaç: `dist/` sunucuya
  yüklendiğinde `.env` ayrıca elle taşınmasın). `dist/`/`deploy-ftp/` klasörleri git'e
  girmiyor ama artık gerçek sır içerebilir; bu klasörleri e-posta/zip ile paylaşmamak
  gerekir (bkz. `docs/FTP-KURULUM.md` § 3 uyarısı).
- **2026-07-23 (kritik canlı üretim hatası bulundu/düzeltildi):** `api/config.php` de
  ARTIK pakete dahil ediliyor (eskiden hariç tutuluyordu — o tasarım, config.php'nin
  içine dogrudan şifre yazıldığı eski modelden kalmaydı, `.env` geçişinden sonra geçersiz
  kalmıştı). Kullanıcının canlı sitesinde (`editori.hepsibirdijital.com`) tam olarak bu
  yüzden `api/config.php` sunucudan tamamen kaybolmuş, her API isteği
  `Fatal error: Failed opening required '.../api/config.php'` ile çöküyordu — canlı `curl`
  ile doğrudan doğrulandı. Muhtemel neden: FTP istemcisinin "senkronize et/yansıt" modu,
  yerel pakette hiç bulunmayan `config.php`'yi sunucudan silmiş. Ayrıca aynı oturumda
  `ftp-hosting/api/index.php`'nin `ensure_workspace()` fonksiyonunda gerçek bir bug bulundu
  ve düzeltildi: `$currentProjectId = null` başlatılıp hemen altında `!== ''` ile
  kıyaslanıyordu (PHP'de `null !== ''` `true`'dur) — `app_state` tablosu boşken
  `project_exists($pdo, null)` çağrılıp `strict_types=1` altında TypeError/500 veriyordu.
  Yerel XAMPP MySQL+PHP kurulumuyla birebir tekrarlatılıp doğrulandı (bkz. Git geçmişi).
- Canlı URL `https://editori.hepsibirdijital.com` her iki `.env.example`'da
  `ALLOWED_ORIGINS`/`EICERIK_ALLOWED_ORIGINS` örneği olarak işlendi; `docs/GUVENLIK-AYARLARI.md`
  ve `docs/FTP-KURULUM.md` güncellendi. 368/368 test ve `npm run build` yeşil kaldı.
- **2026-07-24: PHP tarafında kullanıcı girişleri artık veritabanında (`editor_users`
  tablosu, bcrypt).** Yeni `ensure_editor_users_schema()` (`ftp-hosting/api/index.php`),
  mevcut `ensure_workspace_schema_if_required()` otomatik-kontrol mekanizmasına eklendi —
  site ilk açıldığında (`GET /health?requireDatabase=1`, frontend zaten otomatik çağırıyor,
  `src/index.jsx:113`) tüm 6 tablo (5 eski + `editor_users`) elle işlem gerekmeden
  oluşuyor/tohumlanıyor. `editor_users` boşsa (ör. satırlar kazayla silinirse) bir sonraki
  health-check'te otomatik yeniden tohumlanıyor (idempotent, doğrulandı). `/auth/login`
  artık `$config['users']` dizisini değil doğrudan bu tabloyu okuyor. Tohumlama YALNIZ
  tablo boşken çalışır — `.env`'deki `USER1_PASSWORD`/`USER2_PASSWORD` yalnızca ilk kurulum
  değeri; sonradan değiştirmek DB'yi güncellemez (bkz. `docs/GUVENLIK-AYARLARI.md` şifre
  değiştirme SQL'i). `mysql-schema.sql`'e referans amaçlı `editor_users` tablo tanımı
  eklendi (seed verisi içermiyor, PHP `password_hash()` gerektirdiği için SQL'de üretilemez).
  Yerel XAMPP MySQL+PHP ile tamamen boş DB'den başlayarak uçtan uca doğrulandı (otomatik
  şema kurulumu, doğru/yanlış şifre, idempotency, kaza-sonrası yeniden tohumlama).

Detaylı bulgu listesi için docs/PROJE-DURUM-RAPORU.md'ye bakın (bazı maddeler yukarıdaki
2026-07-21 düzeltmeleriyle güncelliğini yitirdi, rapor dosyası henüz güncellenmedi).
