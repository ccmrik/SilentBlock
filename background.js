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
        iconUrl: 'icons/icon128.png',
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

api.runtime.onInstalled.addListener(() => {
  api.storage.local.set({
    enabled: true,
    disabledSites: []
  });
  api.action.setBadgeBackgroundColor({ color: '#00d26a' });
  api.action.setBadgeText({ text: 'ON' });

  // Check for updates on install/update
  checkForUpdate();
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
      api.action.setBadgeText({ text: 'ON' });
      api.action.setBadgeBackgroundColor({ color: '#00d26a' });
    } else {
      api.declarativeNetRequest.updateEnabledRulesets({
        disableRulesetIds: ['rules']
      });
      api.action.setBadgeText({ text: 'OFF' });
      api.action.setBadgeBackgroundColor({ color: '#666' });
    }
    api.storage.local.set({ enabled });
    sendResponse({ success: true });
    return true;
  }
});
