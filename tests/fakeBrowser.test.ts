// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { browser, events, fake } from './helpers/fakeBrowser';

beforeEach(() => fake.reset());
afterEach(() => vi.restoreAllMocks());

describe('fake tabs', () => {
  it('get returns a copy and rejects unknown ids', async () => {
    const t = fake.addTab({ title: 'A' });
    const got = await browser.tabs.get(t.id);
    expect(got).toEqual(t);
    got.title = 'changed';
    expect(fake.tabs.get(t.id)?.title).toBe('A');
    await expect(browser.tabs.get(999)).rejects.toThrow();
  });

  it('getCurrent follows currentTabId', async () => {
    expect(await browser.tabs.getCurrent()).toBeUndefined();
    const t = fake.addTab();
    fake.currentTabId = t.id;
    expect((await browser.tabs.getCurrent())?.id).toBe(t.id);
  });

  it('query lists all tabs and fails on request', async () => {
    fake.addTab();
    fake.addTab();
    expect(await browser.tabs.query({})).toHaveLength(2);
    fake.failQuery = true;
    await expect(browser.tabs.query({})).rejects.toThrow();
  });

  it('update changes url and active, by id or on the current tab', async () => {
    const a = fake.addTab();
    const b = fake.addTab();
    fake.currentTabId = b.id;
    await browser.tabs.update(a.id, { url: 'https://a.test/', active: true });
    expect(fake.tabs.get(a.id)).toMatchObject({ url: 'https://a.test/', active: true });
    await browser.tabs.update({ url: 'https://b.test/' });
    expect(fake.tabs.get(b.id)?.url).toBe('https://b.test/');
    await expect(browser.tabs.update(999, { url: 'x' })).rejects.toThrow();
  });

  it('remove deletes, logs, and honours failure switches', async () => {
    const a = fake.addTab();
    const b = fake.addTab();
    await browser.tabs.remove(a.id);
    expect(fake.tabs.has(a.id)).toBe(false);
    expect(fake.calls).toContain(`remove:${a.id}`);
    fake.failRemove.add(String(b.id));
    await expect(browser.tabs.remove(b.id)).rejects.toThrow();
    expect(fake.tabs.has(b.id)).toBe(true);
    await expect(browser.tabs.remove(999)).rejects.toThrow();
  });

  it('discard marks the tab discarded', async () => {
    const a = fake.addTab();
    await browser.tabs.discard(a.id);
    expect(fake.tabs.get(a.id)?.discarded).toBe(true);
    fake.failDiscard.add('*');
    await expect(browser.tabs.discard(a.id)).rejects.toThrow();
  });

  it('create adds an active tab and honours failCreate', async () => {
    const t = await browser.tabs.create({ url: 'https://c.test/' });
    expect(fake.tabs.get(t!.id)).toMatchObject({ url: 'https://c.test/', active: true });
    fake.failCreate = true;
    await expect(browser.tabs.create({ url: 'x' })).rejects.toThrow();
  });

  it('intercept skips update and create but the call is logged', async () => {
    const a = fake.addTab({ url: 'https://a.test/' });
    fake.intercept = () => true;
    await browser.tabs.update(a.id, { url: 'https://other.test/' });
    expect(fake.tabs.get(a.id)?.url).toBe('https://a.test/');
    expect(await browser.tabs.create({ url: 'https://n.test/' })).toBeUndefined();
    expect(fake.tabs.size).toBe(1);
    expect(fake.calls).toHaveLength(2);
  });
});

