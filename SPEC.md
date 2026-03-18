# Tab Sorter Extension - Specification

## Project Overview
- **Project name**: Tab Sorter
- **Type**: Firefox Web Extension
- **Core functionality**: Sort browser tabs by website domain (including subdomains) when user clicks a toolbar button
- **Target users**: Firefox users who want to organize their tabs logically

## UI/UX Specification

### Layout Structure
- Toolbar button in Firefox toolbar
- Clicking the button triggers tab sorting
- No popup UI - simple one-click action

### Visual Design
- Icon: Simple sorting arrows icon (SVG)
- Button size: Standard 16x16 or 32x32 toolbar icon
- No additional visual elements needed

## Functionality Specification

### Core Features
1. **Toolbar Button**: Add a button to Firefox toolbar
2. **Tab Sorting**: When clicked, sort all tabs in current window by:
   - Primary sort: Domain (e.g., "example.com")
   - Secondary sort: Subdomain (e.g., "sub.example.com" before "www.example.com")
   - Third sort: URL path (for tabs with same domain+subdomain)
3. **Sorting Order**: Alphabetical, A-Z

### Technical Implementation
- Use `browser.tabs` API to get and move tabs
- Extract hostname from tab URLs
- Parse domain and subdomain components
- Reorder tabs by moving them to correct positions

### Edge Cases
- Handle tabs without URLs (about:blank, about:addons, etc.)
- Handle different protocols (http, https, www vs non-www)
- Handle tabs in all windows or just current window (current window)

## Acceptance Criteria
1. Extension installs correctly in Firefox
2. Button appears in toolbar
3. Clicking button sorts all tabs by domain, then subdomain, then path
4. Works with https://, http:// URLs
5. Empty/invalid URLs are placed at the end
