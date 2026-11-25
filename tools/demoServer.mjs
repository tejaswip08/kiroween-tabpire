// Serves demo/dist on a free local port and starts headless Chrome (or Playwright's Chromium). For the tools/ checks.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright-core';

const dist = join(import.meta.dirname, '..', 'demo', 'dist');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm', '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };

/** Starts the server; returns its address and a function that stops it. */
export async function serveDemo() {
  const server = createServer(async (req, res) => {
    const path = normalize(decodeURIComponent((req.url ?? '/').split('?')[0])).replace(/^(\.\.[/\\])+/, '');
    const file = join(dist, path.endsWith('/') ? `${path}index.html` : path);
    if (!file.startsWith(dist)) return void res.writeHead(403).end();
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  return { url: `http://127.0.0.1:${server.address().port}/`, close: () => server.close() };
}

export async function launchBrowser(args = []) {
  try {
    return await chromium.launch({ channel: 'chrome', args });
  } catch {
    return chromium.launch({ args });
  }
}
