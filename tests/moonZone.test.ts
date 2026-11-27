// Every enabled theme shows its whole moon in the clear sky (upper right, off every control, above the cards) at the
// usual window sizes, and no ghost or creature sits behind the stats panel, the search box or the header buttons. The
// boxes of the controls were measured on the real page (`npm run layout:check -- --write`, tests/fixtures/page-layout.json).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cameraAt, project } from '../lib/scene/camera';
import { MODELS, layout } from '../lib/scene/layout';
import { moonScreenRadiusScaled, moonTarget } from '../lib/scene/sky';
import { themeScene } from '../lib/scene/themeLayout';
import { ENABLED_THEME_IDS } from '../lib/themes';
import { TREE_LINE_Z } from '../lib/scene/uniqueScenes/forestHouse';

interface Box { x0: number; x1: number; y0: number; y1: number }
interface Ui { width: number; height: number; [k: string]: number | Box | null }
const ui = (JSON.parse(readFileSync('tests/fixtures/page-layout.json', 'utf8')) as { ui: Ui[] }).ui;
const SIZES = ['1280x600', '1366x768', '1440x900', '1920x1080'];
const at = (size: string) => ui.find((u) => `${u.width}x${u.height}` === size)!;
const box = (u: Ui, k: string) => u[k] as Box | null;
/** The pinned row can hold up to ten pages: its box is the row's full width (900 px, centred), not just today's tiles. */
const pinnedRow = (u: Ui): Box => {
  const p = box(u, 'pinned')!;
  const half = Math.min(900, u.width - 48) / 2 / u.width;
  return { x0: 0.5 - half, x1: 0.5 + half, y0: p.y0, y1: p.y1 };
};
const controls = (u: Ui): [string, Box][] =>
  (
    [
      ['brand', box(u, 'brand')],
      ['stats panel', box(u, 'stats')],
      ['header buttons', box(u, 'actions')],
      ['search box', box(u, 'search')],
      ['pinned pages', pinnedRow(u)],
      ['state chips', box(u, 'chips')],
      ['cards', box(u, 'cards')],
    ] as [string, Box | null][]
  ).filter((e): e is [string, Box] => e[1] !== null);
/** Does a circle (centre and radius in window-height units) touch a box? */
function circleTouches(cx: number, cy: number, r: number, b: Box, aspect: number, pad = 0.006): boolean {
  const dx = Math.max(b.x0 - pad - cx, 0, cx - (b.x1 + pad)) * aspect;
  const dy = Math.max(b.y0 - pad - cy, 0, cy - (b.y1 + pad));
  return Math.hypot(dx, dy) < r;
}
const moonOf = (id: (typeof ENABLED_THEME_IDS)[number]) => {
  const m = themeScene(id).unique?.moon;
  return m ? { target: m.target, scale: m.scale } : { target: moonTarget, scale: 1 };
};

describe.each(ENABLED_THEME_IDS)('the moon of %s', (id) => {
  const moon = moonOf(id);
  it.each(SIZES)('is whole, in the clear sky, at %s', (size) => {
    const u = at(size);
    const a = u.width / u.height;
    const t = moon.target(a);
    const r = moonScreenRadiusScaled(a, moon.scale).disc;
    // Inside the window.
    expect(t.x - r / a).toBeGreaterThan(0);
    expect(t.x + r / a).toBeLessThan(1);
    expect(t.y - r).toBeGreaterThan(0);
    // Off every control and the cards.
    for (const [name, b] of controls(u)) expect(circleTouches(t.x, t.y, r, b, a), `${name} at ${size}`).toBe(false);
  });
});

