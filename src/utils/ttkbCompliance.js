import { BUTTON_PACKAGES, BUTTON_PACKAGE_MOTION_PRESETS } from '../constants';

const SAFE_ICONS = {
  correct: '✓',
  incorrect: '×',
  warning: '!',
  solution: '✎',
  menu: '☰',
  home: '⌂',
  restart: '↻',
};

const DEFAULT_BUTTON_MOTION = BUTTON_PACKAGE_MOTION_PRESETS.calmLift || {
  hoverScale: 1.01,
  pressScale: 0.99,
  liftY: 1,
  hoverFilter: 'brightness(1.02)',
  hoverShadow: '0 10px 18px rgba(15,23,42,.14)',
  duration: 150,
  easing: 'ease-out',
};

function parseCssColorSamples(value = '') {
  const raw = String(value || '');
  const samples = [];
  raw.replace(/#([0-9a-f]{3}|[0-9a-f]{6})\b/gi, (match, hexValue) => {
    const full =
      hexValue.length === 3
        ? hexValue
            .split('')
            .map((char) => char + char)
            .join('')
        : hexValue;
    const intValue = parseInt(full, 16);
    samples.push([(intValue >> 16) & 255, (intValue >> 8) & 255, intValue & 255]);
    return match;
  });
  raw.replace(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/gi, (match, r, g, b) => {
    samples.push([Number(r), Number(g), Number(b)]);
    return match;
  });
  return samples.filter(([r, g, b]) => [r, g, b].every((channel) => Number.isFinite(channel)));
}

function relativeLuminance([r, g, b] = [255, 255, 255]) {
  const channel = (value) => {
    const normalized = Math.max(0, Math.min(255, value)) / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(first = [255, 255, 255], second = [0, 0, 0]) {
  const a = relativeLuminance(first);
  const b = relativeLuminance(second);
  const light = Math.max(a, b);
  const dark = Math.min(a, b);
  return (light + 0.05) / (dark + 0.05);
}

function readableTextColorForBackground(background = '', preferred = '') {
  const samples = parseCssColorSamples(background);
  if (!samples.length) return preferred || '#0f172a';
  const averageLum =
    samples.reduce((sum, item) => sum + relativeLuminance(item), 0) / samples.length;
  const backgroundSample = samples.reduce((selected, item) => {
    const selectedLum = relativeLuminance(selected);
    const itemLum = relativeLuminance(item);
    return averageLum < 0.35
      ? itemLum < selectedLum
        ? item
        : selected
      : itemLum > selectedLum
        ? item
        : selected;
  }, samples[0]);
  const preferredSample = parseCssColorSamples(preferred)[0];
  if (preferredSample && contrastRatio(backgroundSample, preferredSample) >= 4.5) return preferred;
  return contrastRatio(backgroundSample, [255, 255, 255]) >=
    contrastRatio(backgroundSample, [15, 23, 42])
    ? '#ffffff'
    : '#0f172a';
}

function hasVisibleBackground(background = '') {
  const raw = String(background || '')
    .trim()
    .toLowerCase();
  return !!raw && raw !== 'transparent' && raw !== 'none' && !raw.includes('rgba(0,0,0,0)');
}

function isFullStageDimShape(object = {}, activity = {}) {
  if (object.type !== 'shape' || (object.layerId || 'base') === 'base') return false;
  const x = Number(object.x) || 0;
  const y = Number(object.y) || 0;
  const width = Number(object.width) || 0;
  const height = Number(object.height) || 0;
  const stageWidth = Number(activity.stageWidth || 1920) || 1920;
  const stageHeight = Number(activity.stageHeight || 1080) || 1080;
  return x <= 2 && y <= 2 && width >= stageWidth - 4 && height >= stageHeight - 4;
}

function isPopupPanelShape(object = {}) {
  if (object.type !== 'shape' || (object.shapeKind || 'roundedRect') !== 'roundedRect')
    return false;
  if ((object.layerId || 'base') === 'base') return false;
  return Number(object.width || 0) >= 220 && Number(object.height || 0) >= 55;
}

function solidifyReadablePanelStyle(style = {}) {
  const background = String(style.background || '');
  if (!hasVisibleBackground(background)) return style;
  return {
    ...style,
    background: background
      .replace(/rgba\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,]+)\s*,\s*[^)]+\)/gi, 'rgba($1,$2,$3,.98)')
      .replace(/rgb\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^)]+)\)/gi, 'rgba($1,$2,$3,.98)'),
    opacity: 1,
  };
}

