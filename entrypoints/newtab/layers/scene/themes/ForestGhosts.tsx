import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, Color, InstancedMesh, Matrix4, type Mesh, MeshBasicMaterial, PlaneGeometry, Quaternion, ShaderMaterial, Vector3 } from 'three';
import { bob, type GhostSpot } from '../../../../../lib/scene/uniqueScenes/forestParts';
import { useDisplay } from '../display';
import { buildGhost } from './forestShapes';
/** Bright green, in HDR so Bloom makes the ghosts glow. */
const GHOST_COLOR = new Color(0.45, 1, 0.38).multiplyScalar(1.9);
const wispVertex = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const wispFragment = /* glsl */ `
varying vec2 vUv;
void main() {
  float r = length(vUv - 0.5) * 2.0;
  float a = pow(clamp(1.0 - r, 0.0, 1.0), 2.4);
  gl_FragColor = vec4(vec3(1.3, 0.5, 0.12) * a, a);
}`;
const m = new Matrix4();
const q = new Quaternion();
const p = new Vector3();
const s = new Vector3();
/**
 * Small bright green ghosts floating high among the branches, bobbing slowly (one instanced mesh, one matrix write each per
 * frame), and one faint orange wisp on the left (a soft glowing disc that faces the camera). With reduced motion nothing bobs.
 */
export function ForestGhosts({ ghosts, wisp }: { ghosts: readonly GhostSpot[]; wisp: GhostSpot }) {
  const display = useDisplay();
  const wispRef = useRef<Mesh>(null);
  const mesh = useMemo(() => {
    const material = new MeshBasicMaterial({ vertexColors: true, toneMapped: false, fog: false });
    const inst = new InstancedMesh(buildGhost(), material, ghosts.length);
    ghosts.forEach((_, i) => inst.setColorAt(i, GHOST_COLOR));
    inst.frustumCulled = false;
    inst.name = 'forest-ghosts';
    return inst;
  }, [ghosts]);
  const wispParts = useMemo(
    () => ({
      geometry: new PlaneGeometry(1.8, 1.8),
      material: new ShaderMaterial({ vertexShader: wispVertex, fragmentShader: wispFragment, transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false }),
    }),
    [],
  );
  useEffect(
    () => () => {
      mesh.geometry.dispose();
      (mesh.material as MeshBasicMaterial).dispose();
      mesh.dispose();
    },
    [mesh],
  );
  useEffect(
    () => () => {
      wispParts.geometry.dispose();
      wispParts.material.dispose();
    },
    [wispParts],
  );
  useFrame(({ camera }) => {
    const t = display.time;
    ghosts.forEach((g, i) => {
      p.set(g.x, g.y + bob(g.phase, t, display.reduced), g.z);
      s.setScalar(g.scale);
      mesh.setMatrixAt(i, m.compose(p, q, s));
    });
    mesh.instanceMatrix.needsUpdate = true;
    const w = wispRef.current;
    if (w) {
      w.position.set(wisp.x, wisp.y + bob(wisp.phase, t, display.reduced), wisp.z);
      w.quaternion.copy(camera.quaternion);
    }
  });
  return (
    <>
      <primitive object={mesh} />
      <mesh ref={wispRef} geometry={wispParts.geometry} material={wispParts.material} renderOrder={5} frustumCulled={false} name="forest-wisp" />
    </>
  );
}
