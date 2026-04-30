import React from 'react';

const EDITOR_THEME = {
  shellMuted: '#91a6c6',
  shellBorder: '#22324d',
  shellInset: '#0d1728',
  shellText: '#e6eefc',
  shellAccentStrong: '#0ea5e9',
  shellMutedSoft: '#627998',
  shellPanelAlt: '#16223b',
};

function Inp({ label, value, onChange, type = 'text', placeholder = '', rows }) {
  const base = {
    width: '100%',
    padding: '5px 8px',
    borderRadius: 5,
    border: '1px solid #333',
    background: '#0f0f20',
    color: '#E0E0E0',
    fontSize: 11,
    boxSizing: 'border-box',
    outline: 'none',
  };
  return (
    <div>
      {label && (
        <label style={{ fontSize: 9, color: '#78909C', display: 'block', marginBottom: 2 }}>
          {label}
        </label>
      )}
      {type === 'textarea' ? (
        <textarea
          value={value}
          onChange={onChange}
          rows={rows || 3}
          placeholder={placeholder}
          style={{ ...base, resize: 'vertical' }}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          style={base}
        />
      )}
    </div>
  );
}

function SelectInp({ label, value, onChange, options }) {
  return (
    <div>
      {label && (
        <label
          style={{ fontSize: 9, color: EDITOR_THEME.shellMuted, display: 'block', marginBottom: 2 }}
        >
          {label}
        </label>
      )}
      <select
        value={value}
        onChange={onChange}
        style={{
          width: '100%',
          padding: '5px 8px',
          borderRadius: 5,
          border: `1px solid ${EDITOR_THEME.shellBorder}`,
          background: EDITOR_THEME.shellInset,
          color: EDITOR_THEME.shellText,
          fontSize: 11,
          boxSizing: 'border-box',
          outline: 'none',
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Btn({
  children,
  onClick,
  color = EDITOR_THEME.shellAccentStrong,
  small = false,
  disabled = false,
  style: s = {},
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: small ? '4px 10px' : '6px 14px',
        borderRadius: 6,
        cursor: disabled ? 'default' : 'pointer',
        fontSize: small ? 10 : 11,
        fontWeight: 600,
        border: `1px solid ${color}`,
        transition: 'all .15s',
        background: disabled ? EDITOR_THEME.shellInset : color + '22',
        color: disabled ? EDITOR_THEME.shellMutedSoft : color,
        opacity: disabled ? 0.5 : 1,
        flexShrink: 0,
        ...s,
      }}
    >
      {children}
    </button>
  );
}

function Modal({ title, onClose, width = 400, children }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#000c',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          background: EDITOR_THEME.shellPanelAlt,
          borderRadius: 14,
          padding: 24,
          width,
          maxWidth: '92vw',
          border: `1px solid ${EDITOR_THEME.shellBorder}`,
          maxHeight: '85vh',
          overflowY: 'auto',
          boxShadow: '0 18px 48px rgba(2,8,23,.45)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 18,
          }}
        >
          <span style={{ fontWeight: 700, fontSize: 14, color: EDITOR_THEME.shellText }}>
            {title}
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: EDITOR_THEME.shellMutedSoft,
              cursor: 'pointer',
              fontSize: 18,
            }}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const PACKAGE_SCREEN_THEMES = {
  'pkg-1': {
    intro: 'linear-gradient(135deg,#082f49,#155e75)',
    play: 'linear-gradient(135deg,#0f172a,#164e63)',
    success: 'linear-gradient(135deg,#083344,#0f766e)',
    failure: 'linear-gradient(135deg,#172554,#7e22ce)',
    button: 'linear-gradient(135deg,#22d3ee,#0891b2)',
    text: '#ecfeff',
    panel: 'rgba(8,47,73,.55)',
    border: '#22d3ee',
    accent: '#06b6d4',
    accentDark: '#0e7490',
    successTone: '#14b8a6',
    dangerTone: '#f43f5e',
    radius: 18,
  },
  'pkg-2': {
    intro: 'linear-gradient(135deg,#052e16,#14532d)',
    play: 'linear-gradient(135deg,#064e3b,#166534)',
    success: 'linear-gradient(135deg,#022c22,#15803d)',
    failure: 'linear-gradient(135deg,#3f6212,#166534)',
    button: 'linear-gradient(135deg,#34d399,#059669)',
    text: '#ecfdf5',
    panel: 'rgba(6,78,59,.5)',
    border: '#34d399',
    accent: '#10b981',
    accentDark: '#047857',
    successTone: '#22c55e',
    dangerTone: '#f97316',
    radius: 20,
  },
  'pkg-3': {
    intro: 'linear-gradient(135deg,#312e81,#6d28d9)',
    play: 'linear-gradient(135deg,#1e1b4b,#7c3aed)',
    success: 'linear-gradient(135deg,#4c1d95,#8b5cf6)',
    failure: 'linear-gradient(135deg,#581c87,#be185d)',
    button: 'linear-gradient(135deg,#8b5cf6,#d946ef)',
    text: '#f5f3ff',
    panel: 'rgba(49,46,129,.48)',
    border: '#a78bfa',
    accent: '#8b5cf6',
    accentDark: '#6d28d9',
    successTone: '#22c55e',
    dangerTone: '#ec4899',
    radius: 16,
  },
  'pkg-4': {
    intro: 'linear-gradient(135deg,#78350f,#b45309)',
    play: 'linear-gradient(135deg,#451a03,#92400e)',
    success: 'linear-gradient(135deg,#14532d,#ca8a04)',
    failure: 'linear-gradient(135deg,#7c2d12,#dc2626)',
    button: 'linear-gradient(135deg,#fbbf24,#f97316)',
    text: '#fffbeb',
    panel: 'rgba(120,53,15,.42)',
    border: '#fbbf24',
    accent: '#f59e0b',
    accentDark: '#c2410c',
    successTone: '#65a30d',
    dangerTone: '#ef4444',
    radius: 14,
  },
  'pkg-5': {
    intro: 'linear-gradient(135deg,#500724,#9d174d)',
    play: 'linear-gradient(135deg,#4a044e,#be185d)',
    success: 'linear-gradient(135deg,#701a75,#db2777)',
    failure: 'linear-gradient(135deg,#831843,#be123c)',
    button: 'linear-gradient(135deg,#f472b6,#ec4899)',
    text: '#fdf2f8',
    panel: 'rgba(80,7,36,.48)',
    border: '#f472b6',
    accent: '#ec4899',
    accentDark: '#be185d',
    successTone: '#22c55e',
    dangerTone: '#fb7185',
    radius: 24,
  },
  'pkg-6': {
    intro: 'linear-gradient(135deg,#172554,#1d4ed8)',
    play: 'linear-gradient(135deg,#1e3a8a,#2563eb)',
    success: 'linear-gradient(135deg,#0f172a,#3b82f6)',
    failure: 'linear-gradient(135deg,#1e1b4b,#1d4ed8)',
    button: 'linear-gradient(135deg,#60a5fa,#2563eb)',
    text: '#eff6ff',
    panel: 'rgba(30,58,138,.45)',
    border: '#60a5fa',
    accent: '#2563eb',
    accentDark: '#1d4ed8',
    successTone: '#16a34a',
    dangerTone: '#ef4444',
    radius: 16,
  },
  'pkg-7': {
    intro: 'linear-gradient(135deg,#1a2e05,#4d7c0f)',
    play: 'linear-gradient(135deg,#365314,#65a30d)',
    success: 'linear-gradient(135deg,#14532d,#84cc16)',
    failure: 'linear-gradient(135deg,#365314,#a16207)',
    button: 'linear-gradient(135deg,#bef264,#65a30d)',
    text: '#1a2e05',
    panel: 'rgba(54,83,20,.46)',
    border: '#bef264',
    accent: '#84cc16',
    accentDark: '#4d7c0f',
    successTone: '#16a34a',
    dangerTone: '#f97316',
    radius: 999,
  },
  'pkg-8': {
    intro: 'linear-gradient(135deg,#450a0a,#be123c)',
    play: 'linear-gradient(135deg,#7f1d1d,#e11d48)',
    success: 'linear-gradient(135deg,#7f1d1d,#fb7185)',
    failure: 'linear-gradient(135deg,#881337,#dc2626)',
    button: 'linear-gradient(135deg,#fb7185,#e11d48)',
    text: '#fff1f2',
    panel: 'rgba(127,29,29,.48)',
    border: '#fb7185',
    accent: '#f43f5e',
    accentDark: '#be123c',
    successTone: '#22c55e',
    dangerTone: '#dc2626',
    radius: 18,
  },
  'pkg-9': {
    intro: 'linear-gradient(135deg,#111827,#334155)',
    play: 'linear-gradient(135deg,#1f2937,#475569)',
    success: 'linear-gradient(135deg,#0f172a,#64748b)',
    failure: 'linear-gradient(135deg,#1f2937,#b91c1c)',
    button: 'linear-gradient(135deg,#94a3b8,#475569)',
    text: '#f8fafc',
    panel: 'rgba(15,23,42,.52)',
    border: '#94a3b8',
    accent: '#64748b',
    accentDark: '#334155',
    successTone: '#22c55e',
    dangerTone: '#ef4444',
    radius: 12,
  },
  'pkg-10': {
    intro: 'linear-gradient(135deg,#3b0764,#6d28d9)',
    play: 'linear-gradient(135deg,#581c87,#7c3aed)',
    success: 'linear-gradient(135deg,#4c1d95,#a855f7)',
    failure: 'linear-gradient(135deg,#581c87,#db2777)',
    button: 'linear-gradient(135deg,#c084fc,#7c3aed)',
    text: '#faf5ff',
    panel: 'rgba(76,29,149,.48)',
    border: '#c084fc',
    accent: '#a855f7',
    accentDark: '#7c3aed',
    successTone: '#22c55e',
    dangerTone: '#ec4899',
    radius: 22,
  },
};

function getPackageTheme(pkgId) {
  return PACKAGE_SCREEN_THEMES[pkgId] || PACKAGE_SCREEN_THEMES['pkg-1'];
}

function shuffleArray(items = []) {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export { Inp, SelectInp, Btn, Modal, getPackageTheme, shuffleArray };
