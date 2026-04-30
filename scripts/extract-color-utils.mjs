import fs from "fs";

const file = fs.readFileSync("src/EIcerikEditor.jsx", "utf8");
const lines = file.split("\n");

// Renk fonksiyonlarının satır aralıkları (0-indexed)
// parseCssColorSamples (537-551), relativeLuminance (553-559), contrastRatioForColors (561-567),
// readableTextColorForBackground (569-585), contrastSafeButtonStyle (587-595),
// ensureTtkbButtonTextContrast (597-607), cssColorWithAlpha (679-691)
const ranges = [
  [536, 551],   // parseCssColorSamples
  [552, 559],   // relativeLuminance
  [560, 567],   // contrastRatioForColors
  [568, 585],   // readableTextColorForBackground
  [586, 595],   // contrastSafeButtonStyle
  [596, 607],   // ensureTtkbButtonTextContrast
  [678, 691],   // cssColorWithAlpha
];

const extracted = [];
const removeSet = new Set();
for (const [start, end] of ranges) {
  for (let i = start; i <= end; i++) removeSet.add(i);
  extracted.push(...lines.slice(start, end + 1));
}

// Write new file
const newContent = extracted.join("\n") + "\n";
fs.writeFileSync("src/editor-logic/colorUtils.js", newContent, "utf8");

// Filter out extracted lines from original (keep order)
const remaining = lines.filter((_, index) => !removeSet.has(index));
fs.writeFileSync("src/EIcerikEditor.jsx", remaining.join("\n"), "utf8");

console.log("Extracted color utilities to src/editor-logic/colorUtils.js");
