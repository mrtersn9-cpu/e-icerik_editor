import { useState } from 'react';

import { Modal, Inp, Btn } from './ui';
import { generateId } from '../utils/id';

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
    <Modal
      title="Sözlük (Glossary)"
      subtitle={`${glossaryTerms.length} terim tanımlı`}
      onClose={onClose}
      size="md"
      footer={
        <div style={{ fontSize: 11, color: 'var(--eic-light-disabled-text)', textAlign: 'left', width: '100%' }}>
          Player ayarlarından Sözlük özelliğini etkinleştirmeyi unutmayın (PUBLISH → Player Chrome →
          Sözlük).
        </div>
      }
    >
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <Inp value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Terim ara..." />
        </div>
        <Btn variant="ghost" onClick={addTerm}>
          + Yeni Terim
        </Btn>
      </div>

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
                      <Btn variant="danger" small onClick={() => removeTerm(item.id)}>
                        Sil
                      </Btn>
                      <Btn variant="primary" small onClick={() => setEditingId(null)}>
                        Tamam
                      </Btn>
                    </div>
                  </div>
                ) : (
                  <div onClick={() => setEditingId(item.id)} style={{ cursor: 'pointer' }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>
                      {item.term || '(adsız terim)'}
                    </div>
                    <div style={{ fontSize: 12, color: '#475569', marginTop: 2, lineHeight: 1.5 }}>
                      {item.definition || '(tanım yok)'}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
