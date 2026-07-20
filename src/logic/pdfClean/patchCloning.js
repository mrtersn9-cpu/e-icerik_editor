export function deepClone(value) {
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

export function clonePatchesPreservingImage(patches) {
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
