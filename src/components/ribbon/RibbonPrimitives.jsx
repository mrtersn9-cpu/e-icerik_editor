import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';

import { workspaceChrome } from '../../features/editor-workspace/chromeTokens';

const toneColors = {
  blue: '#1d4ed8',
  green: '#16a34a',
  amber: '#d97706',
  slate: '#1f3657',
  red: '#dc2626',
  purple: '#7c3aed',
};

const disabledStyle = {
  opacity: 0.36,
  cursor: 'default',
};

const RibbonPopoverContext = createContext(null);

export function RibbonPopoverProvider({ children, activeTab }) {
  const [openPopoverId, setOpenPopoverId] = useState('');

  useEffect(() => {
    setOpenPopoverId('');
  }, [activeTab]);

  useEffect(() => {
    if (!openPopoverId || typeof document === 'undefined') return undefined;
    const close = (event) => {
      if (event.key === 'Escape') setOpenPopoverId('');
    };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [openPopoverId]);

  return (
    <RibbonPopoverContext.Provider value={{ openPopoverId, setOpenPopoverId }}>
      {children}
    </RibbonPopoverContext.Provider>
  );
}

function useDeferredColor({ value, onCommit, eventMode = false, delay = 120 }) {
  const [draft, setDraft] = useState(value || '#ffffff');
  const timerRef = useRef(null);
  const latestValueRef = useRef(value || '#ffffff');

  useEffect(() => {
    const nextValue = value || '#ffffff';
    latestValueRef.current = nextValue;
    setDraft(nextValue);
  }, [value]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  const commit = (nextValue) => {
    if (!nextValue || nextValue === latestValueRef.current) return;
    latestValueRef.current = nextValue;
    if (eventMode) {
      onCommit?.({ target: { value: nextValue }, currentTarget: { value: nextValue } });
      return;
    }
    onCommit?.(nextValue);
  };

  const scheduleCommit = (nextValue) => {
    setDraft(nextValue);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => commit(nextValue), delay);
  };

  const flush = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    commit(draft);
  };

  return { draft, flush, scheduleCommit };
}

const iconStroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

