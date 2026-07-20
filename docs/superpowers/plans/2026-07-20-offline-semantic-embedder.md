# Offline Semantic Embedder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Gemini embeddings with a bundled, English-only ONNX embedding model that sorts tabs locally without an API key or any runtime network request.

**Architecture:** `SimilaritySortStrategy` keeps its existing `getEmbeddings(texts, progressCallback)` dependency. A new local-only embedding service lazy-loads a quantized `all-MiniLM-L6-v2` model from extension-packaged assets through Transformers.js and the WASM CPU backend. Build tooling copies the model and ONNX Runtime WASM assets into `dist/`; UI and storage paths used solely for Gemini are removed.

**Tech Stack:** Firefox MV3 WebExtensions, ES modules, esbuild, `@huggingface/transformers`, ONNX Runtime Web/WASM, Vitest.

---

## File structure

| Path | Responsibility |
| --- | --- |
| `src/core/localEmbeddingService.js` | Lazy local model loading, normalized embedding generation, and lifetime-scoped title cache. |
| `src/core/embedding.js` | Deleted: cloud Gemini request and persistent embedding cache. |
| `src/background.js` | Wire the local service and make semantic context-menu actions unconditional. |
| `src/infrastructure/storage.js` | Deleted: storage is unnecessary once settings and persistent vectors are removed. |
| `src/infrastructure/messages.js` | Delete the API-key check message; retain progress forwarding and sorting messages. |
| `assets/models/Xenova/all-MiniLM-L6-v2/` | Versioned model config, tokenizer, and quantized ONNX model files. |
| `assets/wasm/` | Copied ONNX Runtime Web `.wasm` files used by the local model. |
| `scripts/prepare-local-model.mjs` | Deterministically copies model and WASM assets into `dist/`. |
| `build.js` | Calls the asset-preparation script after bundling. |
| `manifest.json` | Remove network CSP and options/popup configuration. |
| `popup.html`, `popup.js`, `settings.html`, `settings.js` | Deleted: all exist only to configure Gemini. |
| `tests/localEmbeddingService.test.js` | Unit tests for local-only configuration, cache, normalized vectors, and failure behavior. |
| `tests/build-assets.test.js` | Verifies built output includes local assets and no Gemini/network configuration. |
| `README.md`, `SPEC.md` | Replace Gemini setup instructions with offline behavior and package-size expectation. |

### Task 1: Establish the local runtime and test harness

**Files:**
- Modify: `package.json`
- Create: `tests/localEmbeddingService.test.js`
- Create: `assets/models/Xenova/all-MiniLM-L6-v2/README.md`
- Create: `scripts/prepare-local-model.mjs`

- [ ] **Step 1: Add the runtime and test dependencies**

Run:

```bash
npm install @huggingface/transformers@3
npm install --save-dev vitest@3
```

Set package scripts to:

```json
"scripts": {
  "build": "node build.js",
  "watch": "node build.js --watch",
  "test": "vitest run"
}
```

- [ ] **Step 2: Add the first failing local-runtime test**

Create `tests/localEmbeddingService.test.js` with this model-loader contract test:

