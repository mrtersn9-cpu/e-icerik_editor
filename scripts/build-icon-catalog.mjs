// İkon kataloğunu lucide-react paketinden üretir.
// lucide-react her ikonu createLucideIcon("Ad", [ ...iconNode... ]) ile tanımlar;
// burada o node verisini (React'siz, salt veri) çıkarıp tek bir veri modülüne yazıyoruz.
// Üretilen dosya yalnızca İkon Seçici açıldığında lazy import() ile yüklenir.
//
// Çalıştır: npm run icons:catalog
import fs from 'fs';
import path from 'path';

const ICONS_DIR = 'node_modules/lucide-react/dist/esm/icons';
const OUT = 'src/generated/iconCatalog.generated.js';

if (!fs.existsSync(ICONS_DIR)) {
  console.error(`lucide-react ikon dizini bulunamadı: ${ICONS_DIR}`);
  process.exit(1);
}

const files = fs
  .readdirSync(ICONS_DIR)
  .filter((file) => file.endsWith('.js') && !file.endsWith('.js.map'));

const catalog = [];
let skipped = 0;

for (const file of files) {
  const id = file.replace(/\.js$/, '');
  const code = fs.readFileSync(path.join(ICONS_DIR, file), 'utf8');
  // createLucideIcon("Ad", [ ...node... ]) çağrısını yakala (dosyada tek tanım var).
  const match = code.match(/createLucideIcon\(\s*"([^"]+)"\s*,\s*(\[[\s\S]*\])\s*\)\s*;/);
  if (!match) {
    // Alias / re-export dosyaları (createLucideIcon içermez) atlanır.
    skipped += 1;
    continue;
  }
  let node;
  try {
    // Kaynak güvenilir (node_modules, build-time); array literal'i değerlendir.
    // eslint-disable-next-line no-new-func
    node = new Function(`return (${match[2]})`)();
  } catch (error) {
    console.warn(`atlandı (parse): ${file} — ${error.message}`);
    skipped += 1;
    continue;
  }
  if (!Array.isArray(node)) {
    skipped += 1;
    continue;
  }
  // React'e özgü "key" niteliğini at; SVG üretimi için gerekmez.
  const cleanedNode = node.map(([tag, attrs]) => {
    const rest = { ...(attrs || {}) };
    delete rest.key;
    return [tag, rest];
  });
  // kebab-case id'den okunabilir ad: "a-arrow-down" -> "A Arrow Down".
  const name = id
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  catalog.push({ id, name, node: cleanedNode });
}

catalog.sort((left, right) => left.id.localeCompare(right.id));

const banner =
  '// OTOMATİK ÜRETİLDİ — scripts/build-icon-catalog.mjs ile. Elle düzenlemeyin.\n' +
  '// Kaynak: lucide-react ikon node verisi (ISC lisansı).\n' +
  `// İkon sayısı: ${catalog.length}\n`;
const body = `export const ICON_CATALOG = ${JSON.stringify(catalog)};\n`;
fs.writeFileSync(OUT, banner + body);

console.log(`${catalog.length} ikon yazıldı -> ${OUT} (atlanan: ${skipped})`);
