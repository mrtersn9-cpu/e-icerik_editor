import {
  alignActivitySelection,
  distributeActivitySelection,
  getSelectionGroupState,
  getSelectionUnits,
  groupActivitySelection,
  ungroupActivitySelection,
} from '../logic/objectLayout';

const activityWith = (objects) => ({ objects });

describe('objectLayout — seçim grup durumu ve grupla/ayır', () => {
  describe('getSelectionGroupState', () => {
    it('2+ grupsuz nesnede Grupla mümkün, Ayır değil', () => {
      const a = activityWith([
        { id: 'a' },
        { id: 'b' },
      ]);
      const state = getSelectionGroupState(a, new Set(['a', 'b']));
      expect(state.canGroup).toBe(true);
      expect(state.canUngroup).toBe(false);
    });

    it('tamamı aynı gruptaki seçimde Ayır mümkün, Grupla değil', () => {
      const a = activityWith([
        { id: 'a', groupId: 'g1' },
        { id: 'b', groupId: 'g1' },
      ]);
      const state = getSelectionGroupState(a, new Set(['a', 'b']));
      expect(state.canGroup).toBe(false);
      expect(state.canUngroup).toBe(true);
    });

    it('tek gruplu nesne seçiliyken Ayır mümkün', () => {
      const a = activityWith([{ id: 'a', groupId: 'g1' }]);
      const state = getSelectionGroupState(a, new Set(['a']));
      expect(state.canUngroup).toBe(true);
      expect(state.canGroup).toBe(false);
    });

    it('tek grupsuz nesnede ne Grupla ne Ayır', () => {
      const a = activityWith([{ id: 'a' }]);
      const state = getSelectionGroupState(a, new Set(['a']));
      expect(state.canGroup).toBe(false);
      expect(state.canUngroup).toBe(false);
    });

    it('farklı gruplardaki iki nesne seçiliyken Grupla mümkün', () => {
      const a = activityWith([
        { id: 'a', groupId: 'g1' },
        { id: 'b', groupId: 'g2' },
      ]);
      const state = getSelectionGroupState(a, new Set(['a', 'b']));
      expect(state.canGroup).toBe(true);
      expect(state.canUngroup).toBe(true);
    });
  });

  describe('groupActivitySelection', () => {
    it('seçili nesnelere ortak bir groupId atar', () => {
      const a = activityWith([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
      const next = groupActivitySelection(a, new Set(['a', 'b']));
      const ga = next.objects.find((o) => o.id === 'a').groupId;
      const gb = next.objects.find((o) => o.id === 'b').groupId;
      expect(ga).toBeTruthy();
      expect(ga).toBe(gb);
      expect(next.objects.find((o) => o.id === 'c').groupId).toBeUndefined();
    });

    it('iki nesneden az seçimde değişiklik yapmaz', () => {
      const a = activityWith([{ id: 'a' }]);
      expect(groupActivitySelection(a, new Set(['a']))).toBe(a);
    });
  });

  describe('ungroupActivitySelection', () => {
    it('groupId ve bağlı alanları temizler', () => {
      const a = activityWith([
        { id: 'a', groupId: 'g1', linkedHoverGroup: 'h1', linkedActionTargetId: 't1' },
        { id: 'b', groupId: 'g1' },
      ]);
      const next = ungroupActivitySelection(a, new Set(['a', 'b']));
      const oa = next.objects.find((o) => o.id === 'a');
      expect(oa.groupId).toBe('');
      expect(oa.linkedHoverGroup).toBe('');
      expect(oa.linkedActionTargetId).toBe('');
    });
  });

  describe('linkedHoverGroup (hazır buton çiftleri)', () => {
    it('linkedHoverGroup çifti seçiliyken Ayır görünür (canUngroup)', () => {
      const a = activityWith([
        { id: 'icon', type: 'button', linkedHoverGroup: 'ready:check' },
        { id: 'label', type: 'button', linkedHoverGroup: 'ready:check' },
      ]);
      const state = getSelectionGroupState(a, new Set(['icon', 'label']));
      expect(state.canUngroup).toBe(true);
      expect(state.canGroup).toBe(false);
    });

    it('getSelectionUnits aynı linkedHoverGroup üyelerini tek birim sayar', () => {
      const objects = [
        { id: 'icon', linkedHoverGroup: 'ready:check', x: 0, y: 0, width: 40, height: 40 },
        { id: 'label', linkedHoverGroup: 'ready:check', x: 50, y: 0, width: 100, height: 40 },
        { id: 'solo', x: 300, y: 0, width: 60, height: 40 },
      ];
      const units = getSelectionUnits(objects, new Set(['icon', 'label', 'solo']));
      expect(units).toHaveLength(2);
    });
  });
});

describe('objectLayout — hizalama ve dağıtma', () => {
  it('tek öge sahneye göre ortalanır', () => {
    const a = {
      stageWidth: 1000,
      stageHeight: 500,
      objects: [{ id: 'a', x: 10, y: 10, width: 200, height: 100 }],
    };
    const next = alignActivitySelection(a, new Set(['a']), 'center');
    expect(next.objects[0].x).toBe(400); // (1000-200)/2
    const next2 = alignActivitySelection(a, new Set(['a']), 'middle');
    expect(next2.objects[0].y).toBe(200); // (500-100)/2
    const next3 = alignActivitySelection(a, new Set(['a']), 'right');
    expect(next3.objects[0].x).toBe(800);
    const next4 = alignActivitySelection(a, new Set(['a']), 'bottom');
    expect(next4.objects[0].y).toBe(400);
  });

  it('komple bir grup tek birim olarak sahneye hizalanır (üyelerin arası bozulmaz)', () => {
    const a = {
      stageWidth: 1000,
      stageHeight: 500,
      objects: [
        { id: 'a', groupId: 'g1', x: 100, y: 50, width: 100, height: 50 },
        { id: 'b', groupId: 'g1', x: 250, y: 50, width: 100, height: 50 },
      ],
    };
    const next = alignActivitySelection(a, new Set(['a', 'b']), 'left');
    const oa = next.objects.find((o) => o.id === 'a');
    const ob = next.objects.find((o) => o.id === 'b');
    expect(oa.x).toBe(0);
    expect(ob.x - oa.x).toBe(150); // grup içi mesafe korunur
  });

  it('çoklu seçimde grup tek birim olarak seçim sınırlarına hizalanır', () => {
    const a = {
      objects: [
        { id: 'a', groupId: 'g1', x: 100, y: 0, width: 50, height: 50 },
        { id: 'b', groupId: 'g1', x: 200, y: 0, width: 50, height: 50 },
        { id: 'c', x: 0, y: 100, width: 50, height: 50 },
      ],
    };
    const next = alignActivitySelection(a, new Set(['a', 'b', 'c']), 'left');
    const oa = next.objects.find((o) => o.id === 'a');
    const ob = next.objects.find((o) => o.id === 'b');
    const oc = next.objects.find((o) => o.id === 'c');
    expect(oc.x).toBe(0);
    expect(oa.x).toBe(0); // grup bloğu sola çekilir
    expect(ob.x).toBe(100); // grup içi mesafe (100) korunur
  });

  it('dağıtmada grup tek birim sayılır; 3 birimden azsa işlem yapılmaz', () => {
    const grouped = {
      objects: [
        { id: 'a', groupId: 'g1', x: 0, y: 0, width: 50, height: 50, zIndex: 1 },
        { id: 'b', groupId: 'g1', x: 60, y: 0, width: 50, height: 50, zIndex: 2 },
        { id: 'c', x: 300, y: 0, width: 50, height: 50, zIndex: 3 },
      ],
    };
    // 2 birim (grup + tekil) → değişiklik yok
    expect(distributeActivitySelection(grouped, new Set(['a', 'b', 'c']), 'horizontal')).toBe(
      grouped
    );
  });

  it('yatay dağıtma birimler arası boşlukları eşitler', () => {
    const a = {
      objects: [
        { id: 'a', x: 0, y: 0, width: 100, height: 50, zIndex: 1 },
        { id: 'b', x: 120, y: 0, width: 100, height: 50, zIndex: 2 },
        { id: 'c', x: 500, y: 0, width: 100, height: 50, zIndex: 3 },
      ],
    };
    const next = distributeActivitySelection(a, new Set(['a', 'b', 'c']), 'horizontal');
    const xs = next.objects.map((o) => o.x);
    expect(xs[0]).toBe(0);
    expect(xs[1]).toBe(250); // (600-300)/2 = 150 boşluk → 0,250,500
    expect(xs[2]).toBe(500);
  });

  it('dikey dağıtma birimler arası boşlukları eşitler', () => {
    const a = {
      objects: [
        { id: 'a', x: 0, y: 0, width: 50, height: 100, zIndex: 1 },
        { id: 'b', x: 0, y: 110, width: 50, height: 100, zIndex: 2 },
        { id: 'c', x: 0, y: 500, width: 50, height: 100, zIndex: 3 },
      ],
    };
    const next = distributeActivitySelection(a, new Set(['a', 'b', 'c']), 'vertical');
    const ys = next.objects.map((o) => o.y);
    expect(ys[0]).toBe(0);
    expect(ys[1]).toBe(250);
    expect(ys[2]).toBe(500);
  });
});
