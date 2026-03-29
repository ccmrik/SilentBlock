'use strict';

// SilentBlock — Page-context spoofing script
// Runs in MAIN world to bypass Content Security Policy restrictions.
// Neutralizes adblock detection libraries by defining fake objects before
// the page's own scripts run.

(function () {
  var noopFn = function () { return this; };
  var noopThis = function () { return this; };

  // === Site-disable support ===
  // Content script (ISOLATED world) dispatches __sb_disable when site is allowlisted
  var _sbActive = true;
  document.addEventListener('__sb_disable', function () { _sbActive = false; });

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
  var fakeAdsByGoogle = [];
  fakeAdsByGoogle.loaded = true;
  fakeAdsByGoogle.push = function () {};
  try {
    Object.defineProperty(window, 'adsbygoogle', {
      value: fakeAdsByGoogle,
      writable: false,
      configurable: false,
      enumerable: true
    });
  } catch (e) {
    window.adsbygoogle = fakeAdsByGoogle;
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

  // Freeze googletag so GTG-proxied scripts cannot overwrite it
  try {
    Object.defineProperty(window, 'googletag', {
      value: window.googletag,
      writable: false,
      configurable: false,
      enumerable: true
    });
  } catch (e) {}

  // === Google Tag (gtag.js) / GA4 / GTG Countermeasures ===
  // Neutralize gtag() — the primary function used by Google Tag and GA4
  // Must be frozen so first-party-proxied scripts can't reclaim it
  try {
    Object.defineProperty(window, 'gtag', {
      value: function () {},
      writable: false,
      configurable: false,
      enumerable: true
    });
  } catch (e) {
    window.gtag = function () {};
  }

  // Neutralize ga() — Universal Analytics
  var fakeGa = function () {};
  fakeGa.create = noopFn;
  fakeGa.getByName = function () { return null; };
  fakeGa.getAll = function () { return []; };
  fakeGa.remove = noopFn;
  fakeGa.loaded = true;
  fakeGa.q = [];
  try {
    Object.defineProperty(window, 'ga', {
      value: fakeGa,
      writable: false,
      configurable: false,
      enumerable: true
    });
  } catch (e) {
    window.ga = fakeGa;
  }

  // Lock GoogleAnalyticsObject reference
  try {
    Object.defineProperty(window, 'GoogleAnalyticsObject', {
      value: 'ga',
      writable: false,
      configurable: false
    });
  } catch (e) {}

  // Neutralize __gtagTracker used by some WordPress GA plugins
  try {
    Object.defineProperty(window, '__gtagTracker', {
      value: function () {},
      writable: false,
      configurable: false
    });
  } catch (e) {}

  // Neutralize Google Ads conversion tracking
  try {
    Object.defineProperty(window, 'google_trackConversion', {
      value: function () {},
      writable: false,
      configurable: false
    });
  } catch (e) {}

  // === Tracking request interception ===
  // Detect known Google tracking URL patterns (catches GTG first-party proxied endpoints)
  var _sbTrackingRe = /\/(g|j|r)\/collect[?\b]|\/gtag\/js[?\b]|\/gtm\.js[?\b]|\/gtag\/destination|google-analytics\.com|analytics\.google\.com|googletagmanager\.com|pagead\/viewthroughconversion|pagead\/landing|doubleclick\.net|googlesyndication\.com|googleadservices\.com/i;

  function _sbIsTrackingUrl(url) {
    return _sbTrackingRe.test(url);
  }

  // Notify content script (ISOLATED world) about intercepted tracking requests
  function _sbNotifyBlocked() {
    try { document.dispatchEvent(new CustomEvent('__sb_blocked')); } catch (e) {}
  }

  // Intercept navigator.sendBeacon for tracking payloads
  var origBeacon = navigator.sendBeacon;
  if (origBeacon) {
    navigator.sendBeacon = function (url, data) {
      if (_sbActive && _sbIsTrackingUrl(String(url || ''))) {
        _sbNotifyBlocked();
        return true; // Pretend success
      }
      return origBeacon.call(navigator, url, data);
    };
  }

  // Intercept fetch() for tracking requests
  var origFetch = window.fetch;
  window.fetch = function (input, init) {
    var urlStr = '';
    if (typeof input === 'string') {
      urlStr = input;
    } else if (input && input.url) {
      urlStr = input.url;
    }
    if (_sbActive && urlStr && _sbIsTrackingUrl(urlStr)) {
      _sbNotifyBlocked();
      return Promise.resolve(new Response('', { status: 200 }));
    }
    return origFetch.apply(window, arguments);
  };

  // Intercept XMLHttpRequest.open for tracking requests
  var origXHROpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    this._sbUrl = String(url || '');
    return origXHROpen.apply(this, arguments);
  };
  var origXHRSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (body) {
    if (_sbActive && this._sbUrl && _sbIsTrackingUrl(this._sbUrl)) {
      // Simulate successful empty response
      _sbNotifyBlocked();
      var self = this;
      setTimeout(function () {
        Object.defineProperty(self, 'readyState', { value: 4, configurable: true });
        Object.defineProperty(self, 'status', { value: 200, configurable: true });
        Object.defineProperty(self, 'responseText', { value: '', configurable: true });
        Object.defineProperty(self, 'response', { value: '', configurable: true });
        self.dispatchEvent(new Event('readystatechange'));
        self.dispatchEvent(new Event('load'));
        self.dispatchEvent(new Event('loadend'));
      }, 0);
      return;
    }
    return origXHRSend.apply(this, arguments);
  };

  // Intercept Image() constructor for tracking pixels
  var OrigImage = window.Image;
  window.Image = function (w, h) {
    var img = new OrigImage(w, h);
    var origSrcDesc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src') ||
                      Object.getOwnPropertyDescriptor(img.__proto__, 'src');
    if (origSrcDesc && origSrcDesc.set) {
      var origSrcSet = origSrcDesc.set;
      Object.defineProperty(img, 'src', {
        get: origSrcDesc.get ? origSrcDesc.get.bind(img) : function () { return ''; },
        set: function (val) {
          if (_sbActive && _sbIsTrackingUrl(String(val || ''))) {
            // Fire load event without actually loading
            _sbNotifyBlocked();
            setTimeout(function () { img.dispatchEvent(new Event('load')); }, 0);
            return;
          }
          return origSrcSet.call(img, val);
        },
        configurable: true,
        enumerable: true
      });
    }
    return img;
  };
  window.Image.prototype = OrigImage.prototype;

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
