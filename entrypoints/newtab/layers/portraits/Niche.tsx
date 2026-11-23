import { useMemo } from 'react';
import { Color } from 'three';
import type { VampireState } from '../../../../lib/hunger';
import { FRAME } from '../../../../lib/vampire/rig';

/** Mirrors the state colours in styles/tokens.css, so the niche matches the card rim. */
export const STATE_COLOR: Record<VampireState, string> = {
  awake: '#b9a5ff',
  starving: '#ff6b6b',
  asleep: '#6fb7e8',
  protected: '#f4d58a',
};

const vertex = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const fragment = /* glsl */ `
varying vec2 vUv; uniform vec3 uTint;
void main() {
  // The same dark purple as the card around it, so the window blends into the card, with a soft glow
  // in the state colour behind the head and a faint brightening toward the rim of the arch.
  vec3 card = mix(vec3(0.13, 0.07, 0.17), vec3(0.17, 0.095, 0.22), vUv.y);
  float g = smoothstep(0.7, 0.0, length((vUv - vec2(0.5, 0.62)) * vec2(1.7, 1.3)));
  float low = smoothstep(0.5, 0.0, vUv.y) * 0.5;
  vec3 col = card + uTint * (0.32 * g + 0.06 * low);
  gl_FragColor = vec4(col, 1.0);
}`;

/**
 * The portrait's own background, tinted by the state colour. It fills the whole view and
 * is the part the card hole shows around the vampire. It is drawn behind everything.
 */
export function Niche({ state }: { state: VampireState }) {
  const uniforms = useMemo(() => ({ uTint: { value: new Color(STATE_COLOR.awake) } }), []);
  uniforms.uTint.value.set(STATE_COLOR[state]);
  return (
    <mesh position={[0, FRAME.centreY, -1.0]} renderOrder={-10}>
      <planeGeometry args={[3.2, 2.4]} />
      <shaderMaterial vertexShader={vertex} fragmentShader={fragment} uniforms={uniforms} depthWrite={false} fog={false} />
    </mesh>
  );
}
