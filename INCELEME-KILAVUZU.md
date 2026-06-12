# Sistem İnceleme Kılavuzu — Fable 5 ile Eksiksiz Denetim

Bu kılavuz, sistemin **tamamını** (kod kalitesi + çalışmayan/yanlış çalışan tıklanabilir
ögeler + görünüm bozuklukları) Fable 5'e inceletmek için hazırlanmıştır.
Aşağıdaki prompt'ları sırasıyla, **her aşamayı ayrı bir oturumda** kopyala-yapıştır
yaparak kullan.

---

## Neden tek komutla olmaz?

"Her şeyi incele, hiçbir şeyi atlama" tek başına yüzeysel sonuç verir çünkü:

- Proje büyük (src/ altında ~300 dosya + PHP backend + SCORM şablonları).
  Tek oturumun bağlam penceresine sığmaz; model "örnekleyerek" bakar, atlamalar olur.
- Kod incelemesi, tıklama testi ve görsel denetim **farklı çalışma biçimleri** ister
  (statik okuma / tarayıcı sürme / ekran görüntüsü karşılaştırma).

Çözüm: **Aşamalı inceleme + her aşamanın sonucunu dosyaya yazdırmak.**
Raporlar `docs/inceleme/` klasöründe birikir; her yeni oturum önceki raporları okuyarak
kaldığı yerden devam eder. Böylece hiçbir bulgu kaybolmaz ve tamlık denetlenebilir olur.

### Altın kurallar

1. **İnceleme/test prompt'larının (Aşama 1-5) başına `ultracode` yaz.** Bu kelime
   çok-ajanlı derin tarama modunu açar: onlarca alt-ajan paralel çalışır, bulgular
   ikinci bir ajan grubu tarafından "gerçekten hata mı?" diye doğrulanır. Token
   tüketimi yüksektir ama tamlık için şart. Aşama 0 (plan oluşturma) ve Aşama 6
   (rapor birleştirme/düzeltme) gibi hazırlık-sentez prompt'ları `ultracode`
   gerektirmez. Prompt'lardaki yedek cümle sayesinde bu mod tanınmazsa bile aynı
   iş tek oturumda sistematik dosya listesiyle yapılır.
2. **Her prompt TTKB politikasını okutarak başlar.** AGENTS.md ve
   docs/TTKB-UYUM-POLITIKASI.md her aşamada önce okunur; öğrenciye görünen önizleme,
   dışa aktarılan HTML ve SCORM çıktısı TTKB denetimine girecek materyal kabul edilir.
3. **KESİN KURAL — SCORM çıktısında dış link yasağı:** Kullanıcı içeriğe manuel
   olarak eklemedikçe, dışa aktarılan SCORM paketi (içindeki HTML ve öğrenci
   oynatıcısı dahil) hiçbir dış kaynaktan bir şey çekemez (CDN, font, ikon,
   analytics, embed, tracking ve fallback yolları dahil); tüm varlıklar export
   sırasında pakete gömülür/yerelleştirilir. Pakete sızan kod kaynaklı her dış
   istek politika ihlalidir. Editör uygulamasının kendi dış kaynakları bu
   kuralın DIŞINDADIR — orası bizim alanımız, serbest (yine de güvenlik/gizlilik/
   çevrimdışı çalışma riski olarak bilgi notuna girer). Kullanıcının manuel
   eklediği linkler için de SCORM export'ta TTKB/KVKK/telif uyarısı verilmelidir.
4. **Her aşama = yeni oturum.** Önceki oturumun raporu dosyada olduğu için bağlam kaybolmaz.
5. **Kapsam dışı dizinleri her prompt'ta belirt** (aşağıdaki prompt'larda hazır):
   `node_modules/`, `yedekler/`, `build/`, `temp_bulmaca/`, `tmp_bulmaca_inceleme/`,
   `GERI-YUKLEME-ICIN/`, `data/` gibi üretilmiş/yedek içerikler. `public/fonts/`
   kod incelemesi için kapsam dışıdır; ancak font referanslarının yerel dosyaya
   çözüldüğü ve SCORM paketine gömüldüğü Aşama 4/5'te kontrol edilir.
