/**
 * Webtoon & Manhwa Ambient Light
 * Content Script - V2.0 Enhanced Engine
 *
 * Features:
 * - Anti-Flashbang Highlight Guard (SVG feComponentTransfer filter curve)
 * - Dual-Layer Depth Glow (Inner Core Halo + Outer Atmosphere Wash)
 * - Strict Vertical Synchronization (1:1 Y locking, object-fit: fill)
 * - Smart Auto-Detect Manhwa Layout Heuristic
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
    enabled: true,
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
  const AUTO_DETECT_DOMAIN_BLOCKLIST = [
    'youtube.com',
    'google.com',
    'twitch.tv',
    'reddit.com',
    'x.com',
    'twitter.com',
    'github.com',
    'netflix.com',
    'facebook.com',
    'instagram.com',
    'bilibili.com',
    'tiktok.com'
  ];

  function isBlockedDomain(hostname = currentDomain) {
    if (!hostname) return false;
    const h = hostname.toLowerCase();
    return AUTO_DETECT_DOMAIN_BLOCKLIST.some(d => h === d || h.endsWith('.' + d));
  }

  async function loadSettingsAndInit() {
    setupKeyboardShortcuts();

    const isBlocked = isBlockedDomain();

    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['globalSettings', 'domainOverrides'], (res) => {
          const global = res.globalSettings || {};
          const domainOverrides = res.domainOverrides || {};
          const domainConfig = domainOverrides[currentDomain];

          // On blocklisted domains, check if user explicitly toggled it ON in popup with isManualOverride: true
          if (isBlocked) {
            const hasManualOverride = domainConfig && domainConfig.isManualOverride === true && domainConfig.enabled === true;

            if (!hasManualOverride) {
              // Automatically delete any old false-positive cached auto-enable entry
              if (domainConfig) {
                delete domainOverrides[currentDomain];
                chrome.storage.local.set({ domainOverrides });
              }
              settings = {
                ...DEFAULT_SETTINGS,
                ...global,
                enabled: false,
                isManualOverride: false
              };
              userExplicitlyToggled = false;
              // Blocked domain without explicit user manual override -> stay completely inactive
              return;
            }
          }

          if (domainConfig && typeof domainConfig.enabled !== 'undefined') {
            userExplicitlyToggled = !!domainConfig.isManualOverride;
          }

          settings = {
            ...DEFAULT_SETTINGS,
            ...global,
            ...(domainConfig || {})
          };

          if (settings.enabled) {
            activateAmbientEngine();
          } else if (settings.autoDetect && !userExplicitlyToggled && !isBlocked) {
            setTimeout(checkAutoDetectHeuristic, 300);
          }
        });
      } else {
        if (!isBlocked) {
          if (settings.enabled) {
            activateAmbientEngine();
          } else if (settings.autoDetect) {
            setTimeout(checkAutoDetectHeuristic, 300);
          }
        } else {
          settings.enabled = false;
        }
      }
    } catch (err) {
      console.warn('[Manhwa Ambient] Storage initialization fallback:', err);
      if (!isBlocked && settings.enabled) {
        activateAmbientEngine();
      } else {
        settings.enabled = false;
      }
    }
  }

  /* ============================================================
   * 3. SMART AUTO-DETECT MANHWA LAYOUT HEURISTIC
   * ============================================================ */
  function checkAutoDetectHeuristic() {
    if (isActive || isBlockedDomain()) return;

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
      activateAmbientEngine();
      showToast('Auto-detected Manhwa Reader', '✨');
    }
  }

  /* ============================================================
   * 4. ENGINE ACTIVATION & TEARDOWN
   * ============================================================ */
  function activateAmbientEngine() {
    if (isActive) return;
    isActive = true;

    ensureSvgFilter();
    ensureStageElement();
    applySettingsToDOM();

    setupIntersectionObserver();
    setupMutationObserver();
    setupWindowListeners();

    discoverComicImages();
    scheduleSync();
  }

  function deactivateAmbientEngine() {
    if (!isActive) return;
    isActive = false;

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
    if (candidateImages.has(img)) return;

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

      // Alt + A: Toggle Ambient Light
      if (e.altKey && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        userExplicitlyToggled = true;
        settings.enabled = !settings.enabled;
        settings.isManualOverride = true;
        if (settings.enabled) {
          activateAmbientEngine();
          showToast('Ambient Light: Enabled', '✨');
        } else {
          deactivateAmbientEngine();
          showToast('Ambient Light: Disabled', '🌙');
        }
        saveSettingsForDomain(true);
      }

      // Alt + Z: Toggle Zen Cinema Mode
      if (e.altKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        settings.zenMode = !settings.zenMode;
        if (!isActive && settings.zenMode) {
          activateAmbientEngine();
        } else {
          updateZenMode();
        }
        showToast(settings.zenMode ? 'Zen Cinema Mode: Active' : 'Zen Cinema Mode: Off', '🧘');
        saveSettingsForDomain();
      }
    });
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
          userExplicitlyToggled = true;
          settings.enabled = !!message.enabled;
          settings.isManualOverride = !!message.isManualOverride;
          if (settings.enabled) {
            activateAmbientEngine();
          } else {
            deactivateAmbientEngine();
          }
          saveSettingsForDomain(!!message.isManualOverride);
          sendResponse({ success: true, isActive: isActive });
          break;

        case 'UPDATE_SETTINGS':
          if (message.settings) {
            settings = { ...settings, ...message.settings };
            if (settings.enabled && !isActive) {
              activateAmbientEngine();
            } else if (!settings.enabled && isActive) {
              deactivateAmbientEngine();
            } else if (isActive) {
              applySettingsToDOM();
            }
            saveSettingsForDomain();
          }
          sendResponse({ success: true });
          break;

        case 'RESET_DEFAULTS':
          settings = { ...DEFAULT_SETTINGS, enabled: true };
          if (!isActive) {
            activateAmbientEngine();
          } else {
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
    if (!event.data) return;

    if (event.data.type === 'MANHWA_UPDATE_SETTINGS') {
      if (event.data.settings) {
        settings = { ...settings, ...event.data.settings };
        if (settings.enabled && !isActive) {
          activateAmbientEngine();
        } else if (!settings.enabled && isActive) {
          deactivateAmbientEngine();
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
        settings = { ...settings, ...event.data.preset };
        applySettingsToDOM();
      }
    } else if (event.data.type === 'MANHWA_TOGGLE_ZEN') {
      settings.zenMode = !settings.zenMode;
      updateZenMode();
      showToast(settings.zenMode ? 'Zen Cinema Mode: Active' : 'Zen Cinema Mode: Off', '🧘');
    }
  });

  function saveSettingsForDomain(isManual = false) {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;

    chrome.storage.local.get(['domainOverrides'], (res) => {
      const overrides = res.domainOverrides || {};
      const isBlocked = isBlockedDomain();

      if (isBlocked && (!settings.enabled || (!isManual && !settings.isManualOverride))) {
        delete overrides[currentDomain];
      } else {
        overrides[currentDomain] = {
          ...settings,
          isManualOverride: isManual || !!settings.isManualOverride
        };
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
