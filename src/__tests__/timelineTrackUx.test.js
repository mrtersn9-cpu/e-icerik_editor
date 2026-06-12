import { getTrackBadge } from '../features/timeline/trackBadge';
import { reorderObjectsByTrack } from '../features/timeline/trackOrder';

describe('reorderObjectsByTrack', () => {
  const objects = [
    { id: 'a', zIndex: 1 },
    { id: 'b', zIndex: 2 },
    { id: 'c', zIndex: 3 },
    { id: 'd', zIndex: 4 },
  ];

  test('kaynağı hedefin ÖNÜNE taşır (placeAfter=false)', () => {
    const next = reorderObjectsByTrack(objects, 'd', 'b', false);
    expect(next.map((o) => o.id)).toEqual(['a', 'd', 'b', 'c']);
  });

  test('kaynağı hedefin ARKASINA taşır (placeAfter=true)', () => {
    const next = reorderObjectsByTrack(objects, 'a', 'c', true);
    expect(next.map((o) => o.id)).toEqual(['b', 'c', 'a', 'd']);
  });

  test('kilitli kaynak taşınamaz', () => {
    const withLocked = [{ id: 'a', locked: true }, { id: 'b' }];
    expect(reorderObjectsByTrack(withLocked, 'a', 'b', true)).toBeNull();
  });

  test('aynı kaynak/hedef veya bilinmeyen id null döner', () => {
    expect(reorderObjectsByTrack(objects, 'a', 'a')).toBeNull();
    expect(reorderObjectsByTrack(objects, 'a', 'yok')).toBeNull();
    expect(reorderObjectsByTrack(objects, 'yok', 'a')).toBeNull();
  });

  test('girdi dizisini mutasyona uğratmaz', () => {
    const before = objects.map((o) => o.id);
    reorderObjectsByTrack(objects, 'd', 'a', false);
    expect(objects.map((o) => o.id)).toEqual(before);
  });
});

describe('getTrackBadge', () => {
  test('SVG data-url tasiyan image nesnesi "SVG" rozeti alır', () => {
    expect(
      getTrackBadge({ type: 'image', imageData: 'data:image/svg+xml;base64,AAA' }).label
    ).toBe('SVG');
  });

  test('normal resim "Resim" rozeti alır', () => {
    expect(getTrackBadge({ type: 'image', imageData: 'data:image/png;base64,AAA' }).label).toBe(
      'Resim'
    );
  });

  test('hazır buton ile özel buton ayrılır', () => {
    expect(getTrackBadge({ type: 'button', readyButtonPresetId: 'btn-blue' }).label).toBe(
      'Hazır Buton'
    );
    expect(getTrackBadge({ type: 'button', linkedHoverGroup: 'ready-check' }).label).toBe(
      'Hazır Buton'
    );
    expect(getTrackBadge({ type: 'button' }).label).toBe('Düğme');
  });

  test('sürükle-bırak öğeleri Türkçe etiket alır', () => {
    expect(getTrackBadge({ type: 'draggable' }).label).toBe('Sürüklenebilir');
    expect(getTrackBadge({ type: 'dropzone' }).label).toBe('Bırakma Alanı');
  });

  test('bilinmeyen tip "Nesne" döner', () => {
    expect(getTrackBadge({ type: 'garip' }).label).toBe('Nesne');
    expect(getTrackBadge(null).label).toBe('Nesne');
  });
});
