// Genel kabul görmüş ~100 yazı tipi. Sistem fontları (yükleme gerektirmez) + popüler
// Google Fonts. Google fontları, picker ilk açıldığında tek bir stylesheet ile tembel yüklenir.
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

// Popüler Google Fonts (~90)
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

// Google fontlarını tek bir stylesheet ile (tembel) yükle. Yalnızca bir kez enjekte edilir.
// Stylesheet <link> yüklenince resolve olan bir Promise döndürür (idempotent).
export function ensureGoogleFontsLoaded() {
  if (typeof document === 'undefined') return Promise.resolve();
  if (googleFontsLinkPromise) return googleFontsLinkPromise;
  const families = GOOGLE_FONTS.map(
    (name) => `family=${encodeURIComponent(name).replace(/%20/g, '+')}:wght@400;700`
  ).join('&');
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?${families}&display=swap`;
  link.setAttribute('data-eicerik-fonts', 'true');
  googleFontsLinkPromise = new Promise((resolve) => {
    link.onload = () => resolve();
    link.onerror = () => resolve();
  });
  document.head.appendChild(link);
  return googleFontsLinkPromise;
}

// Tek bir fontun GERÇEKTEN indirildiğini garanti eder (CSS Font Loading API).
// Picker önizlemesi için: font inene kadar satır nötr fallback'te tutulur, inince
// kendi tipine geçer (tofu/bozuk glif sorununu çözer). Font adıyla resolve olur.
export function loadGoogleFont(name = '') {
  const safe = String(name || '').trim();
  if (!safe || typeof document === 'undefined') return Promise.resolve(safe);
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
