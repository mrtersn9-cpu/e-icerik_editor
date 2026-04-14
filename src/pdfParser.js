export function normalizePdfText(value = "") {
  return String(value)
    .toLocaleLowerCase("tr-TR")
    .replace(/[çÇ]/g, "c")
    .replace(/[Ã§Ã‡]/g, "c")
    .replace(/[ğĞ]/g, "g")
    .replace(/[ÄŸÄ]/g, "g")
    .replace(/[ıİ]/g, "i")
    .replace(/[Ä±Ä°]/g, "i")
    .replace(/[öÖ]/g, "o")
    .replace(/[Ã¶Ã–]/g, "o")
    .replace(/[şŞ]/g, "s")
    .replace(/[ÅŸÅ]/g, "s")
    .replace(/[üÜ]/g, "u")
    .replace(/[Ã¼Ãœ]/g, "u")
    .replace(/[_–—-]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export function sanitizePdfText(value = "") {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/\u0000/g, "")
    .trim();
}

const PDF_LIST_PREFIX_RE = /^\s*(?:(?:\(?\d+\)?|\(?[a-zçğıöşü]\)?)\s*[.)\-:]|[-•●▪])\s*/iu;
const PDF_NUMBERED_ANCHOR_RE = /^\s*\d+\s*[.)\-:]/;
const PDF_CHECKBOX_RE = /^\s*[☑☐✓✔✗✘]\s*/u;
const PDF_CHECK_MARK_RE = /[☑☐✓✔✗✘]/u;
const PDF_TRAILING_CHECK_MARK_RE = /\s+[☑☐✓✔✗✘]\s*$/u;
const PDF_DOTTED_BLANK_RE = /\.{5,}/g;

function stripPdfListPrefix(value = "") {
  return sanitizePdfText(value).replace(PDF_LIST_PREFIX_RE, "").trim();
}

function stripTrailingCheckMark(value = "") {
  return sanitizePdfText(value).replace(PDF_TRAILING_CHECK_MARK_RE, "").trim();
}

function getPdfLineTokens(line = {}) {
  return (Array.isArray(line?.tokens) ? line.tokens : [])
    .map((token) => ({
      text: sanitizePdfText(token?.text || ""),
      x: Number(token?.x || 0),
      width: Number(token?.width || 0),
      height: Number(token?.height || 0),
    }))
    .filter((token) => token.text);
}

function findPdfCheckMarkToken(line = {}) {
  return getPdfLineTokens(line).find((token) => PDF_CHECK_MARK_RE.test(token.text)) || null;
}

function isStandalonePdfNumber(value = "") {
  return /^\s*\d+\s*$/u.test(sanitizePdfText(value));
}

function isLikelyPdfFooter(value = "") {
  const text = normalizePdfText(value);
  return text === "kontrol et" || text === "cevapla" || text === "ileri";
}

function isLikelyPdfHeaderRow(value = "") {
  const text = normalizePdfText(value);
  return text.includes("tema ")
    || text === "tema"
    || text.startsWith("yargilar ")
    || text.includes("dogru siralamalar")
    || text.includes("suruklenebilir ogeler");
}

function isLikelyPdfStatement(value = "") {
  const text = stripTrailingCheckMark(stripPdfListPrefix(value));
  if (!text || text.length < 8) return false;
  if (isLikelyPdfFooter(text) || isLikelyPdfHeaderRow(text) || isStandalonePdfNumber(text)) return false;
  const normalized = normalizePdfText(text);
  if (normalized.includes("yazilimciya not") || normalized.includes("numara yazilmayacak")) return false;
  return text.split(/\s+/).filter(Boolean).length >= 2;
}

export function detectPdfDraftKind(lines = [], pageCount = 1, marker = null) {
  const text = normalizePdfText(lines.map((line) => line.text).join(" "));
  if (marker?.kindHint === "video" || text.includes("video slayt") || text.includes("seslendirilmesi yapilmadi")) {
    return "video";
  }
  if (text.includes("suruklenebilir ogeler") || text.includes("surukleyiniz") || text.includes("suruklenebilir")) {
    return "drag-drop";
  }
  if (text.includes("siralayiniz") || text.includes("karisik olan beytlerini") || text.includes("siralayin")) {
    return "sequence";
  }
  if (text.includes("dogru ise") || text.includes("yanlis ise") || text.includes("kutucuklarini isaretleyiniz") || text.includes("kutucugu")) {
    return "selection";
  }
  if (text.includes("asagidaki masali okuyunuz") || pageCount > 1) {
    return "reading";
  }
  return "unknown";
}