6. **İncelemeden önce temiz commit at — ama körlemesine değil.** Önce `git status` ile
   değişiklikleri gözden geçir; gizli bilgi, build çıktısı, zip/büyük dosya veya geçici
   dosya yoksa commit at. `git add -A` doğrudan kullanma — şifre, yedek veya temp
   dosyaları yanlışlıkla commit'e girebilir.
7. **Gizli bilgiler rapora yazılmaz.** İnceleme sırasında API anahtarı, token, FTP
   şifresi gibi bir değer bulunursa raporda yalnızca dosya:satır ve risk türü yer alır,
   değerin kendisi asla yazılmaz. URL içinde token/key/session gibi query parametresi
   geçiyorsa o değer de maskelenir.
8. İnceleme aşamalarında Fable 5 **sadece okur ve rapor yazar**, kod değiştirmez.
   Düzeltmeler en sonda, rapor üzerinden ayrı oturumlarda yapılır (Aşama 6).

---

## Aşama 0 — Hazırlık (sen yapıyorsun, 2 dakika)

1. `git status` ile değişiklikleri kontrol et. Gizli bilgi, build çıktısı, zip/büyük
   dosya veya geçici dosya yoksa dosyaları **seçerek** ekleyip commit at
   (örn. `git add src/ docs/; git commit -m "Inceleme oncesi durum"`).
   Listede şüpheli bir şey varsa önce onu temizle, `git add -A` kullanma.
2. Uygulamanın açıldığını doğrula: `npm start` → editör tarayıcıda açılıyor mu?
3. İlk oturuma şu prompt'la başla:

```
Önce AGENTS.md ve docs/TTKB-UYUM-POLITIKASI.md dosyalarını oku.

docs/inceleme/ klasörünü oluştur ve içine 00-PLAN.md dosyası yaz. Bu dosyada:
sistemin inceleme aşamalarını (kod incelemesi bölge bölge, tıklanabilir öge envanteri
ve testi, görsel denetim, çapraz kontroller, birleşik rapor) ve her aşamanın
durum takibini (Bekliyor/Devam/Bitti) tablo halinde tut. Plana, tüm aşamalarda
geçerli iki kuralı not düş: (1) öğrenciye görünen önizleme/HTML/SCORM çıktısı
TTKB denetimine girecek materyal sayılır, (2) bulunan gizli bilgilerin değeri
raporlara asla yazılmaz. Henüz inceleme yapma, sadece plan dosyasını hazırla.
```

---

## Aşama 1 — Statik Kod İncelemesi (bölge bölge, 6 ayrı oturum)

Tüm kod tabanını tek seferde değil, **bölge bölge** incelet. Her bölge için aşağıdaki
şablonu kullan; `<BÖLGE>` ve `<RAPOR>` kısımlarını tablodan alarak doldur.

| # | Bölge (`<BÖLGE>`) | Rapor dosyası (`<RAPOR>`) | Odak |
|---|---|---|---|
| 1 | `src/store/ src/editor-logic/ src/logic/` | `01-durum-yonetimi.md` | Zustand durum yönetimi, undo/redo, yarış koşulları |
| 2 | `src/components/ src/widgets/` + kökteki `AnswerPanel.jsx LayerPanel.jsx RightPanelShell.jsx index.jsx` | `02-ui-bilesenleri.md` | Olay yöneticileri, props akışı, bellek sızıntıları |
| 3 | `src/activity-types/ src/features/` | `03-etkinlik-tipleri.md` | Etkinlik mantığı, puanlama, cevap doğrulama |
| 4 | `src/hooks/ src/utils/ src/api/ src/mobile/ src/constants/ src/theme/ src/styles/ src/generated/` | `04-altyapi.md` | Hook kuralları, yardımcı fonksiyonlar, mobil uyum; SCORM export/oynatıcı runtime'ını üreten dosyalara (`scormExport.js`, `scormTypedActivityPlayer.js`, `storylineRuntime.js`, `storylineRuntimeCore.js`) özellikle dikkat |
| 5 | `server.mjs dev.mjs scripts/` + `public/` (`fonts/` hariç; pakete girebilen `widgets/` ve `widget-sdk/` dahil) | `05-sunucu-araclar.md` | Dosya G/Ç, yol güvenliği, SCORM paketleme ve pakete giren şablon/varlıklar |
| 6 | `ftp-hosting/` (PHP) | `06-php-guvenlik.md` | SQL enjeksiyonu, yetkilendirme, dosya yükleme güvenliği |

