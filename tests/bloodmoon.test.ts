// The Blood Moon scene (.kiro/specs/themes/unique-scenes.md, brief 4): the pure helpers (platform, ring, cracks) and the
// facts of the spec: a huge moon centred behind the ruins, only the centrepiece group in front of it, clouds clear of it.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { BUDGET } from '../lib/scene/config';
import { MODELS, footprintOf } from '../lib/scene/layout';
import { MOON, MOON_KEEP_OUT_DEG, cloudDistanceToMoon, cloudLanesFor, cloudU } from '../lib/scene/sky';
import { themeScene } from '../lib/scene/themeLayout';
import { BLOOD_MOON, BLOOD_PARTS, buildBloodMoon } from '../lib/scene/uniqueScenes/bloodmoon';
import {
  CRACK_TRI_LIMIT, CRACK_Y, PEDESTAL, PLATFORM_RISE, PLATFORM_STEP_COUNT, PLATFORM_TOP, PLATFORM_TRIS, RING, RING_PIECES, RUINS,
  crackNetwork, crackRibbon, leanRise, onPlatform, platformSteps, ribbonTriangles, ringSlots, sinkOf,
} from '../lib/scene/uniqueScenes/bloodmoonParts';
import { MAX_SINK } from '../lib/scene/uniqueScenes/frostIce';
import { VIEW_ASPECTS, blocksMoonFor, viewOf } from '../lib/scene/uniqueScenes/types';
import { WEATHER } from '../lib/scene/weather';

const spec = themeScene('bloodmoon').unique!;
const seeds = fc.integer({ min: 0, max: 5000 });

describe('the stepped platform', () => {
  const half = { hx: MODELS.blood_ruins.hx, hz: MODELS.blood_ruins.hz };
  const steps = platformSteps({ x: RUINS.x, z: RUINS.z }, half);
  it('has two or three wide low steps that go up by the same rise to the top', () => {
    expect(steps).toHaveLength(PLATFORM_STEP_COUNT);
    expect(PLATFORM_STEP_COUNT).toBeGreaterThanOrEqual(2);
    expect(PLATFORM_STEP_COUNT).toBeLessThanOrEqual(3);
    steps.forEach((s, k) => expect(s.top).toBeCloseTo((k + 1) * PLATFORM_RISE, 12));
    expect(steps[steps.length - 1]!.top).toBeCloseTo(PLATFORM_TOP, 12);
    expect(PLATFORM_RISE).toBeLessThanOrEqual(0.5);
  });
  it('is the same every time, and each step lies inside the one below it', () => {
    expect(platformSteps({ x: RUINS.x, z: RUINS.z }, half)).toEqual(steps);
    for (let k = 1; k < steps.length; k++) {
      expect(steps[k]!.x0).toBeGreaterThan(steps[k - 1]!.x0);
      expect(steps[k]!.x1).toBeLessThan(steps[k - 1]!.x1);
      expect(steps[k]!.z0).toBeGreaterThan(steps[k - 1]!.z0);
      expect(steps[k]!.z1).toBeLessThan(steps[k - 1]!.z1);
    }
  });
  it('carries the whole footprint of the ruins on its top step, and stays clear of the ring', () => {
    const top = steps[steps.length - 1]!;
    expect(top.x0).toBeLessThan(RUINS.x - half.hx);
    expect(top.x1).toBeGreaterThan(RUINS.x + half.hx);
    expect(top.z0).toBeLessThan(RUINS.z - half.hz);
    expect(top.z1).toBeGreaterThan(RUINS.z + half.hz);
    const outer = steps[0]!;
    for (const p of spec.placements.filter((q) => q.model.startsWith('blood_c') || q.model === 'blood_pedestal')) {
      expect(p.z - Math.max(MODELS[p.model].hx, MODELS[p.model].hz) * p.scale, p.id).toBeGreaterThan(outer.z1);
    }
    expect(onPlatform(steps, RUINS.x, RUINS.z)).toBe(true);
    expect(onPlatform(steps, PEDESTAL.x, PEDESTAL.z)).toBe(false);
  });
  it('lifts the ruins onto its top and says so in the spec', () => {
    const ruins = spec.centrepiece.placement;
    expect(ruins.model).toBe('blood_ruins');
    expect(ruins.group).toBe('centre');
    expect(ruins.y).toBeCloseTo(PLATFORM_TOP, 12);
    expect(spec.raised).toEqual({ [ruins.id]: PLATFORM_TOP });
    expect(spec.blood!.platform).toEqual(steps);
    expect(PLATFORM_TRIS).toBe(PLATFORM_STEP_COUNT * 12);
  });
});