```js
import { describe, expect, it, vi } from 'vitest';
import { LocalEmbeddingService } from '../src/core/localEmbeddingService.js';

describe('LocalEmbeddingService', () => {
  it('loads only extension-packaged model and WASM assets', async () => {
    const createExtractor = vi.fn().mockResolvedValue(async () => ({
      tolist: () => [[3, 4]]
    }));
    const service = new LocalEmbeddingService({
      createExtractor,
      getExtensionUrl: path => `moz-extension://test/${path}`
    });

    await service.getEmbeddings(['example title']);

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
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- tests/localEmbeddingService.test.js`

Expected: FAIL because `src/core/localEmbeddingService.js` does not exist.

- [ ] **Step 4: Vendor the approved model with provenance**

Create `assets/models/Xenova/all-MiniLM-L6-v2/README.md` containing the exact source model, commit revision, license, conversion source, and the required asset list:

```text
Source: Xenova/all-MiniLM-L6-v2
Model revision: the immutable SHA returned by `git ls-remote https://huggingface.co/Xenova/all-MiniLM-L6-v2 refs/heads/main` at the time the model assets are vendored
License: Apache-2.0
Files required by the extension:
- config.json
- tokenizer.json
- tokenizer_config.json
- special_tokens_map.json
- onnx/model_quantized.onnx
```

Download those files once during development, commit them under the documented directory, and do not give the extension any URL from which it can download replacements. Confirm the committed model is within the agreed 25–50 MB package budget.

- [ ] **Step 5: Implement deterministic asset copying**

Create `scripts/prepare-local-model.mjs`:

```js
import { cp, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const modelSource = path.join(root, 'assets/models');
const modelTarget = path.join(root, 'dist/models');
const wasmSource = path.join(root, 'node_modules/onnxruntime-web/dist');
const wasmTarget = path.join(root, 'dist/wasm');

if (!existsSync(path.join(modelSource, 'Xenova/all-MiniLM-L6-v2/onnx/model_quantized.onnx'))) {
  throw new Error('Missing vendored local model: assets/models/Xenova/all-MiniLM-L6-v2/onnx/model_quantized.onnx');
}

await cp(modelSource, modelTarget, { recursive: true });
await mkdir(wasmTarget, { recursive: true });
for (const file of await readdir(wasmSource)) {
  if (file.endsWith('.wasm')) {
    await cp(path.join(wasmSource, file), path.join(wasmTarget, file));
  }
}
```

- [ ] **Step 6: Commit the isolated runtime foundation**

```bash
git add package.json package-lock.json scripts/prepare-local-model.mjs assets/models/Xenova/all-MiniLM-L6-v2 tests/localEmbeddingService.test.js
git commit -m "chore: add local embedding runtime assets"
```

### Task 2: Implement and test the local-only embedding service

**Files:**
- Create: `src/core/localEmbeddingService.js`
- Modify: `tests/localEmbeddingService.test.js`

- [ ] **Step 1: Extend the failing tests for output, cache, progress, and errors**

Append these tests:

```js
it('normalizes vectors, reports progress, and caches by cleaned title', async () => {
  const extractor = vi.fn().mockResolvedValue({ tolist: () => [[3, 4]] });
  const progress = vi.fn();
  const service = new LocalEmbeddingService({
    createExtractor: vi.fn().mockResolvedValue(extractor),
    getExtensionUrl: path => `moz-extension://test/${path}`
  });

  const first = await service.getEmbeddings(['  Example Title  '], progress);
  const second = await service.getEmbeddings(['example title'], progress);

  expect(first).toEqual([{ text: '  Example Title  ', embedding: [0.6, 0.8] }]);
  expect(second).toEqual([{ text: 'example title', embedding: [0.6, 0.8] }]);
  expect(extractor).toHaveBeenCalledTimes(1);
  expect(progress).toHaveBeenLastCalledWith(1, 1);
});

it('wraps model startup failures in a user-safe local-runtime error', async () => {
  const service = new LocalEmbeddingService({
    createExtractor: vi.fn().mockRejectedValue(new Error('WASM failed')),
    getExtensionUrl: path => `moz-extension://test/${path}`
  });

  await expect(service.getEmbeddings(['example title']))
    .rejects.toThrow('Offline semantic model could not start');
});
```

- [ ] **Step 2: Run the tests to confirm the missing behaviors fail**

Run: `npm test -- tests/localEmbeddingService.test.js`

Expected: FAIL until normalization, cache, progress, and safe error wrapping are implemented.

- [ ] **Step 3: Implement the service with injected seams**

Create `src/core/localEmbeddingService.js` with this complete public surface:

```js
import { env, pipeline } from '@huggingface/transformers';

const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';

function normalize(values) {
  const magnitude = Math.hypot(...values);
  if (!magnitude) throw new Error('Offline semantic model returned an empty embedding');
  return values.map(value => value / magnitude);
}

export class LocalEmbeddingService {
  constructor({ createExtractor = pipeline, getExtensionUrl = browser.runtime.getURL.bind(browser.runtime) } = {}) {
    this.createExtractor = createExtractor;
    this.getExtensionUrl = getExtensionUrl;
    this.extractorPromise = null;
    this.cache = new Map();
  }

  async getExtractor() {
    if (!this.extractorPromise) {
      env.allowRemoteModels = false;
      env.allowLocalModels = true;
      env.localModelPath = this.getExtensionUrl('models/');
      env.backends.onnx.wasm.wasmPaths = this.getExtensionUrl('wasm/');
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
        const output = await extractor(text, { pooling: 'mean', normalize: true });
        embedding = normalize(output.tolist()[0]);
        this.cache.set(key, embedding);
      }
      results.push({ text, embedding });
      progressCallback(index + 1, texts.length);
    }
    return results;
  }
}
```

- [ ] **Step 4: Run the service tests**

Run: `npm test -- tests/localEmbeddingService.test.js`

Expected: PASS.

- [ ] **Step 5: Commit the local service**

```bash
git add src/core/localEmbeddingService.js tests/localEmbeddingService.test.js
git commit -m "feat: add offline embedding service"
```

### Task 3: Replace all Gemini wiring and remove the settings UI

**Files:**
- Modify: `src/background.js`
- Modify: `src/infrastructure/messages.js`
- Delete: `src/core/embedding.js`
- Delete: `src/infrastructure/storage.js`
- Delete: `settings.html`
- Delete: `settings.js`
- Delete: `popup.html`
- Delete: `popup.js`
- Modify: `manifest.json`
- Modify: `build.js`

- [ ] **Step 1: Write a failing behavior test for unconditional local similarity actions**

Add `tests/background-wiring.test.js` with a browser mock that records calls. Its required assertion is:

```js
expect(storage.hasApiKey).not.toHaveBeenCalled();
expect(similarity.execute).toHaveBeenCalledWith(
  expect.any(Array),
  clickedTab.id,
  'group',
  0.5
);
```

The mock must trigger the registered `contextMenus.onClicked` listener with `menuItemId: 'sort-similarity-group'` and a tab object with an `id`.

- [ ] **Step 2: Run the behavior test**

Run: `npm test -- tests/background-wiring.test.js`

Expected: FAIL because the current callback requires `storage.hasApiKey()` and can open the popup.

- [ ] **Step 3: Wire `LocalEmbeddingService` and delete cloud-only branches**

Make these precise edits:

```js
// src/background.js imports and construction
import { LocalEmbeddingService } from './core/localEmbeddingService.js';

