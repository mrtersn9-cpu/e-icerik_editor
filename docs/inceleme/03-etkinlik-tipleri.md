# 03 — Etkinlik Tipleri İncelemesi

Kapsam: `src/activity-types/`, `src/features/`

**Tur 2 (Derin çok-ajanlı inceleme, 2026-06-15):** 73 dosya 12 parçada incelendi.

## Özet

| Önem | Adet |
|---|---|
| Kritik | 1 (+1 "Kritik" çürütüldü → ölü kod, aşağıda) |
| Yüksek | 10 |
| Orta | ~24 |
| Düşük | ~46 |

---

## KRİTİK

### B3-K1 — `duplicateActivity` referans remap'i yapmıyor; kopyalanan etkinlik bozuk
- `src/features/library/LibraryWorkspace.jsx:531` — `duplicateActivity` slide/object/trigger'lara
  yeni id atıyor ama bu id'lere işaret eden referansları (trigger.target/value/conditions,
  timeline.objectId, dragDropMatches, layerId, groupId, linkedActionTargetId, customInteraction
  events/commands) **hiç güncellemiyor**. Aynı kod tabanındaki `cloneActivitySlideForPaste`
  (activityHelpers.js) bunu `objectIdMap`/`remapReference` ile doğru yapıyor. Sonuç: kopyalanan
  etkinlikte tetikleyiciler, cevaplar, zaman çizelgesi bağları kopuk → sessiz veri bozulması,
  öğrenci/SCORM çıktısında çalışmayan etkileşimler. **Fix:** kopyalamayı slide-bazlı remap
  altyapısıyla yeniden yaz; ortak bir `cloneActivity` yardımcısına indir.

### B3-O1 (eski "Kritik" — ÇÜRÜTÜLDÜ → ölü kod)
- `src/components/preview/PreviewComponents.jsx:6` `ButtonPackageIntroDiagram`'ı `buttonStyling`'ten
  named import ediyor (orada export yok) → undefined → render'da çökerdi. **Ancak** PreviewComponents.jsx
  ölü/yetim dosya (bkz. rapor 01 B1-O0). Canlı `EIcerikEditor.jsx:54` bileşeni doğru kaynaktan
  default import ediyor. → Kritik DEĞİL; ölü kod temizliğiyle birlikte ele alınacak.

---

## YÜKSEK

- **`ActivityTextEditor.jsx:363` + `:433`** — Tema Paketi ve Menü "Aktif" anahtarları aynı handler'da
  iki ardışık `onUpdate` çağırıyor; ikinci çağrı bayat `activity`'yi yaydığı için ilk yazım
  (settings.showButtonPackageIntro / showMenuScreen) **kayboluyor** (kayıp güncelleme) + undo/redo'ya
  iki kayıt. **Fix:** tek `patch({ settings, ... })` çağrısında birleştir.
- **`FormatRightPanel.jsx:268`** — "URLAc" aksiyonu seçilince URL girilecek alan render edilmiyor;
  trigger value kalıcı `'https://'` kalıyor, kullanıcı bu panelden gerçek URL giremiyor.
- **`LibraryWorkspace.jsx:593`** — ZIP widget güvenlik/dış-kaynak uyarıları (`result.warnings`)
  yutuluyor; dış CDN/fetch içeren widget uyarısız ekleniyor → SCORM'a sızar (KESİN KURAL).
- **`TtkbComplianceRightPanel.jsx:269`** — Auto-Fix uzun `await inlineExternalMediaForActivity`
  sırasında kullanıcı slayt değiştirirse bayat snapshot canlı state'i eziyor (yarış koşulu) →
  sessiz veri kaybı.
- **`SurukleBirakCevapPanel.jsx:160`** — Cevap katmanı üretimi kullanıcı eylemi olmadan, panel
  mount olunca `matchCount>0` ise otomatik tetikleniyor → onaysız nesne/katman değişikliği.
- **`SurukleBirakCevapPanel.jsx:425`** — Eşleşme seçimi undo geçmişine iki kayıt yazıyor; tek
  Geri Al görünür değişikliği geri almıyor.
