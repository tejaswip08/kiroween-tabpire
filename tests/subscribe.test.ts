import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('wxt/browser', async () => {
  const m = await import('./helpers/fakeBrowser');
  return { browser: m.browser };
});

import { events, fake } from './helpers/fakeBrowser';
import { store, subscribe } from '../lib/store';

beforeEach(() => fake.reset());

describe('subscribe', () => {
  it('reports changed Tabpire keys from local storage', async () => {
    const seen: string[][] = [];
    subscribe((keys) => seen.push(keys));
    await store.setGarlic(['a.com']);
    await store.setTheme('crypt');
    expect(seen).toEqual([['tabpire:garlic'], ['tabpire:theme']]);
  });

  it('ignores other keys and other storage areas', () => {
    const seen: string[][] = [];
    subscribe((keys) => seen.push(keys));
    const [handler] = events.onStorageChanged.listeners;
    handler?.({ 'other:key': {} }, 'local');
    handler?.({ 'tabpire:stats': {} }, 'sync');
    handler?.({ 'tabpire:stats': {}, 'other:key': {} }, 'local');
    expect(seen).toEqual([['tabpire:stats']]);
  });

  it('stops after unsubscribe', async () => {
    const seen: string[][] = [];
    const off = subscribe((keys) => seen.push(keys));
    off();
    await store.setGarlic(['a.com']);
    expect(seen).toEqual([]);
    expect(events.onStorageChanged.listeners).toHaveLength(0);
  });
});
