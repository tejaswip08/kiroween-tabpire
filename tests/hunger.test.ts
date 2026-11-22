import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  DAY_MS,
  KNOWN_SITE_MB,
  baseMb,
  estimateMb,
  formatMb,
  hungerMs,
  siteOf,
  stateOf,
  type TabInfo,
} from '../lib/hunger';

// ---------- arbitraries ----------

const urlArb = fc.oneof(
  fc.constant(undefined),
  fc.webUrl(),
  fc.constantFrom(
    'chrome://extensions',
    'about:blank',
    'file:///tmp/x.html',
    'https://www.youtube.com/watch?v=1',
    'https://chatgpt.com/c/1',
    'https://example.com/',
  ),
  fc.string(),
);

const tabArb: fc.Arbitrary<TabInfo> = fc.record(
  {
    id: fc.nat(),
    url: urlArb,
    active: fc.boolean(),
    audible: fc.boolean(),
    discarded: fc.boolean(),
    pinned: fc.boolean(),
    lastAccessed: fc.integer({ min: 0, max: 2_000_000_000_000 }),
  },
  { requiredKeys: ['id', 'active', 'audible', 'discarded', 'pinned'] },
);

const nowArb = fc.integer({ min: 0, max: 2_000_000_000_000 });
const hostArb = fc.domain();

/** A garlic list that sometimes contains the tab's own site. */
const tabAndGarlicArb = fc
  .tuple(tabArb, fc.array(hostArb, { maxLength: 5 }), fc.boolean())
  .map(([tab, hosts, includeOwn]) => {
    const own = siteOf(tab.url);
    const garlic = includeOwn && own !== null ? [...hosts, own] : hosts;
    return { tab, garlic };
  });

const tab = (over: Partial<TabInfo> = {}): TabInfo => ({
  id: 1,
  url: 'https://example.com/',
  active: false,
  audible: false,
  discarded: false,
  pinned: false,
  lastAccessed: 0,
  ...over,
});

// ---------- states ----------

describe('stateOf', () => {
  it('gives every tab exactly one state', () => {
    fc.assert(
      fc.property(tabAndGarlicArb, nowArb, ({ tab: t, garlic }, now) => {
        // Reference classifier: each predicate is computed on its own.
        const site = siteOf(t.url);
        const prot = site !== null && garlic.includes(site);
        const asleep = !prot && t.discarded;
        const starving =
          !prot &&
          !t.discarded &&
          !t.active &&
          !t.audible &&
          t.lastAccessed !== undefined &&
          now - t.lastAccessed >= DAY_MS;
        const awake = !prot && !t.discarded && !starving;

        const matches = [prot, asleep, starving, awake].filter(Boolean);
        expect(matches).toHaveLength(1);

        const expected = prot
          ? 'protected'
          : asleep
            ? 'asleep'
            : starving
              ? 'starving'
              : 'awake';
        expect(stateOf(t, garlic, now)).toBe(expected);
      }),
    );
  });

  it('protects garlic sites even when discarded', () => {
    fc.assert(
      fc.property(tabArb, nowArb, (t, now) => {
        const site = siteOf(t.url);
        fc.pre(site !== null);
        expect(stateOf(t, [site!], now)).toBe('protected');
      }),
    );
  });

  it('puts discarded non-garlic tabs to sleep', () => {
    fc.assert(
      fc.property(tabArb, nowArb, (t, now) => {
        expect(stateOf({ ...t, discarded: true }, [], now)).toBe('asleep');
      }),
    );
  });

  it('never marks a tab starving without a last-used time', () => {
    fc.assert(
      fc.property(tabArb, nowArb, (t, now) => {
        const noTime = { ...t, discarded: false, lastAccessed: undefined };
        expect(stateOf(noTime, [], now)).toBe('awake');
      }),
    );
  });

  it('switches at exactly one day', () => {
    const now = 10 * DAY_MS;
    expect(stateOf(tab({ lastAccessed: now - DAY_MS }), [], now)).toBe('starving');
    expect(stateOf(tab({ lastAccessed: now - DAY_MS + 1 }), [], now)).toBe('awake');
  });

  it('keeps active and audible tabs awake', () => {
    const now = 10 * DAY_MS;
    expect(stateOf(tab({ active: true }), [], now)).toBe('awake');
    expect(stateOf(tab({ audible: true }), [], now)).toBe('awake');
  });

  it('treats a future last-used time as awake', () => {
    expect(stateOf(tab({ lastAccessed: 5000 }), [], 1000)).toBe('awake');
  });

  it('never protects tabs without a web site', () => {
    expect(stateOf(tab({ url: 'chrome://extensions' }), ['extensions'], 0)).toBe('awake');
  });
});

// ---------- hunger ----------

