import { Inp } from '../../components/ui';

export default function NumericEditor({ activity, onUpdate }) {
  const patch = (p) => onUpdate({ ...activity, ...p });
  const card = {
    background: '#ffffff',
    border: '1px solid #dbe7f5',
    borderRadius: 14,
    padding: 14,
    boxShadow: '0 10px 22px rgba(15,23,42,.05)',
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={card}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: '#d97706',
            textTransform: 'uppercase',
            letterSpacing: 0.4,
            marginBottom: 8,
          }}
        >
          Sayısal Giriş Ayarları
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Inp
            label="Soru Metni"
            value={activity.numericPrompt || ''}
            onChange={(e) => patch({ numericPrompt: e.target.value })}
            placeholder="Sayısal cevabınızı giriniz..."
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <Inp
              label="Doğru Değer"
              type="number"
              value={activity.numericCorrectValue ?? 0}
              onChange={(e) => patch({ numericCorrectValue: +e.target.value || 0 })}
            />
            <Inp
              label="Tolerans (±)"
              type="number"
              value={activity.numericTolerance ?? 0}
              onChange={(e) => patch({ numericTolerance: Math.max(0, +e.target.value || 0) })}
            />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <Inp
              label="Min"
              type="number"
              value={activity.numericMin ?? ''}
              onChange={(e) =>
                patch({ numericMin: e.target.value === '' ? null : +e.target.value })
              }
              placeholder="Opsiyonel"
            />
            <Inp
              label="Max"
              type="number"
              value={activity.numericMax ?? ''}
              onChange={(e) =>
                patch({ numericMax: e.target.value === '' ? null : +e.target.value })
              }
              placeholder="Opsiyonel"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
