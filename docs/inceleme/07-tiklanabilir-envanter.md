# 07 — Tıklanabilir Öge Envanteri

Bu tur otomatik statik taramadır; canlı tıklama testi değildir.

- Aranan kalıplar: `onClick`, `onDoubleClick`, `onMouseDown`, `onContextMenu`,
  `onDragStart`, `onDrop`, `onChange`, `onKeyDown`, `<button`, `<Button`,
  `role="button"`
- Toplam ham eşleşme: 1726

## Kritik Test Listesi — Tasarım / Stiller / Buton Setleri

- [ ] `DesignRightPanel` — Buton yazı rengi hızlı renkleri — `src/features/editor-workspace/right/panels/DesignRightPanel.jsx:515` — seçilen renk hazır buton yazı rengine topluca uygulanmalı — Sağ panel / Tasarım / Buton Setleri
- [ ] `DesignRightPanel` — Buton yazı rengi özel picker — `src/features/editor-workspace/right/panels/DesignRightPanel.jsx:545` — özel renk tüm hazır butonlara uygulanmalı — Sağ panel / Tasarım / Buton Setleri
- [ ] `DesignRightPanel` — Temaya bırak — `src/features/editor-workspace/right/panels/DesignRightPanel.jsx:552` — yazı rengi kilidi kalkmalı ve tema kontrastı geri dönmeli — Sağ panel / Tasarım / Buton Setleri
- [ ] `DesignRightPanel` — Toplu font ailesi — `src/features/editor-workspace/right/panels/DesignRightPanel.jsx:575` — font ailesi mevcut/yeni hazır butonlara uygulanmalı — Sağ panel / Tasarım / Buton Setleri
- [ ] `DesignRightPanel` — Toplu punto — `src/features/editor-workspace/right/panels/DesignRightPanel.jsx:585` — punto 10-32 aralığında tüm hazır butonlara uygulanmalı — Sağ panel / Tasarım / Buton Setleri
- [ ] `DesignRightPanel` — Toplu kalınlık — `src/features/editor-workspace/right/panels/DesignRightPanel.jsx:596` — kalınlık tüm hazır butonlara uygulanmalı — Sağ panel / Tasarım / Buton Setleri
- [ ] `DesignRightPanel` — Fontu temaya bırak — `src/features/editor-workspace/right/panels/DesignRightPanel.jsx:601` — font override alanları temizlenmeli — Sağ panel / Tasarım / Buton Setleri
- [ ] `DesignRightPanel` — Hazır buton kartı — `src/features/editor-workspace/right/panels/DesignRightPanel.jsx:622` — seçilen preset sahneye eklenmeli ve toplu font ayarını almalı — Sağ panel / Tasarım / Buton Setleri

## En Yoğun Etkileşim Dosyaları

- [ ] `PreviewComponents` — 87 eşleşme — önizleme/oynatıcı davranışları — `src/components/preview/PreviewComponents.jsx`
- [ ] `PreviewExtraFlows` — 60 eşleşme — ek önizleme akışları — `src/components/preview/PreviewExtraFlows.jsx`
- [ ] `PreviewPuzzleFlow` — 27 eşleşme — bulmaca önizleme akışı — `src/components/preview/PreviewPuzzleFlow.jsx`
- [ ] `EditorTopBar` — 27 eşleşme — üst araç çubuğu — `src/components/ribbon/EditorTopBar.jsx`
- [ ] `TasarimRibbon` — 23 eşleşme — tasarım ribbon kontrolleri — `src/components/ribbon/tabs/TasarimRibbon.jsx`
- [ ] `DesignRightPanel` — 30 eşleşme — sağ panel tasarım/stiller — `src/features/editor-workspace/right/panels/DesignRightPanel.jsx`
- [ ] `FormatRightPanel` — 63 eşleşme — sağ panel biçim kontrolleri — `src/features/editor-workspace/right/panels/FormatRightPanel.jsx`
- [ ] `LibraryWorkspace` — 49 eşleşme — kütüphane çalışma alanı — `src/features/library/LibraryWorkspace.jsx`
- [ ] `StageCanvas` — 32 eşleşme — sahne seçme/sürükleme/bağlam davranışları — `src/logic/StageCanvas.jsx`
- [ ] `PdfCleanStudio` — 140 eşleşme — PDF temizleme/stüdyo alanı — `src/PdfCleanStudio.jsx`

## Not

Bu envanter tam canlı test listesi değildir; ham tarama sonuçlarının panel panel temizlenip
kullanıcıya görünen etiketlere dönüştürülmesi gerekir. Öncelik, öğrenciye görünen
önizleme/SCORM ve hazır buton toplu font akışı olmalıdır.

