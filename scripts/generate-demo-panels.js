const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 table
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(8 + len + 4);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const crc = crc32(chunk.subarray(4, 8 + len));
  chunk.writeUInt32BE(crc, 8 + len);
  return chunk;
}

function createPng(width, height, pixelFn) {
  const scanlines = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (width * 4 + 1);
    scanlines[rowOffset] = 0;
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelFn(x, y, width, height);
      const pixelOffset = rowOffset + 1 + x * 4;
      scanlines[pixelOffset] = Math.max(0, Math.min(255, Math.round(r)));
      scanlines[pixelOffset + 1] = Math.max(0, Math.min(255, Math.round(g)));
      scanlines[pixelOffset + 2] = Math.max(0, Math.min(255, Math.round(b)));
      scanlines[pixelOffset + 3] = Math.max(0, Math.min(255, Math.round(a)));
    }
  }

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6;
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  const compressedData = zlib.deflateSync(scanlines, { level: 6 });
  const idatChunk = makeChunk('IDAT', compressedData);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const panelsDir = path.join(__dirname, '..', 'test', 'panels');
if (!fs.existsSync(panelsDir)) {
  fs.mkdirSync(panelsDir, { recursive: true });
}

// 5 Stylized Panels for testing seamless transitions
const PANELS = [
  {
    name: 'panel-1-neon-cyan.png',
    theme: 'Neon Cyan Magic Circle',
    pixel: (x, y, w, h) => {
      const nx = (x / w) * 2 - 1;
      const ny = (y / h) * 2 - 1;
      const d = Math.sqrt(nx * nx + ny * ny);
      const ripple = Math.sin(d * 18) * 0.5 + 0.5;
      const bgR = 10 + Math.sin(ny * 3) * 5;
      const bgG = 20 + Math.cos(nx * 2) * 10;
      const bgB = 40 + Math.sin(ny * 2) * 15;
      const beam = Math.exp(-Math.abs(nx) * 3) * 180;
      return [
        Math.min(255, bgR + beam * 0.2 + ripple * 20),
        Math.min(255, bgG + beam * 0.85 + ripple * 80),
        Math.min(255, bgB + beam * 1.0 + ripple * 120),
        255
      ];
    }
  },
  {
    name: 'panel-2-golden-blade.png',
    theme: 'Golden Sun Blade Slash',
    pixel: (x, y, w, h) => {
      const nx = (x / w) * 2 - 1;
      const ny = (y / h) * 2 - 1;
      const slash = Math.exp(-Math.abs(nx + ny * 0.7) * 4) * 230;
      const bgR = 45 + Math.sin(ny * 2) * 15;
      const bgG = 25 + Math.cos(nx * 2) * 10;
      const bgB = 10;
      return [
        Math.min(255, bgR + slash * 1.0),
        Math.min(255, bgG + slash * 0.85),
        Math.min(255, bgB + slash * 0.2),
        255
      ];
    }
  },
  {
    name: 'panel-3-cosmic-purple.png',
    theme: 'Cosmic Abyssal Void',
    pixel: (x, y, w, h) => {
      const nx = (x / w) * 2 - 1;
      const ny = (y / h) * 2 - 1;
      const vortex = Math.sin(Math.atan2(ny, nx) * 5 + Math.sqrt(nx*nx + ny*ny) * 6) * 0.5 + 0.5;
      const core = Math.exp(-(nx * nx + ny * ny) * 2) * 200;
      const bgR = 30 + vortex * 40;
      const bgG = 10 + vortex * 15;
      const bgB = 55 + vortex * 70;
      return [
        Math.min(255, bgR + core * 0.7),
        Math.min(255, bgG + core * 0.2),
        Math.min(255, bgB + core * 1.0),
        255
      ];
    }
  },
  {
    name: 'panel-4-crimson-dragon.png',
    theme: 'Crimson Dragon Breath Flame',
    pixel: (x, y, w, h) => {
      const nx = (x / w) * 2 - 1;
      const ny = (y / h) * 2 - 1;
      const flame = (Math.sin(nx * 8 + ny * 5) + Math.cos(nx * 4 - ny * 7)) * 0.25 + 0.5;
      const intensity = Math.exp(-Math.abs(nx) * 2.5) * 220 * flame;
      const bgR = 50 + intensity * 0.9;
      const bgG = 8 + intensity * 0.25;
      const bgB = 12 + intensity * 0.1;
      return [
        Math.min(255, bgR),
        Math.min(255, bgG),
        Math.min(255, bgB),
        255
      ];
    }
  },
  {
    name: 'panel-5-emerald-forest.png',
    theme: 'Emerald Forest Spirit Awakening',
    pixel: (x, y, w, h) => {
      const nx = (x / w) * 2 - 1;
      const ny = (y / h) * 2 - 1;
      const wave = Math.sin(nx * 6 + ny * 3) * 0.5 + 0.5;
      const glow = Math.exp(-(nx * nx + (ny - 0.2) * (ny - 0.2)) * 3) * 210;
      const bgR = 10 + glow * 0.15;
      const bgG = 40 + wave * 45 + glow * 0.85;
      const bgB = 25 + wave * 25 + glow * 0.3;
      return [
        Math.min(255, bgR),
        Math.min(255, bgG),
        Math.min(255, bgB),
        255
      ];
    }
  },
  {
    name: 'panel-6-speech-bubble.png',
    theme: 'Shadow Monarch with Edge Speech Bubble',
    pixel: (x, y, w, h) => {
      const nx = (x / w) * 2 - 1;
      const ny = (y / h) * 2 - 1;
      // Midnight violet background
      let r = 18 + Math.sin(ny * 3) * 6;
      let g = 14 + Math.cos(nx * 2) * 5;
      let b = 45 + Math.sin(ny * 2) * 12;

      // Pure white speech bubble near the right edge: centered at nx = 0.52, ny = -0.1
      const bx = (nx - 0.52) / 0.38;
      const by = (ny - (-0.1)) / 0.26;
      const bubbleDist = bx * bx + by * by;

      if (bubbleDist < 1.0) {
        // Inside speech bubble: pure white with dark dialogue strokes
        const isBorder = bubbleDist > 0.92;
        if (isBorder) {
          return [15, 15, 20, 255];
        }
        // Dialogue text lines at ny = -0.16, -0.10, -0.04
        const onTextLine1 = Math.abs(ny - (-0.16)) < 0.015 && Math.abs(nx - 0.52) < 0.26;
        const onTextLine2 = Math.abs(ny - (-0.10)) < 0.015 && Math.abs(nx - 0.52) < 0.30;
        const onTextLine3 = Math.abs(ny - (-0.04)) < 0.015 && Math.abs(nx - 0.52) < 0.22;
        if (onTextLine1 || onTextLine2 || onTextLine3) {
          return [25, 25, 35, 255];
        }
        // Pure white speech bubble
        return [255, 255, 255, 255];
      }

      return [Math.min(255, r), Math.min(255, g), Math.min(255, b), 255];
    }
  }
];

// Generate 720x960 sample manhwa panels
const W = 720;
const H = 960;

PANELS.forEach(panel => {
  const buf = createPng(W, H, panel.pixel);
  const outPath = path.join(panelsDir, panel.name);
  fs.writeFileSync(outPath, buf);
  console.log(`Generated sample comic panel: ${panel.name} (${buf.length} bytes)`);
});
