import { useEffect, useMemo } from 'react';
import { Color, DoubleSide, InstancedMesh, MeshBasicMaterial, Matrix4, PlaneGeometry, Quaternion, Vector3 } from 'three';
import { WINDOW_COLOR, type WindowQuad } from '../../../../../lib/scene/uniqueScenes/castleParts';
const UP = new Vector3(0, 1, 0);
/** The matrix of one window quad: where it stands, turned like the fortress, scaled to its size. */
export function windowMatrix(q: WindowQuad, out = new Matrix4()): Matrix4 {
  return out.compose(new Vector3(q.x, q.y, q.z), new Quaternion().setFromAxisAngle(UP, q.rotY), new Vector3(q.w, q.h, 1));
}
/**
 * The lit windows of the fortress: small yellow quads on its facade, one instanced mesh (one draw call). The colour is above 1
 * and not tone mapped, so the windows are over the bloom threshold and glow. Fog still dims them with distance, like the rest.
 */
export function CastleWindows({ quads }: { quads: readonly WindowQuad[] }) {
  const mesh = useMemo(() => {
    const mat = new MeshBasicMaterial({ color: new Color(...WINDOW_COLOR), toneMapped: false, fog: true, side: DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const m = new InstancedMesh(new PlaneGeometry(1, 1), mat, Math.max(1, quads.length));
    quads.forEach((q, i) => m.setMatrixAt(i, windowMatrix(q)));
    m.count = quads.length;
    m.instanceMatrix.needsUpdate = true;
    m.frustumCulled = false;
    m.name = 'castle-windows';
    return m;
  }, [quads]);
  useEffect(
    () => () => {
      mesh.geometry.dispose();
      (mesh.material as MeshBasicMaterial).dispose();
      mesh.dispose();
    },
    [mesh],
  );
  return <primitive object={mesh} />;
}
