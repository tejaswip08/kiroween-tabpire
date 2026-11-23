import { beforeEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';

vi.mock('wxt/browser', async () => {
  const m = await import('../../lib/fakeBrowser');
  return { browser: m.browser };
});

import { fake } from '../../lib/fakeBrowser';
import { DAY_MS, dawnTargets, siteOf } from '../../lib/hunger';
import { store } from '../../lib/store';
import { coffin, crypt, dawn, garlic, resurrect, stake } from '../../lib/tabs';
import { toTabInfo } from '../../lib/tabinfo';

const NOW = 1_700_000_000_000;
const RUNS = 100;

beforeEach(() => fake.reset());

interface GenTab {
  id: number;
  url: string | undefined;
  active: boolean;
  audible: boolean;
  discarded: boolean;
  pinned: boolean;
  lastAccessed: number | undefined;
}

// A small pool of sites and paths, so garlic and crypt URL collisions happen.
const webUrlArb = fc
  .tuple(
    fc.constantFrom('a.example', 'b.example', 'www.c.example', 'youtube.com', 'github.com'),
    fc.constantFrom('/', '/x', '/y'),
  )
  .map(([host, path]) => `https://${host}${path}`);
const urlArb = fc.oneof(
  { weight: 5, arbitrary: webUrlArb },
  { weight: 1, arbitrary: fc.constantFrom<string | undefined>('chrome://extensions', 'about:blank', 'file:///tmp/a.html', undefined) },
);
// Idle time around the one-day line: from 1 hour under to 3 days over, plus a few exact edge values.
const lastAccessedArb = fc.oneof(
  fc.constant<number | undefined>(undefined),
  fc.constantFrom(NOW - DAY_MS, NOW - DAY_MS + 1, NOW - DAY_MS - 1, NOW),
  fc.integer({ min: -3_600_000, max: 2 * DAY_MS }).map((overshoot) => NOW - DAY_MS - overshoot),
);
const tabArb: fc.Arbitrary<GenTab> = fc.record({
  id: fc.integer({ min: 1, max: 1000 }),
  url: urlArb,
  active: fc.boolean(),
  audible: fc.boolean(),
  discarded: fc.boolean(),
  pinned: fc.boolean(),
  lastAccessed: lastAccessedArb,
});
const tabsArb = fc.uniqueArray(tabArb, { selector: (t) => t.id, maxLength: 12 });

/** Garlic list drawn from the generated sites, plus an unrelated one. */
const scenarioArb = fc
  .tuple(tabsArb, fc.array(fc.nat(), { maxLength: 4 }))
  .map(([tabs, picks]) => {
    const sites = tabs.map((t) => siteOf(t.url)).filter((s): s is string => s !== null);
    const garlicSites = sites.length === 0 ? [] : picks.map((p) => sites[p % sites.length]!);
    return { tabs, garlic: [...new Set([...garlicSites, 'unrelated.example'])] };
  });

function load(tabs: readonly GenTab[], garlicSites: string[]): void {
  fake.reset();
  for (const t of tabs) {
    fake.tabs.set(t.id, {
      id: t.id,
      url: t.url,
      title: `Tab ${t.id}`,
      active: t.active,
      audible: t.audible,
      discarded: t.discarded,
      pinned: t.pinned,
      lastAccessed: t.lastAccessed,
      windowId: 1,
    });
  }
  fake.nextId = 5000;
  fake.storage.set('tabpire:garlic', garlicSites);
}

describe('Dawn on the fake browser', () => {
  // Feature: web-demo, Property 7: Dawn spares protected tabs
  // **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.6**
  it('Property 7: active, pinned, audible and garlic-site tabs stay open', async () => {
    await fc.assert(
      fc.asyncProperty(scenarioArb, async ({ tabs, garlic: garlicSites }) => {
        load(tabs, garlicSites);
        const result = await dawn(NOW);
        expect(result.ok).toBe(true);
        for (const t of tabs) {
          const site = siteOf(t.url);
          const protectedTab = t.active || t.pinned || t.audible || (site !== null && garlicSites.includes(site));
          if (protectedTab) expect(fake.tabs.has(t.id)).toBe(true);
        }
      }),
      { numRuns: RUNS },
    );
  });

  // Feature: web-demo, Property 8: Dawn closes the other starving tabs, saved first
  // **Validates: Requirements 6.5**
  it('Property 8: closed tabs equal dawnTargets, each saved to the crypt before the first remove', async () => {
    await fc.assert(
      fc.asyncProperty(scenarioArb, async ({ tabs, garlic: garlicSites }) => {
        load(tabs, garlicSites);
        const infos = tabs.map((t) => toTabInfo(fake.tabs.get(t.id) as never)!);
        const expected = dawnTargets(infos, garlicSites, NOW).map((i) => i.id).sort((a, b) => a - b);

        const result = await dawn(NOW);
        expect(result.ok).toBe(true);

        const closed = tabs.filter((t) => !fake.tabs.has(t.id));
        expect(closed.map((t) => t.id).sort((a, b) => a - b)).toEqual(expected);

        const cryptUrls = (await store.getCrypt()).map((c) => c.url);
        for (const t of closed) expect(cryptUrls).toContain(t.url);

        const firstRemove = fake.calls.findIndex((c) => c.startsWith('remove:'));
        if (firstRemove >= 0) {
          const lastSave = fake.calls.lastIndexOf('set:tabpire:crypt');
          expect(lastSave).toBeGreaterThanOrEqual(0);
          expect(lastSave).toBeLessThan(firstRemove);
        }
      }),
      { numRuns: RUNS },
    );
  });
});

type Step =
  | { kind: 'stake' | 'coffin' | 'crypt' | 'garlic' | 'resurrect'; index: number }
  | { kind: 'dawn'; index: number };

const stepArb: fc.Arbitrary<Step> = fc.record({
  kind: fc.constantFrom('stake', 'coffin', 'crypt', 'garlic', 'resurrect', 'dawn'),
  index: fc.nat({ max: 50 }),
});

describe('Action sequences on the fake browser', () => {
  // Feature: web-demo, Property 9: Action sequences keep the invariants
  // **Validates: Requirements 6.7**
  it('Property 9: mbFreed never decreases and the crypt never holds a URL twice', async () => {
    await fc.assert(
      fc.asyncProperty(scenarioArb, fc.array(stepArb, { maxLength: 15 }), async ({ tabs, garlic: garlicSites }, steps) => {
        load(tabs, garlicSites);
        let now = NOW;
        let lastMb = (await store.getStats()).mbFreed;
        for (const step of steps) {
          now += 1000;
          const ids = [...fake.tabs.keys()];
          const entries = await store.getCrypt();
          switch (step.kind) {
            case 'stake':
            case 'coffin':
            case 'crypt':
            case 'garlic': {
              if (ids.length === 0) break;
              const id = ids[step.index % ids.length]!;
              const action = { stake, coffin, crypt, garlic }[step.kind];
              await action(id, now);
              break;
            }
            case 'resurrect':
              if (entries.length === 0) break;
              await resurrect(entries[step.index % entries.length]!.id, now);
              break;
            case 'dawn':
              await dawn(now);
              break;
          }
          const mb = (await store.getStats()).mbFreed;
          expect(mb).toBeGreaterThanOrEqual(lastMb);
          lastMb = mb;
          const urls = (await store.getCrypt()).map((c) => c.url);
          expect(new Set(urls).size).toBe(urls.length);
        }
      }),
      { numRuns: RUNS },
    );
  });
});
