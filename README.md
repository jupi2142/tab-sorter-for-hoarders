# Tab Sorter

Firefox Web Extension (Manifest V3) for sorting browser tabs by domain, subdomain, or semantic similarity.

## Features

- **Domain Sort** — Group tabs by base domain (for example, `example.com`).
- **Subdomain Sort** — Group tabs by full hostname, including subdomains.
- **Similarity Sort** — Group related English-titled tabs or sort them by similarity to the selected tab.

## Offline semantic sorting

Semantic grouping and similarity sorting run entirely on your device with a bundled, quantized English embedding model. No API key, account, settings screen, or network connection is required.

The first semantic sort loads the local model and can take a few seconds. A Firefox notification shows model-loading and tab-processing progress for context-menu semantic actions. Later semantic sorts reuse the model while the extension background context remains active; Firefox can recreate that context, in which case the next semantic sort loads the model again.

The current uncompressed `dist/` output is expected to be about 36 MB, within the 25–50 MB package budget for the bundled model and ONNX Runtime assets.

## Installation

```bash
npm install
npm run build
```

1. Open Firefox and navigate to `about:debugging`.
2. Click **Load Temporary Add-on**.
3. Select `manifest.json` from the project root.

## Usage

- **Toolbar button** — Sort the current window by subdomain.
- **Context menu** — Right-click a tab and choose domain, subdomain, similarity, or grouping actions.
- **Semantic actions** — Use English tab titles for the v1 local model; they work offline without setup.

## Project Structure

```
tab-sorter-extension/
├── assets/models/              # Bundled local embedding model
├── src/
│   ├── background.js           # Entry point
│   ├── core/
│   │   ├── localEmbeddingService.js # Local ONNX embedding runtime
│   │   ├── similarity.js       # Cosine similarity
│   │   ├── titleCleaner.js     # Tab title processing
│   │   └── urlParser.js        # URL parsing utilities
│   ├── strategies/             # Sorting strategies
│   └── infrastructure/         # Messages and context menus
├── dist/                       # Built extension code and local model/WASM assets
└── manifest.json               # Extension manifest
```

## Commands

```bash
npm run build    # Build extension and copy local model/WASM assets
npm run watch    # Watch extension source changes
npm test         # Run automated tests
```

## License

ISC
