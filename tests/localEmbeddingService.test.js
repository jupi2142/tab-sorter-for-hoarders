import { describe, expect, it, vi } from 'vitest';

describe('LocalEmbeddingService', () => {
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
      localModelPath: 'moz-extension://test/models/',
      wasmPath: 'moz-extension://test/wasm/',
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
});
