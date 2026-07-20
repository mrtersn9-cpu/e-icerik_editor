import { useState, useCallback, useRef } from 'react';

import { DEFAULT_ACTIVITY_SETTINGS } from '../../../constants';
import { evaluateStorylineRuntimeSlider } from '../../../utils/storylineRuntimeEngine';

import { usePreviewTimer, formatTime, previewActionButtonStyle, FeedbackOverlay, HintBox } from './shared';
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
