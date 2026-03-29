'use strict';

// SilentBlock — Background Service Worker
// Cross-browser: Firefox uses `browser`, Chromium uses `chrome`
const api = typeof browser !== 'undefined' ? browser : chrome;

// =============================================
// UPDATE CHECKER
// =============================================
const UPDATE_CHECK_URL = 'https://api.github.com/repos/ccmrik/SilentBlock/releases/latest';
const UPDATE_CHECK_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours
const RELEASES_URL = 'https://github.com/ccmrik/SilentBlock/releases/latest';

function getCurrentVersion() {
  return api.runtime.getManifest().version;
}

function compareVersions(remote, local) {
  const r = remote.replace(/^v/, '').split('.').map(Number);
  const l = local.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((r[i] || 0) > (l[i] || 0)) return 1;
    if ((r[i] || 0) < (l[i] || 0)) return -1;
  }
  return 0;
}

async function checkForUpdate() {
  try {
    const resp = await fetch(UPDATE_CHECK_URL, {
      headers: { 'Accept': 'application/vnd.github.v3+json' },
      cache: 'no-cache'
    });
    if (!resp.ok) return;

    const data = await resp.json();
    const remoteVersion = (data.tag_name || '').replace(/^v/, '');
    const localVersion = getCurrentVersion();

    if (!remoteVersion) return;

    if (compareVersions(remoteVersion, localVersion) > 0) {
      // New version available — store it and notify
      api.storage.local.set({
        updateAvailable: remoteVersion,
        updateUrl: RELEASES_URL
      });

      // Show browser notification
      api.notifications.create('silentblock-update', {
        type: 'basic',
        iconUrl: 'icons/icon-on-128.png',
        title: 'SilentBlock Update Available',
        message: `Version ${remoteVersion} is available (you have ${localVersion}). Click the SilentBlock icon to update.`
      });
    } else {
      // Up to date — clear any stale update info
      api.storage.local.remove(['updateAvailable', 'updateUrl']);
    }
  } catch (_) {
    // Network error — silently ignore
  }
}

// Click notification → open releases page
api.notifications.onClicked.addListener((id) => {
  if (id === 'silentblock-update') {
    api.tabs.create({ url: RELEASES_URL });
  }
});

// Schedule periodic update checks
api.alarms.create('updateCheck', { periodInMinutes: 360 }); // 6 hours
api.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'updateCheck') {
    checkForUpdate();
  }
});

// =============================================
// TAB NAVIGATION TRACKING (for per-page ad counts)
// =============================================

// Track when each tab navigates so we count only current-page blocks
api.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    api.storage.session.set({
      ['navTime_' + tabId]: Date.now(),
      ['adCount_' + tabId]: 0
    });
  }
});

// Clean up when tabs close
api.tabs.onRemoved.addListener((tabId) => {
  api.storage.session.remove(['adCount_' + tabId, 'navTime_' + tabId]);
});

// =============================================
// CORE LOGIC
// =============================================

// Generate a stable numeric ID from a domain string for dynamic rules
function domainToId(domain) {
  let hash = 0;
  for (let i = 0; i < domain.length; i++) {
    hash = ((hash << 5) - hash + domain.charCodeAt(i)) | 0;
  }
  return (Math.abs(hash) % 900000) + 100000;
}

function setIcon(enabled) {
  const state = enabled ? 'on' : 'off';
  api.action.setIcon({
    path: {
      16: `icons/icon-${state}-16.png`,
      48: `icons/icon-${state}-48.png`,
      128: `icons/icon-${state}-128.png`
    }
  });
}

api.runtime.onInstalled.addListener(() => {
  api.storage.local.set({
    enabled: true,
    disabledSites: []
  });
  setIcon(true);

  // Check for updates on install/update
  checkForUpdate();
});

// Set correct icon on service worker startup
api.storage.local.get('enabled', (data) => {
  setIcon(data.enabled !== false);
});

api.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'getState') {
    api.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0] || !tabs[0].url) {
        sendResponse({ enabled: true, siteDisabled: false, hostname: '' });
        return;
      }
      try {
        const url = new URL(tabs[0].url);
        const hostname = url.hostname;
        api.storage.local.get(['enabled', 'disabledSites', 'updateAvailable', 'updateUrl'], (data) => {
          const disabledSites = data.disabledSites || [];
          sendResponse({
            enabled: data.enabled !== false,
            siteDisabled: disabledSites.includes(hostname),
            hostname,
            updateAvailable: data.updateAvailable || null,
            updateUrl: data.updateUrl || null
          });
        });
      } catch {
        sendResponse({ enabled: true, siteDisabled: false, hostname: '' });
      }
    });
    return true;
  }

  if (message.type === 'toggleSite') {
    const { hostname, disable } = message;
    api.storage.local.get(['disabledSites'], (data) => {
      let disabledSites = data.disabledSites || [];
      const ruleId = domainToId(hostname);

      if (disable) {
        if (!disabledSites.includes(hostname)) {
          disabledSites.push(hostname);
        }
        api.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: [ruleId],
          addRules: [{
            id: ruleId,
            priority: 2,
            action: { type: 'allowAllRequests' },
            condition: {
              requestDomains: [hostname],
              resourceTypes: ['main_frame', 'sub_frame']
            }
          }]
        });
      } else {
        disabledSites = disabledSites.filter(s => s !== hostname);
        api.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: [ruleId]
        });
      }

      api.storage.local.set({ disabledSites });
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === 'toggleGlobal') {
    const { enabled } = message;
    if (enabled) {
      api.declarativeNetRequest.updateEnabledRulesets({
        enableRulesetIds: ['rules']
      });
    } else {
      api.declarativeNetRequest.updateEnabledRulesets({
        disableRulesetIds: ['rules']
      });
    }
    setIcon(enabled);
    api.storage.local.set({ enabled });
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'adCount') {
    // Store per-tab ad count from content script
    if (sender.tab) {
      api.storage.session.set({ ['adCount_' + sender.tab.id]: message.count });
    }
    return false;
  }

  if (message.type === 'getAdCount') {
    api.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) { sendResponse({ count: 0 }); return; }
      const tabId = tabs[0].id;
      api.storage.session.get(['adCount_' + tabId, 'navTime_' + tabId], (data) => {
        const cosmeticCount = data['adCount_' + tabId] || 0;
        const navTime = data['navTime_' + tabId] || 0;

        // Get network-level blocked count from declarativeNetRequest
        // Works with activeTab permission (granted when popup opens)
        api.declarativeNetRequest.getMatchedRules({ tabId, minTimeStamp: navTime })
          .then((result) => {
            const networkCount = result.rulesMatchedInfo ? result.rulesMatchedInfo.length : 0;
            sendResponse({ count: cosmeticCount + networkCount });
          })
          .catch(() => {
            sendResponse({ count: cosmeticCount });
          });
      });
    });
    return true;
  }
});
