// The layout, model list, weather anchors and weather spec of each theme. Pure: no three, no browser APIs.
// The Crypt is the base layout itself. The other themes start from a copy of it and change only what their
// prop table says, with their own random stream, so the base placements and the Crypt are never disturbed.
import { themeById, type PropAdd, type ThemeId, type ZoneName } from '../themes';
import { WEATHER, type WeatherSpec } from './weather';
import {
  LAYOUT_SEED, MODELS, PATH_CLEARANCE, PATH_HALF_WIDTH, blocksMoon, buildLayout, cutByScreenEdge, footprintOf, footprintsOverlap, insideGround,
  layout, FLAT_GROUPS, type Group, type Layout, type ModelId, type Placement, type WarmSource,
} from './layout';
import { mulberry32 } from './rng';

export interface ThemeScene {
  /** Same type as `buildLayout()` returns. For the Crypt it is `layout()` itself. */
  readonly layout: Layout;
  /** Unique models of the layout that have a file, for loading and preload. */
  readonly models: ModelId[];
  /** Torch tops, where the castle embers rise. */
  readonly anchors: { x: number; y: number; z: number }[];
  readonly weather: WeatherSpec | null;
}

/** One seed per theme. The base stream (`LAYOUT_SEED`) is never used here. */
export const THEME_SEED: Record<ThemeId, number> = {
  crypt: 0,
  pumpkin: 7101,
  forest: 7211,
  frost: 7321,
  bloodmoon: 7431,
  castle: 7541,
};

/** The areas an added prop may stand in. Left and right are the sides of the yard, far is behind the fence. */
export const ZONES: Record<ZoneName, { x: [number, number]; z: [number, number] }> = {
  left: { x: [-22, -6], z: [-18, 8] },
  right: { x: [6, 22], z: [-18, 8] },
  far: { x: [-26, 26], z: [-37, -23] },
};

const TRIES = 60;
const ADD_MARGIN = 0.4;
const SWAP_MARGIN = 0.15;
/** Added props stay at least this far from the crypt doorway. */
export const DOOR_CLEARANCE = 7;
/** Loose scenery that a large added prop may replace, as the perch trees of the base layout do. Everything else is never moved. */
const EVICTABLE: readonly Group[] = ['oldGrave', 'small', 'tree'];
/** The second half of the tries may replace up to this many loose props. */
const MAX_EVICT = 12;
const MOON_FREE = (p: Placement) => !blocksMoon(p);

const hasFile = (id: ModelId) => MODELS[id].source !== 'procedural';
const modelsOf = (placements: readonly Placement[]): ModelId[] => [...new Set(placements.map((p) => p.model))].filter(hasFile);

function pinnedIds(base: Layout): Set<string> {
  const { owl, crows } = base.scenery;
  const pinned = new Set<string>();
  const near = (p: Placement, x: number, z: number) => Math.abs(p.x - x) < 1e-6 && Math.abs(p.z - z) < 1e-6;
  for (const p of base.placements) {
    if (p.group !== 'tree') continue;
    if (near(p, owl.branch[0], owl.branch[2])) pinned.add(p.id);
    if (crows.some((c) => near(p, c.x - 0.3, c.z - 0.4))) pinned.add(p.id);
  }
  return pinned;
}

const cache = new Map<string, ThemeScene>();

/** The scene data of a theme. Same arguments give the same object. */
export function themeScene(id: ThemeId, seed: number = LAYOUT_SEED): ThemeScene {
  const key = `${id}:${seed}`;
  let hit = cache.get(key);
  if (!hit) {
    hit = build(id, seed);
    cache.set(key, hit);
  }
  return hit;
}

