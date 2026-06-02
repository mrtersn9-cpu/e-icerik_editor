// ─── Güvenli Matematiksel Formül Ayrıştırıcı ve Değerlendirici ─────────────────

const MATH_FUNCTIONS = {
  abs: { fn: Math.abs, args: 1 },
  round: { fn: Math.round, args: 1 },
  floor: { fn: Math.floor, args: 1 },
  ceil: { fn: Math.ceil, args: 1 },
  sqrt: { fn: Math.sqrt, args: 1 },
  sin: { fn: Math.sin, args: 1 },
  cos: { fn: Math.cos, args: 1 },
  tan: { fn: Math.tan, args: 1 },
  pow: { fn: Math.pow, args: 2 },
  min: { fn: Math.min, args: 2 },
  max: { fn: Math.max, args: 2 },
};

const OPERATORS = {
  '+': { precedence: 1, associativity: 'LEFT', fn: (a, b) => a + b },
  '-': { precedence: 1, associativity: 'LEFT', fn: (a, b) => a - b },
  '*': { precedence: 2, associativity: 'LEFT', fn: (a, b) => a * b },
  '/': { precedence: 2, associativity: 'LEFT', fn: (a, b) => {
    if (b === 0) throw new Error('Sıfıra bölme hatası');
    return a / b;
  }},
  '%': { precedence: 2, associativity: 'LEFT', fn: (a, b) => a % b },
  '^': { precedence: 3, associativity: 'RIGHT', fn: (a, b) => Math.pow(a, b) },
};

/**
 * Verilen formül ifadesini token'lara ayırır.
 * @param {string} expression - Ayrıştırılacak matematiksel ifade.
 * @returns {Array} Token nesneleri dizisi.
 */
export function tokenize(expression) {
  const tokens = [];
  let i = 0;
  const expr = String(expression || '').trim();

  while (i < expr.length) {
    const char = expr[i];

    if (/\s/.test(char)) {
      i++;
      continue;
    }

    // Sayı ayrıştırma (Tam sayı veya ondalıklı sayı)
    if (/[0-9]/.test(char) || (char === '.' && /[0-9]/.test(expr[i + 1] || ''))) {
      let numStr = '';
      while (i < expr.length && /[0-9.]/.test(expr[i])) {
        numStr += expr[i];
        i++;
      }
      const num = parseFloat(numStr);
      if (Number.isNaN(num)) {
        throw new Error(`Geçersiz sayı formatı: ${numStr}`);
      }
      tokens.push({ type: 'NUMBER', value: num });
      continue;
    }

    // İsim (değişken veya whitelist fonksiyon adı) ayrıştırma
    // Türkçe karakter desteği ve '.' (Project.Title gibi yapılar için)
    if (/[a-zA-Z_ığüşöçİĞÜŞÖÇ]/.test(char)) {
      let nameStr = '';
      while (i < expr.length && /[a-zA-Z0-9_ığüşöçİĞÜŞÖÇ.]/.test(expr[i])) {
        nameStr += expr[i];
        i++;
      }
      // Eğer bu isim bir whitelist fonksiyona aitse FUNCTION, değilse NAME (değişken)
      if (MATH_FUNCTIONS[nameStr.toLowerCase()]) {
        tokens.push({ type: 'FUNCTION', value: nameStr.toLowerCase() });
      } else {
        tokens.push({ type: 'NAME', value: nameStr });
      }
      continue;
    }

    // Tekli karakter operatörleri ve ayraçlar
    if (['+', '-', '*', '/', '%', '^', '(', ')', ',', ';'].includes(char)) {
      tokens.push({ type: 'OPERATOR', value: char });
      i++;
      continue;
    }

    throw new Error(`Geçersiz karakter tespit edildi: "${char}"`);
  }

  return tokens;
}

/**
 * Shunting-yard algoritması kullanarak token listesini Postfix (RPN) yapısına dönüştürür.
 * @param {Array} tokens - Token nesneleri dizisi.
 * @returns {Array} Postfix (RPN) token nesneleri dizisi.
 */
