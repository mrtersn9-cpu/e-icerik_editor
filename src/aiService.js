function normalizeAiText(value = '') {
  return String(value || '')
    .toLocaleLowerCase('tr-TR')
    .replace(/[çÇ]/g, 'c')
    .replace(/[ğĞ]/g, 'g')
    .replace(/[ıİ]/g, 'i')
    .replace(/[öÖ]/g, 'o')
    .replace(/[şŞ]/g, 's')
    .replace(/[üÜ]/g, 'u')
    .replace(/\s+/g, ' ')
    .trim();
}

function summarizeLines(text = '', maxLines = 4) {
  const parts = String(text || '')
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, maxLines);
  return parts.join(' | ');
}

function detectActivityType(text = '') {
  const normalized = normalizeAiText(text);
  if (!normalized) return 'Icerik';
  if (/(suruklenebilir|surukleyiniz|eslestiriniz|eslestirme)/.test(normalized))
    return 'Surukle Birak';
  if (/(dogru ise|yanlis ise| yargilar | d y | dogru yanlis)/.test(` ${normalized} `))
    return 'Dogru Yanlis';
  if (/(kutucuk|isaretleyiniz|secenek|asagidakilerden hangisi|coktan secmeli)/.test(normalized))
    return 'Coktan Secmeli';
  if (/(bosluk|tamamlayiniz|yaziniz|cevaplayiniz)/.test(normalized)) return 'Bosluk Doldurma';
  if (/(metni okuyunuz|parcayi okuyunuz|asagidaki metin|okuyunuz)/.test(normalized))
    return 'Okuma Metni';
  return 'Icerik';
}

function extractHints(text = '') {
  const lines = String(text || '')
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const questions = lines
    .filter((line) => /^\d+[.)-]?\s/.test(line) || /\?$/.test(line))
    .slice(0, 3);
  const options = lines
    .filter((line) => /^[A-Da-d][.)-]\s/.test(line) || /^[☐☑✓✔]/.test(line))
    .slice(0, 4);
  const hints = [];

  if (questions.length) {
    hints.push(`Sorular: ${questions.join(' / ')}`);
  }
  if (options.length) {
    hints.push(`Secenekler: ${options.join(' / ')}`);
  }
  return hints.join(' | ');
}

let _worker = null;
let _workerFailed = false;
let _pendingRequests = new Map();
let _requestId = 0;

export async function initAIWorker() {
  if (_worker) return _worker;
  if (_workerFailed) return null;
  try {
    _worker = new Worker(new URL('./aiWorker.js', import.meta.url));
    _worker.addEventListener('message', (event) => {
      const { id, type, result, error } = event.data;
      if (type === 'complete' || type === 'error') {
        const pending = _pendingRequests.get(id);
        if (pending) {
          _pendingRequests.delete(id);
          if (type === 'error') pending.reject(new Error(error));
          else pending.resolve(result);
        }
      }
    });
    _worker.addEventListener('error', () => {
      _workerFailed = true;
      _worker = null;
    });
    return _worker;
  } catch {
    _workerFailed = true;
    return null;
  }
}

function workerClassify(text, labels, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    if (!_worker) {
      reject(new Error('no worker'));
      return;
    }
    const id = ++_requestId;
    const timer = setTimeout(() => {
      _pendingRequests.delete(id);
      reject(new Error('timeout'));
    }, timeoutMs);
    _pendingRequests.set(id, {
      resolve: (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      reject: (e) => {
        clearTimeout(timer);
        reject(e);
      },
    });
    _worker.postMessage({ id, type: 'classify', text, labels });
  });
}

export async function classifyText(text, labels = []) {
  if (_worker && labels.length > 0) {
    try {
      const output = await workerClassify(text, labels);
      if (output && output.labels) return output;
    } catch {
      /* fall through to local */
    }
  }
  const topLabel = detectActivityType(text);
  return {
    labels: [topLabel, ...labels.filter((label) => label !== topLabel)],
    scores: [],
  };
}

export async function analyzeTextOffline(text, contextHint = '') {
  if (typeof window !== 'undefined' && window.ai && window.ai.languageModel) {
    try {
      const capabilities = await window.ai.languageModel.capabilities();
      if (capabilities.available !== 'no') {
        const session = await window.ai.languageModel.create();
        const prompt = `Asagidaki metin bir PDF sayfasindan cikarildi. ${contextHint} Bu metnin etkinlik turunu ve onemli kisimlarini kisa ozetle:\n\n${text}`;
        const result = await session.prompt(prompt);
        session.destroy();
        return { source: 'window.ai', analysis: result };
      }
    } catch (err) {
      // window.ai not available or failed
    }
  }

  const type = detectActivityType(text);
  const summary = summarizeLines(text, 3);
  const hints = extractHints(text);
  const analysis = [
    `Bu sayfa muhtemelen bir ${type} etkinligi.`,
    summary ? `Ozet: ${summary}` : '',
    hints,
  ]
    .filter(Boolean)
    .join(' ');

  return { source: 'local-heuristic', analysis };
}
