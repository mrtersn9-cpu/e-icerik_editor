// Akıllı hizalama / snap sistemi — saf fonksiyonlar (unit test edilebilir, DOM'a bağımlı değil).
// StageCanvas'taki drag/resize akışı bu modülü kullanır: kenar-kenar hizalama, sayfa merkez
// çizgileri, güvenli alan (margin) çizgileri ve eşit-boşluk (spacing) çizgileri.
//
// Tasarım notu: "enabled" (genel akıllı hizalama aç/kapa) ve her kategori bayrağı
// (objectGuides/centerGuides/marginGuides/spacingGuides) çizgilerin HESAPLANIP
// HESAPLANMAYACAĞINI belirler. "snapEnabled" ise yalnızca sonucun GERÇEK KONUM
// KAYMASINA (delta) uygulanıp uygulanmayacağını belirler — bu ayrım kasıtlı: kullanıcı
// "snap"i kapatıp yalnızca hizalama çizgilerini görsel referans olarak açık tutabilsin
// (bkz. görev tarifi madde 7'deki ayrı "snap aç/kapa" ve "merkez çizgileri aç/kapa"
// anahtarları). Bu yüzden calculateSnap/calculateCenterGuides/calculateMarginGuides
// snapEnabled'ı KENDİLERİ kontrol etmez — çağıran taraf (StageCanvas) deltaX/deltaY'yi
// uygulayıp uygulamayacağına snapEnabled'a bakarak karar verir; guides listesi her
// durumda (snapEnabled kapalıyken de) döner.

export const DEFAULT_SMART_GUIDE_SETTINGS = {
  enabled: true,
  snapEnabled: true,
  objectGuides: true,
  centerGuides: true,
  marginGuides: true,
  spacingGuides: true,
  showSafeAreaAlways: false,
  snapTolerance: 6,
  spacingTolerance: 6,
  safeMargin: 40,
};

// Ayarları varsayılanlarla birleştirir; eksik/bozuk alanlar sessizce varsayılana döner.
export function normalizeSmartGuideSettings(raw) {
  return { ...DEFAULT_SMART_GUIDE_SETTINGS, ...(raw || {}) };
}

// Toleransı zoom'a göre normalize eder: ekranda hep ~tolerance px görünsün diye
// sahne biriminde tolerans = tolerance / zoom (zoom yoksa/1 ise değişmez).
function resolveZoomTolerance(cfg, key) {
  const base = Number(cfg[key]);
  const tolerance = Number.isFinite(base) ? base : DEFAULT_SMART_GUIDE_SETTINGS[key];
  const zoom = Number(cfg.zoom) > 0 ? Number(cfg.zoom) : 1;
  return tolerance / zoom;
}

function resolveTolerance(cfg) {
  return resolveZoomTolerance(cfg, 'snapTolerance');
}

function resolveSpacingTolerance(cfg) {
  return resolveZoomTolerance(cfg, 'spacingTolerance');
}

// Tek bir ögenin sınır kutusu: {left, top, right, bottom, width, height, centerX, centerY}.
export function getObjectBounds(object) {
  const x = Number(object?.x) || 0;
  const y = Number(object?.y) || 0;
  const width = Math.max(0, Number(object?.width) || 0);
  const height = Math.max(0, Number(object?.height) || 0);
  return {
    left: x,
    top: y,
    right: x + width,
    bottom: y + height,
    width,
    height,
    centerX: x + width / 2,
    centerY: y + height / 2,
  };
}

// Çoklu seçimin ortak (union) sınır kutusu. Boş/geçersiz girdide null döner.
export function getSelectionBounds(selectedObjects) {
  const list = Array.isArray(selectedObjects) ? selectedObjects.filter(Boolean) : [];
  if (!list.length) return null;
  const boundsList = list.map((item) => getObjectBounds(item));
  const left = Math.min(...boundsList.map((b) => b.left));
  const top = Math.min(...boundsList.map((b) => b.top));
  const right = Math.max(...boundsList.map((b) => b.right));
  const bottom = Math.max(...boundsList.map((b) => b.bottom));
  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
    centerX: (left + right) / 2,
    centerY: (top + bottom) / 2,
  };
}

