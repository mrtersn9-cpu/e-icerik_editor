import { timelineTokens as t } from './timelineTokens';

export default function TimelineRuler({ controller }) {
  return (
    <div
      style={{
        display: 'flex',
        position: 'sticky',
        top: 0,
        zIndex: 4,
        background: '#ffffff',
      }}
    >
      <div
        style={{
          width: t.size.labelColumn,
          minWidth: t.size.labelColumn,
          height: t.size.ruler,
          borderRight: `1px solid ${t.border}`,
          borderBottom: `1px solid ${t.border}`,
          background: t.ruler,
          display: 'grid',
          gridTemplateColumns: '32px 32px minmax(0,1fr) 30px',
          alignItems: 'center',
          padding: '0 8px',
          boxSizing: 'border-box',
          color: t.muted,
          fontSize: 10,
          fontWeight: 900,
          textTransform: 'uppercase',
        }}
      >
        <span>Göz</span>
        <span>Kilit</span>
        <span>Katman / Nesne</span>
        <span />
      </div>
      <div
        onPointerDown={controller.scrubFromPointer}
        style={{
          width: controller.trackWidth,
          height: t.size.ruler,
          position: 'relative',
          borderBottom: `1px solid ${t.border}`,
          background: t.ruler,
          cursor: 'ew-resize',
          flexShrink: 0,
        }}
      >
        {controller.ticks.map((tick) => (
          <div
            key={tick.second}
            style={{
              position: 'absolute',
              left: tick.left,
              top: tick.major ? 0 : 17,
              bottom: 0,
              width: 1,
              background: tick.major ? t.borderStrong : t.border,
              pointerEvents: 'none',
            }}
          >
            {tick.major ? (
              <span
                style={{
                  position: 'absolute',
                  top: 3,
                  left: 4,
                  color: t.muted,
                  fontSize: 9.5,
                  fontWeight: 760,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {tick.second.toFixed(tick.second % 1 ? 1 : 0)}
              </span>
            ) : null}
          </div>
        ))}
        {controller.cuePoints.map((cue, index) => (
          <button
            key={cue.id}
            type="button"
            onPointerDown={(event) => controller.beginCueDrag(event, cue)}
            onDoubleClick={() => controller.deleteCuePoint(cue.id)}
            title={`${cue.label || `Cue ${index + 1}`} - ${cue.time.toFixed(2)}s`}
            style={{
              position: 'absolute',
              left: cue.time * controller.zoom - 5,
              top: 1,
              width: 10,
              height: 20,
              border: 'none',
              background: 'transparent',
              cursor: 'ew-resize',
              padding: 0,
              zIndex: 5,
            }}
          >
            <span
              style={{
                position: 'absolute',
                left: 1,
                top: 2,
                width: 8,
                height: 8,
                borderRadius: 2,
                transform: 'rotate(45deg)',
                background: t.cue,
                border: '1px solid #d97706',
              }}
            />
            <span
              style={{
                position: 'absolute',
                left: 4,
                top: 10,
                bottom: 0,
                width: 1,
                background: '#d97706',
              }}
            />
          </button>
        ))}
        <div
          style={{
            position: 'absolute',
            left: controller.currentTime * controller.zoom - 5,
            top: 0,
            width: 10,
            height: 10,
            zIndex: 6,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              width: 0,
              height: 0,
              borderLeft: '5px solid transparent',
              borderRight: '5px solid transparent',
              borderTop: `8px solid ${t.playhead}`,
            }}
          />
        </div>
        <div
          style={{
            position: 'absolute',
            left: controller.currentTime * controller.zoom,
            top: 0,
            bottom: 0,
            width: 2,
            background: t.playhead,
            zIndex: 5,
            pointerEvents: 'none',
          }}
        />
      </div>
    </div>
  );
}
