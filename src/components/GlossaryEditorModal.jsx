import { useState } from 'react';

function generateId() {
  return 'g_' + Math.random().toString(36).slice(2, 10);
}

export default function GlossaryEditorModal({
  open,
  onClose,
  glossaryTerms = [],
  onChange = () => {},
}) {
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState(null);

  if (!open) return null;

  const sorted = [...glossaryTerms].sort((a, b) =>
    (a.term || '').localeCompare(b.term || '', 'tr')
  );
  const filtered = sorted.filter((item) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      (item.term || '').toLowerCase().includes(q) ||
      (item.definition || '').toLowerCase().includes(q)
    );
  });

  const addTerm = () => {
    const newItem = { id: generateId(), term: '', definition: '' };
    onChange([...glossaryTerms, newItem]);
    setEditingId(newItem.id);
  };

  const updateTerm = (id, patch) => {
    onChange(glossaryTerms.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const removeTerm = (id) => {
    onChange(glossaryTerms.filter((item) => item.id !== id));
    if (editingId === id) setEditingId(null);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(15,23,42,.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 620,
          maxHeight: '85vh',
          background: '#ffffff',
          borderRadius: 20,
          boxShadow: '0 32px 80px rgba(0,0,0,.3)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 24px',
            borderBottom: '1px solid #e2e8f0',
          }}
        >
          <div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#0f172a' }}>Sözlük (Glossary)</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
              {glossaryTerms.length} terim tanımlı
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              background: '#fff',
              fontSize: 18,
              cursor: 'pointer',
              color: '#64748b',
            }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: '12px 24px 8px', display: 'flex', gap: 8 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Terim ara..."
            style={{
              flex: 1,
              height: 34,
              borderRadius: 8,
              border: '1px solid #d1d5db',
              padding: '0 12px',
              fontSize: 12,
              outline: 'none',
            }}
          />
          <button
            onClick={addTerm}
            style={{
              height: 34,
              padding: '0 16px',
              borderRadius: 8,
              border: '1px solid #93c5fd',
              background: '#eff6ff',
              color: '#1d4ed8',
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            + Yeni Terim
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '8px 24px 16px' }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: '#94a3b8', fontSize: 13 }}>
              {glossaryTerms.length === 0
                ? 'Henüz sözlük terimi eklenmedi.'
                : 'Aramayla eşleşen terim yok.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {filtered.map((item) => {
                const isEditing = editingId === item.id;
                return (
                  <div
                    key={item.id}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 12,
                      border: `1px solid ${isEditing ? '#93c5fd' : '#e2e8f0'}`,
                      background: isEditing ? '#f0f7ff' : '#ffffff',
                    }}
                  >
                    {isEditing ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <input
                          value={item.term || ''}
                          onChange={(e) => updateTerm(item.id, { term: e.target.value })}
                          placeholder="Terim"
                          autoFocus
                          style={{
                            height: 30,
                            borderRadius: 6,
                            border: '1px solid #cbd5e1',
                            padding: '0 10px',
                            fontSize: 12,
                            fontWeight: 700,
                            outline: 'none',
                          }}
                        />
                        <textarea
                          value={item.definition || ''}
                          onChange={(e) => updateTerm(item.id, { definition: e.target.value })}
                          placeholder="Tanım"
                          rows={3}
                          style={{
                            borderRadius: 6,
                            border: '1px solid #cbd5e1',
                            padding: '8px 10px',
                            fontSize: 12,
                            lineHeight: 1.6,
                            resize: 'vertical',
                            outline: 'none',
                          }}
                        />
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => removeTerm(item.id)}
                            style={{
                              height: 28,
                              padding: '0 12px',
                              borderRadius: 6,
                              border: '1px solid #fecaca',
                              background: '#fff1f2',
                              color: '#dc2626',
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            Sil
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            style={{
                              height: 28,
                              padding: '0 12px',
                              borderRadius: 6,
                              border: '1px solid #93c5fd',
                              background: '#dbeafe',
                              color: '#1d4ed8',
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            Tamam
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div onClick={() => setEditingId(item.id)} style={{ cursor: 'pointer' }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>
                          {item.term || '(adsız terim)'}
                        </div>
                        <div
                          style={{ fontSize: 12, color: '#475569', marginTop: 2, lineHeight: 1.5 }}
                        >
                          {item.definition || '(tanım yok)'}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div
          style={{
            padding: '10px 24px',
            borderTop: '1px solid #e2e8f0',
            fontSize: 11,
            color: '#94a3b8',
          }}
        >
          Player ayarlarından Sözlük özelliğini etkinleştirmeyi unutmayın (PUBLISH → Player Chrome →
          Sözlük).
        </div>
      </div>
    </div>
  );
}
