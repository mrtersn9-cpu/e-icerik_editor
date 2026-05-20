/* eslint-disable no-unused-vars, import/order, react/no-unstable-nested-components */
import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from 'react';

import {
  getSelectionUi,
  resolveWrongSelectionGlyph,
  getFitScale,
  getSelectionMarkGlyph,
  isObjectTimelineActive,
  getTimelineMotionStyle,
} from '../storyline-preview';
import {
  OBJ_PRESETS,
  RIBBON_SHAPE_PRESETS,
  BUTTON_STYLE_PRESETS,
  HANDLE_DIRS,
  HANDLE_POS,
  HANDLE_CURSOR,
} from '../../constants';
import {
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
} from '../../logic/factories';
import {
  getCanvasObjects,
  syncTimelineWithObjects,
  getActivityTimeline,
} from '../../logic/activityHelpers';
import {
  isGeneratedSceneTemplateObject,
  createObjectFromActivity,
  updateActivityObject,
} from '../../logic/activityFactory';
import {
  getEditorLinkedSelectionIds,
  getEditorPrimaryObjectId,
} from '../../logic/editorHelpers';
import { sanitizeSvgMarkup, uid, clamp } from '../../utils/editorHelpers';
import { uploadMediaFile, fileToDataUrl } from '../../api/apiClient';
import { upgradeDragDropStyle } from '../../logic/factories';
import { ShapePreviewIcon } from '../ui';

