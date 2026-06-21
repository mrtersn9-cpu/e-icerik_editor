import { Inp, Btn } from '../../components/ui';
import { uid } from '../../utils/editorHelpers';

import { editorTitleStyle, EDITOR_ACCENT } from './editorStyles';

export default function SelectionEditor({ activity, onUpdate }) {
  const patch = (p) => onUpdate({ ...activity, ...p });
  const patchOption = (id, p) =>
    patch({ mcOptions: activity.mcOptions.map((o) => (o.id === id ? { ...o, ...p } : o)) });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={editorTitleStyle}>Soru Ayarları</div>
      <Inp
        label="Soru Metni"
        value={activity.mcQuestion || ''}
        onChange={(e) => patch({ mcQuestion: e.target.value })}
        type="textarea"
      />
      <div
        style={{
          padding: '10px 12px',
          borderRadius: 10,
          border: '1px solid #dbeafe',
          background: 'linear-gradient(180deg,#f8fbff,#ffffff)',
          color: '#475569',
          fontSize: 11,
          lineHeight: 1.7,
        }}
      >
        Tekli/çoklu seçim ve işaret görünümü artık sağdaki <strong>Cevap</strong> sekmesinden
        yönetiliyor.
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <Btn
          onClick={() =>
            patch({
              mcOptions: [
                ...(activity.mcOptions || []),
                {
                  id: uid(),
                  label: `Seçenek ${(activity.mcOptions?.length || 0) + 1}`,
                  isCorrect: false,
                },
              ],
            })
          }
          color="var(--eic-tone-green-base)"
          small
        >
          + Seçenek
        </Btn>
      </div>
      {(activity.mcOptions || []).map((o, i) => (
        <div
          key={o.id}
          style={{
            background: 'var(--eic-light-panel)',
            border: '1px solid var(--eic-light-border-soft)',
            borderRadius: 8,
            padding: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--eic-light-muted)' }}>Seçenek {i + 1}</span>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 11,
                fontWeight: 700,
                color: o.isCorrect ? 'var(--eic-tone-green-text)' : 'var(--eic-light-muted)',
                marginLeft: 'auto',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={o.isCorrect}
                onChange={(e) => patchOption(o.id, { isCorrect: e.target.checked })}
                style={{ accentColor: EDITOR_ACCENT }}
              />
              Doğru
            </label>
            <button
              onClick={() => patch({ mcOptions: activity.mcOptions.filter((x) => x.id !== o.id) })}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--eic-tone-red-base)',
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              ✕
            </button>
          </div>
          <Inp
            value={o.label || ''}
            onChange={(e) => patchOption(o.id, { label: e.target.value })}
            placeholder="Seçenek metni..."
          />
        </div>
      ))}
    </div>
  );
}
