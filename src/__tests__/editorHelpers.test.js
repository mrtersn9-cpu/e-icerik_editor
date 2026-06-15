import { sanitizeSvgMarkup } from '../utils/editorHelpers';

describe('sanitizeSvgMarkup', () => {
  test('removes scripts, event handlers, and javascript URLs', () => {
    const svg = sanitizeSvgMarkup(`
      <svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)">
        <script>alert(1)</script>
        <a href="javascript:alert(2)">
          <rect width="100" height="100" onclick="alert(3)" />
        </a>
      </svg>
    `);

    expect(svg).not.toMatch(/<script/i);
    expect(svg).not.toMatch(/onload|onclick/i);
    expect(svg).not.toMatch(/javascript:/i);
    expect(svg).toMatch(/<svg/i);
    expect(svg).toMatch(/<rect/i);
  });

  test('allows safe SVG references and image data URLs', () => {
    const svg = sanitizeSvgMarkup(`
      <svg xmlns="http://www.w3.org/2000/svg">
        <use href="#icon" />
        <image href="data:image/png;base64,abc" />
      </svg>
    `);

    expect(svg).toMatch(/href="#icon"/);
    expect(svg).toMatch(/data:image\/png;base64,abc/);
  });

  test('preserves safe style blocks and inline colors', () => {
    const svg = sanitizeSvgMarkup(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">
        <style>
          .bg { fill: #ff0000; stroke: #00ff00; }
          .fg { fill: rgb(0, 0, 255); }
        </style>
        <rect class="bg" width="10" height="10" style="opacity:0.8; fill:#123456" />
        <circle class="fg" cx="5" cy="5" r="2" />
      </svg>
    `);

    expect(svg).toMatch(/<style>/);
    expect(svg).toMatch(/fill:\s*#ff0000/i);
    expect(svg).toMatch(/stroke:\s*#00ff00/i);
    expect(svg).toMatch(/style="opacity:0.8; fill:#123456"/i);
  });

  test('KESIN KURAL: dış http(s)/protokolsüz SVG kaynak referanslarını kaldırır', () => {
    const svg = sanitizeSvgMarkup(`
      <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
        <image href="https://cdn.diskaynak.test/track.png" />
        <image xlink:href="http://ornek.diskaynak.test/a.png" />
        <use href="//cdn.diskaynak.test/sprite.svg#i" />
        <image href="data:image/png;base64,abc" />
        <use href="#ic" />
      </svg>
    `);

    // Dış host hiçbir biçimde kalmamalı (xmlns namespace URL'leri hariç tutulur)
    expect(svg).not.toMatch(/diskaynak\.test/i);
    // Güvenli olanlar korunur
    expect(svg).toMatch(/data:image\/png;base64,abc/);
    expect(svg).toMatch(/href="#ic"/);
  });

  test('KESIN KURAL: CSS url() içindeki uzak kaynakları nötrler', () => {
    const svg = sanitizeSvgMarkup(`
      <svg xmlns="http://www.w3.org/2000/svg">
        <style>.x { background-image: url("https://cdn.diskaynak.test/bg.png"); fill: red; }</style>
        <rect width="10" height="10" style="fill:#fff; background:url(//evil.diskaynak.test/x.png)" />
      </svg>
    `);

    expect(svg).not.toMatch(/diskaynak\.test/i);
    expect(svg).toMatch(/fill:\s*red/i);
  });

  test('removes unsafe css from style blocks and inline styles', () => {
    const svg = sanitizeSvgMarkup(`
      <svg xmlns="http://www.w3.org/2000/svg">
        <style>
          .bad { fill: red; }
          @import url("https://evil.example/x.css");
          .worse { background-image: url("javascript:alert(1)"); }
        </style>
        <rect width="10" height="10" style="fill:#fff; background:url(javascript:alert(2));" />
      </svg>
    `);

    expect(svg).not.toMatch(/@import/i);
    expect(svg).not.toMatch(/javascript:/i);
    expect(svg).toMatch(/fill:\s*red/i);
    expect(svg).toMatch(/style="fill:#fff; /i);
  });
});
