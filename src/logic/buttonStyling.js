import {
  BUTTON_PACKAGES,
  ANSWER_LAYER_STYLE_PRESETS,
  PACKAGE_SCREEN_THEMES,
  BUTTON_PACKAGE_MOTION_PRESETS,
} from '../constants';
import {
  contrastSafeButtonStyle,
  cssColorWithAlpha,
  parseCssColorSamples,
} from '../editor-logic/colorUtils';
import { normalizeRuntimeActionLabel } from '../utils/storylineRuntime';

import { normalizeLayerNameKey } from './factories';

const DEFAULT_ANSWER_LAYER_STYLE_PRESET_ID = ANSWER_LAYER_STYLE_PRESETS[0]?.id || 'aurora-glass';
const SCENE_TEMPLATE_BUTTON_INTRO_ID = 'button-intro';

function clampColorChannel(value) {
  return Math.max(0, Math.min(255, Math.round(Number(value) || 0)));
}
function rgbToHex([r, g, b] = [0, 0, 0]) {
  return `#${[r, g, b].map((channel) => clampColorChannel(channel).toString(16).padStart(2, '0')).join('')}`;
}
// factor > 0 → beyaza doğru aç, factor < 0 → siyaha doğru koyulaştır
function shadeRgb([r, g, b] = [0, 0, 0], factor = 0) {
  return factor >= 0
    ? [r + (255 - r) * factor, g + (255 - g) * factor, b + (255 - b) * factor]
    : [r * (1 + factor), g * (1 + factor), b * (1 + factor)];
}
// 'theme' tonu: butonun rengini temanın kendi vurgu gradyanından (accentGradient) türetir.
// Böylece her tema kendi tek rengini verir; "bir mavi bir yeşil" karmaşası olmaz.
function deriveThemeToneColors(preset = {}) {
  const samples = parseCssColorSamples(preset?.accentGradient || '');
  if (!samples.length) return null;
  const first = samples[0];
  const last = samples[samples.length - 1];
  const mid = samples[Math.floor((samples.length - 1) / 2)] || first;
  return {
    top: rgbToHex(shadeRgb(first, 0.22)),
    mid: rgbToHex(mid),
    bottom: rgbToHex(last),
    dark: rgbToHex(shadeRgb(last, -0.34)),
    light: rgbToHex(shadeRgb(first, 0.48)),
    text: preset?.accentText || '#ffffff',
  };
}