describe('fake misc APIs', () => {
  it('alarms.create replaces by name', () => {
    browser.alarms.create('a', { periodInMinutes: 1 });
    browser.alarms.create('b', {});
    browser.alarms.create('a', { periodInMinutes: 5 });
    expect(fake.alarms).toHaveLength(2);
    expect(fake.alarms.find((x) => x.name === 'a')?.info).toEqual({ periodInMinutes: 5 });
  });

  it('search.query records, calls onSearch and never calls fetch', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const seen: string[] = [];
    fake.onSearch = (i) => seen.push(i.text);
    await browser.search.query({ text: 'cats', disposition: 'CURRENT_TAB' });
    expect(fake.searches).toEqual([{ text: 'cats', disposition: 'CURRENT_TAB' }]);
    expect(seen).toEqual(['cats']);
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('runtime.getURL joins extensionBase and drops a leading slash', () => {
    expect(browser.runtime.getURL('newtab.html')).toBe('chrome-extension://fake-id/newtab.html');
    expect(browser.runtime.getURL('/newtab.html')).toBe('chrome-extension://fake-id/newtab.html');
    expect(browser.runtime.getURL('')).toBe('chrome-extension://fake-id/');
    fake.extensionBase = 'tabpire-demo://app/';
    expect(browser.runtime.getURL('x')).toBe('tabpire-demo://app/x');
  });

  it('clearData keeps listeners and switches, reset removes them', async () => {
    const l = vi.fn();
    events.onStorageChanged.addListener(l);
    fake.failCreate = true;
    fake.addTab();
    await browser.storage.local.set({ k: 1 });
    fake.clearData();
    expect(fake.tabs.size).toBe(0);
    expect(fake.storage.size).toBe(0);
    expect(fake.calls).toHaveLength(0);
    expect(fake.nextId).toBe(1);
    expect(events.onStorageChanged.listeners).toHaveLength(1);
    expect(fake.failCreate).toBe(true);
    fake.reset();
    expect(events.onStorageChanged.listeners).toHaveLength(0);
    expect(fake.failCreate).toBe(false);
  });

  it('a throwing listener does not stop the others', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const second = vi.fn();
    events.onStorageChanged.addListener(() => {
      throw new Error('boom');
    });
    events.onStorageChanged.addListener(second);
    await browser.storage.local.set({ k: 1 });
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('storage.onChanged carries oldValue on overwrite', async () => {
    const seen: unknown[] = [];
    events.onStorageChanged.addListener((c) => seen.push(c));
    await browser.storage.local.set({ k: 1 });
    await browser.storage.local.set({ k: 2 });
    expect(seen).toEqual([{ k: { newValue: 1 } }, { k: { oldValue: 1, newValue: 2 } }]);
  });

  it('uses no browser storage, IndexedDB or cookies', async () => {
    const proto = vi.spyOn(Storage.prototype, 'setItem');
    const protoGet = vi.spyOn(Storage.prototype, 'getItem');
    const cookieGet = vi.fn(() => '');
    const cookieSet = vi.fn();
    const idb = vi.fn(() => ({}));
    Object.defineProperty(document, 'cookie', { configurable: true, get: cookieGet, set: cookieSet });
    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, get: idb });
    try {
      fake.autoEvents = true;
      const t = (await browser.tabs.create({ url: 'https://a.test/' }))!;
      await browser.tabs.update(t.id, { url: 'https://b.test/' });
      await browser.tabs.discard(t.id);
      await browser.tabs.remove(t.id);
      await browser.storage.local.set({ a: 1 });
      await browser.storage.local.get('a');
      await browser.search.query({ text: 'x' });
      fake.clearData();
      fake.reset();
      expect(proto).not.toHaveBeenCalled();
      expect(protoGet).not.toHaveBeenCalled();
      expect(cookieGet).not.toHaveBeenCalled();
      expect(cookieSet).not.toHaveBeenCalled();
      expect(idb).not.toHaveBeenCalled();
    } finally {
      delete (globalThis as { indexedDB?: unknown }).indexedDB;
      delete (document as { cookie?: unknown }).cookie;
    }
  });
});

