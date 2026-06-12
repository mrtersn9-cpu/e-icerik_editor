# 99 — Birleşik Rapor ve Düzeltme Planı

Bu rapor 2026-06-12 tarihli ilk Codex denetim turunun birleşik çıktısıdır. Statik
analiz, otomatik etkileşim taraması ve komut kontrolleri yapıldı; canlı Playwright
tıklama, ekran görüntüsü inceleme ve gerçek SCORM zip çevrimdışı ağ testi henüz
yapılmadı.

## Bulgular

### B-001 — Yüksek — Hazır buton toplu font/stil ayarı typed SCORM oynatıcıya taşınmıyor

- Durum: Düzeltildi (commit atılmadı).
- Kanıt türü: Statik analiz
- Dosya:satır: `src/utils/storylineRuntime.js:117`, `src/utils/storylineRuntime.js:225`,
  `src/utils/scormTypedActivityPlayer.js:10`, `src/utils/scormTypedActivityPlayer.js:154`,
  `src/utils/scormExport.js:310`, `src/utils/scormExport.js:364`
- TTKB riski: Evet.
- Sorun: Runtime deck beyaz listesinde `readyButtonTextColor`, `readyButtonFontFamily`,
  `readyButtonFontSize`, `readyButtonFontWeight` yok. Typed SCORM player da sabit
  `.typed-btn` stili kullanıyor.
- Etki: Editördeki toplu font ailesi/punto/kalınlık/yazı rengi değişimi bazı öğrenci
  SCORM etkinliklerinde görünmeyebilir.
- Önerilen düzeltme: Runtime deck'e hazır buton yazı stil alanlarını ekle; typed
  player butonlarına ortak CSS değişkeni/inline stil uygula; SCORM HTML testini ekle.
- Yapılan düzeltme: Runtime deck'e `readyButtonTextColor`, `readyButtonFontFamily`,
  `readyButtonFontSize`, `readyButtonFontWeight` alanları eklendi. Typed SCORM player
  bu alanları CSS değişkenlerine bağlayarak `.typed-btn` kontrollerine uyguluyor.
  Özel font yalnız hazır buton tipografisinde kullanılsa bile SCORM HTML'e `@font-face`
  olarak gömülüyor.

### B-002 — Yüksek — PHP export helper içinde SCORM 2004 üretim yolu duruyor

- Durum: Düzeltildi (commit atılmadı).
- Kanıt türü: Statik analiz
- Dosya:satır: `ftp-hosting/api/index.php:1776`, `ftp-hosting/api/index.php:1797`,
  `ftp-hosting/api/index.php:1883`
- TTKB/ürün riski: Evet.
- Sorun: Ürün kuralı yalnız SCORM 1.2 olmasına rağmen PHP helper `scorm2004` dalına
  sahip.
- Etki: Dormant yol yeniden bağlanırsa veya eski state ile çalışırsa ürün kuralına
  aykırı paket üretilebilir.
- Önerilen düzeltme: SCORM 2004 dalını kaldır; 1.2 dışındaki standardı reddet veya
  her zaman `scorm12` normalize et.
- Yapılan düzeltme: PHP manifest helper içindeki SCORM 2004 dalı kaldırıldı.
  `normalize_scorm_standard()` artık yalnızca `scorm12` döndürüyor.

### B-003 — Orta — Önizleme flow'larında toplu font kapsaması kanıtlanmamış

- Durum: Düzeltildi (commit atılmadı).
- Kanıt türü: Statik analiz / test boşluğu
- Dosya:satır: `src/components/preview/PreviewComponents.jsx:1773`,
  `src/components/preview/PreviewComponents.jsx:3202`
- Sorun: Hazır buton font patch'i belirli preview flow'larda kullanılıyor; diğer
  preview flow'ların tamamında aynı davranış statik olarak kanıtlanmadı.
- Etki: Editör önizlemesinde bazı etkinlik tipleri toplu font değişimini göstermeyebilir.
- Önerilen düzeltme: Preview buton stilleri ortak helper'a taşınsın; her etkinlik tipi
  için görsel/canlı test eklensin.
- Yapılan düzeltme: Eski React preview flow'larındaki öğrenci aksiyon butonları
  `getReadyButtonTextStylePatch()` tabanlı ortak helper'a bağlandı. SCORM ile aynı
  preview zaten `buildStorylinePlayerHtml()` yolunu kullandığı için B-001 düzeltmesini
  miras alıyor.

