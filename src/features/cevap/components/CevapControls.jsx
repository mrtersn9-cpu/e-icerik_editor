export const fieldInputStyle = {
  width: '100%',
  minWidth: 0,
  height: 28,
  border: '1px solid #dbe7f5',
  borderRadius: 7,
  background: '#ffffff',
  color: '#0f172a',
  fontSize: 10.5,
  padding: '0 8px',
  outline: 'none',
};

export function CevapCard({ number, title, children, wide = false, order }) {
  return (
    <section
      style={{
        order: order ?? (Number(number) || undefined),
        gridColumn: wide ? '1 / -1' : 'span 1',
        minWidth: 0,
        border: '1px solid #dbe4ef',
        borderRadius: 8,
        background: '#ffffff',
        padding: 8,
        boxShadow: 'none',
      }}
    >
      <div
        style={{
          color: '#1d4ed8',
          fontSize: 10.5,
          fontWeight: 900,
          textTransform: 'uppercase',
          marginBottom: 6,
        }}
      >
        {number}. {title}
      </div>
      {children}
    </section>
  );
}

export function ReadOnlyValue({ label, value, hint }) {
  return (
    <div style={{ display: 'grid', gap: 4, color: '#334155', fontSize: 10.5, fontWeight: 700 }}>
      {label && <span>{label}</span>}
      <div
        style={{
          minHeight: 28,
          border: '1px solid #dbe7f5',
          borderRadius: 7,
          background: '#f8fafc',
          color: '#0f172a',
          display: 'flex',
          alignItems: 'center',
          padding: '0 8px',
          fontSize: 10.5,
          fontWeight: 800,
        }}
      >
        {value || '-'}
      </div>
      {hint && <span style={{ color: '#64748b', fontSize: 10, fontWeight: 500 }}>{hint}</span>}
    </div>
  );
}

export function Field({ label, children, hint }) {
  return (
    <label style={{ display: 'grid', gap: 4, color: '#334155', fontSize: 10.5, fontWeight: 700 }}>
      <span>{label}</span>
      {children}
      {hint && <span style={{ color: '#64748b', fontSize: 10, fontWeight: 500 }}>{hint}</span>}
    </label>
  );
}

export function TextInput({ value, onChange, placeholder = '', type = 'text', min, max }) {
  return (
    <input
      type={type}
      min={min}
      max={max}
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      style={fieldInputStyle}
    />
  );
}

export function TextArea({ value, onChange, placeholder = '', rows = 3 }) {
  return (
    <textarea
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{
        ...fieldInputStyle,
        height: 'auto',
        minHeight: rows * 24,
        padding: 8,
        lineHeight: 1.4,
        resize: 'vertical',
      }}
    />
  );
}

export function SelectInput({ value, onChange, options }) {
  return (
    <select value={value ?? ''} onChange={(event) => onChange(event.target.value)} style={fieldInputStyle}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function ToggleRow({ label, checked, onChange, hint }) {
  return (
    <label
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0,1fr) auto',
        gap: 8,
        alignItems: 'center',
        color: '#334155',
        fontSize: 10.5,
        fontWeight: 700,
      }}
    >
      <span>
        {label}
        {hint && (
          <span style={{ display: 'block', color: '#64748b', fontSize: 10, fontWeight: 500 }}>
            {hint}
          </span>
        )}
      </span>
      <input
        type="checkbox"
        checked={!!checked}
        onChange={(event) => onChange(event.target.checked)}
        style={{ width: 16, height: 16, accentColor: '#2563eb' }}
      />
    </label>
  );
}

export function ActionButton({ children, onClick, variant = 'primary', disabled = false }) {
  const primary = variant === 'primary';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%',
        minHeight: 28,
        borderRadius: 7,
        border: primary ? '1px solid #1d4ed8' : '1px solid #dbe7f5',
        background: primary ? '#1769e8' : '#ffffff',
        color: primary ? '#ffffff' : '#1e293b',
        fontSize: 10.5,
        fontWeight: 900,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.48 : 1,
      }}
    >
      {children}
    </button>
  );
}

