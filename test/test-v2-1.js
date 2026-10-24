/**
 * V2.1 Logic & Heuristics Unit Test
 */
const assert = require('assert');

// 1. Test Domain Blocklist
const AUTO_DETECT_DOMAIN_BLOCKLIST = [
  'youtube.com',
  'twitch.tv',
  'netflix.com',
  'reddit.com',
  'x.com',
  'twitter.com',
  'facebook.com',
  'instagram.com',
  'github.com',
  'google.com',
  'bilibili.com',
  'tiktok.com'
];

function isDomainBlocked(hostname) {
  const h = hostname.toLowerCase();
  return AUTO_DETECT_DOMAIN_BLOCKLIST.some(d => h === d || h.endsWith('.' + d));
}

console.log('Testing Domain Blocklist...');
assert.strictEqual(isDomainBlocked('youtube.com'), true);
assert.strictEqual(isDomainBlocked('www.youtube.com'), true);
assert.strictEqual(isDomainBlocked('m.youtube.com'), true);
assert.strictEqual(isDomainBlocked('reddit.com'), true);
assert.strictEqual(isDomainBlocked('asuracomics.com'), false);
assert.strictEqual(isDomainBlocked('flamecomics.xyz'), false);
assert.strictEqual(isDomainBlocked('mangadex.org'), false);
console.log('✔ Domain blocklist passed');

// 2. Test Strict Webtoon Geometry Heuristic
function evaluateImageStrip(mockImages) {
  const filtered = mockImages.filter(img => {
    if (img.isInsideLink) return false;
    if (img.width < 420 || img.height < 450) return false;
    if (img.width / img.height > 1.4) return false;
    return true;
  });

  if (filtered.length < 3) return false;

  filtered.sort((a, b) => a.top - b.top);

  let consecutive = 1;
  for (let i = 0; i < filtered.length - 1; i++) {
    const a = filtered[i];
    const b = filtered[i + 1];

    const leftDiff = Math.abs(a.left - b.left);
    const widthDiff = Math.abs(a.width - b.width);
    const isColumnAligned = leftDiff < 15 && widthDiff < 15;

    const verticalGap = Math.abs(a.bottom - b.top);
    const isFlushStacked = verticalGap < 40;

    if (isColumnAligned && isFlushStacked) {
      consecutive++;
      if (consecutive >= 3) return true;
    } else {
      consecutive = 1;
    }
  }

  return false;
}

console.log('Testing Auto-Detect Geometry...');

// YouTube-like thumbnail grid: 16:9 images inside <a> tags
const youtubeMock = [
  { isInsideLink: true, width: 480, height: 270, left: 100, top: 100, bottom: 370 },
  { isInsideLink: true, width: 480, height: 270, left: 100, top: 400, bottom: 670 },
  { isInsideLink: true, width: 480, height: 270, left: 100, top: 700, bottom: 970 }
];
assert.strictEqual(evaluateImageStrip(youtubeMock), false, 'YouTube thumbnails must not trigger auto-detect');

// YouTube thumbnails even if not in links (aspect ratio > 1.4 and height < 450)
const wideThumbnailsMock = [
  { isInsideLink: false, width: 640, height: 360, left: 100, top: 100, bottom: 460 },
  { isInsideLink: false, width: 640, height: 360, left: 100, top: 500, bottom: 860 },
  { isInsideLink: false, width: 640, height: 360, left: 100, top: 900, bottom: 1260 }
];
assert.strictEqual(evaluateImageStrip(wideThumbnailsMock), false, '16:9 thumbnails must be rejected');

// Real Manhwa panels: tall vertical strip, aligned in single column, stacked flush
const manhwaMock = [
  { isInsideLink: false, width: 720, height: 1100, left: 350, top: 100, bottom: 1200 },
  { isInsideLink: false, width: 720, height: 1250, left: 350, top: 1200, bottom: 2450 },
  { isInsideLink: false, width: 720, height: 1050, left: 350, top: 2450, bottom: 3500 }
];
assert.strictEqual(evaluateImageStrip(manhwaMock), true, 'Manhwa strip must trigger auto-detect');
console.log('✔ Strict webtoon geometry test passed');

