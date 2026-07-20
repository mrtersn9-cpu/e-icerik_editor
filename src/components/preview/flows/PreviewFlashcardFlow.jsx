import { useState, useMemo } from 'react';

import { DEFAULT_ACTIVITY_SETTINGS } from '../../../constants';
import { shuffleArray } from '../../../logic/uiPrimitives';

import { previewActionButtonStyle, HintBox } from './shared';
export function PreviewFlashcardFlow({ activity }) {
  const settings = { ...DEFAULT_ACTIVITY_SETTINGS, ...(activity.settings || {}) };
  const cards = useMemo(() => {
    const base = (activity.flashcards || []).filter((c) => c.front || c.back);
    return settings.flashcardShuffle ? shuffleArray([...base]) : base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activity.flashcards, settings.flashcardShuffle]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [viewed, setViewed] = useState(() => new Set([0]));
  const card = cards[index] || null;
  const go = (dir) => {
    setIndex((i) => {
      const next = Math.max(0, Math.min(cards.length - 1, i + dir));
      setViewed((v) => new Set(v).add(next));
      return next;
    });
    setFlipped(false);
  };
  if (!cards.length) {
    return <div style={{ padding: 24, color: '#64748b' }}>Henüz kart eklenmedi.</div>;
  }
  return (
    <div style={{ padding: 24, maxWidth: 560, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 900 }}>Bilgi Kartları</div>
        <div style={{ fontSize: 12, color: '#64748b' }}>{index + 1} / {cards.length}</div>
      </div>
      <HintBox activity={activity} />
      <div onClick={() => setFlipped((f) => !f)} style={{ perspective: 1000, cursor: 'pointer' }}>
        <div
          style={{
            position: 'relative',
            width: '100%',
            minHeight: 220,
            transition: 'transform .5s',
            transformStyle: 'preserve-3d',
            transform: flipped ? 'rotateY(180deg)' : 'none',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              display: 'grid',
              placeItems: 'center',
              padding: 24,
              borderRadius: 16,
              border: '1px solid #bfdbfe',
              background: '#eff6ff',
              color: '#1e293b',
              fontSize: 20,
              fontWeight: 800,
              textAlign: 'center',
              boxShadow: '0 8px 24px rgba(15,23,42,.1)',
            }}
          >
            {card.front || '(boş)'}
            <span style={{ position: 'absolute', bottom: 10, fontSize: 11, color: '#64748b', fontWeight: 600 }}>
              Çevirmek için tıkla
            </span>
          </div>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              display: 'grid',
              placeItems: 'center',
              padding: 24,
              borderRadius: 16,
              border: '1px solid #86efac',
              background: '#f0fdf4',
              color: '#166534',
              fontSize: 20,
              fontWeight: 800,
              textAlign: 'center',
              boxShadow: '0 8px 24px rgba(15,23,42,.1)',
            }}
          >
            {card.back || '(boş)'}
          </div>
        </div>
      </div>
      <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'center' }}>
        <button onClick={() => go(-1)} disabled={index === 0} style={previewActionButtonStyle(activity, 'secondary', { opacity: index === 0 ? 0.5 : 1 })}>‹ Önceki</button>
        <button onClick={() => setFlipped((f) => !f)} style={previewActionButtonStyle(activity, 'primary')}>Çevir</button>
        <button onClick={() => go(1)} disabled={index === cards.length - 1} style={previewActionButtonStyle(activity, 'secondary', { opacity: index === cards.length - 1 ? 0.5 : 1 })}>Sonraki ›</button>
      </div>
      {settings.flashcardProgress !== false && (
        <div style={{ marginTop: 14, height: 6, borderRadius: 999, background: '#e2e8f0', overflow: 'hidden' }}>
          <div style={{ width: `${(viewed.size / cards.length) * 100}%`, height: '100%', background: '#1d4ed8', transition: 'width .3s' }} />
        </div>
      )}
    </div>
  );
}
