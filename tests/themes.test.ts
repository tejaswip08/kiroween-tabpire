// Feature: themes. Theme data is complete, total and keeps its meaning.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME, SURFACE_TOKENS, THEME_IDS, THEMES, isThemeId, themeById, type ScenePalette } from '../lib/themes';
import { WARM_HUE_RANGE, hueOf } from '../lib/scene/palette';

const HEX = /^#[0-9a-f]{6}$/;
const SCENE_KEYS = Object.keys(themeById('crypt').scene) as (keyof ScenePalette)[];
const SOLID = /^#[0-9a-f]{6}$/;
const isLinear3 = (v: unknown) =>
  Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === 'number' && n >= 0 && n <= 1);

describe('themes', () => {
  it('has the six themes in order with the right names', () => {
    expect(THEME_IDS).toEqual(['crypt', 'pumpkin', 'forest', 'frost', 'bloodmoon', 'castle']);
    expect(THEMES.map((t) => t.id)).toEqual([...THEME_IDS]);
    expect(THEMES.map((t) => t.name)).toEqual([
      'The Crypt',
      'Pumpkin Patch',
      "Witch's Forest",
      'Frozen Cemetery',
      'Blood Moon',
      'Haunted Castle',
    ]);
  });
  it('defaults to the Crypt', () => {
    expect(DEFAULT_THEME).toBe('crypt');
    expect(THEMES[0]!.id).toBe(DEFAULT_THEME);
  });
  it('gives each theme a one-line description', () => {
    for (const t of THEMES) {
      expect(t.description.length, t.id).toBeGreaterThan(0);
      expect(t.description, t.id).not.toMatch(/\n/);
    }
  });
  it('lib/themes.ts imports no three, wxt/browser or browser API', () => {
    const src = readFileSync(resolve(__dirname, '../lib/themes.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    expect(src).not.toMatch(/from\s+['"](three|wxt\/browser)/);
    expect(src).not.toMatch(/\b(browser|chrome|window|document|localStorage)\./);
  });
  it('has 44 surface tokens', () => {
    expect(SURFACE_TOKENS.length).toBe(44);
  });

  it('Feature: themes, Property 1: Theme lookup is total', () => {
    // Validates: Requirements 1.4, 1.9, 16.2
    fc.assert(
      fc.property(fc.oneof(fc.string(), fc.constantFrom(...THEME_IDS), fc.constantFrom('', '__proto__', 'constructor', 'Crypt', 'nope')), (s) => {
        const t = themeById(s);
        expect(t).toBeDefined();
        if (isThemeId(s)) expect(t.id).toBe(s);
        else expect(t.id).toBe('crypt');
      }),
      { numRuns: 200 },
    );
  });

  it('Feature: themes, Property 2: Every theme is complete', () => {
    // Validates: Requirements 1.5, 1.6, 7.5, 16.1
    fc.assert(
      fc.property(fc.constantFrom(...THEME_IDS), (id) => {
        const t = themeById(id);
        for (const key of SCENE_KEYS) {
          const v = t.scene[key] as unknown;
          expect(typeof v === 'string' ? HEX.test(v) : isLinear3(v), `${id}.${key}`).toBe(true);
        }
        expect(Object.keys(t.scene).sort()).toEqual([...SCENE_KEYS].sort());
        for (const name of SURFACE_TOKENS) {
          const v = t.surface[`--${name}`];
          expect(typeof v === 'string' && v.length > 0, `${id} --${name}`).toBe(true);
        }
        for (const name of ['panel-solid', 'card-top', 'card-bottom', 'sky-top', 'sky-bottom', 'button-top', 'button-bottom', 'ink', 'ink-dim', 'state-awake', 'state-starving', 'state-asleep', 'state-protected', 'badge-ink'] as const) {
          expect(SOLID.test(t.surface[`--${name}`]), `${id} --${name}`).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('Feature: themes, Property 8: Warm lights stay warm and themes stay apart', () => {
    // Validates: Requirements 8.3, 8.4, 8.5
    fc.assert(
      fc.property(fc.constantFrom(...THEME_IDS), fc.constantFrom(...THEME_IDS), (a, b) => {
        const s = themeById(a).scene;
        for (const key of ['candle', 'lantern', 'jack', 'door', 'ember'] as const) {
          const h = hueOf(s[key]);
          expect(h, `${a}.${key}`).toBeGreaterThanOrEqual(WARM_HUE_RANGE[0]);
          expect(h, `${a}.${key}`).toBeLessThanOrEqual(WARM_HUE_RANGE[1]);
        }
        if (a !== b) {
          const o = themeById(b).scene;
          expect(s.skyTop === o.skyTop && s.fog === o.fog && s.moon === o.moon, `${a} vs ${b}`).toBe(false);
        }
        for (const id of ['crypt', 'bloodmoon'] as const) {
          const h = hueOf(themeById(id).scene.moon);
          expect(h > 340 || h < 10, id).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });
});
