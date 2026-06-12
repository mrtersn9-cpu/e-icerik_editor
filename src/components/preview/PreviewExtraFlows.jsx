import { useState, useMemo, useEffect, useCallback } from 'react';

import { DEFAULT_ACTIVITY_SETTINGS } from '../../constants';
import { getReadyButtonTextStylePatch } from '../../logic/buttonStyling';
import { shuffleArray } from '../../logic/uiPrimitives';
import {
  evaluateStorylineRuntimeMatching,
  evaluateStorylineRuntimeSequence,
  evaluateStorylineRuntimeTextEntry,
  evaluateStorylineRuntimeFillBlank,
  evaluateStorylineRuntimeNumeric,
  evaluateStorylineRuntimeSurvey,
  evaluateStorylineRuntimeHotspot,
  evaluateStorylineRuntimeMixed,
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

function previewButtonTextStyle(activity) {
  return {
    ...getReadyButtonTextStylePatch(activity),
    whiteSpace: 'nowrap',
  };
}

function previewActionButtonStyle(activity, variant = 'primary', extra = {}) {
  const primary = variant === 'primary';
  return {
    padding: '10px 18px',
    borderRadius: 8,
    border: primary ? 'none' : '1px solid #cbd5e1',
    background: primary ? '#1d4ed8' : '#fff',
    color: primary ? '#fff' : '#0f172a',
    fontWeight: primary ? 900 : 800,
    cursor: 'pointer',
    ...extra,
    ...previewButtonTextStyle(activity),
  };
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
      {result && (() => {
        const isSuccess = !!result.success;
        const isCompleted = !!result.completed;
        let bg = '#fee2e2';
        let border = '#fecaca';
        let color = '#991b1b';
        let msg = settings.answerFeedback?.incorrectMessage || 'Yanlış cevap.';

        if (isSuccess) {
          bg = '#dcfce7';
          border = '#86efac';
          color = '#166534';
          msg = settings.answerFeedback?.correctMessage || 'Tebrikler!';
        } else if (isCompleted && (result.revealed > 0 || result.assisted)) {
          bg = '#f3e8ff';
          border = '#e9d5ff';
          color = '#5b21b6';
          msg = '✎ Etkinlik çözüm desteğiyle tamamlandı.';
        }

        return (
          <div
            aria-live="polite"
            aria-atomic="true"
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 8,
              background: bg,
              border: `1px solid ${border}`,
              transition: 'background 0.2s'
            }}
          >
            <div style={{ fontWeight: 800, color: color }}>
              {msg}
            </div>
            {typeof result.correct === 'number' && typeof result.total === 'number' && (
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                {result.correct} / {result.total} doğru
              </div>
            )}
          </div>
        );
      })()}
      {result && canRetry && (
        <button onClick={() => setResult(null)} style={previewActionButtonStyle(activity, 'secondary', { marginTop: 8, padding: '6px 14px', borderRadius: 6, fontWeight: 700 })}>
          Tekrar Dene
        </button>
      )}
    </div>
  );
}

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

