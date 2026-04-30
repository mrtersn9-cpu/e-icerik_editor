# E-Icerik Editor Modülerizasyon Planı

## Mevcut Durum

| Dosya | Satır | Fonksiyon Sayısı |
|-------|-------|-----------------|
| `src/EIcerikEditor.jsx` | **26.783** | **213** |
| `src/constants/` | ~3.500 | — |
| `src/components/` | ~6.500 | — |
| `src/utils/` | ~2.800 | — |
| `src/theme/` | ~123 | — |
| `src/logic/` | **0** | — |

> **Kritik Sorun:** `src/logic/` tamamen boş. `constants/` ve `components/` dosyaları var ama `EIcerikEditor.jsx`'teki orijinal tanımlar hâlâ silinmemiş.

---

## Modül Çıkarım Planı

### A. `src/logic/pdfUtils.js` (~1.850 satır)
**Satır aralığı:** 215 – 2064  
**Fonksiyonlar:**
```
fileToDataUrl, formatBookLockMessage, buildCanvasPreviewDataUrl,
normalizePdfHintRect, mergePdfTermLists, mapStoryboardInteractionTypeToDraftKind,
pickPrimaryStoryboardInteraction, extractStoryboardTermLists, buildPdfSelectionBlueprint,
countStoryboardExtractedItems, createPdfStatusEntry, appendPdfImportLog, getPdfLogPalette,
PdfImportLogPanel, PdfImportStatusModal, splitPdfLineSegments, buildPdfTextLines,
detectPdfMarker, buildFallbackPdfGroups, inferPdfDraftTitle, detectPdfDraftStatus,
inferPdfSelectionAnchors, shouldUsePdfBottomOrigin, getPdfStageRectForLines,
getPdfQuestionAnchors, getPdfDragPoolRect, detectCanvasContentBounds, mapPdfLinesToStage,
paintPdfCleanupRect, samplePdfCanvasBackgroundColor, detectPdfGreenCells,
detectRedAnnotationBounds, estimatePdfRowHeight, getMedian, clusterPdfColumnCenters,
compactPdfColumnLabel, stripPdfAnchorListPrefix, stripTrailingCheckMark,
inferPdfTableChoiceColumns, findPdfAnchorLineForText, buildPdfSelectionLayoutFromStoryboard,
detectPdfSelectionLayout, clamp
```
**Bağımlılık:** Yok (saf yardımcı)  
**Risk:** Düşük

---

### B. `src/logic/factories.js` (~1.200 satır)
**Satır aralığı:** 2064–3393 (parcali: 2195–2448 dahil)  
**Fonksiyonlar:**
```
createDefaultThemePackageItems, resolveThemePackageItems, resolvePreviewFlowTarget,
resolvePreviewButtonLayoutStyle, normalizeStyleToken, upgradeDragDropStyle,
createDragDropDefaults, getActivityDragDropDefaults, createObjectFromActivity,
updateActivityObject, getObjectSelectionBounds, alignActivitySelection,
distributeActivitySelection, uid, createTimelineKeyframe, createTimelineItem,
createTriggerItem, createTriggerConditionItem, getDefaultVariableValue,
castVariableValue, createVariableItem, normalizeLayerNameKey, getBaseLayerAutoName,
getNextAutomaticOverlayLayerName, buildResolvedLayerNameMap, createLayer,
createObject, createActivity, createCanvasTextObject, createCanvasButtonObject,
createCanvasShapeObject, createBookPreviewDocument, createSlide, createPdfImageObject,
createPdfMaskObject, createPdfDropzoneObject, createPdfDraggableObject,
createPdfSelectionObject, buildPdfDragDropMasks, buildPdfSelectionObjects,
applyPdfCleaningMasks, buildPdfDragDropObjects, buildPdfDraftActivities
```
**Bağımlılık:** `constants/`, `utils/editorHelpers.js` (uid)  
**Risk:** Orta

---

### C. `src/logic/normalize.js` (~540 satır)
**Satır aralığı:** 3814 – 4352  
**Fonksiyonlar:**
```
pickSlideState, normalizeSlide, materializeActivity, commitMaterializedActivity,
selectActivitySlide, getActivitySlides, getActivitySlideTarget, getAdjacentActivitySlideId,
materializeActivitySlide, normalizePreviewPhaseKey, findPreviewPhaseSlide,
getPreviewPhaseActivity, getSlideDirectionOffset, normalizeVariable, normalizeObject,
normalizeActivity, getSelectionUi, getSelectionMarkGlyph, getSelectionOppositeMark,
canObjectBeSelectionShape, resolveWrongSelectionGlyph, normalizeBook,
pickBookLayerPresetPayload, normalizeLayerPreset, applyBookLayerPresetToActivity,
normalizePreviewTemplate, safeClone, pickTextStudioDesign, normalizeTextStudioPreset,
applyTextStudioPreset, normalizeState
```
**Bağımlılık:** `constants/`, `factories.js`  
**Risk:** Düşük-Orta

---

### D. `src/logic/timeline.js` (~250 satır)
**Satır aralığı:** 4711 – 4961  
**Fonksiyonlar:**
```
getFitScale, getActivityLayers, getCanvasObjects, normalizeTimelineItem,
syncTimelineWithObjects, getActivityTimeline, getTimelineItemForObject,
getTimelineDuration, shouldObjectPersistAfterTimeline, isObjectTimelineActive,
applyTimelineEasing, getTimelineDirectionOffset, getTimelineMotionStyle
```
**Bağımlılık:** `constants/` (TIMELINE_*), `utils/editorHelpers.js`  
**Risk:** Düşük

