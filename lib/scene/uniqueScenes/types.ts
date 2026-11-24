// The data of a unique theme scene, and the pure helpers that build and check one. No three, no browser APIs.
// A unique scene is a spec: its placements, ground, path, moon, lights, weather and the shared layers it turns on.
// `lib/scene/themeLayout.ts` turns a spec into the `ThemeScene` the shared components read.
import { cameraAt, project } from '../camera';
import { BUDGET } from '../config';
import {
  FLAT_GROUPS, MODELS, corners, cutByScreenEdge, footprintOf, footprintsOverlap, insideGround,
  type Footprint, type Group, type Layout, type ModelId, type Placement, type Scenery, type WarmSource,
} from '../layout';
import { mulberry32 } from '../rng';
import type { BloodParts } from './bloodmoonParts';
import type { CastleParts } from './castleParts';
import type { AutumnPlan } from './autumn';
import type { Icicle, Mound } from './frostIce';
import type { FrostAttached, FrostPlan } from './frostPlan';
import type { ForestParts } from './forestParts';
import { moonScreenRadiusScaled } from '../sky';
import type { WeatherSpec } from '../weather';
import type { ThemeId } from '../../themes';

/** The window shapes the view rules are checked at. */
export const VIEW_ASPECTS: readonly number[] = [16 / 10, 16 / 9, 21 / 9];
/** A placement closer than this (camera depth) is "near". */
export const NEAR_DEPTH = 13;
/** Screen band (y from the top) where the cards start. The centrepiece must rise above it. */
export const CARD_BAND_Y = 0.46;
/** Near props that stand in the middle of the screen must end below this line (y from the top). */
export const NEAR_TOP_Y = 0.5;
export const CENTRE_X: readonly [number, number] = [0.25, 0.75];
export const CENTRE_INSIDE_X: readonly [number, number] = [0.02, 0.98];
export const NEAR_MIDDLE_X: readonly [number, number] = [0.12, 0.88];

export type GroundKind = 'earth' | 'grass' | 'moss' | 'snow' | 'rock' | 'flagstone';
export type PathKind = 'dirt' | 'moss' | 'flagstone' | 'snow' | 'none';
export type SkyFeature = 'aurora' | 'lightning';

export interface UniqueMoon {
  /** Where the moon should appear on screen (0 to 1, y from the top) for a window shape. */
  target(aspect: number): { x: number; y: number };
  /** Disc size, 1 is the Crypt's. */
  scale: number;
  /**
   * The centrepiece group (placements of group `centre`) may stand in front of the moon on purpose (Blood Moon). Everything
   * else must still keep clear of the disc.
   */
  inFront?: boolean;
  /** A crisp disc: sharp surface patches and no wide halo in the sky around it (the Pumpkin Patch's harvest moon). */
  crisp?: boolean;
  /**
   * No disc is drawn (the Witch's Forest: the light of a fire, no moon). The aim still gives the direction of the key light
   * and the glow in the sky, but nothing can stand over a moon that is not there.
   */
  hidden?: boolean;
  /** The disc is drawn, but dark trees may stand over it (their branches cross it). */
  seeThrough?: boolean;
}
export interface UniqueGround {
  kind: GroundKind;
}
export interface UniquePath {
  kind: PathKind;
  /** Points along the centre line, about 1.5 apart (see `sampleLine`). Empty for no path. */
  centre: { x: number; z: number }[];
  /** Half the width of the track. */
  halfWidth: number;
}
/** Which generic layers the theme turns on. */
export interface UniqueLayers {
  clouds: boolean;
  witch: boolean;
  /** 0 turns the bats off; 1 is the Crypt's flock; more is a bigger flock. */
  bats: number;
  ghosts: boolean;
  mist: boolean;
  embers: boolean;
  /** False draws no moon disc. Missing is true. */
  moon?: boolean;
  /** A colour (hex) the ghosts are tinted instead of the theme's ghost colour (Frozen Cemetery: icy blue). Missing keeps the palette. */
  ghostTint?: string;
}
/** An upper bound for the triangles and draw calls of the theme's own parts (scarecrow, path, ground, snow mounds). */
export interface UniqueExtras {
  tris: number;
  calls: number;
}