function getAnswerLayerStylePresetById(presetId = '') {
  return (
    ANSWER_LAYER_STYLE_PRESETS.find((item) => item.id === presetId) ||
    ANSWER_LAYER_STYLE_PRESETS[0] ||
    null
  );
}
function getPresetToneColors(preset = {}, tone = 'accent') {
  const id = String(preset?.id || '');
  const toneKey = String(tone || 'accent');
  const family = {
    accent: {
      top: '#49d6ff',
      mid: '#0ea5e9',
      bottom: '#075985',
      dark: '#06456b',
      light: '#cffafe',
      text: '#ffffff',
    },
    primary: {
      top: '#7ee7ff',
      mid: '#2bb3ff',
      bottom: '#2563eb',
      dark: '#1d4ed8',
      light: '#ffffff',
      text: '#ffffff',
    },
    success: {
      top: '#9afc55',
      mid: '#28b82f',
      bottom: '#157a19',
      dark: '#0f5e13',
      light: '#d9ffb5',
      text: '#ffffff',
    },
    danger: {
      top: '#ff6b6b',
      mid: '#ef233c',
      bottom: '#9f1239',
      dark: '#7f102a',
      light: '#ffd2dc',
      text: '#ffffff',
    },
    warning: {
      top: '#ffd166',
      mid: '#fb923c',
      bottom: '#c2410c',
      dark: '#8a2b07',
      light: '#ffedd5',
      text: '#ffffff',
    },
    info: {
      top: '#67e8f9',
      mid: '#06b6d4',
      bottom: '#0e7490',
      dark: '#155e75',
      light: '#cffafe',
      text: '#ffffff',
    },
    neutral: {
      top: '#7dd3fc',
      mid: '#0ea5e9',
      bottom: '#0369a1',
      dark: '#075985',
      light: '#e0f2fe',
      text: '#ffffff',
    },
    soft: {
      top: '#ffffff',
      mid: '#f8fafc',
      bottom: '#dbeafe',
      dark: '#94a3b8',
      light: '#ffffff',
      text: preset?.titleColor || '#0f172a',
    },
  };
  // 'theme' kadar 'accent' ve 'primary' tonları da temanın accentGradient'inden türetilir.
  // (Aksi halde bunlar sabit maviye düşüp tema değişiminde mavi kalıyordu — örn. ikon daireleri.)
  if (toneKey === 'theme' || toneKey === 'accent' || toneKey === 'primary') {
    const themeColors = deriveThemeToneColors(preset);
    if (themeColors) return themeColors;
  }
  const colors = { ...(family[toneKey] || family.accent) };
  if (id === 'sunset-card') {
    if (toneKey === 'success')
      return {
        top: '#9afc55',
        mid: '#22c55e',
        bottom: '#15803d',
        dark: '#166534',
        light: '#dcfce7',
        text: '#ffffff',
      };
    if (toneKey === 'danger')
      return {
        top: '#ff7a6b',
        mid: '#ef4444',
        bottom: '#b91c1c',
        dark: '#7f1d1d',
        light: '#fee2e2',
        text: '#ffffff',
      };
    if (toneKey === 'info' || toneKey === 'primary')
      return {
        top: '#7dd3fc',
        mid: '#0ea5e9',
        bottom: '#0369a1',
        dark: '#075985',
        light: '#e0f2fe',
        text: '#ffffff',
      };
    if (toneKey === 'soft')
      return {
        top: '#ffffff',
        mid: '#ffe8d2',
        bottom: '#f8b26a',
        dark: '#c25b18',
        light: '#fff4e6',
        text: '#7c2d12',
      };
  }
  if (id === 'obsidian-neon') {
    if (toneKey === 'success')
      return {
        top: '#86efac',
        mid: '#22c55e',
        bottom: '#166534',
        dark: '#052e16',
        light: '#bbf7d0',
        text: '#f0fdf4',
      };
    if (toneKey === 'danger')
      return {
        top: '#ff5c8a',
        mid: '#f43f5e',
        bottom: '#9f1239',
        dark: '#4c0519',
        light: '#fecdd3',
        text: '#fff1f2',
      };
    if (toneKey === 'warning')
      return {
        top: '#fde68a',
        mid: '#f59e0b',
        bottom: '#92400e',
        dark: '#451a03',
        light: '#fef3c7',
        text: '#fffbeb',
      };
    if (toneKey === 'soft' || toneKey === 'neutral')
      return {
        top: '#64748b',
        mid: '#1e293b',
        bottom: '#020617',
        dark: '#000000',
        light: '#94a3b8',
        text: '#f8fafc',
      };
  }
  if (id === 'mint-board') {
    if (toneKey === 'danger')
      return {
        top: '#ff8fa3',
        mid: '#f43f5e',
        bottom: '#be123c',
        dark: '#881337',
        light: '#ffe4e6',
        text: '#ffffff',
      };
    if (toneKey === 'warning')
      return {
        top: '#fde68a',
        mid: '#f59e0b',
        bottom: '#b45309',
        dark: '#78350f',
        light: '#fef3c7',
        text: '#ffffff',
      };
    if (toneKey === 'soft')
      return {
        top: '#ffffff',
        mid: '#ecfdf5',
        bottom: '#99f6e4',
        dark: '#0f766e',
        light: '#f0fdfa',
        text: '#064e3b',
      };
  }
  if (id === 'violet-stage' || id === 'lavender-soft') {
    if (toneKey === 'success')
      return {
        top: '#bef264',
        mid: '#22c55e',
        bottom: '#15803d',
        dark: '#166534',
        light: '#ecfccb',
        text: '#ffffff',
      };
    if (toneKey === 'danger')
      return {
        top: '#ff8fb1',
        mid: '#ec4899',
        bottom: '#be185d',
        dark: '#831843',
        light: '#fce7f3',
        text: '#ffffff',
      };
    if (toneKey === 'warning')
      return {
        top: '#fde68a',
        mid: '#f59e0b',
        bottom: '#b45309',
        dark: '#78350f',
        light: '#fef3c7',
        text: '#ffffff',
      };
    if (toneKey === 'soft')
      return {
        top: '#ffffff',
        mid: '#f5f3ff',
        bottom: '#c4b5fd',
        dark: '#7c3aed',
        light: '#faf5ff',
        text: '#4c1d95',
      };
  }
  if (id === 'lime-pulse') {
    if (toneKey === 'danger')
      return {
        top: '#ff7a6b',
        mid: '#ef4444',
        bottom: '#b91c1c',
        dark: '#7f1d1d',
        light: '#fee2e2',
        text: '#ffffff',
      };
    if (toneKey === 'warning')
      return {
        top: '#fef08a',
        mid: '#eab308',
        bottom: '#a16207',
        dark: '#713f12',
        light: '#fef9c3',
        text: '#ffffff',
      };
    if (toneKey === 'info' || toneKey === 'primary')
      return {
        top: '#7dd3fc',
        mid: '#0ea5e9',
        bottom: '#0369a1',
        dark: '#075985',
        light: '#e0f2fe',
        text: '#ffffff',
      };
  }
  if (id === 'amber-console') {
    if (toneKey === 'success')
      return {
        top: '#a3e635',
        mid: '#22c55e',
        bottom: '#15803d',
        dark: '#14532d',
        light: '#ecfccb',
        text: '#ffffff',
      };
    if (toneKey === 'danger')
      return {
        top: '#fb923c',
        mid: '#ef4444',
        bottom: '#991b1b',
        dark: '#450a0a',
        light: '#fed7aa',
        text: '#fff7ed',
      };
    if (toneKey === 'soft' || toneKey === 'neutral')
      return {
        top: '#a16207',
        mid: '#78350f',
        bottom: '#451a03',
        dark: '#1c0a02',
        light: '#f6c16b',
        text: '#fff7ed',
      };
  }
  if (id === 'slate-minimal') {
    if (toneKey === 'success')
      return {
        top: '#4ade80',
        mid: '#16a34a',
        bottom: '#166534',
        dark: '#14532d',
        light: '#bbf7d0',
        text: '#ffffff',
      };
    if (toneKey === 'danger')
      return {
        top: '#f87171',
        mid: '#dc2626',
        bottom: '#991b1b',
        dark: '#7f1d1d',
        light: '#fecaca',
        text: '#ffffff',
      };
    if (toneKey === 'warning')
      return {
        top: '#fbbf24',
        mid: '#d97706',
        bottom: '#92400e',
        dark: '#78350f',
        light: '#fde68a',
        text: '#ffffff',
      };
  }
  return colors;
}
function getPresetButtonShapeStyle(preset = {}, tone = 'accent') {
  const id = String(preset?.id || '');
  const isSoft = tone === 'soft';
  const isDanger = tone === 'danger';
  const isSuccess = tone === 'success';
  const toneColor = getPresetToneColors(preset, tone);
  const glossyBackground = (top, mid, bottom) =>
    `linear-gradient(180deg,rgba(255,255,255,.88) 0%,rgba(255,255,255,.34) 34%,rgba(255,255,255,0) 35%), linear-gradient(180deg,${top} 0%,${mid} 52%,${bottom} 100%)`;
  const pillGloss = (colors = toneColor) => ({
    borderRadius: 999,
    borderWidth: 3,
    background: glossyBackground(colors.top, colors.mid, colors.bottom),
    borderColor: colors.light,
    color: colors.text,
    textShadow: '0 2px 0 rgba(0,0,0,.32), 0 0 8px rgba(255,255,255,.2)',
    boxShadow: `inset 0 3px 0 rgba(255,255,255,.62), inset 0 -7px 0 rgba(0,0,0,.22), 0 7px 0 ${colors.dark}, 0 18px 28px rgba(0,0,0,.24)`,
  });

  if (id === 'obsidian-neon') {
    return {
      borderRadius: isSoft ? 999 : 14,
      borderWidth: 2,
      background: `linear-gradient(180deg,rgba(255,255,255,.18) 0%,rgba(255,255,255,.04) 42%,rgba(0,0,0,.18) 43%), linear-gradient(180deg,${toneColor.top} 0%,${toneColor.mid} 48%,${toneColor.bottom} 100%)`,
      borderColor: toneColor.light,
      color: toneColor.text,
      textShadow: `0 0 8px ${isDanger ? 'rgba(244,63,94,.8)' : isSuccess ? 'rgba(34,197,94,.76)' : 'rgba(34,211,238,.75)'}`,
      boxShadow: `inset 0 2px 0 rgba(255,255,255,.24), inset 0 -5px 0 rgba(0,0,0,.45), 0 0 0 1px ${toneColor.light}66, 0 0 18px ${toneColor.mid}66, 0 16px 30px rgba(2,6,23,.42)`,
    };
  }
  if (id === 'sunset-card') {
    return pillGloss(
      isSoft
        ? {
            top: '#ffffff',
            mid: '#ffe8d2',
            bottom: '#f8b26a',
            dark: '#c25b18',
            light: '#fff4e6',
            text: '#7c2d12',
          }
        : toneColor
    );
  }
  if (id === 'mint-board') {
    return {
      borderRadius: isSoft ? 18 : 10,
      borderWidth: 2,
      background: `linear-gradient(180deg,rgba(255,255,255,.76) 0%,rgba(255,255,255,.22) 37%,rgba(255,255,255,0) 38%), linear-gradient(180deg,${toneColor.top} 0%,${toneColor.mid} 48%,${toneColor.bottom} 100%)`,
      borderColor: toneColor.light,
      color: toneColor.text,
      textShadow: '0 1px 0 rgba(255,255,255,.75)',
      boxShadow: `inset 0 2px 0 rgba(255,255,255,.75), inset 0 -6px 0 rgba(15,118,110,.26), 0 7px 0 ${toneColor.dark}, 0 18px 30px rgba(16,185,129,.2)`,
    };
  }
  if (id === 'violet-stage') {
    return {
      borderRadius: isSoft ? 999 : 22,
      borderWidth: 2,
      background: `linear-gradient(180deg,rgba(255,255,255,.55) 0%,rgba(255,255,255,.16) 36%,rgba(255,255,255,0) 37%), linear-gradient(135deg,${toneColor.top} 0%,${toneColor.mid} 46%,${toneColor.bottom} 100%)`,
      borderColor: toneColor.light,
      color: toneColor.text,
      textShadow: '0 2px 0 rgba(49,46,129,.55), 0 0 12px rgba(236,72,153,.45)',
      boxShadow: `inset 0 3px 0 rgba(255,255,255,.44), inset 0 -7px 0 rgba(49,46,149,.32), 0 0 0 5px rgba(139,92,246,.10), 0 9px 0 ${toneColor.dark}, 0 22px 40px rgba(139,92,246,.28)`,
    };
  }
  if (id === 'rose-editorial') {
    return {
      borderRadius: 999,
      borderWidth: 3,
      background: glossyBackground(toneColor.top, toneColor.mid, toneColor.bottom),
      borderColor: toneColor.light,
      color: toneColor.text,
      textShadow: isSoft ? '0 1px 0 rgba(255,255,255,.82)' : '0 2px 0 rgba(127,29,29,.35)',
      boxShadow: `inset 0 3px 0 rgba(255,255,255,.72), inset 0 -7px 0 rgba(159,18,57,.18), 0 7px 0 ${toneColor.dark}, 0 18px 30px rgba(244,63,94,.20)`,
    };
  }
  if (id === 'lime-pulse') {
    return pillGloss(
      isSoft
        ? {
            top: '#ffffff',
            mid: '#ecfccb',
            bottom: '#a3e635',
            dark: '#4d7c0f',
            light: '#f7fee7',
            text: '#365314',
          }
        : toneColor
    );
  }
  if (id === 'slate-minimal') {
    return {
      borderRadius: isSoft ? 999 : 10,
      borderWidth: 2,
      background: isSoft
        ? 'linear-gradient(180deg,#ffffff 0%,#f1f5f9 52%,#dbe2ea 100%)'
        : `linear-gradient(180deg,rgba(255,255,255,.22) 0%,rgba(255,255,255,.05) 40%,rgba(0,0,0,.2) 41%), linear-gradient(180deg,${toneColor.top} 0%,${toneColor.mid} 55%,${toneColor.bottom} 100%)`,
      borderColor: isSoft ? '#cbd5e1' : toneColor.light,
      color: isSoft ? '#0f172a' : toneColor.text,
      textShadow: isSoft ? '0 1px 0 rgba(255,255,255,.8)' : '0 2px 0 rgba(0,0,0,.55)',
      boxShadow: isSoft
        ? 'inset 0 2px 0 rgba(255,255,255,.9), inset 0 -4px 0 rgba(148,163,184,.22), 0 10px 22px rgba(15,23,42,.12)'
        : `inset 0 2px 0 rgba(255,255,255,.22), inset 0 -6px 0 rgba(0,0,0,.5), 0 7px 0 ${toneColor.dark}, 0 18px 28px rgba(15,23,42,.28)`,
    };
  }
  if (id === 'amber-console') {
    return {
      borderRadius: isSoft ? 999 : 12,
      borderWidth: 3,
      background: `radial-gradient(circle at 20% 22%,rgba(255,255,255,.42) 0 6%,transparent 20%), linear-gradient(90deg,rgba(80,38,8,.25),rgba(255,255,255,.08),rgba(80,38,8,.22)), linear-gradient(180deg,${toneColor.top} 0%,${toneColor.mid} 48%,${toneColor.bottom} 100%)`,
      borderColor: toneColor.light,
      color: toneColor.text,
      textShadow: '0 2px 0 rgba(73,35,8,.7)',
      boxShadow: `inset 0 3px 0 rgba(255,255,255,.35), inset 0 -7px 0 rgba(60,30,8,.45), 0 8px 0 ${toneColor.dark}, 0 20px 32px rgba(0,0,0,.35)`,
    };
  }
  if (id === 'candy-pop' || id === 'kids-playground') {
    return pillGloss(
      isDanger
        ? {
            top: '#ff7aa2',
            mid: '#f43f5e',
            bottom: '#be123c',
            dark: '#881337',
            light: '#ffe4ee',
            text: '#ffffff',
          }
        : isSuccess
          ? {
              top: '#9cff5f',
              mid: '#22c55e',
              bottom: '#15803d',
              dark: '#166534',
              light: '#efffd6',
              text: '#ffffff',
            }
          : toneColor
    );
  }
  if (id === 'kids-sticker') {
    return {
      borderRadius: 26,
      borderWidth: 4,
      background: `linear-gradient(180deg,rgba(255,255,255,.84) 0%,rgba(255,255,255,.28) 34%,rgba(255,255,255,0) 35%), linear-gradient(135deg,${toneColor.top} 0%,${toneColor.mid} 54%,${toneColor.bottom} 100%)`,
      borderColor: toneColor.light,
      color: toneColor.text,
      textShadow: '0 2px 0 rgba(67,56,202,.45)',
      boxShadow: `inset 0 2px 0 rgba(255,255,255,.82), inset 0 -8px 0 rgba(37,99,235,.24), 0 8px 0 ${toneColor.dark}, 0 22px 36px rgba(59,130,246,.22)`,
    };
  }
  if (id === 'lavender-soft') {
    return {
      borderRadius: isSoft ? 999 : 24,
      borderWidth: 2,
      background: `linear-gradient(180deg,rgba(255,255,255,.78) 0%,rgba(255,255,255,.18) 38%,rgba(255,255,255,0) 39%), linear-gradient(180deg,${toneColor.top} 0%,${toneColor.mid} 52%,${toneColor.bottom} 100%)`,
      borderColor: toneColor.light,
      color: toneColor.text,
      textShadow: '0 2px 0 rgba(76,29,149,.36)',
      boxShadow: `inset 0 2px 0 rgba(255,255,255,.68), inset 0 -6px 0 rgba(76,29,149,.24), 0 7px 0 ${toneColor.dark}, 0 18px 34px rgba(168,85,247,.22)`,
    };
  }

  return pillGloss(toneColor);
}
function getReadyButtonTone(object = {}) {
  if (object.readyButtonTone) return object.readyButtonTone;
  const labelKey = normalizeRuntimeActionLabel(object.label || object.text || '');
  const action = String(object.runtimeAction || '');
  // Sabit yeşil: yalnızca "Çözümü Göster" ve "Tamamla"
  if (
    action === 'show-answer' ||
    labelKey.includes('cozumugoster') ||
    labelKey.includes('showanswer') ||
    labelKey.includes('showsolution')
  )
    return 'success';
  if (
    action === 'complete' ||
    labelKey.includes('tamamla') ||
    labelKey.includes('complete') ||
    labelKey.includes('closeactivity')
  )
    return 'success';
  // Sabit kırmızı: "Yeniden Başlat" / "Tekrarla"
  if (
    action === 'restart' ||
    labelKey.includes('yenidenbaslat') ||
    labelKey.includes('restart') ||
    labelKey.includes('retry') ||
    labelKey.includes('tekrar')
  )
    return 'danger';
  // Geri kalan tüm hazır/kontrol butonları (Kontrol Et, Menü, Geri/İleri, Play/Pause,
  // Ses, Ana Sayfa, Tanıtım/Yardım, Başlat) → tema rengi
  if (
    object.isCheckButton ||
    labelKey.includes('kontrolet') ||
    labelKey === 'check' ||
    action === 'toggle-mute' ||
    labelKey.includes('sesikapat') ||
    labelKey.includes('mute') ||
    action === 'toggle-play-pause' ||
    labelKey.includes('playpause') ||
    labelKey.includes('menu') ||
    labelKey.includes('geri') ||
    labelKey.includes('ileri') ||
    labelKey.includes('back') ||
    labelKey.includes('next') ||
    action === 'home' ||
    labelKey.includes('anasayfa') ||
    labelKey.includes('home') ||
    action === 'help' ||
    action === 'show-help' ||
    labelKey.includes('tanitim') ||
    labelKey.includes('intro') ||
    labelKey.includes('baslat') ||
    labelKey.includes('start')
  )
    return 'theme';
  return '';
}

