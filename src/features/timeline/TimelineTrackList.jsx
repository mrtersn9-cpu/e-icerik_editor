import { timelineTokens as t } from './timelineTokens';

function IconButton({ active = false, children, disabled = false, onClick, title }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      title={title}
      style={{
        width: 22,
        height: 22,
        borderRadius: 6,
        border: `1px solid ${active ? '#bfdbfe' : t.borderSoft}`,
        background: active ? t.rowSelected : '#ffffff',
        color: disabled ? '#cbd5e1' : active ? t.blue : t.muted,
        cursor: disabled ? 'default' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 10,
        fontWeight: 950,
      }}
    >
      {children}
    </button>
  );
}

function TrackGrid({ controller }) {
  return controller.ticks.map((tick) => (
    <div
      key={tick.second}
      style={{
        position: 'absolute',
        left: tick.left,
        top: 0,
        bottom: 0,
        width: 1,
        background: tick.major ? 'rgba(148,163,184,.18)' : 'rgba(148,163,184,.08)',
        pointerEvents: 'none',
      }}
    />
  ));
}

function PlayheadLine({ controller }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: controller.currentTime * controller.zoom,
        top: 0,
        bottom: 0,
        width: 2,
        background: t.playhead,
        zIndex: 3,
        pointerEvents: 'none',
      }}
    />
  );
}

function CueLines({ controller }) {
  return controller.cuePoints.map((cue) => (
    <div
      key={cue.id}
      style={{
        position: 'absolute',
        left: cue.time * controller.zoom,
        top: 0,
        bottom: 0,
        width: 1,
        background: 'rgba(245,158,11,.38)',
        pointerEvents: 'none',
      }}
    />
  ));
}

function ClipBar({ controller, row }) {
  const clip = row.clip;
  const disabled = !row.editable;
  const left = (clip.start || 0) * controller.zoom;
  const width = Math.max(24, (clip.duration || 0.2) * controller.zoom);

  return (
    <div
      onClick={(event) => {
        event.stopPropagation();
        controller.scrubToTime(clip.start || 0);
      }}
      onPointerDown={(event) => controller.beginClipDrag(event, clip, 'move')}
      style={{
        position: 'absolute',
        left,
        top: 4,
        height: t.size.row - 8,
        width,
        borderRadius: 5,
        border: `1px solid ${row.selected ? t.blue : row.tone.border}`,
        background: row.tone.fill,
        color: row.tone.text,
        cursor: disabled ? 'default' : 'grab',
        display: 'grid',
        gridTemplateColumns: '6px minmax(0,1fr) 6px',
        alignItems: 'center',
        overflow: 'hidden',
        boxSizing: 'border-box',
        boxShadow: row.selected ? '0 0 0 2px rgba(37,99,235,.12)' : 'none',
        opacity: disabled ? 0.58 : 1,
        zIndex: row.selected ? 4 : 2,
      }}
      title={`${row.label} - ${(clip.duration || 0).toFixed(1)}s`}
    >
      <span
        onPointerDown={(event) => controller.beginClipDrag(event, clip, 'resize-start')}
        style={{
          alignSelf: 'stretch',
          cursor: disabled ? 'default' : 'ew-resize',
          background: 'rgba(255,255,255,.55)',
          borderRight: `1px solid ${row.tone.border}`,
        }}
      />
      <span
        style={{
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          textAlign: 'center',
          fontSize: 10.5,
          fontWeight: 850,
          padding: '0 5px',
          display: width < 48 ? 'none' : 'block',
        }}
      >
        {row.label}
      </span>
      <span
        onPointerDown={(event) => controller.beginClipDrag(event, clip, 'resize-end')}
        style={{
          alignSelf: 'stretch',
          cursor: disabled ? 'default' : 'ew-resize',
          background: 'rgba(255,255,255,.55)',
          borderLeft: `1px solid ${row.tone.border}`,
        }}
      />
    </div>
  );
}

function Keyframes({ controller, row }) {
  return (row.clip.keyframes || []).map((frame, index) => {
    const pinned = index === 0 || index === (row.clip.keyframes || []).length - 1;
    return (
      <div
        key={frame.id}
        title={`${frame.name || 'Kare'} ${frame.time}s`}
        style={{
          position: 'absolute',
          left: ((row.clip.start || 0) + (frame.time || 0)) * controller.zoom - 4,
          top: t.size.row - 10,
          width: 8,
          height: 8,
          transform: 'rotate(45deg)',
          borderRadius: 2,
          border: `1px solid ${row.selected ? t.blue : t.borderStrong}`,
          background: pinned ? '#60a5fa' : '#c084fc',
          zIndex: 5,
          pointerEvents: 'none',
        }}
      />
    );
  });
}

