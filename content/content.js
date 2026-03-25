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
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
