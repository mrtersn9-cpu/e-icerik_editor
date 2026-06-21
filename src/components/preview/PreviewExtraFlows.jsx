import { useState, useMemo, useEffect, useCallback, useRef } from 'react';

import { DEFAULT_ACTIVITY_SETTINGS } from '../../constants';
import { playFeedbackSound } from '../../logic/answerFeedbackRuntime';
import { getReadyButtonTextStylePatch } from '../../logic/buttonStyling';
import { shuffleArray } from '../../logic/uiPrimitives';
import {
  evaluateStorylineRuntimeMatching,
  evaluateStorylineRuntimeSequence,
  evaluateStorylineRuntimeTextEntry,
  evaluateStorylineRuntimeFillBlank,
  evaluateStorylineRuntimeNumeric,
  evaluateStorylineRuntimeSlider,
  evaluateStorylineRuntimeShortcut,
  shortcutComboFromEvent,
  normalizeShortcutCombo,
  evaluateStorylineRuntimeSurvey,
  evaluateStorylineRuntimeHotspot,
  evaluateStorylineRuntimeMixed,
} from '../../utils/storylineRuntimeEngine';

import FeedbackAnimation from './FeedbackAnimation';
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

const DIAL_START = 135; // derece — sol-alt başlangıç
const DIAL_SWEEP = 270; // derece — saat yönünde tarama
function dialPolar(cx, cy, r, deg) {
  const a = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}
