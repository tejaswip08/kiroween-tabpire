// @vitest-environment jsdom
// Task 13: the weather is one Points object per theme, drawn from the shader, none for the Crypt.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { _roots, advance, createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { sceneColorsFor } from '../../entrypoints/newtab/layers/scene/colors';
import { createDisplay, DisplayContext } from '../../entrypoints/newtab/layers/scene/display';
import { SceneThemeContext, sceneThemeFor } from '../../entrypoints/newtab/layers/scene/themeColors';
import { SceneWeather } from '../../entrypoints/newtab/layers/scene/Weather';
import { sceneState } from '../../lib/scene/meaning';
import { REDUCED_TIME, WEATHER } from '../../lib/scene/weather';
import { THEME_IDS, type ThemeId } from '../../lib/themes';
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
extend(THREE as never);
const state = sceneState({ cardCount: 5, starvingCount: 1, estimatedMb: 500, cryptCount: 1, crypted: 1, garlicCount: 0, staked: 0, coffined: 0, dawnReady: false });
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
async function mount(id: ThemeId, reduced: boolean) {
  const display = createDisplay(state, reduced);
  const canvas = document.createElement('canvas');
  root = createRoot(canvas);
  const view = (t: ThemeId) => (
    <DisplayContext.Provider value={display}>
      <SceneThemeContext value={sceneThemeFor(t)}>
        <SceneWeather />
      </SceneThemeContext>
    </DisplayContext.Provider>
  );
  await act(async () => {
    await root!.configure({ gl: fakeGl as never, frameloop: 'never', size: { width: 100, height: 100, top: 0, left: 0 }, events: undefined } as never);
    root!.render(view(id));
  });
  const store = _roots.get(canvas)!.store;
  const points = () => {
    const out: THREE.Points[] = [];
    store.getState().scene.traverse((o) => { if ((o as THREE.Points).isPoints) out.push(o as THREE.Points); });
    return out;
  };
  return { store, points, display, rerender: (t: ThemeId) => act(async () => root!.render(view(t))) };
}
const near = (a: THREE.Color, b: THREE.Color) => Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b) < 1e-6;
describe('Weather mount', () => {
  it('draws nothing for the Crypt', async () => {
    const m = await mount('crypt', false);
    expect(m.points()).toHaveLength(0);
  });
  it.each(THEME_IDS.filter((t) => t !== 'crypt'))('%s: one Points object, full draw range, colours from the theme', async (id) => {
    const m = await mount(id, false);
    const pts = m.points();
    expect(pts).toHaveLength(1);
    const p = pts[0]!;
    const spec = sceneThemeFor(id).scene.weather!;
    expect(p.geometry.drawRange).toEqual({ start: 0, count: spec.count });
    expect(p.renderOrder).toBe(6);
    const mat = p.material as THREE.ShaderMaterial;
    expect(mat.depthWrite).toBe(false);
    expect(mat.fog).toBe(false);
    const c = sceneColorsFor(id);
    expect(near(mat.uniforms.uColorA!.value, c.weatherA)).toBe(true);
    expect(near(mat.uniforms.uColorB!.value, c.weatherB)).toBe(true);
    expect(Object.keys(mat.defines)).toEqual([`KIND_${spec.kind.toUpperCase()}`]);
  });
  it('reduced motion: draw range is reducedCount and uTime stays pinned across frames', async () => {
    const m = await mount('frost', true);
    const mat = m.points()[0]!.material as THREE.ShaderMaterial;
    expect(m.points()[0]!.geometry.drawRange.count).toBe(WEATHER.snow.reducedCount);
    for (const t of [1, 5]) {
      m.display.time = t;
      await act(async () => advance(t * 1000, true, m.store.getState()));
      expect(mat.uniforms.uTime!.value).toBe(REDUCED_TIME);
    }
  });
  it('animated: uTime follows display.time, and the position attribute is not rewritten', async () => {
    const m = await mount('forest', false);
    const p = m.points()[0]!;
    const pos = p.geometry.getAttribute('position') as THREE.BufferAttribute;
    const version = pos.version;
    const mat = p.material as THREE.ShaderMaterial;
    for (const t of [2, 4]) {
      m.display.time = t;
      await act(async () => advance(t * 1000, true, m.store.getState()));
      expect(mat.uniforms.uTime!.value).toBe(t);
    }
    expect(pos.version).toBe(version);
  });
  it('embers: anchors come from the theme scene, up to four', async () => {
    const m = await mount('castle', false);
    const mat = m.points()[0]!.material as THREE.ShaderMaterial;
    const anchors = sceneThemeFor('castle').scene.anchors;
    const n = mat.uniforms.uAnchorCount!.value as number;
    expect(n).toBe(Math.min(4, Math.max(1, anchors.length)));
    anchors.slice(0, 4).forEach((a, i) => {
      const v = mat.uniforms.uAnchors!.value[i] as THREE.Vector3;
      expect([v.x, v.y, v.z]).toEqual([a.x, a.y, a.z]);
    });
  });
  it('a switch to another theme changes the weather in place', async () => {
    const m = await mount('frost', false);
    await m.rerender('bloodmoon');
    const pts = m.points();
    expect(pts).toHaveLength(1);
    expect(pts[0]!.geometry.drawRange.count).toBe(WEATHER.ash.count);
    await m.rerender('crypt');
    expect(m.points()).toHaveLength(0);
  });
});
describe('Weather source', () => {
  const src = readFileSync(resolve(__dirname, '../../entrypoints/newtab/layers/scene/Weather.tsx'), 'utf8');
  it('has no per-particle loop and no network call', () => {
    expect(src).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|WebSocket/);
    const js = src.replace(/\/\* glsl \*\/ `[\s\S]*?`;/g, '');
    expect(js).not.toMatch(/for\s*\(|while\s*\(/);
    expect(js).not.toMatch(/getAttribute\([^)]*\)\.(set|array)/);
    expect(js).not.toMatch(/needsUpdate/);
  });
});
