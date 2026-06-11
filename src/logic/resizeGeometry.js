// Sahne ögesi boyutlandırma geometrisi — saf fonksiyonlar (unit test edilebilir).
// StageCanvas'taki resize etkileşimi bu modülü kullanır:
// - Shift: en-boy oranını koru (orantılı boyutlandırma)
// - Alt: merkez sabit simetrik boyutlandırma (tutulan kenar + karşı kenar birlikte)
// - Çoklu seçim: birincil ögenin ölçek faktörü tüm seçime ankraj üzerinden uygulanır

// Tek ögenin yeni dikdörtgenini hesaplar. start: {x,y,width,height},
// handle: 'n'|'s'|'e'|'w'|'ne'|'nw'|'se'|'sw', dx/dy: sahne koordinatında fare deltası.
export function computeResizeRect(start = {}, handle = '', dx = 0, dy = 0, options = {}) {
  const { shift = false, alt = false, min = 30 } = options;
  const sx = Number(start.x) || 0;
  const sy = Number(start.y) || 0;
  const sw = Math.max(1, Number(start.width) || 1);
  const sh = Math.max(1, Number(start.height) || 1);
  const right = sx + sw;
  const bottom = sy + sh;
  const aspect = sh > 0 ? sw / sh : 1;

  if (alt) {
    // Merkez sabit: kenar deltası iki yana eşit uygulanır, merkez yerinde kalır.
    const cx = sx + sw / 2;
    const cy = sy + sh / 2;
    let width = sw;
    let height = sh;
    if (handle.includes('e')) width = sw + 2 * dx;
    if (handle.includes('w')) width = sw - 2 * dx;
    if (handle.includes('s')) height = sh + 2 * dy;
    if (handle.includes('n')) height = sh - 2 * dy;
    width = Math.max(min, width);
    height = Math.max(min, height);
    if (shift) {
      const dw = Math.abs(width - sw);
      const dh = Math.abs(height - sh);
      if (dw >= dh) height = Math.max(min, Math.round(width / aspect));
      else width = Math.max(min, Math.round(height * aspect));
    }
    return { x: cx - width / 2, y: cy - height / 2, width, height };
  }

  const next = { x: sx, y: sy, width: sw, height: sh };
  if (handle.includes('e')) next.width = Math.max(min, sw + dx);
  if (handle.includes('s')) next.height = Math.max(min, sh + dy);
  if (handle.includes('w')) {
    next.x = Math.max(0, Math.min(sx + dx, right - min));
    next.width = Math.max(min, right - next.x);
  }
  if (handle.includes('n')) {
    next.y = Math.max(0, Math.min(sy + dy, bottom - min));
    next.height = Math.max(min, bottom - next.y);
  }
  if (shift) {
    // En-boy oranını koru: baskın eksen değişimi diğerine yansıtılır,
    // sabit kenar (resize ankrajı) korunur.
    const dw = Math.abs(next.width - sw);
    const dh = Math.abs(next.height - sh);
    if (dw >= dh) next.height = Math.max(min, Math.round(next.width / aspect));
    else next.width = Math.max(min, Math.round(next.height * aspect));
    next.x = handle.includes('w') ? right - next.width : sx;
    next.y = handle.includes('n') ? bottom - next.height : sy;
  }
  return next;
}

// Snapshot'taki ({id: rect}) tüm dikdörtgenlerin ortak sınır kutusu.
export function getSnapshotBounds(snapshot = {}) {
  const rects = Object.values(snapshot);
  if (!rects.length) return null;
  const left = Math.min(...rects.map((rect) => Number(rect.x) || 0));
  const top = Math.min(...rects.map((rect) => Number(rect.y) || 0));
  const right = Math.max(
    ...rects.map((rect) => (Number(rect.x) || 0) + (Number(rect.width) || 0))
  );
  const bottom = Math.max(
    ...rects.map((rect) => (Number(rect.y) || 0) + (Number(rect.height) || 0))
  );
  return { left, top, right, bottom };
}

// Çoklu seçim ölçeklemesinin sabit noktası: tutamacın karşı kenarı/köşesi;
// Alt modunda seçim merkezi.
export function getResizeAnchor(bounds, handle = '', alt = false) {
  if (!bounds) return { x: 0, y: 0 };
  if (alt) {
    return { x: (bounds.left + bounds.right) / 2, y: (bounds.top + bounds.bottom) / 2 };
  }
  return {
    x: handle.includes('w') ? bounds.right : bounds.left,
    y: handle.includes('n') ? bounds.bottom : bounds.top,
  };
}

// Ölçek faktörünü ankraj etrafında snapshot'taki TÜM dikdörtgenlere uygular.
// Dönen değer {id: {x,y,width,height}}; boyutlar min ile kelepçelenir.
export function computeSelectionScaledRects(snapshot = {}, scale = {}, anchor = {}, min = 30) {
  const scaleX = Number.isFinite(scale.x) && scale.x > 0 ? scale.x : 1;
  const scaleY = Number.isFinite(scale.y) && scale.y > 0 ? scale.y : 1;
  const ax = Number(anchor.x) || 0;
  const ay = Number(anchor.y) || 0;
  const result = {};
  Object.entries(snapshot).forEach(([id, rect]) => {
    result[id] = {
      x: ax + ((Number(rect.x) || 0) - ax) * scaleX,
      y: ay + ((Number(rect.y) || 0) - ay) * scaleY,
      width: Math.max(min, (Number(rect.width) || 0) * scaleX),
      height: Math.max(min, (Number(rect.height) || 0) * scaleY),
    };
  });
  return result;
}