export function extractPdfDragTerms(lines = []) {
  const startIndex = lines.findIndex((line) => normalizePdfText(line.text).includes("suruklenebilir ogeler"));
  if (startIndex === -1) return [];
  const hasRightColumnPool = lines.slice(startIndex + 1).some((line) => Number(line?.x || 0) >= 1000);
  const terms = [];
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const rawValue = sanitizePdfText(lines[index]?.text || "");
    const normalized = normalizePdfText(rawValue);
    if (!normalized) continue;
    if (normalized.includes("dogru eslestirme")) break;
    if (normalized.includes("e-icerik") || normalized.includes("yazilimciya not") || normalized.includes("numara yazilmayacak")) continue;
    if (isStandalonePdfNumber(rawValue) || /^[.\s]+$/.test(rawValue)) continue;
    if (hasRightColumnPool && Number(lines[index]?.x || 0) < 1000) continue;

    const value = stripPdfListPrefix(rawValue);
    if (!value) continue;

    const wordCount = value.split(/\s+/).filter(Boolean).length;
    const looksLikeSentence = /[.!?]$/.test(value) || wordCount > 8;
    if (!looksLikeSentence && value.length <= 80 && !/^\d+$/.test(value) && !/\.{3,}/.test(value)) {
      terms.push(value);
    }
  }
  return [...new Set(terms)];
}

export function extractPdfAnswerTerms(lines = []) {
  const answerIndex = lines.findIndex((line) => normalizePdfText(line.text).includes("dogru eslestirme"));
  if (answerIndex === -1) return [];
  const combined = lines
    .slice(answerIndex)
    .map((line) => sanitizePdfText(line.text))
    .join(" ")
    .replace(/doğru\s+eşleştirme\s*:?/iu, "")
    .replace(/dogru\s+eslestirme\s*:?/iu, "")
    .trim();

  return combined
    .split(/\s+(?=(?:\d+|[a-zçğıöşü])\s*[.)\-])/iu)
    .map((part) => stripPdfListPrefix(part).replace(/[.;,]+$/g, "").trim())
    .filter((value) => value && !normalizePdfText(value).includes("dogru eslestirme"));
}

export function extractPdfQuestionAnchors(lines = [], pageHeight = 1080) {
  const anchors = lines
    .filter((line) => PDF_NUMBERED_ANCHOR_RE.test(sanitizePdfText(line.text || "")))
    .map((line) => ({
      text: line.text,
      x: line.x,
      y: line.y,
      height: line.height || 28,
      width: line.width || 0,
    }));
  if (!anchors.length) return [];
  return anchors.map((anchor, index) => ({
    ...anchor,
    stageY: anchor.y,
    order: index + 1,
  }));
}

function isLikelyInstructionLine(value = "") {
  const text = normalizePdfText(value);
  return /(surukleyiniz|eslestiriniz|isaretleyiniz|siralayiniz|numaralandiriniz|dogru ise|yanlis ise|uygun kavramlari)/.test(text);
}

function stripTrailingAnswerDots(value = "") {
  return sanitizePdfText(value).replace(/\.{3,}/g, "").replace(/\s+/g, " ").trim();
}

function stripCheckboxPrefix(value = "") {
  return sanitizePdfText(value).replace(PDF_CHECKBOX_RE, "").trim();
}

function isDecorativePdfHeading(value = "") {
  const text = normalizePdfText(stripPdfListPrefix(value));
  return text.startsWith("tema ") || text === "tema" || text.startsWith("haz.");
}

function findStatementLines(lines = []) {
  return lines
    .map((line) => sanitizePdfText(line?.text || ""))
    .filter(Boolean)
    .filter((text) => PDF_NUMBERED_ANCHOR_RE.test(text) || /^\s*[☑☐✓✔✗✘]/u.test(text));
}

