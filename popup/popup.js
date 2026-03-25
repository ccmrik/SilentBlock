'use strict';

const api = typeof browser !== 'undefined' ? browser : chrome;

const globalToggle = document.getElementById('globalToggle');
const siteToggle = document.getElementById('siteToggle');
const siteName = document.getElementById('siteName');

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
