import { useEffect, useMemo, useRef, useState } from 'react';

import { FONT_FAMILIES, ensureGoogleFontsLoaded, fontFamilyCss, loadGoogleFont } from '../../constants/fonts';

// Biçim ribbon'unda font seçici: aranabilir, her font kendi yazı tipiyle ÖNİZLENİR.
// Google fontları picker ilk açıldığında tembel yüklenir.
export default function FontPicker({ value, onChange, disabled = false, width = 150 }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  // Klavye ile gezilen aktif satır indeksi (yukarı/aşağı ok + Enter).
  const [activeIndex, setActiveIndex] = useState(0);
  // Gerçekten indirilmiş fontlar; satır yalnızca yüklenince kendi tipiyle önizlenir
  // (yüklenmeden önce nötr fallback → tofu/bozuk glif yok).
  const [loadedFonts, setLoadedFonts] = useState(() => new Set());
  const requestedRef = useRef(new Set());
  const rootRef = useRef(null);
  const listRef = useRef(null);
  const current = value || 'Arial';

  const markLoaded = (name) =>
    setLoadedFonts((prev) => {
      if (prev.has(name)) return prev;
      const next = new Set(prev);
      next.add(name);
      return next;
    });

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

  // Açılışta/aramada aktif satırı seçili fonta ya da ilk sonuca getir.
  useEffect(() => {
    if (!open) return;
    const idx = filtered.indexOf(current);
    setActiveIndex(idx >= 0 ? idx : 0);
  }, [open, filtered, current]);

  // Aktif satırı görünür alanda tut.
  useEffect(() => {
    if (!open || !listRef.current) return;
    const node = listRef.current.querySelector(`[data-font-index="${activeIndex}"]`);
    node?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  const commitFont = (name) => {
    if (!name) return;
    onChange?.(name);
    setOpen(false);
  };

  const handleSearchKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((i) => Math.min(filtered.length - 1, i + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      commitFont(filtered[activeIndex]);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActiveIndex(Math.max(0, filtered.length - 1));
    }
  };

  // Seçili font her zaman; açıkken görünür fontlar — her birini bir kez yükle, inince işaretle.
  // markLoaded koşulsuz çağrılır (idempotent Set + fonksiyonel setState): bir effect run'ında
  // istenen font, sonraki run temizlense bile çözülünce işaretlenir (bayat-fallback önlenir).
  useEffect(() => {
    const request = (name) => {
      if (!name || requestedRef.current.has(name)) return;
      requestedRef.current.add(name);
      loadGoogleFont(name).then(markLoaded);
    };
    request(current);
    if (open) filtered.forEach(request);
  }, [open, filtered, current]);

  const previewFamily = (name) => (loadedFonts.has(name) ? fontFamilyCss(name) : undefined);

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
          fontFamily: previewFamily(current),
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
            onKeyDown={handleSearchKeyDown}
            placeholder="Font ara… (↑/↓ ve Enter)"
            style={{
              height: 28,
              border: '1px solid #cfd8e3',
              borderRadius: 6,
              padding: '0 8px',
              fontSize: 12,
              outline: 'none',
            }}
          />
          <div ref={listRef} style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: 8, fontSize: 12, color: '#94a3b8' }}>Sonuç yok</div>
            ) : (
              filtered.map((name, index) => {
                const isActive = index === activeIndex;
                const isCurrent = name === current;
                return (
                  <button
                    key={name}
                    type="button"
                    data-font-index={index}
                    onClick={() => commitFont(name)}
                    onMouseMove={() => setActiveIndex(index)}
                    style={{
                      border: 'none',
                      borderRadius: 6,
                      background: isActive ? '#dbe9ff' : isCurrent ? '#eef2ff' : 'transparent',
                      color: '#1f2937',
                      cursor: 'pointer',
                      textAlign: 'left',
                      padding: '7px 8px',
                      fontSize: 15,
                      fontFamily: previewFamily(name),
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {name}
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
