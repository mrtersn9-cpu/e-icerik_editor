import { useEffect, useRef, useState } from 'react';

export const mapChrome = {
  blue: '#2563eb',
  blueDark: '#174ea6',
  border: '#d8e2ef',
  borderSoft: '#e5edf6',
  panel: '#ffffff',
  panelSoft: '#f8fbff',
  active: '#eaf2ff',
  text: '#172033',
  muted: '#64748b',
  success: '#16a34a',
  warning: '#f59e0b',
  danger: '#ef4444',
};

const iconStroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

const icons = {
  add: <path {...iconStroke} d="M12 5v14M5 12h14" />,
  copy: (
    <>
      <rect {...iconStroke} x="8" y="8" width="11" height="11" rx="1.7" />
      <path {...iconStroke} d="M5 15V5h10" />
    </>
  ),
  delete: (
    <>
      <path {...iconStroke} d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13" />
      <path {...iconStroke} d="M10 11v6M14 11v6" />
    </>
  ),
  down: <path {...iconStroke} d="M12 5v14M7 14l5 5 5-5" />,
  edit: (
    <>
      <path {...iconStroke} d="M5 19l4.2-1 9.4-9.4-3.2-3.2L6 14.8z" />
      <path {...iconStroke} d="M13.8 7l3.2 3.2" />
    </>
  ),
  eye: (
    <>
      <path {...iconStroke} d="M3.5 12s3-5 8.5-5 8.5 5 8.5 5-3 5-8.5 5-8.5-5-8.5-5z" />
      <circle {...iconStroke} cx="12" cy="12" r="2.3" />
    </>
  ),
  eyeOff: (
    <>
      <path {...iconStroke} d="M4 4l16 16M9.5 6.6A8.8 8.8 0 0 1 12 6c5.5 0 8.5 6 8.5 6a14 14 0 0 1-2.1 2.8M14.1 14.1A2.8 2.8 0 0 1 9.9 9.9M6.4 8.5A14 14 0 0 0 3.5 12s3 6 8.5 6c.9 0 1.8-.2 2.6-.5" />
    </>
  ),
  layer: (
    <>
      <path {...iconStroke} d="M12 4 4 8l8 4 8-4z" />
      <path {...iconStroke} d="M4 13l8 4 8-4M4 18l8 4 8-4" />
    </>
  ),
  lock: (
    <>
      <rect {...iconStroke} x="6" y="10" width="12" height="10" rx="2" />
      <path {...iconStroke} d="M9 10V7a3 3 0 0 1 6 0v3" />
    </>
  ),
  menu: (
    <>
      <path {...iconStroke} d="M5 7h14M5 12h14M5 17h14" />
    </>
  ),
  scene: (
    <>
      <rect {...iconStroke} x="5" y="4" width="14" height="16" rx="2" />
      <path {...iconStroke} d="M8 8h8M8 12h8M8 16h5" />
    </>
  ),
  unlock: (
    <>
      <rect {...iconStroke} x="6" y="10" width="12" height="10" rx="2" />
      <path {...iconStroke} d="M9 10V7a3 3 0 0 1 5.5-1.6" />
    </>
  ),
  up: <path {...iconStroke} d="M12 19V5M7 10l5-5 5 5" />,
  warning: (
    <>
      <path {...iconStroke} d="M12 4 3.5 19h17z" />
      <path {...iconStroke} d="M12 9v4M12 16h.01" />
    </>
  ),
};

export function MiniIcon({ icon, size = 14 }) {
  const body = icons[icon];
  if (!body) return <span style={{ fontSize: size - 2, lineHeight: 1 }}>{icon}</span>;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block' }}
    >
      {body}
    </svg>
  );
}

export function IconButton({
  active = false,
  disabled = false,
  icon,
  label,
  onClick,
  tone = mapChrome.blue,
}) {
  const [hovered, setHovered] = useState(false);
  const color = disabled ? '#cbd5e1' : active ? tone : mapChrome.muted;
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={label}
      title={label}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 26,
        height: 26,
        minWidth: 26,
        borderRadius: 6,
        border: `1px solid ${active || hovered ? '#bfdbfe' : mapChrome.border}`,
        background: disabled ? '#f8fafc' : active || hovered ? mapChrome.active : '#ffffff',
        color,
        cursor: disabled ? 'default' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
      }}
    >
      <MiniIcon icon={icon} />
    </button>
  );
}

export function ToolbarButton(props) {
  return <IconButton {...props} />;
}

