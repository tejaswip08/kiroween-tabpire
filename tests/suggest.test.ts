import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { KIND_LABEL, localSuggestions, parseGoogleResponse, withWeb } from '../lib/suggest';
import type { RawTab } from '../lib/view';

const tab = (id: number, title: string, url: string): RawTab => ({
  id,
  windowId: 7,
  title,
  url,
  active: false,
  audible: false,
  discarded: false,
  pinned: false,
});

const src = {
  tabs: [
    tab(1, 'Cat videos', 'https://video.example/cats'),
    tab(2, 'Recipes', 'https://food.example/cat-food'),
    tab(3, 'Cats and dogs', 'https://pets.example/'),
    tab(4, 'Weather', 'https://weather.example/'),
    tab(5, 'Catalog', 'https://shop.example/'),
    tab(6, 'Another cat', 'https://a.example/'),
  ],
  pinned: [{ url: 'https://catpics.example/', title: 'Cat pics' }],
  crypt: [{ id: 'c1', url: 'https://old.example/cat', title: 'Old cat story', savedAt: 1 }],
};

describe('localSuggestions', () => {
  it('is empty for blank queries', () => {
    expect(localSuggestions('', src)).toEqual([]);
    expect(localSuggestions('   ', src)).toEqual([]);
  });

  it('puts tabs, then pinned pages, then crypt items', () => {
    const kinds = localSuggestions('cat', src).map((s) => s.kind);
    expect(kinds).toEqual(['tab', 'tab', 'tab', 'pinned', 'crypt']);
  });

  it('keeps at most three per group and ranks title matches first', () => {
    const tabs = localSuggestions('cat', src).filter((s) => s.kind === 'tab');
    expect(tabs).toHaveLength(3);
    // Titles starting with "cat" come before titles that only contain it or match the address.
    expect(tabs.map((s) => s.tabId)).toEqual([1, 3, 5]);
  });

  it('ignores case and requires every word', () => {
    expect(localSuggestions('CAT DOGS', src).map((s) => s.tabId)).toEqual([3]);
    expect(localSuggestions('cat zebra', src)).toEqual([]);
  });

  it('matches on the address as well as the title', () => {
    expect(localSuggestions('weather.example', src).map((s) => s.tabId)).toEqual([4]);
  });

  it('carries what is needed to act on each suggestion', () => {
    const all = localSuggestions('cat', src);
    expect(all.find((s) => s.kind === 'tab')).toMatchObject({ tabId: 1, windowId: 7, label: 'Cat videos' });
    expect(all.find((s) => s.kind === 'pinned')).toMatchObject({ url: 'https://catpics.example/' });
    expect(all.find((s) => s.kind === 'crypt')).toMatchObject({ cryptId: 'c1', url: 'https://old.example/cat' });
  });

  it('never returns more than 9 and never throws', () => {
    fc.assert(
      fc.property(fc.string(), (q) => {
        expect(localSuggestions(q, src).length).toBeLessThanOrEqual(9);
      }),
    );
  });

  it('has a plain label for every kind', () => {
    expect(KIND_LABEL).toEqual({ tab: 'Open tab', pinned: 'Pinned page', crypt: 'Crypt', search: 'Search' });
  });
});

describe('withWeb', () => {
  it('appends at most five distinct web suggestions after the local ones', () => {
    const local = localSuggestions('cat', src);
    const merged = withWeb(local, ['cat', 'Cats', 'cats', 'cat food', ' ', 'cat toys', 'cat names', 'cat breeds', 'cat age'], 'cat');
    expect(merged.slice(0, local.length)).toEqual(local);
    const web = merged.slice(local.length);
    expect(web.map((s) => s.label)).toEqual(['Cats', 'cat food', 'cat toys', 'cat names', 'cat breeds']);
    expect(web.every((s) => s.kind === 'search' && s.text === s.label)).toBe(true);
  });

  it('leaves local suggestions alone when there is nothing from the web', () => {
    const local = localSuggestions('cat', src);
    expect(withWeb(local, [], 'cat')).toEqual(local);
  });
});

describe('parseGoogleResponse', () => {
  it('reads the expected shape', () => {
    expect(parseGoogleResponse(['q', ['a', 'b']])).toEqual(['a', 'b']);
  });
  it('keeps only strings', () => {
    expect(parseGoogleResponse(['q', ['a', 1, null, 'b', { x: 1 }]])).toEqual(['a', 'b']);
  });
  it('gives an empty list for anything else', () => {
    for (const bad of [null, undefined, 'x', 5, {}, [], ['q'], ['q', 'notarray'], ['q', null]]) {
      expect(parseGoogleResponse(bad)).toEqual([]);
    }
  });
});
