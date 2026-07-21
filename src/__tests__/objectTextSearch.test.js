import {
  countActivityObjectTextMatches,
  replaceActivityObjectTextMatches,
} from '../logic/objectTextSearch';

describe('objectTextSearch — Bul-Değiştir çok-sahneli etkinlik desteği', () => {
  const multiSlideActivity = () => ({
    id: 'act-1',
    objects: [
      { id: 'root-1', label: 'Merhaba dünya', text: '' },
    ],
    slides: [
      {
        id: 'slide-1',
        objects: [
          { id: 'slide-1-obj-1', label: 'Merhaba sınıf', text: 'İkinci Merhaba burada' },
        ],
      },
      {
        id: 'slide-2',
        objects: [
          { id: 'slide-2-obj-1', label: 'Alakasız metin', text: '' },
        ],
      },
    ],
  });

  describe('countActivityObjectTextMatches', () => {
    it('kök objects içindeki eşleşmeleri sayar', () => {
      const activity = multiSlideActivity();
      expect(countActivityObjectTextMatches(activity, 'Merhaba')).toBe(3);
    });

    it('slides[].objects içindeki eşleşmeleri de sayar (önceden atlanıyordu)', () => {
      const activity = {
        id: 'act-2',
        objects: [],
        slides: [
          { id: 'slide-1', objects: [{ id: 'o1', label: 'Merhaba sadece sahnede', text: '' }] },
        ],
      };
      expect(countActivityObjectTextMatches(activity, 'Merhaba')).toBe(1);
    });

    it('search boşsa veya activity yoksa 0 döner', () => {
      expect(countActivityObjectTextMatches(multiSlideActivity(), '')).toBe(0);
      expect(countActivityObjectTextMatches(null, 'x')).toBe(0);
    });
  });

  describe('replaceActivityObjectTextMatches', () => {
    it('kök ve slide içindeki nesnelerde birlikte değiştirir, sayaç doğru toplanır', () => {
      const activity = multiSlideActivity();
      const { count, objects, slides } = replaceActivityObjectTextMatches(activity, 'Merhaba', 'Selam');

      expect(count).toBe(3);
      expect(objects[0].label).toBe('Selam dünya');
      expect(slides[0].objects[0].label).toBe('Selam sınıf');
      expect(slides[0].objects[0].text).toBe('İkinci Selam burada');
      // İlgisiz sahne/nesne değişmeden kalmalı
      expect(slides[1].objects[0].label).toBe('Alakasız metin');
    });

    it('yalnızca bir sahnenin içindeki nesnede eşleşme varsa da değiştirir', () => {
      const activity = {
        id: 'act-3',
        objects: [{ id: 'root-1', label: 'değişmeyecek', text: '' }],
        slides: [
          { id: 'slide-1', objects: [{ id: 'o1', label: 'eskiDeğer burada', text: '' }] },
        ],
      };
      const { count, objects, slides } = replaceActivityObjectTextMatches(activity, 'eskiDeğer', 'yeniDeğer');

      expect(count).toBe(1);
      expect(objects[0].label).toBe('değişmeyecek');
      expect(slides[0].objects[0].label).toBe('yeniDeğer burada');
    });

    it('eşleşme yoksa count 0 döner ve içerik değişmez', () => {
      const activity = multiSlideActivity();
      const { count, objects, slides } = replaceActivityObjectTextMatches(activity, 'olmayankelime', 'x');

      expect(count).toBe(0);
      expect(objects).toEqual(activity.objects);
      expect(slides).toEqual(activity.slides);
    });
  });
});