export interface UniqueSceneSpec {
  id: ThemeId;
  seed: number;
  /** The placement that makes the theme recognisable, and the ids of every placement that forms it. */
  centrepiece: { placement: Placement; ids: string[] };
  /** Every model placement (group `themed` or `centre`), each drawn with `SafeModelBatch`, one batch per model. */
  placements: Placement[];
  /** Footprints of things the scene draws itself (a scarecrow). Placements keep clear of them. */
  reserved: Footprint[];
  /** The unique models with a file: what the gate loader and the idle preload fetch. */
  models: ModelId[];
  ground: UniqueGround;
  path: UniquePath;
  moon: UniqueMoon;
  sky: SkyFeature[];
  /** The real point lights, at most `BUDGET.maxPointLights`. */
  lights: WarmSource[];
  /** Every glowing thing (flames, windows, glowing mushrooms), for glow pools and flame glows. */
  glows: WarmSource[];
  /** Where weather embers rise (torch tops). */
  anchors: { x: number; y: number; z: number }[];
  ghostSpots: { x: number; y: number; z: number }[];
  weather: WeatherSpec | null;
  layers: UniqueLayers;
  extras: UniqueExtras;
  /**
   * Placements that are deliberately sunk into the ground (gravestones stuck in the ice): id to how far below y = 0 the foot goes.
   * Only these may stand below the ground, and never deeper than the theme's documented maximum (`MAX_SINK` in `frostIce.ts`).
   */
  sunk?: Record<string, number>;
  /** The ice of the Frozen Cemetery: the ids of the gravestones in the lake, the icicles under their tops and the snow mounds. */
  ice?: { stones: string[]; icicles: Icicle[]; mounds: Mound[] };
  /** The Frozen Cemetery's own parts: the chapel, the graveyard, the ice pillars, the wolves and what hangs from the dead trees. */
  frost?: { plan: FrostPlan; attached: FrostAttached };
  /**
   * Placements that stand on a platform the scene draws itself (the Blood Moon ruins): id to the height of the platform top.
   * Their lowest point is that high above y = 0, not on the ground.
   */
  raised?: Record<string, number>;
  /** The parts the Blood Moon draws itself: the stepped platform under the ruins and the lava cracks. */
  blood?: BloodParts;
  /** The parts the Witch's Forest draws itself: the face on the haunted tree, the fire, the scarecrows, the ghosts, the graves and the grass. */
  forest?: ForestParts;
  /** The Pumpkin Patch's autumn lane: the big tree, the trick-or-treaters, the dry corn, the fence, the grass and the leaves. */
  autumn?: AutumnPlan;
  /**
   * Placements that stand on or hang from another placement (a banner on a tower, a flag on a wall): id to the id of the one they are
   * fixed to. They overlap that one on purpose, and sit on it (listed in `raised`), so the overlap and grounding checks skip the pair.
   */
  mounted?: Record<string, string>;
  /** The parts the Haunted Castle draws itself or lays out by rule: the lit windows, the wall pieces, the torch tops and the lightning seed. */
  castle?: CastleParts;
  /** Multiplies the depth fog density (the memory factor still applies on top). Missing is 1, the Crypt's fog. */
  fogScale?: number;
}

export type UniqueSceneBuilder = (seed: number) => UniqueSceneSpec;

// ---------- shared pure helpers ----------

export const hasFile = (id: ModelId): boolean => MODELS[id].source !== 'procedural';

/** The unique models of some placements that have a file, in first-use order. */
export const modelsOf = (placements: readonly Placement[]): ModelId[] => [...new Set(placements.map((p) => p.model))].filter(hasFile);

const NO_SCENERY: Scenery = {
  cat: { x: 0, y: 0, z: 0, rotY: 0 },
  crows: [],
  owl: { x: 0, y: 0, z: 0, rotY: 0, branch: [0, 0, 0, 0, 0, 0] },
  spiders: [],
  mounds: [],
  cauldron: { x: 0, y: 0, z: 0 },
  openCoffin: { x: 0, z: 0, rotY: 0 },
  wisps: [],
  cobwebs: [],
};

/** The `Layout` the shared components read. It has no Crypt things: no crypt door, no scenery, no data slots. */
export function layoutOf(spec: UniqueSceneSpec): Layout {
  return {
    placements: spec.placements,
    lights: spec.lights.slice(0, BUDGET.maxPointLights),
    glows: spec.glows,
    pathCentres: spec.path.centre,
    scenery: NO_SCENERY,
    ghostSpots: spec.ghostSpots,
    cryptDoor: { x: 0, y: 0, z: 0, rotY: 0 },
  };
}

/** Points about `step` apart along a polyline, with the direction of the line at each point. */
export function sampleLine(points: readonly (readonly [number, number])[], step = 1.5): { x: number; z: number; dx: number; dz: number }[] {
  const out: { x: number; z: number; dx: number; dz: number }[] = [];
  let carry = 0;
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1]!;
    const [bx, bz] = points[i]!;
    const len = Math.hypot(bx - ax, bz - az);
    if (len === 0) continue;
    const dx = (bx - ax) / len;
    const dz = (bz - az) / len;
    for (let s = carry; s < len; s += step) out.push({ x: ax + dx * s, z: az + dz * s, dx, dz });
    carry = ((carry - len) % step + step) % step;
  }
  const last = points[points.length - 1];
  const prev = out[out.length - 1];
  if (last && prev) out.push({ x: last[0], z: last[1], dx: prev.dx, dz: prev.dz });
  return out;
}

