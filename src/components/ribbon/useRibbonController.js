import { useCallback, useMemo } from 'react';

import { fileToDataUrl, uploadMediaFile } from '../../api/apiClient';
import {
  BUTTON_PACKAGES,
  BUTTON_STYLE_PRESETS,
  CHARACTER_LIBRARY,
  LMS_STANDARD_OPTIONS,
  PLAYER_SKIN_PRESETS,
  RIBBON_SHAPE_PRESETS,
  SHAPE_STYLE_PRESETS,
  SLIDE_MASTER_PRESETS,
  SLIDE_TRANSITION_OPTIONS,
  TIMELINE_DIRECTION_OPTIONS,
  TIMELINE_EASING_OPTIONS,
  TIMELINE_EFFECT_OPTIONS,
} from '../../constants';
import { createObjectFromActivity } from '../../logic/activityFactory';
import { getActivitySlides, selectActivitySlide } from '../../logic/activityHelpers';
import {
  getActivityButtonMotion,
  getButtonPackageMotion,
  restyleAllButtonsForPackage,
} from '../../logic/buttonStyling';
import { getActivityContentLanguage } from '../../logic/contentLanguage';
import {
  DRAG_DROP_ANIMATION_PRESETS,
  getDragDropAnimationPreset,
  getDragDropSettings,
} from '../../logic/dragDrop';
import {
  createButtonPresetObject,
  createShapeObject,
  createSlide,
} from '../../logic/factories';
import { alignActivitySelection, distributeActivitySelection } from '../../logic/objectLayout';
import {
  DEFAULT_ANSWER_LAYER_STYLE_PRESET_ID,
  SCENE_TEMPLATE_OPTIONS,
  applySceneTemplateToSlide,
} from '../../logic/sceneTemplates';
import { normalizeSlide } from '../../logic/slideNormalization';
import {
  getTimelineItemForObject,
  normalizeTimelineItem,
  syncTimelineWithObjects,
} from '../../logic/timeline';
import { PANEL_SCALE_RANGE } from '../../theme';
import {
  applyMasterPresetToActivity,
  buildMasterLayoutDescriptors,
  clamp,
  sanitizeSvgMarkup,
  uid,
} from '../../utils/editorHelpers';

const CONTENT_LANGUAGE_OPTIONS = [
  { value: 'tr', label: 'Türkçe' },
  { value: 'en', label: 'English' },
];

const fontOptions = ['Humst777 BlkCn BT', 'Georgia', 'Trebuchet MS', 'Verdana', 'Tahoma', 'Arial'];

function resolveColor(value, fallback = '#ffffff') {
  const raw = String(value || '').trim();
  return /^#[0-9a-f]{6}$/i.test(raw) ? raw : fallback;
}

function selectedTargetIds(activity = {}, selectedIds = new Set()) {
  if (selectedIds?.size) return new Set(selectedIds);
  return activity?.selectedObjectId ? new Set([activity.selectedObjectId]) : new Set();
}

