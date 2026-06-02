import { ANSWER_LAYER_STYLE_PRESETS } from '../constants';
import { contrastSafeButtonStyle, ensureTtkbButtonTextContrast } from '../editor-logic/colorUtils';
import { uid } from '../utils/editorHelpers';
import {
  isGeneratedAnswerTemplateObject,
  normalizeRuntimeActionLabel,
} from '../utils/storylineRuntime';

import {
  createObjectFromActivity,
  createTriggerItem,
  isGeneratedSceneTemplateObject,
} from './activityFactory';
import {
  getAnswerLayerStylePresetById,
  getPresetButtonShapeStyle,
  getLayerActionButtonStyle,
} from './buttonStyling';
import { contentText, getActivityContentLanguage } from './contentLanguage';
import { syncTimelineWithObjects } from './timeline';

const DEFAULT_ANSWER_LAYER_STYLE_PRESET_ID = ANSWER_LAYER_STYLE_PRESETS[0]?.id || 'aurora-glass';
const SCENE_TEMPLATE_VERSION = 14;
const SCENE_TEMPLATE_BUTTON_INTRO_ID = 'button-intro';
const SCENE_TEMPLATE_LAUNCH_PAGE_ID = 'launch-page';
const SCENE_TEMPLATE_OPTIONS = [
  { value: '', label: 'Serbest Sahne' },
  { value: SCENE_TEMPLATE_LAUNCH_PAGE_ID, label: 'Etkinlik Giriş Sayfası' },
  { value: SCENE_TEMPLATE_BUTTON_INTRO_ID, label: 'Buton Tanıtım Sayfası' },
];
const DEFAULT_BOOK_LAYER_PRESET_NAME = 'triger son';
const EDUCATION_BUTTON_TEXT_SIZE = 24;
const EDUCATION_BUTTON_TEXT_SIZE_LARGE = 26;
const EDUCATION_BUTTON_TEXT_SIZE_SMALL = 18;
const EDUCATION_BUTTON_ICON_SIZE = 28;
const EDUCATION_BUTTON_ICON_SIZE_LARGE = 30;

