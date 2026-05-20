import { useState, useMemo, useEffect, useCallback } from 'react';

import { DEFAULT_ACTIVITY_SETTINGS } from '../../constants';
import { shuffleArray } from '../../logic/uiPrimitives';
import {
  evaluateStorylineRuntimeMatching,
  evaluateStorylineRuntimeSequence,
  evaluateStorylineRuntimeTextEntry,
  evaluateStorylineRuntimeFillBlank,
} from '../../utils/storylineRuntimeEngine';

import PreviewPuzzleFlow from './PreviewPuzzleFlow';

function usePreviewTimer(activity, onTimeout) {
  const settings = activity.settings || {};
  const minutes = settings.timeLimitMinutes || 5;
  const enabled = !!settings.timeLimitEnabled;
  const [secondsLeft, setSecondsLeft] = useState(enabled ? minutes * 60 : 0);
  useEffect(() => {
    if (!enabled || secondsLeft <= 0) return;
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(id);
          onTimeout?.();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [enabled, secondsLeft, onTimeout]);
  return { secondsLeft, enabled };
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

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
      {result && (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: result.success ? '#dcfce7' : '#fee2e2', border: `1px solid ${result.success ? '#86efac' : '#fecaca'}` }}>
          <div style={{ fontWeight: 800, color: result.success ? '#166534' : '#991b1b' }}>
            {result.success
              ? (settings.answerFeedback?.correctMessage || 'Tebrikler!')
              : (settings.answerFeedback?.incorrectMessage || 'Yanlis cevap.')}
          </div>
          {typeof result.correct === 'number' && typeof result.total === 'number' && (
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
              {result.correct} / {result.total} dogru
            </div>
          )}
        </div>
      )}
      {result && canRetry && (
        <button onClick={() => setResult(null)} style={{ marginTop: 8, padding: '6px 14px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', fontWeight: 700 }}>
          Tekrar Dene
        </button>
      )}
    </div>
  );
}

function FeedbackOverlay({ result, activity, onRestart, earnedPoints, totalPoints }) {
  const feedback = activity.answerFeedback || {};
  const settings = { ...DEFAULT_ACTIVITY_SETTINGS, ...(activity.settings || {}) };
  const isSuccess = result === 'success';
  const title = isSuccess
    ? (feedback.correctMessage || 'Tebrikler!')
    : (feedback.incorrectMessage || 'Tekrar dene');
  const animation = isSuccess
    ? (feedback.animation || 'Confetti')
    : (feedback.incorrectAnimation || 'Sallanma');
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: 320, gap: 16, padding: 24 }}>
      <div style={{ fontSize: 32 }}>{isSuccess ? '🏆' : '💪'}</div>
      <div style={{ fontSize: 20, fontWeight: 900, color: isSuccess ? '#166534' : '#991b1b' }}>
        {title}
      </div>
      {typeof earnedPoints === 'number' && (
        <div style={{ fontSize: 14, color: '#64748b' }}>
          Puan: {earnedPoints}{totalPoints ? ` / ${totalPoints}` : ''}
        </div>
      )}
      <div style={{ fontSize: 12, color: '#94a3b8' }}>{animation}</div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onRestart} style={{ padding: '10px 18px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', fontWeight: 800 }}>
          {settings.restartText || 'Yeniden Baslat'}
        </button>
      </div>
    </div>
  );
}

