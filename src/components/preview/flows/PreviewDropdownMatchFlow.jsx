import { useState, useMemo, useCallback } from 'react';

import { DEFAULT_ACTIVITY_SETTINGS } from '../../../constants';
import { shuffleArray } from '../../../logic/uiPrimitives';
import { evaluateStorylineRuntimeMatching } from '../../../utils/storylineRuntimeEngine';

import { previewActionButtonStyle, FeedbackOverlay, HintBox } from './shared';
export function PreviewDropdownMatchFlow({ activity }) {
  const [phase, setPhase] = useState('play');
  const [result, setResult] = useState(null);
  const [selections, setSelections] = useState({});
  const [attempts, setAttempts] = useState(0);
  const pairs = useMemo(() => activity.matchingPairs || [], [activity.matchingPairs]);
  const settings = { ...DEFAULT_ACTIVITY_SETTINGS, ...(activity.settings || {}) };
  const answerControl = activity.answerControl || {};
  const maxAttempts = answerControl.maxAttempts || settings.maxAttempts || 0;
  const rights = useMemo(() => {
    const vals = pairs.map((p) => p.right);
    return activity.matchingShuffle !== false ? shuffleArray([...vals]) : vals;
  }, [pairs, activity.matchingShuffle]);
  const handleCheck = useCallback(() => {
    if (maxAttempts > 0 && attempts >= maxAttempts) return;
    const evalResult = evaluateStorylineRuntimeMatching({ slide: activity, state: { matchingSelections: selections } });
    setResult(evalResult.success ? 'success' : 'failure');
    setPhase('result');
    setAttempts((a) => a + 1);
  }, [activity, attempts, maxAttempts, selections]);
  const handleRestart = () => { setSelections({}); setResult(null); setPhase('play'); };
  if (phase === 'result') {
    return <FeedbackOverlay result={result} activity={activity} onRestart={handleRestart} />;
  }
  return (
    <div style={{ padding: 24, maxWidth: 640, margin: '0 auto' }}>
      <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 12 }}>Eşleştir</div>
      <HintBox activity={activity} />
      <div style={{ display: 'grid', gap: 10 }}>
        {pairs.map((pair) => (
          <div
            key={pair.id}
            style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10, alignItems: 'center', padding: '10px 12px', borderRadius: 10, border: `1px solid ${selections[pair.id] ? '#bbf7d0' : '#e2e8f0'}`, background: selections[pair.id] ? '#f0fdf4' : '#fff' }}
          >
            <span style={{ fontWeight: 800 }}>{pair.left}</span>
            <select
              value={selections[pair.id] || ''}
              onChange={(e) => setSelections({ ...selections, [pair.id]: e.target.value })}
              style={{ height: 38, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, padding: '0 10px', background: '#fff' }}
            >
              <option value="">— Seç —</option>
              {rights.map((rv, i) => (
                <option key={i} value={rv}>{rv}</option>
              ))}
            </select>
          </div>
        ))}
        {!pairs.length && <span style={{ color: '#64748b', fontSize: 12 }}>Eşleşme yok.</span>}
      </div>
      <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
        <button onClick={handleCheck} disabled={maxAttempts > 0 && attempts >= maxAttempts} style={previewActionButtonStyle(activity, 'primary', { opacity: maxAttempts > 0 && attempts >= maxAttempts ? 0.5 : 1 })}>
          {settings.checkButtonText || 'Kontrol Et'}
        </button>
        <button onClick={handleRestart} style={previewActionButtonStyle(activity, 'secondary')}>Temizle</button>
        {maxAttempts > 0 && <span style={{ fontSize: 12, color: '#64748b' }}>Deneme: {attempts} / {maxAttempts}</span>}
      </div>
    </div>
  );
}
