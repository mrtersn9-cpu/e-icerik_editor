import { useState, useCallback } from 'react';

import { DEFAULT_ACTIVITY_SETTINGS } from '../../../constants';
import { shuffleArray } from '../../../logic/uiPrimitives';
import { evaluateStorylineRuntimeSequence } from '../../../utils/storylineRuntimeEngine';

import { usePreviewTimer, formatTime, previewActionButtonStyle, FeedbackOverlay, HintBox } from './shared';
export function PreviewSequenceFlow({ activity }) {
  const [phase, setPhase] = useState('play');
  const [result, setResult] = useState(null);
  const [items, setItems] = useState(() => {
    const base = activity.sequenceItems || [];
    if (activity.sequenceShuffle !== false) return shuffleArray([...base]);
    return [...base];
  });
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
    const evalResult = evaluateStorylineRuntimeSequence({ slide: activity, state: { sequenceOrder: items.map((i) => i.id) } });
    setResult(evalResult.success ? 'success' : 'failure');
    setPhase('result');
    setAttempts((a) => a + 1);
  }, [activity, attempts, maxAttempts, items]);
  const handleRestart = () => {
    const base = activity.sequenceItems || [];
    setItems(activity.sequenceShuffle !== false ? shuffleArray([...base]) : [...base]);
    setResult(null);
    setPhase('play');
  };
  const move = (index, dir) => {
    const next = [...items];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
  };
  // Sürükleyerek yeniden dizme (yerinde, ayrı alan yok).
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);
  const reorder = (from, to) => {
    if (from == null || to == null || from === to) return;
    setItems((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };
  if (phase === 'result') {
    return <FeedbackOverlay result={result} activity={activity} onRestart={handleRestart} />;
  }
  return (
    <div style={{ padding: 24, maxWidth: 520, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 900 }}>Sırala</div>
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
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
        Öğeleri <strong>sürükleyerek</strong> doğru sıraya diz (ya da ↑ ↓ kullan).
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {items.map((item, index) => {
          const isDragging = dragIndex === index;
          const isOver = overIndex === index && dragIndex !== null && dragIndex !== index;
          return (
            <div
              key={item.id}
              draggable
              onDragStart={(event) => {
                setDragIndex(index);
                event.dataTransfer.effectAllowed = 'move';
                try {
                  event.dataTransfer.setData('text/plain', String(index));
                } catch (error) {
                  /* bazı tarayıcılar setData gerektirir; hata önemsiz */
                }
              }}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                if (overIndex !== index) setOverIndex(index);
              }}
              onDrop={(event) => {
                event.preventDefault();
                reorder(dragIndex, index);
                setDragIndex(null);
                setOverIndex(null);
              }}
              onDragEnd={() => {
                setDragIndex(null);
                setOverIndex(null);
              }}
              style={{
                display: 'grid',
                gridTemplateColumns: '24px 32px 1fr auto auto',
                gap: 8,
                alignItems: 'center',
                padding: '10px 12px',
                borderRadius: 8,
                border: `1px solid ${isOver ? '#1d4ed8' : '#e2e8f0'}`,
                background: isDragging ? '#eff6ff' : '#fff',
                boxShadow: isOver ? '0 0 0 2px #bfdbfe' : 'none',
                opacity: isDragging ? 0.55 : 1,
                cursor: 'grab',
                transition: 'border-color .12s, box-shadow .12s',
              }}
            >
              <span style={{ color: '#94a3b8', fontSize: 16, userSelect: 'none', cursor: 'grab' }} title="Sürükle">⋮⋮</span>
              <span style={{ fontWeight: 900, color: '#64748b' }}>{activity.sequenceAutoNumber !== false ? index + 1 : '•'}</span>
              <span style={{ fontWeight: 800 }}>{item.label}</span>
              <button onClick={() => move(index, -1)} disabled={index === 0} title="Yukarı" style={previewActionButtonStyle(activity, 'secondary', { padding: '4px 9px', borderRadius: 6, background: '#f8fafc', fontSize: 14 })}>↑</button>
              <button onClick={() => move(index, 1)} disabled={index === items.length - 1} title="Aşağı" style={previewActionButtonStyle(activity, 'secondary', { padding: '4px 9px', borderRadius: 6, background: '#f8fafc', fontSize: 14 })}>↓</button>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
        <button onClick={handleCheck} disabled={maxAttempts > 0 && attempts >= maxAttempts} style={previewActionButtonStyle(activity, 'primary', { opacity: maxAttempts > 0 && attempts >= maxAttempts ? 0.5 : 1 })}>
          {settings.checkButtonText || 'Kontrol Et'}
        </button>
        <button onClick={handleRestart} style={previewActionButtonStyle(activity, 'secondary')}>
          Sıfırla
        </button>
        {maxAttempts > 0 && <span style={{ fontSize: 12, color: '#64748b' }}>Deneme: {attempts} / {maxAttempts}</span>}
      </div>
    </div>
  );
}
