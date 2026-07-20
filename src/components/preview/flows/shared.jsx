import { useState, useEffect } from 'react';

import { DEFAULT_ACTIVITY_SETTINGS } from '../../../constants';
import { playFeedbackSound } from '../../../logic/answerFeedbackRuntime';
import { getReadyButtonTextStylePatch } from '../../../logic/buttonStyling';
import FeedbackAnimation from '../FeedbackAnimation';
export function usePreviewTimer(activity, onTimeout) {
  const settings = activity.settings || {};
  const minutes = settings.timeLimitMinutes || 5;
  const enabled = !!settings.timeLimitEnabled;
  const [secondsLeft, setSecondsLeft] = useState(enabled ? minutes * 60 : 0);
  useEffect(() => {
    if (!enabled || secondsLeft <= 0) return;
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(id);
          onTimeout?.();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [enabled, secondsLeft, onTimeout]);
  return { secondsLeft, enabled };
}

export function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function previewButtonTextStyle(activity) {
  return {
    ...getReadyButtonTextStylePatch(activity),
    whiteSpace: 'nowrap',
  };
}

export function previewActionButtonStyle(activity, variant = 'primary', extra = {}) {
  const primary = variant === 'primary';
  return {
    padding: '10px 18px',
    borderRadius: 8,
    border: primary ? 'none' : '1px solid #cbd5e1',
    background: primary ? '#1d4ed8' : '#fff',
    color: primary ? '#fff' : '#0f172a',
    fontWeight: primary ? 900 : 800,
    cursor: 'pointer',
    ...extra,
    ...previewButtonTextStyle(activity),
  };
}

export function FeedbackOverlay({ result, activity, onRestart, earnedPoints, totalPoints }) {
  const feedback = activity.answerFeedback || {};
  const settings = { ...DEFAULT_ACTIVITY_SETTINGS, ...(activity.settings || {}) };
  const isSuccess = result === 'success';
  const status = isSuccess ? 'success' : 'incorrect';
  const title = isSuccess
    ? (feedback.correctMessage || 'Tebrikler!')
    : (feedback.incorrectMessage || 'Tekrar dene');
  const animation = isSuccess
    ? (feedback.animation || 'Confetti')
    : (feedback.incorrectAnimation || 'Sallanma');
  // Sonuç gösterilir gösterilmez (= Kontrol Et anı) ses çal + animasyon tetikle.
  const [burst, setBurst] = useState(null);
  useEffect(() => {
    playFeedbackSound(feedback, status, { muted: false });
    setBurst({ kind: isSuccess ? 'success' : 'failure', animation, ts: Date.now() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div style={{ position: 'relative', overflow: 'hidden', display: 'grid', placeItems: 'center', minHeight: 320, gap: 16, padding: 24 }}>
      <FeedbackAnimation burst={burst} />
      <div style={{ fontSize: 32, fontWeight: 900, color: isSuccess ? '#166534' : '#991b1b' }}>{isSuccess ? '✓' : '×'}</div>
      <div style={{ fontSize: 20, fontWeight: 900, color: isSuccess ? '#166534' : '#991b1b' }}>
        {title}
      </div>
      {typeof earnedPoints === 'number' && (
        <div style={{ fontSize: 14, color: '#64748b' }}>
          Puan: {earnedPoints}{totalPoints ? ` / ${totalPoints}` : ''}
        </div>
      )}
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onRestart} style={previewActionButtonStyle(activity, 'secondary')}>
          {settings.restartText || 'Yeniden Başlat'}
        </button>
      </div>
    </div>
  );
}

export function HintBox({ activity }) {
  const hints = activity.answerHints || {};
  const [visible, setVisible] = useState(false);
  if (!hints.hintText && !hints.explanationText) return null;
  return (
    <div style={{ marginBottom: 16, padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc' }}>
      {hints.hintText && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: visible ? 8 : 0 }}>
          <button onClick={() => setVisible((v) => !v)} style={previewActionButtonStyle(activity, 'secondary', { padding: '4px 10px', borderRadius: 6, fontSize: 12 })}>
            {visible ? 'İpucunu Gizle' : 'İpucu Göster'}
          </button>
        </div>
      )}
      {visible && hints.hintText && (
        <div style={{ fontSize: 13, color: '#475569', marginTop: 6 }}>{hints.hintText}</div>
      )}
      {visible && hints.explanationText && (
        <div style={{ fontSize: 13, color: '#64748b', marginTop: 6 }}>{hints.explanationText}</div>
      )}
    </div>
  );
}
