// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('wxt/browser', async () => {
  const m = await import('../helpers/fakeBrowser');
  return { browser: m.browser };
});

import { fake } from '../helpers/fakeBrowser';
import { App } from '../../entrypoints/newtab/App';
import { buildCards, type RawTab } from '../../lib/view';
import { DAY_MS } from '../../lib/hunger';

beforeEach(() => {
  fake.reset();
  const me = fake.addTab({ url: 'chrome-extension://fake-id/newtab.html', active: true });
  fake.currentTabId = me.id;
});
afterEach(cleanup);

describe('hundreds of tabs', () => {
  it('builds and sorts 2000 cards quickly', () => {
    const tabs: RawTab[] = Array.from({ length: 2000 }, (_, i) => ({
      id: i + 1,
      windowId: 1,
      url: `https://site${i % 97}.example.com/page/${i}`,
      title: `Page ${i}`,
      active: false,
      audible: false,
      discarded: i % 7 === 0,
      pinned: false,
      lastAccessed: Date.now() - (i % 11) * DAY_MS,
    }));
    const start = performance.now();
    const cards = buildCards(tabs, undefined, 'chrome-extension://x/', ['site3.example.com'], Date.now());
    expect(cards).toHaveLength(2000);
    expect(performance.now() - start).toBeLessThan(500);
  });

  it('shows a card for each of 300 open tabs', async () => {
    for (let i = 0; i < 300; i++) {
      fake.addTab({ url: `https://site${i}.example.com/`, title: `Tab ${i}`, lastAccessed: Date.now() - (i % 6) * DAY_MS });
    }
    const start = performance.now();
    render(<App />);
    await waitFor(() => expect(document.querySelectorAll('.card:not(.card-skeleton)').length).toBe(300), { timeout: 10_000 });
    console.log('300 cards rendered in', Math.round(performance.now() - start), 'ms (jsdom)');
    expect(screen.getByText('Open tabs').closest('div')!.textContent).toContain('300');
  }, 30_000);
});
