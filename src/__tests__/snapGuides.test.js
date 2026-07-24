import {
  applySnapToPosition,
  calculateCenterGuides,
  calculateMarginGuides,
  calculateSnap,
  calculateSpacingGuides,
  collectSnapCandidates,
  getObjectBounds,
  getSelectionBounds,
  renderSmartGuides,
  resolveSmartGuideSnap,
} from '../logic/snapGuides';

describe('getObjectBounds / getSelectionBounds', () => {
  it('tek ögenin sınır kutusunu doğru hesaplar', () => {
    const bounds = getObjectBounds({ x: 10, y: 20, width: 100, height: 50 });
    expect(bounds).toEqual({
      left: 10,
      top: 20,
      right: 110,
      bottom: 70,
      width: 100,
      height: 50,
      centerX: 60,
      centerY: 45,
    });
  });

  it('eksik/bozuk alanları 0 kabul eder', () => {
    expect(getObjectBounds({})).toEqual({
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
      width: 0,
      height: 0,
      centerX: 0,
      centerY: 0,
    });
  });

  it('çoklu seçimin union sınır kutusunu hesaplar', () => {
    const bounds = getSelectionBounds([
      { x: 0, y: 0, width: 50, height: 50 },
      { x: 100, y: 20, width: 30, height: 30 },
    ]);
    expect(bounds.left).toBe(0);
    expect(bounds.top).toBe(0);
    expect(bounds.right).toBe(130);
    expect(bounds.bottom).toBe(50);
  });

  it('boş seçimde null döner', () => {
    expect(getSelectionBounds([])).toBeNull();
  });
});

describe('collectSnapCandidates', () => {
  const objects = [
    { id: 'a', x: 0, y: 0, width: 10, height: 10 },
    { id: 'b', x: 20, y: 0, width: 10, height: 10, locked: true },
    { id: 'c', x: 40, y: 0, width: 10, height: 10, visible: false },
    { id: 'd', x: 60, y: 0, width: 10, height: 10 },
  ];

  it('kilitli ve gizli ögeleri aday listesinden çıkarır', () => {
    const candidates = collectSnapCandidates(objects, { width: 1000, height: 1000 }, {});
    expect(candidates.map((c) => c.id).sort()).toEqual(['a', 'd']);
  });

  it('excludeIds (seçili ögeler) adaylardan çıkarılır', () => {
    const candidates = collectSnapCandidates(objects, { width: 1000, height: 1000 }, {
      excludeIds: new Set(['a']),
    });
    expect(candidates.map((c) => c.id)).toEqual(['d']);
  });
});

describe('calculateSnap — kenar/merkez hizalama', () => {
  // y=500 ile aktif ögenin (y~0) dikey aralığından kasıtlı uzak tutulur; aksi halde
  // top-top gibi bir Y eşleşmesi de kazara tetiklenip yalnız-X senaryolarını bozar.
  const candidates = [{ id: 'other', bounds: getObjectBounds({ x: 200, y: 500, width: 100, height: 100 }) }];

  it('kenar-karşı-kenar snap: aktif kutunun sağı, adayın soluna 3px mesafede', () => {
    // Aday: left=200. Aktif: right = 197 (200 - 3), left = 97, width=100.
    const active = getObjectBounds({ x: 97, y: 0, width: 100, height: 100 });
    const result = calculateSnap(active, candidates, { snapTolerance: 6 });
    expect(result.snapX).toBe(200);
    expect(result.deltaX).toBe(3);
    expect(result.snapY).toBeNull();
    expect(result.guides).toHaveLength(1);
    expect(result.guides[0].type).toBe('vertical');
  });

  it('sol-sol hizalama', () => {
    const active = getObjectBounds({ x: 202, y: 0, width: 50, height: 50 });
    const result = calculateSnap(active, candidates, { snapTolerance: 6 });
    expect(result.snapX).toBe(200);
    expect(result.deltaX).toBe(-2);
  });

  it('tolerans dışında snap olmaz', () => {
    const active = getObjectBounds({ x: 50, y: 0, width: 50, height: 50 });
    const result = calculateSnap(active, candidates, { snapTolerance: 6 });
    expect(result.snapX).toBeNull();
    expect(result.deltaX).toBe(0);
    expect(result.guides).toHaveLength(0);
  });

  it('zoom düşükken (%50) tolerans sahne biriminde büyür — daha uzak mesafede de snap olur', () => {
    // deltaX gerçek = 10 (tolerans/zoom = 6/0.5 = 12 stage-birim; 10 <= 12 olduğundan snap olmalı)
    const active = getObjectBounds({ x: 90, y: 0, width: 100, height: 100 }); // right = 190, aday left=200 -> delta 10
    const result = calculateSnap(active, candidates, { snapTolerance: 6, zoom: 0.5 });
    expect(result.snapX).toBe(200);
  });

  it('zoom yüksekken (%200) tolerans sahne biriminde küçülür — aynı mesafede artık snap olmaz', () => {
    const active = getObjectBounds({ x: 90, y: 0, width: 100, height: 100 }); // delta 10, tolerans/zoom = 6/2 = 3
    const result = calculateSnap(active, candidates, { snapTolerance: 6, zoom: 2 });
    expect(result.snapX).toBeNull();
  });

  it('objectGuides kapalıyken hiçbir şey döndürmez', () => {
    const active = getObjectBounds({ x: 97, y: 0, width: 100, height: 100 });
    const result = calculateSnap(active, candidates, { objectGuides: false });
    expect(result.snapX).toBeNull();
  });
});

