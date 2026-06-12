import { useEffect, useMemo, useRef, useState } from 'react';

import { fileToDataUrl } from '../../api/apiClient';
import {
  FONT_FAMILIES,
  addCustomFont,
  ensureCustomFontsLoaded,
  ensureGoogleFontsLoaded,
  fontFamilyCss,
  getCustomFonts,
  loadGoogleFont,
} from '../../constants/fonts';

// Biçim ribbon'unda font seçici: aranabilir, her font kendi yazı tipiyle ÖNİZLENİR.
// Google fontları picker ilk açıldığında tembel yüklenir. Kullanıcı kendi font
// dosyasını (.woff2/.woff/.ttf/.otf) yükleyebilir — çevrimdışı kalıcıdır.
export default function FontPicker({
  value,
  onChange,
  disabled = false,
  width = 150,
  emptyLabel = '',
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  // Klavye ile gezilen aktif satır indeksi (yukarı/aşağı ok + Enter).
  const [activeIndex, setActiveIndex] = useState(0);
  // Gerçekten indirilmiş fontlar; satır yalnızca yüklenince kendi tipiyle önizlenir
  // (yüklenmeden önce nötr fallback → tofu/bozuk glif yok).
  const [loadedFonts, setLoadedFonts] = useState(() => new Set());
  const [customFontNames, setCustomFontNames] = useState(() =>
    getCustomFonts().map((item) => item.name)
  );
  const [uploadError, setUploadError] = useState('');
  const requestedRef = useRef(new Set());
  const rootRef = useRef(null);
  const listRef = useRef(null);
  const fileInputRef = useRef(null);
  const hasEmptyOption = !!emptyLabel;
  const currentValue = value || (hasEmptyOption ? '' : 'Arial');
  const currentLabel = currentValue || emptyLabel || 'Arial';

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
    // Kayıtlı özel fontları tarayıcıya yükle ve önizlemede işaretle.
    ensureCustomFontsLoaded().then((names) => {
      (names || []).forEach((name) => name && markLoaded(name));
    });
    setUploadError('');
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

  // Özel fontlar listenin başında gösterilir.
  const allFamilies = useMemo(() => {
    const extras = customFontNames.filter((name) => !FONT_FAMILIES.includes(name));
    return hasEmptyOption ? ['', ...extras, ...FONT_FAMILIES] : [...extras, ...FONT_FAMILIES];
  }, [customFontNames, hasEmptyOption]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr-TR');
    if (!q) return allFamilies;
    return allFamilies.filter((name) =>
      (name || emptyLabel).toLocaleLowerCase('tr-TR').includes(q)
    );
  }, [allFamilies, emptyLabel, query]);

  // Açılışta/aramada aktif satırı seçili fonta ya da ilk sonuca getir.
  useEffect(() => {
    if (!open) return;
    const idx = filtered.indexOf(currentValue);
    setActiveIndex(idx >= 0 ? idx : 0);
  }, [open, filtered, currentValue]);

  // Aktif satırı görünür alanda tut.
  useEffect(() => {
    if (!open || !listRef.current) return;
    const node = listRef.current.querySelector(`[data-font-index="${activeIndex}"]`);
    node?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  const commitFont = (name) => {
    if (!name && !hasEmptyOption) return;
    onChange?.(name || '');
    setOpen(false);
  };

  // Özel font dosyası yükle: kaydet (localStorage) + FontFace ile etkinleştir + seç.
  const handleCustomFontFile = async (file) => {
    if (!file) return;
    setUploadError('');
    try {
      const name = file.name.replace(/\.[^.]+$/, '').trim() || 'Özel Font';
      const dataUrl = await fileToDataUrl(file);
      const savedName = await addCustomFont(name, dataUrl);
      setCustomFontNames(getCustomFonts().map((item) => item.name));
      markLoaded(savedName);
      commitFont(savedName);
    } catch (error) {
      setUploadError(error?.message || 'Font yüklenemedi.');
    }
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
    request(currentValue);
    if (open) filtered.forEach(request);
  }, [open, filtered, currentValue]);

  const previewFamily = (name) => (loadedFonts.has(name) ? fontFamilyCss(name) : undefined);
  const dropdownWidth = typeof width === 'number' ? Math.max(220, width) : '100%';

  return (
    <div ref={rootRef} style={{ position: 'relative', width }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((value_) => !value_)}
        title={currentLabel}
        style={{
          width: '100%',
          height: 28,
          border: '1px solid #cfd8e3',
          borderRadius: 6,
          background: disabled ? '#f1f5f9' : '#ffffff',
          color: '#1f2937',
          cursor: disabled ? 'default' : 'pointer',
          fontSize: 12,
          fontFamily: previewFamily(currentValue),
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
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentLabel}</span>
        <span style={{ fontFamily: 'inherit', opacity: 0.5, flexShrink: 0 }}>▾</span>
      </button>
      {open ? (
        <div
          style={{
            position: 'absolute',
            top: 30,
            left: 0,
            zIndex: 5000,
            width: dropdownWidth,
            minWidth: 220,
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
          <div
            ref={listRef}
            style={{
              maxHeight: 'min(360px, calc(100vh - 260px))',
              minHeight: 180,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {filtered.length === 0 ? (
              <div style={{ padding: 8, fontSize: 12, color: '#94a3b8', flexShrink: 0 }}>Sonuç yok</div>
            ) : (
              filtered.map((name, index) => {
                const label = name || emptyLabel;
                const isActive = index === activeIndex;
                const isCurrent = name === currentValue;
                return (
                  <button
                    key={name || '__empty_font__'}
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
                      lineHeight: 1.35,
                      // overflow:hidden satırın min yüksekliğini sıfırladığından, flex
                      // konteyner satırları maxHeight'e sığdırmak için DİKEYDE eziyordu
                      // (yazılar yarım görünüyordu). Satır asla büzülmesin.
                      flexShrink: 0,
                      minHeight: 30,
                      fontFamily: previewFamily(name),
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {label}
                  </button>
                );
              })
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".woff2,.woff,.ttf,.otf"
            style={{ display: 'none' }}
            onChange={(event) => {
              handleCustomFontFile(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{
              height: 30,
              border: '1px dashed #93c5fd',
              borderRadius: 6,
              background: '#eff6ff',
              color: '#1d4ed8',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            + Özel Font Yükle (.woff2/.ttf/.otf)
          </button>
          {uploadError ? (
            <div style={{ fontSize: 11, color: '#dc2626', padding: '0 2px', flexShrink: 0 }}>
              {uploadError}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
