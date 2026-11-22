// Model catalogue and seeded graveyard layout. Pure: no three, no browser APIs.
// Coordinates: x to the right, y up, z toward the camera. Units match the Kaykit models.
import { BUDGET, CAPS } from './config';
import { cameraAt, project, projectDirection } from './camera';
import { clamp, mulberry32 } from './rng';
import { moonDirection, moonScreenRadius } from './sky';

export const LAYOUT_SEED = 1031;

/** The ground, as a rectangle. The camera looks toward negative z. */
export const GROUND = { minX: -30, maxX: 30, minZ: -40, maxZ: 12, tile: 4 } as const;

export type ModelId = keyof typeof MODELS;
export type Group =
  | 'ground' | 'path' | 'crypt' | 'gate' | 'fence' | 'tree' | 'oldGrave' | 'newGrave'
  | 'coffin' | 'candle' | 'lantern' | 'pumpkin' | 'small' | 'critter';

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
  // The small open coffin (public/models/coffin.glb), used for the coffins that follow the data.
  coffin_open: { hx: 0.287, hz: 0.419, h: 0.325, tris: 256, shadow: false, source: 'custom' },
  // Things drawn by the scene's own code. They are in the catalogue so nothing is placed on top of them.
  dirt_mound: p_(0.85, 0.85, 0.4, 96),
  open_coffin_spot: p_(0.8, 1.2, 1.0, 256),
} as const;

/** The catalogue entry of a model, with the same type for every model. */
export const modelInfo = (id: ModelId): ModelInfo => MODELS[id];

