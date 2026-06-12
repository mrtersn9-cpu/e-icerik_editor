import { readyButtonTextShadowForColor } from '../editor-logic/colorUtils';
import {
  restyleAnswerLayerObjectsForPreset,
  restyleAllButtonsForPackage,
  restyleReadyButtonsForPreset,
} from '../logic/buttonStyling';
import { normalizeObject } from '../logic/normalize';

// "Buton yazı rengi" (readyButtonTextColor) ayarlandığında etkinlikteki TÜM
// butonların yazı rengi değişmeli — yalnızca tonlu hazır butonlar değil,
// kullanıcının manuel eklediği (tonsuz) butonlar da. Renk boş (Temaya bırak)
// olduğunda tonsuz butonlar değişmeden kalır, tonlu butonlar tema rengine döner.

function tonedButton() {
  return {
    id: 'toned',
    type: 'button',
    label: 'TAMAMLA',
    readyButtonTone: 'success',
    width: 240,
    height: 64,
    style: { color: '#ffffff', fontSize: 22 },
  };
}

function plainButton() {
  return {
    id: 'plain',
    type: 'button',
    label: 'Özel Buton',
    width: 200,
    height: 60,
    style: { color: '#000000', fontSize: 18 },
  };
}

function textObject() {
  return {
    id: 'note',
    type: 'text',
    label: 'Not',
    style: { color: '#112233' },
  };
}

describe('readyButtonTextShadowForColor — renge uyumlu harf gölgesi', () => {
  test('açık renk → yumuşak koyu gölge; koyu renk → açık halo; boş → karışma', () => {
    expect(readyButtonTextShadowForColor('#ffffff')).toBe('0 1px 2px rgba(0,0,0,.25)');
    expect(readyButtonTextShadowForColor('#fde047')).toBe('0 1px 2px rgba(0,0,0,.25)');
    expect(readyButtonTextShadowForColor('#0f172a')).toBe('0 1px 0 rgba(255,255,255,.35)');
    expect(readyButtonTextShadowForColor('')).toBe('');
    expect(readyButtonTextShadowForColor('gecersiz')).toBe('');
  });
});

describe('readyButtonTextColor — tüm butonlara yazı rengi', () => {
  test('renk ayarlıyken hem tonlu hem tonsuz butonlar yazı rengini alır', () => {
    const result = restyleReadyButtonsForPreset(
      [tonedButton(), plainButton(), textObject()],
      'lise-akademik',
      { textColor: '#ff0000' }
    );
    const byId = Object.fromEntries(result.map((item) => [item.id, item]));

    expect(byId.toned.style.color).toBe('#ff0000');
    // Kritik: tonsuz (manuel) buton da yazı rengini almalı.
    expect(byId.plain.style.color).toBe('#ff0000');
    // colorLocked işareti konmalı → normalize'daki TTKB kontrast düzeltmesi ezmesin.
    expect(byId.toned.style.colorLocked).toBe(true);
    expect(byId.plain.style.colorLocked).toBe(true);
    // Buton olmayan nesneler etkilenmez.
    expect(byId.note.style.color).toBe('#112233');
  });

  test('BEYAZ seçilince beyaz uygulanır ve gölge renge uyarlanır ("köşe rengi" hatası)', () => {
    const result = restyleReadyButtonsForPreset(
      [tonedButton(), plainButton()],
      'lise-akademik',
      { textColor: '#ffffff' }
    );
    const byId = Object.fromEntries(result.map((item) => [item.id, item]));

    expect(byId.toned.style.color).toBe('#ffffff');
    expect(byId.plain.style.color).toBe('#ffffff');
    // Tema gölgesi (sert '0 2px 0' / '0 1px 0') yerine renge uyumlu yumuşak gölge.
    expect(byId.toned.style.textShadow).toBe('0 1px 2px rgba(0,0,0,.25)');
    expect(byId.plain.style.textShadow).toBe('0 1px 2px rgba(0,0,0,.25)');
    expect(byId.toned.style.colorLocked).toBe(true);
  });

  test('koyu renk seçilince açık halo gölgesi uygulanır', () => {
    const result = restyleReadyButtonsForPreset([tonedButton()], 'lise-akademik', {
      textColor: '#0f172a',
    });
    expect(result[0].style.textShadow).toBe('0 1px 0 rgba(255,255,255,.35)');
  });

  test('renk boşken (Temaya bırak) tonsuz buton korunur, tonlu buton tema rengine döner', () => {
    const result = restyleReadyButtonsForPreset(
      [tonedButton(), plainButton()],
      'lise-akademik',
      { textColor: '' }
    );
    const byId = Object.fromEntries(result.map((item) => [item.id, item]));

    // Tonsuz buton custom rengini korur (devralacağı tema rengi yok).
    expect(byId.plain.style.color).toBe('#000000');
    // Tonlu buton tema varsayılanına döner (custom kırmızı kalmaz).
    expect(byId.toned.style.color).not.toBe('#ff0000');
    expect(typeof byId.toned.style.color).toBe('string');
    expect(byId.toned.style.color.length).toBeGreaterThan(0);
    // Kilit kalkar → tema rengine dönebilir / TTKB kontrastı tekrar uygulanabilir.
    expect(byId.toned.style.colorLocked).toBe(false);
  });

  test('"Temaya bırak" tonlu butonun gölgesini tema gölgesine döndürür', () => {
    // Önce kullanıcı rengi uygula, sonra boş renkle temaya dön.
    const colored = restyleReadyButtonsForPreset([tonedButton()], 'lise-akademik', {
      textColor: '#ffffff',
    });
    expect(colored[0].style.textShadow).toBe('0 1px 2px rgba(0,0,0,.25)');
    const reverted = restyleReadyButtonsForPreset(colored, 'lise-akademik', { textColor: '' });
    // Tema gölgesi contrastSafeButtonStyle'dan gelir (renk-bazlı iki varyanttan biri).
    expect(['0 1px 0 rgba(0,0,0,.34)', '0 1px 0 rgba(255,255,255,.72)']).toContain(
      reverted[0].style.textShadow
    );
    expect(reverted[0].style.colorLocked).toBe(false);
  });
});

