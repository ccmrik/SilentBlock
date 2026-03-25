'use strict';

const api = typeof browser !== 'undefined' ? browser : chrome;

const globalToggle = document.getElementById('globalToggle');
const siteToggle = document.getElementById('siteToggle');
const siteName = document.getElementById('siteName');
const updateBanner = document.getElementById('updateBanner');
const updateText = document.getElementById('updateText');
const updateLink = document.getElementById('updateLink');

let currentHostname = '';

// Load current state
api.runtime.sendMessage({ type: 'getState' }, (res) => {
  if (!res) return;

  currentHostname = res.hostname;
  siteName.textContent = currentHostname || '\u2014';

  globalToggle.checked = res.enabled;
  siteToggle.checked = !res.siteDisabled;

  if (!res.enabled) {
    siteToggle.disabled = true;
  }

  // Show update banner if available
  if (res.updateAvailable) {
    updateText.textContent = `v${res.updateAvailable} available`;
    updateLink.href = res.updateUrl || '#';
    updateBanner.style.display = 'flex';
  }
});

// Global on/off
globalToggle.addEventListener('change', () => {
  const enabled = globalToggle.checked;
  api.runtime.sendMessage({ type: 'toggleGlobal', enabled });
  siteToggle.disabled = !enabled;
});

// Per-site on/off
siteToggle.addEventListener('change', () => {
  api.runtime.sendMessage({
    type: 'toggleSite',
    hostname: currentHostname,
    disable: !siteToggle.checked,
  });
});

// Load blocked ad count
api.runtime.sendMessage({ type: 'getAdCount' }, (res) => {
  if (res && typeof res.count === 'number') {
    document.getElementById('adCount').textContent = res.count;
  }
});
