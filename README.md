Halo Preview

<img width="1280" height="654" alt="halo glow" src="https://github.com/user-attachments/assets/bca7e4af-3fd3-452d-82dc-77f7c1e313d0" />

Full Screen Preview

<img width="1280" height="650" alt="full screen glow" src="https://github.com/user-attachments/assets/1bf96f34-a5dd-4f29-9f50-aadcbe2f4a40" />

<div align="center">

# 🌌 Webtoon & Manhwa Ambient Light
**Cinema-grade, 60fps real-time ambient lighting for vertical-scrolling comics, manhwa, and webtoons.**

[![Latest Release](https://img.shields.io/github/v/release/KatenShinMori/webtoon-manhwa-ambient-light?style=for-the-badge&color=a855f7)](https://github.com/KatenShinMori/webtoon-manhwa-ambient-light/releases/latest)
[![GitHub Stars](https://img.shields.io/github/stars/KatenShinMori/webtoon-manhwa-ambient-light?style=for-the-badge&color=f59e0b)](https://github.com/KatenShinMori/webtoon-manhwa-ambient-light/stargazers)
[![Manifest V3](https://img.shields.io/badge/Chrome-Manifest_V3-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)](https://github.com/KatenShinMori/webtoon-manhwa-ambient-light/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-22c55e?style=for-the-badge)](LICENSE)

</div>

Inspired by **"[Corsair LS100](https://www.corsair.com/us/en)"** and **"[Ambient Light for YouTube](https://chromewebstore.google.com/detail/paponcgjfojgemddooebbgniglhkajkj?utm_source=item-share-cb)"**, this extension illuminates the pitch-black or harsh-white empty margins on widescreen desktop displays when reading vertically stacked webcomics (Asura Scans, MangaDex, Webtoons, Flame Comics, Reaper Scans, Bato.to, etc.).

---

## ✨ Key Features (V2.3)

- 🎯 **3-Tier Intelligent Activation Pipeline:**
  - **Tier 1 — 200+ Recognized Platform Whitelist:** Built-in recognition for over 200+ official and community manhwa, webtoon, and manga platforms (Webtoons, Asura Scans, MangaDex, Naver Webtoon, Kakao, Tapas, Manta, Bato.to, Lezhin, Komiku, MangaPlus, Piccoma, etc.). Ambient light activates automatically on recognized domains without delay.
  - **Tier 2 — Smart Auto-Detect Reader Heuristic (Unlisted Sites):** Stays completely silent and OFF on general websites (Wikipedia, blogs, news). Watches unlisted domains using debounced `MutationObserver` listeners and multi-stage retry polling (300ms, 1.5s, 4s, 8s). When $\ge 3$ consecutive vertical reading panels are detected ($w \ge 420\text{px}, h \ge 450\text{px}$, column drift $<15\text{px}$, flush gap $<40\text{px}$), the engine automatically fires up with an `"Auto-detected Manhwa Reader ✨"` notification.
  - **Tier 3 — Bulletproof Domain Blocklist & Single Choke-Point Security:** Zero light leakage on video streaming (YouTube, Twitch, Netflix, Vimeo, Dailymotion), AI chat tools (ChatGPT, Claude, Perplexity, DeepSeek, Grok, Midjourney, Hugging Face, Copilot), social networks (Reddit, Twitter/X, Instagram, Facebook, TikTok, Pinterest, LinkedIn, Threads, Tumblr, Bluesky, Snapchat), and messaging apps (Discord, Telegram, WhatsApp). Single choke-point verification inside engine activation guarantees sliders, presets, and background events cannot bypass domain blocks.
- 🔒 **Intentional Per-Site Manual Overrides:**
  - Moving sliders, clicking presets, switching lighting modes, and clicking "Reset" will **never** mark a domain with an accidental permanent override.
  - Only deliberate on/off actions—clicking the Master On/Off switch in the popup or pressing `Alt+A`—create an intentional override (`overrideSource: 'toggle'`).
  - Stale or false-positive overrides on blocked sites are automatically purged on startup.
- 🧹 **Deep Teardown & SPA Navigation Guard:**
  - Full automatic teardown on single-page-app navigation (e.g. YouTube video switches). Removes all stage layers, backdrop bases, SVG filters, DOM clones, CSS custom properties, and Zen dimming classes with zero leftover residue.
- 🛡️ **Luminance-Subtraction Speech Bubble Anti-Glare:**
  - Upgraded inline SVG filter (`#manhwa-highlight-guard`) injected off-screen without `display: none` (ensuring Chromium's compositor never ignores it).
  - Uses `feColorMatrix` desaturation, an isolated `feComponentTransfer` luminance curve targeting highlights (>65% brightness), and an arithmetic `feComposite` subtraction (`1.15 * SourceGraphic - 0.80 * whiteMask`).
  - Crushes harsh pure white speech bubbles and narration boxes by ~70% while boosting mid-tone artwork vibrancy by +15%.
- 🎨 **Horizontal Downsample & Pre-Stretch Blur:**
  - Clones are wrapped in `.manhwa-ambient-slice.manhwa-clone-wrapper` and rendered at a compressed `64px` horizontal resolution with `filter: blur(18px) !important`.
  - Stretched horizontally across the screen via `transform: scaleX(calc(targetWidth / 64))` with `transform-origin: left center`.
  - Pre-blurring at 64px resolution dissolves 100% of speech-bubble polygon borders and text lettering into silky, smooth color gradients before stretching—even at the lowest `40px` blur setting!
- 🎛️ **Dynamic Multi-Layer Slider Control:**
  - Real-time CSS custom property and inline filter chaining. Sliders (Spread, Blur, Intensity, Vibrance) dynamically control both single-layer and dual-layer modes with zero selector collision.
  - "Glow Spread" actively expands horizontal halo reach in Halo mode and drives aggressive horizontal overscan stretch (`scaleX`) in Full-Bleed mode.
- 🌌 **Dual-Layer Depth Glow (Core + Atmosphere):**
  - **Inner Core Layer:** Tighter spread (`spread * 0.5`), sharper blur (`blur * 0.45`), crisp edge color anchoring.
  - **Outer Atmosphere Layer:** Wide spread, deep soft blur (`blur * 1.1`), gentle opacity dissolving into `#070709`.
- 🔌 **Instant Tab Auto-Reconnection:**
  - When reloading or updating the extension, `popup.js` automatically catches disconnected port errors and dynamically injects `content.js` and `content.css` via `chrome.scripting`. No manual page refreshes required!
- 🎬 **One-Click Visual Presets:**
  - **Cinema:** Subtle halo, soft atmospheric intensity.
  - **Vivid:** 240% saturation boost for vibrant action manhwa.
  - **OLED Dark:** Enhanced contrast so dark panels emit zero gray haze.
  - **Full Monitor:** Stretches edge-to-edge horizontally across the entire screen.
- 🧘 **Zen Cinema Mode (Auto-Dim Distracting UI):**
  - Dims sticky navigation bars, floating Discord widgets, and "Report" buttons to 0.08 opacity, restoring them on hover.
- ⌨️ **Keyboard Shortcuts & Instant Toasts:**
  - `Alt+A`: Toggle Ambient Light on/off (deliberate per-site override).
  - `Alt+Z`: Toggle Zen Cinema Mode on/off.
  - Displays a sleek 1.5-second floating toast notification in the corner.
- ⚡ **Viewport Virtualization & DOM Pooling:**
  - Only images within `[-1.5x, +2.5x]` viewport range maintain clone slices in the DOM, keeping GPU memory constant even on 200+ image chapters.

---

## 📁 Repository Structure

```
├── manifest.json            # Manifest V3 configuration (v2.3.0)
├── content.js               # Ambient lighting engine, whitelist, heuristic & sync loop
├── content.css              # GPU-accelerated blur filters, stage & modes
├── whitelist.md             # Curated directory of 200+ recognized manhwa/manga domains
├── popup/
│   ├── popup.html           # Sleek dark-mode extension popup
│   ├── popup.css            # Glassmorphic controls, sliders & switches
│   └── popup.js             # Live settings sync & clean storage interface
├── icons/
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
├── scripts/
│   ├── generate-icons.js    # Standalone Node.js icon generator
│   └── generate-demo-panels.js # Sample comic panel generator
├── test/
│   ├── demo.html            # Interactive test reader with infinite scroll
│   └── panels/              # High-res sample manhwa panels
└── README.md
```

---

## 🚀 Installation (Load Unpacked in Chrome / Chromium)

1. **Clone or Download** this repository to your computer:

   ```bash
   git clone https://github.com/katenshinmori/webtoon-manhwa-ambient-light.git
   ```

2. Open Google Chrome (or Brave, Edge, Opera, Vivaldi).
3. Navigate to `chrome://extensions/` in the URL address bar.
4. Enable **Developer mode** using the toggle switch in the top-right corner.
5. Click the **Load unpacked** button in the top-left corner.
6. Select the folder containing `manifest.json` (`Manwha Extension`).
7. The extension icon will appear in your Chrome toolbar. Pin it for quick access!

---

## 🧪 Testing Locally (No Internet Required)

A full interactive test environment is included in `test/demo.html`:

1. Open `test/demo.html` in your browser.
2. Observe the centered manhwa column with neon magic, golden blade, and cosmic purple panels.
3. Scroll down to see the real-time ambient lighting change seamlessly as different panels enter the viewport.
4. Click **"+ Add More Panels (Infinite Scroll)"** to test dynamic DOM mutation tracking.
5. Click **"Toggle Site Background (Dark / White)"** to test the dark background overrides.
6. Click the extension toolbar icon to tweak live sliders and switch between **Halo Glow** and **Full-Bleed** modes!

---

## 🛠️ Architecture & How It Works (V2.3 Refined)

### 1. Intelligent 3-Tier Activation Flow

```
                           [ PAGE NAVIGATION / LOAD ]
                                       │
                                       ▼
                   ┌───────────────────────────────────────┐
                   │  Is domain on the Blocklist?          │
                   │  (YouTube, Twitch, Netflix, AI chats) │
                   └───────────────────┬───────────────────┘
                                       │
                        YES ───────────┴─────────── NO
                         │                           │
                         ▼                           ▼
        ┌────────────────────────────────┐  ┌──────────────────────────────────┐
        │ Has explicit toggle override?  │  │ Is domain on 200+ Whitelist?     │
        │ (overrideSource === 'toggle')  │  │ (Webtoons, Asura, MangaDex, etc.)│
        └───────────────┬────────────────┘  └────────────────┬─────────────────┘
                        │                                    │
           YES ─────────┴───────── NO           YES ─────────┴───────── NO
            │                       │            │                       │
            ▼                       ▼            ▼                       ▼
    [ START ENGINE ]          [ STAY OFF ]  [ START ENGINE ]  ┌─────────────────────┐
                              [ FULL TEARDOWN ]               │ Run Auto-Detect     │
                                                              │ Heuristic (3+ flush │
                                                              │ stacked tall panels)│
                                                              └──────────┬──────────┘
                                                                         │
                                                            MATCH ───────┴─────── NO MATCH
                                                              │                      │
                                                              ▼                      ▼
                                                      [ START ENGINE ]         [ STAY OFF ]
                                                      Show Toast "✨"
```

### 2. Rendering & DOM Architecture

```
┌────────────────────────────────────────────────────────┐
│ BROWSER VIEWPORT (100vw x 100vh)                       │
│                                                        │
│  [#manhwa-ambient-backdrop (fixed, z-index: 0)]       │
│   Pure #070709 dark cinema base behind stage          │
│                                                        │
│  [#manhwa-ambient-stage (fixed, inset: 0, z-index: 1)] │
│   ┌──────────────────────────────────────────────────┐ │
│   │ .manhwa-ambient-canvas (Core & Atmosphere layers)│ │
│   │ filter: blur(90px) saturate(180%) brightness(...)│ │
│   │ ┌──────────────────────────────────────────────┐ │ │
│   │ │ .manhwa-clone-wrapper (target width/height)  │ │ │
│   │ │  └─ <img> (width: 64px, blur(18px), scaleX)  │ │ │
│   │ ├──────────────────────────────────────────────┤ │ │
│   │ │ .manhwa-clone-wrapper (target width/height)  │ │ │
│   │ │  └─ <img> (width: 64px, blur(18px), scaleX)  │ │ │
│   │ └──────────────────────────────────────────────┘ │ │
│   └──────────────────────────────────────────────────┘ │
│                                                        │
│  [ORIGINAL READER DOM (z-index: 2)]                    │
│   ┌───────────────────────────┐                        │
│   │ .comic-panel (Panel 1)    │ <--- Original <img>    │
│   ├───────────────────────────┤      untouched in DOM  │
│   │ .comic-panel (Panel 2)    │                        │
│   └───────────────────────────┘                        │
│   (All ancestor wrappers marked transparent)           │
│                                                        │
│  [SITE NAVBARS & OVERLAYS (z-index: 10+)]              │
└────────────────────────────────────────────────────────┘
```

1. **Single Choke-Point Verification:**
   - Both `activateAmbientEngine()` and `checkAutoDetectHeuristic()` route directly through `isEngineAllowed()`.
   - Incoming messages from the popup (sliders, presets, Reset) pass through `withoutProtectedKeys()`, stripping any attempts to forge an `enabled` state.
2. **Luminance-Subtraction Glare Guard (Chromium Off-Screen SVG):**
   - Injected with `width="0" height="0" style="position: fixed; top: -9999px; left: -9999px; pointer-events: none;"` (no `display: none`, keeping it in Chromium's compositor tree).
   - Generates a bright highlight luminance mask (`tableValues="0 0 0 0 0 0.05 0.35 0.75 1.0"`) and subtracts it via `<feComposite operator="arithmetic" k2="1.15" k3="-0.80">`, knocking down speech bubble white glare by ~70% while boosting rich color artwork.
3. **Horizontal Downsample & Pre-Stretch Blur:**
   - Instead of rendering clones at stretched 800px+ widths, clones inside `.manhwa-clone-wrapper` are forced to `64px` width with `filter: blur(18px) !important`.
   - The clone is stretched horizontally using `transform: scaleX(calc(targetWidth / 64))` with `transform-origin: left center`. This dissolves speech bubble polygon outlines and text smudges into smooth gradients even when blur is set down to `40px`.
4. **Strict Vertical Lock (Zero Y-Drift):**
   - Each mirrored ambient image is 100% locked to the exact vertical `top` and `height` of the original `<img>`'s `getBoundingClientRect()`.
   - Uses `object-fit: fill !important` on the clone image. Changing "Glow Spread" or toggling "Full-Bleed" stretches the slice **only along the horizontal X-axis**.
5. **Seamless Vertical Seam Blending via Parent Canvas Blur:**
   - Stacked clones have a `-2px` subpixel overlap (`top: Math.floor(rect.top) - 1`, `height: Math.ceil(rect.height) + 2`).
   - The main `filter: blur(...)` is applied to the parent `.manhwa-ambient-canvas` container. The GPU blurs the stacked column as a continuous texture, eliminating horizontal seams.
6. **Full DOM Ancestor Traversal:**
   - When comic panels are detected, `markAncestorContainers(img)` traverses all the way up the DOM tree to `document.body` and marks all ancestor wrapper elements with `data-manhwa-ambient-container="true"`, clearing any opaque background colors with `background-color: transparent !important`.

---

## ⚙️ Configuration & Settings (V2.3)

| Setting | Range / Options | Default | Description |
| :--- | :--- | :--- | :--- |
| **Active Presets** | `Cinema`, `Vivid`, `OLED`, `Full` | Custom | One-click visual style presets. |
| **Site Toggle** | On / Off | `Auto` | Enable or disable ambient light per-domain. Automatically activates on whitelisted platforms and heuristic-detected readers. |
| **Lighting Mode** | `Halo Glow` / `Full-Bleed` | `Halo Glow` | Soft halo aura vs monitor edge-to-edge ambient. |
| **Glow Spread** | `100px` – `450px` | `280px` | How far outward halo light extends into the margins. |
| **Blur Smoothness** | `40px` – `160px` | `90px` | Gaussian blur radius applied to ambient clones. |
| **Glow Intensity** | `10%` – `100%` | `65%` | Brightness and opacity multiplier for ambient glow. |
| **Color Vibrance** | `100%` – `300%` | `180%` | Saturation boost to make colors vivid and punchy. |
| **Suppress Glare** | On / Off | `On` | Luminance subtraction filter crushing >65% white speech bubbles by ~70%. |
| **Dual-Layer Depth** | On / Off | `On` | Near halo (core) + far atmospheric wash. |
| **Auto-Detect** | On / Off | `On` | Watches unlisted pages for 3+ stacked vertical comic panels. |
| **Zen Cinema Mode** | On / Off | `Off` | Auto-dims sticky headers and floating widgets to 0.08 opacity. |
| **Force Dark BG** | Checked / Unchecked | `Checked` | Forces stubborn white reader containers to `#070709`. |
| **Panel Shadow** | Checked / Unchecked | `Checked` | Lateral drop shadow separating comic panels from glow. |

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action | Feedback |
| :--- | :--- | :--- |
| `Alt + A` | Toggle Ambient Light On / Off (Manual Override) | 1.5s Floating Toast Notification |
| `Alt + Z` | Toggle Zen Cinema Mode On / Off (When Active) | 1.5s Floating Toast Notification |

---

## Star History

<a href="https://www.star-history.com/?repos=katenshinmori%2Fwebtoon-manhwa-ambient-light&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=katenshinmori/webtoon-manhwa-ambient-light&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=katenshinmori/webtoon-manhwa-ambient-light&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=katenshinmori/webtoon-manhwa-ambient-light&type=date&legend=top-left" />
 </picture>
</a>

---
## 📄 License

Open-source under the [MIT License](LICENSE). Contributions, issues, and feature suggestions are welcome!