describe('calculateCenterGuides — sayfa merkez çizgileri', () => {
  const canvasSize = { width: 1000, height: 800 };

  it('yalnızca X ekseninde ortalanınca dikey çizgi döner', () => {
    const active = getObjectBounds({ x: 400, y: 0, width: 200, height: 50 }); // centerX=500
    const result = calculateCenterGuides(active, canvasSize, { snapTolerance: 6 });
    expect(result.snapX).toBe(500);
    expect(result.snapY).toBeNull();
    expect(result.guides).toHaveLength(1);
  });

  it('tam ortada hem X hem Y çizgisi birlikte döner', () => {
    const active = getObjectBounds({ x: 400, y: 300, width: 200, height: 200 }); // center 500,400
    const result = calculateCenterGuides(active, canvasSize, { snapTolerance: 6 });
    expect(result.snapX).toBe(500);
    expect(result.snapY).toBe(400);
    expect(result.guides).toHaveLength(2);
  });
});

describe('calculateMarginGuides — güvenli alan', () => {
  const canvasSize = { width: 1000, height: 800 };

  it('sol margin (varsayılan 40px) yakınında snap olur', () => {
    const active = getObjectBounds({ x: 42, y: 100, width: 100, height: 100 });
    const result = calculateMarginGuides(active, canvasSize, { snapTolerance: 6, safeMargin: 40 });
    expect(result.snapX).toBe(40);
    expect(result.deltaX).toBe(-2);
  });

  it('sağ margin yakınında snap olur', () => {
    // right sınırı = cw - margin = 960; aktif right = 958
    const active = getObjectBounds({ x: 858, y: 100, width: 100, height: 100 });
    const result = calculateMarginGuides(active, canvasSize, { snapTolerance: 6, safeMargin: 40 });
    expect(result.snapX).toBe(960);
  });
});

