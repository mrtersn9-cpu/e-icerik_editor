import { useState, useCallback } from 'react';

import { DEFAULT_ACTIVITY_SETTINGS } from '../../../constants';
import { evaluateStorylineRuntimeTextEntry } from '../../../utils/storylineRuntimeEngine';

import { usePreviewTimer, formatTime, previewActionButtonStyle, FeedbackOverlay, HintBox } from './shared';
export function PreviewTextEntryFlow({ activity }) {
  const [phase, setPhase] = useState('play');
  const [result, setResult] = useState(null);
  const [value, setValue] = useState('');
  const [attempts, setAttempts] = useState(0);
  const settings = { ...DEFAULT_ACTIVITY_SETTINGS, ...(activity.settings || {}) };
  const answerControl = activity.answerControl || {};
  const maxAttempts = answerControl.maxAttempts || settings.maxAttempts || 0;
  const rows = Math.max(1, Math.min(20, activity.textEntryRows || 3));
  const { secondsLeft, enabled: timerEnabled } = usePreviewTimer(activity, () => {
    setResult('failure');
    setPhase('result');
  });
  const handleCheck = useCallback(() => {
    if (maxAttempts > 0 && attempts >= maxAttempts) return;
    const evalResult = evaluateStorylineRuntimeTextEntry({ slide: activity, state: { textEntryValue: value } });
    setResult(evalResult.success ? 'success' : 'failure');
    setPhase('result');
    setAttempts((a) => a + 1);
  }, [activity, attempts, maxAttempts, value]);
  const handleRestart = () => {
    setValue('');
    setResult(null);
    setPhase('play');
  };
  const startVoice = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Tarayiciniz sesle yazimi desteklemiyor.');
      return;
    }
    const rec = new SpeechRecognition();
    rec.lang = 'tr-TR';
    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setValue((v) => (v ? v + ' ' + transcript : transcript));
    };
    rec.start();
  };
  if (phase === 'result') {
    return <FeedbackOverlay result={result} activity={activity} onRestart={handleRestart} />;
  }
  return (
    <div style={{ padding: 24, maxWidth: 600, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 900 }}>{activity.textEntryPrompt || 'Yanıtınızı yazın'}</div>
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
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={rows}
        style={{
          width: '100%',
          padding: 12,
          borderRadius: 8,
          border: '1px solid #cbd5e1',
          fontSize: 14,
          fontFamily: 'inherit',
          resize: 'vertical',
        }}
        maxLength={activity.textEntryMaxLength || undefined}
      />
      <div style={{ marginTop: 8, fontSize: 12, color: '#64748b' }}>
        {value.length}{activity.textEntryMaxLength ? ` / ${activity.textEntryMaxLength}` : ''} karakter
      </div>
      <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={handleCheck} disabled={maxAttempts > 0 && attempts >= maxAttempts} style={previewActionButtonStyle(activity, 'primary', { opacity: maxAttempts > 0 && attempts >= maxAttempts ? 0.5 : 1 })}>
          {settings.checkButtonText || 'Kontrol Et'}
        </button>
        <button onClick={handleRestart} style={previewActionButtonStyle(activity, 'secondary')}>
          Temizle
        </button>
        {activity.textEntryVoiceInput && (
          <button onClick={startVoice} style={previewActionButtonStyle(activity, 'secondary', { background: '#f0fdf4', color: '#166534' })}>
            🎤 Sesle Yaz
          </button>
        )}
        {maxAttempts > 0 && <span style={{ fontSize: 12, color: '#64748b' }}>Deneme: {attempts} / {maxAttempts}</span>}
      </div>
    </div>
  );
}
