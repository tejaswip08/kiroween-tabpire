// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import fc from 'fast-check';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveRoute, useRoute } from '../../demo/src/route';

afterEach(() => window.history.replaceState(null, '', '/'));

describe('resolveRoute', () => {
  // Feature: web-demo, Property 1: Route resolution
  // **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
  it('resolves the three exact hashes, with an optional trailing slash, and nothing else', () => {
    const exact: Record<string, string> = {
      '#/crypt': 'crypt',
      '#/bloodbank': 'bloodbank',
      '#/popup': 'popup',
    };
    fc.assert(
      fc.property(fc.constantFrom(...Object.keys(exact)), fc.boolean(), (hash, slash) => {
        expect(resolveRoute(slash ? `${hash}/` : hash)).toBe(exact[hash]);
      }),
      { numRuns: 100 },
    );
    fc.assert(
      fc.property(fc.string(), (s) => {
        const valid = ['#/crypt', '#/bloodbank', '#/popup'].some((h) => s === h || s === `${h}/`);
        if (!valid) expect(resolveRoute(s)).toBeNull();
      }),
      { numRuns: 100 },
    );
    fc.assert(
      fc.property(
        fc.constantFrom('#/crypt', '#/bloodbank', '#/popup'),
        fc.string({ minLength: 1 }),
        (hash, extra) => {
          fc.pre(extra !== '/');
          expect(resolveRoute(hash + extra)).toBeNull();
          expect(resolveRoute(hash.toUpperCase())).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('returns null for empty and bare hashes', () => {
    for (const h of ['', '#', '#/', '#/unknown', '#/crypt//']) expect(resolveRoute(h)).toBeNull();
  });
});

describe('useRoute', () => {
  it('replaces an unknown hash with #/crypt without adding history', () => {
    window.history.replaceState(null, '', '/#/nowhere');
    const before = window.history.length;
    const { result } = renderHook(() => useRoute());
    expect(result.current).toBe('crypt');
    expect(window.location.hash).toBe('#/crypt');
    expect(window.history.length).toBe(before);
  });

  it('replaces an empty hash with #/crypt', () => {
    renderHook(() => useRoute());
    expect(window.location.hash).toBe('#/crypt');
  });

  it('follows hashchange events', async () => {
    window.history.replaceState(null, '', '/#/crypt');
    const { result } = renderHook(() => useRoute());
    await act(async () => {
      window.location.hash = '#/bloodbank';
      await new Promise((r) => setTimeout(r, 20)); // jsdom fires hashchange asynchronously
    });
    expect(result.current).toBe('bloodbank');
  });
});
