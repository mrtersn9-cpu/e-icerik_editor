import {
  isSystemClipboardSupported,
  writeObjectClipboardToSystem,
  readObjectClipboardFromSystem,
  hasPasteableObjectClipboard,
} from '../utils/systemClipboard';

function mockClipboard(overrides = {}) {
  const clipboard = {
    writeText: jest.fn().mockResolvedValue(undefined),
    readText: jest.fn().mockResolvedValue(''),
    ...overrides,
  };
  Object.defineProperty(global.navigator, 'clipboard', {
    value: clipboard,
    configurable: true,
  });
  return clipboard;
}

function clearClipboard() {
  Object.defineProperty(global.navigator, 'clipboard', {
    value: undefined,
    configurable: true,
  });
}

describe('systemClipboard', () => {
  afterEach(() => {
    clearClipboard();
  });

  test('isSystemClipboardSupported reflects navigator.clipboard availability', () => {
    clearClipboard();
    expect(isSystemClipboardSupported()).toBe(false);
    mockClipboard();
    expect(isSystemClipboardSupported()).toBe(true);
  });

  test('writeObjectClipboardToSystem yazar ve marker ekler', async () => {
    const clipboard = mockClipboard();
    const payload = { objects: [{ id: 'o1' }], timeline: [], copiedAt: 123 };
    await writeObjectClipboardToSystem(payload);
    expect(clipboard.writeText).toHaveBeenCalledTimes(1);
    const written = JSON.parse(clipboard.writeText.mock.calls[0][0]);
    expect(written.__eicerik).toBe('eicerik-object-clipboard-v1');
    expect(written.objects).toEqual(payload.objects);
  });

  test('writeObjectClipboardToSystem boş nesne listesinde hiçbir şey yazmaz', async () => {
    const clipboard = mockClipboard();
    await writeObjectClipboardToSystem({ objects: [], timeline: [] });
    expect(clipboard.writeText).not.toHaveBeenCalled();
  });

  test('writeObjectClipboardToSystem izin hatasında sessizce başarısız olur', async () => {
    const clipboard = mockClipboard({ writeText: jest.fn().mockRejectedValue(new Error('denied')) });
    await expect(
      writeObjectClipboardToSystem({ objects: [{ id: 'o1' }] })
    ).resolves.toBeUndefined();
    expect(clipboard.writeText).toHaveBeenCalledTimes(1);
  });

  test('readObjectClipboardFromSystem geçerli işaretli veriyi döner', async () => {
    mockClipboard({
      readText: jest.fn().mockResolvedValue(
        JSON.stringify({
          __eicerik: 'eicerik-object-clipboard-v1',
          objects: [{ id: 'o1' }],
          timeline: [],
          copiedAt: 999,
        })
      ),
    });
    const result = await readObjectClipboardFromSystem();
    expect(result).toEqual({ objects: [{ id: 'o1' }], timeline: [], copiedAt: 999 });
  });

  test('readObjectClipboardFromSystem işaretsiz düz metinde null döner', async () => {
    mockClipboard({ readText: jest.fn().mockResolvedValue('kullanıcının kopyaladığı sıradan metin') });
    const result = await readObjectClipboardFromSystem();
    expect(result).toBeNull();
  });

  test('readObjectClipboardFromSystem farklı bir JSON nesnesinde (marker yok) null döner', async () => {
    mockClipboard({ readText: jest.fn().mockResolvedValue(JSON.stringify({ foo: 'bar' })) });
    const result = await readObjectClipboardFromSystem();
    expect(result).toBeNull();
  });

  test('readObjectClipboardFromSystem boş objects dizisinde null döner', async () => {
    mockClipboard({
      readText: jest
        .fn()
        .mockResolvedValue(JSON.stringify({ __eicerik: 'eicerik-object-clipboard-v1', objects: [] })),
    });
    const result = await readObjectClipboardFromSystem();
    expect(result).toBeNull();
  });

  test('readObjectClipboardFromSystem izin reddinde throw etmez, null döner', async () => {
    mockClipboard({ readText: jest.fn().mockRejectedValue(new Error('permission denied')) });
    const result = await readObjectClipboardFromSystem();
    expect(result).toBeNull();
  });

  test('readObjectClipboardFromSystem API yokken null döner', async () => {
    clearClipboard();
    const result = await readObjectClipboardFromSystem();
    expect(result).toBeNull();
  });

  describe('hasPasteableObjectClipboard', () => {
    // Bu regresyon testi, "Canva'daki gibi başka bir projeye/sekmeye yapıştıramıyorum"
    // şikayetinin kök nedenini kapsar: sistem panosu API'si (navigator.clipboard)
    // destekleniyorsa "Yapıştır" giriş noktaları (sağ tık menüsü, Ribbon düğmesi) HER
    // ZAMAN etkin kalmalı — yeni bir sekmede/projede bu sekmenin yerel panosu (ref/
    // sessionStorage) boş olsa bile, çünkü asıl veri tıklanınca sistem panosundan
    // senkron okunur (readObjectClipboardFromSystem). Aksi halde menü öğesi hep gri
    // kalır ve kullanıcı hiçbir zaman yapıştıramaz.
    test('sistem panosu destekleniyorsa yerel pano boş olsa bile true döner (farklı proje/sekme senaryosu)', () => {
      mockClipboard();
      expect(hasPasteableObjectClipboard(false)).toBe(true);
      expect(hasPasteableObjectClipboard(0)).toBe(true);
      expect(hasPasteableObjectClipboard(undefined)).toBe(true);
    });

    test('sistem panosu destekleniyorsa yerel pano doluyken de true döner', () => {
      mockClipboard();
      expect(hasPasteableObjectClipboard(true)).toBe(true);
    });

    test('sistem panosu desteklenmiyorsa yalnızca yerel panoya bakar', () => {
      clearClipboard();
      expect(hasPasteableObjectClipboard(true)).toBe(true);
      expect(hasPasteableObjectClipboard(false)).toBe(false);
      expect(hasPasteableObjectClipboard(0)).toBe(false);
      expect(hasPasteableObjectClipboard(undefined)).toBe(false);
    });
  });
});