function getButtonPackageTone(object = {}) {
  if (object?.type !== 'button') return '';
  if (object.readyButtonTone) return object.readyButtonTone;
  if (object.sceneTemplateDemoAction === 'toggle-play-pause') return 'warning';
  if (object.sceneTemplateDemoAction === 'toggle-mute') return 'neutral';
  return getReadyButtonTone(object) || 'primary';
}

function shouldRestyleReadyButton(object = {}) {
  return object?.type === 'button' && !!getReadyButtonTone(object);
}

function isPlayPauseReadyButton(object = {}) {
  if (object.type && object.type !== 'button') return false;
  if (object.sceneTemplateDemoAction === 'toggle-play-pause') return false;
  const labelKey = normalizeRuntimeActionLabel(object.label || object.text || '');
  return (
    object.readyButtonPresetId === 'playpause' ||
    object.runtimeAction === 'toggle-play-pause' ||
    labelKey.includes('playpause') ||
    String(object.label || '').includes('❚❚')
  );
}

function isButtonIntroPlayPauseDemoButton(object = {}) {
  if (object.type && object.type !== 'button') return false;
  if (object.sceneTemplateDemoAction === 'toggle-play-pause') return true;
  if (object.sceneTemplateId !== SCENE_TEMPLATE_BUTTON_INTRO_ID) return false;
  const raw = String(object.label || object.text || '');
  const labelKey = normalizeRuntimeActionLabel(raw);
  return (
    raw.includes('❚❚') ||
    labelKey.includes('play') ||
    labelKey.includes('pause') ||
    labelKey.includes('oynat') ||
    labelKey.includes('duraklat')
  );
}

