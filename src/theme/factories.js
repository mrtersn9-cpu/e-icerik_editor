import { EDITOR_THEME } from './core';

export function createShellGroupStyle({
  grow = false,
  wrap = false,
  pad = '6px 10px',
  justify = 'flex-start',
} = {}) {
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: justify,
    gap: EDITOR_THEME.spaceSm,
    flexWrap: wrap ? 'wrap' : 'nowrap',
    padding: pad,
    borderRadius: EDITOR_THEME.radiusLg,
    border: `1px solid ${EDITOR_THEME.shellBorderSoft}`,
    background: 'rgba(255,255,255,.03)',
    boxShadow: 'none',
    minHeight: 38,
    flex: grow ? 1 : '0 0 auto',
    minWidth: 0,
  };
}

export function createShellPanelStyle({ grow = false } = {}) {
  return {
    border: `1px solid ${EDITOR_THEME.shellBorder}`,
    borderRadius: EDITOR_THEME.radiusXl,
    background: EDITOR_THEME.shellPanel,
    boxShadow: EDITOR_THEME.shadowMd,
    minWidth: 0,
    flex: grow ? 1 : '0 0 auto',
  };
}

export function createLightPanelStyle({ padding = 16 } = {}) {
  return {
    border: `1px solid ${EDITOR_THEME.lightBorder}`,
    borderRadius: EDITOR_THEME.radiusXl,
    background: EDITOR_THEME.lightPanel,
    boxShadow: EDITOR_THEME.shadowMd,
    padding,
  };
}
