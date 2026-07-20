import { useState, useMemo, useCallback } from 'react';

import { previewActionButtonStyle, HintBox } from './shared';
export function PreviewContentTabsFlow({ activity }) {
  const items = useMemo(() => activity.contentItems || [], [activity.contentItems]);
  const layout = activity.contentLayout || 'tabs';
  const [active, setActive] = useState(0);
  const [openSet, setOpenSet] = useState(() => new Set([0]));
  const [viewed, setViewed] = useState(() => new Set([0]));

  const markViewed = useCallback((i) => setViewed((v) => new Set(v).add(i)), []);
  const goTab = useCallback((i) => { setActive(i); markViewed(i); }, [markViewed]);
  const toggleAcc = useCallback((i) => {
    markViewed(i);
    setOpenSet((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; });
  }, [markViewed]);

  if (!items.length) {
    return <div style={{ padding: 24, color: '#64748b' }}>İçerik öğesi eklenmedi.</div>;
  }

  const allViewed = viewed.size >= items.length;
  const item = items[Math.min(active, items.length - 1)] || {};

  const bodyBlock = (it) => (
    <>
      {it.image && <img src={it.image} alt="" style={{ maxWidth: '100%', borderRadius: 8, marginBottom: 10, display: 'block' }} />}
      {it.body && <div style={{ fontSize: 14, color: '#334155', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{it.body}</div>}
    </>
  );

  return (
    <div style={{ padding: 24, maxWidth: 820, margin: '0 auto' }}>
      <HintBox activity={activity} />

      {layout === 'tabs' && (
        <div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', borderBottom: '2px solid #e2e8f0', marginBottom: 14 }}>
            {items.map((it, i) => (
              <button
                key={it.id || i}
                onClick={() => goTab(i)}
                style={{
                  padding: '9px 16px', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 13,
                  color: i === active ? '#1d4ed8' : '#64748b',
                  background: 'transparent',
                  borderBottom: i === active ? '2px solid #1d4ed8' : '2px solid transparent',
                  marginBottom: -2,
                }}
              >
                {viewed.has(i) ? '✓ ' : ''}{it.title || `Sekme ${i + 1}`}
              </button>
            ))}
          </div>
          <div>{bodyBlock(item)}</div>
        </div>
      )}

      {layout === 'accordion' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((it, i) => {
            const open = openSet.has(i);
            return (
              <div key={it.id || i} style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
                <button
                  onClick={() => toggleAcc(i)}
                  style={{
                    width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '12px 14px', border: 'none', background: open ? '#eff6ff' : '#f8fafc',
                    cursor: 'pointer', fontWeight: 800, fontSize: 14, color: '#1e293b', textAlign: 'left',
                  }}
                >
                  <span>{viewed.has(i) ? '✓ ' : ''}{it.title || `Bölüm ${i + 1}`}</span>
                  <span style={{ color: '#1d4ed8', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>▾</span>
                </button>
                {open && <div style={{ padding: '12px 14px', borderTop: '1px solid #e2e8f0' }}>{bodyBlock(it)}</div>}
              </div>
            );
          })}
        </div>
      )}

      {layout === 'process' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
            {items.map((it, i) => (
              <div key={it.id || i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  onClick={() => goTab(i)}
                  title={it.title || ''}
                  style={{
                    width: 32, height: 32, borderRadius: 999, border: 'none', cursor: 'pointer', fontWeight: 900, fontSize: 13,
                    background: i === active ? '#1d4ed8' : viewed.has(i) ? '#16a34a' : '#cbd5e1',
                    color: '#fff',
                  }}
                >
                  {i + 1}
                </button>
                {i < items.length - 1 && <div style={{ width: 24, height: 2, background: '#cbd5e1' }} />}
              </div>
            ))}
          </div>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 18, minHeight: 120 }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#1e293b', marginBottom: 8 }}>
              {active + 1}. {item.title || `Adım ${active + 1}`}
            </div>
            {bodyBlock(item)}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14 }}>
            <button onClick={() => goTab(Math.max(0, active - 1))} disabled={active === 0} style={previewActionButtonStyle(activity, 'secondary', { opacity: active === 0 ? 0.4 : 1 })}>
              ← Önceki
            </button>
            <button onClick={() => goTab(Math.min(items.length - 1, active + 1))} disabled={active === items.length - 1} style={previewActionButtonStyle(activity, 'primary', { opacity: active === items.length - 1 ? 0.4 : 1 })}>
              Sonraki →
            </button>
          </div>
        </div>
      )}

      {layout === 'timeline' && (
        <div style={{ position: 'relative', paddingLeft: 28 }}>
          <div style={{ position: 'absolute', left: 9, top: 4, bottom: 4, width: 2, background: '#cbd5e1' }} />
          {items.map((it, i) => (
            <div key={it.id || i} style={{ position: 'relative', marginBottom: 18 }}>
              <div style={{ position: 'absolute', left: -28 + 1, top: 2, width: 18, height: 18, borderRadius: 999, background: '#1d4ed8', border: '3px solid #fff', boxShadow: '0 0 0 1px #cbd5e1' }} />
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 900, color: '#1d4ed8', marginBottom: 6 }}>{it.title || `Olay ${i + 1}`}</div>
                {bodyBlock(it)}
              </div>
            </div>
          ))}
        </div>
      )}

      {activity.contentRequireAll && (
        <div style={{ marginTop: 14, fontSize: 12, fontWeight: 700, color: allViewed ? '#16a34a' : '#64748b' }}>
          {allViewed ? '✓ Tüm bölümler görüntülendi.' : `Tüm bölümleri görüntüleyin (${viewed.size} / ${items.length})`}
        </div>
      )}
    </div>
  );
}
