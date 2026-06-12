import { useEffect, useMemo, useRef, useState } from 'react';

import { TIMELINE_DIRECTION_OPTIONS, TIMELINE_EASING_OPTIONS, TIMELINE_EFFECT_OPTIONS } from '../../constants';
import {
  TIMELINE_DEFAULT_DURATION,
  TIMELINE_MIN_CLIP_DURATION,
  alignTimelineItemToPlayhead,
  canEditTimelineItem,
  fitTimelineDuration,
  formatTimelineTime,
  getActivityTimeline,
  getTimelineAutoDuration,
  getTimelineDuration,
  getTimelineSnapValue,
  moveTimelineItemTrack,
  normalizeTimelineCuePoints,
  normalizeTimelineItem,
  resetTimelineDuration,
} from '../../logic/timeline';
import { clamp, uid } from '../../utils/editorHelpers';

import { getTimelineClipTone, timelineTokens } from './timelineTokens';
import { getTrackBadge } from './trackBadge';
import { reorderObjectsByTrack } from './trackOrder';

const OBJECT_TYPE_ICONS = {
  audio: '♪',
  button: 'B',
  draggable: 'D',
  dropzone: 'Z',
  hotspot: 'H',
  image: 'I',
  shape: 'S',
  text: 'T',
  video: 'V',
};

function layerNameFor(activity = {}, layerId = 'base') {
  const layer = (activity.layers || []).find((item) => item.id === layerId);
  if (layer?.name) return layer.name;
  return layerId === 'base' ? 'Temel Katman' : layerId;
}

function nextObjectsWithZIndex(objects = []) {
  return objects.map((object, index) => ({ ...object, zIndex: index + 1 }));
}

function patchTimelineDuration(activity = {}, timeline = []) {
  const autoDuration = getTimelineAutoDuration({ ...activity, timeline });
  const manualDuration = Number(activity.timelineDuration);
  return Math.max(autoDuration, Number.isFinite(manualDuration) ? manualDuration : 0);
}

