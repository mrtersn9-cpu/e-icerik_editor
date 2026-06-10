import JSZip from 'jszip';

import {
  validateWidgetManifest,
  scanWidgetSecurity,
  resolveLocalHtmlAssets,
  parseAndValidateWidgetZip,
  isSafeWidgetPath,
} from '../widgets/widgetZipParser';

describe('Widget SDK V2.0 ZIP Ayrıştırıcı Birim Testleri', () => {

  describe('Güvenli yol kontrolü (isSafeWidgetPath) — zip-slip', () => {
    it('normal göreli yolları kabul eder', () => {
      expect(isSafeWidgetPath('index.html')).toBe(true);
      expect(isSafeWidgetPath('assets/img/logo.png')).toBe(true);
    });
    it('dizin dışına taşma (..) yollarını reddeder', () => {
      expect(isSafeWidgetPath('../evil.js')).toBe(false);
      expect(isSafeWidgetPath('assets/../../etc/passwd')).toBe(false);
    });
    it('mutlak yolları ve sürücü harflerini reddeder', () => {
      expect(isSafeWidgetPath('/etc/passwd')).toBe(false);
      expect(isSafeWidgetPath('C:\\win\\x.js')).toBe(false);
      expect(isSafeWidgetPath('a\\b.js')).toBe(false);
    });
    it('boş yolu reddeder', () => {
      expect(isSafeWidgetPath('')).toBe(false);
      expect(isSafeWidgetPath(null)).toBe(false);
    });
  });

  describe('Manifest Doğrulama (validateWidgetManifest)', () => {
    it('geçerli bir manifesti başarıyla doğrulamalıdır', () => {
      const validManifest = {
        id: 'test-widget-v1',
        name: 'Test Widget',
        version: '1.0.0',
        entry: 'index.html',
        props: [
          { name: 'speed', type: 'number', label: 'Hız' },
        ],
        commands: [
          { name: 'start', label: 'Başlat' },
        ],
        events: [
          { name: 'completed', label: 'Tamamlandı' },
        ],
      };

      const res = validateWidgetManifest(validManifest);
      expect(res.valid).toBe(true);
      expect(res.error).toBeNull();
    });

    it('zorunlu alanlar eksikse hata vermelidir', () => {
      const invalidManifest = {
        id: 'test-widget-v1',
        name: 'Test Widget',
        // version ve entry eksik
      };

      const res = validateWidgetManifest(invalidManifest);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('zorunlu "version" alanı eksik');
    });

    it('id karakter kurallarına uymuyorsa hata vermelidir', () => {
      const invalidManifest = {
        id: 'test widget!', // geçersiz karakter boşluk ve ünlem
        name: 'Test Widget',
        version: '1.0.0',
        entry: 'index.html',
      };

      const res = validateWidgetManifest(invalidManifest);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Widget ID sadece harf, sayı, tire ve alt çizgi içermeli');
    });

    it('props/commands/events tipleri geçersizse hata vermelidir', () => {
      const invalidManifest = {
        id: 'test-widget-v1',
        name: 'Test Widget',
        version: '1.0.0',
        entry: 'index.html',
        props: [
          { name: 'speed', type: 'invalid-type', label: 'Hız' }, // geçersiz tip
        ],
      };

      const res = validateWidgetManifest(invalidManifest);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('tipi geçersiz');
    });
  });

  describe('Güvenlik Taraması (scanWidgetSecurity)', () => {
    it('harici script ve link kaynaklarını başarıyla tespit etmelidir', async () => {
      const zip = new JSZip();
      zip.file('manifest.json', '{}');
      zip.file('index.html', '<html><script src="https://cdn.example.com/lib.js"></script><link href="http://cdn.example.com/style.css"/></html>');
      zip.file('main.js', 'console.log("local script");');

      const warnings = await scanWidgetSecurity(zip.files);
      expect(warnings.length).toBe(2);
      expect(warnings[0].type).toBe('EXTERNAL_SCRIPT');
      expect(warnings[0].url).toBe('https://cdn.example.com/lib.js');
      expect(warnings[1].type).toBe('EXTERNAL_LINK');
      expect(warnings[1].url).toBe('http://cdn.example.com/style.css');
    });

    it('boşluklu ve farklı tırnaklı harici script ve link kaynaklarını başarıyla tespit etmelidir', async () => {
      const zip = new JSZip();
      zip.file('manifest.json', '{}');
      zip.file('index.html', '<html><script src  =  \'https://cdn.example.com/lib.js\'></script><link href   =  "http://cdn.example.com/style.css"/></html>');

      const warnings = await scanWidgetSecurity(zip.files);
      expect(warnings.length).toBe(2);
      expect(warnings[0].type).toBe('EXTERNAL_SCRIPT');
      expect(warnings[0].url).toBe('https://cdn.example.com/lib.js');
      expect(warnings[1].type).toBe('EXTERNAL_LINK');
      expect(warnings[1].url).toBe('http://cdn.example.com/style.css');
    });

    it('inline JS ağ isteklerini (fetch/XHR) tespit etmelidir', async () => {
      const zip = new JSZip();
      zip.file('manifest.json', '{}');
      zip.file('main.js', 'fetch("https://api.example.com/data");');

      const warnings = await scanWidgetSecurity(zip.files);
      expect(warnings.length).toBe(1);
      expect(warnings[0].type).toBe('NETWORK_REQUEST');
      expect(warnings[0].file).toBe('main.js');
    });
  });

  describe('Local Asset Çözümleme (resolveLocalHtmlAssets)', () => {
    it('HTML içindeki yerel referansları Blob URL\'leriyle doğru değiştirmelidir', () => {
      const html = '<html><script src="main.js"></script><link href="./style.css"/></html>';
      const blobMap = {
        'main.js': 'blob:http://localhost/js-uuid',
        'style.css': 'blob:http://localhost/css-uuid',
      };

      const resolved = resolveLocalHtmlAssets(html, blobMap);
      expect(resolved).toContain('src="blob:http://localhost/js-uuid"');
      expect(resolved).toContain('href="blob:http://localhost/css-uuid"');
    });

    it('HTML içinde boşluklu ve karmaşık dosya isimlerine sahip referansları doğru değiştirmelidir', () => {
      const html = '<html><script src  =  "main-script.js"></script><link href   =   "./styles/main.css"/></html>';
      const blobMap = {
        'main-script.js': 'blob:http://localhost/js-uuid',
        'styles/main.css': 'blob:http://localhost/css-uuid',
      };

      const resolved = resolveLocalHtmlAssets(html, blobMap);
      expect(resolved).toContain('src="blob:http://localhost/js-uuid"');
      expect(resolved).toContain('href="blob:http://localhost/css-uuid"');
    });
  });

  describe('Nihai ZIP Ayrıştırıcı (parseAndValidateWidgetZip)', () => {
    it('geçerli bir mock ZIP dosyasını başarıyla parse etmelidir', async () => {
      // Mock ZIP oluştur
      const zip = new JSZip();
      
      const manifest = {
        id: 'mock-widget-v1',
        name: 'Mock Widget',
        version: '1.0.0',
        entry: 'index.html',
      };

      zip.file('manifest.json', JSON.stringify(manifest));
      zip.file('index.html', '<html><script src="main.js"></script></html>');
      zip.file('main.js', 'console.log("hello");');

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      
      // Global window URL mock'ları Node.js test ortamında gerekebilir
      global.URL.createObjectURL = jest.fn(() => 'blob:mock-url-uuid');

      const res = await parseAndValidateWidgetZip(zipBlob);

      expect(res.valid).toBe(true);
      expect(res.manifest.id).toBe('mock-widget-v1');
      expect(res.entryUrl).toBe('blob:mock-url-uuid');
      expect(res.blobMap['index.html']).toBe('blob:mock-url-uuid');
      expect(res.blobMap['main.js']).toBe('blob:mock-url-uuid');
      expect(res.warnings.length).toBe(0);
    });

    it('manifest dosyası yoksa hata fırlatmalıdır', async () => {
      const zip = new JSZip();
      zip.file('index.html', '<html></html>');
      
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const res = await parseAndValidateWidgetZip(zipBlob);

      expect(res.valid).toBe(false);
      expect(res.error).toContain('manifest.json" dosyası bulunamadı');
    });
  });
});