export default function useRibbonController({
  activeEditorTab,
  activity,
  applyRibbonObjectPatch,
  canvasRef,
  commit,
  handleEditorTabSelect,
  handleExport,
  handleOpenStorylinePreview,
  handleScorm12Export,
  handleSecureLmsExport,
  hasObjectSelection,
  history,
  importRef,
  lmsConfig,
  manualSaveProject,
  openTextStudioWindow,
  panelScale,
  present,
  primaryObject,
  resetLayout,
  resetProject,
  selectedIds,
  setActiveEditorTab,
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
  showToast,
  storyRibbonTab,
  updateActivity,
  zoom,
}) {
  const slides = useMemo(() => getActivitySlides(activity || {}), [activity]);
  const currentSlide = useMemo(
    () => slides.find((slide) => slide.id === activity?.currentSlideId) || slides[0] || null,
    [activity?.currentSlideId, slides]
  );
  const dragDropSettings = useMemo(() => getDragDropSettings(activity || {}), [activity]);
  const dragAnimationPreset = useMemo(() => getDragDropAnimationPreset(activity || {}), [activity]);
  const targetIds = useMemo(() => selectedTargetIds(activity || {}, selectedIds), [activity, selectedIds]);
  const selectedTimelineItem = useMemo(
    () => (primaryObject ? getTimelineItemForObject(activity || {}, primaryObject.id) : null),
    [activity, primaryObject]
  );
  const view = activity?.viewOptions || {};

  const patchActivity = useCallback(
    (patch) => {
      if (!activity) return;
      updateActivity({ ...activity, ...patch });
    },
    [activity, updateActivity]
  );

  const patchCurrentSlide = useCallback(
    (patch) => {
      if (!activity || !currentSlide) return;
      const nextSlides = slides.map((slide, index) =>
        slide.id === currentSlide.id ? normalizeSlide({ ...slide, ...patch }, index) : slide
      );
      updateActivity(selectActivitySlide({ ...activity, slides: nextSlides }, currentSlide.id));
    },
    [activity, currentSlide, slides, updateActivity]
  );

  const selectLocalFile = useCallback((accept, handler) => {
    if (typeof document === 'undefined') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';
    input.onchange = async (event) => {
      const file = event.target.files?.[0];
      input.remove();
      if (!file) return;
      await handler(file);
    };
    input.oncancel = () => input.remove();
    document.body.appendChild(input);
    input.click();
  }, []);

  const commitRibbonObject = useCallback(
    (object) => {
      if (!activity || !object) return;
      const objects = Array.isArray(activity.objects) ? activity.objects : [];
      const nextObject = {
        ...object,
        zIndex: objects.length + 1,
        layerId: activity.activeLayerId || 'base',
      };
      const nextObjects = [...objects, nextObject];
      updateActivity({
        ...activity,
        objects: nextObjects,
        selectedObjectId: nextObject.id,
        timeline: syncTimelineWithObjects({ ...activity, objects: nextObjects }),
      });
      setSelectedIds(new Set([nextObject.id]));
      setActiveEditorTab('nesneler');
    },
    [activity, setActiveEditorTab, setSelectedIds, updateActivity]
  );

  const insertObject = useCallback(
    (type, patch = {}) => {
      if (!activity) return;
      const styleKeys = [
        'fontSize',
        'fontWeight',
        'fontStyle',
        'textAlign',
        'color',
        'background',
        'borderColor',
        'borderWidth',
        'borderRadius',
        'boxShadow',
      ];
      const stylePatch = Object.fromEntries(
        styleKeys
          .filter((key) => Object.prototype.hasOwnProperty.call(patch, key))
          .map((key) => [key, patch[key]])
      );
      const objectPatch = Object.fromEntries(
        Object.entries(patch).filter(([key]) => !styleKeys.includes(key) && key !== 'style')
      );
      const object = {
        ...createObjectFromActivity(activity, type),
        ...objectPatch,
      };
      if (Object.keys(stylePatch).length || patch.style) {
        object.style = { ...(object.style || {}), ...stylePatch, ...(patch.style || {}) };
      }
      commitRibbonObject(object);
    },
    [activity, commitRibbonObject]
  );

  const insertText = useCallback(
    (kind = 'body') => {
      if (kind === 'heading') {
        insertObject('text', {
          label: 'Başlık',
          text: 'Başlık',
          fontSize: 38,
          fontWeight: 900,
          color: '#111827',
        });
        return;
      }
      insertObject('text', { label: 'Metin', text: 'Metin', fontSize: 24, color: '#111827' });
    },
    [insertObject]
  );

  const insertImage = useCallback(
    () =>
      selectLocalFile('image/*', async (file) => {
        const imageData = await fileToDataUrl(file);
        const object = createObjectFromActivity(activity, 'image');
        object.imageData = imageData;
        object.label = file.name.replace(/\.[^.]+$/, '') || 'Resim';
        commitRibbonObject(object);
      }),
    [activity, commitRibbonObject, selectLocalFile]
  );

  const insertVideo = useCallback(
    () =>
      selectLocalFile('video/mp4,video/webm,video/ogg', async (file) => {
        const mediaUrl = await uploadMediaFile(file);
        const object = createObjectFromActivity(activity, 'video');
        object.mediaUrl = mediaUrl;
        object.mediaName = file.name;
        object.label = file.name.replace(/\.[^.]+$/, '') || 'Video';
        commitRibbonObject(object);
      }),
    [activity, commitRibbonObject, selectLocalFile]
  );

  const insertAudio = useCallback(
    () =>
      selectLocalFile('audio/*', async (file) => {
        const mediaUrl = await uploadMediaFile(file);
        const object = createObjectFromActivity(activity, 'audio');
        object.mediaUrl = mediaUrl;
        object.mediaName = file.name;
        object.label = file.name.replace(/\.[^.]+$/, '') || 'Ses';
        object.showPlayerControls = false;
        object.autoPlay = true;
        object.mediaEndAction = 'none';
        commitRibbonObject(object);
      }),
    [activity, commitRibbonObject, selectLocalFile]
  );

  const loadSvgBackground = useCallback(
    () =>
      selectLocalFile('.svg,image/svg+xml', async (file) => {
        const markup = sanitizeSvgMarkup(await file.text());
        patchActivity({ svgMarkup: markup, svgName: file.name });
        setActiveEditorTab('sahne');
      }),
    [patchActivity, selectLocalFile, setActiveEditorTab]
  );

  const addSlide = useCallback(() => {
    if (!activity) return;
    const nextSlide = createSlide(`Sahne ${slides.length + 1}`, slides.length);
    updateActivity(
      selectActivitySlide(
        { ...activity, slides: [...slides, nextSlide], currentSlideId: nextSlide.id },
        nextSlide.id
      )
    );
  }, [activity, slides, updateActivity]);

  const duplicateSlide = useCallback(() => {
    if (!activity || !currentSlide) return;
    const nextSlide = normalizeSlide(
      {
        ...currentSlide,
        id: uid(),
        name: `${currentSlide.name || 'Sahne'} Kopya`,
        sceneName: currentSlide.sceneName || currentSlide.name || 'Sahne',
      },
      slides.length
    );
    updateActivity(
      selectActivitySlide(
        { ...activity, slides: [...slides, nextSlide], currentSlideId: nextSlide.id },
        nextSlide.id
      )
    );
  }, [activity, currentSlide, slides, updateActivity]);

  const deleteSlide = useCallback(() => {
    if (!activity || !currentSlide || slides.length <= 1) return;
    const nextSlides = slides
      .filter((slide) => slide.id !== currentSlide.id)
      .map((slide, index) => normalizeSlide(slide, index));
    updateActivity(selectActivitySlide({ ...activity, slides: nextSlides }, nextSlides[0]?.id));
  }, [activity, currentSlide, slides, updateActivity]);

  const moveSlide = useCallback(
    (direction) => {
      if (!activity || !currentSlide) return;
      const index = slides.findIndex((slide) => slide.id === currentSlide.id);
      const nextIndex = clamp(index + direction, 0, slides.length - 1);
      if (index === nextIndex) return;
      const nextSlides = [...slides];
      const [slide] = nextSlides.splice(index, 1);
      nextSlides.splice(nextIndex, 0, slide);
      updateActivity(
        selectActivitySlide(
          { ...activity, slides: nextSlides.map((item, itemIndex) => normalizeSlide(item, itemIndex)) },
          currentSlide.id
        )
      );
    },
    [activity, currentSlide, slides, updateActivity]
  );

  const makeSlideFirst = useCallback(() => {
    if (!activity || !currentSlide) return;
    const nextSlides = [currentSlide, ...slides.filter((slide) => slide.id !== currentSlide.id)].map(
      (slide, index) => normalizeSlide(slide, index)
    );
    updateActivity(selectActivitySlide({ ...activity, slides: nextSlides }, currentSlide.id));
  }, [activity, currentSlide, slides, updateActivity]);

  const setObjectStyle = useCallback(
    (stylePatch) => applyRibbonObjectPatch({}, stylePatch),
    [applyRibbonObjectPatch]
  );

  const patchObject = useCallback(
    (objectPatch) => applyRibbonObjectPatch(objectPatch),
    [applyRibbonObjectPatch]
  );

  const groupSelection = useCallback(() => {
    if (!activity || targetIds.size < 2) return;
    const groupId = uid();
    updateActivity({
      ...activity,
      objects: (activity.objects || []).map((item) =>
        targetIds.has(item.id) ? { ...item, groupId } : item
      ),
    });
    setSelectedIds(new Set(targetIds));
  }, [activity, setSelectedIds, targetIds, updateActivity]);

  const ungroupSelection = useCallback(() => {
    if (!activity || !targetIds.size) return;
    updateActivity({
      ...activity,
      objects: (activity.objects || []).map((item) =>
        targetIds.has(item.id) ? { ...item, groupId: '' } : item
      ),
    });
    setSelectedIds(new Set(targetIds));
  }, [activity, setSelectedIds, targetIds, updateActivity]);

  const updateSelectedTimeline = useCallback(
    (patch) => {
      if (!activity || !primaryObject) return;
      const timeline = syncTimelineWithObjects(activity);
      const nextTimeline = timeline.map((item, index) =>
        item.objectId === primaryObject.id
          ? normalizeTimelineItem({ ...item, ...patch }, index, activity.objects || [])
          : item
      );
      updateActivity({ ...activity, timeline: nextTimeline });
    },
    [activity, primaryObject, updateActivity]
  );

  const setDragAnimationPreset = useCallback(
    (presetId) => {
      if (!activity) return;
      updateActivity({
        ...activity,
        dragDropSettings: {
          ...dragDropSettings,
          dragAnimationPreset: presetId,
        },
      });
      setRibbonAnimationPreviewKey((current) => current + 1);
    },
    [activity, dragDropSettings, setRibbonAnimationPreviewKey, updateActivity]
  );

  const patchLms = useCallback(
    (patch) => commit((state) => ({ ...state, lmsConfig: { ...(state.lmsConfig || {}), ...patch } })),
    [commit]
  );

  const applyButtonPackage = useCallback(
    (pkgId) => {
      if (!activity) return;
      const committed = {
        ...activity,
        buttonPackageId: pkgId,
        buttonAnimationProfileId:
          activity.buttonAnimationProfileId ||
          BUTTON_PACKAGES.find((item) => item.id === pkgId)?.animationProfileId ||
          '',
      };
      const motion =
        getActivityButtonMotion(committed) || getButtonPackageMotion(pkgId);
      const nextObjects = restyleAllButtonsForPackage(committed.objects || [], pkgId).map((object) =>
        object?.type === 'button' && motion ? { ...object, buttonMotion: { ...motion } } : object
      );
      updateActivity({
        ...committed,
        objects: nextObjects,
        timeline: syncTimelineWithObjects({ ...committed, objects: nextObjects }),
      });
    },
    [activity, updateActivity]
  );

  const applySlideMaster = useCallback(
    (presetId) => {
      if (!activity) return;
      updateActivity(applyMasterPresetToActivity(activity, presetId));
    },
    [activity, updateActivity]
  );

  const applyMasterLayoutObjects = useCallback(() => {
    if (!activity?.slideMasterId) return;
    const descriptors = buildMasterLayoutDescriptors(
      activity.slideMasterId,
      activity.stageWidth || 1920,
      activity.stageHeight || 1080
    );
    if (!descriptors.length) return;
    const currentObjects = Array.isArray(activity.objects) ? activity.objects : [];
    const newObjects = descriptors.map((descriptor, index) => ({
      id: uid(),
      type: descriptor.type,
      x: descriptor.x,
      y: descriptor.y,
      width: descriptor.width,
      height: descriptor.height,
      rotation: 0,
      label: descriptor.label,
      locked: false,
      visible: true,
      zIndex: currentObjects.length + index + 1,
      layerId: 'base',
      style: { ...descriptor.style },
      masterRole: descriptor.role,
    }));
    updateActivity({ ...activity, objects: [...currentObjects, ...newObjects] });
  }, [activity, updateActivity]);

  const applySceneTemplate = useCallback(
    (templateId) => {
      if (!activity || !currentSlide) return;
      const nextSlide = applySceneTemplateToSlide(
        {
          ...currentSlide,
          sceneTemplateId: templateId,
          sceneTemplatePresetId:
            currentSlide.sceneTemplatePresetId ||
            currentSlide.answerLayerStylePresetId ||
            DEFAULT_ANSWER_LAYER_STYLE_PRESET_ID,
        },
        { templateId, replaceExisting: true }
      );
      patchCurrentSlide(nextSlide);
    },
    [activity, currentSlide, patchCurrentSlide]
  );

  const insertButtonPreset = useCallback(
    (presetId) => {
      const pkgId = activity?.buttonPackageId || BUTTON_PACKAGES[0]?.id || 'pkg-1';
      const [button] = restyleAllButtonsForPackage([createButtonPresetObject(presetId)], pkgId);
      const motion = getActivityButtonMotion(activity || {}) || getButtonPackageMotion(pkgId);
      commitRibbonObject(button && motion ? { ...button, buttonMotion: { ...motion } } : button);
    },
    [activity, commitRibbonObject]
  );

  const insertShape = useCallback((kind) => commitRibbonObject(createShapeObject(kind)), [commitRibbonObject]);

  const toggleViewOption = useCallback(
    (key) => {
      const defaults = { showGrid: true, showGuides: false, showRulers: false, snapEnabled: true };
      patchActivity({
        viewOptions: {
          ...defaults,
          ...(activity?.viewOptions || {}),
          [key]: !(activity?.viewOptions?.[key] ?? defaults[key]),
        },
      });
    },
    [activity?.viewOptions, patchActivity]
  );

  const effectLabel = useCallback(
    (effect) => TIMELINE_EFFECT_OPTIONS.find((item) => item.value === effect)?.label || effect,
    []
  );

  return {
    activeEditorTab,
    activeTab: storyRibbonTab || 'home',
    activity,
    can: {
      selection: !!primaryObject || targetIds.size > 0,
      multiSelection: targetIds.size > 1,
      distribute: targetIds.size > 2,
      group: targetIds.size > 1,
      undo: !!history?.past?.length,
      redo: !!history?.future?.length,
    },
    commands: {
      addSlide,
      align: (mode) => activity && updateActivity(alignActivitySelection(activity, selectedIds, mode)),
      applyButtonPackage,
      applyMasterLayoutObjects,
      applySceneTemplate,
      applySlideMaster,
      applyTextPreset: (preset) => {
        if (preset === 'title') setObjectStyle({ fontSize: 38, fontWeight: 900, color: '#111827' });
      },
      applyTransitionToAllSlides: () => {
        if (!activity || !currentSlide) return;
        const nextSlides = slides.map((slide) => ({
          ...slide,
          slideTransitionEffect: currentSlide.slideTransitionEffect || 'fade',
          slideTransitionDirection: currentSlide.slideTransitionDirection || 'left',
          slideTransitionDuration: currentSlide.slideTransitionDuration ?? 0.45,
          slideTransitionDelay: currentSlide.slideTransitionDelay ?? 0,
          slideTransitionEasing: currentSlide.slideTransitionEasing || 'easeOut',
          slideTransitionSound: currentSlide.slideTransitionSound || 'none',
        }));
        updateActivity(selectActivitySlide({ ...activity, slides: nextSlides }, currentSlide.id));
      },
      bringFront: () => canvasRef.current?.bringFront?.(),
      copy: () => canvasRef.current?.copySelected?.(),
      copySelectedAnimation: () => showToast?.('Animasyon ayarları kopyalandı.', 'success'),
      cut: () => {
        const copied = canvasRef.current?.copySelected?.();
        if (copied !== false) canvasRef.current?.deleteSelected?.();
      },
      deleteSelection: () => canvasRef.current?.deleteSelected?.(),
      deleteSlide,
      distribute: (axis) => activity && updateActivity(distributeActivitySelection(activity, selectedIds, axis)),
      duplicateSlide,
      expandCanvas: () => setCanvasExpanded(true),
      exportProject: handleExport,
      fitCanvas: () => setZoom('fit'),
      groupSelection,
      insertAudio,
      insertButtonPreset,
      insertComponent: (kind) => {
        const componentMap = {
          'info-box': { label: 'Bilgi Kutusu', text: 'Bilgi Kutusu', background: '#eff6ff', borderColor: '#60a5fa' },
          'warning-box': { label: 'Uyarı', text: 'Uyarı', background: '#fff7ed', borderColor: '#fb923c' },
          card: { label: 'Kart', text: 'Kart Başlığı', background: '#ffffff', borderColor: '#cbd5e1', boxShadow: '0 10px 24px rgba(15,23,42,.12)' },
          accordion: { label: 'Akordeon', text: 'Akordeon Başlığı', background: '#f8fafc', borderColor: '#94a3b8' },
        };
        insertObject('text', componentMap[kind] || componentMap.card);
      },
      insertIcon: () => insertObject('text', { label: 'İkon', text: '★', fontSize: 64, fontWeight: 900, color: '#2563eb' }),
      insertImage,
      insertLabel: () => insertObject('text', { label: 'Etiket', text: 'Etiket', fontSize: 18, fontWeight: 800, background: '#eff6ff', borderColor: '#93c5fd', borderRadius: 999 }),
      insertObject,
      insertShape,
      insertText,
      insertVideo,
      loadSvgBackground,
      makeSlideFirst,
      moveSlide,
      newProject: resetProject,
      openAccessibilitySettings: () => handleEditorTabSelect('ayarlar'),
      openAnswerCenter: () => {
        if (typeof setAnswerDrawerOpen === 'function') {
          setAnswerDrawerOpen(true);
          return;
        }
        handleEditorTabSelect('soru');
      },
      openPreview: handleOpenStorylinePreview,
      openProject: () => importRef.current?.click?.(),
      openScenePanel: () => handleEditorTabSelect('sahne'),
      openTextStudio: () => openTextStudioWindow?.(true),
      paste: () => canvasRef.current?.pasteClipboard?.(),
      patchActivity,
      patchCurrentSlide,
      patchLms,
      patchObject,
      previewTransition: handleOpenStorylinePreview,
      redo: history?.redo,
      resetLayout,
      restartAnimationPreview: () => setRibbonAnimationPreviewKey((current) => current + 1),
      saveProject: manualSaveProject || (() => showToast?.('Proje otomatik kayıtla güncel tutuluyor.', 'success')),
      scaleUi: (direction) =>
        setPanelScale((value) =>
          clamp(
            Number((value + direction * PANEL_SCALE_RANGE.step).toFixed(2)),
            PANEL_SCALE_RANGE.min,
            PANEL_SCALE_RANGE.max
          )
        ),
      scormExport: handleScorm12Export,
      secureLmsExport: handleSecureLmsExport,
      sendBack: () => canvasRef.current?.sendBack?.(),
      setDragAnimationPreset,
      setObjectStyle,
      setRibbonTab: (tab) => {
        setStoryRibbonTab(tab);
        if (['scene', 'design', 'transitions', 'view'].includes(tab)) {
          setActiveEditorTab('sahne');
        }
        if (['home', 'insert', 'animation', 'object-format'].includes(tab)) {
          setActiveEditorTab('nesneler');
        }
      },
      setSelectionLocked: (locked) => patchObject({ locked }),
      setZoom,
      showHelpToast: (message) => showToast?.(message, 'info'),
      toggleTextStyle: (kind) => {
        if (!primaryObject) return;
        if (kind === 'bold')
          setObjectStyle({ fontWeight: primaryObject.style?.fontWeight === 900 ? 600 : 900 });
        if (kind === 'italic')
          setObjectStyle({
            fontStyle: primaryObject.style?.fontStyle === 'italic' ? 'normal' : 'italic',
          });
        if (kind === 'underline')
          setObjectStyle({
            textDecoration:
              primaryObject.style?.textDecoration === 'underline' ? 'none' : 'underline',
          });
      },
      toggleViewOption,
      undo: history?.undo,
      ungroupSelection,
      updateSelectedTimeline,
      zoomBy: (delta) => setZoom((value) => (typeof value === 'number' ? clamp(value + delta, 0.2, 3) : 1 + delta)),
    },
    currentContentLanguage: getActivityContentLanguage(activity || {}),
    currentSlide,
    dragAnimationPreset,
    galleries: {
      buttonPackages: BUTTON_PACKAGES,
      buttonStyles: BUTTON_STYLE_PRESETS,
      contentLanguages: CONTENT_LANGUAGE_OPTIONS,
      directions: TIMELINE_DIRECTION_OPTIONS,
      dragAnimations: DRAG_DROP_ANIMATION_PRESETS,
      easings: TIMELINE_EASING_OPTIONS,
      effectLabel,
      fonts: fontOptions,
      lmsStandards: LMS_STANDARD_OPTIONS,
      playerSkins: PLAYER_SKIN_PRESETS,
      sceneTemplates: SCENE_TEMPLATE_OPTIONS,
      shapes: RIBBON_SHAPE_PRESETS,
      shapeStyles: SHAPE_STYLE_PRESETS,
      slideMasters: SLIDE_MASTER_PRESETS,
      transitions: SLIDE_TRANSITION_OPTIONS,
      characters: CHARACTER_LIBRARY,
    },
    hasObjectSelection,
    lms: lmsConfig || {},
    object: primaryObject,
    panelScale,
    present,
    resolveColor,
    selectedTimelineItem,
    view: {
      showGrid: view.showGrid !== false,
      showGuides: !!view.showGuides,
      showRulers: !!view.showRulers,
      snapEnabled: view.snapEnabled !== false,
      zoom,
    },
  };
}