Her oturumda kullanılacak şablon (örnek: bölge 1):

```
ultracode
(Çok-ajanlı derin inceleme modu destekleniyorsa etkinleştir. Desteklenmiyorsa
aynı işi tek oturum içinde sistematik dosya listesiyle yap.)

Önce AGENTS.md ve docs/TTKB-UYUM-POLITIKASI.md dosyalarını oku. Öğrenciye görünen
önizleme, dışa aktarılan HTML ve SCORM çıktısını TTKB denetimine girecek materyal
kabul et. Sonra docs/inceleme/00-PLAN.md ve varsa önceki raporları oku.

Görev: Kod tabanının şu bölgesini satır satır, eksiksiz incele: <BÖLGE>
node_modules/, yedekler/, build/, temp_bulmaca/, tmp_bulmaca_inceleme/,
GERI-YUKLEME-ICIN/ ve data/ kapsam DIŞIDIR.

Şunları ara:
- Gerçek hatalar: null/undefined erişimi, yanlış koşullar, unutulmuş await,
  yarış koşulları, sonsuz döngü/render riski, yanlış bağımlılık dizileri
- Olay yöneticisi sorunları: eklenen ama kaldırılmayan listener'lar,
  stale closure, çift tetiklenme
- Durum yönetimi: Zustand store'da tutarsız güncellemeler, undo/redo'yu
  bozan doğrudan mutasyonlar
- Hata yönetimi: yutulmuş hatalar, kullanıcıya hiç gösterilmeyen başarısızlıklar
- Dış bağlantılar — KESİN KURAL (SCORM çıktısı için): kullanıcı manuel eklemedikçe
  dışa aktarılan paket hiçbir dış kaynaktan bir şey çekemez. SCORM çıktısına veya
  öğrenci oynatıcısına girebilecek kodda dış kaynağa giden HER referansı tara —
  http://, https://, protokolsüz //, ftp://, ws://, wss:// ve harici domain içeren
  tüm URL'ler (CDN, font, ikon, analytics, embed, tracking, fallback yolları dahil)
  — ve en az Yüksek önemde raporla. Yalnızca editör arayüzünde kalan dış kaynaklar
  TTKB/SCORM ihlali DEĞİLDİR; ancak güvenlik, gizlilik ve çevrimdışı çalışma riski
  açısından bilgi notu halinde listele. Kullanıcının manuel eklediği
  içerik linkleri için SCORM export sırasında TTKB/KVKK/telif uyarısı veriliyor mu
  kontrol et — uyarıyı atlayan yol Kritik'tir
- Türkçe UI tutarlılığı: İngilizce kalmış kullanıcıya görünen metinler
- Ölü kod, kopyala-yapıştır tekrarları, tehlikeli TODO'lar

Her dosyaya bakılmış olmalı; incelediğin dosyaların tam listesini raporun sonuna ekle
ki atlanma olup olmadığı denetlenebilsin.

Bulguları docs/inceleme/<RAPOR> dosyasına yaz. Her bulgu için:
önem (Kritik/Yüksek/Orta/Düşük), dosya:satır, sorunun açıklaması,
önerilen düzeltme. Kod DEĞİŞTİRME, sadece raporla.

API anahtarı, token, FTP şifresi veya başka gizli bilgi bulursan DEĞERİNİ
rapora yazma; sadece dosya:satır ve risk türünü belirt. URL içinde token/key/
session gibi query parametresi geçiyorsa o değeri de maskele.

Bitince 00-PLAN.md'deki durum tablosunu güncelle.
```