function build(id: ThemeId, seed: number): ThemeScene {
  const theme = themeById(id);
  const base = seed === LAYOUT_SEED ? layout() : buildLayout(seed);
  const weather = theme.weather ? WEATHER[theme.weather] : null;
  if (id === 'crypt') return { layout: base, models: modelsOf(base.placements), anchors: [], weather };

  const rng = mulberry32(THEME_SEED[id] + seed);
  const between = (lo: number, hi: number) => lo + (hi - lo) * rng();
  const { props } = theme;
  const pinned = pinnedIds(base);
  // Gravestones that carry a cobweb stay.
  const webbed = (p: Placement) =>
    p.group === 'oldGrave' && base.scenery.cobwebs.some((w) => Math.abs(p.z - w.z) < 1.7 && Math.abs(p.x - w.x) <= w.w / 1.9 + 0.3);
  const evictable = (p: Placement) => EVICTABLE.includes(p.group) && !pinned.has(p.id) && !webbed(p);
  let placements = base.placements.slice();
  const glows: WarmSource[] = base.glows.slice();
  const anchors: ThemeScene['anchors'] = [];
  let counter = 0;
  const made = (model: ModelId, x: number, z: number, rotY: number, scale: number): Placement => ({
    id: `theme-${model}-${counter++}`, model, group: 'themed', x, y: 0, z, rotY, scale,
  });

  const nearPath = (x: number, z: number, extra: number) =>
    base.pathCentres.some((c) => Math.hypot(c.x - x, c.z - z) < PATH_HALF_WIDTH + PATH_CLEARANCE + extra);
  const solids = () => placements.filter((p) => !FLAT_GROUPS.includes(p.group));

  // ----- drop -----
  if (props.drop) {
    const gone = new Set(props.drop.models);
    placements = placements.filter((p) => pinned.has(p.id) || !gone.has(p.model) || p.group === 'path');
  }

  // ----- swaps -----
  for (const swap of props.swaps ?? []) {
    let done = 0;
    for (let i = 0; i < placements.length && done < swap.max; i++) {
      const old = placements[i]!;
      if (old.group !== 'tree' || pinned.has(old.id) || !swap.from.includes(old.model)) continue;
      const to = swap.to[Math.floor(rng() * swap.to.length) % swap.to.length]!;
      const scale = (MODELS[old.model].h * old.scale) / MODELS[to].h;
      const next = made(to, old.x, old.z, old.rotY, scale);
      const f = footprintOf(next);
      const ok =
        insideGround(f) &&
        !nearPath(next.x, next.z, Math.max(f.hx, f.hz)) &&
        MOON_FREE(next) &&
        !cutByScreenEdge(next) &&
        solids().every((q) => q === old || !footprintsOverlap(f, footprintOf(q), SWAP_MARGIN));
      if (!ok) { counter--; continue; }
      placements[i] = next;
      done++;
    }
  }

  // ----- adds -----
  const door = base.cryptDoor;
  const tryAdd = (rule: PropAdd): Placement | null => {
    const zone = ZONES[rule.zone];
    const info = MODELS[rule.model];
    const thin = info.hx > info.hz * 3;
    for (let t = 0; t < TRIES; t++) {
      const scale = between(rule.scale[0], rule.scale[1]);
      const rotY = thin ? between(-0.25, 0.25) : between(0, Math.PI * 2);
      const p = made(rule.model, between(zone.x[0], zone.x[1]), between(zone.z[0], zone.z[1]), rotY, scale);
      const f = footprintOf(p);
      const fits =
        insideGround(f) &&
        !nearPath(p.x, p.z, Math.max(f.hx, f.hz)) &&
        Math.hypot(p.x - door.x, p.z - door.z) >= DOOR_CLEARANCE &&
        MOON_FREE(p) &&
        !cutByScreenEdge(p);
      if (fits) {
        const blockers = solids().filter((q) => footprintsOverlap(f, footprintOf(q), ADD_MARGIN));
        // The first half of the tries accepts only a free spot; the second half may replace a few loose props.
        const allowed = t < TRIES / 2 ? 0 : MAX_EVICT;
        if (blockers.length <= allowed && blockers.every(evictable)) {
          if (blockers.length) evict(blockers);
          return p;
        }
      }
      counter--;
    }
    return null;
  };
  const evict = (gone: Placement[]) => {
    const set = new Set(gone);
    placements = placements.filter((q) => !set.has(q));
    // Lit candles and mushroom glows that stood among the removed props go too.
    for (let i = glows.length - 1; i >= 0; i--) {
      const g = glows[i]!;
      if ((g.kind === 'mushroom' || (g.kind === 'candle' && g.slot === undefined)) && gone.some((q) => Math.hypot(q.x - g.x, q.z - g.z) < Math.max(MODELS[q.model].hx, MODELS[q.model].hz) * q.scale + 0.8)) glows.splice(i, 1);
    }
  };
  for (const rule of props.adds) {
    for (let n = 0; n < rule.count; n++) {
      const p = tryAdd(rule);
      if (!p) continue;
      placements.push(p);
      if (rule.torch) {
        const top = { x: p.x, y: MODELS[p.model].h * p.scale, z: p.z };
        glows.push({ kind: 'torch', ...top });
        anchors.push(top);
      }
    }
  }

  const out: Layout = { ...base, placements, glows };
  return { layout: out, models: modelsOf(placements), anchors, weather };
}