describe('the ritual circle', () => {
  const ring = ringSlots(PEDESTAL, RING.radius, RING.count, RING.start);
  it('puts the slots evenly around the pedestal (property)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 3, max: 16 }), fc.double({ min: 1, max: 9, noNaN: true }), fc.double({ min: 0, max: 6.28, noNaN: true }), (n, r, start) => {
        const slots = ringSlots({ x: 2, z: -5 }, r, n, start);
        expect(slots).toHaveLength(n);
        slots.forEach((s, i) => {
          expect(Math.hypot(s.x - 2, s.z + 5)).toBeCloseTo(r, 9);
          const next = slots[(i + 1) % n]!;
          const gap = (((next.angle - s.angle) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
          expect(gap).toBeCloseTo((Math.PI * 2) / n, 9);
        });
      }),
    );
  });
  it('stands one column of the tall square kind or the short round kind in every slot, all at the same distance from the pedestal', () => {
    expect(RING_PIECES.length).toBe(RING.count);
    const columns = spec.placements.filter((p) => p.model === 'blood_column' || p.model === 'blood_column_round');
    expect(columns).toHaveLength(RING.count);
    const ped = spec.placements.find((p) => p.model === 'blood_pedestal')!;
    expect([ped.x, ped.z]).toEqual([PEDESTAL.x, PEDESTAL.z]);
    for (const c of columns) expect(Math.hypot(c.x - ped.x, c.z - ped.z), c.id).toBeCloseTo(RING.radius, 9);
    const angles = columns.map((c) => Math.atan2(c.z - ped.z, c.x - ped.x)).sort((a, b) => a - b);
    angles.forEach((a, i) => {
      const next = angles[(i + 1) % angles.length]!;
      expect(next > a ? next - a : next - a + Math.PI * 2, `gap ${i}`).toBeCloseTo((Math.PI * 2) / RING.count, 9);
    });
    expect(columns.filter((c) => c.model === 'blood_column').length).toBeGreaterThanOrEqual(3);
    expect(columns.filter((c) => c.model === 'blood_column_round').length).toBeGreaterThanOrEqual(3);
    expect(ring).toHaveLength(RING.count);
  });
  it('leans some columns, sinks exactly those a little, and keeps the high side of each on the ground', () => {
    const leaning = spec.placements.filter((p) => p.tilt && (Math.abs(p.tilt[0]) > 0.005 || Math.abs(p.tilt[1]) > 0.005));
    expect(leaning.length).toBeGreaterThanOrEqual(2);
    for (const p of leaning) {
      const sink = spec.sunk![p.id]!;
      expect(sink, p.id).toBeGreaterThan(0);
      expect(sink, p.id).toBeLessThanOrEqual(MAX_SINK);
      expect(p.y, p.id).toBeCloseTo(-sink, 12);
      // The highest corner of its base ends at the ground, within a millimetre.
      expect(leanRise(p.model, p.scale, p.tilt!) - sink, p.id).toBeLessThanOrEqual(1e-9);
      expect(sink - leanRise(p.model, p.scale, p.tilt!), p.id).toBeLessThan(0.001 + 1e-9);
    }
    for (const id of Object.keys(spec.sunk!)) expect(leaning.some((p) => p.id === id), id).toBe(true);
    expect(sinkOf('blood_column', 1.3, [0, 0])).toBe(0);
  });
  it('has a red flame glow above the pedestal and that one red light', () => {
    const ped = spec.placements.find((p) => p.model === 'blood_pedestal')!;
    const top = MODELS.blood_pedestal.h * ped.scale;
    expect(spec.glows).toHaveLength(1);
    expect(spec.glows[0]!.kind).toBe('cauldron');
    expect(spec.glows[0]!.x).toBe(ped.x);
    expect(spec.glows[0]!.z).toBe(ped.z);
    expect(spec.glows[0]!.y).toBeGreaterThan(top);
    expect(spec.glows[0]!.y).toBeLessThan(top + 1);
    expect(spec.lights).toEqual(spec.glows);
  });
});

