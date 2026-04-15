import { pipeline, env } from "@xenova/transformers";

env.allowLocalModels = false;
env.useBrowserCache = true;

class ClassifierSingleton {
  static task = "zero-shot-classification";
  static model = "Xenova/mobilebert-uncased-mnli";
  static instance = null;

  static async getInstance(progress_callback = null) {
    if (this.instance === null) {
      this.instance = pipeline(this.task, this.model, { progress_callback });
    }
    return this.instance;
  }
}

self.addEventListener("message", async (event) => {
  const { id, type, text, labels } = event.data;

  try {
    if (type === "classify") {
      const classifier = await ClassifierSingleton.getInstance((x) => {
        self.postMessage({ id, type: "progress", data: x });
      });
      const output = await classifier(text, labels);
      self.postMessage({ id, type: "complete", result: output });
    }
  } catch (error) {
    self.postMessage({ id, type: "error", error: error.message });
  }
});