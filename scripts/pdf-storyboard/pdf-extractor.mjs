import fs from 'node:fs/promises';
import path from 'node:path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { buildTextRows } from './parser-utils.mjs';

// PDF'i satır/sütun koordinatlarını koruyacak şekilde okur.
export async function extractPdfPages(inputPath) {
  const absolutePath = path.resolve(inputPath);
  const data = await fs.readFile(absolutePath);
  const loadingTask = getDocument({ data: new Uint8Array(data) });
  const pdf = await loadingTask.promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();
    const rows = buildTextRows(textContent.items || [], viewport);

    pages.push({
      pageNumber,
      width: viewport.width,
      height: viewport.height,
      rows,
      lines: rows,
      rawText: rows.map((row) => row.text).join('\n'),
    });
  }

  return {
    fileName: path.basename(absolutePath),
    pageCount: pdf.numPages,
    pages,
  };
}