> Not: PHP bölgesinde (6) prompt'a şunu ekle: *"Üretim ortamı paylaşımlı FTP hosting
> üzerinde PHP/MySQL'dir; OWASP Top 10 odaklı bak: SQL enjeksiyonu, XSS, CSRF,
> dosya yükleme atlatmaları, dizin gezinme (path traversal), zayıf oturum yönetimi."*

---

## Aşama 2 — Tıklanabilir Öge Envanteri (1 oturum)

İşlev testine geçmeden önce **neyin test edileceğinin tam listesi** çıkarılmalı.
Eksiksizliğin garantisi bu envanterdir.

```
ultracode
(Çok-ajanlı derin inceleme modu destekleniyorsa etkinleştir. Desteklenmiyorsa
aynı işi tek oturum içinde sistematik dosya listesiyle yap.)

Önce AGENTS.md ve docs/TTKB-UYUM-POLITIKASI.md dosyalarını oku. Öğrenciye görünen
önizleme, dışa aktarılan HTML ve SCORM çıktısını TTKB denetimine girecek materyal
kabul et.

Görev: src/ altındaki ve kökteki .jsx/.js/.tsx/.ts dosyalarında kullanıcıyla
etkileşen TÜM ögelerin envanterini çıkar: onClick, onDoubleClick, onMouseDown,
onContextMenu,
onDragStart/onDrop, onChange, onKeyDown ile bağlanmış her öge; tüm <button>,
menü, sekme, popover, sürükle-bırak hedefi, klavye kısayolu.
node_modules/, yedekler/, build/ kapsam dışı.

Sonucu docs/inceleme/07-tiklanabilir-envanter.md dosyasına kontrol listesi
(checkbox) formatında yaz. Her satır: [ ] Bileşen adı — öge/düğme adı
(kullanıcının gördüğü Türkçe etiket) — dosya:satır — beklenen davranış
(koddan çıkarımla 1 cümle) — hangi ekranda/panelde bulunduğu.

Panellere göre grupla (üst araç çubuğu, sol panel, sağ panel, zaman çizelgesi,
sahne, bağlam menüleri, diyaloglar, önizleme/oynatıcı, mobil görünüm).
Toplam öge sayısını başa yaz. Kod DEĞİŞTİRME.
```

---

## Aşama 3 — Canlı Tıklama Testi (2-4 oturum)

Bu aşamada Fable 5 uygulamayı gerçekten başlatıp tarayıcıyı sürerek her ögeye tıklar.
Bunun için Playwright kurulumuna **izin vermen** gerekir (ilk seferde bir kez
internet ister, sonrası çevrimdışı çalışır).

Envanter uzunsa panel panel böl: "üst araç çubuğu + sol panel" bir oturum,
"sağ panel + zaman çizelgesi" bir oturum, "sahne + bağlam menüleri + diyaloglar"
bir oturum, "önizleme/oynatıcı + SCORM çıktısı" bir oturum.

