#!/usr/bin/env node
// Copy rules for the template's sample content and built pages:
//   - no em dashes
//   - no QR codes
//   - no explainer or etiquette sections (first visit, what to expect, how to
//     dress...). That is the parish's own content to add later.
//
//   node scripts/check-copy.mjs     (run after the build)
import fs from 'node:fs';
import path from 'node:path';
import { CONTENT_DIR, ROOT } from '../src/lib/content.mjs';

const DIST = path.join(ROOT, 'dist');
const RULES = [
  [/\u2014/, 'em dash'],
  [/\bQR\b|qr-?code/i, 'QR code'],
  [/first[ -]time visitor|first visit|what to expect|plan (a|your) visit|how to dress|dress code|etiquette|things you will notice|what is orthodoxy|new to orthodoxy/i, 'explainer copy'],
  [/впервые у нас|чего ждать|как одеваться|этикет/i, 'explainer copy']
];

const files = (dir, ext) =>
  fs.existsSync(dir)
    ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const full = path.join(dir, e.name);
        return e.isDirectory() ? files(full, ext) : full.endsWith(ext) ? [full] : [];
      })
    : [];

const problems = [];
for (const file of [...files(CONTENT_DIR, '.json'), ...files(DIST, '.html')]) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    for (const [re, what] of RULES) {
      const m = line.match(re);
      if (m) problems.push(`${path.relative(ROOT, file)}:${i + 1}: ${what} ("${m[0]}")`);
    }
  });
}

if (problems.length) {
  console.error(`Copy check failed (${problems.length}):\n  ${problems.slice(0, 50).join('\n  ')}`);
  process.exit(1);
}
console.log('Copy check passed: no em dashes, QR codes or explainer copy.');
