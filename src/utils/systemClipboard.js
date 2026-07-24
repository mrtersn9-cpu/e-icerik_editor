// Nesne kopyala/yapıştır işlemini tarayıcının SİSTEM panosu üzerinden farklı
// sekmeler/pencereler arasında da çalışır hale getirir (Canva'daki gibi).
// Mevcut sessionStorage tabanlı pano (aynı sekme içinde sayfa yenilemeye
// dayanıklı) olduğu gibi kalır; bu modül yalnızca EK bir kanaldır ve her
// adımda sessizce başarısız olabilir (izin yok, tarayıcı desteklemiyor,
// güvensiz bağlam vb.) — böyle durumlarda mevcut davranış hiç bozulmaz.

const CLIPBOARD_MARKER = 'eicerik-object-clipboard-v1';

export function isSystemClipboardSupported() {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.clipboard &&
    typeof navigator.clipboard.writeText === 'function'
  );
}

// payload: { objects, timeline, copiedAt } — copySelected'in ürettiği şekil.
export async function writeObjectClipboardToSystem(payload) {
  if (!isSystemClipboardSupported() || !payload?.objects?.length) return;
  try {
    await navigator.clipboard.writeText(
      JSON.stringify({ __eicerik: CLIPBOARD_MARKER, ...payload })
    );
  } catch {
    // İzin reddedildi / odak yok / desteklenmiyor — aynı sekme içi pano zaten çalışıyor.
  }
}

// Sistem panosunda bizim işaretimizi taşıyan geçerli bir nesne kopyası varsa
// { objects, timeline, copiedAt } döner, yoksa null (asla throw etmez).
export async function readObjectClipboardFromSystem() {
  if (
    typeof navigator === 'undefined' ||
    !navigator.clipboard ||
    typeof navigator.clipboard.readText !== 'function'
  ) {
    return null;
  }
  try {
    const text = await navigator.clipboard.readText();
    if (!text || text[0] !== '{') return null;
    const parsed = JSON.parse(text);
    if (parsed?.__eicerik !== CLIPBOARD_MARKER || !Array.isArray(parsed.objects) || !parsed.objects.length) {
      return null;
    }
    const { __eicerik, ...payload } = parsed;
    return payload;
  } catch {
    return null;
  }
}