export function PreviewSurveyFlow({ activity }) {
  const [phase, setPhase] = useState('play');
  const [result, setResult] = useState(null);
  const [responses, setResponses] = useState({});
  const questions = activity.surveyQuestions || [];

  const handleCheck = useCallback(() => {
    const evalResult = evaluateStorylineRuntimeSurvey({ state: { surveyResponses: responses } });
    setResult(evalResult.success ? 'success' : 'failure');
    setPhase('result');
  }, [responses]);

  const handleRestart = () => {
    setResponses({});
    setResult(null);
    setPhase('play');
  };

  const setResponse = (questionId, value) => {
    setResponses((prev) => ({ ...prev, [questionId]: value }));
  };

  if (phase === 'result') {
    return (
      <FeedbackOverlay
        result={result}
        activity={activity}
        onRestart={handleRestart}
      />
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 900 }}>Anket</div>
      </div>
      {activity.surveyAnonymous !== false && (
        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 12 }}>
          Bu anket anonimdir. Kişisel bilgileriniz kaydedilmez.
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {questions.map((q, idx) => (
          <div key={q.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#334155', marginBottom: 10 }}>
              {idx + 1}. {q.prompt || 'Soru'}
            </div>
            {q.type === 'likert' && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(q.options || []).map((opt) => (
                  <label
                    key={opt}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: '1px solid #e2e8f0',
                      cursor: 'pointer',
                      background: responses[q.id] === opt ? '#dbeafe' : '#fff',
                      fontSize: 12,
                    }}
                  >
                    <input
                      type="radio"
                      name={`survey-${q.id}`}
                      value={opt}
                      checked={responses[q.id] === opt}
                      onChange={() => setResponse(q.id, opt)}
                      style={{ accentColor: '#1d4ed8' }}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            )}
            {q.type === 'open-text' && (
              <textarea
                value={responses[q.id] || ''}
                onChange={(e) => setResponse(q.id, e.target.value)}
                placeholder="Görüşlerinizi yazın..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  fontSize: 13,
                  resize: 'vertical',
                }}
              />
            )}
            {(!q.type || q.type === 'single-choice') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(q.options || []).map((opt) => (
                  <label
                    key={opt}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: '1px solid #e2e8f0',
                      cursor: 'pointer',
                      background: responses[q.id] === opt ? '#dbeafe' : '#fff',
                      fontSize: 12,
                    }}
                  >
                    <input
                      type="radio"
                      name={`survey-${q.id}`}
                      value={opt}
                      checked={responses[q.id] === opt}
                      onChange={() => setResponse(q.id, opt)}
                      style={{ accentColor: '#1d4ed8' }}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
        <button onClick={handleCheck} style={previewActionButtonStyle(activity, 'primary')}>
          Gönder
        </button>
        <button onClick={handleRestart} style={previewActionButtonStyle(activity, 'secondary')}>
          Temizle
        </button>
      </div>
    </div>
  );
}

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
      <div style={{ fontSize: 32, fontWeight: 900, color: isSuccess ? '#166534' : '#991b1b' }}>{isSuccess ? '✓' : '×'}</div>
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
        <button onClick={onRestart} style={previewActionButtonStyle(activity, 'secondary')}>
          {settings.restartText || 'Yeniden Başlat'}
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
          <button onClick={() => setVisible((v) => !v)} style={previewActionButtonStyle(activity, 'secondary', { padding: '4px 10px', borderRadius: 6, fontSize: 12 })}>
            {visible ? 'İpucunu Gizle' : 'İpucu Göster'}
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
            <button onClick={() => move(index, -1)} disabled={index === 0} style={previewActionButtonStyle(activity, 'secondary', { padding: '4px 8px', borderRadius: 6, background: '#f8fafc', fontSize: 12 })}>Yukarı</button>
            <button onClick={() => move(index, 1)} disabled={index === items.length - 1} style={previewActionButtonStyle(activity, 'secondary', { padding: '4px 8px', borderRadius: 6, background: '#f8fafc', fontSize: 12 })}>Aşağı</button>
          </div>
        ))}
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

