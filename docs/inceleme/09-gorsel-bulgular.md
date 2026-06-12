# 09 — Görsel Bulgular

Bu turda 1920x1080, 1366x768, 1024x768 ve 390x844 ekran görüntüsü seti üretilmedi.
Bu nedenle aşağıdaki maddeler statik/görsel risk önceliğidir; ekran görüntüsüyle
kanıtlanmış kesin görsel bulgu değildir.

## Öncelikli Görsel Riskler

### Yüksek — Toplu font değişimi SCORM typed butonlarında tutarsız görünebilir

- Durum: Kod tarafı düzeltildi; ekran görüntüsüyle canlı görsel doğrulama yapılmadı.
- Ekran/çözünürlük: Henüz ekran görüntüsü alınmadı.
- Kanıt türü: Statik analiz.
- İlgili dosyalar: `src/utils/scormTypedActivityPlayer.js:10`,
  `src/utils/storylineRuntime.js:117`
- Sorun: `.typed-btn` font/renk değerleri sabit olduğundan editörde yapılan toplu
  font/punto/kalınlık/yazı rengi değişimi typed SCORM butonlarında görünmeyebilir.
- TTKB etkisi: Aynı roldeki butonlar farklı tipografiyle kalabilir; uzun Türkçe
  etiketlerde tek satır okunabilirlik garantisi zayıflar.
- Önerilen görsel test: Aynı etkinliği 10px, 18px ve 32px punto; normal/kalın;
  açık/koyu yazı rengiyle preview ve SCORM player'da karşılaştır.
- Yapılan düzeltme: Typed SCORM player hazır buton tipografi CSS değişkenlerini
  activity verisinden alıyor. Eski React preview aksiyon butonları ortak helper'a bağlandı.

## Ekran Görüntüleri

Bu turda `docs/inceleme/ekran-goruntuleri/` altına yeni ekran görüntüsü kaydedilmedi.