### B-004 — Orta — Hazır buton toplu font için SCORM runtime testi eksik

- Durum: Düzeltildi (commit atılmadı).
- Kanıt türü: Test sonucu / test boşluğu
- Dosya:satır: `src/__tests__/readyButtonTextColor.test.js:128`,
  `src/__tests__/scormTypedActivityPlayer.test.js:1`
- Sorun: Mevcut testler restyle katmanını doğruluyor; SCORM typed player'da font/color
  yansımasını doğrulamıyor.
- Etki: B-001 gibi SCORM kaçakları testlerden geçebilir.
- Önerilen düzeltme: `buildStorylinePlayerHtml()` ile üretilen HTML'de ve jsdom DOM'unda
  typed buton stillerini doğrulayan test ekle.
- Yapılan düzeltme: `scormTypedActivityPlayer.test.js` typed SCORM player'da CSS
  değişkenlerinin DOM'a yansıdığını doğruluyor. `scormCustomFonts.test.js` hazır buton
  toplu fontunda kullanılan özel fontun SCORM HTML'e gömüldüğünü doğruluyor.

### B-005 — Düşük — SCORM manifest namespace URL'leri katı dış URL taramasında yanlış pozitif olabilir

- Durum: Kapatıldı / standart istisna olarak belgelendi.
- Kanıt türü: Statik analiz
- Dosya:satır: `src/utils/scormExport.js:255`, `src/utils/scormExport.js:928`
- Sorun: XML namespace/schema URL'leri pakette `http://` olarak geçiyor. Bunlar normalde
  fetch değildir, ancak katı paket taraması risk diye işaretleyebilir.
- Önerilen düzeltme: İstisnayı dokümante et veya `schemaLocation` kullanımını yerel XSD
  odaklı sadeleştir.
- Yapılan düzeltme: `src/utils/scormExport.js` içinde SCORM 1.2 namespace URI'lerinin
  runtime dış istek olmadığı ve XSD dosyalarının pakete yerel eklendiği açıklandı.
  Bu URI'leri kaldırmak SCORM uyumluluğu riski taşıdığı için kod tarafında standart
  namespace korunuyor.

### B-006 — Bilgi — Editör kabuğu Google Fonts kullanıyor

- Durum: Düzeltildi (commit atılmadı).
- Kanıt türü: Statik analiz
- Dosya:satır: `public/index.html:7`, `public/index.html:9`, `src/constants/fonts.js:165`
- Sorun: Editör tarafı Google Fonts'a bağlanabiliyor. Mevcut politika bunu SCORM dış
  link ihlali saymıyor.
- Önerilen düzeltme: Editörün de tamamen çevrimdışı çalışması hedeflenirse yerel font
  manifestine geç.
- Yapılan düzeltme: `public/index.html` içindeki Google Fonts preload/stylesheet
  bağlantıları kaldırıldı. `src/constants/fonts.js` artık yalnızca yerel
  `public/fonts/fonts.css` dosyasını dener; CDN fallback yoktur.

## Önerilen Düzeltme Sırası

1. B-001 ve B-004: Düzeltildi.
2. B-002: Düzeltildi.
3. B-003: Düzeltildi; canlı görsel test hala ayrıca önerilir.
4. B-005: Standart SCORM namespace istisnası olarak belgelendi.
5. B-006: Düzeltildi.

## Tamlık Eleştirisi

- Canlı tıklama testi yapılmadı; `07-tiklanabilir-envanter.md` ham statik envanterdir.
- Görsel ekran görüntüsü seti üretilmedi; `09-gorsel-bulgular.md` görsel risk önceliği
  içerir.
- Gerçek SCORM zip üretimi, zip açma, dosya bütünlüğü ve tarayıcıda çevrimdışı ağ
  trafiği izleme yapılmadı. Buna rağmen SCORM HTML üretimi jsdom testleriyle doğrulandı.
- Kirli çalışma ağacı üzerinde inceleme yapıldı; mevcut değişiklikler kullanıcı/önceki
  çalışma kabul edilerek geri alınmadı.

## Komut Özeti

- `npm run lint`: Başarılı, uyarısız.
- `npm run test -- --runInBand`: Başarılı, 39 suite / 299 test.
- `npm run build`: Başarılı, bundle size ve `fs.F_OK` uyarısı var.
- `npm audit --omit=dev`: 0 vulnerability.