// 3. Test Filter Chaining & Slider Dynamic Driving
function computeFilters(settings) {
  const blurPx = settings.blur;
  const intensityFactor = (settings.intensity / 100).toFixed(2);
  const vibranceFactor = (settings.vibrance / 100).toFixed(2);
  const glareGuardFilter = settings.suppressGlare ? ' url(#manhwa-highlight-guard)' : '';

  const atmosphereBlur = settings.dualLayer ? Math.round(blurPx * 1.1) : blurPx;
  const atmosphereFilter = `blur(${atmosphereBlur}px) saturate(${vibranceFactor}) brightness(${intensityFactor})${glareGuardFilter}`;
  const atmosphereOpacity = settings.dualLayer ? `${(settings.intensity / 100) * 0.75}` : `${intensityFactor}`;

  let coreFilter = null;
  let coreOpacity = null;
  if (settings.dualLayer) {
    const coreBlur = Math.max(12, Math.round(blurPx * 0.45));
    coreFilter = `blur(${coreBlur}px) saturate(${vibranceFactor}) brightness(${intensityFactor})${glareGuardFilter}`;
    coreOpacity = `${(settings.intensity / 100) * 0.95}`;
  }

  return { atmosphereFilter, atmosphereOpacity, coreFilter, coreOpacity };
}

console.log('Testing Filter Chaining & Slider Math...');
const res1 = computeFilters({
  blur: 90,
  intensity: 65,
  vibrance: 180,
  spread: 280,
  suppressGlare: true,
  dualLayer: true
});

assert.strictEqual(res1.atmosphereFilter, 'blur(99px) saturate(1.80) brightness(0.65) url(#manhwa-highlight-guard)');
assert.strictEqual(res1.coreFilter, 'blur(41px) saturate(1.80) brightness(0.65) url(#manhwa-highlight-guard)');

// Now test with suppressGlare: false
const res2 = computeFilters({
  blur: 120,
  intensity: 80,
  vibrance: 220,
  spread: 350,
  suppressGlare: false,
  dualLayer: true
});

assert.strictEqual(res2.atmosphereFilter, 'blur(132px) saturate(2.20) brightness(0.80)');
assert.strictEqual(res2.coreFilter, 'blur(54px) saturate(2.20) brightness(0.80)');

// Test dualLayer: false
const res3 = computeFilters({
  blur: 90,
  intensity: 65,
  vibrance: 180,
  spread: 280,
  suppressGlare: true,
  dualLayer: false
});

assert.strictEqual(res3.atmosphereFilter, 'blur(90px) saturate(1.80) brightness(0.65) url(#manhwa-highlight-guard)');
assert.strictEqual(res3.coreFilter, null);
console.log('✔ Filter computation & chaining passed');

// 4. Test Spread in Full-Bleed vs Halo
function computeSpreadLayout(mode, rect, spread) {
  if (mode === 'full-bleed') {
    const bleedScale = (1 + ((spread - 100) / 350) * 0.45).toFixed(3);
    const coreBleedScale = (1 + ((spread - 100) / 350) * 0.22).toFixed(3);
    return {
      atmosphere: { left: 0, width: '100vw', scaleX: bleedScale },
      core: { left: 0, width: '100vw', scaleX: coreBleedScale }
    };
  } else {
    const left = Math.round(rect.left - spread);
    const width = Math.round(rect.width + spread * 2);
    const coreSpread = Math.max(30, Math.round(spread * 0.5));
    const coreLeft = Math.round(rect.left - coreSpread);
    const coreWidth = Math.round(rect.width + coreSpread * 2);
    return {
      atmosphere: { left, width, scaleX: 'none' },
      core: { left: coreLeft, width: coreWidth, scaleX: 'none' }
    };
  }
}

console.log('Testing Spread Scaling in Full-Bleed and Halo...');
const rect = { left: 400, width: 800 };
const haloSpread = computeSpreadLayout('halo', rect, 280);
assert.strictEqual(haloSpread.atmosphere.left, 120);
assert.strictEqual(haloSpread.atmosphere.width, 1360);
assert.strictEqual(haloSpread.core.left, 260); // 400 - 140
assert.strictEqual(haloSpread.core.width, 1080); // 800 + 280

const fullSpreadMin = computeSpreadLayout('full-bleed', rect, 100);
assert.strictEqual(fullSpreadMin.atmosphere.scaleX, '1.000');

