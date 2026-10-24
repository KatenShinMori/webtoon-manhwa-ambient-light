/**
 * Webtoon & Manhwa Ambient Light
 * Popup Controller - V2.0 Enhanced Engine
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  const masterToggle = document.getElementById('masterToggle');
  const controlsWrapper = document.getElementById('controlsWrapper');
  const statusDot = document.getElementById('statusDot');
  const domainText = document.getElementById('domainText');

  const presetBtns = document.querySelectorAll('.preset-btn');
  const modeHaloBtn = document.getElementById('modeHaloBtn');
  const modeFullBleedBtn = document.getElementById('modeFullBleedBtn');

  const spreadRow = document.getElementById('spreadRow');
  const spreadSlider = document.getElementById('spreadSlider');
  const spreadVal = document.getElementById('spreadVal');

  const blurSlider = document.getElementById('blurSlider');
  const blurVal = document.getElementById('blurVal');

  const intensitySlider = document.getElementById('intensitySlider');
  const intensityVal = document.getElementById('intensityVal');

  const vibranceSlider = document.getElementById('vibranceSlider');
  const vibranceVal = document.getElementById('vibranceVal');

  const suppressGlareToggle = document.getElementById('suppressGlareToggle');
  const dualLayerToggle = document.getElementById('dualLayerToggle');
  const zenModeToggle = document.getElementById('zenModeToggle');
  const forceDarkToggle = document.getElementById('forceDarkToggle');
  const panelShadowToggle = document.getElementById('panelShadowToggle');
  const autoDetectToggle = document.getElementById('autoDetectToggle');
  const resetBtn = document.getElementById('resetBtn');

  // Presets definition
  const PRESETS = {
    cinema: {
      mode: 'halo',
      spread: 220,
      blur: 85,
      intensity: 55,
      vibrance: 140,
      suppressGlare: true,
      dualLayer: true,
      forceDark: true,
      panelShadow: true
    },
    vivid: {
      mode: 'halo',
      spread: 320,
      blur: 90,
      intensity: 75,
      vibrance: 240,
      suppressGlare: true,
      dualLayer: true,
      forceDark: true,
      panelShadow: true
    },
    oled: {
      mode: 'halo',
      spread: 260,
      blur: 70,
      intensity: 65,
      vibrance: 190,
      suppressGlare: true,
      dualLayer: true,
      forceDark: true,
      panelShadow: true
    },
    full: {
      mode: 'full-bleed',
      spread: 400,
      blur: 110,
      intensity: 70,
      vibrance: 200,
      suppressGlare: true,
      dualLayer: true,
      forceDark: true,
      panelShadow: true
    }
  };

  // Default state
  const DEFAULTS = {
    enabled: true,
    mode: 'halo',
    spread: 280,
    blur: 90,
    intensity: 65,
    vibrance: 180,
    suppressGlare: true,
    dualLayer: true,
    zenMode: false,
    forceDark: true,
    panelShadow: true,
    autoDetect: true,
    activePreset: 'custom'
  };

  let currentSettings = { ...DEFAULTS };
  let currentDomain = 'Unknown Site';
  let activeTabId = null;

  // 1. Identify active tab & domain
  try {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs && tabs.length > 0 && tabs[0].url) {
        activeTabId = tabs[0].id;
        try {
          const urlObj = new URL(tabs[0].url);
          currentDomain = urlObj.hostname || 'Local Page';
        } catch {
          currentDomain = tabs[0].title || 'Current Page';
        }
      }
    } else {
      currentDomain = 'Live Preview (Demo)';
    }
  } catch (e) {
    console.warn('Could not query active tab:', e);
  }

  domainText.textContent = currentDomain;

  // Reconnection helper for open tabs when extension was reloaded
  async function ensureContentScriptInjected(tabId) {
    if (!tabId || typeof chrome === 'undefined' || !chrome.scripting) return false;
    try {
      await chrome.scripting.insertCSS({
        target: { tabId },
        files: ['content.css']
      });
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js']
      });
      return true;
    } catch (err) {
      console.warn('[Popup] Dynamic script injection not supported on this page:', err);
      return false;
    }
  }

  let isReconnecting = false;
  async function sendMessageWithReconnect(tabId, message) {
    if (!tabId || typeof chrome === 'undefined' || !chrome.tabs || !chrome.tabs.sendMessage) {
      return null;
    }

    try {
      return await chrome.tabs.sendMessage(tabId, message);
    } catch (err) {
      // If content script was disconnected (extension reload on already open tab)
      if (!isReconnecting && typeof chrome.scripting !== 'undefined') {
        isReconnecting = true;
        try {
          const injected = await ensureContentScriptInjected(tabId);
          if (injected) {
            // Brief pause for script evaluation
            await new Promise(resolve => setTimeout(resolve, 80));
            const retryRes = await chrome.tabs.sendMessage(tabId, message);
            isReconnecting = false;
            return retryRes;
          }
        } catch (injectionErr) {
          console.warn('[Popup] Reconnect retry error:', injectionErr);
        } finally {
          isReconnecting = false;
        }
      }
      return null;
    }
  }

  // 2. Fetch current settings from content script (with reconnect) or storage
  let statusReceived = false;
  if (activeTabId) {
    try {
      const response = await sendMessageWithReconnect(activeTabId, { type: 'GET_STATUS' });
      if (response && response.settings) {
        statusReceived = true;
        currentSettings = { ...DEFAULTS, ...response.settings };
        updateUI(currentSettings);
      }
    } catch {
      // Content script not loaded or restricted page
    }
  }

  if (!statusReceived) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['globalSettings', 'domainOverrides'], (res) => {
        const global = res.globalSettings || {};
        const domainConfig = (res.domainOverrides && res.domainOverrides[currentDomain]) || {};
        const isBlocked = [
          'youtube.com', 'google.com', 'twitch.tv', 'reddit.com',
          'x.com', 'twitter.com', 'github.com', 'netflix.com',
          'facebook.com', 'instagram.com', 'bilibili.com', 'tiktok.com'
        ].some(d => currentDomain.toLowerCase() === d || currentDomain.toLowerCase().endsWith('.' + d));

        currentSettings = { ...DEFAULTS, ...global, ...domainConfig };
        if (isBlocked && !domainConfig.isManualOverride) {
          currentSettings.enabled = false;
        }
        updateUI(currentSettings);
      });
    } else {
      updateUI(currentSettings);
    }
  }

  // 3. UI update helper
  function updateUI(cfg) {
    masterToggle.checked = !!cfg.enabled;
    setControlsActive(cfg.enabled);

    // Mode
    setModeUI(cfg.mode || 'halo');

    // Preset highlighting
    updatePresetHighlight(cfg.activePreset);

    // Sliders
    spreadSlider.value = cfg.spread;
    spreadVal.textContent = `${cfg.spread}px`;

    blurSlider.value = cfg.blur;
    blurVal.textContent = `${cfg.blur}px`;

    intensitySlider.value = cfg.intensity;
    intensityVal.textContent = `${cfg.intensity}%`;

    vibranceSlider.value = cfg.vibrance;
    vibranceVal.textContent = `${cfg.vibrance}%`;

    // Toggles
    suppressGlareToggle.checked = typeof cfg.suppressGlare !== 'undefined' ? !!cfg.suppressGlare : true;
    dualLayerToggle.checked = typeof cfg.dualLayer !== 'undefined' ? !!cfg.dualLayer : true;
    zenModeToggle.checked = !!cfg.zenMode;
    forceDarkToggle.checked = !!cfg.forceDark;
    panelShadowToggle.checked = !!cfg.panelShadow;
    autoDetectToggle.checked = typeof cfg.autoDetect !== 'undefined' ? !!cfg.autoDetect : true;
  }

  function setControlsActive(isActive) {
    if (isActive) {
      controlsWrapper.classList.remove('disabled');
      statusDot.classList.remove('inactive');
    } else {
      controlsWrapper.classList.add('disabled');
      statusDot.classList.add('inactive');
    }
  }

  function setModeUI(mode) {
    currentSettings.mode = mode;
    if (mode === 'full-bleed') {
      modeFullBleedBtn.classList.add('active');
      modeHaloBtn.classList.remove('active');
    } else {
      modeHaloBtn.classList.add('active');
      modeFullBleedBtn.classList.remove('active');
    }
    // Spread slider is active in both modes:
    // Halo: controls horizontal margin aura reach
    // Full-Bleed: controls horizontal scale stretch
    spreadRow.style.opacity = '1';
    spreadRow.style.pointerEvents = 'auto';
  }

  function updatePresetHighlight(presetKey) {
    presetBtns.forEach(btn => {
      if (btn.dataset.preset === presetKey) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  function applyPreset(key) {
    const preset = PRESETS[key];
    if (!preset) return;

    currentSettings = {
      ...currentSettings,
      ...preset,
      activePreset: key
    };

    updateUI(currentSettings);
    notifyContentScript(true);
  }

  function clearPresetHighlight() {
    currentSettings.activePreset = 'custom';
    updatePresetHighlight('custom');
  }

  // 4. Live update dispatcher with cancellation queue
  let notifyRafId = null;
  let saveDiskTimer = null;

  function notifyContentScript(saveToDisk = false) {
    if (activeTabId && typeof chrome !== 'undefined' && chrome.tabs) {
      if (notifyRafId) cancelAnimationFrame(notifyRafId);
      notifyRafId = requestAnimationFrame(async () => {
        notifyRafId = null;
        await sendMessageWithReconnect(activeTabId, {
          type: 'UPDATE_SETTINGS',
          settings: currentSettings
        });
      });
    }

    if (saveToDisk && typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      clearTimeout(saveDiskTimer);
      saveDiskTimer = setTimeout(() => {
        chrome.storage.local.get(['domainOverrides'], (res) => {
          const overrides = res.domainOverrides || {};
          overrides[currentDomain] = { ...currentSettings };
          chrome.storage.local.set({ domainOverrides: overrides });
        });
      }, 120);
    }
  }

  // 5. Event Listeners
  masterToggle.addEventListener('change', async () => {
    currentSettings.enabled = masterToggle.checked;
    currentSettings.isManualOverride = true;
    setControlsActive(currentSettings.enabled);

    if (activeTabId) {
      await sendMessageWithReconnect(activeTabId, {
        type: 'TOGGLE_ENABLED',
        enabled: currentSettings.enabled,
        isManualOverride: true
      });
    }

    notifyContentScript(true);
  });

  // Presets click
  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      applyPreset(btn.dataset.preset);
    });
  });

  // Mode buttons
  modeHaloBtn.addEventListener('click', () => {
    clearPresetHighlight();
    setModeUI('halo');
    notifyContentScript(true);
  });

  modeFullBleedBtn.addEventListener('click', () => {
    clearPresetHighlight();
    setModeUI('full-bleed');
    notifyContentScript(true);
  });

  // Sliders (Live updates)
  spreadSlider.addEventListener('input', () => {
    clearPresetHighlight();
    currentSettings.spread = parseInt(spreadSlider.value, 10);
    spreadVal.textContent = `${currentSettings.spread}px`;
    notifyContentScript(false);
  });
  spreadSlider.addEventListener('change', () => notifyContentScript(true));

  blurSlider.addEventListener('input', () => {
    clearPresetHighlight();
    currentSettings.blur = parseInt(blurSlider.value, 10);
    blurVal.textContent = `${currentSettings.blur}px`;
    notifyContentScript(false);
  });
  blurSlider.addEventListener('change', () => notifyContentScript(true));

  intensitySlider.addEventListener('input', () => {
    clearPresetHighlight();
    currentSettings.intensity = parseInt(intensitySlider.value, 10);
    intensityVal.textContent = `${currentSettings.intensity}%`;
    notifyContentScript(false);
  });
  intensitySlider.addEventListener('change', () => notifyContentScript(true));

  vibranceSlider.addEventListener('input', () => {
    clearPresetHighlight();
    currentSettings.vibrance = parseInt(vibranceSlider.value, 10);
    vibranceVal.textContent = `${currentSettings.vibrance}%`;
    notifyContentScript(false);
  });
  vibranceSlider.addEventListener('change', () => notifyContentScript(true));

  // Toggles
  suppressGlareToggle.addEventListener('change', () => {
    clearPresetHighlight();
    currentSettings.suppressGlare = suppressGlareToggle.checked;
    notifyContentScript(true);
  });

  dualLayerToggle.addEventListener('change', () => {
    clearPresetHighlight();
    currentSettings.dualLayer = dualLayerToggle.checked;
    notifyContentScript(true);
  });

  zenModeToggle.addEventListener('change', () => {
    currentSettings.zenMode = zenModeToggle.checked;
    notifyContentScript(true);
  });

  forceDarkToggle.addEventListener('change', () => {
    clearPresetHighlight();
    currentSettings.forceDark = forceDarkToggle.checked;
    notifyContentScript(true);
  });

  panelShadowToggle.addEventListener('change', () => {
    clearPresetHighlight();
    currentSettings.panelShadow = panelShadowToggle.checked;
    notifyContentScript(true);
  });

  autoDetectToggle.addEventListener('change', () => {
    currentSettings.autoDetect = autoDetectToggle.checked;
    notifyContentScript(true);
  });

  // Reset defaults
  resetBtn.addEventListener('click', async () => {
    currentSettings = { ...DEFAULTS, enabled: masterToggle.checked };
    updateUI(currentSettings);

    if (activeTabId) {
      await sendMessageWithReconnect(activeTabId, {
        type: 'RESET_DEFAULTS'
      });
    }

    notifyContentScript(true);
  });
});
