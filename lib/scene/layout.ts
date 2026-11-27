// Model catalogue and seeded graveyard layout. Pure: no three, no browser APIs.
// Coordinates: x to the right, y up, z toward the camera. Units match the Kaykit models.
import { assetUrl } from '../assetUrl';
import { BUDGET, CAPS } from './config';
import { cameraAt, project, projectDirection } from './camera';
import { clamp, mulberry32 } from './rng';
import { layoutMoonDirection, moonScreenRadius, moonTarget } from './sky';

export const LAYOUT_SEED = 1031;

/** The ground, as a rectangle. The camera looks toward negative z. */
export const GROUND = { minX: -30, maxX: 30, minZ: -40, maxZ: 12, tile: 4 } as const;

export type ModelId = keyof typeof MODELS;
export type Group =
  | 'ground' | 'path' | 'crypt' | 'gate' | 'fence' | 'tree' | 'oldGrave' | 'newGrave'
  | 'coffin' | 'candle' | 'lantern' | 'pumpkin' | 'small' | 'critter' | 'themed' | 'centre';

export interface ModelInfo {
  /** Half size of the footprint on the ground (from the model's bounding box). */
  hx: number;
  hz: number;
  /** Height of the model. */
  h: number;
  /** Triangles in the model file (the budget test checks this against the file). */
  tris: number;
  /** Only static props cast shadows. */
  shadow: boolean;
  /** Which folder in public/models the file is in. Kaykit models are .gltf, Quaternius models are .glb. */
  source: 'kaykit' | 'quaternius' | 'custom' | 'procedural';
  /** Only these mesh names of the file are drawn (for models with extra small parts). */
  parts?: readonly string[];
  /**
   * The file's own origin is not at the model's footprint centre or base (for example `forest_rocks`, which is 194 units off).
   * `collectParts` moves the chosen parts so the footprint centre is at x = 0, z = 0 and the lowest point is at y = 0.
   */
  recentre?: true;
}
const m = (hx: number, hz: number, h: number, tris: number, shadow = true): ModelInfo => ({ hx, hz, h, tris, shadow, source: 'kaykit' });
const p_ = (hx: number, hz: number, h: number, tris: number): ModelInfo => ({ hx, hz, h, tris, shadow: false, source: 'procedural' });
const q = (hx: number, hz: number, h: number, tris: number, shadow = false): ModelInfo => ({ hx, hz, h, tris, shadow, source: 'quaternius' });

/** Every Kaykit model the scene uses. The key is the file name without `.gltf`. */
export const MODELS = {
  crypt: m(3, 4, 8, 952),
  arch_gate: m(2.11, 0.38, 4.41, 868),
  floor_dirt: m(2, 2, 0.03, 120, false),
  path_A: m(0.97, 0.95, 0.1, 361, false),
  path_B: m(0.95, 0.93, 0.1, 370, false),
  path_C: m(0.94, 0.93, 0.1, 393, false),
  fence: m(2, 0.25, 2.2, 380, false),
  fence_broken: m(2, 0.25, 2.2, 446, false),
  fence_pillar: m(0.25, 0.25, 2.2, 94),
  tree_dead_large: m(1.32, 0.85, 4.8, 256),
  tree_dead_large_decorated: m(1.32, 0.85, 5.14, 1496, false),
  tree_dead_medium: m(1.32, 0.3, 3.9, 216),
  tree_pine_orange_large: m(2.4, 2.08, 6.92, 318),
  tree_pine_orange_medium: m(1.77, 1.77, 5.39, 318),
  tree_pine_yellow_medium: m(1.77, 1.77, 5.39, 318),
  grave_A: m(1, 0.5, 2.13, 323, false),
  grave_A_destroyed: m(1.08, 0.64, 2.11, 416, false),
  grave_B: m(1, 0.5, 2.2, 190, false),
  gravestone: m(0.7, 0.2, 1.6, 271, false),
  gravemarker_A: m(0.43, 0.17, 1.2, 56, false),
  gravemarker_B: m(0.41, 0.38, 1.18, 136, false),
  coffin_decorated: m(1, 1.5, 0.9, 2064, false),
  candle_triple: m(0.3, 0.21, 0.79, 198, false),
  candle_thin: m(0.09, 0.09, 0.79, 66, false),
  candle_melted: m(0.15, 0.15, 0.63, 66, false),
  lantern_standing: m(0.32, 0.32, 0.93, 264),
  post_lantern: m(0.32, 1.35, 3.3, 568, false),
  pumpkin_orange: m(0.5, 0.5, 0.7, 306),
  pumpkin_orange_jackolantern: m(0.75, 0.7, 1.3, 374),
  pumpkin_yellow_jackolantern: m(0.75, 0.7, 1.3, 374),
  pumpkin_yellow_small: m(0.3, 0.3, 0.55, 322),
  skull: m(0.46, 0.46, 0.92, 344, false),
  bone_A: m(0.35, 0.1, 0.14, 204, false),
  bone_B: m(0.31, 0.14, 0.14, 220, false),
  bone_C: m(0.55, 0.1, 0.14, 204, false),
  ribcage: m(0.42, 0.42, 0.47, 1240, false),
  shrine: m(0.55, 0.55, 2.4, 94),
  bench_decorated: m(1, 0.5, 1.68, 978, false),
  skull_candle: m(0.46, 0.52, 1.24, 542, false),
  shrine_candles: m(0.55, 0.55, 1.79, 360, false),
  // Quaternius twisted dead trees. Their files are big, so they are placed at a scale of about 0.3.
  forest_twisted_a: q(5.28, 4.6, 18.7, 8705),
  forest_twisted_b: q(6.76, 5.77, 16.5, 9176),
  forest_twisted_c: { ...q(5.2, 5.2, 14.8, 7234), parts: ['TwistedTree_3_1'] },
  forest_mushroom: q(0.33, 0.45, 0.45, 880),
  forest_mushroom_king: { ...q(1.6, 1.0, 3.44, 4561), parts: ['MushroomKing_1', 'MushroomKing_3'] },
  forest_cauldron: { ...q(0.18, 0.15, 0.25, 988, true), parts: ['Cauldron_1', 'Cauldron_2'] },
  post_skull: m(0.41, 1.35, 3.3, 776, false),
  // The Crypt's own pieces: an empty stone arch, the KayKit hanging lantern (hung from a branch; `recentre` puts its foot at y = 0,
  // so a placement's y is the bottom of the lantern) and the wooden grave markers.
  arch: m(2.11, 0.38, 4.41, 436, false),
  lantern_hanging: { ...m(0.32, 0.32, 1.41, 472, false), recentre: true },
  // Quaternius props for the themes other than the Crypt. Sizes are read from the files (tests/modelSizes.test.ts checks them).
  // `h` is the highest point above y = 0, or the full height for `recentre` models.
  farm_barn: q(3.86, 4.11, 7.88, 3770),
  farm_silo: q(1.83, 1.75, 9.02, 1346),
  farm_corn: q(0.41, 0.55, 1.99, 734),
  farm_pumpkin: q(0.75, 0.76, 0.93, 644),
  // The hay bale is tiny in its file (0.12 wide), so it is placed at a scale of 6 to 8. The windmill's box includes its sails (hx);
  // its body sits 0.028 below y = 0 in the file, so a placement lifts it by `WINDMILL_FOOT` times its scale.
  farm_hay: q(0.0605, 0.0624, 0.179, 488),
  farm_windmill: q(0.668, 0.471, 1.583, 1712),
  farm_fence: q(2.95, 0.083, 1.09, 180),
  forest_potion_a: q(0.36, 0.36, 1.23, 1510),
  forest_potion_b: q(0.33, 0.33, 0.95, 1292),
  forest_rock_large: q(3.84, 3.67, 2.97, 222),
  forest_rocks: { ...q(3.64, 0.66, 2.15, 2134), recentre: true },
  frost_pine_a: q(2.9, 2.69, 10.0, 3164),
  frost_pine_b: q(2.86, 2.61, 7.14, 3503),
  frost_pines: q(0.89, 0.86, 0.78, 3638),
  frost_rock: q(1.52, 1.24, 1.85, 244),
  blood_column: q(0.65, 0.65, 4.08, 532, true),
  blood_column_round: q(0.7, 0.74, 1.77, 332, true),
  blood_pedestal: q(0.87, 0.87, 2.33, 1182, true),
  blood_ruins: { ...q(15.0, 12.2, 3.68, 3434), parts: ['Wall_Overgrown', 'Doors_RoundArch_Covered_2'], recentre: true },
  castle_fortress: q(1.06, 0.98, 1.3, 9416),
  castle_wall_towers: q(0.97, 0.16, 0.65, 1415),
  castle_torch: { ...q(0.34, 0.33, 2.49, 610), recentre: true },
  castle_banner: q(1.18, 0.11, 3.8, 560),
  castle_stone_wall: q(0.78, 0.12, 0.44, 184),
  // The wall flag hangs below its own origin (y from -2.31 to 0.05), so it is `recentre`d: the lowest point of the cloth to y = 0, the footprint centre to x = 0, z = 0.
  castle_wall_flag: { ...q(0.563, 0.161, 2.354, 349), recentre: true },
  // The small open coffin (public/models/coffin.glb), used for the coffins that follow the data.
  coffin_open: { hx: 0.287, hz: 0.419, h: 0.325, tris: 256, shadow: false, source: 'custom' },
  // Things drawn by the scene's own code. They are in the catalogue so nothing is placed on top of them.
  dirt_mound: p_(0.85, 0.85, 0.4, 96),
  open_coffin_spot: p_(0.8, 1.2, 1.0, 256),
  // Small things the theme fill (`uniqueScenes/fill.ts`) draws itself with `layers/scene/fillShapes.ts`: dead grass, ferns, crosses, toadstools,
  // a wheelbarrow, logs, roots, snowdrifts, footprints, ground fog, vines, a crow on a post, frozen bushes, snowy tombstones, a frozen lantern and a small scarecrow.
  // `tris` is an upper bound (tests/fill.test.ts checks it against the real geometry).
  fill_tuft: p_(0.3, 0.3, 0.45, 100),
  fill_fern: p_(0.55, 0.55, 0.6, 100),
  fill_cross: p_(0.3, 0.1, 1.0, 48),
  fill_toadstool: p_(0.22, 0.22, 0.34, 200),
  fill_wheelbarrow: p_(0.5, 0.85, 0.7, 200),
  fill_log: p_(0.35, 1.2, 0.5, 160),
  fill_root: p_(0.5, 0.8, 0.5, 120),
  fill_drift: p_(1.0, 0.7, 0.45, 160),
  fill_print: p_(0.22, 0.4, 0.04, 48),
  fill_fog: p_(2.2, 1.6, 0.1, 2),
  fill_vine: p_(1.1, 0.5, 0.3, 300),
  fill_postcrow: p_(0.2, 0.2, 1.75, 300),
  fill_bush: p_(0.6, 0.6, 0.7, 400),
  fill_tomb: p_(0.42, 0.18, 1.1, 160),
  fill_lamp: p_(0.3, 0.3, 1.9, 260),
  fill_scarecrow: p_(0.9, 0.9, 3.3, 400),
} as const;

