import { describe, expect, it, vi } from 'vitest';

describe('LocalEmbeddingService', () => {
  it('configures the Transformers runtime to use only extension-packaged assets', async () => {
    const { configureLocalRuntime } = await import('../src/core/localEmbeddingService.js');
    const runtimeEnv = {
      backends: {
        onnx: {
          wasm: {}
        }
      }
    };

    configureLocalRuntime({
      allowRemoteModels: false,
      allowLocalModels: true,
      localModelPath: 'moz-extension://test/models/',
      wasmPath: 'moz-extension://test/wasm/',
      numThreads: 1
    }, runtimeEnv);

    expect(runtimeEnv).toMatchObject({
      allowRemoteModels: false,
      allowLocalModels: true,
      useBrowserCache: false,
      localModelPath: 'moz-extension://test/models/',
      backends: {
        onnx: {
          wasm: {
            wasmPaths: 'moz-extension://test/wasm/',
            numThreads: 1
          }
        }
      }
    });
  });

  it('configures only extension-packaged model and single-threaded WASM assets', async () => {
    const serviceModule = await import('../src/core/localEmbeddingService.js')
      .catch(() => null);

    expect(serviceModule).not.toBeNull();
    if (!serviceModule) return;

    const { LocalEmbeddingService } = serviceModule;
    const createExtractor = vi.fn().mockResolvedValue(async () => ({
      tolist: () => [[3, 4]]
    }));
    const configureRuntime = vi.fn();
    const service = new LocalEmbeddingService({
      createExtractor,
      getExtensionUrl: path => `moz-extension://test/${path}`,
      configureRuntime
    });

    await service.getEmbeddings(['example title']);

    expect(configureRuntime).toHaveBeenCalledWith({
      allowRemoteModels: false,
      allowLocalModels: true,
      localModelPath: 'moz-extension://test/dist/models/',
      wasmPath: 'moz-extension://test/dist/wasm/',
      numThreads: 1
    });
    expect(createExtractor).toHaveBeenCalledWith(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2',
      expect.objectContaining({
        dtype: 'q8',
        local_files_only: true,
        revision: 'main'
      })
    );
  });

  it('normalizes vectors, reports progress, and caches by cleaned title', async () => {
    const { LocalEmbeddingService } = await import('../src/core/localEmbeddingService.js');
    const extractor = vi.fn().mockResolvedValue({ tolist: () => [[3, 4]] });
    const progress = vi.fn();
    const service = new LocalEmbeddingService({
      createExtractor: vi.fn().mockResolvedValue(extractor),
      getExtensionUrl: path => `moz-extension://test/${path}`,
      configureRuntime: vi.fn()
    });

    const first = await service.getEmbeddings(['  Example Title  '], progress);
    const second = await service.getEmbeddings(['example title'], progress);

    expect(first).toEqual([{ text: '  Example Title  ', embedding: [0.6, 0.8] }]);
    expect(second).toEqual([{ text: 'example title', embedding: [0.6, 0.8] }]);
    expect(extractor).toHaveBeenCalledTimes(1);
    expect(progress).toHaveBeenLastCalledWith(1, 1);
  });

  it('wraps model startup failures in a user-safe local-runtime error', async () => {
    const { LocalEmbeddingService } = await import('../src/core/localEmbeddingService.js');
    const service = new LocalEmbeddingService({
      createExtractor: vi.fn().mockRejectedValue(new Error('WASM failed')),
      getExtensionUrl: path => `moz-extension://test/${path}`,
      configureRuntime: vi.fn()
    });

    await expect(service.getEmbeddings(['example title']))
      .rejects.toThrow('Offline semantic model could not start');
  });

  it('wraps inference failures without caching a bad vector', async () => {
    const { LocalEmbeddingService } = await import('../src/core/localEmbeddingService.js');
    const extractor = vi.fn()
      .mockRejectedValueOnce(new Error('inference failed'))
      .mockResolvedValue({ tolist: () => [[3, 4]] });
    const service = new LocalEmbeddingService({
      createExtractor: vi.fn().mockResolvedValue(extractor),
      getExtensionUrl: path => `moz-extension://test/${path}`,
      configureRuntime: vi.fn()
    });

    await expect(service.getEmbeddings(['example title']))
      .rejects.toThrow('Offline semantic model could not process tabs');

    await expect(service.getEmbeddings(['example title']))
      .resolves.toEqual([{ text: 'example title', embedding: [0.6, 0.8] }]);
    expect(extractor).toHaveBeenCalledTimes(2);
  });

  it('wraps malformed model output without caching a bad vector', async () => {
    const { LocalEmbeddingService } = await import('../src/core/localEmbeddingService.js');
    const extractor = vi.fn()
      .mockResolvedValueOnce({ tolist: () => [] })
      .mockResolvedValue({ tolist: () => [[3, 4]] });
    const service = new LocalEmbeddingService({
      createExtractor: vi.fn().mockResolvedValue(extractor),
      getExtensionUrl: path => `moz-extension://test/${path}`,
      configureRuntime: vi.fn()
    });

    await expect(service.getEmbeddings(['example title']))
      .rejects.toThrow('Offline semantic model could not process tabs');

    await expect(service.getEmbeddings(['example title']))
      .resolves.toEqual([{ text: 'example title', embedding: [0.6, 0.8] }]);
    expect(extractor).toHaveBeenCalledTimes(2);
  });
});
