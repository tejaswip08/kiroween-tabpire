import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('wxt/browser', async () => {
  const m = await import('./helpers/fakeBrowser');
  return { browser: m.browser };
});

import { fake } from './helpers/fakeBrowser';
import { estimateMb, stateOf, type TabInfo } from '../lib/hunger';
import { store } from '../lib/store';
import { LOG_LIMIT, coffin, crypt, dawn, recordActions, garlic, resurrect, stake, ungarlic } from '../lib/tabs';
import { toTabInfo } from '../lib/tabinfo';

const NOW = 1_700_000_000_000;

beforeEach(() => fake.reset());

const mbOf = (id: number): number => {
  const info = toTabInfo(fake.tabs.get(id) as never) as TabInfo;
  return estimateMb(info);
};

describe('stake', () => {
  it('closes the tab, adds its memory, counts it and logs it', async () => {
    const tab = fake.addTab({ url: 'https://www.chatgpt.com/c/1', title: 'Chat' });
    const mb = mbOf(tab.id);
    expect(mb).toBeGreaterThan(0);

    const result = await stake(tab.id, NOW);

    expect(result).toEqual({ ok: true, changed: true, mb });
    expect(fake.tabs.has(tab.id)).toBe(false);
    const stats = await store.getStats();
    expect(stats.staked).toBe(1);
    expect(stats.mbFreed).toBe(mb);
    expect(await store.getLog()).toEqual([
      { at: NOW, action: 'stake', site: 'chatgpt.com', title: 'Chat' },
    ]);
  });

  it('fails for a missing tab and changes nothing', async () => {
    expect(await stake(999, NOW)).toEqual({ ok: false, reason: 'no-tab' });
    expect((await store.getStats()).staked).toBe(0);
    expect(await store.getLog()).toEqual([]);
  });

  it('fails when the browser refuses to close, and changes nothing', async () => {
    const tab = fake.addTab();
    fake.failRemove.add('*');
    expect(await stake(tab.id, NOW)).toEqual({ ok: false, reason: 'browser-error' });
    expect(fake.tabs.has(tab.id)).toBe(true);
    expect((await store.getStats()).mbFreed).toBe(0);
    expect(await store.getLog()).toEqual([]);
  });

  it('refreshes the badge after success', async () => {
    const tab = fake.addTab();
    fake.addTab({ lastAccessed: 0 });
    await stake(tab.id, NOW);
    expect(fake.badge.text).toBeDefined();
  });
});

describe('coffin', () => {
  it('discards the tab and counts its memory from before the discard', async () => {
    const tab = fake.addTab({ url: 'https://claude.ai/chat', title: 'Claude' });
    const mb = mbOf(tab.id);
    expect(mb).toBeGreaterThan(0);

    const result = await coffin(tab.id, NOW);

    expect(result).toEqual({ ok: true, changed: true, mb });
    expect(fake.tabs.get(tab.id)?.discarded).toBe(true);
    const stats = await store.getStats();
    expect(stats.coffined).toBe(1);
    expect(stats.mbFreed).toBe(mb);
    expect((await store.getLog())[0]).toMatchObject({ action: 'coffin', site: 'claude.ai' });
  });

  it.each([
    ['active', { active: true }],
    ['already discarded', { discarded: true }],
  ])('refuses a tab that is %s', async (_name, over) => {
    const tab = fake.addTab(over);
    expect(await coffin(tab.id, NOW)).toEqual({ ok: false, reason: 'not-allowed' });
    expect(fake.calls).not.toContain(`discard:${tab.id}`);
    expect((await store.getStats()).coffined).toBe(0);
    expect(await store.getLog()).toEqual([]);
  });

  it('fails for a missing tab', async () => {
    expect(await coffin(42, NOW)).toEqual({ ok: false, reason: 'no-tab' });
  });

  it('changes nothing when the browser throws', async () => {
    const tab = fake.addTab();
    fake.failDiscard.add('*');
    expect(await coffin(tab.id, NOW)).toEqual({ ok: false, reason: 'browser-error' });
    expect(fake.tabs.get(tab.id)?.discarded).toBe(false);
    expect((await store.getStats()).mbFreed).toBe(0);
    expect(await store.getLog()).toEqual([]);
  });
});

