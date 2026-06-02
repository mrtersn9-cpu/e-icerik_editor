# PDF Storyboard Import (Offline)

Bu belge komut satırındaki ek offline ayrıştırıcıyı anlatır. Editör içinde ayrıca `src/PdfCleanStudio.jsx` ile tam ekran PDF düzenleme stüdyosu ve `src/utils/pdfActivityIntegration.js` ile etkinlik entegrasyonu bulunur.

Komut satırı aracı e-öğrenme storyboard PDF'lerini **offline** okuyup temizler ve editöre uyumlu `storyboard_config.json` üretir. Bulut bağlantılı PDF analizi kullanılmaz.

## Klasör Yapısı

```text
scripts/
  pdf-storyboard/
    parse-storyboard-pdf.mjs   # CLI giriş noktası
    pdf-extractor.mjs          # pdfjs-dist ile koordinatlı metin çıkarımı
    parser-utils.mjs           # etkileşim algılama + JSON üretimi

data/
  pdf-output/                  # oluşan geçici JSON/PDF çıktıları
```

## Kurulum

```bash
npm install pdfjs-dist pdf-lib
```

veya doğrudan:

```bash
npm install
```

## package.json script'leri

```json
{
  "scripts": {
    "pdf:storyboard": "node scripts/pdf-storyboard/parse-storyboard-pdf.mjs",
    "pdf:storyboard:help": "node scripts/pdf-storyboard/parse-storyboard-pdf.mjs --help"
  }
}
```

## Kullanım

```bash
npm run pdf:storyboard -- --input "./data/ornek-storyboard.pdf" --outDir "./data/pdf-output"
```

İstersen maskeyi kapatabilirsin:

```bash
npm run pdf:storyboard -- --input "./data/ornek-storyboard.pdf" --outDir "./data/pdf-output" --no-mask
```

## Üretilen Dosyalar

- `storyboard_config.json` → editörün okuyacağı yapılandırma
- `output_cleaned.pdf` → noktalı alanları temizlenmiş PDF
- `raw_pages_debug.json` → koordinatlı debug çıktısı

`data/pdf-output-*` klasörleri geçici çalışma çıktısıdır. Kaynak kod belgesi veya kalıcı proje verisi gibi kullanılmamalıdır.

## D/Y tablo okuma algoritması

Bu betik tablo satırlarını kaydırmamak için şu yöntemi kullanır:

1. PDF text item'ları `x/y/width/height` ile alınır.
2. Yakın `y` değerine sahip token'lar tek satırda gruplanır.
3. Satır içindeki token'lar `x` eksenine göre sıralanır.
4. `Yargılar / D / Y` başlık satırından **D** ve **Y sütun merkezleri** bulunur.
5. Her içerik satırında, bu sütun merkezlerine en yakın işaret/glyph bulunarak doğru cevap eşlenir.

Bu yaklaşım, sadece düz metin birleştirmeye göre çok daha kararlı sonuç verir.