export function detectPdfInteractionType(lines = []) {
  const text = normalizePdfText(lines.map((line) => line?.text || "").join(" "));
  if ((text.includes("yargilar") || text.includes("yargilarla")) && /\bd\b/.test(text) && /\by\b/.test(text)) return "TrueFalse";
  if (text.includes("siralayiniz") || text.includes("numaralandiriniz")) return "Ordering";
  if (text.includes("suruklenebilir ogeler") || text.includes("surukleyiniz") || text.includes("eslestiriniz")) return "DragDrop";
  if (((text.includes("kutucugu") || text.includes("kutucuklarini")) && text.includes("isaretleyiniz")) || /[☑☐]/u.test(lines.map((line) => line?.text || "").join(" "))) return "Checkbox";
  if (text.includes("yazilimciya not") || text.includes("video slayt") || text.includes("sesli slayt")) return "MediaSlayt";
  return "Content";
}

export function extractDeveloperNote(lines = []) {
  const startIndex = lines.findIndex((line) => normalizePdfText(line?.text || "").includes("yazilimciya not"));
  if (startIndex === -1) return "";

  const collected = [];
  for (let index = startIndex; index < lines.length; index += 1) {
    const raw = sanitizePdfText(lines[index]?.text || "");
    const normalized = normalizePdfText(raw);
    if (!raw) {
      if (collected.length) break;
      continue;
    }
    if (index > startIndex && (isLikelyInstructionLine(raw) || normalized.includes("suruklenebilir ogeler") || normalized.includes("dogru eslestirme") || normalized.includes("yargilar"))) {
      break;
    }
    collected.push(raw.replace(/yazilimciya\s+not\s*:?/iu, "").trim());
  }

  return sanitizePdfText(collected.filter(Boolean).join(" "));
}

export function extractTrueFalseItems(lines = []) {
  const items = [];
  const normalizedLines = Array.isArray(lines) ? lines : [];
  const headerLine = normalizedLines.find((line) => {
    const tokens = getPdfLineTokens(line);
    return tokens.some((token) => normalizePdfText(token.text) === "d")
      && tokens.some((token) => normalizePdfText(token.text) === "y");
  }) || normalizedLines.find((line) => normalizePdfText(line?.text || "") === "yargilar d y");
  const headerTokens = getPdfLineTokens(headerLine);
  const dToken = headerTokens.find((token) => normalizePdfText(token.text) === "d");
  const yToken = headerTokens.find((token) => normalizePdfText(token.text) === "y");
  const dCenter = dToken ? dToken.x + (dToken.width / 2) : null;
  const yCenter = yToken ? yToken.x + (yToken.width / 2) : null;
  let currentItem = null;

  normalizedLines.forEach((line) => {
    const raw = sanitizePdfText(line?.text || "");
    const normalized = normalizePdfText(raw);
    if (!raw || normalized === "yargilar d y" || isLikelyPdfFooter(raw) || isLikelyInstructionLine(raw)) return;

    if (PDF_NUMBERED_ANCHOR_RE.test(raw)) {
      const statement = stripTrailingCheckMark(stripPdfListPrefix(raw));
      if (isDecorativePdfHeading(statement)) return;
      const markToken = findPdfCheckMarkToken(line);
      const answerFromColumns = markToken && dCenter != null && yCenter != null
        ? (Math.abs((markToken.x + (markToken.width / 2)) - dCenter) <= Math.abs((markToken.x + (markToken.width / 2)) - yCenter) ? "D" : "Y")
        : null;
      currentItem = {
        id: `item_${items.length + 1}`,
        statement,
        correctAnswer: answerFromColumns,
      };
      items.push(currentItem);
      return;
    }

    const markToken = findPdfCheckMarkToken(line);
    if (markToken && dCenter != null && yCenter != null && isLikelyPdfStatement(raw)) {
      items.push({
        id: `item_${items.length + 1}`,
        statement: stripTrailingCheckMark(raw),
        correctAnswer: Math.abs((markToken.x + (markToken.width / 2)) - dCenter) <= Math.abs((markToken.x + (markToken.width / 2)) - yCenter) ? "D" : "Y",
      });
      currentItem = items[items.length - 1];
      return;
    }

    if ((normalized === "d" || normalized === "y") && currentItem && !currentItem.correctAnswer) {
      currentItem.correctAnswer = normalized.toUpperCase();
      return;
    }

    if (currentItem && !currentItem.correctAnswer && /(^|\s)(d|y)\s*$/i.test(raw)) {
      const answer = raw.match(/(d|y)\s*$/i)?.[1]?.toUpperCase() || null;
      currentItem.statement = stripPdfListPrefix(raw.replace(/(d|y)\s*$/i, ""));
      currentItem.correctAnswer = answer;
    }
  });

  return items.filter((item) => item.statement);
}

