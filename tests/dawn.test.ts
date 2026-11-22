import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  badgeText,
  countStarving,
  dawnTargets,
  isDawnTarget,
  siteOf,
  stateOf,
  type TabInfo,
} from '../lib/hunger';

const tabArb: fc.Arbitrary<TabInfo> = fc.record(
  {
    id: fc.nat(),
    url: fc.oneof(
      fc.constant(undefined),
      fc.webUrl(),
      fc.constantFrom('chrome://extensions', 'about:blank', 'https://example.com/'),
    ),
    active: fc.boolean(),
    audible: fc.boolean(),
    discarded: fc.boolean(),
    pinned: fc.boolean(),
    lastAccessed: fc.integer({ min: 0, max: 2_000_000_000_000 }),
  },
  { requiredKeys: ['id', 'active', 'audible', 'discarded', 'pinned'] },
);

const nowArb = fc.integer({ min: 0, max: 2_000_000_000_000 });

/** Tabs plus a garlic list that often contains some of their sites. */
const scenarioArb = fc
  .tuple(fc.array(tabArb, { maxLength: 15 }), fc.array(fc.domain(), { maxLength: 3 }), fc.double({ min: 0, max: 1, noNaN: true }))
  .map(([tabs, extra, pick]) => {
    const own = tabs
      .map((t) => siteOf(t.url))
      .filter((s): s is string => s !== null)
      .filter((_, i) => (i + 1) / (tabs.length + 1) <= pick);
    return { tabs, garlic: [...extra, ...own] };
  });

const DAY = 24 * 60 * 60 * 1000;

describe('dawnTargets', () => {
  it('never includes a tab Dawn must not touch', () => {
    fc.assert(
      fc.property(scenarioArb, nowArb, ({ tabs, garlic }, now) => {
        for (const t of dawnTargets(tabs, garlic, now)) {
          const site = siteOf(t.url);
          expect(t.active).toBe(false);
          expect(t.pinned).toBe(false);
          expect(t.audible).toBe(false);
          expect(t.discarded).toBe(false);
          expect(site).not.toBeNull();
          expect(garlic).not.toContain(site);
        }
      }),
      { numRuns: 500 },
    );
  });

  it('includes every idle, unprotected, unpinned web tab', () => {
    fc.assert(
      fc.property(scenarioArb, nowArb, ({ tabs, garlic }, now) => {
        const targets = new Set(dawnTargets(tabs, garlic, now));
        for (const t of tabs) {
          const site = siteOf(t.url);
          const shouldClose =
            site !== null &&
            !garlic.includes(site) &&
            !t.pinned &&
            !t.active &&
            !t.audible &&
            !t.discarded &&
            t.lastAccessed !== undefined &&
            now - t.lastAccessed >= DAY;
          expect(targets.has(t)).toBe(shouldClose);
          expect(isDawnTarget(t, garlic, now)).toBe(shouldClose);
        }
      }),
      { numRuns: 500 },
    );
  });

  it('is an ordered subset of the input', () => {
    fc.assert(
      fc.property(scenarioArb, nowArb, ({ tabs, garlic }, now) => {
        const targets = dawnTargets(tabs, garlic, now);
        let from = 0;
        for (const t of targets) {
          const at = tabs.indexOf(t, from);
          expect(at).toBeGreaterThanOrEqual(0);
          from = at + 1;
        }
      }),
    );
  });
});

describe('countStarving', () => {
  it('matches the number of starving tabs', () => {
    fc.assert(
      fc.property(scenarioArb, nowArb, ({ tabs, garlic }, now) => {
        const expected = tabs.filter((t) => stateOf(t, garlic, now) === 'starving').length;
        expect(countStarving(tabs, garlic, now)).toBe(expected);
      }),
    );
  });
});

describe('badgeText', () => {
  it('is empty for zero', () => expect(badgeText(0)).toBe(''));
  it('shows the number up to 999', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 999 }), (n) => {
        expect(badgeText(n)).toBe(String(n));
      }),
    );
  });
  it('caps above 999', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1000, max: 1_000_000 }), (n) => {
        expect(badgeText(n)).toBe('999+');
      }),
    );
  });
});
