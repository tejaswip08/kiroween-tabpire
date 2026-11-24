import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import { AdditiveBlending, CircleGeometry, type Color, Mesh, ShaderMaterial } from 'three';
import { sceneColorsFor } from './colors';
import { useDisplay } from './display';
import { useColorSync, useSceneTheme } from './themeColors';

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
/**
 * The cauldron's green glow: a swirling liquid just under the rim (no bubbles or rings). The pot is the Quaternius model, drawn with the other props. The soft green pool of light on the ground
 * comes from the scene's glows.
 */
const LIQUID_LEVEL = 2.6;
export function CauldronFx() {
  const display = useDisplay();
  const { scene } = useSceneTheme();
  const pot = useMemo(() => scene.layout.scenery.cauldron, [scene.layout.scenery.cauldron]);
  const liquid = useMemo(() => {
    const g = new CircleGeometry(RADIUS, 32);
    g.rotateX(-Math.PI / 2);
    const m = new ShaderMaterial({
      vertexShader: liquidVertex,
      fragmentShader: liquidFragment,
      uniforms: { uTime: { value: 0 }, uColor: { value: sceneColorsFor('crypt').cauldron.clone().multiplyScalar(LIQUID_LEVEL) } },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      fog: false,
    });
    const mesh = new Mesh(g, m);
    mesh.renderOrder = 6;
    return mesh;
  }, []);
  useColorSync((c) => {
    ((liquid.material as ShaderMaterial).uniforms.uColor!.value as Color).copy(c.cauldron).multiplyScalar(LIQUID_LEVEL);
  });
  useFrame(() => {
    const t = display.reduced ? 0 : display.time;
    (liquid.material as ShaderMaterial).uniforms.uTime!.value = t;
  });
  return (
    <group position={[pot.x, pot.y - 0.1, pot.z]}>
      <primitive object={liquid} />
    </group>
  );
}
