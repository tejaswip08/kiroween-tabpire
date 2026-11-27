// Opens the web demo in headless Chrome, switches through every enabled theme, and fails on any console error or page
// error (for example a shader that does not compile). No screenshots: it only listens to the console.
//
//   npm run demo:build && node tools/console-check.mjs
import { launchBrowser, serveDemo } from './demoServer.mjs';

const THEMES = ['Pumpkin Patch', "Witch's Forest", 'Frozen Cemetery', 'The Crypt'];
const { url, close } = await serveDemo();
// GPU-less machines still get WebGL 2 from SwiftShader.
const browser = await launchBrowser(['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist']);
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`page: ${e.message}`));
  page.on('response', (r) => {
    if (r.status() >= 400) errors.push(`${r.status()}: ${r.url().replace(url, '/')}`);
  });
  await page.goto(url);
  await page.waitForSelector('.card-grid > .card', { timeout: 20000 });
  const webgl = await page.evaluate(() => !!document.createElement('canvas').getContext('webgl2'));
  console.log(`WebGL 2: ${webgl ? 'yes' : 'no (3D layers are skipped, shader errors cannot show)'}`);
  await page.waitForSelector('.scene-canvas[data-ready="true"]', { timeout: 60000 }).catch(() => errors.push('the 3D scene never became ready'));
  for (const name of THEMES) {
    await page.click('button[aria-label="Themes"], .header-btn:has-text("Themes")');
    await page.click(`.theme-item:has-text("${name}")`);
    await page.keyboard.press('Escape');
    // The theme loads its models, builds its scene and compiles its shaders; the idle preload runs too.
    await page.waitForTimeout(6000);
    const shown = await page.evaluate(() => document.documentElement.dataset.theme);
    console.log(`${name}: data-theme=${shown}, errors so far ${errors.length}`);
  }
  // ----- The drawn moon: its real box on screen (written by Moon.tsx from the real camera) at every usual window size. -----
  // At rest (reduced motion) it must match the planned box the layout tests use (tests/moonZone.test.ts checks the plan
  // against the tree line); with the slow drift and the pointer in each corner (parallax) it must stay whole in the
  // window, off the right edge, and clear of the header buttons, the stats panel and the search box.
  const moonSizes = [[1280, 600], [1440, 900], [1920, 1080], [2000, 1032]];
  const readMoon = () => page.evaluate(() => {
    const c = document.querySelector('.scene-canvas canvas, canvas.scene-canvas');
    const num = (v) => (v ? v.split(',').map(Number) : null);
    const rect = (sel) => [...document.querySelectorAll(sel)].map((e) => e.getBoundingClientRect()).filter((b) => b.width > 0)
      .map((b) => [b.left / innerWidth, b.top / innerHeight, b.right / innerWidth, b.bottom / innerHeight]);
    return { box: num(c?.dataset.moonBox), plan: num(c?.dataset.moonPlan), controls: [...rect('.header-actions .header-btn'), ...rect('.stats-panel'), ...rect('.search-field')] };
  });
  const overlaps = (m, b) => m[0] < b[2] && m[2] > b[0] && m[1] < b[3] && m[3] > b[1];
  const round = (b) => b.map((v) => v.toFixed(3)).join(',');
  for (const name of THEMES) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.click('button[aria-label="Themes"], .header-btn:has-text("Themes")');
    await page.click(`.theme-item:has-text("${name}")`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(4000);
    for (const [w, h] of moonSizes) {
      await page.setViewportSize({ width: w, height: h });
      // At rest: reduced motion holds the camera still; the pointer is put away so the panels close.
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.mouse.move(w / 2, h - 2);
      await page.waitForTimeout(1500);
      await page.mouse.move(w / 2 + 1, h - 2);
      await page.waitForTimeout(1000);
      const rest = await readMoon();
      const label = `${name} moon at ${w}x${h}`;
      if (!rest.box || !rest.plan) { errors.push(`${label}: no moon box on the canvas`); continue; }
      if (rest.box.some((v, i) => Math.abs(v - rest.plan[i]) > 0.012)) errors.push(`${label}: drawn box ${round(rest.box)} is not the planned box ${round(rest.plan)}`);
      // Moving: the drift and the pointer parallax, pointer in each corner.
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      const all = [rest];
      for (const [px, py] of [[2, h * 0.45], [w - 2, h * 0.45], [w / 2, h - 2], [w * 0.25, h * 0.4], [w * 0.75, h - 2]]) {
        await page.mouse.move(px, py, { steps: 4 });
        await page.waitForTimeout(1400);
        all.push(await readMoon());
      }
      for (const m of all) {
        const b = m.box;
        if (!b) continue;
        if (b[0] < 0.005 || b[1] < 0.005 || b[2] > 0.99 || b[3] > 0.995) errors.push(`${label}: part of the moon is outside the window (or within 1% of the right edge): ${round(b)}`);
        for (const c of m.controls) if (overlaps(b, c)) errors.push(`${label}: the moon ${round(b)} is under a header control ${round(c)}`);
      }
      console.log(`${label}: drawn ${round(rest.box)}, planned ${round(rest.plan)}`);
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const before = await page.evaluate(() => document.querySelectorAll('.card[data-3d="on"]').length);
  console.log(`cards with a 3D vampire before Reset demo: ${before}`);
  // Reset demo remounts the page: the 3D scene and the portraits must come back, not the flat fallback.
  await page.click('button:has-text("Reset demo")');
  await page.waitForFunction(() => document.querySelectorAll('.card[data-3d="on"]').length > 0, null, { timeout: 30000 }).catch(() => {});
  const after = await page.evaluate(() => ({
    scene: document.querySelector('[data-testid="scene-host"]')?.getAttribute('data-lost'),
    portrait: document.querySelector('[data-testid="portrait-host"]')?.getAttribute('data-lost'),
    canvases: document.querySelectorAll('.scene-canvas canvas, canvas.scene-canvas, .scene-canvas').length,
    cards3d: document.querySelectorAll('.card[data-3d="on"]').length,
  }));
  console.log(`after Reset demo: ${JSON.stringify(after)}`);
  if (after.scene !== 'false' || after.portrait !== 'false' || after.cards3d === 0) errors.push(`3D is gone after Reset demo: ${JSON.stringify(after)}`);
} finally {
  await browser.close();
  close();
}
if (errors.length) {
  console.error([...new Set(errors)].join('\n'));
  process.exit(1);
}
console.log('No console errors on any theme');
