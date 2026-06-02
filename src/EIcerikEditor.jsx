/* eslint-disable no-unused-vars, import/order */
import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from 'react';

import { analyzeTextOffline, initAIWorker } from './aiService';
import { apiRequest, fileToDataUrl, uploadMediaFile } from './api/apiClient';
import MixedActivityEditor from './components/activity-editors/MixedActivityEditor';
import SelectionEditor from './components/activity-editors/SelectionEditor';
import SequenceEditor from './components/activity-editors/SequenceEditor';
import AdminManagementModal from './components/AdminManagementModal';
import BranchingDiagramModal from './components/BranchingDiagramModal';
import RuntimeVideoElement from './components/editor/RuntimeVideoElement';
import GlossaryEditorModal from './components/GlossaryEditorModal';
import ProjectVersionManagerModal from './components/ProjectVersionManagerModal';
import ReviewThreadsModal from './components/ReviewThreadsModal';
import EditorTopBar from './components/ribbon/EditorTopBar';
import TopRibbon from './components/ribbon/TopRibbon';
import useRibbonController from './components/ribbon/useRibbonController';
import { LayerThumbnail, SlideStrip, SlideThumbnail } from './components/SlideStrip';
import {
  StorylineSystemPreview,
  shouldObjectPersistAfterTimeline,
  isObjectTimelineActive,
  getTimelineMotionStyle,
  getSelectionUi,
  resolveWrongSelectionGlyph,
  getFitScale,
  getSelectionMarkGlyph,
} from './components/storyline-preview';
import TimelineDock from './components/TimelineDock';
import { Inp, SelectInp, Btn, ShapePreviewIcon } from './components/ui';
import LoginScreen from './features/auth/LoginScreen';
import PresenceBar from './features/presence/PresenceBar';
import usePresence from './features/presence/usePresence';
import ActivityMapPanel, { LayerManager } from './features/editor-workspace/left/ActivityMapPanel';
import ContextRightPanel from './features/editor-workspace/right/ContextRightPanel';
import EditorWorkspaceShell from './features/editor-workspace/EditorWorkspaceShell';
import useWorkspaceChromeController from './features/editor-workspace/useWorkspaceChromeController';
import CanvasWorkspaceCenter from './features/editor-workspace/CanvasWorkspaceCenter';
import DesignToolsDialog from './features/editor-workspace/DesignToolsDialog';
import LibraryWorkspace from './features/library/LibraryWorkspace';
import {
  buildEditorHashRoute,
  buildEditorUrl,
  createEditorHistoryState,
  deriveLibraryMobileColumn,
  getEditorHistoryState,
  getParentEditorRoute,
  parseEditorHashRoute,
  resolveEditorRoute,
  routeFromSelection,
  routesEqual,
  shouldWarnBeforeLeavingEditor,
} from './features/navigation/editorRoute';
import { orderBackDismissEntries } from './features/navigation/backDismissStack';
import useBackDismissible from './features/navigation/useBackDismissible';
import WorkspaceStageCanvas from './logic/StageCanvas';
import { getDeviceMode } from './mobile/useDeviceMode';
import MobileEditorShell from './mobile/MobileEditorShell';
import VariablesManagerModal from './components/VariablesManagerModal';
import {
  FIXED_EDITOR_USERS,
  BUTTON_PACKAGES,
  DEFAULT_THEME_PACKAGE_ITEMS,
  ACTIVITY_TYPES,
  DEFAULT_DRAG_DROP_SETTINGS,
  DEFAULT_SELECTION_UI,
  DRAGGABLE_STRONG_STYLE,
  DROPZONE_STRONG_STYLE,
  OBJ_PRESETS,
  RIBBON_SHAPE_PRESETS,
  SHAPE_STYLE_PRESETS,
  BUTTON_STYLE_PRESETS,
  HANDLE_DIRS,
  HANDLE_POS,
  HANDLE_CURSOR,
  DEFAULT_ACTIVITY_SETTINGS,
  DEFAULT_LMS_CONFIG,
  VARIABLE_TYPES,
  TRIGGER_ACTION_OPTIONS,
  TRIGGER_WHEN_OPTIONS,
  TRIGGER_OPERATOR_OPTIONS,
  OBJECT_STATE_OPTIONS,
  TIMELINE_EFFECT_OPTIONS,
  TIMELINE_DIRECTION_OPTIONS,
  TIMELINE_EASING_OPTIONS,
  SLIDE_TRANSITION_OPTIONS,
  SLIDE_STATE_KEYS,
  INITIAL_STATE,
  BOOK_LAYER_PRESET_KEYS,
  TEXT_STUDIO_SETTING_KEYS,
  PACKAGE_SCREEN_THEMES,
  EDITOR_COMMANDS,
  ACCESSIBILITY_DEFAULTS,
  ARIA_ROLE_OPTIONS,
  LMS_STANDARD_OPTIONS,
  WCAG_LEVEL_OPTIONS,
  SLIDE_ADVANCE_OPTIONS,
  SLIDE_REVISIT_OPTIONS,
  SLIDE_MASTER_PRESETS,
  PLAYER_SKIN_PRESETS,
  CAPTION_LANGUAGE_OPTIONS,
  CHARACTER_LIBRARY,
  CHARACTER_CATEGORIES,
  CONTENT_LIBRARY_CATEGORIES,
  STOCK_ASSET_ITEMS,
  ANSWER_LAYER_STYLE_PRESETS,
  GRADE_GROUPS,
  BUTTON_PACKAGE_MOTION_PRESETS,
  PANEL_LIMITS,
} from './constants';
import {
  parseCssColorSamples,
  relativeLuminance,
  contrastRatioForColors,
  readableTextColorForBackground,
  contrastSafeButtonStyle,
  ensureTtkbButtonTextContrast,
  cssColorWithAlpha,
} from './editor-logic/colorUtils';
import CevapDrawer from './features/cevap/CevapDrawer';
import {
  readStoredAuth,
  writeStoredAuth,
  clearStoredAuth,
  createSessionId,
  createSessionLabel,
  getUserStorageKey,
} from './hooks/useAuth';
import {
  materializeActivity,
  commitMaterializedActivity,
  selectActivitySlide,
  getActivitySlides,
  getActivitySlideTarget,
  materializeActivitySlide,
  getActivityLayers,
  getCanvasObjects,
  getCorrectDragMatches,
} from './logic/activityHelpers';
import {
  getPresetToneColors,
  getReadyButtonTone,
  getButtonPackageTone,
  shouldRestyleReadyButton,
  isPlayPauseReadyButton,
  isButtonIntroPlayPauseDemoButton,
  getPlayPauseButtonPatch,
  buildReadyButtonStyle,
  buildReadyButtonStyleFromPackage,
  restyleReadyButtonsForPreset,
  getAnswerLayerChromeForPreset,
  getLayerActionButtonStyle,
  restyleAnswerLayerObjectsForPreset,
  restyleReadyButtonsForPackage,
  restyleAllButtonsForPackage,
  getPackageTheme,
  getButtonPackageMotion,
  getButtonMotionProfile,
  getActivityButtonMotion,
} from './logic/buttonStyling';
import {
  safeClone,
  EDUCATION_BUTTON_ICON_SIZE,
  getAnswerPlacementFrames,
  normalizeButtonPairLayoutForActivity,
  getEditorLinkedSelectionIds,
  getEditorPrimaryObjectId,
} from './logic/editorHelpers';
import { EDITOR_THEME, createShellPanelStyle, PANEL_SCALE_RANGE } from './theme';
import {
  formatBookLockMessage,
  normalizePdfHintRect,
  mergePdfTermLists,
  sanitizeSvgMarkup,
  uid,
  clamp,
  applyMasterPresetToActivity,
  buildMasterLayoutDescriptors,
} from './utils/editorHelpers';
import {
  createDefaultThemePackageItems,
  resolveThemePackageItems,
  normalizeLayerNameKey,
  getBaseLayerAutoName,
  normalizeStyleToken,
  upgradeDragDropStyle,
  createDragDropDefaults,
  getNextAutomaticOverlayLayerName,
  isDefaultOverlayLayerName,
  buildResolvedLayerNameMap,
  createLayer,
  createDefaultSlideLayers,
  ensureSlideDefaultLayers,
  createObject,
  createShapeObject,
  createButtonPresetObject,
  normalizeVectorPoint,
  parseVectorPathToPoints,
  getObjectVectorPoints,
  buildVectorPathFromPoints,
  getBezierPointAt,
  getSegmentMidPoint,
  shiftVectorPointControls,
  alignVectorAnchors,
  createActivity,
  createCanvasTextObject,
  createCanvasButtonObject,
  createCanvasShapeObject,
  createSlide,
} from './logic/factories';
import {
  SCENE_TEMPLATE_OPTIONS,
  SCENE_TEMPLATE_VERSION,
  SCENE_TEMPLATE_BUTTON_INTRO_ID,
  SCENE_TEMPLATE_LAUNCH_PAGE_ID,
  DEFAULT_ANSWER_LAYER_STYLE_PRESET_ID,
  DEFAULT_BOOK_LAYER_PRESET_NAME,
  EDUCATION_BUTTON_TEXT_SIZE_SMALL,
  isButtonIntroDemoButton,
  normalizeSingleButtonIcon,
  getButtonPairSemanticIcon,
  applySceneTemplateToSlide,
} from './logic/sceneTemplates';
import {
  getActivityDragDropDefaults,
  getDragDropSettings,
  getDragDropAnimationPreset,
  getDragDropScopeKey,
  areDragDropScopesCompatible,
  isDragReusable,
  getDropCapacityLimit,
  getDragDropPairKey,
  getDragDropPairsFromMatches,
  buildDragDropMatchMapFromPairs,
  DRAG_DROP_ANIMATION_PRESETS,
  createDragDropPlacement,
  buildDragDropPlacementsFromMatches,
} from './logic/dragDrop';
import {
  normalizeVariable,
  normalizeObject,
  getDefaultVariableValue,
  castVariableValue,
  createVariableItem,
} from './logic/normalize';
import {
  createTimelineKeyframe,
  createTimelineItem,
  normalizeTimelineItem,
  syncTimelineWithObjects,
  getActivityTimeline,
  getTimelineItemForObject,
  getTimelineDuration,
} from './logic/timeline';
import {
  normalizeSlide,
  pickSlideState,
} from './logic/slideNormalization';
import {
  ensureAnswerSceneLayerSet,
  ensureSceneTemplateSlide,
} from './logic/activityTemplateGenerators';
import useEditorStore from './store/useEditorStore';
import {
  normalizePdfText,
  sanitizePdfText,
  detectPdfDraftKind,
  extractPdfDragTerms,
  extractPdfAnswerTerms,
  extractPdfQuestionAnchors,
  buildStoryboardConfig,
} from './pdfParser';
import {
  mapStoryboardInteractionTypeToDraftKind,
  pickPrimaryStoryboardInteraction,
  extractStoryboardTermLists,
  buildPdfSelectionBlueprint,
  countStoryboardExtractedItems,
  splitPdfLineSegments,
  buildPdfTextLines,
  detectPdfMarker,
  buildFallbackPdfGroups,
  inferPdfDraftTitle,
  detectPdfDraftStatus,
  inferPdfSelectionAnchors,
  shouldUsePdfBottomOrigin,
  getPdfStageRectForLines,
  getPdfQuestionAnchors,
  getPdfDragPoolRect,
  detectCanvasContentBounds,
  mapPdfLinesToStage,
  paintPdfCleanupRect,
  samplePdfCanvasBackgroundColor,
  detectPdfGreenCells,
  detectRedAnnotationBounds,
  estimatePdfRowHeight,
  getMedian,
  clusterPdfColumnCenters,
  compactPdfColumnLabel,
  stripPdfAnchorListPrefix,
  stripTrailingCheckMark,
  inferPdfTableChoiceColumns,
  findPdfAnchorLineForText,
  buildPdfSelectionLayoutFromStoryboard,
  detectPdfSelectionLayout,
} from './logic/pdfUtils';
import {
  getActivityContentLanguage,
  contentText,
  translateGeneratedContentText,
  applyContentLanguageToActivity,
} from './logic/contentLanguage';
import {
  isGeneratedSceneTemplateObject,
  createObjectFromActivity,
  updateActivityObject,
  createTriggerItem,
  createTriggerConditionItem,
} from './logic/activityFactory';
import {
  getObjectSelectionBounds,
  alignActivitySelection,
  distributeActivitySelection,
} from './logic/objectLayout';
import { createLearnerSafeStateForExport } from './utils/learnerSecurity';
import { readWorkspaceCache, writeWorkspaceCache } from './utils/workspaceCache';
import {
  buildStorylinePlayerHtml,
  downloadScorm12Zip,
  validateScorm12PreviewStart,
} from './utils/scormExport';
import {
  buildStorylineObjectRenderModel,
  getSharedStorylineRendererRuntimeApi,
  getStorylinePreviewRenderData,
  isStorylineDropTargetLikeObject,
} from './utils/storylineRenderer';
import {
  getRuntimeButtonAction,
  isGeneratedAnswerTemplateObject,
  normalizeRuntimeActionLabel,
  withStableRuntimeSlideObjectIds,
} from './utils/storylineRuntime';
import {
  evaluateStorylineRuntimeDragDrop,
  findStorylineRuntimeDropTarget,
  getStorylineDragDropPairKey,
  getStorylineDragDropPairsFromMatches,
  getStorylineRuntimeCorrectDragMatches,
  getStorylineRuntimeDropResultStates,
  getStorylineRuntimeSnapPosition,
  getStorylineRuntimeKey,
  normalizeStorylineDragDropMatchValue,
  getStorylineRuntimeCommandsForObject,
} from './utils/storylineRuntimeEngine';
import {
  auditTtkbEditorState,
  enforceTtkbActivityCompliance,
  enforceTtkbEditorState,
} from './utils/ttkbCompliance';
import {
  saveSessionResume,
  getSessionResume,
  clearSessionResume,
  saveActiveSessionNavigation,
  getActiveSessionNavigation,
  clearActiveSessionNavigation,
  resetNavigationForResumePrompt,
  restoreActiveSessionNavigation,
  validateSessionResumeTarget,
} from './utils/sessionResume';
import {
  isRemoteWorkspaceMutationLocked,
  requiresFreshEditorSession,
  shouldKeepBootVisibleForWorkspace,
} from './utils/bootReadiness';

// Eagerly initialize AI worker (non-blocking)
initAIWorker().catch(() => {});

// ─── Sabitler ─────────────────────────────────────────────────────────────────

const EDUCATION_BUTTON_ICON_SIZE_LARGE = 30;
const REMOTE_STATUS_REQUEST_TIMEOUT_MS = 15000;
const REMOTE_SAVE_REQUEST_TIMEOUT_MS = 30000;
const BOOK_LOCK_REQUEST_TIMEOUT_MS = 12000;

const CONTENT_LANGUAGE_OPTIONS = [
  { value: 'tr', label: 'Türkçe' },
  { value: 'en', label: 'English' },
];







