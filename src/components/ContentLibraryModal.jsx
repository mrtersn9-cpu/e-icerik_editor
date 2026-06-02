import { useEffect, useMemo, useState } from 'react';

import { CONTENT_LIBRARY_CATEGORIES, STOCK_ASSET_ITEMS } from '../constants';
import { foldSearchText } from '../utils/textSearch';

import { ShapePreviewIcon } from './ui';

// Stok şekil değerlerini editörün şekil kind'lerine eşle (ShapePreviewIcon ile önizleme için).
const STOCK_SHAPE_KIND = { circle: 'ellipse', hexagon: 'hexagon', star: 'star5' };

const CATEGORY_LABEL = Object.fromEntries(
  CONTENT_LIBRARY_CATEGORIES.map((category) => [category.value, category.label])
);

// Her stok öğe için arama metni: ad + kategori etiketi.
function itemSearchText(item) {
  return foldSearchText(`${item.name} ${CATEGORY_LABEL[item.category] || ''}`);
}

function ItemPreview({ item }) {
  if (item.type === 'background') {
    return <span style={{ width: 40, height: 28, borderRadius: 6, background: item.value }} />;
  }
  if (item.type === 'shape') {
    return (
      <span style={{ width: 30, height: 26, display: 'block' }}>
        <ShapePreviewIcon
          kind={STOCK_SHAPE_KIND[item.value] || 'roundedRect'}
          fill="#dbeafe"
          stroke="#2563eb"
          strokeWidth={4}
          preserveAspectRatio="xMidYMid meet"
        />
      </span>
    );
  }
  if (item.type === 'button') {
    return (
      <span
        style={{
          padding: '4px 10px',
          fontSize: 11,
          fontWeight: 800,
          borderRadius: item.value?.borderRadius ?? 8,
          background: item.value?.background || '#3b82f6',
          color: item.value?.color || '#fff',
          border: item.value?.borderColor ? `1px solid ${item.value.borderColor}` : 'none',
        }}
      >
        Aa
      </span>
    );
  }
  // text: ikon / işaretçi / ok glyph'i
  return <span style={{ fontSize: 26, lineHeight: 1 }}>{item.value}</span>;
}

export default function ContentLibraryModal({ open, onClose, onSelect, title = 'İçerik Kütüphanesi' }) {
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
    return STOCK_ASSET_ITEMS.filter((item) => {
      if (activeCategory !== 'all' && item.category !== activeCategory) return false;
      if (query && !itemSearchText(item).includes(query)) return false;
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
          width: 'min(760px, calc(100vw - 32px))',
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
              {`${filtered.length} / ${STOCK_ASSET_ITEMS.length} öğe · arka plan, ikon, şekil, buton, işaretçi, ok`}
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
            placeholder="Ara: gradyan, yıldız, pin, ok…"
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
            {[{ value: 'all', label: 'Tümü', icon: '✦' }, ...CONTENT_LIBRARY_CATEGORIES].map((category) => {
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
                  {category.icon} {category.label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '8px 24px 16px' }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: '#94a3b8', fontSize: 13 }}>
              “{search}” ile eşleşen öğe yok.
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
                gap: 10,
              }}
            >
              {filtered.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  title={item.name}
                  onClick={() => onSelect?.(item)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    minHeight: 92,
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
                  <ItemPreview item={item} />
                  <span style={{ fontSize: 11, fontWeight: 700, textAlign: 'center', color: '#475569' }}>
                    {item.name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
