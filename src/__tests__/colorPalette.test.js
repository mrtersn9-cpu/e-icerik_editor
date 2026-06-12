import {
  appendRecentColor,
  normalizeHexColor,
  pushRecentColor,
  readRecentColors,
  RECENT_COLORS_MAX,
  RECENT_COLORS_STORAGE_KEY,
} from '../constants/colorPalette';

describe('normalizeHexColor', () => {
  test('geçerli 6 haneli kodu küçük harfe çevirir', () => {
    expect(normalizeHexColor('#2563EB')).toBe('#2563eb');
    expect(normalizeHexColor('  #ffffff ')).toBe('#ffffff');
  });

  test('#abc kısaltmasını #aabbcc biçimine açar', () => {
    expect(normalizeHexColor('#abc')).toBe('#aabbcc');
    expect(normalizeHexColor('#F00')).toBe('#ff0000');
  });

  test('geçersiz değerlerde boş döner', () => {
    expect(normalizeHexColor('mavi')).toBe('');
    expect(normalizeHexColor('#12345')).toBe('');
    expect(normalizeHexColor('rgb(1,2,3)')).toBe('');
    expect(normalizeHexColor('')).toBe('');
  });
});

describe('appendRecentColor', () => {
  test('yeni rengi başa ekler', () => {
    expect(appendRecentColor(['#111111'], '#222222')).toEqual(['#222222', '#111111']);
  });

  test('tekrarlanan rengi başa taşır (çift kayıt olmaz)', () => {
    expect(appendRecentColor(['#111111', '#222222'], '#222222')).toEqual([
      '#222222',
      '#111111',
    ]);
  });

  test('listeyi RECENT_COLORS_MAX ile sınırlar', () => {
    const full = Array.from({ length: RECENT_COLORS_MAX }, (_, i) =>
      `#0000${String(i).padStart(2, '0')}`
    );
    const next = appendRecentColor(full, '#ffffff');
    expect(next).toHaveLength(RECENT_COLORS_MAX);
    expect(next[0]).toBe('#ffffff');
  });

  test('geçersiz renk listeyi değiştirmez', () => {
    expect(appendRecentColor(['#111111'], 'bozuk')).toEqual(['#111111']);
  });
});

describe('localStorage tabanlı okuma/yazma', () => {
  beforeEach(() => localStorage.removeItem(RECENT_COLORS_STORAGE_KEY));

  test('push sonrası read aynı listeyi verir', () => {
    pushRecentColor('#2563eb');
    pushRecentColor('#16A34A');
    expect(readRecentColors()).toEqual(['#16a34a', '#2563eb']);
  });

  test('bozuk depolama içeriğinde boş liste döner', () => {
    localStorage.setItem(RECENT_COLORS_STORAGE_KEY, '{bozuk json');
    expect(readRecentColors()).toEqual([]);
    localStorage.setItem(RECENT_COLORS_STORAGE_KEY, '"dizi degil"');
    expect(readRecentColors()).toEqual([]);
  });
});