/** The catalogue entry of a model, with the same type for every model. */
export const modelInfo = (id: ModelId): ModelInfo => MODELS[id];

/** Where a model's file is, as a path from the extension's root. */
export function modelFile(id: ModelId): string {
  const src = MODELS[id].source;
  if (src === 'custom') return assetUrl('models/coffin.glb');
  return src === 'quaternius' ? assetUrl(`models/quaternius/${id}.glb`) : assetUrl(`models/kaykit/${id}.gltf`);
}

export interface Placement {
  id: string;
  model: ModelId;
  group: Group;
  x: number;
  y: number;
  z: number;
  rotY: number;
  scale: number;
  /** A slight lean, as rotations about x and z in radians. Only the drawing uses it. */
  tilt?: [number, number];
  /** Position among the data-driven things of its group (0 is shown first). */
  slot?: number;
}

/** A warm light source: used for the (at most 6) real lights and for glow pools. */
export interface WarmSource {
  kind: 'cryptDoor' | 'lantern' | 'jackOLantern' | 'candle' | 'postLantern' | 'mushroom' | 'cauldron' | 'torch';
  x: number;
  y: number;
  z: number;
  /** For candles: which candle slot this flame belongs to. */
  slot?: number;
  /** Makes the flame and the pool of light smaller or bigger than usual (1 is usual). */
  size?: number;
}

export interface Scenery {
  cat: { x: number; y: number; z: number; rotY: number };
  crows: { x: number; y: number; z: number; rotY: number; seed: number }[];
  owl: { x: number; y: number; z: number; rotY: number; branch: [number, number, number, number, number, number] };
  /** Each spider hangs on a thread from (x, topY, z), `drop` long at most. */
  spiders: { x: number; topY: number; z: number; drop: number; seed: number }[];
  mounds: { x: number; z: number; rotY: number; scale: number; seed: number }[];
  cauldron: { x: number; y: number; z: number };
  openCoffin: { x: number; z: number; rotY: number };
  wisps: { x: number; y: number; z: number; seed: number }[];
  cobwebs: { x: number; y: number; z: number; w: number; h: number; rotY: number }[];
}

export interface Layout {
  placements: Placement[];
  /** The real point lights, at most BUDGET.maxPointLights. */
  lights: WarmSource[];
  /** Every glowing thing, for glow pools and flame glows. */
  glows: WarmSource[];
  /** Centres of the path tiles. */
  pathCentres: { x: number; z: number }[];
  /** Where the animated critters and details sit (cat, crows, owl, spiders, mounds, cauldron, coffin, wisps, cobwebs). */
  scenery: Scenery;
  /** Where the floating ghosts hover. */
  ghostSpots: { x: number; y: number; z: number }[];
  /** World position of the crypt doorway, and the crypt's scale (missing is 1). */
  cryptDoor: { x: number; y: number; z: number; rotY: number; scale?: number };
}

// ---------- footprints ----------
export interface Footprint {
  x: number;
  z: number;
  hx: number;
  hz: number;
  rotY: number;
}

export function footprintOf(p: Placement): Footprint {
  const info = MODELS[p.model];
  return { x: p.x, z: p.z, hx: info.hx * p.scale, hz: info.hz * p.scale, rotY: p.rotY };
}

function axes(f: Footprint): [[number, number], [number, number]] {
  const c = Math.cos(f.rotY);
  const s = Math.sin(f.rotY);
  return [[c, -s], [s, c]];
}

