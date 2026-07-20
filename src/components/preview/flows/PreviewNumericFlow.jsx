import { useState, useCallback } from 'react';

import { DEFAULT_ACTIVITY_SETTINGS } from '../../../constants';
import { evaluateStorylineRuntimeNumeric } from '../../../utils/storylineRuntimeEngine';

import { usePreviewTimer, formatTime, previewActionButtonStyle, FeedbackOverlay, HintBox } from './shared';
export function PreviewNumericFlow({ activity }) {
  const [phase, setPhase] = useState('play');
  const [result, setResult] = useState(null);
  const [value, setValue] = useState('');
  const [attempts, setAttempts] = useState(0);
  const settings = { ...DEFAULT_ACTIVITY_SETTINGS, ...(activity.settings || {}) };
  const answerControl = activity.answerControl || {};
  const maxAttempts = answerControl.maxAttempts || settings.maxAttempts || 0;
  const { secondsLeft, enabled: timerEnabled } = usePreviewTimer(activity, () => {
    setResult('failure');
    setPhase('result');
  });

  const handleCheck = useCallback(() => {
    if (maxAttempts > 0 && attempts >= maxAttempts) return;
    const evalResult = evaluateStorylineRuntimeNumeric({ slide: activity, state: { numericValue: value } });
    setResult(evalResult.success ? 'success' : 'failure');
    setPhase('result');
    setAttempts((a) => a + 1);
  }, [activity, attempts, maxAttempts, value]);

  const handleRestart = () => {
    setValue('');
    setResult(null);
    setPhase('play');
  };

  if (phase === 'result') {
    return <FeedbackOverlay result={result} activity={activity} onRestart={handleRestart} />;
  }

  return (
    <div style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 900 }}>Sayısal Cevap</div>
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
      <div style={{ fontSize: 15, color: '#334155', marginBottom: 16, lineHeight: 1.6 }}>
        {activity.numericPrompt || 'Sayısal cevabınızı giriniz:'}
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
        <input
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Cevap..."
          style={{
            flex: 1,
            maxWidth: 200,
            height: 40,
            padding: '0 12px',
            borderRadius: 8,
            border: '1px solid #cbd5e1',
            fontSize: 16,
          }}
        />
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
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
