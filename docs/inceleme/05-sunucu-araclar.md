# 05 — Sunucu ve Araçlar İncelemesi

Kapsam: `server.mjs`, `dev.mjs`, `scripts/`, `public/` (`public/fonts/` hariç; pakete giren
`widgets/`, `widget-sdk/` dahil)

**Tur 2 (Derin çok-ajanlı inceleme, 2026-06-15):** Yerel dev API (`server.mjs`), tek seferlik
`scripts/extract-*.mjs` araçları ve `public/` widget'ları incelendi.

> Bağlam: `server.mjs` **yerel geliştirme** API'sidir (SQLite). Üretim backend'i ayrı bir
> PHP/MySQL (bkz. rapor 06). Yine de yerel sunucu gizli üretebilir ve aynı veri modelini
> kullanır, bu yüzden güvenlik bulguları kaydedildi.

## Özet

| Önem | Adet |
|---|---|
| Kritik | 0 |
| Yüksek | 3 |
| Orta | ~4 |
| Düşük | ~11 |

---

## YÜKSEK

### B5-Y1 — Hassas LMS/xAPI/LTI sırları yazma yolunda temizlenmiyor (güvenlik)
- `server.mjs:1182` — `scrubEditorPayloadSecrets()` yalnız açılışta bir kez (`scrubStoredSecrets`,
  satır 156) çalışıyor. Yazma uçları `saveProjectDraft` (1182), `createProject` (1799),
  `createProjectVersion` (1888) gelen `body.state`'i doğrudan DB'ye yazıyor; `scrubLmsConfig`
  hiçbir yazmada uygulanmıyor. İstemci `lmsConfig.xapiKey/xapiSecret/ltiConsumerKey/ltiSharedSecret`
  göndererek sırları `projects`/`project_versions` tablolarına kalıcı yazdırabilir; DB yedeklerine
  de sızar. **Fix:** tüm yazma yollarında DB'ye yazmadan önce `scrubEditorPayloadSecrets()` çalıştır.

### B5-Y2 — `scripts/cleanup-editor.mjs:258` yıkıcı yeniden yazma yedek almadan çalışıyor
- ~5000 satırlık `src/EIcerikEditor.jsx`'i regex/satır tabanlı silip üzerine yazıyor. `backupPath`
  tanımlı ama **kullanılmıyor** (yedek yazılmıyor). Tek seferlik "stage 2" aracı ama hâlâ repoda,
  argümansız/onaysız çalışır → yanlışlıkla koşturulursa kaynağı geri dönülmez bozar. **Fix:**
  `git rm` veya zorunlu yedek + `--confirm` gate'i.

### B5-Y3 — `scripts/extract-runtime-inline.mjs:85` SCORM runtime kaynağını sessizce ezen tek seferlik script
- `src/generated/storylineRuntimeCore.js` ve `storylineRuntimeEngine.js`'i (SCORM'a inline edilen
  git-tracked dosyalar) argümansız üzerine yazıyor. Yanlışlıkla çalıştırılırsa SCORM runtime bozulur.
  **Fix:** `git rm` veya idempotent generator + diff/onay.

> Aynı risk sınıfında diğer `scripts/extract-*.mjs` araçları da var (rapor 01'de `extract-scene-templates.mjs`
> not edilmişti). Tek seferlik migrasyon araçlarının tümü repo hijyeni açısından gözden geçirilmeli.

## ORTA

- `server.mjs:392` (güvenlik) — Token doğrulama `x-user-id`/`x-session-id` header fallback'i ile
  atlanabilir.
- `scripts/restore-editor-scenes.mjs:3` — Var olmayan dosyayı okuyan kırık tek seferlik script.
- `public/widgets/builtins/bird-flight-v1/widget.js:43` — Uçuş döngüsü `setTimeout` zinciri iptal
  edilemiyor; çift tetiklenme/yarış.
- `public/widgets/builtins/dice-v1/widget.js:46` — `reset` komutu devam eden `setInterval`'i
  durdurmuyor (yarış).

## DÜŞÜK (özet)

~11 düşük: dev sunucu varsayılan şifre `1234` fallback'i (üretim için B6 ile birlikte ele alınmalı;
canlı ortamda env zorunlu), `download-fonts.mjs` dış indirme (geliştirme aracı — runtime değil,
ihlal değil), tahmin edilebilir session token secret fallback'i, küçük hata yönetimi notları.

## public/ Dış Bağlantı Denetimi (B5-public)

`public/index.html`, `widget-sdk/eicerik-widget-sdk.js` ve builtin widget'larda **kod-kaynaklı dış
referans bulunamadı** (B-006 sonrası index.html temiz). Builtin widget'lar (bird-flight, dice)
yerel; dış istek yok. Kullanıcının yüklediği widget'lar farklı — bkz. rapor 02 B2-widgets (dış
kaynak içeren widget SCORM'a sızabiliyor).

## İncelenen Dosyalar

`server.mjs` (2042), `dev.mjs`, `scripts/**/*.mjs` (18 dosya), `public/index.html`,
`public/widget-sdk/*`, `public/widgets/builtins/**` baştan sona okundu.