/** Where a model's file is, as a path from the extension's root. */
export function modelFile(id: ModelId): string {
  const src = MODELS[id].source;
  if (src === 'custom') return '/models/coffin.glb';
  return src === 'quaternius' ? `/models/quaternius/${id}.glb` : `/models/kaykit/${id}.gltf`;
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
  kind: 'cryptDoor' | 'lantern' | 'jackOLantern' | 'candle' | 'postLantern' | 'mushroom' | 'cauldron';
  x: number;
  y: number;
  z: number;
  /** For candles: which candle slot this flame belongs to. */
  slot?: number;
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
  /** World position of the crypt doorway. */
  cryptDoor: { x: number; y: number; z: number; rotY: number };
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

/** The crypt's doorway in the model's own space (the door faces +z). A guess: check it in Chrome. */
export const CRYPT_DOOR_LOCAL = { x: 0, y: 1.3, z: 4.05 } as const;

/** The winding cobblestone path: from the bottom centre of the screen, into the scene, to the gate. */
const PATH_POINTS: [number, number][] = [[0.3, 8.6], [-0.9, 5], [0.7, -1.5], [-0.5, -8], [0.6, -14], [0.5, -17.6]];
/** The crypt: smaller and further back, right of centre, turned to face the camera. */
const CRYPT = { x: 8, z: -27, rotY: Math.atan2(0.5 - 8, 16 + 27) };
/** The fence and the gate share one line across the yard. */
const FENCE_Z = -20.4;

// ---------- moon clear zone ----------
const MOON_ASPECTS = [16 / 10, 16 / 9, 21 / 9];

/** True when the top of a tall prop would appear over the moon's halo on screen. */
export function blocksMoon(p: Placement): boolean {
  const info = MODELS[p.model];
  if (info.h < 2.5) return false;
  const pad = Math.max(info.hx, info.hz) * p.scale;
  for (const aspect of MOON_ASPECTS) {
    const cam = cameraAt(0, aspect, true);
    const moon = projectDirection(moonDirection(aspect), cam);
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
  for (let s = 0; s <= total; s += 1.75) {
    const c = atArc(s);
    pathCentres.push({ x: c.x, z: c.z });
    for (const side of [-1, 1]) {
      const model = pick(pathModels);
      const turn = Math.floor(rng() * 4) * (Math.PI / 2);
      placements.push(make(model, 'path', c.x - c.dz * side * PATH_TILE_OFFSET, c.z + c.dx * side * PATH_TILE_OFFSET, turn, PATH_TILE_SCALE, 0.02));
    }
  }
  const nearPath = (x: number, z: number, extra: number) =>
    pathCentres.some((c) => Math.hypot(c.x - x, c.z - z) < PATH_HALF_WIDTH + PATH_CLEARANCE + extra);

  // The ground itself is one plane drawn by the scene (no tiles), so nothing is placed for it here.
  const doorX = CRYPT.x + Math.sin(CRYPT.rotY) * CRYPT_DOOR_LOCAL.z;
  const doorZ = CRYPT.z + Math.cos(CRYPT.rotY) * CRYPT_DOOR_LOCAL.z;
  const cryptDoor = { x: doorX, y: CRYPT_DOOR_LOCAL.y, z: doorZ, rotY: CRYPT.rotY };

  const fits = (p: Placement, margin = 0.15): boolean => {
    const f = footprintOf(p);
    if (!insideGround(f)) return false;
    if (!PATH_EXEMPT.includes(p.group) && nearPath(p.x, p.z, Math.max(f.hx, f.hz))) return false;
    if (blocksMoon(p)) return false;
    return solid.every((q) => !footprintsOverlap(f, footprintOf(q), margin));
  };
  const add = (p: Placement): Placement => {
    placements.push(p);
    solid.push(p);
    return p;
  };
  /** Fixed items: they must fit, so a bad number fails the tests at once. */
  const fixed = (p: Placement, margin = 0): Placement => {
    const f = footprintOf(p);
    if (!insideGround(f) || solid.some((q) => footprintsOverlap(f, footprintOf(q), margin))) {
      throw new Error(`Fixed prop ${p.model} at ${p.x},${p.z} does not fit`);
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
        if (insideGround(f) && !nearPath(p.x, p.z, Math.max(f.hx, f.hz)) && solid.every((q) => !footprintsOverlap(f, footprintOf(q), 0.1))) return add(p);
        counter--;
      }
    }
    throw new Error(`No room for ${model} slot ${slot}`);
  };

  // ----- the fence line across the yard, with the arched gate in the middle -----
  const gateX = 0.5;
  fixed(make('arch_gate', 'gate', gateX, FENCE_Z, 0));
  const GATE_EDGE = MODELS.arch_gate.hx + 0.34;
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
  // (The fence ends well past the edge of the view, so no side runs are needed.)

  // ----- the crypt, smaller and further back, right of centre -----
  fixed(make('crypt', 'crypt', CRYPT.x, CRYPT.z, CRYPT.rotY));
  lights.push({ kind: 'cryptDoor', x: doorX, y: cryptDoor.y + 0.3, z: doorZ });
  glows.push({ kind: 'cryptDoor', x: doorX, y: cryptDoor.y, z: doorZ });

  // ----- big jack-o'-lanterns with glowing faces, and lanterns -----
  const jack = (model: ModelId, x: number, z: number, rot: number, scale: number, real: boolean) => {
    const j = fixed(make(model, 'pumpkin', x, z, rot, scale));
    const src = { kind: 'jackOLantern' as const, x: j.x, y: 0.65 * scale, z: j.z };
    glows.push(src);
    if (real) lights.push(src);
  };
  jack('pumpkin_orange_jackolantern', -3.9, 6.1, 0.35, 1.0, true);
  jack('pumpkin_yellow_jackolantern', 4.0, 5.0, -0.4, 0.95, true);
  jack('pumpkin_orange_jackolantern', -5.6, 0.8, 0.5, 0.87, true);
  jack('pumpkin_yellow_jackolantern', 5.8, -3.6, -0.5, 0.84, false);
  for (const side of [-1, 1]) {
    const l = fixed(make('lantern_standing', 'lantern', gateX + side * 2.5, FENCE_Z + 1.7, 0, 1.5));
    glows.push({ kind: 'lantern', x: l.x, y: 0.5 * 1.5, z: l.z });
    // Only the two gate lanterns are real lights: the crypt, three jack-o'-lanterns and these make six.
    lights.push({ kind: 'lantern', x: l.x, y: 0.5 * 1.5, z: l.z });
  }
  // Hanging lanterns on posts at the edges, their arms reaching over the grass (glow only, not real lights).
  for (const [x, z, rot] of [[-14.5, -5, Math.PI / 2], [14.5, -2, -Math.PI / 2], [-11, -17, Math.PI / 2], [-19.5, -14, Math.PI / 2]] as const) {
    const post = fixed(make('post_lantern', 'lantern', x, z, rot));
    glows.push({ kind: 'postLantern', x: post.x + Math.sin(rot), y: 2.4, z: post.z + Math.cos(rot) });
  }

  // ----- data-driven things: new graves (24), coffins (8) and candles (12) -----
  const graveModels: ModelId[] = ['gravestone', 'grave_B'];
  let slot = 0;
  for (const z of [-5, -10, -15]) {
    for (const x of [-16, -12.8, -9.6, -6.4, 6.8, 10, 13.2, 16.4]) {
      fixedNear(graveModels[slot % 2]!, 'newGrave', x, z, between(-0.06, 0.06), slot);
      slot++;
    }
  }
  slot = 0;
  // Coffins stand behind the fence, along the back left of the yard.
  for (const [x, z] of [[-23, -26], [-19.5, -26], [-16, -26.5], [-12.5, -27], [-9, -28.5], [-5, -29], [-1.5, -30], [2, -31.5]] as const) {
    fixedNear('coffin_open', 'coffin', x, z, between(-0.1, 0.1), slot++, 2.2);
  }
  const candleModels: ModelId[] = ['candle_triple', 'candle_thin', 'candle_melted'];
  slot = 0;
  for (const z of [3.5, -1.5, -6.5, -11, -14.5, -17]) {
    for (const side of [-1, 1]) {
      const model = candleModels[slot % 3]!;
      const c = fixedNear(model, 'candle', pathXAt(z) + side * 3.1, z, between(0, Math.PI * 2), slot);
      glows.push({ kind: 'candle', x: c.x, y: MODELS[model].h, z: c.z, slot });
      slot++;
    }
  }

  // ----- trees on the edges: autumn pines and bare dead trees -----
  const edge = (xLo: number, xHi: number, zLo: number, zHi: number, sLo = 1, sHi = 1.25) => () => ({ x: between(xLo, xHi), z: between(zLo, zHi), scale: between(sLo, sHi) });
  const L = (zLo: number, zHi: number, s?: [number, number]) => edge(-24.2, -20.5, zLo, zHi, s?.[0], s?.[1]);
  const R = (zLo: number, zHi: number, s?: [number, number]) => edge(20.5, 24.2, zLo, zHi, s?.[0], s?.[1]);
  const treeJobs: [ModelId, () => { x: number; z: number; scale: number }][] = [
    ['tree_pine_orange_large', L(-17, -8)], ['tree_pine_orange_large', R(-17, -8)],
    ['tree_pine_orange_medium', L(-6, 4)], ['tree_pine_orange_medium', R(-6, 4)],
    ['tree_pine_orange_large', L(-18, -12)], ['tree_pine_yellow_medium', R(2, 8)],
    ['tree_pine_orange_medium', edge(-24, -10, -30, -24)], ['tree_pine_orange_large', edge(14, 24, -30, -24)],
    ['tree_dead_large', L(-4, 4, [1, 1.2])], ['tree_dead_large_decorated', R(-4, 4, [1, 1.15])],
    ['tree_dead_medium', edge(-24, -14, -24, -21)], ['tree_dead_medium', edge(12, 24, -24, -21)],
    ['forest_twisted_a', edge(-24.2, -20.5, -12, 2, 0.28, 0.32)], ['forest_twisted_b', edge(20.5, 24.2, -12, 2, 0.28, 0.32)],
    ['tree_dead_large', edge(-8, 12, -31, -24)], ['tree_pine_yellow_medium', edge(-12, 2, -31, -24)],
    // More on both sides: autumn pines and bare trees along the edges, in the back and in the front corners.
    ['tree_pine_orange_large', edge(-24, -14, -31, -23)], ['tree_pine_orange_large', edge(14, 24, -31, -23)],
    ['tree_pine_orange_medium', L(-12, 0)], ['tree_pine_orange_medium', R(-12, 0)],
    ['tree_pine_orange_large', L(2, 8)], ['tree_pine_orange_large', R(-2, 6)],
    ['tree_dead_large', L(-16, -8)], ['tree_dead_large', R(-16, -8)],
    ['tree_dead_medium', L(0, 8)], ['tree_dead_medium', R(0, 8)],
    ['tree_dead_large', edge(-24, -12, -31, -22)], ['tree_dead_medium', edge(12, 24, -31, -22)],
    ['tree_dead_medium', edge(-26, -17, 4, 9)], ['tree_pine_orange_medium', edge(17, 26, 4, 9)],
  ];
  treeJobs.forEach(([model, region]) => tryAdd(model, 'tree', region, 160));

  // ----- rows of old gravestones on both sides of the path (always there) -----
  const rows = [3.5, -1, -7.5, -12.5, -17.5];
  const leftCols = [-5.4, -8.8, -12.2, -15.6, -19];
  const rightCols = [5.8, 9.2, 12.6, 16, 19.4];
  const stones: ModelId[] = ['gravestone', 'grave_A', 'grave_B', 'grave_A_destroyed', 'gravemarker_A', 'gravestone', 'grave_B', 'gravemarker_B', 'grave_A', 'gravestone'];
  rows.forEach((z, r) => {
    [...leftCols, ...rightCols].forEach((x, c) => {
      if ((r * 7 + c * 3) % 5 === 4) return; // a few gaps, so the rows look old
      const model = stones[(r * 3 + c) % stones.length]!;
      const small = model.startsWith('gravemarker');
      tryAdd(model, 'oldGrave', () => ({ x: x + between(-0.4, 0.4), z: z + between(-0.4, 0.4), rotY: between(-0.18, 0.18), scale: small ? 1.25 : between(0.95, 1.1) }), 12);
    });
  });
  // Wooden crosses, skulls and bones scattered on both sides.
  const sides = (xLo: number, xHi: number, zLo: number, zHi: number) => () => {
    const side = rng() < 0.5 ? -1 : 1;
    return { x: side * between(xLo, xHi), z: between(zLo, zHi) };
  };
  for (let i = 0; i < 10; i++) tryAdd(i % 2 ? 'gravemarker_A' : 'gravemarker_B', 'small', () => ({ ...sides(4.5, 21, -17, 8)(), scale: 1.3 }), 80);
  for (let i = 0; i < 8; i++) tryAdd('skull', 'small', () => ({ ...sides(3.6, 20, -16, 8)(), scale: between(1.1, 1.5) }), 80);
  for (let i = 0; i < 4; i++) tryAdd('skull_candle', 'small', () => ({ ...sides(3.8, 16, -14, 6)(), scale: 1.25 }), 80);
  const bones: ModelId[] = ['bone_A', 'bone_B', 'bone_C', 'bone_A', 'bone_B', 'bone_C', 'ribcage', 'ribcage', 'bone_A', 'bone_C'];
  bones.forEach((m) => tryAdd(m, 'small', () => ({ ...sides(3.4, 21, -17, 9)(), scale: between(1.2, 1.7) }), 80));
  tryAdd('shrine_candles', 'small', () => ({ x: between(-17, -13), z: between(-3, 3), scale: 1.2 }), 60);
  tryAdd('bench_decorated', 'small', () => ({ x: between(13, 17), z: between(4, 8), rotY: -0.3 }), 60);
  // Clusters of lit candles.
  const clusters: [number, number][] = [[-9.6, 6.2], [10.2, 2.4], [-13.4, -3.4], [12.4, -10.2], [-6.6, -14.6], [7.6, -15.4], [-17.2, 3.8], [16.2, 7.2], [-11.2, 10.6]];
  const lit: ModelId[] = ['candle_triple', 'candle_thin', 'candle_melted', 'candle_thin'];
  clusters.forEach(([cx, cz]) => {
    for (let i = 0; i < 4; i++) {
      const model = lit[i]!;
      const c = tryAdd(model, 'small', () => ({ x: cx! + between(-0.9, 0.9), z: cz! + between(-0.9, 0.9), scale: 1.3 }), 40);
      if (c) glows.push({ kind: 'candle', x: c.x, y: MODELS[model].h * 1.3, z: c.z });
    }
  });
  // More pumpkins along the path.
  const pumpkins: ModelId[] = ['pumpkin_orange', 'pumpkin_yellow_small', 'pumpkin_orange', 'pumpkin_orange', 'pumpkin_yellow_small', 'pumpkin_orange', 'pumpkin_yellow_small'];
  pumpkins.forEach((model, i) => {
    const c = atArc(total * (0.1 + i * 0.12));
    const side = i % 2 === 0 ? 1 : -1;
    tryAdd(model, 'pumpkin', () => ({ x: c.x + side * (3.4 + between(0, 1.6)), z: c.z + between(-1.2, 1.2), scale: between(0.7, 1.0) }), 60);
  });

  // ===== A richer yard: more trees and graves, mushrooms, and spots for the animated critters =====
  // Everything below uses its own random numbers, so the layout built above stays where it was.
  next = mulberry32(seed + 7);
  const lean = <T extends Placement | null>(p: T, amount = 0.07): T => {
    if (p) p.tilt = [between(-amount, amount), between(-amount, amount)];
    return p;
  };
  // A slight lean for the trees and graves already placed.
  for (const p of placements) {
    if (p.group === 'tree') lean(p, 0.07);
    else if (p.group === 'oldGrave' || p.group === 'small') lean(p, 0.05);
  }
  // Spots for the cat, mounds, cauldron and open coffin are reserved first, before the yard fills up.
  // The black cat sits on a big gravestone beside the path.
  const perch = fixedNear('gravestone', 'critter', -6.4, 2.9, 0.15, undefined, 1.35, 2);
  const cat = { x: perch.x, y: MODELS.gravestone.h * perch.scale * 0.96, z: perch.z, rotY: 0.1 };
  // Dirt mounds where skeletons push up out of the soil.
  const moundSpots: [number, number][] = [[3.9, 1.6], [-3.5, -5.2], [3.7, -9.8]];
  const mounds = moundSpots.map(([x, z], i) => {
    const m = fixedNear('dirt_mound', 'critter', x!, z!, between(0, 6.28), undefined, 1, 2);
    return { x: m.x, z: m.z, rotY: m.rotY, scale: 1, seed: i };
  });
  // The bubbling cauldron, and a half-open coffin.
  const cauldronSc = 4.2;
  const caul = fixedNear('forest_cauldron', 'critter', 6.4, -0.6, 0.3, undefined, cauldronSc, 2);
  const cauldron = { x: caul.x, y: MODELS.forest_cauldron.h * cauldronSc, z: caul.z };
  glows.push({ kind: 'cauldron', x: cauldron.x, y: cauldron.y, z: cauldron.z });
  const spot = fixedNear('open_coffin_spot', 'critter', -8.2, -7.4, 0.5, undefined, 1, 3);
  const openCoffin = { x: spot.x, z: spot.z, rotY: spot.rotY };
  // Three bare trees that carry the owl and spiders and the crows. They stand in plain view, so each one takes
  // the place of any random gravestones, bones or trees that are in the way. Fixed things (lanterns, jack-o'-lanterns,
  // the gate, the data slots) are never moved.
  const EVICTABLE: Group[] = ['oldGrave', 'small', 'tree'];
  const perchTree = (model: ModelId, x: number, z: number, scale: number): Placement => {
    for (let r = 0; r < 14; r++) {
      for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]] as const) {
        const p = make(model, 'tree', x + dx * r * 0.5, z + dz * r * 0.5, between(0, 6.28), scale, 0);
        const f = footprintOf(p);
        if (!insideGround(f) || nearPath(p.x, p.z, Math.max(f.hx, f.hz)) || blocksMoon(p)) {
          counter--;
          continue;
        }
        const blockers = solid.filter((q) => footprintsOverlap(f, footprintOf(q), 0.1));
        if (blockers.some((q) => !EVICTABLE.includes(q.group))) {
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
  const owlTree = perchTree('tree_dead_large', -9.8, -6.2, 1.1);
  const crowTreeA = perchTree('tree_dead_medium', -15.5, -12.8, 1.2);
  const crowTreeB = perchTree('tree_dead_large', 11.5, -18.6, 1.1);
  // Glowing mushrooms near the graves, and a few big ones.
  for (let i = 0; i < 14; i++) {
    const sc = between(1.7, 2.6);
    const mush = lean(tryAdd('forest_mushroom', 'small', () => ({ x: (next() < 0.5 ? -1 : 1) * between(3.4, 20), z: between(-18, 8.5), scale: sc }), 300), 0.1);
    if (mush) glows.push({ kind: 'mushroom', x: mush.x, y: MODELS.forest_mushroom.h * sc * 0.85, z: mush.z });
  }
  for (const side of [-1, 1]) {
    const sc = between(0.7, 0.9);
    const king = tryAdd('forest_mushroom_king', 'small', () => ({ x: side * between(8, 17), z: between(-12, 2), scale: sc }), 80);
    if (king) glows.push({ kind: 'mushroom', x: king.x, y: MODELS.forest_mushroom_king.h * sc * 0.8, z: king.z });
  }

  // A back row of trees in the fog behind the fence, in a mix of kinds and sizes.
  const backRow: ModelId[] = [
    'tree_pine_orange_large', 'forest_twisted_c', 'tree_pine_orange_medium', 'tree_dead_large', 'tree_pine_yellow_medium',
    'tree_pine_orange_large', 'tree_dead_medium', 'forest_twisted_b', 'tree_pine_orange_medium', 'tree_dead_large',
    'tree_pine_yellow_medium', 'tree_dead_large', 'tree_pine_orange_large', 'tree_dead_large', 'tree_pine_orange_medium', 'tree_dead_medium',
  ];
  backRow.forEach((model) => {
    const twisted = model.startsWith('forest_twisted');
    lean(
      tryAdd(model, 'tree', () => ({ x: between(-26, 26), z: between(-38.8, -32.4), scale: twisted ? between(0.25, 0.34) : between(0.9, 1.4), rotY: between(0, 6.28) }), 120),
      0.1,
    );
  });
  // And more along both sides, in the gaps.
  const sideTrees: ModelId[] = ['tree_pine_orange_medium', 'tree_dead_medium', 'tree_pine_yellow_medium', 'tree_dead_large', 'tree_pine_orange_large', 'tree_dead_large_decorated'];
  sideTrees.forEach((model, i) => {
    for (const side of [-1, 1]) {
      lean(tryAdd(model, 'tree', () => ({ x: side * between(17, 26), z: between(-26, 9), scale: between(0.85, 1.3), rotY: between(0, 6.28) }), 120), 0.1);
    }
    void i;
  });
  // More graves with a lot of variety: kinds, turns, leans and sizes.
  const variety: ModelId[] = [
    'grave_A', 'grave_B', 'grave_A_destroyed', 'gravemarker_A', 'gravemarker_B', 'gravestone', 'shrine_candles', 'gravemarker_A', 'fence_broken', 'grave_B',
  ];
  for (let i = 0; i < 48; i++) {
    const model = variety[i % variety.length]!;
    const single = model === 'shrine_candles' || model === 'fence_broken';
    lean(
      tryAdd(
        model,
        single ? 'small' : 'oldGrave',
        () => ({ x: (next() < 0.5 ? -1 : 1) * between(3.6, 22), z: between(-18.8, 8.5), rotY: single ? between(0, 6.28) : between(-0.5, 0.5), scale: between(0.85, 1.2) }),
        50,
      ),
      0.07,
    );
  }
  for (let i = 0; i < 2; i++) lean(tryAdd('post_skull', 'small', () => ({ x: (i ? 1 : -1) * between(5, 18), z: between(-16, 4), rotY: (i ? -1 : 1) * Math.PI / 2, scale: 1 }), 80), 0.05);
  // ----- spots for the animated critters and details -----
  const top = (p: Placement, k: number) => MODELS[p.model].h * p.scale * k;

  // Crows on the fence posts and the dead trees.
  const pillars = placements
    .filter((p) => p.model === 'fence_pillar' && Math.abs(p.z - FENCE_Z) < 0.1 && Math.abs(p.x - gateX) < 14)
    .sort((a, b) => Math.abs(a.x - gateX) - Math.abs(b.x - gateX));
  const crows: Scenery['crows'] = [];
  [0, 1, 3, 4].forEach((k, i) => {
    const pil = pillars[k];
    if (pil) crows.push({ x: pil.x, y: MODELS.fence_pillar.h + 0.05, z: pil.z, rotY: between(-0.9, 0.9), seed: i + 1 });
  });
  for (const [tree, k] of [[crowTreeA, 0.8], [crowTreeB, 0.7]] as const) {
    if (tree) crows.push({ x: tree.x + 0.3, y: top(tree, k), z: tree.z + 0.4, rotY: between(-0.9, 0.9), seed: crows.length + 1 });
  }
  // The owl sits on a bare branch that reaches toward the camera.
  const ot = owlTree;
  const by = MODELS[ot.model].h * ot.scale * 0.5;
  const owl = { x: ot.x + 1.5, y: by + 0.45, z: ot.z + 2.2, rotY: 0.2, branch: [ot.x, by, ot.z, ot.x + 1.6, by + 0.3, ot.z + 2.4] as [number, number, number, number, number, number] };
  // Spiders drop on threads from the branches of the owl's tree, on the other side of the trunk from the owl.
  const st = owlTree;
  const sTop = MODELS[st.model].h * st.scale * 0.72;
  const spiders = [0, 1, 2].map((i) => ({ x: st.x - 2.0 + i * 0.85, topY: sTop - i * 0.1, z: st.z + 1.7 + i * 0.3, drop: [1.5, 2.1, 1.1][i]!, seed: i + 1 }));
  // Cobwebs hang between neighbouring gravestones, in view of the camera.
  const inView = (x: number, z: number) => 16 - z > 8 && Math.abs(x - 0.5) < 0.5 * (16 - z);
  const rowGraves = placements.filter((p) => p.group === 'oldGrave' && inView(p.x, p.z)).sort((a, b) => a.z - b.z || a.x - b.x);
  const cobwebs: Scenery['cobwebs'] = [];
  const used = new Set<string>();
  for (const a of rowGraves) {
    if (cobwebs.length >= 7) break;
    const b = rowGraves.find((q) => q !== a && !used.has(q.id) && Math.abs(q.z - a.z) < 1.6 && q.x - a.x > 1.7 && q.x - a.x < 5 && q.x * a.x > 0);
    if (!b || used.has(a.id)) continue;
    used.add(a.id);
    used.add(b.id);
    const dx = b.x - a.x;
    cobwebs.push({ x: (a.x + b.x) / 2, y: 0.95, z: (a.z + b.z) / 2 + 0.1, w: dx * 0.95, h: 1.5, rotY: 0 });
  }
  // Will-o'-the-wisps drift between the graves.
  const wisps = Array.from({ length: 14 }, (_, i) => ({ x: (i % 2 ? 1 : -1) * between(3.8, 18), y: between(0.7, 2.4), z: between(-17, 6), seed: i + 1 }));
  const scenery: Scenery = { cat, crows, owl, spiders, mounds, cauldron, openCoffin, wisps, cobwebs };

  // ----- where the floating ghosts hover -----
  const ghostSpots = [
    { x: -5.2, y: 1.7, z: -5.8 },
    { x: 6.4, y: 1.9, z: -9.5 },
    { x: -2.2, y: 1.5, z: -13.5 },
  ];

  return { placements, lights: lights.slice(0, BUDGET.maxPointLights), glows, pathCentres, scenery, ghostSpots, cryptDoor };
}

let cached: Layout | null = null;
/** The one layout the scene uses. */
export function layout(): Layout {
  return (cached ??= buildLayout());
}

/** Full capacity of each data-driven group (Requirement 7). */
export const SLOT_GROUPS = { newGrave: CAPS.newGraves, coffin: CAPS.coffins, candle: CAPS.candles } as const;