function LayerDivider({ name, controller }) {
  return (
    <div style={{ display: 'flex', minWidth: t.size.labelColumn + controller.trackWidth }}>
      <div
        style={{
          width: t.size.labelColumn,
          minWidth: t.size.labelColumn,
          height: t.size.layer,
          borderRight: `1px solid ${t.border}`,
          borderBottom: `1px solid ${t.borderSoft}`,
          background: '#f8fbff',
          color: t.muted,
          display: 'flex',
          alignItems: 'center',
          padding: '0 10px',
          boxSizing: 'border-box',
          fontSize: 9.5,
          fontWeight: 900,
          textTransform: 'uppercase',
        }}
      >
        {name}
      </div>
      <div
        style={{
          width: controller.trackWidth,
          height: t.size.layer,
          borderBottom: `1px solid ${t.borderSoft}`,
          background: '#f8fbff',
          flexShrink: 0,
        }}
      />
    </div>
  );
}

export default function TimelineTrackList({ controller }) {
  let lastLayer = null;

  if (!controller.rows.length) {
    return (
      <div
        style={{
          minHeight: 120,
          border: `1px dashed ${t.border}`,
          borderRadius: 8,
          margin: 10,
          color: t.muted,
          background: t.panelSoft,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          fontSize: 11,
          fontWeight: 760,
          lineHeight: 1.45,
        }}
      >
        Sahneye nesne eklediğinde timeline satırları otomatik oluşur.
      </div>
    );
  }

  return (
    <div>
      {controller.rows.map((row) => {
        const showLayer = row.layerName !== lastLayer;
        lastLayer = row.layerName;
        return (
          <div key={row.id}>
            {showLayer ? <LayerDivider controller={controller} name={row.layerName} /> : null}
            <div
              style={{
                display: 'flex',
                minWidth: t.size.labelColumn + controller.trackWidth,
              }}
            >
              <div
                style={{
                  width: t.size.labelColumn,
                  minWidth: t.size.labelColumn,
                  height: t.size.row,
                  borderRight: `1px solid ${t.border}`,
                  borderBottom: `1px solid ${t.borderSoft}`,
                  background: row.selected ? t.rowSelected : row.index % 2 ? t.rowAlt : '#ffffff',
                  display: 'grid',
                  gridTemplateColumns: '26px 26px minmax(0,1fr) 24px',
                  alignItems: 'center',
                  gap: 4,
                  padding: '0 6px',
                  boxSizing: 'border-box',
                }}
              >
                <IconButton
                  active={row.visible}
                  onClick={() => controller.patchObject(row.object?.id, { visible: !row.visible })}
                  title={row.visible ? 'Gizle' : 'Göster'}
                >
                  {row.visible ? '●' : '○'}
                </IconButton>
                <IconButton
                  active={row.locked}
                  onClick={() => controller.patchObject(row.object?.id, { locked: !row.locked })}
                  title={row.locked ? 'Kilidi aç' : 'Kilitle'}
                >
                  {row.locked ? '■' : '□'}
                </IconButton>
                <button
                  type="button"
                  onClick={(event) => controller.selectClip(row.clip, event)}
                  onDoubleClick={() => controller.setDetailsOpen(true)}
                  style={{
                    minWidth: 0,
                    border: 'none',
                    background: 'transparent',
                    color: row.selected ? t.blueDark : t.text,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    padding: 0,
                    textAlign: 'left',
                  }}
                  title={row.label}
                >
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 5,
                      border: `1px solid ${row.tone.border}`,
                      background: row.tone.fill,
                      color: row.tone.text,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 9.5,
                      fontWeight: 950,
                      flexShrink: 0,
                    }}
                  >
                    {row.icon}
                  </span>
                  <span
                    style={{
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontSize: 10.5,
                      fontWeight: row.selected ? 900 : 780,
                    }}
                  >
                    {row.label}
                  </span>
                </button>
                <IconButton onClick={(event) => controller.openContextMenu(event, row.clip)} title="Satır menüsü">
                  ⋯
                </IconButton>
              </div>

              <div
                onPointerDown={controller.scrubFromPointer}
                onContextMenu={(event) => controller.openContextMenu(event, row.clip)}
                style={{
                  width: controller.trackWidth,
                  height: t.size.row,
                  borderBottom: `1px solid ${t.borderSoft}`,
                  background: row.selected ? '#f4f8ff' : row.index % 2 ? '#fbfdff' : '#ffffff',
                  position: 'relative',
                  cursor: 'ew-resize',
                  flexShrink: 0,
                  overflow: 'hidden',
                }}
              >
                <TrackGrid controller={controller} />
                <CueLines controller={controller} />
                <PlayheadLine controller={controller} />
                <ClipBar controller={controller} row={row} />
                <Keyframes controller={controller} row={row} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
