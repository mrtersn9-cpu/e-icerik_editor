/* global __webpack_public_path__ */

if (
  typeof __webpack_public_path__ !== 'undefined' &&
  typeof globalThis?.location?.href === 'string'
) {
  // eslint-disable-next-line no-global-assign -- webpack worker chunks need an absolute base path under relative deployments.
  __webpack_public_path__ = new URL('./', globalThis.location.href).href;
}

let transformersModulePromise = null;

async function loadTransformers() {
  if (!transformersModulePromise) {
    transformersModulePromise = import('@xenova/transformers').then((module) => {
      const lib = module?.default || module;
      lib.env.allowLocalModels = false;
      lib.env.useBrowserCache = true;
      return lib;
    });
  }
  return transformersModulePromise;
}

class ClassifierSingleton {
  static task = 'zero-shot-classification';
  static model = 'Xenova/mobilebert-uncased-mnli';
  static instance = null;

  static async getInstance(progress_callback = null) {
    if (this.instance === null) {
      const { pipeline } = await loadTransformers();
      this.instance = pipeline(this.task, this.model, { progress_callback });
    }
    return this.instance;
  }
}

globalThis.addEventListener('message', async (event) => {
  const { id, type, text, labels } = event.data;

  try {
    if (type === 'classify') {
      const classifier = await ClassifierSingleton.getInstance((x) => {
        globalThis.postMessage({ id, type: 'progress', data: x });
      });
      const output = await classifier(text, labels);
      globalThis.postMessage({ id, type: 'complete', result: output });
    }
  } catch (error) {
    globalThis.postMessage({ id, type: 'error', error: error.message });
  }
});