describe('crypt', () => {
  it('saves the tab before closing it, then records the action', async () => {
    const tab = fake.addTab({ url: 'https://example.com/a', title: 'A page' });
    const mb = mbOf(tab.id);

    const result = await crypt(tab.id, NOW);

    expect(result).toEqual({ ok: true, changed: true, mb });
    const items = await store.getCrypt();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ url: 'https://example.com/a', title: 'A page', savedAt: NOW });
    expect(items[0]?.id).toBeTruthy();
    expect(fake.tabs.has(tab.id)).toBe(false);
    expect(fake.calls.indexOf('set:tabpire:crypt')).toBeLessThan(fake.calls.indexOf(`remove:${tab.id}`));
    const stats = await store.getStats();
    expect(stats.crypted).toBe(1);
    expect(stats.mbFreed).toBe(mb);
    expect((await store.getLog())[0]).toMatchObject({ action: 'crypt', site: 'example.com' });
  });

  it('does not add a duplicate URL but still closes the tab and counts it', async () => {
    const a = fake.addTab({ url: 'https://example.com/a' });
    const b = fake.addTab({ url: 'https://example.com/a' });
    await crypt(a.id, NOW);
    await crypt(b.id, NOW + 1);
    expect(await store.getCrypt()).toHaveLength(1);
    expect(fake.tabs.size).toBe(0);
    expect((await store.getStats()).crypted).toBe(2);
  });

  it('refuses a tab without a web URL', async () => {
    const tab = fake.addTab({ url: 'chrome://extensions' });
    expect(await crypt(tab.id, NOW)).toEqual({ ok: false, reason: 'no-site' });
    expect(fake.tabs.has(tab.id)).toBe(true);
    expect(await store.getCrypt()).toEqual([]);
    expect(await store.getLog()).toEqual([]);
  });

  it('keeps the tab open when saving fails', async () => {
    const tab = fake.addTab();
    fake.failStorageSet.add('tabpire:crypt');
    expect(await crypt(tab.id, NOW)).toEqual({ ok: false, reason: 'save-failed' });
    expect(fake.tabs.has(tab.id)).toBe(true);
    expect(fake.calls).not.toContain(`remove:${tab.id}`);
    expect((await store.getStats()).crypted).toBe(0);
  });

  it('keeps the saved copy and the tab when closing fails', async () => {
    const tab = fake.addTab();
    fake.failRemove.add('*');
    expect(await crypt(tab.id, NOW)).toEqual({ ok: false, reason: 'browser-error' });
    expect(fake.tabs.has(tab.id)).toBe(true);
    expect(await store.getCrypt()).toHaveLength(1);
    expect((await store.getStats()).crypted).toBe(0);
  });

  it('fails for a missing tab', async () => {
    expect(await crypt(77, NOW)).toEqual({ ok: false, reason: 'no-tab' });
  });
});

describe('garlic and un-garlic', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const stateOfTab = async (id: number) =>
    stateOf(toTabInfo(fake.tabs.get(id) as never) as TabInfo, await store.getGarlic(), NOW);

  it('adds the site, logs it with 0 MB, and protects every tab on that site', async () => {
    const a = fake.addTab({ url: 'https://www.example.com/a', lastAccessed: NOW - 3 * DAY });
    const b = fake.addTab({ url: 'https://example.com/b', lastAccessed: NOW - 3 * DAY });
    expect(await stateOfTab(b.id)).toBe('starving');

    expect(await garlic(a.id, NOW)).toEqual({ ok: true, changed: true, mb: 0 });

    expect(await store.getGarlic()).toEqual(['example.com']);
    expect(await stateOfTab(a.id)).toBe('protected');
    expect(await stateOfTab(b.id)).toBe('protected');
    expect((await store.getStats()).mbFreed).toBe(0);
    expect(await store.getLog()).toEqual([
      { at: NOW, action: 'garlic', site: 'example.com', title: 'Example' },
    ]);
  });

  it('does nothing the second time: no duplicate, no log row', async () => {
    const a = fake.addTab();
    await garlic(a.id, NOW);
    expect(await garlic(a.id, NOW + 1)).toEqual({ ok: true, changed: false, mb: 0 });
    expect(await store.getGarlic()).toEqual(['example.com']);
    expect(await store.getLog()).toHaveLength(1);
  });

  it('refuses tabs without a site or a tab that is gone', async () => {
    const t = fake.addTab({ url: 'about:blank' });
    expect(await garlic(t.id, NOW)).toEqual({ ok: false, reason: 'no-site' });
    expect(await garlic(404, NOW)).toEqual({ ok: false, reason: 'no-tab' });
    expect(await store.getGarlic()).toEqual([]);
    expect(await store.getLog()).toEqual([]);
  });

  it('un-garlic removes the site, logs it with 0 MB, and tabs follow the normal rules again', async () => {
    const a = fake.addTab({ lastAccessed: NOW - 3 * DAY });
    await garlic(a.id, NOW);
    expect(await stateOfTab(a.id)).toBe('protected');

    expect(await ungarlic('example.com', NOW + 1)).toEqual({ ok: true, changed: true, mb: 0 });

    expect(await store.getGarlic()).toEqual([]);
    expect(await stateOfTab(a.id)).toBe('starving');
    const log = await store.getLog();
    expect(log[1]).toEqual({ at: NOW + 1, action: 'ungarlic', site: 'example.com' });
    expect((await store.getStats()).mbFreed).toBe(0);
  });

  it('un-garlic of an unknown site fails and changes nothing', async () => {
    expect(await ungarlic('nope.com', NOW)).toEqual({ ok: false, reason: 'not-found' });
    expect(await store.getLog()).toEqual([]);
  });

  it('un-garlic only removes the named site', async () => {
    await store.setGarlic(['a.com', 'b.com']);
    await ungarlic('a.com', NOW);
    expect(await store.getGarlic()).toEqual(['b.com']);
  });
});

