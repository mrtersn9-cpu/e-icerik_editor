import { useState } from 'react';

import { timelineTokens as t } from './timelineTokens';

function ToolButton({ active = false, children, disabled = false, onClick, title, wide = false }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      title={title}
      style={{
        height: 26,
        minWidth: wide ? 74 : 28,
        border: `1px solid ${active ? t.blue : t.border}`,
        borderRadius: 6,
        background: active ? t.rowSelected : '#ffffff',
        color: disabled ? '#b6c2d2' : active ? t.blueDark : t.text,
        cursor: disabled ? 'default' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        padding: wide ? '0 9px' : '0 7px',
        fontSize: 10.5,
        fontWeight: 850,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}

function Pill({ children }) {
  return (
    <span
      style={{
        height: 22,
        border: `1px solid ${t.borderSoft}`,
        borderRadius: 999,
        background: t.panelSoft,
        color: t.muted,
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0 8px',
        fontSize: 10,
        fontWeight: 800,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

export default function TimelineToolbar({ controller }) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  const runSetting = (fn) => {
    setSettingsOpen(false);
    fn?.();
  };

  return (
    <div
      style={{
        height: t.size.toolbar,
        minHeight: t.size.toolbar,
        borderBottom: `1px solid ${t.border}`,
        background: '#ffffff',
        display: 'grid',
        gridTemplateColumns: 'minmax(210px, auto) auto minmax(120px, 1fr) auto',
        alignItems: 'center',
        gap: 8,
        padding: '0 10px',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
        <ToolButton onClick={() => controller.setCollapsed((value) => !value)} title="Timeline daralt">
          {controller.collapsed ? 'v' : '^'}
        </ToolButton>
        <div
          style={{
            color: t.text,
            fontSize: 11,
            fontWeight: 950,
            letterSpacing: 0.3,
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
          }}
        >
          ZAMAN ÇİZELGESİ
        </div>
      </div>

      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <ToolButton active={controller.isPlaying} onClick={() => controller.updatePlaying(!controller.isPlaying)} title="Oynat / duraklat">
          {controller.isPlaying ? '||' : '▶'}
        </ToolButton>
        <ToolButton
          onClick={() => {
            controller.scrubToTime(0);
            controller.updatePlaying(false);
          }}
          title="Başa al"
        >
          |&lt;
        </ToolButton>
        <ToolButton onClick={controller.goToPreviousMarker} title="Önceki cue">
          &lt;
        </ToolButton>
        <ToolButton onClick={controller.goToNextMarker} title="Sonraki cue">
          &gt;
        </ToolButton>
        <div
          style={{
            height: 26,
            minWidth: 124,
            border: `1px solid ${t.border}`,
            borderRadius: 6,
            background: '#f8fbff',
            color: t.text,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontVariantNumeric: 'tabular-nums',
            fontSize: 10.5,
            fontWeight: 850,
          }}
        >
          <span style={{ color: t.blue }}>{controller.currentTimeLabel}</span>
          <span style={{ color: t.softText, margin: '0 5px' }}>/</span>
          <span>{controller.durationLabel}</span>
        </div>
        <Pill>1x</Pill>
      </div>

      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 5,
          minWidth: 0,
          overflow: 'hidden',
        }}
      >
        <Pill>{controller.timelineCount} klip</Pill>
        <Pill>{controller.liveCount} aktif</Pill>
        <Pill>{controller.selectedCount} seçili</Pill>
      </div>

      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, position: 'relative' }}>
        <ToolButton onClick={controller.addCuePoint} title="Playhead noktasına cue ekle">
          + Cue
        </ToolButton>
        <select
          value=""
          disabled={!controller.activeTimelineItem}
          onChange={(event) => {
            if (!event.target.value) return;
            controller.alignActiveClip(event.target.value);
            event.target.value = '';
          }}
          style={{
            height: 26,
            width: 104,
            border: `1px solid ${t.border}`,
            borderRadius: 6,
            background: '#ffffff',
            color: controller.activeTimelineItem ? t.text : '#b6c2d2',
            fontSize: 10.5,
            fontWeight: 800,
            padding: '0 6px',
          }}
        >
          <option value="">Hizala</option>
          <option value="start">Klip başı playhead'e</option>
          <option value="end">Klip sonu playhead'e</option>
          <option value="playhead-to-start">Playhead klip başına</option>
          <option value="playhead-to-end">Playhead klip sonuna</option>
        </select>
        <ToolButton active={controller.visualization} onClick={controller.setVisualization} title="Timeline görünürlüğünü uygula">
          Viz
        </ToolButton>
        <ToolButton active={controller.snapEnabled} onClick={() => controller.setSnapEnabled((value) => !value)} title="Izgaraya yapış">
          Snap
        </ToolButton>
        <ToolButton onClick={() => controller.setZoom((value) => Math.max(36, value - 12))} title="Uzaklaştır">
          -
        </ToolButton>
        <input
          type="range"
          min="36"
          max="156"
          step="6"
          value={controller.zoom}
          onChange={(event) => controller.setZoom(Number(event.target.value) || 72)}
          style={{ width: 92, accentColor: t.blue }}
          title={`${controller.zoomPercent}%`}
        />
        <ToolButton onClick={() => controller.setZoom((value) => Math.min(156, value + 12))} title="Yakınlaştır">
          +
        </ToolButton>
        <ToolButton onClick={() => controller.setDetailsOpen((value) => !value)} active={controller.detailsOpen} title="Seçili klip ayarları">
          Klip
        </ToolButton>
        <ToolButton onClick={() => controller.setFloating(true)} active={controller.floating} title="Timeline ayır">
          Float
        </ToolButton>
        <ToolButton onClick={() => setSettingsOpen((value) => !value)} title="Timeline ayarları">
          ...
        </ToolButton>
        {settingsOpen && (
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: 30,
              zIndex: 20,
              width: 188,
              border: `1px solid ${t.border}`,
              borderRadius: 8,
              background: '#ffffff',
              boxShadow: '0 16px 36px rgba(15,23,42,.18)',
              padding: 6,
              display: 'grid',
              gap: 4,
            }}
          >
            {[
              ['Timeline Fit', controller.fitTimeline],
              ['Timeline Reset', controller.resetTimeline],
              ['Cue Ekle', controller.addCuePoint],
              ['Alta Sabitle', () => controller.setFloating(false)],
            ].map(([label, fn]) => (
              <button
                key={label}
                type="button"
                onClick={() => runSetting(fn)}
                style={{
                  height: 28,
                  border: 'none',
                  borderRadius: 6,
                  background: '#ffffff',
                  color: t.text,
                  cursor: 'pointer',
                  textAlign: 'left',
                  padding: '0 8px',
                  fontSize: 10.5,
                  fontWeight: 820,
                }}
              >
                {label}
              </button>
            ))}
            <label style={{ display: 'grid', gap: 4, color: t.muted, fontSize: 10, fontWeight: 800 }}>
              Süre
              <input
                type="number"
                step="0.1"
                value={controller.totalDuration}
                onChange={(event) => controller.setManualDuration(Number(event.target.value) || 0)}
                style={{
                  height: 26,
                  border: `1px solid ${t.border}`,
                  borderRadius: 6,
                  padding: '0 7px',
                  fontSize: 10.5,
                  fontWeight: 800,
                }}
              />
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
