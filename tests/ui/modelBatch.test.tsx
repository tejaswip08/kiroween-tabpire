// @vitest-environment jsdom
// Task 12: one boundary per model, frost treatment, disposal.
import { _roots, createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { act } from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const shared = new Map<string, THREE.MeshStandardMaterial>();
const calls: unknown[] = [];
const failing = new Set<string>();

vi.mock('@react-three/drei', () => {
  const one = (url: string) => {
    if ([...failing].some((f) => url.includes(f))) throw new Error('404');
    let m = shared.get(url);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color: '#8a5a2b' });
      shared.set(url, m);
    }
    const g = new THREE.Group();
    const a = new THREE.Mesh(new THREE.BoxGeometry(1, 4, 1), m);
    a.position.y = 2;
    g.add(a);
    return { scene: g };
  };
  return { useGLTF: (url: string | string[]) => (calls.push(url), Array.isArray(url) ? url.map(one) : one(url)) };
});

import { createDisplay, DisplayContext } from '../../entrypoints/newtab/layers/scene/display';
import {
  FROST, buildBatches, frostVertexColor, isFrost, resetModelWarnings, tintFrost, collectParts,
} from '../../entrypoints/newtab/layers/scene/ModelBatch';
import { Props } from '../../entrypoints/newtab/layers/scene/Props';
import { SceneThemeContext, sceneThemeFor } from '../../entrypoints/newtab/layers/scene/themeColors';
import { sceneState } from '../../lib/scene/meaning';
import type { ThemeId } from '../../lib/themes';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
extend(THREE as never);

const display = createDisplay(
  sceneState({ cardCount: 5, starvingCount: 1, estimatedMb: 500, cryptCount: 1, crypted: 1, garlicCount: 0, staked: 0, coffined: 0, dawnReady: false }),
  true,
);
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
let canvas: HTMLCanvasElement;
async function mount(id: ThemeId) {
  canvas = document.createElement('canvas');
  root = createRoot(canvas);
  await act(async () => {
    await root!.configure({ gl: fakeGl as never, frameloop: 'never', size: { width: 100, height: 100, top: 0, left: 0 }, events: undefined } as never);
    root!.render(
      <DisplayContext.Provider value={display}>
        <SceneThemeContext value={sceneThemeFor(id)}>
          <Props />
        </SceneThemeContext>
      </DisplayContext.Provider>,
    );
  });
  return _roots.get(canvas)!.store.getState().scene;
}
const instanced = (scene: THREE.Object3D) => {
  const out: THREE.InstancedMesh[] = [];
  scene.traverse((o) => {
    if ((o as THREE.InstancedMesh).isInstancedMesh) out.push(o as THREE.InstancedMesh);
  });
  return out;
};

let warn: ReturnType<typeof vi.spyOn>;
// React reports an error caught by a boundary to the window in dev; the test expects it.
const swallow = (e: ErrorEvent) => e.preventDefault();
beforeEach(() => {
  window.addEventListener('error', swallow);
  failing.clear();
  calls.length = 0;
  resetModelWarnings();
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  window.removeEventListener('error', swallow);
  act(() => root?.unmount());
  root = undefined;
  vi.restoreAllMocks();
});

describe('one boundary per model', () => {
  it('a model that fails to load is skipped, the rest are drawn, the file name is logged once', async () => {
    failing.add('frost_pine_a.glb');
    const scene = await mount('frost');
    const names = new Set(instanced(scene).map((m) => m.name));
    expect(names.has('frost_pine_a')).toBe(false);
    // The Frozen Cemetery was rebuilt as a clear graveyard: its only file models are frost_pine_a and tree_dead_large.
    expect(names.has('tree_dead_large')).toBe(true);
    const logged = warn.mock.calls.map((c: unknown[]) => String(c[0])).filter((l: string) => l.startsWith('Tabpire:'));
    expect(logged.filter((l: string) => l.includes('frost_pine_a.glb'))).toHaveLength(1);
    expect(logged[0]).toBe('Tabpire: model failed to load: frost_pine_a.glb');
  });

  it('loads each model of a theme on its own, never as a list', async () => {
    await mount('frost');
    // One file load for each of the two models of the rebuilt Frozen Cemetery.
    expect(calls.length).toBeGreaterThanOrEqual(2);
    expect(calls.every((c) => typeof c === 'string')).toBe(true);
  });

  it('the Crypt keeps one list load and mounts no model boundary', async () => {
    const scene = await mount('crypt');
    expect(calls.filter((c) => Array.isArray(c))).toHaveLength(1);
    expect(calls.filter((c) => typeof c === 'string')).toHaveLength(0);
    expect(instanced(scene).length).toBeGreaterThan(10);
  });
});

