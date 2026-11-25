// The moon of the Witch's Forest is in the clear sky of the upper right corner: rays from the camera through the disc, against
// the real tree meshes (the bark of the twisted trees from their files, and the scary trees the scene builds), almost all
// reach the moon at every usual window shape.
import { expect, it } from 'vitest';
import { DoubleSide, Matrix4, Mesh, MeshBasicMaterial, Quaternion, Raycaster, Vector3, Euler, type BufferGeometry } from 'three';
import { loadGlbGeometry } from './helpers/glb';
import { cameraAt, directionAt } from '../lib/scene/camera';
import { moonScreenRadiusScaled } from '../lib/scene/sky';
import { themeScene } from '../lib/scene/themeLayout';
import { FOREST_MOON, FOREST_MOON_DEPTH } from '../lib/scene/uniqueScenes/forest';
import { buildScaryTree } from '../entrypoints/newtab/layers/scene/themes/forestShapes';
import { buildFarTree } from '../entrypoints/newtab/layers/scene/themes/witchHouseShapes';
const BARK: Record<string, string> = { forest_twisted_a: 'TwistedTree_2_1', forest_twisted_b: 'TwistedTree_1_1', forest_twisted_c: 'TwistedTree_3_1' };
it('shows the moon clear of the trees (a few branch tips at most), at every window shape', async () => {
  const spec = themeScene('forest').unique!;
  const geo: Record<string, { g: BufferGeometry; m: Matrix4 }> = {};
  for (const id of Object.keys(BARK)) {
    const gl = await loadGlbGeometry(`quaternius/${id}.glb`); gl.scene.updateMatrixWorld(true);
    gl.scene.traverse((o) => { const m = o as Mesh; if (m.isMesh && m.name === BARK[id]) geo[id] = { g: m.geometry, m: m.matrixWorld.clone() }; });
  }
  const mat = new MeshBasicMaterial({ side: DoubleSide });
  const meshes: { mesh: Mesh; name: string }[] = [];
  for (const p of spec.placements) {
    if (!BARK[p.model]) continue;
    const mesh = new Mesh(geo[p.model]!.g, mat);
    const place = new Matrix4().compose(new Vector3(p.x, p.y, p.z), new Quaternion().setFromEuler(new Euler(0, p.rotY, 0)), new Vector3(p.scale, p.scale, p.scale));
    mesh.matrixAutoUpdate = false; mesh.matrix.multiplyMatrices(place, geo[p.model]!.m); mesh.matrixWorld.copy(mesh.matrix);
    meshes.push({ mesh, name: `${p.id} @${p.x.toFixed(1)},${p.z.toFixed(1)}` });
  }
  const scaryGeo = [0, 1, 2].map(buildScaryTree);
  for (const t of spec.forest!.scary) {
    const mesh = new Mesh(scaryGeo[t.variant]!, mat);
    mesh.matrixAutoUpdate = false; mesh.matrix.compose(new Vector3(t.x, 0, t.z), new Quaternion().setFromEuler(new Euler(0, t.rotY, 0)), new Vector3(t.scale, t.scale, t.scale)); mesh.matrixWorld.copy(mesh.matrix);
    meshes.push({ mesh, name: `scary @${t.x.toFixed(1)},${t.z.toFixed(1)}` });
  }
  // The small far trees and the black trees in front of the moon (the cheap shape the scene draws them with).
  const farGeo = [0, 1, 2].map(buildFarTree);
  for (const t of [...spec.forest!.mid.farTrees, ...spec.forest!.mid.moonTrees]) {
    const mesh = new Mesh(farGeo[t.variant]!, mat);
    mesh.matrixAutoUpdate = false; mesh.matrix.compose(new Vector3(t.x, 0, t.z), new Quaternion().setFromEuler(new Euler(0, t.rotY, 0)), new Vector3(t.scale, t.scale, t.scale)); mesh.matrixWorld.copy(mesh.matrix);
    meshes.push({ mesh, name: `far @${t.x.toFixed(1)},${t.z.toFixed(1)}` });
  }
  for (const aspect of [16 / 10, 16 / 9, 1.93, 21 / 9]) {
    const cam = cameraAt(0, aspect, true);
    const target = FOREST_MOON.target(aspect);
    const r = moonScreenRadiusScaled(aspect, FOREST_MOON.scale).disc;
    const pos = new Vector3(...cam.position);
    const fwd = new Vector3(...cam.target).sub(pos).normalize();
    const rc = new Raycaster();
    let total = 0, covered = 0;
    const by = new Map<string, number>();
    for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) {
      if (i * i + j * j > 16) continue;
      const sx = target.x + (i / 4) * r / aspect, sy = target.y + (j / 4) * r;
      const d = new Vector3(...directionAt(sx, sy, cam));
      rc.set(pos, d);
      total++;
      let best = Infinity, who = '';
      for (const m of meshes) { const h = rc.intersectObject(m.mesh, false)[0]; if (h && h.distance < best) { best = h.distance; who = m.name; } }
      const depth = best * d.dot(fwd);
      if (depth < FOREST_MOON_DEPTH) { covered++; by.set(who, (by.get(who) ?? 0) + 1); }
    }
    const share = covered / total;
    // The moon is in the clear sky now: at most a few branch tips may cross its edge.
    expect(share, `aspect ${aspect.toFixed(2)}: share of the disc covered by nearer trees (${[...by.keys()].join(', ')})`).toBeLessThan(0.15);
  }
}, 300000);
