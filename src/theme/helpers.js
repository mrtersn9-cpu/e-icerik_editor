import { EDITOR_THEME } from './core';

export function scaleValue(base, factor = 1) {
  return Math.round(base * factor);
}

export function scaleTheme(factor = 1) {
  const s = (v) => Math.round(v * factor);
  return {
    typeXs: s(EDITOR_THEME.typeXs),
    typeSm: s(EDITOR_THEME.typeSm),
    typeMd: s(EDITOR_THEME.typeMd),
    typeLg: s(EDITOR_THEME.typeLg),
    typeXl: s(EDITOR_THEME.typeXl),
    spaceXs: s(EDITOR_THEME.spaceXs),
    spaceSm: s(EDITOR_THEME.spaceSm),
    spaceMd: s(EDITOR_THEME.spaceMd),
    spaceLg: s(EDITOR_THEME.spaceLg),
    spaceXl: s(EDITOR_THEME.spaceXl),
    radiusSm: s(EDITOR_THEME.radiusSm),
    radiusMd: s(EDITOR_THEME.radiusMd),
    radiusLg: s(EDITOR_THEME.radiusLg),
    radiusXl: s(EDITOR_THEME.radiusXl),
  };
}
