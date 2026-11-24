import { useEffect, useMemo } from 'react';
import { Euler, IcosahedronGeometry, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import { MOUND_SQUASH, type Mound } from '../../../../../lib/scene/uniqueScenes/frostIce';

/** The matrix of one mound: a squashed icosahedron centred on the snow, so its upper half shows. */
export function moundMatrix(m: Mound, out = new Matrix4()): Matrix4 {
  return out.compose(new Vector3(m.x, 0, m.z), new Quaternion().setFromEuler(new Euler(0, m.rotY, 0)), new Vector3(m.radius, m.radius * MOUND_SQUASH, m.radius));
}
/** White low-poly snow mounds: one instanced icosahedron (20 triangles each), one draw call. */
export function SnowMounds({ mounds }: { mounds: readonly Mound[] }) {
  const mesh = useMemo(() => {
    const geometry = new IcosahedronGeometry(1, 0);
    const material = new MeshStandardMaterial({ color: '#f6faff', emissive: '#9fb8d6', emissiveIntensity: 0.3, roughness: 1, metalness: 0, flatShading: true });
    const m = new InstancedMesh(geometry, material, Math.max(1, mounds.length));
    m.count = mounds.length;
    const tmp = new Matrix4();
    mounds.forEach((mound, n) => m.setMatrixAt(n, moundMatrix(mound, tmp)));
    m.instanceMatrix.needsUpdate = true;
    m.frustumCulled = false;
    m.receiveShadow = true;
    m.name = 'snow-mounds';
    return m;
  }, [mounds]);
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