function isButtonIntroDemoButton(item = {}) {
  return (
    item?.generatedBy === 'scene-template' &&
    item?.sceneTemplateId === SCENE_TEMPLATE_BUTTON_INTRO_ID &&
    item?.type === 'button' &&
    item?.sceneTemplateDemoButton !== false
  );
}
function buildButtonIntroSceneTemplateObjects(
  activity = {},
  presetId = DEFAULT_ANSWER_LAYER_STYLE_PRESET_ID
) {
  const preset =
    getAnswerLayerStylePresetById(presetId) ||
    getAnswerLayerStylePresetById(DEFAULT_ANSWER_LAYER_STYLE_PRESET_ID);
  const tx = contentText(activity);
  const stageWidth = Number(activity.stageWidth || 1920) || 1920;
  const stageHeight = Number(activity.stageHeight || 1080) || 1080;
  const sx = stageWidth / 1920;
  const sy = stageHeight / 1080;
  const u = (value, axis = 'x') => Math.round(value * (axis === 'y' ? sy : sx));
  const objects = [];
  const themeIcons = preset?.icons || {};
  const panelRadius = Number(preset?.panelRadius || 20);
  const buttonRadius = Number(preset?.buttonRadius || 14);
  const surface = preset?.surface || 'rgba(255,255,255,.98)';
  const surfaceAlt = preset?.surfaceAlt || 'rgba(248,250,252,.96)';
  const surfaceBorder = preset?.surfaceBorder || '#d9e2ec';
  const surfaceShadow = preset?.surfaceShadow || '0 24px 52px rgba(15,23,42,.12)';
  const insetShadow = preset?.insetShadow || 'inset 0 1px 0 rgba(255,255,255,.86)';
  const accentGradient =
    preset?.accentGradient || 'linear-gradient(135deg,#4f46e5 0%,#22d3ee 100%)';
  const accentBorder = preset?.accentBorder || 'rgba(79,70,229,.3)';
  const accentText = preset?.accentText || '#ffffff';
  const neutralGradient =
    preset?.neutralGradient || 'linear-gradient(180deg,#7dd3fc 0%,#0ea5e9 52%,#0369a1 100%)';
  const neutralBorder = preset?.neutralBorder || 'rgba(15,23,42,.18)';
  const successGradient =
    preset?.successGradient || 'linear-gradient(135deg,#22c55e 0%,#16a34a 100%)';
  const successBorder = preset?.successBorder || 'rgba(22,163,74,.28)';
  const successText = preset?.successText || '#ffffff';
  const dangerGradient =
    preset?.dangerGradient || 'linear-gradient(135deg,#ef4444 0%,#dc2626 100%)';
  const dangerBorder = preset?.dangerBorder || 'rgba(220,38,38,.28)';
  const dangerText = preset?.dangerText || '#ffffff';
  const titleColor = preset?.titleColor || '#0f172a';
  const bodyColor = preset?.bodyColor || '#475569';
  const motion = preset?.motion || {};
  const hoverShadow = motion.hoverShadow || '0 20px 36px rgba(15,23,42,.18)';
  const templateId = SCENE_TEMPLATE_BUTTON_INTRO_ID;
  let zIndexCursor = 0;
  let introCloseButton = null;
  let introStartButton = null;
  let introStartIconButton = null;

  const pushObject = (type, patch = {}) => {
    const base = createObjectFromActivity(activity, type);
    zIndexCursor += 1;
    const nextObject = {
      ...base,
      ...patch,
      id: uid(),
      layerId: patch.layerId || 'base',
      generatedBy: 'scene-template',
      sceneTemplateId: templateId,
      sceneTemplateSlotId: patch.sceneTemplateSlotId || `${templateId}:slot-${zIndexCursor}`,
      sceneTemplateVersion: SCENE_TEMPLATE_VERSION,
      locked: false,
      zIndex: zIndexCursor,
    };
    objects.push(nextObject);
    return nextObject;
  };
  const pushShape = (patch = {}) =>
    pushObject('shape', {
      shapeKind: patch.shapeKind || 'roundedRect',
      label: patch.label || '',
      showShapeLabel: patch.showShapeLabel === true,
      ...patch,
      style: {
        background: '#ffffff',
        borderColor: 'transparent',
        borderWidth: 0,
        color: 'transparent',
        ...(patch.style || {}),
      },
    });
  const pushText = (label, x, y, width, height, style = {}) => {
    const fontSize = Number(style.fontSize || u(22, 'y'));
    return pushObject('text', {
      label,
      x,
      y,
      width,
      height: Math.max(Number(height) || 1, Math.ceil(fontSize * 1.35)),
      style: {
        background: 'transparent',
        borderColor: 'transparent',
        borderWidth: 0,
        boxShadow: 'none',
        color: titleColor,
        fontSize: u(22, 'y'),
        fontWeight: 700,
        textAlign: 'center',
        lineHeight: 1.35,
        ...(style || {}),
      },
    });
  };
  const pushNote = (label, x, y, width, height, style = {}) =>
    pushObject('text', {
      label,
      x,
      y,
      width,
      height,
      style: {
        background: surface,
        borderColor: '#8fd3ff',
        borderWidth: 1,
        borderRadius: Math.max(12, panelRadius - 6),
        color: bodyColor,
        fontSize: u(16, 'y'),
        fontWeight: 700,
        textAlign: 'center',
        boxShadow: `0 10px 20px rgba(15,23,42,.07), ${insetShadow}`,
        ...(style || {}),
      },
    });
  const pushConnector = (label, x, y, width, height, style = {}) =>
    pushText(label, x, y, width, height, {
      color: '#38bdf8',
      fontSize: u(26, 'y'),
      fontWeight: 900,
      textAlign: 'center',
      ...(style || {}),
    });
  const pushButton = (label, x, y, width, height, tone = 'accent', extra = {}) => {
    const rawShapeStyle = extra.forceLayerActionStyle
      ? getLayerActionButtonStyle(preset, tone)
      : getPresetButtonShapeStyle(preset, tone);
    const shapeStyle = contrastSafeButtonStyle(rawShapeStyle);
    const palette = {
      accent: {
        background: accentGradient,
        borderColor: accentBorder,
        color: accentText,
        shadow: hoverShadow,
      },
      primary: {
        background: accentGradient,
        borderColor: accentBorder,
        color: accentText,
        shadow: hoverShadow,
      },
      info: {
        background: getPresetButtonShapeStyle(preset, 'info').background || accentGradient,
        borderColor: accentBorder,
        color: accentText,
        shadow: hoverShadow,
      },
      warning: {
        background: getPresetButtonShapeStyle(preset, 'warning').background || accentGradient,
        borderColor: accentBorder,
        color: accentText,
        shadow: hoverShadow,
      },
      neutral: {
        background: neutralGradient,
        borderColor: neutralBorder,
        color: '#ffffff',
        shadow: hoverShadow,
      },
      success: {
        background: successGradient,
        borderColor: successBorder,
        color: successText,
        shadow: hoverShadow,
      },
      danger: {
        background: dangerGradient,
        borderColor: dangerBorder,
        color: dangerText,
        shadow: hoverShadow,
      },
      soft: {
        background: surfaceAlt,
        borderColor: surfaceBorder,
        color: titleColor,
        shadow: `0 12px 24px rgba(15,23,42,.08), ${insetShadow}`,
      },
    }[tone] || {
      background: accentGradient,
      borderColor: accentBorder,
      color: accentText,
      shadow: hoverShadow,
    };

    const labelText = String(label || '').trim();
    const isIconOnly =
      labelText.length <= 2 &&
      Math.abs(Number(width) - Number(height)) <=
        Math.max(18, Math.min(Number(width) || 1, Number(height) || 1) * 0.45);
    const requestedFontSize = Number(extra.fontSize);
    const normalizedFontSize = isIconOnly
      ? Math.min(EDUCATION_BUTTON_ICON_SIZE_LARGE, requestedFontSize || EDUCATION_BUTTON_ICON_SIZE)
      : Math.min(
          EDUCATION_BUTTON_TEXT_SIZE_LARGE,
          Math.max(
            EDUCATION_BUTTON_TEXT_SIZE_SMALL,
            requestedFontSize || EDUCATION_BUTTON_TEXT_SIZE
          )
        );
    return pushObject('button', {
      label,
      x,
      y,
      width,
      height,
      sceneTemplateDemoButton: extra.demoInteractive !== false,
      ...(extra.forceSceneTemplateLayout ? { forceSceneTemplateLayout: true } : {}),
      ...(extra.sceneTemplateSlotId ? { sceneTemplateSlotId: extra.sceneTemplateSlotId } : {}),
      ...(extra.runtimeAction ? { runtimeAction: extra.runtimeAction } : {}),
      ...(extra.sceneTemplateDemoAction
        ? { sceneTemplateDemoAction: extra.sceneTemplateDemoAction }
        : {}),
      ...(extra.soundOnLabel ? { soundOnLabel: extra.soundOnLabel } : {}),
      ...(extra.soundOffLabel ? { soundOffLabel: extra.soundOffLabel } : {}),
      ...(extra.soundOnIcon ? { soundOnIcon: extra.soundOnIcon } : {}),
      ...(extra.soundOffIcon ? { soundOffIcon: extra.soundOffIcon } : {}),
      ...(extra.soundIconMode ? { soundIconMode: extra.soundIconMode } : {}),
      ...(Object.prototype.hasOwnProperty.call(extra, 'playLabel')
        ? { playLabel: extra.playLabel }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(extra, 'pauseLabel')
        ? { pauseLabel: extra.pauseLabel }
        : {}),
      ...(extra.playIcon ? { playIcon: extra.playIcon } : {}),
      ...(extra.pauseIcon ? { pauseIcon: extra.pauseIcon } : {}),
      ...(motion ? { buttonMotion: { ...motion } } : {}),
      style: {
        background: shapeStyle.background || palette.background,
        borderColor: shapeStyle.borderColor || palette.borderColor,
        borderWidth: shapeStyle.borderWidth ?? 1,
        borderRadius: Number(extra.buttonRadius ?? shapeStyle.borderRadius ?? buttonRadius),
        color: shapeStyle.color || palette.color,
        fontSize: u(normalizedFontSize, 'y'),
        fontWeight: 900,
        textAlign: 'center',
        textShadow: shapeStyle.textShadow || '0 1px 0 rgba(0,0,0,.18)',
        boxShadow: shapeStyle.boxShadow || palette.shadow,
        ...(extra.style || {}),
      },
    });
  };
  const pushMenuStyleButtonPair = (item, x, y, slotPrefix, options = {}) => {
    const rowGroup = `${templateId}:${slotPrefix}:hover`;
    const btnHeight = options.height || u(58, 'y');
    const iconWidth = options.iconWidth || u(94);
    const iconLabelGap = options.iconLabelGap ?? u(12);
    const labelOffset = options.labelOffset || iconWidth + iconLabelGap;
    const pairIcon = getButtonPairSemanticIcon(
      { label: item.icon, runtimeAction: item.action, soundOffIcon: item.soundOffIcon },
      { label: item.label, runtimeAction: item.action }
    );
    const iconButton = pushButton(pairIcon, x, y, iconWidth, btnHeight, item.tone, {
      sceneTemplateSlotId: `${templateId}:${slotPrefix}-icon`,
      fontSize: options.iconFontSize || EDUCATION_BUTTON_ICON_SIZE,
      runtimeAction: 'none',
      forceLayerActionStyle: true,
      ...(item.action === 'toggle-mute'
        ? {
            sceneTemplateDemoAction: 'toggle-mute',
            soundOnLabel: tx.soundOn,
            soundOffLabel: tx.soundOff,
            soundOnIcon: '🔇',
            soundOffIcon: '🔊',
            soundIconMode: 'icon-only',
          }
        : {}),
      style: {
        padding: 0,
        lineHeight: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        whiteSpace: 'nowrap',
        borderRadius: Number(options.iconRadius ?? 999),
      },
    });
    const labelButton = pushButton(
      item.label,
      x + labelOffset,
      y,
      options.labelWidth || u(286),
      btnHeight,
      item.tone,
      {
        sceneTemplateSlotId: `${templateId}:${slotPrefix}-label`,
        fontSize: options.fontSize || EDUCATION_BUTTON_TEXT_SIZE_SMALL,
        runtimeAction: 'none',
        forceLayerActionStyle: true,
        ...(item.action === 'toggle-mute'
          ? {
              sceneTemplateDemoAction: 'toggle-mute',
              soundOnLabel: tx.soundOn,
              soundOffLabel: tx.soundOff,
              soundOnIcon: '🔇',
              soundOffIcon: '🔊',
              soundIconMode: 'external',
            }
          : {}),
      }
    );
    iconButton.linkedHoverGroup = rowGroup;
    labelButton.linkedHoverGroup = rowGroup;
    iconButton.linkedActionTargetId = labelButton.id;
    labelButton.linkedActionTargetId = labelButton.id;
    return { iconButton, labelButton };
  };

  pushShape({
    x: u(84),
    y: u(82, 'y'),
    width: stageWidth - u(168),
    height: stageHeight - u(164, 'y'),
    style: {
      background: surface,
      borderColor: surfaceBorder,
      borderWidth: 1,
      borderRadius: panelRadius + 8,
      boxShadow: `${surfaceShadow}, ${insetShadow}`,
    },
  });
  pushText('', u(610), u(104, 'y'), u(700), u(1, 'y'), {
    color: titleColor,
    fontSize: u(1, 'y'),
    fontWeight: 900,
  });
  pushText('', u(500), u(150, 'y'), u(920), u(1, 'y'), {
    color: bodyColor,
    fontSize: u(1, 'y'),
    fontWeight: 700,
  });

  pushMenuStyleButtonPair(
    { icon: themeIcons.check || '✓', label: tx.check, tone: 'accent', action: '' },
    u(106),
    u(108, 'y'),
    'check-demo',
    {
      height: u(64, 'y'),
      iconWidth: u(70),
      labelOffset: u(82),
      labelWidth: u(382),
      fontSize: EDUCATION_BUTTON_TEXT_SIZE,
    }
  );
  pushNote(tx.checkNote, u(96), u(196, 'y'), u(470), u(92, 'y'));
  pushConnector('↓', u(306), u(172, 'y'), u(36), u(24, 'y'));

  pushMenuStyleButtonPair(
    { icon: themeIcons.prev || '≪', label: tx.prev, tone: 'accent', action: '' },
    u(620),
    u(102, 'y'),
    'prev-demo',
    {
      height: u(66, 'y'),
      iconWidth: u(72),
      labelOffset: u(84),
      labelWidth: u(310),
      fontSize: EDUCATION_BUTTON_TEXT_SIZE,
    }
  );
  pushNote(tx.prevNote, u(610), u(196, 'y'), u(380), u(58, 'y'));
  pushConnector('↓', u(780), u(170, 'y'), u(32), u(24, 'y'));

  pushMenuStyleButtonPair(
    { icon: themeIcons.next || '≫', label: tx.next, tone: 'accent', action: '' },
    u(1060),
    u(102, 'y'),
    'next-demo',
    {
      height: u(66, 'y'),
      iconWidth: u(72),
      labelOffset: u(84),
      labelWidth: u(310),
      fontSize: EDUCATION_BUTTON_TEXT_SIZE,
    }
  );
  pushNote(tx.nextNote, u(1050), u(196, 'y'), u(380), u(58, 'y'));
  pushConnector('↓', u(1220), u(170, 'y'), u(32), u(24, 'y'));

  introCloseButton = pushButton(
    themeIcons.close || '×',
    stageWidth - u(210),
    u(96, 'y'),
    u(82),
    u(82, 'y'),
    'danger',
    {
      sceneTemplateSlotId: `${templateId}:close-button`,
      buttonRadius: 999,
      fontSize: EDUCATION_BUTTON_ICON_SIZE_LARGE,
    }
  );
  pushNote(tx.closeNote, stageWidth - u(350), u(196, 'y'), u(260), u(58, 'y'));

  introStartButton = pushButton(tx.start, u(700), u(356, 'y'), u(570), u(92, 'y'), 'accent', {
    sceneTemplateSlotId: `${templateId}:start-button`,
    fontSize: EDUCATION_BUTTON_TEXT_SIZE_LARGE,
    style: {
      paddingLeft: 0,
    },
  });
  introStartButton.linkedHoverGroup = `${templateId}:start:hover`;
  introStartIconButton = pushButton('▶', u(594), u(356, 'y'), u(92), u(92, 'y'), 'accent', {
    sceneTemplateSlotId: `${templateId}:start-icon`,
    forceSceneTemplateLayout: true,
    fontSize: EDUCATION_BUTTON_ICON_SIZE_LARGE,
    buttonRadius: 999,
    style: {
      padding: 0,
      lineHeight: 1,
      borderRadius: 999,
    },
  });
  introStartIconButton.linkedHoverGroup = `${templateId}:start:hover`;
  introStartButton.linkedActionTargetId = introStartButton.id;
  introStartIconButton.linkedActionTargetId = introStartButton.id;
  pushNote(tx.startNote, u(650), u(510, 'y'), u(620), u(62, 'y'));
  pushConnector('↓', u(944), u(448, 'y'), u(32), u(56, 'y'));

  const leftButtons = [
    {
      icon: themeIcons.guide || '?',
      label: tx.guideLabel,
      note: tx.guideNote,
      tone: 'info',
      action: 'show-help',
    },
    {
      icon: themeIcons.restart || '↻',
      label: tx.restart,
      note: tx.restartNote,
      tone: 'warning',
      action: 'restart',
    },
    { icon: '🔊', label: tx.soundOff, note: tx.muteNote, tone: 'neutral', action: 'toggle-mute' },
    {
      icon: themeIcons.home || '⌂',
      label: tx.home,
      note: tx.homeNote,
      tone: 'primary',
      action: 'home',
    },
  ];
  leftButtons.forEach((item, index) => {
    const y = u(610 + index * 94, 'y');
    pushMenuStyleButtonPair(item, u(96), y, `menu-demo-${index}`);
    pushNote(item.note, u(548), y + u(4, 'y'), u(340), u(50, 'y'), {
      textAlign: 'center',
      padding: u(14),
      fontSize: u(15, 'y'),
    });
    pushConnector('←', u(510), y + u(9, 'y'), u(28), u(40, 'y'));
  });

  pushMenuStyleButtonPair(
    { icon: '☰', label: tx.menu, tone: 'primary', action: '' },
    u(128),
    u(400, 'y'),
    'main-menu-demo',
    { labelWidth: u(206), fontSize: EDUCATION_BUTTON_TEXT_SIZE_SMALL }
  );
  pushNote(tx.menuNote, u(134), u(316, 'y'), u(320), u(54, 'y'));
  pushConnector('↓', u(280), u(370, 'y'), u(32), u(24, 'y'));

  pushNote(tx.playPauseNote, stageWidth - u(555), u(316, 'y'), u(430), u(54, 'y'), {
    textAlign: 'center',
    padding: u(14),
    fontSize: u(15, 'y'),
  });
  pushConnector('↓', stageWidth - u(354), u(370, 'y'), u(28), u(26, 'y'));
  pushButton(`▶\n⏸⏸`, stageWidth - u(389), u(404, 'y'), u(92), u(92, 'y'), 'warning', {
    fontSize: EDUCATION_BUTTON_ICON_SIZE_LARGE,
    runtimeAction: 'none',
    forceSceneTemplateLayout: true,
    sceneTemplateDemoAction: 'toggle-play-pause',
    playLabel: '',
    pauseLabel: '',
    playIcon: '▶',
    pauseIcon: '⏸⏸',
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 999,
      lineHeight: 1.05,
      whiteSpace: 'pre-line',
    },
  });

  const rightButtons = [
    {
      icon: themeIcons.complete || '✓',
      label: tx.complete,
      note: tx.completeNote,
      tone: 'success',
      action: 'complete',
    },
    {
      icon: themeIcons.restart || '↻',
      label: tx.retry,
      note: tx.retryNote,
      tone: 'danger',
      action: 'restart',
    },
    { icon: '✎', label: tx.solution, note: tx.answerNote, tone: 'success', action: 'show-answer' },
    {
      icon: themeIcons.restart || '↻',
      label: tx.restart,
      note: tx.restartNote,
      tone: 'danger',
      action: 'restart',
    },
  ];
  rightButtons.forEach((item, index) => {
    const y = u(610 + index * 94, 'y');
    pushNote(item.note, stageWidth - u(930), y + u(4, 'y'), u(340), u(50, 'y'), {
      textAlign: 'center',
      padding: u(14),
      fontSize: u(15, 'y'),
    });
    pushConnector('→', stageWidth - u(580), y + u(9, 'y'), u(28), u(40, 'y'));
    pushMenuStyleButtonPair(item, stageWidth - u(540), y, `right-${index}`, {
      height: u(58, 'y'),
      iconWidth: u(66),
      labelOffset: u(78),
      labelWidth: u(372),
      fontSize: EDUCATION_BUTTON_TEXT_SIZE_SMALL,
    });
  });

  const createTemplateTrigger = (index, target, value, name) => ({
    ...createTriggerItem(index),
    when: 'onClick',
    target,
    action: 'SliderGec',
    value,
    name,
    generatedBy: 'scene-template',
    sceneTemplateId: templateId,
    sceneTemplateVersion: SCENE_TEMPLATE_VERSION,
  });
  const triggers = [
    introStartButton ? createTemplateTrigger(0, introStartButton.id, '__next__', tx.start) : null,
    introStartIconButton
      ? createTemplateTrigger(1, introStartIconButton.id, '__next__', tx.start)
      : null,
    introCloseButton
      ? createTemplateTrigger(2, introCloseButton.id, '__next__', 'Tanıtımı kapat')
      : null,
  ].filter(Boolean);

  return { objects, triggers };
}

