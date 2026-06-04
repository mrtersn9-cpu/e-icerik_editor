/**
 * Sağ üstte beliren bildirim (toast) yığını. EIcerikEditor render'ından birebir
 * taşınmıştır (yalnızca presentational).
 *
 * Görünürlük kontrolü (toasts.length > 0) çağıran tarafta kalır.
 *
 * Props: toasts ({ id, type?, message } dizisi), onDismiss(id) (kapatma tıklaması).
 *
 * @returns {JSX.Element}
 */
export default function ToastStack({ toasts, onDismiss }) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        right: 16,
        zIndex: 9500,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'none',
        maxWidth: 400,
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            pointerEvents: 'auto',
            background:
              t.type === 'success' ? '#052e16' : t.type === 'warning' ? '#422006' : '#2c0b0e',
            border: `1px solid ${t.type === 'success' ? '#16a34a' : t.type === 'warning' ? '#d97706' : '#dc2626'}`,
            color: t.type === 'success' ? '#86efac' : t.type === 'warning' ? '#fde68a' : '#fca5a5',
            borderRadius: 10,
            padding: '10px 16px',
            fontSize: 13,
            fontWeight: 600,
            boxShadow: '0 8px 24px rgba(0,0,0,.5)',
            animation: 'fadeInSlide .25s ease',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            lineHeight: 1.4,
          }}
        >
          <span style={{ flexShrink: 0, fontSize: 16 }}>
            {t.type === 'success' ? '✓' : t.type === 'warning' ? '⚠' : '✕'}
          </span>
          <span style={{ flex: 1, wordBreak: 'break-word' }}>{t.message}</span>
          <button
            onClick={() => onDismiss(t.id)}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'inherit',
              cursor: 'pointer',
              fontSize: 16,
              padding: 0,
              lineHeight: 1,
              opacity: 0.6,
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