function getPlayPauseButtonPatch(object = {}) {
  const width = Number(object.width) || 124;
  const height = Number(object.height) || 92;
  return {
    label: '▶',
    width: width > height * 1.8 || width < 96 ? 124 : Math.min(width, 152),
    height: Math.max(height, 92),
  };
}
function buildReadyButtonStyle(stylePreset, tone = 'primary', object = {}) {
  const shapeStyle = getPresetButtonShapeStyle(stylePreset, tone);
  const toneColors = getPresetToneColors(stylePreset, tone);
  const isPlayPause = isPlayPauseReadyButton(object) || isButtonIntroPlayPauseDemoButton(object);
  return contrastSafeButtonStyle({
    background: shapeStyle.background,
    borderColor: shapeStyle.borderColor || toneColors.light,
    borderWidth: isPlayPause
      ? Math.max(3, Number(shapeStyle.borderWidth ?? 2))
      : (shapeStyle.borderWidth ?? 2),
    borderRadius: isPlayPause
      ? 999
      : Number(shapeStyle.borderRadius ?? stylePreset?.buttonRadius ?? 12),
    color: shapeStyle.color || toneColors.text || '#ffffff',
    fontSize: isPlayPause ? 30 : object.style?.fontSize || 22,
    fontWeight: 900,
    lineHeight: isPlayPause ? 1.05 : object.style?.lineHeight || 1.15,
    textAlign: 'center',
    whiteSpace: isPlayPause ? 'pre-line' : object.style?.whiteSpace || 'nowrap',
    textShadow: shapeStyle.textShadow || '0 2px 0 rgba(0,0,0,.32)',
    boxShadow: shapeStyle.boxShadow || `0 14px 28px ${toneColors.mid || '#2563eb'}33`,
  });
}

