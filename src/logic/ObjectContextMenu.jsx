// Sahnedeki ögelere (ve boş zemine) sağ tıkta açılan bağlam menüsü.
// Menü öğeleri StageCanvas tarafından (öge tipine göre) hazırlanıp `items` ile geçilir;
// bu bileşen yalnızca sunumdan ve dışarı tıkta kapanmaktan sorumludur.
import { useEffect } from 'react';

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
  const menuWidth = 214;
  const estHeight = items.length * 32 + 14;
  const left =
    typeof window !== 'undefined' ? Math.min(x, window.innerWidth - menuWidth - 8) : x;
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
      <div
        onPointerDown={(event) => event.stopPropagation()}
        style={{
          position: 'fixed',
          left: Math.max(8, left),
          top: Math.max(8, top),
          zIndex: 4001,
          width: menuWidth,
          background: '#ffffff',
          border: '1px solid #d8e1ec',
          borderRadius: 10,
          boxShadow: '0 18px 42px rgba(15,23,42,.22)',
          padding: 6,
          display: 'grid',
          gap: 2,
        }}
      >
        {items.map((item, index) =>
          item.separator ? (
            <div
              key={`sep-${index}`}
              style={{ height: 1, background: '#eef2f7', margin: '4px 2px' }}
            />
          ) : (
            <button
              key={item.label}
              type="button"
              disabled={item.disabled}
              onClick={() => {
                if (item.disabled) return;
                onClose?.();
                item.onClick?.();
              }}
              style={{
                height: 30,
                border: 'none',
                borderRadius: 6,
                background: '#ffffff',
                color: item.disabled ? '#b6c2d2' : item.danger ? '#dc2626' : '#243042',
                cursor: item.disabled ? 'default' : 'pointer',
                fontSize: 12,
                fontWeight: 700,
                textAlign: 'left',
                padding: '0 10px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              onMouseEnter={(event) => {
                if (!item.disabled) event.currentTarget.style.background = '#f1f6fc';
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.background = '#ffffff';
              }}
            >
              {item.label}
            </button>
          )
        )}
      </div>
    </>
  );
}
