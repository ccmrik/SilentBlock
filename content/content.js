'use strict';

// SilentBlock — Content Script
// Cosmetic filtering, popup prevention, and anti-adblock countermeasures

(function () {
  // Note: Popup blocker is in spoof.js (MAIN world) to intercept page-initiated popups.

  // =============================================
  // ANTI-ADBLOCK COUNTERMEASURES
  // =============================================

  // --- Bait elements ---
  // Plant multiple fake ad elements so detection scripts think ads loaded
  function plantBait() {
    if (!document.body) return;

    const baits = [
      { tag: 'div', id: 'ad_unit', className: 'ad_unit ad-unit textAd text-ad text_ad pub_300x250 pub_300x250m pub_728x90 text-ad textAd text_ads text-ads adsBox ad-placeholder' },
      { tag: 'ins', id: '', className: 'adsbygoogle', attrs: { 'data-ad-client': 'ca-pub-0000000000000000', 'data-ad-slot': '0000000000' } },
      { tag: 'div', id: 'google_ads_frame1', className: 'google-ad' },
      { tag: 'div', id: 'div-gpt-ad-1234567890', className: 'ad-slot' },
      { tag: 'div', id: '', className: 'ad-banner banner_ad adsense adUnit' },
    ];

    for (const b of baits) {
      const el = document.createElement(b.tag);
      if (b.id) el.id = b.id;
      el.className = b.className;
      // Must have non-zero computed size for detection scripts
      el.style.cssText = 'position:absolute!important;left:-9999px!important;top:-9999px!important;width:1px!important;height:1px!important;opacity:0.01!important;pointer-events:none!important;';
      if (b.attrs) {
        for (const [k, v] of Object.entries(b.attrs)) {
          el.setAttribute(k, v);
        }
      }
      document.body.appendChild(el);
    }
  }

  // Note: Ad detection spoofing (neutralizeDetectors) is now in spoof.js
  // which runs in MAIN world to avoid CSP inline-script violations.

  // --- Detect and destroy anti-adblock overlays and modals ---
  const ANTI_ADBLOCK_TEXT = [
    'ad blocker', 'adblocker', 'ad-blocker',
    'ads aren\'t being displayed', 'ads are blocked',
    'ad blocking', 'adblocking', 'ad-blocking',
    'disable your ad', 'turn off your ad', 'deactivate your ad',
    'whitelist', 'white list', 'white-list',
    'allow ads', 'enable ads', 'show ads',
    'ad blocker detected', 'adblock detected',
    'we noticed', 'we\'ve detected', 'we have detected',
    'please disable', 'please turn off', 'please deactivate',
    'support us by', 'support this site',
    'advertising helps', 'ads help keep',
    'ad-free experience', 'go ad-free',
    'subscribe to remove', 'premium ad-free',
  ];

  function textMatchesAntiAdblock(text) {
    const lower = text.toLowerCase();
    return ANTI_ADBLOCK_TEXT.some(phrase => lower.includes(phrase));
  }

  function isOverlayLike(el) {
    const style = getComputedStyle(el);
    const pos = style.position;
    const zIndex = parseInt(style.zIndex, 10) || 0;
    return (
      (pos === 'fixed' || pos === 'absolute') &&
      zIndex > 100
    );
  }

  function findAndDestroyAntiAdblockOverlays() {
    // Strategy 0: Remove anti-adblock <dialog> elements (Valnet sites use dialog.adblock with ::backdrop blur)
    const adblockDialogs = document.querySelectorAll('dialog.adblock, dialog[class*="adblock"], dialog[data-promotion-zone]');
    for (const dlg of adblockDialogs) {
      if (dlg.open) dlg.close();
      dlg.remove();
    }

    // Strategy 1: Find modals/overlays by position + z-index containing anti-adblock text
    const allEls = document.querySelectorAll('div, section, aside, dialog, [role="dialog"], [role="alertdialog"]');
    for (const el of allEls) {
      if (el.offsetWidth === 0 && el.offsetHeight === 0) continue;
      if (!isOverlayLike(el)) continue;

      const text = el.innerText || el.textContent || '';
      if (text.length > 5000) continue; // skip huge containers
      if (textMatchesAntiAdblock(text)) {
        el.remove();
      }
    }

    // Strategy 2: Find backdrop/overlay divs (full-screen, semi-transparent)
    const candidates = document.querySelectorAll('div[style], div[class]');
    for (const el of candidates) {
      const style = getComputedStyle(el);
      if (style.position !== 'fixed') continue;
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const winW = window.innerWidth;
      const winH = window.innerHeight;
      if (w >= winW * 0.9 && h >= winH * 0.9) {
        const bg = style.backgroundColor;
        const opacity = parseFloat(style.opacity);
        // Semi-transparent overlay backdrop
        if (bg.includes('rgba') || (opacity > 0 && opacity < 1)) {
          // Check if it or a sibling has anti-adblock text
          const parent = el.parentElement;
          if (parent) {
            const parentText = parent.innerText || '';
            if (textMatchesAntiAdblock(parentText)) {
              el.remove();
            }
          }
        }
      }
    }

    restoreScroll();
  }

  // --- Facebook sponsored ad blocking ---
  const isFacebook = location.hostname === 'www.facebook.com' || location.hostname === 'web.facebook.com' || location.hostname === 'm.facebook.com';

  // Strip zero-width/invisible Unicode chars that Facebook injects to break text matching
  function stripFbObfuscation(str) {
    // Remove zero-width characters, soft hyphens, direction marks, joiners, etc.
    return str.replace(/[\u200B\u200C\u200D\u200E\u200F\uFEFF\u00AD\u034F\u061C\u2060-\u2064\u206A-\u206F\u2800\u180E\u3164\uFFA0\u115F\u1160\u3000]/g, '');
  }

  function hideFacebookSponsoredPosts() {
    if (!isFacebook) return;
    let newCount = 0;

    // APPROACH: Walk ALL text nodes in the page using TreeWalker.
    // Find any text node that, after stripping invisible chars, contains "Sponsored".
    // Then walk up from that text node to find the enclosing post container and hide it.
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null
    );

    const sponsoredNodes = [];
    let textNode;
    while ((textNode = walker.nextNode())) {
      const raw = textNode.nodeValue || '';
      // Quick pre-filter: must have at least an 'S' and a 'p'
      if (raw.indexOf('S') === -1 && raw.indexOf('s') === -1) continue;
      const clean = stripFbObfuscation(raw).trim();
      if (clean === 'Sponsored' || clean === 'sponsored') {
        sponsoredNodes.push(textNode);
      }
    }

    // For each "Sponsored" text node found, find & hide the post container
    for (const node of sponsoredNodes) {
      const post = findFbPostContainer(node.parentElement);
      if (post && !post.dataset.sbFbHidden) {
        post.dataset.sbFbHidden = '1';
        post.style.setProperty('display', 'none', 'important');
        newCount++;
      }
    }

    // FALLBACK 1: Check <a> elements linking to /ads/about/
    const adLinks = document.querySelectorAll('a[href*="/ads/about"], a[href*="ads/about"], a[href*="/ad_center/"]');
    for (const link of adLinks) {
      const post = findFbPostContainer(link);
      if (post && !post.dataset.sbFbHidden) {
        post.dataset.sbFbHidden = '1';
        post.style.setProperty('display', 'none', 'important');
        newCount++;
      }
    }

    // FALLBACK 2: Check aria-label="Sponsored" on any element
    const ariaSponsored = document.querySelectorAll('[aria-label="Sponsored"], [aria-label="sponsored"]');
    for (const el of ariaSponsored) {
      const post = findFbPostContainer(el);
      if (post && !post.dataset.sbFbHidden) {
        post.dataset.sbFbHidden = '1';
        post.style.setProperty('display', 'none', 'important');
        newCount++;
      }
    }

    // FALLBACK 3: Check assembled text from parent spans
    // Facebook sometimes splits "Sponsored" across child elements with no direct text node
    // e.g. <span><span>S</span><span>p</span><span>o</span>...</span>
    const allSpans = document.querySelectorAll('span');
    for (const span of allSpans) {
      if (span.dataset.sbChecked) continue;
      // Only check small spans that could be the label
      const rect = span.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (rect.width > 250 || rect.height > 40) continue;
      // Get innerText (respects visibility) and check
      const visible = stripFbObfuscation(span.innerText || '').replace(/\s+/g, '').trim();
      if (visible === 'Sponsored' || visible === 'sponsored') {
        span.dataset.sbChecked = '1';
        const post = findFbPostContainer(span);
        if (post && !post.dataset.sbFbHidden) {
          post.dataset.sbFbHidden = '1';
          post.style.setProperty('display', 'none', 'important');
          newCount++;
        }
      }
    }

    if (newCount > 0) {
      adsBlocked += newCount;
      try {
        const api = typeof browser !== 'undefined' ? browser : chrome;
        api.runtime.sendMessage({ type: 'adCount', count: adsBlocked });
      } catch (_) {}
    }
  }

  function findFbPostContainer(el) {
    // Walk up from an element to find the Facebook post container.
    // ONLY return elements with a definitive structural marker.
    // Never use a vague fallback — that risks hiding the entire page.
    let node = el;
    let depth = 0;

    while (node && node !== document.body && depth < 30) {
      if (node.nodeType === 1) { // Element node
        // Check data-pagelet attribute (e.g. "FeedUnit_123", "StorySomething")
        const pagelet = node.getAttribute('data-pagelet') || '';
        if (pagelet.includes('FeedUnit') || pagelet.includes('Story')) return node;

        // Check role="article"
        if (node.getAttribute('role') === 'article') return node;

        // Check if this is a direct child of [role="feed"]
        const parent = node.parentElement;
        if (parent) {
          const parentRole = parent.getAttribute && parent.getAttribute('role');
          if (parentRole === 'feed') return node;
          const parentPagelet = parent.getAttribute && (parent.getAttribute('data-pagelet') || '');
          if (parentPagelet === 'Feed' || parentPagelet === 'feed') return node;
        }
      }
      node = node.parentElement;
      depth++;
    }

    // No structural marker found — do NOT hide anything
    return null;
  }

  // --- Dynamic cosmetic filtering ---
  const AD_SELECTORS = [
    'ins.adsbygoogle',
    '[id^="google_ads_"]',
    '[id^="div-gpt-ad"]',
    '[id^="taboola-"]',
    '.taboola-widget',
    '.trc_related_container',
    '.OUTBRAIN',
    '.ob-widget',
    '[data-google-query-id]',
    '[data-ad-slot]',
    '[data-ad-client]',
    '[data-native-ad]',
    '[class*="sponsored-banner"]',
    '.ad-overlay',
    '.popup-ad',
    '.interstitial-ad',
    '.ad-interstitial',
  ];

  // --- GTG (Google Tag Gateway) script detection ---
  // Detect and remove <script> tags loading Google tracking via first-party proxied paths
  const GTG_SCRIPT_PATTERNS = [
    /\/gtag\/js/i,
    /\/gtm\.js/i,
    /\/gtag\/destination/i,
    /\/analytics\.js.*google/i,
    /googletagmanager\.com/i,
    /google-analytics\.com/i,
    /googlesyndication\.com/i,
    /googleadservices\.com/i,
    /pagead\/js\//i,
    /pagead\/viewthroughconversion/i,
    /adsbygoogle\.js/i,
    /show_ads_impl/i,
  ];

  function isGtgScript(el) {
    if (el.tagName !== 'SCRIPT') return false;
    const src = el.src || el.getAttribute('src') || '';
    if (!src) return false;
    return GTG_SCRIPT_PATTERNS.some(re => re.test(src));
  }

  function neutralizeGtgScripts() {
    const scripts = document.querySelectorAll('script[src]');
    let newBlocked = 0;
    for (const script of scripts) {
      if (script.dataset.sbNeutralized) continue;
      if (isGtgScript(script)) {
        script.dataset.sbNeutralized = '1';
        script.remove();
        newBlocked++;
      }
    }
    if (newBlocked > 0) {
      adsBlocked += newBlocked;
      try {
        const api = typeof browser !== 'undefined' ? browser : chrome;
        api.runtime.sendMessage({ type: 'adCount', count: adsBlocked });
      } catch (_) {}
    }
  }

  const SELECTOR_STRING = AD_SELECTORS.join(',');

  let adsBlocked = 0;

  // Listen for tracking interceptions from spoof.js (MAIN world → ISOLATED world)
  document.addEventListener('__sb_blocked', () => {
    adsBlocked++;
    try {
      const api = typeof browser !== 'undefined' ? browser : chrome;
      api.runtime.sendMessage({ type: 'adCount', count: adsBlocked });
    } catch (_) {}
  });

  function hideAds() {
    try {
      const els = document.querySelectorAll(SELECTOR_STRING);
      let newBlocked = 0;
      for (let i = 0; i < els.length; i++) {
        if (!els[i].dataset.sbHidden) {
          els[i].dataset.sbHidden = '1';
          newBlocked++;
        }
        const s = els[i].style;
        s.setProperty('display', 'none', 'important');
        s.setProperty('visibility', 'hidden', 'important');
        s.setProperty('height', '0', 'important');
        s.setProperty('min-height', '0', 'important');
        s.setProperty('overflow', 'hidden', 'important');
      }
      if (newBlocked > 0) {
        adsBlocked += newBlocked;
        try {
          const api = typeof browser !== 'undefined' ? browser : chrome;
          api.runtime.sendMessage({ type: 'adCount', count: adsBlocked });
        } catch (_) {}
      }
    } catch (_) { /* ignore selector issues */ }
  }

  // --- Nuke overlay scroll-locks and interaction-blockers ---
  function restoreScroll() {
    const html = document.documentElement;
    const body = document.body;
    if (!body) return;

    // Remove overflow:hidden and pointer-events:none from html and body
    for (const el of [html, body]) {
      const s = getComputedStyle(el);
      if (s.overflow === 'hidden' || s.overflowY === 'hidden') {
        el.style.setProperty('overflow', 'auto', 'important');
        el.style.setProperty('overflow-y', 'auto', 'important');
      }
      if (s.position === 'fixed') {
        el.style.setProperty('position', 'static', 'important');
      }
      if (s.pointerEvents === 'none') {
        el.style.setProperty('pointer-events', 'auto', 'important');
      }
    }

    // Remove blur filters applied by anti-adblock scripts
    for (const el of [html, body]) {
      const s = getComputedStyle(el);
      if (s.filter && s.filter !== 'none') {
        el.style.setProperty('filter', 'none', 'important');
      }
      if (s.webkitFilter && s.webkitFilter !== 'none') {
        el.style.setProperty('-webkit-filter', 'none', 'important');
      }
    }
    // Sweep ALL elements for blur filters (sites apply blur to various wrappers)
    removeBlurFromAll();

    // Remove known scroll-lock classes
    const lockClasses = ['no-scroll', 'noscroll', 'modal-open', 'tp-modal-open', 'pw-open', 'scroll-locked', 'is-locked', 'has-overlay', 'overflow-hidden', 'adblock-modal-open'];
    for (const cls of lockClasses) {
      html.classList.remove(cls);
      body.classList.remove(cls);
    }

    // Remove any full-screen transparent overlay blocking pointer events
    const fixedEls = document.querySelectorAll('div[style*="position: fixed"], div[style*="position:fixed"]');
    for (const el of fixedEls) {
      const s = getComputedStyle(el);
      if (s.position !== 'fixed') continue;
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      if (w >= window.innerWidth * 0.9 && h >= window.innerHeight * 0.9) {
        const opacity = parseFloat(s.opacity);
        const bg = s.backgroundColor;
        // Transparent or nearly-transparent full-screen overlay
        if (opacity === 0 || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)' ||
            (s.pointerEvents !== 'none' && !el.textContent.trim())) {
          el.style.setProperty('pointer-events', 'none', 'important');
        }
      }
    }
  }

  // --- Remove blur from any element on the page ---
  function removeBlurFromAll() {
    // Check elements with inline style containing blur
    const blurred = document.querySelectorAll('[style*="blur"], [style*="filter"]');
    for (const el of blurred) {
      const s = getComputedStyle(el);
      if (s.filter && s.filter !== 'none' && s.filter.includes('blur')) {
        el.style.setProperty('filter', 'none', 'important');
      }
    }
    // Also check common structural elements that may get blur via stylesheet
    const structural = document.querySelectorAll('main, article, section, [role="main"], #content, #main, #wrapper, #app, .wrapper, .content, .main-content, .site-content, .page-content, .article-body');
    for (const el of structural) {
      const s = getComputedStyle(el);
      if (s.filter && s.filter !== 'none' && s.filter.includes('blur')) {
        el.style.setProperty('filter', 'none', 'important');
      }
    }
  }

  // --- Mutation observer for dynamically inserted ads & anti-adblock ---
  let antiAdblockCheckScheduled = false;

  const observer = new MutationObserver((mutations) => {
    let newContent = false;
    let styleChanged = false;
    for (const m of mutations) {
      if (m.addedNodes.length > 0) { newContent = true; }
      if (m.type === 'attributes' && m.attributeName === 'style') { styleChanged = true; }
      if (m.type === 'attributes' && m.attributeName === 'class') { styleChanged = true; }
      if (newContent && styleChanged) break;
    }
    if (newContent) {
      hideAds();
      neutralizeGtgScripts();
      if (isFacebook) hideFacebookSponsoredPosts();
    }
    if (newContent || styleChanged) {
      // Debounce anti-adblock checks (they're heavier)
      if (!antiAdblockCheckScheduled) {
        antiAdblockCheckScheduled = true;
        setTimeout(() => {
          findAndDestroyAntiAdblockOverlays();
          removeBlurFromAll();
          antiAdblockCheckScheduled = false;
        }, 300);
      }
    }
  });

  // --- Init ---
  function init() {
    plantBait();
    hideAds();
    neutralizeGtgScripts();
    hideFacebookSponsoredPosts();
    restoreScroll();

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class'],
    });

    // Run anti-adblock + deblur checks after page settles (walls/blur appear after delay)
    const postLoadCheck = () => { findAndDestroyAntiAdblockOverlays(); removeBlurFromAll(); };
    setTimeout(postLoadCheck, 1000);
    setTimeout(postLoadCheck, 3000);
    setTimeout(postLoadCheck, 6000);
    setTimeout(postLoadCheck, 10000);

    // Facebook: run sponsored post detection on scroll and periodically
    if (isFacebook) {
      // Periodic scan for sponsored posts loaded by infinite scroll
      setInterval(hideFacebookSponsoredPosts, 2000);
      // Also trigger on scroll (debounced)
      let fbScrollTimer;
      window.addEventListener('scroll', () => {
        clearTimeout(fbScrollTimer);
        fbScrollTimer = setTimeout(hideFacebookSponsoredPosts, 500);
      }, { passive: true });
    }
  }

  // --- Site-disable: check if blocking is disabled for this site ---
  function disableCosmeticCSS() {
    // Chrome injects manifest CSS as inline <style> elements (no href).
    // Find by our marker comment and remove them.
    function tryDisable() {
      const styles = document.querySelectorAll('style');
      for (const el of styles) {
        if (el.textContent && el.textContent.includes('SILENTBLOCK_COSMETIC')) {
          el.media = 'not all'; // Effectively disables the stylesheet
          el.dataset.sbDisabled = '1';
        }
      }
    }
    tryDisable();
    // Retry after DOM is ready (style elements may not exist yet at document_start)
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', tryDisable);
    }
    // One more retry in case of late injection
    setTimeout(tryDisable, 100);
  }

  function checkAndInit() {
    try {
      const extApi = typeof browser !== 'undefined' ? browser : chrome;
      const hostname = location.hostname;
      extApi.storage.local.get(['enabled', 'disabledSites'], (data) => {
        const enabled = data.enabled !== false;
        const disabledSites = data.disabledSites || [];
        const siteDisabled = !enabled || disabledSites.includes(hostname);

        if (siteDisabled) {
          // Signal spoof.js (MAIN world) to stop intercepting
          document.dispatchEvent(new CustomEvent('__sb_disable'));
          disableCosmeticCSS();
          return;
        }

        // Site is active — run normally
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', init);
        } else {
          init();
        }
      });
    } catch (_) {
      // Extension context invalid (e.g. orphaned script) — run anyway
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
      } else {
        init();
      }
    }
  }

  checkAndInit();
})();
