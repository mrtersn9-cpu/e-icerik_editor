import { getCustomFonts } from '../constants/fonts';
import { FORMULA_ENGINE_SCRIPT } from '../generated/formulaEngineCore.js';
import { STORYLINE_RENDERER_CORE_SCRIPT } from '../generated/storylineRendererCore.js';
import { STORYLINE_RUNTIME_CORE_SCRIPT } from '../generated/storylineRuntimeCore.js';
import { STORYLINE_RUNTIME_ENGINE_SCRIPT } from '../generated/storylineRuntimeEngine.js';
import { getActivityContentLanguage, runtimeText } from '../logic/contentLanguage';

import {
  TYPED_ACTIVITY_PLAYER_SCRIPT,
  TYPED_ACTIVITY_PLAYER_STYLE,
} from './scormTypedActivityPlayer';
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

function escCssString(value = '') {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, ' ');
}

function primaryFontFamily(value = '') {
  return String(value || '')
    .split(',')[0]
    .trim()
    .replace(/^['"]|['"]$/g, '');
}

function collectUsedFontFamilies(slides = []) {
  const used = new Set();
  const addStyle = (style = {}) => {
    const font = primaryFontFamily(style?.fontFamily);
    if (font) used.add(font);
  };
  (slides || []).forEach((slide) => {
    addStyle({ fontFamily: slide?.readyButtonFontFamily });
    (slide?.objects || []).forEach((object) => {
      addStyle(object?.style);
      Object.values(object?.stateStyles || {}).forEach(addStyle);
    });
  });
  return used;
}

function buildCustomFontFaceCss(slides = []) {
  const usedFonts = collectUsedFontFamilies(slides);
  if (!usedFonts.size) return '';
  const customFonts = getCustomFonts();
  return customFonts
    .filter((font) => usedFonts.has(font.name) && font.dataUrl)
    .map(
      (font) =>
        `@font-face{font-family:"${escCssString(font.name)}";src:url("${escCssString(font.dataUrl)}");font-display:swap}`
    )
    .join('\n');
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
  slides.forEach((slide) => {
    if (slide.type === 'puzzle') {
      const puzzleType = slide.puzzleType || 'crossword';
      if (puzzleType === 'crossword' || puzzleType === 'wordsearch') {
        if (slide.puzzleUnplaced && slide.puzzleUnplaced.length > 0) {
          const words = slide.puzzleUnplaced
            .map((q) => q.answer || q.label || '')
            .filter(Boolean)
            .join(', ');
          errors.push(
            `${slide.activityName || slide.name || 'Bulmaca'} içinde yerleşemeyen kelimeler var: ${words || slide.puzzleUnplaced.length}`
          );
        }
        if (slide.puzzleBudgetExceeded) {
          errors.push(
            `${slide.activityName || slide.name || 'Bulmaca'} için yerleşim zaman sınırı aşıldı. Lütfen ızgara boyutunu veya kelime listesini düzenleyin.`
          );
        }
      }
    }
  });
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

  // SCORM 1.2 namespace URI'leri URL gibi görünür, ancak runtime dış istek değildir.
  // XSD dosyaları pakete yerel dosya olarak eklenir; dış kaynak yasağı learner runtime
  // asset/fetch/link/embed istekleri için uygulanır.
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
  // İçerik dili: oyuncudaki tüm sabit metinler (Kontrol Et, Tamamlandı vb.)
  // PAYLOAD.i18n üzerinden seçilen üretim diliyle gelir.
  const lang = getActivityContentLanguage(getOrderedRuntimeActivities(state, options)[0] || state);
  const slides = buildStorylineRuntimeDeck(state, options);
  const customFontFaceCss = buildCustomFontFaceCss(slides);
  const payload = {
    title: cfg.packageName || 'E-İçerik',
    passingScore: Math.min(100, Math.max(0, cfg.passingScore ?? 70)),
    trackingMode: cfg.trackingMode || 'completion+score',
    slides,
    variables: Array.isArray(state.variables) ? state.variables : [],
    i18n: { lang, ...runtimeText(lang) },
  };
  const title = escXml(payload.title);
  return `<!DOCTYPE html>
<html lang="${escXml(lang)}">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${title}</title>
<style>
${customFontFaceCss}
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
${TYPED_ACTIVITY_PLAYER_STYLE}
</style>
</head>
<body>
<div id="stage"></div>
<div id="complete"><div id="completeCard"><h1>${escXml(payload.i18n.completedTitle)}</h1><p>${escXml(payload.i18n.completedBody)}</p><button id="closeComplete">${escXml(payload.i18n.closeLabel)}</button></div></div>
<script>
const PAYLOAD=${escScriptJson(payload)};
const state={index:0,activeLayerId:"base",hidden:{},objectStates:{},dragPositions:{},dropAssignments:{},variables:buildVariables(PAYLOAD.variables),muted:false,visited:{},activityScores:{},livesAttempts:{}};
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
  return{init,set,get,commit,finish,completeCourse,suspend,sessionTime}
})();
function num(value,fallback){const n=Number(value);return Number.isFinite(n)?n:fallback}
${FORMULA_ENGINE_SCRIPT}
${STORYLINE_RUNTIME_CORE_SCRIPT}
${STORYLINE_RUNTIME_ENGINE_SCRIPT}
${STORYLINE_RENDERER_CORE_SCRIPT}
${TYPED_ACTIVITY_PLAYER_SCRIPT}
function buildVariables(vars){const map={};(vars||[]).forEach(v=>{map[v.id]=v.value;map[v.name]=v.value});return map}
function slide(){return PAYLOAD.slides[state.index]||PAYLOAD.slides[0]||null}
// Can/hak: editörde answerControl.livesX olarak saklanır ve deck'e taşınır.
function livesConfig(s){var ac=(s&&s.answerControl)||{};if(ac.livesEnabled!==true)return{enabled:false};var count=Math.max(1,Math.min(99,num(ac.livesCount,3)));var g={heart:"❤️",star:"⭐",diamond:"💎",apple:"🍎",bolt:"⚡",trophy:"🏆",crown:"👑",flower:"🌸",balloon:"🎈",medal:"🏅"};var id=ac.livesIconId||"heart";var useCustom=id==="custom"&&!!ac.livesCustomImage;return{enabled:true,count:count,glyph:useCustom?"":(g[id]||g.heart),useCustom:useCustom,customImage:ac.livesCustomImage||"",behaviorOnZero:ac.livesBehaviorOnZero||"lock"};}
function livesRemaining(s){var cfg=livesConfig(s);if(!cfg.enabled)return null;state.livesAttempts=state.livesAttempts||{};return Math.max(0,cfg.count-num(state.livesAttempts[s.id],0));}
function livesAfterCheck(result){var s=slide();if(!s)return;var cfg=livesConfig(s);if(!cfg.enabled||!result)return;var hasAttempt=result.type==="selection"?((result.selected||[]).length>0):(result.placements?result.placements.length>0:true);if(!result.success&&hasAttempt){state.livesAttempts=state.livesAttempts||{};state.livesAttempts[s.id]=num(state.livesAttempts[s.id],0)+1;}render();if(livesRemaining(s)<=0){if(cfg.behaviorOnZero==="restart"){setTimeout(restart,1000);}else if(cfg.behaviorOnZero==="show-answer"&&typeof storylineRendererFindLayer==="function"){var ans=storylineRendererFindLayer({slide:s,state:state},["solution","cozum","answer","cevap"]);if(ans){state.activeLayerId=ans.id;render();}}}}
function renderLivesBar(){var s=slide();if(!s||!stage)return;var cfg=livesConfig(s);if(!cfg.enabled)return;var remaining=livesRemaining(s);var bar=document.createElement("div");bar.setAttribute("role","status");bar.setAttribute("aria-label",((PAYLOAD.i18n&&PAYLOAD.i18n.livesRemaining)||"Kalan can")+": "+remaining+" / "+cfg.count);bar.style.cssText="position:absolute;top:10px;right:14px;z-index:50;display:inline-flex;align-items:center;gap:4px;background:rgba(255,255,255,.88);padding:4px 9px;border-radius:999px;box-shadow:0 2px 8px rgba(15,23,42,.16)";for(var i=0;i<cfg.count;i++){var filled=i<remaining;if(cfg.useCustom){var img=document.createElement("img");img.src=cfg.customImage;img.alt="";img.style.cssText="width:20px;height:20px;object-fit:contain;opacity:"+(filled?"1":"0.25")+";filter:"+(filled?"none":"grayscale(1)");bar.appendChild(img);}else{var sp=document.createElement("span");sp.textContent=cfg.glyph;sp.style.cssText="font-size:18px;line-height:1;opacity:"+(filled?"1":"0.25")+";filter:"+(filled?"none":"grayscale(1)");bar.appendChild(sp);}}stage.appendChild(bar);if(remaining<=0){var btns=stage.querySelectorAll('[data-check-button="true"]');for(var b=0;b<btns.length;b++){btns[b].style.pointerEvents="none";btns[b].style.opacity="0.5";}}}
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
function applyRuntimeCommands(commands){state.hidden=state.hidden||{};state.objectStates=state.objectStates||{};state.variables=state.variables||{};(commands||[]).forEach(command=>{if(!command||!command.type)return;if(command.type==="checkAnswer"){var __chk=storylineRendererCheckAnswer({slide:slide(),state,stage,render});livesAfterCheck(__chk)}else if(command.type==="restart"){restart()}else if(command.type==="goHome"){goHome()}else if(command.type==="resetAttempt"){resetAttemptState()}else if(command.type==="setLayer"&&command.layerId){state.activeLayerId=command.layerId;render()}else if(command.type==="toggleMute"){state.muted=!state.muted;render()}else if(command.type==="togglePlayback"){const media=Array.from(stage.querySelectorAll("video,audio"));const shouldPlay=media.some(item=>item.paused);media.forEach(item=>{if(shouldPlay){const result=item.play&&item.play();if(result&&result.catch)result.catch(()=>{})}else if(item.pause)item.pause()})}else if(command.type==="toggleDemoButtonState"&&command.objectId){state.objectStates[command.objectId]={...(state.objectStates[command.objectId]||{}),selected:!((state.objectStates[command.objectId]||{}).selected)};render()}else if(command.type==="playMedia"&&command.objectId){playMediaObject(command.objectId)}else if(command.type==="pauseMedia"&&command.objectId){pauseMediaObject(command.objectId)}else if(command.type==="complete"){finishCourse()}else if(command.type==="goRelative"){go(command.direction||1)}else if(command.type==="goToSlide"&&command.slideId){goToSlide(command.slideId)}else if(command.type==="goToActivity"&&command.activityId){goToActivity(command.activityId)}else if(command.type==="show"&&command.objectId){delete state.hidden[command.objectId];render()}else if(command.type==="hide"&&command.objectId){state.hidden[command.objectId]=true;render()}else if(command.type==="toggleHidden"&&command.objectId){state.hidden[command.objectId]=!state.hidden[command.objectId];render()}else if(command.type==="toggleSelection"&&command.objectId){state.objectStates[command.objectId]={...(state.objectStates[command.objectId]||{}),selected:!((state.objectStates[command.objectId]||{}).selected)};render()}else if(command.type==="setObjectState"&&command.objectId){state.objectStates[command.objectId]={...(state.objectStates[command.objectId]||{}),[command.stateKey||"visited"]:command.value};render()}else if(command.type==="setVariable"&&command.variableId){state.variables[command.variableId]=command.value;render()}else if(command.type==="addVariable"&&command.variableId){state.variables[command.variableId]=num(state.variables[command.variableId],0)+num(command.delta,0);render()}else if(command.type==="openUrl"&&command.url){window.open(command.url,"_blank","noopener,noreferrer")}else if(command.type==="print"){window.print()}else if(command.type==="sendWidgetCommand"){}})}
function isLaunchTemplateControl(obj){const slot=String(obj&&obj.sceneTemplateSlotId||"");const label=runtimeKey(obj&&((obj.label||obj.text)||""));return slot.endsWith(":intro-button")||slot.endsWith(":intro-icon")||slot.endsWith(":intro-icon-bg")||slot.endsWith(":intro-icon-text")||slot.endsWith(":start-button")||slot.endsWith(":start-icon")||slot.endsWith(":start-icon-bg")||slot.endsWith(":start-icon-text")||label.includes("etkinliktanitimi")||label.includes("activityintro")||label.includes("etkinligibaslat")||label.includes("startactivity")}
function isScormButtonIntroControl(obj){const slot=String(obj&&obj.sceneTemplateSlotId||"");return slot.endsWith(":start-button")||slot.endsWith(":start-icon")||slot.endsWith(":close-button")}
function isScormButtonIntroDemoObject(obj){return !!(obj&&obj.sceneTemplateId==="button-intro"&&(!obj.type||obj.type==="button")&&obj.sceneTemplateDemoButton!==false)}
function scormObjectActionSourceIds(obj,s){if(!obj)return[];const ids=[obj.id,obj.linkedActionTargetId].filter(Boolean);const group=String(obj.linkedHoverGroup||"").trim();if(group){(s.objects||[]).forEach(item=>{if(item&&String(item.linkedHoverGroup||"").trim()===group&&item.id)ids.push(item.id)})}return Array.from(new Set(ids))}
function isScormInteractiveObject(obj,s){const hasExplicitClickTrigger=(s.triggers||[]).some(t=>(t.when||"onClick")==="onClick"&&scormObjectActionSourceIds(obj,s).some(sourceId=>storylineEngineSourceMatches(t,sourceId)));if(obj&&obj.generatedBy==="scene-template"&&obj.sceneTemplateId==="button-intro"&&!isScormButtonIntroControl(obj))return isScormButtonIntroDemoObject(obj);if(obj&&obj.generatedBy==="scene-template"&&obj.sceneTemplateId==="launch-page"&&!isLaunchTemplateControl(obj)&&!hasExplicitClickTrigger&&!runtimeButtonAction(obj))return false;return !!(obj&&obj.selectionQuestionId)||storylineRendererIsCheckButton(obj)||(obj&&obj.type==="draggable")||runtimeButtonAction(obj)||hasExplicitClickTrigger}
function linkedActionSources(el){const ids=[el.dataset.objectId||el.dataset.sourceId||el.dataset.id].filter(Boolean);const explicit=String(el&&el.dataset&&el.dataset.linkedActionTarget||"").trim();if(explicit)ids.push(explicit);const group=String(el&&el.dataset&&el.dataset.linkedHoverGroup||"").trim();if(group){const nodes=Array.from(stage.querySelectorAll('.obj[data-linked-hover-group="'+group.replace(/"/g,'\\"')+'"]'));const label=nodes.find(node=>String(node.dataset.sceneTemplateSlotId||"").endsWith("-label"))||nodes.find(node=>String(node.dataset.soundIconMode||"")==="external")||nodes.find(node=>Number(node.offsetWidth||0)>=Number(el.offsetWidth||0));ids.push(label?.dataset?.objectId||label?.dataset?.sourceId||label?.dataset?.id||"");nodes.forEach(node=>ids.push(node.dataset.objectId||node.dataset.sourceId||node.dataset.id||""))}return Array.from(new Set(ids.filter(Boolean)))}
function render(){const s=slide();if(!s)return;state.visited=state.visited||{};state.visited[s.id]=true;if(typeof typedActivitySupported==="function"&&typedActivitySupported(s)){renderTypedActivity(s);resize();SCORM.suspend();debugSnapshot("render-typed");if(typeof checkCourseCompletion==="function"){checkCourseCompletion()}return}storylineRenderSlide({slide:s,state,stage,replaceVars,render,onDropInteraction:(payload)=>{debugSnapshot("drop-placed:"+(payload&&payload.drag&&payload.drag.id||""))},afterInteraction:()=>{SCORM.suspend();debugSnapshot("afterInteraction")},isInteractive:(obj)=>isScormInteractiveObject(obj,s)});attachRuntimeAudio();runtimeStartTimeline(s,stage);const runtimeObjects=storylineRendererVisibleObjects({slide:slide(),state});stage.querySelectorAll('.obj[data-interactive="true"]').forEach(el=>el.addEventListener("click",e=>{e.stopPropagation();const sourceId=el.dataset.objectId||el.dataset.sourceId||el.dataset.id;const runtimeKey=el.dataset.id||"";const suppress=state.__suppressClick;if(suppress&&suppress.moved&&Date.now()<=num(suppress.until,0)){state.__suppressClick={...suppress,pending:false};debugSnapshot("click-suppressed:"+sourceId);return}const obj=runtimeObjects.find(o=>storylineRendererObjectKey(o)===runtimeKey)||(slide().objects||[]).find(o=>o.id===sourceId);const actionSourceIds=linkedActionSources(el);const actionObjects={};runtimeObjects.forEach(o=>{if(o&&o.id)actionObjects[o.id]=o});(slide().objects||[]).forEach(o=>{if(o&&o.id&&!actionObjects[o.id])actionObjects[o.id]=o});const firstActionId=actionSourceIds[0]||sourceId;const actionObj=actionObjects[firstActionId]||obj;const commands=storylineRuntimeCommandsForObject({slide:slide(),sourceId:firstActionId,sourceIds:actionSourceIds,sourceObject:actionObj,sourceObjects:actionObjects,when:"onClick",state,variableDefinitions:PAYLOAD.variables});applyRuntimeCommands(commands)}));stage.querySelectorAll('.obj[data-interactive="true"]').forEach(el=>{const sourceId=el.dataset.objectId||el.dataset.sourceId||el.dataset.id;const runtimeKey=el.dataset.id||"";const obj=runtimeObjects.find(o=>storylineRendererObjectKey(o)===runtimeKey)||(slide().objects||[]).find(o=>o.id===sourceId);const motion=obj&&obj.buttonMotion&&typeof obj.buttonMotion==="object"?obj.buttonMotion:null;if(!motion)return;const linkedGroup=String(el.dataset.linkedHoverGroup||"").trim();const groupEls=()=>linkedGroup?Array.from(stage.querySelectorAll('.obj[data-linked-hover-group="'+linkedGroup.replace(/"/g,'\\"')+'"]')):[el];const baseTransform=el.style.transform||"";const baseShadow=el.style.boxShadow||"none";const baseFilter=el.style.filter||"brightness(1)";const hoverScale=Math.max(1.005,num(motion.hoverScale,1.02));const pressScale=Math.max(.92,num(motion.pressScale,.98));const liftY=Math.max(0,num(motion.liftY,1));const hoverFilter=String(motion.hoverFilter||"brightness(1.04)");const hoverShadow=String(motion.hoverShadow||baseShadow);const duration=Math.max(120,num(motion.duration,180));const easing=String(motion.easing||"cubic-bezier(.2,.82,.2,1)");groupEls().forEach(node=>{node.dataset.baseTransform=node.style.transform||"";node.dataset.baseShadow=node.style.boxShadow||"none";node.dataset.baseFilter=node.style.filter||"brightness(1)";node.style.transition="transform "+duration+"ms "+easing+", box-shadow "+duration+"ms "+easing+", filter "+duration+"ms "+easing});el.addEventListener("mouseenter",()=>{groupEls().forEach(node=>{const t=node.dataset.baseTransform||"";node.style.transform=(t?t+" ":"")+"translateY(-"+liftY+"px) scale("+hoverScale+")";node.style.boxShadow=hoverShadow;node.style.filter=hoverFilter})});el.addEventListener("mouseleave",()=>{groupEls().forEach(node=>{node.style.transform=node.dataset.baseTransform||"";node.style.boxShadow=node.dataset.baseShadow||"none";node.style.filter=node.dataset.baseFilter||"brightness(1)"})});el.addEventListener("pointerdown",()=>{groupEls().forEach(node=>{const t=node.dataset.baseTransform||"";node.style.transform=(t?t+" ":"")+"scale("+pressScale+")"})})});renderLivesBar();resize();SCORM.suspend();debugSnapshot("render");if(typeof checkCourseCompletion==="function"){checkCourseCompletion()}else{if(Object.keys(state.visited||{}).length>=PAYLOAD.slides.length)SCORM.completeCourse(100)}}
function resize(){const s=slide();if(!s)return;const w=num(s.stageWidth,1920),h=num(s.stageHeight,1080);const scale=Math.min(window.innerWidth/w,window.innerHeight/h);stage.style.width=w+"px";stage.style.height=h+"px";stage.style.transform="translate("+Math.round((window.innerWidth-w*scale)/2)+"px,"+Math.round((window.innerHeight-h*scale)/2)+"px) scale("+scale+")"}
function resetRuntime(){runtimeStopTimeline();state.activeLayerId="base";state.hidden={};state.objectStates={};state.dragPositions={};state.dropAssignments={};state.livesAttempts={};state.variables=buildVariables(PAYLOAD.variables)}
function restart(){state.index=PAYLOAD.slides[1]?1:0;state.visited={};resetRuntime();render()}
function goHome(){state.index=0;resetRuntime();render()}
function go(dir){const next=state.index+dir;if(next>=0&&next<PAYLOAD.slides.length){state.index=next;resetRuntime();render()}else if(next>=PAYLOAD.slides.length)finishCourse()}
function goToSlide(id){const next=PAYLOAD.slides.findIndex(s=>s.id===id);if(next>=0){state.index=next;resetRuntime();render()}}
function goToActivity(id){const next=PAYLOAD.slides.findIndex(s=>s.activityId===id);if(next>=0){state.index=next;resetRuntime();render()}}
function finishCourse(){if(typeof checkCourseCompletion==="function"){let score=100;let lessonStatus="passed";const hasTyped=PAYLOAD.slides.some(typedActivitySupported);if(hasTyped){score=typedAggregateScore();const passing=PAYLOAD.passingScore||70;const everySuccess=PAYLOAD.slides.filter(typedActivitySupported).every(item=>state.activityScores&&state.activityScores[item.id]&&state.activityScores[item.id].success);lessonStatus=everySuccess?"passed":(score>=passing?"passed":"completed")}else{lessonStatus="completed"}SCORM.set("cmi.core.score.raw",score);SCORM.set("cmi.core.score.min",0);SCORM.set("cmi.core.score.max",100);SCORM.set("cmi.core.session_time",SCORM.sessionTime());SCORM.set("cmi.core.lesson_status",lessonStatus);SCORM.commit();complete.classList.add("show")}else{SCORM.completeCourse(100);complete.classList.add("show")}}
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

  const customWidgetFiles = [];
  const processedWidgetIds = new Set();
  const stateCopy = JSON.parse(JSON.stringify(state || {}));
  const exportLang = getActivityContentLanguage(
    getOrderedRuntimeActivities(stateCopy, options)[0] || stateCopy
  );
  const widgetTx = runtimeText(exportLang);

  let hasCustomWidget = false;
  (stateCopy.activities || []).forEach((activity) => {
    (activity.slides || []).forEach((slide) => {
      (slide.objects || []).forEach((obj) => {
        if (obj?.type === 'custom-widget' && obj?.widget) {
          hasCustomWidget = true;
          const w = obj.widget;
          const widgetId = w.widgetId;
          w.basePath = `widgets/custom/${widgetId}`;
          w.entryUrl = `widgets/custom/${widgetId}/${w.entry || 'index.html'}`;
          delete w.blobMap;
          // Her widget nesnesinden rawAssets'i temizle (tekrarli ayni widget'ta ham
          // binary'nin payload JSON'una gomulup paketi sisirmesini onle). Dosya ekleme
          // yalniz ilk islemede yapilir; temizlik processedWidgetIds'ten bagimsizdir.
          const widgetRawAssets = w.rawAssets;
          delete w.rawAssets;

          if (!processedWidgetIds.has(widgetId)) {
            processedWidgetIds.add(widgetId);
            if (widgetRawAssets) {
              Object.entries(widgetRawAssets).forEach(([filePath, fileBytes]) => {
                let bytes = fileBytes;
                if (fileBytes && typeof fileBytes === 'object' && !(fileBytes instanceof Uint8Array)) {
                  bytes = new Uint8Array(Object.values(fileBytes));
                }
                if (filePath.endsWith('.html') || filePath.endsWith('.htm')) {
                  try {
                    let htmlText = new TextDecoder().decode(bytes);
                    if (htmlText.includes('/widget-sdk/eicerik-widget-sdk.js')) {
                      htmlText = htmlText.replace(/\/widget-sdk\/eicerik-widget-sdk\.js/g, '../../../widget-sdk/eicerik-widget-sdk.js');
                      bytes = new TextEncoder().encode(htmlText);
                    }
                  } catch (e) {}
                }
                customWidgetFiles.push({
                  name: `widgets/custom/${widgetId}/${filePath}`,
                  data: bytes,
                });
              });
            } else if (widgetId === 'dice-v1') {
              const diceAssets = {
                'index.html': `<!DOCTYPE html>
<html lang="${escXml(exportLang)}">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escXml(widgetTx.diceTitle)}</title>
<link rel="stylesheet" href="style.css"/>
</head>
<body>
<div class="dice-container">
  <div class="dice-face" id="diceFace">?</div>
  <button class="roll-button" id="rollButton">${escXml(widgetTx.diceRollButton)}</button>
</div>
<script src="../../../widget-sdk/eicerik-widget-sdk.js"></script>
<script src="widget.js"></script>
</body>
</html>`,
                'style.css': `* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  width: 100%;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(180deg, #f0f9ff, #e0f2fe);
  font-family: 'Segoe UI', Arial, sans-serif;
}

.dice-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
}

.dice-face {
  width: 120px;
  height: 120px;
  border-radius: 20px;
  background: #ffffff;
  border: 2px solid #0ea5e9;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 56px;
  font-weight: 900;
  color: #0c4a6e;
  box-shadow: 0 12px 28px rgba(14, 165, 233, 0.22);
  transition: transform 0.25s ease;
}

.dice-face.rolling {
  transform: scale(1.08) rotate(8deg);
}

.roll-button {
  min-width: 140px;
  height: 42px;
  border-radius: 10px;
  border: none;
  background: #0ea5e9;
  color: #ffffff;
  font-size: 15px;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 6px 16px rgba(14, 165, 233, 0.28);
  transition: transform 0.12s, box-shadow 0.12s;
}

.roll-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 20px rgba(14, 165, 233, 0.34);
}

