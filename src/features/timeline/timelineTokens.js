import { workspaceChrome } from '../editor-workspace/chromeTokens';

const inspector = workspaceChrome.inspector;

export const timelineTokens = {
  blue: inspector.blue,
  blueDark: inspector.blueDark,
  border: '#d6e2f2',
  borderSoft: '#e7eef8',
  borderStrong: '#b8c7dc',
  text: '#172033',
  muted: '#64748b',
  softText: '#7b8aa2',
  panel: '#ffffff',
  panelSoft: '#f8fbff',
  rowAlt: '#fbfdff',
  rowSelected: '#eaf2ff',
  ruler: '#f6f9fd',
  playhead: '#2563eb',
  cue: '#f59e0b',
  success: '#16a34a',
  danger: '#ef4444',
  clip: {
    text: { fill: '#dbeafe', border: '#60a5fa', text: '#174ea6' },
    button: { fill: '#dbeafe', border: '#3b82f6', text: '#174ea6' },
    image: { fill: '#dcfce7', border: '#86efac', text: '#15803d' },
    audio: { fill: '#ede9fe', border: '#c4b5fd', text: '#6d28d9' },
    video: { fill: '#fce7f3', border: '#f9a8d4', text: '#be185d' },
    shape: { fill: '#f1f5f9', border: '#cbd5e1', text: '#475569' },
    hotspot: { fill: '#ffedd5', border: '#fdba74', text: '#c2410c' },
    draggable: { fill: '#fef3c7', border: '#fcd34d', text: '#b45309' },
    dropzone: { fill: '#ccfbf1', border: '#5eead4', text: '#0f766e' },
    default: { fill: '#e2e8f0', border: '#cbd5e1', text: '#334155' },
  },
  size: {
    dockCollapsed: 34,
    toolbar: 38,
    ruler: 28,
    row: 28,
    layer: 18,
    labelColumn: 236,
    minTrack: 920,
  },
  radius: workspaceChrome.radius,
};

export function getTimelineClipTone(type = '') {
  return timelineTokens.clip[type] || timelineTokens.clip.default;
}
