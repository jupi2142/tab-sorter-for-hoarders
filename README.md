# Tab Sorter

Firefox Web Extension (Manifest V3) for sorting browser tabs by domain, subdomain, or semantic similarity.

## Features

- **Domain Sort** — Group tabs by base domain (e.g., `example.com`)
- **Subdomain Sort** — Group tabs by full hostname including subdomains
- **Similarity Sort** — AI-powered semantic clustering using Google Generative Language API

## Installation

```bash
npm install
npm run build
```

1. Open Firefox and navigate to `about:debugging`
2. Click **Load Temporary Add-on**
3. Select `manifest.json` from the project root

## Usage

- **Toolbar button** — Click the extension icon to open the popup
- **Popup** — Choose a sorting strategy from the menu
- **Context menu** — Right-click anywhere to access sorting options
- **Settings** — Configure your Google API key for similarity sorting

### Getting a Google API Key

Similarity sorting requires a Google Generative Language API key:

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create an API key
3. Open extension settings and paste the key

## Project Structure

```
tab-sorter-extension/
├── src/
│   ├── background.js              # Entry point
│   ├── core/
│   │   ├── embedding.js           # Google API calls
│   │   ├── similarity.js          # Cosine similarity
│   │   ├── titleCleaner.js        # Tab title processing
│   │   └── urlParser.js           # URL parsing utilities
│   ├── strategies/
│   │   ├── domainSortStrategy.js  # Sort by base domain
│   │   ├── subdomainSortStrategy.js
│   │   └── similaritySortStrategy.js
│   └── infrastructure/
│       ├── messages.js            # Message handling & context menus
│       └── storage.js             # API key storage
├── dist/                          # Built output
├── manifest.json                  # Extension manifest
├── popup.html / popup.js          # Popup UI
└── settings.html / settings.js    # Settings page
```

## Commands

```bash
npm run build    # Build extension
npm run watch    # Watch mode for development
```

## License

ISC