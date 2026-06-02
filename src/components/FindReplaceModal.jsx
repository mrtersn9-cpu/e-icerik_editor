import { useEffect, useState } from 'react';

const fieldStyle = {
  width: '100%',
  height: 38,
  borderRadius: 10,
  border: '1px solid #d1d5db',
  padding: '0 14px',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
};

export default function FindReplaceModal({ open, onClose, onCount, onReplace, title = 'Bul ve Değiştir' }) {
  const [find, setFind] = useState('');
  const [replace, setReplace] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (open) {
      setFind('');
      setReplace('');
      setStatus('');
    }
  }, [open]);

  if (!open) return null;

  const matchCount = find ? onCount?.(find) || 0 : 0;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10001,
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
          width: 'min(460px, calc(100vw - 32px))',
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
          <div style={{ fontSize: 16, fontWeight: 900, color: '#0f172a' }}>{title}</div>
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

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Aranan metin" autoFocus style={fieldStyle} />
          <input value={replace} onChange={(e) => setReplace(e.target.value)} placeholder="Yeni metin" style={fieldStyle} />
          <div style={{ fontSize: 12, color: '#64748b', minHeight: 16 }}>
            {status || (find ? `${matchCount} eşleşme bulundu (bu etkinlikte)` : 'Aranan metni yazın')}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              type="button"
              onClick={onClose}
              style={{ height: 36, padding: '0 16px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', color: '#334155', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}
            >
              Kapat
            </button>
            <button
              type="button"
              disabled={!find}
              onClick={() => {
                const replaced = onReplace?.(find, replace) || 0;
                setStatus(replaced ? `${replaced} değişiklik yapıldı.` : 'Eşleşme bulunamadı.');
              }}
              style={{
                height: 36,
                padding: '0 16px',
                borderRadius: 8,
                border: 'none',
                background: find ? '#2563eb' : '#93c5fd',
                color: '#fff',
                fontSize: 13,
                fontWeight: 800,
                cursor: find ? 'pointer' : 'default',
              }}
            >
              Tümünü Değiştir
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
