import fs from "fs";

// 1. storylineRuntimeCore.js
const rtLines = fs.readFileSync("src/utils/storylineRuntime.js", "utf8").split("\n");
const rtContent = rtLines.slice(192, 199).join("\n");
fs.writeFileSync("src/generated/storylineRuntimeCore.js", rtContent, "utf8");

// 2. storylineRuntimeEngine.js
const engLines = fs.readFileSync("src/utils/storylineRuntimeEngine.js", "utf8").split("\n");
const engContent = engLines.slice(614, 649).join("\n");
fs.writeFileSync("src/generated/storylineRuntimeEngine.js", engContent, "utf8");

// 3. storylineRendererCore.js — with imports for template literal resolution
const renLines = fs.readFileSync("src/utils/storylineRenderer.js", "utf8").split("\n");
const renBody = renLines.slice(427, 467).join("\n");
const renImports = `import { STORYLINE_RUNTIME_CORE_SCRIPT } from "./storylineRuntimeCore.js";
import { STORYLINE_RUNTIME_ENGINE_SCRIPT } from "./storylineRuntimeEngine.js";

`;
fs.writeFileSync("src/generated/storylineRendererCore.js", renImports + renBody, "utf8");

console.log("Runtime inline scripts extracted to src/generated/");
