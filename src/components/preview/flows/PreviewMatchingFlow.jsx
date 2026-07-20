import { useState, useMemo, useCallback } from 'react';

import { DEFAULT_ACTIVITY_SETTINGS } from '../../../constants';
import { shuffleArray } from '../../../logic/uiPrimitives';
import { evaluateStorylineRuntimeMatching } from '../../../utils/storylineRuntimeEngine';

import { usePreviewTimer, formatTime, previewActionButtonStyle, FeedbackOverlay, HintBox } from './shared';
export function PreviewMatchingFlow({ activity }) {
  const [phase, setPhase] = useState('play');
  const [result, setResult] = useState(null);
  const [selections, setSelections] = useState({});
  const [attempts, setAttempts] = useState(0);
  const pairs = useMemo(() => activity.matchingPairs || [], [activity.matchingPairs]);
  const settings = { ...DEFAULT_ACTIVITY_SETTINGS, ...(activity.settings || {}) };
  const answerControl = activity.answerControl || {};
  const maxAttempts = answerControl.maxAttempts || settings.maxAttempts || 0;
  const { secondsLeft, enabled: timerEnabled } = usePreviewTimer(activity, () => {
    setResult('failure');
    setPhase('result');
  });
  const leftItems = useMemo(() => {
    const items = pairs.map((p) => ({ ...p }));
    if (activity.matchingShuffle !== false) return shuffleArray(items);
    return items;
  }, [pairs, activity.matchingShuffle]);
  const rightItems = useMemo(() => {
    const items = pairs.map((p) => ({ ...p }));
    if (activity.matchingShuffle !== false) return shuffleArray(items);
    return items;
  }, [pairs, activity.matchingShuffle]);
  const handleCheck = useCallback(() => {
    if (maxAttempts > 0 && attempts >= maxAttempts) return;
    const evalResult = evaluateStorylineRuntimeMatching({ slide: activity, state: { matchingSelections: selections } });
    setResult(evalResult.success ? 'success' : 'failure');
    setPhase('result');
    setAttempts((a) => a + 1);
  }, [activity, attempts, maxAttempts, selections]);
  const handleRestart = () => {
    setSelections({});
    setResult(null);
    setPhase('play');
  };
  if (phase === 'result') {
    return <FeedbackOverlay result={result} activity={activity} onRestart={handleRestart} />;
  }
  return (
    <div style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 900 }}>Eşleştirme</div>
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: '#64748b' }}>Sol</div>
          {leftItems.map((pair) => (
            <button
              key={`l-${pair.id}`}
              onClick={() => {
                const current = selections[pair.id];
                const next = { ...selections };
                if (current) delete next[pair.id];
                else next[pair.id] = null;
                setSelections(next);
              }}
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                border: `2px solid ${selections[pair.id] ? '#16a34a' : '#e2e8f0'}`,
                background: selections[pair.id] ? '#f0fdf4' : '#fff',
                textAlign: 'left',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              {pair.left}
            </button>
          ))}
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: '#64748b' }}>Sağ</div>
          {rightItems.map((pair) => (
            <button
              key={`r-${pair.id}`}
              onClick={() => {
                const selectedLeftId = Object.keys(selections).find((id) => selections[id] === null);
                if (!selectedLeftId) return;
                setSelections({ ...selections, [selectedLeftId]: pair.right });
              }}
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                border: `2px solid ${Object.values(selections).includes(pair.right) ? '#16a34a' : '#e2e8f0'}`,
                background: Object.values(selections).includes(pair.right) ? '#f0fdf4' : '#fff',
                textAlign: 'left',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              {pair.right}
            </button>
          ))}
        </div>
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