export function ensureTtkbReadableStyle(style = {}, { force = false } = {}) {
  if (!force && !hasVisibleBackground(style.background)) return style;
  const color = readableTextColorForBackground(style.background, style.color);
  return {
    ...style,
    color,
    textShadow:
      color === '#ffffff'
        ? style.textShadow || '0 1px 0 rgba(0,0,0,.34)'
        : style.textShadow || '0 1px 0 rgba(255,255,255,.72)',
  };
}

function normalizeKey(value = '') {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '');
}

function getSemanticIconForButton(object = {}) {
  const action = String(object.runtimeAction || object.sceneTemplateDemoAction || '').toLowerCase();
  const key = normalizeKey(object.label || object.text || object.content || '');
  if (
    action.includes('show-answer') ||
    action.includes('answer') ||
    key.includes('cozum') ||
    key.includes('cevap')
  )
    return SAFE_ICONS.solution;
  if (
    action.includes('restart') ||
    key.includes('yenidenbaslat') ||
    key.includes('tekrarla') ||
    key.includes('retry')
  )
    return SAFE_ICONS.restart;
  if (action.includes('home') || key.includes('anasayfa')) return SAFE_ICONS.home;
  if (action.includes('menu') || action.includes('help') || key.includes('menu'))
    return SAFE_ICONS.menu;
  if (
    action.includes('complete') ||
    key.includes('tamamla') ||
    key.includes('kontrolet') ||
    key.includes('check')
  )
    return SAFE_ICONS.correct;
  if (key === 'x' || key.includes('kapat') || key.includes('close')) return SAFE_ICONS.incorrect;
  return '';
}

function normalizeButtonLabelIcon(object = {}) {
  const slotId = String(object.sceneTemplateSlotId || '');
  const isPairedLabel =
    slotId.endsWith('-label') || String(object.soundIconMode || '') === 'external';
  if (isPairedLabel) {
    const label = String(object.label || object.text || '');
    const stripped = label.replace(/^[✓×!✎☰⌂↻✔✕✖↺⟳⟲\s]+/u, '').trim() || label.trim();
    return { ...object, label: stripped, text: object.text ? stripped : object.text };
  }
  const icon = getSemanticIconForButton(object);
  if (!icon) return object;
  const label = String(object.label || object.text || '');
  if (!label || label.trim().startsWith(icon)) return object;
  if (icon === SAFE_ICONS.incorrect && ['x', 'X', '×', '✕', '✖'].includes(label.trim())) {
    return { ...object, label: SAFE_ICONS.incorrect, text: SAFE_ICONS.incorrect };
  }
  const stripped = label.replace(/^[✓×!✎☰⌂↻✔✕✖↺⟳⟲\s]+/u, '').trim() || label.trim();
  return {
    ...object,
    label: `${icon} ${stripped}`,
    text: object.text ? `${icon} ${stripped}` : object.text,
  };
}

function getActivityButtonMotion(activity = {}) {
  const profileId = activity.buttonAnimationProfileId;
  if (profileId && BUTTON_PACKAGE_MOTION_PRESETS[profileId])
    return BUTTON_PACKAGE_MOTION_PRESETS[profileId];
  const pkg =
    BUTTON_PACKAGES.find((item) => item.id === activity.buttonPackageId) ||
    BUTTON_PACKAGES[0] ||
    {};
  return pkg.buttonMotion || DEFAULT_BUTTON_MOTION;
}

