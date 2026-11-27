// The Witch's Forest: a haunted red-green forest at night. A fire lights it from the left (hot red-orange) and eerie green
// mist fills the distance and the right. Huge gnarled dead trees close over a winding dirt path like a tunnel, in three layers
// of depth. The biggest tree, in the left foreground, has a glowing jack-o'-lantern face; a fire burns at its foot beside a
// big jack-o'-lantern. Scarecrows stand along the path, green ghosts float among the branches, crooked crosses lean near
// the trail, and a small cauldron glows green beside it. Pure and seeded.
// Coordinates: x right, y up, z toward the camera (the camera is at z = 16).
import { cameraAt, project } from '../camera';
import { MODELS, type Placement, type WarmSource } from '../layout';
import { clearSkyMoon, moonScreenRadiusScaled } from '../sky';
import { WEATHER } from '../weather';
import {
  CAULDRON, FIRE, FLAME_COUNT, FLAME_TRIS, FOREST_PARTS, GHOSTS, GRAVES, MUSHROOMS, PLANT_TRIS, SCARECROWS, SOUP_LEVEL,
  SOUP_RADIUS, SPARK_COUNT, TUFT_TRIS, WISP, SCARY_TREE_TRIS, THORN_TRIS, LOG_TRIS, EXTRA_GRAVE_TRIS, flames, scaryGround, grass, graveFootprint, scarecrowFootprint, type ForestParts,
} from './forestParts';
import { buildFill } from './fill';
import { HOUSE_FOOTPRINT, HOUSE_LANE, MOON_DEPTH, forestMidground, midgroundTris } from './forestHouse';
import { Placer, VIEW_ASPECTS, modelsOf, sampleLine, solidFootprint, type UniqueMoon, type UniqueSceneSpec } from './types';
export { CAULDRON, FIRE };
export { WITCH_HOUSE } from './forestHouse';
/** Added to the caller's seed, so this theme has its own random stream. */
export const FOREST_SEED = 7211;
/**
 * How far (view depth) the moon stands in the forest: behind the witch's house, the trees and the tree-line, so the dark
 * branches cross it and the cottage stands in front of it.
 */
export const FOREST_MOON_DEPTH = MOON_DEPTH;
/**
 * A large pale yellow-green full moon high in the right sky, under the header buttons and well above the pine line.
 * It is a crisp disc with soft patches and no wide halo.
 */
/**
 * The disc's size (times the Crypt's). The moon fits between the header buttons (whose Dawn button wraps to a second row
 * at 1280x600, down to 0.20) and the pine line (its tops at about 0.34 of the height under the moon), with sky under it.
 */
export const FOREST_MOON_SCALE = 0.65;
/** Top of the moon's disc (share of the window height): just under the header buttons at every usual window size. */
export const FOREST_MOON_TOP = 0.215;
export const FOREST_MOON: UniqueMoon = {
  // Raised clear of the pine line: the whole disc floats in the sky with open sky under it, still on the right.
  target: (aspect) => ({ x: clearSkyMoon(aspect, FOREST_MOON_SCALE).x, y: FOREST_MOON_TOP + moonScreenRadiusScaled(aspect, FOREST_MOON_SCALE).disc }),
  scale: FOREST_MOON_SCALE,
  crisp: true,
  // The branches of the dark trees cross in front of it, so it shows through the gaps.
  seeThrough: true,
};
/**
 * The window of open sky the moon shows through: nothing tall may stand so that its crown (a ball of `reach` around the top
 * part of the tree) covers the middle of the disc, at any usual window shape. Only a few branch tips at the edge cross it, so
 * the moon reads as behind the trees and is still plainly seen. `MOON_WINDOW` is the share of the disc radius kept clear.
 */
