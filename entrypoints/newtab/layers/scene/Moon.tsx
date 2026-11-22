import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { AdditiveBlending, Color, type Group, type Mesh } from 'three';
import { LOOK } from '../../../../lib/scene/config';
import { MOON } from '../../../../lib/scene/sky';
import { C } from './colors';
import { useDisplay } from './display';

const DISTANCE = 300;
const radiusAt = (deg: number) => DISTANCE * Math.tan((deg * Math.PI) / 180);

const haloVertex = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const haloFragment = /* glsl */ `
varying vec2 vUv; uniform vec3 uColor; uniform float uPower; uniform float uStrength; uniform float uInner;
void main() {
  float r = length(vUv - 0.5) * 2.0;
  // Starts at the disc's edge and fades smoothly to nothing at the rim of the quad.
  float t = clamp((r - uInner) / (1.0 - uInner), 0.0, 1.0);
  float a = pow(1.0 - t, uPower) * uStrength * step(uInner * 0.9, r);
  gl_FragColor = vec4(uColor * a, a);
}`;
// The disc is drawn by its own shader, so its edge stays sharp without antialiasing. Dark craters
// are soft, irregular patches of different sizes, never a face.
const discFragment = /* glsl */ `
varying vec2 vUv; uniform vec3 uColor;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
// A soft patch whose outline wobbles with the angle, so no two look alike.
float crater(vec2 p, vec2 c, float r, float seed) {
  vec2 d = p - c;
  float a = atan(d.y, d.x);
  float wob = 1.0 + 0.4 * (noise(vec2(a * 1.4 + seed, seed * 3.1)) - 0.5) + 0.22 * (noise(vec2(a * 3.3 + seed * 2.0, seed)) - 0.5);
  return smoothstep(r * wob, r * wob * 0.35, length(d));
}
void main() {
  vec2 p = (vUv - 0.5) * 2.0;
  float r = length(p);
  float aa = fwidth(r) * 1.2;
  float a = 1.0 - smoothstep(1.0 - aa, 1.0, r);
  if (a <= 0.0) discard;
  float spots = 0.0;
  spots += crater(p, vec2(-0.36, 0.24), 0.31, 1.0) * 0.55;
  spots += crater(p, vec2(0.28, -0.32), 0.23, 2.0) * 0.5;
  spots += crater(p, vec2(0.42, 0.38), 0.12, 3.0) * 0.5;
  spots += crater(p, vec2(-0.12, -0.56), 0.09, 4.0) * 0.45;
  spots += crater(p, vec2(0.66, 0.02), 0.06, 5.0) * 0.4;
  spots += crater(p, vec2(-0.66, -0.16), 0.07, 6.0) * 0.4;
  spots += crater(p, vec2(0.04, 0.58), 0.05, 7.0) * 0.4;
  spots += crater(p, vec2(-0.16, 0.0), 0.045, 8.0) * 0.35;
  spots += crater(p, vec2(0.2, 0.13), 0.035, 9.0) * 0.35;
  // Faint uneven mottling across the whole disc.
  spots += clamp((noise(p * 3.4 + 4.0) * 0.6 + noise(p * 8.0) * 0.3 - 0.4) * 0.5, 0.0, 0.3);
  vec3 col = uColor * (1.0 - min(spots, 1.0) * 0.5);
  col *= 1.0 - 0.14 * smoothstep(0.65, 1.0, r);
  gl_FragColor = vec4(col, a);
}`;

/**
 * The blood moon: a plain red glowing disc with no face, and a soft halo that pulses with
 * the hunger share. It always faces the camera and sits at the moon direction.
 */
export function Moon() {
  const display = useDisplay();
  const group = useRef<Group>(null);
  const halo = useRef<Mesh>(null);
  const outer = useRef<Mesh>(null);
  const discU = useMemo(() => ({ uColor: { value: new Color('#e0142e').multiplyScalar(LOOK.glow.moon) } }), []);
  // The halo starts at the disc's edge (inner = disc size over halo size).
  const innerU = useMemo(
    () => ({ uColor: { value: new Color('#e0142e').multiplyScalar(0.8) }, uPower: { value: 2.0 }, uStrength: { value: 1 }, uInner: { value: MOON.discDeg / MOON.haloDeg } }),
    [],
  );
  const outerU = useMemo(
    () => ({ uColor: { value: new Color('#a00e3c').multiplyScalar(0.7) }, uPower: { value: 2.4 }, uStrength: { value: 0.6 }, uInner: { value: MOON.haloDeg / (MOON.haloDeg * 1.7) } }),
    [],
  );
  useFrame(({ camera }) => {
    const g = group.current;
    if (!g) return;
    g.position.copy(camera.position).addScaledVector(display.moon, DISTANCE);
    g.quaternion.copy(camera.quaternion);
    // Size and brightness pulse together.
    const k = 1 + display.haloAmplitude * display.haloPulse;
    halo.current?.scale.setScalar(k);
    outer.current?.scale.setScalar(1 + (k - 1) * 0.6);
    innerU.uStrength.value = k;
  });
  return (
    <group ref={group} renderOrder={-90}>
      <mesh ref={outer} renderOrder={-92}>
        <planeGeometry args={[radiusAt(MOON.haloDeg * 1.7) * 2, radiusAt(MOON.haloDeg * 1.7) * 2]} />
        <shaderMaterial vertexShader={haloVertex} fragmentShader={haloFragment} uniforms={outerU} transparent depthWrite={false} depthTest={false} blending={AdditiveBlending} fog={false} />
      </mesh>
      <mesh ref={halo} renderOrder={-91}>
        <planeGeometry args={[radiusAt(MOON.haloDeg) * 2, radiusAt(MOON.haloDeg) * 2]} />
        <shaderMaterial vertexShader={haloVertex} fragmentShader={haloFragment} uniforms={innerU} transparent depthWrite={false} depthTest={false} blending={AdditiveBlending} fog={false} />
      </mesh>
      <mesh renderOrder={-90}>
        <planeGeometry args={[radiusAt(MOON.discDeg) * 2, radiusAt(MOON.discDeg) * 2]} />
        <shaderMaterial vertexShader={haloVertex} fragmentShader={discFragment} uniforms={discU} transparent depthWrite={false} depthTest={false} fog={false} />
      </mesh>
    </group>
  );
}