function buildReadyButtonStyleFromPackage(pkgId, tone = 'primary', object = {}) {
  const theme = getPackageTheme(pkgId);
  const isPlayPause = isPlayPauseReadyButton(object) || isButtonIntroPlayPauseDemoButton(object);
  const toneGradient = (() => {
    if (tone === 'success')
      return `linear-gradient(180deg,rgba(255,255,255,.62) 0%,rgba(255,255,255,.12) 35%,rgba(255,255,255,0) 36%), linear-gradient(135deg,${theme.successTone || theme.accent},${theme.accent || theme.border})`;
    if (tone === 'danger')
      return `linear-gradient(180deg,rgba(255,255,255,.58) 0%,rgba(255,255,255,.1) 35%,rgba(255,255,255,0) 36%), linear-gradient(135deg,${theme.dangerTone || '#ef4444'},${theme.accentDark || '#991b1b'})`;
    if (tone === 'neutral')
      return `linear-gradient(180deg,rgba(255,255,255,.45) 0%,rgba(255,255,255,.08) 36%,rgba(255,255,255,0) 37%), ${theme.play || 'linear-gradient(135deg,#111827,#334155)'}`;
    if (tone === 'warning')
      return `linear-gradient(180deg,rgba(255,255,255,.66) 0%,rgba(255,255,255,.14) 34%,rgba(255,255,255,0) 35%), linear-gradient(135deg,${theme.accent || '#f59e0b'},${theme.dangerTone || theme.accentDark || '#ea580c'})`;
    if (tone === 'info')
      return `linear-gradient(180deg,rgba(255,255,255,.6) 0%,rgba(255,255,255,.12) 35%,rgba(255,255,255,0) 36%), ${theme.intro || theme.button}`;
    return `linear-gradient(180deg,rgba(255,255,255,.6) 0%,rgba(255,255,255,.12) 35%,rgba(255,255,255,0) 36%), ${theme.button}`;
  })();
  return contrastSafeButtonStyle({
    background: toneGradient,
    borderColor: theme.border,
    borderWidth: isPlayPause ? 4 : 2,
    borderRadius: isPlayPause ? 999 : Number(theme.radius || 18),
    color: theme.text || '#ffffff',
    fontSize: isPlayPause ? 30 : object.style?.fontSize || 22,
    fontWeight: 900,
    lineHeight: isPlayPause ? 1.05 : object.style?.lineHeight || 1.15,
    textAlign: 'center',
    whiteSpace: isPlayPause ? 'pre-line' : object.style?.whiteSpace || 'nowrap',
    textShadow:
      theme.text === '#1a2e05' ? '0 1px 0 rgba(255,255,255,.4)' : '0 2px 0 rgba(0,0,0,.34)',
    boxShadow: `inset 0 3px 0 rgba(255,255,255,.58), inset 0 -7px 0 rgba(0,0,0,.2), 0 ${isPlayPause ? 7 : 8}px 0 ${theme.accentDark || theme.border}, 0 18px 30px rgba(15,23,42,.2)`,
  });
}

