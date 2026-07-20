import {
  BUTTON_PACKAGES,
  DEFAULT_ACTIVITY_SETTINGS,
  DEFAULT_LMS_CONFIG,
  INITIAL_STATE,
  BOOK_LAYER_PRESET_KEYS,
  TEXT_STUDIO_SETTING_KEYS,
  ANSWER_LAYER_STYLE_PRESETS,
} from '../../constants';
import { uid } from '../../utils/editorHelpers';
import { enforceTtkbActivityCompliance, enforceTtkbEditorState } from '../../utils/ttkbCompliance';
import { commitMaterializedActivity } from '../activityHelpers';
import { normalizeActivity, restyleActivityButtonsForPackage } from '../activityRestyle';
import { getDragDropPairKey } from '../dragDrop';
import { safeClone, getAnswerPlacementFrames, normalizeButtonPairLayoutForActivity } from '../editorHelpers';
import { normalizeVariable } from '../normalize';
import { DEFAULT_ANSWER_LAYER_STYLE_PRESET_ID } from '../sceneTemplates';
export function syncAnswerPlacementObjects(activity) {
  if (activity === undefined) activity = {};
  var objects = Array.isArray(activity.objects) ? activity.objects : [];
  if (!objects.some(function(item) { return item.generatedBy === 'answer-placement'; })) return activity;
  var frames = getAnswerPlacementFrames(activity);
  var frameEntries = Object.entries(frames);
  var usedFrameKeys = new Set();

  return {
    ...activity,
    objects: objects.map(function(item) {
      if (item.generatedBy !== 'answer-placement') return item;
      var baseItem = {
        ...item,
        answerStatic: true,
        disableDrag: false,
        locked: false,
      };
      if (!frameEntries.length) return baseItem;
      var pairKey =
        item.answerPairKey ||
        getDragDropPairKey(
          item.sourceDragId || item.dragId || '',
          item.targetDropId || item.dropId || ''
        );
      var frame = frames[pairKey];
      if (!frame) {
        var legacyMatch = frameEntries.find(function([key, entry]) {
          return !usedFrameKeys.has(key) &&
            (entry.drag.id === item.sourceDragId ||
              (String(entry.drag.label || '').trim() &&
                String(entry.drag.label || '').trim() === String(item.label || '').trim()));
        });
        if (legacyMatch) {
          pairKey = legacyMatch[0];
          frame = legacyMatch[1];
        }
      }
      if (!frame) return baseItem;
      usedFrameKeys.add(pairKey);
      var manualPlacement = item.answerPlacementManual === true;
      return {
        ...baseItem,
        x: manualPlacement ? item.x : frame.x,
        y: manualPlacement ? item.y : frame.y,
        width: manualPlacement ? item.width : frame.width,
        height: manualPlacement ? item.height : frame.height,
        sourceDragId: item.sourceDragId || frame.drag.id,
        targetDropId: item.targetDropId || frame.drop.id,
        answerPairKey: pairKey,
      };
    }),
  };
}

export function normalizeBook(book = {}, index = 0) {
  const pkgId = BUTTON_PACKAGES.some((item) => item.id === book.buttonPackageId)
    ? book.buttonPackageId
    : BUTTON_PACKAGES[0].id;
  const defaultAnswerLayerStylePresetId = ANSWER_LAYER_STYLE_PRESETS.some(
    (item) => item.id === book.defaultAnswerLayerStylePresetId
  )
    ? book.defaultAnswerLayerStylePresetId
    : DEFAULT_ANSWER_LAYER_STYLE_PRESET_ID;
  const name = String(book.name || '').trim() || `Kitap ${index + 1}`;
  return {
    ...book,
    id: book.id || uid(),
    publisherId: book.publisherId || '',
    name,
    description: book.description || '',
    buttonPackageId: pkgId,
    defaultAnswerLayerStylePresetId,
    pdfImports: Array.isArray(book.pdfImports) ? book.pdfImports : [],
    layerPresets: Array.isArray(book.layerPresets)
      ? book.layerPresets.map(normalizeLayerPreset)
      : [],
  };
}

export function pickBookLayerPresetPayload(activity = {}) {
  const normalizedActivity = normalizeButtonPairLayoutForActivity(activity);
  return BOOK_LAYER_PRESET_KEYS.reduce((acc, key) => {
    acc[key] = safeClone(
      normalizedActivity?.[key],
      Array.isArray(normalizedActivity?.[key]) ? [] : ''
    );
    return acc;
  }, {});
}