export function SectionHeader({ action, count, title }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        rowGap: 6,
        // Dar panelde başlık + buton sırası sığmazsa butonlar alt satıra sarsın (kırpılmasın)
        flexWrap: 'wrap',
        minHeight: 28,
      }}
    >
      <div style={{ minWidth: 0, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            color: mapChrome.muted,
            fontSize: 10.5,
            fontWeight: 900,
            letterSpacing: 0.35,
            textTransform: 'uppercase',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </span>
        {typeof count === 'number' ? <CountPill>{count}</CountPill> : null}
      </div>
      {action}
    </div>
  );
}

export function CountPill({ children, tone = mapChrome.blue }) {
  return (
    <span
      style={{
        minWidth: 20,
        height: 18,
        padding: '0 6px',
        borderRadius: 999,
        border: `1px solid ${tone}28`,
        background: `${tone}10`,
        color: tone,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 9.5,
        fontWeight: 950,
        lineHeight: 1,
        maxWidth: 128,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        }}
    >
      {children}
    </span>
  );
}

export function TreeRow({
  active = false,
  actions,
  children,
  depth = 0,
  icon,
  onClick,
  onDoubleClick,
  onKeyDown,
  tone = mapChrome.blue,
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick?.(event);
        }
        onKeyDown?.(event);
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        minHeight: 30,
        display: 'grid',
        gridTemplateColumns: '20px minmax(0,1fr) auto',
        alignItems: 'center',
        gap: 7,
        borderRadius: 7,
        border: `1px solid ${active ? '#bfdbfe' : hovered ? '#e0e8f4' : 'transparent'}`,
        background: active ? mapChrome.active : hovered ? '#f8fbff' : 'transparent',
        color: active ? tone : mapChrome.text,
        cursor: 'pointer',
        padding: `3px 5px 3px ${5 + depth * 18}px`,
        textAlign: 'left',
      }}
    >
      <span
        style={{
          width: 20,
          height: 20,
          borderRadius: 5,
          border: `1px solid ${active ? '#bfdbfe' : mapChrome.border}`,
          background: '#ffffff',
          color: active ? tone : mapChrome.muted,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 10,
          fontWeight: 950,
          lineHeight: 1,
        }}
      >
        {typeof icon === 'string' && icons[icon] ? <MiniIcon icon={icon} size={13} /> : icon}
      </span>
      <div style={{ minWidth: 0 }}>{children}</div>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{actions}</div>
    </div>
  );
}

export function InlineRename({
  active = false,
  className,
  displayValue,
  editKey = 0,
  onCancel,
  onCommit,
  placeholder = '',
  readOnly = false,
  title,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(displayValue || '');
  const inputRef = useRef(null);
  const lastEditKeyRef = useRef(editKey);

  useEffect(() => {
    if (!editing) setDraft(displayValue || '');
  }, [displayValue, editing]);

  useEffect(() => {
    if (readOnly || editKey === lastEditKeyRef.current) return;
    lastEditKeyRef.current = editKey;
    setDraft(displayValue || '');
    setEditing(true);
  }, [displayValue, editKey, readOnly]);

  useEffect(() => {
    if (!editing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  const finish = () => {
    const nextValue = draft.trim();
    setEditing(false);
    onCommit?.(nextValue);
  };

  const cancel = () => {
    setDraft(displayValue || '');
    setEditing(false);
    onCancel?.();
  };

  if (editing && !readOnly) {
    return (
      <input
        ref={inputRef}
        className={className}
        value={draft}
        placeholder={placeholder}
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={finish}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            finish();
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            cancel();
          }
        }}
        style={{
          width: '100%',
          minWidth: 0,
          height: 24,
          border: '1px solid #93c5fd',
          borderRadius: 6,
          background: '#ffffff',
          color: mapChrome.blueDark,
          fontSize: 11.5,
          fontWeight: 850,
          outline: 'none',
          padding: '0 7px',
          boxSizing: 'border-box',
        }}
      />
    );
  }

  return (
    <button
      type="button"
      className={className}
      title={title || displayValue}
      onClick={() => {}}
      onDoubleClick={(event) => {
        event.stopPropagation();
        if (!readOnly) setEditing(true);
      }}
      onKeyDown={(event) => {
        if (event.key === 'F2' && !readOnly) {
          event.preventDefault();
          setEditing(true);
        }
      }}
      style={{
        width: '100%',
        minWidth: 0,
        border: 'none',
        background: 'transparent',
        color: active ? mapChrome.blueDark : mapChrome.text,
        cursor: readOnly ? 'default' : 'text',
        fontSize: 11.5,
        fontWeight: active ? 900 : 780,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        padding: 0,
        textAlign: 'left',
      }}
    >
      {displayValue || placeholder}
    </button>
  );
}
