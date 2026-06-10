import {
  LIVES_ICON_PRESETS,
  DEFAULT_LIVES_COUNT,
  getLivesIconPreset,
  getLivesConfig,
  buildLivesGlyphRow,
} from '../features/cevap/livesIcons';

describe('livesIcons — can/hak yardımcıları', () => {
  it('10 hazır simge sunar', () => {
    expect(LIVES_ICON_PRESETS).toHaveLength(10);
    expect(LIVES_ICON_PRESETS[0].id).toBe('heart');
  });

  it('getLivesIconPreset bilinmeyen id için ilk preseti döner', () => {
    expect(getLivesIconPreset('yok').id).toBe('heart');
    expect(getLivesIconPreset('star').id).toBe('star');
  });

  describe('getLivesConfig', () => {
    it('can kapalıyken enabled=false', () => {
      expect(getLivesConfig({ settings: {} }).enabled).toBe(false);
    });

    it('can sayısını 1-99 aralığına kelepçeler', () => {
      expect(getLivesConfig({ settings: { livesEnabled: true, livesCount: 0 } }).count).toBe(DEFAULT_LIVES_COUNT);
      expect(getLivesConfig({ settings: { livesEnabled: true, livesCount: 500 } }).count).toBe(99);
      expect(getLivesConfig({ settings: { livesEnabled: true, livesCount: 5 } }).count).toBe(5);
    });

    it('preset simgenin glyph’ini çözer', () => {
      const cfg = getLivesConfig({ settings: { livesEnabled: true, livesIconId: 'star' } });
      expect(cfg.glyph).toBe('⭐');
      expect(cfg.useCustom).toBe(false);
    });

    it('özel resim seçiliyken useCustom=true', () => {
      const cfg = getLivesConfig({
        settings: { livesEnabled: true, livesIconId: 'custom', livesCustomImage: 'data:image/png;base64,AAA' },
      });
      expect(cfg.useCustom).toBe(true);
      expect(cfg.customImage).toContain('data:image/png');
    });

    it('özel seçili ama resim yoksa useCustom=false', () => {
      const cfg = getLivesConfig({ settings: { livesEnabled: true, livesIconId: 'custom' } });
      expect(cfg.useCustom).toBe(false);
    });
  });

  describe('buildLivesGlyphRow', () => {
    it('kalan canı dolu/boş olarak böler', () => {
      const cfg = getLivesConfig({ settings: { livesEnabled: true, livesCount: 3 } });
      expect(buildLivesGlyphRow(cfg, 2)).toEqual({ total: 3, filled: 2, empty: 1 });
      expect(buildLivesGlyphRow(cfg, 0)).toEqual({ total: 3, filled: 0, empty: 3 });
      expect(buildLivesGlyphRow(cfg, 9)).toEqual({ total: 3, filled: 3, empty: 0 });
    });
  });
});
