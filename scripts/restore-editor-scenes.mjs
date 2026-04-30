import fs from "fs";

const panelFile = fs.readFileSync("src/components/editor/EditorScenesPanel.jsx", "utf8");
const panelLines = panelFile.split("\n");

// React import satırlarını ve ButtonPackageIntroDiagram'ı çıkar
const contentLines = panelLines.slice(2); // ilk 2 satır (importlar)
const endIndex = contentLines.findIndex(line => line.startsWith("function ButtonPackageIntroDiagram"));
const cleanLines = endIndex >= 0 ? contentLines.slice(0, endIndex) : contentLines;

// export default'u function'a çevir
const cleanContent = cleanLines.join("\n").replace(
  "export default function EditorScenesPanel(",
  "function EditorScenesPanel("
);

const editorFile = fs.readFileSync("src/EIcerikEditor.jsx", "utf8");
const editorLines = editorFile.split("\n");

// Ekleme noktasını bul (ButtonPackageIntroDiagram'dan önce)
const insertIndex = editorLines.findIndex(line => line.includes("function ButtonPackageIntroDiagram({ pkgId"));
if (insertIndex < 0) {
  console.error("Insertion point not found");
  process.exit(1);
}

const newLines = [
  ...editorLines.slice(0, insertIndex),
  ...cleanContent.split("\n"),
  ...editorLines.slice(insertIndex)
];

fs.writeFileSync("src/EIcerikEditor.jsx", newLines.join("\n"), "utf8");

// EditorScenesPanel import'unu kaldır
let finalContent = fs.readFileSync("src/EIcerikEditor.jsx", "utf8");
finalContent = finalContent.replace('import EditorScenesPanel from "./components/editor/EditorScenesPanel";\n', "");
fs.writeFileSync("src/EIcerikEditor.jsx", finalContent, "utf8");

// EditorScenesPanel.jsx'i sil
fs.unlinkSync("src/components/editor/EditorScenesPanel.jsx");

console.log("Restored EditorScenesPanel and drag-drop functions to EIcerikEditor.jsx");
