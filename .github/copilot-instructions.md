# SilentBlock — AI Coding Instructions

## Project Overview
SilentBlock is a free, cross-browser (Chrome, Edge, Firefox, Opera) ad-blocking extension built on Manifest V3.

## Architecture
- **Manifest V3** with `declarativeNetRequest` for efficient network-level blocking
- **Cosmetic CSS filtering** to hide ad containers the network layer can't catch
- **Content script** with MutationObserver for dynamic ad removal, popup blocking, and anti-adblock countermeasures
- **Background service worker** handling global/per-site toggle state
- **Cross-browser API alias**: `const api = typeof browser !== 'undefined' ? browser : chrome;` — always use `api.*`, never `chrome.*` directly

## Key Files
| File | Purpose |
|---|---|
| `manifest.json` | Extension manifest — permissions, content scripts, declarativeNetRequest rules |
| `background.js` | Service worker — toggle logic, badge updates, dynamic rule management |
| `rules/rules.json` | Static blocking rules (domain-based and URL-pattern-based) |
| `content/cosmetic.css` | CSS selectors that hide known ad elements |
| `content/content.js` | Dynamic ad hiding, popup blocker, anti-adblock bait |
| `popup/popup.html` | Extension popup UI |
| `popup/popup.css` | Popup styles (dark theme) |
| `popup/popup.js` | Popup logic — reads/writes toggle state via messages to background.js |

## Conventions
- All JS files use `'use strict'` at the top
- Use `api.*` instead of `chrome.*` or `browser.*` for cross-browser compatibility
- Rule IDs in `rules.json` must be unique integers starting from 1
- CSS selectors in `cosmetic.css` use `!important` to override inline styles
- Version is tracked in `manifest.json` → `"version"` field — use the bump script to increment

## Version Bumping
Run `version-bump.ps1` with `-Part patch|minor|major` to bump the version in `manifest.json`.
The script updates the version, commits, and creates a git tag.

## Adding Blocking Rules
1. Add new entries to `rules/rules.json` with a unique `id` (increment from last)
2. Use `requestDomains` for domain-based blocking, `urlFilter` for URL patterns
3. Always specify `resourceTypes` array
4. After editing, reload the extension in the browser

## Browser Support
- Chrome 88+ (MV3 base support)
- Edge 88+ (Chromium-based, same as Chrome)
- Firefox 128+ (MV3 + declarativeNetRequest)
- Opera 74+ (Chromium-based)

## Do NOT
- Add subscription/payment/nag features — this is free forever
- Add telemetry, analytics, or any data collection
- Add remote rule fetching — all rules are local
- Use `chrome.*` directly — always use the `api` alias
