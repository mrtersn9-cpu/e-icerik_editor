import fs from "fs";

const file = fs.readFileSync("src/EIcerikEditor.jsx", "utf8");
const lines = file.split("\n");

// EditorScenesPanel (1-indexed → 0-indexed)
const start = 8478; // satır 8479
const end = 9152;   // satır 9153'ün bir öncesi

const extracted = lines.slice(start, end + 1);
const removeSet = new Set();
for (let i = start; i <= end; i++) removeSet.add(i);

let newContent = `import React, { useState, useRef } from "react";\nimport { uid, clamp } from "../utils/editorHelpers";\n\n${extracted.join("\n")}\n`;
newContent = newContent.replace(
  /^function EditorScenesPanel\(/m,
  "export default function EditorScenesPanel("
);

fs.writeFileSync("src/components/editor/EditorScenesPanel.jsx", newContent, "utf8");

const remaining = lines.filter((_, index) => !removeSet.has(index));
fs.writeFileSync("src/EIcerikEditor.jsx", remaining.join("\n"), "utf8");

console.log("Extracted EditorScenesPanel (675 lines) to src/components/editor/EditorScenesPanel.jsx");
