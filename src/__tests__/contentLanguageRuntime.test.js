import { TextEncoder } from 'util';

import { generateTrueFalseObjects } from '../logic/activityObjectGenerators';
import {
  runtimeText,
  translateGeneratedContentText,
} from '../logic/contentLanguage';

global.TextEncoder = TextEncoder;

// Exporter modül yüklenirken TextEncoder örnekliyor (scormTypedActivityPlayer.test deseni).
// eslint-disable-next-line global-require
const { buildStorylinePlayerHtml } = require('../utils/scormExport');

// "Üretim dili" (otomatik içerik dili) runtime kapsaması: SCORM oyuncusu,
// otomatik üretilen cevap nesneleri ve çeviri yardımcıları seçilen dili
// kullanmalı — Türkçe sabit kalmamalı.

describe('runtimeText — runtime sözlüğü', () => {
  test('üç dilde de anahtarlar dolu', () => {
    expect(runtimeText('tr').incorrectShort).toBe('Yanlış');
    expect(runtimeText('en').incorrectShort).toBe('Incorrect');
    expect(runtimeText('de').incorrectShort).toBe('Falsch');
    expect(runtimeText('en').checkLabel).toBe('Check');
  });

  test('bilinmeyen dil Türkçeye düşer; aktivite nesnesinden dil çözümlenir', () => {
    expect(runtimeText('fr').checkLabel).toBe('Kontrol Et');
    expect(runtimeText({ settings: { contentLanguage: 'en' } }).trueLabel).toBe('True');
  });
});

describe('translateGeneratedContentText — tam eşleşme + çift yön', () => {
  test('EN→TR dönüşü çalışır (regresyon)', () => {
    expect(translateGeneratedContentText('CHECK', 'tr')).toBe('KONTROL ET');
  });

  test('kısa runtime kelimesi yalnızca TAM eşleşmede çevrilir', () => {
    // Tam eşleşme: otomatik üretilen 'Doğru' butonu EN'e çevrilir.
    expect(translateGeneratedContentText('Doğru', 'en')).toBe('True');
    expect(translateGeneratedContentText('Yanlış', 'en')).toBe('False');
    // Substring DEĞİL: kullanıcı metni içinde geçen 'Doğru' bozulmaz.
    expect(translateGeneratedContentText('Doğru beslenme önemlidir', 'en')).toBe(
      'Doğru beslenme önemlidir'
    );
  });
});

describe('generateTrueFalseObjects — üretim diline göre buton etiketleri', () => {
  const baseActivity = {
    objects: [],
    tfStatements: [{ statement: 'Dünya yuvarlaktır', isTrue: true }],
  };

  test("EN'de True/False üretir", () => {
    const objects = generateTrueFalseObjects({
      ...baseActivity,
      settings: { contentLanguage: 'en' },
    });
    const labels = objects.filter((o) => o.type === 'button').map((o) => o.label);
    expect(labels).toEqual(expect.arrayContaining(['True', 'False']));
  });

  test("TR'de Doğru/Yanlış üretir", () => {
    const objects = generateTrueFalseObjects(baseActivity);
    const labels = objects.filter((o) => o.type === 'button').map((o) => o.label);
    expect(labels).toEqual(expect.arrayContaining(['Doğru', 'Yanlış']));
  });
});

describe('buildStorylinePlayerHtml — PAYLOAD.i18n ve kabuk metinleri', () => {
  const stateFor = (lang) => ({
    selActId: 'act-1',
    activities: [
      {
        id: 'act-1',
        name: 'Etkinlik',
        type: 'fill-blank',
        settings: { contentLanguage: lang },
        fillBlankSentence: 'Başkent ___ şehridir.',
        fillBlankAnswers: [{ id: 'blank-0', acceptedValues: ['Ankara'] }],
      },
    ],
  });

  test('EN seçiliyken kabuk ve payload İngilizce', () => {
    const html = buildStorylinePlayerHtml(stateFor('en'), { packageName: 'Test' });
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('<h1>Completed</h1>');
    expect(html).not.toContain('<h1>Tamamlandı</h1>');
    expect(html).toContain('"checkLabel":"Check"');
    expect(html).toContain('"livesOut":"You are out of lives."');
  });

  test('TR (varsayılan) kabuk Türkçe kalır', () => {
    const html = buildStorylinePlayerHtml(stateFor('tr'), { packageName: 'Test' });
    expect(html).toContain('<html lang="tr">');
    expect(html).toContain('<h1>Tamamlandı</h1>');
    expect(html).toContain('"checkLabel":"Kontrol Et"');
  });
});
