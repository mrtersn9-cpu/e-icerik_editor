// Sahnedeki ögelere (ve boş zemine) sağ tıkta açılan bağlam menüsü.
// Menü öğeleri StageCanvas tarafından (öge tipine göre) hazırlanıp `items` ile geçilir;
// bu bileşen yalnızca sunumdan, alt menülerden ve dışarı tıkta kapanmaktan sorumludur.
import { useEffect, useState } from 'react';

const MENU_WIDTH = 214;

function MenuButton({ item, hasSubmenu, active, onActivate, onHover }) {
  return (
    <button
      type="button"
      disabled={item.disabled}
      onClick={onActivate}
      onMouseEnter={onHover}
      style={{
        width: '100%',
        height: 30,
        border: 'none',
        borderRadius: 6,
        background: active && !item.disabled ? '#f1f6fc' : '#ffffff',
        color: item.disabled ? '#b6c2d2' : item.danger ? '#dc2626' : '#243042',
        cursor: item.disabled ? 'default' : 'pointer',
        fontSize: 12,
        fontWeight: 700,
        textAlign: 'left',
        padding: '0 10px',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
      }}
    >
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>
      {hasSubmenu && <span style={{ fontSize: 10, color: '#94a3b8' }}>▸</span>}
    </button>
  );
}

function MenuSurface({ items, onClose }) {
  const [openIndex, setOpenIndex] = useState(null);
  return (
    <div
      onPointerDown={(event) => event.stopPropagation()}
      style={{
        width: MENU_WIDTH,
        background: '#ffffff',
        border: '1px solid #d8e1ec',
        borderRadius: 10,
        boxShadow: '0 18px 42px rgba(15,23,42,.22)',
        padding: 6,
        display: 'grid',
        gap: 2,
      }}
    >
      {items.map((item, index) => {
        if (item.separator) {
          return (
            <div key={`sep-${index}`} style={{ height: 1, background: '#eef2f7', margin: '4px 2px' }} />
          );
        }
        const hasSubmenu = Array.isArray(item.submenu) && item.submenu.length > 0;
        return (
          <div key={item.label} style={{ position: 'relative' }}>
            <MenuButton
              item={item}
              hasSubmenu={hasSubmenu}
              active={openIndex === index}
              onHover={() => setOpenIndex(hasSubmenu ? index : null)}
              onActivate={() => {
                if (item.disabled) return;
                if (hasSubmenu) {
                  setOpenIndex((current) => (current === index ? null : index));
                  return;
                }
                onClose?.();
                item.onClick?.();
              }}
            />
            {openIndex === index && hasSubmenu && (
              <div style={{ position: 'absolute', top: -6, left: MENU_WIDTH - 4, zIndex: 1 }}>
                <MenuSurface items={item.submenu} onClose={onClose} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function ObjectContextMenu({ x = 0, y = 0, items = [], onClose }) {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!items.length) return null;

  // Menünün ekran dışına taşmaması için kaba bir kelepçe.
  const estHeight = items.length * 32 + 14;
  const left =
    typeof window !== 'undefined' ? Math.min(x, window.innerWidth - MENU_WIDTH - 8) : x;
  const top =
    typeof window !== 'undefined' ? Math.min(y, window.innerHeight - estHeight - 8) : y;

  return (
    <>
      <div
        onPointerDown={onClose}
        onContextMenu={(event) => {
          event.preventDefault();
          onClose?.();
        }}
        style={{ position: 'fixed', inset: 0, zIndex: 4000, background: 'transparent' }}
      />
      <div style={{ position: 'fixed', left: Math.max(8, left), top: Math.max(8, top), zIndex: 4001 }}>
        <MenuSurface items={items} onClose={onClose} />
      </div>
    </>
  );
}
