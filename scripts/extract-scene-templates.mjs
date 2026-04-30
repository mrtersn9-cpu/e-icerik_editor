import fs from 'fs';
import path from 'path';

const srcPath = path.resolve('src/EIcerikEditor.jsx');
const destPath = path.resolve('src/logic/sceneTemplates.js');

const ranges = [
  [359, 365],    // getActivityContentLanguage + contentText
  [2531, 2536],  // getSceneTemplateSlotId
  [544, 552],    // isButtonIntroDemoButton
  [553, 2782],   // buildButtonIntroSceneTemplateObjects + buildLaunchPageSceneTemplate
  [2784, 3843],  // applySceneTemplateToSlide
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
  DEFAULT_ANSWER_LAYER_STYLE_PRESET_ID,
  SCENE_TEMPLATE_BUTTON_INTRO_ID,
  SCENE_TEMPLATE_LAUNCH_PAGE_ID,
  SCENE_TEMPLATE_VERSION,
  CONTENT_TEXT,
} from '../constants';
import { uid } from '../utils/editorHelpers';
import { createObjectFromActivity, isGeneratedSceneTemplateObject } from './dragDrop';
import { getAnswerLayerStylePresetById } from './buttonStyling';
import { syncTimelineWithObjects } from './timeline';

`;

fs.mkdirSync(path.dirname(destPath), { recursive: true });
fs.writeFileSync(destPath, importBlock + extracted.join('\n') + '\n');

const remaining = lines.filter((_, i) => !toRemove.has(i));
fs.writeFileSync(srcPath, remaining.join('\n'));

console.log(`Extracted ${extracted.length} lines to ${destPath}`);
console.log(`Remaining ${remaining.length} lines in ${srcPath}`);
