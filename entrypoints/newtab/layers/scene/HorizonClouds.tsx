import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { Color, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, SphereGeometry, Vector3 } from 'three';
import { CLOUD_BLOBS, PUFF_SEGMENTS, cloudFade, cloudX, cryptClouds, type CryptCloud } from '../../../../lib/scene/horizonClouds';
import { useDisplay } from './display';
const m = new Matrix4();
const pos = new Vector3();
const scl = new Vector3();
const rot = new Quaternion();
const WHITE = new Color('#ffffff');
/** Puffs above this height (in the cloud's own space) are its lit top; the rest is its darker underside. */
const TOP_FROM = 0.2;
/**
 * A material whose glow follows each puff's own colour (the instance colour), so every cloud keeps its colour in the dark: the
 * emissive colour is multiplied by the instance colour.
 */
function cloudMaterial(glow: number): MeshStandardMaterial {
  const mat = new MeshStandardMaterial({ color: WHITE, emissive: new Color(glow, glow, glow), roughness: 1, fog: false });
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('vec3 totalEmissiveRadiance = emissive;', 'vec3 totalEmissiveRadiance = emissive * vColor.rgb;');
  };
  return mat;
}
/** Writes every puff of one part (tops or undersides) of every cloud, at time t. */
function place(mesh: InstancedMesh, clouds: readonly CryptCloud[], blobs: typeof CLOUD_BLOBS, t: number): void {
  let i = 0;
  for (const c of clouds) {
    const cx = cloudX(c, t);
    const cy = c.y + Math.sin(t * 0.2 + c.x0) * 0.3 * c.k;
    const sc = c.scale * cloudFade(c, t);
    for (const [x, y, z, r] of blobs) {
      pos.set(cx + x * sc * 1.25, cy + y * sc * 0.7, c.z + z * sc * 0.8);
      scl.set(r * sc * 1.25, r * sc * 0.7, r * sc * 0.8);
      mesh.setMatrixAt(i++, m.compose(pos, rot, scl));
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
}
/**
 * The Crypt's six soft round clouds, as the first prototype drew them: a dark violet layer high above the moon and a pink layer low
 * near the horizon, with lit tops and darker undersides. They drift right to left and wrap around, so the sky never empties.
 * Two instanced meshes for all of them (tops and undersides). With reduced motion they hold still.
 */
export function HorizonClouds() {
  const display = useDisplay();
  const clouds = useMemo(() => cryptClouds(), []);
  const parts = useMemo(() => {
    const geo = new SphereGeometry(1, PUFF_SEGMENTS[0], PUFF_SEGMENTS[1]);
    const make = (blobs: typeof CLOUD_BLOBS, glow: number, tone: (c: Color) => Color) => {
      const mesh = new InstancedMesh(geo, cloudMaterial(glow), clouds.length * blobs.length);
      mesh.frustumCulled = false;
      mesh.name = 'crypt-clouds';
      const col = new Color();
      let i = 0;
      for (const c of clouds) for (let k = 0; k < blobs.length; k++) mesh.setColorAt(i++, tone(col.set(c.color)));
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      place(mesh, clouds, blobs, 0);
      return { mesh, blobs };
    };
    const tops = CLOUD_BLOBS.filter((b) => b[1] > TOP_FROM);
    const unders = CLOUD_BLOBS.filter((b) => b[1] <= TOP_FROM);
    // Lit tops a little lighter, undersides darker (the prototype's colours: +12 % white, and 72 %).
    return { geo, list: [make(tops, 0.27, (c) => c.lerp(WHITE, 0.12)), make(unders, 0.25, (c) => c.multiplyScalar(0.72))] };
  }, [clouds]);
  useEffect(() => () => {
    parts.geo.dispose();
    for (const p of parts.list) (p.mesh.material as MeshStandardMaterial).dispose();
  }, [parts]);
  useFrame(() => {
    if (display.reduced) return;
    for (const p of parts.list) place(p.mesh, clouds, p.blobs, display.time);
  });
  return (
    <>
      {parts.list.map((p, i) => (
        <primitive key={i} object={p.mesh} />
      ))}
    </>
  );
}
