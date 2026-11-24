import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { AdditiveBlending, type Mesh, Vector3 } from 'three';
import type { PortraitRef } from './shared';

/**
 * The three halo colours. They stay on the Crypt values in every theme: no theme data reaches this file.
 * Each is [r, g, b] before the multiplier (values above 1 are for the additive blend).
 */
export const HALO_COLORS = {
  starving: { color: [1.8, 0.1, 0.12], scale: 1 },
  dawn: { color: [3.0, 1.0, 0.25], scale: 0.7 },
  whiteHot: { color: [3.0, 2.2, 1.6], scale: 0.7 },
} as const;
const vertex = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const fragment = /* glsl */ `
varying vec2 vUv; uniform vec3 uColor; uniform float uLevel;
void main() {
  float r = length((vUv - vec2(0.5, 0.48)) * vec2(1.0, 0.85)) * 2.0;
  float a = pow(clamp(1.0 - r, 0.0, 1.0), 1.8) * uLevel;
  gl_FragColor = vec4(uColor * a, a);
}`;

/**
 * Glow for the portrait canvas. A shared Bloom pass cannot be used here, because every view is
 * drawn into its own scissor rectangle, so glowing things get a soft additive halo behind them
 * instead: the red pulse of a starving vampire, the burning edge of Dawn and the flash of the bat.
 * (Decision for task 7.5: halo billboard, not Bloom.)
 */
export function GlowHalo({ state }: { state: PortraitRef }) {
  const mesh = useRef<Mesh>(null);
  const uniforms = useMemo(() => ({ uColor: { value: new Vector3(1, 0.1, 0.12) }, uLevel: { value: 0 } }), []);
  useFrame(() => {
    const s = state.current;
    if (!s || !mesh.current) return;
    const ex = s.exit;
    // Dawn: orange from the burning edge. Crypt: white-hot flash. Otherwise the starving red pulse.
    const dawn = ex ? ex.edge : 0;
    const flash = ex ? ex.flash : 0;
    const red = s.pose.glow * (ex ? 1 - ex.dissolve : 1);
    const level = Math.max(red * 0.55, dawn * 1.1, flash * 1.3);
    mesh.current.visible = level > 0.01;
    uniforms.uLevel.value = level;
    if (dawn > red && dawn > flash) uniforms.uColor.value.set(...HALO_COLORS.dawn.color).multiplyScalar(HALO_COLORS.dawn.scale);
    else if (flash > red) uniforms.uColor.value.set(...HALO_COLORS.whiteHot.color).multiplyScalar(HALO_COLORS.whiteHot.scale);
    else uniforms.uColor.value.set(...HALO_COLORS.starving.color).multiplyScalar(HALO_COLORS.starving.scale);
  });
  return (
    <mesh ref={mesh} position={[0, 0.78, -0.4]} visible={false} renderOrder={-5}>
      <planeGeometry args={[1.3, 1.3]} />
      <shaderMaterial vertexShader={vertex} fragmentShader={fragment} uniforms={uniforms} transparent depthWrite={false} blending={AdditiveBlending} />
    </mesh>
  );
}
