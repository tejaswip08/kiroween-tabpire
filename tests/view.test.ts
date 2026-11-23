import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { DAY_MS, formatMb } from '../lib/hunger';
import {
  VIAL_FULL_MS,
  VIAL_TICK,
  buildCards,
  idleLabel,
  isCardTab,
  sumMb,
  toRawTab,
  vialFill,
  type RawTab,
} from '../lib/view';

const OWN = 'chrome-extension://abc/';

const rawTabArb: fc.Arbitrary<RawTab> = fc.record(
  {
    id: fc.integer({ min: 1, max: 500 }),
    windowId: fc.integer({ min: 1, max: 3 }),
    url: fc.oneof(
      fc.constant(undefined),
      fc.webUrl(),
      fc.constantFrom(
        'chrome://newtab/',
        'about:newtab',
        'about:blank',
        `${OWN}newtab.html`,
        'chrome://extensions',
      ),
    ),
    title: fc.string(),
    favIconUrl: fc.constant(undefined),
    active: fc.boolean(),
    audible: fc.boolean(),
    discarded: fc.boolean(),
    pinned: fc.boolean(),
    lastAccessed: fc.integer({ min: 0, max: 2_000_000_000_000 }),
  },
  { requiredKeys: ['id', 'windowId', 'active', 'audible', 'discarded', 'pinned'] },
);

/** Tabs with unique ids, as a browser always has. */
const tabsArb = fc.uniqueArray(rawTabArb, { selector: (t) => t.id, maxLength: 25 });
const nowArb = fc.integer({ min: 0, max: 2_000_000_000_000 });

const raw = (over: Partial<RawTab> = {}): RawTab => ({
  id: 1,
  windowId: 1,
  url: 'https://example.com/',
  active: false,
  audible: false,
  discarded: false,
  pinned: false,
  lastAccessed: 0,
  ...over,
});

describe('buildCards', () => {
  it('sorts by hunger then id, and leaves out the page itself, own pages and blank tabs', () => {
    fc.assert(
      fc.property(tabsArb, nowArb, fc.integer({ min: 1, max: 500 }), (tabs, now, currentId) => {
        const cards = buildCards(tabs, currentId, OWN, [], now);

        for (let i = 1; i < cards.length; i++) {
          const a = cards[i - 1]!;
          const b = cards[i]!;
          expect(a.hungerMs > b.hungerMs || (a.hungerMs === b.hungerMs && a.tab.id < b.tab.id)).toBe(true);
        }
        for (const c of cards) {
          expect(c.tab.id).not.toBe(currentId);
          expect(c.tab.url ?? '').not.toContain(OWN);
          expect(['chrome://newtab/', 'about:newtab', 'about:blank']).not.toContain(c.tab.url);
        }
      }),
      { numRuns: 300 },
    );
  });

  it('includes every other tab exactly once', () => {
    fc.assert(
      fc.property(tabsArb, nowArb, fc.integer({ min: 1, max: 500 }), (tabs, now, currentId) => {
        const cards = buildCards(tabs, currentId, OWN, [], now);
        const expected = tabs.filter((t) => isCardTab(t, currentId, OWN)).map((t) => t.id).sort((a, b) => a - b);
        expect(cards.map((c) => c.tab.id).sort((a, b) => a - b)).toEqual(expected);
        expect(new Set(cards.map((c) => c.tab.id)).size).toBe(cards.length);
      }),
    );
  });

  it('puts the hungriest tab first', () => {
    const now = 10 * DAY_MS;
    const cards = buildCards(
      [raw({ id: 1, lastAccessed: now - 1000 }), raw({ id: 2, lastAccessed: now - 5 * DAY_MS }), raw({ id: 3, lastAccessed: now - DAY_MS })],
      undefined,
      OWN,
      [],
      now,
    );
    expect(cards.map((c) => c.tab.id)).toEqual([2, 3, 1]);
  });

  it('fills in state, site and memory', () => {
    const now = 10 * DAY_MS;
    const [card] = buildCards([raw({ url: 'https://www.claude.ai/x', lastAccessed: now - 2 * DAY_MS })], undefined, OWN, [], now);
    expect(card).toMatchObject({ state: 'starving', site: 'claude.ai', hungerMs: 2 * DAY_MS });
    expect(card!.mb).toBeGreaterThan(300);
    const [protectedCard] = buildCards([raw({ url: 'https://claude.ai/' })], undefined, OWN, ['claude.ai'], now);
    expect(protectedCard!.state).toBe('protected');
  });

  it('keeps tabs that are still loading (no URL)', () => {
    expect(isCardTab(raw({ url: undefined }), 9, OWN)).toBe(true);
  });

  it('does not treat an empty own prefix as matching everything', () => {
    expect(isCardTab(raw(), undefined, '')).toBe(true);
  });
});

