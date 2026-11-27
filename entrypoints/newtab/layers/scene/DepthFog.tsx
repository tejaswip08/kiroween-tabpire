import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import { FOG_BANDS } from '../../../../lib/scene/depthFog';
import { sceneColorsFor } from './colors';
import { useDisplay } from './display';
import { useColorSync } from './themeColors';
const vertex = /* glsl */ `
varying vec2 vUv; varying vec3 vWorld;
void main() {
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const fragment = /* glsl */ `
varying vec2 vUv; varying vec3 vWorld;
uniform vec3 uColor; uniform float uTime; uniform float uAlpha; uniform float uSpeed; uniform float uScale;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y);
}
void main() {
  vec2 p = vec2(vWorld.x * uScale + uTime * uSpeed, vUv.y * 1.6);
  float n = noise(p) * 0.6 + noise(p * 2.7 + 5.0) * 0.4;
  // Thick at the ground, thin toward the top, faded at both ends so no edge shows.
  float body = (1.0 - smoothstep(0.0, 1.0, vUv.y)) * smoothstep(0.0, 0.12, vUv.x) * (1.0 - smoothstep(0.88, 1.0, vUv.x));
  gl_FragColor = vec4(uColor, body * (0.55 + 0.45 * n) * uAlpha);
}`;
/**
 * Soft ground fog between the Crypt's backdrop layers (lib/scene/depthFog.ts): upright bands that drift slowly sideways, so the far
 * trees, mausoleums and village fade into depth. One draw call per band. With reduced motion they hold still.
 */
export function DepthFog() {
  const display = useDisplay();
  const uniforms = useMemo(() => {
    const color = { value: sceneColorsFor('crypt').fog.clone() };
    const time = { value: 0 };
    return { color, time, bands: FOG_BANDS.map((b) => ({ uColor: color, uTime: time, uAlpha: { value: b.alpha }, uSpeed: { value: b.speed }, uScale: { value: b.scale } })) };
  }, []);
  useColorSync((c) => {
    uniforms.color.value.copy(c.fog);
  });
  useFrame(() => {
    uniforms.time.value = display.reduced ? 0 : display.time;
  });
  return (
    <>
      {FOG_BANDS.map((b, i) => (
        <mesh key={i} position={[b.x, b.h / 2 - 0.2, b.z]} renderOrder={1} frustumCulled={false}>
          <planeGeometry args={[b.w, b.h]} />
          <shaderMaterial vertexShader={vertex} fragmentShader={fragment} uniforms={uniforms.bands[i]!} transparent depthWrite={false} fog={false} />
        </mesh>
      ))}
    </>
  );
}
