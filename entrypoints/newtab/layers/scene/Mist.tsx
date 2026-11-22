import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import { DoubleSide, Vector3 } from 'three';
import { BUDGET, LOOK } from '../../../../lib/scene/config';
import { flicker } from '../../../../lib/scene/flicker';
import { layout } from '../../../../lib/scene/layout';
import { C } from './colors';
import { useDisplay } from './display';

/** Height, scroll direction and speed, and thickness of each mist layer. */
const LAYERS = [
  { y: 0.12, dir: [0.5, 0.15], speed: 0.3, alpha: 1.5, scale: 0.06 },
  { y: 0.4, dir: [0.6, 0.2], speed: 0.35, alpha: 1.3, scale: 0.09 },
  { y: 0.8, dir: [-0.4, 0.5], speed: 0.22, alpha: 0.95, scale: 0.07 },
  { y: 1.4, dir: [0.3, -0.6], speed: 0.15, alpha: 0.6, scale: 0.055 },
  { y: 2.4, dir: [-0.7, -0.1], speed: 0.1, alpha: 0.4, scale: 0.045 },
] as const;

const vertex = /* glsl */ `
varying vec3 vWorld; varying vec2 vLocal;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz; vLocal = position.xy;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const fragment = /* glsl */ `
varying vec3 vWorld; varying vec2 vLocal;
uniform float uTime; uniform vec2 uDir; uniform float uSpeed; uniform float uAlpha; uniform float uScale; uniform float uFog;
uniform vec3 uCold; uniform vec3 uWarm; uniform vec3 uLights[6]; uniform float uLevel[6];
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y);
}
void main() {
  vec2 p = vWorld.xz * uScale + uDir * uSpeed * uTime;
  float n = noise(p) * 0.55 + noise(p * 2.3 + 7.0) * 0.3 + noise(p * 5.1 + 3.0) * 0.15;
  float d = smoothstep(0.32, 0.85, n);
  // Fade toward the edge of the sheet so no edge shows.
  float edge = 1.0 - smoothstep(0.55, 1.0, length(vLocal / vec2(36.0, 30.0)));
  // Warm light tints the fog near each warm source.
  vec3 tint = vec3(0.0);
  for (int i = 0; i < 6; i++) {
    float dist = distance(vWorld.xz, uLights[i].xz);
    tint += uWarm * uLevel[i] * exp(-dist * dist / 28.0);
  }
  vec3 col = uCold + tint * 1.4;
  float a = d * edge * uAlpha * uFog;
  gl_FragColor = vec4(col, a * (1.0 + length(tint) * 0.8));
}`;

/** Four drifting layers of ground mist, thicker with memory, tinted warm near the warm lights. */
export function Mist() {
  const display = useDisplay();
  const lights = useMemo(() => layout().lights.slice(0, BUDGET.maxPointLights), []);
  const shared = useMemo(
    () => ({
      uLights: { value: Array.from({ length: 6 }, (_, i) => new Vector3(lights[i]?.x ?? 0, 0, lights[i]?.z ?? 0)) },
      uLevel: { value: [1, 1, 1, 1, 1, 1].map<number>((_, i) => (lights[i] ? 1 : 0)) },
      uCold: { value: C.fog.clone().multiplyScalar(1.4) },
      uWarm: { value: C.lantern.clone().multiplyScalar(0.55) },
      uFog: { value: 1 },
      uTime: { value: 0 },
    }),
    [lights],
  );
  const layers = useMemo(
    () =>
      LAYERS.map((l) => ({
        ...shared,
        uDir: { value: l.dir },
        uSpeed: { value: l.speed },
        uAlpha: { value: l.alpha * LOOK.mist.alpha },
        uScale: { value: l.scale },
      })),
    [shared],
  );
  useFrame(() => {
    shared.uTime.value = display.time;
    shared.uFog.value = display.fogFactor;
    for (let i = 0; i < lights.length; i++) shared.uLevel.value[i] = flicker(display.time, i + 1, display.reduced);
  });
  return (
    <>
      {LAYERS.map((l, i) => (
        <mesh key={i} position={[0, l.y, -14]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2 + i} frustumCulled={false}>
          <planeGeometry args={[72, 60]} />
          <shaderMaterial
            vertexShader={vertex}
            fragmentShader={fragment}
            uniforms={layers[i]!}
            transparent
            depthWrite={false}
            side={DoubleSide}
            fog={false}
          />
        </mesh>
      ))}
    </>
  );
}
