import { useState, useCallback } from 'react';

import { generateDiceBirdDemoTemplate } from '../activity-types/custom-interaction/customInteractionTemplates';
import {
  BUTTON_PACKAGES,
  ACTIVITY_TYPES,
  ANSWER_LAYER_STYLE_PRESETS,
  STANDARD_ACTIVITY_CREATE_PRESETS,
  OTHER_ACTIVITY_CREATE_PRESETS,
  CUSTOM_INTERACTION_TEMPLATES,
  DEFAULT_ACTIVITY_CREATE_PRESET_ID,
  DEFAULT_CUSTOM_INTERACTION_TEMPLATE_ID,
} from '../constants';
import { getActivityLayers, getActivitySlides, selectActivitySlide } from '../logic/activityHelpers';
import {
  ensureStandardActivityScaffold,
  SCENE_TEMPLATE_LAUNCH_PAGE_ID,
} from '../logic/activityTemplateGenerators';
import {
  getButtonPackageMotion,
  restyleAllButtonsForPackage,
  restyleAnswerLayerObjectsForPreset,
} from '../logic/buttonStyling';
import { buildResolvedLayerNameMap } from '../logic/factories';
import { normalizeSlide } from '../logic/slideNormalization';
import PdfCleanStudio from '../PdfCleanStudio';
import { EDITOR_THEME } from '../theme';
import { uid, getActivityProgressSummary, resolveWorkflowStatusMeta } from '../utils/editorHelpers';

import { Inp, Btn, Modal } from './ui';

const ACTIVITY_CREATE_PRESETS = [
  ...STANDARD_ACTIVITY_CREATE_PRESETS,
  ...OTHER_ACTIVITY_CREATE_PRESETS,
  { id: 'custom-interaction', activityType: 'custom-interaction', label: 'Özel Etkileşim Oluştur' },
];

function findActivityCreatePreset(presetId) {
  return (
    ACTIVITY_CREATE_PRESETS.find((preset) => preset.id === presetId) ||
    ACTIVITY_CREATE_PRESETS.find((preset) => preset.id === DEFAULT_ACTIVITY_CREATE_PRESET_ID) ||
    ACTIVITY_CREATE_PRESETS[0]
  );
}

function patchCurrentSlide(activity = {}, patch = {}) {
  const slides = Array.isArray(activity.slides)
    ? activity.slides.map((slide) =>
        slide.id === activity.currentSlideId ? { ...slide, ...patch } : slide
      )
    : activity.slides;
  return { ...activity, ...patch, slides };
}

function applyActivityCreatePreset(activity = {}, preset = {}, customTemplate = null) {
  if (preset.id === 'true-false') {
    return patchCurrentSlide(activity, {
      mcQuestion: activity.mcQuestion || 'Aşağıdaki ifadenin doğruluğunu seçiniz.',
      mcMode: 'single',
      mcOptions: [
        { id: uid(), label: 'Doğru', isCorrect: true },
        { id: uid(), label: 'Yanlış', isCorrect: false },
      ],
    });
  }

  if (preset.activityType === 'custom-interaction') {
    const template = customTemplate || CUSTOM_INTERACTION_TEMPLATES[0];
    if (template?.id === 'dice-animation') {
      return generateDiceBirdDemoTemplate(activity);
    }
    return {
      ...activity,
      customInteraction: {
        templateId: template?.id || DEFAULT_CUSTOM_INTERACTION_TEMPLATE_ID,
        templateName: template?.label || 'Boş Özel Etkileşim',
        widgets: [],
        settings: {
          zipImportReady: false,
          runtimeReady: false,
        },
        events: [],
        commands: [],
        variables: [],
        triggers: [],
        test: {
          status: 'not-run',
        },
      },
    };
  }

  return activity;
}