export function extractCheckboxItems(lines = []) {
  const normalizedLines = Array.isArray(lines) ? lines : [];
  const instructionIndex = normalizedLines.findIndex((line) => isLikelyInstructionLine(line?.text || ""));
  const contentLines = normalizedLines.slice(instructionIndex >= 0 ? instructionIndex + 1 : 0);

  return contentLines
    .map((line, index) => {
      const raw = sanitizePdfText(line?.text || "");
      if (!raw || isLikelyPdfFooter(raw) || isLikelyPdfHeaderRow(raw) || isDecorativePdfHeading(raw)) return null;
      const checkToken = findPdfCheckMarkToken(line);
      const hasLeadingCheckbox = PDF_CHECKBOX_RE.test(raw);
      const looksLikeStatement = hasLeadingCheckbox || isLikelyPdfStatement(raw);
      if (!looksLikeStatement) return null;
      const checked = hasLeadingCheckbox
        ? !/^\s*☐/u.test(raw)
        : !!checkToken;
      return {
        id: `item_${index + 1}`,
        text: hasLeadingCheckbox ? stripCheckboxPrefix(raw) : stripTrailingCheckMark(raw),
        correctAnswer: checked,
      };
    })
    .filter((item) => item?.text);
}

export function extractOrderingItems(lines = []) {
  const normalizedLines = Array.isArray(lines) ? lines : [];
  const numberedItems = normalizedLines
    .map((line) => sanitizePdfText(line?.text || ""))
    .filter((text) => PDF_NUMBERED_ANCHOR_RE.test(text) && !isDecorativePdfHeading(text))
    .map((text, index) => {
      const order = Number((text.match(/^\s*(\d+)/) || [])[1] || index + 1);
      return {
        id: `item_${index + 1}`,
        text: stripPdfListPrefix(text),
        correctOrder: order,
      };
    });
  if (numberedItems.length) return numberedItems;

  const startIndex = normalizedLines.findIndex((line) => normalizePdfText(line?.text || "").includes("dogru siralamalar"));
  const candidateLines = normalizedLines.slice(startIndex >= 0 ? startIndex + 1 : 0);
  const seen = new Set();

  return candidateLines
    .map((line) => stripTrailingCheckMark(stripPdfListPrefix(sanitizePdfText(line?.text || ""))))
    .filter((text) => isLikelyPdfStatement(text))
    .filter((text) => {
      const key = normalizePdfText(text);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((text, index) => ({
      id: `item_${index + 1}`,
      text,
      correctOrder: index + 1,
    }));
}

export function findDottedBlankSegments(lines = []) {
  const segments = [];
  lines.forEach((line, lineIndex) => {
    const raw = String(line?.text || "");
    if (!PDF_DOTTED_BLANK_RE.test(raw)) return;
    PDF_DOTTED_BLANK_RE.lastIndex = 0;
    const totalWidth = Number(line?.width || 0);
    const charWidth = raw.length ? totalWidth / raw.length : 8;
    let match = PDF_DOTTED_BLANK_RE.exec(raw);
    while (match) {
      const prefixLength = match.index;
      const blankLength = String(match[0] || "").length;
      segments.push({
        id: `blank_${lineIndex + 1}_${segments.length + 1}`,
        x: Number(line?.x || 0) + (prefixLength * charWidth),
        y: Number(line?.y || 0),
        width: Math.max(24, blankLength * charWidth),
        height: Math.max(12, Number(line?.height || 18)),
        text: raw,
      });
      match = PDF_DOTTED_BLANK_RE.exec(raw);
    }
    PDF_DOTTED_BLANK_RE.lastIndex = 0;
  });
  return segments;
}

export function extractInstruction(lines = []) {
  const direct = lines.find((line) => isLikelyInstructionLine(line?.text || ""));
  if (direct) return sanitizePdfText(direct.text);

  const fallback = lines
    .map((line) => sanitizePdfText(line?.text || ""))
    .find((text) => text && text.length > 24 && !normalizePdfText(text).includes("yazilimciya not"));

  return fallback || "";
}

function buildDragDropPage(page = {}) {
  const lines = Array.isArray(page.lines) ? page.lines : [];
  const draggableItems = extractPdfDragTerms(lines);
  const answers = extractPdfAnswerTerms(lines);
  const answerIndex = lines.findIndex((line) => normalizePdfText(line?.text || "").includes("dogru eslestirme"));
  const anchorEntries = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line, index }) => {
      const text = sanitizePdfText(line?.text || "");
      const normalized = normalizePdfText(text);
      return (answerIndex === -1 || index < answerIndex)
        && PDF_NUMBERED_ANCHOR_RE.test(text)
        && !isDecorativePdfHeading(text)
        && !normalized.includes("dogru eslestirme");
    });
  const anchorLines = anchorEntries.map(({ line, index }, entryIndex) => {
    const nextAnchorIndex = anchorEntries[entryIndex + 1]?.index ?? (answerIndex >= 0 ? answerIndex : lines.length);
    const continuationText = lines
      .slice(index + 1, nextAnchorIndex)
      .filter((candidate) => Number(candidate?.x || 0) < 1000)
      .map((candidate) => sanitizePdfText(candidate?.text || ""))
      .filter((text) => {
        const normalized = normalizePdfText(text);
        return text
          && !PDF_NUMBERED_ANCHOR_RE.test(text)
          && !normalized.includes("suruklenebilir ogeler")
          && !normalized.includes("dogru eslestirme")
          && !isStandalonePdfNumber(text)
          && !/^[.\s]+$/u.test(text);
      })
      .map((text) => stripTrailingAnswerDots(stripPdfListPrefix(text)))
      .join(" ");
    return {
      ...line,
      text: sanitizePdfText([line?.text || "", continuationText].filter(Boolean).join(" ")),
    };
  });
  const fallbackBlanks = findDottedBlankSegments(lines);
  const sourceAnchors = anchorLines.length ? anchorLines : fallbackBlanks;

  const dropZones = sourceAnchors.map((anchor, index) => ({
    id: `zone_${index + 1}`,
    statement: stripTrailingAnswerDots(stripPdfListPrefix(anchor?.text || "")),
    correctAnswer: answers[index] || null,
  })).filter((item) => item.statement);

  return {
    instruction: extractInstruction(lines),
    dropZones,
    draggableItems,
  };
}