- **`KarmaCevapPanel.jsx:74`** — Karma öğe tipi değişince tip-özel veriler (options/pairs/...) siliniyor
  ve selection/drag-drop alt-editörlerinde "ekle" düğmesi olmadığından öğe cevapsız çıkmaza giriyor.
- **`cevapSchema.js:42`** — `maxAttempts: settings.maxAttempts || DEFAULT` → 0 (sınırsız) sessizce
  3'e dönüşüyor (`||` yerine `??` olmalı). Öğrenci deneme limiti yanlış.
- **`useTimelineController.js:263`** — Sürükleme her pointermove'da `onUpdate` → commit; tek sürükleme
  onlarca commit üretip 40-adımlık undo geçmişini taşırıyor (B1-Y5 ile aynı controller).

---

## ORTA (özet liste)

- `TtkbComplianceRightPanel.jsx:126` — Kontrast denetimi `colorLocked`'ı yok sayıyor → düzeltilemeyen
  kalıcı sahte "Kritik Hata"; `:120` denetim yalnız aktif slide'ı kapsarken Auto-Fix tüm slide'ları
  değiştiriyor (tutarsız kapsam); `:269` Auto-Fix'te yutulan hata.
- `ActivityTextEditor.jsx:825` — "Stilleri Sıfırla" intro/package ekranlarında effect tarafından geri yazılıyor.
- `FormatRightPanel.jsx:855` — Opaklık göstergesi nesne-seviye okuyor, stile yazıyor (tutarsız).
- `InteractionBuilderDialog.jsx:291` — Her render'da trigger başına döngü tespiti (ağır).
- `LibraryWorkspace.jsx:606` — Widget konumu `book.stageWidth`'ten okunuyor (hep undefined);
  `:570` içe aktarılan etkinlik normalize/iskele olmadan ekleniyor.
- `TextStudioWorkspace.jsx:274` — "Önizlemeyi Yenile" tüm sayfayı reload ediyor.
- `HomeRightPanel.jsx:147` — Slidesiz yeni etkinlikte Ad/Süre düzenlemesi sessizce kayboluyor.
- `ActiveLayerSummary.jsx:49` — Bileşen tamamen ölü kod; `:132` ölü paneldeki katman ekleme
  trigger/temizlik mantığından yoksun.
- `SurukleBirakCevapPanel.jsx:191` — "Temizle" üretilmiş cevap-katmanı nesnelerini yetim bırakıyor;
  `:391` çoklu hedefe atanan öğe Cevap Formu select'inde görünmüyor.
- `OrtakCevapKartlari.jsx:361` — Aynı panelde iki farklı "Maksimum deneme" alanı çelişen kaynaklara yazıyor.
- `AnketCevapPanel.jsx:116` — Yanıt dağılımı her render'da `Math.random()` ile yeniden çiziliyor;
  `:111`/`:43` React key olarak seçenek metni/indeks → silme sonrası odak/değer kayması.
- `KisaCevapCevapPanel.jsx:27`, `DogruYanlisCevapPanel.jsx:18` — indeks key / kendini güncelleyen effect.
- `cevapActions.js:108` — `mcMode` root'a yazılıyor, slide-state'e senkron edilmiyor.
- `cevapSelectors.js:3` — Drawer başlığı true-false panelinde yanlış tür etiketi.
- `useTimelineController.js:374` — `moveActiveTrack` katman filtresini yok sayıyor; `:206` Ctrl/Shift
  çoklu seçim tekli seçime düşüyor.
- `SceneRightPanel.jsx:57` — Sahne açıklaması yanlış alana (`activity.notes`) yazılıyor.
- `customInteractionTemplates.js:169` — Demo şablonu kullanıcının tüm custom-widget nesnelerini siliyor.

## DÜŞÜK (özet)

~46 düşük: indeks-key kaynaklı küçük kaymalar, erişilebilirlik, Türkçe/yazım, ölü kod, kopyala-yapıştır
tekrarları. Tam liste workflow çıktısında.

## İncelenen Dosyalar

Tüm `src/features/**` (12 parça) + `src/activity-types/custom-interaction/*` baştan sona okundu.
`b3-ttkb-panel` parçasında 1 dosya kısmen (büyük), notReviewed'a işlendi.
