import { uid } from '../../utils/editorHelpers';

export default function SequenceEditor({ activity, onUpdate }) {
  const items = activity.sequenceItems || [];
  const patch = (p) => onUpdate({ ...activity, ...p });
  const add = () =>
    patch({
      sequenceItems: [
        ...items,
        { id: uid(), label: `Adım ${items.length + 1}`, order: items.length + 1 },
      ],
    });
  const remove = (id) =>
    patch({
      sequenceItems: items.filter((i) => i.id !== id).map((i, idx) => ({ ...i, order: idx + 1 })),
    });
  const move = (fromIndex, dir) => {
    const toIndex = fromIndex + dir;
    if (toIndex < 0 || toIndex >= items.length) return;
    const next = [...items];
    [next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]];
    patch({ sequenceItems: next.map((i, idx) => ({ ...i, order: idx + 1 })) });
  };
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
            color: '#7c3aed',
            textTransform: 'uppercase',
            letterSpacing: 0.4,
            marginBottom: 8,
          }}
        >
          Doğru Sıralama
        </div>
        <div style={{ fontSize: 11, color: '#475569', lineHeight: 1.7, marginBottom: 10 }}>
          Öğeleri doğru sıraya göre düzenle. Öğrenci bunları karıştırılmış olarak görecek.
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
            checked={activity.sequenceShuffle !== false}
            onChange={(e) => patch({ sequenceShuffle: e.target.checked })}
            style={{ accentColor: '#7c3aed' }}
          />{' '}
          Öğrenciye karıştırılmış göster
        </label>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {['vertical', 'horizontal'].map((d) => (
            <button
              key={d}
              onClick={() => patch({ sequenceDirection: d })}
              style={{
                minHeight: 30,
                padding: '0 10px',
                borderRadius: 10,
                border: `1px solid ${activity.sequenceDirection === d ? '#a78bfa' : '#cbd5e1'}`,
                background: activity.sequenceDirection === d ? '#ede9fe' : '#ffffff',
                color: activity.sequenceDirection === d ? '#6d28d9' : '#475569',
                fontSize: 11,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              {d === 'vertical' ? 'Dikey' : 'Yatay'}
            </button>
          ))}
        </div>
        {items.map((item, idx) => (
          <div
            key={item.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 6,
              padding: '6px 8px',
              borderRadius: 10,
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
            }}
          >
            <span
              style={{
                width: 24,
                height: 24,
                borderRadius: 999,
                background: '#ede9fe',
                color: '#7c3aed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 800,
                flexShrink: 0,
              }}
            >
              {idx + 1}
            </span>
            <input
              value={item.label}
              onChange={(e) =>
                patch({
                  sequenceItems: items.map((i) =>
                    i.id === item.id ? { ...i, label: e.target.value } : i
                  ),
                })
              }
              style={{
                flex: 1,
                height: 28,
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                fontSize: 12,
                padding: '0 8px',
              }}
            />
            <button
              onClick={() => move(idx, -1)}
              disabled={idx === 0}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: '#94a3b8',
                fontSize: 14,
              }}
            >
              ↑
            </button>
            <button
              onClick={() => move(idx, 1)}
              disabled={idx === items.length - 1}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: '#94a3b8',
                fontSize: 14,
              }}
            >
              ↓
            </button>
            <button
              onClick={() => remove(item.id)}
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
        <button
          onClick={add}
          style={{
            minHeight: 32,
            padding: '0 14px',
            borderRadius: 10,
            border: '1px solid #a78bfa',
            background: '#ffffff',
            color: '#7c3aed',
            fontSize: 11,
            fontWeight: 800,
            cursor: 'pointer',
            marginTop: 4,
          }}
        >
          + Adım Ekle
        </button>
      </div>
    </div>
  );
}
