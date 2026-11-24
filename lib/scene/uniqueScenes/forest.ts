// The Witch's Forest: a haunted red-green forest at night. A fire lights it from the left (hot red-orange) and eerie green
// mist fills the distance and the right. Huge gnarled dead trees close over a winding dirt path like a tunnel, in three layers
// of depth. The biggest tree, in the left foreground, has a glowing jack-o'-lantern face; a fire burns at its foot beside a
// big jack-o'-lantern. Scarecrows stand along the path, green ghosts float among the branches, crooked crosses lean near
// the trail, and a small cauldron glows green beside it. Pure and seeded.
// Coordinates: x right, y up, z toward the camera (the camera is at z = 16).
import { MODELS, type Placement, type WarmSource } from '../layout';
import { WEATHER } from '../weather';
import {
  CAULDRON, FIRE, FLAME_COUNT, FLAME_TRIS, FOREST_PARTS, GHOSTS, GRAVES, MUSHROOMS, PLANT_TRIS, SCARECROWS, SOUP_LEVEL,
  SOUP_RADIUS, SPARK_COUNT, TUFT_TRIS, WISP, SCARY_TREE_TRIS, THORN_TRIS, flames, scaryGround, grass, graveFootprint, scarecrowFootprint, type ForestParts,
} from './forestParts';
import { Placer, modelsOf, sampleLine, solidFootprint, type UniqueMoon, type UniqueSceneSpec } from './types';
export { CAULDRON, FIRE };
/** Added to the caller's seed, so this theme has its own random stream. */
export const FOREST_SEED = 7211;
/** A big blood-red moon in the upper right, behind the branches and the green mist. */
export const FOREST_MOON: UniqueMoon = {
  target: () => ({ x: 0.82, y: 0.2 }),
  scale: 1.25,
  // The branches of the dark trees cross in front of it, so it shows through the gaps.
  seeThrough: true,
};
/** The dirt path winds from the bottom centre of the screen to the misty distance. */
const TRAIL: [number, number][] = [
  [0.6, 13], [-0.4, 9], [1.3, 4.5], [2.0, 0], [0.5, -4.5], [-1.2, -9.5], [-0.9, -15], [0.6, -21], [1.0, -26],
];
export const TRAIL_HALF_WIDTH = 1.5;
/** The twisted trees. */
export type Tree = 'forest_twisted_a' | 'forest_twisted_b' | 'forest_twisted_c';
/** Which way the crown of each tree model leans in its file: +1 toward +x, -1 toward -x. */
export const TREE_LEAN: Record<Tree, 1 | -1> = { forest_twisted_a: -1, forest_twisted_b: 1, forest_twisted_c: 1 };
/** The lowest point of the twisted trees in their files, below y = 0 (scaled and lifted at placement). */
const TREE_FOOT = 0.2;
/** The three layers of depth, nearest first: the camera-side limit of each (z) tells which layer a tree is in. */
export const LAYERS = { near: -4, mid: -18 } as const;
/** The haunted tree, in the left foreground: the biggest, and the only one that has a face. */
export const HERO = { model: 'forest_twisted_a' as const, x: -7.4, z: -0.6, rotY: Math.PI + 0.3, scale: 1.45 };
/** The big jack-o'-lantern beside the fire. */
export const JACK = { x: -2.9, z: 5.2, rotY: 0.35, scale: 1.5 };
/** The tree at the end of the trail that closes the tunnel: the centrepiece, on the middle of the screen, in the fog. */
const TUNNEL_END = { model: 'forest_twisted_c' as const, x: 1.2, z: -31.5, rotY: Math.PI, scale: 1.6 };
/** Triangles of the placements (the shadow pass counted) the whole scene may reach. Own parts and weather add under 20,000 to the 200,000 plan. */
export const PLACEMENT_TRI_LIMIT = 178_000;
/** Triangles of some placements as the budget plan counts them: every instance, twice when the model casts shadows. */
export const planTriangles = (placements: readonly Placement[]): number =>
  placements.reduce((sum, p) => sum + MODELS[p.model].tris * (MODELS[p.model].shadow ? 2 : 1), 0);
