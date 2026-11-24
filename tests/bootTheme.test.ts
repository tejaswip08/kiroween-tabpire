import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SKY_CACHE_KEY } from '../lib/themeCache';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const firstImport = (src: string) => /^\s*import\s+(?:[^'"]*from\s+)?['"]([^'"]+)['"]/m.exec(src)?.[1];

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

async function boot(storage: unknown, doc: { dataset: Record<string, string> }) {
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('document', { documentElement: doc });
  vi.resetModules();
  await import('../entrypoints/newtab/bootTheme');
}

describe('bootTheme import order', () => {
  it('is the first import of the new tab main', () => {
    expect(firstImport(read('entrypoints/newtab/main.tsx'))).toBe('./bootTheme');
  });
  it('is the first import of the Blood Bank main', () => {
    expect(firstImport(read('entrypoints/bloodbank/main.tsx'))).toBe('../newtab/bootTheme');
  });
  it('is the first import of the demo main', () => {
    expect(firstImport(read('demo/src/main.tsx'))).toBe('../../entrypoints/newtab/bootTheme');
  });
});

describe('bootTheme', () => {
  it('sets data-theme to a cached frost before React mounts', async () => {
    const doc = { dataset: {} as Record<string, string> };
    await boot({ getItem: (k: string) => (k === SKY_CACHE_KEY ? 'frost' : null) }, doc);
    expect(doc.dataset.theme).toBe('frost');
  });
  it.each([
    ['missing', () => null],
    ['unknown', () => 'nope'],
    ['unreadable', () => { throw new Error('blocked'); }],
  ])('gives crypt for a %s cache and does not throw', async (_n, get) => {
    const doc = { dataset: {} as Record<string, string> };
    await expect(boot({ getItem: get }, doc)).resolves.toBeUndefined();
    expect(doc.dataset.theme).toBe('crypt');
  });
});

describe('canvas fade CSS', () => {
  const layers = read('entrypoints/newtab/styles/layers.css');
  const base = read('entrypoints/newtab/styles/base.css');
  it('fades with opacity only', () => {
    const rule = /\.scene-canvas\s*\{([^}]*)\}/.exec(layers)?.[1] ?? '';
    expect(rule).toMatch(/transition:\s*opacity\b/);
    expect((/transition:[^;]*/.exec(rule)?.[0] ?? '')).not.toMatch(/,|all|transform/);
    expect(layers).toMatch(/\.scene-canvas\[data-ready='true'\]\s*\{\s*opacity:\s*1;\s*\}/);
  });
  it('has no transition under prefers-reduced-motion', () => {
    const m = /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/.exec(base)?.[1] ?? '';
    expect(m).toMatch(/\*,/);
    expect(m).toMatch(/transition:\s*none\s*!important/);
  });
});
