import { useEffect } from 'react';

import TimelineClipDetails from './TimelineClipDetails';
import TimelineContextMenu from './TimelineContextMenu';
import TimelineRuler from './TimelineRuler';
import { timelineTokens as t } from './timelineTokens';
import TimelineToolbar from './TimelineToolbar';
import TimelineTrackList from './TimelineTrackList';
import useTimelineController from './useTimelineController';

function TimelineBody({ controller }) {
  if (controller.collapsed) return null;
  return (
    <>
      <TimelineClipDetails controller={controller} />
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          background: '#ffffff',
        }}
      >
        <div style={{ minWidth: t.size.labelColumn + controller.trackWidth }}>
          <TimelineRuler controller={controller} />
          <TimelineTrackList controller={controller} />
        </div>
      </div>
    </>
  );
}

function DockSurface({ controller, floating = false }) {
  useEffect(() => {
    const close = () => controller.closeContextMenu();
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [controller]);

  return (
    <div
      style={{
        height: controller.collapsed ? t.size.toolbar : floating ? '100%' : controller.height,
        minHeight: controller.collapsed ? t.size.toolbar : 0,
        borderTop: floating ? `1px solid ${t.border}` : `1px solid ${t.border}`,
        border: floating ? `1px solid ${t.border}` : undefined,
        borderRadius: floating ? 9 : 0,
        background: '#ffffff',
        boxShadow: floating ? '0 22px 64px rgba(15,23,42,.22)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        color: t.text,
        position: 'relative',
      }}
    >
      {floating ? (
        <div
          onPointerDown={controller.beginFloatingDrag}
          style={{
            height: 30,
            borderBottom: `1px solid ${t.border}`,
            background: '#f8fbff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 10px',
            cursor: 'move',
            flexShrink: 0,
          }}
        >
          <span style={{ color: t.blueDark, fontSize: 11, fontWeight: 950 }}>ZAMAN ÇİZELGESİ</span>
          <button
            type="button"
            onClick={() => controller.setFloating(false)}
            style={{
              width: 24,
              height: 24,
              border: `1px solid ${t.border}`,
              borderRadius: 6,
              background: '#ffffff',
              color: t.text,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 900,
            }}
          >
            x
          </button>
        </div>
      ) : null}
      <TimelineToolbar controller={controller} />
      <TimelineBody controller={controller} />
      {floating ? (
        <button
          type="button"
          onPointerDown={controller.beginFloatingResize}
          title="Yeniden boyutlandır"
          style={{
            position: 'absolute',
            right: 2,
            bottom: 2,
            width: 16,
            height: 16,
            border: 'none',
            background: 'transparent',
            color: t.muted,
            cursor: 'nwse-resize',
            fontSize: 12,
          }}
        >
          ◢
        </button>
      ) : null}
      <TimelineContextMenu controller={controller} />
    </div>
  );
}

export default function StorylineTimelineDock(props) {
  const controller = useTimelineController(props);

  if (!props.activity) {
    return (
      <div
        style={{
          height: props.height || 230,
          borderTop: `1px solid ${t.border}`,
          background: '#ffffff',
          color: t.muted,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontWeight: 800,
        }}
      >
        Timeline burada görünecek.
      </div>
    );
  }

  return (
    <>
      {!controller.floating ? <DockSurface controller={controller} /> : null}
      {controller.floating ? (
        <div
          style={{
            position: 'fixed',
            left: controller.floatingBox.x,
            top: controller.floatingBox.y,
            width: controller.floatingBox.width,
            height: controller.floatingBox.height,
            zIndex: 900,
          }}
        >
          <DockSurface controller={controller} floating />
        </div>
      ) : null}
    </>
  );
}
