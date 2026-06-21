import { useEffect, useMemo, useState } from 'react';

import { CHARACTER_CATEGORIES, CHARACTER_LIBRARY } from '../constants';
import { foldSearchText } from '../utils/textSearch';
import { Modal, Inp } from './ui';

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

  const subtitle = `${filtered.length} / ${CHARACTER_LIBRARY.length} karakter · veya kendi görselini yükle`;

  return (
    <Modal title={title} subtitle={subtitle} onClose={onClose} size="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
        <Inp
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Ara: öğretmen, doktor, çocuk…"
          autoFocus
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
    </Modal>
  );
}
