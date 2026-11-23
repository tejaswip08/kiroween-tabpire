import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';

vi.mock('wxt/browser', async () => {
  const m = await import('../../lib/fakeBrowser');
  return { browser: m.browser };
});

import { browser, events, fake } from '../../lib/fakeBrowser';
import { DAY_MS, siteOf, stateOf } from '../../lib/hunger';
import type { VampireState } from '../../lib/hunger';
import { KEYS, LOG_ACTIONS, MAX_HAUNTS, store } from '../../lib/store';
import type { CryptEntry, LogEntry } from '../../lib/store';
import { coffin, crypt, dawn, garlic, resurrect, stake } from '../../lib/tabs';
import { toTabInfo } from '../../lib/tabinfo';
import { resetDemo, seedDemo } from '../../demo/src/seed';

const RUNS = 100;
const HOUR = 60 * 60 * 1000;

beforeEach(() => fake.reset());
afterEach(() => vi.useRealTimers());

const tabList = () => [...fake.tabs.values()];
const garlicList = () => (fake.storage.get(KEYS.garlic) as string[]) ?? [];

function stateCounts(now: number): Record<VampireState, number> {
  const counts: Record<VampireState, number> = { awake: 0, starving: 0, asleep: 0, protected: 0 };
  for (const t of tabList()) counts[stateOf(toTabInfo(t as never)!, garlicList(), now)]++;
  return counts;
}

/** Everything the demo shows, with tab ids removed. */
function snapshot() {
  const tabs = tabList()
    .map(({ id: _id, ...rest }) => rest)
    .sort((a, b) => `${a.url}|${a.title}`.localeCompare(`${b.url}|${b.title}`));
  const current = fake.currentTabId === undefined ? undefined : fake.tabs.get(fake.currentTabId)?.url;
  return { tabs, storage: Object.fromEntries(fake.storage), current };
}

const nowArb = fc.integer({ min: -1_000_000_000_000, max: 4_000_000_000_000 });

