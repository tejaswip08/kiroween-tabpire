// The Haunted Castle (.kiro/specs/themes/unique-scenes.md, brief 5): the pure helpers that lay it out (the courtyard wall, the
// banners and flags on it, the torch row along the path, the lit windows on the fortress facade, the cloth sway weights) and
// the soft lightning schedule. Where a rule depends on a file (the facade, the cloth part) it is checked against the real model.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { Box3, Matrix4, MeshStandardMaterial, Raycaster, Vector3, type Mesh, type Object3D } from 'three';
import { buildBatches } from '../entrypoints/newtab/layers/scene/ModelBatch';
import { applySway, makeSwayMaterial, swayGeometry, type SwayClock } from '../entrypoints/newtab/layers/scene/themes/swayBuild';
import { BUDGET, LOOK } from '../lib/scene/config';
import { MODELS, type Placement } from '../lib/scene/layout';
import { FLASH_BOOST, FLASH_LENGTH, LIGHTNING, flashShape, flashTimes, lightningAt } from '../lib/scene/lightning';
import { themeScene } from '../lib/scene/themeLayout';
import { LAYOUT_SEED } from '../lib/scene/layout';
import { buildHauntedCastle, CASTLE_MOON, CASTLE_MOON_SCALE, MOON_OVER_TOWER } from '../lib/scene/uniqueScenes/castle';
import {
  BANNER_SCALE, CASTLE_FOOT, CORNER_TOWER, DOOR_Z, END_TOWER, FACADE_FACES, FLAG_DROP, FLAG_SCALE, FORTRESS, LIGHTNING_SEED, LIT_ROWS, PATH, SWAY_CLOTH, TORCH_OFFSET,
  TORCH_ROWS, WALL_REACH, WALL_Z, WINDOWS, WINDOW_COLOR, WINDOW_LIFT, bannerSpots, endTowerXs, facadeWindows, flagSpots, torchRow, torchTop, wallPieces, wallRun,
  wallTop, swayWeights,
} from '../lib/scene/uniqueScenes/castleParts';
import { VIEW_ASPECTS } from '../lib/scene/uniqueScenes/types';
import { cameraAt, project } from '../lib/scene/camera';
import { moonScreenRadiusScaled } from '../lib/scene/sky';
import { loadGlbGeometry } from './helpers/glb';

const spec = buildHauntedCastle(LAYOUT_SEED);
const count = (m: string) => spec.placements.filter((p) => p.model === m);

// ---------- lightning ----------

