import { useEffect, useMemo, useRef, useState } from 'react';

import { FONT_FAMILIES, ensureGoogleFontsLoaded, fontFamilyCss } from '../../constants/fonts';

// Biçim ribbon'unda font seçici: aranabilir, her font kendi yazı tipiyle ÖNİZLENİR.
// Google fontları picker ilk açıldığında tembel yüklenir.
export default function FontPicker({ value, onChange, disabled = false, width = 150 }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef(null);
  const current = value || 'Arial';

  useEffect(() => {
    if (!open) return undefined;
    ensureGoogleFontsLoaded();
    const onDocPointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDocPointerDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDocPointerDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr-TR');
    if (!q) return FONT_FAMILIES;
    return FONT_FAMILIES.filter((name) => name.toLocaleLowerCase('tr-TR').includes(q));
  }, [query]);

  return (
    <div ref={rootRef} style={{ position: 'relative', width }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((value_) => !value_)}
        title={current}
        style={{
          width: '100%',
          height: 28,
          border: '1px solid #cfd8e3',
          borderRadius: 6,
          background: disabled ? '#f1f5f9' : '#ffffff',
          color: '#1f2937',
          cursor: disabled ? 'default' : 'pointer',
          fontSize: 12,
          fontFamily: fontFamilyCss(current),
          textAlign: 'left',
          padding: '0 8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 6,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{current}</span>
        <span style={{ fontFamily: 'inherit', opacity: 0.5, flexShrink: 0 }}>▾</span>
      </button>
      {open ? (
        <div
          style={{
            position: 'absolute',
            top: 30,
            left: 0,
            zIndex: 5000,
            width: Math.max(220, width),
            background: '#ffffff',
            border: '1px solid #d8e1ec',
            borderRadius: 10,
            boxShadow: '0 18px 42px rgba(15,23,42,.22)',
            padding: 6,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Font ara…"
            style={{
              height: 28,
              border: '1px solid #cfd8e3',
              borderRadius: 6,
              padding: '0 8px',
              fontSize: 12,
              outline: 'none',
            }}
          />
          <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: 8, fontSize: 12, color: '#94a3b8' }}>Sonuç yok</div>
            ) : (
              filtered.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    onChange?.(name);
                    setOpen(false);
                  }}
                  style={{
                    border: 'none',
                    borderRadius: 6,
                    background: name === current ? '#eef2ff' : 'transparent',
                    color: '#1f2937',
                    cursor: 'pointer',
                    textAlign: 'left',
                    padding: '7px 8px',
                    fontSize: 15,
                    fontFamily: fontFamilyCss(name),
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  onMouseEnter={(event) => {
                    if (name !== current) event.currentTarget.style.background = '#f1f6fc';
                  }}
                  onMouseLeave={(event) => {
                    event.currentTarget.style.background = name === current ? '#eef2ff' : 'transparent';
                  }}
                >
                  {name}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
