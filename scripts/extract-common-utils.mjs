import fs from "fs";

const file = fs.readFileSync("src/EIcerikEditor.jsx", "utf8");
const lines = file.split("\n");

// Satır numaraları (1-indexed → 0-indexed)
const ranges = [
  [2975, 2983],   // getMedian
  [3637, 3647],   // normalizeStyleToken
  [4108, 4120],   // normalizeLayerNameKey
  [5448, 5458],   // normalizeVariable
  [5458, 5466],   // normalizeObject
  [5637, 5644],   // safeClone
  [5874, 5882],   // shuffleArray
  [5883, 5890],   // getFitScale
];

const extracted = [];
const removeSet = new Set();
for (const [start, end] of ranges) {
  for (let i = start; i <= end; i++) removeSet.add(i);
  extracted.push(...lines.slice(start, end + 1));
}

fs.writeFileSync("src/editor-logic/commonUtils.js", extracted.join("\n") + "\n", "utf8");

const remaining = lines.filter((_, index) => !removeSet.has(index));
fs.writeFileSync("src/EIcerikEditor.jsx", remaining.join("\n"), "utf8");

console.log("Extracted common utilities to src/editor-logic/commonUtils.js");
