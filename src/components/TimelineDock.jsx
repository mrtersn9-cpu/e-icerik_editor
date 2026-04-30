import { useState, useEffect, useRef, useMemo } from 'react';

import {
  TIMELINE_EFFECT_OPTIONS,
  TIMELINE_DIRECTION_OPTIONS,
  TIMELINE_EASING_OPTIONS,
} from '../constants';
import { EDITOR_THEME } from '../theme';
import { clamp } from '../utils/editorHelpers';

// ─────────────────────────────────────────────────────────────────────────────
// Articulate-benzeri profesyonel Timeline Dock
// Tasarım hedefleri:
//   • Kompakt tek satır transport bar (Play / Başa / Zaman / Zoom)
//   • Sol object column + sağ time ruler & track ayrımı
//   • Seçili klibin "Animasyon" detayı küçük, gizlenebilir bir çekmece olarak
//   • Inline metinler asla iç içe geçmemeli; ellipsis & sabit yükseklik
//   • TTKB: editör verisi tek gerçek kaynak; hiçbir görsel hile yok
// ─────────────────────────────────────────────────────────────────────────────

const ROW_HEIGHT = 30;
const RULER_HEIGHT = 26;
const LABEL_COL_WIDTH = 220;
const TRANSPORT_HEIGHT = 40;

const OBJECT_TYPE_ICONS = {
  text: 'T',
  button: 'B',
  shape: '■',
  image: '🖼',
  video: '▶',
  audio: '♪',
  hotspot: '◎',
  draggable: '↕',
  dropzone: '▭',
  default: '•',
};

const CLIP_BAR_BG = {
  text: 'linear-gradient(180deg, #f59e0b, #d97706)',
  button: 'linear-gradient(180deg, #3b82f6, #2563eb)',
  image: 'linear-gradient(180deg, #22c55e, #16a34a)',
  audio: 'linear-gradient(180deg, #a855f7, #9333ea)',
  video: 'linear-gradient(180deg, #ec4899, #db2777)',
  shape: 'linear-gradient(180deg, #64748b, #475569)',
};

function getClipBarBg(type) {
  return CLIP_BAR_BG[type] || 'linear-gradient(180deg, #475569, #334155)';
}

