import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('wxt/browser', async () => {
  const m = await import('./helpers/fakeBrowser');
  return { browser: m.browser };
});

import { browser, fake } from './helpers/fakeBrowser';
import { openInThisTab, searchWithDefaultEngine, showTab } from '../lib/nav';

beforeEach(() => fake.reset());

describe('searchWithDefaultEngine', () => {
  it('uses the Chrome search API in this tab', async () => {
    await searchWithDefaultEngine('  cute bats ');
    expect(fake.searches).toEqual([{ text: 'cute bats', disposition: 'CURRENT_TAB' }]);
  });

  it('uses the Firefox search API when it exists', async () => {
    const calls: unknown[] = [];
    const current = fake.addTab({ url: 'about:newtab' });
    fake.currentTabId = current.id;
    const api = browser.search as unknown as Record<string, unknown>;
    const original = api.query;
    delete api.query;
    api.search = async (info: unknown) => void calls.push(info);
    try {
      await searchWithDefaultEngine('bats');
      expect(calls).toEqual([{ query: 'bats', tabId: current.id }]);
    } finally {
      delete api.search;
      api.query = original;
    }
  });

  it('ignores blank text', async () => {
    await searchWithDefaultEngine('   ');
    expect(fake.searches).toEqual([]);
  });
});

describe('openInThisTab', () => {
  it('changes the address of the current tab', async () => {
    const current = fake.addTab({ url: 'chrome://newtab/' });
    fake.currentTabId = current.id;
    await openInThisTab('https://example.com/');
    expect(fake.tabs.get(current.id)?.url).toBe('https://example.com/');
  });
});

describe('showTab', () => {
  it('activates the tab and focuses its window', async () => {
    const other = fake.addTab({ windowId: 4 });
    await showTab({ id: other.id, windowId: 4 });
    expect(fake.tabs.get(other.id)?.active).toBe(true);
    expect(fake.focusedWindows).toEqual([4]);
  });

  it('skips focusing when the window is unknown', async () => {
    const other = fake.addTab();
    await showTab({ id: other.id, windowId: -1 });
    expect(fake.focusedWindows).toEqual([]);
  });
});