function restyleReadyButtonsForPreset(
  objects = [],
  presetId = DEFAULT_ANSWER_LAYER_STYLE_PRESET_ID
) {
  const stylePreset =
    getAnswerLayerStylePresetById(presetId) ||
    getAnswerLayerStylePresetById(DEFAULT_ANSWER_LAYER_STYLE_PRESET_ID);
  const motion = stylePreset?.motion || {};
  const list = objects || [];
  const byId = new Map(list.map((item) => [item?.id, item]));
  return list.map((object) => {
    if (object?.type !== 'button') return object;
    // Doğrudan algılanan ton; yoksa bağlı (linkedActionTargetId) etiket-yarısından türet.
    // Böylece glif label'lı ikon DAİRELERİ de tema değişiminde eş renge döner (önceden
    // getReadyButtonTone='' olduğu için atlanıp eski tema renginde kalıyordu).
    let tone = getReadyButtonTone(object);
    if (!tone) {
      const linkedId = object.linkedActionTargetId;
      const linked = linkedId && linkedId !== object.id ? byId.get(linkedId) : null;
      if (linked && linked !== object) tone = getReadyButtonTone(linked);
    }
    if (!tone) return object;
    const playPausePatch = isPlayPauseReadyButton(object) ? getPlayPauseButtonPatch(object) : {};
    const built = buildReadyButtonStyle(stylePreset, tone, { ...object, ...playPausePatch });
    // Yuvarlak ikon dairelerinin (kare-ish) şeklini koru — yalnızca rengi güncelle.
    // Geniş etiket pill'leri yeni temanın köşe yarıçapını alır.
    const prevRadius = Number(object.style?.borderRadius);
    const w = Number(object.width) || 0;
    const h = Number(object.height) || 0;
    const keepRound =
      Number.isFinite(prevRadius) && prevRadius >= 100 && w > 0 && h > 0 && Math.abs(w - h) <= h * 0.6;
    return {
      ...object,
      readyButtonTone: tone,
      ...playPausePatch,
      style: {
        ...(object.style || {}),
        ...built,
        ...(keepRound ? { borderRadius: prevRadius } : {}),
      },
      ...(motion ? { buttonMotion: { ...motion } } : {}),
    };
  });
}

function getAnswerLayerChromeForPreset(preset = {}, layerKey = 'normal') {
  const toneKey =
    layerKey === 'correct'
      ? 'success'
      : layerKey === 'incorrect'
        ? 'danger'
        : layerKey === 'menu'
          ? 'primary'
          : 'warning';
  const colors = getPresetToneColors(preset, toneKey);
  const panelTop = cssColorWithAlpha(
    colors.light || colors.top || preset?.surface || '#ffffff',
    0.98
  );
  const panelBottom = cssColorWithAlpha(
    colors.top || colors.mid || preset?.surfaceAlt || '#f8fafc',
    0.98,
    panelTop
  );
  return {
    toneKey,
    surface: `linear-gradient(180deg,${panelTop} 0%,${panelBottom} 100%)`,
    border: colors.light || preset?.surfaceBorder || '#d8e5f0',
    accent:
      getPresetButtonShapeStyle(preset, toneKey).background || preset?.accentGradient || colors.mid,
    text:
      layerKey === 'correct'
        ? preset?.successText || colors.bottom
        : layerKey === 'incorrect'
          ? preset?.dangerText || colors.bottom
          : preset?.titleColor || colors.bottom,
  };
}

function getLayerActionButtonStyle(preset = {}, tone = 'primary', fallback = {}) {
  const colors = getPresetToneColors(preset, tone);
  const shapeStyle = getPresetButtonShapeStyle(preset, tone);
  // 'theme' (ve tabloda olmayan tonlar) için sabit palete düşme; getPresetToneColors'tan
  // gelen tema-türevli `colors` kullanılsın ki tema rengi korunsun (mavi'ye zorlamayalım).
  const strong = {
    success: { top: '#9afc55', mid: '#22c55e', bottom: '#15803d', dark: '#166534' },
    danger: { top: '#ff6b7a', mid: '#ef233c', bottom: '#9f1239', dark: '#7f102a' },
    warning: { top: '#ffd166', mid: '#fb923c', bottom: '#c2410c', dark: '#8a2b07' },
    info: { top: '#67e8f9', mid: '#06b6d4', bottom: '#0e7490', dark: '#155e75' },
    neutral: { top: '#7dd3fc', mid: '#0ea5e9', bottom: '#0369a1', dark: '#075985' },
  }[tone] || null;
  const top = strong?.top || colors.top || fallback.background || '#38bdf8';
  const mid = strong?.mid || colors.mid || top;
  const bottom = strong?.bottom || colors.bottom || colors.dark || mid;
  const dark = strong?.dark || colors.dark || bottom;
  const textColor = tone === 'soft' ? preset?.titleColor || '#0f172a' : '#ffffff';
  return contrastSafeButtonStyle({
    background: `linear-gradient(180deg,rgba(255,255,255,.66) 0%,rgba(255,255,255,.16) 34%,rgba(255,255,255,0) 35%), linear-gradient(180deg,${top} 0%,${mid} 54%,${bottom} 100%)`,
    borderColor: shapeStyle.borderColor || colors.light || preset?.surfaceBorder || '#d8e5f0',
    borderWidth: Math.max(2, Number(shapeStyle.borderWidth ?? 2) || 2),
    borderRadius: shapeStyle.borderRadius ?? Number(preset?.buttonRadius || 14),
    color: textColor,
    textShadow:
      textColor === '#ffffff' ? '0 2px 0 rgba(0,0,0,.32)' : '0 1px 0 rgba(255,255,255,.55)',
    boxShadow:
      shapeStyle.boxShadow ||
      `inset 0 2px 0 rgba(255,255,255,.62), inset 0 -6px 0 rgba(0,0,0,.18), 0 7px 0 ${dark}, 0 16px 28px rgba(15,23,42,.22)`,
  });
}