describe('seedDemo', () => {
  // Feature: web-demo, Property 6: Seed data is well formed
  // **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 8.3**
  it('Property 6: counts, flags, states, offsets, icons and store sizes', () => {
    fc.assert(
      fc.property(nowArb, (now) => {
        fake.reset();
        seedDemo(now);
        const tabs = tabList();
        expect(tabs.length).toBeGreaterThanOrEqual(18);
        expect(tabs.length).toBeLessThanOrEqual(22);

        const active = tabs.filter((t) => t.active);
        expect(active).toHaveLength(1);
        expect(fake.currentTabId).toBe(active[0]!.id);
        for (const t of tabs) if (t !== active[0]) expect(t.url).toMatch(/^https:\/\//);
        expect(tabs.filter((t) => t.audible)).toHaveLength(1);
        expect(tabs.filter((t) => t.discarded)).toHaveLength(1);
        expect(tabs.filter((t) => t.pinned).length).toBeGreaterThanOrEqual(1);
        expect(fake.autoEvents).toBe(true);

        const sites = garlicList();
        expect(sites.length).toBeGreaterThanOrEqual(2);
        expect(tabs.filter((t) => sites.includes(siteOf(t.url) ?? '')).length).toBeGreaterThanOrEqual(1);

        // Each tab has exactly one state (the counts add up) and the counts match the plan.
        const counts = stateCounts(now);
        expect(counts.awake + counts.starving + counts.asleep + counts.protected).toBe(tabs.length);
        expect(counts.awake).toBeGreaterThanOrEqual(5);
        expect(counts.starving).toBeGreaterThanOrEqual(5);
        expect(counts.protected).toBeGreaterThanOrEqual(1);
        expect(counts.asleep).toBe(1);
        expect(counts).toEqual({ awake: 8, starving: 9, protected: 2, asleep: 1 });

        const starvingIdle = tabs
          .filter((t) => stateOf(toTabInfo(t as never)!, sites, now) === 'starving')
          .map((t) => now - t.lastAccessed!);
        for (const idle of starvingIdle) {
          expect(idle).toBeGreaterThanOrEqual(DAY_MS);
          expect(idle).toBeLessThanOrEqual(5 * DAY_MS);
        }

        for (const t of tabs) {
          expect(t.lastAccessed).toBeDefined();
          expect(now - t.lastAccessed!).toBeGreaterThanOrEqual(0);
          if (t !== active[0]) expect(t.favIconUrl).toMatch(/^data:image\//);
        }

        const haunts = fake.storage.get(KEYS.haunts) as unknown[];
        expect(haunts.length).toBeGreaterThanOrEqual(3);
        expect(haunts.length).toBeLessThanOrEqual(6);
        expect(haunts.length).toBeLessThanOrEqual(MAX_HAUNTS);
        const cryptEntries = fake.storage.get(KEYS.crypt) as CryptEntry[];
        expect(cryptEntries.length).toBeGreaterThanOrEqual(2);
        expect(cryptEntries.length).toBeLessThanOrEqual(5);
        const log = fake.storage.get(KEYS.log) as LogEntry[];
        expect(log.length).toBe(8);
        for (const e of log) expect(LOG_ACTIONS).toContain(e.action);
        expect(fake.storage.get(KEYS.stats)).toBeDefined();
      }),
      { numRuns: RUNS },
    );
  });

  it('the store reads the seeded data back through its own validators', async () => {
    seedDemo(1_700_000_000_000);
    expect(await store.getGarlic()).toHaveLength(2);
    expect(await store.getHaunts()).toHaveLength(4);
    expect(await store.getCrypt()).toHaveLength(3);
    expect(await store.getLog()).toHaveLength(8);
    expect((await store.getStats()).staked).toBe(12);
  });

  it('gives the same classification and the same relative offsets at any now', () => {
    const run = (now: number) => {
      fake.reset();
      seedDemo(now);
      return {
        counts: stateCounts(now),
        idle: tabList().map((t) => now - t.lastAccessed!).sort((a, b) => a - b),
        savedAt: (fake.storage.get(KEYS.crypt) as CryptEntry[]).map((c) => now - c.savedAt),
        at: (fake.storage.get(KEYS.log) as LogEntry[]).map((e) => now - e.at),
      };
    };
    const tenYears = 10 * 365 * DAY_MS;
    expect(run(tenYears)).toEqual(run(0));
  });

  it('keeps every idle time at least 2 hours away from the one-day line', () => {
    seedDemo(0);
    for (const t of tabList()) {
      const idle = -t.lastAccessed!;
      expect(Math.abs(idle - DAY_MS)).toBeGreaterThanOrEqual(2 * HOUR - 1);
    }
  });
});

type Step = { kind: 'stake' | 'coffin' | 'crypt' | 'garlic' | 'resurrect' | 'dawn'; index: number };
const stepArb: fc.Arbitrary<Step> = fc.record({
  kind: fc.constantFrom('stake', 'coffin', 'crypt', 'garlic', 'resurrect', 'dawn'),
  index: fc.nat({ max: 50 }),
});

async function play(steps: Step[], start: number): Promise<void> {
  let now = start;
  for (const step of steps) {
    now += 1000;
    const ids = [...fake.tabs.keys()];
    if (step.kind === 'resurrect') {
      const entries = await store.getCrypt();
      if (entries.length > 0) await resurrect(entries[step.index % entries.length]!.id, now);
    } else if (step.kind === 'dawn') {
      await dawn(now);
    } else if (ids.length > 0) {
      await { stake, coffin, crypt, garlic }[step.kind](ids[step.index % ids.length]!, now);
    }
  }
}

describe('resetDemo', () => {
  // Feature: web-demo, Property 10: Reset restores the sample data
  // **Validates: Requirements 7.3**
  it('Property 10: reset after random actions equals a fresh seed, and twice equals once', async () => {
    await fc.assert(
      fc.asyncProperty(nowArb, fc.array(stepArb, { maxLength: 12 }), async (t, steps) => {
        fake.reset();
        seedDemo(t);
        const fresh = snapshot();

        fake.reset();
        seedDemo(t - 5 * 60 * 1000);
        await play(steps, t - 5 * 60 * 1000);
        await resetDemo(t);
        const once = snapshot();
        expect(once).toEqual(fresh);
        expect(fake.autoEvents).toBe(true);

        await resetDemo(t);
        expect(snapshot()).toEqual(once);
      }),
      { numRuns: RUNS },
    );
  });

  it('reset keeps tab listeners that were registered before it', async () => {
    seedDemo(0);
    const seen: unknown[] = [];
    fake.autoEvents = true;
    events.onRemoved.addListener((id) => seen.push(id));
    await resetDemo(0);
    const id = [...fake.tabs.keys()][1]!;
    await browser.tabs.remove(id);
    expect(seen).toEqual([id]);
  });

  it('recomputes ages from the Date.now() read at reset time, not at load time', async () => {
    vi.useFakeTimers();
    const loadTime = new Date('2030-01-01T00:00:00Z').getTime();
    vi.setSystemTime(loadTime);
    seedDemo(Date.now());
    const before = tabList().map((t) => t.lastAccessed!).sort((a, b) => a - b);

    const later = loadTime + 45 * DAY_MS;
    vi.setSystemTime(later);
    await resetDemo(Date.now());
    const after = tabList().map((t) => t.lastAccessed!).sort((a, b) => a - b);

    expect(after).toEqual(before.map((v) => v + 45 * DAY_MS));
    expect(Math.max(...after)).toBe(later);
    expect(stateCounts(later)).toEqual({ awake: 8, starving: 9, protected: 2, asleep: 1 });
    const log = fake.storage.get(KEYS.log) as LogEntry[];
    expect(Math.max(...log.map((e) => e.at))).toBeLessThan(later);
    expect(Math.min(...log.map((e) => e.at))).toBeGreaterThan(later - 4 * DAY_MS);
  });
});
