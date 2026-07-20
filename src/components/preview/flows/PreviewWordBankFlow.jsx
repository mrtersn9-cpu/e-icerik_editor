import { useState, useMemo, useCallback } from 'react';

import { DEFAULT_ACTIVITY_SETTINGS } from '../../../constants';
import { shuffleArray } from '../../../logic/uiPrimitives';
import { evaluateStorylineRuntimeFillBlank } from '../../../utils/storylineRuntimeEngine';

import { previewActionButtonStyle, FeedbackOverlay, HintBox } from './shared';
export function PreviewWordBankFlow({ activity }) {
  const [phase, setPhase] = useState('play');
  const [result, setResult] = useState(null);
  const [placed, setPlaced] = useState({}); // blankId -> chipId
  const [attempts, setAttempts] = useState(0);
  const settings = { ...DEFAULT_ACTIVITY_SETTINGS, ...(activity.settings || {}) };
  const answerControl = activity.answerControl || {};
  const maxAttempts = answerControl.maxAttempts || settings.maxAttempts || 0;
  const answers = useMemo(() => activity.fillBlankAnswers || [], [activity.fillBlankAnswers]);
  const sentence = activity.fillBlankSentence || '';
  const chips = useMemo(() => {
    const corrects = answers.map((a) => (a.acceptedValues || [])[0] || '');
    const distractors = String(activity.wordBankExtra || '').split(',').map((w) => w.trim()).filter(Boolean);
    const list = [...corrects, ...distractors].filter(Boolean).map((word, i) => ({ id: `chip-${i}`, word }));
    return shuffleArray(list);
  }, [answers, activity.wordBankExtra]);
  const chipById = (id) => chips.find((c) => c.id === id);
  const usedChipIds = new Set(Object.values(placed));
  const placeChip = (blankId, chipId) => {
    setPlaced((prev) => {
      const next = {};
      Object.entries(prev).forEach(([bid, cid]) => {
        if (bid !== blankId && cid !== chipId) next[bid] = cid;
      });
      next[blankId] = chipId;
      return next;
    });
  };
  const clearBlank = (blankId) => setPlaced((prev) => {
    const next = { ...prev };
    delete next[blankId];
    return next;
  });
  const fillBlankValues = useMemo(() => {
    const values = {};
    answers.forEach((a) => {
      const cid = placed[a.id];
      if (cid) {
        const chip = chips.find((c) => c.id === cid);
        if (chip) values[a.id] = chip.word;
      }
    });
    return values;
  }, [placed, answers, chips]);
  const handleCheck = useCallback(() => {
    if (maxAttempts > 0 && attempts >= maxAttempts) return;
    const evalResult = evaluateStorylineRuntimeFillBlank({ slide: activity, state: { fillBlankValues } });
    setResult(evalResult.success ? 'success' : 'failure');
    setPhase('result');
    setAttempts((a) => a + 1);
  }, [activity, attempts, maxAttempts, fillBlankValues]);
  const handleRestart = () => {
    setPlaced({});
    setResult(null);
    setPhase('play');
  };
  const parts = sentence.split(/(___|\{.+?\})/g).filter(Boolean);
  let blankIdx = 0;
  if (phase === 'result') {
    return <FeedbackOverlay result={result} activity={activity} onRestart={handleRestart} />;
  }
  return (
    <div style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
      <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 12 }}>Kelime Bankası</div>
      <HintBox activity={activity} />
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, fontSize: 16, lineHeight: 2.4 }}>
        {parts.map((part, i) => {
          const isBlank = part === '___' || (part.startsWith('{') && part.endsWith('}'));
          if (!isBlank) return <span key={i}>{part}</span>;
          const answer = answers[blankIdx];
          blankIdx += 1;
          if (!answer) return <span key={i}>___</span>;
          const cid = placed[answer.id];
          const chip = cid ? chipById(cid) : null;
          return (
            <span
              key={answer.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData('text/plain');
                if (id) placeChip(answer.id, id);
              }}
              onClick={() => chip && clearBlank(answer.id)}
              title={chip ? 'Geri almak için tıkla' : 'Buraya kelime sürükle'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 92,
                minHeight: 34,
                padding: '2px 10px',
                margin: '0 2px',
                borderRadius: 8,
                border: `2px ${chip ? 'solid' : 'dashed'} ${chip ? '#86efac' : '#cbd5e1'}`,
                background: chip ? '#f0fdf4' : '#f8fafc',
                color: '#166534',
                fontWeight: 800,
                fontSize: 15,
                cursor: chip ? 'pointer' : 'default',
                verticalAlign: 'middle',
              }}
            >
              {chip ? chip.word : ''}
            </span>
          );
        })}
      </div>
      <div style={{ marginTop: 18, padding: 12, borderRadius: 12, background: '#f1f5f9', border: '1px solid #e2e8f0' }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', marginBottom: 8 }}>KELİME BANKASI</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {chips.filter((c) => !usedChipIds.has(c.id)).map((c) => (
            <span
              key={c.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', c.id);
                e.dataTransfer.effectAllowed = 'move';
              }}
              style={{ padding: '6px 14px', borderRadius: 999, border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', fontWeight: 800, fontSize: 14, cursor: 'grab' }}
            >
              {c.word}
            </span>
          ))}
          {chips.filter((c) => !usedChipIds.has(c.id)).length === 0 && (
            <span style={{ color: '#94a3b8', fontSize: 12 }}>Tüm kelimeler yerleştirildi</span>
          )}
        </div>
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
