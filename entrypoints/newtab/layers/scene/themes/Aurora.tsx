import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { AdditiveBlending, BackSide, type Mesh, ShaderMaterial, Vector3 } from 'three';
import { AURORA_ELEVATION, AURORA_FULL_DISCS, AURORA_OFF_DISCS, AURORA_PEAK, AURORA_SPEED } from '../../../../../lib/scene/aurora';
import { MOON } from '../../../../../lib/scene/sky';
import { useDisplay } from '../display';

const f = (n: number) => n.toFixed(4);
const vertex = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
// A bright green-teal ribbon that waves slowly across the sky, with a fainter blue ribbon above it. Each ribbon is a curtain: sharp and
// bright at its lower edge, fading upward, with fine vertical rays. Added on top of the sky, behind the moon and the clouds, and faded
// out around the moon (the same numbers as `auroraClearance`), so the moon disc is never lit by it.
export const AURORA_FRAGMENT = /* glsl */ `
varying vec3 vDir;
uniform float uTime; uniform vec3 uMoonDir; uniform float uMoonScale;
void main() {
  vec3 d = normalize(vDir);
  float az = atan(d.x, -d.z);
  float el = d.y;
  float t = uTime * ${f(AURORA_SPEED)};
  vec3 col = vec3(0.0);
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    // The waving edge of the curtain: a long slow wave plus a shorter one that travels the other way.
    float edge = ${f(AURORA_ELEVATION[0] + 0.06)} + fk * 0.09 + 0.07 * sin(az * (1.6 + 0.5 * fk) + t * (1.0 + 0.3 * fk) + fk * 2.0) + 0.025 * sin(az * 5.0 - t * 1.7 + fk);
    float up = el - edge;
    // Sharp lower edge, long soft fade upward.
    float curtain = smoothstep(-0.012, 0.012, up) * exp(-max(up, 0.0) / (0.075 + 0.02 * fk));
    float rays = 0.62 + 0.38 * sin(az * (26.0 + 8.0 * fk) + t * 2.2 + fk) * (0.6 + 0.4 * sin(az * 7.0 + t * 0.9));
    // Green at the foot of the curtain, teal higher up; the third ribbon is a cold blue.
    vec3 foot = k == 2 ? vec3(0.2, 0.55, 1.0) : vec3(0.18, 1.0, 0.5);
    vec3 head = k == 2 ? vec3(0.4, 0.5, 1.0) : vec3(0.1, 0.8, 0.95);
    vec3 tint = mix(foot, head, clamp(up * 9.0, 0.0, 1.0));
    col += tint * curtain * rays * (k == 2 ? 0.55 : (k == 1 ? 0.75 : 1.0));
  }
  col *= smoothstep(${f(AURORA_ELEVATION[0] - 0.05)}, ${f(AURORA_ELEVATION[0] + 0.05)}, el) * (1.0 - smoothstep(${f(AURORA_ELEVATION[1] - 0.1)}, ${f(AURORA_ELEVATION[1])}, el));
  // Off around the moon.
  float disc = ${f(MOON.discDeg)} * uMoonScale;
  float angle = degrees(acos(clamp(dot(d, normalize(uMoonDir)), -1.0, 1.0)));
  float clear = smoothstep(disc * ${f(AURORA_OFF_DISCS)}, disc * ${f(AURORA_FULL_DISCS)}, angle);
  gl_FragColor = vec4(col * ${f(AURORA_PEAK)} * clear, 1.0);
}`;
/**
 * The aurora of the Frozen Cemetery: one transparent dome (one draw call) that follows the camera like the sky, drawn right after
 * the sky and before the moon and the clouds. It moves with `display.time`, which stays at 0 under reduced motion.
 */
export function Aurora() {
  const display = useDisplay();
  const mesh = useRef<Mesh>(null);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: AURORA_FRAGMENT,
        uniforms: { uTime: { value: 0 }, uMoonDir: { value: new Vector3(0.5, 0.2, -0.8) }, uMoonScale: { value: 1 } },
        side: BackSide,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        depthTest: false,
        fog: false,
      }),
    [],
  );
  useFrame(({ camera }) => {
    mesh.current?.position.copy(camera.position);
    // Under reduced motion the bands stand still.
    material.uniforms.uTime!.value = display.reduced ? 0 : display.time;
    material.uniforms.uMoonScale!.value = display.moonScale;
    (material.uniforms.uMoonDir!.value as Vector3).copy(display.moon);
  });
  return (
    <mesh ref={mesh} material={material} frustumCulled={false} renderOrder={-99} name="aurora">
      <sphereGeometry args={[480, 24, 12]} />
    </mesh>
  );
}
