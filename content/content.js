'use strict';

// SilentBlock — Content Script
// Cosmetic filtering, popup prevention, and anti-adblock countermeasures

(function () {
  // --- Popup blocker ---
  // Only allow window.open when triggered by a real user gesture
  let userGesture = false;

  function markGesture() {
    userGesture = true;
    setTimeout(() => { userGesture = false; }, 1000);
  }

  document.addEventListener('click', markGesture, true);
  document.addEventListener('pointerup', markGesture, true);
  document.addEventListener('keydown', markGesture, true);

  const nativeOpen = window.open;
  window.open = function (url, name, features) {
    if (userGesture) {
      return nativeOpen.call(window, url, name, features);
    }
    return null;
  };

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

  // --- Neutralize common adblock detection libraries ---
  function neutralizeDetectors() {
    const scriptEl = document.createElement('script');
    scriptEl.textContent = `
      // BlockAdBlock / FuckAdBlock / FAB
      (function() {
        var noopFn = function() { return this; };
        var noopThis = function() { return this; };

        // BlockAdBlock
        var FakeBAB = function() {};
        FakeBAB.prototype.on = noopThis;
        FakeBAB.prototype.onDetected = noopThis;
        FakeBAB.prototype.onNotDetected = function(fn) { if (typeof fn === 'function') try { fn(); } catch(e) {} return this; };
        FakeBAB.prototype.setOption = noopThis;
        FakeBAB.prototype.check = noopThis;
        FakeBAB.prototype.emitEvent = noopThis;
        FakeBAB.prototype.clearEvent = noopThis;

        window.blockAdBlock = new FakeBAB();
        window.BlockAdBlock = FakeBAB;

        // FuckAdBlock (same interface)
        window.fuckAdBlock = window.blockAdBlock;
        window.FuckAdBlock = FakeBAB;
        window.fAB = window.blockAdBlock;

        // sniffAdBlock
        window.sniffAdBlock = window.blockAdBlock;

        // Admiral / ad-block detection
        window.admiral = window.admiral || {};
        window.admiral.adblockDetected = false;

        // Generic detection flags
        window.adBlockDetected = false;
        window.adblockDetected = false;
        window.canRunAds = true;
        window.canShowAds = true;
        window.isAdBlockActive = false;

        // Google Ad Sense spoofing
        window.adsbygoogle = window.adsbygoogle || [];
        if (!window.adsbygoogle.loaded) {
          window.adsbygoogle.loaded = true;
          window.adsbygoogle.push = function() {};
        }

        // GPT (Google Publisher Tags) spoofing
        window.googletag = window.googletag || {};
        window.googletag.cmd = window.googletag.cmd || [];
        window.googletag.apiReady = true;
        window.googletag.pubadsReady = true;
        if (!window.googletag.pubads) {
          var pa = {
            addEventListener: noopFn, clear: noopFn, clearCategoryExclusions: noopThis,
            clearTagForChildDirectedTreatment: noopThis, clearTargeting: noopThis,
            collapseEmptyDivs: noopFn, defineOutOfPagePassback: function() { return { display: noopFn, addService: noopThis }; },
            definePassback: function() { return { display: noopFn, addService: noopThis, setTargeting: noopThis }; },
            disableInitialLoad: noopFn, display: noopFn, enableAsyncRendering: noopFn,
            enableLazyLoad: noopFn, enableSingleRequest: noopFn, enableVideoAds: noopFn,
            get: noopFn, getAttributeKeys: function() { return []; }, getCorrelator: noopFn,
            getSlotIdMap: function() { return {}; }, getSlots: function() { return []; },
            getTargeting: function() { return []; }, getTargetingKeys: function() { return []; },
            isInitialLoadDisabled: function() { return false; },
            refresh: noopFn, removeEventListener: noopFn, set: noopThis,
            setCategoryExclusion: noopThis, setCentering: noopFn,
            setCookieOptions: noopThis, setForceSafeFrame: noopThis,
            setLocation: noopThis, setPrivacySettings: noopThis,
            setPublisherProvidedId: noopThis, setRequestNonPersonalizedAds: noopThis,
            setSafeFrameConfig: noopThis, setTagForChildDirectedTreatment: noopThis,
            setTargeting: noopThis, setVideoContent: noopThis,
            updateCorrelator: noopFn
          };
          window.googletag.pubads = function() { return pa; };
          window.googletag.companionAds = function() { return { addEventListener: noopFn, enableSyncLoading: noopFn, setRefreshUnfilledSlots: noopFn }; };
          window.googletag.content = function() { return { addEventListener: noopFn, setContent: noopFn }; };
          window.googletag.defineSlot = function() { return { addService: noopThis, clearCategoryExclusions: noopThis, clearTargeting: noopThis, defineSizeMapping: noopThis, get: noopFn, getAdUnitPath: noopFn, getAttributeKeys: function() { return []; }, getCategoryExclusions: function() { return []; }, getResponseInformation: noopFn, getSlotElementId: noopFn, getTargeting: function() { return []; }, getTargetingKeys: function() { return []; }, set: noopThis, setCategoryExclusion: noopThis, setClickUrl: noopThis, setCollapseEmptyDiv: noopThis, setForceSafeFrame: noopThis, setSafeFrameConfig: noopThis, setTargeting: noopThis, updateTargetingFromMap: noopThis }; };
          window.googletag.defineOutOfPageSlot = window.googletag.defineSlot;
          window.googletag.destroySlots = noopFn;
          window.googletag.disablePublisherConsole = noopFn;
          window.googletag.display = noopFn;
          window.googletag.enableServices = noopFn;
          window.googletag.getVersion = function() { return '2022070401'; };
          window.googletag.openConsole = noopFn;
          window.googletag.setAdIframeTitle = noopFn;
          window.googletag.sizeMapping = function() { return { addSize: noopThis, build: function() { return []; } }; };
        }
      })();
    `;
    (document.head || document.documentElement).appendChild(scriptEl);
    scriptEl.remove();
  }

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

  const SELECTOR_STRING = AD_SELECTORS.join(',');

  function hideAds() {
    try {
      const els = document.querySelectorAll(SELECTOR_STRING);
      for (let i = 0; i < els.length; i++) {
        const s = els[i].style;
        s.setProperty('display', 'none', 'important');
        s.setProperty('visibility', 'hidden', 'important');
        s.setProperty('height', '0', 'important');
        s.setProperty('min-height', '0', 'important');
        s.setProperty('overflow', 'hidden', 'important');
      }
    } catch (_) { /* ignore selector issues */ }
  }

  // --- Nuke overlay scroll-locks ---
  function restoreScroll() {
    const html = document.documentElement;
    const body = document.body;
    if (!body) return;

    // Remove overflow:hidden from html and body
    for (const el of [html, body]) {
      const s = getComputedStyle(el);
      if (s.overflow === 'hidden' || s.overflowY === 'hidden') {
        el.style.setProperty('overflow', 'auto', 'important');
        el.style.setProperty('overflow-y', 'auto', 'important');
      }
      if (s.position === 'fixed' || s.position === 'sticky') {
        el.style.setProperty('position', 'static', 'important');
      }
    }

    // Remove known scroll-lock classes
    const lockClasses = ['no-scroll', 'noscroll', 'modal-open', 'tp-modal-open', 'pw-open', 'scroll-locked', 'is-locked', 'has-overlay', 'overflow-hidden', 'adblock-modal-open'];
    for (const cls of lockClasses) {
      html.classList.remove(cls);
      body.classList.remove(cls);
    }
  }

  // --- Mutation observer for dynamically inserted ads & anti-adblock ---
  let antiAdblockCheckScheduled = false;

  const observer = new MutationObserver((mutations) => {
    let newContent = false;
    for (const m of mutations) {
      if (m.addedNodes.length > 0) { newContent = true; break; }
    }
    if (newContent) {
      hideAds();

      // Debounce anti-adblock checks (they're heavier)
      if (!antiAdblockCheckScheduled) {
        antiAdblockCheckScheduled = true;
        setTimeout(() => {
          findAndDestroyAntiAdblockOverlays();
          antiAdblockCheckScheduled = false;
        }, 300);
      }
    }
  });

  // --- Init ---
  function init() {
    neutralizeDetectors();
    plantBait();
    hideAds();
    restoreScroll();

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    // Run anti-adblock checks after page settles (many walls appear after a delay)
    setTimeout(findAndDestroyAntiAdblockOverlays, 1000);
    setTimeout(findAndDestroyAntiAdblockOverlays, 3000);
    setTimeout(findAndDestroyAntiAdblockOverlays, 6000);
  }

  // Neutralize detectors as early as possible (before DOMContentLoaded)
  neutralizeDetectors();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
