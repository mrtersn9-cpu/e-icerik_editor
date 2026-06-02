import { useEffect, useMemo, useState } from 'react';

import { CHARACTER_CATEGORIES, CHARACTER_LIBRARY } from '../constants';
import { foldSearchText } from '../utils/textSearch';

const CATEGORY_LABEL = Object.fromEntries(
  CHARACTER_CATEGORIES.map((category) => [category.value, category.label])
);

// Karakter için arama metni: ad + kategori etiketi.
function characterSearchText(character) {
  return foldSearchText(`${character.name} ${CATEGORY_LABEL[character.category] || ''}`);
}

export default function CharacterPickerModal({ open, onClose, onSelect, title = 'Karakter Ekle' }) {
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
    return CHARACTER_LIBRARY.filter((character) => {
      if (activeCategory !== 'all' && character.category !== activeCategory) return false;
      if (query && !characterSearchText(character).includes(query)) return false;
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
              {`${filtered.length} / ${CHARACTER_LIBRARY.length} karakter · veya kendi görselini yükle`}
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
            placeholder="Ara: öğretmen, doktor, çocuk…"
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
            {[{ value: 'all', label: 'Tümü' }, ...CHARACTER_CATEGORIES].map((category) => {
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
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
              gap: 10,
            }}
          >
            <button
              type="button"
              onClick={() => onSelect?.({ kind: 'upload' })}
              title="Kendi karakter görselini yükle (PNG/SVG)"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                minHeight: 116,
                padding: 10,
                borderRadius: 12,
                border: '1px dashed #93c5fd',
                background: '#f8fbff',
                color: '#1d4ed8',
                cursor: 'pointer',
                fontWeight: 800,
                fontSize: 12,
              }}
            >
              <span style={{ fontSize: 32, lineHeight: 1 }}>⬆️</span>
              Görsel Yükle
            </button>

            {filtered.map((character) => (
              <button
                key={character.id}
                type="button"
                title={character.name}
                onClick={() => onSelect?.({ kind: 'emoji', value: character.thumbnail, name: character.name })}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  minHeight: 116,
                  padding: 10,
                  borderRadius: 12,
                  border: '1px solid #e2e8f0',
                  background: '#fff',
                  color: '#334155',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#93c5fd';
                  e.currentTarget.style.background = '#f8fbff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e2e8f0';
                  e.currentTarget.style.background = '#fff';
                }}
              >
                <span style={{ fontSize: 44, lineHeight: 1 }}>{character.thumbnail}</span>
                <span style={{ fontSize: 11, fontWeight: 700, textAlign: 'center', color: '#475569' }}>
                  {character.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
