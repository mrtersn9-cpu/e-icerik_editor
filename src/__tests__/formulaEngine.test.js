import {
  tokenize,
  shuntingYard,
  parseAndEvaluate,
  validateFormula,
  detectCircularDependency,
} from '../logic/formulaEngine';

describe('Güvenli Formula Motoru (Safe Formula Engine) Birim Testleri', () => {
  
  describe('Tokenizer (tokenize)', () => {
    it('temel sayıları ve operatörleri ayırmalıdır', () => {
      const tokens = tokenize('12.5 + 3 - 4 * 5 / 2');
      expect(tokens).toEqual([
        { type: 'NUMBER', value: 12.5 },
        { type: 'OPERATOR', value: '+' },
        { type: 'NUMBER', value: 3 },
        { type: 'OPERATOR', value: '-' },
        { type: 'NUMBER', value: 4 },
        { type: 'OPERATOR', value: '*' },
        { type: 'NUMBER', value: 5 },
        { type: 'OPERATOR', value: '/' },
        { type: 'NUMBER', value: 2 },
      ]);
    });

    it('Türkçe karakterli değişkenleri ve whitelist fonksiyonları tanımalıdır', () => {
      const tokens = tokenize('round(doğru_cevap * 1.5) + puan');
      expect(tokens).toEqual([
        { type: 'FUNCTION', value: 'round' },
        { type: 'OPERATOR', value: '(' },
        { type: 'NAME', value: 'doğru_cevap' },
        { type: 'OPERATOR', value: '*' },
        { type: 'NUMBER', value: 1.5 },
        { type: 'OPERATOR', value: ')' },
        { type: 'OPERATOR', value: '+' },
        { type: 'NAME', value: 'puan' },
      ]);
    });

    it('bilinmeyen karakter durumunda hata fırlatmalıdır', () => {
      expect(() => tokenize('2 @ 3')).toThrow('Geçersiz karakter tespit edildi: "@"');
    });
  });

  describe('Shunting-yard Algoritması ve RPN', () => {
    it('operatör önceliklerine göre RPN çıktısı üretmelidir', () => {
      const tokens = tokenize('3 + 4 * 2 / ( 1 - 5 ) ^ 2');
      const rpn = shuntingYard(tokens);
      
      const values = rpn.map(t => t.value);
      // Beklenen Postfix: 3 4 2 * 1 5 - 2 ^ / +
      expect(values).toEqual([3, 4, 2, '*', 1, 5, '-', 2, '^', '/', '+']);
    });

    it('tekil (unary) eksi operatörünü doğru işlemelidir', () => {
      const tokens = tokenize('-5 + (3 * -2)');
      const rpn = shuntingYard(tokens);
      const values = rpn.map(t => t.value);
      expect(values).toEqual([5, 'u-', 3, 2, 'u-', '*', '+']);
    });

    it('parantez eşleşme hatalarını yakalamalıdır', () => {
      expect(() => shuntingYard(tokenize('3 + (4 * 2'))).toThrow('Eşleşmeyen sol parantez "(" tespit edildi');
      expect(() => shuntingYard(tokenize('3 + 4 * 2)'))).toThrow('Eşleşmeyen sağ parantez ")" tespit edildi');
    });
  });

  describe('Formül Çözümleme ve Hesaplama (parseAndEvaluate)', () => {
    it('temel matematiksel işlemleri doğru çözmelidir', () => {
      expect(parseAndEvaluate('3 + 4 * 2')).toBe(11);
      expect(parseAndEvaluate('(3 + 4) * 2')).toBe(14);
      expect(parseAndEvaluate('2 ^ 3')).toBe(8);
      expect(parseAndEvaluate('10 % 3')).toBe(1);
    });

    it('unary işlemleri doğru çözmelidir', () => {
      expect(parseAndEvaluate('-5 + 3')).toBe(-2);
      expect(parseAndEvaluate('3 * -2')).toBe(-6);
      expect(parseAndEvaluate('+5')).toBe(5);
    });

    it('sıfıra bölme durumunda hata fırlatmalıdır', () => {
      expect(() => parseAndEvaluate('5 / 0')).toThrow('Sıfıra bölme hatası');
    });

    it('değişken değerlerini doğru bağlayıp çözmelidir', () => {
      const vars = {
        doğru: 8,
        katsayı: 1.5,
        puan: 20,
      };
      expect(parseAndEvaluate('doğru * katsayı + puan', vars)).toBe(32);
    });

    it('tanımlanmamış değişken durumunda hata fırlatmalıdır', () => {
      expect(() => parseAndEvaluate('dogru * 10', {})).toThrow('Tanımlanmamış değişken kullanımı: "dogru"');
    });

    it('whitelist fonksiyonları doğru parametre sayılarıyla çözmelidir', () => {
      expect(parseAndEvaluate('abs(-5)')).toBe(5);
      expect(parseAndEvaluate('round(5.4)')).toBe(5);
      expect(parseAndEvaluate('round(5.6)')).toBe(6);
      expect(parseAndEvaluate('floor(5.9)')).toBe(5);
      expect(parseAndEvaluate('ceil(5.1)')).toBe(6);
      expect(parseAndEvaluate('sqrt(9)')).toBe(3);
      expect(parseAndEvaluate('pow(2, 3)')).toBe(8);
      expect(parseAndEvaluate('min(10, 20)')).toBe(10);
      expect(parseAndEvaluate('max(10, 20)')).toBe(20);
    });
  });

  describe('Formül Sözdizimi Doğrulaması (validateFormula)', () => {
    const availableVars = [
      { id: 'v1', name: 'puan' },
      { id: 'v2', name: 'doğru' },
    ];

    it('geçerli formülleri doğrulamalıdır', () => {
      const res = validateFormula('round(doğru * 1.5) + puan', availableVars);
      expect(res.valid).toBe(true);
      expect(res.dependencies).toEqual(['doğru', 'puan']);
    });

    it('tanımlanmamış değişken içeren formülleri reddetmelidir', () => {
      const res = validateFormula('yanlış * 10', availableVars);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Tanımlanmamış değişken(ler) kullanıldı: "yanlış"');
    });

    it('hatalı sözdizimine sahip formülleri reddetmelidir', () => {
      const res = validateFormula('puan + * 2', availableVars);
      expect(res.valid).toBe(false);
      expect(res.error).toBeTruthy();
    });
  });

  describe('Döngüsel Bağımlılık Tespiti (detectCircularDependency)', () => {
    const variables = [
      { id: 'var-a', name: 'A' },
      { id: 'var-b', name: 'B' },
      { id: 'var-c', name: 'C' },
    ];

    it('döngü içermeyen temiz bağımlılıkları kabul etmelidir', () => {
      const triggers = [
        { action: 'DegiskenAta', value: 'var-a', extra: 'B + 5' },
        { action: 'DegiskenAta', value: 'var-b', extra: 'C * 2' },
      ];
      const res = detectCircularDependency(variables, triggers);
      expect(res.hasCycle).toBe(false);
    });

    it('doğrudan döngü durumunu (A -> B -> A) tespit etmelidir', () => {
      const triggers = [
        { action: 'DegiskenAta', value: 'var-a', extra: 'B + 5' },
        { action: 'DegiskenAta', value: 'var-b', extra: 'A - 1' },
      ];
      const res = detectCircularDependency(variables, triggers);
      expect(res.hasCycle).toBe(true);
      expect(res.cyclePath).toEqual(['A', 'B', 'A']);
    });

    it('dolaylı döngü durumunu (A -> B -> C -> A) tespit etmelidir', () => {
      const triggers = [
        { action: 'DegiskenAta', value: 'var-a', extra: 'B + 5' },
        { action: 'DegiskenAta', value: 'var-b', extra: 'C - 1' },
        { action: 'DegiskenAta', value: 'var-c', extra: 'A * 2' },
      ];
      const res = detectCircularDependency(variables, triggers);
      expect(res.hasCycle).toBe(true);
      expect(res.cyclePath).toEqual(['A', 'B', 'C', 'A']);
    });

    it('değişkenin kendi kendine artıran/azaltan eylemlerini döngü saymamalıdır', () => {
      const triggers = [
        { action: 'DegiskenArttir', value: 'var-a', extra: '1' },
        { action: 'DegiskenAzalt', value: 'var-a', extra: '5' },
      ];
      const res = detectCircularDependency(variables, triggers);
      expect(res.hasCycle).toBe(false);
    });
  });
});
