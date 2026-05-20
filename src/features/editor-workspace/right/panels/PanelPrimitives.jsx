export function PanelShell({ children, subtitle, title }) {
  return (
    <div
      style={{
        height: '100%',
        minHeight: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
        background: 'linear-gradient(180deg,#fbfdff,#f3f8ff)',
        padding: 10,
      }}
    >
      <div style={{ marginBottom: 10 }}>
        <div
          style={{
            color: '#174ea6',
            fontSize: 12,
            fontWeight: 950,
            letterSpacing: 0.2,
            textTransform: 'uppercase',
          }}
        >
          {title}
        </div>
        {subtitle ? (
          <div style={{ color: '#64748b', fontSize: 10.5, fontWeight: 650, marginTop: 3 }}>
            {subtitle}
          </div>
        ) : null}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>{children}</div>
    </div>
  );
}

export function PanelCard({ children, title, action }) {
  return (
    <section
      style={{
        border: '1px solid #d6e3f1',
        borderRadius: 8,
        background: '#ffffff',
        boxShadow: '0 8px 18px rgba(15,23,42,.05)',
        overflow: 'hidden',
      }}
    >
      {title ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            minHeight: 32,
            padding: '7px 9px',
            borderBottom: '1px solid #e5edf6',
            background: '#f8fbff',
          }}
        >
          <div
            style={{
              color: '#2563eb',
              fontSize: 10.5,
              fontWeight: 950,
              letterSpacing: 0.35,
              textTransform: 'uppercase',
            }}
          >
            {title}
          </div>
          {action}
        </div>
      ) : null}
      <div style={{ padding: 9 }}>{children}</div>
    </section>
  );
}

export function MetricGrid({ items }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 7 }}>
      {items.map((item) => (
        <div
          key={item.label}
          style={{
            minHeight: 48,
            border: '1px solid #dbe7f5',
            borderRadius: 8,
            background: item.tone ? `${item.tone}12` : '#fbfdff',
            padding: '8px 9px',
          }}
        >
          <div style={{ color: item.tone || '#64748b', fontSize: 16, fontWeight: 950 }}>
            {item.value}
          </div>
          <div
            style={{
              color: '#475569',
              fontSize: 10,
              fontWeight: 800,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {item.label}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ActionButton({ children, disabled = false, onClick, tone = '#2563eb' }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      style={{
        minHeight: 31,
        borderRadius: 8,
        border: `1px solid ${disabled ? '#dbe7f5' : `${tone}55`}`,
        background: disabled ? '#f8fafc' : '#ffffff',
        color: disabled ? '#94a3b8' : tone,
        cursor: disabled ? 'default' : 'pointer',
        fontSize: 10.5,
        fontWeight: 900,
        lineHeight: 1.15,
        padding: '6px 8px',
      }}
    >
      {children}
    </button>
  );
}

export function ButtonGrid({ actions, columns = 2 }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap: 7,
      }}
    >
      {actions.map((action) => (
        <ActionButton
          key={action.label}
          disabled={action.disabled}
          onClick={action.onClick}
          tone={action.tone}
        >
          {action.label}
        </ActionButton>
      ))}
    </div>
  );
}

export function FieldLabel({ children }) {
  return (
    <label
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        color: '#334155',
        fontSize: 10.5,
        fontWeight: 850,
      }}
    >
      {children}
    </label>
  );
}

export function NativeSelect({ onChange, options = [], value }) {
  return (
    <select
      value={value || ''}
      onChange={(event) => onChange?.(event.target.value)}
      style={{
        width: '100%',
        height: 32,
        border: '1px solid #d6e3f1',
        borderRadius: 8,
        background: '#ffffff',
        color: '#172033',
        fontSize: 10.5,
        fontWeight: 760,
        padding: '0 8px',
        outline: 'none',
      }}
    >
      {options.map((item) => (
        <option key={item.value || item.id || item.label} value={item.value || item.id}>
          {item.label || item.name}
        </option>
      ))}
    </select>
  );
}

export function NumberInput({ onChange, step = 0.1, value }) {
  return (
    <input
      type="number"
      step={step}
      value={value ?? ''}
      onChange={(event) => onChange?.(Number(event.target.value) || 0)}
      style={{
        width: '100%',
        height: 32,
        border: '1px solid #d6e3f1',
        borderRadius: 8,
        background: '#ffffff',
        color: '#172033',
        fontSize: 10.5,
        fontWeight: 760,
        padding: '0 8px',
        outline: 'none',
        boxSizing: 'border-box',
      }}
    />
  );
}