/** Distance from a point to the nearest centre-line point. */
export const distToPath = (centres: readonly { x: number; z: number }[], x: number, z: number): number =>
  centres.reduce((m, c) => Math.min(m, Math.hypot(c.x - x, c.z - z)), Infinity);

/** Trunk radius (half the footprint) of the twisted trees, per unit of scale. Their crowns are far wider and are meant to tangle. */
export const TRUNK_RADIUS = 1.45;
export const isTwistedTree = (p: Placement): boolean => p.model.startsWith('forest_twisted');
/**
 * The footprint two placements must not share. For most props it is the footprint of the model. A twisted tree is
 * checked by its trunk only: the crowns of neighbouring trees reach into each other on purpose (the tunnel of branches).
 */
export function solidFootprint(p: Placement): Footprint {
  if (!isTwistedTree(p)) return footprintOf(p);
  const r = TRUNK_RADIUS * p.scale;
  return { x: p.x, z: p.z, hx: r, hz: r, rotY: 0 };
}

export interface View {
  /** Camera depth of the middle of the base. */
  depth: number;
  /** Screen x of the middle of the model (half way up). */
  cx: number;
  left: number;
  right: number;
  /** Screen y (from the top) of the highest point, and of the lowest. */
  top: number;
  bottom: number;
}

/** Where a placement appears on screen at the rest camera, or null if part of it is behind the camera. */
export function viewOf(p: Placement, aspect: number): View | null {
  const cam = cameraAt(0, aspect, true);
  const info = MODELS[p.model];
  const h = info.h * p.scale;
  const mid = project([p.x, 0, p.z], cam);
  const centre = project([p.x, h / 2, p.z], cam);
  if (!mid || !centre) return null;
  let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
  for (const [x, z] of corners(footprintOf(p))) {
    for (const y of [p.y, p.y + h]) {
      const q = project([x, y, z], cam);
      if (!q) return null;
      left = Math.min(left, q.x);
      right = Math.max(right, q.x);
      top = Math.min(top, q.y);
      bottom = Math.max(bottom, q.y);
    }
  }
  return { depth: mid.depth, cx: centre.x, left, right, top, bottom };
}

/** The view rules (unique-scenes contract) that a placement breaks, as short messages. Empty when it is fine. */
export function viewViolations(p: Placement, isCentrepiece: boolean, aspects: readonly number[] = VIEW_ASPECTS): string[] {
  const out: string[] = [];
  for (const aspect of aspects) {
    const v = viewOf(p, aspect);
    const tag = `aspect ${aspect.toFixed(2)}`;
    if (!v) {
      out.push(`${tag}: behind the camera`);
      continue;
    }
    if (isCentrepiece) {
      if (v.cx < CENTRE_X[0] || v.cx > CENTRE_X[1]) out.push(`${tag}: centre x ${v.cx.toFixed(2)}`);
      if (v.top >= CARD_BAND_Y) out.push(`${tag}: top y ${v.top.toFixed(2)} is not above the cards`);
      if (v.left < CENTRE_INSIDE_X[0] || v.right > CENTRE_INSIDE_X[1]) out.push(`${tag}: spans x ${v.left.toFixed(2)} to ${v.right.toFixed(2)}`);
    }
    if (v.depth < NEAR_DEPTH) {
      if (v.cx >= NEAR_MIDDLE_X[0] && v.cx <= NEAR_MIDDLE_X[1] && v.top < NEAR_TOP_Y) out.push(`${tag}: near prop rises to y ${v.top.toFixed(2)}`);
    }
  }
  if (cutByScreenEdge(p)) out.push('cut by the screen edge');
  return out;
}

/**
 * True when the top of a tall prop would stand over the moon (the disc and a margin) on screen. Scales with the moon.
 * A moon with `inFront` lets the placements of group `centre` stand in front of it; every other placement is still checked.
 */
export function blocksMoonFor(p: Placement, moon: UniqueMoon, aspects: readonly number[] = VIEW_ASPECTS): boolean {
  if (moon.hidden || moon.seeThrough) return false;
  if (moon.inFront && p.group === 'centre') return false;
  const info = MODELS[p.model];
  const height = info.h * p.scale;
  if (height < 2.5) return false;
  const pad = Math.max(info.hx, info.hz) * p.scale;
  for (const aspect of aspects) {
    const cam = cameraAt(0, aspect, true);
    const t = moon.target(aspect);
    const r = moonScreenRadiusScaled(aspect, moon.scale).disc * 1.5;
    for (const dy of [1, 0.75, 0.5, 0.25]) {
      const pt = project([p.x, p.y + height * dy, p.z], cam);
      if (!pt) continue;
      // Screen distance in window-height units; `pad` is about as wide as the prop on screen.
      const padScreen = pad / (pt.depth * Math.tan((cam.fov * Math.PI) / 360) * 2);
      if (Math.hypot((pt.x - t.x) * aspect, pt.y - t.y) < r + padScreen) return true;
    }
  }
  return false;
}

