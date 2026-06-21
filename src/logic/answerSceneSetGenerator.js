import { isGeneratedAnswerTemplateObject, normalizeRuntimeActionLabel } from '../utils/storylineRuntime';

import {
  createObjectFromActivity,
  createTriggerItem,
} from './activityFactory';
import { getActivitySlides } from './activityHelpers';
import {
  getAnswerLayerStylePresetById,
  getLayerActionButtonStyle,
  getPresetButtonShapeStyle,
  getPresetToneColors,
} from './buttonStyling';
import { contentText } from './contentLanguage';
import { normalizeButtonPairLayoutForActivity } from './editorHelpers';
import {
  buildResolvedLayerNameMap,
  createLayer,
  normalizeLayerNameKey,
} from './factories';
import {
  DEFAULT_ANSWER_LAYER_STYLE_PRESET_ID,
  SCENE_TEMPLATE_BUTTON_INTRO_ID,
  SCENE_TEMPLATE_LAUNCH_PAGE_ID,
} from './sceneTemplates';
import { syncTimelineWithObjects } from './timeline';

const requiredLayerNames = ['menu', 'explanation', 'normal', 'Correct', 'Incorrect', 'cevap'];
const practiceControlSlotPrefix = 'answer-template:practice-controls';

function isGeneratedPracticeControl(object = {}) {
  return (
    isGeneratedAnswerTemplateObject(object) &&
    (object.answerTemplateRole === 'practice-control' ||
      String(object.sceneTemplateSlotId || '').startsWith(`${practiceControlSlotPrefix}:`) ||
      String(object.linkedHoverGroup || '').startsWith(`${practiceControlSlotPrefix}:`))
  );
}

function solidCssColor(value = '', fallback = '#ffffff') {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  return raw.replace(
    /rgba\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,]+)\s*,\s*[^)]+\)/gi,
    'rgb($1,$2,$3)'
  );
}

function cssColorWithAlpha(value = '', alpha = 0.98, fallback = 'rgba(255,255,255,.98)') {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  const hex = raw.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const full =
      hex[1].length === 3
        ? hex[1]
            .split('')
            .map((char) => char + char)
            .join('')
        : hex[1];
    const intValue = parseInt(full, 16);
    const r = (intValue >> 16) & 255;
    const g = (intValue >> 8) & 255;
    const b = intValue & 255;
    return `rgba(${r},${g},${b},${alpha})`;
  }
  const rgb = raw.match(/^rgba?\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,)]+)/i);
  if (rgb) return `rgba(${rgb[1]},${rgb[2]},${rgb[3]},${alpha})`;
  return fallback;
}

function createTemplateObjectFactory(activity, remainingObjects) {
  let zIndexCursor = remainingObjects.reduce(
    (max, item) => Math.max(max, Number(item.zIndex) || 0),
    0
  );
  const generated = [];
  const pushTemplateObject = (layerId, type, patch) => {
    const created = createObjectFromActivity(activity, type);
    zIndexCursor += 1;
    const nextObject = {
      ...created,
      ...patch,
      layerId,
      generatedBy: 'answer-template',
      locked: false,
      zIndex: zIndexCursor,
    };
    generated.push(nextObject);
    return nextObject;
  };
  return { generated, pushTemplateObject };
}

function getLayerTheme(preset, kind = 'default') {
  const surface = preset?.surface || 'rgba(255,255,255,.98)';
  const surfaceAlt = preset?.surfaceAlt || 'rgba(248,250,252,.96)';
  const surfaceBorder = preset?.surfaceBorder || '#d8e5f0';
  const surfaceSolid = solidCssColor(surface, '#ffffff');
  const surfaceAltSolid = solidCssColor(surfaceAlt, surfaceSolid);
  const toneKey =
    kind === 'correct'
      ? 'success'
      : kind === 'incorrect' || kind === 'answer'
        ? 'danger'
        : kind === 'normal'
          ? 'warning'
          : kind === 'menu'
            ? 'primary'
            : 'accent';
  const colors = getPresetToneColors(preset, toneKey);
  const panelTop = cssColorWithAlpha(colors.light || colors.top || surfaceSolid, 0.98);
  const panelBottom = cssColorWithAlpha(
    colors.top || colors.mid || surfaceAltSolid,
    0.98,
    panelTop
  );
  return {
    colors,
    surface: `linear-gradient(180deg,${panelTop} 0%,${panelBottom} 100%)`,
    surfaceAlt: `linear-gradient(180deg,${panelBottom} 0%,${panelTop} 100%)`,
    border: colors.light || surfaceBorder,
    accent: getPresetButtonShapeStyle(preset, toneKey).background,
    text:
      kind === 'correct'
        ? preset?.successText || colors.bottom
        : kind === 'incorrect' || kind === 'answer'
          ? preset?.dangerText || colors.bottom
          : preset?.titleColor || colors.bottom,
  };
}

