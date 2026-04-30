import { STORYLINE_RENDERER_CORE_SCRIPT } from '../generated/storylineRendererCore.js';
import { STORYLINE_RUNTIME_CORE_SCRIPT } from '../generated/storylineRuntimeCore.js';
import { STORYLINE_RUNTIME_ENGINE_SCRIPT } from '../generated/storylineRuntimeEngine.js';

import { buildStorylineRuntimeDeck, getOrderedRuntimeActivities } from './storylineRuntime';

/**
 * SCORM 1.2 exporter.
 *
 * SCORM uses the same storyline runtime core as the editor preview. Keep player
 * shell / LMS glue here, and keep runtime decisions in storylineRuntime.js.
 */

const enc = new TextEncoder();
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let j = 0; j < 8; j += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c;
  }
  return table;
})();

const u16 = (n) => [n & 0xff, (n >> 8) & 0xff];
const u32 = (n) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff];

function toU8(data) {
  if (data instanceof Uint8Array) return data;
  if (typeof data === 'string') return enc.encode(data);
  return new Uint8Array(data);
}

function concat(...parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let cursor = 0;
  parts.forEach((part) => {
    out.set(part, cursor);
    cursor += part.length;
  });
  return out;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export function buildZip(files) {
  const now = new Date();
  const dosTime =
    ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) >>> 0;
  const dosDate =
    (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) >>> 0;
  const localChunks = [];
  const centralEntries = [];
  let offset = 0;

  files.forEach(({ name, data }) => {
    const nameBytes = enc.encode(name);
    const fileData = toU8(data);
    const crc = crc32(fileData);
    const size = fileData.length;
    const localHeader = new Uint8Array([
      0x50,
      0x4b,
      0x03,
      0x04,
      0x14,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      ...u16(dosTime),
      ...u16(dosDate),
      ...u32(crc),
      ...u32(size),
      ...u32(size),
      ...u16(nameBytes.length),
      0x00,
      0x00,
      ...nameBytes,
    ]);
    const centralHeader = new Uint8Array([
      0x50,
      0x4b,
      0x01,
      0x02,
      0x14,
      0x00,
      0x14,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      ...u16(dosTime),
      ...u16(dosDate),
      ...u32(crc),
      ...u32(size),
      ...u32(size),
      ...u16(nameBytes.length),
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      ...u32(offset),
      ...nameBytes,
    ]);
    localChunks.push(localHeader, fileData);
    centralEntries.push(centralHeader);
    offset += localHeader.length + fileData.length;
  });

  const centralDir = concat(...centralEntries);
  const eocd = new Uint8Array([
    0x50,
    0x4b,
    0x05,
    0x06,
    0x00,
    0x00,
    0x00,
    0x00,
    ...u16(files.length),
    ...u16(files.length),
    ...u32(centralDir.length),
    ...u32(offset),
    0x00,
    0x00,
  ]);

  return concat(...localChunks, centralDir, eocd);
}