function dialArcPath(cx, cy, r, startDeg, endDeg) {
  const start = dialPolar(cx, cy, r, startDeg);
  const end = dialPolar(cx, cy, r, endDeg);
  const large = endDeg - startDeg <= 180 ? 0 : 1;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y}`;
}

export function PreviewSliderFlow({ activity }) {
  const min = activity.sliderMin != null ? Number(activity.sliderMin) : 0;
  const max = activity.sliderMax != null ? Number(activity.sliderMax) : 100;
  const step = activity.sliderStep != null && Number(activity.sliderStep) > 0 ? Number(activity.sliderStep) : 1;
  const safeMax = max > min ? max : min + 1;
  const isDial = (activity.sliderMode || 'slider') === 'dial';
  const graded = activity.sliderGraded !== false;
  const unit = activity.sliderUnit || '';

  const [phase, setPhase] = useState('play');
  const [result, setResult] = useState(null);
  const [value, setValue] = useState(min);
  const [attempts, setAttempts] = useState(0);
  const svgRef = useRef(null);
  const draggingRef = useRef(false);
  const settings = { ...DEFAULT_ACTIVITY_SETTINGS, ...(activity.settings || {}) };
  const answerControl = activity.answerControl || {};
  const maxAttempts = answerControl.maxAttempts || settings.maxAttempts || 0;
  const { secondsLeft, enabled: timerEnabled } = usePreviewTimer(activity, () => {
    setResult('failure');
    setPhase('result');
  });

  const clampSnap = useCallback((raw) => {
    let v = Math.min(safeMax, Math.max(min, raw));
    const steps = Math.round((v - min) / step);
    v = min + steps * step;
    v = Math.min(safeMax, Math.max(min, v));
    // Kayan nokta artıklarını temizle
    return Math.round(v * 1e6) / 1e6;
  }, [min, safeMax, step]);

  const handleCheck = useCallback(() => {
    if (maxAttempts > 0 && attempts >= maxAttempts) return;
    const evalResult = evaluateStorylineRuntimeSlider({ slide: activity, state: { sliderValue: value } });
    setResult(evalResult.success ? 'success' : 'failure');
    setPhase('result');
    setAttempts((a) => a + 1);
  }, [activity, attempts, maxAttempts, value]);

  const handleRestart = () => {
    setValue(min);
    setResult(null);
    setPhase('play');
  };

  const pointerToValue = useCallback((clientX, clientY) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let deg = (Math.atan2(clientY - cy, clientX - cx) * 180) / Math.PI;
    if (deg < DIAL_START) deg += 360; // [135, 495)
    let t = (deg - DIAL_START) / DIAL_SWEEP;
    if (deg > DIAL_START + DIAL_SWEEP) {
      // Alt boşluk bölgesi: yarıdan önce maks, sonra min
      t = deg < DIAL_START + DIAL_SWEEP + 45 ? 1 : 0;
    }
    t = Math.min(1, Math.max(0, t));
    return clampSnap(min + t * (safeMax - min));
  }, [clampSnap, min, safeMax]);

  const onDialPointer = useCallback((e) => {
    const v = pointerToValue(e.clientX, e.clientY);
    if (v != null) setValue(v);
  }, [pointerToValue]);

  const startDrag = useCallback((e) => {
    draggingRef.current = true;
    onDialPointer(e);
    const move = (ev) => { if (draggingRef.current) onDialPointer(ev); };
    const up = () => {
      draggingRef.current = false;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }, [onDialPointer]);

  const onDialKey = useCallback((e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { setValue((v) => clampSnap(v + step)); e.preventDefault(); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { setValue((v) => clampSnap(v - step)); e.preventDefault(); }
    else if (e.key === 'Home') { setValue(min); e.preventDefault(); }
    else if (e.key === 'End') { setValue(safeMax); e.preventDefault(); }
  }, [clampSnap, step, min, safeMax]);

  if (phase === 'result') {
    return <FeedbackOverlay result={result} activity={activity} onRestart={handleRestart} />;
  }

  const t = (value - min) / (safeMax - min);
  const valueAngle = DIAL_START + t * DIAL_SWEEP;
  const cx = 110;
  const cy = 110;
  const r = 82;
  const handlePos = dialPolar(cx, cy, r, valueAngle);

  return (
    <div style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 900 }}>{isDial ? 'Kadran' : 'Kaydırıcı'}</div>
        {timerEnabled && (
          <div style={{ fontSize: 13, fontWeight: 900, color: secondsLeft <= 30 ? '#dc2626' : '#64748b', animation: secondsLeft <= 30 ? 'previewTimerPulse 1s infinite' : 'none' }}>
            {formatTime(secondsLeft)}
          </div>
        )}
      </div>
      <HintBox activity={activity} />
      <div style={{ fontSize: 15, color: '#334155', marginBottom: 20, lineHeight: 1.6 }}>
        {activity.sliderPrompt || 'Bir değer seçin:'}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
        <div style={{ fontSize: 30, fontWeight: 900, color: '#1d4ed8' }}>
          {value}{unit ? ` ${unit}` : ''}
        </div>

        {isDial ? (
          <svg
            ref={svgRef}
            width={220}
            height={220}
            role="slider"
            tabIndex={0}
            aria-valuemin={min}
            aria-valuemax={safeMax}
            aria-valuenow={value}
            onPointerDown={startDrag}
            onKeyDown={onDialKey}
            style={{ touchAction: 'none', cursor: 'pointer', outline: 'none' }}
          >
            <path d={dialArcPath(cx, cy, r, DIAL_START, DIAL_START + DIAL_SWEEP)} fill="none" stroke="#e2e8f0" strokeWidth={14} strokeLinecap="round" />
            <path d={dialArcPath(cx, cy, r, DIAL_START, valueAngle)} fill="none" stroke="#1d4ed8" strokeWidth={14} strokeLinecap="round" />
            <line x1={cx} y1={cy} x2={handlePos.x} y2={handlePos.y} stroke="#1d4ed8" strokeWidth={3} />
            <circle cx={cx} cy={cy} r={6} fill="#1d4ed8" />
            <circle cx={handlePos.x} cy={handlePos.y} r={12} fill="#fff" stroke="#1d4ed8" strokeWidth={3} />
          </svg>
        ) : (
          <div style={{ width: '100%', maxWidth: 480 }}>
            <input
              type="range"
              min={min}
              max={safeMax}
              step={step}
              value={value}
              onChange={(e) => setValue(clampSnap(Number(e.target.value)))}
              style={{ width: '100%', accentColor: '#1d4ed8', height: 28 }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
              <span>{min}{unit ? ` ${unit}` : ''}</span>
              <span>{safeMax}{unit ? ` ${unit}` : ''}</span>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'center', marginTop: 24 }}>
        <button onClick={handleCheck} disabled={maxAttempts > 0 && attempts >= maxAttempts} style={previewActionButtonStyle(activity, 'primary', { opacity: maxAttempts > 0 && attempts >= maxAttempts ? 0.5 : 1 })}>
          {graded ? (settings.checkButtonText || 'Kontrol Et') : 'Gönder'}
        </button>
        <button onClick={handleRestart} style={previewActionButtonStyle(activity, 'secondary')}>
          Sıfırla
        </button>
        {maxAttempts > 0 && <span style={{ fontSize: 12, color: '#64748b' }}>Deneme: {attempts} / {maxAttempts}</span>}
      </div>
    </div>
  );
}

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
  const status = isSuccess ? 'success' : 'incorrect';
  const title = isSuccess
    ? (feedback.correctMessage || 'Tebrikler!')
    : (feedback.incorrectMessage || 'Tekrar dene');
  const animation = isSuccess
    ? (feedback.animation || 'Confetti')
    : (feedback.incorrectAnimation || 'Sallanma');
  // Sonuç gösterilir gösterilmez (= Kontrol Et anı) ses çal + animasyon tetikle.
  const [burst, setBurst] = useState(null);
  useEffect(() => {
    playFeedbackSound(feedback, status, { muted: false });
    setBurst({ kind: isSuccess ? 'success' : 'failure', animation, ts: Date.now() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div style={{ position: 'relative', overflow: 'hidden', display: 'grid', placeItems: 'center', minHeight: 320, gap: 16, padding: 24 }}>
      <FeedbackAnimation burst={burst} />
      <div style={{ fontSize: 32, fontWeight: 900, color: isSuccess ? '#166534' : '#991b1b' }}>{isSuccess ? '✓' : '×'}</div>
      <div style={{ fontSize: 20, fontWeight: 900, color: isSuccess ? '#166534' : '#991b1b' }}>
        {title}
      </div>
      {typeof earnedPoints === 'number' && (
        <div style={{ fontSize: 14, color: '#64748b' }}>
          Puan: {earnedPoints}{totalPoints ? ` / ${totalPoints}` : ''}
        </div>
      )}
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

export function PreviewLabeledImageFlow({ activity }) {
  const markers = activity.labeledMarkers || [];
  const [openId, setOpenId] = useState(null);
  const [viewed, setViewed] = useState(() => new Set());
  const open = markers.find((m) => m.id === openId) || null;
  if (!activity.labeledImage) {
    return <div style={{ padding: 24, color: '#64748b' }}>Görsel eklenmedi.</div>;
  }
  return (
    <div style={{ padding: 24, maxWidth: 820, margin: '0 auto' }}>
      <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 12 }}>Etiketli Görsel</div>
      <HintBox activity={activity} />
      <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
        <img src={activity.labeledImage} alt="" style={{ maxWidth: '100%', borderRadius: 10, border: '1px solid #e2e8f0', display: 'block' }} />
        {markers.map((m, i) => {
          const isViewed = viewed.has(m.id);
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => { setOpenId(m.id); setViewed((v) => new Set(v).add(m.id)); }}
              style={{
                position: 'absolute',
                left: `${m.x}%`,
                top: `${m.y}%`,
                transform: 'translate(-50%,-50%)',
                width: 28,
                height: 28,
                borderRadius: 999,
                background: isViewed ? '#16a34a' : '#2563eb',
                color: '#fff',
                fontSize: 13,
                fontWeight: 900,
                border: '2px solid #fff',
                boxShadow: '0 2px 8px rgba(0,0,0,.35)',
                cursor: 'pointer',
                animation: isViewed ? 'none' : 'eicMarkerPulse 1.8s infinite',
              }}
            >
              {i + 1}
            </button>
          );
        })}
        {open && (
          <div
            style={{
              position: 'absolute',
              left: `${open.x}%`,
              top: `${open.y}%`,
              transform: 'translate(-50%, calc(-100% - 18px))',
              minWidth: 180,
              maxWidth: 280,
              background: '#0f172a',
              color: '#fff',
              borderRadius: 10,
              padding: '10px 12px',
              boxShadow: '0 12px 30px rgba(0,0,0,.4)',
              zIndex: 5,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
              <div style={{ fontWeight: 900, fontSize: 14 }}>{open.title || '—'}</div>
              <button onClick={() => setOpenId(null)} style={{ border: 'none', background: 'transparent', color: '#94a3b8', fontSize: 16, cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>
            {open.body && <div style={{ fontSize: 13, color: '#cbd5e1', marginTop: 4, lineHeight: 1.5 }}>{open.body}</div>}
          </div>
        )}
      </div>
      <div style={{ marginTop: 12, fontSize: 12, color: '#64748b' }}>
        İşaretçilere tıklayarak bilgileri görüntüle ({viewed.size} / {markers.length})
      </div>
      <style>{`@keyframes eicMarkerPulse{0%{box-shadow:0 0 0 0 rgba(37,99,235,.5)}70%{box-shadow:0 0 0 10px rgba(37,99,235,0)}100%{box-shadow:0 0 0 0 rgba(37,99,235,0)}}`}</style>
    </div>
  );
}

export function PreviewContentTabsFlow({ activity }) {
  const items = useMemo(() => activity.contentItems || [], [activity.contentItems]);
  const layout = activity.contentLayout || 'tabs';
  const [active, setActive] = useState(0);
  const [openSet, setOpenSet] = useState(() => new Set([0]));
  const [viewed, setViewed] = useState(() => new Set([0]));

  const markViewed = useCallback((i) => setViewed((v) => new Set(v).add(i)), []);
  const goTab = useCallback((i) => { setActive(i); markViewed(i); }, [markViewed]);
  const toggleAcc = useCallback((i) => {
    markViewed(i);
    setOpenSet((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; });
  }, [markViewed]);

  if (!items.length) {
    return <div style={{ padding: 24, color: '#64748b' }}>İçerik öğesi eklenmedi.</div>;
  }

  const allViewed = viewed.size >= items.length;
  const item = items[Math.min(active, items.length - 1)] || {};

  const bodyBlock = (it) => (
    <>
      {it.image && <img src={it.image} alt="" style={{ maxWidth: '100%', borderRadius: 8, marginBottom: 10, display: 'block' }} />}
      {it.body && <div style={{ fontSize: 14, color: '#334155', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{it.body}</div>}
    </>
  );

  return (
    <div style={{ padding: 24, maxWidth: 820, margin: '0 auto' }}>
      <HintBox activity={activity} />

      {layout === 'tabs' && (
        <div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', borderBottom: '2px solid #e2e8f0', marginBottom: 14 }}>
            {items.map((it, i) => (
              <button
                key={it.id || i}
                onClick={() => goTab(i)}
                style={{
                  padding: '9px 16px', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 13,
                  color: i === active ? '#1d4ed8' : '#64748b',
                  background: 'transparent',
                  borderBottom: i === active ? '2px solid #1d4ed8' : '2px solid transparent',
                  marginBottom: -2,
                }}
              >
                {viewed.has(i) ? '✓ ' : ''}{it.title || `Sekme ${i + 1}`}
              </button>
            ))}
          </div>
          <div>{bodyBlock(item)}</div>
        </div>
      )}

      {layout === 'accordion' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((it, i) => {
            const open = openSet.has(i);
            return (
              <div key={it.id || i} style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
                <button
                  onClick={() => toggleAcc(i)}
                  style={{
                    width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '12px 14px', border: 'none', background: open ? '#eff6ff' : '#f8fafc',
                    cursor: 'pointer', fontWeight: 800, fontSize: 14, color: '#1e293b', textAlign: 'left',
                  }}
                >
                  <span>{viewed.has(i) ? '✓ ' : ''}{it.title || `Bölüm ${i + 1}`}</span>
                  <span style={{ color: '#1d4ed8', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>▾</span>
                </button>
                {open && <div style={{ padding: '12px 14px', borderTop: '1px solid #e2e8f0' }}>{bodyBlock(it)}</div>}
              </div>
            );
          })}
        </div>
      )}

      {layout === 'process' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
            {items.map((it, i) => (
              <div key={it.id || i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  onClick={() => goTab(i)}
                  title={it.title || ''}
                  style={{
                    width: 32, height: 32, borderRadius: 999, border: 'none', cursor: 'pointer', fontWeight: 900, fontSize: 13,
                    background: i === active ? '#1d4ed8' : viewed.has(i) ? '#16a34a' : '#cbd5e1',
                    color: '#fff',
                  }}
                >
                  {i + 1}
                </button>
                {i < items.length - 1 && <div style={{ width: 24, height: 2, background: '#cbd5e1' }} />}
              </div>
            ))}
          </div>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 18, minHeight: 120 }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#1e293b', marginBottom: 8 }}>
              {active + 1}. {item.title || `Adım ${active + 1}`}
            </div>
            {bodyBlock(item)}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14 }}>
            <button onClick={() => goTab(Math.max(0, active - 1))} disabled={active === 0} style={previewActionButtonStyle(activity, 'secondary', { opacity: active === 0 ? 0.4 : 1 })}>
              ← Önceki
            </button>
            <button onClick={() => goTab(Math.min(items.length - 1, active + 1))} disabled={active === items.length - 1} style={previewActionButtonStyle(activity, 'primary', { opacity: active === items.length - 1 ? 0.4 : 1 })}>
              Sonraki →
            </button>
          </div>
        </div>
      )}

      {layout === 'timeline' && (
        <div style={{ position: 'relative', paddingLeft: 28 }}>
          <div style={{ position: 'absolute', left: 9, top: 4, bottom: 4, width: 2, background: '#cbd5e1' }} />
          {items.map((it, i) => (
            <div key={it.id || i} style={{ position: 'relative', marginBottom: 18 }}>
              <div style={{ position: 'absolute', left: -28 + 1, top: 2, width: 18, height: 18, borderRadius: 999, background: '#1d4ed8', border: '3px solid #fff', boxShadow: '0 0 0 1px #cbd5e1' }} />
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 900, color: '#1d4ed8', marginBottom: 6 }}>{it.title || `Olay ${i + 1}`}</div>
                {bodyBlock(it)}
              </div>
            </div>
          ))}
        </div>
      )}

      {activity.contentRequireAll && (
        <div style={{ marginTop: 14, fontSize: 12, fontWeight: 700, color: allViewed ? '#16a34a' : '#64748b' }}>
          {allViewed ? '✓ Tüm bölümler görüntülendi.' : `Tüm bölümleri görüntüleyin (${viewed.size} / ${items.length})`}
        </div>
      )}
    </div>
  );
}

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

export function PreviewFlashcardFlow({ activity }) {
  const settings = { ...DEFAULT_ACTIVITY_SETTINGS, ...(activity.settings || {}) };
  const cards = useMemo(() => {
    const base = (activity.flashcards || []).filter((c) => c.front || c.back);
    return settings.flashcardShuffle ? shuffleArray([...base]) : base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activity.flashcards, settings.flashcardShuffle]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [viewed, setViewed] = useState(() => new Set([0]));
  const card = cards[index] || null;
  const go = (dir) => {
    setIndex((i) => {
      const next = Math.max(0, Math.min(cards.length - 1, i + dir));
      setViewed((v) => new Set(v).add(next));
      return next;
    });
    setFlipped(false);
  };
  if (!cards.length) {
    return <div style={{ padding: 24, color: '#64748b' }}>Henüz kart eklenmedi.</div>;
  }
  return (
    <div style={{ padding: 24, maxWidth: 560, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 900 }}>Bilgi Kartları</div>
        <div style={{ fontSize: 12, color: '#64748b' }}>{index + 1} / {cards.length}</div>
      </div>
      <HintBox activity={activity} />
      <div onClick={() => setFlipped((f) => !f)} style={{ perspective: 1000, cursor: 'pointer' }}>
        <div
          style={{
            position: 'relative',
            width: '100%',
            minHeight: 220,
            transition: 'transform .5s',
            transformStyle: 'preserve-3d',
            transform: flipped ? 'rotateY(180deg)' : 'none',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              display: 'grid',
              placeItems: 'center',
              padding: 24,
              borderRadius: 16,
              border: '1px solid #bfdbfe',
              background: '#eff6ff',
              color: '#1e293b',
              fontSize: 20,
              fontWeight: 800,
              textAlign: 'center',
              boxShadow: '0 8px 24px rgba(15,23,42,.1)',
            }}
          >
            {card.front || '(boş)'}
            <span style={{ position: 'absolute', bottom: 10, fontSize: 11, color: '#64748b', fontWeight: 600 }}>
              Çevirmek için tıkla
            </span>
          </div>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              display: 'grid',
              placeItems: 'center',
              padding: 24,
              borderRadius: 16,
              border: '1px solid #86efac',
              background: '#f0fdf4',
              color: '#166534',
              fontSize: 20,
              fontWeight: 800,
              textAlign: 'center',
              boxShadow: '0 8px 24px rgba(15,23,42,.1)',
            }}
          >
            {card.back || '(boş)'}
          </div>
        </div>
      </div>
      <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'center' }}>
        <button onClick={() => go(-1)} disabled={index === 0} style={previewActionButtonStyle(activity, 'secondary', { opacity: index === 0 ? 0.5 : 1 })}>‹ Önceki</button>
        <button onClick={() => setFlipped((f) => !f)} style={previewActionButtonStyle(activity, 'primary')}>Çevir</button>
        <button onClick={() => go(1)} disabled={index === cards.length - 1} style={previewActionButtonStyle(activity, 'secondary', { opacity: index === cards.length - 1 ? 0.5 : 1 })}>Sonraki ›</button>
      </div>
      {settings.flashcardProgress !== false && (
        <div style={{ marginTop: 14, height: 6, borderRadius: 999, background: '#e2e8f0', overflow: 'hidden' }}>
          <div style={{ width: `${(viewed.size / cards.length) * 100}%`, height: '100%', background: '#1d4ed8', transition: 'width .3s' }} />
        </div>
      )}
    </div>
  );
}

export function PreviewLineMatchFlow({ activity }) {
  const [phase, setPhase] = useState('play');
  const [result, setResult] = useState(null);
  const [connections, setConnections] = useState({}); // pairId -> rightValue
  const [drag, setDrag] = useState(null); // { pairId, sx, sy, x, y }
  const [attempts, setAttempts] = useState(0);
  const svgRef = useRef(null);
  const pairs = useMemo(() => activity.matchingPairs || [], [activity.matchingPairs]);
  const settings = { ...DEFAULT_ACTIVITY_SETTINGS, ...(activity.settings || {}) };
  const answerControl = activity.answerControl || {};
  const maxAttempts = answerControl.maxAttempts || settings.maxAttempts || 0;
  const shape = activity.lineMatchShape || 'box';
  const rope = activity.matchingRope !== false;
  const lineColor = activity.matchingLineColor || '#1d4ed8';
  const lineWidth = Math.max(1, activity.matchingLineWidth || 3);
  const lineDash =
    activity.matchingLineStyle === 'dashed' ? '9 6' : activity.matchingLineStyle === 'dotted' ? '2 7' : '';

  const rights = useMemo(() => {
    const values = pairs.map((pair) => pair.right);
    return activity.matchingShuffle !== false ? shuffleArray([...values]) : values;
  }, [pairs, activity.matchingShuffle]);

  const W = 600;
  const NODE_W = 224;
  const NODE_H = 50;
  const GAP = 18;
  const TOP = 12;
  const leftX = 14;
  const rightX = W - 14 - NODE_W;
  const rowY = (i) => TOP + i * (NODE_H + GAP);
  const H = Math.max(120, TOP * 2 + pairs.length * (NODE_H + GAP));
  const leftAnchor = (i) => ({ x: leftX + NODE_W, y: rowY(i) + NODE_H / 2 });
  const rightAnchor = (i) => ({ x: rightX, y: rowY(i) + NODE_H / 2 });

  const toSvg = (event) => {
    const svg = svgRef.current;
    if (!svg || !svg.getScreenCTM) return { x: 0, y: 0 };
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const local = point.matrixTransform(ctm.inverse());
    return { x: local.x, y: local.y };
  };

  const ropePath = (a, b) => {
    if (!rope) return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
    const midX = (a.x + b.x) / 2;
    const sag = Math.min(70, Math.abs(b.x - a.x) * 0.16) + 12;
    return `M ${a.x} ${a.y} Q ${midX} ${(a.y + b.y) / 2 + sag} ${b.x} ${b.y}`;
  };

  const startDrag = (pairId, index) => (event) => {
    if (phase !== 'play') return;
    event.preventDefault();
    const a = leftAnchor(index);
    setDrag({ pairId, sx: a.x, sy: a.y, x: a.x, y: a.y });
    svgRef.current?.setPointerCapture?.(event.pointerId);
  };
  const handlePointerMove = (event) => {
    if (!drag) return;
    const p = toSvg(event);
    setDrag((current) => (current ? { ...current, x: p.x, y: p.y } : current));
  };
  const handlePointerUp = (event) => {
    if (!drag) return;
    const p = toSvg(event);
    let best = null;
    let bestDist = Infinity;
    rights.forEach((value, i) => {
      const a = rightAnchor(i);
      const dist = Math.hypot(a.x - p.x, a.y - p.y);
      if (dist < bestDist) {
        bestDist = dist;
        best = value;
      }
    });
    if (best != null && bestDist < 80) {
      setConnections((prev) => ({ ...prev, [drag.pairId]: best }));
    }
    setDrag(null);
  };

  const handleCheck = useCallback(() => {
    if (maxAttempts > 0 && attempts >= maxAttempts) return;
    const evalResult = evaluateStorylineRuntimeMatching({ slide: activity, state: { matchingSelections: connections } });
    setResult(evalResult.success ? 'success' : 'failure');
    setPhase('result');
    setAttempts((a) => a + 1);
  }, [activity, attempts, maxAttempts, connections]);
  const handleRestart = () => {
    setConnections({});
    setDrag(null);
    setResult(null);
    setPhase('play');
  };

  if (phase === 'result') {
    return <FeedbackOverlay result={result} activity={activity} onRestart={handleRestart} />;
  }

  return (
    <div style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 900 }}>Çizgi Eşleştirme</div>
        {Object.keys(connections).length > 0 && (
          <button
            type="button"
            onClick={() => setConnections({})}
            style={previewActionButtonStyle(activity, 'secondary', { padding: '4px 12px', borderRadius: 6, fontSize: 12 })}
          >
            Bağlantıları temizle
          </button>
        )}
      </div>
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>
        Sol öğenin ucundaki noktadan <strong>çekip</strong> karşısındaki doğru öğeye bırak.
      </div>
      <HintBox activity={activity} />
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', touchAction: 'none', userSelect: 'none' }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => setDrag(null)}
      >
        {pairs.map((pair, i) => {
          const rightIdx = connections[pair.id] != null ? rights.indexOf(connections[pair.id]) : -1;
          if (rightIdx < 0) return null;
          return (
            <path
              key={`c-${pair.id}`}
              d={ropePath(leftAnchor(i), rightAnchor(rightIdx))}
              fill="none"
              stroke={lineColor}
              strokeWidth={lineWidth}
              strokeDasharray={lineDash || undefined}
              strokeLinecap="round"
              style={{ animation: 'eicLineDraw .35s ease-out' }}
            />
          );
        })}
        {drag && (
          <path
            d={ropePath({ x: drag.sx, y: drag.sy }, { x: drag.x, y: drag.y })}
            fill="none"
            stroke={lineColor}
            strokeWidth={lineWidth}
            strokeLinecap="round"
            opacity="0.8"
          />
        )}
        {pairs.map((pair, i) => {
          const y = rowY(i);
          const connected = connections[pair.id] != null;
          return (
            <g key={`l-${pair.id}`} onPointerDown={startDrag(pair.id, i)} style={{ cursor: 'grab' }}>
              <rect
                x={leftX}
                y={y}
                width={NODE_W}
                height={NODE_H}
                rx={shape === 'circle' ? NODE_H / 2 : 10}
                fill="#eff6ff"
                stroke={connected ? lineColor : '#bfdbfe'}
                strokeWidth="2"
              />
              <text x={leftX + 18} y={y + NODE_H / 2} dominantBaseline="middle" fontSize="15" fontWeight="700" fill="#1e293b">
                {pair.left}
              </text>
              <circle cx={leftX + NODE_W} cy={y + NODE_H / 2} r="7" fill={connected ? lineColor : '#60a5fa'} stroke="#fff" strokeWidth="2" />
            </g>
          );
        })}
        {rights.map((value, i) => {
          const y = rowY(i);
          const connected = Object.values(connections).includes(value);
          return (
            <g key={`r-${i}`}>
              <rect
                x={rightX}
                y={y}
                width={NODE_W}
                height={NODE_H}
                rx={shape === 'circle' ? NODE_H / 2 : 10}
                fill="#f0fdf4"
                stroke={connected ? lineColor : '#86efac'}
                strokeWidth="2"
              />
              <text x={rightX + 18} y={y + NODE_H / 2} dominantBaseline="middle" fontSize="15" fontWeight="700" fill="#1e293b">
                {value}
              </text>
              <circle cx={rightX} cy={y + NODE_H / 2} r="7" fill={connected ? lineColor : '#34d399'} stroke="#fff" strokeWidth="2" />
            </g>
          );
        })}
      </svg>
      <style>{`@keyframes eicLineDraw{from{stroke-dashoffset:600;opacity:.3}to{stroke-dashoffset:0;opacity:1}}`}</style>
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
