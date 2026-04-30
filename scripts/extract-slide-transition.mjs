import fs from "fs";

const file = fs.readFileSync("src/EIcerikEditor.jsx", "utf8");
const lines = file.split("\n");

// SlideTransitionView + yardımcıları (1-indexed → 0-indexed)
const start = 5212; // satır 5213
const end = 5490;   // satır 5491

const extracted = lines.slice(start, end + 1);
const removeSet = new Set();
for (let i = start; i <= end; i++) removeSet.add(i);

// React import ekle + export default
let newContent = `import React, { useState, useEffect } from "react";\n\n${extracted.join("\n")}\n`;
newContent = newContent.replace(
  /^function SlideTransitionView\(/m,
  "export default function SlideTransitionView("
);

// Klasör yoksa oluştur
if (!fs.existsSync("src/components/editor")) {
  fs.mkdirSync("src/components/editor", { recursive: true });
}

fs.writeFileSync("src/components/editor/SlideTransitionView.jsx", newContent, "utf8");

const remaining = lines.filter((_, index) => !removeSet.has(index));
fs.writeFileSync("src/EIcerikEditor.jsx", remaining.join("\n"), "utf8");

console.log("Extracted SlideTransitionView (278 lines) to src/components/editor/SlideTransitionView.jsx");
