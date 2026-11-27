import { beforeEach, describe, expect, it, vi } from 'vitest';
type Listener = (changes: Record<string, unknown>, area: string) => void;
const h = vi.hoisted(() => ({
  local: new Map<string, unknown>(),
  sync: new Map<string, unknown>(),
  failSync: false,
  hasSync: true,
  listeners: [] as unknown[],
}));
const area = (data: Map<string, unknown>, isSync: boolean) => ({
  get: async (keys: string | string[]) => {
    if (isSync && h.failSync) throw new Error('sync off');
    const out: Record<string, unknown> = {};
    for (const k of Array.isArray(keys) ? keys : [keys]) if (data.has(k)) out[k] = data.get(k);
    return out;
  },
  set: async (items: Record<string, unknown>) => {
    if (isSync && h.failSync) throw new Error('QUOTA_BYTES_PER_ITEM quota exceeded');
    for (const [k, v] of Object.entries(items)) data.set(k, v);
  },
  remove: async (key: string) => void data.delete(key),
});
vi.mock('wxt/browser', () => ({
  browser: {
    storage: {
      local: area(h.local, false),
      get sync() {
        return h.hasSync ? area(h.sync, true) : undefined;
      },
      onChanged: {
        addListener: (f: unknown) => void h.listeners.push(f),
        removeListener: (f: unknown) => void h.listeners.splice(h.listeners.indexOf(f), 1),
      },
    },
  },
}));
const load = async () => {
  vi.resetModules();
  return import('../lib/store');
};
beforeEach(() => {
  h.local.clear();
  h.sync.clear();
  h.failSync = false;
  h.hasSync = true;
  h.listeners.length = 0;
});
const haunts = [{ url: 'https://a.com/', title: 'A' }];
describe('sync: migration', () => {
  it('copies existing local settings to sync once and keeps other data local', async () => {
    h.local.set('tabpire:theme', 'pumpkin');
    h.local.set('tabpire:haunts', haunts);
    h.local.set('tabpire:garlic', ['x.com']);
    h.local.set('tabpire:crypt', [{ id: '1', url: 'https://c.com/', title: 'C', savedAt: 1 }]);
    const { store } = await load();
    expect(await store.getTheme()).toBe('pumpkin');
    expect(h.sync.get('tabpire:theme')).toBe('pumpkin');
    expect(h.sync.get('tabpire:haunts')).toEqual(haunts);
    expect(h.sync.get('tabpire:garlic')).toEqual(['x.com']);
    expect(h.local.has('tabpire:theme')).toBe(false);
    expect(h.local.get('tabpire:sync-migrated')).toBe(true);
    expect(h.local.has('tabpire:crypt')).toBe(true);
    expect(h.sync.has('tabpire:crypt')).toBe(false);
  });
  it('moves haunts saved under the old key', async () => {
    h.local.set('tabpire:pinned', haunts);
    const { store } = await load();
    expect(await store.getHaunts()).toEqual(haunts);
    expect(h.sync.get('tabpire:haunts')).toEqual(haunts);
  });
  it('does not overwrite a value another device already synced', async () => {
    h.local.set('tabpire:theme', 'pumpkin');
    h.sync.set('tabpire:theme', 'frost');
    const { store } = await load();
    expect(await store.getTheme()).toBe('frost');
    expect(h.sync.get('tabpire:theme')).toBe('frost');
  });
  it('runs once: later local values are not copied again', async () => {
    const { store } = await load();
    await store.getTheme();
    h.local.set('tabpire:theme', 'forest');
    h.sync.set('tabpire:theme', 'frost');
    const again = await load();
    expect(await again.store.getTheme()).toBe('forest'); // local fallback copy is read first
    expect(h.sync.get('tabpire:theme')).toBe('frost');
  });
  it('keeps local values and retries when sync fails', async () => {
    h.local.set('tabpire:theme', 'pumpkin');
    h.failSync = true;
    const first = await load();
    expect(await first.store.getTheme()).toBe('pumpkin');
    expect(h.local.get('tabpire:theme')).toBe('pumpkin');
    expect(h.local.has('tabpire:sync-migrated')).toBe(false);
    h.failSync = false;
    const second = await load();
    expect(await second.store.getTheme()).toBe('pumpkin');
    expect(h.sync.get('tabpire:theme')).toBe('pumpkin');
    expect(h.local.get('tabpire:sync-migrated')).toBe(true);
  });
});
describe('sync: reads and writes', () => {
  it('writes settings to sync and not to local', async () => {
    const { store } = await load();
    await store.setTheme('frost');
    await store.setGarlic(['g.com']);
    await store.setHaunts(haunts);
    expect(h.sync.get('tabpire:theme')).toBe('frost');
    expect(h.sync.get('tabpire:garlic')).toEqual(['g.com']);
    expect(h.sync.get('tabpire:haunts')).toEqual(haunts);
    expect(h.local.has('tabpire:theme')).toBe(false);
    expect(await store.getTheme()).toBe('frost');
  });
  it('keeps stats, log and crypt in local', async () => {
    const { store } = await load();
    await store.setStats({ staked: 1, coffined: 0, crypted: 0, dawns: 0, mbFreed: 5 });
    await store.setCrypt([]);
    await store.setLog([]);
    expect([...h.sync.keys()]).toEqual([]);
    expect(h.local.has('tabpire:stats')).toBe(true);
  });
});
describe('sync: fallback to local', () => {
  it('stores in local without throwing when a sync write fails', async () => {
    const { store } = await load();
    h.failSync = true;
    await expect(store.setTheme('forest')).resolves.toBeUndefined();
    expect(h.local.get('tabpire:theme')).toBe('forest');
    expect(await store.getTheme()).toBe('forest');
  });
  it('a later successful write moves the value back to sync', async () => {
    const { store } = await load();
    h.failSync = true;
    await store.setGarlic(['a.com']);
    h.failSync = false;
    await store.setGarlic(['a.com', 'b.com']);
    expect(h.sync.get('tabpire:garlic')).toEqual(['a.com', 'b.com']);
    expect(h.local.has('tabpire:garlic')).toBe(false);
    expect(await store.getGarlic()).toEqual(['a.com', 'b.com']);
  });
  it('uses local when the browser has no sync area', async () => {
    h.hasSync = false;
    const { store } = await load();
    await store.setHaunts(haunts);
    expect(h.local.get('tabpire:haunts')).toEqual(haunts);
    expect(await store.getHaunts()).toEqual(haunts);
  });
  it('gives defaults when sync cannot be read', async () => {
    const { store } = await load();
    h.failSync = true;
    expect(await store.getTheme()).toBe('crypt');
    expect(await store.getGarlic()).toEqual([]);
  });
});
describe('sync: onChanged', () => {
  it('reports synced settings changed on another device', async () => {
    const { onStoreChange } = await load();
    const seen: string[][] = [];
    onStoreChange((k) => seen.push(k));
    const fire = h.listeners[0] as Listener;
    fire({ 'tabpire:theme': { newValue: 'frost' } }, 'sync');
    fire({ 'tabpire:haunts': {}, 'tabpire:garlic': {} }, 'sync');
    expect(seen).toEqual([['tabpire:theme'], ['tabpire:haunts', 'tabpire:garlic']]);
  });
  it('ignores unsynced keys and other keys in the sync area, and other areas', async () => {
    const { onStoreChange } = await load();
    const seen: string[][] = [];
    onStoreChange((k) => seen.push(k));
    const fire = h.listeners[0] as Listener;
    fire({ 'tabpire:crypt': {} }, 'sync');
    fire({ 'other:key': {} }, 'sync');
    fire({ 'tabpire:theme': {} }, 'managed');
    expect(seen).toEqual([]);
  });
  it('makes the theme read return the value from the other device', async () => {
    const { store, onStoreChange } = await load();
    await store.setTheme('crypt');
    const seen: string[] = [];
    onStoreChange(async (keys) => {
      if (keys.includes('tabpire:theme')) seen.push(await store.getTheme());
    });
    h.sync.set('tabpire:theme', 'frost');
    (h.listeners[0] as Listener)({ 'tabpire:theme': { newValue: 'frost' } }, 'sync');
    await vi.waitFor(() => expect(seen).toEqual(['frost']));
  });
});