describe('the lava cracks', () => {
  it('are the same for a seed and differ between seeds (property)', () => {
    fc.assert(
      fc.property(seeds, (seed) => {
        expect(crackNetwork(seed)).toEqual(crackNetwork(seed));
      }),
      { numRuns: 20 },
    );
    expect(crackNetwork(1)).not.toEqual(crackNetwork(2));
  });
  it('keep to the view, off the blocked area, and within the triangle limit (property)', () => {
    fc.assert(
      fc.property(seeds, (seed) => {
        const blocked = (x: number, z: number) => Math.abs(x) < 4 && z < -10;
        const cracks = crackNetwork(seed, blocked);
        expect(cracks.length).toBeGreaterThan(0);
        for (const c of cracks) {
          expect(c.points.length).toBeGreaterThanOrEqual(3);
          expect(c.halfWidth).toBeGreaterThan(0);
          for (const [x, z] of c.points.slice(1)) {
            expect(blocked(x, z)).toBe(false);
            expect(z).toBeLessThanOrEqual(4);
            expect(z).toBeGreaterThanOrEqual(-36);
            expect(Math.abs(x - 0.5) + 0.4).toBeLessThanOrEqual(0.5 * (16 - z));
          }
        }
        const tris = ribbonTriangles(crackRibbon(cracks));
        expect(tris).toBe(cracks.reduce((n, c) => n + 2 * (c.points.length - 1), 0));
        expect(tris).toBeLessThanOrEqual(CRACK_TRI_LIMIT);
      }),
      { numRuns: 20 },
    );
  });
  it('make one ribbon: valid indices, flat on the ground, with an edge, a length and a seed on every vertex', () => {
    const r = crackRibbon(spec.blood!.cracks);
    const verts = r.position.length / 3;
    expect(verts).toBeGreaterThan(0);
    expect(r.side).toHaveLength(verts);
    expect(r.along).toHaveLength(verts);
    expect(r.seed).toHaveLength(verts);
    for (const i of r.index) {
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(verts);
    }
    for (let v = 0; v < verts; v++) {
      expect(r.position[v * 3 + 1]).toBeCloseTo(CRACK_Y, 6);
      expect(Math.abs(r.side[v]!)).toBe(1);
      expect(r.along[v]).toBeGreaterThanOrEqual(0);
      expect(r.along[v]).toBeLessThanOrEqual(1);
    }
    expect(spec.blood!.cracks.length).toBeGreaterThanOrEqual(6);
  });
  it('stay off the platform in the scene', () => {
    for (const c of spec.blood!.cracks) for (const [x, z] of c.points.slice(1)) expect(onPlatform(spec.blood!.platform, x, z), `${x},${z}`).toBe(false);
  });
});

