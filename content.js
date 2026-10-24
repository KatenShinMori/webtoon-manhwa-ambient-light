/**
 * Webtoon & Manhwa Ambient Light
 * Content Script - V2.3 Enhanced Engine
 *
 * Features:
 * - Anti-Flashbang Highlight Guard (SVG feComponentTransfer filter curve)
 * - Dual-Layer Depth Glow (Inner Core Halo + Outer Atmosphere Wash)
 * - Strict Vertical Synchronization (1:1 Y locking, object-fit: fill)
 * - 3-Tier Activation: 200+ Recognized Whitelist + Smart Auto-Detect + Blocklist
 * - Zen Cinema Mode (Auto-Dim Distracting Floating UI)
 * - Keyboard Shortcuts (Alt+A for Ambient Light, Alt+Z for Zen Mode)
 * - DOM Pooling & Viewport Virtualization
 */

(function () {
  'use strict';

  // Prevent duplicate execution
  if (window.__MANHWA_AMBIENT_INITIALIZED__) return;
  window.__MANHWA_AMBIENT_INITIALIZED__ = true;

  /* ============================================================
   * 1. DEFAULT CONFIGURATION & V2 STATE
   * ============================================================ */
  const DEFAULT_SETTINGS = {
    enabled: false, // OFF until auto-detect recognizes a manhwa reader, or you toggle it ON (popup / Alt+A)
    mode: 'halo', // 'halo' | 'full-bleed'
    spread: 280, // px outward spread in Halo mode (100 - 450)
    blur: 90, // px blur smoothness (40 - 160)
    intensity: 65, // % brightness / opacity (10 - 100)
    vibrance: 180, // % color saturation (100 - 300)
    forceDark: true, // Force #070709 dark background
    panelShadow: true, // Lateral elevation shadow on comic panels
    suppressGlare: true, // V2: Anti-Flashbang speech bubble highlight guard
    dualLayer: true, // V2: Dual-Layer Depth Glow (Core + Atmosphere)
    zenMode: false, // V2: Zen Cinema Mode (Dim floating UI)
    autoDetect: true, // V2: Auto-enable on detected manhwa reading pages
    activePreset: 'custom' // 'cinema' | 'vivid' | 'oled' | 'full' | 'custom'
  };

  const currentDomain = window.location.hostname || 'local';
  let settings = { ...DEFAULT_SETTINGS };
  let isActive = false;
  let userExplicitlyToggled = false;

  // DOM elements
  let svgFilterElement = null;
  let backdropElement = null;
  let stageElement = null;
  let canvasAtmosphere = null;
  let canvasCore = null;
  let toastElement = null;
  let toastTimer = null;

  // Tracking collections
  const candidateImages = new Set();
  const visibleImages = new Set();
  
  // Slice Map: originalImg -> { atmosphere: { container, imgEl }, core: { container, imgEl } }
  const sliceMap = new Map();

  // Observers & loop handles
  let intersectionObserver = null;
  let mutationObserver = null;
  let isSyncScheduled = false;
  let discoveryTimeout = null;

  /* ============================================================
   * 2. INITIALIZATION, STORAGE & DOMAIN BLOCKLIST
   * ============================================================ */

  // ------------------------------------------------------------
  // DEBUG LOGGING
  // Shows lines starting with "[Manhwa Ambient]" in the page console (F12).
  // Change `false` to `true` on the next line to enable verbose logging.
  // ------------------------------------------------------------
  const MANHWA_DEBUG = false;
  function debugLog(...args) {
    if (MANHWA_DEBUG) console.log('[Manhwa Ambient]', ...args);
  }

  // ------------------------------------------------------------
  // BLOCKED SITES — THIS IS THE ONE AND ONLY LIST
  // The ambient light will NEVER start on these sites (or any of their
  // subdomains) unless you deliberately flip the on/off toggle ON for that
  // site yourself (popup toggle or Alt+A).
  //
  // HOW TO ADD A SITE: add a new line with the main domain in quotes and a
  // comma at the end, e.g.   'example.com',
  // Don't include "www." or "https://". 'example.com' automatically covers
  // www.example.com, m.example.com and every other subdomain.
  // (So 'google.com' already covers gemini.google.com, mail.google.com, etc.)
  // ------------------------------------------------------------
  const AUTO_DETECT_DOMAIN_BLOCKLIST = [
    // Video & streaming
    'youtube.com',
    'twitch.tv',
    'netflix.com',
    'bilibili.com',
    'vimeo.com',
    'dailymotion.com',

    // Search & big platforms
    'google.com',
    'github.com',

    // Social media
    'reddit.com',
    'x.com',
    'twitter.com',
    'facebook.com',
    'instagram.com',
    'tiktok.com',
    'pinterest.com',
    'linkedin.com',
    'threads.net',
    'tumblr.com',
    'bsky.app',
    'snapchat.com',

    // Chat & messaging
    'discord.com',
    'web.telegram.org',
    'web.whatsapp.com',

    // AI tools
    'chatgpt.com',
    'chat.openai.com',
    'openai.com',
    'claude.ai',
    'anthropic.com',
    'perplexity.ai',
    'grok.com',
    'deepseek.com',
    'poe.com',
    'character.ai',
    'midjourney.com',
    'huggingface.co',
    'copilot.microsoft.com'
  ];

  // ------------------------------------------------------------
  // RECOGNIZED MANHWA / WEBTOON / MANGA PLATFORMS (WHITELIST)
  // Sites on this list are automatically recognized as manhwa/webtoon/manga
  // readers, so ambient light starts automatically on them (unless you
  // manually toggled the site OFF).
  //
  // Sites OUTSIDE this recognized list (and not in the blocklist) will
  // still use the Smart Auto-Detect heuristic (checking for 3+ stacked
  // manhwa images in a column) to automatically detect readers.
  //
  // HOW TO ADD A SITE: add a new line with the domain in quotes and a
  // comma at the end, e.g.   'example.com',
  // Subdomains are automatically covered (e.g. 'webtoons.com' covers
  // 'www.webtoons.com' and 'm.webtoons.com').
  // ------------------------------------------------------------
  const RECOGNIZED_MANHWA_WHITELIST = [
    // Official webtoon / manhwa platforms
    'webtoons.com',
    'manta.net',
    'tappytoon.com',
    'lezhinus.com',
    'lezhin.com',
    'tapas.io',
    'pocketcomics.com',
    'toomics.com',
    'comikey.com',
    'inkr.com',
    'mangatoon.mobi',
    'webcomicsapp.com',
    'webnovel.com',
    'lalatoon.com',
    'coolmic.me',
    'globalcomix.com',

    // Korean original platforms
    'comic.naver.com',
    'series.naver.com',
    'page.kakao.com',
    'webtoon.kakao.com',
    'ridibooks.com',
    'bomtoon.com',
    'toptoon.com',

    // Chinese / Asian comic platforms
    'kuaikanmanhua.com',
    'ac.qq.com',
    'dongmanmanhua.cn',
    'manhuaren.com',
    'piccoma.com',

    // Multilingual comic readers / aggregators
    'mangadex.org',
    'mangapark.io',
    'mangafire.to',
    'comick.dev',
    'comick.art',
    'comix.to',
    'bato.to',
    'mangabuddy.com',
    'mangakakalot.com',
    'manganato.com',
    'mangapill.com',
    'mangasee123.com',
    'weebcentral.com',
    'mangaowl.io',

    // Manhwa / manhua readers and scanlation sites
    'asuracomic.net',
    'asurascans.com',
    'aquareader.net',
    'toonily.com',
    'demonicscans.org',
    'manhuaplus.org',
    'manhuaus.com',
    'manhuaga.com',
    'manhuanext.com',
    'manhwaclan.com',
    'manhwa-freak.org',
    'manhwatop.com',
    'mangaread.org',
    'mangabat.com',
    'mangabats.com',
    'manganelo.com',
    'flamecomics.com',
    'thunderscans.com',
    'drakescans.com',
    'nightscans.net',
    // Official manga / comic platforms
    'mangaplus.shueisha.co.jp',
    'viz.com',
    'kmanga.kodansha.com',
    'kodansha.us',
    'yenpress.com',
    'sevenseasentertainment.com',
    'izepress.com',
    'global.bookwalker.jp',
    'bookwalker.jp',
    'azuki.co',
    'manga-up.com',
    'alpha-manga.com',
    'mangaplaza.com',
    'mangaplanet.com',
    'renta.com',
    'ebookrenta.com',
    'square-enix.com',
    'darkhorse.com',
    'hoopladigital.com',

    // Japanese manga platforms
    'manga.line.me',
    'comic-walker.com',
    'kadocomi.jp',
    'comic-days.com',
    'pocket.shonenmagazine.com',
    'shonenjumpplus.com',
    'tonarinoyj.jp',
    'sunday-webry.jp',
    'urasunday.com',
    'manga-one.com',
    'ganma.jp',
    'kuragebunch.com',
    'comic-zenon.com',
    'comic-fuz.com',
    'ganganonline.com',
    'magazinepocket.com',
    'yanmaga.jp',
    'comic.pixiv.net',
    'pixiv.net',
    'cmoa.jp',
    'ebookjapan.yahoo.co.jp',
    'booklive.jp',
    'mechacomic.jp',
    'dbook.docomo.ne.jp',
    'comic.k-manga.jp',

    // Korean comic / webtoon platforms
    'mrblue.com',
    'peanutoon.com',
    'foxtoon.com',
    'bookcube.com',
    'comico.kr',
    'munpia.com',
    'joara.com',
    'ktoon.com',

    // Other official comic platforms
    'mangatoon.com',
    'mangadraft.com',
    // Manga readers and aggregators
    'mangareader.to',
    'mangareader.cc',
    'manga4life.com',
    'mangahere.cc',
    'mangago.me',
    'mangakatana.com',
    'mangafreak.net',
    'mangakomi.io',
    'mangapuma.com',
    'mangahub.io',
    'mangapark.net',
    'mangairo.com',
    'mangasee.me',
    'mangazone.to',
    'mangaonlineteam.com',
    'mangaforfree.com',
    'mangatoto.com',
    'mangaflix.com',
    'mangakakalot.to',
    'readm.org',
    'mangaoi.net',
    'mangafast.net',
    'mangareaderx.com',
    'mangahasu.se',
    'mangabook.org',
    'mangafox.me',
    'mangapanda.in',
    'mangapanda.com',
    'mangaplus.me',
    'mangastream.to',
    'manganelo.tv',
    'manganato.to',
    'mangabat.vn',
    'mangabats.net',
    'mangaread.com',
    'mangago.to',
    'mangatx.com',
    'mangaclash.com',
    'zinmanga.com',
    'mgeko.cc',
    'kunmanga.com',
    'harimanga.com',
    '1stkissmanga.io',
    'xbato.com',
    'bato.si',
    'battwo.com',
    'comick.io',
    'mangadex.network',
    // Manhwa / webtoon reader candidates
    'manhwax.com',
    'manhwaweb.com',
    'manhwatop.org',
    'manhwaland.com',
    'manhwacomic.com',
    'manhwaread.com',
    'manhwaread.org',
    'manhwafull.com',
    'manhwahub.net',
    'manhwafreak.com',
    'manhwa18.net',
    'manhwaclan.org',
    'manhwaindo.id',
    'manhuafast.com',
    'manhuascan.com',
    'manhuascan.io',
    'topmanhua.com',
    'manhuaus.net',
    'manhuazone.com',
    'manhuagui.com',
    'manhuazhan.com',
    'manhuadb.com',
    'manhua.fzdm.com',
    'dm5.com',
    'baozimh.org',
    'colamanga.com',
    'ikanman.com',
    'manga.bilibili.com',
    // Indonesian / Southeast Asian reader candidates
    'komiku.id',
    'komiku.org',
    'komikcast.lol',
    'komikindo.id',
    'komikindo.pro',
    'komikindo.tv',
    'komikstation.co',
    'komikmama.net',
    'komikgue.com',
    'westmanga.info',
    'bacakomik.co',
    'bacakomik.tv',
    'komikindo.link',
    'komikindo.xyz',
    'komikfox.net'
  ];

  // True if hostname matches the recognized manhwa whitelist (exact or subdomain).
  function isWhitelistedHostname(hostname) {
    if (!hostname) return false;
    const h = String(hostname).toLowerCase().replace(/\.$/, '');
    return RECOGNIZED_MANHWA_WHITELIST.some(d => h === d || h.endsWith('.' + d));
  }

  // Checks the page's LIVE address against the recognized whitelist.
  function isWhitelistedDomain() {
    if (isWhitelistedHostname(window.location.hostname)) return true;
    try {
      const ancestors = window.location.ancestorOrigins;
      if (ancestors) {
        for (let i = 0; i < ancestors.length; i++) {
          if (isWhitelistedHostname(new URL(ancestors[i]).hostname)) return true;
        }
      }
    } catch (_) { /* ancestorOrigins not available - ignore */ }
    return false;
  }


  // True if a single hostname (e.g. "www.youtube.com") matches the list exactly or as a subdomain.
  function isBlockedHostname(hostname) {
    if (!hostname) return false;
    const h = String(hostname).toLowerCase().replace(/\.$/, '');
    // Whitelisted subdomains (like manga.bilibili.com) are exempt from general parent blocks
    if (isWhitelistedHostname(h)) return false;
    return AUTO_DETECT_DOMAIN_BLOCKLIST.some(d => h === d || h.endsWith('.' + d));
  }

  // Checks the page's LIVE address every time (never a cached copy).
  // If this script ever runs inside an embedded frame, the parent pages are checked
  // too, so a frame sitting inside YouTube is treated as YouTube.
  function isBlockedDomain() {
    if (isBlockedHostname(window.location.hostname)) return true;
    try {
      const ancestors = window.location.ancestorOrigins;
      if (ancestors) {
        for (let i = 0; i < ancestors.length; i++) {
          if (isBlockedHostname(new URL(ancestors[i]).hostname)) return true;
        }
      }
    } catch (_) { /* ancestorOrigins not available - ignore */ }
    return false;
  }

  // A blocked site may only run if YOU flipped the on/off toggle ON (popup toggle or Alt+A).
  // `overrideSource: 'toggle'` is only ever written by those two actions, so old
  // or accidental saved entries (e.g. from moving sliders) do not count.
  function hasDeliberateOverride(cfg) {
    return !!cfg &&
      cfg.enabled === true &&
      cfg.isManualOverride === true &&
      cfg.overrideSource === 'toggle';
  }

  // THE SINGLE CHOKE POINT: every code path that could start the light is checked here
  // (called from inside activateAmbientEngine() and checkAutoDetectHeuristic()).
  function isEngineAllowed(caller) {
    if (!isBlockedDomain()) return true;
    if (hasDeliberateOverride(settings)) {
      debugLog(`allowed on blocked site ${window.location.hostname} | requested by ${caller} | reason: you turned the toggle ON for this site`);
      return true;
    }
    debugLog(`blocked | ${caller} tried to start on ${window.location.hostname} | reason: site is on the blocklist and you have not toggled it ON`);
    return false;
  }

  // Shuts everything down if we're on a blocked site without a deliberate toggle.
  // Runs on startup and on in-page (single-page-app) navigation, e.g. YouTube video changes.
  function enforceBlocklist(trigger) {
    if (!isBlockedDomain() || hasDeliberateOverride(settings)) return;
    settings.enabled = false;
    const leftovers = document.getElementById('manhwa-ambient-stage') ||
      document.getElementById('manhwa-ambient-backdrop') ||
      document.getElementById('manhwa-ambient-svg-filters');
    if (isActive || leftovers) {
      debugLog(`shutting down | trigger: ${trigger} | reason: blocked site ${window.location.hostname}`);
      deactivateAmbientEngine(`enforceBlocklist (${trigger})`);
    }
  }

  function setupNavigationGuard() {
    ['popstate', 'hashchange', 'pageshow'].forEach(evt => {
      window.addEventListener(evt, () => {
        enforceBlocklist(evt);
        if (isWhitelistedDomain() && settings.autoDetect !== false && !userExplicitlyToggled && !isActive) {
          settings.enabled = true;
          activateAmbientEngine(`navigation (${evt}) (recognized manhwa whitelist)`);
        } else {
          // Single-page manhwa readers outside whitelist can switch chapters without reloading
          startAutoDetectWatch(evt);
        }
      });
    });
    // YouTube's own single-page navigation events
    ['yt-navigate-start', 'yt-navigate-finish'].forEach(evt => {
      document.addEventListener(evt, () => enforceBlocklist(evt));
    });
  }

  async function loadSettingsAndInit() {
    setupKeyboardShortcuts();
    setupNavigationGuard();

    const isBlocked = isBlockedDomain();
    debugLog(`init on ${window.location.hostname || 'local page'} | blocked site: ${isBlocked}`);

    // Don't report "enabled" on a blocked site while storage is still loading
    if (isBlocked) settings.enabled = false;

    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['globalSettings', 'domainOverrides'], (res) => {
          const global = res.globalSettings || {};
          const domainOverrides = res.domainOverrides || {};

          // Clean up stale saved settings for ANY blocked site that weren't created
          // by a deliberate on/off toggle.
          let cleaned = false;
          for (const host of Object.keys(domainOverrides)) {
            if (isBlockedHostname(host) && !hasDeliberateOverride(domainOverrides[host])) {
              debugLog(`removed stale saved settings for blocked site ${host}`);
              delete domainOverrides[host];
              cleaned = true;
            }
          }
          if (cleaned) chrome.storage.local.set({ domainOverrides });

          const domainConfig = domainOverrides[currentDomain];

          // Blocked site without a deliberate toggle -> stay completely inactive
          if (isBlocked && !hasDeliberateOverride(domainConfig)) {
            settings = {
              ...DEFAULT_SETTINGS,
              ...global,
              enabled: false,
              isManualOverride: false
            };
            userExplicitlyToggled = false;
            debugLog('blocked | loadSettingsAndInit | reason: blocked site, no toggle override saved - staying off');
            enforceBlocklist('loadSettingsAndInit');
            return;
          }

          // Did you deliberately flip the on/off toggle (or Alt+A) on this site?
          const manualOn = hasDeliberateOverride(domainConfig);
          const manualOff = !!domainConfig && domainConfig.isManualOverride === true && domainConfig.enabled === false;
          userExplicitlyToggled = manualOn || manualOff;

          settings = {
            ...DEFAULT_SETTINGS,
            ...global,
            ...(domainConfig || {}),
            // A saved "enabled: true" alone (e.g. from an earlier auto-detect or a slider
            // save) no longer starts the light. Only a deliberate toggle ON does.
            enabled: manualOn
          };

          if (manualOn) {
            activateAmbientEngine('loadSettingsAndInit (you toggled this site ON)');
          } else if (manualOff) {
            debugLog('staying off | loadSettingsAndInit | reason: you toggled this site OFF');
          } else if (isWhitelistedDomain() && settings.autoDetect !== false) {
            // Recognized manhwa/webtoon/manga platform: start automatically
            settings.enabled = true;
            activateAmbientEngine('loadSettingsAndInit (recognized manhwa whitelist)');
            debugLog(`recognized manhwa platform: ${window.location.hostname} -> ambient light activated`);
          } else {
            // Outside recognized list (or autoDetect turned off): watch with heuristic
            startAutoDetectWatch('page load (outside recognized whitelist)');
          }
        });
      } else {
        // Standalone demo page (test/demo.html, no chrome.storage): start straight away.
        // The blocklist guard inside activate still applies.
        settings.enabled = true;
        activateAmbientEngine('loadSettingsAndInit (demo page, no storage)');
      }
    } catch (err) {
      console.warn('[Manhwa Ambient] Storage initialization fallback:', err);
      if (isWhitelistedDomain() && settings.autoDetect !== false) {
        settings.enabled = true;
        activateAmbientEngine('loadSettingsAndInit (fallback, recognized manhwa whitelist)');
      } else {
        startAutoDetectWatch('storage error fallback');
      }
    }
  }

  /* ============================================================
   * 3. SMART AUTO-DETECT MANHWA LAYOUT HEURISTIC
   * ============================================================ */

  // Manhwa readers often load their images a bit later (lazy loading), so instead of
  // checking only once, we re-check a few times and whenever new images appear,
  // for up to AUTO_DETECT_WATCH_MS. The watch stops as soon as the light starts.
  const AUTO_DETECT_RETRY_DELAYS_MS = [300, 1500, 4000, 8000];
  const AUTO_DETECT_WATCH_MS = 60000;
  let autoDetectTimers = [];
  let autoDetectObserver = null;
  let autoDetectDebounce = null;

  function stopAutoDetectWatch() {
    autoDetectTimers.forEach(t => clearTimeout(t));
    autoDetectTimers = [];
    clearTimeout(autoDetectDebounce);
    if (autoDetectObserver) {
      autoDetectObserver.disconnect();
      autoDetectObserver = null;
    }
  }

  function canAutoDetectRun() {
    return !isActive && settings.autoDetect !== false && !userExplicitlyToggled && !isBlockedDomain();
  }

  function startAutoDetectWatch(reason) {
    stopAutoDetectWatch();
    if (!canAutoDetectRun()) {
      if (isBlockedDomain()) {
        debugLog(`auto-detect skipped | trigger: ${reason} | reason: blocked site`);
      } else if (!isActive) {
        debugLog(`auto-detect skipped | trigger: ${reason} | reason: ${settings.autoDetect === false ? 'auto-detect is turned off in the popup' : 'you toggled this site manually'}`);
      }
      return;
    }
    debugLog(`auto-detect watching for a manhwa reader | trigger: ${reason}`);

    const runCheck = (label) => {
      if (!canAutoDetectRun()) { stopAutoDetectWatch(); return; }
      checkAutoDetectHeuristic(label);
      if (isActive) stopAutoDetectWatch();
    };

    AUTO_DETECT_RETRY_DELAYS_MS.forEach(ms => {
      autoDetectTimers.push(setTimeout(() => runCheck(`${reason}, check after ${ms}ms`), ms));
    });

    // Re-check (debounced) when new images are added or lazy images get their real source
    if (document.body && typeof MutationObserver !== 'undefined') {
      autoDetectObserver = new MutationObserver(() => {
        clearTimeout(autoDetectDebounce);
        autoDetectDebounce = setTimeout(() => runCheck(`${reason}, new images appeared`), 700);
      });
      autoDetectObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['src', 'srcset']
      });
    }

    autoDetectTimers.push(setTimeout(() => {
      if (!isActive) debugLog(`auto-detect gave up | trigger: ${reason} | reason: no manhwa reader layout found`);
      stopAutoDetectWatch();
    }, AUTO_DETECT_WATCH_MS));
  }

  function checkAutoDetectHeuristic(caller = 'auto-detect') {
    if (isActive) return;
    if (!isEngineAllowed(`checkAutoDetectHeuristic (${caller})`)) return;

    // Strict Webtoon Strip Geometry Check:
    // 1. Rendered width >= 420px and rendered height >= 450px
    //    (explicitly ignore 16:9 video thumbnails where width / height > 1.4)
    //    Ignore images wrapped in <a href> links (video thumbnails, ad links)
    const allImages = Array.from(document.querySelectorAll('img')).filter(img => {
      if (img.closest('a[href]')) return false;

      const r = img.getBoundingClientRect();
      const w = r.width || img.naturalWidth || img.clientWidth;
      const h = r.height || img.naturalHeight || img.clientHeight;

      if (w < 420 || h < 450) return false;
      if (w / h > 1.4) return false;

      const style = window.getComputedStyle(img);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;

      return true;
    });

    if (allImages.length < 3) return;

    // Sort images by vertical document position
    allImages.sort((a, b) => {
      const rA = a.getBoundingClientRect();
      const rB = b.getBoundingClientRect();
      return rA.top - rB.top;
    });

    // Check for at least 3 consecutive images that are:
    // 2. Horizontally centered and aligned in the same single vertical column (diff < 15px)
    // 3. Stacked flush or nearly flush vertically (gap < 40px)
    let consecutiveCount = 1;
    let detectedStrip = false;

    for (let i = 0; i < allImages.length - 1; i++) {
      const rectA = allImages[i].getBoundingClientRect();
      const rectB = allImages[i + 1].getBoundingClientRect();

      const leftDiff = Math.abs(rectA.left - rectB.left);
      const widthDiff = Math.abs(rectA.width - rectB.width);
      const isColumnAligned = leftDiff < 15 && widthDiff < 15;

      const verticalGap = Math.abs(rectA.bottom - rectB.top);
      const isFlushStacked = verticalGap < 40;

      if (isColumnAligned && isFlushStacked) {
        consecutiveCount++;
        if (consecutiveCount >= 3) {
          detectedStrip = true;
          break;
        }
      } else {
        consecutiveCount = 1;
      }
    }

    if (detectedStrip) {
      settings.enabled = true;
      if (activateAmbientEngine('checkAutoDetectHeuristic (manhwa strip found)')) {
        showToast('Auto-detected Manhwa Reader', '✨');
      }
    }
  }

  /* ============================================================
   * 4. ENGINE ACTIVATION & TEARDOWN
   * ============================================================ */
  // Returns true if the engine is running after the call, false if it was refused.
  function activateAmbientEngine(caller = 'unknown') {
    if (isActive) return true;

    // Gate 1: the light must be switched ON for this page. Only these can do that:
    // auto-detect finding a manhwa reader, your popup toggle, Alt+A, or a saved
    // deliberate toggle. (Sliders/presets/messages can't set `enabled`.)
    if (settings.enabled !== true) {
      debugLog(`not started | ${caller} | reason: light is not switched on here (only auto-detect or your toggle can do that)`);
      return false;
    }

    // Gate 2 (safety net): no code path can start the light on a blocked site
    if (!isEngineAllowed(`activateAmbientEngine <- ${caller}`)) {
      settings.enabled = false;
      return false;
    }

    debugLog(`started by ${caller} on ${window.location.hostname || 'local page'}`);
    isActive = true;

    ensureSvgFilter();
    ensureStageElement();
    applySettingsToDOM();

    setupIntersectionObserver();
    setupMutationObserver();
    setupWindowListeners();

    discoverComicImages();
    scheduleSync();
    return true;
  }

  // Always does a full cleanup (even if we think we're already off), so no
  // leftover glow, backdrop, clones, SVG filter or Zen dimming can survive.
  function deactivateAmbientEngine(reason = 'unknown') {
    if (isActive) debugLog(`stopped | reason: ${reason}`);
    isActive = false;
    clearTimeout(discoveryTimeout);

    // Disconnect observers
    if (intersectionObserver) {
      intersectionObserver.disconnect();
      intersectionObserver = null;
    }
    if (mutationObserver) {
      mutationObserver.disconnect();
      mutationObserver = null;
    }

    // Remove window listeners
    window.removeEventListener('scroll', onScrollOrResize);
    window.removeEventListener('resize', onScrollOrResize);

    // Remove stage, backdrop, and filter elements
    if (stageElement && stageElement.parentNode) {
      stageElement.parentNode.removeChild(stageElement);
    }
    stageElement = null;
    canvasAtmosphere = null;
    canvasCore = null;

    if (backdropElement && backdropElement.parentNode) {
      backdropElement.parentNode.removeChild(backdropElement);
    }
    backdropElement = null;

    if (svgFilterElement && svgFilterElement.parentNode) {
      svgFilterElement.parentNode.removeChild(svgFilterElement);
    }
    svgFilterElement = null;

    // Clean tracking maps
    sliceMap.clear();
    visibleImages.clear();

    // Clean DOM classes
    document.body.classList.remove(
      'manhwa-ambient-active',
      'manhwa-ambient-force-dark',
      'manhwa-shadow-active',
      'manhwa-anti-glare-active',
      'manhwa-dual-layer-active',
      'manhwa-zen-active'
    );
    document.documentElement.classList.remove('manhwa-ambient-force-dark');

    // Remove source image marks
    for (const img of candidateImages) {
      img.classList.remove('manhwa-ambient-source');
      delete img.dataset.manhwaAmbientTracked;
    }
    candidateImages.clear();

    // Clear marked ancestor containers
    const containers = document.querySelectorAll('[data-manhwa-ambient-container="true"]');
    containers.forEach(el => el.removeAttribute('data-manhwa-ambient-container'));

    // Clear zen dimmed classes
    const dimmed = document.querySelectorAll('.manhwa-zen-dimmed');
    dimmed.forEach(el => el.classList.remove('manhwa-zen-dimmed'));

    // Remove any leftover injected elements by ID (e.g. from an older copy of this script)
    ['manhwa-ambient-stage', 'manhwa-ambient-backdrop', 'manhwa-ambient-svg-filters'].forEach(id => {
      const el = document.getElementById(id);
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
    document.querySelectorAll('.manhwa-clone-wrapper').forEach(el => el.remove());
    document.querySelectorAll('.manhwa-ambient-source').forEach(el => el.classList.remove('manhwa-ambient-source'));

    // Remove the CSS variables we set on the page root
    ['--blur', '--manhwa-blur', '--intensity', '--manhwa-intensity', '--vibrance',
      '--manhwa-vibrance', '--spread', '--manhwa-spread'].forEach(p => {
      document.documentElement.style.removeProperty(p);
    });
  }

  /* ============================================================
   * 5. SVG FILTER: ANTI-FLASHBANG SPEECH BUBBLE HIGHLIGHT GUARD
   * ============================================================ */
  function ensureSvgFilter() {
    if (svgFilterElement && document.body && document.body.contains(svgFilterElement)) return;

    svgFilterElement = document.getElementById('manhwa-ambient-svg-filters');
    if (svgFilterElement && svgFilterElement.parentNode) {
      svgFilterElement.parentNode.removeChild(svgFilterElement);
      svgFilterElement = null;
    }

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'manhwa-ambient-svg-filters';
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    // Off-screen fixed positioning without display:none or opacity:0 (Chromium ignores filters in display:none SVGs)
    svg.setAttribute('style', 'position: fixed; top: -9999px; left: -9999px; width: 0; height: 0; pointer-events: none;');
    svg.setAttribute('aria-hidden', 'true');

    svg.innerHTML = `
      <defs>
        <filter id="manhwa-highlight-guard" color-interpolation-filters="sRGB" x="-20%" y="-20%" width="140%" height="140%">
          <!-- 1. Create a grayscale luminance map -->
          <feColorMatrix type="saturate" values="0" in="SourceGraphic" result="gray" />
          <!-- 2. Isolate only bright highlights (>65% luminance) so darks/midtones are untouched -->
          <feComponentTransfer in="gray" result="whiteMask">
            <feFuncR type="table" tableValues="0 0 0 0 0 0.05 0.35 0.75 1.0" />
            <feFuncG type="table" tableValues="0 0 0 0 0 0.05 0.35 0.75 1.0" />
            <feFuncB type="table" tableValues="0 0 0 0 0 0.05 0.35 0.75 1.0" />
          </feComponentTransfer>
          <!-- 3. Subtract the bright white mask from original image (crushes white boxes by ~70% while keeping colors) -->
          <feComposite in="SourceGraphic" in2="whiteMask" operator="arithmetic" k1="0" k2="1.15" k3="-0.80" k4="0" result="suppressed" />
        </filter>
      </defs>
    `;

    svgFilterElement = svg;
    if (document.body) {
      document.body.insertBefore(svgFilterElement, document.body.firstChild);
    }
  }

  /* ============================================================
   * 6. STAGE & DUAL-LAYER CANVAS SETUP
   * ============================================================ */
  function ensureStageElement() {
    // Backdrop element (z-index: 0, solid #070709)
    if (!backdropElement || !document.body.contains(backdropElement)) {
      backdropElement = document.getElementById('manhwa-ambient-backdrop');
      if (!backdropElement) {
        backdropElement = document.createElement('div');
        backdropElement.id = 'manhwa-ambient-backdrop';
        backdropElement.setAttribute('aria-hidden', 'true');
      }
      if (document.body && !backdropElement.parentNode) {
        document.body.insertBefore(backdropElement, document.body.firstChild);
      }
    }

    // Stage element (z-index: 1, contains ambient canvases)
    if (!stageElement || !document.body.contains(stageElement)) {
      stageElement = document.getElementById('manhwa-ambient-stage');
      if (!stageElement) {
        stageElement = document.createElement('div');
        stageElement.id = 'manhwa-ambient-stage';
        stageElement.setAttribute('aria-hidden', 'true');

        // Atmosphere Canvas (Far Wash)
        canvasAtmosphere = document.createElement('div');
        canvasAtmosphere.className = 'manhwa-ambient-canvas ambient-layer-atmosphere';
        stageElement.appendChild(canvasAtmosphere);

        // Core Canvas (Near Halo)
        canvasCore = document.createElement('div');
        canvasCore.className = 'manhwa-ambient-canvas ambient-layer-core';
        stageElement.appendChild(canvasCore);
      } else {
        canvasAtmosphere = stageElement.querySelector('.ambient-layer-atmosphere');
        canvasCore = stageElement.querySelector('.ambient-layer-core');
      }

      if (document.body && !stageElement.parentNode) {
        if (backdropElement && backdropElement.nextSibling) {
          document.body.insertBefore(stageElement, backdropElement.nextSibling);
        } else {
          document.body.appendChild(stageElement);
        }
      }
    }

    return stageElement;
  }

  function applySettingsToDOM() {
    if (!isActive) return;

    document.body.classList.add('manhwa-ambient-active');

    // Panel Elevation Shadow
    if (settings.panelShadow) {
      document.body.classList.add('manhwa-shadow-active');
    } else {
      document.body.classList.remove('manhwa-shadow-active');
    }

    // Force Dark Background
    if (settings.forceDark) {
      document.body.classList.add('manhwa-ambient-force-dark');
      document.documentElement.classList.add('manhwa-ambient-force-dark');
    } else {
      document.body.classList.remove('manhwa-ambient-force-dark');
      document.documentElement.classList.remove('manhwa-ambient-force-dark');
    }

    // Anti-Glare Speech Bubble Highlight Guard
    if (settings.suppressGlare) {
      ensureSvgFilter();
      document.body.classList.add('manhwa-anti-glare-active');
    } else {
      document.body.classList.remove('manhwa-anti-glare-active');
    }

    // Dual-Layer Depth Glow
    if (settings.dualLayer) {
      document.body.classList.add('manhwa-dual-layer-active');
    } else {
      document.body.classList.remove('manhwa-dual-layer-active');
    }

    // Zen Cinema Mode
    updateZenMode();

    // CSS Custom Properties set on documentElement and stageElement
    const root = document.documentElement;
    const blurPx = settings.blur;
    const intensityFactor = (settings.intensity / 100).toFixed(2);
    const vibranceFactor = (settings.vibrance / 100).toFixed(2);
    const spreadPx = settings.spread;

    [root, stageElement].forEach(el => {
      if (!el) return;
      el.style.setProperty('--blur', `${blurPx}px`);
      el.style.setProperty('--manhwa-blur', `${blurPx}px`);
      el.style.setProperty('--intensity', intensityFactor);
      el.style.setProperty('--manhwa-intensity', intensityFactor);
      el.style.setProperty('--vibrance', vibranceFactor);
      el.style.setProperty('--manhwa-vibrance', vibranceFactor);
      el.style.setProperty('--spread', `${spreadPx}px`);
      el.style.setProperty('--manhwa-spread', `${spreadPx}px`);
    });

    // Clean SVG Highlight Guard Filter Chaining (evaluated before blur & saturation)
    const glarePrefix = settings.suppressGlare ? 'url(#manhwa-highlight-guard) ' : '';

    // 1. Atmosphere / Main Stage Layer
    if (canvasAtmosphere) {
      const atmosphereBlur = settings.dualLayer ? Math.round(blurPx * 1.1) : blurPx;
      canvasAtmosphere.style.filter = `${glarePrefix}blur(${atmosphereBlur}px) saturate(${vibranceFactor}) brightness(${intensityFactor})`;
      canvasAtmosphere.style.opacity = settings.dualLayer ? `${(settings.intensity / 100) * 0.75}` : `${intensityFactor}`;
      canvasAtmosphere.style.display = 'block';
    }

    // 2. Core Near Layer (Tighter blur, color anchor)
    if (canvasCore) {
      if (settings.dualLayer) {
        const coreBlur = Math.max(12, Math.round(blurPx * 0.45));
        canvasCore.style.filter = `${glarePrefix}blur(${coreBlur}px) saturate(${vibranceFactor}) brightness(${intensityFactor})`;
        canvasCore.style.opacity = `${(settings.intensity / 100) * 0.95}`;
        canvasCore.style.display = 'block';
      } else {
        canvasCore.style.display = 'none';
      }
    }

    // Update existing slice classes
    for (const [_, slicePair] of sliceMap) {
      const modeClass = settings.mode === 'full-bleed' ? 'mode-full-bleed' : 'mode-halo';
      const removeClass = settings.mode === 'full-bleed' ? 'mode-halo' : 'mode-full-bleed';

      if (slicePair.atmosphere) {
        slicePair.atmosphere.container.classList.add(modeClass);
        slicePair.atmosphere.container.classList.remove(removeClass);
      }
      if (slicePair.core) {
        slicePair.core.container.classList.add(modeClass);
        slicePair.core.container.classList.remove(removeClass);
      }
    }

    scheduleSync();
  }

  /* ============================================================
   * 7. ZEN CINEMA MODE (DIM DISTRACTING FLOATING UI)
   * ============================================================ */
  function updateZenMode() {
    if (settings.zenMode) {
      document.body.classList.add('manhwa-zen-active');

      // Scan page for fixed or sticky UI elements outside the reader column
      const allFixed = document.querySelectorAll('*');
      allFixed.forEach(el => {
        if (
          el.id === 'manhwa-ambient-stage' ||
          el.id === 'manhwa-ambient-backdrop' ||
          el.id === 'manhwa-ambient-toast' ||
          el.id === 'manhwa-ambient-svg-filters' ||
          el.closest('#manhwa-ambient-stage') ||
          el.closest('[data-manhwa-ambient-container="true"]') ||
          el.tagName === 'IMG' ||
          el.classList.contains('manhwa-ambient-source')
        ) {
          return;
        }

        const style = window.getComputedStyle(el);
        if (style.position === 'fixed' || style.position === 'sticky') {
          // Avoid dimming the entire body/html or reader containers
          const rect = el.getBoundingClientRect();
          if (rect.width < window.innerWidth * 0.95 || rect.height < window.innerHeight * 0.3) {
            el.classList.add('manhwa-zen-dimmed');
          }
        }
      });
    } else {
      document.body.classList.remove('manhwa-zen-active');
      const dimmed = document.querySelectorAll('.manhwa-zen-dimmed');
      dimmed.forEach(el => el.classList.remove('manhwa-zen-dimmed'));
    }
  }

  /* ============================================================
   * 8. COMIC IMAGE DETECTION HEURISTICS & ANCESTOR TRAVERSAL
   * ============================================================ */
  const NEGATIVE_KEYWORDS = [
    'avatar', 'logo', 'banner', 'badge', 'sponsor', 'icon',
    'emoji', 'spinner', 'ad-', 'ad_', 'advert', 'widget', 'thumb',
    'discord', 'patreon', 'button', 'arrow', 'rating', 'star'
  ];

  function isCandidateComicImage(img) {
    if (!img || !(img instanceof HTMLImageElement)) return false;

    if (
      img.closest('#manhwa-ambient-stage') ||
      img.closest('#manhwa-ambient-backdrop') ||
      img.closest('header, nav, footer')
    ) {
      return false;
    }

    const metaString = `${img.className} ${img.id} ${img.getAttribute('src') || ''} ${img.alt || ''}`.toLowerCase();
    for (const keyword of NEGATIVE_KEYWORDS) {
      if (metaString.includes(keyword)) return false;
    }

    const src = img.currentSrc || img.src || '';
    if (src.endsWith('.svg') || src.startsWith('data:image/svg')) {
      return false;
    }

    if (img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
      const isWideEnough = img.naturalWidth >= 320 || img.clientWidth >= 320;
      const isTallEnough = img.naturalHeight >= 200 || img.clientHeight >= 200;
      const isNotAdBanner = (img.naturalWidth / img.naturalHeight) < 4.2;
      return isWideEnough && isTallEnough && isNotAdBanner;
    }

    const isInsideReaderContainer = !!img.closest(
      '.reading-content, .reader-area, #_imageList, .rd-article, ' +
      '.chapter-container, .reader--container, #chapter-images, #viewer, ' +
      '[class*="reader"], [class*="chapter"], main, article'
    );

    const rect = img.getBoundingClientRect();
    if (rect.width >= 320 && rect.height >= 200) {
      return true;
    }

    return isInsideReaderContainer;
  }

  function trackComicImage(img) {
    if (candidateImages.has(img)) return;

    if (!img.complete || img.naturalWidth === 0) {
      img.addEventListener('load', () => {
        if (isCandidateComicImage(img)) {
          registerTrackedImage(img);
        }
      }, { once: true });
      return;
    }

    if (isCandidateComicImage(img)) {
      registerTrackedImage(img);
    }
  }

  function registerTrackedImage(img) {
    // An image that finishes loading after shutdown must not re-mark the page
    if (!isActive || candidateImages.has(img)) return;

    candidateImages.add(img);
    img.dataset.manhwaAmbientTracked = 'true';
    img.classList.add('manhwa-ambient-source');

    markAncestorContainers(img);

    if (intersectionObserver) {
      intersectionObserver.observe(img);
    }
  }

  function markAncestorContainers(img) {
    let el = img.parentElement;
    while (el && el !== document.body && el !== document.documentElement) {
      el.setAttribute('data-manhwa-ambient-container', 'true');
      el = el.parentElement;
    }
  }

  function discoverComicImages() {
    if (!isActive) return;

    const images = document.querySelectorAll('img:not([data-manhwa-ambient-tracked="true"])');
    for (let i = 0; i < images.length; i++) {
      trackComicImage(images[i]);
    }
  }

  /* ============================================================
   * 9. INTERSECTION OBSERVER & VIEWPORT VIRTUALIZATION
   * ============================================================ */
  function setupIntersectionObserver() {
    if (intersectionObserver) intersectionObserver.disconnect();

    intersectionObserver = new IntersectionObserver(
      (entries) => {
        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i];
          const img = entry.target;

          if (entry.isIntersecting) {
            visibleImages.add(img);
            ensureSlicePairFor(img);
          } else {
            visibleImages.delete(img);
            hideSlicePairFor(img);
          }
        }
        scheduleSync();
      },
      {
        root: null,
        rootMargin: '300px 0px 300px 0px',
        threshold: 0
      }
    );

    for (const img of candidateImages) {
      intersectionObserver.observe(img);
    }
  }

  /* ============================================================
   * 10. MUTATION OBSERVER (LAZY LOADING & SPA NAV)
   * ============================================================ */
  function setupMutationObserver() {
    if (mutationObserver) mutationObserver.disconnect();

    mutationObserver = new MutationObserver((mutations) => {
      let shouldScan = false;

      for (let i = 0; i < mutations.length; i++) {
        const m = mutations[i];

        if (m.type === 'childList' && m.addedNodes.length > 0) {
          for (let j = 0; j < m.addedNodes.length; j++) {
            const node = m.addedNodes[j];
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.tagName === 'IMG' || node.querySelector('img')) {
                shouldScan = true;
                break;
              }
            }
          }
        } else if (m.type === 'attributes') {
          const target = m.target;
          if (target && target.tagName === 'IMG') {
            if (candidateImages.has(target)) {
              const pair = sliceMap.get(target);
              const newSrc = target.currentSrc || target.src;
              if (pair && newSrc) {
                if (pair.atmosphere && pair.atmosphere.imgEl.src !== newSrc) {
                  pair.atmosphere.imgEl.src = newSrc;
                }
                if (pair.core && pair.core.imgEl.src !== newSrc) {
                  pair.core.imgEl.src = newSrc;
                }
              }
            } else {
              shouldScan = true;
            }
          }
        }
        if (shouldScan) break;
      }

      if (shouldScan) {
        clearTimeout(discoveryTimeout);
        discoveryTimeout = setTimeout(() => {
          discoverComicImages();
          scheduleSync();
        }, 80);
      }
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'srcset', 'data-src', 'data-lazy-src', 'loading']
    });
  }

  /* ============================================================
   * 11. DUAL-LAYER SLICE MANAGEMENT & RECYCLING
   * ============================================================ */
  function createSliceElement(parentCanvas, modeClass) {
    const container = document.createElement('div');
    container.className = `manhwa-ambient-slice manhwa-clone-wrapper ${modeClass}`;

    const imgEl = document.createElement('img');
    imgEl.decoding = 'async';
    imgEl.loading = 'eager';
    imgEl.className = 'manhwa-clone-img';
    imgEl.style.objectFit = 'fill';
    imgEl.style.width = '64px';
    imgEl.style.height = '100%';
    imgEl.style.filter = 'blur(18px)';

    container.appendChild(imgEl);
    parentCanvas.appendChild(container);

    return { container, imgEl };
  }

  function ensureSlicePairFor(originalImg) {
    if (!stageElement) ensureStageElement();

    let pair = sliceMap.get(originalImg);
    const modeClass = settings.mode === 'full-bleed' ? 'mode-full-bleed' : 'mode-halo';
    const targetSrc = originalImg.currentSrc || originalImg.src;

    if (!pair) {
      const atmosphereSlice = createSliceElement(canvasAtmosphere, modeClass);
      atmosphereSlice.imgEl.src = targetSrc;

      let coreSlice = null;
      if (canvasCore) {
        coreSlice = createSliceElement(canvasCore, modeClass);
        coreSlice.imgEl.src = targetSrc;
      }

      pair = { atmosphere: atmosphereSlice, core: coreSlice };
      sliceMap.set(originalImg, pair);
    } else {
      if (pair.atmosphere) {
        if (targetSrc && pair.atmosphere.imgEl.src !== targetSrc) {
          pair.atmosphere.imgEl.src = targetSrc;
        }
        pair.atmosphere.container.style.display = 'block';
      }
      if (pair.core) {
        if (targetSrc && pair.core.imgEl.src !== targetSrc) {
          pair.core.imgEl.src = targetSrc;
        }
        pair.core.container.style.display = 'block';
      }
    }

    return pair;
  }

  function hideSlicePairFor(originalImg) {
    const pair = sliceMap.get(originalImg);
    if (pair) {
      if (pair.atmosphere) pair.atmosphere.container.style.display = 'none';
      if (pair.core) pair.core.container.style.display = 'none';
    }
  }

  function removeSlicePairFor(originalImg) {
    const pair = sliceMap.get(originalImg);
    if (pair) {
      if (pair.atmosphere && pair.atmosphere.container.parentNode) {
        pair.atmosphere.container.parentNode.removeChild(pair.atmosphere.container);
      }
      if (pair.core && pair.core.container.parentNode) {
        pair.core.container.parentNode.removeChild(pair.core.container);
      }
      sliceMap.delete(originalImg);
    }
  }

  function setupWindowListeners() {
    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize, { passive: true });
  }

  function onScrollOrResize() {
    scheduleSync();
  }

  function scheduleSync() {
    if (isSyncScheduled || !isActive) return;
    isSyncScheduled = true;
    requestAnimationFrame(syncVisibleSlices);
  }

  /**
   * Main synchronization loop with DOM Pooling / Virtualization:
   * Only renders clones within [-1.5x viewport, +2.5x viewport] range.
   * Locks top and height with -2px subpixel overlap.
   * Atmosphere layer gets full spread; Core layer gets tighter halo (~0.42x spread).
   */
  function syncVisibleSlices() {
    isSyncScheduled = false;
    if (!isActive) return;

    const viewportH = window.innerHeight;
    const isFullBleed = settings.mode === 'full-bleed';
    const spread = settings.spread;

    // Viewport Virtualization bounds (DOM Pooling)
    const minY = -viewportH * 1.5;
    const maxY = viewportH * 2.5;

    for (const originalImg of visibleImages) {
      if (!originalImg.isConnected) {
        visibleImages.delete(originalImg);
        removeSlicePairFor(originalImg);
        continue;
      }

      const rect = originalImg.getBoundingClientRect();

      // Detach or hide out-of-range clones to save GPU memory on 150+ image chapters
      if (rect.width === 0 || rect.height === 0 || rect.bottom < minY || rect.top > maxY) {
        hideSlicePairFor(originalImg);
        continue;
      }

      const pair = ensureSlicePairFor(originalImg);
      const src = originalImg.currentSrc || originalImg.src;

      // Sync src
      if (src) {
        if (pair.atmosphere && pair.atmosphere.imgEl.src !== src) pair.atmosphere.imgEl.src = src;
        if (pair.core && pair.core.imgEl.src !== src) pair.core.imgEl.src = src;
      }

      // Vertical bounds: 100% locked to panel with -2px subpixel overlap
      const top = Math.floor(rect.top) - 1;
      const height = Math.ceil(rect.height) + 2;

      // 1. Atmosphere Layer (Outer Wash / Main Stage)
      if (pair.atmosphere) {
        pair.atmosphere.container.style.top = `${top}px`;
        pair.atmosphere.container.style.height = `${height}px`;

        if (isFullBleed) {
          const targetWidth = window.innerWidth;
          pair.atmosphere.container.style.left = '0px';
          pair.atmosphere.container.style.width = '100vw';
          const bleedScale = 1 + ((spread - 100) / 350) * 0.45;
          const scaledWidth = targetWidth * bleedScale;
          const scaleX = (scaledWidth / 64).toFixed(3);
          const offsetX = Math.round((targetWidth - scaledWidth) / 2);
          pair.atmosphere.imgEl.style.left = `${offsetX}px`;
          pair.atmosphere.imgEl.style.transform = `scaleX(${scaleX})`;
          pair.atmosphere.imgEl.style.transformOrigin = 'left center';
        } else {
          const left = Math.round(rect.left - spread);
          const targetWidth = Math.round(rect.width + spread * 2);
          pair.atmosphere.container.style.left = `${left}px`;
          pair.atmosphere.container.style.width = `${targetWidth}px`;
          const scaleX = (targetWidth / 64).toFixed(3);
          pair.atmosphere.imgEl.style.left = '0px';
          pair.atmosphere.imgEl.style.transform = `scaleX(${scaleX})`;
          pair.atmosphere.imgEl.style.transformOrigin = 'left center';
        }
        pair.atmosphere.container.style.display = 'block';
      }

      // 2. Core Layer (Near Halo: Tighter spread = calc(var(--spread) * 0.5))
      if (pair.core && settings.dualLayer) {
        pair.core.container.style.top = `${top}px`;
        pair.core.container.style.height = `${height}px`;

        if (isFullBleed) {
          const targetWidth = window.innerWidth;
          pair.core.container.style.left = '0px';
          pair.core.container.style.width = '100vw';
          const coreBleedScale = 1 + ((spread - 100) / 350) * 0.22;
          const scaledWidth = targetWidth * coreBleedScale;
          const scaleX = (scaledWidth / 64).toFixed(3);
          const offsetX = Math.round((targetWidth - scaledWidth) / 2);
          pair.core.imgEl.style.left = `${offsetX}px`;
          pair.core.imgEl.style.transform = `scaleX(${scaleX})`;
          pair.core.imgEl.style.transformOrigin = 'left center';
        } else {
          const coreSpread = Math.max(30, Math.round(spread * 0.5));
          const coreLeft = Math.round(rect.left - coreSpread);
          const targetWidth = Math.round(rect.width + coreSpread * 2);
          pair.core.container.style.left = `${coreLeft}px`;
          pair.core.container.style.width = `${targetWidth}px`;
          const scaleX = (targetWidth / 64).toFixed(3);
          pair.core.imgEl.style.left = '0px';
          pair.core.imgEl.style.transform = `scaleX(${scaleX})`;
          pair.core.imgEl.style.transformOrigin = 'left center';
        }
        pair.core.container.style.display = 'block';
      }
    }
  }

  /* ============================================================
   * 12. SLEEK TOAST NOTIFICATIONS
   * ============================================================ */
  function showToast(message, icon = '✨') {
    if (!toastElement) {
      toastElement = document.createElement('div');
      toastElement.id = 'manhwa-ambient-toast';
      document.body.appendChild(toastElement);
    }

    toastElement.innerHTML = `<span class="manhwa-toast-icon">${icon}</span><span>${message}</span>`;
    toastElement.classList.add('show');

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      if (toastElement) {
        toastElement.classList.remove('show');
      }
    }, 1500);
  }

  /* ============================================================
   * 13. KEYBOARD SHORTCUTS (Alt+A & Alt+Z)
   * ============================================================ */
  function setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      // Check if user is typing in an input or textarea
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;

      // Alt + A: Toggle Ambient Light (a deliberate toggle -> may override the blocklist)
      if (e.altKey && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        userExplicitlyToggled = true;
        settings.enabled = !settings.enabled;
        settings.isManualOverride = true;
        settings.overrideSource = 'toggle';
        if (settings.enabled) {
          if (activateAmbientEngine('Alt+A shortcut')) {
            showToast('Ambient Light: Enabled', '✨');
          }
        } else {
          deactivateAmbientEngine('Alt+A shortcut (turned off)');
          showToast('Ambient Light: Disabled', '🌙');
        }
        saveSettingsForDomain(true);
      }

      // Alt + Z: Toggle Zen Cinema Mode (NOT a deliberate on/off toggle)
      if (e.altKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        // Zen only works while the light is running; it never switches the light on
        if (!isActive) {
          if (!isBlockedDomain()) {
            showToast('Ambient Light is off here — press Alt+A to turn it on', '🌙');
          }
          debugLog('Alt+Z ignored | reason: light is not running on this page');
          return;
        }
        settings.zenMode = !settings.zenMode;
        updateZenMode();
        showToast(settings.zenMode ? 'Zen Cinema Mode: Active' : 'Zen Cinema Mode: Off', '🧘');
        saveSettingsForDomain();
      }
    });
  }

  // Settings messages (sliders, presets, demo page) may change the LOOK of the light,
  // but never switch it on/off or create a manual override. Only the toggle / Alt+A can.
  function withoutProtectedKeys(incoming) {
    const { enabled, isManualOverride, overrideSource, ...rest } = incoming || {};
    return rest;
  }

  /* ============================================================
   * 14. EXTENSION POPUP MESSAGE LISTENER
   * ============================================================ */
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (!message || !message.type) return;

      switch (message.type) {
        case 'GET_STATUS':
          sendResponse({
            isActive: isActive,
            domain: currentDomain,
            settings: settings
          });
          break;

        case 'TOGGLE_ENABLED':
          // Only sent by the popup's on/off toggle -> a deliberate choice
          userExplicitlyToggled = true;
          settings.enabled = !!message.enabled;
          settings.isManualOverride = true;
          settings.overrideSource = 'toggle';
          if (settings.enabled) {
            activateAmbientEngine('popup on/off toggle');
          } else {
            deactivateAmbientEngine('popup on/off toggle (turned off)');
          }
          saveSettingsForDomain(true);
          sendResponse({ success: true, isActive: isActive });
          break;

        case 'UPDATE_SETTINGS':
          if (message.settings) {
            const autoDetectWasOn = settings.autoDetect !== false;
            settings = { ...settings, ...withoutProtectedKeys(message.settings) };
            // React to the popup's "Auto-Detect" option being switched
            const autoDetectIsOn = settings.autoDetect !== false;
            if (autoDetectIsOn && !autoDetectWasOn) startAutoDetectWatch('auto-detect turned on in popup');
            if (!autoDetectIsOn && autoDetectWasOn) stopAutoDetectWatch();
            if (settings.enabled && !isActive) {
              activateAmbientEngine('popup UPDATE_SETTINGS (slider/preset/option)');
            } else if (!settings.enabled && isActive) {
              deactivateAmbientEngine('popup UPDATE_SETTINGS');
            } else if (isActive) {
              applySettingsToDOM();
            }
            saveSettingsForDomain();
          }
          sendResponse({ success: true });
          break;

        case 'RESET_DEFAULTS':
          // Reset the look, but keep the current on/off state (it used to force ON)
          settings = {
            ...DEFAULT_SETTINGS,
            enabled: !!settings.enabled,
            isManualOverride: settings.isManualOverride,
            overrideSource: settings.overrideSource
          };
          if (settings.enabled && !isActive) {
            activateAmbientEngine('popup Reset button');
          } else if (isActive) {
            applySettingsToDOM();
          }
          saveSettingsForDomain();
          sendResponse({ success: true, settings: settings });
          break;
      }

      return true;
    });
  }

  // Standalone window message listener for demo/test environments
  window.addEventListener('message', (event) => {
    // Only accept messages from this same page (not from embedded frames / ads)
    if (event.source !== window) return;
    if (!event.data) return;

    if (event.data.type === 'MANHWA_UPDATE_SETTINGS') {
      if (event.data.settings) {
        settings = { ...settings, ...withoutProtectedKeys(event.data.settings) };
        if (settings.enabled && !isActive) {
          activateAmbientEngine('window message MANHWA_UPDATE_SETTINGS');
        } else if (!settings.enabled && isActive) {
          deactivateAmbientEngine('window message MANHWA_UPDATE_SETTINGS');
        } else if (isActive) {
          applySettingsToDOM();
        }
      }
    } else if (event.data.type === 'MANHWA_SET_MODE') {
      settings.mode = event.data.mode;
      applySettingsToDOM();
    } else if (event.data && event.data.type === 'MANHWA_SET_SPREAD') {
      settings.spread = event.data.spread;
      applySettingsToDOM();
    } else if (event.data.type === 'MANHWA_APPLY_PRESET') {
      if (event.data.preset) {
        settings = { ...settings, ...withoutProtectedKeys(event.data.preset) };
        applySettingsToDOM();
      }
    } else if (event.data.type === 'MANHWA_TOGGLE_ZEN') {
      if (!isActive) return; // Zen dimming only makes sense while the light is running
      settings.zenMode = !settings.zenMode;
      updateZenMode();
      showToast(settings.zenMode ? 'Zen Cinema Mode: Active' : 'Zen Cinema Mode: Off', '🧘');
    }
  });

  // The ONLY place settings get saved. On blocked sites, nothing is kept unless
  // you deliberately toggled the light ON there.
  function saveSettingsForDomain(isManual = false) {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;

    chrome.storage.local.get(['domainOverrides'], (res) => {
      const overrides = res.domainOverrides || {};
      const entry = {
        ...settings,
        isManualOverride: isManual || !!settings.isManualOverride
      };
      if (isManual) entry.overrideSource = 'toggle';

      if (isBlockedDomain() && !hasDeliberateOverride(entry)) {
        delete overrides[currentDomain];
      } else {
        overrides[currentDomain] = entry;
      }
      chrome.storage.local.set({ domainOverrides: overrides });
    });
  }

  /* ============================================================
   * 15. RUN ENTRY POINT
   * ============================================================ */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadSettingsAndInit);
  } else {
    loadSettingsAndInit();
  }
})();
