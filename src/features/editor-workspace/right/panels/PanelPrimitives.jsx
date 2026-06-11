import { useEffect, useRef, useState } from 'react';

import { EDITOR_THEME } from '../../../../theme';
import { workspaceChrome } from '../../chromeTokens';

export const inspectorChrome = workspaceChrome.inspector;

const controlBase = {
  width: '100%',
  height: workspaceChrome.control.height,
  border: `1px solid ${inspectorChrome.border}`,
  borderRadius: workspaceChrome.radius.sm,
  background: inspectorChrome.panel,
  color: inspectorChrome.text,
  fontSize: workspaceChrome.control.fontSize,
  fontWeight: EDITOR_THEME.weightSemibold,
  padding: '0 8px',
  outline: 'none',
  boxSizing: 'border-box',
};

function useDeferredColor(value = '#ffffff', onCommit, delay = 120) {
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

export function PanelShell({ children, subtitle, title, action }) {
  return (
    <div
      style={{
        height: '100%',
        minHeight: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
        background: inspectorChrome.panel,
        padding: EDITOR_THEME.spaceSm,
        color: inspectorChrome.text,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: EDITOR_THEME.spaceSm,
          marginBottom: EDITOR_THEME.spaceSm,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              color: inspectorChrome.blueDark,
              fontSize: EDITOR_THEME.typeBody,
              fontWeight: EDITOR_THEME.weightBold,
              letterSpacing: 0.15,
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {title}
          </div>
          {subtitle ? (
            <div
              style={{
                color: inspectorChrome.muted,
                fontSize: EDITOR_THEME.typeCaption,
                fontWeight: EDITOR_THEME.weightNormal,
                marginTop: 3,
              }}
            >
              {subtitle}
            </div>
          ) : null}
        </div>
        {action}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: EDITOR_THEME.spaceSm }}>
        {children}
      </div>
    </div>
  );
}

export function PanelTabs({ active, onChange, tabs }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))`,
        borderBottom: `1px solid ${inspectorChrome.borderSoft}`,
        margin: '-2px 0 2px',
      }}
    >
      {tabs.map((tab) => {
        const selected = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange?.(tab.id)}
            style={{
              height: 30,
              border: 'none',
              borderBottom: `2px solid ${selected ? inspectorChrome.blue : 'transparent'}`,
              background: 'transparent',
              color: selected ? inspectorChrome.blue : inspectorChrome.text,
              cursor: 'pointer',
              fontSize: EDITOR_THEME.typeCaption,
              fontWeight: selected ? EDITOR_THEME.weightBold : EDITOR_THEME.weightSemibold,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              padding: '0 4px',
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export function PanelCard({ children, title, action, defaultOpen = true, collapsible = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyVisible = !collapsible || open;

  return (
    <section
      style={{
        border: `1px solid ${inspectorChrome.border}`,
        borderRadius: EDITOR_THEME.radiusLg,
        background: inspectorChrome.panel,
        overflow: 'hidden',
      }}
    >
      {title ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: EDITOR_THEME.spaceSm,
            minHeight: 28,
            padding: '5px 8px',
            borderBottom: bodyVisible ? `1px solid ${inspectorChrome.borderSoft}` : 'none',
            background: inspectorChrome.panelRaised,
          }}
        >
          <button
            type="button"
            onClick={collapsible ? () => setOpen((value) => !value) : undefined}
            style={{
              minWidth: 0,
              border: 'none',
              background: 'transparent',
              color: inspectorChrome.blue,
              cursor: collapsible ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'center',
              gap: EDITOR_THEME.spaceSm,
              padding: 0,
              textAlign: 'left',
              fontSize: EDITOR_THEME.typeCaption,
              fontWeight: EDITOR_THEME.weightBold,
              letterSpacing: 0.2,
              textTransform: 'uppercase',
            }}
          >
            {collapsible ? (
              <span style={{ color: inspectorChrome.softText }}>{open ? '⌄' : '›'}</span>
            ) : null}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {title}
            </span>
          </button>
          {action}
        </div>
      ) : null}
      {bodyVisible ? <div style={{ padding: EDITOR_THEME.spaceSm }}>{children}</div> : null}
    </section>
  );
}

export const InspectorSection = PanelCard;

export function MetricGrid({ items, columns = 2 }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap: EDITOR_THEME.spaceSm,
      }}
    >
      {items.map((item) => (
        <div
          key={item.label}
          style={{
            minHeight: 38,
            border: `1px solid ${item.tone ? `${item.tone}33` : inspectorChrome.border}`,
            borderRadius: EDITOR_THEME.radiusMd,
            background: item.tone ? `${item.tone}0f` : inspectorChrome.panelSoft,
            padding: '5px 6px',
          }}
        >
          <div
            style={{
              color: item.tone || inspectorChrome.muted,
              fontSize: EDITOR_THEME.typeTitle,
              fontWeight: EDITOR_THEME.weightBold,
            }}
          >
            {item.value}
          </div>
          <div
            style={{
              color: inspectorChrome.muted,
              fontSize: EDITOR_THEME.typeCaption,
              fontWeight: EDITOR_THEME.weightSemibold,
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

export function MiniStat({ label, tone = inspectorChrome.blue, value }) {
  return (
    <div
      style={{
        minHeight: 38,
        border: `1px solid ${tone}30`,
        borderRadius: EDITOR_THEME.radiusMd,
        background: `${tone}0f`,
        display: 'grid',
        gridTemplateColumns: 'auto minmax(0,1fr)',
        alignItems: 'center',
        gap: EDITOR_THEME.spaceSm,
        padding: '5px 7px',
      }}
    >
      <span style={{ color: tone, fontSize: EDITOR_THEME.typeTitle, fontWeight: EDITOR_THEME.weightBold }}>
        {value}
      </span>
      <span
        style={{
          color: inspectorChrome.muted,
          fontSize: EDITOR_THEME.typeCaption,
          fontWeight: EDITOR_THEME.weightSemibold,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
    </div>
  );
}

export function ActionButton({ children, disabled = false, onClick, tone = inspectorChrome.blue, title }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      title={title}
      style={{
        minHeight: 29,
        borderRadius: EDITOR_THEME.radiusMd,
        border: `1px solid ${disabled ? inspectorChrome.border : `${tone}55`}`,
        background: disabled ? EDITOR_THEME.lightBg : inspectorChrome.panel,
        color: disabled ? inspectorChrome.softText : tone,
        cursor: disabled ? 'default' : 'pointer',
        fontSize: EDITOR_THEME.typeCaption,
        fontWeight: EDITOR_THEME.weightBold,
        lineHeight: 1.15,
        padding: '5px 7px',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      {children}
    </button>
  );
}

export function ActionTile({
  children,
  description,
  disabled = false,
  icon,
  onClick,
  tone = inspectorChrome.blue,
  title,
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      title={title || (typeof children === 'string' ? children : undefined)}
      style={{
        minHeight: 48,
        borderRadius: EDITOR_THEME.radiusMd,
        border: `1px solid ${disabled ? inspectorChrome.border : `${tone}35`}`,
        background: disabled ? EDITOR_THEME.lightBg : inspectorChrome.panel,
        color: disabled ? inspectorChrome.softText : inspectorChrome.text,
        cursor: disabled ? 'default' : 'pointer',
        display: 'grid',
        gridTemplateColumns: icon ? '24px minmax(0,1fr)' : 'minmax(0,1fr)',
        gap: EDITOR_THEME.spaceSm,
        alignItems: 'center',
        padding: '7px 8px',
        textAlign: 'left',
      }}
    >
      {icon ? (
        <span
          style={{
            width: 24,
            height: 24,
            borderRadius: EDITOR_THEME.radiusMd,
            background: `${tone}12`,
            color: tone,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: EDITOR_THEME.typeBody,
            fontWeight: EDITOR_THEME.weightBold,
          }}
        >
          {icon}
        </span>
      ) : null}
      <span style={{ minWidth: 0 }}>
        <span
          style={{
            display: 'block',
            color: disabled ? inspectorChrome.softText : tone,
            fontSize: EDITOR_THEME.typeCaption,
            fontWeight: EDITOR_THEME.weightBold,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {children}
        </span>
        {description ? (
          <span
            style={{
              display: 'block',
              color: inspectorChrome.muted,
              fontSize: EDITOR_THEME.typeCaption,
              fontWeight: EDITOR_THEME.weightNormal,
              lineHeight: 1.25,
              marginTop: 2,
            }}
          >
            {description}
          </span>
        ) : null}
      </span>
    </button>
  );
}

export function IconActionButton({ children, disabled = false, onClick, title, active = false }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      title={title}
      style={{
        width: 24,
        height: 24,
        borderRadius: 6,
        border: `1px solid ${active ? inspectorChrome.activeBorder : inspectorChrome.border}`,
        background: active ? inspectorChrome.active : inspectorChrome.panel,
        color: disabled ? inspectorChrome.softText : active ? inspectorChrome.blue : inspectorChrome.muted,
        cursor: disabled ? 'default' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: EDITOR_THEME.typeControl,
        fontWeight: EDITOR_THEME.weightBold,
        lineHeight: 1,
      }}
    >
      {children}
    </button>
  );
}

export const IconToggle = IconActionButton;

export function ButtonGrid({ actions, columns = 2 }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap: EDITOR_THEME.spaceSm,
      }}
    >
      {actions.map((action) => (
        <ActionButton
          key={action.label}
          disabled={action.disabled}
          onClick={action.onClick}
          tone={action.tone}
          title={action.title}
        >
          {action.label}
        </ActionButton>
      ))}
    </div>
  );
}

export function TileGrid({ actions, columns = 2 }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap: EDITOR_THEME.spaceSm,
      }}
    >
      {actions.map((action) => (
        <ActionTile
          key={action.label}
          disabled={action.disabled}
          onClick={action.onClick}
          tone={action.tone}
          icon={action.icon}
          description={action.description}
          title={action.title}
        >
          {action.label}
        </ActionTile>
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
        gap: EDITOR_THEME.spaceXs,
        color: inspectorChrome.text,
        fontSize: EDITOR_THEME.typeCaption,
        fontWeight: EDITOR_THEME.weightSemibold,
      }}
    >
      {children}
    </label>
  );
}

export function NativeSelect({ disabled = false, onChange, options = [], value }) {
  return (
    <select
      value={value || ''}
      disabled={disabled}
      onChange={(event) => onChange?.(event.target.value)}
      style={{
        ...controlBase,
        background: disabled ? EDITOR_THEME.lightBg : controlBase.background,
        color: disabled ? inspectorChrome.softText : controlBase.color,
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      {options.map((item) => (
        <option key={item.value ?? item.id ?? item.label} value={item.value ?? item.id}>
          {item.label || item.name}
        </option>
      ))}
    </select>
  );
}

export function ToggleRow({ checked, disabled = false, hint, label, onChange }) {
  return (
    <label
      style={{
        minHeight: 29,
        display: 'grid',
        gridTemplateColumns: 'minmax(0,1fr) auto',
        alignItems: 'center',
        gap: EDITOR_THEME.spaceSm,
        color: disabled ? inspectorChrome.softText : inspectorChrome.text,
        fontSize: EDITOR_THEME.typeCaption,
        fontWeight: EDITOR_THEME.weightSemibold,
      }}
    >
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </span>
        {hint ? (
          <span
            style={{
              display: 'block',
              color: inspectorChrome.muted,
              fontSize: EDITOR_THEME.typeCaption,
              fontWeight: EDITOR_THEME.weightNormal,
              marginTop: 1,
            }}
          >
            {hint}
          </span>
        ) : null}
      </span>
      <input
        type="checkbox"
        checked={!!checked}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.checked)}
        style={{ width: 16, height: 16, accentColor: inspectorChrome.blue }}
      />
    </label>
  );
}

export function NumberInput({ disabled = false, onChange, step = 0.1, value, min, max, title }) {
  // Odaktayken yerel taslak tutarız: kullanıcı alanı tamamen boşaltıp kendi
  // sayısını serbestçe yazabilsin. Aksi halde her tuşta değer dışarıdan
  // yeniden dayatıldığı için ilk haneler silinemiyordu.
  const [draft, setDraft] = useState(value ?? '');
  const [focused, setFocused] = useState(false);

  const clampToBounds = (num) => {
    let next = num;
    if (Number.isFinite(min)) next = Math.max(min, next);
    if (Number.isFinite(max)) next = Math.min(max, next);
    return next;
  };

  useEffect(() => {
    if (!focused) setDraft(value ?? '');
  }, [value, focused]);

  const handleChange = (event) => {
    const raw = event.target.value;
    setDraft(raw);
    // Ara durumlar (boş, "-", ".") commit edilmez; kullanıcı yazmaya devam edebilir.
    if (raw === '' || raw === '-' || raw === '.' || raw === '-.') return;
    const numeric = Number(raw);
    if (Number.isFinite(numeric)) onChange?.(clampToBounds(numeric));
  };

  const handleBlur = () => {
    setFocused(false);
    const numeric = Number(draft);
    if (draft === '' || !Number.isFinite(numeric)) {
      setDraft(value ?? '');
    } else {
      // Sınır dışı değeri blur'da kelepçele (min/max attribute'u elle yazımı engellemiyor).
      const clamped = clampToBounds(numeric);
      if (clamped !== numeric) setDraft(String(clamped));
      onChange?.(clamped);
    }
  };

  return (
    <input
      type="number"
      step={step}
      min={min}
      max={max}
      title={title}
      value={focused ? draft : value ?? ''}
      disabled={disabled}
      onFocus={() => setFocused(true)}
      onChange={handleChange}
      onBlur={handleBlur}
      style={{
        ...controlBase,
        background: disabled ? EDITOR_THEME.lightBg : controlBase.background,
        color: disabled ? inspectorChrome.softText : controlBase.color,
      }}
    />
  );
}

export function TextInput({ disabled = false, onChange, placeholder = '', value }) {
  return (
    <input
      type="text"
      value={value ?? ''}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(event) => onChange?.(event.target.value)}
      style={{
        ...controlBase,
        background: disabled ? EDITOR_THEME.lightBg : controlBase.background,
        color: disabled ? inspectorChrome.softText : controlBase.color,
      }}
    />
  );
}

export function TextAreaInput({ disabled = false, onChange, placeholder = '', rows = 3, value }) {
  return (
    <textarea
      value={value ?? ''}
      placeholder={placeholder}
      rows={rows}
      disabled={disabled}
      onChange={(event) => onChange?.(event.target.value)}
      style={{
        ...controlBase,
        background: disabled ? EDITOR_THEME.lightBg : controlBase.background,
        color: disabled ? inspectorChrome.softText : controlBase.color,
        height: 'auto',
        minHeight: rows * 24,
        padding: '7px 8px',
        resize: 'vertical',
        lineHeight: 1.35,
      }}
    />
  );
}

export function ColorInput({ ariaLabel, onChange, value = '#ffffff' }) {
  const { draft, flush, scheduleCommit } = useDeferredColor(value, onChange);

  return (
    <input
      type="color"
      value={draft || '#ffffff'}
      aria-label={ariaLabel}
      title={ariaLabel}
      onInput={(event) => scheduleCommit(event.target.value)}
      onChange={(event) => scheduleCommit(event.target.value)}
      onBlur={flush}
      onPointerUp={flush}
      style={{
        ...controlBase,
        padding: 2,
        cursor: 'pointer',
      }}
    />
  );
}

export function CompactList({ empty, items = [], renderItem }) {
  if (!items.length) return <EmptyHint>{empty || 'Kayıt yok.'}</EmptyHint>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: EDITOR_THEME.spaceXs }}>
      {items.map(renderItem)}
    </div>
  );
}

export function PreviewTile({ active = false, children, label, onClick, tone = inspectorChrome.blue }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        minHeight: 54,
        borderRadius: EDITOR_THEME.radiusMd,
        border: `1px solid ${active ? tone : inspectorChrome.border}`,
        background: active ? `${tone}10` : inspectorChrome.panel,
        cursor: 'pointer',
        color: inspectorChrome.text,
        display: 'grid',
        gridTemplateRows: '1fr auto',
        gap: EDITOR_THEME.spaceXs,
        padding: 6,
        textAlign: 'left',
      }}
    >
      <span style={{ minHeight: 22 }}>{children}</span>
      <span
        style={{
          color: active ? tone : inspectorChrome.muted,
          fontSize: EDITOR_THEME.typeCaption,
          fontWeight: EDITOR_THEME.weightSemibold,
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

export function InspectorRow({ action, label, tone, value }) {
  return (
    <div
      style={{
        minHeight: 27,
        display: 'grid',
        gridTemplateColumns: action ? 'minmax(0,1fr) auto' : 'minmax(0,1fr)',
        alignItems: 'center',
        gap: EDITOR_THEME.spaceSm,
        borderBottom: `1px solid ${inspectorChrome.borderSoft}`,
        padding: '4px 0',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            color: inspectorChrome.muted,
            fontSize: EDITOR_THEME.typeCaption,
            fontWeight: EDITOR_THEME.weightSemibold,
            textTransform: 'uppercase',
          }}
        >
          {label}
        </div>
        <div
          title={typeof value === 'string' ? value : undefined}
          style={{
            color: tone || inspectorChrome.text,
            fontSize: EDITOR_THEME.typeCaption,
            fontWeight: EDITOR_THEME.weightSemibold,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            marginTop: 1,
          }}
        >
          {value}
        </div>
      </div>
      {action}
    </div>
  );
}

export function StatusPill({ children, tone = inspectorChrome.blue }) {
  return (
    <span
      style={{
        minWidth: 18,
        height: 18,
        padding: '0 6px',
        borderRadius: 999,
        border: `1px solid ${tone}33`,
        background: `${tone}12`,
        color: tone,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: EDITOR_THEME.typeCaption,
        fontWeight: EDITOR_THEME.weightBold,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

export function EmptyHint({ children }) {
  return (
    <div
      style={{
        minHeight: 38,
        border: `1px dashed ${inspectorChrome.border}`,
        borderRadius: EDITOR_THEME.radiusMd,
        background: inspectorChrome.panelRaised,
        color: inspectorChrome.muted,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: EDITOR_THEME.spaceSm,
        fontSize: EDITOR_THEME.typeCaption,
        fontWeight: EDITOR_THEME.weightSemibold,
        lineHeight: 1.35,
      }}
    >
      {children}
    </div>
  );
}
