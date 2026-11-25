import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { THEME_IDS, themeById, type ThemeId } from '../lib/themes';

const css = readFileSync(
  fileURLToPath(new URL('../entrypoints/newtab/styles/tokens.css', import.meta.url)),
  'utf8',
);

function token(name: string): string {
  const m = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`));
  if (!m) throw new Error(`Solid colour token --${name} not found`);
  return m[1]!;
}

import { contrast } from './helpers/contrast';
export { contrast };
const MIN = 4.5;
const backgrounds = ['sky-top', 'sky-bottom', 'card-top', 'card-bottom', 'panel-solid', 'button-top', 'button-bottom'];

describe('colour contrast of The Crypt tokens', () => {
  it('measures contrast correctly', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(contrast('#777777', '#777777')).toBeCloseTo(1, 5);
  });

  describe.each(['ink', 'ink-dim'])('%s text', (text) => {
    it.each(backgrounds)(`is readable on %s`, (bg) => {
      expect(contrast(token(text), token(bg))).toBeGreaterThanOrEqual(MIN);
    });
  });

  describe.each(['state-awake', 'state-starving', 'state-asleep', 'state-protected'])('%s', (state) => {
    it.each(['card-top', 'card-bottom'])('is readable on %s', (bg) => {
      expect(contrast(token(state), token(bg))).toBeGreaterThanOrEqual(MIN);
    });
  });

  it('has four distinct state colours', () => {
    const colours = ['state-awake', 'state-starving', 'state-asleep', 'state-protected'].map(token);
    expect(new Set(colours).size).toBe(4);
  });

  it('has readable dark text on the letter badges', () => {
    for (let i = 1; i <= 6; i++) {
      expect(contrast(token('badge-ink'), token(`badge-${i}`))).toBeGreaterThanOrEqual(MIN);
    }
  });

  it('has readable light text on both ends of the Dawn button', () => {
    expect(contrast(token('ink'), token('dawn-top'))).toBeGreaterThanOrEqual(MIN);
    expect(contrast(token('ink'), token('dawn-bottom'))).toBeGreaterThanOrEqual(MIN);
  });
});

// ---------- every theme (Properties 5 and 6) ----------
function blockOf(id: ThemeId): string {
  const m = css.match(new RegExp(`:root\\[data-theme='${id}'\\]\\s*\\{([\\s\\S]*?)\\n\\}`));
  if (!m) throw new Error(`block ${id} not found`);
  return m[1]!;
}
function tokenIn(id: ThemeId, name: string): string {
  const m = blockOf(id).match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`));
  if (!m) throw new Error(`Solid colour token --${name} not found in ${id}`);
  return m[1]!;
}
function hue(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}
const hueGap = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
const STATES = ['state-awake', 'state-starving', 'state-asleep', 'state-protected'] as const;

describe.each(THEME_IDS)('Feature: themes, Property 5: readable text and state colours in %s', (id) => {
  it('ink and ink-dim are readable on the seven backgrounds, states on both card colours, badge ink on badges', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('ink', 'ink-dim'),
        fc.constantFrom(...backgrounds),
        fc.constantFrom(...STATES),
        fc.constantFrom('card-top', 'card-bottom'),
        fc.integer({ min: 1, max: 6 }),
        (text, bg, state, card, badge) => {
          expect(contrast(tokenIn(id, text), tokenIn(id, bg)), `${text} on ${bg}`).toBeGreaterThanOrEqual(MIN);
          expect(contrast(tokenIn(id, state), tokenIn(id, card)), `${state} on ${card}`).toBeGreaterThanOrEqual(MIN);
          expect(contrast(tokenIn(id, 'badge-ink'), tokenIn(id, `badge-${badge}`))).toBeGreaterThanOrEqual(MIN);
        },
      ),
      { numRuns: 100 },
    );
  });
  it('reads every combination, not only the sampled ones', () => {
    for (const text of ['ink', 'ink-dim']) for (const bg of backgrounds) expect(contrast(tokenIn(id, text), tokenIn(id, bg)), `${text} on ${bg}`).toBeGreaterThanOrEqual(MIN);
    for (const s of STATES) for (const c of ['card-top', 'card-bottom']) expect(contrast(tokenIn(id, s), tokenIn(id, c)), `${s} on ${c}`).toBeGreaterThanOrEqual(MIN);
    for (let i = 1; i <= 6; i++) expect(contrast(tokenIn(id, 'badge-ink'), tokenIn(id, `badge-${i}`))).toBeGreaterThanOrEqual(MIN);
  });
  it('has readable light text on both ends of the Dawn button', () => {
    expect(contrast(tokenIn(id, 'ink'), tokenIn(id, 'dawn-top'))).toBeGreaterThanOrEqual(MIN);
    expect(contrast(tokenIn(id, 'ink'), tokenIn(id, 'dawn-bottom'))).toBeGreaterThanOrEqual(MIN);
  });
});

describe('Feature: themes, Property 6: state colours keep their meaning', () => {
  it('the four state colours are distinct and each hue is within 30 degrees of the Crypt hue', () => {
    fc.assert(
      fc.property(fc.constantFrom(...THEME_IDS), fc.constantFrom(...STATES), (id, state) => {
        const own = tokenIn(id, state);
        const crypt = tokenIn('crypt', state);
        expect(hueGap(hue(own), hue(crypt)), `${id} ${state}`).toBeLessThanOrEqual(30);
        const four = STATES.map((s) => tokenIn(id, s));
        expect(new Set(four).size).toBe(4);
      }),
      { numRuns: 100 },
    );
  });
  it('the surface data in lib/themes.ts agrees with tokens.css for the state colours', () => {
    for (const id of THEME_IDS) for (const s of STATES) expect(themeById(id).surface[`--${s}`]).toBe(tokenIn(id, s));
  });
});
