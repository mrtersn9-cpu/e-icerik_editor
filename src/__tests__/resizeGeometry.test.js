import {
  computeResizeRect,
  computeSelectionScaledRects,
  getResizeAnchor,
  getSnapshotBounds,
} from '../logic/resizeGeometry';

const START = { x: 100, y: 100, width: 200, height: 100 };

describe('computeResizeRect — modifier\'sız temel davranış', () => {
  it('doğu tutamacı genişliği artırır, konum sabit', () => {
    const next = computeResizeRect(START, 'e', 50, 0);
    expect(next).toEqual({ x: 100, y: 100, width: 250, height: 100 });
  });

  it('batı tutamacı x ve genişliği günceller (sağ kenar sabit)', () => {
    const next = computeResizeRect(START, 'w', -40, 0);
    expect(next.x).toBe(60);
    expect(next.width).toBe(240);
    expect(next.x + next.width).toBe(300); // sağ kenar sabit
  });

  it('kuzey tutamacı y ve yüksekliği günceller (alt kenar sabit)', () => {
    const next = computeResizeRect(START, 'n', 0, -30);
    expect(next.y).toBe(70);
    expect(next.height).toBe(130);
    expect(next.y + next.height).toBe(200);
  });

  it('güneydoğu köşesi iki ekseni birden boyutlandırır', () => {
    const next = computeResizeRect(START, 'se', 20, 40);
    expect(next.width).toBe(220);
    expect(next.height).toBe(140);
  });

  it('minimum boyut kelepçesi uygulanır', () => {
    const next = computeResizeRect(START, 'e', -500, 0, { min: 30 });
    expect(next.width).toBe(30);
  });
});

describe('computeResizeRect — Shift (orantılı)', () => {
  it('doğu tutamacında oran korunur', () => {
    const next = computeResizeRect(START, 'e', 100, 0, { shift: true });
    expect(next.width).toBe(300);
    expect(next.height).toBe(150); // 2:1 oran
    expect(next.x).toBe(100);
    expect(next.y).toBe(100);
  });

  it('batı tutamacında sağ kenar sabit kalır', () => {
    const next = computeResizeRect(START, 'w', -100, 0, { shift: true });
    expect(next.width).toBe(300);
    expect(next.height).toBe(150);
    expect(next.x + next.width).toBe(300);
  });
});

describe('computeResizeRect — Alt (merkez sabit simetrik)', () => {
  it('doğu tutamacında her iki kenar genişler, merkez sabit', () => {
    const next = computeResizeRect(START, 'e', 30, 0, { alt: true });
    expect(next.width).toBe(260); // 200 + 2*30
    expect(next.x).toBe(70); // merkez 200'de sabit
    expect(next.x + next.width / 2).toBe(200);
    expect(next.y).toBe(100);
    expect(next.height).toBe(100);
  });

  it('batı tutamacında içe çekince simetrik daralır', () => {
    const next = computeResizeRect(START, 'w', 20, 0, { alt: true });
    expect(next.width).toBe(160); // 200 - 2*20
    expect(next.x + next.width / 2).toBe(200);
  });

  it('kuzey tutamacında dikey simetrik büyür', () => {
    const next = computeResizeRect(START, 'n', 0, -25, { alt: true });
    expect(next.height).toBe(150); // 100 + 2*25
    expect(next.y + next.height / 2).toBe(150); // merkez sabit
  });

  it('Shift+Alt: oran korunur ve merkez sabit kalır', () => {
    const next = computeResizeRect(START, 'e', 50, 0, { alt: true, shift: true });
    expect(next.width).toBe(300); // 200 + 2*50
    expect(next.height).toBe(150); // 2:1 oran
    expect(next.x + next.width / 2).toBe(200);
    expect(next.y + next.height / 2).toBe(150);
  });

  it('Alt modunda da minimum kelepçesi çalışır', () => {
    const next = computeResizeRect(START, 'e', -200, 0, { alt: true, min: 30 });
    expect(next.width).toBe(30);
  });
});

describe('getSnapshotBounds / getResizeAnchor', () => {
  const snapshot = {
    a: { x: 0, y: 0, width: 100, height: 50 },
    b: { x: 200, y: 100, width: 100, height: 50 },
  };

  it('snapshot sınır kutusunu hesaplar', () => {
    expect(getSnapshotBounds(snapshot)).toEqual({ left: 0, top: 0, right: 300, bottom: 150 });
  });

  it('ankraj tutamacın karşı köşesidir', () => {
    const bounds = getSnapshotBounds(snapshot);
    expect(getResizeAnchor(bounds, 'se')).toEqual({ x: 0, y: 0 });
    expect(getResizeAnchor(bounds, 'nw')).toEqual({ x: 300, y: 150 });
    expect(getResizeAnchor(bounds, 'e')).toEqual({ x: 0, y: 0 });
    expect(getResizeAnchor(bounds, 'n')).toEqual({ x: 0, y: 150 });
  });

  it('Alt modunda ankraj seçim merkezidir', () => {
    const bounds = getSnapshotBounds(snapshot);
    expect(getResizeAnchor(bounds, 'se', true)).toEqual({ x: 150, y: 75 });
  });
});

describe('computeSelectionScaledRects — çoklu seçim orantılı ölçekleme', () => {
  it('tüm dikdörtgenler ankraj etrafında aynı oranla ölçeklenir', () => {
    const snapshot = {
      a: { x: 0, y: 0, width: 100, height: 100 },
      b: { x: 200, y: 0, width: 100, height: 100 },
    };
    const rects = computeSelectionScaledRects(
      snapshot,
      { x: 2, y: 2 },
      { x: 0, y: 0 }
    );
    expect(rects.a).toEqual({ x: 0, y: 0, width: 200, height: 200 });
    expect(rects.b).toEqual({ x: 400, y: 0, width: 200, height: 200 });
  });

  it('küçültmede minimum boyut kelepçesi uygulanır', () => {
    const snapshot = { a: { x: 0, y: 0, width: 40, height: 40 } };
    const rects = computeSelectionScaledRects(snapshot, { x: 0.5, y: 0.5 }, { x: 0, y: 0 }, 30);
    expect(rects.a.width).toBe(30);
    expect(rects.a.height).toBe(30);
  });

  it('geçersiz ölçek faktörü 1 kabul edilir', () => {
    const snapshot = { a: { x: 10, y: 10, width: 50, height: 50 } };
    const rects = computeSelectionScaledRects(snapshot, { x: 0, y: NaN }, { x: 0, y: 0 });
    expect(rects.a).toEqual({ x: 10, y: 10, width: 50, height: 50 });
  });
});
