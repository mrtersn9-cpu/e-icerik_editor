import { Inp } from '../../components/ui';

import { editorCardStyle, editorTitleStyle } from './editorStyles';

export default function NumericEditor({ activity, onUpdate }) {
  const patch = (p) => onUpdate({ ...activity, ...p });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={editorCardStyle}>
        <div style={editorTitleStyle}>Sayısal Giriş Ayarları</div>
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
          {Number.isFinite(activity.numericMin) &&
            Number.isFinite(activity.numericMax) &&
            activity.numericMin > activity.numericMax && (
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--eic-tone-red-base)' }}>
                Min değeri Max değerinden büyük olamaz.
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
