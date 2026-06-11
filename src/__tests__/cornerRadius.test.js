import { resolveCornerRadiusPx } from '../utils/cornerRadius';

describe('resolveCornerRadiusPx — köşe yuvarlaklığı kelepçesi', () => {
  it('radius kısa kenarın yarısını aşamaz', () => {
    expect(resolveCornerRadiusPx(80, 400, 100)).toBe(50);
    expect(resolveCornerRadiusPx(80, 100, 400)).toBe(50);
  });

  it('küçük radius olduğu gibi döner (px korunur)', () => {
    expect(resolveCornerRadiusPx(12, 400, 100)).toBe(12);
  });

  it('resize sonrası aynı radius değeri aynı görünümü verir (px sabit)', () => {
    // 100x100 → 200x200 büyütüldü: radius 20 px her ikisinde de 20 px
    expect(resolveCornerRadiusPx(20, 100, 100)).toBe(20);
    expect(resolveCornerRadiusPx(20, 200, 200)).toBe(20);
  });

  it('negatif/geçersiz girişler 0 kabul edilir', () => {
    expect(resolveCornerRadiusPx(-5, 100, 100)).toBe(0);
    expect(resolveCornerRadiusPx('abc', 100, 100)).toBe(0);
    expect(resolveCornerRadiusPx(undefined, 100, 100)).toBe(0);
  });

  it('geçersiz boyutlarda güvenli minimum kenar (1) kullanılır', () => {
    expect(resolveCornerRadiusPx(20, 0, 0)).toBe(0.5);
  });
});
