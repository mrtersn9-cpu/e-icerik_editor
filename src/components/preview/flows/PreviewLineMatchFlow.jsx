import { useState, useMemo, useCallback, useRef } from 'react';

import { DEFAULT_ACTIVITY_SETTINGS } from '../../../constants';
import { shuffleArray } from '../../../logic/uiPrimitives';
import { evaluateStorylineRuntimeMatching } from '../../../utils/storylineRuntimeEngine';

import { previewActionButtonStyle, FeedbackOverlay, HintBox } from './shared';
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