.roll-button:active {
  transform: translateY(1px);
}`,
                'manifest.json': JSON.stringify({
                  id: 'dice-v1',
                  name: widgetTx.diceTitle,
                  version: '1.0.0',
                  entry: 'index.html',
                }),
                'widget.js': `(function() {
  'use strict';

  EicerikWidget.ready();

  var props = EicerikWidget.getProps();
  var min = Math.max(1, Number(props.min || 1));
  var max = Math.max(min, Number(props.max || 10));
  var animated = props.animated !== false;

  var diceFace = document.getElementById('diceFace');
  var rollButton = document.getElementById('rollButton');
  var isRolling = false;

  function rollDice() {
    if (isRolling) return;
    isRolling = true;

    if (animated && diceFace) {
      diceFace.classList.add('rolling');
    }

    var duration = animated ? 600 : 50;
    var intervalTime = animated ? 80 : 10;
    var elapsed = 0;

    var interval = setInterval(function() {
      elapsed += intervalTime;
      if (diceFace) {
        diceFace.textContent = String(Math.floor(Math.random() * (max - min + 1)) + min);
      }
      if (elapsed >= duration) {
        clearInterval(interval);
        var value = Math.floor(Math.random() * (max - min + 1)) + min;
        if (diceFace) {
          diceFace.textContent = String(value);
          diceFace.classList.remove('rolling');
        }
        isRolling = false;
        EicerikWidget.emit('diceRolled', { value: value });
      }
    }, intervalTime);
  }

  EicerikWidget.onCommand('roll', rollDice);
  EicerikWidget.onCommand('reset', function() {
    if (diceFace) diceFace.textContent = '?';
  });

  if (rollButton) {
    rollButton.addEventListener('click', rollDice);
  }
})();`
              };
              Object.entries(diceAssets).forEach(([filePath, content]) => {
                customWidgetFiles.push({
                  name: `widgets/custom/${widgetId}/${filePath}`,
                  data: content,
                });
              });
            } else if (widgetId === 'bird-flight-v1') {
              const birdAssets = {
                'index.html': `<!DOCTYPE html>
