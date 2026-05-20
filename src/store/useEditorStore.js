import { create } from 'zustand';

// Basit UI state'leri — EIcerikEditor.jsx'teki useState kalabalığını azaltmak için
const useEditorStore = create((set, get) => ({
  // Zoom & viewport
  zoom: 'fit',
  setZoom: (value) =>
    set((state) => ({
      zoom: typeof value === 'function' ? value(state.zoom) : value,
    })),

  panelScale: 1,
  setPanelScale: (value) =>
    set((state) => ({
      panelScale: typeof value === 'function' ? value(state.panelScale) : value,
    })),

  // Timeline
  timelineHeight: 220,
  setTimelineHeight: (value) =>
    set((state) => ({
      timelineHeight: typeof value === 'function' ? value(state.timelineHeight) : value,
    })),

  timelineCurrentTime: 0,
  setTimelineCurrentTime: (value) =>
    set((state) => ({
      timelineCurrentTime: typeof value === 'function' ? value(state.timelineCurrentTime) : value,
    })),

  timelinePlaying: false,
  setTimelinePlaying: (value) =>
    set((state) => ({
      timelinePlaying: typeof value === 'function' ? value(state.timelinePlaying) : value,
    })),

  // DB / Connection
  dbStatus: 'connecting',
  setDbStatus: (value) =>
    set((state) => ({
      dbStatus: typeof value === 'function' ? value(state.dbStatus) : value,
    })),

  // UI Tabs
  activeTab: 'sahne',
  setActiveTab: (value) =>
    set((state) => ({
      activeTab: typeof value === 'function' ? value(state.activeTab) : value,
    })),

  storyRibbonTab: 'home',
  setStoryRibbonTab: (value) =>
    set((state) => ({
      storyRibbonTab: typeof value === 'function' ? value(state.storyRibbonTab) : value,
    })),

  // UI Flags
  canvasExpanded: false,
  setCanvasExpanded: (value) =>
    set((state) => ({
      canvasExpanded: typeof value === 'function' ? value(state.canvasExpanded) : value,
    })),

  showReviewThreads: false,
  setShowReviewThreads: (value) =>
    set((state) => ({
      showReviewThreads: typeof value === 'function' ? value(state.showReviewThreads) : value,
    })),

  editorPreviewState: 'normal',
  setEditorPreviewState: (value) =>
    set((state) => ({
      editorPreviewState: typeof value === 'function' ? value(state.editorPreviewState) : value,
    })),

  // Panel sizes
  leftPanelWidth: 260,
  setLeftPanelWidth: (value) =>
    set((state) => ({
      leftPanelWidth: typeof value === 'function' ? value(state.leftPanelWidth) : value,
    })),

  rightPanelWidth: 320,
  setRightPanelWidth: (value) =>
    set((state) => ({
      rightPanelWidth: typeof value === 'function' ? value(state.rightPanelWidth) : value,
    })),

  isSlidePanelCollapsed: false,
  setIsSlidePanelCollapsed: (value) =>
    set((state) => ({
      isSlidePanelCollapsed:
        typeof value === 'function' ? value(state.isSlidePanelCollapsed) : value,
    })),

  // Toasts
  toasts: [],
  addToast: (toast) =>
    set((state) => ({
      toasts: [...state.toasts, { id: Date.now() + Math.random(), duration: 4000, ...toast }],
    })),
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  // Reset UI to defaults
  resetUi: () =>
    set({
      zoom: 'fit',
      panelScale: 1,
      timelineHeight: 220,
      timelineCurrentTime: 0,
      timelinePlaying: false,
      activeTab: 'sahne',
      storyRibbonTab: 'home',
      canvasExpanded: false,
      showReviewThreads: false,
      editorPreviewState: 'normal',
      leftPanelWidth: 260,
      rightPanelWidth: 320,
      isSlidePanelCollapsed: false,
      toasts: [],
    }),
}));

export default useEditorStore;
