/*
 * Çevrimiçi kullanıcı göstergesi — üst barda avatar yığını.
 * Seviye 1 işbirliği: kim online + (opsiyonel) bulunulan kitabı kim düzenliyor.
 * Saf görsel bileşen; veri `usePresence` türetmesinden gelir.
 */
function initials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const AVATAR_TONES = ['#2563eb', '#0891b2', '#7c3aed', '#16a34a', '#d97706', '#db2777'];

function toneFor(userId = '') {
  let sum = 0;
  for (let i = 0; i < userId.length; i += 1) sum += userId.charCodeAt(i);
  return AVATAR_TONES[sum % AVATAR_TONES.length];
}

export default function PresenceBar({ onlineUsers = [], currentBookEditor = null, compact = false }) {
  if (!onlineUsers.length && !currentBookEditor) return null;

  const shown = onlineUsers.slice(0, 4);
  const extra = onlineUsers.length - shown.length;

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      {onlineUsers.length > 0 && (
        <div
          style={{ display: 'inline-flex', alignItems: 'center' }}
          title={`Çevrimiçi: ${onlineUsers.map((u) => u.userName).join(', ')}`}
        >
          {shown.map((u, index) => (
            <span
              key={u.userId}
              style={{
                width: compact ? 22 : 26,
                height: compact ? 22 : 26,
                marginLeft: index === 0 ? 0 : -7,
                borderRadius: 999,
                background: toneFor(u.userId),
                color: '#fff',
                border: '2px solid rgba(255,255,255,.85)',
                display: 'grid',
                placeItems: 'center',
                fontSize: compact ? 9 : 10,
                fontWeight: 900,
                letterSpacing: 0.2,
                boxShadow: '0 1px 3px rgba(15,23,42,.25)',
                zIndex: shown.length - index,
              }}
            >
              {initials(u.userName)}
            </span>
          ))}
          {extra > 0 && (
            <span
              style={{
                width: compact ? 22 : 26,
                height: compact ? 22 : 26,
                marginLeft: -7,
                borderRadius: 999,
                background: '#64748b',
                color: '#fff',
                border: '2px solid rgba(255,255,255,.85)',
                display: 'grid',
                placeItems: 'center',
                fontSize: compact ? 9 : 10,
                fontWeight: 900,
              }}
            >
              +{extra}
            </span>
          )}
        </div>
      )}

      {currentBookEditor && !compact && (
        <span
          title={`${currentBookEditor.userName} bu kitabı düzenliyor`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '3px 9px',
            borderRadius: 999,
            background: 'rgba(245,158,11,.16)',
            border: '1px solid rgba(245,158,11,.4)',
            color: '#b45309',
            fontSize: 11,
            fontWeight: 800,
            whiteSpace: 'nowrap',
          }}
        >
          <span
            style={{ width: 6, height: 6, borderRadius: 999, background: '#f59e0b' }}
            aria-hidden="true"
          />
          {currentBookEditor.userName} düzenliyor
        </span>
      )}
    </div>
  );
}
