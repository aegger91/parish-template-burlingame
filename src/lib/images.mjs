// Reads intrinsic image dimensions (JPEG, PNG, SVG) so every <img> gets
// width/height attributes and the layout never shifts while images load.
import fs from 'node:fs';
import path from 'node:path';

const cache = new Map();

function jpegSize(buf) {
  let offset = 2;
  while (offset < buf.length) {
    if (buf[offset] !== 0xff) return null;
    const marker = buf[offset + 1];
    const length = buf.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: buf.readUInt16BE(offset + 5), width: buf.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  return null;
}

function pngSize(buf) {
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function svgSize(text) {
  const vb = text.match(/viewBox="([\d.\-\s]+)"/);
  if (vb) {
    const [, , w, h] = vb[1].trim().split(/\s+/).map(Number);
    return { width: Math.round(w), height: Math.round(h) };
  }
  return null;
}

export function imageSize(publicDir, src) {
  if (!src || /^https?:/.test(src)) return null;
  if (cache.has(src)) return cache.get(src);
  const file = path.join(publicDir, src.replace(/^\//, ''));
  let size = null;
  try {
    const buf = fs.readFileSync(file);
    if (/\.jpe?g$/i.test(file)) size = jpegSize(buf);
    else if (/\.png$/i.test(file)) size = pngSize(buf);
    else if (/\.svg$/i.test(file)) size = svgSize(buf.toString('utf8'));
  } catch {
    size = null;
  }
  cache.set(src, size);
  return size;
}
