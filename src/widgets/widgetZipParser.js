import JSZip from 'jszip';

// ZIP içindeki dosya yolları SCORM paketine yazıldığından zip-slip (../ ile dizin dışına
// taşma) ve mutlak yol enjeksiyonu engellenmeli. Yalnızca paket köküne göreli, segmentleri
// güvenli yollar kabul edilir.
const MAX_WIDGET_UNCOMPRESSED_BYTES = 50 * 1024 * 1024; // 50 MB toplam açılma sınırı (zip bomb)

export function isSafeWidgetPath(path) {
  const raw = String(path || '').trim();
  if (!raw) return false;
  if (raw.includes('\\')) return false; // ters bölü → Windows yol kaçışı
  if (raw.startsWith('/')) return false; // mutlak yol
  if (/^[a-zA-Z]:/.test(raw)) return false; // sürücü harfi (C:\...)
  // Herhangi bir ".." segmenti dizin dışına taşma riskidir.
  if (raw.split('/').some((segment) => segment === '..')) return false;
  return true;
}

/**
 * manifest.json dosyasının şemasını ve alanlarını doğrular.
 * @param {Object} manifest - Doğrulanacak manifest JSON nesnesi.
 * @returns {Object} Geçerlilik durumu (valid) ve hata mesajı (error).
 */
export function validateWidgetManifest(manifest) {
  if (!manifest || typeof manifest !== 'object') {
    return { valid: false, error: 'Manifest geçerli bir JSON objesi olmalıdır.' };
  }

  const requiredFields = ['id', 'name', 'version', 'entry'];
  for (const field of requiredFields) {
    if (!manifest[field]) {
      return { valid: false, error: `Manifest içinde zorunlu "${field}" alanı eksik.` };
    }
  }

  if (typeof manifest.id !== 'string' || !/^[a-zA-Z0-9_-]{3,30}$/.test(manifest.id)) {
    return {
      valid: false,
      error: 'Widget ID sadece harf, sayı, tire ve alt çizgi içermeli, 3-30 karakter uzunluğunda olmalıdır.',
    };
  }

  if (typeof manifest.name !== 'string' || manifest.name.trim().length < 2) {
    return { valid: false, error: 'Widget adı en az 2 karakter uzunluğunda olmalıdır.' };
  }

  if (typeof manifest.entry !== 'string' || manifest.entry.trim() === '') {
    return { valid: false, error: 'Widget giriş (entry) HTML dosyası belirtilmelidir.' };
  }

  // Props doğrulaması
  if (manifest.props && !Array.isArray(manifest.props)) {
    return { valid: false, error: 'Manifest içindeki "props" bir dizi olmalıdır.' };
  }
  if (manifest.props) {
    for (let i = 0; i < manifest.props.length; i++) {
      const prop = manifest.props[i];
      if (!prop.name || !prop.type || !prop.label) {
        return { valid: false, error: `Prop ${i + 1} içinde name, type veya label eksik.` };
      }
      if (!['number', 'text', 'boolean'].includes(prop.type)) {
        return { valid: false, error: `Prop "${prop.name}" tipi geçersiz (number, text veya boolean olmalı).` };
      }
    }
  }

  // Commands doğrulaması
  if (manifest.commands && !Array.isArray(manifest.commands)) {
    return { valid: false, error: 'Manifest içindeki "commands" bir dizi olmalıdır.' };
  }
  if (manifest.commands) {
    for (let i = 0; i < manifest.commands.length; i++) {
      const cmd = manifest.commands[i];
      if (!cmd.name || !cmd.label) {
        return { valid: false, error: `Komut ${i + 1} içinde name veya label eksik.` };
      }
    }
  }

  // Events doğrulaması
  if (manifest.events && !Array.isArray(manifest.events)) {
    return { valid: false, error: 'Manifest içindeki "events" bir dizi olmalıdır.' };
  }
  if (manifest.events) {
    for (let i = 0; i < manifest.events.length; i++) {
      const evt = manifest.events[i];
      if (!evt.name || !evt.label) {
        return { valid: false, error: `Olay (event) ${i + 1} içinde name veya label eksik.` };
      }
    }
  }

  return { valid: true, error: null };
}