const icons = {
  new: (
    <>
      <path {...iconStroke} d="M6 3h8l4 4v14H6z" />
      <path {...iconStroke} d="M14 3v5h5M12 11v6M9 14h6" />
    </>
  ),
  open: (
    <>
      <path {...iconStroke} d="M3 7h7l2 3h9l-2 9H5z" />
      <path {...iconStroke} d="M3 7v12" />
    </>
  ),
  save: (
    <>
      <path {...iconStroke} d="M5 4h12l2 2v14H5z" />
      <path {...iconStroke} d="M8 4v6h8V4M8 16h8" />
    </>
  ),
  export: (
    <>
      <path {...iconStroke} d="M12 16V4M8 8l4-4 4 4" />
      <path {...iconStroke} d="M5 14v5h14v-5" />
    </>
  ),
  cut: (
    <>
      <circle {...iconStroke} cx="6" cy="17" r="2.3" />
      <circle {...iconStroke} cx="17" cy="17" r="2.3" />
      <path {...iconStroke} d="M8 15 18 5M15 15 6 5" />
    </>
  ),
  copy: (
    <>
      <rect {...iconStroke} x="8" y="8" width="11" height="11" rx="1.5" />
      <path {...iconStroke} d="M5 15V5h10" />
    </>
  ),
  clipboard: (
    <>
      <path {...iconStroke} d="M8 5h8v3H8z" />
      <path {...iconStroke} d="M7 7H5v14h14V7h-2" />
    </>
  ),
  trash: (
    <>
      <path {...iconStroke} d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13" />
      <path {...iconStroke} d="M10 11v6M14 11v6" />
    </>
  ),
  undo: <path {...iconStroke} d="M9 7 4 12l5 5M5 12h9a5 5 0 1 1 0 10h-2" />,
  redo: <path {...iconStroke} d="m15 7 5 5-5 5M19 12h-9a5 5 0 1 0 0 10h2" />,
  grid: (
    <>
      <rect {...iconStroke} x="4" y="4" width="6" height="6" />
      <rect {...iconStroke} x="14" y="4" width="6" height="6" />
      <rect {...iconStroke} x="4" y="14" width="6" height="6" />
      <rect {...iconStroke} x="14" y="14" width="6" height="6" />
    </>
  ),
  guides: (
    <>
      <path {...iconStroke} d="M7 4v16M17 4v16M4 8h16M4 16h16" />
      <path {...iconStroke} d="M12 4v16" opacity=".45" />
    </>
  ),
  fit: (
    <>
      <path {...iconStroke} d="M8 4H4v4M16 4h4v4M8 20H4v-4M16 20h4v-4" />
      <path {...iconStroke} d="M9 9h6v6H9z" />
    </>
  ),
  zoomIn: (
    <>
      <circle {...iconStroke} cx="10" cy="10" r="6" />
      <path {...iconStroke} d="M15 15l5 5M10 7v6M7 10h6" />
    </>
  ),
  zoomOut: (
    <>
      <circle {...iconStroke} cx="10" cy="10" r="6" />
      <path {...iconStroke} d="M15 15l5 5M7 10h6" />
    </>
  ),
  oneToOne: (
    <>
      <rect {...iconStroke} x="5" y="5" width="14" height="14" rx="1.5" />
      <path {...iconStroke} d="M9 15V9l-2 1M14 15V9l-2 1" />
    </>
  ),
  alignLeft: <path {...iconStroke} d="M5 5v14M9 7h10M9 12h7M9 17h10" />,
  alignCenter: <path {...iconStroke} d="M12 5v14M7 7h10M9 12h6M7 17h10" />,
  alignRight: <path {...iconStroke} d="M19 5v14M5 7h10M8 12h7M5 17h10" />,
  alignTop: <path {...iconStroke} d="M5 5h14M7 9v10M12 9v7M17 9v10" />,
  alignMiddle: <path {...iconStroke} d="M5 12h14M7 5v14M12 7v10M17 5v14" />,
  alignBottom: <path {...iconStroke} d="M5 19h14M7 5v10M12 8v7M17 5v10" />,
  distributeH: <path {...iconStroke} d="M4 5v14M20 5v14M8 8h3v8H8zM13 8h3v8h-3z" />,
  distributeV: <path {...iconStroke} d="M5 4h14M5 20h14M8 8h8v3H8zM8 13h8v3H8z" />,
  group: (
    <>
      <rect {...iconStroke} x="7" y="7" width="10" height="10" />
      <path {...iconStroke} d="M4 10V4h6M14 4h6v6M20 14v6h-6M10 20H4v-6" />
    </>
  ),
  ungroup: (
    <>
      <rect {...iconStroke} x="8" y="8" width="8" height="8" />
      <path {...iconStroke} d="M4 9V5h4M16 5h4v4M20 15v4h-4M8 19H4v-4" />
    </>
  ),
  lock: (
    <>
      <rect {...iconStroke} x="6" y="10" width="12" height="10" rx="2" />
      <path {...iconStroke} d="M9 10V7a3 3 0 0 1 6 0v3" />
    </>
  ),
  unlock: (
    <>
      <rect {...iconStroke} x="6" y="10" width="12" height="10" rx="2" />
      <path {...iconStroke} d="M9 10V7a3 3 0 0 1 5.6-1.5" />
    </>
  ),
  bringFront: (
    <>
      <path {...iconStroke} d="M12 19V5M8 9l4-4 4 4" />
      <path {...iconStroke} d="M6 20h12" />
    </>
  ),
  sendBack: (
    <>
      <path {...iconStroke} d="M12 5v14M8 15l4 4 4-4" />
      <path {...iconStroke} d="M6 4h12" />
    </>
  ),
  text: <path {...iconStroke} d="M5 5h14M12 5v14M8 19h8" />,
  heading: <path {...iconStroke} d="M5 5v14M19 5v14M5 12h14" />,
  image: (
    <>
      <rect {...iconStroke} x="4" y="5" width="16" height="14" rx="2" />
      <circle {...iconStroke} cx="9" cy="10" r="1.5" />
      <path {...iconStroke} d="m6 17 4-4 3 3 2-2 3 3" />
    </>
  ),
  code: <path {...iconStroke} d="m9 8-4 4 4 4M15 8l4 4-4 4" />,
  shape: (
    <>
      <rect {...iconStroke} x="4" y="6" width="10" height="10" rx="2" />
      <circle {...iconStroke} cx="16" cy="16" r="4" />
    </>
  ),
  star: <path {...iconStroke} d="m12 3 2.6 5.5 6 .8-4.3 4.2 1 6-5.3-2.9-5.3 2.9 1-6-4.3-4.2 6-.8z" />,
  audio: (
    <>
      <path {...iconStroke} d="M5 14H3V9h2l5-4v13z" />
      <path {...iconStroke} d="M15 9a4 4 0 0 1 0 5M18 6a8 8 0 0 1 0 11" />
    </>
  ),
  video: (
    <>
      <rect {...iconStroke} x="4" y="6" width="16" height="12" rx="2" />
      <path {...iconStroke} d="m10 9 5 3-5 3z" />
    </>
  ),
  web: (
    <>
      <circle {...iconStroke} cx="12" cy="12" r="8" />
      <path {...iconStroke} d="M4 12h16M12 4a12 12 0 0 1 0 16M12 4a12 12 0 0 0 0 16" />
    </>
  ),
  button: (
    <>
      <rect {...iconStroke} x="4" y="8" width="16" height="8" rx="2" />
      <path {...iconStroke} d="M8 12h6" />
    </>
  ),
  hotspot: (
    <>
      <circle {...iconStroke} cx="12" cy="12" r="7" />
      <circle {...iconStroke} cx="12" cy="12" r="2.5" />
    </>
  ),
  dragdrop: (
    <>
      <path {...iconStroke} d="M7 4v16M4 7l3-3 3 3M4 17l3 3 3-3" />
      <rect {...iconStroke} x="13" y="8" width="7" height="7" rx="1.5" />
    </>
  ),
  question: (
    <>
      <circle {...iconStroke} cx="12" cy="12" r="8" />
      <path {...iconStroke} d="M9.7 9a2.4 2.4 0 0 1 4.6 1.1c0 2-2.3 2-2.3 4M12 18h.01" />
    </>
  ),
  tag: (
    <>
      <path {...iconStroke} d="M4 12V5h7l9 9-7 7z" />
      <circle {...iconStroke} cx="8.5" cy="8.5" r="1" />
    </>
  ),
  components: (
    <>
      <rect {...iconStroke} x="4" y="4" width="6" height="6" />
      <rect {...iconStroke} x="14" y="4" width="6" height="6" />
      <rect {...iconStroke} x="4" y="14" width="6" height="6" />
      <rect {...iconStroke} x="14" y="14" width="6" height="6" />
    </>
  ),
  template: (
    <>
      <rect {...iconStroke} x="5" y="4" width="14" height="16" rx="2" />
      <path {...iconStroke} d="M8 8h8M8 12h8M8 16h5" />
    </>
  ),
  settings: (
    <>
      <circle {...iconStroke} cx="12" cy="12" r="3" />
      <path {...iconStroke} d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
    </>
  ),
  size: (
    <>
      <rect {...iconStroke} x="5" y="6" width="14" height="10" />
      <path {...iconStroke} d="M5 20h14M5 18v4M19 18v4" />
    </>
  ),
  background: (
    <>
      <rect {...iconStroke} x="4" y="5" width="16" height="14" rx="2" />
      <path {...iconStroke} d="m4 15 4-4 4 4 3-3 5 5" />
    </>
  ),
  clock: (
    <>
      <circle {...iconStroke} cx="12" cy="12" r="8" />
      <path {...iconStroke} d="M12 7v5l3 2" />
    </>
  ),
  play: <path {...iconStroke} d="m8 5 11 7-11 7z" />,
  note: (
    <>
      <path {...iconStroke} d="M6 4h10l2 2v14H6z" />
      <path {...iconStroke} d="M9 10h6M9 14h6M9 18h4" />
    </>
  ),
  palette: (
    <>
      <path {...iconStroke} d="M12 4a8 8 0 0 0 0 16h1.2a1.8 1.8 0 0 0 1.2-3.1 1.8 1.8 0 0 1 1.2-3.1H18a4 4 0 0 0 0-8.1A9.6 9.6 0 0 0 12 4Z" />
      <circle cx="8.5" cy="10" r="1" fill="currentColor" />
      <circle cx="11.5" cy="8" r="1" fill="currentColor" />
      <circle cx="14.5" cy="10" r="1" fill="currentColor" />
    </>
  ),
  border: (
    <>
      <rect {...iconStroke} x="5" y="5" width="14" height="14" rx="2" strokeDasharray="3 3" />
      <rect {...iconStroke} x="8" y="8" width="8" height="8" />
    </>
  ),
  shadow: (
    <>
      <rect {...iconStroke} x="5" y="5" width="11" height="11" rx="2" />
      <path {...iconStroke} d="M9 19h10V9" opacity=".5" />
    </>
  ),
  radius: (
    <>
      <path {...iconStroke} d="M5 12V8a3 3 0 0 1 3-3h4M19 12v4a3 3 0 0 1-3 3h-4" />
      <path {...iconStroke} d="M5 19h4M15 5h4" />
    </>
  ),
  none: (
    <>
      <circle {...iconStroke} cx="12" cy="12" r="8" />
      <path {...iconStroke} d="M7 17 17 7" />
    </>
  ),
  transition: (
    <>
      <rect {...iconStroke} x="4" y="7" width="9" height="9" />
      <rect {...iconStroke} x="11" y="8" width="9" height="9" fill="currentColor" opacity=".18" />
    </>
  ),
  slideLeft: (
    <>
      <path {...iconStroke} d="M5 12h14M9 8l-4 4 4 4" />
      <rect {...iconStroke} x="12" y="6" width="7" height="12" />
    </>
  ),
  slideRight: (
    <>
      <path {...iconStroke} d="M5 12h14M15 8l4 4-4 4" />
      <rect {...iconStroke} x="5" y="6" width="7" height="12" />
    </>
  ),
  wipeDown: (
    <>
      <path {...iconStroke} d="M12 5v14M8 15l4 4 4-4" />
      <rect {...iconStroke} x="6" y="5" width="12" height="8" />
    </>
  ),
  spark: (
    <>
      <path {...iconStroke} d="M12 3v6M12 15v6M3 12h6M15 12h6M6 6l4 4M14 14l4 4M18 6l-4 4M10 14l-4 4" />
    </>
  ),
  pathLine: <path {...iconStroke} d="M12 4v16M9 7l3-3 3 3M9 17l3 3 3-3" />,
  pathCurve: <path {...iconStroke} d="M6 18c8-1 2-11 12-12M15 5h3v3" />,
  ruler: (
    <>
      <path {...iconStroke} d="M5 4v16M4 5h16M4 19h16" />
      <path {...iconStroke} d="M9 5v3M13 5v5M17 5v3" />
    </>
  ),
  snap: (
    <>
      <path {...iconStroke} d="M7 5v5a5 5 0 0 0 10 0V5" />
      <path {...iconStroke} d="M7 5h4M13 5h4" />
    </>
  ),
  panel: (
    <>
      <rect {...iconStroke} x="4" y="5" width="16" height="14" rx="1.5" />
      <path {...iconStroke} d="M9 5v14M4 10h16" />
    </>
  ),
  device: (
    <>
      <rect {...iconStroke} x="7" y="4" width="10" height="16" rx="2" />
      <path {...iconStroke} d="M10 17h4" />
    </>
  ),
  fullscreen: (
    <>
      <path {...iconStroke} d="M8 4H4v4M16 4h4v4M8 20H4v-4M16 20h4v-4" />
    </>
  ),
  help: (
    <>
      <circle {...iconStroke} cx="12" cy="12" r="8" />
      <path {...iconStroke} d="M9.8 9a2.4 2.4 0 1 1 3.6 2.1c-.9.5-1.4 1-1.4 2.2M12 17h.01" />
    </>
  ),
  book: (
    <>
      <path {...iconStroke} d="M4 5.5A3.5 3.5 0 0 1 7.5 4H20v15H7.5A3.5 3.5 0 0 0 4 20.5z" />
      <path {...iconStroke} d="M4 5.5v15M12 4v15" />
    </>
  ),
  keyboard: (
    <>
      <rect {...iconStroke} x="3" y="6" width="18" height="12" rx="2" />
      <path {...iconStroke} d="M7 10h.01M11 10h.01M15 10h.01M18 10h.01M7 14h8" />
    </>
  ),
  feedback: (
    <>
      <path {...iconStroke} d="M5 5h14v11H8l-3 3z" />
      <path {...iconStroke} d="M8 9h8M8 12h5" />
    </>
  ),
  headset: (
    <>
      <path {...iconStroke} d="M5 14v-2a7 7 0 0 1 14 0v2" />
      <rect {...iconStroke} x="3" y="13" width="4" height="5" rx="1" />
      <rect {...iconStroke} x="17" y="13" width="4" height="5" rx="1" />
      <path {...iconStroke} d="M17 18c0 2-2 3-5 3" />
    </>
  ),
  accessibility: (
    <>
      <circle {...iconStroke} cx="12" cy="5" r="2" />
      <path {...iconStroke} d="M4 9h16M12 9v12M8 21l4-8 4 8" />
    </>
  ),
  scorm: (
    <>
      <path {...iconStroke} d="M4 7 12 3l8 4-8 4z" />
      <path {...iconStroke} d="M4 12l8 4 8-4M4 17l8 4 8-4" />
    </>
  ),
  package: (
    <>
      <path {...iconStroke} d="M4 8 12 4l8 4v8l-8 4-8-4z" />
      <path {...iconStroke} d="M4 8l8 4 8-4M12 12v8" />
    </>
  ),
  score: (
    <>
      <circle {...iconStroke} cx="12" cy="12" r="8" />
      <path {...iconStroke} d="M8 13l2.5 2.5L16 9" />
    </>
  ),
  zip: (
    <>
      <path {...iconStroke} d="M7 3h8l4 4v14H7z" />
      <path {...iconStroke} d="M15 3v5h5M10 6h2M12 8h-2M10 10h2M12 12h-2M10 17h4" />
    </>
  ),
  more: <path {...iconStroke} d="m7 10 5 5 5-5" />,
};

