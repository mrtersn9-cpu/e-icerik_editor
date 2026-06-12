# 08 — Canlı İşlev Test Bulguları

Bu turda Playwright ile canlı tarayıcı testi yapılmadı. Aşağıdaki maddeler statik
kanıtla tespit edilen ve canlı testte öncelik verilmesi gereken işlev riskleridir.

## Sorunlu / Öncelikli Teste Alınacaklar

### Yüksek — Hazır buton toplu font ayarı typed SCORM etkinliklerinde doğrulanmalı

- Durum: Düzeltildi ve otomatik test eklendi; canlı tarayıcı testi yine önerilir.
- Öge: Tasarım/Stiller > Buton Setleri > Toplu font ailesi / punto / kalınlık /
  yazı rengi
- Statik kanıt: `src/utils/storylineRuntime.js:117`,
  `src/utils/scormTypedActivityPlayer.js:10`, `src/utils/scormTypedActivityPlayer.js:154`
- Beklenen: Ayar tüm hazır butonlara, yeni eklenen butonlara, activity override
  içindeki butonlara, önizlemeye ve SCORM typed player'a aynı anda yansır.
- Gerçekleşen: Kod okumasına göre typed SCORM player sabit `.typed-btn` stili
  kullanıyor; activity font alanları runtime deck'e taşınmıyor.
- Düzeltme sonrası: Runtime deck alanları taşıyor; typed SCORM player CSS değişkenleri
  üzerinden bu ayarları kullanıyor. `scormTypedActivityPlayer.test.js` bunu DOM
  seviyesinde doğruluyor.
- Yeniden üretme adımları:
  1. Tasarım/Stiller > Buton Setleri altında font ailesini `Verdana`, puntoyu `18`,
     kalınlığı `700`, yazı rengini belirgin bir renge ayarla.
  2. Fill-blank veya puzzle gibi typed activity içeren bir proje oluştur.
  3. Önizleme ve SCORM export player'da `Kontrol Et`, `Temizle`, `Çözümü Göster`
     butonlarını incele.
  4. Beklenen font/color değerleri uygulanmış mı kontrol et.

## Test Edilemedi

- [?] Üst araç çubuğu + sol panel: canlı tıklama yapılmadı.
- [?] Sağ panel + zaman çizelgesi: canlı tıklama yapılmadı.
- [?] Sahne + bağlam menüleri + diyaloglar: canlı tıklama yapılmadı.
- [?] Önizleme/oynatıcı + SCORM çıktısı: gerçek SCORM zip üretimi ve çevrimdışı
  ağ izlemesi yapılmadı.
