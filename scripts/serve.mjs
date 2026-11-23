#!/usr/bin/env node
// Minimal static server for dist/ (no dependencies).
//
//   node scripts/serve.mjs            serve dist/ on http://localhost:4321
//   node scripts/serve.mjs --watch    rebuild when content/, src/, theme/ or public/ change
//
// Environment: PORT (default 4321), OUT_DIR (default dist).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.resolve(ROOT, process.env.OUT_DIR || 'dist');
const PORT = Number(process.env.PORT || 4321);
const WATCH = process.argv.includes('--watch');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
  '.mp3': 'audio/mpeg'
};

function build() {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(ROOT, 'src/build.mjs')], { stdio: 'inherit', cwd: ROOT });
    child.on('exit', (code) => resolve(code === 0));
  });
}

function resolveFile(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]);
  const target = path.normalize(path.join(OUT, clean));
  if (!target.startsWith(OUT)) return null;
  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
    const index = path.join(target, 'index.html');
    return fs.existsSync(index) ? index : null;
  }
  return fs.existsSync(target) ? target : null;
}

const server = http.createServer((req, res) => {
  const urlPath = req.url || '/';
  if (!urlPath.split('?')[0].endsWith('/') && !path.extname(urlPath.split('?')[0])) {
    const dir = resolveFile(urlPath + '/');
    if (dir) {
      res.writeHead(301, { location: urlPath + '/' });
      return res.end();
    }
  }
  const file = resolveFile(urlPath);
  if (!file) {
    const notFound = path.join(OUT, '404.html');
    res.writeHead(404, { 'content-type': TYPES['.html'] });
    return res.end(fs.existsSync(notFound) ? fs.readFileSync(notFound) : 'Not found');
  }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
});

if (!fs.existsSync(OUT) || WATCH) await build();

server.listen(PORT, () => {
  console.log(`Serving ${path.relative(ROOT, OUT) || '.'} at http://localhost:${PORT}/${WATCH ? ' (watching for changes)' : ''}`);
});

if (WATCH) {
  let timer = null;
  let running = false;
  const trigger = () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      if (running) return trigger();
      running = true;
      await build();
      running = false;
    }, 150);
  };
  for (const dir of ['content', 'src', 'theme', 'public']) {
    fs.watch(path.join(ROOT, dir), { recursive: true }, trigger);
  }
}