// Snap adayı ögeleri toplar: görünür + kilitsiz + hariç tutulan id'ler (seçili ögeler)
// dışındakiler. canvasSize verilirse çok geniş pasteboard'larda sahneden aşırı uzak
// ögeleri erken eler (performans — 500+ ögeli sahnelerde her pointermove'da tüm
// listeyi taramamak için StageCanvas bunu drag BAŞLANGICINDA bir kez çağırıp
// sonucu cache'ler, aday ögelerin konumu drag sırasında değişmediği için güvenlidir).
export function collectSnapCandidates(objects = [], canvasSize = {}, settings = {}) {
  const excludeIds =
    settings.excludeIds instanceof Set ? settings.excludeIds : new Set(settings.excludeIds || []);
  const list = Array.isArray(objects) ? objects : [];
  const cw = Number(canvasSize.width) || 0;
  const ch = Number(canvasSize.height) || 0;
  const hasCanvasSize = cw > 0 || ch > 0;
  const pad = Math.max(cw, ch, 1) * 2;
  const minX = -pad;
  const maxX = cw + pad;
  const minY = -pad;
  const maxY = ch + pad;
  const result = [];
  for (const item of list) {
    if (!item || item.visible === false || item.locked || excludeIds.has(item.id)) continue;
    const bounds = getObjectBounds(item);
    if (
      hasCanvasSize &&
      (bounds.right < minX || bounds.left > maxX || bounds.bottom < minY || bounds.top > maxY)
    ) {
      continue;
    }
    result.push({ id: item.id, bounds });
  }
  return result;
}

// 500+ objeli sahnelerde her karede tüm adayları taramamak için basit bir mesafe
// ön-filtresi: aktif kutuya çok uzak adaylar elenir. Küçük listelerde (eşik altı)
// dokunulmaz — davranış/test sonucu değişmez, yalnız büyük sahnelerde devreye girer.
const NEARBY_PREFILTER_THRESHOLD = 80;
const NEARBY_PREFILTER_RADIUS = 2000;

function distanceToBounds(active, bounds) {
  const dx = Math.max(bounds.left - active.right, active.left - bounds.right, 0);
  const dy = Math.max(bounds.top - active.bottom, active.top - bounds.bottom, 0);
  return Math.hypot(dx, dy);
}

function filterNearbyCandidates(activeBounds, candidates, maxDistance) {
  if (candidates.length <= NEARBY_PREFILTER_THRESHOLD) return candidates;
  if (!Number.isFinite(maxDistance) || maxDistance <= 0) return candidates;
  return candidates.filter((c) => distanceToBounds(activeBounds, c.bounds) <= maxDistance);
}

const GUIDE_PADDING = 24;

// X ekseni (dikey çizgi üreten) eşleşme çiftleri: [aktif-kenar, aday-kenar].
// Sol-sol/sağ-sağ/merkez-merkez hizalama + kenar-karşı-kenar (sol↔sağ) snap.
const X_PAIRS = [
  ['left', 'left'],
  ['right', 'right'],
  ['centerX', 'centerX'],
  ['left', 'right'],
  ['right', 'left'],
];
// Y ekseni (yatay çizgi üreten) eşleşme çiftleri.
const Y_PAIRS = [
  ['top', 'top'],
  ['bottom', 'bottom'],
  ['centerY', 'centerY'],
  ['top', 'bottom'],
  ['bottom', 'top'],
];

function edgeAllowed(activeKey, activeEdgeFilter) {
  if (!activeEdgeFilter) return true;
  return activeKey === activeEdgeFilter;
}