<html lang="${escXml(exportLang)}">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escXml(widgetTx.birdTitle)}</title>
<link rel="stylesheet" href="style.css"/>
</head>
<body>
<div class="sky">
  <div class="bird" id="bird">
    <div class="wing left" id="wingLeft"></div>
    <div class="wing right" id="wingRight"></div>
    <div class="body"></div>
  </div>
  <div class="ground"></div>
  <div class="status" id="status">${escXml(widgetTx.birdReady)}</div>
</div>
<script src="../../../widget-sdk/eicerik-widget-sdk.js"></script>
<script src="widget.js"></script>
</body>
</html>`,
                'style.css': `* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background: linear-gradient(180deg, #bae6fd 0%, #e0f2fe 60%, #f0f9ff 100%);
  font-family: 'Segoe UI', Arial, sans-serif;
}

.sky {
  position: relative;
  width: 100%;
  height: 100%;
}

.bird {
  position: absolute;
  left: 50%;
  bottom: 90px;
  width: 64px;
  height: 48px;
  transform: translateX(-50%);
  transition: bottom 0.6s ease;
}

.bird .body {
  position: absolute;
  left: 12px;
  top: 16px;
  width: 40px;
  height: 22px;
  border-radius: 999px;
  background: #f59e0b;
  border: 2px solid #d97706;
}