const embeddingService = new LocalEmbeddingService();

const strategies = {
  domain: new DomainSortStrategy(urlParser),
  subdomain: new SubdomainSortStrategy(urlParser),
  similarity: new SimilaritySortStrategy({
    embeddingService,
    similarityCalculator: cosineSimilarity,
    titleCleaner: { cleanTitle }
  })
};
```

Replace the semantic menu branch with:

```js
} else if (info.menuItemId === 'sort-similarity-group' || info.menuItemId === 'sort-similarity-sort') {
  try {
    await strategies.similarity.execute(
      await browser.tabs.query({ currentWindow: true }),
      tab.id,
      info.menuItemId === 'sort-similarity-group' ? 'group' : 'sort',
      0.5
    );
  } catch (error) {
    console.error('Similarity sort error:', error);
  }
}
```

In `src/infrastructure/messages.js`, remove the `checkApiKey` switch case and `handleCheckApiKey`. Retain `handleSimilaritySort` unchanged so it forwards the local model progress and returns the service error without moving tabs.

Delete `EmbeddingService`, `StorageAdapter`, and all options/popup files. Remove `options_page`, `action.default_popup`, the `storage` permission, and `connect-src https://generativelanguage.googleapis.com` from `manifest.json`; leave a self-only extension CSP. With no popup, the existing `browser.action.onClicked` listener becomes reachable and continues to sort by subdomain.

At the end of `build()` in `build.js`, replace the settings copy with:

```js
await import('./scripts/prepare-local-model.mjs');
```

Before creating `dist/`, clear it with `fs.rmSync(distDir, { recursive: true, force: true })`. This prevents a build-artifact test from passing because a previous build left stale model files behind.

In `SimilaritySortStrategy.execute`, make the progress adapter accept the model-load status as well as numeric work counts:

```js
(processed, total) => this.progressCallback(
  typeof processed === 'string'
    ? processed
    : `Processing tabs... (${processed}/${total})`
)
```

- [ ] **Step 4: Run code and configuration removal checks**