export function RibbonIcon({ icon, color = 'currentColor', size = 20 }) {
  if (!icon) return null;
  if (typeof icon !== 'string') return icon;
  const svgIcon = icons[icon];

  if (!svgIcon) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: size,
          height: size,
          color,
          fontSize: Math.max(10, size - 4),
          fontWeight: 900,
          lineHeight: 1,
        }}
      >
        {icon}
      </span>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block', color }}
    >
      {svgIcon}
    </svg>
  );
}

export function RibbonGroup({ title, children, width = 'auto', grow = false }) {
  return (
    <div
      style={{
        width: width === 'auto' ? 'auto' : width,
        minWidth: width === 'auto' ? 86 : width,
        maxWidth: width === 'auto' ? 'none' : width,
        flex: grow ? '1 1 0' : '0 0 auto',
        height: 88,
        minHeight: 88,
        maxHeight: 88,
        padding: '7px 9px 5px',
        borderRight: `1px solid ${workspaceChrome.ribbon.separator}`,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: 3,
        boxSizing: 'border-box',
        overflow: 'visible',
      }}
    >
      <div
        style={{
          height: 62,
          minHeight: 62,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 5,
          minWidth: 0,
          overflow: 'visible',
          flexWrap: 'nowrap',
        }}
      >
        {children}
      </div>
      <div
        style={{
          height: 11,
          fontSize: 9,
          color: '#6b7d96',
          textAlign: 'center',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          fontWeight: 650,
          lineHeight: '11px',
        }}
      >
        {title}
      </div>
    </div>
  );
}

