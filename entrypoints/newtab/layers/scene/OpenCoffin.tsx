import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { AdditiveBlending, DoubleSide, type Mesh, type Object3D, type ShaderMaterial } from 'three';
import { COFFIN } from '../../../../lib/vampire/rig';
import { layout } from '../../../../lib/scene/layout';
import { C } from './colors';
import { useDisplay } from './display';

const SCALE = 2.2;
/** How far the lid is lifted at its front edge, in radians. */
const LID_OPEN = -0.62;

const vertex = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const fragment = /* glsl */ `
varying vec2 vUv; uniform vec3 uColor; uniform float uTime;
void main() {
  vec2 p = (vUv - 0.5) * 2.0;
  float a = smoothstep(1.0, 0.2, max(abs(p.x) * 1.15, abs(p.y)));
  float flick = 0.85 + 0.15 * sin(uTime * 2.1 + p.y * 3.0);
  gl_FragColor = vec4(uColor * a * flick, a * 0.9);
}`;

/**
 * A half-open coffin: the little open coffin model with its lid lifted at the front, and a soft eerie
 * glow coming from inside. It stands in the yard beside the path.
 */
export function OpenCoffin() {
  const display = useDisplay();
  const spot = useMemo(() => layout().scenery.openCoffin, []);
  const gltf = useGLTF('/models/coffin.glb', false, true);
  const glow = useRef<Mesh>(null);
  const scene = useMemo(() => {
    const root = gltf.scene.clone(true);
    let lid: Object3D | undefined;
    root.traverse((o) => {
      if (o.name === 'lid') lid = o;
    });
    if (lid) {
      // The lid hinges at its back edge: lift the front edge.
      const hingeZ = -COFFIN.length / 2;
      const half = COFFIN.length / 2;
      lid.rotation.x = LID_OPEN;
      lid.position.set(0, COFFIN.lidOffsetY - half * Math.sin(LID_OPEN), hingeZ + half * Math.cos(LID_OPEN));
    }
    return root;
  }, [gltf]);
  const uniforms = useMemo(() => ({ uColor: { value: C.mushroom.clone().multiplyScalar(1.5) }, uTime: { value: 0 } }), []);
  useFrame(() => {
    uniforms.uTime.value = display.reduced ? 0 : display.time;
    void (glow.current?.material as ShaderMaterial | undefined);
  });
  return (
    <group position={[spot.x, 0, spot.z]} rotation={[0, spot.rotY, 0]} scale={SCALE}>
      <primitive object={scene} />
      <mesh ref={glow} position={[0, COFFIN.bodyHeight - 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={6}>
        <planeGeometry args={[COFFIN.width * 0.8, COFFIN.length * 0.85]} />
        <shaderMaterial vertexShader={vertex} fragmentShader={fragment} uniforms={uniforms} transparent depthWrite={false} blending={AdditiveBlending} side={DoubleSide} fog={false} />
      </mesh>
    </group>
  );
}
