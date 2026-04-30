import fs from 'fs';
import path from 'path';

const srcPath = path.resolve('src/EIcerikEditor.jsx');
const destPath = path.resolve('src/logic/normalize.js');

const ranges = [
  [4511, 4519], // normalizeVariable
  [4521, 4538], // normalizeObject
  [4909, 4913], // getDefaultVariableValue
  [5018, 5029], // castVariableValue
  [5031, 5038], // createVariableItem
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

const importBlock = `import { VARIABLE_TYPES, OBJ_PRESETS } from '../constants';
import { ensureTtkbButtonTextContrast } from '../editor-logic/colorUtils';
import { upgradeDragDropStyle } from './factories';
import { isPlayPauseReadyButton, getPlayPauseButtonPatch } from './buttonStyling';
import { uid } from '../utils/editorHelpers';

`;

fs.mkdirSync(path.dirname(destPath), { recursive: true });
fs.writeFileSync(destPath, importBlock + extracted.join('\n') + '\n');

const remaining = lines.filter((_, i) => !toRemove.has(i));
fs.writeFileSync(srcPath, remaining.join('\n'));

console.log(`Extracted ${extracted.length} lines to ${destPath}`);
console.log(`Remaining ${remaining.length} lines in ${srcPath}`);