function buildLaunchPageSceneTemplate(
  activity = {},
  presetId = DEFAULT_ANSWER_LAYER_STYLE_PRESET_ID
) {
  const preset =
    getAnswerLayerStylePresetById(presetId) ||
    getAnswerLayerStylePresetById(DEFAULT_ANSWER_LAYER_STYLE_PRESET_ID);
  const tx = contentText(activity);
  const stageWidth = Number(activity.stageWidth || 1920) || 1920;
  const stageHeight = Number(activity.stageHeight || 1080) || 1080;
  const sx = stageWidth / 1920;
  const sy = stageHeight / 1080;
  const u = (value, axis = 'x') => Math.round(value * (axis === 'y' ? sy : sx));
  const objects = [];
  const themeIcons = preset?.icons || {};
  const panelRadius = Number(preset?.panelRadius || 20);
  const buttonRadius = Number(preset?.buttonRadius || 16);
  const surface = preset?.surface || 'rgba(255,255,255,.98)';
  const surfaceAlt = preset?.surfaceAlt || 'rgba(248,250,252,.98)';
  const surfaceBorder = preset?.surfaceBorder || '#dbe7f5';
  const surfaceShadow = preset?.surfaceShadow || '0 26px 58px rgba(15,23,42,.16)';
  const insetShadow = preset?.insetShadow || 'inset 0 1px 0 rgba(255,255,255,.88)';
  const accentGradient =
    preset?.accentGradient || 'linear-gradient(135deg,#f43f5e 0%,#e11d48 100%)';
  const accentBorder = preset?.accentBorder || 'rgba(225,29,72,.32)';
  const accentText = preset?.accentText || '#ffffff';
  const neutralGradient =
    preset?.neutralGradient || 'linear-gradient(180deg,#0f172a 0%,#1e293b 100%)';
  const neutralBorder = preset?.neutralBorder || 'rgba(15,23,42,.2)';
  const successGradient =
    preset?.successGradient || 'linear-gradient(135deg,#22c55e 0%,#16a34a 100%)';
  const successBorder = preset?.successBorder || 'rgba(22,163,74,.28)';
  const successText = preset?.successText || '#ffffff';
  const dangerGradient =
    preset?.dangerGradient || 'linear-gradient(135deg,#ef4444 0%,#dc2626 100%)';
  const dangerBorder = preset?.dangerBorder || 'rgba(220,38,38,.28)';
  const dangerText = preset?.dangerText || '#ffffff';
  const titleColor = preset?.titleColor || '#0f172a';
  const bodyColor = preset?.bodyColor || '#475569';
  const motion = preset?.motion || {};
  const hoverShadow = motion.hoverShadow || '0 20px 38px rgba(15,23,42,.18)';
  let zIndexCursor = 0;

  const pushObject = (type, patch = {}) => {
    const base = createObjectFromActivity(activity, type);
    zIndexCursor += 1;
    const nextObject = {
      ...base,
      ...patch,
      id: uid(),
      layerId: patch.layerId || 'base',
      generatedBy: 'scene-template',
      sceneTemplateId: SCENE_TEMPLATE_LAUNCH_PAGE_ID,
      sceneTemplateSlotId:
        patch.sceneTemplateSlotId || `${SCENE_TEMPLATE_LAUNCH_PAGE_ID}:slot-${zIndexCursor}`,
      sceneTemplateVersion: SCENE_TEMPLATE_VERSION,
      locked: false,
      zIndex: zIndexCursor,
    };
    objects.push(nextObject);
    return nextObject;
  };
  const pushShape = (patch = {}) =>
    pushObject('shape', {
      shapeKind: patch.shapeKind || 'roundedRect',
      label: patch.label || '',
      showShapeLabel: patch.showShapeLabel === true,
      ...patch,
      style: {
        background: '#ffffff',
        borderColor: 'transparent',
        borderWidth: 0,
        color: 'transparent',
        ...(patch.style || {}),
      },
    });
  const pushText = (label, x, y, width, height, style = {}) => {
    const fontSize = Number(style.fontSize || u(22, 'y'));
    return pushObject('text', {
      label,
      x,
      y,
      width,
      height: Math.max(Number(height) || 1, Math.ceil(fontSize * 1.32)),
      style: {
        background: 'transparent',
        borderColor: 'transparent',
        borderWidth: 0,
        boxShadow: 'none',
        color: titleColor,
        fontSize: u(22, 'y'),
        fontWeight: 800,
        textAlign: 'center',
        lineHeight: 1.25,
        ...(style || {}),
      },
    });
  };
  const pushButton = (label, x, y, width, height, tone = 'accent', extra = {}) => {
    const shapeStyle = contrastSafeButtonStyle(getPresetButtonShapeStyle(preset, tone));
    const palette = {
      accent: {
        background: accentGradient,
        borderColor: accentBorder,
        color: accentText,
        shadow: hoverShadow,
      },
      primary: {
        background: accentGradient,
        borderColor: accentBorder,
        color: accentText,
        shadow: hoverShadow,
      },
      info: {
        background: getPresetButtonShapeStyle(preset, 'info').background || accentGradient,
        borderColor: accentBorder,
        color: accentText,
        shadow: hoverShadow,
      },
      warning: {
        background: getPresetButtonShapeStyle(preset, 'warning').background || accentGradient,
        borderColor: accentBorder,
        color: accentText,
        shadow: hoverShadow,
      },
      neutral: {
        background: neutralGradient,
        borderColor: neutralBorder,
        color: '#ffffff',
        shadow: hoverShadow,
      },
      success: {
        background: successGradient,
        borderColor: successBorder,
        color: successText,
        shadow: hoverShadow,
      },
      danger: {
        background: dangerGradient,
        borderColor: dangerBorder,
        color: dangerText,
        shadow: hoverShadow,
      },
      soft: {
        background: surface,
        borderColor: surfaceBorder,
        color: titleColor,
        shadow: `0 16px 30px rgba(15,23,42,.12), ${insetShadow}`,
      },
    }[tone] || {
      background: accentGradient,
      borderColor: accentBorder,
      color: accentText,
      shadow: hoverShadow,
    };
    const labelText = String(label || '').trim();
    const isIconOnly =
      labelText.length <= 2 &&
      Math.abs(Number(width) - Number(height)) <=
        Math.max(18, Math.min(Number(width) || 1, Number(height) || 1) * 0.45);
    const requestedFontSize = Number(extra.fontSize);
    const normalizedFontSize = isIconOnly
      ? Math.min(EDUCATION_BUTTON_ICON_SIZE_LARGE, requestedFontSize || EDUCATION_BUTTON_ICON_SIZE)
      : Math.min(
          EDUCATION_BUTTON_TEXT_SIZE_LARGE,
          Math.max(
            EDUCATION_BUTTON_TEXT_SIZE_SMALL,
            requestedFontSize || EDUCATION_BUTTON_TEXT_SIZE
          )
        );
    return pushObject('button', {
      label,
      x,
      y,
      width,
      height,
      ...(extra.sceneTemplateSlotId ? { sceneTemplateSlotId: extra.sceneTemplateSlotId } : {}),
      ...(extra.forceSceneTemplateLayout ? { forceSceneTemplateLayout: true } : {}),
      ...(extra.runtimeAction ? { runtimeAction: extra.runtimeAction } : {}),
      ...(extra.soundOnLabel ? { soundOnLabel: extra.soundOnLabel } : {}),
      ...(extra.soundOffLabel ? { soundOffLabel: extra.soundOffLabel } : {}),
      ...(extra.soundOnIcon ? { soundOnIcon: extra.soundOnIcon } : {}),
      ...(extra.soundOffIcon ? { soundOffIcon: extra.soundOffIcon } : {}),
      ...(motion ? { buttonMotion: { ...motion } } : {}),
      style: {
        background: shapeStyle.background || palette.background,
        borderColor: shapeStyle.borderColor || palette.borderColor,
        borderWidth: shapeStyle.borderWidth ?? 1,
        borderRadius: Number(extra.buttonRadius ?? shapeStyle.borderRadius ?? buttonRadius),
        color: shapeStyle.color || palette.color,
        fontSize: u(normalizedFontSize, 'y'),
        fontWeight: 900,
        textAlign: 'center',
        textShadow: shapeStyle.textShadow || '0 1px 0 rgba(0,0,0,.18)',
        boxShadow: shapeStyle.boxShadow || palette.shadow,
        ...(extra.style || {}),
      },
    });
  };

  const introButtonTargets = [];
  const startButtonTargets = [];
  const stripLeadingButtonIcon = (label) =>
    String(label || '')
      .replace(/^[▶?iℹ☰✓★→←↻↺\s]+/u, '')
      .trim();
  const createLinkedButtonIcon = (button, icon, slotSuffix, options = {}) => {
    const size = Number(
      options.size || Math.min(Math.max(Number(button.height || 0) * 1.08, u(58, 'y')), u(96, 'y'))
    );
    const group = `${SCENE_TEMPLATE_LAUNCH_PAGE_ID}:${slotSuffix}:hover`;
    const iconOffsetX = Number.isFinite(Number(options.offsetX))
      ? Number(options.offsetX)
      : Math.round(size * (40 / 92));
    const iconOffsetY = Number.isFinite(Number(options.offsetY))
      ? Number(options.offsetY)
      : Math.round(((Number(button.height) || size) - size) / 2);
    const iconFontSize =
      options.fontSize || Math.max(22, Math.round((size / Math.max(sy, 0.001)) * (38 / 92)));
    const iconButton = pushButton(
      icon,
      Number(button.x || 0) - iconOffsetX,
      Number(button.y || 0) + iconOffsetY,
      size,
      size,
      options.tone || 'accent',
      {
        sceneTemplateSlotId: `${SCENE_TEMPLATE_LAUNCH_PAGE_ID}:${slotSuffix}-icon`,
        forceSceneTemplateLayout: true,
        fontSize: iconFontSize,
        runtimeAction: button.runtimeAction || 'none',
        buttonRadius: 999,
        style: {
          ...(options.style || {}),
          background: options.background || button.style?.background,
          borderColor: options.borderColor || button.style?.borderColor,
          color: options.color || button.style?.color,
          borderWidth: Math.max(2, Number(button.style?.borderWidth || 2)),
          boxShadow: button.style?.boxShadow,
          padding: 0,
          lineHeight: 1,
        },
      }
    );
    button.linkedHoverGroup = group;
    iconButton.linkedHoverGroup = group;
    button.linkedActionTargetId = button.id;
    iconButton.linkedActionTargetId = button.id;
    button.style = {
      ...(button.style || {}),
      paddingLeft: Math.max(
        Number(button.style?.paddingLeft || 0),
        Number(options.paddingLeft ?? Math.round(size * (28 / 92)))
      ),
      whiteSpace: 'nowrap',
    };
    return iconButton;
  };
  const assignIntroButton = (button, iconOptions = {}) => {
    button.sceneTemplateSlotId = `${SCENE_TEMPLATE_LAUNCH_PAGE_ID}:intro-button`;
    button.label = stripLeadingButtonIcon(button.label) || button.label;
    introButtonTargets.push(button);
    introButtonTargets.push(
      createLinkedButtonIcon(
        button,
        iconOptions.icon || themeIcons.guide || '?',
        'intro',
        iconOptions
      )
    );
  };
  const assignStartButton = (button, iconOptions = {}) => {
    button.sceneTemplateSlotId = `${SCENE_TEMPLATE_LAUNCH_PAGE_ID}:start-button`;
    button.label = stripLeadingButtonIcon(button.label) || button.label;
    startButtonTargets.push(button);
    startButtonTargets.push(
      createLinkedButtonIcon(button, iconOptions.icon || '▶', 'start', iconOptions)
    );
  };
  const contentLanguage = getActivityContentLanguage(activity);
  const introLabel = tx.activityIntro;
  const startLabel = tx.start;
  const helperText =
    {
      tr: 'Tanıtımı inceleyebilir ya da doğrudan soru akışına geçebilirsin.',
      en: 'Review the intro or jump directly into the questions.',
      de: 'Prüfe die Einführung oder springe direkt zu den Fragen.',
    }[contentLanguage] || 'Tanıtımı inceleyebilir ya da doğrudan soru akışına geçebilirsin.';
  const encodeSvgAsset = (svg) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  const svgGridAsset = encodeSvgAsset(
    `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><path d="M0 0H96V96H0Z" fill="none"/><path d="M0 24H96M0 48H96M0 72H96M24 0V96M48 0V96M72 0V96" stroke="rgba(255,255,255,.18)" stroke-width="2"/><path d="M0 0H96V96H0Z" stroke="rgba(255,255,255,.14)" stroke-width="2" fill="none"/></svg>`
  );
  const svgStarAsset = encodeSvgAsset(
    `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="120" viewBox="0 0 180 120"><path d="M33 16l7 14 15 2-11 11 3 15-14-7-14 7 3-15-11-11 15-2zM136 24l5 10 11 1-8 8 2 11-10-5-10 5 2-11-8-8 11-1zM89 78l4 8 9 1-7 6 2 9-8-4-8 4 2-9-7-6 9-1z" fill="rgba(255,255,255,.28)"/></svg>`
  );
  const svgCircuitAsset = encodeSvgAsset(
    `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="120" viewBox="0 0 180 120"><path d="M12 24h42v22h54v-18h58M16 82h56V62h38v24h52M54 24v-10M108 46h18M110 86h-16" stroke="rgba(103,232,249,.26)" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="54" cy="24" r="6" fill="rgba(103,232,249,.34)"/><circle cx="108" cy="46" r="6" fill="rgba(103,232,249,.34)"/><circle cx="110" cy="86" r="6" fill="rgba(103,232,249,.34)"/></svg>`
  );
  const svgWoodAsset = encodeSvgAsset(
    `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="120" viewBox="0 0 220 120"><path d="M0 0h220v120H0z" fill="rgba(146,78,18,.2)"/><path d="M0 22c35-18 60 18 96 0s71-18 124 0M0 58c42 20 68-16 111 0s70 17 109 0M0 94c56-23 89 21 132 0s61-16 88 0" stroke="rgba(255,236,189,.18)" stroke-width="5" fill="none"/><path d="M0 36c40-16 76 15 128 0s65-12 92 0M0 75c42 16 76-12 128 0s65 10 92 0" stroke="rgba(56,26,6,.18)" stroke-width="4" fill="none"/></svg>`
  );
  const launchProfiles = {
    'aurora-glass': {
      bg: `${svgGridAsset}, radial-gradient(circle at 18% 22%,rgba(34,211,238,.34),transparent 34%), radial-gradient(circle at 82% 72%,rgba(79,70,229,.24),transparent 34%), linear-gradient(135deg,#e0f2fe 0%,#ffffff 46%,#dbeafe 100%)`,
      panel: 'linear-gradient(180deg,rgba(255,255,255,.86),rgba(239,246,255,.72))',
      rail: 'linear-gradient(90deg,#1d4ed8,#22d3ee)',
      accent: '#22d3ee',
      side: 'brackets',
      buttons: 'wide',
    },
    'obsidian-neon': {
      bg: `${svgCircuitAsset}, radial-gradient(circle at 26% 12%,rgba(34,211,238,.22),transparent 28%), linear-gradient(135deg,#020617 0%,#111827 54%,#031827 100%)`,
      panel: 'linear-gradient(180deg,rgba(15,23,42,.96),rgba(2,6,23,.94))',
      rail: 'linear-gradient(90deg,#06b6d4,#3b82f6,#ec4899)',
      accent: '#67e8f9',
      side: 'hud',
      buttons: 'console',
    },
    'sunset-card': {
      bg: 'radial-gradient(circle at 24% 24%,rgba(251,146,60,.28),transparent 32%), linear-gradient(135deg,#fff7ed 0%,#fed7aa 48%,#fb923c 100%)',
      panel: 'linear-gradient(180deg,rgba(255,247,237,.92),rgba(255,237,213,.78))',
      rail: 'linear-gradient(90deg,#fb7185,#fb923c,#f59e0b)',
      accent: '#fb923c',
      side: 'ticket',
      buttons: 'pill',
    },
    'mint-board': {
      bg: `${svgGridAsset}, linear-gradient(135deg,#ecfdf5 0%,#ccfbf1 48%,#99f6e4 100%)`,
      panel: 'linear-gradient(180deg,rgba(248,255,252,.94),rgba(209,250,229,.72))',
      rail: 'linear-gradient(90deg,#10b981,#14b8a6)',
      accent: '#14b8a6',
      side: 'terminal',
      buttons: 'cards',
    },
    'violet-stage': {
      bg: 'radial-gradient(circle at 50% 0%,rgba(236,72,153,.28),transparent 32%), linear-gradient(135deg,#2e1065 0%,#6d28d9 48%,#ec4899 100%)',
      panel: 'linear-gradient(180deg,rgba(250,245,255,.92),rgba(245,243,255,.72))',
      rail: 'linear-gradient(90deg,#8b5cf6,#ec4899)',
      accent: '#ec4899',
      side: 'stage',
      buttons: 'spotlight',
    },
    'rose-editorial': {
      bg: 'linear-gradient(135deg,#fff1f2 0%,#ffffff 42%,#fecdd3 100%)',
      panel: 'linear-gradient(180deg,rgba(255,255,255,.94),rgba(255,241,242,.82))',
      rail: 'linear-gradient(90deg,#fb7185,#e11d48)',
      accent: '#e11d48',
      side: 'ribbon',
      buttons: 'wide',
    },
    'lime-pulse': {
      bg: `${svgGridAsset}, linear-gradient(135deg,#f7fee7 0%,#d9f99d 52%,#65a30d 100%)`,
      panel: 'linear-gradient(180deg,rgba(253,255,246,.94),rgba(236,252,203,.72))',
      rail: 'linear-gradient(90deg,#84cc16,#22c55e)',
      accent: '#84cc16',
      side: 'arcade',
      buttons: 'arcade',
    },
    'slate-minimal': {
      bg: 'linear-gradient(135deg,#0f172a 0%,#334155 48%,#020617 100%)',
      panel: 'linear-gradient(180deg,rgba(255,255,255,.9),rgba(226,232,240,.76))',
      rail: 'linear-gradient(90deg,#111827,#64748b,#111827)',
      accent: '#111827',
      side: 'hud',
      buttons: 'console',
    },
    'amber-console': {
      bg: `${svgWoodAsset}, linear-gradient(135deg,#2b1606 0%,#92400e 48%,#f59e0b 100%)`,
      panel: 'linear-gradient(180deg,rgba(41,37,36,.96),rgba(12,10,9,.92))',
      rail: 'linear-gradient(90deg,#92400e,#f59e0b,#92400e)',
      accent: '#f59e0b',
      side: 'wood',
      buttons: 'console',
    },
    'candy-pop': {
      bg: `${svgStarAsset}, linear-gradient(135deg,#fdf2f8 0%,#bae6fd 50%,#ec4899 100%)`,
      panel: 'linear-gradient(180deg,rgba(255,255,255,.94),rgba(240,249,255,.78))',
      rail: 'linear-gradient(90deg,#ec4899,#38bdf8,#facc15)',
      accent: '#38bdf8',
      side: 'bubble',
      buttons: 'pill',
    },
    'lavender-soft': {
      bg: `${svgStarAsset}, linear-gradient(135deg,#faf5ff 0%,#ddd6fe 52%,#a78bfa 100%)`,
      panel: 'linear-gradient(180deg,rgba(252,250,255,.94),rgba(245,243,255,.78))',
      rail: 'linear-gradient(90deg,#c084fc,#818cf8)',
      accent: '#a78bfa',
      side: 'ribbon',
      buttons: 'wide',
    },
    'kids-playground': {
      bg: `${svgStarAsset}, linear-gradient(135deg,#fff7ed 0%,#fde68a 32%,#7dd3fc 68%,#f9a8d4 100%)`,
      panel: 'linear-gradient(180deg,rgba(255,255,255,.95),rgba(255,251,235,.78))',
      rail: 'linear-gradient(90deg,#fb7185,#facc15,#38bdf8)',
      accent: '#fb7185',
      side: 'sticker',
      buttons: 'arcade',
    },
    'kids-sticker': {
      bg: `${svgStarAsset}, linear-gradient(135deg,#eff6ff 0%,#bfdbfe 48%,#a78bfa 100%)`,
      panel: 'linear-gradient(180deg,rgba(250,253,255,.94),rgba(239,246,255,.78))',
      rail: 'linear-gradient(90deg,#8b5cf6,#38bdf8)',
      accent: '#8b5cf6',
      side: 'sticker',
      buttons: 'cards',
    },
  };
  const drawDecorativeSide = (profile, x, y, w, h) => {
    const side = profile.side;
    if (side === 'ticket') {
      pushShape({
        x: x + u(26),
        y: y + u(42, 'y'),
        width: u(64),
        height: h - u(84, 'y'),
        style: {
          background: profile.rail,
          borderColor: 'rgba(255,255,255,.55)',
          borderWidth: 2,
          borderRadius: 999,
          boxShadow: 'inset 0 2px 0 rgba(255,255,255,.42), 0 14px 26px rgba(0,0,0,.14)',
        },
      });
      pushShape({
        x: x + w - u(90),
        y: y + u(42, 'y'),
        width: u(64),
        height: h - u(84, 'y'),
        style: {
          background: profile.rail,
          borderColor: 'rgba(255,255,255,.55)',
          borderWidth: 2,
          borderRadius: 999,
          boxShadow: 'inset 0 2px 0 rgba(255,255,255,.42), 0 14px 26px rgba(0,0,0,.14)',
        },
      });
      return;
    }
    if (side === 'hud' || side === 'terminal') {
      [0, 1, 2].forEach((item) => {
        pushShape({
          x: x + u(64 + item * 62),
          y: y + u(52, 'y'),
          width: u(38),
          height: u(18, 'y'),
          style: {
            background: profile.rail,
            borderColor: 'rgba(255,255,255,.24)',
            borderWidth: 1,
            borderRadius: 999,
            boxShadow: '0 0 16px rgba(34,211,238,.22)',
          },
        });
        pushShape({
          x: x + w - u(102 + item * 62),
          y: y + h - u(70, 'y'),
          width: u(38),
          height: u(18, 'y'),
          style: {
            background: profile.rail,
            borderColor: 'rgba(255,255,255,.24)',
            borderWidth: 1,
            borderRadius: 999,
            boxShadow: '0 0 16px rgba(34,211,238,.22)',
          },
        });
      });
      return;
    }
    if (side === 'wood') {
      pushShape({
        x: x + u(34),
        y: y + u(34, 'y'),
        width: w - u(68),
        height: u(28, 'y'),
        style: {
          background: profile.rail,
          borderColor: 'rgba(255,236,189,.42)',
          borderWidth: 2,
          borderRadius: 999,
          boxShadow: 'inset 0 2px 0 rgba(255,255,255,.22)',
        },
      });
      pushShape({
        x: x + u(34),
        y: y + h - u(62, 'y'),
        width: w - u(68),
        height: u(28, 'y'),
        style: {
          background: profile.rail,
          borderColor: 'rgba(255,236,189,.42)',
          borderWidth: 2,
          borderRadius: 999,
          boxShadow: 'inset 0 2px 0 rgba(255,255,255,.22)',
        },
      });
      return;
    }
    if (side === 'stage') {
      pushShape({
        x: x + u(72),
        y: y + u(70, 'y'),
        width: u(120),
        height: h - u(140, 'y'),
        style: {
          background: 'linear-gradient(180deg,rgba(255,255,255,.16),rgba(255,255,255,.03))',
          borderColor: 'rgba(255,255,255,.24)',
          borderWidth: 1,
          borderRadius: 999,
          boxShadow: '0 0 40px rgba(236,72,153,.22)',
        },
      });
      pushShape({
        x: x + w - u(192),
        y: y + u(70, 'y'),
        width: u(120),
        height: h - u(140, 'y'),
        style: {
          background: 'linear-gradient(180deg,rgba(255,255,255,.16),rgba(255,255,255,.03))',
          borderColor: 'rgba(255,255,255,.24)',
          borderWidth: 1,
          borderRadius: 999,
          boxShadow: '0 0 40px rgba(139,92,246,.22)',
        },
      });
      return;
    }
    if (side === 'bubble' || side === 'sticker' || side === 'arcade') {
      [0, 1, 2].forEach((item) => {
        const size = u(70 - item * 10, 'y');
        pushShape({
          shapeKind: 'ellipse',
          x: x + u(64 + item * 88),
          y: y + u(54 + item * 52, 'y'),
          width: size,
          height: size,
          style: {
            background: profile.rail,
            borderColor: 'rgba(255,255,255,.82)',
            borderWidth: 4,
            borderRadius: 999,
            boxShadow:
              'inset 0 2px 0 rgba(255,255,255,.7), 0 10px 0 rgba(0,0,0,.12), 0 18px 28px rgba(0,0,0,.14)',
          },
        });
        pushShape({
          shapeKind: 'ellipse',
          x: x + w - u(130 + item * 88),
          y: y + h - u(124 + item * 52, 'y'),
          width: size,
          height: size,
          style: {
            background: profile.rail,
            borderColor: 'rgba(255,255,255,.82)',
            borderWidth: 4,
            borderRadius: 999,
            boxShadow:
              'inset 0 2px 0 rgba(255,255,255,.7), 0 10px 0 rgba(0,0,0,.12), 0 18px 28px rgba(0,0,0,.14)',
          },
        });
      });
      return;
    }
    pushShape({
      x: x + u(36),
      y: y + u(54, 'y'),
      width: u(34),
      height: h - u(108, 'y'),
      style: {
        background: profile.rail,
        borderColor: 'rgba(255,255,255,.5)',
        borderWidth: 1,
        borderRadius: 999,
        boxShadow: '0 18px 32px rgba(0,0,0,.12)',
      },
    });
    pushShape({
      x: x + w - u(70),
      y: y + u(54, 'y'),
      width: u(34),
      height: h - u(108, 'y'),
      style: {
        background: profile.rail,
        borderColor: 'rgba(255,255,255,.5)',
        borderWidth: 1,
        borderRadius: 999,
        boxShadow: '0 18px 32px rgba(0,0,0,.12)',
      },
    });
  };
  const drawVisualLaunchStage = () => {
    const profile = launchProfiles[preset?.id || ''] || launchProfiles['rose-editorial'];
    const outerX = u(112);
    const outerY = u(92, 'y');
    const outerW = stageWidth - u(224);
    const outerH = stageHeight - u(184, 'y');
    const panelX = outerX + u(132);
    const panelY = outerY + u(185, 'y');
    const panelW = outerW - u(264);
    const panelH = u(330, 'y');
    const buttonY = panelY + Math.round((panelH - u(106, 'y')) / 2);
    const buttonW = profile.buttons === 'cards' ? u(470) : u(500);
    const buttonH = profile.buttons === 'arcade' ? u(118, 'y') : u(96, 'y');
    const gap = u(130);
    const totalW = buttonW * 2 + gap;
    const firstX = Math.round((stageWidth - totalW) / 2);
    const secondX = firstX + buttonW + gap;

    pushShape({
      shapeKind: 'rect',
      x: 0,
      y: 0,
      width: stageWidth,
      height: stageHeight,
      style: {
        background: profile.bg,
        borderWidth: 0,
        borderColor: 'transparent',
      },
    });
    pushShape({
      x: outerX,
      y: outerY,
      width: outerW,
      height: outerH,
      style: {
        background: 'rgba(255,255,255,.12)',
        borderColor: 'rgba(255,255,255,.35)',
        borderWidth: 1,
        borderRadius: panelRadius + 28,
        boxShadow: 'inset 0 2px 0 rgba(255,255,255,.3), 0 32px 70px rgba(15,23,42,.22)',
      },
    });
    drawDecorativeSide(profile, outerX, outerY, outerW, outerH);
    pushShape({
      x: panelX,
      y: panelY,
      width: panelW,
      height: panelH,
      style: {
        background: profile.panel,
        borderColor: 'rgba(255,255,255,.58)',
        borderWidth: 2,
        borderRadius: panelRadius + 18,
        boxShadow: `${surfaceShadow}, inset 0 2px 0 rgba(255,255,255,.62), inset 0 -10px 0 rgba(15,23,42,.06)`,
      },
    });
    pushShape({
      x: panelX + u(58),
      y: panelY + u(42, 'y'),
      width: panelW - u(116),
      height: u(18, 'y'),
      style: {
        background: profile.rail,
        borderColor: 'transparent',
        borderWidth: 0,
        borderRadius: 999,
        boxShadow: '0 12px 24px rgba(15,23,42,.14)',
      },
    });
    pushShape({
      x: panelX + u(58),
      y: panelY + panelH - u(60, 'y'),
      width: panelW - u(116),
      height: u(18, 'y'),
      style: {
        background: profile.rail,
        borderColor: 'transparent',
        borderWidth: 0,
        borderRadius: 999,
        boxShadow: '0 12px 24px rgba(15,23,42,.14)',
      },
    });

    const introTone = profile.buttons === 'console' ? 'neutral' : 'soft';
    assignIntroButton(
      pushButton(introLabel, firstX, buttonY, buttonW, buttonH, introTone, {
        fontSize: profile.buttons === 'arcade' ? 25 : 24,
        buttonRadius: profile.buttons === 'cards' ? 22 : 999,
      }),
      {
        size: Math.min(u(96, 'y'), Math.round(buttonH * 0.92)),
        tone: introTone,
      }
    );

    const startButtonWidth = u(580);
    const startButtonHeight = u(92, 'y');
    const startButtonX = secondX + Math.round((buttonW - startButtonWidth) / 2);
    const startButtonY = buttonY + Math.round((buttonH - startButtonHeight) / 2);
    assignStartButton(
      pushButton(
        startLabel,
        startButtonX,
        startButtonY,
        startButtonWidth,
        startButtonHeight,
        'accent',
        {
          fontSize: 30,
          buttonRadius: 999,
          style: {
            paddingLeft: u(28),
          },
        }
      ),
      {
        size: u(92, 'y'),
        tone: 'accent',
      }
    );
  };
  const variant =
    {
      'aurora-glass': 'glass-cards',
      'obsidian-neon': 'command-deck',
      'sunset-card': 'ticket-stack',
      'mint-board': 'checklist-board',
      'violet-stage': 'stage-focus',
      'rose-editorial': 'editorial-band',
      'lime-pulse': 'arcade-tiles',
      'slate-minimal': 'pro-toolbar',
      'amber-console': 'console-panel',
      'candy-pop': 'bubble-split',
      'lavender-soft': 'soft-canvas',
      'kids-playground': 'arcade-tiles',
      'kids-sticker': 'bubble-split',
    }[preset?.id || ''] || 'editorial-band';

  const drawGlassCards = () => {
    const outerX = u(126);
    const outerY = u(96, 'y');
    const outerW = stageWidth - u(252);
    const outerH = stageHeight - u(192, 'y');
    pushShape({
      x: outerX,
      y: outerY,
      width: outerW,
      height: outerH,
      style: {
        background: surface,
        borderColor: surfaceBorder,
        borderWidth: 1,
        borderRadius: panelRadius + 18,
        boxShadow: `${surfaceShadow}, ${insetShadow}`,
      },
    });
    pushShape({
      x: outerX + u(112),
      y: outerY + u(88, 'y'),
      width: outerW - u(224),
      height: outerH - u(176, 'y'),
      style: {
        background: surfaceAlt,
        borderColor: accentBorder,
        borderWidth: 2,
        borderRadius: panelRadius + 8,
        boxShadow: `0 18px 38px rgba(15,23,42,.08), ${insetShadow}`,
      },
    });
    pushText(helperText, outerX + u(300), outerY + u(132, 'y'), outerW - u(600), u(38, 'y'), {
      color: bodyColor,
      fontSize: u(18, 'y'),
      fontWeight: 700,
    });
    const y = outerY + Math.round((outerH - u(92, 'y')) / 2);
    assignIntroButton(
      pushButton(introLabel, outerX + u(330), y, u(430), u(92, 'y'), 'soft', {
        fontSize: 24,
        buttonRadius: 22,
      })
    );
    assignStartButton(
      pushButton(startLabel, outerX + outerW - u(760), y, u(430), u(92, 'y'), 'soft', {
        fontSize: 24,
        buttonRadius: 22,
      })
    );
  };

  const drawCommandDeck = () => {
    const x = u(250);
    const y = u(180, 'y');
    const w = stageWidth - u(500);
    const h = stageHeight - u(360, 'y');
    pushShape({
      x,
      y,
      width: w,
      height: h,
      style: {
        background: neutralGradient,
        borderColor: neutralBorder,
        borderWidth: 1,
        borderRadius: panelRadius + 14,
        boxShadow: `${surfaceShadow}, ${insetShadow}`,
      },
    });
    pushShape({
      x: x + u(42),
      y: y + u(42, 'y'),
      width: w - u(84),
      height: h - u(84, 'y'),
      style: {
        background: surface,
        borderColor: accentBorder,
        borderWidth: 1,
        borderRadius: panelRadius + 4,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,.08)',
      },
    });
    pushText('Başlamadan önce bir yol seç', x + u(160), y + u(92, 'y'), w - u(320), u(46, 'y'), {
      color: titleColor,
      fontSize: u(30, 'y'),
      fontWeight: 900,
    });
    const cardY = y + u(206, 'y');
    assignIntroButton(
      pushButton(introLabel, x + u(116), cardY, u(470), u(114, 'y'), 'neutral', {
        fontSize: 23,
        buttonRadius: 18,
      }),
      { background: accentGradient }
    );
    assignStartButton(
      pushButton(startLabel, x + w - u(586), cardY, u(470), u(114, 'y'), 'accent', {
        fontSize: 23,
        buttonRadius: 18,
      }),
      { background: surfaceAlt, color: titleColor, borderColor: surfaceBorder }
    );
  };

  const drawTicketStack = () => {
    const x = u(180);
    const y = u(140, 'y');
    const w = stageWidth - u(360);
    const h = stageHeight - u(280, 'y');
    pushShape({
      x,
      y,
      width: w,
      height: h,
      style: {
        background: surface,
        borderColor: surfaceBorder,
        borderWidth: 1,
        borderRadius: panelRadius + 8,
        boxShadow: `${surfaceShadow}, ${insetShadow}`,
      },
    });
    pushShape({
      x: x + u(50),
      y: y + u(62, 'y'),
      width: w - u(100),
      height: u(96, 'y'),
      style: {
        background: accentGradient,
        borderColor: accentBorder,
        borderWidth: 1,
        borderRadius: panelRadius,
        boxShadow: hoverShadow,
      },
    });
    pushText('ETKİNLİK GİRİŞİ', x + u(110), y + u(84, 'y'), w - u(220), u(46, 'y'), {
      color: accentText,
      fontSize: u(34, 'y'),
      fontWeight: 900,
    });
    pushText(helperText, x + u(220), y + u(196, 'y'), w - u(440), u(44, 'y'), {
      color: bodyColor,
      fontSize: u(20, 'y'),
      fontWeight: 700,
    });
    assignIntroButton(
      pushButton(introLabel, x + u(235), y + u(308, 'y'), u(480), u(96, 'y'), 'soft', {
        fontSize: 24,
        buttonRadius: 999,
      })
    );
    assignStartButton(
      pushButton(startLabel, x + w - u(715), y + u(308, 'y'), u(480), u(96, 'y'), 'accent', {
        fontSize: 24,
        buttonRadius: 999,
      })
    );
  };

  const drawChecklistBoard = () => {
    const x = u(200);
    const y = u(138, 'y');
    const w = stageWidth - u(400);
    const h = stageHeight - u(276, 'y');
    pushShape({
      x,
      y,
      width: w,
      height: h,
      style: {
        background: surface,
        borderColor: surfaceBorder,
        borderWidth: 1,
        borderRadius: panelRadius + 12,
        boxShadow: `${surfaceShadow}, ${insetShadow}`,
      },
    });
    pushText('Başlangıç Paneli', x + u(80), y + u(72, 'y'), u(420), u(48, 'y'), {
      color: titleColor,
      fontSize: u(34, 'y'),
      fontWeight: 900,
      textAlign: 'left',
    });
    pushText(helperText, x + u(80), y + u(134, 'y'), u(520), u(70, 'y'), {
      color: bodyColor,
      fontSize: u(20, 'y'),
      fontWeight: 700,
      textAlign: 'left',
    });
    const cardW = u(410);
    const cardH = u(230, 'y');
    const cardY = y + u(226, 'y');
    pushShape({
      x: x + w - u(950),
      y: cardY,
      width: cardW,
      height: cardH,
      style: {
        background: surfaceAlt,
        borderColor: surfaceBorder,
        borderWidth: 1,
        borderRadius: panelRadius,
        boxShadow: '0 14px 28px rgba(15,23,42,.08)',
      },
    });
    pushShape({
      x: x + w - u(500),
      y: cardY,
      width: cardW,
      height: cardH,
      style: {
        background: surfaceAlt,
        borderColor: accentBorder,
        borderWidth: 1,
        borderRadius: panelRadius,
        boxShadow: '0 14px 28px rgba(15,23,42,.08)',
      },
    });
    assignIntroButton(
      pushButton(introLabel, x + w - u(910), cardY + u(92, 'y'), u(330), u(76, 'y'), 'soft', {
        fontSize: 20,
        buttonRadius: 14,
      })
    );
    assignStartButton(
      pushButton(startLabel, x + w - u(460), cardY + u(92, 'y'), u(330), u(76, 'y'), 'accent', {
        fontSize: 20,
        buttonRadius: 14,
      })
    );
  };

  const drawStageFocus = () => {
    const x = u(146);
    const y = u(106, 'y');
    const w = stageWidth - u(292);
    const h = stageHeight - u(212, 'y');
    pushShape({
      x,
      y,
      width: w,
      height: h,
      style: {
        background: surface,
        borderColor: surfaceBorder,
        borderWidth: 1,
        borderRadius: panelRadius + 20,
        boxShadow: `${surfaceShadow}, ${insetShadow}`,
      },
    });
    pushShape({
      shapeKind: 'ellipse',
      x: x + u(500),
      y: y + u(72, 'y'),
      width: u(650),
      height: u(260, 'y'),
      style: {
        background: accentGradient,
        borderColor: accentBorder,
        borderWidth: 0,
        opacity: 0.18,
        boxShadow: 'none',
      },
    });
    pushText('Sahne hazır', x + u(160), y + u(118, 'y'), w - u(320), u(54, 'y'), {
      color: titleColor,
      fontSize: u(38, 'y'),
      fontWeight: 900,
    });
    pushText(helperText, x + u(340), y + u(188, 'y'), w - u(680), u(44, 'y'), {
      color: bodyColor,
      fontSize: u(20, 'y'),
      fontWeight: 700,
    });
    assignIntroButton(
      pushButton(introLabel, x + u(360), y + u(380, 'y'), u(420), u(88, 'y'), 'soft', {
        fontSize: 23,
        buttonRadius: 18,
      })
    );
    assignStartButton(
      pushButton(startLabel, x + w - u(780), y + u(380, 'y'), u(420), u(88, 'y'), 'accent', {
        fontSize: 23,
        buttonRadius: 18,
      })
    );
  };

  const drawEditorialBand = () => {
    const x = u(126);
    const y = u(94, 'y');
    const w = stageWidth - u(252);
    const h = stageHeight - u(188, 'y');
    const bandY = y + u(235, 'y');
    pushShape({
      x,
      y,
      width: w,
      height: h,
      style: {
        background: surface,
        borderColor: surfaceBorder,
        borderWidth: 1,
        borderRadius: panelRadius + 8,
        boxShadow: `${surfaceShadow}, ${insetShadow}`,
      },
    });
    pushShape({
      x: x + u(118),
      y: bandY,
      width: w - u(236),
      height: u(322, 'y'),
      style: {
        background: surfaceAlt,
        borderColor: accentBorder,
        borderWidth: 2,
        borderRadius: panelRadius,
        boxShadow: '0 18px 36px rgba(15,23,42,.08)',
      },
    });
    pushShape({
      x: x + u(118),
      y: bandY - u(22, 'y'),
      width: w - u(236),
      height: u(18, 'y'),
      style: {
        background: accentGradient,
        borderColor: 'transparent',
        borderWidth: 0,
        borderRadius: 999,
        boxShadow: 'none',
      },
    });
    pushShape({
      x: x + u(118),
      y: bandY + u(326, 'y'),
      width: w - u(236),
      height: u(18, 'y'),
      style: {
        background: accentGradient,
        borderColor: 'transparent',
        borderWidth: 0,
        borderRadius: 999,
        boxShadow: 'none',
      },
    });
    pushText(helperText, x + u(340), bandY + u(52, 'y'), w - u(680), u(40, 'y'), {
      color: bodyColor,
      fontSize: u(18, 'y'),
      fontWeight: 700,
    });
    assignIntroButton(
      pushButton(introLabel, x + u(300), bandY + u(130, 'y'), u(470), u(92, 'y'), 'soft', {
        fontSize: 25,
        buttonRadius: 999,
      })
    );
    assignStartButton(
      pushButton(startLabel, x + w - u(770), bandY + u(130, 'y'), u(470), u(92, 'y'), 'soft', {
        fontSize: 25,
        buttonRadius: 999,
      })
    );
  };

  const drawArcadeTiles = () => {
    const x = u(190);
    const y = u(150, 'y');
    const w = stageWidth - u(380);
    const h = stageHeight - u(300, 'y');
    pushShape({
      x,
      y,
      width: w,
      height: h,
      style: {
        background: surface,
        borderColor: surfaceBorder,
        borderWidth: 1,
        borderRadius: panelRadius + 6,
        boxShadow: `${surfaceShadow}, ${insetShadow}`,
      },
    });
    pushText('Seç ve başla', x + u(90), y + u(74, 'y'), w - u(180), u(48, 'y'), {
      color: titleColor,
      fontSize: u(36, 'y'),
      fontWeight: 900,
    });
    const tileY = y + u(230, 'y');
    assignIntroButton(
      pushButton(introLabel, x + u(170), tileY, u(500), u(150, 'y'), 'soft', {
        fontSize: 25,
        buttonRadius: 22,
        style: { borderWidth: 2 },
      }),
      { size: u(96, 'y'), offsetX: u(30), offsetY: u(27, 'y') }
    );
    assignStartButton(
      pushButton(startLabel, x + w - u(670), tileY, u(500), u(150, 'y'), 'accent', {
        fontSize: 25,
        buttonRadius: 22,
      }),
      {
        size: u(96, 'y'),
        offsetX: u(30),
        offsetY: u(27, 'y'),
        background: surface,
        color: titleColor,
        borderColor: surfaceBorder,
      }
    );
  };

  const drawProToolbar = () => {
    const x = u(160);
    const y = u(220, 'y');
    const w = stageWidth - u(320);
    const h = u(410, 'y');
    pushShape({
      x,
      y,
      width: w,
      height: h,
      style: {
        background: surface,
        borderColor: surfaceBorder,
        borderWidth: 1,
        borderRadius: 12,
        boxShadow: `${surfaceShadow}, ${insetShadow}`,
      },
    });
    pushShape({
      x,
      y,
      width: w,
      height: u(82, 'y'),
      style: {
        background: surfaceAlt,
        borderColor: surfaceBorder,
        borderWidth: 0,
        borderRadius: 12,
        boxShadow: 'none',
      },
    });
    pushText('Etkinlik Kontrolü', x + u(64), y + u(22, 'y'), u(500), u(38, 'y'), {
      color: titleColor,
      fontSize: u(30, 'y'),
      fontWeight: 900,
      textAlign: 'left',
    });
    pushText(helperText, x + u(64), y + u(124, 'y'), w - u(128), u(42, 'y'), {
      color: bodyColor,
      fontSize: u(19, 'y'),
      fontWeight: 700,
      textAlign: 'left',
    });
    assignIntroButton(
      pushButton(introLabel, x + u(120), y + u(230, 'y'), u(455), u(74, 'y'), 'soft', {
        fontSize: 21,
        buttonRadius: 10,
      })
    );
    assignStartButton(
      pushButton(startLabel, x + w - u(575), y + u(230, 'y'), u(455), u(74, 'y'), 'neutral', {
        fontSize: 21,
        buttonRadius: 10,
      })
    );
  };

  const drawConsolePanel = () => {
    const x = u(230);
    const y = u(160, 'y');
    const w = stageWidth - u(460);
    const h = stageHeight - u(320, 'y');
    pushShape({
      x,
      y,
      width: w,
      height: h,
      style: {
        background: surface,
        borderColor: surfaceBorder,
        borderWidth: 1,
        borderRadius: panelRadius + 4,
        boxShadow: `${surfaceShadow}, ${insetShadow}`,
      },
    });
    pushShape({
      x: x + u(42),
      y: y + u(42, 'y'),
      width: w - u(84),
      height: h - u(84, 'y'),
      style: {
        background: surfaceAlt,
        borderColor: accentBorder,
        borderWidth: 1,
        borderRadius: panelRadius,
        boxShadow: '0 14px 28px rgba(15,23,42,.1)',
      },
    });
    pushText('Komut Seçimi', x + u(105), y + u(92, 'y'), u(460), u(44, 'y'), {
      color: titleColor,
      fontSize: u(34, 'y'),
      fontWeight: 900,
      textAlign: 'left',
    });
    assignIntroButton(
      pushButton(introLabel, x + u(130), y + u(270, 'y'), u(460), u(86, 'y'), 'soft', {
        fontSize: 22,
        buttonRadius: 14,
      })
    );
    assignStartButton(
      pushButton(startLabel, x + w - u(590), y + u(270, 'y'), u(460), u(86, 'y'), 'accent', {
        fontSize: 22,
        buttonRadius: 14,
      })
    );
  };

  const drawBubbleSplit = () => {
    const x = u(145);
    const y = u(118, 'y');
    const w = stageWidth - u(290);
    const h = stageHeight - u(236, 'y');
    pushShape({
      x,
      y,
      width: w,
      height: h,
      style: {
        background: surface,
        borderColor: surfaceBorder,
        borderWidth: 1,
        borderRadius: panelRadius + 24,
        boxShadow: `${surfaceShadow}, ${insetShadow}`,
      },
    });
    pushShape({
      shapeKind: 'ellipse',
      x: x + u(160),
      y: y + u(105, 'y'),
      width: u(370),
      height: u(250, 'y'),
      style: {
        background: accentGradient,
        borderColor: 'transparent',
        borderWidth: 0,
        opacity: 0.16,
        boxShadow: 'none',
      },
    });
    pushShape({
      shapeKind: 'ellipse',
      x: x + w - u(530),
      y: y + u(215, 'y'),
      width: u(360),
      height: u(250, 'y'),
      style: {
        background: accentGradient,
        borderColor: 'transparent',
        borderWidth: 0,
        opacity: 0.16,
        boxShadow: 'none',
      },
    });
    pushText('Hazır mısın?', x + u(120), y + u(110, 'y'), w - u(240), u(58, 'y'), {
      color: titleColor,
      fontSize: u(40, 'y'),
      fontWeight: 900,
    });
    assignIntroButton(
      pushButton(introLabel, x + u(320), y + u(350, 'y'), u(430), u(94, 'y'), 'soft', {
        fontSize: 23,
        buttonRadius: 999,
      })
    );
    assignStartButton(
      pushButton(startLabel, x + w - u(750), y + u(350, 'y'), u(430), u(94, 'y'), 'accent', {
        fontSize: 23,
        buttonRadius: 999,
      })
    );
  };

  const drawSoftCanvas = () => {
    const x = u(170);
    const y = u(132, 'y');
    const w = stageWidth - u(340);
    const h = stageHeight - u(264, 'y');
    pushShape({
      x,
      y,
      width: w,
      height: h,
      style: {
        background: surface,
        borderColor: surfaceBorder,
        borderWidth: 1,
        borderRadius: panelRadius + 18,
        boxShadow: `${surfaceShadow}, ${insetShadow}`,
      },
    });
    pushShape({
      x: x + u(92),
      y: y + u(96, 'y'),
      width: w - u(184),
      height: h - u(192, 'y'),
      style: {
        background: surfaceAlt,
        borderColor: surfaceBorder,
        borderWidth: 1,
        borderRadius: panelRadius + 10,
        boxShadow: '0 16px 32px rgba(15,23,42,.06)',
      },
    });
    pushText(helperText, x + u(260), y + u(160, 'y'), w - u(520), u(44, 'y'), {
      color: bodyColor,
      fontSize: u(20, 'y'),
      fontWeight: 700,
    });
    assignIntroButton(
      pushButton(introLabel, x + u(330), y + u(324, 'y'), u(430), u(86, 'y'), 'soft', {
        fontSize: 22,
        buttonRadius: 18,
      })
    );
    assignStartButton(
      pushButton(startLabel, x + w - u(760), y + u(324, 'y'), u(430), u(86, 'y'), 'accent', {
        fontSize: 22,
        buttonRadius: 18,
      })
    );
  };

  const legacyLaunchDrawers = {
    'glass-cards': drawGlassCards,
    'command-deck': drawCommandDeck,
    'ticket-stack': drawTicketStack,
    'checklist-board': drawChecklistBoard,
    'stage-focus': drawStageFocus,
    'editorial-band': drawEditorialBand,
    'arcade-tiles': drawArcadeTiles,
    'pro-toolbar': drawProToolbar,
    'console-panel': drawConsolePanel,
    'bubble-split': drawBubbleSplit,
    'soft-canvas': drawSoftCanvas,
  };
  void legacyLaunchDrawers;
  void variant;
  drawVisualLaunchStage();

  const createTemplateTrigger = (index, target, value, name) => ({
    ...createTriggerItem(index),
    when: 'onClick',
    target,
    action: 'SliderGec',
    value,
    name,
    generatedBy: 'scene-template',
    sceneTemplateId: SCENE_TEMPLATE_LAUNCH_PAGE_ID,
    sceneTemplateVersion: SCENE_TEMPLATE_VERSION,
  });
  const triggers = [
    ...introButtonTargets
      .filter(Boolean)
      .map((target, index) =>
        createTemplateTrigger(index, target.id, '__prev__', 'Etkinlik tanıtımına git')
      ),
    ...startButtonTargets
      .filter(Boolean)
      .map((target, index) =>
        createTemplateTrigger(
          index + introButtonTargets.length,
          target.id,
          '__next__',
          'Etkinliği başlat'
        )
      ),
  ];

  return { objects, triggers };
}
function normalizeSingleButtonIcon(value = '', fallback = '?') {
  const raw = String(value || '').trim();
  const safeFallback = String(fallback || '?').trim() || '?';
  if (!raw) return safeFallback;
  if (raw === safeFallback) return raw;
  if (raw.includes(safeFallback)) return safeFallback;
  if (/\s/.test(raw) && raw.length > 2) return safeFallback;
  return raw;
}
function getButtonPairSemanticIcon(iconObject = {}, labelObject = {}) {
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
  if (labelKey.includes('ses') || action.includes('mute')) return iconObject.soundOffIcon || '🔊';
  if (labelKey.includes('cozum') || labelKey.includes('cevap') || action.includes('answer'))
    return '✎';
  if (labelKey.includes('tamamla') || labelKey.includes('kontrol') || action.includes('complete'))
    return '✓';
  if (labelKey.includes('ileri') || labelKey.includes('next')) return '≫';
  if (labelKey.includes('geri') || labelKey.includes('prev')) return '≪';
  return normalizeSingleButtonIcon(iconObject.label || iconObject.text || '', '?');
}

