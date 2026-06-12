const { TextEncoder } = require('util');

global.TextEncoder = global.TextEncoder || TextEncoder;

const { buildStorylinePlayerHtml } = require('../utils/scormExport');

describe('SCORM custom fonts', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('embeds used custom font data into the SCORM player HTML', () => {
    localStorage.setItem(
      'eicerik_custom_fonts',
      JSON.stringify([
        {
          name: 'Benim Font',
          dataUrl: 'data:font/woff2;base64,AAAA',
        },
      ])
    );

    const html = buildStorylinePlayerHtml(
      {
        activities: [
          {
            id: 'act-1',
            name: 'Etkinlik',
            stageWidth: 800,
            stageHeight: 450,
            objects: [
              {
                id: 'button-1',
                type: 'button',
                label: 'Kontrol Et',
                x: 20,
                y: 20,
                width: 180,
                height: 44,
                style: { fontFamily: 'Benim Font', fontSize: 18, fontWeight: 800 },
              },
            ],
          },
        ],
      },
      {},
      { scope: 'activity', activityId: 'act-1' }
    );

    expect(html).toContain('@font-face{font-family:"Benim Font"');
    expect(html).toContain('src:url("data:font/woff2;base64,AAAA")');
    expect(html).not.toContain('fonts.googleapis.com');
  });

  test('embeds custom font used only by ready button typography', () => {
    localStorage.setItem(
      'eicerik_custom_fonts',
      JSON.stringify([
        {
          name: 'Hazır Buton Fontu',
          dataUrl: 'data:font/woff2;base64,BBBB',
        },
      ])
    );

    const html = buildStorylinePlayerHtml(
      {
        selActId: 'typed-1',
        activities: [
          {
            id: 'typed-1',
            name: 'Typed Etkinlik',
            type: 'fill-blank',
            readyButtonFontFamily: 'Hazır Buton Fontu',
            readyButtonFontSize: 18,
            readyButtonFontWeight: 700,
            fillBlankSentence: 'Türkiye başkenti ___ şehridir.',
            fillBlankAnswers: [{ id: 'blank-0', acceptedValues: ['Ankara'] }],
          },
        ],
      },
      {},
      { scope: 'activity', activityId: 'typed-1' }
    );

    expect(html).toContain('@font-face{font-family:"Hazır Buton Fontu"');
    expect(html).toContain('src:url("data:font/woff2;base64,BBBB")');
    expect(html).toContain('"readyButtonFontFamily":"Hazır Buton Fontu"');
    expect(html).not.toContain('fonts.googleapis.com');
  });
});