describe('lightning schedule', () => {
  const seeds = fc.integer({ min: 1, max: 1_000_000 });
  it('is rare: a flash every 8 to 20 seconds, the first one included', () => {
    fc.assert(
      fc.property(seeds, (seed) => {
        const times = flashTimes(seed, 1200);
        expect(times[0]!).toBeGreaterThanOrEqual(LIGHTNING.minGap);
        expect(times[0]!).toBeLessThanOrEqual(LIGHTNING.maxGap);
        for (let i = 1; i < times.length; i++) {
          const gap = times[i]! - times[i - 1]!;
          expect(gap).toBeGreaterThanOrEqual(LIGHTNING.minGap);
          expect(gap).toBeLessThanOrEqual(LIGHTNING.maxGap);
        }
        // 1200 seconds hold at least 1200 / 20 - 1 and at most 1200 / 8 flashes.
        expect(times.length).toBeGreaterThanOrEqual(59);
        expect(times.length).toBeLessThanOrEqual(150);
      }),
      { numRuns: 20 },
    );
  });
  it('is deterministic: the same seed gives the same flashes, whatever order the times are asked in', () => {
    fc.assert(
      fc.property(seeds, fc.array(fc.double({ min: 0, max: 900, noNaN: true }), { minLength: 5, maxLength: 30 }), (seed, ts) => {
        const forward = ts.map((t) => lightningAt(t, seed));
        const backward = [...ts].reverse().map((t) => lightningAt(t, seed)).reverse();
        expect(backward).toEqual(forward);
        expect(flashTimes(seed, 300)).toEqual(flashTimes(seed, 300));
      }),
      { numRuns: 20 },
    );
    expect(flashTimes(1, 300)).not.toEqual(flashTimes(2, 300));
  });
  it('is soft: always from 0 to 1, a short rise, a slower fall, no jumps and no overlapping flashes', () => {
    expect(LIGHTNING.rise).toBeLessThan(LIGHTNING.fall);
    expect(FLASH_LENGTH).toBeLessThan(LIGHTNING.minGap);
    fc.assert(
      fc.property(seeds, (seed) => {
        let last = 0;
        let lit = 0;
        let steps = 0;
        for (let t = 0; t <= 400; t += 1 / 60) {
          const f = lightningAt(t, seed);
          expect(f).toBeGreaterThanOrEqual(0);
          expect(f).toBeLessThanOrEqual(1);
          // No frame changes the brightness by more than a fifth: never a strobe.
          expect(Math.abs(f - last)).toBeLessThanOrEqual(0.2);
          last = f;
          if (f > 0.02) lit++;
          steps++;
        }
        // Lit for less than a fifth of the time.
        expect(lit / steps).toBeLessThan(0.2);
      }),
      { numRuns: 6 },
    );
    // The shape: it reaches its peak, then falls back to nothing, and the fall takes longer than the rise.
    expect(flashShape(LIGHTNING.rise, 0.8)).toBeCloseTo(0.8, 9);
    expect(flashShape(0, 0.8)).toBe(0);
    expect(flashShape(FLASH_LENGTH, 0.8)).toBe(0);
    expect(flashShape(LIGHTNING.rise / 2, 1)).toBeGreaterThan(0.3);
    expect(flashShape(LIGHTNING.rise + LIGHTNING.fall / 2, 1)).toBeLessThan(0.3);
  });
  it('flashes at the times it lists, with a peak above the weakest allowed', () => {
    for (const start of flashTimes(LIGHTNING_SEED, 200)) {
      const peak = lightningAt(start + LIGHTNING.rise, LIGHTNING_SEED);
      expect(peak).toBeGreaterThanOrEqual(LIGHTNING.minPeak - 1e-9);
      expect(peak).toBeLessThanOrEqual(LIGHTNING.maxPeak + 1e-9);
      expect(lightningAt(start - 0.01, LIGHTNING_SEED)).toBe(0);
      expect(lightningAt(start + FLASH_LENGTH + 0.01, LIGHTNING_SEED)).toBe(0);
    }
  });
  it('is never on with reduced motion', () => {
    fc.assert(
      fc.property(seeds, fc.double({ min: 0, max: 5000, noNaN: true }), (seed, t) => {
        expect(lightningAt(t, seed, true)).toBe(0);
      }),
      { numRuns: 100 },
    );
    for (const start of flashTimes(LIGHTNING_SEED, 100)) expect(lightningAt(start + LIGHTNING.rise, LIGHTNING_SEED, true)).toBe(0);
  });
  it('only changes brightness: the boosts are small colour and intensity factors, never geometry', () => {
    for (const k of [...FLASH_BOOST.sky, ...FLASH_BOOST.cloud]) expect(k).toBeLessThan(0.6);
    expect(FLASH_BOOST.hemisphere).toBeLessThanOrEqual(2);
    expect(FLASH_BOOST.moonlight).toBeLessThanOrEqual(2);
    expect(spec.sky).toEqual(['lightning']);
    expect(spec.castle!.lightningSeed).toBe(LIGHTNING_SEED);
  });
});

// ---------- the windows ----------

