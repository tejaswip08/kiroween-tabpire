// The fill of the four enabled themes: small props that make the empty ground feel alive (tombstone rows, hay, mushrooms, snowdrifts ...).
// Pure and seeded: the same seed gives the same props on every load. Nothing here moves a prop the scene already has: the fill is
// laid out afterwards, and every new prop must pass the same checks as the scene's own (inside the ground, off the path, no overlap with a
// solid prop or a procedural part, not over the moon, the view rules) plus one more: it must end below the chips row, so it can only
// stand behind the cards and never behind the header, the stats, the search box or the chips.
// Coordinates: x right, y up, z toward the camera (the camera is at z = 16).
import { MODELS, footprintOf, insideGround, modelInfo, type Footprint, type ModelId, type Placement, type WarmSource } from '../layout';
import { cameraAt, directionAt } from '../camera';
import { Placer, VIEW_ASPECTS, modelsOf, viewOf, type PlaceOptions, type UniqueMoon } from './types';
import type { ThemeId } from '../../themes';

export type FillTheme = 'crypt' | 'pumpkin' | 'forest' | 'frost';

/** Screen y (from the top) the top of every fill prop must stay below: under the chips row (which ends near 0.39). */
export const FILL_TOP_Y = 0.43;
/** Added to the caller's seed, so the fill has its own random stream. */
export const FILL_SEED: Record<FillTheme, number> = { crypt: 9101, pumpkin: 9202, forest: 9303, frost: 9404 };
/** Props taller than this are never part of the fill: they could reach the moon, the header or the chips. */
export const FILL_MAX_HEIGHT = 3.4;

/** A firefly that hovers low over the ground (the Witch's Forest). */
export interface FillFirefly {
  x: number;
  y: number;
  z: number;
  seed: number;
}
export interface FillPlan {
  theme: FillTheme;
  /** Every new prop: models with a file, and the small shapes `fill_*` the scene draws itself. */
  placements: Placement[];
  /** Lit candles, lanterns, jack-o'-lanterns, mushrooms and the pot: pools of light and small flames. */
  glows: WarmSource[];
  fireflies: FillFirefly[];
  /** The unique models with a file (what the gate loader and the idle preload fetch). */
  models: ModelId[];
  /** Upper bound of the triangles the fill adds (shadow pass counted) and of its draw calls. */
  tris: number;
  calls: number;
}
export interface FillContext {
  theme: FillTheme;
  seed: number;
  /** The solid props the scene already has. */
  placements: readonly Placement[];
  /** Footprints of the things the scene draws itself, and the ground the fill must not cover. */
  keepOut: readonly Footprint[];
  path: { centre: readonly { x: number; z: number }[]; halfWidth: number };
  moon: UniqueMoon;
}
/** x is a signed fraction (-1 to 1) of the half width of the ground the camera shows at that depth, so a prop is always on screen. */
export interface Box {
  x: readonly [number, number];
  z: readonly [number, number];
}
/** Half width of the ground the narrowest usual window shows at depth z, with a margin at both edges. */
export const visibleHalf = (z: number): number => (16 - z) * 0.524;
/** World x of a fraction of the visible half width, around the middle of the view. */
export const xAt = (f: number, z: number): number => 0.5 + f * visibleHalf(z);
/** The ground point (x, z) that appears at a screen position (0 to 1, y from the top) at a 16:10 window, or null above the horizon. */
export function groundAt(sx: number, sy: number): { x: number; z: number } | null {
  const cam = cameraAt(0, 1.6, true);
  const d = directionAt(sx, sy, cam);
  if (d[1] >= -0.01) return null;
  const t = -cam.position[1] / d[1];
  return { x: cam.position[0] + d[0] * t, z: cam.position[2] + d[2] * t };
}
/** A screen region (fractions of the window width and height). */
export interface Screen {
  sx: readonly [number, number];
  sy: readonly [number, number];
}
/**
 * The parts of the screen no card covers when only a few tabs are open: the lower right of the second row of cards, and the edges.
 * (A full page of cards hides most of it, so nothing here makes a full page busy.)
 */
