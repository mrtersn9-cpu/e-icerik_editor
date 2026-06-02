import { EDITOR_THEME } from '../../theme';

export const workspaceChrome = {
  topbar: {
    background: `linear-gradient(180deg,${EDITOR_THEME.shellBg} 0%,${EDITOR_THEME.shellInset} 100%)`,
    border: EDITOR_THEME.shellBorderSoft,
  },
  ribbon: {
    tabHeight: 32,
    commandHeight: 88,
    border: EDITOR_THEME.lightBorderSoft,
    separator: EDITOR_THEME.lightBorderSoft,
  },
  inspector: {
    blue: EDITOR_THEME.lightAccent,
    blueDark: EDITOR_THEME.lightAccentDark,
    border: EDITOR_THEME.lightBorderSoft,
    borderSoft: EDITOR_THEME.lightBorderSoft,
    text: EDITOR_THEME.lightText,
    muted: EDITOR_THEME.lightMuted,
    softText: EDITOR_THEME.lightDisabledText,
    panel: EDITOR_THEME.lightPanel,
    panelSoft: EDITOR_THEME.lightPanelSoft,
    panelRaised: EDITOR_THEME.lightPanelRaised,
    active: EDITOR_THEME.lightAccentSoft,
    activeBorder: EDITOR_THEME.lightAccentBorder,
    danger: EDITOR_THEME.objectTones.red.base,
    success: EDITOR_THEME.objectTones.green.base,
    warning: EDITOR_THEME.objectTones.amber.base,
  },
  radius: {
    xs: EDITOR_THEME.radiusSm,
    sm: EDITOR_THEME.radiusMd,
    md: EDITOR_THEME.radiusLg,
    pill: EDITOR_THEME.radiusRound,
  },
  control: {
    height: 30,
    compactHeight: 24,
    fontSize: EDITOR_THEME.typeControl,
  },
};