describe('lit windows on the facade', () => {
  const fortress = spec.centrepiece.placement;
  const quads = spec.castle!.windows;
  it('has a window for each entry of the table and its mirror', () => {
    expect(quads).toHaveLength(WINDOWS.length * 2);
    expect(quads.length).toBeGreaterThanOrEqual(12);
    expect(spec.extras.tris).toBeGreaterThanOrEqual(quads.length * 2);
  });
  it('puts every window in front of the facade, inside the fortress and inside its face, for any placement of the fortress', () => {
    const place = fc.record({
      x: fc.double({ min: -5, max: 5, noNaN: true }),
      z: fc.double({ min: -35, max: -25, noNaN: true }),
      rotY: fc.double({ min: -1, max: 1, noNaN: true }),
      scale: fc.double({ min: 5, max: 12, noNaN: true }),
    });
    fc.assert(
      fc.property(place, ({ x, z, rotY, scale }) => {
        const f = { x, y: 0, z, rotY, scale };
        const c = Math.cos(rotY);
        const s = Math.sin(rotY);
        for (const q of facadeWindows(f)) {
          // Back to the file's own space.
          const dx = q.x - x;
          const dz = q.z - z;
          const lx = (dx * c - dz * s) / scale;
          const lz = (dx * s + dz * c) / scale;
          const face = FACADE_FACES[q.face];
          expect(lz).toBeCloseTo(face.z + WINDOW_LIFT, 9);
          expect(lx - q.w / scale / 2).toBeGreaterThanOrEqual(Math.min(face.x0, -face.x1) - 1e-9);
          expect(lx + q.w / scale / 2).toBeLessThanOrEqual(Math.max(face.x1, -face.x0) + 1e-9);
          expect(q.y / scale - q.h / scale / 2).toBeGreaterThanOrEqual(face.y0 - 1e-9);
          expect(q.y / scale + q.h / scale / 2).toBeLessThanOrEqual(face.y1 + 1e-9);
          expect(Math.abs(lx)).toBeLessThanOrEqual(MODELS.castle_fortress.hx);
          expect(q.y).toBeLessThan(MODELS.castle_fortress.h * scale);
          expect(q.rotY).toBe(rotY);
        }
      }),
      { numRuns: 30 },
    );
  });
  it('mirrors the left half on the right, and the windows do not overlap each other', () => {
    for (const q of quads) {
      const mirror = quads.find((o) => o !== q && o.face === q.face && Math.abs(o.y - q.y) < 1e-9 && Math.abs(o.x - (2 * fortress.x - q.x)) < 1e-9);
      expect(mirror, `${q.face} at ${q.x}`).toBeDefined();
    }
    for (let i = 0; i < quads.length; i++) {
      for (let j = i + 1; j < quads.length; j++) {
        const a = quads[i]!;
        const b = quads[j]!;
        const apart = Math.abs(a.x - b.x) >= (a.w + b.w) / 2 || Math.abs(a.y - b.y) >= (a.h + b.h) / 2;
        expect(apart, `${i} ${j}`).toBe(true);
      }
    }
  });
  it('is above the bloom threshold, so the windows glow', () => {
    const luma = 0.2126 * WINDOW_COLOR[0] + 0.7152 * WINDOW_COLOR[1] + 0.0722 * WINDOW_COLOR[2];
    expect(luma).toBeGreaterThan(LOOK.bloom.threshold);
    // Yellow: red above green above blue.
    expect(WINDOW_COLOR[0]).toBeGreaterThan(WINDOW_COLOR[1]);
    expect(WINDOW_COLOR[1]).toBeGreaterThan(WINDOW_COLOR[2]);
  });
  it('sits on the real facade: a ray from the front hits the file within a few hundredths of the window plane', async () => {
    const { scene } = await loadGlbGeometry('quaternius/castle_fortress.glb');
    scene.updateMatrixWorld(true);
    const meshes: Object3D[] = [];
    scene.traverse((o) => {
      if ((o as Mesh).isMesh) meshes.push(o);
    });
    const ray = new Raycaster();
    for (const w of WINDOWS) {
      const face = FACADE_FACES[w.face];
      // The window's middle and its four corners.
      for (const [dx, dy] of [[0, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
        ray.set(new Vector3(w.lx + (dx * w.w) / 2, w.ly + (dy * w.h) / 2, 3), new Vector3(0, 0, -1));
        const hit = ray.intersectObjects(meshes, false)[0];
        expect(hit, `${w.face} ${w.lx},${w.ly}`).toBeDefined();
        expect(Math.abs(hit!.point.z - face.z), `${w.face} ${w.lx},${w.ly} (${dx},${dy}) hit ${hit!.point.z.toFixed(3)}`).toBeLessThan(0.035);
      }
    }
  });
});

// ---------- the wall ----------

describe('courtyard wall', () => {
  it('runs out from both sides of the fortress with no gap, from its edge to the reach', () => {
    const edge = MODELS.castle_fortress.hx * FORTRESS.scale;
    for (const side of [-1, 1] as const) {
      const run = wallRun(side);
      expect(run.map((p) => p.model)).toEqual(['castle_wall_towers', 'castle_stone_wall']);
      const sorted = [...run].sort((a, b) => (side === 1 ? a.x0 - b.x0 : b.x1 - a.x1));
      const near = side === 1 ? sorted[0]!.x0 : sorted[0]!.x1;
      expect(Math.abs(near - (FORTRESS.x + side * edge))).toBeLessThan(1e-9);
      for (let i = 1; i < sorted.length; i++) {
        const gap = side === 1 ? sorted[i]!.x0 - sorted[i - 1]!.x1 : sorted[i - 1]!.x0 - sorted[i]!.x1;
        expect(Math.abs(gap), `gap on side ${side}`).toBeLessThan(1e-9);
      }
      const far = side === 1 ? sorted[sorted.length - 1]!.x1 : sorted[sorted.length - 1]!.x0;
      expect(Math.abs(far - (FORTRESS.x + side * WALL_REACH))).toBeLessThan(1e-9);
      for (const p of run) expect(p.z).toBe(WALL_Z);
    }
  });
  it('is mirrored about the middle line and stays inside the ground', () => {
    const [l1, l2] = wallRun(-1);
    const [r1, r2] = wallRun(1);
    expect(r1!.scale).toBe(l1!.scale);
    expect(r2!.scale).toBe(l2!.scale);
    expect(r1!.x - FORTRESS.x).toBeCloseTo(FORTRESS.x - l1!.x, 9);
    expect(r2!.x - FORTRESS.x).toBeCloseTo(FORTRESS.x - l2!.x, 9);
    for (const p of wallPieces()) {
      expect(p.x0).toBeGreaterThanOrEqual(-30);
      expect(p.x1).toBeLessThanOrEqual(30);
    }
  });
  it('places the pieces in the scene as the helper says, grouped with the fortress as the centrepiece', () => {
    const walls = spec.placements.filter((p) => p.model === 'castle_wall_towers' || p.model === 'castle_stone_wall');
    expect(walls).toHaveLength(4);
    expect(count('castle_wall_towers')).toHaveLength(2);
    expect(count('castle_stone_wall')).toHaveLength(2);
    for (const w of walls) {
      expect(spec.centrepiece.ids).toContain(w.id);
      expect(w.group).toBe('centre');
      // Lifted so the lowest point of the file stands on the ground.
      expect(w.y).toBeCloseTo(CASTLE_FOOT[w.model as 'castle_wall_towers' | 'castle_stone_wall'] * w.scale, 9);
    }
    expect(spec.castle!.walls).toEqual(wallPieces());
    expect(spec.centrepiece.placement.model).toBe('castle_fortress');
  });
});

describe('banners and flags on the wall', () => {
  const byId = new Map(spec.placements.map((p) => [p.id, p]));
  const banners = count('castle_banner');
  const flags = count('castle_wall_flag');
  it('puts a banner on top of each end tower and a flag on the face of each, as many as there are towers', () => {
    expect(banners).toHaveLength(4);
    expect(flags).toHaveLength(4);
    expect(bannerSpots()).toHaveLength(4);
    expect(flagSpots()).toHaveLength(4);
  });
  it('stands each banner on the top of its tower, in the middle of it, and lists it as mounted and raised', () => {
    const towers = count('castle_wall_towers');
    for (const b of banners) {
      const host = byId.get(spec.mounted![b.id]!)!;
      expect(host.model).toBe('castle_wall_towers');
      expect(towers).toContain(host);
      expect(b.y).toBeCloseTo(host.y + MODELS.castle_wall_towers.h * host.scale, 9);
      expect(spec.raised![b.id]).toBe(b.y);
      expect(b.scale).toBe(BANNER_SCALE);
      expect(b.z).toBe(host.z);
      const piece = wallPieces().find((p) => p.model === 'castle_wall_towers' && Math.abs(p.x - host.x) < 1e-9)!;
      expect(endTowerXs(piece).some((x) => Math.abs(x - b.x) < 1e-9)).toBe(true);
      expect(Math.abs(b.x - host.x)).toBeCloseTo(END_TOWER * host.scale, 9);
      // It stands inside the wall piece, not past its end.
      expect(b.x - MODELS.castle_banner.hx * b.scale).toBeGreaterThanOrEqual(piece.x0 - 0.05);
      expect(b.x + MODELS.castle_banner.hx * b.scale).toBeLessThanOrEqual(piece.x1 + 0.05);
    }
  });
  it('hangs each flag from just under the top of its tower, on the face toward the camera, not inside the wall', () => {
    for (const f of flags) {
      const host = byId.get(spec.mounted![f.id]!)!;
      const top = host.y + MODELS.castle_wall_towers.h * host.scale;
      const flag = MODELS.castle_wall_flag;
      // The bar of the flag is at the top of the model (recentred), FLAG_DROP under the top of the tower.
      expect(f.y + flag.h * f.scale).toBeCloseTo(top - FLAG_DROP, 9);
      expect(f.y).toBeGreaterThan(0);
      expect(f.scale).toBe(FLAG_SCALE);
      // In front of the wall face (z is toward the camera), the back of the flag just off it.
      const face = host.z + MODELS.castle_wall_towers.hz * host.scale;
      expect(f.z - flag.hz * f.scale).toBeGreaterThanOrEqual(face);
      expect(f.z - flag.hz * f.scale - face).toBeLessThan(0.1);
      expect(f.rotY).toBe(0);
      expect(spec.raised![f.id]).toBe(f.y);
      expect(Math.abs(f.x - host.x)).toBeCloseTo(END_TOWER * host.scale, 9);
    }
  });
  it('keeps a stone wall top the lowest part of the run, and wall tops in line with the helper', () => {
    for (const p of wallPieces()) expect(wallTop(p)).toBeCloseTo(p.y + MODELS[p.model].h * p.scale, 12);
    const run = wallRun(1);
    expect(wallTop(run[0]!)).toBeGreaterThan(wallTop(run[1]!));
  });
});

// ---------- the torches ----------

describe('torches along the path', () => {
  const torches = count('castle_torch');
  it('runs the path straight from the front of the screen to the door of the keep', () => {
    expect(spec.path.kind).toBe('flagstone');
    expect(spec.ground.kind).toBe('flagstone');
    for (const c of spec.path.centre) expect(c.x).toBe(PATH.x);
    const zs = spec.path.centre.map((c) => c.z);
    expect(zs[0]).toBe(PATH.from);
    expect(zs[zs.length - 1]).toBe(DOOR_Z);
    for (let i = 1; i < zs.length; i++) expect(zs[i]!).toBeLessThan(zs[i - 1]!);
    expect(PATH.x).toBe(FORTRESS.x);
  });
  it('stands one torch on each side of the path at every row', () => {
    expect(torches).toHaveLength(TORCH_ROWS.length * 2);
    for (const z of TORCH_ROWS) {
      const row = torches.filter((t) => t.z === z);
      expect(row.map((t) => t.x).sort((a, b) => a - b)).toEqual([PATH.x - TORCH_OFFSET, PATH.x + TORCH_OFFSET]);
    }
    for (const t of torches) {
      expect(Math.abs(t.x - PATH.x)).toBeCloseTo(TORCH_OFFSET, 9);
      expect(Math.abs(t.x - PATH.x)).toBeGreaterThan(PATH.halfWidth + MODELS.castle_torch.hx * t.scale);
      expect(t.group).toBe('themed');
      expect(t.y).toBe(0);
    }
    expect(torchRow()).toHaveLength(torches.length);
  });
  it('has one anchor per torch, each exactly a torch top, and the embers (the first four) rise from the farthest torches', () => {
    expect(spec.anchors).toHaveLength(torches.length);
    for (const a of spec.anchors) {
      const t = torches.find((p) => p.x === a.x && p.z === a.z);
      expect(t, `${a.x},${a.z}`).toBeDefined();
      expect(a).toEqual(torchTop(t!));
      expect(a.y).toBeCloseTo(MODELS.castle_torch.h * t!.scale, 9);
    }
    expect(spec.anchors.slice(0, 4).every((a) => a.z <= -14)).toBe(true);
    expect(spec.castle!.torches).toEqual(spec.anchors);
    for (const id of ['crypt', 'pumpkin', 'forest', 'frost'] as const) expect(themeScene(id).anchors).not.toEqual(spec.anchors);
  });
  it('gives every torch a glow flame at its top, and real lights to six of them at most, on the farthest rows', () => {
    const flames = spec.glows.filter((g) => g.kind === 'torch');
    expect(flames).toHaveLength(torches.length);
    for (const a of spec.anchors) expect(flames.some((g) => g.x === a.x && g.y === a.y && g.z === a.z)).toBe(true);
    expect(spec.lights.length).toBe(LIT_ROWS.length * 2);
    expect(spec.lights.length).toBeLessThanOrEqual(BUDGET.maxPointLights);
    for (const l of spec.lights) {
      expect(l.kind).toBe('torch');
      expect(LIT_ROWS).toContain(l.z);
      expect(spec.glows).toContain(l);
    }
  });
  it('keeps the near torches low enough to stay under the cards', () => {
    for (const t of torches) if (t.z > 2) expect(MODELS.castle_torch.h * t.scale).toBeLessThan(2.65);
  });
});

// ---------- the moon ----------

describe('the pale moon behind a corner tower', () => {
  // Skipped: Haunted Castle is a disabled theme and its moon now sits in the clear-sky zone, not over the tower.
  it.skip('is a little bigger than the Crypt moon and sits just over the top of the left corner tower, for every window shape', () => {
    expect(CASTLE_MOON_SCALE).toBeGreaterThanOrEqual(1);
    expect(CASTLE_MOON_SCALE).toBeLessThanOrEqual(1.2);
    expect(spec.moon).toBe(CASTLE_MOON);
    expect(CASTLE_MOON.inFront).toBe(true);
    for (const aspect of VIEW_ASPECTS) {
      const tower = project([CORNER_TOWER.x, CORNER_TOWER.top, CORNER_TOWER.z], cameraAt(0, aspect, true))!;
      const r = moonScreenRadiusScaled(aspect, CASTLE_MOON_SCALE).disc;
      const t = CASTLE_MOON.target(aspect);
      expect(t.x).toBeCloseTo(tower.x, 9);
      expect(t.y).toBeCloseTo(tower.y - MOON_OVER_TOWER * r, 9);
      // The middle of the disc is above the tower top, with the lower part of the disc behind the tower.
      expect(t.y).toBeLessThan(tower.y);
      expect(t.y + r).toBeGreaterThan(tower.y);
      expect(t.y).toBeGreaterThan(0.1);
    }
  });
  it('lets only the centrepiece group stand in front of it', () => {
    for (const p of spec.placements) if (p.group !== 'centre') expect(p.model).toBe('castle_torch');
  });
});

// ---------- the sway ----------

describe('cloth sway weights', () => {
  it('are 0 at the top, grow toward the free end and never pass the amplitude, for any cloth', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.5, max: 5, noNaN: true }),
        fc.double({ min: 0.5, max: 4, noNaN: true }),
        fc.double({ min: 0.01, max: 0.3, noNaN: true }),
        (top, height, amp) => {
          const bottom = top - height;
          const ys = Array.from({ length: 12 }, (_, i) => top - (i / 11) * height);
          const w = swayWeights(ys, top, bottom, amp);
          expect(w[0]).toBe(0);
          expect(w[11]!).toBeCloseTo(amp, 6);
          for (let i = 1; i < w.length; i++) {
            expect(w[i]!).toBeGreaterThanOrEqual(w[i - 1]!);
            expect(w[i]!).toBeLessThanOrEqual(amp + 1e-6);
          }
        },
      ),
      { numRuns: 50 },
    );
  });
  const clock = (): SwayClock => ({ time: { value: 0 }, amp: { value: 1 } });
  const place = (id: 'castle_banner' | 'castle_wall_flag'): Placement[] =>
    [0, 1, 2].map((i) => ({ id: `t${i}`, model: id, group: 'centre', x: i * 5, y: 3, z: -20, rotY: 0, scale: 1 }));
  it.each(['castle_banner', 'castle_wall_flag'] as const)('%s: only the cloth part gets the shader and the weights, the rest stays as the file has it', async (id) => {
    const { scene } = await loadGlbGeometry(`quaternius/${id}.glb`);
    const info = MODELS[id];
    const { batches, owned } = buildBatches(id, scene, place(id));
    const plainMaterials = batches.map((b) => b.mesh.material);
    const swayed = applySway(id, batches, clock(), owned);
    expect(swayed).toBe(1);
    const cloth = SWAY_CLOTH[id];
    let seen = 0;
    batches.forEach((b, i) => {
      const isCloth = b.part.material.name === cloth.material;
      if (isCloth) {
        seen++;
        const w = b.mesh.geometry.getAttribute('aSway');
        expect(w).toBeDefined();
        let max = 0;
        let min = Infinity;
        for (let k = 0; k < w.count; k++) {
          max = Math.max(max, w.getX(k));
          min = Math.min(min, w.getX(k));
        }
        expect(min).toBe(0);
        expect(max).toBeCloseTo(cloth.amplitude, 6);
        // The file's own geometry and material were left alone, and the sway material is a copy.
        expect(b.part.geometry.getAttribute('aSway')).toBeUndefined();
        expect(b.mesh.material).not.toBe(plainMaterials[i]);
        expect(b.mesh.castShadow).toBe(false);
      } else {
        expect(b.mesh.material).toBe(plainMaterials[i]);
        expect(b.mesh.geometry.getAttribute('aSway')).toBeUndefined();
      }
    });
    expect(seen).toBe(1);
    // The cloth stays on the model: its swayed geometry plus the instance matrix keeps the footprint inside the catalogue size.
    const b = batches.find((x) => x.part.material.name === cloth.material)!;
    const box = new Box3();
    const geo = b.mesh.geometry;
    geo.computeBoundingBox();
    const m = new Matrix4();
    b.mesh.getMatrixAt(0, m);
    box.copy(geo.boundingBox!).applyMatrix4(m);
    expect(box.max.y - box.min.y).toBeLessThanOrEqual(info.h * 1.15 + 0.01);
    expect(owned.geometries.length).toBeGreaterThan(0);
    expect(owned.materials.length).toBeGreaterThan(0);
  });
  it('copies a material without changing the original', () => {
    const src = new MeshStandardMaterial({ color: '#702721' });
    src.name = 'Main';
    const c = clock();
    const copy = makeSwayMaterial(src, c);
    expect(copy).not.toBe(src);
    expect(copy.name).toBe('Main');
    expect(src.onBeforeCompile.toString()).not.toContain('uSwayTime');
    expect(typeof copy.onBeforeCompile).toBe('function');
  });
});