function HintBox({ activity }) {
  const hints = activity.answerHints || {};
  const [visible, setVisible] = useState(false);
  if (!hints.hintText && !hints.explanationText) return null;
  return (
    <div style={{ marginBottom: 16, padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc' }}>
      {hints.hintText && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: visible ? 8 : 0 }}>
          <button onClick={() => setVisible((v) => !v)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', fontSize: 12, fontWeight: 800 }}>
            {visible ? 'Ipucunu Gizle' : 'Ipucu Goster'}
          </button>
        </div>
      )}
      {visible && hints.hintText && (
        <div style={{ fontSize: 13, color: '#475569', marginTop: 6 }}>{hints.hintText}</div>
      )}
      {visible && hints.explanationText && (
        <div style={{ fontSize: 13, color: '#64748b', marginTop: 6 }}>{hints.explanationText}</div>
      )}
    </div>
  );
}

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
        <div style={{ fontSize: 16, fontWeight: 900 }}>Eslestirme</div>
        {timerEnabled && <div style={{ fontSize: 13, fontWeight: 900, color: secondsLeft <= 30 ? '#dc2626' : '#64748b' }}>{formatTime(secondsLeft)}</div>}
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
          <div style={{ fontSize: 12, fontWeight: 900, color: '#64748b' }}>Sag</div>
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
        <button onClick={handleCheck} disabled={maxAttempts > 0 && attempts >= maxAttempts} style={{ padding: '10px 18px', borderRadius: 8, border: 'none', background: '#1d4ed8', color: '#fff', fontWeight: 900, opacity: maxAttempts > 0 && attempts >= maxAttempts ? 0.5 : 1 }}>
          {settings.checkButtonText || 'Kontrol Et'}
        </button>
        <button onClick={handleRestart} style={{ padding: '10px 18px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', fontWeight: 800 }}>
          Temizle
        </button>
        {maxAttempts > 0 && <span style={{ fontSize: 12, color: '#64748b' }}>Deneme: {attempts} / {maxAttempts}</span>}
      </div>
    </div>
  );
}

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
  if (phase === 'result') {
    return <FeedbackOverlay result={result} activity={activity} onRestart={handleRestart} />;
  }
  return (
    <div style={{ padding: 24, maxWidth: 520, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 900 }}>Sirala</div>
        {timerEnabled && <div style={{ fontSize: 13, fontWeight: 900, color: secondsLeft <= 30 ? '#dc2626' : '#64748b' }}>{formatTime(secondsLeft)}</div>}
      </div>
      <HintBox activity={activity} />
      <div style={{ display: 'grid', gap: 8 }}>
        {items.map((item, index) => (
          <div
            key={item.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '34px 1fr auto auto',
              gap: 8,
              alignItems: 'center',
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              background: '#fff',
            }}
          >
            <span style={{ fontWeight: 900, color: '#64748b' }}>{activity.sequenceAutoNumber !== false ? index + 1 : '•'}</span>
            <span style={{ fontWeight: 800 }}>{item.label}</span>
            <button onClick={() => move(index, -1)} disabled={index === 0} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#f8fafc', fontSize: 12 }}>Yukari</button>
            <button onClick={() => move(index, 1)} disabled={index === items.length - 1} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#f8fafc', fontSize: 12 }}>Asagi</button>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
        <button onClick={handleCheck} disabled={maxAttempts > 0 && attempts >= maxAttempts} style={{ padding: '10px 18px', borderRadius: 8, border: 'none', background: '#1d4ed8', color: '#fff', fontWeight: 900, opacity: maxAttempts > 0 && attempts >= maxAttempts ? 0.5 : 1 }}>
          {settings.checkButtonText || 'Kontrol Et'}
        </button>
        <button onClick={handleRestart} style={{ padding: '10px 18px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', fontWeight: 800 }}>
          Sifirla
        </button>
        {maxAttempts > 0 && <span style={{ fontSize: 12, color: '#64748b' }}>Deneme: {attempts} / {maxAttempts}</span>}
      </div>
    </div>
  );
}

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
        <div style={{ fontSize: 16, fontWeight: 900 }}>{activity.textEntryPrompt || 'Yanitinizi yazin'}</div>
        {timerEnabled && <div style={{ fontSize: 13, fontWeight: 900, color: secondsLeft <= 30 ? '#dc2626' : '#64748b' }}>{formatTime(secondsLeft)}</div>}
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
        <button onClick={handleCheck} disabled={maxAttempts > 0 && attempts >= maxAttempts} style={{ padding: '10px 18px', borderRadius: 8, border: 'none', background: '#1d4ed8', color: '#fff', fontWeight: 900, opacity: maxAttempts > 0 && attempts >= maxAttempts ? 0.5 : 1 }}>
          {settings.checkButtonText || 'Kontrol Et'}
        </button>
        <button onClick={handleRestart} style={{ padding: '10px 18px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', fontWeight: 800 }}>
          Temizle
        </button>
        {activity.textEntryVoiceInput && (
          <button onClick={startVoice} style={{ padding: '10px 18px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#f0fdf4', color: '#166534', fontWeight: 800 }}>
            🎤 Sesle Yaz
          </button>
        )}
        {maxAttempts > 0 && <span style={{ fontSize: 12, color: '#64748b' }}>Deneme: {attempts} / {maxAttempts}</span>}
      </div>
    </div>
  );
}

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
  const parts = sentence.split(/(\{.+?\})/g).filter(Boolean);
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
        <div style={{ fontSize: 16, fontWeight: 900 }}>Bosluklari doldur</div>
        {timerEnabled && <div style={{ fontSize: 13, fontWeight: 900, color: secondsLeft <= 30 ? '#dc2626' : '#64748b' }}>{formatTime(secondsLeft)}</div>}
      </div>
      <HintBox activity={activity} />
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
        {parts.map((part, i) => {
          if (part.startsWith('{') && part.endsWith('}')) {
            const answer = answers[blankIndex];
            blankIndex += 1;
            const answerId = answer?.id || `blank-${i}`;
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
        <button onClick={handleCheck} disabled={maxAttempts > 0 && attempts >= maxAttempts} style={{ padding: '10px 18px', borderRadius: 8, border: 'none', background: '#1d4ed8', color: '#fff', fontWeight: 900, opacity: maxAttempts > 0 && attempts >= maxAttempts ? 0.5 : 1 }}>
          {settings.checkButtonText || 'Kontrol Et'}
        </button>
        <button onClick={handleRestart} style={{ padding: '10px 18px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', fontWeight: 800 }}>
          Temizle
        </button>
        {maxAttempts > 0 && <span style={{ fontSize: 12, color: '#64748b' }}>Deneme: {attempts} / {maxAttempts}</span>}
      </div>
    </div>
  );
}