```
ultracode
(Çok-ajanlı derin inceleme modu destekleniyorsa etkinleştir. Desteklenmiyorsa
aynı işi tek oturum içinde sistematik kontrol listesiyle yap.)

Önce AGENTS.md ve docs/TTKB-UYUM-POLITIKASI.md dosyalarını oku. Öğrenciye görünen
önizleme, dışa aktarılan HTML ve SCORM çıktısını TTKB denetimine girecek materyal
kabul et.

Görev: docs/inceleme/07-tiklanabilir-envanter.md dosyasındaki şu bölümleri
canlı test et: <BÖLÜM ADLARI, örn. "üst araç çubuğu" ve "sol panel">

1. Uygulamayı npm start ile başlat (dev.mjs hem istemciyi hem sunucuyu açar).
2. Playwright ile (kurulu değilse kur) tarayıcıda editörü aç.
3. Test için her etkinlik tipinden en az bir örnek içeren bir proje oluştur
   veya mevcut örnek projeyi kullan. Boş proje ile dolu proje davranışlarını
   AYRI AYRI değerlendir.
4. Envanterdeki her ögeye sırayla tıkla/etkileşim kur ve beklenen davranış
   gerçekleşiyor mu doğrula. Sadece "hata fırlatmıyor" yetmez:
   düğmenin VAADETTİĞİ iş gerçekten oluyor mu kontrol et
   (örn. "Grupla" gerçekten grupluyor mu, geri al gerçekten geri alıyor mu).
5. Konsol hatalarını da izle; tıklama sırasında konsola düşen her hata bulgudur.
6. Öğrenciye görünen tarafta TTKB riski gördüğünde (bozuk düğme, etkileşim
   sızıntısı, popup altında tıklanabilir kalan katman, okunmaz metin) ayrıca
   "TTKB riski" etiketiyle işaretle.
7. Her test edilen ögeyi envanterde şu formatla işaretle:
   [x] GEÇTİ — kısa not
   [!] SORUNLU — sorunun bir cümlelik özeti
   [?] TEST EDİLEMEDİ — nedeni
8. Sorunları docs/inceleme/08-islev-test-bulgulari.md dosyasına ekle:
   öge, yeniden üretme adımları, beklenen vs gerçekleşen davranış,
   varsa konsol hatası, ekran görüntüsü yolu.

Test edilemeyen öge kaldıysa (örn. belirli bir etkinlik tipi gerektiriyor)
[?] olarak işaretle ve raporda "Test edilemedi + nedeni" başlığında topla;
sessizce atlama.
Kod DEĞİŞTİRME, sadece test et ve raporla.
```

---

## Aşama 4 — Görsel Bozukluk Taraması (1-2 oturum)

```
ultracode
(Çok-ajanlı derin inceleme modu destekleniyorsa etkinleştir. Desteklenmiyorsa
aynı işi tek oturum içinde sistematik kontrol listesiyle yap.)

Önce AGENTS.md ve docs/TTKB-UYUM-POLITIKASI.md dosyalarını oku. Öğrenciye görünen
önizleme, dışa aktarılan HTML ve SCORM çıktısını TTKB denetimine girecek materyal
kabul et; oradaki görsel/erişilebilirlik kuralları bu aşamanın denetim ölçütüdür.

Görev: Editörün ve önizleme/oynatıcının görsel denetimini yap.

1. Uygulamayı npm start ile başlat, Playwright ile aç.
2. Test için her etkinlik tipinden en az bir örnek içeren bir proje oluştur
   veya mevcut örnek projeyi kullan; boş proje ile dolu projeyi ayrı değerlendir.
3. Şu çözünürlüklerde ekran görüntüsü al ve görüntüleri bizzat inceleyerek
   bozukluk ara: 1920x1080, 1366x768, 1024x768; ayrıca mobil görünüm
   (src/mobile var, 390x844 dene).
4. Her ana ekran/panel için tekrarla: tüm paneller açıkken, popoverlar/diyaloglar
   açıkken, zaman çizelgesi doluyken, önizleme modunda.
5. Şunları ara: taşma (overflow) ve kırpılma, üst üste binen ögeler,
   yanlış z-index (popover'ın altta kalması), hizalama kaymaları,
   kaybolmuş/yüklenmemiş ikon ve fontlar (font referansları yerel dosyaya
   çözülmeli; editör tarafındaki dış istekler serbest — kesin kural SCORM
   çıktısı içindir ve Aşama 5'te paket üzerinde denetlenir), Türkçe
   karakterlerin (ş, ğ, İ, ı) bozuk görünmesi,
   kesilen metinler, scrollbar sorunları, çok küçük tıklama alanları.
6. Öğrenciye görünen tarafta AGENTS.md'deki TTKB görsel kurallarını özellikle
   denetle: düğme metinleri tek satırda ve okunaklı mı, aynı roldeki metinler
   (başlık/gövde/düğme/geri bildirim) tutarlı tipografi kullanıyor mu,
   kontrast WCAG beklentilerini karşılıyor mu, semantik ikonlar (✓ × ! ✎ ☰ ⌂ ↻)
   doğru kullanılmış mı, popup arkasındaki karartma temel etkinliği okunur
   bırakıyor mu, katman içeriği taban katmanın üzerinde mi render oluyor,
   aynı paketteki düğmeler aynı animasyon profilini mi kullanıyor.
7. Bulguları docs/inceleme/09-gorsel-bulgular.md dosyasına yaz:
   ekran + çözünürlük, sorunun tarifi, ekran görüntüsü dosya yolu,
   ilgili bileşen/CSS dosyası tahmini.

Ekran görüntülerini docs/inceleme/ekran-goruntuleri/ klasörüne kaydet.
Kod DEĞİŞTİRME.
```

