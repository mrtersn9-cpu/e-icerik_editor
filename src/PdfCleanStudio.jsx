import { PDFDocument } from 'pdf-lib';
import { useEffect, useMemo, useRef, useState } from 'react';

import { WORKFLOW_STATUS_META } from './constants';
// EDITOR_THEME no longer used; PdfCleanStudio now uses inline light-mode tokens.
import { getAssetUrl } from './utils/assetUrl';
import {
  PDF_INTEGRATION_CONFIRM_BYTES,
  PDF_INTEGRATION_WARN_BYTES,
  buildPdfIntegrationPlan,
  buildPdfPageSourceId,
  hashPdfIntegrationContent,
  sanitizeSvgForPdfIntegration,
} from './utils/pdfActivityIntegration';

let pdfJsLoaderPromise = null;

function ensurePdfJsLib() {
  if (typeof window === 'undefined') {
    throw new Error('PDF temizleme araci sadece tarayicida calisir.');
  }
  if (!pdfJsLoaderPromise) {
    pdfJsLoaderPromise = import('pdfjs-dist/legacy/build/pdf')
      .then((module) => module?.default || module)
      .then((lib) => {
        if (!lib?.getDocument) {
          throw new Error('PDF kutuphanesi yuklenemedi.');
        }
        if (lib.GlobalWorkerOptions) {
          lib.GlobalWorkerOptions.workerSrc = getAssetUrl('pdf.worker.min.mjs');
        }
        return lib;
      });
  }
  return pdfJsLoaderPromise;
}

function uid(prefix = 'item') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function deepClone(value) {
  // structuredClone NaN/Infinity/undefined değerlerini korur; JSON tabanlı klon bunları bozar.
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value);
    } catch {
      // Klonlanamayan değerlerde JSON'a düş.
    }
  }
  return JSON.parse(JSON.stringify(value));
}

// Geçmiş snapshot'ları için patch dizisini klonlar ama ağır base64 alanlarını (imageData /
// sourceMaskData) referansla paylaşır. Bu alanlar değişmez (immutable) olduğundan referans
// paylaşımı güvenlidir ve 60 snapshot'ın belleği şişirmesini önler.
function clonePatchesPreservingImage(patches) {
  const out = {};
  for (const page of Object.keys(patches || {})) {
    out[page] = (patches[page] || []).map((p) => {
      if (!p || typeof p !== 'object') return p;
      const { imageData, sourceMaskData, ...rest } = p;
      const clone = deepClone(rest);
      if (imageData !== undefined) clone.imageData = imageData;
      if (sourceMaskData !== undefined) clone.sourceMaskData = sourceMaskData;
      return clone;
    });
  }
  return out;
}

function normalizeBox(box) {
  const ymin = clamp(Math.min(box[0], box[2]), 0, 1000);
  const xmin = clamp(Math.min(box[1], box[3]), 0, 1000);
  const ymax = clamp(Math.max(box[0], box[2]), 0, 1000);
  const xmax = clamp(Math.max(box[1], box[3]), 0, 1000);
  return [ymin, xmin, ymax, xmax];
}

function expandBox(box, padding) {
  const normalized = normalizeBox(box);
  return normalizeBox([
    normalized[0] - padding,
    normalized[1] - padding,
    normalized[2] + padding,
    normalized[3] + padding,
  ]);
}

// Kutuyu (dx,dy) kadar kaydırır ama 0–1000 sınırları içinde GENİŞLİK/YÜKSEKLİĞİ koruyarak tutar.
// Köşeleri bağımsız clamp etmenin aksine kutu kenarda ezilmez.
function shiftBoxClamped(box, dx, dy) {
  const w = Math.max(0, box[3] - box[1]);
  const h = Math.max(0, box[2] - box[0]);
  const x = clamp(box[1] + dx, 0, Math.max(0, 1000 - w));
  const y = clamp(box[0] + dy, 0, Math.max(0, 1000 - h));
  return [y, x, y + h, x + w];
}

// Resize sırasında hareketli köşeyi, sabit (anchor) köşeye göre minimum boyutta tutar; kutu sıfıra inmez.
// box ve initial [ymin, xmin, ymax, xmax] formatında, normalize ÖNCESİ uygulanır.
function enforceMinResize(box, handle, initial) {
  const isTop = handle === 'nw' || handle === 'ne';
  const isLeft = handle === 'nw' || handle === 'sw';
  const anchorY = isTop ? initial[2] : initial[0];
  const anchorX = isLeft ? initial[3] : initial[1];
  const movingYIdx = isTop ? 0 : 2;
  const movingXIdx = isLeft ? 1 : 3;
  const out = [...box];
  if (Math.abs(out[movingYIdx] - anchorY) < MIN_BOX_SIZE) {
    out[movingYIdx] = anchorY + (isTop ? -MIN_BOX_SIZE : MIN_BOX_SIZE);
  }
  if (Math.abs(out[movingXIdx] - anchorX) < MIN_BOX_SIZE) {
    out[movingXIdx] = anchorX + (isLeft ? -MIN_BOX_SIZE : MIN_BOX_SIZE);
  }
  return out;
}

// Shift ile orantılı (en-boy oranı korumalı) resize: sabit köşeye göre en-boy oranını korur.
function applyAspectResize(initial, box, handle) {
  const initW = Math.max(1e-6, initial[3] - initial[1]);
  const initH = Math.max(1e-6, initial[2] - initial[0]);
  const aspect = initW / initH;
  const isTop = handle === 'nw' || handle === 'ne';
  const isLeft = handle === 'nw' || handle === 'sw';
  const anchorY = isTop ? initial[2] : initial[0];
  const anchorX = isLeft ? initial[3] : initial[1];
  const movingY = isTop ? box[0] : box[2];
  const movingX = isLeft ? box[1] : box[3];
  let w = Math.abs(movingX - anchorX);
  let h = Math.abs(movingY - anchorY);
  if (w / Math.max(1e-6, h) > aspect) h = w / aspect;
  else w = h * aspect;
  const out = [...box];
  const newX = anchorX + (isLeft ? -w : w);
  const newY = anchorY + (isTop ? -h : h);
  if (isLeft) out[1] = newX;
  else out[3] = newX;
  if (isTop) out[0] = newY;
  else out[2] = newY;
  return out;
}

function boxWidth(box) {
  return Math.max(0, box[3] - box[1]);
}

function boxHeight(box) {
  return Math.max(0, box[2] - box[0]);
}

function boxArea(box) {
  return boxWidth(box) * boxHeight(box);
}

function createSourceMaskBox(box) {
  const normalized = normalizeBox(box);
  const padding = clamp(Math.min(boxWidth(normalized), boxHeight(normalized)) * 0.22, 24, 90);
  return expandBox(normalized, padding);
}

function getPatchSourceCleanupBox(patch) {
  // If an explicit cleanup box is provided, use it as-is.
  // This prevents unintended extra cleanup area for precise cut operations.
  if (patch?.sourceMaskBox) {
    return normalizeBox(patch.sourceMaskBox);
  }
  return createSourceMaskBox(patch.sourceBox || patch.targetBox);
}

function boxesOverlap(a, b) {
  return !(a[3] <= b[1] || a[1] >= b[3] || a[2] <= b[0] || a[0] >= b[2]);
}

function overlapArea(a, b) {
  if (!boxesOverlap(a, b)) return 0;
  const x = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  const y = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0]));
  return x * y;
}

function pixelBox(box, width, height) {
  const normalized = normalizeBox(box);
  return {
    x: (normalized[1] / 1000) * width,
    y: (normalized[0] / 1000) * height,
    width: (boxWidth(normalized) / 1000) * width,
    height: (boxHeight(normalized) / 1000) * height,
  };
}

function sourceCleanupRect(box, width, height, bleed = 1) {
  const rect = pixelBox(box, width, height);
  const x = clamp(Math.floor(rect.x) - bleed, 0, width);
  const y = clamp(Math.floor(rect.y) - bleed, 0, height);
  const right = clamp(Math.ceil(rect.x + rect.width) + bleed, 0, width);
  const bottom = clamp(Math.ceil(rect.y + rect.height) + bleed, 0, height);
  return {
    x,
    y,
    width: Math.max(0, right - x),
    height: Math.max(0, bottom - y),
  };
}

function averageSampleColor(ctx, box, width, height) {
  const rect = pixelBox(box, width, height);
  const sx = clamp(Math.floor(rect.x - 12), 0, Math.max(0, width - 1));
  const sy = clamp(Math.floor(rect.y - 12), 0, Math.max(0, height - 1));
  const sw = clamp(Math.ceil(rect.width + 24), 1, width - sx);
  const sh = clamp(Math.ceil(rect.height + 24), 1, height - sy);
  const data = ctx.getImageData(sx, sy, sw, sh).data;
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  for (let i = 0; i < data.length; i += 16) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    count += 1;
  }
  if (!count) return 'rgb(255, 255, 255)';
  return `rgb(${Math.round(r / count)}, ${Math.round(g / count)}, ${Math.round(b / count)})`;
}

function dominantRingColor(ctx, box, width, height) {
  const rect = pixelBox(box, width, height);
  const strips = [
    { x: rect.x - 10, y: rect.y - 10, width: rect.width + 20, height: 8 },
    { x: rect.x - 10, y: rect.y + rect.height + 2, width: rect.width + 20, height: 8 },
    { x: rect.x - 10, y: rect.y, width: 8, height: rect.height },
    { x: rect.x + rect.width + 2, y: rect.y, width: 8, height: rect.height },
  ];
  const buckets = new Map();
  strips.forEach((strip) => {
    const sx = clamp(Math.floor(strip.x), 0, Math.max(0, width - 1));
    const sy = clamp(Math.floor(strip.y), 0, Math.max(0, height - 1));
    const sw = clamp(Math.ceil(strip.width), 1, width - sx);
    const sh = clamp(Math.ceil(strip.height), 1, height - sy);
    const data = ctx.getImageData(sx, sy, sw, sh).data;
    for (let i = 0; i < data.length; i += 12) {
      const a = data[i + 3];
      if (a < 10) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const key = `${Math.round(r / 10)}-${Math.round(g / 10)}-${Math.round(b / 10)}`;
      const current = buckets.get(key) || { count: 0, r: 0, g: 0, b: 0 };
      current.count += 1;
      current.r += r;
      current.g += g;
      current.b += b;
      buckets.set(key, current);
    }
  });
  let winner = null;
  buckets.forEach((entry) => {
    if (!winner || entry.count > winner.count) winner = entry;
  });
  if (!winner?.count) return 'rgb(255, 255, 255)';
  return `rgb(${Math.round(winner.r / winner.count)}, ${Math.round(winner.g / winner.count)}, ${Math.round(winner.b / winner.count)})`;
}

function sampleBackgroundColor(ctx, box, width, height, mode = 'auto') {
  if (mode === 'white') return 'rgb(255, 255, 255)';
  try {
    if (mode === 'average') return averageSampleColor(ctx, box, width, height);
    return dominantRingColor(ctx, box, width, height);
  } catch {
    try {
      return averageSampleColor(ctx, box, width, height);
    } catch {
      return 'rgb(255, 255, 255)';
    }
  }
}

function buildTextGrid(entries, cols, rows, step) {
  const grid = new Uint8Array(cols * rows);
  (entries || []).forEach((entry) => {
    const minX = clamp(Math.floor(((entry.box[1] / 1000) * cols * step) / step), 0, cols - 1);
    const maxX = clamp(Math.ceil(((entry.box[3] / 1000) * cols * step) / step), 0, cols - 1);
    const minY = clamp(Math.floor(((entry.box[0] / 1000) * rows * step) / step), 0, rows - 1);
    const maxY = clamp(Math.ceil(((entry.box[2] / 1000) * rows * step) / step), 0, rows - 1);
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        grid[y * cols + x] = 1;
      }
    }
  });
  return grid;
}

function classifyCandidate(stats, enabledTypes) {
  const width = stats.width;
  const height = stats.height;
  const area = width * height;
  const aspect = width / Math.max(1, height);
  const set = new Set(enabledTypes || []);
  const wants = (type) => !set.size || set.has(type);

  if (wants('checkbox') && width <= 64 && height <= 64 && area <= 2800)
    return { type: 'checkbox', label: 'Isaret' };
  if (wants('draggable') && area > 6000 && aspect > 0.8 && aspect < 6 && stats.colorRatio > 0.08)
    return { type: 'draggable', label: 'Suruklenebilir' };
  if (wants('note') && stats.colorRatio > 0.22) return { type: 'note', label: 'Not' };
  if (wants('handwriting') && stats.darkRatio > 0.09 && stats.textOverlap < 0.12 && area > 360)
    return { type: 'handwriting', label: 'El yazisi' };
  if (wants('answer') && area > 320 && area < 32000 && stats.textOverlap < 0.2)
    return { type: 'answer', label: 'Cevap' };
  if (wants('checkbox')) return { type: 'checkbox', label: 'Isaret' };
  return null;
}

function detectInteractiveElementsLocal(canvas, textEntries, config, samplingMode = 'auto') {
  const ctx = canvas?.getContext('2d', { willReadFrequently: true });
  if (!ctx || !canvas?.width || !canvas?.height) return [];

  const { width, height } = canvas;
  let imageData;
  try {
    imageData = ctx.getImageData(0, 0, width, height);
  } catch {
    return [];
  }

  const sensitivity = config?.sensitivity || 'medium';
  const enabledTypes = config?.enabledTypes || [
    'checkbox',
    'draggable',
    'answer',
    'note',
    'handwriting',
  ];
  const step = sensitivity === 'high' ? 3 : sensitivity === 'low' ? 6 : 4;
  const darkThreshold = sensitivity === 'high' ? 0.03 : sensitivity === 'low' ? 0.08 : 0.05;
  const colorThreshold = sensitivity === 'high' ? 0.02 : sensitivity === 'low' ? 0.05 : 0.03;
  const cols = Math.ceil(width / step);
  const rows = Math.ceil(height / step);
  const grid = new Uint8Array(cols * rows);
  const scores = new Array(cols * rows);
  const textGrid = buildTextGrid(textEntries || [], cols, rows, step);
  const { data } = imageData;

  for (let gy = 0; gy < rows; gy += 1) {
    for (let gx = 0; gx < cols; gx += 1) {
      let samples = 0;
      let darkVotes = 0;
      let colorVotes = 0;
      let strongVotes = 0;
      let lineVotes = 0;
      const startX = gx * step;
      const startY = gy * step;

      for (let y = startY; y < Math.min(height, startY + step); y += 1) {
        for (let x = startX; x < Math.min(width, startX + step); x += 1) {
          const index = (y * width + x) * 4;
          const r = data[index];
          const g = data[index + 1];
          const b = data[index + 2];
          const a = data[index + 3];
          if (a < 10) continue;

          const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          const saturation = Math.max(r, g, b) - Math.min(r, g, b);
          const isRed = r > 150 && r - Math.max(g, b) > 28;
          const isGreen = g > 130 && g - r > 22 && g - b > 12;
          const isBlue = b > 130 && b - r > 16 && b - g > 10;
          const isColorMark = saturation > 36 && Math.max(r, g, b) < 245;
          const isDarkMark = luminance < 150 && (saturation > 12 || Math.max(r, g, b) < 135);

          if (isColorMark || isRed || isGreen || isBlue) colorVotes += 1;
          if (isDarkMark) darkVotes += 1;
          if (isRed || isGreen || isBlue) strongVotes += 1;

          const rightIndex = x + 1 < width ? index + 4 : index;
          const bottomIndex = y + 1 < height ? index + width * 4 : index;
          const edgeScore =
            Math.abs(r - data[rightIndex]) +
            Math.abs(g - data[rightIndex + 1]) +
            Math.abs(b - data[rightIndex + 2]) +
            Math.abs(r - data[bottomIndex]) +
            Math.abs(g - data[bottomIndex + 1]) +
            Math.abs(b - data[bottomIndex + 2]);
          if (edgeScore > 160) lineVotes += 1;
          samples += 1;
        }
      }

      if (!samples) continue;
      const darkRatio = darkVotes / samples;
      const colorRatio = colorVotes / samples;
      const lineRatio = lineVotes / samples;
      const textCovered = textGrid[gy * cols + gx] === 1;
      const shouldMark =
        colorRatio >= colorThreshold ||
        strongVotes >= Math.max(1, Math.round(samples * 0.01)) ||
        (!textCovered && darkRatio >= darkThreshold && lineRatio >= 0.04);

      if (
        shouldMark &&
        !(textCovered && colorRatio < colorThreshold * 1.4 && darkRatio < darkThreshold * 1.6)
      ) {
        grid[gy * cols + gx] = 1;
        scores[gy * cols + gx] = { darkRatio, colorRatio, strongVotes };
      }
    }
  }

  const visited = new Uint8Array(grid.length);
  const components = [];
  const neighbors = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
    [-1, -1],
    [1, 1],
    [-1, 1],
    [1, -1],
  ];

  for (let index = 0; index < grid.length; index += 1) {
    if (!grid[index] || visited[index]) continue;
    const queue = [index];
    visited[index] = 1;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let cells = 0;
    let darkSum = 0;
    let colorSum = 0;
    let strongSum = 0;

    while (queue.length) {
      const current = queue.pop();
      const x = current % cols;
      const y = Math.floor(current / cols);
      const score = scores[current] || { darkRatio: 0, colorRatio: 0, strongVotes: 0 };
      cells += 1;
      darkSum += score.darkRatio;
      colorSum += score.colorRatio;
      strongSum += score.strongVotes;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);

      neighbors.forEach(([dx, dy]) => {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) return;
        const next = ny * cols + nx;
        if (!grid[next] || visited[next]) return;
        visited[next] = 1;
        queue.push(next);
      });
    }

    const widthPx = (maxX - minX + 1) * step;
    const heightPx = (maxY - minY + 1) * step;
    const areaPx = widthPx * heightPx;
    const fillRatio = cells / Math.max(1, (maxX - minX + 1) * (maxY - minY + 1));
    const aspect = widthPx / Math.max(1, heightPx);
    const normalizedBox = normalizeBox([
      ((minY * step) / height) * 1000,
      ((minX * step) / width) * 1000,
      (Math.min(height, (maxY + 1) * step) / height) * 1000,
      (Math.min(width, (maxX + 1) * step) / width) * 1000,
    ]);
    const overlapWithText = (textEntries || []).reduce(
      (best, entry) =>
        Math.max(best, overlapArea(normalizedBox, entry.box) / Math.max(1, boxArea(normalizedBox))),
      0
    );
    const looksLikeWord = widthPx > 48 && heightPx < 24 && aspect > 2.3 && overlapWithText > 0.18;
    const looksLikeRuleLine = (widthPx > 160 && heightPx < 16) || (heightPx > 160 && widthPx < 16);
    const isUseful =
      cells >= 1 &&
      areaPx >= 36 &&
      areaPx <= width * height * 0.18 &&
      fillRatio > 0.015 &&
      aspect < 10 &&
      aspect > 0.08 &&
      !looksLikeWord &&
      !looksLikeRuleLine &&
      !(overlapWithText > 0.45 && colorSum / Math.max(1, cells) < 0.05);
    if (!isUseful) continue;

    const stats = {
      width: widthPx,
      height: heightPx,
      area: areaPx,
      darkRatio: darkSum / Math.max(1, cells),
      colorRatio: colorSum / Math.max(1, cells),
      strongRatio: strongSum / Math.max(1, cells),
      fillRatio,
      textOverlap: overlapWithText,
    };
    const classified = classifyCandidate(stats, enabledTypes);
    if (!classified) continue;

    components.push({
      id: uid('mask'),
      source: 'auto',
      type: classified.type,
      label: classified.label,
      bgColor: sampleBackgroundColor(ctx, normalizedBox, width, height, samplingMode),
      box: normalizedBox,
    });
  }

  return components.slice(0, sensitivity === 'high' ? 48 : sensitivity === 'low' ? 18 : 32);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  // revoke'u ertele: tarayıcı büyük blob'un indirmesini okumadan URL iptal edilirse indirme boş kalır.
  setTimeout(() => {
    URL.revokeObjectURL(url);
    link.remove();
  }, 60000);
}