describe('properties', () => {
  // Feature: web-demo, Property 3: Storage events and round trip
  // **Validates: Requirements 3.3**
  it('Property 3: storage events and round trip', async () => {
    const keys = fc.constantFrom('a', 'b', 'c', 'd');
    const batch = fc.dictionary(keys, fc.jsonValue(), { minKeys: 1 });
    await fc.assert(
      fc.asyncProperty(fc.array(batch, { minLength: 1, maxLength: 12 }), async (batches) => {
        fake.reset();
        const changes: Record<string, { oldValue?: unknown; newValue: unknown }>[] = [];
        events.onStorageChanged.addListener((c, area) => {
          expect(area).toBe('local');
          changes.push(c as never);
        });
        const model = new Map<string, unknown>();
        for (const items of batches) {
          const before = changes.length;
          await browser.storage.local.set(items);
          const fired = changes.slice(before);
          expect(fired).toHaveLength(Object.keys(items).length);
          for (const [k, v] of Object.entries(items)) {
            const c = fired.find((f) => k in f)![k]!;
            expect(c.newValue).toEqual(v);
            if (model.has(k)) expect(c.oldValue).toEqual(model.get(k));
            else expect('oldValue' in c).toBe(false);
            model.set(k, v);
          }
        }
        for (const [k, v] of model) expect((await browser.storage.local.get(k))[k]).toEqual(v);
      }),
      { numRuns: 100 },
    );
  });

  // Feature: web-demo, Property 4: Tab events match tab changes
  // **Validates: Requirements 3.4**
  it('Property 4: tab events match tab changes', async () => {
    type Op =
      | { k: 'create'; fail: boolean }
      | { k: 'remove' | 'discard' | 'update'; i: number; fail: boolean; url: string };
    const op: fc.Arbitrary<Op> = fc.oneof(
      fc.record({ k: fc.constant('create' as const), fail: fc.boolean() }),
      fc.record({
        k: fc.constantFrom('remove' as const, 'discard' as const, 'update' as const),
        i: fc.nat(10),
        fail: fc.boolean(),
        url: fc.constantFrom('https://a.test/', 'https://b.test/'),
      }),
    );
    await fc.assert(
      fc.asyncProperty(fc.array(op, { maxLength: 25 }), async (ops) => {
        fake.reset();
        fake.autoEvents = true;
        const log: string[] = [];
        events.onCreated.addListener(() => log.push('created'));
        events.onRemoved.addListener(() => log.push('removed'));
        events.onUpdated.addListener((_id, info) =>
          log.push((info as { discarded?: boolean }).discarded ? 'discarded' : 'updated'),
        );
        const model = new Map<number, { url?: string; discarded: boolean }>();
        let nextId = 1;
        for (const o of ops) {
          const before = log.length;
          const ids = [...model.keys()];
          // Pick an id that exists or, when i is past the end, one that does not.
          const id = o.k === 'create' ? 0 : o.i < ids.length ? ids[o.i]! : 9999;
          const exists = model.has(id);
          let expected: string | undefined;
          let ok = true;
          try {
            if (o.k === 'create') {
              fake.failCreate = o.fail;
              await browser.tabs.create({ url: 'https://new.test/' });
              if (!o.fail) {
                model.set(nextId++, { url: 'https://new.test/', discarded: false });
                expected = 'created';
              }
              ok = !o.fail;
            } else if (o.k === 'remove') {
              fake.failRemove = new Set(o.fail ? ['*'] : []);
              await browser.tabs.remove(id);
              model.delete(id);
              expected = 'removed';
            } else if (o.k === 'discard') {
              fake.failDiscard = new Set(o.fail ? ['*'] : []);
              await browser.tabs.discard(id);
              model.get(id)!.discarded = true;
              expected = 'discarded';
            } else {
              await browser.tabs.update(id, { url: o.url });
              model.get(id)!.url = o.url;
              expected = 'updated';
            }
          } catch {
            ok = false;
          }
          if (o.k === 'create') expect(ok).toBe(!o.fail);
          else expect(ok).toBe(exists && !(o.fail && o.k !== 'update'));
          expect(log.slice(before)).toEqual(ok && expected ? [expected] : []);
        }
        expect([...fake.tabs.keys()].sort()).toEqual([...model.keys()].sort());
        for (const [id, m] of model) {
          expect(fake.tabs.get(id)).toMatchObject({ url: m.url, discarded: m.discarded });
        }
      }),
      { numRuns: 100 },
    );
  });
});