export function corners(f: Footprint): [number, number][] {
  const [ax, az] = axes(f);
  const out: [number, number][] = [];
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
    out.push([f.x + ax[0] * f.hx * sx + az[0] * f.hz * sz, f.z + ax[1] * f.hx * sx + az[1] * f.hz * sz]);
  }
  return out;
}

/** True when two footprints overlap, with a gap of `margin` kept between them. */
export function footprintsOverlap(a: Footprint, b: Footprint, margin = 0): boolean {
  const ga = { ...a, hx: a.hx + margin / 2, hz: a.hz + margin / 2 };
  const gb = { ...b, hx: b.hx + margin / 2, hz: b.hz + margin / 2 };
  const ca = corners(ga);
  const cb = corners(gb);
  for (const f of [ga, gb]) {
    for (const ax of axes(f)) {
      let minA = Infinity, maxA = -Infinity, minB = Infinity, maxB = -Infinity;
      for (const [x, z] of ca) { const d = x * ax[0] + z * ax[1]; minA = Math.min(minA, d); maxA = Math.max(maxA, d); }
      for (const [x, z] of cb) { const d = x * ax[0] + z * ax[1]; minB = Math.min(minB, d); maxB = Math.max(maxB, d); }
      if (maxA <= minB + 1e-9 || maxB <= minA + 1e-9) return false;
    }
  }
  return true;
}

export function insideGround(f: Footprint): boolean {
  return corners(f).every(([x, z]) => x >= GROUND.minX && x <= GROUND.maxX && z >= GROUND.minZ && z <= GROUND.maxZ);
}

/** Groups that are laid flat on the ground and are not checked for overlap. */
export const FLAT_GROUPS: readonly Group[] = ['ground', 'path'];
/** Props that may stand across the path. */
export const PATH_EXEMPT: readonly Group[] = ['ground', 'path', 'gate'];

/** Two rows of tiles side by side. The path is about 3.1 wide (it was 4.1: 25 percent narrower). */
export const PATH_TILE_SCALE = 0.9;
export const PATH_TILE_OFFSET = 0.7;
export const PATH_HALF_WIDTH = 1.6;
export const PATH_CLEARANCE = 0.6;
/** The gap small props (candles, skulls, bones, small pumpkins) keep from the path: they line its edge. */
export const EDGE_CLEARANCE = 0.05;

/** The crypt's doorway in the model's own space (the door faces +z), before the placement's scale. */
export const CRYPT_DOOR_LOCAL = { x: 0, y: 1.3, z: 4.05 } as const;

/** The cobblestone path: from the bottom centre of the screen, nearly straight, to the gate. */
const PATH_POINTS: [number, number][] = [[0.3, 9.4], [-0.25, 5.5], [0.45, 1.5], [0.4, -3.1]];
/** The fence and the gate share one line across the yard, close behind the graves. */
export const FENCE_Z = -3.6;
const GATE_X = 0.4;
const GATE_SCALE = 0.82;
/**
 * The mausoleum: behind the fence, right of the gate, turned a little toward the path, as big on screen as in the first prototype
 * (its roof reaches just under the search box, at about 0.34 of the window height). It is the one prop that may stand behind the
 * chips row: the chips are small pills, and the crypt is the landmark of the scene.
 */
const CRYPT_SCALE = 0.56;
const CRYPT = { x: 6.35, z: -8, rotY: -0.45 };

// ---------- moon clear zone ----------
const MOON_ASPECTS = [16 / 10, 16 / 9, 21 / 9];

/**
 * True when the top of a tall prop would appear over the moon's halo on screen. The Crypt layout is built with the moon
 * aim it was made for (`layoutMoonDirection`); pass `moonDirection` to check against the moon as it is drawn now.
 */
export function blocksMoon(p: Placement, direction: (aspect: number) => readonly [number, number, number] = layoutMoonDirection): boolean {
  const info = MODELS[p.model];
  if (info.h < 2.5) return false;
  const pad = Math.max(info.hx, info.hz) * p.scale;
  for (const aspect of MOON_ASPECTS) {
    const cam = cameraAt(0, aspect, true);
    const moon = projectDirection(direction(aspect) as never, cam);
    if (!moon) continue;
    const r = moonScreenRadius(aspect).halo * 1.25;
    for (const dy of [1, 0.6]) {
      const pt = project([p.x, info.h * p.scale * dy, p.z], cam);
      if (!pt) continue;
      // Screen distance in window-height units; pad is about as wide as the prop on screen.
      const padScreen = pad / (pt.depth * Math.tan((cam.fov * Math.PI) / 360) * 2);
      if (Math.hypot((pt.x - moon.x) * aspect, pt.y - moon.y) < r + padScreen) return true;
    }
  }
  return false;
}

/** True when a near-foreground prop would be cut by the left, right or bottom edge of the screen at any usual window shape. */
export function cutByScreenEdge(p: Placement): boolean {
  const info = MODELS[p.model];
  const pad = Math.max(info.hx, info.hz) * p.scale;
  for (const aspect of MOON_ASPECTS) {
    const cam = cameraAt(0, aspect, true);
    const mid = project([p.x, 0, p.z], cam);
    // Only the near foreground matters: farther props are small and well inside the frame.
    if (mid && mid.depth > 13) continue;
    for (const pt of [[p.x - pad, 0, p.z], [p.x + pad, 0, p.z], [p.x - pad, info.h * p.scale, p.z], [p.x + pad, info.h * p.scale, p.z]] as const) {
      const q = project(pt, cam);
      if (!q) return true;
      if (q.depth < 13 && (q.x < 0.05 || q.x > 0.95 || q.y > 0.95)) return true;
    }
  }
  return false;
}
/**
 * True when a tall prop would stand over the Crypt's moon where it is drawn now (`moonTarget`): the disc and a margin of half
 * its radius, as the other themes check theirs.
 */
export function overCryptMoon(p: Placement): boolean {
  if (MODELS[p.model].h * p.scale < 1.5) return false;
  for (const aspect of MOON_ASPECTS) {
    const b = screenBox(p, aspect);
    if (!b) continue;
    const t = moonTarget(aspect);
    const r = moonScreenRadius(aspect).disc * 1.5;
    // Distance from the disc centre to the prop's screen box, in window-height units.
    const dx = Math.max(b.x0 - t.x, 0, t.x - b.x1) * aspect;
    const dy = Math.max(b.y0 - t.y, 0, t.y - b.y1);
    if (Math.hypot(dx, dy) < r) return true;
  }
  return false;
}

// ---------- the page's controls ----------
export interface ScreenBox { x0: number; x1: number; y0: number; y1: number }
/**
 * The boxes of the page's controls (brand, stats panel, header buttons, search box, pinned pages, chips) as fractions of the
 * window, measured on the demo page at 1440x900 and 1920x1080 (tests/fixtures/page-layout.json). The pinned row is taken as wide
 * as the search box. No Crypt prop may stand behind them; `tests/cryptScene.test.ts` checks the same against the fixture.
 */