export default function TimelineDock({
  activity,
  onUpdate,
  height = 230,
  currentTime = 0,
  onCurrentTimeChange = () => {},
  isPlaying = false,
  onPlayingChange = () => {},
  selectedIds = new Set(),
  onSelectObject = () => {},
  // injected utilities
  getActivityTimeline,
  getTimelineDuration,
  shouldObjectPersistAfterTimeline,
  isObjectTimelineActive,
  createTimelineKeyframe,
}) {
  const safeActivity = activity || { objects: [], timeline: [] };
  const timeline = getActivityTimeline(safeActivity);
  const objects = safeActivity.objects || [];

  const patchAct = (p) => {
    if (!activity) return;
    onUpdate({ ...safeActivity, ...p });
  };
  const patchTimeline = (id, p) =>
    patchAct({ timeline: timeline.map((it) => (it.id === id ? { ...it, ...p } : it)) });
  const patchTimelineKeyframes = (timelineId, updater) => {
    const clip = timeline.find((it) => it.id === timelineId);
    if (!clip) return;
    const cur = Array.isArray(clip.keyframes) ? clip.keyframes : [];
    const next = typeof updater === 'function' ? updater(cur) : updater;
    patchTimeline(timelineId, { keyframes: next });
  };

  const [zoom, setZoom] = useState(84); // pixels per second
  const [animOpen, setAnimOpen] = useState(false);
  const dragRef = useRef(null);

  const totalDuration = Math.max(5, getTimelineDuration(activity || safeActivity));
  const trackWidth = Math.max(900, Math.round(totalDuration * zoom) + 48);
  const zoomPercent = Math.round((zoom / 84) * 100);

  const ticks = useMemo(() => {
    const arr = [];
    const totalTicks = Math.ceil(totalDuration * 5) + 1;
    for (let i = 0; i < totalTicks; i++) {
      const second = i / 5;
      arr.push({ second, left: second * zoom, major: i % 5 === 0 });
    }
    return arr;
  }, [totalDuration, zoom]);

  const groupedTimeline = useMemo(() => {
    const groups = {};
    timeline.forEach((item) => {
      const obj = objects.find((o) => o.id === item.objectId);
      const layerId = obj?.layerId || 'base';
      if (!groups[layerId]) groups[layerId] = [];
      groups[layerId].push(item);
    });
    const order = ['base'];
    Object.keys(groups).forEach((lid) => {
      if (!order.includes(lid)) order.push(lid);
    });
    return order.map((layerId) => ({
      layerId,
      layerName: layerId === 'base' ? 'Temel Layer' : `Layer: ${layerId}`,
      items: groups[layerId],
    }));
  }, [timeline, objects]);

  const activeTimelineItem =
    timeline.find(
      (it) => selectedIds.has(it.objectId) || activity?.selectedObjectId === it.objectId
    ) ||
    timeline[0] ||
    null;
  const activeObject = activeTimelineItem
    ? objects.find((o) => o.id === activeTimelineItem.objectId) || null
    : null;
  const activeLabel =
    activeObject?.label || activeObject?.type || activeTimelineItem?.name || 'Klip';
  const activeKeyframes = Array.isArray(activeTimelineItem?.keyframes)
    ? activeTimelineItem.keyframes
    : [];

  const liveCount = timeline.filter((it) =>
    isObjectTimelineActive(activity, it.objectId, currentTime)
  ).length;
  const selectedCount = timeline.filter((it) => selectedIds.has(it.objectId)).length;
  const currentSec = Number(currentTime || 0).toFixed(1);

  // ── Ortak stiller ─────────────────────────────────────────────────────────
  const transportBtn = {
    height: 28,
    minWidth: 28,
    padding: '0 10px',
    borderRadius: 6,
    border: `1px solid ${EDITOR_THEME.shellBorderSoft}`,
    background: 'rgba(255,255,255,.04)',
    color: EDITOR_THEME.shellMuted,
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    boxSizing: 'border-box',
    whiteSpace: 'nowrap',
  };
  const transportBtnPrimary = {
    ...transportBtn,
    background: isPlaying ? 'rgba(34,197,94,.14)' : EDITOR_THEME.shellAccentSoft,
    borderColor: isPlaying ? 'rgba(34,197,94,.45)' : EDITOR_THEME.shellAccentBorder,
    color: isPlaying ? '#86efac' : '#a5e6ff',
  };
  const compactInput = {
    height: 26,
    width: '100%',
    padding: '0 8px',
    borderRadius: 5,
    border: `1px solid ${EDITOR_THEME.shellBorderSoft}`,
    background: '#0e1728',
    color: EDITOR_THEME.shellText,
    fontSize: 11,
    boxSizing: 'border-box',
    outline: 'none',
  };
  const fieldLabel = {
    fontSize: 10,
    color: EDITOR_THEME.shellMutedSoft,
    fontWeight: 700,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 3,
    display: 'block',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  };
  const pill = {
    display: 'inline-flex',
    alignItems: 'center',
    height: 22,
    padding: '0 8px',
    borderRadius: 999,
    border: `1px solid ${EDITOR_THEME.shellBorderSoft}`,
    background: 'rgba(255,255,255,.04)',
    color: EDITOR_THEME.shellMutedSoft,
    fontSize: 10,
    fontWeight: 700,
    whiteSpace: 'nowrap',
    letterSpacing: 0.3,
  };

  // ── Cleanup pointer listeners ─────────────────────────────────────────────
  useEffect(
    () => () => {
      if (!dragRef.current) return;
      window.removeEventListener('pointermove', dragRef.current.move);
      window.removeEventListener('pointerup', dragRef.current.up);
    },
    []
  );

  if (!activity) {
    return (
      <div
        style={{
          height,
          borderTop: `1px solid ${EDITOR_THEME.shellBorder}`,
          background: `linear-gradient(180deg, ${EDITOR_THEME.shellPanelAlt}, ${EDITOR_THEME.shellBg})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: EDITOR_THEME.shellMutedSoft,
          fontSize: 12,
        }}
      >
        Timeline burada görünecek.
      </div>
    );
  }

  // ── Layer grouping already computed above via useMemo ─────────────────────

  // ── Klip sürükleme ────────────────────────────────────────────────────────
  const beginClipDrag = (event, item, mode) => {
    event.preventDefault();
    event.stopPropagation();
    const session = {
      id: item.id,
      mode,
      startX: event.clientX,
      start: Number(item.start || 0),
      duration: Number(item.duration || 0.2),
    };
    const move = (mv) => {
      const dSec = (mv.clientX - session.startX) / zoom;
      if (session.mode === 'move') {
        patchTimeline(session.id, {
          start: Math.max(0, Number((session.start + dSec).toFixed(1))),
        });
        return;
      }
      if (session.mode === 'resize-start') {
        const nextStart = clamp(
          Number((session.start + dSec).toFixed(1)),
          0,
          session.start + session.duration - 0.2
        );
        const nextDuration = Math.max(
          0.2,
          Number((session.duration - (nextStart - session.start)).toFixed(1))
        );
        patchTimeline(session.id, { start: nextStart, duration: nextDuration });
        return;
      }
      const nextDuration = Math.max(0.2, Number((session.duration + dSec).toFixed(1)));
      patchTimeline(session.id, { duration: nextDuration });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      dragRef.current = null;
    };
    dragRef.current = { move, up };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const scrubFromPointer = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const next = clamp(Number(((event.clientX - rect.left) / zoom).toFixed(1)), 0, totalDuration);
    onCurrentTimeChange(next);
  };

  const handlePlayheadPointerDown = (event) => {
    event.stopPropagation();
    const rect = event.currentTarget.parentElement.getBoundingClientRect();
    const next = clamp(Number(((event.clientX - rect.left) / zoom).toFixed(1)), 0, totalDuration);
    onCurrentTimeChange(next);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        height,
        borderTop: `1px solid ${EDITOR_THEME.shellBorder}`,
        background: EDITOR_THEME.shellBg,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        boxSizing: 'border-box',
      }}
    >
      {/* ── Transport Bar ─────────────────────────────────────────────────── */}
      <div
        style={{
          height: TRANSPORT_HEIGHT,
          flexShrink: 0,
          borderBottom: `1px solid ${EDITOR_THEME.shellBorder}`,
          background: EDITOR_THEME.shellPanel,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 12px',
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
        {/* Sol blok: Başlık + transport butonları */}
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: EDITOR_THEME.shellText,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            marginRight: 4,
            flexShrink: 0,
          }}
        >
          Timeline
        </span>
        <button
          onClick={() => onPlayingChange(!isPlaying)}
          style={transportBtnPrimary}
          title={isPlaying ? 'Duraklat' : 'Oynat'}
        >
          {isPlaying ? '⏸' : '▶'}
          <span style={{ fontSize: 11 }}>{isPlaying ? 'Duraklat' : 'Oynat'}</span>
        </button>
        <button
          onClick={() => {
            onCurrentTimeChange(0);
            onPlayingChange(false);
          }}
          style={transportBtn}
          title="Başa al"
        >
          ⏮
        </button>

        {/* Zaman göstergesi */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            height: 28,
            padding: '0 10px',
            borderRadius: 6,
            border: `1px solid ${EDITOR_THEME.shellBorderSoft}`,
            background: '#0a0f1a',
            color: EDITOR_THEME.shellText,
            fontSize: 11,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: 0.5,
            flexShrink: 0,
          }}
        >
          <span style={{ color: '#a5e6ff' }}>{currentSec}s</span>
          <span style={{ color: EDITOR_THEME.shellMutedSoft, margin: '0 6px' }}>/</span>
          <span style={{ color: EDITOR_THEME.shellMutedSoft }}>{totalDuration.toFixed(1)}s</span>
        </div>

        {/* Orta blok: özet pills (boşluk varsa) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flex: 1,
            minWidth: 0,
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <span style={pill}>{timeline.length} klip</span>
          <span style={pill}>{liveCount} aktif</span>
          {selectedCount > 0 && <span style={pill}>{selectedCount} seçili</span>}
        </div>

        {/* Sağ blok: Animasyon detayı + Zoom */}
        {activeTimelineItem && (
          <button
            onClick={() => setAnimOpen((v) => !v)}
            style={{
              ...transportBtn,
              borderColor: animOpen ? EDITOR_THEME.shellAccentBorder : EDITOR_THEME.shellBorderSoft,
              color: animOpen ? '#a5e6ff' : EDITOR_THEME.shellMuted,
              background: animOpen ? EDITOR_THEME.shellAccentSoft : 'rgba(255,255,255,.04)',
            }}
            title="Seçili klip animasyon ayarları"
          >
            ⚙ Animasyon
          </button>
        )}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            height: 28,
            border: `1px solid ${EDITOR_THEME.shellBorderSoft}`,
            borderRadius: 6,
            background: 'rgba(255,255,255,.04)',
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => setZoom((v) => clamp(v - 18, 48, 168))}
            style={{
              ...transportBtn,
              height: 26,
              minWidth: 26,
              border: 'none',
              background: 'transparent',
              padding: '0 8px',
            }}
            title="Uzaklaştır"
          >
            −
          </button>
          <span
            style={{
              minWidth: 38,
              textAlign: 'center',
              fontSize: 11,
              fontWeight: 700,
              color: EDITOR_THEME.shellMutedSoft,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {zoomPercent}%
          </span>
          <button
            onClick={() => setZoom((v) => clamp(v + 18, 48, 168))}
            style={{
              ...transportBtn,
              height: 26,
              minWidth: 26,
              border: 'none',
              background: 'transparent',
              padding: '0 8px',
            }}
            title="Yakınlaştır"
          >
            +
          </button>
        </div>
      </div>

      {/* ── Animation Drawer (gizlenebilir) ───────────────────────────────── */}
      {animOpen && activeTimelineItem && (
        <div
          style={{
            flexShrink: 0,
            borderBottom: `1px solid ${EDITOR_THEME.shellBorder}`,
            background: EDITOR_THEME.shellPanelAlt,
            padding: '10px 12px',
            display: 'grid',
            gridTemplateColumns: 'minmax(200px, 1fr) minmax(360px, 2fr)',
            gap: 12,
            alignItems: 'start',
            boxSizing: 'border-box',
          }}
        >
          {/* Sol: Seçili klip kimliği */}
          <div
            style={{
              border: `1px solid ${EDITOR_THEME.shellBorderSoft}`,
              borderRadius: 8,
              background: 'rgba(255,255,255,.03)',
              padding: 10,
              minWidth: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span
                style={{
                  ...pill,
                  background: EDITOR_THEME.shellAccentSoft,
                  color: '#a5e6ff',
                  borderColor: EDITOR_THEME.shellAccentBorder,
                }}
              >
                Seçili Klip
              </span>
            </div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: EDITOR_THEME.shellText,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={activeLabel}
            >
              {activeLabel}
            </div>
            <div
              style={{
                fontSize: 11,
                color: EDITOR_THEME.shellMutedSoft,
                marginTop: 4,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {activeObject?.type || 'Nesne'} ·{' '}
              {shouldObjectPersistAfterTimeline(activeTimelineItem) ? 'kalıcı' : 'çıkışlı'}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
              <span style={pill}>{Number(activeTimelineItem.start || 0).toFixed(1)}s</span>
              <span style={pill}>{Number(activeTimelineItem.duration || 0).toFixed(1)}s</span>
              <span style={pill}>{activeTimelineItem.entryEffect || 'fade'}</span>
              <span style={pill}>{activeKeyframes.length} kf</span>
            </div>
          </div>

          {/* Sağ: Alanlar */}
          <div style={{ display: 'grid', gap: 8, minWidth: 0 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, minmax(80px, 1fr))',
                gap: 8,
              }}
            >
              <label style={{ minWidth: 0 }}>
                <span style={fieldLabel}>Başlangıç</span>
                <input
                  type="number"
                  step="0.1"
                  value={activeTimelineItem.start}
                  onChange={(e) =>
                    patchTimeline(activeTimelineItem.id, {
                      start: Math.max(0, +e.target.value || 0),
                    })
                  }
                  style={compactInput}
                />
              </label>
              <label style={{ minWidth: 0 }}>
                <span style={fieldLabel}>Süre</span>
                <input
                  type="number"
                  step="0.1"
                  value={activeTimelineItem.duration}
                  onChange={(e) =>
                    patchTimeline(activeTimelineItem.id, {
                      duration: Math.max(0.2, +e.target.value || 0),
                    })
                  }
                  style={compactInput}
                />
              </label>
              <label style={{ minWidth: 0 }}>
                <span style={fieldLabel}>Giriş</span>
                <select
                  value={activeTimelineItem.entryEffect || 'fade'}
                  onChange={(e) =>
                    patchTimeline(activeTimelineItem.id, { entryEffect: e.target.value })
                  }
                  style={compactInput}
                >
                  {TIMELINE_EFFECT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ minWidth: 0 }}>
                <span style={fieldLabel}>Çıkış</span>
                <select
                  value={activeTimelineItem.exitEffect || 'none'}
                  onChange={(e) =>
                    patchTimeline(activeTimelineItem.id, { exitEffect: e.target.value })
                  }
                  style={compactInput}
                >
                  {TIMELINE_EFFECT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(140px, 1fr))',
                gap: 8,
              }}
            >
              <label style={{ minWidth: 0 }}>
                <span style={fieldLabel}>Yön</span>
                <select
                  value={activeTimelineItem.direction || 'left'}
                  onChange={(e) =>
                    patchTimeline(activeTimelineItem.id, { direction: e.target.value })
                  }
                  style={compactInput}
                >
                  {TIMELINE_DIRECTION_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ minWidth: 0 }}>
                <span style={fieldLabel}>Easing</span>
                <select
                  value={activeTimelineItem.easing || 'easeOut'}
                  onChange={(e) => patchTimeline(activeTimelineItem.id, { easing: e.target.value })}
                  style={compactInput}
                >
                  {TIMELINE_EASING_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* Cubic bezier custom panel */}
            {activeTimelineItem.easing === 'cubicBezier' && (
              <div
                style={{
                  padding: 8,
                  borderRadius: 6,
                  border: `1px solid ${EDITOR_THEME.shellBorderSoft}`,
                  background: '#0a0f1a',
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    color: EDITOR_THEME.shellMutedSoft,
                    fontWeight: 700,
                    letterSpacing: 0.4,
                    textTransform: 'uppercase',
                    marginBottom: 6,
                  }}
                >
                  Cubic Bezier
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                  {['x1', 'y1', 'x2', 'y2'].map((k, i) => (
                    <label key={k} style={{ minWidth: 0 }}>
                      <span style={fieldLabel}>{k}</span>
                      <input
                        type="number"
                        min={-1}
                        max={2}
                        step={0.05}
                        value={(activeTimelineItem.cubicBezier || [0.42, 0, 0.58, 1])[i]}
                        onChange={(e) => {
                          const cb = [...(activeTimelineItem.cubicBezier || [0.42, 0, 0.58, 1])];
                          cb[i] = clamp(+e.target.value, -1, 2);
                          patchTimeline(activeTimelineItem.id, { cubicBezier: cb });
                        }}
                        style={compactInput}
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Keyframe küçük özet */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                marginTop: 2,
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  color: EDITOR_THEME.shellMutedSoft,
                  fontWeight: 700,
                  letterSpacing: 0.4,
                  textTransform: 'uppercase',
                }}
              >
                Keyframe Noktaları
              </span>
              <button
                onClick={() =>
                  patchTimelineKeyframes(activeTimelineItem.id, (prev) => {
                    const nextTime = Math.min(
                      activeTimelineItem.duration,
                      Number(
                        (prev.length
                          ? Math.min(activeTimelineItem.duration, prev[prev.length - 1].time + 0.6)
                          : activeTimelineItem.duration / 2
                        ).toFixed(1)
                      )
                    );
                    return [...prev, createTimelineKeyframe(nextTime, prev.length)];
                  })
                }
                style={transportBtn}
              >
                + Keyframe
              </button>
            </div>
            {activeKeyframes.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {activeKeyframes.map((frame, fi) => {
                  const isPinned = fi === 0 || fi === activeKeyframes.length - 1;
                  return (
                    <div
                      key={frame.id}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        height: 22,
                        padding: '0 8px',
                        borderRadius: 999,
                        border: `1px solid ${isPinned ? 'rgba(99,131,255,.45)' : EDITOR_THEME.shellBorderSoft}`,
                        background: isPinned ? 'rgba(99,131,255,.12)' : 'rgba(255,255,255,.04)',
                        color: isPinned ? '#a5b4fc' : EDITOR_THEME.shellMutedSoft,
                        fontSize: 10,
                        fontWeight: 700,
                      }}
                    >
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {Number(frame.time || 0).toFixed(1)}s
                      </span>
                      {!isPinned && activeKeyframes.length > 2 && (
                        <button
                          onClick={() =>
                            patchTimelineKeyframes(activeTimelineItem.id, (prev) =>
                              prev.filter((e) => e.id !== frame.id)
                            )
                          }
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: '#f87171',
                            cursor: 'pointer',
                            fontSize: 12,
                            lineHeight: 1,
                            padding: 0,
                          }}
                          title="Keyframe sil"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ fontSize: 11, color: EDITOR_THEME.shellMutedSoft }}>
                Henüz keyframe yok.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Track Area ────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {timeline.length > 0 ? (
          <div style={{ minWidth: LABEL_COL_WIDTH + trackWidth }}>
            {/* Sticky ruler row */}
            <div
              style={{
                display: 'flex',
                position: 'sticky',
                top: 0,
                zIndex: 2,
                background: EDITOR_THEME.shellPanel,
              }}
            >
              <div
                style={{
                  width: LABEL_COL_WIDTH,
                  flexShrink: 0,
                  height: RULER_HEIGHT,
                  padding: '0 12px',
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: 10,
                  fontWeight: 800,
                  color: EDITOR_THEME.shellMutedSoft,
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                  borderRight: `1px solid ${EDITOR_THEME.shellBorder}`,
                  borderBottom: `1px solid ${EDITOR_THEME.shellBorder}`,
                  background: EDITOR_THEME.shellPanel,
                  boxSizing: 'border-box',
                }}
              >
                Nesneler
              </div>
              <div
                onPointerDown={scrubFromPointer}
                style={{
                  width: trackWidth,
                  height: RULER_HEIGHT,
                  position: 'relative',
                  cursor: 'ew-resize',
                  borderBottom: `1px solid ${EDITOR_THEME.shellBorder}`,
                  background: EDITOR_THEME.shellPanel,
                }}
              >
                {ticks.map((tick) => (
                  <div
                    key={tick.second}
                    style={{
                      position: 'absolute',
                      left: tick.left,
                      top: tick.major ? 0 : RULER_HEIGHT - 6,
                      bottom: 0,
                      width: 1,
                      background: tick.major
                        ? EDITOR_THEME.shellBorderStrong
                        : EDITOR_THEME.shellBorder,
                    }}
                  >
                    {tick.major && (
                      <span
                        style={{
                          position: 'absolute',
                          top: 4,
                          left: 4,
                          fontSize: 10,
                          color: EDITOR_THEME.shellMutedSoft,
                          fontVariantNumeric: 'tabular-nums',
                          fontWeight: 600,
                        }}
                      >
                        {tick.second}s
                      </span>
                    )}
                  </div>
                ))}
                {/* Playhead triangle */}
                <div
                  onPointerDown={handlePlayheadPointerDown}
                  style={{
                    position: 'absolute',
                    left: currentTime * zoom - 6,
                    top: 0,
                    width: 12,
                    height: 12,
                    cursor: 'ew-resize',
                    zIndex: 3,
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      left: 2,
                      top: 0,
                      width: 0,
                      height: 0,
                      borderLeft: '4px solid transparent',
                      borderRight: '4px solid transparent',
                      borderTop: '8px solid #ef4444',
                      pointerEvents: 'none',
                    }}
                  />
                </div>
                {/* Playhead line */}
                <div
                  onPointerDown={handlePlayheadPointerDown}
                  style={{
                    position: 'absolute',
                    left: currentTime * zoom,
                    top: 0,
                    bottom: 0,
                    width: 2,
                    background: 'rgba(239,68,68,.85)',
                    cursor: 'ew-resize',
                    zIndex: 3,
                  }}
                />
              </div>
            </div>

            {/* Layer rows */}
            {groupedTimeline.map((group, groupIndex) => (
              <div key={group.layerId}>
                {/* Layer header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'stretch',
                    minWidth: LABEL_COL_WIDTH + trackWidth,
                  }}
                >
                  <div
                    style={{
                      width: LABEL_COL_WIDTH,
                      flexShrink: 0,
                      height: 20,
                      padding: '0 10px',
                      fontSize: 10,
                      fontWeight: 800,
                      color: EDITOR_THEME.shellMutedSoft,
                      background: EDITOR_THEME.shellPanel,
                      borderRight: `1px solid ${EDITOR_THEME.shellBorder}`,
                      borderBottom: `1px solid ${EDITOR_THEME.shellBorder}`,
                      display: 'flex',
                      alignItems: 'center',
                      boxSizing: 'border-box',
                    }}
                  >
                    {group.layerName}
                  </div>
                  <div
                    style={{
                      width: trackWidth,
                      height: 20,
                      background: EDITOR_THEME.shellPanel,
                      borderBottom: `1px solid ${EDITOR_THEME.shellBorder}`,
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                {/* Object rows in this layer */}
                {group.items.map((item, rowIndex) => {
                  const obj = objects.find((o) => o.id === item.objectId) || null;
                  const label = obj?.label || obj?.type || item.name || 'Klip';
                  const isSelected = activeTimelineItem?.id === item.id;
                  const isActive = isObjectTimelineActive(activity, item.objectId, currentTime);
                  const icon =
                    OBJECT_TYPE_ICONS[obj?.type || 'default'] || OBJECT_TYPE_ICONS.default;
                  const overallIndex =
                    groupedTimeline
                      .slice(0, groupIndex)
                      .reduce((sum, g) => sum + g.items.length, 0) + rowIndex;
                  const rowBg = isSelected
                    ? 'rgba(2,132,199,.10)'
                    : overallIndex % 2 === 0
                      ? 'rgba(15,23,42,.55)'
                      : 'rgba(15,23,42,.85)';
                  return (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        alignItems: 'stretch',
                        minWidth: LABEL_COL_WIDTH + trackWidth,
                      }}
                    >
                      {/* Object label cell */}
                      <button
                        onClick={() => onSelectObject(item.objectId)}
                        style={{
                          width: LABEL_COL_WIDTH,
                          flexShrink: 0,
                          height: ROW_HEIGHT,
                          border: 'none',
                          borderRight: `1px solid ${EDITOR_THEME.shellBorder}`,
                          borderBottom: `1px solid ${EDITOR_THEME.shellBorder}`,
                          background: rowBg,
                          padding: '0 10px',
                          cursor: 'pointer',
                          textAlign: 'left',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          boxSizing: 'border-box',
                          minWidth: 0,
                        }}
                      >
                        <span
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: 4,
                            border: `1px solid ${
                              isSelected
                                ? EDITOR_THEME.shellAccentBorder
                                : EDITOR_THEME.shellBorderSoft
                            }`,
                            background: isSelected
                              ? EDITOR_THEME.shellAccentSoft
                              : 'rgba(255,255,255,.04)',
                            color: isSelected ? '#a5e6ff' : EDITOR_THEME.shellMutedSoft,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 10,
                            fontWeight: 800,
                            flexShrink: 0,
                          }}
                        >
                          {icon}
                        </span>
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: 999,
                            background: isActive
                              ? EDITOR_THEME.shellSuccess
                              : isSelected
                                ? EDITOR_THEME.shellAccent
                                : 'transparent',
                            boxShadow: isActive ? '0 0 0 2px rgba(34,197,94,.18)' : 'none',
                            flexShrink: 0,
                          }}
                        />
                        <span
                          style={{
                            flex: 1,
                            minWidth: 0,
                            fontSize: 11,
                            fontWeight: 700,
                            color: isSelected ? '#cfeeff' : EDITOR_THEME.shellMuted,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                          title={label}
                        >
                          {label}
                        </span>
                      </button>

                      {/* Track */}
                      <div
                        onPointerDown={scrubFromPointer}
                        style={{
                          width: trackWidth,
                          height: ROW_HEIGHT,
                          position: 'relative',
                          borderBottom: `1px solid ${EDITOR_THEME.shellBorder}`,
                          background: rowBg,
                          cursor: 'ew-resize',
                          boxSizing: 'border-box',
                        }}
                      >
                        {/* Faint tick lines */}
                        {ticks.map((tick) => (
                          <div
                            key={tick.second}
                            style={{
                              position: 'absolute',
                              left: tick.left,
                              top: 0,
                              bottom: 0,
                              width: 1,
                              background: tick.major
                                ? 'rgba(148,163,184,.10)'
                                : 'rgba(148,163,184,.04)',
                              pointerEvents: 'none',
                            }}
                          />
                        ))}
                        {/* Playhead */}
                        <div
                          onPointerDown={handlePlayheadPointerDown}
                          style={{
                            position: 'absolute',
                            left: currentTime * zoom,
                            top: 0,
                            bottom: 0,
                            width: 2,
                            background: 'rgba(239,68,68,.85)',
                            cursor: 'ew-resize',
                            zIndex: 2,
                          }}
                        />

                        {/* Clip bar */}
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectObject(item.objectId);
                          }}
                          onPointerDown={(e) => beginClipDrag(e, item, 'move')}
                          style={{
                            position: 'absolute',
                            left: item.start * zoom,
                            top: 5,
                            width: Math.max(20, item.duration * zoom),
                            height: ROW_HEIGHT - 10,
                            borderRadius: 4,
                            background: getClipBarBg(obj?.type),
                            border: `1px solid ${isSelected ? '#7dd3fc' : '#64748b'}`,
                            color: '#f8fafc',
                            cursor: 'grab',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0 6px',
                            overflow: 'hidden',
                            boxShadow: isSelected
                              ? '0 2px 8px rgba(14,165,233,.35)'
                              : '0 1px 0 rgba(0,0,0,.2)',
                            boxSizing: 'border-box',
                          }}
                        >
                          <div
                            onPointerDown={(e) => beginClipDrag(e, item, 'resize-start')}
                            style={{
                              width: 4,
                              alignSelf: 'stretch',
                              cursor: 'ew-resize',
                              marginLeft: -2,
                              background: 'rgba(255,255,255,.18)',
                              borderRadius: 2,
                            }}
                          />
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              flex: 1,
                              textAlign: 'center',
                              letterSpacing: 0.3,
                              display: item.duration * zoom < 40 ? 'none' : 'block',
                            }}
                            title={`${label} · ${Number(item.duration || 0).toFixed(1)}s`}
                          >
                            {label} · {Number(item.duration || 0).toFixed(1)}s
                          </span>
                          <div
                            onPointerDown={(e) => beginClipDrag(e, item, 'resize-end')}
                            style={{
                              width: 4,
                              alignSelf: 'stretch',
                              cursor: 'ew-resize',
                              marginRight: -2,
                              background: 'rgba(255,255,255,.18)',
                              borderRadius: 2,
                            }}
                          />
                        </div>

                        {/* Keyframe diamonds */}
                        {(item.keyframes || []).map((frame, fi) => {
                          const isPinned = fi === 0 || fi === (item.keyframes || []).length - 1;
                          return (
                            <div
                              key={frame.id}
                              style={{
                                position: 'absolute',
                                left: (item.start + frame.time) * zoom - 4,
                                top: ROW_HEIGHT - 10,
                                width: 8,
                                height: 8,
                                transform: 'rotate(45deg)',
                                background: isPinned ? '#a5b4fc' : '#cbd5e1',
                                border: `1px solid ${
                                  isSelected ? '#38bdf8' : EDITOR_THEME.shellBorderStrong
                                }`,
                                borderRadius: 1,
                                pointerEvents: 'none',
                              }}
                              title={`${frame.time}s`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Trigger Track */}
            {activity?.triggers && activity.triggers.length > 0 && (
              <div
                onClick={() => console.log('Triggers:', activity.triggers)}
                style={{
                  display: 'flex',
                  alignItems: 'stretch',
                  minWidth: LABEL_COL_WIDTH + trackWidth,
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    width: LABEL_COL_WIDTH,
                    flexShrink: 0,
                    height: 22,
                    padding: '0 10px',
                    fontSize: 10,
                    fontWeight: 800,
                    color: '#eab308',
                    background: 'rgba(234,179,8,.1)',
                    borderRight: `1px solid rgba(234,179,8,.25)`,
                    borderBottom: `1px solid rgba(234,179,8,.25)`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    boxSizing: 'border-box',
                  }}
                >
                  <span>⚡</span>
                  <span>{activity.triggers.length} trigger</span>
                </div>
                <div
                  style={{
                    width: trackWidth,
                    height: 22,
                    background: 'rgba(234,179,8,.1)',
                    borderBottom: `1px solid rgba(234,179,8,.25)`,
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            )}
          </div>
        ) : (
          <div
            style={{
              height: '100%',
              border: `1px dashed ${EDITOR_THEME.shellBorderSoft}`,
              borderRadius: 8,
              margin: 12,
              background: 'rgba(255,255,255,.02)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: EDITOR_THEME.shellMutedSoft,
              fontSize: 12,
              textAlign: 'center',
              padding: 16,
              lineHeight: 1.6,
            }}
          >
            Sahneye nesne ekleyin.
            <br />
            Timeline satırları ve klip kontrolleri otomatik oluşur.
          </div>
        )}
      </div>
    </div>
  );
}
