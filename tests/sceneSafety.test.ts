// A bad placement or a theme that fails to build must never crash the app (the windmill over the moon crash), and the
// disabled themes (Blood Moon, Haunted Castle) are never built, preloaded or restored from storage.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VIEW_ASPECTS, Placer, blocksMoonFor } from '../lib/scene/uniqueScenes/types';
import { PUMPKIN_MOON, WINDMILL } from '../lib/scene/uniqueScenes/pumpkin';
import { UNIQUE_SCENES } from '../lib/scene/uniqueScenes';
import { buildBloodMoon } from '../lib/scene/uniqueScenes/bloodmoon';
import { buildHauntedCastle } from '../lib/scene/uniqueScenes/castle';
import { LAYOUT_SEED, modelFile } from '../lib/scene/layout';
import { themeScene } from '../lib/scene/themeLayout';
import { DISABLED_THEMES, ENABLED_THEME_IDS, isEnabledThemeId } from '../lib/themes';
import { readCachedTheme, SKY_CACHE_KEY } from '../lib/themeCache';
import { pendingFiles, themeFiles } from '../entrypoints/newtab/layers/scene/preloadThemes';
import { sceneThemeFor } from '../entrypoints/newtab/layers/scene/themeColors';

vi.mock('@react-three/drei', () => ({ useGLTF: Object.assign(() => ({}), { preload: () => {} }) }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const overMoon = (placer: Placer) => {
  // A tall prop placed right under the moon of the Pumpkin Patch.
  for (let x = -30; x <= 40; x += 1) {
    const p = placer.make('farm_windmill', 'themed', x, -30, 0, 5);
    if (blocksMoonFor(p, PUMPKIN_MOON, VIEW_ASPECTS)) return p;
  }
  throw new Error('no spot over the moon found');
};

describe('Placer.fixed', () => {
  const placer = () => new Placer({ id: 'pumpkin', seed: 1, moon: PUMPKIN_MOON, path: { centre: [], halfWidth: 1 } });
  it('throws in tests, so a bad number fails at once', () => {
    const pl = placer();
    expect(() => pl.fixed(overMoon(pl))).toThrow(/over the moon/);
  });
  it('in production skips the prop and warns once', () => {
    vi.stubEnv('MODE', 'production');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const a = placer();
    const p = overMoon(a);
    expect(() => a.fixed(p)).not.toThrow();
    expect(a.placements).not.toContain(p);
    const b = placer();
    b.fixed({ ...p });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]![0])).toMatch(/skipped a prop.*over the moon/);
  });
  it('the windmill stands clear of the moon', () => {
    const p = placer().make('farm_windmill', 'themed', WINDMILL.x, WINDMILL.z, WINDMILL.rotY, WINDMILL.scale);
    expect(blocksMoonFor(p, PUMPKIN_MOON)).toBe(false);
  });
});

describe('every enabled theme builds', () => {
  it.each(ENABLED_THEME_IDS)('%s', (id) => {
    expect(() => themeScene(id)).not.toThrow();
  });
});

describe('disabled themes', () => {
  it('have no unique scene builder in the runtime registry', () => {
    for (const id of DISABLED_THEMES) expect(UNIQUE_SCENES[id]).toBeUndefined();
  });
  it('are never built: they show the Crypt scene', () => {
    for (const id of DISABLED_THEMES) {
      expect(themeScene(id)).toBe(themeScene('crypt'));
      expect(sceneThemeFor(id)).toBe(sceneThemeFor('crypt'));
    }
  });
  it('are never preloaded', () => {
    const enabled = new Set(ENABLED_THEME_IDS.flatMap(themeFiles));
    const own = [...buildBloodMoon(LAYOUT_SEED).models, ...buildHauntedCastle(LAYOUT_SEED).models].map(modelFile).filter((f) => !enabled.has(f));
    expect(own.length).toBeGreaterThan(0);
    for (const id of ENABLED_THEME_IDS) for (const f of pendingFiles(id, new Set())) expect(own, f).not.toContain(f);
  });
  it('fall back to the Crypt when saved', () => {
    for (const id of DISABLED_THEMES) expect(isEnabledThemeId(id)).toBe(false);
    for (const id of ENABLED_THEME_IDS) expect(isEnabledThemeId(id)).toBe(true);
    const store = new Map<string, string>([[SKY_CACHE_KEY, 'castle']]);
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem() {}, removeItem() {} });
    expect(readCachedTheme()).toBeNull();
    vi.unstubAllGlobals();
  });
});

describe('a theme that fails to build', () => {
  it('in production shows the Crypt scene for that theme only', async () => {
    vi.resetModules();
    vi.doMock('../lib/scene/uniqueScenes', async (orig) => {
      const real = (await orig()) as typeof import('../lib/scene/uniqueScenes');
      return { ...real, UNIQUE_SCENES: { ...real.UNIQUE_SCENES, pumpkin: () => { throw new Error('boom'); } } };
    });
    vi.stubEnv('MODE', 'production');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fresh = await import('../lib/scene/themeLayout');
    expect(fresh.themeScene('pumpkin')).toBe(fresh.themeScene('crypt'));
    expect(fresh.themeScene('frost').unique?.id).toBe('frost');
    vi.doUnmock('../lib/scene/uniqueScenes');
  });
});
