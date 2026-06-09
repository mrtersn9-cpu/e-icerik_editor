import { VARIABLE_TYPES, OBJ_PRESETS } from '../constants';
import { ensureTtkbButtonTextContrast } from '../editor-logic/colorUtils';
import { uid } from '../utils/editorHelpers';

import { isPlayPauseReadyButton, getPlayPauseButtonPatch } from './buttonStyling';
import { upgradeDragDropStyle } from './factories';

function normalizeVariable(variable = {}, index = 0) {
  const type = VARIABLE_TYPES.some((item) => item.value === variable.type) ? variable.type : 'text';
  return {
    ...createVariableItem(index),
    ...variable,
    type,
    value: castVariableValue(type, variable.value ?? getDefaultVariableValue(type)),
  };
}
function normalizeObject(obj = {}) {
  obj = obj && typeof obj === 'object' ? obj : {};
  const preset = OBJ_PRESETS[obj.type] || OBJ_PRESETS.text;
  const mergedStyle = { ...preset.style, ...(obj.style || {}) };
  const style =
    obj.type === 'draggable' || obj.type === 'dropzone'
      ? upgradeDragDropStyle(obj.type, mergedStyle)
      : mergedStyle;
  // Kullanıcı buton yazı rengini elle kilitlediyse (colorLocked) TTKB otomatik
  // kontrast düzeltmesini atla — seçilen renk aynen korunur.
  const contrastSafeStyle =
    obj.type === 'button' && !style.colorLocked ? ensureTtkbButtonTextContrast(style) : style;
  const playPausePatch = isPlayPauseReadyButton(obj) ? getPlayPauseButtonPatch(obj) : {};
  return {
    ...preset,
    ...obj,
    style: { ...contrastSafeStyle, ...playPausePatch },
    ...(obj.buttonMotion ? { buttonMotion: obj.buttonMotion } : {}),
    ...(obj.animation ? { animation: obj.animation } : {}),
  };
}
function getDefaultVariableValue(type = 'text') {
  if (type === 'number') return 0;
  if (type === 'boolean') return false;
  return '';
}
function castVariableValue(type = 'text', value = '') {
  if (type === 'number') {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }
  if (type === 'boolean') {
    if (typeof value === 'boolean') return value;
    const normalized = String(value).trim().toLowerCase();
    return ['true', '1', 'evet', 'yes', 'on'].includes(normalized);
  }
  return String(value ?? '');
}
function createVariableItem(index = 0) {
  return {
    id: uid(),
    name: `Degisken ${index + 1}`,
    type: 'text',
    value: '',
  };
}

export {
  normalizeVariable,
  normalizeObject,
  getDefaultVariableValue,
  castVariableValue,
  createVariableItem,
};

