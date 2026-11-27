import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { type Camera, type Group, Vector3 } from 'three';
import { MOON, moonScreenRadiusScaled, moonTarget } from '../../../../lib/scene/sky';
import { sceneColorsFor } from './colors';
import { useDisplay } from './display';
import { useColorSync, useSceneTheme } from './themeColors';

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
uniform vec3 uLight; uniform vec3 uDark; uniform float uCut; uniform float uCrisp;
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
  float aa = fwidth(r) * mix(1.5, 1.0, uCrisp);
  float a = 1.0 - smoothstep(1.0 - aa, 1.0, r);
  if (a <= uCut) discard;
  float z = sqrt(max(1.0 - r * r, 0.0));
  // The body colours come from the theme (uLight to uDark, in linear colour).
  vec3 light = uLight;
  vec3 dark = uDark;
  // Patchy darker markings: broad noise with a soft edge, plus fine grain.
  float patches = smoothstep(mix(0.45, 0.5, uCrisp), mix(0.62, 0.56, uCrisp), fbm(p * 2.1 + 5.0));
  float grain = (fbm(p * 8.0) - 0.5) * mix(1.0, 0.35, uCrisp);
  vec3 col = mix(light, dark, patches * mix(0.75, 0.6, uCrisp));
  col *= 1.0 + 0.22 * grain;
  float c = crater(p, vec2(-0.38, 0.28), 0.18) + crater(p, vec2(0.36, -0.34), 0.15) + crater(p, vec2(0.44, 0.3), 0.09)
          + crater(p, vec2(-0.2, -0.52), 0.1) + crater(p, vec2(0.05, 0.12), 0.06);
  col *= 1.0 + c;
  // Sphere shading: a little light from the upper left, and a darker limb.
  col *= 0.85 + 0.2 * dot(normalize(vec3(p, z)), normalize(vec3(-0.35, 0.4, 0.85)));
  col *= mix(mix(0.4, 0.85, uCrisp), 1.0, pow(z, 0.5));
  gl_FragColor = vec4(col, 1.0);
}`;
const forward = new Vector3();
const edge = new Vector3();
const axis = new Vector3();
/**
 * The moon's real box on screen (0 to 1, y from the top), measured from the drawn disc: its centre and four edge points
 * projected with the real camera. Written on the canvas as `data-moon-box` a few times a second, so the demo checks
 * (`npm run console:check`) can test what is drawn, not what was planned.
 */
function writeBox(el: HTMLElement, g: Group, camera: Camera, worldRadius: number): void {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [ax, sign] of [[0, 1], [0, -1], [1, 1], [1, -1]] as const) {
    axis.set(ax === 0 ? 1 : 0, ax === 1 ? 1 : 0, 0).applyQuaternion(g.quaternion);
    edge.copy(g.position).addScaledVector(axis, sign * worldRadius).project(camera);
    const sx = (edge.x + 1) / 2, sy = (1 - edge.y) / 2;
    x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
  }
  const box = [x0, y0, x1, y1].map((v) => v.toFixed(4)).join(',');
  if (el.dataset.moonBox !== box) el.dataset.moonBox = box;
}
/**
 * The moon: a plain Mars-like disc with no face. It always faces the camera at the moon direction, far away.
 *
 * With `behind` (a view depth in world units) the moon stands in the scene instead: the disc is placed at that depth, the same
 * size on screen, and drawn with the depth test and depth writes. Everything nearer (the dark trees and their branches) covers
 * it; everything farther (the trees fading into the fog) is hidden behind it.
 * Without `behind` it stays at infinity and is drawn as before.
 */
export function Moon({ behind }: { behind?: number } = {}) {
  const placed = behind !== undefined;
  const display = useDisplay();
  const group = useRef<Group>(null);
  const uniforms = useMemo(() => {
    const crypt = sceneColorsFor('crypt');
    return { uLight: { value: crypt.moonLight.clone() }, uDark: { value: crypt.moonDark.clone() }, uCrisp: { value: 0 }, uCut: { value: 0.5 } };
  }, []);
  useColorSync((c) => {
    uniforms.uLight.value.copy(c.moonLight);
    uniforms.uDark.value.copy(c.moonDark);
  });
  // A theme may ask for a crisp disc (sharp patches, firm edge).
  const crisp = useSceneTheme().scene.unique?.moon.crisp ? 1 : 0;
  const frames = useRef(0);
  useFrame(({ camera, gl }) => {
    uniforms.uCrisp.value = crisp;
    const g = group.current;
    if (!g) return;
    // At a view depth the moon is that far along the camera's forward axis, scaled down so it keeps its size on screen.
    camera.getWorldDirection(forward);
    // How far off the view axis the moon is. The disc faces the camera, so off the axis it would show 1 / cos larger than
    // `moonScreenRadiusScaled` (which every layout test plans with): the scale takes the cos back out, so the drawn size
    // matches the planned one at every window shape and wherever the moon sits.
    const cos = Math.max(0.2, display.moon.dot(forward));
    const along = placed ? behind / cos : DISTANCE;
    g.position.copy(camera.position).addScaledVector(display.moon, along);
    g.quaternion.copy(camera.quaternion);
    g.scale.setScalar(display.moonScale * (along / DISTANCE) * cos);
    // (The test renderer's canvas is not a DOM element, so it has no dataset.)
    if (frames.current++ % 15 === 0 && gl.domElement.dataset) {
      writeBox(gl.domElement, g, camera, radiusAt(MOON.discDeg) * g.scale.x);
      // The planned box (the target and radius the layout tests use), to compare with the drawn one.
      const a = display.aspect;
      const t = (display.moonTarget ?? moonTarget)(a);
      const r = moonScreenRadiusScaled(a, display.moonScale).disc;
      const plan = [t.x - r / a, t.y - r, t.x + r / a, t.y + r].map((v) => v.toFixed(4)).join(',');
      if (gl.domElement.dataset.moonPlan !== plan) gl.domElement.dataset.moonPlan = plan;
    }
  });
  return (
    // No renderOrder on the group: a group's renderOrder sorts all its children before ungrouped objects, so the
    // disc would be drawn before the sky dome (-100, no depth test), which then paints over it.
    <group ref={group}>
      <mesh renderOrder={-90}>
        <planeGeometry args={[radiusAt(MOON.discDeg) * 2, radiusAt(MOON.discDeg) * 2]} />
        <shaderMaterial vertexShader={vertex} fragmentShader={discFragment} uniforms={uniforms} transparent={false} depthWrite={placed} depthTest={placed} toneMapped={false} fog={false} />
      </mesh>
    </group>
  );
}