function canvasToBlob(canvas, type = 'image/png', quality = 0.92) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function smoothstep(edge0, edge1, value) {
  if (edge0 === edge1) return value < edge0 ? 0 : 1;
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function createFeatheredPatchAsset(sourceCanvas, sourceRect, feather = 14) {
  if (!sourceCanvas || !sourceRect?.width || !sourceRect?.height) return null;
  const bleed = Math.max(6, Math.round(feather * 1.6));
  const cropX = Math.max(0, Math.floor(sourceRect.x - bleed));
  const cropY = Math.max(0, Math.floor(sourceRect.y - bleed));
  const cropRight = Math.min(
    sourceCanvas.width,
    Math.ceil(sourceRect.x + sourceRect.width + bleed)
  );
  const cropBottom = Math.min(
    sourceCanvas.height,
    Math.ceil(sourceRect.y + sourceRect.height + bleed)
  );
  const cropWidth = Math.max(1, cropRight - cropX);
  const cropHeight = Math.max(1, cropBottom - cropY);
  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = cropWidth;
  cropCanvas.height = cropHeight;
  const cropCtx = cropCanvas.getContext('2d', { alpha: true, willReadFrequently: true });
  if (!cropCtx) return null;

  cropCtx.drawImage(sourceCanvas, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

  try {
    const imageData = cropCtx.getImageData(0, 0, cropWidth, cropHeight);
    const data = imageData.data;
    const fadeRadius = Math.max(4, feather);
    for (let y = 0; y < cropHeight; y += 1) {
      for (let x = 0; x < cropWidth; x += 1) {
        const index = (y * cropWidth + x) * 4;
        const edgeDistance = Math.min(x, y, cropWidth - 1 - x, cropHeight - 1 - y);
        const alphaFactor = smoothstep(0, fadeRadius, edgeDistance);
        data[index + 3] = Math.round((data[index + 3] ?? 255) * alphaFactor);
      }
    }
    cropCtx.putImageData(imageData, 0, 0);
  } catch (err) {
    // Feather (kenar yumuşatma) başarısız olursa patch sert kenarla yine oluşur; sessiz kalma.
    console.error('Patch kenar yumuşatma başarısız:', err);
  }

  return {
    imageData: cropCanvas.toDataURL('image/png', 1),
    edgeBleed: {
      left: (sourceRect.x - cropX) / Math.max(1, sourceRect.width),
      right: (cropRight - (sourceRect.x + sourceRect.width)) / Math.max(1, sourceRect.width),
      top: (sourceRect.y - cropY) / Math.max(1, sourceRect.height),
      bottom: (cropBottom - (sourceRect.y + sourceRect.height)) / Math.max(1, sourceRect.height),
    },
  };
}

function getPatchRenderMetrics(patch, targetRect) {
  const bleed = patch.edgeBleed || { left: 0, right: 0, top: 0, bottom: 0 };
  const baseWidth = targetRect.width * (patch.scale || 1);
  const baseHeight = targetRect.height * (patch.scale || 1);
  const drawWidth = baseWidth * (1 + bleed.left + bleed.right);
  const drawHeight = baseHeight * (1 + bleed.top + bleed.bottom);
  const centerX =
    targetRect.x + targetRect.width / 2 + ((bleed.right - bleed.left) * baseWidth) / 2;
  const centerY =
    targetRect.y + targetRect.height / 2 + ((bleed.bottom - bleed.top) * baseHeight) / 2;
  return { centerX, centerY, drawWidth, drawHeight };
}

// scale: PDF-points → piksel çarpanı (raster canvas ölçeği). fontSize PDF noktası olarak saklanır,
// böylece ekran ve tüm export yolları aynı oranı kullanır (WYSIWYG).
function drawWrappedText(ctx, element, width, height, scale = 1) {
  const rect = pixelBox(element.box, width, height);
  const fontSize = Math.max(6, element.fontSize || 16) * scale;
  ctx.save();
  ctx.fillStyle = element.bgColor || 'rgb(255,255,255)';
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  ctx.fillStyle = element.color || '#000000';
  ctx.font = `${fontSize}px ${element.fontFamily || 'Arial, sans-serif'}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lines = String(element.text || '')
    .split(/\n+/)
    .slice(0, 8);
  const lineHeight = fontSize * 1.25;
  const totalHeight = lines.length * lineHeight;
  const startY = rect.y + rect.height / 2 - totalHeight / 2 + lineHeight / 2;
  lines.forEach((line, index) => {
    ctx.fillText(line, rect.x + rect.width / 2, startY + index * lineHeight, rect.width - 8);
  });
  ctx.restore();
}

function isTickMask(mask) {
  return mask?.type === 'checkbox';
}

function tickStrokeGeometry(rect) {
  return {
    x1: rect.x + rect.width * 0.2,
    y1: rect.y + rect.height * 0.56,
    x2: rect.x + rect.width * 0.42,
    y2: rect.y + rect.height * 0.8,
    x3: rect.x + rect.width * 0.82,
    y3: rect.y + rect.height * 0.22,
  };
}

function drawMaskDecoration(ctx, mask, width, height) {
  if (!isTickMask(mask)) return;
  const rect = pixelBox(mask.box, width, height);
  const size = Math.min(rect.width, rect.height);
  if (size < 6) return;
  const stroke = tickStrokeGeometry(rect);
  ctx.save();
  ctx.strokeStyle = mask.markColor || '#0f766e';
  ctx.lineWidth = Math.max(2, size * 0.12);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(stroke.x1, stroke.y1);
  ctx.lineTo(stroke.x2, stroke.y2);
  ctx.lineTo(stroke.x3, stroke.y3);
  ctx.stroke();
  ctx.restore();
}

function buildMaskSvg(mask, width, height) {
  const rect = pixelBox(mask.box, width, height);
  const parts = [
    `<rect x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" fill="${escapeXml(mask.bgColor || 'rgb(255,255,255)')}" />`,
  ];
  if (isTickMask(mask)) {
    const stroke = tickStrokeGeometry(rect);
    const strokeWidth = Math.max(2, Math.min(rect.width, rect.height) * 0.12);
    parts.push(
      `<path d="M ${stroke.x1} ${stroke.y1} L ${stroke.x2} ${stroke.y2} L ${stroke.x3} ${stroke.y3}" fill="none" stroke="${escapeXml(mask.markColor || '#0f766e')}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" />`
    );
  }
  return parts.join('');
}

async function composePageCanvas(baseCanvas, masks, patches, texts, scale = 1) {
  const out = document.createElement('canvas');
  out.width = baseCanvas.width;
  out.height = baseCanvas.height;
  const ctx = out.getContext('2d', { alpha: false });
  if (!ctx) return null;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(baseCanvas, 0, 0);
  (masks || []).forEach((mask) => {
    const rect = pixelBox(mask.box, out.width, out.height);
    ctx.fillStyle = mask.bgColor || 'rgb(255,255,255)';
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    drawMaskDecoration(ctx, mask, out.width, out.height);
  });
  for (const patch of patches || []) {
    const image = await loadImage(patch.imageData).catch(() => null);

    if (!patch.isClone) {
      const sourceRect = sourceCleanupRect(
        getPatchSourceCleanupBox(patch),
        out.width,
        out.height,
        2
      );
      ctx.fillStyle = patch.bgColor || 'rgb(255,255,255)';
      ctx.fillRect(sourceRect.x, sourceRect.y, sourceRect.width, sourceRect.height);
    }
    if (!image) continue;
    const targetRect = pixelBox(patch.targetBox, out.width, out.height);
    const { centerX, centerY, drawWidth, drawHeight } = getPatchRenderMetrics(patch, targetRect);
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(((patch.rotation || 0) * Math.PI) / 180);
    ctx.filter = `brightness(${patch.brightness || 100}%) contrast(${patch.contrast || 100}%)`;
    ctx.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    ctx.restore();
  }
  (texts || []).forEach((element) => drawWrappedText(ctx, element, out.width, out.height, scale));
  return out;
}

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function crc32(bytes) {
  let crc = -1;
  for (let i = 0; i < bytes.length; i += 1) {
    crc ^= bytes[i];
    for (let bit = 0; bit < 8; bit += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ -1) >>> 0;
}

function toDosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  return {
    dosTime:
      ((date.getHours() & 0x1f) << 11) |
      ((date.getMinutes() & 0x3f) << 5) |
      Math.floor(date.getSeconds() / 2),
    dosDate:
      (((year - 1980) & 0x7f) << 9) |
      (((date.getMonth() + 1) & 0x0f) << 5) |
      (date.getDate() & 0x1f),
  };
}

function createStoredZip(files) {
  const encoder = new TextEncoder();
  const chunks = [];
  const centralDirectory = [];
  let offset = 0;
  const { dosTime, dosDate } = toDosDateTime(new Date());
  files.forEach((file) => {
    const nameBytes = encoder.encode(file.name);
    const dataBytes = file.data instanceof Uint8Array ? file.data : encoder.encode(file.data);
    const checksum = crc32(dataBytes);
    const local = new Uint8Array(30 + nameBytes.length + dataBytes.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, dosTime, true);
    localView.setUint16(12, dosDate, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, dataBytes.length, true);
    localView.setUint32(22, dataBytes.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);
    local.set(nameBytes, 30);
    local.set(dataBytes, 30 + nameBytes.length);
    chunks.push(local);

    const central = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, dosTime, true);
    centralView.setUint16(14, dosDate, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, dataBytes.length, true);
    centralView.setUint32(24, dataBytes.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centralDirectory.push(central);
    offset += local.length;
  });
  const centralSize = centralDirectory.reduce((sum, chunk) => sum + chunk.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);
  return new Blob([...chunks, ...centralDirectory, end], { type: 'application/zip' });
}

async function extractTextEntries(page, viewport, pdfjsLib) {
  try {
    const textContent = await page.getTextContent();
    return (textContent.items || [])
      .map((item, index) => {
        const text = String(item?.str || '').trim();
        if (!text) return null;
        const transformed = pdfjsLib?.Util?.transform
          ? pdfjsLib.Util.transform(viewport.transform, item.transform)
          : item.transform;
        const x = transformed[4];
        const y = transformed[5];
        const fontHeight = Math.max(8, Math.abs(transformed[3]) || Math.abs(item.height) || 10);
        const textWidth = Math.max(
          fontHeight * 0.7,
          (item.width || text.length * fontHeight * 0.45) * viewport.scale
        );
        return {
          id: `text-${index}`,
          text,
          fontSize: Math.round(fontHeight),
          box: normalizeBox([
            ((y - fontHeight) / viewport.height) * 1000,
            (x / viewport.width) * 1000,
            (y / viewport.height) * 1000,
            ((x + textWidth) / viewport.width) * 1000,
          ]),
        };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function summarizePageText(entries) {
  return (entries || [])
    .map((entry) => entry.text)
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 220);
}

function resolveColorPickerValue(val, fallback = '#ffffff') {
  if (!val || val === 'transparent') return fallback;
  const m = String(val).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (m) {
    const hex = [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('');
    return `#${hex}`;
  }
  return val.startsWith('#') ? val : fallback;
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

const T = {
  bg: '#f7faff',
  surface: '#ffffff',
  surfaceAlt: '#f8fafc',
  surfaceHover: '#f1f5f9',
  shell: '#eef4fb',
  shellSoft: '#f6f9fd',
  pasteboard: '#0d1726',
  pasteboardAlt: '#111c2d',
  border: '#d8e2ef',
  borderHi: '#e5edf6',
  text: '#0f172a',
  muted: '#64748b',
  accent: '#2563eb',
  accentBg: '#eff6ff',
  accentBorder: '#93c5fd',
  success: '#16a34a',
  warn: '#d97706',
  danger: '#dc2626',
};

const PDF_PAGE_SIDEBAR_WIDTH = 240;
const PDF_RIGHT_PANEL_WIDTH = 300;

// ── Etkileşim/render sabitleri (önceden dosyaya dağılmış magic number'lar)
const SCALE_CLAMP_MIN = 0.4; // sayfa fit raster ölçeği alt sınırı
const SCALE_CLAMP_MAX = 2.6; // sayfa fit raster ölçeği üst sınırı
const STAGE_FIT_PADDING = 80; // sayfayı kaba sığdırırken bırakılan boşluk (px)
const PASTE_OFFSET = 18; // kopyala/yapıştır ötelemesi (normalize birim)
const SNAP_THRESHOLD = 8; // hizalama yakalama eşiği (normalize birim)
const MIN_BOX_SIZE = 10; // resize sırasında minimum kutu genişlik/yükseklik (normalize birim)
const NUDGE_STEP = 1; // ok tuşuyla ince kaydırma (normalize birim)
const NUDGE_STEP_LARGE = 10; // Shift+ok tuşuyla kaba kaydırma (normalize birim)
const ZOOM_MIN = 0.25; // kullanıcı görüntü zoom'u alt sınırı
const ZOOM_MAX = 8; // kullanıcı görüntü zoom'u üst sınırı
const ZOOM_WHEEL_SENSITIVITY = 0.0015; // Ctrl+tekerlek zoom hassasiyeti
const ZOOM_SHARPEN_THRESHOLD = 1.8; // bu zoom üstünde netlik için yeniden raster tetiklenir
const RENDER_SCALES = {
  auto: 1.6, // otomatik tarama raster ölçeği
  png: 2.6, // PNG dışa aktarma
  jpeg: 2.4, // JPEG dışa aktarma
  pdf: 2.4, // temizlenmiş PDF dışa aktarma
  thumb: 0.22, // küçük resim ölçeği
  svg: 2, // SVG dışa aktarma raster ölçeği
};

const WORKFLOW_PILL_STYLE = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 9px',
  borderRadius: 999,
  border: `1px solid ${T.border}`,
  background: '#f1f5f9',
  color: T.text,
  fontSize: 11,
  fontWeight: 800,
  whiteSpace: 'nowrap',
};

function tbBtn(active = false, opts = {}) {
  const isDanger = opts.danger && !opts.disabled;
  return {
    height: opts.small ? 28 : 32,
    padding: opts.small ? '0 10px' : '0 13px',
    borderRadius: opts.small ? 8 : 9,
    border: active
      ? `1px solid ${isDanger ? '#fca5a5' : '#93c5fd'}`
      : `1px solid ${isDanger ? '#fecaca' : T.border}`,
    background: active
      ? (isDanger ? '#fef2f2' : 'linear-gradient(180deg,#ffffff 0%,#eaf2ff 100%)')
      : (isDanger ? '#fef2f2' : '#ffffff'),
    color: isDanger ? '#dc2626' : active ? '#1d4ed8' : '#334155',
    boxShadow: active ? 'inset 0 1px 0 rgba(255,255,255,.9), 0 1px 2px rgba(37,99,235,.12)' : 'inset 0 1px 0 rgba(255,255,255,.85)',
    fontWeight: opts.small ? 700 : 800,
    fontSize: opts.small ? 10.5 : 11,
    cursor: opts.disabled ? 'default' : 'pointer',
    opacity: opts.disabled ? 0.4 : 1,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    whiteSpace: 'nowrap',
    flexShrink: 0,
    pointerEvents: opts.disabled ? 'none' : 'auto',
    transition: 'background .15s, border-color .15s, box-shadow .15s, color .15s',
  };
}

function iconTypeLabel(item) {
  if (item.text !== undefined) return { icon: 'T', color: '#7c3aed' };
  if (item.targetBox) return { icon: item.isClone ? '📋' : '✂', color: '#0284c7' };
  if (item.type === 'checkbox') return { icon: '☑', color: '#16a34a' };
  if (item.type === 'draggable') return { icon: '⊞', color: '#d97706' };
  if (item.type === 'answer') return { icon: 'A', color: '#ca8a04' };
  if (item.type === 'note') return { icon: '📝', color: '#65a30d' };
  if (item.type === 'handwriting') return { icon: '✍', color: '#c084fc' };
  return { icon: '□', color: T.muted };
}

function Divider() {
  return (
    <div
      style={{
        width: 1,
        alignSelf: 'stretch',
        background: T.border,
        margin: '4px 3px',
        flexShrink: 0,
      }}
    />
  );
}

function SectionLabel({ children }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 800,
        color: T.muted,
        letterSpacing: 0.3,
        padding: '0 0 6px',
      }}
    >
      {children}
    </div>
  );
}

function PropRow({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 26 }}>
      <div style={{ fontSize: 11, color: T.muted, minWidth: 70, fontWeight: 600 }}>{label}</div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 5 }}>{children}</div>
    </div>
  );
}

function RangeRow({ label, value, min, max, step = 1, onChange, unit = '' }) {
  return (
    <div style={{ display: 'grid', gap: 3 }}>
      <div
        style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: T.muted }}
      >
        <span style={{ fontWeight: 600 }}>{label}</span>
        <span style={{ color: T.text }}>
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: T.accent, cursor: 'pointer' }}
      />
    </div>
  );
}

function WorkflowBadge({ meta, compact = false, label = '' }) {
  if (!meta) return null;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: compact ? 4 : 6,
        padding: compact ? '3px 7px' : '4px 9px',
        borderRadius: 999,
        border: `1px solid ${meta.border}`,
        background: meta.bg,
        color: meta.color,
        fontSize: compact ? 8.5 : 9,
        fontWeight: 800,
        lineHeight: 1,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: compact ? 5 : 6,
          height: compact ? 5 : 6,
          borderRadius: 999,
          background: meta.color,
        }}
      />
      {label || meta.label}
    </span>
  );
}

