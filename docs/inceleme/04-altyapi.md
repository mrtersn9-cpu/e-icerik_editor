# 04 — Altyapı İncelemesi

Kapsam: `src/hooks/`, `src/utils/`, `src/api/`, `src/mobile/`, `src/constants/`,
`src/theme/`, `src/generated/`

**Tur 2 (Derin çok-ajanlı inceleme, 2026-06-15):** 11 parça. SCORM export/oynatıcı runtime'ı
(`scormExport`, `scormTypedActivityPlayer`, `storylineRuntimeEngine`, `storylineRenderer`,
generated/*) özellikle incelendi.

## Özet

| Önem | Adet |
|---|---|
| Kritik | 0 |
| Yüksek | ~9 |
| Orta | ~13 |
| Düşük | ~24 |

---

## YÜKSEK — Dış bağlantı / KESİN KURAL kümesi (DOĞRULANDI)

Bu küme bağımsız birden çok ajan + manuel doğrulama ile teyit edildi. SCORM paketine
kullanıcı manuel eklemeden dış istek sızabilecek **gerçek canlı** yollar:

- **`src/generated/storylineRendererCore.js:4`** — `storylineRendererSanitizeSvg` `href/src/
  xlink:href`'i yalnız değer `http` ile **başlamıyorsa** siliyor → `http(s)://` referansları
  KORUNUYOR. Bu fonksiyon SCORM bundle'ında (STORYLINE_RENDERER_CORE_SCRIPT) ve `storylineRenderSlide`
  `s.svgMarkup` (satır 47) + `obj.iconSvg` (satır 30) ile öğrenci runtime'ında çalışıyor →
  SVG'ye gömülü dış görsel SCORM açılınca çekiliyor. **[manuel doğrulandı]**
- **`src/utils/editorHelpers.js:119`** — `sanitizeSvgMarkup` aynı şekilde `http(s)`'i güvenli
  sayıyor; çıktısı `pdfActivityIntegration` → `practiceSlide.svgMarkup` → `storylineRuntime`
  payload'una taşınıyor (jsdom ile doğrulandı: `<image href="https://...">` korunuyor). **[doğrulandı]**
- **`src/utils/pdfActivityIntegration.js:58`** — Dış referansı raporluyor ama içerikten
  **silmiyor**; "temizlendi" izlenimi yanıltıcı.
- **`src/generated/storylineRendererCore.js:30`** — `embed` nesnesi dış `embedUrl`'i SCORM'da
  iframe olarak yüklüyor; `scormMediaInline` `embedUrl`'i kapsam dışı bıraktığından gömülmüyor.
  Kullanıcı manuel eklediği için yasak değil ama **export uyarısı şart** (HARD RULE).
- **`src/utils/lmsSecurity.js:6`** — Dış-link tespiti yalnız `https?://` arıyor; protokolsüz `//`
  ve diğer şemaları kaçırıyor → uyarıya takılmıyor.
- **`src/utils/lmsSecurity.js:48`** — Gömülü URL'leri de yakalayan güçlü `collectExternalUrls`
  ölü kod; export `EIcerikEditor.jsx:749`'daki zayıf yerel kopyayı kullanıyor.

> Sonuç: SVG/embed/widget yollarında dış referanslar pakete sızabiliyor ve export uyarısı
> hem zayıf (protokolsüz/gömülü kaçırıyor) hem bazı yollarda hiç tetiklenmiyor. **KESİN KURAL
> için en yüksek öncelikli düzeltme alanı.** (widget tarafı: bkz. rapor 02 B2-widgets.)

## YÜKSEK — SCORM doğruluk / tamlık

- **`src/generated/storylineRuntimeEngine.js:902`** — `parseAndEvaluate` SCORM bundle'ına
  gömülmemiş; formüllü `DegiskenAta` SCORM'da sessizce bozuluyor (editörde çalışıyor). **Fix:**
  formulaEngine'i SCORM bundle'ına ekle.
- **`src/utils/scormTypedActivityPlayer.js:937`** — wordsearch/maze/memory'de "Kontrol Et" yok;
  `activityScores` hiç yazılmıyor → etkinlik asla tamamlanmıyor, SCORM `score.raw`/`lesson_status`
  güncellenmiyor. **Fix:** bu üç türe `typedActions`/otomatik `typedCheck` ekle.
- **`src/utils/scormExport.js:459`** — Tekrarlı widget'ta `rawAssets` silinmiyor; ham binary
  PAYLOAD JSON'una gömülüyor (paket şişmesi). **Fix:** `rawAssets`/`blobMap` temizliğini
  `processedWidgetIds` koşulundan ayır.
- **`src/constants/contentConstants.js:1`** — İki kopya `CONTENT_TEXT` (burada + contentLanguage.js)
  senkronizasyondan çıkmış ('PLAY / PAUSE' vs 'OYNAT / DURAKLAT'). Ölü kopya kaldırılmalı.

## ORTA (özet)

- `scormTypedActivityPlayer.js:676` — Türkçe i/İ için yanlış `toUpperCase` → doğru cevabı
  hatalı reddediyor (TTKB ölçme doğruluğu).
- `scormMediaInline.js:26` — Medya inline fetch'inde zaman aşımı yok → export sonsuza dek askıda kalabilir.
- `scormExport.js:57` — ZIP yazıcısı 32-bit/sıkıştırmasız; büyük inline medyada bozuk paket riski.
- `chartSvg.js:98` — Grafik renk değeri SVG `fill`'e escape edilmeden basılıyor (enjeksiyon yüzeyi).
- `storylineRuntimeEngine.js:1097/1358`, `generated:1084` — Sıralama/memory etkinliklerinde
  etkileşimsiz sahte başarı / doğru cevap referansı tutmama.
- `storylineRenderer.js:553` — Önizleme runtime API'si modül ömrü boyunca tek `new Function` ile cache'leniyor.
- `lmsSecurity.js:80` — URL toplayıcı export'ları kullanılmıyor (kopya sürüklenme riski).
- `editorConstants.js:748` — Çocuk buton presetlerinde neon gradient + çok katmanlı gölge TTKB
  parlama/bilişsel-yük kuralına aykırı olabilir (bilgi-notu/Orta).
- `useMobileCanvasGestures.js:67` — Pinch'te `onZoomChange` null guard yok.
- `useAuth.js:48` — `readStoredAuth` her çağrıda storage'a yazıyor.
- `generated/storylineRendererCore.js:46` — Reusable drag swap klon eviction'da state tutarsızlığı.

## DÜŞÜK (özet)

~24 düşük: küçük null guard'lar, tema sabitleri, ölü/yinelenen yardımcılar, Türkçe/yazım. Tam
liste workflow çıktısında.

## İncelenen Dosyalar

`src/utils/**` (21), `src/constants/**` (15), `src/generated/**` (4), `src/theme/**`, `src/mobile/**`,
`src/api/apiClient.js`, `src/hooks/useAuth.js` baştan sona okundu. `scormExport.js` bir parçada
kısmen (büyük; dış-link/srcdoc odaklı), notReviewed'a işlendi — ama b4-scorm-export parçasında ayrıca
tam okundu.
