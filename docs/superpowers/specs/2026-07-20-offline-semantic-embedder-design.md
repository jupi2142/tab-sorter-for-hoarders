# Offline Semantic Embedder Design

## Goal

Replace the Gemini embedding integration with an English-only embedding model that ships with the Firefox extension and runs completely offline. Semantic tab grouping and sorting must not require an API key, user account, network connection, or cloud fallback.

## Scope

This is the first step toward a product-owned AI stack. It only covers an on-device embedder for semantic tab sorting. A future self-hosted embedding service may be added behind the same interface, but is out of scope for this release.

## Decision

Ship a compact, quantized ONNX sentence-embedding model, initially `all-MiniLM-L6-v2`, and run it through Transformers.js plus ONNX Runtime Web using the WASM CPU backend. The expected package budget is approximately 25–50 MB.

The extension will package all model, tokenizer, and WASM assets. Runtime configuration must resolve them through extension URLs and prohibit remote model and WASM loading. WebGPU is not part of the v1 execution path; it may be added as an optional optimization after the CPU implementation is proven.

## Architecture

`SimilaritySortStrategy` remains responsible for selecting titles, calculating cosine similarity, sorting, grouping, and moving tabs. It continues to call an embedding service through:

```js
getEmbeddings(texts, progressCallback)
```

The existing cloud implementation is replaced by `LocalEmbeddingService`, which owns only:

- lazy initialization of the bundled model pipeline;
- local model and WASM asset configuration;
- embedding input text and producing normalized vectors;
- short-lived, in-memory title-vector caching;
- progress and local-runtime error reporting.

The background context invokes the service only when the user chooses a semantic action. Model initialization is lazy and the model instance is reused for the life of that background context. Firefox MV3 can unload the background context, so a later invocation must safely initialize the model again.

```text
context menu or message
  -> SimilaritySortStrategy
  -> LocalEmbeddingService
  -> bundled model plus bundled WASM runtime
  -> cosine similarity
  -> browser.tabs.move
```

## Product behavior

- The first semantic action reports “Loading offline model…” followed by embedding progress.
- Subsequent actions reuse the loaded model until the background context is recreated.
- No API key, settings screen, or network connection is needed for similarity actions.
- A model initialization or inference failure returns a clear local-runtime error and makes no tab moves.
- Tabs without valid cleaned titles are excluded from semantic ranking, as they are today.
- Stored embeddings are not persisted to `browser.storage.local` in v1. In-memory caching avoids unbounded numeric storage while preserving privacy and predictable behavior.

## Retired Gemini surfaces

Remove:

- the Gemini API endpoint and request batching;
- `googleApiKey`, API-key accessors, and API-key checks;
- chunk-size setting and related settings UI;
- `checkApiKey` messaging and popup-opening behavior for similarity context menus;
- cloud-embedding cache entries from persistent storage.

Domain and subdomain sorting remain unchanged.

## Build and runtime packaging

The build must bundle the JavaScript inference dependency and copy model/WASM assets into `dist/`. It must not depend on a CDN. The local embedder explicitly disables remote asset loading and resolves all paths with extension URLs.

## Validation

Automated checks cover:

- local-only model/WASM configuration;
- normalized embedding output;
- cache behavior;
- model-load and inference failure handling;
- strategy behavior with a fake embedder;
- build output containing the required inference assets;
- absence of Gemini URLs, Google API-key settings, and remote model URLs in shipped code.

Manual Firefox acceptance verifies an installed build works while offline for both semantic group and semantic sort, works a second time in the same background lifetime, and works again after the extension/background context is reloaded.

## References

- [Transformers.js local models](https://huggingface.co/docs/transformers.js/main/en/custom_usage)
- [Transformers.js browser runtime](https://huggingface.co/docs/transformers.js/main/index)
- [Firefox background scripts](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Background_scripts)