export function SmallButton({ children, onClick, variant = 'secondary', disabled = false, ariaLabel }) {
  const danger = variant === 'danger';
  const primary = variant === 'primary';
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={disabled}
      style={{
        minHeight: 28,
        borderRadius: 7,
        border: danger ? '1px solid #fecaca' : primary ? '1px solid #1d4ed8' : '1px solid #dbe7f5',
        background: primary ? '#1769e8' : '#ffffff',
        color: danger ? '#dc2626' : primary ? '#ffffff' : '#1d4ed8',
        padding: '0 9px',
        fontSize: 10.5,
        fontWeight: 900,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}

export function Pill({ children, tone = 'blue' }) {
  const tones = {
    blue: ['#eff6ff', '#1d4ed8', '#bfdbfe'],
    green: ['#dcfce7', '#166534', '#bbf7d0'],
    red: ['#fef2f2', '#b91c1c', '#fecaca'],
    slate: ['#f8fafc', '#334155', '#e2e8f0'],
  };
  const [bg, color, border] = tones[tone] || tones.blue;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        minHeight: 20,
        borderRadius: 7,
        border: `1px solid ${border}`,
        background: bg,
        color,
        padding: '0 7px',
        fontSize: 10,
        fontWeight: 900,
      }}
    >
      {children}
    </span>
  );
}

export function ChoiceButton({ children, selected = false, onClick, tone = 'blue', disabled = false }) {
  const tones = {
    blue: ['#eff6ff', '#1d4ed8', '#bfdbfe'],
    green: ['#f0fdf4', '#166534', '#86efac'],
    amber: ['#fffbeb', '#92400e', '#fde68a'],
    slate: ['#f8fafc', '#334155', '#e2e8f0'],
  };
  const [bg, color, border] = tones[tone] || tones.blue;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        minHeight: 28,
        borderRadius: 7,
        border: `1px solid ${selected ? color : border}`,
        background: selected ? bg : '#ffffff',
        color: selected ? color : '#334155',
        padding: '5px 7px',
        fontSize: 10.5,
        fontWeight: 900,
        textAlign: 'left',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.55 : 1,
      }}
    >
      {children}
    </button>
  );
}

export function MiniPreview({ label, value, empty = 'Seçim yok', tone = 'blue' }) {
  const tones = {
    blue: ['#eff6ff', '#1d4ed8', '#bfdbfe'],
    green: ['#f0fdf4', '#166534', '#86efac'],
    amber: ['#fffbeb', '#92400e', '#fde68a'],
    slate: ['#f8fafc', '#334155', '#e2e8f0'],
  };
  const [bg, color, border] = tones[tone] || tones.blue;
  return (
    <div
      style={{
        display: 'grid',
        gap: 4,
        border: `1px solid ${border}`,
        borderRadius: 7,
        background: bg,
        padding: '6px 7px',
        minWidth: 0,
      }}
    >
      {label && (
        <span style={{ color: '#64748b', fontSize: 10, fontWeight: 900, textTransform: 'uppercase' }}>
          {label}
        </span>
      )}
      <span style={{ color, fontSize: 10.5, fontWeight: 900, overflowWrap: 'anywhere' }}>
        {value || empty}
      </span>
    </div>
  );
}

export function MiniTable({ columns, rows, emptyText = '0 öğe' }) {
  if (!rows.length) {
    return (
      <div
        style={{
          border: '1px dashed #cbd5e1',
          borderRadius: 8,
          padding: 8,
          color: '#64748b',
          fontSize: 10.5,
          textAlign: 'center',
        }}
      >
        {emptyText}
      </div>
    );
  }
  return (
    <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 7 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10.5 }}>
        <thead>
          <tr style={{ background: '#f8fafc', color: '#334155' }}>
            {columns.map((column) => (
              <th key={column} style={{ textAlign: 'left', padding: '5px 7px', fontWeight: 900 }}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id || index} style={{ borderTop: '1px solid #e2e8f0' }}>
              {row.cells.map((cell, cellIndex) => (
                <td key={cellIndex} style={{ padding: '5px 7px', color: '#334155' }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PanelGrid({ children }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))',
        gap: 7,
        alignItems: 'start',
      }}
    >
      {children}
    </div>
  );
}
