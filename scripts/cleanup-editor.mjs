import fs from 'fs';
import path from 'path';

const editorPath = path.resolve('src/EIcerikEditor.jsx');
const backupPath = path.resolve('src/EIcerikEditor.jsx.stage2-backup');

// 1. Topla: silinecek fonksiyon ve constant isimleri
const toRemove = new Set();
const constantsToRemove = new Set();

// src/constants/index.js'den tüm export isimlerini otomatik oku
const constantsIndexPath = path.resolve('src/constants/index.js');
if (fs.existsSync(constantsIndexPath)) {
  const idxContent = fs.readFileSync(constantsIndexPath, 'utf-8');
  const exportBlocks = idxContent.matchAll(/export\s*\{([^}]+)\}/g);
  for (const block of exportBlocks) {
    block[1].split(',').forEach(s => {
      const name = s.trim().split(/\s+as\s+/)[0].trim();
      if (name && !name.startsWith("'")) constantsToRemove.add(name);
    });
  }
}

console.log(`Constants otomatik okundu: ${constantsToRemove.size} adet`);

// src/logic/*.js dosyalarından export'ları oku
const logicDir = path.resolve('src/logic');
if (fs.existsSync(logicDir)) {
  for (const file of fs.readdirSync(logicDir)) {
    if (!file.endsWith('.js')) continue;
    const content = fs.readFileSync(path.join(logicDir, file), 'utf-8');
    const m = content.match(/export\s*\{([^}]*)\}/s);
    if (m) {
      m[1].split(',').forEach(s => {
        const name = s.trim().split(/\s+as\s+/)[0].trim();
        if (name) toRemove.add(name);
      });
    }
  }
}

// src/components/preview/*.jsx dosyalarından export'ları oku
const previewDir = path.resolve('src/components/preview');
if (fs.existsSync(previewDir)) {
  for (const file of fs.readdirSync(previewDir)) {
    if (!file.endsWith('.jsx')) continue;
    const content = fs.readFileSync(path.join(previewDir, file), 'utf-8');
    const m = content.match(/export\s*\{([^}]*)\}/s);
    if (m) {
      m[1].split(',').forEach(s => {
        const name = s.trim().split(/\s+as\s+/)[0].trim();
        if (name) toRemove.add(name);
      });
    }
  }
}

console.log(`Toplam ${toRemove.size} fonksiyon silinecek:`);
console.log([...toRemove].sort().join(', '));

// 2. EIcerikEditor.jsx'i oku
const content = fs.readFileSync(editorPath, 'utf-8');
const lines = content.split('\n');

// 3. Silinecek satırları belirle
const removeSet = new Set();
let removing = false;
let removeStart = -1;
let removeName = null;

const isTopLevelDecl = (line) => {
  // Eğer satır boşlukla başlıyorsa, bu iç seviyedir (indent > 0)
  if (/^\s/.test(line)) return false;
  const trimmed = line.trimStart();
  if (trimmed === '') return false;
  // Üst seviye tanım: function, const, class, export function, export const
  if (/^(function|const|class|export\s+(?:function|const|class))\s/.test(trimmed)) return true;
  // export default function
  if (/^export\s+default\s+(?:function|class)/.test(trimmed)) return true;
  return false;
};

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const trimmed = line.trimStart();

  if (!removing) {
    // Yeni bir üst seviye tanım mı?
    const funcMatch = trimmed.match(/^function\s+(\w+)/);
    const constMatch = trimmed.match(/^const\s+(\w+)/);
    const exportFuncMatch = trimmed.match(/^export\s+(?:default\s+)?function\s+(\w+)/);
    const exportConstMatch = trimmed.match(/^export\s+const\s+(\w+)/);
    const exportDefaultConstMatch = trimmed.match(/^export\s+default\s+const\s+(\w+)/);

    const name = (funcMatch?.[1] || constMatch?.[1] || exportFuncMatch?.[1] || exportConstMatch?.[1] || exportDefaultConstMatch?.[1]);

    if (name && (toRemove.has(name) || constantsToRemove.has(name))) {
      removing = true;
      removeStart = i;
      removeName = name;
      removeSet.add(i);
    }
  } else {
    // Silme modundayız, bir sonraki üst seviye tanımı bulana kadar devam et
    if (isTopLevelDecl(line) && i > removeStart) {
      removing = false;
      console.log(`  Silindi: ${removeName} (satır ${removeStart + 1}-${i})`);
      removeName = null;
      removeStart = -1;
      // Bu satırı atlamayalım, bir sonraki tanımın başlangıcı
      i--; // Bir geri git ki bu satırı tekrar işle
      continue;
    }
    removeSet.add(i);
  }
}

// Eğer dosya sonuna kadar silme devam ediyorsa
if (removing) {
  console.log(`  Silindi: ${removeName} (satır ${removeStart + 1}-dosya sonu)`);
}

