#!/usr/bin/env node
// Checks that every cross is the Russian Orthodox eight-pointed cross with the
// footrest's LEFT end (viewer's left) higher, and that pages use the shared
// sprite cross instead of the ☦ text glyph (fonts draw it inconsistently).
//
//   node scripts/check-crosses.mjs     (run `npm run build` first)
//
// Looks at: CROSS_PATH in src/components/_primitives.mjs; every SVG in public/
// (slanted <line> footrests, and paths drawn with the CROSS_PATH geometry);
// every built HTML page in dist/.
// Environment: OUT_DIR (default dist), PUBLIC_DIR.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, PUBLIC_DIR } from '../src/lib/content.mjs';
import { CROSS_PATH } from '../src/components/_primitives.mjs';

const OUT = path.resolve(ROOT, process.env.OUT_DIR || 'dist');
const errors = [];
let checked = 0;

function listFiles(dir, ext) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? listFiles(p, ext) : p.endsWith(ext) ? [p] : [];
  });
}

// Polygons of a path made only of straight segments (M L H V Z, either case).
// Returns null for paths with curves or arcs.
function polygons(d) {
  if (/[CcSsQqTtAa]/.test(d)) return null;
  const tokens = d.match(/[MmLlHhVvZz]|-?\d*\.?\d+(?:e-?\d+)?/g) || [];
  const out = [];
  let cur = null, x = 0, y = 0, cmd = null;
  for (let i = 0; i < tokens.length; ) {
    if (/[A-Za-z]/.test(tokens[i])) cmd = tokens[i++];
    const num = () => parseFloat(tokens[i++]);
    switch (cmd) {
      case 'M': case 'm': {
        const nx = num(), ny = num();
        [x, y] = cmd === 'm' ? [x + nx, y + ny] : [nx, ny];
        cur = [[x, y]]; out.push(cur); cmd = cmd === 'm' ? 'l' : 'L';
        break;
      }
      case 'L': x = num(); y = num(); cur.push([x, y]); break;
      case 'l': x += num(); y += num(); cur.push([x, y]); break;
      case 'H': x = num(); cur.push([x, y]); break;
      case 'h': x += num(); cur.push([x, y]); break;
      case 'V': y = num(); cur.push([x, y]); break;
      case 'v': y += num(); cur.push([x, y]); break;
      case 'Z': case 'z': [x, y] = cur[0]; break;
      default: return null;
    }
  }
  return out;
}

const isRect = (poly) => poly.slice(0, 4).every(([px, py], i, a) => { const [qx, qy] = a[(i + 1) % 4]; return px === qx || py === qy; });

// A cross path: three axis-aligned bars plus one slanted footrest. Returns
// the footrest's slanted edges as [[x1, y1], [x2, y2]], or null.
function footrestEdges(d) {
  const polys = polygons(d);
  if (!polys || polys.length !== 4) return null;
  const rects = polys.filter(isRect);
  const slanted = polys.filter((p) => !isRect(p));
  if (rects.length !== 3 || slanted.length !== 1) return null;
  const p = slanted[0];
  return p.map((a, i) => [a, p[(i + 1) % p.length]]).filter(([a, b]) => a[0] !== b[0] && a[1] !== b[1]);
}

const leftHigher = ([a, b]) => { const [l, r] = a[0] < b[0] ? [a, b] : [b, a]; return l[1] < r[1]; };

const shared = footrestEdges(CROSS_PATH);
checked++;
if (!shared || !shared.length) errors.push('CROSS_PATH: could not find the slanted footrest');
else if (!shared.every(leftHigher)) errors.push('CROSS_PATH: footrest slants the wrong way (its left end must be higher)');

for (const file of listFiles(PUBLIC_DIR, '.svg')) {
  const rel = path.relative(ROOT, file);
  const svg = fs.readFileSync(file, 'utf8');
  if (svg.includes('☦')) errors.push(`${rel}: uses the ☦ text glyph`);
  for (const m of svg.matchAll(/<line\b[^>]*>/g)) {
    const a = Object.fromEntries([...m[0].matchAll(/\b(x1|y1|x2|y2)="(-?[\d.]+)"/g)].map(([, k, v]) => [k, +v]));
    if (a.x1 === a.x2 || a.y1 === a.y2) continue;
    checked++;
    if (!leftHigher([[a.x1, a.y1], [a.x2, a.y2]])) errors.push(`${rel}: footrest line ${m[0]} has its left end lower`);
  }
  for (const m of svg.matchAll(/<path\b[^>]*\sd="([^"]+)"/g)) {
    const polys = polygons(m[1]);
    const segment = polys && polys.length === 1 && polys[0].length === 2 ? [polys[0]] : null;
    const edges = footrestEdges(m[1]) || (segment && segment[0][0][0] !== segment[0][1][0] && segment[0][0][1] !== segment[0][1][1] ? segment : null);
    if (!edges) continue;
    checked++;
    if (!edges.every(leftHigher)) errors.push(`${rel}: cross footrest path ${m[1]} has its left end lower`);
  }
}

const pages = listFiles(OUT, '.html');
for (const file of pages) {
  const rel = path.relative(OUT, file);
  const page = fs.readFileSync(file, 'utf8');
  if (/☦|&#9766;|&#x2626;/i.test(page)) errors.push(`${rel}: uses the ☦ text glyph`);
  for (const m of page.matchAll(/<svg class="[^"]*cross[^"]*"[^>]*>(.*?)<\/svg>/g)) {
    checked++;
    if (!m[1].includes('href="#i-cross"')) errors.push(`${rel}: a cross does not use the shared #i-cross symbol`);
  }
  const symbols = [...page.matchAll(/<symbol id="i-cross"[^>]*><path d="([^"]+)"/g)];
  if (page.includes('#i-cross') && symbols.length !== 1) errors.push(`${rel}: expected one #i-cross symbol, found ${symbols.length}`);
  for (const [, d] of symbols) {
    checked++;
    const edges = footrestEdges(d);
    if (!edges || !edges.every(leftHigher)) errors.push(`${rel}: the #i-cross symbol's footrest slants the wrong way`);
  }
}

if (errors.length) {
  console.error(`Cross check failed (${errors.length}):\n  ${errors.join('\n  ')}`);
  process.exit(1);
}
console.log(`Crosses OK — ${checked} crosses checked (shared symbol, ${pages.length} pages, SVGs in ${path.relative(ROOT, PUBLIC_DIR)}/); every footrest is higher on the left.`);