function applyBookDefaultsToActivity(activity = {}, selectedBook = null) {
  const buttonPackageId =
    selectedBook?.buttonPackageId || activity.buttonPackageId || BUTTON_PACKAGES[0]?.id || '';
  const buttonPackage =
    BUTTON_PACKAGES.find((pkg) => pkg.id === buttonPackageId) || BUTTON_PACKAGES[0] || {};
  const answerLayerStylePresetId =
    selectedBook?.defaultAnswerLayerStylePresetId ||
    activity.answerLayerStylePresetId ||
    ANSWER_LAYER_STYLE_PRESETS[0]?.id ||
    '';
  const motion =
    getButtonPackageMotion(buttonPackageId) ||
    getButtonPackageMotion(buttonPackage?.id) ||
    null;
  const activityWithDefaults = {
    ...activity,
    buttonPackageId,
    answerLayerStylePresetId,
  };
  const scaffoldedActivity = ensureStandardActivityScaffold(activityWithDefaults, {
    select: SCENE_TEMPLATE_LAUNCH_PAGE_ID,
  });
  const slides = getActivitySlides(scaffoldedActivity);
  const currentSlideId = scaffoldedActivity.currentSlideId || slides[0]?.id || '';
  const nextSlides = slides.map((slide, index) => {
    const layers = getActivityLayers(slide);
    const resolvedNames = buildResolvedLayerNameMap(layers, slide);
    const buttonObjects = restyleAllButtonsForPackage(slide.objects || [], buttonPackageId).map(
      (object) => (object?.type === 'button' && motion ? { ...object, buttonMotion: { ...motion } } : object)
    );
    const objects = restyleAnswerLayerObjectsForPreset(
      buttonObjects,
      layers,
      resolvedNames,
      answerLayerStylePresetId
    );
    return normalizeSlide({ ...slide, answerLayerStylePresetId, objects }, index);
  });
  return selectActivitySlide(
    {
      ...scaffoldedActivity,
      buttonPackageId: buttonPackage?.id || buttonPackageId,
      buttonAnimationProfileId:
        scaffoldedActivity.buttonAnimationProfileId ||
        buttonPackage?.animationProfileId ||
        'calmLift',
      answerLayerStylePresetId,
      slides: nextSlides,
      currentSlideId,
      startSlideId: nextSlides[0]?.id || scaffoldedActivity.startSlideId || '',
    },
    currentSlideId
  );
}

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
      title: 'SVG zemin yükle',
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
      label: 'Şekil',
      title: 'Şekil ekle',
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
      label: 'Akış',
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
      label: 'Düzen',
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
  activeStep = 2,
}) {
  void badge;
  void compact;
  void stats;
  void guidance;
  const steps = [
    { id: 1, label: 'Giriş', note: 'Proje bilgileri' },
    { id: 2, label: 'Yayınevi', note: 'Yayınevi seç' },
    { id: 3, label: 'Kitap', note: 'Kitap seç' },
    { id: 4, label: 'Etkinlik', note: 'Etkinlik seç' },
  ];
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        height: '100%',
        background: '#f6f8fc',
        display: 'flex',
        flexDirection: 'column',
        overflow: allowOverflow ? 'auto' : 'hidden',
        color: '#101b33',
      }}
    >
      <div
        style={{
          height: 54,
          flexShrink: 0,
          background: 'linear-gradient(180deg,#07182a 0%,#06111f 100%)',
          borderBottom: '1px solid rgba(148,163,184,.24)',
          color: '#eef6ff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 18px',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 13, minWidth: 0 }}>
          <span
            style={{
              width: 31,
              height: 31,
              borderRadius: 9,
              border: '1px solid rgba(147,197,253,.44)',
              background: 'rgba(37,99,235,.22)',
              color: '#93c5fd',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              fontWeight: 950,
            }}
          >
            ▣
          </span>
          <span
            style={{
              fontSize: 14,
              fontWeight: 950,
              letterSpacing: 0.2,
              whiteSpace: 'nowrap',
            }}
          >
            E-İÇERİK EDİTÖRÜ
          </span>
          <span style={{ width: 1, height: 24, background: 'rgba(226,232,240,.22)' }} />
          <span
            style={{
              color: 'rgba(226,232,240,.72)',
              fontSize: 11,
              fontWeight: 760,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            Kütüphane
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ color: '#22c55e', fontSize: 11, fontWeight: 900 }}>✓ Kaydedildi</span>
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: 999,
              background: '#7c3aed',
              color: '#fff',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 900,
            }}
          >
            K
          </span>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: allowOverflow ? 'auto' : 'hidden',
          padding: 18,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div
          style={{
            border: '1px solid #dbe6f3',
            borderRadius: 16,
            background: '#ffffff',
            minHeight: 82,
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0,1fr))',
            alignItems: 'center',
            padding: '12px 22px',
            boxSizing: 'border-box',
            gap: 16,
          }}
        >
          {steps.map((step, index) => {
            const active = activeStep === step.id;
            const done = activeStep > step.id;
            return (
              <div
                key={step.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '34px minmax(0,1fr)',
                  gap: 9,
                  alignItems: 'center',
                  position: 'relative',
                }}
              >
                {index > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      left: -16,
                      right: 'calc(100% + 8px)',
                      top: 17,
                      height: 1,
                      background: done || active ? '#93c5fd' : '#d8e2ef',
                    }}
                  />
                )}
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 999,
                    border: `1px solid ${active || done ? '#2563eb' : '#cbd5e1'}`,
                    background: active ? '#2563eb' : done ? '#eff6ff' : '#ffffff',
                    color: active ? '#ffffff' : done ? '#2563eb' : '#64748b',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 950,
                  }}
                >
                  {done ? '✓' : step.id}
                </span>
                <span style={{ minWidth: 0 }}>
                  <span
                    style={{
                      display: 'block',
                      color: active ? '#0f5bff' : '#172033',
                      fontSize: 12,
                      fontWeight: 900,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {step.label}
                  </span>
                  <span
                    style={{
                      display: 'block',
                      color: '#64748b',
                      fontSize: 10.5,
                      fontWeight: 650,
                      marginTop: 2,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {step.note}
                  </span>
                </span>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              style={{
                border: 'none',
                background: 'transparent',
                color: '#2563eb',
                cursor: 'pointer',
                fontSize: 11.5,
                fontWeight: 850,
                padding: 0,
              }}
            >
              ← Geri dön
            </button>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 21, fontWeight: 950, color: '#172033', lineHeight: 1.1 }}>
              {title}
            </div>
            {subtitle ? (
              <div style={{ color: '#64748b', fontSize: 12, fontWeight: 650, marginTop: 5 }}>
                {subtitle}
              </div>
            ) : null}
          </div>
        </div>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            border: '1px solid rgba(191,212,234,.86)',
            borderRadius: 14,
            background: '#ffffff',
            boxShadow: '0 2px 8px rgba(15,23,42,.08)',
            padding: 16,
            boxSizing: 'border-box',
            overflow: 'hidden',
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
    <div style={{ height: fillHeight ? '100%' : 'auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(260px, 1fr) auto',
          gap: 10,
          marginBottom: 12,
          alignItems: 'center',
        }}
      >
        <div
          style={{
            borderRadius: 8,
            border: '1px solid #d8e2ef',
            background: '#ffffff',
            padding: '0 10px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            minWidth: 0,
            height: 40,
          }}
        >
          <span
            style={{
              width: 20,
              height: 20,
              borderRadius: 6,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748b',
              fontSize: 14,
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
              height: 38,
              borderRadius: 0,
              border: 'none',
              background: '#ffffff',
              color: EDITOR_THEME.lightText,
              fontSize: 12,
              padding: 0,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'stretch',
            justifyContent: 'flex-end',
            gap: 8,
            flexWrap: 'wrap',
            minWidth: 0,
          }}
        >
          {toolbarExtras}
          <button
            onClick={onAdd}
            style={{
              minWidth: 150,
              height: 40,
              borderRadius: 8,
              border: '1px solid #1d4ed8',
              background: '#2563eb',
              color: '#ffffff',
              fontSize: 12,
              fontWeight: 900,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
            }}
          >
            <span
              style={{
                width: 18,
                height: 18,
                borderRadius: 6,
                background: 'rgba(255,255,255,.16)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
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
          border: 'none',
          borderRadius: 0,
          padding: 0,
          overflowY: 'auto',
          background: 'transparent',
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

  const gradients = [
    ['#10b981', '#0ea5e9'],
    ['#f59e0b', '#ef4444'],
    ['#8b5cf6', '#ec4899'],
    ['#2563eb', '#06b6d4'],
    ['#14b8a6', '#84cc16'],
  ];
  const typeLabels = Object.fromEntries(ACTIVITY_TYPES.map((type) => [type.id, type.label]));

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))',
        gap: 12,
      }}
    >
      {items.map((item, index) => {
        const [start, end] = gradients[index % gradients.length];
        const isSelected = selectedId === item.id;
        const initial = (item.name || '?').trim().charAt(0).toUpperCase() || '?';
        const itemKind = item.bookId ? 'Etkinlik' : item.publisherId ? 'Kitap' : 'Yayınevi';
        const activitySummary = item.bookId ? getActivityProgressSummary(item) : null;
        const isBook = !!item.publisherId && !item.bookId;
        const isActivity = !!item.bookId;
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
        const metaLine = isActivity
          ? `${item.subject || item.lesson || 'Etkinlik'} · ${item.grade || item.gradeLevel || ''}`.replace(/ · $/, '')
          : isBook
            ? `${item.grade || item.gradeLevel || 'Ders kitabı'}`
            : item.description || 'Yayınevi kütüphanesi';
        const primaryMetric = isActivity
          ? `${slideCount || 1} slide`
          : isBook
            ? `${items.filter((activity) => activity.bookId === item.id).length || ''}`.trim()
            : '';
        return (
          <div key={item.id} style={{ position: 'relative' }}>
            <button
              onClick={() => onSelect(item.id)}
              style={{
                width: '100%',
                minHeight: isActivity ? 154 : 132,
                border: `1px solid ${isSelected ? '#2563eb' : '#dbe6f3'}`,
                borderRadius: 12,
                background: isSelected ? '#f8fbff' : '#ffffff',
                cursor: 'pointer',
                padding: 14,
                textAlign: 'left',
                boxShadow: isSelected ? '0 0 0 2px rgba(37,99,235,.10)' : '0 2px 7px rgba(15,23,42,.05)',
                transition: 'border-color .14s, box-shadow .14s, transform .14s',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: isActivity || isBook ? '112px minmax(0,1fr)' : '72px minmax(0,1fr)',
                  gap: 14,
                  alignItems: 'center',
                }}
              >
                <div
                  style={{
                    width: isActivity || isBook ? 112 : 72,
                    height: isActivity ? 96 : isBook ? 108 : 72,
                    borderRadius: isActivity ? 10 : 14,
                    border: '1px solid #dbe6f3',
                    background: `linear-gradient(90deg,${start},${end})`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    overflow: 'hidden',
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      width: isActivity ? 58 : isBook ? 64 : 42,
                      height: isActivity ? 58 : isBook ? 64 : 42,
                      borderRadius: isActivity ? 18 : 999,
                      background: 'rgba(255,255,255,.18)',
                      border: '1px solid rgba(255,255,255,.36)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                      fontSize: isActivity ? 28 : 22,
                      fontWeight: 950,
                    }}
                  >
                    {initial}
                  </div>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      marginBottom: 7,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 900,
                        color: '#2563eb',
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        borderRadius: 999,
                        padding: '3px 7px',
                      }}
                    >
                      {itemKind}
                    </span>
                    {statusMeta && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 900,
                          color: statusMeta.color,
                          background: statusMeta.bg,
                          border: `1px solid ${statusMeta.border}`,
                          borderRadius: 999,
                          padding: '3px 7px',
                        }}
                      >
                        {statusMeta.label}
                      </span>
                    )}
                    {isActivity && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 850,
                          color: '#64748b',
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: 999,
                          padding: '3px 7px',
                        }}
                      >
                        {typeLabels[item.type] || item.type || 'Etkinlik'}
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      color: '#172033',
                      fontSize: isActivity ? 14 : 15,
                      fontWeight: 950,
                      lineHeight: 1.25,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.name}
                  </div>
                  <div
                    style={{
                      color: '#64748b',
                      fontSize: 11.5,
                      fontWeight: 700,
                      marginTop: 6,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {metaLine}
                  </div>
                  <div
                    style={{
                      marginTop: 11,
                      display: 'flex',
                      gap: 7,
                      alignItems: 'center',
                      flexWrap: 'wrap',
                    }}
                  >
                    {itemKind === 'Yayınevi' && (
                      <>
                        <span style={libraryMetricStyle}>Kitap</span>
                        <span style={libraryMetricStyle}>Etkinlik</span>
                      </>
                    )}
                    {isBook && (
                      <>
                        <span style={libraryMetricStyle}>Kitap</span>
                        {primaryMetric && <span style={libraryMetricStyle}>{primaryMetric} etkinlik</span>}
                      </>
                    )}
                    {isActivity && (
                      <>
                        <span style={libraryMetricStyle}>{slideCount || 1} slide</span>
                        <span style={libraryMetricStyle}>{objectCount} nesne</span>
                        <span style={libraryMetricStyle}>{quality}% hazır</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </button>
            <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 5 }}>
              <button
                title="Düzenle"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(item);
                }}
                style={libraryIconButtonStyle}
              >
                ✎
              </button>
              <button
                title="Sil"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(item.id);
                }}
                style={{ ...libraryIconButtonStyle, color: '#dc2626', borderColor: '#fecaca' }}
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

