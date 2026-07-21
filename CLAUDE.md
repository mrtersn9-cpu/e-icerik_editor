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
  (mevcut `hazirla-ftp.ps1`'i sarmalıyor).

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

Detaylı bulgu listesi için docs/PROJE-DURUM-RAPORU.md'ye bakın (bazı maddeler yukarıdaki
2026-07-21 düzeltmeleriyle güncelliğini yitirdi, rapor dosyası henüz güncellenmedi).
