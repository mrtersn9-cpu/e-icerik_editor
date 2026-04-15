let worker = null;
let callbackMap = new Map();
let currentId = 0;

export async function initAIWorker() {
  if (!worker && typeof window !== "undefined") {
    worker = new Worker(new URL("./aiWorker.js", import.meta.url), { type: "module" });
    worker.addEventListener("message", (event) => {
      const { id, type, data, result, error } = event.data;
      if (type === "progress") {
        // Handle loading progress if needed (console.log(data))
      } else if (callbackMap.has(id)) {
        const { resolve, reject } = callbackMap.get(id);
        if (type === "complete") {
          resolve(result);
        } else if (type === "error") {
          reject(new Error(error));
        }
        callbackMap.delete(id);
      }
    });
  }
}

export async function classifyText(text, labels) {
  if (!worker) await initAIWorker();

  return new Promise((resolve, reject) => {
    const id = ++currentId;
    callbackMap.set(id, { resolve, reject });
    worker.postMessage({ id, type: "classify", text, labels });
  });
}

// Fallback or advanced extraction using window.ai (Chrome Built-in AI) if available
export async function analyzeTextOffline(text, contextHint = "") {
  if (window.ai && window.ai.languageModel) {
    try {
      const capabilities = await window.ai.languageModel.capabilities();
      if (capabilities.available !== "no") {
        const session = await window.ai.languageModel.create();
        const prompt = `Aşağıdaki metin bir PDF sayfasından çıkarıldı. ${contextHint} Bu metnin ne tür bir etkinlik olduğunu ('Sürükle Bırak', 'Çoktan Seçmeli', 'Eşleştirme', 'Okuma Metni') ve varsa soruları veya seçenekleri özetle:\n\n${text}`;
        const result = await session.prompt(prompt);
        session.destroy();
        return { source: "window.ai", analysis: result };
      }
    } catch (err) {
      console.warn("window.ai failed:", err);
    }
  }

  // Fallback to local transformers.js classification
  try {
    const labels = ["drag and drop", "multiple choice", "true or false", "reading passage", "fill in the blanks"];
    const result = await classifyText(text, labels);
    const topLabel = result.labels[0];

    // Translate back to Turkish for UI
    const trMap = {
      "drag and drop": "Sürükle Bırak",
      "multiple choice": "Çoktan Seçmeli",
      "true or false": "Doğru Yanlış",
      "reading passage": "Okuma Metni",
      "fill in the blanks": "Boşluk Doldurma"
    };

    return { source: "transformers.js", analysis: `Bu sayfa muhtemelen bir ${trMap[topLabel] || topLabel} etkinliği.` };
  } catch (err) {
    return { source: "error", analysis: "Yapay zeka analizi yapılamadı." };
  }
}