export function normalizeLayerPreset(preset = {}, index = 0) {
  const name = String(preset.name || '').trim() || `Katman Seti ${index + 1}`;
  const payload = pickBookLayerPresetPayload(
    normalizeButtonPairLayoutForActivity(
      normalizeActivity({
        name,
        type: preset.type || 'selection',
        ...(safeClone(preset.payload, {}) || {}),
      })
    )
  );
  return {
    id: preset.id || uid(),
    name,
    createdAt: preset.createdAt || new Date().toISOString(),
    updatedAt: preset.updatedAt || preset.createdAt || new Date().toISOString(),
    payload,
  };
}

export function applyBookLayerPresetToActivity(activity = {}, preset = null) {
  if (!preset?.payload) return activity;
  const payload = safeClone(preset.payload, {});
  return normalizeButtonPairLayoutForActivity(
    normalizeActivity({
      ...activity,
      ...payload,
      id: activity.id,
      name: activity.name,
      type: activity.type,
      bookId: activity.bookId,
      notes: activity.notes,
    })
  );
}



export function pickTextStudioDesign(activity = {}) {
  const settings = { ...DEFAULT_ACTIVITY_SETTINGS, ...(activity.settings || {}) };
  return {
    buttonPackageId: activity.buttonPackageId || BUTTON_PACKAGES[0]?.id || 'classic',
    introScreen: safeClone(activity.introScreen || {}),
    buttonPackageScreen: safeClone(activity.buttonPackageScreen || {}),
    menuScreen: safeClone(activity.menuScreen || {}),
    playScreen: safeClone(activity.playScreen || {}),
    resultScreens: safeClone(activity.resultScreens || {}),
    answerScreen: safeClone(activity.answerScreen || {}),
    settings: TEXT_STUDIO_SETTING_KEYS.reduce((acc, key) => {
      acc[key] = settings[key];
      return acc;
    }, {}),
  };
}

export function normalizeTextStudioPreset(preset = {}, index = 0) {
  const name = String(preset.name || '').trim() || `Tasarım ${index + 1}`;
  return {
    id: preset.id || uid(),
    name,
    createdAt: preset.createdAt || new Date().toISOString(),
    updatedAt: preset.updatedAt || preset.createdAt || new Date().toISOString(),
    payload: pickTextStudioDesign(preset.payload || preset.design || preset),
  };
}

export function applyTextStudioPreset(activity = {}, preset = {}) {
  const payload = preset?.payload || preset || {};
  const nextPackageId = payload.buttonPackageId || activity.buttonPackageId;
  const nextActivity = normalizeActivity({
    ...activity,
    buttonPackageId: nextPackageId,
    introScreen: safeClone(payload.introScreen, activity.introScreen || {}),
    buttonPackageScreen: safeClone(payload.buttonPackageScreen, activity.buttonPackageScreen || {}),
    menuScreen: safeClone(payload.menuScreen, activity.menuScreen || {}),
    playScreen: safeClone(payload.playScreen, activity.playScreen || {}),
    resultScreens: safeClone(payload.resultScreens, activity.resultScreens || {}),
    answerScreen: safeClone(payload.answerScreen, activity.answerScreen || {}),
    settings: {
      ...DEFAULT_ACTIVITY_SETTINGS,
      ...(activity.settings || {}),
      ...(payload.settings || {}),
    },
  });
  return nextPackageId
    ? restyleActivityButtonsForPackage(nextActivity, nextPackageId)
    : nextActivity;
}

export function normalizeState(state = {}) {
  const normalizedLmsConfig = normalizeScorm12LmsConfig(state.lmsConfig || {});
  return enforceTtkbEditorState({
    ...INITIAL_STATE,
    ...state,
    publishers: Array.isArray(state.publishers) ? state.publishers : [],
    books: Array.isArray(state.books) ? state.books.map(normalizeBook) : [],
    variables: Array.isArray(state.variables) ? state.variables.map(normalizeVariable) : [],
    activities: Array.isArray(state.activities) ? state.activities.map(normalizeActivity) : [],
    lmsConfig: normalizedLmsConfig,
  });
}

export function normalizeActivityForRuntimeSnapshot(activity = {}) {
  return enforceTtkbActivityCompliance(
    syncAnswerPlacementObjects(normalizeActivity(commitMaterializedActivity(activity)))
  );
}

export function createRuntimeStateSnapshot(state = {}, currentActivitySnapshot = null) {
  const normalized = normalizeState(state);
  const overrideActivity = currentActivitySnapshot?.id
    ? normalizeActivityForRuntimeSnapshot(currentActivitySnapshot)
    : null;
  const activities = (normalized.activities || []).map((activity) =>
    overrideActivity && activity.id === overrideActivity.id
      ? overrideActivity
      : normalizeActivityForRuntimeSnapshot(activity)
  );
  const hasOverride = !!(
    overrideActivity && activities.some((activity) => activity.id === overrideActivity.id)
  );
  return {
    ...normalized,
    activities: hasOverride
      ? activities
      : overrideActivity
        ? [...activities, overrideActivity]
        : activities,
    selActId: overrideActivity?.id || normalized.selActId || activities[0]?.id || '',
  };
}

