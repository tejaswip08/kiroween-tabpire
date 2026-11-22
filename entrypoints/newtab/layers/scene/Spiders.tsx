import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import {
  BufferAttribute, BufferGeometry, DoubleSide, Euler, InstancedMesh, LineBasicMaterial, LineSegments, Matrix4, MeshBasicMaterial, PlaneGeometry, Quaternion, ShaderMaterial, Vector3,
} from 'three';
import { spiderLength } from '../../../../lib/scene/critters';
import { layout } from '../../../../lib/scene/layout';
import { at, ball, mergePieces, stickBetween, type Piece } from './critterGeo';
import { useDisplay } from './display';

const BODY: [number, number, number] = [0.04, 0.03, 0.06];
const LEG: [number, number, number] = [0.03, 0.025, 0.05];
const EYE: [number, number, number] = [2.6, 0.3, 0.2];
const SCALE = 3.2;

function spiderGeometry() {
  const pieces: Piece[] = [
    { geo: ball(0.06, 8, 6), matrix: at(0, 0, 0.06, 1, 0.85, 1), color: BODY }, // head and thorax
    { geo: ball(0.1, 9, 7), matrix: at(0, 0.01, -0.09, 1, 0.9, 1.15), color: BODY }, // abdomen
    { geo: ball(0.012, 5, 4), matrix: at(-0.025, 0.02, 0.115), color: EYE },
    { geo: ball(0.012, 5, 4), matrix: at(0.025, 0.02, 0.115), color: EYE },
  ];
  // Eight jointed legs: out and up, then down and out.
  for (const side of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      const z = 0.1 - k * 0.055;
      const spread = 0.15 + (k === 0 || k === 3 ? 0.03 : 0.08);
      const a: [number, number, number] = [side * 0.04, 0.0, z];
      const knee: [number, number, number] = [side * (0.04 + spread), 0.09, z + (k < 2 ? 0.05 : -0.05)];
      const foot: [number, number, number] = [side * (0.04 + spread * 1.8), -0.07, z + (k < 2 ? 0.1 : -0.1)];
      pieces.push({ geo: stickBetween(a, knee, 0.005, 4), color: LEG });
      pieces.push({ geo: stickBetween(knee, foot, 0.005, 4), color: LEG });
    }
  }
  return mergePieces(pieces);
}

const tmpM = new Matrix4();
const tmpQ = new Quaternion();
const tmpP = new Vector3();
const tmpS = new Vector3(SCALE, SCALE, SCALE);
const tmpE = new Euler();

/**
 * Small spiders hanging on silk threads from a dead tree, bobbing up and down and turning slowly. One
 * instanced mesh for the spiders and one line mesh for the threads.
 */
export function Spiders() {
  const display = useDisplay();
  const spiders = useMemo(() => layout().scenery.spiders, []);
  const { mesh, threads, attr } = useMemo(() => {
    const m = new InstancedMesh(spiderGeometry(), new MeshBasicMaterial({ vertexColors: true, toneMapped: false }), spiders.length);
    m.frustumCulled = false;
    const g = new BufferGeometry();
    const a = new BufferAttribute(new Float32Array(spiders.length * 6), 3);
    g.setAttribute('position', a);
    const l = new LineSegments(g, new LineBasicMaterial({ color: 0xccc8f2, transparent: true, opacity: 0.55 }));
    l.frustumCulled = false;
    return { mesh: m, threads: l, attr: a };
  }, [spiders.length]);
  useFrame(() => {
    spiders.forEach((s, i) => {
      const len = spiderLength(display.reduced ? 0 : display.time, s.seed, s.drop);
      const y = s.topY - len;
      tmpP.set(s.x, y, s.z);
      tmpQ.setFromEuler(tmpE.set(0.6, display.reduced ? 0 : Math.sin(display.time * 0.7 + s.seed) * 0.7, 0));
      tmpM.compose(tmpP, tmpQ, tmpS);
      mesh.setMatrixAt(i, tmpM);
      // The thread runs from the branch down to the top of the spider.
      attr.setXYZ(i * 2, s.x, s.topY, s.z);
      attr.setXYZ(i * 2 + 1, s.x, y + 0.1 * SCALE, s.z);
    });
    mesh.instanceMatrix.needsUpdate = true;
    attr.needsUpdate = true;
  });
  return (
    <>
      <primitive object={mesh} />
      <primitive object={threads} />
    </>
  );
}

const webVertex = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`;
const webFragment = /* glsl */ `
varying vec2 vUv;
void main() {
  // A web hung from the top corners: strands fan out from a point near the top and rings sag between them.
  vec2 p = (vUv - vec2(0.5, 0.78)) * vec2(2.0, 2.0);
  float r = length(p);
  float ang = atan(p.y, p.x);
  float spokes = abs(fract(ang * 9.0 / 6.2831853 + 0.5) - 0.5) * r;
  float rings = abs(fract(r * 3.2 + 0.1 * sin(ang * 5.0)) - 0.5);
  float w = fwidth(r) * 1.4 + 0.012;
  float line = max(1.0 - smoothstep(0.0, w * 1.2, spokes), 1.0 - smoothstep(0.0, w * 2.6, rings * 0.5));
  float inside = smoothstep(1.25, 0.9, r) * step(0.0, vUv.y * 1.0 - 0.02) * smoothstep(0.0, 0.1, 1.0 - vUv.y);
  float a = line * inside * 0.55;
  gl_FragColor = vec4(vec3(0.85, 0.82, 1.0) * a, a);
}`;

/** Cobwebs hung between neighbouring gravestones: thin strands and sagging rings, drawn in the shader. One draw call. */
export function Cobwebs() {
  const webs = useMemo(() => layout().scenery.cobwebs, []);
  const mesh = useMemo(() => {
    const mat = new ShaderMaterial({ vertexShader: webVertex, fragmentShader: webFragment, transparent: true, depthWrite: false, side: DoubleSide, fog: false });
    const m = new InstancedMesh(new PlaneGeometry(1, 1), mat, Math.max(1, webs.length));
    const q = new Quaternion();
    webs.forEach((w, i) => m.setMatrixAt(i, new Matrix4().compose(new Vector3(w.x, w.y + w.h * 0.1, w.z), q.setFromEuler(new Euler(0, w.rotY, 0)), new Vector3(w.w, w.h, 1))));
    m.count = webs.length;
    m.frustumCulled = false;
    m.renderOrder = 6;
    return m;
  }, [webs]);
  return <primitive object={mesh} />;
}