const libraryMetricStyle = {
  color: '#475569',
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: 999,
  padding: '4px 7px',
  fontSize: 10.5,
  fontWeight: 820,
};

const libraryIconButtonStyle = {
  width: 26,
  height: 26,
  borderRadius: 8,
  border: '1px solid #dbe6f3',
  background: 'rgba(255,255,255,.94)',
  color: '#64748b',
  cursor: 'pointer',
  fontSize: 11,
  fontWeight: 900,
  boxShadow: '0 2px 7px rgba(15,23,42,.08)',
};

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
              minWidth: 126,
              height: 40,
              borderRadius: 8,
              border: '1px solid #bfdbfe',
              background: '#ffffff',
              color: '#075985',
              fontSize: 12,
              fontWeight: 900,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
            }}
            title="Tam ekran PDF düzenleme stüdyosunu aç"
          >
            <span
              style={{
                width: 18,
                height: 18,
                borderRadius: 6,
                background: 'rgba(14,165,233,.14)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#0284c7',
                fontSize: 10,
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
  const [newPresetId, setNewPresetId] = useState(DEFAULT_ACTIVITY_CREATE_PRESET_ID);
  const [customTemplateId, setCustomTemplateId] = useState(DEFAULT_CUSTOM_INTERACTION_TEMPLATE_ID);
  const [search, setSearch] = useState('');
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');
  const [pdfStudioOpen, setPdfStudioOpen] = useState(false);
  const filtered = activities.filter((a) => a.bookId === selBookId);
  const searched = filtered.filter((a) =>
    (a.name || '').toLowerCase().includes(search.trim().toLowerCase())
  );
  const selectedBook = books.find((book) => book.id === selBookId) || null;
  const selectedCreatePreset = findActivityCreatePreset(newPresetId);
  const selectedCustomTemplate =
    CUSTOM_INTERACTION_TEMPLATES.find((item) => item.id === customTemplateId) ||
    CUSTOM_INTERACTION_TEMPLATES[0];
  const resetAddModal = () => {
    setShowModal(false);
    setNewName('');
    setNewPresetId(DEFAULT_ACTIVITY_CREATE_PRESET_ID);
    setCustomTemplateId(DEFAULT_CUSTOM_INTERACTION_TEMPLATE_ID);
  };
  const add = () => {
    if (!newName.trim()) return;
    const activityType = selectedCreatePreset?.activityType || 'selection';
    const created = createActivity(newName.trim(), activityType);
    const withBookDefaults = applyBookDefaultsToActivity(created, selectedBook);
    const a = applyActivityCreatePreset(
      withBookDefaults,
      selectedCreatePreset,
      selectedCustomTemplate
    );
    a.bookId = selBookId;
    onChange([...activities, a]);
    onSelect(a.id);
    resetAddModal();
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
        Kitap seçin
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
              minWidth: 126,
              height: 40,
              borderRadius: 8,
              border: '1px solid #bfdbfe',
              background: '#ffffff',
              color: '#075985',
              fontSize: 12,
              fontWeight: 900,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
            }}
            title="Tam ekran PDF düzenleme stüdyosunu aç"
          >
            <span
              style={{
                width: 18,
                height: 18,
                borderRadius: 6,
                background: 'rgba(14,165,233,.14)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#0284c7',
                fontSize: 10,
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
        <Modal title="Yeni Etkinlik" onClose={resetAddModal} width={760}>
          <div className="eic-modal-stack">
            <Inp
              label="Etkinlik Adı"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Etkinlik adı..."
            />

            <div className="eic-activity-create-section">
              <div className="eic-activity-create-header">
                <span>Standart Etkinlikler</span>
                <span>Mevcut motorlarla oluşturulur</span>
              </div>
              <div className="eic-activity-create-grid">
                {STANDARD_ACTIVITY_CREATE_PRESETS.map((preset) => {
                  const active = newPresetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      className={`eic-activity-preset-card${active ? ' is-active' : ''}`}
                      onClick={() => setNewPresetId(preset.id)}
                      aria-pressed={active}
                    >
                      <span className="eic-activity-preset-icon">{preset.icon}</span>
                      <span className="eic-activity-preset-copy">
                        <span className="eic-activity-preset-title">{preset.label}</span>
                        <span className="eic-activity-preset-desc">{preset.desc}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="eic-activity-create-section">
              <div className="eic-activity-create-header">
                <span>Diğer Mevcut Etkinlikler</span>
                <span>Önceki akışlarla uyumlu</span>
              </div>
              <div className="eic-activity-create-grid eic-activity-create-grid--compact">
                {OTHER_ACTIVITY_CREATE_PRESETS.map((preset) => {
                  const active = newPresetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      className={`eic-activity-preset-card${active ? ' is-active' : ''}`}
                      onClick={() => setNewPresetId(preset.id)}
                      aria-pressed={active}
                    >
                      <span className="eic-activity-preset-icon">{preset.icon}</span>
                      <span className="eic-activity-preset-copy">
                        <span className="eic-activity-preset-title">{preset.label}</span>
                        <span className="eic-activity-preset-desc">{preset.desc}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="eic-activity-create-section">
              <div className="eic-activity-create-header">
                <span>Özel Etkileşimler</span>
                <span>Önizleme hazırlığı yok, UI iskeleti</span>
              </div>
              <button
                type="button"
                className={`eic-activity-preset-card eic-activity-preset-card--wide${
                  newPresetId === 'custom-interaction' ? ' is-active' : ''
                }`}
                onClick={() => setNewPresetId('custom-interaction')}
                aria-pressed={newPresetId === 'custom-interaction'}
              >
                <span className="eic-activity-preset-icon">✦</span>
                <span className="eic-activity-preset-copy">
                  <span className="eic-activity-preset-title">Özel Etkileşim Oluştur</span>
                  <span className="eic-activity-preset-desc">
                    Widget tabanlı yeni etkileşim ekranına hazırlık
                  </span>
                </span>
              </button>

              {newPresetId === 'custom-interaction' && (
                <div className="eic-custom-create-shell">
                  <div className="eic-custom-create-title">Hazır Etkileşimler</div>
                  <div className="eic-custom-template-grid">
                    {CUSTOM_INTERACTION_TEMPLATES.map((template) => {
                      const active = customTemplateId === template.id;
                      return (
                        <button
                          key={template.id}
                          type="button"
                          className={`eic-custom-template-card${active ? ' is-active' : ''}`}
                          onClick={() => setCustomTemplateId(template.id)}
                          aria-pressed={active}
                        >
                          <span>{template.icon}</span>
                          <strong>{template.label}</strong>
                          <small>{template.desc}</small>
                        </button>
                      );
                    })}
                  </div>
                  <div className="eic-custom-create-title">Yeni Etkileşim</div>
                  <button type="button" className="eic-zip-placeholder-button" disabled>
                    + ZIP ile Yeni Özel Etkileşim Yükle
                  </button>
                </div>
              )}
            </div>

            <div className="eic-actions-row">
              <Btn onClick={resetAddModal} color="#555">
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
          <div className="eic-modal-stack">
            <Inp
              label="Etkinlik Adı"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Etkinlik adı..."
            />
            <div className="eic-actions-row">
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
