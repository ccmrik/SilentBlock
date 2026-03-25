'use strict';

// SilentBlock — Page-context spoofing script
// Runs in MAIN world to bypass Content Security Policy restrictions.
// Neutralizes adblock detection libraries by defining fake objects before
// the page's own scripts run.

(function () {
  var noopFn = function () { return this; };
  var noopThis = function () { return this; };

  // === BlockAdBlock / FuckAdBlock / FAB ===
  var FakeBAB = function () {};
  FakeBAB.prototype.on = noopThis;
  FakeBAB.prototype.onDetected = noopThis;
  FakeBAB.prototype.onNotDetected = function (fn) {
    if (typeof fn === 'function') try { fn(); } catch (e) {}
    return this;
  };
  FakeBAB.prototype.setOption = noopThis;
  FakeBAB.prototype.check = noopThis;
  FakeBAB.prototype.emitEvent = noopThis;
  FakeBAB.prototype.clearEvent = noopThis;

  window.blockAdBlock = new FakeBAB();
  window.BlockAdBlock = FakeBAB;
  window.fuckAdBlock = window.blockAdBlock;
  window.FuckAdBlock = FakeBAB;
  window.fAB = window.blockAdBlock;
  window.sniffAdBlock = window.blockAdBlock;

  // === Admiral ===
  window.admiral = window.admiral || {};
  window.admiral.adblockDetected = false;

  // === Generic detection flags ===
  window.adBlockDetected = false;
  window.adblockDetected = false;
  window.canRunAds = true;
  window.canShowAds = true;
  window.isAdBlockActive = false;

  // === Valnet network (CarBuzz, ScreenRant, GameRant, etc.) ===
  // Freeze as accessor property so Valnet cannot overwrite with true
  try {
    Object.defineProperty(window, 'VALNET_GLOBAL_ISADBLOCK', {
      get: function () { return false; },
      set: function () {},
      configurable: false,
      enumerable: true
    });
  } catch (e) {
    // Fallback if defineProperty fails
    window.VALNET_GLOBAL_ISADBLOCK = false;
  }

  // === Google AdSense spoofing ===
  window.adsbygoogle = window.adsbygoogle || [];
  if (!window.adsbygoogle.loaded) {
    window.adsbygoogle.loaded = true;
    window.adsbygoogle.push = function () {};
  }

  // === GPT (Google Publisher Tags) spoofing ===
  window.googletag = window.googletag || {};
  window.googletag.cmd = window.googletag.cmd || [];
  window.googletag.apiReady = true;
  window.googletag.pubadsReady = true;
  if (!window.googletag.pubads) {
    var pa = {
      addEventListener: noopFn, clear: noopFn, clearCategoryExclusions: noopThis,
      clearTagForChildDirectedTreatment: noopThis, clearTargeting: noopThis,
      collapseEmptyDivs: noopFn,
      defineOutOfPagePassback: function () { return { display: noopFn, addService: noopThis }; },
      definePassback: function () { return { display: noopFn, addService: noopThis, setTargeting: noopThis }; },
      disableInitialLoad: noopFn, display: noopFn, enableAsyncRendering: noopFn,
      enableLazyLoad: noopFn, enableSingleRequest: noopFn, enableVideoAds: noopFn,
      get: noopFn, getAttributeKeys: function () { return []; }, getCorrelator: noopFn,
      getSlotIdMap: function () { return {}; }, getSlots: function () { return []; },
      getTargeting: function () { return []; }, getTargetingKeys: function () { return []; },
      isInitialLoadDisabled: function () { return false; },
      refresh: noopFn, removeEventListener: noopFn, set: noopThis,
      setCategoryExclusion: noopThis, setCentering: noopFn,
      setCookieOptions: noopThis, setForceSafeFrame: noopThis,
      setLocation: noopThis, setPrivacySettings: noopThis,
      setPublisherProvidedId: noopThis, setRequestNonPersonalizedAds: noopThis,
      setSafeFrameConfig: noopThis, setTagForChildDirectedTreatment: noopThis,
      setTargeting: noopThis, setVideoContent: noopThis,
      updateCorrelator: noopFn
    };
    window.googletag.pubads = function () { return pa; };
    window.googletag.companionAds = function () { return { addEventListener: noopFn, enableSyncLoading: noopFn, setRefreshUnfilledSlots: noopFn }; };
    window.googletag.content = function () { return { addEventListener: noopFn, setContent: noopFn }; };
    var slotProto = {
      addService: noopThis, clearCategoryExclusions: noopThis, clearTargeting: noopThis,
      defineSizeMapping: noopThis, get: noopFn, getAdUnitPath: noopFn,
      getAttributeKeys: function () { return []; }, getCategoryExclusions: function () { return []; },
      getResponseInformation: noopFn, getSlotElementId: noopFn,
      getTargeting: function () { return []; }, getTargetingKeys: function () { return []; },
      set: noopThis, setCategoryExclusion: noopThis, setClickUrl: noopThis,
      setCollapseEmptyDiv: noopThis, setForceSafeFrame: noopThis,
      setSafeFrameConfig: noopThis, setTargeting: noopThis, updateTargetingFromMap: noopThis
    };
    window.googletag.defineSlot = function () { return slotProto; };
    window.googletag.defineOutOfPageSlot = window.googletag.defineSlot;
    window.googletag.destroySlots = noopFn;
    window.googletag.disablePublisherConsole = noopFn;
    window.googletag.display = noopFn;
    window.googletag.enableServices = noopFn;
    window.googletag.getVersion = function () { return '2022070401'; };
    window.googletag.openConsole = noopFn;
    window.googletag.setAdIframeTitle = noopFn;
    window.googletag.sizeMapping = function () { return { addSize: noopThis, build: function () { return []; } }; };
  }

  // === Block blur filters from being applied by any script ===
  // Intercept CSSStyleDeclaration.setProperty to block blur
  var origSetProperty = CSSStyleDeclaration.prototype.setProperty;
  CSSStyleDeclaration.prototype.setProperty = function (prop, value, priority) {
    if ((prop === 'filter' || prop === '-webkit-filter' || prop === 'backdrop-filter' || prop === '-webkit-backdrop-filter') &&
        typeof value === 'string' && value.includes('blur')) {
      return;
    }
    return origSetProperty.call(this, prop, value, priority);
  };

  // Intercept direct .filter and .backdropFilter property assignment
  var props = [
    ['filter', 'filter'],
    ['webkitFilter', '-webkit-filter'],
    ['backdropFilter', 'backdrop-filter'],
    ['webkitBackdropFilter', '-webkit-backdrop-filter']
  ];
  props.forEach(function (pair) {
    var jsName = pair[0];
    try {
      var desc = Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype, jsName);
      if (desc && desc.set) {
        var origSet = desc.set;
        Object.defineProperty(CSSStyleDeclaration.prototype, jsName, {
          get: desc.get,
          set: function (val) {
            if (typeof val === 'string' && val.includes('blur')) {
              return;
            }
            return origSet.call(this, val);
          },
          configurable: true,
          enumerable: true
        });
      }
    } catch (e) {}
  });

  // Also intercept classList.add to block blur-related classes
  var origAdd = DOMTokenList.prototype.add;
  DOMTokenList.prototype.add = function () {
    var args = Array.prototype.slice.call(arguments);
    var filtered = args.filter(function (cls) {
      return !/\bblur\b/i.test(cls);
    });
    if (filtered.length > 0) {
      return origAdd.apply(this, filtered);
    }
  };
})();
