#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument, rgb } from 'pdf-lib';
import { extractPdfPages } from './pdf-extractor.mjs';
import { buildStoryboardConfig, findDottedBlankSegments } from './parser-utils.mjs';

function printHelp() {
  console.log(`
Kullanım:
  node scripts/pdf-storyboard/parse-storyboard-pdf.mjs --input ./ornek.pdf --outDir ./data/pdf-output

Seçenekler:
  --input       Kaynak PDF yolu
  --outDir      Çıktı klasörü (varsayılan: ./data/pdf-output)
  --json        JSON dosya adı (varsayılan: storyboard_config.json)
  --cleanedPdf  Temizlenmiş PDF dosya adı (varsayılan: output_cleaned.pdf)
  --no-mask     Noktalı alanları maskelemeden geç
  --help        Yardım metnini göster
`);
}

function parseArgs(argv = []) {
  const options = {
    input: '',
    outDir: './data/pdf-output',
    json: 'storyboard_config.json',
    cleanedPdf: 'output_cleaned.pdf',
    mask: true,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--no-mask') {
      options.mask = false;
    } else if (arg === '--input') {
      options.input = argv[index + 1] || '';
      index += 1;
    } else if (arg === '--outDir') {
      options.outDir = argv[index + 1] || options.outDir;
      index += 1;
    } else if (arg === '--json') {
      options.json = argv[index + 1] || options.json;
      index += 1;
    } else if (arg === '--cleanedPdf') {
      options.cleanedPdf = argv[index + 1] || options.cleanedPdf;
      index += 1;
    }
  }

  return options;
}

// pdf-lib ile özellikle uzun nokta alanlarını maskeleyip temiz bir kopya üretir.
async function createCleanedPdf(inputPath, pages, outputPdfPath) {
  const bytes = await fs.readFile(inputPath);
  const pdfDoc = await PDFDocument.load(bytes);

  pages.forEach((pageInfo, index) => {
    const pdfPage = pdfDoc.getPage(index);
    const masks = findDottedBlankSegments(pageInfo.rows || pageInfo.lines || []);

    masks.forEach((mask) => {
      pdfPage.drawRectangle({
        x: mask.x,
        y: Math.max(0, mask.y - (mask.height * 0.15)),
        width: mask.width,
        height: mask.height * 1.2,
        color: rgb(1, 1, 1),
        borderColor: rgb(1, 1, 1),
      });
    });
  });

  const outputBytes = await pdfDoc.save();
  await fs.writeFile(outputPdfPath, outputBytes);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help || !options.input) {
    printHelp();
    process.exit(options.help ? 0 : 1);
  }

  const inputPath = path.resolve(options.input);
  const outDir = path.resolve(options.outDir);
  const jsonPath = path.join(outDir, options.json);
  const cleanedPdfPath = path.join(outDir, options.cleanedPdf);
  const rawDumpPath = path.join(outDir, 'raw_pages_debug.json');

  await fs.mkdir(outDir, { recursive: true });

  console.log(`PDF okunuyor: ${inputPath}`);
  const analysis = await extractPdfPages(inputPath);

  if (options.mask) {
    console.log('Noktalı hedef alanlar maskeleme için hazırlanıyor...');
    await createCleanedPdf(inputPath, analysis.pages, cleanedPdfPath);
  }

  const config = buildStoryboardConfig({
    document: options.mask ? path.basename(cleanedPdfPath) : path.basename(inputPath),
    pages: analysis.pages,
  });

  await fs.writeFile(jsonPath, JSON.stringify(config, null, 2), 'utf8');
  await fs.writeFile(rawDumpPath, JSON.stringify(analysis, null, 2), 'utf8');

  console.log('\nTamamlandı ✅');
  console.log(`- JSON: ${jsonPath}`);
  console.log(`- Debug: ${rawDumpPath}`);
  console.log(`- Temiz PDF: ${options.mask ? cleanedPdfPath : 'maskeleme kapalı'}`);
  console.log(`- Sayfa sayısı: ${analysis.pageCount}`);
}

main().catch((error) => {
  console.error('\nİşlem başarısız oldu:', error?.message || error);
  process.exit(1);
});
