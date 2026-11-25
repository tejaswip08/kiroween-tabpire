// The stats panel, search box, pinned pages and state chips sit over the 3D scene. Their fill is the theme's dark panel
// colour at 82% or more, with a thin border, so the text passes WCAG AA (4.5:1) even over a white patch of the scene.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ENABLED_THEME_IDS } from '../lib/themes';
import { contrast } from './helpers/contrast';

const tokens = readFileSync('entrypoints/newtab/styles/tokens.css', 'utf8');
const block = (id: string) => {
  const start = tokens.indexOf(`:root[data-theme='${id}']`);
  return tokens.slice(start, tokens.indexOf('}', start));
};
const solid = (b: string, n: string) => b.match(new RegExp(`--${n}:\\s*(#[0-9a-fA-F]{6});`))![1]!;
const rgba = (b: string, n: string) => b.match(new RegExp(`--${n}:\\s*rgba\\(([^)]*)\\);`))![1]!.split(',').map(Number) as [number, number, number, number];
const hex = (c: number[]) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
/** A translucent fill over a backdrop. */
const over = ([r, g, b, a]: [number, number, number, number], back: number[]) => hex([r, g, b].map((c, i) => a * c + (1 - a) * back[i]!));
const BACKDROPS = { white: [255, 255, 255], 'warm light': [255, 214, 140], 'grey mist': [170, 180, 190] };

describe.each(ENABLED_THEME_IDS)('readable panels in %s', (id) => {
  const b = block(id);
  it('uses at least 70% opacity for the panel fill', () => {
    for (const n of ['panel-fill-top', 'panel-fill-bottom']) expect(rgba(b, n)[3]).toBeGreaterThanOrEqual(0.7);
  });
  it.each(Object.entries(BACKDROPS))('text passes AA over %s', (_, back) => {
    for (const n of ['panel-fill-top', 'panel-fill-bottom']) {
      const bg = over(rgba(b, n), back);
      expect(contrast(solid(b, 'ink'), bg), `${n} ink`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(solid(b, 'ink-dim'), bg), `${n} ink-dim`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('the panels use that fill and a thin border', () => {
  const css = (f: string) => readFileSync(`entrypoints/newtab/styles/${f}`, 'utf8');
  const rule = (sheet: string, sel: string) => {
    const s = css(sheet);
    const i = s.indexOf(`${sel} {`);
    return s.slice(i, s.indexOf('}', i));
  };
  it.each([
    ['header.css', '.stats-panel'],
    ['search.css', '.search-field'],
    ['cards.css', '.legend-chip'],
    ['haunts.css', '.add-page-btn'],
  ])('%s %s', (sheet, sel) => {
    const r = rule(sheet, sel);
    expect(r).toMatch(/var\(--panel-fill-top\), var\(--panel-fill-bottom\)/);
    expect(r).toMatch(/border: 1px (solid|dashed)/);
  });
  it('the pinned page tiles have a solid fill and an edge', () => {
    const r = rule('haunts.css', '.haunts-tile');
    expect(r).toMatch(/var\(--button-top\), var\(--button-bottom\)/);
    expect(r).toMatch(/0 0 0 1px var\(--card-edge\) inset/);
  });
});
