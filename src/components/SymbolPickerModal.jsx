import { useEffect, useMemo, useState } from 'react';

import { SYMBOL_CATEGORIES, SYMBOL_ITEMS } from '../constants';
import { foldSearchText } from '../utils/textSearch';
import { Modal, Inp } from './ui';

const CATEGORY_LABEL = Object.fromEntries(
  SYMBOL_CATEGORIES.map((category) => [category.value, category.label])
);

// Sembol için arama metni: ad + kategori etiketi (karakterin kendisi de eşleşir).
function symbolSearchText(item) {
  return foldSearchText(`${item.name} ${item.char} ${CATEGORY_LABEL[item.category] || ''}`);
}

export default function SymbolPickerModal({ open, onClose, onSelect, title = 'Sembol Ekle' }) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  // Modal her açıldığında arama ve kategori filtresini sıfırla.
  useEffect(() => {
    if (open) {
      setSearch('');
      setActiveCategory('all');
    }
  }, [open]);

  const filtered = useMemo(() => {
    const query = foldSearchText(search);
    return SYMBOL_ITEMS.filter((item) => {
      if (activeCategory !== 'all' && item.category !== activeCategory) return false;
      if (query && !symbolSearchText(item).includes(query)) return false;
      return true;
    });
  }, [search, activeCategory]);

  if (!open) return null;

  const subtitle = `${filtered.length} / ${SYMBOL_ITEMS.length} sembol · matematik, para, ok, Yunan`;

  return (
    <Modal title={title} subtitle={subtitle} onClose={onClose} size="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
        <Inp
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Ara: toplam, derece, euro, alfa…"
          autoFocus
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {[{ value: 'all', label: 'Tümü' }, ...SYMBOL_CATEGORIES].map((category) => {
            const active = activeCategory === category.value;
            return (
              <button
                key={category.value}
                type="button"
                onClick={() => setActiveCategory(category.value)}
                style={{
                  height: 30,
                  padding: '0 12px',
                  borderRadius: 999,
                  border: `1px solid ${active ? 'var(--eic-light-accent)' : 'var(--eic-light-border-soft)'}`,
                  background: active ? 'var(--eic-light-accent-soft)' : 'var(--eic-light-panel)',
                  color: active ? 'var(--eic-light-accent-strong)' : 'var(--eic-light-muted)',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                {category.label}
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--eic-light-disabled-text)', fontSize: 13 }}>
          “{search}” ile eşleşen sembol yok.
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(58px, 1fr))',
            gap: 8,
          }}
        >
          {filtered.map((item) => (
            <button
              key={`${item.category}-${item.char}`}
              type="button"
              title={item.name}
              onClick={() => onSelect?.(item)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                aspectRatio: '1 / 1',
                borderRadius: 10,
                border: `1px solid var(--eic-light-border-soft)`,
                background: 'var(--eic-light-panel)',
                color: '#1f2937',
                fontSize: 24,
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--eic-light-accent-soft)';
                e.currentTarget.style.borderColor = '#93c5fd';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--eic-light-panel)';
                e.currentTarget.style.borderColor = 'var(--eic-light-border-soft)';
              }}
            >
              {item.char}
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}
