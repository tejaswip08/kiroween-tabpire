import { describe, expect, it } from 'vitest';
import { BASE_FOV, CAMERA_REST, DRIFT_PERIOD_S, cameraAt, cameraDrift, cameraDriftInto, directionAt, fovForAspect, project, projectDirection, length } from '../lib/scene/camera';

const ASPECTS = [16 / 9, 16 / 10, 21 / 9, 4 / 3, 1, 0.6];

describe('camera drift', () => {
  it('is periodic', () => {
    for (const t of [0, 3.3, 17, 41.9]) {
      const a = cameraDrift(t);
      const b = cameraDrift(t + DRIFT_PERIOD_S);
      for (let i = 0; i < 3; i++) {
        expect(b.position[i]!).toBeCloseTo(a.position[i]!, 9);
        expect(b.target[i]!).toBeCloseTo(a.target[i]!, 9);
      }
    }
  });
  it('starts at the rest position', () => {
    const c = cameraDrift(0);
    expect(c.position[0]).toBeCloseTo(0, 9);
  });
  it('has no jumps between frames and stays small', () => {
    let prev = cameraDrift(0).position;
    for (let i = 1; i <= DRIFT_PERIOD_S * 60 * 2; i++) {
      const cur = cameraDrift(i / 60).position;
      expect(length([cur[0] - prev[0], cur[1] - prev[1], cur[2] - prev[2]])).toBeLessThan(0.02);
      expect(Math.abs(cur[0]!)).toBeLessThanOrEqual(0.55 + 1e-9);
      expect(Math.abs(cur[1]!)).toBeLessThanOrEqual(0.22 + 1e-9);
      expect(Math.abs(cur[2]!)).toBeLessThanOrEqual(0.4 + 1e-9);
      prev = cur;
    }
  });
  it('holds still with reduced motion', () => {
    expect(cameraAt(12.3, 1.78, true)).toEqual(cameraAt(99, 1.78, true));
  });
});

describe('cameraDriftInto', () => {
  it('gives the same numbers as the rest position plus cameraDrift, without making objects', () => {
    const out = new Float64Array(6);
    for (const t of [0, 1.7, 22, 59.9]) {
      cameraDriftInto(t, false, out);
      const d = cameraDrift(t);
      for (let i = 0; i < 3; i++) {
        expect(out[i]).toBeCloseTo(CAMERA_REST.position[i]! + d.position[i]!, 12);
        expect(out[3 + i]).toBeCloseTo(CAMERA_REST.target[i]! + d.target[i]!, 12);
      }
    }
    cameraDriftInto(33, true, out);
    cameraDriftInto(0, false, out);
    const rest = [...out];
    cameraDriftInto(33, true, out);
    expect([...out]).toEqual(rest);
  });
});

describe('field of view', () => {
  it('is the base at 16:9 and wider for narrower windows, within limits', () => {
    expect(fovForAspect(1.78)).toBeCloseTo(BASE_FOV, 6);
    expect(fovForAspect(21 / 9)).toBeCloseTo(BASE_FOV, 6);
    expect(fovForAspect(1)).toBeGreaterThan(fovForAspect(1.5));
    for (const a of [0, -1, NaN, Infinity, 0.1, 0.5, 3]) {
      const f = fovForAspect(a);
      expect(Number.isFinite(f)).toBe(true);
      expect(f).toBeGreaterThanOrEqual(BASE_FOV);
      expect(f).toBeLessThanOrEqual(BASE_FOV * Math.pow(1.9, 0.6) + 1e-9);
    }
  });
});

describe('projection', () => {
  it('puts the look-at point in the middle', () => {
    for (const a of ASPECTS) {
      const cam = cameraAt(0, a, true);
      const p = project(cam.target, cam)!;
      expect(p.x).toBeCloseTo(0.5, 6);
      expect(p.y).toBeCloseTo(0.5, 6);
    }
  });
  it('returns null behind the camera', () => {
    const cam = cameraAt(0, 1.78, true);
    expect(project([3, 2.4, 30], cam)).toBeNull();
  });
  it('directionAt is the inverse of projectDirection', () => {
    for (const a of ASPECTS) {
      const cam = cameraAt(7, a);
      for (const [x, y] of [[0.1, 0.2], [0.86, 0.24], [0.5, 0.9]] as [number, number][]) {
        const p = projectDirection(directionAt(x, y, cam), cam)!;
        expect(p.x).toBeCloseTo(x, 6);
        expect(p.y).toBeCloseTo(y, 6);
      }
    }
  });
});
