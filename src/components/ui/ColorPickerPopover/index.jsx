// Ortak renk seçici popover'ı: hazır palet (tema + standart), renk kodu girişi
// ve hemen altında "Son Kullanılanlar". Ribbon ve sağ paneldeki tüm renk
// girişleri bu popover'ı tetikleyici bir renk kutusuyla kullanır.
// document.body'ye portallanır; bağlam menüleriyle aynı yüksek z-index katmanı.
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import {
  normalizeHexColor,
  pushRecentColor,
  readRecentColors,
  STANDARD_COLOR_SWATCHES,
  THEME_COLOR_SWATCHES,
} from '../../../constants/colorPalette';

const POPOVER_WIDTH = 218;
const SWATCH_SIZE = 22;

function SwatchButton({ color, active, onPick }) {
  return (
    <button
      type="button"
      title={color}
      onClick={() => onPick(color)}
      style={{
        width: SWATCH_SIZE,
        height: SWATCH_SIZE,
        borderRadius: 5,
        border: active ? '2px solid #0ea5e9' : '1px solid #cbd5e1',
        background: color,
        cursor: 'pointer',
        padding: 0,
        boxSizing: 'border-box',
      }}
    />
  );
}

function SectionLabel({ children }) {
  return (
    <div
      style={{
        fontSize: 9,
        fontWeight: 900,
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: 0.4,
      }}
    >
      {children}
    </div>
  );
}

export function ColorPickerPopover({ anchorRect, value, onPick, onClose }) {
  const normalizedValue = normalizeHexColor(value) || '#ffffff';
  const [hexDraft, setHexDraft] = useState(normalizedValue);
  const [recents, setRecents] = useState(() => readRecentColors());
  const hexInputRef = useRef(null);

  useEffect(() => {
    setHexDraft(normalizedValue);
  }, [normalizedValue]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const position = useMemo(() => {
    const rect = anchorRect || { left: 0, bottom: 0, top: 0 };
    const estHeight = 320;
    const left =
      typeof window === 'undefined'
        ? rect.left
        : Math.min(Math.max(8, rect.left), window.innerWidth - POPOVER_WIDTH - 8);
    const below = rect.bottom + 6;
    const top =
      typeof window === 'undefined'
        ? below
        : below + estHeight > window.innerHeight
          ? Math.max(8, rect.top - estHeight - 6)
          : below;
    return { left, top };
  }, [anchorRect]);

  const commit = (color) => {
    const normalized = normalizeHexColor(color);
    if (!normalized) return;
    setRecents(pushRecentColor(normalized));
    onPick?.(normalized);
    onClose?.();
  };

  const commitHexDraft = () => {
    const normalized = normalizeHexColor(hexDraft);
    if (normalized) commit(normalized);
    else setHexDraft(normalizedValue);
  };

  return createPortal(
    <>
      <div
        onPointerDown={() => onClose?.()}
        style={{ position: 'fixed', inset: 0, zIndex: 2147483000, background: 'transparent' }}
      />
      <div
        onPointerDown={(event) => event.stopPropagation()}
        style={{
          position: 'fixed',
          left: position.left,
          top: position.top,
          zIndex: 2147483001,
          width: POPOVER_WIDTH,
          background: '#ffffff',
          border: '1px solid #d8e1ec',
          borderRadius: 10,
          boxShadow: '0 18px 42px rgba(15,23,42,.22)',
          padding: 10,
          display: 'grid',
          gap: 8,
          boxSizing: 'border-box',
        }}
      >
        <SectionLabel>Tema Renkleri</SectionLabel>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {THEME_COLOR_SWATCHES.map((color) => (
            <SwatchButton
              key={color}
              color={color}
              active={color === normalizedValue}
              onPick={commit}
            />
          ))}
        </div>
        <SectionLabel>Standart Renkler</SectionLabel>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {STANDARD_COLOR_SWATCHES.map((color) => (
            <SwatchButton
              key={color}
              color={color}
              active={color === normalizedValue}
              onPick={commit}
            />
          ))}
        </div>
        <SectionLabel>Renk Kodu</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 30px', gap: 6, alignItems: 'center' }}>
          <input
            ref={hexInputRef}
            type="text"
            value={hexDraft}
            spellCheck={false}
            onChange={(event) => setHexDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commitHexDraft();
              }
            }}
            onBlur={() => {
              // Geçerli kod yazılıp dışarı tıklanırsa da uygula; bozuksa eskiye dön.
              if (normalizeHexColor(hexDraft) && normalizeHexColor(hexDraft) !== normalizedValue) {
                commitHexDraft();
              } else {
                setHexDraft(normalizedValue);
              }
            }}
            aria-label="Renk kodu (#RRGGBB)"
            placeholder="#RRGGBB"
            style={{
              height: 26,
              border: '1px solid #cbd5e1',
              borderRadius: 6,
              padding: '0 8px',
              fontSize: 11,
              fontWeight: 700,
              fontFamily: 'inherit',
              color: '#243042',
              boxSizing: 'border-box',
              width: '100%',
            }}
          />
          <input
            type="color"
            title="Özel renk seç"
            aria-label="Özel renk seç"
            value={normalizeHexColor(hexDraft) || normalizedValue}
            onChange={(event) => setHexDraft(event.target.value)}
            onBlur={(event) => {
              const normalized = normalizeHexColor(event.target.value);
              if (normalized && normalized !== normalizedValue) commit(normalized);
            }}
            style={{
              width: 30,
              height: 26,
              border: '1px solid #cbd5e1',
              borderRadius: 6,
              padding: 1,
              background: '#ffffff',
              cursor: 'pointer',
              boxSizing: 'border-box',
            }}
          />
        </div>
        <SectionLabel>Son Kullanılanlar</SectionLabel>
        {recents.length ? (
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {recents.map((color) => (
              <SwatchButton
                key={color}
                color={color}
                active={color === normalizedValue}
                onPick={commit}
              />
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700 }}>
            Henüz renk seçilmedi.
          </div>
        )}
      </div>
    </>,
    document.body
  );
}

// Tetikleyici + popover'ı birlikte yöneten hazır renk girişi. Mevcut
// RibbonColorInput/ColorInput API'lerinin yerine geçecek ortak gövde.
export function ColorPickerField({
  value = '#ffffff',
  onPick,
  disabled = false,
  title,
  ariaLabel,
  width = 24,
  height = 24,
  borderRadius = 6,
}) {
  const [open, setOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState(null);
  const buttonRef = useRef(null);
  const normalized = normalizeHexColor(value) || '#ffffff';

  const openPopover = () => {
    if (disabled) return;
    const rect = buttonRef.current?.getBoundingClientRect?.();
    setAnchorRect(rect ? { left: rect.left, top: rect.top, bottom: rect.bottom } : null);
    setOpen(true);
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        title={title || ariaLabel}
        aria-label={ariaLabel || title || 'Renk seç'}
        onClick={openPopover}
        style={{
          width,
          minWidth: width,
          height,
          border: '1px solid #cbd5e1',
          borderRadius,
          background: '#ffffff',
          padding: 2,
          cursor: disabled ? 'default' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          boxSizing: 'border-box',
          display: 'inline-flex',
        }}
      >
        <span
          style={{
            flex: 1,
            borderRadius: Math.max(2, borderRadius - 3),
            background: normalized,
            border: '1px solid rgba(15,23,42,.12)',
          }}
        />
      </button>
      {open && (
        <ColorPickerPopover
          anchorRect={anchorRect}
          value={normalized}
          onPick={(color) => onPick?.(color)}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
