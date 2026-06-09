import { restyleReadyButtonsForPreset } from '../logic/buttonStyling';
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
