import { useState, useCallback } from 'react';

import { DEFAULT_ACTIVITY_SETTINGS } from '../../../constants';
import { evaluateStorylineRuntimeShortcut, shortcutComboFromEvent, normalizeShortcutCombo } from '../../../utils/storylineRuntimeEngine';

import { usePreviewTimer, formatTime, previewActionButtonStyle, FeedbackOverlay, HintBox } from './shared';
export function PreviewShortcutFlow({ activity }) {
  const [phase, setPhase] = useState('play');
  const [result, setResult] = useState(null);
  const [pressed, setPressed] = useState('');
  const [attempts, setAttempts] = useState(0);
  const settings = { ...DEFAULT_ACTIVITY_SETTINGS, ...(activity.settings || {}) };
  const answerControl = activity.answerControl || {};
  const maxAttempts = answerControl.maxAttempts || settings.maxAttempts || 0;
  const { secondsLeft, enabled: timerEnabled } = usePreviewTimer(activity, () => {
    setResult('failure');
    setPhase('result');
  });

  const onKeyDown = useCallback((e) => {
    e.preventDefault();
    const combo = shortcutComboFromEvent(e.nativeEvent || e);
    if (combo) setPressed(combo);
  }, []);

  const handleCheck = useCallback(() => {
    if (maxAttempts > 0 && attempts >= maxAttempts) return;
    const evalResult = evaluateStorylineRuntimeShortcut({ slide: activity, state: { shortcutPressed: pressed } });
    setResult(evalResult.success ? 'success' : 'failure');
    setPhase('result');
    setAttempts((a) => a + 1);
  }, [activity, attempts, maxAttempts, pressed]);

  const handleRestart = () => {
    setPressed('');
    setResult(null);
    setPhase('play');
  };

  if (phase === 'result') {
    return <FeedbackOverlay result={result} activity={activity} onRestart={handleRestart} />;
  }

  return (
    <div style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 900 }}>Kısayol Tuşu</div>
        {timerEnabled && (
          <div style={{ fontSize: 13, fontWeight: 900, color: secondsLeft <= 30 ? '#dc2626' : '#64748b', animation: secondsLeft <= 30 ? 'previewTimerPulse 1s infinite' : 'none' }}>
            {formatTime(secondsLeft)}
          </div>
        )}
      </div>
      <HintBox activity={activity} />
      <div style={{ fontSize: 15, color: '#334155', marginBottom: 16, lineHeight: 1.6 }}>
        {activity.shortcutPrompt || 'Doğru klavye kısayolunu basın:'}
      </div>
      <button
        type="button"
        onKeyDown={onKeyDown}
        style={{
          width: '100%',
          padding: '28px 16px',
          borderRadius: 12,
          border: '2px dashed #1d4ed8',
          background: '#eff6ff',
          cursor: 'pointer',
          textAlign: 'center',
          outline: 'none',
        }}
      >
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>
          Buraya tıklayıp kısayolu basın
        </div>
        <div style={{ fontSize: 26, fontWeight: 900, color: '#1d4ed8', minHeight: 32 }}>
          {pressed ? normalizeShortcutCombo(pressed).toUpperCase() : '—'}
        </div>
      </button>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 18 }}>
        <button onClick={handleCheck} disabled={!pressed || (maxAttempts > 0 && attempts >= maxAttempts)} style={previewActionButtonStyle(activity, 'primary', { opacity: !pressed || (maxAttempts > 0 && attempts >= maxAttempts) ? 0.5 : 1 })}>
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