---

## Aşama 5 — Çapraz Kontroller (1 oturum)

```
ultracode
(Çok-ajanlı derin inceleme modu destekleniyorsa etkinleştir. Desteklenmiyorsa
aynı işi tek oturum içinde sistematik kontrol listesiyle yap.)

Önce AGENTS.md ve docs/TTKB-UYUM-POLITIKASI.md dosyalarını oku. Öğrenciye görünen
önizleme, dışa aktarılan HTML ve SCORM çıktısını TTKB denetimine girecek materyal
kabul et.

Görev: Şu çapraz kontrolleri çalıştır ve sonuçları
docs/inceleme/10-capraz-kontroller.md dosyasına raporla:

1. npm run lint — tüm uyarı ve hataları listele.
2. npm test — başarısız testleri ve nedenlerini raporla.
3. npm run build — üretim derlemesi hatasız mı, uyarılar neler?
4. Dış bağlantı denetimi — KESİN KURAL (SCORM çıktısı için): kullanıcı manuel
   eklemedikçe dışa aktarılan paket hiçbir dış kaynaktan bir şey çekemez.
   Bir kez örnek SCORM paketi üret (editörden veya scripts/ altındaki paketleme
   akışıyla); 4 ve 5. kontrollerin TAMAMINI bu tek paket üzerinde yap.
   Paketin içindeki TÜM dosyalarda dış kaynak referansı tara: http://, https://,
   protokolsüz //, ftp://, ws://, wss:// ve harici domain içeren her URL
   (CDN, Google Fonts, analytics, embed, tracking, fallback kodları dahil).
   Sonra paketi tarayıcıda çevrimdışı koşturup ağ trafiğinde dış istek olup
   olmadığını fiilen izle. Pakete sızan kod kaynaklı her dış istek politika
   ihlalidir; en az Yüksek önemde raporla. Yalnızca editör tarafında kalan dış
   referanslar TTKB/SCORM ihlali değildir; ancak güvenlik, gizlilik ve çevrimdışı
   çalışma riski açısından bilgi notu halinde listele. Ayrıca kullanıcının
   içeriğe manuel eklediği dış link/embed varken SCORM export'ta TTKB/KVKK/telif
   uyarısı veriliyor mu fiilen test et; uyarıyı atlayan yol Kritik sayılır.
5. SCORM çıktısı: 4. maddede ürettiğin paketi kullan; zip içeriğini aç ve
   imsmanifest ile dosya bütünlüğünü doğrula. SCORM çıktısı YALNIZCA SCORM 1.2
   olmalı: pakette veya kodda SCORM 2004, xAPI, cmi5, LTI veya dış tracking
   belirtisi varsa risk olarak raporla. Pakette dış URL var mı kontrol et.
6. package.json bağımlılıklarında bilinen güvenlik açığı taraması: npm audit
   sonucunu özetle (düzeltme YAPMA, sadece raporla). Gizli bilgi (API anahtarı,
   şifre) tespit edersen değerini rapora yazma; dosya:satır + risk türü yeter.
```

