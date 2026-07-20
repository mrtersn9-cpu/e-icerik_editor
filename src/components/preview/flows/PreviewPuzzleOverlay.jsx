import { useState } from 'react';

import { DEFAULT_ACTIVITY_SETTINGS } from '../../../constants';
import PreviewPuzzleFlow from '../PreviewPuzzleFlow';

import { previewActionButtonStyle } from './shared';
export function PreviewPuzzleOverlay({ activity, onResult }) {
  const [result, setResult] = useState(null);
  const settings = { ...DEFAULT_ACTIVITY_SETTINGS, ...(activity.settings || {}) };
  const maxAttempts = settings.answerControl?.maxAttempts || 0;
  const [attempts, setAttempts] = useState(0);

  const handleAnswer = (res) => {
    setResult(res);
    setAttempts((a) => a + 1);
    onResult?.(res);
  };

  const canRetry = maxAttempts === 0 || attempts < maxAttempts;

  return (
    <div style={{ padding: 16 }}>
      <PreviewPuzzleFlow activity={activity} onAnswer={handleAnswer} />
      {result && (() => {
        const isSuccess = !!result.success;
        const isCompleted = !!result.completed;
        let bg = '#fee2e2';
        let border = '#fecaca';
        let color = '#991b1b';
        let msg = settings.answerFeedback?.incorrectMessage || 'Yanlış cevap.';

        if (isSuccess) {
          bg = '#dcfce7';
          border = '#86efac';
          color = '#166534';
          msg = settings.answerFeedback?.correctMessage || 'Tebrikler!';
        } else if (isCompleted && (result.revealed > 0 || result.assisted)) {
          bg = '#f3e8ff';
          border = '#e9d5ff';
          color = '#5b21b6';
          msg = '✎ Etkinlik çözüm desteğiyle tamamlandı.';
        }

        return (
          <div
            aria-live="polite"
            aria-atomic="true"
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 8,
              background: bg,
              border: `1px solid ${border}`,
              transition: 'background 0.2s'
            }}
          >
            <div style={{ fontWeight: 800, color: color }}>
              {msg}
            </div>
            {typeof result.correct === 'number' && typeof result.total === 'number' && (
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                {result.correct} / {result.total} doğru
              </div>
            )}
          </div>
        );
      })()}
      {result && canRetry && (
        <button onClick={() => setResult(null)} style={previewActionButtonStyle(activity, 'secondary', { marginTop: 8, padding: '6px 14px', borderRadius: 6, fontWeight: 700 })}>
          Tekrar Dene
        </button>
      )}
    </div>
  );
}
