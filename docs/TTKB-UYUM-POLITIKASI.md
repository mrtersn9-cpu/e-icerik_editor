# TTKB Uyum Politikasi

Bu repo icin SCORM ciktisi, ogrenci onizlemesi ve export edilen HTML dosyalari TTKB incelemesine gidebilecek resmi ogrenci materyali kabul edilir. Editorun ic araclari daha esnek olabilir; fakat ogrencinin veya TTKB'nin gorecegi her ekran bu politikaya uymalidir.

Kaynak seti:

- `C:\Users\onur\Downloads\d6b3ba8b-365e-42a6-96af-bd9e92a2e6a6.docx`
- `C:\Users\onur\Downloads\d6b3ba8b-365e-42a6-96af-bd9e92a2e6a6.pdf`
- `C:\Users\onur\Downloads\725f5e3e-46c6-4715-b70b-b5aac6c7ab6c.docx`
- `C:\Users\onur\Downloads\725f5e3e-46c6-4715-b70b-b5aac6c7ab6c.pdf`
- Resmi elektronik icerik kriterleri: `https://ttkb.meb.gov.tr/kriter/`

## Genel Kapsam

TTKB uyumu sadece font, renk ve punto degildir. SCORM tarafinda su basliklar birlikte korunmalidir:

- Anayasa, kanunlar, milli egitim ilkeleri, esitlik, kapsayicilik, cocuk haklari, guvenli ve etik icerik, KVKK, reklam yasagi, telif ve kaynak gosterimi.
- Bilimsel dogruluk, kavram/terim/sembol tutarliligi, guncellik, kaynakli bilgi, metin-gorsel-ses uyumu.
- Ogretim programi, sinif seviyesi, hazir bulunusluk, ogrenme ciktilari, surec bilesenleri, degerler, beceriler ve kapsam sinirlarina uygunluk.
- Olcme-degerlendirme ilkeleri, net yonerge, dogru cevap tutarliligi, ipucu vermeyen secenekler, ogrenci seviyesine uygun zorluk ve geri bildirim.
- Dil ve anlatim, yazim, noktalama, terim kullanimi, anlasilirlik, akicilik ve hedef yas grubuna uygun uslup.
- Gorsel tasarim, sayfa/ekran duzeni, hiyerarsi, renk, kontrast, tipografi, gorsel kalite, okunabilirlik, estetik ve bilissel yuk dengesi.
- Elektronik icerik tasarimi, arayuz, kullanilabilirlik, erisilebilirlik, coklu platform uyumu, link ve buton calisirliligi, guvenlik, guncellik.
- Ses, video, animasyon ve efektlerin netligi, senkronu, pedagojik amaci ve dikkat dagitmama ilkesi.

## Degistirme Kurallari

Kod veya paket degistiren her ajan su kurallari uygular:

- Her SCORM/onizleme/ogrenci runtime etkileyen is sonunda TTKB risk taramasi yapilir ve sonuc kullaniciya bildirilir.
- TTKB riski gorulurse, konu istenen degisiklik disinda olsa bile "TTKB riski" olarak raporlanir.
- Risk yoksa final notunda "TTKB taramasinda yeni ogrenci-yuzu riski bulunmadi" denir.
- TTKB duzeltmeleri SCORM'a veya onizlemeye ozel ayri katman olarak yapilmaz. Editor veri modeli, editor kontrolleri ve editor presetleri TTKB uyumlu hale getirilir; onizleme ve SCORM editorun urettiği ayni sonucu gosterir.
- Sistem yalniz SCORM 1.2 paket standardini destekler. SCORM 2004, xAPI, cmi5, LTI veya standalone ogrenci paketi modu editor tarafinda acilmaz.
- Dis link ve embed kullanimi gerekli olabilir; yasak degildir. Ancak SCORM ciktisi alinirken pakette dis HTTP/HTTPS baglanti varsa kullaniciya TTKB/KVKK/telif kontrol uyarisi verilir.
- Buton animasyonu paket seviyesinde belirlenir. Ayni tasarim paketindeki tum butonlar ayni TTKB-guvenli hover/press hareket profilini kullanir; ayni paket icinde birbirinden kopuk buton animasyonlari kullanilmaz.
- Etkinlik seviyesinde animasyon profili degistirilebilir. Bu durumda secili paketin renk/gorsel sistemi korunur, ancak etkinlikteki tum butonlar ayni yeni animasyon profilini alir.
- Ogrenciye gorunen herhangi bir metin eklenirse dil, anlatim, seviye, terim ve yazim kontrolu yapilir.
- Yapay zeka ile uretilen metin/gorsel/video materyali kullaniliyorsa kaynak ve yapay zeka uretimi notu gerektirebilecek alanlar dikkate alinir.
- Buton, ikon, popup, layer, menu, feedback, drag-drop ve tiklama davranislarinda ayni islev ayni gorsel dil ile verilir.
- Ogrenciye gorunen buton yazilari tek satirda kalir; buton metninin alt satira dusmesi, kirpilmesi veya okunamaz hale gelmesi TTKB riski kabul edilir ve tema/paket uretiminde font boyutu ya da buton genisligi buna gore guvenli ayarlanir.
- Dogru/yanlis/uyari/cozum geri bildirimlerinde yalniz renk kullanilmaz; metin ve semantik ikon da bulunur.
- Correct ikonu `✓`, Incorrect ikonu `×`, uyari ikonu `!`, cozum ikonu `✎`, menu ikonu `☰`, ana sayfa ikonu `⌂`, yeniden baslat ikonu `↻` olur.
- Popup acildiginda base layer etkilesimleri popup uzerine sizmaz; cursor, drag-drop, hover, click ve z-index davranisi layer hiyerarsisine uygun olur.
- Arka plan karartmasi cevap kontrolunu engelleyecek kadar kapali olmaz; popup ise seffaf kalip okunurlugu bozmaz.
- Renk paketleri secildiginde Normal, Correct, Incorrect ve Menu layerlari otomatik ayni TTKB-guvenli tasarim politikasina uyarlanir.
- Neon, asiri parlama, sert golge, asiri buyuk/kucuk punto, karisik font, goz yoran renk ve dekoratif kalabalik SCORM tarafinda kullanilmaz.
- Tum linkler, butonlar, tetikleyiciler, katman gecisleri, SCORM baslangici, yeniden baslatma, cozum gosterme ve kontrol akisi test edilir.

## Kabul Kontrol Listesi

Bir degisiklik tamamlanmadan once asgari kontrol:

- Icerik mevzuata, esitlik ve kapsayicilik ilkelerine aykiri unsur icermiyor.
- Bilgi, kavram, terim, sembol, cevap ve geri bildirimlerde hata yok.
- Etkinlik ilgili sinif duzeyi ve ogrenme ciktilariyla uyumlu.
- Olcme etkinligi net, tek anlamli, ipucu vermeyen ve cevaplanabilir durumda.
- Metinler okunakli; ayni tur metinlerde punto/renk/font sistemi tutarli.
- Gorseller net, gerekli, metinle uyumlu ve okuma akisina engel degil.
- Renkler ve kontrast okunabilir; bilgi sadece renkle aktarilmiyor.
- Ses/video varsa net, senkron, dikkat dagitmadan ogrenmeyi destekliyor.
- SCORM/preview tarafinda buton, ikon, popup, layer ve trigger davranislari calisiyor.
- Guvenlik, KVKK, telif, kaynakca, reklam ve dis baglanti riskleri kontrol edildi.
