import { useState, useCallback } from 'react';

import { DEFAULT_ACTIVITY_SETTINGS } from '../../../constants';
import { evaluateStorylineRuntimeFillBlank } from '../../../utils/storylineRuntimeEngine';

import { usePreviewTimer, formatTime, previewActionButtonStyle, FeedbackOverlay, HintBox } from './shared';
export function PreviewFillBlankFlow({ activity }) {
  const [phase, setPhase] = useState('play');
  const [result, setResult] = useState(null);
  const [values, setValues] = useState({});
  const [attempts, setAttempts] = useState(0);
  const answers = activity.fillBlankAnswers || [];
  const settings = { ...DEFAULT_ACTIVITY_SETTINGS, ...(activity.settings || {}) };
  const answerControl = activity.answerControl || {};
  const maxAttempts = answerControl.maxAttempts || settings.maxAttempts || 0;
  const sentence = activity.fillBlankSentence || '';
  const { secondsLeft, enabled: timerEnabled } = usePreviewTimer(activity, () => {
    setResult('failure');
    setPhase('result');
  });
  const handleCheck = useCallback(() => {
    if (maxAttempts > 0 && attempts >= maxAttempts) return;
    const evalResult = evaluateStorylineRuntimeFillBlank({ slide: activity, state: { fillBlankValues: values } });
    setResult(evalResult.success ? 'success' : 'failure');
    setPhase('result');
    setAttempts((a) => a + 1);
  }, [activity, attempts, maxAttempts, values]);
  const handleRestart = () => {
    setValues({});
    setResult(null);
    setPhase('play');
  };
  const parts = sentence.split(/(___|\{.+?\})/g).filter(Boolean);
  let blankIndex = 0;
  if (phase === 'result') {
    const evalResult = evaluateStorylineRuntimeFillBlank({ slide: activity, state: { fillBlankValues: values } });
    return (
      <FeedbackOverlay
        result={result}
        activity={activity}
        onRestart={handleRestart}
        earnedPoints={evalResult.earnedPoints}
        totalPoints={evalResult.totalPoints}
      />
    );
  }
  return (
    <div style={{ padding: 24, maxWidth: 720, margin: '0 auto', fontSize: 16, lineHeight: 2.2 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 900 }}>Boşlukları doldur</div>
        {timerEnabled && (
          <div
            style={{
              fontSize: 13,
              fontWeight: 900,
              color: secondsLeft <= 30 ? '#dc2626' : '#64748b',
              animation: secondsLeft <= 30 ? 'previewTimerPulse 1s infinite' : 'none',
            }}
          >
            {formatTime(secondsLeft)}
          </div>
        )}
      </div>
      <HintBox activity={activity} />
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
        {parts.map((part, i) => {
          const isBlank = part === '___' || (part.startsWith('{') && part.endsWith('}'));
          if (isBlank) {
            const currentBlankIndex = blankIndex;
            const answer = answers[currentBlankIndex];
            blankIndex += 1;
            const answerId = answer?.id || `blank-${currentBlankIndex}`;
            return (
              <input
                key={answerId}
                value={values[answerId] || ''}
                onChange={(e) => setValues({ ...values, [answerId]: e.target.value })}
                placeholder="..."
                style={{
                  width: 120,
                  padding: '4px 8px',
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                  fontSize: 14,
                  textAlign: 'center',
                }}
              />
            );
          }
          return <span key={i}>{part}</span>;
        })}
      </div>
      <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
        <button onClick={handleCheck} disabled={maxAttempts > 0 && attempts >= maxAttempts} style={previewActionButtonStyle(activity, 'primary', { opacity: maxAttempts > 0 && attempts >= maxAttempts ? 0.5 : 1 })}>
          {settings.checkButtonText || 'Kontrol Et'}
        </button>
        <button onClick={handleRestart} style={previewActionButtonStyle(activity, 'secondary')}>
          Temizle
        </button>
        {maxAttempts > 0 && <span style={{ fontSize: 12, color: '#64748b' }}>Deneme: {attempts} / {maxAttempts}</span>}
      </div>
    </div>
  );
}
