// The Crypt's clouds (lib/scene/horizonClouds.ts): the first prototype's six clouds, where they showed on screen there.
import { describe, expect, it } from 'vitest';
import { cameraAt, project } from '../lib/scene/camera';
import { CLOUD_BLOBS, CLOUD_HALF_W, PROTO_CLOUDS, cloudFade, cloudX, cryptClouds, wrapX } from '../lib/scene/horizonClouds';
import { moonScreenRadius, moonTarget } from '../lib/scene/sky';

const clouds = cryptClouds();
const cam = cameraAt(0, 1.6, true);
const screenY = (c: (typeof clouds)[number]) => project([c.x, c.y, c.z], cam)!.y;

describe('the Crypt clouds', () => {
  // Requirement changed: the pink layer was raised from the horizon (0.39) to the sky between the search box and the chips row.
  it('are the prototype six: four dark ones along the top edge and two pink ones between the search box and the chips row', () => {
    expect(clouds).toHaveLength(PROTO_CLOUDS.length);
    expect(clouds.filter((c) => screenY(c) < 0.15)).toHaveLength(4);
    expect(clouds.filter((c) => screenY(c) > 0.26 && screenY(c) < 0.34)).toHaveLength(2);
  });
  it('drift right to left and wrap around', () => {
    const c = clouds[0]!;
    expect(cloudX(c, 1)).toBeLessThan(cloudX(c, 0));
    for (const x of [-100, -45, 0, 44, 200]) expect(Math.abs(wrapX(x))).toBeLessThanOrEqual(45);
  });
  it('never cross the moon: the dark layer is above the disc, the pink layer stays left of it at every time', () => {
    const t = moonTarget(1.6);
    const r = moonScreenRadius(1.6).disc;
    for (const c of clouds.filter((c) => c.band)) {
      for (let s = 0; s < 600; s += 1.7) {
        const x = cloudX(c, s);
        const right = project([x + CLOUD_HALF_W * c.scale * cloudFade(c, s), c.y, c.z], cam)!.x;
        expect(right, `pink cloud at t ${s}`).toBeLessThan(t.x - r / 1.6);
      }
    }
    for (const c of clouds.filter((c) => !c.band)) {
      const y = screenY(c);
      const half = (Math.max(...CLOUD_BLOBS.map((b) => Math.abs(b[1]) + b[3])) * c.scale * 0.7) / (project([c.x, c.y, c.z], cam)!.depth * Math.tan((cam.fov * Math.PI) / 360) * 2);
      expect(y + half < t.y - r || y - half > t.y + r, `cloud at y ${y.toFixed(2)}`).toBe(true);
    }
  });
});
