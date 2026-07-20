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
3. [SISTEM-REHBERI.md](SISTEM-REHBERI.md) — mimari, çalışma ortamları, komutlar, bilinen
   riskler için tek giriş noktası.

Kod mimarisi, dosya yapısı ve komutlar için tekrar üretmek yerine SISTEM-REHBERI.md'ye
bakılmalı; burada yalnız güncel durum özeti tutulur.

## Güncel Durum (son doğrulama: 2026-07-20)

Ayrıntılı kanıtlı rapor: **[docs/PROJE-DURUM-RAPORU.md](docs/PROJE-DURUM-RAPORU.md)**
(çalışan/yarıda kalmış/çalışmayan özellikler + kritik noktalar + mimari temizlik özeti,
dosya:satır referanslı). Denetim geçmişi ve bulgu takibi: [docs/inceleme/](docs/inceleme/)
(99-BIRLESIK-RAPOR.md konsolide sonuç).

**Sağlık:** 349/349 test yeşil (42 dosya), lint temiz, `npm run build` başarılı.
`CI=true npm run build` ESLint uyarılarını hataya çevirdiği için **başarısız** oluyor
(bkz. rapor § 4.6) — CI'ya bağlanmadan önce düzeltilmeli.

**Aynı gün yapılan mimari temizlik** (rapor § 9): ölü/yetim kod ve 11 tehlikeli tek-seferlik
script silindi; `server.mjs` sır temizleme + token doğrulama açıkları ve PHP upload boyut
sınırı kapatıldı; `PreviewExtraFlows.jsx` (2225→17 satır), `PdfCleanStudio.jsx`
(5824→4944), `EIcerikEditor.jsx` (5001→4286) modüllere bölündü; ID üretimi ve zayıf shuffle
tek yardımcıya konsolide edildi. Renk paleti (9 modal) ve toast sistemi (6 dosya)
konsolidasyonu bilinçli olarak ertelendi (gerekçe raporda).

**Çalışmayan / kırık (öncelik sırasıyla, bu temizlik kapsamı dışında — davranış değişikliği,
ayrı onay gerekiyor):**
- `shortcut-key` etkinlik tipi SCORM'da hiçbir zaman "tamamlandı" işaretlenmiyor →
  bu tipi içeren paket öğrenci tarafında asla tamamlanamıyor.
  `src/utils/scormTypedActivityPlayer.js:334-338`, `src/utils/storylineRuntimeEngine.js:1485-1501`.
- `duplicateActivity` kopyalanan etkinlikte trigger/nesne çapraz referanslarını remap
  etmiyor → sessiz veri bozulması. `LibraryWorkspace.jsx:531-540`.
- Karma etkinlikte tip değişimi cevap alanlarını siliyor, geri ekleme arayüzü yok.
  `KarmaCevapPanel.jsx:74-79`.
- "URL Aç" tetikleyicisinde URL girme alanı arayüzden hiç kurulamıyor.
  `FormatRightPanel.jsx:318-363`.
- Bul-Değiştir çok-sahneli etkinliklerde `slides[].objects`'i atlıyor.
  `useRibbonController.js:1412-1434`.

**Yarıda kalmış:**
- Açık tema/token yenilemesi (`d794dca`) yalnız `src/components/ui/` çekirdeğinde tam;
  9 modal (Character/Icon/Symbol/Table/Chart/SlideMaster/Variables/Branching
  Picker/Editor) hâlâ hardcoded hex renk kullanıyor, token'a bağlı değil (konsolidasyon
  denendi, gerekçeli olarak ertelendi — rapor § 9).
- Yeni Articulate freeform cevap sistemi (`bce2715`, 8 yeni etkinlik tipi) genel olarak
  beta seviyesinde çalışıyor; `completionMode` (opsiyonel/zorunlu) ayarı typed SCORM
  player'da okunmuyor.

**Güvenlik:** B-301 (PHP yetkilendirme atlama), B-310..B-314 (SCORM dış-link sızıntısı),
B-350 (server.mjs sır temizleme), B-351 (token doğrulama atlatma), B-353 (PHP upload boyut
sınırı) düzeltildi ve doğrulandı. `scormTypedActivityPlayer.js` içindeki 3 zayıf shuffle
bilinçli olarak dokunulmadı (SCORM'a gömülen template-literal script, ayrı ele alınmalı).

Detaylı öncelik sırası ve tam bulgu listesi için docs/PROJE-DURUM-RAPORU.md § 7 ve § 9'a bakın.
