import { useState } from 'react';

import { HintBox } from './shared';
export function PreviewLabeledImageFlow({ activity }) {
  const markers = activity.labeledMarkers || [];
  const [openId, setOpenId] = useState(null);
  const [viewed, setViewed] = useState(() => new Set());
  const open = markers.find((m) => m.id === openId) || null;
  if (!activity.labeledImage) {
    return <div style={{ padding: 24, color: '#64748b' }}>Görsel eklenmedi.</div>;
  }
  return (
    <div style={{ padding: 24, maxWidth: 820, margin: '0 auto' }}>
      <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 12 }}>Etiketli Görsel</div>
      <HintBox activity={activity} />
      <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
        <img src={activity.labeledImage} alt="" style={{ maxWidth: '100%', borderRadius: 10, border: '1px solid #e2e8f0', display: 'block' }} />
        {markers.map((m, i) => {
          const isViewed = viewed.has(m.id);
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => { setOpenId(m.id); setViewed((v) => new Set(v).add(m.id)); }}
              style={{
                position: 'absolute',
                left: `${m.x}%`,
                top: `${m.y}%`,
                transform: 'translate(-50%,-50%)',
                width: 28,
                height: 28,
                borderRadius: 999,
                background: isViewed ? '#16a34a' : '#2563eb',
                color: '#fff',
                fontSize: 13,
                fontWeight: 900,
                border: '2px solid #fff',
                boxShadow: '0 2px 8px rgba(0,0,0,.35)',
                cursor: 'pointer',
                animation: isViewed ? 'none' : 'eicMarkerPulse 1.8s infinite',
              }}
            >
              {i + 1}
            </button>
          );
        })}
        {open && (
          <div
            style={{
              position: 'absolute',
              left: `${open.x}%`,
              top: `${open.y}%`,
              transform: 'translate(-50%, calc(-100% - 18px))',
              minWidth: 180,
              maxWidth: 280,
              background: '#0f172a',
              color: '#fff',
              borderRadius: 10,
              padding: '10px 12px',
              boxShadow: '0 12px 30px rgba(0,0,0,.4)',
              zIndex: 5,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
              <div style={{ fontWeight: 900, fontSize: 14 }}>{open.title || '—'}</div>
              <button onClick={() => setOpenId(null)} style={{ border: 'none', background: 'transparent', color: '#94a3b8', fontSize: 16, cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>
            {open.body && <div style={{ fontSize: 13, color: '#cbd5e1', marginTop: 4, lineHeight: 1.5 }}>{open.body}</div>}
          </div>
        )}
      </div>
      <div style={{ marginTop: 12, fontSize: 12, color: '#64748b' }}>
        İşaretçilere tıklayarak bilgileri görüntüle ({viewed.size} / {markers.length})
      </div>
      <style>{`@keyframes eicMarkerPulse{0%{box-shadow:0 0 0 0 rgba(37,99,235,.5)}70%{box-shadow:0 0 0 10px rgba(37,99,235,0)}100%{box-shadow:0 0 0 0 rgba(37,99,235,0)}}`}</style>
    </div>
  );
}
