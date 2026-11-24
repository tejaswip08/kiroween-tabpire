import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { AdditiveBlending, BufferAttribute, BufferGeometry, InstancedBufferAttribute, InstancedMesh, Matrix4, Quaternion, ShaderMaterial, Vector3 } from 'three';
import { mulberry32 } from '../../../../../lib/scene/rng';
import type { Flame } from '../../../../../lib/scene/uniqueScenes/forestParts';
import { useDisplay } from '../display';
import { buildFlame } from './forestShapes';
const flameVertex = /* glsl */ `
attribute float aPhase;
uniform float uTime;
varying float vH;
void main() {
  vH = position.y;
  float f = 0.82 + 0.14 * sin(uTime * 8.0 + aPhase * 6.2832) + 0.08 * sin(uTime * 13.7 + aPhase * 17.0);
  vec3 p = position;
  p.y *= f;
  p.x += sin(uTime * 5.0 + aPhase * 6.2832 + p.y * 4.0) * 0.14 * p.y;
  p.z += cos(uTime * 4.3 + aPhase * 9.0 + p.y * 3.0) * 0.1 * p.y;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.0);
}`;
const flameFragment = /* glsl */ `
varying float vH;
void main() {
  // Deep red at the root, hot orange in the middle, a pale yellow tip, fading out at the top.
  vec3 col = mix(vec3(1.6, 0.18, 0.02), vec3(3.2, 1.2, 0.18), smoothstep(0.0, 0.55, vH));
  col = mix(col, vec3(3.4, 2.4, 0.7), smoothstep(0.6, 1.0, vH));
  float a = 0.95 * (1.0 - smoothstep(0.7, 1.0, vH));
  gl_FragColor = vec4(col * a, a);
}`;
const sparkVertex = /* glsl */ `
attribute vec4 aSeed;
uniform float uTime; uniform float uPixel; uniform vec3 uOrigin;
varying float vAlpha;
void main() {
  float life = fract(aSeed.x + uTime * (0.1 + aSeed.y * 0.1));
  vec3 p = uOrigin + vec3(
    (aSeed.z - 0.5) * 1.6 + sin(uTime * 0.9 + aSeed.w * 30.0) * 0.5 * life,
    0.4 + life * (3.0 + aSeed.y * 3.0),
    (aSeed.w - 0.5) * 1.4 + cos(uTime * 0.8 + aSeed.z * 30.0) * 0.5 * life);
  vAlpha = smoothstep(0.0, 0.08, life) * (1.0 - smoothstep(0.55, 1.0, life));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uPixel * (0.5 + aSeed.y) * 12.0 / max(1.0, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const sparkFragment = /* glsl */ `
varying float vAlpha;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float a = clamp(1.0 - r, 0.0, 1.0) * vAlpha;
  gl_FragColor = vec4(vec3(3.0, 1.1, 0.2) * a, a);
}`;
/**
 * The fire at the foot of the haunted tree: low flickering flames (thin cones animated in the vertex shader, one instanced
 * mesh) and a few sparks rising from them (one points object). The warm light on the trunks is a real light from the spec.
 * Reduced motion holds both still.
 */
export function ForestFire({ x, z, flames, sparks }: { x: number; z: number; flames: readonly Flame[]; sparks: number }) {
  const display = useDisplay();
  const flameMesh = useMemo(() => {
    const geo = buildFlame();
    geo.setAttribute('aPhase', new InstancedBufferAttribute(Float32Array.from(flames.map((f) => f.phase)), 1));
    const material = new ShaderMaterial({
      vertexShader: flameVertex,
      fragmentShader: flameFragment,
      uniforms: { uTime: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      fog: false,
    });
    const mesh = new InstancedMesh(geo, material, flames.length);
    const m = new Matrix4();
    const q = new Quaternion();
    flames.forEach((f, i) => mesh.setMatrixAt(i, m.compose(new Vector3(x + f.dx, 0, z + f.dz), q, new Vector3(f.radius, f.height, f.radius))));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    mesh.renderOrder = 4;
    mesh.name = 'forest-flames';
    return mesh;
  }, [flames, x, z]);
  const sparkPoints = useMemo(() => {
    const rng = mulberry32(991);
    const seeds = new Float32Array(sparks * 4);
    for (let i = 0; i < seeds.length; i++) seeds[i] = rng();
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(sparks * 3), 3));
    geo.setAttribute('aSeed', new BufferAttribute(seeds, 4));
    return { geo, material: new ShaderMaterial({
      vertexShader: sparkVertex,
      fragmentShader: sparkFragment,
      uniforms: { uTime: { value: 0 }, uPixel: { value: 1 }, uOrigin: { value: new Vector3(x, 0, z) } },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      fog: false,
    }) };
  }, [sparks, x, z]);
  useEffect(
    () => () => {
      flameMesh.geometry.dispose();
      (flameMesh.material as ShaderMaterial).dispose();
      flameMesh.dispose();
    },
    [flameMesh],
  );
  useEffect(
    () => () => {
      sparkPoints.geo.dispose();
      sparkPoints.material.dispose();
    },
    [sparkPoints],
  );
  useFrame(({ gl }) => {
    const t = display.reduced ? 0 : display.time;
    (flameMesh.material as ShaderMaterial).uniforms.uTime!.value = t;
    sparkPoints.material.uniforms.uTime!.value = t;
    sparkPoints.material.uniforms.uPixel!.value = gl.getPixelRatio();
  });
  return (
    <>
      <primitive object={flameMesh} />
      <points geometry={sparkPoints.geo} material={sparkPoints.material} frustumCulled={false} renderOrder={6} name="forest-sparks" />
    </>
  );
}
