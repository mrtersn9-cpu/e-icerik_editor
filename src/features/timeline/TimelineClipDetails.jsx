import { timelineTokens as t } from './timelineTokens';

function Field({ children, label }) {
  return (
    <label
      style={{
        minWidth: 0,
        display: 'grid',
        gap: 4,
        color: t.muted,
        fontSize: 9.5,
        fontWeight: 900,
        textTransform: 'uppercase',
      }}
    >
      {label}
      {children}
    </label>
  );
}

const inputStyle = {
  height: 26,
  border: `1px solid ${t.border}`,
  borderRadius: 6,
  background: '#ffffff',
  color: t.text,
  fontSize: 10.5,
  fontWeight: 780,
  padding: '0 7px',
  boxSizing: 'border-box',
  width: '100%',
  outline: 'none',
};

function Select({ disabled = false, onChange, options, value }) {
  return (
    <select
      disabled={disabled}
      value={value || ''}
      onChange={(event) => onChange?.(event.target.value)}
      style={{
        ...inputStyle,
        color: disabled ? '#b6c2d2' : inputStyle.color,
        background: disabled ? '#f8fafc' : inputStyle.background,
      }}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function NumberInput({ disabled = false, onChange, step = 0.1, value }) {
  return (
    <input
      type="number"
      disabled={disabled}
      step={step}
      value={value ?? ''}
      onChange={(event) => onChange?.(Number(event.target.value) || 0)}
      style={{
        ...inputStyle,
        color: disabled ? '#b6c2d2' : inputStyle.color,
        background: disabled ? '#f8fafc' : inputStyle.background,
      }}
    />
  );
}

function SmallButton({ children, disabled = false, onClick, tone = t.blue }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      style={{
        height: 28,
        border: `1px solid ${disabled ? t.border : `${tone}55`}`,
        borderRadius: 6,
        background: disabled ? '#f8fafc' : '#ffffff',
        color: disabled ? '#b6c2d2' : tone,
        cursor: disabled ? 'default' : 'pointer',
        fontSize: 10.5,
        fontWeight: 900,
      }}
    >
      {children}
    </button>
  );
}

export default function TimelineClipDetails({ controller }) {
  const item = controller.activeTimelineItem;
  const object = controller.activeObject;
  if (!item || !controller.detailsOpen) return null;

  const disabled = !controller.editableActive;
  const patchClip = (patch) => controller.patchTimelineItem(item.id, patch);

  return (
    <div
      style={{
        borderTop: `1px solid ${t.border}`,
        borderBottom: `1px solid ${t.border}`,
        background: '#fbfdff',
        padding: 8,
        display: 'grid',
        gridTemplateColumns: 'minmax(180px, .8fr) minmax(420px, 2fr) minmax(190px, .9fr)',
        gap: 10,
        alignItems: 'start',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          border: `1px solid ${t.border}`,
          borderRadius: 8,
          background: '#ffffff',
          padding: 8,
          minWidth: 0,
        }}
      >
        <div style={{ color: t.blueDark, fontSize: 10.5, fontWeight: 950, textTransform: 'uppercase' }}>
          Seçili Klip
        </div>
        <div
          style={{
            color: t.text,
            fontSize: 12,
            fontWeight: 900,
            marginTop: 6,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={object?.label || item.name}
        >
          {object?.label || item.name}
        </div>
        <div style={{ color: t.muted, fontSize: 10.5, fontWeight: 720, marginTop: 4 }}>
          {object?.type || 'Nesne'} · {object?.locked ? 'kilitli' : 'düzenlenebilir'}
        </div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 8 }}>
          <span style={{ color: t.blue, fontSize: 10, fontWeight: 900 }}>{(item.start || 0).toFixed(1)}s</span>
          <span style={{ color: t.success, fontSize: 10, fontWeight: 900 }}>{(item.duration || 0).toFixed(1)}s</span>
          <span style={{ color: t.muted, fontSize: 10, fontWeight: 900 }}>{(item.keyframes || []).length} kf</span>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 7 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr .65fr .65fr .8fr', gap: 7 }}>
          <Field label="Ad">
            <input
              disabled={!object}
              value={object?.label || item.name || ''}
              onChange={(event) => controller.patchObject(object?.id, { label: event.target.value, name: event.target.value })}
              style={inputStyle}
            />
          </Field>
          <Field label="Başlangıç">
            <NumberInput
              disabled={disabled}
              value={item.start || 0}
              onChange={(value) => patchClip({ start: Math.max(0, value || 0) })}
            />
          </Field>
          <Field label="Süre">
            <NumberInput
              disabled={disabled}
              value={item.duration || 0.2}
              onChange={(value) => patchClip({ duration: Math.max(0.2, value || 0.2) })}
            />
          </Field>
          <Field label="Başlangıç">
            <Select
              disabled={disabled}
              value={item.startMode || 'with-previous'}
              onChange={(value) => patchClip({ startMode: value })}
              options={[
                { value: 'with-previous', label: 'Önceki ile' },
                { value: 'after-previous', label: 'Öncekinden sonra' },
                { value: 'on-click', label: 'Tıklayınca' },
              ]}
            />
          </Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 7 }}>
          <Field label="Giriş">
            <Select disabled={disabled} value={item.entryEffect || 'fade'} onChange={(value) => patchClip({ entryEffect: value })} options={controller.effects} />
          </Field>
          <Field label="Çıkış">
            <Select disabled={disabled} value={item.exitEffect || 'none'} onChange={(value) => patchClip({ exitEffect: value })} options={controller.effects} />
          </Field>
          <Field label="Yön">
            <Select disabled={disabled} value={item.direction || 'left'} onChange={(value) => patchClip({ direction: value })} options={controller.directions} />
          </Field>
          <Field label="Easing">
            <Select disabled={disabled} value={item.easing || 'easeOut'} onChange={(value) => patchClip({ easing: value })} options={controller.easings} />
          </Field>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <SmallButton disabled={disabled} onClick={() => controller.alignActiveClip('start')}>
          Başı Hizala
        </SmallButton>
        <SmallButton disabled={disabled} onClick={() => controller.alignActiveClip('end')}>
          Sonu Hizala
        </SmallButton>
        <SmallButton onClick={() => controller.alignActiveClip('playhead-to-start')} tone="#475569">
          Playhead Baş
        </SmallButton>
        <SmallButton onClick={() => controller.alignActiveClip('playhead-to-end')} tone="#475569">
          Playhead Son
        </SmallButton>
        <SmallButton disabled={disabled} onClick={() => controller.moveActiveTrack(-1)} tone="#7c3aed">
          Yukarı
        </SmallButton>
        <SmallButton disabled={disabled} onClick={() => controller.moveActiveTrack(1)} tone="#7c3aed">
          Aşağı
        </SmallButton>
      </div>
    </div>
  );
}
