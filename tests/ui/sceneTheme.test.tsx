// @vitest-environment jsdom
// Task 9.3: a switch of theme updates uniforms and fog colour in place. Meshes and uniform objects are not rebuilt.
import { _roots, createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { sceneColorsFor } from '../../entrypoints/newtab/layers/scene/colors';
import { Clouds } from '../../entrypoints/newtab/layers/scene/Clouds';
import { createDisplay, DisplayContext } from '../../entrypoints/newtab/layers/scene/display';
import { Fog } from '../../entrypoints/newtab/layers/scene/SceneContents';
import { Embers } from '../../entrypoints/newtab/layers/scene/Embers';
import { Ghosts } from '../../entrypoints/newtab/layers/scene/Ghosts';
import { LowClouds } from '../../entrypoints/newtab/layers/scene/LowClouds';
import { Mist } from '../../entrypoints/newtab/layers/scene/Mist';
import { Moon } from '../../entrypoints/newtab/layers/scene/Moon';
import { Sky } from '../../entrypoints/newtab/layers/scene/Sky';
import { SceneThemeContext, sceneThemeFor } from '../../entrypoints/newtab/layers/scene/themeColors';
import { Wisps } from '../../entrypoints/newtab/layers/scene/Wisps';
import { sceneState } from '../../lib/scene/meaning';
import type { ThemeId } from '../../lib/themes';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
extend(THREE as never);

const display = createDisplay(
  sceneState({ cardCount: 5, starvingCount: 1, estimatedMb: 500, cryptCount: 1, crypted: 1, garlicCount: 0, staked: 0, coffined: 0, dawnReady: false }),
  true,
);
/** A renderer that draws nothing: enough for r3f to mount, with `frameloop: never`. */
function fakeGl(canvas: HTMLCanvasElement) {
  return {
    domElement: canvas,
    setPixelRatio() {}, setSize() {}, render() {}, dispose() {}, setClearColor() {}, getPixelRatio: () => 1,
    shadowMap: { enabled: false, type: 0 }, xr: { enabled: false, addEventListener() {}, removeEventListener() {} },
    outputColorSpace: 'srgb', toneMapping: 0, info: { render: { calls: 0, triangles: 0 } },
    getContext: () => ({}),
  } as never;
}
let root: ReturnType<typeof createRoot> | undefined;
afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
});
const Scene = ({ id }: { id: ThemeId }) => (
  <DisplayContext.Provider value={display}>
    <SceneThemeContext value={sceneThemeFor(id)}>
      <Sky />
      <Moon />
      <Clouds />
      <LowClouds />
      <Ghosts />
      <Wisps />
      <Mist />
      <Embers />
      <Fog />
      <mesh name="probe" />
    </SceneThemeContext>
  </DisplayContext.Provider>
);
type Mat = THREE.ShaderMaterial;
function shaderMaterials(scene: THREE.Object3D): Mat[] {
  const out: Mat[] = [];
  scene.traverse((o) => {
    const m = (o as THREE.Mesh).material as Mat | undefined;
    if (m && (m as Mat).isShaderMaterial) out.push(m);
  });
  return out;
}
const near = (a: THREE.Color, b: THREE.Color) => Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b) < 1e-6;

describe('the scene under another theme', () => {
  it('copies the new colours into the same uniforms and builds nothing new', async () => {
    const canvas = document.createElement('canvas');
    root = createRoot(canvas);
    await act(async () => {
      await root!.configure({ gl: fakeGl as never, frameloop: 'never', size: { width: 100, height: 100, top: 0, left: 0 }, events: undefined } as never);
      root!.render(<Scene id="crypt" />);
    });
    const scene = _roots.get(canvas)!.store.getState().scene;
    const before = shaderMaterials(scene);
    expect(before.length).toBeGreaterThan(6);
    const fogBefore = scene.fog as THREE.FogExp2;
    expect(near(fogBefore.color, sceneColorsFor('crypt').fog)).toBe(true);
    // Frost is a unique scene: its clouds are laid out for its own moon size and the Crypt's wisps (uColor) are not in it, so those
    // two are built again. Every other layer keeps its mesh, material and uniform objects.
    const rebuilt = (m: Mat) => 'uTint' in m.uniforms || Object.keys(m.uniforms).join() === 'uColor';
    const kept = before.filter((m) => !rebuilt(m));
    expect(kept.length).toBe(before.length - 2);
    const ids = kept.map((m) => m.uuid);
    const objects = kept.map((m) => m.uniforms);
    const uniformObjs = kept.map((m) => Object.values(m.uniforms));
    const meshes: THREE.Object3D[] = [];
    scene.traverse((o) => meshes.push(o));
    const crypt = sceneColorsFor('crypt');
    const sky = before.find((m) => 'uTop' in m.uniforms)!;
    expect(near(sky.uniforms.uTop!.value, crypt.skyTop)).toBe(true);

    await act(async () => {
      root!.render(<Scene id="frost" />);
    });
    const frost = sceneColorsFor('frost');
    const after = shaderMaterials(scene).filter((m) => ids.includes(m.uuid));
    expect(after.map((m) => m.uuid)).toEqual(ids);
    after.forEach((m, i) => {
      expect(m.uniforms).toBe(objects[i]);
      Object.values(m.uniforms).forEach((u, j) => expect(u).toBe(uniformObjs[i]![j]));
    });
    const meshesAfter: THREE.Object3D[] = [];
    scene.traverse((o) => meshesAfter.push(o));
    // The meshes of the layers that stay are the same objects (the ghosts move to the new spots on the same mesh).
    for (const o of meshes) {
      const m = (o as THREE.Mesh).material as Mat | undefined;
      if (!m || !('uniforms' in m) || !rebuilt(m)) expect(meshesAfter).toContain(o);
    }
    expect(scene.fog).toBe(fogBefore);
    expect(near(fogBefore.color, frost.fog)).toBe(true);
    // The values moved to the frost colours.
    expect(near(sky.uniforms.uTop!.value, frost.skyTop)).toBe(true);
    expect(near(sky.uniforms.uMid!.value, frost.skyMid)).toBe(true);
    const moon = after.find((m) => 'uLight' in m.uniforms)!;
    expect(near(moon.uniforms.uLight!.value, frost.moonLight)).toBe(true);
    const afterAll = shaderMaterials(scene);
    const clouds = afterAll.find((m) => 'uTint' in m.uniforms)!;
    expect(near(clouds.uniforms.uBody!.value, frost.cloudBody)).toBe(true);
    const low = afterAll.find((m) => 'uFogColor' in m.uniforms)!;
    expect(near(low.uniforms.uBody!.value, frost.lowCloud)).toBe(true);
    // The shared colour sets are not changed.
    expect(near(sceneColorsFor('crypt').skyTop, crypt.skyTop)).toBe(true);
  });
});
