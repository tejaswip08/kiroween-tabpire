import fc from 'fast-check';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ENABLED_THEME_IDS, isThemeId } from '../lib/themes';
import {
  SKY_CACHE_KEY,
  applyCachedTheme,
  clearCachedTheme,
  readCachedTheme,
  writeCachedTheme,
} from '../lib/themeCache';

const memory = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? (m.get(k) as string) : null),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
  };
};
const root = () => ({ dataset: {} as Record<string, string> }) as unknown as HTMLElement;

afterEach(() => vi.unstubAllGlobals());

describe('Sky_Cache', () => {
  it('uses the key tabpire:sky-theme', () => {
    expect(SKY_CACHE_KEY).toBe('tabpire:sky-theme');
  });

  it('Feature: themes, Property 4: round trip for every id', () => {
    vi.stubGlobal('localStorage', memory());
    fc.assert(
      fc.property(fc.constantFrom(...ENABLED_THEME_IDS), (id) => {
        writeCachedTheme(id);
        expect(readCachedTheme()).toBe(id);
        const r = root();
        expect(applyCachedTheme(r)).toBe(id);
        expect(r.dataset.theme).toBe(id);
        clearCachedTheme();
        expect(readCachedTheme()).toBeNull();
      }),
      { numRuns: 100 },
    );
  });

  it('Feature: themes, Property 4: any stored string reads as a ThemeId or null', () => {
    const ls = memory();
    vi.stubGlobal('localStorage', ls);
    fc.assert(
      fc.property(fc.oneof(fc.string(), fc.constantFrom(...ENABLED_THEME_IDS)), (s) => {
        ls.setItem(SKY_CACHE_KEY, s);
        const got = readCachedTheme();
        expect(got === null || isThemeId(got)).toBe(true);
        expect(got === null).toBe(!isThemeId(s));
        const r = root();
        applyCachedTheme(r);
        expect(isThemeId(r.dataset.theme)).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  it('Feature: themes, Property 4: a throwing localStorage never throws and gives crypt', () => {
    const boom = () => {
      throw new Error('blocked');
    };
    vi.stubGlobal('localStorage', { getItem: boom, setItem: boom, removeItem: boom });
    fc.assert(
      fc.property(fc.constantFrom(...ENABLED_THEME_IDS), (id) => {
        expect(() => writeCachedTheme(id)).not.toThrow();
        expect(() => clearCachedTheme()).not.toThrow();
        expect(readCachedTheme()).toBeNull();
        const r = root();
        expect(applyCachedTheme(r)).toBe('crypt');
        expect(r.dataset.theme).toBe('crypt');
      }),
      { numRuns: 100 },
    );
  });

  it('does not throw when localStorage is missing', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(readCachedTheme()).toBeNull();
    expect(() => writeCachedTheme('frost')).not.toThrow();
    expect(applyCachedTheme(root())).toBe('crypt');
  });

  it('importing the module makes no storage call', async () => {
    const calls: string[] = [];
    const spy = (n: string) => () => {
      calls.push(n);
      return null;
    };
    vi.stubGlobal('localStorage', { getItem: spy('get'), setItem: spy('set'), removeItem: spy('remove') });
    vi.resetModules();
    await import('../lib/themeCache');
    expect(calls).toEqual([]);
  });
});
