import { BUTTON_PACKAGES, BUTTON_PACKAGE_MOTION_PRESETS } from '../constants';
import {
  commitMaterializedActivity,
  getActivitySlides,
  selectActivitySlide,
  getActivityLayers,
} from '../logic/activityHelpers';
import {
  getButtonMotionProfile,
  getButtonPackageMotion,
  restyleAllButtonsForPackage,
} from '../logic/buttonStyling';
import { normalizeSlide } from '../logic/slideNormalization';
import {
  syncTimelineWithObjects,
  getActivityTimeline,
} from '../logic/timeline';

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

export function parseCssColorSamples(value = '') {
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

export function relativeLuminance([r, g, b] = [255, 255, 255]) {
  const channel = (value) => {
    const normalized = Math.max(0, Math.min(255, value)) / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(first = [255, 255, 255], second = [0, 0, 0]) {
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

export function ensureTtkbReadableStyle(style = {}, { force = false, fallbackBg = '#ffffff' } = {}) {
  const localBg = style.background;
  const hasBg = localBg && localBg !== 'transparent' && localBg !== 'none' && !localBg.includes('rgba(0,0,0,0)');
  if (!force && !hasBg) return style;

  const bgToUse = hasBg ? localBg : fallbackBg;
  const color = readableTextColorForBackground(bgToUse, style.color);
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

export function getSemanticIconForButton(object = {}) {
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
    key.includes('tekrar') ||
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
  if (key === 'x' || (key.includes('kapat') && !key.includes('ses')) || key.includes('close')) return SAFE_ICONS.incorrect;
  return '';
}

function isSeparateSemanticIconCompanion(object = {}, objects = []) {
  const icon = getSemanticIconForButton(object);
  if (!icon) return false;
  const objectLayerId = object.layerId || 'base';
  const objectTop = Number(object.y) || 0;
  const objectHeight = Math.max(1, Number(object.height) || 1);
  const objectLeft = Number(object.x) || 0;
  const objectRight = objectLeft + Math.max(1, Number(object.width) || 1);

  return objects.some((candidate) => {
    if (!candidate || candidate === object || candidate.id === object.id || candidate.type !== 'button')
      return false;
    if ((candidate.layerId || 'base') !== objectLayerId) return false;
    const candidateLabel = String(candidate.label || candidate.text || '').trim();
    if (candidateLabel !== icon) return false;

    if (
      (candidate.linkedActionTargetId && candidate.linkedActionTargetId === object.id) ||
      (object.linkedActionTargetId && object.linkedActionTargetId === candidate.id) ||
      (candidate.linkedHoverGroup &&
        object.linkedHoverGroup &&
        candidate.linkedHoverGroup === object.linkedHoverGroup)
    ) {
      return true;
    }

    const candidateTop = Number(candidate.y) || 0;
    const candidateHeight = Math.max(1, Number(candidate.height) || 1);
    const verticalOverlap =
      Math.min(objectTop + objectHeight, candidateTop + candidateHeight) -
      Math.max(objectTop, candidateTop);
    if (verticalOverlap < Math.min(objectHeight, candidateHeight) * 0.5) return false;
    const candidateLeft = Number(candidate.x) || 0;
    const candidateRight = candidateLeft + Math.max(1, Number(candidate.width) || 1);
    const horizontalGap =
      candidateRight <= objectLeft
        ? objectLeft - candidateRight
        : objectRight <= candidateLeft
          ? candidateLeft - objectRight
          : 0;
    return horizontalGap <= Math.max(36, Math.min(objectHeight, candidateHeight) * 1.5);
  });
}

export function hasTtkbSemanticIcon(object = {}, objects = []) {
  const icon = getSemanticIconForButton(object);
  if (!icon) return true;
  const label = String(object.label || object.text || '').trim();
  return label.startsWith(icon) || isSeparateSemanticIconCompanion(object, objects);
}

export function findTtkbMissingSemanticIconButtons(objects = []) {
  return objects.filter(
    (object) =>
      object?.type === 'button' &&
      !!getSemanticIconForButton(object) &&
      !hasTtkbSemanticIcon(object, objects)
  );
}

export function hasTtkbSingleLineButtonRisk(object = {}) {
  if (object?.type !== 'button') return false;
  const label = String(object.label || object.text || '').trim();
  if (label.length <= 22) return false;
  const fontSize = Math.max(10, Number(object.style?.fontSize || 16) || 16);
  const neededWidth = label.length * fontSize * 0.58 + 28;
  return (Number(object.width) || 0) < neededWidth;
}

function fitSingleLineButton(object = {}, activity = {}) {
  if (!hasTtkbSingleLineButtonRisk(object)) return object;
  const label = String(object.label || object.text || '').trim();
  const style = { ...(object.style || {}) };
  const stageWidth = Math.max(320, Number(activity.stageWidth || 1920) || 1920);
  const maxWidth = Math.max(Number(object.width) || 1, stageWidth - (Number(object.x) || 0) - 16);
  const initialFontSize = Math.max(10, Number(style.fontSize || 16) || 16);
  const idealWidth = Math.ceil(label.length * initialFontSize * 0.58 + 28);
  const width = Math.min(maxWidth, Math.max(Number(object.width) || 1, idealWidth));
  const fontSize =
    idealWidth <= maxWidth
      ? initialFontSize
      : Math.max(10, Math.floor((maxWidth - 28) / Math.max(1, label.length * 0.58)));
  return {
    ...object,
    width,
    style: {
      ...style,
      fontSize,
      whiteSpace: 'nowrap',
    },
  };
}

function normalizeButtonLabelIcon(object = {}, peerObjects = []) {
  const slotId = String(object.sceneTemplateSlotId || '');
  const isPairedLabel =
    slotId.endsWith('-label') ||
    String(object.soundIconMode || '') === 'external' ||
    isSeparateSemanticIconCompanion(object, peerObjects);
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

export function enforceTtkbObjectCompliance(object = {}, activity = {}, peerObjects = []) {
  if (!object || typeof object !== 'object') return object;
  const style = { ...(object.style || {}) };
  const fallbackBg = activity.backgroundColor || '#ffffff';

  if (object.type === 'button') {
    const motion = getActivityButtonMotion(activity);
    const withIcon = fitSingleLineButton(normalizeButtonLabelIcon(object, peerObjects), activity);
    const slotId = String(withIcon.sceneTemplateSlotId || '');
    const isMuteIcon =
      withIcon.sceneTemplateDemoAction === 'toggle-mute' && slotId.endsWith('-icon');
    return {
      ...withIcon,
      ...(isMuteIcon ? { soundIconMode: 'icon-only' } : {}),
      buttonMotion: { ...motion },
      style: ensureTtkbReadableStyle(withIcon.style || style, { force: true, fallbackBg }),
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

  if (object.type === 'text' || object.type === 'shape') {
    return {
      ...object,
      style: ensureTtkbReadableStyle(style, { force: true, fallbackBg }),
    };
  }

  return object;
}

export function enforceTtkbActivityCompliance(activity = {}) {
  const applyObjects = (objects = []) =>
    objects.map((object) => enforceTtkbObjectCompliance(object, activity, objects));
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
      if (hasTtkbSingleLineButtonRisk(object)) {
        issues.push(
          `Aktivite ${activityIndex + 1}: "${object.label || object.id || 'buton'}" tek satır riski.`
        );
      }
    });
    findTtkbMissingSemanticIconButtons(objects).forEach((object) => {
      issues.push(
        `Aktivite ${activityIndex + 1}: "${object.label || object.id || 'buton'}" semantik ikon riski.`
      );
    });
  });
  return { ok: issues.length === 0, issues };
}

export function restyleActivityButtonsForPackage(
  activity = {},
  pkgId = BUTTON_PACKAGES[0]?.id || 'pkg-1'
) {
  const committed = commitMaterializedActivity(activity);
  const motion =
    getActivityButtonMotion({ ...committed, buttonPackageId: pkgId }) ||
    getButtonPackageMotion(pkgId);
  const currentSlideId = committed.currentSlideId || committed.slides?.[0]?.id || '';
  const nextSlides = getActivitySlides(committed).map((slide, index) => {
    const nextObjects = restyleAllButtonsForPackage(slide.objects || [], pkgId).map((object) =>
      object?.type === 'button' && motion ? { ...object, buttonMotion: { ...motion } } : object
    );
    return normalizeSlide(
      {
        ...slide,
        objects: nextObjects,
        timeline: syncTimelineWithObjects({ ...slide, objects: nextObjects }),
      },
      index
    );
  });
  return selectActivitySlide(
    {
      ...committed,
      buttonPackageId: pkgId,
      buttonAnimationProfileId:
        committed.buttonAnimationProfileId ||
        BUTTON_PACKAGES.find((item) => item.id === pkgId)?.animationProfileId ||
        '',
      slides: nextSlides,
      startSlideId: nextSlides[0]?.id || committed.startSlideId || '',
      currentSlideId,
    },
    currentSlideId
  );
}

export function restyleActivityButtonMotion(activity = {}, profileId = '', normalizeActivityFn) {
  const motion = getButtonMotionProfile(profileId);
  if (!motion) {
    const nextAct = {
      ...activity,
      buttonAnimationProfileId: profileId || activity.buttonAnimationProfileId || '',
    };
    return typeof normalizeActivityFn === 'function' ? normalizeActivityFn(nextAct) : nextAct;
  }
  const committed = commitMaterializedActivity(activity);
  const currentSlideId = committed.currentSlideId || committed.slides?.[0]?.id || '';
  const nextSlides = getActivitySlides(committed).map((slide, index) => {
    const nextObjects = (slide.objects || []).map((object) =>
      object?.type === 'button' ? { ...object, buttonMotion: { ...motion } } : object
    );
    return normalizeSlide(
      {
        ...slide,
        objects: nextObjects,
        timeline: syncTimelineWithObjects({ ...slide, objects: nextObjects }),
      },
      index
    );
  });
  return selectActivitySlide(
    {
      ...committed,
      buttonAnimationProfileId: profileId,
      slides: nextSlides,
      currentSlideId,
      startSlideId: nextSlides[0]?.id || committed.startSlideId || '',
    },
    currentSlideId
  );
}

export function buildActivityQualityChecks(activity = {}) {
  const layers = getActivityLayers(activity);
  const layerIds = new Set(layers.map((layer) => layer.id));
  const objects = Array.isArray(activity.objects) ? activity.objects : [];
  const objectIds = new Set(objects.map((object) => object.id).filter(Boolean));
  const timeline = getActivityTimeline(activity);
  const triggers = Array.isArray(activity.triggers) ? activity.triggers : [];
  const orphanObjects = objects.filter((object) => !layerIds.has(object.layerId || 'base'));
  const invalidTriggerTargets = triggers.filter((trigger) => {
    const action = trigger?.action || '';
    const value = trigger?.value || '';
    if (action === 'KatmanaGec') return value && !layerIds.has(value);
    if (action === 'Goster' || action === 'Gizle' || action === 'NesneDurumuAyarla')
      return value && !objectIds.has(value);
    return false;
  });
  const hasScreenFlow =
    activity?.introScreen?.enabled !== false ||
    activity?.menuScreen?.enabled !== false ||
    activity?.buttonPackageScreen?.enabled !== false;
  const stageWidth = Number(activity.stageWidth || 0);
  const stageHeight = Number(activity.stageHeight || 0);

  return [
    {
      label: 'Katman',
      ok: orphanObjects.length === 0,
      detail: orphanObjects.length
        ? `${orphanObjects.length} nesne base katmana toparlanmali`
        : `${layers.length} katman baglantisi saglam`,
    },
    {
      label: 'Timeline',
      ok: objects.length === 0 || timeline.length >= objects.length,
      detail: objects.length
        ? `${timeline.length}/${objects.length} nesne zaman satirinda`
        : 'Sahnede nesne yok',
    },
    {
      label: 'Etkileşim',
      ok: invalidTriggerTargets.length === 0,
      detail: invalidTriggerTargets.length
        ? `${invalidTriggerTargets.length} tetikleyici hedefi eksik`
        : `${triggers.length} tetikleyici temiz`,
    },
    {
      label: 'Akış',
      ok: hasScreenFlow && stageWidth >= 320 && stageHeight >= 240,
      detail: hasScreenFlow
        ? `${Math.round(stageWidth)}x${Math.round(stageHeight)} sahne hazır`
        : 'Giriş/menü akışı kapalı',
    },
  ];
}

export function activityHasClosedCaptions(activity = {}) {
  return (activity?.objects || []).some(
    (obj) => obj?.type === 'video' && (obj.closedCaptions || []).some((cc) => cc?.src)
  );
}
