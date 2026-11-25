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
