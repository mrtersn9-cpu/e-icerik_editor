import fs from 'fs';
import path from 'path';

const srcPath = path.resolve('src/EIcerikEditor.jsx');
const destPath = path.resolve('src/logic/dragDrop.js');

const ranges = [
  [4541, 4568],   // getActivityDragDropDefaults
  [11260, 11265], // getDragDropSettings
  [11267, 11418], // DRAG_DROP_ANIMATION_PRESETS + getDragDropAnimationPreset
  [11420, 11422], // normalizeDragDropMatchValue
  [11424, 11426], // getDragDropScopeKey
  [11428, 11435], // areDragDropScopesCompatible
  [11437, 11440], // isDragReusable
  [11442, 11447], // getDropCapacityLimit
  [11449, 11451], // getDragDropPairKey
  [11453, 11455], // getDragDropPairsFromMatches
  [11457, 11470], // buildDragDropMatchMapFromPairs
  [11655, 11660], // getCorrectDragMatches
  [11662, 11664], // createDragDropPlacement
  [11666, 11670], // buildDragDropPlacementsFromMatches
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

const importBlock = `import { DEFAULT_DRAG_DROP_SETTINGS } from '../constants';
import {
  normalizeStorylineDragDropMatchValue,
  getStorylineRuntimeKey,
  getStorylineDragDropPairKey,
  getStorylineDragDropPairsFromMatches,
  getStorylineRuntimeCorrectDragMatches,
} from '../utils/storylineRuntime';
import { createDragDropDefaults, upgradeDragDropStyle } from './factories';
import { uid } from '../utils/editorHelpers';

`;

fs.mkdirSync(path.dirname(destPath), { recursive: true });
fs.writeFileSync(destPath, importBlock + extracted.join('\n') + '\n');

const remaining = lines.filter((_, i) => !toRemove.has(i));
fs.writeFileSync(srcPath, remaining.join('\n'));

console.log(`Extracted ${extracted.length} lines to ${destPath}`);
console.log(`Remaining ${remaining.length} lines in ${srcPath}`);
