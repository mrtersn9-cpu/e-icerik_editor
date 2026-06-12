# 04 — Altyapı İncelemesi

Kapsam: `src/hooks/`, `src/utils/`, `src/api/`, `src/mobile/`, `src/constants/`,
`src/theme/`, `src/styles/`, `src/generated/`

## Bulgular

### Yüksek — Hazır buton toplu font/stil ayarı typed SCORM oynatıcıya taşınmıyor

- Durum: Düzeltildi (commit atılmadı).
- TTKB riski: Evet
- Kanıt türü: Statik analiz
- Dosya:satır:
  - `src/utils/storylineRuntime.js:117`
  - `src/utils/storylineRuntime.js:225`
  - `src/utils/scormTypedActivityPlayer.js:10`
  - `src/utils/scormTypedActivityPlayer.js:154`
  - `src/utils/scormExport.js:310`
  - `src/utils/scormExport.js:364`
- Sorun: `pickSlideState()` runtime'a taşınacak alanları beyaz listeyle seçiyor, ancak
  `readyButtonTextColor`, `readyButtonFontFamily`, `readyButtonFontSize` ve
  `readyButtonFontWeight` bu listede yok. Typed activity SCORM player ise `.typed-btn`
  için sabit `background`, `color`, `font: inherit` ve `font-weight:800` kullanıyor;
  `typedButton()` herhangi bir activity font patch'i uygulamıyor. `scormExport.js`
  bu typed player stilini doğrudan export HTML'e gömüyor ve typed activity'lerde
  `renderTypedActivity(s)` yoluna erken dönüyor.
- Etki: Editörde Tasarım/Stiller > Buton Setleri bölümünden yapılan toplu font ailesi,
  punto, kalınlık ve yazı rengi değişimi SCORM typed etkinliklerinde görünmeyebilir.
  Bu, öğrenciye görünen çıktıda aynı rol tipografisinin bozulmasına ve buton metinlerinin
  tek satır/okunabilir kalma garantisinin kaybolmasına yol açar.
- Önerilen düzeltme: Runtime deck'e hazır buton yazı stil alanlarını ekle. Typed player
  root'una CSS değişkenleri veya her `typedButton()` için inline stil uygula. SCORM
  export testinde font ailesi/punto/kalınlık/yazı renginin HTML içinde ve DOM'da
  uygulandığını doğrula.
- Yapılan düzeltme: Runtime deck ve typed player CSS değişkenleri güncellendi; SCORM
  HTML/jsdom testleri eklendi.

### Düşük — SCORM manifest namespace URL'leri katı dış URL taramasında yanlış pozitif üretebilir

- Durum: Standart istisna olarak belgelendi.
- TTKB riski: Düşük/operasyonel
- Kanıt türü: Statik analiz
- Dosya:satır: `src/utils/scormExport.js:255`, `src/utils/scormExport.js:258`,
  `src/utils/scormExport.js:928`
- Sorun: SCORM 1.2 manifestinde XML namespace ve `schemaLocation` için `http://`
  URL'leri kullanılıyor. Exporter aynı XSD dosyalarını pakete de ekliyor; bu normalde
  runtime dış istek değildir.
- Etki: "Paket içinde her dış URL yasak" şeklinde çok katı otomatik denetim yapan bir
  kabul süreci bu URL'leri hatalı risk olarak işaretleyebilir.
- Önerilen düzeltme: Bu URL'lerin runtime fetch olmadığı dokümante edilsin veya mümkünse
  `schemaLocation` kısmı yalnızca yerel XSD dosyalarına referans verecek şekilde
  sadeleştirilsin. SCORM uyumluluğu tekrar test edilmeli.

## İncelenen Dosya Grupları

- `src/utils/storylineRuntime.js`
- `src/utils/scormExport.js`
- `src/utils/scormTypedActivityPlayer.js`
- `src/constants/fonts.js`
- `src/utils/ttkbCompliance.js`
- `src/mobile/`
- `src/generated/storylineRendererCore.js`
