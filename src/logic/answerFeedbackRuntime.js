// Cevap geri bildirimi için PAYLAŞILAN runtime mantığı.
// Hem editör önizlemesi (src/components/storyline-preview, src/components/preview)
// hem de SCORM çıktısı (src/generated runtime) AYNI kaynağı kullanır; böylece
// davranış ikiye ayrılmaz (mesaj/ses/animasyon editörde ne ise pakette de odur).
//
// Offline kuralı: yalnızca GÖMÜLÜ (data URL) ses veya dosya gerektirmeyen YERLEŞİK
// (Web Audio ile üretilen) ton çalınır. Hiçbir zaman harici URL'den ses çekilmez.

export const FEEDBACK_STATUS = {
  SUCCESS: 'success',
  PARTIAL: 'partial',
  INCORRECT: 'incorrect',
};

// ─── Mesaj ───────────────────────────────────────────────────────────────────
export function resolveFeedbackMessage(feedback = {}, status = 'success') {
  if (status === 'success') return feedback.correctMessage || 'Doğru cevap.';
  if (status === 'partial') {
    return feedback.partialMessage || feedback.incorrectMessage || 'Bazı cevaplar eksik.';
  }
  return feedback.incorrectMessage || 'Tekrar dene.';
}

// ─── Animasyon ─────────────────────────────────────────────────────────────────
export function resolveFeedbackAnimation(feedback = {}, status = 'success') {
  if (status === 'success') return feedback.animation || 'Confetti';
  return feedback.incorrectAnimation || 'Sallanma';
}

// ─── Ses ───────────────────────────────────────────────────────────────────────
function resolveSoundSpec(feedback = {}, status = 'success') {
  const isSuccess = status === 'success';
  const mode = (isSuccess ? feedback.correctSoundMode : feedback.incorrectSoundMode) || 'builtin';
  const data = isSuccess ? feedback.correctSoundData : feedback.incorrectSoundData;
  return { mode, data: data || '' };
}

function playDataUrlSound(dataUrl) {
  if (typeof Audio === 'undefined' || !dataUrl) return;
  try {
    const audio = new Audio(dataUrl);
    audio.volume = 0.9;
    const promise = audio.play();
    if (promise && typeof promise.catch === 'function') promise.catch(() => {});
  } catch (error) {
    /* sessizce yut: autoplay / format hatası geri bildirimi engellemesin */
  }
}

// Dosya gerektirmeyen yerleşik ton: başarı = yükselen iki nota, hata = alçak buzz.
export function playBuiltinFeedbackTone(status = 'success') {
  if (typeof window === 'undefined') return;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  let ctx;
  try {
    ctx = new AudioCtx();
  } catch (error) {
    return;
  }
  const now = ctx.currentTime;
  const tone = (freq, start, duration, type, peak) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, now + start);
    gain.gain.exponentialRampToValueAtTime(peak, now + start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + start);
    osc.stop(now + start + duration + 0.02);
  };
  if (status === 'success') {
    tone(523.25, 0, 0.18, 'sine', 0.2); // C5
    tone(783.99, 0.13, 0.22, 'sine', 0.2); // G5
  } else {
    tone(174.61, 0, 0.34, 'square', 0.14); // F3 buzz
  }
  const totalMs = status === 'success' ? 600 : 500;
  setTimeout(() => {
    try {
      ctx.close();
    } catch (error) {
      /* yoksay */
    }
  }, totalMs);
}

// Kontrol Et anında çağrılır. muted ise hiçbir şey çalmaz.
export function playFeedbackSound(feedback = {}, status = 'success', options = {}) {
  if (options.muted) return;
  const isSuccess = status === 'success';
  const { mode, data } = resolveSoundSpec(feedback, isSuccess ? 'success' : 'incorrect');
  if (mode === 'none') return;
  if (mode === 'custom') {
    if (data) {
      playDataUrlSound(data);
      return;
    }
    // 'custom' seçili ama yükleme yoksa yerleşik tona düş (sessiz kalmasın).
  }
  playBuiltinFeedbackTone(isSuccess ? 'success' : 'incorrect');
}