.wing {
  position: absolute;
  width: 28px;
  height: 10px;
  border-radius: 999px;
  background: #fbbf24;
  border: 2px solid #d97706;
  top: 10px;
  transition: transform 0.12s;
}

.wing.left {
  left: -4px;
  transform-origin: right center;
}

.wing.right {
  right: -4px;
  transform-origin: left center;
}

.wing.flap-up {
  transform: rotate(-35deg);
}

.wing.flap-down {
  transform: rotate(35deg);
}

.ground {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 60px;
  background: linear-gradient(180deg, #86efac, #22c55e);
  border-top: 3px solid #16a34a;
}

.status {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid #bae6fd;
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 800;
  color: #0c4a6e;
  min-width: 120px;
  text-align: center;
}`,
                'manifest.json': JSON.stringify({
                  id: 'bird-flight-v1',
                  name: widgetTx.birdTitle,
                  version: '1.0.0',
                  entry: 'index.html',
                }),
                'widget.js': `(function() {
  'use strict';

  EicerikWidget.ready();

  var props = EicerikWidget.getProps();
  var speed = Math.max(0.2, Math.min(3, Number(props.speed || 1)));
  var baseInterval = Math.round(250 / speed);

  var bird = document.getElementById('bird');
  var wingLeft = document.getElementById('wingLeft');
  var wingRight = document.getElementById('wingRight');
  var status = document.getElementById('status');

  function setStatus(text) {
    if (status) status.textContent = text;
  }

  function flapWings(up) {
    var cls = up ? 'flap-up' : 'flap-down';
    var rem = up ? 'flap-down' : 'flap-up';
    if (wingLeft) {
      wingLeft.classList.remove(rem);
      wingLeft.classList.add(cls);
    }
    if (wingRight) {
      wingRight.classList.remove(rem);
      wingRight.classList.add(cls);
    }
  }

  EicerikWidget.onCommand('flyWithFlaps', function(payload) {
    var flapCount = Math.max(1, Math.min(50, Number(payload.flapCount || 1)));
    var current = 0;
    var isUp = false;

    setStatus(${JSON.stringify(widgetTx.birdStartedPrefix)} + ': 0 / ' + flapCount);

    if (bird) {
      bird.style.bottom = '140px';
    }

    function step() {
      current += 1;
      isUp = !isUp;
      flapWings(isUp);

      setStatus(${JSON.stringify(widgetTx.birdFlapPrefix)} + ': ' + current + ' / ' + flapCount);

      EicerikWidget.emit('flapComplete', {
        current: current,
        total: flapCount
      });

      if (current < flapCount) {
        setTimeout(step, baseInterval);
        return;
      }

      // Landing
      setTimeout(function() {
        flapWings(false);
        if (bird) {
          bird.style.bottom = '90px';
        }
        setStatus(${JSON.stringify(widgetTx.birdComplete)});
        EicerikWidget.emit('flightComplete', {
          flapCount: flapCount
        });
      }, baseInterval);
    }

    step();
  });

  EicerikWidget.onCommand('reset', function() {
    if (bird) bird.style.bottom = '90px';
    flapWings(false);
    setStatus(${JSON.stringify(widgetTx.birdReady)});
  });
})();`
              };
              Object.entries(birdAssets).forEach(([filePath, content]) => {
                customWidgetFiles.push({
                  name: `widgets/custom/${widgetId}/${filePath}`,
                  data: content,
                });
              });
            }
          }
        }
      });
    });
  });

  if (hasCustomWidget) {
    customWidgetFiles.push({
      name: 'widget-sdk/eicerik-widget-sdk.js',
      data: `(function(global) {
  'use strict';

  const PROTOCOL = {
    EVENT: 'EICERIK_WIDGET_EVENT',
    COMMAND: 'EICERIK_WIDGET_COMMAND',
    READY: 'EICERIK_WIDGET_READY',
    ERROR: 'EICERIK_WIDGET_ERROR',
    COMPLETE: 'EICERIK_WIDGET_COMPLETE',
    PROPS: 'EICERIK_WIDGET_PROPS',
  };

  function getWidgetInstanceId() {
    try {
      const params = new URLSearchParams(global.location.search);
      return params.get('instanceId') || '';
    } catch {
      return '';
    }
  }

  const instanceId = getWidgetInstanceId();
  const commandHandlers = new Map();
  let propsCache = null;
  let readySent = false;

  function postMessage(type, payload) {
    if (!global.parent || global.parent === global) return;
    global.parent.postMessage(
      {
        type,
        widgetInstanceId: instanceId,
        ...(payload ? { payload } : {}),
      },
      '*'
    );
  }

  function EicerikWidget() {}

  EicerikWidget.ready = function() {
    if (readySent) return;
    readySent = true;
    postMessage(PROTOCOL.READY);
  };

  EicerikWidget.emit = function(eventName, payload) {
    postMessage(PROTOCOL.EVENT, { eventName, payload });
  };

  EicerikWidget.onCommand = function(commandName, handler) {
    if (typeof commandName !== 'string' || typeof handler !== 'function') return;
    commandHandlers.set(commandName, handler);
  };

  EicerikWidget.getProps = function() {
    if (propsCache) return { ...propsCache };
    try {
      const params = new URLSearchParams(global.location.search);
      const raw = params.get('props');
      if (raw) {
        propsCache = JSON.parse(decodeURIComponent(raw));
        return { ...propsCache };
      }
    } catch {
      // ignore parse error
    }
    return {};
  };

  EicerikWidget.error = function(errorPayload) {
    postMessage(PROTOCOL.ERROR, errorPayload);
  };

  EicerikWidget.complete = function(payload) {
    postMessage(PROTOCOL.COMPLETE, payload);
  };

  function handleMessage(event) {
    if (!event.data || typeof event.data !== 'object') return;
    const data = event.data;
    if (data.type !== PROTOCOL.COMMAND) return;
    if (data.widgetInstanceId !== instanceId) return;
    const handler = commandHandlers.get(data.command);
    if (typeof handler === 'function') {
      try {
        handler(data.payload || {});
      } catch (err) {
        EicerikWidget.error({
          code: 'COMMAND_HANDLER_ERROR',
          message: String(err && err.message),
        });
      }
    }
  }

  if (global.addEventListener) {
    global.addEventListener('message', handleMessage);
  }

  global.EicerikWidget = EicerikWidget;
})(window);`,
    });
  }

  const orderedActivities = isBookScope
    ? getOrderedRuntimeActivities(stateCopy, { ...options, scope: 'book' })
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
            stateCopy,
            { ...cfg, packageName: entry.title },
            { ...options, scope: 'activity', activityId: entry.activity.id }
          ),
        }))
      : [{ name: 'index.html', data: buildStorylinePlayerHtml(stateCopy, cfg, { ...options, scope }) }];

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