describe('hungerMs', () => {
  it('is never negative', () => {
    fc.assert(
      fc.property(tabArb, nowArb, (t, now) => {
        expect(hungerMs(t, now)).toBeGreaterThanOrEqual(0);
      }),
    );
  });

  it('is 0 for active or audible tabs', () => {
    fc.assert(
      fc.property(tabArb, nowArb, fc.boolean(), (t, now, useActive) => {
        const busy = useActive ? { ...t, active: true } : { ...t, audible: true };
        expect(hungerMs(busy, now)).toBe(0);
      }),
    );
  });

  it('never goes down while a tab stays unused', () => {
    fc.assert(
      fc.property(tabArb, nowArb, nowArb, (t, a, b) => {
        const unused = { ...t, active: false, audible: false };
        const [t1, t2] = a <= b ? [a, b] : [b, a];
        expect(hungerMs(unused, t1)).toBeLessThanOrEqual(hungerMs(unused, t2));
      }),
    );
  });
});

// ---------- memory estimate ----------

describe('estimateMb', () => {
  it('is stable for the same input', () => {
    fc.assert(
      fc.property(tabArb, (t) => {
        expect(estimateMb(t)).toBe(estimateMb({ ...t }));
      }),
    );
  });

  it('is never negative and is a multiple of 5', () => {
    fc.assert(
      fc.property(tabArb, (t) => {
        const mb = estimateMb(t);
        expect(mb).toBeGreaterThanOrEqual(0);
        expect(mb % 5).toBe(0);
      }),
    );
  });

  it('is 0 for discarded tabs', () => {
    fc.assert(
      fc.property(tabArb, (t) => {
        expect(estimateMb({ ...t, discarded: true })).toBe(0);
      }),
    );
  });

  it('stays within 15% of base plus rounding slack', () => {
    fc.assert(
      fc.property(tabArb, (t) => {
        const live = { ...t, discarded: false };
        const base = baseMb(live);
        const mb = estimateMb(live);
        expect(mb).toBeGreaterThanOrEqual(base * 0.85 - 2.5);
        expect(mb).toBeLessThanOrEqual(base * 1.15 + 2.5);
      }),
    );
  });

  it('does not depend on usage', () => {
    fc.assert(
      fc.property(tabArb, fc.boolean(), fc.boolean(), (t, active, audible) => {
        expect(estimateMb({ ...t, active, audible, lastAccessed: 1 })).toBe(
          estimateMb({ ...t, active: !active, audible: !audible, lastAccessed: 2 }),
        );
      }),
    );
  });

  it.each(Object.entries(KNOWN_SITE_MB))('knows %s (about %i MB)', (site, base) => {
    for (let id = 0; id < 50; id++) {
      const mb = estimateMb(tab({ id, url: `https://${site}/` }));
      expect(mb).toBeGreaterThanOrEqual(base * 0.85 - 2.5);
      expect(mb).toBeLessThanOrEqual(base * 1.15 + 2.5);
    }
  });

  it('matches subdomains of a known site', () => {
    expect(baseMb(tab({ url: 'https://m.youtube.com/watch' }))).toBe(350);
    expect(baseMb(tab({ url: 'https://www.youtube.com/' }))).toBe(350);
  });

  it('does not match a sibling subdomain', () => {
    expect(baseMb(tab({ url: 'https://calendar.google.com/' }))).toBe(150);
    expect(baseMb(tab({ url: 'https://docs.google.com/' }))).toBe(250);
    expect(baseMb(tab({ url: 'https://meet.google.com/' }))).toBe(450);
  });

  it('falls back to heuristics for unknown sites', () => {
    expect(baseMb(tab({ url: 'https://example.com/' }))).toBe(150);
    expect(baseMb(tab({ url: 'https://example.com/watch' }))).toBe(300);
    expect(baseMb(tab({ url: 'https://docs.example.com/' }))).toBe(250);
    expect(baseMb(tab({ url: 'chrome://extensions' }))).toBe(80);
    expect(baseMb(tab({ url: undefined }))).toBe(80);
  });
});

describe('formatMb', () => {
  it('always starts with ~', () => {
    fc.assert(
      fc.property(fc.nat(), (n) => {
        expect(formatMb(n).startsWith('~')).toBe(true);
      }),
    );
    expect(formatMb(520)).toBe('~520 MB');
  });
});

// ---------- siteOf ----------

describe('siteOf', () => {
  it('never throws', () => {
    fc.assert(
      fc.property(fc.oneof(fc.string(), fc.constant(undefined)), (s) => {
        expect(() => siteOf(s)).not.toThrow();
      }),
    );
  });

  it('strips www and ignores non-web URLs', () => {
    expect(siteOf('https://www.example.com/a')).toBe('example.com');
    expect(siteOf('http://Example.com')).toBe('example.com');
    expect(siteOf('chrome://extensions')).toBeNull();
    expect(siteOf('about:blank')).toBeNull();
    expect(siteOf(undefined)).toBeNull();
  });
});

// ---------- purity ----------

describe('lib/hunger.ts purity', () => {
  const source = readFileSync(new URL('../lib/hunger.ts', import.meta.url), 'utf8');
  // Ignore comments so the rule text itself does not trip the check.
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  it.each(['wxt/browser', 'browser.', 'chrome.', 'Date.now', 'new Date('])(
    'does not contain %s',
    (banned) => {
      expect(code).not.toContain(banned);
    },
  );
});
