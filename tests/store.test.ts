import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const data = new Map<string, unknown>();

vi.mock('wxt/browser', () => ({
  browser: {
    storage: {
      local: {
        get: async (key: string) => (data.has(key) ? { [key]: data.get(key) } : {}),
        set: async (items: Record<string, unknown>) => {
          for (const [k, v] of Object.entries(items)) data.set(k, v);
        },
      },
    },
  },
}));

import { KEYS, store, transact } from '../lib/store';

beforeEach(() => data.clear());

describe('store defaults', () => {
  it('returns defaults when empty', async () => {
    expect(await store.getStats()).toEqual({
      staked: 0,
      coffined: 0,
      crypted: 0,
      dawns: 0,
      mbFreed: 0,
    });
    expect(await store.getLog()).toEqual([]);
    expect(await store.getCrypt()).toEqual([]);
    expect(await store.getGarlic()).toEqual([]);
    expect(await store.getHaunts()).toEqual([]);
    expect(await store.getTheme()).toBe('crypt');
  });
});

describe('store round trips', () => {
  it('stats', async () => {
    const v = { staked: 1, coffined: 2, crypted: 3, dawns: 4, mbFreed: 500 };
    await store.setStats(v);
    expect(await store.getStats()).toEqual(v);
  });
  it('log', async () => {
    const v = [{ at: 1, action: 'stake' as const, site: 'example.com', title: 'Hi' }];
    await store.setLog(v);
    expect(await store.getLog()).toEqual(v);
  });
  it('crypt', async () => {
    const v = [{ id: 'a', url: 'https://example.com', title: 'Ex', savedAt: 5 }];
    await store.setCrypt(v);
    expect(await store.getCrypt()).toEqual(v);
  });
  it('garlic', async () => {
    await store.setGarlic(['example.com']);
    expect(await store.getGarlic()).toEqual(['example.com']);
  });
  it('pinned', async () => {
    const v = [{ url: 'https://example.com', title: 'Ex' }];
    await store.setHaunts(v);
    expect(await store.getHaunts()).toEqual(v);
  });
  it('theme', async () => {
    await store.setTheme('moon');
    expect(await store.getTheme()).toBe('moon');
  });
});

describe('store bad data', () => {
  it('returns defaults for wrong-shaped values', async () => {
    data.set(KEYS.stats, { staked: 'lots' });
    data.set(KEYS.log, 'nope');
    data.set(KEYS.crypt, [{ id: 1 }]);
    data.set(KEYS.garlic, 42);
    data.set(KEYS.haunts, [null]);
    data.set(KEYS.theme, 7);
    expect((await store.getStats()).staked).toBe(0);
    expect(await store.getLog()).toEqual([]);
    expect(await store.getCrypt()).toEqual([]);
    expect(await store.getGarlic()).toEqual([]);
    expect(await store.getHaunts()).toEqual([]);
    expect(await store.getTheme()).toBe('crypt');
  });
});

describe('transact', () => {
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  async function overlapRun() {
    let running = 0;
    let maxRunning = 0;
    const order: number[] = [];
    const job = (n: number, fail = false) =>
      transact(async () => {
        running++;
        maxRunning = Math.max(maxRunning, running);
        await sleep(5);
        order.push(n);
        running--;
        if (fail) throw new Error('boom');
      });
    const results = await Promise.allSettled([job(1), job(2, true), job(3), job(4)]);
    return { maxRunning, order, results };
  }

  it('runs overlapping transactions one at a time, even after one throws', async () => {
    const { maxRunning, order, results } = await overlapRun();
    expect(maxRunning).toBe(1);
    expect(order).toEqual([1, 2, 3, 4]);
    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'rejected', 'fulfilled', 'fulfilled']);
  });

  it('works without Web Locks', async () => {
    vi.stubGlobal('navigator', {});
    try {
      const { maxRunning, order } = await overlapRun();
      expect(maxRunning).toBe(1);
      expect(order).toEqual([1, 2, 3, 4]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('returns the value of fn', async () => {
    expect(await transact(async () => 7)).toBe(7);
  });
});

// ---------- source checks ----------

const root = fileURLToPath(new URL('..', import.meta.url));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

describe('storage and network boundaries', () => {
  it('only lib/store.ts mentions storage.local', () => {
    const files = [...sourceFiles(join(root, 'lib')), ...sourceFiles(join(root, 'entrypoints'))];
    const offenders = files.filter(
      (f) => !f.endsWith(join('lib', 'store.ts')) && readFileSync(f, 'utf8').includes('storage.local'),
    );
    expect(offenders).toEqual([]);
  });

  it.each(['storage.sync', 'fetch(', 'XMLHttpRequest'])('store.ts does not use %s', (banned) => {
    const text = readFileSync(join(root, 'lib', 'store.ts'), 'utf8');
    expect(text).not.toContain(banned);
  });
});

describe('haunts and the log keep working with data from before the rename', () => {
  it('reads haunts saved under the old key, and prefers the new key', async () => {
    data.set(KEYS.legacyPinned, [{ url: 'https://old.com/', title: 'Old' }]);
    expect(await store.getHaunts()).toEqual([{ url: 'https://old.com/', title: 'Old' }]);
    await store.setHaunts([{ url: 'https://new.com/', title: 'New' }]);
    expect(await store.getHaunts()).toEqual([{ url: 'https://new.com/', title: 'New' }]);
  });
  it("reads an old 'ungarlic' log entry as 'garlic'", async () => {
    data.set(KEYS.log, [{ at: 1, action: 'ungarlic', site: 'a.com' }]);
    expect(await store.getLog()).toEqual([{ at: 1, action: 'garlic', site: 'a.com' }]);
  });
  it('drops a log with an unknown action', async () => {
    data.set(KEYS.log, [{ at: 1, action: 'explode', site: null }]);
    expect(await store.getLog()).toEqual([]);
  });
});
