// Genel kabul görmüş ~100 yazı tipi. Sistem fontları (yükleme gerektirmez) + popüler
// font aileleri. İnternete çıkmamak için yalnızca public/fonts/fonts.css yerel dosyası denenir.
// Biçim > Font seçicide her font kendi yazı tipiyle önizlenir.

// Yükleme gerektirmeyen sistem fontları
export const SYSTEM_FONTS = [
  'Arial',
  'Helvetica',
  'Verdana',
  'Tahoma',
  'Trebuchet MS',
  'Segoe UI',
  'Calibri',
  'Georgia',
  'Times New Roman',
  'Garamond',
  'Courier New',
  'Consolas',
  'Comic Sans MS',
  'Impact',
  'Palatino Linotype',
  'Lucida Sans',
  'Humst777 BlkCn BT',
];

// Yerel paketlenmiş popüler font adları (~90). Adı "Google" kalan API'ler geriye uyum içindir.
export const GOOGLE_FONTS = [
  'Roboto',
  'Open Sans',
  'Lato',
  'Montserrat',
  'Poppins',
  'Inter',
  'Nunito',
  'Nunito Sans',
  'Raleway',
  'Ubuntu',
  'Merriweather',
  'Playfair Display',
  'Oswald',
  'Source Sans 3',
  'Source Serif 4',
  'PT Sans',
  'PT Serif',
  'Noto Sans',
  'Noto Serif',
  'Work Sans',
  'Rubik',
  'Mukta',
  'Quicksand',
  'Karla',
  'Manrope',
  'DM Sans',
  'DM Serif Display',
  'Josefin Sans',
  'Bebas Neue',
  'Anton',
  'Archivo',
  'Archivo Black',
  'Barlow',
  'Cabin',
  'Catamaran',
  'Comfortaa',
  'Dosis',
  'Exo 2',
  'Fira Sans',
  'Heebo',
  'Hind',
  'Kanit',
  'Libre Baskerville',
  'Libre Franklin',
  'Lora',
  'Maven Pro',
  'Mulish',
  'Overpass',
  'Oxygen',
  'Padauk',
  'Pacifico',
  'Permanent Marker',
  'Prompt',
  'Questrial',
  'Righteous',
  'Sarabun',
  'Signika',
  'Space Grotesk',
  'Space Mono',
  'Teko',
  'Titillium Web',
  'Varela Round',
  'Zilla Slab',
  'Abril Fatface',
  'Alegreya',
  'Amatic SC',
  'Arvo',
  'Asap',
  'Assistant',
  'Bitter',
  'Caveat',
  'Cormorant Garamond',
  'Crimson Text',
  'Dancing Script',
  'EB Garamond',
  'Fjalla One',
  'Frank Ruhl Libre',
  'Indie Flower',
  'Jost',
  'Lobster',
  'Markazi Text',
  'Domine',
  'Patua One',
  'Philosopher',
  'Saira',
  'Satisfy',
  'Shadows Into Light',
  'Spectral',
  'Tajawal',
  'Yanone Kaffeesatz',
  'Bree Serif',
  'Cairo',
  'Figtree',
  'Outfit',
  'Sora',
  'Plus Jakarta Sans',
];

// Biçim seçicide gösterilecek tam liste (sistem + Google)
export const FONT_FAMILIES = [...SYSTEM_FONTS, ...GOOGLE_FONTS];

const GOOGLE_FONT_SET = new Set(GOOGLE_FONTS);

export function isGoogleFont(name = '') {
  return GOOGLE_FONT_SET.has(String(name).trim());
}

// CSS font-family değeri (uygun bir fallback ile)
export function fontFamilyCss(name = '') {
  const safe = String(name || '').trim();
  if (!safe) return undefined;
  return /\s/.test(safe) ? `'${safe}', sans-serif` : `${safe}, sans-serif`;
}

let googleFontsLinkPromise = null;

// Yerel fontları tek bir stylesheet ile (tembel) yükle. Yalnızca bir kez enjekte edilir.
// Stylesheet <link> yüklenince resolve olan bir Promise döndürür (idempotent).
// ÇEVRİMDIŞI: public/fonts/fonts.css (`npm run fonts:download` ile üretilir) dışında
// dış CDN fallback'i yoktur.
export function ensureGoogleFontsLoaded() {
  if (typeof document === 'undefined') return Promise.resolve();
  if (googleFontsLinkPromise) return googleFontsLinkPromise;
  googleFontsLinkPromise = new Promise((resolve) => {
    const localLink = document.createElement('link');
    localLink.rel = 'stylesheet';
    localLink.href = `${process.env.PUBLIC_URL || '.'}/fonts/fonts.css`;
    localLink.setAttribute('data-eicerik-fonts', 'local');
    localLink.onload = () => resolve();
    localLink.onerror = () => resolve();
    document.head.appendChild(localLink);
  });
  return googleFontsLinkPromise;
}