function getSemanticIcon(iconObject = {}, labelObject = {}) {
  const labelKey = normalizeRuntimeActionLabel(labelObject.label || labelObject.text || '');
  const action = String(labelObject.runtimeAction || iconObject.runtimeAction || '').toLowerCase();
  if (labelKey.includes('etkinliktanitimi') || labelKey.includes('activityintro')) return '?';
  if (labelKey.includes('anasayfa') || labelKey.includes('home') || action === 'home') return '⌂';
  if (labelKey.includes('menu') || action.includes('menu')) return '☰';
  if (
    labelKey.includes('yenidenbaslat') ||
    labelKey.includes('tekrarla') ||
    labelKey.includes('retry') ||
    action.includes('restart')
  )
    return '↻';
  if (labelKey.includes('ses') || action.includes('mute')) return iconObject.soundOffIcon || '🔊︎';
  if (labelKey.includes('cozum') || labelKey.includes('cevap') || action.includes('answer'))
    return '✎';
  if (labelKey.includes('tamamla') || labelKey.includes('kontrol') || action.includes('complete'))
    return '✓';
  if (labelKey.includes('ileri') || labelKey.includes('next')) return '≫';
  if (labelKey.includes('geri') || labelKey.includes('prev')) return '≪';
  return String(iconObject.label || iconObject.text || '?').trim() || '?';
}

