export const TYPED_ACTIVITY_PLAYER_STYLE = `
.typed-activity{position:absolute;inset:0;overflow:auto;padding:48px 64px;background:#fff;color:#0f172a;font-size:clamp(14px, 2vmin, 22px);line-height:1.55}
.typed-title{font-size:clamp(20px, 3.5vmin, 34px);line-height:1.2;margin:0 0 26px;color:#0f172a}
.typed-question{max-width:1200px;margin:0 0 26px;color:#334155;font-weight:600}
.typed-sentence{display:flex;align-items:center;flex-wrap:wrap;gap:10px;max-width:1300px;padding:28px;border:1px solid #e2e8f0;border-radius:16px;background:#f8fafc}
.typed-blank,.typed-entry{height:48px;min-width:132px;padding:0 12px;border:2px solid #cbd5e1;border-radius:9px;background:#fff;font:inherit;text-align:center;color:#0f172a}
.typed-entry{width:min(460px,100%);text-align:left}
.typed-blank:focus,.typed-entry:focus,select:focus,.typed-btn:focus{outline:3px solid #06b6d4;outline-offset:2px}
.typed-actions{display:flex;gap:16px;align-items:center;margin-top:28px;flex-wrap:wrap}
.typed-btn{height:52px;min-width:150px;padding:0 22px;border:0;border-radius:10px;background:#1d4ed8;color:var(--typed-button-text-color,#fff);font-family:var(--typed-button-font-family,inherit);font-size:var(--typed-button-font-size,inherit);font-weight:var(--typed-button-font-weight,800);white-space:nowrap;cursor:pointer;transition:transform 0.18s cubic-bezier(0.2, 0.82, 0.2, 1), box-shadow 0.18s cubic-bezier(0.2, 0.82, 0.2, 1)}
.typed-btn:hover{transform:translateY(-1px);box-shadow:0 8px 20px rgba(29,78,216,0.22)}
.typed-btn:active{transform:translateY(1px)}
.typed-btn.secondary{background:#fff;color:var(--typed-button-secondary-text-color,#1e293b);border:2px solid #cbd5e1}
.typed-btn.secondary:hover{background:#f8fafc;box-shadow:0 8px 20px rgba(30,41,59,0.08)}
.typed-feedback{display:inline-flex;align-items:center;min-height:52px;margin-top:22px;padding:10px 18px;border-radius:10px;font-weight:800;font-size:clamp(12px, 1.8vmin, 18px)}
.typed-feedback.correct{background:#dcfce7;color:#166534}
.typed-feedback.incorrect{background:#fee2e2;color:#991b1b}
.typed-feedback.neutral{background:#f3e8ff;color:#5b21b6;border:1px solid #e9d5ff}
.typed-card{max-width:1150px;margin:0 0 18px;padding:22px;border:1px solid #e2e8f0;border-radius:14px;background:#fff}
.typed-card-title{padding:0 8px;font-weight:800;color:#1e293b}
.typed-choice,.typed-match{display:flex;align-items:center;gap:12px;margin:12px 0;cursor:pointer}
.typed-choice input{width:24px;height:24px;accent-color:#2563eb}
.typed-match select{min-width:240px;height:48px;padding:0 10px;font:inherit;border:2px solid #cbd5e1;border-radius:8px;background:#fff}
.typed-puzzle-grid{display:grid;gap:2px;width:max-content;margin:8px 0 18px;padding:4px;background:#cbd5e1;border-radius:6px}
.typed-cell{display:flex;align-items:center;justify-content:center;width:42px;height:42px;border:0;background:#fff;color:#1e293b;text-align:center;font:inherit;font-weight:800;position:relative;cursor:pointer;user-select:none;font-size:clamp(12px, 2.5vmin, 24px)}
.typed-cell.block{background:#1e293b;cursor:default}
.typed-cell.fixed{background:#e2e8f0;cursor:default}
.typed-cell.active{outline:3px solid #2563eb;outline-offset:-2px}
.typed-cell-number{position:absolute;top:1px;left:2px;font-size:9px;font-weight:600;color:#64748b}
.typed-word-cell{min-width:42px;padding:0;border-radius:0;background:#fff;color:#1e293b}
.typed-word-cell.selected{background:#dbeafe;color:#1d4ed8}
.typed-counter{margin:10px 0;color:#475569;font-weight:700}
.typed-maze-grid{display:grid;gap:0;width:max-content;padding:3px;background:#1e293b}
.typed-maze-cell{width:28px;height:28px;background:#fff}
.typed-maze-cell.wall{background:#1e293b}
.typed-maze-cell.start{background:#22c55e}
.typed-maze-cell.end{background:#ef4444}
.typed-maze-cell.player{background:#2563eb}
.typed-maze-controls{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}
.typed-maze-controls .typed-btn{min-width:114px;height:46px}
.typed-memory-grid{display:grid;grid-template-columns:repeat(4,130px);gap:12px;width:max-content}
.typed-memory-card{height:92px;border:0;border-radius:10px;background:#475569;color:#fff;font:inherit;font-weight:700;cursor:pointer}
.typed-memory-card.matched{background:#166534}
.typed-hotspot-scene{position:relative;margin:12px 0 20px;overflow:hidden;border:2px solid #cbd5e1;border-radius:12px;background:#f1f5f9 center/cover no-repeat}
.typed-hotspot{position:absolute;display:grid;place-items:center;min-width:34px;padding:2px;border:3px solid #dc2626;border-radius:999px;background:rgba(220,38,38,.25);color:#7f1d1d;font-weight:800;cursor:pointer}
.typed-hotspot.selected{border-color:#1d4ed8;background:#dbeafe;color:#1d4ed8}

/* Crossword Layout & Clues */
.typed-crossword-layout{display:flex;gap:20px;margin-bottom:12px;flex-wrap:wrap}
.typed-clues-panel{min-width:240px;flex:1;max-height:480px;overflow-y:auto;display:flex;flex-direction:column;gap:12px;font-size:clamp(12px, 1.8vmin, 15px)}
.typed-clues-section-title{font-weight:900;color:#1e293b;border-bottom:2px solid #e2e8f0;padding-bottom:4px;margin-bottom:6px;letter-spacing:0.4px;text-transform:uppercase}
.typed-clue-item{padding:6px 10px;border-radius:8px;margin-bottom:3px;color:#475569;background:#f8fafc;cursor:pointer;transition:background 0.2s}
.typed-clue-item:hover{background:#f1f5f9}
.typed-clue-item.correct{color:#166534;background:#dcfce7}
.typed-clue-item.incorrect{color:#991b1b;background:#fee2e2}
.typed-clue-item.revealed{color:#5b21b6;background:#f3e8ff}

/* Turkish Keyboard Modal */
.typed-modal-overlay{position:fixed;inset:0;z-index:2147483647;background:rgba(15, 23, 42, 0.5);display:flex;align-items:center;justify-content:center;padding:16px}
.typed-modal-card{width:min(540px,100%);border-radius:20px;background:#ffffff;box-shadow:0 25px 50px -12px rgba(0, 0, 0, 0.25);padding:24px;display:flex;flex-direction:column;gap:16px;position:relative}
.typed-modal-header{display:flex;justify-content:space-between;align-items:center}
.typed-modal-title{font-size:14px;font-weight:900;color:#4f46e5;text-transform:uppercase;letter-spacing:0.4px}
.typed-modal-attempts{font-size:11px;font-weight:700;color:#64748b;background:#f1f5f9;padding:2px 8px;border-radius:12px}
.typed-modal-clue{font-size:clamp(13px, 2vmin, 16px);font-weight:700;color:#1e293b;line-height:1.5}
.typed-char-slots{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin:10px 0}
.typed-char-slot{width:38px;height:38px;border-radius:8px;border:2px solid #cbd5e1;background:#fff;display:flex;align-items:center;justify-content:center;font-size:clamp(12px, 2.5vmin, 18px);font-weight:800;color:#1e293b;cursor:pointer}
.typed-char-slot.active{border-color:#4f46e5;background:#f5f3ff;box-shadow:0 0 0 3px #c7d2fe}
.typed-char-slot.locked{background:#e2e8f0;color:#64748b;cursor:not-allowed}
.typed-keyboard-panel{display:flex;flex-direction:column;gap:6px;align-items:center}
.typed-keyboard-row{display:flex;gap:4px}
.typed-key{min-width:32px;height:36px;border-radius:6px;border:1px solid #cbd5e1;background:#f8fafc;font-size:clamp(12px, 1.8vmin, 15px);font-weight:700;color:#334155;cursor:pointer;display:grid;place-items:center;padding:0 8px;transition:background 0.1s}
.typed-key:hover{background:#e2e8f0}
.typed-key:focus-visible{outline:2px solid #06b6d4;outline-offset:2px}
.typed-key.backspace{border-color:#fecaca;background:#fef2f2;color:#ef4444;font-size:12px;font-weight:800}
.typed-key.backspace:hover{background:#fee2e2}
.typed-modal-feedback{padding:10px 14px;border-radius:10px;font-size:13px;font-weight:700;display:flex;align-items:center;gap:6px}
.typed-modal-feedback.success{background:#dcfce7;color:#15803d;border:1px solid #bbf7d0}
.typed-modal-feedback.error{background:#fee2e2;color:#b91c1c;border:1px solid #fecaca}
.typed-modal-feedback.revealed{background:#f3e8ff;color:#6d28d9;border:1px solid #e9d5ff}
.typed-modal-actions{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}
.typed-modal-actions .typed-btn{height:40px;min-width:100px;font-size:13px;padding:0 14px}
`;