const StageCanvas = forwardRef(function StageCanvas(
  {
    activity,
    onUpdate,
    zoom = 'fit',
    onZoomChange,
    selectedIds,
    onSelectionChange,
    timelineTime = 0,
    showBaseLayer = true,
  },
  ref
) {
  const viewportRef = useRef(null);
  const stageRef = useRef(null);
  const latestRef = useRef(activity);
  const interactRef = useRef(null);
  const fileRef = useRef(null);
  const imgRef = useRef(null);
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const zoomRef = useRef(zoom);
  const latestSelectedIdsRef = useRef(selectedIds);
  const clipboardRef = useRef(null);
  const rubberStartRef = useRef(null);
  const rubberHandlersRef = useRef(null);
  const dragSnapshotRef = useRef(null);
  const vectorEditRef = useRef(null);
  const [rubberBand, setRubberBand] = useState(null);
  const [selectedVectorAnchor, setSelectedVectorAnchor] = useState({ objectId: null, indices: [] });
  const [viewportSize, setViewportSize] = useState({ width: 1280, height: 760 });

  useEffect(() => {
    latestRef.current = activity;
  }, [activity]);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);
  useEffect(() => {
    latestSelectedIdsRef.current = selectedIds;
  }, [selectedIds]);
  useEffect(
    () => () => {
      if (interactRef.current) {
        interactRef.current();
        interactRef.current = null;
      }
    },
    []
  );
  useEffect(() => {
    return () => {
      if (vectorEditRef.current) {
        window.removeEventListener('pointermove', vectorEditRef.current.move);
        window.removeEventListener('pointerup', vectorEditRef.current.up);
        vectorEditRef.current = null;
      }
    };
  }, []);
  // Cleanup rubber-band listeners on unmount
  useEffect(() => {
    return () => {
      if (rubberHandlersRef.current) {
        window.removeEventListener('pointermove', rubberHandlersRef.current.move);
        window.removeEventListener('pointerup', rubberHandlersRef.current.up);
        rubberHandlersRef.current = null;
      }
    };
  }, []);
  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return undefined;

    const updateViewport = () => {
      const rect = node.getBoundingClientRect();
      setViewportSize({
        width: Math.max(260, rect.width),
        height: Math.max(240, rect.height),
      });
    };

    updateViewport();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateViewport);
      return () => window.removeEventListener('resize', updateViewport);
    }

    const observer = new ResizeObserver(updateViewport);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const objects = getCanvasObjects(activity);
  const hasSvg = !!activity.svgMarkup;
  const hasObjects = objects.length > 0;
  const pdfBackgroundObject = useMemo(
    () => objects.find((object) => object?.isPdfBackground && object?.imageData) || null,
    [objects]
  );
  const renderObjects = useMemo(
    () => objects.filter((object) => !pdfBackgroundObject || object.id !== pdfBackgroundObject.id),
    [objects, pdfBackgroundObject]
  );
  const currentLayerId = activity.activeLayerId || 'base';
  const overlayLayerActive = currentLayerId !== 'base';
  const hasExplicitLayerBackdrop = useMemo(() => {
    if (!overlayLayerActive) return false;
    return renderObjects.some((object) => {
      const layerId = object.layerId || 'base';
      if (layerId !== currentLayerId || object.type !== 'shape' || object.visible === false)
        return false;
      const bg = String(object.style?.background || '').toLowerCase();
      const coversStage =
        (Number(object.x) || 0) <= 2 &&
        (Number(object.y) || 0) <= 2 &&
        (Number(object.width) || 0) >= (Number(activity.stageWidth) || 1920) - 2 &&
        (Number(object.height) || 0) >= (Number(activity.stageHeight) || 1080) - 2;
      const darkBackdrop =
        bg.includes('rgba(0,0,0') ||
        bg.includes('rgba(15,23,42') ||
        bg === '#000' ||
        bg === '#000000';
      const alphaMatch = bg.match(/rgba\([^)]*,\s*([.\d]+)\s*\)/);
      const alpha = alphaMatch ? Number(alphaMatch[1]) : 1;
      return coversStage && darkBackdrop && alpha >= 0.05;
    });
  }, [
    activity.stageHeight,
    activity.stageWidth,
    currentLayerId,
    overlayLayerActive,
    renderObjects,
  ]);

  const baseScale = useMemo(() => {
    return getFitScale(
      activity.stageWidth || 1920,
      activity.stageHeight || 1080,
      viewportSize.width - 20,
      viewportSize.height - 52
    );
  }, [activity.stageWidth, activity.stageHeight, viewportSize.height, viewportSize.width]);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node || !onZoomChange) return undefined;

    const onNativeWheel = (event) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      event.stopPropagation();
      const delta = event.deltaY < 0 ? 0.1 : -0.1;
      onZoomChange((current) => {
        const currentScale = current === 'fit' ? baseScale : Number(current) || baseScale;
        return clamp(Number((currentScale + delta).toFixed(2)), 0.1, 4);
      });
    };

    node.addEventListener('wheel', onNativeWheel, { passive: false });
    return () => node.removeEventListener('wheel', onNativeWheel, { passive: false });
  }, [baseScale, onZoomChange]);

  const resolvedZoom = zoom === 'fit' ? baseScale : Number(zoom) || baseScale;
  const scale = resolvedZoom;
  const vw = Math.round((activity.stageWidth || 1920) * scale);
  const vh = Math.round((activity.stageHeight || 1080) * scale);
  const zoomPercent = Math.round(scale * 100);

  const toStage = useCallback(
    (cx, cy) => {
      const r = stageRef.current?.getBoundingClientRect();
      if (!r) return { x: 0, y: 0 };
      const sw = latestRef.current.stageWidth || 1920;
      const sh = latestRef.current.stageHeight || 1080;
      const sc = zoomRef.current === 'fit' ? baseScale : Number(zoomRef.current) || baseScale;
      return {
        x: Math.min(Math.max((cx - r.left) / sc, 0), sw),
        y: Math.min(Math.max((cy - r.top) / sc, 0), sh),
      };
    },
    [baseScale]
  );

  const patchAct = useCallback(
    (p) => {
      const a = latestRef.current;
      onUpdate({ ...a, ...p });
    },
    [onUpdate]
  );

  const patchObj = useCallback(
    (id, p, options = {}) => {
      const a = latestRef.current;
      onUpdate(updateActivityObject(a, id, p, options));
    },
    [onUpdate]
  );

  const applyVectorPoints = useCallback(
    (objectId, points) => {
      const normalized = points.map((point) => normalizeVectorPoint(point));
      patchObj(objectId, {
        vectorPoints: normalized,
        vectorPath: buildVectorPathFromPoints(normalized, true),
      });
    },
    [patchObj]
  );

  const addObject = useCallback(
    (type, options = {}) => {
      const a = latestRef.current;
      const objs = a.objects || [];
      const o =
        type === 'shape'
          ? createShapeObject(options.shapeKind || 'roundedRect')
          : type === 'button'
            ? createButtonPresetObject(options.buttonPresetId || 'btn-blue')
            : createObjectFromActivity(a, type);
      o.zIndex = objs.length + 1;
      o.layerId = a.activeLayerId || 'base';
      // draggable/dropzone presets already have correct default colors — no override needed
      onUpdate({
        ...a,
        objects: [...objs, o],
        selectedObjectId: o.id,
        timeline: syncTimelineWithObjects({ ...a, objects: [...objs, o] }),
      });
      onSelectionChange(new Set([o.id]));
    },
    [onUpdate, onSelectionChange]
  );

  const addImageFile = useCallback(
    (file) => {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const a = latestRef.current;
        const objs = a.objects || [];
        const o = createObject('image');
        o.imageData = ev.target.result;
        o.label = file.name.replace(/\.[^.]+$/, '');
        o.zIndex = objs.length + 1;
        o.layerId = a.activeLayerId || 'base';
        onUpdate({
          ...a,
          objects: [...objs, o],
          selectedObjectId: o.id,
          timeline: syncTimelineWithObjects({ ...a, objects: [...objs, o] }),
        });
        onSelectionChange(new Set([o.id]));
      };
      reader.readAsDataURL(file);
    },
    [onUpdate, onSelectionChange]
  );

  const addVideoFile = useCallback(
    async (file) => {
      if (!file) return;
      const mediaUrl = await uploadMediaFile(file);
      const a = latestRef.current;
      const objs = a.objects || [];
      const o = createObject('video');
      o.mediaUrl = mediaUrl;
      o.mediaName = file.name;
      o.label = file.name.replace(/\.[^.]+$/, '') || 'Video';
      o.zIndex = objs.length + 1;
      o.layerId = a.activeLayerId || 'base';
      onUpdate({
        ...a,
        objects: [...objs, o],
        selectedObjectId: o.id,
        timeline: syncTimelineWithObjects({ ...a, objects: [...objs, o] }),
      });
      onSelectionChange(new Set([o.id]));
    },
    [onUpdate, onSelectionChange]
  );

  const addAudioFile = useCallback(
    async (file) => {
      if (!file) return;
      const mediaUrl = await uploadMediaFile(file);
      const a = latestRef.current;
      const objs = a.objects || [];
      const o = createObject('audio');
      o.mediaUrl = mediaUrl;
      o.mediaName = file.name;
      o.label = file.name.replace(/\.[^.]+$/, '') || 'Ses';
      o.showPlayerControls = false;
      o.autoPlay = true;
      o.mediaEndAction = 'none';
      o.zIndex = objs.length + 1;
      o.layerId = a.activeLayerId || 'base';
      onUpdate({
        ...a,
        objects: [...objs, o],
        selectedObjectId: o.id,
        timeline: syncTimelineWithObjects({ ...a, objects: [...objs, o] }),
      });
      onSelectionChange(new Set([o.id]));
    },
    [onUpdate, onSelectionChange]
  );

  const loadSvgFile = useCallback(
    (file) => {
      if (!file) return;
      file
        .text()
        .then((markup) => patchAct({ svgMarkup: sanitizeSvgMarkup(markup), svgName: file.name }));
    },
    [patchAct]
  );

  const deleteSelected = useCallback(() => {
    const a = latestRef.current;
    const ids = latestSelectedIdsRef.current;
    const toDelete =
      ids.size > 0 ? ids : a.selectedObjectId ? new Set([a.selectedObjectId]) : new Set();
    if (toDelete.size === 0) return;
    const rest = (a.objects || []).filter(
      (o) => !toDelete.has(o.id) || (o.locked && o.generatedBy !== 'answer-placement')
    );
    onUpdate({
      ...a,
      objects: rest,
      selectedObjectId: rest[rest.length - 1]?.id || null,
      timeline: syncTimelineWithObjects({ ...a, objects: rest }),
    });
    onSelectionChange(new Set());
  }, [onUpdate, onSelectionChange]);

  const copySelected = useCallback(() => {
    const a = latestRef.current;
    const ids =
      latestSelectedIdsRef.current.size > 0
        ? latestSelectedIdsRef.current
        : a.selectedObjectId
          ? new Set([a.selectedObjectId])
          : new Set();
    if (ids.size === 0) return false;

    const selectedObjects = (a.objects || [])
      .filter((item) => ids.has(item.id))
      .sort((left, right) => (left.zIndex || 0) - (right.zIndex || 0));
    if (!selectedObjects.length) return false;

    const timelineByObject = new Map(getActivityTimeline(a).map((item) => [item.objectId, item]));
    clipboardRef.current = {
      objects: selectedObjects.map((item) => ({
        ...item,
        style: item.style ? { ...item.style } : item.style,
      })),
      timeline: selectedObjects
        .map((item) => timelineByObject.get(item.id))
        .filter(Boolean)
        .map((item) => ({
          ...item,
          keyframes: Array.isArray(item.keyframes)
            ? item.keyframes.map((frame) => ({ ...frame }))
            : [],
        })),
      copiedAt: Date.now(),
    };
    return true;
  }, []);

  const pasteClipboard = useCallback(() => {
    const clipboard = clipboardRef.current;
    if (!clipboard?.objects?.length) return false;

    const a = latestRef.current;
    const existingObjects = a.objects || [];
    const existingTimeline = getActivityTimeline(a);
    const idMap = new Map();
    const groupIdMap = new Map();
    const newSelection = new Set();
    const duplicatedObjects = clipboard.objects.map((item, index) => {
      const newId = uid();
      idMap.set(item.id, newId);
      newSelection.add(newId);
      const sourceGroupId = String(item.groupId || '').trim();
      if (sourceGroupId && !groupIdMap.has(sourceGroupId)) groupIdMap.set(sourceGroupId, uid());
      return {
        ...item,
        id: newId,
        groupId: sourceGroupId ? groupIdMap.get(sourceGroupId) : item.groupId || '',
        x: Math.max(0, (Number(item.x) || 0) + 24),
        y: Math.max(0, (Number(item.y) || 0) + 24),
        zIndex: existingObjects.length + index + 1,
        style: item.style ? { ...item.style } : item.style,
      };
    });
    const duplicatedTimeline = (clipboard.timeline || []).map((item, index) => ({
      ...item,
      id: uid(),
      objectId: idMap.get(item.objectId) || '',
      track: existingTimeline.length + index,
      keyframes: Array.isArray(item.keyframes)
        ? item.keyframes.map((frame) => ({ ...frame, id: uid() }))
        : [],
    }));
    const nextObjects = [...existingObjects, ...duplicatedObjects];
    const nextTimeline = syncTimelineWithObjects({
      ...a,
      objects: nextObjects,
      timeline: [...existingTimeline, ...duplicatedTimeline],
    });
    const lastId = duplicatedObjects[duplicatedObjects.length - 1]?.id || null;
    onUpdate({ ...a, objects: nextObjects, selectedObjectId: lastId, timeline: nextTimeline });
    onSelectionChange(newSelection);
    return true;
  }, [onSelectionChange, onUpdate]);

  const duplicateSelected = useCallback(() => {
    if (!copySelected()) return;
    pasteClipboard();
  }, [copySelected, pasteClipboard]);

  const bringFront = useCallback(() => {
    const a = latestRef.current;
    const id = a.selectedObjectId;
    if (!id) return;
    onUpdate({
      ...a,
      objects: (a.objects || []).map((o) =>
        o.id === id ? { ...o, zIndex: (a.objects || []).length + 1 } : o
      ),
    });
  }, [onUpdate]);

  const sendBack = useCallback(() => {
    const a = latestRef.current;
    const id = a.selectedObjectId;
    if (!id) return;
    onUpdate({
      ...a,
      objects: (a.objects || []).map((o) =>
        o.id === id ? { ...o, zIndex: 1 } : { ...o, zIndex: o.zIndex + 1 }
      ),
    });
  }, [onUpdate]);

  const nudge = useCallback(
    (dx, dy) => {
      const a = latestRef.current;
      const ids = latestSelectedIdsRef.current;
      const targetIds =
        ids.size > 0 ? ids : a.selectedObjectId ? new Set([a.selectedObjectId]) : new Set();
      if (targetIds.size === 0) return;
      onUpdate({
        ...a,
        objects: (a.objects || []).map((o) =>
          targetIds.has(o.id) && !o.locked ? { ...o, x: o.x + dx, y: o.y + dy } : o
        ),
      });
    },
    [onUpdate]
  );

  useImperativeHandle(
    ref,
    () => ({
      getActivitySnapshot: () => latestRef.current || {},
      addObject,
      addImage: () => imgRef.current?.click(),
      addVideo: () => videoRef.current?.click(),
      addAudio: () => audioRef.current?.click(),
      loadSVG: () => fileRef.current?.click(),
      deleteSelected,
      copySelected,
      pasteClipboard,
      duplicateSelected,
      bringFront,
      sendBack,
      nudge,
    }),
    [
      addObject,
      deleteSelected,
      copySelected,
      pasteClipboard,
      duplicateSelected,
      bringFront,
      sendBack,
      nudge,
    ]
  );

  const startInteract = (e, objId, mode, handle = '') => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget?.setPointerCapture?.(e.pointerId);
    const a = latestRef.current;
    const obj = (a.objects || []).find((o) => o.id === objId);
    if (!obj || obj.visible === false) return;
    // Layer isolation: block interaction with objects not on the active layer
    const objLayer = obj.layerId || 'base';
    const curLayer = a.activeLayerId || 'base';
    if (objLayer !== curLayer) return;

    // Update selection
    const currentIds = latestSelectedIdsRef.current;
    const forceSingleObjectEdit = e.altKey || e.ctrlKey || e.metaKey;
    const linkedSelectionIds = (
      forceSingleObjectEdit ? [objId] : [...getEditorLinkedSelectionIds(a, objId)]
    ).filter((id) => {
      const item = (a.objects || []).find((candidate) => candidate.id === id);
      return item?.visible !== false && (item?.layerId || 'base') === curLayer;
    });
    const primaryObjectId = forceSingleObjectEdit
      ? objId
      : getEditorPrimaryObjectId(a, objId) || objId;
    const wasAlreadySelected = linkedSelectionIds.every((id) => currentIds.has(id));
    let newIds;
    if (e.shiftKey) {
      newIds = new Set(currentIds);
      if (wasAlreadySelected) linkedSelectionIds.forEach((id) => newIds.delete(id));
      else linkedSelectionIds.forEach((id) => newIds.add(id));
    } else {
      // Keep existing multi-selection if clicking an already-selected object (supports group drag)
      // Will be reduced to single on pointerup if no drag movement occurred
      newIds =
        wasAlreadySelected && currentIds.size > 1
          ? currentIds
          : new Set(linkedSelectionIds.length > 1 ? linkedSelectionIds : [objId]);
    }
    onSelectionChange(newIds);
    // selectedObjectId: the primary object for inspector (must be in selection)
    onUpdate({
      ...a,
      selectedObjectId: newIds.has(primaryObjectId) ? primaryObjectId : [...newIds][0] || null,
    });
    const isEditableAnswerPlacement = obj.generatedBy === 'answer-placement';
    if (obj.locked && !isEditableAnswerPlacement) return;

    const origin = toStage(e.clientX, e.clientY);
    let hasMoved = false;
    const isShift = e.shiftKey;
    // Flag: we deferred single-selection reduce until pointerup (no drag)
    const deferredSingleSelect =
      !forceSingleObjectEdit && !isShift && wasAlreadySelected && currentIds.size > 1;

    // Snapshot selected objects' initial positions for drag
    const snapIds = newIds.has(objId) ? newIds : new Set([objId]);
    dragSnapshotRef.current = Object.fromEntries(
      (a.objects || [])
        .filter((o) => snapIds.has(o.id) && (!o.locked || o.generatedBy === 'answer-placement'))
        .map((o) => [o.id, { x: o.x, y: o.y, width: o.width, height: o.height }])
    );

    const onMove = (me) => {
      const pt = toStage(me.clientX, me.clientY);
      const dx = pt.x - origin.x,
        dy = pt.y - origin.y;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) hasMoved = true;
      const curr = latestRef.current;
      const sw = curr.stageWidth || 1920,
        sh = curr.stageHeight || 1080;
      const MIN = 30;

      if (mode === 'move') {
        const snap = dragSnapshotRef.current || {};
        const updatedObjects = (curr.objects || []).map((o) => {
          if (!snap[o.id]) return o;
          const s = snap[o.id];
          const moved = {
            ...o,
            x: Math.min(Math.max(s.x + dx, 0), Math.max(0, sw - o.width)),
            y: Math.min(Math.max(s.y + dy, 0), Math.max(0, sh - o.height)),
          };
          return o.generatedBy === 'answer-placement'
            ? { ...moved, answerPlacementManual: true, disableDrag: false, locked: false }
            : moved;
        });
        onUpdate({ ...curr, objects: updatedObjects });
      } else {
        const s = dragSnapshotRef.current?.[objId] || obj;
        const r = s.x + s.width,
          b = s.y + s.height;
        let next = { x: s.x, y: s.y, width: s.width, height: s.height };
        if (handle.includes('e')) next.width = Math.max(MIN, s.width + dx);
        if (handle.includes('s')) next.height = Math.max(MIN, s.height + dy);
        if (handle.includes('w')) {
          next.x = Math.max(0, Math.min(s.x + dx, r - MIN));
          next.width = Math.max(MIN, r - next.x);
        }
        if (handle.includes('n')) {
          next.y = Math.max(0, Math.min(s.y + dy, b - MIN));
          next.height = Math.max(MIN, b - next.y);
        }
        patchObj(
          objId,
          obj.generatedBy === 'answer-placement'
            ? { ...next, answerPlacementManual: true, disableDrag: false, locked: false }
            : next
        );
      }
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      interactRef.current = null;
      dragSnapshotRef.current = null;
      // Plain click (no drag) on a multi-selected object → reduce to single selection
      if (!hasMoved && deferredSingleSelect) {
        const singleSet = getEditorLinkedSelectionIds(latestRef.current, objId);
        const singlePrimaryId = getEditorPrimaryObjectId(latestRef.current, objId) || objId;
        onSelectionChange(singleSet);
        onUpdate({ ...latestRef.current, selectedObjectId: singlePrimaryId });
      }
    };
    interactRef.current = onUp;
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // Rubber-band selection
  const startRubber = (e) => {
    if (e.target !== stageRef.current) return;
    e.preventDefault();
    e.currentTarget?.setPointerCapture?.(e.pointerId);
    const r = stageRef.current.getBoundingClientRect();
    const x0 = e.clientX - r.left,
      y0 = e.clientY - r.top;
    const isShift = e.shiftKey;
    // Snapshot pre-existing selection for shift+rubber-band additive mode
    const prevIds = new Set(latestSelectedIdsRef.current);
    rubberStartRef.current = { x0, y0, r };

    if (!isShift) {
      onSelectionChange(new Set());
      patchAct({ selectedObjectId: null });
    }

    const onMove = (me) => {
      if (!rubberStartRef.current) return;
      const x1 = me.clientX - rubberStartRef.current.r.left;
      const y1 = me.clientY - rubberStartRef.current.r.top;
      setRubberBand({ x0: rubberStartRef.current.x0, y0: rubberStartRef.current.y0, x1, y1 });
    };
    const onUp = (me) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      rubberHandlersRef.current = null;
      if (!rubberStartRef.current) return;
      const rc = rubberStartRef.current.r;
      const sc = zoomRef.current === 'fit' ? baseScale : Number(zoomRef.current) || baseScale;
      const rx0 = rubberStartRef.current.x0 / sc,
        ry0 = rubberStartRef.current.y0 / sc;
      const rx1 = (me.clientX - rc.left) / sc,
        ry1 = (me.clientY - rc.top) / sc;
      const minX = Math.min(rx0, rx1),
        maxX = Math.max(rx0, rx1);
      const minY = Math.min(ry0, ry1),
        maxY = Math.max(ry0, ry1);
      const dist = Math.sqrt(
        Math.pow(me.clientX - rc.left - rubberStartRef.current.x0, 2) +
          Math.pow(me.clientY - rc.top - rubberStartRef.current.y0, 2)
      );
      if (dist > 5) {
        const bandHits = new Set(
          getCanvasObjects(latestRef.current)
            .filter(
              (o) =>
                o.visible !== false &&
                o.x < maxX &&
                o.x + o.width > minX &&
                o.y < maxY &&
                o.y + o.height > minY
            )
            .map((o) => o.id)
        );
        // Shift: merge with previous; normal: replace
        const selected = isShift ? new Set([...prevIds, ...bandHits]) : bandHits;
        const expandedSelection = new Set();
        selected.forEach((id) => {
          getEditorLinkedSelectionIds(latestRef.current, id).forEach((linkedId) =>
            expandedSelection.add(linkedId)
          );
        });
        const canonicalSelectedIds = new Set(
          [...expandedSelection]
            .map((id) => getEditorPrimaryObjectId(latestRef.current, id))
            .filter(Boolean)
        );
        onSelectionChange(expandedSelection);
        if (canonicalSelectedIds.size === 1)
          onUpdate({ ...latestRef.current, selectedObjectId: [...canonicalSelectedIds][0] });
        else if (canonicalSelectedIds.size > 1)
          onUpdate({ ...latestRef.current, selectedObjectId: null });
      }
      rubberStartRef.current = null;
      setRubberBand(null);
    };
    rubberHandlersRef.current = { move: onMove, up: onUp };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const addImage = (e) => {
    addImageFile(e.target.files[0]);
    e.target.value = '';
  };
  const addVideo = (e) => {
    addVideoFile(e.target.files[0]);
    e.target.value = '';
  };
  const addAudio = (e) => {
    addAudioFile(e.target.files[0]);
    e.target.value = '';
  };
  const loadSVG = (e) => {
    loadSvgFile(e.target.files[0]);
    e.target.value = '';
  };
  const zoomStep = useCallback(
    (delta) => {
      if (!onZoomChange) return;
      onZoomChange((current) => {
        const currentScale = current === 'fit' ? baseScale : Number(current) || baseScale;
        return clamp(Number((currentScale + delta).toFixed(2)), 0.1, 4);
      });
    },
    [baseScale, onZoomChange]
  );
  const fitZoom = useCallback(() => {
    if (!onZoomChange) return;
    onZoomChange('fit');
  }, [onZoomChange]);
  const actualZoom = useCallback(() => {
    if (!onZoomChange) return;
    onZoomChange(1);
  }, [onZoomChange]);
  const renderShapeContent = (o, st, scaleValue) => {
    const kind = o.shapeKind || 'roundedRect';
    const fill = st.background || '#0ea5e9';
    const stroke = st.borderColor || '#0284c7';
    const strokeWidth = Math.max(
      1,
      Number(
        st.borderWidth ??
          (kind.startsWith('line') || kind.includes('arrow') || kind === 'curve' ? 7 : 4)
      ) || 1
    );
    const strokeLinejoin = st.strokeLinejoin || 'round';
    const strokeLinecap = st.strokeLinecap || 'round';
    const minShapeSide = Math.max(1, Math.min(Number(o.width) || 1, Number(o.height) || 1));
    const cornerRadius = Math.max(
      0,
      Math.min(34, ((Number(st.borderRadius || 0) || 0) / minShapeSide) * 100)
    );
    const vectorPath =
      kind === 'customPath'
        ? buildVectorPathFromPoints(getObjectVectorPoints(o), true)
        : o.vectorPath || '';
    const showLabel =
      o.showShapeLabel !== false &&
      !kind.startsWith('line') &&
      !kind.includes('arrow') &&
      kind !== 'curve';
    return (
      <>
        <ShapePreviewIcon
          kind={kind}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinejoin={strokeLinejoin}
          strokeLinecap={strokeLinecap}
          cornerRadius={cornerRadius}
          nonScalingStroke
          fullBleed
          vectorPath={vectorPath}
        />
        {showLabel && (
          <span
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              padding: '0 8px',
              textAlign: 'center',
              color: st.color || '#ffffff',
              fontSize: (st.fontSize || 13) * scaleValue,
              fontWeight: 700,
            }}
          >
            {o.label}
          </span>
        )}
      </>
    );
  };
  return (
    <div
      ref={viewportRef}
      data-stage-zoom-scope="true"
      style={{
        flex: 1,
        overflow: 'auto',
        background: 'linear-gradient(180deg,#dbe5f0,#cfd9e6)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: 14,
      }}
    >
      <div style={{ position: 'relative' }}>
        <div
          style={{
            position: 'sticky',
            top: 12,
            zIndex: 20,
            display: 'flex',
            justifyContent: 'flex-end',
            pointerEvents: 'none',
            marginBottom: 10,
          }}
        >
          <div
            style={{
              pointerEvents: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 10px',
              borderRadius: 14,
              border: '1px solid rgba(148,163,184,.45)',
              background: 'rgba(255,255,255,.92)',
              boxShadow: '0 14px 30px rgba(15,23,42,.12)',
              backdropFilter: 'blur(10px)',
            }}
          >
            <button
              onClick={() => zoomStep(-0.1)}
              style={{
                width: 28,
                height: 28,
                borderRadius: 999,
                border: '1px solid rgba(148,163,184,.45)',
                background: '#0f172a',
                color: '#e2e8f0',
                cursor: 'pointer',
                fontSize: 16,
                lineHeight: 1,
              }}
            >
              -
            </button>
            <button
              onClick={fitZoom}
              style={{
                border: '1px solid rgba(148,163,184,.45)',
                background: '#ffffff',
                color: '#0f172a',
                borderRadius: 10,
                padding: '6px 10px',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 800,
                minWidth: 64,
              }}
            >
              {zoomPercent}%
            </button>
            <button
              onClick={() => zoomStep(0.1)}
              style={{
                width: 28,
                height: 28,
                borderRadius: 10,
                border: '1px solid rgba(148,163,184,.45)',
                background: '#ffffff',
                color: '#0f172a',
                cursor: 'pointer',
                fontSize: 16,
                lineHeight: 1,
              }}
            >
              +
            </button>
            <button
              onClick={fitZoom}
              style={{
                border: '1px solid rgba(148,163,184,.45)',
                background: '#ffffff',
                color: '#334155',
                borderRadius: 10,
                padding: '6px 10px',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 800,
              }}
            >
              Sığdır
            </button>
            <button
              onClick={actualZoom}
              style={{
                border: '1px solid rgba(148,163,184,.45)',
                background: '#ffffff',
                color: '#334155',
                borderRadius: 10,
                padding: '6px 10px',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 800,
              }}
            >
              1:1
            </button>
          </div>
        </div>
        <div
          style={{
            fontSize: 11,
            color: '#52667a',
            marginBottom: 6,
            textAlign: 'right',
            fontWeight: 700,
          }}
        >
          {activity.stageWidth} x {activity.stageHeight} | x{scale.toFixed(2)}
        </div>
        <div
          ref={stageRef}
          onPointerDown={startRubber}
          style={{
            width: vw,
            height: vh,
            position: 'relative',
            background: activity.backgroundColor || '#fff',
            border: '1px solid rgba(148,163,184,.45)',
            borderRadius: 18,
            overflow: 'hidden',
            cursor: 'crosshair',
            boxShadow: '0 24px 50px rgba(15,23,42,.16)',
            touchAction: 'none',
          }}
        >
          {pdfBackgroundObject && (
            <img
              src={pdfBackgroundObject.imageData}
              alt={pdfBackgroundObject.label || 'PDF Zemin'}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                pointerEvents: 'none',
                userSelect: 'none',
                zIndex: 0,
              }}
            />
          )}
          {/* Izgara */}
          {activity.viewOptions?.showGrid !== false && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage:
                  'linear-gradient(rgba(15,23,42,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(15,23,42,.035) 1px,transparent 1px)',
                backgroundSize: `${40 * scale}px ${40 * scale}px`,
                pointerEvents: 'none',
                opacity: 0.65,
              }}
            />
          )}
          {activity.viewOptions?.showGuides && (
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 3 }}>
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: 0,
                  bottom: 0,
                  borderLeft: '1px dashed rgba(37,99,235,.55)',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: 0,
                  right: 0,
                  borderTop: '1px dashed rgba(37,99,235,.55)',
                }}
              />
            </div>
          )}
          {/* SVG zemin */}
          {activity.svgMarkup && (
            <div
              style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
              dangerouslySetInnerHTML={{ __html: sanitizeSvgMarkup(activity.svgMarkup) }}
            />
          )}
          {overlayLayerActive && showBaseLayer && !hasExplicitLayerBackdrop && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: Math.max(
                  99999000,
                  renderObjects.reduce(
                    (max, item) =>
                      (item?.layerId || 'base') === 'base'
                        ? Math.max(max, Number(item.zIndex) || 0)
                        : max,
                    0
                  ) + 99999
                ),
                pointerEvents: 'none',
                background: 'rgba(15,23,42,.07)',
                backdropFilter: 'none',
              }}
            />
          )}
          {!hasSvg && !hasObjects && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 24,
                zIndex: 2,
                background: 'rgba(255,255,255,.92)',
              }}
            >
              <div
                style={{
                  width: Math.min(vw - 40, 520),
                  maxWidth: '100%',
                  borderRadius: 18,
                  border: '1px solid rgba(148,163,184,.35)',
                  background: 'rgba(255,255,255,.98)',
                  boxShadow: '0 24px 50px rgba(15,23,42,.16)',
                  padding: 24,
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: '#2563eb',
                    letterSpacing: 0.4,
                    textTransform: 'uppercase',
                    marginBottom: 10,
                  }}
                >
                  SVG-first başlangıç
                </div>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 800,
                    color: '#0f172a',
                    lineHeight: 1.2,
                    marginBottom: 10,
                  }}
                >
                  Önce SVG zemin yükle
                </div>
                <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.7, marginBottom: 18 }}>
                  Bu editörde en rahat akış, önce zemini yükleyip sonra buton, hotspot, video ve
                  metinleri onun üstüne yerleştirmektir.
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3,minmax(0,1fr))',
                    gap: 8,
                    marginBottom: 18,
                    textAlign: 'left',
                  }}
                >
                  <div
                    style={{
                      borderRadius: 12,
                      background: 'linear-gradient(180deg,#ffffff,#f8fbff)',
                      border: '1px solid rgba(148,163,184,.25)',
                      padding: 10,
                      fontSize: 11,
                      color: '#0f172a',
                    }}
                  >
                    <strong>1.</strong> SVG zemin yükle
                  </div>
                  <div
                    style={{
                      borderRadius: 12,
                      background: 'linear-gradient(180deg,#ffffff,#f8fbff)',
                      border: '1px solid rgba(148,163,184,.25)',
                      padding: 10,
                      fontSize: 11,
                      color: '#0f172a',
                    }}
                  >
                    <strong>2.</strong> Nesneleri yerleştir
                  </div>
                  <div
                    style={{
                      borderRadius: 12,
                      background: 'linear-gradient(180deg,#ffffff,#f8fbff)',
                      border: '1px solid rgba(148,163,184,.25)',
                      padding: 10,
                      fontSize: 11,
                      color: '#0f172a',
                    }}
                  >
                    <strong>3.</strong> Timeline ve trigger ver
                  </div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    flexWrap: 'wrap',
                  }}
                >
                  <button
                    onClick={() => fileRef.current?.click()}
                    style={{
                      border: 'none',
                      background: 'linear-gradient(135deg,#0f172a,#1e293b)',
                      color: '#ffffff',
                      borderRadius: 12,
                      padding: '10px 18px',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 800,
                      boxShadow: '0 12px 24px rgba(15,23,42,.16)',
                    }}
                  >
                    SVG Zemin Yükle
                  </button>
                  <button
                    onClick={() => imgRef.current?.click()}
                    style={{
                      border: '1px solid rgba(148,163,184,.45)',
                      background: '#ffffff',
                      color: '#0f172a',
                      borderRadius: 12,
                      padding: '10px 16px',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    Resim ile Başla
                  </button>
                </div>
                {!hasObjects && (
                  <div style={{ marginTop: 12, fontSize: 11, color: '#64748b' }}>
                    SVG olmadan da devam edebilirsin ama sistemin ana akışı zemin üstünden ilerler.
                  </div>
                )}
              </div>
            </div>
          )}
          {/* Rubber-band seçim dikdörtgeni */}
          {rubberBand &&
            (() => {
              const { x0, y0, x1, y1 } = rubberBand;
              return (
                <div
                  style={{
                    position: 'absolute',
                    left: Math.min(x0, x1),
                    top: Math.min(y0, y1),
                    width: Math.abs(x1 - x0),
                    height: Math.abs(y1 - y0),
                    border: '1px dashed #111111',
                    background: 'rgba(17,17,17,.08)',
                    pointerEvents: 'none',
                    zIndex: 9999,
                  }}
                />
              );
            })()}
          {/* Nesneler */}
          {[...renderObjects]
            .filter((o) => o.visible !== false)
            .filter((o) => {
              const oL = o.layerId || 'base';
              const cL = activity.activeLayerId || 'base';
              if (oL === 'base' && cL !== 'base' && !showBaseLayer) return false;
              return true;
            })
            .sort((a, b) => a.zIndex - b.zIndex)
            .map((o) => {
              const objLayer = o.layerId || 'base';
              const curLayer = activity.activeLayerId || 'base';
              const isOtherLayerObj = objLayer !== curLayer;
              const isSel =
                !isOtherLayerObj && (selectedIds.has(o.id) || activity.selectedObjectId === o.id);
              const isEditorLocked = o.locked && o.generatedBy !== 'answer-placement';
              const st =
                o.type === 'draggable' || o.type === 'dropzone'
                  ? upgradeDragDropStyle(o.type, o.style || {})
                  : o.style || {};
              const shapeKind = o.type === 'shape' ? o.shapeKind || 'roundedRect' : '';
              const shapeBackground = String(st.background || '');
              const canRenderShapeAsCssBox =
                o.type === 'shape' &&
                ['rect', 'roundedRect', 'ellipse'].includes(shapeKind) &&
                /gradient|url\(/i.test(shapeBackground);
              const usesShapeSvg = o.type === 'shape' && !!shapeKind && !canRenderShapeAsCssBox;
              const selectionColor = '#0ea5e9';
              const vectorPoints =
                o.type === 'shape' && shapeKind === 'customPath' ? getObjectVectorPoints(o) : [];
              const isTimelineActive = isObjectTimelineActive(activity, o.id, timelineTime);
              const isSceneTemplateObject = isGeneratedSceneTemplateObject(o);
              const motionStyle = getTimelineMotionStyle(activity, o.id, timelineTime, {
                suppressBoundaryEffects: timelineTime <= 0.01,
              });
              const inactiveOpacity = isSceneTemplateObject
                ? 1
                : o.type === 'draggable' || o.type === 'dropzone'
                  ? 0.72
                  : 0.18;
              const maxBaseLayerZ = overlayLayerActive
                ? renderObjects.reduce(
                    (max, item) =>
                      (item?.layerId || 'base') === 'base'
                        ? Math.max(max, Number(item.zIndex) || 0)
                        : max,
                    0
                  )
                : 0;
              const layerBoost =
                overlayLayerActive && objLayer === curLayer
                  ? Math.max(100000000, maxBaseLayerZ + 100000)
                  : 0;
              return (
                <div
                  key={o.id}
                  onPointerDown={
                    isOtherLayerObj ? undefined : (e) => startInteract(e, o.id, 'move')
                  }
                  style={{
                    position: 'absolute',
                    left: o.x * scale,
                    top: o.y * scale,
                    width: o.width * scale,
                    height: o.height * scale,
                    transform: `translate(${motionStyle.translateX * scale}px, ${motionStyle.translateY * scale}px) rotate(${o.rotation || 0}deg) scale(${motionStyle.scale})`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: isOtherLayerObj ? 'default' : isEditorLocked ? 'pointer' : 'move',
                    userSelect: 'none',
                    zIndex: layerBoost + Math.max(1, Number(o.zIndex) || 1),
                    pointerEvents: isOtherLayerObj ? 'none' : 'auto',
                    background:
                      o.imageData || usesShapeSvg ? 'transparent' : st.background || 'transparent',
                    border: usesShapeSvg
                      ? 'none'
                      : `${isSel ? Math.max(2, Number(st.borderWidth || 1)) : Math.max(1, Number(st.borderWidth || 1))}px ${st.borderStyle || 'solid'} ${isSel ? selectionColor : st.borderColor || 'transparent'}`,
                    borderRadius: usesShapeSvg
                      ? 0
                      : shapeKind === 'ellipse'
                        ? 999
                        : (st.borderRadius || 0) * scale,
                    outline: isSel ? `2px solid ${selectionColor}` : 'none',
                    outlineOffset: usesShapeSvg ? 2 : 0,
                    boxSizing: 'border-box',
                    fontSize: (st.fontSize || 13) * scale,
                    color: st.color || '#111',
                    fontWeight: 600,
                    overflow: usesShapeSvg ? 'visible' : 'hidden',
                    textShadow: st.textShadow || 'none',
                    textDecoration: st.textDecoration || 'none',
                    opacity: isOtherLayerObj
                      ? 1
                      : isTimelineActive
                        ? motionStyle.opacity
                        : inactiveOpacity,
                    filter:
                      isOtherLayerObj || isSceneTemplateObject
                        ? 'none'
                        : isTimelineActive
                          ? 'none'
                          : o.type === 'draggable' || o.type === 'dropzone'
                            ? 'none'
                            : 'grayscale(.5)',
                    touchAction: 'none',
                    boxShadow: st.boxShadow || 'none',
                  }}
                >
                  {o.selectionQuestionId ? (
                    <span
                      style={{
                        pointerEvents: 'none',
                        fontWeight: 900,
                        fontSize: Math.max(18, (st.fontSize || 13) * scale),
                        color: 'rgba(37,99,235,.18)',
                      }}
                    >
                      {' '}
                    </span>
                  ) : o.type === 'video' && o.mediaUrl ? (
                    <video
                      src={o.mediaUrl}
                      muted
                      loop={!!o.loop}
                      autoPlay={!!o.autoPlay}
                      playsInline
                      preload="metadata"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        pointerEvents: 'none',
                        background: '#020617',
                      }}
                    />
                  ) : o.type === 'audio' && o.mediaUrl ? (
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '0 12px',
                        background: 'linear-gradient(135deg,#f8fbff,#e0f2fe)',
                        color: '#0f172a',
                        border: '1px solid rgba(14,165,233,.35)',
                      }}
                    >
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 999,
                          background: 'rgba(14,165,233,.14)',
                          border: '1px solid rgba(14,165,233,.42)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 16,
                          flexShrink: 0,
                        }}
                      >
                        🔊
                      </div>
                      <div style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                        <div
                          style={{
                            fontSize: Math.max(10, 12 * scale),
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {o.label || 'Ses'}
                        </div>
                        <div
                          style={{
                            fontSize: Math.max(9, 10 * scale),
                            color: '#0284c7',
                            opacity: 0.92,
                          }}
                        >
                          Sahne dışı ses
                        </div>
                      </div>
                    </div>
                  ) : o.type === 'shape' ? (
                    usesShapeSvg ? (
                      renderShapeContent(o, st, scale)
                    ) : o.showShapeLabel !== false && o.label ? (
                      <span
                        style={{ pointerEvents: 'none', padding: '0 6px', textAlign: 'center' }}
                      >
                        {o.label}
                      </span>
                    ) : null
                  ) : o.imageData ? (
                    <img
                      src={o.imageData}
                      alt={o.label}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        pointerEvents: 'none',
                      }}
                    />
                  ) : (
                    <span
                      style={{
                        pointerEvents: 'none',
                        padding: '0 6px',
                        textAlign: 'center',
                      }}
                    >
                      {o.label}
                    </span>
                  )}
                  {isSel &&
                    !isEditorLocked &&
                    HANDLE_DIRS.map((dir) => {
                      const p = HANDLE_POS[dir];
                      return (
                        <div
                          key={dir}
                          onPointerDown={(e) => startInteract(e, o.id, 'resize', dir)}
                          style={{
                            position: 'absolute',
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            background: '#ffffff',
                            border: '2px solid #111111',
                            cursor: HANDLE_CURSOR[dir],
                            zIndex: 10,
                            touchAction: 'none',
                            ...Object.fromEntries(
                              Object.entries(p).filter(([k]) => !['ml', 'mt'].includes(k))
                            ),
                            ...(p.ml ? { marginLeft: p.ml } : {}),
                            ...(p.mt ? { marginTop: p.mt } : {}),
                          }}
                        />
                      );
                    })}
                  {isSel && activity.selectedObjectId === o.id && (
                    <div
                      style={{
                        position: 'absolute',
                        top: -20,
                        left: 0,
                        background: '#ffffff',
                        color: '#111111',
                        fontSize: 11,
                        padding: '2px 6px',
                        borderRadius: 0,
                        border: '1px solid #111111',
                        whiteSpace: 'nowrap',
                        pointerEvents: 'none',
                      }}
                    >
                      {isEditorLocked ? 'Kilitli · ' : ''}
                      {Math.round(o.x)},{Math.round(o.y)} · {Math.round(o.width)}×
                      {Math.round(o.height)}
                    </div>
                  )}
                  {isSel && shapeKind === 'customPath' && !isEditorLocked && (
                    <>
                      <div
                        style={{
                          position: 'absolute',
                          right: 0,
                          top: -22,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <button
                          onPointerDown={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            const nextPoint = vectorPoints.length
                              ? {
                                  x: Number(
                                    (
                                      (vectorPoints[vectorPoints.length - 1].x +
                                        vectorPoints[0].x) /
                                      2
                                    ).toFixed(2)
                                  ),
                                  y: Number(
                                    (
                                      (vectorPoints[vectorPoints.length - 1].y +
                                        vectorPoints[0].y) /
                                      2
                                    ).toFixed(2)
                                  ),
                                  mode: 'line',
                                }
                              : { x: 50, y: 50, mode: 'line' };
                            const nextPoints = [...vectorPoints, nextPoint];
                            applyVectorPoints(o.id, nextPoints);
                            setSelectedVectorAnchor({
                              objectId: o.id,
                              indices: [nextPoints.length - 1],
                            });
                          }}
                          title="Nokta ekle"
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: 999,
                            border: '1px solid #111111',
                            background: '#ffffff',
                            color: '#111111',
                            cursor: 'pointer',
                            fontSize: 12,
                            fontWeight: 900,
                            lineHeight: 1,
                            padding: 0,
                          }}
                        >
                          +
                        </button>
                        <button
                          onPointerDown={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            if (vectorPoints.length <= 2) return;
                            const selectedIndices =
                              selectedVectorAnchor.objectId === o.id
                                ? selectedVectorAnchor.indices
                                : [];
                            const targetIndices = selectedIndices.length
                              ? selectedIndices
                              : [vectorPoints.length - 1];
                            if (vectorPoints.length - targetIndices.length < 2) return;
                            const nextPoints = vectorPoints.filter(
                              (_, pointIndex) => !targetIndices.includes(pointIndex)
                            );
                            applyVectorPoints(o.id, nextPoints);
                            setSelectedVectorAnchor({ objectId: o.id, indices: [] });
                          }}
                          title="Seçili noktayı sil"
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: 999,
                            border: '1px solid #ef4444',
                            background: '#ffffff',
                            color: '#ef4444',
                            cursor: vectorPoints.length <= 2 ? 'not-allowed' : 'pointer',
                            fontSize: 14,
                            fontWeight: 900,
                            lineHeight: 1,
                            padding: 0,
                            opacity: vectorPoints.length <= 2 ? 0.45 : 1,
                          }}
                        >
                          -
                        </button>
                        <button
                          onPointerDown={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            const selectedIndices =
                              selectedVectorAnchor.objectId === o.id
                                ? selectedVectorAnchor.indices
                                : [];
                            const targetIndices = selectedIndices.length
                              ? selectedIndices
                              : [vectorPoints.length - 1];
                            const nextPoints = vectorPoints.map((entry, pointIndex) => {
                              if (!targetIndices.includes(pointIndex)) return entry;
                              const normalized = normalizeVectorPoint(entry);
                              const nextMode = normalized.mode === 'curve' ? 'line' : 'curve';
                              if (nextMode === 'line') {
                                return { ...normalized, mode: 'line', cpIn: null, cpOut: null };
                              }
                              return {
                                ...normalized,
                                mode: 'curve',
                                cpIn: normalized.cpIn || {
                                  x: clamp(normalized.x - 8, 0, 100),
                                  y: normalized.y,
                                },
                                cpOut: normalized.cpOut || {
                                  x: clamp(normalized.x + 8, 0, 100),
                                  y: normalized.y,
                                },
                              };
                            });
                            applyVectorPoints(o.id, nextPoints);
                          }}
                          title="Bezier modu"
                          style={{
                            minWidth: 38,
                            height: 20,
                            borderRadius: 999,
                            border: '1px solid #1d4ed8',
                            background: '#eff6ff',
                            color: '#1d4ed8',
                            cursor: 'pointer',
                            fontSize: 10,
                            fontWeight: 900,
                            lineHeight: 1,
                            padding: '0 7px',
                          }}
                        >
                          C
                        </button>
                        {[
                          { label: 'L', mode: 'left' },
                          { label: 'CX', mode: 'center' },
                          { label: 'R', mode: 'right' },
                          { label: 'T', mode: 'top' },
                          { label: 'CY', mode: 'middle' },
                          { label: 'B', mode: 'bottom' },
                        ].map((action) => (
                          <button
                            key={action.mode}
                            onPointerDown={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              const selectedIndices =
                                selectedVectorAnchor.objectId === o.id
                                  ? selectedVectorAnchor.indices
                                  : [];
                              if (selectedIndices.length < 2) return;
                              const nextPoints = alignVectorAnchors(
                                vectorPoints,
                                selectedIndices,
                                action.mode
                              );
                              applyVectorPoints(o.id, nextPoints);
                            }}
                            title={`Secili anchorlari ${action.label} hizala`}
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: 999,
                              border: '1px solid #94a3b8',
                              background: '#ffffff',
                              color: '#475569',
                              cursor: 'pointer',
                              fontSize: 10,
                              fontWeight: 900,
                              lineHeight: 1,
                              padding: 0,
                            }}
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                      {vectorPoints.map((point, pointIndex) => {
                        const midpoint = getSegmentMidPoint(vectorPoints, pointIndex, true);
                        if (!midpoint) return null;
                        return (
                          <button
                            key={`${o.id}-segment-${pointIndex}`}
                            onPointerDown={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              const insertIndex = pointIndex + 1;
                              const nextPoint = {
                                x: midpoint.x,
                                y: midpoint.y,
                                mode: 'line',
                              };
                              const nextPoints = [
                                ...vectorPoints.slice(0, insertIndex),
                                nextPoint,
                                ...vectorPoints.slice(insertIndex),
                              ];
                              applyVectorPoints(o.id, nextPoints);
                              setSelectedVectorAnchor({ objectId: o.id, indices: [insertIndex] });
                            }}
                            title="Segment ortasina nokta ekle"
                            style={{
                              position: 'absolute',
                              left: `${midpoint.x}%`,
                              top: `${midpoint.y}%`,
                              width: 10,
                              height: 10,
                              borderRadius: '50%',
                              transform: 'translate(-50%, -50%)',
                              border: '1px solid #0ea5e9',
                              background: '#e0f2fe',
                              cursor: 'copy',
                              zIndex: 13,
                              padding: 0,
                            }}
                          />
                        );
                      })}
                      {vectorPoints.map((point, pointIndex) => {
                        const selectedIndices =
                          selectedVectorAnchor.objectId === o.id
                            ? selectedVectorAnchor.indices
                            : [];
                        const isActiveAnchor = selectedIndices.includes(pointIndex);
                        return (
                          <div
                            key={`${o.id}-anchor-${pointIndex}`}
                            onPointerDown={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              event.currentTarget?.setPointerCapture?.(event.pointerId);
                              const currentIndices =
                                selectedVectorAnchor.objectId === o.id
                                  ? selectedVectorAnchor.indices
                                  : [];
                              if (event.shiftKey) {
                                const nextSet = new Set(currentIndices);
                                if (nextSet.has(pointIndex)) nextSet.delete(pointIndex);
                                else nextSet.add(pointIndex);
                                setSelectedVectorAnchor({
                                  objectId: o.id,
                                  indices: [...nextSet].sort((a, b) => a - b),
                                });
                                return;
                              }
                              const dragIndices =
                                currentIndices.includes(pointIndex) && currentIndices.length > 1
                                  ? currentIndices
                                  : [pointIndex];
                              setSelectedVectorAnchor({ objectId: o.id, indices: dragIndices });
                              const startPoints = vectorPoints.map((entry) =>
                                normalizeVectorPoint(entry)
                              );
                              const primary = startPoints[pointIndex];

                              const onMove = (moveEvent) => {
                                const stagePoint = toStage(moveEvent.clientX, moveEvent.clientY);
                                const relX = clamp(
                                  ((stagePoint.x - o.x) / Math.max(1, o.width)) * 100,
                                  0,
                                  100
                                );
                                const relY = clamp(
                                  ((stagePoint.y - o.y) / Math.max(1, o.height)) * 100,
                                  0,
                                  100
                                );
                                const dx = relX - primary.x;
                                const dy = relY - primary.y;
                                const nextPoints = startPoints.map((entry, idx) => {
                                  if (!dragIndices.includes(idx)) return entry;
                                  const shifted = shiftVectorPointControls(entry, dx, dy);
                                  return {
                                    ...shifted,
                                    x: clamp(Number((entry.x + dx).toFixed(2)), 0, 100),
                                    y: clamp(Number((entry.y + dy).toFixed(2)), 0, 100),
                                  };
                                });
                                applyVectorPoints(o.id, nextPoints);
                              };

                              const onUp = () => {
                                window.removeEventListener('pointermove', onMove);
                                window.removeEventListener('pointerup', onUp);
                                vectorEditRef.current = null;
                              };

                              vectorEditRef.current = { move: onMove, up: onUp };
                              window.addEventListener('pointermove', onMove);
                              window.addEventListener('pointerup', onUp);
                            }}
                            title={`Anchor ${pointIndex + 1}`}
                            style={{
                              position: 'absolute',
                              left: `${point.x}%`,
                              top: `${point.y}%`,
                              width: isActiveAnchor ? 14 : 12,
                              height: isActiveAnchor ? 14 : 12,
                              borderRadius: '50%',
                              transform: 'translate(-50%, -50%)',
                              border: isActiveAnchor ? '2px solid #1d4ed8' : '2px solid #111111',
                              background: isActiveAnchor ? '#dbeafe' : '#ffffff',
                              boxShadow: '0 0 0 2px rgba(255,255,255,.9)',
                              cursor: 'grab',
                              zIndex: 14,
                              touchAction: 'none',
                            }}
                          />
                        );
                      })}
                      {vectorPoints.map((point, pointIndex) => {
                        const normalizedPoint = normalizeVectorPoint(point);
                        if (normalizedPoint.mode !== 'curve') return null;
                        const controls = [
                          { key: 'cpIn', color: '#a855f7', value: normalizedPoint.cpIn },
                          { key: 'cpOut', color: '#0ea5e9', value: normalizedPoint.cpOut },
                        ].filter((item) => item.value);
                        if (!controls.length) return null;
                        return controls.map((control) => (
                          <div key={`${o.id}-${pointIndex}-${control.key}`}>
                            <div
                              style={{
                                position: 'absolute',
                                left: `${(normalizedPoint.x + control.value.x) / 2}%`,
                                top: `${(normalizedPoint.y + control.value.y) / 2}%`,
                                width: `${Math.max(8, Math.hypot(control.value.x - normalizedPoint.x, control.value.y - normalizedPoint.y) * 0.9)}%`,
                                height: 1,
                                transformOrigin: 'left center',
                                transform: `translate(-50%, -50%) rotate(${Math.atan2(control.value.y - normalizedPoint.y, control.value.x - normalizedPoint.x)}rad)`,
                                background: `${control.color}88`,
                                zIndex: 12,
                                pointerEvents: 'none',
                              }}
                            />
                            <div
                              onPointerDown={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                event.currentTarget?.setPointerCapture?.(event.pointerId);
                                const onMove = (moveEvent) => {
                                  const stagePoint = toStage(moveEvent.clientX, moveEvent.clientY);
                                  const relX = clamp(
                                    ((stagePoint.x - o.x) / Math.max(1, o.width)) * 100,
                                    0,
                                    100
                                  );
                                  const relY = clamp(
                                    ((stagePoint.y - o.y) / Math.max(1, o.height)) * 100,
                                    0,
                                    100
                                  );
                                  const nextPoints = vectorPoints.map((entry, idx) => {
                                    if (idx !== pointIndex) return entry;
                                    const normalized = normalizeVectorPoint(entry);
                                    return {
                                      ...normalized,
                                      mode: 'curve',
                                      [control.key]: {
                                        x: Number(relX.toFixed(2)),
                                        y: Number(relY.toFixed(2)),
                                      },
                                    };
                                  });
                                  applyVectorPoints(o.id, nextPoints);
                                };
                                const onUp = () => {
                                  window.removeEventListener('pointermove', onMove);
                                  window.removeEventListener('pointerup', onUp);
                                  vectorEditRef.current = null;
                                };
                                vectorEditRef.current = { move: onMove, up: onUp };
                                window.addEventListener('pointermove', onMove);
                                window.addEventListener('pointerup', onUp);
                              }}
                              style={{
                                position: 'absolute',
                                left: `${control.value.x}%`,
                                top: `${control.value.y}%`,
                                width: 10,
                                height: 10,
                                borderRadius: '50%',
                                transform: 'translate(-50%, -50%)',
                                border: `2px solid ${control.color}`,
                                background: '#ffffff',
                                cursor: 'grab',
                                zIndex: 15,
                                touchAction: 'none',
                              }}
                            />
                          </div>
                        ));
                      })}
                    </>
                  )}
                </div>
              );
            })}
        </div>

        {/* Hidden file inputs */}
        <input
          ref={imgRef}
          type="file"
          accept="image/*"
          onChange={addImage}
          style={{ display: 'none' }}
        />
        <input
          ref={videoRef}
          type="file"
          accept="video/mp4,video/webm,video/ogg"
          onChange={addVideo}
          style={{ display: 'none' }}
        />
        <input
          ref={audioRef}
          type="file"
          accept="audio/*"
          onChange={addAudio}
          style={{ display: 'none' }}
        />
        <input
          ref={fileRef}
          type="file"
          accept=".svg"
          onChange={loadSVG}
          style={{ display: 'none' }}
        />
      </div>
    </div>
  );
});

export default React.memo(StageCanvas);