describe('sway shader', () => {
  it('patches the vertex shader once, with the clock uniforms shared and a per-instance phase', async () => {
    const { scene } = await loadGlbGeometry('quaternius/castle_banner.glb');
    const clock: SwayClock = { time: { value: 3 }, amp: { value: 1 } };
    const { batches, owned } = buildBatches('castle_banner', scene, [
      { id: 'a', model: 'castle_banner', group: 'centre', x: 0, y: 0, z: 0, rotY: 0, scale: 1 },
    ]);
    applySway('castle_banner', batches, clock, owned);
    const cloth = batches.find((b) => b.part.material.name === 'Main')!;
    const mat = cloth.mesh.material as { onBeforeCompile: (s: unknown, r: unknown) => void; customProgramCacheKey: () => string };
    const shader = { uniforms: {} as Record<string, { value: number }>, vertexShader: '#include <common>\nvoid main(){\n#include <begin_vertex>\n}' };
    mat.onBeforeCompile(shader, {});
    expect(shader.uniforms.uSwayTime).toBe(clock.time);
    expect(shader.uniforms.uSwayAmp).toBe(clock.amp);
    expect(shader.vertexShader).toContain('attribute float aSway');
    expect(shader.vertexShader).toContain('instanceMatrix[3]');
    expect(shader.vertexShader).toContain('transformed.x +=');
    // No loop in the shader and no per-frame vertex work in JavaScript.
    expect(shader.vertexShader).not.toMatch(/\bfor\s*\(/);
    expect(mat.customProgramCacheKey()).toBe('tabpire-cloth-sway');
    // Geometry weights are built once from the part (not by the frame loop).
    expect(swayGeometry(cloth.part.geometry, cloth.part.local, 0.05).getAttribute('aSway').count).toBe(cloth.part.geometry.getAttribute('position').count);
  });
});

// ---------- the whole scene ----------

describe('Haunted Castle scene data', () => {
  it('has the counts of the brief', () => {
    expect(count('castle_fortress')).toHaveLength(1);
    expect(count('castle_wall_towers')).toHaveLength(2);
    expect(count('castle_stone_wall')).toHaveLength(2);
    expect(count('castle_banner')).toHaveLength(4);
    expect(count('castle_wall_flag')).toHaveLength(4);
    expect(count('castle_torch')).toHaveLength(12);
    expect([...spec.models].sort()).toEqual(
      ['castle_banner', 'castle_fortress', 'castle_stone_wall', 'castle_torch', 'castle_wall_flag', 'castle_wall_towers'],
    );
    expect(spec.weather!.kind).toBe('embers');
    expect(spec.layers.embers).toBe(true);
  });
  it('is large and close: the fortress fills the back and its walls run to both edges', () => {
    const f = spec.centrepiece.placement;
    expect(f.scale).toBe(FORTRESS.scale);
    expect(f.x).toBe(FORTRESS.x);
    expect(f.z - MODELS.castle_fortress.hz * f.scale).toBeGreaterThanOrEqual(-40);
    expect(MODELS.castle_fortress.hx * f.scale * 2).toBeGreaterThan(15);
  });
  it('has ghosts in the courtyard, in front of the fortress', () => {
    expect(spec.layers.ghosts).toBe(true);
    for (const g of spec.ghostSpots) {
      expect(g.z).toBeGreaterThan(spec.centrepiece.placement.z + MODELS.castle_fortress.hz * FORTRESS.scale);
      expect(g.y).toBeGreaterThan(MODELS.castle_torch.h);
    }
  });
});
