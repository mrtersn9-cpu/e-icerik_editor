import { useState, useCallback } from 'react';

import { DEFAULT_ACTIVITY_SETTINGS } from '../../../constants';
import { evaluateStorylineRuntimeHotspot } from '../../../utils/storylineRuntimeEngine';

import { usePreviewTimer, formatTime, previewActionButtonStyle, FeedbackOverlay, HintBox } from './shared';
export function PreviewHotspotFlow({ activity }) {
  const [phase, setPhase] = useState('play');
  const [result, setResult] = useState(null);
  const [clickedIds, setClickedIds] = useState([]);
  const [attempts, setAttempts] = useState(0);
  const settings = { ...DEFAULT_ACTIVITY_SETTINGS, ...(activity.settings || {}) };
  const answerControl = activity.answerControl || {};
  const maxAttempts = answerControl.maxAttempts || settings.maxAttempts || 0;
  const hotspots = (activity.objects || []).filter((obj) => obj.type === 'hotspot');
  const { secondsLeft, enabled: timerEnabled } = usePreviewTimer(activity, () => {
    setResult('failure');
    setPhase('result');
  });

  const handleCheck = useCallback(() => {
    if (maxAttempts > 0 && attempts >= maxAttempts) return;
    const evalResult = evaluateStorylineRuntimeHotspot({ slide: activity, objects: activity.objects, state: { clickedHotspots: clickedIds } });
    setResult(evalResult.success ? 'success' : 'failure');
    setPhase('result');
    setAttempts((a) => a + 1);
  }, [activity, attempts, maxAttempts, clickedIds]);

  const handleRestart = () => {
    setClickedIds([]);
    setResult(null);
    setPhase('play');
  };

  const toggleHotspot = (id) => {
    setClickedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const stageW = activity.stageWidth || 800;
  const stageH = activity.stageHeight || 600;
  const scale = Math.min(1, 560 / stageW, 420 / stageH);

  if (phase === 'result') {
    return <FeedbackOverlay result={result} activity={activity} onRestart={handleRestart} />;
  }

  return (
    <div style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 900 }}>Etkin Alan</div>
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
        {activity.hotspotQuestion || 'Görseldeki doğru alanları işaretleyin.'}
      </div>
      <div
        style={{
          position: 'relative',
          width: stageW * scale,
          height: stageH * scale,
          backgroundColor: '#f1f5f9',
          backgroundImage: activity.hotspotImage ? `url(${activity.hotspotImage})` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          borderRadius: 8,
          border: '1px solid #e2e8f0',
          marginBottom: 16,
          overflow: 'hidden',
        }}
      >
        <span role="img" aria-label={activity.hotspotImage ? (activity.hotspotImageAlt || 'Etkileşimli görsel') : 'Etkin alan görseli'} style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }} />
        {hotspots.map((h) => {
          const isClicked = clickedIds.includes(h.id);
          return (
            <button
              key={h.id}
              onClick={() => toggleHotspot(h.id)}
              title={h.label || 'Hotspot'}
              style={{
                position: 'absolute',
                left: (h.x || 0) * scale,
                top: (h.y || 0) * scale,
                width: Math.max(24, (h.width || 64) * scale),
                height: Math.max(24, (h.height || 64) * scale),
                borderRadius: h.style?.borderRadius || 999,
                border: `2px solid ${isClicked ? '#1d4ed8' : (h.style?.borderColor || '#f44336')}`,
                background: isClicked ? '#dbeafe' : (h.style?.background || '#f4433666'),
                color: h.style?.color || '#fff',
                fontSize: Math.max(10, (h.style?.fontSize || 14) * scale),
                fontWeight: 700,
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center',
                padding: 2,
                opacity: isClicked ? 0.9 : 0.75,
              }}
            >
              {isClicked ? '✓' : (h.label || '?')}
            </button>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
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
