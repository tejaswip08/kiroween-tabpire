import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { Color, InstancedMesh, Matrix4, Quaternion, ShaderMaterial, Vector3, type BufferGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { FOG_BAND_Z, TREE_LINE_Z, type Bump, type Midground, type Spot } from '../../../../../lib/scene/uniqueScenes/forestHouse';
import type { ScaryTree } from '../../../../../lib/scene/uniqueScenes/forestParts';
import { useDisplay } from '../display';
import { useSceneTheme } from '../themeColors';
import { buildBump, buildFarTree, buildLineTree, buildStump } from './witchHouseShapes';
const FAR_VARIANTS = 3;
const matrix = new Matrix4();
const quat = new Quaternion();
const UP = new Vector3(0, 1, 0);
/** One instanced mesh of a shape at each spot, static: the matrices are written once. */
function instancesOf(geometry: BufferGeometry, spots: readonly Spot[], name: string): InstancedMesh {
  const mesh = new InstancedMesh(geometry, undefined, Math.max(1, spots.length));
  spots.forEach((t, i) => mesh.setMatrixAt(i, matrix.compose(new Vector3(t.x, 0, t.z), quat.setFromAxisAngle(UP, t.rotY), new Vector3(t.scale, t.scale, t.scale))));
  mesh.count = spots.length;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  mesh.name = name;
  return mesh;
}
const fogVertex = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
// A band of thick ground fog: solid at the bottom, thinning out upward, with a slow drift in its density.
const fogFragment = /* glsl */ `
varying vec2 vUv;
uniform vec3 uFog; uniform vec3 uHaze; uniform float uTime; uniform float uStrength;
void main() {
  float up = vUv.y;
  float wobble = 0.9 + 0.1 * sin(vUv.x * 90.0 + uTime * 0.12) * sin(vUv.x * 37.0 - uTime * 0.07);
  float a = pow(1.0 - up, 1.7) * uStrength * wobble;
  vec3 col = mix(uFog, uHaze, smoothstep(0.0, 1.0, up) * 0.75);
  gl_FragColor = vec4(col * a, a);
}`;
/** Premultiplied alpha, drawn normally (not additive). */
function fogMaterial(strength: number): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: fogVertex,
    fragmentShader: fogFragment,
    uniforms: { uFog: { value: new Color() }, uHaze: { value: new Color() }, uTime: { value: 0 }, uStrength: { value: strength } },
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
    fog: false,
  });
}
/**
 * Thick ground fog along the horizon, so the dark ground melts into the bright sky with no hard line. Two bands, the far one
 * taller. Static meshes, a time uniform for the slow drift.
 */
function HorizonFog() {
  const display = useDisplay();
  const { colors } = useSceneTheme();
  const far = useMemo(() => fogMaterial(0.96), []);
  const near = useMemo(() => fogMaterial(0.7), []);
  useEffect(() => {
    for (const m of [far, near]) {
      m.uniforms.uFog!.value.copy(colors.fog);
      m.uniforms.uHaze!.value.copy(colors.haze).lerp(colors.fog, 0.35);
    }
  }, [far, near, colors]);
  useEffect(() => () => { far.dispose(); near.dispose(); }, [far, near]);
  useFrame(() => {
    const t = display.reduced ? 0 : display.time;
    far.uniforms.uTime!.value = t;
    near.uniforms.uTime!.value = t * 1.3 + 40;
  });
  return (
    <>
      <mesh position={[0, 3.2, FOG_BAND_Z]} material={far} renderOrder={2} name="forest-horizon-fog">
        <planeGeometry args={[420, 7]} />
      </mesh>
      <mesh position={[0, 1.6, -44]} material={near} renderOrder={3} name="forest-ground-fog">
        <planeGeometry args={[260, 3.4]} />
      </mesh>
    </>
  );
}
/** One ragged row of dark cones along the far edge: the tree-line. One mesh, unlit, with a fixed dark colour (the fog band covers its feet). */
function TreeLine({ trees }: { trees: Midground['lineTrees'] }) {
  const geometry = useMemo(() => {
    const parts = trees.map((t) => buildLineTree().scale(t.width, t.height, t.width).translate(t.x, -0.3, TREE_LINE_Z));
    return mergeGeometries(parts)!;
  }, [trees]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} frustumCulled={false} name="forest-tree-line">
      <meshBasicMaterial color="#0c2217" fog={false} />
    </mesh>
  );
}
/**
 * The middle and the back of the Witch's Forest: low rolling bumps, two layers of small dead trees fading into the fog, a few
 * black bare trees whose branches cross the moon, stumps, a ragged tree-line and thick ground fog at the horizon.
 * (The fallen logs and the little groups of crosses and tombstones are drawn by `ForestTrees`.)
 */
export function ForestMidground({ mid }: { mid: Midground }) {
  const meshes = useMemo(() => {
    const far = (list: readonly ScaryTree[], prefix: string) => Array.from({ length: FAR_VARIANTS }, (_, v) => instancesOf(buildFarTree(v), list.filter((t) => t.variant === v), prefix));
    const bumps = new InstancedMesh(buildBump(), undefined, Math.max(1, mid.bumps.length));
    mid.bumps.forEach((b: Bump, i) => bumps.setMatrixAt(i, matrix.compose(new Vector3(b.x, -0.05, b.z), quat.setFromAxisAngle(UP, b.rotY), new Vector3(b.rx, b.h, b.rz))));
    bumps.count = mid.bumps.length;
    bumps.instanceMatrix.needsUpdate = true;
    bumps.frustumCulled = false;
    bumps.name = 'forest-bumps';
    return { fogged: far(mid.farTrees, 'forest-far-tree'), black: far(mid.moonTrees, 'forest-moon-tree'), stumps: instancesOf(buildStump(), mid.stumps, 'forest-stumps'), bumps };
  }, [mid]);
  useEffect(
    () => () => {
      for (const m of [...meshes.fogged, ...meshes.black, meshes.stumps, meshes.bumps]) {
        m.geometry.dispose();
        m.dispose();
      }
    },
    [meshes],
  );
  return (
    <>
      <primitive object={meshes.bumps}>
        <meshStandardMaterial attach="material" color="#10241a" roughness={1} metalness={0} />
      </primitive>
      {meshes.fogged.map((m, i) => (
        <primitive key={`f${i}`} object={m}>
          <meshStandardMaterial attach="material" vertexColors roughness={1} metalness={0} flatShading />
        </primitive>
      ))}
      {meshes.black.map((m, i) => (
        <primitive key={`b${i}`} object={m}>
          <meshBasicMaterial attach="material" color="#070a08" fog={false} />
        </primitive>
      ))}
      <primitive object={meshes.stumps}>
        <meshStandardMaterial attach="material" vertexColors roughness={1} metalness={0} flatShading />
      </primitive>
      <TreeLine trees={mid.lineTrees} />
      <HorizonFog />
    </>
  );
}
