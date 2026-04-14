import { useState, useRef, useEffect, useCallback, useMemo, forwardRef, useImperativeHandle, useDeferredValue } from "react";
import { normalizePdfText, sanitizePdfText, detectPdfDraftKind, extractPdfDragTerms, extractPdfAnswerTerms, extractPdfQuestionAnchors, buildStoryboardConfig } from "./pdfParser";

// ─── Sabitler ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = "e-icerik-v4";
const API_PORT = Number(process.env.REACT_APP_API_PORT || 4001);

function getApiBase() {
  if (typeof window === "undefined") return `http://localhost:${API_PORT}/api`;
  const isLocalHost =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";
  if (isLocalHost && window.location.port !== String(API_PORT)) {
    return `http://localhost:${API_PORT}/api`;
  }
  const { origin, pathname } = window.location;
  const trimmedPath = pathname.replace(/\/+$/, "");
  const lastSegment = trimmedPath.split("/").pop() || "";
  const hasFileExtension = lastSegment.includes(".");
  let basePath = "";
  if (trimmedPath && trimmedPath !== "/") {
    basePath = hasFileExtension
      ? trimmedPath.slice(0, trimmedPath.lastIndexOf("/"))
      : trimmedPath;
  }
  return `${origin}${basePath}/api`;
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${getApiBase()}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!response.ok) {
    let message = `API ${response.status}`;
    try { const data = await response.json(); if (data?.error) message = data.error; } catch {}
    throw new Error(message);
  }
  return response.json();
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Dosya okunamadi."));
    reader.readAsDataURL(file);
  });
}

async function uploadMediaFile(file) {
  if (!file) return "";
  try {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(`${getApiBase()}/upload`, {
      method: "POST",
      body: formData,
    });
    if (!response.ok) throw new Error(`Upload ${response.status}`);
    const data = await response.json();
    if (data?.ok && data?.url) return data.url;
    throw new Error(data?.error || "Upload basarisiz");
  } catch {
    return fileToDataUrl(file);
  }
}

function buildCanvasPreviewDataUrl(canvas, maxSide = 1280, quality = 0.82) {
  if (!canvas?.width || !canvas?.height) return "";
  const scale = Math.min(1, maxSide / Math.max(canvas.width, canvas.height));
  if (scale >= 0.999) {
    return canvas.toDataURL("image/jpeg", quality);
  }
  const previewCanvas = document.createElement("canvas");
  previewCanvas.width = Math.max(1, Math.round(canvas.width * scale));
  previewCanvas.height = Math.max(1, Math.round(canvas.height * scale));
  const previewContext = previewCanvas.getContext("2d", { alpha: false });
  if (!previewContext) {
    return canvas.toDataURL("image/jpeg", quality);
  }
  previewContext.fillStyle = "#ffffff";
  previewContext.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
  previewContext.drawImage(canvas, 0, 0, previewCanvas.width, previewCanvas.height);
  return previewCanvas.toDataURL("image/jpeg", quality);
}

function normalizePdfHintRect(rect, maxWidth = 1920, maxHeight = 1080, minSize = 18) {
  if (!rect || typeof rect !== "object") return null;
  const width = clamp(Number(rect.width || 0), minSize, maxWidth);
  const height = clamp(Number(rect.height || 0), minSize, maxHeight);
  const x = clamp(Number(rect.x || 0), 0, Math.max(0, maxWidth - width));
  const y = clamp(Number(rect.y || 0), 0, Math.max(0, maxHeight - height));
  return { x, y, width, height };
}

function mergePdfTermLists(...lists) {
  return [...new Set(lists.flatMap((list) => (Array.isArray(list) ? list : [])).map((item) => sanitizePdfText(item)).filter(Boolean))];
}

function mapStoryboardInteractionTypeToDraftKind(interactionType = "") {
  if (interactionType === "DragDrop") return "drag-drop";
  if (interactionType === "TrueFalse" || interactionType === "Checkbox") return "selection";
  if (interactionType === "Ordering") return "sequence";
  if (interactionType === "MediaSlayt") return "video";
  return null;
}

function pickPrimaryStoryboardInteraction(storyboardPages = []) {
  const priorities = ["DragDrop", "Ordering", "TrueFalse", "Checkbox", "MediaSlayt", "Content"];
  return priorities.find((type) => storyboardPages.some((page) => page?.interactionType === type)) || "Content";
}

function extractStoryboardTermLists(storyboardPages = []) {
  const dragTerms = [];
  const answerTerms = [];

  (Array.isArray(storyboardPages) ? storyboardPages : []).forEach((page) => {
    if (Array.isArray(page?.draggableItems)) {
      dragTerms.push(...page.draggableItems);
    }
    if (Array.isArray(page?.dropZones)) {
      answerTerms.push(...page.dropZones.map((zone) => zone?.correctAnswer || "").filter(Boolean));
    }
    if (page?.interactionType === "Ordering" && Array.isArray(page?.items)) {
      const orderedTexts = [...page.items]
        .sort((a, b) => Number(a?.correctOrder || 0) - Number(b?.correctOrder || 0))
        .map((item) => sanitizePdfText(item?.text || ""))
        .filter(Boolean);
      dragTerms.push(...orderedTexts);
      answerTerms.push(...orderedTexts);
    }
  });

  return {
    draggableTerms: mergePdfTermLists(dragTerms),
    answerTerms: mergePdfTermLists(answerTerms),
  };
}

function buildPdfSelectionBlueprint(storyboardPages = []) {
  for (const page of Array.isArray(storyboardPages) ? storyboardPages : []) {
    if (page?.interactionType === "TrueFalse" && Array.isArray(page?.items) && page.items.length) {
      const mcOptions = page.items
        .map((item) => ({
          id: uid(),
          label: sanitizePdfText(item?.statement || ""),
          isCorrect: String(item?.correctAnswer || "").toUpperCase() === "D",
        }))
        .filter((item) => item.label);
      if (mcOptions.length) {
        return {
          mcMode: "multi",
          mcQuestion: sanitizePdfText(page?.instruction || "Asagidaki ifadelerden dogru olanlari isaretleyiniz."),
          mcOptions,
        };
      }
    }

    if (page?.interactionType === "Checkbox" && Array.isArray(page?.items) && page.items.length) {
      const mcOptions = page.items
        .map((item) => ({
          id: uid(),
          label: sanitizePdfText(item?.text || ""),
          isCorrect: !!item?.correctAnswer,
        }))
        .filter((item) => item.label);
      if (mcOptions.length) {
        return {
          mcMode: "multi",
          mcQuestion: sanitizePdfText(page?.instruction || "Uygun kutucuklari isaretleyiniz."),
          mcOptions,
        };
      }
    }
  }

  return null;
}

function countStoryboardExtractedItems(storyboardPages = []) {
  return (Array.isArray(storyboardPages) ? storyboardPages : []).reduce((total, page) => {
    if (Array.isArray(page?.items)) return total + page.items.length;
    if (Array.isArray(page?.dropZones)) return total + page.dropZones.length;
    return total;
  }, 0);
}

function createPdfStatusEntry(message = "", tone = "info") {
  const safeMessage = sanitizePdfText(message);
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    message: safeMessage,
    tone,
    time: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
  };
}

function appendPdfImportLog(logs = [], entry = null) {
  if (!Array.isArray(logs) || !entry?.message) return logs;
  const previous = logs[logs.length - 1];
  if (previous?.message === entry.message && previous?.tone === entry.tone) {
    return logs;
  }
  logs.push(entry);
  return logs;
}

function getPdfLogPalette(tone = "info") {
  if (tone === "error") return { bg: "rgba(127,29,29,.28)", border: "rgba(248,113,113,.35)", text: "#fecaca" };
  if (tone === "warn") return { bg: "rgba(120,53,15,.28)", border: "rgba(251,191,36,.35)", text: "#fde68a" };
  if (tone === "success") return { bg: "rgba(20,83,45,.28)", border: "rgba(74,222,128,.35)", text: "#bbf7d0" };
  return { bg: "rgba(30,41,59,.55)", border: "rgba(148,163,184,.22)", text: "#e2e8f0" };
}

function PdfImportLogPanel({ importItem }) {
  if (!importItem) return null;
  const logs = Array.isArray(importItem.logs) ? importItem.logs : [];
  const storyboardPages = Array.isArray(importItem?.storyboardConfig?.pages) ? importItem.storyboardConfig.pages : [];
  const interactionCounts = storyboardPages.reduce((acc, page) => {
    const key = page?.interactionType || "Content";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const interactionSummary = Object.entries(interactionCounts)
    .map(([label, count]) => `${label}: ${count}`)
    .join(" · ");
  const extractedItemCount = (Array.isArray(importItem.items) ? importItem.items : []).reduce((total, item) => total + Number(item?.extractedItemCount || 0), 0);

  return (
    <details style={{ marginTop: 10, border: "1px dashed #cbd5e1", borderRadius: 14, background: "#f8fafc" }}>
      <summary style={{ cursor: "pointer", listStyle: "none", padding: "10px 12px", fontSize: 11, fontWeight: 800, color: "#0f172a", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span>PDF Log Kaydi</span>
        <span style={{ fontSize: 10, color: "#64748b" }}>{logs.length} kayit</span>
      </summary>
      <div style={{ padding: "0 12px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <span style={{ padding: "4px 8px", borderRadius: 999, background: "#e2e8f0", color: "#0f172a", fontSize: 10, fontWeight: 700 }}>{importItem.pageCount || storyboardPages.length || 0} sayfa</span>
          {interactionSummary ? <span style={{ padding: "4px 8px", borderRadius: 999, background: "#dbeafe", color: "#1d4ed8", fontSize: 10, fontWeight: 700 }}>{interactionSummary}</span> : null}
          {extractedItemCount ? <span style={{ padding: "4px 8px", borderRadius: 999, background: "#dcfce7", color: "#166534", fontSize: 10, fontWeight: 700 }}>{extractedItemCount} oge cikarildi</span> : null}
        </div>
        {logs.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 220, overflowY: "auto", paddingRight: 4 }}>
            {logs.map((entry) => {
              const palette = getPdfLogPalette(entry?.tone || "info");
              return (
                <div key={entry.id} style={{ borderRadius: 12, border: `1px solid ${palette.border}`, background: palette.bg, padding: "8px 10px" }}>
                  <div style={{ fontSize: 11, color: palette.text, fontWeight: 700 }}>{entry.message}</div>
                  <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4 }}>{entry.time}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ fontSize: 11, color: "#64748b" }}>Bu import icin kayit bulunmuyor.</div>
        )}
      </div>
    </details>
  );
}

function PdfImportStatusModal({ open, busy, message, error, logs = [], onClose }) {
  if (!open) return null;
  const statusText = error ? "Hata" : busy ? "Islem devam ediyor" : "Islem tamamladi";
  const statusColor = error ? "#fecaca" : busy ? "#c7d2fe" : "#bbf7d0";
  const statusInk = error ? "#b91c1c" : busy ? "#4338ca" : "#166534";
  return (
    <Modal title="PDF Islem Durumu" onClose={busy ? (() => {}) : onClose} width={560}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 12px", borderRadius: 12, background: "#0f172a", border: "1px solid #334155" }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#e2e8f0" }}>{message || (busy ? "PDF analiz ediliyor..." : "Son durum hazir.")}</div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>PDF tamamen cevrimdisi analiz edilir.</div>
          </div>
          <div style={{ whiteSpace: "nowrap", padding: "6px 10px", borderRadius: 999, background: statusColor, color: statusInk, fontSize: 11, fontWeight: 800 }}>{statusText}</div>
        </div>
        {error ? <div style={{ fontSize: 12, color: "#fecaca", background: "rgba(127,29,29,.35)", border: "1px solid rgba(248,113,113,.35)", borderRadius: 12, padding: "10px 12px" }}>{error}</div> : null}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 260, overflowY: "auto", paddingRight: 4 }}>
          {(logs.length ? logs : [createPdfStatusEntry(message || "Hazirlaniyor...", busy ? "info" : "success")]).map((entry) => {
            const palette = entry.tone === "error"
              ? { bg: "rgba(127,29,29,.28)", border: "rgba(248,113,113,.35)", text: "#fecaca" }
              : entry.tone === "warn"
                ? { bg: "rgba(120,53,15,.28)", border: "rgba(251,191,36,.35)", text: "#fde68a" }
                : entry.tone === "success"
                  ? { bg: "rgba(20,83,45,.28)", border: "rgba(74,222,128,.35)", text: "#bbf7d0" }
                  : { bg: "rgba(30,41,59,.55)", border: "rgba(148,163,184,.22)", text: "#e2e8f0" };
            return (
              <div key={entry.id} style={{ borderRadius: 12, border: `1px solid ${palette.border}`, background: palette.bg, padding: "9px 10px" }}>
                <div style={{ fontSize: 12, color: palette.text, fontWeight: 700 }}>{entry.message}</div>
                <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4 }}>{entry.time}</div>
              </div>
            );
          })}
        </div>
        {!busy ? (
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Btn onClick={onClose} color="#7C4DFF">Kapat</Btn>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

let pdfJsLoaderPromise = null;

async function ensurePdfJsLib() {
  if (typeof window === "undefined") {
    throw new Error("PDF analizi sadece tarayicida calisir.");
  }
  if (!pdfJsLoaderPromise) {
    pdfJsLoaderPromise = import("pdfjs-dist/legacy/build/pdf")
      .then((module) => module?.default || module)
      .then((lib) => {
        if (!lib?.getDocument) {
          throw new Error("PDF kutuphanesi hazir degil.");
        }
        if (lib.GlobalWorkerOptions) {
          lib.GlobalWorkerOptions.workerSrc = (process.env.PUBLIC_URL || "") + "/pdf.worker.min.mjs";
        }
        return lib;
      });
  }
  return pdfJsLoaderPromise;
}

function splitPdfLineSegments(segments = []) {
  const ordered = [...segments].sort((a, b) => a.x - b.x);
  if (!ordered.length) return [];

  const groups = [];
  let currentGroup = [];

  ordered.forEach((segment, index) => {
    if (!currentGroup.length) {
      currentGroup.push(segment);
      return;
    }

    const previous = currentGroup[currentGroup.length - 1];
    const gap = segment.x - (previous.x + previous.width);
    const currentText = currentGroup.map((item) => item.text).join(" ").trim();
    const remainingText = ordered.slice(index).map((item) => item.text).join(" ").trim();
    const shouldSplit = gap > Math.max(120, Math.min(280, (previous.height || 20) * 8))
      && currentText.length >= 10
      && remainingText.length >= 10;

    if (shouldSplit) {
      groups.push(currentGroup);
      currentGroup = [segment];
      return;
    }

    currentGroup.push(segment);
  });

  if (currentGroup.length) groups.push(currentGroup);
  return groups;
}

function buildPdfTextLines(items = []) {
  const buckets = new Map();
  items.forEach((item) => {
    const text = sanitizePdfText(item?.str || "");
    if (!text) return;
    const transform = item?.transform || [];
    const x = Number(transform[4] || 0);
    const y = Number(transform[5] || 0);
    const height = Math.abs(Number(transform[3] || item?.height || 12));
    const key = Math.round(y / 4) * 4;
    if (!buckets.has(key)) {
      buckets.set(key, { y, height, segments: [] });
    }
    buckets.get(key).segments.push({ text, x, width: Number(item?.width || 0) });
  });

  return [...buckets.values()]
    .flatMap((row) => {
      const segments = row.segments.sort((a, b) => a.x - b.x);
      return splitPdfLineSegments(segments).map((group) => {
        let lineText = "";
        let cursor = null;
        let maxWidth = 0;
        group.forEach((segment, index) => {
          const gap = cursor == null ? 0 : segment.x - cursor;
          const needsSpace = index > 0 && gap > 2;
          lineText += `${needsSpace ? " " : ""}${segment.text}`;
          cursor = segment.x + segment.width;
          maxWidth = Math.max(maxWidth, cursor);
        });
        const minX = Math.min(...group.map((segment) => segment.x));
        return {
          text: sanitizePdfText(lineText),
          x: minX,
          y: row.y,
          height: row.height,
          width: Math.max(0, maxWidth - minX),
          tokens: group.map((segment) => ({
            text: segment.text,
            x: segment.x,
            width: segment.width,
            height: row.height,
          })),
        };
      });
    })
    .filter((line) => line.text)
    .sort((a, b) => a.y - b.y || a.x - b.x);
}

function detectPdfMarker(lines = []) {
  const candidates = lines.slice(0, 8).map((line) => normalizePdfText(line.text));
  for (const line of candidates) {
    const eIcerikMatch = line.match(/(^|\b)(\d+)\s*[.)-]?\s*(e\s*-?\s*icerik|icerik|etkinlik)\b/);
    if (eIcerikMatch) {
      const order = Number(eIcerikMatch[2]) || 0;
      return {
        key: `${order}-etkinlik`,
        label: `${order}. Etkinlik`,
        index: order,
        kindHint: "activity",
      };
    }
    const videoMatch = line.match(/(^|\b)(\d+)\s*[.)-]?\s*video\b/);
    if (videoMatch) {
      const order = Number(videoMatch[2]) || 0;
      return {
        key: `${order}-video`,
        label: `${order}. Video`,
        index: order,
        kindHint: "video",
      };
    }
  }
  return null;
}

function buildFallbackPdfGroups(pages = []) {
  const groups = [];
  let currentGroup = null;

  pages.forEach((page, index) => {
    const pageKind = detectPdfDraftKind(page.lines || [], 1, page.marker || null);
    const readingLike = pageKind === "reading" || pageKind === "unknown";
    const shouldStartNewGroup = (() => {
      if (!currentGroup) return true;
      const currentReadingOnly = currentGroup.pageKinds.every(kind => kind === "reading" || kind === "unknown");
      if (currentReadingOnly && readingLike) return false;
      if (currentReadingOnly && !readingLike && !currentGroup.hasTerminalInteractivePage) {
        currentGroup.hasTerminalInteractivePage = true;
        return false;
      }
      return true;
    })();

    if (shouldStartNewGroup) {
      currentGroup = {
        id: uid(),
        markerKey: `fallback-${index + 1}`,
        markerLabel: `Etkinlik ${groups.length + 1}`,
        markerIndex: groups.length + 1,
        pages: [],
        pageKinds: [],
        hasTerminalInteractivePage: false,
      };
      groups.push(currentGroup);
    }

    currentGroup.pages.push(page);
    currentGroup.pageKinds.push(pageKind);
  });

  return groups;
}

function inferPdfDraftTitle(lines = [], fallback = "PDF Etkinligi") {
  const ignored = ["tema", "sozun ezgisi", "dunden bugune", "kelimelerin ritmi", "e-icerik", "video"];
  const strongLine = lines.find((line) => {
    const normalized = normalizePdfText(line.text);
    if (!normalized || normalized.length < 8 || normalized.length > 160) return false;
    if (ignored.some((word) => normalized.includes(word))) return false;
    return true;
  });
  return strongLine?.text || fallback;
}

function detectPdfDraftStatus(kind = "unknown", details = {}) {
  if (kind === "drag-drop" && details.draggableTerms?.length && details.answerTerms?.length) return "ready";
  if (kind === "drag-drop" && details.draggableTerms?.length) return "review";
  if (kind === "selection") return "review";
  if (kind === "reading" || kind === "sequence" || kind === "video") return "review";
  return "blocked";
}

function inferPdfSelectionAnchors(lines = [], pageWidth = 1920, pageHeight = 1080) {
  const ignored = [
    "tema",
    "dunden bugune",
    "kutucugu",
    "isaretleyiniz",
    "e-icerik",
    "dogru eslestirme",
    "suruklenebilir",
    "yerlere uygun",
    "gunumuz turkcesiyle",
  ];
  const candidates = (lines || [])
    .map((line) => {
      const normalized = normalizePdfText(line.text);
      return { ...line, normalized };
    })
    .filter((line) => {
      if (!line.normalized || line.normalized.length < 8) return false;
      if (ignored.some((token) => line.normalized.includes(token))) return false;
      if (line.x > pageWidth * 0.16) return false;
      if (line.width < pageWidth * 0.22) return false;
      if (line.y < pageHeight * 0.22 || line.y > pageHeight * 0.88) return false;
      if (/^[dy]$/.test(line.normalized)) return false;
      return true;
    })
    .sort((a, b) => a.y - b.y);

  const anchors = [];
  candidates.forEach((line) => {
    const existing = anchors[anchors.length - 1];
    if (existing && Math.abs(existing.stageY - line.y) < Math.max(18, line.height * 0.8)) {
      existing.text = `${existing.text} ${line.text}`.trim();
      existing.width = Math.max(existing.width, (line.x + line.width) - existing.x);
      existing.height = Math.max(existing.height, line.height);
      return;
    }
    anchors.push({
      text: line.text,
      x: line.x,
      y: line.y,
      width: line.width,
      height: line.height || 28,
      stageY: line.y,
      order: anchors.length + 1,
    });
  });

  return anchors.slice(0, 16);
}

function shouldUsePdfBottomOrigin(lines = [], pageHeight = 1080) {
  if (!Array.isArray(lines) || !lines.length) return false;
  const sample = lines.find((line) => Number.isFinite(line?.y)) || lines[0];
  return Number(sample?.y || 0) > pageHeight * 0.5;
}

function getPdfStageRectForLines(lines = [], pageWidth = 1365, pageHeight = 768, paddingX = 18, paddingY = 14) {
  if (!Array.isArray(lines) || !lines.length) return null;
  const points = lines.map((line) => {
    const x = Number(line?.x || 0);
    const width = Math.max(12, Number(line?.width || 0));
    const height = Math.max(12, Number(line?.height || 0));
    const y = Math.max(0, Number(line?.y || 0));
    return { x, y, width, height };
  });
  const minX = Math.max(0, Math.min(...points.map(point => point.x)) - paddingX);
  const minY = Math.max(0, Math.min(...points.map(point => point.y)) - paddingY);
  const maxX = Math.min(pageWidth, Math.max(...points.map(point => point.x + point.width)) + paddingX);
  const maxY = Math.min(pageHeight, Math.max(...points.map(point => point.y + point.height)) + paddingY);
  return {
    x: minX,
    y: minY,
    width: Math.max(24, maxX - minX),
    height: Math.max(24, maxY - minY),
  };
}

function getPdfQuestionAnchors(page = {}) {
  const width = page.width || 1920;
  const height = page.height || 1080;
  const anchors = Array.isArray(page?.layoutHints?.questionAnchors) ? page.layoutHints.questionAnchors : [];
  return anchors
    .map((anchor, index) => ({
      text: sanitizePdfText(anchor?.text || ""),
      x: clamp(Number(anchor?.x || 0), 0, width),
      y: clamp(Number(anchor?.y || 0), 0, height),
      width: clamp(Number(anchor?.width || 0), 24, width),
      height: clamp(Number(anchor?.height || 0), 20, height),
      stageY: clamp(Number(anchor?.y || 0), 0, height),
      order: Math.max(1, Math.round(Number(anchor?.order || index + 1))),
    }))
    .sort((a, b) => a.order - b.order || a.y - b.y || a.x - b.x);
}

function getPdfDragPoolRect(page = {}) {
  const lines = Array.isArray(page.lines) ? page.lines : [];
  const width = page.width || 1920;
  const height = page.height || 1080;
  const hintRect = normalizePdfHintRect(page?.layoutHints?.dragPoolRect, width, height, 28);
  if (hintRect) {
    return { ...hintRect, headerLine: null, source: "layout" };
  }
  const headerLine = lines.find((line) => normalizePdfText(line.text).includes("suruklenebilir ogeler"));
  if (!headerLine) return null;

  const answerLine = lines.find((line) => normalizePdfText(line.text).includes("dogru eslestirme"));
  const headerY = Number(headerLine?.y || 0);
  const headerX = Number(headerLine?.x || width * 0.68);
  const answerY = answerLine ? Number(answerLine?.y || 0) : height;

  // Content lines are those below the header, in the same X-column, and above the answer section
  const contentLines = lines.filter((line) => {
    const ly = Number(line?.y || 0);
    const lx = Number(line?.x || 0);
    if (ly <= headerY + (headerLine?.height || 12)) return false;
    if (answerLine && ly >= answerY) return false;
    return lx >= headerX - width * 0.03;
  });

  const contentRect = contentLines.length
    ? getPdfStageRectForLines(contentLines, width, height, 16, 12)
    : null;
  const headerBottom = clamp(headerY + Number(headerLine?.height || 0) + 10, 0, height - 80);
  const x = clamp(Math.max(headerX - 18, width * 0.58), 0, width - 160);
  const rightEdge = clamp(
    contentRect ? (contentRect.x + contentRect.width + 18) : (width - 24),
    x + 180,
    width - 20,
  );
  const bottom = clamp(
    contentRect ? (contentRect.y + contentRect.height + 8) : (headerBottom + Math.max(160, height * 0.3)),
    headerBottom + 120,
    height - 20,
  );

  return {
    x,
    y: headerBottom,
    width: Math.max(180, rightEdge - x),
    height: Math.max(120, bottom - headerBottom),
    headerLine,
  };
}

function detectCanvasContentBounds(canvas, threshold = 244, sampleStep = 3) {
  if (!canvas?.width || !canvas?.height) return null;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  const { width, height } = canvas;
  const imageData = context.getImageData(0, 0, width, height).data;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += sampleStep) {
    for (let x = 0; x < width; x += sampleStep) {
      const index = (y * width + x) * 4;
      const r = imageData[index];
      const g = imageData[index + 1];
      const b = imageData[index + 2];
      const a = imageData[index + 3];
      if (a < 8) continue;
      if (r >= threshold && g >= threshold && b >= threshold) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < 0 || maxY < 0) return null;
  const padX = Math.max(20, Math.round(width * 0.02));
  const padY = Math.max(20, Math.round(height * 0.02));
  return {
    x: Math.max(0, minX - padX),
    y: Math.max(0, minY - padY),
    width: Math.min(width, maxX - minX + padX * 2),
    height: Math.min(height, maxY - minY + padY * 2),
  };
}

function mapPdfLinesToStage(lines = [], transform = {}) {
  const scaleX = Number(transform.scaleX || 1);
  const scaleY = Number(transform.scaleY || 1);
  const offsetX = Number(transform.offsetX || 0);
  const offsetY = Number(transform.offsetY || 0);
  return (lines || []).map((line) => ({
    ...line,
    x: offsetX + Number(line?.x || 0) * scaleX,
    y: offsetY + Number(line?.y || 0) * scaleY,
    width: Math.max(1, Number(line?.width || 0) * scaleX),
    height: Math.max(1, Number(line?.height || 0) * scaleY),
    tokens: (Array.isArray(line?.tokens) ? line.tokens : []).map((token) => ({
      ...token,
      x: offsetX + Number(token?.x || 0) * scaleX,
      width: Math.max(1, Number(token?.width || 0) * scaleX),
      height: Math.max(1, Number(token?.height || 0) * scaleY),
    })),
  }));
}

function paintPdfCleanupRect(context, rect, bgColor = null) {
  if (!context || !rect) return;
  // Use provided bgColor or default to white if not sampling
  context.fillStyle = bgColor || "#ffffff";
  context.fillRect(
    Math.max(0, rect.x),
    Math.max(0, rect.y),
    Math.max(1, rect.width),
    Math.max(1, rect.height),
  );
}

function samplePdfCanvasBackgroundColor(canvas, nearRect) {
  if (!canvas?.width || !canvas?.height || !nearRect) return "#ffffff";
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return "#ffffff";
  const sampleX = Math.max(0, Math.round(nearRect.x - 12));
  const sampleY = Math.max(0, Math.round(nearRect.y + (nearRect.height || 0) * 0.5 - 4));
  const sampleW = Math.min(8, canvas.width - sampleX);
  const sampleH = Math.min(8, canvas.height - sampleY);
  if (sampleW < 1 || sampleH < 1) return "#ffffff";
  const data = ctx.getImageData(sampleX, sampleY, sampleW, sampleH).data;
  let sumR = 0, sumG = 0, sumB = 0, count = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 20) continue;
    sumR += data[i]; sumG += data[i + 1]; sumB += data[i + 2]; count++;
  }
  if (!count) return "#ffffff";
  const r = Math.round(sumR / count), g = Math.round(sumG / count), b = Math.round(sumB / count);
  return `rgb(${r},${g},${b})`;
}

function detectPdfGreenCells(canvas, region = {}) {
  if (!canvas?.width || !canvas?.height) return [];
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];
  const cw = canvas.width, ch = canvas.height;
  const sx = Math.max(0, Math.floor(region.x ?? cw * 0.5));
  const sy = Math.max(0, Math.floor(region.y ?? 0));
  const ex = Math.min(cw, Math.ceil(sx + (region.width ?? cw * 0.5)));
  const ey = Math.min(ch, Math.ceil(sy + (region.height ?? ch)));
  const rw = ex - sx, rh = ey - sy;
  if (rw < 2 || rh < 2) return [];
  const data = ctx.getImageData(sx, sy, rw, rh).data;
  const step = 2;
  const gh = Math.ceil(rh / step);
  const gw = Math.ceil(rw / step);
  const greenGrid = new Uint8Array(gh * gw);
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      const px = gx * step, py = gy * step;
      const i = (py * rw + px) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
      if (a < 20) continue;
      if (r > 235 && g > 235 && b > 235) continue; // white
      if (r < 20 && g < 20 && b < 20) continue; // black text
      if (g > 100 && g > r + 15 && g > b - 30) {
        greenGrid[gy * gw + gx] = 1;
      }
    }
  }
  const cells = [];
  let inRun = false, runStartY = 0, runMinX = gw, runMaxX = -1;
  for (let gy = 0; gy <= gh; gy++) {
    let rowMinX = gw, rowMaxX = -1;
    if (gy < gh) {
      for (let gx = 0; gx < gw; gx++) {
        if (greenGrid[gy * gw + gx]) { rowMinX = Math.min(rowMinX, gx); rowMaxX = Math.max(rowMaxX, gx); }
      }
    }
    const hasGreen = rowMaxX >= 0;
    if (hasGreen) {
      if (!inRun) { inRun = true; runStartY = gy; runMinX = rowMinX; runMaxX = rowMaxX; }
      else { runMinX = Math.min(runMinX, rowMinX); runMaxX = Math.max(runMaxX, rowMaxX); }
    } else if (inRun) {
      const cellH = (gy - runStartY) * step;
      const cellW = (runMaxX - runMinX + 1) * step;
      if (cellH >= 6 && cellW >= 6) {
        const cx = sx + runMinX * step, cy = sy + runStartY * step;
        cells.push({ x: cx, y: cy, width: cellW, height: cellH, centerX: cx + cellW / 2, centerY: cy + cellH / 2 });
      }
      inRun = false; runMinX = gw; runMaxX = -1;
    }
  }
  return cells;
}

function detectRedAnnotationBounds(canvas, region = {}) {
  if (!canvas?.width || !canvas?.height) return null;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  const width = canvas.width;
  const height = canvas.height;
  const startX = Math.max(0, Math.floor(region.x ?? width * 0.55));
  const startY = Math.max(0, Math.floor(region.y ?? height * 0.72));
  const endX = Math.min(width, Math.ceil((region.x ?? width * 0.55) + (region.width ?? width * 0.4)));
  const endY = Math.min(height, Math.ceil((region.y ?? height * 0.72) + (region.height ?? height * 0.24)));
  const imageData = context.getImageData(startX, startY, Math.max(1, endX - startX), Math.max(1, endY - startY)).data;
  let minX = endX;
  let minY = endY;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < endY - startY; y += 2) {
    for (let x = 0; x < endX - startX; x += 2) {
      const index = (y * (endX - startX) + x) * 4;
      const r = imageData[index];
      const g = imageData[index + 1];
      const b = imageData[index + 2];
      const a = imageData[index + 3];
      if (a < 20) continue;
      if (!(r > 160 && g < 170 && b < 190 && r - g > 35)) continue;
      minX = Math.min(minX, startX + x);
      minY = Math.min(minY, startY + y);
      maxX = Math.max(maxX, startX + x);
      maxY = Math.max(maxY, startY + y);
    }
  }
  if (maxX < 0 || maxY < 0) return null;
  return {
    x: Math.max(0, minX - 18),
    y: Math.max(0, minY - 14),
    width: Math.min(width, maxX - minX + 36),
    height: Math.min(height, maxY - minY + 28),
  };
}

function estimatePdfRowHeight(anchors = [], pageHeight = 768) {
  const gaps = anchors
    .slice(1)
    .map((anchor, index) => anchor.stageY - anchors[index].stageY)
    .filter(gap => gap > 24 && gap < pageHeight * 0.25);
  if (!gaps.length) return clamp(pageHeight * 0.08, 42, 86);
  const avgGap = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
  return clamp(avgGap * 0.78, 40, 88);
}

function getMedian(values = []) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function clusterPdfColumnCenters(values = [], tolerance = 120) {
  const sorted = [...values]
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);
  if (!sorted.length) return [];

  const clusters = [[sorted[0]]];
  for (let index = 1; index < sorted.length; index += 1) {
    const value = sorted[index];
    const current = clusters[clusters.length - 1];
    const currentCenter = current.reduce((sum, item) => sum + item, 0) / current.length;
    if (Math.abs(value - currentCenter) <= tolerance) {
      current.push(value);
    } else {
      clusters.push([value]);
    }
  }

  return clusters.map((cluster) => getMedian(cluster));
}

function compactPdfColumnLabel(value = "", index = 0) {
  const text = sanitizePdfText(value);
  if (!text) return `${index + 1}`;
  const roman = text.match(/\b([ivxlcdm]+|\d+)\b/i)?.[1];
  if (roman) return roman.toUpperCase();
  if (text.length <= 14) return text;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const initials = words.slice(0, 2).map((word) => word[0]).join("");
    if (initials.length >= 2) return initials.toUpperCase();
  }
  return text.slice(0, 10).trim();
}

function inferPdfTableChoiceColumns(lines = [], centers = [], width = 1920, height = 1080) {
  if (!Array.isArray(centers) || !centers.length) return [];
  const candidateRows = (Array.isArray(lines) ? lines : [])
    .filter((line) => Number(line?.y || 0) < height * 0.45)
    .filter((line) => {
      const normalized = normalizePdfText(line?.text || "");
      return normalized
        && !normalized.includes("isaretleyiniz")
        && !normalized.includes("kutucugu")
        && !normalized.includes("kutucuklarini")
        && !normalized.includes("tema")
        && !/[✓✔☑]/.test(line?.text || "");
    });

  return centers.map((center, index) => {
    let bestToken = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    candidateRows.forEach((line) => {
      (Array.isArray(line?.tokens) ? line.tokens : []).forEach((token) => {
        const tokenText = sanitizePdfText(token?.text || "");
        if (!tokenText || /[✓✔☑]/.test(tokenText)) return;
        const tokenCenter = Number(token?.x || 0) + Math.max(8, Number(token?.width || 0)) / 2;
        const distance = Math.abs(tokenCenter - center);
        if (distance < bestDistance && distance <= 180) {
          bestDistance = distance;
          bestToken = tokenText;
        }
      });
    });

    return {
      key: `col_${index + 1}`,
      label: compactPdfColumnLabel(bestToken || "", index),
      fullLabel: sanitizePdfText(bestToken || ""),
      center,
    };
  });
}

function detectPdfSelectionLayout(page = {}) {
  const width = page.width || 1365;
  const height = page.height || 768;
  const lines = Array.isArray(page.lines) ? page.lines : [];
  const layoutAnchors = getPdfQuestionAnchors(page);
  const numberedAnchors = extractPdfQuestionAnchors(lines, height);
  const anchors = layoutAnchors.length ? layoutAnchors : (numberedAnchors.length ? numberedAnchors : inferPdfSelectionAnchors(lines, width, height));
  if (!anchors.length) return null;

  const normalizedLines = lines.map((line) => ({
    ...line,
    normalized: normalizePdfText(line.text),
  }));
  const dLine = normalizedLines.find((line) => line.normalized === "d");
  const yLine = normalizedLines.find((line) => line.normalized === "y" && (!dLine || line.x > dLine.x + 12));
  const rowHeight = estimatePdfRowHeight(anchors, height);
  const answers = {};
  const textMarkLines = normalizedLines
    .map((line) => {
      const stageY = Math.max(0, Number(line.y || 0));
      const markText = sanitizePdfText(line.text || "");
      const centerX = Number(line.x || 0) + Math.max(8, Number(line.width || 0)) / 2;
      const centerY = stageY + Math.max(12, Number(line.height || 0)) / 2;
      return { ...line, stageY, markText, centerX, centerY };
    })
    .filter((line) => !!line.markText && /[✓✔☑√]/.test(line.markText));

  // Augment with annotation/pixel-detected cells (non-text tick detection)
  const annotCells = Array.isArray(page.annotationCells) ? page.annotationCells : [];
  const annotMarkLines = annotCells.map((ann) => ({
    stageY: ann.centerY - (ann.stageH || 0) / 2,
    markText: "✓",
    centerX: ann.centerX,
    centerY: ann.centerY,
    checked: ann.checked !== false,
  }));
  const markLines = [...textMarkLines, ...annotMarkLines.filter(a => a.checked)];

  if (dLine && yLine) {
    const rawGap = Math.abs(Number(yLine.x || 0) - Number(dLine.x || 0));
    const columnWidth = clamp(rawGap * 0.82, 54, width * 0.14);
    const dLeft = clamp(Number(dLine.x || 0) - columnWidth * 0.45, 0, width - columnWidth);
    const yLeft = clamp(Number(yLine.x || 0) - columnWidth * 0.45, 0, width - columnWidth);
    const dCenter = dLeft + columnWidth / 2;
    const yCenter = yLeft + columnWidth / 2;

    anchors.forEach((anchor, index) => {
      const questionId = `pdf-q-${index + 1}`;
      const rowTop = Math.max(0, anchor.stageY - rowHeight * 0.18);
      const rowBottom = rowTop + rowHeight;
      const markLine = markLines.find((line) => line.centerY >= rowTop && line.centerY <= rowBottom);
      if (!markLine) return;
      answers[questionId] = Math.abs(markLine.centerX - dCenter) <= Math.abs(markLine.centerX - yCenter) ? "d" : "y";
    });

    return {
      mode: "binary",
      anchors,
      rowHeight,
      columnWidth,
      columns: [
        { key: "d", left: dLeft, width: columnWidth },
        { key: "y", left: yLeft, width: columnWidth },
      ],
      answers,
    };
  }

  const clusteredCenters = clusterPdfColumnCenters(
    markLines
      .filter((line) => line.centerX > width * 0.35)
      .map((line) => line.centerX),
    Math.max(72, width * 0.05),
  );
  if (clusteredCenters.length >= 2) {
    const columnDefs = inferPdfTableChoiceColumns(lines, clusteredCenters, width, height);
    const gapValues = clusteredCenters
      .slice(1)
      .map((center, index) => center - clusteredCenters[index])
      .filter((gap) => gap > 24);
    const medianGap = gapValues.length ? getMedian(gapValues) : width * 0.14;
    const columnWidth = clamp(medianGap * 0.72, 84, width * 0.18);
    const columns = columnDefs.map((column, index) => ({
      key: column.key,
      label: column.label || `${index + 1}`,
      fullLabel: column.fullLabel || column.label || `${index + 1}`,
      left: clamp(column.center - columnWidth / 2, 0, width - columnWidth),
      width: columnWidth,
      center: column.center,
    }));

    anchors.forEach((anchor, index) => {
      const questionId = `pdf-q-${index + 1}`;
      const rowTop = Math.max(0, anchor.stageY - rowHeight * 0.18);
      const rowBottom = rowTop + rowHeight;
      const rowMarks = markLines.filter((line) => line.centerY >= rowTop && line.centerY <= rowBottom);
      if (!rowMarks.length) {
        answers[questionId] = null;
        return;
      }
      const match = columns.reduce((best, column) => {
        const distance = Math.min(...rowMarks.map((line) => Math.abs(line.centerX - column.center)));
        if (!best || distance < best.distance) return { key: column.key, distance };
        return best;
      }, null);
      answers[questionId] = match?.key || null;
    });

    return {
      mode: "table-choice",
      anchors,
      rowHeight,
      columnWidth,
      columns,
      answers,
    };
  }

  const promptText = normalizePdfText(lines.slice(0, 12).map((line) => line.text).join(" "));
  const isSingleTickMode = promptText.includes("kutucugu") || promptText.includes("isaretleyiniz") || markLines.length > 0;
  if (!isSingleTickMode) return null;

  const candidateXs = markLines.filter((line) => line.centerX > width * 0.55).map((line) => line.centerX);
  const columnCenter = candidateXs.length ? getMedian(candidateXs) : width * 0.78;
  const columnWidth = clamp(width * 0.12, 78, width * 0.16);
  const tickLeft = clamp(columnCenter - columnWidth / 2, 0, width - columnWidth);

  anchors.forEach((anchor, index) => {
    const questionId = `pdf-q-${index + 1}`;
    const rowTop = Math.max(0, anchor.stageY - rowHeight * 0.18);
    const rowBottom = rowTop + rowHeight;
    const markLine = markLines.find((line) => line.centerY >= rowTop && line.centerY <= rowBottom);
    answers[questionId] = markLine ? "tick" : null;
  });

  return {
    mode: "single-check",
    anchors,
    rowHeight,
    columnWidth,
    columns: [
      { key: "tick", left: tickLeft, width: columnWidth },
    ],
    answers,
  };
}

async function renderPdfPageAsset(page, fileName, pageIndex, lines = [], onProgress = () => {}) {
  const viewport = page.getViewport({ scale: 1.4 });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const context = canvas.getContext("2d", { alpha: false });
  await page.render({ canvasContext: context, viewport }).promise;
  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = 1920;
  outputCanvas.height = 1080;
  const outputContext = outputCanvas.getContext("2d", { alpha: false });
  outputContext.fillStyle = "#ffffff";
  outputContext.fillRect(0, 0, outputCanvas.width, outputCanvas.height);

  const sourceRatio = canvas.width / canvas.height;
  const targetRatio = outputCanvas.width / outputCanvas.height;
  const drawWidth = sourceRatio > targetRatio ? outputCanvas.width : Math.round(outputCanvas.height * sourceRatio);
  const drawHeight = sourceRatio > targetRatio ? Math.round(outputCanvas.width / sourceRatio) : outputCanvas.height;
  const drawX = Math.round((outputCanvas.width - drawWidth) / 2);
  const drawY = Math.round((outputCanvas.height - drawHeight) / 2);
  outputContext.drawImage(canvas, drawX, drawY, drawWidth, drawHeight);
  const transform = {
    offsetX: drawX,
    offsetY: drawY,
    scaleX: drawWidth / Math.max(1, canvas.width),
    scaleY: drawHeight / Math.max(1, canvas.height),
  };
  const stageLines = mapPdfLinesToStage(lines, transform);
  const layoutHints = null;
  const stagePage = { 
    width: 1920, 
    height: 1080, 
    lines: stageLines,
    layoutHints,
    annotationCells: detectPdfGreenCells(canvas).map(cell => ({
      centerX: (cell.x + cell.width / 2) * transform.scaleX + transform.offsetX,
      centerY: (cell.y + cell.height / 2) * transform.scaleY + transform.offsetY,
      stageH: cell.height * transform.scaleY,
      checked: true
    }))
  };

  const markerLines = stageLines.filter((line) => {
    const normalized = normalizePdfText(line.text);
    return normalized.includes("e-icerik") || /^\d+\s*[.)-]?\s*video\b/.test(normalized);
  });
  markerLines.forEach((line) => {
    const rect = getPdfStageRectForLines([line], 1920, 1080, 28, 18);
    const bgColor = samplePdfCanvasBackgroundColor(outputCanvas, rect);
    paintPdfCleanupRect(outputContext, rect, bgColor);
  });

  const selectionLayout = detectPdfSelectionLayout(stagePage);
  if (selectionLayout) {
    const columnHeight = clamp(
      (selectionLayout.anchors[selectionLayout.anchors.length - 1]?.stageY || 0) + selectionLayout.rowHeight - Math.max(0, selectionLayout.anchors[0]?.stageY || 0) + selectionLayout.rowHeight * 0.22,
      selectionLayout.rowHeight,
      1080,
    );
    const selectionTop = clamp(
      Math.max(0, (selectionLayout.anchors[0]?.stageY || 0) - selectionLayout.rowHeight * 0.18),
      0,
      1080,
    );
    selectionLayout.columns.forEach((column) => {
      const extraWidth = selectionLayout.mode === "single-check" ? column.width * 0.45 : column.width * 0.12;
      const rect = {
        x: clamp(column.left - extraWidth * 0.35, 0, 1920),
        y: selectionTop,
        width: Math.min(1920, column.width + extraWidth),
        height: columnHeight,
      };
      const bgColor = samplePdfCanvasBackgroundColor(outputCanvas, rect);
      paintPdfCleanupRect(outputContext, rect, bgColor);
    });
  }

  const dragPoolRect = getPdfDragPoolRect(stagePage);
  if (dragPoolRect) {
    const bgColor = samplePdfCanvasBackgroundColor(outputCanvas, dragPoolRect);
    paintPdfCleanupRect(outputContext, dragPoolRect, bgColor);
  }

  const answerLine = stageLines.find((line) => normalizePdfText(line.text).includes("dogru eslestirme"));
  if (answerLine) {
    const answerY = Number(answerLine.y || 0);
    const nearbyAnswerLines = stageLines.filter((line) => {
      const ly = Number(line.y || 0);
      return ly >= answerY && ly <= answerY + 120;
    });
    const answerRect = getPdfStageRectForLines(nearbyAnswerLines.length ? nearbyAnswerLines : [answerLine], 1920, 1080, 24, 18);
    const bgColor = samplePdfCanvasBackgroundColor(outputCanvas, answerRect);
    paintPdfCleanupRect(outputContext, answerRect, bgColor);
  }

  const bottomRightRedNote = detectRedAnnotationBounds(outputCanvas, {
    x: outputCanvas.width * 0.58,
    y: outputCanvas.height * 0.72,
    width: outputCanvas.width * 0.32,
    height: outputCanvas.height * 0.22,
  });
  if (bottomRightRedNote) {
    const bgColor = samplePdfCanvasBackgroundColor(outputCanvas, bottomRightRedNote);
    paintPdfCleanupRect(outputContext, bottomRightRedNote, bgColor);
  }

  const bottomLeftRedNote = detectRedAnnotationBounds(outputCanvas, {
    x: outputCanvas.width * 0.02,
    y: outputCanvas.height * 0.74,
    width: outputCanvas.width * 0.62,
    height: outputCanvas.height * 0.22,
  });
  if (bottomLeftRedNote) {
    const bgColor = samplePdfCanvasBackgroundColor(outputCanvas, bottomLeftRedNote);
    paintPdfCleanupRect(outputContext, bottomLeftRedNote, bgColor);
  }

  const blob = await new Promise((resolve) => outputCanvas.toBlob(resolve, "image/png", 0.92));
  if (!blob) throw new Error("PDF sayfasi gorsellestirilemedi.");
  const safeBase = (fileName || "pdf").replace(/\.[^.]+$/g, "").replace(/[^\w-]+/g, "-");
  const uploadFile = new File([blob], `${safeBase}-sayfa-${pageIndex + 1}.png`, { type: "image/png" });
  const url = await uploadMediaFile(uploadFile);
  return {
    url,
    width: 1920,
    height: 1080,
    transform,
    lines: stageLines,
    layoutHints,
  };
}

async function analyzePdfFile(file, onProgress = () => {}) {
  const pdfjsLib = await ensurePdfJsLib();
  const data = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const pages = [];

  for (let pageIndex = 0; pageIndex < pdf.numPages; pageIndex += 1) {
    onProgress(`PDF okunuyor: sayfa ${pageIndex + 1}/${pdf.numPages}`, "info");
    const page = await pdf.getPage(pageIndex + 1);
    const textContent = await page.getTextContent();
    const rawLines = buildPdfTextLines(textContent.items || []);
    const marker = detectPdfMarker(rawLines);
    onProgress(`Sayfa ${pageIndex + 1}: gorsel hazirlaniyor...`, "info");
    const asset = await renderPdfPageAsset(page, file.name, pageIndex, rawLines, onProgress);
    const lines = asset.lines || mapPdfLinesToStage(rawLines, asset.transform);
    pages.push({
      pageNumber: pageIndex + 1,
      lines,
      marker,
      text: lines.map((line) => line.text).join("\n"),
      imageUrl: asset.url,
      width: asset.width,
      height: asset.height,
      layoutHints: asset.layoutHints || null,
    });
  }

  const groups = [];
  let currentGroup = null;
  pages.forEach((page, index) => {
    const pageMarker = page.marker;
    const fallbackKey = `sayfa-${index + 1}`;
    if (!currentGroup) {
      currentGroup = {
        id: uid(),
        markerKey: pageMarker?.key || fallbackKey,
        markerLabel: pageMarker?.label || `Etkinlik ${index + 1}`,
        markerIndex: pageMarker?.index || (index + 1),
        pages: [],
      };
      groups.push(currentGroup);
    } else if (pageMarker && pageMarker.key !== currentGroup.markerKey) {
      currentGroup = {
        id: uid(),
        markerKey: pageMarker.key,
        markerLabel: pageMarker.label,
        markerIndex: pageMarker.index || (groups.length + 1),
        pages: [],
      };
      groups.push(currentGroup);
    }
    currentGroup.pages.push(page);
  });

  const markerCount = pages.filter(page => !!page.marker).length;
  if ((markerCount === 0 || groups.length === 1) && pages.length > 1) {
    const fallbackGroups = buildFallbackPdfGroups(pages);
    if (fallbackGroups.length > groups.length) {
      groups.length = 0;
      fallbackGroups.forEach(group => groups.push(group));
    }
  }

  onProgress("Storyboard yapisi cikariliyor...", "info");
  const storyboard = buildStoryboardConfig({ document: file.name, pages });
  const storyboardPageMap = new Map((storyboard?.pages || []).map((page) => [Number(page?.pageNumber || 0), page]));

  const items = groups.map((group, index) => {
    const allLines = group.pages.flatMap((page) => page.lines);
    const title = inferPdfDraftTitle(allLines, group.markerLabel || `PDF Etkinlik ${index + 1}`);
    const lastPage = group.pages[group.pages.length - 1] || {};
    const storyboardPages = group.pages
      .map((page) => storyboardPageMap.get(Number(page?.pageNumber || 0)))
      .filter(Boolean);
    const primaryInteractionType = pickPrimaryStoryboardInteraction(storyboardPages);
    const { draggableTerms: storyboardDragTerms, answerTerms: storyboardAnswerTerms } = extractStoryboardTermLists(storyboardPages);
    const draggableTerms = mergePdfTermLists(
      extractPdfDragTerms(lastPage?.lines || []),
      lastPage?.layoutHints?.draggableTerms || [],
      storyboardDragTerms
    );
    const answerTerms = mergePdfTermLists(
      extractPdfAnswerTerms(lastPage?.lines || []),
      lastPage?.layoutHints?.answerTerms || [],
      storyboardAnswerTerms
    );
    const layoutKind = group.pages.map((page) => page?.layoutHints?.kindHint).find((value) => value && value !== "unknown") || null;
    const detectedKind = layoutKind || detectPdfDraftKind(allLines, group.pages.length, group.pages[0]?.marker || null);
    const storyboardKind = mapStoryboardInteractionTypeToDraftKind(primaryInteractionType);
    const kind = storyboardKind || detectedKind;
    const status = detectPdfDraftStatus(kind, { draggableTerms, answerTerms });
    const instruction = sanitizePdfText(storyboardPages.map((page) => page?.instruction).find(Boolean) || "");
    const developerNote = sanitizePdfText(storyboardPages.map((page) => page?.developerNote).filter(Boolean).join(" "));
    const extractedItemCount = countStoryboardExtractedItems(storyboardPages);
    return {
      id: group.id,
      order: index + 1,
      markerKey: group.markerKey,
      markerLabel: group.markerLabel || `Etkinlik ${index + 1}`,
      name: title,
      kind,
      status,
      pageCount: group.pages.length,
      startPage: group.pages[0]?.pageNumber || 1,
      endPage: group.pages[group.pages.length - 1]?.pageNumber || 1,
      draggableTerms,
      answerTerms,
      pages: group.pages,
      prompt: instruction || allLines.slice(0, 8).map((line) => line.text).join(" "),
      interactionType: primaryInteractionType,
      instruction,
      developerNote,
      extractedItemCount,
      storyboardPages,
    };
  });

  return {
    fileName: file.name,
    pageCount: pdf.numPages,
    items,
    storyboard,
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

const BUTTON_PACKAGES = [
  { id: "pkg-1",  name: "Okyanus Neon",  icon: "💎", trigger: "Canlı",    anim: "Neon geçiş",      color: "#22d3ee", desc: "Turkuaz, beyaz ve cam hissi" },
  { id: "pkg-2",  name: "Zümrüt Soft",   icon: "🌿", trigger: "Yumuşak",  anim: "Doğal parlama",   color: "#34d399", desc: "Mint geçiş ve dengeli tonlar" },
  { id: "pkg-3",  name: "Mor Galaksi",   icon: "✨", trigger: "Vurgu",    anim: "Mor aura",        color: "#a78bfa", desc: "Mor, fuşya ve modern parıltı" },
  { id: "pkg-4",  name: "Gün Batımı",    icon: "🌅", trigger: "Sıcak",    anim: "Amber akış",      color: "#fb923c", desc: "Turuncu, altın ve sıcak geçiş" },
  { id: "pkg-5",  name: "Fuşya Pop",     icon: "💖", trigger: "Enerjik",  anim: "Canlı CTA",       color: "#f472b6", desc: "Pembe, beyaz ve güçlü odak" },
  { id: "pkg-6",  name: "Mavi Pro",      icon: "🚀", trigger: "Kurumsal", anim: "Net parlama",     color: "#60a5fa", desc: "Kurumsal mavi ve temiz çizgi" },
  { id: "pkg-7",  name: "Lime Enerji",   icon: "⚡", trigger: "Hızlı",    anim: "Enerji halkası",  color: "#a3e635", desc: "Lime, sarı ve canlı butonlar" },
  { id: "pkg-8",  name: "Kırmızı Vurgu", icon: "🎯", trigger: "Güçlü",    anim: "Keskin vurgu",    color: "#fb7185", desc: "Kırmızı, pembe ve dikkat hissi" },
  { id: "pkg-9",  name: "Gece Grafit",   icon: "🌙", trigger: "Minimal",  anim: "Koyu yüzey",      color: "#94a3b8", desc: "Antrasit, gümüş ve sade görünüm" },
  { id: "pkg-10", name: "Lavanta Dream", icon: "🪄", trigger: "Yumuşak",  anim: "Lavanta ışıltısı", color: "#c084fc", desc: "Lila, lavanta ve modern cam tema" },
];

const DEFAULT_THEME_PACKAGE_ITEMS = [
  { id: "guide", icon: "❓", label: "Tanıtım", desc: "Açılış bilgisini ve kısa yardımı gösterir." },
  { id: "start", icon: "▶", label: "Etkinliği Başlat", desc: "Karşılama adımını geçip etkinliği başlatır." },
  { id: "menu", icon: "☰", label: "Menü", desc: "Kılavuz, ses ve yeniden başlat seçeneklerini açar." },
  { id: "check", icon: "✓", label: "Kontrol Et", desc: "Cevapları seçilen tema renkleriyle kontrol eder." },
  { id: "solution", icon: "★", label: "Çözümü Göster", desc: "Doğru yerleşimi ve ipuçlarını gösterir." },
  { id: "restart", icon: "↺", label: "Yeniden Başlat", desc: "Etkinliği sıfırlar ve başa döndürür." },
];

function createDefaultThemePackageItems() {
  return DEFAULT_THEME_PACKAGE_ITEMS.map(item => ({ ...item }));
}

function resolveThemePackageItems(screen = {}) {
  const source = Array.isArray(screen?.items) ? screen.items : [];
  return DEFAULT_THEME_PACKAGE_ITEMS.map(item => {
    const override = source.find(entry => entry?.id === item.id) || {};
    return {
      ...item,
      ...override,
      icon: String(override.icon ?? item.icon),
      label: String(override.label ?? item.label),
      desc: String(override.desc ?? item.desc),
    };
  });
}

function resolvePreviewFlowTarget(preferred = "auto", allowedTargets = [], fallbackTarget = "play") {
  return allowedTargets.includes(preferred) ? preferred : fallbackTarget;
}

function resolvePreviewButtonLayoutStyle(style = {}, fallback = {}) {
  const alignMap = {
    left: "flex-start",
    center: "center",
    right: "flex-end",
    split: "space-between",
  };
  const direction = style?.buttonDirection === "column" ? "column" : "row";
  const justifyContent = alignMap[style?.buttonAlign] || fallback.justifyContent || "center";
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: direction === "column" && justifyContent === "space-between" ? "center" : justifyContent,
    flexDirection: direction,
    gap: Math.max(0, Number(style?.buttonGap ?? fallback.gap ?? 12) || 12),
    flexWrap: "wrap",
  };
}

const ACTIVITY_TYPES = [
  { id: "selection", label: "Secim Etkinligi", icon: "□" },
  { id: "drag-drop", label: "Surukle & Birak", icon: "↕" },
  { id: "hotspot",   label: "Hotspot",            icon: "⊕" },
  { id: "mixed",     label: "Karma",              icon: "⊞" },
];

const DRAG_DROP_MODES = [
  { id: "single",       label: "Tekli",         desc: "Her suruklenebilir kendi birakma alanina gider (1:1)" },
  { id: "multi-single", label: "Coklu Tekli",   desc: "Birden fazla oge ayni alana birakilabilir" },
  { id: "group",        label: "Gruplu",        desc: "Grup etiketine gore otomatik eslesir" },
  { id: "multi-group",  label: "Coklu Gruplu",  desc: "Bir alan ayni gruptaki tum ogeleri kabul eder" },
];

const DRAGGABLE_STRONG_STYLE = {
  fontSize: 13,
  color: "#eff6ff",
  background: "#1d4ed8",
  borderColor: "#1e3a8a",
  borderStyle: "solid",
  borderRadius: 10,
};

const DROPZONE_STRONG_STYLE = {
  fontSize: 13,
  color: "#fff7ed",
  background: "#ea580c",
  borderColor: "#9a3412",
  borderStyle: "solid",
  borderRadius: 10,
};

const OBJ_PRESETS = {
  text:      { w: 220, h: 60,  label: "Metin",    style: { fontSize: 16, color: "#111111", background: "transparent", borderColor: "transparent", borderStyle: "solid",  borderRadius: 4 } },
  button:    { w: 160, h: 50,  label: "Buton",    style: { fontSize: 14, color: "#ffffff", background: "#7C4DFF",     borderColor: "#5C2DFF",     borderStyle: "solid",  borderRadius: 10 } },
  shape:     { w: 220, h: 120, label: "Sekil",    style: { fontSize: 14, color: "#ffffff", background: "#0ea5e9",     borderColor: "#0284c7",     borderStyle: "solid",  borderRadius: 20 } },
  draggable: { w: 160, h: 50,  label: "Surukle",  style: DRAGGABLE_STRONG_STYLE },
  dropzone:  { w: 180, h: 70,  label: "Birak",    style: DROPZONE_STRONG_STYLE },
  hotspot:   { w: 64,  h: 64,  label: "?",        style: { fontSize: 22, color: "#ffffff", background: "#f4433666",   borderColor: "#f44336",     borderStyle: "solid",  borderRadius: 999 } },
  image:     { w: 200, h: 150, label: "",          style: { fontSize: 0,  color: "transparent", background: "#eee",   borderColor: "#ccc",         borderStyle: "solid",  borderRadius: 6 } },
  video:     { w: 320, h: 180, label: "Video",     style: { fontSize: 0,  color: "transparent", background: "#0f172a", borderColor: "#38bdf8",     borderStyle: "solid",  borderRadius: 10 } },
  audio:     { w: 320, h: 74,  label: "Ses",       style: { fontSize: 13, color: "#e0f2fe", background: "#082f49",     borderColor: "#38bdf8",     borderStyle: "solid",  borderRadius: 14 } },
};

function normalizeStyleToken(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "");
}

function upgradeDragDropStyle(type, style = {}) {
  const base = type === "draggable" ? DRAGGABLE_STRONG_STYLE : DROPZONE_STRONG_STYLE;
  const next = { ...style };
  const background = normalizeStyleToken(style.background);
  const borderColor = normalizeStyleToken(style.borderColor);
  const color = normalizeStyleToken(style.color);
  const borderStyle = normalizeStyleToken(style.borderStyle);
  const legacyBackgrounds = type === "draggable"
    ? new Set(["", "transparent", "#dbeafe", "#ffffff", "rgba(255,255,255,.14)", "rgba(255,255,255,.92)"])
    : new Set(["", "transparent", "#fed7aa", "#ffffff", "rgba(255,255,255,.92)"]);
  const legacyBorderColors = type === "draggable"
    ? new Set(["", "#2563eb", "#ec4899"])
    : new Set(["", "#f97316", "#f59e0b"]);
  const legacyTextColors = type === "draggable"
    ? new Set(["", "#1e40af", "#ec4899"])
    : new Set(["", "#9a3412", "#f59e0b"]);
  const legacyBorderStyles = new Set(["", "dashed"]);

  if (legacyBackgrounds.has(background)) next.background = base.background;
  if (legacyBorderColors.has(borderColor)) next.borderColor = base.borderColor;
  if (legacyTextColors.has(color)) next.color = base.color;
  if (legacyBorderStyles.has(borderStyle) || !style.borderStyle) next.borderStyle = base.borderStyle;
  if (!style.borderRadius || style.borderRadius < base.borderRadius) next.borderRadius = base.borderRadius;
  if (!style.fontSize) next.fontSize = base.fontSize;

  return { ...base, ...next };
}

function createDragDropDefaults() {
  return {
    draggable: {
      width: OBJ_PRESETS.draggable.w,
      height: OBJ_PRESETS.draggable.h,
      style: { ...upgradeDragDropStyle("draggable", OBJ_PRESETS.draggable.style) },
    },
    dropzone: {
      width: OBJ_PRESETS.dropzone.w,
      height: OBJ_PRESETS.dropzone.h,
      style: { ...upgradeDragDropStyle("dropzone", OBJ_PRESETS.dropzone.style) },
    },
  };
}

function getActivityDragDropDefaults(activity = {}) {
  const fallback = createDragDropDefaults();
  const source = activity?.dragDropDefaults || {};
  const objects = Array.isArray(activity?.objects) ? activity.objects : [];

  const buildEntry = (type) => {
    const base = fallback[type];
    const existing = objects.find(item => item?.type === type);
    const sourceEntry = source?.[type] || {};
    return {
      width: Math.max(20, Number(sourceEntry.width ?? existing?.width ?? base.width) || base.width),
      height: Math.max(20, Number(sourceEntry.height ?? existing?.height ?? base.height) || base.height),
      style: upgradeDragDropStyle(type, {
        ...base.style,
        ...(existing?.style || {}),
        ...(sourceEntry.style || {}),
      }),
    };
  };

  return {
    draggable: buildEntry("draggable"),
    dropzone: buildEntry("dropzone"),
  };
}

function createObjectFromActivity(activity = {}, type = "text") {
  const object = createObject(type);
  if (type !== "draggable" && type !== "dropzone") return object;
  const family = getActivityDragDropDefaults(activity)[type];
  return {
    ...object,
    width: family.width,
    height: family.height,
    style: { ...family.style },
  };
}

function updateActivityObject(activity = {}, objectId = "", patch = {}, options = {}) {
  const objects = Array.isArray(activity?.objects) ? activity.objects : [];
  const target = objects.find(item => item.id === objectId);
  if (!target) return activity;

  const shouldSyncFamily = !!options.syncDragDropFamily && (target.type === "draggable" || target.type === "dropzone");
  let nextActivity = activity;

  if (shouldSyncFamily) {
    const familyDefaults = getActivityDragDropDefaults(activity)[target.type];
    const familyPatch = {};

    if (Object.prototype.hasOwnProperty.call(patch, "width")) {
      familyPatch.width = Math.max(20, Number(patch.width) || familyDefaults.width);
    }
    if (Object.prototype.hasOwnProperty.call(patch, "height")) {
      familyPatch.height = Math.max(20, Number(patch.height) || familyDefaults.height);
    }
    if (patch.style) {
      familyPatch.style = upgradeDragDropStyle(target.type, {
        ...familyDefaults.style,
        ...patch.style,
      });
    }

    if (Object.keys(familyPatch).length) {
      const nextDefaults = {
        ...familyDefaults,
        ...familyPatch,
        style: familyPatch.style ? { ...familyPatch.style } : familyDefaults.style,
      };
      nextActivity = {
        ...activity,
        dragDropDefaults: {
          ...getActivityDragDropDefaults(activity),
          [target.type]: nextDefaults,
        },
        objects: objects.map(item => item.type === target.type ? {
          ...item,
          ...(Object.prototype.hasOwnProperty.call(familyPatch, "width") ? { width: nextDefaults.width } : {}),
          ...(Object.prototype.hasOwnProperty.call(familyPatch, "height") ? { height: nextDefaults.height } : {}),
          ...(familyPatch.style ? { style: { ...nextDefaults.style } } : {}),
        } : item),
      };
    }
  }

  const objectPatch = { ...patch };
  if (shouldSyncFamily) {
    delete objectPatch.width;
    delete objectPatch.height;
    delete objectPatch.style;
  }

  if (!Object.keys(objectPatch).length) return nextActivity;

  return {
    ...nextActivity,
    objects: (nextActivity.objects || []).map(item => item.id === objectId ? { ...item, ...objectPatch } : item),
  };
}

function getObjectSelectionBounds(items = []) {
  if (!items.length) return null;
  const left = Math.min(...items.map(item => Number(item.x) || 0));
  const top = Math.min(...items.map(item => Number(item.y) || 0));
  const right = Math.max(...items.map(item => (Number(item.x) || 0) + (Number(item.width) || 0)));
  const bottom = Math.max(...items.map(item => (Number(item.y) || 0) + (Number(item.height) || 0)));
  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
  };
}

function alignActivitySelection(activity = {}, selectedIds = new Set(), mode = "left") {
  const ids = selectedIds instanceof Set ? selectedIds : new Set(selectedIds || []);
  if (ids.size < 2) return activity;
  const objects = Array.isArray(activity.objects) ? activity.objects : [];
  const selectedObjects = objects.filter(item => ids.has(item.id));
  const bounds = getObjectSelectionBounds(selectedObjects);
  if (!bounds) return activity;

  return {
    ...activity,
    objects: objects.map(item => {
      if (!ids.has(item.id)) return item;
      if (mode === "left") return { ...item, x: bounds.left };
      if (mode === "center") return { ...item, x: bounds.left + ((bounds.width - item.width) / 2) };
      if (mode === "right") return { ...item, x: bounds.right - item.width };
      if (mode === "top") return { ...item, y: bounds.top };
      if (mode === "middle") return { ...item, y: bounds.top + ((bounds.height - item.height) / 2) };
      if (mode === "bottom") return { ...item, y: bounds.bottom - item.height };
      return item;
    }),
  };
}

function distributeActivitySelection(activity = {}, selectedIds = new Set(), axis = "horizontal") {
  const ids = selectedIds instanceof Set ? selectedIds : new Set(selectedIds || []);
  if (ids.size < 3) return activity;
  const objects = Array.isArray(activity.objects) ? activity.objects : [];
  const selectedObjects = objects.filter(item => ids.has(item.id));
  if (selectedObjects.length < 3) return activity;

  const isHorizontal = axis === "horizontal";
  const ordered = [...selectedObjects].sort((left, right) => isHorizontal
    ? (left.x - right.x) || (left.zIndex - right.zIndex)
    : (left.y - right.y) || (left.zIndex - right.zIndex));
  const start = isHorizontal ? ordered[0].x : ordered[0].y;
  const end = isHorizontal
    ? ordered[ordered.length - 1].x + ordered[ordered.length - 1].width
    : ordered[ordered.length - 1].y + ordered[ordered.length - 1].height;
  const totalSize = ordered.reduce((sum, item) => sum + (isHorizontal ? item.width : item.height), 0);
  const gap = (end - start - totalSize) / Math.max(1, ordered.length - 1);
  let cursor = start;
  const positionMap = new Map();

  ordered.forEach(item => {
    positionMap.set(item.id, cursor);
    cursor += (isHorizontal ? item.width : item.height) + gap;
  });

  return {
    ...activity,
    objects: objects.map(item => {
      if (!positionMap.has(item.id)) return item;
      return isHorizontal
        ? { ...item, x: positionMap.get(item.id) }
        : { ...item, y: positionMap.get(item.id) };
    }),
  };
}

const HANDLE_DIRS = ["nw","n","ne","e","se","s","sw","w"];
const HANDLE_POS = {
  nw: { left: -5, top: -5 },   n:  { left: "50%", top: -5, ml: -5 },   ne: { right: -5, top: -5 },
  e:  { right: -5, top: "50%", mt: -5 }, se: { right: -5, bottom: -5 }, s:  { left: "50%", bottom: -5, ml: -5 },
  sw: { left: -5, bottom: -5 }, w:  { left: -5, top: "50%", mt: -5 },
};
const HANDLE_CURSOR = { nw: "nwse-resize", n: "ns-resize", ne: "nesw-resize", e: "ew-resize", se: "nwse-resize", s: "ns-resize", sw: "nesw-resize", w: "ew-resize" };

const COLORS = ["#00BCD4","#FF5722","#4CAF50","#9C27B0","#FF9800","#2196F3","#E91E63","#8BC34A","#673AB7","#FFC107"];

const DEFAULT_ACTIVITY_SETTINGS = {
  completionMode: "required", scorePoints: 10, shuffleOptions: false,
  showFeedback: true, allowRetry: true, maxAttempts: 0,
  showMenuScreen: true, showAnswerLayer: true, answerButtonText: "Cevabi Goster",
  showButtonPackageIntro: true,
  guideButtonText: "Tanıtım",
  menuButtonText: "☰ MENÜ",
  checkButtonText: "Kontrol Et",
  solutionButtonText: "Çözümü Göster",
  restartFlowText: "Yeniden Başlat",
  completeButtonText: "Tamamla",
  homeButtonText: "Ana Sayfa",
  soundOnText: "Sesi Aç",
  soundOffText: "Sesi Kapat",
  guideButtonAction: "package",
  packageBackAction: "intro",
  menuButtonAction: "toggle-menu",
  checkButtonAction: "check",
  solutionButtonAction: "answer",
  restartButtonAction: "restart",
  completeButtonAction: "complete",
  answerButtonAction: "restart",
  homeButtonAction: "intro",
  introNextPhase: "auto",
  packageNextPhase: "auto",
  menuNextPhase: "play",
};

const DEFAULT_LMS_CONFIG = {
  packageName: "E-Icerik Paketi", packageCode: "EIC-001", version: "1.0.0",
  standard: "scorm12", trackingMode: "completion+score", passingScore: 70,
  launchMode: "new-window", resumeMode: "resume", navigationMode: "free",
  completionRule: "required-only", successRule: "passing-score", maxAttempts: 0,
  reportStatus: "passed-incomplete", playerTheme: "modern-dark",
  showMenu: true, showResources: true, showGlossary: false, showNotes: false,
  allowSearch: true, allowDownload: false,
};

const VARIABLE_TYPES = [
  { value: "text", label: "Metin" },
  { value: "number", label: "Sayi" },
  { value: "boolean", label: "Mantiksal" },
];

const TRIGGER_ACTION_OPTIONS = [
  { value: "SliderGec", label: "Slidera Gec" },
  { value: "SayfaGec", label: "Sayfaya Gec" },
  { value: "KatmanaGec", label: "Katmana Gec" },
  { value: "Goster", label: "Nesne Goster" },
  { value: "Gizle", label: "Nesne Gizle" },
  { value: "DegiskenAta", label: "Degisken Ata" },
  { value: "DegiskenArttir", label: "Degisken Arttir" },
  { value: "DegiskenAzalt", label: "Degisken Azalt" },
  { value: "NesneDurumuAyarla", label: "Nesne Durumu Ayarla" },
  { value: "SesCal", label: "Ses Cal" },
];

const TRIGGER_WHEN_OPTIONS = [
  { value: "onClick", label: "Tiklandiginda" },
  { value: "onHover", label: "Uzerine gelince" },
  { value: "onDrop", label: "Birakilinca" },
  { value: "onLoad", label: "Sahne yuklenince" },
];

const TRIGGER_OPERATOR_OPTIONS = [
  { value: "eq", label: "Esittir" },
  { value: "neq", label: "Esit degil" },
  { value: "gt", label: "Buyuktur" },
  { value: "gte", label: "Buyuk esittir" },
  { value: "lt", label: "Kucuktur" },
  { value: "lte", label: "Kucuk esittir" },
  { value: "contains", label: "Icerir" },
  { value: "truthy", label: "Dogru" },
  { value: "falsy", label: "Yanlis" },
];

const OBJECT_STATE_OPTIONS = [
  { value: "visited", label: "Visited" },
  { value: "selected", label: "Selected" },
  { value: "disabled", label: "Disabled" },
  { value: "hidden", label: "Hidden" },
];

const TIMELINE_EFFECT_OPTIONS = [
  { value: "none", label: "Yok" },
  { value: "fade", label: "Fade" },
  { value: "slide", label: "Slide" },
  { value: "scale", label: "Scale" },
];

const TIMELINE_DIRECTION_OPTIONS = [
  { value: "left", label: "Soldan" },
  { value: "right", label: "Sagdan" },
  { value: "up", label: "Yukaridan" },
  { value: "down", label: "Asagidan" },
  { value: "center", label: "Merkez" },
];

const TIMELINE_EASING_OPTIONS = [
  { value: "linear", label: "Linear" },
  { value: "easeIn", label: "Ease In" },
  { value: "easeOut", label: "Ease Out" },
  { value: "easeInOut", label: "Ease In Out" },
];

const SLIDE_TRANSITION_OPTIONS = [
  { value: "none", label: "Yok" },
  { value: "fade", label: "Fade" },
  { value: "slide", label: "Kaydir" },
];

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

function createTimelineKeyframe(time = 0, index = 0) {
  return {
    id: uid(),
    name: `Kare ${index + 1}`,
    time,
    x: 0,
    y: 0,
    scale: 1,
    opacity: 1,
  };
}

function createTimelineItem(index = 0, object = null) {
  const objectLabel = object?.label || (object?.type === "video" ? "Video" : object?.type ? `${object.type} nesnesi` : `Nesne ${index + 1}`);
  const duration = object?.type === "video" ? 8 : 4;
  return {
    id: uid(),
    objectId: object?.id || "",
    name: objectLabel,
    start: 0,
    duration,
    track: index,
    entryEffect: object?.type === "video" ? "fade" : "fade",
    exitEffect: object?.type === "video" ? "fade" : "none",
    direction: "left",
    easing: "easeOut",
    keyframes: [
      createTimelineKeyframe(0, 0),
      createTimelineKeyframe(duration, 1),
    ],
  };
}

function createTriggerItem(index = 0) {
  return {
    id: uid(),
    when: "onClick",
    target: "Secili Nesne",
    action: "SayfaGec",
    value: "__next__",
    extra: "",
    stateKey: "visited",
    stateValue: "true",
    name: `Tetik ${index + 1}`,
    conditionMode: "all",
    conditions: [],
  };
}

function createTriggerConditionItem(index = 0) {
  return {
    id: uid(),
    sourceType: "variable",
    sourceId: "",
    stateKey: "visited",
    operator: "eq",
    value: "",
    name: `Kosul ${index + 1}`,
  };
}

function getDefaultVariableValue(type = "text") {
  if (type === "number") return 0;
  if (type === "boolean") return false;
  return "";
}

function castVariableValue(type = "text", value = "") {
  if (type === "number") {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }
  if (type === "boolean") {
    if (typeof value === "boolean") return value;
    const normalized = String(value).trim().toLowerCase();
    return ["true", "1", "evet", "yes", "on"].includes(normalized);
  }
  return String(value ?? "");
}

function createVariableItem(index = 0) {
  return {
    id: uid(),
    name: `Degisken ${index + 1}`,
    type: "number",
    value: 0,
  };
}

function createLayer(name = "Katman", index = 0) {
  const isBase = index === 0;
  return {
    id: isBase ? "base" : uid(),
    name: isBase ? "Ana Katman" : `${name} ${index}`,
    kind: isBase ? "base" : "overlay",
    visible: true,
  };
}

function createObject(type = "text") {
  const preset = OBJ_PRESETS[type] || OBJ_PRESETS.text;
  return {
    id: uid(), type,
    x: 80 + Math.random() * 120, y: 80 + Math.random() * 100,
    width: preset.w, height: preset.h,
    rotation: 0, label: preset.label,
    locked: false, visible: true, zIndex: 1,
    imageData: null, mediaUrl: "", mediaName: "", group: "", layerId: "base",
    showPlayerControls: type === "video" || type === "audio",
    autoPlay: false,
    muted: type === "video",
    loop: false,
    style: { ...preset.style },
  };
}

function createActivity(name, type = "selection") {
  const firstSlide = createSlide("Slider 1", 0);
  return {
    id: uid(), name, type, notes: "",
    sceneName: firstSlide.sceneName,
    buttonPackageId: BUTTON_PACKAGES[0].id,
    stageWidth: firstSlide.stageWidth, stageHeight: firstSlide.stageHeight,
    backgroundColor: firstSlide.backgroundColor,
    svgMarkup: firstSlide.svgMarkup, svgName: firstSlide.svgName,
    layers: firstSlide.layers,
    activeLayerId: firstSlide.activeLayerId,
    nextActivityId: firstSlide.nextActivityId,
    objects: firstSlide.objects, selectedObjectId: firstSlide.selectedObjectId,
    timeline: firstSlide.timeline, triggers: firstSlide.triggers,
    slides: [firstSlide],
    currentSlideId: firstSlide.id,
    settings: { ...DEFAULT_ACTIVITY_SETTINGS },
    dragDropDefaults: createDragDropDefaults(),
    dragDropMode: "single",
    dragDropMatches: {},
    introScreen: { enabled: true, title: `${name} Etkinligine Hos Geldin`, body: "Hazir oldugunda basla ve soruyu tamamla.", buttonText: "Basla" },
    buttonPackageScreen: { enabled: true, title: "Tema Paketi Tanitimi", body: "Etkinlikte kullanacagin tema paketini ve buton davranislarini once incele.", buttonText: "Menuye Gec", backButtonText: "Geri Don", items: createDefaultThemePackageItems() },
    menuScreen: { enabled: true, title: `${name} Menusu`, body: "Kurallari gozden gecir ve etkinligi baslat.", buttonText: "Etkinlige Gec" },
    playScreen: { title: "", body: "" },
    resultScreens: { successTitle: "Harika!", successBody: "Dogru cevabi buldun.", failureTitle: "Tekrar Deneyelim", failureBody: "Dogru cevaba biraz daha yakinsin.", retryText: "Tekrar Dene", continueText: "Devam Et" },
    answerScreen: { title: "Dogru Cevap", body: "Sistem dogru cevabi otomatik olarak hazirladi.", buttonText: "Yeniden Baslat" },
    mcQuestion: "", mcMode: "single",
    mcOptions: [
      { id: uid(), label: "Seçenek 1", isCorrect: true },
      { id: uid(), label: "Seçenek 2", isCorrect: false },
    ],
  };
}

function createCanvasTextObject(label, x, y, width, height, style = {}) {
  const object = createObject("text");
  return {
    ...object,
    label,
    x,
    y,
    width,
    height,
    style: { ...object.style, ...style },
  };
}

function createCanvasButtonObject(label, x, y, width, height, style = {}) {
  const object = createObject("button");
  return {
    ...object,
    label,
    x,
    y,
    width,
    height,
    style: { ...object.style, ...style },
  };
}

function createCanvasShapeObject(label, x, y, width, height, style = {}) {
  const object = createObject("shape");
  return {
    ...object,
    label,
    x,
    y,
    width,
    height,
    style: { ...object.style, ...style },
  };
}

function createBookPreviewDocument(bookName = "Kitap", buttonPackageId = BUTTON_PACKAGES[0].id) {
  const pkg = BUTTON_PACKAGES.find(item => item.id === buttonPackageId) || BUTTON_PACKAGES[0];
  const accent = pkg?.color || "#06b6d4";
  const introSlide = createSlide("Tanitim", 0);
  introSlide.sceneName = "Önizleme Tanitim";
  introSlide.backgroundColor = "#0f3250";
  introSlide.objects = [
    createCanvasTextObject(bookName, 180, 160, 860, 84, { fontSize: 44, fontWeight: 800, color: "#ffffff" }),
    createCanvasTextObject("Bu ekran onizleme tasarimini duzenlemek icindir. Baslik, buton ve aciklama alanlarini burada yerleştirebilirsin.", 180, 258, 1040, 120, { fontSize: 22, color: "#dbeafe" }),
    createCanvasButtonObject("ETKINLIGE BASLA", 180, 420, 320, 78, { fontSize: 24, fontWeight: 800, background: accent, borderColor: accent, borderRadius: 24 }),
  ];

  const packageSlide = createSlide("Tema Paketi", 1);
  packageSlide.sceneName = "Tema Paketi";
  packageSlide.backgroundColor = "#123b5b";
  packageSlide.objects = [
    createCanvasTextObject("Tema Paketi Tanitimi", 170, 92, 920, 78, { fontSize: 38, fontWeight: 800, color: "#ffffff" }),
    createCanvasShapeObject("", 130, 238, 1480, 640, { background: "#ffffff", borderColor: "#bfdbfe", borderRadius: 38, color: "transparent" }),
    createCanvasButtonObject("KONTROL ET", 190, 330, 300, 74, { fontSize: 24, background: accent, borderColor: accent, borderRadius: 22 }),
    createCanvasButtonObject("MENU", 190, 446, 300, 74, { fontSize: 22, background: accent, borderColor: accent, borderRadius: 22 }),
    createCanvasButtonObject("ETKINLIGI BASLAT", 846, 314, 540, 98, { fontSize: 30, background: accent, borderColor: accent, borderRadius: 30 }),
    createCanvasTextObject("Kontrol sonrasi geri bildirim alanini anlatir.", 534, 326, 260, 84, { fontSize: 18, color: "#334155", background: "#f8fafc", borderColor: "#bae6fd", borderRadius: 18 }),
    createCanvasTextObject("Öğrenciyi yonlendiren aciklama kutusu.", 1420, 316, 230, 120, { fontSize: 18, color: "#334155", background: "#f8fafc", borderColor: "#bae6fd", borderRadius: 18 }),
  ];

  const menuSlide = createSlide("Menu", 2);
  menuSlide.sceneName = "Menu";
  menuSlide.backgroundColor = "#0f3250";
  menuSlide.objects = [
    createCanvasTextObject(`${bookName} Menusu`, 180, 140, 760, 80, { fontSize: 40, fontWeight: 800, color: "#ffffff" }),
    createCanvasTextObject("Kurallar, aciklama metni ve baslangic aksiyonlari bu alanda duzenlenebilir.", 180, 228, 980, 82, { fontSize: 21, color: "#dbeafe" }),
    createCanvasShapeObject("", 160, 360, 760, 360, { background: "rgba(255,255,255,.12)", borderColor: "rgba(255,255,255,.2)", borderRadius: 30, color: "transparent" }),
    createCanvasButtonObject("ETKINLIGE GEC", 210, 430, 320, 78, { fontSize: 24, background: accent, borderColor: accent, borderRadius: 22 }),
    createCanvasButtonObject("KILAVUZ", 210, 536, 240, 66, { fontSize: 20, background: "#ffffff", color: accent, borderColor: accent, borderRadius: 18 }),
  ];

  const slides = [introSlide, packageSlide, menuSlide].map((slide, index) => normalizeSlide(slide, index));
  return normalizeActivity({
    ...createActivity(`${bookName} Önizleme`, "book-preview"),
    name: `${bookName} Önizleme`,
    type: "book-preview",
    buttonPackageId,
    slides,
    currentSlideId: slides[0]?.id,
    introScreen: { enabled: true, title: `${bookName} Girisi`, body: "Önizleme giris alanini duzenle.", buttonText: "Devam Et" },
    buttonPackageScreen: { enabled: true, title: `${pkg.name} Tema Paketi`, body: "Tema paketi tanitim katmani.", buttonText: "Menuye Gec", backButtonText: "Geri Don", items: createDefaultThemePackageItems() },
    menuScreen: { enabled: true, title: `${bookName} Menusu`, body: "Kitap menu aciklamasi.", buttonText: "Etkinlige Gec" },
    playScreen: { title: "Önizleme Sahnesi", body: "Bu sahne ortak preview gorunumu icindir." },
  });
}

const SLIDE_STATE_KEYS = [
  "sceneName",
  "stageWidth",
  "stageHeight",
  "backgroundColor",
  "svgMarkup",
  "svgName",
  "layers",
  "activeLayerId",
  "nextActivityId",
  "objects",
  "selectedObjectId",
  "timeline",
  "triggers",
  "audioUrl",
  "audioName",
  "audioAutoPlay",
  "audioLoop",
  "slideTransitionEffect",
  "slideTransitionDirection",
  "slideTransitionDuration",
];

function createSlide(name = "Slider 1", index = 0) {
  return {
    id: uid(),
    name: name || `Slider ${index + 1}`,
    sceneName: `Sahne ${index + 1}`,
    stageWidth: 1920,
    stageHeight: 1080,
    backgroundColor: "#ffffff",
    svgMarkup: "",
    svgName: "",
    layers: [createLayer("Katman", 0)],
    activeLayerId: "base",
    nextActivityId: "",
    objects: [],
    selectedObjectId: null,
    timeline: [],
    triggers: [],
    audioUrl: "",
    audioName: "",
    audioAutoPlay: true,
    audioLoop: false,
    slideTransitionEffect: "fade",
    slideTransitionDirection: "left",
    slideTransitionDuration: 0.45,
  };
}

function createPdfImageObject(imageUrl, pageWidth, pageHeight, label = "PDF Zemin") {
  const object = createObject("image");
  return {
    ...object,
    x: 0,
    y: 0,
    width: pageWidth,
    height: pageHeight,
    imageData: imageUrl,
    label,
    isPdfBackground: true,
    locked: true,
    zIndex: 0,
    style: {
      ...object.style,
      background: "transparent",
      borderColor: "transparent",
    },
  };
}

function createPdfMaskObject(x, y, width, height) {
  const object = createObject("shape");
  return {
    ...object,
    x,
    y,
    width,
    height,
    label: "",
    isPdfMask: true,
    locked: true,
    zIndex: 30,
    style: {
      ...object.style,
      background: "#ffffff",
      borderColor: "#ffffff",
      borderRadius: 8,
      color: "transparent",
    },
  };
}

function createPdfDropzoneObject(text, x, y, width, height, index) {
  const object = createObject("dropzone");
  return {
    ...object,
    x,
    y,
    width,
    height,
    label: `Bosluk ${index + 1}`,
    group: text,
    locked: false,
    zIndex: 40 + index,
    style: {
      ...upgradeDragDropStyle("dropzone", object.style),
      borderRadius: 12,
    },
  };
}

function createPdfDraggableObject(text, x, y, width, height, index) {
  const object = createObject("draggable");
  return {
    ...object,
    x,
    y,
    width,
    height,
    label: text,
    group: text,
    zIndex: 60 + index,
    style: {
      ...upgradeDragDropStyle("draggable", object.style),
      borderRadius: 16,
    },
  };
}

function createPdfSelectionObject(questionId, choice, x, y, width, height, index, isCorrect = null, displayLabel = null, layoutMode = "") {
  const object = createObject("button");
  // D/Y (doğru/yanlış) mode: label shows "D" or "Y"
  // single-check mode: label shows checkbox symbol
  const isBinary = choice === "d" || choice === "y";
  const isTableChoice = layoutMode === "table-choice";
  const label = isBinary
    ? (choice === "d" ? "D" : "Y")
    : isTableChoice
      ? sanitizePdfText(displayLabel || choice || "")
      : "☐";
  const bg = isBinary
    ? (choice === "d" ? "#dcfce7" : "#fef2f2")
    : isTableChoice
      ? "#eff6ff"
      : "#f8faff";
  const border = isBinary
    ? (choice === "d" ? "#16a34a" : "#dc2626")
    : isTableChoice
      ? "#2563eb"
      : "#6366f1";
  const color = isBinary
    ? (choice === "d" ? "#15803d" : "#b91c1c")
    : isTableChoice
      ? "#1d4ed8"
      : "#4338ca";
  return {
    ...object,
    x,
    y,
    width,
    height,
    label,
    selectionQuestionId: questionId,
    selectionChoice: choice,
    selectionCorrect: typeof isCorrect === "boolean" ? isCorrect : null,
    locked: false,
    zIndex: 48 + index,
    style: {
      ...object.style,
      background: bg,
      borderColor: border,
      color,
      borderRadius: isBinary ? 6 : 4,
      fontSize: isBinary ? 14 : isTableChoice ? 12 : 22,
      fontWeight: 700,
    },
  };
}

function buildPdfDragDropMasks(page = {}) {
  const lines = Array.isArray(page.lines) ? page.lines : [];
  const width = page.width || 1365;
  const height = page.height || 768;
  const masks = [];

  const dragHeaderIndex = lines.findIndex((line) => normalizePdfText(line.text).includes("suruklenebilir ogeler"));
  if (dragHeaderIndex >= 0) {
    const stopIndex = lines.findIndex((line, index) => index > dragHeaderIndex && normalizePdfText(line.text).includes("dogru eslestirme"));
    const poolLines = lines.slice(dragHeaderIndex + 1, stopIndex >= 0 ? stopIndex : dragHeaderIndex + 8);
    const rect = getPdfStageRectForLines(poolLines, width, height, 18, 14);
    if (rect) masks.push(createPdfMaskObject(rect.x, rect.y, rect.width, rect.height));
  }

  const answerIndex = lines.findIndex((line) => normalizePdfText(line.text).includes("dogru eslestirme"));
  if (answerIndex >= 0) {
    const noteLines = lines.slice(answerIndex, Math.min(lines.length, answerIndex + 4));
    const rect = getPdfStageRectForLines(noteLines, width, height, 24, 18);
    if (rect) masks.push(createPdfMaskObject(rect.x, rect.y, rect.width, rect.height));
  }

  return masks;
}

function buildPdfSelectionObjects(draft, page) {
  const layout = detectPdfSelectionLayout(page);
  if (!layout) return { objects: [], slots: [], masks: [], layout: null };

  const objects = [];
  const slots = [];
  const masks = [];
  const width = page.width || 1920;
  const height = page.height || 1080;

  // White mask covering each column strip so original PDF tick marks are hidden in editor
  const columnHeight = clamp(
    (layout.anchors[layout.anchors.length - 1]?.stageY || 0) + layout.rowHeight
      - Math.max(0, layout.anchors[0]?.stageY || 0) + layout.rowHeight * 0.22,
    layout.rowHeight,
    height,
  );
  const columnTop = clamp(Math.max(0, (layout.anchors[0]?.stageY || 0) - layout.rowHeight * 0.18), 0, height);
  layout.columns.forEach((column) => {
    const extraW = layout.mode === "single-check" ? column.width * 0.45 : column.width * 0.12;
    const rx = clamp(column.left - extraW * 0.35, 0, width);
    masks.push(createPdfMaskObject(rx, columnTop, Math.min(width - rx, column.width + extraW), columnHeight));
  });

  layout.anchors.forEach((anchor, index) => {
    const questionId = `pdf-q-${index + 1}`;
    const top = clamp(anchor.stageY - layout.rowHeight * 0.18, 0, height - layout.rowHeight);
    const correctChoice = layout.answers[questionId] || null;
    const correctColumn = layout.columns.find((column) => column.key === correctChoice) || null;
    slots.push({ id: questionId, correctChoice, correctLabel: correctColumn?.label || null });
    layout.columns.forEach((column, columnIndex) => {
      objects.push(
        createPdfSelectionObject(
          questionId,
          column.key,
          column.left,
          top,
          column.width,
          layout.rowHeight,
          index * Math.max(1, layout.columns.length) + columnIndex,
          correctChoice === column.key ? true : (correctChoice ? false : null),
          column.label || column.key,
          layout.mode,
        ),
      );
    });
  });

  return { objects, slots, masks, layout };
}

function applyPdfCleaningMasks(kind, page) {
  if (kind === "drag-drop") {
    return [];
  }
  // selection masks are built inside buildPdfSelectionObjects, nothing extra needed here
  return [];
}

function buildPdfDragDropObjects(draft, page) {
  const lines = Array.isArray(page.lines) ? page.lines : [];
  const terms = (draft.draggableTerms || []).map((term) => sanitizePdfText(term)).filter(Boolean);
  const answers = (draft.answerTerms || []).map((term) => sanitizePdfText(term)).filter(Boolean);
  const anchors = getPdfQuestionAnchors(page).length
    ? getPdfQuestionAnchors(page)
    : extractPdfQuestionAnchors(lines, page.height || 768);
  const preferredDropTerms = answers.length >= Math.min(terms.length, anchors.length) ? answers : terms;
  const dropTerms = preferredDropTerms.slice(0, anchors.length);
  if (!terms.length || !anchors.length || !dropTerms.length) return { objects: [], matches: {} };

  const width = page.width || 1365;
  const height = page.height || 768;
  const poolRect = getPdfDragPoolRect(page);
  const dragGap = 10;
  const dragHeight = clamp(Math.round(height * 0.045), 34, 46);
  const objects = [];
  const matches = {};
  const dropzones = [];

  dropTerms.forEach((answer, index) => {
    const anchor = anchors[index];
    if (!anchor) return;
    const dropHeight = clamp(Math.round(height * 0.043), 32, 42);
    const dropWidth = clamp(Math.max(220, Math.round(answer.length * 10.5)), 220, Math.round(width * 0.28));
    const preferredX = anchor.x + (anchor.width || 0) + 12;
    const minX = Math.max(110, width * 0.16);
    const maxX = Math.max(minX, poolRect ? (poolRect.x - dropWidth - 24) : (width * 0.55));
    const targetX = clamp(preferredX, minX, maxX);
    const preferredY = anchor.stageY;
    const minY = Math.max(24, anchor.stageY - 4);
    const maxY = Math.max(minY, anchor.stageY + anchor.height);

    const dropzone = createPdfDropzoneObject(
      answer,
      targetX,
      clamp(preferredY, minY, maxY),
      dropWidth,
      dropHeight,
      index,
    );
    objects.push(dropzone);
    dropzones.push(dropzone);
  });

  const longTerms = terms.some((term) => term.length > 24);
  const columns = poolRect && !longTerms && terms.length >= 6 ? 2 : 1;
  const dragWidth = poolRect
    ? clamp(Math.round(columns === 1 ? poolRect.width - 18 : (poolRect.width - 24 - dragGap) / 2), 200, 420)
    : clamp(Math.round(width * 0.18), 180, 320);
  const dragStartX = poolRect ? poolRect.x + 9 : width * 0.72;
  const dragStartY = poolRect ? poolRect.y + 8 : height * 0.24;

  terms.forEach((term, index) => {
    const column = columns === 1 ? 0 : index % columns;
    const row = columns === 1 ? index : Math.floor(index / columns);
    const x = poolRect
      ? dragStartX + column * (dragWidth + dragGap)
      : width * (0.72 + column * 0.12);
    const y = poolRect
      ? dragStartY + row * (dragHeight + 8)
      : height * 0.24 + row * (dragHeight + 12);

    const draggable = createPdfDraggableObject(
      term,
      x,
      y,
      dragWidth,
      dragHeight,
      index,
    );
    objects.push(draggable);

    const dropzone = dropzones.find((item) => item.group === term) || dropzones[index] || null;
    if (dropzone) matches[draggable.id] = dropzone.id;
  });

  return { objects, matches };
}

function buildPdfDraftActivities(bookId, analysis) {
  const activities = (analysis?.items || []).map((draft) => {
    let mappedType = "mixed";
    if (draft.kind === "drag-drop" || draft.kind === "sequence") {
      mappedType = "drag-drop";
    } else if (draft.kind === "selection") {
      mappedType = "selection";
    }
    const activity = createActivity(draft.name || draft.markerLabel || "PDF Etkinligi", mappedType);
    const selectionBlueprint = buildPdfSelectionBlueprint(draft.storyboardPages || []);
    activity.bookId = bookId;
    activity.name = draft.markerLabel || draft.name || activity.name;
    activity.notes = [
      "PDF prototip importu",
      `Kaynak: ${analysis.fileName}`,
      `Durum: ${draft.status}`,
      `Tip: ${draft.kind}`,
      draft.interactionType ? `Etkilesim: ${draft.interactionType}` : "",
      draft.instruction ? `Yonerge: ${draft.instruction}` : "",
      draft.developerNote ? `Yazilimci Notu: ${draft.developerNote}` : "",
    ].filter(Boolean).join("\n");
    activity.autoBuildStatus = draft.status;
    activity.autoBuildSource = "pdf";
    activity.automationMeta = {
      importedFrom: analysis.fileName,
      kind: draft.kind,
      interactionType: draft.interactionType || "Content",
      pageCount: draft.pageCount,
      startPage: draft.startPage,
      endPage: draft.endPage,
      markerLabel: draft.markerLabel,
      prompt: draft.prompt,
      instruction: draft.instruction || "",
      developerNote: draft.developerNote || "",
      storyboardPages: draft.storyboardPages || [],
    };
    activity.mcQuestion = draft.instruction || draft.prompt || draft.name || activity.name;
    activity.playScreen = {
      ...activity.playScreen,
      title: draft.prompt || draft.name || activity.name,
      body: draft.instruction || (draft.kind === "selection"
        ? "Secimleri dogrudan sahne uzerinden yapin."
        : activity.playScreen.body),
    };
    activity.introScreen = {
      ...activity.introScreen,
      title: draft.markerLabel || activity.name,
      body: draft.status === "ready"
        ? "PDF'den otomatik taslak olusturuldu. Sahne ve cevaplar hazirlandi."
        : draft.status === "review"
          ? "PDF'den taslak olusturuldu. Son kontrol ve duzeltme gerekebilir."
          : "PDF zemin yerlestirildi. Etkinlik tipi manuel tamamlanmali.",
    };

    if (selectionBlueprint?.mcOptions?.length) {
      activity.mcMode = selectionBlueprint.mcMode || "multi";
      activity.mcQuestion = selectionBlueprint.mcQuestion || activity.mcQuestion;
      activity.mcOptions = selectionBlueprint.mcOptions;
    }

    const slides = draft.pages.map((page, index) => {
      const slide = createSlide(`Slider ${index + 1}`, index);
      slide.name = `Slider ${index + 1}`;
      slide.sceneName = draft.pages.length > 1 ? `${draft.markerLabel || activity.name} - ${index + 1}` : (draft.markerLabel || activity.name);
      slide.stageWidth = 1920;
      slide.stageHeight = 1080;
      slide.objects = [
        createPdfImageObject(page.imageUrl, slide.stageWidth, slide.stageHeight),
        ...applyPdfCleaningMasks(draft.kind, page),
      ];
      slide.timeline = [];
      slide.triggers = [];

      if (draft.kind === "selection") {
        const selection = buildPdfSelectionObjects(draft, page);
        slide.objects = [...slide.objects, ...selection.masks, ...selection.objects];
        activity.selectionSlots = selection.slots;

        // Build mcOptions from detected layout so the SCORM player can evaluate answers
        if (selection.layout && !(selectionBlueprint?.mcOptions?.length)) {
          const { layout: lay } = selection;
          if (lay.mode === "binary") {
            // D/Y mode: each statement → one mcOption; correct = the ones marked "d"
            activity.mcOptions = lay.anchors.map((anchor) => {
              const qId = `pdf-q-${lay.anchors.indexOf(anchor) + 1}`;
              return { id: uid(), label: anchor.text, isCorrect: lay.answers[qId] === "d" };
            });
            activity.mcMode = "multi";
            activity.mcQuestion = "Asagidaki ifadelerden dogru olanlari isaretleyiniz.";
          } else {
            // single-check mode: checked items are correct
            activity.mcOptions = lay.anchors.map((anchor, i) => {
              const qId = `pdf-q-${i + 1}`;
              return { id: uid(), label: anchor.text, isCorrect: lay.answers[qId] === "tick" };
            });
            activity.mcMode = "multi";
            activity.mcQuestion = "Uygun kutucuklari isaretleyiniz.";
          }
        }
      }

      if ((draft.kind === "drag-drop" || draft.kind === "sequence") && index === draft.pages.length - 1) {
        const dragDrop = buildPdfDragDropObjects(draft, page);
        slide.objects = [...slide.objects, ...dragDrop.objects];
        activity.dragDropMatches = dragDrop.matches;
      }

      if (draft.kind === "video" && index === draft.pages.length - 1) {
        const videoObject = createObject("video");
        slide.objects.push({
          ...videoObject,
          x: slide.stageWidth * 0.2,
          y: slide.stageHeight * 0.24,
          width: slide.stageWidth * 0.42,
          height: slide.stageHeight * 0.34,
          label: "Video yerlestir",
          locked: false,
        });
      }

      return normalizeSlide(slide, index);
    });

    activity.slides = slides;
    activity.currentSlideId = slides[0]?.id || activity.currentSlideId;
    return normalizeActivity(activity);
  });

  const record = {
    id: uid(),
    fileName: analysis?.fileName || "pdf",
    createdAt: new Date().toISOString(),
    pageCount: analysis?.pageCount || 0,
    storyboardConfig: analysis?.storyboard || null,
    items: (analysis?.items || []).map((draft, index) => ({
      id: draft.id,
      order: index + 1,
      label: draft.markerLabel,
      name: draft.name,
      kind: draft.kind,
      interactionType: draft.interactionType || "Content",
      status: draft.status,
      pageCount: draft.pageCount,
      startPage: draft.startPage,
      endPage: draft.endPage,
      extractedItemCount: draft.extractedItemCount || 0,
      activityId: activities[index]?.id || "",
    })),
  };

  return { record, activities };
}

function pickSlideState(source = {}) {
  return Object.fromEntries(SLIDE_STATE_KEYS.map(key => [key, source[key]]));
}

function normalizeSlide(slide = {}, index = 0) {
  const fallback = createSlide(slide.name || `Slider ${index + 1}`, index);
  const layers = Array.isArray(slide.layers) && slide.layers.length
    ? slide.layers.map((layer, layerIndex) => ({
      ...createLayer("Katman", layerIndex),
      ...layer,
      id: layerIndex === 0 ? "base" : (layer.id || uid()),
      kind: layerIndex === 0 ? "base" : (layer.kind || "overlay"),
    }))
    : fallback.layers;
  let normalizedObjects = Array.isArray(slide.objects) ? slide.objects.map(normalizeObject) : fallback.objects;
  const sourceStageWidth = Math.max(1, Number(slide.stageWidth || fallback.stageWidth || 1920));
  const sourceStageHeight = Math.max(1, Number(slide.stageHeight || fallback.stageHeight || 1080));
  const hasPdfBackground = normalizedObjects.some(object => object?.isPdfBackground && object?.imageData);
  if (hasPdfBackground && (sourceStageWidth !== 1920 || sourceStageHeight !== 1080)) {
    const scaleX = 1920 / sourceStageWidth;
    const scaleY = 1080 / sourceStageHeight;
    normalizedObjects = normalizedObjects.map((object) => ({
      ...object,
      x: Number(object.x || 0) * scaleX,
      y: Number(object.y || 0) * scaleY,
      width: object.isPdfBackground ? 1920 : Math.max(1, Number(object.width || 0) * scaleX),
      height: object.isPdfBackground ? 1080 : Math.max(1, Number(object.height || 0) * scaleY),
    }));
  }
  const nextSlide = {
    ...fallback,
    ...slide,
    name: slide.name || fallback.name,
    sceneName: slide.sceneName || fallback.sceneName,
    stageWidth: hasPdfBackground ? 1920 : Number(slide.stageWidth || fallback.stageWidth || 1920),
    stageHeight: hasPdfBackground ? 1080 : Number(slide.stageHeight || fallback.stageHeight || 1080),
    layers,
    activeLayerId: layers.some(layer => layer.id === slide.activeLayerId) ? slide.activeLayerId : "base",
    nextActivityId: slide.nextActivityId || "",
    objects: normalizedObjects,
    timeline: Array.isArray(slide.timeline) ? slide.timeline : [],
    triggers: Array.isArray(slide.triggers)
      ? slide.triggers.map((trigger, indexValue) => ({
        ...createTriggerItem(indexValue),
        ...trigger,
        conditions: Array.isArray(trigger.conditions)
          ? trigger.conditions.map((condition, conditionIndex) => ({ ...createTriggerConditionItem(conditionIndex), ...condition }))
          : [],
      }))
      : [],
    audioUrl: slide.audioUrl || "",
    audioName: slide.audioName || "",
    audioAutoPlay: slide.audioAutoPlay !== false,
    audioLoop: !!slide.audioLoop,
    slideTransitionEffect: SLIDE_TRANSITION_OPTIONS.some(option => option.value === slide.slideTransitionEffect) ? slide.slideTransitionEffect : "fade",
    slideTransitionDirection: TIMELINE_DIRECTION_OPTIONS.some(option => option.value === slide.slideTransitionDirection) ? slide.slideTransitionDirection : "left",
    slideTransitionDuration: Math.min(2.5, Math.max(0, Number(slide.slideTransitionDuration ?? 0.45) || 0)),
  };
  return {
    ...nextSlide,
    timeline: syncTimelineWithObjects({
      ...nextSlide,
      objects: normalizedObjects,
    }),
  };
}

function materializeActivity(activity = {}) {
  const fallback = createActivity(activity.name || "Etkinlik", activity.type || "selection");
  const currentSlide = Array.isArray(activity.slides) && activity.slides.length
    ? activity.slides.find(slide => slide.id === activity.currentSlideId) || activity.slides[0]
    : null;
  return currentSlide
    ? { ...activity, ...pickSlideState(currentSlide), currentSlideId: currentSlide.id }
    : { ...fallback, ...activity };
}

function commitMaterializedActivity(activity = {}) {
  const fallback = createActivity(activity.name || "Etkinlik", activity.type || "selection");
  const existingSlides = Array.isArray(activity.slides) && activity.slides.length
    ? activity.slides
    : [{ ...createSlide("Slider 1", 0), ...pickSlideState({ ...fallback, ...activity }) }];
  const currentSlideId = existingSlides.some(slide => slide.id === activity.currentSlideId)
    ? activity.currentSlideId
    : existingSlides[0].id;
  const slidePatch = pickSlideState({ ...fallback, ...activity });
  const slides = existingSlides.map((slide, index) => slide.id === currentSlideId
    ? normalizeSlide({ ...slide, ...slidePatch, name: slide.name || `Slider ${index + 1}` }, index)
    : normalizeSlide(slide, index));
  return { ...activity, slides, currentSlideId };
}

function selectActivitySlide(activity = {}, slideId = "") {
  const slides = Array.isArray(activity.slides) ? activity.slides : [];
  const target = slides.find(slide => slide.id === slideId) || slides[0];
  if (!target) return activity;
  return { ...activity, currentSlideId: target.id, ...pickSlideState(target) };
}

function getActivitySlides(activity = {}) {
  return Array.isArray(activity?.slides) && activity.slides.length
    ? activity.slides.map((slide, index) => normalizeSlide(slide, index))
    : [normalizeSlide(pickSlideState(activity), 0)];
}

function getActivitySlideTarget(activity = {}, value = "__next__") {
  const slides = getActivitySlides(activity);
  if (!slides.length) return null;
  const currentIndex = Math.max(0, slides.findIndex(slide => slide.id === activity?.currentSlideId));
  if (value === "__next__") return slides[currentIndex + 1] || null;
  if (value === "__prev__") return slides[currentIndex - 1] || null;
  return slides.find(slide => slide.id === value) || null;
}

function getAdjacentActivitySlideId(activity = {}, offset = 1) {
  return getActivitySlideTarget(activity, offset >= 0 ? "__next__" : "__prev__")?.id || "";
}

function materializeActivitySlide(activity = {}, slideId = "") {
  const normalized = normalizeActivity(activity);
  const target = getActivitySlideTarget(normalized, slideId || normalized.currentSlideId);
  return target
    ? materializeActivity({ ...normalized, currentSlideId: target.id })
    : normalized;
}

function normalizePreviewPhaseKey(value = "") {
  return String(value || "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
}

function findPreviewPhaseSlide(activity = {}, phase = "intro") {
  const slides = getActivitySlides(activity);
  if (!slides.length) return null;
  const phaseMatchers = {
    intro: ["onizleme tanitim", "tanitim", "giris"],
    package: ["tema paketi", "buton paketi", "tema", "paket", "kilavuz"],
    menu: ["menu"],
  };
  const matchers = phaseMatchers[phase] || [];
  return slides.find((slide) => {
    const haystack = normalizePreviewPhaseKey(`${slide.sceneName || ""} ${slide.name || ""}`);
    return matchers.some((matcher) => haystack.includes(matcher));
  }) || slides[0];
}

function getPreviewPhaseActivity(activity = {}, phase = "intro") {
  const slide = findPreviewPhaseSlide(activity, phase);
  return slide ? materializeActivitySlide(activity, slide.id) : null;
}

function getSlideDirectionOffset(direction = "left", distance = 56) {
  if (direction === "right") return { x: distance, y: 0 };
  if (direction === "up") return { x: 0, y: -distance };
  if (direction === "down") return { x: 0, y: distance };
  return { x: -distance, y: 0 };
}

function SlideTransitionView({ transitionKey, effect = "fade", direction = "left", duration = 0.45, children }) {
  const [entered, setEntered] = useState(effect === "none" || duration <= 0);

  useEffect(() => {
    if (effect === "none" || duration <= 0) {
      setEntered(true);
      return undefined;
    }
    setEntered(false);
    const raf = window.requestAnimationFrame(() => setEntered(true));
    return () => window.cancelAnimationFrame(raf);
  }, [transitionKey, effect, direction, duration]);

  const offset = effect === "slide" && !entered ? getSlideDirectionOffset(direction) : { x: 0, y: 0 };
  const opacity = effect === "none" ? 1 : (entered ? 1 : 0.02);

  return (
    <div
      style={{
        transition: duration > 0 ? `transform ${duration}s ease, opacity ${duration}s ease` : "none",
        transform: `translate(${offset.x}px, ${offset.y}px)`,
        opacity,
        willChange: "transform, opacity",
      }}
    >
      {children}
    </div>
  );
}

const INITIAL_STATE = { publishers: [], books: [], previewTemplates: [], textStudioPresets: [], variables: [], activities: [], selPubId: null, selBookId: null, selActId: null, lmsConfig: { ...DEFAULT_LMS_CONFIG } };

function normalizeVariable(variable = {}, index = 0) {
  const type = VARIABLE_TYPES.some(item => item.value === variable.type) ? variable.type : "number";
  return {
    ...createVariableItem(index),
    ...variable,
    type,
    value: castVariableValue(type, variable.value ?? getDefaultVariableValue(type)),
  };
}

function normalizeObject(obj = {}) {
  const preset = OBJ_PRESETS[obj.type] || OBJ_PRESETS.text;
  const mergedStyle = { ...preset.style, ...(obj.style || {}) };
  const style = obj.type === "draggable" || obj.type === "dropzone"
    ? upgradeDragDropStyle(obj.type, mergedStyle)
    : mergedStyle;
  return { ...createObject(obj.type || "text"), ...obj, visible: obj.visible !== false, style };
}

function normalizeActivity(activity = {}) {
  const fallback = createActivity(activity.name || "Etkinlik", activity.type || "selection");
  const legacySlide = normalizeSlide({ ...pickSlideState({ ...fallback, ...activity }), id: activity.currentSlideId || uid(), name: "Slider 1" }, 0);
  const normalizedSlides = Array.isArray(activity.slides) && activity.slides.length
    ? activity.slides.map((slide, index) => normalizeSlide(slide, index))
    : [legacySlide];
  const currentSlideId = normalizedSlides.some(slide => slide.id === activity.currentSlideId)
    ? activity.currentSlideId
    : normalizedSlides[0]?.id;
  const currentSlide = normalizedSlides.find(slide => slide.id === currentSlideId) || normalizedSlides[0] || legacySlide;
  const dragDropDefaults = getActivityDragDropDefaults({
    ...fallback,
    ...activity,
    ...pickSlideState(currentSlide),
  });
  const nextActivity = {
    ...fallback, ...activity, ...pickSlideState(currentSlide),
    settings: { ...DEFAULT_ACTIVITY_SETTINGS, ...(activity.settings || {}) },
    introScreen: { ...fallback.introScreen, ...(activity.introScreen || {}) },
    buttonPackageScreen: { ...fallback.buttonPackageScreen, ...(activity.buttonPackageScreen || {}) },
    menuScreen: { ...fallback.menuScreen, ...(activity.menuScreen || {}) },
    playScreen: { ...fallback.playScreen, ...(activity.playScreen || {}) },
    resultScreens: { ...fallback.resultScreens, ...(activity.resultScreens || {}) },
    answerScreen: { ...fallback.answerScreen, ...(activity.answerScreen || {}) },
    slides: normalizedSlides,
    currentSlideId,
    dragDropDefaults,
    dragDropMode: activity.dragDropMode || "single",
    dragDropMatches: activity.dragDropMatches || {},
    mcOptions: Array.isArray(activity.mcOptions) && activity.mcOptions.length
      ? activity.mcOptions.map(opt => ({ ...opt, id: opt.id || uid() }))
      : fallback.mcOptions,
  };
  return materializeActivity(nextActivity);
}

function normalizeBook(book = {}, index = 0) {
  const pkgId = BUTTON_PACKAGES.some(item => item.id === book.buttonPackageId)
    ? book.buttonPackageId
    : BUTTON_PACKAGES[0].id;
  const name = String(book.name || "").trim() || `Kitap ${index + 1}`;
  const previewDocument = normalizeActivity(book.previewDocument || createBookPreviewDocument(name, pkgId));
  return {
    ...book,
    id: book.id || uid(),
    publisherId: book.publisherId || "",
    name,
    description: book.description || "",
    buttonPackageId: pkgId,
    pdfImports: Array.isArray(book.pdfImports) ? book.pdfImports : [],
    previewDocument,
  };
}

function normalizePreviewTemplate(template = {}, index = 0) {
  const name = String(template.name || "").trim() || `Preview ${index + 1}`;
  return {
    id: template.id || uid(),
    name,
    createdAt: template.createdAt || new Date().toISOString(),
    previewDocument: normalizeActivity(template.previewDocument || createBookPreviewDocument(name, BUTTON_PACKAGES[0].id)),
  };
}

const TEXT_STUDIO_SETTING_KEYS = [
  "completionMode",
  "scorePoints",
  "maxAttempts",
  "shuffleOptions",
  "showFeedback",
  "allowRetry",
  "showAnswerLayer",
  "answerButtonText",
  "showButtonPackageIntro",
  "showMenuScreen",
  "guideButtonText",
  "menuButtonText",
  "checkButtonText",
  "solutionButtonText",
  "restartFlowText",
  "completeButtonText",
  "homeButtonText",
  "soundOnText",
  "soundOffText",
  "guideButtonAction",
  "packageBackAction",
  "menuButtonAction",
  "checkButtonAction",
  "solutionButtonAction",
  "restartButtonAction",
  "completeButtonAction",
  "answerButtonAction",
  "homeButtonAction",
  "introNextPhase",
  "packageNextPhase",
  "menuNextPhase",
];

function safeClone(value, fallback = {}) {
  try {
    return JSON.parse(JSON.stringify(value ?? fallback));
  } catch {
    return fallback;
  }
}

function pickTextStudioDesign(activity = {}) {
  const settings = { ...DEFAULT_ACTIVITY_SETTINGS, ...(activity.settings || {}) };
  return {
    buttonPackageId: activity.buttonPackageId || BUTTON_PACKAGES[0]?.id || "classic",
    introScreen: safeClone(activity.introScreen || {}),
    buttonPackageScreen: safeClone(activity.buttonPackageScreen || {}),
    menuScreen: safeClone(activity.menuScreen || {}),
    playScreen: safeClone(activity.playScreen || {}),
    resultScreens: safeClone(activity.resultScreens || {}),
    answerScreen: safeClone(activity.answerScreen || {}),
    settings: TEXT_STUDIO_SETTING_KEYS.reduce((acc, key) => {
      acc[key] = settings[key];
      return acc;
    }, {}),
  };
}

function normalizeTextStudioPreset(preset = {}, index = 0) {
  const name = String(preset.name || "").trim() || `Tasarım ${index + 1}`;
  return {
    id: preset.id || uid(),
    name,
    createdAt: preset.createdAt || new Date().toISOString(),
    updatedAt: preset.updatedAt || preset.createdAt || new Date().toISOString(),
    payload: pickTextStudioDesign(preset.payload || preset.design || preset),
  };
}

function applyTextStudioPreset(activity = {}, preset = {}) {
  const payload = preset?.payload || preset || {};
  return normalizeActivity({
    ...activity,
    buttonPackageId: payload.buttonPackageId || activity.buttonPackageId,
    introScreen: safeClone(payload.introScreen, activity.introScreen || {}),
    buttonPackageScreen: safeClone(payload.buttonPackageScreen, activity.buttonPackageScreen || {}),
    menuScreen: safeClone(payload.menuScreen, activity.menuScreen || {}),
    playScreen: safeClone(payload.playScreen, activity.playScreen || {}),
    resultScreens: safeClone(payload.resultScreens, activity.resultScreens || {}),
    answerScreen: safeClone(payload.answerScreen, activity.answerScreen || {}),
    settings: { ...DEFAULT_ACTIVITY_SETTINGS, ...(activity.settings || {}), ...(payload.settings || {}) },
  });
}

function normalizeState(state = {}) {
  return {
    ...INITIAL_STATE, ...state,
    publishers: Array.isArray(state.publishers) ? state.publishers : [],
    books: Array.isArray(state.books) ? state.books.map(normalizeBook) : [],
    previewTemplates: Array.isArray(state.previewTemplates) ? state.previewTemplates.map(normalizePreviewTemplate) : [],
    textStudioPresets: Array.isArray(state.textStudioPresets) ? state.textStudioPresets.map(normalizeTextStudioPreset) : [],
    variables: Array.isArray(state.variables) ? state.variables.map(normalizeVariable) : [],
    activities: Array.isArray(state.activities) ? state.activities.map(normalizeActivity) : [],
    lmsConfig: { ...DEFAULT_LMS_CONFIG, ...(state.lmsConfig || {}) },
  };
}

// ─── UI Yardımcıları ──────────────────────────────────────────────────────────

function Inp({ label, value, onChange, type = "text", placeholder = "", rows }) {
  const base = { width: "100%", padding: "5px 8px", borderRadius: 5, border: "1px solid #333", background: "#0f0f20", color: "#E0E0E0", fontSize: 11, boxSizing: "border-box", outline: "none" };
  return (
    <div>
      {label && <label style={{ fontSize: 9, color: "#78909C", display: "block", marginBottom: 2 }}>{label}</label>}
      {type === "textarea"
        ? <textarea value={value} onChange={onChange} rows={rows || 3} placeholder={placeholder} style={{ ...base, resize: "vertical" }} />
        : <input type={type} value={value} onChange={onChange} placeholder={placeholder} style={base} />}
    </div>
  );
}

function SelectInp({ label, value, onChange, options }) {
  return (
    <div>
      {label && <label style={{ fontSize: 9, color: "#78909C", display: "block", marginBottom: 2 }}>{label}</label>}
      <select value={value} onChange={onChange} style={{ width: "100%", padding: "5px 8px", borderRadius: 5, border: "1px solid #333", background: "#0f0f20", color: "#E0E0E0", fontSize: 11, boxSizing: "border-box", outline: "none" }}>
        {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
    </div>
  );
}

function Btn({ children, onClick, color = "#7C4DFF", small = false, disabled = false, style: s = {} }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: small ? "4px 10px" : "6px 14px", borderRadius: 6, cursor: disabled ? "default" : "pointer",
      fontSize: small ? 10 : 11, fontWeight: 600, border: `1px solid ${color}`, transition: "all .15s",
      background: disabled ? "#1a1a30" : color + "22", color: disabled ? "#444" : color,
      opacity: disabled ? 0.5 : 1, flexShrink: 0, ...s,
    }}>{children}</button>
  );
}

function Modal({ title, onClose, width = 400, children }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000c", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#1a1a30", borderRadius: 14, padding: 24, width, maxWidth: "92vw", border: "1px solid #333", maxHeight: "85vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: "#E0E0E0" }}>{title}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: 18 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Tema / Yardımcı Fonksiyonlar ─────────────────────────────────────────────

const PACKAGE_SCREEN_THEMES = {
  "pkg-1":  { intro: "linear-gradient(135deg,#082f49,#155e75)",  play: "linear-gradient(135deg,#0f172a,#164e63)",  success: "linear-gradient(135deg,#083344,#0f766e)",  failure: "linear-gradient(135deg,#172554,#7e22ce)",  button: "linear-gradient(135deg,#22d3ee,#0891b2)",  text: "#ecfeff",  panel: "rgba(8,47,73,.55)",    border: "#22d3ee", accent: "#06b6d4", accentDark: "#0e7490", successTone: "#14b8a6", dangerTone: "#f43f5e", radius: 18 },
  "pkg-2":  { intro: "linear-gradient(135deg,#052e16,#14532d)",  play: "linear-gradient(135deg,#064e3b,#166534)",  success: "linear-gradient(135deg,#022c22,#15803d)",  failure: "linear-gradient(135deg,#3f6212,#166534)",  button: "linear-gradient(135deg,#34d399,#059669)",  text: "#ecfdf5",  panel: "rgba(6,78,59,.5)",     border: "#34d399", accent: "#10b981", accentDark: "#047857", successTone: "#22c55e", dangerTone: "#f97316", radius: 20 },
  "pkg-3":  { intro: "linear-gradient(135deg,#312e81,#6d28d9)",  play: "linear-gradient(135deg,#1e1b4b,#7c3aed)",  success: "linear-gradient(135deg,#4c1d95,#8b5cf6)",  failure: "linear-gradient(135deg,#581c87,#be185d)",  button: "linear-gradient(135deg,#8b5cf6,#d946ef)",  text: "#f5f3ff",  panel: "rgba(49,46,129,.48)",  border: "#a78bfa", accent: "#8b5cf6", accentDark: "#6d28d9", successTone: "#22c55e", dangerTone: "#ec4899", radius: 16 },
  "pkg-4":  { intro: "linear-gradient(135deg,#78350f,#b45309)",  play: "linear-gradient(135deg,#451a03,#92400e)",  success: "linear-gradient(135deg,#14532d,#ca8a04)",  failure: "linear-gradient(135deg,#7c2d12,#dc2626)",  button: "linear-gradient(135deg,#fbbf24,#f97316)",  text: "#fffbeb",  panel: "rgba(120,53,15,.42)",  border: "#fbbf24", accent: "#f59e0b", accentDark: "#c2410c", successTone: "#65a30d", dangerTone: "#ef4444", radius: 14 },
  "pkg-5":  { intro: "linear-gradient(135deg,#500724,#9d174d)",  play: "linear-gradient(135deg,#4a044e,#be185d)",  success: "linear-gradient(135deg,#701a75,#db2777)",  failure: "linear-gradient(135deg,#831843,#be123c)",  button: "linear-gradient(135deg,#f472b6,#ec4899)",  text: "#fdf2f8",  panel: "rgba(80,7,36,.48)",    border: "#f472b6", accent: "#ec4899", accentDark: "#be185d", successTone: "#22c55e", dangerTone: "#fb7185", radius: 24 },
  "pkg-6":  { intro: "linear-gradient(135deg,#172554,#1d4ed8)",  play: "linear-gradient(135deg,#1e3a8a,#2563eb)",  success: "linear-gradient(135deg,#0f172a,#3b82f6)",  failure: "linear-gradient(135deg,#1e1b4b,#1d4ed8)",  button: "linear-gradient(135deg,#60a5fa,#2563eb)",  text: "#eff6ff",  panel: "rgba(30,58,138,.45)",  border: "#60a5fa", accent: "#2563eb", accentDark: "#1d4ed8", successTone: "#16a34a", dangerTone: "#ef4444", radius: 16 },
  "pkg-7":  { intro: "linear-gradient(135deg,#1a2e05,#4d7c0f)",  play: "linear-gradient(135deg,#365314,#65a30d)",  success: "linear-gradient(135deg,#14532d,#84cc16)",  failure: "linear-gradient(135deg,#365314,#a16207)",  button: "linear-gradient(135deg,#bef264,#65a30d)",  text: "#1a2e05",  panel: "rgba(54,83,20,.46)",   border: "#bef264", accent: "#84cc16", accentDark: "#4d7c0f", successTone: "#16a34a", dangerTone: "#f97316", radius: 999 },
  "pkg-8":  { intro: "linear-gradient(135deg,#450a0a,#be123c)",  play: "linear-gradient(135deg,#7f1d1d,#e11d48)",  success: "linear-gradient(135deg,#7f1d1d,#fb7185)",  failure: "linear-gradient(135deg,#881337,#dc2626)",  button: "linear-gradient(135deg,#fb7185,#e11d48)",  text: "#fff1f2",  panel: "rgba(127,29,29,.48)",  border: "#fb7185", accent: "#f43f5e", accentDark: "#be123c", successTone: "#22c55e", dangerTone: "#dc2626", radius: 18 },
  "pkg-9":  { intro: "linear-gradient(135deg,#111827,#334155)",  play: "linear-gradient(135deg,#1f2937,#475569)",  success: "linear-gradient(135deg,#0f172a,#64748b)",  failure: "linear-gradient(135deg,#1f2937,#b91c1c)",  button: "linear-gradient(135deg,#94a3b8,#475569)",  text: "#f8fafc",  panel: "rgba(15,23,42,.52)",   border: "#94a3b8", accent: "#64748b", accentDark: "#334155", successTone: "#22c55e", dangerTone: "#ef4444", radius: 12 },
  "pkg-10": { intro: "linear-gradient(135deg,#3b0764,#6d28d9)",  play: "linear-gradient(135deg,#581c87,#7c3aed)",  success: "linear-gradient(135deg,#4c1d95,#a855f7)",  failure: "linear-gradient(135deg,#581c87,#db2777)",  button: "linear-gradient(135deg,#c084fc,#7c3aed)",  text: "#faf5ff",  panel: "rgba(76,29,149,.48)",  border: "#c084fc", accent: "#a855f7", accentDark: "#7c3aed", successTone: "#22c55e", dangerTone: "#ec4899", radius: 22 },
};

function getPackageTheme(pkgId) { return PACKAGE_SCREEN_THEMES[pkgId] || PACKAGE_SCREEN_THEMES["pkg-1"]; }

function shuffleArray(items = []) {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [next[i], next[j]] = [next[j], next[i]]; }
  return next;
}

function getFitScale(stageWidth, stageHeight, maxWidth, maxHeight) {
  const safeWidth = Math.max(320, maxWidth || 0);
  const safeHeight = Math.max(240, maxHeight || 0);
  const sw = Math.max(1, stageWidth || 1);
  const sh = Math.max(1, stageHeight || 1);
  return Math.max(0.1, Math.min(safeWidth / sw, safeHeight / sh));
}

function getActivityLayers(activity) {
  return Array.isArray(activity?.layers) && activity.layers.length
    ? activity.layers
    : [createLayer("Katman", 0)];
}

function getCanvasObjects(activity, activeLayerId = activity?.activeLayerId || "base", hiddenObjectIds = null) {
  return (activity?.objects || []).filter(obj => {
    const layerId = obj.layerId || "base";
    if (hiddenObjectIds?.has?.(obj.id)) return false;
    if (obj?.isPdfMask) return false;
    return layerId === "base" || layerId === activeLayerId;
  });
}

function normalizeTimelineItem(item = {}, index = 0, objects = []) {
  const fallbackObject = objects[index] || null;
  const objectId = item.objectId || fallbackObject?.id || "";
  const linkedObject = objects.find(object => object.id === objectId) || fallbackObject || null;
  const fallback = createTimelineItem(index, linkedObject);
  const nextDuration = Math.max(0.2, Number(item.duration ?? fallback.duration) || fallback.duration);
  const rawKeyframes = Array.isArray(item.keyframes) && item.keyframes.length ? item.keyframes : fallback.keyframes;
  const keyframes = rawKeyframes
    .map((frame, frameIndex) => ({
      ...createTimelineKeyframe(0, frameIndex),
      ...frame,
      time: clamp(Number(frame?.time ?? 0) || 0, 0, nextDuration),
      x: Number(frame?.x ?? 0) || 0,
      y: Number(frame?.y ?? 0) || 0,
      scale: Math.max(0.1, Number(frame?.scale ?? 1) || 1),
      opacity: clamp(Number(frame?.opacity ?? 1) || 0, 0, 1),
    }))
    .sort((a, b) => a.time - b.time);

  const seededKeyframes = keyframes.length > 0 ? keyframes : fallback.keyframes;

  if (seededKeyframes[0].time !== 0) {
    seededKeyframes.unshift({ ...createTimelineKeyframe(0, 0), ...seededKeyframes[0], id: uid(), time: 0, name: "Baslangic" });
  }
  if (seededKeyframes[seededKeyframes.length - 1].time !== nextDuration) {
    seededKeyframes.push({ ...createTimelineKeyframe(nextDuration, seededKeyframes.length), ...seededKeyframes[seededKeyframes.length - 1], id: uid(), time: nextDuration, name: "Bitis" });
  }

  return {
    ...fallback,
    ...item,
    objectId,
    name: item.name || linkedObject?.label || fallback.name,
    start: Math.max(0, Number(item.start ?? fallback.start) || 0),
    duration: nextDuration,
    track: index,
    entryEffect: TIMELINE_EFFECT_OPTIONS.some(option => option.value === item.entryEffect) ? item.entryEffect : fallback.entryEffect,
    exitEffect: TIMELINE_EFFECT_OPTIONS.some(option => option.value === item.exitEffect) ? item.exitEffect : fallback.exitEffect,
    direction: TIMELINE_DIRECTION_OPTIONS.some(option => option.value === item.direction) ? item.direction : fallback.direction,
    easing: TIMELINE_EASING_OPTIONS.some(option => option.value === item.easing) ? item.easing : fallback.easing,
    keyframes: seededKeyframes,
  };
}

function syncTimelineWithObjects(activity = {}) {
  const objects = Array.isArray(activity.objects) ? activity.objects : [];
  const existing = Array.isArray(activity.timeline) ? activity.timeline.map((item, index) => normalizeTimelineItem(item, index, objects)) : [];
  const existingByObject = new Map(existing.filter(item => item.objectId).map(item => [item.objectId, item]));

  return objects.map((object, index) => {
    const clip = existingByObject.get(object.id);
    return normalizeTimelineItem(clip || createTimelineItem(index, object), index, objects);
  });
}

function getActivityTimeline(activity = {}) {
  return syncTimelineWithObjects(activity);
}

function getTimelineItemForObject(activity = {}, objectId = "") {
  return getActivityTimeline(activity).find(item => item.objectId === objectId) || null;
}

function getTimelineDuration(activity = {}) {
  const timeline = getActivityTimeline(activity);
  const duration = timeline.reduce((maxValue, item) => Math.max(maxValue, (item.start || 0) + (item.duration || 0)), 0);
  return Math.max(5, Number(duration.toFixed(2)) || 5);
}

function shouldObjectPersistAfterTimeline(clip = null) {
  if (!clip) return true;
  return (clip.exitEffect || "none") === "none";
}

function isObjectTimelineActive(activity = {}, objectId = "", currentTime = 0) {
  const clip = getTimelineItemForObject(activity, objectId);
  if (!clip) return true;
  const start = Number(clip.start || 0);
  const end = start + Math.max(0.2, Number(clip.duration || 0));
  if (currentTime < start) return false;
  if (currentTime > end) return shouldObjectPersistAfterTimeline(clip);
  return true;
}

function applyTimelineEasing(progress = 0, easing = "linear") {
  const p = clamp(progress, 0, 1);
  if (easing === "easeIn") return p * p;
  if (easing === "easeOut") return 1 - Math.pow(1 - p, 2);
  if (easing === "easeInOut") return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
  return p;
}

function getTimelineDirectionOffset(direction = "left", distance = 56) {
  if (direction === "right") return { x: distance, y: 0 };
  if (direction === "up") return { x: 0, y: -distance };
  if (direction === "down") return { x: 0, y: distance };
  return { x: -distance, y: 0 };
}

function getTimelineMotionStyle(activity = {}, objectId = "", currentTime = 0, options = {}) {
  const clip = getTimelineItemForObject(activity, objectId);
  if (!clip) return { opacity: 1, translateX: 0, translateY: 0, scale: 1 };
  const suppressBoundaryEffects = options?.suppressBoundaryEffects === true;

  const start = Number(clip.start || 0);
  const duration = Math.max(0.2, Number(clip.duration || 0.2));
  const end = start + duration;
  const ramp = Math.min(Math.max(duration * 0.22, 0.24), duration / 2);

  let opacity = 1;
  let translateX = 0;
  let translateY = 0;
  let scaleValue = 1;
  const keyframes = Array.isArray(clip.keyframes) && clip.keyframes.length ? clip.keyframes : [createTimelineKeyframe(0, 0), createTimelineKeyframe(duration, 1)];
  const finalFrame = keyframes[keyframes.length - 1] || keyframes[0] || { x: 0, y: 0, scale: 1, opacity: 1 };

  if (currentTime < start) {
    return { opacity: 0, translateX: 0, translateY: 0, scale: 1 };
  }

  if (currentTime > end) {
    if (!shouldObjectPersistAfterTimeline(clip)) {
      return { opacity: 0, translateX: 0, translateY: 0, scale: 1 };
    }
    return {
      opacity: clamp(finalFrame.opacity ?? 1, 0, 1),
      translateX: Number(finalFrame.x || 0),
      translateY: Number(finalFrame.y || 0),
      scale: Number(finalFrame.scale || 1),
    };
  }

  const applyEffect = (effect = "none", progress = 1, reverse = false, direction = "left", easing = "linear") => {
    const eased = applyTimelineEasing(progress, easing);
    const amount = reverse ? eased : 1 - eased;
    if (effect === "fade") {
      opacity *= reverse ? Math.max(0, 1 - eased) : eased;
      return;
    }
    if (effect === "slide") {
      const offset = getTimelineDirectionOffset(direction, 72);
      translateX += offset.x * amount;
      translateY += offset.y * amount;
      return;
    }
    if (effect === "scale") {
      const nextScale = reverse ? 1 - (0.28 * eased) : 0.72 + (0.28 * eased);
      scaleValue *= nextScale;
    }
  };

  const localTime = clamp(currentTime - start, 0, duration);
  const currentFrameIndex = keyframes.findIndex((frame, index) => {
    const next = keyframes[index + 1];
    return !next || (localTime >= frame.time && localTime <= next.time);
  });
  const fromFrame = keyframes[Math.max(0, currentFrameIndex)] || keyframes[0];
  const toFrame = keyframes[Math.min(keyframes.length - 1, Math.max(0, currentFrameIndex + 1))] || fromFrame;
  const frameDuration = Math.max(0.001, (toFrame.time || 0) - (fromFrame.time || 0));
  const frameProgress = fromFrame.id === toFrame.id ? 1 : (localTime - (fromFrame.time || 0)) / frameDuration;
  const easedFrameProgress = applyTimelineEasing(frameProgress, clip.easing || "linear");

  translateX = (fromFrame.x || 0) + (((toFrame.x || 0) - (fromFrame.x || 0)) * easedFrameProgress);
  translateY = (fromFrame.y || 0) + (((toFrame.y || 0) - (fromFrame.y || 0)) * easedFrameProgress);
  scaleValue = (fromFrame.scale || 1) + (((toFrame.scale || 1) - (fromFrame.scale || 1)) * easedFrameProgress);
  opacity = (fromFrame.opacity ?? 1) + (((toFrame.opacity ?? 1) - (fromFrame.opacity ?? 1)) * easedFrameProgress);

  if (!suppressBoundaryEffects && clip.entryEffect !== "none" && currentTime <= start + ramp) {
    const progress = (currentTime - start) / ramp;
    applyEffect(clip.entryEffect, progress, false, clip.direction, clip.easing);
  }

  if (!suppressBoundaryEffects && clip.exitEffect !== "none" && currentTime >= end - ramp) {
    const progress = (currentTime - (end - ramp)) / ramp;
    applyEffect(clip.exitEffect, progress, true, clip.direction, clip.easing);
  }

  return {
    opacity: clamp(opacity, 0, 1),
    translateX,
    translateY,
    scale: scaleValue,
  };
}

function getInitialPreviewPhase(activity) {
  if (activity.introScreen?.enabled !== false) return "intro";
  if (activity.settings?.showButtonPackageIntro !== false && activity.buttonPackageScreen?.enabled !== false) return "package";
  if (activity.settings?.showMenuScreen !== false && activity.menuScreen?.enabled !== false) return "menu";
  return "play";
}

function getVariableDefinition(variableDefinitions = [], variableId = "") {
  return variableDefinitions.find(variable => variable.id === variableId) || null;
}

function buildRuntimeVariableMap(variableDefinitions = []) {
  return Object.fromEntries(variableDefinitions.map(variable => [variable.id, castVariableValue(variable.type, variable.value)]));
}

function normalizeRuntimeValue(value) {
  if (typeof value === "boolean" || typeof value === "number") return value;
  const raw = String(value ?? "").trim();
  if (raw === "") return "";
  const lowered = raw.toLowerCase();
  if (["true", "false"].includes(lowered)) return lowered === "true";
  const numeric = Number(raw);
  return Number.isFinite(numeric) && raw !== "" ? numeric : raw;
}

function getRuntimeObjectStateValue(objectStates = {}, hiddenObjectIds = new Set(), objectId = "", stateKey = "visited") {
  if (!objectId) return null;
  if (stateKey === "hidden") return hiddenObjectIds?.has?.(objectId) || false;
  return objectStates?.[objectId]?.[stateKey] ?? false;
}

function evaluateTriggerCondition(condition, context) {
  const { variables = {}, variableDefinitions = [], objectStates = {}, hiddenObjectIds = new Set() } = context;
  const sourceType = condition?.sourceType || "variable";
  const operator = condition?.operator || "eq";
  let left = "";

  if (sourceType === "objectState") {
    left = getRuntimeObjectStateValue(objectStates, hiddenObjectIds, condition?.sourceId || "", condition?.stateKey || "visited");
  } else {
    const variable = getVariableDefinition(variableDefinitions, condition?.sourceId || "");
    left = variable ? castVariableValue(variable.type, variables?.[variable.id]) : variables?.[condition?.sourceId || ""] ?? "";
  }

  const right = normalizeRuntimeValue(condition?.value ?? "");

  if (operator === "truthy") return !!left;
  if (operator === "falsy") return !left;
  if (operator === "contains") return String(left ?? "").toLowerCase().includes(String(right ?? "").toLowerCase());
  if (operator === "eq") return left === right;
  if (operator === "neq") return left !== right;

  const leftNum = Number(left);
  const rightNum = Number(right);
  if (!Number.isFinite(leftNum) || !Number.isFinite(rightNum)) return false;
  if (operator === "gt") return leftNum > rightNum;
  if (operator === "gte") return leftNum >= rightNum;
  if (operator === "lt") return leftNum < rightNum;
  if (operator === "lte") return leftNum <= rightNum;
  return false;
}

function evaluateTriggerConditions(trigger, context) {
  const conditions = Array.isArray(trigger?.conditions) ? trigger.conditions : [];
  if (conditions.length === 0) return true;
  const mode = trigger?.conditionMode === "any" ? "any" : "all";
  return mode === "any"
    ? conditions.some(condition => evaluateTriggerCondition(condition, context))
    : conditions.every(condition => evaluateTriggerCondition(condition, context));
}

function getRuntimeObjectVisualState(objectStates = {}, hiddenObjectIds = new Set(), objectId = "") {
  return {
    visited: !!objectStates?.[objectId]?.visited,
    selected: !!objectStates?.[objectId]?.selected,
    disabled: !!objectStates?.[objectId]?.disabled,
    hidden: hiddenObjectIds?.has?.(objectId) || false,
  };
}

function getTriggerSourceMatches(trigger, objectId) {
  const source = trigger?.target || "Secili Nesne";
  if (objectId === "__activity__") return source === "__activity__" || source === "Sahne" || source === "Secili Nesne";
  return source === objectId || source === "Secili Nesne" || source === "TiklananNesne" || source === "selected";
}

function runPreviewTriggers({
  activity,
  activities,
  objectId,
  when = "onClick",
  onNextActivity,
  onGoToActivity,
  onGoToSlide,
  setActiveLayerId,
  hiddenObjectIds,
  setHiddenObjectIds,
  variables,
  setVariables,
  variableDefinitions,
  objectStates,
  setObjectStates,
}) {
  const triggers = (activity?.triggers || [])
    .filter(trigger => (trigger.when || "onClick") === when && getTriggerSourceMatches(trigger, objectId))
    .filter(trigger => evaluateTriggerConditions(trigger, {
      variables,
      variableDefinitions,
      objectStates,
      hiddenObjectIds,
    }));
  if (triggers.length === 0) return false;

  triggers.forEach(trigger => {
    const action = trigger.action || "Goster";
    const value = trigger.value || "";

    if (action === "SayfaGec") {
      if (value === "__next__") {
        onNextActivity?.();
        return;
      }
      if (activities?.some?.(item => item.id === value)) onGoToActivity?.(value);
      return;
    }

    if (action === "SliderGec") {
      onGoToSlide?.(value || "__next__");
      return;
    }

    if (action === "KatmanaGec") {
      const layerExists = getActivityLayers(activity).some(layer => layer.id === value);
      if (layerExists) setActiveLayerId?.(value);
      return;
    }

    if (action === "Goster") {
      setHiddenObjectIds?.(prev => {
        const next = new Set(prev);
        next.delete(value);
        return next;
      });
      return;
    }

    if (action === "Gizle") {
      setHiddenObjectIds?.(prev => {
        const next = new Set(prev);
        if (value) next.add(value);
        return next;
      });
      return;
    }

    if (action === "DegiskenAta") {
      const variable = getVariableDefinition(variableDefinitions, value);
      if (!variable) return;
      setVariables?.(prev => ({
        ...prev,
        [value]: castVariableValue(variable.type, trigger.extra ?? ""),
      }));
      return;
    }

    if (action === "DegiskenArttir" || action === "DegiskenAzalt") {
      const variable = getVariableDefinition(variableDefinitions, value);
      if (!variable) return;
      const delta = Number(trigger.extra ?? 1) || 1;
      setVariables?.(prev => ({
        ...prev,
        [value]: (Number(prev?.[value] ?? variable.value ?? 0) || 0) + (action === "DegiskenArttir" ? delta : -delta),
      }));
      return;
    }

    if (action === "NesneDurumuAyarla") {
      const stateKey = trigger.stateKey || "visited";
      const nextStateValue = normalizeRuntimeValue(trigger.stateValue ?? "true");
      if (stateKey === "hidden") {
        setHiddenObjectIds?.(prev => {
          const next = new Set(prev);
          if (nextStateValue) next.add(value);
          else next.delete(value);
          return next;
        });
        return;
      }
      setObjectStates?.(prev => ({
        ...prev,
        [value]: {
          ...(prev?.[value] || {}),
          [stateKey]: !!nextStateValue,
        },
      }));
    }
  });

  return true;
}

function RuntimeObjectLayer({ activity, activeLayerId, hiddenObjectIds, objectStates = {}, onRunTriggers, onSelectionChoice, selectedObjectIds = [], hintObjectIds = [], scale, includeDragDrop = false, currentTime = 0 }) {
  const objects = getCanvasObjects(activity, activeLayerId, hiddenObjectIds)
    .filter(obj => isObjectTimelineActive(activity, obj.id, currentTime))
    .filter(obj => obj.visible !== false)
    .filter(obj => includeDragDrop || (obj.type !== "draggable" && obj.type !== "dropzone"))
    .sort((a, b) => a.zIndex - b.zIndex);

  return objects.map(obj => {
    const st = obj.style || {};
    const isImage = !!obj.imageData;
    const runtimeState = getRuntimeObjectVisualState(objectStates, hiddenObjectIds, obj.id);
    const motionStyle = getTimelineMotionStyle(activity, obj.id, currentTime);
    const isSelectionOverlay = !!obj.selectionQuestionId;
    const overlaySelected = isSelectionOverlay && selectedObjectIds.includes(obj.id);
    const hintSelected = hintObjectIds.includes(obj.id);
    const isSelected = runtimeState.selected || overlaySelected;
    const clickable = !runtimeState.disabled && (isSelectionOverlay || (activity.triggers || []).some(trigger => (trigger.when || "onClick") === "onClick" && getTriggerSourceMatches(trigger, obj.id)));
    const hoverable = !runtimeState.disabled && (activity.triggers || []).some(trigger => (trigger.when || "onClick") === "onHover" && getTriggerSourceMatches(trigger, obj.id));

    return (
      <div
        key={obj.id}
        onClick={clickable ? () => {
          if (isSelectionOverlay) {
            onSelectionChoice?.(obj.id);
            return;
          }
          onRunTriggers?.(obj.id, "onClick");
        } : undefined}
        onMouseEnter={hoverable ? () => onRunTriggers?.(obj.id, "onHover") : undefined}
        style={{
          position: "absolute",
          left: obj.x * scale,
          top: obj.y * scale,
          width: obj.width * scale,
          height: obj.height * scale,
          transform: `translate(${motionStyle.translateX * scale}px, ${motionStyle.translateY * scale}px) rotate(${obj.rotation || 0}deg) scale(${motionStyle.scale})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: isImage
            ? "transparent"
            : isSelectionOverlay
              ? (isSelected ? "#e0f2fe" : (st.background || "#f8fbff"))
              : (st.background || "transparent"),
          border: `${obj.type === "hotspot" ? 2 : 1}px ${st.borderStyle || "solid"} ${st.borderColor || "transparent"}`,
          borderRadius: (st.borderRadius || 0) * scale,
          boxSizing: "border-box",
          color: st.color || "#111",
          fontSize: Math.max(10, (st.fontSize || 13) * scale),
          fontWeight: obj.type === "button" ? 700 : 600,
          textAlign: "center",
          padding: isImage ? 0 : `${6 * scale}px`,
          cursor: clickable ? "pointer" : "default",
          pointerEvents: clickable || hoverable ? "auto" : "none",
          opacity: (runtimeState.disabled ? 0.45 : 1) * motionStyle.opacity,
          boxShadow: isSelected
            ? "0 0 0 3px rgba(255,255,255,.55), 0 12px 30px rgba(15,23,42,.18)"
            : hintSelected
              ? "0 0 0 2px rgba(74,222,128,.85), 0 0 0 6px rgba(74,222,128,.16)"
            : clickable ? "0 10px 24px rgba(15,23,42,.16)" : "none",
          filter: runtimeState.visited ? "saturate(1.08)" : "none",
        }}
      >
        {obj.type === "video" && obj.mediaUrl ? (
          <video
            src={obj.mediaUrl}
            controls={obj.showPlayerControls !== false}
            autoPlay={!!obj.autoPlay}
            muted={obj.muted !== false}
            loop={!!obj.loop}
            playsInline
            preload="metadata"
            style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "auto", background: "#020617" }}
          />
        ) : obj.type === "audio" && obj.mediaUrl ? (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", gap: 10, padding: "0 12px", background: "linear-gradient(135deg,#082f49,#0f172a)", color: "#e0f2fe" }}>
            <div style={{ width: 34, height: 34, borderRadius: 999, background: "rgba(56,189,248,.18)", border: "1px solid rgba(56,189,248,.42)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>♪</div>
            <audio
              src={obj.mediaUrl}
              controls={obj.showPlayerControls !== false}
              autoPlay={!!obj.autoPlay}
              muted={obj.muted !== false}
              loop={!!obj.loop}
              preload="metadata"
              style={{ width: "100%" }}
            />
          </div>
        ) : obj.type === "shape" ? (
          <span style={{ pointerEvents: "none" }}>{obj.label || "Sekil"}</span>
        ) : isImage ? (
          <img src={obj.imageData} alt={obj.label || obj.type} style={{ width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none" }} />
        ) : (
          <span
            style={{
              pointerEvents: "none",
              fontWeight: isSelectionOverlay ? 800 : undefined,
              fontSize: isSelectionOverlay ? Math.max(18, (st.fontSize || 13) * scale) : undefined,
              color: isSelectionOverlay
                ? (isSelected ? "#16a34a" : "rgba(37,99,235,.18)")
                : (st.color || "#111"),
            }}
          >
            {isSelectionOverlay ? "✓" : (obj.label || obj.type)}
          </span>
        )}
      </div>
    );
  });
}

function getDragDropAssignments(activity) {
  const canvasObjects = getCanvasObjects(activity);
  const drags = canvasObjects.filter(o => o.type === "draggable");
  const drops = canvasObjects.filter(o => o.type === "dropzone");
  const freeDrops = [...drops];
  return drags.map((drag, index) => {
    let drop = null;
    if (drag.group) drop = freeDrops.find(z => z.group && z.group === drag.group) || null;
    if (!drop && drag.label) drop = freeDrops.find(z => z.label && z.label === drag.label) || null;
    if (!drop) drop = freeDrops[index] || null;
    if (drop) freeDrops.splice(freeDrops.indexOf(drop), 1);
    return drop ? { drag, drop } : null;
  }).filter(Boolean);
}

function getAutoAnswerSummary(activity) {
  if (activity.type === "drag-drop" || activity.type === "mixed") {
    const pairs = getDragDropAssignments(activity).map(({ drag, drop }) => `${drag.label || "Surukle"} → ${drop.label || "Birak"}`);
    return pairs.length ? pairs : ["Dogru eslesme henuz olusmadi."];
  }
  if (Array.isArray(activity.selectionSlots) && activity.selectionSlots.length) {
    const labels = activity.selectionSlots.map((slot, index) => {
      if (!slot?.correctChoice) return `${index + 1}. soru: anahtar okunamadi`;
      return `${index + 1}. soru: ${slot.correctLabel || String(slot.correctChoice).toUpperCase()}`;
    });
    return labels.length ? labels : ["Dogru secenek henuz tanimlanmadi."];
  }
  const labels = (activity.mcOptions || []).filter(o => o.isCorrect).map(o => o.label || "Secenek");
  return labels.length ? [labels.join(", ")] : ["Dogru secenek henuz tanimlanmadi."];
}

function getCorrectSelectionIds(activity) {
  return (activity.mcOptions || []).filter(o => o.isCorrect).map(o => o.id);
}

function layoutDragPositionsForMatches(activity, matches = {}) {
  const canvasObjects = getCanvasObjects(activity);
  const drags = canvasObjects.filter(o => o.type === "draggable");
  const drops = canvasObjects.filter(o => o.type === "dropzone");
  const dragById = Object.fromEntries(drags.map(d => [d.id, d]));
  const dropById = Object.fromEntries(drops.map(dz => [dz.id, dz]));
  const grouped = {};

  Object.entries(matches || {}).forEach(([dragId, dropId]) => {
    if (!dragById[dragId] || !dropById[dropId]) return;
    grouped[dropId] = grouped[dropId] || [];
    grouped[dropId].push(dragId);
  });

  const positioned = {};

  Object.entries(grouped).forEach(([dropId, dragIds]) => {
    const drop = dropById[dropId];
    const count = dragIds.length;
    if (!drop || count === 0) return;

    const cols = count === 1 ? 1 : count === 2 ? 2 : Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    const cellWidth = drop.width / cols;
    const cellHeight = drop.height / rows;
    const padding = Math.max(6, Math.min(drop.width, drop.height) * 0.05);

    dragIds.forEach((dragId, index) => {
      const drag = dragById[dragId];
      if (!drag) return;

      const col = index % cols;
      const row = Math.floor(index / cols);
      const slotX = drop.x + (col * cellWidth);
      const slotY = drop.y + (row * cellHeight);
      const maxX = drop.x + drop.width - drag.width - padding;
      const maxY = drop.y + drop.height - drag.height - padding;
      const targetX = slotX + ((cellWidth - drag.width) / 2);
      const targetY = slotY + ((cellHeight - drag.height) / 2);

      positioned[dragId] = {
        x: Math.max(drop.x + padding, Math.min(targetX, maxX)),
        y: Math.max(drop.y + padding, Math.min(targetY, maxY)),
      };
    });
  });

  return positioned;
}

function buildAutoDragMatches(activity) {
  return Object.fromEntries(
    getDragDropAssignments(activity).map(({ drag, drop }) => [drag.id, drop.id]),
  );
}

function getCorrectDragPositions(activity, matches = getCorrectDragMatches(activity)) {
  return layoutDragPositionsForMatches(activity, matches);
}

function getCorrectDragMatches(activity) {
  // Use explicit match table if set
  const explicit = activity.dragDropMatches || {};
  const drags = getCanvasObjects(activity).filter(o => o.type === "draggable");
  const hasExplicit = drags.some(d => explicit[d.id]);
  if (hasExplicit) return explicit;
  // Fall back to auto-assignment
  return buildAutoDragMatches(activity);
}

function ButtonPackageShowcase({ pkgId }) {
  const pkg = BUTTON_PACKAGES.find(item => item.id === pkgId) || BUTTON_PACKAGES[0];
  const samples = BUTTON_PACKAGES.slice(0, 6);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ width: 12, height: 12, borderRadius: "50%", background: pkg.color, boxShadow: `0 0 0 6px ${pkg.color}22` }} />
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>{pkg.name}</div>
          <div style={{ fontSize: 12, color: "#cbd5e1" }}>{pkg.trigger} odakli {pkg.anim.toLowerCase()} davranisi</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
        {samples.map(sample => (
          <div key={sample.id} style={{ border: `1px solid ${sample.color}55`, background: `${sample.color}18`, borderRadius: 18, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: sample.color }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>{sample.name}</span>
            </div>
            <div style={{ fontSize: 11, color: "#cbd5e1", marginBottom: 12 }}>{sample.trigger} · {sample.anim}</div>
            <button style={{ width: "100%", padding: "10px 12px", borderRadius: 999, border: `1px solid ${sample.color}`, background: sample.color + "22", color: sample.color, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              Öğrenci Buton Ornegi
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ButtonPackageIntroDiagram({ pkgId, config = {} }) {
  const pkg = BUTTON_PACKAGES.find(item => item.id === pkgId) || BUTTON_PACKAGES[0];
  const theme = getPackageTheme(pkg.id);
  const accent = theme.accent || pkg.color;
  const rows = resolveThemePackageItems(config);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "12px 14px", borderRadius: 18, background: `linear-gradient(135deg,${accent}18,rgba(255,255,255,.96))`, border: `1px solid ${accent}33` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <div style={{ width: 42, height: 42, borderRadius: 14, display: "grid", placeItems: "center", background: theme.button, color: theme.text, fontSize: 20, fontWeight: 900, boxShadow: `0 10px 20px ${accent}22` }}>
            {pkg.icon || "🎨"}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginBottom: 2 }}>Tema Paketi Önizlemesi</div>
            <div style={{ fontSize: 13, lineHeight: 1.55, color: "#475569" }}>{pkg.name} · {pkg.desc}</div>
          </div>
        </div>
        <span style={{ fontSize: 10, fontWeight: 800, color: accent, background: `${accent}14`, border: `1px solid ${accent}30`, borderRadius: 999, padding: "5px 9px" }}>
          {pkg.trigger} · {pkg.anim}
        </span>
      </div>

      <div style={{ background: "linear-gradient(180deg,#f8fafc,#eef4ff)", borderRadius: 24, padding: 14, boxShadow: "inset 0 0 0 1px rgba(148,163,184,.24)", overflow: "hidden" }}>
        <div style={{ fontSize: 12, lineHeight: 1.55, color: "#475569", marginBottom: 10 }}>
          Seçtiğin tema paketi aşağıdaki tüm butonları birlikte günceller:
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
          {rows.map(item => (
            <div key={item.id} style={{ display: "flex", flexDirection: "column", gap: 8, padding: "10px 12px", borderRadius: 16, background: "#ffffff", border: `1px solid ${accent}22`, boxShadow: "0 6px 18px rgba(15,23,42,.05)" }}>
              <div style={{ minHeight: 42, borderRadius: theme.radius || 999, background: theme.button, color: theme.text, display: "flex", alignItems: "center", gap: 8, padding: "0 12px", fontSize: 12, fontWeight: 900, overflow: "hidden", boxShadow: `0 10px 24px ${accent}22` }}>
                <span style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0, background: "rgba(255,255,255,.94)", color: accent, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 900 }}>{item.icon}</span>
                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
              </div>
              <div style={{ minWidth: 0, padding: "8px 10px", borderRadius: 12, background: `${accent}12`, border: `1px solid ${accent}24`, color: "#334155", fontSize: 12, lineHeight: 1.45 }}>
                {item.desc}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
// ─── Preview: Sürükle-Bırak ───────────────────────────────────────────────────

function PreviewDragDrop({ activity }) {
  const stageRef = useRef(null);
  const dragging = useRef(null);
  const activeHandlersRef = useRef(null);
  const [positions, setPositions] = useState({});
  const [matched, setMatched] = useState({});
  const [hoveredDropId, setHoveredDropId] = useState(null);
  const canvasObjects = getCanvasObjects(activity);
  const drags = canvasObjects.filter(o => o.type === "draggable");
  const drops = canvasObjects.filter(o => o.type === "dropzone");
  const scale = useMemo(() => {
    const sw = activity.stageWidth || 1920, sh = activity.stageHeight || 1080;
    return Math.min(1, 960 / sw, 540 / sh);
  }, [activity.stageWidth, activity.stageHeight]);
  const toStage = useCallback((cx, cy) => {
    const r = stageRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return { x: (cx - r.left) / scale, y: (cy - r.top) / scale };
  }, [scale]);

  // Cleanup listeners on unmount
  useEffect(() => {
    return () => {
      if (activeHandlersRef.current) {
        window.removeEventListener("pointermove", activeHandlersRef.current.move);
        window.removeEventListener("pointerup", activeHandlersRef.current.up);
        activeHandlersRef.current = null;
      }
    };
  }, []);

  const handleDown = useCallback((e, id) => {
    if (matched[id]) return;
    e.preventDefault();
    e.currentTarget?.setPointerCapture?.(e.pointerId);
    const startPt = toStage(e.clientX, e.clientY);
    // Get current pos at drag start - don't use stale state closure
    setPositions(prev => {
      const cp = prev[id] || (() => { const d = drags.find(x => x.id === id); return d ? { x: d.x, y: d.y } : { x: 0, y: 0 }; })();
      dragging.current = { id, ox: startPt.x - cp.x, oy: startPt.y - cp.y, startPos: cp, currentPos: cp };
      return prev;
    });

    const onMove = (me) => {
      if (!dragging.current) return;
      const pt = toStage(me.clientX, me.clientY);
      const { id: dragId, ox, oy } = dragging.current;
      const nx = pt.x - ox, ny = pt.y - oy;
      dragging.current.currentPos = { x: nx, y: ny };
      setPositions(prev => ({ ...prev, [dragId]: { x: nx, y: ny } }));
      // Highlight hovered drop zone
      const d = drags.find(x => x.id === dragId);
      const cx = nx + (d?.width || 0) / 2, cy = ny + (d?.height || 0) / 2;
      const hovered = drops.find(dz => cx >= dz.x && cx <= dz.x + dz.width && cy >= dz.y && cy <= dz.y + dz.height);
      setHoveredDropId(hovered?.id || null);
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      activeHandlersRef.current = null;
      if (!dragging.current) return;
      const { id: dragId, startPos, currentPos } = dragging.current;
      const p = currentPos || startPos;
      const d = drags.find(x => x.id === dragId);
      let matchedDz = null;
      for (const dz of drops) {
        const cx = p.x + (d?.width || 0) / 2, cy = p.y + (d?.height || 0) / 2;
        if (cx >= dz.x && cx <= dz.x + dz.width && cy >= dz.y && cy <= dz.y + dz.height) {
          const ok = !d?.group || d.group === dz.group;
          if (ok) matchedDz = dz;
          break;
        }
      }
      if (matchedDz) {
        setMatched(prev => ({ ...prev, [dragId]: matchedDz.id }));
        setPositions(prev => ({ ...prev, [dragId]: {
          x: matchedDz.x + (matchedDz.width - (d?.width || 0)) / 2,
          y: matchedDz.y + (matchedDz.height - (d?.height || 0)) / 2,
        } }));
      } else {
        // Return to original position on wrong/no drop
        setPositions(prev => ({ ...prev, [dragId]: startPos }));
      }
      dragging.current = null;
      setHoveredDropId(null);
    };

    activeHandlersRef.current = { move: onMove, up: onUp };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [matched, drags, drops, toStage]);

  const allMatched = drags.length > 0 && drags.every(d => matched[d.id]);
  const vw = Math.round((activity.stageWidth || 1920) * scale);
  const vh = Math.round((activity.stageHeight || 1080) * scale);
  return (
    <div style={{ position: "relative" }}>
      <div ref={stageRef} style={{ width: vw, height: vh, position: "relative", background: activity.backgroundColor || "#fff", borderRadius: 8, overflow: "hidden", margin: "0 auto" }}>
        {activity.svgMarkup && <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }} dangerouslySetInnerHTML={{ __html: activity.svgMarkup }} />}
        {drops.map(dz => {
          const isMatched = Object.values(matched).includes(dz.id);
          const isHovered = !isMatched && hoveredDropId === dz.id;
          return (
            <div key={dz.id} style={{ position: "absolute", left: dz.x * scale, top: dz.y * scale, width: dz.width * scale, height: dz.height * scale, border: `2px dashed ${isMatched ? "#4ade80" : isHovered ? "#a78bfa" : (dz.style?.borderColor || "#f97316")}`, background: isMatched ? "rgba(74,222,128,.15)" : isHovered ? "rgba(167,139,250,.15)" : (dz.style?.background || "#fed7aa"), borderRadius: (dz.style?.borderRadius || 8) * scale, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 * scale, color: isMatched ? "#22c55e" : isHovered ? "#7c3aed" : (dz.style?.color || "#9a3412"), fontWeight: 700, transition: "border-color .12s, background .12s", zIndex: 1 }}>
              {!isMatched && (dz.label || "Bırak")}
            </div>
          );
        })}
        {drags.map(d => {
          const p = positions[d.id] || { x: d.x, y: d.y };
          const m = matched[d.id];
          const isDragging = dragging.current?.id === d.id;
          return (
            <div key={d.id} onPointerDown={(e) => handleDown(e, d.id)} style={{ position: "absolute", left: p.x * scale, top: p.y * scale, width: d.width * scale, height: d.height * scale, background: m ? "rgba(74,222,128,.25)" : (d.style?.background || "#dbeafe"), border: `2px solid ${m ? "#4ade80" : (d.style?.borderColor || "#2563eb")}`, borderRadius: (d.style?.borderRadius || 8) * scale, cursor: m ? "default" : isDragging ? "grabbing" : "grab", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 * scale, color: m ? "#15803d" : (d.style?.color || "#1e40af"), fontWeight: 700, userSelect: "none", zIndex: isDragging ? 100 : 2, transition: isDragging ? "none" : "left .18s, top .18s", touchAction: "none", boxShadow: isDragging ? "0 8px 24px rgba(0,0,0,.25)" : "none" }}>
              {d.label || "Sürükle"}
            </div>
          );
        })}
      </div>
      {allMatched && <div style={{ textAlign: "center", marginTop: 16, padding: "10px 24px", borderRadius: 10, background: "#4CAF50dd", color: "#fff", fontSize: 15, fontWeight: 700 }}>✅ Tebrikler! Tümü doğru yerleştirildi.</div>}
    </div>
  );
}

// ─── Preview: Seçim ───────────────────────────────────────────────────────────

function PreviewSelection({ activity }) {
  const [sel, setSel] = useState([]);
  const [done, setDone] = useState(false);
  const opts = activity.mcOptions || [];
  const multi = activity.mcMode === "multi";
  const toggle = (id) => { if (done) return; setSel(multi ? (sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id]) : [id]); };
  const correct = done && (() => { const c = opts.filter(o => o.isCorrect).map(o => o.id); return multi ? c.length === sel.length && c.every(x => sel.includes(x)) : sel.length === 1 && c.includes(sel[0]); })();
  return (
    <div style={{ maxWidth: 540, margin: "0 auto", padding: 24 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: "#E0E0E0", marginBottom: 16 }}>{activity.mcQuestion || "Soru metni girilmemiş"}</h2>
      <p style={{ fontSize: 12, color: "#78909C", marginBottom: 20 }}>{multi ? "Birden fazla seçenek işaretleyebilirsiniz" : "Tek seçenek işaretleyiniz"}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {opts.map(o => {
          const s = sel.includes(o.id), crt = done && o.isCorrect, wrg = done && s && !o.isCorrect;
          return (
            <button key={o.id} onClick={() => toggle(o.id)} style={{ padding: "12px 16px", borderRadius: 10, border: `2px solid ${crt ? "#4CAF50" : wrg ? "#f44336" : s ? "#7C4DFF" : "#333"}`, background: crt ? "#4CAF5022" : wrg ? "#f4433622" : s ? "#7C4DFF22" : "#1a1a30", color: "#E0E0E0", textAlign: "left", cursor: done ? "default" : "pointer", fontSize: 13, transition: "all .15s" }}>
              {o.label || "Seçenek"}
            </button>
          );
        })}
      </div>
      {!done
        ? <button onClick={() => setDone(true)} style={{ marginTop: 20, padding: "10px 32px", borderRadius: 8, border: "none", background: "#7C4DFF", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Kontrol Et</button>
        : <div style={{ marginTop: 16, padding: "12px 20px", borderRadius: 10, background: correct ? "#4CAF5033" : "#f4433633", color: correct ? "#4CAF50" : "#f44336", fontSize: 14, fontWeight: 700, display: "flex", gap: 12, alignItems: "center" }}>
            {correct ? "✅ Doğru!" : "❌ Yanlış!"}
            {!correct && <button onClick={() => { setDone(false); setSel([]); }} style={{ fontSize: 11, padding: "4px 12px", borderRadius: 6, border: "1px solid #f44336", background: "transparent", color: "#f44336", cursor: "pointer" }}>Tekrar</button>}
          </div>}
    </div>
  );
}

function PreviewDebugOverlay({ theme, data, onClose }) {
  if (!data) return null;
  const pretty = (value) => {
    if (value === null || value === undefined) return "yok";
    if (typeof value === "string") return value;
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  };
  const rows = [
    ["Asama", data.phase],
    ["Etkinlik", data.activityName],
    ["Slider", data.slideName || data.slideId],
    ["Katman", data.activeLayerId],
    ["Deneme", data.attempts],
    ["Secimler", data.selectionLabels],
    ["Eslesmeler", data.matchLabels],
    ["Gizli Nesneler", data.hiddenObjectIds],
    ["Nesne State", data.objectStates],
    ["Degiskenler", data.variables],
  ];
  return (
    <div style={{ position: "fixed", right: 18, bottom: 18, width: 360, maxWidth: "calc(100vw - 32px)", maxHeight: "min(72vh, 760px)", overflow: "auto", zIndex: 60, borderRadius: 22, border: `1px solid ${theme.border}55`, background: "rgba(15,23,42,.92)", color: "#e2e8f0", boxShadow: "0 30px 80px rgba(15,23,42,.42), inset 0 1px 0 rgba(255,255,255,.06)", backdropFilter: "blur(16px)" }}>
      <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(148,163,184,.18)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, position: "sticky", top: 0, background: "rgba(15,23,42,.96)", backdropFilter: "blur(16px)" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.7, textTransform: "uppercase", color: "#67e8f9" }}>Debug Overlay</div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>Preview state ve runtime degiskenleri</div>
        </div>
        <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 999, border: "1px solid rgba(148,163,184,.24)", background: "rgba(255,255,255,.06)", color: "#e2e8f0", cursor: "pointer", fontSize: 12, fontWeight: 800 }}>×</button>
      </div>
      <div style={{ padding: 16, display: "grid", gap: 12 }}>
        {rows.map(([label, value]) => (
          <div key={label} style={{ borderRadius: 16, border: "1px solid rgba(148,163,184,.12)", background: "rgba(255,255,255,.03)", padding: "10px 12px" }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase", color: "#7dd3fc", marginBottom: 6 }}>{label}</div>
            <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "Consolas, monospace", fontSize: 11, lineHeight: 1.55, color: "#e2e8f0" }}>{pretty(value)}</pre>
          </div>
        ))}
      </div>
    </div>
  );
}

function PreviewPlayer({ activity, activities, variables = [] }) {
  const [currentId, setCurrentId] = useState(activity?.id || null);
  const [runtimeVariables, setRuntimeVariables] = useState(() => buildRuntimeVariableMap(variables));
  const [debugOpen, setDebugOpen] = useState(false);
  const [developerHintMode, setDeveloperHintMode] = useState(false);
  const [flowPhase, setFlowPhase] = useState(getInitialPreviewPhase(activity || {}));
  const [flowDebugData, setFlowDebugData] = useState(null);
  const [previewCommand, setPreviewCommand] = useState(null);
  const normalizedActivities = useMemo(
    () => activities.map(item => normalizeActivity(item)),
    [activities],
  );
  const [activitySlideMap, setActivitySlideMap] = useState(() => Object.fromEntries(
    normalizedActivities.map(item => [item.id, item.currentSlideId]),
  ));

  useEffect(() => {
    setCurrentId(activity?.id || null);
  }, [activity?.id]);

  useEffect(() => {
    if (!activity?.id) return;
    const normalized = normalizeActivity(activity);
    setActivitySlideMap(prev => ({
      ...prev,
      [normalized.id]: normalized.currentSlideId,
    }));
  }, [activity?.id, activity?.currentSlideId]);

  useEffect(() => {
    setRuntimeVariables(buildRuntimeVariableMap(variables));
  }, [variables]);

  useEffect(() => {
    setActivitySlideMap(prev => {
      const next = { ...prev };
      normalizedActivities.forEach(item => {
        if (!next[item.id]) next[item.id] = item.currentSlideId;
      });
      return next;
    });
  }, [normalizedActivities]);

  const currentRawActivity = useMemo(
    () => normalizedActivities.find(item => item.id === currentId) || normalizeActivity(activity || {}),
    [normalizedActivities, activity, currentId],
  );
  const currentSlideId = activitySlideMap[currentRawActivity?.id] || currentRawActivity?.currentSlideId;
  const currentActivity = useMemo(
    () => (currentRawActivity ? materializeActivitySlide(currentRawActivity, currentSlideId) : null),
    [currentRawActivity, currentSlideId],
  );
  const currentTheme = useMemo(
    () => getPackageTheme(currentActivity?.buttonPackageId),
    [currentActivity?.buttonPackageId],
  );

  const nextSlideId = getAdjacentActivitySlideId(currentRawActivity, 1);
  const hasNextActivity = !!currentActivity?.nextActivityId;
  const hasNextStep = !!nextSlideId || hasNextActivity;
  const nextStepLabel = nextSlideId ? "Sonraki Slider" : "Sonraki Soru";

  const handleNextActivity = useCallback(() => {
    if (!currentActivity?.nextActivityId) return;
    setCurrentId(currentActivity.nextActivityId);
  }, [currentActivity]);

  const handleGoToActivity = useCallback((activityId) => {
    if (!activityId) return;
    setCurrentId(activityId);
  }, []);

  const handleGoToSlide = useCallback((slideValue) => {
    if (!currentRawActivity?.id) return;
    const target = getActivitySlideTarget(currentRawActivity, slideValue || "__next__");
    if (!target) return;
    setActivitySlideMap(prev => ({
      ...prev,
      [currentRawActivity.id]: target.id,
    }));
  }, [currentRawActivity]);

  const handleNextStep = useCallback(() => {
    if (nextSlideId) {
      handleGoToSlide(nextSlideId);
      return;
    }
    handleNextActivity();
  }, [handleGoToSlide, handleNextActivity, nextSlideId]);

  useEffect(() => {
    setFlowDebugData(null);
  }, [currentActivity?.id, currentSlideId]);

  if (!currentActivity) return null;

  const currentSettings = { ...DEFAULT_ACTIVITY_SETTINGS, ...(currentActivity.settings || {}) };
  const quickPhases = [
    { id: "intro", label: "Tanitim" },
    ...(currentSettings.showButtonPackageIntro !== false && currentActivity.buttonPackageScreen?.enabled !== false ? [{ id: "package", label: "Tema" }] : []),
    ...(currentSettings.showMenuScreen !== false && currentActivity.menuScreen?.enabled !== false ? [{ id: "menu", label: "Menu" }] : []),
    { id: "play", label: "Oyun" },
  ];
  const devicePresets = [
    { id: "desktop", label: "Masaustu", icon: "â–­", width: "100%", height: "100%", radius: 16 },
    { id: "tablet", label: "Tablet", icon: "â–¯", width: 900, height: 680, radius: 24 },
    { id: "mobile", label: "Mobil", icon: "â–®", width: 430, height: 760, radius: 36 },
  ];
  const [devicePreset, setDevicePreset] = useState("desktop");

  const dispatchPreviewCommand = (action, phase = null) => {
    setPreviewCommand({
      token: Date.now() + Math.random(),
      action,
      phase,
      activityId: currentActivity.id,
    });
  };
  const debugData = {
    activityName: currentActivity.name,
    activityId: currentActivity.id,
    slideId: currentSlideId,
    slideName: getActivitySlides(currentRawActivity).find(slide => slide.id === currentSlideId)?.name || currentSlideId,
    phase: flowPhase,
    variables: runtimeVariables,
    ...flowDebugData,
  };
  const toolbarBtn = (active) => ({
    minHeight: 34,
    padding: "0 12px",
    borderRadius: 999,
    border: `1px solid ${active ? currentTheme.border : "rgba(255,255,255,.14)"}`,
    background: active ? currentTheme.button : "rgba(255,255,255,.06)",
    color: active ? currentTheme.text : "rgba(255,255,255,.82)",
    fontSize: 11,
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: active ? `0 10px 24px ${currentTheme.border}33` : "none",
    display: "flex",
    alignItems: "center",
    gap: 6
  });

  const currentDevicePreset = devicePresets.find(item => item.id === devicePreset) || devicePresets[0];
  const previewViewport = useMemo(() => (
    currentDevicePreset.id === "desktop"
      ? { width: 1200, height: 760 }
      : {
        width: (typeof currentDevicePreset.width === "number" ? currentDevicePreset.width : 900) - 16,
        height: (typeof currentDevicePreset.height === "number" ? currentDevicePreset.height : 680) - 16,
      }
  ), [currentDevicePreset]);

  const flow = currentActivity.type === "drag-drop" || currentActivity.type === "mixed"
    ? <PreviewDragDropFlow activity={currentActivity} activities={normalizedActivities} hasNextActivity={hasNextActivity} hasNextStep={hasNextStep} nextStepLabel={nextStepLabel} onNextActivity={handleNextActivity} onNextStep={handleNextStep} onGoToActivity={handleGoToActivity} onGoToSlide={handleGoToSlide} variableDefinitions={variables} runtimeVariables={runtimeVariables} setRuntimeVariables={setRuntimeVariables} previewCommand={previewCommand} developerHintMode={developerHintMode} onPhaseChange={setFlowPhase} onDebugDataChange={setFlowDebugData} previewViewport={previewViewport} />
    : <PreviewSelectionFlow activity={currentActivity} activities={normalizedActivities} hasNextActivity={hasNextActivity} hasNextStep={hasNextStep} nextStepLabel={nextStepLabel} onNextActivity={handleNextActivity} onNextStep={handleNextStep} onGoToActivity={handleGoToActivity} onGoToSlide={handleGoToSlide} variableDefinitions={variables} runtimeVariables={runtimeVariables} setRuntimeVariables={setRuntimeVariables} previewCommand={previewCommand} developerHintMode={developerHintMode} onPhaseChange={setFlowPhase} onDebugDataChange={setFlowDebugData} previewViewport={previewViewport} />;

  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: "100%", height: "100%", minHeight: 0, overflow: "hidden", background: "transparent" }}>
      <div style={{ width: "100%", margin: "0 auto", padding: 14, borderRadius: 22, background: "rgba(15,23,42,.78)", border: `1px solid ${currentTheme.border}33`, boxShadow: "0 20px 50px rgba(15,23,42,.28)", backdropFilter: "blur(14px)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap", flexShrink: 0 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase", color: "#7dd3fc" }}>Preview Kontrolleri</div>
          <div style={{ fontSize: 12, color: "#cbd5e1" }}>Cihaz secin ve akisi test edin.</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(0,0,0,0.2)", padding: 4, borderRadius: 12 }}>
            {devicePresets.map(item => (
                <button key={item.id} onClick={() => setDevicePreset(item.id)} style={{ ...toolbarBtn(devicePreset === item.id), minHeight: 28, padding: "0 10px", fontSize: 10, border: "none", boxShadow: "none" }}>
                    <span>{item.icon}</span> {item.label}
                </button>
            ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {quickPhases.map(item => (
            <button key={item.id} onClick={() => dispatchPreviewCommand("jump", item.id)} style={toolbarBtn(flowPhase === item.id)}>
              {item.label}
            </button>
          ))}
          <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.1)", margin: "0 4px" }} />
          <button onClick={() => dispatchPreviewCommand("reset")} style={toolbarBtn(false)}>Bastan</button>
          <button onClick={() => setDeveloperHintMode(value => !value)} style={toolbarBtn(developerHintMode)}>
            {developerHintMode ? "Ipucu Acik" : "Ipucu Modu"}
          </button>
          <button onClick={() => setDebugOpen(value => !value)} style={toolbarBtn(debugOpen)}>
            {debugOpen ? "Debug Acik" : "Debug"}
          </button>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "stretch", justifyContent: "center", padding: "0 8px 8px" }}>
        <div style={{ 
          width: currentDevicePreset.width, 
          height: currentDevicePreset.height, 
          maxWidth: "100%", 
          maxHeight: "100%", 
          borderRadius: currentDevicePreset.radius, 
          background: "linear-gradient(180deg,#081120 0%,#0f172a 100%)", 
          overflow: "hidden", 
          boxShadow: devicePreset === "desktop" ? "none" : "0 25px 50px -12px rgba(0, 0, 0, 0.5)", 
          position: "relative",
          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          border: devicePreset === "desktop" ? "none" : "8px solid #0f172a"
        }}>
          {devicePreset !== "desktop" && (
            <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: devicePreset === "mobile" ? 120 : 0, height: 24, background: "#0f172a", borderBottomLeftRadius: 16, borderBottomRightRadius: 16, zIndex: 50 }} />
          )}
          <div style={{ width: "100%", height: "100%", overflow: "hidden", position: "relative" }}>
            {flow}
          </div>
        </div>
      </div>

      {debugOpen && <PreviewDebugOverlay theme={currentTheme} data={debugData} onClose={() => setDebugOpen(false)} />}
    </div>
  );
}

function TimelinePreviewControls({ duration = 0, currentTime = 0, isPlaying = false, onToggle, onReset, onSeek, theme }) {
  if (duration <= 0) return null;
  return (
    <div style={{ marginTop: 14, padding: 12, borderRadius: 18, background: theme.panel, border: `1px solid ${theme.border}44`, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <button onClick={onToggle} style={{ padding: "8px 14px", borderRadius: 999, border: `1px solid ${theme.border}`, background: theme.button, color: theme.text, cursor: "pointer", fontSize: 11, fontWeight: 800 }}>
        {isPlaying ? "Duraklat" : "Oynat"}
      </button>
      <button onClick={onReset} style={{ padding: "8px 12px", borderRadius: 999, border: `1px solid ${theme.border}55`, background: theme.panel, color: theme.text, cursor: "pointer", fontSize: 11, fontWeight: 700 }}>
        Basa Don
      </button>
      <div style={{ minWidth: 92, fontSize: 11, color: theme.text, fontWeight: 700 }}>
        {currentTime.toFixed(1)}s / {duration.toFixed(1)}s
      </div>
      <input type="range" min={0} max={duration} step={0.1} value={Math.min(currentTime, duration)} onChange={e => onSeek?.(Number(e.target.value))} style={{ flex: 1, minWidth: 180, accentColor: theme.border }} />
    </div>
  );
}

function PreviewSelectionFlow({ activity, activities, hasNextActivity = false, hasNextStep = false, nextStepLabel = "Sonraki Soru", onNextActivity, onNextStep, onGoToActivity, onGoToSlide, variableDefinitions = [], runtimeVariables = {}, setRuntimeVariables, previewCommand = null, developerHintMode = false, onPhaseChange = () => {}, onDebugDataChange = () => {}, previewViewport = null }) {
  const [sel, setSel] = useState([]);
  const [submittedSelection, setSubmittedSelection] = useState([]);
  const [phase, setPhase] = useState(getInitialPreviewPhase(activity));
  const [result, setResult] = useState(null);
  const [checking, setChecking] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [activeLayerId, setActiveLayerId] = useState(activity.activeLayerId || "base");
  const [hiddenObjectIds, setHiddenObjectIds] = useState(() => new Set());
  const [objectStates, setObjectStates] = useState({});
  const [timelineTime, setTimelineTime] = useState(0);
  const [timelinePlaying, setTimelinePlaying] = useState(false);
  const [windowWidth, setWindowWidth] = useState(() => (typeof window !== "undefined" ? window.innerWidth : 1280));
  const opts = activity.mcOptions || [];
  const multi = activity.mcMode === "multi";
  const settings = { ...DEFAULT_ACTIVITY_SETTINGS, ...(activity.settings || {}) };
  const intro = activity.introScreen || {};
  const packageScreen = activity.buttonPackageScreen || {};
  const menuScreen = activity.menuScreen || {};
  const playScreen = activity.playScreen || {};
  const resultScreens = activity.resultScreens || {};
  const results = resultScreens;
  const answerScreen = activity.answerScreen || {};
  const theme = getPackageTheme(activity.buttonPackageId);
  const packageTitle = !packageScreen.title || /buton paketi/i.test(packageScreen.title) ? "Tema Paketi Tanıtımı" : packageScreen.title;
  const packageBody = !packageScreen.body || /buton.*davran/i.test(packageScreen.body) ? "Etkinlikte kullanacağın tema paketini ve buton davranışlarını önce incele." : packageScreen.body;
  const isBookPreview = activity.type === "book-preview";
  const autoAnswer = getAutoAnswerSummary(activity);
  const runtimePreviewTime = 0;
  const stageSelectionObjects = useMemo(
    () => getCanvasObjects(activity, activeLayerId, hiddenObjectIds)
      .filter(obj => obj.visible !== false)
      .filter(obj => !!obj.selectionQuestionId)
      .filter(obj => isObjectTimelineActive(activity, obj.id, runtimePreviewTime)),
    [activity, activeLayerId, hiddenObjectIds, runtimePreviewTime],
  );
  const stageSelectionGroups = useMemo(
    () => [...new Set(stageSelectionObjects.map(obj => obj.selectionQuestionId).filter(Boolean))],
    [stageSelectionObjects],
  );
  const stageSelectionChoicesByQuestion = useMemo(
    () => Object.fromEntries(stageSelectionGroups.map((questionId) => [
      questionId,
      stageSelectionObjects.filter(obj => obj.selectionQuestionId === questionId),
    ])),
    [stageSelectionGroups, stageSelectionObjects],
  );
  const usesStageSelection = stageSelectionObjects.length > 0;
  const hasSelectionAnswerKey = !usesStageSelection || stageSelectionGroups.every((questionId) =>
    stageSelectionObjects.some(obj => obj.selectionQuestionId === questionId && typeof obj.selectionCorrect === "boolean"),
  );
  const previousActivityIdRef = useRef(activity?.id || null);
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const viewportWidth = previewViewport?.width || windowWidth;
  const viewportHeight = previewViewport?.height || (typeof window !== "undefined" ? window.innerHeight : 860);

  useEffect(() => {
    onPhaseChange?.(phase);
  }, [onPhaseChange, phase]);

  useEffect(() => {
    const sameActivity = previousActivityIdRef.current === activity.id;
    previousActivityIdRef.current = activity.id;
    setSel([]);
    setSubmittedSelection([]);
    setResult(null);
    setAttempts(0);
    setChecking(false);
    setPhase(sameActivity ? "play" : getInitialPreviewPhase(activity));
    setActiveLayerId(activity.activeLayerId || "base");
    setHiddenObjectIds(new Set());
    setObjectStates({});
    setTimelineTime(0);
    setTimelinePlaying(false);
  }, [activity.id, activity.currentSlideId]);
  useEffect(() => {
    setTimelinePlaying(false);
  }, [phase, activity.id, checking]);
  useEffect(() => {
    if (!previewCommand || previewCommand.activityId !== activity.id) return;
    const targetPhase = previewCommand.action === "reset"
      ? getInitialPreviewPhase(activity)
      : (previewCommand.phase || "play");
    setSel([]);
    setSubmittedSelection([]);
    setResult(null);
    setAttempts(0);
    setChecking(false);
    setActiveLayerId(activity.activeLayerId || "base");
    setHiddenObjectIds(new Set());
    setObjectStates({});
    setTimelineTime(0);
    setTimelinePlaying(false);
    setPhase(targetPhase);
  }, [activity.activeLayerId, activity.id, activity.currentSlideId, previewCommand]);
  const viewOptions = useMemo(() => { const source = opts.map(o => ({ ...o })); return settings.shuffleOptions ? shuffleArray(source) : source; }, [opts, settings.shuffleOptions, attempts]);
  const selectedLabels = usesStageSelection
    ? sel.map(id => stageSelectionObjects.find(obj => obj.id === id)?.label || id)
    : viewOptions.filter(option => sel.includes(option.id)).map(option => option.label || option.id);
  useEffect(() => {
    onDebugDataChange?.({
      phase,
      attempts,
      activeLayerId,
      timelineTime,
      timelinePlaying,
      selectionLabels: selectedLabels,
      result,
      checking,
      hiddenObjectIds: [...hiddenObjectIds],
      objectStates,
      usesStageSelection,
      hasSelectionAnswerKey,
    });
  }, [activeLayerId, attempts, checking, hasSelectionAnswerKey, hiddenObjectIds, objectStates, onDebugDataChange, phase, result, selectedLabels, timelinePlaying, timelineTime, usesStageSelection]);
  const toggle = (id) => {
    if (phase !== "play") return;
    if (result) setResult(null);
    setSel(multi ? (sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id]) : [id]);
  };
  const toggleStageSelection = useCallback((objectId) => {
    if (phase !== "play") return;
    const selectedObject = stageSelectionObjects.find(obj => obj.id === objectId);
    if (!selectedObject) return;
    const siblingIds = (stageSelectionChoicesByQuestion[selectedObject.selectionQuestionId] || []).map(obj => obj.id);
    if (result) setResult(null);
    setSel((prev) => {
      if (siblingIds.length === 1 && prev.includes(objectId)) {
        return prev.filter(id => id !== objectId);
      }
      const next = prev.filter(id => !siblingIds.includes(id));
      next.push(objectId);
      return next;
    });
    setObjectStates((prev) => {
      const next = { ...prev };
      siblingIds.forEach((id) => {
        const active = siblingIds.length === 1 && prev?.[id]?.selected && id === objectId ? false : id === objectId;
        next[id] = { ...(next[id] || {}), selected: active };
      });
      return next;
    });
  }, [phase, result, stageSelectionChoicesByQuestion, stageSelectionObjects]);
  const isCorrectAnswer = () => {
    if (usesStageSelection) {
      return stageSelectionGroups.every((questionId) => {
        const choices = stageSelectionChoicesByQuestion[questionId] || [];
        const selectedId = sel.find(id => choices.some(obj => obj.id === id));
        const selectedObject = choices.find(obj => obj.id === selectedId);
        const expectedChoice = activity.selectionSlots?.find(slot => slot.id === questionId)?.correctChoice ?? null;
        if (choices.length <= 1) {
          return expectedChoice ? !!selectedObject?.selectionCorrect : !selectedObject;
        }
        if (!selectedId) return false;
        return !!selectedObject?.selectionCorrect;
      });
    }
    const c = getCorrectSelectionIds(activity);
    return multi ? c.length === sel.length && c.every(x => sel.includes(x)) : sel.length === 1 && c.includes(sel[0]);
  };
  const allStageQuestionsAnswered = !usesStageSelection || stageSelectionGroups.every((questionId) => {
    const choices = stageSelectionChoicesByQuestion[questionId] || [];
    if (choices.length <= 1) return true;
    return sel.some(id => choices.some(obj => obj.id === id));
  });
  const canRetry = settings.allowRetry !== false && (settings.maxAttempts === 0 || attempts < settings.maxAttempts);
  const isSuccess = result === "success";
  const nextAfterIntroAuto = settings.showButtonPackageIntro !== false && packageScreen.enabled !== false ? "package" : settings.showMenuScreen !== false && menuScreen.enabled !== false ? "menu" : "play";
  const nextAfterPackageAuto = settings.showMenuScreen !== false && menuScreen.enabled !== false ? "menu" : "play";
  const nextAfterIntro = resolvePreviewFlowTarget(settings.introNextPhase, ["package", "menu", "play"], nextAfterIntroAuto);
  const nextAfterPackage = resolvePreviewFlowTarget(settings.packageNextPhase, ["intro", "menu", "play"], nextAfterPackageAuto);
  const nextAfterMenu = resolvePreviewFlowTarget(settings.menuNextPhase, ["intro", "package", "play"], "play");

  const runSelectionCheck = () => {
    const ok = isCorrectAnswer();
    setSubmittedSelection([...sel]);
    setResult(ok ? "success" : "failure");
    setChecking(true);
    setTimelinePlaying(false);
    setTimeout(() => { setChecking(false); setAttempts(p => p + 1); }, 850);
  };

  const restartSelectionFlow = (targetPhase = getInitialPreviewPhase(activity)) => {
    setPhase(targetPhase);
    setResult(null);
    setSel([]);
    setSubmittedSelection([]);
    setAttempts(0);
    setTimelineTime(0);
    setTimelinePlaying(false);
  };

  const handleSelectionAction = (action, fallbackAction = "play") => {
    const resolved = action || fallbackAction;
    switch (resolved) {
      case "check":
        runSelectionCheck();
        return;
      case "answer":
        setPhase("answer");
        return;
      case "restart":
        restartSelectionFlow();
        return;
      case "complete":
        if (hasNextStep) onNextStep?.();
        else restartSelectionFlow();
        return;
      case "intro":
      case "package":
      case "menu":
      case "play":
      case "result":
      case "answer":
        setPhase(resolved);
        return;
      case "none":
        return;
      default:
        setPhase(fallbackAction);
    }
  };

  const getScreenStyle = (screenKey) => {
    const map = { intro: intro, package: packageScreen, menu: menuScreen, play: playScreen, success: results, failure: results, answer: answerScreen };
    return (map[screenKey]?.style) || {};
  };
  const primaryBtn = { padding: "13px 28px", borderRadius: theme.radius || 999, border: `1px solid ${theme.border}`, background: theme.button, color: theme.text, fontSize: 14, fontWeight: 800, cursor: "pointer", boxShadow: `0 12px 24px ${theme.border}33`, letterSpacing: 0.3, transition: "opacity .15s, transform .1s" };
  const ghostBtn = { ...primaryBtn, background: "#ffffff", color: "#123a56", border: `1px solid ${theme.border}55`, boxShadow: "0 8px 16px rgba(20,58,86,.06)" };
  const screenBtn = (screenKey) => {
    const s = getScreenStyle(screenKey);
    if (!s.buttonBackground && !s.buttonColor && !s.buttonBorderColor && !s.buttonBorderRadius && !s.buttonFontSize && !s.buttonPaddingX && !s.buttonPaddingY) return primaryBtn;
    return { ...primaryBtn, ...(s.buttonBackground && { background: s.buttonBackground }), ...(s.buttonColor && { color: s.buttonColor }), ...(s.buttonBorderColor && { border: `1px solid ${s.buttonBorderColor}44`, boxShadow: `0 8px 32px ${s.buttonBorderColor}44` }), ...(s.buttonBorderRadius != null && s.buttonBorderRadius !== 0 && { borderRadius: s.buttonBorderRadius }), ...(s.buttonFontSize && { fontSize: s.buttonFontSize }), ...((s.buttonPaddingX || s.buttonPaddingY) && { padding: `${s.buttonPaddingY || 13}px ${s.buttonPaddingX || 28}px` }) };
  };
  const screenGhostBtn = (screenKey) => { const s = getScreenStyle(screenKey); return { ...ghostBtn, ...(s.buttonBackground && { background: s.buttonBackground }), ...(s.buttonColor && { color: s.buttonColor }), ...(s.buttonBorderRadius != null && s.buttonBorderRadius !== 0 && { borderRadius: s.buttonBorderRadius }) }; };
  const stageScale = useMemo(() => {
    const maxWidth = Math.max(320, viewportWidth - (viewportWidth <= 768 ? 24 : 56));
    const maxHeight = Math.max(viewportWidth <= 768 ? 300 : 620, viewportHeight - (isBookPreview ? 110 : 150));
    return Math.min(1, maxWidth / (activity.stageWidth || 1920), maxHeight / (activity.stageHeight || 1080));
  }, [activity.stageHeight, activity.stageWidth, isBookPreview, viewportHeight, viewportWidth]);
  const stageWidth = Math.round((activity.stageWidth || 1920) * stageScale);
  const stageHeight = Math.round((activity.stageHeight || 1080) * stageScale);
  const hasRuntimeStage = !!activity.svgMarkup || getCanvasObjects(activity, activeLayerId, hiddenObjectIds).some(obj => obj.visible !== false && obj.type !== "draggable" && obj.type !== "dropzone");
  const previewPhaseActivities = useMemo(() => (
    isBookPreview
      ? {
        intro: getPreviewPhaseActivity(activity, "intro"),
        package: getPreviewPhaseActivity(activity, "package"),
        menu: getPreviewPhaseActivity(activity, "menu"),
      }
      : { intro: null, package: null, menu: null }
  ), [activity, isBookPreview]);
  const runObjectTriggers = useCallback((objectId, when = "onClick") => {
    const nextObjectStates = {
      ...objectStates,
      [objectId]: {
        ...(objectStates?.[objectId] || {}),
        visited: when !== "onLoad" ? true : (objectStates?.[objectId]?.visited || false),
        selected: when === "onClick" || when === "onDrop" ? true : (objectStates?.[objectId]?.selected || false),
      },
    };
    setObjectStates(nextObjectStates);
    runPreviewTriggers({
      activity,
      activities,
      objectId,
      when,
      onNextActivity,
      onGoToActivity,
      onGoToSlide,
      setActiveLayerId,
      hiddenObjectIds,
      setHiddenObjectIds,
      variables: runtimeVariables,
      setVariables: setRuntimeVariables,
      variableDefinitions,
      objectStates: nextObjectStates,
      setObjectStates,
    });
  }, [activity, activities, hiddenObjectIds, objectStates, onGoToActivity, onGoToSlide, onNextActivity, runtimeVariables, setRuntimeVariables, variableDefinitions]);
  useEffect(() => {
    runPreviewTriggers({
      activity,
      activities,
      objectId: "__activity__",
      when: "onLoad",
      onNextActivity,
      onGoToActivity,
      onGoToSlide,
      setActiveLayerId,
      hiddenObjectIds: new Set(),
      setHiddenObjectIds,
      variables: runtimeVariables,
      setVariables: setRuntimeVariables,
      variableDefinitions,
      objectStates: {},
      setObjectStates,
    });
  }, [activity.id, activity.currentSlideId]);
  const renderShell = (screen, _badge, content) => {
    const cs = getScreenStyle(screen);
    return (
    <div style={{ width: "100%", height: "100%", margin: "0 auto" }}>
      <style>{`@keyframes sel-spin{to{transform:rotate(360deg)}}`}</style>
      <SlideTransitionView transitionKey={`${activity.id}-${activity.currentSlideId}-${screen}`} effect={activity.slideTransitionEffect || "fade"} direction={activity.slideTransitionDirection || "left"} duration={activity.slideTransitionDuration ?? 0.45}>
        <div style={{ background: cs.background || "linear-gradient(180deg,#ffffff 0,#fbfcfd 100%)", borderRadius: cs.borderRadius || 28, border: "1px solid #e4eff5", boxShadow: "0 26px 60px rgba(20,58,86,.12)", overflow: "hidden", position: "relative", height: "100%", minHeight: 0 }}>
          {activity.svgMarkup && <div style={{ position: "absolute", inset: 0, opacity: 0.06, pointerEvents: "none", overflow: "hidden" }} dangerouslySetInnerHTML={{ __html: activity.svgMarkup }} />}
          <div style={{ padding: isBookPreview ? "12px 14px 14px" : (cs.padding ? `${cs.padding}px` : "20px 18px"), position: "relative", height: "100%", minHeight: 0, display: "flex", flexDirection: "column", justifyContent: isBookPreview ? "flex-start" : "center" }}>{content}</div>
        </div>
      </SlideTransitionView>
    </div>
  );};

  const renderBookPreviewPhase = (phaseKey, badge, actions = null) => {
    const phaseActivity = previewPhaseActivities[phaseKey];
    if (!phaseActivity) return null;

    const phaseScale = getFitScale(
      phaseActivity.stageWidth || 1920,
      phaseActivity.stageHeight || 1080,
      Math.max(320, viewportWidth - 48),
      Math.max(viewportWidth <= 768 ? 280 : 640, viewportHeight - 150),
    );
    const phaseStageWidth = Math.round((phaseActivity.stageWidth || 1920) * phaseScale);
    const phaseStageHeight = Math.round((phaseActivity.stageHeight || 1080) * phaseScale);

    return renderShell("intro", badge, (
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 18, justifyContent: "center" }}>
        <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: phaseStageWidth, height: phaseStageHeight, position: "relative", background: phaseActivity.backgroundColor || "#ffffff", borderRadius: 24, overflow: "hidden", border: `1px solid ${theme.border}20`, boxShadow: "0 24px 60px rgba(15,23,42,.24)" }}>
            {phaseActivity.svgMarkup && <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }} dangerouslySetInnerHTML={{ __html: phaseActivity.svgMarkup }} />}
            <RuntimeObjectLayer
              activity={phaseActivity}
              activeLayerId={phaseActivity.activeLayerId || "base"}
              hiddenObjectIds={new Set()}
              objectStates={{}}
              onRunTriggers={() => {}}
              scale={phaseScale}
              currentTime={0}
            />
          </div>
        </div>
        {actions ? (
          <div style={{ ...resolvePreviewButtonLayoutStyle(getScreenStyle(phaseKey), { justifyContent: "center", gap: 12 }), flexShrink: 0 }}>
            {actions}
          </div>
        ) : null}
      </div>
    ));
  };

  if (isBookPreview && phase === "intro") {
    return renderBookPreviewPhase("intro", "Tanıtım", (
      <>
        {settings.showButtonPackageIntro !== false && packageScreen.enabled !== false && (
          <button onClick={() => handleSelectionAction(settings.guideButtonAction || "package", "package")} style={screenGhostBtn("intro")}>{settings.guideButtonText || "Tanıtım"}</button>
        )}
        <button onClick={() => setPhase(nextAfterIntro)} style={screenBtn("intro")}>
          {intro.buttonText || "Etkinliği Başlat"}
        </button>
      </>
    ));
  }

  if (isBookPreview && phase === "package") {
    return renderBookPreviewPhase("package", "Tema Paketi", (
      <>
        <button onClick={() => handleSelectionAction(settings.packageBackAction || "intro", "intro")} style={screenGhostBtn("package")}>{packageScreen.backButtonText || "Geri Dön"}</button>
        <button onClick={() => setPhase(nextAfterPackage)} style={screenBtn("package")}>
          {packageScreen.buttonText || "Menüye Geç"}
        </button>
      </>
    ));
  }

  if (isBookPreview && phase === "menu") {
    return renderBookPreviewPhase("menu", "Menü", (
      <button onClick={() => setPhase(nextAfterMenu)} style={screenBtn("menu")}>
        {menuScreen.buttonText || "Etkinliğe Geç"}
      </button>
    ));
  }

  if (phase === "intro") { const _cs = getScreenStyle("intro"); return renderShell("intro", "Tanıtım", (
    <div style={{ color: (_cs.textColor || "#123a56"), textAlign: "center" }}>
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <div style={{ fontSize: 44, marginBottom: 20, lineHeight: 1 }}>ğŸ‘‹</div>
        <div style={{ fontSize: (_cs.titleFontSize || 30), fontWeight: (_cs.titleFontWeight || 800), marginBottom: 14, letterSpacing: -0.5 }}>{intro.title || `${activity.name} Etkinliğine Hoş Geldin`}</div>
        <div style={{ fontSize: 15, lineHeight: 1.75, opacity: 0.78, marginBottom: 32 }}>{intro.body || "Hazır olduğunda etkinliği başlat."}</div>
        <div style={{ ...resolvePreviewButtonLayoutStyle(_cs, { justifyContent: "center", gap: 12 }) }}>
          <button onClick={() => setPhase(nextAfterIntro)} style={screenBtn("intro")}>{intro.buttonText || "▶ Başla"}</button>
        </div>
      </div>
    </div>
  )); }

  if (phase === "package") { const _cs = getScreenStyle("package"); return renderShell("intro", "Tema Paketi", (
    <div style={{ color: _cs.textColor || "#123a56" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ fontSize: _cs.titleFontSize || 26, fontWeight: _cs.titleFontWeight || 800, marginBottom: 8, textAlign: "center", letterSpacing: -0.4 }}>{packageTitle}</div>
        <div style={{ fontSize: 14, lineHeight: 1.7, opacity: 0.78, marginBottom: 24, textAlign: "center" }}>{packageBody}</div>
        <ButtonPackageIntroDiagram pkgId={activity.buttonPackageId} config={packageScreen} />
        <div style={{ ...resolvePreviewButtonLayoutStyle(_cs, { justifyContent: "center", gap: 12 }), marginTop: 28 }}>
          <button onClick={() => handleSelectionAction(settings.packageBackAction || "intro", "intro")} style={screenGhostBtn("package")}>{packageScreen.backButtonText || "Geri Dön"}</button>
          <button onClick={() => setPhase(nextAfterPackage)} style={screenBtn("package")}>{packageScreen.buttonText || "Menüye Geç →"}</button>
        </div>
      </div>
    </div>
  )); }

  if (phase === "menu") { const _cs = getScreenStyle("menu"); return renderShell("intro", "Menü", (
    <div style={{ color: _cs.textColor || "#123a56", textAlign: "center" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <div style={{ fontSize: _cs.titleFontSize || 30, fontWeight: _cs.titleFontWeight || 800, marginBottom: 12, letterSpacing: -0.5 }}>{menuScreen.title}</div>
        <div style={{ fontSize: 15, lineHeight: 1.75, opacity: 0.78, marginBottom: 32 }}>{menuScreen.body}</div>
        <div style={{ ...resolvePreviewButtonLayoutStyle(_cs, { justifyContent: "center", gap: 12 }) }}>
          <button onClick={() => setPhase(nextAfterMenu)} style={screenBtn("menu")}>{menuScreen.buttonText || "Etkinliğe Geç →"}</button>
        </div>
      </div>
    </div>
  )); }

  if (phase === "result") { const _rsKey = isSuccess ? "success" : "failure"; const _cs = getScreenStyle(_rsKey); return renderShell(_rsKey, isSuccess ? "✓ Doğru" : "✗ Yanlış", (
    <div style={{ color: _cs.textColor || "#123a56", textAlign: "center" }}>
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <div style={{ fontSize: 64, lineHeight: 1, marginBottom: 20 }}>{isSuccess ? "ğŸ†" : "ğŸ’ª"}</div>
        <div style={{ fontSize: _cs.titleFontSize || 34, fontWeight: _cs.titleFontWeight || 800, marginBottom: 12, letterSpacing: -0.6 }}>{isSuccess ? (resultScreens.successTitle || "Harika!") : (resultScreens.failureTitle || "Tekrar Deneyelim")}</div>
        <div style={{ fontSize: 15, lineHeight: 1.75, opacity: 0.78, marginBottom: 32 }}>{isSuccess ? (resultScreens.successBody || "Doğru cevabı buldun, tebrikler!") : (resultScreens.failureBody || "Bir kez daha deneyebilirsin.")}</div>
        <div style={{ ...resolvePreviewButtonLayoutStyle(_cs, { justifyContent: "center", gap: 12 }) }}>
          {!isSuccess && canRetry && <button onClick={() => restartSelectionFlow("play")} style={screenBtn(_rsKey)}>{resultScreens.retryText || "↺ Tekrar Dene"}</button>}
          {!isSuccess && settings.showAnswerLayer !== false && <button onClick={() => handleSelectionAction(settings.answerButtonAction || "answer", "answer")} style={screenGhostBtn(_rsKey)}>{settings.answerButtonText || "Cevabı Gör"}</button>}
          {isSuccess && hasNextStep && <button onClick={() => handleSelectionAction(settings.completeButtonAction || "complete", "complete")} style={screenBtn(_rsKey)}>{nextStepLabel} →</button>}
          <button onClick={() => handleSelectionAction(settings.restartButtonAction || "restart", "restart")} style={screenGhostBtn(_rsKey)}>{resultScreens.continueText || "Yeniden Başlat"}</button>
        </div>
      </div>
    </div>
  )); }

  if (phase === "answer") { const _cs = getScreenStyle("answer"); return renderShell("failure", "Doğru Cevap", (
    <div style={{ color: _cs.textColor || "#123a56" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <div style={{ fontSize: _cs.titleFontSize || 26, fontWeight: _cs.titleFontWeight || 800, marginBottom: 6, letterSpacing: -0.4 }}>{answerScreen.title || "Doğru Cevap"}</div>
        {answerScreen.body && <div style={{ fontSize: 14, lineHeight: 1.7, opacity: 0.72, marginBottom: 20 }}>{answerScreen.body}</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
          {usesStageSelection
            ? autoAnswer.map((line, index) => <div key={index} style={{ padding: "14px 18px", borderRadius: 18, border: "1px solid #d6e7f2", background: "#eaf4fb", color: "#123a56", fontSize: 14, fontWeight: 600 }}>{line}</div>)
            : viewOptions.filter(o => o.isCorrect).map(o => <div key={o.id} style={{ padding: "14px 18px", borderRadius: 18, border: "1px solid #d6e7f2", background: "#eaf4fb", color: "#123a56", fontSize: 14, fontWeight: 600 }}>{o.label}</div>)
          }
        </div>
        {!usesStageSelection && submittedSelection.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10, marginBottom: 24 }}>
            <div style={{ padding: "12px 16px", borderRadius: 14, background: "rgba(22,163,74,.16)", border: "1px solid rgba(74,222,128,.4)" }}>
              <div style={{ fontSize: 11, fontWeight: 800, marginBottom: 8, color: "#86efac" }}>OGRNCININ DOGRU CEVAPLARI</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {viewOptions.filter(o => submittedSelection.includes(o.id) && o.isCorrect).length
                  ? viewOptions.filter(o => submittedSelection.includes(o.id) && o.isCorrect).map(o => (
                    <div key={o.id} style={{ fontSize: 13, color: "#f0fdf4", display: "flex", alignItems: "center", gap: 8 }}><span style={{ color: "#86efac" }}>✓</span>{o.label}</div>
                  ))
                  : <div style={{ fontSize: 12, color: "#d1fae5" }}>Dogru cevap yok.</div>}
              </div>
            </div>
            <div style={{ padding: "12px 16px", borderRadius: 14, background: "rgba(185,28,28,.16)", border: "1px solid rgba(248,113,113,.4)" }}>
              <div style={{ fontSize: 11, fontWeight: 800, marginBottom: 8, color: "#fca5a5" }}>OGRNCININ YANLIS CEVAPLARI</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {viewOptions.filter(o => submittedSelection.includes(o.id) && !o.isCorrect).length
                  ? viewOptions.filter(o => submittedSelection.includes(o.id) && !o.isCorrect).map(o => (
                    <div key={o.id} style={{ fontSize: 13, color: "#fef2f2", display: "flex", alignItems: "center", gap: 8 }}><span style={{ color: "#fca5a5" }}>✗</span>{o.label}</div>
                  ))
                  : <div style={{ fontSize: 12, color: "#fee2e2" }}>Yanlis cevap yok.</div>}
              </div>
            </div>
          </div>
        )}
        <div style={{ ...resolvePreviewButtonLayoutStyle(_cs, { justifyContent: "center", gap: 12 }) }}>
          <button onClick={() => handleSelectionAction(settings.answerButtonAction || "restart", "restart")} style={screenGhostBtn("answer")}>{answerScreen.buttonText || "Yeniden Başlat"}</button>
        </div>
      </div>
    </div>
  )); }

  { const _cs = getScreenStyle("play"); return renderShell("play", "Etkinlik", (
    <div style={{ color: _cs.textColor || "#123a56" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        {hasRuntimeStage && (
          <div style={{ marginBottom: 28, borderRadius: 20, overflow: "hidden", border: "1px solid #ddeaf2", boxShadow: "0 14px 32px rgba(20,58,86,.08)" }}>
            <div style={{ width: stageWidth, height: stageHeight, position: "relative", background: activity.backgroundColor || "#fff", overflow: "hidden", margin: "0 auto" }}>
              {activity.svgMarkup && <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }} dangerouslySetInnerHTML={{ __html: activity.svgMarkup }} />}
              <RuntimeObjectLayer activity={activity} activeLayerId={activeLayerId} hiddenObjectIds={hiddenObjectIds} objectStates={objectStates} onRunTriggers={runObjectTriggers} onSelectionChoice={toggleStageSelection} selectedObjectIds={sel} hintObjectIds={developerHintMode ? stageSelectionObjects.filter(obj => obj.selectionCorrect).map(obj => obj.id) : []} scale={stageScale} currentTime={runtimePreviewTime} />
            </div>
          </div>
        )}
        {(playScreen.title || activity.mcQuestion) && (
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 10, letterSpacing: -0.4, lineHeight: 1.35 }}>{playScreen.title || activity.mcQuestion}</h2>
        )}
        <p style={{ fontSize: 13, opacity: 0.62, marginBottom: 20, lineHeight: 1.6 }}>
          {usesStageSelection
            ? "Sahnedeki kutucuklardan seçim yapın."
            : (playScreen.body || (multi ? "Birden fazla seçenek işaretleyebilirsiniz." : "Tek seçenek seçiniz."))}
        </p>
        {!usesStageSelection && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {viewOptions.map((o, idx) => {
              const selected = sel.includes(o.id);
              const letter = String.fromCharCode(65 + idx);
              const isCorrectOpt = !!o.isCorrect;
              const showCheckedState = checking || result !== null;
              const isWrongSelected = showCheckedState && selected && !isCorrectOpt;
              const isCorrectOption = showCheckedState && isCorrectOpt;
              const showHintOption = developerHintMode && !showCheckedState && isCorrectOpt;
              let borderCol = selected ? "#6b93d0" : "#d7e5f0";
              let bgCol = selected ? "#eef3fb" : "#ffffff";
              let badgeBg = selected ? "rgba(107,147,208,.2)" : "#f0f5fb";
              if (showHintOption) { borderCol = "#4ade80"; bgCol = "rgba(74,222,128,.1)"; badgeBg = "rgba(74,222,128,.22)"; }
              if (isCorrectOption) { borderCol = "#62cf52"; bgCol = "#f1ffed"; badgeBg = "rgba(98,207,82,.25)"; }
              if (isWrongSelected) { borderCol = "#f26c6c"; bgCol = "#fff4f4"; badgeBg = "rgba(242,108,108,.25)"; }
              return (
                <button key={o.id} onClick={() => !checking && toggle(o.id)} style={{ padding: "14px 18px", borderRadius: 22, border: `2px solid ${borderCol}`, background: bgCol, color: "#123a56", textAlign: "left", cursor: checking ? "default" : "pointer", fontSize: 14, fontWeight: 700, transition: "all .2s", display: "flex", alignItems: "center", gap: 14, transform: checking && isCorrectOption ? "scale(1.02)" : "none", boxShadow: "0 10px 24px rgba(20,58,86,.06)" }}>
                  <span style={{ width: 28, height: 28, borderRadius: "50%", background: badgeBg, border: `1.5px solid ${borderCol}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
                    {showCheckedState ? (isCorrectOption ? "✓" : isWrongSelected ? "✗" : letter) : letter}
                  </span>
                  {o.label || "Seçenek"}
                </button>
              );
            })}
          </div>
        )}
        {developerHintMode && (
          <div style={{ marginTop: 18, padding: "12px 14px", borderRadius: 16, border: "1px solid rgba(74,222,128,.34)", background: "rgba(22,163,74,.1)" }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#166534", marginBottom: 8, letterSpacing: 0.45, textTransform: "uppercase" }}>Gelistirici Ipucu</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(usesStageSelection ? autoAnswer : viewOptions.filter(o => o.isCorrect).map(o => o.label || "Dogru Secenek")).map((line, index) => (
                <div key={`${line}-${index}`} style={{ fontSize: 13, color: "#166534", lineHeight: 1.55 }}>{line}</div>
              ))}
            </div>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 28, flexWrap: "wrap" }}>
        {checking ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid #6b93d0", borderTopColor: "transparent", animation: "sel-spin 0.6s linear infinite" }} />
            <span style={{ fontSize: 13, opacity: 0.7 }}>Kontrol ediliyor...</span>
          </div>
        ) : result ? (
          <button onClick={() => setPhase("result")} style={screenBtn("play")}>
            {resultScreens.continueText || "Sonucu Gör"} →
          </button>
        ) : (
          <button
            onClick={() => {
              const ok = isCorrectAnswer();
              setSubmittedSelection([...sel]);
              setResult(ok ? "success" : "failure");
              setChecking(true);
              setTimelinePlaying(false);
              setTimeout(() => { setChecking(false); setAttempts(p => p + 1); }, 1600);
            }}
            disabled={usesStageSelection ? (!allStageQuestionsAnswered || !hasSelectionAnswerKey) : !sel.length}
            style={{ ...screenBtn("play"), opacity: (usesStageSelection ? (allStageQuestionsAnswered && hasSelectionAnswerKey) : !!sel.length) ? 1 : 0.4, cursor: (usesStageSelection ? (allStageQuestionsAnswered && hasSelectionAnswerKey) : !!sel.length) ? "pointer" : "default" }}
            >
              {(settings.checkButtonText || "Kontrol Et")} →
            </button>
          )}
          {usesStageSelection && !hasSelectionAnswerKey && <div style={{ fontSize: 12, color: "#fbbf24" }}>⚠ Cevap anahtarı okunamadı.</div>}
        </div>
      </div>
    </div>
  )); }
}

function PreviewDragDropFlow({ activity, activities, hasNextActivity = false, hasNextStep = false, nextStepLabel = "Sonraki Soru", onNextActivity, onNextStep, onGoToActivity, onGoToSlide, variableDefinitions = [], runtimeVariables = {}, setRuntimeVariables, previewCommand = null, developerHintMode = false, onPhaseChange = () => {}, onDebugDataChange = () => {}, previewViewport = null }) {
  const [phase, setPhase] = useState(getInitialPreviewPhase(activity));
  const [attempts, setAttempts] = useState(0);
  const [status, setStatus] = useState(null);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState(null); // { [dragId]: boolean }
  const [submittedMatches, setSubmittedMatches] = useState({});
  const [guideSourcePhase, setGuideSourcePhase] = useState("intro");
  const [menuOpen, setMenuOpen] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);
  const stageRef = useRef(null);
  const dragging = useRef(null);
  const activeHandlersRef = useRef(null);
  const [positions, setPositions] = useState({});
  const [matched, setMatched] = useState({});
  const [hoveredDropId, setHoveredDropId] = useState(null);
  const [activeLayerId, setActiveLayerId] = useState(activity.activeLayerId || "base");
  const [hiddenObjectIds, setHiddenObjectIds] = useState(() => new Set());
  const [objectStates, setObjectStates] = useState({});
  const [timelineTime, setTimelineTime] = useState(0);
  const [timelinePlaying, setTimelinePlaying] = useState(false);
  const [windowWidth, setWindowWidth] = useState(() => (typeof window !== "undefined" ? window.innerWidth : 1280));
  const settings = { ...DEFAULT_ACTIVITY_SETTINGS, ...(activity.settings || {}) };
  const intro = activity.introScreen || {};
  const packageScreen = activity.buttonPackageScreen || {};
  const menuScreen = activity.menuScreen || {};
  const playScreen = activity.playScreen || {};
  const resultScreens = activity.resultScreens || {};
  const results = resultScreens;
  const answerScreen = activity.answerScreen || {};
  const theme = getPackageTheme(activity.buttonPackageId);
  const packageTitle = !packageScreen.title || /buton paketi/i.test(packageScreen.title) ? "Tema Paketi Tanıtımı" : packageScreen.title;
  const packageBody = !packageScreen.body || /buton.*davran/i.test(packageScreen.body) ? "Etkinlikte kullanacağın tema paketini ve buton davranışlarını önce incele." : packageScreen.body;
  const runtimePreviewTime = 0;
  const canvasObjects = getCanvasObjects(activity, activeLayerId, hiddenObjectIds).filter(object => isObjectTimelineActive(activity, object.id, runtimePreviewTime));
  const drags = canvasObjects.filter(o => o.type === "draggable");
  const drops = canvasObjects.filter(o => o.type === "dropzone");
  const runtimeActivity = useMemo(() => ({ ...activity, activeLayerId }), [activity, activeLayerId]);
  const correctMatches = getCorrectDragMatches(runtimeActivity);
  const correctPositions = getCorrectDragPositions(runtimeActivity, correctMatches);
  const autoAnswer = getAutoAnswerSummary(runtimeActivity);
  const previousActivityIdRef = useRef(activity?.id || null);
  const dropById = useMemo(() => Object.fromEntries(drops.map(item => [item.id, item])), [drops]);
  const getDragFrame = useCallback((dragId, shownMatched = matched, shownPositions = positions) => {
    const drag = drags.find(item => item.id === dragId);
    const drop = dropById[shownMatched?.[dragId]];
    if (drop) {
      return {
        x: drop.x,
        y: drop.y,
        width: drop.width,
        height: drop.height,
        drop,
        drag,
      };
    }
    const pos = shownPositions?.[dragId] || (drag ? { x: drag.x, y: drag.y } : { x: 0, y: 0 });
    return {
      x: pos.x,
      y: pos.y,
      width: drag?.width || 0,
      height: drag?.height || 0,
      drop: null,
      drag,
    };
  }, [drags, dropById, matched, positions]);

  // Cleanup drag listeners on unmount
  useEffect(() => {
    return () => {
      if (activeHandlersRef.current) {
        window.removeEventListener("pointermove", activeHandlersRef.current.move);
        window.removeEventListener("pointerup", activeHandlersRef.current.up);
        activeHandlersRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  const viewportWidth = previewViewport?.width || windowWidth;
  const viewportHeight = previewViewport?.height || (typeof window !== "undefined" ? window.innerHeight : 860);
  useEffect(() => {
    onPhaseChange?.(phase);
  }, [onPhaseChange, phase]);
  useEffect(() => {
    const sameActivity = previousActivityIdRef.current === activity.id;
    previousActivityIdRef.current = activity.id;
    setPhase(sameActivity ? "play" : getInitialPreviewPhase(activity));
    setAttempts(0);
    setStatus(null);
    setChecking(false);
    setCheckResult(null);
    setSubmittedMatches({});
    setGuideSourcePhase(sameActivity ? "play" : "intro");
    setMenuOpen(false);
    setAudioMuted(false);
    setPositions({});
    setMatched({});
    setHoveredDropId(null);
    setActiveLayerId(activity.activeLayerId || "base");
    setHiddenObjectIds(new Set());
    setObjectStates({});
    setTimelineTime(0);
    setTimelinePlaying(false);
  }, [activity.id, activity.currentSlideId]);
  useEffect(() => {
    setTimelinePlaying(false);
  }, [phase, activity.id]);
  useEffect(() => {
    if (!previewCommand || previewCommand.activityId !== activity.id) return;
    const targetPhase = previewCommand.action === "reset"
      ? getInitialPreviewPhase(activity)
      : (previewCommand.phase || "play");
    if (previewCommand.action !== "reset" && previewCommand.phase === "menu") {
      setPhase("play");
      setMenuOpen(true);
      return;
    }
    setPhase(targetPhase);
    setAttempts(0);
    setStatus(null);
    setChecking(false);
    setCheckResult(null);
    setSubmittedMatches({});
    setGuideSourcePhase(targetPhase === "play" ? "play" : "intro");
    setMenuOpen(false);
    setAudioMuted(false);
    setPositions({});
    setMatched({});
    setHoveredDropId(null);
    setActiveLayerId(activity.activeLayerId || "base");
    setHiddenObjectIds(new Set());
    setObjectStates({});
    setTimelineTime(0);
    setTimelinePlaying(false);
  }, [activity.activeLayerId, activity.id, activity.currentSlideId, previewCommand]);
  const scale = useMemo(() => {
    const sw = activity.stageWidth || 1920;
    const sh = activity.stageHeight || 1080;
    const maxWidth = Math.max(320, viewportWidth - (viewportWidth <= 768 ? 24 : 48));
    const maxHeight = Math.max(viewportWidth <= 768 ? 360 : 660, viewportHeight - (viewportWidth <= 768 ? 120 : 140));
    return Math.min(1, maxWidth / sw, maxHeight / sh);
  }, [activity.stageHeight, activity.stageWidth, viewportHeight, viewportWidth]);
  const toStage = useCallback((cx, cy) => {
    const r = stageRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return { x: (cx - r.left) / scale, y: (cy - r.top) / scale };
  }, [scale]);
  const runObjectTriggers = useCallback((objectId, when = "onClick") => {
    const nextObjectStates = {
      ...objectStates,
      [objectId]: {
        ...(objectStates?.[objectId] || {}),
        visited: when !== "onLoad" ? true : (objectStates?.[objectId]?.visited || false),
        selected: when === "onClick" || when === "onDrop" ? true : (objectStates?.[objectId]?.selected || false),
      },
    };
    setObjectStates(nextObjectStates);
    runPreviewTriggers({
      activity,
      activities,
      objectId,
      when,
      onNextActivity,
      onGoToActivity,
      onGoToSlide,
      setActiveLayerId,
      hiddenObjectIds,
      setHiddenObjectIds,
      variables: runtimeVariables,
      setVariables: setRuntimeVariables,
      variableDefinitions,
      objectStates: nextObjectStates,
      setObjectStates,
    });
  }, [activity, activities, hiddenObjectIds, objectStates, onGoToActivity, onGoToSlide, onNextActivity, runtimeVariables, setRuntimeVariables, variableDefinitions]);
  useEffect(() => {
    runPreviewTriggers({
      activity,
      activities,
      objectId: "__activity__",
      when: "onLoad",
      onNextActivity,
      onGoToActivity,
      onGoToSlide,
      setActiveLayerId,
      hiddenObjectIds: new Set(),
      setHiddenObjectIds,
      variables: runtimeVariables,
      setVariables: setRuntimeVariables,
      variableDefinitions,
      objectStates: {},
      setObjectStates,
    });
  }, [activity.id, activity.currentSlideId]);

  const handleDown = useCallback((e, id) => {
    if (phase !== "play") return;
    if (status || checkResult) {
      setStatus(null);
      setCheckResult(null);
      setSubmittedMatches({});
    }
    e.preventDefault();
    e.currentTarget?.setPointerCapture?.(e.pointerId);
    const startPt = toStage(e.clientX, e.clientY);
    const frame = getDragFrame(id);
    setMatched(prev => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
    // Read start pos synchronously to avoid stale closure issue
    const origDrag = drags.find(x => x.id === id);
    const originalPos = origDrag ? { x: origDrag.x, y: origDrag.y } : { x: frame.x, y: frame.y };
    setPositions(prev => {
      const cp = { x: frame.x, y: frame.y };
      dragging.current = { id, ox: startPt.x - cp.x, oy: startPt.y - cp.y, startPos: cp, currentPos: cp, originalPos };
      return { ...prev, [id]: cp };
    });

    const onMove = (me) => {
      if (!dragging.current) return;
      const pt = toStage(me.clientX, me.clientY);
      const { id: dragId, ox, oy } = dragging.current;
      const nx = pt.x - ox, ny = pt.y - oy;
      dragging.current.currentPos = { x: nx, y: ny };
      setPositions(prev => ({ ...prev, [dragId]: { x: nx, y: ny } }));
      // Highlight hovered drop zone
      const d = drags.find(x => x.id === dragId);
      const cx = nx + (d?.width || 0) / 2, cy = ny + (d?.height || 0) / 2;
      const hovered = drops.find(dz => cx >= dz.x && cx <= dz.x + dz.width && cy >= dz.y && cy <= dz.y + dz.height);
      setHoveredDropId(hovered?.id || null);
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      activeHandlersRef.current = null;
      if (!dragging.current) return;
      const { id: dragId, startPos, currentPos, originalPos } = dragging.current;
      const p = currentPos || startPos;
      const d = drags.find(x => x.id === dragId);
      let matchedDz = null;
      for (const dz of drops) {
        const cx = p.x + (d?.width || 0) / 2, cy = p.y + (d?.height || 0) / 2;
        if (cx >= dz.x && cx <= dz.x + dz.width && cy >= dz.y && cy <= dz.y + dz.height) {
          matchedDz = dz;
          break;
        }
      }
      if (matchedDz) {
        setMatched(prev => ({ ...prev, [dragId]: matchedDz.id }));
        setPositions(prev => ({ ...prev, [dragId]: { x: matchedDz.x + (matchedDz.width - (d?.width || 0)) / 2, y: matchedDz.y + (matchedDz.height - (d?.height || 0)) / 2 } }));
        runObjectTriggers(dragId, "onDrop");
        runObjectTriggers(matchedDz.id, "onDrop");
      } else {
        // Return to original canvas position when not dropped on a valid zone
        const returnPos = originalPos || (d ? { x: d.x, y: d.y } : startPos);
        setPositions(prev => ({ ...prev, [dragId]: returnPos }));
      }
      dragging.current = null;
      setHoveredDropId(null);
    };

    activeHandlersRef.current = { move: onMove, up: onUp };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [phase, status, checkResult, drags, drops, toStage, runObjectTriggers, getDragFrame]);
  const getScreenStyle = (screenKey) => {
    const map = { intro: intro, package: packageScreen, menu: menuScreen, play: playScreen, success: results, failure: results, answer: answerScreen };
    return (map[screenKey]?.style) || {};
  };
  const primaryBtn = { padding: "13px 28px", borderRadius: theme.radius || 999, border: `1px solid ${theme.border}`, background: theme.button, color: theme.text, fontSize: 14, fontWeight: 800, cursor: "pointer", boxShadow: `0 12px 24px ${theme.border}33`, letterSpacing: 0.3, transition: "opacity .15s" };
  const ghostBtn = { ...primaryBtn, background: "#ffffff", color: "#123a56", border: `1px solid ${theme.border}55`, boxShadow: "0 8px 16px rgba(20,58,86,.06)" };
  const screenBtn = (screenKey) => {
    const s = getScreenStyle(screenKey);
    if (!s.buttonBackground && !s.buttonColor && !s.buttonBorderColor && !s.buttonBorderRadius && !s.buttonFontSize && !s.buttonPaddingX && !s.buttonPaddingY) return primaryBtn;
    return { ...primaryBtn, ...(s.buttonBackground && { background: s.buttonBackground }), ...(s.buttonColor && { color: s.buttonColor }), ...(s.buttonBorderColor && { border: `1px solid ${s.buttonBorderColor}44`, boxShadow: `0 8px 32px ${s.buttonBorderColor}44` }), ...(s.buttonBorderRadius != null && s.buttonBorderRadius !== 0 && { borderRadius: s.buttonBorderRadius }), ...(s.buttonFontSize && { fontSize: s.buttonFontSize }), ...((s.buttonPaddingX || s.buttonPaddingY) && { padding: `${s.buttonPaddingY || 13}px ${s.buttonPaddingX || 28}px` }) };
  };
  const screenGhostBtn = (screenKey) => { const s = getScreenStyle(screenKey); return { ...ghostBtn, ...(s.buttonBackground && { background: s.buttonBackground }), ...(s.buttonColor && { color: s.buttonColor }), ...(s.buttonBorderRadius != null && s.buttonBorderRadius !== 0 && { borderRadius: s.buttonBorderRadius }) }; };
  const vw = Math.round((activity.stageWidth || 1920) * scale);
  const vh = Math.round((activity.stageHeight || 1080) * scale);
  const matchedLabels = drags
    .filter(drag => matched[drag.id])
    .map(drag => `${drag.label || "Surukle"} -> ${dropById[matched[drag.id]]?.label || matched[drag.id]}`);
  useEffect(() => {
    onDebugDataChange?.({
      phase,
      attempts,
      activeLayerId,
      timelineTime,
      timelinePlaying,
      matchLabels: matchedLabels,
      status,
      checking,
      hiddenObjectIds: [...hiddenObjectIds],
      objectStates,
      submittedMatches,
    });
  }, [activeLayerId, attempts, checking, hiddenObjectIds, matchedLabels, objectStates, onDebugDataChange, phase, status, submittedMatches, timelinePlaying, timelineTime]);

  const renderStage = (forceCorrect = false, showEvaluation = true) => {
    const shownMatched = forceCorrect ? correctMatches : matched;
    const shownPositions = forceCorrect ? correctPositions : positions;
    const matchedDropIds = new Set(Object.values(shownMatched));
    return (
      <div ref={forceCorrect ? null : stageRef} style={{ width: vw, height: vh, position: "relative", background: activity.backgroundColor || "#fff", borderRadius: 16, overflow: "hidden", margin: "0 auto", border: `1px solid ${theme.border}18`, boxShadow: "0 16px 48px rgba(0,0,0,.28)", touchAction: "none" }}>
        {activity.svgMarkup && <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }} dangerouslySetInnerHTML={{ __html: activity.svgMarkup }} />}
        {drops.map(dz => {
          const isMatched = matchedDropIds.has(dz.id);
          const isHovered = !forceCorrect && hoveredDropId === dz.id;
          const isCheckedCorrect = checking && Object.entries(shownMatched).some(([dragId, dropId]) => dropId === dz.id && correctMatches[dragId] === dz.id);
          const isCheckedWrong = checking && Object.entries(shownMatched).some(([dragId, dropId]) => dropId === dz.id && correctMatches[dragId] !== dz.id);
          const isHinted = developerHintMode && !forceCorrect && !checking && checkResult === null && Object.values(correctMatches).includes(dz.id);
          const borderColor = isCheckedCorrect ? "#14532d" : isCheckedWrong ? "#7f1d1d" : isHovered ? theme.border : (dz.style?.borderColor || "#f97316");
          const background = isCheckedCorrect ? "#166534" : isCheckedWrong ? "#991b1b" : (dz.style?.background || "#fed7aa");
          const textColor = isCheckedCorrect || isCheckedWrong ? "#ffffff" : (dz.style?.color || "#9a3412");
          return (
            <div key={dz.id} style={{ position: "absolute", left: dz.x * scale, top: dz.y * scale, width: dz.width * scale, height: dz.height * scale, border: `2px solid ${borderColor}`, background, borderRadius: (dz.style?.borderRadius || 10) * scale, display: "flex", alignItems: "center", justifyContent: "center", fontSize: Math.max(10, 11 * scale), color: textColor, transition: "border-color .12s, background .12s", zIndex: 1, fontWeight: 700, boxShadow: isHinted ? "0 0 0 2px rgba(74,222,128,.82) inset, 0 0 0 6px rgba(74,222,128,.16)" : "none" }}>
              {!isMatched && (dz.label || "Bırak")}
            </div>
          );
        })}
        {drags.map(d => {
          const frame = getDragFrame(d.id, shownMatched, shownPositions);
          const p = { x: frame.x, y: frame.y };
          const m = shownMatched[d.id];
          const isDragging = !forceCorrect && !checking && dragging.current?.id === d.id;
          const checkOk = checkResult ? checkResult[d.id] : null;
          const showCheckedState = showEvaluation && (checking || checkResult !== null);
          const isCheckCorrect = showCheckedState && checkOk === true;
          const isCheckWrong = showCheckedState && checkOk === false;
          const isHinted = developerHintMode && !forceCorrect && !showCheckedState && !!correctMatches[d.id];
          const bgColor = isCheckCorrect ? "#166534" : isCheckWrong ? "#991b1b" : (d.style?.background || "#1d4ed8");
          const borderColor = isCheckCorrect ? "#14532d" : isCheckWrong ? "#7f1d1d" : (d.style?.borderColor || "#1e3a8a");
          const textColor = isCheckCorrect || isCheckWrong ? "#ffffff" : (d.style?.color || "#eff6ff");
          return (
            <div key={d.id} onPointerDown={(forceCorrect || checking) ? undefined : (e) => handleDown(e, d.id)} style={{ position: "absolute", left: p.x * scale, top: p.y * scale, width: frame.width * scale, height: frame.height * scale, background: bgColor, border: `2px solid ${borderColor}`, borderRadius: ((frame.drop?.style?.borderRadius) || (d.style?.borderRadius || 10)) * scale, cursor: (forceCorrect || checking) ? "default" : isDragging ? "grabbing" : "grab", display: "flex", alignItems: "center", justifyContent: "center", fontSize: Math.max(10, 13 * scale), color: textColor, fontWeight: 700, userSelect: "none", zIndex: isDragging ? 100 : 3, transition: isDragging ? "none" : "left .18s, top .18s, background .2s, border-color .2s", touchAction: "none", boxShadow: isCheckCorrect ? "0 8px 22px rgba(22,101,52,.38)" : isCheckWrong ? "0 8px 22px rgba(153,27,27,.34)" : isHinted ? "0 0 0 2px rgba(74,222,128,.82), 0 0 0 6px rgba(74,222,128,.16)" : isDragging ? "0 12px 32px rgba(0,0,0,.4)" : m ? "0 6px 18px rgba(15,23,42,.16)" : "none", padding: `0 ${Math.max(8, 12 * scale)}px`, gap: Math.max(6, 8 * scale) }}>
              <span style={{ flex: 1, minWidth: 0, textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {d.label || "Sürükle"}
              </span>
              {(isCheckCorrect || isCheckWrong) && (
                <span style={{ width: Math.max(20, 24 * scale), height: Math.max(20, 24 * scale), borderRadius: "50%", background: isCheckCorrect ? "#ffffff" : "#fee2e2", color: isCheckCorrect ? "#166534" : "#991b1b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: Math.max(11, 13 * scale), fontWeight: 900, flexShrink: 0 }}>
                  {isCheckCorrect ? "✓" : "✕"}
                </span>
              )}
            </div>
          );
        })}
        <RuntimeObjectLayer activity={activity} activeLayerId={activeLayerId} hiddenObjectIds={hiddenObjectIds} objectStates={objectStates} onRunTriggers={runObjectTriggers} scale={scale} currentTime={runtimePreviewTime} />
      </div>
    );
  };

  const accent = theme.accent || theme.border;
  const accentDark = theme.accentDark || theme.border;
  const successGreen = theme.successTone || "#15803d";
  const dangerRed = theme.dangerTone || "#b91c1c";
  const shellHeight = "100%";
  const packageBackText = packageScreen.backButtonText || "Geri Dön";
  const nextAfterIntroAuto = settings.showButtonPackageIntro !== false && packageScreen.enabled !== false ? "package" : settings.showMenuScreen !== false && menuScreen.enabled !== false ? "menu" : "play";
  const nextAfterPackageAuto = settings.showMenuScreen !== false && menuScreen.enabled !== false ? "menu" : "play";
  const nextAfterIntro = resolvePreviewFlowTarget(settings.introNextPhase, ["package", "menu", "play"], nextAfterIntroAuto);
  const nextAfterPackage = resolvePreviewFlowTarget(settings.packageNextPhase, ["intro", "menu", "play"], nextAfterPackageAuto);
  const nextAfterMenu = resolvePreviewFlowTarget(settings.menuNextPhase, ["intro", "package", "play"], "play");

  const openGuide = (source = "intro") => {
    setGuideSourcePhase(source);
    setMenuOpen(false);
    setPhase("package");
  };

  const closeGuide = () => setPhase(guideSourcePhase || "intro");

  const resetFlow = (targetPhase = getInitialPreviewPhase(activity)) => {
    setPhase(targetPhase);
    setAttempts(0);
    setStatus(null);
    setChecking(false);
    setCheckResult(null);
    setSubmittedMatches({});
    setPositions({});
    setMatched({});
    setHoveredDropId(null);
    setTimelineTime(0);
    setTimelinePlaying(false);
    setMenuOpen(false);
    setGuideSourcePhase(targetPhase === "play" ? "play" : "intro");
  };

  const retryCurrentPlacement = () => {
    setPhase("play");
    setStatus(null);
    setChecking(false);
    setCheckResult(null);
    setSubmittedMatches({});
    setMenuOpen(false);
  };

  const revealSolution = () => {
    setMatched(correctMatches);
    setPositions(correctPositions);
    setStatus(null);
    setChecking(false);
    setCheckResult(Object.fromEntries(drags.map(d => [d.id, true])));
    setMenuOpen(false);
    setPhase("answer");
  };

  const finishSuccess = () => {
    if (hasNextStep) {
      onNextStep?.();
      return;
    }
    resetFlow("intro");
  };

  const runDragDropAction = (action, fallbackAction = "play") => {
    const resolved = action || fallbackAction;
    switch (resolved) {
      case "toggle-menu":
        setMenuOpen(value => !value);
        return;
      case "check":
        evaluateMatches();
        return;
      case "answer":
        revealSolution();
        return;
      case "restart":
        resetFlow();
        return;
      case "complete":
        finishSuccess();
        return;
      case "package":
        openGuide(phase === "play" ? "play" : "intro");
        return;
      case "intro":
      case "menu":
      case "play":
        resetFlow(resolved);
        return;
      case "result":
        setMenuOpen(false);
        setPhase("result");
        return;
      case "none":
        setMenuOpen(false);
        return;
      default:
        if (["intro", "menu", "play"].includes(fallbackAction)) resetFlow(fallbackAction);
        else if (fallbackAction === "package") openGuide(phase === "play" ? "play" : "intro");
    }
  };

  const evaluateMatches = () => {
    const resultByDrag = Object.fromEntries(drags.map(d => [d.id, matched[d.id] && matched[d.id] === correctMatches[d.id]]));
    const ok = drags.length > 0 && drags.every(d => resultByDrag[d.id]);
    setSubmittedMatches({ ...matched });
    setCheckResult(resultByDrag);
    setStatus(ok ? "success" : "failure");
    setChecking(true);
    setMenuOpen(false);
    setTimelinePlaying(false);
    setTimeout(() => {
      setChecking(false);
      setAttempts(p => p + 1);
      setPhase("result");
    }, 650);
  };

  const renderShell = (screen, _badge, content, overlay = null) => {
    const cs = getScreenStyle(screen);
    return (
    <div style={{ width: "100%", height: shellHeight, margin: "0 auto", position: "relative" }}>
      <style>{`@keyframes dd-spin{to{transform:rotate(360deg)}}@keyframes dd-banner-up{from{transform:translateY(24px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
      <SlideTransitionView transitionKey={`${activity.id}-${activity.currentSlideId}-${screen}`} effect={activity.slideTransitionEffect || "fade"} direction={activity.slideTransitionDirection || "left"} duration={activity.slideTransitionDuration ?? 0.45}>
        <div style={{ height: "100%", borderRadius: cs.borderRadius || 32, overflow: "hidden", position: "relative", background: cs.background || "linear-gradient(180deg,#ffffff 0,#fbfcfd 100%)", border: "1px solid #e4eff5", boxShadow: "0 26px 60px rgba(20,58,86,.12)" }}>
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />
          <div style={{ position: "relative", zIndex: 1, height: "100%", display: "flex", flexDirection: "column", padding: cs.padding ? `${cs.padding}px` : "12px 16px" }}>
            <div style={{ flex: 1, minHeight: 0, position: "relative" }}>{content}</div>
          </div>
          {overlay}
        </div>
      </SlideTransitionView>
    </div>
  );};

  const renderGuideScreen = () => (
    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
      <div style={{ width: "min(1120px, 100%)", background: "#ffffff", borderRadius: 28, padding: "18px 18px 16px", boxShadow: "0 24px 70px rgba(15,23,42,.20)", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0, flex: "1 1 420px" }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#0f172a", marginBottom: 6 }}>{packageTitle}</div>
            <div style={{ fontSize: 13, lineHeight: 1.55, color: "#475569" }}>{packageBody}</div>
          </div>
          <button onClick={() => runDragDropAction(settings.packageBackAction || "intro", "intro")} style={{ ...ghostBtn, color: "#334155", borderColor: "#cbd5e1", background: "#ffffff", boxShadow: "none" }}>← {packageBackText}</button>
        </div>
        <ButtonPackageIntroDiagram pkgId={activity.buttonPackageId} config={packageScreen} />
        <div style={{ ...resolvePreviewButtonLayoutStyle(getScreenStyle("package"), { justifyContent: "center", gap: 10 }) }}>
          <button onClick={() => runDragDropAction(settings.packageBackAction || "intro", "intro")} style={screenGhostBtn("package")}>{packageBackText}</button>
          <button onClick={() => setPhase(nextAfterPackage)} style={screenBtn("package")}>{packageScreen.buttonText || "Etkinliğe Geç"}</button>
        </div>
      </div>
    </div>
  );

  const renderMenuPopup = () => (
    <div style={{ position: "absolute", left: 0, bottom: 56, width: 270, background: "#ffffff", borderRadius: 22, border: `1px solid ${accent}33`, boxShadow: "0 22px 60px rgba(15,23,42,.22)", padding: 12, zIndex: 8 }}>
      {[
        { id: "guide", icon: "?", label: settings.guideButtonText || "Tanıtım", action: () => runDragDropAction(settings.guideButtonAction || "package", "package") },
        { id: "restart", icon: "\u21ba", label: settings.restartFlowText || "Yeniden Başlat", action: () => runDragDropAction(settings.restartButtonAction || "restart", "restart") },
        { id: "sound", icon: audioMuted ? "S" : "A", label: audioMuted ? (settings.soundOnText || "Sesi Aç") : (settings.soundOffText || "Sesi Kapat"), action: () => setAudioMuted(value => !value) },
        { id: "home", icon: "H", label: settings.homeButtonText || "Ana Sayfa", action: () => runDragDropAction(settings.homeButtonAction || "intro", "intro") },
      ].map(item => (
        <button key={item.id} onClick={item.action} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 14, border: "none", background: "transparent", color: "#475569", fontSize: 13, fontWeight: 800, cursor: "pointer", textAlign: "left" }}>
          <span style={{ width: 28, height: 28, borderRadius: "50%", background: `${accent}18`, color: accentDark, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{item.icon}</span>
          {item.label}
        </button>
      ))}
    </div>
  );

  const renderResultPopup = () => {
    const success = status === "success";
    const bannerTheme = success
      ? { bg: "rgba(220,252,231,.96)", border: "rgba(34,197,94,.34)", title: successGreen, body: "#166534", iconBg: "#bbf7d0" }
      : { bg: "rgba(254,226,226,.96)", border: "rgba(239,68,68,.32)", title: dangerRed, body: "#991b1b", iconBg: "#fecaca" };
    const bodyText = success
      ? (resultScreens.successBody || "Do\u011fru cevab\u0131 buldun.")
      : (resultScreens.failureBody || "Baz\u0131 e\u015fle\u015ftirmeler yanl\u0131\u015f g\u00f6r\u00fcn\u00fcyor. \u0130stersen yeniden deneyebilir veya \u00e7\u00f6z\u00fcm\u00fc g\u00f6rebilirsin.");

    return (
      <div style={{ position: "absolute", inset: 0, zIndex: 12, pointerEvents: "none" }}>
        <div style={{ position: "absolute", left: 18, right: 18, bottom: 18, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, padding: "16px 22px", borderRadius: 24, background: bannerTheme.bg, border: `1px solid ${bannerTheme.border}`, boxShadow: "0 22px 50px rgba(15,23,42,.22)", backdropFilter: "blur(10px)", animation: "dd-banner-up .28s ease-out", pointerEvents: "auto", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0, flex: "1 1 340px" }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: bannerTheme.iconBg, color: bannerTheme.title, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 900, flexShrink: 0 }}>
              {success ? "\u2713" : "\u2715"}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: bannerTheme.title, marginBottom: 2 }}>{success ? "DO\u011eRU" : "YANLI\u015e"}</div>
              <div style={{ fontSize: 14, lineHeight: 1.55, color: bannerTheme.body, wordBreak: "break-word" }}>{bodyText}</div>
            </div>
          </div>
          <div style={{ ...resolvePreviewButtonLayoutStyle(getScreenStyle(success ? "success" : "failure"), { justifyContent: "flex-end", gap: 10 }), flex: "0 1 auto" }}>
            {success ? (
              <>
                <button onClick={() => runDragDropAction(settings.completeButtonAction || "complete", "complete")} style={{ ...primaryBtn, background: successGreen, borderColor: successGreen }}>{settings.completeButtonText || "Tamamla"}</button>
                <button onClick={() => runDragDropAction(settings.restartButtonAction || "restart", "restart")} style={{ ...ghostBtn, color: "#166534", borderColor: "rgba(34,197,94,.3)", background: "rgba(255,255,255,.72)" }}>{settings.restartFlowText || "Yeniden Başlat"}</button>
              </>
            ) : (
              <>
                <button onClick={retryCurrentPlacement} style={{ ...primaryBtn, background: accent, borderColor: accent }}>{resultScreens.retryText || "Tekrar Dene"}</button>
                <button onClick={() => runDragDropAction(settings.solutionButtonAction || "answer", "answer")} style={{ ...ghostBtn, color: "#991b1b", borderColor: "rgba(239,68,68,.28)", background: "rgba(255,255,255,.72)" }}>{settings.solutionButtonText || "Çözümü Göster"}</button>
                <button onClick={() => runDragDropAction(settings.restartButtonAction || "restart", "restart")} style={{ ...ghostBtn, color: "#334155", borderColor: "#cbd5e1", background: "rgba(255,255,255,.78)" }}>{settings.restartFlowText || "Yeniden Başlat"}</button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderPlayLayout = (forceCorrect = false, showEvaluation = true, extraBanner = null) => (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", gap: 12, overflow: "hidden" }}>
      {extraBanner}
      <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {renderStage(forceCorrect, showEvaluation)}
      </div>
      {developerHintMode && !forceCorrect && (
        <div style={{ padding: "12px 14px", borderRadius: 16, border: "1px solid rgba(74,222,128,.34)", background: "rgba(22,163,74,.12)", flexShrink: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#166534", marginBottom: 8, letterSpacing: 0.45, textTransform: "uppercase" }}>Geliştirici İpucu</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {autoAnswer.map((line, index) => (
              <div key={`${line}-${index}`} style={{ fontSize: 13, color: "#166534", lineHeight: 1.55 }}>{line}</div>
            ))}
          </div>
        </div>
      )}
      <div style={{ ...resolvePreviewButtonLayoutStyle(getScreenStyle("play"), { justifyContent: "space-between", gap: 14 }), alignItems: "flex-end", position: "relative", flexShrink: 0 }}>
        <div style={{ position: "relative" }}>
          <button onClick={() => runDragDropAction(settings.menuButtonAction || "toggle-menu", "toggle-menu")} style={{ padding: "13px 22px", borderRadius: 999, border: `1px solid ${accentDark}`, background: accent, color: "#ffffff", fontSize: 14, fontWeight: 900, cursor: "pointer", boxShadow: "0 14px 30px rgba(214,31,105,.28)" }}>
            {settings.menuButtonText || "☰ MENÜ"}
          </button>
          {menuOpen && phase === "play" && renderMenuPopup()}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {checking ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderRadius: 999, background: "rgba(255,255,255,.16)", color: "#ffffff" }}>
              <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid #ffffff", borderTopColor: "transparent", animation: "dd-spin 0.6s linear infinite" }} />
              <span style={{ fontSize: 13, fontWeight: 700 }}>Kontrol ediliyor...</span>
            </div>
          ) : (
            <button onClick={() => runDragDropAction(settings.checkButtonAction || "check", "check")} style={{ padding: "13px 22px", borderRadius: theme.radius || 999, border: `1px solid ${accent}`, background: theme.button, color: theme.text, fontSize: 14, fontWeight: 900, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 10, boxShadow: `0 12px 28px ${accent}2a` }}>
              <span style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(255,255,255,.9)", color: accent, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 900 }}>✓</span>
              {settings.checkButtonText || "Kontrol Et"}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  if (phase === "intro") {
    return renderShell("intro", "Karşılama", (
      <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
        <div style={{ width: "min(1040px, 100%)", background: "#ffffff", borderRadius: 34, padding: "42px 44px", position: "relative", boxShadow: "0 28px 90px rgba(15,23,42,.18)", overflow: "hidden" }}>
          <div style={{ position: "absolute", left: 0, top: 70, bottom: 70, width: 28, background: `linear-gradient(180deg,${accent},${accentDark})`, borderTopRightRadius: 24, borderBottomRightRadius: 24 }} />
          <div style={{ position: "absolute", right: 0, top: 70, bottom: 70, width: 28, background: `linear-gradient(180deg,${accent},${accentDark})`, borderTopLeftRadius: 24, borderBottomLeftRadius: 24 }} />
          <div style={{ textAlign: "center", color: "#0f172a", maxWidth: 780, margin: "0 auto" }}>
            <div style={{ fontSize: 34, fontWeight: 900, marginBottom: 10 }}>{intro.title || activity.name || "Etkinliğe Hoş Geldin"}</div>
            <div style={{ fontSize: 15, lineHeight: 1.75, color: "#64748b", marginBottom: 30 }}>{intro.body || "Hazır olduğunda etkinliği başlatabilir veya önce etkinlik tanıtımını inceleyebilirsin."}</div>
            <div style={{ ...resolvePreviewButtonLayoutStyle(getScreenStyle("intro"), { justifyContent: "center", gap: 18 }) }}>
              <button onClick={() => runDragDropAction(settings.guideButtonAction || "package", "package")} style={{ minWidth: 280, padding: "18px 28px", borderRadius: 999, border: `2px solid ${accent}`, background: "#fff1f7", color: accentDark, fontSize: 18, fontWeight: 900, cursor: "pointer" }}>
                ? {settings.guideButtonText || "Tanıtım"}
              </button>
              <button onClick={() => { setMenuOpen(false); setPhase(nextAfterIntro); }} style={{ minWidth: 280, padding: "18px 28px", borderRadius: 999, border: `2px solid ${accentDark}`, background: accent, color: "#ffffff", fontSize: 18, fontWeight: 900, cursor: "pointer", boxShadow: "0 18px 40px rgba(214,31,105,.28)" }}>
                {intro.buttonText || "Etkinliği Başlat"}
              </button>
            </div>
          </div>
        </div>
      </div>
    ));
  }

  if (phase === "package") {
    return renderShell("intro", "Kılavuz", renderGuideScreen());
  }

  if (phase === "answer") {
    return renderShell("play", "Çözüm", renderPlayLayout(true, false, (
      <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "12px 16px", borderRadius: 16, background: "#eaf4fb", border: "1px solid #d6e7f2", color: "#123a56", textAlign: "center", flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 800 }}>
          {answerScreen.title || "Doğru Cevap"}: öğeler doğru yerlerine yerleştirildi.
        </div>
        {answerScreen.body ? <div style={{ fontSize: 12, lineHeight: 1.6, opacity: 0.78 }}>{answerScreen.body}</div> : null}
        <div style={{ ...resolvePreviewButtonLayoutStyle(getScreenStyle("answer"), { justifyContent: "center", gap: 12 }) }}>
          <button onClick={() => runDragDropAction(settings.answerButtonAction || "restart", "restart")} style={screenGhostBtn("answer")}>{answerScreen.buttonText || "Yeniden Başlat"}</button>
        </div>
      </div>
    )));
  }

  const showResultOverlay = phase === "result" && !!status;
  return renderShell("play", "Etkinlik", renderPlayLayout(false, true), showResultOverlay ? renderResultPopup() : null);

  if (phase === "intro") { const _cs = getScreenStyle("intro"); return renderShell("intro", "Tanıtım", (
    <div style={{ color: (_cs.textColor || "#123a56"), textAlign: "center" }}>
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <div style={{ fontSize: 44, lineHeight: 1, marginBottom: 20 }}>ğŸ¯</div>
        <div style={{ fontSize: 30, fontWeight: 800, marginBottom: 14, letterSpacing: -0.5 }}>{intro.title || `${activity.name}`}</div>
        <div style={{ fontSize: 15, lineHeight: 1.75, opacity: 0.78, marginBottom: 32 }}>{intro.body || "Sürükleme etkinliğini tamamla."}</div>
        <button onClick={() => setPhase(nextAfterIntro)} style={screenBtn("intro")}>{intro.buttonText || "▶ Başla"}</button>
      </div>
    </div>
  )); }

  if (phase === "package") { const _cs = getScreenStyle("package"); return renderShell("intro", "Tema Paketi", (
    <div style={{ color: (_cs.textColor || "#123a56") }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ fontSize: 26, fontWeight: 800, marginBottom: 8, textAlign: "center" }}>{packageTitle}</div>
        <div style={{ fontSize: 14, lineHeight: 1.7, opacity: 0.78, marginBottom: 24, textAlign: "center" }}>{packageBody}</div>
        <ButtonPackageIntroDiagram pkgId={activity.buttonPackageId} config={packageScreen} />
        <div style={{ display: "flex", justifyContent: "center", marginTop: 28 }}>
          <button onClick={() => setPhase(nextAfterPackage)} style={screenBtn("package")}>{packageScreen.buttonText || "Menüye Geç →"}</button>
        </div>
      </div>
    </div>
  )); }

  if (phase === "menu") { const _cs = getScreenStyle("menu"); return renderShell("intro", "Menü", (
    <div style={{ color: (_cs.textColor || "#123a56"), textAlign: "center" }}>
      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        <div style={{ fontSize: 30, fontWeight: 800, marginBottom: 12, letterSpacing: -0.5 }}>{menuScreen.title}</div>
        <div style={{ fontSize: 15, lineHeight: 1.75, opacity: 0.78, marginBottom: 28 }}>{menuScreen.body}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 32, maxWidth: 420, margin: "0 auto 32px" }}>
          {[{ label: "Sürükle", val: drags.length }, { label: "Alan", val: drops.length }, { label: "Puan", val: settings.scorePoints || 0 }].map(item => (
            <div key={item.label} style={{ padding: "14px 10px", borderRadius: 16, background: `${theme.border}14`, border: `1px solid ${theme.border}22`, textAlign: "center" }}>
              <div style={{ fontSize: 10, opacity: 0.58, marginBottom: 6, fontWeight: 600 }}>{item.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{item.val}</div>
            </div>
          ))}
        </div>
        <button onClick={() => setPhase(nextAfterMenu)} style={screenBtn("menu")}>{menuScreen.buttonText || "Etkinliğe Geç →"}</button>
      </div>
    </div>
  )); }

  if (phase === "result") {
    const success = status === "success";
    return renderShell(success ? "success" : "failure", success ? "✓ Doğru" : "✗ Yanlış", (
      <div style={{ color: theme.text, textAlign: "center" }}>
        <div style={{ maxWidth: 520, margin: "0 auto" }}>
          <div style={{ fontSize: 64, lineHeight: 1, marginBottom: 20 }}>{success ? "ğŸ†" : "ğŸ’ª"}</div>
          <div style={{ fontSize: 34, fontWeight: 800, marginBottom: 12, letterSpacing: -0.6 }}>{success ? (resultScreens.successTitle || "Harika!") : (resultScreens.failureTitle || "Tekrar Deneyelim")}</div>
          <div style={{ fontSize: 15, lineHeight: 1.75, opacity: 0.78, marginBottom: 32 }}>{success ? resultScreens.successBody : resultScreens.failureBody}</div>
          <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
            {!success && canRetry && <button onClick={() => { setPhase("play"); setStatus(null); setChecking(false); setCheckResult(null); setSubmittedMatches({}); setMatched({}); setPositions({}); setTimelineTime(0); }} style={screenBtn("failure")}>{resultScreens.retryText || "↺ Tekrar Dene"}</button>}
            {!success && settings.showAnswerLayer !== false && <button onClick={revealAnswer} style={screenGhostBtn("failure")}>{settings.answerButtonText || "Cevabı Gör"}</button>}
            {success && hasNextStep && <button onClick={() => onNextStep?.()} style={screenBtn("success")}>{nextStepLabel} →</button>}
            <button onClick={() => { setPhase(getInitialPreviewPhase(activity)); setStatus(null); setChecking(false); setCheckResult(null); setSubmittedMatches({}); setMatched({}); setPositions({}); setAttempts(0); setTimelineTime(0); }} style={screenGhostBtn("success")}>{resultScreens.continueText || "Yeniden Başlat"}</button>
          </div>
        </div>
      </div>
    ));
  }

  if (phase === "answer") return renderShell("failure", "Doğru Cevap", (
    <div style={{ color: theme.text }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 20 }}>{answerScreen.title || "Doğru Cevap"}</div>
        {renderStage(true, false)}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12, marginTop: 20, marginBottom: 28 }}>
          <div style={{ padding: "14px 16px", borderRadius: 16, background: "rgba(22,163,74,.16)", border: "1px solid rgba(74,222,128,.36)" }}>
            <div style={{ fontSize: 11, fontWeight: 800, marginBottom: 10, color: "#86efac" }}>OGRNCININ DOGRU CEVAPLARI</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {drags.filter(d => submittedMatches[d.id] && checkResult?.[d.id] === true).length
                ? drags.filter(d => submittedMatches[d.id] && checkResult?.[d.id] === true).map(d => {
                  const drop = dropById[submittedMatches[d.id]];
                  return (
                    <div key={d.id} style={{ fontSize: 13, color: "#f0fdf4", display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ color: "#86efac" }}>✓</span>
                      <span>{`${d.label || "Sürükle"} → ${drop?.label || "Bırak"}`}</span>
                    </div>
                  );
                })
                : <div style={{ fontSize: 12, color: "#d1fae5" }}>Dogru cevap yok.</div>}
            </div>
          </div>
          <div style={{ padding: "14px 16px", borderRadius: 16, background: "rgba(185,28,28,.16)", border: "1px solid rgba(248,113,113,.36)" }}>
            <div style={{ fontSize: 11, fontWeight: 800, marginBottom: 10, color: "#fca5a5" }}>OGRNCININ YANLIS CEVAPLARI</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {drags.filter(d => !submittedMatches[d.id] || checkResult?.[d.id] === false).length
                ? drags.filter(d => !submittedMatches[d.id] || checkResult?.[d.id] === false).map(d => {
                  const drop = dropById[submittedMatches[d.id]];
                  return (
                    <div key={d.id} style={{ fontSize: 13, color: "#fef2f2", display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ color: "#fca5a5" }}>✗</span>
                      <span>{`${d.label || "Sürükle"} → ${drop?.label || "Birakilmadi"}`}</span>
                    </div>
                  );
                })
                : <div style={{ fontSize: 12, color: "#fee2e2" }}>Yanlis cevap yok.</div>}
            </div>
          </div>
        </div>
        <div style={{ ...resolvePreviewButtonLayoutStyle(getScreenStyle("answer"), { justifyContent: "center", gap: 12 }) }}>
          <button onClick={() => runDragDropAction(settings.answerButtonAction || "restart", "restart")} style={screenGhostBtn("answer")}>{answerScreen.buttonText || "Yeniden Başlat"}</button>
        </div>
      </div>
    </div>
  ));

  return renderShell("play", "Etkinlik", (
    <div style={{ color: theme.text }}>
      {(playScreen.title || activity.name) && (
        <div style={{ textAlign: "center", fontSize: 18, fontWeight: 800, marginBottom: 6, letterSpacing: -0.3 }}>{playScreen.title || activity.name}</div>
      )}
      <div style={{ textAlign: "center", fontSize: 13, opacity: 0.6, marginBottom: 20, lineHeight: 1.6 }}>{playScreen.body || "Öğeleri doğru alanlara sürükle ve kontrol et."}</div>
      {renderStage(false)}
      {developerHintMode && (
        <div style={{ marginTop: 18, padding: "12px 14px", borderRadius: 16, border: "1px solid rgba(74,222,128,.34)", background: "rgba(22,163,74,.1)" }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#86efac", marginBottom: 8, letterSpacing: 0.45, textTransform: "uppercase" }}>Gelistirici Ipucu</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {getAutoAnswerSummary(activity).map((line, index) => (
              <div key={`${line}-${index}`} style={{ fontSize: 13, color: "#f0fdf4", lineHeight: 1.55 }}>{line}</div>
            ))}
          </div>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginTop: 28, flexWrap: "wrap" }}>
        {checking ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${theme.border}`, borderTopColor: "transparent", animation: "dd-spin 0.6s linear infinite" }} />
            <span style={{ fontSize: 13, opacity: 0.7 }}>Kontrol ediliyor...</span>
          </div>
        ) : status ? (
          <button onClick={() => setPhase("result")} style={screenBtn("play")}>
            {resultScreens.continueText || "Sonucu Gör"} →
          </button>
        ) : (
          <button
            onClick={() => {
              const resultByDrag = Object.fromEntries(drags.map(d => [d.id, matched[d.id] && matched[d.id] === correctMatches[d.id]]));
              const ok = drags.length > 0 && drags.every(d => resultByDrag[d.id]);
              setSubmittedMatches({ ...matched });
              setCheckResult(resultByDrag);
              setStatus(ok ? "success" : "failure");
              setChecking(true);
              setTimelinePlaying(false);
              setTimeout(() => { setChecking(false); setAttempts(p => p + 1); }, 1600);
            }}
            style={screenBtn("play")}
          >
            {(settings.checkButtonText || "Kontrol Et")} →
          </button>
        )}
        <div style={{ fontSize: 12, opacity: 0.48 }}>Deneme: {attempts}{settings.maxAttempts > 0 ? ` / ${settings.maxAttempts}` : ""}</div>
      </div>
    </div>
  ));
}

// ─── Seçim Editörü ────────────────────────────────────────────────────────────

function SelectionEditor({ activity, onUpdate }) {
  const patch = (p) => onUpdate({ ...activity, ...p });
  const patchOption = (id, p) => patch({ mcOptions: activity.mcOptions.map(o => o.id === id ? { ...o, ...p } : o) });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#00BCD4" }}>SORU AYARLARI</div>
      <Inp label="Soru Metni" value={activity.mcQuestion || ""} onChange={e => patch({ mcQuestion: e.target.value })} type="textarea" />
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {[{ k: "single", l: "Tekli" }, { k: "multi", l: "Çoklu" }].map(m => (
          <Btn key={m.k} onClick={() => patch({ mcMode: m.k })} color={activity.mcMode === m.k ? "#00BCD4" : "#555"} small>{m.l} Seçim</Btn>
        ))}
        <Btn onClick={() => patch({ mcOptions: [...(activity.mcOptions || []), { id: uid(), label: `Seçenek ${(activity.mcOptions?.length || 0) + 1}`, isCorrect: false }] })} color="#4CAF50" small>+ Seçenek</Btn>
      </div>
      {(activity.mcOptions || []).map((o, i) => (
        <div key={o.id} style={{ background: "#111125", border: "1px solid #252540", borderRadius: 8, padding: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 10, color: "#555" }}>Seçenek {i + 1}</span>
            <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: o.isCorrect ? "#4CAF50" : "#555", marginLeft: "auto", cursor: "pointer" }}>
              <input type="checkbox" checked={o.isCorrect} onChange={e => patchOption(o.id, { isCorrect: e.target.checked })} style={{ accentColor: "#4CAF50" }} />Doğru
            </label>
            <button onClick={() => patch({ mcOptions: activity.mcOptions.filter(x => x.id !== o.id) })} style={{ background: "none", border: "none", color: "#f44336", cursor: "pointer", fontSize: 12 }}>✕</button>
          </div>
          <Inp value={o.label || ""} onChange={e => patchOption(o.id, { label: e.target.value })} placeholder="Seçenek metni..." />
        </div>
      ))}
    </div>
  );
}

// ─── Sürükle-Bırak Yapılandırma Paneli ───────────────────────────────────────

function DragDropConfigPanel({ activity, onUpdate }) {
  const objects = activity.objects || [];
  const draggables = objects.filter(o => o.type === "draggable");
  const dropzones = objects.filter(o => o.type === "dropzone");
  const mode = activity.dragDropMode || "single";
  const matches = activity.dragDropMatches || {};

  const setMode = (m) => onUpdate({ ...activity, dragDropMode: m, dragDropMatches: {} });
  const setMatch = (dragId, dropId) => onUpdate({ ...activity, dragDropMatches: { ...matches, [dragId]: dropId } });
  const patchObj = (id, p) => onUpdate({ ...activity, objects: objects.map(o => o.id === id ? { ...o, ...p } : o) });

  const isGroupMode = mode === "group" || mode === "multi-group";
  const resolvedMatches = getCorrectDragMatches(activity);
  const resolvedCount = draggables.filter(d => resolvedMatches[d.id]).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Mod Seçimi */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#FF9800", marginBottom: 8, letterSpacing: 1 }}>SÜRÜKLE-BIRAK MODU</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {DRAG_DROP_MODES.map(m => (
            <div key={m.id} onClick={() => setMode(m.id)} style={{ padding: "8px 10px", borderRadius: 8, cursor: "pointer", border: `1px solid ${mode === m.id ? "#FF9800" : "#252540"}`, background: mode === m.id ? "#FF980022" : "#111125", transition: "all .15s" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: mode === m.id ? "#FF9800" : "#B0BEC5", marginBottom: 2 }}>{m.label}</div>
              <div style={{ fontSize: 9, color: "#555", lineHeight: 1.4 }}>{m.desc}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8, fontSize: 10, color: "#94a3b8" }}>
          <span>{draggables.length} surukle</span>
          <span>{dropzones.length} birak alani</span>
          <span>{resolvedCount} dogru eslesme</span>
        </div>
      </div>

      {/* Grup modu: grup etiketleri */}
      {isGroupMode && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#78909C", marginBottom: 8 }}>GRUP ETİKETLERİ</div>
          <div style={{ fontSize: 10, color: "#555", marginBottom: 8, lineHeight: 1.5 }}>
            Sürüklenebilir ve bırakma alanlarına aynı grup etiketini yazın. Önizlemede eşleşme otomatik yapılır.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {draggables.map((d, i) => (
              <div key={d.id} style={{ display: "flex", gap: 6, alignItems: "center", background: "#0d0d1a", borderRadius: 6, padding: "6px 8px", border: "1px solid #252540" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: d.style?.borderColor || "#00BCD4", flexShrink: 0 }} />
                <span style={{ fontSize: 10, color: "#B0BEC5", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.label || `Sürükle ${i + 1}`}</span>
                <input value={d.group || ""} onChange={e => patchObj(d.id, { group: e.target.value })} placeholder="grup" style={{ width: 70, padding: "3px 6px", borderRadius: 4, border: "1px solid #00BCD4", background: "#1a1a30", color: "#00BCD4", fontSize: 10, outline: "none" }} />
              </div>
            ))}
            {dropzones.map((dz, i) => (
              <div key={dz.id} style={{ display: "flex", gap: 6, alignItems: "center", background: "#0d0d1a", borderRadius: 6, padding: "6px 8px", border: "1px solid #252540" }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: "#FF9800", flexShrink: 0 }} />
                <span style={{ fontSize: 10, color: "#B0BEC5", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{dz.label || `Bırak ${i + 1}`}</span>
                <input value={dz.group || ""} onChange={e => patchObj(dz.id, { group: e.target.value })} placeholder="grup" style={{ width: 70, padding: "3px 6px", borderRadius: 4, border: "1px solid #FF9800", background: "#1a1a30", color: "#FF9800", fontSize: 10, outline: "none" }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tekli / Çoklu Tekli: eşleşme tablosu */}
      {!isGroupMode && draggables.length > 0 && dropzones.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#78909C", marginBottom: 8 }}>DOĞRU EŞLEŞMELERİ AYARLA</div>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <Btn onClick={() => onUpdate({ ...activity, dragDropMatches: buildAutoDragMatches(activity) })} color="#4CAF50" small>Oto Doldur</Btn>
            <Btn onClick={() => onUpdate({ ...activity, dragDropMatches: {} })} color="#607D8B" small>Temizle</Btn>
          </div>
          <div style={{ background: "#0d0d1a", border: "1px solid #252540", borderRadius: 8, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 20px 1fr", padding: "6px 10px", background: "#111125", borderBottom: "1px solid #252540" }}>
              <div style={{ fontSize: 9, color: "#555", fontWeight: 700 }}>SÜRÜKLE</div>
              <div />
              <div style={{ fontSize: 9, color: "#555", fontWeight: 700 }}>BIRAK</div>
            </div>
            {draggables.map((d, i) => (
              <div key={d.id} style={{ display: "grid", gridTemplateColumns: "1fr 20px 1fr", alignItems: "center", padding: "7px 10px", borderBottom: i < draggables.length - 1 ? "1px solid #1a1a30" : "none", gap: 4 }}>
                <div style={{ fontSize: 11, color: "#00BCD4", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.label || `Sürükle ${i + 1}`}</div>
                <div style={{ textAlign: "center", color: "#555", fontSize: 12 }}>→</div>
                <select
                  value={matches[d.id] || ""}
                  onChange={e => setMatch(d.id, e.target.value)}
                  style={{ padding: "4px 6px", borderRadius: 5, border: `1px solid ${matches[d.id] ? "#FF9800" : "#333"}`, background: "#1a1a30", color: matches[d.id] ? "#FF9800" : "#666", fontSize: 10, outline: "none", width: "100%" }}
                >
                  <option value="">— Seçin —</option>
                  {dropzones.map(dz => <option key={dz.id} value={dz.id}>{dz.label || dz.id.slice(-4)}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 9, color: "#444", marginTop: 6, lineHeight: 1.5 }}>
            {mode === "multi-single" ? "Birden fazla öge aynı bırakma alanını seçebilir." : "Her sürükleme ögesi farklı bir alana atanmalı."}
          </div>
        </div>
      )}

      {draggables.length === 0 && <div style={{ fontSize: 10, color: "#444", padding: "8px 0", textAlign: "center" }}>Canvas'a sürüklenebilir öge ekleyin</div>}
      {!isGroupMode && dropzones.length === 0 && draggables.length > 0 && <div style={{ fontSize: 10, color: "#444", padding: "8px 0", textAlign: "center" }}>Canvas'a bırakma alanı ekleyin</div>}
    </div>
  );
}

// ─── Ekran Akışı Editörü ──────────────────────────────────────────────────────

function MixedActivityEditor({ activity, onUpdate }) {
  const objects = activity.objects || [];
  const draggables = objects.filter(o => o.type === "draggable");
  const dropzones = objects.filter(o => o.type === "dropzone");
  const options = activity.mcOptions || [];
  const correctOptions = options.filter(option => option.isCorrect).length;
  const resolvedMatches = getCorrectDragMatches(activity);
  const resolvedCount = draggables.filter(item => resolvedMatches[item.id]).length;
  const shellCard = {
    background: "#ffffff",
    border: "1px solid #d7e0eb",
    borderRadius: 18,
    padding: 14,
    boxShadow: "0 12px 24px rgba(15,23,42,.06)",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ ...shellCard, background: "linear-gradient(180deg,#eff6ff,#ffffff)" }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: "#2563eb", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 }}>
          Karma Etkinlik Akisi
        </div>
        <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>
          Secim ve surukle-birak ayni panelde
        </div>
        <div style={{ fontSize: 11, color: "#475569", lineHeight: 1.7, marginBottom: 12 }}>
          Bu turde ogrenci hem secenek isaretler hem de nesneleri dogru alanlara birakir. Once soru yapisini,
          sonra drag-drop eslesmelerini tamamlayabilirsin.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 8 }}>
          <div style={{ padding: "10px 12px", borderRadius: 14, background: "#ffffff", border: "1px solid #dbeafe" }}>
            <div style={{ fontSize: 10, color: "#64748b", marginBottom: 4 }}>Secenek</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>{options.length}</div>
            <div style={{ fontSize: 10, color: "#2563eb", marginTop: 4 }}>{correctOptions} dogru</div>
          </div>
          <div style={{ padding: "10px 12px", borderRadius: 14, background: "#ffffff", border: "1px solid #ccfbf1" }}>
            <div style={{ fontSize: 10, color: "#64748b", marginBottom: 4 }}>Surukle</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>{draggables.length}</div>
            <div style={{ fontSize: 10, color: "#0891b2", marginTop: 4 }}>hareketli oge</div>
          </div>
          <div style={{ padding: "10px 12px", borderRadius: 14, background: "#ffffff", border: "1px solid #ffedd5" }}>
            <div style={{ fontSize: 10, color: "#64748b", marginBottom: 4 }}>Birakma Alani</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>{dropzones.length}</div>
            <div style={{ fontSize: 10, color: "#ea580c", marginTop: 4 }}>{resolvedCount} eslesme hazir</div>
          </div>
        </div>
      </div>

      <div style={shellCard}>
        <div style={{ fontSize: 11, fontWeight: 800, color: "#00BCD4", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 10 }}>
          1. Soru ve Secenekler
        </div>
        <SelectionEditor activity={activity} onUpdate={onUpdate} />
      </div>

      <div style={shellCard}>
        <div style={{ fontSize: 11, fontWeight: 800, color: "#FF9800", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 10 }}>
          2. Surukle-Birak Kurgusu
        </div>
        <DragDropConfigPanel activity={activity} onUpdate={onUpdate} />
      </div>
    </div>
  );
}

function ActivityScreenFlowEditor({ activity, onUpdate, simplified = false }) {
  const settings = activity.settings || DEFAULT_ACTIVITY_SETTINGS;
  const intro = activity.introScreen || {};
  const packageScreen = activity.buttonPackageScreen || {};
  const menuScreen = activity.menuScreen || {};
  const playScreen = activity.playScreen || {};
  const results = activity.resultScreens || {};
  const answerScreen = activity.answerScreen || {};
  const patch = (p) => onUpdate({ ...activity, ...p });
  const patchSettings = (p) => patch({ settings: { ...settings, ...p } });
  const patchIntro = (p) => patch({ introScreen: { ...intro, ...p } });
  const patchPackage = (p) => patch({ buttonPackageScreen: { ...packageScreen, ...p } });
  const patchMenu = (p) => patch({ menuScreen: { ...menuScreen, ...p } });
  const patchPlay = (p) => patch({ playScreen: { ...playScreen, ...p } });
  const patchResults = (p) => patch({ resultScreens: { ...results, ...p } });
  const patchAnswer = (p) => patch({ answerScreen: { ...answerScreen, ...p } });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#B388FF" }}>EKRAN AKIŞI</div>

      {[
        { label: "Tanitim Ekrani", color: "#B388FF", checked: intro.enabled !== false, toggle: v => patchIntro({ enabled: v }), fields: [{ l: "Baslik", v: intro.title || "", onChange: e => patchIntro({ title: e.target.value }) }, { l: "Aciklama", v: intro.body || "", onChange: e => patchIntro({ body: e.target.value }), rows: 2 }, { l: "Buton", v: intro.buttonText || "", onChange: e => patchIntro({ buttonText: e.target.value }) }] },
        ...(!simplified ? [{ label: "Tema Paketi Tanitimi", color: "#22d3ee", checked: settings.showButtonPackageIntro !== false && packageScreen.enabled !== false, toggle: v => { patchSettings({ showButtonPackageIntro: v }); patchPackage({ enabled: v }); }, fields: [{ l: "Baslik", v: packageScreen.title || "", onChange: e => patchPackage({ title: e.target.value }) }, { l: "Aciklama", v: packageScreen.body || "", onChange: e => patchPackage({ body: e.target.value }), rows: 2 }, { l: "Buton", v: packageScreen.buttonText || "", onChange: e => patchPackage({ buttonText: e.target.value }) }] }, { label: "Menu Katmani", color: "#f59e0b", checked: settings.showMenuScreen !== false && menuScreen.enabled !== false, toggle: v => { patchSettings({ showMenuScreen: v }); patchMenu({ enabled: v }); }, fields: [{ l: "Baslik", v: menuScreen.title || "", onChange: e => patchMenu({ title: e.target.value }) }, { l: "Aciklama", v: menuScreen.body || "", onChange: e => patchMenu({ body: e.target.value }), rows: 2 }, { l: "Buton", v: menuScreen.buttonText || "", onChange: e => patchMenu({ buttonText: e.target.value }) }] }] : []),
        { label: simplified ? "İçerik Sahnesi" : "Oyun Katmani", color: "#60a5fa", checked: true, toggle: null, fields: [{ l: "Baslik", v: playScreen.title || "", onChange: e => patchPlay({ title: e.target.value }) }, { l: "Aciklama", v: playScreen.body || "", onChange: e => patchPlay({ body: e.target.value }), rows: 2 }] },
      ].map(s => (
        <div key={s.label} style={{ background: "#111125", border: "1px solid #252540", borderRadius: 8, padding: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: s.color }}>{s.label}</div>
            {s.toggle && <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#78909C", cursor: "pointer" }}><input type="checkbox" checked={s.checked} onChange={e => s.toggle(e.target.checked)} style={{ accentColor: s.color }} />Aktif</label>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {s.fields.map(f => <Inp key={f.l} label={f.l} value={f.v} onChange={f.onChange} type={f.rows ? "textarea" : "text"} rows={f.rows} />)}
          </div>
        </div>
      ))}

      {!simplified && <>
        <div style={{ background: "#111125", border: "1px solid #252540", borderRadius: 8, padding: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#B0BEC5", marginBottom: 8 }}>Sonuc Ekranlari</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <Inp label="Basari Basligi" value={results.successTitle || ""} onChange={e => patchResults({ successTitle: e.target.value })} />
            <Inp label="Basari Metni" value={results.successBody || ""} onChange={e => patchResults({ successBody: e.target.value })} />
            <Inp label="Basarisiz Baslik" value={results.failureTitle || ""} onChange={e => patchResults({ failureTitle: e.target.value })} />
            <Inp label="Basarisiz Metin" value={results.failureBody || ""} onChange={e => patchResults({ failureBody: e.target.value })} />
            <div style={{ display: "flex", gap: 6 }}>
              <Inp label="Tekrar" value={results.retryText || ""} onChange={e => patchResults({ retryText: e.target.value })} />
              <Inp label="Devam" value={results.continueText || ""} onChange={e => patchResults({ continueText: e.target.value })} />
            </div>
          </div>
        </div>
        <div style={{ background: "#111125", border: "1px solid #252540", borderRadius: 8, padding: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#B0BEC5", marginBottom: 8 }}>Davranis</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", gap: 6 }}>
              <SelectInp label="Tamamlanma" value={settings.completionMode || "required"} onChange={e => patchSettings({ completionMode: e.target.value })} options={[{ value: "required", label: "Zorunlu" }, { value: "optional", label: "Istege Bagli" }]} />
              <Inp label="Puan" type="number" value={settings.scorePoints ?? 10} onChange={e => patchSettings({ scorePoints: +e.target.value || 0 })} />
            </div>
            {["shuffleOptions", "showFeedback", "allowRetry", "showAnswerLayer"].map(key => (
              <label key={key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#78909C", cursor: "pointer" }}>
                <input type="checkbox" checked={!!settings[key]} onChange={e => patchSettings({ [key]: e.target.checked })} style={{ accentColor: "#7C4DFF" }} />
                {key === "shuffleOptions" ? "Secenekleri karistir" : key === "showFeedback" ? "Sonuc goster" : key === "allowRetry" ? "Tekrar deneme" : "Cevap katmani"}
              </label>
            ))}
            <div style={{ display: "flex", gap: 6 }}>
              <Inp label="Maks Deneme" type="number" value={settings.maxAttempts ?? 0} onChange={e => patchSettings({ maxAttempts: Math.max(0, +e.target.value || 0) })} />
              <Inp label="Cevap Butonu" value={settings.answerButtonText || ""} onChange={e => patchSettings({ answerButtonText: e.target.value })} />
            </div>
            <div style={{ background: "#111125", border: "1px solid #252540", borderRadius: 8, padding: 10, marginTop: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#B0BEC5", marginBottom: 8 }}>Cevap Ekrani</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <Inp label="Baslik" value={answerScreen.title || ""} onChange={e => patchAnswer({ title: e.target.value })} />
                <Inp label="Aciklama" value={answerScreen.body || ""} onChange={e => patchAnswer({ body: e.target.value })} type="textarea" rows={2} />
                <Inp label="Buton" value={answerScreen.buttonText || ""} onChange={e => patchAnswer({ buttonText: e.target.value })} />
              </div>
            </div>
          </div>
        </div>
      </>}
    </div>
  );
}

function ActivityTextEditor({ activity, onUpdate, designPresets = [], onSavePreset, onApplyPreset, onDeletePreset, visibleSectionIds = [], preferredOpenSection = "intro", sectionTitle = "" }) {
  const [openSection, setOpenSection] = useState("intro");
  const [openSub, setOpenSub] = useState("text");
  const [presetName, setPresetName] = useState("");
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const intro = activity.introScreen || {};
  const packageScreen = activity.buttonPackageScreen || {};
  const menuScreen = activity.menuScreen || {};
  const playScreen = activity.playScreen || {};
  const results = activity.resultScreens || {};
  const answerScreen = activity.answerScreen || {};
  const settings = activity.settings || {};
  const resolvedPackageTitle = !packageScreen.title || /buton paketi/i.test(packageScreen.title) ? "Tema Paketi Tanıtımı" : packageScreen.title;
  const resolvedPackageBody = !packageScreen.body || /buton.*davran/i.test(packageScreen.body) ? "Etkinlikte kullanacağın tema paketini ve buton davranışlarını önce incele." : packageScreen.body;
  const packageItems = resolveThemePackageItems(packageScreen);
  const patch = (p) => onUpdate({ ...activity, ...p });
  const patchIntro = (p) => patch({ introScreen: { ...intro, ...p } });
  const patchPackage = (p) => patch({ buttonPackageScreen: { ...packageScreen, ...p } });
  const patchPackageItem = (itemId, nextPatch) => patchPackage({ items: packageItems.map(item => item.id === itemId ? { ...item, ...nextPatch } : item) });
  const patchMenu = (p) => patch({ menuScreen: { ...menuScreen, ...p } });
  const patchPlay = (p) => patch({ playScreen: { ...playScreen, ...p } });
  const patchResults = (p) => patch({ resultScreens: { ...results, ...p } });
  const patchAnswer = (p) => patch({ answerScreen: { ...answerScreen, ...p } });
  const patchSettings = (p) => patch({ settings: { ...settings, ...p } });

  const theme = getPackageTheme(activity.buttonPackageId);
  const normalizedVisibleSectionIds = Array.isArray(visibleSectionIds) ? visibleSectionIds.filter(Boolean) : [];
  const selectedPreset = designPresets.find(item => item.id === selectedPresetId) || null;

  useEffect(() => {
    if (!preferredOpenSection) return;
    setOpenSection(preferredOpenSection);
    setOpenSub(preferredOpenSection === "behavior" ? "behavior" : "text");
  }, [preferredOpenSection]);

  useEffect(() => {
    setPresetName(`${activity?.name || "Yeni Tasarım"} Tasarımı`);
  }, [activity?.id, activity?.name]);

  useEffect(() => {
    if (!designPresets.length) {
      setSelectedPresetId("");
      return;
    }
    if (!designPresets.some(item => item.id === selectedPresetId)) {
      setSelectedPresetId(designPresets[0].id);
    }
  }, [designPresets, selectedPresetId]);

  const handleSaveCurrentPreset = () => {
    const finalName = String(presetName || "").trim() || `${activity?.name || "Yeni Tasarım"} Tasarımı`;
    const savedId = onSavePreset?.(finalName, activity);
    if (savedId) setSelectedPresetId(savedId);
  };

  const handleApplySelectedPreset = () => {
    if (!selectedPreset) return;
    onApplyPreset?.(selectedPreset.id, activity?.id);
  };

  const handleDeleteSelectedPreset = () => {
    if (!selectedPreset) return;
    if (typeof window !== "undefined" && !window.confirm(`"${selectedPreset.name}" tasarımını silmek istiyor musun?`)) return;
    onDeletePreset?.(selectedPreset.id);
    setSelectedPresetId("");
  };

  const inputBase = { width: "100%", padding: "5px 8px", borderRadius: 5, border: "1px solid #333", background: "#0f0f20", color: "#E0E0E0", fontSize: 11, boxSizing: "border-box", outline: "none" };
  const colorInput = (value, onChange, label) => (
    <div style={{ flex: 1, minWidth: 60 }}>
      <label style={{ fontSize: 9, color: "#78909C", display: "block", marginBottom: 2 }}>{label}</label>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <input type="color" value={value || "#000000"} onChange={onChange} style={{ width: 28, height: 24, border: "1px solid #333", borderRadius: 4, padding: 0, cursor: "pointer", background: "transparent" }} />
        <input type="text" value={value || ""} onChange={onChange} placeholder="#hex" style={{ ...inputBase, flex: 1 }} />
      </div>
    </div>
  );
  const numInput = (value, onChange, label, min = 0, max = 999) => (
    <div style={{ flex: 1, minWidth: 50 }}>
      <label style={{ fontSize: 9, color: "#78909C", display: "block", marginBottom: 2 }}>{label}</label>
      <input type="number" value={value ?? ""} onChange={onChange} min={min} max={max} style={inputBase} />
    </div>
  );
  const textInput = (value, onChange, label, placeholder = "", rows) => (
    <div>
      <label style={{ fontSize: 9, color: "#78909C", display: "block", marginBottom: 2 }}>{label}</label>
      {rows
        ? <textarea value={value || ""} onChange={onChange} rows={rows} placeholder={placeholder} style={{ ...inputBase, resize: "vertical" }} />
        : <input type="text" value={value || ""} onChange={onChange} placeholder={placeholder} style={inputBase} />
      }
    </div>
  );
  const selectInput = (value, onChange, label, options = []) => (
    <div>
      <label style={{ fontSize: 9, color: "#78909C", display: "block", marginBottom: 2 }}>{label}</label>
      <select value={value ?? options?.[0]?.value ?? ""} onChange={onChange} style={inputBase}>
        {options.map(option => <option key={`${label}-${option.value}`} value={option.value}>{option.label}</option>)}
      </select>
    </div>
  );

  const buttonAlignOptions = [
    { value: "left", label: "Sol" },
    { value: "center", label: "Orta" },
    { value: "right", label: "Sağ" },
    { value: "split", label: "İki Yana" },
  ];
  const buttonDirectionOptions = [
    { value: "row", label: "Yatay" },
    { value: "column", label: "Alt Alta" },
  ];
  const guideActionOptions = [
    { value: "package", label: "Tema paketini aç" },
    { value: "menu", label: "Menüye git" },
    { value: "play", label: "Oyuna git" },
    { value: "intro", label: "Karşılama ekranı" },
    { value: "none", label: "Hiçbir şey yapma" },
  ];
  const packageBackActionOptions = [
    { value: "intro", label: "Karşılama ekranı" },
    { value: "menu", label: "Menü ekranı" },
    { value: "play", label: "Oyun ekranı" },
    { value: "restart", label: "Akışı baştan başlat" },
    { value: "none", label: "Hiçbir şey yapma" },
  ];
  const menuButtonActionOptions = [
    { value: "toggle-menu", label: "Açılır menüyü aç/kapat" },
    { value: "package", label: "Tema paketini aç" },
    { value: "menu", label: "Menü ekranına git" },
    { value: "intro", label: "Karşılama ekranı" },
    { value: "play", label: "Oyun ekranı" },
    { value: "restart", label: "Akışı sıfırla" },
    { value: "none", label: "Hiçbir şey yapma" },
  ];
  const checkButtonActionOptions = [
    { value: "check", label: "Cevabı kontrol et" },
    { value: "result", label: "Sonuç ekranını aç" },
    { value: "answer", label: "Doğru cevabı göster" },
    { value: "restart", label: "Akışı sıfırla" },
    { value: "none", label: "Hiçbir şey yapma" },
  ];
  const utilityActionOptions = [
    { value: "answer", label: "Doğru cevabı göster" },
    { value: "play", label: "Oyun ekranına dön" },
    { value: "intro", label: "Karşılama ekranı" },
    { value: "menu", label: "Menü ekranı" },
    { value: "restart", label: "Akışı sıfırla" },
    { value: "none", label: "Hiçbir şey yapma" },
  ];
  const completeActionOptions = [
    { value: "complete", label: "Tamamla / sonraki adıma geç" },
    { value: "play", label: "Oyun ekranına git" },
    { value: "intro", label: "Karşılama ekranı" },
    { value: "menu", label: "Menü ekranı" },
    { value: "restart", label: "Akışı sıfırla" },
    { value: "none", label: "Hiçbir şey yapma" },
  ];
  const homeActionOptions = [
    { value: "intro", label: "Karşılama ekranı" },
    { value: "menu", label: "Menü ekranı" },
    { value: "package", label: "Tema paketi ekranı" },
    { value: "play", label: "Oyun ekranı" },
    { value: "restart", label: "Akışı sıfırla" },
    { value: "none", label: "Hiçbir şey yapma" },
  ];

  const SubTab = ({ id, label, icon, current, onClick }) => (
    <button onClick={() => onClick(id)} style={{ padding: "4px 8px", borderRadius: 6, border: `1px solid ${current === id ? "#7C4DFF44" : "#252540"}`, background: current === id ? "#7C4DFF18" : "transparent", color: current === id ? "#B388FF" : "#78909C", fontSize: 10, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
      <span style={{ fontSize: 11 }}>{icon}</span>{label}
    </button>
  );

  const sections = [
    {
      id: "intro", label: "Etkinlik Tanıtımı", icon: "🎬", color: "#B388FF",
      desc: "Öğrencinin etkinliğe girdiğinde gördüğü ilk ekran.",
      enabled: intro.enabled !== false,
      onToggle: v => patchIntro({ enabled: v }),
      textFields: [
        { l: "Başlık", v: intro.title || "", onChange: e => patchIntro({ title: e.target.value }), placeholder: "Etkinliğe Hoş Geldin" },
        { l: "Açıklama", v: intro.body || "", onChange: e => patchIntro({ body: e.target.value }), rows: 3, placeholder: "Hazır olduğunda başla ve soruyu tamamla." },
        { l: "Buton Yazısı", v: intro.buttonText || "", onChange: e => patchIntro({ buttonText: e.target.value }), placeholder: "Başla" },
      ],
      styleTarget: intro, stylePatch: patchIntro, themeScreen: "intro",
      hasButton: true,
    },
    {
      id: "package", label: "Tema Paketi Tanıtımı", icon: "🎯", color: "#22d3ee",
      desc: "Hazır tema renkleri, ikonlar ve tanıtım ekranı ayarları.",
      enabled: settings.showButtonPackageIntro !== false && packageScreen.enabled !== false,
      onToggle: v => { patchSettings({ showButtonPackageIntro: v }); patchPackage({ enabled: v }); },
      textFields: [
        { l: "Başlık", v: resolvedPackageTitle, onChange: e => patchPackage({ title: e.target.value }), placeholder: "Tema Paketi Tanıtımı" },
        { l: "Açıklama", v: resolvedPackageBody, onChange: e => patchPackage({ body: e.target.value }), rows: 3, placeholder: "Etkinlikte kullanacağın tema paketini ve butonları incele." },
        { l: "İleri Butonu", v: packageScreen.buttonText || "", onChange: e => patchPackage({ buttonText: e.target.value }), placeholder: "Menüye Geç" },
        { l: "Geri Butonu", v: packageScreen.backButtonText || "", onChange: e => patchPackage({ backButtonText: e.target.value }), placeholder: "Geri Dön" },
        ...packageItems.flatMap(item => {
          const defaultLabel = DEFAULT_THEME_PACKAGE_ITEMS.find(entry => entry.id === item.id)?.label || item.label || item.id;
          return [
            { l: `${defaultLabel} İkonu`, v: item.icon || "", onChange: e => patchPackageItem(item.id, { icon: e.target.value }), placeholder: item.icon || "★" },
            { l: `${defaultLabel} Başlığı`, v: item.label || "", onChange: e => patchPackageItem(item.id, { label: e.target.value }), placeholder: defaultLabel },
            { l: `${defaultLabel} Açıklaması`, v: item.desc || "", onChange: e => patchPackageItem(item.id, { desc: e.target.value }), rows: 2, placeholder: item.desc || "Açıklama" },
          ];
        }),
      ],
      styleTarget: packageScreen, stylePatch: patchPackage, themeScreen: "intro",
      hasButton: true,
    },
    {
      id: "menu", label: "Menü Ekranı", icon: "📋", color: "#f59e0b",
      desc: "Kuralların ve açıklamaların gösterildiği menü ekranı.",
      enabled: settings.showMenuScreen !== false && menuScreen.enabled !== false,
      onToggle: v => { patchSettings({ showMenuScreen: v }); patchMenu({ enabled: v }); },
      textFields: [
        { l: "Başlık", v: menuScreen.title || "", onChange: e => patchMenu({ title: e.target.value }), placeholder: "Etkinlik Menüsü" },
        { l: "Açıklama", v: menuScreen.body || "", onChange: e => patchMenu({ body: e.target.value }), rows: 3, placeholder: "Kuralları gözden geçir ve etkinliği başlat." },
        { l: "Buton Yazısı", v: menuScreen.buttonText || "", onChange: e => patchMenu({ buttonText: e.target.value }), placeholder: "Etkinliğe Geç" },
      ],
      styleTarget: menuScreen, stylePatch: patchMenu, themeScreen: "intro",
      hasButton: true,
    },
    {
      id: "play", label: "Oyun / Sahne", icon: "▶", color: "#60a5fa",
      desc: "Etkinlik sırasında gösterilecek başlık ve açıklama.",
      textFields: [
        { l: "Başlık", v: playScreen.title || "", onChange: e => patchPlay({ title: e.target.value }), placeholder: "Sahne başlığı" },
        { l: "Açıklama", v: playScreen.body || "", onChange: e => patchPlay({ body: e.target.value }), rows: 2, placeholder: "Sahne açıklaması" },
      ],
      styleTarget: playScreen, stylePatch: patchPlay, themeScreen: "play",
      hasButton: false,
    },
    {
      id: "success", label: "Doğru Cevap", icon: "✅", color: "#4ade80",
      desc: "Öğrenci doğru cevap verdiğinde gösterilen ekran.",
      textFields: [
        { l: "Başlık", v: results.successTitle || "", onChange: e => patchResults({ successTitle: e.target.value }), placeholder: "Harika!" },
        { l: "Mesaj", v: results.successBody || "", onChange: e => patchResults({ successBody: e.target.value }), rows: 2, placeholder: "Doğru cevabı buldun." },
        { l: "Devam Butonu", v: results.continueText || "", onChange: e => patchResults({ continueText: e.target.value }), placeholder: "Devam Et" },
      ],
      styleTarget: results, stylePatch: patchResults, themeScreen: "success",
      hasButton: true,
    },
    {
      id: "failure", label: "Yanlış Cevap", icon: "❌", color: "#f87171",
      desc: "Öğrenci yanlış cevap verdiğinde gösterilen ekran.",
      textFields: [
        { l: "Başlık", v: results.failureTitle || "", onChange: e => patchResults({ failureTitle: e.target.value }), placeholder: "Tekrar Deneyelim" },
        { l: "Mesaj", v: results.failureBody || "", onChange: e => patchResults({ failureBody: e.target.value }), rows: 2, placeholder: "Doğru cevaba biraz daha yakınsın." },
        { l: "Tekrar Dene Butonu", v: results.retryText || "", onChange: e => patchResults({ retryText: e.target.value }), placeholder: "Tekrar Dene" },
      ],
      styleTarget: results, stylePatch: patchResults, themeScreen: "failure",
      hasButton: true,
    },
    {
      id: "answer", label: "Cevap Ekranı", icon: "★", color: "#fbbf24",
      desc: "Doğru cevap gösterildiğinde kullanılan ekran.",
      textFields: [
        { l: "Başlık", v: answerScreen.title || "", onChange: e => patchAnswer({ title: e.target.value }), placeholder: "Doğru Cevap" },
        { l: "Açıklama", v: answerScreen.body || "", onChange: e => patchAnswer({ body: e.target.value }), rows: 2, placeholder: "Sistem doğru cevabı gösteriyor." },
        { l: "Buton Yazısı", v: answerScreen.buttonText || "", onChange: e => patchAnswer({ buttonText: e.target.value }), placeholder: "Yeniden Başlat" },
      ],
      styleTarget: answerScreen, stylePatch: patchAnswer, themeScreen: "failure",
      hasButton: true,
    },
  ];

  const renderStyleEditor = (s) => {
    const st = s.styleTarget?.style || {};
    const patchStyle = (p) => s.stylePatch({ style: { ...st, ...p } });
    const defaultBg = theme[s.themeScreen] || theme.intro;
    const defaultText = theme.text;
    const defaultBtnBg = theme.button;
    const defaultBtnColor = theme.text;
    const defaultBtnBorder = theme.border;
    const defaultRadius = theme.radius || 18;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#78909C", marginBottom: 2 }}>EKRAN ARKA PLANI</div>
        <div style={{ display: "flex", gap: 6 }}>
          {colorInput(st.background || "", e => patchStyle({ background: e.target.value }), "Arka Plan")}
          {colorInput(st.textColor || "", e => patchStyle({ textColor: e.target.value }), "Metin Rengi")}
        </div>
        <div style={{ fontSize: 9, color: "#546E7A" }}>Boş bırakılırsa tema varsayılanı kullanılır: {defaultBg.slice(0, 40)}...</div>

        <div style={{ width: "100%", height: 1, background: "#252540", margin: "4px 0" }} />

        <div style={{ fontSize: 10, fontWeight: 700, color: "#78909C", marginBottom: 2 }}>BAŞLIK STİLİ</div>
        <div style={{ display: "flex", gap: 6 }}>
          {numInput(st.titleFontSize, e => patchStyle({ titleFontSize: +e.target.value || 0 }), "Font Boyutu", 10, 120)}
          {numInput(st.titleFontWeight, e => patchStyle({ titleFontWeight: +e.target.value || 0 }), "Kalınlık", 100, 900)}
        </div>

        {s.hasButton && (<>
          <div style={{ width: "100%", height: 1, background: "#252540", margin: "4px 0" }} />
          <div style={{ fontSize: 10, fontWeight: 700, color: "#78909C", marginBottom: 2 }}>BUTON GÖRÜNÜMLERİ</div>
          <div style={{ display: "flex", gap: 6 }}>
            {colorInput(st.buttonBackground || "", e => patchStyle({ buttonBackground: e.target.value }), "Buton Arkaplan")}
            {colorInput(st.buttonColor || "", e => patchStyle({ buttonColor: e.target.value }), "Buton Yazı")}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {colorInput(st.buttonBorderColor || "", e => patchStyle({ buttonBorderColor: e.target.value }), "Buton Çerçeve")}
            {numInput(st.buttonBorderRadius ?? "", e => patchStyle({ buttonBorderRadius: +e.target.value || 0 }), "Köşe Yvl.", 0, 999)}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {numInput(st.buttonFontSize, e => patchStyle({ buttonFontSize: +e.target.value || 0 }), "Buton Font", 8, 60)}
            {numInput(st.buttonPaddingX, e => patchStyle({ buttonPaddingX: +e.target.value || 0 }), "Yatay Pad", 0, 100)}
            {numInput(st.buttonPaddingY, e => patchStyle({ buttonPaddingY: +e.target.value || 0 }), "Dikey Pad", 0, 100)}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {selectInput(st.buttonAlign || "center", e => patchStyle({ buttonAlign: e.target.value }), "Buton Konumu", buttonAlignOptions)}
            {selectInput(st.buttonDirection || "row", e => patchStyle({ buttonDirection: e.target.value }), "Buton Dizilimi", buttonDirectionOptions)}
            {numInput(st.buttonGap ?? 12, e => patchStyle({ buttonGap: +e.target.value || 0 }), "Buton Aralığı", 0, 60)}
          </div>
          <div style={{ fontSize: 9, color: "#546E7A" }}>Boş = tema varsayılanı ({defaultBtnBorder})</div>

          {/* Buton önizleme */}
          <div style={{ padding: 10, borderRadius: 8, background: "#0a0a1a", minHeight: 68, ...resolvePreviewButtonLayoutStyle(st, { justifyContent: "center", gap: 10 }) }}>
            <div style={{
              padding: `${st.buttonPaddingY || 13}px ${st.buttonPaddingX || 28}px`,
              borderRadius: st.buttonBorderRadius ?? 999,
              border: `1px solid ${st.buttonBorderColor || defaultBtnBorder}44`,
              background: st.buttonBackground || defaultBtnBg,
              color: st.buttonColor || defaultBtnColor,
              fontSize: st.buttonFontSize || 14,
              fontWeight: 800, textAlign: "center",
              boxShadow: `0 8px 32px ${st.buttonBorderColor || defaultBtnBorder}44`,
            }}>
              {s.textFields.find(f => f.l.includes("Buton"))?.v || "Buton Önizleme"}
            </div>
          </div>
        </>)}

        <div style={{ width: "100%", height: 1, background: "#252540", margin: "4px 0" }} />
        <div style={{ fontSize: 10, fontWeight: 700, color: "#78909C", marginBottom: 2 }}>EKRAN GENEL</div>
        <div style={{ display: "flex", gap: 6 }}>
          {numInput(st.borderRadius ?? "", e => patchStyle({ borderRadius: +e.target.value || 0 }), "Panel Köşe", 0, 60)}
          {numInput(st.padding ?? "", e => patchStyle({ padding: +e.target.value || 0 }), "İç Boşluk", 0, 100)}
        </div>

        {/* Ekran Önizleme */}
        <div style={{ padding: 8, borderRadius: 8, background: "#0a0a1a", marginTop: 4 }}>
          <div style={{
            background: st.background || defaultBg,
            borderRadius: st.borderRadius || 16,
            padding: st.padding || 16,
            color: st.textColor || defaultText,
            minHeight: 80, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            <div style={{ fontSize: st.titleFontSize || 18, fontWeight: st.titleFontWeight || 800 }}>
              {s.textFields[0]?.v || "Başlık Önizleme"}
            </div>
            <div style={{ fontSize: 10, opacity: 0.7 }}>{s.textFields[1]?.v || "Açıklama önizleme"}</div>
            {s.hasButton && (
              <div style={{
                padding: `${Math.max(4, (st.buttonPaddingY || 13) * 0.5)}px ${Math.max(6, (st.buttonPaddingX || 28) * 0.5)}px`,
                borderRadius: st.buttonBorderRadius ?? 999,
                background: st.buttonBackground || defaultBtnBg,
                color: st.buttonColor || defaultBtnColor,
                fontSize: Math.max(8, (st.buttonFontSize || 14) * 0.7), fontWeight: 800,
                border: `1px solid ${st.buttonBorderColor || defaultBtnBorder}44`,
              }}>
                {s.textFields.find(f => f.l.includes("Buton"))?.v || "Buton"}
              </div>
            )}
          </div>
        </div>

        <button onClick={() => s.stylePatch({ style: {} })} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #ef4444", background: "#ef444418", color: "#f87171", fontSize: 10, fontWeight: 700, cursor: "pointer", alignSelf: "flex-start" }}>
          Stilleri Sıfırla
        </button>
      </div>
    );
  };

  const renderSectionTextContent = (s) => {
    if (s.id !== "package") {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 9, color: "#78909C", marginBottom: 2 }}>{s.desc}</div>
          {s.textFields.map(f => textInput(f.v, f.onChange, f.l, f.placeholder, f.rows))}
        </div>
      );
    }

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 9, color: "#78909C", marginBottom: 2 }}>{s.desc}</div>
        <div style={{ background: "#0a1020", border: "1px solid #23314f", borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "#67e8f9" }}>TANITIM ALANI</div>
          {s.textFields.slice(0, 4).map(f => textInput(f.v, f.onChange, f.l, f.placeholder, f.rows))}
        </div>
        <div style={{ background: "#0a1020", border: "1px solid #23314f", borderRadius: 10, padding: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "#93c5fd", marginBottom: 8 }}>TEMA KARTLARI</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 8 }}>
            {packageItems.map(item => (
              <div key={item.id} style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 16 }}>{item.icon || "✦"}</span>
                  <div style={{ fontSize: 10, fontWeight: 800, color: "#e2e8f0" }}>{item.label || "Kart"}</div>
                </div>
                {textInput(item.icon || "", e => patchPackageItem(item.id, { icon: e.target.value }), "İkon", "★")}
                {textInput(item.label || "", e => patchPackageItem(item.id, { label: e.target.value }), "Başlık", "Kart başlığı")}
                {textInput(item.desc || "", e => patchPackageItem(item.id, { desc: e.target.value }), "Açıklama", "Kart açıklaması", 2)}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const filteredSections = normalizedVisibleSectionIds.length
    ? sections.filter(section => normalizedVisibleSectionIds.includes(section.id))
    : sections;
  const showBehaviorPanel = !normalizedVisibleSectionIds.length || normalizedVisibleSectionIds.includes("behavior");

  const renderBehavior = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ background: "#0a1020", border: "1px solid #24324d", borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, color: "#93c5fd" }}>TEMEL DAVRANIŞLAR</div>
          <div style={{ fontSize: 9, color: "#64748b", marginTop: 2 }}>Puanlama, deneme ve cevap görünürlüğü ayarları.</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 6 }}>
          <div style={{ minWidth: 80 }}>
            <label style={{ fontSize: 9, color: "#78909C", display: "block", marginBottom: 2 }}>Tamamlanma</label>
            <select value={settings.completionMode || "required"} onChange={e => patchSettings({ completionMode: e.target.value })} style={inputBase}>
              <option value="required">Zorunlu</option>
              <option value="optional">İsteğe Bağlı</option>
            </select>
          </div>
          {numInput(settings.scorePoints ?? 10, e => patchSettings({ scorePoints: +e.target.value || 0 }), "Puan", 0, 1000)}
          {numInput(settings.maxAttempts ?? 0, e => patchSettings({ maxAttempts: Math.max(0, +e.target.value || 0) }), "Maks Deneme", 0, 100)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 6 }}>
          {[
            { key: "shuffleOptions", label: "Seçenekleri karıştır", color: "#a78bfa" },
            { key: "showFeedback", label: "Sonuç göster", color: "#60a5fa" },
            { key: "allowRetry", label: "Tekrar deneme izni", color: "#4ade80" },
            { key: "showAnswerLayer", label: "Cevap katmanı göster", color: "#fbbf24" },
          ].map(opt => (
            <label key={opt.key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#B0BEC5", cursor: "pointer", padding: "8px 10px", borderRadius: 8, background: "rgba(15,23,42,.55)", border: "1px solid #1f2a44" }}>
              <input type="checkbox" checked={!!settings[opt.key]} onChange={e => patchSettings({ [opt.key]: e.target.checked })} style={{ accentColor: opt.color }} />
              {opt.label}
            </label>
          ))}
        </div>
        {textInput(settings.answerButtonText || "", e => patchSettings({ answerButtonText: e.target.value }), "Cevap Göster Butonu", "Cevabı Gör")}
      </div>

      <div style={{ background: "#0a1020", border: "1px solid #3b2b5a", borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, color: "#c4b5fd" }}>AKIŞ YÖNLERİ</div>
          <div style={{ fontSize: 9, color: "#64748b", marginTop: 2 }}>Ekranlar arasında hangi adımın açılacağını seç.</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 6 }}>
          <div>
            <label style={{ fontSize: 9, color: "#78909C", display: "block", marginBottom: 2 }}>Karşılama sonrası</label>
            <select value={settings.introNextPhase || "auto"} onChange={e => patchSettings({ introNextPhase: e.target.value })} style={inputBase}>
              <option value="auto">Otomatik</option>
              <option value="package">Tema Paketi</option>
              <option value="menu">Menü</option>
              <option value="play">Oyun</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 9, color: "#78909C", display: "block", marginBottom: 2 }}>Tema sonrası</label>
            <select value={settings.packageNextPhase || "auto"} onChange={e => patchSettings({ packageNextPhase: e.target.value })} style={inputBase}>
              <option value="auto">Otomatik</option>
              <option value="intro">Karşılama</option>
              <option value="menu">Menü</option>
              <option value="play">Oyun</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 9, color: "#78909C", display: "block", marginBottom: 2 }}>Menü sonrası</label>
            <select value={settings.menuNextPhase || "play"} onChange={e => patchSettings({ menuNextPhase: e.target.value })} style={inputBase}>
              <option value="intro">Karşılama</option>
              <option value="package">Tema Paketi</option>
              <option value="play">Oyun</option>
            </select>
          </div>
        </div>
      </div>

      <div style={{ background: "#0a1020", border: "1px solid #234046", borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, color: "#5eead4" }}>BUTON YAZILARI</div>
          <div style={{ fontSize: 9, color: "#64748b", marginTop: 2 }}>Önizlemede görünen tüm buton metinlerini buradan değiştir.</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 6 }}>
          {textInput(settings.guideButtonText || "", e => patchSettings({ guideButtonText: e.target.value }), "Tanıtım Butonu", "Tanıtım")}
          {textInput(settings.menuButtonText || "", e => patchSettings({ menuButtonText: e.target.value }), "Menü Butonu", "☰ MENÜ")}
          {textInput(settings.checkButtonText || "", e => patchSettings({ checkButtonText: e.target.value }), "Kontrol Butonu", "Kontrol Et")}
          {textInput(settings.solutionButtonText || "", e => patchSettings({ solutionButtonText: e.target.value }), "Çözüm Butonu", "Çözümü Göster")}
          {textInput(settings.restartFlowText || "", e => patchSettings({ restartFlowText: e.target.value }), "Yeniden Başlat", "Yeniden Başlat")}
          {textInput(settings.completeButtonText || "", e => patchSettings({ completeButtonText: e.target.value }), "Tamamlama Butonu", "Tamamla")}
          {textInput(settings.homeButtonText || "", e => patchSettings({ homeButtonText: e.target.value }), "Ana Sayfa", "Ana Sayfa")}
          {textInput(settings.soundOnText || "", e => patchSettings({ soundOnText: e.target.value }), "Ses Aç Metni", "Sesi Aç")}
          {textInput(settings.soundOffText || "", e => patchSettings({ soundOffText: e.target.value }), "Ses Kapat Metni", "Sesi Kapat")}
        </div>
      </div>

      <div style={{ background: "#0a1020", border: "1px solid #4c2f4e", borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, color: "#f9a8d4" }}>BUTON GÖREVLERİ</div>
          <div style={{ fontSize: 9, color: "#64748b", marginTop: 2 }}>Butona basılınca hangi ekranın veya görevin açılacağını seç.</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 6 }}>
          {selectInput(settings.guideButtonAction || "package", e => patchSettings({ guideButtonAction: e.target.value }), "Tanıtım / Kılavuz", guideActionOptions)}
          {selectInput(settings.packageBackAction || "intro", e => patchSettings({ packageBackAction: e.target.value }), "Tema Geri Butonu", packageBackActionOptions)}
          {selectInput(settings.menuButtonAction || "toggle-menu", e => patchSettings({ menuButtonAction: e.target.value }), "Oyun Menü Butonu", menuButtonActionOptions)}
          {selectInput(settings.checkButtonAction || "check", e => patchSettings({ checkButtonAction: e.target.value }), "Kontrol Butonu", checkButtonActionOptions)}
          {selectInput(settings.solutionButtonAction || "answer", e => patchSettings({ solutionButtonAction: e.target.value }), "Çözüm Butonu", utilityActionOptions)}
          {selectInput(settings.restartButtonAction || "restart", e => patchSettings({ restartButtonAction: e.target.value }), "Yeniden Başlat", packageBackActionOptions)}
          {selectInput(settings.completeButtonAction || "complete", e => patchSettings({ completeButtonAction: e.target.value }), "Tamamla Butonu", completeActionOptions)}
          {selectInput(settings.answerButtonAction || "restart", e => patchSettings({ answerButtonAction: e.target.value }), "Cevap Ekranı Butonu", utilityActionOptions)}
          {selectInput(settings.homeButtonAction || "intro", e => patchSettings({ homeButtonAction: e.target.value }), "Ana Sayfa Menüsü", homeActionOptions)}
        </div>
      </div>

      <div style={{ background: "#0a1020", border: "1px solid #223a58", borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#93c5fd" }}>TEMA PAKETLERİ</div>
            <div style={{ fontSize: 9, color: "#64748b", marginTop: 2 }}>Butonların renk ve genel görünüm kalıpları.</div>
          </div>
          <span style={{ fontSize: 9, fontWeight: 800, color: "#bfdbfe", background: "rgba(59,130,246,.14)", border: "1px solid rgba(96,165,250,.3)", borderRadius: 999, padding: "3px 8px" }}>
            {BUTTON_PACKAGES.length} hazır kalıp
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 8, maxHeight: 260, overflowY: "auto", paddingRight: 2 }}>
          {BUTTON_PACKAGES.map(pkg => {
            const pkgTheme = getPackageTheme(pkg.id);
            const isActive = activity.buttonPackageId === pkg.id;
            return (
              <button
                key={pkg.id}
                onClick={() => patch({ buttonPackageId: pkg.id })}
                style={{
                  padding: 10,
                  borderRadius: 12,
                  cursor: "pointer",
                  textAlign: "left",
                  border: `1px solid ${isActive ? pkg.color : "#2b3655"}`,
                  background: isActive ? `linear-gradient(135deg, ${pkg.color}30, rgba(15,23,42,.92))` : "linear-gradient(135deg,#111125,#0b1120)",
                  color: "#e2e8f0",
                  boxShadow: isActive ? `0 12px 24px ${pkg.color}22` : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontSize: 18 }}>{pkg.icon || "✦"}</span>
                  <span style={{ fontSize: 8, fontWeight: 800, color: isActive ? "#ffffff" : pkg.color, background: isActive ? "rgba(255,255,255,.18)" : `${pkg.color}18`, borderRadius: 999, padding: "3px 6px" }}>{pkg.trigger}</span>
                </div>
                <div style={{ fontSize: 11, fontWeight: 900, marginTop: 8, color: isActive ? "#ffffff" : "#f8fafc" }}>{pkg.name}</div>
                <div style={{ fontSize: 9, lineHeight: 1.45, color: isActive ? "rgba(255,255,255,.82)" : "#94a3b8", marginTop: 4 }}>{pkg.desc || `${pkg.trigger} · ${pkg.anim}`}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                  <span style={{ padding: "4px 8px", borderRadius: 999, background: pkgTheme.button, color: pkgTheme.text, fontSize: 8, fontWeight: 900 }}>▶ Başlat</span>
                  <span style={{ padding: "4px 8px", borderRadius: 999, border: `1px solid ${pkgTheme.border}66`, color: pkgTheme.border, fontSize: 8, fontWeight: 800 }}>✓ Kontrol</span>
                </div>
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: 9, color: "#546E7A" }}>Seçili tema: {BUTTON_PACKAGES.find(p => p.id === activity.buttonPackageId)?.name || "?"}</div>
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, height: "100%", minHeight: 0, overflowY: "auto", paddingRight: 6, scrollbarGutter: "stable" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 2 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#B388FF", marginBottom: 2 }}>EKRAN DÜZENLEYİCİ</div>
          <div style={{ fontSize: 10, color: "#78909C", lineHeight: 1.4 }}>
            {sectionTitle ? `${sectionTitle} alanını düzenliyorsun. Alt bölümden ilgili ayarları açıp değiştirebilirsin.` : "Tüm ekranların metinlerini, butonlarını ve görünümlerini düzenle."}
          </div>
        </div>
        <button
          onClick={() => {
            if (typeof window === "undefined") return;
            const url = `${window.location.pathname}${window.location.search}#text-studio`;
            window.open(url, "_blank", "noopener,noreferrer");
          }}
          style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #7C4DFF44", background: "#7C4DFF18", color: "#B388FF", fontSize: 10, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}
        >
          Yeni Sekmede Aç
        </button>
      </div>

      <div style={{ background: "linear-gradient(135deg,#111827,#0f172a)", border: "1px solid #334155", borderRadius: 12, padding: 12, display: "flex", flexDirection: "column", gap: 8, marginBottom: 4 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#93c5fd" }}>TASARIM KÜTÜPHANESİ</div>
            <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 2 }}>Bu alandaki metin + görünüm ayarlarını proje içinde kaydet ve başka etkinliklere uygula.</div>
          </div>
          <span style={{ fontSize: 9, fontWeight: 800, color: "#bfdbfe", background: "rgba(59,130,246,.14)", border: "1px solid rgba(96,165,250,.3)", borderRadius: 999, padding: "4px 8px" }}>
            {designPresets.length} kayıtlı tasarım
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.1fr .9fr", gap: 8 }}>
          {textInput(presetName, e => setPresetName(e.target.value), "Tasarım Adı", "Örn. Kurumsal Mavi")}
          <div>
            <label style={{ fontSize: 9, color: "#78909C", display: "block", marginBottom: 2 }}>Kayıtlı Tasarımlar</label>
            <select value={selectedPresetId} onChange={e => setSelectedPresetId(e.target.value)} style={inputBase}>
              <option value="">Tasarım seç...</option>
              {designPresets.map(item => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button onClick={handleSaveCurrentPreset} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #22c55e", background: "rgba(34,197,94,.12)", color: "#86efac", fontSize: 10, fontWeight: 800, cursor: "pointer" }}>
            Tasarımı Kaydet
          </button>
          <button onClick={handleApplySelectedPreset} disabled={!selectedPreset} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #60a5fa", background: selectedPreset ? "rgba(59,130,246,.12)" : "rgba(51,65,85,.5)", color: selectedPreset ? "#bfdbfe" : "#64748b", fontSize: 10, fontWeight: 800, cursor: selectedPreset ? "pointer" : "default", opacity: selectedPreset ? 1 : 0.7 }}>
            Seçileni Uygula
          </button>
          <button onClick={handleDeleteSelectedPreset} disabled={!selectedPreset} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #ef4444", background: selectedPreset ? "rgba(239,68,68,.12)" : "rgba(51,65,85,.5)", color: selectedPreset ? "#fca5a5" : "#64748b", fontSize: 10, fontWeight: 800, cursor: selectedPreset ? "pointer" : "default", opacity: selectedPreset ? 1 : 0.7 }}>
            Tasarımı Sil
          </button>
        </div>

        <div style={{ fontSize: 9, color: "#cbd5e1", lineHeight: 1.5 }}>
          {selectedPreset
            ? `Seçili şablon: ${selectedPreset.name} · Son güncelleme ${new Date(selectedPreset.updatedAt || selectedPreset.createdAt).toLocaleString("tr-TR")}`
            : "Kaydettiğin tasarımlar burada listelenir; aynı tasarımı farklı etkinliklerde tek tıkla çağırabilirsin."}
        </div>
      </div>

      {filteredSections.map(s => {
        const isOpen = openSection === s.id;
        return (
          <div key={s.id} style={{ background: isOpen ? "#0d0d1f" : "#111125", border: `1px solid ${isOpen ? s.color + "44" : "#252540"}`, borderRadius: 10, overflow: "hidden", transition: "all .2s" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", cursor: "pointer", userSelect: "none", background: isOpen ? `${s.color}0a` : "transparent" }} onClick={() => { setOpenSection(isOpen ? null : s.id); setOpenSub("text"); }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14 }}>{s.icon}</span>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: s.color }}>{s.label}</div>
                  {!isOpen && <div style={{ fontSize: 9, color: "#78909C", marginTop: 1 }}>{s.desc}</div>}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {s.onToggle && (
                  <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#78909C", cursor: "pointer" }} onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={s.enabled} onChange={e => s.onToggle(e.target.checked)} style={{ accentColor: s.color }} />
                    Aktif
                  </label>
                )}
                <span style={{ color: "#546E7A", fontSize: 12, transform: isOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform .2s" }}>▼</span>
              </div>
            </div>
            {isOpen && (
              <div style={{ padding: "4px 12px 12px" }}>
                <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
                  <SubTab id="text" label="Metinler" icon="T" current={openSub} onClick={setOpenSub} />
                  <SubTab id="style" label="Görünüm" icon="🎨" current={openSub} onClick={setOpenSub} />
                  {s.id === "intro" && <SubTab id="behavior" label="Davranış" icon="⚙" current={openSub} onClick={setOpenSub} />}
                </div>

                <div style={{ maxHeight: ["package", "behavior"].includes(s.id) || openSub === "behavior" ? "min(62vh, 760px)" : "none", overflowY: ["package", "behavior"].includes(s.id) || openSub === "behavior" ? "auto" : "visible", paddingRight: ["package", "behavior"].includes(s.id) || openSub === "behavior" ? 6 : 0, scrollbarGutter: "stable", overscrollBehavior: "contain" }}>
{openSub === "text" && renderSectionTextContent(s)}

                  {openSub === "style" && renderStyleEditor(s)}
                  {openSub === "behavior" && s.id === "intro" && renderBehavior()}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {showBehaviorPanel && (
        <div style={{ background: "#111125", border: "1px solid #252540", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", cursor: "pointer", userSelect: "none" }} onClick={() => { setOpenSection(openSection === "behavior" ? null : "behavior"); setOpenSub("behavior"); }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14 }}>⚙</span>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8" }}>Genel Ayarlar</div>
                {openSection !== "behavior" && <div style={{ fontSize: 9, color: "#78909C", marginTop: 1 }}>Puan, deneme, buton yazıları ve görev seçenekleri.</div>}
              </div>
            </div>
            <span style={{ color: "#546E7A", fontSize: 12, transform: openSection === "behavior" ? "rotate(180deg)" : "rotate(0)", transition: "transform .2s" }}>▼</span>
          </div>
          {openSection === "behavior" && (
            <div style={{ padding: "4px 12px 12px", maxHeight: "min(62vh, 760px)", overflowY: "auto", paddingRight: 6, scrollbarGutter: "stable", overscrollBehavior: "contain" }}>
              {renderBehavior()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TextStudioWorkspace({ activity, activities = [], variables = [], onUpdate, onClose, designPresets = [], onSavePreset, onApplyPreset, onDeletePreset }) {
  const theme = getPackageTheme(activity?.buttonPackageId);
  const deferredPreviewActivity = useDeferredValue(activity);
  const deferredPreviewActivities = useDeferredValue(activities);
  const deferredPreviewVariables = useDeferredValue(variables);
  const [studioViewportWidth, setStudioViewportWidth] = useState(() => (typeof window !== "undefined" ? window.innerWidth : 1600));
  const [activeStudioSectionId, setActiveStudioSectionId] = useState("intro");
  const studioSections = [
    { id: "intro", icon: "①", title: "Karşılama", desc: "Başlık, açıklama ve başlangıç butonu", editorSections: ["intro"], defaultSection: "intro" },
    { id: "package", icon: "②", title: "Tema Paketi", desc: "Hazır kalıplar, kart içerikleri ve tanıtım ekranı", editorSections: ["package"], defaultSection: "package" },
    { id: "menu", icon: "③", title: "Menü Ekranı", desc: "Kurallar, yönlendirme metinleri ve CTA alanı", editorSections: ["menu"], defaultSection: "menu" },
    { id: "play", icon: "④", title: "Oyun", desc: "Sahne görünümü, durum çubuğu ve aksiyonlar", editorSections: ["play"], defaultSection: "play" },
    { id: "result", icon: "⑤", title: "Sonuç", desc: "Başarı, hata ve cevap ekranlarını birlikte düzenle", editorSections: ["success", "failure", "answer"], defaultSection: "success" },
    { id: "settings", icon: "⚙", title: "Genel Ayarlar", desc: "Puan, akış, buton yazıları ve görev seçenekleri", editorSections: ["behavior"], defaultSection: "behavior" },
  ];
  const activeStudioSection = studioSections.find(section => section.id === activeStudioSectionId) || studioSections[0];
  const isCompactStudioLayout = studioViewportWidth < 1400;

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleResize = () => setStudioViewportWidth(window.innerWidth);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (!activity) {
    return (
      <div style={{ width: "100vw", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "radial-gradient(circle at top left,#1d4ed8 0%,#0f172a 42%,#020617 100%)", padding: 24, boxSizing: "border-box" }}>
        <div style={{ width: "min(620px, 100%)", borderRadius: 28, background: "rgba(255,255,255,.96)", border: "1px solid rgba(191,219,254,.45)", boxShadow: "0 30px 80px rgba(15,23,42,.35)", padding: 26 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#0f172a" }}>Metin Stüdyosu</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>Önce ana editörde bir etkinlik seç, sonra stüdyo otomatik açılacak.</div>
            </div>
            <button onClick={onClose} style={{ padding: "8px 12px", borderRadius: 12, border: "1px solid #cbd5e1", background: "#fff", color: "#334155", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>
              Ana Editöre Dön
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: "100vw", height: "100vh", background: "radial-gradient(circle at top left,#dbeafe 0%,#eef4ff 34%,#f8fbff 66%,#eef2ff 100%)", padding: 16, boxSizing: "border-box", overflow: "auto" }}>
      <div style={{ height: "100%", display: "grid", gridTemplateRows: "auto minmax(0,1fr)", gap: 16, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: 16, borderRadius: 24, background: "rgba(255,255,255,.92)", border: `1px solid ${theme.border}40`, boxShadow: "0 24px 60px rgba(15,23,42,.10)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <div style={{ width: 46, height: 46, borderRadius: 16, display: "grid", placeItems: "center", background: "linear-gradient(135deg,#2563eb,#7c3aed 65%,#ec4899)", color: "#fff", fontSize: 20, fontWeight: 900, boxShadow: "0 14px 28px rgba(99,102,241,.28)" }}>✦</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: "#0f172a" }}>Metin Stüdyosu</div>
                <span style={{ fontSize: 10, fontWeight: 800, color: "#4338ca", background: "#eef2ff", border: "1px solid #c7d2fe", borderRadius: 999, padding: "4px 8px" }}>Canva düzeni</span>
                <span style={{ fontSize: 10, fontWeight: 800, color: "#0f766e", background: "#ecfeff", border: "1px solid #99f6e4", borderRadius: 999, padding: "4px 8px" }}>Canlı senkron</span>
              </div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {activity.name || "Etkinlik"} · üstten ekranı seç, solda düzenle ve sağda anlık görünümü izle
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button onClick={() => window.location.reload()} style={{ padding: "9px 12px", borderRadius: 12, border: "1px solid #cbd5e1", background: "#fff", color: "#334155", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>
              Önizlemeyi Yenile
            </button>
            <button onClick={onClose} style={{ padding: "9px 12px", borderRadius: 12, border: "1px solid #bfdbfe", background: "linear-gradient(180deg,#eff6ff,#ffffff)", color: "#1d4ed8", fontSize: 11, fontWeight: 900, cursor: "pointer" }}>
              Ana Editöre Dön
            </button>
          </div>
        </div>

        <div style={{ minHeight: 0, display: "grid", gridTemplateColumns: isCompactStudioLayout ? "1fr" : "minmax(420px,.88fr) minmax(760px,1.12fr)", gap: 16, alignItems: "stretch" }}>
          <section style={{ minHeight: 0, display: "flex", flexDirection: "column", borderRadius: 24, overflow: "hidden", background: "rgba(255,255,255,.94)", border: `1px solid ${theme.border}30`, boxShadow: "0 24px 60px rgba(15,23,42,.10)" }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(226,232,240,.95)", background: "linear-gradient(180deg,#ffffff,#f8fbff)" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 900, color: "#0f172a" }}>Özellik Paneli</div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>Metin, buton, görünüm ve davranış ayarları artık daha geniş ve tek akışta.</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: "#0f766e", background: "#ecfeff", border: "1px solid #99f6e4", borderRadius: 999, padding: "4px 8px" }}>Otomatik kayıt</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#475569", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 999, padding: "4px 8px" }}>Alt maddeler için daha ferah görünüm</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "nowrap", overflowX: "auto", paddingBottom: 4, marginTop: 12, scrollbarGutter: "stable" }}>
                {studioSections.map(section => {
                  const isActive = activeStudioSection.id === section.id;
                  return (
                    <button
                      key={section.id}
                      onClick={() => setActiveStudioSectionId(section.id)}
                      title={section.desc}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "7px 11px",
                        borderRadius: 999,
                        background: isActive ? "#2563eb" : "#eff6ff",
                        border: `1px solid ${isActive ? "#1d4ed8" : "#bfdbfe"}`,
                        color: isActive ? "#ffffff" : "#1d4ed8",
                        fontSize: 10,
                        fontWeight: 800,
                        cursor: "pointer",
                        flexShrink: 0,
                        boxShadow: isActive ? "0 10px 24px rgba(37,99,235,.22)" : "none"
                      }}
                    >
                      <span>{section.icon}</span>
                      <span>{section.title}</span>
                    </button>
                  );
                })}
              </div>
              <div style={{ marginTop: 10, fontSize: 11, color: "#475569", lineHeight: 1.5 }}>
                <strong style={{ color: "#0f172a" }}>{activeStudioSection.title}:</strong> {activeStudioSection.desc}
              </div>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: 14, background: "linear-gradient(180deg,#0f172a,#111827 42%,#0b1120 100%)", scrollbarGutter: "stable" }}>
              <ActivityTextEditor
                activity={activity}
                onUpdate={onUpdate}
                designPresets={designPresets}
                onSavePreset={onSavePreset}
                onApplyPreset={onApplyPreset}
                onDeletePreset={onDeletePreset}
                visibleSectionIds={activeStudioSection.editorSections}
                preferredOpenSection={activeStudioSection.defaultSection}
                sectionTitle={activeStudioSection.title}
              />
            </div>
          </section>

          <section style={{ minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", borderRadius: 24, overflow: "hidden", border: `1px solid ${theme.border}30`, boxShadow: "0 24px 60px rgba(15,23,42,.10)", background: "#0b1120" }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(30,41,59,.9)", background: "linear-gradient(180deg,#0f172a,#111827)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 900, color: "#f8fafc" }}>Canlı Öğrenci Önizlemesi</div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>Öğrenci görünümüne en yakın canlı kontrol alanı.</div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 800, color: "#86efac", background: "rgba(34,197,94,.12)", border: "1px solid rgba(34,197,94,.35)", borderRadius: 999, padding: "4px 8px" }}>LIVE</span>
              </div>
            </div>
            <div style={{ flex: 1, minHeight: 0, background: "#0b1120" }}>
              <PreviewPlayer activity={deferredPreviewActivity} activities={deferredPreviewActivities} variables={deferredPreviewVariables} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

// ─── Stage Canvas ─────────────────────────────────────────────────────────────

const StageCanvas = forwardRef(function StageCanvas({ activity, onUpdate, zoom = "fit", onZoomChange, selectedIds, onSelectionChange, timelineTime = 0, answerPreview = null }, ref) {
  const viewportRef = useRef(null);
  const stageRef = useRef(null);
  const latestRef = useRef(activity);
  const interactRef = useRef(null);
  const fileRef = useRef(null);
  const imgRef = useRef(null);
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const zoomRef = useRef(zoom);
  const latestSelectedIdsRef = useRef(selectedIds);
  const clipboardRef = useRef(null);
  const rubberStartRef = useRef(null);
  const rubberHandlersRef = useRef(null);
  const dragSnapshotRef = useRef(null);
  const [rubberBand, setRubberBand] = useState(null);
  const [viewportSize, setViewportSize] = useState({ width: 1280, height: 760 });

  useEffect(() => { latestRef.current = activity; }, [activity]);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { latestSelectedIdsRef.current = selectedIds; }, [selectedIds]);
  useEffect(() => () => { if (interactRef.current) { interactRef.current(); interactRef.current = null; } }, []);
  // Cleanup rubber-band listeners on unmount
  useEffect(() => {
    return () => {
      if (rubberHandlersRef.current) {
        window.removeEventListener("pointermove", rubberHandlersRef.current.move);
        window.removeEventListener("pointerup", rubberHandlersRef.current.up);
        rubberHandlersRef.current = null;
      }
    };
  }, []);
  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return undefined;

    const updateViewport = () => {
      const rect = node.getBoundingClientRect();
      setViewportSize({
        width: Math.max(260, rect.width),
        height: Math.max(240, rect.height),
      });
    };

    updateViewport();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateViewport);
      return () => window.removeEventListener("resize", updateViewport);
    }

    const observer = new ResizeObserver(updateViewport);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const objects = getCanvasObjects(activity);
  const timeline = getActivityTimeline(activity);
  const hasSvg = !!activity.svgMarkup;
  const hasObjects = objects.length > 0;
  const pdfBackgroundObject = useMemo(
    () => objects.find(object => object?.isPdfBackground && object?.imageData) || null,
    [objects],
  );
  const renderObjects = useMemo(
    () => objects.filter(object => !pdfBackgroundObject || object.id !== pdfBackgroundObject.id),
    [objects, pdfBackgroundObject],
  );

  const baseScale = useMemo(() => {
    return getFitScale(
      activity.stageWidth || 1920,
      activity.stageHeight || 1080,
      viewportSize.width - 20,
      viewportSize.height - 52,
    );
  }, [activity.stageWidth, activity.stageHeight, viewportSize.height, viewportSize.width]);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node || !onZoomChange) return undefined;

    const onNativeWheel = (event) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      event.stopPropagation();
      const delta = event.deltaY < 0 ? 0.1 : -0.1;
      onZoomChange(current => {
        const currentScale = current === "fit" ? baseScale : Number(current) || baseScale;
        return clamp(Number((currentScale + delta).toFixed(2)), 0.1, 4);
      });
    };

    node.addEventListener("wheel", onNativeWheel, { passive: false });
    return () => node.removeEventListener("wheel", onNativeWheel, { passive: false });
  }, [baseScale, onZoomChange]);

  const resolvedZoom = zoom === "fit" ? baseScale : Number(zoom) || baseScale;
  const scale = resolvedZoom;
  const vw = Math.round((activity.stageWidth || 1920) * scale);
  const vh = Math.round((activity.stageHeight || 1080) * scale);
  const zoomPercent = Math.round(scale * 100);

  const toStage = useCallback((cx, cy) => {
    const r = stageRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    const sw = latestRef.current.stageWidth || 1920;
    const sh = latestRef.current.stageHeight || 1080;
    const sc = zoomRef.current === "fit" ? baseScale : Number(zoomRef.current) || baseScale;
    return { x: Math.min(Math.max((cx - r.left) / sc, 0), sw), y: Math.min(Math.max((cy - r.top) / sc, 0), sh) };
  }, [baseScale]);

  const patchAct = useCallback((p) => {
    const a = latestRef.current;
    onUpdate({ ...a, ...p });
  }, [onUpdate]);

  const patchObj = useCallback((id, p) => {
    const a = latestRef.current;
    onUpdate(updateActivityObject(a, id, p, { syncDragDropFamily: true }));
  }, [onUpdate]);

  const addObject = useCallback((type) => {
    const a = latestRef.current;
    const objs = a.objects || [];
    const o = createObjectFromActivity(a, type);
    o.zIndex = objs.length + 1;
    o.layerId = a.activeLayerId || "base";
    // draggable/dropzone presets already have correct default colors — no override needed
    onUpdate({ ...a, objects: [...objs, o], selectedObjectId: o.id, timeline: syncTimelineWithObjects({ ...a, objects: [...objs, o] }) });
    onSelectionChange(new Set([o.id]));
  }, [onUpdate, onSelectionChange]);

  const addImageFile = useCallback((file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const a = latestRef.current;
      const objs = a.objects || [];
      const o = createObject("image");
      o.imageData = ev.target.result;
      o.label = file.name.replace(/\.[^.]+$/, "");
      o.zIndex = objs.length + 1;
      o.layerId = a.activeLayerId || "base";
      onUpdate({ ...a, objects: [...objs, o], selectedObjectId: o.id, timeline: syncTimelineWithObjects({ ...a, objects: [...objs, o] }) });
      onSelectionChange(new Set([o.id]));
    };
    reader.readAsDataURL(file);
  }, [onUpdate, onSelectionChange]);

  const addVideoFile = useCallback(async (file) => {
    if (!file) return;
    const mediaUrl = await uploadMediaFile(file);
    const a = latestRef.current;
    const objs = a.objects || [];
    const o = createObject("video");
    o.mediaUrl = mediaUrl;
    o.mediaName = file.name;
    o.label = file.name.replace(/\.[^.]+$/, "") || "Video";
    o.zIndex = objs.length + 1;
    o.layerId = a.activeLayerId || "base";
    onUpdate({ ...a, objects: [...objs, o], selectedObjectId: o.id, timeline: syncTimelineWithObjects({ ...a, objects: [...objs, o] }) });
    onSelectionChange(new Set([o.id]));
  }, [onUpdate, onSelectionChange]);

  const addAudioFile = useCallback(async (file) => {
    if (!file) return;
    const mediaUrl = await uploadMediaFile(file);
    const a = latestRef.current;
    const objs = a.objects || [];
    const o = createObject("audio");
    o.mediaUrl = mediaUrl;
    o.mediaName = file.name;
    o.label = file.name.replace(/\.[^.]+$/, "") || "Ses";
    o.zIndex = objs.length + 1;
    o.layerId = a.activeLayerId || "base";
    onUpdate({ ...a, objects: [...objs, o], selectedObjectId: o.id, timeline: syncTimelineWithObjects({ ...a, objects: [...objs, o] }) });
    onSelectionChange(new Set([o.id]));
  }, [onUpdate, onSelectionChange]);

  const loadSvgFile = useCallback((file) => {
    if (!file) return;
    file.text().then(markup => patchAct({ svgMarkup: markup, svgName: file.name }));
  }, [patchAct]);

  const deleteSelected = useCallback(() => {
    const a = latestRef.current;
    const ids = latestSelectedIdsRef.current;
    const toDelete = ids.size > 0 ? ids : (a.selectedObjectId ? new Set([a.selectedObjectId]) : new Set());
    if (toDelete.size === 0) return;
    const rest = (a.objects || []).filter(o => !toDelete.has(o.id));
    onUpdate({ ...a, objects: rest, selectedObjectId: rest[rest.length - 1]?.id || null, timeline: syncTimelineWithObjects({ ...a, objects: rest }) });
    onSelectionChange(new Set());
  }, [onUpdate, onSelectionChange]);

  const copySelected = useCallback(() => {
    const a = latestRef.current;
    const ids = latestSelectedIdsRef.current.size > 0
      ? latestSelectedIdsRef.current
      : (a.selectedObjectId ? new Set([a.selectedObjectId]) : new Set());
    if (ids.size === 0) return false;

    const selectedObjects = (a.objects || [])
      .filter(item => ids.has(item.id))
      .sort((left, right) => (left.zIndex || 0) - (right.zIndex || 0));
    if (!selectedObjects.length) return false;

    const timelineByObject = new Map(getActivityTimeline(a).map(item => [item.objectId, item]));
    clipboardRef.current = {
      objects: selectedObjects.map(item => ({
        ...item,
        style: item.style ? { ...item.style } : item.style,
      })),
      timeline: selectedObjects
        .map(item => timelineByObject.get(item.id))
        .filter(Boolean)
        .map(item => ({
          ...item,
          keyframes: Array.isArray(item.keyframes) ? item.keyframes.map(frame => ({ ...frame })) : [],
        })),
      copiedAt: Date.now(),
    };
    return true;
  }, []);

  const pasteClipboard = useCallback(() => {
    const clipboard = clipboardRef.current;
    if (!clipboard?.objects?.length) return false;

    const a = latestRef.current;
    const existingObjects = a.objects || [];
    const existingTimeline = getActivityTimeline(a);
    const idMap = new Map();
    const newSelection = new Set();
    const duplicatedObjects = clipboard.objects.map((item, index) => {
      const newId = uid();
      idMap.set(item.id, newId);
      newSelection.add(newId);
      return {
        ...item,
        id: newId,
        x: Math.max(0, (Number(item.x) || 0) + 24),
        y: Math.max(0, (Number(item.y) || 0) + 24),
        zIndex: existingObjects.length + index + 1,
        style: item.style ? { ...item.style } : item.style,
      };
    });
    const duplicatedTimeline = (clipboard.timeline || []).map((item, index) => ({
      ...item,
      id: uid(),
      objectId: idMap.get(item.objectId) || "",
      track: existingTimeline.length + index,
      keyframes: Array.isArray(item.keyframes) ? item.keyframes.map(frame => ({ ...frame, id: uid() })) : [],
    }));
    const nextObjects = [...existingObjects, ...duplicatedObjects];
    const nextTimeline = syncTimelineWithObjects({
      ...a,
      objects: nextObjects,
      timeline: [...existingTimeline, ...duplicatedTimeline],
    });
    const lastId = duplicatedObjects[duplicatedObjects.length - 1]?.id || null;
    onUpdate({ ...a, objects: nextObjects, selectedObjectId: lastId, timeline: nextTimeline });
    onSelectionChange(newSelection);
    return true;
  }, [onSelectionChange, onUpdate]);

  const duplicateSelected = useCallback(() => {
    if (!copySelected()) return;
    pasteClipboard();
  }, [copySelected, pasteClipboard]);

  const bringFront = useCallback(() => {
    const a = latestRef.current;
    const id = a.selectedObjectId; if (!id) return;
    onUpdate({ ...a, objects: (a.objects || []).map(o => o.id === id ? { ...o, zIndex: (a.objects || []).length + 1 } : o) });
  }, [onUpdate]);

  const sendBack = useCallback(() => {
    const a = latestRef.current;
    const id = a.selectedObjectId; if (!id) return;
    onUpdate({ ...a, objects: (a.objects || []).map(o => o.id === id ? { ...o, zIndex: 1 } : { ...o, zIndex: o.zIndex + 1 }) });
  }, [onUpdate]);

  const nudge = useCallback((dx, dy) => {
    const a = latestRef.current;
    const ids = latestSelectedIdsRef.current;
    const targetIds = ids.size > 0 ? ids : (a.selectedObjectId ? new Set([a.selectedObjectId]) : new Set());
    if (targetIds.size === 0) return;
    onUpdate({ ...a, objects: (a.objects || []).map(o => targetIds.has(o.id) ? { ...o, x: o.x + dx, y: o.y + dy } : o) });
  }, [onUpdate]);

  useImperativeHandle(ref, () => ({
    addObject,
    addImage: () => imgRef.current?.click(),
    addVideo: () => videoRef.current?.click(),
    addAudio: () => audioRef.current?.click(),
    loadSVG: () => fileRef.current?.click(),
    deleteSelected,
    copySelected,
    pasteClipboard,
    duplicateSelected,
    bringFront,
    sendBack,
    nudge,
  }), [addObject, deleteSelected, copySelected, pasteClipboard, duplicateSelected, bringFront, sendBack, nudge]);

  const startInteract = (e, objId, mode, handle = "") => {
    e.preventDefault(); e.stopPropagation();
    e.currentTarget?.setPointerCapture?.(e.pointerId);
    const a = latestRef.current;
    const obj = (a.objects || []).find(o => o.id === objId);
    if (!obj || obj.locked || obj.visible === false) return;

    // Update selection
    const currentIds = latestSelectedIdsRef.current;
    const wasAlreadySelected = currentIds.has(objId);
    let newIds;
    if (e.shiftKey) {
      newIds = new Set(currentIds);
      // Toggle: remove if already selected, add if not
      if (newIds.has(objId)) newIds.delete(objId); else newIds.add(objId);
    } else {
      // Keep existing multi-selection if clicking an already-selected object (supports group drag)
      // Will be reduced to single on pointerup if no drag movement occurred
      newIds = wasAlreadySelected && currentIds.size > 1 ? currentIds : new Set([objId]);
    }
    onSelectionChange(newIds);
    // selectedObjectId: the primary object for inspector (must be in selection)
    onUpdate({ ...a, selectedObjectId: newIds.has(objId) ? objId : ([...newIds][0] || null) });

    const origin = toStage(e.clientX, e.clientY);
    let hasMoved = false;
    const isShift = e.shiftKey;
    // Flag: we deferred single-selection reduce until pointerup (no drag)
    const deferredSingleSelect = !isShift && wasAlreadySelected && currentIds.size > 1;

    // Snapshot selected objects' initial positions for drag
    const snapIds = newIds.has(objId) ? newIds : new Set([objId]);
    dragSnapshotRef.current = Object.fromEntries(
      (a.objects || []).filter(o => snapIds.has(o.id)).map(o => [o.id, { x: o.x, y: o.y, width: o.width, height: o.height }])
    );

    const onMove = (me) => {
      const pt = toStage(me.clientX, me.clientY);
      const dx = pt.x - origin.x, dy = pt.y - origin.y;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) hasMoved = true;
      const curr = latestRef.current;
      const sw = curr.stageWidth || 1920, sh = curr.stageHeight || 1080;
      const MIN = 30;

      if (mode === "move") {
        const snap = dragSnapshotRef.current || {};
        const updatedObjects = (curr.objects || []).map(o => {
          if (!snap[o.id]) return o;
          const s = snap[o.id];
          return { ...o, x: Math.min(Math.max(s.x + dx, 0), Math.max(0, sw - o.width)), y: Math.min(Math.max(s.y + dy, 0), Math.max(0, sh - o.height)) };
        });
        onUpdate({ ...curr, objects: updatedObjects });
      } else {
        const s = dragSnapshotRef.current?.[objId] || obj;
        const r = s.x + s.width, b = s.y + s.height;
        let next = { x: s.x, y: s.y, width: s.width, height: s.height };
        if (handle.includes("e")) next.width  = Math.max(MIN, s.width  + dx);
        if (handle.includes("s")) next.height = Math.max(MIN, s.height + dy);
        if (handle.includes("w")) { next.x = Math.max(0, Math.min(s.x + dx, r - MIN)); next.width  = Math.max(MIN, r - next.x); }
        if (handle.includes("n")) { next.y = Math.max(0, Math.min(s.y + dy, b - MIN)); next.height = Math.max(MIN, b - next.y); }
        patchObj(objId, next);
      }
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      interactRef.current = null;
      dragSnapshotRef.current = null;
      // Plain click (no drag) on a multi-selected object → reduce to single selection
      if (!hasMoved && deferredSingleSelect) {
        const singleSet = new Set([objId]);
        onSelectionChange(singleSet);
        onUpdate({ ...latestRef.current, selectedObjectId: objId });
      }
    };
    interactRef.current = onUp;
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  // Rubber-band selection
  const startRubber = (e) => {
    if (e.target !== stageRef.current) return;
    e.preventDefault();
    e.currentTarget?.setPointerCapture?.(e.pointerId);
    const r = stageRef.current.getBoundingClientRect();
    const x0 = e.clientX - r.left, y0 = e.clientY - r.top;
    const isShift = e.shiftKey;
    // Snapshot pre-existing selection for shift+rubber-band additive mode
    const prevIds = new Set(latestSelectedIdsRef.current);
    rubberStartRef.current = { x0, y0, r };

    if (!isShift) {
      onSelectionChange(new Set());
      patchAct({ selectedObjectId: null });
    }

    const onMove = (me) => {
      if (!rubberStartRef.current) return;
      const x1 = me.clientX - rubberStartRef.current.r.left;
      const y1 = me.clientY - rubberStartRef.current.r.top;
      setRubberBand({ x0: rubberStartRef.current.x0, y0: rubberStartRef.current.y0, x1, y1 });
    };
    const onUp = (me) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      rubberHandlersRef.current = null;
      if (!rubberStartRef.current) return;
      const rc = rubberStartRef.current.r;
      const sc = zoomRef.current === "fit" ? baseScale : Number(zoomRef.current) || baseScale;
      const rx0 = rubberStartRef.current.x0 / sc, ry0 = rubberStartRef.current.y0 / sc;
      const rx1 = (me.clientX - rc.left) / sc, ry1 = (me.clientY - rc.top) / sc;
      const minX = Math.min(rx0, rx1), maxX = Math.max(rx0, rx1);
      const minY = Math.min(ry0, ry1), maxY = Math.max(ry0, ry1);
      const dist = Math.sqrt(Math.pow(me.clientX - rc.left - rubberStartRef.current.x0, 2) + Math.pow(me.clientY - rc.top - rubberStartRef.current.y0, 2));
      if (dist > 5) {
        const bandHits = new Set(
          getCanvasObjects(latestRef.current)
            .filter(o => o.visible !== false && !o.locked && o.x < maxX && o.x + o.width > minX && o.y < maxY && o.y + o.height > minY)
            .map(o => o.id)
        );
        // Shift: merge with previous; normal: replace
        const selected = isShift
          ? new Set([...prevIds, ...bandHits])
          : bandHits;
        onSelectionChange(selected);
        if (selected.size === 1) onUpdate({ ...latestRef.current, selectedObjectId: [...selected][0] });
        else if (selected.size > 1) onUpdate({ ...latestRef.current, selectedObjectId: null });
      }
      rubberStartRef.current = null;
      setRubberBand(null);
    };
    rubberHandlersRef.current = { move: onMove, up: onUp };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const addImage = (e) => { addImageFile(e.target.files[0]); e.target.value = ""; };
  const addVideo = (e) => { addVideoFile(e.target.files[0]); e.target.value = ""; };
  const addAudio = (e) => { addAudioFile(e.target.files[0]); e.target.value = ""; };
  const loadSVG = (e) => { loadSvgFile(e.target.files[0]); e.target.value = ""; };
  const zoomStep = useCallback((delta) => {
    if (!onZoomChange) return;
    onZoomChange(current => {
      const currentScale = current === "fit" ? baseScale : Number(current) || baseScale;
      return clamp(Number((currentScale + delta).toFixed(2)), 0.1, 4);
    });
  }, [onZoomChange]);
  const fitZoom = useCallback(() => {
    if (!onZoomChange) return;
    onZoomChange("fit");
  }, [onZoomChange]);
  const actualZoom = useCallback(() => {
    if (!onZoomChange) return;
    onZoomChange(1);
  }, [onZoomChange]);
  return (
    <div ref={viewportRef} data-stage-zoom-scope="true" style={{ flex: 1, overflow: "auto", background: "#ffffff", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 10 }}>
      <div style={{ position: "relative" }}>
        <div style={{ position: "sticky", top: 12, zIndex: 20, display: "flex", justifyContent: "flex-end", pointerEvents: "none", marginBottom: 10 }}>
          <div style={{ pointerEvents: "auto", display: "flex", alignItems: "center", gap: 6, padding: "8px 10px", borderRadius: 0, border: "1px solid #111111", background: "#ffffff", boxShadow: "none" }}>
            <button onClick={() => zoomStep(-0.1)} style={{ width: 28, height: 28, borderRadius: "50%", border: "1px solid #334155", background: "#162036", color: "#dbeafe", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>-</button>
            <button onClick={fitZoom} style={{ border: "1px solid #111111", background: "#ffffff", color: "#111111", borderRadius: 0, padding: "6px 10px", cursor: "pointer", fontSize: 11, fontWeight: 700, minWidth: 64 }}>
              {zoomPercent}%
            </button>
            <button onClick={() => zoomStep(0.1)} style={{ width: 28, height: 28, borderRadius: 0, border: "1px solid #111111", background: "#ffffff", color: "#111111", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>+</button>
            <button onClick={fitZoom} style={{ border: "1px solid #111111", background: "#ffffff", color: "#111111", borderRadius: 0, padding: "6px 10px", cursor: "pointer", fontSize: 10, fontWeight: 700 }}>
              Sığdır
            </button>
            <button onClick={actualZoom} style={{ border: "1px solid #111111", background: "#ffffff", color: "#111111", borderRadius: 0, padding: "6px 10px", cursor: "pointer", fontSize: 10, fontWeight: 700 }}>
              1:1
            </button>
          </div>
        </div>
        <div style={{ fontSize: 9, color: "#444444", marginBottom: 8, display: "flex", justifyContent: "space-between", gap: 10 }}>
          <span>{activity.stageWidth} x {activity.stageHeight} | x{scale.toFixed(2)} | {activity.activeLayerId === "base" ? "Ana Katman" : "Katman + Ana Katman"}</span>
          <span>{selectedIds.size > 0 ? `${selectedIds.size} secili` : `${objects.length} gorunen nesne`} | Ctrl + tekerlek sahneyi zoomlar</span>
        </div>
        <div style={{ marginBottom: 12, padding: "12px 14px", borderRadius: 0, border: "1px solid #111111", background: "#ffffff", color: "#333333", fontSize: 11, lineHeight: 1.6, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", boxShadow: "none" }}>
          <span>{hasSvg ? "1. Zeminin uzerine nesne ekle. 2. Nesneyi sec. 3. Timeline'dan sure ve animasyon ver. 4. Onizle ile test et." : "1. Once SVG zemin yukle. 2. Uzerine nesne ekle. 3. Timeline ve tetikleyici ile hareket ver."}</span>
          <span style={{ color: "#111111", fontWeight: 800 }}>{hasSvg ? (selectedIds.size > 0 ? "Secili nesne timeline'da da vurgulanir." : "Zemin hazir, nesne ekleyerek devam et.") : "Bu editorde once SVG zemin yuklemen onerilir."}</span>
        </div>
        <div style={{ fontSize: 9, color: "#444", marginBottom: 4, textAlign: "right" }}>
          {activity.stageWidth}x{activity.stageHeight} | x{scale.toFixed(2)} | {selectedIds.size > 0 ? `${selectedIds.size} secili` : `${objects.length} nesne`}
        </div>
        <div
          ref={stageRef}
          onPointerDown={startRubber}
          style={{ width: vw, height: vh, position: "relative", background: activity.backgroundColor || "#fff", border: "1px solid #111111", borderRadius: 0, overflow: "hidden", cursor: "crosshair", boxShadow: "none", touchAction: "none" }}
        >
          {pdfBackgroundObject && (
            <img
              src={pdfBackgroundObject.imageData}
              alt={pdfBackgroundObject.label || "PDF Zemin"}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "contain",
                pointerEvents: "none",
                userSelect: "none",
                zIndex: 0,
              }}
            />
          )}
          {/* Izgara */}
          <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(0,0,0,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,.04) 1px,transparent 1px)", backgroundSize: `${40 * scale}px ${40 * scale}px`, pointerEvents: "none" }} />
          {/* SVG zemin */}
          {activity.svgMarkup && <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }} dangerouslySetInnerHTML={{ __html: activity.svgMarkup }} />}
          {!hasSvg && !hasObjects && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 2, background: "rgba(255,255,255,.92)" }}>
              <div style={{ width: Math.min(vw - 40, 520), maxWidth: "100%", borderRadius: 0, border: "1px solid #111111", background: "#ffffff", boxShadow: "none", padding: 24, textAlign: "center" }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#111111", letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 10 }}>SVG-first baslangic</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#111111", lineHeight: 1.2, marginBottom: 10 }}>Once SVG zemin yukle</div>
                <div style={{ fontSize: 13, color: "#333333", lineHeight: 1.7, marginBottom: 18 }}>
                  Bu editorde en rahat akis, once zemini yukleyip sonra buton, hotspot, video ve metinleri onun ustune yerlestirmektir.
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 8, marginBottom: 18, textAlign: "left" }}>
                  <div style={{ borderRadius: 0, background: "#ffffff", border: "1px solid #111111", padding: 10, fontSize: 11, color: "#111111" }}><strong>1.</strong> SVG zemin yukle</div>
                  <div style={{ borderRadius: 0, background: "#ffffff", border: "1px solid #111111", padding: 10, fontSize: 11, color: "#111111" }}><strong>2.</strong> Nesneleri yerlestir</div>
                  <div style={{ borderRadius: 0, background: "#ffffff", border: "1px solid #111111", padding: 10, fontSize: 11, color: "#111111" }}><strong>3.</strong> Timeline ve trigger ver</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
                  <button onClick={() => fileRef.current?.click()} style={{ border: "1px solid #111111", background: "#111111", color: "#ffffff", borderRadius: 0, padding: "10px 18px", cursor: "pointer", fontSize: 12, fontWeight: 800, boxShadow: "none" }}>
                    SVG Zemin Yükle
                  </button>
                  <button onClick={() => imgRef.current?.click()} style={{ border: "1px solid #111111", background: "#ffffff", color: "#111111", borderRadius: 0, padding: "10px 16px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                    Resim ile basla
                  </button>
                </div>
                {!hasObjects && <div style={{ marginTop: 12, fontSize: 11, color: "#444444" }}>SVG olmadan da devam edebilirsin ama sistemin ana akisi zemin ustunden ilerler.</div>}
              </div>
            </div>
          )}
          {/* Rubber-band seçim dikdörtgeni */}
          {rubberBand && (() => {
            const { x0, y0, x1, y1 } = rubberBand;
            return <div style={{ position: "absolute", left: Math.min(x0,x1), top: Math.min(y0,y1), width: Math.abs(x1-x0), height: Math.abs(y1-y0), border: "1px dashed #111111", background: "rgba(17,17,17,.08)", pointerEvents: "none", zIndex: 9999 }} />;
          })()}
          {/* Nesneler */}
          {[...renderObjects].filter(o => o.visible !== false).sort((a, b) => a.zIndex - b.zIndex).map(o => {
            const isSel = selectedIds.has(o.id) || activity.selectedObjectId === o.id;
            const isAnswerDragPreview = answerPreview?.dragId === o.id;
            const isAnswerDropPreview = answerPreview?.dropId === o.id;
            const isAnswerPreview = isAnswerDragPreview || isAnswerDropPreview;
            const st = o.type === "draggable" || o.type === "dropzone"
              ? upgradeDragDropStyle(o.type, o.style || {})
              : (o.style || {});
            const isTimelineActive = isObjectTimelineActive(activity, o.id, timelineTime);
            const motionStyle = getTimelineMotionStyle(activity, o.id, timelineTime, {
              suppressBoundaryEffects: timelineTime <= 0.01,
            });
            const inactiveOpacity = o.type === "draggable" || o.type === "dropzone" ? 0.72 : 0.18;
            return (
              <div
                key={o.id}
                onPointerDown={e => startInteract(e, o.id, "move")}
                style={{
                  position: "absolute", left: o.x * scale, top: o.y * scale,
                  width: o.width * scale, height: o.height * scale,
                  transform: `translate(${motionStyle.translateX * scale}px, ${motionStyle.translateY * scale}px) rotate(${o.rotation || 0}deg) scale(${motionStyle.scale})`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: o.locked ? "not-allowed" : "move",
                  userSelect: "none", zIndex: o.zIndex,
                  background: o.imageData ? "transparent" : (st.background || "transparent"),
                  border: `${isSel || isAnswerPreview ? 2 : 1}px ${st.borderStyle || "solid"} ${isSel ? "#111111" : isAnswerDragPreview ? "#2563eb" : isAnswerDropPreview ? "#ea580c" : (st.borderColor || "transparent")}`,
                  borderRadius: (st.borderRadius || 0) * scale,
                  outline: isSel ? "2px solid rgba(17,17,17,.18)" : isAnswerPreview ? `3px solid ${isAnswerDragPreview ? "rgba(37,99,235,.22)" : "rgba(234,88,12,.22)"}` : "none",
                  boxSizing: "border-box",
                  fontSize: (st.fontSize || 13) * scale,
                  color: st.color || "#111",
                  fontWeight: 600, overflow: "hidden",
                  opacity: isTimelineActive ? motionStyle.opacity : inactiveOpacity,
                  filter: isTimelineActive ? "none" : (o.type === "draggable" || o.type === "dropzone" ? "none" : "grayscale(.5)"),
                  touchAction: "none",
                  boxShadow: isAnswerPreview ? `0 0 0 4px ${isAnswerDragPreview ? "rgba(37,99,235,.14)" : "rgba(234,88,12,.16)"}, 0 16px 28px rgba(15,23,42,.14)` : "none",
                }}
              >
                {o.type === "video" && o.mediaUrl ? (
                  <video
                    src={o.mediaUrl}
                    muted
                    loop={!!o.loop}
                    autoPlay={!!o.autoPlay}
                    playsInline
                    preload="metadata"
                    style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none", background: "#020617" }}
                  />
                ) : o.type === "audio" && o.mediaUrl ? (
                  <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", gap: 10, padding: "0 12px", background: "linear-gradient(135deg,#082f49,#0f172a)", color: "#e0f2fe" }}>
                    <div style={{ width: 34, height: 34, borderRadius: 999, background: "rgba(56,189,248,.18)", border: "1px solid rgba(56,189,248,.42)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>♪</div>
                    <div style={{ minWidth: 0, flex: 1, textAlign: "left" }}>
                      <div style={{ fontSize: Math.max(10, 12 * scale), fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.label || "Ses"}</div>
                      <div style={{ fontSize: Math.max(9, 10 * scale), color: "#7dd3fc", opacity: 0.92 }}>Ses oynaticisi</div>
                    </div>
                  </div>
                ) : o.type === "shape" ? (
                  <span style={{ pointerEvents: "none", padding: "0 8px", textAlign: "center", color: st.color || "#ffffff", opacity: 0.82 }}>{o.label}</span>
                ) : o.imageData ? (
                  <img src={o.imageData} alt={o.label} style={{ width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none" }} />
                ) : (
                  <span
                    style={{
                      pointerEvents: "none",
                      padding: "0 6px",
                      textAlign: "center",
                      fontWeight: o.selectionQuestionId ? 800 : undefined,
                      fontSize: o.selectionQuestionId ? Math.max(18, (st.fontSize || 13) * scale) : undefined,
                      color: o.selectionQuestionId ? "rgba(37,99,235,.24)" : undefined,
                    }}
                  >
                    {o.selectionQuestionId ? "✓" : o.label}
                  </span>
                )}
                {isSel && !o.locked && HANDLE_DIRS.map(dir => {
                  const p = HANDLE_POS[dir];
                  return <div key={dir} onPointerDown={e => startInteract(e, o.id, "resize", dir)} style={{ position: "absolute", width: 10, height: 10, borderRadius: "50%", background: "#ffffff", border: "2px solid #111111", cursor: HANDLE_CURSOR[dir], zIndex: 10, touchAction: "none", ...Object.fromEntries(Object.entries(p).filter(([k]) => !["ml","mt"].includes(k))), ...(p.ml ? { marginLeft: p.ml } : {}), ...(p.mt ? { marginTop: p.mt } : {}) }} />;
                })}
                {isSel && activity.selectedObjectId === o.id && (
                  <div style={{ position: "absolute", top: -20, left: 0, background: "#ffffff", color: "#111111", fontSize: 9, padding: "2px 6px", borderRadius: 0, border: "1px solid #111111", whiteSpace: "nowrap", pointerEvents: "none" }}>
                    {Math.round(o.x)},{Math.round(o.y)} · {Math.round(o.width)}×{Math.round(o.height)}
                  </div>
                )}
                {isAnswerPreview && (
                  <div style={{ position: "absolute", top: -20, right: 0, background: isAnswerDragPreview ? "#dbeafe" : "#ffedd5", color: isAnswerDragPreview ? "#1d4ed8" : "#c2410c", fontSize: 9, fontWeight: 800, padding: "2px 6px", borderRadius: 999, border: `1px solid ${isAnswerDragPreview ? "#93c5fd" : "#fdba74"}`, whiteSpace: "nowrap", pointerEvents: "none" }}>
                    {isAnswerDragPreview ? "Surukle secili" : "Birak secili"}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Hidden file inputs */}
        <input ref={imgRef} type="file" accept="image/*" onChange={addImage} style={{ display: "none" }} />
        <input ref={videoRef} type="file" accept="video/mp4,video/webm,video/ogg" onChange={addVideo} style={{ display: "none" }} />
        <input ref={audioRef} type="file" accept="audio/*" onChange={addAudio} style={{ display: "none" }} />
        <input ref={fileRef} type="file" accept=".svg" onChange={loadSVG} style={{ display: "none" }} />
      </div>
    </div>
  );
});

// ─── Sağ Inspector ─────────────────────────────────────────────────────────────

function RightInspector({ activity, onUpdate, selectedIds, hideTimeline = false, activities = [] }) {
  if (!activity) return <div style={{ width: 240, flexShrink: 0, borderLeft: "1px solid #252540", background: "#111125" }} />;
  const objects = activity.objects || [];
  const layers = getActivityLayers(activity);
  const timeline = activity.timeline || [];
  const triggers = activity.triggers || [];
  const sel = objects.find(o => o.id === activity.selectedObjectId) || null;
  const multiSel = selectedIds.size > 1;

  const patchAct = (p) => onUpdate({ ...activity, ...p });
  const patchObj = (id, p) => onUpdate(updateActivityObject(activity, id, p, { syncDragDropFamily: true }));
  const patchTimeline = (id, p) => patchAct({ timeline: timeline.map(item => item.id === id ? { ...item, ...p } : item) });
  const patchTrigger = (id, p) => patchAct({ triggers: triggers.map(item => item.id === id ? { ...item, ...p } : item) });

  const s10 = { fontSize: 10, fontWeight: 800, color: "#64748b", marginBottom: 8, letterSpacing: 0.3 };
  const card = { background: "#ffffff", border: "1px solid #d7e0eb", borderRadius: 16, padding: 12, marginBottom: 10, boxShadow: "0 12px 24px rgba(15,23,42,.06)" };
  const triggerSourceOptions = [{ value: "Secili Nesne", label: "Tiklanan / secili nesne" }, ...objects.map(obj => ({ value: obj.id, label: `${obj.label || obj.type} (${obj.type})` }))];
  const triggerTargetOptions = objects.map(obj => ({ value: obj.id, label: `${obj.label || obj.type} (${obj.type})` }));
  const triggerLayerOptions = layers.map(layer => ({ value: layer.id, label: layer.name }));
  const triggerActivityOptions = [{ value: "__next__", label: "Sonraki sahne" }, ...activities.filter(item => item.id !== activity.id).map(item => ({ value: item.id, label: item.name }))];

  return (
    <div style={{ width: 280, flexShrink: 0, borderLeft: "1px solid #d7e0eb", background: "linear-gradient(180deg,#f8fbff,#eef4fb)", overflowY: "auto", padding: 12 }}>
      {/* Seçili nesne özellikleri */}
      {multiSel ? (
        <div style={card}>
          <div style={s10}>SEÇİM</div>
          <div style={{ fontSize: 11, color: "#B0BEC5" }}>{selectedIds.size} nesne seçildi</div>
          <div style={{ fontSize: 10, color: "#555", marginTop: 4 }}>Ok tuşları ile taşıyın · Delete ile silin</div>
        </div>
      ) : sel ? (
        <div style={card}>
          <div style={{ ...s10, color: "#111111" }}>{sel.type.toUpperCase()}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <Inp label="Etiket" value={sel.label || ""} onChange={e => patchObj(sel.id, { label: e.target.value })} />
            <div style={{ display: "flex", gap: 5 }}>
              <Inp label="X" type="number" value={Math.round(sel.x)} onChange={e => patchObj(sel.id, { x: +e.target.value })} />
              <Inp label="Y" type="number" value={Math.round(sel.y)} onChange={e => patchObj(sel.id, { y: +e.target.value })} />
            </div>
            <div style={{ display: "flex", gap: 5 }}>
              <Inp label="G" type="number" value={Math.round(sel.width)}  onChange={e => patchObj(sel.id, { width:  Math.max(20, +e.target.value) })} />
              <Inp label="Y" type="number" value={Math.round(sel.height)} onChange={e => patchObj(sel.id, { height: Math.max(20, +e.target.value) })} />
            </div>
            <Inp label="Döndür °" type="number" value={sel.rotation || 0} onChange={e => patchObj(sel.id, { rotation: +e.target.value })} />
            <SelectInp label="Layer" value={sel.layerId || "base"} onChange={e => patchObj(sel.id, { layerId: e.target.value })} options={layers.map(layer => ({ value: layer.id, label: layer.name }))} />
            {(sel.type === "draggable" || sel.type === "dropzone") && (
              <Inp label="Grup (eşleştirme)" value={sel.group || ""} onChange={e => patchObj(sel.id, { group: e.target.value })} placeholder="A, B, ..." />
            )}
            <div>
              <label style={{ fontSize: 10, color: "#78909C", display: "block", marginBottom: 4 }}>Renkler</label>
              {(sel.type === "draggable" || sel.type === "dropzone") && (
                <div style={{ marginBottom: 6 }}>
                  <label style={{ fontSize: 9, color: "#78909C", display: "block", marginBottom: 3 }}>Ana renk (kenar+zemin+yazı)</label>
                  <input type="color" value={sel.style?.borderColor || "#2563eb"} onChange={e => {
                    const c = e.target.value;
                    const r = parseInt(c.slice(1,3),16), g = parseInt(c.slice(3,5),16), b = parseInt(c.slice(5,7),16);
                    const lum = (0.299*r + 0.587*g + 0.114*b) / 255;
                    const textColor = lum > 0.55 ? "#1a1a2e" : "#ffffff";
                    const bgHex = `${c}22`;
                    patchObj(sel.id, { style: { ...sel.style, borderColor: c, background: bgHex, color: textColor } });
                  }} style={{ width: 40, height: 28, border: "1px solid #e2e8f0", borderRadius: 6, cursor: "pointer", padding: 2 }} />
                </div>
              )}
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input type="color" value={sel.style?.color || "#000000"} onChange={e => patchObj(sel.id, { style: { ...sel.style, color: e.target.value } })} style={{ width: 28, height: 24, border: "none", background: "none", cursor: "pointer" }} />
                <span style={{ fontSize: 9, color: "#78909C" }}>yazı</span>
                <input type="color" value={(sel.style?.background || "#000000").replace(/[^#0-9a-fA-F]/g, "").slice(0, 7) || "#000000"} onChange={e => patchObj(sel.id, { style: { ...sel.style, background: e.target.value } })} style={{ width: 28, height: 24, border: "none", background: "none", cursor: "pointer" }} />
                <span style={{ fontSize: 9, color: "#78909C" }}>zemin</span>
                <input type="color" value={sel.style?.borderColor || "#000000"} onChange={e => patchObj(sel.id, { style: { ...sel.style, borderColor: e.target.value } })} style={{ width: 28, height: 24, border: "none", background: "none", cursor: "pointer" }} />
                <span style={{ fontSize: 9, color: "#78909C" }}>kenar</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 5 }}>
              <Inp label="Font" type="number" value={sel.style?.fontSize || 14} onChange={e => patchObj(sel.id, { style: { ...sel.style, fontSize: +e.target.value } })} />
              <Inp label="Radius" type="number" value={sel.style?.borderRadius || 0} onChange={e => patchObj(sel.id, { style: { ...sel.style, borderRadius: +e.target.value } })} />
            </div>
            {sel.imageData && (
              <label style={{ display: "block", padding: "4px 0", borderRadius: 5, border: "1px solid #4CAF50", background: "#4CAF5022", color: "#4CAF50", fontSize: 10, fontWeight: 600, cursor: "pointer", textAlign: "center" }}>
                Resim Değiştir
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={ev => { const f = ev.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = x => patchObj(sel.id, { imageData: x.target.result }); r.readAsDataURL(f); ev.target.value = ""; }} />
              </label>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "#78909C", cursor: "pointer" }}><input type="checkbox" checked={sel.visible !== false} onChange={e => patchObj(sel.id, { visible: e.target.checked })} style={{ accentColor: "#4CAF50" }} />Görünür</label>
              <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "#78909C", cursor: "pointer" }}><input type="checkbox" checked={!!sel.locked} onChange={e => patchObj(sel.id, { locked: e.target.checked })} style={{ accentColor: "#FF9800" }} />Kilitli</label>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ ...card, textAlign: "center", color: "#333", fontSize: 10, padding: 16 }}>
          Canvas'tan nesne seçin<br />veya rubber-band ile çoklu seçim yapın
        </div>
      )}

      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <div style={s10}>LAYERS ({layers.length})</div>
          <button onClick={() => { const newLayer = createLayer("Katman", layers.length); patchAct({ layers: [...layers, newLayer], activeLayerId: newLayer.id }); }} style={{ background: "#B388FF22", border: "1px solid #B388FF", color: "#B388FF", borderRadius: 4, cursor: "pointer", fontSize: 9, padding: "2px 6px" }}>+</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 260, overflowY: "auto" }}>
          {layers.map(layer => (
            <div key={layer.id} onClick={() => patchAct({ activeLayerId: layer.id, selectedObjectId: null })} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 7px", borderRadius: 6, cursor: "pointer", background: activity.activeLayerId === layer.id ? "#252550" : "#0d0d1a", border: `1px solid ${activity.activeLayerId === layer.id ? "#B388FF" : "#252540"}` }}>
              <span style={{ width: 8, height: 8, borderRadius: layer.kind === "base" ? 2 : "50%", background: layer.kind === "base" ? "#00BCD4" : "#B388FF", flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 10, color: "#B0BEC5" }}>{layer.name}</span>
              {layer.kind !== "base" && <button onClick={e => { e.stopPropagation(); patchAct({ layers: layers.filter(item => item.id !== layer.id), activeLayerId: activity.activeLayerId === layer.id ? "base" : activity.activeLayerId, objects: objects.map(obj => obj.layerId === layer.id ? { ...obj, layerId: "base" } : obj) }); }} style={{ border: "none", background: "transparent", color: "#f87171", cursor: "pointer", fontSize: 10 }}>×</button>}
            </div>
          ))}
        </div>
      </div>

      {/* Katmanlar */}
      <div style={card}>
        <div style={s10}>KATMANLAR ({objects.length})</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 180, overflowY: "auto" }}>
          {[...objects].sort((a, b) => b.zIndex - a.zIndex).map(o => (
            <div key={o.id} onClick={() => { onUpdate({ ...activity, selectedObjectId: o.id }); }} style={{ padding: "4px 6px", borderRadius: 4, cursor: "pointer", background: (selectedIds.has(o.id) || activity.selectedObjectId === o.id) ? "#252550" : "transparent", fontSize: 10, color: "#B0BEC5", display: "flex", gap: 5, alignItems: "center" }}>
              <span style={{ fontSize: 9, color: "#555", width: 12 }}>{o.zIndex}</span>
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", opacity: o.visible === false ? 0.45 : 1 }}>{o.label || o.type}</span>
              <button title={o.visible === false ? "Goster" : "Gizle"} onClick={e => { e.stopPropagation(); patchObj(o.id, { visible: o.visible === false }); }} style={{ border: "none", background: "transparent", color: o.visible === false ? "#555" : "#4CAF50", cursor: "pointer", fontSize: 9, padding: 0 }}>G</button>
              <button title={o.locked ? "Kilidi ac" : "Kilitle"} onClick={e => { e.stopPropagation(); patchObj(o.id, { locked: !o.locked }); }} style={{ border: "none", background: "transparent", color: o.locked ? "#FF9800" : "#555", cursor: "pointer", fontSize: 9, padding: 0 }}>K</button>
            </div>
          ))}
        </div>
      </div>

      {!hideTimeline && (
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <div style={s10}>ZAMANÇİZELGESİ</div>
            <button onClick={() => patchAct({ timeline: [...timeline, createTimelineItem(timeline.length)] })} style={{ background: "#ffffff", border: "1px solid #111111", color: "#111111", borderRadius: 0, cursor: "pointer", fontSize: 9, padding: "2px 6px" }}>+</button>
          </div>
          {timeline.map(item => (
            <div key={item.id} style={{ background: "#ffffff", border: "1px solid #111111", borderRadius: 0, padding: 7, marginBottom: 5 }}>
              <div style={{ display: "flex", gap: 5, alignItems: "center", marginBottom: 5 }}>
                <Inp value={item.name} onChange={e => patchTimeline(item.id, { name: e.target.value })} placeholder="Animasyon adi" />
                <button onClick={() => patchAct({ timeline: timeline.filter(x => x.id !== item.id) })} style={{ border: "none", background: "transparent", color: "#f44336", cursor: "pointer", fontSize: 12 }}>×</button>
              </div>
              <div style={{ display: "flex", gap: 5 }}>
                <Inp label="Baş" type="number" value={item.start} onChange={e => patchTimeline(item.id, { start: +e.target.value || 0 })} />
                <Inp label="Süre" type="number" value={item.duration} onChange={e => patchTimeline(item.id, { duration: +e.target.value || 0 })} />
              </div>
            </div>
          ))}
          {timeline.length === 0 && <div style={{ fontSize: 10, color: "#333", textAlign: "center" }}>Animasyon yok</div>}
        </div>
      )}

      {/* Tetikleyiciler */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <div style={s10}>TETİKLEYİCİLER</div>
          <button onClick={() => patchAct({ triggers: [...triggers, createTriggerItem(triggers.length)] })} style={{ background: "#00BCD422", border: "1px solid #00BCD4", color: "#00BCD4", borderRadius: 4, cursor: "pointer", fontSize: 9, padding: "2px 6px" }}>+</button>
        </div>
        {triggers.map(item => (
          <div key={item.id} style={{ background: "#0d0d1a", border: "1px solid #252540", borderRadius: 6, padding: 7, marginBottom: 5 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 5, marginBottom: 5 }}>
              <SelectInp value={item.when || "onClick"} onChange={e => patchTrigger(item.id, { when: e.target.value })} options={[{ value: "onClick", label: "Tıklandığında" }, { value: "onHover", label: "Üzerine gelince" }, { value: "onDrop", label: "Bırakılınca" }]} />
              <button onClick={() => patchAct({ triggers: triggers.filter(x => x.id !== item.id) })} style={{ border: "none", background: "transparent", color: "#f44336", cursor: "pointer", fontSize: 12 }}>×</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <Inp label="Ad" value={item.name || ""} onChange={e => patchTrigger(item.id, { name: e.target.value })} placeholder="Butonla katman gecisi" />
              <SelectInp label="Tetikleyen" value={item.target || "Secili Nesne"} onChange={e => patchTrigger(item.id, { target: e.target.value })} options={triggerSourceOptions} />
              <SelectInp label="Aksiyon" value={item.action || "SayfaGec"} onChange={e => patchTrigger(item.id, { action: e.target.value, value: e.target.value === "KatmanaGec" ? (layers[0]?.id || "base") : e.target.value === "SayfaGec" ? "__next__" : "" })} options={[{ value: "SayfaGec", label: "Sayfaya Geç" }, { value: "KatmanaGec", label: "Katmana Geç" }, { value: "Goster", label: "Nesne Göster" }, { value: "Gizle", label: "Nesne Gizle" }, { value: "SesCal", label: "Ses Çal" }]} />
              {item.action === "KatmanaGec" ? (
                <SelectInp label="Gidilecek Katman" value={item.value || (layers[0]?.id || "base")} onChange={e => patchTrigger(item.id, { value: e.target.value })} options={triggerLayerOptions} />
              ) : item.action === "SayfaGec" ? (
                <SelectInp label="Gidilecek Sahne" value={item.value || "__next__"} onChange={e => patchTrigger(item.id, { value: e.target.value })} options={triggerActivityOptions.length ? triggerActivityOptions : [{ value: "__next__", label: "Sonraki sahne" }]} />
              ) : item.action === "Goster" || item.action === "Gizle" ? (
                <SelectInp label="Etkilenecek Nesne" value={item.value || ""} onChange={e => patchTrigger(item.id, { value: e.target.value })} options={triggerTargetOptions.length ? triggerTargetOptions : [{ value: "", label: "Nesne bulunamadı" }]} />
              ) : (
                <Inp label="Değer" value={item.value || ""} onChange={e => patchTrigger(item.id, { value: e.target.value })} />
              )}
            </div>
          </div>
        ))}
        {triggers.length === 0 && <div style={{ fontSize: 10, color: "#333", textAlign: "center" }}>Tetikleyici yok</div>}
      </div>
    </div>
  );
}

function AnswerFormPanel({ activity, onUpdate, onPreviewChange = () => {} }) {
  const patch = (patchValue) => onUpdate({ ...activity, ...patchValue });
  const options = activity.mcOptions || [];
  const draggables = getCanvasObjects(activity).filter(item => item.type === "draggable");
  const dropzones = getCanvasObjects(activity).filter(item => item.type === "dropzone");
  const matches = activity.dragDropMatches || {};
  const correctOptionCount = options.filter(option => option.isCorrect).length;
  const matchedCount = draggables.filter(item => matches[item.id]).length;
  const rowCard = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #dbe7f5",
    background: "#ffffff",
  };
  const badge = {
    minWidth: 26,
    height: 26,
    borderRadius: 999,
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 10,
    fontWeight: 800,
    flexShrink: 0,
  };
  const setCorrectOption = (optionId, checked) => {
    if ((activity.mcMode || "single") === "single") {
      patch({
        mcOptions: options.map(option => ({ ...option, isCorrect: option.id === optionId ? checked : false })),
      });
      return;
    }
    patch({
      mcOptions: options.map(option => option.id === optionId ? { ...option, isCorrect: checked } : option),
    });
  };
  const setMatch = (dragId, dropId) => {
    onPreviewChange({ dragId, dropId: dropId || null });
    patch({
      dragDropMatches: {
        ...matches,
        [dragId]: dropId,
      },
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {(activity.type === "selection" || activity.type === "mixed") && (
        <div style={{ background: "linear-gradient(180deg,#ffffff,#f8fbff)", border: "1px solid rgba(203,213,225,.95)", borderRadius: 14, padding: 10, boxShadow: "0 10px 22px rgba(15,23,42,.05)" }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: "#334155", marginBottom: 6, letterSpacing: 0.4, textTransform: "uppercase" }}>Dogru Secenek Formu</div>
          <div style={{ fontSize: 10, color: "#64748b", marginBottom: 8, lineHeight: 1.55 }}>
            {(activity.mcQuestion || "Soru metni yok.").trim()}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            <div style={{ padding: "4px 8px", borderRadius: 999, background: "#eff6ff", color: "#1d4ed8", fontSize: 9, fontWeight: 800, border: "1px solid #bfdbfe" }}>
              {(activity.mcMode || "single") === "multi" ? "Coklu dogru" : "Tek dogru"}
            </div>
            <div style={{ padding: "4px 8px", borderRadius: 999, background: "#f8fafc", color: "#475569", fontSize: 9, fontWeight: 700, border: "1px solid #e2e8f0" }}>
              {correctOptionCount} dogru secili
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {options.map((option, index) => (
              <label
                key={option.id}
                onMouseEnter={() => onPreviewChange({ optionId: option.id })}
                onClick={() => onPreviewChange({ optionId: option.id })}
                style={{
                  ...rowCard,
                  cursor: "pointer",
                  borderColor: option.isCorrect ? "#86efac" : "#dbe7f5",
                  background: option.isCorrect ? "linear-gradient(180deg,#f0fdf4,#ffffff)" : "#ffffff",
                }}
              >
                <div style={badge}>{index + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {option.label || `Secenek ${index + 1}`}
                  </div>
                </div>
                <input
                  type={(activity.mcMode || "single") === "multi" ? "checkbox" : "radio"}
                  name={`answer-form-${activity.id}`}
                  checked={!!option.isCorrect}
                  onChange={e => setCorrectOption(option.id, e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: "#16a34a", flexShrink: 0 }}
                />
              </label>
            ))}
            {options.length === 0 && <div style={{ fontSize: 10, color: "#64748b", textAlign: "center", padding: "10px 0" }}>Henüz seçenek yok.</div>}
          </div>
        </div>
      )}

      {(activity.type === "drag-drop" || activity.type === "mixed") && (
        <div style={{ background: "linear-gradient(180deg,#ffffff,#f8fbff)", border: "1px solid rgba(203,213,225,.95)", borderRadius: 14, padding: 10, boxShadow: "0 10px 22px rgba(15,23,42,.05)" }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: "#334155", marginBottom: 6, letterSpacing: 0.4, textTransform: "uppercase" }}>Dogru Eslesme Formu</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            <button
              onClick={() => patch({ dragDropMatches: buildAutoDragMatches(activity) })}
              style={{ minHeight: 28, padding: "0 10px", borderRadius: 10, border: "1px solid #86efac", background: "#f0fdf4", color: "#15803d", fontSize: 9, fontWeight: 800, cursor: "pointer" }}
            >
              Oto Doldur
            </button>
            <button
              onClick={() => patch({ dragDropMatches: {} })}
              style={{ minHeight: 28, padding: "0 10px", borderRadius: 10, border: "1px solid #cbd5e1", background: "#ffffff", color: "#475569", fontSize: 9, fontWeight: 800, cursor: "pointer" }}
            >
              Temizle
            </button>
            <div style={{ padding: "4px 8px", borderRadius: 999, background: "#fff7ed", color: "#c2410c", fontSize: 9, fontWeight: 700, border: "1px solid #fed7aa" }}>
              {matchedCount}/{draggables.length} eslesme
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {draggables.map((drag, index) => (
              <div
                key={drag.id}
                onMouseEnter={() => onPreviewChange({ dragId: drag.id, dropId: matches[drag.id] || null })}
                onClick={() => onPreviewChange({ dragId: drag.id, dropId: matches[drag.id] || null })}
                style={{ ...rowCard, cursor: "pointer" }}
              >
                <div style={{ ...badge, background: "#eff6ff", color: "#1d4ed8", borderColor: "#bfdbfe" }}>{index + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {drag.label || `Surukle ${index + 1}`}
                  </div>
                </div>
                <select
                  value={matches[drag.id] || ""}
                  onFocus={() => onPreviewChange({ dragId: drag.id, dropId: matches[drag.id] || null })}
                  onChange={e => setMatch(drag.id, e.target.value)}
                  style={{ width: 122, padding: "5px 8px", borderRadius: 8, border: `1px solid ${matches[drag.id] ? "#fdba74" : "#cbd5e1"}`, background: "#ffffff", color: matches[drag.id] ? "#c2410c" : "#475569", fontSize: 10, outline: "none" }}
                >
                  <option value="">Birak sec</option>
                  {dropzones.map((drop, dropIndex) => (
                    <option key={drop.id} value={drop.id}>
                      {drop.label || `Birak ${dropIndex + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            {draggables.length === 0 && <div style={{ fontSize: 10, color: "#64748b", textAlign: "center", padding: "10px 0" }}>Henüz sürüklenebilir öğe yok.</div>}
            {draggables.length > 0 && dropzones.length === 0 && <div style={{ fontSize: 10, color: "#64748b", textAlign: "center", paddingBottom: 6 }}>Önce bırakma alanı ekleyin.</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function RightInspectorPhase2({ activity, onUpdate, selectedIds, hideTimeline = false, activities = [], variables = [], onVariablesChange = () => {}, mobile = false, uiMode = "basic", onAnswerPreviewChange = () => {} }) {
  if (!activity) return <div style={{ width: mobile ? "100%" : 240, flexShrink: 0, borderLeft: mobile ? "none" : "1px solid #1a2238", background: "#1e2740" }} />;
  const objects = activity.objects || [];
  const layers = getActivityLayers(activity);
  const timeline = activity.timeline || [];
  const triggers = activity.triggers || [];
  const sel = objects.find(o => o.id === activity.selectedObjectId) || null;
  const multiSel = selectedIds.size > 1;
  const selectedObjects = objects.filter(o => selectedIds.has(o.id));
  const selectionBounds = getObjectSelectionBounds(selectedObjects);

  const patchAct = (p) => onUpdate({ ...activity, ...p });
  const patchObj = (id, p) => onUpdate(updateActivityObject(activity, id, p, { syncDragDropFamily: true }));
  const patchTimeline = (id, p) => patchAct({ timeline: timeline.map(item => item.id === id ? { ...item, ...p } : item) });
  const patchTrigger = (id, p) => patchAct({ triggers: triggers.map(item => item.id === id ? { ...item, ...p } : item) });
  const patchTriggerConditions = (triggerId, updater) => {
    const currentTrigger = triggers.find(item => item.id === triggerId);
    if (!currentTrigger) return;
    const currentConditions = currentTrigger.conditions || [];
    const nextConditions = typeof updater === "function" ? updater(currentConditions) : updater;
    patchTrigger(triggerId, { conditions: nextConditions });
  };
  const patchVariables = updater => onVariablesChange(typeof updater === "function" ? updater(variables) : updater);
  const resolvePickerColor = (value, fallback = "#111111") => {
    const match = String(value || "").match(/#[0-9a-fA-F]{6}/);
    return match ? match[0] : fallback;
  };
  const patchSelectedObjects = (patch = {}, stylePatch = null) => {
    if (!selectedObjects.length) return;
    const selectedTypeSet = new Set(selectedObjects.map(item => item.type));
    const hasDragDropPatch = (Object.prototype.hasOwnProperty.call(patch, "width")
      || Object.prototype.hasOwnProperty.call(patch, "height")
      || !!stylePatch)
      && [...selectedTypeSet].some(type => type === "draggable" || type === "dropzone");
    const nextDragDropDefaults = hasDragDropPatch ? getActivityDragDropDefaults(activity) : null;

    const nextObjects = objects.map(item => {
      if (!selectedIds.has(item.id)) return item;
      const nextItem = { ...item, ...patch };
      if (stylePatch) {
        nextItem.style = item.type === "draggable" || item.type === "dropzone"
          ? upgradeDragDropStyle(item.type, { ...(item.style || {}), ...stylePatch })
          : { ...(item.style || {}), ...stylePatch };
      }
      if (nextDragDropDefaults && (item.type === "draggable" || item.type === "dropzone")) {
        const baseDefaults = nextDragDropDefaults[item.type];
        nextDragDropDefaults[item.type] = {
          width: Object.prototype.hasOwnProperty.call(patch, "width") ? nextItem.width : baseDefaults.width,
          height: Object.prototype.hasOwnProperty.call(patch, "height") ? nextItem.height : baseDefaults.height,
          style: stylePatch ? { ...nextItem.style } : baseDefaults.style,
        };
      }
      return nextItem;
    });

    onUpdate({
      ...activity,
      objects: nextObjects,
      ...(nextDragDropDefaults ? { dragDropDefaults: nextDragDropDefaults } : {}),
    });
  };

  const s10 = { fontSize: 9, fontWeight: 800, color: "#334155", marginBottom: 6, letterSpacing: 0.4, textTransform: "uppercase" };
  const card = { background: "linear-gradient(180deg,#ffffff,#f8fbff)", border: "1px solid rgba(203,213,225,.95)", borderRadius: 14, padding: 9, marginBottom: 9, boxShadow: "0 10px 22px rgba(15,23,42,.05)" };
  const monoCard = { background: "#ffffff", border: "1px solid #111111", borderRadius: 0, padding: 9, marginBottom: 8, boxShadow: "none" };
  const triggerSourceOptions = [{ value: "Secili Nesne", label: "Tiklanan / secili nesne" }, { value: "__activity__", label: "Sahne / yukleme" }, ...objects.map(obj => ({ value: obj.id, label: `${obj.label || obj.type} (${obj.type})` }))];
  const triggerTargetOptions = objects.map(obj => ({ value: obj.id, label: `${obj.label || obj.type} (${obj.type})` }));
  const triggerLayerOptions = layers.map(layer => ({ value: layer.id, label: layer.name }));
  const triggerActivityOptions = [{ value: "__next__", label: "Sonraki sahne" }, ...activities.filter(item => item.id !== activity.id).map(item => ({ value: item.id, label: item.name }))];
  const triggerSlideOptions = [
    { value: "__next__", label: "Sonraki slider" },
    { value: "__prev__", label: "Onceki slider" },
    ...getActivitySlides(activity).map((slide, index) => ({ value: slide.id, label: `${index + 1}. ${slide.name || `Slider ${index + 1}`}` })),
  ];
  const variableOptions = variables.map(variable => ({ value: variable.id, label: `${variable.name} (${variable.type})` }));
  const objectStateOptions = objects.map(obj => ({ value: obj.id, label: `${obj.label || obj.type} (${obj.type})` }));
  const triggerModeOptions = [{ value: "all", label: "Tumu" }, { value: "any", label: "Biri" }];
  const boolOptions = [{ value: "true", label: "True" }, { value: "false", label: "False" }];
  const getOptionLabel = (options = [], value = "", fallback = "") => options.find(option => option.value === value)?.label || fallback || value || "-";
  const getTriggerValueLabel = (item = {}) => {
    if (item.action === "KatmanaGec") return getOptionLabel(triggerLayerOptions, item.value, "Katman sec");
    if (item.action === "SliderGec") return getOptionLabel(triggerSlideOptions, item.value, "Slider sec");
    if (item.action === "SayfaGec") return getOptionLabel(triggerActivityOptions, item.value, "Sahne sec");
    if (item.action === "Goster" || item.action === "Gizle") return getOptionLabel(triggerTargetOptions, item.value, "Nesne sec");
    if (item.action === "DegiskenAta" || item.action === "DegiskenArttir" || item.action === "DegiskenAzalt") return getOptionLabel(variableOptions, item.value, "Degisken sec");
    if (item.action === "NesneDurumuAyarla") return getOptionLabel(objectStateOptions, item.value, "Nesne sec");
    return item.value || "";
  };
  const describeTrigger = (item = {}) => {
    const whenLabel = getOptionLabel(TRIGGER_WHEN_OPTIONS, item.when || "onClick", "Tiklandiginda");
    const sourceLabel = item.when === "onLoad"
      ? "Sahne"
      : getOptionLabel(triggerSourceOptions, item.target || "Secili Nesne", "Secili nesne");
    const actionLabel = getOptionLabel(TRIGGER_ACTION_OPTIONS, item.action || "SayfaGec", "Sayfaya Gec");
    const valueLabel = getTriggerValueLabel(item);
    const extraLabel = item.action === "DegiskenAta"
      ? (item.extra ? ` = ${item.extra}` : "")
      : item.action === "DegiskenArttir" || item.action === "DegiskenAzalt"
        ? ` (${item.extra || "1"})`
        : item.action === "NesneDurumuAyarla"
          ? ` / ${getOptionLabel(OBJECT_STATE_OPTIONS, item.stateKey || "visited", "Visited")}=${String(item.stateValue ?? "true")}`
          : "";
    const conditionCount = Array.isArray(item.conditions) ? item.conditions.length : 0;
    return `${whenLabel} • ${sourceLabel} → ${actionLabel}${valueLabel ? ` (${valueLabel}${extraLabel})` : extraLabel}${conditionCount ? ` • ${conditionCount} kosul` : ""}`;
  };
  const isAdvancedMode = uiMode === "advanced";
  const hasAnswerPanel = ["selection", "drag-drop", "mixed"].includes(activity?.type);
  const selectionActionBtn = {
    minHeight: 29,
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#334155",
    fontSize: 9,
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 4px 10px rgba(15,23,42,.04)",
  };
  const bulkInputStyle = {
    width: "100%",
    padding: "5px 8px",
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 11,
    boxSizing: "border-box",
    outline: "none",
  };
  const commitBulkNumberInput = (event, apply) => {
    const raw = String(event.target.value || "").trim();
    if (!raw) return;
    const value = Number(raw);
    if (!Number.isFinite(value)) return;
    apply(value);
  };
  const runSelectionAction = (kind, value) => {
    if (kind === "align") onUpdate(alignActivitySelection(activity, selectedIds, value));
    if (kind === "distribute") onUpdate(distributeActivitySelection(activity, selectedIds, value));
  };
  const inspectorTabs = [
    { id: "scene", label: "Sahne" },
    { id: "object", label: sel || multiSel ? "Nesne" : "Öğeler" },
    ...(hasAnswerPanel ? [{ id: "answer", label: "Cevap" }] : []),
    ...(!hideTimeline ? [{ id: "timeline", label: "Zaman" }] : []),
    { id: "interaction", label: "Etkilesim" },
  ];
  const [inspectorTab, setInspectorTab] = useState(() => (sel || multiSel ? "object" : "scene"));

  useEffect(() => {
    if (sel || multiSel) {
      setInspectorTab(current => (current === "scene" ? "object" : current));
      return;
    }
    setInspectorTab(current => (current === "object" ? "scene" : current));
  }, [multiSel, sel]);

  useEffect(() => {
    if (hideTimeline) {
      setInspectorTab(current => (current === "timeline" ? "scene" : current));
    }
  }, [hideTimeline]);

  const showScenePanel = inspectorTab === "scene";
  const showObjectPanel = inspectorTab === "object";
  const showAnswerPanel = inspectorTab === "answer";
  const showTimelinePanel = inspectorTab === "timeline";
  const showInteractionPanel = inspectorTab === "interaction";

  return (
    <div style={{ width: "100%", height: "100%", minHeight: 0, flexShrink: 0, borderLeft: mobile ? "none" : "1px solid rgba(148,163,184,.18)", background: "linear-gradient(180deg,#fbfdff,#f3f8ff)", overflowY: "auto", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain", touchAction: "pan-y", padding: 8, paddingBottom: mobile ? 18 : 8 }}>
      <div style={{ ...card, padding: 6, marginBottom: 9 }}>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${inspectorTabs.length}, minmax(0,1fr))`, gap: 4 }}>
          {inspectorTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setInspectorTab(tab.id)}
              style={{
                minHeight: 30,
                borderRadius: 10,
                border: `1px solid ${inspectorTab === tab.id ? "#bfdbfe" : "#dbe7f5"}`,
                background: inspectorTab === tab.id ? "linear-gradient(180deg,#eff6ff,#ffffff)" : "#ffffff",
                color: inspectorTab === tab.id ? "#1d4ed8" : "#475569",
                fontSize: 10,
                fontWeight: 800,
                cursor: "pointer",
                boxShadow: inspectorTab === tab.id ? "0 8px 14px rgba(59,130,246,.1)" : "none",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {showObjectPanel && multiSel ? (
        <>
          <div style={card}>
            <div style={s10}>SECIM</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#0f172a" }}>{selectedIds.size} nesne secildi</div>
            <div style={{ fontSize: 10, color: "#64748b", marginTop: 4 }}>
              Alan: {Math.round(selectionBounds?.width || 0)} x {Math.round(selectionBounds?.height || 0)}
            </div>
            <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>Ok tuslari ile tasiyin, Delete ile silin.</div>
          </div>

          <div style={card}>
            <div style={s10}>TOPLU DUZENLEME</div>
            <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 10, color: "#78909C", display: "block", marginBottom: 2 }}>Genislik</label>
                <input
                  type="number"
                  placeholder="Ayni yap"
                  style={bulkInputStyle}
                  onBlur={e => commitBulkNumberInput(e, value => patchSelectedObjects({ width: Math.max(20, value) }))}
                  onKeyDown={e => { if (e.key === "Enter") commitBulkNumberInput(e, value => patchSelectedObjects({ width: Math.max(20, value) })); }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 10, color: "#78909C", display: "block", marginBottom: 2 }}>Yukseklik</label>
                <input
                  type="number"
                  placeholder="Ayni yap"
                  style={bulkInputStyle}
                  onBlur={e => commitBulkNumberInput(e, value => patchSelectedObjects({ height: Math.max(20, value) }))}
                  onKeyDown={e => { if (e.key === "Enter") commitBulkNumberInput(e, value => patchSelectedObjects({ height: Math.max(20, value) })); }}
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 10, color: "#78909C", display: "block", marginBottom: 2 }}>Font Boyutu</label>
                <input
                  type="number"
                  placeholder="Yazı boyutu"
                  style={bulkInputStyle}
                  onBlur={e => commitBulkNumberInput(e, value => patchSelectedObjects({}, { fontSize: Math.max(1, value) }))}
                  onKeyDown={e => { if (e.key === "Enter") commitBulkNumberInput(e, value => patchSelectedObjects({}, { fontSize: Math.max(1, value) })); }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 10, color: "#78909C", display: "block", marginBottom: 2 }}>Radius</label>
                <input
                  type="number"
                  placeholder="Kose"
                  style={bulkInputStyle}
                  onBlur={e => commitBulkNumberInput(e, value => patchSelectedObjects({}, { borderRadius: Math.max(0, value) }))}
                  onKeyDown={e => { if (e.key === "Enter") commitBulkNumberInput(e, value => patchSelectedObjects({}, { borderRadius: Math.max(0, value) })); }}
                />
              </div>
            </div>
            <div style={{ fontSize: 10, color: "#64748b", marginBottom: 6 }}>Renkler</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "#475569" }}>
                <input
                  type="color"
                  value={resolvePickerColor(selectedObjects[0]?.style?.color, "#111111")}
                  onChange={e => patchSelectedObjects({}, { color: e.target.value })}
                  style={{ width: 28, height: 24, border: "none", background: "none", cursor: "pointer" }}
                />
                Yazı
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "#475569" }}>
                <input
                  type="color"
                  value={resolvePickerColor(selectedObjects[0]?.style?.background, "#2563eb")}
                  onChange={e => patchSelectedObjects({}, { background: e.target.value })}
                  style={{ width: 28, height: 24, border: "none", background: "none", cursor: "pointer" }}
                />
                Zemin
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "#475569" }}>
                <input
                  type="color"
                  value={resolvePickerColor(selectedObjects[0]?.style?.borderColor, "#111111")}
                  onChange={e => patchSelectedObjects({}, { borderColor: e.target.value })}
                  style={{ width: 28, height: 24, border: "none", background: "none", cursor: "pointer" }}
                />
                Kenar
              </label>
            </div>
            <div style={{ fontSize: 10, color: "#64748b", marginTop: 8 }}>
              Secili nesnelerin boyutu, fontu ve renkleri tek seferde uygulanir.
            </div>
          </div>

          <div style={card}>
            <div style={s10}>HIZALAMA</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 6 }}>
              {[
                { label: "Sol", kind: "align", value: "left" },
                { label: "Orta X", kind: "align", value: "center" },
                { label: "Sag", kind: "align", value: "right" },
                { label: "Ust", kind: "align", value: "top" },
                { label: "Orta Y", kind: "align", value: "middle" },
                { label: "Alt", kind: "align", value: "bottom" },
              ].map(action => (
                <button
                  key={`${action.kind}-${action.value}`}
                  onClick={() => runSelectionAction(action.kind, action.value)}
                  style={selectionActionBtn}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>

          <div style={card}>
            <div style={s10}>OTOMATIK BOSLUK</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              <button
                onClick={() => runSelectionAction("distribute", "horizontal")}
                disabled={selectedObjects.length < 3}
                style={{ ...selectionActionBtn, opacity: selectedObjects.length < 3 ? 0.45 : 1, cursor: selectedObjects.length < 3 ? "default" : "pointer" }}
              >
                Yatay Dagit
              </button>
              <button
                onClick={() => runSelectionAction("distribute", "vertical")}
                disabled={selectedObjects.length < 3}
                style={{ ...selectionActionBtn, opacity: selectedObjects.length < 3 ? 0.45 : 1, cursor: selectedObjects.length < 3 ? "default" : "pointer" }}
              >
                Dikey Dagit
              </button>
            </div>
            <div style={{ fontSize: 10, color: "#64748b", marginTop: 8 }}>
              Esit aralik dagitma icin en az 3 nesne secili olmali.
            </div>
          </div>
        </>
      ) : showObjectPanel && sel ? (
        <div style={card}>
          <div style={{ ...s10, color: "#2563eb" }}>{sel.type.toUpperCase()}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <Inp label="Etiket" value={sel.label || ""} onChange={e => patchObj(sel.id, { label: e.target.value })} />
            <div style={{ display: "flex", gap: 5 }}>
              <Inp label="X" type="number" value={Math.round(sel.x)} onChange={e => patchObj(sel.id, { x: +e.target.value })} />
              <Inp label="Y" type="number" value={Math.round(sel.y)} onChange={e => patchObj(sel.id, { y: +e.target.value })} />
            </div>
            <div style={{ display: "flex", gap: 5 }}>
              <Inp label="G" type="number" value={Math.round(sel.width)} onChange={e => patchObj(sel.id, { width: Math.max(20, +e.target.value) })} />
              <Inp label="Y" type="number" value={Math.round(sel.height)} onChange={e => patchObj(sel.id, { height: Math.max(20, +e.target.value) })} />
            </div>
            <Inp label="Dondur °" type="number" value={sel.rotation || 0} onChange={e => patchObj(sel.id, { rotation: +e.target.value })} />
            <SelectInp label="Layer" value={sel.layerId || "base"} onChange={e => patchObj(sel.id, { layerId: e.target.value })} options={layers.map(layer => ({ value: layer.id, label: layer.name }))} />
            {(sel.type === "draggable" || sel.type === "dropzone") && <Inp label="Grup" value={sel.group || ""} onChange={e => patchObj(sel.id, { group: e.target.value })} placeholder="A, B, ..." />}
            {sel.type === "audio" && (
              <>
                <Inp label="Ses URL" value={sel.mediaUrl || ""} onChange={e => patchObj(sel.id, { mediaUrl: e.target.value })} placeholder="/static/uploads/ses.mp3" />
                <label style={{ display: "block", padding: "6px 8px", borderRadius: 0, border: "1px solid #111111", background: "#ffffff", color: "#111111", fontSize: 10, fontWeight: 700, cursor: "pointer", textAlign: "center" }}>
                  Ses Yükle / Değiştir
                  <input
                    type="file"
                    accept="audio/*"
                    style={{ display: "none" }}
                    onChange={async ev => {
                      const file = ev.target.files?.[0];
                      if (!file) return;
                      const mediaUrl = await uploadMediaFile(file);
                      patchObj(sel.id, { mediaUrl, mediaName: file.name, label: sel.label || file.name.replace(/\.[^.]+$/, "") || "Ses" });
                      ev.target.value = "";
                    }}
                  />
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "#78909C", cursor: "pointer" }}><input type="checkbox" checked={sel.showPlayerControls !== false} onChange={e => patchObj(sel.id, { showPlayerControls: e.target.checked })} style={{ accentColor: "#38bdf8" }} />Kontroller</label>
                  <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "#78909C", cursor: "pointer" }}><input type="checkbox" checked={!!sel.autoPlay} onChange={e => patchObj(sel.id, { autoPlay: e.target.checked })} style={{ accentColor: "#38bdf8" }} />Oto Oynat</label>
                  <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "#78909C", cursor: "pointer" }}><input type="checkbox" checked={sel.muted !== false} onChange={e => patchObj(sel.id, { muted: e.target.checked })} style={{ accentColor: "#38bdf8" }} />Sessiz</label>
                  <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "#78909C", cursor: "pointer" }}><input type="checkbox" checked={!!sel.loop} onChange={e => patchObj(sel.id, { loop: e.target.checked })} style={{ accentColor: "#38bdf8" }} />Dongu</label>
                </div>
              </>
            )}
            {sel.type === "video" && (
              <>
                <Inp label="Video URL" value={sel.mediaUrl || ""} onChange={e => patchObj(sel.id, { mediaUrl: e.target.value })} placeholder="/static/uploads/video.mp4" />
                <label style={{ display: "block", padding: "6px 8px", borderRadius: 0, border: "1px solid #111111", background: "#ffffff", color: "#111111", fontSize: 10, fontWeight: 700, cursor: "pointer", textAlign: "center" }}>
                  Video Yükle / Değiştir
                  <input
                    type="file"
                    accept="video/mp4,video/webm,video/ogg"
                    style={{ display: "none" }}
                    onChange={async ev => {
                      const file = ev.target.files?.[0];
                      if (!file) return;
                      const mediaUrl = await uploadMediaFile(file);
                      patchObj(sel.id, { mediaUrl, mediaName: file.name, label: sel.label || file.name.replace(/\.[^.]+$/, "") || "Video" });
                      ev.target.value = "";
                    }}
                  />
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "#78909C", cursor: "pointer" }}><input type="checkbox" checked={sel.showPlayerControls !== false} onChange={e => patchObj(sel.id, { showPlayerControls: e.target.checked })} style={{ accentColor: "#38bdf8" }} />Kontroller</label>
                  <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "#78909C", cursor: "pointer" }}><input type="checkbox" checked={!!sel.autoPlay} onChange={e => patchObj(sel.id, { autoPlay: e.target.checked })} style={{ accentColor: "#38bdf8" }} />Oto Oynat</label>
                  <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "#78909C", cursor: "pointer" }}><input type="checkbox" checked={sel.muted !== false} onChange={e => patchObj(sel.id, { muted: e.target.checked })} style={{ accentColor: "#38bdf8" }} />Sessiz</label>
                  <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "#78909C", cursor: "pointer" }}><input type="checkbox" checked={!!sel.loop} onChange={e => patchObj(sel.id, { loop: e.target.checked })} style={{ accentColor: "#38bdf8" }} />Dongu</label>
                </div>
              </>
            )}
            <div style={{ display: "flex", gap: 5 }}>
              <Inp label="Font" type="number" value={sel.style?.fontSize || 14} onChange={e => patchObj(sel.id, { style: { ...sel.style, fontSize: +e.target.value } })} />
              <Inp label="Radius" type="number" value={sel.style?.borderRadius || 0} onChange={e => patchObj(sel.id, { style: { ...sel.style, borderRadius: +e.target.value } })} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "#78909C", cursor: "pointer" }}><input type="checkbox" checked={sel.visible !== false} onChange={e => patchObj(sel.id, { visible: e.target.checked })} style={{ accentColor: "#4CAF50" }} />Gorunur</label>
              <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "#78909C", cursor: "pointer" }}><input type="checkbox" checked={!!sel.locked} onChange={e => patchObj(sel.id, { locked: e.target.checked })} style={{ accentColor: "#FF9800" }} />Kilitli</label>
            </div>
          </div>
        </div>
      ) : showAnswerPanel ? (
        <AnswerFormPanel activity={activity} onUpdate={onUpdate} onPreviewChange={onAnswerPreviewChange} />
      ) : showScenePanel ? (
        <div style={{ ...card, textAlign: "left", color: "#475569", fontSize: 11, padding: 16, lineHeight: 1.75 }}>
          <div style={{ fontWeight: 800, color: "#0f172a", marginBottom: 8, fontSize: 16 }}>Hizli Baslangic</div>
          {!activity.svgMarkup && (
            <div style={{ marginBottom: 12, padding: 12, borderRadius: 16, border: "1px solid #d8b4fe", background: "linear-gradient(180deg,#faf5ff,#f5f3ff)", color: "#6d28d9", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9)" }}>
              Once <strong>SVG zemin</strong> yuklemen onerilir. Zemin geldikten sonra yerlestirme ve hizalama cok daha kolay olur.
            </div>
          )}
          <div>1. Soldaki zemin veya nesne aracini sec.</div>
          <div>2. Sahne ustunde nesneyi tiklayip konumunu belirle.</div>
          <div>3. Bu panelden boyut, gorunum ve davranisini ayarla.</div>
          <div>4. Alttaki timeline'dan animasyon, keyframe ve sure ver.</div>
        </div>
      ) : (
        <div style={{ ...card, textAlign: "left", color: "#475569", fontSize: 11, padding: 16, lineHeight: 1.75 }}>
          <div style={{ fontWeight: 800, color: "#0f172a", marginBottom: 8, fontSize: 16 }}>Bu bolum bos</div>
          <div>{showInteractionPanel ? "Tetikleyici ve degiskenleri bu sekmede yonetebilirsin." : "Düzenlemek istedigin bolumu yukaridan sec."}</div>
        </div>
      )}

      {showScenePanel && (
        <div style={{ background: "linear-gradient(180deg,#ffffff,#f7f9fc)", border: "1px solid #c7d0db", borderRadius: 12, marginBottom: 8, overflow: "hidden", boxShadow: "0 10px 22px rgba(15,23,42,.05)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 10px", borderBottom: "1px solid #c7d0db", background: "linear-gradient(180deg,#edf1f5,#dde4ec)" }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 900, color: "#334155", letterSpacing: 0.5 }}>SLIDE LAYERS</div>
              <div style={{ fontSize: 9, color: "#64748b", marginTop: 2 }}>Base layer ve ek katman akisi</div>
            </div>
            <button onClick={() => { const newLayer = createLayer("Katman", layers.length); patchAct({ layers: [...layers, newLayer], activeLayerId: newLayer.id }); }} style={{ minHeight: 28, padding: "0 10px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#ffffff", color: "#1d4ed8", fontSize: 10, fontWeight: 800, cursor: "pointer" }}>+ Layer</button>
          </div>
          <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 6 }}>
            {layers.map((layer, index) => {
              const isActiveLayer = activity.activeLayerId === layer.id;
              const visibleCount = getCanvasObjects({ ...activity, activeLayerId: layer.id }, layer.id).filter(obj => obj.visible !== false).length;
              const layerLabel = layer.kind === "base" ? "Base Layer" : (layer.name || `Layer ${index}`);
              return (
                <div
                  key={layer.id}
                  onClick={() => patchAct({ activeLayerId: layer.id, selectedObjectId: null })}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "88px 1fr auto",
                    gap: 8,
                    alignItems: "center",
                    padding: 8,
                    borderRadius: 10,
                    cursor: "pointer",
                    border: `1px solid ${isActiveLayer ? "#93c5fd" : "#d8e0ea"}`,
                    background: isActiveLayer ? "linear-gradient(180deg,#eaf4ff,#ffffff)" : "linear-gradient(180deg,#ffffff,#f8fafc)",
                    boxShadow: isActiveLayer ? "0 8px 16px rgba(37,99,235,.08)" : "inset 0 1px 0 rgba(255,255,255,.85)",
                  }}
                >
                  <LayerThumbnail activity={activity} layer={layer} isActive={isActiveLayer} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ padding: "2px 6px", borderRadius: 999, background: layer.kind === "base" ? "#e2e8f0" : "#dbeafe", color: layer.kind === "base" ? "#475569" : "#1d4ed8", fontSize: 9, fontWeight: 800 }}>
                        {layer.kind === "base" ? "Base" : `Layer ${index}`}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 800, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{layerLabel}</span>
                    </div>
                    <div style={{ fontSize: 9, color: "#64748b", marginTop: 4 }}>
                      {visibleCount} obje görünür · {isActiveLayer ? "Şu an düzenleniyor" : "Geçiş için tıkla"}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span title="Katman durumu" style={{ width: 18, height: 18, borderRadius: 999, border: "1px solid #d1d5db", background: "#ffffff", color: visibleCount > 0 ? "#2563eb" : "#94a3b8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>◐</span>
                    <span title={isActiveLayer ? "Aktif katman" : "Pasif katman"} style={{ width: 18, height: 18, borderRadius: 999, border: `1px solid ${isActiveLayer ? "#93c5fd" : "#d1d5db"}`, background: isActiveLayer ? "#dbeafe" : "#ffffff", color: isActiveLayer ? "#1d4ed8" : "#94a3b8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>{isActiveLayer ? "●" : "○"}</span>
                    {layer.kind !== "base" && <button onClick={e => { e.stopPropagation(); patchAct({ layers: layers.filter(item => item.id !== layer.id), activeLayerId: activity.activeLayerId === layer.id ? "base" : activity.activeLayerId, objects: objects.map(obj => obj.layerId === layer.id ? { ...obj, layerId: "base" } : obj) }); }} style={{ border: "none", background: "transparent", color: "#ef4444", cursor: "pointer", fontSize: 13, lineHeight: 1 }}>×</button>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showObjectPanel && (
        <div style={{ background: "linear-gradient(180deg,#ffffff,#f7f9fc)", border: "1px solid #c7d0db", borderRadius: 12, marginBottom: 8, overflow: "hidden", boxShadow: "0 10px 22px rgba(15,23,42,.05)" }}>
          <div style={{ padding: "8px 10px", borderBottom: "1px solid #c7d0db", background: "linear-gradient(180deg,#edf1f5,#dde4ec)" }}>
            <div style={{ fontSize: 10, fontWeight: 900, color: "#334155", letterSpacing: 0.5 }}>OBJECTS ON LAYER</div>
            <div style={{ fontSize: 9, color: "#64748b", marginTop: 2 }}>Aktif katmandaki sahne öğeleri</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 220, overflowY: "auto", padding: 8 }}>
            {[...objects].sort((a, b) => b.zIndex - a.zIndex).map(o => {
              const isSelectedObject = selectedIds.has(o.id) || activity.selectedObjectId === o.id;
              const glyph = ({ text: "T", button: "B", shape: "■", image: "I", video: "V", audio: "♪", hotspot: "◎", draggable: "↕", dropzone: "▭" }[o.type] || "•");
              return (
                <div key={o.id} onClick={() => { onUpdate({ ...activity, selectedObjectId: o.id }); }} style={{ padding: "6px 8px", borderRadius: 10, cursor: "pointer", background: isSelectedObject ? "linear-gradient(180deg,#eaf4ff,#ffffff)" : "#ffffff", fontSize: 10, color: "#111111", display: "flex", gap: 7, alignItems: "center", border: `1px solid ${isSelectedObject ? "#93c5fd" : "#d8e0ea"}` }}>
                  <span style={{ width: 20, height: 20, borderRadius: 6, border: `1px solid ${isSelectedObject ? "#93c5fd" : "#dbe7f5"}`, background: isSelectedObject ? "#eff6ff" : "#f8fafc", color: isSelectedObject ? "#1d4ed8" : "#475569", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, flexShrink: 0 }}>{glyph}</span>
                  <span style={{ fontSize: 9, color: "#64748b", width: 14, flexShrink: 0 }}>{o.zIndex}</span>
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", opacity: o.visible === false ? 0.45 : 1 }}>{o.label || o.type}</span>
                  <span style={{ fontSize: 9, color: o.visible === false ? "#94a3b8" : "#2563eb", fontWeight: 800 }}>{o.visible === false ? "H" : "G"}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!hideTimeline && showTimelinePanel && (
        <div style={monoCard}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <div style={s10}>ZAMANCIZELGESI</div>
            <button onClick={() => patchAct({ timeline: [...timeline, createTimelineItem(timeline.length)] })} style={{ background: "#4CAF5022", border: "1px solid #4CAF50", color: "#4CAF50", borderRadius: 4, cursor: "pointer", fontSize: 9, padding: "2px 6px" }}>+</button>
          </div>
          {timeline.map(item => (
            <div key={item.id} style={{ background: "#0d0d1a", border: "1px solid #252540", borderRadius: 6, padding: 7, marginBottom: 5 }}>
              <div style={{ display: "flex", gap: 5, alignItems: "center", marginBottom: 5 }}>
                <Inp value={item.name} onChange={e => patchTimeline(item.id, { name: e.target.value })} placeholder="Animasyon adi" />
                <button onClick={() => patchAct({ timeline: timeline.filter(x => x.id !== item.id) })} style={{ border: "none", background: "transparent", color: "#f44336", cursor: "pointer", fontSize: 12 }}>×</button>
              </div>
              <div style={{ display: "flex", gap: 5 }}>
                <Inp label="Bas" type="number" value={item.start} onChange={e => patchTimeline(item.id, { start: +e.target.value || 0 })} />
                <Inp label="Sure" type="number" value={item.duration} onChange={e => patchTimeline(item.id, { duration: +e.target.value || 0 })} />
              </div>
            </div>
          ))}
          {timeline.length === 0 && <div style={{ fontSize: 10, color: "#333", textAlign: "center" }}>Animasyon yok</div>}
        </div>
      )}

      {showInteractionPanel && !isAdvancedMode && (
        <div style={card}>
          <div style={{ fontWeight: 800, color: "#0f172a", marginBottom: 8, fontSize: 16 }}>Gelismis araclar kapali</div>
          <div style={{ fontSize: 11, color: "#475569", lineHeight: 1.7 }}>
            Degiskenler ve tetikleyiciler burada gorunur. Ust bardan <strong>Gelismis Mod</strong> acinca bu alan detaylanir.
          </div>
        </div>
      )}

      {showInteractionPanel && isAdvancedMode && <div style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <div style={s10}>DEGISKENLER</div>
          <button onClick={() => patchVariables(prev => [...prev, createVariableItem(prev.length)])} style={{ background: "#ffffff", border: "1px solid #111111", color: "#111111", borderRadius: 0, cursor: "pointer", fontSize: 9, padding: "2px 6px" }}>+</button>
        </div>
        {variables.map((variable, index) => (
          <div key={variable.id} style={{ background: "#ffffff", border: "1px solid #111111", borderRadius: 0, padding: 7, marginBottom: 6 }}>
            <div style={{ display: "flex", gap: 5, alignItems: "center", marginBottom: 6 }}>
              <Inp value={variable.name || ""} onChange={e => patchVariables(prev => prev.map(item => item.id === variable.id ? { ...item, name: e.target.value } : item))} placeholder={`Degisken ${index + 1}`} />
              <button onClick={() => patchVariables(prev => prev.filter(item => item.id !== variable.id))} style={{ border: "none", background: "transparent", color: "#f44336", cursor: "pointer", fontSize: 12 }}>×</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <SelectInp label="Tip" value={variable.type || "number"} onChange={e => patchVariables(prev => prev.map(item => item.id === variable.id ? { ...item, type: e.target.value, value: castVariableValue(e.target.value, item.value ?? getDefaultVariableValue(e.target.value)) } : item))} options={VARIABLE_TYPES} />
              {variable.type === "boolean" ? (
                <SelectInp label="Ilk Deger" value={String(!!variable.value)} onChange={e => patchVariables(prev => prev.map(item => item.id === variable.id ? { ...item, value: e.target.value === "true" } : item))} options={boolOptions} />
              ) : (
                <Inp label="Ilk Deger" type={variable.type === "number" ? "number" : "text"} value={variable.value ?? ""} onChange={e => patchVariables(prev => prev.map(item => item.id === variable.id ? { ...item, value: castVariableValue(variable.type, e.target.value) } : item))} />
              )}
            </div>
          </div>
        ))}
        {variables.length === 0 && <div style={{ fontSize: 10, color: "#333", textAlign: "center" }}>Global degisken yok</div>}
      </div>}

      {isAdvancedMode && <div style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <div style={s10}>TETIKLEYICILER</div>
          <button onClick={() => patchAct({ triggers: [...triggers, createTriggerItem(triggers.length)] })} style={{ background: "#ffffff", border: "1px solid #111111", color: "#111111", borderRadius: 0, cursor: "pointer", fontSize: 9, padding: "2px 6px" }}>+</button>
        </div>
        {triggers.map((item, index) => {
          const conditionCount = Array.isArray(item.conditions) ? item.conditions.length : 0;
          const accent = item.when === "onLoad" ? "#8b5cf6" : item.when === "onHover" ? "#f59e0b" : item.when === "onDrop" ? "#10b981" : "#2563eb";
          return (
            <div key={item.id} style={{ background: "linear-gradient(180deg,#ffffff,#f8fbff)", border: `1px solid ${isAdvancedMode ? "#dbe7f5" : "#111111"}`, borderRadius: 12, padding: 8, marginBottom: 8, boxShadow: "0 8px 18px rgba(15,23,42,.05)" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ padding: "3px 7px", borderRadius: 999, background: `${accent}18`, color: accent, border: `1px solid ${accent}44`, fontSize: 9, fontWeight: 800 }}>
                      Trigger {index + 1}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: "#0f172a" }}>{describeTrigger(item)}</span>
                  </div>
                  <div style={{ fontSize: 9, color: "#64748b", marginTop: 4 }}>
                    {item.name || "Kosullu aksiyon satiri"}
                  </div>
                </div>
                <button onClick={() => patchAct({ triggers: triggers.filter(x => x.id !== item.id) })} style={{ border: "none", background: "transparent", color: "#ef4444", cursor: "pointer", fontSize: 14, lineHeight: 1 }}>×</button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "62px 1fr 42px 1fr 42px 1fr", gap: 6, alignItems: "end" }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: "#64748b", paddingBottom: 6 }}>When</div>
                <SelectInp value={item.when || "onClick"} onChange={e => patchTrigger(item.id, { when: e.target.value, target: e.target.value === "onLoad" ? "__activity__" : (item.target || "Secili Nesne") })} options={TRIGGER_WHEN_OPTIONS} />
                <div style={{ fontSize: 9, fontWeight: 800, color: "#64748b", paddingBottom: 6 }}>On</div>
                <SelectInp value={item.target || "Secili Nesne"} onChange={e => patchTrigger(item.id, { target: e.target.value })} options={item.when === "onLoad" ? [{ value: "__activity__", label: "Sahne / yukleme" }] : triggerSourceOptions} />
                <div style={{ fontSize: 9, fontWeight: 800, color: "#64748b", paddingBottom: 6 }}>Do</div>
                <SelectInp value={item.action || "SayfaGec"} onChange={e => patchTrigger(item.id, {
                  action: e.target.value,
                  value: e.target.value === "KatmanaGec" ? (layers[0]?.id || "base")
                    : e.target.value === "SliderGec" ? "__next__"
                    : e.target.value === "SayfaGec" ? "__next__"
                    : e.target.value === "Goster" || e.target.value === "Gizle" || e.target.value === "NesneDurumuAyarla" ? (objects[0]?.id || "")
                    : e.target.value === "DegiskenAta" || e.target.value === "DegiskenArttir" || e.target.value === "DegiskenAzalt" ? (variables[0]?.id || "")
                    : item.value || "",
                  extra: e.target.value === "DegiskenArttir" || e.target.value === "DegiskenAzalt" ? "1" : (item.extra || ""),
                  stateKey: e.target.value === "NesneDurumuAyarla" ? "visited" : (item.stateKey || "visited"),
                  stateValue: e.target.value === "NesneDurumuAyarla" ? "true" : (item.stateValue || "true"),
                })} options={TRIGGER_ACTION_OPTIONS} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 6, marginTop: 8 }}>
                <Inp label="Ad" value={item.name || ""} onChange={e => patchTrigger(item.id, { name: e.target.value })} placeholder="Kosullu gecis" />
                {item.action === "KatmanaGec" ? (
                  <SelectInp label="Hedef Katman" value={item.value || (layers[0]?.id || "base")} onChange={e => patchTrigger(item.id, { value: e.target.value })} options={triggerLayerOptions} />
                ) : item.action === "SliderGec" ? (
                  <SelectInp label="Hedef Slider" value={item.value || "__next__"} onChange={e => patchTrigger(item.id, { value: e.target.value })} options={triggerSlideOptions} />
                ) : item.action === "SayfaGec" ? (
                  <SelectInp label="Hedef Sahne" value={item.value || "__next__"} onChange={e => patchTrigger(item.id, { value: e.target.value })} options={triggerActivityOptions.length ? triggerActivityOptions : [{ value: "__next__", label: "Sonraki sahne" }]} />
                ) : item.action === "Goster" || item.action === "Gizle" ? (
                  <SelectInp label="Etkilenecek Nesne" value={item.value || ""} onChange={e => patchTrigger(item.id, { value: e.target.value })} options={triggerTargetOptions.length ? triggerTargetOptions : [{ value: "", label: "Nesne yok" }]} />
                ) : item.action === "DegiskenAta" ? (
                  <>
                    <SelectInp label="Degisken" value={item.value || ""} onChange={e => patchTrigger(item.id, { value: e.target.value })} options={variableOptions.length ? variableOptions : [{ value: "", label: "Degisken yok" }]} />
                    <Inp label="Yeni Deger" value={item.extra || ""} onChange={e => patchTrigger(item.id, { extra: e.target.value })} />
                  </>
                ) : item.action === "DegiskenArttir" || item.action === "DegiskenAzalt" ? (
                  <>
                    <SelectInp label="Degisken" value={item.value || ""} onChange={e => patchTrigger(item.id, { value: e.target.value })} options={variableOptions.length ? variableOptions : [{ value: "", label: "Degisken yok" }]} />
                    <Inp label="Miktar" type="number" value={item.extra || "1"} onChange={e => patchTrigger(item.id, { extra: e.target.value })} />
                  </>
                ) : item.action === "NesneDurumuAyarla" ? (
                  <>
                    <SelectInp label="Nesne" value={item.value || ""} onChange={e => patchTrigger(item.id, { value: e.target.value })} options={objectStateOptions.length ? objectStateOptions : [{ value: "", label: "Nesne yok" }]} />
                    <SelectInp label="Durum" value={item.stateKey || "visited"} onChange={e => patchTrigger(item.id, { stateKey: e.target.value })} options={OBJECT_STATE_OPTIONS} />
                    <SelectInp label="Deger" value={String(item.stateValue ?? "true")} onChange={e => patchTrigger(item.id, { stateValue: e.target.value })} options={boolOptions} />
                  </>
                ) : (
                  <Inp label="Deger" value={item.value || ""} onChange={e => patchTrigger(item.id, { value: e.target.value })} />
                )}
              </div>

              <details open={conditionCount > 0} style={{ marginTop: 8 }}>
                <summary style={{ cursor: "pointer", listStyle: "none", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 10, fontWeight: 800, color: "#334155" }}>
                  <span>Kosullar {conditionCount ? `(${conditionCount})` : ""}</span>
                  <span style={{ fontSize: 9, color: "#64748b" }}>{getOptionLabel(triggerModeOptions, item.conditionMode || "all", "Tumu")}</span>
                </summary>
                <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 8, marginTop: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginBottom: 6 }}>
                    <SelectInp value={item.conditionMode || "all"} onChange={e => patchTrigger(item.id, { conditionMode: e.target.value })} options={triggerModeOptions} />
                    <button onClick={() => patchTriggerConditions(item.id, prev => [...prev, createTriggerConditionItem(prev.length)])} style={{ minHeight: 28, padding: "0 10px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#ffffff", color: "#2563eb", fontSize: 10, fontWeight: 800, cursor: "pointer" }}>+ Kosul</button>
                  </div>
                  {(item.conditions || []).map(condition => (
                    <div key={condition.id} style={{ background: "#ffffff", border: "1px solid #dbe7f5", borderRadius: 10, padding: 6, marginBottom: 6 }}>
                      <div style={{ display: "flex", gap: 5, alignItems: "center", marginBottom: 5 }}>
                        <SelectInp value={condition.sourceType || "variable"} onChange={e => patchTriggerConditions(item.id, prev => prev.map(entry => entry.id === condition.id ? { ...entry, sourceType: e.target.value, sourceId: "" } : entry))} options={[{ value: "variable", label: "Degisken" }, { value: "objectState", label: "Nesne Durumu" }]} />
                        <button onClick={() => patchTriggerConditions(item.id, prev => prev.filter(entry => entry.id !== condition.id))} style={{ border: "none", background: "transparent", color: "#ef4444", cursor: "pointer", fontSize: 12 }}>×</button>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 5 }}>
                        <SelectInp label={condition.sourceType === "objectState" ? "Nesne" : "Degisken"} value={condition.sourceId || ""} onChange={e => patchTriggerConditions(item.id, prev => prev.map(entry => entry.id === condition.id ? { ...entry, sourceId: e.target.value } : entry))} options={(condition.sourceType === "objectState" ? objectStateOptions : variableOptions).length ? (condition.sourceType === "objectState" ? objectStateOptions : variableOptions) : [{ value: "", label: "Kaynak yok" }]} />
                        {condition.sourceType === "objectState" && <SelectInp label="Durum" value={condition.stateKey || "visited"} onChange={e => patchTriggerConditions(item.id, prev => prev.map(entry => entry.id === condition.id ? { ...entry, stateKey: e.target.value } : entry))} options={OBJECT_STATE_OPTIONS} />}
                        <SelectInp label="Operator" value={condition.operator || "eq"} onChange={e => patchTriggerConditions(item.id, prev => prev.map(entry => entry.id === condition.id ? { ...entry, operator: e.target.value } : entry))} options={TRIGGER_OPERATOR_OPTIONS} />
                        {!['truthy', 'falsy'].includes(condition.operator || 'eq') && <Inp label="Karsilastirma" value={condition.value || ""} onChange={e => patchTriggerConditions(item.id, prev => prev.map(entry => entry.id === condition.id ? { ...entry, value: e.target.value } : entry))} />}
                      </div>
                    </div>
                  ))}
                  {(!item.conditions || item.conditions.length === 0) && <div style={{ fontSize: 10, color: "#64748b", textAlign: "center", padding: "8px 0" }}>Kosul yok, trigger her zaman calisir</div>}
                </div>
              </details>
            </div>
          );
        })}
        {triggers.length === 0 && <div style={{ fontSize: 10, color: "#64748b", textAlign: "center", padding: "8px 0" }}>Tetikleyici yok. Yeni satir ekleyerek Articulate mantiginda akis kurabilirsin.</div>}
      </div>}
    </div>
  );
}

function TimelineDock({
  activity,
  onUpdate,
  height = 230,
  currentTime = 0,
  onCurrentTimeChange = () => {},
  isPlaying = false,
  onPlayingChange = () => {},
  selectedIds = new Set(),
  onSelectObject = () => {},
}) {
  if (!activity) {
    return (
      <div style={{ height, borderTop: "1px solid #131b2e", background: "#161e30", display: "flex", alignItems: "center", justifyContent: "center", color: "#2d3a4f", fontSize: 12 }}>
        Timeline burada görünecek.
      </div>
    );
  }

  const timeline = getActivityTimeline(activity);
  const objects = activity.objects || [];
  const patchAct = (p) => onUpdate({ ...activity, ...p });
  const patchTimeline = (id, p) => patchAct({ timeline: timeline.map(item => item.id === id ? { ...item, ...p } : item) });
  const patchTimelineKeyframes = (timelineId, updater) => {
    const clip = timeline.find(item => item.id === timelineId);
    if (!clip) return;
    const currentKeyframes = Array.isArray(clip.keyframes) ? clip.keyframes : [];
    const nextKeyframes = typeof updater === "function" ? updater(currentKeyframes) : updater;
    patchTimeline(timelineId, { keyframes: nextKeyframes });
  };
  const [timelineZoom, setTimelineZoom] = useState(84);
  const pixelsPerSecond = timelineZoom;
  const labelColumnWidth = 236;
  const rowHeight = 56;
  const totalDuration = Math.max(5, getTimelineDuration(activity));
  const trackWidth = Math.max(900, Math.round(totalDuration * pixelsPerSecond) + 64);
  const dragRef = useRef(null);
  const objectTypeIcons = { text: "T", button: "B", shape: "■", image: "I", video: "V", audio: "♪", hotspot: "◎", draggable: "↕", dropzone: "▭", default: "•" };
  const zoomPercent = Math.round((timelineZoom / 84) * 100);
  const timelineTicks = Array.from({ length: Math.ceil(totalDuration * 5) + 1 }, (_, index) => {
    const second = index / 5;
    return { second, left: second * pixelsPerSecond, major: index % 5 === 0 };
  });
  const activeTimelineItem = timeline.find(item => selectedIds.has(item.objectId) || activity.selectedObjectId === item.objectId) || timeline[0] || null;
  const activeObject = activeTimelineItem ? (objects.find(entry => entry.id === activeTimelineItem.objectId) || null) : null;
  const activeLabel = activeObject?.label || activeObject?.type || activeTimelineItem?.name || "Klip";
  const activeKeyframes = Array.isArray(activeTimelineItem?.keyframes) ? activeTimelineItem.keyframes : [];
  const toolbarButton = {
    minHeight: 28,
    padding: "0 10px",
    borderRadius: 5,
    border: "1px solid rgba(255,255,255,.12)",
    background: "rgba(255,255,255,.07)",
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: 700,
    cursor: "pointer",
  };
  const compactField = {
    display: "flex",
    flexDirection: "column",
    gap: 3,
    minWidth: 0,
  };
  const compactInput = {
    width: "100%",
    minHeight: 28,
    padding: "0 7px",
    borderRadius: 5,
    border: "1px solid rgba(255,255,255,.1)",
    background: "#0f172a",
    color: "#94a3b8",
    fontSize: 10,
    boxSizing: "border-box",
    outline: "none",
  };

  useEffect(() => () => {
    if (!dragRef.current) return;
    window.removeEventListener("pointermove", dragRef.current.move);
    window.removeEventListener("pointerup", dragRef.current.up);
  }, []);

  const beginClipDrag = (event, item, mode) => {
    event.preventDefault();
    event.stopPropagation();
    const session = {
      id: item.id,
      mode,
      startX: event.clientX,
      start: Number(item.start || 0),
      duration: Number(item.duration || 0.2),
    };
    const move = (moveEvent) => {
      const deltaSeconds = (moveEvent.clientX - session.startX) / pixelsPerSecond;
      if (session.mode === "move") {
        patchTimeline(session.id, { start: Math.max(0, Number((session.start + deltaSeconds).toFixed(1))) });
        return;
      }
      if (session.mode === "resize-start") {
        const nextStart = clamp(Number((session.start + deltaSeconds).toFixed(1)), 0, session.start + session.duration - 0.2);
        const nextDuration = Math.max(0.2, Number((session.duration - (nextStart - session.start)).toFixed(1)));
        patchTimeline(session.id, { start: nextStart, duration: nextDuration });
        return;
      }
      const nextDuration = Math.max(0.2, Number((session.duration + deltaSeconds).toFixed(1)));
      patchTimeline(session.id, { duration: nextDuration });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      dragRef.current = null;
    };
    dragRef.current = { move, up };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const scrubFromPointer = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const nextTime = clamp(Number((((event.clientX - rect.left) / pixelsPerSecond)).toFixed(1)), 0, totalDuration);
    onCurrentTimeChange(nextTime);
  };

  return (
    <div style={{ height, borderTop: "1px solid #131b2e", background: "#161e30", display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* ── Timeline Header ── */}
      <div style={{ minHeight: 40, borderBottom: "1px solid #1a2238", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 12px", background: "#1e2740", gap: 10, flexWrap: "wrap", flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, color: "#64748b", letterSpacing: 0.8, textTransform: "uppercase" }}>Timeline</div>
          <div style={{ fontSize: 9, color: "#2d3a4f", marginTop: 1 }}>{currentTime.toFixed(1)}s / {totalDuration.toFixed(1)}s</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <button onClick={() => onPlayingChange(!isPlaying)} style={{ ...toolbarButton, color: isPlaying ? "#4ade80" : "#94a3b8", borderColor: isPlaying ? "rgba(74,222,128,.3)" : "rgba(255,255,255,.12)" }}>
            {isPlaying ? "⏸ Duraklat" : "▶ Oynat"}
          </button>
          <button onClick={() => { onCurrentTimeChange(0); onPlayingChange(false); }} style={toolbarButton}>⏮ Başa</button>
          <div style={{ display: "flex", alignItems: "center", gap: 2, padding: "2px 4px", borderRadius: 5, border: "1px solid rgba(255,255,255,.1)", background: "rgba(255,255,255,.04)" }}>
            <button onClick={() => setTimelineZoom(value => clamp(value - 18, 48, 168))} style={{ ...toolbarButton, minHeight: 22, padding: "0 7px", border: "none", background: "none" }}>−</button>
            <span style={{ minWidth: 36, textAlign: "center", fontSize: 9, fontWeight: 700, color: "#475569" }}>{zoomPercent}%</span>
            <button onClick={() => setTimelineZoom(value => clamp(value + 18, 48, 168))} style={{ ...toolbarButton, minHeight: 22, padding: "0 7px", border: "none", background: "none" }}>+</button>
          </div>
          <span style={{ padding: "3px 8px", borderRadius: 4, border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.04)", fontSize: 9, fontWeight: 700, color: "#475569" }}>{timeline.length} nesne</span>
        </div>
      </div>

      {/* ── Active clip inspector ── */}
      {activeTimelineItem && (
        <div style={{ borderBottom: "1px solid #1a2238", padding: "8px 12px", background: "#1a2238", flexShrink: 0 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap" }}>
            <div style={{ minWidth: 180, maxWidth: 260 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ padding: "2px 6px", borderRadius: 4, background: "rgba(99,131,255,.15)", color: "#a5b4fc", fontSize: 9, fontWeight: 700, border: "1px solid rgba(99,131,255,.3)" }}>Seçili klip</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8" }}>{activeLabel}</span>
              </div>
              <div style={{ fontSize: 9, color: "#334155", marginTop: 4, lineHeight: 1.4 }}>
                {activeObject?.type ? `${activeObject.type}` : "Nesne"} · {shouldObjectPersistAfterTimeline(activeTimelineItem) ? "kalıcı" : "çıkış efekti var"}
              </div>
            </div>

            <div style={{ flex: 1, minWidth: 380, display: "grid", gridTemplateColumns: "repeat(6, minmax(64px, 1fr))", gap: 5 }}>
              {[
                { label: "Başlangıç", val: activeTimelineItem.start, key: "start", onChange: v => patchTimeline(activeTimelineItem.id, { start: Math.max(0, v) }) },
                { label: "Süre", val: activeTimelineItem.duration, key: "duration", onChange: v => patchTimeline(activeTimelineItem.id, { duration: Math.max(0.2, v) }) },
              ].map(f => (
                <label key={f.key} style={compactField}>
                  <span style={{ fontSize: 8, color: "#334155", fontWeight: 700 }}>{f.label}</span>
                  <input type="number" value={f.val} onChange={e => f.onChange(+e.target.value || 0)} style={compactInput} />
                </label>
              ))}
              {[
                { label: "Giriş", val: activeTimelineItem.entryEffect || "fade", key: "entryEffect", options: TIMELINE_EFFECT_OPTIONS },
                { label: "Çıkış", val: activeTimelineItem.exitEffect || "none", key: "exitEffect", options: TIMELINE_EFFECT_OPTIONS },
                { label: "Yön", val: activeTimelineItem.direction || "left", key: "direction", options: TIMELINE_DIRECTION_OPTIONS },
                { label: "Easing", val: activeTimelineItem.easing || "easeOut", key: "easing", options: TIMELINE_EASING_OPTIONS },
              ].map(f => (
                <label key={f.key} style={compactField}>
                  <span style={{ fontSize: 8, color: "#334155", fontWeight: 700 }}>{f.label}</span>
                  <select value={f.val} onChange={e => patchTimeline(activeTimelineItem.id, { [f.key]: e.target.value })} style={compactInput}>
                    {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </label>
              ))}
            </div>
          </div>

          {/* Keyframe panel */}
          <div style={{ marginTop: 8, padding: "7px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,.07)", background: "#161e30" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
              <div>
                <span style={{ fontSize: 9, fontWeight: 700, color: "#475569" }}>Keyframe Noktaları</span>
                <span style={{ fontSize: 9, color: "#2d3a4f", marginLeft: 8 }}>Nesne hareketini düzenle</span>
              </div>
              <button
                onClick={() => patchTimelineKeyframes(activeTimelineItem.id, prev => {
                  const nextTime = Math.min(activeTimelineItem.duration, Number((prev.length ? Math.min(activeTimelineItem.duration, prev[prev.length - 1].time + 0.6) : activeTimelineItem.duration / 2).toFixed(1)));
                  return [...prev, createTimelineKeyframe(nextTime, prev.length)];
                })}
                style={{ ...toolbarButton, fontSize: 9 }}
              >
                + Keyframe
              </button>
            </div>
            {activeKeyframes.length > 0 ? (
              <>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
                  {activeKeyframes.map((frame, fi) => {
                    const isPinned = fi === 0 || fi === activeKeyframes.length - 1;
                    return (
                      <div key={frame.id} style={{ display: "flex", alignItems: "center", gap: 5, padding: "2px 7px", borderRadius: 4, border: `1px solid ${isPinned ? "rgba(99,131,255,.35)" : "rgba(255,255,255,.08)"}`, background: isPinned ? "rgba(99,131,255,.1)" : "rgba(255,255,255,.03)" }}>
                        <strong style={{ fontSize: 9, color: "#818cf8" }}>{Number(frame.time || 0).toFixed(1)}s</strong>
                        <span style={{ fontSize: 8, color: "#334155" }}>{`X:${Math.round(frame.x || 0)} Y:${Math.round(frame.y || 0)} S:${Number(frame.scale || 1).toFixed(1)} O:${Number(frame.opacity ?? 1).toFixed(1)}`}</span>
                        {!isPinned && activeKeyframes.length > 2 && (
                          <button onClick={() => patchTimelineKeyframes(activeTimelineItem.id, prev => prev.filter(e => e.id !== frame.id))} style={{ border: "none", background: "transparent", color: "#f87171", cursor: "pointer", fontSize: 11, lineHeight: 1, padding: 0 }}>×</button>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {activeKeyframes.map((frame, fi) => {
                    const isPinned = fi === 0 || fi === activeKeyframes.length - 1;
                    return (
                      <div key={frame.id} style={{ display: "grid", gridTemplateColumns: "52px 1fr 1fr 1fr 1fr 22px", gap: 3, alignItems: "center" }}>
                        <input type="number" value={frame.time} onChange={e => patchTimelineKeyframes(activeTimelineItem.id, prev => prev.map(en => en.id === frame.id ? { ...en, time: clamp(+e.target.value || 0, 0, activeTimelineItem.duration) } : en))} style={compactInput} />
                        <input type="number" value={frame.x} onChange={e => patchTimelineKeyframes(activeTimelineItem.id, prev => prev.map(en => en.id === frame.id ? { ...en, x: +e.target.value || 0 } : en))} placeholder="X" style={compactInput} />
                        <input type="number" value={frame.y} onChange={e => patchTimelineKeyframes(activeTimelineItem.id, prev => prev.map(en => en.id === frame.id ? { ...en, y: +e.target.value || 0 } : en))} placeholder="Y" style={compactInput} />
                        <input type="number" step="0.1" value={frame.scale} onChange={e => patchTimelineKeyframes(activeTimelineItem.id, prev => prev.map(en => en.id === frame.id ? { ...en, scale: Math.max(0.1, +e.target.value || 1) } : en))} placeholder="S" style={compactInput} />
                        <input type="number" step="0.1" value={frame.opacity} onChange={e => patchTimelineKeyframes(activeTimelineItem.id, prev => prev.map(en => en.id === frame.id ? { ...en, opacity: clamp(+e.target.value || 0, 0, 1) } : en))} placeholder="O" style={compactInput} />
                        <button onClick={() => patchTimelineKeyframes(activeTimelineItem.id, prev => isPinned || prev.length <= 2 ? prev : prev.filter(en => en.id !== frame.id))} style={{ border: "none", background: "transparent", color: isPinned ? "#1e2740" : "#f87171", cursor: isPinned ? "default" : "pointer", fontSize: 12, lineHeight: 1 }}>×</button>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "52px 1fr 1fr 1fr 1fr 22px", gap: 3, marginTop: 3, fontSize: 8, color: "#2d3a4f" }}>
                  <span>sn</span><span>X</span><span>Y</span><span>Scale</span><span>Opacity</span><span />
                </div>
              </>
            ) : (
              <div style={{ fontSize: 9, color: "#2d3a4f" }}>Keyframe yok. + Keyframe ile hareket noktası ekle.</div>
            )}
          </div>
        </div>
      )}

      {/* ── Track area ── */}
      <div style={{ flex: 1, overflowX: "auto", overflowY: "auto", padding: 0 }}>
        {timeline.length > 0 ? (
          <div style={{ minWidth: labelColumnWidth + trackWidth, paddingBottom: 8 }}>
            {/* Column headers */}
            <div style={{ display: "flex", minWidth: labelColumnWidth + trackWidth, position: "sticky", top: 0, zIndex: 2, background: "#1a2238" }}>
              <div style={{ width: labelColumnWidth, flexShrink: 0, padding: "6px 10px", fontSize: 9, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: 0.6, background: "#1a2238", borderRight: "1px solid #131b2e", borderBottom: "1px solid #131b2e" }}>
                Nesneler
              </div>
              <div onPointerDown={scrubFromPointer} style={{ width: trackWidth, height: 28, position: "relative", cursor: "ew-resize", borderBottom: "1px solid #131b2e", background: "#1a2238" }}>
                {timelineTicks.map(tick => (
                  <div key={tick.second} style={{ position: "absolute", left: tick.left, top: 0, bottom: 0, width: 1, background: tick.major ? "#2d3a4f" : "#1e2740" }}>
                    {tick.major && <span style={{ position: "absolute", top: 5, left: 4, fontSize: 9, color: "#2d3a4f" }}>{tick.second}s</span>}
                  </div>
                ))}
                <div style={{ position: "absolute", left: currentTime * pixelsPerSecond - 4, top: 0, width: 0, height: 0, borderLeft: "4px solid transparent", borderRight: "4px solid transparent", borderTop: "7px solid #ef4444" }} />
                <div style={{ position: "absolute", left: currentTime * pixelsPerSecond, top: 0, bottom: 0, width: 1, background: "#ef4444" }} />
              </div>
            </div>

            {/* Rows */}
            {timeline.map((item, rowIndex) => {
              const object = objects.find(entry => entry.id === item.objectId) || null;
              const label = object?.label || object?.type || item.name || "Klip";
              const isSelected = activeTimelineItem?.id === item.id;
              const isActive = isObjectTimelineActive(activity, item.objectId, currentTime);
              const objectIcon = objectTypeIcons[object?.type || "default"] || objectTypeIcons.default;
              const rowBg = isSelected ? "rgba(99,131,255,.1)" : rowIndex % 2 === 0 ? "#161e30" : "#131a28";
              return (
                <div key={item.id} style={{ display: "flex", alignItems: "stretch", minWidth: labelColumnWidth + trackWidth }}>
                  <button
                    onClick={() => onSelectObject(item.objectId)}
                    style={{ width: labelColumnWidth, flexShrink: 0, border: "none", borderRight: "1px solid #131b2e", borderBottom: "1px solid #131b2e", background: rowBg, padding: "6px 8px", cursor: "pointer", textAlign: "left", minHeight: rowHeight }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 20, height: 20, borderRadius: 5, border: `1px solid ${isSelected ? "rgba(99,131,255,.4)" : "rgba(255,255,255,.08)"}`, background: isSelected ? "rgba(99,131,255,.15)" : "rgba(255,255,255,.04)", color: isSelected ? "#a5b4fc" : "#475569", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, flexShrink: 0 }}>{objectIcon}</span>
                      <span style={{ width: 8, height: 8, borderRadius: 999, background: isActive ? "#4ade80" : isSelected ? "#6483ff" : "#1e2740", boxShadow: isActive ? "0 0 0 3px rgba(74,222,128,.15)" : "none", flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: isSelected ? "#a5b4fc" : "#475569", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
                        <div style={{ fontSize: 8, color: "#2d3a4f", marginTop: 2 }}>{Number(item.start || 0).toFixed(1)}s–{Number((item.start || 0) + (item.duration || 0)).toFixed(1)}s · {(item.entryEffect || "fade")}</div>
                      </div>
                    </div>
                  </button>

                  <div onPointerDown={scrubFromPointer} style={{ width: trackWidth, height: rowHeight, position: "relative", borderBottom: "1px solid #131b2e", background: rowBg, cursor: "ew-resize" }}>
                    {timelineTicks.map(tick => (
                      <div key={tick.second} style={{ position: "absolute", left: tick.left, top: 0, bottom: 0, width: 1, background: tick.major ? "#1e2740" : "#161e30" }} />
                    ))}
                    <div style={{ position: "absolute", left: currentTime * pixelsPerSecond, top: 0, bottom: 0, width: 1, background: "#ef4444", pointerEvents: "none" }} />

                    <div
                      onClick={e => { e.stopPropagation(); onSelectObject(item.objectId); }}
                      onPointerDown={e => beginClipDrag(e, item, "move")}
                      style={{
                        position: "absolute",
                        left: item.start * pixelsPerSecond,
                        top: 12,
                        width: Math.max(24, item.duration * pixelsPerSecond),
                        height: 28,
                        borderRadius: 4,
                        background: isSelected ? "rgba(99,131,255,.55)" : "rgba(56,108,220,.35)",
                        border: `1px solid ${isSelected ? "rgba(99,131,255,.8)" : "rgba(56,108,220,.5)"}`,
                        color: isSelected ? "#c7d2fe" : "#6483ff",
                        cursor: "grab",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "0 6px",
                        overflow: "hidden",
                      }}
                    >
                      <div onPointerDown={e => beginClipDrag(e, item, "resize-start")} style={{ width: 6, alignSelf: "stretch", cursor: "ew-resize", marginLeft: -2 }} />
                      <span style={{ fontSize: 9, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
                      <span style={{ fontSize: 8, opacity: 0.8, marginLeft: 6 }}>{Number(item.duration || 0).toFixed(1)}s</span>
                      <div onPointerDown={e => beginClipDrag(e, item, "resize-end")} style={{ width: 6, alignSelf: "stretch", cursor: "ew-resize", marginRight: -2 }} />
                    </div>

                    {(item.keyframes || []).map((frame, fi) => (
                      <div key={frame.id} style={{ position: "absolute", left: (item.start + frame.time) * pixelsPerSecond - 4, top: rowHeight - 12, width: 8, height: 8, borderRadius: 1, transform: "rotate(45deg)", background: fi === 0 || fi === (item.keyframes || []).length - 1 ? "rgba(99,131,255,.6)" : "#2d3a4f", border: `1px solid ${isSelected ? "#6483ff" : "#334155"}` }} title={`${frame.time}s`} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ height: "100%", border: "1px dashed rgba(255,255,255,.06)", borderRadius: 6, margin: 10, background: "rgba(255,255,255,.02)", display: "flex", alignItems: "center", justifyContent: "center", color: "#2d3a4f", fontSize: 12, textAlign: "center", padding: 16 }}>
            Sahneye nesne ekleyin — timeline satırları otomatik oluşur.
          </div>
        )}
      </div>
    </div>
  );
}

function StoryboardPanel({ present, selActivityId, onSelect, onOpenContent }) {
  const currentBook = present.books.find(book => book.id === present.selBookId) || null;
  const currentPublisher = present.publishers.find(pub => pub.id === present.selPubId) || null;
  const activities = present.activities.filter(activity => activity.bookId === present.selBookId);

  return (
    <div style={{ width: 132, flexShrink: 0, border: "1px solid #252540", borderRadius: 14, background: "#0f1020", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "12px 10px", borderBottom: "1px solid #252540", background: "#131427" }}>
        <div style={{ fontSize: 10, color: "#7b8ba1", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>Storyboard</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#E0E0E0", lineHeight: 1.3 }}>{currentBook?.name || "Kitap secilmedi"}</div>
        <div style={{ fontSize: 10, color: "#667085", marginTop: 4 }}>{currentPublisher?.name || "Yayınevi seç"}</div>
        <button onClick={onOpenContent} style={{ width: "100%", marginTop: 10, border: "1px solid #2a314b", background: "#171a31", color: "#9fb0d0", borderRadius: 8, padding: "6px 8px", cursor: "pointer", fontSize: 10, fontWeight: 700 }}>
          İçerik Yönet
        </button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 10, display: "flex", flexDirection: "column", gap: 10 }}>
        {activities.map((activity, index) => (
          <button
            key={activity.id}
            onClick={() => onSelect(activity.id)}
            style={{
              border: `1px solid ${selActivityId === activity.id ? "#4CAF50" : "#2a314b"}`,
              background: selActivityId === activity.id ? "#1a2a1a" : "#12162a",
              borderRadius: 10,
              padding: 6,
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <div style={{ height: 62, borderRadius: 6, border: `1px solid ${selActivityId === activity.id ? "#4CAF50" : "#394150"}`, background: "linear-gradient(180deg,#f8fafc,#dbe4f0)", display: "flex", alignItems: "center", justifyContent: "center", color: "#1f2937", fontSize: 10, fontWeight: 700 }}>
              Sahne {index + 1}
            </div>
            <div style={{ fontSize: 10, color: selActivityId === activity.id ? "#A5D6A7" : "#B0BEC5", marginTop: 6, textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {activity.name || `Slider ${index + 1}`}
            </div>
          </button>
        ))}
        {activities.length === 0 && (
          <div style={{ border: "1px dashed #2a314b", borderRadius: 10, padding: 12, fontSize: 10, color: "#667085", textAlign: "center", lineHeight: 1.5 }}>
            Once kitap sec, sonra etkinlik ekle.
          </div>
        )}
      </div>
    </div>
  );
}

function SlideThumbnail({ slide, isActive = false, width = 132, height = 74 }) {
  const stageWidth = Math.max(1, Number(slide?.stageWidth || 1920));
  const stageHeight = Math.max(1, Number(slide?.stageHeight || 1080));
  const scale = Math.min(1, width / stageWidth, height / stageHeight);
  const visibleObjects = (slide?.objects || [])
    .filter(item => item?.visible !== false)
    .sort((a, b) => (a?.zIndex || 1) - (b?.zIndex || 1))
    .slice(0, 6);

  return (
    <div style={{ height: height + 10, borderRadius: 10, border: `1px solid ${isActive ? "#60a5fa" : "#c7d0db"}`, background: slide?.backgroundColor || "#ffffff", overflow: "hidden", position: "relative", boxShadow: isActive ? "0 10px 20px rgba(37,99,235,.12)" : "inset 0 1px 0 rgba(255,255,255,.9)" }}>
      {slide?.svgMarkup && (
        <div
          style={{ position: "absolute", inset: 0, opacity: 0.92, transformOrigin: "top left", transform: `scale(${scale})`, width: stageWidth, height: stageHeight, pointerEvents: "none" }}
          dangerouslySetInnerHTML={{ __html: slide.svgMarkup }}
        />
      )}
      <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,.04)" }} />
      {visibleObjects.map(obj => {
        const st = obj.style || {};
        const isImage = !!obj.imageData;
        const isVideo = obj.type === "video";
        const isAudio = obj.type === "audio";
        return (
          <div
            key={obj.id}
            style={{
              position: "absolute",
              left: obj.x * scale,
              top: obj.y * scale,
              width: Math.max(10, obj.width * scale),
              height: Math.max(10, obj.height * scale),
              borderRadius: Math.max(2, (st.borderRadius || 6) * scale),
              border: `${Math.max(1, obj.type === "hotspot" ? 2 : 1)}px ${st.borderStyle || "solid"} ${st.borderColor || "rgba(15,23,42,.12)"}`,
              background: isImage ? "transparent" : isVideo ? "#082f49" : isAudio ? "#0f172a" : (st.background || "rgba(255,255,255,.85)"),
              color: st.color || "#0f172a",
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: Math.max(6, (st.fontSize || 12) * scale * 0.72),
              fontWeight: 800,
              padding: isImage ? 0 : Math.max(2, 4 * scale),
              transform: `rotate(${obj.rotation || 0}deg)`,
              boxSizing: "border-box",
            }}
          >
            {isImage ? (
              <img src={obj.imageData} alt={obj.label || obj.type} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : isVideo ? (
              <span style={{ fontSize: Math.max(7, 10 * scale), color: "#e0f2fe" }}>VIDEO</span>
            ) : isAudio ? (
              <span style={{ fontSize: Math.max(7, 10 * scale), color: "#bae6fd" }}>SES</span>
            ) : (
              <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{obj.label || obj.type}</span>
            )}
          </div>
        );
      })}
      <div style={{ position: "absolute", left: 6, top: 6, display: "flex", gap: 4 }}>
        <span style={{ padding: "2px 5px", borderRadius: 999, background: "rgba(255,255,255,.88)", color: "#334155", fontSize: 8, fontWeight: 800, border: "1px solid rgba(148,163,184,.35)" }}>
          {slide?.objects?.length || 0} obje
        </span>
      </div>
      <div style={{ position: "absolute", right: 6, top: 6, display: "flex", gap: 4 }}>
        {slide?.slideTransitionEffect && slide.slideTransitionEffect !== "none" && (
          <span style={{ padding: "2px 6px", borderRadius: 999, background: "rgba(15,23,42,.72)", color: "#f8fafc", fontSize: 8, fontWeight: 800 }}>
            {slide.slideTransitionEffect === "slide" ? "Kaydir" : "Fade"}
          </span>
        )}
      </div>
      <div style={{ position: "absolute", inset: 0, border: isActive ? "2px solid #2563eb" : "1px solid rgba(255,255,255,.35)", pointerEvents: "none", boxSizing: "border-box", borderRadius: 10 }} />
    </div>
  );
}

function LayerThumbnail({ activity, layer, isActive = false }) {
  const stageWidth = Math.max(1, Number(activity?.stageWidth || 1920));
  const stageHeight = Math.max(1, Number(activity?.stageHeight || 1080));
  const scale = Math.min(1, 88 / stageWidth, 52 / stageHeight);
  const visibleObjects = getCanvasObjects({ ...activity, activeLayerId: layer?.id || "base" }, layer?.id || "base")
    .filter(item => item?.visible !== false)
    .sort((a, b) => (a?.zIndex || 1) - (b?.zIndex || 1))
    .slice(0, 6);

  return (
    <div style={{ width: 88, height: 52, flexShrink: 0, borderRadius: 6, border: `1px solid ${isActive ? "#60a5fa" : "#c7d0db"}`, background: activity?.backgroundColor || "#ffffff", overflow: "hidden", position: "relative", boxShadow: "inset 0 1px 0 rgba(255,255,255,.75)" }}>
      {activity?.svgMarkup && (
        <div
          style={{ position: "absolute", inset: 0, opacity: 0.92, transformOrigin: "top left", transform: `scale(${scale})`, width: stageWidth, height: stageHeight, pointerEvents: "none" }}
          dangerouslySetInnerHTML={{ __html: activity.svgMarkup }}
        />
      )}
      {visibleObjects.map(obj => {
        const st = obj.style || {};
        const isImage = !!obj.imageData;
        const isVideo = obj.type === "video";
        const isAudio = obj.type === "audio";
        return (
          <div
            key={obj.id}
            style={{
              position: "absolute",
              left: obj.x * scale,
              top: obj.y * scale,
              width: Math.max(6, obj.width * scale),
              height: Math.max(6, obj.height * scale),
              border: `1px ${st.borderStyle || "solid"} ${st.borderColor || "#111111"}`,
              background: isImage ? "transparent" : isVideo ? "#444444" : isAudio ? "#e5e5e5" : (st.background || "#ffffff"),
              color: st.color || "#111111",
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: Math.max(5, (st.fontSize || 12) * scale * 0.6),
              fontWeight: 700,
              padding: isImage ? 0 : 2,
              boxSizing: "border-box",
            }}
          >
            {isImage ? (
              <img src={obj.imageData} alt={obj.label || obj.type} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : isVideo ? (
              <span style={{ fontSize: Math.max(5, 8 * scale), color: "#ffffff" }}>V</span>
            ) : isAudio ? (
              <span style={{ fontSize: Math.max(5, 8 * scale), color: "#111111" }}>S</span>
            ) : null}
          </div>
        );
      })}
      <div style={{ position: "absolute", inset: 0, border: isActive ? "2px solid #2563eb" : "1px solid rgba(255,255,255,.45)", pointerEvents: "none", boxSizing: "border-box", borderRadius: 6 }} />
    </div>
  );
}

function getSlideConnectionMap(activity, slides) {
  const outgoing = {};
  const incoming = {};
  slides.forEach(slide => {
    outgoing[slide.id] = [];
    incoming[slide.id] = [];
  });

  const pushConnection = (fromId, toId, reason) => {
    if (!fromId || !toId || fromId === toId) return;
    if (!outgoing[fromId].some(entry => entry.to === toId && entry.reason === reason)) {
      outgoing[fromId].push({ to: toId, reason });
    }
    if (!incoming[toId].some(entry => entry.from === fromId && entry.reason === reason)) {
      incoming[toId].push({ from: fromId, reason });
    }
  };

  slides.forEach((slide, index) => {
    if (slides[index + 1]) pushConnection(slide.id, slides[index + 1].id, "sira");
    (slide.triggers || []).filter(trigger => trigger?.action === "SliderGec").forEach(trigger => {
      const target = getActivitySlideTarget({ ...activity, currentSlideId: slide.id, slides }, trigger.value || "__next__");
      if (target?.id) pushConnection(slide.id, target.id, "tetik");
    });
  });

  return { outgoing, incoming };
}

function SlideStrip({ activity, onUpdate, vertical = false }) {
  const slides = Array.isArray(activity?.slides) && activity.slides.length ? activity.slides : [normalizeSlide({}, 0)];
  const currentSlideId = activity?.currentSlideId || slides[0]?.id;
  const [thumbZoom, setThumbZoom] = useState(1);
  const [layoutMode, setLayoutMode] = useState(vertical ? "list" : "grid");
  const { outgoing, incoming } = useMemo(() => getSlideConnectionMap(activity, slides), [activity, slides]);
  const effectiveLayoutMode = vertical ? "list" : layoutMode;
  const thumbWidth = Math.max(vertical ? 126 : 118, Math.round((vertical ? 132 : 138) * thumbZoom));
  const thumbHeight = Math.max(vertical ? 70 : 68, Math.round((vertical ? 74 : 78) * thumbZoom));
  const miniButton = {
    minHeight: 28,
    padding: "0 10px",
    borderRadius: 8,
    border: "1px solid #c7d0db",
    background: "#ffffff",
    color: "#334155",
    fontSize: 10,
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,.9)",
  };

  const handleSelect = (slideId) => onUpdate(selectActivitySlide(activity, slideId));
  const handleAdd = () => {
    const newSlide = createSlide(`Slider ${slides.length + 1}`, slides.length);
    onUpdate(selectActivitySlide({ ...activity, slides: [...slides, newSlide], currentSlideId: newSlide.id }, newSlide.id));
  };
  const handleDuplicate = (slideId) => {
    const source = slides.find(slide => slide.id === slideId);
    if (!source) return;
    const copy = normalizeSlide({ ...source, id: uid(), name: `${source.name || "Slider"} Kopya`, sceneName: source.sceneName || source.name || "Sahne" }, slides.length);
    onUpdate(selectActivitySlide({ ...activity, slides: [...slides, copy], currentSlideId: copy.id }, copy.id));
  };
  const handleDelete = (slideId) => {
    if (slides.length <= 1) return;
    const nextSlides = slides.filter(slide => slide.id !== slideId);
    const fallbackSlide = nextSlides[Math.max(0, slides.findIndex(slide => slide.id === slideId) - 1)] || nextSlides[0];
    onUpdate(selectActivitySlide({ ...activity, slides: nextSlides, currentSlideId: fallbackSlide?.id || nextSlides[0]?.id }, fallbackSlide?.id || nextSlides[0]?.id));
  };

  return (
    <div style={{ flexShrink: 0, height: "100%", minHeight: 0, padding: 0, borderBottom: vertical ? "none" : "1px solid #1a2238", borderRight: vertical ? "1px solid #1a2238" : "none", background: "#1a2238", minWidth: vertical ? "100%" : "auto", width: vertical ? "100%" : "auto", display: "flex", flexDirection: "column" }}>

      {/* ── Header ── */}
      <div style={{ padding: "9px 10px 8px", borderBottom: "1px solid #131b2e", background: "#141c2e", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginBottom: 6 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", letterSpacing: 0.8, textTransform: "uppercase" }}>Scenes</div>
            <div style={{ fontSize: 9, color: "#3d4f6b", marginTop: 1 }}>{slides.length} slide</div>
          </div>
          <button onClick={handleAdd} style={{ height: 26, padding: "0 10px", borderRadius: 5, border: "1px solid rgba(99,131,255,.4)", background: "rgba(99,131,255,.15)", color: "#a5b4fc", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>+ Scene</button>
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {!vertical && (
            <>
              <button onClick={() => setLayoutMode("list")} style={{ height: 22, padding: "0 8px", borderRadius: 4, border: `1px solid ${effectiveLayoutMode === "list" ? "rgba(99,131,255,.45)" : "rgba(255,255,255,.1)"}`, background: effectiveLayoutMode === "list" ? "rgba(99,131,255,.2)" : "transparent", color: effectiveLayoutMode === "list" ? "#a5b4fc" : "#475569", fontSize: 9, fontWeight: 700, cursor: "pointer" }}>☰</button>
              <button onClick={() => setLayoutMode("grid")} style={{ height: 22, padding: "0 8px", borderRadius: 4, border: `1px solid ${effectiveLayoutMode === "grid" ? "rgba(99,131,255,.45)" : "rgba(255,255,255,.1)"}`, background: effectiveLayoutMode === "grid" ? "rgba(99,131,255,.2)" : "transparent", color: effectiveLayoutMode === "grid" ? "#a5b4fc" : "#475569", fontSize: 9, fontWeight: 700, cursor: "pointer" }}>⊞</button>
            </>
          )}
          <button onClick={() => setThumbZoom(value => clamp(Number((value - 0.1).toFixed(2)), 0.6, 1.8))} style={{ height: 22, width: 22, borderRadius: 4, border: "1px solid rgba(255,255,255,.1)", background: "transparent", color: "#475569", fontSize: 12, cursor: "pointer" }}>−</button>
          <span style={{ fontSize: 9, color: "#475569", minWidth: 28, textAlign: "center" }}>{Math.round(thumbZoom * 100)}%</span>
          <button onClick={() => setThumbZoom(value => clamp(Number((value + 0.1).toFixed(2)), 0.6, 1.8))} style={{ height: 22, width: 22, borderRadius: 4, border: "1px solid rgba(255,255,255,.1)", background: "transparent", color: "#475569", fontSize: 12, cursor: "pointer" }}>+</button>
        </div>
      </div>

      {/* ── Slide list ── */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", padding: "6px 6px 10px", touchAction: vertical ? "pan-y" : "pan-x pan-y" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {slides.map((slide, index) => {
            const isActive = slide.id === currentSlideId;
            const outgoingLinks = outgoing[slide.id] || [];
            const incomingLinks = incoming[slide.id] || [];
            const transitionLabel = slide.slideTransitionEffect === "slide" ? "Kaydir" : slide.slideTransitionEffect === "fade" ? "Fade" : "Düz";
            return (
              <div
                key={slide.id}
                onClick={() => handleSelect(slide.id)}
                style={{
                  width: "100%",
                  minWidth: 0,
                  boxSizing: "border-box",
                  borderRadius: 6,
                  border: `1px solid ${isActive ? "rgba(99,131,255,.6)" : "rgba(255,255,255,.06)"}`,
                  background: isActive ? "rgba(99,131,255,.14)" : "rgba(255,255,255,.03)",
                  cursor: "pointer",
                  overflow: "hidden",
                  borderLeft: `3px solid ${isActive ? "#6483ff" : "transparent"}`,
                  transition: "background .12s, border-color .12s",
                }}
              >
                {/* Thumbnail full-width */}
                <div style={{ width: "100%", aspectRatio: "16/9", background: "#0f172a", overflow: "hidden", position: "relative" }}>
                  <SlideThumbnail slide={slide} isActive={isActive} width={thumbWidth} height={thumbHeight} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  {/* Slide number badge */}
                  <div style={{ position: "absolute", top: 4, left: 4, background: isActive ? "#6483ff" : "rgba(0,0,0,.55)", color: "#fff", fontSize: 9, fontWeight: 800, padding: "1px 5px", borderRadius: 3 }}>
                    {index + 1}
                  </div>
                  {/* Action buttons overlay */}
                  <div style={{ position: "absolute", top: 3, right: 3, display: "flex", gap: 3 }}>
                    <button
                      onClick={e => { e.stopPropagation(); handleDuplicate(slide.id); }}
                      style={{ width: 20, height: 20, borderRadius: 3, border: "none", background: "rgba(0,0,0,.55)", color: "rgba(255,255,255,.7)", fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                      title="Kopyala"
                    >⧉</button>
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(slide.id); }}
                      disabled={slides.length <= 1}
                      style={{ width: 20, height: 20, borderRadius: 3, border: "none", background: "rgba(0,0,0,.55)", color: slides.length <= 1 ? "rgba(255,255,255,.2)" : "rgba(239,68,68,.9)", fontSize: 12, cursor: slides.length <= 1 ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                      title="Sil"
                    >×</button>
                  </div>
                </div>

                {/* Info row */}
                <div style={{ padding: "5px 7px 6px" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: isActive ? "#c7d2fe" : "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 3 }}>
                    {slide.sceneName || slide.name || `Sahne ${index + 1}`}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "nowrap" }}>
                    <span style={{ fontSize: 8, color: "#334155", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.08)", padding: "1px 5px", borderRadius: 3, whiteSpace: "nowrap" }}>{slide.objects?.length || 0} nesne</span>
                    <span style={{ fontSize: 8, color: "#334155", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.08)", padding: "1px 5px", borderRadius: 3, whiteSpace: "nowrap" }}>{slide.timeline?.length || 0} klip</span>
                    {outgoingLinks.length > 0 && <span style={{ fontSize: 8, color: "#6483ff", background: "rgba(99,131,255,.1)", border: "1px solid rgba(99,131,255,.2)", padding: "1px 5px", borderRadius: 3, whiteSpace: "nowrap" }}>{outgoingLinks.length} bağ</span>}
                  </div>

                  {/* Transition controls */}
                  <div style={{ display: "flex", gap: 4, marginTop: 5, alignItems: "center" }} onClick={e => e.stopPropagation()}>
                    <select
                      value={slide.slideTransitionEffect || "fade"}
                      onChange={event => {
                        const nextSlides = slides.map(item => item.id === slide.id ? { ...item, slideTransitionEffect: event.target.value } : item);
                        onUpdate(selectActivitySlide({ ...activity, slides: nextSlides, currentSlideId: slide.id }, slide.id));
                      }}
                      style={{ flex: 1, minWidth: 0, height: 22, borderRadius: 4, border: "1px solid rgba(255,255,255,.1)", background: "#0f172a", color: "#64748b", fontSize: 9, padding: "0 4px" }}
                    >
                      {SLIDE_TRANSITION_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                    <input
                      type="number"
                      min={0} max={2.5} step={0.05}
                      value={slide.slideTransitionDuration ?? 0.45}
                      onChange={event => {
                        const nextSlides = slides.map(item => item.id === slide.id ? { ...item, slideTransitionDuration: Math.min(2.5, Math.max(0, Number(event.target.value) || 0)) } : item);
                        onUpdate(selectActivitySlide({ ...activity, slides: nextSlides, currentSlideId: slide.id }, slide.id));
                      }}
                      style={{ width: 42, height: 22, borderRadius: 4, border: "1px solid rgba(255,255,255,.1)", background: "#0f172a", color: "#64748b", fontSize: 9, padding: "0 4px", textAlign: "center" }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function EditorToolRail({ selActivity, canvasRef, selectedIds, setActiveTab, previewMode, setPreviewMode, mobile = false, uiMode = "basic" }) {
  const disabled = !selActivity;
  const isAdvancedMode = uiMode === "advanced";
  const tools = [
    { id: "preview", icon: "▶", label: previewMode ? "Editor" : "Önizle", title: previewMode ? "Editör'e dön" : "Önizleme", onClick: () => !disabled && setPreviewMode(v => !v), active: previewMode },
    { id: "svg", icon: "SVG", label: "Zemin", title: "SVG zemin yukle", onClick: () => canvasRef.current?.loadSVG() },
    { id: "text", icon: "T", label: "Metin", title: "Metin ekle", onClick: () => canvasRef.current?.addObject("text") },
    { id: "button", icon: "B", label: "Buton", title: "Buton ekle", onClick: () => canvasRef.current?.addObject("button") },
    { id: "shape-rect", icon: "K", label: "Sekil", title: "Sekil ekle", onClick: () => canvasRef.current?.addObject("shape") },
    { id: "image", icon: "I", label: "Resim", title: "Resim ekle", onClick: () => canvasRef.current?.addImage() },
    { id: "video", icon: "V", label: "Video", title: "Video ekle", onClick: () => canvasRef.current?.addVideo() },
    { id: "audio", icon: "♪", label: "Ses", title: "Ses ekle", onClick: () => canvasRef.current?.addAudio() },
    { id: "shape", icon: "H", label: "Hotspot", title: "Hotspot ekle", onClick: () => canvasRef.current?.addObject("hotspot") },
    { id: "copy", icon: "C", label: "Kopyala", title: "Kopyala", onClick: () => canvasRef.current?.duplicateSelected(), isDisabled: selectedIds.size === 0 && !selActivity?.selectedObjectId },
    { id: "delete", icon: "X", label: "Sil", title: "Sil", onClick: () => canvasRef.current?.deleteSelected(), isDisabled: selectedIds.size === 0 && !selActivity?.selectedObjectId },
    { id: "stage", icon: "S", label: "Sahne", title: "Sahne sekmesi", onClick: () => setActiveTab("sahne") },
    { id: "texts", icon: "M", label: "Metin Stüdyosu", title: "Metin stüdyosunu yeni sekmede aç", onClick: () => setActiveTab("metinler") },
    { id: "settings", icon: "A", label: "Ayar", title: "Ayarlar sekmesi", onClick: () => setActiveTab("ayarlar") },
  ].filter(tool => isAdvancedMode || !["copy", "delete", "settings"].includes(tool.id));

  const toolToneMap = {
    preview:    { color: "#60a5fa", iconBg: "rgba(96,165,250,.15)",  iconBorder: "rgba(96,165,250,.3)"  },
    svg:        { color: "#c084fc", iconBg: "rgba(192,132,252,.15)", iconBorder: "rgba(192,132,252,.3)" },
    text:       { color: "#94a3b8", iconBg: "rgba(148,163,184,.12)", iconBorder: "rgba(148,163,184,.2)" },
    button:     { color: "#818cf8", iconBg: "rgba(129,140,248,.15)", iconBorder: "rgba(129,140,248,.3)" },
    "shape-rect":{ color: "#34d399", iconBg: "rgba(52,211,153,.15)", iconBorder: "rgba(52,211,153,.3)"  },
    image:      { color: "#4ade80", iconBg: "rgba(74,222,128,.15)",  iconBorder: "rgba(74,222,128,.3)"  },
    video:      { color: "#38bdf8", iconBg: "rgba(56,189,248,.15)",  iconBorder: "rgba(56,189,248,.3)"  },
    audio:      { color: "#2dd4bf", iconBg: "rgba(45,212,191,.15)",  iconBorder: "rgba(45,212,191,.3)"  },
    shape:      { color: "#fb923c", iconBg: "rgba(251,146,60,.15)",  iconBorder: "rgba(251,146,60,.3)"  },
    copy:       { color: "#94a3b8", iconBg: "rgba(148,163,184,.12)", iconBorder: "rgba(148,163,184,.2)" },
    delete:     { color: "#f87171", iconBg: "rgba(248,113,113,.15)", iconBorder: "rgba(248,113,113,.3)" },
    stage:      { color: "#60a5fa", iconBg: "rgba(96,165,250,.15)",  iconBorder: "rgba(96,165,250,.3)"  },
    texts:      { color: "#c084fc", iconBg: "rgba(192,132,252,.15)", iconBorder: "rgba(192,132,252,.3)" },
    settings:   { color: "#fb923c", iconBg: "rgba(251,146,60,.15)",  iconBorder: "rgba(251,146,60,.3)"  },
  };

  return (
    <div style={{ width: mobile ? "100%" : 64, flexShrink: 0, borderRight: mobile ? "none" : "1px solid #1a2238", borderBottom: mobile ? "1px solid #1a2238" : "none", background: "#141c2e", display: "flex", flexDirection: mobile ? "row" : "column", alignItems: "stretch", gap: 4, padding: mobile ? "8px 8px 6px" : "8px 6px", overflowX: mobile ? "auto" : "visible", overflowY: mobile ? "visible" : "auto" }}>
      {tools.map(tool => {
        const buttonDisabled = disabled || tool.isDisabled;
        const tone = toolToneMap[tool.id] || { color: "#64748b", iconBg: "rgba(148,163,184,.1)", iconBorder: "rgba(148,163,184,.2)" };
        return (
          <button
            key={tool.id}
            title={tool.title}
            onClick={tool.onClick}
            disabled={buttonDisabled}
            style={{
              width: mobile ? "auto" : "100%",
              minWidth: mobile ? 72 : "100%",
              minHeight: mobile ? 42 : 54,
              borderRadius: 8,
              border: `1px solid ${tool.active ? tone.color + "55" : "rgba(255,255,255,.05)"}`,
              background: tool.active ? tone.iconBg : "transparent",
              color: buttonDisabled ? "#2d3a4f" : tone.color,
              cursor: buttonDisabled ? "default" : "pointer",
              fontSize: 9,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: mobile ? 6 : 3,
              padding: mobile ? "6px 10px" : "6px 4px",
              textAlign: "center",
              flexDirection: mobile ? "row" : "column",
              opacity: buttonDisabled ? 0.28 : 1,
              transition: "background .12s, opacity .12s",
            }}
          >
            <span style={{ width: mobile ? 20 : 30, height: mobile ? 20 : 30, borderRadius: 7, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: tool.id === "svg" ? 9 : 12, fontWeight: 800, background: tone.iconBg, border: `1px solid ${tone.iconBorder}`, flexShrink: 0 }}>{tool.icon}</span>
            <span style={{ fontSize: 8, whiteSpace: "nowrap", lineHeight: 1.2, color: buttonDisabled ? "#2d3a4f" : "#475569" }}>{tool.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function SelectionStepShell({ title, subtitle, badge, onBack, children, compact = false }) {
  return (
    <div style={{ flex: 1, minHeight: 0, height: "100%", background: "#161e30", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: compact ? "10px 18px 8px" : "24px 28px 18px", color: "#ffffff", position: "relative", flexShrink: 0, background: "#1e2740", borderBottom: "1px solid #1a2238" }}>
        {badge && <div style={{ position: "absolute", left: compact ? 18 : 24, top: compact ? 10 : 20, fontSize: compact ? 9 : 10, opacity: 0.5, letterSpacing: 0.8, color: "#64748b", textTransform: "uppercase" }}>{badge}</div>}
        {onBack && <button onClick={onBack} style={{ position: "absolute", left: compact ? 18 : 24, top: compact ? 28 : 48, border: "1px solid rgba(255,255,255,.15)", background: "rgba(255,255,255,.07)", color: "rgba(255,255,255,.7)", borderRadius: 6, padding: compact ? "4px 10px" : "6px 14px", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>← Geri</button>}
        <div style={{ textAlign: "center", fontSize: compact ? 18 : 22, fontWeight: 700, lineHeight: 1.2, color: "#e2e8f0" }}>{title}</div>
        {subtitle && <div style={{ textAlign: "center", fontSize: compact ? 10 : 12, color: "#475569", marginTop: compact ? 4 : 8 }}>{subtitle}</div>}
      </div>
      <div style={{ flex: 1, minHeight: 0, padding: compact ? "10px" : "16px" }}>
        <div style={{ height: "100%", minHeight: 0, border: "1px solid #2e3a55", background: "#1e2740", padding: compact ? 10 : 20, boxSizing: "border-box", borderRadius: compact ? 8 : 10, overflow: "hidden" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

const PDF_STATUS_META = {
  ready: { label: "Hazir", color: "#15803d", bg: "#dcfce7", border: "#86efac" },
  review: { label: "Kontrol", color: "#b45309", bg: "#fef3c7", border: "#fcd34d" },
  blocked: { label: "Manuel", color: "#b91c1c", bg: "#fee2e2", border: "#fca5a5" },
};

function SelectionGridLayout({ search, onSearchChange, addLabel, onAdd, children, toolbarExtras = null }) {
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ position: "relative", width: 240, maxWidth: "100%" }}>
          <span style={{ position: "absolute", left: 12, top: 10, fontSize: 14, color: "#334155" }}>⌕</span>
          <input
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Ara"
            style={{ width: "100%", height: 38, borderRadius: 7, border: "1px solid rgba(255,255,255,.1)", background: "#141c2e", color: "#94a3b8", fontSize: 13, padding: "0 12px 0 36px", outline: "none", boxSizing: "border-box" }}
          />
        </div>
        {toolbarExtras}
        <button onClick={onAdd} style={{ minWidth: 180, height: 38, borderRadius: 7, border: "1px solid rgba(99,131,255,.4)", background: "rgba(99,131,255,.18)", color: "#a5b4fc", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          {addLabel}
        </button>
      </div>
      <div style={{ flex: 1, border: "1px solid rgba(255,255,255,.06)", borderRadius: 8, padding: 14, overflowY: "auto", background: "#161e30" }}>
        {children}
      </div>
    </div>
  );
}

function SelectionGridCards({ items, selectedId, onSelect, onEdit, onDelete, emptyText }) {
  if (items.length === 0) {
    return (
      <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#334155", fontSize: 13 }}>
        {emptyText}
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 14 }}>
      {items.map((item, index) => {
        const gradients = [
          ["#22c55e", "#06b6d4"],
          ["#f59e0b", "#ef4444"],
          ["#8b5cf6", "#ec4899"],
          ["#0ea5e9", "#6366f1"],
          ["#14b8a6", "#84cc16"],
        ];
        const [start, end] = gradients[index % gradients.length];
        const isSelected = selectedId === item.id;
        const initial = (item.name || "?").trim().charAt(0).toUpperCase() || "?";
        return (
        <div key={item.id} style={{ position: "relative" }}>
          <button
            onClick={() => onSelect(item.id)}
            style={{ width: "100%", border: "none", background: "transparent", cursor: "pointer", padding: 0 }}
          >
            <div style={{ borderRadius: 8, padding: 10, background: isSelected ? "rgba(99,131,255,.14)" : "rgba(255,255,255,.03)", border: `1px solid ${isSelected ? "rgba(99,131,255,.5)" : "rgba(255,255,255,.08)"}`, transition: "all .15s" }}>
              <div style={{ width: "100%", aspectRatio: "1 / 1", borderRadius: 8, border: `1px solid ${isSelected ? "rgba(99,131,255,.4)" : "rgba(255,255,255,.08)"}`, background: `linear-gradient(135deg,${start},${end})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(255,255,255,.18)", border: "1px solid rgba(255,255,255,.35)", display: "flex", alignItems: "center", justifyContent: "center", color: "#ffffff", fontSize: 24, fontWeight: 800 }}>
                  {initial}
                </div>
              </div>
              <div style={{ marginTop: 10, fontSize: 12, color: isSelected ? "#c7d2fe" : "#64748b", textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: 700 }}>{item.name}</div>
              {item.autoBuildStatus && (
                <div style={{ marginTop: 6, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5, fontSize: 9, fontWeight: 700, color: (PDF_STATUS_META[item.autoBuildStatus] || PDF_STATUS_META.review).color, background: (PDF_STATUS_META[item.autoBuildStatus] || PDF_STATUS_META.review).bg, border: `1px solid ${(PDF_STATUS_META[item.autoBuildStatus] || PDF_STATUS_META.review).border}`, borderRadius: 999, padding: "3px 8px" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: (PDF_STATUS_META[item.autoBuildStatus] || PDF_STATUS_META.review).color }} />
                  {(PDF_STATUS_META[item.autoBuildStatus] || PDF_STATUS_META.review).label}
                </div>
              )}
              {item.automationMeta?.pageCount ? (
                <div style={{ marginTop: 4, fontSize: 9, color: "#334155", textAlign: "center" }}>
                  {item.automationMeta.pageCount} slide · {item.automationMeta.kind}
                </div>
              ) : null}
            </div>
          </button>
          <div style={{ position: "absolute", top: 14, right: 14, display: "flex", gap: 4 }}>
            <button onClick={e => { e.stopPropagation(); onEdit(item); }} style={{ width: 24, height: 24, borderRadius: 5, border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.08)", color: "#94a3b8", cursor: "pointer", fontSize: 10, fontWeight: 700 }}>E</button>
            <button onClick={e => { e.stopPropagation(); onDelete(item.id); }} style={{ width: 24, height: 24, borderRadius: 5, border: "1px solid rgba(248,113,113,.2)", background: "rgba(248,113,113,.1)", color: "#f87171", cursor: "pointer", fontSize: 10, fontWeight: 700 }}>×</button>
          </div>
        </div>
      )})}
    </div>
  );
}

function BookPreviewStudioPage({
  book,
  previewTemplates = [],
  onBack,
  onSaveBookPreview,
  onSaveTemplate,
  onApplyTemplate,
}) {
  const [draft, setDraft] = useState(null);
  const [templateName, setTemplateName] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [previewKey, setPreviewKey] = useState(0);

  useEffect(() => {
    if (!book) return;
    setDraft(normalizeActivity(book.previewDocument || createBookPreviewDocument(book.name || "Kitap", book.buttonPackageId || BUTTON_PACKAGES[0].id)));
    setTemplateName(book?.name ? `${book.name} Önizleme` : "");
    setTemplateId("");
    setPreviewKey(key => key + 1);
  }, [book]);

  if (!book || !draft) return null;

  const slides = getActivitySlides(draft);
  const panelCard = { borderRadius: 16, border: "1px solid #dbe4f0", background: "#ffffff", boxShadow: "0 10px 30px rgba(15,23,42,.06)" };
  const sectionEyebrow = { fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748b" };
  const lightInput = { width: "100%", height: 34, borderRadius: 10, border: "1px solid #cbd5e1", background: "#f8fafc", color: "#0f172a", fontSize: 13, padding: "0 10px", boxSizing: "border-box", outline: "none" };
  const footerBtn = { display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 34, borderRadius: 10, border: "1px solid #cbd5e1", background: "#ffffff", color: "#334155", fontSize: 12, fontWeight: 700, cursor: "pointer", padding: "0 12px", boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)" };
  const primaryBtn = { ...footerBtn, background: "#10b981", borderColor: "#10b981", color: "#ffffff" };

  return (
    <div style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column", gap: 12, overflow: "hidden", padding: 2, background: "#f1f5f9", fontFamily: '"Inter", "Segoe UI", Roboto, Arial, sans-serif' }}>
      <div style={{ ...panelCard, padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: "1 1 320px" }}>
          <button onClick={onBack} style={{ ...footerBtn, borderRadius: 999, padding: "0 14px" }}>← Geri Dön</button>
          <div style={{ minWidth: 0 }}>
            <div style={{ ...sectionEyebrow, color: "#4f46e5" }}>Kitap Önizlemesi</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{book.name}</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end", flex: "1 1 520px" }}>
          <input value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="Önizleme adı" style={{ ...lightInput, width: 180 }} />
          <button onClick={() => onSaveTemplate(templateName.trim(), draft)} disabled={!templateName.trim()} style={{ ...footerBtn, opacity: templateName.trim() ? 1 : 0.55 }}>Kaydet</button>
          <select value={templateId} onChange={e => setTemplateId(e.target.value)} style={{ ...lightInput, width: 190, cursor: "pointer" }}>
            <option value="">Kayıtlı önizleme seç</option>
            {previewTemplates.map(template => <option key={template.id} value={template.id}>{template.name}</option>)}
          </select>
          <button onClick={() => { if (!templateId) return; const next = onApplyTemplate(templateId, book); if (next) { setDraft(next); setPreviewKey(key => key + 1); } }} disabled={!templateId} style={{ ...footerBtn, opacity: templateId ? 1 : 0.55 }}>Yükle</button>
          <button onClick={() => onSaveBookPreview({ ...book, previewDocument: draft })} style={primaryBtn}>Uygula</button>
        </div>
      </div>

      <div style={{ ...panelCard, padding: "12px 14px", background: "linear-gradient(135deg,#eff6ff,#f8fafc)", borderColor: "#bfdbfe", flexShrink: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#1d4ed8", marginBottom: 4 }}>Manuel düzenleme kaldırıldı</div>
        <div style={{ fontSize: 13, lineHeight: 1.6, color: "#475569" }}>
          Kitap bölümündeki önizleme düzenleme alanı kaldırıldı. Bu ekran artık doğrudan öğrenci görünümünü gösterir ve kaydırmalı / yarım görüntü sorunlarını azaltılmış düzenle sunar.
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "280px minmax(0,1fr)", gap: 12, overflow: "hidden" }}>
        <div style={{ ...panelCard, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "12px 14px", borderBottom: "1px solid #eef2f7" }}>
            <div style={sectionEyebrow}>Önizleme Akışı</div>
          </div>
          <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8, overflowY: "auto" }}>
            {slides.map((slide, index) => (
              <div key={slide.id} style={{ padding: "10px 12px", borderRadius: 12, border: `1px solid ${slide.id === draft.currentSlideId ? "#93c5fd" : "#e2e8f0"}`, background: slide.id === draft.currentSlideId ? "#eff6ff" : "#ffffff" }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#0f172a" }}>{index + 1}. {slide.name || `Ekran ${index + 1}`}</div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>{slide.sceneName || "Önizleme sahnesi"}</div>
              </div>
            ))}
            {!slides.length && <div style={{ fontSize: 12, color: "#94a3b8" }}>Önizleme sahnesi bulunamadı.</div>}
          </div>
        </div>

        <div style={{ ...panelCard, minHeight: 0, overflow: "hidden", background: "#0f172a", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(148,163,184,.16)", color: "#e2e8f0", flexShrink: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase", color: "#7dd3fc" }}>Öğrenci Önizlemesi</div>
            <div style={{ fontSize: 12, marginTop: 4, color: "#cbd5e1" }}>Kitap açılışı ve menü akışı doğrudan burada izlenir.</div>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflow: "hidden", padding: "16px 12px" }}>
            <PreviewSelectionFlow
              key={previewKey}
              activity={draft}
              activities={[draft]}
              hasNextActivity={false}
              hasNextStep={false}
              nextStepLabel=""
              onNextActivity={() => {}}
              onNextStep={() => {}}
              onGoToActivity={() => {}}
              onGoToSlide={() => {}}
              variableDefinitions={[]}
              runtimeVariables={{}}
              setRuntimeVariables={() => {}}
              previewCommand={null}
              developerHintMode={false}
              onPhaseChange={() => {}}
              onDebugDataChange={() => {}}
              previewViewport={{ width: 1160, height: 680 }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Yayınevi Paneli ──────────────────────────────────────────────────────────

function PublisherPanel({ publishers, selId, onSelect, onChange }) {
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");
  const filtered = publishers.filter(p => (p.name || "").toLowerCase().includes(search.trim().toLowerCase()));
  const add = () => { if (!name.trim()) return; onChange([...publishers, { id: uid(), name: name.trim(), description: "" }]); setName(""); setShowModal(false); };
  const remove = (id) => onChange(publishers.filter(p => p.id !== id));
  const save = (id) => { onChange(publishers.map(p => p.id === id ? { ...p, name: editName.trim() || p.name } : p)); setEditId(null); };
  return (
    <>
      <SelectionGridLayout search={search} onSearchChange={setSearch} addLabel="Yeni Yayınevi Ekle" onAdd={() => setShowModal(true)}>
        <SelectionGridCards
          items={filtered}
          selectedId={selId}
          onSelect={onSelect}
          onEdit={(item) => { setEditId(item.id); setEditName(item.name); }}
          onDelete={remove}
          emptyText="Yayınevi ekleyin."
        />
      </SelectionGridLayout>
      {showModal && (
        <Modal title="Yeni Yayınevi" onClose={() => setShowModal(false)} width={420}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Inp label="Yayınevi Adı" value={name} onChange={e => setName(e.target.value)} placeholder="Yayınevi adı..." />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Btn onClick={() => setShowModal(false)} color="#555">İptal</Btn>
              <Btn onClick={add} color="#7C4DFF" disabled={!name.trim()}>Ekle</Btn>
            </div>
          </div>
        </Modal>
      )}
      {editId && (
        <Modal title="Yayınevini Düzenle" onClose={() => setEditId(null)} width={420}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Inp label="Yayınevi Adı" value={editName} onChange={e => setEditName(e.target.value)} placeholder="Yayınevi adı..." />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Btn onClick={() => setEditId(null)} color="#555">İptal</Btn>
              <Btn onClick={() => save(editId)} color="#7C4DFF" disabled={!editName.trim()}>Kaydet</Btn>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

function BookPanel({ books, selPubId, selId, onSelect, onChange, currentProjectId, activities, onActivitiesChange, onOpenPreviewEditor = () => {} }) {
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [search, setSearch] = useState("");
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfMessage, setPdfMessage] = useState("");
  const [pdfError, setPdfError] = useState("");
  const [pdfLogs, setPdfLogs] = useState([]);
  const [pdfStatusOpen, setPdfStatusOpen] = useState(false);
  const pdfInputRef = useRef(null);
  const pushPdfStatus = useCallback((message, tone = "info") => {
    const entry = createPdfStatusEntry(message, tone);
    if (!entry.message) return null;
    setPdfMessage(entry.message);
    setPdfLogs((prev) => {
      if (prev[prev.length - 1]?.message === entry.message && prev[prev.length - 1]?.tone === entry.tone) {
        return prev;
      }
      return [...prev.slice(-11), entry];
    });
    return entry;
  }, []);
  const filtered = books.filter(b => b.publisherId === selPubId);
  const searched = filtered.filter(b => (b.name || "").toLowerCase().includes(search.trim().toLowerCase()));
  const selectedBook = books.find(book => book.id === selId) || null;
  const selectedBookImports = selectedBook?.pdfImports || [];
  const add = () => {
    if (!newName.trim()) return;
    const name = newName.trim();
    const defaultPackageId = BUTTON_PACKAGES[0]?.id || "pkg-1";
    onChange([...books, normalizeBook({ id: uid(), publisherId: selPubId, name, description: "", buttonPackageId: defaultPackageId, previewDocument: createBookPreviewDocument(name, defaultPackageId) })]);
    setNewName("");
    setShowModal(false);
  };
  const remove = (id) => onChange(books.filter(b => b.id !== id));
  const save = (id) => { onChange(books.map(b => b.id === id ? { ...b, name: editName.trim() || b.name } : b)); setEditId(null); };

  const handlePdfImport = async (file) => {
    if (!file) return;
    if (!selId) {
      alert("Once PDF eklemek istedigin kitabi sec.");
      return;
    }
    const importLogs = [];
    const logProgress = (message, tone = "info") => appendPdfImportLog(importLogs, pushPdfStatus(message, tone));
    setPdfBusy(true);
    setPdfStatusOpen(true);
    setPdfError("");
    setPdfLogs([]);
    logProgress("PDF analiz baslatildi...", "info");
    try {
      const analysis = await analyzePdfFile(file, logProgress);
      logProgress("Etkinlik taslaklari olusturuluyor...", "info");
      const result = buildPdfDraftActivities(selId, analysis);
      logProgress(`${result.activities.length} etkinlik taslagi hazirlandi.`, "success");
      const record = { ...result.record, logs: importLogs.slice(-40) };
      onActivitiesChange([...(activities || []), ...result.activities]);
      onChange(books.map(book => book.id === selId ? { ...book, pdfImports: [...(book.pdfImports || []), record] } : book));
    } catch (error) {
      const message = error.message || "PDF analizi basarisiz oldu.";
      setPdfError(message);
      logProgress(message, "error");
    } finally {
      setPdfBusy(false);
      if (pdfInputRef.current) pdfInputRef.current.value = "";
    }
  };

  if (!selPubId) return <div style={{ fontSize: 10, color: "#444", textAlign: "center", padding: 8 }}>Yayınevi seçin</div>;
  return (
    <>
      <PdfImportStatusModal
        open={pdfStatusOpen}
        busy={pdfBusy}
        message={pdfMessage}
        error={pdfError}
        logs={pdfLogs}
        onClose={() => setPdfStatusOpen(false)}
      />
      <SelectionGridLayout
        search={search}
        onSearchChange={setSearch}
        addLabel="Yeni Kitap Ekle"
        onAdd={() => setShowModal(true)}
        toolbarExtras={(
          <>
            <input ref={pdfInputRef} type="file" accept="application/pdf,.pdf" style={{ display: "none" }} onChange={e => handlePdfImport(e.target.files?.[0])} />
            <button
              onClick={() => pdfInputRef.current?.click()}
              disabled={!selId || pdfBusy}
              title={!selId ? "Once bir kitap sec" : "PDF dosyasi ekle"}
              style={{ minWidth: 190, height: 46, borderRadius: 16, border: `1px solid ${!selId ? "#fed7aa" : "#c7d2fe"}`, background: !selId ? "linear-gradient(135deg,#fff7ed,#ffffff)" : pdfBusy ? "#eef2ff" : "linear-gradient(135deg,#eef2ff,#ffffff)", color: !selId ? "#c2410c" : "#4338ca", fontSize: 13, fontWeight: 800, cursor: !selId || pdfBusy ? "default" : "pointer", boxShadow: "0 12px 28px rgba(67,56,202,.12)", opacity: !selId || pdfBusy ? 0.72 : 1 }}
            >
              {pdfBusy ? "PDF Çözümleniyor..." : !selId ? "Once Kitap Sec" : "PDF Iceri Al"}
            </button>
          </>
        )}
      >
        <SelectionGridCards
          items={searched}
          selectedId={selId}
          onSelect={onSelect}
          onEdit={(item) => { setEditId(item.id); setEditName(item.name); }}
          onDelete={remove}
          emptyText="Kitap ekleyin."
        />
      </SelectionGridLayout>

      {(!selId || pdfBusy || pdfError || selectedBookImports.length > 0) && (
        <div style={{ marginTop: 14, border: "1px solid #d7e0eb", borderRadius: 20, background: "linear-gradient(180deg,#ffffff,#f8fbff)", padding: 16, boxShadow: "0 12px 28px rgba(15,23,42,.06)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>PDF Otomasyon Sonuclari</div>
            {selectedBook ? (
              <div style={{ fontSize: 11, color: "#64748b" }}>{selectedBook.name}</div>
            ) : (
              <div style={{ fontSize: 11, color: "#b45309" }}>PDF iceri almak icin once bir kitap sec.</div>
            )}
          </div>
          {!selId && <div style={{ fontSize: 11, color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 12, padding: "10px 12px", marginBottom: 8 }}>Sol taraftan bir kitap secildiginde PDF Iceri Al butonu aktif olur.</div>}
          {pdfBusy && <div style={{ fontSize: 11, color: "#4338ca", marginBottom: 8 }}>{pdfMessage || "PDF analiz ediliyor..."}</div>}
          {!pdfBusy && !pdfError && pdfMessage && <div style={{ fontSize: 11, color: "#0f766e", background: "#ecfeff", border: "1px solid #a5f3fc", borderRadius: 12, padding: "8px 10px", marginBottom: 8 }}>{pdfMessage}</div>}
          {pdfError && <div style={{ fontSize: 11, color: "#b91c1c", marginBottom: 8 }}>{pdfError}</div>}
          {selectedBookImports.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[...selectedBookImports].slice().reverse().map(importItem => (
                <div key={importItem.id} style={{ border: "1px solid #e2e8f0", borderRadius: 16, padding: 12, background: "#ffffff" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#0f172a" }}>{importItem.fileName}</div>
                    <div style={{ fontSize: 10, color: "#64748b" }}>{new Date(importItem.createdAt).toLocaleString("tr-TR")}</div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 8 }}>
                    {(importItem.items || []).map(item => {
                      const meta = PDF_STATUS_META[item.status] || PDF_STATUS_META.review;
                      return (
                        <div key={item.id} style={{ border: `1px solid ${meta.border}`, borderRadius: 14, padding: 10, background: meta.bg }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 800, color: meta.color, marginBottom: 6 }}>
                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: meta.color }} />
                            {item.label}
                          </div>
                          <div style={{ fontSize: 11, color: "#0f172a", fontWeight: 700 }}>{item.kind}</div>
                          <div style={{ fontSize: 10, color: "#475569", marginTop: 4 }}>
                            {item.pageCount} sayfa · {item.startPage}-{item.endPage}
                            {item.interactionType ? ` · ${item.interactionType}` : ""}
                            {item.extractedItemCount ? ` · ${item.extractedItemCount} oge` : ""}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <PdfImportLogPanel importItem={importItem} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showModal && (
        <Modal title="Yeni Kitap" onClose={() => setShowModal(false)} width={500}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Inp label="Kitap Adi" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Kitap adini girin..." />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Btn onClick={() => setShowModal(false)} color="#555">İptal</Btn>
              <Btn onClick={add} color="#00BCD4" disabled={!newName.trim()}>Ekle</Btn>
            </div>
          </div>
        </Modal>
      )}
      {editId && (
        <Modal title="Kitabı Düzenle" onClose={() => setEditId(null)} width={420}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Inp label="Kitap Adi" value={editName} onChange={e => setEditName(e.target.value)} placeholder="Kitap adi..." />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Btn onClick={() => setEditId(null)} color="#555">İptal</Btn>
              <Btn onClick={() => save(editId)} color="#00BCD4" disabled={!editName.trim()}>Kaydet</Btn>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

function ActivityPanel({ activities, books, selBookId, selId, onSelect, onChange, onBooksChange, onOpenPreviewEditor = () => {} }) {
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("selection");
  const [search, setSearch] = useState("");
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfMessage, setPdfMessage] = useState("");
  const [pdfError, setPdfError] = useState("");
  const [pdfLogs, setPdfLogs] = useState([]);
  const [pdfStatusOpen, setPdfStatusOpen] = useState(false);
  const pdfInputRef = useRef(null);
  const pushPdfStatus = useCallback((message, tone = "info") => {
    const entry = createPdfStatusEntry(message, tone);
    if (!entry.message) return null;
    setPdfMessage(entry.message);
    setPdfLogs((prev) => {
      if (prev[prev.length - 1]?.message === entry.message && prev[prev.length - 1]?.tone === entry.tone) {
        return prev;
      }
      return [...prev.slice(-11), entry];
    });
    return entry;
  }, []);
  const filtered = activities.filter(a => a.bookId === selBookId);
  const searched = filtered.filter(a => (a.name || "").toLowerCase().includes(search.trim().toLowerCase()));
  const selectedBook = books.find(book => book.id === selBookId) || null;
  const selectedBookImports = selectedBook?.pdfImports || [];
  const add = () => {
    if (!newName.trim()) return;
    const a = createActivity(newName.trim(), newType);
    a.bookId = selBookId;
    onChange([...activities, a]);
    onSelect(a.id);
    setNewName(""); setNewType("selection"); setShowModal(false);
  };
  const remove = (id) => { onChange(activities.filter(a => a.id !== id)); if (selId === id) onSelect(null); };
  const save = (id) => { onChange(activities.map(a => a.id === id ? { ...a, name: editName.trim() || a.name } : a)); setEditId(null); };
  const handlePdfImport = async (file) => {
    if (!file || !selBookId) return;
    const importLogs = [];
    const logProgress = (message, tone = "info") => appendPdfImportLog(importLogs, pushPdfStatus(message, tone));
    setPdfBusy(true);
    setPdfStatusOpen(true);
    setPdfError("");
    setPdfLogs([]);
    logProgress("PDF analiz baslatildi...", "info");
    try {
      const analysis = await analyzePdfFile(file, logProgress);
      logProgress("Etkinlik taslaklari olusturuluyor...", "info");
      const result = buildPdfDraftActivities(selBookId, analysis);
      logProgress(`${result.activities.length} etkinlik taslagi hazirlandi.`, "success");
      const record = { ...result.record, logs: importLogs.slice(-40) };
      onChange([...(activities || []), ...result.activities]);
      onBooksChange(books.map(book => book.id === selBookId ? { ...book, pdfImports: [...(book.pdfImports || []), record] } : book));
    } catch (error) {
      const message = error.message || "PDF analizi basarisiz oldu.";
      setPdfError(message);
      logProgress(message, "error");
    } finally {
      setPdfBusy(false);
      if (pdfInputRef.current) pdfInputRef.current.value = "";
    }
  };
  if (!selBookId) return <div style={{ fontSize: 10, color: "#444", textAlign: "center", padding: 8 }}>Kitap secin</div>;
  return (
    <>
      <PdfImportStatusModal
        open={pdfStatusOpen}
        busy={pdfBusy}
        message={pdfMessage}
        error={pdfError}
        logs={pdfLogs}
        onClose={() => setPdfStatusOpen(false)}
      />
      <SelectionGridLayout
        search={search}
        onSearchChange={setSearch}
        addLabel="Yeni Etkinlik Ekle"
        onAdd={() => setShowModal(true)}
        toolbarExtras={(
          <>
            <input ref={pdfInputRef} type="file" accept="application/pdf,.pdf" style={{ display: "none" }} onChange={e => handlePdfImport(e.target.files?.[0])} />
            <button
              onClick={() => pdfInputRef.current?.click()}
              disabled={pdfBusy}
              style={{ minWidth: 190, height: 46, borderRadius: 16, border: "1px solid #c7d2fe", background: pdfBusy ? "#eef2ff" : "linear-gradient(135deg,#eef2ff,#ffffff)", color: "#4338ca", fontSize: 13, fontWeight: 800, cursor: pdfBusy ? "default" : "pointer", boxShadow: "0 12px 28px rgba(67,56,202,.12)", opacity: pdfBusy ? 0.72 : 1 }}
              title="Secili kitap icin PDF dosyasi ekle"
            >
              {pdfBusy ? "PDF Çözümleniyor..." : "PDF Iceri Al"}
            </button>
          </>
        )}
      >
        <SelectionGridCards
          items={searched}
          selectedId={selId}
          onSelect={onSelect}
          onEdit={(item) => { setEditId(item.id); setEditName(item.name); }}
          onDelete={remove}
          emptyText="Etkinlik ekleyin."
        />
      </SelectionGridLayout>
      {(pdfBusy || pdfError || selectedBookImports.length > 0) && (
        <div style={{ marginTop: 14, border: "1px solid #d7e0eb", borderRadius: 20, background: "linear-gradient(180deg,#ffffff,#f8fbff)", padding: 16, boxShadow: "0 12px 28px rgba(15,23,42,.06)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>PDF Otomasyon Sonuclari</div>
            <div style={{ fontSize: 11, color: "#64748b" }}>{selectedBook?.name || "Secili kitap"}</div>
          </div>
          {pdfBusy && <div style={{ fontSize: 11, color: "#4338ca", marginBottom: 8 }}>{pdfMessage || "PDF analiz ediliyor..."}</div>}
          {!pdfBusy && !pdfError && pdfMessage && <div style={{ fontSize: 11, color: "#0f766e", background: "#ecfeff", border: "1px solid #a5f3fc", borderRadius: 12, padding: "8px 10px", marginBottom: 8 }}>{pdfMessage}</div>}
          {pdfError && <div style={{ fontSize: 11, color: "#b91c1c", marginBottom: 8 }}>{pdfError}</div>}
          {selectedBookImports.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 11, color: "#475569" }}>{selectedBookImports.length} PDF analiz kaydi bulundu.</div>
              {[...selectedBookImports].slice().reverse().slice(0, 2).map(importItem => (
                <PdfImportLogPanel key={importItem.id} importItem={importItem} />
              ))}
            </div>
          )}
        </div>
      )}
      {showModal && (
        <Modal title="Yeni Etkinlik" onClose={() => setShowModal(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Inp label="Etkinlik Adi" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Etkinlik adi..." />
            <div>
              <label style={{ fontSize: 10, color: "#78909C", display: "block", marginBottom: 8 }}>Etkinlik Turu</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {ACTIVITY_TYPES.map(at => (
                  <div key={at.id} onClick={() => setNewType(at.id)} style={{ padding: "10px 14px", borderRadius: 8, cursor: "pointer", border: `1px solid ${newType === at.id ? "#4CAF50" : "#333"}`, background: newType === at.id ? "#4CAF5022" : "#1a1a30" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 18 }}>{at.icon}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: newType === at.id ? "#4CAF50" : "#E0E0E0" }}>{at.label}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Btn onClick={() => setShowModal(false)} color="#555">İptal</Btn>
              <Btn onClick={add} color="#4CAF50" disabled={!newName.trim()}>Ekle</Btn>
            </div>
          </div>
        </Modal>
      )}
      {editId && (
        <Modal title="Etkinliği Düzenle" onClose={() => setEditId(null)} width={420}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Inp label="Etkinlik Adi" value={editName} onChange={e => setEditName(e.target.value)} placeholder="Etkinlik adi..." />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Btn onClick={() => setEditId(null)} color="#555">İptal</Btn>
              <Btn onClick={() => save(editId)} color="#4CAF50" disabled={!editName.trim()}>Kaydet</Btn>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

function ProjectVersionManagerModal({
  open,
  onClose,
  dbStatus,
  currentProject,
  currentProjectId,
  projectNameDraft,
  onProjectNameChange,
  onSaveProjectName,
  newProjectName,
  onNewProjectNameChange,
  onCreateProject,
  projects,
  onSwitchProject,
  onDeleteProject,
  onDuplicateProject,
  versionLabel,
  onVersionLabelChange,
  onCreateVersion,
  onPublishVersion,
  versions,
  onRestoreVersion,
  onDeleteVersion,
  activityCount,
  books,
}) {
  if (!open) return null;

  const dbReady = dbStatus === "connected";
  const apiBase = typeof getApiBase === "function" ? getApiBase() : "";

  return (
    <Modal title="Proje ve Surumler" onClose={onClose} width={1100}>
      <div style={{ display: "grid", gridTemplateColumns: "1.1fr .9fr", gap: 18 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Active project */}
          <div style={{ background: "#111125", border: "1px solid #252540", borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#00BCD4", marginBottom: 10 }}>AKTIF PROJE</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                <div style={{ flex: 1 }}>
                  <Inp label="Proje Adi" value={projectNameDraft} onChange={e => onProjectNameChange(e.target.value)} placeholder="Proje adi..." />
                </div>
                <Btn onClick={onSaveProjectName} color="#00BCD4" disabled={!dbReady || !currentProject}>Kaydet</Btn>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, fontSize: 11, color: "#94a3b8" }}>
                <span>ID: {currentProject?.id?.slice(0, 8) || "-"}</span>
                <span>Aktivite: {activityCount}</span>
                <span>Taslak: {currentProject?.draftUpdatedAt ? new Date(currentProject.draftUpdatedAt).toLocaleString("tr-TR") : "-"}</span>
                <span style={{ color: currentProject?.publishedVersionId ? "#4CAF50" : "#667085" }}>
                  {currentProject?.publishedVersionId ? "Yayinda" : "Yayinda degil"}
                </span>
              </div>
              {currentProjectId && dbReady && (
                <div style={{ fontSize: 11, color: "#94a3b8", background: "#0a0d1f", border: "1px solid #1a2540", borderRadius: 10, padding: 10 }}>
                  Harici SCORM indirme kaldırıldı. Proje artık yalnızca editör ve FTP yayın akışıyla devam eder.
                </div>
              )}
              {!dbReady && <div style={{ fontSize: 11, color: "#f59e0b" }}>Veritabanı baglantisi yoksa surumleme ozellikleri pasif kalir.</div>}
            </div>
          </div>

          {/* New project */}
          <div style={{ background: "#111125", border: "1px solid #252540", borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#B388FF", marginBottom: 10 }}>YENI PROJE</div>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}>
                <Inp label="Bos Proje Adi" value={newProjectName} onChange={e => onNewProjectNameChange(e.target.value)} placeholder="Yeni proje..." />
              </div>
              <Btn onClick={onCreateProject} color="#7C4DFF" disabled={!dbReady}>Olustur</Btn>
            </div>
          </div>

          {/* Version create */}
          <div style={{ background: "#111125", border: "1px solid #252540", borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#4CAF50", marginBottom: 10 }}>SURUM OLUSTUR</div>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}>
                <Inp label="Etiket" value={versionLabel} onChange={e => onVersionLabelChange(e.target.value)} placeholder="Orn. Beta 1 / Nisan Guncellemesi" />
              </div>
              <Btn onClick={() => onCreateVersion(false)} color="#4CAF50" disabled={!dbReady || !currentProject}>Surum Al</Btn>
              <Btn onClick={() => onCreateVersion(true)} color="#FF9800" disabled={!dbReady || !currentProject}>Yayinla</Btn>
            </div>
          </div>

          {/* Version history */}
          <div style={{ background: "#111125", border: "1px solid #252540", borderRadius: 12, padding: 14, minHeight: 200 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#E0E0E0", marginBottom: 10 }}>SURUM GECMISI</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 320, overflowY: "auto", paddingRight: 4 }}>
              {versions.length ? versions.map(version => (
                <div key={version.id} style={{ border: `1px solid ${version.isPublished ? "#FF9800" : "#252540"}`, background: version.isPublished ? "#FF980014" : "#0d0d1a", borderRadius: 10, padding: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: version.isPublished ? "#FFB74D" : "#E2E8F0" }}>
                        v{version.versionNo} · {version.label}
                        {version.isPublished && <span style={{ marginLeft: 6, fontSize: 9, padding: "2px 6px", borderRadius: 999, background: "#FF980022", color: "#FFB74D", border: "1px solid #FF9800" }}>Yayinda</span>}
                      </div>
                      <div style={{ fontSize: 10, color: "#78909C", marginTop: 3 }}>
                        {new Date(version.createdAt).toLocaleString("tr-TR")}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 5, alignItems: "center", flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <Btn onClick={() => onRestoreVersion(version.id)} color="#00BCD4" small disabled={!dbReady}>Geri Yükle</Btn>
                      {!version.isPublished && <Btn onClick={() => onPublishVersion(version.id)} color="#FF9800" small disabled={!dbReady}>Yayinla</Btn>}
                      <Btn onClick={() => onDeleteVersion(version.id)} color="#f44336" small disabled={!dbReady}>Sil</Btn>
                    </div>
                  </div>
                </div>
              )) : (
                <div style={{ fontSize: 11, color: "#667085", textAlign: "center", padding: "24px 12px", border: "1px dashed #2a314b", borderRadius: 10 }}>
                  Henuz surum alinmadi.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Projects list */}
        <div style={{ background: "#111125", border: "1px solid #252540", borderRadius: 12, padding: 14, minHeight: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#E0E0E0", marginBottom: 10 }}>PROJELER ({projects.length})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowY: "auto", maxHeight: 640, paddingRight: 4 }}>
            {projects.length ? projects.map(project => {
              const isCurrent = project.id === currentProject?.id;
              return (
                <div key={project.id} style={{ border: `1px solid ${isCurrent ? "#00BCD4" : "#252540"}`, background: isCurrent ? "#00BCD412" : "#0d0d1a", borderRadius: 10, padding: 12 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: isCurrent ? "#67e8f9" : "#E2E8F0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {isCurrent && <span style={{ fontSize: 9, marginRight: 5, padding: "2px 5px", background: "#00BCD422", border: "1px solid #00BCD4", borderRadius: 4, color: "#00BCD4" }}>Aktif</span>}
                        {project.name}
                      </div>
                      <div style={{ fontSize: 10, color: "#78909C", marginTop: 4 }}>Taslak: {new Date(project.draftUpdatedAt).toLocaleString("tr-TR")}</div>
                      {project.publishedVersionId && (
                        <div style={{ fontSize: 10, color: "#4CAF50", marginTop: 2 }}>Yayinda surumu var</div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 5, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      {!isCurrent && <Btn onClick={() => onSwitchProject(project.id)} color="#00BCD4" small disabled={!dbReady}>Ac</Btn>}
                      <Btn onClick={() => onDuplicateProject(project.id, project.name)} color="#9C27B0" small disabled={!dbReady}>Çoğalt</Btn>
                      <Btn onClick={() => onDeleteProject(project.id)} color="#f44336" small disabled={!dbReady || projects.length <= 1}>Sil</Btn>
                    </div>
                  </div>
                </div>
              );
            }) : (
              <div style={{ fontSize: 11, color: "#667085", textAlign: "center", padding: "24px 12px", border: "1px dashed #2a314b", borderRadius: 10 }}>
                Henuz proje yok.
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── ANA UYGULAMA ─────────────────────────────────────────────────────────────

const EMPTY = { publishers: [], books: [], previewTemplates: [], textStudioPresets: [], variables: [], activities: [], selPubId: null, selBookId: null, selActId: null, lmsConfig: { ...DEFAULT_LMS_CONFIG } };

export default function EIcerikEditor() {
  const [history, setHistory] = useState(() => {
    try { const r = localStorage.getItem(STORAGE_KEY); if (r) return { past: [], present: normalizeState(JSON.parse(r)), future: [] }; } catch {}
    return { past: [], present: normalizeState(EMPTY), future: [] };
  });
  const [lastSaved, setLastSaved] = useState(null);
  const [dbStatus, setDbStatus] = useState("connecting");
  const [activeTab, setActiveTab] = useState("nesneler");
  const [previewMode, setPreviewMode] = useState(false);
  const [zoom, setZoom] = useState("fit");
  const [panelScale, setPanelScale] = useState(1);
  const [timelineHeight, setTimelineHeight] = useState(260);
  const [timelineCurrentTime, setTimelineCurrentTime] = useState(0);
  const [timelinePlaying, setTimelinePlaying] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(196);
  const [rightPanelWidth, setRightPanelWidth] = useState(388);
  const [isSlidePanelCollapsed, setIsSlidePanelCollapsed] = useState(false);
  const [uiMode, setUiMode] = useState("basic");
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window !== "undefined" ? window.innerWidth : 1280));
  const [workspaceInfo, setWorkspaceInfo] = useState({ currentProject: null, projects: [], versions: [] });
  const [showProjectManager, setShowProjectManager] = useState(false);
  const [isTextStudioMode, setIsTextStudioMode] = useState(() => (typeof window !== "undefined" ? window.location.hash === "#text-studio" : false));
  const [projectNameDraft, setProjectNameDraft] = useState("");
  const [newProjectName, setNewProjectName] = useState("");
  const [versionLabel, setVersionLabel] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [answerPreview, setAnswerPreview] = useState(null);
  const canvasRef = useRef(null);
  const editorScrollRef = useRef(null);
  const mobileInspectorRef = useRef(null);
  const importRef = useRef(null);
  const remoteReadyRef = useRef(false);
  const skipRemoteSaveRef = useRef(false);
  const lastRemoteUpdatedAtRef = useRef(null);
  const resizeSessionRef = useRef(null);

  const present = history.present;
  const currentProject = workspaceInfo.currentProject;
  const currentProjectId = currentProject?.id || null;
  const isMobileViewport = viewportWidth <= 980;
  const isCompactViewport = viewportWidth <= 720;
  const effectivePanelScale = isMobileViewport ? 1 : panelScale;
  const currentZoomPercent = useMemo(() => {
    const selectedActivity = present.activities.find(item => item.id === present.selActId);
    if (!selectedActivity) return 100;
    const stageWidth = selectedActivity.stageWidth || 1920;
    const stageHeight = selectedActivity.stageHeight || 1080;
    const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 760;
    const estimatedWidth = Math.max(260, viewportWidth - (isMobileViewport ? 40 : leftPanelWidth + rightPanelWidth + 140));
    const estimatedHeight = Math.max(240, viewportHeight - timelineHeight - (isMobileViewport ? 220 : 210));
    const fitScale = getFitScale(stageWidth, stageHeight, estimatedWidth - 20, estimatedHeight - 52);
    const resolvedScale = zoom === "fit" ? fitScale : Number(zoom) || fitScale;
    return Math.round(resolvedScale * 100);
  }, [isMobileViewport, leftPanelWidth, present.activities, present.selActId, rightPanelWidth, timelineHeight, viewportWidth, zoom]);
  const adjustStageZoom = useCallback((delta) => {
    setZoom(current => {
      const currentScale = current === "fit" ? currentZoomPercent / 100 : Number(current) || 1;
      return clamp(Number((currentScale + delta).toFixed(2)), 0.1, 4);
    });
  }, [currentZoomPercent]);

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const handleHashChange = () => setIsTextStudioMode(window.location.hash === "#text-studio");
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      try {
        const next = normalizeState(JSON.parse(event.newValue));
        setHistory(prev => JSON.stringify(prev.present) === JSON.stringify(next) ? prev : { ...prev, present: next });
      } catch {}
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const commit = useCallback((updater) => {
    setHistory(h => {
      const next = typeof updater === "function" ? updater(h.present) : updater;
      if (Object.is(next, h.present)) return h;
      return { past: [...h.past.slice(-39), h.present], present: next, future: [] };
    });
  }, []);

  const undo = useCallback(() => setHistory(h => h.past.length ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future].slice(0, 40) } : h), []);
  const redo = useCallback(() => setHistory(h => h.future.length ? { past: [...h.past, h.present].slice(-40), present: h.future[0], future: h.future.slice(1) } : h), []);

  const syncWorkspaceMeta = useCallback((workspace) => {
    if (!workspace) return;
    const nextCurrentProject = workspace.currentProject || null;
    setWorkspaceInfo({
      currentProject: nextCurrentProject,
      projects: Array.isArray(workspace.projects) ? workspace.projects : [],
      versions: Array.isArray(workspace.versions) ? workspace.versions : [],
    });
    setProjectNameDraft(prev => {
      if (nextCurrentProject?.id && nextCurrentProject.id === currentProjectId) {
        return prev || nextCurrentProject.name || "";
      }
      return nextCurrentProject?.name || "";
    });
  }, [currentProjectId]);

  const loadWorkspaceState = useCallback((workspace) => {
    syncWorkspaceMeta(workspace);
    skipRemoteSaveRef.current = true;
    setHistory({ past: [], present: normalizeState({ ...EMPTY, ...(workspace?.state || EMPTY) }), future: [] });
    setSelectedIds(new Set());
    setPreviewMode(false);
    setActiveTab("nesneler");
    setTimelineCurrentTime(0);
    setTimelinePlaying(false);
  }, [syncWorkspaceMeta]);

  const mergeWorkspaceProjectData = useCallback((payload) => {
    setWorkspaceInfo(info => ({
      currentProject: payload.currentProject || info.currentProject,
      projects: Array.isArray(payload.projects)
        ? payload.projects
        : payload.currentProject
          ? info.projects.map(project => project.id === payload.currentProject.id ? { ...project, ...payload.currentProject } : project)
          : info.projects,
      versions: Array.isArray(payload.versions) ? payload.versions : info.versions,
    }));
    if (payload.currentProject?.name) {
      setProjectNameDraft(payload.currentProject.name);
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      const ae = document.activeElement;
      if (ae?.tagName === "INPUT" || ae?.tagName === "TEXTAREA" || ae?.tagName === "SELECT" || ae?.isContentEditable) return;
      const modKey = e.ctrlKey || e.metaKey;

      if (modKey && e.key === "z") { e.preventDefault(); undo(); return; }
      if (modKey && e.key === "y") { e.preventDefault(); redo(); return; }

      if (!canvasRef.current) return;

      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); canvasRef.current.deleteSelected(); }
      else if (modKey && e.key.toLowerCase() === "c") { e.preventDefault(); canvasRef.current.copySelected?.(); }
      else if (modKey && e.key.toLowerCase() === "v") { e.preventDefault(); canvasRef.current.pasteClipboard?.(); }
      else if (modKey && e.key.toLowerCase() === "d") { e.preventDefault(); canvasRef.current.duplicateSelected(); }
      else if (modKey && e.key.toLowerCase() === "a") { e.preventDefault(); const a = history.present; setSelectedIds(new Set((a.activities.find(x => x.id === a.selActId)?.objects || []).map(o => o.id))); }
      else if (e.key === "Escape") setSelectedIds(new Set());
      else if (e.key === "ArrowLeft")  { e.preventDefault(); canvasRef.current.nudge(e.shiftKey ? -10 : -1, 0); }
      else if (e.key === "ArrowRight") { e.preventDefault(); canvasRef.current.nudge(e.shiftKey ? 10 : 1, 0); }
      else if (e.key === "ArrowUp")    { e.preventDefault(); canvasRef.current.nudge(0, e.shiftKey ? -10 : -1); }
      else if (e.key === "ArrowDown")  { e.preventDefault(); canvasRef.current.nudge(0, e.shiftKey ? 10 : 1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, history.present]);

  useEffect(() => {
    const blockBrowserZoomKeys = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (["+", "=", "-", "0"].includes(e.key)) {
        e.preventDefault();
      }
    };

    const blockBrowserZoomWheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.target?.closest?.("[data-stage-zoom-scope='true']")) return;
        e.preventDefault();
      }
    };

    window.addEventListener("keydown", blockBrowserZoomKeys, { capture: true });
    window.addEventListener("wheel", blockBrowserZoomWheel, { passive: false });

    return () => {
      window.removeEventListener("keydown", blockBrowserZoomKeys, { capture: true });
      window.removeEventListener("wheel", blockBrowserZoomWheel, { passive: false });
    };
  }, []);

  // Reset selection when switching activity
  const handleSelectAct = useCallback((id) => {
    commit(p => ({ ...p, selActId: id }));
    setSelectedIds(new Set());
    setAnswerPreview(null);
    setPreviewMode(false);
    setActiveTab("nesneler");
  }, [commit]);

  useEffect(() => {
    const saveState = () => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(present));
        setLastSaved(new Date());
      } catch {}
    };

    if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
      const idleId = window.requestIdleCallback(saveState, { timeout: 500 });
      return () => window.cancelIdleCallback(idleId);
    }

    const timer = window.setTimeout(saveState, 180);
    return () => window.clearTimeout(timer);
  }, [present]);

  useEffect(() => {
    const handlePointerMove = (e) => {
      const session = resizeSessionRef.current;
      if (!session) return;
      if (session.type === "timeline") {
        setTimelineHeight(clamp(session.startValue + (session.startY - e.clientY), 220, 520));
      } else if (session.type === "right-panel") {
        setRightPanelWidth(clamp(session.startValue + (session.startX - e.clientX), 320, 620));
      } else if (session.type === "left-panel") {
        setLeftPanelWidth(clamp(session.startValue + (e.clientX - session.startX), 172, 340));
      }
    };

    const handlePointerUp = () => {
      if (!resizeSessionRef.current) return;
      resizeSessionRef.current = null;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, []);

  const refreshRemoteState = useCallback(async () => {
    try {
      const r = await apiRequest("/workspace");
      syncWorkspaceMeta(r);
      const remoteState = r?.state, remoteUpdatedAt = r?.updatedAt || null;
      if (!remoteUpdatedAt) return null;
      const currentTs = lastRemoteUpdatedAtRef.current ? new Date(lastRemoteUpdatedAtRef.current).getTime() : 0;
      const incomingTs = new Date(remoteUpdatedAt).getTime();
      if (!lastRemoteUpdatedAtRef.current || incomingTs > currentTs) {
        lastRemoteUpdatedAtRef.current = remoteUpdatedAt;
        if (remoteState && JSON.stringify(remoteState) !== JSON.stringify(history.present)) {
          loadWorkspaceState(r);
        }
      }
      setDbStatus("connected"); return r;
    } catch { setDbStatus("local"); return null; }
  }, [history.present, loadWorkspaceState, syncWorkspaceMeta]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sr = await apiRequest("/workspace");
        if (cancelled) return;
        syncWorkspaceMeta(sr);
        if (sr?.state) {
          lastRemoteUpdatedAtRef.current = sr.updatedAt || null;
          loadWorkspaceState(sr);
        }
        setDbStatus("connected");
      } catch { if (!cancelled) setDbStatus("local"); }
      finally { remoteReadyRef.current = true; }
    })();
    return () => { cancelled = true; };
  }, [loadWorkspaceState, syncWorkspaceMeta]);

  useEffect(() => { const onFocus = () => { refreshRemoteState(); }; window.addEventListener("focus", onFocus); return () => window.removeEventListener("focus", onFocus); }, [refreshRemoteState]);
  useEffect(() => { if (!remoteReadyRef.current || dbStatus !== "connected") return; const t = setInterval(refreshRemoteState, 2500); return () => clearInterval(t); }, [dbStatus, refreshRemoteState]);
  useEffect(() => {
    if (!remoteReadyRef.current || dbStatus !== "connected" || !currentProjectId) return;
    if (skipRemoteSaveRef.current) { skipRemoteSaveRef.current = false; return; }
    const t = setTimeout(() => {
      apiRequest(`/projects/${currentProjectId}/draft`, { method: "PUT", body: JSON.stringify({ state: present, name: projectNameDraft, setCurrent: true }) })
        .then(r => {
          if (r?.updatedAt) lastRemoteUpdatedAtRef.current = r.updatedAt;
          mergeWorkspaceProjectData({ currentProject: r?.project });
        })
        .catch(() => setDbStatus("local"));
    }, 350);
    return () => clearTimeout(t);
  }, [present, dbStatus, currentProjectId, projectNameDraft, mergeWorkspaceProjectData]);

  const selActivity = useMemo(() => {
    const rawActivity = present.activities.find(a => a.id === present.selActId) || null;
    return rawActivity ? normalizeActivity(rawActivity) : null;
  }, [present.activities, present.selActId]);
  const isMixedAct = selActivity?.type === "mixed";

  useEffect(() => {
    setTimelineCurrentTime(0);
    setTimelinePlaying(false);
  }, [selActivity?.id, previewMode]);

  useEffect(() => {
    if (!selActivity || previewMode || !timelinePlaying) return undefined;
    const duration = getTimelineDuration(selActivity);
    const timer = window.setInterval(() => {
      setTimelineCurrentTime(prev => {
        const next = Number((prev + 0.1).toFixed(1));
        if (next >= duration) {
          setTimelinePlaying(false);
          return duration;
        }
        return next;
      });
    }, 100);
    return () => window.clearInterval(timer);
  }, [previewMode, selActivity, timelinePlaying]);

  const handleSelectPub = (id) => commit(p => ({ ...p, selPubId: id, selBookId: null, selActId: null }));
  const handleSelectBook = (id) => commit(p => ({ ...p, selBookId: id, selActId: null }));

  const startLayoutResize = useCallback((type, e) => {
    e.preventDefault();
    resizeSessionRef.current = {
      type,
      startX: e.clientX,
      startY: e.clientY,
      startValue: type === "timeline" ? timelineHeight : type === "right-panel" ? rightPanelWidth : leftPanelWidth,
    };
    document.body.style.userSelect = "none";
    document.body.style.cursor = type === "timeline" ? "row-resize" : "col-resize";
  }, [leftPanelWidth, rightPanelWidth, timelineHeight]);

  const resetLayout = useCallback(() => {
    setPanelScale(1);
    setZoom("fit");
    setTimelineHeight(260);
    setTimelineCurrentTime(0);
    setTimelinePlaying(false);
    setIsSlidePanelCollapsed(false);
    setLeftPanelWidth(196);
    setRightPanelWidth(388);
  }, []);

  const updateActivity = useCallback((updated) => {
    const normalized = normalizeActivity(commitMaterializedActivity(updated));
    setTimelineCurrentTime(current => Math.min(current, getTimelineDuration(normalized)));
    commit(p => ({ ...p, activities: p.activities.map(a => a.id === normalized.id ? normalized : a) }));
  }, [commit]);

  const openTextStudioWindow = useCallback(() => {
    if (typeof window === "undefined") return;
    const studioUrl = `${window.location.pathname}${window.location.search}#text-studio`;
    const studioWindow = window.open(studioUrl, "eicerik-text-studio");
    if (studioWindow) {
      studioWindow.focus();
      return;
    }
    window.location.hash = "#text-studio";
  }, []);

  const handleEditorTabSelect = useCallback((tabId) => {
    if (tabId === "metinler") {
      openTextStudioWindow();
      return;
    }
    setActiveTab(tabId);
    if (previewMode) setPreviewMode(false);
  }, [openTextStudioWindow, previewMode]);

  const handleSaveTextStudioPreset = useCallback((name, sourceActivity) => {
    const cleanName = String(name || "").trim();
    if (!cleanName || !sourceActivity) return "";
    let resolvedId = "";
    commit(p => {
      const existing = (p.textStudioPresets || []).find(item => item.name.toLowerCase() === cleanName.toLowerCase());
      resolvedId = existing?.id || uid();
      const preset = normalizeTextStudioPreset({
        id: resolvedId,
        name: cleanName,
        createdAt: existing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        payload: pickTextStudioDesign(sourceActivity),
      });
      const others = (p.textStudioPresets || []).filter(item => item.id !== resolvedId);
      return { ...p, textStudioPresets: [preset, ...others].slice(0, 30) };
    });
    return resolvedId;
  }, [commit]);

  const handleApplyTextStudioPreset = useCallback((presetId, activityId) => {
    if (!presetId || !activityId) return;
    commit(p => {
      const preset = (p.textStudioPresets || []).find(item => item.id === presetId);
      if (!preset) return p;
      return {
        ...p,
        activities: p.activities.map(item => item.id === activityId ? applyTextStudioPreset(item, preset.payload) : item),
      };
    });
  }, [commit]);

  const handleDeleteTextStudioPreset = useCallback((presetId) => {
    if (!presetId) return;
    commit(p => ({ ...p, textStudioPresets: (p.textStudioPresets || []).filter(item => item.id !== presetId) }));
  }, [commit]);

  const handleCreateProject = useCallback(async () => {
    try {
      const workspace = await apiRequest("/projects", {
        method: "POST",
        body: JSON.stringify({ name: newProjectName.trim() || "Yeni Proje", state: EMPTY }),
      });
      lastRemoteUpdatedAtRef.current = workspace?.updatedAt || null;
      loadWorkspaceState(workspace);
      setNewProjectName("");
    } catch (error) {
      alert(error.message || "Proje olusturulamadi.");
    }
  }, [loadWorkspaceState, newProjectName]);

  const handleSwitchProject = useCallback(async (projectId) => {
    try {
      const workspace = await apiRequest("/workspace/current-project", {
        method: "PUT",
        body: JSON.stringify({ projectId }),
      });
      lastRemoteUpdatedAtRef.current = workspace?.updatedAt || null;
      loadWorkspaceState(workspace);
    } catch (error) {
      alert(error.message || "Proje acilamadi.");
    }
  }, [loadWorkspaceState]);

  const handleDeleteProject = useCallback(async (projectId) => {
    if (!window.confirm("Bu projeyi silmek istedigine emin misin?")) return;
    try {
      const workspace = await apiRequest(`/projects/${projectId}`, { method: "DELETE" });
      lastRemoteUpdatedAtRef.current = workspace?.updatedAt || null;
      loadWorkspaceState(workspace);
    } catch (error) {
      alert(error.message || "Proje silinemedi.");
    }
  }, [loadWorkspaceState]);

  const handleCreateVersion = useCallback(async (publish = false) => {
    if (!currentProjectId) return;
    try {
      const response = await apiRequest(`/projects/${currentProjectId}/versions`, {
        method: "POST",
        body: JSON.stringify({ label: versionLabel.trim(), publish, state: present }),
      });
      mergeWorkspaceProjectData(response);
      setVersionLabel("");
    } catch (error) {
      alert(error.message || "Surum olusturulamadi.");
    }
  }, [currentProjectId, mergeWorkspaceProjectData, present, versionLabel]);

  const handlePublishExistingVersion = useCallback(async (versionId) => {
    if (!currentProjectId) return;
    try {
      const response = await apiRequest(`/projects/${currentProjectId}/publish`, {
        method: "POST",
        body: JSON.stringify({ versionId }),
      });
      mergeWorkspaceProjectData(response);
    } catch (error) {
      alert(error.message || "Surum yayinlanamadi.");
    }
  }, [currentProjectId, mergeWorkspaceProjectData]);

  const handleRestoreVersion = useCallback(async (versionId) => {
    if (!currentProjectId) return;
    if (!window.confirm("Bu surume geri donmek istedigine emin misin?")) return;
    try {
      const workspace = await apiRequest(`/projects/${currentProjectId}/restore`, {
        method: "POST",
        body: JSON.stringify({ versionId }),
      });
      lastRemoteUpdatedAtRef.current = workspace?.updatedAt || null;
      loadWorkspaceState(workspace);
    } catch (error) {
      alert(error.message || "Surum geri yuklenemedi.");
    }
  }, [currentProjectId, loadWorkspaceState]);

  const handleSaveProjectName = useCallback(async () => {
    if (!currentProjectId) return;
    try {
      const r = await apiRequest(`/projects/${currentProjectId}/draft`, {
        method: "PUT",
        body: JSON.stringify({ name: projectNameDraft, setCurrent: true }),
      });
      mergeWorkspaceProjectData({ currentProject: r?.project });
    } catch (error) {
      alert(error.message || "Ad kaydedilemedi.");
    }
  }, [currentProjectId, projectNameDraft, mergeWorkspaceProjectData]);

  const handleDeleteVersion = useCallback(async (versionId) => {
    if (!currentProjectId) return;
    if (!window.confirm("Bu surumu silmek istedigine emin misin?")) return;
    try {
      const r = await apiRequest(`/projects/${currentProjectId}/versions/${versionId}`, { method: "DELETE" });
      mergeWorkspaceProjectData({ versions: r.versions, currentProject: r.currentProject });
    } catch (error) {
      alert(error.message || "Surum silinemedi.");
    }
  }, [currentProjectId, mergeWorkspaceProjectData]);

  const handleDuplicateProject = useCallback(async (projectId, projectName) => {
    if (!window.confirm(`"${projectName}" projesini kopyalamak istiyor musun?`)) return;
    try {
      const workspace = await apiRequest(`/projects/${projectId}/duplicate`, { method: "POST" });
      lastRemoteUpdatedAtRef.current = workspace?.updatedAt || null;
      loadWorkspaceState(workspace);
    } catch (error) {
      alert(error.message || "Proje kopyalanamadi.");
    }
  }, [loadWorkspaceState]);

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(present, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "e-icerik-proje.json"; a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { try { const d = JSON.parse(ev.target.result); if (d.publishers !== undefined) commit(() => normalizeState({ ...EMPTY, ...d })); } catch { alert("Geçersiz JSON."); } };
    reader.readAsText(file); e.target.value = "";
  };

  const isDragDropAct = selActivity?.type === "drag-drop" || selActivity?.type === "mixed";
  const isSelectionAct = selActivity?.type === "selection" || selActivity?.type === "mixed";

  const selBook = present.books.find(b => b.id === present.selBookId);
  const selPub = present.publishers.find(p => p.id === present.selPubId);
  const currentView = !selPub ? "publishers" : !selBook ? "books" : !selActivity ? "activities" : "editor";

  // Editor tabs
  const TABS = [
    { id: "nesneler", label: "Nesneler", needsActivity: true },
    { id: "sahne", label: "Sahne", needsActivity: true },
    { id: "surukle-birak", label: "Surukle-Birak", needsActivity: true, condition: () => isDragDropAct },
    { id: "soru", label: "Soru", needsActivity: true, condition: () => isSelectionAct },
    { id: "metinler", label: "Metin Stüdyosu ↗", needsActivity: true },
    { id: "ayarlar", label: "Ayarlar", needsActivity: true },
  ].filter(t => t.needsActivity && selActivity && (!t.condition || t.condition()));

  // Ribbon content height (some tabs need more space)
  const tallTabs = ["surukle-birak", "soru", "metinler", "ayarlar"];
  const visibleTabs = isMixedAct
    ? [
        TABS.find(t => t.id === "nesneler"),
        TABS.find(t => t.id === "sahne"),
        { id: "karma", label: "Karma" },
        TABS.find(t => t.id === "metinler"),
        TABS.find(t => t.id === "ayarlar"),
      ].filter(Boolean)
    : TABS;
  const ribbonHeight = ["karma", ...tallTabs].includes(activeTab) ? 220 : 68;

  useEffect(() => {
    if (isTextStudioMode || activeTab !== "metinler") return;
    setActiveTab(isMixedAct ? "karma" : (visibleTabs.find(tab => tab.id !== "metinler")?.id || "nesneler"));
  }, [activeTab, isMixedAct, isTextStudioMode, visibleTabs]);

  useEffect(() => {
    if (!selActivity) return;
    const hasActiveTab = visibleTabs.some(tab => tab.id === activeTab);
    if (!hasActiveTab) {
      setActiveTab(isMixedAct ? "karma" : (visibleTabs[0]?.id || "nesneler"));
    }
  }, [activeTab, isMixedAct, selActivity, visibleTabs]);

  if (isTextStudioMode) {
    return (
      <TextStudioWorkspace
        activity={selActivity}
        activities={present.activities}
        variables={present.variables}
        designPresets={present.textStudioPresets}
        onSavePreset={handleSaveTextStudioPreset}
        onApplyPreset={handleApplyTextStudioPreset}
        onDeletePreset={handleDeleteTextStudioPreset}
        onUpdate={updateActivity}
        onClose={() => {
          if (typeof window !== "undefined") {
            if (window.opener && !window.opener.closed) {
              window.close();
            }
            window.location.hash = "";
          }
        }}
      />
    );
  }

  return (
    <div style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column", background: "#161e30", color: "#e2e8f0", fontFamily: "'Segoe UI',Tahoma,Geneva,Verdana,sans-serif", overflow: "hidden", fontSize: 13 }}>

      {/* ─── TOP BAR ─────────────────────────────────────────────── */}
      <div style={{ minHeight: 52, background: "#1e2740", display: "flex", alignItems: "center", padding: isMobileViewport ? "10px 12px" : "0 14px", borderBottom: "1px solid #131b2e", gap: 8, flexShrink: 0, boxShadow: "0 2px 10px rgba(0,0,0,.45)", flexWrap: isMobileViewport ? "wrap" : "nowrap" }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: "#e2e8f0", whiteSpace: "nowrap", letterSpacing: -0.2 }}>E-İçerik</span>
        <span style={{ fontSize: 9, background: "#3b4fa8", color: "#a5b4fc", padding: "2px 7px", borderRadius: 4, fontWeight: 700, border: "1px solid #4f63c8" }}>v5</span>
        <div style={{ width: 1, height: 20, background: "rgba(255,255,255,.12)" }} />

        {currentView === "editor" ? (
          <div style={{ display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap" }}>
            <button onClick={() => { commit(p => ({ ...p, selActId: null })); setPreviewMode(false); setSelectedIds(new Set()); }} style={{ padding: "6px 12px", border: "1px solid rgba(255,255,255,.14)", borderRadius: 6, background: "rgba(255,255,255,.08)", color: "#94a3b8", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>← Etkinlikler</button>
            {visibleTabs.map(t => (
              <button key={t.id} onClick={() => handleEditorTabSelect(t.id)} style={{ padding: "6px 12px", border: `1px solid ${activeTab === t.id ? "rgba(99,131,255,.6)" : "transparent"}`, borderRadius: 6, background: activeTab === t.id ? "rgba(99,131,255,.22)" : "transparent", color: activeTab === t.id ? "#a5b4fc" : "rgba(255,255,255,.5)", fontSize: 11, fontWeight: 700, cursor: "pointer", transition: "all .14s ease" }}>{t.label}</button>
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "rgba(255,255,255,.45)", fontSize: 11 }}>
            <span>{currentView === "publishers" ? "1. Yayınevi seç" : currentView === "books" ? "2. Kitap sec" : "3. Etkinlik sec"}</span>
            {selPub && <span style={{ color: "rgba(255,255,255,.65)" }}>• {selPub.name}</span>}
            {selBook && <span style={{ color: "rgba(255,255,255,.65)" }}>• {selBook.name}</span>}
          </div>
        )}

        <div style={{ flex: 1 }} />

        {currentView === "editor" && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 3, background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 6, padding: "3px 7px" }}>
              <button onClick={() => adjustStageZoom(-0.1)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 13, padding: "0 2px", lineHeight: 1 }}>−</button>
              <span style={{ fontSize: 10, color: "#cbd5e1", minWidth: 62, textAlign: "center", fontWeight: 700 }}>{zoom === "fit" ? `Sığdır ${currentZoomPercent}%` : `Sahne ${currentZoomPercent}%`}</span>
              <button onClick={() => adjustStageZoom(0.1)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 13, padding: "0 2px", lineHeight: 1 }}>+</button>
              <button onClick={() => setZoom("fit")} style={{ background: "rgba(99,131,255,.2)", border: "1px solid rgba(99,131,255,.35)", color: "#a5b4fc", cursor: "pointer", fontSize: 9, padding: "2px 6px", borderRadius: 4 }}>Sığdır</button>
              <button onClick={() => setZoom(1)} style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", color: "#94a3b8", cursor: "pointer", fontSize: 9, padding: "2px 6px", borderRadius: 4 }}>1:1</button>
            </div>

            <div style={{ width: 1, height: 18, background: "rgba(255,255,255,.1)" }} />

            <div style={{ display: "flex", alignItems: "center", gap: 3, background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 6, padding: "3px 7px" }}>
              <button onClick={() => setPanelScale(z => clamp(Number((z - 0.1).toFixed(2)), 0.8, 1.35))} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 13, padding: "0 2px", lineHeight: 1 }}>−</button>
              <span style={{ fontSize: 10, color: "#cbd5e1", minWidth: 50, textAlign: "center", fontWeight: 700 }}>UI {Math.round(panelScale * 100)}%</span>
              <button onClick={() => setPanelScale(z => clamp(Number((z + 0.1).toFixed(2)), 0.8, 1.35))} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 13, padding: "0 2px", lineHeight: 1 }}>+</button>
              <button onClick={() => setPanelScale(1)} style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", color: "#94a3b8", cursor: "pointer", fontSize: 9, padding: "2px 6px", borderRadius: 4 }}>Reset</button>
            </div>

            <button onClick={resetLayout} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.07)", color: "#94a3b8", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
              Yerlesim
            </button>

            <button onClick={() => setUiMode(mode => mode === "basic" ? "advanced" : "basic")} style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid ${uiMode === "advanced" ? "rgba(99,131,255,.45)" : "rgba(255,255,255,.12)"}`, background: uiMode === "advanced" ? "rgba(99,131,255,.22)" : "rgba(255,255,255,.07)", color: uiMode === "advanced" ? "#a5b4fc" : "#94a3b8", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
              {uiMode === "advanced" ? "Gelismis" : "Temel"}
            </button>

            <div style={{ width: 1, height: 18, background: "rgba(255,255,255,.1)" }} />
          </>
        )}

        {currentView === "editor" && selActivity && (
          <button onClick={() => setPreviewMode(v => !v)} style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${previewMode ? "rgba(34,197,94,.5)" : "rgba(255,255,255,.12)"}`, background: previewMode ? "rgba(34,197,94,.18)" : "rgba(255,255,255,.07)", color: previewMode ? "#4ade80" : "#94a3b8", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
            {previewMode ? "▶ Önizleme" : "▶ Önizle"}
          </button>
        )}

        {currentView === "editor" && currentProject && (
          <span style={{ fontSize: 10, color: "#64748b", padding: "4px 9px", borderRadius: 5, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.09)", whiteSpace: "nowrap", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }}>
            {currentProject.name}
          </span>
        )}

        {currentView === "editor" && (
          <button onClick={() => setShowProjectManager(true)} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.07)", color: "#94a3b8", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
            Sürümler
          </button>
        )}

        <div style={{ width: 1, height: 18, background: "rgba(255,255,255,.1)" }} />
        <Btn onClick={undo} disabled={!history.past.length} color="#78909C" small>Geri Al</Btn>
        <Btn onClick={redo} disabled={!history.future.length} color="#78909C" small>Yinele</Btn>
        <Btn onClick={handleExport} color="#00BCD4" small>JSON</Btn>
        <Btn onClick={() => importRef.current?.click()} color="#FF9800" small>İçe Aktar</Btn>
        <input ref={importRef} type="file" accept=".json" onChange={handleImport} style={{ display: "none" }} />
        <Btn onClick={() => { if (window.confirm("Tum veriler sifirlanacak. Devam?")) setHistory({ past: [], present: EMPTY, future: [] }); }} color="#f44336" small>Sil</Btn>

        <div style={{ width: 1, height: 18, background: "rgba(255,255,255,.1)" }} />
        <span style={{ fontSize: 9, color: dbStatus === "connected" ? "#4ade80" : dbStatus === "connecting" ? "#fbbf24" : "#64748b", background: dbStatus === "connected" ? "rgba(74,222,128,.1)" : "rgba(255,255,255,.05)", padding: "2px 7px", borderRadius: 4, whiteSpace: "nowrap", border: "1px solid " + (dbStatus === "connected" ? "rgba(74,222,128,.2)" : "rgba(255,255,255,.08)") }}>
          {dbStatus === "connected" ? "SQLite" : dbStatus === "connecting" ? "DB" : "Lokal"}
        </span>
        {lastSaved && <span style={{ fontSize: 9, color: "#4ade80", whiteSpace: "nowrap", opacity: 0.7 }}>● {lastSaved.toLocaleTimeString("tr-TR")}</span>}
      </div>

      {currentView === "editor" && selActivity && (
        <div style={{ flexShrink: 0, background: "#252f4a", borderBottom: "1px solid #1a2238", padding: "8px 14px 10px", minHeight: ribbonHeight, maxHeight: tallTabs.includes(activeTab) ? 300 : ribbonHeight, transition: "min-height .2s, max-height .2s", overflowY: tallTabs.includes(activeTab) ? "auto" : "hidden" }}>
          {activeTab === "nesneler" && (
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#7c3aed", textTransform: "uppercase", letterSpacing: 0.5 }}>Zemin ve medya</div>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {[
                  { type: "text", color: "#E0E0E0", label: "+ Metin" },
                  { type: "button", color: "#7C4DFF", label: "+ Buton" },
                  { type: "draggable", color: "#2563eb", label: "+ Surukle" },
                  { type: "dropzone", color: "#f97316", label: "+ Birak Alani" },
                  { type: "shape", color: "#0ea5e9", label: "+ Sekil" },
                  { type: "hotspot", color: "#f44336", label: "+ Hotspot" },
                ].map(({ type, color, label }) => (
                  <Btn key={type} onClick={() => canvasRef.current?.addObject(type)} color={color} small>{label}</Btn>
                ))}
                <Btn onClick={() => canvasRef.current?.addImage()} color="#4CAF50" small>Resim</Btn>
                <Btn onClick={() => canvasRef.current?.addVideo()} color="#38bdf8" small>Video</Btn>
                <Btn onClick={() => canvasRef.current?.loadSVG()} color="#B388FF" small>SVG Zemin</Btn>
                </div>
              </div>
              <div style={{ width: 1, alignSelf: "stretch", background: "#d7e0eb" }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#0284c7", textTransform: "uppercase", letterSpacing: 0.5 }}>Düzenleme</div>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                <Btn onClick={() => canvasRef.current?.duplicateSelected()} color="#00BCD4" small disabled={selectedIds.size === 0 && !selActivity?.selectedObjectId}>Kopyala</Btn>
                <Btn onClick={() => canvasRef.current?.bringFront()} color="#FF9800" small disabled={!selActivity?.selectedObjectId}>One Al</Btn>
                <Btn onClick={() => canvasRef.current?.sendBack()} color="#607D8B" small disabled={!selActivity?.selectedObjectId}>Arkaya At</Btn>
                <Btn onClick={() => canvasRef.current?.deleteSelected()} color="#f44336" small disabled={selectedIds.size === 0 && !selActivity?.selectedObjectId}>Sil</Btn>
                </div>
              </div>
            </div>
          )}

          {activeTab === "sahne" && (
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 10, color: "#78909C", marginBottom: 4 }}>BOYUT</div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <div style={{ width: 80 }}><Inp label="G" type="number" value={selActivity.stageWidth} onChange={e => updateActivity({ ...selActivity, stageWidth: +e.target.value || 1920 })} /></div>
                  <span style={{ color: "#444", fontSize: 12 }}>×</span>
                  <div style={{ width: 80 }}><Inp label="Y" type="number" value={selActivity.stageHeight} onChange={e => updateActivity({ ...selActivity, stageHeight: +e.target.value || 1080 })} /></div>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "#78909C", marginBottom: 4 }}>ZEMIN RENGI</div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input type="color" value={selActivity.backgroundColor || "#ffffff"} onChange={e => updateActivity({ ...selActivity, backgroundColor: e.target.value })} style={{ width: 36, height: 30, border: "none", background: "none", cursor: "pointer" }} />
                  <span style={{ fontSize: 10, color: "#78909C" }}>{selActivity.backgroundColor || "#ffffff"}</span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "#78909C", marginBottom: 4 }}>SAHNE ADI</div>
                <div style={{ width: 160 }}><Inp value={selActivity.sceneName || ""} onChange={e => updateActivity({ ...selActivity, sceneName: e.target.value })} placeholder="Sahne 1" /></div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "#78909C", marginBottom: 4 }}>SVG ZEMIN</div>
                <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                  <Btn onClick={() => canvasRef.current?.loadSVG()} color="#B388FF" small>Yükle</Btn>
                  <span style={{ fontSize: 10, color: "#444" }}>{selActivity.svgName || "Yüklenmedi"}</span>
                  {selActivity.svgMarkup && <button onClick={() => updateActivity({ ...selActivity, svgMarkup: "", svgName: "" })} style={{ background: "none", border: "none", color: "#f44336", cursor: "pointer", fontSize: 11 }}>×</button>}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "#78909C", marginBottom: 4 }}>SES / NARRASYON</div>
                <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" }}>
                  <label style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #4CAF50", background: "#4CAF5022", color: "#4CAF50", fontSize: 10, fontWeight: 600, cursor: "pointer" }}>
                    Ses Yükle
                    <input type="file" accept="audio/*" style={{ display: "none" }} onChange={async e => {
                      const file = e.target.files[0]; if (!file) return;
                      e.target.value = "";
                      const url = await uploadMediaFile(file);
                      updateActivity({ ...selActivity, audioUrl: url, audioName: file.name });
                    }} />
                  </label>
                  {selActivity.audioUrl && (
                    <>
                      <span style={{ fontSize: 10, color: "#4CAF50", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selActivity.audioName || "ses.mp3"}</span>
                      <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#78909C", cursor: "pointer" }}>
                        <input type="checkbox" checked={selActivity.audioAutoPlay !== false} onChange={e => updateActivity({ ...selActivity, audioAutoPlay: e.target.checked })} style={{ accentColor: "#4CAF50" }} />
                        Otomatik Oynat
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#78909C", cursor: "pointer" }}>
                        <input type="checkbox" checked={!!selActivity.audioLoop} onChange={e => updateActivity({ ...selActivity, audioLoop: e.target.checked })} style={{ accentColor: "#4CAF50" }} />
                        Dongu
                      </label>
                      <button onClick={() => updateActivity({ ...selActivity, audioUrl: "", audioName: "" })} style={{ background: "none", border: "none", color: "#f44336", cursor: "pointer", fontSize: 11 }}>×</button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "karma" && isMixedAct && <MixedActivityEditor activity={selActivity} onUpdate={updateActivity} />}
          {activeTab === "surukle-birak" && selActivity?.type === "drag-drop" && <DragDropConfigPanel activity={selActivity} onUpdate={updateActivity} />}
          {activeTab === "soru" && selActivity?.type === "selection" && <SelectionEditor activity={selActivity} onUpdate={updateActivity} />}
          {activeTab === "metinler" && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: 14, borderRadius: 18, border: "1px solid #bfdbfe", background: "linear-gradient(135deg,#eff6ff,#ffffff)", boxShadow: "0 14px 30px rgba(59,130,246,.10)" }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#1d4ed8" }}>Metin Stüdyosu ayrı sekmede açılır</div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>Canva benzeri çalışma alanı otomatik yeni sekmede çalışır.</div>
              </div>
              <button onClick={openTextStudioWindow} style={{ padding: "9px 12px", borderRadius: 12, border: "1px solid #93c5fd", background: "#ffffff", color: "#1d4ed8", fontSize: 11, fontWeight: 900, cursor: "pointer" }}>
                Stüdyoyu Aç
              </button>
            </div>
          )}
          {activeTab === "ayarlar" && <ActivityScreenFlowEditor activity={selActivity} onUpdate={updateActivity} />}
        </div>
      )}

      {currentView === "publishers" && (
        <SelectionStepShell
          title="Yayınevi Oluşturma ve Seçim Sayfası"
          subtitle="Icerigin hangi yayinevinde yer alacagini sec veya yeni bir yayinevi olustur."
          badge="01 - Calisma Yuzeyi"
        >
          <PublisherPanel publishers={present.publishers} selId={present.selPubId} onSelect={handleSelectPub} onChange={pubs => commit(p => ({ ...p, publishers: pubs }))} />
        </SelectionStepShell>
      )}

      {currentView === "books" && (
        <SelectionStepShell
          title="Kitap Olusturma Ve Secim Sayfasi"
          subtitle="Secilen yayinevi altinda kitaplarini yonet ve duzenlemek istedigin kitabi ac."
          badge="02 - Calisma Yuzeyi"
          onBack={() => commit(p => ({ ...p, selPubId: null, selBookId: null, selActId: null }))}
        >
          <BookPanel books={present.books} selPubId={present.selPubId} selId={present.selBookId} onSelect={handleSelectBook} onChange={books => commit(p => ({ ...p, books: books.map(normalizeBook) }))} currentProjectId={currentProjectId} activities={present.activities} onActivitiesChange={activities => commit(p => ({ ...p, activities }))} onOpenPreviewEditor={() => {}} />
        </SelectionStepShell>
      )}

      {currentView === "activities" && (
        <SelectionStepShell
          title="Kitaba Ait Etkinlik Oluşturma ve Seçim Sayfası"
          subtitle="Düzenlemek veya yeni olusturmak istedigin etkinligi sec. Editore girdiginde once SVG zeminle baslayabilirsin."
          badge="03 - Calisma Yuzeyi"
          onBack={() => commit(p => ({ ...p, selBookId: null, selActId: null }))}
        >
          <ActivityPanel activities={present.activities} books={present.books} selBookId={present.selBookId} selId={present.selActId} onSelect={handleSelectAct} onChange={acts => commit(p => ({ ...p, activities: acts }))} onBooksChange={books => commit(p => ({ ...p, books: books.map(normalizeBook) }))} onOpenPreviewEditor={() => {}} />
        </SelectionStepShell>
      )}

      {currentView === "editor" && (
        <div ref={editorScrollRef} style={{ flex: 1, minHeight: 0, overflow: "auto", background: "#161e30" }}>
          <div style={{ width: `${100 / effectivePanelScale}%`, height: `${100 / effectivePanelScale}%`, minHeight: `${100 / effectivePanelScale}%`, transform: `scale(${effectivePanelScale})`, transformOrigin: "top left", display: "flex", flexDirection: "column", paddingBottom: isMobileViewport ? 86 : 0 }}>
            <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: isMobileViewport ? "column" : "row", overflow: "hidden", background: "transparent", padding: isMobileViewport ? 8 : 10, gap: isMobileViewport ? 10 : 8 }}>
              {!isMobileViewport && selActivity && !isSlidePanelCollapsed && (
                <div style={{ width: leftPanelWidth, flexShrink: 0, border: "1px solid #2e3a55", borderRadius: 8, background: "#1e2740", display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden", boxShadow: "0 4px 16px rgba(0,0,0,.3)" }}>
                  <SlideStrip activity={selActivity} onUpdate={updateActivity} vertical />
                </div>
              )}
              {!isMobileViewport && selActivity && (
                <div style={{ width: isSlidePanelCollapsed ? 34 : 10, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent" }}>
                  {isSlidePanelCollapsed ? (
                    <button
                      onClick={() => setIsSlidePanelCollapsed(false)}
                      style={{ width: 34, height: "100%", minHeight: 180, borderRadius: 6, border: "1px solid #2e3a55", background: "#252f4a", color: "#64748b", cursor: "pointer", boxShadow: "0 4px 12px rgba(0,0,0,.25)", fontSize: 10, fontWeight: 700, writingMode: "vertical-rl", textOrientation: "mixed", letterSpacing: 0.5 }}
                    >
                      Scenes →
                    </button>
                  ) : (
                    <div
                      onPointerDown={e => startLayoutResize("left-panel", e)}
                      onDoubleClick={() => setLeftPanelWidth(196)}
                      style={{ width: 10, height: "100%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "col-resize", background: "transparent", position: "relative" }}
                    >
                      <button
                        onClick={(e) => { e.stopPropagation(); setIsSlidePanelCollapsed(true); }}
                        style={{ position: "absolute", top: 14, left: -4, width: 16, height: 48, borderRadius: 999, border: "1px solid #2e3a55", background: "#252f4a", color: "#475569", cursor: "pointer" }}
                      >
                        ‹
                      </button>
                      <div style={{ width: 3, alignSelf: "stretch", margin: "8px 0", borderRadius: 999, background: "rgba(99,131,255,.25)" }} />
                    </div>
                  )}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", border: "1px solid #2e3a55", borderRadius: 8, background: "#252f4a", overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,.35)" }}>
                <div style={{ height: 36, borderBottom: "1px solid #1a2238", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px", color: "#64748b", fontSize: 10, background: "#1e2740", flexShrink: 0 }}>
                  <span style={{ color: "#94a3b8", fontWeight: 600 }}>{selActivity ? (selActivity.sceneName || selActivity.name || "Sahne") : "Sahne"}</span>
                  <span style={{ color: "#475569", fontFamily: "monospace", fontSize: 10 }}>{selActivity ? `${selActivity.stageWidth} × ${selActivity.stageHeight}` : "Etkinlik seç"}</span>
                </div>

                {isMobileViewport && selActivity && <SlideStrip activity={selActivity} onUpdate={updateActivity} />}
                <div style={{ flex: 1, minHeight: isMobileViewport ? 320 : 0, display: "flex", overflow: "hidden", background: "#6b7280", padding: isMobileViewport ? 8 : 20 }}>
                  {previewMode && selActivity ? (
                    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0f1e", borderRadius: 20, flexDirection: "column", gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(34,197,94,.15)", border: "1px solid rgba(34,197,94,.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>▶</div>
                      <div style={{ color: "rgba(255,255,255,.35)", fontSize: 12, fontWeight: 600 }}>Önizleme tam ekranda açık</div>
                    </div>
                  ) : (
                    <StageCanvas
                      ref={canvasRef}
                      activity={selActivity}
                      onUpdate={updateActivity}
                      zoom={zoom}
                      onZoomChange={setZoom}
                      selectedIds={selectedIds}
                      onSelectionChange={setSelectedIds}
                      timelineTime={timelineCurrentTime}
                      answerPreview={answerPreview}
                    />
                  )}
                </div>

                {!previewMode && (
                  <>
                    <div
                      onPointerDown={e => startLayoutResize("timeline", e)}
                      onDoubleClick={() => setTimelineHeight(isMobileViewport ? 190 : 260)}
                      style={{ height: 10, flexShrink: 0, borderTop: "1px solid #1a2238", borderBottom: "1px solid #1a2238", background: "#1e2740", cursor: isMobileViewport ? "default" : "row-resize", display: "flex", alignItems: "center", justifyContent: "center", touchAction: "none" }}
                    >
                      <div style={{ width: 48, height: 3, borderRadius: 999, background: "rgba(148,163,184,.3)" }} />
                    </div>
                    <TimelineDock
                      activity={selActivity}
                      onUpdate={updateActivity}
                      height={isMobileViewport ? Math.min(timelineHeight, 220) : timelineHeight}
                      currentTime={timelineCurrentTime}
                      onCurrentTimeChange={setTimelineCurrentTime}
                      isPlaying={timelinePlaying}
                      onPlayingChange={setTimelinePlaying}
                      selectedIds={selectedIds}
                      onSelectObject={objectId => {
                        if (!objectId) return;
                        setSelectedIds(new Set([objectId]));
                        if (selActivity) updateActivity({ ...selActivity, selectedObjectId: objectId });
                      }}
                    />
                  </>
                )}
              </div>

              {!isMobileViewport && (
                <div
                  onPointerDown={e => startLayoutResize("right-panel", e)}
                  onDoubleClick={() => setRightPanelWidth(388)}
                  style={{ width: 10, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", cursor: "col-resize", background: "transparent" }}
                >
                  <div style={{ width: 3, alignSelf: "stretch", margin: "8px 0", borderRadius: 999, background: "rgba(99,131,255,.25)" }} />
                </div>
              )}

              <div ref={isMobileViewport ? mobileInspectorRef : null} style={{ width: isMobileViewport ? "100%" : rightPanelWidth, minWidth: isMobileViewport ? 0 : rightPanelWidth, maxWidth: isMobileViewport ? "100%" : rightPanelWidth, minHeight: 0, display: "flex", flexDirection: isMobileViewport ? "column" : "row", border: "1px solid #2e3a55", borderRadius: 8, background: "#1e2740", overflowX: "hidden", overflowY: isMobileViewport ? "auto" : "hidden", WebkitOverflowScrolling: "touch", touchAction: isMobileViewport ? "pan-y" : "auto", maxHeight: isMobileViewport ? "45vh" : "none", boxShadow: "0 4px 16px rgba(0,0,0,.3)" }}>
                <EditorToolRail
                  selActivity={selActivity}
                  canvasRef={canvasRef}
                  selectedIds={selectedIds}
                  setActiveTab={handleEditorTabSelect}
                  previewMode={previewMode}
                  setPreviewMode={setPreviewMode}
                  mobile={isMobileViewport}
                  uiMode={uiMode}
                />
                <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
                  <RightInspectorPhase2
                    activity={selActivity}
                    onUpdate={updateActivity}
                    selectedIds={selectedIds}
                    activities={present.activities}
                    variables={present.variables}
                    onVariablesChange={nextVariables => commit(p => ({ ...p, variables: nextVariables }))}
                    hideTimeline
                    mobile={isMobileViewport}
                    uiMode={uiMode}
                    onAnswerPreviewChange={setAnswerPreview}
                  />
                </div>
              </div>
            </div>

            <div style={{ minHeight: 24, background: "#1a2034", borderTop: "1px solid #131b2e", display: "flex", alignItems: "center", padding: "4px 14px", fontSize: 9, color: "#475569", gap: 14, flexShrink: 0, flexWrap: isCompactViewport ? "wrap" : "nowrap" }}>
              <span style={{ color: "#374151" }}>Etkinlikler: {present.activities.length}</span>
              {selActivity && <span style={{ color: "#4b5563" }}>{selActivity.name} · {selActivity.objects?.length || 0} nesne · {ACTIVITY_TYPES.find(t => t.id === selActivity.type)?.label}</span>}
              {selectedIds.size > 0 && <span style={{ color: "#6366f1", fontWeight: 700 }}>{selectedIds.size} nesne seçili</span>}
              <span style={{ flex: 1 }} />
              <span style={{ color: "#374151" }}>Ctrl+Z/Y · Del · Ctrl+D · Ok / Shift+Ok</span>
            </div>
          </div>
          {isMobileViewport && (
            <div style={{ position: "sticky", bottom: 0, zIndex: 40, padding: "0 10px 10px" }}>
              <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: 10, borderRadius: 22, border: "1px solid rgba(15,23,42,.12)", background: "rgba(255,255,255,.94)", boxShadow: "0 18px 40px rgba(15,23,42,.14)", backdropFilter: "blur(16px)" }}>
                {[
                  { id: "preview", label: previewMode ? "Editor" : "Önizle", onClick: () => setPreviewMode(v => !v), tone: previewMode ? "#16a34a" : "#0f172a" },
                  { id: "svg", label: "SVG", onClick: () => canvasRef.current?.loadSVG(), tone: "#7c3aed" },
                  { id: "text", label: "Metin", onClick: () => canvasRef.current?.addObject("text"), tone: "#334155" },
                  { id: "button", label: "Buton", onClick: () => canvasRef.current?.addObject("button"), tone: "#4f46e5" },
                  { id: "shape", label: "Sekil", onClick: () => canvasRef.current?.addObject("shape"), tone: "#0ea5e9" },
                  { id: "image", label: "Resim", onClick: () => canvasRef.current?.addImage(), tone: "#16a34a" },
                  { id: "video", label: "Video", onClick: () => canvasRef.current?.addVideo(), tone: "#0284c7" },
                  { id: "audio", label: "Ses", onClick: () => canvasRef.current?.addAudio(), tone: "#0891b2" },
                  { id: "panel", label: "Panel", onClick: () => mobileInspectorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), tone: "#475569" },
                ].map(action => (
                  <button
                    key={action.id}
                    onClick={action.onClick}
                    style={{ flex: "0 0 auto", minWidth: 78, height: 48, borderRadius: 16, border: `1px solid ${action.tone}22`, background: "#ffffff", color: action.tone, fontSize: 12, fontWeight: 800, cursor: "pointer", boxShadow: "0 8px 18px rgba(15,23,42,.08)" }}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Tam Ekran Önizleme Katmanı ─────────────────────────────────── */}
      {previewMode && selActivity && currentView === "editor" && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, overflow: "hidden", background: "#0a0f1e", display: "flex", flexDirection: "column" }}>
          {/* Sticky exit bar */}
          <div style={{ position: "sticky", top: 0, zIndex: 10, background: "rgba(10,15,30,.96)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,.07)", padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexShrink: 0, height: 50 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 0 3px rgba(34,197,94,.18)" }} />
              <span style={{ color: "rgba(255,255,255,.6)", fontSize: 12, fontWeight: 700, letterSpacing: 0.4 }}>Öğrenci Görünümü</span>
              {selActivity?.name && (
                <>
                  <span style={{ color: "rgba(255,255,255,.18)", fontSize: 10 }}>·</span>
                  <span style={{ color: "rgba(255,255,255,.36)", fontSize: 11 }}>{selActivity.name}</span>
                </>
              )}
            </div>
            <button onClick={() => setPreviewMode(false)} style={{ padding: "7px 18px", borderRadius: 999, border: "1px solid rgba(255,255,255,.14)", background: "rgba(255,255,255,.06)", color: "rgba(255,255,255,.82)", fontSize: 11, fontWeight: 700, cursor: "pointer", letterSpacing: 0.3, transition: "background .15s" }}>
              ← Editöre Dön
            </button>
          </div>
          {/* Content Wrapper */}
          <div 
            style={{ flex: 1, position: "relative", width: "100%", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}
            ref={containerNode => {
              if (!containerNode) return;
              // ResizeObserver to calculate scale
              const contentNode = containerNode.firstChild;
              if (!contentNode) return;
              
              const resizeObserver = new ResizeObserver(entries => {
                for (let entry of entries) {
                  const cw = entry.contentRect.width;
                  const ch = entry.contentRect.height;
                  
                  // Use a fixed virtual resolution or the actual content width/height.
                  // For PreviewPlayer, we might assume a max-width of around 1100 or actual size.
                  // Since PreviewPlayer doesn't have a fixed size, we wrap it in a container that 
                  // fits its content and scale that container.
                  const contentW = contentNode.offsetWidth || 1100;
                  const contentH = contentNode.offsetHeight || 760;
                  
                  // Calculate scale to fit both width and height (with some padding)
                  const scaleW = cw / (contentW + 40); // 40px padding
                  const scaleH = ch / (contentH + 40);
                  const scale = Math.min(scaleW, scaleH, 1); // Don't scale up beyond 1
                  
                  contentNode.style.transform = `scale(${scale})`;
                }
              });
              resizeObserver.observe(containerNode);
              return () => resizeObserver.disconnect();
            }}
          >
            <div style={{ transformOrigin: "center center", transition: "transform 0.1s ease-out" }}>
              <PreviewPlayer activity={selActivity} activities={present.activities} variables={present.variables} />
            </div>
          </div>
        </div>
      )}

      <ProjectVersionManagerModal
        open={showProjectManager}
        onClose={() => setShowProjectManager(false)}
        dbStatus={dbStatus}
        currentProject={currentProject}
        projectNameDraft={projectNameDraft}
        onProjectNameChange={setProjectNameDraft}
        newProjectName={newProjectName}
        onNewProjectNameChange={setNewProjectName}
        onCreateProject={handleCreateProject}
        projects={workspaceInfo.projects}
        onSwitchProject={handleSwitchProject}
        onDeleteProject={handleDeleteProject}
        versionLabel={versionLabel}
        onVersionLabelChange={setVersionLabel}
        onCreateVersion={handleCreateVersion}
        onPublishVersion={handlePublishExistingVersion}
        versions={workspaceInfo.versions}
        onRestoreVersion={handleRestoreVersion}
        onSaveProjectName={handleSaveProjectName}
        onDeleteVersion={handleDeleteVersion}
        onDuplicateProject={handleDuplicateProject}
        activityCount={present.activities.length}
        currentProjectId={currentProjectId}
        books={present.books.map(book => ({ id: book.id, name: book.name, activityCount: present.activities.filter(a => a.bookId === book.id).length }))}
      />
    </div>
  );
}

