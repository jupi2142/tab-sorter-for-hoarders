# Tab Sorter Extension - Agent Instructions

## Project Overview
Firefox Web Extension (Manifest V3) for sorting browser tabs by domain, subdomain, or semantic similarity.

## Tech Stack
- **Runtime**: Browser Extension APIs (Firefox)
- **Language**: JavaScript (ES Modules)
- **Build**: esbuild (`node build.js`)
- **APIs**: browser.tabs, browser.contextMenus, browser.storage, Google Generative Language API

## Commands
```bash
npm run build    # Build extension (bundles src/ to dist/)
npm run watch    # Watch mode for development
```

## Extension Testing
1. Run `npm run build`
2. Open Firefox → about:debugging
3. Click "Load Temporary Add-on"
4. Select `manifest.json` from project root

## Project Structure
```
src/
├── background.js              # Entry point, registers handlers
├── core/
│   ├── embedding.js           # Google API calls for embeddings
│   ├── similarity.js          # cosineSimilarity() function
│   ├── titleCleaner.js        # cleanTitle() function
│   └── urlParser.js           # getHostname, getDomainKey, getSubdomainKey
├── strategies/
│   ├── domainSortStrategy.js  # Sort by base domain
│   ├── subdomainSortStrategy.js # Sort by full hostname
│   └── similaritySortStrategy.js # AI-powered similarity sort
└── infrastructure/
    ├── messages.js            # MessageHandler, ContextMenuManager
    └── storage.js             # StorageAdapter for API key
```

## Key Patterns

### Sorting Strategy
All strategies implement:
```javascript
class SortStrategy {
  async execute(tabs) {
    // Returns number of tabs moved
  }
}
```

### URL Parsing
- Valid URLs: Sort normally (alphabetically)
- Invalid URLs: Use `\uffff` key to place at end

### Similarity Sort
- Requires Google API key in storage
- Two modes: 'group' (cluster related) or 'sort' (order by similarity)
- Falls back to popup if API key missing

## Code Style
- ES modules with explicit exports
- Classes for strategies and services
- Functions for utilities
- No comments unless clarifying complex logic
- 2-space indentation