export const OPEN_SCREEN: readonly Screen[] = [
  { sx: [0.28, 0.97], sy: [0.73, 0.95] },
  { sx: [0.02, 0.97], sy: [0.66, 0.74] },
  { sx: [0.02, 0.07], sy: [0.5, 0.95] },
  { sx: [0.935, 0.98], sy: [0.5, 0.95] },
];
const isShape = (m: ModelId): boolean => m.startsWith('fill_');
/** Flat things (fog, footprints) are not solid: later props may stand on them. */
const FLAT_SHAPES: readonly ModelId[] = ['fill_fog', 'fill_print'];

/** True when a placement would show above the chips row, or off the screen, at any usual window shape. Empty string when fine. */
export function bandProblem(p: Placement): string {
  for (const aspect of VIEW_ASPECTS) {
    const v = viewOf(p, aspect);
    if (!v) return 'behind the camera';
    if (v.top < FILL_TOP_Y) return `top y ${v.top.toFixed(2)} is above the cards`;
    if (v.left < 0.01 || v.right > 0.99) return 'off the screen';
  }
  return '';
}

class FillPlacer extends Placer {
  override problem(p: Placement, opts: PlaceOptions = {}, isCentrepiece = false): string | null {
    if (p.model === 'fill_fog') {
      // Ground fog may drift over the path and under props, but it stays inside the ground.
      if (!insideGround(footprintOf(p))) return 'outside the ground';
    } else {
      const why = super.problem(p, opts, isCentrepiece);
      if (why) return why;
    }
    return bandProblem(p) || null;
  }
}

interface Opts extends PlaceOptions {
  tries?: number;
  /** How far the prop may lean (radians). */
  tilt?: number;
  /** Turn range. Default: any. */
  rot?: readonly [number, number];
  /** Lift per unit of scale (models whose file starts below y = 0). */
  lift?: number;
  group?: Placement['group'];
}