export default function useTimelineController({
  activity,
  currentTime = 0,
  height = 230,
  isObjectTimelineActive = () => false,
  isPlaying = false,
  onCurrentTimeChange = () => {},
  onPlayingChange = () => {},
  onSelectObject = () => {},
  onSelectionChange,
  onUpdate = () => {},
  onVisualizationChange = () => {},
  selectedIds = new Set(),
  shouldObjectPersistAfterTimeline = () => true,
  visualization = true,
}) {
  const safeActivity = useMemo(() => activity || { objects: [], timeline: [] }, [activity]);
  const selectedIdSet = useMemo(
    () => (selectedIds instanceof Set ? selectedIds : new Set()),
    [selectedIds]
  );
  const objects = useMemo(
    () => (Array.isArray(safeActivity.objects) ? safeActivity.objects : []),
    [safeActivity.objects]
  );
  const timeline = useMemo(() => getActivityTimeline(safeActivity), [safeActivity]);
  const totalDuration = getTimelineDuration(safeActivity);
  const cuePoints = useMemo(
    () => normalizeTimelineCuePoints(safeActivity.timelineCuePoints, totalDuration),
    [safeActivity.timelineCuePoints, totalDuration]
  );

  const [zoom, setZoom] = useState(72);
  const [collapsed, setCollapsed] = useState(false);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [floating, setFloating] = useState(false);
  const [floatingBox, setFloatingBox] = useState({ width: 980, height: 300, x: 180, y: 180 });
  const [contextMenu, setContextMenu] = useState(null);
  const [lastSelectedObjectId, setLastSelectedObjectId] = useState('');
  // Satır sürükle-bırak (yeniden sıralama) oturumu: {sourceId, overId, placeAfter}
  const [trackDrag, setTrackDrag] = useState(null);
  const dragRef = useRef(null);
  const trackDragRef = useRef(null);

  useEffect(
    () => () => {
      if (!dragRef.current) return;
      window.removeEventListener('pointermove', dragRef.current.move);
      window.removeEventListener('pointerup', dragRef.current.up);
      dragRef.current = null;
    },
    []
  );

  useEffect(
    () => () => {
      if (!trackDragRef.current) return;
      window.removeEventListener('pointermove', trackDragRef.current.move);
      window.removeEventListener('pointerup', trackDragRef.current.up);
      trackDragRef.current = null;
    },
    []
  );

  const activeTimelineItem =
    timeline.find((item) => selectedIdSet.has(item.objectId) || safeActivity.selectedObjectId === item.objectId) ||
    timeline[0] ||
    null;
  const activeObject = activeTimelineItem
    ? objects.find((object) => object.id === activeTimelineItem.objectId) || null
    : null;
  const selectedTimelineItems = timeline.filter((item) => selectedIdSet.has(item.objectId));
  const editableActive = activeTimelineItem ? canEditTimelineItem(activeTimelineItem, objects) : false;
  const trackWidth = Math.max(timelineTokens.size.minTrack, Math.round(totalDuration * zoom) + 64);
  const zoomPercent = Math.round((zoom / 72) * 100);
  const currentTimeLabel = formatTimelineTime(currentTime);
  const durationLabel = formatTimelineTime(totalDuration);
  const liveCount = timeline.filter((item) => isObjectTimelineActive(safeActivity, item.objectId, currentTime)).length;

  const ticks = useMemo(() => {
    const step = zoom >= 92 ? 0.2 : zoom >= 56 ? 0.5 : 1;
    const majorEvery = zoom >= 56 ? 1 : 5;
    const totalTicks = Math.ceil(totalDuration / step) + 1;
    return Array.from({ length: totalTicks }, (_, index) => {
      const second = Number((index * step).toFixed(2));
      return {
        second,
        left: second * zoom,
        major: Math.abs(second % majorEvery) < 0.001,
      };
    });
  }, [totalDuration, zoom]);

  const activeLayerId = safeActivity.activeLayerId || 'base';
  const rows = useMemo(
    () =>
      timeline
        // Timeline'da yalnızca AKTİF katmandaki ögeleri göster (katmanlar arası karışma olmasın).
        .map((item) => ({
          item,
          object: objects.find((entry) => entry.id === item.objectId) || null,
        }))
        .filter(({ object }) => (object?.layerId || 'base') === activeLayerId)
        .map(({ item, object }, index) => {
          const selected =
            selectedIdSet.has(item.objectId) || safeActivity.selectedObjectId === item.objectId;
          const active = isObjectTimelineActive(safeActivity, item.objectId, currentTime);
          return {
            id: item.id,
            active,
            badge: getTrackBadge(object),
            clip: item,
            editable: canEditTimelineItem(item, objects),
            icon: OBJECT_TYPE_ICONS[object?.type] || '•',
            index,
            label: object?.label || object?.name || item.name || 'Klip',
            layerName: layerNameFor(safeActivity, object?.layerId || 'base'),
            locked: object?.locked === true,
            object,
            selected,
            tone: getTimelineClipTone(object?.type),
            visible: object?.visible !== false,
          };
        }),
    [activeLayerId, currentTime, isObjectTimelineActive, objects, safeActivity, selectedIdSet, timeline]
  );

  const patchActivity = (patch) => {
    if (!activity) return;
    onUpdate({ ...safeActivity, ...patch });
  };

  const patchTimeline = (nextTimeline) => {
    patchActivity({
      timeline: nextTimeline.map((item, index) => normalizeTimelineItem(item, index, objects)),
      timelineDuration: patchTimelineDuration(safeActivity, nextTimeline),
    });
  };

  const patchTimelineItem = (itemId, patch) => {
    const item = timeline.find((entry) => entry.id === itemId);
    if (!item || !canEditTimelineItem(item, objects)) return;
    patchTimeline(timeline.map((entry) => (entry.id === itemId ? { ...entry, ...patch } : entry)));
  };

  const patchObject = (objectId, patch) => {
    patchActivity({
      objects: objects.map((object) => (object.id === objectId ? { ...object, ...patch } : object)),
    });
  };

  const selectClip = (item, event) => {
    if (!item?.objectId) return;
    if ((event?.ctrlKey || event?.metaKey || event?.shiftKey) && onSelectionChange) {
      const next = new Set(selectedIdSet);
      if (event.shiftKey && lastSelectedObjectId) {
        const startIndex = rows.findIndex((row) => row.object?.id === lastSelectedObjectId);
        const endIndex = rows.findIndex((row) => row.object?.id === item.objectId);
        if (startIndex >= 0 && endIndex >= 0) {
          const [from, to] = [Math.min(startIndex, endIndex), Math.max(startIndex, endIndex)];
          rows.slice(from, to + 1).forEach((row) => row.object?.id && next.add(row.object.id));
        }
      } else if (next.has(item.objectId)) {
        next.delete(item.objectId);
      } else {
        next.add(item.objectId);
      }
      if (!next.size) next.add(item.objectId);
      onSelectionChange(next);
      patchActivity({ selectedObjectId: item.objectId });
    } else {
      onSelectObject(item.objectId);
    }
    setLastSelectedObjectId(item.objectId);
  };

  const scrubToTime = (time) => {
    if (!visualization) onVisualizationChange(true);
    onCurrentTimeChange(clamp(Number(time) || 0, 0, totalDuration));
  };

  const scrubFromPointer = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const raw = (event.clientX - rect.left) / zoom;
    scrubToTime(getTimelineSnapValue(raw, { cuePoints, duration: totalDuration, enabled: snapEnabled }));
  };

  const beginClipDrag = (event, item, mode) => {
    if (!item || !canEditTimelineItem(item, objects)) return;
    event.preventDefault();
    event.stopPropagation();
    selectClip(item, event);
    const selectedObjectIds =
      selectedIdSet.size > 1 && selectedIdSet.has(item.objectId)
        ? Array.from(selectedIdSet)
        : [item.objectId];
    const selectedItemIds = timeline
      .filter((entry) => selectedObjectIds.includes(entry.objectId))
      .map((entry) => entry.id);
    const session = {
      id: item.id,
      ids: selectedItemIds,
      mode,
      startX: event.clientX,
      start: Number(item.start || 0),
      duration: Number(item.duration || TIMELINE_MIN_CLIP_DURATION),
      starts: new Map(timeline.map((entry) => [entry.id, Number(entry.start || 0)])),
    };
    const move = (moveEvent) => {
      const delta = (moveEvent.clientX - session.startX) / zoom;
      patchTimeline(
        timeline.map((entry) => {
          if (!session.ids.includes(entry.id)) return entry;
          if (!canEditTimelineItem(entry, objects)) return entry;
          const baseStart = session.starts.get(entry.id) || 0;
          if (entry.id === session.id && session.mode === 'resize-start') {
            const rawStart = clamp(session.start + delta, 0, session.start + session.duration - TIMELINE_MIN_CLIP_DURATION);
            const start = getTimelineSnapValue(rawStart, { cuePoints, duration: totalDuration, enabled: snapEnabled });
            const duration = Math.max(TIMELINE_MIN_CLIP_DURATION, Number((session.duration - (start - session.start)).toFixed(2)));
            return { ...entry, start, duration };
          }
          if (entry.id === session.id && session.mode === 'resize-end') {
            const rawDuration = Math.max(TIMELINE_MIN_CLIP_DURATION, session.duration + delta);
            const end = getTimelineSnapValue(session.start + rawDuration, {
              cuePoints,
              duration: Math.max(totalDuration, session.start + rawDuration),
              enabled: snapEnabled,
            });
            return { ...entry, duration: Math.max(TIMELINE_MIN_CLIP_DURATION, Number((end - session.start).toFixed(2))) };
          }
          const start = getTimelineSnapValue(baseStart + delta, {
            cuePoints,
            duration: Math.max(totalDuration, baseStart + delta + (entry.duration || 0)),
            enabled: snapEnabled,
          });
          return { ...entry, start };
        })
      );
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      dragRef.current = null;
    };
    dragRef.current = { move, up };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const addCuePoint = () => {
    patchActivity({
      timelineCuePoints: normalizeTimelineCuePoints(
        [...cuePoints, { id: uid(), time: currentTime, label: '' }],
        totalDuration
      ),
    });
  };

  const patchCuePoint = (cueId, patch) => {
    patchActivity({
      timelineCuePoints: normalizeTimelineCuePoints(
        cuePoints.map((cue) => (cue.id === cueId ? { ...cue, ...patch } : cue)),
        totalDuration
      ),
    });
  };

  const deleteCuePoint = (cueId) => {
    patchActivity({ timelineCuePoints: cuePoints.filter((cue) => cue.id !== cueId) });
  };

  const beginCueDrag = (event, cue) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startTime = Number(cue.time) || 0;
    const move = (moveEvent) => {
      const raw = startTime + (moveEvent.clientX - startX) / zoom;
      patchCuePoint(cue.id, {
        time: getTimelineSnapValue(raw, {
          cuePoints: cuePoints.filter((item) => item.id !== cue.id),
          duration: totalDuration,
          enabled: snapEnabled,
        }),
      });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      dragRef.current = null;
    };
    dragRef.current = { move, up };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const goToPreviousMarker = () => {
    const previous = cuePoints.filter((cue) => cue.time < currentTime - 0.03).pop();
    scrubToTime(previous?.time ?? 0);
  };

  const goToNextMarker = () => {
    const next = cuePoints.find((cue) => cue.time > currentTime + 0.03);
    scrubToTime(next?.time ?? totalDuration);
  };

  const alignActiveClip = (mode) => {
    if (!activeTimelineItem) return;
    if (mode === 'playhead-to-start') {
      scrubToTime(activeTimelineItem.start || 0);
      return;
    }
    if (mode === 'playhead-to-end') {
      scrubToTime((activeTimelineItem.start || 0) + (activeTimelineItem.duration || 0));
      return;
    }
    patchTimeline(alignTimelineItemToPlayhead(timeline, activeTimelineItem.id, currentTime, mode));
  };

  const moveActiveTrack = (direction) => {
    if (!activeTimelineItem) return;
    const objectIndex = objects.findIndex((object) => object.id === activeTimelineItem.objectId);
    if (objectIndex < 0) return;
    const nextIndex = clamp(objectIndex + direction, 0, objects.length - 1);
    if (nextIndex === objectIndex) return;
    const nextObjects = [...objects];
    const [object] = nextObjects.splice(objectIndex, 1);
    nextObjects.splice(nextIndex, 0, object);
    patchActivity({
      objects: nextObjectsWithZIndex(nextObjects),
      timeline: moveTimelineItemTrack(timeline, activeTimelineItem.id, direction),
    });
  };

  // Satırı sürükle-bırak ile keyfi konuma taşı: objects dizisi yeniden dizilir,
  // zIndex diziliş sırasından yeniden yazılır (timeline sırası = z-sırası).
  const reorderTrack = (sourceObjectId, targetObjectId, placeAfter = false) => {
    const nextObjects = reorderObjectsByTrack(objects, sourceObjectId, targetObjectId, placeAfter);
    if (!nextObjects) return;
    const orderIndex = new Map(nextObjects.map((object, index) => [object.id, index]));
    patchActivity({
      objects: nextObjectsWithZIndex(nextObjects),
      timeline: [...timeline]
        .sort(
          (left, right) =>
            (orderIndex.get(left.objectId) ?? 0) - (orderIndex.get(right.objectId) ?? 0)
        )
        .map((entry, track) => ({ ...entry, track })),
    });
  };

  // Tutamaçtan başlayan satır sürüklemesi; bırakma hedefi elementFromPoint ile
  // [data-track-row] üzerinden bulunur (pointer capture hit-test'i etkilemez).
  const beginTrackReorder = (event, row) => {
    const sourceId = row?.object?.id;
    if (!sourceId || row.locked) return;
    event.preventDefault();
    event.stopPropagation();
    const move = (moveEvent) => {
      const hit = document
        .elementFromPoint(moveEvent.clientX, moveEvent.clientY)
        ?.closest?.('[data-track-row]');
      if (!hit) return;
      const overId = hit.getAttribute('data-track-row') || '';
      const rect = hit.getBoundingClientRect();
      const placeAfter = moveEvent.clientY > rect.top + rect.height / 2;
      if (trackDragRef.current) {
        trackDragRef.current.overId = overId;
        trackDragRef.current.placeAfter = placeAfter;
      }
      setTrackDrag({ sourceId, overId, placeAfter });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      const session = trackDragRef.current;
      trackDragRef.current = null;
      setTrackDrag(null);
      if (session?.overId && session.overId !== sourceId) {
        reorderTrack(sourceId, session.overId, session.placeAfter);
      }
    };
    trackDragRef.current = { move, up, overId: '', placeAfter: false };
    setTrackDrag({ sourceId, overId: '', placeAfter: false });
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const openContextMenu = (event, item) => {
    event.preventDefault();
    event.stopPropagation();
    selectClip(item, event);
    setContextMenu({ itemId: item.id, x: event.clientX, y: event.clientY });
  };

  const closeContextMenu = () => setContextMenu(null);

  const setManualDuration = (duration) => {
    patchActivity({
      timelineDuration: Math.max(getTimelineAutoDuration(safeActivity), Number(duration) || TIMELINE_DEFAULT_DURATION),
    });
  };

  const toggleVisualization = () => {
    if (visualization) {
      onPlayingChange(false);
    }
    onVisualizationChange(!visualization);
  };

  const beginFloatingDrag = (event) => {
    if (!floating) return;
    event.preventDefault();
    const start = { ...floatingBox, x0: event.clientX, y0: event.clientY };
    const move = (moveEvent) => {
      setFloatingBox((box) => ({
        ...box,
        x: Math.max(12, start.x + moveEvent.clientX - start.x0),
        y: Math.max(12, start.y + moveEvent.clientY - start.y0),
      }));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      dragRef.current = null;
    };
    dragRef.current = { move, up };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const beginFloatingResize = (event) => {
    event.preventDefault();
    const start = { ...floatingBox, x0: event.clientX, y0: event.clientY };
    const move = (moveEvent) => {
      setFloatingBox((box) => ({
        ...box,
        width: clamp(start.width + moveEvent.clientX - start.x0, 720, 1400),
        height: clamp(start.height + moveEvent.clientY - start.y0, 220, 520),
      }));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      dragRef.current = null;
    };
    dragRef.current = { move, up };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return {
    activeObject,
    activeTimelineItem,
    activity,
    alignActiveClip,
    beginClipDrag,
    beginCueDrag,
    beginFloatingDrag,
    beginFloatingResize,
    closeContextMenu,
    collapsed,
    contextMenu,
    cuePoints,
    currentTime,
    currentTimeLabel,
    deleteCuePoint,
    detailsOpen,
    durationLabel,
    editableActive,
    effects: TIMELINE_EFFECT_OPTIONS,
    easings: TIMELINE_EASING_OPTIONS,
    directions: TIMELINE_DIRECTION_OPTIONS,
    fitTimeline: () => patchActivity(fitTimelineDuration(safeActivity)),
    floating,
    floatingBox,
    goToNextMarker,
    goToPreviousMarker,
    height,
    isPlaying,
    liveCount,
    moveActiveTrack,
    reorderTrack,
    beginTrackReorder,
    trackDrag,
    objects,
    openContextMenu,
    patchCuePoint,
    patchObject,
    patchTimelineItem,
    resetTimeline: () => patchActivity(resetTimelineDuration(safeActivity)),
    rows,
    scrubFromPointer,
    scrubToTime,
    selectClip,
    selectedCount: selectedTimelineItems.length || (activeTimelineItem ? 1 : 0),
    selectedIdSet,
    setCollapsed,
    setDetailsOpen,
    setFloating,
    setManualDuration,
    setSnapEnabled,
    setVisualization: toggleVisualization,
    setZoom,
    shouldObjectPersistAfterTimeline,
    snapEnabled,
    timeline,
    timelineCount: timeline.length,
    timelineTokens,
    totalDuration,
    trackWidth,
    updatePlaying: onPlayingChange,
    visualization,
    zoom,
    zoomPercent,
    addCuePoint,
    ticks,
  };
}