describe('resurrect', () => {
  const saved = (id: string, url: string) => ({ id, url, title: `T ${id}`, savedAt: 1 });

  it('opens a background tab, removes the item, logs it, adds 0 MB', async () => {
    await store.setCrypt([saved('a', 'https://example.com/a'), saved('b', 'https://other.org/')]);

    expect(await resurrect('a', NOW)).toEqual({ ok: true, changed: true, mb: 0 });

    const opened = [...fake.tabs.values()];
    expect(opened).toHaveLength(1);
    expect(opened[0]).toMatchObject({ url: 'https://example.com/a', active: false });
    expect((await store.getCrypt()).map((i) => i.id)).toEqual(['b']);
    expect(await store.getLog()).toEqual([
      { at: NOW, action: 'resurrect', site: 'example.com', title: 'T a' },
    ]);
    expect((await store.getStats()).mbFreed).toBe(0);
  });

  it('opens the tab in the foreground only when asked', async () => {
    await store.setCrypt([saved('a', 'https://example.com/a'), saved('b', 'https://other.org/')]);
    await resurrect('a', NOW, { activate: true });
    await resurrect('b', NOW);
    const tabs = [...fake.tabs.values()];
    expect(tabs.find((t) => t.url === 'https://example.com/a')?.active).toBe(true);
    expect(tabs.find((t) => t.url === 'https://other.org/')?.active).toBe(false);
  });

  it('keeps the item when opening fails', async () => {
    await store.setCrypt([saved('a', 'https://example.com/a')]);
    fake.failCreate = true;
    expect(await resurrect('a', NOW)).toEqual({ ok: false, reason: 'browser-error' });
    expect(await store.getCrypt()).toHaveLength(1);
    expect(await store.getLog()).toEqual([]);
  });

  it('fails for an unknown item', async () => {
    expect(await resurrect('zzz', NOW)).toEqual({ ok: false, reason: 'not-found' });
    expect(fake.calls.some((c) => c.startsWith('create:'))).toBe(false);
  });
});

