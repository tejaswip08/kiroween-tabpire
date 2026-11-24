// @vitest-environment jsdom
// Task 16.1: a theme switch keeps the old scene until the new scene's models have loaded.
// Real React rendering through the r3f test renderer. Every scene test runs against both mechanisms:
// `useDeferredValue` (the default) and the manual gate (the fallback behind THEME_SWITCH).
import { _roots, createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import fc from 'fast-check';
import { act, Suspense, useLayoutEffect, type ReactNode } from 'react';
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ctl = vi.hoisted(() => {
  interface Entry { ready: boolean; promise: Promise<void>; settle: () => void }
  const entries = new Map<string, Entry>();
  const state = { holds: new Set<string>(), fails: new Set<string>() };
  const entry = (url: string): Entry => {
    let e = entries.get(url);
    if (!e) {
      let settle = () => {};
      const promise = new Promise<void>((r) => (settle = r));
      e = { ready: !state.holds.has(url), promise, settle };
      if (e.ready) settle();
      entries.set(url, e);
    }
    return e;
  };
  return {
    entries,
    state,
    entry,
    /** Lets the held files finish (they load, or fail when listed in `fails`). */
    release(urls?: readonly string[]) {
      for (const [url, e] of entries) {
        if (urls && !urls.includes(url)) continue;
        e.ready = true;
        e.settle();
      }
      for (const url of [...state.holds]) if (!urls || urls.includes(url)) state.holds.delete(url);
    },
    reset() {
      entries.clear();
      state.holds.clear();
      state.fails.clear();
    },
  };
});

// A unique theme draws the shared layers, and the post-processing composer needs a real GL context.
vi.mock('../../entrypoints/newtab/layers/scene/Effects', () => ({ Effects: () => null }));
vi.mock('@react-three/drei', () => {
  const one = (url: string) => {
    const e = ctl.entry(url);
    if (!e.ready) throw e.promise; // suspends, like drei's useGLTF
    if (ctl.state.fails.has(url)) throw new Error('404');
    const g = new THREE.Group();
    const a = new THREE.Mesh(new THREE.BoxGeometry(1, 4, 1), new THREE.MeshStandardMaterial());
    a.position.y = 2;
    g.add(a);
    return { scene: g };
  };
  return { useGLTF: (url: string | string[]) => (Array.isArray(url) ? url.map(one) : one(url)) };
});

import { createDisplay, DisplayContext } from '../../entrypoints/newtab/layers/scene/display';
import { resetModelWarnings } from '../../entrypoints/newtab/layers/scene/ModelBatch';
import { themeFiles } from '../../entrypoints/newtab/layers/scene/preloadThemes';
import { Props } from '../../entrypoints/newtab/layers/scene/Props';
import { ThemeSceneRoot } from '../../entrypoints/newtab/layers/scene/themes/ThemeSceneRoot';
import { THEME_SWITCH, ThemedScene, useThemeGate, type ThemeLoader } from '../../entrypoints/newtab/layers/scene/ThemedScene';
import { sceneThemeFor, useSceneTheme } from '../../entrypoints/newtab/layers/scene/themeColors';
import { sceneState } from '../../lib/scene/meaning';
import { MODELS, modelFile } from '../../lib/scene/layout';
import { UNIQUE_SCENES } from '../../lib/scene/uniqueScenes';
import { THEME_IDS, type ThemeId } from '../../lib/themes';

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

/** Marks which theme's scene is mounted, and logs every theme that ever mounted. */
const mounted: ThemeId[] = [];
function Marker() {
  const { id } = useSceneTheme();
  useLayoutEffect(() => {
    mounted.push(id);
  }, [id]);
  return <mesh name={`marker-${id}`} />;
}
const TestScene = (
  <>
    <Marker />
    <Props />
  </>
);
/** The scene of the unique-theme tests: a unique theme draws its own scene root, the others draw the marker scene. */
function UniqueOrProbe() {
  const { id } = useSceneTheme();
  return id in UNIQUE_SCENES ? <ThemeSceneRoot id={id} /> : TestScene;
}
let sceneNode: ReactNode = TestScene;

/** The gate's loader in the tests: resolves when every file of the theme has settled, a failed file included. */
const loads: ThemeId[] = [];
const testLoader: ThemeLoader = async (id) => {
  loads.push(id);
  await Promise.allSettled(themeFiles(id).map((url) => ctl.entry(url).promise));
};

type Mode = 'deferred' | 'gate';
let root: ReturnType<typeof createRoot> | undefined;
let canvas: HTMLCanvasElement;

function element(id: ThemeId, mode: Mode) {
  return (
    <DisplayContext.Provider value={display}>
      <Suspense fallback={<mesh name="fallback" />}>
        <ThemedScene themeId={id} mode={mode} load={testLoader} scene={sceneNode} />
      </Suspense>
    </DisplayContext.Provider>
  );
}
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 5)); });
async function mount(id: ThemeId, mode: Mode) {
  canvas = document.createElement('canvas');
  root = createRoot(canvas);
  await act(async () => {
    await root!.configure({ gl: fakeGl as never, frameloop: 'never', size: { width: 100, height: 100, top: 0, left: 0 }, events: undefined } as never);
    root!.render(element(id, mode));
  });
  await flush();
}
async function show(id: ThemeId, mode: Mode) {
  await act(async () => root!.render(element(id, mode)));
  await flush();
}
const sceneRoot = () => _roots.get(canvas)!.store.getState().scene;
function snapshot() {
  const markers: string[] = [];
  const meshes = new Set<string>();
  sceneRoot().traverse((o) => {
    if (o.name.startsWith('marker-')) markers.push(o.name);
    if (o.name === 'fallback') markers.push('fallback');
    if ((o as THREE.InstancedMesh).isInstancedMesh) meshes.add(o.name);
  });
  return { markers, meshes };
}
const sceneModels = (id: ThemeId) => sceneThemeFor(id).scene.models;
/** Models of `id` with no part filter (the mock names no mesh, so these always draw). */
const drawn = (id: ThemeId) => sceneModels(id).filter((m) => !('parts' in MODELS[m]));
const onlyIn = (a: ThemeId, b: ThemeId): string[] => {
  const other = new Set(themeFiles(b));
  return [...new Set(themeFiles(a))].filter((u) => !other.has(u));
};

