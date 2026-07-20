# Proje Durum Raporu — 2026-07-20

Bu rapor, projenin güncel durumunu (çalışan / yarıda kalmış / çalışmayan özellikler ve
kritik noktalar) tek bir yerde özetler. İki kaynağa dayanır:

1. **[docs/inceleme/99-BIRLESIK-RAPOR.md](inceleme/99-BIRLESIK-RAPOR.md)** — 2026-06-16 tarihli,
   ~55 alt-ajanla yapılan satır satır kod denetiminin birleşik sonucu (304 dosya + `server.mjs` +
   `scripts/` + `public/` + PHP backend). Kritik/Yüksek bulguların çoğu o turda düzeltildi.
2. **Bu oturumda yapılan tazeleme** — 2026-06-16'dan bugüne giren 18 commit / 104 dosya / ~6.650
   satırlık değişiklik (özellikle *Articulate freeform cevap sistemi + 8 yeni etkinlik türü* ve
   *açık tema/token tabanlı arayüz yenilemesi*) hiç denetlenmemişti; bu rapor için üç paralel
   araştırma yapıldı, hâlâ açık olduğu bilinen ~17 bulgu güncel koddan tek tek yeniden doğrulandı
   ve lint/test/build/audit taze çalıştırıldı. Kod değişikliği yapılmadı, yalnızca inceleme.

Ayrıntılı kanıt ve dosya:satır referansları için `docs/inceleme/` altındaki bölge raporlarına
(01–10) bakılabilir. Bu belge onların üstüne, kullanıcı sorusuna doğrudan cevap veren bir özet
katmanıdır.

---

## 1. Genel Görünüm

Proje, React + Zustand tabanlı, kitap/sahne/katman/nesne/tetikleyici/soru modeliyle çalışan
olgun bir e-içerik editörü. Öğrenci önizlemesi ve SCORM 1.2 çıktısı ortak runtime mantığını
paylaşıyor (`src/utils/storylineRuntime*.js`, `src/utils/scormTypedActivityPlayer.js`). 42 test
dosyasında 349 test yeşil, lint temiz (2 kozmetik uyarı hariç), production build başarılı.
Temel mimari **sağlam ve çoğunlukla çalışır durumda**; asıl risk iki yeni ve hiç denetlenmemiş
alanda (yeni cevap sistemi, tema yenilemesi) ve daha önceden bilinen, henüz düzeltilmemiş ~17
orta/yüksek önem bulguda yoğunlaşıyor.

---

## 2. Çalışan Özellikler

- **Temel editör akışı**: kitap → sahne → katman → nesne → tetikleyici → cevap modeli; undo/redo,
  timeline, sürükle-bırak, gruplama. 2026-06 denetiminde canlı test edildi, 0 konsol hatası.
- **PDF içe aktarma**: editör içi PDF Temiz Stüdyo (`src/PdfCleanStudio.jsx`) ve komut satırı
  ayrıştırıcı (`npm run pdf:storyboard`) — ikisi de çalışır durumda.
- **Okunabilir URL / slug yönlendirme**: `#/publisher/<slug~id>/book/<slug~id>/...`, eski id'li
  linklerle geriye uyumlu. Canlı doğrulandı.
- **SCORM 1.2 dışa aktarım (temel akış)**: `src/utils/scormExport.js` tarayıcı tarafında ZIP
  üretiyor; formül motoru (`parseAndEvaluate`) artık bundle'a gömülü, wordsearch/maze/memory
  tamamlanma SCORM'a yansıyor (Haziran turunda düzeltildi).
- **Klasik etkinlik türleri**: çoktan seçmeli, doğru-yanlış, boşluk doldurma, bulmaca, eşleştirme,
  sürükle-bırak, karma etkinlik — editör → önizleme → SCORM üçlüsü genel olarak tutarlı.
- **Yeni cevap sisteminden çalışan 6/8 tip**: `line-match`, `dropdown-match`, `slider/kadran`,
  `word-bank`, `flashcard`, `labeled-image`, `content-tabs` editör paneli + önizleme + SCORM
  render/değerlendirme üçlüsünde bağlı ve işlevsel (flashcard/labeled-image bilinçli olarak
  puansız tasarlanmış).
