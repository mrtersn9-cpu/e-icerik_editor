# 08 — Canlı İşlev Test Bulguları

**Tur 2 (2026-06-15):** Playwright 1.61 + Chromium kuruldu (`--no-save`); editör canlı sürüldü.
Bu bir **duman testi (smoke test)**: editör yüklendi, giriş yapıldı, önizleme açıldı, konsol/
sayfa hataları izlendi, 3 çözünürlükte ekran görüntüsü alındı. Envanterdeki her ögenin tek tek
tıklanması bu turda yapılmadı (bkz. "Test Edilemeyenler").

Script: `scripts/_inceleme_canli_test.mjs` · Görüntüler: `docs/inceleme/ekran-goruntuleri/`

## Sonuçlar

| Kontrol | Sonuç |
|---|---|
| Sayfa yükleme (localhost:3000) | [x] GEÇTİ — açıldı |
| Giriş (kullanici1 / dev şifre) | [x] GEÇTİ — editöre girildi |
| Editör render | [x] GEÇTİ — body 14.775 karakter, **109 buton**, 119 tıklanabilir öge |
| Konsol hataları | [x] GEÇTİ — **0 konsol hatası** |
| Sayfa hataları (pageerror) | [x] GEÇTİ — **0 sayfa hatası** |
| Önizleme açma ("Önizle") | [x] GEÇTİ — açıldı, **0 yeni hata**, çöküş izi YOK |
| 3 çözünürlük ekran görüntüsü | [x] GEÇTİ — masaüstü/dar/mobil alındı |

## Önemli: "B-101 önizleme çöküşü" CANLI TESTTE ÇÜRÜTÜLDÜ

Statik incelemede `previewEngine.js`/`PreviewComponents.jsx`'in `timeline`'dan var olmayan
export import etmesi "Kritik — önizleme çöker" olarak işaretlenmişti. Canlı test:
- Editör + önizleme **sıfır hatayla** açıldı; `getCanvasObjects/undefined is not a function`
  izi yok.
- Neden: `PreviewComponents.jsx` **ölü/yetim dosya** (hiçbir yerden import edilmiyor); canlı
  önizleme `storyline-preview`'dan geliyor. Ayrıntı rapor 01 B1-O0.
- Önizleme ekranı (`03-onizleme.png`) "SCORM ile Aynı Önizleme" başlığıyla launch sayfasını
  ("ETKİNLİK TANITIMI" + "ETKİNLİĞİ BAŞLAT", semantik ikonlu) temiz gösterdi.

## Statik İncelemeden Gelen, Canlı Doğrulama Bekleyen İşlev Riskleri

Aşağıdakiler kod incelemesinde bulundu; tek tek canlı tıklama testinde önceliklidir:

- **Bulmaca üreteçleri çökme** (rapor 01 B1-Y3/Y4): 3×3 gridde 5 harfli kelime / çift boyutlu
  labirent → editör çökmesi / çözülemez etkinlik. Canlı tekrar üretilmeli.
- **SCORM tamamlama** (rapor 04): wordsearch/maze/memory'de "Kontrol Et" yok → etkinlik bitmiyor.
  Gerçek SCORM paketinde test edilmeli.
- **Kilitli hedef sağ tık menüsü** (rapor 01 B1-Y7): yanlış nesne siliniyor. Canlı sahnede test.
- **Bul-Değiştir slayt nesnelerini atlıyor** (rapor 02 B2-Y7): "0 eşleşme" yanlış sonucu.
- **Karma etkinlik tip değişimi** (rapor 03 B3-Y): öğe cevapsız çıkmaza giriyor.
- **MixedActivityEditor çökme** (rapor 02 B2-Y4): mixed answer panel render'ı.

## Test Edilemeyenler (sessizce atlanmadı)

- **Envanterdeki 109 butonun tek tek işlev testi:** Bu turda yapılmadı (envanter `07`'de ham;
  her ögeye tıklayıp "vaadettiği işi yapıyor mu" doğrulaması ayrı bir oturum işi).
- **Etkinlik tipi bazlı testler:** Her etkinlik tipinden örnek proje kurup bulmaca/eşleştirme/
  sürükle-bırak akışları canlı denenmedi (mevcut açık proje üzerinden duman testi yapıldı).
- **Gerçek SCORM zip çevrimdışı test:** Paket üretip tarayıcıda çevrimdışı ağ trafiği izleme
  yapılmadı (rapor 10'da KESİN KURAL statik olarak doğrulandı; canlı ağ testi açık).

> Sonraki tur: envanteri panel panel canlı sür (kılavuz Aşama 3), her etkinlik tipinden örnek
> içeren proje oluştur.