const swallow = (e: ErrorEvent) => e.preventDefault();
beforeEach(() => {
  window.addEventListener('error', swallow);
  sceneNode = TestScene;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null as never);
  ctl.reset();
  mounted.length = 0;
  loads.length = 0;
  resetModelWarnings();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  window.removeEventListener('error', swallow);
  act(() => root?.unmount());
  root = undefined;
  vi.restoreAllMocks();
});

describe('the switch mechanism', () => {
  it('uses useDeferredValue by default, and the gate is one constant away', () => {
    expect(THEME_SWITCH).toBe('deferred');
  });
});

describe.each<Mode>(['deferred', 'gate'])('a theme switch with %s', (mode) => {
  it('keeps the old scene mounted, whole, until the new models have loaded', async () => {
    await mount('crypt', mode);
    const before = snapshot();
    expect(before.markers).toEqual(['marker-crypt']);
    expect(before.meshes.size).toBeGreaterThan(5);

    ctl.state.holds = new Set(onlyIn('frost', 'crypt'));
    await show('frost', mode);
    // The new files are pending: the old theme is still drawn, exactly as it was, with no fallback.
    for (let i = 0; i < 3; i++) {
      const during = snapshot();
      expect(during.markers).toEqual(['marker-crypt']);
      expect([...during.meshes].sort()).toEqual([...before.meshes].sort());
      await flush();
    }
    expect(mounted).not.toContain('frost');

    ctl.release();
    await flush();
    const after = snapshot();
    expect(after.markers).toEqual(['marker-frost']);
    for (const m of drawn('frost')) expect(after.meshes.has(m)).toBe(true);
    for (const m of drawn('crypt').filter((m) => !sceneModels('frost').includes(m))) expect(after.meshes.has(m)).toBe(false);
  });

  it('still completes the switch when a model file fails', async () => {
    await mount('crypt', mode);
    const frostOnly = onlyIn('frost', 'crypt');
    const broken = frostOnly[0]!;
    ctl.state.holds = new Set(frostOnly);
    ctl.state.fails.add(broken);
    await show('frost', mode);
    expect(snapshot().markers).toEqual(['marker-crypt']);

    ctl.release();
    await flush();
    const after = snapshot();
    expect(after.markers).toEqual(['marker-frost']);
    const brokenId = sceneModels('frost')[themeFiles('frost').indexOf(broken)]!;
    expect(after.meshes.has(brokenId)).toBe(false);
    const others = drawn('frost').filter((m) => m !== brokenId);
    expect(others.length).toBeGreaterThan(0);
    for (const m of others) expect(after.meshes.has(m)).toBe(true);
  });

  it('a third choice while loading shows only the latest and never the one it replaced', async () => {
    await mount('crypt', mode);
    ctl.state.holds = new Set([...onlyIn('frost', 'crypt'), ...onlyIn('pumpkin', 'crypt')]);
    await show('frost', mode);
    await show('pumpkin', mode);
    expect(snapshot().markers).toEqual(['marker-crypt']);

    // The replaced choice finishes first: the old scene stays.
    ctl.release(onlyIn('frost', 'crypt').filter((u) => !onlyIn('pumpkin', 'crypt').includes(u)));
    await flush();
    expect(snapshot().markers).toEqual(['marker-crypt']);

    ctl.release();
    await flush();
    expect(snapshot().markers).toEqual(['marker-pumpkin']);
    expect(mounted).not.toContain('frost');
    if (mode === 'gate') expect(loads.at(-1)).toBe('pumpkin');
  });

  it('going back to the old theme while loading cancels the switch', async () => {
    await mount('crypt', mode);
    ctl.state.holds = new Set(onlyIn('frost', 'crypt'));
    await show('frost', mode);
    await show('crypt', mode);
    ctl.release();
    await flush();
    expect(snapshot().markers).toEqual(['marker-crypt']);
    expect(mounted).not.toContain('frost');
  });

  // Property 18
  it('Property 18: for any two themes the old scene stays until the new one is loaded, then the new one shows', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...THEME_IDS), fc.constantFrom(...THEME_IDS), async (a, b) => {
        fc.pre(a !== b && onlyIn(b, a).length > 0);
        ctl.reset();
        mounted.length = 0;
        act(() => root?.unmount());
        await mount(a, mode);
        const before = snapshot();
        expect(before.markers).toEqual([`marker-${a}`]);

        ctl.state.holds = new Set(onlyIn(b, a));
        await show(b, mode);
        const during = snapshot();
        expect(during.markers).toEqual([`marker-${a}`]); // never empty, never the fallback, never the new scene
        expect([...during.meshes].sort()).toEqual([...before.meshes].sort());

        ctl.release();
        await flush();
        const after = snapshot();
        expect(after.markers).toEqual([`marker-${b}`]);
        for (const m of drawn(b)) expect(after.meshes.has(m)).toBe(true);
      }),
      { numRuns: 12 },
    );
  }, 60_000);
});

