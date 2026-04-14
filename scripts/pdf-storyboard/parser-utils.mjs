// PDF storyboard ayrıştırma yardımcıları
// Bu dosya, offline çalışan Node.js betiği için ortak analiz fonksiyonlarını içerir.

export function normalizePdfText(value = "") {
  return String(value || "")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .replace(/[_–—-]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export function sanitizePdfText(value = "") {
  return String(value || "")
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const LIST_PREFIX_RE = /^\s*(?:(?:\(?\d+\)?|\(?[a-zçğıöşü]\)?)\s*[.)\-:]|[-•●▪])\s*/iu;
const NUMBERED_RE = /^\s*\d+\s*[.)\-:]/;
const CHECKBOX_RE = /^\s*[☑☐✓✔✗✘]\s*/u;
const DOTTED_RE = /\.{5,}/g;

function stripListPrefix(value = "") {
  return sanitizePdfText(value).replace(LIST_PREFIX_RE, "").trim();
}

function stripCheckboxPrefix(value = "") {
  return sanitizePdfText(value).replace(CHECKBOX_RE, "").trim();
}

function isDecorativeHeading(value = "") {
  const text = normalizePdfText(stripListPrefix(value));
  return text.startsWith("tema ") || text === "tema" || text.startsWith("haz.");
}

function joinRowTokens(tokens = []) {
  const ordered = [...tokens].sort((a, b) => a.x - b.x);
  let output = "";
  let previous = null;

  for (const token of ordered) {
    const currentText = sanitizePdfText(token?.text || "");
    if (!currentText) continue;

    const gap = previous ? token.x - (previous.x + previous.width) : 0;
    const needsSpace = previous && gap > Math.max(2, Math.min(14, previous.height * 0.35));
    output += `${needsSpace ? " " : ""}${currentText}`;
    previous = token;
  }

  return sanitizePdfText(output);
}

// PDF içeriğinden çıkan text item'larını satır kümelerine dönüştürür.
// En önemli nokta: aynı Y eksenine yakın token'ları tek satır kabul ediyoruz.
export function buildTextRows(items = [], viewport = { width: 0, height: 0 }) {
  const spans = (Array.isArray(items) ? items : [])
    .map((item, index) => {
      const text = sanitizePdfText(item?.str || "");
      if (!text) return null;
      const transform = Array.isArray(item?.transform) ? item.transform : [1, 0, 0, 1, 0, 0];
      const x = Number(transform[4] || 0);
      const y = Number(transform[5] || 0);
      const height = Math.max(8, Math.abs(Number(transform[3] || item?.height || 12)));
      const width = Math.max(4, Number(item?.width || text.length * Math.max(5, height * 0.48)));
      const fontName = String(item?.fontName || "");
      return {
        id: `tok_${index + 1}`,
        text,
        x,
        y,
        width,
        height,
        fontName,
        isBold: /bold|black|heavy|demi/i.test(fontName),
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      const yDiff = Math.abs(right.y - left.y);
      return yDiff > 2 ? right.y - left.y : left.x - right.x;
    });

  if (!spans.length) return [];

  const avgHeight = spans.reduce((sum, span) => sum + span.height, 0) / spans.length;
  const rowTolerance = Math.max(2, Math.min(8, avgHeight * 0.45));
  const rows = [];

  for (const span of spans) {
    let row = rows.find((candidate) => Math.abs(candidate.y - span.y) <= rowTolerance);
    if (!row) {
      row = { y: span.y, tokens: [] };
      rows.push(row);
    }
    row.tokens.push(span);
    row.y = (row.y + span.y) / 2;
  }

  return rows
    .map((row, index) => {
      const tokens = row.tokens.sort((a, b) => a.x - b.x);
      const x = Math.min(...tokens.map((token) => token.x));
      const right = Math.max(...tokens.map((token) => token.x + token.width));
      const height = Math.max(...tokens.map((token) => token.height));
      return {
        id: `row_${index + 1}`,
        x,
        y: row.y,
        width: Math.max(0, right - x),
        height,
        tokens,
        text: joinRowTokens(tokens),
        isBold: tokens.some((token) => token.isBold),
        pageWidth: Number(viewport?.width || 0),
        pageHeight: Number(viewport?.height || 0),
      };
    })
    .sort((left, right) => right.y - left.y);
}

function toRows(rowsOrLines = []) {
  return (Array.isArray(rowsOrLines) ? rowsOrLines : []).map((entry, index) => ({
    id: entry?.id || `row_${index + 1}`,
    x: Number(entry?.x || 0),
    y: Number(entry?.y || 0),
    width: Number(entry?.width || 0),
    height: Number(entry?.height || 18),
    tokens: Array.isArray(entry?.tokens) ? entry.tokens : [{ text: sanitizePdfText(entry?.text || ""), x: Number(entry?.x || 0), width: Number(entry?.width || 0), height: Number(entry?.height || 18) }],
    text: sanitizePdfText(entry?.text || ""),
    isBold: !!entry?.isBold,
  })).filter((row) => row.text);
}

function isInstructionText(value = "") {
  const text = normalizePdfText(value);
  return /(surukleyiniz|eslestiriniz|isaretleyiniz|siralayiniz|numaralandiriniz|dogru ise|yanlis ise|uygun kavramlari)/.test(text);
}

export function detectInteractionType(rowsOrLines = []) {
  const rows = toRows(rowsOrLines);
  const text = normalizePdfText(rows.map((row) => row.text).join(" "));

  if ((text.includes("yargilar") || text.includes("yargilarla")) && /\bd\b/.test(text) && /\by\b/.test(text)) return "TrueFalse";
  if (text.includes("suruklenebilir ogeler") || text.includes("surukleyiniz") || text.includes("eslestiriniz")) return "DragDrop";
  if (text.includes("siralayiniz") || text.includes("numaralandiriniz")) return "Ordering";
  if (((text.includes("kutucugu") || text.includes("kutucuklarini")) && text.includes("isaretleyiniz")) || /[☑☐]/u.test(rows.map((row) => row.text).join(" "))) return "Checkbox";
  if (text.includes("yazilimciya not") || text.includes("video slayt") || text.includes("sesli slayt")) return "MediaSlayt";
  return "Content";
}

export function extractDeveloperNote(rowsOrLines = []) {
  const rows = toRows(rowsOrLines);
  const startIndex = rows.findIndex((row) => normalizePdfText(row.text).includes("yazilimciya not"));
  if (startIndex === -1) return "";

  const collected = [];
  for (let index = startIndex; index < rows.length; index += 1) {
    const rowText = sanitizePdfText(rows[index].text);
    const normalized = normalizePdfText(rowText);
    if (!rowText) {
      if (collected.length) break;
      continue;
    }
    if (index > startIndex && (isInstructionText(rowText) || normalized.includes("suruklenebilir ogeler") || normalized.includes("dogru eslestirme") || normalized.includes("yargilar"))) {
      break;
    }
    collected.push(rowText.replace(/yazilimciya\s+not\s*:?/iu, "").trim());
  }

  return sanitizePdfText(collected.filter(Boolean).join(" "));
}

export function extractInstruction(rowsOrLines = []) {
  const rows = toRows(rowsOrLines);
  const direct = rows.find((row) => isInstructionText(row.text));
  if (direct) return direct.text;

  const fallback = rows
    .map((row) => row.text)
    .find((text) => text.length > 24 && !normalizePdfText(text).includes("yazilimciya not"));

  return fallback || "";
}

function detectTrueFalseColumns(rows = []) {
  const headerRow = rows.find((row) => {
    const normalized = normalizePdfText(row.text);
    return normalized.includes("yargilar") && /\bd\b/.test(normalized) && /\by\b/.test(normalized);
  }) || rows.find((row) => {
    const normalized = normalizePdfText(row.text);
    return normalized.includes("dogru") && normalized.includes("yanlis");
  });

  if (!headerRow) return null;

  const dToken = headerRow.tokens.find((token) => normalizePdfText(token.text) === "d");
  const yToken = headerRow.tokens.find((token) => normalizePdfText(token.text) === "y");
  if (!dToken || !yToken) return null;

  return {
    headerY: headerRow.y,
    dCenter: dToken.x + (dToken.width / 2),
    yCenter: yToken.x + (yToken.width / 2),
    statementLimitX: Math.min(dToken.x, yToken.x) - 8,
  };
}

export function extractTrueFalseItems(rowsOrLines = []) {
  const rows = toRows(rowsOrLines);
  const columns = detectTrueFalseColumns(rows);
  const items = [];
  let pending = null;

  rows.forEach((row) => {
    const raw = sanitizePdfText(row.text);
    const normalized = normalizePdfText(raw);
    if (!raw || normalized === "yargilar d y") return;

    if (NUMBERED_RE.test(raw)) {
      const statement = stripListPrefix(raw.replace(/\b([dDyY])\b\s*$/u, ""));
      const answerFromLine = raw.match(/\b([dDyY])\b\s*$/u)?.[1]?.toUpperCase() || null;

      if (isDecorativeHeading(statement)) {
        return;
      }

      if (columns) {
        const markToken = row.tokens.find((token) => {
          const tokenText = normalizePdfText(token.text);
          const centerX = token.x + (token.width / 2);
          const closeToD = Math.abs(centerX - columns.dCenter) <= 24;
          const closeToY = Math.abs(centerX - columns.yCenter) <= 24;
          return closeToD || closeToY || tokenText === "d" || tokenText === "y";
        });

        const answerFromColumns = markToken
          ? (Math.abs((markToken.x + (markToken.width / 2)) - columns.dCenter) <= Math.abs((markToken.x + (markToken.width / 2)) - columns.yCenter) ? "D" : "Y")
          : null;

        items.push({
          id: `item_${items.length + 1}`,
          statement,
          correctAnswer: answerFromColumns || answerFromLine,
        });
        pending = items[items.length - 1];
        return;
      }

      pending = {
        id: `item_${items.length + 1}`,
        statement,
        correctAnswer: answerFromLine,
      };
      items.push(pending);
      return;
    }

    if ((normalized === "d" || normalized === "y") && pending && !pending.correctAnswer) {
      pending.correctAnswer = normalized.toUpperCase();
    }
  });

  return items.filter((item) => item.statement);
}

export function extractCheckboxItems(rowsOrLines = []) {
  return toRows(rowsOrLines)
    .filter((row) => CHECKBOX_RE.test(row.text))
    .map((row, index) => ({
      id: `item_${index + 1}`,
      text: stripCheckboxPrefix(row.text),
      correctAnswer: !/^\s*☐/u.test(row.text),
    }));
}

export function extractOrderingItems(rowsOrLines = []) {
  return toRows(rowsOrLines)
    .filter((row) => NUMBERED_RE.test(row.text) && !isDecorativeHeading(row.text))
    .map((row, index) => {
      const order = Number((row.text.match(/^\s*(\d+)/) || [])[1] || index + 1);
      return {
        id: `item_${index + 1}`,
        text: stripListPrefix(row.text),
        correctOrder: order,
      };
    });
}

export function extractDragDropTerms(rowsOrLines = []) {
  const rows = toRows(rowsOrLines);
  const startIndex = rows.findIndex((row) => normalizePdfText(row.text).includes("suruklenebilir ogeler"));
  if (startIndex === -1) return [];

  const terms = [];
  for (let index = startIndex + 1; index < rows.length; index += 1) {
    const row = rows[index];
    const raw = sanitizePdfText(row.text);
    const normalized = normalizePdfText(raw);
    if (!raw) continue;
    if (normalized.includes("dogru eslestirme")) break;

    const tokenTerms = (row.tokens || [])
      .map((token) => stripListPrefix(token.text || ""))
      .filter((value) => value && value.length <= 40 && value.split(/\s+/).length <= 3);

    if (tokenTerms.length >= 2) {
      terms.push(...tokenTerms);
      continue;
    }

    if (raw.length <= 80 && !/[.!?]$/.test(raw)) terms.push(stripListPrefix(raw));
  }

  return [...new Set(terms.filter(Boolean))];
}

export function extractAnswerTerms(rowsOrLines = []) {
  const rows = toRows(rowsOrLines);
  const startIndex = rows.findIndex((row) => normalizePdfText(row.text).includes("dogru eslestirme"));
  if (startIndex === -1) return [];

  const combined = rows
    .slice(startIndex)
    .map((row) => row.text)
    .join(" ")
    .replace(/doğru\s+eşleştirme\s*:?/iu, "")
    .replace(/dogru\s+eslestirme\s*:?/iu, "")
    .trim();

  return combined
    .split(/\s*(?=(?:\d+|[a-zçğıöşü])\s*[.)\-])/iu)
    .map((part) => stripListPrefix(part).replace(/[.;,]+$/g, "").trim())
    .filter((value) => value && !normalizePdfText(value).includes("dogru eslestirme"));
}

export function findDottedBlankSegments(rowsOrLines = []) {
  const rows = toRows(rowsOrLines);
  const segments = [];

  rows.forEach((row, rowIndex) => {
    const text = row.text || "";
    if (!DOTTED_RE.test(text)) return;
    DOTTED_RE.lastIndex = 0;

    const charWidth = text.length ? Math.max(5, row.width / text.length) : 8;
    let match = DOTTED_RE.exec(text);
    while (match) {
      segments.push({
        id: `mask_${rowIndex + 1}_${segments.length + 1}`,
        pageRowId: row.id,
        x: row.x + (match.index * charWidth),
        y: row.y,
        width: Math.max(28, String(match[0] || "").length * charWidth),
        height: Math.max(12, row.height),
        text,
      });
      match = DOTTED_RE.exec(text);
    }

    DOTTED_RE.lastIndex = 0;
  });

  return segments;
}

function stripTrailingDots(value = "") {
  return sanitizePdfText(value).replace(/\.{3,}/g, "").trim();
}

export function buildStoryboardPage(page = {}) {
  const rows = toRows(page.rows || page.lines || []);
  const interactionType = detectInteractionType(rows);
  const developerNote = extractDeveloperNote(rows);
  const base = {
    pageNumber: Number(page.pageNumber || 1),
    interactionType,
    ...(developerNote ? { developerNote } : {}),
  };

  if (interactionType === "TrueFalse") {
    return {
      ...base,
      instruction: extractInstruction(rows),
      items: extractTrueFalseItems(rows),
    };
  }

  if (interactionType === "Checkbox") {
    return {
      ...base,
      instruction: extractInstruction(rows),
      items: extractCheckboxItems(rows),
    };
  }

  if (interactionType === "Ordering") {
    return {
      ...base,
      instruction: extractInstruction(rows),
      items: extractOrderingItems(rows),
    };
  }

  if (interactionType === "DragDrop") {
    const draggableItems = extractDragDropTerms(rows);
    const answers = extractAnswerTerms(rows);
    const dropLines = rows.filter((row) => NUMBERED_RE.test(row.text) && !isDecorativeHeading(row.text));
    const dottedLines = findDottedBlankSegments(rows);
    const source = dropLines.length ? dropLines : dottedLines;

    return {
      ...base,
      instruction: extractInstruction(rows),
      dropZones: source.map((entry, index) => ({
        id: `zone_${index + 1}`,
        statement: stripTrailingDots(stripListPrefix(entry.text || "")),
        correctAnswer: answers[index] || null,
      })).filter((item) => item.statement),
      draggableItems,
    };
  }

  if (interactionType === "MediaSlayt") {
    return {
      ...base,
      content: rows
        .map((row) => row.text)
        .filter(Boolean)
        .filter((text) => !normalizePdfText(text).includes("yazilimciya not"))
        .join(" "),
    };
  }

  return {
    ...base,
    instruction: extractInstruction(rows),
    content: rows.map((row) => row.text).join(" "),
  };
}

export function buildStoryboardConfig({ document = "output_cleaned.pdf", pages = [] } = {}) {
  return {
    document,
    pages: (Array.isArray(pages) ? pages : []).map((page) => buildStoryboardPage(page)),
  };
}
