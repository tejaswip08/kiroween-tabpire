// tools/check-css-animations.mjs (used by the css-animation-check hook): it passes on the real stylesheets and catches a bad keyframe.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error: a plain .mjs tool without types
import { badProperties, keyframeBlocks } from '../tools/check-css-animations.mjs';

describe('CSS animation check', () => {
  it('finds the keyframes and the properties they set', () => {
    const css = `/* a { b } */ .x { color: red; }
@keyframes ok { from { opacity: 0; transform: scale(0.9); } 50% { animation-timing-function: ease; } to { opacity: 1; } }
@keyframes bad { from { top: 0; } to { top: 10px; background-color: red; } }`;
    const blocks = keyframeBlocks(css) as { name: string; body: string }[];
    expect(blocks.map((b) => b.name)).toEqual(['ok', 'bad']);
    expect(badProperties(blocks[0]!.body)).toEqual([]);
    expect(badProperties(blocks[1]!.body)).toEqual(['top', 'background-color']);
  });
  it('passes on the project stylesheets', () => {
    const out = execFileSync('node', ['tools/check-css-animations.mjs'], { encoding: 'utf8' });
    expect(out).toMatch(/CSS animations OK/);
  });
  it('fails on a stylesheet that animates width', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'tabpire-css-')), 'bad.css');
    writeFileSync(file, '@keyframes grow { from { width: 0; } to { width: 10px; } }');
    expect(() => execFileSync('node', ['tools/check-css-animations.mjs', file], { encoding: 'utf8', stdio: 'pipe' })).toThrow(/animates "width"/);
  });
});