function isButtonIntroInteractiveSlot(item = {}) {
  const slotId = String(item.sceneTemplateSlotId || '');
  const label = String(item.label || '').trim();
  const normalizedLabel = label.toLocaleUpperCase('tr-TR');
  return (
    slotId.endsWith(':start-button') ||
    slotId.endsWith(':start-icon') ||
    slotId.endsWith(':close-button') ||
    normalizedLabel.includes('ETKİNLİĞİ BAŞLAT') ||
    ['×', 'X', '✕', '✖'].includes(label)
  );
}

function isLaunchIntroControl(item = {}) {
  const slotId = String(item.sceneTemplateSlotId || '');
  const label = String(item.label || '')
    .trim()
    .toLocaleUpperCase('tr-TR');
  return (
    slotId.endsWith(':intro-button') ||
    slotId.endsWith(':intro-icon') ||
    slotId.endsWith(':intro-icon-bg') ||
    slotId.endsWith(':intro-icon-text') ||
    label.includes('ETKİNLİK TANITIMI')
  );
}

function isLaunchStartControl(item = {}) {
  const slotId = String(item.sceneTemplateSlotId || '');
  const label = String(item.label || '')
    .trim()
    .toLocaleUpperCase('tr-TR');
  return (
    slotId.endsWith(':start-button') ||
    slotId.endsWith(':start-icon') ||
    slotId.endsWith(':start-icon-bg') ||
    slotId.endsWith(':start-icon-text') ||
    label.includes('ETKİNLİĞİ BAŞLAT')
  );
}

