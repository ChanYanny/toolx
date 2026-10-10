import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

// Render the ToolX brand glyph as self-contained extension icons.
const folder = fileURLToPath(new URL('../public/icon/', import.meta.url));
mkdirSync(folder, { recursive: true });
const segments = [[42, 39, 24, 64], [24, 64, 42, 89], [87, 39, 105, 64], [105, 64, 87, 89], [71, 34, 57, 94]];
function distance(x, y, [x1, y1, x2, y2]) {
  const dx = x2 - x1, dy = y2 - y1;
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - x1 - t * dx, y - y1 - t * dy);
}
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = crc >>> 1 ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type);
  const size = Buffer.alloc(4), checksum = Buffer.alloc(4);
  size.writeUInt32BE(data.length);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([size, name, data, checksum]);
}
for (const size of [16, 32, 48, 128]) {
  const pixels = Buffer.alloc(size * (size * 4 + 1));
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const color = [0, 0, 0, 0];
      for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) {
        const x = (px + (sx + .5) / 4) * 128 / size;
        const y = (py + (sy + .5) / 4) * 128 / size;
        const edgeX = Math.max(22 - x, x - 106, 0), edgeY = Math.max(22 - y, y - 106, 0);
        const inside = Math.hypot(edgeX, edgeY) <= 22;
        const glyph = segments.some((segment) => distance(x, y, segment) < 3.5);
        const sample = !inside ? [38, 124, 91, 0] : glyph ? [244, 255, 248, 255] : [38, 124, 91, 255];
        sample.forEach((value, index) => { color[index] += value / 16; });
      }
      const offset = py * (size * 4 + 1) + 1 + px * 4;
      color.forEach((value, index) => { pixels[offset + index] = Math.round(value); });
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4);
  header[8] = 8; header[9] = 6;
  writeFileSync(`${folder}/${size}.png`, Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0)),
  ]));
}
console.log('Generated extension icons: 16, 32, 48, 128 px');