export const TYPED_ACTIVITY_PLAYER_SCRIPT = `
// ✓ Doğru
// × Yanlış
// Oyuncu metinleri: PAYLOAD.i18n seçilen üretim diliyle gelir; yoksa Türkçe fallback.
function typedText(key, fallback) {
  return (typeof PAYLOAD !== "undefined" && PAYLOAD.i18n && PAYLOAD.i18n[key]) || fallback;
}
function typedActivitySupported(slide) {
  return !!(slide && ["fill-blank", "mixed", "puzzle", "hotspot", "sequence"].includes(slide.type));
}
function typedEl(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = String(text);
  return node;
}
function typedCleanCssText(value) {
  var safe = String(value || "").trim();
  return safe && !/[;{}<>]/.test(safe) ? safe : "";
}
function typedCleanCssColor(value) {
  var safe = typedCleanCssText(value);
  if (!safe) return "";
  if (/^#[0-9a-fA-F]{3,8}$/.test(safe)) return safe;
  return "";
}
function typedApplyButtonTypography(root, current) {
  if (!root || !current) return;
  var color = typedCleanCssColor(current.readyButtonTextColor);
  var family = typedCleanCssText(current.readyButtonFontFamily);
  var size = Number(current.readyButtonFontSize);
  var weight = Number(current.readyButtonFontWeight);
  if (color) {
    root.style.setProperty("--typed-button-text-color", color);
    root.style.setProperty("--typed-button-secondary-text-color", color);
  }
  if (family) root.style.setProperty("--typed-button-font-family", family);
  if (Number.isFinite(size) && size >= 10 && size <= 32) {
    root.style.setProperty("--typed-button-font-size", Math.round(size) + "px");
  }
  if (Number.isFinite(weight) && weight >= 400 && weight <= 950) {
    root.style.setProperty("--typed-button-font-weight", String(Math.round(weight / 50) * 50));
  }
}
function typedStore(key, fallback) {
  if (state[key] == null) state[key] = fallback;
  return state[key];
}
// Can/hak: editörde answerControl.livesX olarak saklanır (SCORM'a taşınan anahtar).
function typedLivesConfig(current) {
  const ac = (current && current.answerControl) || {};
  if (ac.livesEnabled !== true) return { enabled: false };
  const count = Math.max(1, Math.min(99, Number(ac.livesCount) || 3));
  var glyphMap = { heart: "❤️", star: "⭐", diamond: "💎", apple: "🍎", bolt: "⚡", trophy: "🏆", crown: "👑", flower: "🌸", balloon: "🎈", medal: "🏅" };
  var iconId = ac.livesIconId || "heart";
  var useCustom = iconId === "custom" && !!ac.livesCustomImage;
  return {
    enabled: true,
    count: count,
    glyph: useCustom ? "" : (glyphMap[iconId] || glyphMap.heart),
    useCustom: useCustom,
    customImage: ac.livesCustomImage || "",
    behaviorOnZero: ac.livesBehaviorOnZero || "lock",
  };
}
function typedLivesAttempts(current) {
  var store = typedStore("typedLivesAttempts", {});
  return Number(store[current.id]) || 0;
}
function typedLivesRemaining(current) {
  var cfg = typedLivesConfig(current);
  if (!cfg.enabled) return null;
  return Math.max(0, cfg.count - typedLivesAttempts(current));
}
function typedLivesBar(root, current) {
  var cfg = typedLivesConfig(current);
  if (!cfg.enabled) return;
  var remaining = typedLivesRemaining(current);
  var bar = typedEl("div", "typed-lives");
  bar.setAttribute("role", "status");
  bar.setAttribute("aria-label", typedText("livesRemaining", "Kalan can") + ": " + remaining + " / " + cfg.count);
  bar.style.cssText = "display:inline-flex;align-items:center;gap:4px;margin:6px 0";
  for (var i = 0; i < cfg.count; i++) {
    var filled = i < remaining;
    if (cfg.useCustom) {
      var img = document.createElement("img");
      img.src = cfg.customImage;
      img.alt = "";
      img.style.cssText = "width:22px;height:22px;object-fit:contain;opacity:" + (filled ? "1" : "0.25") + ";filter:" + (filled ? "none" : "grayscale(1)");
      bar.appendChild(img);
    } else {
      var span = typedEl("span", "", cfg.glyph);
      span.style.cssText = "font-size:20px;line-height:1;opacity:" + (filled ? "1" : "0.25") + ";filter:" + (filled ? "none" : "grayscale(1)");
      bar.appendChild(span);
    }
  }
  root.appendChild(bar);
}
function typedButton(label, onClick, secondary) {
  const button = typedEl("button", secondary ? "typed-btn secondary" : "typed-btn", label);
  button.type = "button";
  button.addEventListener("click", onClick);
  return button;
}
function typedQuestion(root, text) {
  if (text) root.appendChild(typedEl("p", "typed-question", text));
}
function typedFeedback(root) {
  const result = state.typedActivityResult;
  if (!result) return;
  const success = !!result.success;
  const completed = !!result.completed;
  const assisted = !!(result.revealed > 0 || result.assisted);

  let className = "typed-feedback incorrect";
  let symbol = "×";
  let text = typedText("incorrectShort", "Yanlış");

  if (success) {
    className = "typed-feedback correct";
    symbol = "✓";
    text = typedText("correctShort", "Doğru");
  } else if (completed && assisted) {
    className = "typed-feedback neutral";
    symbol = "✎";
    text = typedText("solvedWithSolution", "Etkinlik çözüm desteğiyle tamamlandı.");
  }

  const message = typedEl("div", className);
  message.setAttribute("role", "status");
  message.setAttribute("aria-live", "polite");
  message.setAttribute("aria-atomic", "true");

  const correct = Number.isFinite(result.earnedPoints) ? result.earnedPoints : (Number.isFinite(result.correct) ? result.correct : null);
  const total = Number.isFinite(result.totalPoints) ? result.totalPoints : (Number.isFinite(result.total) ? result.total : null);

  message.textContent = symbol + " " + text + (correct != null && total != null ? " (" + correct + " / " + total + ")" : "");
  root.appendChild(message);
}
function typedScore(result) {
  const earned = Number.isFinite(result.earnedPoints) ? result.earnedPoints : (Number.isFinite(result.correct) ? result.correct : (result.success ? 1 : 0));
  const total = Number.isFinite(result.totalPoints) ? result.totalPoints : (Number.isFinite(result.total) ? result.total : 1);
  return { earned: Math.max(0, earned), total: Math.max(1, total), completed: !!result.completed, success: !!result.success };
}
function typedAggregateScore() {
  const records = Object.values(state.activityScores || {});
  if (!records.length) return 0;
  const earned = records.reduce((sum, item) => sum + item.earned, 0);
  const total = records.reduce((sum, item) => sum + item.total, 0);
  return Math.round(earned / Math.max(1, total) * 100);
}
function typedEveryCompleted() {
  return PAYLOAD.slides.filter(typedActivitySupported).every(item => 
    state.activityScores && state.activityScores[item.id] && state.activityScores[item.id].completed
  );
}
function checkCourseCompletion() {
  const hasTyped = PAYLOAD.slides.some(typedActivitySupported);
  const allVisited = Object.keys(state.visited || {}).length >= PAYLOAD.slides.length;
  const allTypedCompleted = !hasTyped || typedEveryCompleted();
  
  if (allVisited && allTypedCompleted) {
    let score = 100;
    let lessonStatus = "passed";
    
    if (hasTyped) {
      score = typedAggregateScore();
      const passing = PAYLOAD.passingScore || 70;
      const everySuccess = PAYLOAD.slides.filter(typedActivitySupported).every(item => 
        state.activityScores && state.activityScores[item.id] && state.activityScores[item.id].success
      );
      if (everySuccess) {
        lessonStatus = "passed";
      } else {
        lessonStatus = score >= passing ? "passed" : "completed";
      }
    } else {
      lessonStatus = "completed";
    }
    
    SCORM.set("cmi.core.score.raw", score);
    SCORM.set("cmi.core.score.min", 0);
    SCORM.set("cmi.core.score.max", 100);
    SCORM.set("cmi.core.session_time", SCORM.sessionTime());
    SCORM.set("cmi.core.lesson_status", lessonStatus);
    SCORM.commit();
    // Otomatik "Tamamlandı" ekranı yalnızca typed etkinliklerde (fill-blank, mixed,
    // puzzle, hotspot, sequence) anlamlıdır: orada tüm sorular gerçekten çözülmüştür.
    // Typed olmayan (selection/storyline akışı) etkinliklerde "tüm sahneleri gezmek"
    // tamamlama anlamına gelmez; bu yüzden her render'da ekran açılmasını engelliyoruz.
    // SCORM durumu yukarıda yine bildirildi; "Tamamlandı" ekranı yalnızca açık bir
    // "Tamamla" aksiyonuyla (finishCourse) açılır.
    if (hasTyped) {
      complete.classList.add("show");
    }
  }
}
function typedEvaluate(current) {
  if (current.type === "fill-blank") return evaluateStorylineRuntimeFillBlank({ slide: current, state: state });
  if (current.type === "mixed") return evaluateStorylineRuntimeMixed({ slide: current, state: state });
  if (current.type === "puzzle") return evaluateStorylineRuntimePuzzle({ activity: current, state: state });
  if (current.type === "hotspot") return evaluateStorylineRuntimeHotspot({ slide: current, objects: current.objects || [], state: state });
  if (current.type === "sequence") return evaluateStorylineRuntimeSequence({ slide: current, state: state });
  return { success: false };
}
function typedCheck(current) {
  const cfg = typedLivesConfig(current);
  // Can etkin ve can bitmişse yeni kontrol kabul etme (kilit davranışı).
  if (cfg.enabled && typedLivesRemaining(current) <= 0) {
    return;
  }
  const result = typedEvaluate(current);
  state.typedActivityResult = result;
  // Can etkinse ve cevap yanlışsa bir can düş.
  if (cfg.enabled && !result.success) {
    const store = typedStore("typedLivesAttempts", {});
    store[current.id] = (Number(store[current.id]) || 0) + 1;
  }
  state.activityScores = state.activityScores || {};
  state.activityScores[current.id] = typedScore(result);
  const score = typedAggregateScore();
  
  SCORM.set("cmi.core.score.raw", score);
  SCORM.set("cmi.core.score.min", 0);
  SCORM.set("cmi.core.score.max", 100);
  SCORM.commit();

  checkCourseCompletion();
  render();
}
function typedClear(current) {
  state.fillBlankValues = {};
  state.mixedAnswers = {};
  state.clickedHotspots = [];
  state.puzzleFoundWords = [];
  state.puzzleMemoryMatched = [];
  state.puzzleMemoryFlipped = [];
  state.puzzleMazePosition = null;
  state.puzzleMazeReachedEnd = false;
  state.typedActivityResult = null;

  // puzzleQuestionStatus: terminal correct/revealed durumları silme!
  if (state.puzzleQuestionStatus) {
    Object.keys(state.puzzleQuestionStatus).forEach(key => {
      const status = state.puzzleQuestionStatus[key];
      if (status !== 'correct' && status !== 'revealed') {
        delete state.puzzleQuestionStatus[key];
      }
    });
  }

  // puzzleGrid: correct/revealed kelimelere ait harfleri koru, diğerlerini sil!
  if (state.puzzleGrid && current && current.puzzlePlaced) {
    const activeCells = new Set();
    current.puzzlePlaced.forEach(p => {
      const status = state.puzzleQuestionStatus && state.puzzleQuestionStatus[p.id];
      if (status === 'correct' || status === 'revealed') {
        const len = p.answer ? p.answer.length : 0;
        for (let i = 0; i < len; i++) {
          const r = p.direction === 'across' ? (p.startRow ?? p.row) : (p.startRow ?? p.row) + i;
          const c = p.direction === 'across' ? (p.startCol ?? p.col) + i : (p.startCol ?? p.col);
          activeCells.add(r + "," + c);
        }
      }
    });
    Object.keys(state.puzzleGrid).forEach(key => {
      if (!activeCells.has(key)) {
        delete state.puzzleGrid[key];
      }
    });
  } else {
    state.puzzleGrid = {};
  }
}
function typedActions(root, current) {
  typedLivesBar(root, current);
  const cfg = typedLivesConfig(current);
  const livesOut = cfg.enabled && typedLivesRemaining(current) <= 0;
  const actions = typedEl("div", "typed-actions");
  const checkBtn = typedButton(typedText("checkLabel", "Kontrol Et"), () => typedCheck(current), false);
  if (livesOut) {
    checkBtn.disabled = true;
    checkBtn.style.opacity = "0.45";
    checkBtn.style.cursor = "not-allowed";
  }
  actions.appendChild(checkBtn);
  actions.appendChild(typedButton(typedText("clearLabel", "Temizle"), () => { typedClear(current); render(); }, true));
  root.appendChild(actions);
  if (livesOut) {
    const note = typedEl("div", "typed-feedback incorrect", typedText("livesOut", "Canların bitti."));
    note.style.marginTop = "12px";
    root.appendChild(note);
  }
  typedFeedback(root);
}
function typedFillBlankTokens(container, sentence, values, answers) {
  let index = 0;
  String(sentence || "").split(/(___|\\{.+?\\})/g).filter(Boolean).forEach(part => {
    const blank = part === "___" || (part.charAt(0) === "{" && part.charAt(part.length - 1) === "}");
    if (!blank) {
      container.appendChild(document.createTextNode(part));
      return;
    }
    const answer = answers[index] || {};
    const id = answer.id || "blank-" + index;
    const input = typedEl("input", "typed-blank");
    input.type = "text";
    input.value = values[id] || "";
    input.setAttribute("aria-label", typedText("blankLabel", "Boşluk") + " " + (index + 1));
    input.addEventListener("input", event => {
      values[id] = event.target.value;
      state.typedActivityResult = null;
    });
    container.appendChild(input);
    index += 1;
  });
}
function typedRenderFillBlank(root, current) {
  typedQuestion(root, current.fillBlankQuestion || typedText("fillBlanksHint", "Boşlukları doldurunuz."));
  const sentence = typedEl("div", "typed-sentence");
  typedFillBlankTokens(sentence, current.fillBlankSentence, typedStore("fillBlankValues", {}), current.fillBlankAnswers || []);
  root.appendChild(sentence);
  typedActions(root, current);
}
function typedRenderMixed(root, current) {
  const answers = typedStore("mixedAnswers", {});
  (current.mixedItems || []).forEach((item, index) => {
    const card = typedEl("fieldset", "typed-card");
    card.appendChild(typedEl("legend", "typed-card-title", typedText("questionLabel", "Soru") + " " + (index + 1) + ": " + (item.question || "")));
    if (item.type === "selection") {
      const multiple = item.mode === "multi" || (item.options || []).filter(option => option.isCorrect).length > 1;
      (item.options || []).forEach((option, optionIndex) => {
        const label = typedEl("label", "typed-choice");
        const input = document.createElement("input");
        input.type = multiple ? "checkbox" : "radio";
        input.name = "mixed-" + item.id;
        input.value = option.id || String(optionIndex);
        const selected = answers[item.id];
        input.checked = multiple ? (Array.isArray(selected) && selected.includes(input.value)) : selected === input.value;
        input.addEventListener("change", () => {
          if (multiple) {
            const values = Array.isArray(answers[item.id]) ? answers[item.id].slice() : [];
            answers[item.id] = input.checked ? Array.from(new Set(values.concat(input.value))) : values.filter(value => value !== input.value);
          } else {
            answers[item.id] = input.value;
          }
          state.typedActivityResult = null;
        });
        label.appendChild(input);
        label.appendChild(document.createTextNode(option.label || input.value));
        card.appendChild(label);
      });
    } else if (item.type === "drag-drop") {
      const values = answers[item.id] && typeof answers[item.id] === "object" ? answers[item.id] : (answers[item.id] = {});
      (item.pairs || []).forEach(pair => {
        const label = typedEl("label", "typed-match");
        label.appendChild(document.createTextNode((pair.left || "") + " "));
        const select = document.createElement("select");
        select.setAttribute("aria-label", (pair.left || "Eşleştirme") + " için seçim");
        select.appendChild(new Option(typedText("selectPlaceholder", "Seçiniz..."), ""));
        (item.pairs || []).forEach(option => select.appendChild(new Option(option.right || "", option.right || "")));
        select.value = values[pair.id] || "";
        select.addEventListener("change", event => {
          values[pair.id] = event.target.value;
          state.typedActivityResult = null;
        });
        label.appendChild(select);
        card.appendChild(label);
      });
    } else if (item.type === "fill-blank") {
      const values = answers[item.id] && typeof answers[item.id] === "object" ? answers[item.id] : (answers[item.id] = {});
      const sentence = typedEl("div", "typed-sentence");
      let blankIndex = 0;
      String(item.sentence || "").split(/(___|\\{.+?\\})/g).filter(Boolean).forEach(part => {
        const blank = part === "___" || (part.charAt(0) === "{" && part.charAt(part.length - 1) === "}");
        if (!blank) {
          sentence.appendChild(document.createTextNode(part));
          return;
        }
        const key = blankIndex++;
        const input = typedEl("input", "typed-blank");
        input.value = values[key] || "";
        input.setAttribute("aria-label", typedText("blankLabel", "Boşluk") + " " + (key + 1));
        input.addEventListener("input", event => {
          values[key] = event.target.value;
          state.typedActivityResult = null;
        });
        sentence.appendChild(input);
      });
      card.appendChild(sentence);
    } else {
      const input = typedEl("input", "typed-entry");
      input.type = item.type === "numeric" ? "number" : "text";
      input.value = answers[item.id] || "";
      input.setAttribute("aria-label", item.question || typedText("answerLabel", "Yanıt"));
      input.addEventListener("input", event => {
        answers[item.id] = event.target.value;
        state.typedActivityResult = null;
      });
      card.appendChild(input);
    }
    root.appendChild(card);
  });
  typedActions(root, current);
}

/* Trap Focus Helper */
function trapFocus(container) {
  var nodes = container.querySelectorAll('button, [tabindex]:not([tabindex="-1"])');
  if (!nodes.length) return;
  var first = nodes[0], last = nodes[nodes.length - 1];
  container.addEventListener('keydown', function(e) {
    if (e.key !== 'Tab') return;
    if (e.shiftKey && document.activeElement === first) {
      last.focus(); e.preventDefault();
    } else if (!e.shiftKey && document.activeElement === last) {
      first.focus(); e.preventDefault();
    }
  });
}

/* Türkçe Sanal Klavye Modal & Crossword Deneyimi */
function openCrosswordModal(word, current, gridCellEl) {
  const overlay = typedEl("div", "typed-modal-overlay");
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");

  const card = typedEl("div", "typed-modal-card");
  
  // Header
  const header = typedEl("div", "typed-modal-header");
  header.appendChild(typedEl("div", "typed-modal-title", typedText("questionLabel", "Soru") + " " + word.number + " (" + (word.direction === "across" ? typedText("acrossShort", "Yatay") : typedText("downShort", "Dikey")) + ")"));

  const attempts = typedStore("puzzleAttempts", {});
  const qAttempts = attempts[word.id] || 0;
  header.appendChild(typedEl("div", "typed-modal-attempts", typedText("attemptsLabel", "Deneme Sayısı") + ": " + qAttempts));
  card.appendChild(header);

  // Clue Text
  card.appendChild(typedEl("div", "typed-modal-clue", word.question || word.clue || typedText("noHint", "İpucu belirtilmemiş.")));

  // Status feedback box
  const qStatus = typedStore("puzzleQuestionStatus", {});
  const currentStatus = qStatus[word.id] || "unanswered";
  
  const feedbackBox = typedEl("div", "typed-modal-feedback");
  feedbackBox.setAttribute("aria-live", "polite");
  feedbackBox.setAttribute("aria-atomic", "true");
  feedbackBox.style.display = "none";
  card.appendChild(feedbackBox);

  function updateFeedbackUI(statusText, type) {
    feedbackBox.style.display = "flex";
    feedbackBox.className = "typed-modal-feedback " + type;
    feedbackBox.textContent = statusText;
  }

  // Pre-fill feedback if already correct or revealed
  if (currentStatus === "correct") {
    updateFeedbackUI("✓ " + typedText("typedCorrect", "Tebrikler, doğru cevap!"), "success");
  } else if (currentStatus === "revealed") {
    updateFeedbackUI("✎ " + typedText("typedRevealed", "Çözüm gösterildi."), "revealed");
  } else if (currentStatus === "incorrect") {
    updateFeedbackUI("× " + typedText("typedIncorrect", "Hatalı cevap! Tekrar deneyebilirsiniz."), "error");
  }

  // Harf Kutuları & Hücre Kilitleme Kuralı
  const wordLen = word.answer ? word.answer.length : 0;
  const userGrid = typedStore("puzzleGrid", {});
  const modalInput = [];
  const slotElements = [];
  let modalActiveCharIndex = 0;

  // Karakter slotlarını oluştur
  const charSlotsContainer = typedEl("div", "typed-char-slots");
  for (let i = 0; i < wordLen; i++) {
    const r = word.direction === 'across' ? (word.startRow ?? word.row) : (word.startRow ?? word.row) + i;
    const c = word.direction === 'across' ? (word.startCol ?? word.col) + i : (word.startCol ?? word.col);
    
    // Lock Kontrol: Başka tamamlanmış (correct/revealed) kelimeden gelen ortak harf ise kilitli/salt okunur
    let isLocked = false;
    const otherCompleted = (current.puzzlePlaced || []).filter(other => 
      other.id !== word.id && (qStatus[other.id] === 'correct' || qStatus[other.id] === 'revealed')
    );
    otherCompleted.forEach(other => {
      const otherLen = other.answer ? other.answer.length : 0;
      for (let j = 0; j < otherLen; j++) {
        const or = other.direction === 'across' ? (other.startRow ?? other.row) : (other.startRow ?? other.row) + j;
        const oc = other.direction === 'across' ? (other.startCol ?? other.col) + j : (other.startCol ?? other.col);
        if (or === r && oc === c) {
          isLocked = true;
        }
      }
    });

    const val = userGrid[r + "," + c] || "";
    modalInput.push(val);

    const slot = typedEl("div", "typed-char-slot" + (isLocked ? " locked" : ""));
    slot.textContent = val;
    slot.dataset.index = i;
    slot.dataset.locked = isLocked ? "true" : "false";

    if (!isLocked) {
      slot.addEventListener("click", () => {
        charSlotsContainer.querySelectorAll(".typed-char-slot").forEach(el => el.classList.remove("active"));
        slot.classList.add("active");
        modalActiveCharIndex = i;
      });
    }
    charSlotsContainer.appendChild(slot);
    slotElements.push(slot);
  }
  card.appendChild(charSlotsContainer);

  // Set first unlocked slot as active
  let firstUnlocked = slotElements.findIndex(el => el.dataset.locked === "false");
  if (firstUnlocked >= 0) {
    modalActiveCharIndex = firstUnlocked;
    slotElements[firstUnlocked].classList.add("active");
  }

  // Char Input handlers
  function setChar(char) {
    if (currentStatus === "correct" || currentStatus === "revealed") return;
    const activeSlot = slotElements[modalActiveCharIndex];
    if (activeSlot && activeSlot.dataset.locked === "false") {
      modalInput[modalActiveCharIndex] = char.toUpperCase();
      activeSlot.textContent = char.toUpperCase();
      // Move to next unlocked slot
      let nextIndex = modalActiveCharIndex + 1;
      while (nextIndex < wordLen && slotElements[nextIndex].dataset.locked === "true") {
        nextIndex++;
      }
      if (nextIndex < wordLen) {
        slotElements.forEach(el => el.classList.remove("active"));
        slotElements[nextIndex].classList.add("active");
        modalActiveCharIndex = nextIndex;
      }
    }
  }

  function handleBackspace() {
    if (currentStatus === "correct" || currentStatus === "revealed") return;
    const activeSlot = slotElements[modalActiveCharIndex];
    if (activeSlot && activeSlot.dataset.locked === "false") {
      modalInput[modalActiveCharIndex] = "";
      activeSlot.textContent = "";
    }
    // Move to previous unlocked slot
    let prevIndex = modalActiveCharIndex - 1;
    while (prevIndex >= 0 && slotElements[prevIndex].dataset.locked === "true") {
      prevIndex--;
    }
    if (prevIndex >= 0) {
      slotElements.forEach(el => el.classList.remove("active"));
      slotElements[prevIndex].classList.add("active");
      modalActiveCharIndex = prevIndex;
    }
  }

  // Türkçe Sanal Klavye
  const TURKISH_KEYBOARD = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', 'Ğ', 'Ü'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ş', 'İ'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M', 'Ö', 'Ç']
  ];

  const kbPanel = typedEl("div", "typed-keyboard-panel");
  TURKISH_KEYBOARD.forEach((row, rIdx) => {
    const rowDiv = typedEl("div", "typed-keyboard-row");
    row.forEach(char => {
      const key = typedEl("button", "typed-key", char);
      key.type = "button";
      key.addEventListener("click", () => setChar(char));
      rowDiv.appendChild(key);
    });
    if (rIdx === 2) {
      const bs = typedEl("button", "typed-key backspace", typedText("backspace", "← Sil"));
      bs.type = "button";
      bs.addEventListener("click", handleBackspace);
      rowDiv.appendChild(bs);
    }
    kbPanel.appendChild(rowDiv);
  });
  card.appendChild(kbPanel);

  // Kontrol Et & Çözümü Göster Aksiyonları
  function checkAnswer() {
    const activeStatus = qStatus[word.id] || "unanswered";
    if (activeStatus === "correct" || activeStatus === "revealed") return;
    const userInput = modalInput.join("").toUpperCase();
    const answer = (word.answer || "").toUpperCase();
    const isCorrect = userInput === answer;

    attempts[word.id] = (attempts[word.id] || 0) + 1;
    header.querySelector(".typed-modal-attempts").textContent = typedText("attemptsLabel", "Deneme Sayısı") + ": " + attempts[word.id];

    if (isCorrect) {
      qStatus[word.id] = "correct";
      updateFeedbackUI("✓ " + typedText("typedCorrect", "Tebrikler, doğru cevap!"), "success");
      
      // Grid üzerine harfleri doldur
      for (let i = 0; i < wordLen; i++) {
        const r = word.direction === 'across' ? (word.startRow ?? word.row) : (word.startRow ?? word.row) + i;
        const c = word.direction === 'across' ? (word.startCol ?? word.col) + i : (word.startCol ?? word.col);
        userGrid[r + "," + c] = answer[i];
      }
      state.typedActivityResult = null;
      setTimeout(() => {
        document.body.removeChild(overlay);
        render();
        if (gridCellEl) gridCellEl.focus();
      }, 1200);
    } else {
      qStatus[word.id] = "incorrect";
      updateFeedbackUI("× " + typedText("typedIncorrect", "Hatalı cevap! Tekrar deneyebilirsiniz."), "error");
    }
  }

  function revealSolution() {
    const activeStatus = qStatus[word.id] || "unanswered";
    if (activeStatus === "correct" || activeStatus === "revealed") return;
    const answer = (word.answer || "").toUpperCase();
    qStatus[word.id] = "revealed";
    updateFeedbackUI("✎ " + typedText("typedRevealed", "Çözüm gösterildi."), "revealed");

    checkBtn.disabled = true;
    checkBtn.style.opacity = "0.5";
    const hintElement = card.querySelector(".typed-modal-actions button:nth-child(2)");
    if (hintElement) {
      hintElement.disabled = true;
      hintElement.style.opacity = "0.5";
    }

    for (let i = 0; i < wordLen; i++) {
      const r = word.direction === 'across' ? (word.startRow ?? word.row) : (word.startRow ?? word.row) + i;
      const c = word.direction === 'across' ? (word.startCol ?? word.col) + i : (word.startCol ?? word.col);
      userGrid[r + "," + c] = answer[i];
      slotElements[i].textContent = answer[i];
      modalInput[i] = answer[i];
    }
    state.typedActivityResult = null;
    setTimeout(() => {
      document.body.removeChild(overlay);
      render();
      if (gridCellEl) gridCellEl.focus();
    }, 1500);
  }

  // Modal Actions
  const actions = typedEl("div", "typed-modal-actions");
  
  const checkBtn = typedButton("✓ " + typedText("checkLabel", "Kontrol Et"), checkAnswer, false);
  checkBtn.style.flex = "2 1 140px";
  actions.appendChild(checkBtn);

  const settings = current.puzzleSettings || {};
  if (settings.allowHints !== false) {
    const hintBtn = typedButton("✎ " + typedText("showSolutionLabel", "Çözümü Göster"), revealSolution, true);
    hintBtn.style.flex = "1 1 110px";
    actions.appendChild(hintBtn);
  }

  const closeBtn = typedButton(typedText("closeLabel", "Kapat"), () => {
    document.body.removeChild(overlay);
    render();
    if (gridCellEl) gridCellEl.focus();
  }, true);
  closeBtn.style.flex = "1 1 70px";
  actions.appendChild(closeBtn);
  
  card.appendChild(actions);

  // Keydown listener
  const keyHandler = function(e) {
    const k = e.key.toUpperCase();
    if (k === "ESCAPE") {
      document.body.removeChild(overlay);
      render();
      if (gridCellEl) gridCellEl.focus();
      e.preventDefault();
    } else if (k === "ENTER") {
      checkAnswer();
      e.preventDefault();
    } else if (k === "BACKSPACE") {
      handleBackspace();
      e.preventDefault();
    } else if (k.length === 1 && /[A-ZÇĞİÖŞÜ]/.test(k)) {
      setChar(k);
      e.preventDefault();
    }
  };
  window.addEventListener("keydown", keyHandler);

  // Clean up key listener on detach
  const observer = new MutationObserver((mutations, obs) => {
    if (!document.body.contains(overlay)) {
      window.removeEventListener("keydown", keyHandler);
      obs.disconnect();
    }
  });
  observer.observe(document.body, { childList: true });

  overlay.appendChild(card);
  document.body.appendChild(overlay);
  
  // Trap Focus and Focus first button
  trapFocus(card);
  const firstBtn = card.querySelector("button");
  if (firstBtn) firstBtn.focus();
}

function typedRenderCrossword(root, current) {
  const cells = (current.puzzleGrid && current.puzzleGrid.cells) || [];
  const placed = current.puzzlePlaced || [];
  const values = typedStore("puzzleGrid", {});
  const qStatus = typedStore("puzzleQuestionStatus", {});

  const layout = typedEl("div", "typed-crossword-layout");

  // Grid
  const grid = typedEl("div", "typed-puzzle-grid");
  const columns = (current.puzzleGrid && current.puzzleGrid.cols) || (cells[0] && cells[0].length) || 0;
  const rows = (current.puzzleGrid && current.puzzleGrid.rows) || cells.length || 0;
  
  grid.style.gridTemplateColumns = "repeat(" + columns + ", 42px)";
  grid.style.gridTemplateRows = "repeat(" + rows + ", 42px)";

  cells.forEach((row, rowIndex) => row.forEach((cell, columnIndex) => {
    const hasLetter = !!cell.letter;
    if (!hasLetter) {
      grid.appendChild(typedEl("span", "typed-cell block", ""));
      return;
    }

    const key = rowIndex + "," + columnIndex;
    const cellDiv = typedEl("div", "typed-cell");
    cellDiv.tabIndex = 0;
    cellDiv.setAttribute("aria-label", "Satır " + (rowIndex + 1) + " sütun " + (columnIndex + 1));

    if (cell.number) {
      const numSpan = typedEl("span", "typed-cell-number", cell.number);
      cellDiv.appendChild(numSpan);
    }

    cellDiv.appendChild(document.createTextNode(values[key] || ""));

    cellDiv.addEventListener("click", () => {
      // Bu hücreyi içeren placed sorusunu bul
      const word = placed.find(q => {
        const len = q.answer ? q.answer.length : 0;
        for (let i = 0; i < len; i++) {
          const qr = q.direction === "across" ? (q.startRow ?? q.row) : (q.startRow ?? q.row) + i;
          const qc = q.direction === "across" ? (q.startCol ?? q.col) + i : (q.startCol ?? q.col);
          if (qr === rowIndex && qc === columnIndex) return true;
        }
        return false;
      });
      if (word) {
        openCrosswordModal(word, current, cellDiv);
      }
    });

    cellDiv.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        cellDiv.click();
        e.preventDefault();
      }
    });

    grid.appendChild(cellDiv);
  }));

  layout.appendChild(grid);

  // Clues list
  const cluesPanel = typedEl("div", "typed-clues-panel");
  
  // Yatay Sorular
  const acrossSection = typedEl("div", "");
  acrossSection.appendChild(typedEl("div", "typed-clues-section-title", typedText("acrossLabel", "Yatay Sorular")));
  
  placed.filter(p => p.direction === "across").forEach(p => {
    const status = qStatus[p.id] || "unanswered";
    let cls = "typed-clue-item";
    let icon = "";
    if (status === "correct") { cls += " correct"; icon = " ✓"; }
    else if (status === "incorrect") { cls += " incorrect"; icon = " ×"; }
    else if (status === "revealed") { cls += " revealed"; icon = " ✎"; }

    const item = typedEl("div", cls);
    // Güvenlik: soru/ipucu metni öğretmen kaynaklı; innerHTML yerine textContent ile
    // kurularak öğrenciye giden SCORM paketinde XSS önlenir.
    item.appendChild(typedEl("strong", "", p.number + "."));
    item.appendChild(document.createTextNode(" " + (p.question || p.clue || "") + icon));
    item.addEventListener("click", () => openCrosswordModal(p, current, null));
    acrossSection.appendChild(item);
  });
  cluesPanel.appendChild(acrossSection);

  // Dikey Sorular
  const downSection = typedEl("div", "");
  downSection.appendChild(typedEl("div", "typed-clues-section-title", typedText("downLabel", "Dikey Sorular")));

  placed.filter(p => p.direction === "down").forEach(p => {
    const status = qStatus[p.id] || "unanswered";
    let cls = "typed-clue-item";
    let icon = "";
    if (status === "correct") { cls += " correct"; icon = " ✓"; }
    else if (status === "incorrect") { cls += " incorrect"; icon = " ×"; }
    else if (status === "revealed") { cls += " revealed"; icon = " ✎"; }

    const item = typedEl("div", cls);
    // Güvenlik: bkz. yukarıdaki yatay sorular — textContent ile XSS önlenir.
    item.appendChild(typedEl("strong", "", p.number + "."));
    item.appendChild(document.createTextNode(" " + (p.question || p.clue || "") + icon));
    item.addEventListener("click", () => openCrosswordModal(p, current, null));
    downSection.appendChild(item);
  });
  cluesPanel.appendChild(downSection);

  layout.appendChild(cluesPanel);
  root.appendChild(layout);

  typedActions(root, current);
}

function typedRenderWordsearch(root, current) {
  const cells = (current.puzzleGrid && current.puzzleGrid.cells) || [];
  const found = typedStore("puzzleFoundWords", []);
  const grid = typedEl("div", "typed-puzzle-grid");
  const columns = (current.puzzleGrid && current.puzzleGrid.cols) || (cells[0] && cells[0].length) || 0;
  grid.style.gridTemplateColumns = "repeat(" + columns + ", 42px)";
  cells.forEach((row, rowIndex) => row.forEach((cell, columnIndex) => {
    const button = typedButton(cell.letter || "", () => {
      if (!state.puzzleWordStart) {
        state.puzzleWordStart = { row: rowIndex, column: columnIndex };
        render();
        return;
      }
      const line = typedWordLine(state.puzzleWordStart, { row: rowIndex, column: columnIndex });
      const word = line.map(position => (cells[position.row] && cells[position.row][position.column] && cells[position.row][position.column].letter) || "").join("");
      const reverse = word.split("").reverse().join("");
      const match = (current.puzzlePlaced || []).find(item => !found.includes(item.id) && (item.answer === word || item.answer === reverse));
      if (match) found.push(match.id);
      state.puzzleWordStart = null;
      state.typedActivityResult = null;
      render();
    }, false);
    button.className = "typed-cell typed-word-cell" + (state.puzzleWordStart && state.puzzleWordStart.row === rowIndex && state.puzzleWordStart.column === columnIndex ? " selected" : "");
    grid.appendChild(button);
  }));
  root.appendChild(grid);
  root.appendChild(typedEl("p", "typed-counter", "Bulunan: " + found.length + " / " + (current.puzzlePlaced || []).length));
}
function typedWordLine(start, end) {
  const deltaRow = end.row - start.row;
  const deltaColumn = end.column - start.column;
  const steps = Math.max(Math.abs(deltaRow), Math.abs(deltaColumn));
  if (!steps) return [];
  const rowStep = deltaRow / steps;
  const columnStep = deltaColumn / steps;
  if (!Number.isInteger(rowStep) || !Number.isInteger(columnStep)) return [];
  const line = [];
  for (let index = 0; index <= steps; index += 1) line.push({ row: start.row + rowStep * index, column: start.column + columnStep * index });
  return line;
}
function typedRenderMaze(root, current) {
  const cells = (current.puzzleGrid && current.puzzleGrid.cells) || [];
  if (!state.puzzleMazePosition) {
    let position = { row: 1, column: 1 };
    cells.forEach((row, rowIndex) => row.forEach((cell, columnIndex) => {
      if (cell.isStart) position = { row: rowIndex, column: columnIndex };
    }));
    state.puzzleMazePosition = position;
  }
  const position = state.puzzleMazePosition;
  const grid = typedEl("div", "typed-maze-grid");
  const columns = (current.puzzleGrid && current.puzzleGrid.cols) || (cells[0] && cells[0].length) || 0;
  grid.style.gridTemplateColumns = "repeat(" + columns + ", 28px)";
  cells.forEach((row, rowIndex) => row.forEach((cell, columnIndex) => {
    const className = "typed-maze-cell" + (cell.isBlock ? " wall" : (position.row === rowIndex && position.column === columnIndex ? " player" : (cell.isEnd ? " end" : (cell.isStart ? " start" : ""))));
    grid.appendChild(typedEl("span", className, ""));
  }));
  root.appendChild(grid);
  const controls = typedEl("div", "typed-maze-controls");
  [[typedText("upLabel", "Yukarı"), -1, 0], [typedText("leftLabel", "Sol"), 0, -1], [typedText("rightLabel", "Sağ"), 0, 1], [typedText("downMoveLabel", "Aşağı"), 1, 0]].forEach(move => {
    controls.appendChild(typedButton(move[0], () => {
      const row = position.row + move[1];
      const column = position.column + move[2];
      if (cells[row] && cells[row][column] && !cells[row][column].isBlock) {
        state.puzzleMazePosition = { row: row, column: column };
        if (cells[row][column].isEnd) state.puzzleMazeReachedEnd = true;
        state.typedActivityResult = null;
        render();
      }
    }, false));
  });
  root.appendChild(controls);
}
function typedRenderMemory(root, current) {
  const cards = current.puzzlePlaced || [];
  const matched = typedStore("puzzleMemoryMatched", []);
  const flipped = typedStore("puzzleMemoryFlipped", []);
  const grid = typedEl("div", "typed-memory-grid");
  cards.forEach((card, index) => {
    const shown = flipped.includes(index) || matched.includes(card.pairId);
    const button = typedButton(shown ? (card.text || "") : "?", () => {
      if (shown || flipped.length >= 2) return;
      flipped.push(index);
      state.typedActivityResult = null;
      render();
      if (flipped.length === 2) {
        const first = cards[flipped[0]];
        const second = cards[flipped[1]];
        window.setTimeout(() => {
          if (first && second && first.pairId === second.pairId && !matched.includes(first.pairId)) matched.push(first.pairId);
          flipped.splice(0, flipped.length);
          render();
        }, 500);
      }
    }, false);
    button.className = "typed-memory-card" + (matched.includes(card.pairId) ? " matched" : "");
    grid.appendChild(button);
  });
  root.appendChild(grid);
  root.appendChild(typedEl("p", "typed-counter", typedText("matchedLabel", "Eşleşen") + ": " + matched.length + " / " + Math.floor(cards.length / 2)));
}
function typedRenderSudoku(root, current) {
  const cells = (current.puzzleGrid && current.puzzleGrid.cells) || [];
  const values = typedStore("puzzleGrid", {});
  const grid = typedEl("div", "typed-puzzle-grid");
  grid.style.gridTemplateColumns = "repeat(9, 42px)";
  grid.style.gridTemplateRows = "repeat(9, 42px)";
  cells.forEach((row, rowIndex) => row.forEach((cell, columnIndex) => {
    const key = rowIndex + "," + columnIndex;
    if (cell.isFixed) {
      values[key] = cell.letter;
      grid.appendChild(typedEl("span", "typed-cell fixed", cell.letter || ""));
      return;
    }
    const input = typedEl("input", "typed-cell");
    input.maxLength = 1;
    input.inputMode = "numeric";
    input.value = values[key] || "";
    input.setAttribute("aria-label", typedText("rowLabel", "Satır") + " " + (rowIndex + 1) + " " + typedText("columnLabel", "sütun") + " " + (columnIndex + 1));
    input.addEventListener("input", event => {
      let value = String(event.target.value || "").replace(/[^1-9]/g, "").slice(-1);
      event.target.value = value;
      values[key] = value;
      state.typedActivityResult = null;
    });
    grid.appendChild(input);
  }));
  root.appendChild(grid);
  typedActions(root, current);
}
function typedRenderSequence(root, current) {
  typedQuestion(root, current.sequenceQuestion || typedText("sequenceHint", "Öğeleri doğru sıraya diziniz."));
  const items = current.sequenceItems || [];
  if (!state.sequenceOrder) {
    let base = items.map(item => item.id);
    if (current.sequenceShuffle !== false) {
      base.sort(() => Math.random() - 0.5);
    }
    state.sequenceOrder = base;
  }
  const order = state.sequenceOrder;
  const orderedItems = order.map(id => items.find(item => item.id === id)).filter(Boolean);
  
  const container = typedEl("div", "");
  container.style.display = "grid";
  container.style.gap = "8px";
  container.style.maxWidth = "520px";
  container.style.margin = "12px 0 20px";
  
  orderedItems.forEach((item, index) => {
    const row = typedEl("div", "");
    row.style.cssText = "display:grid;grid-template-columns:34px 1fr auto auto;gap:12px;align-items:center;padding:12px 16px;border-radius:10px;border:1px solid #cbd5e1;background:#fff";
    
    const num = typedEl("span", "", current.sequenceAutoNumber !== false ? (index + 1) : "•");
    num.style.fontWeight = "900";
    num.style.color = "#64748b";
    row.appendChild(num);
    
    const label = typedEl("span", "", item.label);
    label.style.fontWeight = "800";
    row.appendChild(label);
    
    const upBtn = typedButton(typedText("upLabel", "Yukarı"), () => {
      if (index === 0) return;
      const next = [...state.sequenceOrder];
      [next[index], next[index - 1]] = [next[index - 1], next[index]];
      state.sequenceOrder = next;
      state.typedActivityResult = null;
      render();
    }, true);
    upBtn.style.height = "36px";
    upBtn.style.minWidth = "80px";
    upBtn.style.fontSize = "13px";
    upBtn.disabled = index === 0;
    if (index === 0) upBtn.style.opacity = "0.4";
    row.appendChild(upBtn);
    
    const downBtn = typedButton(typedText("downMoveLabel", "Aşağı"), () => {
      if (index === orderedItems.length - 1) return;
      const next = [...state.sequenceOrder];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      state.sequenceOrder = next;
      state.typedActivityResult = null;
      render();
    }, true);
    downBtn.style.height = "36px";
    downBtn.style.minWidth = "80px";
    downBtn.style.fontSize = "13px";
    downBtn.disabled = index === orderedItems.length - 1;
    if (index === orderedItems.length - 1) downBtn.style.opacity = "0.4";
    row.appendChild(downBtn);
    
    container.appendChild(row);
  });
  
  root.appendChild(container);
  typedActions(root, current);
}
function typedRenderPuzzle(root, current) {
  const puzzleType = current.puzzleType || "crossword";
  typedQuestion(root, puzzleType === "wordsearch" ? typedText("wordsearchHint", "Kelimeleri tabloda bulunuz.") : (puzzleType === "maze" ? typedText("mazeHint", "Ok düğmeleriyle çıkışa ulaşınız.") : typedText("puzzleHint", "Bulmacayı tamamlayınız.")));
  if (puzzleType === "wordsearch") typedRenderWordsearch(root, current);
  else if (puzzleType === "maze") typedRenderMaze(root, current);
  else if (puzzleType === "memory") typedRenderMemory(root, current);
  else if (puzzleType === "sudoku") typedRenderSudoku(root, current);
  else typedRenderCrossword(root, current);
}
function typedRenderHotspot(root, current) {
  typedQuestion(root, current.hotspotQuestion || typedText("hotspotHint", "Görseldeki doğru alanları işaretleyin."));
  const scene = typedEl("div", "typed-hotspot-scene");
  const stageWidth = Number(current.stageWidth) || 800;
  const stageHeight = Number(current.stageHeight) || 600;
  const scale = Math.min(1, 760 / stageWidth, 520 / stageHeight);
  scene.style.width = stageWidth * scale + "px";
  scene.style.height = stageHeight * scale + "px";
  if (current.hotspotImage) {
    scene.style.backgroundImage = 'url("' + String(current.hotspotImage).replace(/"/g, '\\\\"') + '")';
    const description = typedEl("span", "", current.hotspotImageAlt || typedText("interactiveImage", "Etkileşimli görsel"));
    description.setAttribute("role", "img");
    description.setAttribute("aria-label", current.hotspotImageAlt || typedText("interactiveImage", "Etkileşimli görsel"));
    description.style.cssText = "position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)";
    scene.appendChild(description);
  }
  const clicked = typedStore("clickedHotspots", []);
  (current.objects || []).filter(item => item.type === "hotspot").forEach(item => {
    const selected = clicked.includes(item.id);
    const button = typedButton(selected ? "✓" : (item.label || "?"), () => {
      const index = clicked.indexOf(item.id);
      if (index >= 0) clicked.splice(index, 1);
      else clicked.push(item.id);
      state.typedActivityResult = null;
      render();
    }, false);
    button.className = "typed-hotspot" + (selected ? " selected" : "");
    button.setAttribute("aria-pressed", selected ? "true" : "false");
    button.setAttribute("aria-label", item.label || "Etkin alan");
    button.style.left = (Number(item.x) || 0) * scale + "px";
    button.style.top = (Number(item.y) || 0) * scale + "px";
    button.style.width = Math.max(34, (Number(item.width) || 64) * scale) + "px";
    button.style.height = Math.max(34, (Number(item.height) || 64) * scale) + "px";
    scene.appendChild(button);
  });
  root.appendChild(scene);
  typedActions(root, current);
}
function renderTypedActivity(current) {
  stage.innerHTML = "";
  stage.style.background = current.backgroundColor || "#fff";
  const root = typedEl("main", "typed-activity");
  typedApplyButtonTypography(root, current);
  root.appendChild(typedEl("h1", "typed-title", current.activityName || "Etkinlik"));
  if (current.type === "fill-blank") typedRenderFillBlank(root, current);
  else if (current.type === "mixed") typedRenderMixed(root, current);
  else if (current.type === "puzzle") typedRenderPuzzle(root, current);
  else if (current.type === "hotspot") typedRenderHotspot(root, current);
  else if (current.type === "sequence") typedRenderSequence(root, current);
  stage.appendChild(root);
}
`;