describe.each<Mode>(['deferred', 'gate'])('a unique theme switch with %s', (mode) => {
  const names = (): Set<string> => {
    const out = new Set<string>();
    sceneRoot().traverse((o) => out.add(o.name));
    return out;
  };
  it('loads exactly the files of its spec, so the gate and the idle preload fetch them', () => {
    const spec = sceneThemeFor('pumpkin').scene.unique!;
    expect(themeFiles('pumpkin')).toEqual(spec.models.map(modelFile));
    expect(themeFiles('pumpkin').length).toBeGreaterThan(5);
  });
  it('keeps the old scene until every file of the unique scene has loaded, then shows the whole scene', async () => {
    sceneNode = <UniqueOrProbe />;
    await mount('crypt', mode);
    expect(snapshot().markers).toEqual(['marker-crypt']);
    const before = snapshot();

    ctl.state.holds = new Set(onlyIn('pumpkin', 'crypt'));
    await show('pumpkin', mode);
    for (let i = 0; i < 3; i++) {
      const during = snapshot();
      expect(during.markers).toEqual(['marker-crypt']);
      expect([...during.meshes].sort()).toEqual([...before.meshes].sort());
      expect(names().has('windmill-sails')).toBe(false);
      await flush();
    }

    ctl.release();
    await flush();
    const after = snapshot();
    expect(after.markers).toEqual([]);
    for (const n of ['windmill-sails', 'scarecrow', 'theme-ground']) expect(names().has(n), n).toBe(true);
    for (const m of drawn('pumpkin').filter((m) => m !== 'farm_windmill')) expect(after.meshes.has(m), m).toBe(true);
    // The Crypt's props are gone.
    for (const m of drawn('crypt').filter((m) => !sceneModels('pumpkin').includes(m))) expect(after.meshes.has(m), m).toBe(false);
  });
  it('still completes when one file of the unique scene fails', async () => {
    sceneNode = <UniqueOrProbe />;
    await mount('crypt', mode);
    const farmOnly = onlyIn('pumpkin', 'crypt');
    const broken = themeFiles('pumpkin').find((u) => u.endsWith('farm_corn.glb'))!;
    ctl.state.holds = new Set(farmOnly);
    ctl.state.fails.add(broken);
    await show('pumpkin', mode);
    expect(snapshot().markers).toEqual(['marker-crypt']);
    ctl.release();
    await flush();
    const after = snapshot();
    expect(after.markers).toEqual([]);
    expect(after.meshes.has('farm_corn')).toBe(false);
    expect(after.meshes.has('farm_barn')).toBe(true);
    expect(names().has('scarecrow')).toBe(true);
  });
});