- **PHP/FTP üretim API'sinde oturum doğrulaması**: Haziran'daki Kritik bulgu (B-301, aşağıya
  bakınız — yetkilendirmesiz API) gerçek XAMPP/MySQL ortamında test edilerek kapatıldı;
  `/upload` da artık aynı oturum geçidinden geçiyor ve gerçek MIME doğrulaması yapıyor.
- **UI token altyapısı (kısmi ama sağlam temel)**: `src/components/ui/` altındaki asıl
  tasarım-sistemi bileşenleri (Button, Input, Modal, Select, Panel, Toolbar, Toast, Tooltip,
  Skeleton, EmptyState) yeni `--eic-*` CSS token sistemine tam geçmiş.
- **Test/derleme altyapısı**: 349 test / 42 dosya yeşil, `npm run lint` temiz, `npm run build`
  (CI bayrağı olmadan) başarılı.

---

## 3. Yarıda Kalmış / Kısmi Özellikler

### 3.1 Açık tema / token tabanlı arayüz yenilemesi (commit `d794dca`) — **kısmen tamamlanmış**

Gerçek bir tema anahtarlama mekanizması (ThemeProvider, `data-theme`, sistem teması algılama)
yok; tek yönlü bir "açık görünüme geçiş". Commit mesajı 10 modalin token'a taşındığını söylüyor
ama gerçekte:

- `CharacterPickerModal.jsx`, `IconPickerModal.jsx`, `SymbolPickerModal.jsx`,
  `ContentLibraryModal.jsx`, `TableEditorModal.jsx`, `ChartEditorModal.jsx`,
  `SlideMasterModal.jsx`, `VariablesManagerModal.jsx`, `BranchingDiagramModal.jsx` → `var(--eic-*)`
  kullanımı **sıfır**; bunun yerine 10–43 arası hardcoded hex renk (`#2563eb`, `#e2e8f0`, ...)
  inline `style={{}}` içinde tekrar tekrar yazılmış. Görsel olarak yeni paletle aynı ama token
  sistemine bağlı değil — merkezi bir renk değişikliği bu dosyalarda elle tek tek yapılmalı.
- `GlossaryEditorModal.jsx`, `FindReplaceModal.jsx` sadece 1 yerde token kullanıyor.
- `AdminManagementModal.jsx`, `AdminUserPanel.jsx`, `ReviewThreadsModal.jsx`,
  `ProjectVersionManagerModal.jsx`, ribbon sekmeleri, `SlideStrip.jsx`, `cevap/` panelleri bu
  yenilemeye hiç dahil edilmemiş — hâlâ tamamen eski hardcoded renklerle çalışıyor.
- `src/components/ui/Panel/Panel.jsx` yeni koyu shell tokenlarını kullanıyor ama kod tabanında
  hiçbir yerden import edilmiyor (kullanılmayan dosya).
- Öğrenciye görünen tarafı (önizleme/SCORM) **etkilemiyor** — değişiklik yalnızca `src/index.jsx`
  üzerinden yüklenen editör arayüzüyle sınırlı, TTKB kapsamı dışında.

### 3.2 Articulate freeform cevap sistemi (commit `bce2715`) — **beta, üretim-kırıcı 1 hata içeriyor**

Bkz. bölüm 4.1 (`shortcut-key` tamamlanma hatası). Ayrıca:

- `completionMode` (`required`/`optional`, `activityConstants.js:77`) ayarı typed SCORM player
  tarafında hiçbir yerde okunmuyor; tüm yeni tipler tamamlanma kontrolünde zorunlu sayılıyor.
- Commit mesajı "7 yeni etkinlik türü" diyor ama gerçekte 8 yeni id eklenmiş
  (`line-match, dropdown-match, slider, shortcut-key, word-bank, flashcard, labeled-image,
  content-tabs`) — küçük bir dokümantasyon tutarsızlığı, işlevsel etkisi yok.
- `flashcard`/`labeled-image` bilinçli olarak "puansız" tasarlanmış ama bu durum kullanıcıya
  (editördeki öğretmen/içerik üreticisine) hiçbir yerde açıkça belirtilmiyor.

