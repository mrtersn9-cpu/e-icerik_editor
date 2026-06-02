# Markdown Dosyaları Analizi

İnceleme tarihi: 2026-06-01

## Kapsam

Depoda inceleme öncesinde Git tarafından izlenen 11 Markdown dosyası vardı. Ayrıca `yedekler/` altında 45 Markdown kopyası bulundu. `yedekler/` Git tarafından yok sayıldığı için bu kopyalar yaşayan dokümantasyon değildir; geri yükleme arşivlerinin parçasıdır.

## Güncel Belge Seti

| Dosya | Karar | Gerekçe |
| --- | --- | --- |
| `AGENTS.md` | Koru | TTKB odaklı bağlayıcı ajan politikası. |
| `SISTEM-REHBERI.md` | Yeni ana giriş | Güncel mimariyi, akışları ve riskleri tek yerde toplar. |
| `CHANGELOG.md` | Koru | `kaydet.ps1` tarafından otomatik güncellenen tarihsel kayıt. Teknik doğruluk kaynağı değildir. |
| `FTP-KURULUM.md` | Güncellendi | `api/config.php` artık deploy paketine alınmıyor; sunucuda ayrıca korunuyor. |
| `GIT-AKISI.md` | Güncellendi | `origin` tanımlı ve script aktif dalı push ediyor. Eski ilk kurulum notları kaldırıldı. |
| `GUVENLIK-AYARLARI.md` | Güncellendi | Node.js + SQLite ile FTP/PHP + MySQL güvenlik ayarları ayrıldı. |
| `PDF-STORYBOARD-IMPORT.md` | Güncellendi | CLI aracının yanında editör içi PDF stüdyosu ve geçici çıktı klasörleri belirtildi. |
| `docs/TTKB-UYUM-POLITIKASI.md` | Koru | Öğrenci yüzü çıktıların temel uyum politikası. |
| `docs/UI_DIL_REHBERI.md` | Koru | Editör arayüzü terimlerinin tutarlılık kaynağı. |
| `docs/EICERIK_WIDGET_SDK.md` | Güncellendi | ZIP import artık mevcut; SCORM widget paketleme engeli açıkça yazıldı. |
| `docs/MD-DOSYALARI-ANALIZI.md` | Yeni rapor | Bu envanter ve temizlik kararlarını kayda alır. |

## Kaldırılan Belgeler

| Dosya | Neden kaldırıldı |
| --- | --- |
| `docs/REFACTOR-PLAN.md` | `src/logic/` klasörünü boş ve `EIcerikEditor.jsx` dosyasını 26.783 satır gösteriyordu. Güncel durumda `src/logic/` dolu, ana dosya yaklaşık 8.700 satır ve planın önemli bölümü gerçekleşmiş durumda. |
| `.github/agents/preview-editor-modifier.agent.md` | Tek seferlik eski görev tarifiydi. Güncel sistem rehberi veya tekrar kullanılabilir ajan politikası değildi. |

## Kodla Çapraz Kontrolde Bulunan Uyuşmazlıklar

1. Eski widget SDK belgesi ZIP importu gelecek faz gibi anlatıyordu. Güncel kodda `src/widgets/widgetZipParser.js` ve `src/components/SelectionPanels.jsx` üzerinden ZIP yükleme mevcut.
2. Widget SCORM paketleme tamamlanmış sayılmamalı. `src/utils/scormExport.js` içinde widget dosyaları hazırlanıyor, ancak nihai ZIP listesine eklenmiyor.
3. Eski FTP belgesi `ftp-hosting/api/config.php` dosyasını pakete koyacakmış gibi okunabiliyordu. Güncel `hazirla-ftp.ps1`, config dosyasını bilinçli olarak deploy dışı bırakıyor.
4. Eski Git belgesi remote olmadığını söylüyordu. Güncel depoda `origin` tanımlı.
5. Güvenlik belgesi yalnız Node.js sunucusunu anlatıyordu. Canlı FTP/PHP ortamı farklı config ve veri katmanı kullandığı için ayrıştırıldı.
6. `ftp-hosting/api/index.php` içinde eski SCORM 2004 yardımcı kodu duruyor. Dışa aktarım endpointleri kapalı olsa da ürün kuralıyla uyumsuz miras kod olarak ayrı temizlik işi gerektiriyor.

## Yedek Klasörleri

`yedekler/` altındaki Markdown kopyaları silinmedi. Bunlar geri yükleme amacıyla üretilen arşivlerin parçalarıdır ve Git tarafından izlenmez. Güncel bilgi aranırken kökteki belgeler ile `docs/` klasörü kullanılmalıdır.
