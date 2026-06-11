// Google Fonts'taki yazı tiplerini SİSTEME indirir (çevrimdışı çalışma için):
//   public/fonts/files/*.woff2  + public/fonts/fonts.css (@font-face tanımları)
// Editör (src/constants/fonts.js ensureGoogleFontsLoaded) önce bu yerel CSS'i
// dener; dosya yoksa Google CDN'e düşer. Çalıştırma: `npm run fonts:download`
// Yalnızca latin + latin-ext alt kümeleri indirilir (Türkçe karakterler latin-ext'te).

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { GOOGLE_FONTS } from '../src/constants/fonts.js';

// woff2 almak için modern tarayıcı UA gerekir (aksi halde ttf/eot döner).
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const SUBSETS = new Set(['latin', 'latin-ext']);
const OUT_DIR = path.resolve('public', 'fonts');
const FILES_DIR = path.join(OUT_DIR, 'files');

function slugify(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function fetchFamilyCss(family) {
  const familyParam = encodeURIComponent(family).replace(/%20/g, '+');
  const url = `https://fonts.googleapis.com/css2?family=${familyParam}:wght@400;700&display=swap`;
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`CSS isteği ${response.status}`);
  return response.text();
}

// Google CSS'i '/* latin */' yorum başlıklı @font-face bloklarından oluşur.
function parseFontFaceBlocks(css) {
  const blocks = [];
  const pattern = /\/\*\s*([a-z0-9-]+)\s*\*\/\s*(@font-face\s*\{[^}]*\})/g;
  let match;
  while ((match = pattern.exec(css))) {
    blocks.push({ subset: match[1], block: match[2] });
  }
  return blocks;
}

async function downloadFontFile(url) {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`Font dosyası ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function main() {
  await mkdir(FILES_DIR, { recursive: true });
  const cssParts = [
    '/* Otomatik üretildi: npm run fonts:download — elle düzenlemeyin. */',
    '/* Kaynak: Google Fonts (latin + latin-ext), 400/700 ağırlıkları. */',
    '',
  ];
  let fileCount = 0;
  let totalBytes = 0;
  const failed = [];

  for (const family of GOOGLE_FONTS) {
    try {
      const css = await fetchFamilyCss(family);
      const blocks = parseFontFaceBlocks(css).filter((item) => SUBSETS.has(item.subset));
      if (!blocks.length) throw new Error('uygun alt küme bulunamadı');
      const slug = slugify(family);
      let index = 0;
      const rewritten = [];
      for (const { subset, block } of blocks) {
        const urlMatch = block.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/);
        if (!urlMatch) continue;
        const weightMatch = block.match(/font-weight:\s*(\d+)/);
        const weight = weightMatch ? weightMatch[1] : '400';
        const fileName = `${slug}-${weight}-${subset}-${index}.woff2`;
        const bytes = await downloadFontFile(urlMatch[1]);
        await writeFile(path.join(FILES_DIR, fileName), bytes);
        fileCount += 1;
        totalBytes += bytes.length;
        index += 1;
        rewritten.push(`/* ${subset} */\n${block.replace(urlMatch[1], `files/${fileName}`)}`);
      }
      cssParts.push(...rewritten, '');
      process.stdout.write(`✓ ${family} (${rewritten.length} dosya)\n`);
    } catch (error) {
      failed.push({ family, error: error.message });
      process.stdout.write(`✗ ${family}: ${error.message}\n`);
    }
  }

  await writeFile(path.join(OUT_DIR, 'fonts.css'), cssParts.join('\n'), 'utf8');
  const mb = (totalBytes / (1024 * 1024)).toFixed(1);
  process.stdout.write(
    `\nTamamlandı: ${fileCount} dosya, ${mb} MB → public/fonts/ (başarısız: ${failed.length})\n`
  );
  if (failed.length) {
    process.stdout.write('Başarısız aileler CDN fallback ile çalışmaya devam eder.\n');
  }
}

main().catch((error) => {
  process.stderr.write(`Font indirme hatası: ${error.message}\n`);
  process.exitCode = 1;
});