// Diğer ögelerin kenarlarına/merkezine göre snap hesaplar. X ve Y ekseninde AYRI AYRI
// en iyi (en küçük mesafeli) eşleşme seçilir. settings.activeEdges = {x, y} verilirse
// (resize sırasında) yalnız o eksendeki belirli aktif-kenar taraflı çiftler değerlendirilir
// (örn. batı tutamacıyla resize'da yalnız 'left' aktif kenar aday alınır).
export function calculateSnap(activeBounds, candidates = [], settings = {}) {
  const cfg = normalizeSmartGuideSettings(settings);
  const empty = { snapX: null, snapY: null, deltaX: 0, deltaY: 0, guides: [] };
  if (!activeBounds || !cfg.enabled || !cfg.objectGuides) return empty;

  const tolerance = resolveTolerance(cfg);
  const activeEdges = cfg.activeEdges || {};
  const candList = filterNearbyCandidates(activeBounds, candidates, NEARBY_PREFILTER_RADIUS);

  let bestX = null;
  let bestY = null;

  for (const candidate of candList) {
    if (!candidate?.bounds) continue;
    for (const [activeKey, otherKey] of X_PAIRS) {
      if (!edgeAllowed(activeKey, activeEdges.x)) continue;
      const delta = candidate.bounds[otherKey] - activeBounds[activeKey];
      if (Math.abs(delta) <= tolerance && (!bestX || Math.abs(delta) < Math.abs(bestX.delta))) {
        bestX = { delta, value: candidate.bounds[otherKey], candidate };
      }
    }
    for (const [activeKey, otherKey] of Y_PAIRS) {
      if (!edgeAllowed(activeKey, activeEdges.y)) continue;
      const delta = candidate.bounds[otherKey] - activeBounds[activeKey];
      if (Math.abs(delta) <= tolerance && (!bestY || Math.abs(delta) < Math.abs(bestY.delta))) {
        bestY = { delta, value: candidate.bounds[otherKey], candidate };
      }
    }
  }

  const guides = [];
  if (bestX) {
    const top = Math.min(activeBounds.top, bestX.candidate.bounds.top) - GUIDE_PADDING;
    const bottom = Math.max(activeBounds.bottom, bestX.candidate.bounds.bottom) + GUIDE_PADDING;
    guides.push({
      type: 'vertical',
      x: bestX.value,
      y1: top,
      y2: bottom,
      source: 'object',
      objectId: bestX.candidate.id,
    });
  }
  if (bestY) {
    const left = Math.min(activeBounds.left, bestY.candidate.bounds.left) - GUIDE_PADDING;
    const right = Math.max(activeBounds.right, bestY.candidate.bounds.right) + GUIDE_PADDING;
    guides.push({
      type: 'horizontal',
      y: bestY.value,
      x1: left,
      x2: right,
      source: 'object',
      objectId: bestY.candidate.id,
    });
  }

  return {
    snapX: bestX ? bestX.value : null,
    snapY: bestY ? bestY.value : null,
    deltaX: bestX ? bestX.delta : 0,
    deltaY: bestY ? bestY.delta : 0,
    guides,
  };
}

// Sayfanın dikey/yatay orta çizgisi: objenin (veya seçim bounding box'ının) merkezi
// sayfa merkeziyle hizalanınca. X ve Y bağımsız değerlendirilir — tam ortadaysa ikisi
// birden döner.
export function calculateCenterGuides(activeBounds, canvasSize = {}, settings = {}) {
  const cfg = normalizeSmartGuideSettings(settings);
  const empty = { snapX: null, snapY: null, deltaX: 0, deltaY: 0, guides: [] };
  if (!activeBounds || !cfg.enabled || !cfg.centerGuides) return empty;

  const tolerance = resolveTolerance(cfg);
  const cw = Number(canvasSize.width) || 0;
  const ch = Number(canvasSize.height) || 0;
  const guides = [];
  let snapX = null;
  let deltaX = 0;
  let snapY = null;
  let deltaY = 0;

  if (cw > 0) {
    const pageCenterX = cw / 2;
    const dx = pageCenterX - activeBounds.centerX;
    if (Math.abs(dx) <= tolerance) {
      snapX = pageCenterX;
      deltaX = dx;
      guides.push({ type: 'vertical', x: pageCenterX, y1: 0, y2: ch, source: 'center' });
    }
  }
  if (ch > 0) {
    const pageCenterY = ch / 2;
    const dy = pageCenterY - activeBounds.centerY;
    if (Math.abs(dy) <= tolerance) {
      snapY = pageCenterY;
      deltaY = dy;
      guides.push({ type: 'horizontal', y: pageCenterY, x1: 0, x2: cw, source: 'center' });
    }
  }

  return { snapX, snapY, deltaX, deltaY, guides };
}

