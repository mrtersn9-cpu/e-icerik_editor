import { uid } from '../../../utils/editorHelpers';

import { CanCard } from './OrtakCevapKartlari';
import SecmeCevapPanel from './SecmeCevapPanel';
import SurukleBirakCevapPanel from './SurukleBirakCevapPanel';

const MIXED_TYPE_LABELS = {
  selection: 'Seçim',
  'drag-drop': 'Sürükle-Bırak',
  'text-entry': 'Metin Girişi',
  numeric: 'Sayısal',
  'fill-blank': 'Boşluk Doldurma',
};

// Panel genelinde tekrar eden "+ ekle" / "× kaldır" düğme stilleri — tip
// ekleme, seçenek ekleme ve eşleştirme çifti ekleme düğmeleri arasında
// paylaşılır.
const ADD_BUTTON_STYLE = {
  borderRadius: 6,
  border: '1px solid #c7d9f1',
  background: '#ffffff',
  color: '#2563eb',
  fontSize: 11,
  fontWeight: 800,
  cursor: 'pointer',
};

const REMOVE_ROW_BUTTON_STYLE = {
  border: 'none',
  background: 'transparent',
  color: '#ef4444',
  cursor: 'pointer',
  fontSize: 13,
};

// Karma öğe tipine göre alan varsayılanlarını üretir. Hem yeni öğe eklerken
// hem de mevcut bir öğenin tipi değiştirilirken kullanılır — böylece tip
// değişince eski tipe ait alanlar (options/pairs/acceptedAnswers/sentence)
// sessizce silinip yerine boş dizi/obje kalmaz, yeni tipe uygun dolu
// varsayılanlar kurulur.
export function defaultsForType(type) {
  if (type === 'selection') {
    return {
      options: [
        { id: uid(), label: 'Seçenek A', isCorrect: true },
        { id: uid(), label: 'Seçenek B', isCorrect: false },
      ],
    };
  }
  if (type === 'drag-drop') {
    return {
      pairs: [
        { id: uid(), left: 'Sol 1', right: 'Sağ 1' },
        { id: uid(), left: 'Sol 2', right: 'Sağ 2' },
      ],
    };
  }
  if (type === 'text-entry') {
    return { acceptedAnswers: [''] };
  }
  if (type === 'numeric') {
    return { acceptedAnswers: ['0'] };
  }
  if (type === 'fill-blank') {
    return { sentence: 'Cümledeki ___ boşluğu doldurun.' };
  }
  return {};
}

function MixedItemsEditor({ activity, onUpdate }) {
  const patch = (p) => onUpdate({ ...activity, ...p });
  const items = activity.mixedItems || [];

  const addItem = (type = 'selection') => {
    const base = {
      id: uid(),
      type,
      question: '',
      ...defaultsForType(type),
    };
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
                const nextType = e.target.value;
                const next = items.map((it) =>
                  it.id === item.id
                    ? { id: it.id, type: nextType, question: it.question || '', ...defaultsForType(nextType) }
                    : it
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
                  <button
                    type="button"
                    title="Seçeneği kaldır"
                    onClick={() => {
                      const nextOpts = (item.options || []).filter((o) => o.id !== opt.id);
                      updateItem(item.id, 'options', nextOpts);
                    }}
                    style={REMOVE_ROW_BUTTON_STYLE}
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  const nextOpts = [...(item.options || []), { id: uid(), label: '', isCorrect: false }];
                  updateItem(item.id, 'options', nextOpts);
                }}
                style={{ ...ADD_BUTTON_STYLE, alignSelf: 'flex-start', padding: '4px 10px' }}
              >
                + Seçenek ekle
              </button>
            </div>
          )}
          {item.type === 'drag-drop' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {(item.pairs || []).map((pair) => (
                <div key={pair.id} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
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
                  <button
                    type="button"
                    title="Eşleştirme çiftini kaldır"
                    onClick={() => {
                      const nextPairs = (item.pairs || []).filter((p) => p.id !== pair.id);
                      updateItem(item.id, 'pairs', nextPairs);
                    }}
                    style={REMOVE_ROW_BUTTON_STYLE}
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  const nextPairs = [...(item.pairs || []), { id: uid(), left: '', right: '' }];
                  updateItem(item.id, 'pairs', nextPairs);
                }}
                style={{ ...ADD_BUTTON_STYLE, alignSelf: 'flex-start', padding: '4px 10px' }}
              >
                + Eşleştirme çifti ekle
              </button>
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
            style={{ ...ADD_BUTTON_STYLE, padding: '6px 10px' }}
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
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <MixedItemsEditor activity={activity} onUpdate={onUpdate} />
        <CanCard number="2" activity={activity} onUpdate={onUpdate} />
      </div>
    );
  }
  const hasDragDrop = (activity.objects || []).some(
    (object) => object.type === 'draggable' || object.type === 'dropzone'
  );
  if (hasDragDrop) return <SurukleBirakCevapPanel activity={activity} onUpdate={onUpdate} />;
  return <SecmeCevapPanel activity={activity} onUpdate={onUpdate} />;
}