### 3.3 Denetim raporundaki bilinçli ertelenen işler (değişmedi)

- Türkçe i/ı tam linguistik ayrımı (`kıl`≠`kil`) — şu an `typedFold` ile pratik sorun (İ/I
  reddi) giderilmiş ama tam ayrım saklama migrasyonu gerektiriyor, ertelendi.
- `buttonStyling.isFullDim` sabit 1000×600 varsayıyor — özel küçük sahnelerde oransal değil.
- B-312 (yüklenen widget dış-kaynak taraması) yalnızca uyarı seviyesinde; binary içerik taraması
  hâlâ açık.

---

## 4. Çalışmayan / Kırık Özellikler

### 4.1 `shortcut-key` etkinliği SCORM'da asla "tamamlandı" sayılmıyor — **üretim kırıcı**

`src/utils/scormTypedActivityPlayer.js:334-338` (`typedEvaluate`) `shortcut-key` dalında,
diğer tüm yeni tiplerin (`slider`, `flashcard`, `labeled-image`, `content-tabs`) aksine
`completed` alanını hiç set etmiyor. `typedScore()` (satır 230-232) bunu okuyarak
`state.activityScores[id].completed` değerini kalıcı olarak `false` bırakıyor.
`typedEveryCompleted()` (satır 241-245) paket içindeki **tüm** typed slaytların `completed=true`
olmasını şart koştuğu için, paket içinde tek bir `shortcut-key` etkinliği bile varsa
`checkCourseCompletion()` hiçbir zaman "kurs tamamlandı" yoluna girmiyor — **SCORM kursu bu
etkinlik türü paket içinde olduğu sürece hiç tamamlanamıyor.** Aynı hata paylaşılan
`src/utils/storylineRuntimeEngine.js:1485-1501` (`evaluateStorylineRuntimeShortcut`) içinde de
var. Ayrı bir tutarsızlık: sonuç nesnesi `type:"shortcut"` dönüyor, sistemin her yerinde tip adı
`"shortcut-key"`. Mevcut test (`scormTypedActivityPlayer.test.js:277-300`) yalnız "✓ Doğru"
görsel geri bildirimini kontrol ediyor, tamamlanma/`cmi.core.lesson_status`'u hiç doğrulamıyor —
bu yüzden hata test paketinde yakalanmamış.

### 4.2 Kopyalanan etkinlikte çapraz referanslar bozuk kalıyor (B-330, hâlâ açık)

`LibraryWorkspace.jsx:531-540` (`duplicateActivity`) slide/object/trigger'lara yeni id veriyor
ama nesnelerin **iç** id'lerini ve trigger'ların `target/value/stateKey` alanlarını eski id'lere
göre güncellemiyor (remap yok). Sonuç: kopyalanan her etkinlik, orijinaldeki tetikleyici/hedef
bağlarını kaybediyor — sessiz veri bozulması.

### 4.3 Karma etkinlikte tip değişimi cevapsız çıkmaza sokuyor (B-336, hâlâ açık)

`KarmaCevapPanel.jsx:74-79` — bir öğenin tipi değiştirildiğinde `options/pairs/acceptedAnswers`
gibi alanlar siliniyor ve öğe `{id, type, question}`'a indiriliyor; render blokları (107-189)
bu alanları yeniden eklemek için hiçbir arayüz sunmuyor. Kullanıcı geri dönüp cevap tanımlayamıyor.

### 4.4 "URL Aç" tetikleyicisinde URL alanı hiç yok (B-339, hâlâ açık)

`FormatRightPanel.jsx` `targetOptions` (satır 318-363) `URLAc` eylemi için hiçbir dal içermiyor,
her zaman `[]` döndürüyor; "Hedef" alanı bu yüzden hiç render edilmiyor (satır 602/901) ve
dosyada URL girmek için `type="url"` bir alan yok. Bu tetikleyici arayüzden **kurulamıyor**.

### 4.5 Bul-Değiştir sahne içi nesneleri atlıyor (B-341, hâlâ açık)

`useRibbonController.js` `countObjectText`/`replaceObjectText` (1412-1434) yalnız
`activity.objects`'i tarıyor, `activity.slides[].objects`'e hiç bakmıyor — çok-sahneli
etkinliklerde arama/değiştirme sessizce "0 eşleşme" veriyor.

