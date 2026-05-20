/* eslint-disable no-unused-vars, import/order */
import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from 'react';

import { analyzeTextOffline, initAIWorker } from '../aiService';
import { apiRequest, fileToDataUrl, uploadMediaFile } from '../api/apiClient';

import RuntimeVideoElement from './editor/RuntimeVideoElement';
import GlossaryEditorModal from './GlossaryEditorModal';
import ProjectVersionManagerModal from './ProjectVersionManagerModal';
import {
  StorylineSystemPreview,
  isButtonIntroInteractiveSlot,
  isLaunchIntroControl,
  isLaunchStartControl,
  shouldObjectPersistAfterTimeline,
  isObjectTimelineActive,
  getTimelineMotionStyle,
  getSelectionUi,
  resolveWrongSelectionGlyph,
  getFitScale,
  getSelectionMarkGlyph,
} from './storyline-preview';
import { Inp, SelectInp, Btn, ShapePreviewIcon } from './ui';
import SelectionEditor from './activity-editors/SelectionEditor';
import MixedActivityEditor from './activity-editors/MixedActivityEditor';
import {
  FIXED_EDITOR_USERS,
  BUTTON_PACKAGES,
  DEFAULT_THEME_PACKAGE_ITEMS,
  ACTIVITY_TYPES,
  DRAG_DROP_MODES,
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
} from '../constants';
import {
  parseCssColorSamples,
  relativeLuminance,
  contrastRatioForColors,
  readableTextColorForBackground,
  contrastSafeButtonStyle,
  ensureTtkbButtonTextContrast,
  cssColorWithAlpha,
} from '../editor-logic/colorUtils';
import {
  readStoredAuth,
  writeStoredAuth,
  clearStoredAuth,
  createSessionId,
  createSessionLabel,
  getUserStorageKey,
} from '../hooks/useAuth';
import { EDITOR_THEME, createShellPanelStyle, PANEL_SCALE_RANGE } from '../theme';
import {
  formatBookLockMessage,
  normalizePdfHintRect,
  mergePdfTermLists,
  sanitizeSvgMarkup,
  uid,
  clamp,
  applyMasterPresetToActivity,
  buildMasterLayoutDescriptors,
} from '../utils/editorHelpers';
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
} from '../logic/factories';
import {
  getAnswerLayerStylePresetById,
  getPresetToneColors,
  getPresetButtonShapeStyle,
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
} from '../logic/buttonStyling';
import {
  SCENE_TEMPLATE_OPTIONS,
  SCENE_TEMPLATE_VERSION,
  SCENE_TEMPLATE_BUTTON_INTRO_ID,
  SCENE_TEMPLATE_LAUNCH_PAGE_ID,
  DEFAULT_ANSWER_LAYER_STYLE_PRESET_ID,
  DEFAULT_BOOK_LAYER_PRESET_NAME,
  EDUCATION_BUTTON_TEXT_SIZE_SMALL,
  isButtonIntroDemoButton,
  buildButtonIntroSceneTemplateObjects,
  buildLaunchPageSceneTemplate,
  normalizeSingleButtonIcon,
  getButtonPairSemanticIcon,
  applySceneTemplateToSlide,
} from '../logic/sceneTemplates';
import {
  getActivityDragDropDefaults,
  getDragDropSettings,
  getDragDropAnimationPreset,
  normalizeDragDropMatchValue,
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
} from '../logic/dragDrop';
import {
  normalizeVariable,
  normalizeObject,
  getDefaultVariableValue,
  castVariableValue,
  createVariableItem,
} from '../logic/normalize';
import {
  createTimelineKeyframe,
  createTimelineItem,
  normalizeTimelineItem,
  syncTimelineWithObjects,
  getActivityTimeline,
  getTimelineItemForObject,
  getTimelineDuration,
} from '../logic/timeline';
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
} from '../logic/activityHelpers';
import {
  normalizeSlide,
  pickSlideState,
} from '../logic/slideNormalization';
import useEditorStore from '../store/useEditorStore';
import {
  EditorToolRail,
  SelectionStepShell,
  PublisherPanel,
  BookPanel,
  ActivityPanel,
} from './SelectionPanels';
import { LayerThumbnail, SlideStrip, SlideThumbnail } from './SlideStrip';
import VariablesManagerModal from './VariablesManagerModal';
import TimelineDock from './TimelineDock';
import ReviewThreadsModal from './ReviewThreadsModal';
import {
  normalizePdfText,
  sanitizePdfText,
  detectPdfDraftKind,
  extractPdfDragTerms,
  extractPdfAnswerTerms,
  extractPdfQuestionAnchors,
  buildStoryboardConfig,
} from '../pdfParser';
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
} from '../logic/pdfUtils';
import {
  getActivityContentLanguage,
  contentText,
  translateGeneratedContentText,
  applyContentLanguageToActivity,
} from '../logic/contentLanguage';
import {
  isGeneratedSceneTemplateObject,
  createObjectFromActivity,
  updateActivityObject,
  createTriggerItem,
  createTriggerConditionItem,
} from '../logic/activityFactory';
import {
  getEditorPrimaryObjectId,
  getEditorGroupedObjectEntries,
  canObjectBeSelectionShape,
  EDUCATION_BUTTON_ICON_SIZE,
  getAnswerPlacementFrames,
  safeClone,
  normalizeButtonPairLayoutForActivity,
} from '../logic/editorHelpers';
import {
  getObjectSelectionBounds,
  alignActivitySelection,
  distributeActivitySelection,
} from '../logic/objectLayout';
import { createLearnerSafeStateForExport } from '../utils/learnerSecurity';
import {
  buildStorylinePlayerHtml,
  downloadScorm12Zip,
  validateScorm12PreviewStart,
} from '../utils/scormExport';
import {
  buildStorylineObjectRenderModel,
  getSharedStorylineRendererRuntimeApi,
  getStorylinePreviewRenderData,
  isStorylineDropTargetLikeObject,
} from '../utils/storylineRenderer';
import {
  getRuntimeButtonAction,
  isGeneratedAnswerTemplateObject,
  normalizeRuntimeActionLabel,
  withStableRuntimeSlideObjectIds,
} from '../utils/storylineRuntime';
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
} from '../utils/storylineRuntimeEngine';
import {
  auditTtkbEditorState,
  enforceTtkbActivityCompliance,
  enforceTtkbEditorState,
} from '../utils/ttkbCompliance';

import DragDropConfigPanel from './activity-editors/DragDropConfigPanel';
import FillBlankEditor from './activity-editors/FillBlankEditor';
import MatchingEditor from './activity-editors/MatchingEditor';
import NumericEditor from './activity-editors/NumericEditor';
import SequenceEditor from './activity-editors/SequenceEditor';
import SurveyEditor from './activity-editors/SurveyEditor';
import TextEntryEditor from './activity-editors/TextEntryEditor';
import AdminManagementModal from './AdminManagementModal';
import BranchingDiagramModal from './BranchingDiagramModal';

// eslint-disable-next-line no-unused-vars -- Legacy inspector kept for comparison with RightInspectorPhase2.
export function RightInspector({
  activity,
  onUpdate,
  selectedIds,
  hideTimeline = false,
  activities = [],
}) {
  const safeActivity = useMemo(
    () => activity || { objects: [], timeline: [], triggers: [], selectedObjectId: null },
    [activity]
  );
  const objects = safeActivity.objects || [];
  const layers = getActivityLayers(safeActivity);
  const resolvedLayerNames = useMemo(
    () => buildResolvedLayerNameMap(layers, safeActivity),
    [safeActivity, layers]
  );
  const timeline = safeActivity.timeline || [];
  const triggers = useMemo(() => safeActivity.triggers || [], [safeActivity]);
  const rawSelectedObjectId = safeActivity.selectedObjectId || '';
  const resolvedSelectedObjectId =
    selectedIds.size === 1 && selectedIds.has(rawSelectedObjectId)
      ? rawSelectedObjectId
      : getEditorPrimaryObjectId(safeActivity, rawSelectedObjectId);
  const sel = objects.find((o) => o.id === resolvedSelectedObjectId) || null;
  const groupedSelectedIds = useMemo(
    () =>
      new Set(
        selectedIds.size === 1
          ? [...selectedIds].filter(Boolean)
          : [...selectedIds].map((id) => getEditorPrimaryObjectId(safeActivity, id)).filter(Boolean)
      ),
    [safeActivity, selectedIds]
  );
  const multiSel = groupedSelectedIds.size > 1;
  const selectedObjectCount = groupedSelectedIds.size;

  const patchAct = (p) => {
    if (!activity) return;
    onUpdate({ ...safeActivity, ...p });
  };
  const patchObj = useCallback(
    (id, p, options = {}) => {
      if (!activity) return;
      onUpdate(updateActivityObject(safeActivity, id, p, options));
    },
    [activity, onUpdate, safeActivity]
  );
  const patchTimeline = (id, p) =>
    patchAct({ timeline: timeline.map((item) => (item.id === id ? { ...item, ...p } : item)) });
  const patchTrigger = (id, p) => {
    const current = triggers.find((item) => item.id === id);
    if (!current) return;
    const merged = { ...current, ...p };
    const newTarget = merged.target || 'Secili Nesne';
    const newWhen = merged.when || 'onClick';
    const deduped = triggers.filter(
      (item) =>
        item.id === id ||
        (item.target || 'Secili Nesne') !== newTarget ||
        (item.when || 'onClick') !== newWhen
    );
    patchAct({ triggers: deduped.map((item) => (item.id === id ? { ...item, ...p } : item)) });
  };

  if (!activity)
    return (
      <div
        style={{
          width: 240,
          flexShrink: 0,
          borderLeft: '1px solid #252540',
          background: '#111125',
        }}
      />
    );

  const s10 = {
    fontSize: 11,
    fontWeight: 800,
    color: '#475569',
    marginBottom: 8,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  };
  const card = {
    background: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: 6,
    padding: 10,
    marginBottom: 8,
    boxShadow: '0 1px 3px rgba(0,0,0,.05)',
  };
  const triggerSourceOptions = [
    { value: 'Secili Nesne', label: 'Tiklanan / secili nesne' },
    ...objects.map((obj) => ({ value: obj.id, label: `${obj.label || obj.type} (${obj.type})` })),
  ];
  const triggerTargetOptions = objects.map((obj) => ({
    value: obj.id,
    label: `${obj.label || obj.type} (${obj.type})`,
  }));
  const triggerLayerOptions = layers.map((layer, index) => ({
    value: layer.id,
    label: resolvedLayerNames[layer.id] || `Layer ${index + 1}`,
  }));
  const triggerActivityOptions = [
    { value: '__next__', label: 'Sonraki sahne' },
    ...activities
      .filter((item) => item.id !== activity.id)
      .map((item) => ({ value: item.id, label: item.name })),
  ];

  return (
    <div
      style={{
        width: 280,
        flexShrink: 0,
        borderLeft: '1px solid #d7e0eb',
        background: 'linear-gradient(180deg,#f8fbff,#eef4fb)',
        overflowY: 'auto',
        padding: 12,
      }}
    >
      {/* Seçili nesne özellikleri */}
      {multiSel ? (
        <div style={card}>
          <div style={s10}>SEÇİM</div>
          <div style={{ fontSize: 11, color: '#B0BEC5' }}>{selectedObjectCount} nesne seçildi</div>
          <div style={{ fontSize: 11, color: '#555', marginTop: 4 }}>
            Ok tuşları ile taşıyın · Delete ile silin
          </div>
        </div>
      ) : sel ? (
        <div style={card}>
          <div style={{ ...s10, color: '#111111' }}>{sel.type.toUpperCase()}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Inp
              label="Etiket"
              value={sel.label || ''}
              onChange={(e) => patchObj(sel.id, { label: e.target.value })}
            />
            <div style={{ display: 'flex', gap: 5 }}>
              <Inp
                label="X"
                type="number"
                value={Math.round(sel.x)}
                onChange={(e) => patchObj(sel.id, { x: +e.target.value })}
              />
              <Inp
                label="Y"
                type="number"
                value={Math.round(sel.y)}
                onChange={(e) => patchObj(sel.id, { y: +e.target.value })}
              />
            </div>
            <div style={{ display: 'flex', gap: 5 }}>
              <Inp
                label="G"
                type="number"
                value={Math.round(sel.width)}
                onChange={(e) => patchObj(sel.id, { width: Math.max(20, +e.target.value) })}
              />
              <Inp
                label="Y"
                type="number"
                value={Math.round(sel.height)}
                onChange={(e) => patchObj(sel.id, { height: Math.max(20, +e.target.value) })}
              />
            </div>
            <Inp
              label="Döndür °"
              type="number"
              value={sel.rotation || 0}
              onChange={(e) => patchObj(sel.id, { rotation: +e.target.value })}
            />
            <SelectInp
              label="Layer"
              value={sel.layerId || 'base'}
              onChange={(e) => patchObj(sel.id, { layerId: e.target.value })}
              options={layers.map((layer, index) => ({
                value: layer.id,
                label: resolvedLayerNames[layer.id] || `Layer ${index + 1}`,
              }))}
            />
            {(sel.type === 'draggable' || sel.type === 'dropzone') && (
              <Inp
                label="Grup (eşleştirme)"
                value={sel.group || ''}
                onChange={(e) => patchObj(sel.id, { group: e.target.value })}
                placeholder="A, B, ..."
              />
            )}
            <div>
              <label style={{ fontSize: 11, color: '#78909C', display: 'block', marginBottom: 4 }}>
                Renkler
              </label>
              {(sel.type === 'draggable' || sel.type === 'dropzone') && (
                <div style={{ marginBottom: 6 }}>
                  <label
                    style={{ fontSize: 11, color: '#78909C', display: 'block', marginBottom: 3 }}
                  >
                    Ana renk (kenar+zemin+yazı)
                  </label>
                  <input
                    type="color"
                    value={sel.style?.borderColor || '#2563eb'}
                    onChange={(e) => {
                      const c = e.target.value;
                      const r = parseInt(c.slice(1, 3), 16),
                        g = parseInt(c.slice(3, 5), 16),
                        b = parseInt(c.slice(5, 7), 16);
                      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                      const textColor = lum > 0.55 ? '#1a1a2e' : '#ffffff';
                      const bgHex = `${c}22`;
                      patchObj(sel.id, {
                        style: {
                          ...sel.style,
                          borderColor: c,
                          background: bgHex,
                          color: textColor,
                        },
                      });
                    }}
                    style={{
                      width: 40,
                      height: 28,
                      border: '1px solid #e2e8f0',
                      borderRadius: 6,
                      cursor: 'pointer',
                      padding: 2,
                    }}
                  />
                </div>
              )}
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  type="color"
                  value={sel.style?.color || '#000000'}
                  onChange={(e) =>
                    patchObj(sel.id, { style: { ...sel.style, color: e.target.value } })
                  }
                  style={{
                    width: 28,
                    height: 24,
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                  }}
                />
                <span style={{ fontSize: 11, color: '#78909C' }}>yazı</span>
                <input
                  type="color"
                  value={
                    (sel.style?.background || '#000000')
                      .replace(/[^#0-9a-fA-F]/g, '')
                      .slice(0, 7) || '#000000'
                  }
                  onChange={(e) =>
                    patchObj(sel.id, { style: { ...sel.style, background: e.target.value } })
                  }
                  style={{
                    width: 28,
                    height: 24,
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                  }}
                />
                <span style={{ fontSize: 11, color: '#78909C' }}>zemin</span>
                <input
                  type="color"
                  value={sel.style?.borderColor || '#000000'}
                  onChange={(e) =>
                    patchObj(sel.id, { style: { ...sel.style, borderColor: e.target.value } })
                  }
                  style={{
                    width: 28,
                    height: 24,
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                  }}
                />
                <span style={{ fontSize: 11, color: '#78909C' }}>kenar</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 5 }}>
              <Inp
                label="Font"
                type="number"
                value={sel.style?.fontSize || 14}
                onChange={(e) =>
                  patchObj(sel.id, { style: { ...sel.style, fontSize: +e.target.value } })
                }
              />
              <Inp
                label="Radius"
                type="number"
                value={sel.style?.borderRadius || 0}
                onChange={(e) =>
                  patchObj(sel.id, { style: { ...sel.style, borderRadius: +e.target.value } })
                }
              />
            </div>
            {sel.imageData && (
              <label
                style={{
                  display: 'block',
                  padding: '4px 0',
                  borderRadius: 5,
                  border: '1px solid #4CAF50',
                  background: '#4CAF5022',
                  color: '#4CAF50',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                Resim Değiştir
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(ev) => {
                    const f = ev.target.files[0];
                    if (!f) return;
                    const r = new FileReader();
                    r.onload = (x) => patchObj(sel.id, { imageData: x.target.result });
                    r.readAsDataURL(f);
                    ev.target.value = '';
                  }}
                />
              </label>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 11,
                  color: '#78909C',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={sel.visible !== false}
                  onChange={(e) => patchObj(sel.id, { visible: e.target.checked })}
                  style={{ accentColor: '#4CAF50' }}
                />
                Görünür
              </label>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 11,
                  color: '#78909C',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={!!sel.locked}
                  onChange={(e) => patchObj(sel.id, { locked: e.target.checked })}
                  style={{ accentColor: '#FF9800' }}
                />
                Kilitli
              </label>
            </div>
            {/* ─── Accessibility ─── */}
            <details
              style={{
                marginTop: 6,
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: '0 8px',
              }}
            >
              <summary
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: '#475569',
                  cursor: 'pointer',
                  padding: '6px 0',
                  userSelect: 'none',
                }}
              >
                ♿ Erişilebilirlik
              </summary>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 8 }}>
                <Inp
                  label="Alt Text"
                  value={sel.accessibility?.altText || ''}
                  onChange={(e) =>
                    patchObj(sel.id, {
                      accessibility: { ...(sel.accessibility || {}), altText: e.target.value },
                    })
                  }
                  placeholder="Görsel açıklama..."
                />
                <Inp
                  label="ARIA Label"
                  value={sel.accessibility?.ariaLabel || ''}
                  onChange={(e) =>
                    patchObj(sel.id, {
                      accessibility: { ...(sel.accessibility || {}), ariaLabel: e.target.value },
                    })
                  }
                  placeholder="Ekran okuyucu etiketi"
                />
                <Inp
                  label="Tab Sırası"
                  type="number"
                  value={sel.accessibility?.tabIndex ?? 0}
                  onChange={(e) =>
                    patchObj(sel.id, {
                      accessibility: { ...(sel.accessibility || {}), tabIndex: +e.target.value },
                    })
                  }
                />
                <SelectInp
                  label="ARIA Role"
                  value={sel.accessibility?.role || 'presentation'}
                  onChange={(e) =>
                    patchObj(sel.id, {
                      accessibility: { ...(sel.accessibility || {}), role: e.target.value },
                    })
                  }
                  options={ARIA_ROLE_OPTIONS}
                />
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    fontSize: 11,
                    color: '#78909C',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={!!sel.accessibility?.ariaHidden}
                    onChange={(e) =>
                      patchObj(sel.id, {
                        accessibility: {
                          ...(sel.accessibility || {}),
                          ariaHidden: e.target.checked,
                        },
                      })
                    }
                    style={{ accentColor: '#8b5cf6' }}
                  />
                  Ekran okuyucudan gizle (aria-hidden)
                </label>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    fontSize: 11,
                    color: '#78909C',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={sel.accessibility?.focusable !== false}
                    onChange={(e) =>
                      patchObj(sel.id, {
                        accessibility: {
                          ...(sel.accessibility || {}),
                          focusable: e.target.checked,
                        },
                      })
                    }
                    style={{ accentColor: '#2563eb' }}
                  />
                  Keyboard ile odaklanabilir
                </label>
              </div>
            </details>
            {/* ─── Object States ─── */}
            <details
              style={{
                marginTop: 6,
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: '0 8px',
              }}
            >
              <summary
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: '#475569',
                  cursor: 'pointer',
                  padding: '6px 0',
                  userSelect: 'none',
                }}
              >
                🎭 Nesne Durumları (States)
              </summary>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 8 }}>
                {OBJECT_STATE_OPTIONS.map((st) => {
                  const ss = sel.stateStyles || {};
                  const cur = ss[st.value] || {};
                  const isActive = Object.keys(cur).length > 0;
                  return (
                    <details
                      key={st.value}
                      style={{
                        border: '1px solid ' + (isActive ? '#B388FF' : '#e2e8f0'),
                        borderRadius: 6,
                        padding: '0 6px',
                      }}
                    >
                      <summary
                        style={{
                          fontSize: 11,
                          color: isActive ? '#B388FF' : '#78909C',
                          cursor: 'pointer',
                          padding: '4px 0',
                          userSelect: 'none',
                        }}
                      >
                        {st.label} {isActive && '●'}
                      </summary>
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 4,
                          paddingBottom: 6,
                        }}
                      >
                        <Inp
                          label="Arka Plan"
                          type="color"
                          value={cur.background || sel.background || '#ffffff'}
                          onChange={(e) =>
                            patchObj(sel.id, {
                              stateStyles: {
                                ...ss,
                                [st.value]: { ...cur, background: e.target.value },
                              },
                            })
                          }
                        />
                        <Inp
                          label="Kenarlık Rengi"
                          type="color"
                          value={cur.borderColor || sel.borderColor || '#333333'}
                          onChange={(e) =>
                            patchObj(sel.id, {
                              stateStyles: {
                                ...ss,
                                [st.value]: { ...cur, borderColor: e.target.value },
                              },
                            })
                          }
                        />
                        <Inp
                          label="Metin Rengi"
                          type="color"
                          value={cur.color || sel.color || '#000000'}
                          onChange={(e) =>
                            patchObj(sel.id, {
                              stateStyles: { ...ss, [st.value]: { ...cur, color: e.target.value } },
                            })
                          }
                        />
                        <Inp
                          label="Opaklık"
                          type="number"
                          min={0}
                          max={1}
                          step={0.1}
                          value={cur.opacity ?? 1}
                          onChange={(e) =>
                            patchObj(sel.id, {
                              stateStyles: {
                                ...ss,
                                [st.value]: { ...cur, opacity: +e.target.value },
                              },
                            })
                          }
                        />
                        <Inp
                          label="Ölçek"
                          type="number"
                          min={0.1}
                          max={3}
                          step={0.1}
                          value={cur.scale ?? 1}
                          onChange={(e) =>
                            patchObj(sel.id, {
                              stateStyles: {
                                ...ss,
                                [st.value]: { ...cur, scale: +e.target.value },
                              },
                            })
                          }
                        />
                        {isActive && (
                          <button
                            onClick={() => {
                              const next = { ...ss };
                              delete next[st.value];
                              patchObj(sel.id, { stateStyles: next });
                            }}
                            style={{
                              fontSize: 10,
                              color: '#f87171',
                              background: 'transparent',
                              border: '1px solid #f87171',
                              borderRadius: 4,
                              cursor: 'pointer',
                              padding: '2px 6px',
                              alignSelf: 'flex-end',
                            }}
                          >
                            Sıfırla
                          </button>
                        )}
                      </div>
                    </details>
                  );
                })}
              </div>
            </details>
            {/* ─── Motion Path ─── */}
            <details
              style={{
                marginTop: 6,
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: '0 8px',
              }}
            >
              <summary
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: '#475569',
                  cursor: 'pointer',
                  padding: '6px 0',
                  userSelect: 'none',
                }}
              >
                🔀 Hareket Yolu (Motion Path)
              </summary>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 8 }}>
                <div style={{ fontSize: 10, color: '#94a3b8' }}>
                  Nesnenin takip edeceği yol noktaları (x,y)
                </div>
                {(sel.motionPath || []).map((pt, i) => (
                  <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <span style={{ fontSize: 10, color: '#64748b', width: 16 }}>{i + 1}</span>
                    <Inp
                      label="X"
                      type="number"
                      value={pt.x}
                      onChange={(e) => {
                        const mp = [...(sel.motionPath || [])];
                        mp[i] = { ...mp[i], x: +e.target.value };
                        patchObj(sel.id, { motionPath: mp });
                      }}
                    />
                    <Inp
                      label="Y"
                      type="number"
                      value={pt.y}
                      onChange={(e) => {
                        const mp = [...(sel.motionPath || [])];
                        mp[i] = { ...mp[i], y: +e.target.value };
                        patchObj(sel.id, { motionPath: mp });
                      }}
                    />
                    <button
                      onClick={() => {
                        const mp = (sel.motionPath || []).filter((_, j) => j !== i);
                        patchObj(sel.id, { motionPath: mp });
                      }}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: '#f87171',
                        cursor: 'pointer',
                        fontSize: 14,
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => {
                    const mp = [
                      ...(sel.motionPath || []),
                      { x: sel.x + sel.width / 2, y: sel.y + sel.height / 2 },
                    ];
                    patchObj(sel.id, { motionPath: mp });
                  }}
                  style={{
                    fontSize: 10,
                    color: '#3b82f6',
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: 4,
                    cursor: 'pointer',
                    padding: '3px 8px',
                    alignSelf: 'flex-start',
                  }}
                >
                  + Nokta Ekle
                </button>
                {(sel.motionPath || []).length >= 2 && (
                  <svg
                    viewBox={`0 0 ${sel.width + 100} ${sel.height + 100}`}
                    style={{
                      width: '100%',
                      height: 80,
                      border: '1px solid #e2e8f0',
                      borderRadius: 6,
                      background: '#fafafa',
                    }}
                  >
                    <polyline
                      points={(sel.motionPath || [])
                        .map((p) => `${p.x - sel.x + 50},${p.y - sel.y + 50}`)
                        .join(' ')}
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth="2"
                      strokeDasharray="4 2"
                    />
                    {(sel.motionPath || []).map((p, i) => (
                      <circle
                        key={i}
                        cx={p.x - sel.x + 50}
                        cy={p.y - sel.y + 50}
                        r="4"
                        fill={
                          i === 0
                            ? '#22c55e'
                            : i === (sel.motionPath || []).length - 1
                              ? '#ef4444'
                              : '#3b82f6'
                        }
                      />
                    ))}
                  </svg>
                )}
              </div>
            </details>
          </div>
        </div>
      ) : (
        <div style={{ ...card, textAlign: 'center', color: '#333', fontSize: 11, padding: 16 }}>
          Canvas'tan nesne seçin
          <br />
          veya rubber-band ile çoklu seçim yapın
        </div>
      )}

      <div style={card}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 6,
          }}
        >
          <div style={s10}>LAYERS ({layers.length})</div>
          <button
            onClick={() => {
              const newLayer = createLayer('Katman', layers.length);
              patchAct({ layers: [...layers, newLayer], activeLayerId: newLayer.id });
            }}
            style={{
              background: '#B388FF22',
              border: '1px solid #B388FF',
              color: '#B388FF',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 11,
              padding: '2px 6px',
            }}
          >
            +
          </button>
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            maxHeight: 260,
            overflowY: 'auto',
          }}
        >
          {layers.map((layer) => (
            <div
              key={layer.id}
              onClick={() => patchAct({ activeLayerId: layer.id, selectedObjectId: null })}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 7px',
                borderRadius: 6,
                cursor: 'pointer',
                background: activity.activeLayerId === layer.id ? '#252550' : '#0d0d1a',
                border: `1px solid ${activity.activeLayerId === layer.id ? '#B388FF' : '#252540'}`,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: layer.kind === 'base' ? 2 : '50%',
                  background: layer.kind === 'base' ? '#00BCD4' : '#B388FF',
                  flexShrink: 0,
                }}
              />
              <span style={{ flex: 1, fontSize: 11, color: '#B0BEC5' }}>{layer.name}</span>
              {layer.kind !== 'base' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    patchAct({
                      layers: layers.filter((item) => item.id !== layer.id),
                      activeLayerId:
                        activity.activeLayerId === layer.id ? 'base' : activity.activeLayerId,
                      objects: objects.map((obj) =>
                        obj.layerId === layer.id ? { ...obj, layerId: 'base' } : obj
                      ),
                    });
                  }}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: '#f87171',
                    cursor: 'pointer',
                    fontSize: 11,
                  }}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Katmanlar */}
      <div style={card}>
        <div style={s10}>KATMANLAR ({objects.length})</div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            maxHeight: 180,
            overflowY: 'auto',
          }}
        >
          {getEditorGroupedObjectEntries(
            activity,
            [...objects].sort((a, b) => b.zIndex - a.zIndex)
          ).map(({ primaryId, ids, object: o }) => {
            const isSelected =
              ids.some((id) => selectedIds.has(id)) || activity.selectedObjectId === primaryId;
            return (
              <div
                key={primaryId}
                onClick={() => {
                  onUpdate({ ...activity, selectedObjectId: primaryId });
                }}
                style={{
                  padding: '4px 6px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  background: isSelected ? '#252550' : 'transparent',
                  fontSize: 11,
                  color: '#B0BEC5',
                  display: 'flex',
                  gap: 5,
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: 11, color: '#555', width: 12 }}>{o.zIndex}</span>
                <span
                  style={{
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    opacity: o.visible === false ? 0.45 : 1,
                  }}
                >
                  {o.label || o.type}
                </span>
                {ids.length > 1 && (
                  <span style={{ fontSize: 10, color: '#B388FF', fontWeight: 800 }}>
                    x{ids.length}
                  </span>
                )}
                <button
                  title={o.visible === false ? 'Goster' : 'Gizle'}
                  onClick={(e) => {
                    e.stopPropagation();
                    ids.forEach((id) => patchObj(id, { visible: o.visible === false }));
                  }}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: o.visible === false ? '#555' : '#4CAF50',
                    cursor: 'pointer',
                    fontSize: 11,
                    padding: 0,
                  }}
                >
                  G
                </button>
                <button
                  title={o.locked ? 'Kilidi ac' : 'Kilitle'}
                  onClick={(e) => {
                    e.stopPropagation();
                    ids.forEach((id) => patchObj(id, { locked: !o.locked }));
                  }}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: o.locked ? '#FF9800' : '#555',
                    cursor: 'pointer',
                    fontSize: 11,
                    padding: 0,
                  }}
                >
                  K
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {!hideTimeline && (
        <div style={card}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 6,
            }}
          >
            <div style={s10}>ZAMANÇİZELGESİ</div>
            <button
              onClick={() =>
                patchAct({ timeline: [...timeline, createTimelineItem(timeline.length)] })
              }
              style={{
                background: '#ffffff',
                border: '1px solid #111111',
                color: '#111111',
                borderRadius: 0,
                cursor: 'pointer',
                fontSize: 11,
                padding: '2px 6px',
              }}
            >
              +
            </button>
          </div>
          {timeline.map((item) => (
            <div
              key={item.id}
              style={{
                background: '#ffffff',
                border: '1px solid #111111',
                borderRadius: 0,
                padding: 7,
                marginBottom: 5,
              }}
            >
              <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginBottom: 5 }}>
                <Inp
                  value={item.name}
                  onChange={(e) => patchTimeline(item.id, { name: e.target.value })}
                  placeholder="Animasyon adi"
                />
                <button
                  onClick={() => patchAct({ timeline: timeline.filter((x) => x.id !== item.id) })}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: '#f44336',
                    cursor: 'pointer',
                    fontSize: 12,
                  }}
                >
                  ×
                </button>
              </div>
              <div style={{ display: 'flex', gap: 5 }}>
                <Inp
                  label="Baş"
                  type="number"
                  value={item.start}
                  onChange={(e) => patchTimeline(item.id, { start: +e.target.value || 0 })}
                />
                <Inp
                  label="Süre"
                  type="number"
                  value={item.duration}
                  onChange={(e) => patchTimeline(item.id, { duration: +e.target.value || 0 })}
                />
              </div>
            </div>
          ))}
          {timeline.length === 0 && (
            <div style={{ fontSize: 11, color: '#333', textAlign: 'center' }}>Animasyon yok</div>
          )}
        </div>
      )}

      {/* Tetikleyiciler */}
      <div style={card}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 6,
          }}
        >
          <div style={s10}>TETİKLEYİCİLER</div>
          <button
            onClick={() => {
              const t = createTriggerItem(triggers.length);
              const nt = t.target || 'Secili Nesne';
              const nw = t.when || 'onClick';
              const deduped = triggers.filter(
                (item) => (item.target || 'Secili Nesne') !== nt || (item.when || 'onClick') !== nw
              );
              patchAct({ triggers: [...deduped, t] });
            }}
            style={{
              background: '#00BCD422',
              border: '1px solid #00BCD4',
              color: '#00BCD4',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 11,
              padding: '2px 6px',
            }}
          >
            +
          </button>
        </div>
        {triggers.map((item) => (
          <div
            key={item.id}
            style={{
              background: '#0d0d1a',
              border: '1px solid #252540',
              borderRadius: 6,
              padding: 7,
              marginBottom: 5,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 5,
                marginBottom: 5,
              }}
            >
              <SelectInp
                value={item.when || 'onClick'}
                onChange={(e) => patchTrigger(item.id, { when: e.target.value })}
                options={[
                  { value: 'onClick', label: 'Tıklandığında' },
                  { value: 'onHover', label: 'Üzerine gelince' },
                  { value: 'onDrop', label: 'Bırakılınca' },
                ]}
              />
              <button
                onClick={() => patchAct({ triggers: triggers.filter((x) => x.id !== item.id) })}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#f44336',
                  cursor: 'pointer',
                  fontSize: 12,
                }}
              >
                ×
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <Inp
                label="Ad"
                value={item.name || ''}
                onChange={(e) => patchTrigger(item.id, { name: e.target.value })}
                placeholder="Butonla katman gecisi"
              />
              <SelectInp
                label="Tetikleyen"
                value={item.target || 'Secili Nesne'}
                onChange={(e) => patchTrigger(item.id, { target: e.target.value })}
                options={triggerSourceOptions}
              />
              <SelectInp
                label="Aksiyon"
                value={item.action || 'SayfaGec'}
                onChange={(e) =>
                  patchTrigger(item.id, {
                    action: e.target.value,
                    value:
                      e.target.value === 'KatmanaGec'
                        ? layers[0]?.id || 'base'
                        : e.target.value === 'SayfaGec'
                          ? '__next__'
                          : '',
                  })
                }
                options={[
                  { value: 'SayfaGec', label: 'Sayfaya Geç' },
                  { value: 'KatmanaGec', label: 'Katmana Geç' },
                  { value: 'Goster', label: 'Nesne Göster' },
                  { value: 'Gizle', label: 'Nesne Gizle' },
                  { value: 'SesCal', label: 'Ses Çal' },
                ]}
              />
              {item.action === 'KatmanaGec' ? (
                <SelectInp
                  label="Gidilecek Katman"
                  value={item.value || layers[0]?.id || 'base'}
                  onChange={(e) => patchTrigger(item.id, { value: e.target.value })}
                  options={triggerLayerOptions}
                />
              ) : item.action === 'SayfaGec' ? (
                <SelectInp
                  label="Gidilecek Sahne"
                  value={item.value || '__next__'}
                  onChange={(e) => patchTrigger(item.id, { value: e.target.value })}
                  options={
                    triggerActivityOptions.length
                      ? triggerActivityOptions
                      : [{ value: '__next__', label: 'Sonraki sahne' }]
                  }
                />
              ) : item.action === 'Goster' || item.action === 'Gizle' ? (
                <SelectInp
                  label="Etkilenecek Nesne"
                  value={item.value || ''}
                  onChange={(e) => patchTrigger(item.id, { value: e.target.value })}
                  options={
                    triggerTargetOptions.length
                      ? triggerTargetOptions
                      : [{ value: '', label: 'Nesne bulunamadı' }]
                  }
                />
              ) : (
                <Inp
                  label="Değer"
                  value={item.value || ''}
                  onChange={(e) => patchTrigger(item.id, { value: e.target.value })}
                />
              )}
            </div>
          </div>
        ))}
        {triggers.length === 0 && (
          <div style={{ fontSize: 11, color: '#333', textAlign: 'center' }}>Tetikleyici yok</div>
        )}
      </div>
    </div>
  );
}