export const CONTROL_BOXES: readonly { aspect: number; boxes: readonly ScreenBox[] }[] = [
  {
    aspect: 1440 / 900,
    boxes: [
      { x0: 0.0167, x1: 0.2121, y0: 0.0934, y1: 0.1603 },
      { x0: 0.3004, x1: 0.6996, y0: 0.068, y1: 0.1857 },
      { x0: 0.8114, x1: 0.9833, y0: 0.1046, y1: 0.1491 },
      { x0: 0.2778, x1: 0.7222, y0: 0.2057, y1: 0.3302 },
      { x0: 0.259, x1: 0.741, y0: 0.3502, y1: 0.3806 },
    ],
  },
  {
    aspect: 1920 / 1080,
    boxes: [
      { x0: 0.1354, x1: 0.282, y0: 0.0779, y1: 0.1336 },
      { x0: 0.3503, x1: 0.6497, y0: 0.0567, y1: 0.1548 },
      { x0: 0.7313, x1: 0.8646, y0: 0.064, y1: 0.1474 },
      { x0: 0.3333, x1: 0.6667, y0: 0.1715, y1: 0.2752 },
      { x0: 0.3192, x1: 0.6807, y0: 0.2918, y1: 0.3172 },
    ],
  },
];
/** Where a placement appears on screen at the rest camera: the box around its footprint from its foot to its top. */
export function screenBox(p: Placement, aspect: number): ScreenBox | null {
  const cam = cameraAt(0, aspect, true);
  const h = MODELS[p.model].h * p.scale;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [x, z] of corners(footprintOf(p))) {
    for (const y of [p.y, p.y + h]) {
      const q = project([x, y, z], cam);
      if (!q) return null;
      x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y);
    }
  }
  return { x0, x1, y0, y1 };
}
const MARGIN = 0.004;
const touches = (a: ScreenBox, b: ScreenBox) => a.x0 < b.x1 + MARGIN && a.x1 > b.x0 - MARGIN && a.y0 < b.y1 + MARGIN && a.y1 > b.y0 - MARGIN;
/** The index of the chips row in each entry of `CONTROL_BOXES`. */
const CHIPS_ROW = 4;
/** Every control but the chips row (the crypt may stand behind the chips). */
const CHIPS_FREE = (i: number) => i !== CHIPS_ROW;
/** True when a placement would show behind one of the page's controls (only the ones `which` keeps, when given). */
export function behindControls(p: Placement, which: (index: number) => boolean = () => true): boolean {
  return CONTROL_BOXES.some(({ aspect, boxes }) => {
    const s = screenBox(p, aspect);
    return !s || boxes.some((b, i) => which(i) && touches(s, b));
  });
}

// ---------- building the layout ----------
const slug = (s: string) => s.replace(/[^a-z0-9]+/gi, '-');

