# 09 — Görsel Bulgular

## Tur 2c — Editör canlı görsel + Aşama 3 buton tarama (2026-06-15, güncel)

Playwright ile editör canlı sürüldü (login + gezinti + 12 buton tıklama):
- **0 konsol hatası, 0 sayfa hatası** — tüm oturum düzeltmeleri + slug değişikliği sonrası regresyon yok.
- **Okunabilir URL (slug) canlı doğrulandı:** giriş sonrası hash
  `#/publisher/test~p1/book/10-edebiyat~mng3td985gh5v/activity/1~mng3tgvg87na8`.
- **1920×1080 kütüphane** (`ed-masaustu-1920x1080.png`): 3 sütun (yayınevi/kitap/etkinlik) temiz,
  taşma/üst üste binme yok.
- **Taze mobil editör 390×844** (`ed-mobil-taze-390.png`): mobil kabuk (üst bar, kanvas, alt araç
  çubuğu Araçlar/Özellikler/Sahneler/Metin/Buton) düzgün; **yatay taşma YOK** (scrollWidth=clientWidth=390).
- **Yanlış alarm elendi:** Viewport'u masaüstünden mobil/1024'e *resize* edince panel sola kayık/kırpık
  görünüyordu; **taze yüklemede sorun yok** → resize artefaktı, gerçek responsive bug değil.
  (Not: editör state'i viewport değişiminde yeniden konumlanmıyor olabilir — düşük öncelikli; pencere
  boyutu canlıyken nadiren değişir.)

**Kapsanmayan (sonraki tur):** her etkinlik tipiyle dolu sahnede TTKB görsel kuralları (tek-satır
buton, kontrast, popup karartması) görüntü üzerinde piksel doğrulaması; 1366/1024 *taze* yükleme.

---

**Tur 2 (ilk, 2026-06-15):** Playwright/Chromium ile ekran görüntüleri alındı:
`docs/inceleme/ekran-goruntuleri/`. Üç çözünürlük: 1920×1080, 1366×768, 390×844 (mobil).

> Sınır: Çözünürlük görüntüleri **önizleme modalı açıkken** alındı (editörün kendisi farklı
> boyutlarda ayrıca taranmalı). Boş proje / her etkinlik tipi / tüm paneller-açık kombinasyonları
> ve 1024×768 bu turda kapsanmadı — kısmi.

## Görüntü Değerlendirmesi

| Görüntü | Değerlendirme |
|---|---|
| `02-giris-sonrasi.png` (editör 1920×1080) | **Temiz.** Üst şerit, sol "Etkinlik Haritası", merkez sahne (dolu örnek), sağ "Etkinlik Kontrol Merkezi", alt zaman çizelgesi tutarlı. Taşma/üst üste binme görülmedi. |
| `03-onizleme.png` (önizleme 1920×1080) | **Temiz.** "SCORM ile Aynı Önizleme" launch sayfası; "ETKİNLİK TANITIMI" (?) ve "ETKİNLİĞİ BAŞLAT" (▶) butonları okunaklı, Türkçe, semantik ikonlu, tek satır. |
| `10-dar-1366x768.png` | Önizleme modalı düzgün ölçekleniyor. |
| `10-mobil-390x844.png` | Önizleme modalı 16:9 sahneyi daraltıp ortalıyor; üst/alt geniş siyah letterbox. Beklenen davranış ama mobilde dikey boşluk fazla (UX notu). |

## Bulgular

### Orta — Mobilde önizleme sahnesi aşırı küçük + büyük dikey boşluk
- `10-mobil-390x844.png` — 16:9 sabit sahne dar viewport'a sığınca buton metinleri çok küçük
  kalıyor, üstte/altta geniş siyah alan oluşuyor. Öğrenci mobil cihazda kullanacaksa okunabilirlik
  zayıf. **Not:** Editörde ayrı bir mobil kabuk (`src/mobile/MobileEditorShell`) var; bu görüntü
  onu değil önizleme modalını gösteriyor. Mobil editör ayrıca görsel taranmalı.

### Bilgi — TTKB görsel kurallarının statik bulguları (kod tarafı)
Görsel kuralların kod-kaynaklı riskleri ilgili bölge raporlarında:
- Tam ekran karartma sabit 1000×600 eşiği (rapor 01, `buttonStyling.js:1021`) — sahne 1920×1080'de
  karartma yanlış stillenebilir.
- Paket gölge/neon kimliğinin `contrastSafeButtonStyle` ile ezilmesi (rapor 01, `colorUtils.js:74`).
- Çocuk buton presetlerinde neon gradient + çok katmanlı gölge (rapor 04, `editorConstants.js:748`)
  TTKB parlama/bilişsel-yük kuralına aykırı olabilir.
- Türkçe karakter / yazım eksikleri öğrenci-yüzü metinde (rapor 01, `activityScoring.js:87`).

## Kapsanmayanlar (sessizce atlanmadı)

- Editör + her etkinlik tipi dolu proje, tüm paneller/popover/diyalog açıkken görsel tarama.
- 1024×768; editörün kendisi (önizleme modalı değil) dar/mobil boyutlarda.
- Türkçe karakter render'ının (ş/ğ/İ/ı) görüntü üzerinde piksel doğrulaması — kod tarafında
  metin eksikleri bulundu ama görüntüde teyit edilmedi.
- Önizlemenin "tam ekran karartma + popup okunabilirliği" senaryosu (kod riski var, görsel test yok).
