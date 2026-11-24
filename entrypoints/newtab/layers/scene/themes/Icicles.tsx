import { useEffect, useMemo } from 'react';
import { ConeGeometry, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import type { Icicle } from '../../../../../lib/scene/uniqueScenes/frostIce';

const UP_TO_DOWN = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI);
/** The matrix of one icicle: a cone with its tip down, hanging from the point (x, y, z). Pure helper for the mesh and its test. */
export function icicleMatrix(i: Icicle, out = new Matrix4()): Matrix4 {
  return out.compose(new Vector3(i.x, i.y - i.length / 2, i.z), UP_TO_DOWN, new Vector3(i.radius, i.length, i.radius));
}
/** Icicles hang from the gravestones: one instanced cone (five sides, no base), one draw call. */
export function Icicles({ icicles, name = 'icicles' }: { icicles: readonly Icicle[]; name?: string }) {
  const mesh = useMemo(() => {
    const geometry = new ConeGeometry(1, 1, 5, 1, true);
    const material = new MeshStandardMaterial({ color: '#e3f3ff', emissive: '#6ea6d6', emissiveIntensity: 0.45, roughness: 0.25, metalness: 0, flatShading: true });
    const m = new InstancedMesh(geometry, material, Math.max(1, icicles.length));
    m.count = icicles.length;
    const tmp = new Matrix4();
    icicles.forEach((ic, n) => m.setMatrixAt(n, icicleMatrix(ic, tmp)));
    m.instanceMatrix.needsUpdate = true;
    m.frustumCulled = false;
    m.name = name;
    return m;
  }, [icicles, name]);
  useEffect(
    () => () => {
      mesh.geometry.dispose();
      (mesh.material as MeshStandardMaterial).dispose();
      mesh.dispose();
    },
    [mesh],
  );
  return <primitive object={mesh} />;
}