export function buildLayout(seed: number = LAYOUT_SEED): Layout {
  const rng = mulberry32(seed);
  // The first part of the layout uses `rng`; the details added later use their own numbers (`next`), so the
  // layout built before them stays exactly where it was.
  let next = rng;
  const between = (lo: number, hi: number) => lo + (hi - lo) * next();
  const pick = <T,>(list: readonly T[]) => list[Math.floor(next() * list.length) % list.length]!;

  const placements: Placement[] = [];
  const solid: Placement[] = [];
  const glows: WarmSource[] = [];
  const lights: WarmSource[] = [];
  let counter = 0;

  const make = (model: ModelId, group: Group, x: number, z: number, rotY: number, scale = 1, y = 0, slot?: number): Placement => ({
    id: `${slug(group)}-${counter++}`, model, group, x, y, z, rotY, scale, slot,
  });

  // ----- the winding path: two rows of cobblestone tiles side by side -----
  const segs: { ax: number; az: number; bx: number; bz: number; len: number }[] = [];
  for (let i = 1; i < PATH_POINTS.length; i++) {
    const [ax = 0, az = 0] = PATH_POINTS[i - 1] ?? [];
    const [bx = 0, bz = 0] = PATH_POINTS[i] ?? [];
    segs.push({ ax, az, bx, bz, len: Math.hypot(bx - ax, bz - az) });
  }
  const total = segs.reduce((n, s) => n + s.len, 0);
  const onSeg = (seg: (typeof segs)[number], k: number) => {
    const dx = (seg.bx - seg.ax) / seg.len;
    const dz = (seg.bz - seg.az) / seg.len;
    return { x: seg.ax + dx * seg.len * k, z: seg.az + dz * seg.len * k, dx, dz };
  };
  const atArc = (s: number) => {
    let left = clamp(s, 0, total);
    for (const seg of segs) {
      if (left <= seg.len) return onSeg(seg, left / seg.len);
      left -= seg.len;
    }
    return onSeg(segs[segs.length - 1]!, 1);
  };
  /** The path's x at a given z (the path runs from large z to small z). */
  const pathXAt = (z: number) => {
    for (const seg of segs) {
      const hi = Math.max(seg.az, seg.bz);
      const lo = Math.min(seg.az, seg.bz);
      if (z <= hi && z >= lo) return seg.ax + ((z - seg.az) / (seg.bz - seg.az)) * (seg.bx - seg.ax);
    }
    return PATH_POINTS[PATH_POINTS.length - 1]![0];
  };
  const pathCentres: { x: number; z: number }[] = [];
  const pathModels: ModelId[] = ['path_A', 'path_B', 'path_C'];
  for (let s = 0; s <= total; s += 1.6) {
    const c = atArc(s);
    pathCentres.push({ x: c.x, z: c.z });
    for (const side of [-1, 1]) {
      const model = pick(pathModels);
      const turn = Math.floor(rng() * 4) * (Math.PI / 2);
      placements.push(make(model, 'path', c.x - c.dz * side * PATH_TILE_OFFSET, c.z + c.dx * side * PATH_TILE_OFFSET, turn, PATH_TILE_SCALE, 0.02));
    }
  }
  const nearPath = (x: number, z: number, extra: number, clearance = PATH_CLEARANCE) =>
    pathCentres.some((c) => Math.hypot(c.x - x, c.z - z) < PATH_HALF_WIDTH + clearance + extra);
  /** Candles, skulls, bones and small pumpkins may stand right at the edge of the cobblestones. */
  const clearanceOf = (g: Group) => (g === 'small' || g === 'candle' ? EDGE_CLEARANCE : PATH_CLEARANCE);

  // The ground itself is one plane drawn by the scene (no tiles), so nothing is placed for it here.
  const doorX = CRYPT.x + Math.sin(CRYPT.rotY) * CRYPT_DOOR_LOCAL.z * CRYPT_SCALE;
  const doorZ = CRYPT.z + Math.cos(CRYPT.rotY) * CRYPT_DOOR_LOCAL.z * CRYPT_SCALE;
  const cryptDoor = { x: doorX, y: CRYPT_DOOR_LOCAL.y * CRYPT_SCALE, z: doorZ, rotY: CRYPT.rotY, scale: CRYPT_SCALE };

  const fits = (p: Placement, margin = 0.15): boolean => {
    const f = footprintOf(p);
    if (!insideGround(f)) return false;
    if (!PATH_EXEMPT.includes(p.group) && nearPath(p.x, p.z, Math.max(f.hx, f.hz), clearanceOf(p.group))) return false;
    if (overCryptMoon(p) || behindControls(p)) return false;
    return solid.every((q) => !footprintsOverlap(f, footprintOf(q), margin));
  };
  const add = (p: Placement): Placement => {
    placements.push(p);
    solid.push(p);
    return p;
  };
  /** Fixed items: they must fit, so a bad number fails the tests at once. */
  const fixed = (p: Placement, margin = 0, mayCoverChips = false): Placement => {
    const f = footprintOf(p);
    if (!insideGround(f) || solid.some((q) => footprintsOverlap(f, footprintOf(q), margin))) {
      throw new Error(`Fixed prop ${p.model} at ${p.x},${p.z} does not fit`);
    }
    if (overCryptMoon(p) || (mayCoverChips ? behindControls(p, CHIPS_FREE) : behindControls(p))) {
      throw new Error(`Fixed prop ${p.model} at ${p.x},${p.z} stands over the moon or behind the page's controls`);
    }
    return add(p);
  };
  /** Random items: they try a few spots and are dropped if none fits. */
  const tryAdd = (model: ModelId, group: Group, region: () => { x: number; z: number; rotY?: number; scale?: number }, tries = 80): Placement | null => {
    for (let i = 0; i < tries; i++) {
      const r = region();
      const p = make(model, group, r.x, r.z, r.rotY ?? between(0, Math.PI * 2), r.scale ?? 1);
      if (fits(p)) return add(p);
      counter--;
    }
    return null;
  };
  /** An item that must exist (a data slot): it tries nearby spots until one is free. */
  const fixedNear = (model: ModelId, group: Group, x: number, z: number, rotY: number, slot: number | undefined, scale = 1, reach = 1): Placement => {
    for (let r = 0; r < 12; r++) {
      for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]] as const) {
        const p = make(model, group, x + dx * r * 0.35 * reach, z + dz * r * 0.35 * reach, rotY, scale, 0, slot);
        const f = footprintOf(p);
        if (insideGround(f) && !nearPath(p.x, p.z, Math.max(f.hx, f.hz), clearanceOf(group)) && !behindControls(p) && solid.every((q) => !footprintsOverlap(f, footprintOf(q), 0.1))) return add(p);
        counter--;
      }
    }
    throw new Error(`No room for ${model} slot ${slot}`);
  };

  // ----- the fence line across the yard, with the arched gate at the end of the path -----
  const gateX = GATE_X;
  fixed(make('arch_gate', 'gate', gateX, FENCE_Z, 0, GATE_SCALE));
  const GATE_EDGE = MODELS.arch_gate.hx * GATE_SCALE + 0.3;
  const step = 4.6;
  const fenceRun = (sign: 1 | -1) => {
    for (let k = 0; k < 5; k++) {
      const c = gateX + sign * (GATE_EDGE + 2 + k * step);
      fixed(make(rng() < 0.15 ? 'fence_broken' : 'fence', 'fence', c, FENCE_Z, 0));
      fixed(make('fence_pillar', 'fence', c + sign * (step / 2), FENCE_Z, 0));
    }
  };
  fenceRun(1);
  fenceRun(-1);

  // ----- the mausoleum behind the fence, right of the gate, and an empty stone arch further right -----
  fixed(make('crypt', 'crypt', CRYPT.x, CRYPT.z, CRYPT.rotY, CRYPT_SCALE), 0, true);
  lights.push({ kind: 'cryptDoor', x: doorX, y: cryptDoor.y + 0.3 * CRYPT_SCALE, z: doorZ });
  glows.push({ kind: 'cryptDoor', x: doorX, y: cryptDoor.y, z: doorZ });
  fixed(make('arch', 'fence', 11.4, -7.4, -0.3, 0.72));

  // ----- trees: autumn pines and bare dead trees on both sides, short ones behind the gate -----
  // In the middle of the screen they stay short, so their tops end under the chips row (`behindControls`).
  fixed(make('tree_pine_orange_large', 'tree', -10.2, -7.6, 0.4, 0.95));
  fixed(make('tree_pine_orange_medium', 'tree', -3.6, -8.8, 1.1, 0.6));
  fixed(make('tree_pine_yellow_medium', 'tree', 2.6, -11.4, 2.0, 0.52));
  // Two bare trees in front of the fence carry old lanterns on their branches. The KayKit models have one long branch each:
  // its tip (in the model's own space) is where the lantern hangs.
  const hangFrom = (tree: Placement, tip: readonly [number, number, number], lanternScale: number, real: boolean) => {
    const c = Math.cos(tree.rotY);
    const s = Math.sin(tree.rotY);
    const x = tree.x + (tip[0] * c + tip[2] * s) * tree.scale;
    const z = tree.z + (-tip[0] * s + tip[2] * c) * tree.scale;
    const hook = tip[1] * tree.scale;
    // Hung from the branch: not part of the ground, so it is not in `solid`.
    placements.push(make('lantern_hanging', 'lantern', x, z, 0, lanternScale, hook - MODELS.lantern_hanging.h * lanternScale));
    const src = { kind: 'lantern' as const, x, y: hook - 0.78 * lanternScale, z };
    glows.push(src);
    if (real) lights.push(src);
  };
  const leftLanternTree = fixed(make('tree_dead_large', 'tree', -7.6, -1.2, Math.PI - 0.5, 1.1));
  hangFrom(leftLanternTree, [-1.32, 3.86, -0.73], 0.75, true);
  const rightLanternTree = fixed(make('tree_dead_medium', 'tree', 8.2, -0.4, Math.PI + 0.25, 0.9));
  hangFrom(rightLanternTree, [1.32, 2.86, 0], 0.72, false);
  // ----- big jack-o'-lanterns with glowing faces along the path -----
  const jack = (model: ModelId, x: number, z: number, rot: number, scale: number, real: boolean) => {
    const j = fixed(make(model, 'pumpkin', x, z, rot, scale));
    const src = { kind: 'jackOLantern' as const, x: j.x, y: 0.65 * scale, z: j.z };
    glows.push(src);
    if (real) lights.push(src);
  };
  jack('pumpkin_orange_jackolantern', -3.4, 6.6, 0.45, 1.3, true);
  jack('pumpkin_orange_jackolantern', -3.3, 4.0, 0.3, 1.1, true);
  jack('pumpkin_yellow_jackolantern', 3.0, 3.9, -0.35, 1.0, false);
  jack('pumpkin_orange_jackolantern', 3.3, 6.3, -0.35, 1.25, true);
  jack('pumpkin_yellow_jackolantern', 6.9, 3.6, -0.6, 1.05, true);
  jack('pumpkin_orange_jackolantern', -10.6, 2.4, 0.6, 0.9, false);
  // Two small lanterns either side of the gate (glow only).
  for (const side of [-1, 1]) {
    const l = fixed(make('lantern_standing', 'lantern', gateX + side * (GATE_EDGE + 0.45), FENCE_Z + 1.3, 0, 1.2));
    glows.push({ kind: 'lantern', x: l.x, y: 0.5 * 1.2, z: l.z });
  }
  // Lanterns on posts at the edges, their arms reaching over the grass (glow only).
  for (const [x, z, rot] of [[-11.2, -2.2, Math.PI / 2], [12.6, -1.6, -Math.PI / 2]] as const) {
    const post = fixed(make('post_lantern', 'lantern', x, z, rot));
    glows.push({ kind: 'postLantern', x: post.x + Math.sin(rot), y: 2.4, z: post.z + Math.cos(rot) });
  }

  // ----- data-driven things: new graves (24), coffins (8) and candles (12) -----
  const graveModels: ModelId[] = ['gravestone', 'grave_B'];
  let slot = 0;
  // Eight rows of three behind the fence, four on each side of the gate, as the graveyard goes on into the fog.
  const dataGroups: [number, number][] = [[-4.6, -6.6], [-10, -6.8], [-15.6, -6.4], [-8.2, -11.6], [9.2, -12.6], [15.4, -6.6], [16.4, -11.6], [1.6, -14.4]];
  for (const [gx, gz] of dataGroups) {
    for (let i = 0; i < 3; i++) {
      fixedNear(graveModels[slot % 2]!, 'newGrave', gx + (i - 1) * 2.4, gz + (i === 1 ? -0.5 : 0), between(-0.06, 0.06), slot);
      slot++;
    }
  }
  slot = 0;
  // Coffins stand behind the fence, at the back left of the yard.
  for (const [x, z] of [[-3.6, -17], [-6.8, -17.6], [-10, -17], [-13.2, -16.4], [-16.4, -16], [-19.6, -15.4], [-12.4, -20.6], [-6.2, -21.2]] as const) {
    fixedNear('coffin_open', 'coffin', x, z, between(-0.1, 0.1), slot++, 2.2);
  }
  // Candles line both sides of the path, from the front to the gate.
  const candleModels: ModelId[] = ['candle_triple', 'candle_thin', 'candle_melted'];
  slot = 0;
  for (const z of [7.6, 5.4, 3.0, 1.0, -0.8, -2.4]) {
    for (const side of [-1, 1]) {
      const model = candleModels[slot % 3]!;
      const c = fixedNear(model, 'candle', pathXAt(z) + side * 2.05, z, between(0, Math.PI * 2), slot);
      glows.push({ kind: 'candle', x: c.x, y: MODELS[model].h, z: c.z, slot });
      slot++;
    }
  }

  // ----- more trees toward the edges, placed at random where they fit -----
  const edge = (xLo: number, xHi: number, zLo: number, zHi: number, sLo = 1, sHi = 1.25) => () => ({ x: between(xLo, xHi), z: between(zLo, zHi), scale: between(sLo, sHi) });
  const treeJobs: [ModelId, () => { x: number; z: number; scale: number }][] = [
    ['tree_pine_orange_medium', edge(9.4, 10.6, -10.6, -9.4, 0.8, 0.9)],
    ['tree_pine_orange_medium', edge(-15, -12.5, -10, -7, 0.9, 1.05)],
    ['tree_dead_large', edge(-20, -17, -9, -5, 1.1, 1.25)],
    ['tree_pine_orange_large', edge(-17, -13, -16, -12, 1, 1.15)],
    ['tree_pine_yellow_medium', edge(-24, -20, -14, -8, 0.9, 1.1)],
    ['tree_dead_medium', edge(13, 16, -6, -3, 0.9, 1.05)],
    ['tree_pine_orange_medium', edge(17, 22, -14, -8, 0.8, 1)],
    ['tree_dead_large', edge(18, 24, -6, 2, 0.9, 1.1)],
    ['forest_twisted_a', edge(-24, -20, -4, 2, 0.24, 0.28)],
    ['forest_twisted_b', edge(19, 24, -18, -12, 0.24, 0.28)],
    ['tree_pine_orange_large', edge(-26, -21, -26, -18)],
    ['tree_pine_orange_large', edge(18, 26, -28, -20)],
  ];
  treeJobs.forEach(([model, region]) => tryAdd(model, 'tree', region, 160));

  // ----- tombstones of mixed shapes in the middle ground, a few tilted -----
  const heroIds: string[] = [];
  const hero = (model: ModelId, x: number, z: number, rot: number, scale: number) => {
    const g = fixed(make(model, 'oldGrave', x, z, rot, scale), 0.2);
    heroIds.push(g.id);
    return g;
  };
  hero('grave_A', -4.6, 2.0, 0.22, 1.2);
  hero('grave_B', -7.7, 1.5, 0.12, 1.15);
  hero('gravestone', -5.6, 5.2, 0.3, 1.3);
  hero('grave_B', 4.9, 1.0, -0.18, 1.15);
  hero('grave_A_destroyed', 7.6, 1.8, -0.32, 1.0);
  hero('gravestone', 6.0, 6.4, -0.38, 1.35);
  // Rows of smaller graves behind the big ones, on both sides of the path.
  const row = (cx: number, cz: number, models: ModelId[]): string[] =>
    models.map((model, i) => {
      const g = tryAdd(model, 'oldGrave', () => ({ x: cx + (i - 1) * 2.2 + between(-0.3, 0.3), z: cz + between(-0.4, 0.4), rotY: between(-0.25, 0.25), scale: between(0.85, 1.0) }), 12);
      return g ? g.id : '';
    });
  const leftRow = row(-5.8, -1.8, ['gravestone', 'grave_A', 'grave_B']).filter(Boolean);
  const rightRow = row(5.8, -1.6, ['grave_A', 'gravestone', 'grave_B']).filter(Boolean);
  row(-12.4, 0.8, ['grave_B', 'gravestone', 'grave_A']);
  row(12.4, 1.4, ['gravestone', 'grave_A_destroyed']);
  const webPair = leftRow.length >= 2 ? leftRow : rightRow;
  // Small wooden grave crosses.
  for (const [x, z, rot] of [[3.0, -1.6, -0.2], [-3.2, -2.2, 0.25], [-8.4, 3.6, 0.4], [8.8, 3.4, -0.3]] as const) {
    tryAdd(next() < 0.5 ? 'gravemarker_A' : 'gravemarker_B', 'small', () => ({ x: x + between(-0.4, 0.4), z: z + between(-0.4, 0.4), rotY: rot, scale: between(1.1, 1.3) }), 12);
  }

  // ----- the foreground along the path: small pumpkins, melted candles, skull candles, bones and skulls -----
  const litSmall = (model: ModelId, x: number, z: number, scale: number, flame: number) => {
    const c = tryAdd(model, 'small', () => ({ x: x + between(-0.35, 0.35), z: z + between(-0.35, 0.35), scale }), 16);
    if (c) glows.push({ kind: 'candle', x: c.x, y: flame * scale, z: c.z });
  };
  litSmall('skull_candle', -2.35, 2.2, 1.0, MODELS.skull_candle.h);
  litSmall('skull_candle', 2.5, 7.0, 0.95, MODELS.skull_candle.h);
  litSmall('candle_triple', 2.5, 2.0, 1.3, MODELS.candle_triple.h);
  litSmall('candle_melted', 5.0, 4.6, 1.4, MODELS.candle_melted.h);
  litSmall('candle_thin', -4.7, 4.1, 1.3, MODELS.candle_thin.h);
  litSmall('candle_melted', -2.1, -1.6, 1.2, MODELS.candle_melted.h);
  litSmall('skull_candle', 2.45, -1.0, 0.85, MODELS.skull_candle.h);
  const smallJobs: [ModelId, number, number, number][] = [
    ['pumpkin_orange', -2.3, 0.2, 0.8], ['pumpkin_yellow_small', 2.4, 3.6, 1.1], ['pumpkin_orange', 5.4, 2.8, 0.7],
    ['pumpkin_yellow_small', -6.6, 3.4, 1.2], ['pumpkin_orange', -2.3, 4.8, 0.75], ['pumpkin_yellow_small', -1.9, -2.6, 0.9],
    ['skull', -2.1, 5.9, 0.45], ['skull', 4.8, 3.2, 0.4], ['skull', 2.0, 7.1, 0.42], ['skull', -1.9, 3.4, 0.4],
    ['bone_A', 2.1, 5.3, 1], ['bone_B', -1.95, 6.1, 1], ['bone_C', 4.4, 5.0, 1], ['bone_A', -6.0, 2.8, 1], ['ribcage', 6.6, 4.9, 0.7],
    ['bone_C', 2.3, -2.2, 1], ['bone_B', -2.2, 1.2, 1],
  ];
  for (const [model, x, z, scale] of smallJobs) tryAdd(model, 'small', () => ({ x: x + between(-0.3, 0.3), z: z + between(-0.3, 0.3), scale }), 16);

  // ===== spots for the animated critters and details =====
  // Everything below uses its own random numbers, so the layout built above stays where it was when these change.
  next = mulberry32(seed + 7);
  const lean = <T extends Placement | null>(p: T, amount = 0.07): T => {
    if (p) p.tilt = [between(-amount, amount), between(-amount, amount)];
    return p;
  };
  // A slight lean for the trees and graves already placed (not the trees that carry a lantern: it hangs from the branch tip).
  for (const p of placements) {
    if (p.group === 'tree' && p !== leftLanternTree && p !== rightLanternTree) lean(p, 0.07);
    else if (p.group === 'oldGrave' || p.group === 'small') lean(p, 0.06);
  }
  // The black cat sits on a gravestone at the left.
  const perch = fixedNear('gravestone', 'critter', -4.2, -2.5, 0.2, undefined, 1.3, 1);
  const cat = { x: perch.x, y: MODELS.gravestone.h * perch.scale * 0.96, z: perch.z, rotY: 0.2 };
  // Dirt mounds where skeletons push up out of the soil.
  const moundSpots: [number, number][] = [[-4.7, -0.2], [10, -2], [-7, -9.8]];
  const mounds = moundSpots.map(([x, z], i) => {
    const m = fixedNear('dirt_mound', 'critter', x!, z!, between(0, 6.28), undefined, 1, 2);
    return { x: m.x, z: m.z, rotY: m.rotY, scale: 1, seed: i };
  });
  // The bubbling cauldron behind the fence at the left (its green glow shows between the bars), and a half-open coffin at the right.
  const cauldronSc = 4.2;
  const caul = fixedNear('forest_cauldron', 'critter', -7.4, -5.6, 0.3, undefined, cauldronSc, 2);
  const cauldron = { x: caul.x, y: MODELS.forest_cauldron.h * cauldronSc, z: caul.z };
  glows.push({ kind: 'cauldron', x: cauldron.x, y: cauldron.y, z: cauldron.z });
  const spot = fixedNear('open_coffin_spot', 'critter', 8.6, -2.6, -0.5, undefined, 1, 3);
  const openCoffin = { x: spot.x, z: spot.z, rotY: spot.rotY };
  // Three bare trees that carry the owl, the spiders and the crows, at the left behind the fence. Each takes the place of any
  // random gravestones, bones or trees in the way; fixed things (lanterns, jack-o'-lanterns, the gate, the data slots) never move.
  const EVICTABLE: Group[] = ['oldGrave', 'small', 'tree'];
  const perchTree = (model: ModelId, x: number, z: number, scale: number): Placement => {
    for (let r = 0; r < 14; r++) {
      for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]] as const) {
        const p = make(model, 'tree', x + dx * r * 0.5, z + dz * r * 0.5, between(0, 6.28), scale, 0);
        const f = footprintOf(p);
        if (!insideGround(f) || nearPath(p.x, p.z, Math.max(f.hx, f.hz)) || overCryptMoon(p) || behindControls(p)) {
          counter--;
          continue;
        }
        const blockers = solid.filter((q) => footprintsOverlap(f, footprintOf(q), 0.1));
        if (blockers.some((q) => !EVICTABLE.includes(q.group) || q === leftLanternTree || q === rightLanternTree || heroIds.includes(q.id))) {
          counter--;
          continue;
        }
        for (const q of blockers) {
          placements.splice(placements.indexOf(q), 1);
          solid.splice(solid.indexOf(q), 1);
        }
        // Lit candles and mushroom glows that stood among the removed things go too.
        for (let i = glows.length - 1; i >= 0; i--) {
          const g = glows[i]!;
          if ((g.kind === 'mushroom' || (g.kind === 'candle' && g.slot === undefined)) && blockers.some((q) => Math.hypot(q.x - g.x, q.z - g.z) < Math.max(MODELS[q.model].hx, MODELS[q.model].hz) * q.scale + 0.8)) glows.splice(i, 1);
        }
        add(p);
        return lean(p, 0.04);
      }
    }
    throw new Error(`No room for the ${model} tree near ${x},${z}`);
  };
  const owlTree = perchTree('tree_dead_large', -11.6, -5.4, 1.05);
  const crowTreeA = perchTree('tree_dead_medium', -13.6, -12.4, 1.2);
  const crowTreeB = perchTree('tree_dead_large', -6.4, -13.6, 1.0);
  // Two small clusters of glowing mushrooms behind the fence, where the yard has room (they glow between the bars).
  const mushroomClusters: [number, number][] = [[-5.4, -14.4], [-3.2, -11.8]];
  mushroomClusters.forEach(([cx, cz]) => {
    [[-0.5, 0.1, 2.1], [0.45, 0.5, 1.7], [0.05, -0.55, 1.9]].forEach(([dx, dz, sc]) => {
      const mush = lean(tryAdd('forest_mushroom', 'small', () => ({ x: cx! + dx! + between(-0.5, 0.5), z: cz! + dz! + between(-0.5, 0.5), scale: sc! }), 40), 0.1);
      if (mush) glows.push({ kind: 'mushroom', x: mush.x, y: MODELS.forest_mushroom.h * sc! * 0.85, z: mush.z });
    });
  });
  const top = (p: Placement, k: number) => MODELS[p.model].h * p.scale * k;
  // Crows on the fence pillars near the gate and on the dead trees.
  const pillars = placements
    .filter((p) => p.model === 'fence_pillar' && Math.abs(p.z - FENCE_Z) < 0.1 && Math.abs(p.x - gateX) < 14)
    .sort((a, b) => Math.abs(a.x - gateX) - Math.abs(b.x - gateX));
  const crows: Scenery['crows'] = [];
  [0, 1, 2, 3].forEach((k, i) => {
    const pil = pillars[k];
    if (pil) crows.push({ x: pil.x, y: MODELS.fence_pillar.h + 0.05, z: pil.z, rotY: between(-0.9, 0.9), seed: i + 1 });
  });
  for (const [tree, k] of [[crowTreeA, 0.8], [crowTreeB, 0.7]] as const) {
    crows.push({ x: tree.x + 0.3, y: top(tree, k), z: tree.z + 0.4, rotY: between(-0.9, 0.9), seed: crows.length + 1 });
  }
  // The owl sits on a bare branch that reaches toward the camera.
  const ot = owlTree;
  const by = MODELS[ot.model].h * ot.scale * 0.5;
  const owl = { x: ot.x + 1.5, y: by + 0.45, z: ot.z + 2.2, rotY: 0.2, branch: [ot.x, by, ot.z, ot.x + 1.6, by + 0.3, ot.z + 2.4] as [number, number, number, number, number, number] };
  // Spiders drop on threads from the branches of the owl's tree.
  const sTop = MODELS[ot.model].h * ot.scale * 0.72;
  const spiders = [0, 1, 2].map((i) => ({ x: ot.x - 0.4 + i * 0.85, topY: sTop - i * 0.1, z: ot.z + 1.7 + i * 0.3, drop: [1.5, 2.1, 1.1][i]!, seed: i + 1 }));
  // One cobweb hangs between two neighbouring gravestones of a row.
  const webA = placements.find((q) => q.id === webPair[0]);
  const webB = placements.find((q) => q.id === webPair[1]);
  const cobwebs: Scenery['cobwebs'] = [];
  if (webA && webB) {
    const dx = webB.x - webA.x;
    cobwebs.push({ x: (webA.x + webB.x) / 2, y: 0.95, z: (webA.z + webB.z) / 2 + 0.1, w: dx * 0.95, h: 1.5, rotY: 0 });
  }
  // Will-o'-the-wisps drift between the graves.
  const wisps = Array.from({ length: 6 }, (_, i) => ({ x: (i % 2 ? 1 : -1) * between(6, 13), y: between(0.7, 2.2), z: between(-9, 1), seed: i + 1 }));
  const scenery: Scenery = { cat, crows, owl, spiders, mounds, cauldron, openCoffin, wisps, cobwebs };

  // ===== the backdrop behind the fence, in layers, so the band from the horizon to the tombstones is not empty =====
  // Its own random numbers again, so nothing above moves. Every piece passes `fits` (inside the ground, off the path, no overlap,
  // not over the moon, never behind the page's controls), so the tall ones end up at the sides and the middle stays low.
  next = mulberry32(seed + 13);
  const backdrop = (model: ModelId, group: Group, x: readonly [number, number], z: readonly [number, number], s: readonly [number, number], tilt: number, rot: readonly [number, number] = [0, Math.PI * 2]) =>
    lean(tryAdd(model, group, () => ({ x: between(x[0], x[1]), z: between(z[0], z[1]), rotY: between(rot[0], rot[1]), scale: between(s[0], s[1]) }), 60), tilt);
  // Middle back: bare twisted dead trees of different heights, two carrying a lantern, and a few more rust pines.
  const backTrees: [ModelId, [number, number], [number, number], [number, number]][] = [
    ['tree_dead_large', [-24, -15], [-30, -19], [1.1, 1.45]],
    ['tree_dead_medium', [-13, -6], [-27, -18], [0.8, 1.1]],
    ['tree_dead_large', [6, 13], [-30, -19], [0.95, 1.25]],
    ['tree_dead_medium', [14, 24], [-27, -17], [1.0, 1.3]],
    ['tree_dead_medium', [-4, 5], [-32, -22], [0.6, 0.85]],
    ['forest_twisted_c', [-27, -18], [-37, -28], [0.22, 0.28]],
    ['forest_twisted_c', [17, 27], [-37, -28], [0.2, 0.26]],
    ['tree_pine_orange_medium', [-22, -12], [-32, -21], [0.8, 1.0]],
    ['tree_pine_orange_medium', [12, 22], [-32, -21], [0.8, 1.0]],
    ['tree_pine_orange_large', [-28, -20], [-38, -29], [0.9, 1.1]],
    ['tree_pine_yellow_medium', [19, 28], [-38, -29], [0.85, 1.05]],
  ];
  const backDead = backTrees.map(([model, x, z, s]) => backdrop(model, 'tree', x, z, s, 0.05)).filter((p): p is Placement => !!p && p.model.startsWith('tree_dead'));
  // A lantern hangs from the branch tip of the first two bare trees (glow only: the point lights are all used).
  const TIP: Partial<Record<ModelId, readonly [number, number, number]>> = { tree_dead_large: [-1.32, 3.86, -0.73], tree_dead_medium: [1.32, 2.86, 0] };
  for (const tree of backDead.slice(0, 2)) {
    tree.tilt = undefined;
    hangFrom(tree, TIP[tree.model]!, 0.7, false);
  }
  // Near the fence: two small mausoleums, broken fence sections, a lone lamp post and leaning tombstones peeking over the fence.
  backdrop('crypt', 'fence', [-21, -14], [-15, -9.5], [0.34, 0.42], 0, [0.25, 0.6]);
  backdrop('crypt', 'fence', [15, 22], [-17, -12], [0.3, 0.38], 0, [-0.6, -0.25]);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 2; i++) backdrop('fence_broken', 'fence', side < 0 ? [-24, -9] : [9, 24], [-13, -8], [0.8, 1], 0.12, [-0.35, 0.35]);
  }
  const lamp = backdrop('post_lantern', 'lantern', [-17, -12], [-21, -16], [0.9, 1], 0.03, [Math.PI / 2 - 0.2, Math.PI / 2 + 0.2]);
  if (lamp) glows.push({ kind: 'postLantern', x: lamp.x + Math.sin(lamp.rotY) * lamp.scale, y: 2.4 * lamp.scale, z: lamp.z + Math.cos(lamp.rotY) * lamp.scale });
  const peekers: ModelId[] = ['grave_A', 'grave_B', 'gravestone', 'grave_A_destroyed'];
  for (let i = 0; i < 16; i++) backdrop(peekers[i % peekers.length]!, 'oldGrave', i % 2 ? [3, 22] : [-22, -3], [-11, -5], [0.85, 1.1], 0.16, [-0.35, 0.35]);

  // ----- where the floating ghosts hover: one at the left, one by the mausoleum, one peeking in at the right edge -----
  const ghostSpots = [
    { x: -5.6, y: 1.0, z: -2.2 },
    { x: 4.4, y: 0.9, z: -2.6 },
    { x: 11.2, y: 1.1, z: -1.4 },
  ];

  // Nothing in the near foreground is cut off by the screen edge: scattered props that would be are dropped (the hero
  // gravestones, the rows and the critter trees stay). Lit candles and mushroom glows that stood beside them go too.
  const keep = new Set<string>([owlTree.id, crowTreeA.id, crowTreeB.id, ...heroIds, ...leftRow, ...rightRow]);
  const dropped = placements.filter((p) => (p.group === 'small' || p.group === 'oldGrave' || p.group === 'tree') && !keep.has(p.id) && cutByScreenEdge(p));
  if (dropped.length) {
    const gone = new Set(dropped.map((p) => p.id));
    for (let i = placements.length - 1; i >= 0; i--) if (gone.has(placements[i]!.id)) placements.splice(i, 1);
    for (let i = glows.length - 1; i >= 0; i--) {
      const g = glows[i]!;
      if ((g.kind === 'mushroom' || (g.kind === 'candle' && g.slot === undefined)) && dropped.some((q) => Math.hypot(q.x - g.x, q.z - g.z) < Math.max(MODELS[q.model].hx, MODELS[q.model].hz) * q.scale + 0.8)) glows.splice(i, 1);
    }
  }
  return { placements, lights: lights.slice(0, BUDGET.maxPointLights), glows, pathCentres, scenery, ghostSpots, cryptDoor };
}

let cached: Layout | null = null;
/** The one layout the scene uses. */
export function layout(): Layout {
  return (cached ??= buildLayout());
}

/** Full capacity of each data-driven group (Requirement 7). */
export const SLOT_GROUPS = { newGrave: CAPS.newGraves, coffin: CAPS.coffins, candle: CAPS.candles } as const;