/** The green liquid of the cauldron: its centre and radius for `CauldronFx`. Pure. */
export function cauldronFxAt(p: Pick<Placement, 'x' | 'y' | 'z' | 'scale'>): { x: number; y: number; z: number; radius: number } {
  return { x: p.x, y: p.y + SOUP_LEVEL * p.scale, z: p.z, radius: SOUP_RADIUS * p.scale };
}
/** Hand-picked spots for the trees of each layer: x, z, and which model. The sizes and turns get a small seeded jitter. */
const MID_TREES: readonly [number, number, Tree][] = [
  [-11, -10, 'forest_twisted_b'], [-6.4, -15, 'forest_twisted_c'], [-14.5, -17, 'forest_twisted_c'], [-9, -22, 'forest_twisted_b'],
  [10.5, -11, 'forest_twisted_a'], [7.6, -17, 'forest_twisted_b'], [13.5, -19, 'forest_twisted_a'], [10, -24, 'forest_twisted_c'],
];
const FAR_TREES: readonly [number, number, Tree][] = [
  [-16, -27, 'forest_twisted_b'], [-8, -30, 'forest_twisted_a'], [-20, -32, 'forest_twisted_c'], [-4, -33, 'forest_twisted_b'],
  [7, -31, 'forest_twisted_c'], [15, -28, 'forest_twisted_a'], [20, -33, 'forest_twisted_b'], [-12, -34, 'forest_twisted_c'],
];
export function buildWitchsForest(seed: number): UniqueSceneSpec {
  const line = sampleLine(TRAIL, 1.5);
  const centre = line.map(({ x, z }) => ({ x, z }));
  const placer = new Placer({ id: 'forest', seed: FOREST_SEED + seed, moon: FOREST_MOON, path: { centre, halfWidth: TRAIL_HALF_WIDTH } });
  const { between } = placer;
  const lights: WarmSource[] = [];
  const glows: WarmSource[] = [];
  // Things the scene draws itself keep their footprint free first, so no model stands in them.
  for (const s of SCARECROWS) placer.reserve(scarecrowFootprint(s));
  for (const g of GRAVES) placer.reserve(graveFootprint(g));
  placer.reserve({ x: FIRE.x, z: FIRE.z, hx: 1.5, hz: 1.1, rotY: 0 });
  // ----- layer 1: the huge trees of the foreground -----
  const tree = (model: Tree, x: number, z: number, rotY: number, scale: number, group: 'themed' | 'centre' = 'themed', must = false) => {
    const p = placer.make(model, group, x, z, rotY, scale, TREE_FOOT * scale + 0.004);
    return must ? placer.fixed(p, { margin: 0.05 }, group === 'centre') : placer.tryAdd(p, { margin: 0.05 }, group === 'centre');
  };
  const hero = tree(HERO.model, HERO.x, HERO.z, HERO.rotY, HERO.scale, 'themed', true)!;
  // The crowns lean in over the trail, so the trees close above it like a tunnel: a tree on the left needs a crown that leans toward +x.
  const lean = (m: Tree, x: number) => {
    const side = x < 0 ? -1 : 1;
    return (TREE_LEAN[m] * -side > 0 ? 0 : Math.PI) + between(-0.3, 0.3);
  };
  tree('forest_twisted_b', -13.5, -4, lean('forest_twisted_b', -13.5), 1.3);
  tree('forest_twisted_c', 11.5, -3, lean('forest_twisted_c', 11.5), 1.25);
  tree('forest_twisted_a', 5.6, -9.5, lean('forest_twisted_a', 5.6), 1.3);
  // ----- the tree that closes the tunnel at the end of the trail -----
  const end = tree(TUNNEL_END.model, TUNNEL_END.x, TUNNEL_END.z, TUNNEL_END.rotY, TUNNEL_END.scale, 'centre', true)!;
  // ----- layers 2 and 3: the walls of the tunnel, then the trees fading into the green fog -----
  for (const [x, z, m] of [...MID_TREES, ...FAR_TREES]) {
    const far = z < LAYERS.mid;
    const scale = far ? between(0.9, 1.25) : between(1.0, 1.35);
    tree(m, x + between(-0.8, 0.8), z + between(-1, 1), lean(m, x), scale);
  }
  // ----- the fire at the foot of the haunted tree, and the big jack-o'-lantern beside it -----
  const jack = placer.fixed(placer.make('pumpkin_orange_jackolantern', 'themed', JACK.x, JACK.z, JACK.rotY, JACK.scale), { margin: 0.05, anyMoon: true });
  const jackTop = MODELS.pumpkin_orange_jackolantern.h * JACK.scale;
  lights.push({ kind: 'torch', x: FIRE.x + 0.4, y: 1.0, z: FIRE.z + 0.7 });
  lights.push({ kind: 'jackOLantern', x: jack.x + 0.2, y: jackTop * 0.45, z: jack.z + 1.1 });
  // A second, higher light throws the glow of the fire up the trunk and on the face.
  lights.push({ kind: 'torch', x: FIRE.x - 1.0, y: 3.4, z: FIRE.z - 0.8 });
  for (const [dx, dz] of [[-0.5, 0], [0.5, 0.3], [0, -0.5]] as const) glows.push({ kind: 'torch', x: FIRE.x + dx, y: 0.7, z: FIRE.z + dz });
  glows.push({ kind: 'jackOLantern', x: jack.x, y: jackTop * 0.5, z: jack.z + 0.4 });
  // ----- the small cauldron beside the path, with a few small glowing mushrooms -----
  const pot = placer.fixed(placer.make('forest_cauldron', 'themed', CAULDRON.x, CAULDRON.z, CAULDRON.rotY, CAULDRON.scale), { margin: 0.05, anyMoon: true });
  const potTop = MODELS.forest_cauldron.h * pot.scale;
  lights.push({ kind: 'cauldron', x: pot.x, y: potTop + 0.3, z: pot.z + 0.4 });
  glows.push({ kind: 'cauldron', x: pot.x, y: potTop, z: pot.z });
  for (const m of MUSHROOMS) {
    const shroom = placer.tryAdd(placer.make('forest_mushroom', 'themed', pot.x + m.dx, pot.z + m.dz, between(0, Math.PI * 2), m.scale), { margin: 0.05, anyMoon: true });
    if (shroom) glows.push({ kind: 'mushroom', x: shroom.x, y: MODELS.forest_mushroom.h * shroom.scale * 0.85, z: shroom.z });
  }
  const placements: Placement[] = placer.placements;
  const keepOut = [...placer.reserved, ...placements.map(solidFootprint)];
  const ground = grass(centre, TRAIL_HALF_WIDTH, keepOut);
  const { scary, thorns } = scaryGround(centre, TRAIL_HALF_WIDTH, keepOut);
  const parts: ForestParts = {
    hero: { id: hero.id },
    fire: { x: FIRE.x, z: FIRE.z, flames: flames(), sparks: SPARK_COUNT },
    jackId: jack.id,
    scarecrows: [...SCARECROWS],
    ghosts: [...GHOSTS],
    wisp: WISP,
    graves: [...GRAVES],
    grass: ground,
    scary,
    thorns,
  };
  const extras = {
    tris:
      FOREST_PARTS.groundTris + 2 * centre.length + FLAME_COUNT * FLAME_TRIS + 2 * SPARK_COUNT +
      parts.grass.tufts.length * TUFT_TRIS + parts.grass.plants.length * PLANT_TRIS + scary.length * SCARY_TREE_TRIS + thorns.length * THORN_TRIS + FOREST_PARTS.graveTris +
      SCARECROWS.length * FOREST_PARTS.scarecrowTris + (GHOSTS.length + 1) * FOREST_PARTS.ghostTris + FOREST_PARTS.liquidTris,
    calls: FOREST_PARTS.calls,
  };
  return {
    id: 'forest',
    seed,
    centrepiece: { placement: end, ids: [end.id] },
    placements,
    reserved: placer.reserved,
    models: modelsOf(placements),
    ground: { kind: 'earth' },
    path: { kind: 'dirt', centre, halfWidth: TRAIL_HALF_WIDTH },
    moon: FOREST_MOON,
    sky: [],
    lights,
    glows,
    anchors: [],
    // The ghosts float high among the branches on the right.
    ghostSpots: GHOSTS.map((g) => ({ x: g.x, y: g.y, z: g.z })),
    weather: WEATHER.fireflies,
    layers: { clouds: false, witch: false, bats: 0, ghosts: false, mist: true, embers: false },
    extras,
    forest: parts,
    // Thick green fog: the far trees fade into it, and it lies low on the ground.
    fogScale: 2.6,
  };
}
