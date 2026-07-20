import { MIN_BOX_SIZE } from '../../constants/pdfCleanConstants';

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeBox(box) {
  const ymin = clamp(Math.min(box[0], box[2]), 0, 1000);
  const xmin = clamp(Math.min(box[1], box[3]), 0, 1000);
  const ymax = clamp(Math.max(box[0], box[2]), 0, 1000);
  const xmax = clamp(Math.max(box[1], box[3]), 0, 1000);
  return [ymin, xmin, ymax, xmax];
}

export function expandBox(box, padding) {
  const normalized = normalizeBox(box);
  return normalizeBox([
    normalized[0] - padding,
    normalized[1] - padding,
    normalized[2] + padding,
    normalized[3] + padding,
  ]);
}

export function shiftBoxClamped(box, dx, dy) {
  const w = Math.max(0, box[3] - box[1]);
  const h = Math.max(0, box[2] - box[0]);
  const x = clamp(box[1] + dx, 0, Math.max(0, 1000 - w));
  const y = clamp(box[0] + dy, 0, Math.max(0, 1000 - h));
  return [y, x, y + h, x + w];
}

export function enforceMinResize(box, handle, initial) {
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

export function applyAspectResize(initial, box, handle) {
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

export function boxWidth(box) {
  return Math.max(0, box[3] - box[1]);
}

export function boxHeight(box) {
  return Math.max(0, box[2] - box[0]);
}

export function boxArea(box) {
  return boxWidth(box) * boxHeight(box);
}

export function createSourceMaskBox(box) {
  const normalized = normalizeBox(box);
  const padding = clamp(Math.min(boxWidth(normalized), boxHeight(normalized)) * 0.22, 24, 90);
  return expandBox(normalized, padding);
}

export function getPatchSourceCleanupBox(patch) {
  // If an explicit cleanup box is provided, use it as-is.
  // This prevents unintended extra cleanup area for precise cut operations.
  if (patch?.sourceMaskBox) {
    return normalizeBox(patch.sourceMaskBox);
  }
  return createSourceMaskBox(patch.sourceBox || patch.targetBox);
}

export function boxesOverlap(a, b) {
  return !(a[3] <= b[1] || a[1] >= b[3] || a[2] <= b[0] || a[0] >= b[2]);
}

export function overlapArea(a, b) {
  if (!boxesOverlap(a, b)) return 0;
  const x = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  const y = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0]));
  return x * y;
}

export function pixelBox(box, width, height) {
  const normalized = normalizeBox(box);
  return {
    x: (normalized[1] / 1000) * width,
    y: (normalized[0] / 1000) * height,
    width: (boxWidth(normalized) / 1000) * width,
    height: (boxHeight(normalized) / 1000) * height,
  };
}

export function sourceCleanupRect(box, width, height, bleed = 1) {
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
