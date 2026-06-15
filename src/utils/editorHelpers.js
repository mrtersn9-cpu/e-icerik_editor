import { WORKFLOW_STATUS_META, SLIDE_MASTER_PRESETS } from '../constants';
import { sanitizePdfText } from '../pdfParser';

const INTERACTIVE_OBJECT_TYPES = new Set([
  'button',
  'draggable',
  'dropzone',
  'hotspot',
  'video',
  'audio',
]);

function getActivitySlides(activity = {}) {
  return Array.isArray(activity?.slides) && activity.slides.length ? activity.slides : [activity];
}

function getSlideObjects(slide = {}) {
  return Array.isArray(slide?.objects) ? slide.objects : [];
}

function hasInteractiveObjectSignal(object = {}) {
  return (
    INTERACTIVE_OBJECT_TYPES.has(object?.type) || !!object?.selectionQuestionId || !!object?.group
  );
}

function hasFlowScreens(activity = {}) {
  return (
    activity?.introScreen?.enabled !== false ||
    activity?.menuScreen?.enabled !== false ||
    activity?.buttonPackageScreen?.enabled !== false
  );
}

function hasInteractionPayload(activity = {}) {
  return (
    (Array.isArray(activity?.mcOptions) && activity.mcOptions.length > 0) ||
    (Array.isArray(activity?.selectionSlots) && activity.selectionSlots.length > 0) ||
    Object.keys(activity?.dragDropMatches || {}).length > 0
  );
}

function clampQuality(value) {
  return clamp(Math.round(value), 0, 100);
}

export function formatBookLockMessage(lock, fallback = '') {
  if (!lock) return fallback || 'Bu kitap su anda kilitli.';
  const owner = lock.userName || lock.userId || 'Baska bir kullanici';
  const time = lock.lockedAt ? new Date(lock.lockedAt).toLocaleString('tr-TR') : '';
  return `${owner} bu kitapta calisiyor.${time ? ` Kilit baslangici: ${time}.` : ''}`;
}

export function buildCanvasPreviewDataUrl(canvas, maxSide = 1280, quality = 0.82) {
  if (!canvas?.width || !canvas?.height) return '';
  const scale = Math.min(1, maxSide / Math.max(canvas.width, canvas.height));
  if (scale >= 0.999) {
    return canvas.toDataURL('image/jpeg', quality);
  }
  const previewCanvas = document.createElement('canvas');
  previewCanvas.width = Math.max(1, Math.round(canvas.width * scale));
  previewCanvas.height = Math.max(1, Math.round(canvas.height * scale));
  const previewContext = previewCanvas.getContext('2d', { alpha: false });
  if (!previewContext) {
    return canvas.toDataURL('image/jpeg', quality);
  }
  previewContext.fillStyle = '#ffffff';
  previewContext.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
  previewContext.drawImage(canvas, 0, 0, previewCanvas.width, previewCanvas.height);
  return previewCanvas.toDataURL('image/jpeg', quality);
}

export function normalizePdfHintRect(rect, maxWidth = 1920, maxHeight = 1080, minSize = 18) {
  if (!rect || typeof rect !== 'object') return null;
  const width = clamp(Number(rect.width || 0), minSize, maxWidth);
  const height = clamp(Number(rect.height || 0), minSize, maxHeight);
  const x = clamp(Number(rect.x || 0), 0, Math.max(0, maxWidth - width));
  const y = clamp(Number(rect.y || 0), 0, Math.max(0, maxHeight - height));
  return { x, y, width, height };
}

export function mergePdfTermLists(...lists) {
  return [
    ...new Set(
      lists
        .flatMap((list) => (Array.isArray(list) ? list : []))
        .map((item) => sanitizePdfText(item))
        .filter(Boolean)
    ),
  ];
}