---

## Aşama 6 — Birleşik Rapor ve Düzeltme Planı (1 oturum)

```
Önce AGENTS.md ve docs/TTKB-UYUM-POLITIKASI.md dosyalarını oku.

Görev: docs/inceleme/ altındaki tüm raporları (01'den 10'a) oku ve
docs/inceleme/99-BIRLESIK-RAPOR.md dosyasını oluştur:

1. Tüm bulguları tek listede topla, tekrarları birleştir.
2. Önem sırasına diz: Kritik (veri kaybı/güvenlik/çökme) → Yüksek
   (yanlış çalışan özellik) → Orta (UX/görsel) → Düşük (kozmetik/temizlik).
   Öğrenciye görünen çıktıda TTKB riski taşıyan bulguları (SCORM/önizleme
   tarafındaki bozuk düğme, etkileşim sızıntısı, SCORM paketinde kullanıcının
   manuel eklemediği halde var olan dış bağlantı/tracking, okunmazlık) en az
   Yüksek olarak sınıflandır.
3. Her bulguya bir kimlik ver (B-001, B-002...) ve kanıt türünü belirt:
   statik analiz / canlı test / ekran görüntüsü / build-test sonucu / varsayım.
4. Önerilen düzeltme sırasını ve hangi bulguların birlikte düzeltilmesi
   gerektiğini (aynı dosya/aynı kök neden) belirt.
5. Son olarak bir "tamlık eleştirisi" yap: incelenmemiş dosya, test edilmemiş
   öge, bakılmamış çözünürlük kaldı mı? Kalanları "Eksik Kalanlar" başlığında
   listele.
```

Düzeltme oturumları için (her seferde küçük bir grup bulgu):

```
Önce AGENTS.md ve docs/TTKB-UYUM-POLITIKASI.md dosyalarını oku.

docs/inceleme/99-BIRLESIK-RAPOR.md dosyasındaki <B-001, B-002, B-003> numaralı
bulguları düzelt. Her düzeltmeden sonra ilgili davranışı çalıştırarak doğrula
(/verify yaklaşımı: uygulamayı başlat, düzeltilen ögeyi gerçekten dene).
Düzeltme öğrenciye görünen önizleme/SCORM tarafını etkiliyorsa, bitirmeden önce
AGENTS.md'nin gerektirdiği TTKB risk geçişini yap ve sonucunu raporla.
Bittiğinde raporda bu bulguları "Düzeltildi (commit: ...)" olarak işaretle
ve Türkçe mesajla commit at.
```

> Kritik ve Yüksek bulgular bitince ara doğrulama olarak Aşama 3'ün ilgili
> bölümlerini yeniden koşturmak iyi olur (regresyon kontrolü).

---

## Sık Sorulanlar / İpuçları

- **`/code-review ultra` ne zaman?** O komut yalnızca mevcut dalın *diff*'ini
  (son değişiklikleri) bulut üzerinde çok-ajanlı inceler. "Tüm sistemi" incelemek
  için bu kılavuzdaki Aşama 1 prompt'ları gerekir; ama büyük bir özellik dalını
  merge etmeden önce `/code-review ultra` çok değerlidir.
- **Maliyet:** `ultracode` modu her aşamada çok sayıda alt-ajan çalıştırır;
  token tüketimi yüksektir. Bütçe kaygısı varsa Aşama 1'i `ultracode` olmadan,
  diğerlerini `ultracode` ile koşturabilirsin — ama "hiçbir nokta atlanmasın"
  hedefi için hepsinde açık olması önerilir.
- **Oturum uzarsa:** Raporlar dosyada olduğu için endişelenme; yeni oturum açıp
  "docs/inceleme/00-PLAN.md'yi oku, kaldığın aşamadan devam et" demen yeterli.
- **Şüpheli bulgular:** Rapordaki bir bulgudan emin olamazsan
  "B-014'ü kanıtla: yeniden üretme adımlarını çalıştırıp göster" diyebilirsin.