Run:

```bash
rg -n "generativelanguage|gemini|googleApiKey|chunkSize|checkApiKey|openOptionsPage|default_popup|options_page" src manifest.json build.js package.json
```

Expected: exit code `1` with no matches.

- [ ] **Step 5: Run the behavior test and production build**

Run:

```bash
npm test -- tests/background-wiring.test.js
npm run build
```

Expected: tests PASS and `Build complete` after model/WASM assets are copied.

- [ ] **Step 6: Commit the migration**

```bash
git add src/background.js src/infrastructure/messages.js manifest.json build.js tests/background-wiring.test.js
git rm src/core/embedding.js src/infrastructure/storage.js settings.html settings.js popup.html popup.js
git commit -m "feat: run semantic sorting fully offline"
```

### Task 4: Verify shipped assets and update user-facing documentation

**Files:**
- Create: `tests/build-assets.test.js`
- Modify: `README.md`
- Modify: `SPEC.md`

- [ ] **Step 1: Write the failing build-artifact test**

Create `tests/build-assets.test.js`:

```js
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('offline build artifacts', () => {
  it('ships model and WASM assets without Gemini configuration', () => {
    expect(existsSync('dist/models/Xenova/all-MiniLM-L6-v2/onnx/model_quantized.onnx')).toBe(true);
    expect(readdirSync('dist/wasm').some(file => file.endsWith('.wasm'))).toBe(true);
    const manifest = readFileSync('manifest.json', 'utf8');
    const background = readFileSync('dist/background.js', 'utf8');
    expect(manifest).not.toContain('generativelanguage.googleapis.com');
    expect(background).not.toMatch(/generativelanguage|gemini|googleApiKey/iu);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails before the final build**

Run: `npm test -- tests/build-assets.test.js`

Expected: FAIL until `npm run build` has produced local assets and removed all cloud identifiers.

- [ ] **Step 3: Document the offline experience**

Replace README setup instructions with:

```markdown
## Offline semantic sorting

Semantic grouping and similarity sorting run entirely on your device using a bundled English embedding model. No API key, account, or network connection is required. The first semantic sort loads the local model and can take a few seconds; later sorts reuse it while the extension background context remains active.
```

Update `SPEC.md` to remove the settings/API-key component and state that a quantized local ONNX model is bundled for English-only semantic sorting.

- [ ] **Step 4: Run final automated checks**

Run:

```bash
npm run build
npm test
rg -n "generativelanguage|gemini|googleApiKey|chunkSize|checkApiKey" src manifest.json build.js README.md SPEC.md
```

Expected: build succeeds, all tests PASS, and `rg` exits `1` with no matches.

- [ ] **Step 5: Perform the manual Firefox offline acceptance test**

1. Disconnect the computer from the network.
2. Run `npm run build`.
3. Load `manifest.json` as a temporary add-on from `about:debugging`.
4. Open a window with several related and unrelated English-titled tabs.
5. Use “Group by Similarity” and observe model-load then processing progress; verify related tabs move next to the source tab.
6. Use “Sort by Similarity” again; verify it works without model setup UI or network access.
7. Reload the extension from `about:debugging`, repeat a semantic action, and verify the model safely reloads and sorting still succeeds.

- [ ] **Step 6: Commit verification and documentation**

```bash
git add README.md SPEC.md tests/build-assets.test.js
git commit -m "docs: describe offline semantic sorting"
```

## Plan self-review

- Spec coverage: Tasks 1–2 implement the bundled local model, WASM CPU runtime, no-remote configuration, lazy lifetime cache, normalization, progress, and safe errors. Task 3 removes every Gemini/API-key/settings branch while preserving similarity strategy and domain/subdomain sort paths. Task 4 validates shipped assets, absence of network surfaces, offline Firefox behavior, and user documentation.
- Placeholder scan: all paths, commands, source assets, and test assertions are explicit. Model provenance is obtained by the supplied `git ls-remote` command at vendoring time, so the asset commit is recorded rather than guessed.
- Consistency: all integration code uses the same `LocalEmbeddingService` class and the unchanged `getEmbeddings(texts, progressCallback)` interface; build output consistently uses `dist/models/` and `dist/wasm/`.