function getSceneTemplateSlotId(item = {}, templateId = '', index = 0) {
  return (
    item.sceneTemplateSlotId ||
    `${item.sceneTemplateId || templateId || 'scene-template'}:slot-${index + 1}`
  );
}



function getSceneTemplateAutoTargets(slide = {}, options = {}) {
  const slides =
    Array.isArray(options.slides) && options.slides.length
      ? options.slides
      : Array.isArray(slide.slides)
        ? slide.slides
        : [];
  const currentSlideId = String(options.currentSlideId || slide.id || slide.currentSlideId || '');
  const isTemplateSlide = (item) =>
    [SCENE_TEMPLATE_LAUNCH_PAGE_ID, SCENE_TEMPLATE_BUTTON_INTRO_ID].includes(
      String(item?.sceneTemplateId || '')
    );
  const launchSlide =
    slides.find((item) => String(item?.sceneTemplateId || '') === SCENE_TEMPLATE_LAUNCH_PAGE_ID) ||
    null;
  const introSlide =
    slides.find((item) => String(item?.sceneTemplateId || '') === SCENE_TEMPLATE_BUTTON_INTRO_ID) ||
    null;
  const launchIndex = launchSlide ? slides.findIndex((item) => item.id === launchSlide.id) : -1;
  const questionSlideAfterLaunch =
    launchIndex >= 0 ? slides.slice(launchIndex + 1).find((item) => !isTemplateSlide(item)) : null;
  const questionSlide =
    questionSlideAfterLaunch ||
    slides.find((item) => item.id !== currentSlideId && !isTemplateSlide(item)) ||
    slides.find((item) => !isTemplateSlide(item)) ||
    null;

  return {
    launchSlideValue: launchSlide?.id || '__prev__',
    introSlideValue: introSlide?.id || '__next__',
    questionSlideValue:
      questionSlide?.id ||
      (String(slide.sceneTemplateId || '') === SCENE_TEMPLATE_BUTTON_INTRO_ID
        ? '__prev__'
        : '__next__'),
  };
}