// 4. Kalan satırları filtrele
const remaining = lines.filter((_, i) => !removeSet.has(i));

// 5. Import bloklarını oluştur
const importLines = [];

// Constants import'ları (kullanılanları tespit et)
importLines.push(`import {`);
importLines.push(`  BUTTON_PACKAGES, DEFAULT_THEME_PACKAGE_ITEMS, DEFAULT_DRAG_DROP_SETTINGS,`);
importLines.push(`  DEFAULT_SELECTION_UI, DRAGGABLE_STRONG_STYLE, DROPZONE_STRONG_STYLE,`);
importLines.push(`  OBJ_PRESETS, RIBBON_SHAPE_PRESETS, BUTTON_STYLE_PRESETS,`);
importLines.push(`  DEFAULT_ACTIVITY_SETTINGS, ACCESSIBILITY_DEFAULTS,`);
importLines.push(`  TIMELINE_EFFECT_OPTIONS, TIMELINE_DIRECTION_OPTIONS, TIMELINE_EASING_OPTIONS,`);
importLines.push(`  SLIDE_TRANSITION_OPTIONS, SLIDE_STATE_KEYS, VARIABLE_TYPES,`);
importLines.push(`  BOOK_LAYER_PRESET_KEYS, TEXT_STUDIO_SETTING_KEYS,`);
importLines.push(`  DEFAULT_LMS_CONFIG, INITIAL_STATE,`);
importLines.push(`} from './constants';`);
importLines.push('');

// Logic imports
importLines.push(`import {`);
importLines.push(`  uid, createSlide, createLayer, createActivity, createVariableItem,`);
importLines.push(`  createObject, createTriggerItem, createTriggerConditionItem,`);
importLines.push(`  createBookPreviewDocument, getActivityDragDropDefaults,`);
importLines.push(`  upgradeDragDropStyle, castVariableValue, getDefaultVariableValue,`);
importLines.push(`  createTimelineItem, createTimelineKeyframe, normalizeLayerNameKey,`);
importLines.push(`  getBaseLayerAutoName, createDefaultThemePackageItems,`);
importLines.push(`  resolveThemePackageItems, createObjectFromActivity,`);
importLines.push(`  updateActivityObject, createPdfImageObject, createPdfMaskObject,`);
importLines.push(`  createPdfDropzoneObject, createPdfDraggableObject,`);
importLines.push(`  createPdfSelectionObject, buildPdfDragDropMasks,`);
importLines.push(`  buildPdfSelectionObjects, applyPdfCleaningMasks,`);
importLines.push(`  buildPdfDragDropObjects, buildPdfDraftActivities,`);
importLines.push(`} from './logic/factories';`);
importLines.push('');

importLines.push(`import {`);
importLines.push(`  pickSlideState, normalizeSlide, materializeActivity,`);
importLines.push(`  commitMaterializedActivity, selectActivitySlide,`);
importLines.push(`  getActivitySlides, getActivitySlideTarget,`);
importLines.push(`  getAdjacentActivitySlideId, materializeActivitySlide,`);
importLines.push(`  normalizePreviewPhaseKey, findPreviewPhaseSlide,`);
importLines.push(`  getPreviewPhaseActivity, getSlideDirectionOffset,`);
importLines.push(`  normalizeVariable, normalizeObject, normalizeActivity,`);
importLines.push(`  getSelectionUi, getSelectionMarkGlyph, getSelectionOppositeMark,`);
importLines.push(`  canObjectBeSelectionShape, resolveWrongSelectionGlyph,`);
importLines.push(`  normalizeBook, pickBookLayerPresetPayload,`);
importLines.push(`  normalizeLayerPreset, applyBookLayerPresetToActivity,`);
importLines.push(`  normalizePreviewTemplate, safeClone,`);
importLines.push(`  pickTextStudioDesign, normalizeTextStudioPreset,`);
importLines.push(`  applyTextStudioPreset, normalizeState,`);
importLines.push(`} from './logic/normalize';`);
importLines.push('');

importLines.push(`import {`);
importLines.push(`  getFitScale, getActivityLayers, getCanvasObjects,`);
importLines.push(`  normalizeTimelineItem, syncTimelineWithObjects,`);
importLines.push(`  getActivityTimeline, getTimelineItemForObject,`);
importLines.push(`  getTimelineDuration, shouldObjectPersistAfterTimeline,`);
importLines.push(`  isObjectTimelineActive, applyTimelineEasing,`);
importLines.push(`  getTimelineDirectionOffset, getTimelineMotionStyle,`);
importLines.push(`} from './logic/timeline';`);
importLines.push('');