/**
 * ZIP dosyasındaki HTML ve JS dosyalarını tarayarak harici bağlantıları ve güvenlik ihlallerini bulur.
 * @param {Object} zipFiles - JSZip dosya nesneleri haritası.
 * @returns {Promise<Array>} Harici ağ isteği/CDN uyarılarının listesi.
 */
export async function scanWidgetSecurity(zipFiles) {
  const warnings = [];

  for (const [path, file] of Object.entries(zipFiles)) {
    if (file.dir) continue;

    const lowerPath = path.toLowerCase();
    const isHtml = lowerPath.endsWith('.html') || lowerPath.endsWith('.htm');
    const isJs = lowerPath.endsWith('.js');

    if (isHtml || isJs) {
      const content = await file.async('text');

      // Harici CDN / HTTP script ve link kontrolleri (Örn: https://cdn...)
      const srcRegex = /src\s*=\s*["'](https?:[^"']+)["']/gi;
      const hrefRegex = /href\s*=\s*["'](https?:[^"']+)["']/gi;
      let match;

      while ((match = srcRegex.exec(content)) !== null) {
        const url = match[1];
        warnings.push({
          file: path,
          type: 'EXTERNAL_SCRIPT',
          message: `Çevrimdışı Çalışma Uyarısı: "${path}" dosyasında harici kaynak tespit edildi: ${url}`,
          url,
        });
      }

      while ((match = hrefRegex.exec(content)) !== null) {
        const url = match[1];
        // local veya hash linkleri hariç tut
        if (!url.startsWith('#') && !url.startsWith('/') && !url.startsWith('./')) {
          warnings.push({
            file: path,
            type: 'EXTERNAL_LINK',
            message: `Çevrimdışı Çalışma Uyarısı: "${path}" dosyasında harici link tespit edildi: ${url}`,
            url,
          });
        }
      }

      // Inline ağ isteği tespiti (fetch, XMLHttpRequest, sendBeacon vb.)
      if (isJs || isHtml) {
        if (/fetch\s*\(|XMLHttpRequest|sendBeacon/i.test(content)) {
          warnings.push({
            file: path,
            type: 'NETWORK_REQUEST',
            message: `Güvenlik Uyarısı: "${path}" dosyasında harici ağ isteği (fetch/XHR) yapısı tespit edildi.`,
          });
        }
      }
    }
  }

  return warnings;
}

/**
 * HTML içindeki yerel dosya referanslarını (script, css, img vb.) bellek Blob URL'leriyle değiştirir.
 * @param {string} htmlContent - HTML dosya içeriği.
 * @param {Object} blobMap - Yerel yollar ile Blob URL'leri arasındaki eşleşme haritası.
 * @returns {string} Bağımlılıkları Blob URL'lerine dönüştürülmüş nihai HTML.
 */
export function resolveLocalHtmlAssets(htmlContent, blobMap) {
  let resolvedHtml = htmlContent;

  const escapeRegExp = (str) => str.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');

  // src="..." ve href="..." niteliklerini tara ve Blob URL'leri ile değiştir
  Object.entries(blobMap).forEach(([localPath, blobUrl]) => {
    // Klasör yapısındaki ön ekleri temizle (Örn: src/main.js -> main.js veya ./main.js)
    const baseName = localPath.split('/').pop() || localPath;
    const escapedPath = escapeRegExp(localPath);
    const escapedBase = escapeRegExp(baseName);

    const regexSrc = new RegExp(`src\\s*=\\s*["'](\\./)?(${escapedPath}|${escapedBase})["']`, 'gi');
    const regexHref = new RegExp(`href\\s*=\\s*["'](\\./)?(${escapedPath}|${escapedBase})["']`, 'gi');

    resolvedHtml = resolvedHtml.replace(regexSrc, `src="${blobUrl}"`);
    resolvedHtml = resolvedHtml.replace(regexHref, `href="${blobUrl}"`);
  });

  return resolvedHtml;
}

/**
 * Yüklenen widget ZIP dosyasını açar, doğrular, güvenliğini tarar ve tüm assetleri Blob URL'leri olarak eşler.
 * @param {Blob|File} fileBlob - Yüklenecek ZIP dosya Blobu.
 * @returns {Promise<Object>} Çözümlenmiş widget manifesti, assetleri, Blob URL'leri ve güvenlik uyarıları.
 */
export async function parseAndValidateWidgetZip(fileBlob) {
  try {
    const zip = await JSZip.loadAsync(fileBlob);
    const files = zip.files;

    // 1. manifest.json dosyası varlığı kontrolü
    const manifestFile = Object.keys(files).find((path) => path.toLowerCase().endsWith('manifest.json'));
    if (!manifestFile) {
      throw new Error('ZIP paketi içinde "manifest.json" dosyası bulunamadı.');
    }

    const manifestContent = await files[manifestFile].async('text');
    let manifest;
    try {
      manifest = JSON.parse(manifestContent);
    } catch {
      throw new Error('manifest.json dosyası geçerli bir JSON formatında değil.');
    }

    // 2. Manifest alanlarının doğrulanması
    const validation = validateWidgetManifest(manifest);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // 3. Giriş (entry) HTML dosyasının varlığı kontrolü
    const entryFile = Object.keys(files).find((path) => path.toLowerCase() === manifest.entry.toLowerCase());
    if (!entryFile) {
      throw new Error(`Giriş dosyası "${manifest.entry}" ZIP paketi içinde bulunamadı.`);
    }

    // 4. Güvenlik ve Harici CDN Taraması
    const securityWarnings = await scanWidgetSecurity(files);

    // 5. Varlıkların Bellek Blob URL'lerine Çıkartılması
    const blobMap = {};
    const rawAssets = {}; // SCORM export'ta saf dosyaları saklamak için
    let totalUncompressed = 0;

    for (const [path, file] of Object.entries(files)) {
      if (file.dir) continue;

      // Güvenlik: zip-slip / mutlak yol içeren girdileri pakete dahil etme.
      if (!isSafeWidgetPath(path)) {
        securityWarnings.push(`Güvenli olmayan dosya yolu atlandı: ${path}`);
        continue;
      }

      const lowerPath = path.toLowerCase();
      let mimeType = 'application/octet-stream';

      if (lowerPath.endsWith('.html') || lowerPath.endsWith('.htm')) mimeType = 'text/html';
      else if (lowerPath.endsWith('.js')) mimeType = 'application/javascript';
      else if (lowerPath.endsWith('.css')) mimeType = 'text/css';
      else if (lowerPath.endsWith('.png')) mimeType = 'image/png';
      else if (lowerPath.endsWith('.jpg') || lowerPath.endsWith('.jpeg')) mimeType = 'image/jpeg';
      else if (lowerPath.endsWith('.svg')) mimeType = 'image/svg+xml';
      else if (lowerPath.endsWith('.gif')) mimeType = 'image/gif';
      else if (lowerPath.endsWith('.json')) mimeType = 'application/json';

      const fileData = await file.async('blob');
      const bytes = await file.async('uint8array'); // SCORM için saf byte'ları sakla
      // Güvenlik: toplam açılan boyutu sınırla (zip bomb koruması).
      totalUncompressed += bytes.byteLength;
      if (totalUncompressed > MAX_WIDGET_UNCOMPRESSED_BYTES) {
        throw new Error('Widget paketi açıldığında izin verilen boyutu (50 MB) aşıyor.');
      }
      rawAssets[path] = bytes;

      const blobUrl = URL.createObjectURL(fileData.slice(0, fileData.size, mimeType));
      blobMap[path] = blobUrl;
    }

    // 6. Giriş HTML dosyasındaki local referansları Blob URL'leri ile çöz
    const rawEntryHtml = await files[entryFile].async('text');
    const resolvedEntryHtml = resolveLocalHtmlAssets(rawEntryHtml, blobMap);
    
    // Giriş HTML dosyasının Blob URL'sini güncellenmiş HTML ile değiştir
    const resolvedHtmlBlob = new Blob([resolvedEntryHtml], { type: 'text/html' });
    const resolvedEntryUrl = URL.createObjectURL(resolvedHtmlBlob);
    blobMap[entryFile] = resolvedEntryUrl;

    return {
      valid: true,
      manifest,
      entryUrl: resolvedEntryUrl,
      blobMap,
      rawAssets,
      warnings: securityWarnings,
    };
  } catch (err) {
    return {
      valid: false,
      error: err.message,
      manifest: null,
      entryUrl: null,
      blobMap: {},
      rawAssets: {},
      warnings: [],
    };
  }
}
