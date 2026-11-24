// @vitest-environment jsdom
// A unique theme scene: ThemeSceneRoot mounts the shared layers and the theme's own scene, none of the Crypt-only parts,
// the windmill's sails turn with time and stand still with reduced motion, and ThemedScene points the moon per theme.
// Real React rendering through the r3f test renderer (nothing is drawn).
import { _roots, advance, createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { act, Suspense } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** Names of the Crypt-only components that rendered. A unique theme must leave it empty. */
const crypt = vi.hoisted(() => {
  const rendered: string[] = [];
  /** The `at` prop of every CauldronFx that rendered: the Witch's Forest passes one, the Crypt never does. */
  const fx: unknown[] = [];
  return {
    rendered,
    fx,
    track: (name: string) => () => {
      rendered.push(name);
      return null;
    },
  };
});
vi.mock('../../entrypoints/newtab/layers/scene/Cat', () => ({ Cat: crypt.track('Cat') }));
vi.mock('../../entrypoints/newtab/layers/scene/Crows', () => ({ Crows: crypt.track('Crows') }));
vi.mock('../../entrypoints/newtab/layers/scene/Owl', () => ({ Owl: crypt.track('Owl') }));
vi.mock('../../entrypoints/newtab/layers/scene/Spiders', () => ({ Spiders: crypt.track('Spiders'), Cobwebs: crypt.track('Cobwebs') }));
vi.mock('../../entrypoints/newtab/layers/scene/Wisps', () => ({ Wisps: crypt.track('Wisps') }));
vi.mock('../../entrypoints/newtab/layers/scene/Skeletons', () => ({ Skeletons: crypt.track('Skeletons') }));
vi.mock('../../entrypoints/newtab/layers/scene/CauldronFx', () => ({
  CauldronFx: (props: { at?: unknown }) => {
    crypt.fx.push(props.at);
    if (!props.at) crypt.rendered.push('CauldronFx');
    return null;
  },
}));
vi.mock('../../entrypoints/newtab/layers/scene/OpenCoffin', () => ({ OpenCoffin: crypt.track('OpenCoffin') }));
vi.mock('../../entrypoints/newtab/layers/scene/FarVillage', () => ({ FarVillage: crypt.track('FarVillage') }));
vi.mock('../../entrypoints/newtab/layers/scene/LowClouds', () => ({ LowClouds: crypt.track('LowClouds') }));
vi.mock('../../entrypoints/newtab/layers/scene/Ground', () => ({ Ground: crypt.track('Ground') }));
vi.mock('../../entrypoints/newtab/layers/scene/Props', () => ({ Props: crypt.track('Props') }));
// The post-processing composer needs a real GL context.
vi.mock('../../entrypoints/newtab/layers/scene/Effects', () => ({ Effects: () => null }));
vi.mock('@react-three/drei', () => {
  const one = (url = '') => {
    const g = new THREE.Group();
    // A box 1 x 4 x 1: its front face (z = 0.5) is split off as the sails of the windmill, the rest is the body.
    const a = new THREE.Mesh(new THREE.BoxGeometry(1, 4, 1), new THREE.MeshStandardMaterial());
    // The castle banner and wall flag files name their cloth material (`Main`, `Flag`): the fake box is the cloth.
    if (/castle_banner/.test(url)) a.material.name = 'Main';
    if (/castle_wall_flag/.test(url)) a.material.name = 'Flag';
    a.position.y = 2;
    g.add(a);
    return { scene: g };
  };
  return { useGLTF: (url: string | string[]) => (Array.isArray(url) ? url.map((u) => one(u)) : one(url)) };
});

import { createDisplay, DisplayContext, type SceneDisplay } from '../../entrypoints/newtab/layers/scene/display';
import { SAIL_SPEED } from '../../entrypoints/newtab/layers/scene/themes/Windmill';
import { ThemedScene } from '../../entrypoints/newtab/layers/scene/ThemedScene';
import { SceneThemeContext, sceneThemeFor } from '../../entrypoints/newtab/layers/scene/themeColors';
import { ThemeSceneRoot } from '../../entrypoints/newtab/layers/scene/themes/ThemeSceneRoot';
import { buildPlatform, buildScarecrow, trianglesOf } from '../../entrypoints/newtab/layers/scene/themes/shapes';
import { sceneState } from '../../lib/scene/meaning';
import { moonDirection } from '../../lib/scene/sky';
import { PUMPKIN_MOON, PUMPKIN_PARTS } from '../../lib/scene/uniqueScenes/pumpkin';
import { FOREST_MOON, cauldronFxAt } from '../../lib/scene/uniqueScenes/forest';
import { FOREST_PARTS, SWAY_AMPLITUDE, bob, scarecrowSway } from '../../lib/scene/uniqueScenes/forestParts';
import { buildWitchScarecrow } from '../../entrypoints/newtab/layers/scene/themes/forestShapes';
import { FROST_GHOST_TINT, FROST_MOON, FROST_PARTS } from '../../lib/scene/uniqueScenes/frost';
import { ICICLE_TRIS, LAKE_SEGMENTS, MOUND_TRIS } from '../../lib/scene/uniqueScenes/frostIce';
import { AURORA_TRIS } from '../../lib/scene/aurora';
import { BLOOD_MOON, BLOOD_PARTS } from '../../lib/scene/uniqueScenes/bloodmoon';
import { CASTLE_MOON } from '../../lib/scene/uniqueScenes/castle';
import { FLASH_BOOST, LIGHTNING, flashTimes, lightningAt } from '../../lib/scene/lightning';
import { LOOK } from '../../lib/scene/config';
import { PLATFORM_TRIS, crackRibbon } from '../../lib/scene/uniqueScenes/bloodmoonParts';
import { buildCrackGeometry } from '../../entrypoints/newtab/layers/scene/themes/LavaCracks';
import { icicleMatrix } from '../../entrypoints/newtab/layers/scene/themes/Icicles';
import { MODELS } from '../../lib/scene/layout';
import { WEATHER } from '../../lib/scene/weather';
import type { ThemeId } from '../../lib/themes';

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
beforeEach(() => {
  crypt.rendered.length = 0;
  crypt.fx.length = 0;
  // jsdom has no 2D canvas: the painted ground then stays plain.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null as never);
});
afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  vi.restoreAllMocks();
});

