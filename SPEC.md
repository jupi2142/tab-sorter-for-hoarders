# Tab Sorter Extension - Specification

## Project Overview

- **Project name**: Tab Sorter
- **Type**: Firefox Web Extension (Manifest V3)
- **Core functionality**: Sort browser tabs by website domain, subdomain, or local semantic similarity
- **Target users**: Firefox users who want to organize their tabs logically

## User Experience

### Interactions

- **Toolbar button**: Sort the current window by subdomain.
- **Context menu**: Right-click a tab to sort by domain, subdomain, similarity, or group similar tabs.
- **Semantic progress**: Context-menu semantic actions show a Firefox notification while the offline model loads and while tabs are processed; the notification is cleared when the action finishes.

There is no popup, settings page, account, or API-key setup.

### Offline semantic similarity

Semantic sorting is English-only in v1. It uses a bundled, quantized ONNX `all-MiniLM-L6-v2` embedding model through Transformers.js and ONNX Runtime Web with the WASM CPU backend. Model, tokenizer, JavaScript loader, and WASM binary are all included in the built extension; remote model loading is disabled.

The first semantic action in a background-context lifetime initializes the model and may take a few seconds. Later semantic actions reuse that model while the background context remains active. Firefox may recreate the context, so a later action may safely initialize the model again. No network connection or cloud fallback is used.

The uncompressed `dist/` output is currently expected to be about 36 MB, within the planned 25–50 MB package budget.

## Functionality Specification

### Sorting Strategies

- **Domain sort**: Group tabs by base domain (for example, `example.com`) using `domain\0path` keys.
- **Subdomain sort**: Group tabs by full hostname using `domain\0subdomain\0path` keys.
- **Semantic similarity sort**: Order tabs by local embedding similarity to a selected reference tab.
- **Semantic grouping**: Cluster locally similar English-titled tabs around the selected reference tab.

### URL Parsing and Tab Handling

- Extract hostnames from `http` and `https` URLs.
- Handle `www` and non-`www` hostnames.
- Put invalid or empty URLs at the end using `\uffff`.
- Exclude tabs without usable cleaned titles from semantic ranking.
- If local model startup or inference fails, report a local-runtime error and do not move tabs.

## Technical Implementation

- Use `browser.tabs`, `browser.contextMenus`, and `browser.notifications` APIs.
- Bundle JavaScript with esbuild.
- Package the local model under `dist/models/` and the ONNX Runtime WASM module and binary under `dist/wasm/`.
- Load model and WASM files only through extension URLs; no CDN or cloud embedding integration is shipped.
- Keep title-vector caching in memory only for the current background-context lifetime.

## Acceptance Criteria

1. The extension installs correctly in Firefox.
2. The toolbar button sorts by subdomain.
3. Domain and subdomain sorting retain their existing behavior.
4. Similarity sorting and grouping work with English tab titles without an API key, settings, account, or network connection.
5. The first semantic action displays loading/progress feedback; a later one reuses the initialized local model when available.
6. A rebuilt `dist/` contains the quantized model plus `ort-wasm-simd-threaded.mjs` and `ort-wasm-simd-threaded.wasm`.
7. Invalid URLs remain at the end.
