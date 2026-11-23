import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Group } from 'three';
import { MOON } from '../../../../lib/scene/sky';
import { useDisplay } from './display';

const DISTANCE = 300;
const radiusAt = (deg: number) => DISTANCE * Math.tan((deg * Math.PI) / 180);

const vertex = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
// The disc is drawn by its own shader, so its edge stays crisp. A dusty red-orange Mars-like sphere: darker
// patchy markings, a few faint craters and a darker limb. No face, no halo. Its colours are far below the
// bloom threshold (0.95), so Bloom never picks it up.
const discFragment = /* glsl */ `
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0; float a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 11.7; a *= 0.5; }
  return v;
}
// A faint soft bowl with a slightly lighter lip: returns a brightness change.
float crater(vec2 p, vec2 c, float r) {
  float d = length(p - c) / r;
  float bowl = (1.0 - smoothstep(0.4, 1.0, d)) * -0.09;
  float lip = smoothstep(0.75, 1.0, d) * (1.0 - smoothstep(1.0, 1.3, d)) * 0.05;
  return bowl + lip;
}
void main() {
  vec2 p = (vUv - 0.5) * 2.0;
  float r = length(p);
  // A very thin soft edge, about two pixels wide.
  float aa = fwidth(r) * 1.5;
  float a = 1.0 - smoothstep(1.0 - aa, 1.0, r);
  if (a <= 0.0) discard;
  float z = sqrt(max(1.0 - r * r, 0.0));
  // Dusty red-orange (#b5442a) to deep rust (#7a2418), in linear colour.
  vec3 light = vec3(0.462, 0.058, 0.023);
  vec3 dark = vec3(0.195, 0.018, 0.009);
  // Patchy darker markings: broad noise with a soft edge, plus fine grain.
  float patches = smoothstep(0.45, 0.62, fbm(p * 2.1 + 5.0));
  float grain = fbm(p * 8.0) - 0.5;
  vec3 col = mix(light, dark, patches * 0.75);
  col *= 1.0 + 0.22 * grain;
  float c = crater(p, vec2(-0.38, 0.28), 0.18) + crater(p, vec2(0.36, -0.34), 0.15) + crater(p, vec2(0.44, 0.3), 0.09)
          + crater(p, vec2(-0.2, -0.52), 0.1) + crater(p, vec2(0.05, 0.12), 0.06);
  col *= 1.0 + c;
  // Sphere shading: a little light from the upper left, and a darker limb.
  col *= 0.85 + 0.2 * dot(normalize(vec3(p, z)), normalize(vec3(-0.35, 0.4, 0.85)));
  col *= mix(0.4, 1.0, pow(z, 0.5));
  gl_FragColor = vec4(col, a);
}`;
/** The moon: a plain Mars-like disc with no face and no halo. It always faces the camera at the moon direction. */
export function Moon() {
  const display = useDisplay();
  const group = useRef<Group>(null);
  useFrame(({ camera }) => {
    const g = group.current;
    if (!g) return;
    g.position.copy(camera.position).addScaledVector(display.moon, DISTANCE);
    g.quaternion.copy(camera.quaternion);
  });
  return (
    <group ref={group} renderOrder={-90}>
      <mesh renderOrder={-90}>
        <planeGeometry args={[radiusAt(MOON.discDeg) * 2, radiusAt(MOON.discDeg) * 2]} />
        <shaderMaterial vertexShader={vertex} fragmentShader={discFragment} transparent depthWrite={false} depthTest={false} toneMapped={false} fog={false} />
      </mesh>
    </group>
  );
}