// Kenar boşluğu / güvenli alan çizgileri: sol/sağ/üst/alt margin'e yaklaşınca snap.
// settings.activeEdges ile (resize sırasında) yalnız ilgili kenar değerlendirilir.
export function calculateMarginGuides(activeBounds, canvasSize = {}, settings = {}) {
  const cfg = normalizeSmartGuideSettings(settings);
  const empty = { snapX: null, snapY: null, deltaX: 0, deltaY: 0, guides: [] };
  if (!activeBounds || !cfg.enabled || !cfg.marginGuides) return empty;

  const tolerance = resolveTolerance(cfg);
  const cw = Number(canvasSize.width) || 0;
  const ch = Number(canvasSize.height) || 0;
  const margin = Math.max(0, Number(cfg.safeMargin) || 0);
  const activeEdges = cfg.activeEdges || {};

  const xCandidates = [
    { activeKey: 'left', value: margin },
    { activeKey: 'right', value: cw - margin },
  ].filter((c) => edgeAllowed(c.activeKey, activeEdges.x));
  const yCandidates = [
    { activeKey: 'top', value: margin },
    { activeKey: 'bottom', value: ch - margin },
  ].filter((c) => edgeAllowed(c.activeKey, activeEdges.y));

  let bestX = null;
  let bestY = null;
  for (const c of xCandidates) {
    const delta = c.value - activeBounds[c.activeKey];
    if (Math.abs(delta) <= tolerance && (!bestX || Math.abs(delta) < Math.abs(bestX.delta))) {
      bestX = { delta, value: c.value };
    }
  }
  for (const c of yCandidates) {
    const delta = c.value - activeBounds[c.activeKey];
    if (Math.abs(delta) <= tolerance && (!bestY || Math.abs(delta) < Math.abs(bestY.delta))) {
      bestY = { delta, value: c.value };
    }
  }

  const guides = [];
  if (bestX) guides.push({ type: 'vertical', x: bestX.value, y1: 0, y2: ch, source: 'margin' });
  if (bestY) guides.push({ type: 'horizontal', y: bestY.value, x1: 0, x2: cw, source: 'margin' });

  return {
    snapX: bestX ? bestX.value : null,
    snapY: bestY ? bestY.value : null,
    deltaX: bestX ? bestX.delta : 0,
    deltaY: bestY ? bestY.delta : 0,
    guides,
  };
}

// "Güvenli Alanı Göster" sürekli-görünür modu: yaklaşma şartı olmadan 4 margin
// çizgisini her zaman döner (drag/resize dışında da render edilebilir).
export function calculateSafeAreaGuides(canvasSize = {}, settings = {}) {
  const cfg = normalizeSmartGuideSettings(settings);
  if (!cfg.enabled || !cfg.marginGuides || !cfg.showSafeAreaAlways) return [];
  const cw = Number(canvasSize.width) || 0;
  const ch = Number(canvasSize.height) || 0;
  const margin = Math.max(0, Number(cfg.safeMargin) || 0);
  return [
    { type: 'vertical', x: margin, y1: 0, y2: ch, source: 'margin' },
    { type: 'vertical', x: cw - margin, y1: 0, y2: ch, source: 'margin' },
    { type: 'horizontal', y: margin, x1: 0, x2: cw, source: 'margin' },
    { type: 'horizontal', y: ch - margin, x1: 0, x2: cw, source: 'margin' },
  ];
}

// Aynı "satırda" (dikey aralığı örtüşen), aktif kutunun soluna/sağına en yakın komşuları.
function findRowNeighbors(activeBounds, rowEntries) {
  let prev = null;
  let next = null;
  for (const entry of rowEntries) {
    if (entry.bounds.right <= activeBounds.left) {
      if (!prev || entry.bounds.right > prev.bounds.right) prev = entry;
    } else if (entry.bounds.left >= activeBounds.right) {
      if (!next || entry.bounds.left < next.bounds.left) next = entry;
    }
  }
  return { prev, next };
}

// Aynı "sütunda" (yatay aralığı örtüşen), aktif kutunun üstüne/altına en yakın komşuları.
function findColumnNeighbors(activeBounds, columnEntries) {
  let prev = null;
  let next = null;
  for (const entry of columnEntries) {
    if (entry.bounds.bottom <= activeBounds.top) {
      if (!prev || entry.bounds.bottom > prev.bounds.bottom) prev = entry;
    } else if (entry.bounds.top >= activeBounds.bottom) {
      if (!next || entry.bounds.top < next.bounds.top) next = entry;
    }
  }
  return { prev, next };
}