describe('the Crypt keeps its layout and still shows the moon', () => {
  // The bare dead trees on the right may reach their thin branches across the disc (the moon shows between them, as in
  // the other themes); no solid prop (crypt, gate, fence, lantern, grave) may stand over it.
  it('no solid prop stands over the disc where it is drawn now', () => {
    for (const size of SIZES) {
      const u = at(size);
      const a = u.width / u.height;
      const cam = cameraAt(0, a, true);
      const t = moonTarget(a);
      const r = moonScreenRadiusScaled(a, 1).disc + 0.01;
      for (const p of layout().placements) {
        if (p.group === 'tree') continue;
        const info = MODELS[p.model];
        const h = info.h * p.scale;
        const w = Math.max(info.hx, info.hz) * p.scale;
        for (const fy of [1, 0.75, 0.5]) {
          for (const dx of [-w, 0, w]) {
            const q = project([p.x + dx, p.y + h * fy, p.z], cam);
            if (q) expect(Math.hypot((q.x - t.x) * a, q.y - t.y) < r, `${p.id} at ${size}`).toBe(false);
          }
        }
      }
    }
  });
});

describe.each(ENABLED_THEME_IDS)('the creatures of %s', (id) => {
  const scene = themeScene(id);
  // Ghosts drift up to 0.9 sideways, 0.7 in depth and 0.22 up and down, and are about 1.2 tall and 1 wide.
  const ghosts = [...scene.layout.ghostSpots, ...(scene.unique?.forest?.ghosts ?? [])];
  const critters = id === 'crypt' ? [scene.layout.scenery.owl, ...scene.layout.scenery.crows].map((c) => ({ x: c.x, y: c.y + 0.4, z: c.z })) : [];
  it.each(SIZES)('never sit behind the stats panel, the search box or the header buttons at %s', (size) => {
    const u = at(size);
    const a = u.width / u.height;
    const cam = cameraAt(0, a, true);
    const keepOut = controls(u).filter(([n]) => n === 'stats panel' || n === 'search box' || n === 'header buttons');
    for (const g of [...ghosts, ...critters]) {
      for (const [dx, dy, dz] of [[0, 0, 0], [0.9, 0.22, 0.7], [-0.9, 0.22, -0.7], [0.9, 0.82, 0], [-0.9, 0.82, 0]] as const) {
        const q = project([g.x + dx, g.y + dy, g.z + dz], cam);
        if (!q) continue;
        for (const [name, b] of keepOut) {
          const inside = q.x > b.x0 && q.x < b.x1 && q.y > b.y0 && q.y < b.y1;
          expect(inside, `${id} creature at ${g.x},${g.y},${g.z} behind the ${name} at ${size}`).toBe(false);
        }
      }
    }
  });
});
// The whole disc floats above the tree line with open sky under it: for the Witch's Forest the tops of the pine cones of its
// tree-line under the disc, for every other theme the far horizon. The real drawn disc matches this planned one (checked
// in the demo by `npm run console:check`, which reads the box Moon.tsx measures from the real camera).
describe.each(ENABLED_THEME_IDS)('the moon of %s above the tree line', (id) => {
  const moon = moonOf(id);
  it.each(['1280x600', '1366x768', '1440x900', '1920x1080', '2000x1032'])('has sky under the whole disc at %s', (size) => {
    const [w, h] = size.split('x').map(Number) as [number, number];
    const a = w / h;
    const cam = cameraAt(0, a, true);
    const t = moon.target(a);
    const r = moonScreenRadiusScaled(a, moon.scale).disc;
    let skyline = project([0, 0, -400], cam)!.y;
    const forest = themeScene(id).unique?.forest;
    if (forest) {
      for (const l of forest.mid.lineTrees) {
        const q = project([l.x, l.height, TREE_LINE_Z], cam);
        if (q && q.x > t.x - r / a && q.x < t.x + r / a) skyline = Math.min(skyline, q.y);
      }
    }
    expect(t.y + r, `bottom of the disc vs the tree line (${skyline.toFixed(3)})`).toBeLessThan(skyline - (forest ? 0.01 : 0.005));
    // Whole in the window, with a margin from the right edge.
    expect(t.x + r / a).toBeLessThan(0.99);
    expect(t.y - r).toBeGreaterThan(0);
  });
});
