// Task 18, Property 17: the vampire halo stays on the Crypt values in every theme (Req 8.1, 16.14).
import fc from 'fast-check';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HALO_COLORS } from '../entrypoints/newtab/layers/portraits/GlowHalo';
import { nicheTint, STATE_COLOR } from '../entrypoints/newtab/layers/portraits/Niche';
import { sceneColorsFor, C } from '../entrypoints/newtab/layers/scene/colors';
import { THEME_IDS, themeById } from '../lib/themes';
import baseline from './fixtures/crypt-baseline.json';

const STATES = ['awake', 'starving', 'asleep', 'protected'] as const;

describe('Property 17: halo colours', () => {
  it('HALO_COLORS equal the Crypt baseline, whatever the theme', () => {
    fc.assert(
      fc.property(fc.constantFrom(...THEME_IDS), (id) => {
        themeById(id); // the theme exists, but must not influence the halo
        expect([...HALO_COLORS.starving.color]).toEqual(baseline.halo.starving);
        expect([...HALO_COLORS.dawn.color]).toEqual(baseline.halo.dawn.color);
        expect(HALO_COLORS.dawn.scale).toBe(baseline.halo.dawn.scale);
        expect([...HALO_COLORS.whiteHot.color]).toEqual(baseline.halo.whiteHot.color);
        expect(HALO_COLORS.whiteHot.scale).toBe(baseline.halo.whiteHot.scale);
      }),
    );
  });
  it('GlowHalo.tsx does not read the theme', () => {
    const src = readFileSync('entrypoints/newtab/layers/portraits/GlowHalo.tsx', 'utf8');
    expect(src).not.toMatch(/lib\/themes|themeColors|useSceneTheme|SceneThemeContext|themeById/);
  });
});

describe('niche tint and portrait lights', () => {
  it('the Crypt niche tints equal the old values', () => {
    expect(STATE_COLOR).toEqual({ awake: '#b9a5ff', starving: '#ff6b6b', asleep: '#6fb7e8', protected: '#f4d58a' });
    for (const s of STATES) expect(nicheTint('crypt', s)).toBe(STATE_COLOR[s]);
  });
  it('every theme gives a niche tint equal to its state colour', () => {
    for (const id of THEME_IDS) for (const s of STATES) expect(nicheTint(id, s)).toBe(themeById(id).surface[`--state-${s}`]);
  });
  it('at least one other theme tints a state differently from the Crypt', () => {
    const differs = THEME_IDS.some((id) => id !== 'crypt' && STATES.some((s) => nicheTint(id, s) !== nicheTint('crypt', s)));
    expect(differs).toBe(true);
  });
  it('the Crypt light colours equal the scene constants and other themes differ', () => {
    const k = sceneColorsFor('crypt');
    for (const key of ['hemiSky', 'hemiGround', 'candle', 'rim'] as const) expect(k[key].getHex()).toBe(C[key].getHex());
    const other = THEME_IDS.filter((id) => id !== 'crypt').some((id) => {
      const o = sceneColorsFor(id);
      return (['hemiSky', 'hemiGround', 'candle', 'rim'] as const).some((key) => o[key].getHex() !== k[key].getHex());
    });
    expect(other).toBe(true);
  });
});
