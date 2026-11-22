import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import { AdditiveBlending, InstancedBufferAttribute, InstancedMesh, Matrix4, PlaneGeometry, Quaternion, ShaderMaterial, Vector3 } from 'three';
import { LOOK } from '../../../../lib/scene/config';
import { flicker } from '../../../../lib/scene/flicker';
import { layout, type WarmSource } from '../../../../lib/scene/layout';
import { C } from './colors';
import { useDisplay } from './display';

const FLAME_SIZE: Record<WarmSource['kind'], number> = { candle: 0.5, lantern: 1.3, jackOLantern: 1.3, postLantern: 1.4, cryptDoor: 0 };
const POOL_RADIUS: Record<WarmSource['kind'], number> = { candle: 1.6, lantern: 3.4, jackOLantern: 3.2, postLantern: 3.8, cryptDoor: 5.5 };

const vertex = /* glsl */ `
attribute vec3 aColor;
varying vec2 vUv; varying vec3 vColor;
uniform float uBillboard;
void main() {
  vUv = uv; vColor = aColor;
  vec4 center = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  float s = length(instanceMatrix[0].xyz);
  vec4 flat_ = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  vec4 bill = center + vec4(position.xy * s, 0.0, 0.0);
  gl_Position = projectionMatrix * mix(flat_, bill, uBillboard);
}`;
const fragment = /* glsl */ `
varying vec2 vUv; varying vec3 vColor; uniform float uPower;
void main() {
  float r = length(vUv - 0.5) * 2.0;
  float a = pow(clamp(1.0 - r, 0.0, 1.0), uPower);
  gl_FragColor = vec4(vColor * a, a);
}`;

function makeMesh(sources: WarmSource[], billboard: boolean, power: number, level: (s: WarmSource) => number): InstancedMesh {
  const geo = new PlaneGeometry(1, 1);
  if (!billboard) geo.rotateX(-Math.PI / 2);
  const mat = new ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    uniforms: { uBillboard: { value: billboard ? 1 : 0 }, uPower: { value: power } },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    fog: false,
  });
  const mesh = new InstancedMesh(geo, mat, sources.length);
  mesh.frustumCulled = false;
  mesh.renderOrder = billboard ? 5 : 3;
  const colors = new Float32Array(sources.length * 3);
  sources.forEach((s, i) => {
    const base = s.kind === 'jackOLantern' ? C.jack : s.kind === 'candle' ? C.candle : s.kind === 'cryptDoor' ? C.door : C.lantern;
    const k = level(s);
    colors.set([base.r * k, base.g * k, base.b * k], i * 3);
  });
  geo.setAttribute('aColor', new InstancedBufferAttribute(colors, 3));
  return mesh;
}

const m4 = new Matrix4();
const q = new Quaternion();
const p = new Vector3();
const sc = new Vector3();

/**
 * Warm light that needs no real light: soft pools on the ground under every warm source, and
 * small bright flames and glass in HDR colours, which Bloom picks up. Candles follow the data.
 */
export function Glows() {
  const display = useDisplay();
  const sources = useMemo(() => layout().glows, []);
  const flames = useMemo(() => sources.filter((s) => FLAME_SIZE[s.kind] > 0), [sources]);
  const pools = useMemo(
    () => makeMesh(sources, false, 2.2, (s) => (s.kind === 'candle' ? 0.22 : s.kind === 'cryptDoor' ? 0.5 : 0.38)),
    [sources],
  );
  const flameMesh = useMemo(
    () => makeMesh(flames, true, 2.6, (s) => (s.kind === 'candle' ? LOOK.glow.flame : s.kind === 'jackOLantern' ? LOOK.glow.jack : LOOK.glow.glass)),
    [flames],
  );

  useFrame(() => {
    const t = display.time;
    sources.forEach((s, i) => {
      const k = s.kind === 'candle' && s.slot !== undefined ? Math.min(1, Math.max(0, display.candles - s.slot)) : 1;
      const f = flicker(t, i + 11, display.reduced);
      const r = POOL_RADIUS[s.kind] * k * (0.94 + 0.06 * f);
      p.set(s.x, 0.06, s.z);
      sc.set(r, 1, r);
      pools.setMatrixAt(i, m4.compose(p, q, sc));
    });
    pools.instanceMatrix.needsUpdate = true;
    flames.forEach((s, i) => {
      const k = s.kind === 'candle' && s.slot !== undefined ? Math.min(1, Math.max(0, display.candles - s.slot)) : 1;
      const f = flicker(t, i + 3, display.reduced);
      const size = FLAME_SIZE[s.kind] * k * f;
      p.set(s.x, s.y, s.z);
      sc.set(size, size, size);
      flameMesh.setMatrixAt(i, m4.compose(p, q, sc));
    });
    flameMesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <primitive object={pools} />
      <primitive object={flameMesh} />
    </>
  );
}