describe('toRawTab', () => {
  it('skips tabs without an id and fills defaults', () => {
    expect(toRawTab({})).toBeNull();
    expect(toRawTab({ id: 4 })).toMatchObject({ id: 4, active: false, pinned: false, windowId: -1 });
  });
});

describe('vialFill', () => {
  it('stays within 0 to 1', () => {
    fc.assert(
      fc.property(fc.integer({ min: -1e9, max: 1e12 }), (ms) => {
        const v = vialFill(ms);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }),
    );
  });

  it('never decreases as hunger grows', () => {
    fc.assert(
      fc.property(fc.nat(1e10), fc.nat(1e10), (a, b) => {
        const [lo, hi] = a <= b ? [a, b] : [b, a];
        expect(vialFill(lo)).toBeLessThanOrEqual(vialFill(hi));
      }),
    );
  });

  it('is full at 3 days and the tick sits at the 1 day line', () => {
    expect(vialFill(VIAL_FULL_MS)).toBe(1);
    expect(vialFill(0)).toBe(0);
    expect(VIAL_TICK).toBeCloseTo(1 / 3);
    expect(vialFill(DAY_MS)).toBeCloseTo(VIAL_TICK);
  });
});

describe('idleLabel', () => {
  const card = (ms: number, over: Partial<RawTab> = {}) => {
    const now = 100 * DAY_MS;
    const [c] = buildCards([raw({ lastAccessed: now - ms, ...over })], undefined, OWN, [], now);
    return c!;
  };

  it.each([
    [10_000, 'Just now'],
    [60_000, '1 minute idle'],
    [5 * 60_000, '5 minutes idle'],
    [60 * 60_000, '1 hour idle'],
    [5 * 60 * 60_000, '5 hours idle'],
    [DAY_MS, '1 day idle'],
    [3 * DAY_MS + 5000, '3 days idle'],
  ])('%i ms reads "%s"', (ms, text) => {
    expect(idleLabel(card(ms))).toBe(text);
  });

  it('says in use for active and audible tabs', () => {
    expect(idleLabel(card(5 * DAY_MS, { active: true }))).toBe('In use now');
    expect(idleLabel(card(5 * DAY_MS, { audible: true }))).toBe('In use now');
  });

  it('says unknown when there is no last-used time', () => {
    expect(idleLabel(card(0, { lastAccessed: undefined }))).toBe('Idle time unknown');
  });
});

describe('formatMb', () => {
  it('always starts with ~', () => {
    fc.assert(
      fc.property(fc.nat(100_000), (mb) => {
        expect(formatMb(mb).startsWith('~')).toBe(true);
      }),
    );
  });
  it('switches to GB at 1000 MB', () => {
    expect(formatMb(995)).toBe('~995 MB');
    expect(formatMb(1000)).toBe('~1.0 GB');
    expect(formatMb(1460)).toBe('~1.5 GB');
    expect(formatMb(0)).toBe('~0 MB');
  });
});

describe('sumMb', () => {
  it('adds up estimates', () => {
    expect(sumMb([{ mb: 10 }, { mb: 25 }])).toBe(35);
    expect(sumMb([])).toBe(0);
  });
});