describe('stats and log', () => {
  it('keeps only the newest 200 log entries', async () => {
    expect(LOG_LIMIT).toBe(200);
    for (let i = 0; i < 205; i++) {
      await recordActions([{ action: 'stake', site: `s${i}.com`, mb: 5 }], { staked: 1 }, i);
    }
    const log = await store.getLog();
    expect(log).toHaveLength(200);
    expect(log[0]?.site).toBe('s5.com');
    expect(log[199]?.site).toBe('s204.com');
    expect((await store.getStats()).staked).toBe(205);
  });

  it('never lets mbFreed go down, even for negative input', async () => {
    await recordActions([{ action: 'stake', site: null, mb: 100 }], {}, 1);
    await recordActions([{ action: 'stake', site: null, mb: -50 }], { staked: -3 }, 2);
    const stats = await store.getStats();
    expect(stats.mbFreed).toBe(100);
    expect(stats.staked).toBe(0);
  });

  it('writes a log entry for every successful action', async () => {
    const t1 = fake.addTab({ url: 'https://a.com/' });
    const t2 = fake.addTab({ url: 'https://b.com/' });
    const t3 = fake.addTab({ url: 'https://c.com/' });
    const t4 = fake.addTab({ url: 'https://d.com/' });
    await stake(t1.id, NOW);
    await coffin(t2.id, NOW);
    await crypt(t3.id, NOW);
    await garlic(t4.id, NOW);
    await ungarlic('d.com', NOW);
    const [item] = await store.getCrypt();
    await resurrect(item!.id, NOW);
    expect((await store.getLog()).map((e) => e.action)).toEqual([
      'stake',
      'coffin',
      'crypt',
      'garlic',
      'ungarlic',
      'resurrect',
    ]);
  });

  it('loses no update when many actions run at once', async () => {
    const ids = Array.from({ length: 10 }, (_, i) =>
      fake.addTab({ url: `https://site${i}.com/` }).id,
    );
    const expectedMb = ids.reduce((sum, id) => sum + mbOf(id), 0);

    const results = await Promise.all(ids.map((id) => stake(id, NOW)));

    expect(results.every((r) => r.ok)).toBe(true);
    const stats = await store.getStats();
    expect(stats.staked).toBe(10);
    expect(stats.mbFreed).toBe(expectedMb);
    expect(await store.getLog()).toHaveLength(10);
  });

  it('loses no update when mixed actions run at once', async () => {
    const a = fake.addTab({ url: 'https://a.com/' });
    const b = fake.addTab({ url: 'https://b.com/' });
    const c = fake.addTab({ url: 'https://c.com/' });
    await Promise.all([stake(a.id, NOW), crypt(b.id, NOW), garlic(c.id, NOW)]);
    const stats = await store.getStats();
    expect(stats.staked).toBe(1);
    expect(stats.crypted).toBe(1);
    expect(await store.getLog()).toHaveLength(3);
    expect(await store.getCrypt()).toHaveLength(1);
    expect(await store.getGarlic()).toEqual(['c.com']);
  });
});