function buildAnswerSceneObjects(activity = {}, workingLayers = [], workingLayerNames = {}) {
  const objects = Array.isArray(activity.objects) ? activity.objects : [];
  const triggers = Array.isArray(activity.triggers) ? activity.triggers : [];
  const getLayerIdByKey = (key) => {
    const found = workingLayers.find(
      (layer) => normalizeLayerNameKey(workingLayerNames[layer.id] || layer.name || '') === key
    );
    return found?.id || null;
  };

  const menuLayerId = getLayerIdByKey('menu');
  const normalLayerId = getLayerIdByKey('normal');
  const correctLayerId = getLayerIdByKey('correct');
  const incorrectLayerId = getLayerIdByKey('incorrect');
  const answerLayerId = getLayerIdByKey('cevap');
  const targetLayerIds = [
    menuLayerId,
    normalLayerId,
    correctLayerId,
    incorrectLayerId,
    answerLayerId,
  ].filter(Boolean);
  const generatedTemplateIds = new Set(
    objects
      .filter(
        (item) =>
          (targetLayerIds.includes(item.layerId || 'base') || isGeneratedPracticeControl(item)) &&
          isGeneratedAnswerTemplateObject(item)
      )
      .map((item) => item.id)
  );
  const remainingObjects = objects.filter((item) => !generatedTemplateIds.has(item.id));
  const remainingTriggers = triggers.filter((item) => item.generatedBy !== 'answer-template');
  const { generated, pushTemplateObject } = createTemplateObjectFactory(activity, remainingObjects);
  const generatedTriggers = [];
  const stageWidth = Number(activity.stageWidth) || 1920;
  const stageHeight = Number(activity.stageHeight) || 1080;
  const sx = stageWidth / 1920;
  const sy = stageHeight / 1080;
  const u = (value, axis = 'x') => Math.round(value * (axis === 'y' ? sy : sx));
  const preset =
    getAnswerLayerStylePresetById(activity.answerLayerStylePresetId || activity.sceneTemplatePresetId) ||
    getAnswerLayerStylePresetById(DEFAULT_ANSWER_LAYER_STYLE_PRESET_ID);
  const tx = contentText(activity);
  const slides = getActivitySlides(activity);
  const launchSlideId =
    slides.find((slide) => slide.sceneTemplateId === SCENE_TEMPLATE_LAUNCH_PAGE_ID)?.id || '';
  const introSlideId =
    slides.find((slide) => slide.sceneTemplateId === SCENE_TEMPLATE_BUTTON_INTRO_ID)?.id || '';
  const surfaceBorder = preset?.surfaceBorder || '#d8e5f0';
  const surfaceShadow = preset?.surfaceShadow || '0 24px 48px rgba(15,23,42,.16)';
  const insetShadow = preset?.insetShadow || 'inset 0 1px 0 rgba(255,255,255,.82)';
  const toneDanger = preset?.dangerGradient || 'linear-gradient(180deg,#ef4444 0%,#dc2626 100%)';
  const toneAccent = preset?.accentGradient || 'linear-gradient(180deg,#f43f5e 0%,#e11d48 100%)';
  const toneSuccess = preset?.successGradient || 'linear-gradient(180deg,#22c55e 0%,#16a34a 100%)';
  const toneNeutral = preset?.neutralGradient || 'linear-gradient(180deg,#7dd3fc 0%,#0ea5e9 52%,#0369a1 100%)';
  const shadowSoft =
    (preset?.motion?.hoverShadow && String(preset.motion.hoverShadow).trim()) ||
    '0 12px 24px rgba(15,23,42,.14)';
  const buttonMotion = preset?.motion || {};
  const themeIcons = preset?.icons || {};
  const panelRadius = Number(preset?.panelRadius || 18);
  const buttonRadius = Number(preset?.buttonRadius || 14);

  const pushShape = (layerId, patch) =>
    pushTemplateObject(layerId, 'shape', {
      shapeKind: patch.shapeKind || 'roundedRect',
      label: '',
      showShapeLabel: false,
      ...patch,
      style: {
        background: '#ffffff',
        borderColor: 'transparent',
        borderWidth: 0,
        color: 'transparent',
        ...(patch.style || {}),
      },
    });
  const pushText = (layerId, label, x, y, width, height, style = {}) =>
    pushTemplateObject(layerId, 'text', {
      label,
      x,
      y,
      width,
      height,
      style: {
        background: 'transparent',
        borderColor: 'transparent',
        borderWidth: 0,
        color: '#111111',
        fontSize: u(24, 'y'),
        fontWeight: 700,
        textAlign: 'left',
        boxShadow: 'none',
        lineHeight: 1.35,
        ...(style || {}),
      },
    });
  const pushButton = (layerId, label, x, y, width, height, style = {}) => {
    const {
      runtimeAction = '',
      soundOnLabel = '',
      soundOffLabel = '',
      soundOnIcon = '',
      soundOffIcon = '',
      soundIconMode = '',
      linkedHoverGroup = '',
      buttonMotionOverride = null,
      stateStyles = null,
      tone = 'accent',
      background: requestedBackground,
      borderColor: requestedBorderColor,
      color: requestedColor,
      textShadow: requestedTextShadow,
      ...styleValues
    } = style || {};
    const shapeStyle = getLayerActionButtonStyle(preset, tone);
    const toneColors = getPresetToneColors(preset, tone);
    const palette = {
      accent: {
        background: toneAccent,
        borderColor: preset?.accentBorder || 'rgba(225,29,72,.34)',
        color: preset?.accentText || '#ffffff',
      },
      neutral: {
        background: toneNeutral,
        borderColor: preset?.neutralBorder || 'rgba(15,23,42,.22)',
        color: '#ffffff',
      },
      success: {
        background: toneSuccess,
        borderColor: preset?.successBorder || 'rgba(22,163,74,.34)',
        color: preset?.accentText || '#ffffff',
      },
      danger: {
        background: toneDanger,
        borderColor: preset?.dangerBorder || 'rgba(220,38,38,.34)',
        color: preset?.accentText || '#ffffff',
      },
      soft: {
        background: preset?.surfaceAlt || '#ffffff',
        borderColor: surfaceBorder,
        color: preset?.titleColor || '#0f172a',
      },
    }[tone] || {
      background: shapeStyle.background || toneAccent,
      borderColor: shapeStyle.borderColor || toneColors.light,
      color: shapeStyle.color || toneColors.text || '#ffffff',
    };
    return pushTemplateObject(layerId, 'button', {
      label,
      x,
      y,
      width,
      height,
      ...(runtimeAction ? { runtimeAction } : {}),
      ...(soundOnLabel ? { soundOnLabel } : {}),
      ...(soundOffLabel ? { soundOffLabel } : {}),
      ...(soundOnIcon ? { soundOnIcon } : {}),
      ...(soundOffIcon ? { soundOffIcon } : {}),
      ...(soundIconMode ? { soundIconMode } : {}),
      ...(linkedHoverGroup ? { linkedHoverGroup } : {}),
      ...(buttonMotionOverride || buttonMotion
        ? { buttonMotion: { ...(buttonMotion || {}), ...(buttonMotionOverride || {}) } }
        : {}),
      ...(stateStyles ? { stateStyles } : {}),
      style: {
        background: requestedBackground || shapeStyle.background || palette.background,
        borderColor: requestedBorderColor || shapeStyle.borderColor || palette.borderColor,
        borderWidth: shapeStyle.borderWidth ?? 1,
        borderRadius: shapeStyle.borderRadius ?? buttonRadius,
        color: requestedColor || shapeStyle.color || palette.color,
        fontSize: u(20, 'y'),
        fontWeight: 900,
        textAlign: 'center',
        textShadow: shapeStyle.textShadow || requestedTextShadow || '0 1px 0 rgba(0,0,0,.18)',
        boxShadow: shapeStyle.boxShadow || `0 14px 28px rgba(15,23,42,.14), ${insetShadow}`,
        ...(styleValues || {}),
      },
    });
  };
  const pushIconButton = (layerId, label, x, y, size, tone = 'primary', extra = {}) => {
    const iconStyle = getLayerActionButtonStyle(preset, tone);
    return pushTemplateObject(layerId, 'button', {
      label,
      x,
      y,
      width: size,
      height: size,
      runtimeAction: 'none',
      decorativeButton: true,
      readyButtonTone: tone,
      buttonMotion: { ...(buttonMotion || {}) },
      style: {
        background: iconStyle.background,
        borderColor: iconStyle.borderColor,
        borderWidth: Math.max(2, Number(iconStyle.borderWidth ?? 2) || 2),
        borderRadius: 999,
        color: iconStyle.color || '#ffffff',
        fontSize: Math.round(size * 0.58),
        fontWeight: 900,
        textAlign: 'center',
        lineHeight: 1,
        padding: 0,
        textShadow: iconStyle.textShadow || '0 2px 0 rgba(0,0,0,.34)',
        boxShadow: iconStyle.boxShadow || shadowSoft,
        ...(extra.style || {}),
      },
    });
  };
  const pushDim = (layerId, opacity = preset?.dimOpacity ?? 0.07) =>
    pushShape(layerId, {
      shapeKind: 'rect',
      x: 0,
      y: 0,
      width: stageWidth,
      height: stageHeight,
      style: {
        background: `rgba(15,23,42,${Math.max(0.07, Number(opacity) || 0.07)})`,
        borderWidth: 0,
      },
    });
  const pushCloseButton = (layerId, x, y, size = u(56, 'y')) => {
    const closeStyle = getPresetButtonShapeStyle(preset, 'danger');
    const closeButton = pushTemplateObject(layerId, 'button', {
      label: themeIcons.close || '×',
      x: x - Math.round(size * 0.08),
      y: y - Math.round(size * 0.08),
      width: Math.round(size * 1.16),
      height: Math.round(size * 1.16),
      runtimeAction: 'none',
      readyButtonTone: 'danger',
      buttonMotion: { ...(buttonMotion || {}) },
      style: {
        background: closeStyle.background || toneDanger,
        borderColor: closeStyle.borderColor || preset?.dangerBorder || 'rgba(248,250,252,.38)',
        borderWidth: Math.max(3, Number(closeStyle.borderWidth || 3)),
        borderRadius: 999,
        color: closeStyle.color || '#ffffff',
        fontSize: Math.round(size * 0.56),
        fontWeight: 900,
        textAlign: 'center',
        lineHeight: 1,
        padding: 0,
        textShadow: closeStyle.textShadow || '0 2px 0 rgba(0,0,0,.26)',
        boxShadow:
          closeStyle.boxShadow ||
          'inset 0 3px 0 rgba(255,255,255,.68), inset 0 -8px 0 rgba(0,0,0,.24), 0 8px 0 rgba(127,29,29,.78), 0 18px 30px rgba(15,23,42,.26)',
      },
    });
    generatedTriggers.push({
      ...createTriggerItem(generatedTriggers.length),
      when: 'onClick',
      target: closeButton.id,
      action: 'KatmanaGec',
      value: 'base',
      name: 'Layer kapat',
      generatedBy: 'answer-template',
    });
    return closeButton;
  };

  const isExistingBasePracticeControl = (object = {}, kind = '') => {
    if (!object || object.type !== 'button' || (object.layerId || 'base') !== 'base') return false;
    const labelKey = normalizeRuntimeActionLabel(object.label || object.text || '');
    const action = String(object.runtimeAction || '').trim().toLowerCase();
    const presetId = String(object.readyButtonPresetId || '').trim().toLowerCase();
    const slotId = String(object.sceneTemplateSlotId || '').trim().toLowerCase();
    if (kind === 'check') {
      return (
        !!object.isCheckButton ||
        presetId === 'check' ||
        slotId.includes(':check-') ||
        slotId.includes('ready-button:check') ||
        labelKey === 'check' ||
        labelKey.includes('kontrolet')
      );
    }
    if (kind === 'menu') {
      return (
        presetId === 'menu' ||
        slotId.includes(':menu-') ||
        slotId.includes('ready-button:menu') ||
        ['help', 'show-help', 'menu', 'toggle-menu', 'open-menu'].includes(action) ||
        labelKey === 'menu' ||
        labelKey.includes('menu')
      );
    }
    return false;
  };

  const hasBasePracticeControl = (kind) =>
    remainingObjects.some((object) => isExistingBasePracticeControl(object, kind));

  const cleanControlLabel = (value = '', fallback = '') => {
    const text = String(value || fallback || '')
      .replace(/^☰\s*/u, '')
      .trim();
    return (text || fallback).toLocaleUpperCase('tr-TR');
  };

  const patchPracticeControlAccessibility = (object, label, isIcon = false) => ({
    ...object,
    accessibility: {
      ...(object.accessibility || {}),
      ariaLabel: isIcon ? '' : label,
      ariaHidden: isIcon,
      focusable: !isIcon,
      tabIndex: isIcon ? -1 : 0,
      role: isIcon ? 'presentation' : 'button',
    },
  });

  const pushPracticeControlPair = ({
    kind,
    icon,
    label,
    tone,
    x,
    y,
    labelWidth,
    runtimeAction = '',
    targetLayerId = '',
  }) => {
    const height = u(64, 'y');
    const iconWidth = u(82);
    const gap = u(12);
    const group = `${practiceControlSlotPrefix}:${kind}`;
    const iconButton = pushButton('base', icon, x, y, iconWidth, height, {
      tone,
      runtimeAction: runtimeAction || 'none',
      linkedHoverGroup: group,
      fontSize: u(28, 'y'),
      padding: 0,
      lineHeight: 1,
      borderRadius: 999,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    });
    const labelButton = pushButton('base', label, x + iconWidth + gap, y, labelWidth, height, {
      tone,
      ...(runtimeAction ? { runtimeAction } : {}),
      linkedHoverGroup: group,
      soundIconMode: 'external',
      fontSize: u(18, 'y'),
      paddingLeft: 0,
      paddingRight: 0,
      textAlign: 'center',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    });

    Object.assign(
      iconButton,
      patchPracticeControlAccessibility(iconButton, label, true),
      {
        answerTemplateRole: 'practice-control',
        readyButtonPresetId: kind,
        readyButtonTone: tone,
        isCheckButton: kind === 'check',
        sceneTemplateSlotId: `${practiceControlSlotPrefix}:${kind}-icon`,
        linkedActionTargetId: labelButton.id,
      }
    );
    Object.assign(
      labelButton,
      patchPracticeControlAccessibility(labelButton, label, false),
      {
        answerTemplateRole: 'practice-control',
        readyButtonPresetId: kind,
        readyButtonTone: tone,
        isCheckButton: kind === 'check',
        sceneTemplateSlotId: `${practiceControlSlotPrefix}:${kind}-label`,
        linkedActionTargetId: labelButton.id,
      }
    );

    if (kind === 'menu' && targetLayerId) {
      [iconButton, labelButton].forEach((button) => {
        generatedTriggers.push({
          ...createTriggerItem(generatedTriggers.length),
          when: 'onClick',
          target: button.id,
          action: 'KatmanaGec',
          value: targetLayerId,
          name: `${label} menü görevi`,
          generatedBy: 'answer-template',
        });
      });
    }
  };

  const pushPracticeControls = () => {
    const height = u(64, 'y');
    const y = Math.max(u(24, 'y'), stageHeight - u(90, 'y'));
    const iconWidth = u(82);
    const gap = u(12);
    const menuLabel = cleanControlLabel(activity.settings?.menuButtonText, tx.menu);
    const checkLabel = cleanControlLabel(
      activity.answerControl?.checkButtonText || activity.settings?.checkButtonText,
      tx.check
    );

    if (!hasBasePracticeControl('menu')) {
      pushPracticeControlPair({
        kind: 'menu',
        icon: themeIcons.menu || '☰',
        label: menuLabel,
        tone: 'theme',
        x: u(72),
        y,
        labelWidth: u(146),
        runtimeAction: 'help',
        targetLayerId: menuLayerId,
      });
    }

    if (!hasBasePracticeControl('check')) {
      const labelWidth = u(236);
      const totalWidth = iconWidth + gap + labelWidth;
      pushPracticeControlPair({
        kind: 'check',
        icon: themeIcons.complete || '✓',
        label: checkLabel,
        tone: 'theme',
        x: Math.max(u(24), stageWidth - totalWidth - u(60)),
        y: Math.max(u(24, 'y'), y - Math.round(height * 0.16)),
        labelWidth,
      });
    }
  };

  const pushResultHeaderTemplate = ({ layerId, status = 'success', title, body, buttons = [] }) => {
    const isSuccess = status === 'success';
    const chrome = getLayerTheme(preset, isSuccess ? 'correct' : 'incorrect');
    const tone = isSuccess
      ? { color: chrome.text, border: chrome.border, icon: '✓', iconTone: 'success' }
      : { color: chrome.text, border: chrome.border, icon: '×', iconTone: 'danger' };
    pushDim(layerId, Math.max(0.07, Number(preset?.dimOpacity ?? 0.07)));
    const bannerX = Math.round(stageWidth * 0.135);
    const bannerW = stageWidth - bannerX * 2;
    const bannerH = u(124, 'y');
    const bannerY = stageHeight - u(206, 'y');
    const iconSize = u(86, 'y');
    const iconX = bannerX + u(20);
    const iconY = bannerY + Math.round((bannerH - iconSize) / 2);
    pushShape(layerId, {
      shapeKind: 'roundedRect',
      x: bannerX,
      y: bannerY,
      width: bannerW,
      height: bannerH,
      style: {
        background: chrome.surface,
        borderColor: tone.border,
        borderWidth: 2,
        borderRadius: Math.max(10, panelRadius - 4),
        boxShadow: `${surfaceShadow}, ${insetShadow}`,
      },
    });
    pushIconButton(layerId, tone.icon, iconX, iconY, iconSize, tone.iconTone, {
      style: {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: u(66, 'y'),
        lineHeight: 0.92,
      },
    });
    const actionH = u(54, 'y');
    const actionGap = u(24);
    const widths = buttons.map((item) => u(item.width || 240));
    const totalW = widths.reduce((sum, width) => sum + width, 0) + actionGap * Math.max(0, buttons.length - 1);
    let cursorX = bannerX + bannerW - totalW - u(30);
    const buttonY = bannerY + Math.round((bannerH - actionH) / 2);
    const textLeft = iconX + iconSize + u(44);
    const textRight = cursorX - u(38);
    const textW = Math.max(u(520), textRight - textLeft);
    const textBlockH = u(76, 'y');
    const textTop = bannerY + Math.round((bannerH - textBlockH) / 2);
    pushText(layerId, title, textLeft, textTop, textW, u(40, 'y'), {
      color: tone.color,
      fontSize: u(34, 'y'),
      fontWeight: 950,
      textAlign: 'center',
    });
    pushText(layerId, body, textLeft, textTop + u(44, 'y'), textW, u(32, 'y'), {
      color: preset?.bodyColor || '#334155',
      fontSize: u(20, 'y'),
      fontWeight: 760,
      textAlign: 'center',
    });
    buttons.forEach((item, index) => {
      const width = widths[index];
      const rowGroup = `answer-template:${layerId}:result-button-${index}`;
      const iconSize = actionH;
      const iconLabelGap = u(12);
      const iconButton = item.icon
        ? pushButton(layerId, item.icon, cursorX, buttonY, iconSize, actionH, {
            tone: item.tone || 'success',
            fontSize: u(24, 'y'),
            ...(item.runtimeAction ? { runtimeAction: item.runtimeAction } : {}),
            linkedHoverGroup: rowGroup,
            style: { padding: 0, lineHeight: 0.95, borderRadius: 999 },
          })
        : null;
      if (iconButton) iconButton.label = getSemanticIcon(iconButton, item);
      const labelButton = pushButton(
        layerId,
        item.label,
        cursorX + (item.icon ? iconSize + iconLabelGap : 0),
        buttonY,
        item.icon ? width - iconSize - iconLabelGap : width,
        actionH,
        {
          tone: item.tone || 'success',
          fontSize: u(18, 'y'),
          ...(item.runtimeAction ? { runtimeAction: item.runtimeAction } : {}),
          linkedHoverGroup: rowGroup,
          soundIconMode: 'external',
        }
      );
      if (iconButton) {
        iconButton.linkedActionTargetId = labelButton.id;
        labelButton.linkedActionTargetId = labelButton.id;
      }
      if (item.trigger) {
        generatedTriggers.push({
          ...createTriggerItem(generatedTriggers.length),
          when: 'onClick',
          target: labelButton.id,
          action: item.trigger.action,
          value: item.trigger.value,
          name: `${item.label} görevi`,
          generatedBy: 'answer-template',
        });
      }
      cursorX += width + actionGap;
    });
  };

  const pushRetryAnswerTemplate = (layerId) => {
    const chrome = getLayerTheme(preset, 'answer');
    pushDim(layerId, Math.max(0.07, Number(preset?.dimOpacity ?? 0.07)));
    const panelW = u(690);
    const panelH = u(96, 'y');
    const panelX = Math.round((stageWidth - panelW) / 2);
    const panelY = stageHeight - u(166, 'y');
    pushShape(layerId, {
      shapeKind: 'roundedRect',
      x: panelX,
      y: panelY,
      width: panelW,
      height: panelH,
      style: {
        background: chrome.surface,
        borderColor: chrome.border || preset?.dangerBorder || '#fecaca',
        borderWidth: 1,
        borderRadius: panelRadius,
        boxShadow: `${surfaceShadow}, ${insetShadow}`,
      },
    });
    const retryGroup = `answer-template:${layerId}:retry-button`;
    const retryIcon = pushButton(layerId, themeIcons.restart || '↻', panelX + u(195), panelY + u(20, 'y'), u(78), u(58, 'y'), {
      tone: 'danger',
      background: toneDanger,
      fontSize: u(22, 'y'),
      runtimeAction: 'restart',
      linkedHoverGroup: retryGroup,
      style: { padding: 0, lineHeight: 1, borderRadius: 999 },
    });
    const retryLabel = pushButton(layerId, tx.tryAgain, panelX + u(248), panelY + u(20, 'y'), u(277), u(58, 'y'), {
      tone: 'danger',
      background: toneDanger,
      fontSize: u(19, 'y'),
      runtimeAction: 'restart',
      linkedHoverGroup: retryGroup,
      soundIconMode: 'external',
    });
    retryIcon.linkedActionTargetId = retryLabel.id;
    retryLabel.linkedActionTargetId = retryLabel.id;
    // "Tekrar dene" yalnızca runtimeAction:'restart' kullanır; bu, başka slayta
    // gitmek yerine mevcut slaytın denemesini sıfırlayıp base layer'a döner.
    // Eski SliderGec (Sahneye Geç) tetikleyicisi kasıtlı olarak eklenmiyor.
  };

  const pushNormalPopupTemplate = (layerId) => {
    const chrome = getLayerTheme(preset, 'normal');
    pushDim(layerId, preset?.dimOpacity ?? 0.07);
    const panelW = u(620);
    const panelH = u(252, 'y');
    const panelX = Math.round((stageWidth - panelW) / 2);
    const panelY = Math.round((stageHeight - panelH) / 2) - u(22, 'y');
    pushShape(layerId, {
      shapeKind: 'roundedRect',
      x: panelX,
      y: panelY,
      width: panelW,
      height: panelH,
      style: {
        background: chrome.surface,
        borderColor: chrome.border || surfaceBorder,
        borderWidth: 1,
        borderRadius: panelRadius,
        boxShadow: `${surfaceShadow}, ${insetShadow}`,
      },
    });
    pushIconButton(layerId, themeIcons.warning || '!', panelX + Math.round((panelW - u(92)) / 2), panelY + u(36, 'y'), u(92, 'y'), 'warning', {
      style: { fontSize: u(70, 'y') },
    });
    pushText(layerId, tx.answerPrecheckMessage, panelX + u(40), panelY + u(158, 'y'), panelW - u(80), u(62, 'y'), {
      color: preset?.bodyColor || '#334155',
      fontSize: u(22, 'y'),
      fontWeight: 700,
      textAlign: 'center',
    });
    pushCloseButton(layerId, panelX + panelW - u(36), panelY - u(34, 'y'), u(62, 'y'));
  };

  const pushMenuPopupTemplate = (layerId) => {
    const chrome = getLayerTheme(preset, 'menu');
    pushDim(layerId, Math.max(0.07, Number(preset?.dimOpacity ?? 0.07)));
    const panelW = u(460);
    const panelH = u(430, 'y');
    const panelX = Math.round((stageWidth - panelW) / 2);
    const panelY = Math.round((stageHeight - panelH) / 2);
    pushShape(layerId, {
      shapeKind: 'roundedRect',
      x: panelX,
      y: panelY,
      width: panelW,
      height: panelH,
      style: {
        background: chrome.surface,
        borderColor: chrome.border || surfaceBorder,
        borderWidth: 1,
        borderRadius: panelRadius + 2,
        boxShadow: `${surfaceShadow}, ${insetShadow}`,
      },
    });
    pushCloseButton(layerId, panelX + panelW - u(38), panelY - u(38, 'y'), u(62, 'y'));
    [
      {
        icon: themeIcons.guide || '?',
        label: tx.activityIntro,
        tone: 'theme',
        trigger: introSlideId ? { action: 'SliderGec', value: introSlideId } : null,
        runtimeAction: introSlideId ? '' : 'help',
      },
      {
        icon: themeIcons.restart || '↻',
        label: tx.restart,
        runtimeAction: 'restart',
        tone: 'danger',
        // restart base layer'a döner; navigasyon tetikleyicisi yok.
        trigger: null,
      },
      {
        icon: '🔊︎',
        label: tx.soundOff,
        runtimeAction: 'toggle-mute',
        tone: 'theme',
        soundOnLabel: tx.soundOn,
        soundOffLabel: tx.soundOff,
        soundOnIcon: '🔇︎',
        soundOffIcon: '🔊︎',
      },
      {
        icon: themeIcons.home || '⌂',
        label: tx.home,
        tone: 'theme',
        trigger: launchSlideId ? { action: 'SliderGec', value: launchSlideId } : null,
        runtimeAction: launchSlideId ? '' : 'home',
      },
    ].forEach((item, index) => {
      const rowY = panelY + u(64, 'y') + index * u(82, 'y');
      const rowGroup = `answer-template:${layerId}:menu-row-${index}`;
      const rowIconW = u(78);
      const rowGap = u(12);
      const rowIconX = panelX + u(54);
      const rowLabelX = rowIconX + rowIconW + rowGap;
      const rowRight = panelX + panelW - u(54);
      const rowLabelW = Math.max(u(210), rowRight - rowLabelX);
      const iconBg = pushButton(layerId, getSemanticIcon({ label: item.icon, runtimeAction: item.runtimeAction }, item), rowIconX, rowY, rowIconW, u(58, 'y'), {
        tone: item.tone,
        fontSize: u(28, 'y'),
        runtimeAction: item.runtimeAction || 'none',
        linkedHoverGroup: rowGroup,
        style: { padding: 0, lineHeight: 1, borderRadius: 999, whiteSpace: 'nowrap' },
      });
      if (item.runtimeAction === 'toggle-mute') {
        Object.assign(iconBg, {
          dynamicSoundIcon: true,
          soundOnIcon: item.soundOnIcon || '🔇︎',
          soundOffIcon: item.soundOffIcon || '🔊︎',
        });
      }
      const labelButton = pushButton(layerId, item.label, rowLabelX, rowY, rowLabelW, u(58, 'y'), {
        tone: item.tone,
        fontSize: u(18, 'y'),
        ...(item.runtimeAction ? { runtimeAction: item.runtimeAction } : {}),
        ...(item.soundOnLabel ? { soundOnLabel: item.soundOnLabel } : {}),
        ...(item.soundOffLabel ? { soundOffLabel: item.soundOffLabel } : {}),
        soundIconMode: 'external',
        linkedHoverGroup: rowGroup,
        style: { paddingLeft: 0, paddingRight: 0, textAlign: 'center', whiteSpace: 'nowrap' },
      });
      iconBg.linkedActionTargetId = labelButton.id;
      labelButton.linkedActionTargetId = labelButton.id;
      if (item.trigger) {
        generatedTriggers.push({
          ...createTriggerItem(generatedTriggers.length),
          when: 'onClick',
          target: labelButton.id,
          action: item.trigger.action,
          value: item.trigger.value,
          name: `${item.label} menü görevi`,
          generatedBy: 'answer-template',
        });
      }
    });
  };

  pushPracticeControls();

  // Sonuç banner gövdesi: kullanıcının Geri Bildirim kartındaki mesajı kullanılır
  // (yoksa resultScreens, o da yoksa dil sözlüğü). Böylece "Doğru yanıt"/"Yanlış yanıt"
  // metinleri seçim & sürükle-bırak sonucunda gerçekten görünür.
  const answerFeedbackMessages = activity.answerFeedback || {};
  const correctBody =
    answerFeedbackMessages.correctMessage || activity.resultScreens?.successBody || tx.correctBody;
  const incorrectBody =
    answerFeedbackMessages.incorrectMessage ||
    activity.resultScreens?.failureBody ||
    tx.incorrectBody;

  if (correctLayerId) {
    pushResultHeaderTemplate({
      layerId: correctLayerId,
      status: 'success',
      title: tx.correctTitle,
      body: correctBody,
      buttons: [
        {
          label: tx.complete,
          tone: 'success',
          icon: themeIcons.complete || '✓',
          width: 240,
          runtimeAction: launchSlideId ? '' : 'complete',
          trigger: launchSlideId ? { action: 'SliderGec', value: launchSlideId } : null,
        },
        {
          label: tx.retry,
          tone: 'danger',
          icon: themeIcons.restart || '↻',
          width: 240,
          runtimeAction: 'restart',
          // restart base layer'a döner; navigasyon tetikleyicisi yok.
          trigger: null,
        },
      ],
    });
  }
  if (incorrectLayerId) {
    pushResultHeaderTemplate({
      layerId: incorrectLayerId,
      status: 'failure',
      title: tx.incorrectTitle,
      body: incorrectBody,
      buttons: [
        {
          label: tx.solution,
          tone: 'success',
          icon: '✎',
          width: 250,
          runtimeAction: answerLayerId ? '' : 'show-answer',
          trigger: answerLayerId ? { action: 'KatmanaGec', value: answerLayerId } : null,
        },
        {
          label: tx.restart,
          tone: 'danger',
          icon: themeIcons.restart || '↻',
          width: 250,
          // restart base layer'a döner; navigasyon tetikleyicisi yok.
          runtimeAction: 'restart',
          trigger: null,
        },
      ],
    });
  }
  if (menuLayerId) pushMenuPopupTemplate(menuLayerId);
  if (normalLayerId) pushNormalPopupTemplate(normalLayerId);
  if (answerLayerId) pushRetryAnswerTemplate(answerLayerId);

  const allTriggers = [...remainingTriggers, ...generatedTriggers];
  const hasOnClickTrigger = (targetId = '') =>
    allTriggers.some((item) => (item?.when || 'onClick') === 'onClick' && item?.target === targetId);
  const manualClickTargets = new Set(
    remainingTriggers
      .filter((item) => (item?.when || 'onClick') === 'onClick')
      .map((item) => item?.target)
      .filter(Boolean)
  );
  const isCloseLikeButton = (object = {}) => {
    const labelRaw = String(object?.label || object?.text || '').trim();
    if (['×', 'x', 'X', '✕', '✖'].includes(labelRaw)) return true;
    const key = normalizeRuntimeActionLabel(labelRaw);
    return key.includes('kapat') || key.includes('close') || key.includes('geri');
  };
  const layerDefaultRuntimeAction = (layerId = '') => {
    if (layerId === correctLayerId) return 'complete';
    if (layerId === incorrectLayerId) return 'show-answer';
    if (layerId === answerLayerId) return 'restart';
    if (layerId === menuLayerId) return 'help';
    return '';
  };
  const mergedObjects = [...remainingObjects, ...generated].map((object) => {
    if (object?.type !== 'button') return object;
    if (object.decorativeButton) return object;
    const layerId = object.layerId || 'base';
    if (!targetLayerIds.includes(layerId)) return object;
    if (manualClickTargets.has(object.id)) return object;
    if (hasOnClickTrigger(object.id)) return object;
    const action = String(object.runtimeAction || '').trim().toLowerCase();
    if (action && !['none', 'off', 'disabled', 'decorative', 'demo'].includes(action)) return object;
    if (isCloseLikeButton(object) || layerId === normalLayerId) {
      generatedTriggers.push({
        ...createTriggerItem(generatedTriggers.length),
        when: 'onClick',
        target: object.id,
        action: 'KatmanaGec',
        value: 'base',
        name: `${workingLayerNames[layerId] || 'Katman'} kapat`,
        generatedBy: 'answer-template',
      });
      return object;
    }
    const autoRuntimeAction = layerDefaultRuntimeAction(layerId);
    return autoRuntimeAction ? { ...object, runtimeAction: autoRuntimeAction } : object;
  });

  const normalizedSceneSet = normalizeButtonPairLayoutForActivity({
    ...activity,
    objects: mergedObjects,
  });
  return {
    objects: normalizedSceneSet.objects || mergedObjects,
    triggers: [...remainingTriggers, ...generatedTriggers],
  };
}

