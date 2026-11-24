// Feature: themes, task 9. The scene colour layer: sceneColorsFor and the context default.
// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
vi.mock('@react-three/fiber', () => ({ useThree: (sel: (s: { invalidate: () => void }) => unknown) => sel({ invalidate: () => undefined }) }));
import { C, sceneColorsFor } from '../entrypoints/newtab/layers/scene/colors';
import { CRYPT_SCENE_THEME, SceneThemeContext, sceneThemeFor, useSceneTheme } from '../entrypoints/newtab/layers/scene/themeColors';
import { layout } from '../lib/scene/layout';
import { THEME_IDS, themeById } from '../lib/themes';
import baseline from './fixtures/crypt-baseline.json';

const hex = (c: { getHexString(): string }) => '#' + c.getHexString();
const root = resolve(__dirname, '..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

describe('sceneColorsFor', () => {
  it('equals the baseline C and the baseline shader literals for the Crypt', () => {
    const c = sceneColorsFor('crypt');
    const b = baseline as unknown as { shader: Record<string, number[]> };
    expect(hex(c.skyTop)).toBe(hex(C.skyTop));
    expect(hex(c.fog)).toBe(hex(C.fog));
    expect(hex(c.hemiSky)).toBe(hex(C.hemiSky));
    expect(hex(c.hemiGround)).toBe(hex(C.hemiGround));
    expect(hex(c.rim)).toBe(hex(C.rim));
    expect(hex(c.candle)).toBe(hex(C.candle));
    expect(hex(c.lantern)).toBe(hex(C.lantern));
    expect(hex(c.jack)).toBe(hex(C.jack));
    expect(hex(c.ember)).toBe(hex(C.ember));
    expect(hex(c.door)).toBe(hex(C.door));
    expect(hex(c.moon)).toBe(hex(C.moon));
    expect(hex(c.moonlight)).toBe(hex(C.moonlight));
    expect(hex(c.skyHorizon)).toBe(hex(C.horizon));
    expect(hex(c.skyMid)).toBe(hex(C.mid));
    expect(hex(c.haze)).toBe(hex(C.haze));
    expect(hex(c.mushroom)).toBe(hex(C.mushroom));
    expect(hex(c.cauldron)).toBe(hex(C.cauldron));
    expect(hex(c.wisp)).toBe(hex(C.wisp));
    expect(hex(c.ghost)).toBe(hex(C.ghost));
    for (const key of ['moonLight', 'moonDark', 'cloudBody', 'cloudTint'] as const) {
      const want = b.shader[key]!;
      expect([c[key].r, c[key].g, c[key].b]).toEqual(want);
    }
  });
  it('returns a complete set for every theme, with the same object on repeated calls', () => {
    for (const id of THEME_IDS) {
      const keys = Object.keys(themeById(id).scene).sort();
      const set = sceneColorsFor(id);
      expect(Object.keys(set).sort()).toEqual(keys);
      for (const k of keys) expect(set[k as keyof typeof set].isColor).toBe(true);
      expect(sceneColorsFor(id)).toBe(set);
    }
  });
  it('reads the linear keys as linear numbers and the hex keys through colour management', () => {
    const f = sceneColorsFor('frost');
    const p = themeById('frost').scene;
    expect(f.cloudBody.r).toBe(p.cloudBody[0]);
    expect(hex(f.skyTop)).toBe(p.skyTop);
  });
});

describe('SceneThemeContext', () => {
  it('defaults to the Crypt, with the one layout() object', () => {
    expect(CRYPT_SCENE_THEME.id).toBe('crypt');
    expect(CRYPT_SCENE_THEME.colors).toBe(sceneColorsFor('crypt'));
    expect(CRYPT_SCENE_THEME.scene.layout).toBe(layout());
    // The default value of the context (read without a provider) is the Crypt.
    const ctx = SceneThemeContext as unknown as { _currentValue: unknown };
    expect(ctx._currentValue).toBe(CRYPT_SCENE_THEME);
    expect(typeof useSceneTheme).toBe('function');
  });
  it('sceneThemeFor is stable per theme and holds that theme\'s colours', () => {
    for (const id of THEME_IDS) {
      expect(sceneThemeFor(id)).toBe(sceneThemeFor(id));
      expect(sceneThemeFor(id).colors).toBe(sceneColorsFor(id));
      expect(sceneThemeFor(id).id).toBe(id);
    }
  });
});

describe('the shader and component literals are gone from the five files', () => {
  const files = ['Moon', 'Clouds', 'LowClouds', 'FarVillage', 'Ground'].map((n) => `entrypoints/newtab/layers/scene/${n}.tsx`);
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const b = baseline as unknown as { shader: Record<string, number[]> };
  it.each(files)('%s holds no hex literal and no baseline shader triple', (file) => {
    const src = strip(read(file));
    expect(src).not.toMatch(/#[0-9a-fA-F]{6}\b/);
    for (const triple of Object.values(b.shader)) {
      const [r, g, bl] = triple;
      expect(src).not.toContain(`${r}, ${g}, ${bl}`);
    }
  });
  it.each(files)('%s reads its colours from the context', (file) => {
    const src = read(file);
    expect(src).toMatch(/useColorSync/);
    expect(src).toMatch(/sceneColorsFor/);
  });
  it('the other scene parts no longer import the Crypt set C or call layout()', () => {
    for (const n of ['Sky', 'Mist', 'Embers', 'Ghosts', 'Wisps', 'CauldronFx', 'OpenCoffin', 'Glows', 'Lights', 'SceneContents', 'Props', 'Cat', 'Crows', 'Owl', 'Skeletons', 'Spiders']) {
      const src = strip(read(`entrypoints/newtab/layers/scene/${n}.tsx`));
      expect(src, n).not.toMatch(/\bC\.[a-zA-Z]+/);
      expect(src, n).not.toMatch(/\blayout\(\)/);
    }
  });
  it('the Moon stays a plain disc: no face, no halo', () => {
    const src = read('entrypoints/newtab/layers/scene/Moon.tsx');
    expect(src).not.toMatch(/\b(eye|mouth|nose|halo\w*\s*[=:(])/i);
  });
});
