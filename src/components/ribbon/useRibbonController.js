import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { fileToDataUrl, uploadMediaFile } from '../../api/apiClient';
import {
  BUTTON_PACKAGES,
  BUTTON_STYLE_PRESETS,
  CHARACTER_LIBRARY,
  DEFAULT_ACTIVITY_SETTINGS,
  LMS_STANDARD_OPTIONS,
  PLAYER_SKIN_PRESETS,
  RIBBON_SHAPE_PRESETS,
  SHAPE_STYLE_PRESETS,
  SLIDE_MASTER_PRESETS,
  SLIDE_TRANSITION_OPTIONS,
  SLIDE_TRANSITION_SOUND_OPTIONS,
  LMS_TRACKING_MODE_OPTIONS,
  TIMELINE_DIRECTION_OPTIONS,
  TIMELINE_EASING_OPTIONS,
  TIMELINE_EFFECT_OPTIONS,
} from '../../constants';
import { readyButtonTextShadowForColor } from '../../editor-logic/colorUtils';
import { createObjectFromActivity } from '../../logic/activityFactory';
import {
  commitMaterializedActivity,
  getActivitySlides,
  pasteActivitySlide,
  selectActivitySlide,
} from '../../logic/activityHelpers';
import {
  getActivityButtonMotion,
  getButtonPackageMotion,
  getButtonMotionProfile,
  buildReadyButtonStyle,
  getAnswerLayerStylePresetById,
  restyleAllButtonsForPackage,
} from '../../logic/buttonStyling';
import { contentText, getActivityContentLanguage } from '../../logic/contentLanguage';
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
import {
  alignActivitySelection,
  distributeActivitySelection,
  groupActivitySelection,
  ungroupActivitySelection,
} from '../../logic/objectLayout';
import {
  DEFAULT_ANSWER_LAYER_STYLE_PRESET_ID,
  EDUCATION_BUTTON_TEXT_SIZE_SMALL,
  SCENE_TEMPLATE_OPTIONS,
  applySceneTemplateToSlide,
  getButtonPairSemanticIcon,
} from '../../logic/sceneTemplates';
import { normalizeSlide } from '../../logic/slideNormalization';
import { applyGeneratedThemeToActivity } from '../../logic/themeApplication';
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
import { getSemanticSvgIcon } from '../../utils/iconSvg';

const CONTENT_LANGUAGE_OPTIONS = [
  { value: 'tr', label: 'Türkçe' },
  { value: 'en', label: 'English' },
  { value: 'de', label: 'Deutsch' },
];

