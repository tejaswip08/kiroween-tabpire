// The parts of the Haunted Castle that follow a rule: the courtyard wall that runs out from the fortress on both sides, the
// banners and flags on its towers, the row of torches along the flagstone path, the lit windows on the fortress facade and
// the weights of the cloth that sways. Pure and seeded by nothing but its constants: no three, no browser APIs.
// Coordinates: x right, y up, z toward the camera (the camera is at z = 16).
import { MODELS, type Placement } from '../layout';

// ---------- the fortress ----------

/**
 * How far below y = 0 the lowest point of each file is, as a fraction of its scale (measured from the files). A placement is
 * lifted by this much, so the lowest point sits on the ground (the same as `WINDMILL_FOOT` does for the windmill).
 */
export const CASTLE_FOOT = { castle_fortress: 0.0503, castle_wall_towers: 0.0175, castle_stone_wall: 0.0066 } as const;
/**
 * The fortress stands at the back, facing the camera (its door is in the middle of its front). At this scale it is 19.5 wide and
 * 18 deep; its keep rises to 12 and its corner towers to 9.5. Its back edge is at z = -39.8, inside the ground.
 */
export const FORTRESS = { x: 0.5, y: CASTLE_FOOT.castle_fortress * 9.2, z: -30.8, rotY: 0, scale: 9.2 } as const;
/** The front of the keep, where the door is (its face is 0.5 of the file's depth in front of the middle, see `FACADE_FACES`). */
export const DOOR_Z = FORTRESS.z + 0.5 * FORTRESS.scale;

/** The left corner tower of the fortress (file x of its middle and the height of its top), for the moon. */
export const CORNER_TOWER = { x: FORTRESS.x - 0.85 * FORTRESS.scale, top: 1.03 * FORTRESS.scale, z: FORTRESS.z } as const;

// ---------- the courtyard wall ----------

/** The wall line runs along z = WALL_Z, level with the front of the fortress, and out to this far from the middle line. */
export const WALL_Z = -22.6;
export const WALL_REACH = 29.4;
/** The scale of the gate-tower pieces. The stone walls take the rest of the run, so the two meet with no gap. */
export const TOWER_WALL_SCALE = 6.2;

export type WallModel = 'castle_wall_towers' | 'castle_stone_wall';
export interface WallPiece {
  model: WallModel;
  /** -1 for the left run, 1 for the right run. */
  side: -1 | 1;
  x: number;
  /** The lift that puts the lowest point of the file on the ground. */
  y: number;
  z: number;
  rotY: number;
  scale: number;
  /** The x range the piece covers. */
  x0: number;
  x1: number;
}
/** Where the end towers of a `castle_wall_towers` piece stand, as a fraction of the piece scale from its middle. */
export const END_TOWER = 0.835;

/** The pieces of one run, from the fortress outward: a gate-tower piece, then a stone wall to the edge. Each touches the next. */
export function wallRun(side: -1 | 1): WallPiece[] {
  const fortressEdge = MODELS.castle_fortress.hx * FORTRESS.scale;
  const towerW = 2 * MODELS.castle_wall_towers.hx * TOWER_WALL_SCALE;
  const stoneLen = WALL_REACH - fortressEdge - towerW;
  const stoneScale = stoneLen / (2 * MODELS.castle_stone_wall.hx);
  const mk = (model: WallModel, from: number, len: number, scale: number): WallPiece => {
    const a = FORTRESS.x + side * from;
    const b = FORTRESS.x + side * (from + len);
    return { model, side, x: (a + b) / 2, y: CASTLE_FOOT[model] * scale, z: WALL_Z, rotY: 0, scale, x0: Math.min(a, b), x1: Math.max(a, b) };
  };
  return [mk('castle_wall_towers', fortressEdge, towerW, TOWER_WALL_SCALE), mk('castle_stone_wall', fortressEdge + towerW, stoneLen, stoneScale)];
}
/** Both runs, left first. */
export const wallPieces = (): WallPiece[] => [...wallRun(-1), ...wallRun(1)];

/** The top of a wall piece (a tower end for the gate-tower piece), above the ground. */
export const wallTop = (p: Pick<WallPiece, 'model' | 'scale' | 'y'>): number => p.y + MODELS[p.model].h * p.scale;
/** The x of both end towers of a gate-tower piece. */
export const endTowerXs = (p: WallPiece): [number, number] => [p.x - END_TOWER * p.scale, p.x + END_TOWER * p.scale];