function restyleAnswerLayerObjectsForPreset(
  objects = [],
  layers = [],
  resolvedLayerNames = {},
  presetId = DEFAULT_ANSWER_LAYER_STYLE_PRESET_ID
) {
  const preset =
    getAnswerLayerStylePresetById(presetId) ||
    getAnswerLayerStylePresetById(DEFAULT_ANSWER_LAYER_STYLE_PRESET_ID);
  const layerKeyById = Object.fromEntries(
    (layers || []).map((layer) => [
      layer.id,
      normalizeLayerNameKey(resolvedLayerNames[layer.id] || layer.name || ''),
    ])
  );
  const targetKeys = new Set(['normal', 'correct', 'incorrect', 'menu']);
  const dimOpacity = Math.max(0.07, Number(preset?.dimOpacity ?? 0.07) || 0.07);
  const panelRadius = Number(preset?.panelRadius || 18);
  const surfaceShadow = preset?.surfaceShadow || '0 24px 48px rgba(15,23,42,.16)';
  const insetShadow = preset?.insetShadow || 'inset 0 1px 0 rgba(255,255,255,.82)';
  const motion = preset?.motion || {};

  const isCloseLike = (object = {}) => {
    const label = String(object.label || object.text || '').trim();
    const key = normalizeRuntimeActionLabel(label);
    return (
      ['×', 'x', 'X', '✕', '✖'].includes(label) ||
      key.includes('kapat') ||
      key.includes('close') ||
      key.includes('geri')
    );
  };
  const buttonTone = (object = {}, layerKey = 'normal') => {
    const action = String(object.runtimeAction || '').toLowerCase();
    const labelKey = normalizeRuntimeActionLabel(object.label || object.text || '');
    if (
      isCloseLike(object) ||
      action === 'restart' ||
      labelKey.includes('yeniden') ||
      labelKey.includes('tekrar')
    )
      return 'danger';
    if (action === 'toggle-mute') return 'neutral';
    if (
      action === 'complete' ||
      action === 'show-answer' ||
      labelKey.includes('cozum') ||
      labelKey.includes('tamam')
    )
      return 'success';
    if (layerKey === 'menu' && (labelKey.includes('restart') || labelKey.includes('baslat')))
      return 'warning';
    if (layerKey === 'menu') return 'primary';
    return layerKey === 'correct' ? 'success' : layerKey === 'incorrect' ? 'danger' : 'warning';
  };
  const restyleButton = (object, layerKey) => {
    const tone = object.readyButtonTone || buttonTone(object, layerKey);
    const layerButtonStyle = getLayerActionButtonStyle(preset, tone);
    const labelKey = normalizeRuntimeActionLabel(object.label || object.text || '');
    const isSolutionButton =
      String(object.runtimeAction || '').toLowerCase() === 'show-answer' ||
      labelKey.includes('cozumugoster') ||
      labelKey.includes('cevabigoster') ||
      labelKey.includes('showanswer') ||
      labelKey.includes('showsolution');
    const solutionLabel = (() => {
      if (!isSolutionButton) return {};
      const raw = String(object.label || object.text || 'ÇÖZÜMÜ GÖSTER').trim();
      const stripped = raw.replace(/^[^\p{L}\p{N}]+/u, '').trim() || 'ÇÖZÜMÜ GÖSTER';
      return { label: `✎  ${stripped}`, text: `✎  ${stripped}` };
    })();
    return {
      ...object,
      ...solutionLabel,
      readyButtonTone: tone,
      buttonMotion: { ...motion, ...(object.buttonMotion || {}) },
      style: {
        ...(object.style || {}),
        ...layerButtonStyle,
        fontWeight: 900,
        textAlign: 'center',
      },
    };
  };

  return (objects || []).map((object) => {
    const layerKey = layerKeyById[object.layerId || 'base'] || '';
    if (!targetKeys.has(layerKey)) return object;
    const chrome = getAnswerLayerChromeForPreset(preset, layerKey);
    const style = object.style || {};
    const width = Number(object.width) || 0;
    const height = Number(object.height) || 0;
    const x = Number(object.x) || 0;
    const y = Number(object.y) || 0;
    const isFullDim = object.type === 'shape' && x <= 2 && y <= 2 && width >= 1000 && height >= 600;

    if (isFullDim) {
      return {
        ...object,
        style: {
          ...style,
          background: `rgba(15,23,42,${dimOpacity})`,
          borderWidth: 0,
          boxShadow: 'none',
          opacity: 1,
        },
      };
    }

    if (object.type === 'shape' && (object.shapeKind || 'roundedRect') === 'roundedRect') {
      return {
        ...object,
        style: {
          ...style,
          background: chrome.surface,
          borderColor: chrome.border,
          borderWidth: Math.max(1, Number(style.borderWidth ?? 1) || 1),
          borderRadius: Number(
            style.borderRadius ?? (layerKey === 'menu' ? panelRadius + 2 : panelRadius)
          ),
          boxShadow: `${surfaceShadow}, ${insetShadow}`,
          opacity: 1,
        },
      };
    }

    if (object.type === 'shape' && (object.shapeKind || '') === 'ellipse') {
      return {
        ...object,
        style: {
          ...style,
          background: chrome.accent,
          borderColor: chrome.border,
          borderWidth: Math.max(1, Number(style.borderWidth ?? 1) || 1),
          boxShadow:
            (preset?.motion?.hoverShadow && String(preset.motion.hoverShadow).trim()) ||
            '0 12px 24px rgba(15,23,42,.14)',
          opacity: 1,
        },
      };
    }

    if (object.type === 'button') return restyleButton(object, layerKey);

    if (object.type === 'text') {
      const labelKey = normalizeRuntimeActionLabel(object.label || object.text || '');
      const rawLabel = String(object.label || object.text || '').trim();
      const fontSize = Number(style.fontSize) || 0;
      const iconLike =
        rawLabel.length <= 2 &&
        fontSize >= 28 &&
        Math.abs(width - height) <= Math.max(18, Math.min(width, height) * 0.45);
      const forcedIcon = iconLike
        ? layerKey === 'correct'
          ? '✓'
          : layerKey === 'incorrect'
            ? '×'
            : layerKey === 'normal'
              ? '!'
              : rawLabel
        : rawLabel;
      const titleLike =
        labelKey.includes('dogru') ||
        labelKey.includes('yanlis') ||
        (!iconLike && labelKey.length <= 10);
      return {
        ...object,
        ...(iconLike ? { label: forcedIcon, text: forcedIcon } : {}),
        style: {
          ...style,
          color: iconLike ? '#ffffff' : titleLike ? chrome.text : preset?.bodyColor || '#334155',
          textShadow: iconLike ? '0 2px 0 rgba(0,0,0,.34)' : style.textShadow || 'none',
        },
      };
    }

    return object;
  });
}

