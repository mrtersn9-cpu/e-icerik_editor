import { normalizeBox } from './geometry';

export async function extractTextEntries(page, viewport, pdfjsLib) {
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

export function summarizePageText(entries) {
  return (entries || [])
    .map((entry) => entry.text)
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 220);
}