export function sanitizeSvgMarkup(markup = '') {
  const raw = String(markup || '');
  if (!raw.trim()) return '';

  const sanitizeCssText = (cssText = '') =>
    String(cssText || '')
      .replace(/@import[\s\S]*?;/gi, '')
      .replace(/expression\s*\([^)]*\)/gi, '')
      .replace(/behavior\s*:[^;"}]+;?/gi, '')
      .replace(/url\s*\(\s*(['"]?)\s*(?:javascript:|vbscript:|data:text\/html)[^)]*\)/gi, '')
      // KESIN KURAL: SCORM ciktisina giren SVG/CSS hicbir dis kaynaktan cekemez.
      // url(http(s)://...), url(//...), url(ftp:/ws:...) gibi uzak referanslari notrlestir.
      .replace(/url\s*\(\s*(['"]?)\s*(?:https?:|ftps?:|wss?:)?\/\/[^)]*\)/gi, 'none');

  const cleanElement = (element) => {
    [
      ...element.querySelectorAll('script, foreignObject, iframe, object, embed, link, meta'),
    ].forEach((node) => node.remove());
    [...element.querySelectorAll('style')].forEach((node) => {
      const safeCss = sanitizeCssText(node.textContent);
      if (safeCss.trim()) node.textContent = safeCss;
      else node.remove();
    });
    [...element.querySelectorAll('*')].forEach((node) => {
      [...node.attributes].forEach((attribute) => {
        const name = attribute.name.toLowerCase();
        const value = String(attribute.value || '').trim();
        const uriValue = value.replace(/\s+/g, '').toLowerCase();
        const isEventHandler = name.startsWith('on');
        // KESIN KURAL: SCORM ciktisina giren SVG hicbir dis kaynaktan cekemez.
        // Yalnizca ic fragment (#...) ve gomulu data:image/ guvenli; http(s)://,
        // protokolsuz //, goreli ve diger semalar (javascript: dahil) kaldirilir.
        const isUnsafeUri =
          ['href', 'xlink:href', 'src'].includes(name) &&
          uriValue &&
          !uriValue.startsWith('#') &&
          !uriValue.startsWith('data:image/');
        if (name === 'style') {
          const safeStyle = sanitizeCssText(value);
          if (safeStyle.trim()) node.setAttribute(attribute.name, safeStyle);
          else node.removeAttribute(attribute.name);
          return;
        }
        if (isEventHandler || name === 'srcdoc' || isUnsafeUri) {
          node.removeAttribute(attribute.name);
        }
      });
    });
  };

  if (typeof DOMParser !== 'undefined' && typeof XMLSerializer !== 'undefined') {
    try {
      const doc = new DOMParser().parseFromString(raw, 'image/svg+xml');
      if (doc.querySelector('parsererror')) return '';
      cleanElement(doc);
      return new XMLSerializer().serializeToString(doc.documentElement || doc);
    } catch {
      return '';
    }
  }

  return raw
    .replace(
      /<\s*(script|foreignObject|iframe|object|embed|link|meta)\b[\s\S]*?<\s*\/\s*\1\s*>/gi,
      ''
    )
    .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (_, css = '') => {
      const safeCss = sanitizeCssText(css);
      return safeCss.trim() ? `<style>${safeCss}</style>` : '';
    })
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(
      /\s+(?:href|xlink:href|src)\s*=\s*(["'])\s*(?:javascript|vbscript|data:text\/html):[\s\S]*?\1/gi,
      ''
    )
    .replace(/\s+style\s*=\s*(["'])([\s\S]*?)\1/gi, (_, quote, css = '') => {
      const safeCss = sanitizeCssText(css);
      return safeCss.trim() ? ` style=${quote}${safeCss}${quote}` : '';
    });
}

export function resolveWorkflowStatusMeta(status = 'draft') {
  return WORKFLOW_STATUS_META[status] || WORKFLOW_STATUS_META.draft;
}

export function getSlideProgressSummary(slide = {}) {
  const objects = getSlideObjects(slide);
  const timelineCount = Array.isArray(slide?.timeline) ? slide.timeline.length : 0;
  const triggerCount = Array.isArray(slide?.triggers) ? slide.triggers.length : 0;
  const interactiveCount = objects.filter(hasInteractiveObjectSignal).length;
  const hasVisualBase =
    !!slide?.svgMarkup ||
    objects.some((object) => object?.isPdfBackground || object?.imageData) ||
    objects.length > 0;
  const hasIdentity = Boolean(String(slide?.sceneName || slide?.name || '').trim());
  const hasInteraction = interactiveCount > 0 || triggerCount > 0;
  const timelineReady = timelineCount > 0 || objects.length <= 1;
  const checks = [hasIdentity, hasVisualBase, hasInteraction, timelineReady];
  const readyChecks = checks.filter(Boolean).length;
  const quality = clampQuality((readyChecks / checks.length) * 100);

  let status = 'draft';
  if (quality >= 90) status = 'ready';
  else if (quality >= 65) status = 'review';
  else if (quality >= 25 || objects.length > 0) status = 'building';

  return {
    status,
    quality,
    objectCount: objects.length,
    timelineCount,
    triggerCount,
    interactiveCount,
    readyChecks,
    totalChecks: checks.length,
    hasIdentity,
    hasVisualBase,
  };
}

export function getActivityProgressSummary(activity = {}) {
  const slides = getActivitySlides(activity);
  const slideSummaries = slides.map(getSlideProgressSummary);
  const objectCount = slideSummaries.reduce((sum, slide) => sum + slide.objectCount, 0);
  const timelineCount = slideSummaries.reduce((sum, slide) => sum + slide.timelineCount, 0);
  const triggerCount = slideSummaries.reduce((sum, slide) => sum + slide.triggerCount, 0);
  const interactiveCount = slideSummaries.reduce((sum, slide) => sum + slide.interactiveCount, 0);
  const stageWidth = Number(activity?.stageWidth || slides[0]?.stageWidth || 0);
  const stageHeight = Number(activity?.stageHeight || slides[0]?.stageHeight || 0);
  const hasFlow = hasFlowScreens(activity);
  const hasInteraction =
    interactiveCount > 0 || triggerCount > 0 || hasInteractionPayload(activity);
  const stageReady = stageWidth >= 320 && stageHeight >= 240;
  const sceneCoverage =
    slideSummaries.length > 0 && slideSummaries.every((slide) => slide.hasVisualBase);
  const timelineReady = timelineCount > 0 || objectCount <= Math.max(1, slideSummaries.length);
  const checks = [
    slideSummaries.length > 0,
    stageReady,
    sceneCoverage,
    hasInteraction,
    timelineReady,
    hasFlow,
  ];
  const readyChecks = checks.filter(Boolean).length;
  const slideAverage = slideSummaries.length
    ? slideSummaries.reduce((sum, slide) => sum + slide.quality, 0) / slideSummaries.length
    : 0;
  const quality = clampQuality(slideAverage * 0.6 + (readyChecks / checks.length) * 40);

  let status = 'draft';
  if (activity?.autoBuildStatus === 'blocked' && readyChecks <= 2 && quality < 50) {
    status = 'blocked';
  } else if (
    (activity?.autoBuildStatus === 'ready' && quality >= 68) ||
    (quality >= 82 && readyChecks >= 5)
  ) {
    status = 'ready';
  } else if (activity?.autoBuildStatus === 'review' || quality >= 56 || readyChecks >= 4) {
    status = 'review';
  } else if (quality >= 24 || objectCount > 0 || slideSummaries.length > 1 || hasFlow) {
    status = 'building';
  }

  return {
    status,
    quality,
    slideCount: slideSummaries.length,
    objectCount,
    timelineCount,
    triggerCount,
    interactiveCount,
    readyChecks,
    totalChecks: checks.length,
    stageWidth,
    stageHeight,
    sourceLabel: activity?.autoBuildSource === 'pdf' ? 'PDF' : 'Editor',
  };
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// ─── Master Slide ──────────────────────────────────────────────────────────────

export function getMasterPreset(presetId) {
  return SLIDE_MASTER_PRESETS.find((p) => p.id === presetId) || null;
}

export function applyMasterPresetToActivity(activity, presetId) {
  const preset = getMasterPreset(presetId);
  if (!preset) return activity;
  return {
    ...activity,
    slideMasterId: presetId,
    backgroundColor: preset.background,
    masterTheme: { ...preset.theme },
  };
}

// Returns placeholder text-object descriptors for a given master layout.
// Caller must convert these to real objects using their own uid() / createObject().
export function buildMasterLayoutDescriptors(presetId, stageWidth = 1920, stageHeight = 1080) {
  const preset = getMasterPreset(presetId);
  if (!preset || !preset.layout || preset.layout.length === 0) return [];
  const theme = preset.theme || {};
  const pad = Math.round(stageWidth * 0.05);
  const contentW = stageWidth - pad * 2;

  const descriptors = {
    title: {
      role: 'title',
      type: 'text',
      x: pad,
      y: Math.round(stageHeight * 0.08),
      width: contentW,
      height: Math.round(stageHeight * 0.14),
      label: 'Başlık Metni',
      style: {
        fontSize: Math.round(stageHeight * 0.065),
        fontWeight: 800,
        color: theme.headingColor || '#1e293b',
        textAlign: 'center',
        background: 'transparent',
        borderColor: 'transparent',
      },
    },
    subtitle: {
      role: 'subtitle',
      type: 'text',
      x: pad,
      y: Math.round(stageHeight * 0.27),
      width: contentW,
      height: Math.round(stageHeight * 0.1),
      label: 'Alt Başlık',
      style: {
        fontSize: Math.round(stageHeight * 0.032),
        fontWeight: 400,
        color: theme.bodyColor || '#475569',
        textAlign: 'center',
        background: 'transparent',
        borderColor: 'transparent',
      },
    },
    body: {
      role: 'body',
      type: 'text',
      x: pad,
      y: Math.round(stageHeight * 0.28),
      width: contentW,
      height: Math.round(stageHeight * 0.56),
      label: 'İçerik metni buraya gelecek',
      style: {
        fontSize: Math.round(stageHeight * 0.028),
        fontWeight: 400,
        color: theme.bodyColor || '#475569',
        textAlign: 'left',
        background: 'transparent',
        borderColor: 'transparent',
      },
    },
    left: {
      role: 'left',
      type: 'text',
      x: pad,
      y: Math.round(stageHeight * 0.22),
      width: Math.round(contentW * 0.47),
      height: Math.round(stageHeight * 0.6),
      label: 'Sol Sütun',
      style: {
        fontSize: Math.round(stageHeight * 0.026),
        fontWeight: 400,
        color: theme.bodyColor || '#475569',
        textAlign: 'left',
        background: 'transparent',
        borderColor: 'transparent',
      },
    },
    right: {
      role: 'right',
      type: 'text',
      x: pad + Math.round(contentW * 0.53),
      y: Math.round(stageHeight * 0.22),
      width: Math.round(contentW * 0.47),
      height: Math.round(stageHeight * 0.6),
      label: 'Sağ Sütun',
      style: {
        fontSize: Math.round(stageHeight * 0.026),
        fontWeight: 400,
        color: theme.bodyColor || '#475569',
        textAlign: 'left',
        background: 'transparent',
        borderColor: 'transparent',
      },
    },
    image: {
      role: 'image',
      type: 'image',
      x: 0,
      y: 0,
      width: Math.round(stageWidth * 0.44),
      height: stageHeight,
      label: 'Resim Alanı',
      style: { background: '#e2e8f0', borderColor: 'transparent' },
    },
    question: {
      role: 'question',
      type: 'text',
      x: pad,
      y: Math.round(stageHeight * 0.1),
      width: contentW,
      height: Math.round(stageHeight * 0.18),
      label: 'Soru metni buraya gelecek?',
      style: {
        fontSize: Math.round(stageHeight * 0.038),
        fontWeight: 700,
        color: theme.headingColor || '#1e40af',
        textAlign: 'center',
        background: 'transparent',
        borderColor: 'transparent',
      },
    },
    choices: {
      role: 'choices',
      type: 'text',
      x: pad,
      y: Math.round(stageHeight * 0.35),
      width: contentW,
      height: Math.round(stageHeight * 0.5),
      label: 'A) Seçenek 1\nB) Seçenek 2\nC) Seçenek 3\nD) Seçenek 4',
      style: {
        fontSize: Math.round(stageHeight * 0.03),
        fontWeight: 400,
        color: theme.bodyColor || '#1d4ed8',
        textAlign: 'left',
        background: 'transparent',
        borderColor: 'transparent',
      },
    },
    scoreDisplay: {
      role: 'scoreDisplay',
      type: 'text',
      x: Math.round(stageWidth * 0.3),
      y: Math.round(stageHeight * 0.18),
      width: Math.round(stageWidth * 0.4),
      height: Math.round(stageHeight * 0.28),
      label: '100',
      style: {
        fontSize: Math.round(stageHeight * 0.13),
        fontWeight: 900,
        color: theme.accentColor || '#22c55e',
        textAlign: 'center',
        background: 'transparent',
        borderColor: 'transparent',
      },
    },
    stats: {
      role: 'stats',
      type: 'text',
      x: Math.round(stageWidth * 0.2),
      y: Math.round(stageHeight * 0.5),
      width: Math.round(stageWidth * 0.6),
      height: Math.round(stageHeight * 0.2),
      label: 'Doğru: 8 / 10 — Süre: 2:34',
      style: {
        fontSize: Math.round(stageHeight * 0.026),
        fontWeight: 500,
        color: theme.bodyColor || '#15803d',
        textAlign: 'center',
        background: 'transparent',
        borderColor: 'transparent',
      },
    },
    buttons: {
      role: 'buttons',
      type: 'button',
      x: Math.round(stageWidth * 0.35),
      y: Math.round(stageHeight * 0.75),
      width: Math.round(stageWidth * 0.3),
      height: Math.round(stageHeight * 0.1),
      label: 'Devam Et',
      style: {
        fontSize: Math.round(stageHeight * 0.032),
        fontWeight: 700,
        color: '#ffffff',
        textAlign: 'center',
        background: theme.accentColor || '#22c55e',
        borderColor: 'transparent',
        borderRadius: 12,
      },
    },
  };

  return preset.layout.map((role) => descriptors[role]).filter(Boolean);
}