function buildTrueFalsePage(page = {}) {
  const lines = Array.isArray(page.lines) ? page.lines : [];
  return {
    instruction: extractInstruction(lines),
    items: extractTrueFalseItems(lines),
  };
}

function buildCheckboxPage(page = {}) {
  const lines = Array.isArray(page.lines) ? page.lines : [];
  return {
    instruction: extractInstruction(lines),
    items: extractCheckboxItems(lines),
  };
}

function buildOrderingPage(page = {}) {
  const lines = Array.isArray(page.lines) ? page.lines : [];
  return {
    instruction: extractInstruction(lines),
    items: extractOrderingItems(lines),
  };
}

function buildMediaPage(page = {}) {
  const lines = Array.isArray(page.lines) ? page.lines : [];
  const developerNote = extractDeveloperNote(lines);
  const content = lines
    .map((line) => sanitizePdfText(line?.text || ""))
    .filter(Boolean)
    .filter((text) => !normalizePdfText(text).includes("yazilimciya not"))
    .join(" ");
  return {
    developerNote,
    content: sanitizePdfText(content),
  };
}

export function buildStoryboardConfig({ document = "output_cleaned.pdf", pages = [] } = {}) {
  return {
    document,
    pages: (Array.isArray(pages) ? pages : []).map((page, index) => {
      const interactionType = detectPdfInteractionType(page?.lines || []);
      const developerNote = extractDeveloperNote(page?.lines || []);
      const base = {
        pageNumber: Number(page?.pageNumber || index + 1),
        interactionType,
      };

      let details = {};
      if (interactionType === "DragDrop") details = buildDragDropPage(page);
      else if (interactionType === "TrueFalse") details = buildTrueFalsePage(page);
      else if (interactionType === "Checkbox") details = buildCheckboxPage(page);
      else if (interactionType === "Ordering") details = buildOrderingPage(page);
      else if (interactionType === "MediaSlayt") details = buildMediaPage(page);
      else details = { instruction: extractInstruction(page?.lines || []) };

      return {
        ...base,
        ...(developerNote ? { developerNote } : {}),
        ...details,
      };
    }),
  };
}
