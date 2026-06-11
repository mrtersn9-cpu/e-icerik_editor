import {
  collectExternalMediaUrls,
  inlineExternalMediaForActivity,
  inlineExternalMediaForExport,
} from '../utils/scormMediaInline';

// Çevrimdışı SCORM: harici (http/https) medya alanları dışa aktarım öncesi
// data URL'e çevrilir; web embed/openUrl gibi gerçek bağlantılara dokunulmaz.

function buildState() {
  return {
    activities: [
      {
        id: 'act-1',
        objects: [
          { id: 'img-1', type: 'image', imageData: 'http://ornek.com/resim.png' },
          { id: 'aud-1', type: 'audio', mediaUrl: 'http://ornek.com/ses.mp3' },
          // Aynı URL ikinci kez: tek fetch ile ikisine de yazılmalı.
          { id: 'aud-2', type: 'audio', mediaUrl: 'http://ornek.com/ses.mp3' },
          // Zaten gömülü — dokunulmaz.
          { id: 'img-2', type: 'image', imageData: 'data:image/png;base64,AAA' },
          // Göreli yol — dokunulmaz.
          { id: 'img-3', type: 'image', imageData: '/static/uploads/yerel.png' },
          // Web embed — kapsam DIŞI, dokunulmaz.
          { id: 'web-1', type: 'web-embed', embedUrl: 'https://ornek.com/sayfa' },
        ],
        answerControl: { livesEnabled: true, livesCustomImage: 'https://ornek.com/kalp.png' },
      },
    ],
  };
}

function mockFetchSuccess() {
  return jest.fn(async () => ({
    ok: true,
    blob: async () => new Blob(['icerik'], { type: 'image/png' }),
  }));
}

describe('collectExternalMediaUrls', () => {
  test('yalnızca medya alanlarındaki http(s) URL leri bulur', () => {
    const urls = collectExternalMediaUrls(buildState());
    expect(urls).toEqual(
      expect.arrayContaining([
        'http://ornek.com/resim.png',
        'http://ornek.com/ses.mp3',
        'https://ornek.com/kalp.png',
      ])
    );
    expect(urls).toHaveLength(3);
    expect(urls).not.toContain('https://ornek.com/sayfa');
  });
});

describe('inlineExternalMediaForExport', () => {
  afterEach(() => {
    delete global.fetch;
  });

  test('http medya data URL e gömülür; data/göreli/embed dokunulmaz; tek fetch', async () => {
    global.fetch = mockFetchSuccess();
    const { state, inlined, failed } = await inlineExternalMediaForExport(buildState());
    const objects = state.activities[0].objects;
    const byId = Object.fromEntries(objects.map((o) => [o.id, o]));

    expect(byId['img-1'].imageData).toMatch(/^data:image\/png;base64,/);
    expect(byId['aud-1'].mediaUrl).toMatch(/^data:/);
    expect(byId['aud-2'].mediaUrl).toMatch(/^data:/);
    expect(state.activities[0].answerControl.livesCustomImage).toMatch(/^data:/);
    // Dokunulmayanlar:
    expect(byId['img-2'].imageData).toBe('data:image/png;base64,AAA');
    expect(byId['img-3'].imageData).toBe('/static/uploads/yerel.png');
    expect(byId['web-1'].embedUrl).toBe('https://ornek.com/sayfa');

    expect(inlined).toHaveLength(3);
    expect(failed).toHaveLength(0);
    // Aynı URL (ses.mp3 x2) tek kez indirilir: 3 benzersiz URL → 3 fetch.
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  test('indirme hatasında orijinal URL korunur ve failed listesine düşer', async () => {
    global.fetch = jest.fn(async (url) =>
      String(url).includes('ses.mp3')
        ? { ok: false, status: 404, blob: async () => new Blob([]) }
        : { ok: true, blob: async () => new Blob(['icerik'], { type: 'image/png' }) }
    );
    const { state, inlined, failed } = await inlineExternalMediaForExport(buildState());
    const byId = Object.fromEntries(state.activities[0].objects.map((o) => [o.id, o]));

    expect(byId['aud-1'].mediaUrl).toBe('http://ornek.com/ses.mp3');
    expect(failed).toHaveLength(1);
    expect(failed[0].url).toBe('http://ornek.com/ses.mp3');
    expect(inlined).toHaveLength(2);
  });

  test('kaynak state mutate edilmez', async () => {
    global.fetch = mockFetchSuccess();
    const original = buildState();
    await inlineExternalMediaForExport(original);
    expect(original.activities[0].objects[0].imageData).toBe('http://ornek.com/resim.png');
  });
});

describe('inlineExternalMediaForActivity', () => {
  afterEach(() => {
    delete global.fetch;
  });

  test('tekil etkinlikte medya gömer (TTKB Düzelt eylemi)', async () => {
    global.fetch = mockFetchSuccess();
    const activity = buildState().activities[0];
    const { activity: fixed, inlined } = await inlineExternalMediaForActivity(activity);
    expect(fixed.objects[0].imageData).toMatch(/^data:/);
    expect(fixed.answerControl.livesCustomImage).toMatch(/^data:/);
    expect(inlined).toHaveLength(3);
  });
});