// ---------- seeded placement ----------

export interface PlaceOptions {
  /** Gap kept between footprints. Default 0.15. */
  margin?: number;
  /** The prop may stand on the path (a fence runs along it, a lantern stands on it). */
  onPath?: boolean;
  /** Skip the moon check (a prop that is short, or stands in front on purpose). */
  anyMoon?: boolean;
  /** Placements this one is fixed to (a banner on its tower): the overlap check skips them. */
  on?: readonly Placement[];
}
export interface PlacerOptions {
  id: ThemeId;
  seed: number;
  moon: UniqueMoon;
  /** Path centre points and half width; props keep `PATH_CLEARANCE` plus their own reach away. */
  path: { centre: readonly { x: number; z: number }[]; halfWidth: number };
}
export const PATH_CLEARANCE = 0.5;

/**
 * Collects placements one by one. Each placement is tried against the same rules the tests check: inside the ground,
 * clear of the path, no overlap with a solid prop or a reserved footprint, not over the moon, and the view rules.
 * Everything uses one seeded stream, so the same seed gives the same scene.
 */
export class Placer {
  readonly placements: Placement[] = [];
  readonly reserved: Footprint[] = [];
  readonly rng: () => number;
  private counter = 0;
  constructor(private readonly o: PlacerOptions) {
    this.rng = mulberry32(o.seed);
  }
  between = (lo: number, hi: number): number => lo + (hi - lo) * this.rng();
  pick = <T,>(list: readonly T[]): T => list[Math.floor(this.rng() * list.length) % list.length]!;

  make(model: ModelId, group: Group, x: number, z: number, rotY: number, scale: number, y = 0): Placement {
    return { id: `${this.o.id}-${model}-${this.counter++}`, model, group, x, y, z, rotY, scale };
  }
  /** Keeps a footprint free (a procedural prop). */
  reserve(f: Footprint): void {
    this.reserved.push(f);
  }
  /** Why a placement does not fit, or null when it does. */
  problem(p: Placement, opts: PlaceOptions = {}, isCentrepiece = false): string | null {
    if (!insideGround(footprintOf(p))) return 'outside the ground';
    const f = solidFootprint(p);
    if (!opts.onPath && distToPath(this.o.path.centre, p.x, p.z) < this.o.path.halfWidth + PATH_CLEARANCE + Math.max(f.hx, f.hz)) return 'on the path';
    const margin = opts.margin ?? 0.15;
    for (const q of this.placements) {
      if (opts.on?.includes(q)) continue;
      if (!FLAT_GROUPS.includes(q.group) && footprintsOverlap(f, solidFootprint(q), margin)) return `overlaps ${q.id}`;
    }
    for (const r of this.reserved) if (footprintsOverlap(f, r, margin)) return 'overlaps a reserved footprint';
    if (!opts.anyMoon && blocksMoonFor(p, this.o.moon)) return 'over the moon';
    const view = viewViolations(p, isCentrepiece);
    if (view.length) return view[0]!;
    return null;
  }
  /** Adds the placement when it fits. */
  tryAdd(p: Placement, opts: PlaceOptions = {}, isCentrepiece = false): Placement | null {
    const why = this.problem(p, opts, isCentrepiece);
    if (why) {
      this.counter--;
      return null;
    }
    this.placements.push(p);
    return p;
  }
  /** A placement that must fit: a bad number fails the tests at once. */
  fixed(p: Placement, opts: PlaceOptions = {}, isCentrepiece = false): Placement {
    const why = this.problem(p, opts, isCentrepiece);
    if (why) throw new Error(`Fixed ${this.o.id} prop ${p.model} at ${p.x},${p.z}: ${why}`);
    this.placements.push(p);
    return p;
  }
  /** Up to `count` random props of one model; each tries `tries` spots and is dropped if none fits. Returns what was placed. */
  scatter(
    model: ModelId,
    group: Group,
    count: number,
    region: () => { x: number; z: number; rotY?: number; scale?: number; y?: number },
    opts: PlaceOptions = {},
    tries = 60,
  ): Placement[] {
    const out: Placement[] = [];
    for (let n = 0; n < count; n++) {
      for (let t = 0; t < tries; t++) {
        const r = region();
        const p = this.tryAdd(this.make(model, group, r.x, r.z, r.rotY ?? this.between(0, Math.PI * 2), r.scale ?? 1, r.y ?? 0), opts);
        if (p) {
          out.push(p);
          break;
        }
      }
    }
    return out;
  }
}