export function buildFill(ctx: FillContext): FillPlan {
  const placer = new FillPlacer({ id: ctx.theme as ThemeId, seed: FILL_SEED[ctx.theme] + ctx.seed, moon: ctx.moon, path: { centre: ctx.path.centre, halfWidth: ctx.path.halfWidth } });
  const { between, pick } = placer;
  placer.placements.push(...ctx.placements);
  for (const f of ctx.keepOut) placer.reserve(f);
  const first = ctx.placements.length;
  const glows: WarmSource[] = [];
  const fireflies: FillFirefly[] = [];

  const add = (model: ModelId, x: number, z: number, scale: number, o: Opts = {}): Placement | null => {
    if (MODELS[model].h * scale > FILL_MAX_HEIGHT) return null;
    const flat = FLAT_SHAPES.includes(model);
    const rotY = o.rot ? between(o.rot[0], o.rot[1]) : between(0, Math.PI * 2);
    const group = o.group ?? (model === 'fill_fog' ? 'ground' : flat ? 'path' : 'themed');
    const p = placer.make(model, group, x, z, rotY, scale, (o.lift ?? 0) * scale);
    const hit = placer.tryAdd(p, { margin: o.margin ?? 0.08, onPath: o.onPath, anyMoon: true });
    if (hit && o.tilt) hit.tilt = [between(-o.tilt, o.tilt), between(-o.tilt, o.tilt)];
    return hit;
  };
  /** Up to `count` props of a model (or one of several), each tried at random spots of the boxes. */
  const scatter = (models: ModelId | readonly ModelId[], count: number, boxes: Box | readonly Box[], scale: readonly [number, number], o: Opts = {}): Placement[] => {
    const list = (Array.isArray(boxes) ? boxes : [boxes]) as readonly Box[];
    const out: Placement[] = [];
    for (let n = 0; n < count; n++) {
      for (let t = 0; t < (o.tries ?? 50); t++) {
        const b = pick(list);
        const model = Array.isArray(models) ? pick(models as readonly ModelId[]) : (models as ModelId);
        const z = between(b.z[0], b.z[1]);
        const p = add(model, xAt(between(b.x[0], b.x[1]), z), z, between(scale[0], scale[1]), o);
        if (p) {
          out.push(p);
          break;
        }
      }
    }
    return out;
  };
  /** A row along x at depth z from fraction f0 to f1 of the visible half width, `step` apart, each prop a little off the line. */
  const row = (models: readonly ModelId[], z: number, f0: number, f1: number, step: number, scaleOf: (m: ModelId) => readonly [number, number], o: Opts = {}): Placement[] => {
    const out: Placement[] = [];
    let k = 0;
    for (let x = xAt(f0, z); x <= xAt(f1, z); x += step * between(0.9, 1.15)) {
      const model = models[k++ % models.length]!;
      const s = scaleOf(model);
      for (let t = 0; t < 4; t++) {
        const p = add(model, x + between(-0.3, 0.3), z + between(-0.35, 0.35), between(s[0], s[1]), o);
        if (p) {
          out.push(p);
          break;
        }
      }
    }
    return out;
  };
  /** The same z range on both sides of the middle: fractions `gap[0]` to `gap[1]` of the visible half width, left and right. */
  /** Like `scatter`, but the spot is picked on the screen: where a prop would show in the open lower part of the window. */
  const onScreen = (models: ModelId | readonly ModelId[], count: number, regions: readonly Screen[], scale: readonly [number, number], o: Opts = {}): Placement[] => {
    const out: Placement[] = [];
    for (let n = 0; n < count; n++) {
      for (let t = 0; t < (o.tries ?? 60); t++) {
        const r = pick(regions);
        const g = groundAt(between(r.sx[0], r.sx[1]), between(r.sy[0], r.sy[1]));
        if (!g) continue;
        const model = Array.isArray(models) ? pick(models as readonly ModelId[]) : (models as ModelId);
        const p = add(model, g.x, g.z, between(scale[0], scale[1]), o);
        if (p) {
          out.push(p);
          break;
        }
      }
    }
    return out;
  };
  const sides = (z: readonly [number, number], gap: readonly [number, number] = [0.3, 0.97]): Box[] => [
    { x: [-gap[1], -gap[0]], z },
    { x: [gap[0], gap[1]], z },
  ];
  const glow = (kind: WarmSource['kind'], p: Placement, y: number, size?: number) => glows.push({ kind, x: p.x, y, z: p.z, size });

  if (ctx.theme === 'crypt') crypt();
  else if (ctx.theme === 'pumpkin') pumpkin();
  else if (ctx.theme === 'forest') forest();
  else frost();

  // ----- The Crypt: rows of crooked tombstones, small crosses, candles, broken fence, bones, dead grass, lanterns and ground fog -----
  function crypt(): void {
    const candles: ModelId[] = ['candle_triple', 'candle_thin', 'candle_melted'];
    const BIG: ModelId[] = ['gravestone', 'grave_B', 'grave_A_destroyed'];
    const stones: ModelId[] = ['gravestone', 'gravemarker_A', 'grave_B', 'gravemarker_B', 'gravemarker_A', 'grave_A_destroyed'];
    const stoneScale = (m: ModelId): readonly [number, number] => (BIG.includes(m) ? [0.85, 1.05] : [1.2, 1.55]);
    // A few lanterns along the path, one on each side in turn.
    const c = ctx.path.centre;
    [4, 9, 14, 19, 24].forEach((i, n) => {
      const a = c[Math.min(i, c.length - 1)]!;
      const b = c[Math.min(i + 1, c.length - 1)]!;
      const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      const side = n % 2 ? 1 : -1;
      const l = add('lantern_standing', a.x - ((b.z - a.z) / len) * side * 2.9, a.z + ((b.x - a.x) / len) * side * 2.9, 1.5, { onPath: true, rot: [0, 0.01] });
      if (l) glow('lantern', l, 0.75);
    });
    // Rows of crooked tombstones: near the camera first, then farther back.
    for (const [z, step] of [[7.0, 1.7], [4.6, 2.2], [1.6, 2.6], [-1.6, 2.8], [-5.2, 3]] as const) {
      for (const [f0, f1] of [[-0.97, -0.3], [0.3, 0.97]] as const) row(stones, z, f0, f1, step, stoneScale, { tilt: 0.16, rot: [-0.3, 0.3], margin: 0.2 });
    }
    scatter('fill_cross', 9, sides([-6, 6.5]), [1.1, 1.6], { tilt: 0.2, rot: [-0.5, 0.5] });
    // Candles, some lit, among the stones.
    for (const p of scatter(candles, 9, sides([-5, 6.5]), [1.3, 1.7])) glow('candle', p, MODELS[p.model].h * p.scale);
    // Broken fence pieces lean out of the grass.
    scatter('fence_broken', 3, sides([-2, 5]), [0.65, 0.85], { rot: [-0.35, 0.35], tilt: 0.1, margin: 0.2 });
    scatter('fence_pillar', 5, sides([-3, 6]), [0.8, 1.1], { tilt: 0.18 });
    // Bones and skulls.
    scatter(['bone_A', 'bone_B', 'bone_C'], 9, sides([-4, 7]), [1.4, 1.9]);
    scatter('skull', 4, sides([-3, 6.5]), [1.0, 1.3]);
    scatter('ribcage', 2, sides([-2, 5]), [1.4, 1.8]);
    // Dead grass tufts fill the gaps.
    scatter('fill_tuft', 46, sides([-8, 8.5], [0.2, 0.97]), [1.0, 1.9], { margin: 0.02, tries: 30 });
    // Ground fog drifting low.
    scatter('fill_fog', 7, sides([-7, 7.5], [0.2, 0.9]), [1.3, 2.4], { tries: 30 });
    // The open lower screen: a few more stones, crosses, candles, bones and dead grass.
    onScreen(stones, 10, OPEN_SCREEN, [1.0, 1.5], { tilt: 0.16, rot: [-0.3, 0.3], margin: 0.2 });
    onScreen('fill_cross', 4, OPEN_SCREEN, [1.1, 1.5], { tilt: 0.2, rot: [-0.5, 0.5] });
    for (const p of onScreen(candles, 4, OPEN_SCREEN, [1.3, 1.7])) glow('candle', p, MODELS[p.model].h * p.scale);
    onScreen(['bone_A', 'bone_B', 'bone_C', 'skull'], 6, OPEN_SCREEN, [1.3, 1.8]);
    onScreen('fence_broken', 1, OPEN_SCREEN, [0.7, 0.85], { rot: [-0.3, 0.3], margin: 0.2 });
    onScreen('fill_tuft', 18, OPEN_SCREEN, [1.0, 1.8], { margin: 0.02, tries: 30 });
    onScreen('fill_fog', 3, OPEN_SCREEN, [1.5, 2.2], { tries: 30 });
  }

  // ----- The Pumpkin Patch: more pumpkin rows with vines, hay, a wheelbarrow, corn, a scarecrow, crows on posts and glowing jack-o'-lanterns -----
  function pumpkin(): void {
    // Jack-o'-lanterns glow near the front.
    for (const p of scatter('pumpkin_orange_jackolantern', 4, sides([1, 6.5], [0.55, 0.97]), [0.8, 1.05], { rot: [-0.5, 0.5], margin: 0.15 })) glow('jackOLantern', p, 0.65 * p.scale);
    for (const [z, step] of [[4.0, 1.9], [1.8, 2], [-0.4, 2], [-2.8, 2.1], [-5.2, 2.2]] as const) {
      for (const [f0, f1] of [[-0.97, -0.5], [0.5, 0.97]] as const) {
        for (const p of row(['farm_pumpkin'], z, f0, f1, step, () => [0.5, 0.95], { margin: 0.2 })) {
          // A vine curls beside some of the pumpkins.
          if (placer.rng() < 0.45) add('fill_vine', p.x + between(-1.1, 1.1), p.z + between(0.7, 1.1), between(0.9, 1.3), { margin: 0.02 });
        }
      }
    }
    scatter('farm_hay', 5, sides([-4, 6], [0.55, 0.95]), [6, 8], { margin: 0.3 });
    scatter('fill_wheelbarrow', 1, sides([0, 6], [0.6, 0.9]), [1.1, 1.3], { rot: [0.4, 1.2], margin: 0.3 });
    scatter('fill_scarecrow', 1, [{ x: [-0.95, -0.6], z: [-4, 3] }], [0.55, 0.65], { rot: [0.2, 0.7], margin: 0.4 });
    scatter('fill_postcrow', 5, sides([-6, 6], [0.55, 0.95]), [0.9, 1.2], { rot: [-0.5, 0.5], tilt: 0.06, margin: 0.2 });
    scatter('farm_corn', 14, sides([-5, 5], [0.6, 0.97]), [0.95, 1.15], { margin: 0.05 });
    scatter('fill_tuft', 40, sides([-7, 7], [0.5, 0.97]), [1.1, 2.0], { margin: 0.02, tries: 30 });
    // The open lower screen: more pumpkins, vines, hay, corn and a glowing jack-o'-lantern or two.
    for (const p of onScreen('farm_pumpkin', 10, OPEN_SCREEN, [0.55, 1.0], { margin: 0.2 })) if (placer.rng() < 0.6) add('fill_vine', p.x + between(-1, 1), p.z + between(0.6, 1.0), between(0.9, 1.3), { margin: 0.02 });
    for (const p of onScreen('pumpkin_orange_jackolantern', 2, OPEN_SCREEN, [0.75, 1.0], { rot: [-0.5, 0.5], margin: 0.15 })) glow('jackOLantern', p, 0.65 * p.scale);
    onScreen('farm_hay', 2, OPEN_SCREEN, [6, 8], { margin: 0.3 });
    onScreen('farm_corn', 9, OPEN_SCREEN, [0.95, 1.15], { margin: 0.05 });
    onScreen('fill_postcrow', 1, OPEN_SCREEN, [0.9, 1.2], { rot: [-0.5, 0.5], margin: 0.2 });
    onScreen('fill_tuft', 22, OPEN_SCREEN, [1.1, 2.0], { margin: 0.02, tries: 30 });
  }

  // ----- The Witch's Forest: mushrooms (some glowing), roots, ferns, mossy rocks, potions, logs, a small bubbling pot and low fireflies -----
  function forest(): void {
    const floor: Box[] = [...sides([-1, 9], [0.2, 0.95]), ...sides([-12, -1], [0.1, 0.95])];
    const pot = scatter('forest_cauldron', 1, floor, [2.0, 2.4], { margin: 0.3 })[0];
    if (pot) glow('cauldron', pot, MODELS.forest_cauldron.h * pot.scale);
    // Mushrooms: clusters of the glowing model, and toadstools that do not glow.
    for (const m of scatter('forest_mushroom', 7, floor, [1.3, 2.1], { margin: 0.15 })) {
      glow('mushroom', m, MODELS.forest_mushroom.h * m.scale * 0.85);
      for (const [dx, dz, k] of [[1.0, 0.4, 0.7], [-0.7, 0.9, 0.55]] as const) add('forest_mushroom', m.x + dx, m.z + dz, m.scale * k, { margin: 0.02 });
    }
    scatter('fill_toadstool', 12, floor, [1.4, 2.2], { margin: 0.05 });
    // Mossy rocks.
    scatter('forest_rocks', 4, floor, [0.4, 0.7], { margin: 0.3 });
    scatter('forest_rock_large', 3, floor, [0.3, 0.45], { margin: 0.3, lift: 0.316 });
    scatter(['forest_potion_a', 'forest_potion_b'], 5, floor, [0.7, 1.0], { margin: 0.1, tilt: 0.12 });
    scatter('fill_log', 4, floor, [1.0, 1.5], { margin: 0.2 });
    scatter('fill_root', 9, floor, [1.0, 1.6], { margin: 0.05 });
    scatter('fill_fern', 24, floor, [1.1, 1.9], { margin: 0.02, tries: 30 });
    // The open lower screen.
    for (const m of onScreen('forest_mushroom', 4, OPEN_SCREEN, [1.3, 2.0], { margin: 0.15 })) {
      glow('mushroom', m, MODELS.forest_mushroom.h * m.scale * 0.85);
      add('forest_mushroom', m.x + 1.0, m.z + 0.4, m.scale * 0.65, { margin: 0.02 });
    }
    onScreen('fill_toadstool', 5, OPEN_SCREEN, [1.4, 2.2], { margin: 0.05 });
    onScreen('fill_fern', 9, OPEN_SCREEN, [1.1, 1.9], { margin: 0.02, tries: 30 });
    onScreen('fill_root', 4, OPEN_SCREEN, [1.0, 1.6], { margin: 0.05 });
    onScreen('forest_rocks', 2, OPEN_SCREEN, [0.4, 0.7], { margin: 0.3 });
    onScreen('fill_log', 1, OPEN_SCREEN, [1.0, 1.4], { margin: 0.2 });
    onScreen(['forest_potion_a', 'forest_potion_b'], 2, OPEN_SCREEN, [0.7, 1.0], { margin: 0.1, tilt: 0.12 });
    // Fireflies low to the ground.
    for (let i = 0; i < 22; i++) {
      const z = between(-8, 8.5);
      fireflies.push({ x: xAt(between(-0.9, 0.9), z), y: between(0.3, 1.7), z, seed: i + 1 });
    }
  }

  // ----- The Frozen Cemetery: a few snowy tombstones, frozen bushes, ice rocks, snowdrifts, small pines and footprints -----
  function frost(): void {
    const open: Box[] = [...sides([-8, 8.5], [0.25, 0.97]), { x: [-0.3, 0.3], z: [-12, -3] }];
    // Two loose rows of snow-covered tombstones, widely spaced so the snow breathes.
    for (const [z, step] of [[4.6, 4.4], [-3.4, 5.2]] as const) {
      for (const [f0, f1] of [[-0.97, -0.3], [0.3, 0.97]] as const) row(['fill_tomb'], z, f0, f1, step, () => [1.0, 1.35], { tilt: 0.1, rot: [-0.25, 0.25], margin: 0.25 });
    }
    // The open lower screen.
    onScreen('fill_tomb', 4, OPEN_SCREEN, [1.0, 1.35], { tilt: 0.1, rot: [-0.25, 0.25], margin: 0.25 });
    onScreen('fill_bush', 7, OPEN_SCREEN, [1.0, 1.5], { margin: 0.15 });
    onScreen('fill_drift', 9, OPEN_SCREEN, [1.0, 1.8], { margin: 0.1 });
    onScreen('frost_rock', 2, OPEN_SCREEN, [0.45, 0.8], { margin: 0.2, lift: 0.051 });
    onScreen('frost_pines', 2, OPEN_SCREEN, [1.7, 2.3], { margin: 0.2, lift: 0.004 });
    onScreen('fill_print', 14, OPEN_SCREEN, [1, 1], { margin: 0 });
    scatter('frost_rock', 6, open, [0.45, 0.9], { margin: 0.2, lift: 0.051 });
    scatter('frost_pines', 4, open, [1.7, 2.3], { margin: 0.2, lift: 0.004 });
    scatter('fill_bush', 8, open, [1.0, 1.5], { margin: 0.15 });
    scatter('fill_drift', 10, open, [1.0, 1.8], { margin: 0.1 });
    // Two trails of footprints cross the snow, a left and a right foot in turn.
    for (const [f0, z0, f1, z1] of [[-0.8, 6, -0.35, -3.5], [0.85, 3.5, 0.4, -6]] as const) {
      const x0 = xAt(f0, z0);
      const x1 = xAt(f1, z1);
      const len = Math.hypot(x1 - x0, z1 - z0);
      const dx = (x1 - x0) / len;
      const dz = (z1 - z0) / len;
      const turn = Math.atan2(dx, dz);
      for (let s = 0, k = 0; s < len; s += 0.95, k++) {
        const off = (k % 2 ? 1 : -1) * 0.2;
        add('fill_print', x0 + dx * s - dz * off, z0 + dz * s + dx * off, 1, { rot: [turn, turn], margin: 0 });
      }
    }
  }

  const placements = placer.placements.slice(first).map((p, i) => ({ ...p, id: `fill-${ctx.theme}-${i}` }));
  const models = modelsOf(placements);
  let tris = 0;
  let calls = fireflies.length ? 1 : 0;
  for (const id of new Set(placements.map((p) => p.model))) {
    const info = modelInfo(id);
    const n = placements.filter((p) => p.model === id).length;
    tris += info.tris * n * (info.shadow ? 2 : 1);
    calls += isShape(id) ? 1 : (info.parts?.length ?? 2) * (info.shadow ? 2 : 1);
  }
  return { theme: ctx.theme, placements, glows, fireflies, models, tris, calls };
}
