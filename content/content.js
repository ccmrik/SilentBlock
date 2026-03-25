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

  // --- Anti-adblock bait ---
  // Create a fake ad element so detection scripts think ads loaded
  function plantBait() {
    const bait = document.createElement('div');
    bait.className =
      'ad_unit ad-unit textAd text-ad text_ad pub_300x250 pub_300x250m pub_728x90 text-ad textAd text_ads text-ads adsBox';
    bait.setAttribute('id', 'ad_unit');
    bait.style.cssText =
      'position:absolute!important;left:-9999px!important;top:-9999px!important;width:1px!important;height:1px!important;pointer-events:none!important;';
    if (document.body) {
      document.body.appendChild(bait);
    }
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
    const locked =
      body.style.overflow === 'hidden' ||
      html.style.overflow === 'hidden' ||
      body.classList.contains('no-scroll') ||
      body.classList.contains('noscroll') ||
      body.classList.contains('modal-open');
    if (locked) {
      html.style.setProperty('overflow', 'auto', 'important');
      body.style.setProperty('overflow', 'auto', 'important');
      body.style.setProperty('position', 'static', 'important');
    }
  }

  // --- Mutation observer for dynamically inserted ads ---
  const observer = new MutationObserver((mutations) => {
    let dominated = false;
    for (const m of mutations) {
      if (m.addedNodes.length > 0) { dominated = true; break; }
    }
    if (dominated) {
      hideAds();
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
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