importLines.push(`import {`);
importLines.push(`  getInitialPreviewPhase, getVariableDefinition,`);
importLines.push(`  buildRuntimeVariableMap, normalizeRuntimeValue,`);
importLines.push(`  getRuntimeObjectStateValue, evaluateTriggerCondition,`);
importLines.push(`  evaluateTriggerConditions, getRuntimeObjectVisualState,`);
importLines.push(`  getTriggerSourceMatches, runPreviewTriggers, RuntimeObjectLayer,`);
importLines.push(`} from './logic/previewEngine';`);
importLines.push('');

importLines.push(`import {`);
importLines.push(`  getDragDropAssignments, getDragDropSettings,`);
importLines.push(`  normalizeDragDropMatchValue, getDragDropScopeKey,`);
importLines.push(`  areDragDropScopesCompatible, isDragReusable,`);
importLines.push(`  getDropCapacityLimit, getDragDropPairKey,`);
importLines.push(`  getDragDropPairsFromMatches, buildDragDropMatchMapFromPairs,`);
importLines.push(`  getAutoAnswerSummary, getCorrectSelectionIds,`);
importLines.push(`  layoutDragPositionsForMatches, buildAutoDragMatches,`);
importLines.push(`  getCorrectDragPositions, getCorrectDragMatches,`);
importLines.push(`  createDragDropPlacement, buildDragDropPlacementsFromMatches,`);
importLines.push(`  buildDragDropPlacementLayout, evaluateDragDropPlacements,`);
importLines.push(`} from './logic/dragDrop';`);
importLines.push('');

importLines.push(`import {`);
importLines.push(`  fileToDataUrl, formatBookLockMessage,`);
importLines.push(`  buildCanvasPreviewDataUrl, normalizePdfHintRect,`);
importLines.push(`  mergePdfTermLists, mapStoryboardInteractionTypeToDraftKind,`);
importLines.push(`  pickPrimaryStoryboardInteraction, extractStoryboardTermLists,`);
importLines.push(`  buildPdfSelectionBlueprint, countStoryboardExtractedItems,`);
importLines.push(`  createPdfStatusEntry, appendPdfImportLog, getPdfLogPalette,`);
importLines.push(`  PdfImportLogPanel, PdfImportStatusModal,`);
importLines.push(`  splitPdfLineSegments, buildPdfTextLines, detectPdfMarker,`);
importLines.push(`  buildFallbackPdfGroups, inferPdfDraftTitle,`);
importLines.push(`  detectPdfDraftStatus, inferPdfSelectionAnchors,`);
importLines.push(`  shouldUsePdfBottomOrigin, getPdfStageRectForLines,`);
importLines.push(`  getPdfQuestionAnchors, getPdfDragPoolRect,`);
importLines.push(`  detectCanvasContentBounds, mapPdfLinesToStage,`);
importLines.push(`  paintPdfCleanupRect, samplePdfCanvasBackgroundColor,`);
importLines.push(`  detectPdfGreenCells, detectRedAnnotationBounds,`);
importLines.push(`  estimatePdfRowHeight, getMedian, clusterPdfColumnCenters,`);
importLines.push(`  compactPdfColumnLabel, stripPdfAnchorListPrefix,`);
importLines.push(`  stripTrailingCheckMark, inferPdfTableChoiceColumns,`);
importLines.push(`  findPdfAnchorLineForText, buildPdfSelectionLayoutFromStoryboard,`);
importLines.push(`  detectPdfSelectionLayout, clamp,`);
importLines.push(`} from './logic/pdfUtils';`);
importLines.push('');

importLines.push(`import {`);
importLines.push(`  getPackageTheme, ButtonPackageShowcase,`);
importLines.push(`  ButtonPackageIntroDiagram, getActivityButtonMotion,`);
importLines.push(`} from './logic/buttonStyling';`);
importLines.push('');

importLines.push(`import {`);
importLines.push(`  Inp, SelectInp, Btn, Modal, shuffleArray,`);
importLines.push(`} from './logic/uiPrimitives';`);
importLines.push('');

// Preview components
importLines.push(`import {`);
importLines.push(`  PreviewDragDrop, PreviewSelection, PreviewDebugOverlay,`);
importLines.push(`  ManualLayerPreview, PreviewPlayer,`);
importLines.push(`  TimelinePreviewControls, PreviewSelectionFlow,`);
importLines.push(`  PreviewDragDropFlow,`);
importLines.push(`} from './components/preview/PreviewComponents';`);
importLines.push('');

// 6. Import satırlarını ve kalan kodu birleştir
const finalLines = [...importLines, ...remaining];

// 7. Yaz
fs.writeFileSync(editorPath, finalLines.join('\n'));

console.log(`\n=== SONUÇ ===`);
console.log(`Orijinal satır sayısı: ${lines.length}`);
console.log(`Silinen satır sayısı:  ${removeSet.size}`);
console.log(`Kalan satır sayısı:    ${remaining.length}`);
console.log(`Yeni toplam satır:     ${finalLines.length}`);
