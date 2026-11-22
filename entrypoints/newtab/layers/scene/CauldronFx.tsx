import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import { AdditiveBlending, BufferAttribute, BufferGeometry, CircleGeometry, Mesh, Points, ShaderMaterial } from 'three';
import { mulberry32 } from '../../../../lib/scene/rng';
import { layout } from '../../../../lib/scene/layout';
import { C } from './colors';
import { useDisplay } from './display';

const RADIUS = 0.55;

const liquidVertex = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const liquidFragment = /* glsl */ `
varying vec2 vUv; uniform float uTime; uniform vec3 uColor;
float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float n(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
void main() {
  vec2 p = (vUv - 0.5) * 2.0;
  float r = length(p);
  // A slowly swirling green liquid, brighter in the middle and at the rim of the bubbles.
  float swirl = n(p * 3.0 + vec2(uTime * 0.35, -uTime * 0.25)) * 0.6 + n(p * 7.0 - uTime * 0.5) * 0.4;
  float a = smoothstep(1.0, 0.8, r);
  vec3 col = uColor * (0.55 + swirl * 0.9);
  gl_FragColor = vec4(col * a, a);
}`;
const bubbleVertex = /* glsl */ `
attribute vec4 aSeed; uniform float uTime; uniform float uRadius; varying float vA;
void main() {
  float life = fract(aSeed.w + uTime * (0.22 + aSeed.z * 0.18));
  float ang = aSeed.x * 6.2831;
  float r = sqrt(aSeed.y) * uRadius * 0.7;
  // Bubbles rise out of the pot, drift a little sideways, swell and fade as they pop.
  vec3 p = vec3(cos(ang) * r + sin(uTime + aSeed.x * 9.0) * 0.05 * life, life * 1.1, sin(ang) * r);
  vA = smoothstep(0.0, 0.08, life) * (1.0 - smoothstep(0.75, 1.0, life));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = (5.0 + aSeed.z * 9.0) * (0.6 + life * 0.8) * 55.0 / max(1.0, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const bubbleFragment = /* glsl */ `
varying float vA; uniform vec3 uColor;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  // A bubble: a thin bright ring with a faint inside.
  float ring = smoothstep(0.6, 0.85, r) * (1.0 - smoothstep(0.85, 1.0, r));
  float fill = (1.0 - smoothstep(0.0, 0.9, r)) * 0.15;
  float a = (ring + fill) * vA;
  gl_FragColor = vec4(uColor * a, a);
}`;

/**
 * The cauldron's green glow: a swirling liquid just under the rim, and bubbles that rise out of it, swell and
 * pop. The pot is the Quaternius model, drawn with the other props. The soft green pool of light on the ground
 * comes from the scene's glows.
 */
export function CauldronFx() {
  const display = useDisplay();
  const pot = useMemo(() => layout().scenery.cauldron, []);
  const liquid = useMemo(() => {
    const g = new CircleGeometry(RADIUS, 32);
    g.rotateX(-Math.PI / 2);
    const m = new ShaderMaterial({
      vertexShader: liquidVertex,
      fragmentShader: liquidFragment,
      uniforms: { uTime: { value: 0 }, uColor: { value: C.cauldron.clone().multiplyScalar(2.6) } },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      fog: false,
    });
    const mesh = new Mesh(g, m);
    mesh.renderOrder = 6;
    return mesh;
  }, []);
  const bubbles = useMemo(() => {
    const rng = mulberry32(88);
    const seeds = new Float32Array(18 * 4);
    for (let i = 0; i < seeds.length; i++) seeds[i] = rng();
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(18 * 3), 3));
    g.setAttribute('aSeed', new BufferAttribute(seeds, 4));
    const m = new ShaderMaterial({
      vertexShader: bubbleVertex,
      fragmentShader: bubbleFragment,
      uniforms: { uTime: { value: 0 }, uRadius: { value: RADIUS }, uColor: { value: C.cauldron.clone().multiplyScalar(2.4) } },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      fog: false,
    });
    const p = new Points(g, m);
    p.frustumCulled = false;
    p.renderOrder = 7;
    return p;
  }, []);
  useFrame(() => {
    const t = display.reduced ? 0 : display.time;
    (liquid.material as ShaderMaterial).uniforms.uTime!.value = t;
    (bubbles.material as ShaderMaterial).uniforms.uTime!.value = t;
  });
  return (
    <group position={[pot.x, pot.y - 0.1, pot.z]}>
      <primitive object={liquid} />
      <primitive object={bubbles} />
    </group>
  );
}
