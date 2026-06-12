# 02 — UI Bileşenleri İncelemesi

Kapsam: `src/components/`, `src/widgets/`, kökteki `AnswerPanel.jsx`,
`LayerPanel.jsx`, `RightPanelShell.jsx`, `index.jsx`

## Bulgular

Bu bölgede bu ilk statik turda doğrudan çökme/veri kaybı seviyesinde yeni bir bulgu
tespit edilmedi. Ancak öğrenciye görünen önizleme tarafında hazır buton toplu font
akışının yalnızca belirli preview flow'lara uygulanması nedeniyle kapsam riski var;
asıl davranış bulgusu rapor 04'te B-001 olarak birleştirildi.

### Orta — Önizleme kapsaması sınırlı görünüyor

- Durum: Düzeltildi (commit atılmadı); canlı görsel test önerilir.
- Dosya:satır: `src/components/preview/PreviewComponents.jsx:1773`,
  `src/components/preview/PreviewComponents.jsx:3202`
- Sorun: `getReadyButtonTextStylePatch(activity)` iki ayrı preview flow içinde
  kullanılıyor, ancak otomatik taramada diğer preview dosyaları (`PreviewExtraFlows.jsx`,
  `PreviewPuzzleFlow.jsx`, `StorylineScormPlayerPreview.jsx`) için aynı hazır buton
  font patch'inin görünür kullanımı bulunmadı.
- Etki: Editör/preview içinde bazı akışlar toplu font ayarını gösterirken bazıları
  eski tipografiyle kalabilir. Canlı Playwright geçişi yapılmadan tüm flow'lar için
  kesin karar verilemez; bu nedenle birleşik raporda B-003 olarak test boşluğu/risk
  şeklinde tutuldu.
- Önerilen düzeltme: Preview flow'ların tamamında hazır buton üreten ortak helper
  veya ortak stil kaynağı kullanılsın; en azından seçim, sürükle-bırak, puzzle,
  fill-blank, hotspot ve sequence preview'larında görsel test eklensin.
- Yapılan düzeltme: Eski React preview flow'larındaki öğrenci aksiyon butonları
  `getReadyButtonTextStylePatch()` tabanlı ortak helper'a bağlandı. SCORM ile aynı
  önizleme zaten SCORM HTML player yolunu kullandığı için typed player düzeltmesini
  doğrudan alıyor.

## İncelenen Dosya Grupları

- `src/components/preview/PreviewComponents.jsx`
- `src/components/preview/PreviewExtraFlows.jsx`
- `src/components/preview/PreviewPuzzleFlow.jsx`
- `src/components/preview/StorylineScormPlayerPreview.jsx`
- `src/components/ribbon/useRibbonController.js`
- `src/components/ribbon/FontPicker.jsx`
- `LayerPanel.jsx`
- `RightPanelShell.jsx`
- `index.jsx`
