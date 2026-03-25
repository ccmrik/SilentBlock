'use strict';

// SilentBlock — Background Service Worker
// Cross-browser: Firefox uses `browser`, Chromium uses `chrome`
const api = typeof browser !== 'undefined' ? browser : chrome;

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
        api.storage.local.get(['enabled', 'disabledSites'], (data) => {
          const disabledSites = data.disabledSites || [];
          sendResponse({
            enabled: data.enabled !== false,
            siteDisabled: disabledSites.includes(hostname),
            hostname
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