### 4.6 CI modunda production build başarısız oluyor — **yeni, bu oturumda tespit edildi**

`CI=true npm run build` (bazı CI/CD ortamlarının `CI` değişkenini otomatik set etmesiyle
tetiklenebilir) ESLint uyarılarını hataya çeviriyor ve derleme **başarısız** oluyor:
`CharacterPickerModal.jsx:4`, `IconPickerModal.jsx:5`, `SymbolPickerModal.jsx:4`
(`import/order` — tema yenilemesi commit'inden yeni dosyalar) + `ui/Button`, `ui/Input`,
`ui/Modal`, `ui/Select` (`valid-jsdoc`, önceden var, kozmetik). `CI` değişkeni olmadan
(`npm run build`, mevcut `hazirla-ftp.ps1` akışının kullandığı yol) derleme **başarıyla**
tamamlanıyor — bugünkü üretim yayınına engel değil, ama bir CI/CD hattına bağlanırsa ilk
denemede kırılır.

### 4.7 Diğer bilinen açık hatalar (Haziran denetiminden, değişmedi — dosya:satır güncel kodda doğrulandı)

| Bulgu | Konu | Dosya:Satır |
|---|---|---|
| B-337/B-348 | Timeline sürüklemesi her `pointermove`'da commit ediyor, tek `dragRef` 4 farklı sürükleyici arasında paylaşılıyor → undo geçmişi kirleniyor | `useTimelineController.js:263-292, 299, 346, 481, 501` |
| B-342 | Store'daki toast altyapısı (`toasts/addToast/removeToast`) hiç kullanılmıyor, 6 dosyada paralel ikinci bir bildirim sistemi var | `useEditorStore.js:118-126` |
| B-343 | Önizlemede audio elementleri cleanup'ta durdurulmuyor (hayalet ses çalmaya devam edebilir) | `storyline-preview/index.jsx:2306-2320, 2399-2401` |
| B-346 | Hata sessizce yutuluyor, kullanıcıya hiç gösterilmiyor | `ReviewThreadsModal.jsx:21-32` |

---

## 5. Kritik Noktalar

### 5.1 Güvenlik — yerel Node API (`server.mjs`)

- **B-350 (açık)**: `createProject/saveProjectDraft/createProjectVersion`
  (`server.mjs:1171-1225`) durumu doğrudan `JSON.stringify` ile yazıyor,
  `scrubEditorPayloadSecrets` çağırmıyor. Yalnız uygulama açılışında bir kerelik
  `scrubStoredSecrets()` (satır 156) çalışıyor — sonraki her kayıtta LMS/xAPI/LTI sırları
  temizlenmeden veritabanına yazılıyor.
- **B-351 (açık)**: `resolveRequestSession` (`server.mjs:392-404`) Bearer token yoksa ham
  `X-User-Id`/`X-Session-Id` başlıklarına düşüyor (`tokenValid:false` ile işaretleniyor ama
  handler'lar yalnız `tokenInvalid`'i kontrol ediyor) → imzalı token doğrulaması pratikte
  atlanabilir.

### 5.2 Güvenlik — FTP/PHP üretim API'si

- **B-301 (KRİTİK, düzeltildi + gerçek ortamda doğrulandı)**: `/admin/backup` dışındaki tüm
  uçlarda yetkilendirme eksikliği vardı; artık `require_active_session()` global geçidiyle
  kapatıldı (XAMPP PHP 8.2 + MySQL'de 4 senaryoyla test edildi).
- **B-353 (kısmen düzeltildi)**: `/upload` artık oturum + gerçek MIME doğrulaması yapıyor, ama
  hâlâ **dosya boyutu sınırı kontrolü yok** (yalnız PHP ini varsayılanına güveniliyor).
- Üretim ortamı paylaşımlı FTP hosting üzerinde PHP/MySQL; Node.js/SQLite ile PHP/MySQL güvenlik
  davranışları birebir aynı değil — yayın öncesi hedef ortamda ayrı test şart.

### 5.3 SCORM KESİN KURAL (dış bağlantı/TTKB) — büyük ölçüde kapatıldı

Haziran denetiminde bulunan dış-link sızıntı kümesi (B-310..B-314) neredeyse tamamı düzeltildi;
bu oturumda **B-311 de dahil olmak üzere doğrulandı**: `EIcerikEditor.jsx` içindeki
`collectExternalUrls`/`summarizeExternalUrlsForScorm` (satır ~753-786) artık `embedUrl` dahil
tüm state ağacını tarıyor ve her export'ta zorunlu bir onay penceresi tetikliyor. Kalan tek açık
uç: B-312 kapsamında yüklenen widget'ların binary (HTML/JS) içeriğinin export-öncesi otomatik
taranması — şu an yalnızca yükleme sırasında uyarı seviyesinde.

### 5.4 Repo hijyeni

- **B-360 (açık)**: `scripts/cleanup-editor.mjs:258` tanımlı ama kullanılmayan `backupPath`
  değişkeniyle **gerçekte yedek almadan** üzerine yazıyor; `scripts/extract-runtime-inline.mjs:85-92`
  üretilmiş SCORM runtime dosyalarına yedeksiz/onaysız yazıyor. Bu scriptler tek seferlik
  migrasyon amaçlı yazılmış görünüyor; artık `git rm` ile kaldırılmalı ya da en azından
  çalıştırmadan önce onay/yedek adımı eklenmeli.
- `temp_bulmaca/`, `tmp_bulmaca_inceleme/`, `GERI-YUKLEME-ICIN/`, `yedekler/` diskte duruyor ama
  hepsi `.gitignore`'da; commit geçmişine girmemiş (temiz).

### 5.5 Bağımlılık güvenlik açıkları

`npm audit`: **47 açık** (10 düşük, 14 orta, 20 yüksek, 3 kritik) — bir önceki denetimde 41'di.
Hepsi `react-scripts`/`webpack-dev-server` build araçlarına ait (`ws`, `websocket-driver` vb.),
SCORM çıktı paketine girmiyor; geliştirme ortamı riski, üretim/öğrenci riski değil. Zamanla
büyüyen bir liste — `react-scripts` güncellemesi (büyük, kırıcı olabilir) veya `npm audit fix`
periyodik olarak değerlendirilmeli.

---

## 6. Sağlık Metrikleri (2026-07-20, bu oturumda taze koşuldu)

| Kontrol | Sonuç |
|---|---|
| `npm run lint` | 2 hata (`selectionReconcile.test.js` — `jest/no-conditional-expect`, kozmetik), 0 kritik |
| `npm run test` | **349/349 test yeşil**, 42 test dosyası (Haziran'da 307'ydi — yeni testler eklenmiş) |
| `npm run build` (CI olmadan) | Başarılı |
| `CI=true npm run build` | **Başarısız** — bkz. 4.6 |
| `npm audit` | 47 açık (dev-only build araçları) |

---

## 7. Önerilen Öncelik Sırası

1. **4.1 `shortcut-key` tamamlanma hatası** — bu tip içeren her SCORM paketi öğrenci tarafında
   asla "tamamlandı" olmuyor; en yüksek öncelik (üretimde kullanılan bir içerik varsa acil).
2. **5.1 B-350/B-351** — güvenlik; sır sızıntısı ve token atlatma.
3. **4.2 B-330, 4.3 B-336, 4.4 B-339, 4.5 B-341** — sessiz veri kaybı/kullanılamazlık, kullanıcı
   şikayeti üretebilir.
4. **4.6 CI build hatası** — 3 `import/order` satırı tek satırlık düzeltme, CI'ya bağlanmadan
   önce kapatılmalı.
5. **3.1 Tema yenilemesi kapsamının tamamlanması** — ya kalan modaller token'a taşınmalı ya da
   "kısmi tamamlandı" olarak belgelenip iş kalemine dönüştürülmeli.
6. **3.2 `completionMode` typed player'da okunması** — yeni tiplerin "opsiyonel" ayarının
   çalışması için gerekli.
7. **5.4 B-360 tehlikeli scriptler** — düşük risk ama ucuz, `git rm` veya guard eklenebilir.

---

## 8. Kapsam Dışı / Bu Turda Yapılmayanlar

- Gerçek tarayıcıda offline SCORM paket ağ trafiği testi tekrarlanmadı (Haziran'da statik +
  jsdom doğrulandı, canlı ağ izleme hâlâ önceki raporun "eksik kalanlar" listesinde).
- Yeni cevap sisteminin 8 tipinin tamamı için canlı Playwright tıklama testi yapılmadı (statik
  kod + mevcut test paketi okundu).
- ~270 Orta/Düşük önemli kozmetik bulgu tek tek yeniden doğrulanmadı (Haziran raporundaki liste
  geçerliliğini koruyor, `docs/inceleme/99-BIRLESIK-RAPOR.md` içinde).

---

## 9. Mimari Temizlik Oturumu (2026-07-20, aynı gün devamı)

Bu raporun yazılmasından hemen sonra, ayrı bir görev olarak projenin mimarisini sadeleştirmek
için aşamalı bir temizlik yapıldı (isimlendirme/taşıma hariç — kullanıcı talebiyle mevcut dosya
adları ve yolları korundu). Her faz kendi commit'i, test/lint/build doğrulamasıyla kapatıldı.

### Silinen dosyalar (Faz 1 — kanıtlı ölü/yetim kod)
- Kök: `index.jsx`, `AnswerPanel.jsx`, `LayerPanel.jsx`, `RightPanelShell.jsx` (kırık import,
  derlemeye hiç girmiyordu)
- `src/components/editor/SlideTransitionView.jsx`, `src/features/editor-workspace/EditorScenesPanel.jsx`,
  `src/components/activity-editors/DragDropConfigPanel.jsx` — geçmişte monolitten çıkarılıp geri
  bağlanmamış yetim bileşenler (bkz. not aşağıda)
- `src/store/useEditorStore.js` içindeki kullanılmayan `toasts/addToast/removeToast`,
  `src/components/ui/Toast/` (kullanılmayan `ToastProvider`)
- 11 tek seferlik migrasyon script'i (`scripts/extract-button-styling.mjs`,
  `extract-color-utils.mjs`, `extract-common-utils.mjs`, `extract-drag-drop.mjs`,
  `extract-editor-scenes.mjs`, `extract-factories.mjs`, `extract-normalize.mjs`,
  `extract-scene-templates.mjs`, `extract-slide-transition.mjs`, `extract-timeline.mjs`,
  `cleanup-editor.mjs`, `restore-editor-scenes.mjs`) — hiçbiri `package.json`'da veya aktif
  dokümantasyonda referanslı değildi; `src/EIcerikEditor.jsx`'i yedeksiz üzerine yazıyorlardı.

> **Not (olası kaybolmuş özellik):** Silinen 3 yetim bileşen (`SlideTransitionView`,
> `EditorScenesPanel`, `DragDropConfigPanel`) geçmişte `EIcerikEditor.jsx`'ten "çıkarılmış" ama
> hiçbir zaman geri bağlanmamıştı — yani zaten çalışmıyorlardı, silinmeleri mevcut davranışı
> bozmadı. Ama bu, o üç özelliğin (sahne geçiş ayarları paneli, editör sahne paneli, sürükle-bırak
> yapılandırma paneli) kullanıcıya bir süredir hiç sunulmadığı anlamına gelebilir. Bu özellikler
> hâlâ isteniyorsa, yeniden bağlama ayrı bir (davranış ekleyen) görev olarak ele alınmalı.

### Güvenlik düzeltmeleri (Faz 2)
- `server.mjs`: her proje kaydında LMS/xAPI/LTI sırları artık temizleniyor (önceden yalnız
  açılışta bir kerelik).
- `server.mjs`: imzalı bearer token yoksa istek artık reddediliyor (önceden ham
  X-User-Id/X-Session-Id başlıklarına düşüyordu).
- `ftp-hosting/api/index.php`: `/upload` artık 25 MB boyut sınırı uyguluyor.
- `scripts/extract-runtime-inline.mjs` (hâlâ gerekli, `src/generated/` üretiyor) artık üzerine
  yazmadan önce `.bak` yedeği alıyor.

### Büyük dosya bölme (Faz 3 — davranış değişmedi, yalnız organizasyon)
| Dosya | Önce | Sonra | Yeni modüller |
|---|---|---|---|
| `src/components/preview/PreviewExtraFlows.jsx` | 2225 satır | 17 satır (barrel) | `src/components/preview/flows/` (17 akış dosyası + `shared.jsx`) |
| `src/PdfCleanStudio.jsx` | 5824 satır | 4944 satır | `src/logic/pdfClean/` (geometry, canvasRendering, zipExport, pdfTextExtraction, patchCloning), `src/constants/pdfCleanConstants.js` |
| `src/EIcerikEditor.jsx` | 5001 satır | 4286 satır | `src/logic/editorState/` (stateNormalize, dragLayout), `src/components/StorylineScormPlayerPreview.jsx` |

`src/generated/` (SCORM'a gömülen üretilmiş runtime dosyaları) ve onun kaynakları
(`storylineRuntimeEngine.js`, `storylineRuntime.js`, `storylineRenderer.js`) bilinçli olarak bu
turda **düzenlenmedi** — riski yüksek, ayrı bir oturum gerektiriyor.

### Tekrar temizliği (Faz 4 — kısmi)
- **Tamamlandı:** ID üretimi (8 farklı tutarsız format → tek `src/utils/id.js`), zayıf shuffle
  (4 yer `puzzleGenerators.js`'te → mevcut `shuffleArray`).
- **Bilinçli ertelendi — Renk paleti (9 modal, 167 hardcoded hex):** İlk incelemede "mekanik,
  düşük risk" varsayılmıştı; gerçekte çoğu hex değeri (`border: '1px solid #e2e8f0'` gibi) daha
  büyük string'lerin içine gömülü, bağımsız değil. Güvenli konsolidasyon her `border`/`boxShadow`
  string'ini template literal'e çevirmeyi gerektiriyor — 100'den fazla nokta, satır satır bağlam
  okuması şart. Ayrıca renklerin çoğu (örn. `BranchingDiagramModal`'daki diyagram renk kodlaması)
  dosyalar arası tekrar değil, o bileşene özgü kasıtlı seçimler — gerçek tekrar yalnızca ortak
  slate/blue paletindeki ~11 değer (`#fff`, `#e2e8f0`, `#334155`, `#2563eb`, `#1d4ed8`, `#eff6ff`,
  `#93c5fd`, `#94a3b8`, `#64748b`, `#cbd5e1`, `#475569`). Ayrı, dikkatli bir oturum öneriliyor.
- **Bilinçli ertelendi — Toast sistemi (6 dosya):** `EIcerikEditor.jsx`'teki `showToast`'ın
  6 dosyaya prop olarak taşınmasının tek `useToast()` hook'una toplanması; davranışsal
  yeniden-kablolama gerektirdiğinden (yalnız kod taşıma değil) en kapsamlı regresyon testini
  istiyor — ayrı oturuma bırakıldı.
- **Bilinçli kapsam dışı:** `src/utils/scormTypedActivityPlayer.js` içindeki 3 zayıf shuffle —
  bu dosya normal ES modülü değil, SCORM paketine gömülen tek bir template-literal script; oradan
  modül import etmek çalışmaz.

### Doğrulama
Her faz sonunda `npm run lint`, `npm test` (349/349, değişmedi), `npm run build` (CI'sız) çalıştırıldı;
hepsi yeşil. Toplam 7 commit, ayrı ayrı geri alınabilir.

### Önerilen sonraki adımlar
1. Renk paleti konsolidasyonu — dikkatli, satır satır (yukarıda gerekçelendirildi).
2. Toast sistemi birleştirmesi — davranış testiyle birlikte.
3. `StageCanvas.jsx`, `storyline-preview/index.jsx`, `storylineRuntimeEngine.js`'in daha derin
   bölünmesi — SCORM runtime'a bağlı, adanmış bir oturum gerektiriyor.
4. `buildAutoDragMatches`/`evaluateDragDropPlacements` (`src/logic/editorState/dragLayout.js`)
   üzerindeki eski `eslint-disable no-unused-vars` yorumları — muhtemelen artık gerçekten ölü kod,
   doğrulanıp silinebilir.