describe('calculateSpacingGuides — eşit boşluk (3 obje)', () => {
  it('yatayda eşit boşluk tespit edilince mesafe etiketiyle çizgi üretir', () => {
    // prev: [0,100], next: [150,250]; aktif kutu tam ortada eşit 20px boşlukla: [120,150]?
    // prev right=100, next left=250. Aktif width=30 → gap eşit için: x = 100+20=120, right=150, gapAfter=250-150=100...
    // Basit ve net bir senaryo kuralım: prev right=100, next left=200, aktif width=40 ortada -> gapBefore=gapAfter=30
    const prev = { id: 'prev', bounds: getObjectBounds({ x: 0, y: 0, width: 100, height: 100 }) };
    const next = { id: 'next', bounds: getObjectBounds({ x: 200, y: 0, width: 100, height: 100 }) };
    const active = getObjectBounds({ x: 130, y: 0, width: 40, height: 100 }); // gapBefore=30, gapAfter=30
    const result = calculateSpacingGuides(active, [prev, next], { spacingTolerance: 6 });
    const horizontal = result.guides.filter((g) => g.orientation === 'horizontal');
    expect(horizontal).toHaveLength(2);
    expect(horizontal[0].distance).toBe(30);
    expect(horizontal[1].distance).toBe(30);
  });

  it('boşluklar eşit değilse çizgi üretmez', () => {
    const prev = { id: 'prev', bounds: getObjectBounds({ x: 0, y: 0, width: 100, height: 100 }) };
    const next = { id: 'next', bounds: getObjectBounds({ x: 200, y: 0, width: 100, height: 100 }) };
    const active = getObjectBounds({ x: 110, y: 0, width: 40, height: 100 }); // gapBefore=10, gapAfter=50
    const result = calculateSpacingGuides(active, [prev, next], { spacingTolerance: 6 });
    expect(result.guides).toHaveLength(0);
  });

  it('2 komşudan az olduğunda (toplam < 3 obje) çizgi üretmez', () => {
    const prev = { id: 'prev', bounds: getObjectBounds({ x: 0, y: 0, width: 100, height: 100 }) };
    const active = getObjectBounds({ x: 130, y: 0, width: 40, height: 100 });
    const result = calculateSpacingGuides(active, [prev], { spacingTolerance: 6 });
    expect(result.guides).toHaveLength(0);
  });
});

describe('applySnapToPosition', () => {
  it('deltaX/deltaY konuma eklenir', () => {
    const next = applySnapToPosition({ x: 10, y: 20 }, { deltaX: 5, deltaY: -3 });
    expect(next).toEqual({ x: 15, y: 17 });
  });

  it('snap sonucu yoksa konum değişmez', () => {
    const next = applySnapToPosition({ x: 10, y: 20 }, null);
    expect(next).toEqual({ x: 10, y: 20 });
  });
});

describe('renderSmartGuides', () => {
  it('sahne birimindeki çizgileri zoom oranıyla ekran pikseline çevirir', () => {
    const guides = [{ type: 'vertical', x: 100, y1: 0, y2: 200, source: 'object' }];
    const rendered = renderSmartGuides(guides, { scale: 0.5 });
    expect(rendered[0]).toMatchObject({ left: 50, top: 0, width: 1, height: 100 });
  });
});

describe('resolveSmartGuideSnap — kilitli/gizli obje dışlama ve kategori birleşimi', () => {
  it('kilitli/gizli objeler collectSnapCandidates ile zaten dışlandığı için snap etkilemez', () => {
    const objects = [
      { id: 'locked', x: 200, y: 0, width: 100, height: 100, locked: true },
      { id: 'hidden', x: 200, y: 0, width: 100, height: 100, visible: false },
    ];
    const canvasSize = { width: 1000, height: 800 };
    const candidates = collectSnapCandidates(objects, canvasSize, {});
    const active = getObjectBounds({ x: 97, y: 0, width: 100, height: 100 });
    const result = resolveSmartGuideSnap(active, { candidates, canvasSize, settings: { snapTolerance: 6 } });
    // Kilitli/gizli obje aday olmadığından objectGuides eşleşmesi olmamalı; ama aktif kutu
    // sayfa merkezine/margine de denk gelmiyor, dolayısıyla hiçbir eksende snap olmamalı.
    expect(result.snapX).toBeNull();
  });

  it('snapEnabled false iken guides döner ama delta uygulanmaz', () => {
    const candidates = [{ id: 'other', bounds: getObjectBounds({ x: 200, y: 0, width: 100, height: 100 }) }];
    const active = getObjectBounds({ x: 97, y: 0, width: 100, height: 100 });
    const result = resolveSmartGuideSnap(active, {
      candidates,
      canvasSize: { width: 1000, height: 800 },
      settings: { snapTolerance: 6, snapEnabled: false },
    });
    expect(result.deltaX).toBe(0);
    expect(result.guides.length).toBeGreaterThan(0);
  });
});