async function mount(view: (display: SceneDisplay) => React.ReactNode, reduced = false) {
  const display = createDisplay(state, reduced);
  const canvas = document.createElement('canvas');
  root = createRoot(canvas);
  await act(async () => {
    await root!.configure({ gl: fakeGl as never, frameloop: 'never', size: { width: 160, height: 90, top: 0, left: 0 }, events: undefined } as never);
    root!.render(
      <DisplayContext.Provider value={display}>
        <Suspense fallback={<mesh name="fallback" />}>{view(display)}</Suspense>
      </DisplayContext.Provider>,
    );
  });
  const store = _roots.get(canvas)!.store;
  return { display, store, scene: store.getState().scene, rerender: (v: React.ReactNode) => act(async () => root!.render(<DisplayContext.Provider value={display}><Suspense fallback={null}>{v}</Suspense></DisplayContext.Provider>)) };
}
const named = (scene: THREE.Object3D, name: string) => {
  let hit: THREE.Object3D | undefined;
  scene.traverse((o) => {
    if (o.name === name) hit = o;
  });
  return hit;
};
const pumpkinRoot = () => (
  <SceneThemeContext value={sceneThemeFor('pumpkin')}>
    <ThemeSceneRoot id="pumpkin" />
  </SceneThemeContext>
);

describe('ThemeSceneRoot for the Pumpkin Patch', () => {
  it('mounts the shared layers and the farm, and none of the Crypt-only parts', async () => {
    const { scene } = await mount(pumpkinRoot);
    expect(named(scene, 'fallback')).toBeUndefined();
    // The farm: one instanced mesh per model, the windmill in two plain meshes, the scarecrow, the ground and the track.
    const spec = sceneThemeFor('pumpkin').scene.unique!;
    const instanced = new Set<string>();
    scene.traverse((o) => {
      if ((o as THREE.InstancedMesh).isInstancedMesh && spec.models.includes(o.name as never)) instanced.add(o.name);
    });
    for (const m of spec.models.filter((id) => id !== 'farm_windmill')) expect(instanced.has(m), m).toBe(true);
    for (const n of ['windmill', 'windmill-body', 'windmill-sails', 'scarecrow', 'theme-ground', 'theme-path']) expect(named(scene, n), n).toBeDefined();
    // Shared layers: the sky shader, the moon disc, the clouds, two point-sprite layers (embers, leaves).
    const uniforms: string[] = [];
    let points = 0;
    scene.traverse((o) => {
      const mat = (o as THREE.Mesh).material as THREE.ShaderMaterial | undefined;
      if (mat?.isShaderMaterial) uniforms.push(...Object.keys(mat.uniforms));
      if ((o as THREE.Points).isPoints) points++;
    });
    for (const u of ['uTop', 'uLight', 'uTint', 'uCold']) expect(uniforms, u).toContain(u);
    expect(points).toBe(2);
    expect(scene.fog).not.toBeNull();
    // Real point lights: the jack-o'-lanterns and the barn, never more than the budget.
    let lights = 0;
    scene.traverse((o) => {
      if ((o as THREE.PointLight).isPointLight) lights++;
    });
    expect(lights).toBe(spec.lights.length);
    expect(lights).toBeLessThanOrEqual(6);
    // No Crypt-only component rendered, and no Crypt model is in the scene.
    expect(crypt.rendered).toEqual([]);
    for (const n of ['crypt', 'arch_gate', 'gravestone', 'fence', 'fence_pillar', 'coffin_open', 'path_A']) expect(named(scene, n), n).toBeUndefined();
  });

  it('draws falling leaves for its weather', async () => {
    const { scene } = await mount(pumpkinRoot);
    const leaves: THREE.Points[] = [];
    scene.traverse((o) => {
      const p = o as THREE.Points;
      if (p.isPoints && (p.material as THREE.ShaderMaterial).defines?.KIND_LEAVES !== undefined) leaves.push(p);
    });
    expect(leaves).toHaveLength(1);
    expect(leaves[0]!.geometry.drawRange.count).toBe(WEATHER.leaves.count);
  });

  it('turns the windmill sails with time and keeps the body still', async () => {
    const { scene, display, store } = await mount(pumpkinRoot);
    const sails = named(scene, 'windmill-sails')!;
    const body = named(scene, 'windmill-body')!;
    expect(sails.rotation.z).toBe(0);
    let last = 0;
    for (const t of [4, 8, 12]) {
      display.time = t;
      await act(async () => advance(t * 1000, true, store.getState()));
      expect(sails.rotation.z).toBeCloseTo(-t * SAIL_SPEED, 9);
      expect(sails.rotation.z).toBeLessThan(last);
      last = sails.rotation.z;
      expect(body.rotation.z).toBe(0);
    }
  });

  it('stops the sails under reduced motion', async () => {
    const { scene, display, store } = await mount(pumpkinRoot, true);
    const sails = named(scene, 'windmill-sails')!;
    for (const t of [3, 9]) {
      display.time = t; // even if the time were not held at 0, the sails stand still
      await act(async () => advance(t * 1000, true, store.getState()));
      expect(sails.rotation.z).toBe(0);
    }
  });

  it('keeps the shapes it builds itself within the triangles it declared', () => {
    expect(trianglesOf(buildScarecrow())).toBeLessThanOrEqual(PUMPKIN_PARTS.scarecrowTris);
  });
  it('draws the autumn lane: the tree, the children, dry corn, the fence, grass, leaves and light, in the draw calls it declared', async () => {
    const { scene } = await mount(pumpkinRoot);
    const lane = ['autumn-tree', 'autumn-leaves', 'kid-ghost', 'kid-witch', 'dry-corn', 'rustic-fence', 'grass-banks', 'grass-tufts', 'fallen-leaves', 'light-patches'];
    for (const n of lane) expect(named(scene, n), n).toBeDefined();
    const own = ['scarecrow', 'theme-ground', 'theme-path', 'windmill-sails', ...lane];
    expect(own.length).toBe(PUMPKIN_PARTS.calls);
  });
  it('walks the children away down the trail, bobbing, and holds them still under reduced motion', async () => {
    const moving = await mount(pumpkinRoot);
    const ghost = named(moving.scene, 'kid-ghost')!.parent!;
    const zs: number[] = [];
    for (const t of [4, 8, 12]) {
      moving.display.time = t;
      await act(async () => advance(t * 1000, true, moving.store.getState()));
      zs.push(ghost.position.z);
    }
    expect(zs[1]!).toBeLessThan(zs[0]!);
    expect(zs[2]!).toBeLessThan(zs[1]!);
    act(() => root?.unmount());
    const still = await mount(pumpkinRoot, true);
    const witch = named(still.scene, 'kid-witch')!.parent!;
    const seen: string[] = [];
    for (const t of [3, 9]) {
      still.display.time = t;
      await act(async () => advance(t * 1000, true, still.store.getState()));
      seen.push(witch.position.toArray().map((v) => v.toFixed(6)).join(','));
    }
    expect(seen[0]).toBe(seen[1]);
    expect(witch.rotation.z).toBe(0);
  });
});

