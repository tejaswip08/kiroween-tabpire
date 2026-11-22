import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import { AdditiveBlending, BufferAttribute, BufferGeometry } from 'three';
import { LOOK } from '../../../../lib/scene/config';
import { mulberry32 } from '../../../../lib/scene/rng';
import { C } from './colors';
import { useDisplay } from './display';

const COUNT = 400;

const vertex = /* glsl */ `
attribute vec4 aSeed;
uniform float uTime; uniform float uRate; uniform float uBurst; uniform float uPixel;
varying float vAlpha;
void main() {
  // Seed: x, z position in the graveyard, y: start height share, w: how late this ember appears.
  float speed = (0.35 + aSeed.y * 0.5) * (0.4 + uRate * 1.6) * (1.0 + uBurst * 3.0);
  float life = fract(aSeed.y * 7.0 + uTime * speed * 0.12);
  float height = 1.0 + life * (9.0 + uBurst * 14.0);
  vec3 p = vec3(
    aSeed.x * 52.0 - 26.0 + sin(uTime * 0.6 + aSeed.y * 40.0) * 0.8 * life * 4.0,
    height - 1.0,
    aSeed.z * 48.0 - 36.0 + cos(uTime * 0.5 + aSeed.x * 30.0) * 0.7 * life * 4.0
  );
  // More embers appear as the rate rises, and all appear in a burst.
  float shown = step(aSeed.w, uRate * 0.7 + 0.15 + uBurst);
  vAlpha = shown * smoothstep(0.0, 0.1, life) * (1.0 - smoothstep(0.6, 1.0, life));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uPixel * (0.6 + aSeed.w) * 14.0 / max(1.0, -mv.z) * (1.0 + uBurst);
  gl_Position = projectionMatrix * mv;
}`;
const fragment = /* glsl */ `
varying float vAlpha; uniform vec3 uColor;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float a = clamp(1.0 - r, 0.0, 1.0) * vAlpha;
  gl_FragColor = vec4(uColor * a, a);
}`;

/** Warm sparks that rise from the ground. All motion is in the shader. They burst upward on Dawn. */
export function Embers() {
  const display = useDisplay();
  const geometry = useMemo(() => {
    const rng = mulberry32(77);
    const seeds = new Float32Array(COUNT * 4);
    for (let i = 0; i < seeds.length; i++) seeds[i] = rng();
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(COUNT * 3), 3));
    g.setAttribute('aSeed', new BufferAttribute(seeds, 4));
    return g;
  }, []);
  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uRate: { value: 0.15 }, uBurst: { value: 0 }, uPixel: { value: 1 }, uColor: { value: C.ember.clone().multiplyScalar(LOOK.glow.ember) } }),
    [],
  );
  useFrame(({ gl }) => {
    uniforms.uTime.value = display.time;
    uniforms.uRate.value = display.emberRate;
    uniforms.uBurst.value = display.burst;
    uniforms.uPixel.value = gl.getPixelRatio();
  });
  return (
    <points geometry={geometry} frustumCulled={false} renderOrder={6}>
      <shaderMaterial vertexShader={vertex} fragmentShader={fragment} uniforms={uniforms} transparent depthWrite={false} blending={AdditiveBlending} fog={false} />
    </points>
  );
}
