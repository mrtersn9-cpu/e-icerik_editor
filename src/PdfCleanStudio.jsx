import { PDFDocument } from 'pdf-lib';
import { useEffect, useMemo, useRef, useState } from 'react';

import { WORKFLOW_STATUS_META } from './constants';
import { EDITOR_THEME } from './theme';
import { getAssetUrl } from './utils/assetUrl';

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
  return JSON.parse(JSON.stringify(value));
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
  link.click();
  URL.revokeObjectURL(url);
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
  } catch {
    // no-op
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

function drawWrappedText(ctx, element, width, height) {
  const rect = pixelBox(element.box, width, height);
  const fontSize = Math.max(10, element.fontSize || 14);
  ctx.save();
  ctx.fillStyle = element.bgColor || 'rgb(255,255,255)';
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  ctx.fillStyle = element.color || '#000000';
  ctx.font = `${fontSize}px Arial, sans-serif`;
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

async function composePageCanvas(baseCanvas, masks, patches, texts) {
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
  (texts || []).forEach((element) => drawWrappedText(ctx, element, out.width, out.height));
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
  bg: EDITOR_THEME.shellBg,
  surface: EDITOR_THEME.shellPanel,
  surfaceAlt: EDITOR_THEME.shellPanelAlt,
  surfaceHover: EDITOR_THEME.shellPanelElevated,
  border: EDITOR_THEME.shellBorderSoft,
  borderHi: EDITOR_THEME.shellBorderStrong,
  text: EDITOR_THEME.shellText,
  muted: EDITOR_THEME.shellMuted,
  accent: EDITOR_THEME.shellAccent,
  accentBg: EDITOR_THEME.shellAccentSoft,
  accentBorder: EDITOR_THEME.shellAccentBorder,
  success: EDITOR_THEME.shellSuccess,
  warn: EDITOR_THEME.shellWarning,
  danger: EDITOR_THEME.shellDanger,
};

const WORKFLOW_PILL_STYLE = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 9px',
  borderRadius: 999,
  border: `1px solid ${T.border}`,
  background: 'rgba(255,255,255,.05)',
  color: T.text,
  fontSize: 11,
  fontWeight: 800,
  whiteSpace: 'nowrap',
};

function tbBtn(active = false, opts = {}) {
  return {
    height: opts.small ? 30 : 36,
    padding: opts.small ? '0 9px' : '0 13px',
    borderRadius: opts.small ? 6 : 8,
    border: active ? `1px solid ${T.accentBorder}` : `1px solid ${T.border}`,
    background: active ? T.accentBg : 'rgba(255,255,255,.04)',
    color: opts.danger ? T.danger : active ? T.accent : T.text,
    fontWeight: opts.small ? 600 : 700,
    fontSize: opts.small ? 10.5 : 11,
    cursor: opts.disabled ? 'default' : 'pointer',
    opacity: opts.disabled ? 0.4 : 1,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    whiteSpace: 'nowrap',
    flexShrink: 0,
    pointerEvents: opts.disabled ? 'none' : 'auto',
    transition: 'background .1s, border-color .1s',
  };
}

function iconTypeLabel(item) {
  if (item.text !== undefined) return { icon: 'T', color: '#a78bfa' };
  if (item.targetBox) return { icon: item.isClone ? '📋' : '✂', color: '#38bdf8' };
  if (item.type === 'checkbox') return { icon: '☑', color: '#4ade80' };
  if (item.type === 'draggable') return { icon: '⊞', color: '#fb923c' };
  if (item.type === 'answer') return { icon: 'A', color: '#facc15' };
  if (item.type === 'note') return { icon: '📝', color: '#a3e635' };
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
        textTransform: 'uppercase',
        letterSpacing: 1.6,
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
}) {
  // ── Core state
  const [file, setFile] = useState(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pdfjsLib, setPdfjsLib] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [thumbnails, setThumbnails] = useState([]);
  const [pageViewport, setPageViewport] = useState({ width: 1, height: 1 });
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

  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const surfaceRef = useRef(null);
  const renderTaskRef = useRef(null);

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

  const currentSelection = useMemo(() => {
    if (selectedType === 'patch') return pagePatches.find((i) => i.id === selectedId) || null;
    if (selectedType === 'text') return pageTexts.find((i) => i.id === selectedId) || null;
    if (selectedType === 'mask') return masks.find((i) => i.id === activeMaskId) || null;
    return null;
  }, [pagePatches, pageTexts, masks, selectedId, selectedType, activeMaskId]);

  // ── History helpers
  const resetHistory = (m = {}, p = {}, t = {}) =>
    setHistoryState({
      stack: [{ masks: deepClone(m), patches: deepClone(p), texts: deepClone(t) }],
      index: 0,
    });

  const pushHistory = (m, p, t) => {
    const snap = { masks: deepClone(m), patches: deepClone(p), texts: deepClone(t) };
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

  const undo = () => {
    if (historyIndex > 0) {
      applySnapshot(history[historyIndex - 1]);
      setHistoryState((prev) => ({ ...prev, index: Math.max(0, prev.index - 1) }));
    }
  };
  const redo = () => {
    if (historyIndex < history.length - 1) {
      applySnapshot(history[historyIndex + 1]);
      setHistoryState((prev) => ({
        ...prev,
        index: Math.min(prev.stack.length - 1, prev.index + 1),
      }));
    }
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
  const finishTextEdit = (id) => {
    const nextTexts = deepClone(textElements);
    setTextElements(nextTexts);
    setEditingTextId(null);
    pushHistory(pageMasks, patches, nextTexts);
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

  const bringToFront = (id, type) => {
    if (type === 'patch') {
      const items = [...(patches[currentPage] || [])];
      const maxZ = items.length ? Math.max(...items.map((i) => i.zIndex || 0)) : 0;
      const idx = items.findIndex((i) => i.id === id);
      if (idx === -1) return;
      items[idx] = { ...items[idx], zIndex: maxZ + 1 };
      setPatches({ ...patches, [currentPage]: items });
    } else if (type === 'text') {
      const items = [...(textElements[currentPage] || [])];
      const maxZ = items.length ? Math.max(...items.map((i) => i.zIndex || 0)) : 0;
      const idx = items.findIndex((i) => i.id === id);
      if (idx === -1) return;
      items[idx] = { ...items[idx], zIndex: maxZ + 1 };
      setTextElements({ ...textElements, [currentPage]: items });
    }
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
      color: '#000000',
      bgColor: patch.bgColor || 'rgb(255,255,255)',
      zIndex: pageTexts.length ? Math.max(...pageTexts.map((i) => i.zIndex || 0)) + 1 : 1,
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
    const SNAP = 8;
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
  const renderPageRaster = async (pageNumber, scale = 1.6) => {
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
      const rendered = await renderPageRaster(currentPage, 1.6);
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
        const rendered = await renderPageRaster(p, 1.6);
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
  const buildPageSvgString = async (pageNumber) => {
    if (!pdfDoc) return null;
    const page = await pdfDoc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 2 });
    const tc = document.createElement('canvas');
    tc.width = Math.round(viewport.width);
    tc.height = Math.round(viewport.height);
    const ctx = tc.getContext('2d', { alpha: false });
    if (!ctx) return null;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, tc.width, tc.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    const parts = [
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${tc.width}" height="${tc.height}" viewBox="0 0 ${tc.width} ${tc.height}">`,
      `<image x="0" y="0" width="${tc.width}" height="${tc.height}" xlink:href="${tc.toDataURL('image/png')}" />`,
    ];
    (pageMasks[pageNumber] || []).forEach((mask) => {
      const fill = sampleBackgroundColor(ctx, mask.box, tc.width, tc.height, samplingMode);
      parts.push(buildMaskSvg({ ...mask, bgColor: fill }, tc.width, tc.height));
    });
    (patches[pageNumber] || []).forEach((patch) => {
      if (!patch.isClone) {
        const src = sourceCleanupRect(getPatchSourceCleanupBox(patch), tc.width, tc.height, 2);
        parts.push(
          `<rect x="${src.x}" y="${src.y}" width="${src.width}" height="${src.height}" fill="${escapeXml(patch.bgColor || '#fff')}" />`
        );
      }
      const tgt = pixelBox(patch.targetBox, tc.width, tc.height);
      const m = getPatchRenderMetrics(patch, tgt);
      parts.push(
        `<image x="${m.centerX - m.drawWidth / 2}" y="${m.centerY - m.drawHeight / 2}" width="${m.drawWidth}" height="${m.drawHeight}" xlink:href="${patch.imageData}" transform="rotate(${patch.rotation || 0} ${m.centerX} ${m.centerY})" style="filter:brightness(${patch.brightness || 100}%) contrast(${patch.contrast || 100}%);" />`
      );
    });
    (textElements[pageNumber] || []).forEach((el) => {
      const r = pixelBox(el.box, tc.width, tc.height);
      parts.push(
        `<rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" fill="${escapeXml(el.bgColor || '#fff')}" />`
      );
      parts.push(
        `<text x="${r.x + r.width / 2}" y="${r.y + r.height / 2}" fill="${escapeXml(el.color || '#000')}" font-size="${el.fontSize || 16}" text-anchor="middle" dominant-baseline="middle">${escapeXml(el.text || '')}</text>`
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
    const svg = await buildPageSvgString(currentPage);
    if (!svg) return;
    downloadBlob(
      new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }),
      `${file.name.replace(/\.pdf$/i, '')}-s${currentPage}.svg`
    );
    setStatus(`Sayfa ${currentPage} SVG olarak indirildi.`);
  };
  const exportCurrentPagePng = async () => {
    if (!pdfDoc || !file) return;
    setExportBusy(true);
    setStatus('PNG hazırlanıyor...');
    try {
      const rendered = await renderPageRaster(currentPage, 2.6);
      if (!rendered) return;
      const composed = await composePageCanvas(rendered.canvas, masks, pagePatches, pageTexts);
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
      const rendered = await renderPageRaster(currentPage, 2.4);
      if (!rendered) return;
      const composed = await composePageCanvas(rendered.canvas, masks, pagePatches, pageTexts);
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
        const rendered = await renderPageRaster(p, 2.4);
        if (!rendered) continue;
        const composed = await composePageCanvas(
          rendered.canvas,
          pageMasks[p] || [],
          patches[p] || [],
          textElements[p] || []
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

  // ── Effects
  useEffect(() => {
    const node = containerRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const measure = () =>
      setStageSize({
        width: Math.max(0, Math.floor(node.clientWidth || 0)),
        height: Math.max(0, Math.floor(node.clientHeight || 0)),
      });
    measure();
    const obs = new ResizeObserver(measure);
    obs.observe(node);
    return () => obs.disconnect();
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
          const page = await pdfDoc.getPage(p);
          const vp = page.getViewport({ scale: 0.22 });
          const tc = document.createElement('canvas');
          tc.width = Math.max(1, Math.round(vp.width));
          tc.height = Math.max(1, Math.round(vp.height));
          const ctx = tc.getContext('2d', { alpha: false });
          if (!ctx) continue;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, tc.width, tc.height);
          await page.render({ canvasContext: ctx, viewport: vp }).promise;
          items.push({ pageNumber: p, url: tc.toDataURL('image/jpeg', 0.72) });
        }
        if (!cancelled) setThumbnails(items);
      } catch {
        if (!cancelled) setThumbnails([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pdfDoc]);

  useEffect(() => {
    if (!pdfDoc || !pdfjsLib) return;
    let cancelled = false;
    (async () => {
      setBusy(true);
      try {
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch {}
        }
        const page = await pdfDoc.getPage(currentPage);
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container || cancelled) return;
        const wb = Math.max(360, stageSize.width || container.clientWidth || 360);
        const hb = Math.max(360, stageSize.height || container.clientHeight || 360);
        const bvp = page.getViewport({ scale: 1 });
        const scale = clamp(
          Math.min((wb - 80) / Math.max(1, bvp.width), (hb - 80) / Math.max(1, bvp.height)),
          0.4,
          2.6
        );
        const vp = page.getViewport({ scale });
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;
        canvas.width = Math.round(vp.width);
        canvas.height = Math.round(vp.height);
        canvas.style.width = `${Math.round(vp.width)}px`;
        canvas.style.height = `${Math.round(vp.height)}px`;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const task = page.render({ canvasContext: ctx, viewport: vp });
        renderTaskRef.current = task;
        await task.promise;
        renderTaskRef.current = null;
        if (cancelled) return;
        const entries = await extractTextEntries(page, vp, pdfjsLib);
        if (cancelled) return;
        setPageViewport({ width: canvas.width, height: canvas.height });
        setPageTextEntries((prev) => ({ ...prev, [currentPage]: entries }));
        setPageSummary(summarizePageText(entries));
      } catch (err) {
        if (!cancelled) setStatus(err?.message || 'Sayfa yüklenemedi.');
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pdfDoc, pdfjsLib, currentPage, stageSize.width, stageSize.height]);

  // ── Pointer events
  useEffect(() => {
    const handleMove = (e) => {
      const pt = getNormalizedPoint(e.clientX, e.clientY);
      if (pt) setCursorCoords({ x: Math.round(pt.x), y: Math.round(pt.y) });

      if (drawState) setDraftRect(normalizeBox([drawState.startY, drawState.startX, pt.y, pt.x]));

      if (draggingElement) {
        const dx = pt.x - draggingElement.startX,
          dy = pt.y - draggingElement.startY;
        const ib = draggingElement.initialBox;
        const nb = normalizeBox([ib[0] + dy, ib[1] + dx, ib[2] + dy, ib[3] + dx]);
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
            color: '#000000',
            bgColor,
            zIndex: (pageTexts.length || 0) + 10,
          };
          const nextTexts = {
            ...textElements,
            [currentPage]: [...(textElements[currentPage] || []), nt],
          };
          setTextElements(nextTexts);
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
                textElements[currentPage] || []
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
                  zIndex: pagePatches.length
                    ? Math.max(...pagePatches.map((i) => i.zIndex || 0)) + 1
                    : 1,
                  isClone: patchToolMode === 'clone',
                };
                const nextPatches = {
                  ...patches,
                  [currentPage]: [...(patches[currentPage] || []), np],
                };
                setPatches(nextPatches);
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

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Pointer drag handlers keep the in-flight gesture snapshot; applySnap changes would restart active drags.
  }, [
    currentPage,
    draftRect,
    drawState,
    draggingElement,
    dragGhost,
    mode,
    pageMasks,
    patches,
    textElements,
    pdfDoc,
    pagePatches,
    pageTexts.length,
    patchToolMode,
    resizing,
    samplingMode,
  ]);

  // ── Keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && currentSelection) {
        e.preventDefault();
        setCopiedItem({ type: selectedType, data: deepClone(currentSelection) });
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v' && copiedItem) {
        e.preventDefault();
        if (copiedItem.type === 'patch') {
          const copied = {
            ...copiedItem.data,
            id: uid('patch'),
            targetBox: normalizeBox([
              copiedItem.data.targetBox[0] + 18,
              copiedItem.data.targetBox[1] + 18,
              copiedItem.data.targetBox[2] + 18,
              copiedItem.data.targetBox[3] + 18,
            ]),
          };
          const np = { ...patches, [currentPage]: [...(patches[currentPage] || []), copied] };
          setPatches(np);
          setSelectedId(copied.id);
          setSelectedType('patch');
          pushHistory(pageMasks, np, textElements);
        } else if (copiedItem.type === 'text') {
          const copied = {
            ...copiedItem.data,
            id: uid('text'),
            box: normalizeBox([
              copiedItem.data.box[0] + 18,
              copiedItem.data.box[1] + 18,
              copiedItem.data.box[2] + 18,
              copiedItem.data.box[3] + 18,
            ]),
          };
          const nt = {
            ...textElements,
            [currentPage]: [...(textElements[currentPage] || []), copied],
          };
          setTextElements(nt);
          setSelectedId(copied.id);
          setSelectedType('text');
          pushHistory(pageMasks, patches, nt);
        }
        return;
      }
      if (e.key === '?' && !editingTextId) {
        setShowKeyHelp((v) => !v);
        return;
      }
      if (e.key === 'Escape') {
        setMode('view');
        setSelectedId(null);
        setSelectedType(null);
        setActiveMaskId(null);
        return;
      }
      if (e.key === 'v' && !editingTextId) {
        setMode('view');
        return;
      }
      if (e.key === 'e' && !editingTextId) {
        setMode('manual');
        return;
      }
      if (e.key === 'p' && !editingTextId) {
        setMode('patch');
        return;
      }
      if (e.key === 't' && !editingTextId) {
        setMode('text');
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && !editingTextId) {
        if (selectedType === 'patch' && selectedId) removePatch(selectedId);
        else if (selectedType === 'text' && selectedId) removeText(selectedId);
        else if (activeMaskId) removeMask(activeMaskId);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Keyboard shortcuts intentionally bind to the current selection/page snapshot without rebinding every command helper.
  }, [
    activeMaskId,
    copiedItem,
    currentPage,
    currentSelection,
    editingTextId,
    history,
    historyIndex,
    pageMasks,
    patches,
    selectedId,
    selectedType,
    textElements,
  ]);

  const handleSurfacePointerDown = (e) => {
    if (!canvasRef.current) return;
    if (e.target !== surfaceRef.current) return;
    if (mode === 'view') {
      setSelectedId(null);
      setSelectedType(null);
      setActiveMaskId(null);
      return;
    }
    const pt = getNormalizedPoint(e.clientX, e.clientY);
    if (!pt) return;
    e.preventDefault();
    setSelectedId(null);
    setSelectedType(null);
    setActiveMaskId(null);
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
                    background: 'rgba(255,255,255,.08)',
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
                height: 24,
                border: `1px solid ${T.borderHi}`,
                borderRadius: 5,
                background: 'rgba(255,255,255,.06)',
                color: T.text,
                fontSize: 11,
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
                width: 32,
                height: 24,
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
                height: 24,
                border: `1px solid ${T.borderHi}`,
                borderRadius: 5,
                background: 'rgba(255,255,255,.06)',
                color: T.text,
                fontSize: 11,
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
              background: 'rgba(56,189,248,.08)',
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
                background: 'rgba(255,255,255,.06)',
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
                width: 60,
                height: 24,
                border: `1px solid ${T.borderHi}`,
                borderRadius: 5,
                background: 'rgba(255,255,255,.06)',
                color: T.text,
                fontSize: 11,
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
          <PropRow label="Yazı rengi">
            <input
              type="color"
              value={el.color || '#000000'}
              onChange={(e) => updateText(el.id, (t) => ({ ...t, color: e.target.value }))}
              style={{
                width: 32,
                height: 24,
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
                width: 32,
                height: 24,
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
          disabled={!file || exportBusy}
          style={{
            ...tbBtn(false, { small: true, disabled: !file || exportBusy }),
            justifyContent: 'center',
          }}
        >
          📄 SVG İndir — Sayfa {currentPage}
        </button>
        <button
          onClick={exportCurrentPagePng}
          disabled={!file || exportBusy}
          style={{
            ...tbBtn(false, { small: true, disabled: !file || exportBusy }),
            justifyContent: 'center',
          }}
        >
          🖼 PNG İndir — Sayfa {currentPage}
        </button>
        <button
          onClick={exportCurrentPageJpeg}
          disabled={!file || exportBusy}
          style={{
            ...tbBtn(false, { small: true, disabled: !file || exportBusy }),
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
          disabled={!file || bulkBusy}
          style={{
            ...tbBtn(false, { small: true, disabled: !file || bulkBusy }),
            justifyContent: 'center',
          }}
        >
          {bulkBusy ? '⏳ PDF hazırlanıyor...' : '📑 Temizlenmiş PDF İndir'}
        </button>
        <button
          onClick={exportAllSvg}
          disabled={!file || exportBusy}
          style={{
            ...tbBtn(false, { small: true, disabled: !file || exportBusy }),
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

  // ── Main canvas area
  const renderCanvas = () => (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        background: 'radial-gradient(ellipse at center, #0d1a2f 0%, #07101c 100%)',
        overflow: 'auto',
        padding: 24,
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
            borderRadius: 12,
            boxShadow: '0 32px 64px rgba(0,0,0,.54)',
            overflow: 'hidden',
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
              cursor: mode === 'view' ? 'default' : 'crosshair',
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
                  background: 'rgba(56,189,248,.5)',
                  zIndex: 100,
                  pointerEvents: 'none',
                }}
              />
            ))}
            {masks
              .filter((m) => layerVisibility[m.id] !== false)
              .map((mask) => {
                const box = pixelBox(mask.box, pageViewport.width, pageViewport.height);
                return (
                  <div
                    key={mask.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMaskId(mask.id);
                      setSelectedId(null);
                      setSelectedType(null);
                      setRightTab('ozellikler');
                    }}
                    style={{
                      position: 'absolute',
                      left: box.x,
                      top: box.y,
                      width: box.width,
                      height: box.height,
                      background: mask.bgColor || '#ffffff',
                      outline: 'none',
                      boxShadow: 'none',
                      cursor: 'pointer',
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
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        const pt = getNormalizedPoint(e.clientX, e.clientY);
                        if (!pt) return;
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
                        cursor: 'move',
                        outline: active ? '2px solid rgba(56,189,248,.78)' : 'none',
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
                const editing = editingTextId === el.id;
                return (
                  <div
                    key={el.id}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      const pt = getNormalizedPoint(e.clientX, e.clientY);
                      if (!pt || editing) return;
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
                      fontSize: el.fontSize || 16,
                      textAlign: el.textAlign || 'center',
                      cursor: editing ? 'text' : 'move',
                      zIndex: (el.zIndex || 0) + 50,
                      outline: active
                        ? '2px solid rgba(56,189,248,.7)'
                        : '1px solid rgba(255,255,255,.5)',
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
                        value={el.text}
                        onChange={(e) => updateTextValue(el.id, e.target.value)}
                        onBlur={() => finishTextEdit(el.id)}
                        style={{
                          width: '100%',
                          height: '100%',
                          border: 0,
                          outline: 0,
                          resize: 'none',
                          background: 'transparent',
                          color: el.color || '#000',
                          fontSize: el.fontSize || 16,
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
                  background: mode === 'patch' ? 'rgba(56,189,248,.12)' : 'rgba(125,211,252,.12)',
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
      <div style={{ display: 'grid', gap: 5, padding: 10 }}>
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
                gap: 6,
                padding: '7px 10px',
                borderRadius: 8,
                border: active ? `1px solid ${T.accentBorder}` : `1px solid ${T.border}`,
                background: active ? T.accentBg : T.surfaceAlt,
                opacity: vis ? 1 : 0.45,
              }}
            >
              <span style={{ fontSize: 13, color, minWidth: 18, textAlign: 'center' }}>{icon}</span>
              <button
                onClick={() => selectItem(item)}
                style={{
                  flex: 1,
                  background: 'none',
                  border: 'none',
                  color: T.text,
                  fontSize: 11,
                  fontWeight: active ? 700 : 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  padding: 0,
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
                  background: 'none',
                  border: 'none',
                  color: vis ? T.muted : T.border,
                  cursor: 'pointer',
                  fontSize: 12,
                  padding: '0 3px',
                }}
                title="Görünürlük"
              >
                👁
              </button>
              <button
                onClick={() => deleteItem(item)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: T.danger,
                  cursor: 'pointer',
                  fontSize: 12,
                  padding: '0 3px',
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
        background: 'rgba(0,0,0,.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={() => setShowKeyHelp(false)}
    >
      <div
        style={{
          background: '#0f1d34',
          border: `1px solid ${T.borderHi}`,
          borderRadius: 20,
          padding: 28,
          minWidth: 340,
          boxShadow: '0 24px 64px rgba(0,0,0,.6)',
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
            ['Ctrl+Y', 'İleri al'],
            ['Ctrl+C', 'Kopyala'],
            ['Ctrl+V', 'Yapıştır'],
            ['Delete', 'Seçili öğeyi sil'],
            ['Esc', 'Seçimi kaldır'],
            ['?', 'Bu yardımı kapat'],
          ].map(([k, d]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <kbd
                style={{
                  background: 'rgba(255,255,255,.08)',
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
            background: 'rgba(255,255,255,.06)',
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
            background: 'rgba(56,189,248,.18)',
            border: '3px dashed rgba(56,189,248,.6)',
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
          height: 48,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          padding: '0 14px',
          borderBottom: `1px solid ${T.border}`,
          background: 'linear-gradient(180deg,rgba(13,21,37,.97),rgba(8,14,28,.99))',
          gap: 12,
          boxShadow: '0 1px 6px rgba(0,0,0,.3)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: 'linear-gradient(135deg,#1565c0,#38bdf8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              fontWeight: 900,
              color: '#fff',
              boxShadow: '0 2px 8px rgba(56,189,248,.25)',
            }}
          >
            P
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: T.text, lineHeight: 1 }}>
              PDF Düzenleme Stüdyosu
            </div>
            <div style={{ fontSize: 11, color: T.muted, letterSpacing: 0.4 }}>E-İçerik Editörü</div>
          </div>
        </div>
        <div style={{ width: 1, height: 28, background: T.border, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          {file ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: T.accent,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                📄 {file.name}
              </span>
              <span style={{ fontSize: 11, color: T.muted, whiteSpace: 'nowrap' }}>
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
          height: 42,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          padding: '0 10px',
          borderBottom: `1px solid ${T.border}`,
          background: 'linear-gradient(180deg, rgba(8,14,28,.94), rgba(7,12,22,.97))',
          gap: 4,
          overflowX: 'auto',
          boxShadow: '0 1px 4px rgba(0,0,0,.15)',
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
            disabled={!file || busy || bulkBusy}
            style={tbBtn(false, { disabled: !file || busy || bulkBusy })}
          >
            {busy ? '⟳ Taranıyor...' : '⚡ Bu Sayfa'}
          </button>
          <button
            onClick={runAutoCleanAllPages}
            disabled={!file || busy || bulkBusy}
            style={tbBtn(false, { disabled: !file || busy || bulkBusy })}
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
            disabled={!file || exportBusy}
            style={tbBtn(false, { small: true, disabled: !file || exportBusy })}
          >
            PNG
          </button>
          <button
            onClick={exportCurrentPageSvg}
            disabled={!file || exportBusy}
            style={tbBtn(false, { small: true, disabled: !file || exportBusy })}
          >
            SVG
          </button>
          <button
            onClick={exportCleanedPdf}
            disabled={!file || bulkBusy}
            style={tbBtn(false, { small: true, disabled: !file || bulkBusy })}
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
                  background: 'rgba(255,255,255,.07)',
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

      {file && (
        <div
          style={{
            flexShrink: 0,
            padding: '8px 12px',
            borderBottom: `1px solid ${T.border}`,
            background: 'linear-gradient(180deg, rgba(9,16,30,.92), rgba(7,12,22,.96))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              minWidth: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
              flex: '1 1 280px',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 900,
                  color: T.accent,
                  textTransform: 'uppercase',
                  letterSpacing: 1.1,
                }}
              >
                Workflow
              </div>
              <div style={{ fontSize: 12, fontWeight: 800, color: T.text, marginTop: 2 }}>
                Belge hazırlık özeti
              </div>
            </div>
            <WorkflowBadge meta={documentWorkflow.statusMeta} />
            <WorkflowBadge
              meta={currentPageWorkflow.statusMeta}
              compact
              label={`Sayfa ${currentPage}`}
            />
            <span style={WORKFLOW_PILL_STYLE}>Ort. kalite %{documentWorkflow.averageQuality}</span>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 6,
              flexWrap: 'wrap',
              flex: '999 1 420px',
            }}
          >
            <span style={WORKFLOW_PILL_STYLE}>{documentWorkflow.readyPages} hazır</span>
            {documentWorkflow.reviewPages > 0 && (
              <span style={WORKFLOW_PILL_STYLE}>{documentWorkflow.reviewPages} kontrol</span>
            )}
            {documentWorkflow.draftPages > 0 && (
              <span style={WORKFLOW_PILL_STYLE}>{documentWorkflow.draftPages} taslak</span>
            )}
            <span style={WORKFLOW_PILL_STYLE}>{documentWorkflow.totalEdits} düzenleme</span>
          </div>
        </div>
      )}

      {/* ── Settings Panel ── */}
      {showSettings && (
        <div
          style={{
            flexShrink: 0,
            borderBottom: `1px solid ${T.border}`,
            background: 'rgba(8,14,28,.92)',
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
            width: isSidebarOpen ? 168 : 0,
            flexShrink: 0,
            overflow: 'hidden',
            borderRight: isSidebarOpen ? `1px solid ${T.border}` : 'none',
            background: 'linear-gradient(180deg, rgba(8,14,28,.95), rgba(6,10,20,.98))',
            transition: 'width .22s cubic-bezier(.4,0,.2,1)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              padding: '10px 12px 8px',
              borderBottom: `1px solid ${T.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: T.muted,
                textTransform: 'uppercase',
                letterSpacing: 1.2,
              }}
            >
              SAYFALAR ({numPages || 0})
            </span>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {documentWorkflow.readyPages > 0 && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: T.success,
                    background: 'rgba(74,222,128,.12)',
                    border: '1px solid rgba(74,222,128,.2)',
                    borderRadius: 9,
                    padding: '2px 6px',
                  }}
                >
                  {documentWorkflow.readyPages}/{documentWorkflow.pageCount || numPages} hazır
                </span>
              )}
              {documentWorkflow.reviewPages > 0 && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: T.warn,
                    background: 'rgba(251,191,36,.12)',
                    border: '1px solid rgba(251,191,36,.2)',
                    borderRadius: 9,
                    padding: '2px 6px',
                  }}
                >
                  {documentWorkflow.reviewPages} kontrol
                </span>
              )}
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '6px 8px 10px' }}>
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
                    border: active ? `2px solid ${T.accent}` : `1px solid ${statusMeta.border}`,
                    borderRadius: 10,
                    background: active ? 'rgba(56,189,248,.1)' : 'rgba(255,255,255,.02)',
                    padding: 5,
                    cursor: 'pointer',
                    textAlign: 'left',
                    marginBottom: 6,
                    display: 'block',
                    transition: 'border-color .15s, background .15s',
                    boxShadow: active ? '0 10px 18px rgba(14,165,233,.12)' : 'none',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      inset: '0 auto 0 0',
                      width: 3,
                      borderRadius: '10px 0 0 10px',
                      background: statusMeta.color,
                    }}
                  />
                  <div
                    style={{
                      borderRadius: 5,
                      overflow: 'hidden',
                      aspectRatio: '3/4',
                      background: '#020617',
                      position: 'relative',
                    }}
                  >
                    <img
                      src={thumb.url}
                      alt={`Sayfa ${thumb.pageNumber}`}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                      }}
                    />
                    {active && (
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          border: '2px solid rgba(56,189,248,.5)',
                          borderRadius: 5,
                          pointerEvents: 'none',
                        }}
                      />
                    )}
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 4,
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
                      marginTop: 4,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 4,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        color: T.text,
                        background: 'rgba(255,255,255,.05)',
                        border: `1px solid ${T.border}`,
                        borderRadius: 999,
                        padding: '2px 6px',
                        lineHeight: 1,
                      }}
                    >
                      %{pageWorkflow.quality}
                    </span>
                    <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                      {maskCount > 0 && (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            background: 'rgba(74,222,128,.15)',
                            color: '#4ade80',
                            borderRadius: 3,
                            padding: '1px 3px',
                            lineHeight: 1,
                          }}
                          title={`${maskCount} silgi`}
                        >
                          E
                        </span>
                      )}
                      {patchCount > 0 && (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            background: 'rgba(56,189,248,.15)',
                            color: '#38bdf8',
                            borderRadius: 3,
                            padding: '1px 3px',
                            lineHeight: 1,
                          }}
                          title={`${patchCount} patch`}
                        >
                          P
                        </span>
                      )}
                      {textCount > 0 && (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            background: 'rgba(167,139,250,.15)',
                            color: '#a78bfa',
                            borderRadius: 3,
                            padding: '1px 3px',
                            lineHeight: 1,
                          }}
                          title={`${textCount} metin`}
                        >
                          T
                        </span>
                      )}
                    </div>
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
            left: isSidebarOpen ? 168 : 0,
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 40,
            width: 18,
            height: 52,
            border: `1px solid ${T.border}`,
            borderLeft: 'none',
            borderRadius: '0 8px 8px 0',
            background: 'linear-gradient(180deg, rgba(13,21,37,.95), rgba(8,14,28,.98))',
            color: T.muted,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 700,
            transition: 'left .22s cubic-bezier(.4,0,.2,1)',
            boxShadow: '2px 0 8px rgba(0,0,0,.3)',
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
              background: 'linear-gradient(180deg, rgba(8,14,28,.9), rgba(6,10,20,.95))',
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
            <div style={{ flex: 1 }} />
            {file && <WorkflowBadge meta={currentPageWorkflow.statusMeta} compact />}
            {file && (
              <span style={{ fontSize: 11, color: T.muted }}>%{currentPageWorkflow.quality}</span>
            )}
            <span style={{ fontSize: 11, color: T.muted }}>{status}</span>
            {busy && <span style={{ fontSize: 11, color: T.warn }}>⟳</span>}
            <div style={{ width: 1, height: 14, background: T.border }} />
            <span style={{ fontSize: 11, color: T.muted }}>? = kısayollar</span>
          </div>
        </div>

        <div
          style={{
            width: 280,
            flexShrink: 0,
            borderLeft: `1px solid ${T.border}`,
            display: 'flex',
            flexDirection: 'column',
            background: 'linear-gradient(180deg, rgba(8,14,28,.96), rgba(7,12,22,.98))',
            minHeight: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              borderBottom: `1px solid ${T.border}`,
              flexShrink: 0,
              background: 'rgba(0,0,0,.15)',
            }}
          >
            {[
              ['katmanlar', 'Katmanlar'],
              ['ozellikler', 'Özellikler'],
              ['aktar', 'Dışa Aktar'],
            ].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setRightTab(id)}
                style={{
                  flex: 1,
                  height: 38,
                  border: 'none',
                  borderBottom: `2px solid ${rightTab === id ? T.accent : 'transparent'}`,
                  background: rightTab === id ? T.accentBg : 'transparent',
                  color: rightTab === id ? T.accent : T.muted,
                  fontSize: 11,
                  fontWeight: rightTab === id ? 800 : 600,
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
                          textTransform: 'uppercase',
                          letterSpacing: 1.1,
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
                          border: `1px solid ${check.ok ? 'rgba(74,222,128,.24)' : 'rgba(251,191,36,.24)'}`,
                          background: check.ok ? 'rgba(34,197,94,.10)' : 'rgba(251,191,36,.10)',
                          color: check.ok ? '#86efac' : '#fde68a',
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
                {renderLayers()}
              </div>
            )}
            {rightTab === 'ozellikler' && renderInspector()}
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
                  textTransform: 'uppercase',
                  letterSpacing: 1.2,
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
            background: 'rgba(255,255,255,.08)',
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
