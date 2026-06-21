import { useEffect, useState } from 'react';

// Sahne üstüne yerleşen geri bildirim animasyonu overlay'i.
// burst: { kind: 'success' | 'failure', animation: string, ts: number } | null
// İlgili sonuç katmanı geldiğinde (Kontrol Et akışı) tetiklenir; tıklamayı engellemez.

const CONFETTI_COLORS = ['#f43f5e', '#22c55e', '#3b82f6', '#eab308', '#a855f7', '#f97316'];
const CONFETTI_PIECES = Array.from({ length: 80 }, (_, index) => index);

export default function FeedbackAnimation({ burst }) {
  const [active, setActive] = useState(null);
  const ts = burst?.ts;
  useEffect(() => {
    if (!ts) return undefined;
    setActive(burst);
    const duration = burst.kind === 'success' ? 1700 : 800;
    const timer = setTimeout(() => setActive(null), duration);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ts]);

  if (!active) return null;
  const isSuccess = active.kind === 'success';
  const animation = active.animation || (isSuccess ? 'Confetti' : 'Sallanma');
  if (animation === 'Yok') return null;

  const showConfetti = isSuccess && animation === 'Confetti';
  const isShake = ['Sallanma', 'Hafif Titresim'].includes(animation);

  return (
    <div
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 60 }}
    >
      <style>{`
        @keyframes eicFeedbackConfettiFall { 0% { transform: translateY(-12%) rotate(0deg); opacity: 1; } 100% { transform: translateY(120%) rotate(720deg); opacity: .9; } }
        @keyframes eicFeedbackPop { 0% { transform: scale(.4); opacity: 0; } 35% { transform: scale(1.15); opacity: 1; } 75% { transform: scale(1); opacity: 1; } 100% { transform: scale(1); opacity: 0; } }
        @keyframes eicFeedbackShake { 0%,100% { transform: translateX(0); } 15% { transform: translateX(-14px); } 30% { transform: translateX(12px); } 45% { transform: translateX(-9px); } 60% { transform: translateX(7px); } 75% { transform: translateX(-4px); } }
        @keyframes eicFeedbackFlash { 0% { opacity: 0; } 25% { opacity: .55; } 100% { opacity: 0; } }
      `}</style>

      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: isSuccess
            ? 'radial-gradient(circle at 50% 38%, rgba(34,197,94,.28), transparent 62%)'
            : 'rgba(239,68,68,.16)',
          animation: 'eicFeedbackFlash .6s ease-out forwards',
        }}
      />

      {showConfetti &&
        CONFETTI_PIECES.map((index) => {
          const left = (index * 53) % 100;
          const delay = (index % 10) * 0.05;
          const dur = 1.1 + (index % 5) * 0.18;
          const size = 7 + (index % 4) * 3;
          const color = CONFETTI_COLORS[index % CONFETTI_COLORS.length];
          return (
            <span
              key={index}
              style={{
                position: 'absolute',
                top: '-5%',
                left: `${left}%`,
                width: size,
                height: size * 1.4,
                background: color,
                borderRadius: 2,
                animation: `eicFeedbackConfettiFall ${dur}s linear ${delay}s forwards`,
              }}
            />
          );
        })}

      {!showConfetti && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            animation: isShake ? 'eicFeedbackShake .6s ease-in-out' : 'none',
          }}
        >
          <div
            style={{
              fontSize: 96,
              fontWeight: 900,
              color: isSuccess ? '#16a34a' : '#dc2626',
              textShadow: '0 6px 20px rgba(0,0,0,.25)',
              animation: 'eicFeedbackPop 1.3s ease-out forwards',
            }}
          >
            {isSuccess ? '✓' : '✗'}
          </div>
        </div>
      )}
    </div>
  );
}
