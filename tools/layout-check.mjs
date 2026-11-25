// Checks the real Crypt page layout in a headless browser at the window sizes in tests/fixtures/page-layout.json, with the
// web demo's 19 sample tabs: nothing overlaps the header, the search box, the pinned pages or the chips, the page never
// scrolls, and the card action buttons are at least 28 px. No screenshots: it only reads element boxes.
//
//   npm run demo:build && npm run layout:check          check
//   npm run layout:check -- --write                     check and record the measured card areas for tests/pageLayout.test.ts
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright-core';

const root = join(import.meta.dirname, '..');
const dist = join(root, 'demo', 'dist');
const fixturePath = join(root, 'tests', 'fixtures', 'page-layout.json');
const fixture = JSON.parse(await readFile(fixturePath, 'utf8'));
const write = process.argv.includes('--write');

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
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
const url = `http://127.0.0.1:${server.address().port}/`;

const launch = async () => {
  try {
    return await chromium.launch({ channel: 'chrome' });
  } catch {
    return chromium.launch();
  }
};
const browser = await launch();
const failures = [];
const measured = [];
try {
  for (const { width, height } of fixture.windows) {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.goto(url);
    await page.waitForSelector('.card-grid > .card', { timeout: 20000 });
    // Let the card entrance animation finish.
    await page.waitForTimeout(2000);
    const m = await page.evaluate(() => {
      const box = (el) => {
        const b = el.getBoundingClientRect();
        return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, width: b.width };
      };
      const one = (sel) => {
        const el = document.querySelector(sel);
        return el ? box(el) : null;
      };
      const slots = [...document.querySelectorAll('.card-grid > .card, .card-grid > .card-more')].map(box);
      const above = ['.header', '.search', '.haunts', '.legend'].map(one).filter(Boolean);
      const btns = [...document.querySelectorAll('.card-actions .icon-btn')].map(box);
      const se = document.scrollingElement;
      const more = document.querySelector('.card-more-count')?.textContent ?? '';
      const area = one('.cards-area');
      return {
        slots, aboveBottom: Math.max(...above.map((b) => b.bottom)), area,
        cards: document.querySelectorAll('.card-grid > .card').length, more: Number(more.replace(/\D/g, '')) || 0,
        minButton: Math.min(...btns.map((b) => b.width)),
        scroll: { y: se.scrollHeight > se.clientHeight, x: se.scrollWidth > se.clientWidth },
      };
    });
    const tag = `${width}x${height}`;
    const check = (ok, what) => {
      if (!ok) failures.push(`${tag}: ${what}`);
    };
    const top = Math.min(...m.slots.map((s) => s.top));
    const bottom = Math.max(...m.slots.map((s) => s.bottom));
    check(top >= m.aboveBottom, `cards start at ${top.toFixed(1)}, above the controls' bottom ${m.aboveBottom.toFixed(1)}`);
    check(bottom <= height + 0.5, `cards end at ${bottom.toFixed(1)}, below the window`);
    check(m.slots.every((s) => s.left >= -0.5 && s.right <= width + 0.5), 'a card is outside the window');
    check(!m.scroll.x && !m.scroll.y, 'the page scrolls');
    check(m.minButton >= 28 - 0.01, `action buttons are ${m.minButton.toFixed(1)} px`);
    check(m.cards + m.more === fixture.tabs, `${m.cards} cards and +${m.more} more, not ${fixture.tabs} tabs`);
    check(m.cards >= 1, 'no card is shown');
    console.log(`${tag}: ${m.cards} cards${m.more ? ` + ${m.more} more` : ''}, buttons ${m.minButton.toFixed(1)} px, cards area ${Math.floor(m.area.width)} x ${Math.floor(m.area.bottom - m.area.top)}`);
    measured.push({ width, height, areaWidth: Math.floor(m.area.width), areaHeight: Math.floor(m.area.bottom - m.area.top), cards: m.cards, more: m.more });
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
if (write) {
  await writeFile(fixturePath, `${JSON.stringify({ ...fixture, measured }, null, 2)}\n`);
  console.log(`Wrote ${fixturePath}`);
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('Layout OK');
