# Tab Sorter Extension - Specification

## Project Overview
- **Project name**: Tab Sorter
- **Type**: Firefox Web Extension (Manifest V3)
- **Core functionality**: Sort browser tabs by website domain, subdomain, or semantic similarity using AI embeddings
- **Target users**: Firefox users who want to organize their tabs logically

## UI/UX Specification

### Layout Structure
- **Toolbar button**: Click to trigger default subdomain sorting
- **Popup UI**: Opens on toolbar button click, provides sorting options
- **Settings page**: Accessible via extension menu, configure API key

### Visual Design
- Icon: Simple sorting arrows icon (SVG, 48x48)
- Button size: Standard 16x16 or 32x32 toolbar icon
- Popup: Clean interface with sort option buttons and status indicators
- Settings: Simple form for API key input

### Components
1. **Popup** (`popup.html` + `popup.js`): Main interaction point with sort buttons
2. **Settings** (`settings.html` + `settings.js`): API key configuration page
3. **Context Menu**: Right-click menu for sorting options

## Functionality Specification

### Core Features

#### 1. Sorting Strategies
- **Domain Sort**: Sort by base domain (e.g., "example.com")
  - Key format: `domain\0path`
- **Subdomain Sort**: Sort by full hostname including subdomains
  - Key format: `domain\0subdomain\0path`
- **Semantic Similarity Sort**: Sort by AI-powered semantic similarity
  - Uses Google Generative Language API for embeddings
  - Two modes:
    - Group: Cluster related tabs together
    - Sort: Order by similarity to a reference tab

#### 2. User Interactions
- Toolbar button click → Opens popup or triggers default sort
- Popup buttons → Trigger specific sorting strategies
- Context menu → Right-click options for sorting
- Settings page → Configure Google API key

#### 3. URL Parsing
- Extract hostname from tab URLs
- Parse domain and subdomain components
- Handle http, https protocols
- Place invalid/empty URLs at end (using `\uffff`)

### Technical Implementation
- Use `browser.tabs` API for tab operations
- Use `browser.contextMenus` for right-click menu
- Use `browser.storage` for API key persistence
- ES modules with esbuild for bundling
- Google Generative Language API for embeddings

### Edge Cases
- Handle tabs without URLs (about:blank, about:addons, etc.)
- Handle different protocols (http, https)
- Handle www vs non-www domains
- Handle empty/invalid URLs (placed at end)
- Handle missing API key for similarity sort

## Project Structure
```
tab-sorter-extension/
├── src/
│   ├── background.js         # Main extension logic
│   ├── core/
│   │   ├── embedding.js     # API call handling
│   │   ├── similarity.js    # Cosine similarity calculation
│   │   ├── titleCleaner.js  # Tab title processing
│   │   └── urlParser.js     # URL parsing utilities
│   ├── strategies/
│   │   ├── domainSortStrategy.js
│   │   ├── subdomainSortStrategy.js
│   │   └── similaritySortStrategy.js
│   └── infrastructure/
│       ├── messages.js      # Message handling & context menus
│       └── storage.js      # Storage adapter for API key
├── dist/                    # Built output
├── icons/                   # Extension icons
├── manifest.json            # Extension manifest
├── build.js                 # esbuild configuration
├── popup.html / popup.js    # Popup UI
└── settings.html / settings.js # Settings page
```

## Acceptance Criteria
1. Extension installs correctly in Firefox
2. Toolbar button appears and opens popup
3. Domain sort groups tabs by base domain
4. Subdomain sort groups tabs by full hostname
5. Similarity sort uses embeddings for semantic clustering
6. Context menu provides sorting options
7. Settings page allows API key configuration
8. Invalid URLs are placed at the end
9. Works with https:// and http:// URLs