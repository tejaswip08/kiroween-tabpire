import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const css = readFileSync(
  fileURLToPath(new URL('../entrypoints/newtab/styles/tokens.css', import.meta.url)),
  'utf8',
);

function token(name: string): string {
  const m = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`));
  if (!m) throw new Error(`Solid colour token --${name} not found`);
  return m[1]!;
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [
    number,
    number,
    number,
  ];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

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
