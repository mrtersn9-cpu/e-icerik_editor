import { uid } from '../../../utils/editorHelpers';

import SecmeCevapPanel from './SecmeCevapPanel';
import SurukleBirakCevapPanel from './SurukleBirakCevapPanel';

const MIXED_TYPE_LABELS = {
  selection: 'Seçim',
  'drag-drop': 'Sürükle-Bırak',
  'text-entry': 'Metin Girişi',
  numeric: 'Sayısal',
  'fill-blank': 'Boşluk Doldurma',
};

function MixedItemsEditor({ activity, onUpdate }) {
  const patch = (p) => onUpdate({ ...activity, ...p });
  const items = activity.mixedItems || [];

  const addItem = (type = 'selection') => {
    const base = {
      id: uid(),
      type,
      question: '',
    };
    if (type === 'selection') {
      base.options = [
        { id: uid(), label: 'Seçenek A', isCorrect: true },
        { id: uid(), label: 'Seçenek B', isCorrect: false },
      ];
    } else if (type === 'drag-drop') {
      base.pairs = [
        { id: uid(), left: 'Sol 1', right: 'Sağ 1' },
        { id: uid(), left: 'Sol 2', right: 'Sağ 2' },
      ];
    } else if (type === 'text-entry') {
      base.acceptedAnswers = [''];
    } else if (type === 'numeric') {
      base.acceptedAnswers = ['0'];
    } else if (type === 'fill-blank') {
      base.sentence = 'Cümledeki ___ boşluğu doldurun.';
    }
    patch({ mixedItems: [...items, base] });
  };

  const updateItem = (id, field, value) => {
    patch({
      mixedItems: items.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    });
  };

  const removeItem = (id) => {
    patch({ mixedItems: items.filter((item) => item.id !== id) });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: '#334155' }}>
        Karma Öğeler ({items.length})
      </div>
      {items.map((item, idx) => (
        <div
          key={item.id}
          style={{
            border: '1px solid #e2e8f0',
            borderRadius: 10,
            padding: 12,
            background: '#ffffff',
          }}
        >
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#64748b' }}>#{idx + 1}</span>
            <select
              value={item.type}
              onChange={(e) => {
                const next = items.map((it) =>
                  it.id === item.id ? { id: it.id, type: e.target.value, question: it.question || '' } : it
                );
                patch({ mixedItems: next });
              }}
              style={{ height: 28, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12, padding: '0 8px' }}
            >
              {Object.entries(MIXED_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <button
              onClick={() => removeItem(item.id)}
              style={{ marginLeft: 'auto', border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: 14 }}
            >
              ×
            </button>
          </div>
          <input
            value={item.question || ''}
            onChange={(e) => updateItem(item.id, 'question', e.target.value)}
            placeholder="Soru metni..."
            style={{
              width: '100%',
              height: 32,
              borderRadius: 6,
              border: '1px solid #e2e8f0',
              fontSize: 12,
              padding: '0 8px',
              marginBottom: 6,
            }}
          />
          {item.type === 'selection' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {(item.options || []).map((opt) => (
                <div key={opt.id} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={!!opt.isCorrect}
                    onChange={(e) => {
                      const nextOpts = (item.options || []).map((o) =>
                        o.id === opt.id ? { ...o, isCorrect: e.target.checked } : o
                      );
                      updateItem(item.id, 'options', nextOpts);
                    }}
                    style={{ accentColor: '#16a34a' }}
                  />
                  <input
                    value={opt.label}
                    onChange={(e) => {
                      const nextOpts = (item.options || []).map((o) =>
                        o.id === opt.id ? { ...o, label: e.target.value } : o
                      );
                      updateItem(item.id, 'options', nextOpts);
                    }}
                    style={{ flex: 1, height: 26, borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12, padding: '0 6px' }}
                  />
                </div>
              ))}
            </div>
          )}
          {item.type === 'drag-drop' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {(item.pairs || []).map((pair) => (
                <div key={pair.id} style={{ display: 'flex', gap: 6 }}>
                  <input
                    value={pair.left}
                    onChange={(e) => {
                      const nextPairs = (item.pairs || []).map((p) =>
                        p.id === pair.id ? { ...p, left: e.target.value } : p
                      );
                      updateItem(item.id, 'pairs', nextPairs);
                    }}
                    placeholder="Sol"
                    style={{ flex: 1, height: 26, borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12, padding: '0 6px' }}
                  />
                  <input
                    value={pair.right}
                    onChange={(e) => {
                      const nextPairs = (item.pairs || []).map((p) =>
                        p.id === pair.id ? { ...p, right: e.target.value } : p
                      );
                      updateItem(item.id, 'pairs', nextPairs);
                    }}
                    placeholder="Sağ"
                    style={{ flex: 1, height: 26, borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12, padding: '0 6px' }}
                  />
                </div>
              ))}
            </div>
          )}
          {(item.type === 'text-entry' || item.type === 'numeric') && (
            <input
              value={(item.acceptedAnswers || []).join(', ')}
              onChange={(e) => updateItem(item.id, 'acceptedAnswers', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
              placeholder="Kabul edilen cevaplar (virgülle ayırın)"
              style={{ width: '100%', height: 26, borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12, padding: '0 6px' }}
            />
          )}
          {item.type === 'fill-blank' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <input
                value={item.sentence || ''}
                onChange={(e) => updateItem(item.id, 'sentence', e.target.value)}
                placeholder="Boşluk doldurma cümlesi (___ ile belirtin)"
                style={{ width: '100%', height: 26, borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12, padding: '0 6px' }}
              />
              <input
                value={(item.acceptedAnswers || []).join(', ')}
                onChange={(e) => updateItem(item.id, 'acceptedAnswers', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
                placeholder="Boşluk cevapları (sırasıyla virgülle ayırın. Örn: Ankara, Türkiye)"
                style={{ width: '100%', height: 26, borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12, padding: '0 6px' }}
              />
            </div>
          )}
        </div>
      ))}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {Object.entries(MIXED_TYPE_LABELS).map(([k, v]) => (
          <button
            key={k}
            onClick={() => addItem(k)}
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid #c7d9f1',
              background: '#ffffff',
              color: '#2563eb',
              fontSize: 11,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            + {v}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function KarmaCevapPanel({ activity, onUpdate }) {
  if (activity.type === 'mixed') {
    return <MixedItemsEditor activity={activity} onUpdate={onUpdate} />;
  }
  const hasDragDrop = (activity.objects || []).some(
    (object) => object.type === 'draggable' || object.type === 'dropzone'
  );
  if (hasDragDrop) return <SurukleBirakCevapPanel activity={activity} onUpdate={onUpdate} />;
  return <SecmeCevapPanel activity={activity} onUpdate={onUpdate} />;
}
