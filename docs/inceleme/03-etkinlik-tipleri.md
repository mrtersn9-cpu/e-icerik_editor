# 03 — Etkinlik Tipleri İncelemesi

Kapsam: `src/activity-types/`, `src/features/`

## Bulgular

### Orta — Sağ paneldeki toplu font kontrolleri envanterde ayrı test akışı gerektiriyor

- Durum: Kod tarafı düzeltildi; canlı tıklama testi önerilir.
- Dosya:satır: `src/features/editor-workspace/right/panels/DesignRightPanel.jsx:265`,
  `src/features/editor-workspace/right/panels/DesignRightPanel.jsx:292`,
  `src/features/editor-workspace/right/panels/DesignRightPanel.jsx:575`
- Sorun: Tasarım/Stiller > Buton Setleri panelinde font ailesi, punto ve kalınlık
  kontrolleri var. Statik olarak bu kontroller activity alanlarını güncelliyor ve
  `applyGeneratedThemeToActivity()` çağrısıyla yeniden tema uyguluyor. Fakat canlı
  test yapılmadan mevcut hazır butonlar, sonradan eklenen butonlar, cevap katmanı
  butonları ve activity-level override kombinasyonlarının tamamının doğru davrandığı
  kanıtlanmış değil.
- Etki: TTKB açısından aynı role sahip butonların tek tip tipografi kullanması gereken
  kritik akışta regresyon kaçabilir.
- Önerilen düzeltme: Aşama 3 canlı testinde bu panel için özel senaryo koşulsun:
  font ailesi/punto/kalınlık/yazı rengi değiştir, hazır buton ekle, geri al/ileri al,
  preview aç, sonra SCORM export üzerinde aynı sonucu doğrula.
- Yapılan düzeltme: SCORM typed player, SCORM ile aynı önizleme ve eski React preview
  aksiyon butonları toplu font patch'ini alacak şekilde güncellendi. Canlı tıklama
  hâlâ ayrıca yapılmalı.

## İncelenen Dosya Grupları

- `src/features/editor-workspace/right/panels/DesignRightPanel.jsx`
- `src/features/editor-workspace/right/panels/TtkbComplianceRightPanel.jsx`
- `src/features/cevap/`
- `src/features/timeline/`
- `src/activity-types/custom-interaction/`
