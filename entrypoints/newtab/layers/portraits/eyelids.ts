import { Group, Mesh, MeshBasicMaterial, Quaternion, Raycaster, Shape, ShapeGeometry, Vector3, DoubleSide } from 'three';
import { eyeRay, VAMPIRE } from '../../../../lib/vampire/rig';

interface Spot {
  point: Vector3;
  normal: Vector3;
}
const cache = new WeakMap<object, Spot[]>();

/** Finds where the two eyes are on the surface by shooting a ray at each eye position. */
function findSpots(model: Mesh): Spot[] {
  const hit = cache.get(model.geometry);
  if (hit) return hit;
  model.updateMatrixWorld(true);
  const ray = new Raycaster();
  const spots: Spot[] = [];
  for (const side of [-1, 1] as const) {
    const r = eyeRay(side);
    ray.set(new Vector3(...r.origin), new Vector3(...r.dir));
    const hits = ray.intersectObject(model, false);
    const first = hits[0];
    if (first?.face) {
      spots.push({ point: first.point.clone(), normal: first.face.normal.clone().transformDirection(model.matrixWorld) });
    } else {
      // No surface found: put the lid where the ray was aimed, facing the viewer.
      spots.push({ point: new Vector3(r.origin[0] + r.dir[0] * 1.5, r.origin[1], r.origin[2] + r.dir[2] * 1.5), normal: new Vector3(-r.dir[0], 0, -r.dir[2]) });
    }
  }
  cache.set(model.geometry, spots);
  return spots;
}

/** A thin curved line, like a closed eyelid: a crescent that curves down in the middle. */
function lidShape(width: number): Shape {
  const w = width / 2;
  const t = width * 0.12;
  const s = new Shape();
  s.moveTo(-w, 0.0);
  s.quadraticCurveTo(0, -width * 0.38, w, 0.0);
  s.quadraticCurveTo(0, -width * 0.38 - t, -w, 0.0);
  return s;
}

/**
 * Two dark eyelid arcs on the face, for the Asleep pose. The face is painted into the texture,
 * so eyes cannot be closed by moving geometry. The arcs sit on the surface where a ray finds it.
 * Returns the group (add it next to the model) and a function that sets how closed they are.
 */
export function makeEyelids(model: Mesh): { group: Group; setClosed: (k: number) => void } {
  const group = new Group();
  const material = new MeshBasicMaterial({ color: '#10061a', transparent: true, opacity: 0, side: DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const geo = new ShapeGeometry(lidShape(VAMPIRE.eyelidWidth * VAMPIRE.width));
  const q = new Quaternion();
  const forward = new Vector3(0, 0, 1);
  for (const spot of findSpots(model)) {
    const m = new Mesh(geo, material);
    m.position.copy(spot.point).addScaledVector(spot.normal, 0.004);
    m.quaternion.copy(q.setFromUnitVectors(forward, spot.normal));
    group.add(m);
  }
  group.visible = false;
  return {
    group,
    setClosed(k: number) {
      material.opacity = Math.min(1, Math.max(0, k));
      group.visible = k > 0.02;
    },
  };
}
