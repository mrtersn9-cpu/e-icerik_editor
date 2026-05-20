import { Inp, Btn } from '../../components/ui';
import { uid } from '../../utils/editorHelpers';

export default function SelectionEditor({ activity, onUpdate }) {
  const patch = (p) => onUpdate({ ...activity, ...p });
  const patchOption = (id, p) =>
    patch({ mcOptions: activity.mcOptions.map((o) => (o.id === id ? { ...o, ...p } : o)) });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#00BCD4' }}>SORU AYARLARI</div>
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
          color="#4CAF50"
          small
        >
          + Seçenek
        </Btn>
      </div>
      {(activity.mcOptions || []).map((o, i) => (
        <div
          key={o.id}
          style={{
            background: '#111125',
            border: '1px solid #252540',
            borderRadius: 8,
            padding: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: '#555' }}>Seçenek {i + 1}</span>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 11,
                color: o.isCorrect ? '#4CAF50' : '#555',
                marginLeft: 'auto',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={o.isCorrect}
                onChange={(e) => patchOption(o.id, { isCorrect: e.target.checked })}
                style={{ accentColor: '#4CAF50' }}
              />
              Doğru
            </label>
            <button
              onClick={() => patch({ mcOptions: activity.mcOptions.filter((x) => x.id !== o.id) })}
              style={{
                background: 'none',
                border: 'none',
                color: '#f44336',
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
