import { clamp, pixelBox, normalizeBox, overlapArea, boxArea, sourceCleanupRect, getPatchSourceCleanupBox } from './geometry';
import { generateId } from '../../utils/id';

export function uid(prefix = 'item') {
  return generateId(prefix);
}

export function averageSampleColor(ctx, box, width, height) {
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

export function dominantRingColor(ctx, box, width, height) {
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

export function sampleBackgroundColor(ctx, box, width, height, mode = 'auto') {
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

export function buildTextGrid(entries, cols, rows, step) {
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

export function classifyCandidate(stats, enabledTypes) {
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

export function detectInteractiveElementsLocal(canvas, textEntries, config, samplingMode = 'auto') {
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

export function downloadBlob(blob, filename) {
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

export function canvasToBlob(canvas, type = 'image/png', quality = 0.92) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function smoothstep(edge0, edge1, value) {
  if (edge0 === edge1) return value < edge0 ? 0 : 1;
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function createFeatheredPatchAsset(sourceCanvas, sourceRect, feather = 14) {
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

export function getPatchRenderMetrics(patch, targetRect) {
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

export function drawWrappedText(ctx, element, width, height, scale = 1) {
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

export function isTickMask(mask) {
  return mask?.type === 'checkbox';
}

export function tickStrokeGeometry(rect) {
  return {
    x1: rect.x + rect.width * 0.2,
    y1: rect.y + rect.height * 0.56,
    x2: rect.x + rect.width * 0.42,
    y2: rect.y + rect.height * 0.8,
    x3: rect.x + rect.width * 0.82,
    y3: rect.y + rect.height * 0.22,
  };
}

export function drawMaskDecoration(ctx, mask, width, height) {
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

export function buildMaskSvg(mask, width, height) {
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

export async function composePageCanvas(baseCanvas, masks, patches, texts, scale = 1) {
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

export function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function resolveColorPickerValue(val, fallback = '#ffffff') {
  if (!val || val === 'transparent') return fallback;
  const m = String(val).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (m) {
    const hex = [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('');
    return `#${hex}`;
  }
  return val.startsWith('#') ? val : fallback;
}
