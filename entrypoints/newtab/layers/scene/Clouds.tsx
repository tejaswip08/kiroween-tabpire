import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import { InstancedBufferAttribute, InstancedMesh, PlaneGeometry, ShaderMaterial, Vector3 } from 'three';
import { cloudPuffs } from '../../../../lib/scene/sky';
import { useDisplay } from './display';

const vertex = /* glsl */ `
attribute vec4 aA; attribute vec4 aB; attribute vec4 aC;
uniform float uTime; uniform vec3 uMoon; uniform vec3 uRight; uniform vec3 uUp;
varying vec2 vUv; varying float vShade; varying float vFade;
const float R = 350.0;
float sm(float x) { x = clamp(x, 0.0, 1.0); return x * x * (3.0 - 2.0 * x); }
void main() {
  vUv = uv; vShade = aB.z;
  // Same drift and wrap as lib/scene/sky.ts cloudU, and the same fade at the lane ends (cloudFade).
  float span = aC.y - aC.x;
  float raw = aA.x - aC.x + aA.y * uTime;
  float cu = aC.x + mod(mod(raw, span) + span, span);
  float f = clamp((cu - aC.x) / span, 0.0, 1.0);
  vFade = sm(f / 0.14) * (1.0 - sm((f - 0.86) / 0.14));
  float u = cu + aA.w;
  float v = aA.z + aB.x;
  vec3 dir = normalize(uMoon + uRight * tan(radians(u)) + uUp * tan(radians(v)));
  vec3 center = cameraPosition + dir * R;
  vec3 camRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 camUp = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  float w = R * tan(radians(aB.y)) * 2.0;
  vec3 p = center + camRight * position.x * w + camUp * position.y * w * aB.w;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;
const fragment = /* glsl */ `
varying vec2 vUv; varying float vShade; varying float vFade;
void main() {
  vec2 p = (vUv - 0.5) * 2.0;
  float r = length(p);
  // A slightly lumpy edge, so a puff is not a perfect circle.
  float ang = atan(p.y, p.x);
  r *= 1.0 + 0.10 * sin(ang * 3.0 + vShade * 20.0) + 0.05 * sin(ang * 7.0 + vShade * 9.0);
  float a = smoothstep(1.0, 0.3, r) * 0.34 * vFade;
  // Dark, low-contrast body: a little lighter on top, with a faint rose edge toward the moon (right).
  vec3 body = vec3(0.045, 0.045, 0.1) + vShade * vec3(0.018, 0.015, 0.03);
  body += vec3(0.02, 0.02, 0.04) * smoothstep(-0.2, 0.9, p.y);
  vec3 col = mix(body, vec3(0.2, 0.07, 0.12), smoothstep(0.1, 1.0, vUv.x) * 0.3);
  gl_FragColor = vec4(col, a);
}`;

/** Dark, soft clouds made of nine overlapping puffs each, drifting slowly. One draw call. */
export function Clouds() {
  const display = useDisplay();
  const puffs = useMemo(() => cloudPuffs(), []);
  const mesh = useMemo(() => {
    const geo = new PlaneGeometry(1, 1);
    const a = new Float32Array(puffs.length * 4);
    const b = new Float32Array(puffs.length * 4);
    const c = new Float32Array(puffs.length * 4);
    puffs.forEach((p, i) => {
      a.set([p.u0, p.speed, p.v, p.offU], i * 4);
      b.set([p.offV, p.radius, p.shade, p.ratio], i * 4);
      c.set([p.uMin, p.uMax, 0, 0], i * 4);
    });
    geo.setAttribute('aA', new InstancedBufferAttribute(a, 4));
    geo.setAttribute('aB', new InstancedBufferAttribute(b, 4));
    geo.setAttribute('aC', new InstancedBufferAttribute(c, 4));
    const mat = new ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: { uTime: { value: 0 }, uMoon: { value: new Vector3() }, uRight: { value: new Vector3() }, uUp: { value: new Vector3() } },
      transparent: true,
      depthWrite: false,
      fog: false,
    });
    const m = new InstancedMesh(geo, mat, puffs.length);
    m.frustumCulled = false;
    m.renderOrder = -80;
    return m;
  }, [puffs]);
  useFrame(() => {
    const u = (mesh.material as ShaderMaterial).uniforms;
    u.uTime!.value = display.time;
    (u.uMoon!.value as Vector3).copy(display.moon);
    (u.uRight!.value as Vector3).copy(display.moonRight);
    (u.uUp!.value as Vector3).copy(display.moonUp);
  });
  return <primitive object={mesh} />;
}
