# SilentBlock

Free, silent ad blocker. No ads, no nags, no subscriptions. **Ever.**

## What it blocks

- **Ad networks** — Google Ads, DoubleClick, AdSense, Amazon Ads, Criteo, Taboola, Outbrain, and 150+ more ad-serving domains
- **Tracking & analytics** — Google Analytics, Hotjar, CrazyEgg, FullStory, ScoreCardResearch, and dozens more
- **Popups & popunders** — Blocks non-user-initiated `window.open()` calls
- **Cookie consent banners** — Hides GDPR/cookie nag overlays
- **Newsletter/signup popups** — OptinMonster, Sumo, Sleeknote, etc.
- **Push notification prompts** — OneSignal, PushCrew, etc.
- **Paywall overlays** — Piano, TinyPass, and similar nag screens
- **Chat widgets** — Intercom, Drift, HubSpot, Tawk (optional — edit the CSS if you want these back)

## How it works

| Layer | Mechanism |
|---|---|
| **Network blocking** | The browser's `declarativeNetRequest` API blocks requests to 150+ known ad/tracking domains before they even load |
| **Cosmetic filtering** | CSS hides common ad containers, banners, overlays, and annoyances |
| **Dynamic filtering** | Content script watches for dynamically inserted ads and hides them in real-time |
| **Anti-adblock** | Plants a bait element so sites think ads loaded successfully |

## Install

### Chrome / Edge / Brave / Opera

1. Open your browser and go to:
   - **Chrome**: `chrome://extensions`
   - **Edge**: `edge://extensions`
   - **Opera**: `opera://extensions`
   - **Brave**: `brave://extensions`
2. Turn on **Developer mode** (toggle in the top-right)
3. Click **Load unpacked**
4. Select the `SilentBlock` folder
5. Done. The green shield icon appears in your toolbar.

### Firefox

1. Open Firefox and go to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on...**
3. Select the `manifest.json` file inside the `SilentBlock` folder
4. Done. The green shield appears in your toolbar.

> **Firefox note:** Temporary add-ons are removed when Firefox restarts. For a permanent install,
> package the extension as a `.xpi` file and sign it via [addons.mozilla.org](https://addons.mozilla.org),
> or set `xpinstall.signatures.required` to `false` in `about:config` (Firefox Developer/Nightly only).

## Usage

- **Green shield + "ON" badge** = protection active
- Click the icon to open the popup:
  - **Protection** toggle — global on/off
  - **Block on this site** toggle — whitelist a specific site
- That's it. No settings pages, no accounts, no upsells.

## Adding more domains

Edit `rules/rules.json` and add new entries. Each rule follows this format:

```json
{
  "id": 31,
  "priority": 1,
  "action": { "type": "block" },
  "condition": {
    "requestDomains": ["example-ad-network.com"],
    "resourceTypes": ["sub_frame", "script", "image", "object", "xmlhttprequest", "ping", "media", "websocket", "font", "stylesheet", "other"]
  }
}
```

After editing, reload the extension:
- **Chrome/Edge/Opera/Brave**: go to `chrome://extensions` and click the refresh icon on SilentBlock
- **Firefox**: go to `about:debugging#/runtime/this-firefox` and click **Reload**

## File structure

```
SilentBlock/
├── manifest.json          # Extension manifest (MV3)
├── background.js          # Service worker — toggle logic
├── rules/
│   └── rules.json         # declarativeNetRequest blocking rules
├── content/
│   ├── cosmetic.css       # CSS to hide ad elements
│   └── content.js         # Dynamic ad hiding + popup blocker
├── popup/
│   ├── popup.html         # Popup UI
│   ├── popup.css          # Popup styles
│   └── popup.js           # Popup logic
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## License

Do whatever you want with it. No restrictions.
