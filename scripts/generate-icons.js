const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 table for PNG chunk checksums
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
  const typeAndData = chunk.subarray(4, 8 + len);
  const crc = crc32(typeAndData);
  chunk.writeUInt32BE(crc, 8 + len);
  return chunk;
}

function createPng(width, height, pixelFn) {
  const scanlines = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (width * 4 + 1);
    scanlines[rowOffset] = 0; // Filter type 0 (None)
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
  ihdrData[8] = 8; // 8 bits per channel
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0; // Deflate
  ihdrData[11] = 0; // Filter
  ihdrData[12] = 0; // No interlace
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  const compressedData = zlib.deflateSync(scanlines, { level: 9 });
  const idatChunk = makeChunk('IDAT', compressedData);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Draw a stylized Manhwa reader with glowing ambient aura
function renderIconPixel(x, y, w, h) {
  const nx = (x / w) * 2 - 1; // -1 to 1
  const ny = (y / h) * 2 - 1; // -1 to 1
  const distFromCenter = Math.sqrt(nx * nx + ny * ny);

  // Background: dark luxury rounded card or transparent
  const cornerR = 0.85;
  const inCard = Math.abs(nx) < cornerR && Math.abs(ny) < cornerR;
  
  // Ambient glow around central manhwa column
  // Central column: x between -0.32 and +0.32
  const colHalfW = 0.32;
  const colHalfH = 0.72;
  const isInsideCol = Math.abs(nx) <= colHalfW && Math.abs(ny) <= colHalfH;

  // Ambient side glow intensity
  // Strongest near x = +/- colHalfW, decays outward
  const distToEdgeX = Math.abs(Math.abs(nx) - colHalfW);
  const verticalFade = Math.max(0, 1 - Math.abs(ny) / 0.85);
  
  // Glow color gradient: Cyan to Purple / Violet
  const glowYFactor = (ny + 1) / 2; // 0 (top: cyan) to 1 (bottom: magenta/purple)
  const glowR = 120 + 135 * glowYFactor; // 120 -> 255
  const glowG = 80 + 80 * (1 - glowYFactor); // 160 -> 80
  const glowB = 255;

  if (isInsideCol) {
    // Comic strip panel with inner artwork / dividers
    const borderW = 0.03;
    const isBorder = (colHalfW - Math.abs(nx) < borderW) || (colHalfH - Math.abs(ny) < borderW);
    
    // Panel dividers (horizontal lines at ny = -0.22, 0.26)
    const isDivider = Math.abs(ny - (-0.22)) < 0.035 || Math.abs(ny - 0.26) < 0.035;

    if (isBorder) {
      return [230, 235, 250, 255];
    }
    if (isDivider) {
      return [30, 30, 42, 255];
    }

    // Inside comic panel panels:
    // Panel 1 (top): vibrant cyan/blue magical panel
    if (ny < -0.22) {
      return [45, 140, 240, 255];
    }
    // Panel 2 (middle): dramatic purple/gold panel
    if (ny < 0.26) {
      return [160, 60, 220, 255];
    }
    // Panel 3 (bottom): warm fiery magenta panel
    return [240, 80, 130, 255];
  }

  // Outside column: Ambient Light Halo!
  if (Math.abs(nx) > colHalfW && Math.abs(ny) <= colHalfH + 0.15) {
    const haloReach = 0.58;
    const outwardDist = Math.abs(nx) - colHalfW;
    if (outwardDist < haloReach) {
      const falloff = Math.pow(1 - (outwardDist / haloReach), 1.8) * verticalFade;
      const alpha = Math.min(255, falloff * 240);
      return [glowR, glowG, glowB, alpha];
    }
  }

  // Soft atmospheric corner glow
  if (distFromCenter < 0.95) {
    const cornerFalloff = Math.pow(Math.max(0, 1 - distFromCenter / 0.95), 2.5);
    return [glowR * 0.8, glowG * 0.7, glowB, cornerFalloff * 80];
  }

  return [0, 0, 0, 0];
}

const iconsDir = path.join(__dirname, '..', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

[16, 32, 48, 128].forEach(size => {
  const buf = createPng(size, size, renderIconPixel);
  const outPath = path.join(iconsDir, `icon${size}.png`);
  fs.writeFileSync(outPath, buf);
  console.log(`Generated ${outPath} (${buf.length} bytes)`);
});
