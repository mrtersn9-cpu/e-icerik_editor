import { EDITOR_THEME } from '../../theme';
import { workspaceChrome } from '../editor-workspace/chromeTokens';

const inspector = workspaceChrome.inspector;
const tones = EDITOR_THEME.objectTones;

export const timelineTokens = {
  blue: inspector.blue,
  blueDark: inspector.blueDark,
  border: inspector.border,
  borderSoft: inspector.borderSoft,
  borderStrong: EDITOR_THEME.lightBorderStrong,
  text: inspector.text,
  muted: inspector.muted,
  softText: inspector.softText,
  panel: inspector.panel,
  panelSoft: inspector.panelSoft,
  rowAlt: inspector.panelRaised,
  rowSelected: inspector.active,
  ruler: EDITOR_THEME.lightBg,
  playhead: inspector.blue,
  cue: inspector.warning,
  success: inspector.success,
  danger: inspector.danger,
  clip: {
    text: { fill: tones.blue.fill, border: tones.blue.border, text: tones.blue.text },
    button: { fill: tones.blue.fill, border: tones.blue.base, text: tones.blue.text },
    image: { fill: tones.green.fill, border: tones.green.border, text: tones.green.text },
    audio: { fill: tones.purple.fill, border: tones.purple.border, text: tones.purple.text },
    video: { fill: tones.pink.fill, border: tones.pink.border, text: tones.pink.text },
    shape: { fill: tones.slate.fill, border: tones.slate.border, text: tones.slate.text },
    hotspot: { fill: tones.orange.fill, border: tones.orange.border, text: tones.orange.text },
    draggable: { fill: tones.amber.fill, border: tones.amber.border, text: tones.amber.text },
    dropzone: { fill: tones.teal.fill, border: tones.teal.border, text: tones.teal.text },
    default: { fill: tones.slate.fill, border: tones.slate.border, text: tones.slate.strong },
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
