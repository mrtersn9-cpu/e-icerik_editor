import fs from 'fs';

function processFile(path, renameMapping) {
  let code = fs.readFileSync(path, 'utf8');

  // Remove all import statements (single-line or multi-line)
  code = code.replace(/^import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*/gm, '');

  // Remove export { ... } statements
  code = code.replace(/^export\s*\{[\s\S]*?\};?\s*$/gm, '');

  // Remove export keyword from declarations
  code = code.replace(/^export\s+(function|const|let|var)\s+/gm, '$1 ');

  // Apply rename mapping (sort by longest old name first to avoid partial replacements)
  const entries = Object.entries(renameMapping).sort((a, b) => b[0].length - a[0].length);
  for (const [oldName, newName] of entries) {
    const regex = new RegExp('\\b' + oldName + '\\b', 'g');
    const count = (code.match(regex) || []).length;
    if (count > 0) {
      code = code.replace(regex, newName);
    }
  }

  // Clean up excessive empty lines
  code = code.replace(/\n{3,}/g, '\n\n');

  return code;
}

const runtimeMapping = {
  normalizeRuntimeActionLabel: 'runtimeKey',
  findRuntimeLayerByKeys: 'runtimeFindLayerByKeys',
  isGeneratedAnswerTemplateObject: 'runtimeIsGeneratedAnswerTemplateObject',
  isLaunchSceneTemplateControl: 'runtimeIsLaunchTemplateControl',
  getRuntimeButtonAction: 'runtimeButtonAction',
};

const engineMapping = {
  getStorylineRuntimeCommandsForObject: 'storylineRuntimeCommandsForObject',
  getStorylineRuntimeCommandsForDrop: 'storylineRuntimeCommandsForDrop',
  getStorylineTriggerSourceMatches: 'storylineEngineSourceMatches',
  getStorylineDropTriggerSourceMatches: 'storylineEngineDropSourceMatches',
  getStorylineRuntimeObjectStateValue: 'storylineEngineObjectStateValue',
  getVariableDefinition: 'storylineEngineVariableDef',
  evaluateStorylineTriggerConditions: 'storylineEngineConditionsPass',
  evaluateStorylineTriggerCondition: 'storylineEngineConditionPass',
  collapseStorylineNavigationCommands: 'storylineEngineCollapseNavigation',
  getStorylineRuntimeCommandsForAction: 'storylineEngineCommandsForAction',
  getCommandsForTrigger: 'storylineEngineCommandsForTrigger',
  castStorylineRuntimeValue: 'storylineEngineCastValue',
  normalizeStorylineRuntimeValue: 'storylineEngineNormalizeValue',
  getStorylineRuntimeKey: 'storylineEngineKey',
  normalizeRuntimeActionLabel: 'storylineEngineKey',
  isStorylineRuntimeDropTargetLikeObject: 'storylineEngineIsDropTargetLike',
  getStorylineRuntimeObjectKey: 'storylineEngineObjectKey',
  withStorylineRuntimeObjectKeys: 'storylineEngineWithObjectKeys',
  normalizeStorylineDragDropMatchValue: 'storylineEngineMatchValues',
  getStorylineDragDropPairKey: 'storylineEnginePairKey',
  getStorylineDragDropPairsFromMatches: 'storylineEnginePairsFromMatches',
  getDragDropSettings: 'storylineEngineDragDropSettings',
  areScopesCompatible: 'storylineEngineScopesCompatible',
  isDragReusable: 'storylineEngineDragReusable',
  getDropCapacityLimit: 'storylineEngineDropCapacity',
  getBaseRuntimeObjects: 'storylineEngineBaseObjects',
  buildStorylineRuntimeAutoDragMatches: 'storylineEngineAutoMatches',
  getStorylineRuntimeCorrectDragMatches: 'storylineEngineCorrectMatches',
  getStorylineRuntimeSnapPosition: 'storylineEngineSnapPosition',
  findStorylineRuntimeDropTarget: 'storylineEngineFindDropTarget',
  evaluateStorylineRuntimeDragDrop: 'storylineEngineEvaluateDragDrop',
  getStorylineRuntimeDropResultStates: 'storylineEngineDropResultStates',
  isButtonIntroRuntimeControl: 'storylineEngineIsButtonIntroControl',
  isStorylineCheckButton: 'storylineEngineIsCheckButton',
  findRuntimeLayerByKeys: 'runtimeFindLayerByKeys',
  getRuntimeButtonAction: 'runtimeButtonAction',
};

const runtimeCode = processFile('src/utils/storylineRuntime.js', runtimeMapping);
const engineCode = processFile('src/utils/storylineRuntimeEngine.js', engineMapping);

// Escape backticks, backslashes and ${ so the generated file remains a valid JS template literal
const escapedRuntimeCode = runtimeCode.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
const escapedEngineCode = engineCode.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');

// Guvenlik/hijyen: uzerine yazmadan once mevcut generated dosyalarin yedegini al
// (B-360 — bu script daha once yedeksiz calisiyordu).
function backupThenWrite(targetPath, content) {
  if (fs.existsSync(targetPath)) {
    fs.copyFileSync(targetPath, targetPath + '.bak');
  }
  fs.writeFileSync(targetPath, content);
}

backupThenWrite(
  'src/generated/storylineRuntimeCore.js',
  'export const STORYLINE_RUNTIME_CORE_SCRIPT = `\n' + escapedRuntimeCode + '\n`;\n'
);
backupThenWrite(
  'src/generated/storylineRuntimeEngine.js',
  'export const STORYLINE_RUNTIME_ENGINE_SCRIPT = `\n' + escapedEngineCode + '\n`;\n'
);

console.log('Generated files updated successfully. Onceki icerik .bak olarak yedeklendi.');