export function shuntingYard(tokens) {
  const outputQueue = [];
  const operatorStack = [];
  let lastToken = null;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (token.type === 'NUMBER') {
      outputQueue.push(token);
    } else if (token.type === 'NAME') {
      outputQueue.push(token);
    } else if (token.type === 'FUNCTION') {
      operatorStack.push(token);
    } else if (token.value === ',') {
      // Fonksiyon argüman ayracı
      let peeking = true;
      while (peeking) {
        if (operatorStack.length === 0) {
          throw new Error('Hatalı virgül veya parantez eşleşmesi');
        }
        const top = operatorStack[operatorStack.length - 1];
        if (top.value === '(') {
          peeking = false;
        } else {
          outputQueue.push(operatorStack.pop());
        }
      }
    } else if (token.type === 'OPERATOR' && token.value !== '(' && token.value !== ')') {
      const op1 = token.value;
      
      // Tekil (unary) eksi/artı tespiti (Örn: -5 veya 3 * -2)
      const isUnary = (op1 === '-' || op1 === '+') && (
        lastToken === null ||
        lastToken.value === '(' ||
        lastToken.value === ',' ||
        (lastToken.type === 'OPERATOR' && lastToken.value !== ')')
      );

      if (isUnary) {
        // Unary operatörü RPN'de özel bir unary operatör olarak saklarız
        operatorStack.push({ type: 'UNARY_OPERATOR', value: op1 === '-' ? 'u-' : 'u+' });
      } else {
        const op1Meta = OPERATORS[op1];
        let peeking = true;

        while (peeking && operatorStack.length > 0) {
          const top = operatorStack[operatorStack.length - 1];
          if (top.type === 'OPERATOR' && top.value !== '(') {
            const op2 = top.value;
            const op2Meta = OPERATORS[op2];
            if (
              (op1Meta.associativity === 'LEFT' && op1Meta.precedence <= op2Meta.precedence) ||
              (op1Meta.associativity === 'RIGHT' && op1Meta.precedence < op2Meta.precedence)
            ) {
              outputQueue.push(operatorStack.pop());
            } else {
              peeking = false;
            }
          } else if (top.type === 'UNARY_OPERATOR') {
            outputQueue.push(operatorStack.pop());
          } else {
            peeking = false;
          }
        }
        operatorStack.push(token);
      }
    } else if (token.value === '(') {
      operatorStack.push(token);
    } else if (token.value === ')') {
      let peeking = true;
      let foundParenthesis = false;

      while (peeking) {
        if (operatorStack.length === 0) {
          throw new Error('Eşleşmeyen sağ parantez ")" tespit edildi');
        }
        const top = operatorStack[operatorStack.length - 1];
        if (top.value === '(') {
          operatorStack.pop(); // Sol parantezi çıkar
          foundParenthesis = true;
          peeking = false;
        } else {
          outputQueue.push(operatorStack.pop());
        }
      }

      if (!foundParenthesis) {
        throw new Error('Eşleşmeyen parantez');
      }

      // Eğer parantezin hemen önünde bir fonksiyon varsa, onu da çıktı kuyruğuna al
      if (operatorStack.length > 0 && operatorStack[operatorStack.length - 1].type === 'FUNCTION') {
        outputQueue.push(operatorStack.pop());
      }
    }

    lastToken = token;
  }

  while (operatorStack.length > 0) {
    const top = operatorStack[operatorStack.length - 1];
    if (top.value === '(' || top.value === ')') {
      throw new Error('Eşleşmeyen sol parantez "(" tespit edildi');
    }
    outputQueue.push(operatorStack.pop());
  }

  return outputQueue;
}

/**
 * Postfix (RPN) token listesini, değişken değerleri ve whitelist fonksiyonlarla güvenli çözer.
 * @param {Array} rpn - Postfix token nesneleri dizisi.
 * @param {Object|Array} variables - Değişken haritası veya tanımları.
 * @returns {number} Formülün sayısal çözümleme sonucu.
 */