export function enforceTtkbObjectCompliance(object = {}, activity = {}) {
  if (!object || typeof object !== 'object') return object;
  const style = { ...(object.style || {}) };

  if (object.type === 'button') {
    const motion = getActivityButtonMotion(activity);
    const withIcon = normalizeButtonLabelIcon(object);
    const slotId = String(withIcon.sceneTemplateSlotId || '');
    const isMuteIcon =
      withIcon.sceneTemplateDemoAction === 'toggle-mute' && slotId.endsWith('-icon');
    return {
      ...withIcon,
      ...(isMuteIcon ? { soundIconMode: 'icon-only' } : {}),
      buttonMotion: { ...motion },
      style: ensureTtkbReadableStyle(style, { force: true }),
    };
  }

  if (isFullStageDimShape(object, activity)) {
    const alpha = Math.min(
      0.12,
      Math.max(0.05, Number(activity.answerLayerDimOpacity ?? 0.07) || 0.07)
    );
    return {
      ...object,
      style: {
        ...style,
        background: `rgba(15,23,42,${alpha})`,
        borderWidth: 0,
        boxShadow: 'none',
        opacity: 1,
      },
    };
  }

  if (object.generatedBy === 'answer-template' || isPopupPanelShape(object)) {
    return {
      ...object,
      style: solidifyReadablePanelStyle(style),
    };
  }

  if (
    (object.type === 'text' || object.type === 'shape') &&
    hasVisibleBackground(style.background)
  ) {
    return {
      ...object,
      style: ensureTtkbReadableStyle(style),
    };
  }

  return object;
}

export function enforceTtkbActivityCompliance(activity = {}) {
  const applyObjects = (objects = []) =>
    objects.map((object) => enforceTtkbObjectCompliance(object, activity));
  const slides = Array.isArray(activity.slides)
    ? activity.slides.map((slide) => ({ ...slide, objects: applyObjects(slide.objects || []) }))
    : activity.slides;
  return {
    ...activity,
    lmsConfig: activity.lmsConfig
      ? { ...activity.lmsConfig, standard: 'scorm12' }
      : activity.lmsConfig,
    settings: activity.settings
      ? {
          ...activity.settings,
          showButtonPackageIntro: activity.settings.showButtonPackageIntro !== false,
        }
      : activity.settings,
    objects: applyObjects(activity.objects || []),
    slides,
  };
}

export function enforceTtkbEditorState(state = {}) {
  return {
    ...state,
    lmsConfig: state.lmsConfig ? { ...state.lmsConfig, standard: 'scorm12' } : state.lmsConfig,
    activities: Array.isArray(state.activities)
      ? state.activities.map(enforceTtkbActivityCompliance)
      : [],
  };
}

export function auditTtkbEditorState(state = {}) {
  const issues = [];
  (state.activities || []).forEach((activity, activityIndex) => {
    const objects = [
      ...(activity.objects || []),
      ...(activity.slides || []).flatMap((slide) => slide.objects || []),
    ];
    objects.forEach((object) => {
      if (object?.type !== 'button') return;
      const style = object.style || {};
      const bg = parseCssColorSamples(style.background);
      const fg = parseCssColorSamples(style.color);
      if (bg.length && fg.length) {
        const avg = bg.reduce((sum, item) => sum + relativeLuminance(item), 0) / bg.length;
        const sample = bg.reduce(
          (selected, item) =>
            Math.abs(relativeLuminance(item) - avg) < Math.abs(relativeLuminance(selected) - avg)
              ? item
              : selected,
          bg[0]
        );
        if (contrastRatio(sample, fg[0]) < 4.5) {
          issues.push(
            `Aktivite ${activityIndex + 1}: "${object.label || object.id || 'buton'}" kontrast riski.`
          );
        }
      }
    });
  });
  return { ok: issues.length === 0, issues };
}