// En az 3 obje (aktif + iki komşu) olduğunda, aralarındaki boşluk eşitlenince
// (yatay VE dikey, bağımsız) boşluk çizgisi + mesafe bilgisini döner. Yalnızca konum
// tespiti yapar, deltaX/deltaY UYGULAMAZ (yalnız görsel + bilgi amaçlı).
export function calculateSpacingGuides(activeBounds, objects = [], settings = {}) {
  const cfg = normalizeSmartGuideSettings(settings);
  const empty = { guides: [] };
  if (!activeBounds || !cfg.enabled || !cfg.spacingGuides) return empty;

  const tolerance = resolveSpacingTolerance(cfg);
  const entries = (Array.isArray(objects) ? objects : [])
    .map((item) => (item && item.bounds ? item : { id: item?.id, bounds: getObjectBounds(item) }))
    .filter((entry) => entry?.bounds);
  if (entries.length < 2) return empty;

  const guides = [];

  const rowEntries = entries
    .filter((e) => e.bounds.top < activeBounds.bottom && e.bounds.bottom > activeBounds.top)
    .sort((a, b) => a.bounds.left - b.bounds.left);
  const { prev: rowPrev, next: rowNext } = findRowNeighbors(activeBounds, rowEntries);
  if (rowPrev && rowNext) {
    const gapBefore = activeBounds.left - rowPrev.bounds.right;
    const gapAfter = rowNext.bounds.left - activeBounds.right;
    if (gapBefore >= 0 && gapAfter >= 0 && Math.abs(gapBefore - gapAfter) <= tolerance) {
      const distance = Math.round((gapBefore + gapAfter) / 2);
      const midY =
        (Math.max(rowPrev.bounds.top, activeBounds.top, rowNext.bounds.top) +
          Math.min(rowPrev.bounds.bottom, activeBounds.bottom, rowNext.bounds.bottom)) /
        2;
      guides.push({
        type: 'spacing',
        orientation: 'horizontal',
        distance,
        y: midY,
        x1: rowPrev.bounds.right,
        x2: activeBounds.left,
        items: [rowPrev.id, '__active__'],
      });
      guides.push({
        type: 'spacing',
        orientation: 'horizontal',
        distance,
        y: midY,
        x1: activeBounds.right,
        x2: rowNext.bounds.left,
        items: ['__active__', rowNext.id],
      });
    }
  }

  const colEntries = entries
    .filter((e) => e.bounds.left < activeBounds.right && e.bounds.right > activeBounds.left)
    .sort((a, b) => a.bounds.top - b.bounds.top);
  const { prev: colPrev, next: colNext } = findColumnNeighbors(activeBounds, colEntries);
  if (colPrev && colNext) {
    const gapBefore = activeBounds.top - colPrev.bounds.bottom;
    const gapAfter = colNext.bounds.top - activeBounds.bottom;
    if (gapBefore >= 0 && gapAfter >= 0 && Math.abs(gapBefore - gapAfter) <= tolerance) {
      const distance = Math.round((gapBefore + gapAfter) / 2);
      const midX =
        (Math.max(colPrev.bounds.left, activeBounds.left, colNext.bounds.left) +
          Math.min(colPrev.bounds.right, activeBounds.right, colNext.bounds.right)) /
        2;
      guides.push({
        type: 'spacing',
        orientation: 'vertical',
        distance,
        x: midX,
        y1: colPrev.bounds.bottom,
        y2: activeBounds.top,
        items: [colPrev.id, '__active__'],
      });
      guides.push({
        type: 'spacing',
        orientation: 'vertical',
        distance,
        x: midX,
        y1: activeBounds.bottom,
        y2: colNext.bounds.top,
        items: ['__active__', colNext.id],
      });
    }
  }

  return { guides };
}

// {x,y} konumuna bir snap sonucunun delta'sını uygular — saf yardımcı, StageCanvas
// dışında da (örn. test) kullanılabilir.
export function applySnapToPosition(position, snapResult) {
  const x = Number(position?.x) || 0;
  const y = Number(position?.y) || 0;
  const deltaX = Number(snapResult?.deltaX) || 0;
  const deltaY = Number(snapResult?.deltaY) || 0;
  return { x: x + deltaX, y: y + deltaY };
}

