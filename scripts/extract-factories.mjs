import fs from 'fs';
import path from 'path';

const srcPath = path.resolve('src/EIcerikEditor.jsx');
const destPath = path.resolve('src/logic/factories.js');

// Satır aralıkları (1-indexed, inclusive) — artan sırada
const ranges = [
  [5388, 5404],   // createDefaultThemePackageItems + resolveThemePackageItems
  [5413, 5426],   // normalizeLayerNameKey + getBaseLayerAutoName
  [5473, 5533],   // normalizeStyleToken + upgradeDragDropStyle + createDragDropDefaults
  [6048, 6687],   // layer helpers + all factories
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

const importBlock = `import { uid } from '../helpers/editorHelpers';
import {
  BUTTON_PACKAGES,
  DEFAULT_THEME_PACKAGE_ITEMS,
  DEFAULT_DRAG_DROP_SETTINGS,
  DEFAULT_SELECTION_UI,
  DRAGGABLE_STRONG_STYLE,
  DROPZONE_STRONG_STYLE,
  OBJ_PRESETS,
  RIBBON_SHAPE_PRESETS,
  BUTTON_STYLE_PRESETS,
  DEFAULT_ACTIVITY_SETTINGS,
  ACCESSIBILITY_DEFAULTS,
} from '../constants';

const AUTO_LAYER_NAME_PRESETS = ['menu', 'explanation', 'normal', 'Correct', 'Incorrect', 'cevap'];

`;

fs.mkdirSync(path.dirname(destPath), { recursive: true });
fs.writeFileSync(destPath, importBlock + extracted.join('\n') + '\n');

const remaining = lines.filter((_, i) => !toRemove.has(i));
fs.writeFileSync(srcPath, remaining.join('\n'));

console.log(`Extracted ${extracted.length} lines to ${destPath}`);
console.log(`Remaining ${remaining.length} lines in ${srcPath}`);
