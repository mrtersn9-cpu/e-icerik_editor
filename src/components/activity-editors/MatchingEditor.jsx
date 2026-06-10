import { uid } from '../../utils/editorHelpers';

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
            color: '#0891b2',
            textTransform: 'uppercase',
            letterSpacing: 0.4,
            marginBottom: 8,
          }}
        >
          Eşleştirme Çiftleri
        </div>
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
            style={{ accentColor: '#0891b2' }}
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
                border: `1px solid ${String(pair.left || '').trim() ? '#e2e8f0' : '#fca5a5'}`,
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
                border: `1px solid ${String(pair.right || '').trim() ? '#e2e8f0' : '#fca5a5'}`,
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
                color: '#ef4444',
                fontSize: 14,
              }}
            >
              ×
            </button>
          </div>
        ))}
        {pairs.some((p) => !String(p.left || '').trim() || !String(p.right || '').trim()) && (
          <div style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', marginTop: 2, marginBottom: 6 }}>
            Boş sol/sağ öğe içeren çiftler öğrenciye gösterilmez; lütfen doldurun veya silin.
          </div>
        )}
        <button
          onClick={add}
          style={{
            minHeight: 32,
            padding: '0 14px',
            borderRadius: 10,
            border: '1px solid #22d3ee',
            background: '#ffffff',
            color: '#0891b2',
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
