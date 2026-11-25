// The Dawn tooltip explains starving tabs that Dawn will not close, so it never disagrees with the header's starving count.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { DAY_MS, dawnKeepReason, dawnTargets, stateOf, type TabInfo } from '../lib/hunger';
import { dawnHeaderTip } from '../lib/tips';

const NOW = 1_800_000_000_000;
const tabArb: fc.Arbitrary<TabInfo> = fc.record({
  id: fc.nat(),
  url: fc.constantFrom(undefined, 'https://a.com/x', 'https://b.org/', 'chrome://extensions', 'file:///tmp/x.html'),
  active: fc.boolean(),
  audible: fc.boolean(),
  discarded: fc.boolean(),
  pinned: fc.boolean(),
  lastAccessed: fc.option(fc.integer({ min: NOW - 5 * DAY_MS, max: NOW }), { nil: undefined }),
});
const garlicArb = fc.subarray(['a.com', 'b.org']);

describe('dawnKeepReason', () => {
  it('every starving tab is either closed by Dawn or has a reason, never both', () => {
    fc.assert(
      fc.property(fc.array(tabArb, { maxLength: 30 }), garlicArb, (tabs, garlic) => {
        const starving = tabs.filter((t) => stateOf(t, garlic, NOW) === 'starving').length;
        const targets = dawnTargets(tabs, garlic, NOW);
        const kept = tabs.filter((t) => dawnKeepReason(t, garlic, NOW) !== null);
        expect(targets.length + kept.length).toBe(starving);
        for (const t of kept) expect(targets).not.toContain(t);
      }),
      { numRuns: 300 },
    );
  });
  it('names pinned tabs and pages that are not on the web', () => {
    const old = NOW - 2 * DAY_MS;
    const base = { id: 1, active: false, audible: false, discarded: false, pinned: false, lastAccessed: old };
    expect(dawnKeepReason({ ...base, url: 'https://a.com/', pinned: true }, [], NOW)).toBe('pinned');
    expect(dawnKeepReason({ ...base, url: 'chrome://extensions' }, [], NOW)).toBe('not a web page');
    expect(dawnKeepReason({ ...base, url: 'https://a.com/' }, [], NOW)).toBeNull();
    // Not starving: no reason needed.
    expect(dawnKeepReason({ ...base, url: 'https://a.com/', audible: true }, [], NOW)).toBeNull();
  });
});

describe('the Dawn tip names the starving tabs it keeps', () => {
  it('adds which and why', () => {
    expect(dawnHeaderTip(0, 0, ['pinned']).points).toEqual([
      'Nothing is starving right now. Dawn closes tabs that have been idle for over a day.',
      '1 starving tab is kept safe (pinned).',
    ]);
    expect(dawnHeaderTip(2, 500, ['pinned']).points[1]).toBe('1 starving tab is kept safe (pinned).');
    expect(dawnHeaderTip(3, 0, ['pinned'], true).points).toEqual(['Dawn is running. Please wait.']);
  });
});