function buildPdfPageWorkflowSummary({
  pageNumber,
  pageMasks,
  patches,
  textElements,
  currentPage,
  busy,
  bulkBusy,
}) {
  const maskItems = pageMasks[pageNumber] || [];
  const patchItems = patches[pageNumber] || [];
  const textItems = textElements[pageNumber] || [];
  const autoMaskCount = maskItems.filter((item) => item.source === 'auto').length;
  const manualMaskCount = Math.max(0, maskItems.length - autoMaskCount);
  const totalEdits = maskItems.length + patchItems.length + textItems.length;
  const hasCoverage = totalEdits > 0;
  const hasRefinement = manualMaskCount > 0 || patchItems.length > 0 || textItems.length > 0;
  const hasReview = autoMaskCount === 0 || hasRefinement;
  const checks = [
    { label: 'Katman', ok: hasCoverage },
    { label: 'İşleme', ok: hasRefinement },
    { label: 'Kontrol', ok: hasReview },
  ];
  const readyChecks = checks.filter((check) => check.ok).length;
  const quality = Math.round((readyChecks / checks.length) * 100);
  let statusKey = 'draft';
  if (pageNumber === currentPage && (busy || bulkBusy)) statusKey = 'building';
  else if (!hasCoverage) statusKey = 'draft';
  else if (autoMaskCount > 0 && !hasRefinement) statusKey = 'review';
  else statusKey = 'ready';

  return {
    pageNumber,
    statusKey,
    statusMeta: WORKFLOW_STATUS_META[statusKey] || WORKFLOW_STATUS_META.draft,
    quality,
    readyChecks,
    totalChecks: checks.length,
    checks,
    counts: {
      masks: maskItems.length,
      autoMasks: autoMaskCount,
      manualMasks: manualMaskCount,
      patches: patchItems.length,
      texts: textItems.length,
      totalEdits,
    },
  };
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function PdfCleanStudio({
  title = 'PDF Düzenleme Stüdyosu',
  fullScreen = false,
  onClose = null,
  integrationBook = null,
  integrationBooks = [],
  integrationActivities = [],
  onIntegratePages = null,
}) {
  // ── Core state
  const [file, setFile] = useState(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pdfjsLib, setPdfjsLib] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [thumbnails, setThumbnails] = useState([]);
  const [pageViewport, setPageViewport] = useState({ width: 1, height: 1 });
  const [displayScale, setDisplayScale] = useState(1); // PDF noktası → ekran pikseli (font ölçeği için)
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [pageSummary, setPageSummary] = useState('');
  const [pageTextEntries, setPageTextEntries] = useState({});
  const [pageMasks, setPageMasks] = useState({});
  const [patches, setPatches] = useState({});
  const [textElements, setTextElements] = useState({});
  const [historyState, setHistoryState] = useState({ stack: [], index: -1 });
  const [copiedItem, setCopiedItem] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedType, setSelectedType] = useState(null);
  const [activeMaskId, setActiveMaskId] = useState(null);
  const [editingTextId, setEditingTextId] = useState(null);
  const [status, setStatus] = useState('PDF dosyasını sürükleyin veya seçin.');
  const [busy, setBusy] = useState(false);
  const [renderBusy, setRenderBusy] = useState(false); // sayfa render kilidi (tarama busy'sinden ayrı)
  const [bulkBusy, setBulkBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [mode, setMode] = useState('view');
  const [patchToolMode, setPatchToolMode] = useState('cut');
  const [samplingMode, setSamplingMode] = useState('auto');
  const [showSettings, setShowSettings] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [draftRect, setDraftRect] = useState(null);
  const [drawState, setDrawState] = useState(null);
  const [draggingElement, setDraggingElement] = useState(null);
  const [dragGhost, setDragGhost] = useState(null);
  const [alignmentGuides, setAlignmentGuides] = useState([]);
  const [resizing, setResizing] = useState(null);
  const [aiConfig, setAiConfig] = useState({
    sensitivity: 'medium',
    enabledTypes: ['checkbox', 'draggable', 'answer', 'note', 'handwriting'],
  });

  // ── New state
  const [rightTab, setRightTab] = useState('katmanlar');
  const [isDragOver, setIsDragOver] = useState(false);
  const [showKeyHelp, setShowKeyHelp] = useState(false);
  const [layerVisibility, setLayerVisibility] = useState({});
  const [pageJumpValue, setPageJumpValue] = useState('');
  const [cursorCoords, setCursorCoords] = useState(null);
  const [integrationPages, setIntegrationPages] = useState({});
  const [integrationPreview, setIntegrationPreview] = useState(null);
  const [integrationBusy, setIntegrationBusy] = useState(false);
  const [integrationBookId, setIntegrationBookId] = useState(integrationBook?.id || '');

  // ── Zoom & Pan
  const [viewZoom, setViewZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isSpacePan, setIsSpacePan] = useState(false); // Space basılıyken geçici pan modu
  const [rasterScale, setRasterScale] = useState(1); // netlik için fazladan raster çarpanı (>=1)

  // ── Çoklu seçim (selectedId birincil seçim olarak kalır; selectedItems çoklu küme)
  const [selectedItems, setSelectedItems] = useState([]); // [{ id, type }]
  const [marqueeRect, setMarqueeRect] = useState(null); // boş alanda sürükleyerek seçim kutusu

  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const surfaceRef = useRef(null);
  const renderTaskRef = useRef(null);
  // Pointer/wheel dinleyicilerinin tek sefer bağlanıp daima güncel değerleri okuması için ref'ler.
  const onKeyRef = useRef(() => {});
  const pointerMoveRef = useRef(() => {});
  const pointerUpRef = useRef(() => {});
  const pointerDownRef = useRef(() => {});
  const textElementsRef = useRef(textElements);
  const editingStartTextRef = useRef(null);
  const viewRef = useRef({ zoom: 1, pan: { x: 0, y: 0 } });
  const zoomSharpenTimerRef = useRef(null);
  const panGestureRef = useRef(null); // orta tuş / space ile pan jesti
  const cursorRafRef = useRef(null); // imleç koordinatı güncellemesini frame'e topla
  const marqueeStartRef = useRef(null); // boş alanda sürükleyerek çoklu seçim jesti
  textElementsRef.current = textElements;
  viewRef.current = { zoom: viewZoom, pan: panOffset };

  // ── Derived
  const masks = useMemo(() => pageMasks[currentPage] || [], [pageMasks, currentPage]);
  const pagePatches = useMemo(() => patches[currentPage] || [], [patches, currentPage]);
  const pageTexts = useMemo(() => textElements[currentPage] || [], [textElements, currentPage]);
  const totalDetected = useMemo(
    () =>
      Object.values(pageMasks).reduce(
        (sum, items) => sum + (items || []).filter((i) => i.source === 'auto').length,
        0
      ),
    [pageMasks]
  );
  const history = historyState.stack;
  const historyIndex = historyState.index;
  const isSettingsModified =
    samplingMode !== 'auto' ||
    aiConfig.sensitivity !== 'medium' ||
    aiConfig.enabledTypes.length !== 5;
  const hasEdits = masks.length > 0 || pagePatches.length > 0 || pageTexts.length > 0;
  const pageWorkflowList = useMemo(() => {
    const pageCount = Math.max(numPages || 0, thumbnails.length || 0);
    return Array.from({ length: pageCount }, (_, index) =>
      buildPdfPageWorkflowSummary({
        pageNumber: index + 1,
        pageMasks,
        patches,
        textElements,
        currentPage,
        busy,
        bulkBusy,
      })
    );
  }, [bulkBusy, busy, currentPage, numPages, pageMasks, patches, textElements, thumbnails.length]);
  const pageWorkflowMap = useMemo(
    () => Object.fromEntries(pageWorkflowList.map((item) => [item.pageNumber, item])),
    [pageWorkflowList]
  );
  const currentPageWorkflow = useMemo(
    () =>
      pageWorkflowMap[currentPage] ||
      buildPdfPageWorkflowSummary({
        pageNumber: currentPage,
        pageMasks,
        patches,
        textElements,
        currentPage,
        busy,
        bulkBusy,
      }),
    [bulkBusy, busy, currentPage, pageMasks, pageWorkflowMap, patches, textElements]
  );
  const documentWorkflow = useMemo(() => {
    const counts = pageWorkflowList.reduce(
      (acc, item) => {
        acc[item.statusKey] += 1;
        acc.totalEdits += item.counts.totalEdits;
        return acc;
      },
      { draft: 0, building: 0, ready: 0, review: 0, blocked: 0, totalEdits: 0 }
    );
    const averageQuality = pageWorkflowList.length
      ? Math.round(
          pageWorkflowList.reduce((sum, item) => sum + item.quality, 0) / pageWorkflowList.length
        )
      : 0;
    let statusKey = 'draft';
    if (busy || bulkBusy) statusKey = 'building';
    else if (!pageWorkflowList.length) statusKey = 'draft';
    else if (counts.review > 0) statusKey = 'review';
    else if (counts.ready === pageWorkflowList.length) statusKey = 'ready';
    else if (counts.ready > 0) statusKey = 'building';
    return {
      statusKey,
      statusMeta: WORKFLOW_STATUS_META[statusKey] || WORKFLOW_STATUS_META.draft,
      pageCount: pageWorkflowList.length,
      averageQuality,
      readyPages: counts.ready,
      reviewPages: counts.review,
      draftPages: counts.draft,
      totalEdits: counts.totalEdits,
    };
  }, [bulkBusy, busy, pageWorkflowList]);
  const availableIntegrationBooks = useMemo(() => {
    const list = Array.isArray(integrationBooks) ? integrationBooks : [];
    const merged = integrationBook?.id
      ? [integrationBook, ...list.filter((book) => book?.id !== integrationBook.id)]
      : list;
    return merged.filter((book) => book?.id);
  }, [integrationBook, integrationBooks]);
  const resolvedIntegrationBook = useMemo(
    () =>
      availableIntegrationBooks.find((book) => book.id === integrationBookId) ||
      integrationBook ||
      availableIntegrationBooks[0] ||
      null,
    [availableIntegrationBooks, integrationBook, integrationBookId]
  );
  const canIntegrateToActivities =
    !!resolvedIntegrationBook?.id && typeof onIntegratePages === 'function';
  const integrationPageList = useMemo(() => {
    const count = Math.max(numPages || 0, thumbnails.length || 0);
    return Array.from({ length: count }, (_, index) => {
      const pageNumber = index + 1;
      const config = integrationPages[pageNumber] || {};
      return {
        pageNumber,
        deleted: config.deleted === true,
        include: config.deleted === true ? false : config.include !== false,
        flow: config.flow === 'continue' ? 'continue' : 'new',
      };
    });
  }, [integrationPages, numPages, thumbnails.length]);
  const includedIntegrationCount = integrationPageList.filter((item) => item.include).length;
  const currentIntegrationPage = integrationPageList.find((item) => item.pageNumber === currentPage);
  const currentPageDeleted = currentIntegrationPage?.deleted === true;

  const currentSelection = useMemo(() => {
    if (selectedType === 'patch') return pagePatches.find((i) => i.id === selectedId) || null;
    if (selectedType === 'text') return pageTexts.find((i) => i.id === selectedId) || null;
    if (selectedType === 'mask') return masks.find((i) => i.id === activeMaskId) || null;
    return null;
  }, [pagePatches, pageTexts, masks, selectedId, selectedType, activeMaskId]);

  // ── History helpers
  const makeSnapshot = (m, p, t, affectedPage) => ({
    masks: deepClone(m),
    patches: clonePatchesPreservingImage(p),
    texts: deepClone(t),
    affectedPage,
  });

  const resetHistory = (m = {}, p = {}, t = {}) =>
    setHistoryState({
      stack: [makeSnapshot(m, p, t)],
      index: 0,
    });

  const pushHistory = (m, p, t) => {
    const snap = makeSnapshot(m, p, t, currentPage);
    setHistoryState((prev) => {
      const stack = prev.stack.slice(0, prev.index + 1);
      stack.push(snap);
      if (stack.length > 60) stack.shift();
      return { stack, index: stack.length - 1 };
    });
  };

  const applySnapshot = (snap) => {
    if (!snap) return;
    setPageMasks(snap.masks || {});
    setPatches(snap.patches || {});
    setTextElements(snap.texts || {});
  };

  // undo/redo tek doğruluk kaynağından (historyState nesnesi) okur ve TEK ADIM geri/ileri alır.
  // Otomatik sayfa atlaması YOK: kullanıcı bulunduğu sayfada kalır (geleneksel editör davranışı).
  const undo = () => {
    const { stack, index } = historyState;
    if (index <= 0) return;
    applySnapshot(stack[index - 1]);
    setHistoryState((prev) => ({ ...prev, index: Math.max(0, prev.index - 1) }));
  };
  const redo = () => {
    const { stack, index } = historyState;
    if (index >= stack.length - 1) return;
    applySnapshot(stack[index + 1]);
    setHistoryState((prev) => ({
      ...prev,
      index: Math.min(prev.stack.length - 1, prev.index + 1),
    }));
  };

  // ── Mutation helpers
  const updateMask = (id, updater) => {
    const nextMasks = {
      ...pageMasks,
      [currentPage]: (pageMasks[currentPage] || []).map((i) => (i.id === id ? updater(i) : i)),
    };
    setPageMasks(nextMasks);
    pushHistory(nextMasks, patches, textElements);
  };
  const removeMask = (id) => {
    const nextMasks = {
      ...pageMasks,
      [currentPage]: (pageMasks[currentPage] || []).filter((i) => i.id !== id),
    };
    setPageMasks(nextMasks);
    if (activeMaskId === id) {
      setActiveMaskId(null);
      setSelectedId(null);
      setSelectedType(null);
    }
    pushHistory(nextMasks, patches, textElements);
  };
  const removePatch = (id) => {
    const nextPatches = {
      ...patches,
      [currentPage]: (patches[currentPage] || []).filter((i) => i.id !== id),
    };
    setPatches(nextPatches);
    if (selectedId === id) {
      setSelectedId(null);
      setSelectedType(null);
    }
    setDraggingElement(null);
    setDragGhost(null);
    setAlignmentGuides([]);
    setResizing(null);
    pushHistory(pageMasks, nextPatches, textElements);
  };
  const removeText = (id) => {
    const nextTexts = {
      ...textElements,
      [currentPage]: (textElements[currentPage] || []).filter((i) => i.id !== id),
    };
    setTextElements(nextTexts);
    if (selectedId === id) {
      setSelectedId(null);
      setSelectedType(null);
    }
    pushHistory(pageMasks, patches, nextTexts);
  };
  const updatePatch = (id, updater) => {
    const nextPatches = {
      ...patches,
      [currentPage]: (patches[currentPage] || []).map((i) => (i.id === id ? updater(i) : i)),
    };
    setPatches(nextPatches);
    pushHistory(pageMasks, nextPatches, textElements);
  };
  const updateText = (id, updater) => {
    const nextTexts = {
      ...textElements,
      [currentPage]: (textElements[currentPage] || []).map((i) => (i.id === id ? updater(i) : i)),
    };
    setTextElements(nextTexts);
    pushHistory(pageMasks, patches, nextTexts);
  };
  const updateTextValue = (id, value) => {
    setTextElements((prev) => ({
      ...prev,
      [currentPage]: (prev[currentPage] || []).map((i) =>
        i.id === id ? { ...i, text: value } : i
      ),
    }));
  };
  const finishTextEdit = () => {
    setEditingTextId(null);
    // En güncel metni ref'ten oku (onBlur, son onChange commit'inden önce gelse bile güvenli).
    const latestTexts = textElementsRef.current;
    const id = editingTextId;
    const latestEl = id ? (latestTexts[currentPage] || []).find((i) => i.id === id) : null;
    // İçerik düzenleme başındaki değerle aynıysa gereksiz history girdisi ekleme.
    if (latestEl && latestEl.text === editingStartTextRef.current) return;
    pushHistory(pageMasks, patches, latestTexts);
  };
  const resetCurrentPage = () => {
    const nm = { ...pageMasks, [currentPage]: [] };
    const np = { ...patches, [currentPage]: [] };
    const nt = { ...textElements, [currentPage]: [] };
    setPageMasks(nm);
    setPatches(np);
    setTextElements(nt);
    setSelectedId(null);
    setSelectedType(null);
    setActiveMaskId(null);
    pushHistory(nm, np, nt);
    setStatus('Aktif sayfa sıfırlandı.');
  };
  const resetSettings = () => {
    setSamplingMode('auto');
    setAiConfig({
      sensitivity: 'medium',
      enabledTypes: ['checkbox', 'draggable', 'answer', 'note', 'handwriting'],
    });
  };

  // Seçimde öne getirir. Yalnızca gerçekten en üstte DEĞİLSE zIndex'i artırır (idempotent) ve
  // bu salt-görsel değişiklik undo geçmişini KİRLETMEZ (sadece-tık geri-alma adımı üretmez).
  const bringToFront = (id, type) => {
    if (type === 'patch') {
      const items = patches[currentPage] || [];
      const target = items.find((i) => i.id === id);
      if (!target) return;
      const maxZ = items.length ? Math.max(...items.map((i) => i.zIndex || 0)) : 0;
      if ((target.zIndex || 0) === maxZ) return; // zaten en üstte: işlem yok
      setPatches({
        ...patches,
        [currentPage]: items.map((i) => (i.id === id ? { ...i, zIndex: maxZ + 1 } : i)),
      });
    } else if (type === 'text') {
      const items = textElements[currentPage] || [];
      const target = items.find((i) => i.id === id);
      if (!target) return;
      const maxZ = items.length ? Math.max(...items.map((i) => i.zIndex || 0)) : 0;
      if ((target.zIndex || 0) === maxZ) return;
      setTextElements({
        ...textElements,
        [currentPage]: items.map((i) => (i.id === id ? { ...i, zIndex: maxZ + 1 } : i)),
      });
    }
  };

  // Verilen öğe dizisinde bir üst zIndex değeri (yeni öğeleri en üste koymak için tek kaynak).
  const nextZIndex = (items) =>
    items && items.length ? Math.max(...items.map((i) => i.zIndex || 0)) + 1 : 1;

  // ── Çoklu seçim yardımcıları
  const isItemSelected = (id, type) => selectedItems.some((s) => s.id === id && s.type === type);
  const selectSingle = (id, type) => {
    setSelectedItems([{ id, type }]);
  };
  const toggleSelected = (id, type) => {
    setSelectedItems((prev) =>
      prev.some((s) => s.id === id && s.type === type)
        ? prev.filter((s) => !(s.id === id && s.type === type))
        : [...prev, { id, type }]
    );
  };
  const clearSelection = () => {
    setSelectedId(null);
    setSelectedType(null);
    setActiveMaskId(null);
    setSelectedItems([]);
  };
  const selectAllOnPage = () => {
    const all = [
      ...pagePatches.map((i) => ({ id: i.id, type: 'patch' })),
      ...pageTexts.map((i) => ({ id: i.id, type: 'text' })),
      ...masks.map((i) => ({ id: i.id, type: 'mask' })),
    ];
    setSelectedItems(all);
    const first = all[all.length - 1];
    if (first) {
      if (first.type === 'mask') {
        setActiveMaskId(first.id);
        setSelectedId(null);
        setSelectedType(null);
      } else {
        setSelectedId(first.id);
        setSelectedType(first.type);
        setActiveMaskId(null);
      }
    }
  };

  // Seçili öğenin/öğelerin kutusunu normalize birimde kaydır (ok tuşu nudge).
  const nudgeSelection = (dx, dy) => {
    const targets = selectedItems.length
      ? selectedItems
      : selectedType
        ? [{ id: selectedId, type: selectedType }]
        : activeMaskId
          ? [{ id: activeMaskId, type: 'mask' }]
          : [];
    if (!targets.length) return;
    const shift = (box) => normalizeBox([box[0] + dy, box[1] + dx, box[2] + dy, box[3] + dx]);
    const patchIds = new Set(targets.filter((t) => t.type === 'patch').map((t) => t.id));
    const textIds = new Set(targets.filter((t) => t.type === 'text').map((t) => t.id));
    const maskIds = new Set(targets.filter((t) => t.type === 'mask').map((t) => t.id));
    const np = patchIds.size
      ? {
          ...patches,
          [currentPage]: (patches[currentPage] || []).map((i) =>
            patchIds.has(i.id) ? { ...i, targetBox: shift(i.targetBox) } : i
          ),
        }
      : patches;
    const nt = textIds.size
      ? {
          ...textElements,
          [currentPage]: (textElements[currentPage] || []).map((i) =>
            textIds.has(i.id) ? { ...i, box: shift(i.box) } : i
          ),
        }
      : textElements;
    const nm = maskIds.size
      ? {
          ...pageMasks,
          [currentPage]: (pageMasks[currentPage] || []).map((i) =>
            maskIds.has(i.id) ? { ...i, box: shift(i.box) } : i
          ),
        }
      : pageMasks;
    if (patchIds.size) setPatches(np);
    if (textIds.size) setTextElements(nt);
    if (maskIds.size) setPageMasks(nm);
    pushHistory(nm, np, nt);
  };

  // Seçili patch/metni çoğalt (Ctrl+D). Kopya PASTE_OFFSET kadar ötelenir.
  const duplicateSelection = () => {
    const offsetBox = (box) =>
      normalizeBox([
        box[0] + PASTE_OFFSET,
        box[1] + PASTE_OFFSET,
        box[2] + PASTE_OFFSET,
        box[3] + PASTE_OFFSET,
      ]);
    if (selectedType === 'patch' && currentSelection) {
      const copy = {
        ...deepClone(currentSelection),
        id: uid('patch'),
        targetBox: offsetBox(currentSelection.targetBox),
        zIndex: nextZIndex(pagePatches),
      };
      const np = { ...patches, [currentPage]: [...(patches[currentPage] || []), copy] };
      setPatches(np);
      selectSingle(copy.id, 'patch');
      setSelectedId(copy.id);
      setSelectedType('patch');
      pushHistory(pageMasks, np, textElements);
    } else if (selectedType === 'text' && currentSelection) {
      const copy = {
        ...deepClone(currentSelection),
        id: uid('text'),
        box: offsetBox(currentSelection.box),
        zIndex: nextZIndex(pageTexts),
      };
      const nt = { ...textElements, [currentPage]: [...(textElements[currentPage] || []), copy] };
      setTextElements(nt);
      selectSingle(copy.id, 'text');
      setSelectedId(copy.id);
      setSelectedType('text');
      pushHistory(pageMasks, patches, nt);
    }
  };

  // Çoklu seçimdeki tüm öğeleri sil (Delete).
  const removeSelectedItems = () => {
    const targets = selectedItems.length
      ? selectedItems
      : selectedType
        ? [{ id: selectedId, type: selectedType }]
        : activeMaskId
          ? [{ id: activeMaskId, type: 'mask' }]
          : [];
    if (!targets.length) return;
    const patchIds = new Set(targets.filter((t) => t.type === 'patch').map((t) => t.id));
    const textIds = new Set(targets.filter((t) => t.type === 'text').map((t) => t.id));
    const maskIds = new Set(targets.filter((t) => t.type === 'mask').map((t) => t.id));
    const np = patchIds.size
      ? { ...patches, [currentPage]: (patches[currentPage] || []).filter((i) => !patchIds.has(i.id)) }
      : patches;
    const nt = textIds.size
      ? {
          ...textElements,
          [currentPage]: (textElements[currentPage] || []).filter((i) => !textIds.has(i.id)),
        }
      : textElements;
    const nm = maskIds.size
      ? {
          ...pageMasks,
          [currentPage]: (pageMasks[currentPage] || []).filter((i) => !maskIds.has(i.id)),
        }
      : pageMasks;
    if (patchIds.size) setPatches(np);
    if (textIds.size) setTextElements(nt);
    if (maskIds.size) setPageMasks(nm);
    clearSelection();
    setDraggingElement(null);
    setDragGhost(null);
    setAlignmentGuides([]);
    setResizing(null);
    pushHistory(nm, np, nt);
  };

  const movePatchLayer = (id, direction) => {
    const items = [...(patches[currentPage] || [])];
    const idx = items.findIndex((i) => i.id === id);
    if (idx === -1) return;
    const maxZ = Math.max(...items.map((i) => i.zIndex || 0));
    const minZ = Math.min(...items.map((i) => i.zIndex || 0));
    items[idx] = { ...items[idx], zIndex: direction === 'up' ? maxZ + 1 : minZ - 1 };
    const np = { ...patches, [currentPage]: items };
    setPatches(np);
    pushHistory(pageMasks, np, textElements);
  };

  const handleOcrFromPatch = async (patch) => {
    const text = (pageTextEntries[currentPage] || [])
      .filter((e) => overlapArea(e.box, patch.sourceBox) > 0)
      .map((e) => e.text)
      .join(' ')
      .trim();
    if (!text) {
      setStatus('Seçilen patch içinde metin bulunamadı.');
      return;
    }
    const nextText = {
      id: uid('text'),
      box: patch.targetBox,
      text,
      fontSize: 16,
      fontFamily: 'Arial, sans-serif',
      color: '#000000',
      bgColor: patch.bgColor || 'rgb(255,255,255)',
      zIndex: nextZIndex(pageTexts),
    };
    const nt = { ...textElements, [currentPage]: [...(textElements[currentPage] || []), nextText] };
    const np = {
      ...patches,
      [currentPage]: (patches[currentPage] || []).filter((i) => i.id !== patch.id),
    };
    setTextElements(nt);
    setPatches(np);
    setSelectedId(nextText.id);
    setSelectedType('text');
    pushHistory(pageMasks, np, nt);
    setStatus('Patch metne dönüştürüldü.');
  };

  // ── Snap & coordinates
  const getSnapPoints = (skipId, skipType) => {
    const pts = { x: [], y: [] };
    [...masks, ...pagePatches, ...pageTexts].forEach((item) => {
      const id = item.id;
      const type = item.targetBox ? 'patch' : item.text !== undefined ? 'text' : 'mask';
      if (skipId && skipType && skipId === id && skipType === type) return;
      const box = item.box || item.targetBox;
      if (!box) return;
      pts.x.push(box[1], box[3], (box[1] + box[3]) / 2);
      pts.y.push(box[0], box[2], (box[0] + box[2]) / 2);
    });
    return pts;
  };
  const applySnap = (box, skipId, skipType) => {
    const w = boxWidth(box),
      h = boxHeight(box);
    let nx = box[1],
      ny = box[0];
    const guides = [];
    const pts = getSnapPoints(skipId, skipType);
    const SNAP = SNAP_THRESHOLD;
    [box[1], box[3], (box[1] + box[3]) / 2].forEach((p) => {
      pts.x.forEach((t) => {
        if (Math.abs(p - t) < SNAP) {
          guides.push({ x: t });
          if (p === box[1]) nx = t;
          else if (p === box[3]) nx = t - w;
          else nx = t - w / 2;
        }
      });
    });
    [box[0], box[2], (box[0] + box[2]) / 2].forEach((p) => {
      pts.y.forEach((t) => {
        if (Math.abs(p - t) < SNAP) {
          guides.push({ y: t });
          if (p === box[0]) ny = t;
          else if (p === box[2]) ny = t - h;
          else ny = t - h / 2;
        }
      });
    });
    return { box: normalizeBox([ny, nx, ny + h, nx + w]), guides };
  };

  const getNormalizedPoint = (clientX, clientY) => {
    const node = surfaceRef.current || canvasRef.current;
    if (!node) return null;
    const rect = node.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: clamp(((clientX - rect.left) / rect.width) * 1000, 0, 1000),
      y: clamp(((clientY - rect.top) / rect.height) * 1000, 0, 1000),
    };
  };

  // ── Rasterize helpers
  const renderPageRaster = async (pageNumber, scale = RENDER_SCALES.auto) => {
    if (!pdfDoc) return null;
    const page = await pdfDoc.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    const tc = document.createElement('canvas');
    tc.width = Math.max(1, Math.round(viewport.width));
    tc.height = Math.max(1, Math.round(viewport.height));
    const ctx = tc.getContext('2d', { alpha: false });
    if (!ctx) return null;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, tc.width, tc.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    return { page, viewport, canvas: tc };
  };

  // ── Auto-detect
  const runAutoCleanCurrentPage = async () => {
    if (!pdfDoc || !pdfjsLib) return;
    setBusy(true);
    setStatus('Bu sayfa yüksek çözünürlükte taranıyor...');
    try {
      const rendered = await renderPageRaster(currentPage, RENDER_SCALES.auto);
      if (!rendered) throw new Error('Sayfa hazırlanamadı.');
      const entries = await extractTextEntries(rendered.page, rendered.viewport, pdfjsLib);
      const detected = detectInteractiveElementsLocal(
        rendered.canvas,
        entries,
        aiConfig,
        samplingMode
      );
      const manuals = (pageMasks[currentPage] || []).filter((i) => i.source === 'manual');
      const nm = { ...pageMasks, [currentPage]: [...manuals, ...detected] };
      setPageTextEntries((prev) => ({ ...prev, [currentPage]: entries }));
      setPageSummary(summarizePageText(entries));
      setPageMasks(nm);
      pushHistory(nm, patches, textElements);
      setStatus(
        detected.length
          ? `${detected.length} alan otomatik taramayla tespit edildi.`
          : 'Bu sayfada belirgin alan bulunamadı.'
      );
    } catch (err) {
      setStatus(err?.message || 'Tarama hatası.');
    } finally {
      setBusy(false);
    }
  };

  const runAutoCleanAllPages = async () => {
    if (!pdfDoc || !pdfjsLib) return;
    setBulkBusy(true);
    setBulkProgress(0);
    setStatus('Tüm sayfalar taranıyor...');
    try {
      const nm = deepClone(pageMasks);
      const nte = deepClone(pageTextEntries);
      for (let p = 1; p <= numPages; p++) {
        setBulkProgress(p);
        const rendered = await renderPageRaster(p, RENDER_SCALES.auto);
        if (!rendered) continue;
        const entries = await extractTextEntries(rendered.page, rendered.viewport, pdfjsLib);
        nte[p] = entries;
        const manuals = (nm[p] || []).filter((i) => i.source === 'manual');
        nm[p] = [
          ...manuals,
          ...detectInteractiveElementsLocal(rendered.canvas, entries, aiConfig, samplingMode),
        ];
      }
      setPageTextEntries(nte);
      setPageSummary(summarizePageText(nte[currentPage] || []));
      setPageMasks(nm);
      pushHistory(nm, patches, textElements);
      setStatus('Tüm sayfalar güncellendi.');
    } catch (err) {
      setStatus(err?.message || 'Toplu tarama hatası.');
    } finally {
      setBulkBusy(false);
      setBulkProgress(0);
    }
  };

  // ── Export helpers
  // Bir sayfanın yalnızca GÖRÜNÜR katmanlarını, ekrandaki ile aynı z-order'da döndürür. Tüm export
  // yolları (SVG/PNG/JPEG/PDF/entegrasyon) bunu kullanır → çıktı ekranla birebir eşleşir.
  const collectVisibleLayers = (pageNumber) => {
    const vis = (id) => layerVisibility[id] !== false;
    const byZ = (a, b) => (a.zIndex || 0) - (b.zIndex || 0);
    return {
      masks: (pageMasks[pageNumber] || []).filter((m) => vis(m.id)),
      patches: (patches[pageNumber] || []).filter((p) => vis(p.id)).slice().sort(byZ),
      texts: (textElements[pageNumber] || []).filter((t) => vis(t.id)).slice().sort(byZ),
    };
  };

  const buildPageSvgString = async (pageNumber) => {
    if (!pdfDoc) return null;
    const page = await pdfDoc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: RENDER_SCALES.svg });
    const tc = document.createElement('canvas');
    tc.width = Math.round(viewport.width);
    tc.height = Math.round(viewport.height);
    const ctx = tc.getContext('2d', { alpha: false });
    if (!ctx) return null;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, tc.width, tc.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    const { masks: vMasks, patches: vPatches, texts: vTexts } = collectVisibleLayers(pageNumber);
    const num = (v, def) => (Number.isFinite(Number(v)) ? Number(v) : def);
    const parts = [
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${tc.width}" height="${tc.height}" viewBox="0 0 ${tc.width} ${tc.height}">`,
      `<image x="0" y="0" width="${tc.width}" height="${tc.height}" xlink:href="${escapeXml(tc.toDataURL('image/png'))}" />`,
    ];
    vMasks.forEach((mask) => {
      const fill = sampleBackgroundColor(ctx, mask.box, tc.width, tc.height, samplingMode);
      parts.push(buildMaskSvg({ ...mask, bgColor: fill }, tc.width, tc.height));
    });
    vPatches.forEach((patch) => {
      if (!patch.isClone) {
        const src = sourceCleanupRect(getPatchSourceCleanupBox(patch), tc.width, tc.height, 2);
        parts.push(
          `<rect x="${src.x}" y="${src.y}" width="${src.width}" height="${src.height}" fill="${escapeXml(patch.bgColor || '#fff')}" />`
        );
      }
      const tgt = pixelBox(patch.targetBox, tc.width, tc.height);
      const m = getPatchRenderMetrics(patch, tgt);
      parts.push(
        `<image x="${m.centerX - m.drawWidth / 2}" y="${m.centerY - m.drawHeight / 2}" width="${m.drawWidth}" height="${m.drawHeight}" xlink:href="${escapeXml(patch.imageData)}" transform="rotate(${num(patch.rotation, 0)} ${m.centerX} ${m.centerY})" style="filter:brightness(${num(patch.brightness, 100)}%) contrast(${num(patch.contrast, 100)}%);" />`
      );
    });
    vTexts.forEach((el) => {
      const r = pixelBox(el.box, tc.width, tc.height);
      const fontSize = Math.max(6, num(el.fontSize, 16)) * RENDER_SCALES.svg;
      const fontFamily = el.fontFamily || 'Arial, sans-serif';
      const cx = r.x + r.width / 2;
      const cy = r.y + r.height / 2;
      const lines = String(el.text || '')
        .split(/\n+/)
        .slice(0, 8);
      const lineHeight = fontSize * 1.25;
      const startY = cy - (lines.length * lineHeight) / 2 + lineHeight / 2;
      parts.push(
        `<rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" fill="${escapeXml(el.bgColor || '#fff')}" />`
      );
      // Çok satırlı metin: her satır ayrı tspan (canvas drawWrappedText ile aynı lineHeight/ortalama).
      const tspans = lines
        .map(
          (line, i) =>
            `<tspan x="${cx}" y="${startY + i * lineHeight}" dominant-baseline="middle">${escapeXml(line)}</tspan>`
        )
        .join('');
      parts.push(
        `<text fill="${escapeXml(el.color || '#000')}" font-size="${fontSize}" font-family="${escapeXml(fontFamily)}" text-anchor="middle">${tspans}</text>`
      );
    });
    parts.push('</svg>');
    return parts.join('');
  };

  const exportAllSvg = async () => {
    if (!pdfDoc || !file) return;
    setExportBusy(true);
    setStatus('SVG paketi hazırlanıyor...');
    try {
      const base = file.name.replace(/\.pdf$/i, '');
      const entries = [];
      for (let p = 1; p <= numPages; p++) {
        const svg = await buildPageSvgString(p);
        if (svg) entries.push({ name: `${base}-${p}.svg`, data: svg });
      }
      downloadBlob(createStoredZip(entries), `${base}_svgpaket.zip`);
      setStatus('SVG paketi indirildi.');
    } catch (err) {
      setStatus(err?.message || 'SVG paketi oluşturulamadı.');
    } finally {
      setExportBusy(false);
    }
  };
  const exportCurrentPageSvg = async () => {
    if (!file) return;
    setExportBusy(true);
    setStatus('SVG hazırlanıyor...');
    try {
      const svg = await buildPageSvgString(currentPage);
      if (!svg) return;
      downloadBlob(
        new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }),
        `${file.name.replace(/\.pdf$/i, '')}-s${currentPage}.svg`
      );
      setStatus(`Sayfa ${currentPage} SVG olarak indirildi.`);
    } catch (err) {
      setStatus(err?.message || 'SVG oluşturulamadı.');
    } finally {
      setExportBusy(false);
    }
  };
  const exportCurrentPagePng = async () => {
    if (!pdfDoc || !file) return;
    setExportBusy(true);
    setStatus('PNG hazırlanıyor...');
    try {
      const rendered = await renderPageRaster(currentPage, RENDER_SCALES.png);
      if (!rendered) return;
      const layers = collectVisibleLayers(currentPage);
      const composed = await composePageCanvas(
        rendered.canvas,
        layers.masks,
        layers.patches,
        layers.texts,
        RENDER_SCALES.png
      );
      if (!composed) return;
      const blob = await canvasToBlob(composed, 'image/png', 0.94);
      if (!blob) return;
      downloadBlob(blob, `${file.name.replace(/\.pdf$/i, '')}-s${currentPage}.png`);
      setStatus(`Sayfa ${currentPage} PNG olarak indirildi.`);
    } catch (err) {
      setStatus(err?.message || 'PNG oluşturulamadı.');
    } finally {
      setExportBusy(false);
    }
  };
  const exportCurrentPageJpeg = async () => {
    if (!pdfDoc || !file) return;
    setExportBusy(true);
    setStatus('JPEG hazırlanıyor...');
    try {
      const rendered = await renderPageRaster(currentPage, RENDER_SCALES.jpeg);
      if (!rendered) return;
      const layers = collectVisibleLayers(currentPage);
      const composed = await composePageCanvas(
        rendered.canvas,
        layers.masks,
        layers.patches,
        layers.texts,
        RENDER_SCALES.jpeg
      );
      if (!composed) return;
      const blob = await canvasToBlob(composed, 'image/jpeg', 0.9);
      if (!blob) return;
      downloadBlob(blob, `${file.name.replace(/\.pdf$/i, '')}-s${currentPage}.jpg`);
      setStatus(`Sayfa ${currentPage} JPEG olarak indirildi.`);
    } catch (err) {
      setStatus(err?.message || 'JPEG oluşturulamadı.');
    } finally {
      setExportBusy(false);
    }
  };
  const exportCleanedPdf = async () => {
    if (!pdfDoc || !file || bulkBusy) return;
    setBulkBusy(true);
    setStatus('Temizlenmiş PDF hazırlanıyor...');
    try {
      const out = await PDFDocument.create();
      for (let p = 1; p <= numPages; p++) {
        const rendered = await renderPageRaster(p, RENDER_SCALES.pdf);
        if (!rendered) continue;
        const layers = collectVisibleLayers(p);
        const composed = await composePageCanvas(
          rendered.canvas,
          layers.masks,
          layers.patches,
          layers.texts,
          RENDER_SCALES.pdf
        );
        if (!composed) continue;
        const blob = await canvasToBlob(composed, 'image/png', 0.92);
        if (!blob) continue;
        const img = await out.embedPng(await blob.arrayBuffer());
        const pg = out.addPage([composed.width, composed.height]);
        pg.drawImage(img, { x: 0, y: 0, width: composed.width, height: composed.height });
      }
      downloadBlob(
        new Blob([await out.save()], { type: 'application/pdf' }),
        `${file.name.replace(/\.pdf$/i, '')}-temizlenmis.pdf`
      );
      setStatus('Temizlenmiş PDF indirildi.');
    } catch (err) {
      setStatus(err?.message || 'PDF oluşturulamadı.');
    } finally {
      setBulkBusy(false);
    }
  };

  const updateIntegrationPage = (pageNumber, patch = {}) => {
    setIntegrationPages((prev) => ({
      ...prev,
      [pageNumber]: {
        include: prev[pageNumber]?.include !== false,
        flow: prev[pageNumber]?.flow === 'continue' ? 'continue' : 'new',
        deleted: prev[pageNumber]?.deleted === true,
        ...patch,
      },
    }));
    setIntegrationPreview(null);
  };

  const setAllIntegrationPages = (include) => {
    const next = {};
    for (let pageNumber = 1; pageNumber <= numPages; pageNumber += 1) {
      next[pageNumber] = { include, flow: 'new', deleted: false };
    }
    setIntegrationPages(next);
    setIntegrationPreview(null);
  };

  const softDeleteCurrentPage = () => {
    updateIntegrationPage(currentPage, { include: false, deleted: true });
    setStatus(`Sayfa ${currentPage} silindi olarak işaretlendi; entegrasyona dahil edilmeyecek.`);
  };

  const restoreCurrentPage = () => {
    updateIntegrationPage(currentPage, { include: true, deleted: false, flow: 'new' });
    setStatus(`Sayfa ${currentPage} geri alındı ve entegrasyona dahil edildi.`);
  };

  const buildIntegrationPreview = async () => {
    if (!pdfDoc || !file) {
      setStatus('Önce PDF yükleyin.');
      return null;
    }
    if (!canIntegrateToActivities) {
      setStatus('Sisteme entegrasyon için hedef kitap seçin.');
      return null;
    }
    const selectedPages = integrationPageList.filter((item) => item.include);
    if (!selectedPages.length) {
      setStatus('Entegrasyona dahil edilmiş sayfa yok.');
      return null;
    }
    setIntegrationBusy(true);
    setStatus('Entegrasyon önizlemesi hazırlanıyor...');
    try {
      const pages = [];
      const oversized = [];
      for (const item of selectedPages) {
        const rawSvg = await buildPageSvgString(item.pageNumber);
        const { svgContent, sanitizeReport } = sanitizeSvgForPdfIntegration(rawSvg || '');
        const pageHash = hashPdfIntegrationContent(svgContent);
        const pageSize = sanitizeReport.sanitizedBytes || svgContent.length;
        if (pageSize > PDF_INTEGRATION_CONFIRM_BYTES) {
          oversized.push({ pageNumber: item.pageNumber, pageSize });
        }
        pages.push({
          bookId: resolvedIntegrationBook.id,
          bookName: resolvedIntegrationBook.name,
          fileName: file.name,
          pageNumber: item.pageNumber,
          originalPageNumber: item.pageNumber,
          include: true,
          flow: item.flow,
          svgContent,
          pageHash,
          pdfPageId: buildPdfPageSourceId({
            fileName: file.name,
            pageNumber: item.pageNumber,
            pageHash,
          }),
          sanitizeReport,
          integratedAt: new Date().toISOString(),
        });
      }
      if (oversized.length) {
        const list = oversized
          .map((item) => `Sayfa ${item.pageNumber}: ${(item.pageSize / 1024 / 1024).toFixed(1)} MB`)
          .join('\n');
        const ok = window.confirm(
          `Bazı SVG arka planları 5 MB üzerinde.\n\n${list}\n\n` +
            'Bu durum editor performansını etkileyebilir. Açık onayla devam edilsin mi?'
        );
        if (!ok) {
          setStatus('5 MB üzeri SVG için entegrasyon iptal edildi.');
          return null;
        }
      }
      const excludedPages = integrationPageList
        .filter((item) => !item.include)
        .map((item) => ({
          bookId: resolvedIntegrationBook.id,
          bookName: resolvedIntegrationBook.name,
          fileName: file.name,
          pageNumber: item.pageNumber,
          originalPageNumber: item.pageNumber,
          include: false,
          flow: item.flow,
          deleted: item.deleted === true,
        }));
      const plan = buildPdfIntegrationPlan({
        pages: [...pages, ...excludedPages],
        activities: integrationActivities,
        book: resolvedIntegrationBook,
      });
      setIntegrationPreview(plan);
      setStatus(
        `Önizleme hazır: ${plan.createCount} yeni, ${plan.duplicateCount} atlanacak, ${plan.excludedCount} hariç.`
      );
      return plan;
    } catch (err) {
      setStatus(err?.message || 'Entegrasyon önizlemesi hazırlanamadı.');
      return null;
    } finally {
      setIntegrationBusy(false);
    }
  };

  const integratePdfPages = async () => {
    const plan = await buildIntegrationPreview();
    if (!plan || !plan.createCount) {
      if (plan) setStatus('Yeni oluşturulacak etkinlik yok.');
      return;
    }
    const warningCount = plan.createEntries.filter(
      (entry) => (entry.page?.sanitizeReport?.warnings || []).length > 0
    ).length;
    const ok = window.confirm(
      `${resolvedIntegrationBook?.name || 'Kitap'} için ${plan.createCount} etkinlik oluşturulacak.\n` +
        `${plan.duplicateCount} sayfa daha önce entegre edildiği için atlanacak.\n` +
        `${plan.excludedCount} sayfa hariç tutulacak.\n` +
        `${plan.continuationGroupCount} devam grubu kurulacak.` +
        (warningCount ? `\n\n${warningCount} SVG için güvenlik/performans uyarısı var.` : '') +
        '\n\nDevam edilsin mi?'
    );
    if (!ok) {
      setStatus('Sisteme entegrasyon iptal edildi.');
      return;
    }
    try {
      const result = await onIntegratePages({ plan });
      const createdCount = result?.createdCount ?? plan.createCount;
      setStatus(`${createdCount} etkinlik sisteme entegre edildi.`);
      setIntegrationPreview(null);
    } catch (err) {
      setStatus(err?.message || 'Sisteme entegrasyon tamamlanamadı.');
    }
  };

  // ── Effects
  useEffect(() => {
    if (integrationBook?.id) {
      setIntegrationBookId(integrationBook.id);
    } else if (!integrationBookId && availableIntegrationBooks[0]?.id) {
      setIntegrationBookId(availableIntegrationBooks[0].id);
    }
  }, [availableIntegrationBooks, integrationBook, integrationBookId]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    let raf = null;
    const apply = () =>
      setStageSize((prev) => {
        const width = Math.max(0, Math.floor(node.clientWidth || 0));
        const height = Math.max(0, Math.floor(node.clientHeight || 0));
        // Aynı değerde gereksiz state güncellemesi/render fırtınası yapma.
        if (prev.width === width && prev.height === height) return prev;
        return { width, height };
      });
    // ResizeObserver olaylarını bir sonraki frame'e topla (sürükleyerek yeniden boyutlandırmada
    // render fırtınasını önler).
    const measure = () => {
      if (raf != null) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        apply();
      });
    };
    apply();
    const obs = new ResizeObserver(measure);
    obs.observe(node);
    return () => {
      if (raf != null) cancelAnimationFrame(raf);
      obs.disconnect();
    };
  }, [fullScreen, isSidebarOpen, file]);

  useEffect(() => {
    if (!file) {
      setPdfDoc(null);
      setNumPages(0);
      setCurrentPage(1);
      setThumbnails([]);
      setPageMasks({});
      setPatches({});
      setTextElements({});
      setPageTextEntries({});
      setPageSummary('');
      setSelectedId(null);
      setSelectedType(null);
      setActiveMaskId(null);
      setIntegrationPages({});
      setIntegrationPreview(null);
      resetHistory({}, {}, {});
      return;
    }
    let cancelled = false;
    (async () => {
      setBusy(true);
      setStatus('PDF yükleniyor...');
      try {
        const lib = await ensurePdfJsLib();
        if (cancelled) return;
        setPdfjsLib(lib);
        const ab = await file.arrayBuffer();
        const pdf = await lib.getDocument({ data: ab }).promise;
        if (cancelled) return;
        setPdfDoc(pdf);
        setNumPages(pdf.numPages);
        setCurrentPage(1);
        setPageMasks({});
        setPatches({});
        setTextElements({});
        setPageTextEntries({});
        setSelectedId(null);
        setSelectedType(null);
        setActiveMaskId(null);
        setIntegrationPages(
          Object.fromEntries(
            Array.from({ length: pdf.numPages }, (_, index) => [
              index + 1,
              { include: true, flow: 'new', deleted: false },
            ])
          )
        );
        setIntegrationPreview(null);
        resetHistory({}, {}, {});
        setStatus(`"${file.name}" yüklendi. ${pdf.numPages} sayfa.`);
      } catch (err) {
        if (!cancelled) setStatus(err?.message || 'PDF yüklenemedi.');
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- yalnızca dosya değişiminde yeniden yükle; resetHistory kararlı
  }, [file]);

  useEffect(() => {
    if (!pdfDoc) {
      setThumbnails([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const items = [];
      try {
        for (let p = 1; p <= pdfDoc.numPages; p++) {
          if (cancelled) return; // belge değiştiyse kalan sayfaları boşuna render etme
          const page = await pdfDoc.getPage(p);
          const vp = page.getViewport({ scale: RENDER_SCALES.thumb });
          const tc = document.createElement('canvas');
          tc.width = Math.max(1, Math.round(vp.width));
          tc.height = Math.max(1, Math.round(vp.height));
          const ctx = tc.getContext('2d', { alpha: false });
          if (!ctx) continue;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, tc.width, tc.height);
          await page.render({ canvasContext: ctx, viewport: vp }).promise;
          items.push({ pageNumber: p, url: tc.toDataURL('image/jpeg', 0.72) });
          // Ara canvas'ı serbest bırakmaya yardım et.
          tc.width = 0;
          tc.height = 0;
        }
        if (!cancelled) setThumbnails(items);
      } catch (err) {
        if (!cancelled) {
          console.error('Küçük resim üretimi başarısız:', err);
          setThumbnails([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pdfDoc]);

  // Sayfa raster + yerleşim. Taban ölçek container'a fit eder; netlik için rasterScale ile daha yüksek
  // çözünürlükte çizilir ama görüntü (CSS) boyutu taban ölçekte kalır, böylece overlay'ler hizalı kalır.
  useEffect(() => {
    if (!pdfDoc || !pdfjsLib) return;
    let cancelled = false;
    (async () => {
      setRenderBusy(true);
      try {
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch {}
          renderTaskRef.current = null;
        }
        const page = await pdfDoc.getPage(currentPage);
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container || cancelled) return;
        const wb = Math.max(360, stageSize.width || container.clientWidth || 360);
        const hb = Math.max(360, stageSize.height || container.clientHeight || 360);
        const bvp = page.getViewport({ scale: 1 });
        const baseScale = clamp(
          Math.min(
            (wb - STAGE_FIT_PADDING) / Math.max(1, bvp.width),
            (hb - STAGE_FIT_PADDING) / Math.max(1, bvp.height)
          ),
          SCALE_CLAMP_MIN,
          SCALE_CLAMP_MAX
        );
        const displayVp = page.getViewport({ scale: baseScale });
        const renderVp = page.getViewport({ scale: baseScale * Math.max(1, rasterScale) });
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;
        const dispW = Math.round(displayVp.width);
        const dispH = Math.round(displayVp.height);
        canvas.width = Math.round(renderVp.width);
        canvas.height = Math.round(renderVp.height);
        canvas.style.width = `${dispW}px`;
        canvas.style.height = `${dispH}px`;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const task = page.render({ canvasContext: ctx, viewport: renderVp });
        renderTaskRef.current = task;
        try {
          await task.promise;
        } finally {
          if (renderTaskRef.current === task) renderTaskRef.current = null;
        }
        if (cancelled) return;
        setPageViewport({ width: dispW, height: dispH });
        setDisplayScale(baseScale);
      } catch (err) {
        // İptal edilen render (hızlı sayfa/zoom değişimi) hata değildir; sessizce yut.
        if (!cancelled && err?.name !== 'RenderingCancelledException') {
          setStatus(err?.message || 'Sayfa yüklenemedi.');
        }
      } finally {
        if (!cancelled) setRenderBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pdfDoc, pdfjsLib, currentPage, stageSize.width, stageSize.height, rasterScale]);

  // Metin çıkarımı sayfa içeriğine bağlı; ölçek/zoom'dan bağımsız (0–1000 normalize). Ayrı effect olduğu
  // için resize/zoom sırasında gereksiz yere tekrar çalışmaz.
  useEffect(() => {
    if (!pdfDoc || !pdfjsLib) return;
    let cancelled = false;
    (async () => {
      try {
        const page = await pdfDoc.getPage(currentPage);
        const vp = page.getViewport({ scale: 1 });
        const entries = await extractTextEntries(page, vp, pdfjsLib);
        if (cancelled) return;
        setPageTextEntries((prev) => ({ ...prev, [currentPage]: entries }));
        setPageSummary(summarizePageText(entries));
      } catch (err) {
        if (!cancelled) console.error('Metin çıkarımı başarısız:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pdfDoc, pdfjsLib, currentPage]);

  // Yüksek zoom'da netlik: viewZoom eşiği aşınca debounce'lu olarak rasterScale artar ve yeniden raster
  // tetikler (metin çıkarımını etkilemez). Eşik altında rasterScale = 1.
  useEffect(() => {
    const target = viewZoom > ZOOM_SHARPEN_THRESHOLD ? clamp(Math.ceil(viewZoom), 1, 4) : 1;
    if (target === rasterScale) return undefined;
    if (zoomSharpenTimerRef.current) clearTimeout(zoomSharpenTimerRef.current);
    zoomSharpenTimerRef.current = setTimeout(() => setRasterScale(target), 260);
    return () => {
      if (zoomSharpenTimerRef.current) clearTimeout(zoomSharpenTimerRef.current);
    };
  }, [viewZoom, rasterScale]);

  // ── Pointer events (dinleyiciler tek sefer bağlanır; handler'lar her render güncel closure'ı okur)
  // İmleç koordinatını her pointermove'da değil frame başına bir kez ve yalnızca değiştiğinde günceller.
  const flushCursor = (pt) => {
    if (cursorRafRef.current != null) return;
    cursorRafRef.current = requestAnimationFrame(() => {
      cursorRafRef.current = null;
      const x = Math.round(pt.x);
      const y = Math.round(pt.y);
      setCursorCoords((prev) => (prev && prev.x === x && prev.y === y ? prev : { x, y }));
    });
  };

  pointerMoveRef.current = (e) => {
    // Pan jesti (orta tuş / Space+sürükle): görünümü kaydır.
    if (panGestureRef.current) {
      const g = panGestureRef.current;
      setPanOffset({
        x: g.startPan.x + (e.clientX - g.startX),
        y: g.startPan.y + (e.clientY - g.startY),
      });
      return;
    }
    const pt = getNormalizedPoint(e.clientX, e.clientY);
    if (!pt) return; // koordinat hesaplanamıyorsa hiçbir jesti işleme (null-deref koruması)
    flushCursor(pt);

    if (marqueeStartRef.current) {
      const s = marqueeStartRef.current;
      setMarqueeRect(normalizeBox([s.y, s.x, pt.y, pt.x]));
      return;
    }

    if (drawState) setDraftRect(normalizeBox([drawState.startY, drawState.startX, pt.y, pt.x]));

    if (draggingElement) {
      const dx = pt.x - draggingElement.startX;
      const dy = pt.y - draggingElement.startY;
      // Boyutu koruyarak sınır içinde kaydır (kenarda öğe ezilmez).
      const nb = shiftBoxClamped(draggingElement.initialBox, dx, dy);
      const snapped = applySnap(nb, draggingElement.id, draggingElement.type);
      setDragGhost({ id: draggingElement.id, type: draggingElement.type, box: snapped.box });
      setAlignmentGuides(snapped.guides);
    }

    if (resizing) {
      let nb = [...resizing.initialBox];
      if (resizing.handle === 'nw') {
        nb[0] = pt.y;
        nb[1] = pt.x;
      } else if (resizing.handle === 'ne') {
        nb[0] = pt.y;
        nb[3] = pt.x;
      } else if (resizing.handle === 'sw') {
        nb[2] = pt.y;
        nb[1] = pt.x;
      } else if (resizing.handle === 'se') {
        nb[2] = pt.y;
        nb[3] = pt.x;
      }
      if (e.shiftKey) nb = applyAspectResize(resizing.initialBox, nb, resizing.handle); // orantılı
      nb = enforceMinResize(nb, resizing.handle, resizing.initialBox); // minimum boyut
      nb = normalizeBox(nb);
      if (resizing.type === 'patch')
        setPatches((prev) => ({
          ...prev,
          [currentPage]: (prev[currentPage] || []).map((i) =>
            i.id === resizing.id ? { ...i, targetBox: nb } : i
          ),
        }));
      else
        setTextElements((prev) => ({
          ...prev,
          [currentPage]: (prev[currentPage] || []).map((i) =>
            i.id === resizing.id ? { ...i, box: nb } : i
          ),
        }));
    }
  };

  pointerUpRef.current = async () => {
    // Pan jestini sonlandır (draw/drag/resize işleme).
    if (panGestureRef.current) {
      panGestureRef.current = null;
      return;
    }
    // Marquee çoklu seçimi sonlandır: kutuyla kesişen tüm öğeleri seç.
    if (marqueeStartRef.current) {
      const box = marqueeRect;
      const additive = marqueeStartRef.current.additive;
      marqueeStartRef.current = null;
      setMarqueeRect(null);
      if (box && boxArea(box) > 4) {
        const hits = [
          ...pagePatches
            .filter((i) => boxesOverlap(i.targetBox, box))
            .map((i) => ({ id: i.id, type: 'patch' })),
          ...pageTexts
            .filter((i) => boxesOverlap(i.box, box))
            .map((i) => ({ id: i.id, type: 'text' })),
          ...masks.filter((i) => boxesOverlap(i.box, box)).map((i) => ({ id: i.id, type: 'mask' })),
        ];
        setSelectedItems((prev) =>
          additive
            ? [...prev, ...hits.filter((h) => !prev.some((p) => p.id === h.id && p.type === h.type))]
            : hits
        );
        const last = hits[hits.length - 1];
        if (last && last.type !== 'mask') {
          setSelectedId(last.id);
          setSelectedType(last.type);
          setActiveMaskId(null);
        } else if (last) {
          setActiveMaskId(last.id);
          setSelectedId(null);
          setSelectedType(null);
        }
      }
      return;
    }
    const handleUp = async () => {
      if (drawState && draftRect) {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d', { willReadFrequently: true });
        const bgColor = ctx
          ? sampleBackgroundColor(ctx, draftRect, canvas.width, canvas.height, samplingMode)
          : 'rgb(255,255,255)';

        if (mode === 'manual') {
          const nm = {
            ...pageMasks,
            [currentPage]: [
              ...(pageMasks[currentPage] || []),
              {
                id: uid('manual'),
                source: 'manual',
                type: 'answer',
                label: 'Manuel alan',
                bgColor,
                box: draftRect,
              },
            ],
          };
          setPageMasks(nm);
          pushHistory(nm, patches, textElements);
          setStatus('Manuel temizleme alanı eklendi.');
        } else if (mode === 'text') {
          const nt = {
            id: uid('text'),
            box: draftRect,
            text: 'Metin girin',
            fontSize: 16,
            fontFamily: 'Arial, sans-serif',
            color: '#000000',
            bgColor,
            zIndex: nextZIndex(pageTexts),
          };
          const nextTexts = {
            ...textElements,
            [currentPage]: [...(textElements[currentPage] || []), nt],
          };
          setTextElements(nextTexts);
          selectSingle(nt.id, 'text');
          setSelectedId(nt.id);
          setSelectedType('text');
          setEditingTextId(nt.id);
          pushHistory(pageMasks, patches, nextTexts);
          setStatus('Yeni metin kutusu oluşturuldu.');
        } else if (mode === 'patch' && pdfDoc) {
          try {
            const page = await pdfDoc.getPage(currentPage);
            const bvp = page.getViewport({ scale: 1 });
            const dpr = pixelBox(draftRect, bvp.width, bvp.height);
            const dominant = Math.max(1, dpr.width, dpr.height);
            let pScale = clamp(4800 / dominant, 4, 12);
            if (bvp.width * bvp.height * pScale * pScale > 42000000)
              pScale = Math.max(3.5, Math.sqrt(42000000 / Math.max(1, bvp.width * bvp.height)));
            const vp = page.getViewport({ scale: pScale });
            const tc = document.createElement('canvas');
            tc.width = Math.max(1, Math.round(vp.width));
            tc.height = Math.max(1, Math.round(vp.height));
            const tctx = tc.getContext('2d', { alpha: false });
            if (tctx) {
              tctx.fillStyle = '#ffffff';
              tctx.fillRect(0, 0, tc.width, tc.height);
              await page.render({ canvasContext: tctx, viewport: vp }).promise;
              const composed = await composePageCanvas(
                tc,
                pageMasks[currentPage] || [],
                patches[currentPage] || [],
                textElements[currentPage] || [],
                pScale
              );
              const srcCanvas = composed || tc;
              const srcRect = pixelBox(draftRect, srcCanvas.width, srcCanvas.height);
              const pAsset = createFeatheredPatchAsset(srcCanvas, srcRect, 14);
              if (pAsset) {
                const sctx = srcCanvas.getContext('2d', { willReadFrequently: true });
                const sourceMaskBox =
                  patchToolMode === 'cut'
                    ? normalizeBox(draftRect)
                    : createSourceMaskBox(draftRect);
                const pBg = sctx
                  ? sampleBackgroundColor(
                      sctx,
                      sourceMaskBox,
                      srcCanvas.width,
                      srcCanvas.height,
                      samplingMode
                    )
                  : bgColor;
                const np = {
                  id: uid('patch'),
                  sourceBox: draftRect,
                  targetBox: draftRect,
                  imageData: pAsset.imageData,
                  edgeBleed: pAsset.edgeBleed,
                  bgColor: pBg,
                  sourceMaskBox,
                  sourceMaskData: null,
                  scale: 1,
                  rotation: 0,
                  feather: 14,
                  brightness: 100,
                  contrast: 100,
                  zIndex: nextZIndex(pagePatches),
                  isClone: patchToolMode === 'clone',
                };
                const nextPatches = {
                  ...patches,
                  [currentPage]: [...(patches[currentPage] || []), np],
                };
                setPatches(nextPatches);
                selectSingle(np.id, 'patch');
                setSelectedId(np.id);
                setSelectedType('patch');
                setMode('view');
                pushHistory(pageMasks, nextPatches, textElements);
                setStatus(
                  patchToolMode === 'clone'
                    ? 'Kopyalama patch oluşturuldu.'
                    : 'Kes-yapıştır patch oluşturuldu.'
                );
                setRightTab('ozellikler');
              }
            }
          } catch (err) {
            setStatus(err?.message || 'Patch oluşturulamadı.');
          }
        }
      }
      if (draggingElement && dragGhost) {
        if (draggingElement.type === 'patch') {
          const np = {
            ...patches,
            [currentPage]: (patches[currentPage] || []).map((i) =>
              i.id === draggingElement.id ? { ...i, targetBox: dragGhost.box } : i
            ),
          };
          setPatches(np);
          pushHistory(pageMasks, np, textElements);
        } else {
          const nt = {
            ...textElements,
            [currentPage]: (textElements[currentPage] || []).map((i) =>
              i.id === draggingElement.id ? { ...i, box: dragGhost.box } : i
            ),
          };
          setTextElements(nt);
          pushHistory(pageMasks, patches, nt);
        }
      }
      if (resizing) pushHistory(pageMasks, patches, textElements);
      setDrawState(null);
      setDraftRect(null);
      setDraggingElement(null);
      setDragGhost(null);
      setAlignmentGuides([]);
      setResizing(null);
    };
    await handleUp();
  };

  // Orta fare tuşuyla (her yerde) pan başlat.
  pointerDownRef.current = (e) => {
    if (e.button === 1) {
      e.preventDefault();
      panGestureRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startPan: viewRef.current.pan,
      };
    }
  };

  useEffect(() => {
    const mv = (e) => pointerMoveRef.current(e);
    const up = (e) => pointerUpRef.current(e);
    const down = (e) => pointerDownRef.current(e);
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up); // iptal de jesti temizlesin (yapışkan sürükleme yok)
    window.addEventListener('pointerdown', down);
    return () => {
      window.removeEventListener('pointermove', mv);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      window.removeEventListener('pointerdown', down);
      if (cursorRafRef.current != null) cancelAnimationFrame(cursorRafRef.current);
    };
  }, []);

  // ── Ctrl+tekerlek zoom (imleç altındaki nokta sabit kalır) + Ctrl yoksa zoom'luyken tekerlekle pan.
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return undefined;
    const onWheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const surface = surfaceRef.current;
        if (!surface) return;
        const z1 = viewRef.current.zoom;
        const z2 = clamp(z1 * (1 - e.deltaY * ZOOM_WHEEL_SENSITIVITY), ZOOM_MIN, ZOOM_MAX);
        if (z2 === z1) return;
        const rect = surface.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        const pan = viewRef.current.pan;
        const factor = 1 - z2 / z1;
        const newPan = { x: pan.x + cx * factor, y: pan.y + cy * factor };
        // viewRef'i senkron güncelle: hızlı ardışık tekerlek olayları doğru birikir.
        viewRef.current = { zoom: z2, pan: newPan };
        setViewZoom(z2);
        setPanOffset(newPan);
      } else if (viewRef.current.zoom !== 1) {
        // Yakınlaşmışken tekerlek ile kaydır (Shift: yatay).
        e.preventDefault();
        const dx = e.shiftKey ? e.deltaY : e.deltaX;
        const dy = e.shiftKey ? 0 : e.deltaY;
        const pan = viewRef.current.pan;
        const newPan = { x: pan.x - dx, y: pan.y - dy };
        viewRef.current = { ...viewRef.current, pan: newPan };
        setPanOffset(newPan);
      }
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, [file]);

  // Zoom kontrol yardımcıları (UI butonları ve klavye için).
  const applyZoomAtCenter = (z2) => {
    const surface = surfaceRef.current;
    const z1 = viewRef.current.zoom;
    const target = clamp(z2, ZOOM_MIN, ZOOM_MAX);
    if (target === z1) return;
    if (!surface) {
      setViewZoom(target);
      return;
    }
    const rect = surface.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const pan = viewRef.current.pan;
    const factor = 1 - target / z1;
    const newPan = { x: pan.x + cx * factor, y: pan.y + cy * factor };
    viewRef.current = { zoom: target, pan: newPan };
    setViewZoom(target);
    setPanOffset(newPan);
  };
  const zoomIn = () => applyZoomAtCenter(viewRef.current.zoom * 1.2);
  const zoomOut = () => applyZoomAtCenter(viewRef.current.zoom / 1.2);
  const zoomReset = () => {
    viewRef.current = { zoom: 1, pan: { x: 0, y: 0 } };
    setViewZoom(1);
    setPanOffset({ x: 0, y: 0 });
  };

  // ── Klavye kısayolları
  // Yapıştırma kopyayı kademeli öteler: aynı öğeyi peş peşe yapıştırınca üst üste binmesin.
  const pasteCopiedItem = () => {
    if (!copiedItem) return;
    if (copiedItem.type === 'patch') {
      const box = shiftBoxClamped(copiedItem.data.targetBox, PASTE_OFFSET, PASTE_OFFSET);
      const copied = { ...copiedItem.data, id: uid('patch'), targetBox: box, zIndex: nextZIndex(pagePatches) };
      const np = { ...patches, [currentPage]: [...(patches[currentPage] || []), copied] };
      setPatches(np);
      selectSingle(copied.id, 'patch');
      setSelectedId(copied.id);
      setSelectedType('patch');
      setCopiedItem({ type: 'patch', data: { ...copiedItem.data, targetBox: box } });
      pushHistory(pageMasks, np, textElements);
    } else if (copiedItem.type === 'text') {
      const box = shiftBoxClamped(copiedItem.data.box, PASTE_OFFSET, PASTE_OFFSET);
      const copied = { ...copiedItem.data, id: uid('text'), box, zIndex: nextZIndex(pageTexts) };
      const nt = { ...textElements, [currentPage]: [...(textElements[currentPage] || []), copied] };
      setTextElements(nt);
      selectSingle(copied.id, 'text');
      setSelectedId(copied.id);
      setSelectedType('text');
      setCopiedItem({ type: 'text', data: { ...copiedItem.data, box } });
      pushHistory(pageMasks, patches, nt);
    } else if (copiedItem.type === 'mask') {
      const box = shiftBoxClamped(copiedItem.data.box, PASTE_OFFSET, PASTE_OFFSET);
      const copied = { ...copiedItem.data, id: uid('mask'), box };
      const nm = { ...pageMasks, [currentPage]: [...(pageMasks[currentPage] || []), copied] };
      setPageMasks(nm);
      setActiveMaskId(copied.id);
      setSelectedItems([{ id: copied.id, type: 'mask' }]);
      setCopiedItem({ type: 'mask', data: { ...copiedItem.data, box } });
      pushHistory(nm, patches, textElements);
    }
  };

  onKeyRef.current = (e) => {
    // Form alanlarında (input/textarea/select/contentEditable) hiçbir kısayolu ele geçirme:
    // tarayıcının doğal yazma/undo/kopyala-yapıştır davranışı korunur, kazara silme/mod değişimi olmaz.
    const tag = e.target?.tagName;
    if (e.target?.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
      return;
    }

    const ctrl = e.ctrlKey || e.metaKey;
    const key = e.key;
    const lower = typeof key === 'string' ? key.toLowerCase() : '';

    if (ctrl && lower === 'z' && !e.shiftKey) {
      e.preventDefault();
      undo();
      return;
    }
    if (ctrl && (lower === 'y' || (lower === 'z' && e.shiftKey))) {
      e.preventDefault();
      redo();
      return;
    }
    if (ctrl && lower === 'c' && currentSelection) {
      e.preventDefault();
      setCopiedItem({ type: selectedType, data: deepClone(currentSelection) });
      return;
    }
    if (ctrl && lower === 'v' && copiedItem) {
      e.preventDefault();
      pasteCopiedItem();
      return;
    }
    if (ctrl && lower === 'd' && currentSelection) {
      e.preventDefault();
      duplicateSelection();
      return;
    }
    if (ctrl && lower === 'a' && (pagePatches.length || pageTexts.length || masks.length)) {
      e.preventDefault();
      selectAllOnPage();
      return;
    }
    if (ctrl && lower === 's') {
      e.preventDefault();
      if (file && !bulkBusy) exportCleanedPdf();
      return;
    }
    if (key === '?') {
      setShowKeyHelp((v) => !v);
      return;
    }
    if (key === 'Escape') {
      if (showKeyHelp) {
        setShowKeyHelp(false);
        return;
      }
      setMode('view');
      clearSelection();
      return;
    }
    if (key === ' ' || e.code === 'Space') {
      // Buton/link odaktayken Space onu etkinleştirsin; aksi halde geçici pan modu.
      if (tag === 'BUTTON' || tag === 'A') return;
      e.preventDefault();
      setIsSpacePan(true);
      return;
    }
    if (key === 'PageDown') {
      e.preventDefault();
      setCurrentPage((p) => Math.min(numPages, p + 1));
      return;
    }
    if (key === 'PageUp') {
      e.preventDefault();
      setCurrentPage((p) => Math.max(1, p - 1));
      return;
    }
    if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight') {
      const hasSel = selectedItems.length || selectedType || activeMaskId;
      if (!hasSel) return;
      e.preventDefault();
      const step = e.shiftKey ? NUDGE_STEP_LARGE : NUDGE_STEP;
      const dx = key === 'ArrowLeft' ? -step : key === 'ArrowRight' ? step : 0;
      const dy = key === 'ArrowUp' ? -step : key === 'ArrowDown' ? step : 0;
      nudgeSelection(dx, dy);
      return;
    }
    if (lower === 'v') {
      setMode('view');
      return;
    }
    if (lower === 'e') {
      setMode('manual');
      return;
    }
    if (lower === 'p') {
      setMode('patch');
      return;
    }
    if (lower === 't') {
      setMode('text');
      return;
    }
    if (key === 'Delete' || key === 'Backspace') {
      removeSelectedItems();
    }
  };

  useEffect(() => {
    const onKeyDown = (e) => onKeyRef.current(e);
    const onKeyUp = (e) => {
      if (e.key === ' ' || e.code === 'Space') setIsSpacePan(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // Metin düzenlemeye girerken başlangıç değerini yakala (finishTextEdit değişiklik kontrolü için).
  useEffect(() => {
    if (editingTextId) {
      const el = (textElementsRef.current[currentPage] || []).find((i) => i.id === editingTextId);
      editingStartTextRef.current = el ? el.text : null;
    }
  }, [editingTextId, currentPage]);

  // Sayfa değişiminde seçim daima temizlenir (yeni sayfada geçersiz/yanlış öğe seçili kalmasın) ve pan
  // sıfırlanır (yeni sayfa görünür konuma gelsin).
  useEffect(() => {
    setSelectedId(null);
    setSelectedType(null);
    setActiveMaskId(null);
    setSelectedItems([]);
    setEditingTextId(null);
    // Yeni sayfa sığdırılmış (zoom 1, pan 0) görünür.
    viewRef.current = { zoom: 1, pan: { x: 0, y: 0 } };
    setViewZoom(1);
    setPanOffset({ x: 0, y: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- yalnızca sayfa değişiminde seçim/zoom/pan sıfırlanır
  }, [currentPage]);

  const handleSurfacePointerDown = (e) => {
    if (!canvasRef.current) return;
    // Space basılı veya orta tuş: pan jesti (her modda).
    if (isSpacePan || e.button === 1) {
      e.preventDefault();
      panGestureRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startPan: viewRef.current.pan,
      };
      return;
    }
    if (e.target !== surfaceRef.current) return;
    const pt = getNormalizedPoint(e.clientX, e.clientY);
    if (!pt) return;
    if (mode === 'view') {
      // Boş alanda sürükle → marquee çoklu seçim; basit tık → seçimi temizle.
      e.preventDefault();
      if (!e.shiftKey) clearSelection();
      marqueeStartRef.current = { x: pt.x, y: pt.y, additive: e.shiftKey };
      setMarqueeRect([pt.y, pt.x, pt.y, pt.x]);
      return;
    }
    e.preventDefault();
    clearSelection();
    setDrawState({ startX: pt.x, startY: pt.y });
    setDraftRect([pt.y, pt.x, pt.y, pt.x]);
  };

  // ── Drag & drop PDF upload
  const handleGlobalDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const f = Array.from(e.dataTransfer.files).find(
      (f) => f.type === 'application/pdf' || f.name?.endsWith('.pdf')
    );
    if (f) setFile(f);
  };

  // ── Resize handle helper
  const resizeHandle = (onPD, style) => (
    <div
      onPointerDown={onPD}
      style={{
        position: 'absolute',
        width: 10,
        height: 10,
        borderRadius: '50%',
        background: T.accent,
        border: '2px solid #08111f',
        zIndex: 40,
        ...style,
      }}
    />
  );

  // ── Inspector panel
  const renderInspector = () => {
    if (!selectedId && !activeMaskId) {
      return (
        <div style={{ padding: 16, color: T.muted, fontSize: 11, lineHeight: 1.8 }}>
          <div style={{ fontWeight: 700, color: T.text, marginBottom: 8 }}>Hiçbir öğe seçili</div>
          <div>
            Bir maske, patch veya metin kutusuna tıklayarak özelliklerini burada
            düzenleyebilirsiniz.
          </div>
          <div style={{ marginTop: 14, display: 'grid', gap: 6 }}>
            {[
              ['V', 'Görüntüleme modu'],
              ['E', 'Silgi / Maske'],
              ['P', 'Patch (taşı)'],
              ['T', 'Metin ekle'],
              ['Del', 'Seçili sil'],
            ].map(([k, d]) => (
              <div key={k} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <kbd
                  style={{
                    background: '#e2e8f0',
                    border: `1px solid ${T.border}`,
                    borderRadius: 4,
                    padding: '2px 7px',
                    fontSize: 11,
                    fontFamily: 'monospace',
                    color: T.accent,
                  }}
                >
                  {k}
                </kbd>
                <span style={{ fontSize: 11 }}>{d}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (activeMaskId && !selectedId) {
      const mask = masks.find((m) => m.id === activeMaskId);
      if (!mask) return null;
      const box = mask.box;
      return (
        <div style={{ padding: 14, display: 'grid', gap: 12 }}>
          <SectionLabel>Maske Özellikleri</SectionLabel>
          <PropRow label="Tür">
            <select
              value={mask.type || 'answer'}
              onChange={(e) => updateMask(mask.id, (m) => ({ ...m, type: e.target.value }))}
              style={{
                flex: 1,
                height: 28,
                border: `1px solid ${T.borderHi}`,
                borderRadius: 6,
                background: 'rgba(15,23,42,.04)',
                color: T.text,
                fontSize: 12,
              }}
            >
              {[
                ['checkbox', 'İşaret'],
                ['draggable', 'Sürüklenebilir'],
                ['answer', 'Cevap'],
                ['note', 'Not'],
                ['handwriting', 'El yazısı'],
              ].map(([v, l]) => (
                <option key={v + l} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </PropRow>
          <PropRow label="Zemin">
            <input
              type="color"
              value={resolveColorPickerValue(mask.bgColor, '#ffffff')}
              onChange={(e) => updateMask(mask.id, (m) => ({ ...m, bgColor: e.target.value }))}
              style={{
                width: 36,
                height: 28,
                border: `1px solid ${T.borderHi}`,
                borderRadius: 4,
                cursor: 'pointer',
              }}
            />
            <select
              value={samplingMode}
              onChange={(e) => setSamplingMode(e.target.value)}
              style={{
                flex: 1,
                height: 28,
                border: `1px solid ${T.borderHi}`,
                borderRadius: 6,
                background: 'rgba(15,23,42,.04)',
                color: T.text,
                fontSize: 12,
              }}
            >
              <option value="auto">Otomatik örnekleme</option>
              <option value="white">Saf beyaz</option>
              <option value="average">Lokal ortalama</option>
            </select>
          </PropRow>
          {mask.type === 'checkbox' && (
            <PropRow label="İşaret rengi">
              <input
                type="color"
                value={mask.markColor || '#0f766e'}
                onChange={(e) => updateMask(mask.id, (m) => ({ ...m, markColor: e.target.value }))}
                style={{
                  width: 32,
                  height: 24,
                  border: `1px solid ${T.borderHi}`,
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
              />
            </PropRow>
          )}
          <PropRow label="Konum">
            <span style={{ fontSize: 11, color: T.muted }}>
              Y:{Math.round(box[0])} X:{Math.round(box[1])} G:{Math.round(boxWidth(box))} Y:
              {Math.round(boxHeight(box))}
            </span>
          </PropRow>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => removeMask(mask.id)}
              style={{ ...tbBtn(false, { small: true, danger: true }), flex: 1 }}
            >
              🗑 Sil
            </button>
            <button
              onClick={() => {
                setActiveMaskId(null);
                setSelectedId(null);
                setSelectedType(null);
              }}
              style={{ ...tbBtn(false, { small: true }), flex: 1 }}
            >
              Seçimi Kaldır
            </button>
          </div>
        </div>
      );
    }

    if (selectedType === 'patch' && selectedId) {
      const patch = pagePatches.find((p) => p.id === selectedId);
      if (!patch) return null;
      return (
        <div style={{ padding: 14, display: 'grid', gap: 10 }}>
          <SectionLabel>Patch Özellikleri</SectionLabel>
          <div
            style={{
              fontSize: 11,
              color: T.muted,
              padding: '6px 8px',
              borderRadius: 6,
              background: 'rgba(37,99,235,.06)',
              border: `1px solid ${T.accentBorder}`,
            }}
          >
            {patch.isClone ? '📋 Kopyalama patch' : '✂ Kes-yapıştır patch'} — sürükleyerek taşıyın
          </div>
          <RangeRow
            label="Ölçek"
            value={+(patch.scale || 1).toFixed(2)}
            min={0.2}
            max={4}
            step={0.05}
            unit="×"
            onChange={(v) => updatePatch(patch.id, (p) => ({ ...p, scale: v }))}
          />
          <RangeRow
            label="Döndürme"
            value={patch.rotation || 0}
            min={-180}
            max={180}
            step={1}
            unit="°"
            onChange={(v) => updatePatch(patch.id, (p) => ({ ...p, rotation: v }))}
          />
          <RangeRow
            label="Parlaklık"
            value={patch.brightness || 100}
            min={50}
            max={150}
            step={1}
            unit="%"
            onChange={(v) => updatePatch(patch.id, (p) => ({ ...p, brightness: v }))}
          />
          <RangeRow
            label="Kontrast"
            value={patch.contrast || 100}
            min={50}
            max={150}
            step={1}
            unit="%"
            onChange={(v) => updatePatch(patch.id, (p) => ({ ...p, contrast: v }))}
          />
          <RangeRow
            label="Kenar yumuşatma"
            value={patch.feather || 0}
            min={0}
            max={50}
            step={1}
            unit="px"
            onChange={(v) => updatePatch(patch.id, (p) => ({ ...p, feather: v }))}
          />
          <SectionLabel>Katman</SectionLabel>
          <div style={{ display: 'flex', gap: 5 }}>
            <button
              onClick={() => movePatchLayer(patch.id, 'up')}
              style={{ ...tbBtn(false, { small: true }), flex: 1 }}
            >
              ▲ Öne
            </button>
            <button
              onClick={() => movePatchLayer(patch.id, 'down')}
              style={{ ...tbBtn(false, { small: true }), flex: 1 }}
            >
              ▼ Arkaya
            </button>
          </div>
          <div style={{ display: 'flex', gap: 5 }}>
            <button
              onClick={() => handleOcrFromPatch(patch)}
              style={{ ...tbBtn(false, { small: true }), flex: 1 }}
            >
              🔤 Metne Dönüştür
            </button>
            <button
              onClick={() => removePatch(patch.id)}
              style={{ ...tbBtn(false, { small: true, danger: true }), flex: 1 }}
            >
              🗑 Sil
            </button>
          </div>
        </div>
      );
    }

    if (selectedType === 'text' && selectedId) {
      const el = pageTexts.find((t) => t.id === selectedId);
      if (!el) return null;
      return (
        <div style={{ padding: 14, display: 'grid', gap: 10 }}>
          <SectionLabel>Metin Kutusu</SectionLabel>
          <div>
            <div style={{ fontSize: 11, color: T.muted, marginBottom: 4, fontWeight: 600 }}>
              İçerik
            </div>
            <textarea
              value={el.text || ''}
              onChange={(e) => updateText(el.id, (t) => ({ ...t, text: e.target.value }))}
              style={{
                width: '100%',
                minHeight: 70,
                border: `1px solid ${T.borderHi}`,
                borderRadius: 6,
                background: 'rgba(15,23,42,.04)',
                color: T.text,
                fontSize: 11,
                padding: '6px 8px',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <PropRow label="Font boyut">
            <input
              type="number"
              min={8}
              max={96}
              value={el.fontSize || 16}
              onChange={(e) =>
                updateText(el.id, (t) => ({
                  ...t,
                  fontSize: Math.max(8, Math.min(96, +e.target.value || 16)),
                }))
              }
              style={{
                width: 64,
                height: 28,
                border: `1px solid ${T.borderHi}`,
                borderRadius: 6,
                background: 'rgba(15,23,42,.04)',
                color: T.text,
                fontSize: 12,
                padding: '0 6px',
              }}
            />
            <button
              onClick={() =>
                updateText(el.id, (t) => ({ ...t, fontSize: Math.max(8, (t.fontSize || 16) - 1) }))
              }
              style={{ ...tbBtn(false, { small: true }), padding: '0 8px' }}
            >
              −
            </button>
            <button
              onClick={() =>
                updateText(el.id, (t) => ({ ...t, fontSize: Math.min(96, (t.fontSize || 16) + 1) }))
              }
              style={{ ...tbBtn(false, { small: true }), padding: '0 8px' }}
            >
              +
            </button>
          </PropRow>
          <PropRow label="Yazı tipi">
            <select
              value={el.fontFamily || 'Arial, sans-serif'}
              onChange={(e) => updateText(el.id, (t) => ({ ...t, fontFamily: e.target.value }))}
              style={{
                flex: 1,
                height: 28,
                border: `1px solid ${T.borderHi}`,
                borderRadius: 6,
                background: 'rgba(15,23,42,.04)',
                color: T.text,
                fontSize: 12,
                padding: '0 6px',
              }}
            >
              {[
                ['Arial, sans-serif', 'Arial'],
                ['Helvetica, Arial, sans-serif', 'Helvetica'],
                ["'Times New Roman', Times, serif", 'Times New Roman'],
                ['Georgia, serif', 'Georgia'],
                ["'Courier New', monospace", 'Courier New'],
                ['Verdana, sans-serif', 'Verdana'],
                ["'Trebuchet MS', sans-serif", 'Trebuchet MS'],
                ['Tahoma, sans-serif', 'Tahoma'],
              ].map(([value, label]) => (
                <option key={label} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </PropRow>
          <PropRow label="Yazı rengi">
            <input
              type="color"
              value={el.color || '#000000'}
              onChange={(e) => updateText(el.id, (t) => ({ ...t, color: e.target.value }))}
              style={{
                width: 36,
                height: 28,
                border: `1px solid ${T.borderHi}`,
                borderRadius: 4,
                cursor: 'pointer',
              }}
            />
          </PropRow>
          <PropRow label="Zemin rengi">
            <input
              type="color"
              value={resolveColorPickerValue(el.bgColor, '#ffffff')}
              onChange={(e) => updateText(el.id, (t) => ({ ...t, bgColor: e.target.value }))}
              style={{
                width: 36,
                height: 28,
                border: `1px solid ${T.borderHi}`,
                borderRadius: 4,
                cursor: 'pointer',
              }}
            />
          </PropRow>
          <PropRow label="Hizalama">
            {['left', 'center', 'right'].map((align) => (
              <button
                key={align}
                onClick={() => updateText(el.id, (t) => ({ ...t, textAlign: align }))}
                style={{ ...tbBtn(el.textAlign === align, { small: true }), padding: '0 10px' }}
              >
                {align === 'left' ? '◀' : align === 'center' ? '≡' : '▶'}
              </button>
            ))}
          </PropRow>
          <div style={{ display: 'flex', gap: 5 }}>
            <button
              onClick={() => setEditingTextId(el.id)}
              style={{ ...tbBtn(editingTextId === el.id, { small: true }), flex: 1 }}
            >
              ✏ Düzenle
            </button>
            <button
              onClick={() => removeText(el.id)}
              style={{ ...tbBtn(false, { small: true, danger: true }), flex: 1 }}
            >
              🗑 Sil
            </button>
          </div>
        </div>
      );
    }
    return null;
  };

  // ── Export panel
  const renderExportPanel = () => (
    <div style={{ padding: 14, display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <WorkflowBadge meta={documentWorkflow.statusMeta} />
        <span style={WORKFLOW_PILL_STYLE}>
          {documentWorkflow.readyPages}/{documentWorkflow.pageCount || 0} sayfa hazır
        </span>
        <span style={WORKFLOW_PILL_STYLE}>Aktif sayfa %{currentPageWorkflow.quality}</span>
      </div>
      <SectionLabel>Bu Sayfa</SectionLabel>
      <div style={{ display: 'grid', gap: 6 }}>
        <button
          onClick={exportCurrentPageSvg}
          disabled={!file || isHeavyOp}
          style={{
            ...tbBtn(false, { small: true, disabled: !file || isHeavyOp }),
            justifyContent: 'center',
          }}
        >
          📄 SVG İndir — Sayfa {currentPage}
        </button>
        <button
          onClick={exportCurrentPagePng}
          disabled={!file || isHeavyOp}
          style={{
            ...tbBtn(false, { small: true, disabled: !file || isHeavyOp }),
            justifyContent: 'center',
          }}
        >
          🖼 PNG İndir — Sayfa {currentPage}
        </button>
        <button
          onClick={exportCurrentPageJpeg}
          disabled={!file || isHeavyOp}
          style={{
            ...tbBtn(false, { small: true, disabled: !file || isHeavyOp }),
            justifyContent: 'center',
          }}
        >
          📷 JPEG İndir — Sayfa {currentPage}
        </button>
      </div>
      <SectionLabel>Tüm Belge</SectionLabel>
      <div style={{ display: 'grid', gap: 6 }}>
        <button
          onClick={exportCleanedPdf}
          disabled={!file || isHeavyOp}
          style={{
            ...tbBtn(false, { small: true, disabled: !file || isHeavyOp }),
            justifyContent: 'center',
          }}
        >
          {bulkBusy ? '⏳ PDF hazırlanıyor...' : '📑 Temizlenmiş PDF İndir'}
        </button>
        <button
          onClick={exportAllSvg}
          disabled={!file || isHeavyOp}
          style={{
            ...tbBtn(false, { small: true, disabled: !file || isHeavyOp }),
            justifyContent: 'center',
          }}
        >
          {exportBusy ? '⏳ Hazırlanıyor...' : '🗜 Tüm Sayfalar SVG (ZIP)'}
        </button>
      </div>
      <SectionLabel>Özet</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {[
          { label: 'Toplam Tespit', value: totalDetected },
          { label: 'Bu Sayfa Maske', value: masks.length },
          { label: 'Patch', value: pagePatches.length },
          { label: 'Metin Kutusu', value: pageTexts.length },
        ].map((c) => (
          <div
            key={c.label}
            style={{
              padding: '10px 12px',
              borderRadius: 10,
              background: T.surfaceAlt,
              border: `1px solid ${T.border}`,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 800, color: T.text }}>{c.value}</div>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{c.label}</div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderIntegrationPanel = () => (
    <div style={{ padding: 14, display: 'grid', gap: 12 }}>
      <div
        style={{
          padding: 12,
          borderRadius: 10,
          border: `1px solid ${canIntegrateToActivities ? '#bbf7d0' : '#fde68a'}`,
          background: canIntegrateToActivities ? 'rgba(34,197,94,.08)' : '#fffbeb',
          color: canIntegrateToActivities ? '#166534' : '#92400e',
          fontSize: 12,
          lineHeight: 1.5,
          fontWeight: 800,
        }}
      >
        {canIntegrateToActivities
          ? `${resolvedIntegrationBook.name} kitabına etkinlik olarak entegre edilecek.`
          : 'Entegrasyon için hedef kitap seçin.'}
      </div>

      {availableIntegrationBooks.length > 0 && (
        <label style={{ display: 'grid', gap: 6, fontSize: 11, color: T.muted, fontWeight: 900 }}>
          Hedef kitap
          <select
            value={resolvedIntegrationBook?.id || ''}
            onChange={(event) => {
              setIntegrationBookId(event.target.value);
              setIntegrationPreview(null);
            }}
            style={{
              height: 34,
              borderRadius: 8,
              border: `1px solid ${T.border}`,
              background: '#ffffff',
              color: T.text,
              fontSize: 12,
              fontWeight: 800,
              padding: '0 10px',
            }}
          >
            {availableIntegrationBooks.map((book) => (
              <option key={book.id} value={book.id}>
                {book.name || 'Kitap'}
              </option>
            ))}
          </select>
        </label>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <button
          type="button"
          onClick={() => setAllIntegrationPages(true)}
          disabled={!numPages}
          style={{ ...tbBtn(false, { small: true, disabled: !numPages }), justifyContent: 'center' }}
        >
          Tümünü dahil et
        </button>
        <button
          type="button"
          onClick={() => setAllIntegrationPages(false)}
          disabled={!numPages}
          style={{ ...tbBtn(false, { small: true, disabled: !numPages }), justifyContent: 'center' }}
        >
          Tümünü hariç tut
        </button>
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        <SectionLabel>Sayfa Entegrasyonu</SectionLabel>
        {integrationPageList.length ? (
          integrationPageList.map((item) => (
            <div
              key={item.pageNumber}
              style={{
                display: 'grid',
                gap: 7,
                padding: 10,
                borderRadius: 10,
                border: `1px solid ${item.include ? '#bfdbfe' : T.border}`,
                background: item.deleted ? '#fff1f2' : item.include ? '#eff6ff' : T.surfaceAlt,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <strong style={{ fontSize: 12, color: T.text }}>
                  Sayfa {item.pageNumber}
                  {item.deleted ? ' · Silindi' : ''}
                </strong>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 800, color: T.muted }}>
                  <input
                    type="checkbox"
                    checked={item.include}
                    disabled={item.deleted}
                    onChange={(event) =>
                      updateIntegrationPage(item.pageNumber, { include: event.target.checked })
                    }
                  />
                  Dahil et
                </label>
              </div>
              <select
                value={item.deleted ? 'deleted' : item.include ? item.flow : 'exclude'}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value === 'deleted') {
                    updateIntegrationPage(item.pageNumber, { include: false, deleted: true });
                    return;
                  }
                  if (value === 'exclude') {
                    updateIntegrationPage(item.pageNumber, { include: false, deleted: false });
                    return;
                  }
                  updateIntegrationPage(item.pageNumber, { include: true, deleted: false, flow: value });
                }}
                style={{
                  height: 32,
                  borderRadius: 8,
                  border: `1px solid ${T.border}`,
                  background: '#ffffff',
                  color: T.text,
                  fontSize: 12,
                  fontWeight: 800,
                  padding: '0 9px',
                }}
              >
                <option value="new">Yeni etkinlik başlat</option>
                <option value="continue">Önceki etkinliğin devamı</option>
                <option value="exclude">Hariç tut</option>
                <option value="deleted">Sayfayı sil</option>
              </select>
              {item.deleted ? (
                <button
                  type="button"
                  onClick={() =>
                    updateIntegrationPage(item.pageNumber, {
                      include: true,
                      deleted: false,
                      flow: 'new',
                    })
                  }
                  style={{ ...tbBtn(false, { small: true }), justifyContent: 'center' }}
                >
                  Geri al
                </button>
              ) : null}
            </div>
          ))
        ) : (
          <div style={{ fontSize: 12, color: T.muted }}>PDF yüklendiğinde sayfalar burada görünür.</div>
        )}
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        <button
          type="button"
          onClick={buildIntegrationPreview}
          disabled={!file || integrationBusy || !canIntegrateToActivities}
          style={{
            ...tbBtn(false, {
              small: true,
              disabled: !file || integrationBusy || !canIntegrateToActivities,
            }),
            justifyContent: 'center',
          }}
        >
          {integrationBusy ? 'Önizleme hazırlanıyor...' : 'Entegrasyon Önizlemesi'}
        </button>
        <button
          type="button"
          onClick={integratePdfPages}
          disabled={!file || integrationBusy || !canIntegrateToActivities || !includedIntegrationCount}
          style={{
            ...tbBtn(false, {
              small: true,
              disabled:
                !file || integrationBusy || !canIntegrateToActivities || !includedIntegrationCount,
            }),
            justifyContent: 'center',
            background:
              file && canIntegrateToActivities && includedIntegrationCount ? '#2563eb' : undefined,
            color: file && canIntegrateToActivities && includedIntegrationCount ? '#ffffff' : undefined,
          }}
        >
          Sisteme Entegre Et
        </button>
      </div>

      {integrationPreview && (
        <div style={{ display: 'grid', gap: 8 }}>
          <SectionLabel>Önizleme</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { label: 'Oluşturulacak', value: integrationPreview.createCount },
              { label: 'Atlanacak', value: integrationPreview.duplicateCount },
              { label: 'Hariç', value: integrationPreview.excludedCount },
              { label: 'Devam Grubu', value: integrationPreview.continuationGroupCount },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  padding: '9px 10px',
                  borderRadius: 10,
                  border: `1px solid ${T.border}`,
                  background: '#ffffff',
                }}
              >
                <div style={{ fontSize: 18, fontWeight: 900, color: T.text }}>{item.value}</div>
                <div style={{ fontSize: 11, color: T.muted }}>{item.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            {integrationPreview.entries.map((entry) => {
              const warnings = entry.page?.sanitizeReport?.warnings || [];
              return (
                <div
                  key={entry.planId}
                  style={{
                    padding: 9,
                    borderRadius: 9,
                    border: `1px solid ${entry.status === 'create' ? '#bfdbfe' : '#e5e7eb'}`,
                    background: entry.status === 'create' ? '#eff6ff' : '#f8fafc',
                    fontSize: 11,
                    lineHeight: 1.45,
                    color: T.text,
                  }}
                >
                  <strong>Sayfa {entry.originalPageNumber}</strong>{' '}
                  {entry.status === 'create'
                    ? `→ ${entry.activityName}`
                    : `→ ${entry.reason || 'Atlanacak'}`}
                  {entry.hasBackButton ? <div>Base layer: Geri butonu</div> : null}
                  {entry.hasForwardButton ? <div>Correct layer: İleri butonu</div> : null}
                  {warnings.length ? (
                    <div style={{ color: '#b45309', fontWeight: 800 }}>
                      Uyarı: {warnings.join(' ')}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.5 }}>
        SVG {(PDF_INTEGRATION_WARN_BYTES / 1024 / 1024).toFixed(0)} MB üstünde uyarılır,{' '}
        {(PDF_INTEGRATION_CONFIRM_BYTES / 1024 / 1024).toFixed(0)} MB üstünde açık onay
        istenir. Duplicate kontrolü V0’da sanitize edilmiş SVG hash’iyle çalışır.
      </div>
    </div>
  );

  // ── Main canvas area
  // Ağır işlemler (render/tarama/export/entegrasyon) çakışmasın diye tüm ağır butonlar tek kilide bağlı.
  const isHeavyOp = busy || renderBusy || bulkBusy || exportBusy || integrationBusy;

  const zoomBtnStyle = {
    width: 28,
    height: 28,
    border: `1px solid ${T.border}`,
    borderRadius: 6,
    background: '#fff',
    color: T.text,
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
    padding: 0,
  };

  const renderCanvas = () => (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        background:
          'radial-gradient(circle at 50% 15%,rgba(56,189,248,.10),transparent 28%), linear-gradient(180deg,#111c2d 0%,#0b1422 100%)',
        overflow: 'auto',
        padding: 28,
      }}
    >
      {!file ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 20,
            textAlign: 'center',
            color: T.muted,
            userSelect: 'none',
            background: 'rgba(255,255,255,.96)',
            border: `1px solid ${T.borderHi}`,
            borderRadius: 18,
            padding: '34px 42px',
            boxShadow: '0 24px 52px rgba(2,6,23,.24)',
          }}
        >
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 20,
              border: `2px dashed ${T.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 36,
            }}
          >
            📄
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 8 }}>
              PDF Sürükle & Bırak
            </div>
            <div style={{ fontSize: 12 }}>veya üst çubukta PDF Seç butonunu kullanın</div>
          </div>
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 20px',
              borderRadius: 10,
              border: `1px solid ${T.accentBorder}`,
              background: T.accentBg,
              color: T.accent,
              fontWeight: 700,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            <input
              type="file"
              accept="application/pdf,.pdf"
              style={{ display: 'none' }}
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            📂 PDF Dosyası Seç
          </label>
        </div>
      ) : (
        <div
          style={{
            position: 'relative',
            width: pageViewport.width,
            height: pageViewport.height,
            flex: '0 0 auto',
            background: '#ffffff',
            border: '1px solid rgba(226,232,240,.92)',
            borderRadius: 10,
            boxShadow:
              '0 34px 70px rgba(2,6,23,.38), 0 0 0 1px rgba(255,255,255,.08)',
            overflow: 'hidden',
            // Görüntü zoom'u + pan: CSS transform layout'u değiştirmez, koordinat matematiğini bozmaz.
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${viewZoom})`,
            transformOrigin: '0 0',
            willChange: 'transform',
          }}
        >
          <canvas ref={canvasRef} style={{ display: 'block' }} />
          <div
            ref={surfaceRef}
            onPointerDown={handleSurfacePointerDown}
            style={{
              position: 'absolute',
              inset: 0,
              touchAction: 'none',
              userSelect: 'none',
              cursor: isSpacePan
                ? panGestureRef.current
                  ? 'grabbing'
                  : 'grab'
                : mode === 'view'
                  ? 'default'
                  : 'crosshair',
            }}
          >
            {alignmentGuides.map((g, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  top: g.y !== undefined ? `${g.y / 10}%` : 0,
                  left: g.x !== undefined ? `${g.x / 10}%` : 0,
                  width: g.x !== undefined ? 1 : '100%',
                  height: g.y !== undefined ? 1 : '100%',
                  background: 'rgba(37,99,235,.35)',
                  zIndex: 100,
                  pointerEvents: 'none',
                }}
              />
            ))}
            {marqueeRect &&
              (() => {
                const box = pixelBox(marqueeRect, pageViewport.width, pageViewport.height);
                return (
                  <div
                    style={{
                      position: 'absolute',
                      left: box.x,
                      top: box.y,
                      width: box.width,
                      height: box.height,
                      border: '1px dashed rgba(37,99,235,.9)',
                      background: 'rgba(37,99,235,.12)',
                      zIndex: 120,
                      pointerEvents: 'none',
                    }}
                  />
                );
              })()}
            {masks
              .filter((m) => layerVisibility[m.id] !== false)
              .map((mask) => {
                const box = pixelBox(mask.box, pageViewport.width, pageViewport.height);
                const isSel = isItemSelected(mask.id, 'mask') || activeMaskId === mask.id;
                return (
                  <div
                    key={mask.id}
                    role="button"
                    tabIndex={0}
                    aria-label={mask.label || 'Maske'}
                    aria-pressed={isSel}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setActiveMaskId(mask.id);
                        selectSingle(mask.id, 'mask');
                        setRightTab('ozellikler');
                      }
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (e.shiftKey) {
                        toggleSelected(mask.id, 'mask');
                        setActiveMaskId(mask.id);
                        setSelectedId(null);
                        setSelectedType(null);
                      } else {
                        setActiveMaskId(mask.id);
                        selectSingle(mask.id, 'mask');
                        setSelectedId(null);
                        setSelectedType(null);
                      }
                      setRightTab('ozellikler');
                    }}
                    style={{
                      position: 'absolute',
                      left: box.x,
                      top: box.y,
                      width: box.width,
                      height: box.height,
                      background: mask.bgColor || '#ffffff',
                      outline: isSel ? '2px solid rgba(37,99,235,.9)' : 'none',
                      boxShadow: 'none',
                      cursor: 'pointer',
                      // Çizim modunda maskenin üstünden yeni alan çizilebilsin.
                      pointerEvents: mode !== 'view' ? 'none' : 'auto',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {isTickMask(mask) && (
                      <svg
                        viewBox="0 0 100 100"
                        style={{ width: '78%', height: '78%', overflow: 'visible' }}
                      >
                        <path
                          d="M20 56 L42 80 L82 22"
                          fill="none"
                          stroke={mask.markColor || '#0f766e'}
                          strokeWidth="12"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>
                );
              })}
            {pagePatches
              .filter((p) => layerVisibility[p.id] !== false)
              .slice()
              .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
              .map((patch) => {
                const src = sourceCleanupRect(
                  getPatchSourceCleanupBox(patch),
                  pageViewport.width,
                  pageViewport.height,
                  2
                );
                const tgt = pixelBox(
                  dragGhost?.id === patch.id ? dragGhost.box : patch.targetBox,
                  pageViewport.width,
                  pageViewport.height
                );
                const active = selectedType === 'patch' && selectedId === patch.id;
                const inMulti = active || isItemSelected(patch.id, 'patch');
                const m = getPatchRenderMetrics(patch, tgt);
                return (
                  <div key={patch.id}>
                    {!patch.isClone && (
                      <div
                        style={{
                          position: 'absolute',
                          left: src.x,
                          top: src.y,
                          width: src.width,
                          height: src.height,
                          background: patch.bgColor || '#ffffff',
                          backgroundImage: 'none',
                          border: 0,
                          outline: 'none',
                          boxShadow: 'none',
                          pointerEvents: 'none',
                        }}
                      />
                    )}
                    <div
                      // Çizim modunda öğe üstünden yeni alan çizilebilsin diye olayı yüzeye bırak.
                      onPointerDown={(e) => {
                        if (isSpacePan || e.button === 1) return; // pan jesti
                        if (mode !== 'view') return; // çizim modu: surface çizimi başlatsın
                        e.stopPropagation();
                        if (e.shiftKey) {
                          toggleSelected(patch.id, 'patch');
                          setSelectedId(patch.id);
                          setSelectedType('patch');
                          setActiveMaskId(null);
                          setRightTab('ozellikler');
                          return;
                        }
                        const pt = getNormalizedPoint(e.clientX, e.clientY);
                        if (!pt) return;
                        if (!isItemSelected(patch.id, 'patch')) selectSingle(patch.id, 'patch');
                        setSelectedId(patch.id);
                        setSelectedType('patch');
                        setActiveMaskId(null);
                        bringToFront(patch.id, 'patch');
                        setDraggingElement({
                          id: patch.id,
                          type: 'patch',
                          startX: pt.x,
                          startY: pt.y,
                          initialBox: patch.targetBox,
                        });
                        setRightTab('ozellikler');
                      }}
                      style={{
                        position: 'absolute',
                        left: m.centerX,
                        top: m.centerY,
                        width: m.drawWidth,
                        height: m.drawHeight,
                        transform: `translate(-50%,-50%) rotate(${patch.rotation || 0}deg)`,
                        transformOrigin: 'center',
                        zIndex: (patch.zIndex || 0) + 30,
                        cursor: mode !== 'view' ? 'crosshair' : 'move',
                        pointerEvents: mode !== 'view' ? 'none' : 'auto',
                        outline: inMulti
                          ? `2px solid rgba(37,99,235,${active ? 0.6 : 0.4})`
                          : 'none',
                        outlineOffset: 0,
                      }}
                    >
                      <img
                        src={patch.imageData}
                        alt=""
                        draggable={false}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'fill',
                          display: 'block',
                          filter: `brightness(${patch.brightness || 100}%) contrast(${patch.contrast || 100}%)`,
                        }}
                      />
                      {active && (
                        <>
                          {resizeHandle(
                            (e) => {
                              e.stopPropagation();
                              setResizing({
                                id: patch.id,
                                type: 'patch',
                                handle: 'nw',
                                initialBox: patch.targetBox,
                              });
                            },
                            { left: -5, top: -5, cursor: 'nwse-resize' }
                          )}
                          {resizeHandle(
                            (e) => {
                              e.stopPropagation();
                              setResizing({
                                id: patch.id,
                                type: 'patch',
                                handle: 'ne',
                                initialBox: patch.targetBox,
                              });
                            },
                            { right: -5, top: -5, cursor: 'nesw-resize' }
                          )}
                          {resizeHandle(
                            (e) => {
                              e.stopPropagation();
                              setResizing({
                                id: patch.id,
                                type: 'patch',
                                handle: 'sw',
                                initialBox: patch.targetBox,
                              });
                            },
                            { left: -5, bottom: -5, cursor: 'nesw-resize' }
                          )}
                          {resizeHandle(
                            (e) => {
                              e.stopPropagation();
                              setResizing({
                                id: patch.id,
                                type: 'patch',
                                handle: 'se',
                                initialBox: patch.targetBox,
                              });
                            },
                            { right: -5, bottom: -5, cursor: 'nwse-resize' }
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            {pageTexts
              .filter((el) => layerVisibility[el.id] !== false)
              .slice()
              .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
              .map((el) => {
                const box = pixelBox(
                  dragGhost?.id === el.id ? dragGhost.box : el.box,
                  pageViewport.width,
                  pageViewport.height
                );
                const active = selectedType === 'text' && selectedId === el.id;
                const inMulti = active || isItemSelected(el.id, 'text');
                const editing = editingTextId === el.id;
                // Ekran font boyutu render ölçeğiyle çarpılır (WYSIWYG: ekran ≈ export).
                const screenFont = (el.fontSize || 16) * displayScale;
                const fontFamily = el.fontFamily || 'Arial, sans-serif';
                return (
                  <div
                    key={el.id}
                    onPointerDown={(e) => {
                      if (isSpacePan || e.button === 1) return; // pan jesti
                      if (mode !== 'view') return; // çizim modu: surface çizimi başlatsın
                      e.stopPropagation();
                      if (editing) return;
                      if (e.shiftKey) {
                        toggleSelected(el.id, 'text');
                        setSelectedId(el.id);
                        setSelectedType('text');
                        setActiveMaskId(null);
                        setRightTab('ozellikler');
                        return;
                      }
                      const pt = getNormalizedPoint(e.clientX, e.clientY);
                      if (!pt) return;
                      if (!isItemSelected(el.id, 'text')) selectSingle(el.id, 'text');
                      setSelectedId(el.id);
                      setSelectedType('text');
                      setActiveMaskId(null);
                      bringToFront(el.id, 'text');
                      setDraggingElement({
                        id: el.id,
                        type: 'text',
                        startX: pt.x,
                        startY: pt.y,
                        initialBox: el.box,
                      });
                      setRightTab('ozellikler');
                    }}
                    style={{
                      position: 'absolute',
                      left: box.x,
                      top: box.y,
                      width: box.width,
                      height: box.height,
                      background: el.bgColor || '#ffffff',
                      color: el.color || '#000000',
                      fontSize: screenFont,
                      fontFamily,
                      textAlign: el.textAlign || 'center',
                      cursor: mode !== 'view' ? 'crosshair' : editing ? 'text' : 'move',
                      pointerEvents: mode !== 'view' && !editing ? 'none' : 'auto',
                      zIndex: (el.zIndex || 0) + 50,
                      outline: inMulti
                        ? `2px solid rgba(37,99,235,${active ? 0.5 : 0.4})`
                        : '1px solid rgba(148,163,184,.5)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent:
                        el.textAlign === 'left'
                          ? 'flex-start'
                          : el.textAlign === 'right'
                            ? 'flex-end'
                            : 'center',
                      padding: 6,
                      whiteSpace: 'pre-wrap',
                      overflow: 'hidden',
                    }}
                  >
                    {editing ? (
                      <textarea
                        autoFocus
                        value={el.text || ''}
                        onChange={(e) => updateTextValue(el.id, e.target.value)}
                        onBlur={() => finishTextEdit()}
                        onKeyDown={(e) => {
                          // Esc: düzenlemeyi bitir; Ctrl/Cmd+Enter: bitir. (Enter satır ekler.)
                          if (e.key === 'Escape' || ((e.ctrlKey || e.metaKey) && e.key === 'Enter')) {
                            e.preventDefault();
                            finishTextEdit();
                          }
                          e.stopPropagation();
                        }}
                        style={{
                          width: '100%',
                          height: '100%',
                          border: 0,
                          outline: 0,
                          resize: 'none',
                          background: 'transparent',
                          color: el.color || '#000',
                          fontSize: screenFont,
                          fontFamily,
                          textAlign: el.textAlign || 'center',
                        }}
                      />
                    ) : (
                      <div onDoubleClick={() => setEditingTextId(el.id)} style={{ width: '100%' }}>
                        {el.text}
                      </div>
                    )}
                    {active && !editing && (
                      <>
                        {resizeHandle(
                          (e) => {
                            e.stopPropagation();
                            setResizing({
                              id: el.id,
                              type: 'text',
                              handle: 'nw',
                              initialBox: el.box,
                            });
                          },
                          { left: -5, top: -5, cursor: 'nwse-resize' }
                        )}
                        {resizeHandle(
                          (e) => {
                            e.stopPropagation();
                            setResizing({
                              id: el.id,
                              type: 'text',
                              handle: 'ne',
                              initialBox: el.box,
                            });
                          },
                          { right: -5, top: -5, cursor: 'nesw-resize' }
                        )}
                        {resizeHandle(
                          (e) => {
                            e.stopPropagation();
                            setResizing({
                              id: el.id,
                              type: 'text',
                              handle: 'sw',
                              initialBox: el.box,
                            });
                          },
                          { left: -5, bottom: -5, cursor: 'nesw-resize' }
                        )}
                        {resizeHandle(
                          (e) => {
                            e.stopPropagation();
                            setResizing({
                              id: el.id,
                              type: 'text',
                              handle: 'se',
                              initialBox: el.box,
                            });
                          },
                          { right: -5, bottom: -5, cursor: 'nwse-resize' }
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            {draftRect && (
              <div
                style={{
                  position: 'absolute',
                  left: `${draftRect[1] / 10}%`,
                  top: `${draftRect[0] / 10}%`,
                  width: `${boxWidth(draftRect) / 10}%`,
                  height: `${boxHeight(draftRect) / 10}%`,
                  border: `2px solid ${mode === 'patch' ? T.accent : '#7dd3fc'}`,
                  background: mode === 'patch' ? 'rgba(37,99,235,.08)' : 'rgba(96,165,250,.1)',
                  zIndex: 90,
                  pointerEvents: 'none',
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );

  // ── Layer list
  const renderLayers = () => {
    const allItems = [
      ...masks.map((m) => ({ ...m, _kind: 'mask' })),
      ...pagePatches.map((p) => ({ ...p, _kind: 'patch' })),
      ...pageTexts.map((t) => ({ ...t, _kind: 'text' })),
    ];
    const isActive = (item) =>
      (item._kind === 'mask' && activeMaskId === item.id) ||
      ((item._kind === 'patch' || item._kind === 'text') && selectedId === item.id);
    const selectItem = (item) => {
      if (item._kind === 'mask') {
        setActiveMaskId(item.id);
        setSelectedId(null);
        setSelectedType(null);
      } else {
        setSelectedId(item.id);
        setSelectedType(item._kind);
        setActiveMaskId(null);
      }
      selectSingle(item.id, item._kind);
      setRightTab('ozellikler');
    };
    const deleteItem = (item) => {
      if (item._kind === 'mask') removeMask(item.id);
      else if (item._kind === 'patch') removePatch(item.id);
      else removeText(item.id);
    };
    const visible = (id) => layerVisibility[id] !== false;
    const toggleVis = (id) => setLayerVisibility((prev) => ({ ...prev, [id]: !visible(id) }));

    if (!allItems.length)
      return (
        <div
          style={{
            padding: 16,
            color: T.muted,
            fontSize: 11,
            textAlign: 'center',
            lineHeight: 1.7,
          }}
        >
          Bu sayfada henüz katman yok.
          <br />
          Araç seçip üzerine çizin.
        </div>
      );

    return (
      <div style={{ display: 'grid', gap: 7, padding: 12 }}>
        {allItems.map((item, idx) => {
          const { icon, color } = iconTypeLabel(item);
          const vis = visible(item.id);
          const active = isActive(item);
          return (
            <div
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 10px',
                borderRadius: 10,
                border: active ? `1px solid ${T.accentBorder}` : `1px solid ${T.border}`,
                background: active ? 'linear-gradient(180deg,#ffffff 0%,#eff6ff 100%)' : '#ffffff',
                opacity: vis ? 1 : 0.45,
                boxShadow: active ? '0 8px 18px rgba(37,99,235,.10)' : '0 4px 10px rgba(15,23,42,.04)',
              }}
            >
              <span
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 8,
                  background: `${color}14`,
                  color,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 900,
                  flexShrink: 0,
                }}
              >
                {icon}
              </span>
              <button
                onClick={() => selectItem(item)}
                style={{
                  flex: 1,
                  background: 'none',
                  border: 'none',
                  color: T.text,
                  fontSize: 11,
                  fontWeight: active ? 850 : 700,
                  cursor: 'pointer',
                  textAlign: 'left',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  padding: 0,
                  lineHeight: 1.25,
                }}
              >
                {idx + 1}.{' '}
                {item.label ||
                  (item._kind === 'text'
                    ? (item.text || 'Metin').slice(0, 18)
                    : item.isClone
                      ? 'Clone Patch'
                      : item._kind === 'patch'
                        ? 'Patch'
                        : 'Maske')}
              </button>
              <button
                onClick={() => toggleVis(item.id)}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 8,
                  background: vis ? '#f8fafc' : '#ffffff',
                  border: `1px solid ${T.border}`,
                  color: vis ? T.muted : T.border,
                  cursor: 'pointer',
                  fontSize: 12,
                  padding: 0,
                }}
                title="Görünürlük"
              >
                👁
              </button>
              <button
                onClick={() => deleteItem(item)}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 8,
                  background: '#fff7f7',
                  border: '1px solid #fecaca',
                  color: T.danger,
                  cursor: 'pointer',
                  fontSize: 12,
                  padding: 0,
                }}
                title="Sil"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    );
  };

  // ── Keyboard help modal
  const keyHelpModal = showKeyHelp && (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(15,23,42,.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={() => setShowKeyHelp(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Klavye kısayolları"
        ref={(node) => node && node.focus()}
        tabIndex={-1}
        style={{
          background: '#ffffff',
          border: `1px solid ${T.borderHi}`,
          borderRadius: 20,
          padding: 28,
          minWidth: 340,
          maxHeight: '80vh',
          overflowY: 'auto',
          outline: 'none',
          boxShadow: '0 24px 64px rgba(15,23,42,.4)',
          color: T.text,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 16 }}>⌨ Klavye Kısayolları</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {[
            ['V', 'Görüntüleme modu'],
            ['E', 'Silgi / Maske çiz'],
            ['P', 'Patch (alan taşı)'],
            ['T', 'Metin ekle'],
            ['Ctrl+Z', 'Geri al'],
            ['Ctrl+Y / Ctrl+Shift+Z', 'İleri al'],
            ['Ctrl+C', 'Kopyala'],
            ['Ctrl+V', 'Yapıştır'],
            ['Ctrl+D', 'Çoğalt'],
            ['Ctrl+A', 'Tümünü seç'],
            ['Ctrl+S', 'Temizlenmiş PDF indir'],
            ['Ok tuşları', 'Kaydır (Shift = 10×)'],
            ['PageUp / PageDown', 'Önceki / sonraki sayfa'],
            ['Ctrl+Tekerlek', 'Yakınlaştır / uzaklaştır'],
            ['Space + sürükle', 'Kaydır (pan)'],
            ['Delete / Backspace', 'Seçili öğeyi sil'],
            ['Esc', 'Seçimi/modu kaldır'],
            ['?', 'Yardımı aç/kapat'],
          ].map(([k, d]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <kbd
                style={{
                  background: '#e2e8f0',
                  border: `1px solid ${T.borderHi}`,
                  borderRadius: 5,
                  padding: '3px 9px',
                  fontSize: 11,
                  fontFamily: 'monospace',
                  color: T.accent,
                  minWidth: 70,
                  textAlign: 'center',
                }}
              >
                {k}
              </kbd>
              <span style={{ fontSize: 11, color: T.muted }}>{d}</span>
            </div>
          ))}
        </div>
        <button
          onClick={() => setShowKeyHelp(false)}
          style={{
            marginTop: 20,
            width: '100%',
            height: 36,
            borderRadius: 8,
            border: `1px solid ${T.border}`,
            background: 'rgba(15,23,42,.04)',
            color: T.text,
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          Kapat
        </button>
      </div>
    </div>
  );

  const toolModes = [
    { id: 'view', icon: '👁', label: 'Görüntüle', key: 'V' },
    { id: 'manual', icon: '🔲', label: 'Silgi', key: 'E' },
    { id: 'patch', icon: '✂', label: 'Patch', key: 'P' },
    { id: 'text', icon: 'T', label: 'Metin', key: 'T' },
  ];

  const studio = (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleGlobalDrop}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: T.bg,
        color: T.text,
        fontFamily: "'Segoe UI',Tahoma,Geneva,Verdana,sans-serif",
        fontSize: 12,
        position: 'relative',
      }}
    >
      {isDragOver && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 9000,
            background: 'rgba(37,99,235,.12)',
            border: '3px dashed rgba(37,99,235,.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <div style={{ fontSize: 24, fontWeight: 800, color: T.accent }}>
            📄 PDF Dosyasını Bırakın
          </div>
        </div>
      )}

      {keyHelpModal}

      {/* ── Header ── */}
      <div
        style={{
          height: 52,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          padding: '0 14px 0 12px',
          borderBottom: `1px solid ${T.border}`,
          background: 'linear-gradient(180deg,#ffffff 0%,#f6f9fd 100%)',
          gap: 12,
          boxShadow: '0 1px 0 rgba(255,255,255,.9), 0 8px 22px rgba(15,23,42,.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 11,
              background: 'linear-gradient(135deg,#2563eb 0%,#38bdf8 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              fontWeight: 900,
              color: '#fff',
              boxShadow: '0 8px 18px rgba(37,99,235,.22), inset 0 1px 0 rgba(255,255,255,.38)',
            }}
          >
            P
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: T.text, lineHeight: 1 }}>
              PDF Düzenleme Stüdyosu
            </div>
            <div style={{ fontSize: 11, color: T.muted, letterSpacing: 0.2 }}>
              E-İçerik Studio
            </div>
          </div>
        </div>
        <div style={{ width: 1, height: 28, background: T.border, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          {file ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: T.accent,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                📄 {file.name}
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: T.muted,
                  whiteSpace: 'nowrap',
                  padding: '3px 8px',
                  borderRadius: 999,
                  border: `1px solid ${T.border}`,
                  background: '#ffffff',
                  fontWeight: 700,
                }}
              >
                {numPages} sayfa
              </span>
              {busy && <span style={{ fontSize: 11, color: T.warn }}>⟳ İşleniyor...</span>}
            </div>
          ) : (
            <span style={{ fontSize: 11, color: T.muted }}>PDF dosyası seçin veya sürükleyin</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <label style={{ ...tbBtn(false), cursor: 'pointer' }}>
            <input
              type="file"
              accept="application/pdf,.pdf"
              style={{ display: 'none' }}
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            📂 PDF Seç
          </label>
          {file && (
            <button onClick={() => setFile(null)} style={tbBtn(false)}>
              ✕ Kapat
            </button>
          )}
          <button
            onClick={() => setShowKeyHelp((v) => !v)}
            style={tbBtn(showKeyHelp)}
            title="Klavye kısayolları (?)"
          >
            ⌨
          </button>
          {typeof onClose === 'function' && (
            <button onClick={onClose} style={tbBtn(false)}>
              ◀ Geri
            </button>
          )}
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div
        style={{
          height: 44,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          padding: '0 10px',
          borderBottom: `1px solid ${T.border}`,
          background: T.shellSoft,
          gap: 4,
          overflowX: 'auto',
          boxShadow: '0 1px 0 rgba(255,255,255,.8)',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: 3,
            alignItems: 'center',
            padding: '0 4px 0 0',
            borderRight: `1px solid ${T.border}`,
          }}
        >
          <span style={{ fontSize: 11, color: T.muted, marginRight: 4, whiteSpace: 'nowrap' }}>
            ARAÇLAR
          </span>
          {toolModes.map((t) => (
            <button
              key={t.id}
              onClick={() => setMode(mode === t.id && t.id !== 'view' ? 'view' : t.id)}
              title={`${t.label} (${t.key})`}
              style={{ ...tbBtn(mode === t.id), padding: '0 10px', gap: 4 }}
            >
              <span>{t.icon}</span> {t.label}
            </button>
          ))}
          {mode === 'patch' && (
            <>
              <div style={{ width: 1, height: 20, background: T.border }} />
              <button
                onClick={() => setPatchToolMode('cut')}
                style={{ ...tbBtn(patchToolMode === 'cut', { small: true }) }}
              >
                ✂ Kes
              </button>
              <button
                onClick={() => setPatchToolMode('clone')}
                style={{ ...tbBtn(patchToolMode === 'clone', { small: true }) }}
              >
                📋 Kopyala
              </button>
            </>
          )}
        </div>
        <Divider />
        <div
          style={{
            display: 'flex',
            gap: 3,
            alignItems: 'center',
            padding: '0 4px 0 0',
            borderRight: `1px solid ${T.border}`,
          }}
        >
          <button
            onClick={undo}
            disabled={historyIndex <= 0}
            style={tbBtn(false, { disabled: historyIndex <= 0 })}
            title="Geri Al (Ctrl+Z)"
          >
            ↩ Geri
          </button>
          <button
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            style={tbBtn(false, { disabled: historyIndex >= history.length - 1 })}
            title="İleri Al (Ctrl+Y)"
          >
            ↪ İleri
          </button>
        </div>
        <Divider />
        <div
          style={{
            display: 'flex',
            gap: 3,
            alignItems: 'center',
            padding: '0 4px 0 0',
            borderRight: `1px solid ${T.border}`,
          }}
        >
          <span style={{ fontSize: 11, color: T.muted, whiteSpace: 'nowrap' }}>TARAMA</span>
          <button
            onClick={runAutoCleanCurrentPage}
            disabled={!file || isHeavyOp}
            style={tbBtn(false, { disabled: !file || isHeavyOp })}
          >
            {busy ? '⟳ Taranıyor...' : '⚡ Bu Sayfa'}
          </button>
          <button
            onClick={runAutoCleanAllPages}
            disabled={!file || isHeavyOp}
            style={tbBtn(false, { disabled: !file || isHeavyOp })}
          >
            {bulkBusy ? `⟳ ${bulkProgress}/${numPages}` : '⚡ Tümü'}
          </button>
          <button onClick={() => setShowSettings((v) => !v)} style={tbBtn(showSettings)}>
            ⚙ Ayarlar{isSettingsModified ? ' ●' : ''}
          </button>
        </div>
        <Divider />
        <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: T.muted, whiteSpace: 'nowrap' }}>DIŞA AKTAR</span>
          <button
            onClick={exportCurrentPagePng}
            disabled={!file || isHeavyOp}
            style={tbBtn(false, { small: true, disabled: !file || isHeavyOp })}
          >
            PNG
          </button>
          <button
            onClick={exportCurrentPageSvg}
            disabled={!file || isHeavyOp}
            style={tbBtn(false, { small: true, disabled: !file || isHeavyOp })}
          >
            SVG
          </button>
          <button
            onClick={exportCleanedPdf}
            disabled={!file || isHeavyOp}
            style={tbBtn(false, { small: true, disabled: !file || isHeavyOp })}
          >
            {bulkBusy ? '⟳' : '📑 PDF'}
          </button>
        </div>
        <div style={{ flex: 1 }} />
        {file && numPages > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              style={tbBtn(false, { small: true, disabled: currentPage <= 1 })}
            >
              ◀
            </button>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const v = parseInt(pageJumpValue, 10);
                if (v >= 1 && v <= numPages) setCurrentPage(v);
                setPageJumpValue('');
              }}
            >
              <input
                value={pageJumpValue || currentPage}
                onChange={(e) => setPageJumpValue(e.target.value)}
                onFocus={() => setPageJumpValue('')}
                style={{
                  width: 36,
                  height: 26,
                  textAlign: 'center',
                  border: `1px solid ${T.borderHi}`,
                  borderRadius: 5,
                  background: 'rgba(15,23,42,.06)',
                  color: T.text,
                  fontSize: 11,
                }}
              />
            </form>
            <span style={{ fontSize: 11, color: T.muted }}>/ {numPages}</span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
              disabled={currentPage >= numPages}
              style={tbBtn(false, { small: true, disabled: currentPage >= numPages })}
            >
              ▶
            </button>
          </div>
        )}
      </div>

      {/* ── Settings Panel ── */}
      {showSettings && (
        <div
          style={{
            flexShrink: 0,
            borderBottom: `1px solid ${T.border}`,
            background: '#f1f5f9',
            padding: '14px 16px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))',
            gap: 14,
          }}
        >
          <div
            style={{
              padding: 12,
              borderRadius: 12,
              border: `1px solid ${T.border}`,
              background: T.surfaceAlt,
            }}
          >
            <SectionLabel>Arka Plan Uyumu</SectionLabel>
            <div style={{ display: 'grid', gap: 5 }}>
              {[
                ['auto', 'Otomatik halka örnekleme'],
                ['white', 'Saf beyaz'],
                ['average', 'Lokal ortalama'],
              ].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setSamplingMode(id)}
                  style={{
                    ...tbBtn(samplingMode === id, { small: true }),
                    justifyContent: 'flex-start',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div
            style={{
              padding: 12,
              borderRadius: 12,
              border: `1px solid ${T.border}`,
              background: T.surfaceAlt,
            }}
          >
            <SectionLabel>Tarama Hassasiyeti</SectionLabel>
            <div style={{ display: 'flex', gap: 5 }}>
              {[
                ['low', 'Düşük'],
                ['medium', 'Orta'],
                ['high', 'Yüksek'],
              ].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setAiConfig((p) => ({ ...p, sensitivity: id }))}
                  style={{
                    ...tbBtn(aiConfig.sensitivity === id, { small: true }),
                    flex: 1,
                    justifyContent: 'center',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div
            style={{
              padding: 12,
              borderRadius: 12,
              border: `1px solid ${T.border}`,
              background: T.surfaceAlt,
            }}
          >
            <SectionLabel>Tespit Türleri</SectionLabel>
            <div style={{ display: 'grid', gap: 4 }}>
              {[
                ['checkbox', '☑ İşaretler'],
                ['draggable', '⊞ Sürüklenebilir'],
                ['answer', 'A Cevaplar'],
                ['note', '📝 Notlar'],
                ['handwriting', '✍ El yazısı'],
              ].map(([id, label]) => {
                const on = aiConfig.enabledTypes.includes(id);
                return (
                  <button
                    key={id}
                    onClick={() =>
                      setAiConfig((p) => ({
                        ...p,
                        enabledTypes: on
                          ? p.enabledTypes.filter((t) => t !== id)
                          : [...p.enabledTypes, id],
                      }))
                    }
                    style={{ ...tbBtn(on, { small: true }), justifyContent: 'space-between' }}
                  >
                    <span>{label}</span>
                    <span style={{ fontSize: 11, opacity: 0.7 }}>{on ? 'Açık' : 'Kapalı'}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div
            style={{
              padding: 12,
              borderRadius: 12,
              border: `1px solid ${T.border}`,
              background: T.surfaceAlt,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              justifyContent: 'flex-end',
            }}
          >
            <SectionLabel>Eylemler</SectionLabel>
            <button
              onClick={resetSettings}
              style={{ ...tbBtn(false, { small: true }), justifyContent: 'center' }}
            >
              ↺ Varsayılana Dön
            </button>
            <button
              onClick={resetCurrentPage}
              disabled={!hasEdits}
              style={{
                ...tbBtn(false, { small: true, disabled: !hasEdits, danger: hasEdits }),
                justifyContent: 'center',
              }}
            >
              🗑 Sayfayı Sıfırla
            </button>
          </div>
        </div>
      )}

      {/* ── Main workspace ── */}
      <div
        style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden', position: 'relative' }}
      >
        <div
          style={{
            width: isSidebarOpen ? PDF_PAGE_SIDEBAR_WIDTH : 0,
            flexShrink: 0,
            overflow: 'hidden',
            borderRight: isSidebarOpen ? `1px solid ${T.border}` : 'none',
            background: '#f7f9fc',
            transition: 'width .22s cubic-bezier(.4,0,.2,1)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              padding: '12px 12px 10px',
              borderBottom: `1px solid ${T.borderHi}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              flexShrink: 0,
              background: '#ffffff',
            }}
          >
            <span
              style={{
                fontSize: 12.5,
                fontWeight: 950,
                color: T.text,
                letterSpacing: 0.2,
              }}
            >
              SAYFALAR ({numPages || 0})
            </span>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {documentWorkflow.readyPages > 0 && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 850,
                    color: T.success,
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: 999,
                    padding: '3px 7px',
                    lineHeight: 1,
                  }}
                >
                  {documentWorkflow.readyPages} hazır
                </span>
              )}
              {documentWorkflow.reviewPages > 0 && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 850,
                    color: T.warn,
                    background: '#fefce8',
                    border: '1px solid #fde68a',
                    borderRadius: 999,
                    padding: '3px 7px',
                    lineHeight: 1,
                  }}
                >
                  {documentWorkflow.reviewPages} kontrol
                </span>
              )}
            </div>
          </div>
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
              padding: 12,
            }}
          >
            {thumbnails.map((thumb) => {
              const active = thumb.pageNumber === currentPage;
              const pageWorkflow =
                pageWorkflowMap[thumb.pageNumber] ||
                buildPdfPageWorkflowSummary({
                  pageNumber: thumb.pageNumber,
                  pageMasks,
                  patches,
                  textElements,
                  currentPage,
                  busy,
                  bulkBusy,
                });
              const statusMeta = pageWorkflow.statusMeta;
              const {
                masks: maskCount,
                patches: patchCount,
                texts: textCount,
              } = pageWorkflow.counts;
              return (
                <button
                  key={thumb.pageNumber}
                  onClick={() => setCurrentPage(thumb.pageNumber)}
                  style={{
                    width: '100%',
                    position: 'relative',
                    border: active ? `1px solid ${T.accent}` : `1px solid ${statusMeta.border}`,
                    borderRadius: 8,
                    background: active
                      ? 'linear-gradient(180deg,#ffffff 0%,#eef5ff 100%)'
                      : '#ffffff',
                    padding: 7,
                    cursor: 'pointer',
                    textAlign: 'left',
                    marginBottom: 8,
                    display: 'block',
                    transition: 'border-color .15s, background .15s, box-shadow .15s',
                    boxShadow: active
                      ? '0 0 0 2px rgba(37,99,235,.16), 0 8px 18px rgba(37,99,235,.10)'
                      : '0 1px 2px rgba(15,23,42,.04)',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      inset: '0 auto 0 0',
                      width: 3,
                      borderRadius: '8px 0 0 8px',
                      background: statusMeta.color,
                    }}
                  />
                  <div
                    style={{
                      height: 132,
                      borderRadius: 7,
                      overflow: 'hidden',
                      background: '#f8fafc',
                      border: `1px solid ${active ? '#bfdbfe' : T.borderHi}`,
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <img
                      src={thumb.url}
                      alt={`Sayfa ${thumb.pageNumber}`}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        display: 'block',
                      }}
                    />
                    <span
                      style={{
                        position: 'absolute',
                        left: 8,
                        top: 8,
                        minWidth: 22,
                        height: 22,
                        borderRadius: 999,
                        background: active ? T.accent : 'rgba(15,23,42,.72)',
                        color: '#ffffff',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11,
                        fontWeight: 900,
                        boxShadow: '0 6px 12px rgba(15,23,42,.18)',
                      }}
                    >
                      {thumb.pageNumber}
                    </span>
                    {active && (
                      <div
                        style={{
                          position: 'absolute',
                        inset: 0,
                        border: '2px solid rgba(37,99,235,.38)',
                        borderRadius: 7,
                        pointerEvents: 'none',
                      }}
                    />
                    )}
                  </div>
                  <div
                    style={{
                      marginTop: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 6,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: active ? 800 : 600,
                        color: active ? T.accent : T.muted,
                        lineHeight: 1,
                      }}
                    >
                      Sayfa {thumb.pageNumber}
                    </span>
                    <WorkflowBadge meta={statusMeta} compact />
                  </div>
                  <div
                    style={{
                      marginTop: 8,
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0,1fr) auto',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        height: 8,
                        borderRadius: 999,
                        background: '#e2e8f0',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${pageWorkflow.quality}%`,
                          height: '100%',
                          borderRadius: 999,
                          background:
                            pageWorkflow.quality >= 100
                              ? 'linear-gradient(90deg,#22c55e,#16a34a)'
                              : pageWorkflow.quality >= 67
                                ? 'linear-gradient(90deg,#f59e0b,#d97706)'
                                : 'linear-gradient(90deg,#94a3b8,#64748b)',
                        }}
                      />
                    </div>
                    <span style={{ fontSize: 10.5, fontWeight: 900, color: T.text }}>
                      %{pageWorkflow.quality}
                    </span>
                  </div>
                  <div
                    style={{
                      marginTop: 7,
                      display: 'flex',
                      gap: 4,
                      alignItems: 'center',
                      flexWrap: 'wrap',
                    }}
                  >
                      {maskCount > 0 && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 850,
                            background: '#dcfce7',
                            color: '#16a34a',
                            border: '1px solid #bbf7d0',
                            borderRadius: 999,
                            padding: '3px 6px',
                            lineHeight: 1,
                          }}
                          title={`${maskCount} silgi`}
                        >
                          Silgi {maskCount}
                        </span>
                      )}
                      {patchCount > 0 && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 850,
                            background: '#e0f2fe',
                            color: '#0284c7',
                            border: '1px solid #bae6fd',
                            borderRadius: 999,
                            padding: '3px 6px',
                            lineHeight: 1,
                          }}
                          title={`${patchCount} patch`}
                        >
                          Patch {patchCount}
                        </span>
                      )}
                      {textCount > 0 && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 850,
                            background: '#ede9fe',
                            color: '#7c3aed',
                            border: '1px solid #ddd6fe',
                            borderRadius: 999,
                            padding: '3px 6px',
                            lineHeight: 1,
                          }}
                          title={`${textCount} metin`}
                        >
                          Metin {textCount}
                        </span>
                      )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <button
          onClick={() => setIsSidebarOpen((v) => !v)}
          style={{
            position: 'absolute',
            left: isSidebarOpen ? PDF_PAGE_SIDEBAR_WIDTH : 0,
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 40,
            width: 18,
            height: 52,
            border: `1px solid ${T.border}`,
            borderLeft: 'none',
            borderRadius: '0 10px 10px 0',
            background: '#ffffff',
            color: T.muted,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 700,
            transition: 'left .22s cubic-bezier(.4,0,.2,1)',
            boxShadow: '2px 0 10px rgba(15,23,42,.12)',
          }}
        >
          {isSidebarOpen ? '‹' : '›'}
        </button>

        <div
          style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}
        >
          <div
            ref={containerRef}
            style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}
          >
            {renderCanvas()}
          </div>
          <div
            style={{
              height: 30,
              flexShrink: 0,
              borderTop: `1px solid ${T.border}`,
              background: '#f1f5f9',
              display: 'flex',
              alignItems: 'center',
              padding: '0 14px',
              gap: 16,
            }}
          >
            <span
              style={{ fontSize: 11, color: mode !== 'view' ? T.accent : T.muted, fontWeight: 700 }}
            >
              {mode === 'view'
                ? '👁 Görüntüle'
                : mode === 'manual'
                  ? '🔲 Silgi'
                  : mode === 'patch'
                    ? '✂ Patch'
                    : 'T Metin'}
            </span>
            <div style={{ width: 1, height: 14, background: T.border }} />
            <span style={{ fontSize: 11, color: T.muted }}>
              Sayfa {currentPage}/{numPages || '—'}
            </span>
            {cursorCoords && (
              <>
                <div style={{ width: 1, height: 14, background: T.border }} />
                <span style={{ fontSize: 11, color: T.muted }}>
                  x:{cursorCoords.x} y:{cursorCoords.y}
                </span>
              </>
            )}
            {file && (
              <>
                <div style={{ width: 1, height: 14, background: T.border }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <button
                    onClick={zoomOut}
                    title="Uzaklaştır (Ctrl+tekerlek)"
                    aria-label="Uzaklaştır"
                    style={zoomBtnStyle}
                  >
                    −
                  </button>
                  <button
                    onClick={zoomReset}
                    title="Sığdır / %100 (zoom'u sıfırla)"
                    aria-label="Zoom'u sıfırla"
                    style={{ ...zoomBtnStyle, width: 'auto', padding: '0 6px', minWidth: 44 }}
                  >
                    %{Math.round(viewZoom * 100)}
                  </button>
                  <button
                    onClick={zoomIn}
                    title="Yakınlaştır (Ctrl+tekerlek)"
                    aria-label="Yakınlaştır"
                    style={zoomBtnStyle}
                  >
                    +
                  </button>
                </div>
              </>
            )}
            <div style={{ flex: 1 }} />
            {file && <WorkflowBadge meta={currentPageWorkflow.statusMeta} compact />}
            {file && (
              <span style={{ fontSize: 11, color: T.muted }}>%{currentPageWorkflow.quality}</span>
            )}
            <span
              role="status"
              aria-live="polite"
              aria-busy={busy || renderBusy || bulkBusy || exportBusy}
              style={{ fontSize: 11, color: T.muted }}
            >
              {status}
            </span>
            {(busy || renderBusy) && <span style={{ fontSize: 11, color: T.warn }}>⟳</span>}
            <div style={{ width: 1, height: 14, background: T.border }} />
            <span style={{ fontSize: 11, color: T.muted }}>? = kısayollar</span>
          </div>
        </div>

        <div
          style={{
            width: PDF_RIGHT_PANEL_WIDTH,
            flexShrink: 0,
            borderLeft: `1px solid ${T.border}`,
            display: 'flex',
            flexDirection: 'column',
            background: '#ffffff',
            minHeight: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              borderBottom: `1px solid ${T.border}`,
              flexShrink: 0,
              background: T.shellSoft,
            }}
          >
            {[
              ['katmanlar', 'Katmanlar'],
              ['ozellikler', 'Özellikler'],
              ['entegre', 'Entegrasyon'],
              ['aktar', 'Dışa Aktar'],
            ].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setRightTab(id)}
                style={{
                  flex: 1,
                  height: 40,
                  border: 'none',
                  borderBottom: `2px solid ${rightTab === id ? T.accent : 'transparent'}`,
                  background: rightTab === id ? '#ffffff' : 'transparent',
                  color: rightTab === id ? T.accent : T.muted,
                  fontSize: 11,
                  fontWeight: rightTab === id ? 900 : 700,
                  cursor: 'pointer',
                  letterSpacing: rightTab === id ? 0.3 : 0,
                  transition: 'all .15s',
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {rightTab === 'katmanlar' && (
              <div>
                <div
                  style={{
                    padding: '10px 10px 8px',
                    borderBottom: `1px solid ${T.border}`,
                    display: 'grid',
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          color: T.muted,
                          letterSpacing: 0.3,
                        }}
                      >
                        Sayfa Akışı
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: T.text, marginTop: 3 }}>
                        Sayfa {currentPage}
                      </div>
                    </div>
                    <WorkflowBadge meta={currentPageWorkflow.statusMeta} compact />
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, minmax(0,1fr))',
                      gap: 6,
                    }}
                  >
                    {[
                      { label: 'Katman', value: currentPageWorkflow.counts.totalEdits },
                      { label: 'Otomatik', value: currentPageWorkflow.counts.autoMasks },
                      {
                        label: 'Hazır',
                        value: `${currentPageWorkflow.readyChecks}/${currentPageWorkflow.totalChecks}`,
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        style={{
                          padding: '8px 9px',
                          borderRadius: 10,
                          border: `1px solid ${T.border}`,
                          background: T.surfaceAlt,
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>
                          {item.value}
                        </div>
                        <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
                          {item.label}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {currentPageWorkflow.checks.map((check) => (
                      <span
                        key={check.label}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          padding: '4px 8px',
                          borderRadius: 999,
                          border: `1px solid ${check.ok ? '#bbf7d0' : '#fde68a'}`,
                          background: check.ok ? 'rgba(34,197,94,.10)' : '#fefce8',
                          color: check.ok ? '#16a34a' : '#d97706',
                          fontSize: 11,
                          fontWeight: 800,
                        }}
                      >
                        <span>{check.ok ? '✓' : '!'}</span>
                        {check.label}
                      </span>
                    ))}
                  </div>
                </div>
                <div
                  style={{
                    padding: '8px 10px',
                    borderBottom: `1px solid ${T.border}`,
                    display: 'flex',
                    gap: 5,
                  }}
                >
                  <button
                    onClick={() => {
                      setSelectedId(null);
                      setSelectedType(null);
                      setActiveMaskId(null);
                    }}
                    style={{ ...tbBtn(false, { small: true }), flex: 1, justifyContent: 'center' }}
                  >
                    Seçimi Kaldır
                  </button>
                  <button
                    onClick={resetCurrentPage}
                    disabled={!hasEdits}
                    style={{
                      ...tbBtn(false, { small: true, disabled: !hasEdits, danger: hasEdits }),
                      flex: 1,
                      justifyContent: 'center',
                    }}
                  >
                    🗑 Sayfayı Temizle
                  </button>
                </div>
                <div
                  style={{
                    padding: '0 10px 8px',
                    borderBottom: `1px solid ${T.border}`,
                    display: 'flex',
                    gap: 5,
                  }}
                >
                  <button
                    onClick={currentPageDeleted ? restoreCurrentPage : softDeleteCurrentPage}
                    disabled={!file}
                    style={{
                      ...tbBtn(false, {
                        small: true,
                        disabled: !file,
                        danger: !currentPageDeleted,
                      }),
                      flex: 1,
                      justifyContent: 'center',
                    }}
                  >
                    {currentPageDeleted ? 'Sayfayı Geri Al' : 'Sayfayı Sil'}
                  </button>
                </div>
                {renderLayers()}
              </div>
            )}
            {rightTab === 'ozellikler' && renderInspector()}
            {rightTab === 'entegre' && renderIntegrationPanel()}
            {rightTab === 'aktar' && renderExportPanel()}
          </div>
          {pageSummary && rightTab === 'katmanlar' && (
            <div
              style={{ flexShrink: 0, borderTop: `1px solid ${T.border}`, padding: '10px 12px' }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: T.muted,
                  letterSpacing: 0.3,
                  marginBottom: 5,
                }}
              >
                Sayfa Metni
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: T.muted,
                  lineHeight: 1.6,
                  maxHeight: 80,
                  overflow: 'hidden',
                }}
              >
                {pageSummary}
              </div>
            </div>
          )}
        </div>
      </div>

      {bulkBusy && numPages > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: 28,
            left: 0,
            right: 0,
            height: 3,
            background: '#e2e8f0',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${(bulkProgress / numPages) * 100}%`,
              background: T.accent,
              transition: 'width .2s',
            }}
          />
        </div>
      )}
    </div>
  );

  if (fullScreen) {
    return <div style={{ position: 'fixed', inset: 0, zIndex: 3000 }}>{studio}</div>;
  }
  return studio;
}
