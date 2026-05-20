import { useMemo } from 'react';

import { getActivityLayers, getActivitySlides } from '../../logic/activityHelpers';
import { getEditorGroupedObjectEntries } from '../../logic/editorHelpers';
import { buildResolvedLayerNameMap } from '../../logic/factories';

const RIGHT_PANEL_BY_RIBBON = {
  home: 'home',
  insert: 'insert',
  scene: 'scene',
  design: 'design',
  transitions: 'transitions',
  animation: 'animation',
  view: 'view',
  publish: 'publish',
  help: 'help',
  'object-format': 'format',
};

export default function useWorkspaceChromeController({
  activity,
  currentBook,
  currentPublisher,
  onOpenAnswerCenter,
  onSelectActivity,
  onSelectionChange,
  onUpdateActivity,
  present,
  ribbonController,
  selectedIds,
  showToast,
}) {
  return useMemo(() => {
    const safeActivity = activity || null;
    const activities = Array.isArray(present?.activities) ? present.activities : [];
    const slides = safeActivity ? getActivitySlides(safeActivity) : [];
    const currentSlide =
      slides.find((slide) => slide.id === safeActivity?.currentSlideId) || slides[0] || null;
    const layers = safeActivity ? getActivityLayers(safeActivity) : [];
    const resolvedLayerNames = buildResolvedLayerNameMap(layers, safeActivity || {});
    const activeLayerId = safeActivity?.activeLayerId || 'base';
    const activeLayer = layers.find((layer) => layer.id === activeLayerId) || layers[0] || null;
    const objects = Array.isArray(safeActivity?.objects) ? safeActivity.objects : [];
    const selectedIdSet = selectedIds instanceof Set ? selectedIds : new Set();
    const selectedObject =
      objects.find((item) => item.id === safeActivity?.selectedObjectId) ||
      objects.find((item) => selectedIdSet.has(item.id)) ||
      null;
    const activeLayerObjects = objects.filter((item) => (item.layerId || 'base') === activeLayerId);
    const groupedActiveObjects = getEditorGroupedObjectEntries(safeActivity || {}, activeLayerObjects);
    const ribbonTab = ribbonController?.activeTab || 'home';

    return {
      activeLayer,
      activeLayerId,
      activeLayerName:
        resolvedLayerNames[activeLayerId] ||
        (activeLayer?.kind === 'base' ? 'Base Layer' : activeLayer?.name || 'Layer'),
      activePanel: RIGHT_PANEL_BY_RIBBON[ribbonTab] || 'home',
      activeRibbonTab: ribbonTab,
      activities,
      activity: safeActivity,
      commands: ribbonController?.commands || {},
      currentBook,
      currentPublisher,
      currentSlide,
      galleries: ribbonController?.galleries || {},
      groupedActiveObjects,
      layers,
      objects,
      onOpenAnswerCenter,
      onSelectActivity,
      onSelectionChange,
      onUpdateActivity,
      present,
      resolvedLayerNames,
      ribbonController,
      selectedIds: selectedIdSet,
      selectedObject,
      showToast,
      slides,
      view: ribbonController?.view || {},
      lms: ribbonController?.lms || {},
    };
  }, [
    activity,
    currentBook,
    currentPublisher,
    onOpenAnswerCenter,
    onSelectActivity,
    onSelectionChange,
    onUpdateActivity,
    present,
    ribbonController,
    selectedIds,
    showToast,
  ]);
}