describe('useThemeGate', () => {
  function setup(load: ThemeLoader) {
    return renderHook(({ id }: { id: ThemeId }) => useThemeGate(id, load), { initialProps: { id: 'crypt' as ThemeId } });
  }
  const deferred = () => {
    let resolve!: () => void;
    let reject!: (e: unknown) => void;
    const promise = new Promise<void>((res, rej) => ((resolve = res), (reject = rej)));
    return { promise, resolve, reject };
  };
  it('starts on the given id and loads nothing for it', () => {
    const load = vi.fn(async () => {});
    const { result } = setup(load);
    expect(result.current).toBe('crypt');
    expect(load).not.toHaveBeenCalled();
  });
  it('stays on the old id while the loader is pending, then moves to the new one', async () => {
    const d = deferred();
    const { result, rerender } = setup(() => d.promise);
    rerender({ id: 'frost' });
    await act(async () => {});
    expect(result.current).toBe('crypt');
    await act(async () => d.resolve());
    expect(result.current).toBe('frost');
  });
  it('moves to the new id when the loader rejects', async () => {
    const d = deferred();
    const { result, rerender } = setup(() => d.promise);
    rerender({ id: 'frost' });
    await act(async () => d.reject(new Error('404')));
    expect(result.current).toBe('frost');
  });
  it('moves to the new id when the loader throws at once', async () => {
    const { result, rerender } = setup(() => {
      throw new Error('boom');
    });
    rerender({ id: 'frost' });
    await act(async () => {});
    expect(result.current).toBe('frost');
  });
  it('shows only the latest of two quick choices', async () => {
    const waits = new Map<ThemeId, ReturnType<typeof deferred>>();
    const load: ThemeLoader = (id) => {
      const d = deferred();
      waits.set(id, d);
      return d.promise;
    };
    const seen: ThemeId[] = [];
    const { result, rerender } = renderHook(({ id }: { id: ThemeId }) => {
      const shown = useThemeGate(id, load);
      seen.push(shown);
      return shown;
    }, { initialProps: { id: 'crypt' as ThemeId } });
    rerender({ id: 'frost' });
    rerender({ id: 'castle' });
    await act(async () => waits.get('castle')!.resolve());
    await act(async () => waits.get('frost')!.resolve());
    expect(result.current).toBe('castle');
    expect(seen).not.toContain('frost');
  });
  it('is off when disabled: the id passes straight through', () => {
    const load = vi.fn(async () => {});
    const { result, rerender } = renderHook(({ id }: { id: ThemeId }) => useThemeGate(id, load, false), { initialProps: { id: 'crypt' as ThemeId } });
    rerender({ id: 'frost' });
    expect(result.current).toBe('frost');
    expect(load).not.toHaveBeenCalled();
  });
});