const forestRoot = () => (
  <SceneThemeContext value={sceneThemeFor('forest')}>
    <ThemeSceneRoot id="forest" />
  </SceneThemeContext>
);
describe('ThemeSceneRoot for the Witch\'s Forest', () => {
  it('mounts the shared layers and the forest, the face, the fire, the scarecrows, the ghosts and the cauldron liquid, and none of the Crypt-only parts', async () => {
    const { scene } = await mount(forestRoot);
    expect(named(scene, 'fallback')).toBeUndefined();
    const spec = sceneThemeFor('forest').scene.unique!;
    // One instanced mesh per model. The trees are drawn from their bark mesh by name, and the fake file has no part names.
    const instanced = new Set<string>();
    scene.traverse((o) => {
      if ((o as THREE.InstancedMesh).isInstancedMesh && spec.models.includes(o.name as never)) instanced.add(o.name);
    });
    for (const m of spec.models.filter((id) => !('parts' in MODELS[id]) && !id.startsWith('forest_twisted'))) expect(instanced.has(m), m).toBe(true);
    for (const n of ['forest-ground', 'forest-path', 'forest-graves', 'forest-grass', 'forest-plants', 'forest-face', 'forest-flames', 'forest-sparks', 'forest-ghosts', 'forest-wisp']) {
      expect(named(scene, n), n).toBeDefined();
    }
    for (const n of ['theme-ground', 'theme-path']) expect(named(scene, n), n).toBeUndefined();
    let scarecrows = 0;
    scene.traverse((o) => {
      if (o.name === 'forest-scarecrow') scarecrows++;
    });
    expect(scarecrows).toBe(spec.forest!.scarecrows.length);
    // The ghosts are one instanced mesh, the flames another.
    expect((named(scene, 'forest-ghosts') as THREE.InstancedMesh).count).toBe(spec.forest!.ghosts.length);
    expect((named(scene, 'forest-flames') as THREE.InstancedMesh).count).toBe(spec.forest!.fire.flames.length);
    // Real lights: the fire, the jack-o'-lantern and the cauldron, never more than the budget. Two point layers: sparks and fireflies.
    let lights = 0;
    let points = 0;
    const uniforms: string[] = [];
    scene.traverse((o) => {
      if ((o as THREE.PointLight).isPointLight) lights++;
      if ((o as THREE.Points).isPoints) points++;
      const mat = (o as THREE.Mesh).material as THREE.ShaderMaterial | undefined;
      if (mat?.isShaderMaterial) uniforms.push(...Object.keys(mat.uniforms));
    });
    expect(lights).toBe(spec.lights.length);
    expect(lights).toBeLessThanOrEqual(6);
    expect(points).toBe(2);
    expect(scene.fog).not.toBeNull();
    // The sky is two-tone, and there is no moon disc (its shader has the uLight uniform).
    expect(uniforms).toContain('uTwoTone');
    expect(uniforms).not.toContain('uLight');
    // The cauldron liquid is drawn at the small pot of the forest, not at the Crypt's.
    expect(crypt.fx).toEqual([cauldronFxAt(spec.placements.find((p) => p.model === 'forest_cauldron')!)]);
    expect(crypt.rendered).toEqual([]);
    for (const n of ['crypt', 'arch_gate', 'gravestone', 'fence', 'fence_pillar', 'coffin_open', 'path_A']) expect(named(scene, n), n).toBeUndefined();
  });
  it('draws fireflies for its weather', async () => {
    const { scene } = await mount(forestRoot);
    const flies: THREE.Points[] = [];
    scene.traverse((o) => {
      const p = o as THREE.Points;
      if (p.isPoints && (p.material as THREE.ShaderMaterial).defines?.KIND_FIREFLIES !== undefined) flies.push(p);
    });
    expect(flies).toHaveLength(1);
    expect(flies[0]!.geometry.drawRange.count).toBe(WEATHER.fireflies.count);
  });
  it('flickers the flames and the face with time, and sways the scarecrows and bobs the ghosts', async () => {
    const { scene, display, store } = await mount(forestRoot);
    const spec = sceneThemeFor('forest').scene.unique!;
    const flames = (named(scene, 'forest-flames') as THREE.InstancedMesh).material as THREE.ShaderMaterial;
    const face = (named(scene, 'forest-face') as THREE.Mesh).material as THREE.MeshBasicMaterial;
    const ghosts = named(scene, 'forest-ghosts') as THREE.InstancedMesh;
    const crows: THREE.Object3D[] = [];
    scene.traverse((o) => {
      if (o.name === 'forest-scarecrow') crows.push(o.parent!);
    });
    const colours = new Set<number>();
    const heights = new Set<number>();
    const m = new THREE.Matrix4();
    for (const t of [2, 5, 9]) {
      display.time = t;
      await act(async () => advance(t * 1000, true, store.getState()));
      expect(flames.uniforms.uTime!.value).toBe(t);
      colours.add(face.color.r);
      ghosts.getMatrixAt(0, m);
      heights.add(m.elements[13]!);
      crows.forEach((c, i) => expect(c.rotation.z).toBeCloseTo(scarecrowSway(spec.forest!.scarecrows[i]!, t, false), 9));
      expect(Math.abs(crows[0]!.rotation.z)).toBeLessThanOrEqual(SWAY_AMPLITUDE + 1e-9);
      expect(m.elements[13]).toBeCloseTo(spec.forest!.ghosts[0]!.y + bob(spec.forest!.ghosts[0]!.phase, t, false), 6);
    }
    expect(colours.size).toBeGreaterThan(1);
    expect(heights.size).toBeGreaterThan(1);
  });
  it('holds the flames, the face, the scarecrows and the ghosts still under reduced motion', async () => {
    const { scene, display, store } = await mount(forestRoot, true);
    const spec = sceneThemeFor('forest').scene.unique!;
    const flames = (named(scene, 'forest-flames') as THREE.InstancedMesh).material as THREE.ShaderMaterial;
    const face = (named(scene, 'forest-face') as THREE.Mesh).material as THREE.MeshBasicMaterial;
    const ghosts = named(scene, 'forest-ghosts') as THREE.InstancedMesh;
    const crows: THREE.Object3D[] = [];
    scene.traverse((o) => {
      if (o.name === 'forest-scarecrow') crows.push(o.parent!);
    });
    const m = new THREE.Matrix4();
    let first: number | undefined;
    for (const t of [3, 9]) {
      display.time = t; // even if the time were not held at 0, nothing moves
      await act(async () => advance(t * 1000, true, store.getState()));
      expect(flames.uniforms.uTime!.value).toBe(0);
      first ??= face.color.r;
      expect(face.color.r).toBe(first);
      for (const c of crows) expect(c.rotation.z).toBe(0);
      ghosts.getMatrixAt(1, m);
      expect(m.elements[13]).toBeCloseTo(spec.forest!.ghosts[1]!.y, 5);
    }
  });
  it('keeps the shapes it builds itself within the triangles it declared', () => {
    expect(trianglesOf(buildWitchScarecrow())).toBeLessThanOrEqual(FOREST_PARTS.scarecrowTris);
  });
});
const frostRoot = () => (
  <SceneThemeContext value={sceneThemeFor('frost')}>
    <ThemeSceneRoot id="frost" />
  </SceneThemeContext>
);
describe('ThemeSceneRoot for the Frozen Cemetery', () => {
  it('mounts the shared layers, the lake, the icicles, the snow mounds and the aurora, and none of the Crypt-only parts', async () => {
    const { scene } = await mount(frostRoot);
    expect(named(scene, 'fallback')).toBeUndefined();
    const spec = sceneThemeFor('frost').scene.unique!;
    const instanced = new Set<string>();
    scene.traverse((o) => {
      if ((o as THREE.InstancedMesh).isInstancedMesh && spec.models.includes(o.name as never)) instanced.add(o.name);
    });
    for (const m of spec.models) expect(instanced.has(m), m).toBe(true);
    for (const n of ['theme-ground', 'frozen-lake', 'icicles', 'snow-mounds', 'aurora']) expect(named(scene, n), n).toBeDefined();
    expect(named(scene, 'theme-path')).toBeUndefined();
    // The ice parts are single meshes: the lake and the aurora one draw call each, the icicles and the mounds one instanced mesh each.
    const icicles = named(scene, 'icicles') as THREE.InstancedMesh;
    const mounds = named(scene, 'snow-mounds') as THREE.InstancedMesh;
    expect(icicles.isInstancedMesh && mounds.isInstancedMesh).toBe(true);
    expect(icicles.count).toBe(spec.ice!.icicles.length);
    expect(mounds.count).toBe(spec.ice!.mounds.length);
    expect(trianglesOf(icicles.geometry)).toBe(ICICLE_TRIS);
    expect(trianglesOf(mounds.geometry)).toBe(MOUND_TRIS);
    expect(trianglesOf((named(scene, 'frozen-lake') as THREE.Mesh).geometry)).toBeLessThanOrEqual(FROST_PARTS.lakeTris);
    expect(FROST_PARTS.lakeTris).toBe(LAKE_SEGMENTS);
    expect(trianglesOf((named(scene, 'aurora') as THREE.Mesh).geometry)).toBeLessThanOrEqual(AURORA_TRIS);
    // The drawing is unlit-free of extra passes: the lake and the aurora are plain shader meshes in the one scene.
    expect(((named(scene, 'frozen-lake') as THREE.Mesh).material as THREE.ShaderMaterial).isShaderMaterial).toBe(true);
    // No real lights; embers and snow are the two point layers; fog is on.
    let lights = 0;
    let points = 0;
    scene.traverse((o) => {
      if ((o as THREE.PointLight).isPointLight) lights++;
      if ((o as THREE.Points).isPoints) points++;
    });
    expect(lights).toBe(spec.lights.length);
    expect(points).toBe(2);
    expect(scene.fog).not.toBeNull();
    expect(crypt.rendered).toEqual([]);
    for (const n of ['crypt', 'arch_gate', 'fence', 'fence_pillar', 'coffin_open', 'path_A']) expect(named(scene, n), n).toBeUndefined();
  });
  it('draws falling snow for its weather', async () => {
    const { scene } = await mount(frostRoot);
    const snow: THREE.Points[] = [];
    scene.traverse((o) => {
      const p = o as THREE.Points;
      if (p.isPoints && (p.material as THREE.ShaderMaterial).defines?.KIND_SNOW !== undefined) snow.push(p);
    });
    expect(snow).toHaveLength(1);
    expect(snow[0]!.geometry.drawRange.count).toBe(WEATHER.snow.count);
  });
  it('tints the ghosts icy blue and leaves the Crypt ghost colour alone', async () => {
    const { scene } = await mount(frostRoot);
    let ghost: THREE.ShaderMaterial | undefined;
    scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.ShaderMaterial | undefined;
      if (m?.isShaderMaterial && 'uCount' in m.uniforms) ghost = m;
    });
    const want = new THREE.Color(FROST_GHOST_TINT).multiplyScalar(0.95);
    const body = ghost!.uniforms.uBody!.value as THREE.Color;
    expect([body.r, body.g, body.b].map((v) => +v.toFixed(5))).toEqual([want.r, want.g, want.b].map((v) => +v.toFixed(5)));
    expect(body.b).toBeGreaterThan(body.r);
    // The Crypt's ghosts (no tint) take the palette colour.
    const pumpkin = await mount(pumpkinRoot);
    let plain: THREE.ShaderMaterial | undefined;
    pumpkin.scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.ShaderMaterial | undefined;
      if (m?.isShaderMaterial && 'uCount' in m.uniforms) plain = m;
    });
    const pal = sceneThemeFor('pumpkin').colors.ghost.clone().multiplyScalar(0.95);
    const plainBody = plain!.uniforms.uBody!.value as THREE.Color;
    expect(plainBody.r).toBeCloseTo(pal.r, 5);
    expect(plainBody.g).toBeCloseTo(pal.g, 5);
    expect(plainBody.b).toBeCloseTo(pal.b, 5);
  });
  it('moves the sheen and the aurora with time, and holds both still under reduced motion', async () => {
    const live = await mount(frostRoot);
    const lake = (named(live.scene, 'frozen-lake') as THREE.Mesh).material as THREE.ShaderMaterial;
    const aurora = (named(live.scene, 'aurora') as THREE.Mesh).material as THREE.ShaderMaterial;
    for (const t of [3, 11]) {
      live.display.time = t;
      await act(async () => advance(t * 1000, true, live.store.getState()));
      expect(lake.uniforms.uTime!.value).toBe(t);
      expect(aurora.uniforms.uTime!.value).toBe(t);
    }
    expect(aurora.uniforms.uMoonScale!.value).toBe(live.display.moonScale);
    act(() => root?.unmount());
    root = undefined;
    const still = await mount(frostRoot, true);
    const lake2 = (named(still.scene, 'frozen-lake') as THREE.Mesh).material as THREE.ShaderMaterial;
    const aurora2 = (named(still.scene, 'aurora') as THREE.Mesh).material as THREE.ShaderMaterial;
    still.display.time = 9; // even if the time were not held at 0, the ice and the sky stand still
    await act(async () => advance(9000, true, still.store.getState()));
    expect(lake2.uniforms.uTime!.value).toBe(0);
    expect(aurora2.uniforms.uTime!.value).toBe(0);
  });
  it('hangs each icicle tip down from its point, and keeps its own shapes within the triangles it declared', () => {
    const m = icicleMatrix({ x: 2, y: 5, z: -3, length: 1, radius: 0.1 });
    const tip = new THREE.Vector3(0, 0.5, 0).applyMatrix4(m);
    const root = new THREE.Vector3(0, -0.5, 0).applyMatrix4(m);
    expect(tip.y).toBeCloseTo(4, 9);
    expect(root.y).toBeCloseTo(5, 9);
    expect(FROST_PARTS.icicleTris).toBeGreaterThanOrEqual(ICICLE_TRIS * sceneThemeFor('frost').scene.unique!.ice!.icicles.length);
  });
});
const bloodRoot = () => (
  <SceneThemeContext value={sceneThemeFor('bloodmoon')}>
    <ThemeSceneRoot id="bloodmoon" />
  </SceneThemeContext>
);
describe('ThemeSceneRoot for the Blood Moon', () => {
  it('mounts the shared layers, the ground, the stone platform and the lava cracks, and none of the Crypt-only parts', async () => {
    const { scene } = await mount(bloodRoot);
    expect(named(scene, 'fallback')).toBeUndefined();
    const spec = sceneThemeFor('bloodmoon').scene.unique!;
    // One instanced mesh per model (the ruins are drawn from named parts, which the fake file does not have).
    const instanced = new Set<string>();
    scene.traverse((o) => {
      if ((o as THREE.InstancedMesh).isInstancedMesh && spec.models.includes(o.name as never)) instanced.add(o.name);
    });
    for (const m of spec.models.filter((id) => !('parts' in MODELS[id]))) expect(instanced.has(m), m).toBe(true);
    for (const n of ['theme-ground', 'stone-platform', 'lava-cracks']) expect(named(scene, n), n).toBeDefined();
    expect(named(scene, 'theme-path')).toBeUndefined();
    // The platform and the cracks are single meshes (one draw call each), within the triangles the spec declared.
    const platform = named(scene, 'stone-platform') as THREE.Mesh;
    const cracks = named(scene, 'lava-cracks') as THREE.Mesh;
    expect(trianglesOf(platform.geometry)).toBeLessThanOrEqual(PLATFORM_TRIS);
    expect(trianglesOf(cracks.geometry)).toBe(crackRibbon(spec.blood!.cracks).index.length / 3);
    expect(BLOOD_PARTS.groundTris + trianglesOf(platform.geometry) + trianglesOf(cracks.geometry)).toBeLessThanOrEqual(spec.extras.tris);
    // The cracks add light on top of the ground: additive, so they glow, and they never write depth.
    const mat = cracks.material as THREE.ShaderMaterial;
    expect(mat.isShaderMaterial).toBe(true);
    expect(mat.blending).toBe(THREE.AdditiveBlending);
    expect(mat.depthWrite).toBe(false);
    // One red real light (the flame); embers and ash are the two point layers; fog is on.
    let lights = 0;
    let points = 0;
    scene.traverse((o) => {
      if ((o as THREE.PointLight).isPointLight) lights++;
      if ((o as THREE.Points).isPoints) points++;
    });
    expect(lights).toBe(1);
    expect(lights).toBe(spec.lights.length);
    expect(points).toBe(2);
    expect(scene.fog).not.toBeNull();
    expect(crypt.rendered).toEqual([]);
    for (const n of ['crypt', 'arch_gate', 'gravestone', 'fence', 'fence_pillar', 'coffin_open', 'path_A']) expect(named(scene, n), n).toBeUndefined();
  });
  it('lights the flame red', async () => {
    const { scene } = await mount(bloodRoot);
    let light: THREE.PointLight | undefined;
    scene.traverse((o) => {
      if ((o as THREE.PointLight).isPointLight) light = o as THREE.PointLight;
    });
    const c = light!.color;
    expect(c.r).toBeGreaterThan(c.g * 3);
    expect(c.r).toBeGreaterThan(c.b * 3);
  });
  it('draws falling ash for its weather', async () => {
    const { scene } = await mount(bloodRoot);
    const ash: THREE.Points[] = [];
    scene.traverse((o) => {
      const p = o as THREE.Points;
      if (p.isPoints && (p.material as THREE.ShaderMaterial).defines?.KIND_ASH !== undefined) ash.push(p);
    });
    expect(ash).toHaveLength(1);
    expect(ash[0]!.geometry.drawRange.count).toBe(WEATHER.ash.count);
  });
  it('pulses the cracks with time, and holds them still under reduced motion', async () => {
    const live = await mount(bloodRoot);
    const mat = (named(live.scene, 'lava-cracks') as THREE.Mesh).material as THREE.ShaderMaterial;
    for (const t of [3, 11]) {
      live.display.time = t;
      await act(async () => advance(t * 1000, true, live.store.getState()));
      expect(mat.uniforms.uTime!.value).toBe(t);
    }
    act(() => root?.unmount());
    root = undefined;
    const still = await mount(bloodRoot, true);
    const mat2 = (named(still.scene, 'lava-cracks') as THREE.Mesh).material as THREE.ShaderMaterial;
    still.display.time = 9; // even if the time were not held at 0, the cracks stand still
    await act(async () => advance(9000, true, still.store.getState()));
    expect(mat2.uniforms.uTime!.value).toBe(0);
  });
  it('flies the bigger flock of bats', async () => {
    const { scene, display, store } = await mount(bloodRoot);
    let bats: THREE.ShaderMaterial | undefined;
    scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.ShaderMaterial | undefined;
      if (m?.isShaderMaterial && 'uCount' in m.uniforms && 'uCenter' in m.uniforms) bats = m;
    });
    await act(async () => advance(1000, true, store.getState()));
    expect(bats!.uniforms.uCount!.value).toBe(Math.min(24, Math.max(7, display.bats) * 2));
    expect(bats!.uniforms.uCount!.value).toBeGreaterThan(Math.max(7, display.bats));
  });
  it('keeps the shapes it builds itself within the triangles it declared', () => {
    const spec = sceneThemeFor('bloodmoon').scene.unique!;
    expect(trianglesOf(buildPlatform(spec.blood!.platform))).toBe(PLATFORM_TRIS);
    expect(trianglesOf(buildCrackGeometry(spec.blood!.cracks))).toBeLessThanOrEqual(spec.extras.tris);
  });
});
const castleRoot = () => (
  <SceneThemeContext value={sceneThemeFor('castle')}>
    <ThemeSceneRoot id="castle" />
  </SceneThemeContext>
);
describe('ThemeSceneRoot for the Haunted Castle', () => {
  it('mounts the shared layers, the flagstone ground and path, the fortress props and the windows, and none of the Crypt-only parts', async () => {
    const { scene } = await mount(castleRoot);
    expect(named(scene, 'fallback')).toBeUndefined();
    const spec = sceneThemeFor('castle').scene.unique!;
    // One instanced mesh per model, with as many instances as placements.
    const instanced = new Map<string, number>();
    scene.traverse((o) => {
      const im = o as THREE.InstancedMesh;
      if (im.isInstancedMesh && spec.models.includes(o.name as never)) instanced.set(o.name, im.count);
    });
    for (const m of spec.models) expect(instanced.get(m), m).toBe(spec.placements.filter((p) => p.model === m).length);
    for (const n of ['theme-ground', 'theme-path']) expect(named(scene, n), n).toBeDefined();
    // The lit windows are one instanced mesh, one draw call, above the bloom threshold.
    const windows = named(scene, 'castle-windows') as THREE.InstancedMesh;
    expect(windows.isInstancedMesh).toBe(true);
    expect(windows.count).toBe(spec.castle!.windows.length);
    const wm = windows.material as THREE.MeshBasicMaterial;
    expect(wm.color.r).toBeGreaterThan(1);
    expect(wm.toneMapped).toBe(false);
    // Six real lights (the torches), two point layers (embers and the embers weather), fog on.
    let lights = 0;
    let points = 0;
    scene.traverse((o) => {
      if ((o as THREE.PointLight).isPointLight) lights++;
      if ((o as THREE.Points).isPoints) points++;
    });
    expect(lights).toBe(6);
    expect(lights).toBe(spec.lights.length);
    expect(points).toBe(2);
    expect(scene.fog).not.toBeNull();
    expect(crypt.rendered).toEqual([]);
    for (const n of ['crypt', 'arch_gate', 'gravestone', 'fence', 'fence_pillar', 'coffin_open', 'path_A']) expect(named(scene, n), n).toBeUndefined();
  });
  it('draws the embers weather and anchors it on the torch tops', async () => {
    const { scene } = await mount(castleRoot);
    const embers: THREE.Points[] = [];
    scene.traverse((o) => {
      const p = o as THREE.Points;
      if (p.isPoints && (p.material as THREE.ShaderMaterial).defines?.KIND_EMBERS !== undefined) embers.push(p);
    });
    expect(embers).toHaveLength(1);
    const mat = embers[0]!.material as THREE.ShaderMaterial;
    const anchors = sceneThemeFor('castle').scene.anchors;
    expect(mat.uniforms.uAnchorCount!.value).toBe(4);
    anchors.slice(0, 4).forEach((a, i) => {
      const v = mat.uniforms.uAnchors!.value[i] as THREE.Vector3;
      expect([v.x, v.y, v.z]).toEqual([a.x, a.y, a.z]);
    });
  });
  it('flashes the sky, the clouds and the lights at a lightning time, and not between flashes', async () => {
    const { scene, display, store } = await mount(castleRoot);
    const seed = sceneThemeFor('castle').scene.unique!.castle!.lightningSeed;
    const start = flashTimes(seed, 100)[0]!;
    const flashing: THREE.ShaderMaterial[] = [];
    let hemi: THREE.HemisphereLight | undefined;
    let sun: THREE.DirectionalLight | undefined;
    scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.ShaderMaterial | undefined;
      if (m?.isShaderMaterial && 'uFlash' in m.uniforms) flashing.push(m);
      if ((o as THREE.HemisphereLight).isHemisphereLight) hemi = o as THREE.HemisphereLight;
      if ((o as THREE.DirectionalLight).isDirectionalLight && (o as THREE.DirectionalLight).castShadow) sun = o as THREE.DirectionalLight;
    });
    // The sky dome and the clouds both take the flash.
    expect(flashing.length).toBe(2);
    expect(hemi).toBeDefined();
    display.time = start - 1;
    await act(async () => advance(1000, true, store.getState()));
    expect(display.flash).toBe(0);
    for (const m of flashing) expect(m.uniforms.uFlash!.value).toBe(0);
    expect(hemi!.intensity).toBe(LOOK.hemisphere.intensity);
    display.time = start + LIGHTNING.rise;
    await act(async () => advance(2000, true, store.getState()));
    const peak = lightningAt(display.time, seed);
    expect(peak).toBeGreaterThan(0.5);
    expect(display.flash).toBeCloseTo(peak, 9);
    for (const m of flashing) expect(m.uniforms.uFlash!.value, 'uTop' in m.uniforms ? 'sky' : 'clouds').toBeCloseTo(peak, 9);
    expect(hemi!.intensity).toBeCloseTo(LOOK.hemisphere.intensity * (1 + FLASH_BOOST.hemisphere * peak), 9);
    expect(sun!.intensity).toBeCloseTo(LOOK.moonlight.intensity * (1 + FLASH_BOOST.moonlight * peak), 9);
    // After the flash everything is back.
    display.time = start + 5;
    await act(async () => advance(3000, true, store.getState()));
    expect(display.flash).toBe(0);
    expect(hemi!.intensity).toBe(LOOK.hemisphere.intensity);
    expect(sun!.intensity).toBe(LOOK.moonlight.intensity);
  });
  it('has no flash at all under reduced motion', async () => {
    const { scene, display, store } = await mount(castleRoot, true);
    const seed = sceneThemeFor('castle').scene.unique!.castle!.lightningSeed;
    const start = flashTimes(seed, 100)[0]!;
    display.time = start + LIGHTNING.rise; // even if the time were not held at 0
    await act(async () => advance(1000, true, store.getState()));
    expect(display.flash).toBe(0);
    scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.ShaderMaterial | undefined;
      if (m?.isShaderMaterial && 'uFlash' in m.uniforms) expect(m.uniforms.uFlash!.value).toBe(0);
    });
  });
  it('clears the flash when the theme goes away, so the next theme starts dark', async () => {
    const { display, store, rerender } = await mount(castleRoot);
    const seed = sceneThemeFor('castle').scene.unique!.castle!.lightningSeed;
    display.time = flashTimes(seed, 100)[0]! + LIGHTNING.rise;
    await act(async () => advance(1000, true, store.getState()));
    expect(display.flash).toBeGreaterThan(0);
    await rerender(<mesh name="other" />);
    expect(display.flash).toBe(0);
  });
  it('sways the banners and flags with time, in one shared shader clock, and holds them still under reduced motion', async () => {
    const swayOf = (scene: THREE.Object3D) => {
      const out: { mat: THREE.Material; shader: { uniforms: Record<string, { value: number }> } }[] = [];
      for (const id of ['castle_banner', 'castle_wall_flag']) {
        const mesh = named(scene, id) as THREE.InstancedMesh;
        const mat = mesh.material as THREE.Material;
        const shader = { uniforms: {} as Record<string, { value: number }>, vertexShader: '#include <common>\n#include <begin_vertex>' };
        (mat as THREE.Material & { onBeforeCompile: (s: unknown, r: unknown) => void }).onBeforeCompile(shader, {});
        expect(shader.uniforms.uSwayTime, id).toBeDefined();
        out.push({ mat, shader });
      }
      return out;
    };
    const live = await mount(castleRoot);
    const [banner, flag] = swayOf(live.scene);
    // One clock for both cloths.
    expect(banner!.shader.uniforms.uSwayTime).toBe(flag!.shader.uniforms.uSwayTime);
    expect(banner!.shader.uniforms.uSwayAmp).toBe(flag!.shader.uniforms.uSwayAmp);
    for (const t of [4, 9]) {
      live.display.time = t;
      await act(async () => advance(t * 1000, true, live.store.getState()));
      expect(banner!.shader.uniforms.uSwayTime!.value).toBe(t);
      expect(banner!.shader.uniforms.uSwayAmp!.value).toBe(1);
    }
    act(() => root?.unmount());
    root = undefined;
    const still = await mount(castleRoot, true);
    const [sBanner] = swayOf(still.scene);
    still.display.time = 7; // even if the time were not held at 0, the cloth stands still
    await act(async () => advance(7000, true, still.store.getState()));
    expect(sBanner!.shader.uniforms.uSwayTime!.value).toBe(0);
    expect(sBanner!.shader.uniforms.uSwayAmp!.value).toBe(0);
  });
});
describe('ThemedScene points the moon of the shown theme', () => {
  const view = (id: ThemeId) => <ThemedScene themeId={id} mode="gate" load={async () => {}} scene={<mesh name="probe" />} />;
  it('uses the theme moon for a unique theme and the Crypt moon again after a switch back', async () => {
    const m = await mount(() => view('pumpkin'));
    expect(m.display.moonScale).toBe(PUMPKIN_MOON.scale);
    expect(m.display.moonTarget).toBe(PUMPKIN_MOON.target);
    // 160 x 90 is 16:9. The pumpkin moon is low (screen y about 0.34), the Crypt moon higher (about 0.25).
    const low = m.display.moon.y;
    await m.rerender(view('crypt'));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
    expect(m.display.moonScale).toBe(1);
    expect(m.display.moonTarget).toBeNull();
    expect([m.display.moon.x, m.display.moon.y, m.display.moon.z]).toEqual([...moonDirection(16 / 9)]);
    expect(m.display.moon.y).toBeGreaterThan(low);
  });
  it('uses the cold silver moon for the Frozen Cemetery', async () => {
    const m = await mount(() => view('frost'));
    expect(m.display.moonScale).toBe(FROST_MOON.scale);
    expect(m.display.moonTarget).toBe(FROST_MOON.target);
  });
  it('uses the huge blood-red moon, twice the Crypt\'s, for the Blood Moon', async () => {
    const m = await mount(() => view('bloodmoon'));
    expect(m.display.moonScale).toBe(2);
    expect(m.display.moonScale).toBe(BLOOD_MOON.scale);
    expect(m.display.moonTarget).toBe(BLOOD_MOON.target);
  });
  it('uses the pale moon, a little bigger than the Crypt\'s, for the Haunted Castle', async () => {
    const m = await mount(() => view('castle'));
    expect(m.display.moonScale).toBe(CASTLE_MOON.scale);
    expect(m.display.moonScale).toBeGreaterThanOrEqual(1);
    expect(m.display.moonScale).toBeLessThanOrEqual(1.2);
    expect(m.display.moonTarget).toBe(CASTLE_MOON.target);
  });
  it('aims the light of the Witch\'s Forest with its hidden moon', async () => {
    const m = await mount(() => view('forest'));
    expect(m.display.moonScale).toBe(FOREST_MOON.scale);
    expect(m.display.moonTarget).toBe(FOREST_MOON.target);
  });
});
