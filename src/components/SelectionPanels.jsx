import { useState, useCallback } from 'react';

import { BUTTON_PACKAGES, ACTIVITY_TYPES, ANSWER_LAYER_STYLE_PRESETS } from '../constants';
import PdfCleanStudio from '../PdfCleanStudio';
import { EDITOR_THEME } from '../theme';
import { uid, getActivityProgressSummary, resolveWorkflowStatusMeta } from '../utils/editorHelpers';

import { Inp, Btn, Modal } from './ui';


// ─── EditorToolRail ───────────────────────────────────────────────────────────

export function EditorToolRail({
  selActivity,
  canvasRef,
  selectedIds,
  setActiveTab,
  mobile = false,
  uiMode = 'advanced',
}) {
  const disabled = !selActivity;
  const isAdvancedMode = uiMode === 'advanced';
  const tools = [
    {
      id: 'svg',
      icon: 'SVG',
      label: 'Zemin',
      title: 'SVG zemin yukle',
      onClick: () => canvasRef.current?.loadSVG(),
    },
    {
      id: 'text',
      icon: 'T',
      label: 'Metin',
      title: 'Metin ekle',
      onClick: () => canvasRef.current?.addObject('text'),
    },
    {
      id: 'button',
      icon: 'B',
      label: 'Buton',
      title: 'Buton ekle',
      onClick: () => canvasRef.current?.addObject('button'),
    },
    {
      id: 'shape-rect',
      icon: 'K',
      label: 'Sekil',
      title: 'Sekil ekle',
      onClick: () => canvasRef.current?.addObject('shape'),
    },
    {
      id: 'image',
      icon: 'I',
      label: 'Resim',
      title: 'Resim ekle',
      onClick: () => canvasRef.current?.addImage(),
    },
    {
      id: 'video',
      icon: 'V',
      label: 'Video',
      title: 'Video ekle',
      onClick: () => canvasRef.current?.addVideo(),
    },
    {
      id: 'audio',
      icon: '♪',
      label: 'Ses',
      title: 'Ses ekle',
      onClick: () => canvasRef.current?.addAudio(),
    },
    {
      id: 'shape',
      icon: 'H',
      label: 'Hotspot',
      title: 'Hotspot ekle',
      onClick: () => canvasRef.current?.addObject('hotspot'),
    },
    {
      id: 'copy',
      icon: 'C',
      label: 'Kopyala',
      title: 'Kopyala',
      onClick: () => canvasRef.current?.duplicateSelected(),
      isDisabled: selectedIds.size === 0 && !selActivity?.selectedObjectId,
    },
    {
      id: 'delete',
      icon: 'X',
      label: 'Sil',
      title: 'Sil',
      onClick: () => canvasRef.current?.deleteSelected(),
      isDisabled: selectedIds.size === 0 && !selActivity?.selectedObjectId,
    },
    {
      id: 'stage',
      icon: 'S',
      label: 'Sahne',
      title: 'Sahne sekmesi',
      onClick: () => setActiveTab('sahne'),
    },
    {
      id: 'texts',
      icon: 'M',
      label: 'Metin Stüdyosu',
      title: 'Metin stüdyosunu yeni sekmede aç',
      onClick: () => setActiveTab('metinler'),
    },
  ].filter((tool) => isAdvancedMode || !['copy', 'delete'].includes(tool.id));

  const toolToneMap = {
    svg: { color: '#c084fc', iconBg: 'rgba(192,132,252,.15)', iconBorder: 'rgba(192,132,252,.3)' },
    text: { color: '#94a3b8', iconBg: 'rgba(148,163,184,.12)', iconBorder: 'rgba(148,163,184,.2)' },
    button: {
      color: '#818cf8',
      iconBg: 'rgba(129,140,248,.15)',
      iconBorder: 'rgba(129,140,248,.3)',
    },
    'shape-rect': {
      color: '#34d399',
      iconBg: 'rgba(52,211,153,.15)',
      iconBorder: 'rgba(52,211,153,.3)',
    },
    image: { color: '#4ade80', iconBg: 'rgba(74,222,128,.15)', iconBorder: 'rgba(74,222,128,.3)' },
    video: { color: '#38bdf8', iconBg: 'rgba(56,189,248,.15)', iconBorder: 'rgba(56,189,248,.3)' },
    audio: { color: '#2dd4bf', iconBg: 'rgba(45,212,191,.15)', iconBorder: 'rgba(45,212,191,.3)' },
    shape: { color: '#fb923c', iconBg: 'rgba(251,146,60,.15)', iconBorder: 'rgba(251,146,60,.3)' },
    copy: { color: '#94a3b8', iconBg: 'rgba(148,163,184,.12)', iconBorder: 'rgba(148,163,184,.2)' },
    delete: {
      color: '#f87171',
      iconBg: 'rgba(248,113,113,.15)',
      iconBorder: 'rgba(248,113,113,.3)',
    },
    stage: { color: '#60a5fa', iconBg: 'rgba(96,165,250,.15)', iconBorder: 'rgba(96,165,250,.3)' },
    texts: {
      color: '#c084fc',
      iconBg: 'rgba(192,132,252,.15)',
      iconBorder: 'rgba(192,132,252,.3)',
    },
  };
  const toolGroups = [
    {
      id: 'flow',
      label: 'Akis',
      items: tools.filter((tool) => ['stage', 'texts'].includes(tool.id)),
    },
    {
      id: 'insert',
      label: 'Ekle',
      items: tools.filter((tool) =>
        ['svg', 'text', 'button', 'shape-rect', 'image', 'video', 'audio', 'shape'].includes(
          tool.id
        )
      ),
    },
    {
      id: 'edit',
      label: 'Duzen',
      items: tools.filter((tool) => ['copy', 'delete'].includes(tool.id)),
    },
  ].filter((group) => group.items.length);

  return (
    <div
      style={{
        width: mobile ? '100%' : 72,
        flexShrink: 0,
        borderRight: mobile ? 'none' : `1px solid ${EDITOR_THEME.shellBorder}`,
        borderBottom: mobile ? `1px solid ${EDITOR_THEME.shellBorder}` : 'none',
        background: `linear-gradient(180deg, ${EDITOR_THEME.shellBg}, ${EDITOR_THEME.shellPanelAlt})`,
        display: 'flex',
        flexDirection: mobile ? 'row' : 'column',
        alignItems: 'stretch',
        gap: 6,
        padding: mobile ? '8px' : '10px 8px',
        overflowX: mobile ? 'auto' : 'visible',
        overflowY: mobile ? 'visible' : 'auto',
      }}
    >
      {toolGroups.map((group) => (
        <div
          key={group.id}
          style={{
            borderRadius: 10,
            border: `1px solid ${EDITOR_THEME.shellBorderSoft}`,
            background: 'rgba(255,255,255,.03)',
            padding: mobile ? '6px' : '8px 6px',
            display: 'flex',
            flexDirection: mobile ? 'row' : 'column',
            alignItems: 'stretch',
            gap: 5,
            minWidth: mobile ? 'max-content' : 'auto',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,.03)',
          }}
        >
          {!mobile && (
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: 0.7,
                textTransform: 'uppercase',
                color: EDITOR_THEME.shellMutedSoft,
                textAlign: 'center',
                paddingBottom: 2,
              }}
            >
              {group.label}
            </div>
          )}
          {group.items.map((tool) => {
            const buttonDisabled = disabled || tool.isDisabled;
            const tone = toolToneMap[tool.id] || {
              color: '#64748b',
              iconBg: 'rgba(148,163,184,.1)',
              iconBorder: 'rgba(148,163,184,.2)',
            };
            return (
              <button
                key={tool.id}
                title={tool.title}
                onClick={tool.onClick}
                disabled={buttonDisabled}
                style={{
                  width: mobile ? 'auto' : '100%',
                  minWidth: mobile ? 72 : '100%',
                  minHeight: mobile ? 40 : 50,
                  borderRadius: 12,
                  border: `1px solid ${tool.active ? tone.color + '55' : EDITOR_THEME.shellBorderSoft}`,
                  background: tool.active
                    ? `linear-gradient(180deg, ${tone.iconBg}, rgba(255,255,255,.04))`
                    : 'rgba(255,255,255,.02)',
                  color: buttonDisabled ? '#2d3a4f' : tone.color,
                  cursor: buttonDisabled ? 'default' : 'pointer',
                  fontSize: 11,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: mobile ? 7 : 5,
                  padding: mobile ? '6px 10px' : '7px 4px',
                  textAlign: 'center',
                  flexDirection: mobile ? 'row' : 'column',
                  opacity: buttonDisabled ? 0.28 : 1,
                  transition: 'background .12s, opacity .12s, border-color .12s',
                  boxShadow: tool.active ? '0 10px 20px rgba(14,165,233,.12)' : 'none',
                }}
              >
                <span
                  style={{
                    width: mobile ? 22 : 28,
                    height: mobile ? 22 : 28,
                    borderRadius: 9,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: tool.id === 'svg' ? 9 : 11,
                    fontWeight: 800,
                    background: tone.iconBg,
                    border: `1px solid ${tone.iconBorder}`,
                    flexShrink: 0,
                  }}
                >
                  {tool.icon}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    whiteSpace: 'nowrap',
                    lineHeight: 1.15,
                    color: buttonDisabled ? EDITOR_THEME.shellMutedSoft : EDITOR_THEME.shellMuted,
                  }}
                >
                  {tool.label}
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ─── SelectionStepShell ───────────────────────────────────────────────────────

export function SelectionStepShell({
  title,
  subtitle,
  badge,
  onBack,
  children,
  compact = false,
  allowOverflow = false,
  stats = [],
  guidance = '',
}) {
  const visibleStats = stats.filter(Boolean).slice(0, 4);
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        height: '100%',
        background: '#f1f5f9',
        display: 'flex',
        flexDirection: 'column',
        overflow: allowOverflow ? 'auto' : 'hidden',
      }}
    >
      <div
        style={{
          padding: compact ? '14px 18px 12px' : '26px 30px 22px',
          color: EDITOR_THEME.shellText,
          position: 'relative',
          flexShrink: 0,
          background: '#0f172a',
          borderBottom: '1px solid rgba(125,211,252,.18)',
          boxShadow: '0 4px 12px rgba(15,23,42,.12)',
          overflow: 'hidden',
        }}
      >
        {/* Dekoratif zemin katmanı kaldırıldı — TTKB sade görünüm */}
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'grid',
            gridTemplateColumns: compact ? '1fr' : 'minmax(0,1fr) minmax(320px,520px)',
            gap: 18,
            alignItems: 'center',
          }}
        >
          <div style={{ minWidth: 0, paddingLeft: onBack && !compact ? 116 : 0 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                flexWrap: 'wrap',
                marginBottom: 10,
              }}
            >
              {badge && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    fontSize: 11,
                    letterSpacing: 0.8,
                    color: '#bfe7ff',
                    textTransform: 'uppercase',
                    fontWeight: 900,
                    border: '1px solid rgba(125,211,252,.30)',
                    background: 'rgba(56,189,248,.13)',
                    borderRadius: 999,
                    padding: '6px 10px',
                  }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: 999, background: '#4ade80' }} />
                  {badge}
                </span>
              )}
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 900,
                  color: '#8fdcff',
                  letterSpacing: 1.4,
                  textTransform: 'uppercase',
                }}
              >
                E-İçerik Editör
              </span>
            </div>
            {onBack && (
              <button
                onClick={onBack}
                style={{
                  position: compact ? 'static' : 'absolute',
                  left: compact ? 'auto' : 26,
                  top: compact ? 'auto' : 54,
                  border: '1px solid rgba(191,231,255,.24)',
                  background: 'rgba(255,255,255,.08)',
                  color: '#d7f1ff',
                  borderRadius: 999,
                  padding: compact ? '5px 12px' : '8px 16px',
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 900,
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,.10)',
                }}
              >
                ← Geri
              </button>
            )}
            <div
              style={{
                fontSize: compact ? 22 : 30,
                fontWeight: 950,
                lineHeight: 1.08,
                color: '#f8fbff',
                letterSpacing: -0.7,
              }}
            >
              {title}
            </div>
            {subtitle && (
              <div
                style={{
                  fontSize: compact ? 11 : 13,
                  color: '#b7c9e3',
                  marginTop: compact ? 7 : 12,
                  maxWidth: 820,
                  lineHeight: 1.65,
                }}
              >
                {subtitle}
              </div>
            )}
            {guidance && (
              <div
                style={{
                  marginTop: 12,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  border: '1px solid rgba(251,191,36,.25)',
                  background: 'rgba(251,191,36,.10)',
                  color: '#fde68a',
                  borderRadius: 14,
                  padding: '8px 10px',
                  fontSize: 11,
                  fontWeight: 800,
                }}
              >
                Rehber: {guidance}
              </div>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10 }}>
            {visibleStats.map((stat, index) => (
              <div
                key={`${stat.label}-${index}`}
                style={{
                  borderRadius: 12,
                  border: '1px solid rgba(191,231,255,.18)',
                  background: 'rgba(255,255,255,.06)',
                  boxShadow: '0 2px 6px rgba(0,0,0,.10)',
                  padding: 12,
                  minHeight: 72,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 900,
                    color: '#8fb5d9',
                    textTransform: 'uppercase',
                    letterSpacing: 1.1,
                  }}
                >
                  {stat.label}
                </div>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 950,
                    color: stat.color || '#ffffff',
                    marginTop: 6,
                    lineHeight: 1,
                  }}
                >
                  {stat.value}
                </div>
                {stat.note && (
                  <div
                    style={{
                      fontSize: 11,
                      color: '#a9bdd8',
                      marginTop: 6,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {stat.note}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          padding: compact ? '12px' : '18px',
          overflow: allowOverflow ? 'auto' : 'hidden',
        }}
      >
        <div
          style={{
            height: allowOverflow ? 'auto' : '100%',
            minHeight: 0,
            border: '1px solid rgba(191,212,234,.86)',
            borderRadius: compact ? 18 : 26,
            background: 'linear-gradient(180deg,rgba(255,255,255,.96),rgba(244,249,255,.96))',
            boxShadow: '0 2px 8px rgba(15,23,42,.08)',
            padding: compact ? 12 : 20,
            boxSizing: 'border-box',
            overflow: allowOverflow ? 'visible' : 'hidden',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── SelectionGridLayout ──────────────────────────────────────────────────────

export function SelectionGridLayout({
  search,
  onSearchChange,
  addLabel,
  onAdd,
  children,
  toolbarExtras = null,
  fillHeight = false,
}) {
  return (
    <div style={{ height: fillHeight ? '100%' : 'auto', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))',
          gap: 14,
          marginBottom: 14,
          alignItems: 'stretch',
        }}
      >
        <div
          style={{
            borderRadius: 22,
            border: '1px solid #c7d9f1',
            background: 'linear-gradient(135deg,#ffffff,#eef7ff)',
            boxShadow: '0 1px 4px rgba(15,23,42,.06)',
            padding: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            minWidth: 0,
          }}
        >
          <span
            style={{
              width: 34,
              height: 34,
              borderRadius: 12,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0f5d8e',
              background: 'rgba(56,189,248,.14)',
              border: '1px solid rgba(56,189,248,.22)',
              fontSize: 15,
              flexShrink: 0,
            }}
          >
            ⌕
          </span>
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Bu adımda ara..."
            style={{
              width: '100%',
              height: 42,
              borderRadius: 14,
              border: '1px solid #d7e4f2',
              background: '#ffffff',
              color: EDITOR_THEME.lightText,
              fontSize: 13,
              padding: '0 13px',
              outline: 'none',
              boxSizing: 'border-box',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,.95)',
            }}
          />
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'stretch',
            justifyContent: 'flex-end',
            gap: 10,
            flexWrap: 'wrap',
            minWidth: 0,
          }}
        >
          {toolbarExtras}
          <button
            onClick={onAdd}
            style={{
              minWidth: 210,
              height: 68,
              borderRadius: 22,
              border: '1px solid rgba(14,165,233,.32)',
              background: 'linear-gradient(135deg,#0ea5e9,#38bdf8)',
              color: '#03111f',
              fontSize: 13,
              fontWeight: 950,
              cursor: 'pointer',
              boxShadow: '0 4px 10px rgba(14,165,233,.18)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
            }}
          >
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: 10,
                background: 'rgba(255,255,255,.36)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 17,
              }}
            >
              +
            </span>
            <span>{addLabel}</span>
          </button>
        </div>
      </div>
      <div
        style={{
          flex: fillHeight ? 1 : '0 0 auto',
          minHeight: fillHeight ? 0 : 340,
          border: '1px solid #d7e4f2',
          borderRadius: 24,
          padding: 16,
          overflowY: 'auto',
          background: 'linear-gradient(180deg,#ffffff,#f4f9ff)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,.95)',
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ─── SelectionGridCards ───────────────────────────────────────────────────────

export function SelectionGridCards({ items, selectedId, onSelect, onEdit, onDelete, emptyText }) {
  if (items.length === 0) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: EDITOR_THEME.lightMuted,
          fontSize: 13,
        }}
      >
        {emptyText}
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))',
        gap: 18,
      }}
    >
      {items.map((item, index) => {
        const gradients = [
          ['#22c55e', '#06b6d4'],
          ['#f59e0b', '#ef4444'],
          ['#8b5cf6', '#ec4899'],
          ['#0ea5e9', '#6366f1'],
          ['#14b8a6', '#84cc16'],
        ];
        const [start, end] = gradients[index % gradients.length];
        const isSelected = selectedId === item.id;
        const initial = (item.name || '?').trim().charAt(0).toUpperCase() || '?';
        const itemKind = item.bookId ? 'Etkinlik' : item.publisherId ? 'Kitap' : 'Yayınevi';
        const activitySummary = item.bookId ? getActivityProgressSummary(item) : null;
        const slideCount =
          activitySummary?.slideCount ?? (Array.isArray(item.slides) ? item.slides.length : 0);
        const objectCount =
          activitySummary?.objectCount ?? (Array.isArray(item.objects) ? item.objects.length : 0);
        const statusMeta = activitySummary
          ? resolveWorkflowStatusMeta(activitySummary.status)
          : item.autoBuildStatus
            ? resolveWorkflowStatusMeta(item.autoBuildStatus)
            : null;
        const quality = activitySummary?.quality ?? 0;
        return (
          <div key={item.id} style={{ position: 'relative' }}>
            <button
              onClick={() => onSelect(item.id)}
              style={{
                width: '100%',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <div
                style={{
                  borderRadius: 16,
                  padding: 12,
                  background: isSelected ? 'linear-gradient(180deg,#eef8ff,#ffffff)' : '#ffffff',
                  border: `1px solid ${isSelected ? '#60c8ff' : '#dbe7f3'}`,
                  transition: 'all .15s',
                  boxShadow: isSelected
                    ? '0 6px 14px rgba(56,189,248,.14)'
                    : '0 3px 8px rgba(15,35,64,.06)',
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    inset: 'auto 0 0 0',
                    height: 4,
                    background: `linear-gradient(90deg,${start},${end})`,
                    opacity: isSelected ? 1 : 0.72,
                  }}
                />
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '74px minmax(0,1fr)',
                    gap: 12,
                    alignItems: 'center',
                  }}
                >
                  <div
                    style={{
                      width: 74,
                      height: 74,
                      borderRadius: 22,
                      border: `1px solid ${isSelected ? '#8fd3ff' : '#dbe7f3'}`,
                      background: `linear-gradient(135deg,${start},${end})`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,.28)',
                    }}
                  >
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 15,
                        background: 'rgba(255,255,255,.20)',
                        border: '1px solid rgba(255,255,255,.38)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffffff',
                        fontSize: 22,
                        fontWeight: 950,
                      }}
                    >
                      {initial}
                    </div>
                  </div>
                  <div style={{ minWidth: 0, textAlign: 'left' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        marginBottom: 6,
                        flexWrap: 'wrap',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 900,
                          color: isSelected ? '#0f5d8e' : '#64748b',
                          textTransform: 'uppercase',
                          letterSpacing: 0.8,
                        }}
                      >
                        {itemKind}
                      </span>
                      {statusMeta && (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            fontSize: 11,
                            fontWeight: 900,
                            color: statusMeta.color,
                            background: statusMeta.bg,
                            border: `1px solid ${statusMeta.border}`,
                            borderRadius: 999,
                            padding: '3px 7px',
                          }}
                        >
                          <span
                            style={{
                              width: 5,
                              height: 5,
                              borderRadius: 999,
                              background: statusMeta.color,
                            }}
                          />
                          {statusMeta.label}
                        </span>
                      )}
                      <span
                        style={{
                          width: 5,
                          height: 5,
                          borderRadius: 999,
                          background:
                            quality >= 80 ? '#22c55e' : quality >= 60 ? '#f59e0b' : '#ef4444',
                        }}
                      />
                    </div>
                    <div
                      style={{
                        fontSize: 15,
                        color: isSelected ? '#0f5d8e' : EDITOR_THEME.lightText,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        fontWeight: 950,
                        lineHeight: 1.2,
                      }}
                    >
                      {item.name}
                    </div>
                    <div
                      style={{
                        marginTop: 8,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        flexWrap: 'wrap',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 11,
                          color: '#64748b',
                          background: '#f1f5f9',
                          border: '1px solid #e2e8f0',
                          borderRadius: 999,
                          padding: '3px 7px',
                          fontWeight: 800,
                        }}
                      >
                        {quality}% hazır
                      </span>
                      {slideCount > 0 && (
                        <span
                          style={{
                            fontSize: 11,
                            color: '#2563eb',
                            background: '#eff6ff',
                            border: '1px solid #bfdbfe',
                            borderRadius: 999,
                            padding: '3px 7px',
                            fontWeight: 800,
                          }}
                        >
                          {slideCount} slide
                        </span>
                      )}
                      {objectCount > 0 && (
                        <span
                          style={{
                            fontSize: 11,
                            color: '#15803d',
                            background: '#f0fdf4',
                            border: '1px solid #bbf7d0',
                            borderRadius: 999,
                            padding: '3px 7px',
                            fontWeight: 800,
                          }}
                        >
                          {objectCount} nesne
                        </span>
                      )}
                      {activitySummary?.timelineCount > 0 && (
                        <span
                          style={{
                            fontSize: 11,
                            color: '#7c3aed',
                            background: '#f5f3ff',
                            border: '1px solid #ddd6fe',
                            borderRadius: 999,
                            padding: '3px 7px',
                            fontWeight: 800,
                          }}
                        >
                          {activitySummary.timelineCount} klip
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {activitySummary && (
                  <div
                    style={{
                      marginTop: 12,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: 8,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        color: '#475569',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: 999,
                        padding: '4px 8px',
                        fontWeight: 800,
                      }}
                    >
                      {activitySummary.readyChecks}/{activitySummary.totalChecks} kontrol
                    </span>
                  </div>
                )}
                {item.automationMeta?.pageCount ? (
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 11,
                      color: EDITOR_THEME.lightMuted,
                      textAlign: 'center',
                    }}
                  >
                    {item.automationMeta.pageCount} slide · {item.automationMeta.kind}
                  </div>
                ) : null}
              </div>
            </button>
            <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: 6 }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(item);
                }}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 9,
                  border: `1px solid ${EDITOR_THEME.lightBorderStrong}`,
                  background: 'rgba(255,255,255,.92)',
                  color: EDITOR_THEME.lightMuted,
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 800,
                  boxShadow: '0 6px 12px rgba(15,23,42,.08)',
                }}
              >
                E
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(item.id);
                }}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 9,
                  border: '1px solid rgba(248,113,113,.25)',
                  background: '#fff5f5',
                  color: '#dc2626',
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 800,
                  boxShadow: '0 6px 12px rgba(15,23,42,.08)',
                }}
              >
                ×
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── PublisherPanel ───────────────────────────────────────────────────────────

