# 02 — UI Bileşenleri İncelemesi

Kapsam: `src/components/`, `src/widgets/` + kökteki `AnswerPanel.jsx`, `LayerPanel.jsx`,
`RightPanelShell.jsx`, `index.jsx`

**Tur 2 (Derin çok-ajanlı inceleme, 2026-06-15):** 83 dosya parçalara bölünüp incelendi.
21 parçadan 18'i tamamlandı; 3'ü (önizleme akışları, ribbon sekmeleri, widget'lar) soket
hatasıyla düştü — **Bekleyenler** bölümünde, WF-B'de tamamlanacak.

## Özet

| Önem | Adet |
|---|---|
| Kritik | 0 (ancak B1-K1 / B-101 bu bölgedeki `PreviewComponents.jsx:44`'ü de kapsıyor) |
| Yüksek | 7 |
| Orta | ~22 |
| Düşük | ~49 |

---

## YÜKSEK

### B2-Y1 — `sanitizeSvgMarkup` dış kaynak (http/https/url()) referanslarını SCORM'a sızdırıyor (DOĞRULANDI — KESİN KURAL)
- `src/components/preview/PreviewComponents.jsx:261` (+ 1039, 2013, 2089, 2553, 3368);
  kök neden `src/utils/editorHelpers.js:119-125`
- Kanıt: Statik analiz + **manuel doğrulama** (`isUnsafeUri` yalnız `javascript:`/`vbscript:`/
  `data:text/html`'i engelliyor; `http://`, `https://`, `data:image/` ve CSS `url(https://...)`
  AÇIKÇA güvenli sayılıyor).
- Sorun: Kullanıcının yüklediği SVG içinde `<image xlink:href="https://...">` veya
  `<style>url(https://...)</style>` varsa, sanitizasyondan **geçer** ve önizleme + dışa
  aktarılan HTML + SCORM paketine girer. `scormMediaInline` yalnız bilinen URL alanlarını
  (imageData/mediaUrl/embedUrl) gömdüğü için SVG-içi referanslar hem inline'lanmıyor hem de
  export uyarısını atlayabiliyor. Öğrenci paketi çevrimdışı açtığında o dış kaynağa istek
  atılır → **KESİN KURAL (SCORM dış link yasağı) ihlali** + çevrimdışı kırık görsel.
- Önerilen düzeltme: SCORM hedefli sanitizasyonda SVG içindeki `http(s)`/protokolsüz `//` ve
  `url(uzak)` referanslarını tamamen kaldır veya base64'e göm. Kullanıcı bilinçli eklediyse
  manuel-link politikası gereği export uyarısı tetiklenmeli.

### B2-Y2 — Runtime audio elemanları effect temizliğinde durdurulmuyor (hayalet ses)
- `src/components/storyline-preview/index.jsx:2284` — `StorylinePreviewSharedRuntimeStage`
  her görünür ses için `createElement('audio')` + `play()` yapıyor; cleanup (2388-2390) yalnız
  listener'ları kaldırıyor, audio'yu `pause()`/`remove()` etmiyor. Geniş bağımlılık dizisi sık
  yeniden koşturuyor → üst üste binen/durmayan sesler. **Fix:** oluşturulan her audio'yu
  diziye topla, cleanup'ta pause+remove; `play()`'i yalnız gerçek autoPlay'e sınırla.

### B2-Y3 — Bulmacada soru düzenlendikten sonra bayat `puzzlePlaced` ile önizleme/SCORM
- `src/components/activity-editors/PuzzleEditor.jsx:43` — `addQuestion/updateQuestion/
  removeQuestion` yalnız `puzzleQuestions`'ı günceller, `puzzlePlaced`'a dokunmaz. Önizleme/
  SCORM ızgarayı/doğru cevabı `puzzlePlaced`'tan okur → yeniden derlenmezse ızgarada eski
  harf/cevap, soru listesinde yeni metin. TTKB: cevaplanamayan/tutarsız soru. **Fix:** bayatlık
  tespiti + uyarı veya export bloğu.

### B2-Y4 — `MixedActivityEditor` `getCorrectDragMatches` prop'u olmadan çağırıyor (çökme)
- `src/components/activity-editors/MixedActivityEditor.jsx:9` — Fonksiyonu import etmiyor,
  prop bekliyor; `AnswerPanel.jsx` bu prop'u geçmiyor → render anında "is not a function".
  Şu an `QuestionRightPanel` mixed için bu bileşeni render etmediğinden maskeleniyor. **Fix:**
  `activityHelpers`'tan import et (DragDropConfigPanel deseni) veya `typeof` koruması.

### B2-Y5 — `ReviewThreadsModal` handleResolve/handleDelete'te yutulmuş hata
- `src/components/ReviewThreadsModal.jsx:57` — `apiRequest` çağrıları try/catch'siz; ağ/lock/
  HTTP hatasında `loadThreads`'e ulaşılmaz, UI eski durumda kalır + unhandled rejection.
  Kullanıcı başarısızlığı görmez. **Fix:** try/catch + kullanıcıya hata mesajı.

### B2-Y6 — `BranchingDiagramModal` trigger hedefini yanlış alandan okuyor
- `src/components/BranchingDiagramModal.jsx:26` — `trigger.targetActivityId` şemada yok; hedef
  `trigger.value`'da. SayfaGec/SliderGec okları **hiçbir zaman** çizilmiyor; kullanıcı dallanma
  akışını eksik görür. **Fix:** `trigger.value` kullan, `__next__/__prev__` göreli değerleri ele.

### B2-Y7 — Bul-Değiştir slayt nesnelerini taramıyor (sessiz başarısızlık)
- `src/components/ribbon/useRibbonController.js:1376` — `countObjectText`/`replaceObjectText`
  yalnız `activity.objects`'i tarıyor, `activity.slides[].objects`'i atlıyor (çeviri-import
  akışı ikisini de tarıyor). Slayttaki metin "0 eşleşme" der, kullanıcı değişiklik yaptığını
  sanıp eksik SCORM üretebilir. **Fix:** ortak gezici ile slayt nesnelerini de tara.

---

## ORTA (özet liste)

- `PreviewComponents.jsx:1756` — `runSelectionCheck`/evaluateMatches setTimeout'ları temizlenmiyor;
  unmount sonrası state yazımı + slayt geçişinde yanlış faza atlatma yarışı.
- `PreviewComponents.jsx:1142` — `currentActivity.name` erişimi null guard'ından (1186) önce.
- `PreviewComponents.jsx:1950` (+3065) — onLoad trigger useEffect'i `runtimeVariables`
  bağımlılığıyla sonsuz render/effect döngüsü riski.
- `storyline-preview/index.jsx:3069` — "Yeniden başlat" ilk slaytı atlıyor (`startSlides[1]`),
  goHomePreview (`[0]`) ile tutarsız; SCORM paritesi/akış bozulması.
- `storyline-preview/index.jsx:3587` — `handleWidgetEvent` setTimeout'u temizlenmiyor; bayat
  closure ile state güncelleme.
- `useRibbonController.js:838` — RibbonNumberInput sınır dışı değeri her tuşta emit ediyor
  (clamp yalnız blur'da); punto/süre anlık geçersiz değer kalıcılaşabilir.
- `editor/SlideTransitionView.jsx:56` — Alias haritası ~40 efekt bloğunu ölü kod yapıyor.
- `SlideStrip.jsx:1025` — Liste/Grid geçiş butonu işlevsiz (grid modu düzeni değiştirmiyor);
  yalancı geri bildirim (AGENTS "broken buttons").
- `PuzzleEditor.jsx:338` — Salt okunur "Konum" göstergesi hiçbir zaman dolmuyor (ölü UI).
- `DragDropDebugPanel.jsx:1` — Hiçbir yerde import edilmiyor (ölü bileşen); yanlışlıkla
  bağlanırsa öğrenci önizlemesine sızma riski (clipboard erişimli, fixed/zIndex:1300).
- `PuzzleEditor.jsx:154` — Tür etiketinde İngilizce '(Crossword)' (diğerleri Türkçe).
- (Devamı: b2-modals-1/2/3 ve b2-activity-editors-2 içindeki Orta'lar workflow çıktısında.)

## DÜŞÜK (özet)

~49 düşük bulgu: erişilebilirlik (div+onClick, eksik aria/alt), küçük Türkçe/yazım tutarsızlıkları,
ölü kod ve kopyala-yapıştır tekrarları, küçük tıklama alanı/kontrast notları. Tam liste workflow
çıktısında; öncelik Aşama 6'da.

---

## İncelenen Dosyalar (tamamlanan parçalar)

PreviewComponents.jsx, storyline-preview/index.jsx, useRibbonController.js, RibbonPrimitives.jsx,
SlideStrip.jsx, SlideTransitionView.jsx, DragDropConfigPanel.jsx, PuzzleEditor.jsx,
DragDropDebugPanel.jsx, HotspotEditor.jsx, Sequence/Survey/Matching/MixedActivity/FillBlank/
TextEntry/Selection/NumericEditor.jsx, VariablesManagerModal, ProjectVersionManagerModal,
AdminManagementModal, ReviewThreadsModal, AdminUserPanel, GlossaryEditorModal, IconPickerModal,
BranchingDiagramModal, ContentLibraryModal, CharacterPickerModal, SymbolPickerModal,
SlideMasterModal, ChartEditorModal, TableEditorModal, FindReplaceModal, ColorPickerPopover,
ShapePreviewIcon, ResumePromptDialog, KickNotificationOverlay, ToastStack, RuntimeVideoElement,
canvasAddActions, ui/* (Toast/Modal/Select/Input).

## WF-B'de Tamamlanan Parçalar (soket hatası sonrası)

### b2-widgets — YÜKSEK (KESİN KURAL ile doğrudan ilgili)

- **`src/widgets/widgetZipParser.js:230`** — `scanWidgetSecurity` dış kaynak (EXTERNAL_SCRIPT/
  EXTERNAL_LINK/NETWORK_REQUEST) tespit edip yalnız `warnings`'e yazıyor; sonra TÜM güvenli yollu
  dosyaları `rawAssets`'e koyuyor ve `scormExport.js:461-481` bunları olduğu gibi paketliyor. Yani
  `https://cdn.../lib.js` veya `fetch()` içeren widget kullanıcı onayı olmadan SCORM'a giriyor →
  öğrenci oynatıcısında dış kaynak çekiliyor. **KESİN KURAL ihlali.**
- **`src/widgets/widgetZipParser.js:223`** — `result.warnings` çağıran `LibraryWorkspace.jsx`
  tarafından hiç okunmuyor; dış kaynaklı widget "yüklendi" bildirimiyle sessizce ekleniyor (uyarı yutuluyor).
- **`src/widgets/WidgetRegistry.js:70`** — Blob/data `entryUrl`'de `instanceId`/`props` query'ye
  eklenmiyor; önizlemede widget↔host iletişimi kopuyor.

### b2-preview-flows — ORTA/DÜŞÜK
- `PreviewExtraFlows.jsx:23` — Süre dolup yeniden başlatınca sayaç sıfırlanmıyor (0:00, ikinci
  deneme bozuk); `:30` timer her saniye yeniden kuruluyor + updater içinde setState.
- `PreviewPuzzleFlow.jsx:316` — Crossword modalinde çift `keydown` dinleyicisi (kırılgan).
- `PreviewPuzzleFlow.jsx:864` — WordSearch `isFound`'da korunmasız `direction/answer` → beyaz ekran riski.
- `PreviewExtraFlows.jsx:227` (D) — Anket boş gönderilse de "başarı" geri bildirimi.
- `PreviewExtraFlows.jsx:774` (D, bilgi) — Sesle yazım editör-only; SCORM'a taşınırsa KVKK/dış-link
  riski, export'a girmediği doğrulanmalı.

### b2-ribbon-tabs — 24 dosya okundu, çoğu temiz (küçük Orta/Düşük; tam liste workflow çıktısında).

## Kök Dosyalar

`AnswerPanel.jsx`, `LayerPanel.jsx`, `RightPanelShell.jsx`, `index.jsx` — canlı testte editör
yüklenince render ediliyor (0 konsol hatası). Not: `MixedActivityEditor` çökme bulgusu (B2-Y4)
`AnswerPanel.jsx`'in prop geçmemesinden kaynaklanıyor.