export const MOON_WINDOW = 0.6;
export function blocksMoonWindow(x: number, z: number, height: number, reach: number, aspects: readonly number[] = VIEW_ASPECTS): boolean {
  for (const aspect of aspects) {
    const cam = cameraAt(0, aspect, true);
    const t = FOREST_MOON.target(aspect);
    const r = moonScreenRadiusScaled(aspect, FOREST_MOON.scale).disc * MOON_WINDOW;
    const tanH = Math.tan((cam.fov * Math.PI) / 360);
    for (const k of [0.3, 0.45, 0.6, 0.75, 0.9, 1]) {
      const q = project([x, height * k, z], cam);
      if (!q) continue;
      const pad = reach / (q.depth * tanH * 2);
      if (Math.hypot((q.x - t.x) * aspect, q.y - t.y) < r + pad) return true;
    }
  }
  return false;
}
/** Where the middle of the crown of each tree model is, sideways from its trunk in the file (x, model units): the crowns lean. */
export const CROWN_SHIFT: Record<'forest_twisted_a' | 'forest_twisted_b' | 'forest_twisted_c', number> = {
  forest_twisted_a: -1.4,
  forest_twisted_b: 4.5,
  forest_twisted_c: 1.2,
};
/** How far the crown of a twisted tree reaches from its trunk, per unit of scale (the bark spreads about 5 to 6 each way). */
export const CROWN_REACH = 2.5;
/** The dirt path winds from the bottom centre of the screen to the misty distance. */
const TRAIL: [number, number][] = [
  [0.6, 13], [-0.4, 9], [1.3, 4.5], [2.0, 0], [0.5, -4.5], [-1.2, -9.5], [-0.9, -15], [0.6, -21], [1.0, -26], [2.0, -28.5], [1.3, -32.2],
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
const TUNNEL_END = { model: 'forest_twisted_c' as const, x: -13, z: -31, rotY: 0, scale: 1.6 };
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
  // Spare spots: they fill in where a tree above is left out to keep the moon's window of sky clear.
  [-16.5, -8, 'forest_twisted_a'], [-3.8, -21, 'forest_twisted_c'], [16, -9, 'forest_twisted_b'], [4.6, -21, 'forest_twisted_a'],
];
// The middle of the back is left to the witch's house and the moon behind it, so the big trees of the back row stand at the sides.
const FAR_TREES: readonly [number, number, Tree][] = [
  [-16, -27, 'forest_twisted_b'], [-20, -32, 'forest_twisted_c'], [20, -33, 'forest_twisted_b'], [-12, -34, 'forest_twisted_c'], [17, -27, 'forest_twisted_a'],
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
  placer.reserve(HOUSE_FOOTPRINT);
  // ----- layer 1: the huge trees of the foreground -----
  const tree = (model: Tree, x: number, z: number, rotY: number, scale: number, group: 'themed' | 'centre' = 'themed', must = false, overMoon = false) => {
    // The crown is checked where it is: its middle is shifted sideways from the trunk, turned with the tree.
    const shift = CROWN_SHIFT[model] * scale;
    if (!must && !overMoon && blocksMoonWindow(x + Math.cos(rotY) * shift, z - Math.sin(rotY) * shift, MODELS[model].h * scale, CROWN_REACH * scale)) return null;
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
  // The third huge foreground tree stands at the left edge. (It stood on the right, in front of the old moon; the moon is now
  // in the clear sky of the upper right corner, where a huge near tree would hide it.)
  tree('forest_twisted_c', -15, 0, lean('forest_twisted_c', -15), 1.25);
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
  // Low in front of the face: the candle inside spills a small warm pool on the ground around the pumpkin.
  lights.push({ kind: 'jackOLantern', x: jack.x, y: jackTop * 0.35, z: jack.z + 1.1 });
  // A second, higher light throws the glow of the fire up the trunk and on the face.
  lights.push({ kind: 'torch', x: FIRE.x - 1.0, y: 3.4, z: FIRE.z - 0.8 });
  for (const [dx, dz] of [[-0.5, 0], [0.5, 0.3], [0, -0.5]] as const) glows.push({ kind: 'torch', x: FIRE.x + dx, y: 0.7, z: FIRE.z + dz, size: 0.7 });
  // The soft orange glow on the ground around it (the carved face itself glows in its material, see WitchsForestScene).
  glows.push({ kind: 'jackOLantern', x: jack.x, y: jackTop * 0.5, z: jack.z + 0.4, size: 0.8 });
  // ----- the small cauldron beside the path, with a few small glowing mushrooms -----
  const pot = placer.fixed(placer.make('forest_cauldron', 'themed', CAULDRON.x, CAULDRON.z, CAULDRON.rotY, CAULDRON.scale), { margin: 0.05, anyMoon: true });
  const potTop = MODELS.forest_cauldron.h * pot.scale;
  lights.push({ kind: 'cauldron', x: pot.x, y: potTop + 0.3, z: pot.z + 0.4 });
  glows.push({ kind: 'cauldron', x: pot.x, y: potTop, z: pot.z });
  for (const m of MUSHROOMS) {
    const shroom = placer.tryAdd(placer.make('forest_mushroom', 'themed', pot.x + m.dx, pot.z + m.dz, between(0, Math.PI * 2), m.scale), { margin: 0.05, anyMoon: true });
    if (shroom) glows.push({ kind: 'mushroom', x: shroom.x, y: MODELS.forest_mushroom.h * shroom.scale * 0.85, z: shroom.z });
  }
  // ----- mossy rocks and little glowing mushroom clusters in the middle ground, away from the lane in front of the house -----
  const free = (x: number, z: number) => !(x > HOUSE_LANE.x[0] && x < HOUSE_LANE.x[1] && z > HOUSE_LANE.z[0] && z < HOUSE_LANE.z[1]);
  let rocks = 0;
  for (let n = 0; n < 160 && rocks < 6; n++) {
    const x = between(-21, 21);
    const z = between(-33, -7);
    if (!free(x, z)) continue;
    const large = rocks !== 2;
    const scale = large ? between(0.38, 0.55) : between(0.55, 0.9);
    // The large rock's file reaches 0.32 below its origin: lift it so its lowest point sits just in the ground.
    const rock = placer.tryAdd(placer.make(large ? 'forest_rock_large' : 'forest_rocks', 'themed', x, z, between(0, Math.PI * 2), scale, large ? 0.3 * scale : 0), { margin: 0.4, anyMoon: true });
    if (rock) rocks++;
  }
  let clusters = 0;
  for (let n = 0; n < 160 && clusters < 3; n++) {
    const x = between(-18, 18);
    const z = between(-32, -8);
    if (!free(x, z)) continue;
    const first = placer.tryAdd(placer.make('forest_mushroom', 'themed', x, z, between(0, Math.PI * 2), between(1.0, 1.5)), { margin: 0.3, anyMoon: true });
    if (!first) continue;
    glows.push({ kind: 'mushroom', x: first.x, y: MODELS.forest_mushroom.h * first.scale * 0.85, z: first.z });
    for (const [dx, dz, sc] of [[1.5, 0.4, 0.8], [-1.1, 1.1, 0.65]] as const) {
      placer.tryAdd(placer.make('forest_mushroom', 'themed', x + dx, z + dz, between(0, Math.PI * 2), first.scale * sc), { margin: 0.02, anyMoon: true });
    }
    clusters++;
  }
  const placements: Placement[] = placer.placements;
  const keepOut = [...placer.reserved, ...placements.map(solidFootprint)];
  const ground = grass(centre, TRAIL_HALF_WIDTH, keepOut);
  const { scary, thorns, logs, moreGraves } = scaryGround(centre, TRAIL_HALF_WIDTH, keepOut, (x, z, height, reach) => blocksMoonWindow(x, z, height, reach));
  const mid = forestMidground(centre, TRAIL_HALF_WIDTH, [...keepOut, ...[...scary.map((t) => ({ x: t.x, z: t.z, hx: 1, hz: 1, rotY: 0 })), ...thorns.map((t) => ({ x: t.x, z: t.z, hx: 1, hz: 1, rotY: 0 })), ...logs.map((l) => ({ x: l.x, z: l.z, hx: 1.6, hz: 1.6, rotY: 0 })), ...moreGraves.map((g) => ({ x: g.x, z: g.z, hx: 0.6, hz: 0.6, rotY: 0 }))]]);
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
    logs,
    moreGraves,
    mid,
  };
  const allLogs = [...logs, ...mid.logs];
  const allGraves = [...moreGraves, ...mid.graves];
  const extras = {
    tris:
      FOREST_PARTS.groundTris + 2 * centre.length + FLAME_COUNT * FLAME_TRIS + 2 * SPARK_COUNT +
      parts.grass.tufts.length * TUFT_TRIS + parts.grass.plants.length * PLANT_TRIS + scary.length * SCARY_TREE_TRIS + thorns.length * THORN_TRIS + logs.length * LOG_TRIS + moreGraves.length * EXTRA_GRAVE_TRIS + FOREST_PARTS.graveTris +
      SCARECROWS.length * FOREST_PARTS.scarecrowTris + (GHOSTS.length + 1) * FOREST_PARTS.ghostTris + FOREST_PARTS.liquidTris +
      midgroundTris(mid, EXTRA_GRAVE_TRIS / 4, LOG_TRIS),
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
    fill: buildFill({
      theme: 'forest',
      seed,
      placements,
      keepOut: [
        ...placer.reserved,
        ...[...scary, ...thorns, ...mid.farTrees, ...mid.moonTrees].map((t) => ({ x: t.x, z: t.z, hx: 0.8, hz: 0.8, rotY: 0 })),
        ...allLogs.map((l) => ({ x: l.x, z: l.z, hx: 1.0, hz: 1.0, rotY: 0 })),
        ...allGraves.map((g) => ({ x: g.x, z: g.z, hx: 0.7, hz: 0.7, rotY: 0 })),
        ...mid.stumps.map((s) => ({ x: s.x, z: s.z, hx: 0.8, hz: 0.8, rotY: 0 })),
      ],
      path: { centre, halfWidth: TRAIL_HALF_WIDTH },
      moon: FOREST_MOON,
    }),
    // Thick green fog: the far trees fade into it, and it lies low on the ground.
    fogScale: 2.6,
  };
}
