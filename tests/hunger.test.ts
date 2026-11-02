import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  DAY,
  HOUR,
  appetiteMb,
  dawnTargets,
  hostOf,
  pallor,
  rankFor,
  stageOf,
  type TabLike,
} from '../lib/hunger';

const NOW = 1_800_000_000_000;
const hosts = ['youtube.com', 'example.com', 'figma.com', 'news.ycombinator.com', 'slack.com'];

const tabArb: fc.Arbitrary<TabLike> = fc.record({
  id: fc.nat(),
  url: fc.constantFrom(...hosts).map((h) => `https://${h}/x`),
  title: fc.string(),
  lastAccessed: fc.integer({ min: NOW - 30 * DAY, max: NOW }),
  active: fc.boolean(),
  audible: fc.boolean(),
  discarded: fc.boolean(),
  pinned: fc.boolean(),
});
const garlicArb = fc.subarray(hosts).map((a) => new Set(a));

describe('hunger rules', () => {
  it('a garlic-protected tab is never a Dawn target', () => {
    fc.assert(
      fc.property(fc.array(tabArb), garlicArb, (tabs, garlic) => {
        for (const t of dawnTargets(tabs, NOW, garlic)) expect(garlic.has(hostOf(t.url))).toBe(false);
      }),
    );
  });

  it('Dawn never burns active, audible, pinned or coffined tabs', () => {
    fc.assert(
      fc.property(fc.array(tabArb), garlicArb, (tabs, garlic) => {
        for (const t of dawnTargets(tabs, NOW, garlic)) {
          expect(t.active || t.audible || t.pinned || t.discarded).toBe(false);
        }
      }),
    );
  });

  it('hunger only grows with idle time', () => {
    const order = { fresh: 0, starving: 1 } as const;
    fc.assert(
      fc.property(tabArb, fc.nat({ max: 10 * DAY }), (tab, extra) => {
        const t = { ...tab, active: false, audible: false, discarded: false };
        const a = stageOf(t, NOW, new Set());
        const b = stageOf(t, NOW + extra, new Set());
        if (a in order && b in order) {
          expect(order[b as keyof typeof order]).toBeGreaterThanOrEqual(order[a as keyof typeof order]);
        }
        expect(pallor(t, NOW + extra)).toBeGreaterThanOrEqual(pallor(t, NOW));
      }),
    );
  });

  it('pallor stays within 0..1', () => {
    fc.assert(
      fc.property(tabArb, (tab) => {
        const p = pallor(tab, NOW);
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThanOrEqual(1);
      }),
    );
  });

  it('a coffined tab eats nothing; awake tabs always eat something', () => {
    fc.assert(
      fc.property(tabArb, (tab) => {
        expect(appetiteMb(tab) === 0).toBe(tab.discarded);
      }),
    );
  });

  it('classifies the basic stages', () => {
    const base: TabLike = {
      id: 1, url: 'https://example.com', title: 'x', lastAccessed: NOW,
      active: false, audible: false, discarded: false, pinned: false,
    };
    expect(stageOf(base, NOW, new Set())).toBe('fresh');
    expect(stageOf(base, NOW + 20 * HOUR, new Set())).toBe('fresh');
    expect(stageOf(base, NOW + 2 * DAY, new Set())).toBe('starving');
    expect(stageOf({ ...base, audible: true }, NOW + 2 * DAY, new Set())).toBe('feeding');
    expect(stageOf(base, NOW, new Set(['example.com']))).toBe('garlic');
    expect(rankFor(0)).toBe('Novice hunter');
    expect(rankFor(600)).toBe('Van Helsing');
  });
});

describe('search suggestions', () => {
  it('suggests matching open tabs, pinned pages and crypt entries, without duplicates', async () => {
    const { localSuggestions } = await import('../lib/suggest');
    const tab = { id: 7, url: 'https://github.com/kiro', title: 'kiro · GitHub', lastAccessed: NOW, active: false, audible: false, discarded: false, pinned: false };
    const out = localSuggestions('kiro', [tab], [{ id: 'a', title: 'Kiro', url: 'https://kiro.dev/' }, { id: 'b', title: 'Dup', url: 'https://github.com/kiro' }], [{ url: 'https://kiro.dev/docs', title: 'Kiro docs', at: 0 }]);
    expect(out.map((s) => s.kind)).toEqual(['tab', 'page', 'crypt']);
    expect(localSuggestions('   ', [tab], [], [])).toEqual([]);
    expect(localSuggestions('nothing here', [tab], [], [])).toEqual([]);
  });

  it('offers the typed query first, then Google completions that still match it', async () => {
    const { webSuggestionsFor } = await import('../lib/suggest');
    const fetched = [
      { kind: 'web' as const, text: 'jog falls' },
      { kind: 'web' as const, text: 'jog falls karnataka' },
      { kind: 'web' as const, text: 'jogger' },
    ];
    expect(webSuggestionsFor('Jog Falls', fetched).map((s) => (s.kind === 'web' ? s.text : ''))).toEqual([
      'Jog Falls',
      'jog falls karnataka',
    ]);
    expect(webSuggestionsFor('   ', fetched)).toEqual([]);
  });
});
