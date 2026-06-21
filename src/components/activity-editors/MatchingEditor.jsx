import { uid } from '../../utils/editorHelpers';

import { editorCardStyle, editorTitleStyle } from './editorStyles';

export default function MatchingEditor({ activity, onUpdate }) {
  const pairs = activity.matchingPairs || [];
  const patch = (p) => onUpdate({ ...activity, ...p });
  const add = () =>
    patch({
      matchingPairs: [
        ...pairs,
        { id: uid(), left: `Sol ${pairs.length + 1}`, right: `Sağ ${pairs.length + 1}` },
      ],
    });
  const remove = (id) => patch({ matchingPairs: pairs.filter((p) => p.id !== id) });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={editorCardStyle}>
        <div style={editorTitleStyle}>Eşleştirme Çiftleri</div>
        <div style={{ fontSize: 11, color: '#475569', lineHeight: 1.7, marginBottom: 10 }}>
          Sol taraftaki öğeleri sağ taraftakilerle eşleştirin. Sağ taraf öğrenciye karıştırılmış
          gösterilecek.
        </div>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            color: '#475569',
            cursor: 'pointer',
            marginBottom: 10,
          }}
        >
          <input
            type="checkbox"
            checked={activity.matchingShuffle !== false}
            onChange={(e) => patch({ matchingShuffle: e.target.checked })}
            style={{ accentColor: 'var(--eic-light-accent)' }}
          />{' '}
          Sağ tarafı karıştır
        </label>
        {pairs.map((pair, idx) => (
          <div
            key={pair.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 24px 1fr 30px',
              alignItems: 'center',
              gap: 6,
              marginBottom: 6,
              padding: '6px 8px',
              borderRadius: 10,
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
            }}
          >
            <input
              value={pair.left}
              onChange={(e) =>
                patch({
                  matchingPairs: pairs.map((p) =>
                    p.id === pair.id ? { ...p, left: e.target.value } : p
                  ),
                })
              }
              style={{
                height: 28,
                border: `1px solid ${String(pair.left || '').trim() ? '#e2e8f0' : 'var(--eic-tone-red-border)'}`,
                borderRadius: 8,
                fontSize: 12,
                padding: '0 8px',
              }}
              placeholder="Sol öğe"
            />
            <span style={{ textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>⇄</span>
            <input
              value={pair.right}
              onChange={(e) =>
                patch({
                  matchingPairs: pairs.map((p) =>
                    p.id === pair.id ? { ...p, right: e.target.value } : p
                  ),
                })
              }
              style={{
                height: 28,
                border: `1px solid ${String(pair.right || '').trim() ? '#e2e8f0' : 'var(--eic-tone-red-border)'}`,
                borderRadius: 8,
                fontSize: 12,
                padding: '0 8px',
              }}
              placeholder="Sağ öğe"
            />
            <button
              onClick={() => remove(pair.id)}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: 'var(--eic-tone-red-base)',
                fontSize: 14,
              }}
            >
              ×
            </button>
          </div>
        ))}
        {pairs.some((p) => !String(p.left || '').trim() || !String(p.right || '').trim()) && (
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--eic-tone-red-base)', marginTop: 2, marginBottom: 6 }}>
            Boş sol/sağ öğe içeren çiftler öğrenciye gösterilmez; lütfen doldurun veya silin.
          </div>
        )}
        <button
          onClick={add}
          style={{
            minHeight: 32,
            padding: '0 14px',
            borderRadius: 10,
            border: '1px solid var(--eic-light-accent-border)',
            background: '#ffffff',
            color: 'var(--eic-light-accent)',
            fontSize: 11,
            fontWeight: 800,
            cursor: 'pointer',
            marginTop: 4,
          }}
        >
          + Çift Ekle
        </button>
      </div>
    </div>
  );
}
