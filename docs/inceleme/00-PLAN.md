# Sistem İnceleme Planı

Kaynak: [INCELEME-KILAVUZU.md](../INCELEME-KILAVUZU.md) — tüm prompt'lar ve kurallar orada.

## Tüm aşamalarda geçerli kurallar

1. Öğrenciye görünen önizleme/HTML/SCORM çıktısı **TTKB denetimine girecek materyal** sayılır
   (AGENTS.md + docs/TTKB-UYUM-POLITIKASI.md her oturumda önce okunur).
2. Bulunan **gizli bilgilerin değeri raporlara asla yazılmaz** — yalnızca dosya:satır + risk
   türü; URL query parametresindeki token/key/session değerleri de maskelenir.
3. KESİN KURAL (SCORM çıktısı): kullanıcı manuel eklemedikçe dışa aktarılan paket hiçbir dış
   kaynaktan bir şey çekemez. Editör tarafı serbest (bilgi notu olarak listelenir).
4. Hazır butonlarda toplu font ailesi/punto/kalınlık/yazı rengi değişimi kritik TTKB
   akışıdır; editör, önizleme ve SCORM çıktısında tutarlı uygulanmalıdır.
5. İnceleme aşamaları yalnızca okur ve raporlar; kod değişikliği Aşama 6 düzeltme
   oturumlarında yapılır.

## Bu Turun Notu

Bu dosyalar Codex tarafından 2026-06-12 tarihinde kılavuz baz alınarak oluşturulan
ilk denetim paketidir. Statik kod okuma, etkileşim envanteri için otomatik tarama,
lint/test/build/audit ve kaynak dış bağlantı taraması yapıldı. Playwright ile canlı
tıklama, ekran görüntüsü inceleme ve gerçek SCORM zip paketini tarayıcıda çevrimdışı
koşturma bu turda yapılmadı; ilgili raporlarda açıkça "kısmi" olarak işaretlendi.

## Durum Takibi

| Aşama | Kapsam | Rapor | Durum |
|---|---|---|---|
| 0 — Hazırlık | commit + plan + uygulama kontrolü | 00-PLAN.md | Bitti |
| 1.1 — Durum yönetimi | `src/store/ src/editor-logic/ src/logic/` | 01-durum-yonetimi.md | Bitti (Tur 2, 31 dosya satır satır) |
| 1.2 — UI bileşenleri | `src/components/ src/widgets/` + kök .jsx | 02-ui-bilesenleri.md | Bitti (Tur 2, 83 dosya) |
| 1.3 — Etkinlik tipleri | `src/activity-types/ src/features/` | 03-etkinlik-tipleri.md | Bitti (Tur 2, 73 dosya) |
| 1.4 — Altyapı | `src/hooks/ utils/ api/ mobile/ constants/ theme/ generated/` | 04-altyapi.md | Bitti (Tur 2) |
| 1.5 — Sunucu/araçlar | `server.mjs dev.mjs scripts/ public/` (fonts hariç) | 05-sunucu-araclar.md | Bitti (Tur 2) |
| 1.6 — PHP güvenlik | `ftp-hosting/` | 06-php-guvenlik.md | Bitti (Tur 2, OWASP; Kritik auth bulgusu) |
| 2 — Tıklanabilir envanter | tüm src + kök etkileşim ögeleri | 07-tiklanabilir-envanter.md | Kısmi (ham; canlı DOM'da 109 buton sayıldı) |
| 3 — Canlı tıklama testi | envanter bölümleri, panel panel | 08-islev-test-bulgulari.md | Kısmi (duman testi: editör+önizleme 0 hata; tek tek tıklama bekliyor) |
| 4 — Görsel tarama | 4 çözünürlük × ekran/panel kombinasyonları | 09-gorsel-bulgular.md | Kısmi (3 çözünürlük; önizleme modalı; editör/etkinlik kombinasyonları bekliyor) |
| 5 — Çapraz kontroller | lint/test/build/dış bağlantı/SCORM 1.2/audit | 10-capraz-kontroller.md | Bitti (taze koşum; audit çelişkisi düzeltildi) |
| 6 — Birleşik rapor | tüm raporların sentezi + düzeltme planı | 99-BIRLESIK-RAPOR.md | Bitti (Tur 2) |

Kapsam dışı: `node_modules/`, `yedekler/`, `build/`, `temp_bulmaca/`, `tmp_bulmaca_inceleme/`,
`GERI-YUKLEME-ICIN/`, `data/`. `public/fonts/` kod incelemesinde hariç; font referans
çözümlemesi Aşama 4/5'te denetlenir.