function getSceneTemplateDefaultTriggerValue(
  templateId = '',
  trigger = {},
  targetObject = {},
  targets = {}
) {
  if (templateId === SCENE_TEMPLATE_BUTTON_INTRO_ID) {
    if (isButtonIntroInteractiveSlot(targetObject)) {
      return String(targetObject.sceneTemplateSlotId || '').endsWith(':close-button') ||
        ['×', 'X', '✕', '✖'].includes(String(targetObject.label || '').trim())
        ? targets.launchSlideValue
        : targets.questionSlideValue;
    }
    return trigger.value;
  }
  if (templateId === SCENE_TEMPLATE_LAUNCH_PAGE_ID) {
    if (isLaunchIntroControl(targetObject)) return targets.introSlideValue;
    if (isLaunchStartControl(targetObject)) return targets.questionSlideValue;
  }
  return trigger.value;
}

function applySceneTemplateToSlide(slide = {}, options = {}) {
  const templateId = String(options.templateId || slide.sceneTemplateId || '').trim();
  const presetId = String(
    options.presetId ||
      slide.sceneTemplatePresetId ||
      slide.answerLayerStylePresetId ||
      DEFAULT_ANSWER_LAYER_STYLE_PRESET_ID
  );
  const preserveNonGenerated = options.preserveNonGenerated !== false;
  const replaceExisting = options.replaceExisting === true;
  const respectDeletedSlotsOption = options.respectDeletedSlots !== false;
  const currentObjects = Array.isArray(slide.objects) ? slide.objects : [];
  const nonTemplateObjects = currentObjects.filter(
    (item) => !isGeneratedSceneTemplateObject(item) && !isGeneratedAnswerTemplateObject(item)
  );
  const currentGeneratedObjects = currentObjects
    .filter(
      (item) =>
        isGeneratedSceneTemplateObject(item) &&
        (!item.sceneTemplateId || item.sceneTemplateId === templateId)
    )
    .sort((a, b) => (Number(a.zIndex) || 0) - (Number(b.zIndex) || 0));
  const currentTriggers = Array.isArray(slide.triggers) ? slide.triggers : [];
  const nonTemplateTriggers = currentTriggers.filter(
    (item) => !isGeneratedSceneTemplateObject(item) && !isGeneratedAnswerTemplateObject(item)
  );
  const rawManualClickTargets = new Set(
    nonTemplateTriggers
      .filter((trigger) => (trigger.when || 'onClick') === 'onClick')
      .map((trigger) => trigger.target)
      .filter(Boolean)
  );

  if (!templateId) {
    return {
      ...slide,
      sceneTemplateId: '',
      sceneTemplatePresetId: '',
      sceneTemplateVersion: 0,
      activeLayerId: 'base',
      selectedObjectId: null,
      objects: nonTemplateObjects,
      triggers: nonTemplateTriggers,
      timeline: syncTimelineWithObjects({ ...slide, objects: nonTemplateObjects }),
    };
  }

  if (templateId !== SCENE_TEMPLATE_BUTTON_INTRO_ID && templateId !== SCENE_TEMPLATE_LAUNCH_PAGE_ID)
    return slide;

  const templateResult =
    templateId === SCENE_TEMPLATE_LAUNCH_PAGE_ID
      ? buildLaunchPageSceneTemplate(slide, presetId)
      : buildButtonIntroSceneTemplateObjects(slide, presetId);
  const generatedObjects = (templateResult.objects || []).map((item, index) => ({
    ...item,
    sceneTemplateSlotId: getSceneTemplateSlotId(item, templateId, index),
  }));
  const isOutdatedSceneTemplate =
    Number(slide.sceneTemplateVersion || 0) < SCENE_TEMPLATE_VERSION ||
    currentGeneratedObjects.some(
      (item) => Number(item.sceneTemplateVersion || 0) < SCENE_TEMPLATE_VERSION
    );
  const respectDeletedSlots =
    respectDeletedSlotsOption &&
    !replaceExisting &&
    !isOutdatedSceneTemplate &&
    currentGeneratedObjects.some((item) => item.sceneTemplateSlotId);
  const currentBySlot = new Map(
    currentGeneratedObjects.map((item, index) => [
      getSceneTemplateSlotId(item, templateId, index),
      item,
    ])
  );
  if (templateId === SCENE_TEMPLATE_BUTTON_INTRO_ID) {
    const startSlotId = `${templateId}:start-button`;
    const closeSlotId = `${templateId}:close-button`;
    if (!currentBySlot.has(startSlotId)) {
      const currentStart = currentGeneratedObjects.find((item) =>
        String(item.label || '')
          .toLocaleUpperCase('tr-TR')
          .includes('ETKİNLİĞİ BAŞLAT')
      );
      if (currentStart) currentBySlot.set(startSlotId, currentStart);
    }
    if (!currentBySlot.has(closeSlotId)) {
      const currentClose = currentGeneratedObjects.find(
        (item) =>
          item.type === 'button' && ['×', 'X', '✕', '✖'].includes(String(item.label || '').trim())
      );
      if (currentClose) currentBySlot.set(closeSlotId, currentClose);
    }
  }
  if (templateId === SCENE_TEMPLATE_LAUNCH_PAGE_ID) {
    const startSlotId = `${templateId}:start-button`;
    const introSlotId = `${templateId}:intro-button`;
    if (!currentBySlot.has(startSlotId)) {
      const currentStart = currentGeneratedObjects.find((item) =>
        String(item.label || '')
          .toLocaleUpperCase('tr-TR')
          .includes('ETKİNLİĞİ BAŞLAT')
      );
      if (currentStart) currentBySlot.set(startSlotId, currentStart);
    }
    if (!currentBySlot.has(introSlotId)) {
      const currentIntro = currentGeneratedObjects.find((item) =>
        String(item.label || '')
          .toLocaleUpperCase('tr-TR')
          .includes('ETKİNLİK TANITIMI')
      );
      if (currentIntro) currentBySlot.set(introSlotId, currentIntro);
    }
  }
  const generatedIdMap = new Map();
  const nextGeneratedObjects = generatedObjects
    .filter(
      (item) =>
        !respectDeletedSlots ||
        currentBySlot.has(item.sceneTemplateSlotId) ||
        item.forceSceneTemplateLayout === true
    )
    .map((item) => {
      const current = currentBySlot.get(item.sceneTemplateSlotId);
      if (!current) {
        generatedIdMap.set(item.id, item.id);
        return item;
      }
      const preserveUserLayout =
        current.userEditedSceneTemplate === true && item.forceSceneTemplateLayout !== true;
      const shouldPreserveObjectAction =
        templateId !== SCENE_TEMPLATE_BUTTON_INTRO_ID ||
        isButtonIntroInteractiveSlot(item) ||
        isButtonIntroInteractiveSlot(current);
      const merged = {
        ...item,
        id: current.id,
        visible: current.visible,
        locked: current.locked ?? item.locked,
        ...(preserveUserLayout
          ? {
              x: current.x,
              y: current.y,
              width: current.width,
              height: current.height,
              rotation: current.rotation,
              label: current.label,
              text: current.text,
              content: current.content,
            }
          : {}),
        runtimeAction: rawManualClickTargets.has(current.id)
          ? ''
          : shouldPreserveObjectAction
            ? current.runtimeAction || item.runtimeAction
            : item.runtimeAction,
        variableBindings: current.variableBindings || item.variableBindings,
        sceneTemplateSlotId: item.sceneTemplateSlotId,
      };
      generatedIdMap.set(item.id, merged.id);
      return merged;
    });
  const nextGeneratedIds = new Set(nextGeneratedObjects.map((item) => item.id));
  const styledNonTemplateObjects = preserveNonGenerated ? nonTemplateObjects : [];
  const targetObjectsById = new Map(nextGeneratedObjects.map((item) => [item.id, item]));
  const autoTargets = getSceneTemplateAutoTargets(slide, {
    slides: options.slides,
    currentSlideId: options.currentSlideId,
  });
  const generatedTriggers = (templateResult.triggers || [])
    .map((trigger) => {
      const target = generatedIdMap.get(trigger.target) || trigger.target;
      const targetObject = targetObjectsById.get(target) || {};
      return {
        ...trigger,
        target,
        value: getSceneTemplateDefaultTriggerValue(templateId, trigger, targetObject, autoTargets),
      };
    })
    .filter((trigger) => nextGeneratedIds.has(trigger.target));
  const buttonIntroAllowedClickTargets =
    templateId === SCENE_TEMPLATE_BUTTON_INTRO_ID
      ? new Set(nextGeneratedObjects.filter(isButtonIntroInteractiveSlot).map((item) => item.id))
      : null;
  const preservedNonTemplateTriggers = buttonIntroAllowedClickTargets
    ? nonTemplateTriggers.filter(
        (trigger) =>
          (trigger.when || 'onClick') !== 'onClick' ||
          buttonIntroAllowedClickTargets.has(trigger.target)
      )
    : nonTemplateTriggers;
  const manualClickTargets = new Set(
    preservedNonTemplateTriggers
      .filter((trigger) => (trigger.when || 'onClick') === 'onClick')
      .map((trigger) => trigger.target)
  );
  const nextGeneratedTriggers = generatedTriggers.filter(
    (trigger) => !manualClickTargets.has(trigger.target)
  );
  const nextObjects = (
    replaceExisting ? generatedObjects : [...styledNonTemplateObjects, ...nextGeneratedObjects]
  ).map((object) =>
    object?.type === 'button'
      ? { ...object, style: ensureTtkbButtonTextContrast(object.style || {}) }
      : object
  );
  const nextTriggers = replaceExisting
    ? generatedTriggers
    : [...preservedNonTemplateTriggers, ...nextGeneratedTriggers];

  return {
    ...slide,
    sceneTemplateId: templateId,
    sceneTemplatePresetId: presetId,
    sceneTemplateVersion: SCENE_TEMPLATE_VERSION,
    activeLayerId: 'base',
    selectedObjectId: null,
    triggers: nextTriggers,
    objects: nextObjects,
    timeline: syncTimelineWithObjects({ ...slide, objects: nextObjects }),
  };
}

export {
  SCENE_TEMPLATE_OPTIONS,
  SCENE_TEMPLATE_VERSION,
  SCENE_TEMPLATE_BUTTON_INTRO_ID,
  SCENE_TEMPLATE_LAUNCH_PAGE_ID,
  DEFAULT_ANSWER_LAYER_STYLE_PRESET_ID,
  DEFAULT_BOOK_LAYER_PRESET_NAME,
  EDUCATION_BUTTON_TEXT_SIZE_SMALL,
  isButtonIntroDemoButton,
  buildButtonIntroSceneTemplateObjects,
  buildLaunchPageSceneTemplate,
  normalizeSingleButtonIcon,
  getButtonPairSemanticIcon,
  applySceneTemplateToSlide,
};
