const chrome = {
  active: '#eaf2ff',
  bg: '#ffffff',
  blue: '#2563eb',
  border: '#d8e2ef',
  borderSoft: '#e5edf6',
  muted: '#64748b',
  text: '#172033',
};

function ChromeButton({
  active = false,
  children,
  disabled = false,
  minWidth = 28,
  onClick,
  title,
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      aria-label={title}
      onClick={disabled ? undefined : onClick}
      style={{
        minWidth,
        height: 28,
        borderRadius: 7,
        border: `1px solid ${active ? '#93c5fd' : chrome.border}`,
        background: active ? chrome.active : chrome.bg,
        color: disabled ? '#cbd5e1' : active ? chrome.blue : '#334155',
        cursor: disabled ? 'default' : 'pointer',
        fontSize: 11,
        fontWeight: 900,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        padding: '0 8px',
        whiteSpace: 'nowrap',
        lineHeight: 1,
      }}
    >
      {children}
    </button>
  );
}

function ToolbarGroup({ children, align = 'left' }) {
  return (
    <div
      style={{
        minWidth: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start',
        gap: 6,
      }}
    >
      {children}
    </div>
  );
}

export default function CanvasWorkspaceCenter({
  activity,
  canvasTool,
  currentZoomPercent,
  onCanvasToolChange,
  onFullscreen,
  onToggleGrid,
  onToggleGuides,
  onZoomActual,
  onZoomChange,
  onZoomFit,
  onZoomStep,
  stageContent,
  timelineContent,
}) {
  const viewOptions = activity?.viewOptions || {};
  const stageLabel = `${activity?.stageWidth || 1920} x ${activity?.stageHeight || 1080}`;
  const zoomValue = Math.max(10, Math.min(400, Number(currentZoomPercent) || 100));

  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        display: 'grid',
        gridTemplateRows: 'minmax(0, 1fr) 42px auto',
        background: '#f7faff',
        border: `1px solid ${chrome.border}`,
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'relative',
          minHeight: 0,
          overflow: 'hidden',
          background:
            'linear-gradient(180deg,#eef4fb 0%,#e7eef7 100%)',
        }}
      >
        {stageContent}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto minmax(84px, 1fr) auto',
          alignItems: 'center',
          gap: 10,
          minHeight: 42,
          padding: '0 12px',
          borderTop: `1px solid ${chrome.borderSoft}`,
          borderBottom: `1px solid ${chrome.borderSoft}`,
          background: '#ffffff',
          boxShadow: '0 -1px 0 rgba(15,23,42,.02)',
        }}
      >
        <ToolbarGroup>
          <ChromeButton
            active={canvasTool === 'select'}
            title="Seçim"
            onClick={() => onCanvasToolChange?.('select')}
          >
            ⌖
          </ChromeButton>
          <ChromeButton
            active={canvasTool === 'pan'}
            title="Pan"
            onClick={() => onCanvasToolChange?.('pan')}
          >
            ✋
          </ChromeButton>
        </ToolbarGroup>

        <div
          style={{
            justifySelf: 'center',
            minWidth: 0,
            color: chrome.text,
            fontSize: 11,
            fontWeight: 900,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {stageLabel}
        </div>

        <ToolbarGroup align="right">
          <ChromeButton title="Uzaklaştır" onClick={() => onZoomStep?.(-0.1)}>
            -
          </ChromeButton>
          <input
            type="range"
            min="10"
            max="400"
            value={zoomValue}
            onChange={(event) => onZoomChange?.(Number(event.target.value) / 100)}
            title="Yakınlaştırma"
            style={{
              width: 'clamp(96px, 12vw, 176px)',
              minWidth: 96,
              accentColor: chrome.blue,
            }}
          />
          <ChromeButton title="Yakınlaştır" onClick={() => onZoomStep?.(0.1)}>
            +
          </ChromeButton>
          <ChromeButton minWidth={46} title="Sığdır" onClick={onZoomFit}>
            {`${zoomValue}%`}
          </ChromeButton>
          <ChromeButton minWidth={34} title="1:1" onClick={onZoomActual}>
            1:1
          </ChromeButton>
          <ChromeButton
            active={!!viewOptions.showGuides}
            title="Kılavuzlar"
            onClick={onToggleGuides}
          >
            ▦
          </ChromeButton>
          <ChromeButton
            active={viewOptions.showGrid !== false}
            title="Izgara"
            onClick={onToggleGrid}
          >
            ⊞
          </ChromeButton>
          <ChromeButton title="Tam ekran" onClick={onFullscreen}>
            ⛶
          </ChromeButton>
        </ToolbarGroup>
      </div>

      {timelineContent}
    </div>
  );
}

