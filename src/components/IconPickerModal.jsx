import { useEffect, useMemo, useState } from 'react';

import { ICON_KEYWORDS_TR } from '../constants/iconKeywords.tr';
import { iconNodeToSvgMarkup } from '../utils/iconSvg';
import { foldSearchText } from '../utils/textSearch';

const PAGE_SIZE = 200;

// Her ikon için arama kelimeleri: id token'ları + okunabilir ad + TR/EN sözlük terimleri.
// Birleşik string yerine kelime kümesi tutuyoruz; eşleşme kelime-sınırında yapılır
// (substring değil) → kısa sorgularda gürültü olmaz: "ev" -> "evet" eşleşmez.
function buildSearchWords(id, name) {
  const extra = [];
  if (ICON_KEYWORDS_TR[id]) extra.push(...ICON_KEYWORDS_TR[id]);
  id.split('-').forEach((token) => {
    if (ICON_KEYWORDS_TR[token]) extra.push(...ICON_KEYWORDS_TR[token]);
  });
  const folded = foldSearchText(`${id.replace(/-/g, ' ')} ${name} ${extra.join(' ')}`);
  return Array.from(new Set(folded.split(/\s+/).filter(Boolean)));
}

// Sorgu kelimesi bir ikon kelimesiyle eşleşir mi? Tam eşitlik; 3+ karakterde önek de sayılır.
function wordMatches(iconWord, queryWord) {
  return iconWord === queryWord || (queryWord.length >= 3 && iconWord.startsWith(queryWord));
}

export default function IconPickerModal({ open, onClose, onSelect, title = 'İkon Seç' }) {
  const [catalog, setCatalog] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Kataloğu yalnızca modal ilk açıldığında lazy yükle (ayrı chunk → ana bundle şişmez).
  useEffect(() => {
    if (!open || catalog) return;
    let cancelled = false;
    import('../generated/iconCatalog.generated.js')
      .then((module) => {
        if (cancelled) return;
        const items = (module.ICON_CATALOG || []).map((item) => ({
          ...item,
          words: buildSearchWords(item.id, item.name),
        }));
        setCatalog(items);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open, catalog]);

  // Modal her açıldığında aramayı ve sayfalamayı sıfırla.
  useEffect(() => {
    if (open) {
      setSearch('');
      setVisibleCount(PAGE_SIZE);
    }
  }, [open]);

  const filtered = useMemo(() => {
    if (!catalog) return [];
    const query = foldSearchText(search);
    if (!query) return catalog;
    const queryWords = query.split(/\s+/).filter(Boolean);
    return catalog.filter((item) =>
      queryWords.every((queryWord) => item.words.some((word) => wordMatches(word, queryWord)))
    );
  }, [catalog, search]);

  const visible = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  if (!open) return null;

  const handlePick = (item) => {
    onSelect?.({ iconName: item.id, iconSvg: iconNodeToSvgMarkup(item.node) });
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
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
          width: 'min(860px, calc(100vw - 32px))',
          maxHeight: '85vh',
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
          <div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#0f172a' }}>{title}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
              {catalog
                ? `${filtered.length} / ${catalog.length} ikon · Türkçe veya İngilizce arayın`
                : 'İkonlar yükleniyor…'}
            </div>
          </div>
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

        <div style={{ padding: '12px 24px 8px' }}>
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setVisibleCount(PAGE_SIZE);
            }}
            placeholder="Ara: ev, kalp, ok, ayar, home, heart…"
            autoFocus
            style={{
              width: '100%',
              height: 38,
              borderRadius: 10,
              border: '1px solid #d1d5db',
              padding: '0 14px',
              fontSize: 13,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '8px 24px 16px' }}>
          {loadError ? (
            <div style={{ textAlign: 'center', padding: 32, color: '#dc2626', fontSize: 13 }}>
              İkon kataloğu yüklenemedi. `npm run icons:catalog` ile üretildiğinden emin olun.
            </div>
          ) : !catalog ? (
            <div style={{ textAlign: 'center', padding: 32, color: '#94a3b8', fontSize: 13 }}>
              Yükleniyor…
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: '#94a3b8', fontSize: 13 }}>
              “{search}” ile eşleşen ikon yok.
            </div>
          ) : (
            <>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))',
                  gap: 8,
                }}
              >
                {visible.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    title={`${item.name} (${item.id})`}
                    onClick={() => handlePick(item)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      aspectRatio: '1 / 1',
                      padding: 6,
                      borderRadius: 10,
                      border: '1px solid #e2e8f0',
                      background: '#fff',
                      color: '#334155',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#eff6ff';
                      e.currentTarget.style.borderColor = '#93c5fd';
                      e.currentTarget.style.color = '#1d4ed8';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#fff';
                      e.currentTarget.style.borderColor = '#e2e8f0';
                      e.currentTarget.style.color = '#334155';
                    }}
                  >
                    <span
                      style={{ width: 26, height: 26, display: 'block' }}
                      dangerouslySetInnerHTML={{
                        __html: iconNodeToSvgMarkup(item.node, { size: '26px' }),
                      }}
                    />
                  </button>
                ))}
              </div>
              {filtered.length > visible.length && (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
                  <button
                    type="button"
                    onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                    style={{
                      height: 34,
                      padding: '0 18px',
                      borderRadius: 8,
                      border: '1px solid #93c5fd',
                      background: '#eff6ff',
                      color: '#1d4ed8',
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    Daha fazla göster ({filtered.length - visible.length})
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
