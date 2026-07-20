import { env, pipeline } from '@huggingface/transformers';

const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';

export function configureLocalRuntime({
  allowRemoteModels,
  allowLocalModels,
  localModelPath,
  wasmPath,
  numThreads
}, runtimeEnv = env) {
  runtimeEnv.allowRemoteModels = allowRemoteModels;
  runtimeEnv.allowLocalModels = allowLocalModels;
  runtimeEnv.useBrowserCache = false;
  runtimeEnv.localModelPath = localModelPath;
  runtimeEnv.backends.onnx.wasm.wasmPaths = wasmPath;
  runtimeEnv.backends.onnx.wasm.numThreads = numThreads;
}

function normalize(values) {
  const magnitude = Math.hypot(...values);
  if (!magnitude) {
    throw new Error('Offline semantic model returned an empty embedding');
  }
  return values.map(value => value / magnitude);
}

export class LocalEmbeddingService {
  constructor({
    createExtractor = pipeline,
    configureRuntime = configureLocalRuntime,
    getExtensionUrl = browser.runtime.getURL.bind(browser.runtime)
  } = {}) {
    this.createExtractor = createExtractor;
    this.configureRuntime = configureRuntime;
    this.getExtensionUrl = getExtensionUrl;
    this.extractorPromise = null;
    this.cache = new Map();
  }

  async getExtractor() {
    if (!this.extractorPromise) {
      this.configureRuntime({
        allowRemoteModels: false,
        allowLocalModels: true,
        localModelPath: this.getExtensionUrl('dist/models/'),
        wasmPath: this.getExtensionUrl('dist/wasm/'),
        numThreads: 1
      });
      this.extractorPromise = this.createExtractor('feature-extraction', MODEL_ID, {
        dtype: 'q8',
        local_files_only: true,
        revision: 'main'
      }).catch(error => {
        this.extractorPromise = null;
        throw new Error(`Offline semantic model could not start: ${error.message}`);
      });
    }
    return this.extractorPromise;
  }

  async getEmbeddings(texts, progressCallback = () => {}) {
    progressCallback('Loading offline model…');
    const extractor = await this.getExtractor();
    const results = [];

    for (let index = 0; index < texts.length; index += 1) {
      const text = texts[index];
      const key = text.toLowerCase().trim();
      let embedding = this.cache.get(key);

      if (!embedding) {
        try {
          const output = await extractor(text, { pooling: 'mean', normalize: true });
          embedding = normalize(output.tolist()[0]);
          this.cache.set(key, embedding);
        } catch {
          throw new Error('Offline semantic model could not process tabs');
        }
      }

      results.push({ text, embedding });
      progressCallback(index + 1, texts.length);
    }

    return results;
  }
}
