import { describe, expect, it } from 'vitest';
import { WING, makeBatGeometry } from '../entrypoints/newtab/layers/scene/batGeometry';
import { BODY, BROOM, CLOAK, HAT, makeCloakGeometry, rippleCloak } from '../entrypoints/newtab/layers/scene/witchShape';

describe('bat geometry', () => {
  const geo = makeBatGeometry();
  const pos = geo.getAttribute('position');
  const wing = geo.getAttribute('aWing');

  it('is a small 3D mesh with flat normals', () => {
    expect(pos.count % 3).toBe(0);
    expect(pos.count / 3).toBeLessThan(400);
    expect(geo.getAttribute('normal').count).toBe(pos.count);
    for (let i = 0; i < pos.count; i++) expect(Number.isFinite(pos.getX(i) + pos.getY(i) + pos.getZ(i))).toBe(true);
  });
  it('has a round body, ears, and two wings on opposite sides', () => {
    const sides = new Set<number>();
    let bodyVerts = 0;
    let bodyMaxY = -Infinity;
    for (let i = 0; i < wing.count; i++) {
      sides.add(wing.getX(i));
      if (wing.getX(i) === 0) {
        bodyVerts++;
        bodyMaxY = Math.max(bodyMaxY, pos.getY(i));
      }
    }
    expect([...sides].sort()).toEqual([-1, 0, 1]);
    // Body, head and two ears: well over a flat triangle, and the ears rise above the body.
    expect(bodyVerts).toBeGreaterThan(60);
    expect(bodyMaxY).toBeGreaterThan(0.2);
  });
  it('gives each wing a scalloped trailing edge and measures the wing along its span', () => {
    expect(WING.trail.length).toBeGreaterThanOrEqual(8);
    // Scallops: the edge goes back and forth, not along a straight line.
    const z = WING.trail.map((p) => p[1]);
    let reversals = 0;
    for (let i = 2; i < z.length; i++) if ((z[i]! - z[i - 1]!) * (z[i - 1]! - z[i - 2]!) < 0) reversals++;
    expect(reversals).toBeGreaterThanOrEqual(4);
    for (let i = 0; i < wing.count; i++) {
      expect(wing.getY(i)).toBeGreaterThanOrEqual(0);
      expect(wing.getY(i)).toBeLessThanOrEqual(1);
      if (wing.getX(i) !== 0) expect(Math.abs(pos.getX(i))).toBeLessThanOrEqual(WING.span + 1e-6);
    }
  });
  it('has the tip of each wing farthest from the body', () => {
    let tip = 0;
    for (let i = 0; i < wing.count; i++) if (wing.getX(i) !== 0) tip = Math.max(tip, Math.abs(pos.getX(i)));
    expect(tip).toBeCloseTo(WING.span, 6);
  });
});

describe('witch silhouette', () => {
  it('has a broom with a handle and several bristles, a seated body and a pointed crooked hat', () => {
    expect(BROOM.length).toBeGreaterThanOrEqual(5);
    const handle = BROOM[0]!;
    const length = Math.max(...handle.map((p) => p[0])) - Math.min(...handle.map((p) => p[0]));
    expect(length).toBeGreaterThan(3);
    expect(BODY.length).toBeGreaterThanOrEqual(3);
    const cone = HAT[1]!;
    const tip = cone.reduce((a, b) => (b[1] > a[1] ? b : a));
    const baseCentre = (cone[0]![0] + cone[1]![0]) / 2;
    // The tip is high above the brim and bent back (to the left, away from where she flies).
    expect(tip[1]).toBeGreaterThan(2.3);
    expect(tip[0]).toBeLessThan(baseCentre - 0.4);
  });
  it('has a ragged cloak that streams behind her, away from her shoulders', () => {
    expect(CLOAK.length).toBeGreaterThanOrEqual(14);
    expect(Math.min(...CLOAK.map((p) => p[0]))).toBeLessThan(-1.5);
  });
  it('ripples the cloak without changing its shoulders, and holds still when asked', () => {
    const geo = makeCloakGeometry();
    const base = Float32Array.from(geo.getAttribute('position').array);
    const pos = geo.getAttribute('position');
    const shoulder = [...Array(pos.count).keys()].find((i) => base[i * 3]! > 0.25)!;
    const tail = [...Array(pos.count).keys()].find((i) => base[i * 3]! < -1.8)!;
    rippleCloak(geo, base, 1.3);
    expect(pos.getY(shoulder)).toBeCloseTo(base[shoulder * 3 + 1]!, 6);
    expect(Math.abs(pos.getY(tail) - base[tail * 3 + 1]!)).toBeGreaterThan(0.02);
    rippleCloak(geo, base, 5, 0);
    for (let i = 0; i < pos.count; i++) expect(pos.getY(i)).toBeCloseTo(base[i * 3 + 1]!, 9);
    rippleCloak(geo, base, 0.1);
    rippleCloak(geo, base, 0.4);
    for (let i = 0; i < pos.count; i++) expect(Number.isFinite(pos.getX(i) + pos.getY(i))).toBe(true);
  });
});