export function RibbonStack({ children, gap = 2, style = {} }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap,
        minWidth: 0,
        flexShrink: 0,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function RibbonRow({ children, gap = 5, style = {} }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap,
        minWidth: 0,
        flexShrink: 0,
        flexWrap: 'nowrap',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function RibbonFieldLabel({ children, width = 48 }) {
  return (
    <span
      style={{
        width,
        flexShrink: 0,
        color: '#42526b',
        fontSize: 10,
        fontWeight: 650,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

export function RibbonButton({
  label,
  icon,
  onClick,
  disabled = false,
  active = false,
  title,
  width = 58,
  tone = 'blue',
}) {
  const color = toneColors[tone] || toneColors.blue;

  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={title || label}
      style={{
        width,
        minWidth: width,
        height: 58,
        padding: '4px 4px 3px',
        border: active ? '1px solid #7aa9ff' : '1px solid transparent',
        background: active ? '#edf4ff' : 'transparent',
        color: disabled ? '#a8b6c9' : '#13233d',
        fontSize: 10,
        fontWeight: 700,
        cursor: disabled ? 'default' : 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        borderRadius: 5,
        lineHeight: 1.05,
        boxSizing: 'border-box',
        overflow: 'hidden',
        ...(disabled ? disabledStyle : null),
      }}
    >
      <span
        style={{
          width: 24,
          height: 23,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <RibbonIcon icon={icon} color={disabled ? '#b8c3d2' : color} size={21} />
      </span>
      <span
        style={{
          maxWidth: width - 6,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
    </button>
  );
}

export function CompactRibbonButton({
  label,
  icon,
  onClick,
  disabled = false,
  active = false,
  title,
  width = 76,
  tone = 'blue',
}) {
  const color = toneColors[tone] || toneColors.blue;

  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={title || label}
      style={{
        width,
        minWidth: width,
        height: 20,
        padding: '0 6px',
        border: active ? '1px solid #8bb7ff' : '1px solid #dce6f3',
        background: active ? '#edf4ff' : '#ffffff',
        color: disabled ? '#a8b6c9' : '#1d2b43',
        fontSize: 9,
        fontWeight: 700,
        cursor: disabled ? 'default' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: 4,
        borderRadius: 5,
        lineHeight: 1,
        boxSizing: 'border-box',
        overflow: 'hidden',
        ...(disabled ? disabledStyle : null),
      }}
    >
      <span
        style={{
          width: 14,
          height: 14,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <RibbonIcon icon={icon} color={disabled ? '#b8c3d2' : color} size={14} />
      </span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
    </button>
  );
}

export function RibbonSelect({ value, onChange, options = [], disabled = false, width = 112 }) {
  return (
    <select
      value={value}
      onChange={onChange}
      disabled={disabled}
      style={{
        width,
        minWidth: width,
        height: 24,
        border: '1px solid #cbd7e6',
        borderRadius: 5,
        background: disabled ? '#f6f8fb' : '#ffffff',
        color: disabled ? '#9aa8ba' : '#172033',
        fontSize: 10,
        fontWeight: 700,
        padding: '0 6px',
        outline: 'none',
        boxSizing: 'border-box',
      }}
    >
      {options.map((option) => (
        <option key={option.value ?? option.id} value={option.value ?? option.id}>
          {option.label ?? option.name}
        </option>
      ))}
    </select>
  );
}

export function RibbonNumberInput({
  value,
  onChange,
  disabled = false,
  width = 54,
  min,
  max,
  step,
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onChange={onChange}
      style={{
        width,
        minWidth: width,
        height: 24,
        border: '1px solid #cbd7e6',
        borderRadius: 5,
        background: disabled ? '#f6f8fb' : '#ffffff',
        color: disabled ? '#9aa8ba' : '#172033',
        fontSize: 10,
        fontWeight: 700,
        padding: '0 5px',
        boxSizing: 'border-box',
      }}
    />
  );
}

export function RibbonColorInput({ value, onChange, disabled = false, title }) {
  const { draft, flush, scheduleCommit } = useDeferredColor({
    value,
    onCommit: onChange,
    eventMode: true,
  });

  return (
    <input
      type="color"
      value={draft}
      onInput={(event) => scheduleCommit(event.target.value)}
      onChange={(event) => scheduleCommit(event.target.value)}
      onBlur={flush}
      onPointerUp={flush}
      disabled={disabled}
      title={title}
      style={{
        width: 24,
        minWidth: 24,
        height: 24,
        padding: 1,
        border: '1px solid #cbd7e6',
        borderRadius: 5,
        background: '#ffffff',
        cursor: disabled ? 'default' : 'pointer',
        ...(disabled ? disabledStyle : null),
      }}
    />
  );
}

export function RibbonPopoverButton({
  label = 'Daha Fazla',
  icon = 'more',
  title,
  children,
  disabled = false,
  width = 86,
  align = 'left',
  variant = 'compact',
  tone = 'blue',
}) {
  const generatedId = useId();
  const context = useContext(RibbonPopoverContext);
  const fallbackOpen = useState(false);
  const [localOpen, setLocalOpen] = fallbackOpen;
  const popoverId = `${label}-${generatedId}`;
  const open = context ? context.openPopoverId === popoverId : localOpen;
  const setOpen = useCallback((nextOpen) => {
    if (context) {
      context.setOpenPopoverId(nextOpen ? popoverId : '');
      return;
    }
    setLocalOpen(nextOpen);
  }, [context, popoverId, setLocalOpen]);
  const rootRef = useRef(null);
  const ButtonComponent = variant === 'large' ? RibbonButton : CompactRibbonButton;
  const popupTop = variant === 'large' ? 62 : 24;

  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined;
    const closeOnOutsideClick = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick);
  }, [open, setOpen]);

  return (
    <div ref={rootRef} style={{ position: 'relative', flexShrink: 0 }}>
      <ButtonComponent
        label={label}
        icon={icon}
        width={width}
        disabled={disabled}
        active={open}
        tone={tone}
        title={title || label}
        onClick={() => setOpen(!open)}
      />
      {open && (
        <div
          style={{
            position: 'absolute',
            top: popupTop,
            left: align === 'left' ? 0 : 'auto',
            right: align === 'right' ? 0 : 'auto',
            zIndex: 120,
            minWidth: 220,
            maxWidth: 540,
            maxHeight: 360,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: 10,
            border: '1px solid #cbd7e6',
            borderRadius: 8,
            background: '#ffffff',
            boxShadow: '0 18px 42px rgba(15,23,42,.18)',
          }}
          onClick={(event) => {
            const target = event.target;
            if (target?.closest?.('button')) setOpen(false);
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function RibbonMenuGrid({ children, columns = 'repeat(3, minmax(0, 1fr))' }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: columns,
        gap: 6,
        alignItems: 'center',
      }}
    >
      {children}
    </div>
  );
}

export function RibbonGalleryButton({
  children,
  label,
  onClick,
  disabled = false,
  active = false,
  width = 42,
  height = 34,
  title,
}) {
  return (
    <button
      type="button"
      title={title || label}
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      style={{
        width,
        minWidth: width,
        height,
        padding: 4,
        border: active ? '1px solid #7aa9ff' : '1px solid #d8e2ef',
        borderRadius: 5,
        background: active ? '#edf4ff' : '#ffffff',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.36 : 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
      }}
    >
      {children || label}
    </button>
  );
}

export function RibbonSwatch({ color, active = false, title, onClick }) {
  return (
    <button
      type="button"
      title={title || color}
      onClick={onClick}
      style={{
        width: 18,
        minWidth: 18,
        height: 18,
        borderRadius: 4,
        border: active ? '2px solid #2563eb' : '1px solid #cbd5e1',
        background: color,
        cursor: 'pointer',
      }}
    />
  );
}