export function PreviewMixedFlow({ activity }) {
  const [phase, setPhase] = useState('play');
  const [result, setResult] = useState(null);
  const [values, setValues] = useState({});
  const [attempts, setAttempts] = useState(0);
  const items = activity.mixedItems || [];
  const settings = { ...DEFAULT_ACTIVITY_SETTINGS, ...(activity.settings || {}) };
  const answerControl = activity.answerControl || {};
  const maxAttempts = answerControl.maxAttempts || settings.maxAttempts || 0;

  const handleCheck = useCallback(() => {
    if (maxAttempts > 0 && attempts >= maxAttempts) return;
    const evalResult = evaluateStorylineRuntimeMixed({ slide: activity, state: { mixedAnswers: values } });
    setResult(evalResult.success ? 'success' : 'failure');
    setPhase('result');
    setAttempts((a) => a + 1);
  }, [activity, attempts, maxAttempts, values]);

  const handleRestart = () => {
    setValues({});
    setResult(null);
    setPhase('play');
  };

  if (phase === 'result') {
    const evalResult = evaluateStorylineRuntimeMixed({ slide: activity, state: { mixedAnswers: values } });
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
    <div style={{ padding: 24, maxWidth: 720, margin: '0 auto', fontSize: 15 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 900 }}>Karma Etkinlik</div>
        {maxAttempts > 0 && (
          <span style={{ fontSize: 12, color: '#64748b' }}>
            Deneme: {attempts} / {maxAttempts}
          </span>
        )}
      </div>
      <HintBox activity={activity} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {items.map((item, idx) => {
          const itemVal = values[item.id] || {};
          let mixedBlankIndex = 0;
          return (
            <div
              key={item.id}
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: 12,
                padding: 16,
                background: '#ffffff',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
              }}
            >
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 900, background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: 999 }}>
                  Soru {idx + 1}
                </span>
                <span style={{ fontWeight: 800, color: '#1e293b' }}>{item.question}</span>
              </div>

              {item.type === 'selection' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 8 }}>
                  {(item.options || []).map((opt) => {
                    const isMulti = item.mode === 'multi';
                    const isSelected = Array.isArray(itemVal) ? itemVal.includes(opt.id) : itemVal === opt.id;
                    const handleChange = () => {
                      if (isMulti) {
                        const current = Array.isArray(itemVal) ? itemVal : [];
                        const next = current.includes(opt.id) ? current.filter(id => id !== opt.id) : [...current, opt.id];
                        setValues({ ...values, [item.id]: next });
                      } else {
                        setValues({ ...values, [item.id]: opt.id });
                      }
                    };
                    return (
                      <label key={opt.id} style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', fontSize: 14 }}>
                        <input
                          type={isMulti ? 'checkbox' : 'radio'}
                          name={`mixed-selection-${item.id}`}
                          checked={isSelected}
                          onChange={handleChange}
                          style={{ accentColor: '#2563eb' }}
                        />
                        <span>{opt.label}</span>
                      </label>
                    );
                  })}
                </div>
              )}

              {item.type === 'drag-drop' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 8 }}>
                  {(item.pairs || []).map((pair) => {
                    const pairVal = itemVal[pair.id] || '';
                    const rightOptions = (item.pairs || []).map(p => p.right).filter(Boolean);
                    return (
                      <div key={pair.id} style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 14 }}>
                        <span style={{ minWidth: 100, fontWeight: 700, color: '#475569' }}>{pair.left}</span>
                        <span style={{ color: '#cbd5e1' }}>➔</span>
                        <select
                          value={pairVal}
                          onChange={(e) => {
                            const nextItemVal = { ...itemVal, [pair.id]: e.target.value };
                            setValues({ ...values, [item.id]: nextItemVal });
                          }}
                          style={{
                            height: 32,
                            borderRadius: 6,
                            border: '1px solid #cbd5e1',
                            fontSize: 13,
                            padding: '0 8px',
                            background: '#fff',
                            flex: 1,
                            maxWidth: 240,
                          }}
                        >
                          <option value="">Seçiniz...</option>
                          {rightOptions.map((opt, oIdx) => (
                            <option key={oIdx} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              )}

              {(item.type === 'text-entry' || item.type === 'numeric') && (
                <div style={{ paddingLeft: 8 }}>
                  <input
                    type={item.type === 'numeric' ? 'number' : 'text'}
                    value={values[item.id] || ''}
                    onChange={(e) => setValues({ ...values, [item.id]: e.target.value })}
                    placeholder="Yanıtınızı buraya girin..."
                    style={{
                      width: '100%',
                      maxWidth: 320,
                      height: 36,
                      borderRadius: 8,
                      border: '1px solid #cbd5e1',
                      fontSize: 14,
                      padding: '0 10px',
                    }}
                  />
                </div>
              )}

              {item.type === 'fill-blank' && (
                <div style={{ paddingLeft: 8 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, lineHeight: 2.2 }}>
                    {(item.sentence || '').split(/(___)/g).filter(Boolean).map((part, pIdx) => {
                      if (part === '___') {
                        const blankIdx = mixedBlankIndex;
                        mixedBlankIndex += 1;
                        const blankVal = itemVal[blankIdx] || '';
                        return (
                          <input
                            key={pIdx}
                            value={blankVal}
                            onChange={(e) => {
                              const nextItemVal = { ...itemVal, [blankIdx]: e.target.value };
                              setValues({ ...values, [item.id]: nextItemVal });
                            }}
                            placeholder="..."
                            style={{
                              width: 100,
                              padding: '2px 6px',
                              borderRadius: 6,
                              border: '1px solid #cbd5e1',
                              fontSize: 13,
                              textAlign: 'center',
                            }}
                          />
                        );
                      }
                      return <span key={pIdx}>{part}</span>;
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 24, display: 'flex', gap: 10, alignItems: 'center' }}>
        <button
          onClick={handleCheck}
          disabled={maxAttempts > 0 && attempts >= maxAttempts}
          style={previewActionButtonStyle(activity, 'primary', {
            padding: '10px 20px',
            opacity: maxAttempts > 0 && attempts >= maxAttempts ? 0.5 : 1
          })}
        >
          {settings.checkButtonText || 'Kontrol Et'}
        </button>
        <button
          onClick={handleRestart}
          style={previewActionButtonStyle(activity, 'secondary', {
            padding: '10px 20px',
          })}
        >
          Temizle
        </button>
      </div>
    </div>
  );
}