const fontOptions = ['Humst777 BlkCn BT', 'Georgia', 'Trebuchet MS', 'Verdana', 'Tahoma', 'Arial'];
const READY_BUTTON_ICON_SIZE = 28;

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
  bookDefaultStylePresetId = DEFAULT_ANSWER_LAYER_STYLE_PRESET_ID,
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
  setIsSlidePanelCollapsed,
  setPanelScale,
  setRibbonAnimationPreviewKey,
  setTimelineCurrentTime,
  setTimelinePlaying,
  setTimelineVisualization,
  setSelectedIds,
  setShowBranchDiagram,
  setShowGlossaryEditor,
  setShowVariablesManager,
  openIconPicker,
  openContentLibrary,
  openCharacterPicker,
  openSymbolPicker,
  showBaseLayer,
  onShowBaseLayerChange,
  setTimelineDockOpen,
  setTimelineHeight,
  setStoryRibbonTab,
  setZoom,
  showToast,
  slideClipboardRef: externalSlideClipboardRef,
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
  const animationClipboardRef = useRef(null);
  const styleClipboardRef = useRef(null);
  const localSlideClipboardRef = useRef(null);
  const slideClipboardRef = externalSlideClipboardRef || localSlideClipboardRef;

  // Pano durumlarının (slide/animasyon/stil/nesne) buton disabled bayraklarına yansıması
  // için reaktif bir sayaç. Ref'ler değişince render tetiklenmez; bu sayaç bumplandığında
  // hook yeniden çalışıp can.paste* bayraklarını taze hesaplar. Nesne panosu StageCanvas'ta
  // tutulduğundan, oradan yayınlanan 'eicerik:clipboard-change' olayı da bunu bumplar.
  const [clipboardTick, setClipboardTick] = useState(0);
  const bumpClipboard = useCallback(() => setClipboardTick((tick) => tick + 1), []);
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handler = () => setClipboardTick((tick) => tick + 1);
    window.addEventListener('eicerik:clipboard-change', handler);
    return () => window.removeEventListener('eicerik:clipboard-change', handler);
  }, []);

  const hasObjectClipboard = useMemo(() => {
    void clipboardTick;
    if (typeof sessionStorage === 'undefined') return false;
    try {
      const parsed = JSON.parse(sessionStorage.getItem('eicerik_obj_clipboard') || 'null');
      return Array.isArray(parsed?.objects) && parsed.objects.length > 0;
    } catch {
      return false;
    }
  }, [clipboardTick]);

  // Seçimin grup/kilit durumundan türeyen bağlam bayrakları (dinamik tek düğme için).
  const selectionMeta = useMemo(() => {
    const objects = Array.isArray(activity?.objects) ? activity.objects : [];
    const selected = objects.filter((item) => targetIds.has(item.id));
    const groupIds = new Set(
      selected.map((item) => String(item.groupId || '').trim()).filter(Boolean)
    );
    const groupedCount = selected.filter((item) => String(item.groupId || '').trim()).length;
    const lockedCount = selected.filter((item) => item.locked).length;
    const allOneGroup =
      selected.length > 1 && groupIds.size === 1 && groupedCount === selected.length;
    return {
      canGroup: selected.length > 1 && !allOneGroup,
      canUngroup: groupedCount > 0,
      allLocked: selected.length > 0 && lockedCount === selected.length,
      anyLocked: lockedCount > 0,
    };
  }, [activity, targetIds]);

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
      try {
        await handler(file);
      } catch (error) {
        showToast?.(`Medya eklenemedi: ${error?.message || 'Bilinmeyen hata'}`, 'error');
      }
    };
    input.oncancel = () => input.remove();
    document.body.appendChild(input);
    input.click();
  }, [showToast]);

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
        object.label = file.name.replace(/\.[^.]+$/, '') || 'Ses';
        object.showPlayerControls = false;
        object.autoPlay = true;
        object.mediaEndAction = 'none';
        // Articulate gibi: küçük hoparlör ikonu, sahne DIŞINA (sağ üst pasteboard).
        const sw = Number(activity.stageWidth) || 1920;
        const audioCount = (activity.objects || []).filter((it) => it.type === 'audio').length;
        object.width = 56;
        object.height = 56;
        object.x = sw + 24;
        object.y = 24 + audioCount * 70;
        object.isOffstageAudio = true;
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

  const copySlide = useCallback(() => {
    if (!currentSlide) return false;
    slideClipboardRef.current = currentSlide;
    bumpClipboard();
    showToast?.(`"${currentSlide.sceneName || currentSlide.name || 'Sahne'}" kopyalandı.`, 'success');
    return true;
  }, [bumpClipboard, currentSlide, showToast, slideClipboardRef]);

  const pasteSlide = useCallback(() => {
    if (!activity || !slideClipboardRef.current) {
      showToast?.('Yapıştırmak için önce bir sahne kopyalayın.', 'info');
      return false;
    }
    const nextActivity = pasteActivitySlide(activity, slideClipboardRef.current, currentSlide?.id);
    updateActivity(nextActivity);
    const pastedSlide = getActivitySlides(nextActivity).find(
      (slide) => slide.id === nextActivity.currentSlideId
    );
    showToast?.(`"${pastedSlide?.sceneName || pastedSlide?.name || 'Sahne'}" yapıştırıldı.`, 'success');
    return true;
  }, [activity, currentSlide?.id, showToast, slideClipboardRef, updateActivity]);

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
    updateActivity(groupActivitySelection(activity, targetIds));
    setSelectedIds(new Set(targetIds));
  }, [activity, setSelectedIds, targetIds, updateActivity]);

  const ungroupSelection = useCallback(() => {
    if (!activity || !targetIds.size) return;
    updateActivity(ungroupActivitySelection(activity, targetIds));
    setSelectedIds(new Set(targetIds));
  }, [activity, setSelectedIds, targetIds, updateActivity]);

  // Canlı önizleme: görselleştirmeyi aç, zamanı sıfırla, bir sonraki frame'de oynat.
  // "Önizle"/"Oynat" butonları ve efekt/yön/easing seçimi bunu tetikler.
  const triggerAnimationPreview = useCallback(() => {
    setTimelineVisualization?.(true);
    setTimelineCurrentTime?.(0);
    setTimelinePlaying?.(false);
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => setTimelinePlaying?.(true));
    } else {
      setTimelinePlaying?.(true);
    }
    setRibbonAnimationPreviewKey?.((current) => current + 1);
  }, [
    setRibbonAnimationPreviewKey,
    setTimelineCurrentTime,
    setTimelinePlaying,
    setTimelineVisualization,
  ]);

  const updateSelectedTimeline = useCallback(
    (patch, options = {}) => {
      if (!activity || !primaryObject) return;
      const timeline = syncTimelineWithObjects(activity);
      const nextTimeline = timeline.map((item, index) =>
        item.objectId === primaryObject.id
          ? normalizeTimelineItem({ ...item, ...patch }, index, activity.objects || [])
          : item
      );
      updateActivity({ ...activity, timeline: nextTimeline });
      // Efekt/yön/easing/preset seçilince canvas'ta anında oynat (kullanıcı tercihi).
      if (options.preview !== false) triggerAnimationPreview();
    },
    [activity, primaryObject, triggerAnimationPreview, updateActivity]
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
      triggerAnimationPreview();
    },
    [activity, dragDropSettings, triggerAnimationPreview, updateActivity]
  );

  const patchLms = useCallback(
    (patch) => commit((state) => ({ ...state, lmsConfig: { ...(state.lmsConfig || {}), ...patch } })),
    [commit]
  );

  const applyButtonPackage = useCallback(
    (pkgId) => {
      if (!activity) return;
      const committed = {
        ...commitMaterializedActivity(activity),
        buttonPackageId: pkgId,
        buttonAnimationProfileId:
          activity.buttonAnimationProfileId ||
          BUTTON_PACKAGES.find((item) => item.id === pkgId)?.animationProfileId ||
          '',
      };
      const motion =
        getActivityButtonMotion(committed) || getButtonPackageMotion(pkgId);
      const slides = getActivitySlides(committed);
      const currentSlideId = committed.currentSlideId || slides[0]?.id || '';
      const nextSlides = slides.map((slide, index) => {
        const nextObjects = restyleAllButtonsForPackage(slide.objects || [], pkgId, {
          textColor: committed.readyButtonTextColor || '',
        }).map((object) =>
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
      updateActivity(
        selectActivitySlide(
          {
            ...committed,
            slides: nextSlides,
            currentSlideId,
            startSlideId: nextSlides[0]?.id || committed.startSlideId || '',
          },
          currentSlideId
        )
      );
    },
    [activity, updateActivity]
  );

  const applyButtonMotion = useCallback(
    (profileId) => {
      if (!activity) return;
      const motion = getButtonMotionProfile(profileId);
      const slidesForMotion = getActivitySlides(activity);
      const currentSlideId = activity.currentSlideId || slidesForMotion[0]?.id || '';
      const nextSlides = slidesForMotion.map((slide, index) => {
        const nextObjects = (slide.objects || []).map((object) =>
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
      updateActivity(
        selectActivitySlide(
          {
            ...activity,
            buttonAnimationProfileId: profileId,
            slides: nextSlides,
            currentSlideId,
            startSlideId: nextSlides[0]?.id || activity.startSlideId || '',
          },
          currentSlideId
        )
      );
    },
    [activity, updateActivity]
  );

  // Tüm hazır/üretilmiş butonların iç yazı rengi (boş = temadan gelen varsayılan).
  // Tek kaynak: hem Tasarım ribbonu hem Tasarım sağ paneli bu komutu kullanır.
  const applyReadyButtonTextColor = useCallback(
    (color) => {
      if (!activity) return;
      const presetId =
        activity.answerLayerStylePresetId ||
        bookDefaultStylePresetId ||
        DEFAULT_ANSWER_LAYER_STYLE_PRESET_ID;
      updateActivity(
        applyGeneratedThemeToActivity(
          { ...activity, readyButtonTextColor: color || '' },
          presetId
        )
      );
    },
    [activity, bookDefaultStylePresetId, updateActivity]
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

  // Bir master'ı uygula + yerleşim nesnelerini tek updateActivity'de ekle (race olmadan).
  const applyMasterLayout = useCallback(
    (presetId) => {
      if (!activity) return;
      const withMaster = applyMasterPresetToActivity(activity, presetId);
      const descriptors = buildMasterLayoutDescriptors(
        presetId,
        withMaster.stageWidth || 1920,
        withMaster.stageHeight || 1080
      );
      const currentObjects = Array.isArray(withMaster.objects) ? withMaster.objects : [];
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
      updateActivity({ ...withMaster, objects: [...currentObjects, ...newObjects] });
    },
    [activity, updateActivity]
  );

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

  const readyButtonPresets = useMemo(() => {
    const settings = { ...DEFAULT_ACTIVITY_SETTINGS, ...(activity?.settings || {}) };
    const tx = contentText(activity || {});
    return [
      {
        id: 'check',
        icon: '✓',
        label: settings.checkButtonText || tx.check,
        width: 330,
        tone: 'theme',
        runtimeAction: '',
        isCheckButton: true,
      },
      {
        id: 'menu',
        icon: '☰',
        label: settings.menuButtonText || tx.menu,
        width: 240,
        tone: 'theme',
        runtimeAction: 'help',
      },
      {
        id: 'prev',
        icon: '≪',
        label: tx.prev,
        width: 240,
        tone: 'theme',
        trigger: { action: 'SliderGec', value: '__prev__' },
      },
      {
        id: 'next',
        icon: '≫',
        label: tx.next,
        width: 240,
        tone: 'theme',
        trigger: { action: 'SliderGec', value: '__next__' },
      },
      {
        id: 'playpause',
        icon: '▶',
        label: 'Oynat / Duraklat',
        width: 300,
        tone: 'theme',
        runtimeAction: 'toggle-play-pause',
        playIcon: '▶',
        pauseIcon: '❚❚',
      },
      {
        id: 'mute',
        icon: '🔊︎',
        label: settings.soundOffText || tx.soundOff,
        width: 300,
        tone: 'theme',
        runtimeAction: 'toggle-mute',
        soundOnLabel: settings.soundOnText || tx.soundOn,
        soundOffLabel: settings.soundOffText || tx.soundOff,
        soundOnIcon: '🔇︎',
        soundOffIcon: '🔊︎',
      },
      {
        id: 'answer',
        icon: '✎',
        label: settings.solutionButtonText || tx.solution,
        width: 330,
        tone: 'success',
        runtimeAction: 'show-answer',
      },
      {
        id: 'restart',
        icon: '↻',
        label: settings.restartFlowText || tx.restart,
        width: 350,
        tone: 'danger',
        runtimeAction: 'restart',
      },
      {
        id: 'complete',
        icon: '✓',
        label: settings.completeButtonText || tx.closeActivity,
        width: 350,
        tone: 'success',
        runtimeAction: 'complete',
      },
      {
        id: 'start-activity',
        icon: '▶',
        label: settings.startActivityText || 'Etkinliği Başlat',
        width: 350,
        tone: 'theme',
        runtimeAction: '',
        trigger: { action: 'SliderGec', value: '__next__' },
      },
      {
        id: 'activity-intro',
        icon: '?',
        label: settings.activityIntroText || 'Etkinlik Tanıtımı',
        width: 350,
        tone: 'theme',
        runtimeAction: '',
        trigger: { action: 'SliderGec', value: '__prev__' },
      },
    ];
  }, [activity]);

  const insertReadyButton = useCallback(
    (kind) => {
      if (!activity) return;
      const objects = Array.isArray(activity.objects) ? activity.objects : [];
      const triggers = Array.isArray(activity.triggers) ? activity.triggers : [];
      const preset = readyButtonPresets.find((item) => item.id === kind) || readyButtonPresets[0];
      const stageWidth = Number(activity.stageWidth || 1920) || 1920;
      const stageHeight = Number(activity.stageHeight || 1080) || 1080;
      const existingCount = objects.filter((item) => item.type === 'button').length;
      const offset = Math.min(existingCount * 18, 120);
      const tone = preset.tone || 'primary';
      const stylePreset = getAnswerLayerStylePresetById(
        activity.answerLayerStylePresetId ||
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
      const locale =
        getActivityContentLanguage(activity) === 'de'
          ? 'de-DE'
          : getActivityContentLanguage(activity) === 'en'
            ? 'en-US'
            : 'tr-TR';
      const makeReadyButton = (patch = {}) => {
        const baseButton = createObjectFromActivity(activity, 'button');
        const label = String(patch.label || '').toLocaleUpperCase(locale);
        return {
          ...baseButton,
          label,
          x: patch.x,
          y,
          width: patch.width,
          height,
          layerId: activity.activeLayerId || 'base',
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
            // Aktivitede "Buton yazı rengi" ayarlıysa yeni buton da onu (renge uyumlu
            // gölgesiyle birlikte) kilitli alsın.
            ...(activity.readyButtonTextColor
              ? {
                  color: activity.readyButtonTextColor,
                  colorLocked: true,
                  ...(readyButtonTextShadowForColor(activity.readyButtonTextColor)
                    ? { textShadow: readyButtonTextShadowForColor(activity.readyButtonTextColor) }
                    : {}),
                }
              : {}),
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
        x,
        width: iconWidth,
        zIndex: topZIndex + 1,
        fontSize: READY_BUTTON_ICON_SIZE,
        lineHeight: 1,
        soundIconMode: preset.id === 'mute' ? 'icon-only' : '',
        sceneTemplateSlotId: `ready-button:${preset.id}-icon`,
      });
      const iconSvg =
        preset.id !== 'mute'
          ? getSemanticSvgIcon(preset.runtimeAction || preset.id, preset.label, { strokeWidth: 2.5 })
          : '';
      iconObject.style = {
        ...(iconObject.style || {}),
        borderRadius: 999,
        fontSize: READY_BUTTON_ICON_SIZE,
        padding: iconSvg ? '16%' : 0,
        textAlign: 'center',
        whiteSpace: 'nowrap',
      };
      if (iconSvg) {
        iconObject.icon = { svg: iconSvg };
        iconObject.iconPosition = 'only';
      }
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
              id: uid(),
              when: 'onClick',
              target: labelObject.id,
              action: preset.trigger.action,
              value: preset.trigger.value,
              name: `${preset.label} tıklama görevi`,
            },
          ]
        : triggers;
      const nextObjects = [...objects, iconObject, labelObject];
      updateActivity({
        ...activity,
        objects: nextObjects,
        triggers: nextTriggers,
        selectedObjectId: labelObject.id,
        activeLayerId: labelObject.layerId,
        timeline: syncTimelineWithObjects({ ...activity, objects: nextObjects }),
      });
      setSelectedIds(new Set([iconObject.id, labelObject.id]));
      setActiveEditorTab('nesneler');
    },
    [
      activity,
      bookDefaultStylePresetId,
      readyButtonPresets,
      setActiveEditorTab,
      setSelectedIds,
      updateActivity,
    ]
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
      group: selectionMeta.canGroup,
      ungroup: selectionMeta.canUngroup,
      selectionLocked: selectionMeta.allLocked,
      selectionGrouped: selectionMeta.canUngroup,
      textStyle: !!primaryObject && primaryObject.type === 'text',
      pasteObject: hasObjectClipboard,
      pasteSlide: !!slideClipboardRef.current,
      pasteAnimation: !!animationClipboardRef.current,
      pasteStyle: !!styleClipboardRef.current,
      undo: !!history?.past?.length,
      redo: !!history?.future?.length,
    },
    commands: {
      addSlide,
      setSlideSection: () => {
        if (!currentSlide || typeof window === 'undefined') return;
        const title = window.prompt(
          'Bölüm başlığı (boş bırakırsanız kaldırılır):',
          currentSlide.sectionTitle || ''
        );
        if (title === null) return;
        patchCurrentSlide({ sectionTitle: title.trim() });
      },
      align: (mode) => activity && updateActivity(alignActivitySelection(activity, selectedIds, mode)),
      applyButtonPackage,
      applyButtonMotion,
      applyReadyButtonTextColor,
      applyMasterLayoutObjects,
      applyMasterLayout,
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
      copy: () => {
        const copied = canvasRef.current?.copySelected?.();
        if (copied !== false) bumpClipboard();
      },
      copySlide,
      copySelectedAnimation: () => {
        if (!selectedTimelineItem) {
          showToast?.('Kopyalanacak animasyon seçili değil.', 'info');
          return;
        }
        animationClipboardRef.current = {
          entryEffect: selectedTimelineItem.entryEffect || 'none',
          exitEffect: selectedTimelineItem.exitEffect || 'none',
          direction: selectedTimelineItem.direction || 'left',
          easing: selectedTimelineItem.easing || 'easeOut',
          duration: selectedTimelineItem.duration ?? 2,
          startMode: selectedTimelineItem.startMode || 'with-previous',
        };
        bumpClipboard();
        showToast?.('Animasyon ayarları kopyalandı.', 'success');
      },
      cut: () => {
        const copied = canvasRef.current?.copySelected?.();
        if (copied !== false) {
          bumpClipboard();
          canvasRef.current?.deleteSelected?.();
        }
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
      insertReadyButton,
      insertComponent: (kind) => {
        const componentMap = {
          'info-box': { label: 'Bilgi Kutusu', text: 'Bilgi Kutusu', background: '#eff6ff', borderColor: '#60a5fa' },
          'warning-box': { label: 'Uyarı', text: 'Uyarı', background: '#fff7ed', borderColor: '#fb923c' },
          card: { label: 'Kart', text: 'Kart Başlığı', background: '#ffffff', borderColor: '#cbd5e1', boxShadow: '0 10px 24px rgba(15,23,42,.12)' },
          accordion: { label: 'Akordeon', text: 'Akordeon Başlığı', background: '#f8fafc', borderColor: '#94a3b8' },
        };
        insertObject('text', componentMap[kind] || componentMap.card);
      },
      insertIcon: () =>
        openIconPicker?.((selection) =>
          insertObject('text', {
            label: selection?.iconName ? `${selection.iconName} ikonu` : 'İkon',
            iconName: selection?.iconName || '',
            iconSvg: selection?.iconSvg || '',
            width: 120,
            height: 120,
            color: '#2563eb',
          })
        ),
      openIconPicker: (onSelect) => openIconPicker?.(onSelect),
      insertSymbol: () =>
        openSymbolPicker?.((item) => {
          if (!item) return;
          insertObject('text', {
            label: item.name || 'Sembol',
            text: item.char,
            fontSize: 48,
            textAlign: 'center',
            background: 'transparent',
            width: 80,
            height: 80,
          });
        }),
      insertCharacter: () =>
        openCharacterPicker?.((result) => {
          if (!result) return;
          if (result.kind === 'upload') {
            insertImage();
            return;
          }
          // emoji karakter → büyük metin nesnesi
          insertObject('text', {
            label: result.name || 'Karakter',
            text: result.value,
            fontSize: 96,
            background: 'transparent',
            width: 140,
            height: 160,
          });
        }),
      openContentLibrary: () =>
        openContentLibrary?.((item) => {
          if (!item) return;
          if (item.type === 'background') {
            patchActivity({ backgroundColor: item.value });
            return;
          }
          if (item.type === 'shape') {
            const shapeKindMap = { circle: 'ellipse', hexagon: 'hexagon', star: 'star5' };
            insertShape(shapeKindMap[item.value] || 'roundedRect');
            return;
          }
          if (item.type === 'button') {
            insertObject('button', { label: item.name, style: item.value });
            return;
          }
          // text: ikon / işaretçi / ok glyph'i → metin nesnesi
          insertObject('text', {
            label: item.name,
            text: item.value,
            fontSize: item.category === 'markers' ? 40 : 48,
            background: 'transparent',
          });
        }),
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
      openBranchReport: () => setShowBranchDiagram?.(true),
      openGlossaryEditor: () => setShowGlossaryEditor?.(true),
      openVariablesManager: () => setShowVariablesManager?.(true),
      openPreview: handleOpenStorylinePreview,
      openProject: () => importRef.current?.click?.(),
      openSceneNotes: () => setStoryRibbonTab('scene'),
      openScenePanel: () => handleEditorTabSelect('sahne'),
      openTextStudio: () => openTextStudioWindow?.(true),
      paste: () => canvasRef.current?.pasteClipboard?.(),
      pasteSlide,
      pasteSelectedAnimation: () => {
        if (!animationClipboardRef.current) {
          showToast?.('Önce bir animasyon kopyala.', 'info');
          return;
        }
        updateSelectedTimeline(animationClipboardRef.current);
      },
      patchActivity,
      patchCurrentSlide,
      patchLms,
      patchObject,
      previewTransition: handleOpenStorylinePreview,
      redo: history?.redo,
      resetLayout,
      restartAnimationPreview: triggerAnimationPreview,
      stopAnimationPreview: () => setTimelinePlaying?.(false),
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
      copyObjectStyle: () => {
        if (!primaryObject) return;
        styleClipboardRef.current = { ...(primaryObject.style || {}) };
        bumpClipboard();
        showToast?.('Biçim kopyalandı');
      },
      convertToEditablePoints: () => {
        if (!primaryObject || primaryObject.type !== 'shape') return;
        const kind = primaryObject.shapeKind || 'roundedRect';
        let points;
        if (kind === 'triangle') {
          points = [{ x: 50, y: 4 }, { x: 96, y: 96 }, { x: 4, y: 96 }];
        } else if (kind === 'diamond') {
          points = [{ x: 50, y: 2 }, { x: 98, y: 50 }, { x: 50, y: 98 }, { x: 2, y: 50 }];
        } else if (kind === 'ellipse') {
          points = Array.from({ length: 8 }, (_, i) => {
            const angle = (i / 8) * Math.PI * 2 - Math.PI / 2;
            return { x: 50 + 48 * Math.cos(angle), y: 50 + 48 * Math.sin(angle) };
          });
        } else {
          points = [{ x: 2, y: 2 }, { x: 98, y: 2 }, { x: 98, y: 98 }, { x: 2, y: 98 }];
        }
        patchObject({ shapeKind: 'customPath', showShapeLabel: false, vectorPoints: points });
        showToast?.('Düğümler düzenlenebilir — tutamaçları sürükleyin');
      },
      exportTranslation: () => {
        if (!activity || typeof document === 'undefined') return;
        const seen = new Set();
        const entries = [];
        const collect = (objects) => {
          (Array.isArray(objects) ? objects : []).forEach((object) => {
            if (!object || seen.has(object.id)) return;
            seen.add(object.id);
            const entry = { id: object.id };
            if (typeof object.label === 'string' && object.label.trim()) entry.label = object.label;
            if (typeof object.text === 'string' && object.text.trim()) entry.text = object.text;
            if (entry.label || entry.text) entries.push(entry);
          });
        };
        collect(activity.objects);
        (activity.slides || []).forEach((slide) => collect(slide.objects));
        const payload = { activityId: activity.id, activityName: activity.name || activity.sceneName || '', entries };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `ceviri-${(activity.name || 'etkinlik').replace(/\s+/g, '-')}.json`;
        anchor.click();
        URL.revokeObjectURL(url);
        showToast?.(`${entries.length} metin dışa aktarıldı`);
      },
      importTranslation: () =>
        selectLocalFile('application/json,.json', async (file) => {
          if (!activity) return;
          let data;
          try {
            data = JSON.parse(await file.text());
          } catch {
            showToast?.('Geçersiz çeviri dosyası');
            return;
          }
          const byId = {};
          (Array.isArray(data?.entries) ? data.entries : []).forEach((entry) => {
            if (entry && entry.id) byId[entry.id] = entry;
          });
          let count = 0;
          const applyToObjects = (objects) =>
            (Array.isArray(objects) ? objects : []).map((object) => {
              const entry = object && byId[object.id];
              if (!entry) return object;
              let next = object;
              if (typeof entry.label === 'string' && entry.label !== object.label) {
                next = { ...next, label: entry.label };
                count += 1;
              }
              if (typeof entry.text === 'string' && entry.text !== object.text) {
                next = { ...next, text: entry.text };
                count += 1;
              }
              return next;
            });
          updateActivity({
            ...activity,
            objects: applyToObjects(activity.objects),
            slides: (activity.slides || []).map((slide) => ({ ...slide, objects: applyToObjects(slide.objects) })),
          });
          showToast?.(`${count} metin güncellendi`);
        }),
      countObjectText: (search) => {
        if (!activity || !search) return 0;
        return (activity.objects || []).reduce((count, item) => {
          const fields = [item.label, item.text].filter((v) => typeof v === 'string');
          return count + fields.reduce((c, value) => c + value.split(search).length - 1, 0);
        }, 0);
      },
      replaceObjectText: (search, replace) => {
        if (!activity || !search) return 0;
        let count = 0;
        const objects = (activity.objects || []).map((item) => {
          let next = item;
          ['label', 'text'].forEach((key) => {
            if (typeof next[key] === 'string' && next[key].includes(search)) {
              count += next[key].split(search).length - 1;
              next = { ...next, [key]: next[key].split(search).join(replace) };
            }
          });
          return next;
        });
        if (count) updateActivity({ ...activity, objects });
        return count;
      },
      pasteObjectStyle: () => {
        if (!styleClipboardRef.current) {
          showToast?.('Önce bir nesnenin biçimini kopyalayın');
          return;
        }
        setObjectStyle(styleClipboardRef.current);
      },
      setRibbonTab: (tab) => {
        setStoryRibbonTab(tab);
        if (['scene', 'design', 'transitions', 'view'].includes(tab)) {
          setActiveEditorTab('sahne');
        }
        if (['insert', 'animation', 'object-format'].includes(tab)) {
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
      showLeftPanel: () => setIsSlidePanelCollapsed?.(false),
      hideLeftPanel: () => setIsSlidePanelCollapsed?.(true),
      compactTimeline: () => {
        setTimelineDockOpen?.(true);
        setTimelineHeight?.(96);
      },
      showTimeline: () => {
        setTimelineDockOpen?.(true);
        setTimelineHeight?.(220);
      },
      toggleBaseLayer: () => onShowBaseLayerChange?.(!showBaseLayer),
      toggleViewOption,
      undo: history?.undo,
      ungroupSelection,
      updateSelectedTimeline,
      applyMotionPath: (pathId) => {
        if (!selectedTimelineItem) return;
        const duration = Math.max(0.2, Number(selectedTimelineItem.duration) || 4);
        const kf = (time, x, y) => ({
          id: uid(),
          name: 'Kare',
          time: Number(time.toFixed(2)),
          x: Math.round(x),
          y: Math.round(y),
          scale: 1,
          opacity: 1,
        });
        let frames;
        switch (pathId) {
          case 'left':
            frames = [kf(0, 0, 0), kf(duration, -320, 0)];
            break;
          case 'up':
            frames = [kf(0, 0, 0), kf(duration, 0, -220)];
            break;
          case 'down':
            frames = [kf(0, 0, 0), kf(duration, 0, 220)];
            break;
          case 'diagonal':
            frames = [kf(0, 0, 0), kf(duration, 300, 220)];
            break;
          case 'arc':
            frames = [kf(0, 0, 0), kf(duration * 0.5, 160, -170), kf(duration, 320, 0)];
            break;
          case 'zigzag':
            frames = [kf(0, 0, 0), kf(duration * 0.25, 80, -70), kf(duration * 0.5, 160, 0), kf(duration * 0.75, 240, -70), kf(duration, 320, 0)];
            break;
          case 'bounce':
            frames = [kf(0, 0, 0), kf(duration * 0.3, 90, -130), kf(duration * 0.5, 160, 0), kf(duration * 0.72, 240, -70), kf(duration, 320, 0)];
            break;
          case 'circle':
            frames = Array.from({ length: 9 }, (_, i) => {
              const angle = (i / 8) * Math.PI * 2;
              return kf((duration * i) / 8, 130 * Math.sin(angle), 130 * (Math.cos(angle) - 1));
            });
            break;
          case 'right':
          default:
            frames = [kf(0, 0, 0), kf(duration, 320, 0)];
        }
        updateSelectedTimeline({ keyframes: frames });
        showToast?.('Hareket yolu uygulandı');
      },
      zoomBy: (delta) => setZoom((value) => (typeof value === 'number' ? clamp(value + delta, 0.2, 3) : 1 + delta)),
    },
    currentContentLanguage: getActivityContentLanguage(activity || {}),
    currentSlide,
    dragAnimationPreset,
    galleries: {
      buttonPackages: BUTTON_PACKAGES,
      readyButtons: readyButtonPresets,
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
      transitionSounds: SLIDE_TRANSITION_SOUND_OPTIONS,
      trackingModes: LMS_TRACKING_MODE_OPTIONS,
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
      showBaseLayer: showBaseLayer !== false,
      snapEnabled: view.snapEnabled !== false,
      zoom,
    },
  };
}