export function generateLegacyAnswerSceneSet(activity = {}, options = {}) {
  const layers = Array.isArray(activity.layers) && activity.layers.length
    ? activity.layers
    : [createLayer('', 0, { kind: 'base' })];
  const resolvedLayerNames = buildResolvedLayerNameMap(layers, activity);
  const existingLayerNameKeys = new Set(
    layers.map((layer) => normalizeLayerNameKey(resolvedLayerNames[layer.id] || layer.name || ''))
  );
  const missingLayers = requiredLayerNames
    .filter((name) => !existingLayerNameKeys.has(normalizeLayerNameKey(name)))
    .map((name, index) => createLayer(name, layers.length + index + 1, { autoName: false }));
  const workingLayers = missingLayers.length ? [...layers, ...missingLayers] : layers;
  const workingLayerNames = buildResolvedLayerNameMap(workingLayers, activity);
  const getLayerIdByKey = (key) =>
    workingLayers.find(
      (layer) => normalizeLayerNameKey(workingLayerNames[layer.id] || layer.name || '') === key
    )?.id || null;
  const targetLayerIds = ['menu', 'normal', 'correct', 'incorrect', 'cevap']
    .map(getLayerIdByKey)
    .filter(Boolean);
  const existingGeneratedTemplates = (activity.objects || []).filter(
    (item) => targetLayerIds.includes(item.layerId || 'base') && isGeneratedAnswerTemplateObject(item)
  );
  const shouldConfirm = options.confirmExisting !== false && existingGeneratedTemplates.length;
  if (
    shouldConfirm &&
    typeof window !== 'undefined' &&
    !window.confirm(
      `${existingGeneratedTemplates.length} otomatik cevap şablonu yeniden oluşturulacak. Elle düzenlediğiniz şablon nesneleri artık korunur; yine de otomatik kalan eski şablonlar yenilensin mi?`
    )
  ) {
    return activity;
  }

  const generated = buildAnswerSceneObjects(
    { ...activity, layers: workingLayers },
    workingLayers,
    workingLayerNames
  );
  const nextObjects = generated.objects;
  return {
    ...activity,
    layers: workingLayers,
    objects: nextObjects,
    triggers: generated.triggers,
    activeLayerId: getLayerIdByKey('cevap') || activity.activeLayerId || 'base',
    timeline: syncTimelineWithObjects({ ...activity, objects: nextObjects }),
  };
}
