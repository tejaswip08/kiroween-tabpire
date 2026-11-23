import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import { DoubleSide, InstancedBufferAttribute, Mesh, ShaderMaterial, Vector3 } from 'three';
import { cameraAt, directionAt } from '../../../../lib/scene/camera';
import { CAPS } from '../../../../lib/scene/config';
import { mulberry32 } from '../../../../lib/scene/rng';
import { makeInstancedBat } from './batGeometry';
import { useDisplay } from './display';

const vertex = /* glsl */ `
attribute vec2 aWing; attribute vec4 aOrbit; attribute vec4 aOrbit2;
uniform float uTime; uniform float uCount; uniform vec3 uCenter;
varying vec3 vN; varying float vReach; varying float vKind; varying float vShade;
void main() {
  float id = float(gl_InstanceID);
  // A loose flock on curved paths: every bat flies its own wide loop around a slowly drifting centre.
  float t = uTime * aOrbit.z;
  vec3 radius = vec3(20.0 + aOrbit2.x * 10.0, 4.0 + aOrbit2.y * 3.0, 13.0 + aOrbit2.z * 8.0);
  vec3 drift = vec3(sin(uTime * 0.04 + 1.0) * 10.0, sin(uTime * 0.07) * 2.0, cos(uTime * 0.05) * 6.0);
  vec3 c = uCenter + drift + vec3(sin(t + aOrbit.x) * radius.x, sin(t * 1.7 + aOrbit.y) * radius.y, cos(t * 0.9 + aOrbit.x * 1.3) * radius.z);
  vec3 vel = vec3(cos(t + aOrbit.x) * radius.x, cos(t * 1.7 + aOrbit.y) * radius.y * 1.7, -sin(t * 0.9 + aOrbit.x * 1.3) * radius.z * 0.9) * aOrbit.z;
  vec3 f = normalize(vel);
  vec3 r = normalize(cross(f, vec3(0.0, 1.0, 0.0)));
  // Bank into the turn.
  float bank = clamp(dot(normalize(vec3(-vel.z, 0.0, vel.x)), vec3(0.0, 1.0, 0.0)) + sin(t) * 0.25, -0.5, 0.5);
  vec3 u = normalize(cross(r, f));
  r = normalize(r + u * bank * 0.5); u = normalize(cross(r, f));

  vKind = aWing.x; vReach = aWing.y;
  vec3 p = position;
  float s = aWing.y;
  if (abs(aWing.x) > 0.5) {
    // A real wing beat: the shoulder and the elbow lead, the wrist and tip follow a moment later, so the
    // wing bends as it goes up and down. The wing also folds in a little on the upstroke.
    float phase = uTime * (9.0 + aOrbit.w * 2.0) + id * 2.3;
    float beat = sin(phase);
    float lag = sin(phase - 0.9 * s - 0.5);
    p.y += (beat * 0.22 * s + lag * 0.5 * s * s) * 0.9;
    p.x *= 1.0 - 0.16 * max(-beat, 0.0) * s;
    p.z += 0.05 * s * lag;
  } else {
    p.y += sin(uTime * (9.0 + aOrbit.w * 2.0) + id * 2.3) * 0.02;
  }
  float scale = (1.3 + aOrbit2.w * 0.7) * clamp(uCount - id, 0.0, 1.0);
  vec3 world = c + (r * p.x + u * p.y - f * p.z) * scale;
  vN = normalize(r * normal.x + u * normal.y - f * normal.z);
  vShade = aOrbit2.w;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}`;
const fragment = /* glsl */ `
varying vec3 vN; varying float vReach; varying float vKind; varying float vShade;
uniform vec3 uMoon;
void main() {
  vec3 n = normalize(vN);
  if (!gl_FrontFacing) n = -n;
  // Near-black fur and membrane, so they read as silhouettes against the sky and the moon.
  float lit = max(dot(n, normalize(uMoon)), 0.0);
  float rim = pow(1.0 - abs(n.y), 2.0) * 0.5;
  vec3 base = vec3(0.012, 0.006, 0.022) + vec3(0.008, 0.004, 0.01) * vShade;
  // Nearly black silhouettes: only a faint red edge where the moon catches them.
  vec3 col = base + vec3(0.3, 0.035, 0.06) * pow(lit, 2.0) * 0.5 + vec3(0.05, 0.03, 0.09) * rim;
  gl_FragColor = vec4(col, 1.0);
}`;

/**
 * A flock of small 3D bats: a round body, ears, and two jointed wings with scalloped edges that beat up and
 * down. They fly loose loops around a drifting centre, bank into turns and are lit by the moon. One draw call.
 * A few are always out, and the tabs saved to the Crypt add more, up to 24.
 */
export function Bats() {
  const display = useDisplay();
  const mesh = useMemo(() => {
    const geo = makeInstancedBat(CAPS.bats);
    const rng = mulberry32(2024);
    const orbit = new Float32Array(CAPS.bats * 4);
    const orbit2 = new Float32Array(CAPS.bats * 4);
    for (let i = 0; i < CAPS.bats; i++) {
      orbit.set([rng() * 6.28, rng() * 6.28, 0.09 + rng() * 0.08, rng()], i * 4);
      orbit2.set([rng(), rng(), rng(), rng()], i * 4);
    }
    geo.setAttribute('aOrbit', new InstancedBufferAttribute(orbit, 4));
    geo.setAttribute('aOrbit2', new InstancedBufferAttribute(orbit2, 4));
    const mat = new ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: { uTime: { value: 0 }, uCount: { value: 0 }, uCenter: { value: new Vector3() }, uMoon: { value: new Vector3() } },
      side: DoubleSide,
      fog: false,
    });
    const m = new Mesh(geo, mat);
    m.frustumCulled = false;
    m.renderOrder = -60;
    return m;
  }, []);
  const lastShape = useMemo(() => ({ v: -1 }), []);
  useFrame(() => {
    const u = (mesh.material as ShaderMaterial).uniforms;
    u.uTime!.value = display.time;
    u.uCount!.value = Math.max(7, display.bats);
    (u.uMoon!.value as Vector3).copy(display.moon);
    if (lastShape.v !== display.shapeVersion) {
      lastShape.v = display.shapeVersion;
      // The flock circles around the moon's side of the sky, so some bats cross in front of it, whatever the window shape.
      const cam = cameraAt(0, display.aspect, true);
      const d = directionAt(0.5, 0.2, cam);
      (u.uCenter!.value as Vector3).set(cam.position[0] + d[0] * 85, cam.position[1] + d[1] * 85, cam.position[2] + d[2] * 85);
    }
  });
  return <primitive object={mesh} />;
}