// ─── Özel (kullanıcı yüklemesi) fontlar ──────────────────────────────────────
// Kullanıcı .ttf/.otf/.woff/.woff2 dosyası yükleyebilir; font tarayıcıda
// FontFace API ile kaydedilir ve localStorage'da saklanır (çevrimdışı kalıcı).

const CUSTOM_FONTS_KEY = 'eicerik_custom_fonts';
const registeredCustomFonts = new Set();

export function getCustomFonts() {
  if (typeof localStorage === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(CUSTOM_FONTS_KEY) || '[]');
    return Array.isArray(parsed)
      ? parsed.filter((item) => item && item.name && item.dataUrl)
      : [];
  } catch {
    return [];
  }
}

export function isCustomFont(name = '') {
  const safe = String(name || '').trim();
  return !!safe && getCustomFonts().some((item) => item.name === safe);
}

function registerCustomFontFace(name, dataUrl) {
  if (typeof document === 'undefined' || !document.fonts || typeof FontFace === 'undefined') {
    return Promise.resolve(name);
  }
  if (registeredCustomFonts.has(name)) return Promise.resolve(name);
  const face = new FontFace(name, `url(${dataUrl})`);
  return face
    .load()
    .then((loaded) => {
      document.fonts.add(loaded);
      registeredCustomFonts.add(name);
      return name;
    })
    .catch(() => name);
}

// Kayıtlı tüm özel fontları tarayıcıya yükler (idempotent).
export function ensureCustomFontsLoaded() {
  return Promise.all(getCustomFonts().map((item) => registerCustomFontFace(item.name, item.dataUrl)));
}

// Yeni özel font ekler; ad çakışmasında üstüne yazar. Başarıda font adıyla resolve olur.
export async function addCustomFont(name, dataUrl) {
  const safe = String(name || '').trim();
  if (!safe || !dataUrl) throw new Error('Font adı ve dosyası gerekli.');
  // localStorage sınırı (~5MB) — büyük TTF'ler için kullanıcıyı woff2'ye yönlendir.
  if (dataUrl.length > 4 * 1024 * 1024) {
    throw new Error('Font dosyası çok büyük (4 MB sınırı). woff2 formatını deneyin.');
  }
  const next = [...getCustomFonts().filter((item) => item.name !== safe), { name: safe, dataUrl }];
  try {
    localStorage.setItem(CUSTOM_FONTS_KEY, JSON.stringify(next));
  } catch {
    throw new Error('Font kaydedilemedi: tarayıcı depolama alanı dolu.');
  }
  registeredCustomFonts.delete(safe);
  await registerCustomFontFace(safe, dataUrl);
  return safe;
}

export function removeCustomFont(name = '') {
  const safe = String(name || '').trim();
  if (!safe || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(
      CUSTOM_FONTS_KEY,
      JSON.stringify(getCustomFonts().filter((item) => item.name !== safe))
    );
  } catch {
    // depolama erişilemezse sessiz geç
  }
  registeredCustomFonts.delete(safe);
}

// Tek bir fontun GERÇEKTEN indirildiğini garanti eder (CSS Font Loading API).
// Picker önizlemesi için: font inene kadar satır nötr fallback'te tutulur, inince
// kendi tipine geçer (tofu/bozuk glif sorununu çözer). Font adıyla resolve olur.
export function loadGoogleFont(name = '') {
  const safe = String(name || '').trim();
  if (!safe || typeof document === 'undefined') return Promise.resolve(safe);
  // Kullanıcının yüklediği özel fontlar FontFace kaydından gelir.
  if (isCustomFont(safe)) return ensureCustomFontsLoaded().then(() => safe);
  // Sistem fontları zaten hazır.
  if (!isGoogleFont(safe)) return Promise.resolve(safe);
  const family = /\s/.test(safe) ? `'${safe}'` : safe;
  const afterSheet = ensureGoogleFontsLoaded();
  if (!document.fonts || !document.fonts.load) return afterSheet.then(() => safe);
  return afterSheet
    .then(() =>
      Promise.all([
        document.fonts.load(`400 16px ${family}`),
        document.fonts.load(`700 16px ${family}`),
      ])
    )
    .then(() => safe)
    .catch(() => safe);
}
