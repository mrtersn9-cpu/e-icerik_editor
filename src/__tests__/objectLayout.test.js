import {
  getSelectionGroupState,
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
});
