// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import fc from 'fast-check';
import { afterEach, describe, expect, it, vi } from 'vitest';
const fetchGoogle = vi.hoisted(() => vi.fn(async () => ['remote one']));
vi.mock('../../lib/google', () => ({ fetchGoogleSuggestions: fetchGoogle }));
import { faviconSources } from '../../entrypoints/newtab/Haunts';
import { WEB_DEBOUNCE_MS, useSuggestions } from '../../entrypoints/newtab/hooks/useSuggestions';
import { capabilities } from '../../lib/capabilities';
import { localSuggestions } from '../../lib/suggest';

const sources = {
  tabs: [{ id: 1, windowId: 1, title: 'Cat videos', url: 'https://video.example/cats', active: false, audible: false, discarded: false, pinned: false }],
  haunts: [{ url: 'https://catpics.example/', title: 'Cat pics' }],
  crypt: [{ id: 'c1', url: 'https://old.example/cat', title: 'Old cat story', savedAt: 1 }],
};

afterEach(() => {
  capabilities.remoteSuggestions = true;
  capabilities.remoteIcons = true;
  fetchGoogle.mockClear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Property 11: No remote suggestions', () => {
  it('asks no one and shows only local rows and the web-search row', async () => {
    vi.useFakeTimers();
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    capabilities.remoteSuggestions = false;
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 2, maxLength: 12 }).filter((s) => s.trim().length >= 2), async (q) => {
        const { result, unmount } = renderHook(() => useSuggestions(q, sources));
        await act(async () => {
          await vi.advanceTimersByTimeAsync(WEB_DEBOUNCE_MS * 3);
        });
        const rows = result.current;
        unmount();
        expect(fetchGoogle).not.toHaveBeenCalled();
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(rows).toEqual(localSuggestions(q, sources));
      }),
      { numRuns: 100 },
    );
  });
  it('with the default flag, web suggestions are still fetched', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useSuggestions('cat', sources));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(WEB_DEBOUNCE_MS + 10);
    });
    expect(fetchGoogle).toHaveBeenCalledTimes(1);
    expect(result.current.some((s) => s.kind === 'search' && s.text === 'remote one')).toBe(true);
  });
});

describe('Property 12: No remote icons', () => {
  const pageUrl = fc.webUrl();
  const tabIcon = fc.option(
    fc.oneof(fc.webUrl(), fc.constant('data:image/png;base64,AAAA'), fc.constant('chrome://favicon/x'), fc.string()),
    { nil: undefined },
  );
  it('returns nothing or only the given tab icon', () => {
    capabilities.remoteIcons = false;
    fc.assert(
      fc.property(pageUrl, tabIcon, (url, icon) => {
        const list = faviconSources(url, { tabIcon: icon, chromeBase: 'chrome-extension://abc/_favicon/' });
        expect(list.length).toBeLessThanOrEqual(1);
        for (const item of list) expect(item).toBe(icon);
        for (const item of list) if (/^https?:/i.test(item)) expect(item).toBe(icon);
      }),
      { numRuns: 100 },
    );
  });
  it('with the default flag, the chrome, origin and duckduckgo sources are still listed', () => {
    const list = faviconSources('https://a.example/x', { tabIcon: 'data:image/png;base64,AA', chromeBase: 'chrome-extension://abc/_favicon/' });
    expect(list).toHaveLength(4);
    expect(list[2]).toBe('https://a.example/favicon.ico');
    expect(list[3]).toContain('icons.duckduckgo.com');
  });
});

describe('capability defaults', () => {
  it('are both true', () => {
    expect(capabilities).toEqual({ remoteSuggestions: true, remoteIcons: true });
  });
});