export function createPreviewHtmlSignature(value = '') {
  const text = String(value || '');
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export const REDACTED_SECRET_VALUE = '__REDACTED_SECRET__';
export const SENSITIVE_LMS_KEYS = ['xapiKey', 'xapiSecret', 'ltiConsumerKey', 'ltiSharedSecret'];
// Hem tam-string hem string ICINE gomulu (svgMarkup/HTML/CSS) dis kaynaklari yakalar;
// protokolsuz //host.tld de bir HTTPS LMS'te dis istek ceker. w3.org gibi XML namespace
// URL'leri fetch degildir, ayri elenir.
export const EXTERNAL_URL_SCAN_RE = /(?:https?:)?\/\/[a-z0-9.-]+\.[a-z]{2,}[^\s"'<>)]*/gi;
export const SAFE_NAMESPACE_URL_RE = /\b(?:www\.)?w3c?\.org\b/i;

export function hasLmsSecrets(value = {}) {
  return SENSITIVE_LMS_KEYS.some(
    (key) => String(value?.[key] || '').trim() && value[key] !== REDACTED_SECRET_VALUE
  );
}

export function maskLmsSecrets(config = {}, redactionValue = '') {
  const next = { ...(config || {}) };
  SENSITIVE_LMS_KEYS.forEach((key) => {
    if (next[key] === REDACTED_SECRET_VALUE || String(next[key] || '').trim()) {
      next[key] = redactionValue;
    }
  });
  return next;
}

export function clearRedactedLmsSecrets(config = {}) {
  const next = { ...(config || {}) };
  SENSITIVE_LMS_KEYS.forEach((key) => {
    if (next[key] === REDACTED_SECRET_VALUE) next[key] = '';
  });
  return next;
}

export function normalizeScorm12LmsConfig(config = {}) {
  const next = clearRedactedLmsSecrets({ ...DEFAULT_LMS_CONFIG, ...(config || {}) });
  SENSITIVE_LMS_KEYS.forEach((key) => {
    delete next[key];
  });
  delete next.xapiEndpoint;
  delete next.xapiActivityId;
  delete next.cmi5FetchUrl;
  delete next.cmi5MoveOn;
  delete next.ltiLaunchUrl;
  return {
    ...next,
    standard: 'scorm12',
  };
}

export function collectExternalUrls(value, path = '', found = new Map()) {
  if (value == null) return found;
  if (typeof value === 'string') {
    const matches = value.match(EXTERNAL_URL_SCAN_RE);
    if (matches) {
      matches.forEach((raw) => {
        const url = raw.trim();
        if (SAFE_NAMESPACE_URL_RE.test(url)) return; // XML namespace, dis fetch degil
        const list = found.get(url) || [];
        list.push(path || 'state');
        found.set(url, list);
      });
    }
    return found;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectExternalUrls(item, `${path}[${index}]`, found));
    return found;
  }
  if (typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) => {
      if (SENSITIVE_LMS_KEYS.includes(key)) return;
      collectExternalUrls(item, path ? `${path}.${key}` : key, found);
    });
  }
  return found;
}

export function summarizeExternalUrlsForScorm(state = {}) {
  return [...collectExternalUrls(state).entries()].map(([url, paths]) => ({
    url,
    paths: [...new Set(paths)].slice(0, 3),
  }));
}

export function createSafeStateForStorage(state = {}) {
  const normalized = normalizeState(state);
  return {
    ...normalized,
    lmsConfig: maskLmsSecrets(normalized.lmsConfig, ''),
    activities: normalized.activities.map((activity) =>
      activity?.lmsConfig
        ? {
            ...activity,
            lmsConfig: normalizeScorm12LmsConfig(maskLmsSecrets(activity.lmsConfig, '')),
          }
        : activity
    ),
  };
}

export function createSafeStateForExport(state = {}) {
  const normalized = normalizeState(state);
  return {
    ...normalized,
    lmsConfig: maskLmsSecrets(normalized.lmsConfig, REDACTED_SECRET_VALUE),
    activities: normalized.activities.map((activity) =>
      activity?.lmsConfig
        ? {
            ...activity,
            lmsConfig: normalizeScorm12LmsConfig(
              maskLmsSecrets(activity.lmsConfig, REDACTED_SECRET_VALUE)
            ),
          }
        : activity
    ),
  };
}

export function stateHasLmsSecrets(state = {}) {
  return (
    hasLmsSecrets(state.lmsConfig) ||
    (Array.isArray(state.activities) &&
      state.activities.some((activity) => hasLmsSecrets(activity?.lmsConfig)))
  );
}