function escXml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escScriptJson(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function slug(value = '', fallback = 'sco') {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

export function validateScorm12PreviewStart(state = {}, options = {}) {
  const slides = buildStorylineRuntimeDeck(state, options);
  const errors = [];
  if (!slides.length) errors.push('SCORM paketi için başlangıç sahnesi bulunamadı.');
  return {
    ok: errors.length === 0,
    errors,
    warnings: [],
    runtimeStartLayerId: 'base',
    checkedActivityCount: new Set(slides.map((slide) => slide.activityId)).size,
    firstSlideIds: slides.slice(0, 1).map((slide) => slide.id),
  };
}

function buildManifest(cfg, scoEntries = null) {
  const identifier = (cfg.packageCode || 'EIC-001').replace(/[^a-zA-Z0-9_-]/g, '_');
  const title = escXml(cfg.packageName || 'E-İçerik Paketi');
  const masteryScore = Math.min(100, Math.max(0, cfg.passingScore ?? 70));
  const entries =
    Array.isArray(scoEntries) && scoEntries.length
      ? scoEntries
      : [{ id: 'main', title, href: 'index.html' }];
  const items = entries
    .map((entry, index) => {
      const entryId = `${identifier}-${entry.id || `sco-${index + 1}`}`.replace(
        /[^a-zA-Z0-9_-]/g,
        '_'
      );
      return `      <item identifier="ITEM-${entryId}" identifierref="RES-${entryId}">
        <title>${escXml(entry.title || title)}</title>
        <adlcp:masteryscore>${masteryScore}</adlcp:masteryscore>
      </item>`;
    })
    .join('\n');
  const resources = entries
    .map((entry, index) => {
      const entryId = `${identifier}-${entry.id || `sco-${index + 1}`}`.replace(
        /[^a-zA-Z0-9_-]/g,
        '_'
      );
      const href = escXml(entry.href || 'index.html');
      return `    <resource identifier="RES-${entryId}" type="webcontent" adlcp:scormtype="sco" href="${href}">
      <file href="${href}"/>
    </resource>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${identifier}"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd
                      http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="ORG-${identifier}">
    <organization identifier="ORG-${identifier}">
      <title>${title}</title>
${items}
    </organization>
  </organizations>
  <resources>
${resources}
  </resources>
</manifest>`;
}

export function buildStorylinePlayerHtml(state = {}, cfg = {}, options = {}) {
  const payload = {
    title: cfg.packageName || 'E-İçerik',
    passingScore: Math.min(100, Math.max(0, cfg.passingScore ?? 70)),
    trackingMode: cfg.trackingMode || 'completion+score',
    slides: buildStorylineRuntimeDeck(state, options),
    variables: Array.isArray(state.variables) ? state.variables : [],
  };
  const title = escXml(payload.title);
  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${title}</title>
<style>
*,*::before,*::after{box-sizing:border-box}
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#101820;font-family:Segoe UI,Arial,sans-serif;color:#0f172a}
#stage{position:absolute;left:0;top:0;overflow:hidden;transform-origin:0 0;background:#fff}
.obj{position:absolute;display:flex;align-items:center;justify-content:center;white-space:pre-wrap;word-break:break-word;user-select:none;box-sizing:border-box}
.obj.button{cursor:pointer}
.obj img,.obj video,.obj iframe{width:100%;height:100%;display:block;border:0}
.obj img{object-fit:contain}
.label{position:relative;z-index:1;width:100%;max-height:none;overflow:hidden;padding:0 6px;line-height:inherit}
#complete{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(2,6,23,.72);z-index:60000}
#complete.show{display:flex}
#completeCard{width:min(420px,calc(100vw - 40px));background:#fff;border-radius:14px;padding:26px;text-align:center;box-shadow:0 30px 80px rgba(0,0,0,.42)}
#completeCard h1{margin:0 0 8px;font-size:24px;color:#0f172a}
#completeCard p{margin:0 0 18px;color:#475569}
#completeCard button{height:38px;padding:0 18px;border:0;border-radius:8px;background:#0f172a;color:#fff;font-weight:900;cursor:pointer}
</style>
</head>
<body>
<div id="stage"></div>
<div id="complete"><div id="completeCard"><h1>Tamamlandı</h1><p>İçerik tamamlandı.</p><button id="closeComplete">Kapat</button></div></div>
<script>
const PAYLOAD=${escScriptJson(payload)};
const state={index:0,activeLayerId:"base",hidden:{},objectStates:{},dragPositions:{},dropAssignments:{},variables:buildVariables(PAYLOAD.variables),muted:false,visited:{}};
const stage=document.getElementById("stage");
const complete=document.getElementById("complete");
const SCORM=(function(){
  let api=null, initialized=false, finished=false, startTime=Date.now();
  function findApi(win){let tries=0;while(win&&win.API==null&&win.parent&&win.parent!==win&&tries<10){win=win.parent;tries+=1}return win&&win.API?win.API:null}
  function getApi(){if(api)return api;api=findApi(window)||(window.opener?findApi(window.opener):null);return api}
  function init(){const a=getApi();if(!a)return false;const result=a.LMSInitialize("");initialized=result===true||result==="true";if(initialized){const s=get("cmi.core.lesson_status");if(!s||s==="not attempted")set("cmi.core.lesson_status","incomplete");commit()}return initialized}
  function set(k,v){const a=getApi();if(!a||!initialized)return false;return a.LMSSetValue(k,String(v))}
  function get(k){const a=getApi();if(!a||!initialized)return "";return a.LMSGetValue(k)}
  function commit(){const a=getApi();if(!a||!initialized)return false;return a.LMSCommit("")}
  function finish(){if(finished)return;finished=true;const a=getApi();if(a&&initialized)a.LMSFinish("")}
  function sessionTime(){const total=Math.max(0,Math.floor((Date.now()-startTime)/1000));const h=String(Math.floor(total/3600)).padStart(4,"0");const m=String(Math.floor((total%3600)/60)).padStart(2,"0");const s=String(total%60).padStart(2,"0");return h+":"+m+":"+s+".00"}
  function completeCourse(score){const raw=Number.isFinite(score)?score:100;set("cmi.core.score.raw",raw);set("cmi.core.score.min",0);set("cmi.core.score.max",100);set("cmi.core.session_time",sessionTime());set("cmi.core.lesson_status",raw>=(PAYLOAD.passingScore||70)?"passed":"completed");commit()}
  function suspend(){set("cmi.suspend_data",JSON.stringify({index:state.index,visited:Object.keys(state.visited||{})}).slice(0,4096));set("cmi.core.lesson_location",String(state.index));commit()}
  return{init,set,get,commit,finish,completeCourse,suspend}
})();
function num(value,fallback){const n=Number(value);return Number.isFinite(n)?n:fallback}
${STORYLINE_RUNTIME_CORE_SCRIPT}
${STORYLINE_RUNTIME_ENGINE_SCRIPT}
${STORYLINE_RENDERER_CORE_SCRIPT}
function buildVariables(vars){const map={};(vars||[]).forEach(v=>{map[v.id]=v.value;map[v.name]=v.value});return map}
function slide(){return PAYLOAD.slides[state.index]||PAYLOAD.slides[0]||null}
function currentLayers(){const s=slide();return s&&Array.isArray(s.layers)?s.layers:[]}
function findLayerByKeys(layerKeys){return runtimeFindLayerByKeys(currentLayers(), layerKeys)}
function replaceVars(value){const vars=state.variables||{};return String(value==null?"":value).replace(/\\{\\{\\s*([^}]+?)\\s*\\}\\}/g,(m,name)=>vars[name]??m)}
function debugSnapshot(){}
function getMediaNode(objectId){return stage.querySelector('[data-runtime-audio="true"][data-media-object-id="'+objectId+'"]')||stage.querySelector('.obj[data-object-id="'+objectId+'"] video,.obj[data-object-id="'+objectId+'"] audio')}
function playMediaObject(objectId){const node=getMediaNode(objectId);if(!node)return;const result=node.play&&node.play();if(result&&result.catch)result.catch(()=>{})}
function pauseMediaObject(objectId){const node=getMediaNode(objectId);if(node&&node.pause)node.pause()}
function mediaHasExplicitTrigger(obj){return (slide().triggers||[]).some(t=>t&&((t.value===obj.id)||((t.when==="onMediaEnd"||t.when==="onMediaStart")&&(t.target===obj.id))))}
function attachRuntimeAudio(){stage.querySelectorAll('[data-runtime-audio="true"]').forEach(node=>node.remove());storylineRendererVisibleObjects({slide:slide(),state}).filter(obj=>obj&&obj.type==="audio"&&obj.mediaUrl).forEach(obj=>{const audio=document.createElement("audio");audio.dataset.runtimeAudio="true";audio.dataset.mediaObjectId=obj.id||"";audio.src=obj.mediaUrl;audio.preload="auto";audio.loop=!!obj.loop;audio.muted=!!state.muted||!!obj.muted;audio.style.display="none";audio.addEventListener("ended",()=>{if(obj.mediaEndAction==="close-layer"&&(obj.layerId||"base")!=="base"){state.activeLayerId="base";render()}const commands=storylineRuntimeCommandsForObject({slide:slide(),sourceId:obj.id,sourceObject:obj,when:"onMediaEnd",state,variableDefinitions:PAYLOAD.variables});applyRuntimeCommands(commands)});audio.addEventListener("play",()=>{const commands=storylineRuntimeCommandsForObject({slide:slide(),sourceId:obj.id,sourceObject:obj,when:"onMediaStart",state,variableDefinitions:PAYLOAD.variables});applyRuntimeCommands(commands)});stage.appendChild(audio);if(obj.autoPlay===true||!mediaHasExplicitTrigger(obj)){const result=audio.play&&audio.play();if(result&&result.catch)result.catch(()=>{})}})}
function resetAttemptState(){state.objectStates={};state.dragPositions={};state.dropAssignments={}}
function applyRuntimeCommands(commands){state.hidden=state.hidden||{};state.objectStates=state.objectStates||{};state.variables=state.variables||{};(commands||[]).forEach(command=>{if(!command||!command.type)return;if(command.type==="checkAnswer"){storylineRendererCheckAnswer({slide:slide(),state,stage,render})}else if(command.type==="restart"){restart()}else if(command.type==="resetAttempt"){resetAttemptState()}else if(command.type==="setLayer"&&command.layerId){state.activeLayerId=command.layerId;render()}else if(command.type==="toggleMute"){state.muted=!state.muted;render()}else if(command.type==="togglePlayback"){const media=Array.from(stage.querySelectorAll("video,audio"));const shouldPlay=media.some(item=>item.paused);media.forEach(item=>{if(shouldPlay){const result=item.play&&item.play();if(result&&result.catch)result.catch(()=>{})}else if(item.pause)item.pause()})}else if(command.type==="toggleDemoButtonState"&&command.objectId){state.objectStates[command.objectId]={...(state.objectStates[command.objectId]||{}),selected:!((state.objectStates[command.objectId]||{}).selected)};render()}else if(command.type==="playMedia"&&command.objectId){playMediaObject(command.objectId)}else if(command.type==="pauseMedia"&&command.objectId){pauseMediaObject(command.objectId)}else if(command.type==="complete"){finishCourse()}else if(command.type==="goRelative"){go(command.direction||1)}else if(command.type==="goToSlide"&&command.slideId){goToSlide(command.slideId)}else if(command.type==="goToActivity"&&command.activityId){goToActivity(command.activityId)}else if(command.type==="show"&&command.objectId){delete state.hidden[command.objectId];render()}else if(command.type==="hide"&&command.objectId){state.hidden[command.objectId]=true;render()}else if(command.type==="toggleHidden"&&command.objectId){state.hidden[command.objectId]=!state.hidden[command.objectId];render()}else if(command.type==="toggleSelection"&&command.objectId){state.objectStates[command.objectId]={...(state.objectStates[command.objectId]||{}),selected:!((state.objectStates[command.objectId]||{}).selected)};render()}else if(command.type==="setObjectState"&&command.objectId){state.objectStates[command.objectId]={...(state.objectStates[command.objectId]||{}),[command.stateKey||"visited"]:command.value};render()}else if(command.type==="setVariable"&&command.variableId){state.variables[command.variableId]=command.value;render()}else if(command.type==="addVariable"&&command.variableId){state.variables[command.variableId]=num(state.variables[command.variableId],0)+num(command.delta,0);render()}})}
function isLaunchTemplateControl(obj){const slot=String(obj&&obj.sceneTemplateSlotId||"");const label=runtimeKey(obj&&((obj.label||obj.text)||""));return slot.endsWith(":intro-button")||slot.endsWith(":intro-icon")||slot.endsWith(":intro-icon-bg")||slot.endsWith(":intro-icon-text")||slot.endsWith(":start-button")||slot.endsWith(":start-icon")||slot.endsWith(":start-icon-bg")||slot.endsWith(":start-icon-text")||label.includes("etkinliktanitimi")||label.includes("activityintro")||label.includes("etkinligibaslat")||label.includes("startactivity")}
function isScormButtonIntroControl(obj){const slot=String(obj&&obj.sceneTemplateSlotId||"");return slot.endsWith(":start-button")||slot.endsWith(":start-icon")||slot.endsWith(":close-button")}
function isScormButtonIntroDemoObject(obj){return !!(obj&&obj.sceneTemplateId==="button-intro"&&(!obj.type||obj.type==="button")&&obj.sceneTemplateDemoButton!==false)}
function scormObjectActionSourceIds(obj,s){if(!obj)return[];const ids=[obj.id,obj.linkedActionTargetId].filter(Boolean);const group=String(obj.linkedHoverGroup||"").trim();if(group){(s.objects||[]).forEach(item=>{if(item&&String(item.linkedHoverGroup||"").trim()===group&&item.id)ids.push(item.id)})}return Array.from(new Set(ids))}
function isScormInteractiveObject(obj,s){const hasExplicitClickTrigger=(s.triggers||[]).some(t=>(t.when||"onClick")==="onClick"&&scormObjectActionSourceIds(obj,s).some(sourceId=>storylineEngineSourceMatches(t,sourceId)));if(obj&&obj.generatedBy==="scene-template"&&obj.sceneTemplateId==="button-intro"&&!isScormButtonIntroControl(obj))return isScormButtonIntroDemoObject(obj);if(obj&&obj.generatedBy==="scene-template"&&obj.sceneTemplateId==="launch-page"&&!isLaunchTemplateControl(obj)&&!hasExplicitClickTrigger&&!runtimeButtonAction(obj))return false;return !!(obj&&obj.selectionQuestionId)||storylineRendererIsCheckButton(obj)||(obj&&obj.type==="draggable")||runtimeButtonAction(obj)||hasExplicitClickTrigger}
function linkedActionSources(el){const ids=[el.dataset.objectId||el.dataset.sourceId||el.dataset.id].filter(Boolean);const explicit=String(el&&el.dataset&&el.dataset.linkedActionTarget||"").trim();if(explicit)ids.push(explicit);const group=String(el&&el.dataset&&el.dataset.linkedHoverGroup||"").trim();if(group){const nodes=Array.from(stage.querySelectorAll('.obj[data-linked-hover-group="'+group.replace(/"/g,'\\"')+'"]'));const label=nodes.find(node=>String(node.dataset.sceneTemplateSlotId||"").endsWith("-label"))||nodes.find(node=>String(node.dataset.soundIconMode||"")==="external")||nodes.find(node=>Number(node.offsetWidth||0)>=Number(el.offsetWidth||0));ids.push(label?.dataset?.objectId||label?.dataset?.sourceId||label?.dataset?.id||"");nodes.forEach(node=>ids.push(node.dataset.objectId||node.dataset.sourceId||node.dataset.id||""))}return Array.from(new Set(ids.filter(Boolean)))}
function render(){const s=slide();if(!s)return;state.visited=state.visited||{};state.visited[s.id]=true;storylineRenderSlide({slide:s,state,stage,replaceVars,render,onDropInteraction:(payload)=>{debugSnapshot("drop-placed:"+(payload&&payload.drag&&payload.drag.id||""))},afterInteraction:()=>{SCORM.suspend();debugSnapshot("afterInteraction")},isInteractive:(obj)=>isScormInteractiveObject(obj,s)});attachRuntimeAudio();const runtimeObjects=storylineRendererVisibleObjects({slide:slide(),state});stage.querySelectorAll('.obj[data-interactive="true"]').forEach(el=>el.addEventListener("click",e=>{e.stopPropagation();const sourceId=el.dataset.objectId||el.dataset.sourceId||el.dataset.id;const runtimeKey=el.dataset.id||"";const suppress=state.__suppressClick;if(suppress&&suppress.moved&&Date.now()<=num(suppress.until,0)){state.__suppressClick={...suppress,pending:false};debugSnapshot("click-suppressed:"+sourceId);return}const obj=runtimeObjects.find(o=>storylineRendererObjectKey(o)===runtimeKey)||(slide().objects||[]).find(o=>o.id===sourceId);let commands=[];for(const actionSourceId of linkedActionSources(el)){const actionObj=runtimeObjects.find(o=>o.id===actionSourceId)||(slide().objects||[]).find(o=>o.id===actionSourceId)||obj;commands=storylineRuntimeCommandsForObject({slide:slide(),sourceId:actionSourceId,sourceObject:actionObj,when:"onClick",state,variableDefinitions:PAYLOAD.variables});if(commands&&commands.length)break}applyRuntimeCommands(commands)}));stage.querySelectorAll('.obj[data-interactive="true"]').forEach(el=>{const sourceId=el.dataset.objectId||el.dataset.sourceId||el.dataset.id;const runtimeKey=el.dataset.id||"";const obj=runtimeObjects.find(o=>storylineRendererObjectKey(o)===runtimeKey)||(slide().objects||[]).find(o=>o.id===sourceId);const motion=obj&&obj.buttonMotion&&typeof obj.buttonMotion==="object"?obj.buttonMotion:null;if(!motion)return;const linkedGroup=String(el.dataset.linkedHoverGroup||"").trim();const groupEls=()=>linkedGroup?Array.from(stage.querySelectorAll('.obj[data-linked-hover-group="'+linkedGroup.replace(/"/g,'\\"')+'"]')):[el];const baseTransform=el.style.transform||"";const baseShadow=el.style.boxShadow||"none";const baseFilter=el.style.filter||"brightness(1)";const hoverScale=Math.max(1.005,num(motion.hoverScale,1.02));const pressScale=Math.max(.92,num(motion.pressScale,.98));const liftY=Math.max(0,num(motion.liftY,1));const hoverFilter=String(motion.hoverFilter||"brightness(1.04)");const hoverShadow=String(motion.hoverShadow||baseShadow);const duration=Math.max(120,num(motion.duration,180));const easing=String(motion.easing||"cubic-bezier(.2,.82,.2,1)");groupEls().forEach(node=>{node.dataset.baseTransform=node.style.transform||"";node.dataset.baseShadow=node.style.boxShadow||"none";node.dataset.baseFilter=node.style.filter||"brightness(1)";node.style.transition="transform "+duration+"ms "+easing+", box-shadow "+duration+"ms "+easing+", filter "+duration+"ms "+easing});el.addEventListener("mouseenter",()=>{groupEls().forEach(node=>{const t=node.dataset.baseTransform||"";node.style.transform=(t?t+" ":"")+"translateY(-"+liftY+"px) scale("+hoverScale+")";node.style.boxShadow=hoverShadow;node.style.filter=hoverFilter})});el.addEventListener("mouseleave",()=>{groupEls().forEach(node=>{node.style.transform=node.dataset.baseTransform||"";node.style.boxShadow=node.dataset.baseShadow||"none";node.style.filter=node.dataset.baseFilter||"brightness(1)"})});el.addEventListener("pointerdown",()=>{groupEls().forEach(node=>{const t=node.dataset.baseTransform||"";node.style.transform=(t?t+" ":"")+"scale("+pressScale+")"})})});resize();SCORM.suspend();debugSnapshot("render");if(Object.keys(state.visited||{}).length>=PAYLOAD.slides.length)SCORM.completeCourse(100)}
function resize(){const s=slide();if(!s)return;const w=num(s.stageWidth,1920),h=num(s.stageHeight,1080);const scale=Math.min(window.innerWidth/w,window.innerHeight/h);stage.style.width=w+"px";stage.style.height=h+"px";stage.style.transform="translate("+Math.round((window.innerWidth-w*scale)/2)+"px,"+Math.round((window.innerHeight-h*scale)/2)+"px) scale("+scale+")"}
function resetRuntime(){state.activeLayerId="base";state.hidden={};state.objectStates={};state.dragPositions={};state.dropAssignments={};state.variables=buildVariables(PAYLOAD.variables)}
function restart(){state.index=PAYLOAD.slides[1]?1:0;state.visited={};resetRuntime();render()}
function go(dir){const next=state.index+dir;if(next>=0&&next<PAYLOAD.slides.length){state.index=next;resetRuntime();render()}else if(next>=PAYLOAD.slides.length)finishCourse()}
function goToSlide(id){const next=PAYLOAD.slides.findIndex(s=>s.id===id);if(next>=0){state.index=next;resetRuntime();render()}}
function goToActivity(id){const next=PAYLOAD.slides.findIndex(s=>s.activityId===id);if(next>=0){state.index=next;resetRuntime();render()}}
function finishCourse(){SCORM.completeCourse(100);complete.classList.add("show")}
document.getElementById("closeComplete").addEventListener("click",()=>{complete.classList.remove("show");SCORM.finish()});
window.addEventListener("resize",resize);
window.addEventListener("beforeunload",()=>SCORM.finish());
SCORM.init();
resetRuntime();
render();
</script>
</body>
</html>`;
}

export function buildScorm12Zip(state, lmsConfig = {}, options = {}) {
  const cfg = { ...lmsConfig };
  const scope = options.scope || cfg.scormExportScope || 'activity';
  const isBookScope = scope === 'book';
  const orderedActivities = isBookScope
    ? getOrderedRuntimeActivities(state, { ...options, scope: 'book' })
    : [];
  const scoEntries =
    isBookScope && orderedActivities.length
      ? orderedActivities.map((activity, index) => ({
          id: slug(
            activity.id || activity.name || `activity-${index + 1}`,
            `activity-${index + 1}`
          ),
          title: activity.name || activity.sceneName || `Etkinlik ${index + 1}`,
          href: `activities/${slug(activity.id || activity.name || `activity-${index + 1}`, `activity-${index + 1}`)}/index.html`,
          activity,
        }))
      : [{ id: 'main', title: cfg.packageName || 'E-İçerik', href: 'index.html' }];
  const playerFiles =
    isBookScope && orderedActivities.length
      ? scoEntries.map((entry) => ({
          name: entry.href,
          data: buildStorylinePlayerHtml(
            state,
            { ...cfg, packageName: entry.title },
            { ...options, scope: 'activity', activityId: entry.activity.id }
          ),
        }))
      : [{ name: 'index.html', data: buildStorylinePlayerHtml(state, cfg, { ...options, scope }) }];

  const files = [
    { name: 'imsmanifest.xml', data: buildManifest(cfg, scoEntries) },
    ...playerFiles,
    {
      name: 'adlcp_rootv1p2.xsd',
      data: `<?xml version="1.0" encoding="UTF-8"?><xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" targetNamespace="http://www.adlnet.org/xsd/adlcp_rootv1p2"/>`,
    },
    {
      name: 'imscp_rootv1p1p2.xsd',
      data: `<?xml version="1.0" encoding="UTF-8"?><xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" targetNamespace="http://www.imsproject.org/xsd/imscp_rootv1p1p2"/>`,
    },
    {
      name: 'ims_xml.xsd',
      data: `<?xml version="1.0" encoding="UTF-8"?><xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" targetNamespace="http://www.imsproject.org/xsd/ims_xml"/>`,
    },
  ];
  return buildZip(files);
}

export function downloadScorm12Zip(state, lmsConfig = {}, options = {}) {
  const zipBytes = buildScorm12Zip(state, lmsConfig, options);
  const blob = new Blob([zipBytes], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const packageName = (lmsConfig.packageName || 'scorm-paketi')
    .replace(/[^a-zA-Z0-9ığüşöçĞÜŞÖÇI_\- ]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase();
  const a = document.createElement('a');
  a.href = url;
  a.download = `${packageName}-scorm12.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