/** A banner stands on the top of each end tower. It is narrower than the tower (the file is 2.4 wide, the tower 0.27 of the piece scale). */
export const BANNER_SCALE = 0.7;
/** A wall flag hangs on the front of each end tower, from just under its top. */
export const FLAG_SCALE = 0.9;
/** How far under the top of the wall the bar of a flag hangs. */
export const FLAG_DROP = 0.3;
/** A flag stands this far off the wall face. */
export const FLAG_GAP = 0.02;

export interface MountSpot {
  x: number;
  y: number;
  z: number;
  scale: number;
  /** The wall piece it stands on or hangs from. */
  hostIndex: number;
}
/** Banners: base on the top of the tower, in the middle of it. One per end tower. */
export function bannerSpots(pieces: readonly WallPiece[] = wallPieces()): MountSpot[] {
  const out: MountSpot[] = [];
  pieces.forEach((p, hostIndex) => {
    if (p.model !== 'castle_wall_towers') return;
    for (const x of endTowerXs(p)) out.push({ x, y: wallTop(p), z: p.z, scale: BANNER_SCALE, hostIndex });
  });
  return out;
}
/**
 * Flags: on the front face of each end tower (the face toward the camera), the bar just under the top. The file has its wall
 * side toward -z and is `recentre`d, so its footprint is centred and its lowest point is at y = 0.
 */
export function flagSpots(pieces: readonly WallPiece[] = wallPieces()): MountSpot[] {
  const out: MountSpot[] = [];
  const flag = MODELS.castle_wall_flag;
  pieces.forEach((p, hostIndex) => {
    if (p.model !== 'castle_wall_towers') return;
    const face = p.z + MODELS[p.model].hz * p.scale;
    for (const x of endTowerXs(p)) {
      out.push({ x, y: wallTop(p) - FLAG_DROP - flag.h * FLAG_SCALE, z: face + FLAG_GAP + flag.hz * FLAG_SCALE, scale: FLAG_SCALE, hostIndex });
    }
  });
  return out;
}

// ---------- the path and the torches ----------

/** The flagstone path runs straight along x = FORTRESS.x from the front of the screen to the keep door. */
export const PATH = { x: FORTRESS.x, from: 12.5, to: DOOR_Z, halfWidth: 1.6 } as const;
/** The torch rows (z), nearest first. The torches stand this far from the middle line of the path, one on each side. */
export const TORCH_ROWS: readonly number[] = [4, -1, -5.5, -10, -14, -18];
export const TORCH_OFFSET = 2.9;
/** The three rows farthest from the camera hold the real lights (two each); every torch has a glow flame. */
export const LIT_ROWS: readonly number[] = [-10, -14, -18];
/** Torches in the near foreground stay low so they do not rise into the cards; farther ones are bigger so they read. */
export const torchScale = (z: number): number => (z > 2 ? 0.9 : 1.6);

export interface TorchSlot {
  x: number;
  z: number;
  scale: number;
  side: -1 | 1;
  /** True when the torch holds one of the scene's real point lights. */
  lit: boolean;
}
export function torchRow(): TorchSlot[] {
  const out: TorchSlot[] = [];
  for (const z of TORCH_ROWS) {
    for (const side of [-1, 1] as const) out.push({ x: PATH.x + side * TORCH_OFFSET, z, scale: torchScale(z), side, lit: LIT_ROWS.includes(z) });
  }
  return out;
}
/** The top of a torch: where its flame glow burns and where the embers rise from. */
export const torchTop = (p: { x: number; z: number; scale: number }): { x: number; y: number; z: number } => ({
  x: p.x,
  y: MODELS.castle_torch.h * p.scale,
  z: p.z,
});

// ---------- the windows ----------

