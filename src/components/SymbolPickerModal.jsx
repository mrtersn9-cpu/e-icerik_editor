import { useEffect, useMemo, useState } from 'react';

import { SYMBOL_CATEGORIES, SYMBOL_ITEMS } from '../constants';
import { foldSearchText } from '../utils/textSearch';

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

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
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
          width: 'min(720px, calc(100vw - 32px))',
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
            <div style={{ fontSize: 16, fontWeight: 900, color: '#0f172a' }}>{title}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
              {`${filtered.length} / ${SYMBOL_ITEMS.length} sembol · matematik, para, ok, Yunan`}
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

        <div style={{ padding: '12px 24px 8px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ara: toplam, derece, euro, alfa…"
            autoFocus
            style={{
              width: '100%',
              height: 38,
              borderRadius: 10,
              border: '1px solid #d1d5db',
              padding: '0 14px',
              fontSize: 13,
              outline: 'none',
              boxSizing: 'border-box',
            }}
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
                    border: `1px solid ${active ? '#2563eb' : '#e2e8f0'}`,
                    background: active ? '#eff6ff' : '#fff',
                    color: active ? '#1d4ed8' : '#475569',
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

        <div style={{ flex: 1, overflow: 'auto', padding: '8px 24px 16px' }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: '#94a3b8', fontSize: 13 }}>
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
                    border: '1px solid #e2e8f0',
                    background: '#fff',
                    color: '#1f2937',
                    fontSize: 24,
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#eff6ff';
                    e.currentTarget.style.borderColor = '#93c5fd';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#fff';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                  }}
                >
                  {item.char}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