describe('the moon', () => {
  it('is twice the Crypt moon, red, and centred behind the centrepiece at every window shape', () => {
    expect(BLOOD_MOON.scale).toBe(2);
    expect(spec.moon).toBe(BLOOD_MOON);
    for (const aspect of VIEW_ASPECTS) {
      const t = BLOOD_MOON.target(aspect);
      expect(t.x).toBeCloseTo(0.5, 2);
      expect(t.y).toBeGreaterThanOrEqual(0.25);
      expect(t.y).toBeLessThanOrEqual(0.35);
      const ruins = viewOf(spec.centrepiece.placement, aspect)!;
      expect(Math.abs(ruins.cx - t.x), `aspect ${aspect}`).toBeLessThan(0.03);
      // The ruins stand in front of the lower part of the disc, the top of the disc is clear sky.
      expect(ruins.top).toBeGreaterThan(t.y);
    }
  });
  it('lets only the centrepiece group stand in front of it', () => {
    const open = { ...BLOOD_MOON, inFront: false };
    const front = spec.placements.filter((p) => blocksMoonFor(p, open));
    // Without the allowance some of the centrepiece group would be over the disc; with it, none is, and nothing else ever is.
    expect(front.length).toBeGreaterThan(0);
    for (const p of front) expect(p.group, p.id).toBe('centre');
    for (const p of spec.placements) expect(blocksMoonFor(p, BLOOD_MOON), p.id).toBe(false);
    for (const p of spec.placements.filter((q) => q.group !== 'centre')) expect(blocksMoonFor(p, open), p.id).toBe(false);
    expect(new Set(spec.centrepiece.ids)).toEqual(new Set(spec.placements.filter((p) => p.group === 'centre').map((p) => p.id)));
  });
  it('is not allowed in front of the moon for a theme without the allowance, whatever the group', () => {
    const tall = spec.placements.find((p) => p.model === 'tree_dead_large')!;
    const behind = { ...tall, group: 'centre' as const, x: 0.5, z: -30 };
    expect(blocksMoonFor(behind, BLOOD_MOON)).toBe(false);
    expect(blocksMoonFor({ ...behind, group: 'themed' }, BLOOD_MOON)).toBe(true);
    expect(blocksMoonFor(behind, { ...BLOOD_MOON, inFront: undefined })).toBe(true);
  });
  it('keeps every cloud clear of the bigger disc and its pulse, whatever the time', () => {
    const lanes = cloudLanesFor(BLOOD_MOON.scale);
    const keep = MOON_KEEP_OUT_DEG * BLOOD_MOON.scale;
    expect(keep).toBeGreaterThan(MOON.discDeg * BLOOD_MOON.scale);
    for (let t = 0; t <= 600; t += 5) {
      lanes.forEach((lane, li) => {
        for (const c of lane.clouds) {
          expect(cloudDistanceToMoon({ u: cloudU(c.u0, lane.speed, t, lane.uMin, lane.uMax), v: lane.v, a: c.a, b: c.b, lane: li })).toBeGreaterThanOrEqual(keep - 1e-6);
        }
      });
    }
  });
});

describe('the scene', () => {
  it('is ruins, a ritual circle and dead trees only, from three or four model kinds', () => {
    expect(new Set(spec.models)).toEqual(new Set(['blood_ruins', 'blood_column', 'blood_column_round', 'blood_pedestal', 'tree_dead_large', 'tree_dead_medium']));
    const trees = spec.placements.filter((p) => p.model.startsWith('tree_'));
    expect(trees.length).toBeGreaterThanOrEqual(4);
    expect(new Set(trees.map((t) => t.model)).size).toBeLessThanOrEqual(2);
    for (const t of trees) expect(t.group).toBe('themed');
  });
  it('has cracked rock ground, falling ash, a bigger bat flock, one light and the shared layers', () => {
    expect(spec.ground.kind).toBe('rock');
    expect(spec.path.kind).toBe('none');
    expect(spec.weather).toBe(WEATHER.ash);
    expect(spec.layers.bats).toBeGreaterThan(1);
    expect(spec.layers.bats).toBeLessThanOrEqual(2.5);
    expect(spec.layers).toMatchObject({ clouds: true, ghosts: true, mist: true, embers: true });
    expect(spec.lights.length).toBeLessThanOrEqual(1);
    expect(spec.lights.length).toBeLessThanOrEqual(BUDGET.maxPointLights);
  });
  it('puts its ghosts around the ritual circle, in the open', () => {
    expect(spec.ghostSpots.length).toBeGreaterThanOrEqual(2);
    for (const g of spec.ghostSpots) {
      expect(Math.hypot(g.x - PEDESTAL.x, g.z - PEDESTAL.z)).toBeLessThan(10);
      expect(g.y).toBeGreaterThanOrEqual(4);
    }
  });
  it('declares the triangles and calls of its own parts', () => {
    expect(spec.extras.calls).toBe(BLOOD_PARTS.calls);
    expect(spec.extras.tris).toBe(BLOOD_PARTS.groundTris + PLATFORM_TRIS + ribbonTriangles(crackRibbon(spec.blood!.cracks)));
  });
  it('is the same for a seed, and every placement of every seed has a footprint on the ground (property)', () => {
    fc.assert(
      fc.property(seeds, (seed) => {
        const a = buildBloodMoon(seed);
        expect(a).toEqual(buildBloodMoon(seed));
        expect(a.centrepiece.placement.model).toBe('blood_ruins');
        for (const p of a.placements) expect(footprintOf(p).hx).toBeGreaterThan(0);
        for (const id of a.centrepiece.ids) expect(a.placements.some((p) => p.id === id), id).toBe(true);
      }),
      { numRuns: 10 },
    );
  });
});