export function evaluateRPN(rpn, variables = {}) {
  const stack = [];

  // Değişken adları ve değerleri için bir arama tablosu oluştur
  // Hem değişken ismini (Örn: "puan") hem de ID'sini destekle
  const varLookup = {};
  if (Array.isArray(variables)) {
    variables.forEach((v) => {
      if (v?.id) varLookup[v.id] = v.value;
      if (v?.name) varLookup[v.name] = v.value;
    });
  } else if (typeof variables === 'object') {
    Object.entries(variables).forEach(([key, val]) => {
      varLookup[key] = val;
    });
  }

  for (let i = 0; i < rpn.length; i++) {
    const token = rpn[i];

    if (token.type === 'NUMBER') {
      stack.push(token.value);
    } else if (token.type === 'NAME') {
      const name = token.value;
      if (!(name in varLookup)) {
        throw new Error(`Tanımlanmamış değişken kullanımı: "${name}"`);
      }
      const val = Number(varLookup[name]);
      stack.push(Number.isFinite(val) ? val : 0);
    } else if (token.type === 'UNARY_OPERATOR') {
      if (stack.length < 1) {
        throw new Error('Unary operatör için yetersiz argüman');
      }
      const val = stack.pop();
      if (token.value === 'u-') {
        stack.push(-val);
      } else {
        stack.push(val);
      }
    } else if (token.type === 'OPERATOR') {
      if (stack.length < 2) {
        throw new Error(`"${token.value}" operatörü için yetersiz argüman`);
      }
      const b = stack.pop();
      const a = stack.pop();
      const opMeta = OPERATORS[token.value];
      stack.push(opMeta.fn(a, b));
    } else if (token.type === 'FUNCTION') {
      const funcName = token.value;
      const funcMeta = MATH_FUNCTIONS[funcName];
      if (stack.length < funcMeta.args) {
        throw new Error(`"${funcName}" fonksiyonu için yetersiz argüman (Beklenen: ${funcMeta.args})`);
      }
      
      const args = [];
      for (let a = 0; a < funcMeta.args; a++) {
        args.unshift(stack.pop()); // Argüman sırasını korumak için unshift
      }
      
      const res = funcMeta.fn(...args);
      stack.push(res);
    }
  }

  if (stack.length !== 1) {
    throw new Error('Formül çözümlenirken geçersiz ifade biçimi oluştu');
  }

  const finalResult = stack[0];
  return Number.isFinite(finalResult) ? finalResult : 0;
}

/**
 * Formül ifadesini tokenize eder, RPN'e çevirir ve değişkenlerle güvenli olarak hesaplar.
 * @param {string} expression - Matematiksel formül stringi.
 * @param {Object} variables - Güncel değişken değerleri haritası.
 * @returns {number} Hesaplanan sayısal sonuç.
 */
export function parseAndEvaluate(expression, variables = {}) {
  const expr = String(expression || '').trim();
  if (expr === '') return 0;
  
  // Eğer formül sadece düz bir sayı ise doğrudan dön (Performans optimizasyonu)
  if (/^-?[0-9]+(\.[0-9]+)?$/.test(expr)) {
    return parseFloat(expr);
  }

  try {
    const tokens = tokenize(expr);
    const rpn = shuntingYard(tokens);
    return evaluateRPN(rpn, variables);
  } catch (err) {
    throw new Error(`Formül hesaplama hatası [${expr}]: ${err.message}`);
  }
}

/**
 * Formül sözdizimini (syntax) ve kullanılan değişkenlerin geçerliliğini denetler.
 * @param {string} expression - Matematiksel formül stringi.
 * @param {Array} availableVariables - Projedeki mevcut geçerli değişkenler.
 * @returns {Object} Geçerlilik durumu, hata mesajı ve bağımlı değişkenleri içeren nesne.
 */
