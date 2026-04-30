import fs from 'fs';
import path from 'path';

const srcPath = path.resolve('src/EIcerikEditor.jsx');
const destPath = path.resolve('src/logic/buttonStyling.js');

const ranges = [
  [442, 448],    // getAnswerLayerStylePresetById
  [450, 751],    // getPresetToneColors
  [753, 937],    // getPresetButtonShapeStyle
  [939, 1027],   // getReadyButtonTone, getButtonPackageTone, shouldRestyleReadyButton, isPlayPauseReadyButton, isButtonIntroPlayPauseDemoButton, getPlayPauseButtonPatch
  [1029, 1401],  // main button styling functions
  [7114, 7137],  // getPackageTheme, getButtonPackageMotion, getButtonMotionProfile, getActivityButtonMotion
];

const content = fs.readFileSync(srcPath, 'utf-8');
const lines = content.split('\n');

const extracted = [];
const toRemove = new Set();

for (const [start, end] of ranges) {
  for (let i = start - 1; i < end; i++) {
    toRemove.add(i);
    extracted.push(lines[i]);
  }
}

const importBlock = `import {
  BUTTON_PACKAGES,
  ANSWER_LAYER_STYLE_PRESETS,
  PACKAGE_SCREEN_THEMES,
  BUTTON_PACKAGE_MOTION_PRESETS,
} from '../constants';
import {
  contrastSafeButtonStyle,
  cssColorWithAlpha,
} from '../editor-logic/colorUtils';
import { normalizeRuntimeActionLabel } from '../utils/editorHelpers';
import { normalizeLayerNameKey } from './factories';

const DEFAULT_ANSWER_LAYER_STYLE_PRESET_ID = ANSWER_LAYER_STYLE_PRESETS[0]?.id || 'aurora-glass';
const SCENE_TEMPLATE_BUTTON_INTRO_ID = 'button-intro';

`;

fs.mkdirSync(path.dirname(destPath), { recursive: true });
fs.writeFileSync(destPath, importBlock + extracted.join('\n') + '\n');

const remaining = lines.filter((_, i) => !toRemove.has(i));
fs.writeFileSync(srcPath, remaining.join('\n'));

console.log(`Extracted ${extracted.length} lines to ${destPath}`);
console.log(`Remaining ${remaining.length} lines in ${srcPath}`);