// calculateSnap + calculateCenterGuides + calculateMarginGuides + calculateSpacingGuides'ı
// tek çağrıda birleştirir: X/Y ekseninde en iyi (en küçük mutlak delta) eşleşme
// kategoriler arasından seçilir, tüm çizgiler birleştirilir. StageCanvas'ın hem taşıma
// hem resize akışında kullandığı orkestratör.
export function resolveSmartGuideSnap(activeBounds, context = {}) {
  const { candidates = [], canvasSize = {}, settings = {}, spacingObjects = null } = context;
  const cfg = normalizeSmartGuideSettings(settings);
  const empty = { snapX: null, snapY: null, deltaX: 0, deltaY: 0, guides: [] };
  if (!activeBounds || !cfg.enabled) return empty;

  const objectSnap = calculateSnap(activeBounds, candidates, cfg);
  const centerSnap = calculateCenterGuides(activeBounds, canvasSize, cfg);
  const marginSnap = calculateMarginGuides(activeBounds, canvasSize, cfg);
  const spacing = cfg.spacingGuides
    ? calculateSpacingGuides(activeBounds, spacingObjects || candidates, cfg)
    : { guides: [] };

  let bestX = null;
  let bestY = null;
  for (const pick of [objectSnap, centerSnap, marginSnap]) {
    if (pick.snapX !== null && (!bestX || Math.abs(pick.deltaX) < Math.abs(bestX.deltaX))) {
      bestX = pick;
    }
    if (pick.snapY !== null && (!bestY || Math.abs(pick.deltaY) < Math.abs(bestY.deltaY))) {
      bestY = pick;
    }
  }

  const guides = [...objectSnap.guides, ...centerSnap.guides, ...marginSnap.guides, ...spacing.guides];

  return {
    snapX: bestX ? bestX.snapX : null,
    snapY: bestY ? bestY.snapY : null,
    deltaX: cfg.snapEnabled && bestX ? bestX.deltaX : 0,
    deltaY: cfg.snapEnabled && bestY ? bestY.deltaY : 0,
    guides,
  };
}

// Sahne-birimindeki guide tanımlarını ekran pikseline (zoom'a göre) çevirir; StageCanvas
// bu çıktıyı doğrudan style'a uygular. DOM'a bağımlı değildir (JSX üretmez).
export function renderSmartGuides(guides = [], options = {}) {
  const scale = Number(options.scale) > 0 ? Number(options.scale) : 1;
  return (Array.isArray(guides) ? guides : [])
    .map((guide, index) => {
      if (!guide) return null;
      if (guide.type === 'vertical') {
        return {
          key: guide.key || `v-${guide.source || 'guide'}-${index}`,
          kind: 'line',
          orientation: 'vertical',
          source: guide.source,
          left: guide.x * scale,
          top: Math.min(guide.y1, guide.y2) * scale,
          width: 1,
          height: Math.abs(guide.y2 - guide.y1) * scale,
        };
      }
      if (guide.type === 'horizontal') {
        return {
          key: guide.key || `h-${guide.source || 'guide'}-${index}`,
          kind: 'line',
          orientation: 'horizontal',
          source: guide.source,
          left: Math.min(guide.x1, guide.x2) * scale,
          top: guide.y * scale,
          width: Math.abs(guide.x2 - guide.x1) * scale,
          height: 1,
        };
      }
      if (guide.type === 'spacing' && guide.orientation === 'horizontal') {
        return {
          key: guide.key || `sh-${index}`,
          kind: 'spacing',
          orientation: 'horizontal',
          distance: guide.distance,
          left: Math.min(guide.x1, guide.x2) * scale,
          top: guide.y * scale,
          width: Math.abs(guide.x2 - guide.x1) * scale,
          height: 1,
        };
      }
      if (guide.type === 'spacing' && guide.orientation === 'vertical') {
        return {
          key: guide.key || `sv-${index}`,
          kind: 'spacing',
          orientation: 'vertical',
          distance: guide.distance,
          left: guide.x * scale,
          top: Math.min(guide.y1, guide.y2) * scale,
          width: 1,
          height: Math.abs(guide.y2 - guide.y1) * scale,
        };
      }
      return null;
    })
    .filter(Boolean);
}
