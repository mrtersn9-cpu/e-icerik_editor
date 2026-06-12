# 01 — Durum Yönetimi İncelemesi

Kapsam: `src/store/`, `src/editor-logic/`, `src/logic/`

Bu turda özellikle hazır buton toplu font/stil akışının veri modelinde nasıl saklandığı,
tema uygulamasına nasıl girdiği ve undo/redo açısından tek güncelleme olarak işlenip
işlenmediği incelendi.

## Bulgular

### Orta — Hazır buton font akışı için SCORM/typed runtime test boşluğu

- Dosya:satır: `src/__tests__/readyButtonTextColor.test.js:128`, `src/__tests__/readyButtonTextColor.test.js:157`, `src/__tests__/readyButtonTextColor.test.js:211`
- Sorun: Testler `restyleReadyButtonsForPreset`, `restyleAllButtonsForPackage` ve
  cevap katmanı nesnelerinde font ailesi/punto/kalınlık alanlarının uygulandığını
  doğruluyor. Ancak aynı ayarların runtime deck'e, typed SCORM oynatıcıya ve
  export edilen HTML'e taşındığını doğrulayan test yok.
- Etki: Toplu font akışı veri/restyle katmanında yeşil görünse bile öğrenciye görünen
  SCORM çıktısında bozulma kaçabilir. Bu TTKB açısından özellikle buton tek satır
  okunabilirliği ve aynı rol tipografi tutarlılığı için riskli.
- Önerilen düzeltme: `storylineRuntimeDeck` veya `scormTypedActivityPlayer` testlerine
  `readyButtonFontFamily`, `readyButtonFontSize`, `readyButtonFontWeight` ve
  `readyButtonTextColor` alanlarının export HTML/typed button stiline yansıdığını
  kanıtlayan test ekle.

## Notlar

- `src/logic/buttonStyling.js:24` ve devamında font boyutu/kalınlığı clamp ediliyor;
  bu TTKB tarafında aşırı küçük/büyük punto riskini azaltan doğru yönde bir koruma.
- `src/logic/buttonStyling.js:113` içindeki `getReadyButtonTextStylePatch()` önizleme
  bileşenleri için sade bir stil patch'i üretiyor; ancak rapor 04'te belirtildiği
  gibi bu patch SCORM typed player'a taşınmıyor.

## İncelenen Dosya Grupları

- `src/logic/buttonStyling.js`
- `src/logic/activityRestyle.js`
- `src/logic/themeApplication.js`
- `src/editor-logic/colorUtils.js`
- `src/__tests__/readyButtonTextColor.test.js`

