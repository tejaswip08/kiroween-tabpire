import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('wxt/browser', async () => {
  const m = await import('./helpers/fakeBrowser');
  return { browser: m.browser };
});

import { events, fake } from './helpers/fakeBrowser';
import { BADGE_ALARM, refreshBadge, setupBadgeUpdates } from '../lib/badge';
import { store } from '../lib/store';
import { stake, garlic } from '../lib/tabs';

const NOW = 1_700_000_000_000;
const DAY = 24 * 60 * 60 * 1000;
const hungry = (over = {}) => fake.addTab({ lastAccessed: NOW - 3 * DAY, ...over });

beforeEach(() => fake.reset());

describe('refreshBadge', () => {
  it('is empty when nothing is starving', async () => {
    fake.addTab({ lastAccessed: NOW - 1000 });
    await refreshBadge(NOW);
    expect(fake.badge.text).toBe('');
  });

  it('shows the number of starving tabs', async () => {
    hungry();
    hungry();
    hungry({ pinned: true }); // starving by state, so the badge counts it
    hungry({ active: true });
    await refreshBadge(NOW);
    expect(fake.badge.text).toBe('3');
  });

  it('shows 999+ above 999', async () => {
    for (let i = 0; i < 1000; i++) hungry({ url: `https://s${i}.com/` });
    await refreshBadge(NOW);
    expect(fake.badge.text).toBe('999+');
    hungry();
    await refreshBadge(NOW);
    expect(fake.badge.text).toBe('999+');
  });

  it('does not count garlic sites', async () => {
    hungry({ url: 'https://safe.com/' });
    hungry({ url: 'https://other.com/' });
    await store.setGarlic(['safe.com']);
    await refreshBadge(NOW);
    expect(fake.badge.text).toBe('1');
  });
});

describe('actions refresh the badge', () => {
  it('after a stake', async () => {
    const a = hungry({ url: 'https://a.com/', lastAccessed: Date.now() - 3 * DAY });
    hungry({ url: 'https://b.com/', lastAccessed: Date.now() - 3 * DAY });
    await stake(a.id);
    expect(fake.badge.text).toBe('1');
  });

  it('after a garlic', async () => {
    const a = hungry({ url: 'https://a.com/', lastAccessed: Date.now() - 3 * DAY });
    await garlic(a.id);
    expect(fake.badge.text).toBe('');
  });

  it('a failing refresh does not break an action', async () => {
    const a = fake.addTab();
    fake.failBadge = true;
    const result = await stake(a.id, NOW);
    expect(result.ok).toBe(true);
    expect(fake.tabs.has(a.id)).toBe(false);
  });
});

describe('setupBadgeUpdates', () => {
  it('creates a one-minute alarm and registers the listeners', async () => {
    setupBadgeUpdates();
    expect(fake.alarms).toEqual([{ name: BADGE_ALARM, info: { periodInMinutes: 1 } }]);
    expect(events.onAlarm.listeners).toHaveLength(1);
    expect(events.onInstalled.listeners).toHaveLength(1);
    expect(events.onStartup.listeners).toHaveLength(1);
  });

  it('refreshes at load, on alarm, install and startup, and ignores other alarms', async () => {
    const tick = () => new Promise((r) => setTimeout(r, 0));
    setupBadgeUpdates();
    await tick();
    expect(fake.badge.text).toBe(''); // refreshed at load

    hungry({ lastAccessed: Date.now() - 3 * DAY });
    events.onAlarm.listeners[0]?.({ name: 'something-else' });
    await tick();
    expect(fake.badge.text).toBe('');

    events.onAlarm.listeners[0]?.({ name: BADGE_ALARM });
    await tick();
    expect(fake.badge.text).toBe('1');

    fake.badge.text = undefined;
    events.onInstalled.listeners[0]?.();
    await tick();
    expect(fake.badge.text).toBe('1');

    fake.badge.text = undefined;
    events.onStartup.listeners[0]?.();
    await tick();
    expect(fake.badge.text).toBe('1');
  });

  it('survives a failing refresh', async () => {
    fake.failBadge = true;
    expect(() => setupBadgeUpdates()).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
  });
});

describe('entrypoints/background.ts', () => {
  it('only wires up the badge updates', () => {
    const text = readFileSync(
      fileURLToPath(new URL('../entrypoints/background.ts', import.meta.url)),
      'utf8',
    );
    expect(text).toContain('defineBackground');
    expect(text).toContain('setupBadgeUpdates()');
  });
});