export function PublisherPanel({ publishers, selId, onSelect, onChange }) {
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [search, setSearch] = useState('');
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');
  const filtered = publishers.filter((p) =>
    (p.name || '').toLowerCase().includes(search.trim().toLowerCase())
  );
  const add = () => {
    if (!name.trim()) return;
    onChange([...publishers, { id: uid(), name: name.trim(), description: '' }]);
    setName('');
    setShowModal(false);
  };
  const remove = (id) => onChange(publishers.filter((p) => p.id !== id));
  const save = (id) => {
    onChange(publishers.map((p) => (p.id === id ? { ...p, name: editName.trim() || p.name } : p)));
    setEditId(null);
  };
  return (
    <>
      <SelectionGridLayout
        search={search}
        onSearchChange={setSearch}
        addLabel="Yeni Yayınevi Ekle"
        onAdd={() => setShowModal(true)}
      >
        <SelectionGridCards
          items={filtered}
          selectedId={selId}
          onSelect={onSelect}
          onEdit={(item) => {
            setEditId(item.id);
            setEditName(item.name);
          }}
          onDelete={remove}
          emptyText="Yayınevi ekleyin."
        />
      </SelectionGridLayout>
      {showModal && (
        <Modal title="Yeni Yayınevi" onClose={() => setShowModal(false)} width={420}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Inp
              label="Yayınevi Adı"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Yayınevi adı..."
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Btn onClick={() => setShowModal(false)} color="#555">
                İptal
              </Btn>
              <Btn onClick={add} color={EDITOR_THEME.shellAccentStrong} disabled={!name.trim()}>
                Ekle
              </Btn>
            </div>
          </div>
        </Modal>
      )}
      {editId && (
        <Modal title="Yayınevini Düzenle" onClose={() => setEditId(null)} width={420}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Inp
              label="Yayınevi Adı"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Yayınevi adı..."
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Btn onClick={() => setEditId(null)} color="#555">
                İptal
              </Btn>
              <Btn
                onClick={() => save(editId)}
                color={EDITOR_THEME.shellAccentStrong}
                disabled={!editName.trim()}
              >
                Kaydet
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

// ─── BookPanel ────────────────────────────────────────────────────────────────

export function BookPanel({
  books,
  selPubId,
  selId,
  onSelect,
  onChange,
  currentProjectId,
  activities,
  onActivitiesChange,
  normalizeBook,
}) {
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [search, setSearch] = useState('');
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');
  const [newDefaultStyleId, setNewDefaultStyleId] = useState(
    ANSWER_LAYER_STYLE_PRESETS[0]?.id || ''
  );
  const [editDefaultStyleId, setEditDefaultStyleId] = useState('');
  const [pdfStudioOpen, setPdfStudioOpen] = useState(false);
  const filtered = books.filter((b) => b.publisherId === selPubId);
  const searched = filtered.filter((b) =>
    (b.name || '').toLowerCase().includes(search.trim().toLowerCase())
  );
  const selectedBook = books.find((book) => book.id === selId) || null;
  const add = () => {
    if (!newName.trim()) return;
    const name = newName.trim();
    const defaultPackageId = BUTTON_PACKAGES[0]?.id || 'pkg-1';
    onChange([
      ...books,
      normalizeBook({
        id: uid(),
        publisherId: selPubId,
        name,
        description: '',
        buttonPackageId: defaultPackageId,
        defaultAnswerLayerStylePresetId: newDefaultStyleId,
      }),
    ]);
    setNewName('');
    setNewDefaultStyleId(ANSWER_LAYER_STYLE_PRESETS[0]?.id || '');
    setShowModal(false);
  };
  const remove = (id) => onChange(books.filter((b) => b.id !== id));
  const save = (id) => {
    onChange(
      books.map((b) =>
        b.id === id
          ? normalizeBook({
              ...b,
              name: editName.trim() || b.name,
              defaultAnswerLayerStylePresetId:
                editDefaultStyleId || b.defaultAnswerLayerStylePresetId,
            })
          : b
      )
    );
    setEditId(null);
  };
  const prepareBookAction = useCallback(
    async (bookId) => {
      if (selId === bookId) return true;
      const changed = await onSelect(bookId);
      return changed !== false;
    },
    [onSelect, selId]
  );

  if (!selPubId)
    return (
      <div style={{ fontSize: 11, color: '#444', textAlign: 'center', padding: 8 }}>
        Yayınevi seçin
      </div>
    );
  return (
    <>
      <SelectionGridLayout
        search={search}
        onSearchChange={setSearch}
        addLabel="Yeni Kitap Ekle"
        onAdd={() => setShowModal(true)}
        toolbarExtras={
          <button
            onClick={() => setPdfStudioOpen(true)}
            style={{
              minWidth: 210,
              height: 68,
              borderRadius: 22,
              border: '1px solid rgba(14,165,233,.34)',
              background: 'linear-gradient(135deg,#ffffff,#e0f7ff)',
              color: '#075985',
              fontSize: 13,
              fontWeight: 950,
              cursor: 'pointer',
              boxShadow: '0 4px 10px rgba(14,165,233,.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
            }}
            title="Tam ekran PDF duzenleme studyosunu ac"
          >
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: 10,
                background: 'rgba(14,165,233,.14)',
                border: '1px solid rgba(14,165,233,.24)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#0284c7',
              }}
            >
              P
            </span>
            <span>PDF Düzenleme</span>
          </button>
        }
      >
        <SelectionGridCards
          items={searched}
          selectedId={selId}
          onSelect={onSelect}
          onEdit={async (item) => {
            const allowed = await prepareBookAction(item.id);
            if (!allowed) return;
            setEditId(item.id);
            setEditName(item.name);
            setEditDefaultStyleId(
              item.defaultAnswerLayerStylePresetId || ANSWER_LAYER_STYLE_PRESETS[0]?.id || ''
            );
          }}
          onDelete={async (id) => {
            const allowed = await prepareBookAction(id);
            if (!allowed) return;
            remove(id);
          }}
          emptyText="Kitap ekleyin."
        />
      </SelectionGridLayout>
      {pdfStudioOpen && (
        <PdfCleanStudio
          fullScreen
          onClose={() => setPdfStudioOpen(false)}
          title={
            selectedBook ? `${selectedBook.name} PDF Düzenleme Stüdyosu` : 'PDF Düzenleme Stüdyosu'
          }
        />
      )}

      {showModal && (
        <Modal title="Yeni Kitap" onClose={() => setShowModal(false)} width={500}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Inp
              label="Kitap Adi"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Kitap adini girin..."
            />
            <label
              style={{ display: 'grid', gap: 6, fontSize: 11, color: '#78909C', fontWeight: 800 }}
            >
              Kitap Varsayılan Stili
              <select
                value={newDefaultStyleId}
                onChange={(e) => setNewDefaultStyleId(e.target.value)}
                style={{
                  height: 34,
                  borderRadius: 8,
                  border: '1px solid #d1d5db',
                  background: '#ffffff',
                  color: '#0f172a',
                  fontWeight: 800,
                  padding: '0 10px',
                }}
              >
                {ANSWER_LAYER_STYLE_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </select>
            </label>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Btn onClick={() => setShowModal(false)} color="#555">
                İptal
              </Btn>
              <Btn onClick={add} color={EDITOR_THEME.shellAccentStrong} disabled={!newName.trim()}>
                Ekle
              </Btn>
            </div>
          </div>
        </Modal>
      )}
      {editId && (
        <Modal title="Kitabı Düzenle" onClose={() => setEditId(null)} width={420}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Inp
              label="Kitap Adi"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Kitap adi..."
            />
            <label
              style={{ display: 'grid', gap: 6, fontSize: 11, color: '#78909C', fontWeight: 800 }}
            >
              Kitap Varsayılan Stili
              <select
                value={editDefaultStyleId}
                onChange={(e) => setEditDefaultStyleId(e.target.value)}
                style={{
                  height: 34,
                  borderRadius: 8,
                  border: '1px solid #d1d5db',
                  background: '#ffffff',
                  color: '#0f172a',
                  fontWeight: 800,
                  padding: '0 10px',
                }}
              >
                {ANSWER_LAYER_STYLE_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </select>
            </label>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Btn onClick={() => setEditId(null)} color="#555">
                İptal
              </Btn>
              <Btn
                onClick={() => save(editId)}
                color={EDITOR_THEME.shellAccentStrong}
                disabled={!editName.trim()}
              >
                Kaydet
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

// ─── ActivityPanel ────────────────────────────────────────────────────────────

export function ActivityPanel({
  activities,
  books,
  selBookId,
  selId,
  onSelect,
  onChange,
  onBooksChange,
  createActivity,
}) {
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('selection');
  const [search, setSearch] = useState('');
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');
  const [pdfStudioOpen, setPdfStudioOpen] = useState(false);
  const filtered = activities.filter((a) => a.bookId === selBookId);
  const searched = filtered.filter((a) =>
    (a.name || '').toLowerCase().includes(search.trim().toLowerCase())
  );
  const selectedBook = books.find((book) => book.id === selBookId) || null;
  const add = () => {
    if (!newName.trim()) return;
    const a = createActivity(newName.trim(), newType);
    a.bookId = selBookId;
    a.answerLayerStylePresetId =
      selectedBook?.defaultAnswerLayerStylePresetId || ANSWER_LAYER_STYLE_PRESETS[0]?.id || '';
    onChange([...activities, a]);
    onSelect(a.id);
    setNewName('');
    setNewType('selection');
    setShowModal(false);
  };
  const remove = (id) => {
    onChange(activities.filter((a) => a.id !== id));
    if (selId === id) onSelect(null);
  };
  const save = (id) => {
    onChange(activities.map((a) => (a.id === id ? { ...a, name: editName.trim() || a.name } : a)));
    setEditId(null);
  };
  if (!selBookId)
    return (
      <div style={{ fontSize: 11, color: '#444', textAlign: 'center', padding: 8 }}>
        Kitap secin
      </div>
    );
  return (
    <>
      <SelectionGridLayout
        search={search}
        onSearchChange={setSearch}
        addLabel="Yeni Etkinlik Ekle"
        onAdd={() => setShowModal(true)}
        toolbarExtras={
          <button
            onClick={() => setPdfStudioOpen(true)}
            style={{
              minWidth: 210,
              height: 68,
              borderRadius: 22,
              border: '1px solid rgba(14,165,233,.34)',
              background: 'linear-gradient(135deg,#ffffff,#e0f7ff)',
              color: '#075985',
              fontSize: 13,
              fontWeight: 950,
              cursor: 'pointer',
              boxShadow: '0 4px 10px rgba(14,165,233,.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
            }}
            title="Tam ekran PDF duzenleme studyosunu ac"
          >
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: 10,
                background: 'rgba(14,165,233,.14)',
                border: '1px solid rgba(14,165,233,.24)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#0284c7',
              }}
            >
              P
            </span>
            <span>PDF Düzenleme</span>
          </button>
        }
      >
        <SelectionGridCards
          items={searched}
          selectedId={selId}
          onSelect={onSelect}
          onEdit={(item) => {
            setEditId(item.id);
            setEditName(item.name);
          }}
          onDelete={remove}
          emptyText="Etkinlik ekleyin."
        />
      </SelectionGridLayout>
      {pdfStudioOpen && (
        <PdfCleanStudio
          fullScreen
          onClose={() => setPdfStudioOpen(false)}
          title={
            selectedBook ? `${selectedBook.name} PDF Düzenleme Stüdyosu` : 'PDF Düzenleme Stüdyosu'
          }
        />
      )}

      {showModal && (
        <Modal title="Yeni Etkinlik" onClose={() => setShowModal(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Inp
              label="Etkinlik Adi"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Etkinlik adi..."
            />
            <div>
              <label style={{ fontSize: 11, color: '#78909C', display: 'block', marginBottom: 8 }}>
                Etkinlik Turu
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {ACTIVITY_TYPES.map((at) => (
                  <div
                    key={at.id}
                    onClick={() => setNewType(at.id)}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 8,
                      cursor: 'pointer',
                      border: `1px solid ${newType === at.id ? '#4CAF50' : '#333'}`,
                      background: newType === at.id ? '#4CAF5022' : '#1a1a30',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 18 }}>{at.icon}</span>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: newType === at.id ? '#4CAF50' : '#E0E0E0',
                        }}
                      >
                        {at.label}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Btn onClick={() => setShowModal(false)} color="#555">
                İptal
              </Btn>
              <Btn onClick={add} color={EDITOR_THEME.shellAccentStrong} disabled={!newName.trim()}>
                Ekle
              </Btn>
            </div>
          </div>
        </Modal>
      )}
      {editId && (
        <Modal title="Etkinliği Düzenle" onClose={() => setEditId(null)} width={420}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Inp
              label="Etkinlik Adi"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Etkinlik adi..."
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Btn onClick={() => setEditId(null)} color="#555">
                İptal
              </Btn>
              <Btn
                onClick={() => save(editId)}
                color={EDITOR_THEME.shellAccentStrong}
                disabled={!editName.trim()}
              >
                Kaydet
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
