/**
 * "Çıkış İsteği" tam ekran overlay'i — başka bir cihaz bu hesaba giriş yapmak
 * istediğinde gösterilir ve geri sayım sonunda oturum kapanır. EIcerikEditor
 * render'ından birebir taşınmıştır (yalnızca presentational).
 *
 * Görünürlük kontrolü (kickRequested) çağıran tarafta kalır.
 *
 * Props: kickCountdown (geri sayım saniyesi), onConfirm ("Kaydet ve Çıkış" tıklaması).
 *
 * @returns {JSX.Element}
 */
export default function KickNotificationOverlay({ kickCountdown, onConfirm }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,.75)',
        backdropFilter: 'blur(6px)',
      }}
    >
      <div
        style={{
          width: 'min(440px, 90vw)',
          background: '#131e33',
          border: '1px solid rgba(251,191,36,.35)',
          borderRadius: 22,
          padding: 28,
          boxShadow: '0 24px 64px rgba(0,0,0,.7)',
          color: '#e6eefc',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'rgba(251,191,36,.18)',
              border: '1px solid rgba(251,191,36,.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fbbf24"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 900, fontSize: 15 }}>Çıkış İsteği Geldi</div>
            <div style={{ fontSize: 11, color: '#91a6c6', marginTop: 2 }}>
              Başka bir cihaz bu hesaba giriş yapmak istiyor
            </div>
          </div>
        </div>
        <div
          style={{
            background: 'rgba(251,191,36,.08)',
            border: '1px solid rgba(251,191,36,.2)',
            borderRadius: 12,
            padding: '12px 14px',
            fontSize: 13,
            color: '#fef3c7',
            lineHeight: 1.6,
            marginBottom: 20,
          }}
        >
          Çalışmanız otomatik kaydedildi.{' '}
          <strong style={{ color: '#fbbf24' }}>{kickCountdown}</strong> saniye sonra oturumunuz
          otomatik olarak kapatılacak.
        </div>
        <button
          onClick={onConfirm}
          style={{
            width: '100%',
            height: 44,
            borderRadius: 12,
            border: 'none',
            background: 'linear-gradient(135deg, #f59e0b, #fbbf24)',
            color: '#1c1007',
            fontSize: 13,
            fontWeight: 900,
            cursor: 'pointer',
          }}
        >
          Şimdi Kaydet ve Çıkış Yap
        </button>
      </div>
    </div>
  );
}