function restyleReadyButtonsForPackage(objects = [], pkgId = BUTTON_PACKAGES[0]?.id || 'pkg-1') {
  const packageMotion = getButtonPackageMotion(pkgId);
  return (objects || []).map((object) => {
    if (!shouldRestyleReadyButton(object)) return object;
    const tone = getReadyButtonTone(object);
    const playPausePatch = isPlayPauseReadyButton(object) ? getPlayPauseButtonPatch(object) : {};
    return {
      ...object,
      readyButtonTone: tone,
      ...(packageMotion ? { buttonMotion: packageMotion } : {}),
      ...playPausePatch,
      style: {
        ...(object.style || {}),
        ...buildReadyButtonStyleFromPackage(pkgId, tone, {
          ...object,
          ...playPausePatch,
        }),
      },
    };
  });
}

function restyleAllButtonsForPackage(objects = [], pkgId = BUTTON_PACKAGES[0]?.id || 'pkg-1') {
  const packageMotion = getButtonPackageMotion(pkgId);
  return (objects || []).map((object) => {
    if (object?.type !== 'button') return object;
    const tone = getButtonPackageTone(object);
    const playPausePatch = isPlayPauseReadyButton(object) ? getPlayPauseButtonPatch(object) : {};
    return {
      ...object,
      buttonPackageId: pkgId,
      readyButtonTone: tone,
      ...(packageMotion ? { buttonMotion: packageMotion } : {}),
      ...playPausePatch,
      style: {
        ...(object.style || {}),
        ...buildReadyButtonStyleFromPackage(pkgId, tone, {
          ...object,
          ...playPausePatch,
        }),
      },
    };
  });
}
function getPackageTheme(pkgId) {
  return PACKAGE_SCREEN_THEMES[pkgId] || PACKAGE_SCREEN_THEMES['pkg-1'];
}

function getButtonPackageMotion(pkgId) {
  const pkg = BUTTON_PACKAGES.find((item) => item.id === pkgId) || BUTTON_PACKAGES[0] || {};
  return pkg.buttonMotion && typeof pkg.buttonMotion === 'object' ? { ...pkg.buttonMotion } : null;
}

function getButtonMotionProfile(profileId = '') {
  const key = String(profileId || '');
  return (
    (BUTTON_PACKAGE_MOTION_PRESETS[key] && { ...BUTTON_PACKAGE_MOTION_PRESETS[key] }) ||
    getButtonPackageMotion(BUTTON_PACKAGES[0]?.id || 'pkg-1') ||
    null
  );
}

function getActivityButtonMotion(activity = {}) {
  return (
    getButtonMotionProfile(activity.buttonAnimationProfileId) ||
    getButtonPackageMotion(activity.buttonPackageId)
  );
}

export {
  getAnswerLayerStylePresetById,
  getPresetToneColors,
  getPresetButtonShapeStyle,
  getReadyButtonTone,
  getButtonPackageTone,
  shouldRestyleReadyButton,
  isPlayPauseReadyButton,
  isButtonIntroPlayPauseDemoButton,
  getPlayPauseButtonPatch,
  buildReadyButtonStyle,
  buildReadyButtonStyleFromPackage,
  restyleReadyButtonsForPreset,
  getAnswerLayerChromeForPreset,
  getLayerActionButtonStyle,
  restyleAnswerLayerObjectsForPreset,
  restyleReadyButtonsForPackage,
  restyleAllButtonsForPackage,
  getPackageTheme,
  getButtonPackageMotion,
  getButtonMotionProfile,
  getActivityButtonMotion,
};