describe('readyButton typography — tüm butonlara font ailesi, punto ve kalınlık', () => {
  const typography = {
    fontFamily: 'Verdana',
    fontSize: 18,
    fontWeight: 700,
  };

  test('tema presetinde hem tonlu hem tonsuz butonlar toplu font ayarını alır', () => {
    const result = restyleReadyButtonsForPreset(
      [tonedButton(), plainButton(), textObject()],
      'lise-akademik',
      typography
    );
    const byId = Object.fromEntries(result.map((item) => [item.id, item]));

    expect(byId.toned.style.fontFamily).toBe('Verdana');
    expect(byId.toned.style.fontSize).toBe(18);
    expect(byId.toned.style.fontWeight).toBe(700);
    expect(byId.toned.style.whiteSpace).toBe('nowrap');
    expect(byId.plain.style.fontFamily).toBe('Verdana');
    expect(byId.plain.style.fontSize).toBe(18);
    expect(byId.plain.style.fontWeight).toBe(700);
    expect(byId.note.style.fontFamily).toBeUndefined();
  });

  test('paket değişiminde toplu font ayarı korunur', () => {
    const [button] = restyleAllButtonsForPackage([tonedButton()], 'pkg-1', typography);

    expect(button.style.fontFamily).toBe('Verdana');
    expect(button.style.fontSize).toBe(18);
    expect(button.style.fontWeight).toBe(700);
  });
});

describe('restyleAnswerLayerObjectsForPreset — cevap katmanı butonlarına renk + gölge', () => {
  const layers = [
    { id: 'layer-correct', name: 'Doğru' },
    { id: 'layer-incorrect', name: 'Yanlış' },
  ];
  const resolvedLayerNames = { 'layer-correct': 'correct', 'layer-incorrect': 'incorrect' };

  function layerButton() {
    return {
      id: 'layer-btn',
      type: 'button',
      label: 'DEVAM',
      layerId: 'layer-correct',
      width: 220,
      height: 56,
      style: { color: '#ffffff' },
    };
  }

  test('options.textColor cevap katmanı butonuna renk, kilit ve uyumlu gölge basar', () => {
    const result = restyleAnswerLayerObjectsForPreset(
      [layerButton()],
      layers,
      resolvedLayerNames,
      'lise-akademik',
      { textColor: '#ffffff' }
    );
    const button = result.find((item) => item.id === 'layer-btn');
    expect(button.style.color).toBe('#ffffff');
    expect(button.style.colorLocked).toBe(true);
    expect(button.style.textShadow).toBe('0 1px 2px rgba(0,0,0,.25)');
  });

  test('renk boşken kilit kalkar', () => {
    const result = restyleAnswerLayerObjectsForPreset(
      [layerButton()],
      layers,
      resolvedLayerNames,
      'lise-akademik',
      { textColor: '' }
    );
    const button = result.find((item) => item.id === 'layer-btn');
    expect(button.style.colorLocked).toBe(false);
  });

  test('toplu font ayarı cevap katmanı butonuna uygulanır', () => {
    const result = restyleAnswerLayerObjectsForPreset(
      [layerButton()],
      layers,
      resolvedLayerNames,
      'lise-akademik',
      { fontFamily: 'Verdana', fontSize: 18, fontWeight: 700 }
    );
    const button = result.find((item) => item.id === 'layer-btn');
    expect(button.style.fontFamily).toBe('Verdana');
    expect(button.style.fontSize).toBe(18);
    expect(button.style.fontWeight).toBe(700);
  });
});

describe('normalizeObject — colorLocked ile TTKB kontrast atlaması (Hata 1)', () => {
  test('colorLocked buton: seçilen renk (düşük kontrast olsa bile) korunur', () => {
    const out = normalizeObject({
      type: 'button',
      style: { background: '#2563eb', color: '#861919', colorLocked: true },
    });
    expect(out.style.color).toBe('#861919');
  });

  test('colorLocked yoksa düşük kontrastlı renk TTKB tarafından okunur renge zorlanır', () => {
    const out = normalizeObject({
      type: 'button',
      style: { background: '#2563eb', color: '#1e3a8a' },
    });
    expect(out.style.color).not.toBe('#1e3a8a');
  });
});
