// @vitest-environment jsdom
// The cauldron liquid: the Crypt's draws where it always did; the Witch's Forest passes a position and a radius.
import { _roots, createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CauldronFx } from '../../entrypoints/newtab/layers/scene/CauldronFx';
import { createDisplay, DisplayContext } from '../../entrypoints/newtab/layers/scene/display';
import { SceneThemeContext, sceneThemeFor } from '../../entrypoints/newtab/layers/scene/themeColors';
import { layout } from '../../lib/scene/layout';
import { sceneState } from '../../lib/scene/meaning';
import { CAULDRON, cauldronFxAt } from '../../lib/scene/uniqueScenes/forest';
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
  vi.restoreAllMocks();
});
/** The group of the liquid and the radius of its disc. */
async function liquid(theme: 'crypt' | 'forest', at?: Parameters<typeof CauldronFx>[0]['at']) {
  const canvas = document.createElement('canvas');
  root = createRoot(canvas);
  await act(async () => {
    await root!.configure({ gl: fakeGl as never, frameloop: 'never', size: { width: 160, height: 90, top: 0, left: 0 }, events: undefined } as never);
    root!.render(
      <DisplayContext.Provider value={createDisplay(state, false)}>
        <SceneThemeContext value={sceneThemeFor(theme)}>
          <CauldronFx at={at} />
        </SceneThemeContext>
      </DisplayContext.Provider>,
    );
  });
  const scene = _roots.get(canvas)!.store.getState().scene;
  let mesh: THREE.Mesh | undefined;
  scene.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) mesh = o as THREE.Mesh;
  });
  const g = mesh!.geometry as THREE.CircleGeometry;
  return { group: mesh!.parent!, radius: g.parameters.radius, disposed: vi.spyOn(g, 'dispose') };
}
describe('CauldronFx', () => {
  it('draws at the Crypt cauldron, as before, without a position', async () => {
    const pot = layout().scenery.cauldron;
    const l = await liquid('crypt');
    expect(l.group.position.toArray()).toEqual([pot.x, pot.y - 0.1, pot.z]);
    expect(l.radius).toBe(0.55);
  });
  it('draws at the position and radius it is given', async () => {
    const at = cauldronFxAt({ x: CAULDRON.x, y: 0, z: CAULDRON.z, scale: CAULDRON.scale });
    const l = await liquid('forest', at);
    expect(l.group.position.toArray()).toEqual([at.x, at.y, at.z]);
    expect(l.radius).toBeCloseTo(at.radius, 9);
    expect(l.radius).not.toBe(0.55);
  });
  it('frees a placed liquid when it goes, and leaves the Crypt liquid alone as before', async () => {
    const at = cauldronFxAt({ x: 0, y: 0, z: 0, scale: 12 });
    const placed = await liquid('forest', at);
    act(() => root?.unmount());
    root = undefined;
    expect(placed.disposed).toHaveBeenCalled();
    const crypt = await liquid('crypt');
    act(() => root?.unmount());
    root = undefined;
    expect(crypt.disposed).not.toHaveBeenCalled();
  });
});
