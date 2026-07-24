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
import KickNotificationOverlay from './components/editor/KickNotificationOverlay';
import ToastStack from './components/editor/ToastStack';
import ResumePromptDialog from './components/editor/ResumePromptDialog';
import GlossaryEditorModal from './components/GlossaryEditorModal';
import IconPickerModal from './components/IconPickerModal';
import ContentLibraryModal from './components/ContentLibraryModal';
import CharacterPickerModal from './components/CharacterPickerModal';
import SymbolPickerModal from './components/SymbolPickerModal';
import ProjectVersionManagerModal from './components/ProjectVersionManagerModal';
import ReviewThreadsModal from './components/ReviewThreadsModal';
import EditorTopBar from './components/ribbon/EditorTopBar';
import TopRibbon from './components/ribbon/TopRibbon';
import useRibbonController from './components/ribbon/useRibbonController';
import SlideMasterModal from './components/SlideMasterModal';
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
import ButtonPackageIntroDiagram from './features/editor-workspace/ButtonPackageIntroDiagram';
import useWorkspaceChromeController from './features/editor-workspace/useWorkspaceChromeController';
import useLayoutResize from './features/editor-workspace/useLayoutResize';
import useEditorPresenceHeartbeat from './features/auth/useEditorPresenceHeartbeat';
import useBookLock from './features/navigation/useBookLock';
import useWorkspaceData from './features/workspace/useWorkspaceData';
import CanvasWorkspaceCenter from './features/editor-workspace/CanvasWorkspaceCenter';
import DesignToolsDialog from './features/editor-workspace/DesignToolsDialog';
import TextStudioWorkspace from './features/text-studio/TextStudioWorkspace';
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
  readyButtonTextShadowForColor,
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
import { getDragDropAssignments } from './logic/activityScoring';
import {
  getVariableTypeLabel,
  formatVariableValue,
  buildVariableUsageCountMap,
  buildBuiltInVariableRows,
} from './logic/variableHelpers';
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
  isDragReusable,
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
import {
  normalizeActivity,
  restyleActivityButtonsForPackage,
  restyleActivityButtonMotion,
} from './logic/activityRestyle';
import useEditorStore from './store/useEditorStore';
import {
  detectPdfDraftKind,
  extractPdfDragTerms,
  extractPdfAnswerTerms,
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
import { readObjectClipboardFromSystem } from './utils/systemClipboard';
import {
  buildStorylinePlayerHtml,
  downloadScorm12Zip,
  validateScorm12PreviewStart,
} from './utils/scormExport';
import { inlineExternalMediaForExport } from './utils/scormMediaInline';
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
import StorylineScormPlayerPreview from './components/StorylineScormPlayerPreview';
import {
  syncAnswerPlacementObjects,
  normalizeBook,
  pickBookLayerPresetPayload,
  normalizeLayerPreset,
  applyBookLayerPresetToActivity,
  pickTextStudioDesign,
  normalizeTextStudioPreset,
  applyTextStudioPreset,
  normalizeState,
  normalizeActivityForRuntimeSnapshot,
  createRuntimeStateSnapshot,
  createPreviewHtmlSignature,
  hasLmsSecrets,
  maskLmsSecrets,
  clearRedactedLmsSecrets,
  normalizeScorm12LmsConfig,
  collectExternalUrls,
  summarizeExternalUrlsForScorm,
  createSafeStateForStorage,
  createSafeStateForExport,
  stateHasLmsSecrets,
} from './logic/editorState/stateNormalize';
import {
  layoutDragPositionsForMatches,
  buildAutoDragMatches,
  buildDragDropPlacementLayout,
  evaluateDragDropPlacements,
} from './logic/editorState/dragLayout';


// Eagerly initialize AI worker (non-blocking)
initAIWorker().catch(() => {});

// ─── Sabitler ─────────────────────────────────────────────────────────────────

const EDUCATION_BUTTON_ICON_SIZE_LARGE = 30;
const REMOTE_STATUS_REQUEST_TIMEOUT_MS = 15000;
const REMOTE_SAVE_REQUEST_TIMEOUT_MS = 30000;

const CONTENT_LANGUAGE_OPTIONS = [
  { value: 'tr', label: 'Türkçe' },
  { value: 'en', label: 'English' },
];










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





// NOT: Degisken paneli yardimcilari (getVariableTypeLabel, formatVariableValue,
// resolveColorPickerValue, buildVariableUsageCountMap, buildBuiltInVariableRows)
// ./logic/variableHelpers modulune tasindi.



const AUTO_LAYER_NAME_PRESETS = ['menu', 'explanation', 'normal', 'Correct', 'Incorrect', 'cevap'];


// NOT: PDF içe aktarma nesne fabrikaları (createPdfImageObject, createPdfMaskObject,
// createPdfDropzoneObject, createPdfDraggableObject, createPdfSelectionObject,
// buildPdfSelectionObjects, applyPdfCleaningMasks, buildPdfDragDropObjects) tek bir
// kaynak olarak './logic/pdfObjectFactory' modülüne taşındı. Bu dosyadaki kopyaları
// uyuyan (dormant) içe aktarma akışına ait olduğu ve burada çağrılmadığı için silindi.







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






// NOT: Etkinlik puanlama motorlari (getDragDropAssignments, getAutoAnswerSummary,
// getCorrectSelectionIds, scoreSequence, scoreMatching, scoreTextEntry, scoreNumeric,
// scoreFillBlank, scoreSurvey, scoreActivity) ./logic/activityScoring modulune tasindi.

// eslint-disable-next-line no-unused-vars -- Reserved for auto-layout of matched drag items.

// ─── Seçim Editörü ────────────────────────────────────────────────────────────


// ─── Sürükle-Bırak Yapılandırma Paneli ───────────────────────────────────────

// ─── Ekran Akışı Editörü ──────────────────────────────────────────────────────


/* ActivityScreenFlowEditor kaldırıldı — ölü kod, hiçbir yerden render edilmiyordu */

// ─── ANA UYGULAMA ─────────────────────────────────────────────────────────────

export default function EIcerikEditor() {
  const [authState, setAuthState] = useState(() => readStoredAuth());
  const [loginForm, setLoginForm] = useState(() => {
    return {
      userId: FIXED_EDITOR_USERS[0].id,
      password: '',
      remember: false,
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
  // İkon Seçici: { onSelect } veya null. onSelect, seçilen { iconName, iconSvg } ile çağrılır.
  const [iconPicker, setIconPicker] = useState(null);
  // İçerik Kütüphanesi: { onSelect } veya null. onSelect, seçilen stok öğesi ile çağrılır.
  const [contentLibrary, setContentLibrary] = useState(null);
  // Karakter Seçici: { onSelect } veya null. onSelect, { kind: 'emoji'|'upload', ... } ile çağrılır.
  const [characterPicker, setCharacterPicker] = useState(null);
  // Sembol Seçici: { onSelect } veya null. onSelect, seçilen sembol öğesi ile çağrılır.
  const [symbolPicker, setSymbolPicker] = useState(null);
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
  const toastIdRef = useRef(0);
  const adminSessionTokenRef = useRef('');
  // Ctrl+S ile anlık kayıt komutu — klavye handler'ı bu dosyada handleManualSaveProject/
  // performRemoteSave'den ÖNCE tanımlandığı için ref üzerinden dolaylı çağrılır
  // (slideClipboardCommandsRef ile aynı desen).
  const manualSaveCommandRef = useRef(null);
  const objectClipboardRef = useRef(null);
  const slideClipboardRef = useRef(null);
  // Sayfa yenilemeden sonra nesne panosunu sessionStorage'dan geri yükle.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('eicerik_obj_clipboard');
      if (saved && objectClipboardRef.current == null) {
        objectClipboardRef.current = JSON.parse(saved);
        clipboardKindRef.current = 'objects';
      }
    } catch { /* bozuk veri → yoksay */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const slideClipboardCommandsRef = useRef({});
  // Klavyeyle en son kopyalanan tür ('objects' | 'slide'). Yapıştırma bu türe
  // göre yönlendirilir; böylece nesne kopyaladıysak slaytlar arası nesne
  // yapıştırabiliriz, slayt kopyaladıysak slayt yapıştırırız.
  const clipboardKindRef = useRef('');
  const workspaceEntryModeRef = useRef(authState?.userId ? 'refresh' : 'anonymous');
  const presentRef = useRef(history.present);
  const isDirtyRef = useRef(false);
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
    // URL'e okunabilir slug ekle (slug~id); history state plain id'lerle kalir.
    const present = presentRef.current || {};
    const urlRoute = {
      ...route,
      pubName: (present.publishers || []).find((item) => item.id === route.pubId)?.name,
      bookName: (present.books || []).find((item) => item.id === route.bookId)?.name,
      actName: (present.activities || []).find((item) => item.id === route.actId)?.name,
    };
    const url = buildEditorUrl(urlRoute, window.location);
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
    if (keepBootVisibleForWorkspace) {
      // Girişli kullanıcı sayfayı yenileyince çalışma alanı yüklenene kadar editör
      // null döner; bu sırada açılış ekranını GÖSTERİYORUZ (aksi halde birkaç saniye
      // beyaz ekran kalırdı). Açılış ekranının kapatılması artık tamamen burada yönetilir.
      window.__EIC_BOOT_UPDATE__?.({
        badge: 'Editör Başlatılıyor',
        title: 'Arayüz hazırlanıyor...',
        body: 'SQL bağlantısı doğrulanıyor. Çalışma alanı hazır olunca editör açılacak.',
        showSpinner: true,
      });
    } else {
      // Çalışma alanı hazır ya da giriş ekranı gösterilecek: açılış ekranını kapat.
      window.__EIC_BOOT_DONE__?.();
    }
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
        remember: nextLockState?.remember ?? current.remember,
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
        remember: credentials.remember || false,
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

  // Workspace meta verisi yardımcıları (syncWorkspaceMeta + mergeWorkspaceProjectData)
  // useWorkspaceData hook'una taşındı. loadWorkspaceState ve sync effect'leri
  // (normalizeState/writeBrowserRoute'a bağlı) monolitte kalır.
  const { syncWorkspaceMeta, mergeWorkspaceProjectData } = useWorkspaceData({
    currentProjectId,
    setWorkspaceInfo,
    setProjectNameDraft,
  });

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

  // Kitap kilidi alma/bırakma mantığı useBookLock hook'una taşındı.
  const { acquireBookLock, releaseBookLock } = useBookLock({
    activeUserId,
    activeSessionId,
    setBookLockInfo,
    setBookLockWarning,
    showToast,
  });

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
      // Canvas'ta nesne seçiliyse kopyalama/yapıştırma her zaman nesne üzerinde
      // çalışır. Slayt panosu yalnızca hiçbir nesne seçili değilken (slayt
      // ağacına odaklıyken veya Sahne sekmesindeyken) devreye girer. Aksi halde
      // (örn. slayt ağacı bayat odakta kalınca) hazır butonları kopyalarken
      // tüm slayt kopyalanıyordu.
      const hasObjectSelection = selectedIds.size > 0 || !!currentActivity?.selectedObjectId;
      const useSlideClipboard =
        !hasObjectSelection && (slideTreeFocused || storyRibbonTab === 'scene');

      if (modKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        // Ctrl+Shift+Z = yinele (Ctrl+Y ile aynı), Ctrl+Z = geri al
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (modKey && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }
      if (modKey && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        toggleNativeFullscreen();
        return;
      }
      if (modKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        // Otomatik kayda ek olarak: anlık yerel kayıt + varsa bekleyen debounce'u
        // atlayıp uzak (SQL) kaydı hemen tetikler (manualSaveCommandRef.current).
        manualSaveCommandRef.current?.();
        return;
      }

      if (!canvasRef.current) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        canvasRef.current.deleteSelected();
      } else if (modKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        if (useSlideClipboard && slideClipboardCommandsRef.current.copySlide?.()) {
          clipboardKindRef.current = 'slide';
          return;
        }
        if (canvasRef.current.copySelected?.()) clipboardKindRef.current = 'objects';
      } else if (modKey && e.key.toLowerCase() === 'x') {
        e.preventDefault();
        // Kes: kopyala + sil (sağ tık menüsündeki 'Kes' ile aynı, yalnız nesne kanalı)
        if (canvasRef.current.copySelected?.()) {
          clipboardKindRef.current = 'objects';
          canvasRef.current.deleteSelected?.();
        }
      } else if (modKey && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        // Ctrl+Shift+V: nesneyi kopyalandığı X,Y koordinatına (kaydırmasız) yapıştır.
        const pasteOptions = { exactPosition: e.shiftKey };
        // Önce sistem panosunu dene (başka bir sekmede/pencerede kopyalanmış olabilir,
        // Canva'daki gibi) — bulunursa bu sekmenin nesne panosuna uygulanır, ardından
        // mevcut yapıştırma akışı (slayt/nesne kanal seçimi) değişmeden çalışır.
        readObjectClipboardFromSystem().then((systemPayload) => {
          if (systemPayload && canvasRef.current?.applySystemClipboard?.(systemPayload)) {
            clipboardKindRef.current = 'objects';
          }
          // En son kopyalanan türe göre yapıştır. Slayt ise slayt önce, nesne ise nesne önce;
          // her iki durumda da geri-plan olarak diğer kanal denenir.
          if (clipboardKindRef.current === 'slide') {
            if (slideClipboardCommandsRef.current.pasteSlide?.()) return;
            canvasRef.current.pasteClipboard?.(pasteOptions);
          } else {
            if (canvasRef.current.pasteClipboard?.(pasteOptions)) return;
            slideClipboardCommandsRef.current.pasteSlide?.();
          }
        });
      } else if (modKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        canvasRef.current.duplicateSelected();
      } else if (modKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        const a = history.present;
        const act = a.activities.find((x) => x.id === a.selActId);
        const curLayer = act?.activeLayerId || 'base';
        // Yalnızca görünür, kilitsiz ve AKTİF katmandaki ögeleri seç
        // (gizli/diğer katman/kilitli hariç; cevap yerleşimi kilit istisnası)
        setSelectedIds(
          new Set(
            (act?.objects || [])
              .filter(
                (o) =>
                  o.visible !== false &&
                  (o.layerId || 'base') === curLayer &&
                  (!o.locked || o.generatedBy === 'answer-placement')
              )
              .map((o) => o.id)
          )
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
            remember: loginForm.remember,
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
    loginForm.remember,
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
            remember: loginForm.remember,
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
    loginForm.remember,
    setDbStatus,
    showToast,
    syncWorkspaceMeta,
  ]);

  // Presence heartbeat + kick (oturum sonlandırma) yan etkileri
  // useEditorPresenceHeartbeat hook'una taşındı. State (presence/kickRequested/
  // kickCountdown) ve forceLogoutToLogin monolitte kalır; hook yalnız effect'leri
  // kapsüller ve bağımlılıklarını options ile alır.
  useEditorPresenceHeartbeat({
    activeUserId,
    activeSessionId,
    authState,
    loginForm,
    kickRequested,
    kickCountdown,
    forceLogoutToLogin,
    setPresence,
    setKickRequested,
    setKickCountdown,
    setDbStatus,
    heartbeatFailCountRef,
    remoteReadyRef,
    offlineDraftPendingRef,
  });

  // Uzak (SQL) kaydı gerçekleştiren fonksiyon — hem debounce'lu otomatik kayıt
  // efekti hem de Ctrl+S ile tetiklenen anlık kayıt tarafından paylaşılır.
  const performRemoteSave = useCallback(() => {
    // Kayıt zaten uçuştaysa yeni istek başlatma; .then()/.catch() içinden
    // isDirtyRef ile yeniden tetiklenecek → kapatma-temizleme yarışı yok.
    if (remoteSavePendingRef.current) return;
    isDirtyRef.current = false;
    remoteSavePendingRef.current = true;
    // Her zaman en güncel durumu kaydet (kapatma‐değişken staleness'ı önler).
    const snapshot = presentRef.current;
    apiRequest(`/projects/${currentProjectId}/draft`, {
      method: 'PUT',
      timeoutMs: REMOTE_SAVE_REQUEST_TIMEOUT_MS,
      body: JSON.stringify({
        state: createSafeStateForStorage(snapshot),
        name: projectNameDraft,
        setCurrent: true,
        lockBookId: snapshot.selBookId || '',
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
        // Önbelleği her zaman en güncel durum ile güncelle.
        if (lastWorkspaceRef.current) {
          lastWorkspaceRef.current = {
            ...lastWorkspaceRef.current,
            state: createSafeStateForStorage(presentRef.current),
            updatedAt: r?.updatedAt || lastWorkspaceRef.current.updatedAt,
            currentProject: r?.project || lastWorkspaceRef.current.currentProject,
          };
          writeWorkspaceCache(activeUserId, lastWorkspaceRef.current);
        }
        if (hadOfflineDraft) {
          showToast('Yerel değişiklikler SQL sunucusuna yüklendi.', 'success');
        }
        // Kayıt uçuştayken yeni düzenleme geldiyse hemen tekrar kaydet.
        if (isDirtyRef.current) setTimeout(performRemoteSave, 350);
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
          if (currentProjectId && snapshot.selBookId) {
            releaseBookLock(currentProjectId, snapshot.selBookId);
          }
          const fallbackRoute = { pubId: presentRef.current.selPubId || null, bookId: null, actId: null };
          setNavigationRouteState(fallbackRoute);
          writeBrowserRoute(fallbackRoute, 'replace');
          offlineDraftPendingRef.current = false;
          return;
        }
        if (error?.code === 'USER_LOCKED') {
          forceLogoutToLogin('', {
            userId: activeUserId,
            password: loginForm.password,
            remember: loginForm.remember,
            sessionId: activeSessionId,
            sessionLabel: authState?.sessionLabel || createSessionLabel(),
            session: error.session || null,
            message: error.message || 'Bu kullanıcı başka bir cihazda aktif.',
          });
          return;
        }
        // Geçici hata: 5 ardışık başarısızlıkta çevrimdışı moda geç.
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
        // Kirliyse gecikmeli tekrar dene.
        if (isDirtyRef.current) setTimeout(performRemoteSave, 1200);
      });
  }, [
    activeSessionId,
    activeUserId,
    authState?.sessionLabel,
    currentProjectId,
    forceLogoutToLogin,
    loginForm.password,
    loginForm.remember,
    mergeWorkspaceProjectData,
    projectNameDraft,
    releaseBookLock,
    setDbStatus,
    setNavigationRouteState,
    showToast,
    writeBrowserRoute,
  ]);

  useEffect(() => {
    if (!activeUserId || !remoteReadyRef.current || dbStatus !== 'connected' || !currentProjectId)
      return;
    if (pendingResume) return;
    if (skipRemoteSaveRef.current) {
      skipRemoteSaveRef.current = false;
      return;
    }
    // Yeni state → kirli bayrak set et. Kayıt tamamlandıktan sonra hâlâ
    // kirliyse (yani kayıt uçuştayken yeni düzenleme geldi) hemen tekrar kaydet.
    isDirtyRef.current = true;
    const saveTimer = setTimeout(performRemoteSave, 350);
    return () => clearTimeout(saveTimer);
  }, [activeUserId, currentProjectId, dbStatus, pendingResume, present, performRemoteSave]);

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

  // Panel/zaman çizelgesi yeniden boyutlandırma mantığı useLayoutResize hook'una taşındı.
  const { startLayoutResize, resetLayout } = useLayoutResize();

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
          // Elle renk verildiyse kilitle: TTKB kontrast düzeltmesi ve tema
          // restyle'ı ezmesin; butonda gölge de seçilen renge uyarlansın.
          if (
            ['button', 'text', 'shape'].includes(item.type) &&
            Object.prototype.hasOwnProperty.call(stylePatch, 'color')
          ) {
            nextItem.style.colorLocked = true;
            if (item.type === 'button') {
              const adaptedShadow = readyButtonTextShadowForColor(stylePatch.color);
              if (adaptedShadow) nextItem.style.textShadow = adaptedShadow;
            }
          }
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
          remember: loginForm.remember,
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
        { userId: lockState.userId, password: lockState.password, remember: lockState.remember, force: true },
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
          { userId: lockState.userId, password: lockState.password, remember: lockState.remember },
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

  const [manualSaving, setManualSaving] = useState(false);
  const handleManualSave = useCallback(async () => {
    if (!currentProjectId) {
      showToast('Kaydedilecek aktif proje yok.');
      return;
    }
    if (dbStatus !== 'connected') {
      showToast('Veritabanı bağlı değil; kayıt yapılamadı.');
      return;
    }
    if (manualSaving) return;
    setManualSaving(true);
    try {
      const r = await apiRequest(`/projects/${currentProjectId}/draft`, {
        method: 'PUT',
        timeoutMs: REMOTE_SAVE_REQUEST_TIMEOUT_MS,
        body: JSON.stringify({
          state: createSafeStateForStorage(present),
          name: projectNameDraft,
          setCurrent: true,
          lockBookId: present.selBookId || '',
        }),
      });
      if (r?.updatedAt) lastRemoteUpdatedAtRef.current = r.updatedAt;
      mergeWorkspaceProjectData({ currentProject: r?.project });
      setLastSaved(new Date());
      showToast('Kaydedildi.');
    } catch (error) {
      showToast(error?.message || 'Kayıt başarısız.');
    } finally {
      setManualSaving(false);
    }
  }, [
    currentProjectId,
    dbStatus,
    manualSaving,
    present,
    projectNameDraft,
    mergeWorkspaceProjectData,
    showToast,
  ]);

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

  const handleScorm12Export = useCallback(async () => {
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
      // Çevrimdışı paket: sunucudaki medya (görsel/ses/video, can simgesi) pakete
      // data URL olarak gömülür — paket internetsiz LMS'te de çalışır.
      const {
        state: inlinedState,
        inlined,
        failed: inlineFailed,
      } = await inlineExternalMediaForExport(normalizedPreviewState);
      if (inlineFailed.length) {
        const failSample = inlineFailed
          .slice(0, 5)
          .map((item) => `- ${item.url} (${item.error})`)
          .join('\n');
        const ok = window.confirm(
          `${inlineFailed.length} medya dosyası pakete gömülemedi (indirme hatası):\n\n` +
            `${failSample}\n\n` +
            'Bu dosyalar pakette internet adresiyle kalacak ve çevrimdışı ortamda ÇALIŞMAYACAK. Yine de devam edilsin mi?'
        );
        if (!ok) {
          showToast('SCORM paketi oluşturma medya gömme hatası nedeniyle iptal edildi.', 'warning');
          return;
        }
      }
      const externalUrls = summarizeExternalUrlsForScorm(inlinedState);
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
      downloadScorm12Zip(inlinedState, safeLmsConfig, {
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
      if (inlined.length) {
        const totalMb = inlined.reduce((sum, item) => sum + (item.bytes || 0), 0) / (1024 * 1024);
        showToast(
          `${inlined.length} medya dosyası pakete gömüldü (${totalMb.toFixed(1)} MB) — paket çevrimdışı çalışır.`,
          'success'
        );
      }
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

  // Ctrl+S: yerel kayıt (yukarıdaki gibi anında geri bildirim) + bekleyen 350ms
  // debounce'u atlayıp uzak (SQL) kaydı hemen tetikler — otomatik kaydı beklemeden
  // "şu anki hâlini kaydet" isteğini karşılar.
  const handleForceSave = useCallback(() => {
    handleManualSaveProject();
    if (
      !isRemoteMutationLocked &&
      activeUserId &&
      remoteReadyRef.current &&
      dbStatus === 'connected' &&
      currentProjectId
    ) {
      performRemoteSave();
    }
  }, [
    activeUserId,
    currentProjectId,
    dbStatus,
    handleManualSaveProject,
    isRemoteMutationLocked,
    performRemoteSave,
  ]);

  useEffect(() => {
    manualSaveCommandRef.current = handleForceSave;
  }, [handleForceSave]);

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
    setTimelineCurrentTime,
    setTimelinePlaying,
    setTimelineVisualization,
    setSelectedIds,
    setShowBranchDiagram,
    setShowGlossaryEditor,
    setShowVariablesManager,
    openIconPicker: (onSelect) => setIconPicker({ onSelect }),
    openContentLibrary: (onSelect) => setContentLibrary({ onSelect }),
    openCharacterPicker: (onSelect) => setCharacterPicker({ onSelect }),
    openSymbolPicker: (onSelect) => setSymbolPicker({ onSelect }),
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
        onUserIdChange={(userId) => setLoginForm((current) => ({ ...current, userId }))}
        onPasswordChange={(password) => setLoginForm((current) => ({ ...current, password }))}
        onRememberChange={(remember) => setLoginForm((current) => ({ ...current, remember }))}
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
        <KickNotificationOverlay
          kickCountdown={kickCountdown}
          onConfirm={() => {
            setKickRequested(false);
            forceLogoutToLogin('');
          }}
        />
      )}

      {/* ─── TOAST NOTIFICATIONS ──────────────────────────────── */}
      {toasts.length > 0 && (
        <ToastStack
          toasts={toasts}
          onDismiss={(id) => setToasts((prev) => prev.filter((x) => x.id !== id))}
        />
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
        onManualSave={handleManualSave}
        manualSaving={manualSaving}
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

      <IconPickerModal
        open={!!iconPicker}
        onClose={() => setIconPicker(null)}
        onSelect={(selection) => {
          const callback = iconPicker?.onSelect;
          setIconPicker(null);
          callback?.(selection);
        }}
      />

      {/* Master (stil paketi) editörü: hem Tasarım ribbonu hem Tasarım sağ paneli
          commands.openMasterEditor ile açar; tek mount noktası burası. */}
      <SlideMasterModal
        open={!!ribbonController.masterEditorOpen}
        onClose={() => ribbonController.commands.closeMasterEditor?.()}
        masters={ribbonController.galleries?.slideMasters || []}
        currentId={selActivity?.slideMasterId || 'blank'}
        onApply={(id) => ribbonController.commands.applySlideMaster?.(id)}
        onInsertLayout={(id) => ribbonController.commands.applyMasterLayout?.(id)}
      />

      <ContentLibraryModal
        open={!!contentLibrary}
        onClose={() => setContentLibrary(null)}
        onSelect={(item) => {
          const callback = contentLibrary?.onSelect;
          setContentLibrary(null);
          callback?.(item);
        }}
      />

      <CharacterPickerModal
        open={!!characterPicker}
        onClose={() => setCharacterPicker(null)}
        onSelect={(result) => {
          const callback = characterPicker?.onSelect;
          setCharacterPicker(null);
          callback?.(result);
        }}
      />

      <SymbolPickerModal
        open={!!symbolPicker}
        onClose={() => setSymbolPicker(null)}
        onSelect={(item) => {
          const callback = symbolPicker?.onSelect;
          setSymbolPicker(null);
          callback?.(item);
        }}
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
                    width: isSlidePanelCollapsed ? 30 : 12,
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
                      title="Sahne panelini aç"
                      style={{
                        width: 30,
                        height: '100%',
                        borderRadius: 10,
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
                        width: 12,
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
                        title="Sahne panelini gizle"
                        style={{
                          position: 'absolute',
                          top: 14,
                          left: '50%',
                          transform: 'translateX(-50%)',
                          width: 18,
                          height: 44,
                          borderRadius: 999,
                          border: '1px solid #cfd8e3',
                          background: 'linear-gradient(180deg,#ffffff,#f3f6f9)',
                          color: '#7b8794',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: 0,
                          zIndex: 2,
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
                        onPickIcon={(cb) => setIconPicker({ onSelect: cb })}
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
                      flexShrink: 0,
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
                  onPickIcon={(cb) => setIconPicker({ onSelect: cb })}
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
        <ResumePromptDialog
          resume={pendingResume}
          onCancel={handleCancelResume}
          onConfirm={handleConfirmResume}
        />
      )}
    </div>
  );
}