function restyleActivityButtonsForPackage(
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




function readStoredEditorHistory(userId, fallbackState) {
  if (typeof window === 'undefined') {
    return { past: [], present: normalizeState(fallbackState), future: [] };
  }
  try {
    const raw = localStorage.getItem(getUserStorageKey(userId));
    if (raw) {
      return { past: [], present: normalizeState(JSON.parse(raw)), future: [] };
    }
  } catch {}
  return { past: [], present: normalizeState(fallbackState), future: [] };
}

// --- Hash Route Parser ---
// Supports:
//   #/publisher/:pubId/book/:bookId/activity/:actId  -> editor
//   #/publisher/:pubId/book/:bookId                  -> activities
//   #/publisher/:pubId                               -> books
//   (empty / other)                                  -> publishers
function parseHashRoute(hash) {
  const route = parseEditorHashRoute(hash);
  return route.textStudio || route.pubId || route.bookId || route.actId ? route : null;
}

function buildHashRoute(pubId, bookId, actId) {
  return buildEditorHashRoute({ pubId, bookId, actId });
}

function syncAnswerPlacementObjects(activity) {
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




function getVariableTypeLabel(type = 'text') {
  return VARIABLE_TYPES.find((item) => item.value === type)?.label || type;
}

function formatVariableValue(value, type = 'text') {
  if (type === 'boolean') return value ? 'True' : 'False';
  if (type === 'number') return Number.isFinite(Number(value)) ? String(Number(value)) : '0';
  return String(value ?? '');
}

function resolveColorPickerValue(value, fallback = '#111111') {
  const match = String(value || '').match(/#[0-9a-fA-F]{6}/);
  return match ? match[0] : fallback;
}

function buildVariableUsageCountMap(activities = []) {
  return (activities || []).reduce((counts, activity) => {
    getActivitySlides(activity).forEach((slide) => {
      (slide.triggers || []).forEach((trigger) => {
        if (
          ['DegiskenAta', 'DegiskenArttir', 'DegiskenAzalt'].includes(trigger?.action) &&
          trigger?.value
        ) {
          counts[trigger.value] = (counts[trigger.value] || 0) + 1;
        }
        (trigger?.conditions || []).forEach((condition) => {
          if (condition?.sourceType === 'variable' && condition?.sourceId) {
            counts[condition.sourceId] = (counts[condition.sourceId] || 0) + 1;
          }
        });
      });
    });
    return counts;
  }, {});
}

function buildBuiltInVariableRows({ activity = {}, projectName = '', bookName = '' } = {}) {
  const slides = getActivitySlides(activity);
  const currentSlideIndex =
    Math.max(
      0,
      slides.findIndex((slide) => slide.id === activity?.currentSlideId)
    ) + 1;
  return [
    {
      id: 'builtin.project',
      name: 'Project.Title',
      type: 'text',
      value: projectName || 'İsimsiz Proje',
      useCount: 0,
    },
    {
      id: 'builtin.book',
      name: 'Book.Title',
      type: 'text',
      value: bookName || 'İsimsiz Kitap',
      useCount: 0,
    },
    {
      id: 'builtin.activity',
      name: 'Activity.Name',
      type: 'text',
      value: activity?.name || 'İsimsiz Etkinlik',
      useCount: 0,
    },
    {
      id: 'builtin.scene',
      name: 'Scene.Name',
      type: 'text',
      value: activity?.sceneName || 'İsimsiz Sahne',
      useCount: 0,
    },
    {
      id: 'builtin.slideIndex',
      name: 'Slide.Index',
      type: 'number',
      value: currentSlideIndex,
      useCount: 0,
    },
    {
      id: 'builtin.slideCount',
      name: 'Slide.Count',
      type: 'number',
      value: slides.length,
      useCount: 0,
    },
    {
      id: 'builtin.layerCount',
      name: 'Layer.Count',
      type: 'number',
      value: getActivityLayers(activity).length,
      useCount: 0,
    },
    {
      id: 'builtin.objectCount',
      name: 'Object.Count',
      type: 'number',
      value: Array.isArray(activity?.objects) ? activity.objects.length : 0,
      useCount: 0,
    },
  ];
}



const AUTO_LAYER_NAME_PRESETS = ['menu', 'explanation', 'normal', 'Correct', 'Incorrect', 'cevap'];


// eslint-disable-next-line no-unused-vars -- Legacy PDF import object factory retained for dormant import flow.
function createPdfImageObject(imageUrl, pageWidth, pageHeight, label = 'PDF Zemin') {
  const object = createObject('image');
  return {
    ...object,
    x: 0,
    y: 0,
    width: pageWidth,
    height: pageHeight,
    imageData: imageUrl,
    label,
    isPdfBackground: true,
    locked: true,
    zIndex: 0,
    style: {
      ...object.style,
      background: 'transparent',
      borderColor: 'transparent',
    },
  };
}

function createPdfMaskObject(x, y, width, height) {
  const object = createObject('shape');
  return {
    ...object,
    x,
    y,
    width,
    height,
    label: '',
    isPdfMask: true,
    locked: true,
    zIndex: 30,
    style: {
      ...object.style,
      background: '#ffffff',
      borderColor: '#ffffff',
      borderRadius: 8,
      color: 'transparent',
    },
  };
}

function createPdfDropzoneObject(text, x, y, width, height, index) {
  const object = createObject('dropzone');
  return {
    ...object,
    x,
    y,
    width,
    height,
    label: `Bosluk ${index + 1}`,
    group: text,
    locked: false,
    zIndex: 40 + index,
    style: {
      ...upgradeDragDropStyle('dropzone', object.style),
      borderRadius: 12,
    },
  };
}

function createPdfDraggableObject(text, x, y, width, height, index) {
  const object = createObject('draggable');
  return {
    ...object,
    x,
    y,
    width,
    height,
    label: text,
    group: text,
    zIndex: 60 + index,
    style: {
      ...upgradeDragDropStyle('draggable', object.style),
      borderRadius: 16,
    },
  };
}

function createPdfSelectionObject(
  questionId,
  choice,
  x,
  y,
  width,
  height,
  index,
  isCorrect = null,
  displayLabel = null,
  layoutMode = ''
) {
  const object = createObject('button');
  // D/Y (doğru/yanlış) mode: label shows "D" or "Y"
  // single-check mode: label shows checkbox symbol
  const isBinary = choice === 'd' || choice === 'y';
  const isTableChoice = layoutMode === 'table-choice';
  const label = isBinary
    ? choice === 'd'
      ? 'D'
      : 'Y'
    : isTableChoice
      ? sanitizePdfText(displayLabel || choice || '')
      : '☐';
  const bg = isBinary
    ? choice === 'd'
      ? '#dcfce7'
      : '#fef2f2'
    : isTableChoice
      ? '#eff6ff'
      : '#f8faff';
  const border = isBinary
    ? choice === 'd'
      ? '#16a34a'
      : '#dc2626'
    : isTableChoice
      ? '#2563eb'
      : '#6366f1';
  const color = isBinary
    ? choice === 'd'
      ? '#15803d'
      : '#b91c1c'
    : isTableChoice
      ? '#1d4ed8'
      : '#4338ca';
  return {
    ...object,
    x,
    y,
    width,
    height,
    label,
    selectionQuestionId: questionId,
    selectionChoice: choice,
    selectionCorrect: typeof isCorrect === 'boolean' ? isCorrect : null,
    locked: false,
    zIndex: 48 + index,
    style: {
      ...object.style,
      background: bg,
      borderColor: border,
      color,
      borderRadius: isBinary ? 6 : 4,
      fontSize: isBinary ? 14 : isTableChoice ? 12 : 22,
      fontWeight: 700,
    },
  };
}

// eslint-disable-next-line no-unused-vars -- Legacy PDF selection object builder retained for dormant import flow.
function buildPdfSelectionObjects(draft, page) {
  const detectedLayout = detectPdfSelectionLayout(page);
  const storyboardLayout = buildPdfSelectionLayoutFromStoryboard(draft, page);
  const detectedCount = detectedLayout?.anchors?.length || 0;
  const storyboardCount = storyboardLayout?.anchors?.length || 0;
  const layout =
    storyboardCount > detectedCount ? storyboardLayout : detectedLayout || storyboardLayout;
  if (!layout) return { objects: [], slots: [], masks: [], layout: null };

  const objects = [];
  const slots = [];
  const masks = [];
  const width = page.width || 1920;
  const height = page.height || 1080;

  // White mask covering each column strip so original PDF tick marks are hidden in editor
  const columnHeight = clamp(
    (layout.anchors[layout.anchors.length - 1]?.stageY || 0) +
      layout.rowHeight -
      Math.max(0, layout.anchors[0]?.stageY || 0) +
      layout.rowHeight * 0.22,
    layout.rowHeight,
    height
  );
  const columnTop = clamp(
    Math.max(0, (layout.anchors[0]?.stageY || 0) - layout.rowHeight * 0.18),
    0,
    height
  );
  layout.columns.forEach((column) => {
    const extraW = layout.mode === 'single-check' ? column.width * 0.45 : column.width * 0.12;
    const rx = clamp(column.left - extraW * 0.35, 0, width);
    masks.push(
      createPdfMaskObject(rx, columnTop, Math.min(width - rx, column.width + extraW), columnHeight)
    );
  });

  layout.anchors.forEach((anchor, index) => {
    const questionId = `pdf-q-${index + 1}`;
    const top = clamp(anchor.stageY - layout.rowHeight * 0.18, 0, height - layout.rowHeight);
    const correctChoice = layout.answers[questionId] || null;
    const correctColumn = layout.columns.find((column) => column.key === correctChoice) || null;
    slots.push({ id: questionId, correctChoice, correctLabel: correctColumn?.label || null });
    layout.columns.forEach((column, columnIndex) => {
      objects.push(
        createPdfSelectionObject(
          questionId,
          column.key,
          column.left,
          top,
          column.width,
          layout.rowHeight,
          index * Math.max(1, layout.columns.length) + columnIndex,
          correctChoice === column.key ? true : correctChoice ? false : null,
          column.label || column.key,
          layout.mode
        )
      );
    });
  });

  return { objects, slots, masks, layout };
}

// eslint-disable-next-line no-unused-vars -- Legacy PDF mask hook retained for dormant import flow.
function applyPdfCleaningMasks(kind, page) {
  if (kind === 'drag-drop') {
    return [];
  }
  // selection masks are built inside buildPdfSelectionObjects, nothing extra needed here
  return [];
}

// eslint-disable-next-line no-unused-vars -- Legacy PDF drag-drop object builder retained for dormant import flow.
function buildPdfDragDropObjects(draft, page) {
  const lines = Array.isArray(page.lines) ? page.lines : [];
  const terms = (draft.draggableTerms || []).map((term) => sanitizePdfText(term)).filter(Boolean);
  const answers = (draft.answerTerms || []).map((term) => sanitizePdfText(term)).filter(Boolean);
  const anchors = getPdfQuestionAnchors(page).length
    ? getPdfQuestionAnchors(page)
    : extractPdfQuestionAnchors(lines, page.height || 768);
  const preferredDropTerms =
    answers.length >= Math.min(terms.length, anchors.length) ? answers : terms;
  const dropTerms = preferredDropTerms.slice(0, anchors.length);
  if (!terms.length || !anchors.length || !dropTerms.length) return { objects: [], matches: {} };

  const width = page.width || 1365;
  const height = page.height || 768;
  const poolRect = getPdfDragPoolRect(page);
  const dragGap = 10;
  const dragHeight = clamp(Math.round(height * 0.045), 34, 46);
  const objects = [];
  const matches = {};
  const dropzones = [];

  dropTerms.forEach((answer, index) => {
    const anchor = anchors[index];
    if (!anchor) return;
    const dropHeight = clamp(Math.round(height * 0.043), 32, 42);
    const dropWidth = clamp(
      Math.max(220, Math.round(answer.length * 10.5)),
      220,
      Math.round(width * 0.28)
    );
    const preferredX = anchor.x + (anchor.width || 0) + 12;
    const minX = Math.max(110, width * 0.16);
    const maxX = Math.max(minX, poolRect ? poolRect.x - dropWidth - 24 : width * 0.55);
    const targetX = clamp(preferredX, minX, maxX);
    const preferredY = anchor.stageY;
    const minY = Math.max(24, anchor.stageY - 4);
    const maxY = Math.max(minY, anchor.stageY + anchor.height);

    const dropzone = createPdfDropzoneObject(
      answer,
      targetX,
      clamp(preferredY, minY, maxY),
      dropWidth,
      dropHeight,
      index
    );
    objects.push(dropzone);
    dropzones.push(dropzone);
  });

  const longTerms = terms.some((term) => term.length > 24);
  const columns = poolRect && !longTerms && terms.length >= 6 ? 2 : 1;
  const dragWidth = poolRect
    ? clamp(
        Math.round(columns === 1 ? poolRect.width - 18 : (poolRect.width - 24 - dragGap) / 2),
        200,
        420
      )
    : clamp(Math.round(width * 0.18), 180, 320);
  const dragStartX = poolRect ? poolRect.x + 9 : width * 0.72;
  const dragStartY = poolRect ? poolRect.y + 8 : height * 0.24;

  terms.forEach((term, index) => {
    const column = columns === 1 ? 0 : index % columns;
    const row = columns === 1 ? index : Math.floor(index / columns);
    const x = poolRect
      ? dragStartX + column * (dragWidth + dragGap)
      : width * (0.72 + column * 0.12);
    const y = poolRect
      ? dragStartY + row * (dragHeight + 8)
      : height * 0.24 + row * (dragHeight + 12);

    const draggable = createPdfDraggableObject(term, x, y, dragWidth, dragHeight, index);
    objects.push(draggable);

    const dropzone = dropzones.find((item) => item.group === term) || dropzones[index] || null;
    if (dropzone) matches[draggable.id] = dropzone.id;
  });

  return { objects, matches };
}

/* ── Transition CSS keyframe builder ── */

function normalizeActivity(activity = {}) {
  const fallback = createActivity(activity.name || 'Etkinlik', activity.type || 'selection');
  const legacySlide = normalizeSlide(
    {
      ...pickSlideState({ ...fallback, ...activity }),
      id: activity.currentSlideId || activity.startSlideId || uid(),
      name: 'Slider 1',
    },
    0
  );
  const normalizedSlides =
    Array.isArray(activity.slides) && activity.slides.length
      ? activity.slides.map((slide, index) => normalizeSlide(slide, index))
      : [legacySlide];
  const activeSceneTemplatePresetId =
    activity.answerLayerStylePresetId || DEFAULT_ANSWER_LAYER_STYLE_PRESET_ID;
  const syncedSlides = normalizedSlides.map((slide, index) => {
    const templateId = String(slide.sceneTemplateId || '').trim();
    const hasTemplateObjects =
      Array.isArray(slide.objects) && slide.objects.some(isGeneratedSceneTemplateObject);

    if (!templateId) {
      if (!hasTemplateObjects) return slide;
      return normalizeSlide(
        applySceneTemplateToSlide(slide, {
          templateId: '',
          presetId: activeSceneTemplatePresetId,
          slides: normalizedSlides,
          currentSlideId: slide.id,
        }),
        index
      );
    }

    if (
      templateId !== SCENE_TEMPLATE_BUTTON_INTRO_ID &&
      templateId !== SCENE_TEMPLATE_LAUNCH_PAGE_ID
    )
      return slide;

    if (
      slide.sceneTemplatePresetId === activeSceneTemplatePresetId &&
      Number(slide.sceneTemplateVersion || 0) === SCENE_TEMPLATE_VERSION &&
      hasTemplateObjects
    )
      return slide;

    return normalizeSlide(
      applySceneTemplateToSlide(slide, {
        templateId,
        presetId: activeSceneTemplatePresetId,
        preserveNonGenerated: true,
        replaceExisting: false,
        slides: normalizedSlides,
        currentSlideId: slide.id,
      }),
      index
    );
  });
  const startSlideId = syncedSlides[0]?.id;
  const currentSlideId = syncedSlides.some((slide) => slide.id === activity.currentSlideId)
    ? activity.currentSlideId
    : startSlideId;
  const currentSlide =
    syncedSlides.find((slide) => slide.id === currentSlideId) || syncedSlides[0] || legacySlide;
  const normalizedPackageId = BUTTON_PACKAGES.some((item) => item.id === activity.buttonPackageId)
    ? activity.buttonPackageId
    : fallback.buttonPackageId || BUTTON_PACKAGES[0]?.id || 'pkg-1';
  const normalizedAnimationProfileId = BUTTON_PACKAGE_MOTION_PRESETS[
    activity.buttonAnimationProfileId
  ]
    ? activity.buttonAnimationProfileId
    : BUTTON_PACKAGES.find((item) => item.id === normalizedPackageId)?.animationProfileId ||
      fallback.buttonAnimationProfileId ||
      'calmLift';
  const slideState = pickSlideState(currentSlide);
  const dragDropDefaults = getActivityDragDropDefaults({
    ...fallback,
    ...activity,
    ...slideState,
  });
  const nextActivity = {
    ...fallback,
    ...activity,
    ...slideState,
    buttonPackageId: normalizedPackageId,
    buttonAnimationProfileId: normalizedAnimationProfileId,
    settings: { ...DEFAULT_ACTIVITY_SETTINGS, ...(activity.settings || {}) },
    introScreen: { ...fallback.introScreen, ...(activity.introScreen || {}) },
    buttonPackageScreen: {
      ...fallback.buttonPackageScreen,
      ...(activity.buttonPackageScreen || {}),
    },
    menuScreen: { ...fallback.menuScreen, ...(activity.menuScreen || {}) },
    playScreen: { ...fallback.playScreen, ...(activity.playScreen || {}) },
    resultScreens: { ...fallback.resultScreens, ...(activity.resultScreens || {}) },
    answerScreen: { ...fallback.answerScreen, ...(activity.answerScreen || {}) },
    slides: syncedSlides,
    currentSlideId,
    startSlideId,
    dragDropDefaults,
    dragDropMode: activity.dragDropMode || 'single',
    dragDropMatches: activity.dragDropMatches ?? slideState.dragDropMatches ?? {},
    selectionUi: { ...DEFAULT_SELECTION_UI, ...(activity.selectionUi || slideState.selectionUi || {}) },
    mcOptions:
      Array.isArray(activity.mcOptions) && activity.mcOptions.length
        ? activity.mcOptions.map((opt) => ({ ...opt, id: opt.id || uid() }))
        : Array.isArray(slideState.mcOptions) && slideState.mcOptions.length
          ? slideState.mcOptions.map((opt) => ({ ...opt, id: opt.id || uid() }))
          : fallback.mcOptions,
  };
  return normalizeButtonPairLayoutForActivity(materializeActivity(nextActivity));
}




function normalizeBook(book = {}, index = 0) {
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

function pickBookLayerPresetPayload(activity = {}) {
  const normalizedActivity = normalizeButtonPairLayoutForActivity(activity);
  return BOOK_LAYER_PRESET_KEYS.reduce((acc, key) => {
    acc[key] = safeClone(
      normalizedActivity?.[key],
      Array.isArray(normalizedActivity?.[key]) ? [] : ''
    );
    return acc;
  }, {});
}

function normalizeLayerPreset(preset = {}, index = 0) {
  const name = String(preset.name || '').trim() || `Layer Set ${index + 1}`;
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

function applyBookLayerPresetToActivity(activity = {}, preset = null) {
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



function pickTextStudioDesign(activity = {}) {
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

function normalizeTextStudioPreset(preset = {}, index = 0) {
  const name = String(preset.name || '').trim() || `Tasarım ${index + 1}`;
  return {
    id: preset.id || uid(),
    name,
    createdAt: preset.createdAt || new Date().toISOString(),
    updatedAt: preset.updatedAt || preset.createdAt || new Date().toISOString(),
    payload: pickTextStudioDesign(preset.payload || preset.design || preset),
  };
}

function applyTextStudioPreset(activity = {}, preset = {}) {
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

function normalizeState(state = {}) {
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

function normalizeActivityForRuntimeSnapshot(activity = {}) {
  return enforceTtkbActivityCompliance(
    syncAnswerPlacementObjects(normalizeActivity(commitMaterializedActivity(activity)))
  );
}

function createRuntimeStateSnapshot(state = {}, currentActivitySnapshot = null) {
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

function createPreviewHtmlSignature(value = '') {
  const text = String(value || '');
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

const REDACTED_SECRET_VALUE = '__REDACTED_SECRET__';
const SENSITIVE_LMS_KEYS = ['xapiKey', 'xapiSecret', 'ltiConsumerKey', 'ltiSharedSecret'];
const EXTERNAL_URL_RE = /^https?:\/\//i;

function hasLmsSecrets(value = {}) {
  return SENSITIVE_LMS_KEYS.some(
    (key) => String(value?.[key] || '').trim() && value[key] !== REDACTED_SECRET_VALUE
  );
}

function maskLmsSecrets(config = {}, redactionValue = '') {
  const next = { ...(config || {}) };
  SENSITIVE_LMS_KEYS.forEach((key) => {
    if (next[key] === REDACTED_SECRET_VALUE || String(next[key] || '').trim()) {
      next[key] = redactionValue;
    }
  });
  return next;
}

function clearRedactedLmsSecrets(config = {}) {
  const next = { ...(config || {}) };
  SENSITIVE_LMS_KEYS.forEach((key) => {
    if (next[key] === REDACTED_SECRET_VALUE) next[key] = '';
  });
  return next;
}

function normalizeScorm12LmsConfig(config = {}) {
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

function collectExternalUrls(value, path = '', found = new Map()) {
  if (value == null) return found;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (EXTERNAL_URL_RE.test(trimmed)) {
      const list = found.get(trimmed) || [];
      list.push(path || 'state');
      found.set(trimmed, list);
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

function summarizeExternalUrlsForScorm(state = {}) {
  return [...collectExternalUrls(state).entries()].map(([url, paths]) => ({
    url,
    paths: [...new Set(paths)].slice(0, 3),
  }));
}

function createSafeStateForStorage(state = {}) {
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

function createSafeStateForExport(state = {}) {
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

function stateHasLmsSecrets(state = {}) {
  return (
    hasLmsSecrets(state.lmsConfig) ||
    (Array.isArray(state.activities) &&
      state.activities.some((activity) => hasLmsSecrets(activity?.lmsConfig)))
  );
}


function restyleActivityButtonMotion(activity = {}, profileId = '') {
  const motion = getButtonMotionProfile(profileId);
  if (!motion)
    return normalizeActivity({
      ...activity,
      buttonAnimationProfileId: profileId || activity.buttonAnimationProfileId || '',
    });
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

// eslint-disable-next-line no-unused-vars -- Reserved for the editor quality checklist UI.
function buildActivityQualityChecks(activity = {}) {
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
        ? `${invalidTriggerTargets.length} trigger hedefi eksik`
        : `${triggers.length} trigger temiz`,
    },
    {
      label: 'Akış',
      ok: hasScreenFlow && stageWidth >= 320 && stageHeight >= 240,
      detail: hasScreenFlow
        ? `${Math.round(stageWidth)}x${Math.round(stageHeight)} sahne hazir`
        : 'Giris/menu akisi kapali',
    },
  ];
}











function activityHasClosedCaptions(activity = {}) {
  return (activity?.objects || []).some(
    (obj) => obj?.type === 'video' && (obj.closedCaptions || []).some((cc) => cc?.src)
  );
}



// eslint-disable-next-line no-unused-vars -- Kept as the full learner-runtime renderer; preview uses a stricter editor-parity renderer below.





function StorylineScormPlayerPreview({
  open,
  onClose,
  activity,
  activities = [],
  variables = [],
  snapshotState = null,
}) {
  const previewActivities = useMemo(() => {
    const snapshotActivities =
      Array.isArray(snapshotState?.activities) && snapshotState.activities.length
        ? snapshotState.activities
        : null;
    const source =
      snapshotActivities ||
      (Array.isArray(activities) && activities.length ? activities : activity ? [activity] : []);
    return source.filter(Boolean).map((item) => normalizeActivityForRuntimeSnapshot(item));
  }, [activities, activity, snapshotState]);
  const snapshotVariables = snapshotState?.variables || variables;
  const [selectedActivityId, setSelectedActivityId] = useState(
    () => snapshotState?.selActId || activity?.id || previewActivities[0]?.id || ''
  );

  useEffect(() => {
    if (!open) return;
    const preferredId = snapshotState?.selActId || activity?.id || previewActivities[0]?.id || '';
    if (!preferredId) return;
    if (
      selectedActivityId !== preferredId &&
      previewActivities.some((item) => item.id === preferredId)
    ) {
      setSelectedActivityId(preferredId);
      return;
    }
    if (!previewActivities.some((item) => item.id === selectedActivityId)) {
      setSelectedActivityId(preferredId);
    }
  }, [activity?.id, open, previewActivities, selectedActivityId, snapshotState?.selActId]);

  const selectedActivity =
    previewActivities.find((item) => item.id === selectedActivityId) ||
    previewActivities[0] ||
    null;
  const previewState = useMemo(
    () => ({
      activities: previewActivities,
      selActId: selectedActivity?.id || '',
      variables: snapshotVariables,
    }),
    [previewActivities, selectedActivity?.id, snapshotVariables]
  );
  const playerHtml = useMemo(
    () =>
      selectedActivity
        ? buildStorylinePlayerHtml(
            previewState,
            { packageName: selectedActivity.name || 'Önizleme' },
            { scope: 'activity', activityId: selectedActivity.id }
          )
        : '',
    [previewState, selectedActivity]
  );
  const playerHtmlSignature = useMemo(() => createPreviewHtmlSignature(playerHtml), [playerHtml]);

  if (!open) return null;

  if (!selectedActivity) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1200,
          background: 'rgba(15,23,42,.86)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#e5edf8',
        }}
      >
        <div
          style={{
            width: 'min(420px, 90vw)',
            borderRadius: 16,
            background: '#ffffff',
            color: '#0f172a',
            padding: 22,
            boxShadow: '0 28px 70px rgba(0,0,0,.42)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 8 }}>
            Önizleme için sahne yok
          </div>
          <button
            onClick={onClose}
            style={{
              height: 34,
              padding: '0 16px',
              borderRadius: 9,
              border: 'none',
              background: '#0f172a',
              color: '#ffffff',
              fontSize: 12,
              fontWeight: 900,
              cursor: 'pointer',
            }}
          >
            Kapat
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
        background: '#202833',
        color: '#1f2937',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Segoe UI',Tahoma,Geneva,Verdana,sans-serif",
      }}
    >
      <div
        style={{
          minHeight: 48,
          borderBottom: '1px solid #151b24',
          background: 'linear-gradient(180deg,#f8fafc,#e5ebf3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          padding: '0 12px',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 6,
              border: '1px solid #b8c5d4',
              background: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0f6fb5',
              fontWeight: 900,
            }}
          >
            ▶
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 900,
                color: '#0f172a',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              SCORM ile Aynı Önizleme
            </div>
            <div
              style={{
                fontSize: 11,
                color: '#64748b',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {selectedActivity.name || 'Etkinlik'} · Aynı player HTML
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {previewActivities.length > 1 && (
            <select
              value={selectedActivity.id}
              onChange={(e) => setSelectedActivityId(e.target.value)}
              style={{
                height: 32,
                minWidth: 220,
                borderRadius: 7,
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#334155',
                fontSize: 12,
                fontWeight: 800,
                padding: '0 10px',
              }}
            >
              {previewActivities.map((item, index) => (
                <option key={item.id} value={item.id}>
                  {index + 1}. {item.name || `Etkinlik ${index + 1}`}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={onClose}
            style={{
              height: 32,
              padding: '0 14px',
              borderRadius: 7,
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#0f172a',
              fontSize: 12,
              fontWeight: 900,
              cursor: 'pointer',
            }}
          >
            Kapat
          </button>
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, padding: 14, background: '#bfc8d1' }}>
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: 14,
            overflow: 'hidden',
            border: '1px solid rgba(71,85,105,.35)',
            boxShadow: '0 18px 46px rgba(15,23,42,.28)',
            background: '#101820',
          }}
        >
          <iframe
            key={`${selectedActivity.id}-${playerHtmlSignature}`}
            title="SCORM Preview"
            srcDoc={playerHtml}
            sandbox="allow-scripts allow-same-origin"
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              display: 'block',
              background: '#101820',
            }}
          />
        </div>
      </div>
    </div>
  );
}

function EditorScenesPanel({
  activity,
  onUpdateActivity,
  getActivitySlides,
  selectActivitySlide,
  createSlide,
  normalizeSlide,
}) {
  const slides = getActivitySlides(activity || {});
  const currentSlideId = activity?.currentSlideId || slides[0]?.id || '';
  const currentSlideIndex = Math.max(
    0,
    slides.findIndex((item) => item.id === currentSlideId)
  );
  const isMainScene = currentSlideIndex === 0;
  const canMoveUp = currentSlideIndex > 0;
  const canMoveDown = currentSlideIndex >= 0 && currentSlideIndex < slides.length - 1;
  const [dragSceneId, setDragSceneId] = useState('');
  const [dragOverSceneId, setDragOverSceneId] = useState('');
  const dragSceneIdRef = useRef('');

  const handleSelectSlide = (slideId) => {
    if (!activity || !slideId) return;
    onUpdateActivity(selectActivitySlide(activity, slideId));
  };

  const handleAddSlide = () => {
    if (!activity) return;
    const newSlide = createSlide(`Sahne ${slides.length + 1}`, slides.length);
    onUpdateActivity(
      selectActivitySlide(
        { ...activity, slides: [...slides, newSlide], currentSlideId: newSlide.id },
        newSlide.id
      )
    );
  };

  const handleDuplicateSlide = (slideId) => {
    if (!activity) return;
    const source = slides.find((slide) => slide.id === slideId);
    if (!source) return;
    const copy = normalizeSlide(
      {
        ...source,
        id: uid(),
        name: `${source.name || 'Sahne'} Kopya`,
        sceneName: source.sceneName || source.name || 'Sahne',
      },
      slides.length
    );
    onUpdateActivity(
      selectActivitySlide(
        { ...activity, slides: [...slides, copy], currentSlideId: copy.id },
        copy.id
      )
    );
  };

  const handleDeleteSlide = (slideId) => {
    if (!activity || slides.length <= 1) return;
    const nextSlides = slides.filter((slide) => slide.id !== slideId);
    const fallbackSlide =
      nextSlides[Math.max(0, slides.findIndex((slide) => slide.id === slideId) - 1)] ||
      nextSlides[0];
    const fallbackId = fallbackSlide?.id || nextSlides[0]?.id || '';
    onUpdateActivity(
      selectActivitySlide(
        { ...activity, slides: nextSlides, currentSlideId: fallbackId },
        fallbackId
      )
    );
  };

  const reorderSlides = (slideId, targetIndex) => {
    if (!activity || !slideId) return;
    const fromIndex = slides.findIndex((slide) => slide.id === slideId);
    const toIndex = clamp(Number(targetIndex), 0, Math.max(0, slides.length - 1));
    if (fromIndex < 0 || fromIndex === toIndex) return;
    const nextSlides = [...slides];
    const [moved] = nextSlides.splice(fromIndex, 1);
    nextSlides.splice(toIndex, 0, moved);
    onUpdateActivity(
      selectActivitySlide({ ...activity, slides: nextSlides, currentSlideId: slideId }, slideId)
    );
  };

  const startSceneDrag = (event, slideId) => {
    dragSceneIdRef.current = slideId;
    setDragSceneId(slideId);
    if (event?.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', slideId);
    }
  };

  const clearSceneDrag = () => {
    dragSceneIdRef.current = '';
    setDragSceneId('');
    setDragOverSceneId('');
  };

  const handleSceneDrop = (event, targetSlideId) => {
    event?.preventDefault?.();
    const sourceSlideId =
      dragSceneIdRef.current || event?.dataTransfer?.getData?.('text/plain') || dragSceneId;
    if (!sourceSlideId || !targetSlideId || sourceSlideId === targetSlideId) {
      clearSceneDrag();
      setDragSceneId('');
      setDragOverSceneId('');
      return;
    }
    const targetIndex = slides.findIndex((item) => item.id === targetSlideId);
    if (targetIndex >= 0) reorderSlides(sourceSlideId, targetIndex);
    clearSceneDrag();
  };

  return (
    <div
      style={{
        height: '100%',
        minHeight: 0,
        background: '#eef2f6',
        display: 'flex',
        flexDirection: 'column',
        color: '#334155',
      }}
    >
      <div
        style={{
          padding: '7px 8px 6px',
          borderBottom: '1px solid #d2dbe6',
          background: '#f6f8fb',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 5,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 600, color: '#334155' }}>Sahneler</div>
          <div style={{ width: 16, height: 16, position: 'relative', opacity: 0.5 }}>
            <span
              style={{
                position: 'absolute',
                right: 2,
                top: 2,
                width: 9,
                height: 8,
                border: '1px solid #64748b',
                background: '#f8fafc',
              }}
            />
            <span
              style={{
                position: 'absolute',
                left: 3,
                bottom: 3,
                width: 9,
                height: 8,
                border: '1px solid #64748b',
                background: '#f8fafc',
              }}
            />
          </div>
        </div>
        <select
          value={currentSlideId}
          onChange={(event) => handleSelectSlide(event.target.value)}
          style={{
            width: '100%',
            height: 24,
            border: '1px solid #c8d2dd',
            background: '#ffffff',
            color: '#425466',
            fontSize: 10,
            padding: '0 7px',
            outline: 'none',
          }}
        >
          {slides.map((item, index) => (
            <option
              key={item.id}
              value={item.id}
            >{`${index + 1} ${item.name || item.sceneName || 'İsimsiz Sahne'}`}</option>
          ))}
        </select>
        <div style={{ display: 'flex', gap: 3, marginTop: 5, overflowX: 'auto', paddingBottom: 1 }}>
          {slides.map((item, index) => {
            const isActiveScene = item.id === currentSlideId;
            const isDragOver =
              dragOverSceneId === item.id && dragSceneId && dragSceneId !== item.id;
            return (
              <button
                key={item.id}
                draggable
                onDragStart={(event) => startSceneDrag(event, item.id)}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOverSceneId(item.id);
                  event.dataTransfer.dropEffect = 'move';
                }}
                onDragLeave={() =>
                  setDragOverSceneId((current) => (current === item.id ? '' : current))
                }
                onDrop={(event) => handleSceneDrop(event, item.id)}
                onDragEnd={clearSceneDrag}
                onClick={() => handleSelectSlide(item.id)}
                title={`${index + 1}. ${item.name || item.sceneName || 'İsimsiz Sahne'} - sürükleyip sırala`}
                style={{
                  flex: '0 0 auto',
                  minWidth: 24,
                  height: 18,
                  borderRadius: 3,
                  border: `1px solid ${isDragOver ? '#f97316' : isActiveScene ? '#60a5fa' : '#c8d2dd'}`,
                  background: isActiveScene ? '#e0f2fe' : '#ffffff',
                  color: isActiveScene ? '#075985' : '#475569',
                  fontSize: 9,
                  fontWeight: 800,
                  cursor: 'grab',
                  boxShadow: isDragOver ? '0 0 0 2px rgba(249,115,22,.14)' : 'none',
                }}
              >
                {index + 1}
              </button>
            );
          })}
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 22px 22px 22px',
            gap: 3,
            alignItems: 'center',
            marginTop: 4,
          }}
        >
          <button
            onClick={() => reorderSlides(currentSlideId, 0)}
            disabled={isMainScene || !activity}
            style={{
              height: 20,
              borderRadius: 3,
              border: `1px solid ${isMainScene ? '#bbf7d0' : '#bfdbfe'}`,
              background: isMainScene ? '#f0fdf4' : '#eff6ff',
              color: isMainScene ? '#15803d' : '#1d4ed8',
              fontSize: 9,
              fontWeight: 800,
              cursor: isMainScene || !activity ? 'default' : 'pointer',
              lineHeight: 1.05,
            }}
          >
            {isMainScene ? 'Ana' : 'Ana Yap'}
          </button>
          <button
            onClick={() => reorderSlides(currentSlideId, currentSlideIndex - 1)}
            disabled={!canMoveUp}
            title="Scene yukarı taşı"
            style={{
              height: 20,
              borderRadius: 3,
              border: '1px solid #c8d2dd',
              background: '#ffffff',
              color: canMoveUp ? '#475569' : '#cbd5e1',
              fontSize: 10,
              fontWeight: 900,
              cursor: canMoveUp ? 'pointer' : 'default',
            }}
          >
            ↑
          </button>
          <button
            onClick={() => reorderSlides(currentSlideId, currentSlideIndex + 1)}
            disabled={!canMoveDown}
            title="Scene aşağı taşı"
            style={{
              height: 20,
              borderRadius: 3,
              border: '1px solid #c8d2dd',
              background: '#ffffff',
              color: canMoveDown ? '#475569' : '#cbd5e1',
              fontSize: 10,
              fontWeight: 900,
              cursor: canMoveDown ? 'pointer' : 'default',
            }}
          >
            ↓
          </button>
          <button
            onClick={handleAddSlide}
            title="Slide ekle"
            style={{
              height: 20,
              borderRadius: 3,
              border: '1px solid #c8d2dd',
              background: '#ffffff',
              color: '#475569',
              fontSize: 12,
              lineHeight: 1,
              fontWeight: 900,
              cursor: 'pointer',
            }}
          >
            +
          </button>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '12px 8px 22px',
          background: '#eef2f6',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
            position: 'relative',
          }}
        >
          {slides.map((slide, index) => {
            const isActive = slide.id === currentSlideId;
            const isDragOver =
              dragOverSceneId === slide.id && dragSceneId && dragSceneId !== slide.id;
            return (
              <div
                key={slide.id}
                draggable
                onDragStart={(event) => startSceneDrag(event, slide.id)}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOverSceneId(slide.id);
                  event.dataTransfer.dropEffect = 'move';
                }}
                onDragLeave={() =>
                  setDragOverSceneId((current) => (current === slide.id ? '' : current))
                }
                onDrop={(event) => handleSceneDrop(event, slide.id)}
                onDragEnd={clearSceneDrag}
                style={{
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  position: 'relative',
                  minWidth: 0,
                  cursor: 'grab',
                  opacity: dragSceneId === slide.id ? 0.58 : 1,
                }}
              >
                {index > 0 && (
                  <div
                    style={{
                      width: 1,
                      height: 12,
                      marginBottom: 5,
                      background: '#9fb0c3',
                      position: 'relative',
                      flexShrink: 0,
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        left: -3,
                        bottom: -4,
                        width: 0,
                        height: 0,
                        borderLeft: '4px solid transparent',
                        borderRight: '4px solid transparent',
                        borderTop: '6px solid #9fb0c3',
                      }}
                    />
                  </div>
                )}
                <button
                  onClick={() => handleSelectSlide(slide.id)}
                  style={{
                    width: 98,
                    height: 58,
                    padding: 3,
                    border: `1px solid ${isDragOver ? '#f97316' : isActive ? '#38bdf8' : '#c7d0db'}`,
                    background: '#ffffff',
                    borderRadius: 7,
                    cursor: 'pointer',
                    boxShadow: isDragOver
                      ? '0 0 0 3px rgba(249,115,22,.18), 0 4px 10px rgba(15,23,42,.12)'
                      : isActive
                        ? '0 0 0 2px rgba(14,165,233,.26), 0 5px 14px rgba(14,165,233,.18)'
                        : '0 2px 6px rgba(15,23,42,.10)',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <SlideThumbnail
                    slide={slide}
                    isActive={false}
                    width={90}
                    height={51}
                    showBadges={false}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      top: 3,
                      left: 3,
                      minWidth: 16,
                      height: 14,
                      borderRadius: 4,
                      background: isActive ? '#0284c7' : 'rgba(15,23,42,.62)',
                      color: '#ffffff',
                      fontSize: 9,
                      fontWeight: 900,
                      lineHeight: '14px',
                      textAlign: 'center',
                    }}
                  >
                    {index + 1}
                  </span>
                </button>
                <div
                  style={{
                    width: '100%',
                    maxWidth: 132,
                    marginTop: 5,
                    fontSize: 10,
                    color: isActive ? '#0f172a' : '#475569',
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    fontWeight: isActive ? 800 : 600,
                    lineHeight: 1.15,
                  }}
                >
                  {`1.${index + 1} ${slide.name || slide.sceneName || 'İsimsiz Sahne'}`}
                </div>
                <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                  <button
                    onClick={() => handleDuplicateSlide(slide.id)}
                    title="Slide kopyala"
                    style={{
                      width: 19,
                      height: 17,
                      borderRadius: 3,
                      border: '1px solid #d2dbe6',
                      background: '#ffffff',
                      color: '#64748b',
                      fontSize: 9,
                      cursor: 'pointer',
                    }}
                  >
                    ⧉
                  </button>
                  <button
                    onClick={() => handleDeleteSlide(slide.id)}
                    disabled={slides.length <= 1}
                    title="Slide sil"
                    style={{
                      width: 19,
                      height: 17,
                      borderRadius: 3,
                      border: '1px solid #fecaca',
                      background: '#ffffff',
                      color: slides.length <= 1 ? '#cbd5e1' : '#dc2626',
                      fontSize: 11,
                      cursor: slides.length <= 1 ? 'default' : 'pointer',
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function getDragDropAssignments(activity) {
  const canvasObjects = getCanvasObjects(activity);
  const drags = canvasObjects.filter((o) => o.type === 'draggable');
  const drops = canvasObjects.filter((o) => o.type === 'dropzone');
  const usedDropCounts = {};
  const pairs = [];

  drags.forEach((drag, index) => {
    const scopeFiltered = drops.filter((drop) => areDragDropScopesCompatible(activity, drag, drop));
    if (!scopeFiltered.length) return;

    const sameGroup = drag.group
      ? scopeFiltered.filter(
          (drop) => normalizePdfText(drop.group || '') === normalizePdfText(drag.group || '')
        )
      : [];
    const sameLabel = drag.label
      ? scopeFiltered.filter(
          (drop) => normalizePdfText(drop.label || '') === normalizePdfText(drag.label || '')
        )
      : [];
    const basePool = sameGroup.length ? sameGroup : sameLabel.length ? sameLabel : scopeFiltered;
    const reusable = isDragReusable(activity, drag);
    const acceptedDropIds = [];

    basePool.forEach((drop, candidateIndex) => {
      const capacity = getDropCapacityLimit(activity, drop);
      const currentCount = usedDropCounts[drop.id] || 0;
      const canUseDrop = capacity === 0 || currentCount < capacity;
      const isFallbackCandidate = !sameGroup.length && !sameLabel.length;
      if (!canUseDrop) return;
      if (!reusable && candidateIndex > 0) return;
      if (reusable && isFallbackCandidate && candidateIndex > 0) return;
      acceptedDropIds.push(drop.id);
      usedDropCounts[drop.id] = currentCount + 1;
    });

    if (!acceptedDropIds.length) {
      const fallback = scopeFiltered[index] || scopeFiltered[0];
      if (!fallback) return;
      const capacity = getDropCapacityLimit(activity, fallback);
      const currentCount = usedDropCounts[fallback.id] || 0;
      if (capacity !== 0 && currentCount >= capacity) return;
      acceptedDropIds.push(fallback.id);
      usedDropCounts[fallback.id] = currentCount + 1;
    }

    acceptedDropIds.forEach((dropId) => {
      const drop = drops.find((item) => item.id === dropId);
      if (drop) pairs.push({ drag, drop });
    });
  });

  return pairs;
}











function getAutoAnswerSummary(activity) {
  if (activity.type === 'drag-drop' || activity.type === 'mixed') {
    const dragById = Object.fromEntries(
      getCanvasObjects(activity)
        .filter((item) => item.type === 'draggable')
        .map((item) => [item.id, item])
    );
    const dropById = Object.fromEntries(
      getCanvasObjects(activity)
        .filter((item) => item.type === 'dropzone')
        .map((item) => [item.id, item])
    );
    const pairs = getDragDropPairsFromMatches(getCorrectDragMatches(activity)).map(
      ({ dragId, dropId }) =>
        `${dragById[dragId]?.label || 'Surukle'} → ${dropById[dropId]?.label || 'Birak'}`
    );
    return pairs.length ? pairs : ['Dogru eslesme henuz olusmadi.'];
  }
  const selectedOptionLabels = (activity.mcOptions || [])
    .filter((o) => o.isCorrect)
    .map((o) => o.label || 'Secenek');
  if (selectedOptionLabels.length) return [selectedOptionLabels.join(', ')];
  if (Array.isArray(activity.selectionSlots) && activity.selectionSlots.length) {
    const labels = activity.selectionSlots.map((slot, index) => {
      if (!slot?.correctChoice) return `${index + 1}. soru: anahtar okunamadi`;
      return `${index + 1}. soru: ${slot.correctLabel || String(slot.correctChoice).toUpperCase()}`;
    });
    return labels.length ? labels : ['Dogru secenek henuz tanimlanmadi.'];
  }
  return ['Dogru secenek henuz tanimlanmadi.'];
}

function getCorrectSelectionIds(activity) {
  return (activity.mcOptions || []).filter((o) => o.isCorrect).map((o) => o.id);
}

// ─── Scoring Engines for New Question Types ────────────────────────────────────

function scoreSequence(activity, userOrder) {
  const correct = (activity.sequenceItems || []).map((i) => i.id);
  if (!correct.length) return { success: false, score: 0, total: 0, detail: [] };
  const detail = correct.map((id, idx) => ({ id, correct: userOrder[idx] === id }));
  const score = detail.filter((d) => d.correct).length;
  return { success: score === correct.length, score, total: correct.length, detail };
}

function scoreMatching(activity, userPairs) {
  const correct = (activity.matchingPairs || []).map((p) => ({ left: p.left, right: p.right }));
  if (!correct.length) return { success: false, score: 0, total: 0, detail: [] };
  const detail = correct.map((cp) => {
    const match = (userPairs || []).find((up) => up.left === cp.left);
    return {
      left: cp.left,
      expected: cp.right,
      given: match?.right || '',
      correct: match?.right === cp.right,
    };
  });
  const score = detail.filter((d) => d.correct).length;
  return { success: score === correct.length, score, total: correct.length, detail };
}

function scoreTextEntry(activity, userText) {
  const accepted = (activity.textEntryAcceptedAnswers || []).filter(Boolean);
  if (!accepted.length) return { success: false, score: 0, total: 1 };
  const caseSensitive = !!activity.textEntryCaseSensitive;
  const normalize = (s) => (caseSensitive ? s.trim() : s.trim().toLowerCase());
  const match = accepted.some((a) => normalize(a) === normalize(userText || ''));
  return { success: match, score: match ? 1 : 0, total: 1 };
}

function scoreNumeric(activity, userValue) {
  const correct = activity.numericCorrectValue ?? null;
  if (correct === null) return { success: false, score: 0, total: 1 };
  const tolerance = activity.numericTolerance ?? 0;
  const val = parseFloat(userValue);
  if (isNaN(val)) return { success: false, score: 0, total: 1 };
  const match = Math.abs(val - correct) <= tolerance;
  return { success: match, score: match ? 1 : 0, total: 1 };
}

function scoreFillBlank(activity, userBlanks) {
  const blanks = activity.fillBlankAnswers || [];
  if (!blanks.length) return { success: false, score: 0, total: 0, detail: [] };
  const detail = blanks.map((blank, idx) => {
    const accepted = blank.acceptedValues || [];
    const user = (userBlanks || [])[idx] || '';
    const caseSensitive = !!blank.caseSensitive;
    const normalize = (s) => (caseSensitive ? s.trim() : s.trim().toLowerCase());
    const correct = accepted.some((a) => normalize(a) === normalize(user));
    return { blankIndex: idx, correct, given: user };
  });
  const score = detail.filter((d) => d.correct).length;
  return { success: score === blanks.length, score, total: blanks.length, detail };
}

function scoreSurvey() {
  return { success: true, score: 0, total: 0, isSurvey: true };
}

function scoreActivity(activity, userResponse) {
  switch (activity.type) {
    case 'sequence':
      return scoreSequence(activity, userResponse.order || []);
    case 'matching':
      return scoreMatching(activity, userResponse.pairs || []);
    case 'text-entry':
      return scoreTextEntry(activity, userResponse.text || '');
    case 'numeric':
      return scoreNumeric(activity, userResponse.value);
    case 'fill-blank':
      return scoreFillBlank(activity, userResponse.blanks || []);
    case 'survey':
      return scoreSurvey();
    default:
      return null;
  }
}

// eslint-disable-next-line no-unused-vars -- Reserved for auto-layout of matched drag items.
function layoutDragPositionsForMatches(activity, matches = {}) {
  const canvasObjects = getCanvasObjects(activity);
  const drags = canvasObjects.filter((o) => o.type === 'draggable');
  const drops = canvasObjects.filter((o) => o.type === 'dropzone');
  const dragById = Object.fromEntries(drags.map((d) => [d.id, d]));
  const dropById = Object.fromEntries(drops.map((dz) => [dz.id, dz]));
  const grouped = {};

  getDragDropPairsFromMatches(matches).forEach(({ dragId, dropId }) => {
    if (!dragById[dragId] || !dropById[dropId]) return;
    grouped[dropId] = grouped[dropId] || [];
    grouped[dropId].push({ dragId, pairKey: getDragDropPairKey(dragId, dropId) });
  });

  const positioned = {};

  Object.entries(grouped).forEach(([dropId, dragEntries]) => {
    const drop = dropById[dropId];
    const count = dragEntries.length;
    if (!drop || count === 0) return;

    const cols = count === 1 ? 1 : count === 2 ? 2 : Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    const cellWidth = drop.width / cols;
    const cellHeight = drop.height / rows;
    const padding = Math.max(6, Math.min(drop.width, drop.height) * 0.05);

    dragEntries.forEach(({ dragId, pairKey }, index) => {
      const drag = dragById[dragId];
      if (!drag) return;

      const col = index % cols;
      const row = Math.floor(index / cols);
      const slotX = drop.x + col * cellWidth;
      const slotY = drop.y + row * cellHeight;
      const maxX = drop.x + drop.width - drag.width - padding;
      const maxY = drop.y + drop.height - drag.height - padding;
      const targetX = slotX + (cellWidth - drag.width) / 2;
      const targetY = slotY + (cellHeight - drag.height) / 2;

      positioned[pairKey] = {
        x: Math.max(drop.x + padding, Math.min(targetX, maxX)),
        y: Math.max(drop.y + padding, Math.min(targetY, maxY)),
      };
    });
  });

  return positioned;
}

// eslint-disable-next-line no-unused-vars -- Runtime engine now owns this; retained for dormant editor migrations.
function buildAutoDragMatches(activity) {
  const preferArrays = !!getDragDropAssignments(activity).some(({ drag }) =>
    isDragReusable(activity, drag)
  );
  return buildDragDropMatchMapFromPairs(
    getDragDropAssignments(activity).map(({ drag, drop }) => ({
      dragId: drag.id,
      dropId: drop.id,
    })),
    preferArrays
  );
}




function buildDragDropPlacementLayout(activity, placements = {}, activeLayerId = null) {
  const canvasObjects = getCanvasObjects(activeLayerId ? { ...activity, activeLayerId } : activity);
  const drags = canvasObjects.filter((item) => item.type === 'draggable');
  const drops = canvasObjects.filter((item) => item.type === 'dropzone');
  const dragById = Object.fromEntries(drags.map((item) => [item.id, item]));
  const dropById = Object.fromEntries(drops.map((item) => [item.id, item]));
  const grouped = {};
  const frames = {};

  (placements || []).forEach((entry) => {
    if (!entry?.id || !dragById[entry.dragId] || !dropById[entry.dropId]) return;
    grouped[entry.dropId] = grouped[entry.dropId] || [];
    grouped[entry.dropId].push(entry);
  });

  Object.entries(grouped).forEach(([dropId, entries]) => {
    const drop = dropById[dropId];
    if (!drop) return;
    const count = entries.length;
    const cols = count === 1 ? 1 : count === 2 ? 2 : Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    const cellWidth = drop.width / cols;
    const cellHeight = drop.height / rows;
    const padding = Math.max(6, Math.min(drop.width, drop.height) * 0.05);

    entries.forEach((entry, index) => {
      const drag = dragById[entry.dragId];
      if (!drag) return;
      const col = index % cols;
      const row = Math.floor(index / cols);
      const slotX = drop.x + col * cellWidth;
      const slotY = drop.y + row * cellHeight;
      const maxX = drop.x + drop.width - drag.width - padding;
      const maxY = drop.y + drop.height - drag.height - padding;
      const targetX = slotX + (cellWidth - drag.width) / 2;
      const targetY = slotY + (cellHeight - drag.height) / 2;
      frames[entry.id] = {
        x: Math.max(drop.x + padding, Math.min(targetX, maxX)),
        y: Math.max(drop.y + padding, Math.min(targetY, maxY)),
        width: drag.width,
        height: drag.height,
        drag,
        drop,
      };
    });
  });

  return frames;
}

// eslint-disable-next-line no-unused-vars -- Runtime engine now owns live scoring; retained for older editor flows.
function evaluateDragDropPlacements(
  activity,
  placements = [],
  expectedMatches = getCorrectDragMatches(activity)
) {
  const dropAssignments = Object.fromEntries(
    (placements || []).map((entry) => [
      entry.dragKey || entry.dragId,
      entry.dropKey || entry.dropId,
    ])
  );
  return evaluateStorylineRuntimeDragDrop({
    slide: activity,
    objects: getCanvasObjects(activity, 'base'),
    dropAssignments,
    expectedMatches,
  });
}

function ButtonPackageIntroDiagram({ pkgId, config = {} }) {
  const pkg = BUTTON_PACKAGES.find((item) => item.id === pkgId) || BUTTON_PACKAGES[0];
  const theme = getPackageTheme(pkg.id);
  const accent = theme.accent || pkg.color;
  const rows = resolveThemePackageItems(config);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          padding: '12px 14px',
          borderRadius: 18,
          background: `linear-gradient(135deg,${accent}18,rgba(255,255,255,.96))`,
          border: `1px solid ${accent}33`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 14,
              display: 'grid',
              placeItems: 'center',
              background: theme.button,
              color: theme.text,
              fontSize: 20,
              fontWeight: 900,
              boxShadow: `0 10px 20px ${accent}22`,
            }}
          >
            {pkg.icon || '🎨'}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', marginBottom: 2 }}>
              Tema Paketi Önizlemesi
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.55, color: '#475569' }}>
              {pkg.name} · {pkg.desc}
            </div>
          </div>
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: accent,
            background: `${accent}14`,
            border: `1px solid ${accent}30`,
            borderRadius: 999,
            padding: '5px 9px',
          }}
        >
          {pkg.trigger} · {pkg.anim}
        </span>
      </div>

      <div
        style={{
          background: 'linear-gradient(180deg,#f8fafc,#eef4ff)',
          borderRadius: 24,
          padding: 14,
          boxShadow: 'inset 0 0 0 1px rgba(148,163,184,.24)',
          overflow: 'hidden',
        }}
      >
        <div style={{ fontSize: 12, lineHeight: 1.55, color: '#475569', marginBottom: 10 }}>
          Seçtiğin tema paketi aşağıdaki tüm butonları birlikte günceller:
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
            gap: 10,
          }}
        >
          {rows.map((item) => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                padding: '10px 12px',
                borderRadius: 16,
                background: '#ffffff',
                border: `1px solid ${accent}22`,
                boxShadow: '0 6px 18px rgba(15,23,42,.05)',
              }}
            >
              <div
                style={{
                  minHeight: 42,
                  borderRadius: theme.radius || 999,
                  background: theme.button,
                  color: theme.text,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '0 12px',
                  fontSize: 12,
                  fontWeight: 900,
                  overflow: 'hidden',
                  boxShadow: `0 10px 24px ${accent}22`,
                }}
              >
                <span
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    flexShrink: 0,
                    background: 'rgba(255,255,255,.94)',
                    color: accent,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    fontWeight: 900,
                  }}
                >
                  {item.icon}
                </span>
                <span
                  style={{
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.label}
                </span>
              </div>
              <div
                style={{
                  minWidth: 0,
                  padding: '8px 10px',
                  borderRadius: 12,
                  background: `${accent}12`,
                  border: `1px solid ${accent}24`,
                  color: '#334155',
                  fontSize: 12,
                  lineHeight: 1.45,
                }}
              >
                {item.desc}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Seçim Editörü ────────────────────────────────────────────────────────────


// ─── Sürükle-Bırak Yapılandırma Paneli ───────────────────────────────────────

// ─── Ekran Akışı Editörü ──────────────────────────────────────────────────────


/* ActivityScreenFlowEditor kaldırıldı — ölü kod, hiçbir yerden render edilmiyordu */

function ActivityTextEditor({
  activity,
  onUpdate,
  designPresets = [],
  onSavePreset,
  onApplyPreset,
  onDeletePreset,
  visibleSectionIds = [],
  preferredOpenSection = 'intro',
  sectionTitle = '',
}) {
  const [openSection, setOpenSection] = useState('intro');
  const [openSub, setOpenSub] = useState('text');
  const [presetName, setPresetName] = useState('');
  const [selectedPresetId, setSelectedPresetId] = useState('');
  const [pkgGradeFilter, setPkgGradeFilter] = useState('all');
  const intro = useMemo(() => activity.introScreen || {}, [activity.introScreen]);
  const packageScreen = useMemo(
    () => activity.buttonPackageScreen || {},
    [activity.buttonPackageScreen]
  );
  const menuScreen = activity.menuScreen || {};
  const playScreen = activity.playScreen || {};
  const results = activity.resultScreens || {};
  const answerScreen = activity.answerScreen || {};
  const settings = activity.settings || {};
  const resolvedPackageTitle =
    !packageScreen.title || /buton paketi/i.test(packageScreen.title)
      ? 'Tema Paketi Tanıtımı'
      : packageScreen.title;
  const resolvedPackageBody =
    !packageScreen.body || /buton.*davran/i.test(packageScreen.body)
      ? 'Etkinlikte kullanacağın tema paketini ve buton davranışlarını önce incele.'
      : packageScreen.body;
  const packageItems = resolveThemePackageItems(packageScreen);
  const patch = useCallback((p) => onUpdate({ ...activity, ...p }), [activity, onUpdate]);
  const patchIntro = useCallback(
    (p) => patch({ introScreen: { ...intro, ...p } }),
    [intro, patch]
  );
  const patchPackage = useCallback(
    (p) => patch({ buttonPackageScreen: { ...packageScreen, ...p } }),
    [packageScreen, patch]
  );
  const patchPackageItem = (itemId, nextPatch) =>
    patchPackage({
      items: packageItems.map((item) => (item.id === itemId ? { ...item, ...nextPatch } : item)),
    });
  const patchMenu = (p) => patch({ menuScreen: { ...menuScreen, ...p } });
  const patchPlay = (p) => patch({ playScreen: { ...playScreen, ...p } });
  const patchResults = (p) => patch({ resultScreens: { ...results, ...p } });
  const patchAnswer = (p) => patch({ answerScreen: { ...answerScreen, ...p } });
  const patchSettings = (p) => patch({ settings: { ...settings, ...p } });

  const theme = getPackageTheme(activity.buttonPackageId);
  const normalizedVisibleSectionIds = Array.isArray(visibleSectionIds)
    ? visibleSectionIds.filter(Boolean)
    : [];
  const selectedPreset = designPresets.find((item) => item.id === selectedPresetId) || null;

  useEffect(() => {
    if (!preferredOpenSection) return;
    setOpenSection(preferredOpenSection);
    setOpenSub(preferredOpenSection === 'behavior' ? 'behavior' : 'text');
  }, [preferredOpenSection]);

  useEffect(() => {
    setPresetName(`${activity?.name || 'Yeni Tasarım'} Tasarımı`);
  }, [activity?.id, activity?.name]);

  useEffect(() => {
    if (!designPresets.length) {
      setSelectedPresetId('');
      return;
    }
    if (!designPresets.some((item) => item.id === selectedPresetId)) {
      setSelectedPresetId(designPresets[0].id);
    }
  }, [designPresets, selectedPresetId]);

  useEffect(() => {
    const currIntro = activity.introScreen || {};
    if (!currIntro.style?.background) {
      patchIntro({ style: { ...currIntro.style, background: theme.intro } });
    }
    const currPkg = activity.buttonPackageScreen || {};
    if (!currPkg.style?.background) {
      patchPackage({ style: { ...currPkg.style, background: theme.intro } });
    }
  }, [
    activity.buttonPackageId,
    activity.buttonPackageScreen,
    activity.introScreen,
    patchIntro,
    patchPackage,
    theme.intro,
  ]);

  const handleSaveCurrentPreset = () => {
    const finalName =
      String(presetName || '').trim() || `${activity?.name || 'Yeni Tasarım'} Tasarımı`;
    const savedId = onSavePreset?.(finalName, activity);
    if (savedId) setSelectedPresetId(savedId);
  };

  const handleApplySelectedPreset = () => {
    if (!selectedPreset) return;
    onApplyPreset?.(selectedPreset.id, activity?.id);
  };

  const handleDeleteSelectedPreset = () => {
    if (!selectedPreset) return;
    if (
      typeof window !== 'undefined' &&
      !window.confirm(`"${selectedPreset.name}" tasarımını silmek istiyor musun?`)
    )
      return;
    onDeletePreset?.(selectedPreset.id);
    setSelectedPresetId('');
  };

  const inputBase = {
    width: '100%',
    padding: '5px 8px',
    borderRadius: 5,
    border: '1px solid #333',
    background: '#0f0f20',
    color: '#E0E0E0',
    fontSize: 11,
    boxSizing: 'border-box',
    outline: 'none',
  };
  const colorInput = (value, onChange, label) => (
    <div style={{ flex: 1, minWidth: 60 }}>
      <label style={{ fontSize: 11, color: '#78909C', display: 'block', marginBottom: 2 }}>
        {label}
      </label>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <input
          type="color"
          value={value || '#000000'}
          onChange={onChange}
          style={{
            width: 28,
            height: 24,
            border: '1px solid #333',
            borderRadius: 4,
            padding: 0,
            cursor: 'pointer',
            background: 'transparent',
          }}
        />
        <input
          type="text"
          value={value || ''}
          onChange={onChange}
          placeholder="#hex"
          style={{ ...inputBase, flex: 1 }}
        />
      </div>
    </div>
  );
  const numInput = (value, onChange, label, min = 0, max = 999) => (
    <div style={{ flex: 1, minWidth: 50 }}>
      <label style={{ fontSize: 11, color: '#78909C', display: 'block', marginBottom: 2 }}>
        {label}
      </label>
      <input
        type="number"
        value={value ?? ''}
        onChange={onChange}
        min={min}
        max={max}
        style={inputBase}
      />
    </div>
  );
  const textInput = (value, onChange, label, placeholder = '', rows) => (
    <div>
      <label style={{ fontSize: 11, color: '#78909C', display: 'block', marginBottom: 2 }}>
        {label}
      </label>
      {rows ? (
        <textarea
          value={value || ''}
          onChange={onChange}
          rows={rows}
          placeholder={placeholder}
          style={{ ...inputBase, resize: 'vertical' }}
        />
      ) : (
        <input
          type="text"
          value={value || ''}
          onChange={onChange}
          placeholder={placeholder}
          style={inputBase}
        />
      )}
    </div>
  );
  const selectInput = (value, onChange, label, options = []) => (
    <div>
      <label style={{ fontSize: 11, color: '#78909C', display: 'block', marginBottom: 2 }}>
        {label}
      </label>
      <select value={value ?? options?.[0]?.value ?? ''} onChange={onChange} style={inputBase}>
        {options.map((option) => (
          <option key={`${label}-${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );

  const buttonAlignOptions = [
    { value: 'left', label: 'Sol' },
    { value: 'center', label: 'Orta' },
    { value: 'right', label: 'Sağ' },
    { value: 'split', label: 'İki Yana' },
  ];
  const buttonDirectionOptions = [
    { value: 'row', label: 'Yatay' },
    { value: 'column', label: 'Alt Alta' },
  ];
  const guideActionOptions = [
    { value: 'package', label: 'Tema paketini aç' },
    { value: 'menu', label: 'Menüye git' },
    { value: 'play', label: 'Oyuna git' },
    { value: 'intro', label: 'Karşılama ekranı' },
    { value: 'none', label: 'Hiçbir şey yapma' },
  ];
  const packageBackActionOptions = [
    { value: 'intro', label: 'Karşılama ekranı' },
    { value: 'menu', label: 'Menü ekranı' },
    { value: 'play', label: 'Oyun ekranı' },
    { value: 'restart', label: 'Akışı baştan başlat' },
    { value: 'none', label: 'Hiçbir şey yapma' },
  ];
  const menuButtonActionOptions = [
    { value: 'toggle-menu', label: 'Açılır menüyü aç/kapat' },
    { value: 'package', label: 'Tema paketini aç' },
    { value: 'menu', label: 'Menü ekranına git' },
    { value: 'intro', label: 'Karşılama ekranı' },
    { value: 'play', label: 'Oyun ekranı' },
    { value: 'restart', label: 'Akışı sıfırla' },
    { value: 'none', label: 'Hiçbir şey yapma' },
  ];
  const checkButtonActionOptions = [
    { value: 'check', label: 'Cevabı kontrol et' },
    { value: 'result', label: 'Sonuç ekranını aç' },
    { value: 'answer', label: 'Doğru cevabı göster' },
    { value: 'restart', label: 'Akışı sıfırla' },
    { value: 'none', label: 'Hiçbir şey yapma' },
  ];
  const utilityActionOptions = [
    { value: 'answer', label: 'Doğru cevabı göster' },
    { value: 'play', label: 'Oyun ekranına dön' },
    { value: 'intro', label: 'Karşılama ekranı' },
    { value: 'menu', label: 'Menü ekranı' },
    { value: 'restart', label: 'Akışı sıfırla' },
    { value: 'none', label: 'Hiçbir şey yapma' },
  ];
  const completeActionOptions = [
    { value: 'complete', label: 'Tamamla / sonraki adıma geç' },
    { value: 'play', label: 'Oyun ekranına git' },
    { value: 'intro', label: 'Karşılama ekranı' },
    { value: 'menu', label: 'Menü ekranı' },
    { value: 'restart', label: 'Akışı sıfırla' },
    { value: 'none', label: 'Hiçbir şey yapma' },
  ];
  const homeActionOptions = [
    { value: 'intro', label: 'Karşılama ekranı' },
    { value: 'menu', label: 'Menü ekranı' },
    { value: 'package', label: 'Tema paketi ekranı' },
    { value: 'play', label: 'Oyun ekranı' },
    { value: 'restart', label: 'Akışı sıfırla' },
    { value: 'none', label: 'Hiçbir şey yapma' },
  ];

  function SubTab({ id, label, icon, current, onClick }) {
    return (
      <button
        onClick={() => onClick(id)}
        style={{
          padding: '4px 8px',
          borderRadius: 6,
          border: `1px solid ${current === id ? '#7C4DFF44' : '#252540'}`,
          background: current === id ? '#7C4DFF18' : 'transparent',
          color: current === id ? '#B388FF' : '#78909C',
          fontSize: 11,
          fontWeight: 700,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <span style={{ fontSize: 11 }}>{icon}</span>
        {label}
      </button>
    );
  }

  const sections = [
    {
      id: 'intro',
      label: 'Etkinlik Tanıtımı',
      icon: '🎬',
      color: '#B388FF',
      desc: 'Öğrencinin etkinliğe girdiğinde gördüğü ilk ekran.',
      enabled: intro.enabled !== false,
      onToggle: (v) => patchIntro({ enabled: v }),
      textFields: [
        {
          l: 'Başlık',
          v: intro.title || '',
          onChange: (e) => patchIntro({ title: e.target.value }),
          placeholder: 'Etkinliğe Hoş Geldin',
        },
        {
          l: 'Açıklama',
          v: intro.body || '',
          onChange: (e) => patchIntro({ body: e.target.value }),
          rows: 3,
          placeholder: 'Hazır olduğunda başla ve soruyu tamamla.',
        },
        {
          l: 'Buton Yazısı',
          v: intro.buttonText || '',
          onChange: (e) => patchIntro({ buttonText: e.target.value }),
          placeholder: 'Başla',
        },
      ],
      styleTarget: intro,
      stylePatch: patchIntro,
      themeScreen: 'intro',
      hasButton: true,
    },
    {
      id: 'package',
      label: 'Tema Paketi Tanıtımı',
      icon: '🎯',
      color: '#22d3ee',
      desc: 'Hazır tema renkleri, ikonlar ve tanıtım ekranı ayarları.',
      enabled: settings.showButtonPackageIntro !== false && packageScreen.enabled !== false,
      onToggle: (v) => {
        patchSettings({ showButtonPackageIntro: v });
        patchPackage({ enabled: v });
      },
      textFields: [
        {
          l: 'Başlık',
          v: resolvedPackageTitle,
          onChange: (e) => patchPackage({ title: e.target.value }),
          placeholder: 'Tema Paketi Tanıtımı',
        },
        {
          l: 'Açıklama',
          v: resolvedPackageBody,
          onChange: (e) => patchPackage({ body: e.target.value }),
          rows: 3,
          placeholder: 'Etkinlikte kullanacağın tema paketini ve butonları incele.',
        },
        {
          l: 'İleri Butonu',
          v: packageScreen.buttonText || '',
          onChange: (e) => patchPackage({ buttonText: e.target.value }),
          placeholder: 'Menüye Geç',
        },
        {
          l: 'Geri Butonu',
          v: packageScreen.backButtonText || '',
          onChange: (e) => patchPackage({ backButtonText: e.target.value }),
          placeholder: 'Geri Dön',
        },
        ...packageItems.flatMap((item) => {
          const defaultLabel =
            DEFAULT_THEME_PACKAGE_ITEMS.find((entry) => entry.id === item.id)?.label ||
            item.label ||
            item.id;
          return [
            {
              l: `${defaultLabel} İkonu`,
              v: item.icon || '',
              onChange: (e) => patchPackageItem(item.id, { icon: e.target.value }),
              placeholder: item.icon || '★',
            },
            {
              l: `${defaultLabel} Başlığı`,
              v: item.label || '',
              onChange: (e) => patchPackageItem(item.id, { label: e.target.value }),
              placeholder: defaultLabel,
            },
            {
              l: `${defaultLabel} Açıklaması`,
              v: item.desc || '',
              onChange: (e) => patchPackageItem(item.id, { desc: e.target.value }),
              rows: 2,
              placeholder: item.desc || 'Açıklama',
            },
          ];
        }),
      ],
      styleTarget: packageScreen,
      stylePatch: patchPackage,
      themeScreen: 'intro',
      hasButton: true,
    },
    {
      id: 'menu',
      label: 'Menü Ekranı',
      icon: '📋',
      color: '#f59e0b',
      desc: 'Kuralların ve açıklamaların gösterildiği menü ekranı.',
      enabled: settings.showMenuScreen !== false && menuScreen.enabled !== false,
      onToggle: (v) => {
        patchSettings({ showMenuScreen: v });
        patchMenu({ enabled: v });
      },
      textFields: [
        {
          l: 'Başlık',
          v: menuScreen.title || '',
          onChange: (e) => patchMenu({ title: e.target.value }),
          placeholder: 'Etkinlik Menüsü',
        },
        {
          l: 'Açıklama',
          v: menuScreen.body || '',
          onChange: (e) => patchMenu({ body: e.target.value }),
          rows: 3,
          placeholder: 'Kuralları gözden geçir ve etkinliği başlat.',
        },
        {
          l: 'Buton Yazısı',
          v: menuScreen.buttonText || '',
          onChange: (e) => patchMenu({ buttonText: e.target.value }),
          placeholder: 'Etkinliğe Geç',
        },
      ],
      styleTarget: menuScreen,
      stylePatch: patchMenu,
      themeScreen: 'intro',
      hasButton: true,
    },
    {
      id: 'play',
      label: 'Oyun / Sahne',
      icon: '▶',
      color: '#60a5fa',
      desc: 'Etkinlik sırasında gösterilecek başlık ve açıklama.',
      textFields: [
        {
          l: 'Başlık',
          v: playScreen.title || '',
          onChange: (e) => patchPlay({ title: e.target.value }),
          placeholder: 'Sahne başlığı',
        },
        {
          l: 'Açıklama',
          v: playScreen.body || '',
          onChange: (e) => patchPlay({ body: e.target.value }),
          rows: 2,
          placeholder: 'Sahne açıklaması',
        },
      ],
      styleTarget: playScreen,
      stylePatch: patchPlay,
      themeScreen: 'play',
      hasButton: false,
    },
    {
      id: 'success',
      label: 'Doğru Cevap',
      icon: '✅',
      color: '#4ade80',
      desc: 'Öğrenci doğru cevap verdiğinde gösterilen ekran.',
      textFields: [
        {
          l: 'Başlık',
          v: results.successTitle || '',
          onChange: (e) => patchResults({ successTitle: e.target.value }),
          placeholder: 'Harika!',
        },
        {
          l: 'Mesaj',
          v: results.successBody || '',
          onChange: (e) => patchResults({ successBody: e.target.value }),
          rows: 2,
          placeholder: 'Doğru cevabı buldun.',
        },
        {
          l: 'Devam Butonu',
          v: results.continueText || '',
          onChange: (e) => patchResults({ continueText: e.target.value }),
          placeholder: 'Devam Et',
        },
      ],
      styleTarget: results,
      stylePatch: patchResults,
      themeScreen: 'success',
      hasButton: true,
    },
    {
      id: 'failure',
      label: 'Yanlış Cevap',
      icon: '❌',
      color: '#f87171',
      desc: 'Öğrenci yanlış cevap verdiğinde gösterilen ekran.',
      textFields: [
        {
          l: 'Başlık',
          v: results.failureTitle || '',
          onChange: (e) => patchResults({ failureTitle: e.target.value }),
          placeholder: 'Tekrar Deneyelim',
        },
        {
          l: 'Mesaj',
          v: results.failureBody || '',
          onChange: (e) => patchResults({ failureBody: e.target.value }),
          rows: 2,
          placeholder: 'Doğru cevaba biraz daha yakınsın.',
        },
        {
          l: 'Tekrar Dene Butonu',
          v: results.retryText || '',
          onChange: (e) => patchResults({ retryText: e.target.value }),
          placeholder: 'Tekrar Dene',
        },
      ],
      styleTarget: results,
      stylePatch: patchResults,
      themeScreen: 'failure',
      hasButton: true,
    },
    {
      id: 'answer',
      label: 'Cevap Ekranı',
      icon: '★',
      color: '#fbbf24',
      desc: 'Doğru cevap gösterildiğinde kullanılan ekran.',
      textFields: [
        {
          l: 'Başlık',
          v: answerScreen.title || '',
          onChange: (e) => patchAnswer({ title: e.target.value }),
          placeholder: 'Doğru Cevap',
        },
        {
          l: 'Açıklama',
          v: answerScreen.body || '',
          onChange: (e) => patchAnswer({ body: e.target.value }),
          rows: 2,
          placeholder: 'Sistem doğru cevabı gösteriyor.',
        },
        {
          l: 'Buton Yazısı',
          v: answerScreen.buttonText || '',
          onChange: (e) => patchAnswer({ buttonText: e.target.value }),
          placeholder: 'Yeniden Başlat',
        },
      ],
      styleTarget: answerScreen,
      stylePatch: patchAnswer,
      themeScreen: 'failure',
      hasButton: true,
    },
  ];

  const renderStyleEditor = (s) => {
    const st = s.styleTarget?.style || {};
    const patchStyle = (p) => s.stylePatch({ style: { ...st, ...p } });
    const defaultBg = theme[s.themeScreen] || theme.intro;
    const defaultText = theme.text;
    const defaultBtnBg = theme.button;
    const defaultBtnColor = theme.text;
    const defaultBtnBorder = theme.border;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#78909C', marginBottom: 2 }}>
          EKRAN ARKA PLANI
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {colorInput(
            st.background || '',
            (e) => patchStyle({ background: e.target.value }),
            'Arka Plan'
          )}
          {colorInput(
            st.textColor || '',
            (e) => patchStyle({ textColor: e.target.value }),
            'Metin Rengi'
          )}
        </div>
        <div style={{ fontSize: 11, color: '#546E7A' }}>
          Boş bırakılırsa tema varsayılanı kullanılır: {defaultBg.slice(0, 40)}...
        </div>

        <div style={{ width: '100%', height: 1, background: '#252540', margin: '4px 0' }} />

        <div style={{ fontSize: 11, fontWeight: 700, color: '#78909C', marginBottom: 2 }}>
          BAŞLIK STİLİ
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {numInput(
            st.titleFontSize,
            (e) => patchStyle({ titleFontSize: +e.target.value || 0 }),
            'Font Boyutu',
            10,
            120
          )}
          {numInput(
            st.titleFontWeight,
            (e) => patchStyle({ titleFontWeight: +e.target.value || 0 }),
            'Kalınlık',
            100,
            900
          )}
        </div>

        {s.hasButton && (
          <>
            <div style={{ width: '100%', height: 1, background: '#252540', margin: '4px 0' }} />
            <div style={{ fontSize: 11, fontWeight: 700, color: '#78909C', marginBottom: 2 }}>
              BUTON GÖRÜNÜMLERİ
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {colorInput(
                st.buttonBackground || '',
                (e) => patchStyle({ buttonBackground: e.target.value }),
                'Buton Arkaplan'
              )}
              {colorInput(
                st.buttonColor || '',
                (e) => patchStyle({ buttonColor: e.target.value }),
                'Buton Yazı'
              )}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {colorInput(
                st.buttonBorderColor || '',
                (e) => patchStyle({ buttonBorderColor: e.target.value }),
                'Buton Çerçeve'
              )}
              {numInput(
                st.buttonBorderRadius ?? '',
                (e) => patchStyle({ buttonBorderRadius: +e.target.value || 0 }),
                'Köşe Yvl.',
                0,
                999
              )}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {numInput(
                st.buttonFontSize,
                (e) => patchStyle({ buttonFontSize: +e.target.value || 0 }),
                'Buton Font',
                8,
                60
              )}
              {numInput(
                st.buttonPaddingX,
                (e) => patchStyle({ buttonPaddingX: +e.target.value || 0 }),
                'Yatay Pad',
                0,
                100
              )}
              {numInput(
                st.buttonPaddingY,
                (e) => patchStyle({ buttonPaddingY: +e.target.value || 0 }),
                'Dikey Pad',
                0,
                100
              )}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {selectInput(
                st.buttonAlign || 'center',
                (e) => patchStyle({ buttonAlign: e.target.value }),
                'Buton Konumu',
                buttonAlignOptions
              )}
              {selectInput(
                st.buttonDirection || 'row',
                (e) => patchStyle({ buttonDirection: e.target.value }),
                'Buton Dizilimi',
                buttonDirectionOptions
              )}
              {numInput(
                st.buttonGap ?? 12,
                (e) => patchStyle({ buttonGap: +e.target.value || 0 }),
                'Buton Aralığı',
                0,
                60
              )}
            </div>
            <div style={{ fontSize: 11, color: '#546E7A' }}>
              Boş = tema varsayılanı ({defaultBtnBorder})
            </div>

            {/* Buton önizleme */}
            <div
              style={{
                padding: 10,
                borderRadius: 8,
                background: '#0a0a1a',
                minHeight: 68,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
              <div
                style={{
                  padding: `${st.buttonPaddingY || 13}px ${st.buttonPaddingX || 28}px`,
                  borderRadius: st.buttonBorderRadius ?? 999,
                  border: `1px solid ${st.buttonBorderColor || defaultBtnBorder}44`,
                  background: st.buttonBackground || defaultBtnBg,
                  color: st.buttonColor || defaultBtnColor,
                  fontSize: st.buttonFontSize || 14,
                  fontWeight: 800,
                  textAlign: 'center',
                  boxShadow: `0 8px 32px ${st.buttonBorderColor || defaultBtnBorder}44`,
                }}
              >
                {s.textFields.find((f) => f.l.includes('Buton'))?.v || 'Buton Önizleme'}
              </div>
            </div>
          </>
        )}

        <div style={{ width: '100%', height: 1, background: '#252540', margin: '4px 0' }} />
        <div style={{ fontSize: 11, fontWeight: 700, color: '#78909C', marginBottom: 2 }}>
          EKRAN GENEL
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {numInput(
            st.borderRadius ?? '',
            (e) => patchStyle({ borderRadius: +e.target.value || 0 }),
            'Panel Köşe',
            0,
            60
          )}
          {numInput(
            st.padding ?? '',
            (e) => patchStyle({ padding: +e.target.value || 0 }),
            'İç Boşluk',
            0,
            100
          )}
        </div>

        {/* Ekran Önizleme */}
        <div
          style={{
            padding: 8,
            borderRadius: 8,
            background: '#0a0a1a',
            marginTop: 4,
            maxHeight: 240,
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              background: st.background || defaultBg,
              borderRadius: st.borderRadius || 16,
              padding: st.padding || 16,
              color: st.textColor || defaultText,
              minHeight: 80,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <div
              style={{ fontSize: st.titleFontSize || 18, fontWeight: st.titleFontWeight || 800 }}
            >
              {s.textFields[0]?.v || 'Başlık Önizleme'}
            </div>
            <div style={{ fontSize: 11, opacity: 0.7 }}>
              {s.textFields[1]?.v || 'Açıklama önizleme'}
            </div>
            {s.hasButton && (
              <div
                style={{
                  padding: `${st.buttonPaddingY || 13}px ${st.buttonPaddingX || 28}px`,
                  borderRadius: st.buttonBorderRadius ?? 999,
                  background: st.buttonBackground || defaultBtnBg,
                  color: st.buttonColor || defaultBtnColor,
                  fontSize: st.buttonFontSize || 14,
                  fontWeight: 800,
                  border: `1px solid ${st.buttonBorderColor || defaultBtnBorder}44`,
                  boxShadow: `0 8px 16px ${st.buttonBorderColor || defaultBtnBorder}44`,
                }}
              >
                {s.textFields.find((f) => f.l.includes('Buton'))?.v || 'Buton'}
              </div>
            )}
          </div>
        </div>

        <button
          onClick={() => s.stylePatch({ style: {} })}
          style={{
            padding: '4px 10px',
            borderRadius: 6,
            border: '1px solid #ef4444',
            background: '#ef444418',
            color: '#f87171',
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
            alignSelf: 'flex-start',
          }}
        >
          Stilleri Sıfırla
        </button>
      </div>
    );
  };

  const renderSectionTextContent = (s) => {
    if (s.id !== 'package') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 11, color: '#78909C', marginBottom: 2 }}>{s.desc}</div>
          {s.textFields.map((f) => textInput(f.v, f.onChange, f.l, f.placeholder, f.rows))}
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 11, color: '#78909C', marginBottom: 2 }}>{s.desc}</div>
        <div
          style={{
            background: '#0a1020',
            border: '1px solid #23314f',
            borderRadius: 10,
            padding: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, color: '#67e8f9' }}>TANITIM ALANI</div>
          {s.textFields
            .slice(0, 4)
            .map((f) => textInput(f.v, f.onChange, f.l, f.placeholder, f.rows))}
        </div>
        <div
          style={{
            background: '#0a1020',
            border: '1px solid #23314f',
            borderRadius: 10,
            padding: 10,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, color: '#93c5fd', marginBottom: 8 }}>
            TEMA KARTLARI
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
              gap: 8,
            }}
          >
            {packageItems.map((item) => (
              <div
                key={item.id}
                style={{
                  background: '#0f172a',
                  border: '1px solid #1e293b',
                  borderRadius: 10,
                  padding: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>{item.icon || '✦'}</span>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#e2e8f0' }}>
                    {item.label || 'Kart'}
                  </div>
                </div>
                {textInput(
                  item.icon || '',
                  (e) => patchPackageItem(item.id, { icon: e.target.value }),
                  'İkon',
                  '★'
                )}
                {textInput(
                  item.label || '',
                  (e) => patchPackageItem(item.id, { label: e.target.value }),
                  'Başlık',
                  'Kart başlığı'
                )}
                {textInput(
                  item.desc || '',
                  (e) => patchPackageItem(item.id, { desc: e.target.value }),
                  'Açıklama',
                  'Kart açıklaması',
                  2
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const filteredSections = normalizedVisibleSectionIds.length
    ? sections.filter((section) => normalizedVisibleSectionIds.includes(section.id))
    : sections;
  const showBehaviorPanel =
    !normalizedVisibleSectionIds.length || normalizedVisibleSectionIds.includes('behavior');

  const renderBehavior = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div
        style={{
          background: '#0a1020',
          border: '1px solid #24324d',
          borderRadius: 10,
          padding: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#93c5fd' }}>TEMEL DAVRANIŞLAR</div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
            Puanlama, deneme ve cevap görünürlüğü ayarları.
          </div>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))',
            gap: 6,
          }}
        >
          <div style={{ minWidth: 80 }}>
            <label style={{ fontSize: 11, color: '#78909C', display: 'block', marginBottom: 2 }}>
              Tamamlanma
            </label>
            <select
              value={settings.completionMode || 'required'}
              onChange={(e) => patchSettings({ completionMode: e.target.value })}
              style={inputBase}
            >
              <option value="required">Zorunlu</option>
              <option value="optional">İsteğe Bağlı</option>
            </select>
          </div>
          {numInput(
            settings.scorePoints ?? 10,
            (e) => patchSettings({ scorePoints: +e.target.value || 0 }),
            'Puan',
            0,
            1000
          )}
          {numInput(
            settings.maxAttempts ?? 0,
            (e) => patchSettings({ maxAttempts: Math.max(0, +e.target.value || 0) }),
            'Maks Deneme',
            0,
            100
          )}
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))',
            gap: 6,
          }}
        >
          {[
            { key: 'shuffleOptions', label: 'Seçenekleri karıştır', color: '#a78bfa' },
            { key: 'showFeedback', label: 'Sonuç göster', color: '#60a5fa' },
            { key: 'allowRetry', label: 'Tekrar deneme izni', color: '#4ade80' },
            { key: 'showAnswerLayer', label: 'Cevap katmanı göster', color: '#fbbf24' },
          ].map((opt) => (
            <label
              key={opt.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11,
                color: '#B0BEC5',
                cursor: 'pointer',
                padding: '8px 10px',
                borderRadius: 8,
                background: 'rgba(15,23,42,.55)',
                border: '1px solid #1f2a44',
              }}
            >
              <input
                type="checkbox"
                checked={!!settings[opt.key]}
                onChange={(e) => patchSettings({ [opt.key]: e.target.checked })}
                style={{ accentColor: opt.color }}
              />
              {opt.label}
            </label>
          ))}
        </div>
        {textInput(
          settings.answerButtonText || '',
          (e) => patchSettings({ answerButtonText: e.target.value }),
          'Cevap Göster Butonu',
          'Cevabı Gör'
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#93c5fd' }}>SORU RAPORLAMA</div>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              color: '#B0BEC5',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={settings.questionGrading !== 'survey'}
              onChange={(e) =>
                patchSettings({ questionGrading: e.target.checked ? 'graded' : 'survey' })
              }
              style={{ accentColor: '#f59e0b' }}
            />
            Puanlı (Graded) — LMS'e puan gönder
          </label>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              color: '#B0BEC5',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={!!settings.reportPerQuestion}
              onChange={(e) => patchSettings({ reportPerQuestion: e.target.checked })}
              style={{ accentColor: '#22d3ee' }}
            />
            Her soru için ayrı LMS raporu (cmi.interactions)
          </label>
          {settings.reportPerQuestion && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {numInput(
                settings.pointsPerQuestion ?? 10,
                (e) => patchSettings({ pointsPerQuestion: +e.target.value || 0 }),
                'Soru Başı Puan',
                0,
                1000
              )}
              <div style={{ minWidth: 80 }}>
                <label
                  style={{ fontSize: 11, color: '#78909C', display: 'block', marginBottom: 2 }}
                >
                  Raporlama Tipi
                </label>
                <select
                  value={settings.lmsInteractionType || 'choice'}
                  onChange={(e) => patchSettings({ lmsInteractionType: e.target.value })}
                  style={inputBase}
                >
                  <option value="choice">Choice</option>
                  <option value="true-false">True-False</option>
                  <option value="fill-in">Fill-In</option>
                  <option value="matching">Matching</option>
                  <option value="sequencing">Sequencing</option>
                  <option value="numeric">Numeric</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          background: '#0a1020',
          border: '1px solid #3b2b5a',
          borderRadius: 10,
          padding: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#c4b5fd' }}>AKIŞ YÖNLERİ</div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
            Ekranlar arasında hangi adımın açılacağını seç.
          </div>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))',
            gap: 6,
          }}
        >
          <div>
            <label style={{ fontSize: 11, color: '#78909C', display: 'block', marginBottom: 2 }}>
              Karşılama sonrası
            </label>
            <select
              value={settings.introNextPhase || 'auto'}
              onChange={(e) => patchSettings({ introNextPhase: e.target.value })}
              style={inputBase}
            >
              <option value="auto">Otomatik</option>
              <option value="package">Tema Paketi</option>
              <option value="menu">Menü</option>
              <option value="play">Oyun</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#78909C', display: 'block', marginBottom: 2 }}>
              Tema sonrası
            </label>
            <select
              value={settings.packageNextPhase || 'auto'}
              onChange={(e) => patchSettings({ packageNextPhase: e.target.value })}
              style={inputBase}
            >
              <option value="auto">Otomatik</option>
              <option value="intro">Karşılama</option>
              <option value="menu">Menü</option>
              <option value="play">Oyun</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#78909C', display: 'block', marginBottom: 2 }}>
              Menü sonrası
            </label>
            <select
              value={settings.menuNextPhase || 'play'}
              onChange={(e) => patchSettings({ menuNextPhase: e.target.value })}
              style={inputBase}
            >
              <option value="intro">Karşılama</option>
              <option value="package">Tema Paketi</option>
              <option value="play">Oyun</option>
            </select>
          </div>
        </div>
      </div>

      <div
        style={{
          background: '#0a1020',
          border: '1px solid #234046',
          borderRadius: 10,
          padding: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#5eead4' }}>BUTON YAZILARI</div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
            Önizlemede görünen tüm buton metinlerini buradan değiştir.
          </div>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))',
            gap: 6,
          }}
        >
          {textInput(
            settings.guideButtonText || '',
            (e) => patchSettings({ guideButtonText: e.target.value }),
            'Tanıtım Butonu',
            'Tanıtım'
          )}
          {textInput(
            settings.menuButtonText || '',
            (e) => patchSettings({ menuButtonText: e.target.value }),
            'Menü Butonu',
            '☰ MENÜ'
          )}
          {textInput(
            settings.checkButtonText || '',
            (e) => patchSettings({ checkButtonText: e.target.value }),
            'Kontrol Butonu',
            'Kontrol Et'
          )}
          {textInput(
            settings.solutionButtonText || '',
            (e) => patchSettings({ solutionButtonText: e.target.value }),
            'Çözüm Butonu',
            'Çözümü Göster'
          )}
          {textInput(
            settings.restartFlowText || '',
            (e) => patchSettings({ restartFlowText: e.target.value }),
            'Yeniden Başlat',
            'Yeniden Başlat'
          )}
          {textInput(
            settings.completeButtonText || '',
            (e) => patchSettings({ completeButtonText: e.target.value }),
            'Tamamlama Butonu',
            'Tamamla'
          )}
          {textInput(
            settings.homeButtonText || '',
            (e) => patchSettings({ homeButtonText: e.target.value }),
            'Ana Sayfa',
            'Ana Sayfa'
          )}
          {textInput(
            settings.soundOnText || '',
            (e) => patchSettings({ soundOnText: e.target.value }),
            'Ses Aç Metni',
            'Sesi Aç'
          )}
          {textInput(
            settings.soundOffText || '',
            (e) => patchSettings({ soundOffText: e.target.value }),
            'Ses Kapat Metni',
            'Sesi Kapat'
          )}
        </div>
      </div>

      <div
        style={{
          background: '#0a1020',
          border: '1px solid #4c2f4e',
          borderRadius: 10,
          padding: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#f9a8d4' }}>BUTON GÖREVLERİ</div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
            Butona basılınca hangi ekranın veya görevin açılacağını seç.
          </div>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))',
            gap: 6,
          }}
        >
          {selectInput(
            settings.guideButtonAction || 'package',
            (e) => patchSettings({ guideButtonAction: e.target.value }),
            'Tanıtım / Kılavuz',
            guideActionOptions
          )}
          {selectInput(
            settings.packageBackAction || 'intro',
            (e) => patchSettings({ packageBackAction: e.target.value }),
            'Tema Geri Butonu',
            packageBackActionOptions
          )}
          {selectInput(
            settings.menuButtonAction || 'toggle-menu',
            (e) => patchSettings({ menuButtonAction: e.target.value }),
            'Oyun Menü Butonu',
            menuButtonActionOptions
          )}
          {selectInput(
            settings.checkButtonAction || 'check',
            (e) => patchSettings({ checkButtonAction: e.target.value }),
            'Kontrol Butonu',
            checkButtonActionOptions
          )}
          {selectInput(
            settings.solutionButtonAction || 'answer',
            (e) => patchSettings({ solutionButtonAction: e.target.value }),
            'Çözüm Butonu',
            utilityActionOptions
          )}
          {selectInput(
            settings.restartButtonAction || 'restart',
            (e) => patchSettings({ restartButtonAction: e.target.value }),
            'Yeniden Başlat',
            packageBackActionOptions
          )}
          {selectInput(
            settings.completeButtonAction || 'complete',
            (e) => patchSettings({ completeButtonAction: e.target.value }),
            'Tamamla Butonu',
            completeActionOptions
          )}
          {selectInput(
            settings.answerButtonAction || 'restart',
            (e) => patchSettings({ answerButtonAction: e.target.value }),
            'Cevap Ekranı Butonu',
            utilityActionOptions
          )}
          {selectInput(
            settings.homeButtonAction || 'intro',
            (e) => patchSettings({ homeButtonAction: e.target.value }),
            'Ana Sayfa Menüsü',
            homeActionOptions
          )}
        </div>
      </div>

      <div
        style={{
          background: '#0a1020',
          border: '1px solid #223a58',
          borderRadius: 10,
          padding: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#93c5fd' }}>TEMA PAKETLERİ</div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
              Butonların renk ve genel görünüm kalıpları.
            </div>
          </div>
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: '#bfdbfe',
              background: 'rgba(59,130,246,.14)',
              border: '1px solid rgba(96,165,250,.3)',
              borderRadius: 999,
              padding: '3px 8px',
            }}
          >
            {BUTTON_PACKAGES.length} hazır kalıp
          </span>
        </div>
        {/* Sınıf grubu filtre sekmesi */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {[{ id: 'all', label: 'Tümü', icon: '📚', color: '#94a3b8' }, ...GRADE_GROUPS].map(
            (g) => {
              const isActive = pkgGradeFilter === g.id;
              return (
                <button
                  key={g.id}
                  onClick={() => setPkgGradeFilter(g.id)}
                  style={{
                    padding: '3px 9px',
                    borderRadius: 999,
                    border: `1px solid ${isActive ? g.color || '#60a5fa' : '#2b3655'}`,
                    background: isActive ? `${g.color || '#60a5fa'}22` : 'transparent',
                    color: isActive ? g.color || '#60a5fa' : '#64748b',
                    fontSize: 11,
                    fontWeight: isActive ? 800 : 600,
                    cursor: 'pointer',
                  }}
                >
                  {g.icon} {g.label}
                </button>
              );
            }
          )}
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))',
            gap: 8,
            maxHeight: 320,
            overflowY: 'auto',
            paddingRight: 2,
          }}
        >
          {(pkgGradeFilter === 'all'
            ? BUTTON_PACKAGES
            : BUTTON_PACKAGES.filter((pkg) => pkg.gradeGroup === pkgGradeFilter)
          ).map((pkg) => {
            const pkgTheme = getPackageTheme(pkg.id);
            const isActive = activity.buttonPackageId === pkg.id;
            return (
              <button
                key={pkg.id}
                onClick={() => {
                  const defaultProfileId =
                    pkg.animationProfileId || activity.buttonAnimationProfileId || 'calmLift';
                  onUpdate(
                    restyleActivityButtonsForPackage(
                      { ...activity, buttonAnimationProfileId: defaultProfileId },
                      pkg.id
                    )
                  );
                }}
                style={{
                  padding: 10,
                  borderRadius: 12,
                  cursor: 'pointer',
                  textAlign: 'left',
                  border: `1px solid ${isActive ? pkg.color : '#2b3655'}`,
                  background: isActive
                    ? `linear-gradient(135deg, ${pkg.color}30, rgba(15,23,42,.92))`
                    : 'linear-gradient(135deg,#111125,#0b1120)',
                  color: '#e2e8f0',
                  boxShadow: isActive ? `0 12px 24px ${pkg.color}22` : 'none',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}
                >
                  <span style={{ fontSize: 18 }}>{pkg.icon || '✦'}</span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      color: isActive ? '#ffffff' : pkg.color,
                      background: isActive ? 'rgba(255,255,255,.18)' : `${pkg.color}18`,
                      borderRadius: 999,
                      padding: '3px 6px',
                    }}
                  >
                    {pkg.trigger}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 900,
                    marginTop: 8,
                    color: isActive ? '#ffffff' : '#f8fafc',
                  }}
                >
                  {pkg.name}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    lineHeight: 1.45,
                    color: isActive ? 'rgba(255,255,255,.82)' : '#94a3b8',
                    marginTop: 4,
                  }}
                >
                  {pkg.desc || `${pkg.trigger} · ${pkg.anim}`}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                  <span
                    style={{
                      padding: '4px 8px',
                      borderRadius: 999,
                      background: pkgTheme.button,
                      color: pkgTheme.text,
                      fontSize: 11,
                      fontWeight: 900,
                    }}
                  >
                    ▶ Başlat
                  </span>
                  <span
                    style={{
                      padding: '4px 8px',
                      borderRadius: 999,
                      border: `1px solid ${pkgTheme.border}66`,
                      color: pkgTheme.border,
                      fontSize: 11,
                      fontWeight: 800,
                    }}
                  >
                    ✓ Kontrol
                  </span>
                </div>
              </button>
            );
          })}
        </div>
        <div
          style={{
            background: '#0f172a',
            border: '1px solid #263854',
            borderRadius: 10,
            padding: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#93c5fd' }}>BUTON ANİMASYONU</div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
              Etkinlikteki tüm butonlar aynı animasyonu kullanır.
            </div>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))',
              gap: 6,
            }}
          >
            {Object.entries(BUTTON_PACKAGE_MOTION_PRESETS).map(([profileId, motion]) => {
              const labels = {
                calmLift: 'Sakin Yükselme',
                focusLift: 'Net Odak',
                softBreath: 'Hafif Nefes',
                steadyPress: 'Kararlı Basış',
                horizontalFlow: 'Yatay Akış',
              };
              const isActive =
                (activity.buttonAnimationProfileId ||
                  BUTTON_PACKAGES.find((p) => p.id === activity.buttonPackageId)
                    ?.animationProfileId ||
                  'calmLift') === profileId;
              return (
                <button
                  key={profileId}
                  onClick={() => onUpdate(restyleActivityButtonMotion(activity, profileId))}
                  style={{
                    padding: '8px 9px',
                    borderRadius: 10,
                    border: `1px solid ${isActive ? '#60a5fa' : '#2b3655'}`,
                    background: isActive
                      ? 'linear-gradient(135deg,#1e3a8a,#0f172a)'
                      : 'linear-gradient(135deg,#111827,#0b1120)',
                    color: isActive ? '#eff6ff' : '#cbd5e1',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 900 }}>
                    {labels[profileId] || profileId}
                  </div>
                  <div
                    style={{ fontSize: 10, color: isActive ? '#bfdbfe' : '#64748b', marginTop: 3 }}
                  >
                    {motion.duration}ms · {Number(motion.hoverScale || 1).toFixed(3)}x
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        <div style={{ fontSize: 11, color: '#546E7A' }}>
          Seçili tema: {BUTTON_PACKAGES.find((p) => p.id === activity.buttonPackageId)?.name || '?'}
        </div>
      </div>
    </div>
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        height: '100%',
        minHeight: 0,
        overflowY: 'auto',
        paddingRight: 6,
        scrollbarGutter: 'stable',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 8,
          marginBottom: 2,
        }}
      >
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#B388FF', marginBottom: 2 }}>
            EKRAN DÜZENLEYİCİ
          </div>
          <div style={{ fontSize: 11, color: '#78909C', lineHeight: 1.4 }}>
            {sectionTitle
              ? `${sectionTitle} alanını düzenliyorsun. Alt bölümden ilgili ayarları açıp değiştirebilirsin.`
              : 'Tüm ekranların metinlerini, butonlarını ve görünümlerini düzenle.'}
          </div>
        </div>
        <button
          onClick={() => {
            if (typeof window === 'undefined') return;
            const url = `${window.location.pathname}${window.location.search}#text-studio`;
            window.open(url, '_blank', 'noopener,noreferrer');
          }}
          style={{
            padding: '6px 10px',
            borderRadius: 8,
            border: '1px solid #7C4DFF44',
            background: '#7C4DFF18',
            color: '#B388FF',
            fontSize: 11,
            fontWeight: 800,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Yeni Sekmede Aç
        </button>
      </div>

      <div
        style={{
          background: 'linear-gradient(135deg,#111827,#0f172a)',
          border: '1px solid #334155',
          borderRadius: 12,
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          marginBottom: 4,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#93c5fd' }}>
              TASARIM KÜTÜPHANESİ
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
              Bu alandaki metin + görünüm ayarlarını proje içinde kaydet ve başka etkinliklere
              uygula.
            </div>
          </div>
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: '#bfdbfe',
              background: 'rgba(59,130,246,.14)',
              border: '1px solid rgba(96,165,250,.3)',
              borderRadius: 999,
              padding: '4px 8px',
            }}
          >
            {designPresets.length} kayıtlı tasarım
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr .9fr', gap: 8 }}>
          {textInput(
            presetName,
            (e) => setPresetName(e.target.value),
            'Tasarım Adı',
            'Örn. Kurumsal Mavi'
          )}
          <div>
            <label style={{ fontSize: 11, color: '#78909C', display: 'block', marginBottom: 2 }}>
              Kayıtlı Tasarımlar
            </label>
            <select
              value={selectedPresetId}
              onChange={(e) => setSelectedPresetId(e.target.value)}
              style={inputBase}
            >
              <option value="">Tasarım seç...</option>
              {designPresets.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            onClick={handleSaveCurrentPreset}
            style={{
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid #22c55e',
              background: 'rgba(34,197,94,.12)',
              color: '#86efac',
              fontSize: 11,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Tasarımı Kaydet
          </button>
          <button
            onClick={handleApplySelectedPreset}
            disabled={!selectedPreset}
            style={{
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid #60a5fa',
              background: selectedPreset ? 'rgba(59,130,246,.12)' : 'rgba(51,65,85,.5)',
              color: selectedPreset ? '#bfdbfe' : '#64748b',
              fontSize: 11,
              fontWeight: 800,
              cursor: selectedPreset ? 'pointer' : 'default',
              opacity: selectedPreset ? 1 : 0.7,
            }}
          >
            Seçileni Uygula
          </button>
          <button
            onClick={handleDeleteSelectedPreset}
            disabled={!selectedPreset}
            style={{
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid #ef4444',
              background: selectedPreset ? 'rgba(239,68,68,.12)' : 'rgba(51,65,85,.5)',
              color: selectedPreset ? '#fca5a5' : '#64748b',
              fontSize: 11,
              fontWeight: 800,
              cursor: selectedPreset ? 'pointer' : 'default',
              opacity: selectedPreset ? 1 : 0.7,
            }}
          >
            Tasarımı Sil
          </button>
        </div>

        <div style={{ fontSize: 11, color: '#cbd5e1', lineHeight: 1.5 }}>
          {selectedPreset
            ? `Seçili şablon: ${selectedPreset.name} · Son güncelleme ${new Date(selectedPreset.updatedAt || selectedPreset.createdAt).toLocaleString('tr-TR')}`
            : 'Kaydettiğin tasarımlar burada listelenir; aynı tasarımı farklı etkinliklerde tek tıkla çağırabilirsin.'}
        </div>
      </div>

      {filteredSections.map((s) => {
        const isOpen = openSection === s.id;
        return (
          <div
            key={s.id}
            style={{
              background: isOpen ? '#0d0d1f' : '#111125',
              border: `1px solid ${isOpen ? s.color + '44' : '#252540'}`,
              borderRadius: 10,
              overflow: 'hidden',
              transition: 'all .2s',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '9px 12px',
                cursor: 'pointer',
                userSelect: 'none',
                background: isOpen ? `${s.color}0a` : 'transparent',
              }}
              onClick={() => {
                setOpenSection(isOpen ? null : s.id);
                setOpenSub('text');
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14 }}>{s.icon}</span>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: s.color }}>{s.label}</div>
                  {!isOpen && (
                    <div style={{ fontSize: 11, color: '#78909C', marginTop: 1 }}>{s.desc}</div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {s.onToggle && (
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 11,
                      color: '#78909C',
                      cursor: 'pointer',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={s.enabled}
                      onChange={(e) => s.onToggle(e.target.checked)}
                      style={{ accentColor: s.color }}
                    />
                    Aktif
                  </label>
                )}
                <span
                  style={{
                    color: '#546E7A',
                    fontSize: 12,
                    transform: isOpen ? 'rotate(180deg)' : 'rotate(0)',
                    transition: 'transform .2s',
                  }}
                >
                  ▼
                </span>
              </div>
            </div>
            {isOpen && (
              <div style={{ padding: '4px 12px 12px' }}>
                <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                  <SubTab
                    id="text"
                    label="Metinler"
                    icon="T"
                    current={openSub}
                    onClick={setOpenSub}
                  />
                  <SubTab
                    id="style"
                    label="Görünüm"
                    icon="🎨"
                    current={openSub}
                    onClick={setOpenSub}
                  />
                  {s.id === 'intro' && (
                    <SubTab
                      id="behavior"
                      label="Davranış"
                      icon="⚙"
                      current={openSub}
                      onClick={setOpenSub}
                    />
                  )}
                </div>

                <div
                  style={{
                    maxHeight:
                      ['package', 'behavior'].includes(s.id) || openSub === 'behavior'
                        ? 'min(62vh, 760px)'
                        : 'none',
                    overflowY:
                      ['package', 'behavior'].includes(s.id) || openSub === 'behavior'
                        ? 'auto'
                        : 'visible',
                    paddingRight:
                      ['package', 'behavior'].includes(s.id) || openSub === 'behavior' ? 6 : 0,
                    scrollbarGutter: 'stable',
                    overscrollBehavior: 'contain',
                  }}
                >
                  {openSub === 'text' && renderSectionTextContent(s)}

                  {openSub === 'style' && renderStyleEditor(s)}
                  {openSub === 'behavior' && s.id === 'intro' && renderBehavior()}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {showBehaviorPanel && (
        <div
          style={{
            background: '#111125',
            border: '1px solid #252540',
            borderRadius: 10,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '9px 12px',
              cursor: 'pointer',
              userSelect: 'none',
            }}
            onClick={() => {
              setOpenSection(openSection === 'behavior' ? null : 'behavior');
              setOpenSub('behavior');
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14 }}>⚙</span>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>Genel Ayarlar</div>
                {openSection !== 'behavior' && (
                  <div style={{ fontSize: 11, color: '#78909C', marginTop: 1 }}>
                    Puan, deneme, buton yazıları ve görev seçenekleri.
                  </div>
                )}
              </div>
            </div>
            <span
              style={{
                color: '#546E7A',
                fontSize: 12,
                transform: openSection === 'behavior' ? 'rotate(180deg)' : 'rotate(0)',
                transition: 'transform .2s',
              }}
            >
              ▼
            </span>
          </div>
          {openSection === 'behavior' && (
            <div
              style={{
                padding: '4px 12px 12px',
                maxHeight: 'min(62vh, 760px)',
                overflowY: 'auto',
                paddingRight: 6,
                scrollbarGutter: 'stable',
                overscrollBehavior: 'contain',
              }}
            >
              {renderBehavior()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TextStudioWorkspace({
  activity,
  activities = [],
  variables = [],
  onUpdate,
  onClose,
  designPresets = [],
  onSavePreset,
  onApplyPreset,
  onDeletePreset,
  onOpenNewTab,
}) {
  const theme = getPackageTheme(activity?.buttonPackageId);
  const [studioViewportWidth, setStudioViewportWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1600
  );
  const [activeStudioSectionId, setActiveStudioSectionId] = useState('intro');
  const studioSections = [
    {
      id: 'intro',
      icon: '①',
      title: 'Karşılama',
      desc: 'Başlık, açıklama ve başlangıç butonu',
      editorSections: ['intro'],
      defaultSection: 'intro',
    },
    {
      id: 'package',
      icon: '②',
      title: 'Tema Paketi',
      desc: 'Hazır kalıplar, kart içerikleri ve tanıtım ekranı',
      editorSections: ['package'],
      defaultSection: 'package',
    },
    {
      id: 'menu',
      icon: '③',
      title: 'Menü Ekranı',
      desc: 'Kurallar, yönlendirme metinleri ve CTA alanı',
      editorSections: ['menu'],
      defaultSection: 'menu',
    },
    {
      id: 'play',
      icon: '④',
      title: 'Oyun',
      desc: 'Sahne görünümü, durum çubuğu ve aksiyonlar',
      editorSections: ['play'],
      defaultSection: 'play',
    },
    {
      id: 'result',
      icon: '⑤',
      title: 'Sonuç',
      desc: 'Başarı, hata ve cevap ekranlarını birlikte düzenle',
      editorSections: ['success', 'failure', 'answer'],
      defaultSection: 'success',
    },
    {
      id: 'settings',
      icon: '⚙',
      title: 'Genel Ayarlar',
      desc: 'Puan, akış, buton yazıları ve görev seçenekleri',
      editorSections: ['behavior'],
      defaultSection: 'behavior',
    },
  ];
  const activeStudioSection =
    studioSections.find((section) => section.id === activeStudioSectionId) || studioSections[0];

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleResize = () => setStudioViewportWidth(window.innerWidth);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!activity) {
    return (
      <div
        style={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'radial-gradient(circle at top left,#1d4ed8 0%,#0f172a 42%,#020617 100%)',
          padding: 24,
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            width: 'min(620px, 100%)',
            borderRadius: 28,
            background: 'rgba(255,255,255,.96)',
            border: '1px solid rgba(191,219,254,.45)',
            boxShadow: '0 30px 80px rgba(15,23,42,.35)',
            padding: 26,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              marginBottom: 12,
            }}
          >
            <div>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#0f172a' }}>Metin Stüdyosu</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                Önce ana editörde bir etkinlik seç, sonra stüdyo otomatik açılacak.
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                padding: '8px 12px',
                borderRadius: 12,
                border: '1px solid #cbd5e1',
                background: '#fff',
                color: '#334155',
                fontSize: 11,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Ana Editöre Dön
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background:
          'radial-gradient(circle at top left,#dbeafe 0%,#eef4ff 34%,#f8fbff 66%,#eef2ff 100%)',
        padding: 16,
        boxSizing: 'border-box',
        overflow: 'auto',
      }}
    >
      <div
        style={{
          height: '100%',
          display: 'grid',
          gridTemplateRows: 'auto minmax(0,1fr)',
          gap: 16,
          minWidth: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 14,
            padding: 16,
            borderRadius: 24,
            background: 'rgba(255,255,255,.92)',
            border: `1px solid ${theme.border}40`,
            boxShadow: '0 24px 60px rgba(15,23,42,.10)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 16,
                display: 'grid',
                placeItems: 'center',
                background: 'linear-gradient(135deg,#2563eb,#7c3aed 65%,#ec4899)',
                color: '#fff',
                fontSize: 20,
                fontWeight: 900,
                boxShadow: '0 14px 28px rgba(99,102,241,.28)',
              }}
            >
              ✦
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#0f172a' }}>
                  Metin Stüdyosu
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: '#4338ca',
                    background: '#eef2ff',
                    border: '1px solid #c7d2fe',
                    borderRadius: 999,
                    padding: '4px 8px',
                  }}
                >
                  Canva düzeni
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: '#0f766e',
                    background: '#ecfeff',
                    border: '1px solid #99f6e4',
                    borderRadius: 999,
                    padding: '4px 8px',
                  }}
                >
                  Canlı senkron
                </span>
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: '#64748b',
                  marginTop: 4,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {activity.name || 'Etkinlik'} · üstten ekranı seç, solda düzenle ve sağda anlık
                görünümü izle
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
              justifyContent: 'flex-end',
            }}
          >
            {onOpenNewTab && (
              <button
                onClick={onOpenNewTab}
                style={{
                  padding: '9px 12px',
                  borderRadius: 12,
                  border: '1px solid #e9d5ff',
                  background: '#faf5ff',
                  color: '#7c3aed',
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                ↗ Yeni Sekmede Aç
              </button>
            )}
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '9px 12px',
                borderRadius: 12,
                border: '1px solid #cbd5e1',
                background: '#fff',
                color: '#334155',
                fontSize: 11,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Önizlemeyi Yenile
            </button>
            <button
              onClick={onClose}
              style={{
                padding: '9px 12px',
                borderRadius: 12,
                border: '1px solid #bfdbfe',
                background: 'linear-gradient(180deg,#eff6ff,#ffffff)',
                color: '#1d4ed8',
                fontSize: 11,
                fontWeight: 900,
                cursor: 'pointer',
              }}
            >
              ← Ana Editöre Dön
            </button>
          </div>
        </div>

        <div
          style={{
            minHeight: 0,
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: 16,
            alignItems: 'stretch',
          }}
        >
          <section
            style={{
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 24,
              overflow: 'hidden',
              background: 'rgba(255,255,255,.94)',
              border: `1px solid ${theme.border}30`,
              boxShadow: '0 24px 60px rgba(15,23,42,.10)',
            }}
          >
            <div
              style={{
                padding: '14px 16px',
                borderBottom: '1px solid rgba(226,232,240,.95)',
                background: 'linear-gradient(180deg,#ffffff,#f8fbff)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 900, color: '#0f172a' }}>
                    Özellik Paneli
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                    Metin, buton, görünüm ve davranış ayarları artık daha geniş ve tek akışta.
                  </div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    flexWrap: 'wrap',
                    justifyContent: 'flex-end',
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      color: '#0f766e',
                      background: '#ecfeff',
                      border: '1px solid #99f6e4',
                      borderRadius: 999,
                      padding: '4px 8px',
                    }}
                  >
                    Otomatik kayıt
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#475569',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: 999,
                      padding: '4px 8px',
                    }}
                  >
                    Alt maddeler için daha ferah görünüm
                  </span>
                </div>
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  flexWrap: 'nowrap',
                  overflowX: 'auto',
                  paddingBottom: 4,
                  marginTop: 12,
                  scrollbarGutter: 'stable',
                }}
              >
                {studioSections.map((section) => {
                  const isActive = activeStudioSection.id === section.id;
                  return (
                    <button
                      key={section.id}
                      onClick={() => setActiveStudioSectionId(section.id)}
                      title={section.desc}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '7px 11px',
                        borderRadius: 999,
                        background: isActive ? '#2563eb' : '#eff6ff',
                        border: `1px solid ${isActive ? '#1d4ed8' : '#bfdbfe'}`,
                        color: isActive ? '#ffffff' : '#1d4ed8',
                        fontSize: 11,
                        fontWeight: 800,
                        cursor: 'pointer',
                        flexShrink: 0,
                        boxShadow: isActive ? '0 10px 24px rgba(37,99,235,.22)' : 'none',
                      }}
                    >
                      <span>{section.icon}</span>
                      <span>{section.title}</span>
                    </button>
                  );
                })}
              </div>
              <div style={{ marginTop: 10, fontSize: 11, color: '#475569', lineHeight: 1.5 }}>
                <strong style={{ color: '#0f172a' }}>{activeStudioSection.title}:</strong>{' '}
                {activeStudioSection.desc}
              </div>
            </div>
            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflow: 'auto',
                padding: 14,
                background: 'linear-gradient(180deg,#0f172a,#111827 42%,#0b1120 100%)',
                scrollbarGutter: 'stable',
              }}
            >
              <ActivityTextEditor
                activity={activity}
                onUpdate={onUpdate}
                designPresets={designPresets}
                onSavePreset={onSavePreset}
                onApplyPreset={onApplyPreset}
                onDeletePreset={onDeletePreset}
                visibleSectionIds={activeStudioSection.editorSections}
                preferredOpenSection={activeStudioSection.defaultSection}
                sectionTitle={activeStudioSection.title}
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

// ─── ANA UYGULAMA ─────────────────────────────────────────────────────────────

export default function EIcerikEditor() {
  const [authState, setAuthState] = useState(() => readStoredAuth());
  const [loginForm, setLoginForm] = useState(() => {
    return {
      userId: FIXED_EDITOR_USERS[0].id,
      password: '',
    };
  });
  const [loginError, setLoginError] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [lockState, setLockState] = useState(null);
  const [logoutReason, setLogoutReason] = useState(null);
  const [kickRequested, setKickRequested] = useState(false);
  const [kickCountdown, setKickCountdown] = useState(30);
  const [, setBookLockInfo] = useState(null);
  const [bookLockWarning, setBookLockWarning] = useState('');
  // Seviye 1 isbirligi: heartbeat'ten gelen presence (online kullanicilar + kilitler)
  const [presence, setPresence] = useState({ users: [], locks: [] });
  const [history, setHistory] = useState(() =>
    readStoredEditorHistory(readStoredAuth()?.userId, INITIAL_STATE)
  );
  const [lastSaved, setLastSaved] = useState(null);
  const dbStatus = useEditorStore((state) => state.dbStatus);
  const setDbStatus = useEditorStore((state) => state.setDbStatus);
  const editorPreviewState = useEditorStore((state) => state.editorPreviewState);
  const setEditorPreviewState = useEditorStore((state) => state.setEditorPreviewState);
  const activeTab = useEditorStore((state) => state.activeTab);
  const setActiveTab = useEditorStore((state) => state.setActiveTab);
  const storyRibbonTab = useEditorStore((state) => state.storyRibbonTab);
  const setStoryRibbonTab = useEditorStore((state) => state.setStoryRibbonTab);
  const [ribbonStateKey, setRibbonStateKey] = useState('hover');
  const [ribbonAnimationPreviewKey, setRibbonAnimationPreviewKey] = useState(0);
  const showReviewThreads = useEditorStore((state) => state.showReviewThreads);
  const setShowReviewThreads = useEditorStore((state) => state.setShowReviewThreads);
  const canvasExpanded = useEditorStore((state) => state.canvasExpanded);
  const setCanvasExpanded = useEditorStore((state) => state.setCanvasExpanded);
  // "Tam Ekran": mevcut editörü tarayıcı tam-ekranına geçirir (ayrı bir düzen
  // açmaz). Esc tarayıcı tarafından otomatik kapatır.
  const toggleNativeFullscreen = useCallback(() => {
    try {
      if (typeof document === 'undefined') return;
      if (document.fullscreenElement) {
        document.exitFullscreen?.();
      } else {
        document.documentElement?.requestFullscreen?.();
      }
    } catch {
      /* tarayıcı tam-ekranı reddederse sessiz geç */
    }
  }, []);
  const [storylinePreviewOpen, setStorylinePreviewOpen] = useState(false);
  const [storylinePreviewSnapshot, setStorylinePreviewSnapshot] = useState(null);
  const [answerDrawerOpen, setAnswerDrawerOpen] = useState(false);
  const zoom = useEditorStore((state) => state.zoom);
  const setZoom = useEditorStore((state) => state.setZoom);
  const panelScale = useEditorStore((state) => state.panelScale);
  const setPanelScale = useEditorStore((state) => state.setPanelScale);
  const timelineHeight = useEditorStore((state) => state.timelineHeight);
  const setTimelineHeight = useEditorStore((state) => state.setTimelineHeight);
  const timelineCurrentTime = useEditorStore((state) => state.timelineCurrentTime);
  const setTimelineCurrentTime = useEditorStore((state) => state.setTimelineCurrentTime);
  const timelinePlaying = useEditorStore((state) => state.timelinePlaying);
  const setTimelinePlaying = useEditorStore((state) => state.setTimelinePlaying);
  const leftPanelWidth = useEditorStore((state) => state.leftPanelWidth);
  const setLeftPanelWidth = useEditorStore((state) => state.setLeftPanelWidth);
  const rightPanelWidth = useEditorStore((state) => state.rightPanelWidth);
  const setRightPanelWidth = useEditorStore((state) => state.setRightPanelWidth);
  const isSlidePanelCollapsed = useEditorStore((state) => state.isSlidePanelCollapsed);
  const setIsSlidePanelCollapsed = useEditorStore((state) => state.setIsSlidePanelCollapsed);
  const canvasTool = useEditorStore((state) => state.canvasTool);
  const setCanvasTool = useEditorStore((state) => state.setCanvasTool);
  const timelineVisualization = useEditorStore((state) => state.timelineVisualization);
  const setTimelineVisualization = useEditorStore((state) => state.setTimelineVisualization);
  const timelineDockOpen = useEditorStore((state) => state.timelineDockOpen);
  const setTimelineDockOpen = useEditorStore((state) => state.setTimelineDockOpen);
  const uiMode = 'advanced';
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1280
  );
  const [workspaceInfo, setWorkspaceInfo] = useState({
    currentProject: null,
    projects: [],
    versions: [],
  });
  const [showProjectManager, setShowProjectManager] = useState(false);
  const [showVariablesManager, setShowVariablesManager] = useState(false);
  const [showBranchDiagram, setShowBranchDiagram] = useState(false);
  const [showGlossaryEditor, setShowGlossaryEditor] = useState(false);
  const [showDesignTools, setShowDesignTools] = useState(false);
  const [showAdminManagement, setShowAdminManagement] = useState(false);
  const [adminSessionToken, setAdminSessionTokenState] = useState('');
  const [isTextStudioMode, setIsTextStudioMode] = useState(() =>
    typeof window !== 'undefined' ? window.location.hash === '#text-studio' : false
  );
  const [projectNameDraft, setProjectNameDraft] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [versionLabel, setVersionLabel] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showBaseLayer, setShowBaseLayer] = useState(true);
  const [pendingResume, setPendingResume] = useState(null);
  const [hasCheckedResume, setHasCheckedResume] = useState(false);
  const [toasts, setToasts] = useState([]);
  const canvasRef = useRef(null);
  const editorScrollRef = useRef(null);
  const mobileInspectorRef = useRef(null);
  const importRef = useRef(null);
  const remoteReadyRef = useRef(false);
  const hasLoadedRemoteWorkspaceRef = useRef(false);
  const skipRemoteSaveRef = useRef(false);
  const lastRemoteUpdatedAtRef = useRef(null);
  const lastWorkspaceRef = useRef(null);
  const saveFailCountRef = useRef(0);
  const heartbeatFailCountRef = useRef(0);
  const remoteSavePendingRef = useRef(false);
  const offlineDraftPendingRef = useRef(false);
  const resizeSessionRef = useRef(null);
  const toastIdRef = useRef(0);
  const adminSessionTokenRef = useRef('');
  const objectClipboardRef = useRef(null);
  const slideClipboardRef = useRef(null);
  const slideClipboardCommandsRef = useRef({});
  const workspaceEntryModeRef = useRef(authState?.userId ? 'refresh' : 'anonymous');
  const presentRef = useRef(history.present);
  const currentRouteRef = useRef(routeFromSelection(history.present));
  const currentProjectIdRef = useRef(null);
  const browserHistoryCursorRef = useRef(0);
  const navigationBusyRef = useRef(false);
  const navigationSequenceRef = useRef(0);
  const backDismissEntriesRef = useRef([]);
  const backDismissOverlayIdsRef = useRef(new Set());
  const backDismissOrderRef = useRef(0);

  const setAdminSessionToken = useCallback((value) => {
    adminSessionTokenRef.current = value;
    setAdminSessionTokenState(value);
  }, []);

  const showToast = useCallback((message, type = 'error') => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev.slice(-4), { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const present = history.present;
  const currentRoute = useMemo(() => routeFromSelection(present), [
    present,
  ]);
  const activeUser =
    (authState?.user?.name ? authState.user : null) ||
    FIXED_EDITOR_USERS.find((user) => user.id === authState?.userId) ||
    authState?.user ||
    null;
  const activeUserId = authState?.userId || '';
  const activeSessionId = authState?.sessionId || '';
  const { onlineUsers, currentBookEditor } = usePresence({
    presence,
    currentUserId: activeUserId,
    activeBookId: present.selBookId,
    onNotify: showToast,
  });
  const isRemoteMutationLocked =
    isRemoteWorkspaceMutationLocked(activeUserId, dbStatus) &&
    !hasLoadedRemoteWorkspaceRef.current;
  const keepBootVisibleForWorkspace = shouldKeepBootVisibleForWorkspace(
    activeUserId,
    dbStatus,
    hasLoadedRemoteWorkspaceRef.current
  );
  const currentProject = workspaceInfo.currentProject;
  const currentProjectId = currentProject?.id || null;
  useEffect(() => {
    presentRef.current = present;
    currentRouteRef.current = currentRoute;
    currentProjectIdRef.current = currentProjectId;
  }, [currentProjectId, currentRoute, present]);

  const writeBrowserRoute = useCallback((route = {}, mode = 'push', kind = 'route', overlayId = '') => {
    if (typeof window === 'undefined') return;
    const cursor =
      mode === 'replace'
        ? browserHistoryCursorRef.current || getEditorHistoryState(window.history.state)?.cursor || 0
        : browserHistoryCursorRef.current + 1;
    browserHistoryCursorRef.current = cursor;
    const navState = createEditorHistoryState(route, cursor, kind, overlayId);
    const url = buildEditorUrl(route, window.location);
    if (mode === 'replace') {
      window.history.replaceState(navState, '', url);
    } else {
      window.history.pushState(navState, '', url);
    }
  }, []);

  const persistCurrentStateLocal = useCallback(() => {
    if (!activeUserId || typeof window === 'undefined') return;
    try {
      localStorage.setItem(
        getUserStorageKey(activeUserId),
        JSON.stringify(createSafeStateForStorage(presentRef.current))
      );
      setLastSaved(new Date());
    } catch {}
  }, [activeUserId]);

  const dismissTopBackSurface = useCallback(() => {
    const entries = orderBackDismissEntries(backDismissEntriesRef.current);
    const entry = entries[0];
    if (!entry) return false;
    entry.onDismiss?.();
    return true;
  }, []);

  const hasBlockingBackSurface = useCallback(
    () =>
      Boolean(
        pendingResume ||
          kickRequested ||
          isRemoteWorkspaceMutationLocked(activeUserId, dbStatus)
      ),
    [activeUserId, dbStatus, kickRequested, pendingResume]
  );

  const registerBackDismissible = useCallback(
    ({ id, onDismiss, priority = 0, blocking = false }) => {
      if (!id || typeof onDismiss !== 'function') return () => {};
      backDismissEntriesRef.current = backDismissEntriesRef.current
        .filter((entry) => entry.id !== id)
        .concat({ id, onDismiss, priority, blocking, order: ++backDismissOrderRef.current });

      if (!blocking && !backDismissOverlayIdsRef.current.has(id)) {
        backDismissOverlayIdsRef.current.add(id);
        writeBrowserRoute(currentRouteRef.current, 'push', 'overlay-guard', id);
      }

      return () => {
        backDismissEntriesRef.current = backDismissEntriesRef.current.filter((entry) => entry.id !== id);
        backDismissOverlayIdsRef.current.delete(id);
        const currentNav = typeof window !== 'undefined' ? getEditorHistoryState(window.history.state) : null;
        if (currentNav?.kind === 'overlay-guard' && currentNav.overlayId === id) {
          writeBrowserRoute(currentRouteRef.current, 'replace');
        }
      };
    },
    [writeBrowserRoute]
  );
  const deviceMode = getDeviceMode(viewportWidth);
  const isCompactViewport = viewportWidth <= 720;
  const effectivePanelScale = panelScale;
  const currentZoomPercent = useMemo(() => {
    const selectedActivity = present.activities.find((item) => item.id === present.selActId);
    if (!selectedActivity) return 100;
    const stageWidth = selectedActivity.stageWidth || 1920;
    const stageHeight = selectedActivity.stageHeight || 1080;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 760;
    const estimatedWidth = Math.max(
      260,
      viewportWidth - (leftPanelWidth + rightPanelWidth + 140)
    );
    const estimatedHeight = Math.max(
      240,
      viewportHeight - timelineHeight - 210
    );
    const fitScale = getFitScale(
      stageWidth,
      stageHeight,
      estimatedWidth - 20,
      estimatedHeight - 52
    );
    const resolvedScale = zoom === 'fit' ? fitScale : Number(zoom) || fitScale;
    return Math.round(resolvedScale * 100);
  }, [
    leftPanelWidth,
    present.activities,
    present.selActId,
    rightPanelWidth,
    timelineHeight,
    viewportWidth,
    zoom,
  ]);
  const adjustStageZoom = useCallback(
    (delta) => {
      setZoom((current) => {
        const currentScale = current === 'fit' ? currentZoomPercent / 100 : Number(current) || 1;
        return clamp(Number((currentScale + delta).toFixed(2)), 0.1, 4);
      });
    },
    [currentZoomPercent, setZoom]
  );

  const resetWorkspaceSession = useCallback((userId = '') => {
    skipRemoteSaveRef.current = true;
    remoteReadyRef.current = false;
    hasLoadedRemoteWorkspaceRef.current = false;
    offlineDraftPendingRef.current = false;
    lastRemoteUpdatedAtRef.current = null;
    setHistory(readStoredEditorHistory(userId, INITIAL_STATE));
    setWorkspaceInfo({ currentProject: null, projects: [], versions: [] });
    setProjectNameDraft('');
    setNewProjectName('');
    setVersionLabel('');
    setSelectedIds(new Set());
    setShowProjectManager(false);
    setBookLockInfo(null);
    setBookLockWarning('');
    setActiveTab('sahne');
    setTimelineCurrentTime(0);
    setTimelinePlaying(false);
    setDbStatus(userId ? 'connecting' : 'auth-required');
    if (!userId) {
      backDismissEntriesRef.current = [];
      backDismissOverlayIdsRef.current = new Set();
      setIsTextStudioMode(false);
      writeBrowserRoute({}, 'replace');
    }
  }, [setActiveTab, setDbStatus, setTimelineCurrentTime, setTimelinePlaying, writeBrowserRoute]);

  useLayoutEffect(() => {
    if (!keepBootVisibleForWorkspace) return undefined;
    window.__EIC_BOOT_UPDATE__?.({
      badge: 'Editör Başlatılıyor',
      title: 'Arayüz hazırlanıyor...',
      body: 'SQL bağlantısı doğrulanıyor. Çalışma alanı hazır olunca editör açılacak.',
      showSpinner: true,
    });
    return () => window.__EIC_BOOT_DONE__?.();
  }, [keepBootVisibleForWorkspace]);

  const finalizeLogin = useCallback(
    (nextAuth) => {
      workspaceEntryModeRef.current = 'login';
      writeStoredAuth(nextAuth);
      setAuthState(nextAuth);
      setLockState(null);
      setLoginError('');
      resetWorkspaceSession(nextAuth.userId);
    },
    [resetWorkspaceSession]
  );

  const forceLogoutToLogin = useCallback(
    (message = '', nextLockState = null) => {
      if (message && !nextLockState) {
        setLogoutReason(message);
      }
      clearActiveSessionNavigation(activeUserId, activeSessionId);
      clearStoredAuth();
      workspaceEntryModeRef.current = 'anonymous';
      setAuthState(null);
      setLockState(nextLockState);
      setLoginForm((current) => ({
        ...current,
        userId: nextLockState?.userId || current.userId,
        password: nextLockState?.password || current.password,
      }));
      setLoginError(nextLockState ? '' : message);
      resetWorkspaceSession('');
    },
    [activeSessionId, activeUserId, resetWorkspaceSession]
  );

  const claimLoginSession = useCallback(async (credentials, preferredSession = null) => {
    const sessionId = preferredSession?.sessionId || createSessionId();
    const sessionLabel = preferredSession?.sessionLabel || createSessionLabel();
    const response = await apiRequest('/auth/login', {
      method: 'POST',
      headers: { 'X-User-Id': '', 'X-Session-Id': '' },
      body: JSON.stringify({
        userId: credentials.userId,
        password: credentials.password,
        sessionId,
        sessionLabel,
        force: credentials.force || false,
      }),
    });
    return {
      userId: response?.user?.id || credentials.userId,
      user:
        response?.user || FIXED_EDITOR_USERS.find((item) => item.id === credentials.userId) || null,
      sessionId,
      sessionLabel,
      token: response?.token || '',
      tokenExpiresAt: response?.tokenExpiresAt || null,
    };
  }, []);

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleHashChange = () => setIsTextStudioMode(window.location.hash === '#text-studio');
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    const handleStorage = (event) => {
      if (
        !activeUserId ||
        dbStatus !== 'connected' ||
        event.key !== getUserStorageKey(activeUserId) ||
        !event.newValue
      )
        return;
      try {
        const next = normalizeState(JSON.parse(event.newValue));
        setHistory((prev) =>
          JSON.stringify(prev.present) === JSON.stringify(next) ? prev : { ...prev, present: next }
        );
      } catch {}
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [activeUserId, dbStatus, resetWorkspaceSession]);

  const commit = useCallback(
    (updater) => {
      if (isRemoteMutationLocked) {
        showToast('SQL bağlantısı yeniden kuruluyor. Düzenleme bağlantı sağlanınca açılacak.', 'warning');
        return;
      }
      setHistory((h) => {
        const next = typeof updater === 'function' ? updater(h.present) : updater;
        if (Object.is(next, h.present)) return h;
        return { past: [...h.past.slice(-39), h.present], present: next, future: [] };
      });
    },
    [isRemoteMutationLocked, showToast]
  );

  const undo = useCallback(
    () => {
      if (isRemoteMutationLocked) {
        showToast('SQL bağlantısı yeniden kuruluyor. Geri alma geçici olarak kapalı.', 'warning');
        return;
      }
      setHistory((h) =>
        h.past.length
          ? {
              past: h.past.slice(0, -1),
              present: h.past[h.past.length - 1],
              future: [h.present, ...h.future].slice(0, 40),
            }
          : h
      );
    },
    [isRemoteMutationLocked, showToast]
  );
  const redo = useCallback(
    () => {
      if (isRemoteMutationLocked) {
        showToast('SQL bağlantısı yeniden kuruluyor. İleri alma geçici olarak kapalı.', 'warning');
        return;
      }
      setHistory((h) =>
        h.future.length
          ? {
              past: [...h.past, h.present].slice(-40),
              present: h.future[0],
              future: h.future.slice(1),
            }
          : h
      );
    },
    [isRemoteMutationLocked, showToast]
  );

  const syncWorkspaceMeta = useCallback(
    (workspace) => {
      if (!workspace) return;
      const nextCurrentProject = workspace.currentProject || null;
      setWorkspaceInfo({
        currentProject: nextCurrentProject,
        projects: Array.isArray(workspace.projects) ? workspace.projects : [],
        versions: Array.isArray(workspace.versions) ? workspace.versions : [],
      });
      setProjectNameDraft((prev) => {
        if (nextCurrentProject?.id && nextCurrentProject.id === currentProjectId) {
          return prev || nextCurrentProject.name || '';
        }
        return nextCurrentProject?.name || '';
      });
    },
    [currentProjectId]
  );

  const loadWorkspaceState = useCallback(
    (workspace, { beginAtPublisherRoot = false, navigationOverride = null } = {}) => {
      syncWorkspaceMeta(workspace);
      skipRemoteSaveRef.current = true;
      const loadedPresent = normalizeState({ ...INITIAL_STATE, ...(workspace?.state || INITIAL_STATE) });
      const nextPresent = beginAtPublisherRoot
        ? resetNavigationForResumePrompt(loadedPresent)
        : navigationOverride
          ? restoreActiveSessionNavigation(loadedPresent, navigationOverride)
          : loadedPresent;
      setHistory({
        past: [],
        present: nextPresent,
        future: [],
      });
      const nextRoute = routeFromSelection(nextPresent);
      const keepTextStudioHash = typeof window !== 'undefined' && window.location.hash === '#text-studio';
      writeBrowserRoute(keepTextStudioHash ? { ...nextRoute, textStudio: true } : nextRoute, 'replace');
      setIsTextStudioMode(keepTextStudioHash);
      setSelectedIds(new Set());
      setActiveTab('sahne');
      setTimelineCurrentTime(0);
      setTimelinePlaying(false);
      return nextPresent;
    },
    [setActiveTab, setTimelineCurrentTime, setTimelinePlaying, syncWorkspaceMeta, writeBrowserRoute]
  );

  const mergeWorkspaceProjectData = useCallback((payload) => {
    setWorkspaceInfo((info) => ({
      currentProject: payload.currentProject || info.currentProject,
      projects: Array.isArray(payload.projects)
        ? payload.projects
        : payload.currentProject
          ? info.projects.map((project) =>
              project.id === payload.currentProject.id
                ? { ...project, ...payload.currentProject }
                : project
            )
          : info.projects,
      versions: Array.isArray(payload.versions) ? payload.versions : info.versions,
    }));
    if (payload.currentProject?.name) {
      setProjectNameDraft(payload.currentProject.name);
    }
  }, []);

  const releaseBookLock = useCallback(
    async (projectId, bookId) => {
      const resolvedProjectId = String(projectId || '').trim();
      const resolvedBookId = String(bookId || '').trim();
      if (!resolvedProjectId || !resolvedBookId || !activeUserId || !activeSessionId) return;
      try {
        await apiRequest(`/projects/${resolvedProjectId}/books/${resolvedBookId}/unlock`, {
          method: 'POST',
          timeoutMs: BOOK_LOCK_REQUEST_TIMEOUT_MS,
        });
      } catch {}
      setBookLockInfo((current) =>
        current?.projectId === resolvedProjectId && current?.bookId === resolvedBookId
          ? null
          : current
      );
    },
    [activeSessionId, activeUserId]
  );

  const acquireBookLock = useCallback(
    async (projectId, bookId) => {
      const resolvedProjectId = String(projectId || '').trim();
      const resolvedBookId = String(bookId || '').trim();
      if (!resolvedProjectId || !resolvedBookId) return false;
      try {
        const response = await apiRequest(
          `/projects/${resolvedProjectId}/books/${resolvedBookId}/lock`,
          { method: 'POST', timeoutMs: BOOK_LOCK_REQUEST_TIMEOUT_MS }
        );
        setBookLockInfo(response?.lock || { projectId: resolvedProjectId, bookId: resolvedBookId });
        setBookLockWarning('');
        return true;
      } catch (error) {
        if (error?.code === 'BOOK_LOCKED') {
          const message = formatBookLockMessage(error.lock, error.message || 'Bu kitap kilitli.');
          setBookLockWarning(message);
          showToast(message, 'warning');
          return false;
        }
        throw error;
      }
    },
    [showToast]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      const ae = document.activeElement;
      if (
        ae?.tagName === 'INPUT' ||
        ae?.tagName === 'TEXTAREA' ||
        ae?.tagName === 'SELECT' ||
        ae?.isContentEditable
      )
        return;
      const modKey = e.ctrlKey || e.metaKey;
      const currentActivity = history.present.activities.find(
        (activity) => activity.id === history.present.selActId
      );
      const slideTreeFocused = !!ae?.closest?.('[data-slide-tree-item="true"]');
      const useSlideClipboard =
        slideTreeFocused ||
        (storyRibbonTab === 'scene' &&
          selectedIds.size === 0 &&
          !currentActivity?.selectedObjectId);

      if (modKey && e.key === 'z') {
        e.preventDefault();
        undo();
        return;
      }
      if (modKey && e.key === 'y') {
        e.preventDefault();
        redo();
        return;
      }
      if (modKey && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        toggleNativeFullscreen();
        return;
      }

      if (!canvasRef.current) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        canvasRef.current.deleteSelected();
      } else if (modKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        if (useSlideClipboard && slideClipboardCommandsRef.current.copySlide?.()) return;
        canvasRef.current.copySelected?.();
      } else if (modKey && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        if (useSlideClipboard && slideClipboardCommandsRef.current.pasteSlide?.()) return;
        canvasRef.current.pasteClipboard?.();
      } else if (modKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        canvasRef.current.duplicateSelected();
      } else if (modKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        const a = history.present;
        setSelectedIds(
          new Set((a.activities.find((x) => x.id === a.selActId)?.objects || []).map((o) => o.id))
        );
      } else if (e.key === 'Escape') {
        if (canvasExpanded) {
          setCanvasExpanded(false);
        } else {
          setSelectedIds(new Set());
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        canvasRef.current.nudge(e.shiftKey ? -10 : -1, 0);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        canvasRef.current.nudge(e.shiftKey ? 10 : 1, 0);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        canvasRef.current.nudge(0, e.shiftKey ? -10 : -1);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        canvasRef.current.nudge(0, e.shiftKey ? 10 : 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canvasExpanded, history.present, redo, selectedIds, setCanvasExpanded, storyRibbonTab, toggleNativeFullscreen, undo]);

  useEffect(() => {
    const blockBrowserZoomKeys = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (['+', '=', '-', '0'].includes(e.key)) {
        e.preventDefault();
      }
    };

    const blockBrowserZoomWheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.target?.closest?.("[data-stage-zoom-scope='true']")) return;
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', blockBrowserZoomKeys, { capture: true });
    window.addEventListener('wheel', blockBrowserZoomWheel, { passive: false });

    return () => {
      window.removeEventListener('keydown', blockBrowserZoomKeys, { capture: true });
      window.removeEventListener('wheel', blockBrowserZoomWheel, { passive: false });
    };
  }, []);

  const setNavigationRouteState = useCallback((route) => {
    setHistory((h) => {
      const normalized = routeFromSelection({
        selPubId: route.pubId,
        selBookId: route.bookId,
        selActId: route.actId,
      });
      const nextPresent = {
        ...h.present,
        selPubId: normalized.pubId,
        selBookId: normalized.bookId,
        selActId: normalized.actId,
      };
      if (
        h.present.selPubId === nextPresent.selPubId &&
        h.present.selBookId === nextPresent.selBookId &&
        h.present.selActId === nextPresent.selActId
      ) {
        return h;
      }
      return { ...h, present: nextPresent };
    });
  }, []);

  const navigateToEditorRoute = useCallback(
    async (route, { mode = 'push', source = 'push' } = {}) => {
      const sequence = ++navigationSequenceRef.current;
      if (navigationBusyRef.current && source !== 'pop') return false;
      navigationBusyRef.current = true;

      try {
        const state = presentRef.current;
        const current = routeFromSelection(state);
        const resolvedRoute = resolveEditorRoute(route || {}, state);

        if (resolvedRoute.textStudio) {
          const textStudioRoute = { ...current, textStudio: true };
          setIsTextStudioMode(true);
          if (source !== 'pop') writeBrowserRoute(textStudioRoute, mode);
          return true;
        }

        setIsTextStudioMode(false);

        const bookChanged =
          Boolean(currentProjectIdRef.current) && current.bookId !== resolvedRoute.bookId;

        // İyimser seçim: rota/seçim HEMEN uygulanır; kitap kilidi arka planda
        // alınır. Böylece yavaş internette kilit isteği beklenirken UI
        // kilitlenmez ve kullanıcı seçim yapabilir.
        setNavigationRouteState(resolvedRoute);
        if (current.actId !== resolvedRoute.actId) {
          setSelectedIds(new Set());
          setActiveTab('sahne');
        }

        if (source !== 'pop') {
          writeBrowserRoute(resolvedRoute, routesEqual(current, resolvedRoute) ? 'replace' : mode);
        } else if (!routesEqual(route, resolvedRoute)) {
          writeBrowserRoute(resolvedRoute, 'replace');
        }

        if (bookChanged) {
          if (current.bookId) {
            // eski kitabın kilidini arka planda bırak (beklemeden)
            releaseBookLock(currentProjectIdRef.current, current.bookId);
          }
          if (resolvedRoute.bookId) {
            // yeni kitabı arka planda kilitle; başkası kilitlemişse önceki
            // (kitapsız) duruma dön. Timeout/ağ hatasında kilit kayıt anında
            // (lockBookId ile) yeniden denenir.
            acquireBookLock(currentProjectIdRef.current, resolvedRoute.bookId)
              .then((locked) => {
                if (locked === false && sequence === navigationSequenceRef.current) {
                  const revert = { pubId: resolvedRoute.pubId || null, bookId: null, actId: null };
                  setNavigationRouteState(revert);
                  writeBrowserRoute(revert, 'replace');
                }
              })
              .catch(() => {});
          }
        }
        return true;
      } finally {
        if (sequence === navigationSequenceRef.current) {
          navigationBusyRef.current = false;
        }
      }
    },
    [
      acquireBookLock,
      releaseBookLock,
      setActiveTab,
      setNavigationRouteState,
      writeBrowserRoute,
    ]
  );

  // Reset selection when switching activity
  const handleSelectAct = useCallback(
    (id) => {
      return navigateToEditorRoute(
        { pubId: presentRef.current.selPubId, bookId: presentRef.current.selBookId, actId: id || null },
        { mode: 'push' }
      );
    },
    [navigateToEditorRoute]
  );

  useEffect(() => {
    const saveState = () => {
      if (isRemoteMutationLocked || pendingResume) return;
      try {
        localStorage.setItem(
          getUserStorageKey(activeUserId),
          JSON.stringify(createSafeStateForStorage(present))
        );
        setLastSaved(new Date());
        if (dbStatus === 'reconnecting') offlineDraftPendingRef.current = true;
      } catch {}
    };

    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
      const idleId = window.requestIdleCallback(saveState, { timeout: 500 });
      return () => window.cancelIdleCallback(idleId);
    }

    const timer = window.setTimeout(saveState, 180);
    return () => window.clearTimeout(timer);
  }, [activeUserId, dbStatus, isRemoteMutationLocked, pendingResume, present]);


  useEffect(() => {
    if (!activeUserId || typeof window === 'undefined') return undefined;
    const handleBeforeUnload = (event) => {
      persistCurrentStateLocal();
      if (
        shouldWarnBeforeLeavingEditor({
          remoteSavePending: remoteSavePendingRef.current,
          offlineDraftPending: offlineDraftPendingRef.current,
          dbStatus,
        })
      ) {
        event.preventDefault();
        event.returnValue = '';
        return '';
      }
      return undefined;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [activeUserId, dbStatus, persistCurrentStateLocal]);


  useEffect(() => {
    const handlePointerMove = (e) => {
      const session = resizeSessionRef.current;
      if (!session) return;
      if (session.type === 'timeline') {
        setTimelineHeight(clamp(session.startValue + (session.startY - e.clientY), 180, 460));
      } else if (session.type === 'right-panel') {
        setRightPanelWidth(
          clamp(
            session.startValue + (session.startX - e.clientX),
            PANEL_LIMITS.right.min,
            PANEL_LIMITS.right.max
          )
        );
      } else if (session.type === 'left-panel') {
        setLeftPanelWidth(
          clamp(
            session.startValue + (e.clientX - session.startX),
            PANEL_LIMITS.left.min,
            PANEL_LIMITS.left.max
          )
        );
      }
    };

    const handlePointerUp = () => {
      if (!resizeSessionRef.current) return;
      resizeSessionRef.current = null;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [setLeftPanelWidth, setRightPanelWidth, setTimelineHeight]);

  useEffect(() => {
    let cancelled = false;
    remoteReadyRef.current = false;
    if (!activeUserId) {
      setDbStatus('auth-required');
      return () => {
        cancelled = true;
      };
    }
    setDbStatus('connecting');
    (async () => {
      const resolveBootNavigation = () => {
        const bootHashRoute = parseHashRoute(typeof window !== 'undefined' ? window.location.hash : '');
        return bootHashRoute
          ? bootHashRoute
          : workspaceEntryModeRef.current === 'refresh'
            ? getActiveSessionNavigation(activeUserId, activeSessionId)
            : getSessionResume(activeUserId);
      };

      // 1) Stale-while-revalidate: önbellekteki son çalışma alanını ANINDA göster
      //    (yavaş internette boot ekranında beklemeden). Önbellek = bu cihazdaki
      //    son kaydedilen hâl olduğu için kullanıcı her zaman son işini görür.
      const cached = readWorkspaceCache(activeUserId);
      let cacheShownUpdatedAt = null;
      if (cached?.workspace) {
        try {
          syncWorkspaceMeta(cached.workspace);
          loadWorkspaceState(cached.workspace, {
            beginAtPublisherRoot: false,
            navigationOverride: resolveBootNavigation(),
          });
          cacheShownUpdatedAt = cached.updatedAt || null;
          // Editör görünür olsun ama henüz sunucu doğrulamadı → otomatik kayıt
          // (remoteReadyRef) sunucu yanıtı gelene kadar başlamaz.
          setDbStatus('connected');
        } catch {
          cacheShownUpdatedAt = null;
        }
      }

      // 2) Arka planda sunucudan taze veriyi getir.
      try {
        const sr = await apiRequest('/workspace', { timeoutMs: REMOTE_STATUS_REQUEST_TIMEOUT_MS });
        if (cancelled) return;
        syncWorkspaceMeta(sr);
        lastRemoteUpdatedAtRef.current = sr.updatedAt || null;
        saveFailCountRef.current = 0;
        heartbeatFailCountRef.current = 0;
        // Önbellek gösterildiyse ve sunucu sürümü AYNIysa yeniden yükleme yapma
        // (titreme olmasın). Sunucu daha yeniyse (başka cihaz) onu uygula.
        const serverSameAsCache =
          cacheShownUpdatedAt && sr.updatedAt && sr.updatedAt === cacheShownUpdatedAt;
        if (!serverSameAsCache) {
          loadWorkspaceState(sr, {
            beginAtPublisherRoot: false,
            navigationOverride: resolveBootNavigation(),
          });
        }
        lastWorkspaceRef.current = sr;
        writeWorkspaceCache(activeUserId, sr);
        remoteReadyRef.current = true;
        hasLoadedRemoteWorkspaceRef.current = true;
        setDbStatus('connected');
      } catch (error) {
        if (cancelled) return;
        if (requiresFreshEditorSession(error)) {
          forceLogoutToLogin(error.message || 'Oturumunuz sona erdi. Lütfen yeniden giriş yapın.');
          return;
        }
        if (error?.code === 'USER_LOCKED') {
          forceLogoutToLogin('', {
            userId: activeUserId,
            password: loginForm.password,
            sessionId: activeSessionId,
            sessionLabel: authState?.sessionLabel || createSessionLabel(),
            session: error.session || null,
            message: error.message || 'Bu kullanıcı başka bir cihazda aktif.',
          });
          return;
        }
        remoteReadyRef.current = false;
        // Önbellek gösteriliyorsa kullanıcı son işini görmeye devam etsin;
        // yeniden bağlanma akışı arka planda sunucuyu dener.
        setDbStatus('reconnecting');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    activeSessionId,
    activeUserId,
    authState?.sessionLabel,
    forceLogoutToLogin,
    loadWorkspaceState,
    loginForm.password,
    setDbStatus,
    syncWorkspaceMeta,
  ]);

  useEffect(() => {
    if (!activeUserId || dbStatus !== 'reconnecting') return undefined;
    let cancelled = false;
    let retryTimer = null;

    const reconnectWorkspace = async () => {
      try {
        const workspace = await apiRequest('/workspace', {
          timeoutMs: REMOTE_STATUS_REQUEST_TIMEOUT_MS,
        });
        if (cancelled) return;
        const hadLoadedWorkspace = hasLoadedRemoteWorkspaceRef.current;
        syncWorkspaceMeta(workspace);
        lastRemoteUpdatedAtRef.current = workspace.updatedAt || null;
        saveFailCountRef.current = 0;
        heartbeatFailCountRef.current = 0;
        if (!hadLoadedWorkspace) {
          const bootHashRoute2 = parseHashRoute(typeof window !== 'undefined' ? window.location.hash : '');
          loadWorkspaceState(workspace, {
            beginAtPublisherRoot: false,
            navigationOverride:
              bootHashRoute2
                ? bootHashRoute2
                : workspaceEntryModeRef.current === 'refresh'
                  ? getActiveSessionNavigation(activeUserId, activeSessionId)
                  : getSessionResume(activeUserId),
          });
        }
        lastWorkspaceRef.current = workspace;
        writeWorkspaceCache(activeUserId, workspace);
        remoteReadyRef.current = true;
        hasLoadedRemoteWorkspaceRef.current = true;
        setDbStatus('connected');
        showToast(
          hadLoadedWorkspace
            ? 'SQL bağlantısı yeniden kuruldu. Yerel değişiklikler sunucuya yükleniyor.'
            : 'SQL bağlantısı yeniden kuruldu. Çalışma alanı sunucudan yenilendi.',
          'success'
        );
      } catch (error) {
        if (cancelled) return;
        remoteReadyRef.current = false;
        offlineDraftPendingRef.current = true;
        if (requiresFreshEditorSession(error)) {
          forceLogoutToLogin(error.message || 'Oturumunuz sona erdi. Lütfen yeniden giriş yapın.');
          return;
        }
        if (error?.code === 'USER_LOCKED') {
          forceLogoutToLogin('', {
            userId: activeUserId,
            password: loginForm.password,
            sessionId: activeSessionId,
            sessionLabel: authState?.sessionLabel || createSessionLabel(),
            session: error.session || null,
            message: error.message || 'Bu kullanıcı başka bir cihazda aktif.',
          });
          return;
        }
        retryTimer = window.setTimeout(reconnectWorkspace, 2000);
      }
    };

    retryTimer = window.setTimeout(reconnectWorkspace, 2000);
    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
    };
  }, [
    activeSessionId,
    activeUserId,
    authState?.sessionLabel,
    dbStatus,
    forceLogoutToLogin,
    loadWorkspaceState,
    loginForm.password,
    setDbStatus,
    showToast,
    syncWorkspaceMeta,
  ]);

  useEffect(() => {
    if (!activeUserId || !activeSessionId) return undefined;
    let cancelled = false;
    const heartbeat = async () => {
      try {
        const result = await apiRequest('/auth/heartbeat', {
          method: 'POST',
          timeoutMs: REMOTE_STATUS_REQUEST_TIMEOUT_MS,
          body: JSON.stringify({ userId: activeUserId, sessionId: activeSessionId }),
        });
        heartbeatFailCountRef.current = 0;
        if (result?.presence) {
          setPresence({
            users: Array.isArray(result.presence.users) ? result.presence.users : [],
            locks: Array.isArray(result.presence.locks) ? result.presence.locks : [],
          });
        }
        if (result?.kickRequested) setKickRequested(true);
      } catch (error) {
        if (cancelled) return;
        if (requiresFreshEditorSession(error)) {
          forceLogoutToLogin(error.message || 'Oturumunuz sona erdi. Lütfen yeniden giriş yapın.');
          return;
        }
        if (error?.code === 'USER_LOCKED') {
          forceLogoutToLogin('', {
            userId: activeUserId,
            password: loginForm.password,
            sessionId: activeSessionId,
            sessionLabel: authState?.sessionLabel || createSessionLabel(),
            session: error.session || null,
            message: error.message || 'Bu kullanıcı başka bir cihazda aktif.',
          });
          return;
        }
        // Tek bir geçici hatada "SQL kesildi"ye geçme; kısa ağ dalgalanmaları
        // bağlantıyı koparmış gibi göstermesin. Ancak 2 ardışık hatadan sonra
        // gerçek bir kesinti kabul edip yeniden bağlanma akışına geç.
        heartbeatFailCountRef.current += 1;
        if (heartbeatFailCountRef.current >= 2) {
          remoteReadyRef.current = false;
          offlineDraftPendingRef.current = true;
          setDbStatus('reconnecting');
        }
      }
    };

    // Uyarlanabilir aralik: sekme onplandayken 8 sn, arka planda 25 sn.
    // Boylece presence canli kalir ama bos/arka plan sekmeler paylasimli
    // hosting'i gereksiz yormaz. Self-scheduling timeout, yavas internette
    // heartbeat'lerin ust uste binmesini de onler.
    let timer = null;
    const ACTIVE_MS = 8000;
    const IDLE_MS = 25000;
    const scheduleNext = () => {
      const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
      timer = window.setTimeout(tick, hidden ? IDLE_MS : ACTIVE_MS);
    };
    const tick = async () => {
      await heartbeat();
      if (!cancelled) scheduleNext();
    };
    const onVisibility = () => {
      // Sekme tekrar gorununce hemen taze heartbeat (presence guncel kalsin).
      if (typeof document !== 'undefined' && document.visibilityState === 'visible' && !cancelled) {
        if (timer) window.clearTimeout(timer);
        tick();
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility);
    }
    scheduleNext();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility);
      }
    };
  }, [
    activeSessionId,
    activeUserId,
    authState?.sessionLabel,
    forceLogoutToLogin,
    loginForm.password,
    setDbStatus,
  ]);

  // Kick countdown: when another device requests this session
  useEffect(() => {
    if (!kickRequested || !activeUserId) return undefined;
    setKickCountdown(30);
    const timer = window.setInterval(() => setKickCountdown((prev) => Math.max(0, prev - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [kickRequested, activeUserId]);

  useEffect(() => {
    if (kickRequested && kickCountdown === 0 && activeUserId) {
      setKickRequested(false);
      forceLogoutToLogin('Baska bir cihaz bu hesaba giris yapti. Oturumunuz sonlandirildi.');
    }
  }, [kickRequested, kickCountdown, activeUserId, forceLogoutToLogin]);

  useEffect(() => {
    if (!activeUserId || !remoteReadyRef.current || dbStatus !== 'connected' || !currentProjectId)
      return;
    if (pendingResume) return;
    if (skipRemoteSaveRef.current) {
      skipRemoteSaveRef.current = false;
      return;
    }
    let saveTimer;
    const runSave = () => {
      // Bir kayıt zaten uçuştaysa yenisini başlatma (yavaş yüklemede istekler
      // üst üste binip bant genişliğini doldurmasın); bitince son hâli kaydet.
      if (remoteSavePendingRef.current) {
        saveTimer = setTimeout(runSave, 1200);
        return;
      }
      remoteSavePendingRef.current = true;
      apiRequest(`/projects/${currentProjectId}/draft`, {
        method: 'PUT',
        timeoutMs: REMOTE_SAVE_REQUEST_TIMEOUT_MS,
        body: JSON.stringify({
          state: createSafeStateForStorage(present),
          name: projectNameDraft,
          setCurrent: true,
          lockBookId: present.selBookId || '',
        }),
      })
        .then((r) => {
          remoteSavePendingRef.current = false;
          const hadOfflineDraft = offlineDraftPendingRef.current;
          offlineDraftPendingRef.current = false;
          saveFailCountRef.current = 0;
          if (r?.updatedAt) lastRemoteUpdatedAtRef.current = r.updatedAt;
          mergeWorkspaceProjectData({ currentProject: r?.project });
          setLastSaved(new Date());
          // Önbelleği "son kaydedilen hâl" ile güncelle → bir sonraki açılışta
          // kullanıcı en güncel işini anında görür (geçmiş hâl değil).
          if (lastWorkspaceRef.current) {
            lastWorkspaceRef.current = {
              ...lastWorkspaceRef.current,
              state: createSafeStateForStorage(present),
              updatedAt: r?.updatedAt || lastWorkspaceRef.current.updatedAt,
              currentProject: r?.project || lastWorkspaceRef.current.currentProject,
            };
            writeWorkspaceCache(activeUserId, lastWorkspaceRef.current);
          }
          if (hadOfflineDraft) {
            showToast('Yerel değişiklikler SQL sunucusuna yüklendi.', 'success');
          }
        })
        .catch((error) => {
          remoteSavePendingRef.current = false;
          if (requiresFreshEditorSession(error)) {
            forceLogoutToLogin(error.message || 'Oturumunuz sona erdi. Lütfen yeniden giriş yapın.');
            return;
          }
          if (error?.code === 'BOOK_LOCKED' || error?.code === 'BOOK_LOCK_REQUIRED') {
            const message = formatBookLockMessage(
              error.lock,
              error.message || 'Bu kitap başka bir kullanıcı tarafından kilitlendi.'
            );
            setBookLockWarning(message);
            showToast(message, 'warning');
            if (currentProjectId && present.selBookId) {
              releaseBookLock(currentProjectId, present.selBookId);
            }
            const fallbackRoute = { pubId: presentRef.current.selPubId || null, bookId: null, actId: null };
            setNavigationRouteState(fallbackRoute);
            writeBrowserRoute(fallbackRoute, 'replace');
            return;
          }
          if (error?.code === 'USER_LOCKED') {
            forceLogoutToLogin('', {
              userId: activeUserId,
              password: loginForm.password,
              sessionId: activeSessionId,
              sessionLabel: authState?.sessionLabel || createSessionLabel(),
              session: error.session || null,
              message: error.message || 'Bu kullanıcı başka bir cihazda aktif.',
            });
            return;
          }
          // Transient error (network hiccup, FTP deployment in progress, etc.)
          // Retry automatically — only go fully offline after 5 consecutive failures.
          saveFailCountRef.current += 1;
          offlineDraftPendingRef.current = true;
          if (saveFailCountRef.current >= 5) {
            remoteReadyRef.current = false;
            setDbStatus('reconnecting');
            showToast(
              'SQL bağlantısı kesildi. Değişiklikler bu cihazda tutuluyor; bağlantı gelince yüklenecek.',
              'warning'
            );
          }
          // Geçici hatada toast spam'i yok; durum göstergesi zaten "yerel taslak"
          // gösteriyor ve kayıt arka planda yeniden denenecek.
        });
    };
    saveTimer = setTimeout(runSave, 350);
    return () => clearTimeout(saveTimer);
  }, [
    activeSessionId,
    activeUserId,
    authState?.sessionLabel,
    currentProjectId,
    dbStatus,
    forceLogoutToLogin,
    loginForm.password,
    mergeWorkspaceProjectData,
    pendingResume,
    present,
    projectNameDraft,
    releaseBookLock,
    setDbStatus,
    setNavigationRouteState,
    showToast,
    writeBrowserRoute,
  ]);

  const selActivity = useMemo(() => {
    const rawActivity = present.activities.find((a) => a.id === present.selActId) || null;
    return rawActivity ? normalizeActivity(rawActivity) : null;
  }, [present.activities, present.selActId]);

  useEffect(() => {
    setShowDesignTools(false);
  }, [selActivity?.id]);

  const isMixedAct = selActivity?.type === 'mixed';
  const hasObjectSelection = !!selActivity?.selectedObjectId || selectedIds.size > 0;
  const ribbonSelectedObjects = useMemo(() => {
    if (!selActivity) return [];
    const targetIds = selectedIds.size
      ? selectedIds
      : selActivity.selectedObjectId
        ? new Set([selActivity.selectedObjectId])
        : new Set();
    return (selActivity.objects || []).filter((item) => targetIds.has(item.id));
  }, [selActivity, selectedIds]);
  const ribbonPrimaryObject = ribbonSelectedObjects[0] || null;

  useEffect(() => {
    if (hasObjectSelection) {
      setStoryRibbonTab((current) =>
        ['object-design', 'object-format'].includes(current) ? current : 'object-format'
      );
      return;
    }
    setStoryRibbonTab((current) =>
      ['object-design', 'object-format'].includes(current) ? 'home' : current
    );
  }, [hasObjectSelection, setStoryRibbonTab]);

  useEffect(() => {
    if (['karma', 'soru', 'metinler', 'ayarlar'].includes(activeTab)) return;
    if (
      ['home', 'insert', 'animation', 'object-format'].includes(storyRibbonTab) &&
      activeTab !== 'nesneler'
    ) {
      setActiveTab('nesneler');
    }
    if (
      ['scene', 'design', 'transitions', 'view'].includes(storyRibbonTab) &&
      activeTab !== 'sahne'
    ) {
      setActiveTab('sahne');
    }
  }, [activeTab, setActiveTab, storyRibbonTab]);

  useEffect(() => {
    setTimelineCurrentTime(0);
    setTimelinePlaying(false);
  }, [selActivity?.id, setTimelineCurrentTime, setTimelinePlaying]);

  useEffect(() => {
    if (!selActivity || !timelinePlaying) return undefined;
    const duration = getTimelineDuration(selActivity);
    const timer = window.setInterval(() => {
      setTimelineCurrentTime((prev) => {
        const next = Number((prev + 0.1).toFixed(1));
        if (next >= duration) {
          setTimelinePlaying(false);
          return duration;
        }
        return next;
      });
    }, 100);
    return () => window.clearInterval(timer);
  }, [selActivity, setTimelineCurrentTime, setTimelinePlaying, timelinePlaying]);

  const handleSelectPub = useCallback(
    async (id) => {
      return navigateToEditorRoute({ pubId: id || null, bookId: null, actId: null }, { mode: 'push' });
    },
    [navigateToEditorRoute]
  );

  const handleSelectBook = useCallback(
    async (id) => {
      return navigateToEditorRoute(
        { pubId: presentRef.current.selPubId || null, bookId: id || null, actId: null },
        { mode: 'push' }
      );
    },
    [navigateToEditorRoute]
  );

  // ─── Session Resume Tracker & Flow ──────────────────────────────────────────

  useEffect(() => {
    setHasCheckedResume(false);
    setPendingResume(null);
  }, [activeUserId]);

  useLayoutEffect(() => {
    if (activeUserId && dbStatus === 'connected' && !hasCheckedResume) {
      const entryMode = workspaceEntryModeRef.current;
      const resume = getSessionResume(activeUserId);
      const validation = validateSessionResumeTarget(resume, present);
      if (validation.hasTarget) {
        if (entryMode === 'login' || entryMode === 'refresh') {
          setPendingResume(resume);
        }
      }
      workspaceEntryModeRef.current = 'active';
      setHasCheckedResume(true);
    }
  }, [
    activeUserId,
    dbStatus,
    hasCheckedResume,
    present,
    showToast,
  ]);

  useEffect(() => {
    if (activeUserId && dbStatus === 'connected' && hasCheckedResume && !pendingResume) {
      const activeBook = present.books.find((b) => b.id === present.selBookId);
      const activeAct = present.activities.find((a) => a.id === present.selActId);

      if (!activeAct) return;

      saveSessionResume(activeUserId, {
        pubId: present.selPubId,
        bookId: present.selBookId,
        actId: activeAct.id,
        projectId: currentProjectId,
        projectName: currentProject?.name || null,
        bookName: activeBook?.name || null,
        activityName: activeAct?.name || null
      });
    }
  }, [
    activeUserId,
    dbStatus,
    hasCheckedResume,
    pendingResume,
    present.selPubId,
    present.selBookId,
    present.selActId,
    currentProjectId,
    currentProject?.name,
    present.publishers,
    present.books,
    present.activities
  ]);

  useEffect(() => {
    if (!activeUserId || !activeSessionId || dbStatus !== 'connected' || !hasCheckedResume || pendingResume) {
      return;
    }
    saveActiveSessionNavigation(activeUserId, activeSessionId, {
      pubId: present.selPubId,
      bookId: present.selBookId,
      actId: present.selActId,
    });
  }, [
    activeSessionId,
    activeUserId,
    dbStatus,
    hasCheckedResume,
    pendingResume,
    present.selActId,
    present.selBookId,
    present.selPubId,
  ]);

  // ─── Browser Back/Forward Handler ────────────────────────────────────────
  useEffect(() => {
    if (!activeUserId) return;
    if (typeof window === 'undefined') return;

    const handleBrowserNavigation = async (event) => {
      const navState = getEditorHistoryState(event.state);
      if (navState?.cursor) browserHistoryCursorRef.current = navState.cursor;

      if (dismissTopBackSurface()) return;

      if (hasBlockingBackSurface()) {
        writeBrowserRoute(currentRouteRef.current, 'replace');
        return;
      }

      if (navState?.kind === 'overlay-guard') {
        writeBrowserRoute(currentRouteRef.current, 'replace');
        return;
      }

      const route = parseEditorHashRoute(window.location.hash);
      try {
        if (route.textStudio) {
          setIsTextStudioMode(true);
          return;
        }

        await navigateToEditorRoute(route, { source: 'pop', mode: 'replace' });
      } catch {
        writeBrowserRoute(currentRouteRef.current, 'replace');
      }
    };

    window.addEventListener('popstate', handleBrowserNavigation);
    return () => window.removeEventListener('popstate', handleBrowserNavigation);
  }, [
    activeUserId,
    dismissTopBackSurface,
    hasBlockingBackSurface,
    navigateToEditorRoute,
    writeBrowserRoute,
  ]);

  const handleConfirmResume = useCallback(async () => {
    if (!pendingResume) return;
    showToast('Kaldığınız yerden devam ediyorsunuz.', 'success');
    writeBrowserRoute(currentRouteRef.current, 'replace');
    skipRemoteSaveRef.current = false;
    setPendingResume(null);
  }, [pendingResume, showToast, writeBrowserRoute]);

  const handleCancelResume = useCallback(() => {
    clearSessionResume(activeUserId);
    setNavigationRouteState(routeFromSelection(resetNavigationForResumePrompt(presentRef.current)));
    writeBrowserRoute(routeFromSelection(resetNavigationForResumePrompt(presentRef.current)), 'replace');
    setSelectedIds(new Set());
    setActiveTab('sahne');
    skipRemoteSaveRef.current = false;
    setPendingResume(null);
  }, [activeUserId, setActiveTab, setNavigationRouteState, writeBrowserRoute]);

  const startLayoutResize = useCallback(
    (type, e) => {
      e.preventDefault();
      resizeSessionRef.current = {
        type,
        startX: e.clientX,
        startY: e.clientY,
        startValue:
          type === 'timeline'
            ? timelineHeight
            : type === 'right-panel'
              ? rightPanelWidth
              : leftPanelWidth,
      };
      document.body.style.userSelect = 'none';
      document.body.style.cursor = type === 'timeline' ? 'row-resize' : 'col-resize';
    },
    [leftPanelWidth, rightPanelWidth, timelineHeight]
  );

  const resetLayout = useCallback(() => {
    setPanelScale(1);
    setZoom('fit');
    setTimelineHeight(220);
    setTimelineCurrentTime(0);
    setTimelinePlaying(false);
    setIsSlidePanelCollapsed(false);
    setLeftPanelWidth(PANEL_LIMITS.left.default);
    setRightPanelWidth(PANEL_LIMITS.right.default);
  }, [
    setIsSlidePanelCollapsed,
    setLeftPanelWidth,
    setPanelScale,
    setRightPanelWidth,
    setTimelineCurrentTime,
    setTimelineHeight,
    setTimelinePlaying,
    setZoom,
  ]);

  const updateActivity = useCallback(
    (updated) => {
      const normalized = enforceTtkbActivityCompliance(
        syncAnswerPlacementObjects(normalizeActivity(commitMaterializedActivity(updated)))
      );
      setTimelineCurrentTime((current) => Math.min(current, getTimelineDuration(normalized)));
      commit((p) => ({
        ...p,
        activities: p.activities.map((a) => (a.id === normalized.id ? normalized : a)),
      }));
    },
    [commit, setTimelineCurrentTime]
  );

  const handleGenerateDesignTemplate = useCallback(
    (templateId) => {
      if (!selActivity) return;
      updateActivity(
        ensureSceneTemplateSlide(selActivity, templateId, { forceRebuildGenerated: true })
      );
      setShowDesignTools(false);
      showToast('Hazır tasarım sahnesi etkinliğe uygulandı.', 'success');
    },
    [selActivity, showToast, updateActivity]
  );

  const handleGenerateAnswerSceneSet = useCallback(() => {
    if (!selActivity) return;
    updateActivity(ensureAnswerSceneLayerSet(selActivity));
    setShowDesignTools(false);
    showToast('Cevap sahne seti etkinliğe uygulandı.', 'success');
  }, [selActivity, showToast, updateActivity]);

  const patchCanvasViewOption = useCallback(
    (key) => {
      if (!selActivity) return;
      const viewOptions = selActivity.viewOptions || {};
      const nextOptions = { ...viewOptions, [key]: !viewOptions[key] };
      updateActivity({ ...selActivity, viewOptions: nextOptions });
    },
    [selActivity, updateActivity]
  );

  const buildLiveRuntimeStateSnapshot = useCallback(() => {
    const liveActivity = canvasRef.current?.getActivitySnapshot?.() || selActivity || null;
    return createRuntimeStateSnapshot(present, liveActivity);
  }, [present, selActivity]);

  const handleOpenStorylinePreview = useCallback(() => {
    setStorylinePreviewSnapshot(buildLiveRuntimeStateSnapshot());
    setStorylinePreviewOpen(true);
  }, [buildLiveRuntimeStateSnapshot]);

  const handleCloseStorylinePreview = useCallback(() => {
    setStorylinePreviewOpen(false);
    setStorylinePreviewSnapshot(null);
  }, []);

  const applyRibbonObjectPatch = useCallback(
    (objectPatch = {}, stylePatch = null) => {
      if (!selActivity) return;
      const targetIds = selectedIds.size
        ? selectedIds
        : selActivity.selectedObjectId
          ? new Set([selActivity.selectedObjectId])
          : new Set();
      if (!targetIds.size) return;

      const nextObjects = (selActivity.objects || []).map((item) => {
        if (!targetIds.has(item.id)) return item;
        const nextItem = { ...item, ...objectPatch };
        if (stylePatch) {
          nextItem.style =
            item.type === 'draggable' || item.type === 'dropzone'
              ? upgradeDragDropStyle(item.type, { ...(item.style || {}), ...stylePatch })
              : { ...(item.style || {}), ...stylePatch };
        }
        return nextItem;
      });

      updateActivity({ ...selActivity, objects: nextObjects });
    },
    [selActivity, selectedIds, updateActivity]
  );

  const openTextStudioWindow = useCallback((inline = false) => {
    if (typeof window === 'undefined') return;
    if (inline) {
      setIsTextStudioMode(true);
      writeBrowserRoute({ ...currentRouteRef.current, textStudio: true }, 'push');
      return;
    }
    const studioUrl = `${window.location.pathname}${window.location.search}#text-studio`;
    const studioWindow = window.open(studioUrl, 'eicerik-text-studio');
    if (studioWindow) {
      studioWindow.focus();
      return;
    }
    setIsTextStudioMode(true);
    writeBrowserRoute({ ...currentRouteRef.current, textStudio: true }, 'push');
  }, [writeBrowserRoute]);

  const handleEditorTabSelect = useCallback(
    (tabId) => {
      if (tabId === 'metinler') {
        openTextStudioWindow(true);
        return;
      }
      setActiveTab(tabId);
    },
    [openTextStudioWindow, setActiveTab]
  );

  const handleSaveTextStudioPreset = useCallback(
    (name, sourceActivity) => {
      const cleanName = String(name || '').trim();
      if (!cleanName || !sourceActivity) return '';
      let resolvedId = '';
      commit((p) => {
        const existing = (p.textStudioPresets || []).find(
          (item) => item.name.toLowerCase() === cleanName.toLowerCase()
        );
        resolvedId = existing?.id || uid();
        const preset = normalizeTextStudioPreset({
          id: resolvedId,
          name: cleanName,
          createdAt: existing?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          payload: pickTextStudioDesign(sourceActivity),
        });
        const others = (p.textStudioPresets || []).filter((item) => item.id !== resolvedId);
        return { ...p, textStudioPresets: [preset, ...others].slice(0, 30) };
      });
      return resolvedId;
    },
    [commit]
  );

  const handleApplyTextStudioPreset = useCallback(
    (presetId, activityId) => {
      if (!presetId || !activityId) return;
      commit((p) => {
        const preset = (p.textStudioPresets || []).find((item) => item.id === presetId);
        if (!preset) return p;
        return {
          ...p,
          activities: p.activities.map((item) =>
            item.id === activityId ? applyTextStudioPreset(item, preset.payload) : item
          ),
        };
      });
    },
    [commit]
  );

  const handleDeleteTextStudioPreset = useCallback(
    (presetId) => {
      if (!presetId) return;
      commit((p) => ({
        ...p,
        textStudioPresets: (p.textStudioPresets || []).filter((item) => item.id !== presetId),
      }));
    },
    [commit]
  );

  const handleSaveBookLayerPreset = useCallback(
    (name, sourceActivity) => {
      const cleanName = String(name || '').trim();
      const bookId = sourceActivity?.bookId || present.selBookId;
      if (!cleanName || !sourceActivity || !bookId) return '';
      let resolvedId = '';
      commit((p) => {
        const targetBook = p.books.find((book) => book.id === bookId);
        if (!targetBook) return p;
        const existing = (targetBook.layerPresets || []).find(
          (item) => item.name.toLowerCase() === cleanName.toLowerCase()
        );
        resolvedId = existing?.id || uid();
        const preset = normalizeLayerPreset({
          id: resolvedId,
          name: cleanName,
          createdAt: existing?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          payload: pickBookLayerPresetPayload(sourceActivity),
        });
        return {
          ...p,
          books: p.books.map((book) => {
            if (book.id !== bookId) return book;
            const others = (book.layerPresets || []).filter((item) => item.id !== resolvedId);
            return normalizeBook({ ...book, layerPresets: [preset, ...others].slice(0, 40) });
          }),
        };
      });
      return resolvedId;
    },
    [commit, present.selBookId]
  );

  const handleApplyBookLayerPreset = useCallback(
    (presetId, activityId) => {
      if (!presetId || !activityId) return;
      let nextActivity = null;
      commit((p) => {
        const activity = p.activities.find((item) => item.id === activityId);
        if (!activity?.bookId) return p;
        const targetBook = p.books.find((book) => book.id === activity.bookId);
        const preset = (targetBook?.layerPresets || []).find((item) => item.id === presetId);
        if (!preset) return p;
        nextActivity = applyBookLayerPresetToActivity(activity, preset);
        return {
          ...p,
          activities: p.activities.map((item) => (item.id === activityId ? nextActivity : item)),
        };
      });
      if (nextActivity) {
        setTimelineCurrentTime((current) => Math.min(current, getTimelineDuration(nextActivity)));
        setSelectedIds(new Set());
      }
    },
    [commit, setTimelineCurrentTime]
  );

  const handleSetBookDefaultStylePreset = useCallback(
    (presetId) => {
      const nextPresetId = ANSWER_LAYER_STYLE_PRESETS.some((item) => item.id === presetId)
        ? presetId
        : DEFAULT_ANSWER_LAYER_STYLE_PRESET_ID;
      const bookId = selActivity?.bookId || present.selBookId;
      if (!bookId) return;
      commit((p) => ({
        ...p,
        books: p.books.map((book) =>
          book.id === bookId
            ? normalizeBook({ ...book, defaultAnswerLayerStylePresetId: nextPresetId })
            : book
        ),
      }));
      showToast(
        'Bu stil kitap varsayılanı yapıldı. Yeni etkinlikler bu stille açılacak.',
        'success'
      );
    },
    [commit, present.selBookId, selActivity?.bookId, showToast]
  );

  const handleSelectAdminUser = useCallback((user) => {
    setLockState(null);
    setLoginError('');
    setLoginForm((current) => ({
      ...current,
      userId: user?.id || current.userId,
      password: '',
    }));
  }, []);

  const handleLogin = useCallback(async () => {
    setLoginBusy(true);
    setLoginError('');
    const attemptedSession = {
      sessionId: createSessionId(),
      sessionLabel: createSessionLabel(),
    };
    try {
      const nextAuth = await claimLoginSession(loginForm, attemptedSession);
      finalizeLogin(nextAuth);
    } catch (error) {
      if (error?.code === 'USER_LOCKED') {
        setLockState((current) => ({
          userId: loginForm.userId,
          password: loginForm.password,
          sessionId: attemptedSession.sessionId,
          sessionLabel: attemptedSession.sessionLabel,
          session: error.session || null,
          message: error.message || 'Bu kullanıcı başka bir cihazda aktif.',
          kickPending: error.kickPending || false,
          kickSentAt: current?.kickSentAt || (error.kickPending ? Date.now() : null),
          waitSeconds: error.waitSeconds ?? 20,
        }));
        return;
      }
      setLoginError(error.message || 'Giris yapilamadi.');
    } finally {
      setLoginBusy(false);
    }
  }, [claimLoginSession, finalizeLogin, loginForm]);

  const handleForceKick = useCallback(async () => {
    if (!lockState) return;
    setLoginBusy(true);
    setLoginError('');
    try {
      const nextAuth = await claimLoginSession(
        { userId: lockState.userId, password: lockState.password, force: true },
        { sessionId: lockState.sessionId, sessionLabel: lockState.sessionLabel }
      );
      finalizeLogin(nextAuth);
      setLockState(null);
    } catch (error) {
      if (error?.code === 'USER_LOCKED') {
        setLockState((current) =>
          current
            ? {
                ...current,
                session: error.session || current.session,
                message: error.message || current.message,
                waitSeconds: error.waitSeconds ?? 0,
                kickPending: true,
              }
            : current
        );
        return;
      }
      setLoginError(error.message || 'Giris yapilamadi.');
      setLockState(null);
    } finally {
      setLoginBusy(false);
    }
  }, [claimLoginSession, finalizeLogin, lockState]);

  useEffect(() => {
    if (!lockState || activeUserId) return undefined;
    let cancelled = false;
    const tryAgain = async () => {
      try {
        const nextAuth = await claimLoginSession(
          { userId: lockState.userId, password: lockState.password },
          lockState
        );
        if (cancelled) return;
        finalizeLogin(nextAuth);
      } catch (error) {
        if (cancelled) return;
        if (error?.code === 'USER_LOCKED') {
          setLockState((current) =>
            current
              ? {
                  ...current,
                  session: error.session || current.session,
                  message: error.message || current.message,
                  waitSeconds: error.waitSeconds ?? 0,
                  kickPending: true,
                }
              : current
          );
          return;
        }
        setLockState(null);
        setLoginError(error.message || 'Giris yapilamadi.');
      }
    };
    const timer = window.setInterval(tryAgain, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeUserId, claimLoginSession, finalizeLogin, lockState]);

  const handleLogout = useCallback(async () => {
    try {
      if (activeUserId && activeSessionId) {
        await apiRequest('/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ userId: activeUserId, sessionId: activeSessionId }),
        });
      }
    } catch {
    } finally {
      clearStoredAuth();
      clearActiveSessionNavigation(activeUserId, activeSessionId);
      workspaceEntryModeRef.current = 'anonymous';
      setLoginForm((current) => ({
        ...current,
        userId: activeUserId || current.userId,
        password: '',
      }));
      setAuthState(null);
      setLockState(null);
      setLoginError('');
      resetWorkspaceSession('');
      setIsTextStudioMode(false);
      writeBrowserRoute({}, 'replace');
    }
  }, [activeSessionId, activeUserId, resetWorkspaceSession, writeBrowserRoute]);

  const handleCreateProject = useCallback(async () => {
    const previousProjectId = currentProjectId;
    const previousBookId = present.selBookId;
    try {
      const workspace = await apiRequest('/projects', {
        method: 'POST',
        body: JSON.stringify({ name: newProjectName.trim() || 'Yeni Proje', state: INITIAL_STATE }),
      });
      lastRemoteUpdatedAtRef.current = workspace?.updatedAt || null;
      loadWorkspaceState(workspace);
      if (previousProjectId && previousBookId) {
        await releaseBookLock(previousProjectId, previousBookId);
      }
      setNewProjectName('');
    } catch (error) {
      showToast(error.message || 'Proje olusturulamadi.');
    }
  }, [
    currentProjectId,
    loadWorkspaceState,
    newProjectName,
    present.selBookId,
    releaseBookLock,
    showToast,
  ]);

  const handleSwitchProject = useCallback(
    async (projectId) => {
      const previousProjectId = currentProjectId;
      const previousBookId = present.selBookId;
      try {
        const workspace = await apiRequest('/workspace/current-project', {
          method: 'PUT',
          body: JSON.stringify({ projectId }),
        });
        lastRemoteUpdatedAtRef.current = workspace?.updatedAt || null;
        loadWorkspaceState(workspace);
        if (previousProjectId && previousBookId) {
          await releaseBookLock(previousProjectId, previousBookId);
        }
      } catch (error) {
        showToast(error.message || 'Proje acilamadi.');
      }
    },
    [currentProjectId, loadWorkspaceState, present.selBookId, releaseBookLock, showToast]
  );

  const handleDeleteProject = useCallback(
    async (projectId) => {
      if (!window.confirm('Bu projeyi silmek istedigine emin misin?')) return;
      try {
        if (projectId === currentProjectId && present.selBookId) {
          await releaseBookLock(currentProjectId, present.selBookId);
        }
        const workspace = await apiRequest(`/projects/${projectId}`, { method: 'DELETE' });
        lastRemoteUpdatedAtRef.current = workspace?.updatedAt || null;
        loadWorkspaceState(workspace);
      } catch (error) {
        showToast(error.message || 'Proje silinemedi.');
      }
    },
    [currentProjectId, loadWorkspaceState, present.selBookId, releaseBookLock, showToast]
  );

  const handleCreateVersion = useCallback(
    async (publish = false) => {
      if (!currentProjectId) return;
      try {
        const response = await apiRequest(`/projects/${currentProjectId}/versions`, {
          method: 'POST',
          body: JSON.stringify({
            label: versionLabel.trim(),
            publish,
            state: createSafeStateForStorage(present),
          }),
        });
        mergeWorkspaceProjectData(response);
        setVersionLabel('');
      } catch (error) {
        showToast(error.message || 'Surum olusturulamadi.');
      }
    },
    [currentProjectId, mergeWorkspaceProjectData, present, showToast, versionLabel]
  );

  const handlePublishExistingVersion = useCallback(
    async (versionId) => {
      if (!currentProjectId) return;
      try {
        const response = await apiRequest(`/projects/${currentProjectId}/publish`, {
          method: 'POST',
          body: JSON.stringify({ versionId }),
        });
        mergeWorkspaceProjectData(response);
      } catch (error) {
        showToast(error.message || 'Surum yayinlanamadi.');
      }
    },
    [currentProjectId, mergeWorkspaceProjectData, showToast]
  );

  const handleRestoreVersion = useCallback(
    async (versionId) => {
      if (!currentProjectId) return;
      if (!window.confirm('Bu surume geri donmek istedigine emin misin?')) return;
      try {
        const workspace = await apiRequest(`/projects/${currentProjectId}/restore`, {
          method: 'POST',
          body: JSON.stringify({ versionId }),
        });
        lastRemoteUpdatedAtRef.current = workspace?.updatedAt || null;
        loadWorkspaceState(workspace);
      } catch (error) {
        showToast(error.message || 'Surum geri yuklenemedi.');
      }
    },
    [currentProjectId, loadWorkspaceState, showToast]
  );

  const handleSaveProjectName = useCallback(async () => {
    if (!currentProjectId) return;
    try {
      const r = await apiRequest(`/projects/${currentProjectId}/draft`, {
        method: 'PUT',
        body: JSON.stringify({ name: projectNameDraft, setCurrent: true }),
      });
      mergeWorkspaceProjectData({ currentProject: r?.project });
    } catch (error) {
      showToast(error.message || 'Ad kaydedilemedi.');
    }
  }, [currentProjectId, projectNameDraft, mergeWorkspaceProjectData, showToast]);

  const handleDeleteVersion = useCallback(
    async (versionId) => {
      if (!currentProjectId) return;
      if (!window.confirm('Bu surumu silmek istedigine emin misin?')) return;
      try {
        const r = await apiRequest(`/projects/${currentProjectId}/versions/${versionId}`, {
          method: 'DELETE',
        });
        mergeWorkspaceProjectData({ versions: r.versions, currentProject: r.currentProject });
      } catch (error) {
        showToast(error.message || 'Surum silinemedi.');
      }
    },
    [currentProjectId, mergeWorkspaceProjectData, showToast]
  );

  const handleDuplicateProject = useCallback(
    async (projectId, projectName) => {
      if (!window.confirm(`"${projectName}" projesini kopyalamak istiyor musun?`)) return;
      const previousProjectId = currentProjectId;
      const previousBookId = present.selBookId;
      try {
        const workspace = await apiRequest(`/projects/${projectId}/duplicate`, { method: 'POST' });
        lastRemoteUpdatedAtRef.current = workspace?.updatedAt || null;
        loadWorkspaceState(workspace);
        if (previousProjectId && previousBookId) {
          await releaseBookLock(previousProjectId, previousBookId);
        }
      } catch (error) {
        showToast(error.message || 'Proje kopyalanamadi.');
      }
    },
    [currentProjectId, loadWorkspaceState, present.selBookId, releaseBookLock, showToast]
  );

  const handleExport = useCallback(() => {
    const exportState = createSafeStateForExport(present);
    const ttkbAudit = auditTtkbEditorState(exportState);
    if (!ttkbAudit.ok) {
      showToast(
        `TTKB kontrolü ${ttkbAudit.issues.length} risk düzeltilmeden kaldı: ${ttkbAudit.issues[0]}`,
        'warning'
      );
    }
    if (stateHasLmsSecrets(present)) {
      showToast('Dışa aktarma dosyasında eski LMS gizli anahtarları maskelendi.', 'warning');
    }
    const blob = new Blob([JSON.stringify(exportState, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'e-icerik-proje.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [present, showToast]);

  const handleSecureLmsExport = useCallback(() => {
    const exportState = createLearnerSafeStateForExport(createSafeStateForExport(present));
    const blob = new Blob([JSON.stringify(exportState, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'e-icerik-lms-ogrenci.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Güvenli LMS çıktısında cevap anahtarları çıkarıldı.', 'success');
  }, [present, showToast]);

  const handleScorm12Export = useCallback(() => {
    const lmsConfig = normalizeScorm12LmsConfig(present.lmsConfig || {});
    try {
      const safeLmsConfig = normalizeScorm12LmsConfig(lmsConfig);
      const exportScope = safeLmsConfig.scormExportScope === 'book' ? 'book' : 'activity';
      const normalizedPreviewState = buildLiveRuntimeStateSnapshot();
      const ttkbAudit = auditTtkbEditorState(normalizedPreviewState);
      if (!ttkbAudit.ok) {
        showToast(`TTKB kontrolü geçmedi: ${ttkbAudit.issues[0]}`, 'error');
        return;
      }
      const startCheck = validateScorm12PreviewStart(normalizedPreviewState, {
        scope: exportScope,
        activityId: present.selActId,
        bookId: present.selBookId,
      });
      if (!startCheck.ok) {
        showToast(`SCORM başlangıç kontrolü geçmedi: ${startCheck.errors.join(' ')}`, 'error');
        return;
      }
      const externalUrls = summarizeExternalUrlsForScorm(normalizedPreviewState);
      if (externalUrls.length) {
        const sample = externalUrls
          .slice(0, 5)
          .map((item) => `- ${item.url}`)
          .join('\n');
        const extra =
          externalUrls.length > 5 ? `\n...ve ${externalUrls.length - 5} dış bağlantı daha.` : '';
        const ok = window.confirm(
          `Bu SCORM paketinde ${externalUrls.length} dış bağlantı/web embed tespit edildi.\n\n` +
            `${sample}${extra}\n\n` +
            'TTKB/KVKK/telif ve erişilebilirlik açısından bu bağlantıları kontrol ettiysen paketi oluşturmaya devam et.'
        );
        if (!ok) {
          showToast('SCORM dış bağlantı kontrolü için paket oluşturma iptal edildi.', 'warning');
          return;
        }
      }
      downloadScorm12Zip(normalizedPreviewState, safeLmsConfig, {
        scope: exportScope,
        activityId: present.selActId,
        bookId: present.selBookId,
      });
      showToast(
        exportScope === 'book'
          ? 'SCORM 1.2 başlangıç kontrolü geçti: her SCO start scene + base layer. Kitaptaki etkinlikler ayrı SCO olarak eklendi.'
          : 'SCORM 1.2 başlangıç kontrolü geçti: start scene + base layer. Tam ekran paket oluşturuldu.',
        'success'
      );
      if (externalUrls.length)
        showToast(
          `SCORM dış bağlantı uyarısı onaylandı: ${externalUrls.length} bağlantı.`,
          'warning'
        );
      if (startCheck.warnings.length) showToast(startCheck.warnings[0], 'warning');
    } catch (err) {
      console.error('SCORM export error:', err);
      showToast('SCORM paketi oluşturulurken hata: ' + (err.message || err), 'error');
    }
  }, [
    buildLiveRuntimeStateSnapshot,
    present.lmsConfig,
    present.selActId,
    present.selBookId,
    showToast,
  ]);

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const d = JSON.parse(ev.target.result);
        if (d.publishers !== undefined) {
          const next = normalizeState({ ...INITIAL_STATE, ...d });
          setHistory({ past: [], present: next, future: [] });
          writeBrowserRoute(routeFromSelection(next), 'replace');
        }
      } catch {
        showToast('Geçersiz JSON.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const isSelectionAct = selActivity?.type === 'selection' || selActivity?.type === 'mixed';

  const selBook = present.books.find((b) => b.id === present.selBookId);
  const selPub = present.publishers.find((p) => p.id === present.selPubId);
  const activeLayerPresets = selBook?.layerPresets || [];
  const activeBookDefaultStylePresetId =
    selBook?.defaultAnswerLayerStylePresetId || DEFAULT_ANSWER_LAYER_STYLE_PRESET_ID;
  const currentView = !selPub
    ? 'publishers'
    : !selBook
      ? 'books'
      : !selActivity
        ? 'activities'
        : 'editor';

  const rightInspectorPanelProps = {
    activity: selActivity,
    onUpdate: updateActivity,
    selectedIds,
    onSelectionChange: setSelectedIds,
    hideTimeline: false,
    activities: present.activities,
    variables: present.variables,
    onVariablesChange: (nextVariables) =>
      commit((p) => ({ ...p, variables: nextVariables.map(normalizeVariable) })),
    mobile: false,
    uiMode,
    activeTab,
    onOpenAnswerCenter: () => setAnswerDrawerOpen(true),
    onOpenTextStudioWindow: openTextStudioWindow,
    layerPresets: activeLayerPresets,
    onSaveLayerPreset: handleSaveBookLayerPreset,
    onApplyLayerPreset: handleApplyBookLayerPreset,
    showBaseLayer,
    onShowBaseLayerChange: setShowBaseLayer,
    bookDefaultStylePresetId: activeBookDefaultStylePresetId,
    onSetBookDefaultStylePreset: handleSetBookDefaultStylePreset,
  };



  // Editor tabs
  const TABS = [
    { id: 'nesneler', label: 'Nesneler', needsActivity: true },
    { id: 'sahne', label: 'Sahne', needsActivity: true },
    { id: 'soru', label: 'Soru', needsActivity: true, condition: () => isSelectionAct },
    { id: 'metinler', label: 'Metin Stüdyosu ↗', needsActivity: true },
    { id: 'ayarlar', label: 'Ayarlar', needsActivity: true },
  ].filter((t) => t.needsActivity && selActivity && (!t.condition || t.condition()));

  const visibleTabs = isMixedAct
    ? [
        TABS.find((t) => t.id === 'nesneler'),
        TABS.find((t) => t.id === 'sahne'),
        { id: 'karma', label: 'Karma' },
        TABS.find((t) => t.id === 'metinler'),
        TABS.find((t) => t.id === 'ayarlar'),
      ].filter(Boolean)
    : TABS;

  useEffect(() => {
    if (isTextStudioMode || activeTab !== 'metinler') return;
    setActiveTab(
      isMixedAct ? 'karma' : visibleTabs.find((tab) => tab.id !== 'metinler')?.id || 'nesneler'
    );
  }, [activeTab, isMixedAct, isTextStudioMode, setActiveTab, visibleTabs]);

  useEffect(() => {
    if (!selActivity) return;
    const hasActiveTab = visibleTabs.some((tab) => tab.id === activeTab);
    if (!hasActiveTab) {
      setActiveTab(isMixedAct ? 'karma' : visibleTabs[0]?.id || 'nesneler');
    }
  }, [activeTab, isMixedAct, selActivity, setActiveTab, visibleTabs]);

  const renderEditorTabButtons = useCallback(
    (buttonStyleFactory = null) =>
      visibleTabs.map((t) => {
        const style =
          typeof buttonStyleFactory === 'function'
            ? buttonStyleFactory(t)
            : {
                padding: '6px 12px',
                border: `1px solid ${activeTab === t.id ? EDITOR_THEME.shellAccentBorder : 'transparent'}`,
                borderRadius: 6,
                background: activeTab === t.id ? EDITOR_THEME.shellAccentSoftStrong : 'transparent',
                color: activeTab === t.id ? '#a5e6ff' : 'rgba(255,255,255,.5)',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all .14s ease',
              };
        return (
          <button key={t.id} onClick={() => handleEditorTabSelect(t.id)} style={style}>
            {t.label}
          </button>
        );
      }),
    [activeTab, handleEditorTabSelect, visibleTabs]
  );

  const handleManualSaveProject = useCallback(() => {
    if (isRemoteMutationLocked) {
      showToast('SQL bağlantısı yeniden kuruluyor. Kaydetme bağlantı sağlanınca açılacak.', 'warning');
      return;
    }
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(
          getUserStorageKey(activeUserId),
          JSON.stringify(createSafeStateForStorage(present))
        );
      }
      if (dbStatus === 'reconnecting') offlineDraftPendingRef.current = true;
      setLastSaved(new Date());
      showToast(
        dbStatus === 'reconnecting'
          ? 'Yerel taslak kaydedildi. SQL gelince sunucuya yüklenecek.'
          : 'Kaydedildi.',
        'success'
      );
    } catch {
      showToast('Kaydetme işlemi tamamlanamadı.', 'error');
    }
  }, [activeUserId, dbStatus, isRemoteMutationLocked, present, showToast]);

  const resetProjectFromRibbon = useCallback(() => {
    if (isRemoteMutationLocked) {
      showToast('SQL bağlantısı yeniden kuruluyor. Yeni proje işlemi geçici olarak kapalı.', 'warning');
      return;
    }
    if (typeof window !== 'undefined' && !window.confirm('Yeni proje oluşturulacak. Mevcut içerik sıfırlansın mı?')) {
      return;
    }
    setHistory({ past: [], present: INITIAL_STATE, future: [] });
    writeBrowserRoute(routeFromSelection(INITIAL_STATE), 'replace');
    setSelectedIds(new Set());
  }, [isRemoteMutationLocked, setHistory, showToast, writeBrowserRoute]);

  const ribbonController = useRibbonController({
    activeEditorTab: activeTab,
    activity: selActivity,
    applyRibbonObjectPatch,
    canvasRef,
    commit,
    handleEditorTabSelect,
    handleExport,
    handleOpenStorylinePreview,
    handleScorm12Export,
    handleSecureLmsExport,
    hasObjectSelection,
    history: { past: history.past, future: history.future, undo, redo },
    importRef,
    lmsConfig: present.lmsConfig,
    manualSaveProject: handleManualSaveProject,
    openTextStudioWindow,
    panelScale,
    present,
    primaryObject: ribbonPrimaryObject,
    resetLayout,
    resetProject: resetProjectFromRibbon,
    selectedIds,
    setActiveEditorTab: setActiveTab,
    setAnswerDrawerOpen,
    setCanvasExpanded,
    setPanelScale,
    setRibbonAnimationPreviewKey,
    setSelectedIds,
    setShowBranchDiagram,
    setShowGlossaryEditor,
    setShowVariablesManager,
    setStoryRibbonTab,
    setZoom,
    setTimelineDockOpen,
    setTimelineHeight,
    showBaseLayer,
    onShowBaseLayerChange: setShowBaseLayer,
    slideClipboardRef,
    showToast,
    storyRibbonTab,
    updateActivity,
    zoom,
  });

  const workspaceChromeController = useWorkspaceChromeController({
    activity: selActivity,
    currentBook: selBook,
    currentPublisher: selPub,
    onOpenAnswerCenter: () => setAnswerDrawerOpen(true),
    onSelectActivity: handleSelectAct,
    onSelectionChange: setSelectedIds,
    onUpdateActivity: updateActivity,
    present,
    ribbonController,
    selectedIds,
    showToast,
  });

  useEffect(() => {
    slideClipboardCommandsRef.current = {
      copySlide: ribbonController.commands.copySlide,
      pasteSlide: ribbonController.commands.pasteSlide,
    };
  }, [ribbonController.commands.copySlide, ribbonController.commands.pasteSlide]);

  const renderEditorRibbon = useCallback(
    (options = {}) => {
      if (currentView !== 'editor' || !selActivity) return null;
      // Mobil editörde MobileEditorShell kendi chrome'unu kullanır; masaüstü ribbon gizli.
      if (!options.fullscreen && deviceMode !== 'desktop') return null;
      return <TopRibbon controller={ribbonController} fullscreen={!!options.fullscreen} />;
    },
    [currentView, deviceMode, ribbonController, selActivity]
  );

  useBackDismissible({
    id: 'canvas-expanded',
    open: canvasExpanded && currentView === 'editor' && !!selActivity,
    onDismiss: () => setCanvasExpanded(false),
    priority: 900,
    registerBackDismissible,
  });
  useBackDismissible({
    id: 'storyline-preview',
    open: storylinePreviewOpen,
    onDismiss: handleCloseStorylinePreview,
    priority: 880,
    registerBackDismissible,
  });
  useBackDismissible({
    id: 'answer-drawer',
    open: answerDrawerOpen,
    onDismiss: () => setAnswerDrawerOpen(false),
    priority: 860,
    registerBackDismissible,
  });
  useBackDismissible({
    id: 'design-tools',
    open: showDesignTools && currentView === 'editor' && !!selActivity,
    onDismiss: () => setShowDesignTools(false),
    priority: 840,
    registerBackDismissible,
  });
  useBackDismissible({
    id: 'review-threads',
    open: showReviewThreads,
    onDismiss: () => setShowReviewThreads(false),
    priority: 830,
    registerBackDismissible,
  });
  useBackDismissible({
    id: 'admin-management',
    open: showAdminManagement,
    onDismiss: () => setShowAdminManagement(false),
    priority: 820,
    registerBackDismissible,
  });
  useBackDismissible({
    id: 'project-manager',
    open: showProjectManager,
    onDismiss: () => setShowProjectManager(false),
    priority: 810,
    registerBackDismissible,
  });
  useBackDismissible({
    id: 'variables-manager',
    open: showVariablesManager,
    onDismiss: () => setShowVariablesManager(false),
    priority: 800,
    registerBackDismissible,
  });
  useBackDismissible({
    id: 'branch-diagram',
    open: showBranchDiagram,
    onDismiss: () => setShowBranchDiagram(false),
    priority: 790,
    registerBackDismissible,
  });
  useBackDismissible({
    id: 'glossary-editor',
    open: showGlossaryEditor,
    onDismiss: () => setShowGlossaryEditor(false),
    priority: 780,
    registerBackDismissible,
  });

  if (keepBootVisibleForWorkspace) {
    return null;
  }

  if (isRemoteMutationLocked) {
    return (
      <div
        className="eic-app-root"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          background: 'linear-gradient(180deg, #091523 0%, #050b14 100%)',
          color: '#e2e8f0',
          fontFamily: "'Segoe UI',Tahoma,Geneva,Verdana,sans-serif",
        }}
      >
        <div
          style={{
            width: 'min(440px, 100%)',
            padding: 28,
            borderRadius: 18,
            border: '1px solid rgba(56,189,248,.25)',
            background: 'rgba(15,23,42,.92)',
            textAlign: 'center',
            boxShadow: '0 24px 64px rgba(0,0,0,.34)',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 800, color: '#7dd3fc' }}>
            BAĞLANTI KESİLDİ
          </div>
          <div style={{ marginTop: 12, fontSize: 22, fontWeight: 900 }}>
            Bağlantı yeniden kuruluyor
          </div>
          <p style={{ margin: '12px 0 0', fontSize: 13, lineHeight: 1.65, color: '#cbd5e1' }}>
            Sunucu bağlantısı kesildiği için düzenleme ve kayıt geçici olarak kapalıdır.
            Bağlantı sağlandığında çalışma alanı sunucudan yenilenerek devam edecek.
          </p>
          <div
            style={{
              margin: '18px auto 0',
              width: 34,
              height: 34,
              borderRadius: '50%',
              border: '3px solid rgba(125,211,252,.25)',
              borderTopColor: '#38bdf8',
            }}
            aria-label="Bağlantı bekleniyor"
          />
          <button
            type="button"
            onClick={() => forceLogoutToLogin('')}
            style={{
              marginTop: 22,
              height: 38,
              padding: '0 16px',
              borderRadius: 8,
              border: '1px solid rgba(148,163,184,.3)',
              background: 'rgba(255,255,255,.06)',
              color: '#e2e8f0',
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Oturumu Kapat
          </button>
        </div>
      </div>
    );
  }

  if (isTextStudioMode && activeUserId) {
    return (
      <TextStudioWorkspace
        activity={selActivity}
        activities={present.activities}
        variables={present.variables}
        designPresets={present.textStudioPresets}
        onSavePreset={handleSaveTextStudioPreset}
        onApplyPreset={handleApplyTextStudioPreset}
        onDeletePreset={handleDeleteTextStudioPreset}
        onUpdate={updateActivity}
        onClose={() => {
          setIsTextStudioMode(false);
          if (typeof window !== 'undefined') {
            if (window.opener && !window.opener.closed) {
              window.close();
              return;
            }
            writeBrowserRoute(currentRouteRef.current, 'replace');
          }
        }}
        onOpenNewTab={() => {
          if (typeof window === 'undefined') return;
          const studioUrl = `${window.location.pathname}${window.location.search}#text-studio`;
          window.open(studioUrl, '_blank', 'noopener,noreferrer');
        }}
      />
    );
  }

  if (!activeUserId) {
    return (
      <LoginScreen
        users={FIXED_EDITOR_USERS}
        loginForm={loginForm}
        loginBusy={loginBusy}
        loginError={loginError}
        lockState={lockState}
        logoutReason={logoutReason}
        onDismissLogoutReason={() => setLogoutReason(null)}
        onSelectQuickUser={(userId) => {
          setLockState(null);
          setLoginError('');
          setLoginForm((current) => ({ ...current, userId }));
        }}
        onUserIdChange={(userId) => setLoginForm((current) => ({ ...current, userId }))}
        onPasswordChange={(password) => setLoginForm((current) => ({ ...current, password }))}
        onLogin={handleLogin}
        onForceKick={handleForceKick}
        onChooseDifferentUser={() => {
          setLockState(null);
          setLoginError('');
          setLoginForm((current) => ({
            ...current,
            userId: lockState?.userId || current.userId,
            password: lockState?.password || current.password,
          }));
        }}
      />
    );
  }


  return (
    <div
      className="eic-app-root"
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: EDITOR_THEME.shellBg,
        color: EDITOR_THEME.shellText,
        fontFamily: "'Segoe UI',Tahoma,Geneva,Verdana,sans-serif",
        overflow: 'hidden',
        fontSize: 13,
      }}
    >
      {/* ─── KICK NOTIFICATION OVERLAY ───────────────────────────── */}
      {kickRequested && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,.75)',
            backdropFilter: 'blur(6px)',
          }}
        >
          <div
            style={{
              width: 'min(440px, 90vw)',
              background: '#131e33',
              border: '1px solid rgba(251,191,36,.35)',
              borderRadius: 22,
              padding: 28,
              boxShadow: '0 24px 64px rgba(0,0,0,.7)',
              color: '#e6eefc',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: 'rgba(251,191,36,.18)',
                  border: '1px solid rgba(251,191,36,.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#fbbf24"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div>
                <div style={{ fontWeight: 900, fontSize: 15 }}>Çıkış İsteği Geldi</div>
                <div style={{ fontSize: 11, color: '#91a6c6', marginTop: 2 }}>
                  Başka bir cihaz bu hesaba giriş yapmak istiyor
                </div>
              </div>
            </div>
            <div
              style={{
                background: 'rgba(251,191,36,.08)',
                border: '1px solid rgba(251,191,36,.2)',
                borderRadius: 12,
                padding: '12px 14px',
                fontSize: 13,
                color: '#fef3c7',
                lineHeight: 1.6,
                marginBottom: 20,
              }}
            >
              Çalışmanız otomatik kaydedildi.{' '}
              <strong style={{ color: '#fbbf24' }}>{kickCountdown}</strong> saniye sonra oturumunuz
              otomatik olarak kapatılacak.
            </div>
            <button
              onClick={() => {
                setKickRequested(false);
                forceLogoutToLogin('');
              }}
              style={{
                width: '100%',
                height: 44,
                borderRadius: 12,
                border: 'none',
                background: 'linear-gradient(135deg, #f59e0b, #fbbf24)',
                color: '#1c1007',
                fontSize: 13,
                fontWeight: 900,
                cursor: 'pointer',
              }}
            >
              Şimdi Kaydet ve Çıkış Yap
            </button>
          </div>
        </div>
      )}

      {/* ─── TOAST NOTIFICATIONS ──────────────────────────────── */}
      {toasts.length > 0 && (
        <div
          style={{
            position: 'fixed',
            top: 16,
            right: 16,
            zIndex: 9500,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            pointerEvents: 'none',
            maxWidth: 400,
          }}
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              style={{
                pointerEvents: 'auto',
                background:
                  t.type === 'success' ? '#052e16' : t.type === 'warning' ? '#422006' : '#2c0b0e',
                border: `1px solid ${t.type === 'success' ? '#16a34a' : t.type === 'warning' ? '#d97706' : '#dc2626'}`,
                color:
                  t.type === 'success' ? '#86efac' : t.type === 'warning' ? '#fde68a' : '#fca5a5',
                borderRadius: 10,
                padding: '10px 16px',
                fontSize: 13,
                fontWeight: 600,
                boxShadow: '0 8px 24px rgba(0,0,0,.5)',
                animation: 'fadeInSlide .25s ease',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                lineHeight: 1.4,
              }}
            >
              <span style={{ flexShrink: 0, fontSize: 16 }}>
                {t.type === 'success' ? '✓' : t.type === 'warning' ? '⚠' : '✕'}
              </span>
              <span style={{ flex: 1, wordBreak: 'break-word' }}>{t.message}</span>
              <button
                onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'inherit',
                  cursor: 'pointer',
                  fontSize: 16,
                  padding: 0,
                  lineHeight: 1,
                  opacity: 0.6,
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {!(currentView === 'editor' && deviceMode !== 'desktop') && (
      <EditorTopBar
        activeUser={activeUser}
        currentProject={currentProject}
        currentView={currentView}
        dbStatus={dbStatus}
        handleExport={handleExport}
        handleImport={handleImport}
        handleLogout={handleLogout}
        handleOpenStorylinePreview={handleOpenStorylinePreview}
        history={history}
        importRef={importRef}
        lastSaved={lastSaved}
        redo={redo}
        selActivity={selActivity}
        selBook={selBook}
        selPub={selPub}
        onBackToPublishers={() => navigateToEditorRoute({}, { mode: 'push' })}
        onBackToBooks={() =>
          navigateToEditorRoute({ pubId: presentRef.current.selPubId || null }, { mode: 'push' })
        }
        onBackToActivities={() =>
          navigateToEditorRoute(
            {
              pubId: presentRef.current.selPubId || null,
              bookId: presentRef.current.selBookId || null,
            },
            { mode: 'push' }
          )
        }
        setAnswerDrawerOpen={setAnswerDrawerOpen}
        onToggleFullscreen={toggleNativeFullscreen}
        onlineUsers={onlineUsers}
        currentBookEditor={currentBookEditor}
        setDesignToolsOpen={setShowDesignTools}
        setShowAdminManagement={setShowAdminManagement}
        setShowProjectManager={setShowProjectManager}
        setShowReviewThreads={setShowReviewThreads}
        setStoryRibbonTab={setStoryRibbonTab}
        undo={undo}
      />
      )}

      {bookLockWarning && (
        <div
          style={{
            flexShrink: 0,
            padding: '10px 14px',
            background: 'rgba(245,158,11,.14)',
            borderBottom: '1px solid rgba(245,158,11,.28)',
            color: '#fde68a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700 }}>{bookLockWarning}</div>
          <button
            onClick={() => setBookLockWarning('')}
            style={{
              border: 'none',
              background: 'rgba(255,255,255,.08)',
              color: '#fff7ed',
              borderRadius: 999,
              padding: '4px 10px',
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            Kapat
          </button>
        </div>
      )}

      {renderEditorRibbon()}

      <VariablesManagerModal
        open={showVariablesManager}
        onClose={() => setShowVariablesManager(false)}
        variables={present.variables}
        onChange={(nextVariables) =>
          commit((p) => ({ ...p, variables: nextVariables.map(normalizeVariable) }))
        }
        activities={present.activities}
        activity={selActivity}
        projectName={currentProject?.name || ''}
        bookName={selBook?.name || ''}
        normalizeVariable={normalizeVariable}
        createVariableItem={createVariableItem}
        castVariableValue={castVariableValue}
        getVariableTypeLabel={getVariableTypeLabel}
        formatVariableValue={formatVariableValue}
        getDefaultVariableValue={getDefaultVariableValue}
        buildVariableUsageCountMap={buildVariableUsageCountMap}
        buildBuiltInVariableRows={buildBuiltInVariableRows}
      />

      <BranchingDiagramModal
        open={showBranchDiagram}
        onClose={() => setShowBranchDiagram(false)}
        activities={present.activities}
        variables={present.variables}
        currentActivityId={present.selActId}
      />

      <GlossaryEditorModal
        open={showGlossaryEditor}
        onClose={() => setShowGlossaryEditor(false)}
        glossaryTerms={present.glossaryTerms || []}
        onChange={(nextTerms) => commit((p) => ({ ...p, glossaryTerms: nextTerms }))}
      />

      {currentView !== 'editor' && (
        <LibraryWorkspace
          publishers={present.publishers}
          books={present.books}
          activities={present.activities}
          selectedPublisherId={present.selPubId}
          selectedBookId={present.selBookId}
          mobileColumn={deriveLibraryMobileColumn(currentRoute)}
          onNavigateBack={() => navigateToEditorRoute(getParentEditorRoute(currentRouteRef.current), { mode: 'push' })}
          onSelectPublisher={handleSelectPub}
          onSelectBook={handleSelectBook}
          onOpenActivity={handleSelectAct}
          registerBackDismissible={registerBackDismissible}
          onPublishersChange={(publishers) => commit((p) => ({ ...p, publishers }))}
          onBooksChange={(books) => commit((p) => ({ ...p, books: books.map(normalizeBook) }))}
          onActivitiesChange={(activities) => commit((p) => ({ ...p, activities }))}
          normalizeBook={normalizeBook}
          createActivity={createActivity}
          notify={showToast}
        />
      )}

      {currentView === 'editor' && deviceMode === 'desktop' && (
        <EditorWorkspaceShell editorScrollRef={editorScrollRef}>
          <div
            style={{
              width: `${100 / effectivePanelScale}%`,
              height: `${100 / effectivePanelScale}%`,
              minHeight: `${100 / effectivePanelScale}%`,
              transform: `scale(${effectivePanelScale})`,
              transformOrigin: 'top left',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'row',
                overflow: 'hidden',
                background: 'transparent',
                padding: 8,
                gap: 8,
              }}
            >
              {selActivity && !isSlidePanelCollapsed && (
                <div
                  style={{
                    width: Math.max(PANEL_LIMITS.left.min, leftPanelWidth),
                    flexShrink: 0,
                    border: `1px solid ${EDITOR_THEME.shellBorder}`,
                    borderRadius: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: 0,
                    overflow: 'hidden',
                    background: EDITOR_THEME.lightBg,
                    boxShadow: 'none',
                  }}
                >
                  <ActivityMapPanel
                    activity={selActivity}
                    onCopySlide={ribbonController.commands.copySlide}
                    onPasteSlide={ribbonController.commands.pasteSlide}
                    activities={present.activities}
                    currentBook={selBook}
                    onSelectActivity={handleSelectAct}
                    onSelectionChange={setSelectedIds}
                    onUpdateActivity={updateActivity}
                    selectedIds={selectedIds}
                  />
                </div>
              )}
              {selActivity && (
                <div
                  style={{
                    width: isSlidePanelCollapsed ? 34 : 10,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'transparent',
                  }}
                >
                  {isSlidePanelCollapsed ? (
                    <button
                      onClick={() => setIsSlidePanelCollapsed(false)}
                      style={{
                        width: 34,
                        height: '100%',
                        minHeight: 180,
                        borderRadius: 12,
                        border: '1px solid #cfd8e3',
                        background: 'linear-gradient(180deg,#ffffff,#f3f6f9)',
                        color: '#52667a',
                        cursor: 'pointer',
                        boxShadow: '0 8px 18px rgba(15,23,42,.06)',
                        fontSize: 11,
                        fontWeight: 700,
                        writingMode: 'vertical-rl',
                        textOrientation: 'mixed',
                        letterSpacing: 0.5,
                      }}
                    >
                      Sahneler →
                    </button>
                  ) : (
                    <div
                      onPointerDown={(e) => startLayoutResize('left-panel', e)}
                      onDoubleClick={() => setLeftPanelWidth(PANEL_LIMITS.left.default)}
                      style={{
                        width: 10,
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'col-resize',
                        background: 'transparent',
                        position: 'relative',
                      }}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsSlidePanelCollapsed(true);
                        }}
                        style={{
                          position: 'absolute',
                          top: 14,
                          left: -4,
                          width: 16,
                          height: 48,
                          borderRadius: 999,
                          border: '1px solid #cfd8e3',
                          background: 'linear-gradient(180deg,#ffffff,#f3f6f9)',
                          color: '#7b8794',
                          cursor: 'pointer',
                        }}
                      >
                        ‹
                      </button>
                      <div
                        style={{
                          width: 3,
                          alignSelf: 'stretch',
                          margin: '8px 0',
                          borderRadius: 999,
                          background: 'rgba(148,163,184,.32)',
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  minHeight: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  ...createShellPanelStyle({ grow: true }),
                  borderRadius: 0,
                  overflow: 'hidden',
                  boxShadow: 'none',
                }}
              >
                {/* Sahne header kaldırıldı */}

                <CanvasWorkspaceCenter
                  activity={selActivity}
                  canvasTool={canvasTool}
                  currentZoomPercent={currentZoomPercent}
                  onCanvasToolChange={setCanvasTool}
                  onFullscreen={toggleNativeFullscreen}
                  onToggleGrid={() => patchCanvasViewOption('showGrid')}
                  onToggleGuides={() => patchCanvasViewOption('showGuides')}
                  onZoomActual={() => setZoom(1)}
                  onZoomChange={setZoom}
                  onZoomFit={() => setZoom('fit')}
                  onZoomStep={adjustStageZoom}
                  stageContent={
                    <>
                      <WorkspaceStageCanvas
                        ref={canvasRef}
                        activity={selActivity}
                        onUpdate={updateActivity}
                        zoom={zoom}
                        onZoomChange={setZoom}
                        selectedIds={selectedIds}
                        onSelectionChange={setSelectedIds}
                        timelineTime={timelineCurrentTime}
                        timelineVisualization={timelineVisualization}
                        canvasTool={canvasTool}
                        onCanvasToolChange={setCanvasTool}
                        showChrome={false}
                        showBaseLayer={showBaseLayer}
                        objectClipboardRef={objectClipboardRef}
                      />
                    </>
                  }
                  timelineContent={
                    <>
                      <div
                        style={{
                          height: timelineDockOpen ? 16 : 32,
                          flexShrink: 0,
                          borderTop: '1px solid #e5edf6',
                          borderBottom: '1px solid #e5edf6',
                          background: '#f8fbff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          position: 'relative',
                          padding: timelineDockOpen ? 0 : '0 10px',
                          touchAction: 'none',
                        }}
                      >
                        {timelineDockOpen ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setTimelineDockOpen(false);
                                setTimelinePlaying(false);
                              }}
                              title="Zaman Çizelgesini kapat"
                              style={{
                                position: 'absolute',
                                left: 10,
                                top: 2,
                                width: 26,
                                height: 12,
                                border: 'none',
                                borderRadius: 999,
                                background: '#eaf2ff',
                                color: '#2563eb',
                                cursor: 'pointer',
                                fontSize: 10,
                                fontWeight: 900,
                                lineHeight: 1,
                                padding: 0,
                              }}
                            >
                              ▾
                            </button>
                            <div
                              onPointerDown={(e) => startLayoutResize('timeline', e)}
                              onDoubleClick={() => setTimelineHeight(220)}
                              title="Zaman Çizelgesini yeniden boyutlandır"
                              style={{
                                width: 72,
                                height: 14,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'row-resize',
                              }}
                            >
                              <div
                                style={{
                                  width: 48,
                                  height: 3,
                                  borderRadius: 999,
                                  background: 'rgba(148,163,184,.35)',
                                }}
                              />
                            </div>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setTimelineDockOpen(true);
                              setTimelineHeight((height) =>
                                Math.max(height || 0, 220)
                              );
                            }}
                            title="Zaman Çizelgesini aç"
                            style={{
                              width: '100%',
                              height: 24,
                              border: '1px solid #d8e2ef',
                              borderRadius: 7,
                              background: '#ffffff',
                              color: '#2563eb',
                              cursor: 'pointer',
                              fontSize: 11,
                              fontWeight: 950,
                              letterSpacing: 0.2,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 6,
                            }}
                          >
                            <span style={{ fontSize: 12, lineHeight: 1 }}>⏱</span>
                            ZAMAN ÇİZELGESİ
                          </button>
                        )}
                      </div>
                      {timelineDockOpen && (
                        <TimelineDock
                          activity={selActivity}
                          onUpdate={updateActivity}
                          height={timelineHeight}
                          currentTime={timelineCurrentTime}
                          onCurrentTimeChange={setTimelineCurrentTime}
                          isPlaying={timelinePlaying}
                          onPlayingChange={setTimelinePlaying}
                          visualization={timelineVisualization}
                          onVisualizationChange={setTimelineVisualization}
                          selectedIds={selectedIds}
                          onSelectObject={(objectId) => {
                            if (!objectId) return;
                            setSelectedIds(new Set([objectId]));
                            if (selActivity)
                              updateActivity({ ...selActivity, selectedObjectId: objectId });
                          }}
                          getActivityTimeline={getActivityTimeline}
                          getTimelineDuration={getTimelineDuration}
                          shouldObjectPersistAfterTimeline={shouldObjectPersistAfterTimeline}
                          isObjectTimelineActive={isObjectTimelineActive}
                          createTimelineKeyframe={createTimelineKeyframe}
                        />
                      )}
                    </>
                  }
                />
              </div>

                  <div
                    onPointerDown={(e) => startLayoutResize('right-panel', e)}
                    onDoubleClick={() => setRightPanelWidth(PANEL_LIMITS.right.default)}
                    style={{
                      width: 10,
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'col-resize',
                      background: 'transparent',
                      touchAction: 'none',
                    }}
                  >
                    <div
                      style={{
                        width: 3,
                        alignSelf: 'stretch',
                        margin: '8px 0',
                        borderRadius: 999,
                        background: 'rgba(148,163,184,.32)',
                      }}
                    />
                  </div>
                  <aside
                    style={{
                      width: Math.max(PANEL_LIMITS.right.min, rightPanelWidth),
                      minWidth: Math.max(PANEL_LIMITS.right.min, rightPanelWidth),
                      maxWidth: Math.max(PANEL_LIMITS.right.min, rightPanelWidth),
                      minHeight: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      ...createShellPanelStyle(),
                      borderRadius: 0,
                      overflow: 'hidden',
                      boxShadow: 'none',
                    }}
                  >
                    <ContextRightPanel
                      controller={workspaceChromeController}
                      inspectorProps={rightInspectorPanelProps}
                      registerBackDismissible={registerBackDismissible}
                    />
                  </aside>
            </div>

            <div
              style={{
                minHeight: 34,
                background: EDITOR_THEME.appFooter,
                borderTop: `1px solid ${EDITOR_THEME.shellBorder}`,
                display: 'flex',
                alignItems: 'center',
                padding: '6px 16px',
                fontSize: 11,
                color: EDITOR_THEME.appFooterText,
                gap: 14,
                flexShrink: 0,
                flexWrap: isCompactViewport ? 'wrap' : 'nowrap',
              }}
            >
              <span>Etkinlikler: {present.activities.length}</span>
              {selActivity && (
                <span>
                  {selActivity.name} · {selActivity.objects?.length || 0} nesne ·{' '}
                  {ACTIVITY_TYPES.find((t) => t.id === selActivity.type)?.label}
                </span>
              )}
              {selectedIds.size > 0 && (
                <span style={{ color: '#7dd3fc', fontWeight: 700 }}>
                  {selectedIds.size} nesne seçili
                </span>
              )}
              <span style={{ flex: 1 }} />
              <span>Ctrl+Z/Y · Del · Ctrl+D · Ok / Shift+Ok</span>
            </div>
          </div>
        </EditorWorkspaceShell>
      )}

      {currentView === 'editor' && deviceMode !== 'desktop' && selActivity && (
        <MobileEditorShell
          deviceMode={deviceMode}
          canvasRef={canvasRef}
          topBar={{
            currentProject,
            selActivity,
            undo,
            redo,
            canUndo: history.past.length > 0,
            canRedo: history.future.length > 0,
            onPreview: handleOpenStorylinePreview,
            onAnswer: () => setAnswerDrawerOpen(true),
            onDesign: () => setShowDesignTools(true),
            onExport: handleExport,
            onScormExport: handleScorm12Export,
            onVersions: () => setShowProjectManager(true),
            onBackToLibrary: () =>
              navigateToEditorRoute(
                {
                  pubId: presentRef.current.selPubId || null,
                  bookId: presentRef.current.selBookId || null,
                },
                { mode: 'push' }
              ),
            onLogout: handleLogout,
            onlineUsers,
          }}
          canvasProps={{
            activity: selActivity,
            onUpdate: updateActivity,
            zoom,
            onZoomChange: setZoom,
            selectedIds,
            onSelectionChange: setSelectedIds,
            timelineTime: timelineCurrentTime,
            timelineVisualization,
            canvasTool,
            onCanvasToolChange: setCanvasTool,
            showBaseLayer,
            objectClipboardRef,
          }}
          inspector={{
            controller: workspaceChromeController,
            inspectorProps: rightInspectorPanelProps,
            registerBackDismissible,
          }}
          slideStripElement={
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
              <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex' }}>
                <SlideStrip
                  vertical
                  activity={selActivity}
                  onUpdate={updateActivity}
                  getActivitySlides={getActivitySlides}
                  selectActivitySlide={selectActivitySlide}
                  createSlide={createSlide}
                  normalizeSlide={normalizeSlide}
                  getActivitySlideTarget={getActivitySlideTarget}
                />
              </div>
              <div
                style={{
                  flexShrink: 0,
                  maxHeight: '42%',
                  overflowY: 'auto',
                  borderTop: '1px solid #d7dee7',
                  background: '#ffffff',
                  padding: 8,
                }}
              >
                <LayerManager
                  activity={selActivity}
                  onSelectionChange={setSelectedIds}
                  onUpdateActivity={updateActivity}
                />
              </div>
            </div>
          }
          ribbonElement={<TopRibbon controller={ribbonController} fullscreen />}
          timelineElement={
            <TimelineDock
              activity={selActivity}
              onUpdate={updateActivity}
              height={Math.min(timelineHeight, 240)}
              currentTime={timelineCurrentTime}
              onCurrentTimeChange={setTimelineCurrentTime}
              isPlaying={timelinePlaying}
              onPlayingChange={setTimelinePlaying}
              visualization={timelineVisualization}
              onVisualizationChange={setTimelineVisualization}
              selectedIds={selectedIds}
              onSelectObject={(objectId) => {
                if (!objectId) return;
                setSelectedIds(new Set([objectId]));
                if (selActivity) updateActivity({ ...selActivity, selectedObjectId: objectId });
              }}
              getActivityTimeline={getActivityTimeline}
              getTimelineDuration={getTimelineDuration}
              shouldObjectPersistAfterTimeline={shouldObjectPersistAfterTimeline}
              isObjectTimelineActive={isObjectTimelineActive}
              createTimelineKeyframe={createTimelineKeyframe}
            />
          }
        />
      )}

      {/* ─── Tam Ekran Canvas Düzenleme Katmanı ──────────────────────────── */}
      {canvasExpanded && selActivity && currentView === 'editor' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 900,
            display: 'flex',
            flexDirection: 'column',
            background: '#161e30',
          }}
        >
          <div
            style={{
              minHeight: 48,
              flexShrink: 0,
              background: '#1e2740',
              borderBottom: '1px solid #131b2e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 12px',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#cbd5e1' }}>
                {selActivity.sceneName || selActivity.name || 'Sahne'}
              </span>
              <span style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>
                {selActivity.stageWidth} × {selActivity.stageHeight}
              </span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {renderEditorTabButtons((tab) => ({
                  padding: '6px 10px',
                  border: `1px solid ${activeTab === tab.id ? 'rgba(125,211,252,.45)' : 'rgba(255,255,255,.12)'}`,
                  borderRadius: 8,
                  background:
                    activeTab === tab.id ? 'rgba(14,165,233,.16)' : 'rgba(255,255,255,.04)',
                  color: activeTab === tab.id ? '#d7f3ff' : '#94a3b8',
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: 'pointer',
                }))}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                  background: 'rgba(255,255,255,.07)',
                  border: '1px solid rgba(255,255,255,.12)',
                  borderRadius: 6,
                  padding: '3px 7px',
                }}
              >
                <button
                  onClick={() => adjustStageZoom(-0.1)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    fontSize: 13,
                    padding: '0 2px',
                    lineHeight: 1,
                  }}
                >
                  −
                </button>
                <span
                  style={{
                    fontSize: 11,
                    color: '#cbd5e1',
                    minWidth: 56,
                    textAlign: 'center',
                    fontWeight: 700,
                  }}
                >
                  {zoom === 'fit' ? `Sığdır ${currentZoomPercent}%` : `${currentZoomPercent}%`}
                </span>
                <button
                  onClick={() => adjustStageZoom(0.1)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    fontSize: 13,
                    padding: '0 2px',
                    lineHeight: 1,
                  }}
                >
                  +
                </button>
                <button
                  onClick={() => setZoom('fit')}
                  style={{
                    background: 'rgba(99,131,255,.2)',
                    border: '1px solid rgba(99,131,255,.35)',
                    color: '#a5b4fc',
                    cursor: 'pointer',
                    fontSize: 11,
                    padding: '2px 6px',
                    borderRadius: 4,
                  }}
                >
                  Sığdır
                </button>
                <button
                  onClick={() => setZoom(1)}
                  style={{
                    background: 'rgba(255,255,255,.06)',
                    border: '1px solid rgba(255,255,255,.12)',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    fontSize: 11,
                    padding: '2px 6px',
                    borderRadius: 4,
                  }}
                >
                  1:1
                </button>
              </div>
              <button
                onClick={handleOpenStorylinePreview}
                style={{
                  height: 30,
                  padding: '0 12px',
                  borderRadius: 6,
                  border: '1px solid rgba(56,189,248,.35)',
                  background: 'rgba(56,189,248,.12)',
                  color: '#7dd3fc',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                ▶ Önizleme
              </button>
              <button
                onClick={() => setCanvasExpanded(false)}
                title="Küçült (Esc)"
                style={{
                  height: 30,
                  padding: '0 12px',
                  borderRadius: 6,
                  border: '1px solid rgba(248,113,113,.35)',
                  background: 'rgba(248,113,113,.12)',
                  color: '#fca5a5',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path
                    d="M1 1L9 9M9 1L1 9"
                    stroke="#fca5a5"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
                Küçült
              </button>
            </div>
          </div>
          {renderEditorRibbon({ fullscreen: true })}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              overflow: 'hidden',
              background: '#6b7280',
              padding: 14,
              gap: 14,
            }}
          >
            <div
              style={{
                flex: 1,
                minWidth: 0,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  display: 'flex',
                  overflow: 'hidden',
                  background: EDITOR_THEME.appCanvas,
                  borderRadius: 22,
                  padding: 18,
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,.05)',
                }}
              >
                <WorkspaceStageCanvas
                  ref={canvasRef}
                  activity={selActivity}
                  onUpdate={updateActivity}
                  zoom={zoom}
                  onZoomChange={setZoom}
                  selectedIds={selectedIds}
                  onSelectionChange={setSelectedIds}
                  timelineTime={timelineCurrentTime}
                  timelineVisualization={timelineVisualization}
                  canvasTool={canvasTool}
                  onCanvasToolChange={setCanvasTool}
                  showChrome={false}
                  showBaseLayer={showBaseLayer}
                  objectClipboardRef={objectClipboardRef}
                  touchMode={deviceMode !== 'desktop'}
                />
              </div>
              <div style={{ flexShrink: 0, overflow: 'hidden', borderRadius: 18 }}>
                <TimelineDock
                  activity={selActivity}
                  onUpdate={updateActivity}
                  height={Math.min(Math.max(timelineHeight, 180), 320)}
                  currentTime={timelineCurrentTime}
                  onCurrentTimeChange={setTimelineCurrentTime}
                  isPlaying={timelinePlaying}
                  onPlayingChange={setTimelinePlaying}
                  visualization={timelineVisualization}
                  onVisualizationChange={setTimelineVisualization}
                  selectedIds={selectedIds}
                  onSelectObject={(objectId) => {
                    if (!objectId) return;
                    setSelectedIds(new Set([objectId]));
                    if (selActivity) updateActivity({ ...selActivity, selectedObjectId: objectId });
                  }}
                  getActivityTimeline={getActivityTimeline}
                  getTimelineDuration={getTimelineDuration}
                  shouldObjectPersistAfterTimeline={shouldObjectPersistAfterTimeline}
                  isObjectTimelineActive={isObjectTimelineActive}
                  createTimelineKeyframe={createTimelineKeyframe}
                />
              </div>
            </div>
            <div
              style={{
                width: Math.max(PANEL_LIMITS.right.min, rightPanelWidth),
                minWidth: Math.max(PANEL_LIMITS.right.min, rightPanelWidth),
                maxWidth: Math.max(PANEL_LIMITS.right.min, rightPanelWidth),
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                ...createShellPanelStyle(),
                borderRadius: 0,
                overflow: 'hidden',
                boxShadow: 'none',
              }}
            >
              <ContextRightPanel
                controller={workspaceChromeController}
                inspectorProps={rightInspectorPanelProps}
                registerBackDismissible={registerBackDismissible}
              />
            </div>
          </div>
        </div>
      )}

      <StorylineScormPlayerPreview
        open={storylinePreviewOpen}
        onClose={handleCloseStorylinePreview}
        activity={selActivity}
        activities={selActivity ? [selActivity] : []}
        variables={present.variables}
        snapshotState={storylinePreviewSnapshot}
      />

      <CevapDrawer
        open={answerDrawerOpen}
        onClose={() => setAnswerDrawerOpen(false)}
        activity={selActivity}
        onUpdate={updateActivity}
        lastSaved={lastSaved}
      />

      <ReviewThreadsModal
        open={showReviewThreads}
        onClose={() => setShowReviewThreads(false)}
        projectId={currentProjectId}
        currentUserId={activeUserId}
        currentUserName={activeUserId}
      />

      <AdminManagementModal
        open={showAdminManagement}
        onClose={() => setShowAdminManagement(false)}
        onSelectUser={handleSelectAdminUser}
        adminToken={adminSessionToken}
        onAdminTokenChange={setAdminSessionToken}
      />

      <ProjectVersionManagerModal
        open={showProjectManager}
        onClose={() => setShowProjectManager(false)}
        dbStatus={dbStatus}
        currentProject={currentProject}
        projectNameDraft={projectNameDraft}
        onProjectNameChange={setProjectNameDraft}
        newProjectName={newProjectName}
        onNewProjectNameChange={setNewProjectName}
        onCreateProject={handleCreateProject}
        projects={workspaceInfo.projects}
        onSwitchProject={handleSwitchProject}
        onDeleteProject={handleDeleteProject}
        versionLabel={versionLabel}
        onVersionLabelChange={setVersionLabel}
        onCreateVersion={handleCreateVersion}
        onPublishVersion={handlePublishExistingVersion}
        versions={workspaceInfo.versions}
        onRestoreVersion={handleRestoreVersion}
        onSaveProjectName={handleSaveProjectName}
        onDeleteVersion={handleDeleteVersion}
        onDuplicateProject={handleDuplicateProject}
        activityCount={present.activities.length}
        currentProjectId={currentProjectId}
        books={present.books.map((book) => ({
          id: book.id,
          name: book.name,
          activityCount: present.activities.filter((a) => a.bookId === book.id).length,
        }))}
      />

      <DesignToolsDialog
        open={showDesignTools && currentView === 'editor' && !!selActivity}
        onClose={() => setShowDesignTools(false)}
        onGenerateAnswerSet={handleGenerateAnswerSceneSet}
        onGenerateTemplate={handleGenerateDesignTemplate}
      />

      {pendingResume && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="resume-choice-title"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 99999,
            background: 'rgba(15,23,42,.65)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 460,
              background: '#ffffff',
              borderRadius: 16,
              boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
              padding: 24,
              border: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 999,
                  background: '#eff6ff',
                  color: '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                  fontWeight: 'bold',
                }}
              >
                  ↻
              </div>
              <div>
                <h3
                  id="resume-choice-title"
                  style={{
                    margin: 0,
                    fontSize: 16,
                    fontWeight: 900,
                    color: '#0f172a',
                  }}
                >
                  Kaldığınız Yer Açıldı
                </h3>
                <p style={{ margin: 0, fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  Son düzenlediğiniz konuma otomatik geldik.
                </p>
              </div>
            </div>

            <div
              style={{
                background: '#f8fafc',
                borderRadius: 10,
                padding: 16,
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              {pendingResume.projectName && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: '#64748b', fontWeight: 700 }}>Proje:</span>
                  <span style={{ color: '#0f172a', fontWeight: 900 }}>{pendingResume.projectName}</span>
                </div>
              )}
              {pendingResume.bookName && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: '#64748b', fontWeight: 700 }}>Kitap:</span>
                  <span style={{ color: '#0f172a', fontWeight: 900 }}>{pendingResume.bookName}</span>
                </div>
              )}
              {pendingResume.activityName && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: '#64748b', fontWeight: 700 }}>Etkinlik:</span>
                  <span style={{ color: '#0f172a', fontWeight: 900 }}>{pendingResume.activityName}</span>
                </div>
              )}
            </div>

            <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: '#475569' }}>
              Buradan devam etmek ister misiniz, yoksa yayınevi kısmına mı dönmek istersiniz?
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
              <button
                type="button"
                onClick={handleCancelResume}
                style={{
                  height: 36,
                  padding: '0 16px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontSize: 12,
                  fontWeight: 900,
                  cursor: 'pointer',
                }}
              >
                Yayınevi Kısmı
              </button>
              <button
                type="button"
                onClick={handleConfirmResume}
                style={{
                  height: 36,
                  padding: '0 16px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#2563eb',
                  color: '#ffffff',
                  fontSize: 12,
                  fontWeight: 900,
                  cursor: 'pointer',
                  boxShadow: '0 4px 10px rgba(37,99,235,0.25)',
                }}
              >
                Devam Et
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