describe('dawn', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const OLD = NOW - 3 * DAY;
  const starving = (over = {}) => fake.addTab({ lastAccessed: OLD, ...over });

  it('closes only starving tabs and leaves every protected kind alone', async () => {
    const hungry1 = starving({ url: 'https://one.com/', title: 'One' });
    const hungry2 = starving({ url: 'https://two.com/', title: 'Two' });
    const active = starving({ url: 'https://active.com/', active: true });
    const pinned = starving({ url: 'https://pinned.com/', pinned: true });
    const audible = starving({ url: 'https://audible.com/', audible: true });
    const asleep = starving({ url: 'https://asleep.com/', discarded: true });
    const garlicTab = starving({ url: 'https://garlic.com/' });
    const internal = starving({ url: 'chrome://extensions' });
    const fresh = fake.addTab({ url: 'https://fresh.com/', lastAccessed: NOW - 1000 });
    await store.setGarlic(['garlic.com']);

    const expectedMb = mbOf(hungry1.id) + mbOf(hungry2.id);
    const result = await dawn(NOW);

    expect(result).toEqual({ ok: true, closed: 2, mb: expectedMb });
    expect([...fake.tabs.keys()].sort()).toEqual(
      [active, pinned, audible, asleep, garlicTab, internal, fresh].map((t) => t.id).sort(),
    );

    const crypted = await store.getCrypt();
    expect(crypted.map((i) => i.url).sort()).toEqual(['https://one.com/', 'https://two.com/']);

    const stats = await store.getStats();
    expect(stats).toMatchObject({ dawns: 1, crypted: 2, mbFreed: expectedMb });
    const log = await store.getLog();
    expect(log.map((e) => e.action)).toEqual(['dawn', 'dawn']);
    expect(log.map((e) => e.site).sort()).toEqual(['one.com', 'two.com']);
  });

  it('saves every tab to the crypt before closing any', async () => {
    starving({ url: 'https://one.com/' });
    starving({ url: 'https://two.com/' });
    starving({ url: 'https://three.com/' });
    await dawn(NOW);
    const firstRemove = fake.calls.findIndex((c) => c.startsWith('remove:'));
    const lastCryptWrite = fake.calls.lastIndexOf('set:tabpire:crypt');
    expect(firstRemove).toBeGreaterThan(-1);
    expect(lastCryptWrite).toBeGreaterThan(-1);
    expect(lastCryptWrite).toBeLessThan(firstRemove);
  });

  it('closes nothing when the crypt write fails', async () => {
    starving({ url: 'https://one.com/' });
    starving({ url: 'https://two.com/' });
    fake.failStorageSet.add('tabpire:crypt');

    expect(await dawn(NOW)).toEqual({ ok: false, reason: 'save-failed' });
    expect(fake.tabs.size).toBe(2);
    expect(fake.calls.some((c) => c.startsWith('remove:'))).toBe(false);
    expect((await store.getStats()).dawns).toBe(0);
    expect(await store.getLog()).toEqual([]);
  });

  it('skips a tab that became active after the first read, and drops its crypt copy', async () => {
    const a = starving({ url: 'https://a.com/' });
    const b = starving({ url: 'https://b.com/' });
    fake.afterQuery = () => {
      fake.tabs.get(a.id)!.active = true;
    };

    const result = await dawn(NOW);

    expect(result).toMatchObject({ ok: true, closed: 1 });
    expect(fake.tabs.has(a.id)).toBe(true);
    expect(fake.tabs.has(b.id)).toBe(false);
    expect((await store.getCrypt()).map((i) => i.url)).toEqual(['https://b.com/']);
    expect((await store.getStats())).toMatchObject({ dawns: 1, crypted: 1 });
    expect(await store.getLog()).toHaveLength(1);
  });

  it.each([
    ['pinned', (t: { pinned: boolean }) => (t.pinned = true)],
    ['audible', (t: { audible: boolean }) => (t.audible = true)],
  ])('skips a tab that became %s after the first read', async (_name, change) => {
    const a = starving({ url: 'https://a.com/' });
    fake.afterQuery = () => change(fake.tabs.get(a.id) as never);
    expect(await dawn(NOW)).toEqual({ ok: true, closed: 0, mb: 0 });
    expect(fake.tabs.has(a.id)).toBe(true);
    expect(await store.getCrypt()).toEqual([]);
    expect((await store.getStats()).dawns).toBe(0);
  });

  it('keeps the crypt copy for a closed tab that shares a URL with a skipped one', async () => {
    const a = starving({ url: 'https://same.com/' });
    starving({ url: 'https://same.com/' });
    fake.afterQuery = () => {
      fake.tabs.get(a.id)!.active = true;
    };
    const result = await dawn(NOW);
    expect(result).toMatchObject({ closed: 1 });
    expect((await store.getCrypt()).map((i) => i.url)).toEqual(['https://same.com/']);
  });

  it('reports a tab that fails to close as not closed', async () => {
    const a = starving({ url: 'https://a.com/' });
    const b = starving({ url: 'https://b.com/' });
    fake.failRemove.add(String(a.id));
    const result = await dawn(NOW);
    expect(result).toMatchObject({ ok: true, closed: 1 });
    expect(fake.tabs.has(a.id)).toBe(true);
    expect(fake.tabs.has(b.id)).toBe(false);
    expect((await store.getStats()).crypted).toBe(1);
  });

  it('does not add a crypt item twice for a URL already saved', async () => {
    await store.setCrypt([{ id: 'x', url: 'https://one.com/', title: 'One', savedAt: 1 }]);
    starving({ url: 'https://one.com/' });
    const result = await dawn(NOW);
    expect(result).toMatchObject({ closed: 1 });
    expect(await store.getCrypt()).toHaveLength(1);
  });

  it('does nothing and writes nothing when no tab is starving', async () => {
    fake.addTab({ lastAccessed: NOW - 1000 });
    fake.addTab({ active: true, lastAccessed: OLD });
    expect(await dawn(NOW)).toEqual({ ok: true, closed: 0, mb: 0 });
    expect(fake.calls).toEqual([]);
    expect(await store.getLog()).toEqual([]);
  });

  it('updates the badge afterwards', async () => {
    starving({ url: 'https://one.com/' });
    starving({ url: 'https://two.com/', pinned: true });
    await dawn(NOW);
    // Badge uses the real clock; both leftover tabs are far past one day old.
    expect(fake.badge.text).toBe('1');
  });
});