const fullSpreadMax = computeSpreadLayout('full-bleed', rect, 450);
assert.strictEqual(fullSpreadMax.atmosphere.scaleX, '1.450');
assert.strictEqual(fullSpreadMax.core.scaleX, '1.220');
// 5. Test Cached Blocklist Purge Logic
console.log('Testing Cached Blocklist Purge Logic...');
function simulateInit(hostname, domainOverrides) {
  const isBlocked = isDomainBlocked(hostname);
  const domainConfig = domainOverrides[hostname];

  if (isBlocked) {
    const hasManualOverride = domainConfig && domainConfig.isManualOverride === true && domainConfig.enabled === true;
    if (!hasManualOverride) {
      if (domainConfig) {
        delete domainOverrides[hostname];
      }
      return { enabled: false, isManualOverride: false, purged: true };
    }
  }

  return {
    enabled: domainConfig ? !!domainConfig.enabled : false,
    isManualOverride: domainConfig ? !!domainConfig.isManualOverride : false,
    purged: false
  };
}

const mockStorage1 = {
  'youtube.com': { enabled: true, isManualOverride: false } // Stale false positive
};
const resInit1 = simulateInit('youtube.com', mockStorage1);
assert.strictEqual(resInit1.enabled, false, 'YouTube without manual override must be forced OFF');
assert.strictEqual(resInit1.purged, true, 'Cached false-positive must be purged from storage');
assert.strictEqual(mockStorage1['youtube.com'], undefined, 'Entry must be deleted');

const mockStorage2 = {
  'youtube.com': { enabled: true, isManualOverride: true } // User explicitly clicked popup on YouTube
};
const resInit2 = simulateInit('youtube.com', mockStorage2);
assert.strictEqual(resInit2.enabled, true, 'Explicit manual override must be preserved');
assert.strictEqual(resInit2.purged, false);

console.log('✔ Blocklist cache purge passed');

// 6. Test Highlight Guard Luminance Subtraction Arithmetic (V2.2)
console.log('Testing Highlight Guard Subtraction Arithmetic...');
function computeHighlightGuardPixel(r, g, b) {
  // 1. Grayscale luminance (saturate 0)
  const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;

  // 2. Table curve: 0 0 0 0 0 0.05 0.35 0.75 1.0
  const tableValues = [0, 0, 0, 0, 0, 0.05, 0.35, 0.75, 1.0];
  const idx = Math.min(tableValues.length - 1, Math.max(0, Math.round(gray * (tableValues.length - 1))));
  const whiteMask = tableValues[idx];

  // 3. Composite arithmetic: k1=0, k2=1.15, k3=-0.80, k4=0
  const outR = Math.max(0, Math.min(1, 1.15 * r - 0.80 * whiteMask));
  const outG = Math.max(0, Math.min(1, 1.15 * g - 0.80 * whiteMask));
  const outB = Math.max(0, Math.min(1, 1.15 * b - 0.80 * whiteMask));

  return { outR, outG, outB, whiteMask };
}

// Pure white speech bubble (1, 1, 1)
const whiteRes = computeHighlightGuardPixel(1.0, 1.0, 1.0);
assert.strictEqual(whiteRes.whiteMask, 1.0, 'Pure white must produce 1.0 whiteMask');
assert.strictEqual(whiteRes.outR.toFixed(2), '0.35', 'Pure white must be crushed to 0.35 (65% dimming)');

// Mid-tone colored art (0.2, 0.4, 0.8)
const colorRes = computeHighlightGuardPixel(0.2, 0.4, 0.8);
assert.strictEqual(colorRes.whiteMask, 0, 'Mid-tone art must have 0 whiteMask');
assert.strictEqual(colorRes.outB.toFixed(2), '0.92', 'Color art should be preserved and boosted by 15%');
console.log('✔ Highlight subtraction arithmetic passed');

// 7. Test Horizontal Downsample Pre-Stretch Scaling (V2.2)
console.log('Testing Horizontal Downsample Pre-Stretch Scaling...');
function computeDownsampleScale(targetWidth) {
  return (targetWidth / 64).toFixed(3);
}

assert.strictEqual(computeDownsampleScale(1280), '20.000', '1280px target width maps to 20x scaleX');
assert.strictEqual(computeDownsampleScale(1920), '30.000', '1920px target width maps to 30x scaleX');
console.log('✔ Downsample pre-stretch scaling passed');

console.log('\n🎉 ALL V2.2 POLISH UNIT TESTS PASSED SUCCESSFULLY!');
