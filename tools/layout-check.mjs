// Checks the real Crypt page layout in a headless browser at the window sizes in tests/fixtures/page-layout.json, with the
// web demo's 19 sample tabs: nothing overlaps the header, the search box, the pinned pages or the chips, the page never
// scrolls, and the card action buttons are at least 28 px. No screenshots: it only reads element boxes.
//
//   npm run demo:build && npm run layout:check          check
//   npm run layout:check -- --write                     check and record the measured card areas for tests/pageLayout.test.ts
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { launchBrowser, serveDemo } from './demoServer.mjs';

const root = join(import.meta.dirname, '..');
const fixturePath = join(root, 'tests', 'fixtures', 'page-layout.json');
const fixture = JSON.parse(await readFile(fixturePath, 'utf8'));
const write = process.argv.includes('--write');

const { url, close } = await serveDemo();
const browser = await launchBrowser();
const failures = [];
const measured = [];
const uiRects = [];
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
      const btns = [...document.querySelectorAll('.card-grid .card-actions .icon-btn')].map(box);
      // Every button stays inside its card, and the buttons of a card do not overlap.
      const buttonsFit = [...document.querySelectorAll('.card-grid > .card')].every((card) => {
        const c = card.getBoundingClientRect();
        const bs = [...card.querySelectorAll('.card-actions .icon-btn')].map((b) => b.getBoundingClientRect());
        return bs.every((b, i) => b.left >= c.left - 0.5 && b.right <= c.right + 0.5 && (i === 0 || b.left >= bs[i - 1].right - 0.5));
      });
      const se = document.scrollingElement;
      const more = document.querySelector('.card-more-count')?.textContent ?? '';
      const area = one('.cards-area');
      // The boxes of the page's own controls (fractions of the window), for the moon and creature checks.
      const union = (sel) => {
        const bs = [...document.querySelectorAll(sel)].map((e) => e.getBoundingClientRect()).filter((b) => b.width > 0);
        if (!bs.length) return null;
        const r = (v) => Math.round(v * 10000) / 10000;
        return {
          x0: r(Math.min(...bs.map((b) => b.left)) / innerWidth), x1: r(Math.max(...bs.map((b) => b.right)) / innerWidth),
          y0: r(Math.min(...bs.map((b) => b.top)) / innerHeight), y1: r(Math.max(...bs.map((b) => b.bottom)) / innerHeight),
        };
      };
      const ui = {
        brand: union('.brand'), stats: union('.stats-panel'), actions: union('.header-actions .header-btn'), search: union('.search-field'),
        pinned: union('.haunts-list > li'), chips: union('.legend-chip'), cards: union('.card-grid > *'), strip: union('.demo-strip'),
      };
      return {
        slots, aboveBottom: Math.max(...above.map((b) => b.bottom)), area,
        ui,
        cards: document.querySelectorAll('.card-grid > .card').length, more: Number(more.replace(/\D/g, '')) || 0,
        minButton: Math.min(...btns.map((b) => b.width)),
        buttonsFit,
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
    check(m.buttonsFit, 'action buttons leave their card or overlap');
    if (m.more > 0) {
      // "+N more" opens a panel listing every hidden tab; it scrolls inside, the page does not, and Escape closes it.
      await page.click('.card-more-btn');
      await page.waitForSelector('.hidden-panel');
      const p = await page.evaluate(() => {
        const se = document.scrollingElement;
        const panel = document.querySelector('.hidden-panel').getBoundingClientRect();
        return {
          rows: document.querySelectorAll('.hidden-row').length,
          inside: panel.top >= 0 && panel.bottom <= window.innerHeight && panel.left >= 0 && panel.right <= window.innerWidth,
          pageScrolls: se.scrollHeight > se.clientHeight,
          minButton: Math.min(...[...document.querySelectorAll('.hidden-row .icon-btn')].map((b) => b.getBoundingClientRect().width)),
        };
      });
      check(p.rows === m.more, `the panel lists ${p.rows} tabs, not ${m.more}`);
      check(p.inside, 'the panel is outside the window');
      check(!p.pageScrolls, 'the page scrolls with the panel open');
      check(p.minButton >= 28, `panel buttons are ${p.minButton} px`);
      await page.keyboard.press('Escape');
      await page.waitForSelector('.hidden-panel', { state: 'detached', timeout: 2000 }).catch(() => check(false, 'Escape does not close the panel'));
    }
    console.log(`${tag}: ${m.cards} cards${m.more ? ` + ${m.more} more` : ''}, buttons ${m.minButton.toFixed(1)} px, cards area ${Math.floor(m.area.width)} x ${Math.floor(m.area.bottom - m.area.top)}`);
    uiRects.push({ width, height, ...m.ui });
    measured.push({ width, height, areaWidth: Math.floor(m.area.width), areaHeight: Math.floor(m.area.bottom - m.area.top), cards: m.cards, more: m.more });
    await page.close();
  }
} finally {
  await browser.close();
  close();
}
if (write) {
  await writeFile(fixturePath, `${JSON.stringify({ ...fixture, measured, ui: uiRects }, null, 2)}\n`);
  console.log(`Wrote ${fixturePath}`);
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('Layout OK');