export function validateFormula(expression, availableVariables = []) {
  const expr = String(expression || '').trim();
  if (expr === '') return { valid: true, error: null, dependencies: [] };

  try {
    const tokens = tokenize(expr);
    const rpn = shuntingYard(tokens);
    
    // Bağımlı değişken listesini topla
    const dependencies = [];
    const varNames = new Set(
      availableVariables.flatMap((v) => [v.id, v.name].filter(Boolean))
    );

    rpn.forEach((token) => {
      if (token.type === 'NAME') {
        dependencies.push(token.value);
      }
    });

    // Tanımlanmamış değişken kontrolü
    const undefinedVars = dependencies.filter((name) => !varNames.has(name));
    if (undefinedVars.length > 0) {
      return {
        valid: false,
        error: `Tanımlanmamış değişken(ler) kullanıldı: ${undefinedVars.map(v => `"${v}"`).join(', ')}`,
        dependencies,
      };
    }

    // Sahte bir değerlendirme yaparak runtime hatalarını denetle
    const dummyVars = {};
    availableVariables.forEach((v) => {
      if (v.id) dummyVars[v.id] = 1;
      if (v.name) dummyVars[v.name] = 1;
    });
    evaluateRPN(rpn, dummyVars);

    return { valid: true, error: null, dependencies };
  } catch (err) {
    return { valid: false, error: err.message, dependencies: [] };
  }
}

/**
 * Projedeki tüm trigger'ları ve değişkenleri analiz ederek Döngüsel Bağımlılık tespiti yapar.
 * @param {Array} variables - Değişken tanımları dizisi.
 * @param {Array} triggers - Projedeki tüm tetikleyiciler dizisi.
 * @returns {Object} Döngü varlığı (hasCycle), döngü yolu (cyclePath) ve hata mesajı nesnesi.
 */
export function detectCircularDependency(variables = [], triggers = []) {
  const dependencyGraph = {};
  const variableIdToName = {};
  const variableNameToId = {};

  variables.forEach((v) => {
    dependencyGraph[v.id] = [];
    if (v.name) {
      variableIdToName[v.id] = v.name;
      variableNameToId[v.name] = v.id;
    }
  });

  // Trigger'lardan bağımlılıkları çıkar (Sadece DegiskenAta eylemlerindeki formüller)
  triggers.forEach((trigger) => {
    if (trigger?.action === 'DegiskenAta' && trigger?.value && trigger?.extra) {
      const targetVarId = trigger.value;
      const formula = trigger.extra;
      
      const validation = validateFormula(formula, variables);
      if (validation.valid && validation.dependencies.length > 0) {
        validation.dependencies.forEach((dep) => {
          // Bağımlılık ID'sini bul
          const depId = variableNameToId[dep] || dep;
          if (dependencyGraph[targetVarId] && targetVarId !== depId) {
            dependencyGraph[targetVarId].push(depId);
          }
        });
      }
    }
  });

  // DFS ile döngü arama algoritması (Cycle Detection)
  const visited = {}; // 0 = unvisited, 1 = visiting, 2 = visited
  variables.forEach((v) => { visited[v.id] = 0; });

  const path = [];

  function dfs(node) {
    if (visited[node] === 1) {
      // Döngü bulundu! Döngü yolunu oluştur
      const cycleStartIdx = path.indexOf(node);
      const cyclePath = path.slice(cycleStartIdx).map(id => variableIdToName[id] || id);
      cyclePath.push(variableIdToName[node] || node);
      return cyclePath;
    }
    if (visited[node] === 2) return null;

    visited[node] = 1;
    path.push(node);

    const neighbors = dependencyGraph[node] || [];
    for (let i = 0; i < neighbors.length; i++) {
      const cycle = dfs(neighbors[i]);
      if (cycle) return cycle;
    }

    path.pop();
    visited[node] = 2;
    return null;
  }

  for (let i = 0; i < variables.length; i++) {
    const varId = variables[i].id;
    if (visited[varId] === 0) {
      const cycle = dfs(varId);
      if (cycle) {
        return {
          hasCycle: true,
          cyclePath: cycle,
          message: `Döngüsel bağımlılık tespit edildi: ${cycle.join(' -> ')}`,
        };
      }
    }
  }

  return { hasCycle: false, cyclePath: [], message: null };
}
