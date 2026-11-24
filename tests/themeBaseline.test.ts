// Feature: themes. The Crypt must stay exactly as it was before the themes work.
// Compares today's code with tests/fixtures/crypt-baseline.json, recorded before any change.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { C } from '../entrypoints/newtab/layers/scene/colors';
import { buildLayout, layout } from '../lib/scene/layout';
import { themeScene } from '../lib/scene/themeLayout';
import fc from 'fast-check';
import { ACCENT, COLD, CRYPT_EXTRA, CRYPT_SHADER, WARM } from '../lib/scene/palette';
import { SURFACE_TOKENS, themeById } from '../lib/themes';
import baseline from './fixtures/crypt-baseline.json';

const tokensCss = readFileSync(resolve(__dirname, '../entrypoints/newtab/styles/tokens.css'), 'utf8');

function cryptBlock(): Record<string, string> {
  const block = tokensCss.match(/:root\[data-theme='crypt'\]\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/^\s*--([a-z0-9-]+):\s*([\s\S]*?);\s*$/gm)) out[m[1]!] = m[2]!.replace(/\s+/g, ' ').trim();
  return out;
}

describe('Crypt baseline', () => {
  it('COLD, WARM and ACCENT equal the fixture', () => {
    expect(COLD).toEqual(baseline.COLD);
    expect(WARM).toEqual(baseline.WARM);
    expect(ACCENT).toEqual(baseline.ACCENT);
  });

  it('the scene colour set C equals the fixture', () => {
    const now: Record<string, string> = {};
    for (const [k, v] of Object.entries(C)) now[k] = '#' + v.getHexString();
    expect(now).toEqual(baseline.C);
  });

  it('the crypt block of tokens.css holds every recorded name with the recorded value', () => {
    const now = cryptBlock();
    const names = Object.keys(baseline.tokens);
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      expect(now[name], `--${name}`).toBe((baseline.tokens as Record<string, string>)[name]);
    }
  });

  it('the crypt block holds the three new tokens with the old literals, 44 names in all', () => {
    const now = cryptBlock();
    expect(now['shade']).toBe('rgba(10, 4, 16, 0.6)');
    expect(now['popup-fill']).toBe('rgba(12, 7, 20, 0.96)');
    expect(now['quote-ink']).toBe('#ffb3c4');
    expect(Object.keys(now)).toHaveLength(44);
  });
  it('buildLayout() deep-equals the recorded layout', () => {
    expect(JSON.parse(JSON.stringify(buildLayout()))).toEqual(baseline.layout);
  });
  it('CRYPT_EXTRA and CRYPT_SHADER equal the fixture', () => {
    const b = baseline as unknown as {
      C: Record<string, string>;
      shader: Record<string, number[]>;
      components: Record<string, string>;
    };
    expect({ ...CRYPT_EXTRA }).toEqual({
      skyMid: b.C.mid,
      skyHorizon: b.C.horizon,
      haze: b.C.haze,
      mushroom: b.C.mushroom,
      cauldron: b.C.cauldron,
      wisp: b.C.wisp,
      ghost: b.C.ghost,
      lowCloud: b.components.lowCloud,
      farSilhouette: b.components.farSilhouette,
      groundBase: b.components.groundBase,
      groundTint: b.components.groundTint,
    });
    expect(JSON.parse(JSON.stringify(CRYPT_SHADER))).toEqual(b.shader);
  });

  it('Feature: themes, Property 9: The Crypt does not change (palette and surface)', () => {
    // Validates: Requirements 2.1, 2.2, 2.4, 2.5, 8.3, 16.4
    const b = baseline as unknown as {
      COLD: Record<string, string>;
      WARM: Record<string, string>;
      ACCENT: Record<string, string>;
      C: Record<string, string>;
      shader: Record<string, number[]>;
      components: Record<string, string>;
      tokens: Record<string, string>;
    };
    const expectedScene = {
      skyTop: b.COLD.skyTop,
      skyMid: b.C.mid,
      skyHorizon: b.C.horizon,
      haze: b.C.haze,
      fog: b.COLD.fog,
      farSilhouette: b.components.farSilhouette,
      groundBase: b.components.groundBase,
      groundTint: b.components.groundTint,
      hemiSky: b.COLD.hemisphereSky,
      hemiGround: b.COLD.hemisphereGround,
      rim: b.COLD.rim,
      moonlight: b.ACCENT.moonlight,
      moon: b.ACCENT.moon,
      ...b.shader,
      lowCloud: b.components.lowCloud,
      ghost: b.C.ghost,
      ember: b.WARM.ember,
      candle: b.WARM.candle,
      lantern: b.WARM.lantern,
      jack: b.WARM.jackOLantern,
      door: b.WARM.cryptDoor,
      mushroom: b.C.mushroom,
      cauldron: b.C.cauldron,
      wisp: b.C.wisp,
      weatherA: b.WARM.ember,
      weatherB: b.WARM.ember,
    };
    fc.assert(
      fc.property(fc.constantFrom('crypt', 'not-a-theme', ''), (id) => {
        const t = themeById(id);
        expect(JSON.parse(JSON.stringify(t.scene))).toEqual(expectedScene);
        for (const name of Object.keys(b.tokens)) {
          expect(t.surface[`--${name}` as keyof typeof t.surface], `--${name}`).toBe(b.tokens[name]);
        }
        expect(Object.keys(b.tokens).every((n) => (SURFACE_TOKENS as readonly string[]).includes(n))).toBe(true);
        expect(t.surface['--shade']).toBe('rgba(10, 4, 16, 0.6)');
        expect(t.surface['--popup-fill']).toBe('rgba(12, 7, 20, 0.96)');
        expect(t.surface['--quote-ink']).toBe('#ffb3c4');
      }),
      { numRuns: 100 },
    );
  });
  it("themeScene('crypt').layout deep-equals the recorded layout and is the layout() object (Property 9, layout part)", () => {
    expect(themeScene('crypt').layout).toBe(layout());
    expect(JSON.parse(JSON.stringify(themeScene('crypt').layout))).toEqual(baseline.layout);
    expect(themeScene('crypt').anchors).toEqual([]);
    expect(themeScene('crypt').weather).toBeNull();
  });
});