export function AnswerFormPanel({ activity, onUpdate }) {
  const patch = (patchValue) => onUpdate({ ...activity, ...patchValue });
  const options = activity.mcOptions || [];
  const selectionUi = getSelectionUi(activity);
  const patchCanvasObject = (id, patchValue) =>
    patch({
      objects: (activity.objects || []).map((item) =>
        item.id === id ? { ...item, ...patchValue } : item
      ),
    });
  const selectionCanvasObjects = getCanvasObjects(activity).filter(canObjectBeSelectionShape);
  const draggables = getCanvasObjects(activity).filter((item) => item.type === 'draggable');
  const dropzones = getCanvasObjects(activity).filter((item) => item.type === 'dropzone');
  const matches = activity.dragDropMatches || {};
  const dragDropSettings = getDragDropSettings(activity);
  const correctOptionCount = options.filter((option) => option.isCorrect).length;
  const matchedCount = draggables.filter(
    (item) => normalizeDragDropMatchValue(matches[item.id]).length
  ).length;
  const addSelectionShape = (shape = 'square') => {
    const existingSelectionObjects = (activity.objects || []).filter(
      (item) => !!item.selectionQuestionId
    );
    const index = existingSelectionObjects.length;
    const choiceLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const questionId = existingSelectionObjects[0]?.selectionQuestionId || 'soru-1';
    const choice = choiceLetters[index] || `secenek-${index + 1}`;
    const object = createShapeObject(shape === 'circle' ? 'ellipse' : 'roundedRect');
    const nextObject = {
      ...object,
      id: uid(),
      label: shape === 'circle' ? `Yuvarlak Seçim ${index + 1}` : `Kare Seçim ${index + 1}`,
      x: 120 + (index % 4) * 86,
      y: 120 + Math.floor(index / 4) * 86,
      width: 64,
      height: 64,
      layerId: activity.activeLayerId || 'base',
      zIndex: (activity.objects || []).length + 1,
      selectionQuestionId: questionId,
      selectionChoice: choice,
      selectionCorrect: false,
      selectionMark: undefined,
      showShapeLabel: false,
      style: {
        ...object.style,
        color: 'transparent',
        background: '#ffffff',
        borderColor: '#2563eb',
        borderStyle: 'solid',
        borderRadius: shape === 'circle' ? 999 : 10,
      },
    };
    const nextObjects = [...(activity.objects || []), nextObject];
    onUpdate({
      ...activity,
      selectionUi: { ...selectionUi, controlShape: shape },
      objects: nextObjects,
      selectedObjectId: nextObject.id,
      timeline: syncTimelineWithObjects({ ...activity, objects: nextObjects }),
    });
  };
  const rowCard = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    borderRadius: 12,
    border: '1px solid #dbe7f5',
    background: '#ffffff',
  };
  const badge = {
    minWidth: 26,
    height: 26,
    borderRadius: 999,
    background: '#eff6ff',
    color: '#1d4ed8',
    border: '1px solid #bfdbfe',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 11,
    fontWeight: 800,
    flexShrink: 0,
  };
  const setCorrectOption = (optionId, checked) => {
    if ((activity.mcMode || 'single') === 'single') {
      patch({
        mcOptions: options.map((option) => ({
          ...option,
          isCorrect: option.id === optionId ? checked : false,
        })),
      });
      return;
    }
    patch({
      mcOptions: options.map((option) =>
        option.id === optionId ? { ...option, isCorrect: checked } : option
      ),
    });
  };
  const setMatch = (dragId, dropId) => {
    patch({
      dragDropMatches: {
        ...matches,
        [dragId]: dropId,
      },
    });
  };
  const toggleMultiMatch = (dragId, dropId, checked) => {
    const current = normalizeDragDropMatchValue(matches[dragId]);
    const next = checked ? [...current, dropId] : current.filter((item) => item !== dropId);
    const uniqueNext = [...new Set(next)];
    patch({
      dragDropMatches: {
        ...matches,
        [dragId]: uniqueNext,
      },
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {(activity.type === 'selection' || activity.type === 'mixed') && (
        <>
          <div
            style={{
              background: 'linear-gradient(180deg,#ffffff,#f8fbff)',
              border: '1px solid rgba(203,213,225,.95)',
              borderRadius: 14,
              padding: 10,
              boxShadow: '0 10px 22px rgba(15,23,42,.05)',
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: '#334155',
                marginBottom: 6,
                letterSpacing: 0.4,
                textTransform: 'uppercase',
              }}
            >
              Secim Kurgusu
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 10, lineHeight: 1.6 }}>
              Tekli veya coklu secimi, secim alaninin kare mi yuvarlak mi olacagini ve icindeki
              isaretin tik mi carpi mi olacagini buradan belirle.
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))',
                gap: 8,
              }}
            >
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: 12,
                  border: '1px solid #dbeafe',
                  background: '#f8fbff',
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 800, color: '#1d4ed8', marginBottom: 8 }}>
                  Secim Tipi
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {[
                    { k: 'single', l: 'Tekli Secim' },
                    { k: 'multi', l: 'Coklu Secim' },
                  ].map((m) => (
                    <button
                      key={m.k}
                      onClick={() => patch({ mcMode: m.k })}
                      style={{
                        minHeight: 30,
                        padding: '0 10px',
                        borderRadius: 10,
                        border: `1px solid ${activity.mcMode === m.k ? '#93c5fd' : '#cbd5e1'}`,
                        background: activity.mcMode === m.k ? '#dbeafe' : '#ffffff',
                        color: activity.mcMode === m.k ? '#1d4ed8' : '#475569',
                        fontSize: 11,
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      {m.l}
                    </button>
                  ))}
                </div>
              </div>
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: 12,
                  border: '1px solid #e2e8f0',
                  background: '#ffffff',
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>
                  Alan Bicimi
                </div>
                <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.45, marginBottom: 8 }}>
                  Tıkla: sahneye seçim alanı ekler.
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {[
                    { k: 'circle', l: 'Yuvarlak' },
                    { k: 'square', l: 'Kare' },
                  ].map((item) => (
                    <button
                      key={item.k}
                      onClick={() => addSelectionShape(item.k)}
                      style={{
                        minHeight: 30,
                        padding: '0 10px',
                        borderRadius: 10,
                        border: `1px solid ${selectionUi.controlShape === item.k ? '#94a3b8' : '#cbd5e1'}`,
                        background: selectionUi.controlShape === item.k ? '#f1f5f9' : '#ffffff',
                        color: '#475569',
                        fontSize: 11,
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      + {item.l}
                    </button>
                  ))}
                </div>
              </div>
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: 12,
                  border: '1px solid #dcfce7',
                  background: '#f0fdf4',
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 800, color: '#15803d', marginBottom: 8 }}>
                  Isaret
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {[
                    { k: 'check', l: 'Tik', glyph: '✓' },
                    { k: 'cross', l: 'Carpi', glyph: '✗' },
                    { k: 'dot', l: 'Buyuk Nokta', glyph: '●' },
                  ].map((item) => (
                    <button
                      key={item.k}
                      onClick={() =>
                        patch({ selectionUi: { ...selectionUi, controlMark: item.k } })
                      }
                      style={{
                        minHeight: 30,
                        padding: '0 10px',
                        borderRadius: 10,
                        border: `1px solid ${selectionUi.controlMark === item.k ? '#86efac' : '#bbf7d0'}`,
                        background: selectionUi.controlMark === item.k ? '#dcfce7' : '#ffffff',
                        color: '#166534',
                        fontSize: 11,
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      {item.glyph} {item.l}
                    </button>
                  ))}
                </div>
              </div>
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: 12,
                  border: '1px solid #fee2e2',
                  background: '#fff7f7',
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 800, color: '#b91c1c', marginBottom: 8 }}>
                  Yanlis Secimde
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {[
                    { k: 'opposite', l: 'Ters Isaret' },
                    { k: 'same', l: 'Ayni Isaret' },
                    { k: 'none', l: 'Bos Kalsin' },
                  ].map((item) => (
                    <button
                      key={item.k}
                      onClick={() =>
                        patch({ selectionUi: { ...selectionUi, wrongMarkMode: item.k } })
                      }
                      style={{
                        minHeight: 30,
                        padding: '0 10px',
                        borderRadius: 10,
                        border: `1px solid ${selectionUi.wrongMarkMode === item.k ? '#fca5a5' : '#fecaca'}`,
                        background: selectionUi.wrongMarkMode === item.k ? '#fee2e2' : '#ffffff',
                        color: '#991b1b',
                        fontSize: 11,
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      {item.l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div
              style={{
                marginTop: 10,
                padding: '10px 12px',
                borderRadius: 12,
                border: '1px solid #e2e8f0',
                background: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: selectionUi.controlShape === 'circle' ? 999 : 8,
                  border: '2px solid #2563eb',
                  background: '#ffffff',
                  color: '#1d4ed8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  fontWeight: 900,
                  flexShrink: 0,
                }}
              >
                {' '}
              </div>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: selectionUi.controlShape === 'circle' ? 999 : 8,
                  border: '2px solid #16a34a',
                  background: '#ecfdf5',
                  color: '#16a34a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  fontWeight: 900,
                  flexShrink: 0,
                }}
              >
                {getSelectionMarkGlyph(selectionUi.controlMark)}
              </div>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: selectionUi.controlShape === 'circle' ? 999 : 8,
                  border: '2px solid #dc2626',
                  background: '#fef2f2',
                  color: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  fontWeight: 900,
                  flexShrink: 0,
                }}
              >
                {resolveWrongSelectionGlyph(selectionUi, selectionUi.controlMark)}
              </div>
              <div style={{ fontSize: 11, color: '#475569', lineHeight: 1.6, minWidth: 180 }}>
                Soldan saga: bos hali, secili dogru hali, secili yanlis hali.
              </div>
            </div>
          </div>

          <div
            style={{
              background: 'linear-gradient(180deg,#ffffff,#f8fbff)',
              border: '1px solid rgba(203,213,225,.95)',
              borderRadius: 14,
              padding: 10,
              boxShadow: '0 10px 22px rgba(15,23,42,.05)',
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: '#334155',
                marginBottom: 6,
                letterSpacing: 0.4,
                textTransform: 'uppercase',
              }}
            >
              Sahne Secim Sekilleri
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 10, lineHeight: 1.6 }}>
              Yukarıdaki <strong>+ Yuvarlak</strong> veya <strong>+ Kare</strong> butonları sahneye
              doğrudan seçim alanı ekler. İstersen sahnedeki mevcut şekil, buton veya metni de
              burada seçim alanına çevirebilirsin. Ayni soruya ait sekillere ayni{' '}
              <strong>Soru Kimligi</strong> yaz.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {selectionCanvasObjects.map((item, index) => {
                const active = !!item.selectionQuestionId;
                const resolvedMark = item.selectionMark || selectionUi.controlMark;
                return (
                  <div
                    key={item.id}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 12,
                      border: `1px solid ${active ? '#93c5fd' : '#dbe7f5'}`,
                      background: active ? '#f8fbff' : '#ffffff',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <div
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: item.type === 'shape' ? 8 : 999,
                          border: '2px solid #94a3b8',
                          background: '#ffffff',
                          color: '#475569',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 12,
                          fontWeight: 900,
                          flexShrink: 0,
                        }}
                      >
                        {' '}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 800,
                            color: '#0f172a',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {item.label || `${item.type} ${index + 1}`}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                          {item.type} nesnesi • kendi sekli korunur • secilince{' '}
                          {getSelectionMarkGlyph(resolvedMark)} gorunur
                        </div>
                      </div>
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 11,
                          color: '#334155',
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={(e) =>
                            patchCanvasObject(
                              item.id,
                              e.target.checked
                                ? {
                                    selectionQuestionId:
                                      item.selectionQuestionId || `soru-${index + 1}`,
                                    selectionChoice:
                                      item.selectionChoice || item.label || `secenek-${index + 1}`,
                                    selectionCorrect:
                                      typeof item.selectionCorrect === 'boolean'
                                        ? item.selectionCorrect
                                        : false,
                                  }
                                : {
                                    selectionQuestionId: '',
                                    selectionChoice: '',
                                    selectionCorrect: null,
                                    selectionMark: undefined,
                                  }
                            )
                          }
                          style={{ accentColor: '#2563eb' }}
                        />
                        Secim alani
                      </label>
                    </div>
                    {active && (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr 110px auto',
                          gap: 8,
                          alignItems: 'end',
                        }}
                      >
                        <Inp
                          label="Soru Kimligi"
                          value={item.selectionQuestionId || ''}
                          onChange={(e) =>
                            patchCanvasObject(item.id, { selectionQuestionId: e.target.value })
                          }
                          placeholder="soru-1"
                        />
                        <Inp
                          label="Secenek Kodu"
                          value={item.selectionChoice || ''}
                          onChange={(e) =>
                            patchCanvasObject(item.id, { selectionChoice: e.target.value })
                          }
                          placeholder="A / B / D / Y"
                        />
                        <SelectInp
                          label="Isaret"
                          value={item.selectionMark || 'global'}
                          onChange={(e) =>
                            patchCanvasObject(item.id, {
                              selectionMark:
                                e.target.value === 'global' ? undefined : e.target.value,
                            })
                          }
                          options={[
                            {
                              value: 'global',
                              label: `Genel (${selectionUi.controlMark === 'check' ? 'Tik' : selectionUi.controlMark === 'cross' ? 'Carpi' : 'Buyuk Nokta'})`,
                            },
                            { value: 'check', label: 'Tik' },
                            { value: 'cross', label: 'Carpi' },
                            { value: 'dot', label: 'Buyuk Nokta' },
                          ]}
                        />
                        <label
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            minHeight: 34,
                            fontSize: 11,
                            color: '#334155',
                            cursor: 'pointer',
                            paddingBottom: 2,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={!!item.selectionCorrect}
                            onChange={(e) =>
                              patchCanvasObject(item.id, { selectionCorrect: e.target.checked })
                            }
                            style={{ accentColor: '#16a34a' }}
                          />
                          Dogru cevap
                        </label>
                      </div>
                    )}
                  </div>
                );
              })}
              {selectionCanvasObjects.length === 0 && (
                <div
                  style={{ fontSize: 11, color: '#64748b', textAlign: 'center', padding: '10px 0' }}
                >
                  Henüz seçim alanı yok. Yukarıdan + Yuvarlak veya + Kare ile hemen ekleyebilirsin.
                </div>
              )}
            </div>
          </div>

          <div
            style={{
              background: 'linear-gradient(180deg,#ffffff,#f8fbff)',
              border: '1px solid rgba(203,213,225,.95)',
              borderRadius: 14,
              padding: 10,
              boxShadow: '0 10px 22px rgba(15,23,42,.05)',
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: '#334155',
                marginBottom: 6,
                letterSpacing: 0.4,
                textTransform: 'uppercase',
              }}
            >
              Dogru Secenek Formu
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8, lineHeight: 1.55 }}>
              {(activity.mcQuestion || 'Soru metni yok.').trim()}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              <div
                style={{
                  padding: '4px 8px',
                  borderRadius: 999,
                  background: '#eff6ff',
                  color: '#1d4ed8',
                  fontSize: 11,
                  fontWeight: 800,
                  border: '1px solid #bfdbfe',
                }}
              >
                {(activity.mcMode || 'single') === 'multi' ? 'Coklu dogru' : 'Tek dogru'}
              </div>
              <div
                style={{
                  padding: '4px 8px',
                  borderRadius: 999,
                  background: '#f8fafc',
                  color: '#475569',
                  fontSize: 11,
                  fontWeight: 700,
                  border: '1px solid #e2e8f0',
                }}
              >
                {correctOptionCount} dogru secili
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {options.map((option, index) => (
                <label
                  key={option.id}
                  style={{
                    ...rowCard,
                    cursor: 'pointer',
                    borderColor: option.isCorrect ? '#86efac' : '#dbe7f5',
                    background: option.isCorrect
                      ? 'linear-gradient(180deg,#f0fdf4,#ffffff)'
                      : '#ffffff',
                  }}
                >
                  <div
                    style={{
                      ...badge,
                      borderRadius: selectionUi.controlShape === 'circle' ? 999 : 8,
                    }}
                  >
                    {option.isCorrect ? getSelectionMarkGlyph(selectionUi.controlMark) : index + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#0f172a',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {option.label || `Secenek ${index + 1}`}
                    </div>
                  </div>
                  <input
                    type={(activity.mcMode || 'single') === 'multi' ? 'checkbox' : 'radio'}
                    name={`answer-form-${activity.id}`}
                    checked={!!option.isCorrect}
                    onChange={(e) => setCorrectOption(option.id, e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: '#16a34a', flexShrink: 0 }}
                  />
                </label>
              ))}
              {options.length === 0 && (
                <div
                  style={{ fontSize: 11, color: '#64748b', textAlign: 'center', padding: '10px 0' }}
                >
                  Henüz seçenek yok.
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {(activity.type === 'drag-drop' || activity.type === 'mixed') && (
        <>
          <div
            style={{
              background: 'linear-gradient(180deg,#ffffff,#f8fbff)',
              border: '1px solid rgba(203,213,225,.95)',
              borderRadius: 14,
              padding: 10,
              boxShadow: '0 10px 22px rgba(15,23,42,.05)',
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: '#334155',
                marginBottom: 6,
                letterSpacing: 0.4,
                textTransform: 'uppercase',
              }}
            >
              Surukle-Birak Kurgusu
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 10, lineHeight: 1.6 }}>
              Soru grubu, grup, kapasite, coklu hedef ve davranis kurallarini buradan yonet. Tek tek
              oge boyutlari ise sagdaki <strong>Nesne</strong> sekmesinde kalir.
            </div>
            <DragDropConfigPanel activity={activity} onUpdate={onUpdate} showMatchEditor={false} />
          </div>

          <div
            style={{
              background: 'linear-gradient(180deg,#ffffff,#f8fbff)',
              border: '1px solid rgba(203,213,225,.95)',
              borderRadius: 14,
              padding: 10,
              boxShadow: '0 10px 22px rgba(15,23,42,.05)',
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: '#334155',
                marginBottom: 6,
                letterSpacing: 0.4,
                textTransform: 'uppercase',
              }}
            >
              Dogru Eslesme Formu
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 10, lineHeight: 1.6 }}>
              Burasi gercek cevap alanidir. Her surukle icin dogru birak alanini burada secersin.
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              <button
                onClick={() => patch({ dragDropMatches: {} })}
                style={{
                  minHeight: 28,
                  padding: '0 10px',
                  borderRadius: 10,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Temizle
              </button>
              <div
                style={{
                  padding: '4px 8px',
                  borderRadius: 999,
                  background: '#fff7ed',
                  color: '#c2410c',
                  fontSize: 11,
                  fontWeight: 700,
                  border: '1px solid #fed7aa',
                }}
              >
                {matchedCount}/{draggables.length} eslesme
              </div>
              <div
                style={{
                  padding: '4px 8px',
                  borderRadius: 999,
                  background: '#eff6ff',
                  color: '#1d4ed8',
                  fontSize: 11,
                  fontWeight: 700,
                  border: '1px solid #bfdbfe',
                }}
              >
                {dragDropSettings.isolateScopes ? 'Grup korumali' : 'Serbest'}
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 10,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 800, color: '#334155' }}>
                Ayni dropzone dizilim
              </div>
              {[
                { id: 'stack', label: 'Ust Uste' },
                { id: 'row', label: 'Satir' },
                { id: 'grid', label: 'Izgara' },
              ].map((mode) => (
                <button
                  key={mode.id}
                  onClick={() =>
                    patch({
                      dragDropSettings: { ...dragDropSettings, answerPlacementLayout: mode.id },
                    })
                  }
                  style={{
                    minHeight: 28,
                    padding: '0 10px',
                    borderRadius: 10,
                    border: `1px solid ${(dragDropSettings.answerPlacementLayout || 'stack') === mode.id ? '#93c5fd' : '#cbd5e1'}`,
                    background:
                      (dragDropSettings.answerPlacementLayout || 'stack') === mode.id
                        ? '#dbeafe'
                        : '#ffffff',
                    color:
                      (dragDropSettings.answerPlacementLayout || 'stack') === mode.id
                        ? '#1d4ed8'
                        : '#475569',
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  {mode.label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {draggables.map((drag, index) => (
                <div
                  key={drag.id}
                  style={{ ...rowCard, cursor: 'pointer', alignItems: 'flex-start' }}
                >
                  <div
                    style={{
                      ...badge,
                      background: '#eff6ff',
                      color: '#1d4ed8',
                      borderColor: '#bfdbfe',
                    }}
                  >
                    {index + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#0f172a',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {drag.label || `Surukle ${index + 1}`}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                      {drag.scope && (
                        <span
                          style={{
                            padding: '3px 6px',
                            borderRadius: 999,
                            background: '#f8fafc',
                            color: '#475569',
                            border: '1px solid #e2e8f0',
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          Soru Grubu: {drag.scope}
                        </span>
                      )}
                      {(drag.allowMultipleTargets ||
                        dragDropSettings.allowMultipleTargetsPerDrag) && (
                        <span
                          style={{
                            padding: '3px 6px',
                            borderRadius: 999,
                            background: '#ecfdf5',
                            color: '#15803d',
                            border: '1px solid #86efac',
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          Coklu hedef
                        </span>
                      )}
                    </div>
                    {drag.allowMultipleTargets || dragDropSettings.allowMultipleTargetsPerDrag ? (
                      <div
                        style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}
                      >
                        {dropzones
                          .filter((drop) => areDragDropScopesCompatible(activity, drag, drop))
                          .map((drop, dropIndex) => {
                            const checked = normalizeDragDropMatchValue(matches[drag.id]).includes(
                              drop.id
                            );
                            return (
                              <label
                                key={drop.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 8,
                                  fontSize: 11,
                                  color: '#334155',
                                  cursor: 'pointer',
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) =>
                                    toggleMultiMatch(drag.id, drop.id, e.target.checked)
                                  }
                                  style={{ accentColor: '#0ea5e9' }}
                                />
                                <span>{drop.label || `Birak ${dropIndex + 1}`}</span>
                                {drop.scope && (
                                  <span style={{ fontSize: 11, color: '#64748b' }}>
                                    ({drop.scope})
                                  </span>
                                )}
                              </label>
                            );
                          })}
                        {dropzones.filter((drop) =>
                          areDragDropScopesCompatible(activity, drag, drop)
                        ).length === 0 && (
                          <div style={{ fontSize: 11, color: '#94a3b8' }}>
                            Bu surukleme icin uyumlu birak alani yok.
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                  {!(drag.allowMultipleTargets || dragDropSettings.allowMultipleTargetsPerDrag) && (
                    <select
                      value={normalizeDragDropMatchValue(matches[drag.id])[0] || ''}
                      onChange={(e) => setMatch(drag.id, e.target.value)}
                      style={{
                        width: 146,
                        padding: '5px 8px',
                        borderRadius: 8,
                        border: `1px solid ${normalizeDragDropMatchValue(matches[drag.id]).length ? '#fdba74' : '#cbd5e1'}`,
                        background: '#ffffff',
                        color: normalizeDragDropMatchValue(matches[drag.id]).length
                          ? '#c2410c'
                          : '#475569',
                        fontSize: 11,
                        outline: 'none',
                      }}
                    >
                      <option value="">Birak sec</option>
                      {dropzones
                        .filter((drop) => areDragDropScopesCompatible(activity, drag, drop))
                        .map((drop, dropIndex) => (
                          <option key={drop.id} value={drop.id}>
                            {drop.label || `Birak ${dropIndex + 1}`}
                          </option>
                        ))}
                    </select>
                  )}
                </div>
              ))}
              {draggables.length === 0 && (
                <div
                  style={{ fontSize: 11, color: '#64748b', textAlign: 'center', padding: '10px 0' }}
                >
                  Henüz sürüklenebilir öğe yok.
                </div>
              )}
              {draggables.length > 0 && dropzones.length === 0 && (
                <div
                  style={{ fontSize: 11, color: '#64748b', textAlign: 'center', paddingBottom: 6 }}
                >
                  Önce bırakma alanı ekleyin.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function RightInspectorPhase2({
  activity,
  onUpdate,
  selectedIds,
  onSelectionChange = () => {},
  hideTimeline = false,
  activities = [],
  variables = [],
  onVariablesChange = () => {},
  mobile = false,
  uiMode = 'advanced',
  activeTab = 'sahne',
  onOpenAnswerCenter = () => {},
  onOpenTextStudioWindow = () => {},
  layerPresets = [],
  onSaveLayerPreset = () => '',
  onApplyLayerPreset = () => {},
  showBaseLayer = true,
  onShowBaseLayerChange = () => {},
  bookDefaultStylePresetId = DEFAULT_ANSWER_LAYER_STYLE_PRESET_ID,
  onSetBookDefaultStylePreset = null,
  forcedInspectorTab = '',
  hideInspectorTabs = false,
  hideLayerManagement = false,
  workspaceTitle = '',
  scenePanelMode = 'all',
}) {
  const [presetGradeFilter, setPresetGradeFilter] = useState('all');
  const safeActivity = useMemo(
    () =>
      activity || {
        objects: [],
        timeline: [],
        triggers: [],
        selectedObjectId: null,
        activeLayerId: 'base',
        name: '',
      },
    [activity]
  );
  const objects = useMemo(() => safeActivity.objects || [], [safeActivity.objects]);
  const layers = getActivityLayers(safeActivity);
  const resolvedLayerNames = useMemo(
    () => buildResolvedLayerNameMap(layers, safeActivity),
    [safeActivity, layers]
  );
  const timeline = safeActivity.timeline || [];
  const triggers = useMemo(() => safeActivity.triggers || [], [safeActivity]);
  const rawSelectedObjectId = safeActivity.selectedObjectId || '';
  const resolvedSelectedObjectId =
    selectedIds.size === 1 && selectedIds.has(rawSelectedObjectId)
      ? rawSelectedObjectId
      : getEditorPrimaryObjectId(safeActivity, rawSelectedObjectId);
  const sel = objects.find((o) => o.id === resolvedSelectedObjectId) || null;
  const groupedSelectedIds = useMemo(
    () =>
      new Set(
        selectedIds.size === 1
          ? [...selectedIds].filter(Boolean)
          : [...selectedIds].map((id) => getEditorPrimaryObjectId(safeActivity, id)).filter(Boolean)
      ),
    [safeActivity, selectedIds]
  );
  const multiSel = groupedSelectedIds.size > 1;
  const selectedObjectCount = groupedSelectedIds.size;
  const selectedObjects = objects.filter((o) => groupedSelectedIds.has(o.id));
  const selectionBounds = getObjectSelectionBounds(selectedObjects);

  const patchAct = useCallback(
    (p) => {
      if (!activity) return;
      onUpdate({ ...safeActivity, ...p });
    },
    [activity, onUpdate, safeActivity]
  );
  const patchObj = useCallback(
    (id, p, options = {}) => {
      if (!activity) return;
      onUpdate(updateActivityObject(safeActivity, id, p, options));
    },
    [activity, onUpdate, safeActivity]
  );
  const patchTimeline = (id, p) =>
    patchAct({ timeline: timeline.map((item) => (item.id === id ? { ...item, ...p } : item)) });
  const patchTrigger = (id, p) => {
    const current = triggers.find((item) => item.id === id);
    if (!current) return;
    const merged = { ...current, ...p };
    const newTarget = merged.target || 'Secili Nesne';
    const newWhen = merged.when || 'onClick';
    const deduped = triggers.filter(
      (item) =>
        item.id === id ||
        (item.target || 'Secili Nesne') !== newTarget ||
        (item.when || 'onClick') !== newWhen
    );
    patchAct({ triggers: deduped.map((item) => (item.id === id ? { ...item, ...p } : item)) });
  };
  const patchTriggerConditions = (triggerId, updater) => {
    const currentTrigger = triggers.find((item) => item.id === triggerId);
    if (!currentTrigger) return;
    const currentConditions = currentTrigger.conditions || [];
    const nextConditions = typeof updater === 'function' ? updater(currentConditions) : updater;
    patchTrigger(triggerId, { conditions: nextConditions });
  };
  const patchVariables = (updater) =>
    onVariablesChange(typeof updater === 'function' ? updater(variables) : updater);
  const resolvePickerColor = (value, fallback = '#111111') => {
    const match = String(value || '').match(/#[0-9a-fA-F]{6}/);
    return match ? match[0] : fallback;
  };
  const patchSelectedObjects = (patch = {}, stylePatch = null) => {
    if (!selectedObjects.length) return;
    const selectedTypeSet = new Set(selectedObjects.map((item) => item.type));
    const hasDragDropPatch =
      (Object.prototype.hasOwnProperty.call(patch, 'width') ||
        Object.prototype.hasOwnProperty.call(patch, 'height') ||
        !!stylePatch) &&
      [...selectedTypeSet].some((type) => type === 'draggable' || type === 'dropzone');
    const nextDragDropDefaults = hasDragDropPatch ? getActivityDragDropDefaults(activity) : null;

    const nextObjects = objects.map((item) => {
      if (!selectedIds.has(item.id)) return item;
      const nextItem = { ...item, ...patch };
      if (stylePatch) {
        nextItem.style =
          item.type === 'draggable' || item.type === 'dropzone'
            ? upgradeDragDropStyle(item.type, { ...(item.style || {}), ...stylePatch })
            : { ...(item.style || {}), ...stylePatch };
      }
      if (nextDragDropDefaults && (item.type === 'draggable' || item.type === 'dropzone')) {
        const baseDefaults = nextDragDropDefaults[item.type];
        nextDragDropDefaults[item.type] = {
          width: Object.prototype.hasOwnProperty.call(patch, 'width')
            ? nextItem.width
            : baseDefaults.width,
          height: Object.prototype.hasOwnProperty.call(patch, 'height')
            ? nextItem.height
            : baseDefaults.height,
          style: stylePatch ? { ...nextItem.style } : baseDefaults.style,
        };
      }
      if (isGeneratedAnswerTemplateObject(item)) {
        delete nextItem.generatedBy;
        nextItem.userEditedTemplate = true;
      }
      return nextItem;
    });

    onUpdate({
      ...activity,
      objects: nextObjects,
      ...(nextDragDropDefaults ? { dragDropDefaults: nextDragDropDefaults } : {}),
    });
  };

  const s10 = {
    fontSize: 11,
    fontWeight: 800,
    color: '#334155',
    marginBottom: 6,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  };
  const card = {
    background: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: 6,
    padding: 10,
    marginBottom: 8,
    boxShadow: '0 1px 3px rgba(0,0,0,.05)',
  };
  const tx = contentText(safeActivity);
  const triggerSourceOptions = [
    { value: 'Secili Nesne', label: 'Tiklanan / secili nesne' },
    { value: '__activity__', label: 'Sahne / yukleme' },
    ...objects.map((obj) => ({ value: obj.id, label: `${obj.label || obj.type} (${obj.type})` })),
  ];
  const triggerTargetOptions = objects.map((obj) => ({
    value: obj.id,
    label: `${obj.label || obj.type} (${obj.type})`,
  }));
  const triggerMediaOptions = objects
    .filter((obj) => obj.type === 'audio' || obj.type === 'video')
    .map((obj) => ({
      value: obj.id,
      label: `${obj.label || obj.mediaName || obj.type} (${obj.type === 'audio' ? 'ses' : 'video'})`,
    }));
  const triggerLayerOptions = layers.map((layer, index) => ({
    value: layer.id,
    label: resolvedLayerNames[layer.id] || `Layer ${index + 1}`,
  }));
  const triggerActivityOptions = [
    { value: '__next__', label: 'Sonraki sahne' },
    ...activities
      .filter((item) => item.id !== activity.id)
      .map((item) => ({ value: item.id, label: item.name })),
  ];
  const triggerSlideOptions = [
    { value: '__next__', label: 'Sonraki slider' },
    { value: '__prev__', label: 'Onceki slider' },
    ...getActivitySlides(activity).map((slide, index) => ({
      value: slide.id,
      label: `${index + 1}. ${slide.name || `Slider ${index + 1}`}`,
    })),
  ];
  const startSlideOptions = getActivitySlides(activity).map((slide, index) => ({
    value: slide.id,
    label: `${index + 1}. ${slide.name || `Slider ${index + 1}`}`,
  }));
  const variableOptions = variables.map((variable) => ({
    value: variable.id,
    label: `${variable.name} (${variable.type})`,
  }));
  const objectStateOptions = objects.map((obj) => ({
    value: obj.id,
    label: `${obj.label || obj.type} (${obj.type})`,
  }));
  const triggerModeOptions = [
    { value: 'all', label: 'Tumu' },
    { value: 'any', label: 'Biri' },
  ];
  const boolOptions = [
    { value: 'true', label: 'True' },
    { value: 'false', label: 'False' },
  ];
  const getObjectClickTaskTargetIds = useCallback(
    (object = {}) => {
      if (!object?.id) return [];
      const ids = [object.id, object.linkedActionTargetId].filter(Boolean);
      const group = String(object.linkedHoverGroup || '').trim();
      if (group) {
        objects
          .filter((item) => String(item.linkedHoverGroup || '').trim() === group)
          .forEach((item) => ids.push(item.id));
      }
      return [...new Set(ids.filter(Boolean))];
    },
    [objects]
  );
  const getObjectClickTaskCanonicalTargetId = useCallback(
    (object = {}) => {
      if (!object?.id) return '';
      if (object.linkedActionTargetId) return object.linkedActionTargetId;
      const group = String(object.linkedHoverGroup || '').trim();
      if (!group) return object.id;
      const candidates = objects.filter(
        (item) => String(item.linkedHoverGroup || '').trim() === group
      );
      const labelCandidate =
        candidates.find((item) => String(item.sceneTemplateSlotId || '').endsWith('-label')) ||
        candidates.find((item) => String(item.soundIconMode || '') === 'external') ||
        candidates.find((item) => Number(item.width || 0) >= Number(object.width || 0));
      return labelCandidate?.id || object.id;
    },
    [objects]
  );
  const objectQuickJumpTrigger = useMemo(() => {
    if (!sel) return null;
    const targetIds = getObjectClickTaskTargetIds(sel);
    return (
      triggers.find(
        (item) =>
          item?.when === 'onClick' &&
          targetIds.includes(item?.target) &&
          (item?.action === 'KatmanaGec' ||
            item?.action === 'SliderGec' ||
            item?.action === 'SayfaGec')
      ) || null
    );
  }, [getObjectClickTaskTargetIds, sel, triggers]);
  const objectQuickJumpAction =
    objectQuickJumpTrigger?.action === 'KatmanaGec' &&
    objectQuickJumpTrigger?.value === 'base' &&
    (sel?.layerId || 'base') !== 'base'
      ? 'close-layer'
      : objectQuickJumpTrigger?.action || 'none';
  const objectQuickJumpValue = objectQuickJumpTrigger?.value || '';
  const objectClickTaskAction = sel?.isCheckButton
    ? 'check'
    : sel?.runtimeAction
      ? `runtime:${sel.runtimeAction}`
      : objectQuickJumpAction;
  const setObjectClickTask = useCallback(
    (action, value = '') => {
      if (!sel) return;
      const clickTargetIds = getObjectClickTaskTargetIds(sel);
      const canonicalTargetId = getObjectClickTaskCanonicalTargetId(sel) || sel.id;
      const findQuickJump = (item) =>
        item?.when === 'onClick' &&
        clickTargetIds.includes(item?.target) &&
        (item?.action === 'KatmanaGec' ||
          item?.action === 'SliderGec' ||
          item?.action === 'SayfaGec');
      const objectPatch = { isCheckButton: false, runtimeAction: '' };
      let nextTriggers = triggers.filter((item) => !findQuickJump(item));

      if (action === 'check') {
        objectPatch.isCheckButton = true;
      } else if (String(action).startsWith('runtime:')) {
        objectPatch.runtimeAction = String(action).slice('runtime:'.length);
      } else if (action !== 'none') {
        const resolvedAction = action === 'close-layer' ? 'KatmanaGec' : action;
        const fallbackValue =
          resolvedAction === 'KatmanaGec'
            ? safeActivity.activeLayerId || layers[0]?.id || 'base'
            : '__next__';
        const resolvedValue =
          action === 'close-layer'
            ? 'base'
            : String(value || objectQuickJumpValue || fallbackValue);
        nextTriggers = [
          ...nextTriggers,
          {
            ...createTriggerItem(nextTriggers.length),
            when: 'onClick',
            target: canonicalTargetId,
            action: resolvedAction,
            value: resolvedValue,
            name: `${sel.label || sel.type} tiklama gecisi`,
            extra: '',
          },
        ];
      }

      const nextObjects = objects.map((item) =>
        item.id === sel.id ? { ...item, ...objectPatch } : item
      );
      patchAct({
        objects: nextObjects,
        triggers: nextTriggers,
        timeline: syncTimelineWithObjects({ ...safeActivity, objects: nextObjects }),
      });
    },
    [
      getObjectClickTaskCanonicalTargetId,
      getObjectClickTaskTargetIds,
      layers,
      objectQuickJumpValue,
      objects,
      patchAct,
      safeActivity,
      sel,
      triggers,
    ]
  );
  const readyButtonPresets = useMemo(
    () => [
      {
        id: 'check',
        icon: '✓',
        label: tx.check,
        width: 330,
        tone: 'success',
        runtimeAction: '',
        isCheckButton: true,
      },
      { id: 'menu', icon: '☰', label: tx.menu, width: 240, tone: 'info', runtimeAction: 'help' },
      {
        id: 'prev',
        icon: '≪',
        label: tx.prev,
        width: 240,
        tone: 'primary',
        trigger: { action: 'SliderGec', value: '__prev__' },
      },
      {
        id: 'next',
        icon: '≫',
        label: tx.next,
        width: 240,
        tone: 'primary',
        trigger: { action: 'SliderGec', value: '__next__' },
      },
      {
        id: 'playpause',
        icon: '▶',
        label: tx.playPause,
        width: 300,
        tone: 'warning',
        runtimeAction: 'toggle-play-pause',
        playIcon: '▶',
        pauseIcon: '❚❚',
      },
      {
        id: 'mute',
        icon: '🔊',
        label: tx.soundOff,
        width: 300,
        tone: 'neutral',
        runtimeAction: 'toggle-mute',
        soundOnLabel: tx.soundOn,
        soundOffLabel: tx.soundOff,
        soundOnIcon: '🔇',
        soundOffIcon: '🔊',
      },
      {
        id: 'answer',
        icon: '✎',
        label: tx.answer,
        width: 330,
        tone: 'success',
        runtimeAction: 'show-answer',
      },
      {
        id: 'restart',
        icon: '↻',
        label: tx.restart,
        width: 350,
        tone: 'danger',
        runtimeAction: 'restart',
      },
      {
        id: 'complete',
        icon: '✓',
        label: tx.closeActivity,
        width: 350,
        tone: 'success',
        runtimeAction: 'complete',
      },
    ],
    [tx]
  );
  const addReadyButton = useCallback(
    (kind) => {
      if (!activity) return;
      const preset = readyButtonPresets.find((item) => item.id === kind) || readyButtonPresets[0];
      const stageWidth = Number(safeActivity.stageWidth || 1920) || 1920;
      const stageHeight = Number(safeActivity.stageHeight || 1080) || 1080;
      const existingCount = objects.filter((item) => item.type === 'button').length;
      const offset = Math.min(existingCount * 18, 120);
      const tone = preset.tone || 'primary';
      const stylePreset = getAnswerLayerStylePresetById(
        safeActivity.answerLayerStylePresetId ||
          bookDefaultStylePresetId ||
          DEFAULT_ANSWER_LAYER_STYLE_PRESET_ID
      );
      const motion = stylePreset?.motion || {};
      const topZIndex = objects.reduce((max, item) => Math.max(max, Number(item.zIndex) || 0), 0);
      const groupId = `ready:${preset.id}:${uid()}`;
      const totalWidth = Number(preset.width || 300);
      const height = Number(preset.height || 64);
      const iconWidth = Math.min(94, Math.max(62, Math.round(height * 1.28)));
      const iconLabelGap = 12;
      const labelWidth = Math.max(120, totalWidth - iconWidth - iconLabelGap);
      const x = Math.max(24, Math.round(stageWidth - totalWidth - 90 - offset));
      const y = Math.max(24, Math.round(stageHeight - 170 - offset));
      const makeReadyButton = (patch = {}) => {
        const baseButton = createObjectFromActivity(safeActivity, 'button');
        const label = String(patch.label || '').toUpperCase();
        return {
          ...baseButton,
          label,
          x: patch.x,
          y,
          width: patch.width,
          height,
          layerId: safeActivity.activeLayerId || 'base',
          zIndex: patch.zIndex,
          readyButtonPresetId: preset.id,
          readyButtonTone: tone,
          isCheckButton: !!preset.isCheckButton,
          runtimeAction: preset.runtimeAction || '',
          soundOnLabel: preset.soundOnLabel || '',
          soundOffLabel: preset.soundOffLabel || '',
          soundOnIcon: preset.soundOnIcon || '',
          soundOffIcon: preset.soundOffIcon || '',
          soundIconMode: patch.soundIconMode || '',
          playIcon: preset.playIcon || '',
          pauseIcon: preset.pauseIcon || '',
          linkedHoverGroup: groupId,
          style: {
            ...(baseButton.style || {}),
            ...buildReadyButtonStyle(stylePreset, tone, {
              ...baseButton,
              readyButtonPresetId: preset.id,
              runtimeAction: preset.runtimeAction || '',
              label,
            }),
            fontSize: patch.fontSize,
            lineHeight: patch.lineHeight || 1.1,
            padding: 0,
          },
          ...(motion ? { buttonMotion: { ...motion } } : {}),
          ...(patch.sceneTemplateSlotId ? { sceneTemplateSlotId: patch.sceneTemplateSlotId } : {}),
        };
      };
      const iconObject = makeReadyButton({
        label: getButtonPairSemanticIcon(
          { label: preset.icon || '?', runtimeAction: preset.runtimeAction },
          { label: preset.label, runtimeAction: preset.runtimeAction }
        ),
        x: Math.max(24, Math.round(stageWidth - 420 - offset)),
        width: iconWidth,
        zIndex: topZIndex + 1,
        fontSize: EDUCATION_BUTTON_ICON_SIZE,
        lineHeight: 1,
        soundIconMode: preset.id === 'mute' ? 'icon-only' : '',
        sceneTemplateSlotId: `ready-button:${preset.id}-icon`,
      });
      iconObject.x = x;
      iconObject.style = {
        ...(iconObject.style || {}),
        borderRadius: 999,
        fontSize: EDUCATION_BUTTON_ICON_SIZE,
        padding: 0,
        textAlign: 'center',
        whiteSpace: 'nowrap',
      };
      const labelObject = makeReadyButton({
        label: preset.label,
        x: x + iconWidth + iconLabelGap,
        width: labelWidth,
        zIndex: topZIndex + 2,
        fontSize: EDUCATION_BUTTON_TEXT_SIZE_SMALL,
        soundIconMode: preset.id === 'mute' ? 'external' : '',
        sceneTemplateSlotId: `ready-button:${preset.id}-label`,
      });
      labelObject.style = {
        ...(labelObject.style || {}),
        fontSize: EDUCATION_BUTTON_TEXT_SIZE_SMALL,
        paddingLeft: 0,
        whiteSpace: 'nowrap',
      };
      iconObject.linkedActionTargetId = labelObject.id;
      labelObject.linkedActionTargetId = labelObject.id;
      const nextTriggers = preset.trigger
        ? [
            ...triggers,
            {
              ...createTriggerItem(triggers.length),
              when: 'onClick',
              target: labelObject.id,
              action: preset.trigger.action,
              value: preset.trigger.value,
              name: `${preset.label} tiklama gorevi`,
            },
          ]
        : triggers;
      const nextObjects = [...objects, iconObject, labelObject];
      patchAct({
        objects: nextObjects,
        triggers: nextTriggers,
        selectedObjectId: labelObject.id,
        activeLayerId: labelObject.layerId,
        timeline: syncTimelineWithObjects({ ...safeActivity, objects: nextObjects }),
      });
      onSelectionChange(new Set([iconObject.id, labelObject.id]));
    },
    [
      activity,
      bookDefaultStylePresetId,
      objects,
      onSelectionChange,
      patchAct,
      readyButtonPresets,
      safeActivity,
      triggers,
    ]
  );
  const getOptionLabel = (options = [], value = '', fallback = '') =>
    options.find((option) => option.value === value)?.label || fallback || value || '-';
  const getTriggerValueLabel = (item = {}) => {
    if (item.action === 'KatmanaGec')
      return getOptionLabel(triggerLayerOptions, item.value, 'Katman sec');
    if (item.action === 'SliderGec')
      return getOptionLabel(triggerSlideOptions, item.value, 'Slider sec');
    if (item.action === 'SayfaGec')
      return getOptionLabel(triggerActivityOptions, item.value, 'Sahne sec');
    if (item.action === 'Goster' || item.action === 'Gizle')
      return getOptionLabel(triggerTargetOptions, item.value, 'Nesne sec');
    if (
      item.action === 'DegiskenAta' ||
      item.action === 'DegiskenArttir' ||
      item.action === 'DegiskenAzalt'
    )
      return getOptionLabel(variableOptions, item.value, 'Degisken sec');
    if (item.action === 'NesneDurumuAyarla')
      return getOptionLabel(objectStateOptions, item.value, 'Nesne sec');
    return item.value || '';
  };
  const describeTrigger = (item = {}) => {
    const whenLabel = getOptionLabel(TRIGGER_WHEN_OPTIONS, item.when || 'onClick', 'Tiklandiginda');
    const sourceLabel =
      item.when === 'onLoad'
        ? 'Sahne'
        : getOptionLabel(triggerSourceOptions, item.target || 'Secili Nesne', 'Secili nesne');
    const actionLabel = getOptionLabel(
      TRIGGER_ACTION_OPTIONS,
      item.action || 'SayfaGec',
      'Sayfaya Gec'
    );
    const valueLabel = getTriggerValueLabel(item);
    const extraLabel =
      item.action === 'DegiskenAta'
        ? item.extra
          ? ` = ${item.extra}`
          : ''
        : item.action === 'DegiskenArttir' || item.action === 'DegiskenAzalt'
          ? ` (${item.extra || '1'})`
          : item.action === 'NesneDurumuAyarla'
            ? ` / ${getOptionLabel(OBJECT_STATE_OPTIONS, item.stateKey || 'visited', 'Visited')}=${String(item.stateValue ?? 'true')}`
            : '';
    const conditionCount = Array.isArray(item.conditions) ? item.conditions.length : 0;
    return `${whenLabel} • ${sourceLabel} → ${actionLabel}${valueLabel ? ` (${valueLabel}${extraLabel})` : extraLabel}${conditionCount ? ` • ${conditionCount} kosul` : ''}`;
  };
  const isAdvancedMode = uiMode === 'advanced';
  const hasAnswerPanel = ['selection', 'drag-drop', 'mixed'].includes(activity?.type);
  const selectionActionBtn = {
    minHeight: 29,
    borderRadius: 10,
    border: '1px solid #cbd5e1',
    background: '#ffffff',
    color: '#334155',
    fontSize: 11,
    fontWeight: 800,
    cursor: 'pointer',
    boxShadow: '0 4px 10px rgba(15,23,42,.04)',
  };
  const bulkInputStyle = {
    width: '100%',
    padding: '5px 8px',
    borderRadius: 8,
    border: '1px solid #cbd5e1',
    background: '#ffffff',
    color: '#0f172a',
    fontSize: 11,
    boxSizing: 'border-box',
    outline: 'none',
  };
  const commitBulkNumberInput = (event, apply) => {
    const raw = String(event.target.value || '').trim();
    if (!raw) return;
    const value = Number(raw);
    if (!Number.isFinite(value)) return;
    apply(value);
  };
  const runSelectionAction = (kind, value) => {
    if (kind === 'align') onUpdate(alignActivitySelection(activity, selectedIds, value));
    if (kind === 'distribute') onUpdate(distributeActivitySelection(activity, selectedIds, value));
  };
  const groupSelectedObjects = () => {
    if (!selectedObjects.length || selectedIds.size < 2) return;
    const groupId = uid();
    patchSelectedObjects({ groupId });
  };
  const ungroupSelectedObjects = () => {
    if (!selectedObjects.length) return;
    patchSelectedObjects({ groupId: '' });
  };
  const inspectorTabs = [
    { id: 'scene', label: 'Sahne' },
    { id: 'object', label: sel || multiSel ? 'Nesne' : 'Öğeler' },
    ...(hasAnswerPanel ? [{ id: 'answer', label: 'Cevap' }] : []),
    ...(!hideTimeline ? [{ id: 'timeline', label: 'Zaman' }] : []),
    { id: 'interaction', label: 'Etkilesim' },
  ];
  const [inspectorTab, setInspectorTab] = useState(() => (sel || multiSel ? 'object' : 'scene'));
  const [editingLayerId, setEditingLayerId] = useState(null);
  const [layerPresetName, setLayerPresetName] = useState(
    () => `${safeActivity?.name || 'Katman'} Seti`
  );
  const [selectedLayerPresetId, setSelectedLayerPresetId] = useState(
    () => layerPresets[0]?.id || ''
  );

  const saveLayerName = useCallback(
    (layerId, value) => {
      const nextName = String(value ?? '');
      patchAct({
        layers: layers.map((layer) =>
          layer.id === layerId ? { ...layer, name: nextName, autoName: !nextName.trim() } : layer
        ),
      });
    },
    [layers, patchAct]
  );

  const removeLayerSafely = useCallback(
    (layerId) => {
      const targetLayer = layers.find((layer) => layer.id === layerId);
      if (!targetLayer || targetLayer.kind === 'base') return;
      const resolvedLayerName = resolvedLayerNames[layerId] || targetLayer.name || 'Katman';
      const hasObjectsInLayer = objects.some((obj) => (obj.layerId || 'base') === layerId);
      const ok = window.confirm(
        hasObjectsInLayer
          ? `"${resolvedLayerName}" katmanı silinsin mi? İçindeki nesneler Base Layer'a taşınacak.`
          : `"${resolvedLayerName}" katmanı silinsin mi?`
      );
      if (!ok) return;

      const nextLayers = layers.filter((layer) => layer.id !== layerId);
      const nextObjects = objects.map((obj) =>
        (obj.layerId || 'base') === layerId ? { ...obj, layerId: 'base' } : obj
      );
      const nextTriggers = triggers.map((trigger) => {
        if (trigger?.action === 'KatmanaGec' && trigger.value === layerId) {
          return { ...trigger, value: 'base' };
        }
        return trigger;
      });
      const selectedObject =
        nextObjects.find((obj) => obj.id === safeActivity.selectedObjectId) || null;
      patchAct({
        layers: nextLayers,
        objects: nextObjects,
        triggers: nextTriggers,
        activeLayerId: safeActivity.activeLayerId === layerId ? 'base' : safeActivity.activeLayerId,
        selectedObjectId: selectedObject ? selectedObject.id : null,
      });
      setEditingLayerId(null);
    },
    [
      layers,
      objects,
      patchAct,
      resolvedLayerNames,
      safeActivity.activeLayerId,
      safeActivity.selectedObjectId,
      triggers,
    ]
  );

  useEffect(() => {
    if (forcedInspectorTab) return;
    if (sel || multiSel) {
      setInspectorTab((current) => (current === 'object' ? current : 'object'));
      return;
    }
    setInspectorTab((current) => (current === 'object' ? 'scene' : current));
  }, [forcedInspectorTab, multiSel, sel]);

  useEffect(() => {
    if (hideTimeline) {
      setInspectorTab((current) => (current === 'timeline' ? 'scene' : current));
    }
  }, [hideTimeline]);

  useEffect(() => {
    if (editingLayerId && !layers.some((layer) => layer.id === editingLayerId)) {
      setEditingLayerId(null);
    }
  }, [editingLayerId, layers]);

  useEffect(() => {
    if (!layerPresets.length) {
      setSelectedLayerPresetId('');
      return;
    }
    if (!layerPresets.some((item) => item.id === selectedLayerPresetId)) {
      const defaultLayerPreset = layerPresets.find(
        (item) =>
          normalizeRuntimeActionLabel(item?.name || '') ===
          normalizeRuntimeActionLabel(DEFAULT_BOOK_LAYER_PRESET_NAME)
      );
      setSelectedLayerPresetId(defaultLayerPreset?.id || layerPresets[0].id);
    }
  }, [layerPresets, selectedLayerPresetId]);

  const activeInspectorTab = forcedInspectorTab || inspectorTab;
  const showScenePanel = activeInspectorTab === 'scene';
  const showObjectPanel = activeInspectorTab === 'object';
  const showAnswerPanel = activeInspectorTab === 'answer';
  const showTimelinePanel = activeInspectorTab === 'timeline';
  const showInteractionPanel = activeInspectorTab === 'interaction';
  const objectListLayerId = sel?.layerId || safeActivity.activeLayerId || 'base';
  const objectListLayer = layers.find((layer) => layer.id === objectListLayerId) || null;
  const objectListLayerName =
    resolvedLayerNames[objectListLayerId] ||
    (objectListLayer?.kind === 'base' ? 'Base Layer' : 'Aktif Katman');
  const objectListObjects = useMemo(
    () => objects.filter((item) => (item.layerId || 'base') === objectListLayerId),
    [objectListLayerId, objects]
  );
  const groupedObjectListEntries = useMemo(
    () => getEditorGroupedObjectEntries(safeActivity, objectListObjects),
    [objectListObjects, safeActivity]
  );
  const hiddenObjectCount = groupedObjectListEntries.filter(
    ({ object }) => object.visible === false
  ).length;
  const layerVisibleCount = groupedObjectListEntries.filter(
    ({ object }) => object.visible !== false
  ).length;
  const sectionShell = {
    background: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: 6,
    marginBottom: 8,
    overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(0,0,0,.05)',
  };
  const sectionHeader = {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    padding: '10px 12px',
    borderBottom: '1px solid #cbd5e1',
    background: '#f8fafc',
  };
  const miniMetric = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '5px 9px',
    borderRadius: 999,
    border: '1px solid #d6e3f1',
    background: 'rgba(255,255,255,.9)',
    color: '#334155',
    fontSize: 11,
    fontWeight: 800,
  };
  const inspectorTabMeta = {
    scene: { icon: '▷', helper: 'Katmanlar', count: String(layers.length) },
    object: {
      icon: multiSel ? '◻' : '◎',
      helper: multiSel ? 'Toplu' : sel ? 'Secili' : 'Ogeler',
      count: String(sel ? 1 : multiSel ? selectedObjectCount : groupedObjectListEntries.length),
    },
    answer: { icon: '✓', helper: 'Yanit', count: null },
    timeline: { icon: '◷', helper: 'Klipler', count: String(timeline.length) },
    interaction: {
      icon: '⇄',
      helper: isAdvancedMode ? 'Kurgu' : 'Temel',
      count: String(triggers.length + variables.length),
    },
  };
  const orderedSceneLayers = [
    ...layers.filter((layer) => layer.kind !== 'base'),
    ...layers.filter((layer) => layer.kind === 'base'),
  ];
  const activeSceneLayerName = resolvedLayerNames[safeActivity.activeLayerId || 'base'] || '';
  const isCevapLayerActive = normalizeLayerNameKey(activeSceneLayerName) === 'cevap';
  const answerLayerStylePresetId =
    safeActivity.answerLayerStylePresetId ||
    bookDefaultStylePresetId ||
    DEFAULT_ANSWER_LAYER_STYLE_PRESET_ID;
  const answerLayerStylePreset = useMemo(
    () => getAnswerLayerStylePresetById(answerLayerStylePresetId),
    [answerLayerStylePresetId]
  );
  const defaultBookLayerPreset = useMemo(
    () =>
      layerPresets.find(
        (item) =>
          normalizeRuntimeActionLabel(item?.name || '') ===
          normalizeRuntimeActionLabel(DEFAULT_BOOK_LAYER_PRESET_NAME)
      ) || null,
    [layerPresets]
  );
  const currentSceneTemplateId = safeActivity.sceneTemplateId || '';
  const currentSceneTemplateLabel =
    SCENE_TEMPLATE_OPTIONS.find((item) => item.value === currentSceneTemplateId)?.label || '';
  const handleApplyCurrentSceneTemplate = useCallback(
    (templateId = currentSceneTemplateId, options = {}) => {
      const resolvedTemplateId = String(templateId || '').trim();
      const scenePatch = applySceneTemplateToSlide(safeActivity, {
        templateId: resolvedTemplateId,
        presetId: answerLayerStylePresetId,
        preserveNonGenerated: options.preserveNonGenerated !== false,
        replaceExisting: options.replaceExisting === true,
        respectDeletedSlots: options.respectDeletedSlots !== false,
        slides: getActivitySlides(safeActivity),
        currentSlideId: safeActivity.currentSlideId || safeActivity.id,
      });
      patchAct({
        sceneTemplateId: scenePatch.sceneTemplateId || '',
        sceneTemplatePresetId: scenePatch.sceneTemplatePresetId || '',
        sceneTemplateVersion: scenePatch.sceneTemplateVersion || 0,
        activeLayerId: scenePatch.activeLayerId || 'base',
        selectedObjectId: null,
        objects: scenePatch.objects || [],
        triggers: scenePatch.triggers || [],
        timeline: scenePatch.timeline || [],
      });
    },
    [answerLayerStylePresetId, currentSceneTemplateId, patchAct, safeActivity]
  );
  const handleSceneTemplateChange = useCallback(
    (value) => {
      const nextTemplateId = String(value || '').trim();
      const currentTemplateId = String(currentSceneTemplateId || '').trim();
      const nonTemplateObjectCount = objects.filter(
        (item) => !isGeneratedSceneTemplateObject(item)
      ).length;

      if (!nextTemplateId) {
        if (objects.some(isGeneratedSceneTemplateObject)) {
          const ok = window.confirm(
            'Bu sahnedeki otomatik tanıtım şablonu kaldırılacak. Devam edilsin mi?'
          );
          if (!ok) return;
        }
        handleApplyCurrentSceneTemplate('', { preserveNonGenerated: true, replaceExisting: false });
        return;
      }

      const shouldReplaceExisting =
        currentTemplateId !== nextTemplateId && nonTemplateObjectCount > 0;
      if (shouldReplaceExisting) {
        const ok = window.confirm(
          `${nonTemplateObjectCount} mevcut nesne yerine otomatik buton tanıtım sayfası yerleştirilecek. Devam edilsin mi?`
        );
        if (!ok) return;
      }

      handleApplyCurrentSceneTemplate(nextTemplateId, {
        preserveNonGenerated: !shouldReplaceExisting,
        replaceExisting: shouldReplaceExisting,
        respectDeletedSlots: currentTemplateId !== nextTemplateId,
      });
    },
    [currentSceneTemplateId, handleApplyCurrentSceneTemplate, objects]
  );
  const handleAnswerLayerStylePresetChange = useCallback(
    (presetId) => {
      const nextPresetId = String(presetId || DEFAULT_ANSWER_LAYER_STYLE_PRESET_ID);
      const activeTemplateId = String(currentSceneTemplateId || '').trim();

      if (!activeTemplateId) {
        const nextObjects = restyleAnswerLayerObjectsForPreset(
          restyleReadyButtonsForPreset(objects, nextPresetId),
          layers,
          resolvedLayerNames,
          nextPresetId
        );
        patchAct({
          answerLayerStylePresetId: nextPresetId,
          objects: nextObjects,
          timeline: syncTimelineWithObjects({ ...safeActivity, objects: nextObjects }),
        });
        return;
      }

      const scenePatch = applySceneTemplateToSlide(safeActivity, {
        templateId: activeTemplateId,
        presetId: nextPresetId,
        preserveNonGenerated: true,
        replaceExisting: false,
        slides: getActivitySlides(safeActivity),
        currentSlideId: safeActivity.currentSlideId || safeActivity.id,
      });
      const nextObjects = restyleAnswerLayerObjectsForPreset(
        restyleReadyButtonsForPreset(scenePatch.objects || [], nextPresetId),
        layers,
        resolvedLayerNames,
        nextPresetId
      );
      patchAct({
        answerLayerStylePresetId: nextPresetId,
        sceneTemplateId: scenePatch.sceneTemplateId || activeTemplateId,
        sceneTemplatePresetId: scenePatch.sceneTemplatePresetId || nextPresetId,
        sceneTemplateVersion: scenePatch.sceneTemplateVersion || SCENE_TEMPLATE_VERSION,
        selectedObjectId: null,
        objects: nextObjects,
        triggers: scenePatch.triggers || [],
        timeline: syncTimelineWithObjects({ ...safeActivity, objects: nextObjects }),
      });
    },
    [currentSceneTemplateId, layers, objects, patchAct, resolvedLayerNames, safeActivity]
  );
  const handleGenerateAnswerLayerObjects = useCallback(() => {
    if (!isCevapLayerActive) return;
    const activeLayerId = safeActivity.activeLayerId || 'base';
    const canvasObjects = getCanvasObjects(safeActivity);
    const dragById = Object.fromEntries(
      canvasObjects.filter((item) => item.type === 'draggable').map((item) => [item.id, item])
    );
    const dropById = Object.fromEntries(
      canvasObjects.filter((item) => item.type === 'dropzone').map((item) => [item.id, item])
    );
    const remainingObjects = objects.filter(
      (item) =>
        !(
          item.layerId === activeLayerId &&
          (item.generatedBy === 'answer-key' || item.generatedBy === 'answer-placement')
        )
    );
    const maxZIndex = remainingObjects.reduce(
      (max, item) => Math.max(max, Number(item.zIndex) || 0),
      0
    );
    let generatedObjects = [];

    const correctMcOptions = (safeActivity.mcOptions || []).filter((option) => option?.isCorrect);
    const selectionSlots = Array.isArray(safeActivity.selectionSlots)
      ? safeActivity.selectionSlots.filter((slot) => String(slot?.correctChoice || '').trim())
      : [];
    const stageWidth = safeActivity.stageWidth || 1920;

    if (correctMcOptions.length) {
      generatedObjects = correctMcOptions.map((option, index) => {
        const row = createObjectFromActivity(safeActivity, 'shape');
        return {
          ...row,
          shapeKind: 'roundedRect',
          layerId: activeLayerId,
          generatedBy: 'answer-key',
          label: `${index + 1}. ${option.label || `Secenek ${index + 1}`}`,
          x: 40,
          y: 42 + index * 38,
          width: Math.max(280, stageWidth - 80),
          height: 32,
          locked: false,
          zIndex: maxZIndex + index + 1,
          style: {
            ...(row.style || {}),
            background: '#f0fdf4',
            borderColor: '#16a34a',
            borderWidth: 2,
            color: '#166534',
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 800,
            textAlign: 'left',
            padding: 8,
          },
        };
      });
    } else if (selectionSlots.length) {
      generatedObjects = selectionSlots.map((slot, index) => {
        const row = createObjectFromActivity(safeActivity, 'shape');
        return {
          ...row,
          shapeKind: 'roundedRect',
          layerId: activeLayerId,
          generatedBy: 'answer-key',
          label: `${index + 1}. ${slot.correctLabel || String(slot.correctChoice || '').toUpperCase()}`,
          x: 40,
          y: 42 + index * 38,
          width: Math.max(280, stageWidth - 80),
          height: 32,
          locked: false,
          zIndex: maxZIndex + index + 1,
          style: {
            ...(row.style || {}),
            background: '#f0fdf4',
            borderColor: '#16a34a',
            borderWidth: 2,
            color: '#166534',
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 800,
            textAlign: 'left',
            padding: 8,
          },
        };
      });
    } else if (activity.type === 'drag-drop' || activity.type === 'mixed') {
      const pairs = getDragDropPairsFromMatches(getCorrectDragMatches(safeActivity));
      if (pairs.length) {
        const frames = getAnswerPlacementFrames(safeActivity);
        generatedObjects = pairs
          .map((pair, index) => {
            const drag = dragById[pair.dragId];
            const frame = frames[getDragDropPairKey(pair.dragId, pair.dropId)];
            const drop = dropById[pair.dropId];
            if (!drag || !drop) return null;

            return {
              ...safeClone(drag, {}),
              id: uid(),
              layerId: activeLayerId,
              generatedBy: 'answer-placement',
              answerStatic: true,
              disableDrag: false,
              groupId: '',
              sourceDragId: pair.dragId,
              targetDropId: pair.dropId,
              answerPairKey: getDragDropPairKey(pair.dragId, pair.dropId),
              x: frame?.x ?? drag.x,
              y: frame?.y ?? drag.y,
              width: frame?.width ?? drag.width,
              height: frame?.height ?? drag.height,
              locked: false,
              zIndex: maxZIndex + index + 1,
            };
          })
          .filter(Boolean);
      }
    } else {
      const correctSelectionObjects = canvasObjects.filter(
        (item) => item.selectionCorrect === true
      );
      if (correctSelectionObjects.length) {
        generatedObjects = correctSelectionObjects.map((item, index) => {
          const badge = createObjectFromActivity(safeActivity, 'shape');
          const badgeX = Math.max(8, Math.round((item.x || 0) + (item.width || 0) - 24));
          const badgeY = Math.max(8, Math.round((item.y || 0) - 12));
          return {
            ...badge,
            shapeKind: 'ellipse',
            layerId: activeLayerId,
            generatedBy: 'answer-key',
            label: '✓',
            x: badgeX,
            y: badgeY,
            width: 28,
            height: 28,
            locked: false,
            zIndex: maxZIndex + index + 1,
            style: {
              ...(badge.style || {}),
              background: '#dcfce7',
              borderColor: '#16a34a',
              color: '#15803d',
              borderRadius: 999,
              fontSize: 18,
              fontWeight: 900,
              textAlign: 'center',
            },
          };
        });
      }
    }

    patchAct({ objects: [...remainingObjects, ...generatedObjects] });
  }, [activity.type, isCevapLayerActive, objects, patchAct, safeActivity]);

  const handleGenerateAnswerLayerSceneSet = useCallback(() => {
    const requiredLayerNames = ['menu', 'explanation', 'normal', 'Correct', 'Incorrect', 'cevap'];
    const existingLayerNameKeys = new Set(
      layers.map((layer) =>
        normalizeLayerNameKey(resolvedLayerNames[layer.id] || layer.name || '')
      )
    );
    const missingLayers = requiredLayerNames
      .filter((name) => !existingLayerNameKeys.has(normalizeLayerNameKey(name)))
      .map((name, index) => createLayer(name, layers.length + index + 1, { autoName: false }));
    const workingLayers = missingLayers.length ? [...layers, ...missingLayers] : layers;
    const workingLayerNames = buildResolvedLayerNameMap(workingLayers, safeActivity);

    const getLayerIdByKey = (key) => {
      const found = workingLayers.find(
        (layer) =>
          normalizeLayerNameKey(workingLayerNames[layer.id] || layer.name || '') === key
      );
      return found?.id || null;
    };

    const menuLayerId = getLayerIdByKey('menu');
    const normalLayerId = getLayerIdByKey('normal');
    const correctLayerId = getLayerIdByKey('correct');
    const incorrectLayerId = getLayerIdByKey('incorrect');
    const answerLayerId = getLayerIdByKey('cevap');
    const targetLayerIds = [
      menuLayerId,
      normalLayerId,
      correctLayerId,
      incorrectLayerId,
      answerLayerId,
    ].filter(Boolean);

    const existingGeneratedTemplates = objects.filter(
      (item) =>
        targetLayerIds.includes(item.layerId || 'base') && isGeneratedAnswerTemplateObject(item)
    );
    if (existingGeneratedTemplates.length) {
      const ok = window.confirm(
        `${existingGeneratedTemplates.length} otomatik cevap şablonu yeniden oluşturulacak. Elle düzenlediğiniz şablon nesneleri artık korunur; yine de otomatik kalan eski şablonlar yenilensin mi?`
      );
      if (!ok) return;
    }
    const generatedTemplateIds = new Set(existingGeneratedTemplates.map((item) => item.id));
    const remainingObjects = objects.filter((item) => !generatedTemplateIds.has(item.id));
    const remainingTriggers = triggers.filter((item) => item.generatedBy !== 'answer-template');
    const maxZIndex = remainingObjects.reduce(
      (max, item) => Math.max(max, Number(item.zIndex) || 0),
      0
    );
    let zIndexCursor = maxZIndex;
    const generated = [];
    const generatedTriggers = [];
    const pushTemplateObject = (layerId, type, patch) => {
      const created = createObjectFromActivity(safeActivity, type);
      zIndexCursor += 1;
      const nextObject = {
        ...created,
        ...patch,
        layerId,
        generatedBy: 'answer-template',
        locked: false,
        zIndex: zIndexCursor,
      };
      generated.push(nextObject);
      return nextObject;
    };

    const stageWidth = Number(safeActivity.stageWidth) || 1920;
    const stageHeight = Number(safeActivity.stageHeight) || 1080;
    const sx = stageWidth / 1920;
    const sy = stageHeight / 1080;
    const u = (value, axis = 'x') => Math.round(value * (axis === 'y' ? sy : sx));
    const preset =
      answerLayerStylePreset || getAnswerLayerStylePresetById(DEFAULT_ANSWER_LAYER_STYLE_PRESET_ID);
    const tx = contentText(safeActivity);
    const activitySlides = getActivitySlides(safeActivity);
    const launchSlideId =
      activitySlides.find((slide) => slide.sceneTemplateId === SCENE_TEMPLATE_LAUNCH_PAGE_ID)?.id ||
      '';
    const introSlideId =
      activitySlides.find((slide) => slide.sceneTemplateId === SCENE_TEMPLATE_BUTTON_INTRO_ID)
        ?.id || '';
    const surface = preset?.surface || 'rgba(255,255,255,.98)';
    const surfaceAlt = preset?.surfaceAlt || 'rgba(248,250,252,.96)';
    const surfaceBorder = preset?.surfaceBorder || '#d8e5f0';
    const surfaceShadow = preset?.surfaceShadow || '0 24px 48px rgba(15,23,42,.16)';
    const insetShadow = preset?.insetShadow || 'inset 0 1px 0 rgba(255,255,255,.82)';
    const toneDanger = preset?.dangerGradient || 'linear-gradient(180deg,#ef4444 0%,#dc2626 100%)';
    const toneAccent = preset?.accentGradient || 'linear-gradient(180deg,#f43f5e 0%,#e11d48 100%)';
    const toneSuccess =
      preset?.successGradient || 'linear-gradient(180deg,#22c55e 0%,#16a34a 100%)';
    const toneNeutral =
      preset?.neutralGradient || 'linear-gradient(180deg,#7dd3fc 0%,#0ea5e9 52%,#0369a1 100%)';
    const solidCssColor = (value = '', fallback = '#ffffff') => {
      const raw = String(value || '').trim();
      if (!raw) return fallback;
      return raw.replace(
        /rgba\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,]+)\s*,\s*[^)]+\)/gi,
        'rgb($1,$2,$3)'
      );
    };
    const cssColorWithAlpha = (value = '', alpha = 0.98, fallback = 'rgba(255,255,255,.98)') => {
      const raw = String(value || '').trim();
      if (!raw) return fallback;
      const hex = raw.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
      if (hex) {
        const full =
          hex[1].length === 3
            ? hex[1]
                .split('')
                .map((char) => char + char)
                .join('')
            : hex[1];
        const intValue = parseInt(full, 16);
        const r = (intValue >> 16) & 255;
        const g = (intValue >> 8) & 255;
        const b = intValue & 255;
        return `rgba(${r},${g},${b},${alpha})`;
      }
      const rgb = raw.match(/^rgba?\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,)]+)/i);
      if (rgb) return `rgba(${rgb[1]},${rgb[2]},${rgb[3]},${alpha})`;
      return fallback;
    };
    const surfaceSolid = solidCssColor(surface, '#ffffff');
    const surfaceAltSolid = solidCssColor(surfaceAlt, surfaceSolid);
    const layerTheme = (kind = 'default') => {
      const toneKey =
        kind === 'correct'
          ? 'success'
          : kind === 'incorrect' || kind === 'answer'
            ? 'danger'
            : kind === 'normal'
              ? 'warning'
              : kind === 'menu'
                ? 'primary'
                : 'accent';
      const colors = getPresetToneColors(preset, toneKey);
      const panelTop = cssColorWithAlpha(colors.light || colors.top || surfaceSolid, 0.98);
      const panelBottom = cssColorWithAlpha(
        colors.top || colors.mid || surfaceAltSolid,
        0.98,
        panelTop
      );
      return {
        colors,
        surface: `linear-gradient(180deg,${panelTop} 0%,${panelBottom} 100%)`,
        surfaceAlt: `linear-gradient(180deg,${panelBottom} 0%,${panelTop} 100%)`,
        border: colors.light || surfaceBorder,
        accent: getPresetButtonShapeStyle(preset, toneKey).background || toneAccent,
        text:
          kind === 'correct'
            ? preset?.successText || colors.bottom
            : kind === 'incorrect' || kind === 'answer'
              ? preset?.dangerText || colors.bottom
              : preset?.titleColor || colors.bottom,
      };
    };
    const shadowSoft =
      (preset?.motion?.hoverShadow && String(preset.motion.hoverShadow).trim()) ||
      '0 12px 24px rgba(15,23,42,.14)';
    const buttonMotion = preset?.motion || {};
    const themeIcons = preset?.icons || {};
    const panelRadius = Number(preset?.panelRadius || 18);
    const buttonRadius = Number(preset?.buttonRadius || 14);
    const pushShape = (layerId, patch) =>
      pushTemplateObject(layerId, 'shape', {
        shapeKind: patch.shapeKind || 'roundedRect',
        label: '',
        showShapeLabel: false,
        ...patch,
        style: {
          background: '#ffffff',
          borderColor: 'transparent',
          borderWidth: 0,
          color: 'transparent',
          ...(patch.style || {}),
        },
      });
    const pushText = (layerId, label, x, y, width, height, style = {}) =>
      pushTemplateObject(layerId, 'text', {
        label,
        x,
        y,
        width,
        height,
        style: {
          background: 'transparent',
          borderColor: 'transparent',
          borderWidth: 0,
          color: '#111111',
          fontSize: u(24, 'y'),
          fontWeight: 700,
          textAlign: 'left',
          boxShadow: 'none',
          lineHeight: 1.35,
          ...(style || {}),
        },
      });
    const pushButton = (layerId, label, x, y, width, height, style = {}) => {
      const {
        runtimeAction = '',
        soundOnLabel = '',
        soundOffLabel = '',
        soundOnIcon = '',
        soundOffIcon = '',
        soundIconMode = '',
        linkedHoverGroup = '',
        buttonMotionOverride = null,
        stateStyles = null,
        tone = 'accent',
        background: requestedBackground,
        borderColor: requestedBorderColor,
        color: requestedColor,
        textShadow: requestedTextShadow,
        ...styleValues
      } = style || {};
      const shapeStyle = getLayerActionButtonStyle(preset, tone);
      const toneColors = getPresetToneColors(preset, tone);
      const palette = {
        accent: {
          background: toneAccent,
          borderColor: preset?.accentBorder || 'rgba(225,29,72,.34)',
          color: preset?.accentText || '#ffffff',
        },
        primary: {
          background: shapeStyle.background,
          borderColor: toneColors.light,
          color: toneColors.text,
        },
        info: {
          background: shapeStyle.background,
          borderColor: toneColors.light,
          color: toneColors.text,
        },
        warning: {
          background: shapeStyle.background,
          borderColor: toneColors.light,
          color: toneColors.text,
        },
        neutral: {
          background: toneNeutral,
          borderColor: preset?.neutralBorder || 'rgba(15,23,42,.22)',
          color: '#ffffff',
        },
        success: {
          background: toneSuccess,
          borderColor: preset?.successBorder || 'rgba(22,163,74,.34)',
          color: preset?.accentText || '#ffffff',
        },
        danger: {
          background: toneDanger,
          borderColor: preset?.dangerBorder || 'rgba(220,38,38,.34)',
          color: preset?.accentText || '#ffffff',
        },
        soft: {
          background: surfaceAlt,
          borderColor: surfaceBorder,
          color: preset?.titleColor || '#0f172a',
        },
      }[tone] || {
        background: toneAccent,
        borderColor: preset?.accentBorder || 'rgba(225,29,72,.34)',
        color: preset?.accentText || '#ffffff',
      };
      return pushTemplateObject(layerId, 'button', {
        label,
        x,
        y,
        width,
        height,
        ...(runtimeAction ? { runtimeAction } : {}),
        ...(soundOnLabel ? { soundOnLabel } : {}),
        ...(soundOffLabel ? { soundOffLabel } : {}),
        ...(soundOnIcon ? { soundOnIcon } : {}),
        ...(soundOffIcon ? { soundOffIcon } : {}),
        ...(soundIconMode ? { soundIconMode } : {}),
        ...(linkedHoverGroup ? { linkedHoverGroup } : {}),
        ...(buttonMotionOverride || buttonMotion
          ? { buttonMotion: { ...(buttonMotion || {}), ...(buttonMotionOverride || {}) } }
          : {}),
        ...(stateStyles ? { stateStyles } : {}),
        style: {
          background: requestedBackground || shapeStyle.background || palette.background,
          borderColor: requestedBorderColor || shapeStyle.borderColor || palette.borderColor,
          borderWidth: shapeStyle.borderWidth ?? 1,
          borderRadius: shapeStyle.borderRadius ?? buttonRadius,
          color: requestedColor || shapeStyle.color || palette.color,
          fontSize: u(20, 'y'),
          fontWeight: 900,
          textAlign: 'center',
          textShadow: shapeStyle.textShadow || requestedTextShadow || '0 1px 0 rgba(0,0,0,.18)',
          boxShadow: shapeStyle.boxShadow || `0 14px 28px rgba(15,23,42,.14), ${insetShadow}`,
          ...(styleValues || {}),
        },
      });
    };
    const pushIconButton = (layerId, label, x, y, size, tone = 'primary', extra = {}) => {
      const iconStyle = getLayerActionButtonStyle(preset, tone);
      return pushTemplateObject(layerId, 'button', {
        label,
        x,
        y,
        width: size,
        height: size,
        runtimeAction: 'none',
        decorativeButton: true,
        readyButtonTone: tone,
        buttonMotion: { ...(buttonMotion || {}) },
        style: {
          background: iconStyle.background,
          borderColor: iconStyle.borderColor,
          borderWidth: Math.max(2, Number(iconStyle.borderWidth ?? 2) || 2),
          borderRadius: 999,
          color: iconStyle.color || '#ffffff',
          fontSize: Math.round(size * 0.58),
          fontWeight: 900,
          textAlign: 'center',
          lineHeight: 1,
          padding: 0,
          textShadow: iconStyle.textShadow || '0 2px 0 rgba(0,0,0,.34)',
          boxShadow: iconStyle.boxShadow || shadowSoft,
          ...(extra.style || {}),
        },
      });
    };
    const pushDim = (layerId, opacity = preset?.dimOpacity ?? 0.07) =>
      pushShape(layerId, {
        shapeKind: 'rect',
        x: 0,
        y: 0,
        width: stageWidth,
        height: stageHeight,
        style: {
          background: `rgba(15,23,42,${Math.max(0.07, Number(opacity) || 0.07)})`,
          borderWidth: 0,
        },
      });
    const pushCloseButton = (layerId, x, y, size = u(56, 'y')) => {
      const closeStyle = getPresetButtonShapeStyle(preset, 'danger');
      const closeButton = pushTemplateObject(layerId, 'button', {
        label: themeIcons.close || '×',
        x: x - Math.round(size * 0.08),
        y: y - Math.round(size * 0.08),
        width: Math.round(size * 1.16),
        height: Math.round(size * 1.16),
        runtimeAction: 'none',
        readyButtonTone: 'danger',
        buttonMotion: { ...(buttonMotion || {}) },
        style: {
          background: closeStyle.background || toneDanger,
          borderColor: closeStyle.borderColor || preset?.dangerBorder || 'rgba(248,250,252,.38)',
          borderWidth: Math.max(3, Number(closeStyle.borderWidth || 3)),
          borderRadius: 999,
          color: closeStyle.color || '#ffffff',
          fontSize: Math.round(size * 0.56),
          fontWeight: 900,
          textAlign: 'center',
          lineHeight: 1,
          padding: 0,
          textShadow: closeStyle.textShadow || '0 2px 0 rgba(0,0,0,.26)',
          boxShadow:
            closeStyle.boxShadow ||
            'inset 0 3px 0 rgba(255,255,255,.68), inset 0 -8px 0 rgba(0,0,0,.24), 0 8px 0 rgba(127,29,29,.78), 0 18px 30px rgba(15,23,42,.26)',
        },
      });
      generatedTriggers.push({
        ...createTriggerItem(generatedTriggers.length),
        when: 'onClick',
        target: closeButton.id,
        action: 'KatmanaGec',
        value: 'base',
        name: 'Layer kapat',
        generatedBy: 'answer-template',
      });
      return closeButton;
    };
    const pushResultHeaderTemplate = ({
      layerId,
      status = 'success',
      title,
      body,
      buttons = [],
    }) => {
      const isSuccess = status === 'success';
      const chrome = layerTheme(isSuccess ? 'correct' : 'incorrect');
      const tone = isSuccess
        ? { color: chrome.text, border: chrome.border, icon: '✓', iconTone: 'success' }
        : { color: chrome.text, border: chrome.border, icon: '×', iconTone: 'danger' };
      pushDim(layerId, Math.max(0.07, Number(preset?.dimOpacity ?? 0.07)));
      const bannerX = Math.round(stageWidth * 0.135);
      const bannerW = stageWidth - bannerX * 2;
      const bannerH = u(112, 'y');
      const bannerY = stageHeight - u(194, 'y');
      const iconSize = u(74, 'y');
      const iconX = bannerX + u(22);
      const iconY = bannerY + Math.round((bannerH - iconSize) / 2);

      pushShape(layerId, {
        shapeKind: 'roundedRect',
        x: bannerX,
        y: bannerY,
        width: bannerW,
        height: bannerH,
        style: {
          background: chrome.surface,
          borderColor: tone.border,
          borderWidth: 2,
          borderRadius: Math.max(10, panelRadius - 4),
          boxShadow: `${surfaceShadow}, ${insetShadow}`,
        },
      });
      pushIconButton(layerId, tone.icon, iconX, iconY, iconSize, tone.iconTone, {
        style: {
          fontSize: u(58, 'y'),
        },
      });
      const textX = iconX + iconSize + u(34);
      pushText(layerId, title, textX, bannerY + u(20, 'y'), u(520), u(34, 'y'), {
        color: tone.color,
        fontSize: u(28, 'y'),
        fontWeight: 900,
        textAlign: 'left',
      });
      pushText(layerId, body, textX, bannerY + u(62, 'y'), u(760), u(34, 'y'), {
        color: preset?.bodyColor || '#334155',
        fontSize: u(17, 'y'),
        fontWeight: 700,
        textAlign: 'left',
      });

      const actionH = u(48, 'y');
      const actionGap = u(24);
      const widths = buttons.map((item) => u(item.width || 240));
      const totalW =
        widths.reduce((sum, width) => sum + width, 0) + actionGap * Math.max(0, buttons.length - 1);
      let cursorX = bannerX + bannerW - totalW - u(30);
      const buttonY = bannerY + Math.round((bannerH - actionH) / 2);
      buttons.forEach((item, index) => {
        const width = widths[index];
        const iconSize = actionH;
        const iconLabelGap = u(12);
        const rowGroup = `answer-template:${layerId}:result-button-${index}`;
        const pairIcon = getButtonPairSemanticIcon(
          { label: item.icon, runtimeAction: item.runtimeAction },
          { label: item.label, runtimeAction: item.runtimeAction }
        );
        const iconButton = item.icon
          ? pushButton(layerId, item.icon, cursorX, buttonY, iconSize, actionH, {
              tone: item.tone || (item.runtimeAction === 'restart' ? 'danger' : 'success'),
              fontSize: u(20, 'y'),
              ...(item.runtimeAction ? { runtimeAction: item.runtimeAction } : {}),
              linkedHoverGroup: rowGroup,
              style: {
                padding: 0,
                lineHeight: 1,
                borderRadius: 999,
                textAlign: 'center',
                whiteSpace: 'nowrap',
              },
            })
          : null;
        if (iconButton) iconButton.label = pairIcon;
        const labelButton = pushButton(
          layerId,
          item.label,
          cursorX + (item.icon ? iconSize + iconLabelGap : 0),
          buttonY,
          item.icon ? width - iconSize - iconLabelGap : width,
          actionH,
          {
            tone: item.tone || (item.runtimeAction === 'restart' ? 'danger' : 'success'),
            fontSize: u(16, 'y'),
            ...(item.runtimeAction ? { runtimeAction: item.runtimeAction } : {}),
            linkedHoverGroup: rowGroup,
            soundIconMode: 'external',
          }
        );
        if (iconButton) {
          iconButton.linkedActionTargetId = labelButton.id;
          labelButton.linkedActionTargetId = labelButton.id;
        }
        if (item.trigger) {
          generatedTriggers.push({
            ...createTriggerItem(generatedTriggers.length),
            when: 'onClick',
            target: labelButton.id,
            action: item.trigger.action,
            value: item.trigger.value,
            name: `${item.label} görevi`,
            generatedBy: 'answer-template',
          });
        }
        cursorX += width + actionGap;
      });
    };
    const pushRetryAnswerTemplate = (layerId) => {
      const chrome = layerTheme('answer');
      pushDim(layerId, Math.max(0.07, Number(preset?.dimOpacity ?? 0.07)));
      const panelW = u(690);
      const panelH = u(96, 'y');
      const panelX = Math.round((stageWidth - panelW) / 2);
      const panelY = stageHeight - u(166, 'y');
      pushShape(layerId, {
        shapeKind: 'roundedRect',
        x: panelX,
        y: panelY,
        width: panelW,
        height: panelH,
        style: {
          background: chrome.surface,
          borderColor: chrome.border || preset?.dangerBorder || '#fecaca',
          borderWidth: 1,
          borderRadius: panelRadius,
          boxShadow: `${surfaceShadow}, ${insetShadow}`,
        },
      });
      const retryGroup = `answer-template:${layerId}:retry-button`;
      const retryIcon = pushButton(
        layerId,
        themeIcons.restart || '↻',
        panelX + u(195),
        panelY + u(20, 'y'),
        u(78),
        u(58, 'y'),
        {
          tone: 'danger',
          background: toneDanger,
          borderColor: preset?.dangerBorder || 'rgba(220,38,38,.34)',
          fontSize: u(22, 'y'),
          runtimeAction: 'restart',
          linkedHoverGroup: retryGroup,
          style: { padding: 0, lineHeight: 1, borderRadius: 999 },
        }
      );
      const retryLabel = pushButton(
        layerId,
        'TEKRAR DENE',
        panelX + u(248),
        panelY + u(20, 'y'),
        u(277),
        u(58, 'y'),
        {
          tone: 'danger',
          background: toneDanger,
          borderColor: preset?.dangerBorder || 'rgba(220,38,38,.34)',
          fontSize: u(19, 'y'),
          runtimeAction: 'restart',
          linkedHoverGroup: retryGroup,
          soundIconMode: 'external',
        }
      );
      retryIcon.linkedActionTargetId = retryLabel.id;
      retryLabel.linkedActionTargetId = retryLabel.id;
      if (introSlideId) {
        generatedTriggers.push({
          ...createTriggerItem(generatedTriggers.length),
          when: 'onClick',
          target: retryLabel.id,
          action: 'SliderGec',
          value: introSlideId,
          name: 'Tekrar dene görevi',
          generatedBy: 'answer-template',
        });
      }
    };
    const pushNormalPopupTemplate = (layerId) => {
      const chrome = layerTheme('normal');
      pushDim(layerId, preset?.dimOpacity ?? 0.07);
      const panelW = u(620);
      const panelH = u(252, 'y');
      const panelX = Math.round((stageWidth - panelW) / 2);
      const panelY = Math.round((stageHeight - panelH) / 2) - u(22, 'y');
      pushShape(layerId, {
        shapeKind: 'roundedRect',
        x: panelX,
        y: panelY,
        width: panelW,
        height: panelH,
        style: {
          background: chrome.surface,
          borderColor: chrome.border || surfaceBorder,
          borderWidth: 1,
          borderRadius: panelRadius,
          boxShadow: `${surfaceShadow}, ${insetShadow}`,
        },
      });
      pushIconButton(
        layerId,
        themeIcons.warning || '!',
        panelX + Math.round((panelW - u(92)) / 2),
        panelY + u(36, 'y'),
        u(92, 'y'),
        'warning',
        { style: { fontSize: u(70, 'y') } }
      );
      pushText(
        layerId,
        'Cevaplarınızı kontrol edebilmek için\nönce sorulara cevap vermelisiniz.',
        panelX + u(40),
        panelY + u(158, 'y'),
        panelW - u(80),
        u(62, 'y'),
        {
          color: preset?.bodyColor || '#334155',
          fontSize: u(22, 'y'),
          fontWeight: 700,
          textAlign: 'center',
        }
      );
      pushCloseButton(layerId, panelX + panelW - u(36), panelY - u(34, 'y'), u(62, 'y'));
    };
    const pushMenuPopupTemplate = (layerId) => {
      const chrome = layerTheme('menu');
      pushDim(layerId, Math.max(0.07, Number(preset?.dimOpacity ?? 0.07)));
      const panelW = u(460);
      const panelH = u(430, 'y');
      const panelX = Math.round((stageWidth - panelW) / 2);
      const panelY = Math.round((stageHeight - panelH) / 2);
      pushShape(layerId, {
        shapeKind: 'roundedRect',
        x: panelX,
        y: panelY,
        width: panelW,
        height: panelH,
        style: {
          background: chrome.surface,
          borderColor: chrome.border || surfaceBorder,
          borderWidth: 1,
          borderRadius: panelRadius + 2,
          boxShadow: `${surfaceShadow}, ${insetShadow}`,
        },
      });
      pushCloseButton(layerId, panelX + panelW - u(38), panelY - u(38, 'y'), u(62, 'y'));
      [
        {
          icon: themeIcons.guide || '?',
          label: tx.activityIntro,
          tone: 'info',
          trigger: introSlideId ? { action: 'SliderGec', value: introSlideId } : null,
          runtimeAction: introSlideId ? '' : 'help',
        },
        {
          icon: themeIcons.restart || '↻',
          label: tx.restart,
          runtimeAction: 'restart',
          tone: 'warning',
          trigger: introSlideId ? { action: 'SliderGec', value: introSlideId } : null,
        },
        {
          icon: '🔊',
          label: tx.soundOff,
          runtimeAction: 'toggle-mute',
          tone: 'neutral',
          soundOnLabel: tx.soundOn,
          soundOffLabel: tx.soundOff,
          soundOnIcon: '🔇',
          soundOffIcon: '🔊',
        },
        {
          icon: themeIcons.home || '⌂',
          label: tx.home,
          tone: 'primary',
          trigger: launchSlideId ? { action: 'SliderGec', value: launchSlideId } : null,
          runtimeAction: launchSlideId ? '' : 'home',
        },
      ].forEach((item, index) => {
        const itemStyle = getLayerActionButtonStyle(preset, item.tone);
        const rowY = panelY + u(64, 'y') + index * u(82, 'y');
        const rowGroup = `answer-template:${layerId}:menu-row-${index}`;
        const rowIconW = u(78);
        const rowGap = u(12);
        const rowIconX = panelX + u(54);
        const rowLabelX = rowIconX + rowIconW + rowGap;
        const rowRight = panelX + panelW - u(54);
        const rowLabelW = Math.max(u(210), rowRight - rowLabelX);
        const pairIcon = getButtonPairSemanticIcon(
          { label: item.icon, runtimeAction: item.runtimeAction, soundOffIcon: item.soundOffIcon },
          { label: item.label, runtimeAction: item.runtimeAction }
        );
        const iconBg = pushTemplateObject(layerId, 'button', {
          label: pairIcon,
          shapeKind: 'roundedRect',
          x: rowIconX,
          y: rowY,
          width: rowIconW,
          height: u(58, 'y'),
          runtimeAction: item.runtimeAction || 'none',
          buttonMotion: { ...(buttonMotion || {}) },
          linkedHoverGroup: rowGroup,
          style: {
            background: itemStyle.background || toneNeutral,
            borderColor: itemStyle.borderColor || preset?.neutralBorder || 'rgba(15,23,42,.22)',
            borderWidth: itemStyle.borderWidth ?? 1,
            borderRadius: 999,
            color: itemStyle.color || '#ffffff',
            fontSize: u(28, 'y'),
            fontWeight: 900,
            textAlign: 'center',
            lineHeight: 1,
            padding: 0,
            whiteSpace: 'nowrap',
            textShadow: itemStyle.textShadow || '0 1px 0 rgba(0,0,0,.2)',
            boxShadow: itemStyle.boxShadow || shadowSoft,
          },
        });
        if (item.runtimeAction === 'toggle-mute') {
          Object.assign(iconBg, {
            dynamicSoundIcon: true,
            soundOnIcon: item.soundOnIcon || '🔇',
            soundOffIcon: item.soundOffIcon || '🔊',
          });
        }
        const labelButton = pushButton(
          layerId,
          item.label,
          rowLabelX,
          rowY,
          rowLabelW,
          u(58, 'y'),
          {
            tone: item.tone,
            fontSize: u(18, 'y'),
            ...(item.runtimeAction ? { runtimeAction: item.runtimeAction } : {}),
            ...(item.soundOnLabel ? { soundOnLabel: item.soundOnLabel } : {}),
            ...(item.soundOffLabel ? { soundOffLabel: item.soundOffLabel } : {}),
            soundIconMode: 'external',
            linkedHoverGroup: rowGroup,
            style: {
              paddingLeft: 0,
              paddingRight: 0,
              textAlign: 'center',
              whiteSpace: 'nowrap',
            },
          }
        );
        iconBg.linkedActionTargetId = labelButton.id;
        labelButton.linkedActionTargetId = labelButton.id;
        if (item.trigger) {
          generatedTriggers.push({
            ...createTriggerItem(generatedTriggers.length),
            when: 'onClick',
            target: labelButton.id,
            action: item.trigger.action,
            value: item.trigger.value,
            name: `${item.label} menü görevi`,
            generatedBy: 'answer-template',
          });
        }
      });
    };

    if (correctLayerId) {
      pushResultHeaderTemplate({
        layerId: correctLayerId,
        status: 'success',
        title: 'DOĞRU',
        body: 'Tebrikler, doğru cevapladınız.',
        buttons: [
          {
            label: 'TAMAMLA',
            tone: 'success',
            icon: themeIcons.complete || '✓',
            width: 240,
            runtimeAction: 'complete',
            trigger: launchSlideId ? { action: 'SliderGec', value: launchSlideId } : null,
          },
          {
            label: 'TEKRARLA',
            tone: 'danger',
            icon: themeIcons.restart || '↻',
            width: 240,
            runtimeAction: 'restart',
            trigger: introSlideId ? { action: 'SliderGec', value: introSlideId } : null,
          },
        ],
      });
    }

    if (incorrectLayerId) {
      pushResultHeaderTemplate({
        layerId: incorrectLayerId,
        status: 'failure',
        title: 'YANLIŞ',
        body: 'Üzgünüz, soruların tamamını doğru cevaplamadınız.',
        buttons: [
          {
            label: 'ÇÖZÜMÜ GÖSTER',
            tone: 'success',
            icon: '✎',
            width: 250,
            runtimeAction: 'show-answer',
            trigger: answerLayerId ? { action: 'KatmanaGec', value: answerLayerId } : null,
          },
          {
            label: 'YENİDEN BAŞLAT',
            tone: 'danger',
            icon: themeIcons.restart || '↻',
            width: 250,
            runtimeAction: 'restart',
            trigger: introSlideId ? { action: 'SliderGec', value: introSlideId } : null,
          },
        ],
      });
    }

    if (menuLayerId) {
      pushMenuPopupTemplate(menuLayerId);
    }

    if (normalLayerId) {
      pushNormalPopupTemplate(normalLayerId);
    }

    if (answerLayerId) {
      pushRetryAnswerTemplate(answerLayerId);
    }

    const manualClickTargets = new Set(
      remainingTriggers
        .filter((item) => (item?.when || 'onClick') === 'onClick')
        .map((item) => item?.target)
        .filter(Boolean)
    );
    const allTriggers = [...remainingTriggers, ...generatedTriggers];
    const hasOnClickTrigger = (targetId = '') =>
      allTriggers.some(
        (item) => (item?.when || 'onClick') === 'onClick' && item?.target === targetId
      );
    const hasManualRuntimeAction = (object = {}) => {
      const action = String(object?.runtimeAction || '')
        .trim()
        .toLowerCase();
      if (!action) return false;
      return !['none', 'off', 'disabled', 'decorative', 'demo'].includes(action);
    };
    const isCloseLikeButton = (object = {}) => {
      const labelRaw = String(object?.label || object?.text || '').trim();
      if (['×', 'x', 'X', '✕', '✖'].includes(labelRaw)) return true;
      const key = normalizeRuntimeActionLabel(labelRaw);
      return key.includes('kapat') || key.includes('close') || key.includes('geri');
    };
    const layerDefaultRuntimeAction = (layerId = '') => {
      if (layerId === correctLayerId) return 'complete';
      if (layerId === incorrectLayerId) return 'show-answer';
      if (layerId === answerLayerId) return 'restart';
      if (layerId === menuLayerId) return 'help';
      return '';
    };
    const pushAutoLayerCloseTrigger = (targetId = '', layerId = '') => {
      if (!targetId) return;
      if (hasOnClickTrigger(targetId)) return;
      generatedTriggers.push({
        ...createTriggerItem(generatedTriggers.length),
        when: 'onClick',
        target: targetId,
        action: 'KatmanaGec',
        value: 'base',
        name: `${resolvedLayerNames[layerId] || 'Katman'} kapat`,
        generatedBy: 'answer-template',
      });
    };

    const mergedObjects = [...remainingObjects, ...generated].map((object) => {
      if (object?.type !== 'button') return object;
      if (object.decorativeButton) return object;
      const layerId = object.layerId || 'base';
      if (!targetLayerIds.includes(layerId)) return object;
      if (manualClickTargets.has(object.id)) return object;
      if (hasManualRuntimeAction(object)) return object;
      if (hasOnClickTrigger(object.id)) return object;

      if (isCloseLikeButton(object) || layerId === normalLayerId) {
        pushAutoLayerCloseTrigger(object.id, layerId);
        return object;
      }

      const autoRuntimeAction = layerDefaultRuntimeAction(layerId);
      if (!autoRuntimeAction) return object;
      return { ...object, runtimeAction: autoRuntimeAction };
    });
    const normalizedSceneSet = normalizeButtonPairLayoutForActivity({
      ...safeActivity,
      objects: mergedObjects,
    });

    patchAct({
      layers: workingLayers,
      objects: normalizedSceneSet.objects || mergedObjects,
      triggers: [...remainingTriggers, ...generatedTriggers],
    });
  }, [
    answerLayerStylePreset,
    layers,
    objects,
    patchAct,
    resolvedLayerNames,
    safeActivity,
    triggers,
  ]);

  if (!activity)
    return (
      <div
        style={{
          width: mobile ? '100%' : 240,
          flexShrink: 0,
          borderLeft: mobile ? 'none' : `1px solid ${EDITOR_THEME.shellBorder}`,
          background: EDITOR_THEME.shellPanelAlt,
        }}
      />
    );
  const workspacePanel =
    forcedInspectorTab ? null : activeTab === 'metinler' ? (
      <div
        style={{
          ...card,
          background: 'linear-gradient(180deg,#ffffff,#f8fbff)',
          border: '1px solid #c7d9f1',
        }}
      >
        <div style={{ ...s10, color: '#2563eb', marginBottom: 8 }}>METIN STUDYOSU</div>
        <div style={{ fontSize: 11, color: '#475569', lineHeight: 1.7, marginBottom: 10 }}>
          Metin stillerini ve blok duzenini ayri pencerede duzenleyebilirsin.
        </div>
        <button
          onClick={onOpenTextStudioWindow}
          style={{
            minHeight: 34,
            padding: '0 12px',
            borderRadius: 10,
            border: '1px solid #93c5fd',
            background: '#ffffff',
            color: '#1d4ed8',
            fontSize: 11,
            fontWeight: 900,
            cursor: 'pointer',
          }}
        >
          Metin Studyosunu Ac
        </button>
      </div>
    ) : activeTab === 'soru' && activity?.type === 'selection' ? (
      <div
        style={{
          ...card,
          background: 'linear-gradient(180deg,#ffffff,#f8fbff)',
          border: '1px solid #c7d9f1',
        }}
      >
        <div style={{ ...s10, color: '#2563eb', marginBottom: 8 }}>QUESTION ARACLARI</div>
        <SelectionEditor activity={activity} onUpdate={onUpdate} />
      </div>
    ) : activeTab === 'soru' && activity?.type === 'sequence' ? (
      <SequenceEditor activity={activity} onUpdate={onUpdate} />
    ) : activeTab === 'soru' && activity?.type === 'matching' ? (
      <MatchingEditor activity={activity} onUpdate={onUpdate} />
    ) : activeTab === 'soru' && activity?.type === 'text-entry' ? (
      <TextEntryEditor activity={activity} onUpdate={onUpdate} />
    ) : activeTab === 'soru' && activity?.type === 'numeric' ? (
      <NumericEditor activity={activity} onUpdate={onUpdate} />
    ) : activeTab === 'soru' && activity?.type === 'fill-blank' ? (
      <FillBlankEditor activity={activity} onUpdate={onUpdate} />
    ) : activeTab === 'soru' && activity?.type === 'survey' ? (
      <SurveyEditor activity={activity} onUpdate={onUpdate} />
    ) : activeTab === 'karma' ? (
      <div
        style={{
          ...card,
          background: 'linear-gradient(180deg,#ffffff,#f8fbff)',
          border: '1px solid #c7d9f1',
        }}
      >
        <div style={{ ...s10, color: '#2563eb', marginBottom: 8 }}>KARMA AKIS</div>
        <MixedActivityEditor activity={activity} onUpdate={onUpdate} getCorrectDragMatches={getCorrectDragMatches} />
      </div>
    ) : null;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        minHeight: 0,
        flexShrink: 0,
        borderLeft: mobile ? 'none' : '1px solid rgba(148,163,184,.18)',
        background: 'linear-gradient(180deg,#fbfdff,#f3f8ff)',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        overscrollBehavior: 'contain',
        touchAction: 'pan-y',
        padding: 8,
        paddingBottom: mobile ? 18 : 8,
      }}
    >
      {workspaceTitle && (
        <div
          style={{
            color: '#174ea6',
            fontSize: 12,
            fontWeight: 950,
            letterSpacing: 0.2,
            textTransform: 'uppercase',
            margin: '2px 2px 9px',
          }}
        >
          {workspaceTitle}
        </div>
      )}
      {!hideInspectorTabs && (
        <div
          style={{
            ...card,
            padding: 12,
            marginBottom: 10,
            background: 'linear-gradient(180deg,#ffffff,#f4f9ff)',
            border: '1px solid #cfe0f5',
            boxShadow: '0 20px 36px rgba(37,99,235,.08)',
          }}
        >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6 }}>
          {inspectorTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setInspectorTab(tab.id)}
              style={{
                minHeight: 42,
                minWidth: 0,
                borderRadius: 11,
                border: `1px solid ${activeInspectorTab === tab.id ? '#93c5fd' : '#dbe7f5'}`,
                background:
                  activeInspectorTab === tab.id
                    ? 'linear-gradient(180deg,#e8f4ff,#ffffff)'
                    : 'rgba(255,255,255,.92)',
                color: activeInspectorTab === tab.id ? '#0f5d8e' : '#475569',
                fontSize: 10,
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow:
                  activeInspectorTab === tab.id
                    ? '0 10px 18px rgba(59,130,246,.12)'
                    : 'inset 0 1px 0 rgba(255,255,255,.9)',
                textAlign: 'left',
                padding: '6px 7px',
                overflow: 'hidden',
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
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 900,
                    lineHeight: 1.15,
                    whiteSpace: 'nowrap',
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {tab.label}
                </div>
                {inspectorTabMeta[tab.id]?.count ? (
                  <span
                    style={{
                      padding: '2px 6px',
                      borderRadius: 999,
                      background: activeInspectorTab === tab.id ? '#dbeafe' : '#f1f5f9',
                      color: activeInspectorTab === tab.id ? '#1d4ed8' : '#64748b',
                      fontSize: 10,
                      fontWeight: 900,
                      flexShrink: 0,
                    }}
                  >
                    {inspectorTabMeta[tab.id]?.count}
                  </span>
                ) : null}
              </div>
              <div
                style={{
                  fontSize: 9,
                  color: activeInspectorTab === tab.id ? '#1e40af' : '#64748b',
                  marginTop: 3,
                  lineHeight: 1.15,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {inspectorTabMeta[tab.id]?.helper || ''}
              </div>
            </button>
          ))}
        </div>
        </div>
      )}

      {workspacePanel}

      {showObjectPanel && (
        <div
          style={{
            ...card,
            border: '1px solid #bfdbfe',
            background: 'linear-gradient(180deg,#f8fbff,#eef6ff)',
          }}
        >
          <div style={{ ...s10, color: '#1d4ed8', marginBottom: 7 }}>HAZIR BUTON EKLE</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
            {readyButtonPresets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => addReadyButton(preset.id)}
                title={`${preset.label} butonu ekle`}
                style={{
                  minHeight: 38,
                  borderRadius: 10,
                  border: '1px solid #bfdbfe',
                  background: '#ffffff',
                  color: '#1d4ed8',
                  fontSize: 11,
                  fontWeight: 900,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <span>{preset.icon}</span>
                <span>{preset.label}</span>
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.45, marginTop: 7 }}>
            {tx.readyHelp}
          </div>
        </div>
      )}

      {showObjectPanel && multiSel && !sel ? (
        <>
          <div style={card}>
            <div style={s10}>SECIM</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a' }}>
              {selectedObjectCount} nesne secildi
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
              Alan: {Math.round(selectionBounds?.width || 0)} x{' '}
              {Math.round(selectionBounds?.height || 0)}
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
              Ok tuslari ile tasiyin, Delete ile silin.
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                gap: 6,
                marginTop: 10,
              }}
            >
              <button
                onClick={() => patchSelectedObjects({ locked: true })}
                style={selectionActionBtn}
              >
                Kilitle
              </button>
              <button
                onClick={() => patchSelectedObjects({ locked: false })}
                style={selectionActionBtn}
              >
                Kilidi Ac
              </button>
              <button
                onClick={groupSelectedObjects}
                disabled={selectedIds.size < 2}
                style={{
                  ...selectionActionBtn,
                  opacity: selectedIds.size < 2 ? 0.45 : 1,
                  cursor: selectedIds.size < 2 ? 'default' : 'pointer',
                }}
              >
                Grupla
              </button>
              <button onClick={ungroupSelectedObjects} style={selectionActionBtn}>
                Ayir
              </button>
            </div>
          </div>

          <div style={card}>
            <div style={s10}>TOPLU DUZENLEME</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <label
                  style={{ fontSize: 11, color: '#78909C', display: 'block', marginBottom: 2 }}
                >
                  Genislik
                </label>
                <input
                  type="number"
                  placeholder="Ayni yap"
                  style={bulkInputStyle}
                  onBlur={(e) =>
                    commitBulkNumberInput(e, (value) =>
                      patchSelectedObjects({ width: Math.max(20, value) })
                    )
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter')
                      commitBulkNumberInput(e, (value) =>
                        patchSelectedObjects({ width: Math.max(20, value) })
                      );
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label
                  style={{ fontSize: 11, color: '#78909C', display: 'block', marginBottom: 2 }}
                >
                  Yukseklik
                </label>
                <input
                  type="number"
                  placeholder="Ayni yap"
                  style={bulkInputStyle}
                  onBlur={(e) =>
                    commitBulkNumberInput(e, (value) =>
                      patchSelectedObjects({ height: Math.max(20, value) })
                    )
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter')
                      commitBulkNumberInput(e, (value) =>
                        patchSelectedObjects({ height: Math.max(20, value) })
                      );
                  }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <label
                  style={{ fontSize: 11, color: '#78909C', display: 'block', marginBottom: 2 }}
                >
                  Font Boyutu
                </label>
                <input
                  type="number"
                  placeholder="Yazı boyutu"
                  style={bulkInputStyle}
                  onBlur={(e) =>
                    commitBulkNumberInput(e, (value) =>
                      patchSelectedObjects({}, { fontSize: Math.max(1, value) })
                    )
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter')
                      commitBulkNumberInput(e, (value) =>
                        patchSelectedObjects({}, { fontSize: Math.max(1, value) })
                      );
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label
                  style={{ fontSize: 11, color: '#78909C', display: 'block', marginBottom: 2 }}
                >
                  Radius
                </label>
                <input
                  type="number"
                  placeholder="Kose"
                  style={bulkInputStyle}
                  onBlur={(e) =>
                    commitBulkNumberInput(e, (value) =>
                      patchSelectedObjects({}, { borderRadius: Math.max(0, value) })
                    )
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter')
                      commitBulkNumberInput(e, (value) =>
                        patchSelectedObjects({}, { borderRadius: Math.max(0, value) })
                      );
                  }}
                />
              </div>
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>Renkler</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 11,
                  color: '#475569',
                }}
              >
                <input
                  type="color"
                  value={resolvePickerColor(selectedObjects[0]?.style?.color, '#111111')}
                  onChange={(e) => patchSelectedObjects({}, { color: e.target.value })}
                  style={{
                    width: 28,
                    height: 24,
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                  }}
                />
                Yazı
              </label>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 11,
                  color: '#475569',
                }}
              >
                <input
                  type="color"
                  value={resolvePickerColor(selectedObjects[0]?.style?.background, '#2563eb')}
                  onChange={(e) => patchSelectedObjects({}, { background: e.target.value })}
                  style={{
                    width: 28,
                    height: 24,
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                  }}
                />
                Zemin
              </label>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 11,
                  color: '#475569',
                }}
              >
                <input
                  type="color"
                  value={resolvePickerColor(selectedObjects[0]?.style?.borderColor, '#111111')}
                  onChange={(e) => patchSelectedObjects({}, { borderColor: e.target.value })}
                  style={{
                    width: 28,
                    height: 24,
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                  }}
                />
                Kenar
              </label>
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 8 }}>
              Secili nesnelerin boyutu, fontu ve renkleri tek seferde uygulanir.
            </div>
          </div>

          <div style={card}>
            <div style={s10}>HIZALAMA</div>
            <div
              style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 6 }}
            >
              {[
                { label: 'Sol', kind: 'align', value: 'left' },
                { label: 'Orta X', kind: 'align', value: 'center' },
                { label: 'Sag', kind: 'align', value: 'right' },
                { label: 'Ust', kind: 'align', value: 'top' },
                { label: 'Orta Y', kind: 'align', value: 'middle' },
                { label: 'Alt', kind: 'align', value: 'bottom' },
              ].map((action) => (
                <button
                  key={`${action.kind}-${action.value}`}
                  onClick={() => runSelectionAction(action.kind, action.value)}
                  style={selectionActionBtn}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>

          <div style={card}>
            <div style={s10}>OTOMATIK BOSLUK</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <button
                onClick={() => runSelectionAction('distribute', 'horizontal')}
                disabled={selectedObjects.length < 3}
                style={{
                  ...selectionActionBtn,
                  opacity: selectedObjects.length < 3 ? 0.45 : 1,
                  cursor: selectedObjects.length < 3 ? 'default' : 'pointer',
                }}
              >
                Yatay Dagit
              </button>
              <button
                onClick={() => runSelectionAction('distribute', 'vertical')}
                disabled={selectedObjects.length < 3}
                style={{
                  ...selectionActionBtn,
                  opacity: selectedObjects.length < 3 ? 0.45 : 1,
                  cursor: selectedObjects.length < 3 ? 'default' : 'pointer',
                }}
              >
                Dikey Dagit
              </button>
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 8 }}>
              Esit aralik dagitma icin en az 3 nesne secili olmali.
            </div>
          </div>
        </>
      ) : showObjectPanel && sel ? (
        <div style={card}>
          <div style={{ ...s10, color: '#2563eb' }}>{sel.type.toUpperCase()}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Inp
              label="Etiket"
              value={sel.label || ''}
              onChange={(e) => patchObj(sel.id, { label: e.target.value })}
            />
            <div style={{ display: 'flex', gap: 5 }}>
              <Inp
                label="X"
                type="number"
                value={Math.round(sel.x)}
                onChange={(e) => patchObj(sel.id, { x: +e.target.value })}
              />
              <Inp
                label="Y"
                type="number"
                value={Math.round(sel.y)}
                onChange={(e) => patchObj(sel.id, { y: +e.target.value })}
              />
            </div>
            <div style={{ display: 'flex', gap: 5 }}>
              <Inp
                label="G"
                type="number"
                value={Math.round(sel.width)}
                onChange={(e) => patchObj(sel.id, { width: Math.max(20, +e.target.value) })}
              />
              <Inp
                label="Y"
                type="number"
                value={Math.round(sel.height)}
                onChange={(e) => patchObj(sel.id, { height: Math.max(20, +e.target.value) })}
              />
            </div>
            <Inp
              label="Dondur °"
              type="number"
              value={sel.rotation || 0}
              onChange={(e) => patchObj(sel.id, { rotation: +e.target.value })}
            />
            <SelectInp
              label="Layer"
              value={sel.layerId || 'base'}
              onChange={(e) => patchObj(sel.id, { layerId: e.target.value })}
              options={layers.map((layer, index) => ({
                value: layer.id,
                label: resolvedLayerNames[layer.id] || `Layer ${index + 1}`,
              }))}
            />
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: 6,
                alignItems: 'end',
              }}
            >
              <Inp
                label="Düzenleme Grubu"
                value={sel.groupId || ''}
                onChange={(e) => patchObj(sel.id, { groupId: e.target.value })}
                placeholder="Aynı gruptakiler beraber seçilir"
              />
              <button
                onClick={() => patchObj(sel.id, { groupId: '' })}
                disabled={!sel.groupId}
                style={{
                  minHeight: 34,
                  padding: '0 10px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: sel.groupId ? '#dc2626' : '#94a3b8',
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: sel.groupId ? 'pointer' : 'default',
                }}
              >
                Ayir
              </button>
            </div>
            <div
              style={{
                padding: '8px 9px',
                borderRadius: 10,
                border: '1px solid #dbe7f5',
                background: '#f8fbff',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 800, color: '#334155', marginBottom: 6 }}>
                Tiklama Gorevi
              </div>
              <SelectInp
                label="Aksiyon"
                value={objectClickTaskAction}
                onChange={(e) => setObjectClickTask(e.target.value, '')}
                options={[
                  { value: 'none', label: 'Yok' },
                  { value: 'check', label: 'Kontrol Et' },
                  { value: 'runtime:toggle-play-pause', label: 'Play / Pause Medya' },
                  { value: 'runtime:toggle-mute', label: 'Sesi Ac / Kapat' },
                  { value: 'runtime:show-answer', label: 'Cozumu Goster' },
                  { value: 'runtime:restart', label: 'Yeniden Baslat' },
                  { value: 'runtime:complete', label: 'Etkinligi Bitir' },
                  { value: 'close-layer', label: "Layer'i Kapat" },
                  { value: 'SliderGec', label: 'Soru / Slider Gec' },
                  { value: 'SayfaGec', label: 'Sahneye Gec' },
                  { value: 'KatmanaGec', label: 'Katmana Gec' },
                ]}
              />
              {objectClickTaskAction === 'SliderGec' && (
                <SelectInp
                  label="Hedef Sahne"
                  value={objectQuickJumpValue || '__next__'}
                  onChange={(e) => setObjectClickTask('SliderGec', e.target.value)}
                  options={triggerSlideOptions}
                />
              )}
              {objectClickTaskAction === 'KatmanaGec' && (
                <SelectInp
                  label="Hedef Katman"
                  value={objectQuickJumpValue || safeActivity.activeLayerId || 'base'}
                  onChange={(e) => setObjectClickTask('KatmanaGec', e.target.value)}
                  options={triggerLayerOptions}
                />
              )}
              {objectClickTaskAction === 'SayfaGec' && (
                <SelectInp
                  label="Hedef Sahne"
                  value={objectQuickJumpValue || '__next__'}
                  onChange={(e) => setObjectClickTask('SayfaGec', e.target.value)}
                  options={
                    triggerActivityOptions.length
                      ? triggerActivityOptions
                      : [{ value: '__next__', label: 'Sonraki sahne' }]
                  }
                />
              )}
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 6, lineHeight: 1.5 }}>
                Bu ayar secili nesneye <strong>onClick</strong> triggeri ekler veya var olan
                triggeri gunceller.
              </div>
            </div>
            {(sel.type === 'draggable' || sel.type === 'dropzone') && (
              <>
                <div style={{ display: 'flex', gap: 5 }}>
                  <Inp
                    label="Soru Grubu"
                    value={sel.scope || ''}
                    onChange={(e) => patchObj(sel.id, { scope: e.target.value })}
                    placeholder="Soru-1, Soru-2..."
                  />
                  <Inp
                    label="Grup"
                    value={sel.group || ''}
                    onChange={(e) => patchObj(sel.id, { group: e.target.value })}
                    placeholder="A, B, ..."
                  />
                </div>
                {sel.type === 'draggable' && (
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      fontSize: 11,
                      color: '#78909C',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={!!sel.allowMultipleTargets}
                      onChange={(e) => patchObj(sel.id, { allowMultipleTargets: e.target.checked })}
                      style={{ accentColor: '#a855f7' }}
                    />
                    Birden fazla hedefe gidebilir
                  </label>
                )}
                {sel.type === 'dropzone' && (
                  <Inp
                    label="Kapasite"
                    type="number"
                    value={sel.capacity || 0}
                    onChange={(e) =>
                      patchObj(sel.id, { capacity: Math.max(0, +e.target.value || 0) })
                    }
                    placeholder="0 = sinirsiz / global"
                  />
                )}
                <div
                  style={{
                    padding: '7px 8px',
                    borderRadius: 8,
                    background: '#f8fafc',
                    border: '1px solid #dbeafe',
                    color: '#475569',
                    fontSize: 11,
                    lineHeight: 1.6,
                  }}
                >
                  Bu panelde yaptigin boyut ve konum degisikligi sadece secili ogeyi etkiler.
                  Hepsini birlikte duzenlemek istersen coklu secim kullan.
                </div>
              </>
            )}
            {sel.type === 'audio' && (
              <>
                <Inp
                  label="Ses URL"
                  value={sel.mediaUrl || ''}
                  onChange={(e) => patchObj(sel.id, { mediaUrl: e.target.value })}
                  placeholder="/static/uploads/ses.mp3"
                />
                <label
                  style={{
                    display: 'block',
                    padding: '6px 8px',
                    borderRadius: 0,
                    border: '1px solid #111111',
                    background: '#ffffff',
                    color: '#111111',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    textAlign: 'center',
                  }}
                >
                  Ses Yükle / Değiştir
                  <input
                    type="file"
                    accept="audio/*"
                    style={{ display: 'none' }}
                    onChange={async (ev) => {
                      const file = ev.target.files?.[0];
                      if (!file) return;
                      const mediaUrl = await uploadMediaFile(file);
                      patchObj(sel.id, {
                        mediaUrl,
                        mediaName: file.name,
                        label: sel.label || file.name.replace(/\.[^.]+$/, '') || 'Ses',
                      });
                      ev.target.value = '';
                    }}
                  />
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      fontSize: 11,
                      color: '#78909C',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={sel.showPlayerControls !== false}
                      onChange={(e) => patchObj(sel.id, { showPlayerControls: e.target.checked })}
                      style={{ accentColor: '#38bdf8' }}
                    />
                    Kontroller
                  </label>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      fontSize: 11,
                      color: '#78909C',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={!!sel.autoPlay}
                      onChange={(e) => patchObj(sel.id, { autoPlay: e.target.checked })}
                      style={{ accentColor: '#38bdf8' }}
                    />
                    Oto Oynat
                  </label>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      fontSize: 11,
                      color: '#78909C',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={!!sel.muted}
                      onChange={(e) => patchObj(sel.id, { muted: e.target.checked })}
                      style={{ accentColor: '#38bdf8' }}
                    />
                    Sessiz
                  </label>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      fontSize: 11,
                      color: '#78909C',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={!!sel.loop}
                      onChange={(e) => patchObj(sel.id, { loop: e.target.checked })}
                      style={{ accentColor: '#38bdf8' }}
                    />
                    Dongu
                  </label>
                </div>
                <SelectInp
                  label="Ses Bitince"
                  value={sel.mediaEndAction || 'none'}
                  onChange={(e) => patchObj(sel.id, { mediaEndAction: e.target.value })}
                  options={[
                    { value: 'none', label: 'Bir sey yapma / trigger bekle' },
                    { value: 'close-layer', label: "Bulundugu layer'i kapat" },
                  ]}
                />
                <div
                  style={{
                    padding: '7px 8px',
                    borderRadius: 8,
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    color: '#1e40af',
                    fontSize: 11,
                    lineHeight: 1.45,
                  }}
                >
                  Ses sahnede gorunmez; preview/SCORM'da layer acilinca otomatik calar. Ses Cal/Ses
                  Durdur ve Medya bitince triggerlariyla kontrol edebilirsin.
                </div>
                <div style={{ marginTop: 4 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', marginBottom: 3 }}>
                    Altyazılar (CC)
                  </div>
                  {(sel.closedCaptions || []).map((cc, ci) => (
                    <div
                      key={ci}
                      style={{ display: 'flex', gap: 3, alignItems: 'center', marginBottom: 2 }}
                    >
                      <select
                        value={cc.lang || 'tr'}
                        onChange={(e) => {
                          const arr = [...(sel.closedCaptions || [])];
                          arr[ci] = { ...arr[ci], lang: e.target.value };
                          patchObj(sel.id, { closedCaptions: arr });
                        }}
                        style={{
                          width: 50,
                          fontSize: 10,
                          padding: '1px 2px',
                          border: '1px solid #cbd5e1',
                          borderRadius: 3,
                          background: '#f8fafc',
                        }}
                      >
                        {CAPTION_LANGUAGE_OPTIONS.map((lo) => (
                          <option key={lo.code} value={lo.code}>
                            {lo.code.toUpperCase()}
                          </option>
                        ))}
                      </select>
                      <input
                        value={cc.src || ''}
                        onChange={(e) => {
                          const arr = [...(sel.closedCaptions || [])];
                          arr[ci] = { ...arr[ci], src: e.target.value };
                          patchObj(sel.id, { closedCaptions: arr });
                        }}
                        placeholder=".vtt URL"
                        style={{
                          flex: 1,
                          fontSize: 10,
                          padding: '2px 4px',
                          border: '1px solid #cbd5e1',
                          borderRadius: 3,
                        }}
                      />
                      <button
                        onClick={() => {
                          const arr = (sel.closedCaptions || []).filter((_, i) => i !== ci);
                          patchObj(sel.id, { closedCaptions: arr });
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          fontSize: 12,
                          padding: 0,
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() =>
                      patchObj(sel.id, {
                        closedCaptions: [
                          ...(sel.closedCaptions || []),
                          { lang: 'tr', src: '', label: 'Türkçe' },
                        ],
                      })
                    }
                    style={{
                      fontSize: 10,
                      color: '#2563eb',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    + Altyazı Ekle
                  </button>
                </div>
              </>
            )}
            {sel.type === 'video' && (
              <>
                <Inp
                  label="Video URL"
                  value={sel.mediaUrl || ''}
                  onChange={(e) => patchObj(sel.id, { mediaUrl: e.target.value })}
                  placeholder="/static/uploads/video.mp4"
                />
                <label
                  style={{
                    display: 'block',
                    padding: '6px 8px',
                    borderRadius: 0,
                    border: '1px solid #111111',
                    background: '#ffffff',
                    color: '#111111',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    textAlign: 'center',
                  }}
                >
                  Video Yükle / Değiştir
                  <input
                    type="file"
                    accept="video/mp4,video/webm,video/ogg"
                    style={{ display: 'none' }}
                    onChange={async (ev) => {
                      const file = ev.target.files?.[0];
                      if (!file) return;
                      const mediaUrl = await uploadMediaFile(file);
                      patchObj(sel.id, {
                        mediaUrl,
                        mediaName: file.name,
                        label: sel.label || file.name.replace(/\.[^.]+$/, '') || 'Video',
                      });
                      ev.target.value = '';
                    }}
                  />
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      fontSize: 11,
                      color: '#78909C',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={sel.showPlayerControls !== false}
                      onChange={(e) => patchObj(sel.id, { showPlayerControls: e.target.checked })}
                      style={{ accentColor: '#38bdf8' }}
                    />
                    Kontroller
                  </label>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      fontSize: 11,
                      color: '#78909C',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={!!sel.autoPlay}
                      onChange={(e) => patchObj(sel.id, { autoPlay: e.target.checked })}
                      style={{ accentColor: '#38bdf8' }}
                    />
                    Oto Oynat
                  </label>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      fontSize: 11,
                      color: '#78909C',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={sel.muted !== false}
                      onChange={(e) => patchObj(sel.id, { muted: e.target.checked })}
                      style={{ accentColor: '#38bdf8' }}
                    />
                    Sessiz
                  </label>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      fontSize: 11,
                      color: '#78909C',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={!!sel.loop}
                      onChange={(e) => patchObj(sel.id, { loop: e.target.checked })}
                      style={{ accentColor: '#38bdf8' }}
                    />
                    Dongu
                  </label>
                </div>
                <div style={{ marginTop: 4 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', marginBottom: 3 }}>
                    Altyazılar (CC)
                  </div>
                  {(sel.closedCaptions || []).map((cc, ci) => (
                    <div
                      key={ci}
                      style={{ display: 'flex', gap: 3, alignItems: 'center', marginBottom: 2 }}
                    >
                      <select
                        value={cc.lang || 'tr'}
                        onChange={(e) => {
                          const arr = [...(sel.closedCaptions || [])];
                          arr[ci] = { ...arr[ci], lang: e.target.value };
                          patchObj(sel.id, { closedCaptions: arr });
                        }}
                        style={{
                          width: 50,
                          fontSize: 10,
                          padding: '1px 2px',
                          border: '1px solid #cbd5e1',
                          borderRadius: 3,
                          background: '#f8fafc',
                        }}
                      >
                        {CAPTION_LANGUAGE_OPTIONS.map((lo) => (
                          <option key={lo.code} value={lo.code}>
                            {lo.code.toUpperCase()}
                          </option>
                        ))}
                      </select>
                      <input
                        value={cc.src || ''}
                        onChange={(e) => {
                          const arr = [...(sel.closedCaptions || [])];
                          arr[ci] = { ...arr[ci], src: e.target.value };
                          patchObj(sel.id, { closedCaptions: arr });
                        }}
                        placeholder=".vtt URL"
                        style={{
                          flex: 1,
                          fontSize: 10,
                          padding: '2px 4px',
                          border: '1px solid #cbd5e1',
                          borderRadius: 3,
                        }}
                      />
                      <button
                        onClick={() => {
                          const arr = (sel.closedCaptions || []).filter((_, i) => i !== ci);
                          patchObj(sel.id, { closedCaptions: arr });
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          fontSize: 12,
                          padding: 0,
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() =>
                      patchObj(sel.id, {
                        closedCaptions: [
                          ...(sel.closedCaptions || []),
                          { lang: 'tr', src: '', label: 'Türkçe' },
                        ],
                      })
                    }
                    style={{
                      fontSize: 10,
                      color: '#2563eb',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    + Altyazı Ekle
                  </button>
                </div>
              </>
            )}
            {sel.type === 'embed' && (
              <Inp
                label="Web URL"
                value={sel.embedUrl || ''}
                onChange={(e) => patchObj(sel.id, { embedUrl: e.target.value })}
                placeholder="https://example.com"
              />
            )}
            {sel.type === 'slider' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', gap: 5 }}>
                  <Inp
                    label="Min"
                    type="number"
                    value={sel.sliderMin ?? 0}
                    onChange={(e) => patchObj(sel.id, { sliderMin: +e.target.value })}
                  />
                  <Inp
                    label="Max"
                    type="number"
                    value={sel.sliderMax ?? 100}
                    onChange={(e) => patchObj(sel.id, { sliderMax: +e.target.value })}
                  />
                </div>
                <div style={{ display: 'flex', gap: 5 }}>
                  <Inp
                    label="Adım"
                    type="number"
                    value={sel.sliderStep ?? 1}
                    onChange={(e) => patchObj(sel.id, { sliderStep: +e.target.value })}
                  />
                  <Inp
                    label="Başlangıç"
                    type="number"
                    value={sel.sliderValue ?? 50}
                    onChange={(e) => patchObj(sel.id, { sliderValue: +e.target.value })}
                  />
                </div>
                <Inp
                  label="Değişken"
                  value={sel.sliderVariable || ''}
                  onChange={(e) => patchObj(sel.id, { sliderVariable: e.target.value })}
                  placeholder="Slider değerini atanacak değişken"
                />
              </div>
            )}
            <div style={{ display: 'flex', gap: 5 }}>
              <Inp
                label="Font"
                type="number"
                value={sel.style?.fontSize || 14}
                onChange={(e) =>
                  patchObj(sel.id, { style: { ...sel.style, fontSize: +e.target.value } })
                }
              />
              <Inp
                label="Radius"
                type="number"
                value={sel.style?.borderRadius || 0}
                onChange={(e) =>
                  patchObj(sel.id, { style: { ...sel.style, borderRadius: +e.target.value } })
                }
              />
            </div>
            <Inp
              label="Kenar Kalınlığı"
              type="number"
              value={sel.style?.borderWidth ?? 1}
              onChange={(e) =>
                patchObj(sel.id, {
                  style: { ...sel.style, borderWidth: Math.max(0, +e.target.value || 0) },
                })
              }
            />
            {sel.type === 'shape' && (
              <>
                <SelectInp
                  label="Sekil Tipi"
                  value={sel.shapeKind || 'roundedRect'}
                  onChange={(e) => {
                    const nextShapeKind = e.target.value;
                    if (nextShapeKind === 'customPath') {
                      const points = getObjectVectorPoints(sel);
                      patchObj(sel.id, {
                        shapeKind: nextShapeKind,
                        vectorPoints: points,
                        vectorPath: buildVectorPathFromPoints(points, true),
                      });
                      return;
                    }
                    patchObj(sel.id, { shapeKind: nextShapeKind });
                  }}
                  options={[
                    ...RIBBON_SHAPE_PRESETS.map((shape) => ({
                      value: shape.kind,
                      label: shape.label,
                    })),
                    { value: 'customPath', label: 'Vektor Path' },
                  ]}
                />
                {(sel.shapeKind || '') === 'customPath' && (
                  <>
                    <Inp
                      label="SVG Path (d)"
                      value={sel.vectorPath || 'M 10 90 L 50 10 L 90 90 Z'}
                      onChange={(e) => {
                        const nextPath = e.target.value;
                        patchObj(sel.id, {
                          vectorPath: nextPath,
                          vectorPoints: parseVectorPathToPoints(nextPath),
                        });
                      }}
                    />
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        padding: '6px 8px',
                        borderRadius: 8,
                        border: '1px solid #dbe7f5',
                        background: '#f8fbff',
                        fontSize: 11,
                        color: '#475569',
                      }}
                    >
                      <span>{getObjectVectorPoints(sel).length} nokta</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button
                          onClick={() => {
                            const points = getObjectVectorPoints(sel);
                            const nextPoint = points.length
                              ? {
                                  x: Number(
                                    ((points[points.length - 1].x + points[0].x) / 2).toFixed(2)
                                  ),
                                  y: Number(
                                    ((points[points.length - 1].y + points[0].y) / 2).toFixed(2)
                                  ),
                                }
                              : { x: 50, y: 50 };
                            const nextPoints = [...points, nextPoint];
                            patchObj(sel.id, {
                              vectorPoints: nextPoints,
                              vectorPath: buildVectorPathFromPoints(nextPoints, true),
                            });
                          }}
                          style={{
                            minHeight: 24,
                            minWidth: 24,
                            borderRadius: 999,
                            border: '1px solid #94a3b8',
                            background: '#ffffff',
                            color: '#334155',
                            cursor: 'pointer',
                            fontSize: 13,
                            fontWeight: 900,
                            lineHeight: 1,
                          }}
                        >
                          +
                        </button>
                        <button
                          onClick={() => {
                            const points = getObjectVectorPoints(sel);
                            if (points.length <= 2) return;
                            const nextPoints = points.slice(0, -1);
                            patchObj(sel.id, {
                              vectorPoints: nextPoints,
                              vectorPath: buildVectorPathFromPoints(nextPoints, true),
                            });
                          }}
                          style={{
                            minHeight: 24,
                            minWidth: 24,
                            borderRadius: 999,
                            border: '1px solid #fca5a5',
                            background: '#ffffff',
                            color: '#b91c1c',
                            cursor:
                              getObjectVectorPoints(sel).length <= 2 ? 'not-allowed' : 'pointer',
                            fontSize: 14,
                            fontWeight: 900,
                            lineHeight: 1,
                            opacity: getObjectVectorPoints(sel).length <= 2 ? 0.45 : 1,
                          }}
                        >
                          -
                        </button>
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>
                      Sahnede noktaları tutup sürükleyerek path şeklini düzenleyebilirsin.
                    </div>
                  </>
                )}
                <div style={{ display: 'flex', gap: 5 }}>
                  <SelectInp
                    label="Kose"
                    value={sel.style?.strokeLinejoin || 'round'}
                    onChange={(e) =>
                      patchObj(sel.id, { style: { ...sel.style, strokeLinejoin: e.target.value } })
                    }
                    options={[
                      { value: 'round', label: 'Round' },
                      { value: 'bevel', label: 'Bevel' },
                      { value: 'miter', label: 'Miter' },
                    ]}
                  />
                  <SelectInp
                    label="Uc"
                    value={sel.style?.strokeLinecap || 'round'}
                    onChange={(e) =>
                      patchObj(sel.id, { style: { ...sel.style, strokeLinecap: e.target.value } })
                    }
                    options={[
                      { value: 'round', label: 'Round' },
                      { value: 'butt', label: 'Butt' },
                      { value: 'square', label: 'Square' },
                    ]}
                  />
                </div>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    fontSize: 11,
                    color: '#78909C',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={sel.showShapeLabel !== false}
                    onChange={(e) => patchObj(sel.id, { showShapeLabel: e.target.checked })}
                    style={{ accentColor: '#2563eb' }}
                  />
                  Sekil etiketini goster
                </label>
              </>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 11,
                  color: '#78909C',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={sel.visible !== false}
                  onChange={(e) => patchObj(sel.id, { visible: e.target.checked })}
                  style={{ accentColor: '#4CAF50' }}
                />
                Gorunur
              </label>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 11,
                  color: '#78909C',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={!!sel.locked}
                  onChange={(e) => patchObj(sel.id, { locked: e.target.checked })}
                  style={{ accentColor: '#FF9800' }}
                />
                Kilitli
              </label>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 11,
                  color: '#78909C',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={!!sel.isCheckButton}
                  onChange={(e) => patchObj(sel.id, { isCheckButton: e.target.checked })}
                  style={{ accentColor: '#2563eb' }}
                />
                Kontrol Et
              </label>
            </div>
            {variables.length > 0 && (
              <details style={{ marginTop: 6, borderTop: '1px solid #eef2f7', paddingTop: 6 }}>
                <summary
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    color: '#7c3aed',
                    letterSpacing: 0.5,
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                >
                  Değişken Bağlama
                </summary>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
                  {[
                    { key: 'label', label: 'Etiket' },
                    { key: 'visible', label: 'Görünürlük' },
                    { key: 'style.color', label: 'Yazı Rengi' },
                    { key: 'style.background', label: 'Arka Plan' },
                    { key: 'style.fontSize', label: 'Font Boyutu' },
                    { key: 'style.opacity', label: 'Opaklık' },
                  ].map((bp) => {
                    const bindings = sel.variableBindings || {};
                    const currentVal = bindings[bp.key] || '';
                    return (
                      <div key={bp.key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 10, color: '#64748b', minWidth: 70 }}>
                          {bp.label}
                        </span>
                        <select
                          value={currentVal}
                          onChange={(e) => {
                            const newBindings = { ...(sel.variableBindings || {}) };
                            if (e.target.value) {
                              newBindings[bp.key] = e.target.value;
                            } else {
                              delete newBindings[bp.key];
                            }
                            patchObj(sel.id, { variableBindings: newBindings });
                          }}
                          style={{
                            flex: 1,
                            fontSize: 10,
                            padding: '2px 4px',
                            border: '1px solid #cbd5e1',
                            borderRadius: 4,
                            background: currentVal ? '#f5f3ff' : '#fff',
                          }}
                        >
                          <option value="">— Bağlama yok —</option>
                          {variables.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name} ({v.type})
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                  <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 2 }}>
                    Seçilen değişkenin değeri çalışma zamanında bu özelliğe uygulanır.
                  </div>
                </div>
              </details>
            )}
          </div>
        </div>
      ) : showAnswerPanel ? (
        <div
          style={{
            ...card,
            textAlign: 'left',
            color: '#475569',
            fontSize: 12,
            padding: 16,
            lineHeight: 1.7,
          }}
        >
          <div style={{ fontWeight: 900, color: '#0f172a', marginBottom: 8, fontSize: 16 }}>
            Cevap ayarlari Cevap Kontrol Merkezi'nde
          </div>
          <div style={{ marginBottom: 12 }}>
            Cevap duzenleme tek kaynak olarak sag ustteki Cevap butonuyla acilan merkezden
            yapilir.
          </div>
          <button
            type="button"
            onClick={onOpenAnswerCenter}
            style={{
              width: '100%',
              minHeight: 34,
              borderRadius: 8,
              border: '1px solid #1d4ed8',
              background: '#1769e8',
              color: '#ffffff',
              fontSize: 12,
              fontWeight: 900,
              cursor: 'pointer',
            }}
          >
            Cevap Merkezini Ac
          </button>
        </div>
      ) : showScenePanel ? null : (
        <div
          style={{
            ...card,
            textAlign: 'left',
            color: '#475569',
            fontSize: 11,
            padding: 16,
            lineHeight: 1.75,
          }}
        >
          <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: 8, fontSize: 16 }}>
            Bu bolum bos
          </div>
          <div>
            {showInteractionPanel
              ? 'Tetikleyici ve degiskenleri bu sekmede yonetebilirsin.'
              : 'Düzenlemek istedigin bolumu yukaridan sec.'}
          </div>
        </div>
      )}

      {showScenePanel && (
        <>
          {(!hideLayerManagement || scenePanelMode !== 'settings') && (
          <div style={sectionShell}>
            {!hideLayerManagement && (
              <>
            <div style={sectionHeader}>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 900,
                    color: '#2563eb',
                    letterSpacing: 0.5,
                    textTransform: 'uppercase',
                  }}
                >
                  Sahne Katmanlari
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                  {layers.length} katman
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
                <button
                  onClick={() => {
                    const newLayer = createLayer('', layers.length);
                    patchAct({ layers: [...layers, newLayer], activeLayerId: newLayer.id });
                  }}
                  title="Yeni katman ekle"
                  style={{
                    minWidth: 34,
                    height: 32,
                    borderRadius: 10,
                    border: '1px solid #bfdbfe',
                    background: '#ffffff',
                    color: '#2563eb',
                    fontSize: 18,
                    fontWeight: 700,
                    cursor: 'pointer',
                    lineHeight: 1,
                  }}
                >
                  +
                </button>
              </div>
            </div>
            <div style={{ padding: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {orderedSceneLayers.map((layer, index) => {
                const isActiveLayer = activity.activeLayerId === layer.id;
                const visibleCount = objects.filter(
                  (obj) => (obj.layerId || 'base') === layer.id && obj.visible !== false
                ).length;
                const resolvedLayerName =
                  resolvedLayerNames[layer.id] ||
                  (layer.kind === 'base' ? 'Base Layer' : `Layer ${index + 1}`);
                const actualIndex = layers.findIndex((item) => item.id === layer.id);
                const isEditing = editingLayerId === layer.id && layer.kind !== 'base';
                const isDefaultOverlayLayer =
                  layer.kind !== 'base' && isDefaultOverlayLayerName(resolvedLayerName);
                const canReorderLayer = layer.kind !== 'base' && !isDefaultOverlayLayer;
                return (
                  <div
                    key={layer.id}
                    onClick={() => patchAct({ activeLayerId: layer.id, selectedObjectId: null })}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '42px 1fr auto',
                      gap: 7,
                      alignItems: 'center',
                      padding: '5px 6px',
                      borderRadius: 8,
                      cursor: 'pointer',
                      border: `1px solid ${isActiveLayer ? '#2b7de9' : '#dce3eb'}`,
                      background: isActiveLayer
                        ? 'linear-gradient(180deg,#2b8cf4,#1f73dd)'
                        : 'linear-gradient(180deg,#ffffff,#f7f9fc)',
                      boxShadow: isActiveLayer
                        ? '0 8px 14px rgba(37,99,235,.18)'
                        : 'inset 0 1px 0 rgba(255,255,255,.9)',
                    }}
                  >
                    <LayerThumbnail
                      activity={activity}
                      layer={layer}
                      isActive={isActiveLayer}
                      getCanvasObjects={getCanvasObjects}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                        {isEditing ? (
                          <input
                            autoFocus
                            value={layer.autoName === false ? layer.name || '' : resolvedLayerName}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => saveLayerName(layer.id, e.target.value)}
                            onBlur={() => setEditingLayerId(null)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                saveLayerName(layer.id, e.currentTarget.value);
                                setEditingLayerId(null);
                              }
                              if (e.key === 'Escape') {
                                setEditingLayerId(null);
                              }
                            }}
                            style={{
                              flex: 1,
                              minWidth: 0,
                              height: 24,
                              border: '1px solid rgba(255,255,255,.5)',
                              borderRadius: 6,
                              background: '#ffffff',
                              color: '#0f172a',
                              fontSize: 11,
                              fontWeight: 700,
                              padding: '0 8px',
                              outline: 'none',
                            }}
                          />
                        ) : (
                          <>
                            <button
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                if (layer.kind !== 'base') setEditingLayerId(layer.id);
                              }}
                              style={{
                                flex: 1,
                                minWidth: 0,
                                border: 'none',
                                background: 'transparent',
                                padding: 0,
                                textAlign: 'left',
                                cursor: layer.kind === 'base' ? 'default' : 'text',
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  color: isActiveLayer ? '#ffffff' : '#1e293b',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {resolvedLayerName}
                              </div>
                            </button>
                            {layer.kind === 'base' && (
                              <span
                                style={{
                                  fontSize: 11,
                                  fontStyle: 'italic',
                                  color: isActiveLayer ? 'rgba(255,255,255,.88)' : '#64748b',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                (Base Layer)
                              </span>
                            )}
                            {isDefaultOverlayLayer && (
                              <span
                                style={{
                                  padding: '1px 5px',
                                  borderRadius: 999,
                                  border: `1px solid ${isActiveLayer ? 'rgba(255,255,255,.38)' : '#d9e2ec'}`,
                                  color: isActiveLayer ? '#eff6ff' : '#64748b',
                                  fontSize: 11,
                                  fontWeight: 800,
                                  letterSpacing: 0.3,
                                }}
                              >
                                AUTO
                              </span>
                            )}
                          </>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: isActiveLayer ? 'rgba(255,255,255,.82)' : '#7b8794',
                          marginTop: 2,
                        }}
                      >
                        {visibleCount} obje · {isActiveLayer ? 'aktif' : 'tikla'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {layer.kind !== 'base' && !isEditing && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingLayerId(layer.id);
                          }}
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: 999,
                            border: `1px solid ${isActiveLayer ? 'rgba(255,255,255,.35)' : '#d1d5db'}`,
                            background: isActiveLayer ? 'rgba(255,255,255,.14)' : '#ffffff',
                            color: isActiveLayer ? '#ffffff' : '#64748b',
                            cursor: 'pointer',
                            fontSize: 11,
                            lineHeight: 1,
                          }}
                        >
                          ✎
                        </button>
                      )}
                      {canReorderLayer && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (actualIndex > 0) {
                              const nextLayers = [...layers];
                              [nextLayers[actualIndex - 1], nextLayers[actualIndex]] = [
                                nextLayers[actualIndex],
                                nextLayers[actualIndex - 1],
                              ];
                              patchAct({ layers: nextLayers });
                            }
                          }}
                          style={{
                            width: 17,
                            height: 17,
                            borderRadius: 999,
                            border: '1px solid #d1d5db',
                            background: '#ffffff',
                            color: '#64748b',
                            cursor: 'pointer',
                            fontSize: 11,
                            lineHeight: 1,
                          }}
                        >
                          ↑
                        </button>
                      )}
                      {canReorderLayer && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (actualIndex < layers.length - 1) {
                              const nextLayers = [...layers];
                              [nextLayers[actualIndex + 1], nextLayers[actualIndex]] = [
                                nextLayers[actualIndex],
                                nextLayers[actualIndex + 1],
                              ];
                              patchAct({ layers: nextLayers });
                            }
                          }}
                          style={{
                            width: 17,
                            height: 17,
                            borderRadius: 999,
                            border: '1px solid #d1d5db',
                            background: '#ffffff',
                            color: '#64748b',
                            cursor: 'pointer',
                            fontSize: 11,
                            lineHeight: 1,
                          }}
                        >
                          ↓
                        </button>
                      )}
                      <span
                        title="Katman durumu"
                        style={{
                          width: 17,
                          height: 17,
                          borderRadius: 999,
                          border: '1px solid #d1d5db',
                          background: '#ffffff',
                          color: visibleCount > 0 ? '#2563eb' : '#94a3b8',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 11,
                        }}
                      >
                        ◐
                      </span>
                      {layer.kind !== 'base' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeLayerSafely(layer.id);
                          }}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: '#ef4444',
                            cursor: 'pointer',
                            fontSize: 12,
                            lineHeight: 1,
                          }}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
              </>
            )}
            {scenePanelMode !== 'settings' && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr',
                gap: 8,
                padding: '8px 10px',
                borderTop: '1px solid #dde5ee',
                background: '#f8fafc',
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
                <div style={{ fontSize: 11, fontWeight: 900, color: '#334155' }}>
                  Layer Görünüm Paketleri
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    onClick={() => onSetBookDefaultStylePreset?.(answerLayerStylePresetId)}
                    disabled={!onSetBookDefaultStylePreset}
                    style={{
                      height: 22,
                      padding: '0 8px',
                      borderRadius: 999,
                      border:
                        answerLayerStylePresetId === bookDefaultStylePresetId
                          ? '1px solid #86efac'
                          : '1px solid #bfdbfe',
                      background:
                        answerLayerStylePresetId === bookDefaultStylePresetId
                          ? '#ecfdf5'
                          : '#eff6ff',
                      color:
                        answerLayerStylePresetId === bookDefaultStylePresetId
                          ? '#15803d'
                          : '#1d4ed8',
                      fontSize: 10,
                      fontWeight: 900,
                      cursor: onSetBookDefaultStylePreset ? 'pointer' : 'default',
                      opacity: onSetBookDefaultStylePreset ? 1 : 0.45,
                    }}
                    title="Seçili stili bu kitabın yeni etkinlikleri için varsayılan yap"
                  >
                    Kitap Varsayılanı
                  </button>
                  <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700 }}>
                    {ANSWER_LAYER_STYLE_PRESETS.length} stil
                  </div>
                </div>
              </div>
              {/* Sınıf grubu filtre sekmesi */}
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {[{ id: 'all', label: 'Tümü', icon: '📚', color: '#94a3b8' }, ...GRADE_GROUPS].map(
                  (g) => {
                    const isActive = presetGradeFilter === g.id;
                    return (
                      <button
                        key={g.id}
                        onClick={() => setPresetGradeFilter(g.id)}
                        style={{
                          padding: '2px 7px',
                          borderRadius: 999,
                          border: `1px solid ${isActive ? g.color || '#60a5fa' : '#cbd5e1'}`,
                          background: isActive ? `${g.color || '#60a5fa'}18` : '#ffffff',
                          color: isActive ? g.color || '#1d4ed8' : '#64748b',
                          fontSize: 10,
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
                  gridTemplateColumns: '1fr',
                  gap: 5,
                  maxHeight: 360,
                  overflowY: 'auto',
                  paddingRight: 2,
                }}
              >
                {(presetGradeFilter === 'all'
                  ? ANSWER_LAYER_STYLE_PRESETS
                  : ANSWER_LAYER_STYLE_PRESETS.filter((p) => p.gradeGroup === presetGradeFilter)
                ).map((preset) => {
                  const selected = preset.id === answerLayerStylePresetId;
                  return (
                    <button
                      key={preset.id}
                      onClick={() => handleAnswerLayerStylePresetChange(preset.id)}
                      title={preset.desc}
                      style={{
                        textAlign: 'left',
                        minHeight: 46,
                        padding: '6px 8px',
                        borderRadius: 9,
                        border: selected
                          ? `2px solid ${preset.surfaceBorder || '#bfdbfe'}`
                          : '1px solid #dbe7f5',
                        background: selected
                          ? `linear-gradient(180deg,${preset.surfaceAlt || '#f8fafc'},${preset.surface || '#ffffff'})`
                          : '#ffffff',
                        color: '#0f172a',
                        cursor: 'pointer',
                        boxShadow: selected
                          ? '0 8px 16px rgba(15,23,42,.1)'
                          : '0 3px 8px rgba(15,23,42,.04)',
                        display: 'grid',
                        gridTemplateColumns: '28px minmax(0,1fr)',
                        gap: 7,
                        alignItems: 'center',
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 8,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: preset.accentGradient,
                          color: preset.accentText || '#ffffff',
                          boxShadow: preset.surfaceShadow,
                          fontSize: 14,
                          fontWeight: 900,
                        }}
                      >
                        {preset.icon}
                      </span>
                      <span
                        style={{
                          minWidth: 0,
                          display: 'grid',
                          gridTemplateColumns: 'minmax(0,88px) minmax(0,1fr)',
                          gap: 6,
                          alignItems: 'center',
                        }}
                      >
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 900,
                            color: preset.titleColor || '#0f172a',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {preset.name}
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            color: '#64748b',
                            lineHeight: 1.2,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {preset.desc}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.35, minWidth: 0 }}>
                  menu, explanation, normal, Correct, Incorrect ve cevap katmanlari secili stile
                  gore otomatik yerlesir.
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <button
                    onClick={handleGenerateAnswerLayerSceneSet}
                    style={{
                      minHeight: 28,
                      padding: '0 10px',
                      borderRadius: 8,
                      border: '1px solid #bfdbfe',
                      background: '#eff6ff',
                      color: '#1d4ed8',
                      fontSize: 10,
                      fontWeight: 900,
                      cursor: 'pointer',
                      lineHeight: 1.15,
                    }}
                  >
                    Stili Uygula
                  </button>
                  <button
                    onClick={handleGenerateAnswerLayerSceneSet}
                    style={{
                      minHeight: 28,
                      padding: '0 9px',
                      borderRadius: 8,
                      border: '1px solid #c7d2fe',
                      background: '#eef2ff',
                      color: '#4338ca',
                      fontSize: 10,
                      fontWeight: 900,
                      cursor: 'pointer',
                      maxWidth: 116,
                      lineHeight: 1.15,
                    }}
                  >
                    Cevap Sahne Seti Oluştur
                  </button>
                </div>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: isCevapLayerActive ? '1fr 1fr' : '1fr',
                  gap: 6,
                }}
              >
                {isCevapLayerActive && (
                  <button
                    onClick={handleGenerateAnswerLayerObjects}
                    style={{
                      minHeight: 28,
                      padding: '0 8px',
                      borderRadius: 8,
                      border: '1px solid #bfdbfe',
                      background: '#eff6ff',
                      color: '#1d4ed8',
                      fontSize: 10,
                      fontWeight: 900,
                      cursor: 'pointer',
                    }}
                  >
                    Cevap Anahtarını Üret
                  </button>
                )}
                <div style={{ display: 'flex', minWidth: 0 }}>
                  <input
                    value={layerPresetName}
                    onChange={(e) => setLayerPresetName(e.target.value)}
                    placeholder="Katman seti adı"
                    style={{
                      height: 28,
                      flex: 1,
                      minWidth: 0,
                      borderRadius: '8px 0 0 8px',
                      border: '1px solid #dbe7f5',
                      borderRight: 'none',
                      background: '#ffffff',
                      color: '#334155',
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '0 8px',
                      outline: 'none',
                    }}
                  />
                  <button
                    onClick={() => {
                      const presetId = onSaveLayerPreset(layerPresetName, safeActivity);
                      if (presetId) setSelectedLayerPresetId(presetId);
                    }}
                    style={{
                      minHeight: 28,
                      padding: '0 8px',
                      borderRadius: '0 8px 8px 0',
                      border: '1px solid #bbf7d0',
                      background: '#f0fdf4',
                      color: '#15803d',
                      fontSize: 10,
                      fontWeight: 900,
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    Kaydet
                  </button>
                </div>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) auto',
                  gap: 6,
                  alignItems: 'center',
                }}
              >
                <select
                  value={selectedLayerPresetId}
                  onChange={(e) => setSelectedLayerPresetId(e.target.value)}
                  style={{
                    height: 28,
                    minWidth: 0,
                    width: '100%',
                    borderRadius: 8,
                    border: '1px solid #dbe7f5',
                    background: '#ffffff',
                    color: '#334155',
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '0 8px',
                    outline: 'none',
                  }}
                >
                  <option value="">Set sec</option>
                  {layerPresets.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    if (!selectedLayerPresetId) return;
                    onApplyLayerPreset(selectedLayerPresetId, safeActivity.id);
                  }}
                  disabled={!selectedLayerPresetId}
                  style={{
                    minHeight: 28,
                    padding: '0 9px',
                    borderRadius: 8,
                    border: '1px solid #bfdbfe',
                    background: selectedLayerPresetId ? '#eff6ff' : '#f1f5f9',
                    color: selectedLayerPresetId ? '#1d4ed8' : '#94a3b8',
                    fontSize: 10,
                    fontWeight: 900,
                    cursor: selectedLayerPresetId ? 'pointer' : 'default',
                    flexShrink: 0,
                  }}
                >
                  Uygula
                </button>
              </div>
            </div>
            )}
          </div>
          )}

          {scenePanelMode !== 'style' && (
          <div style={sectionShell}>
            <details open style={{ padding: 10 }}>
              <summary
                style={{
                  fontSize: 11,
                  fontWeight: 900,
                  color: '#2563eb',
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  marginBottom: 8,
                  userSelect: 'none',
                }}
              >
                Slide Özellikleri
              </summary>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <SelectInp
                  label="Başlangıç Sahnesi"
                  value={startSlideOptions[0]?.value || ''}
                  onChange={() => {}}
                  options={startSlideOptions.slice(0, 1)}
                />
                <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.45 }}>
                  Runtime her zaman ana sahneden ve Base Layer'dan başlar.
                </div>
                <SelectInp
                  label="Sahne Şablonu"
                  value={currentSceneTemplateId}
                  onChange={(e) => handleSceneTemplateChange(e.target.value)}
                  options={SCENE_TEMPLATE_OPTIONS}
                />
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0,1fr) auto',
                    gap: 8,
                    alignItems: 'center',
                  }}
                >
                  <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.45 }}>
                    {currentSceneTemplateId
                      ? `${currentSceneTemplateLabel} ${answerLayerStylePreset?.name || 'seçili'} stiline göre otomatik güncellenir.`
                      : 'İstersen seçili sahneyi tek tıkla etkinlik giriş sayfasına çevirebilirsin.'}
                  </div>
                  <button
                    onClick={() =>
                      handleSceneTemplateChange(
                        currentSceneTemplateId || SCENE_TEMPLATE_LAUNCH_PAGE_ID
                      )
                    }
                    style={{
                      minHeight: 30,
                      padding: '0 10px',
                      borderRadius: 8,
                      border: '1px solid #bfdbfe',
                      background: '#eff6ff',
                      color: '#1d4ed8',
                      fontSize: 10,
                      fontWeight: 900,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {currentSceneTemplateId ? 'Şablonu Yenile' : 'Girişi Doldur'}
                  </button>
                </div>
                <SelectInp
                  label="İlerleme Modu"
                  value={activity.slideAdvance || 'user'}
                  onChange={(e) => patchAct({ slideAdvance: e.target.value })}
                  options={SLIDE_ADVANCE_OPTIONS}
                />
                {(activity.slideAdvance === 'auto' || activity.slideAdvance === 'both') && (
                  <Inp
                    label="Otomatik Geçiş (sn)"
                    type="number"
                    value={activity.slideAutoAdvanceDelay ?? 5}
                    onChange={(e) =>
                      patchAct({ slideAutoAdvanceDelay: Math.max(1, +e.target.value || 5) })
                    }
                  />
                )}
                <SelectInp
                  label="Tekrar Ziyaret"
                  value={activity.slideRevisit || 'resume'}
                  onChange={(e) => patchAct({ slideRevisit: e.target.value })}
                  options={SLIDE_REVISIT_OPTIONS}
                />
                <SelectInp
                  label="Erişilebilirlik Seviyesi"
                  value={activity.accessibilityLevel || 'AA'}
                  onChange={(e) => patchAct({ accessibilityLevel: e.target.value })}
                  options={WCAG_LEVEL_OPTIONS}
                />
              </div>
            </details>
            <details style={{ padding: 10, borderTop: '1px solid #eef2f7' }}>
              <summary
                style={{
                  fontSize: 11,
                  fontWeight: 900,
                  color: '#2563eb',
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  marginBottom: 8,
                  userSelect: 'none',
                }}
              >
                Konuşmacı Notları
              </summary>
              <textarea
                value={activity.speakerNotes || ''}
                onChange={(e) => patchAct({ speakerNotes: e.target.value })}
                rows={5}
                placeholder="Bu sahne için konuşmacı notlarınızı buraya yazın..."
                style={{
                  width: '100%',
                  borderRadius: 10,
                  border: '1px solid #dbe7f5',
                  padding: 10,
                  fontSize: 12,
                  lineHeight: 1.65,
                  resize: 'vertical',
                  background: '#fbfdff',
                  color: '#0f172a',
                }}
              />
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                {(activity.speakerNotes || '').length} karakter
              </div>
            </details>
          </div>
          )}
        </>
      )}

      {showObjectPanel && !hideLayerManagement && (
        <div style={sectionShell}>
          <div style={sectionHeader}>
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 900,
                  color: '#2563eb',
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                }}
              >
                Katman Ogeleri
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>
                {objectListLayerName}
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                {groupedObjectListEntries.length} oge
                {hiddenObjectCount ? ` • ${hiddenObjectCount} gizli` : ''}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <span style={miniMetric}>{layerVisibleCount} gorunur</span>
              <span style={miniMetric}>
                {sel
                  ? 'Secim aktif'
                  : multiSel
                    ? `${selectedObjectCount} secili`
                    : 'Katman listesi'}
              </span>
            </div>
          </div>
          {groupedObjectListEntries.length > 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                maxHeight: 240,
                overflowY: 'auto',
                padding: 10,
              }}
            >
              {getEditorGroupedObjectEntries(
                activity,
                [...objectListObjects].sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0))
              ).map(({ primaryId, ids, object: o }) => {
                const isSelectedObject =
                  ids.some((id) => selectedIds.has(id)) || activity.selectedObjectId === primaryId;
                const glyph =
                  {
                    text: 'T',
                    button: 'B',
                    shape: '■',
                    image: 'I',
                    video: 'V',
                    audio: '♪',
                    hotspot: '◎',
                    draggable: '↕',
                    dropzone: '▭',
                  }[o.type] || '•';
                return (
                  <div
                    key={primaryId}
                    onClick={() => {
                      onSelectionChange(new Set(ids));
                      onUpdate({
                        ...activity,
                        selectedObjectId: primaryId,
                        activeLayerId: o.layerId || 'base',
                      });
                    }}
                    style={{
                      padding: '8px 9px',
                      borderRadius: 12,
                      cursor: 'pointer',
                      background: isSelectedObject
                        ? 'linear-gradient(180deg,#eaf4ff,#ffffff)'
                        : 'linear-gradient(180deg,#ffffff,#f8fbff)',
                      fontSize: 11,
                      color: '#111111',
                      display: 'flex',
                      gap: 8,
                      alignItems: 'center',
                      border: `1px solid ${isSelectedObject ? '#93c5fd' : '#d8e0ea'}`,
                      boxShadow: isSelectedObject
                        ? '0 12px 20px rgba(37,99,235,.1)'
                        : '0 6px 12px rgba(15,23,42,.04)',
                    }}
                  >
                    <span
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 6,
                        border: `1px solid ${isSelectedObject ? '#93c5fd' : '#dbe7f5'}`,
                        background: isSelectedObject ? '#eff6ff' : '#f8fafc',
                        color: isSelectedObject ? '#1d4ed8' : '#475569',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11,
                        fontWeight: 800,
                        flexShrink: 0,
                      }}
                    >
                      {glyph}
                    </span>
                    <span style={{ fontSize: 11, color: '#64748b', width: 18, flexShrink: 0 }}>
                      z{o.zIndex || 0}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          opacity: o.visible === false ? 0.45 : 1,
                          fontSize: 11,
                          fontWeight: 800,
                          color: '#0f172a',
                        }}
                      >
                        {o.label || o.type}
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          marginTop: 4,
                          flexWrap: 'wrap',
                        }}
                      >
                        <span
                          style={{
                            fontSize: 11,
                            color: '#64748b',
                            textTransform: 'uppercase',
                            letterSpacing: 0.35,
                          }}
                        >
                          {o.type}
                        </span>
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>
                          {Math.round(o.width || 0)} x {Math.round(o.height || 0)}
                        </span>
                        {ids.length > 1 && (
                          <span style={{ fontSize: 11, color: '#7c3aed', fontWeight: 800 }}>
                            Birlesik {ids.length}
                          </span>
                        )}
                        {o.groupId && (
                          <span style={{ fontSize: 11, color: '#7c3aed', fontWeight: 800 }}>
                            Grup
                          </span>
                        )}
                      </div>
                    </div>
                    <span
                      style={{
                        padding: '2px 6px',
                        borderRadius: 999,
                        background: o.visible === false ? '#f1f5f9' : '#dbeafe',
                        color: o.visible === false ? '#94a3b8' : '#2563eb',
                        fontSize: 11,
                        fontWeight: 900,
                      }}
                    >
                      {o.visible === false ? 'Gizli' : 'Gorunur'}
                    </span>
                    {o.locked && (
                      <span
                        style={{
                          padding: '2px 6px',
                          borderRadius: 999,
                          background: '#fff7ed',
                          color: '#c2410c',
                          fontSize: 11,
                          fontWeight: 900,
                        }}
                      >
                        Kilitli
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div
              style={{
                padding: '20px 14px',
                fontSize: 11,
                color: '#64748b',
                textAlign: 'center',
                lineHeight: 1.7,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>
                Bu katmanda henuz oge yok
              </div>
              <div>
                {objectListLayerName} icin yeni kutu, metin veya medya eklediginde burada
                siralanacak.
              </div>
            </div>
          )}
        </div>
      )}

      {!hideTimeline && showTimelinePanel && (
        <div style={sectionShell}>
          <div style={sectionHeader}>
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 900,
                  color: '#2563eb',
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                }}
              >
                Zaman Akisi
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>
                {timeline.length ? `${timeline.length} klip hazir` : 'Klip bekleniyor'}
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                {timeline.reduce((s, t) => s + (t.duration || 0), 0).toFixed(1)}sn toplam sure •
                giris/cikis efektleri burada hizlanir
              </div>
            </div>
            <button
              onClick={() =>
                patchAct({ timeline: [...timeline, createTimelineItem(timeline.length)] })
              }
              style={{
                minWidth: 34,
                height: 32,
                borderRadius: 10,
                border: '1px solid #bbf7d0',
                background: '#ffffff',
                color: '#15803d',
                fontSize: 18,
                fontWeight: 700,
                cursor: 'pointer',
                lineHeight: 1,
              }}
            >
              +
            </button>
          </div>
          <div style={{ padding: 10 }}>
            {timeline.map((item) => (
              <div
                key={item.id}
                style={{
                  border: '1px solid #dbe7f5',
                  borderRadius: 14,
                  padding: 10,
                  marginBottom: 8,
                  background: 'linear-gradient(180deg,#ffffff,#f8fbff)',
                  boxShadow: '0 10px 18px rgba(15,23,42,.04)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 8,
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 900,
                        color: '#2563eb',
                        letterSpacing: 0.4,
                        textTransform: 'uppercase',
                      }}
                    >
                      {item.entryEffect || 'fade'} → {item.exitEffect || 'none'}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 800,
                        color: '#0f172a',
                        marginTop: 4,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {item.name || 'Adsiz animasyon'}
                    </div>
                  </div>
                  <button
                    onClick={() => patchAct({ timeline: timeline.filter((x) => x.id !== item.id) })}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: '#ef4444',
                      cursor: 'pointer',
                      fontSize: 14,
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                  <span style={miniMetric}>{Number(item.start || 0).toFixed(1)}sn baslangic</span>
                  <span style={miniMetric}>{Number(item.duration || 0).toFixed(1)}sn sure</span>
                  <span style={miniMetric}>{item.direction || 'left'}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <Inp
                    value={item.name}
                    onChange={(e) => patchTimeline(item.id, { name: e.target.value })}
                    placeholder="Animasyon adi"
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <Inp
                      label="Bas"
                      type="number"
                      value={item.start}
                      onChange={(e) => patchTimeline(item.id, { start: +e.target.value || 0 })}
                    />
                    <Inp
                      label="Sure"
                      type="number"
                      value={item.duration}
                      onChange={(e) => patchTimeline(item.id, { duration: +e.target.value || 0 })}
                    />
                  </div>
                </div>
              </div>
            ))}
            {timeline.length === 0 && (
              <div
                style={{
                  fontSize: 11,
                  color: '#64748b',
                  textAlign: 'center',
                  padding: '18px 10px',
                  lineHeight: 1.7,
                }}
              >
                Animasyon eklediginde bu alanda klip kartlari olusacak.
              </div>
            )}
          </div>
        </div>
      )}

      {showInteractionPanel && (
        <div style={sectionShell}>
          <div style={sectionHeader}>
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 900,
                  color: '#2563eb',
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                }}
              >
                Etkilesim Ozeti
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>
                {isAdvancedMode ? 'Kurgu aktif' : 'Temel mod'}
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                {isAdvancedMode
                  ? 'Trigger ve degisken kartlari hemen asagida'
                  : "Tetikleyici ve değişken düzenleme için Gelişmiş Mod'u açın."}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <span style={miniMetric}>{triggers.length} trigger</span>
              <span style={miniMetric}>{variables.length} degisken</span>
            </div>
          </div>
        </div>
      )}

      {showInteractionPanel && !isAdvancedMode && (
        <div style={card}>
          <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: 8, fontSize: 16 }}>
            Temel Mod
          </div>
          <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.7, marginBottom: 12 }}>
            Tetikleyiciler ve değişkenler <strong>Gelişmiş Mod</strong> ile düzenlenebilir. Şu anda{' '}
            {triggers.length} tetikleyici ve {variables.length} değişken tanımlı.
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                color: '#2563eb',
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              ⇄ {triggers.length} Tetikleyici
            </span>
            <span
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                color: '#16a34a',
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              x {variables.length} Değişken
            </span>
          </div>
        </div>
      )}

      {showInteractionPanel && isAdvancedMode && (
        <div style={card}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 6,
            }}
          >
            <div style={s10}>DEGISKENLER</div>
            <button
              onClick={() => patchVariables((prev) => [...prev, createVariableItem(prev.length)])}
              style={{
                background: '#ffffff',
                border: '1px solid #111111',
                color: '#111111',
                borderRadius: 0,
                cursor: 'pointer',
                fontSize: 11,
                padding: '2px 6px',
              }}
            >
              +
            </button>
          </div>
          {variables.map((variable, index) => (
            <div
              key={variable.id}
              style={{
                background: '#ffffff',
                border: '1px solid #111111',
                borderRadius: 0,
                padding: 7,
                marginBottom: 6,
              }}
            >
              <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginBottom: 6 }}>
                <Inp
                  value={variable.name || ''}
                  onChange={(e) =>
                    patchVariables((prev) =>
                      prev.map((item) =>
                        item.id === variable.id ? { ...item, name: e.target.value } : item
                      )
                    )
                  }
                  placeholder={`Degisken ${index + 1}`}
                />
                <button
                  onClick={() =>
                    patchVariables((prev) => prev.filter((item) => item.id !== variable.id))
                  }
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: '#f44336',
                    cursor: 'pointer',
                    fontSize: 12,
                  }}
                >
                  ×
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <SelectInp
                  label="Tip"
                  value={variable.type || 'number'}
                  onChange={(e) =>
                    patchVariables((prev) =>
                      prev.map((item) =>
                        item.id === variable.id
                          ? {
                              ...item,
                              type: e.target.value,
                              value: castVariableValue(
                                e.target.value,
                                item.value ?? getDefaultVariableValue(e.target.value)
                              ),
                            }
                          : item
                      )
                    )
                  }
                  options={VARIABLE_TYPES}
                />
                {variable.type === 'boolean' ? (
                  <SelectInp
                    label="Ilk Deger"
                    value={String(!!variable.value)}
                    onChange={(e) =>
                      patchVariables((prev) =>
                        prev.map((item) =>
                          item.id === variable.id
                            ? { ...item, value: e.target.value === 'true' }
                            : item
                        )
                      )
                    }
                    options={boolOptions}
                  />
                ) : (
                  <Inp
                    label="Ilk Deger"
                    type={variable.type === 'number' ? 'number' : 'text'}
                    value={variable.value ?? ''}
                    onChange={(e) =>
                      patchVariables((prev) =>
                        prev.map((item) =>
                          item.id === variable.id
                            ? { ...item, value: castVariableValue(variable.type, e.target.value) }
                            : item
                        )
                      )
                    }
                  />
                )}
              </div>
            </div>
          ))}
          {variables.length === 0 && (
            <div style={{ fontSize: 11, color: '#333', textAlign: 'center' }}>
              Global degisken yok
            </div>
          )}
        </div>
      )}

      {showInteractionPanel && isAdvancedMode && (
        <div style={card}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 6,
            }}
          >
            <div style={s10}>TETIKLEYICILER</div>
            <button
              onClick={() => {
                const t = createTriggerItem(triggers.length);
                const nt = t.target || 'Secili Nesne';
                const nw = t.when || 'onClick';
                const deduped = triggers.filter(
                  (item) =>
                    (item.target || 'Secili Nesne') !== nt || (item.when || 'onClick') !== nw
                );
                patchAct({ triggers: [...deduped, t] });
              }}
              style={{
                background: '#ffffff',
                border: '1px solid #111111',
                color: '#111111',
                borderRadius: 0,
                cursor: 'pointer',
                fontSize: 11,
                padding: '2px 6px',
              }}
            >
              +
            </button>
          </div>
          {triggers.map((item, index) => {
            const conditionCount = Array.isArray(item.conditions) ? item.conditions.length : 0;
            const accent =
              item.when === 'onLoad'
                ? '#8b5cf6'
                : item.when === 'onHover'
                  ? '#f59e0b'
                  : item.when === 'onDrop'
                    ? '#10b981'
                    : '#2563eb';
            return (
              <div
                key={item.id}
                style={{
                  background: 'linear-gradient(180deg,#ffffff,#f8fbff)',
                  border: `1px solid ${isAdvancedMode ? '#dbe7f5' : '#111111'}`,
                  borderRadius: 12,
                  padding: 8,
                  marginBottom: 8,
                  boxShadow: '0 8px 18px rgba(15,23,42,.05)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 8,
                    marginBottom: 8,
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}
                    >
                      <span
                        style={{
                          padding: '3px 7px',
                          borderRadius: 999,
                          background: `${accent}18`,
                          color: accent,
                          border: `1px solid ${accent}44`,
                          fontSize: 11,
                          fontWeight: 800,
                        }}
                      >
                        Trigger {index + 1}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#0f172a' }}>
                        {describeTrigger(item)}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                      {item.name || 'Kosullu aksiyon satiri'}
                    </div>
                  </div>
                  <button
                    onClick={() => patchAct({ triggers: triggers.filter((x) => x.id !== item.id) })}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: '#ef4444',
                      cursor: 'pointer',
                      fontSize: 14,
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '62px 1fr 42px 1fr 42px 1fr',
                    gap: 6,
                    alignItems: 'end',
                  }}
                >
                  <div
                    style={{ fontSize: 11, fontWeight: 800, color: '#64748b', paddingBottom: 6 }}
                  >
                    When
                  </div>
                  <SelectInp
                    value={item.when || 'onClick'}
                    onChange={(e) =>
                      patchTrigger(item.id, {
                        when: e.target.value,
                        target:
                          e.target.value === 'onLoad'
                            ? '__activity__'
                            : item.target || 'Secili Nesne',
                      })
                    }
                    options={TRIGGER_WHEN_OPTIONS}
                  />
                  <div
                    style={{ fontSize: 11, fontWeight: 800, color: '#64748b', paddingBottom: 6 }}
                  >
                    On
                  </div>
                  <SelectInp
                    value={item.target || 'Secili Nesne'}
                    onChange={(e) => patchTrigger(item.id, { target: e.target.value })}
                    options={
                      item.when === 'onLoad'
                        ? [{ value: '__activity__', label: 'Sahne / yukleme' }]
                        : triggerSourceOptions
                    }
                  />
                  <div
                    style={{ fontSize: 11, fontWeight: 800, color: '#64748b', paddingBottom: 6 }}
                  >
                    Do
                  </div>
                  <SelectInp
                    value={item.action || 'SayfaGec'}
                    onChange={(e) =>
                      patchTrigger(item.id, {
                        action: e.target.value,
                        value:
                          e.target.value === 'KatmanaGec'
                            ? layers[0]?.id || 'base'
                            : e.target.value === 'SliderGec'
                              ? '__next__'
                              : e.target.value === 'SayfaGec'
                                ? '__next__'
                                : e.target.value === 'Goster' ||
                                    e.target.value === 'Gizle' ||
                                    e.target.value === 'NesneDurumuAyarla'
                                  ? objects[0]?.id || ''
                                  : e.target.value === 'SesCal' ||
                                      e.target.value === 'SesDurdur' ||
                                      e.target.value === 'VideoCal' ||
                                      e.target.value === 'VideoDurdur'
                                    ? triggerMediaOptions[0]?.value || ''
                                    : e.target.value === 'DegiskenAta' ||
                                        e.target.value === 'DegiskenArttir' ||
                                        e.target.value === 'DegiskenAzalt'
                                      ? variables[0]?.id || ''
                                      : item.value || '',
                        extra:
                          e.target.value === 'DegiskenArttir' || e.target.value === 'DegiskenAzalt'
                            ? '1'
                            : item.extra || '',
                        stateKey:
                          e.target.value === 'NesneDurumuAyarla'
                            ? 'visited'
                            : item.stateKey || 'visited',
                        stateValue:
                          e.target.value === 'NesneDurumuAyarla'
                            ? 'true'
                            : item.stateValue || 'true',
                      })
                    }
                    options={TRIGGER_ACTION_OPTIONS}
                  />
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                    gap: 6,
                    marginTop: 8,
                  }}
                >
                  <Inp
                    label="Ad"
                    value={item.name || ''}
                    onChange={(e) => patchTrigger(item.id, { name: e.target.value })}
                    placeholder="Kosullu gecis"
                  />
                  {item.action === 'KatmanaGec' ? (
                    <SelectInp
                      label="Hedef Katman"
                      value={item.value || layers[0]?.id || 'base'}
                      onChange={(e) => patchTrigger(item.id, { value: e.target.value })}
                      options={triggerLayerOptions}
                    />
                  ) : item.action === 'SliderGec' ? (
                    <SelectInp
                      label="Hedef Slider"
                      value={item.value || '__next__'}
                      onChange={(e) => patchTrigger(item.id, { value: e.target.value })}
                      options={triggerSlideOptions}
                    />
                  ) : item.action === 'SayfaGec' ? (
                    <SelectInp
                      label="Hedef Sahne"
                      value={item.value || '__next__'}
                      onChange={(e) => patchTrigger(item.id, { value: e.target.value })}
                      options={
                        triggerActivityOptions.length
                          ? triggerActivityOptions
                          : [{ value: '__next__', label: 'Sonraki sahne' }]
                      }
                    />
                  ) : item.action === 'Goster' || item.action === 'Gizle' ? (
                    <SelectInp
                      label="Etkilenecek Nesne"
                      value={item.value || ''}
                      onChange={(e) => patchTrigger(item.id, { value: e.target.value })}
                      options={
                        triggerTargetOptions.length
                          ? triggerTargetOptions
                          : [{ value: '', label: 'Nesne yok' }]
                      }
                    />
                  ) : item.action === 'SesCal' ||
                    item.action === 'SesDurdur' ||
                    item.action === 'VideoCal' ||
                    item.action === 'VideoDurdur' ? (
                    <SelectInp
                      label="Medya"
                      value={item.value || ''}
                      onChange={(e) => patchTrigger(item.id, { value: e.target.value })}
                      options={
                        triggerMediaOptions.length
                          ? triggerMediaOptions
                          : [{ value: '', label: 'Medya yok' }]
                      }
                    />
                  ) : item.action === 'DegiskenAta' ? (
                    <>
                      <SelectInp
                        label="Degisken"
                        value={item.value || ''}
                        onChange={(e) => patchTrigger(item.id, { value: e.target.value })}
                        options={
                          variableOptions.length
                            ? variableOptions
                            : [{ value: '', label: 'Degisken yok' }]
                        }
                      />
                      <Inp
                        label="Yeni Deger"
                        value={item.extra || ''}
                        onChange={(e) => patchTrigger(item.id, { extra: e.target.value })}
                      />
                    </>
                  ) : item.action === 'DegiskenArttir' || item.action === 'DegiskenAzalt' ? (
                    <>
                      <SelectInp
                        label="Degisken"
                        value={item.value || ''}
                        onChange={(e) => patchTrigger(item.id, { value: e.target.value })}
                        options={
                          variableOptions.length
                            ? variableOptions
                            : [{ value: '', label: 'Degisken yok' }]
                        }
                      />
                      <Inp
                        label="Miktar"
                        type="number"
                        value={item.extra || '1'}
                        onChange={(e) => patchTrigger(item.id, { extra: e.target.value })}
                      />
                    </>
                  ) : item.action === 'NesneDurumuAyarla' ? (
                    <>
                      <SelectInp
                        label="Nesne"
                        value={item.value || ''}
                        onChange={(e) => patchTrigger(item.id, { value: e.target.value })}
                        options={
                          objectStateOptions.length
                            ? objectStateOptions
                            : [{ value: '', label: 'Nesne yok' }]
                        }
                      />
                      <SelectInp
                        label="Durum"
                        value={item.stateKey || 'visited'}
                        onChange={(e) => patchTrigger(item.id, { stateKey: e.target.value })}
                        options={OBJECT_STATE_OPTIONS}
                      />
                      <SelectInp
                        label="Deger"
                        value={String(item.stateValue ?? 'true')}
                        onChange={(e) => patchTrigger(item.id, { stateValue: e.target.value })}
                        options={boolOptions}
                      />
                    </>
                  ) : (
                    <Inp
                      label="Deger"
                      value={item.value || ''}
                      onChange={(e) => patchTrigger(item.id, { value: e.target.value })}
                    />
                  )}
                </div>

                <details open={conditionCount > 0} style={{ marginTop: 8 }}>
                  <summary
                    style={{
                      cursor: 'pointer',
                      listStyle: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      fontSize: 11,
                      fontWeight: 800,
                      color: '#334155',
                    }}
                  >
                    <span>Kosullar {conditionCount ? `(${conditionCount})` : ''}</span>
                    <span style={{ fontSize: 11, color: '#64748b' }}>
                      {getOptionLabel(triggerModeOptions, item.conditionMode || 'all', 'Tumu')}
                    </span>
                  </summary>
                  <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 8, marginTop: 6 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 6,
                        marginBottom: 6,
                      }}
                    >
                      <SelectInp
                        value={item.conditionMode || 'all'}
                        onChange={(e) => patchTrigger(item.id, { conditionMode: e.target.value })}
                        options={triggerModeOptions}
                      />
                      <button
                        onClick={() =>
                          patchTriggerConditions(item.id, (prev) => [
                            ...prev,
                            createTriggerConditionItem(prev.length),
                          ])
                        }
                        style={{
                          minHeight: 28,
                          padding: '0 10px',
                          borderRadius: 8,
                          border: '1px solid #cbd5e1',
                          background: '#ffffff',
                          color: '#2563eb',
                          fontSize: 11,
                          fontWeight: 800,
                          cursor: 'pointer',
                        }}
                      >
                        + Kosul
                      </button>
                    </div>
                    {(item.conditions || []).map((condition) => (
                      <div
                        key={condition.id}
                        style={{
                          background: '#ffffff',
                          border: '1px solid #dbe7f5',
                          borderRadius: 10,
                          padding: 6,
                          marginBottom: 6,
                        }}
                      >
                        <div
                          style={{ display: 'flex', gap: 5, alignItems: 'center', marginBottom: 5 }}
                        >
                          <SelectInp
                            value={condition.sourceType || 'variable'}
                            onChange={(e) =>
                              patchTriggerConditions(item.id, (prev) =>
                                prev.map((entry) =>
                                  entry.id === condition.id
                                    ? { ...entry, sourceType: e.target.value, sourceId: '' }
                                    : entry
                                )
                              )
                            }
                            options={[
                              { value: 'variable', label: 'Degisken' },
                              { value: 'objectState', label: 'Nesne Durumu' },
                            ]}
                          />
                          <button
                            onClick={() =>
                              patchTriggerConditions(item.id, (prev) =>
                                prev.filter((entry) => entry.id !== condition.id)
                              )
                            }
                            style={{
                              border: 'none',
                              background: 'transparent',
                              color: '#ef4444',
                              cursor: 'pointer',
                              fontSize: 12,
                            }}
                          >
                            ×
                          </button>
                        </div>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                            gap: 5,
                          }}
                        >
                          <SelectInp
                            label={condition.sourceType === 'objectState' ? 'Nesne' : 'Degisken'}
                            value={condition.sourceId || ''}
                            onChange={(e) =>
                              patchTriggerConditions(item.id, (prev) =>
                                prev.map((entry) =>
                                  entry.id === condition.id
                                    ? { ...entry, sourceId: e.target.value }
                                    : entry
                                )
                              )
                            }
                            options={
                              (condition.sourceType === 'objectState'
                                ? objectStateOptions
                                : variableOptions
                              ).length
                                ? condition.sourceType === 'objectState'
                                  ? objectStateOptions
                                  : variableOptions
                                : [{ value: '', label: 'Kaynak yok' }]
                            }
                          />
                          {condition.sourceType === 'objectState' && (
                            <SelectInp
                              label="Durum"
                              value={condition.stateKey || 'visited'}
                              onChange={(e) =>
                                patchTriggerConditions(item.id, (prev) =>
                                  prev.map((entry) =>
                                    entry.id === condition.id
                                      ? { ...entry, stateKey: e.target.value }
                                      : entry
                                  )
                                )
                              }
                              options={OBJECT_STATE_OPTIONS}
                            />
                          )}
                          <SelectInp
                            label="Operator"
                            value={condition.operator || 'eq'}
                            onChange={(e) =>
                              patchTriggerConditions(item.id, (prev) =>
                                prev.map((entry) =>
                                  entry.id === condition.id
                                    ? { ...entry, operator: e.target.value }
                                    : entry
                                )
                              )
                            }
                            options={TRIGGER_OPERATOR_OPTIONS}
                          />
                          {!['truthy', 'falsy'].includes(condition.operator || 'eq') && (
                            <Inp
                              label="Karsilastirma"
                              value={condition.value || ''}
                              onChange={(e) =>
                                patchTriggerConditions(item.id, (prev) =>
                                  prev.map((entry) =>
                                    entry.id === condition.id
                                      ? { ...entry, value: e.target.value }
                                      : entry
                                  )
                                )
                              }
                            />
                          )}
                        </div>
                      </div>
                    ))}
                    {(!item.conditions || item.conditions.length === 0) && (
                      <div
                        style={{
                          fontSize: 11,
                          color: '#64748b',
                          textAlign: 'center',
                          padding: '8px 0',
                        }}
                      >
                        Kosul yok, trigger her zaman calisir
                      </div>
                    )}
                  </div>
                </details>
              </div>
            );
          })}
          {triggers.length === 0 && (
            <div style={{ fontSize: 11, color: '#64748b', textAlign: 'center', padding: '8px 0' }}>
              Tetikleyici yok. Yeni satir ekleyerek Articulate mantiginda akis kurabilirsin.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