describe('frost treatment', () => {
  it('draws frost models with cloned materials and colour attributes, leaving the shared ones alone', async () => {
    const scene = await mount('frost');
    const meshes = instanced(scene).filter((m) => isFrost(m.name));
    expect(meshes.length).toBeGreaterThan(0);
    for (const m of meshes) {
      const mat = m.material as THREE.MeshStandardMaterial;
      expect([...shared.values()]).not.toContain(mat);
      expect(mat.vertexColors).toBe(true);
      expect(mat.color.getHexString()).toBe(new THREE.Color(FROST.color).getHexString());
      expect(mat.emissive.getHexString()).toBe(new THREE.Color(FROST.emissive).getHexString());
      expect(mat.emissiveIntensity).toBe(FROST.emissiveIntensity);
      expect(m.geometry.getAttribute('color')).toBeDefined();
    }
    for (const [url, mat] of shared) {
      if (url.includes('frost_')) {
        expect(mat.vertexColors).toBe(false);
        expect(mat.color.getHexString()).toBe(new THREE.Color('#8a5a2b').getHexString());
      }
    }
  });

  it('disposes meshes, material clones and geometry clones on unmount, not the shared material', async () => {
    const scene = await mount('frost');
    const meshes = instanced(scene).filter((m) => isFrost(m.name));
    const hits = { mesh: 0, mat: 0, geo: 0, shared: 0 };
    for (const m of meshes) {
      m.addEventListener('dispose', () => hits.mesh++);
      (m.material as THREE.Material).addEventListener('dispose', () => hits.mat++);
      m.geometry.addEventListener('dispose', () => hits.geo++);
    }
    for (const mat of shared.values()) mat.addEventListener('dispose', () => hits.shared++);
    await act(async () => root!.unmount());
    root = undefined;
    expect(hits.mesh).toBe(meshes.length);
    expect(hits.mat).toBe(meshes.length);
    expect(hits.geo).toBe(meshes.length);
    expect(hits.shared).toBe(0);
  });

  it('plain models draw with the shared material and are not tinted', () => {
    const root3 = new THREE.Group();
    root3.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()));
    const { batches, owned } = buildBatches('farm_barn', root3, []);
    expect(owned.materials).toHaveLength(0);
    expect(batches[0]!.part.geometry.getAttribute('color')).toBeUndefined();
  });
});

describe('frost helpers', () => {
  it('lighten toward snow in the top quarter and are darker on trunks', () => {
    const lum = (c: number[]) => c[0]! + c[1]! + c[2]!;
    expect(lum(frostVertexColor(1, true))).toBeGreaterThan(lum(frostVertexColor(0.5, true)));
    expect(frostVertexColor(1, true)).toEqual([1, 1, 1]);
    expect(frostVertexColor(0.5, true)).toEqual([...FROST.body]);
    expect(frostVertexColor(0, true)).toEqual([...FROST.trunk]);
    expect(lum(frostVertexColor(0, true))).toBeLessThan(lum(frostVertexColor(0.5, true)));
    expect(frostVertexColor(0, false)).toEqual([...FROST.body]);
    expect(frostVertexColor(-3, true)).toEqual(frostVertexColor(0, true));
    expect(frostVertexColor(9, true)).toEqual(frostVertexColor(1, true));
  });

  it('are deterministic and only for frost_ ids', () => {
    expect(frostVertexColor(0.9, true)).toEqual(frostVertexColor(0.9, true));
    expect(isFrost('frost_rock')).toBe(true);
    expect(isFrost('forest_rocks')).toBe(false);
  });

  it('tintFrost colours the vertices by height and returns what it owns', () => {
    const g = new THREE.Group();
    const m = new THREE.MeshStandardMaterial({ color: '#8a5a2b' });
    g.add(new THREE.Mesh(new THREE.BoxGeometry(1, 4, 1), m));
    const parts = collectParts(g);
    const { parts: out, owned } = tintFrost(parts, true);
    expect(owned.materials).toHaveLength(1);
    expect(owned.geometries).toHaveLength(1);
    expect(out[0]!.material).not.toBe(m);
    expect(m.vertexColors).toBe(false);
    const pos = out[0]!.geometry.getAttribute('position');
    const col = out[0]!.geometry.getAttribute('color');
    let top = 0;
    let bottom = 0;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) > 1.9) top = Math.max(top, col.getX(i));
      if (pos.getY(i) < -1.9) bottom = Math.max(bottom, col.getX(i));
    }
    expect(top).toBeGreaterThan(bottom);
  });
});

describe('source', () => {
  it('ModelBatch loads its file with Draco off and meshopt on', () => {
    const src = readFileSync(join(__dirname, '../../entrypoints/newtab/layers/scene/ModelBatch.tsx'), 'utf8');
    expect(src).toContain('useGLTF(modelFile(id), false, true)');
    expect(src).not.toMatch(/fetch\s*\(/);
  });
});