/** A flat patch of the fortress facade (the left half; the right half is its mirror). File units, measured from the file by ray casting. */
export interface FacadeFace {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  /** Front of the facade here, in file units (the wall faces +z). */
  z: number;
}
export const FACADE_FACES = {
  /** The lower body of the corner tower. */
  tower: { x0: -1.0, x1: -0.8, y0: 0.13, y1: 0.58, z: 0.93 },
  /** The low curtain wall between the corner tower and the gate towers. */
  curtain: { x0: -0.75, x1: -0.45, y0: 0.13, y1: 0.43, z: 0.865 },
  /** The gate tower beside the door. */
  gate: { x0: -0.4, x1: -0.2, y0: 0.13, y1: 0.58, z: 0.92 },
  /** The front of the keep, either side of the door. */
  keep: { x0: -0.1, x1: 0.1, y0: 0.5, y1: 0.7, z: 0.47 },
  /** The upper wall of the keep. */
  upper: { x0: -0.3, x1: -0.15, y0: 0.9, y1: 1.05, z: 0.32 },
  /** The top of the keep. */
  top: { x0: -0.1, x1: 0.1, y0: 1.08, y1: 1.18, z: 0.18 },
} as const satisfies Record<string, FacadeFace>;
export type FaceName = keyof typeof FACADE_FACES;
export interface WindowSpec {
  face: FaceName;
  /** Middle of the window in file units (left half). */
  lx: number;
  ly: number;
  w: number;
  h: number;
}
export const WINDOWS: readonly WindowSpec[] = [
  { face: 'tower', lx: -0.9, ly: 0.22, w: 0.07, h: 0.1 },
  { face: 'tower', lx: -0.9, ly: 0.42, w: 0.07, h: 0.1 },
  { face: 'curtain', lx: -0.66, ly: 0.28, w: 0.06, h: 0.1 },
  { face: 'curtain', lx: -0.54, ly: 0.28, w: 0.06, h: 0.1 },
  { face: 'gate', lx: -0.3, ly: 0.22, w: 0.06, h: 0.1 },
  { face: 'gate', lx: -0.3, ly: 0.42, w: 0.06, h: 0.1 },
  { face: 'keep', lx: -0.05, ly: 0.6, w: 0.04, h: 0.08 },
  { face: 'upper', lx: -0.225, ly: 0.98, w: 0.06, h: 0.1 },
  { face: 'top', lx: -0.05, ly: 1.13, w: 0.04, h: 0.08 },
];
/** A window quad stands this far (file units) in front of the facade, so it never sinks into it. */
export const WINDOW_LIFT = 0.006;

export interface WindowQuad {
  face: FaceName;
  /** Middle of the quad, in the world. */
  x: number;
  y: number;
  z: number;
  /** Size in the world. */
  w: number;
  h: number;
  rotY: number;
}
/** The lit windows on the facade of a fortress placement: each window of the table and its mirror on the other half. */
export function facadeWindows(f: Pick<Placement, 'x' | 'y' | 'z' | 'rotY' | 'scale'>): WindowQuad[] {
  const c = Math.cos(f.rotY);
  const s = Math.sin(f.rotY);
  const out: WindowQuad[] = [];
  for (const spec of WINDOWS) {
    const face = FACADE_FACES[spec.face];
    for (const mirror of [1, -1]) {
      const lx = spec.lx * mirror;
      const lz = face.z + WINDOW_LIFT;
      // The file turns about y like the placement does (three's rotation: x' = x cos + z sin, z' = -x sin + z cos).
      out.push({
        face: spec.face,
        x: f.x + (lx * c + lz * s) * f.scale,
        y: f.y + spec.ly * f.scale,
        z: f.z + (-lx * s + lz * c) * f.scale,
        w: spec.w * f.scale,
        h: spec.h * f.scale,
        rotY: f.rotY,
      });
    }
  }
  return out;
}
/** Triangles and draw calls of the windows: one quad each, one instanced mesh. */
export const windowTris = (quads: readonly WindowQuad[]): number => quads.length * 2;

// ---------- the cloth that sways ----------

/** Which material of a file is the cloth, and how far (file units) its free end swings. */
export const SWAY_CLOTH = {
  castle_banner: { material: 'Main', amplitude: 0.08 },
  castle_wall_flag: { material: 'Flag', amplitude: 0.07 },
} as const;
export type SwayModel = keyof typeof SWAY_CLOTH;
export const isSwayModel = (id: string): id is SwayModel => id in SWAY_CLOTH;

/**
 * The sway weight of each vertex of a hanging cloth: 0 at its top edge (it hangs there), growing smoothly to `amplitude` at the
 * free end. `ys` are the heights of the vertices and `top` and `bottom` the heights of the cloth's top and bottom.
 */
export function swayWeights(ys: ArrayLike<number>, top: number, bottom: number, amplitude: number): Float32Array {
  const out = new Float32Array(ys.length);
  const span = Math.max(top - bottom, 1e-6);
  for (let i = 0; i < ys.length; i++) {
    const t = Math.min(1, Math.max(0, (top - ys[i]!) / span));
    out[i] = amplitude * t * Math.sqrt(t);
  }
  return out;
}

// ---------- the sky ----------

/** The seed of the lightning schedule. */
export const LIGHTNING_SEED = 7547;
/** The lit windows are above the bloom threshold (0.95); each channel is HDR. */
export const WINDOW_COLOR: readonly [number, number, number] = [3.4, 2.5, 0.5];

/** Everything the scene draws itself for the castle, kept in the spec so the scene and the tests read the same numbers. */
export interface CastleParts {
  windows: WindowQuad[];
  /** The wall pieces, left run first, and the torches (tops) in the order of the embers. */
  walls: WallPiece[];
  torches: { x: number; y: number; z: number }[];
  lightningSeed: number;
}