---

### E. `src/logic/previewEngine.js` (~452 satır)
**Satır aralığı:** 4961 – 5413  
**Fonksiyonlar:**
```
getInitialPreviewPhase, getVariableDefinition, buildRuntimeVariableMap,
normalizeRuntimeValue, getRuntimeObjectStateValue, evaluateTriggerCondition,
evaluateTriggerConditions, getRuntimeObjectVisualState, getTriggerSourceMatches,
runPreviewTriggers, RuntimeObjectLayer
```
**Bağımlılık:** `constants/`, `factories.js`, `normalize.js`  
**Risk:** Orta-Yüksek (runtime motoru)

---

### F. `src/logic/dragDrop.js` (~403 satır)
**Satır aralığı:** 5413 – 5816  
**Fonksiyonlar:**
```
getDragDropAssignments, getDragDropSettings, normalizeDragDropMatchValue,
getDragDropScopeKey, areDragDropScopesCompatible, isDragReusable,
getDropCapacityLimit, getDragDropPairKey, getDragDropPairsFromMatches,
buildDragDropMatchMapFromPairs, getAutoAnswerSummary, getCorrectSelectionIds,
layoutDragPositionsForMatches, buildAutoDragMatches, getCorrectDragPositions,
getCorrectDragMatches, createDragDropPlacement, buildDragDropPlacementsFromMatches,
buildDragDropPlacementLayout, evaluateDragDropPlacements
```
**Bağımlılık:** `constants/`  
**Risk:** Düşük-Orta

---

### G. `src/logic/buttonStyling.js` (~500 satır)
**Satır aralığı:** 4690 + 5816 (parcali)  
**Fonksiyonlar:**
```
getPackageTheme, shuffleArray, getButtonPackageMotion, getButtonMotionProfile,
getActivityButtonMotion, ButtonPackageShowcase, ButtonPackageIntroDiagram
```
**Bağımlılık:** `constants/`, `editor-logic/colorUtils.js`  
**Risk:** Düşük

---

### H. `src/components/preview/PreviewComponents.jsx` (~1.327 satır)
**Satır aralığı:** 5978 – 7305  
**Fonksiyonlar:**
```
PreviewDragDrop, PreviewSelection, PreviewDebugOverlay, ManualLayerPreview,
PreviewPlayer, TimelinePreviewControls, PreviewSelectionFlow, PreviewDragDropFlow
```
**Bağımlılık:** `logic/previewEngine.js`, `logic/dragDrop.js`  
**Risk:** Orta-Yüksek

---

### I. `src/logic/uiPrimitives.js` (~320 satır)
**Satır aralığı:** 4372 – 4690  
**Fonksiyonlar:**
```
Inp, SelectInp, Btn, Modal, getPackageTheme, shuffleArray
```
**Bağımlılık:** React  
**Risk:** Düşük

---

### J. `EIcerikEditor.jsx` Temizlik Aşaması (~6.500 satır silinecek)
**Yapılacaklar:**
1. `constants/` tanımlarını sil → `import { ... } from './constants'` ekle
2. `logic/` fonksiyon tanımlarını sil → `import { ... } from './logic/...'` ekle
3. `components/preview/` fonksiyon tanımlarını sil → `import { ... } from './components/preview/...'` ekle
4. `components/editor/` fonksiyon tanımlarını sil → `import { ... }` ekle

**Bağımlılık:** A–I tamamlanmalı  
**Risk:** Orta-Yüksek

---

## Paralel Ajan Planı

```
┌─────────────────────────────────────────────────────────────┐
│  AŞAMA 1: Paralel Ajanlar (birbirinden bağımsız)            │
├─────────────────────────────────────────────────────────────┤
│  Ajan 1  →  src/logic/pdfUtils.js                           │
│  Ajan 2  →  src/logic/factories.js                          │
│  Ajan 3  →  src/logic/normalize.js                          │
│  Ajan 4  →  src/logic/timeline.js                           │
│  Ajan 5  →  src/logic/previewEngine.js                      │
│  Ajan 6  →  src/logic/dragDrop.js                           │
│  Ajan 7  →  src/logic/buttonStyling.js                      │
│  Ajan 8  →  src/components/preview/PreviewComponents.jsx    │
│  Ajan 9  →  src/logic/uiPrimitives.js                       │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  AŞAMA 2: Sıralı Ajan (tüm Aşama 1 bitince)                 │
├─────────────────────────────────────────────────────────────┤
│  Ajan 10 →  EIcerikEditor.jsx temizliği + import ekleme     │
└─────────────────────────────────────────────────────────────┘
```

---

## Beklenen Sonuç

| Dosya | Mevcut | Hedef | Kazanç |
|-------|--------|-------|--------|
| `EIcerikEditor.jsx` | 26.783 satır | ~12.000 satır | **-14.700** |
| `src/logic/` | 0 dosya | 9 dosya | **+~5.500 satır** |
| `src/components/preview/` | 0 dosya | 1 dosya | **+~1.300 satır** |

> **Toplam taşınan kod:** ~7.000 satır  
> **Toplam silinen (duplicate) kod:** ~14.000 satır
