// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('wxt/browser', async () => {
  const m = await import('../helpers/fakeBrowser');
  return { browser: m.browser };
});
const fetchGoogle = vi.hoisted(() => vi.fn());
vi.mock('../../lib/google', () => ({ fetchGoogleSuggestions: fetchGoogle }));

import { fake } from '../helpers/fakeBrowser';
import { App } from '../../entrypoints/newtab/App';
import { store } from '../../lib/store';

const pick = async (kind: string) => {
  const option = await waitFor(() => {
    const el = screen.getAllByRole('option').find((o) => o.getAttribute('data-kind') === kind);
    if (!el) throw new Error(`no ${kind} option`);
    return el;
  });
  await userEvent.click(option);
};

let me: number;
beforeEach(() => {
  fake.reset();
  fetchGoogle.mockReset().mockResolvedValue([]);
  const tab = fake.addTab({ url: 'chrome-extension://fake-id/newtab.html', title: 'Tabpire', active: true });
  me = tab.id;
  fake.currentTabId = me;
});
afterEach(cleanup);

describe('search box in the page', () => {
  it('Enter searches with the default engine', async () => {
    render(<App />);
    await userEvent.type(screen.getByRole('combobox'), 'cute bats{Enter}');
    expect(fake.searches).toEqual([{ text: 'cute bats', disposition: 'CURRENT_TAB' }]);
  });

  it('an open tab suggestion switches to that tab and its window', async () => {
    const other = fake.addTab({ title: 'Weather today', url: 'https://weather.example/', windowId: 9 });
    render(<App />);
    await screen.findByRole('heading', { level: 3, name: 'Weather today' });
    await userEvent.type(screen.getByRole('combobox'), 'weather');
    await pick('tab');
    expect(fake.tabs.get(other.id)?.active).toBe(true);
    expect(fake.focusedWindows).toEqual([9]);
  });

  it('a pinned page suggestion opens in this tab', async () => {
    await store.setPinned([{ url: 'https://catpics.example/', title: 'Cat pics' }]);
    render(<App />);
    await waitFor(async () => expect((await store.getPinned()).length).toBe(1));
    const input = screen.getByRole('combobox');
    await waitFor(async () => {
      await userEvent.clear(input);
      await userEvent.type(input, 'cat pics');
      expect(screen.getAllByRole('option').some((o) => o.getAttribute('data-kind') === 'pinned')).toBe(true);
    });
    await pick('pinned');
    expect(fake.tabs.get(me)?.url).toBe('https://catpics.example/');
  });

  it('a crypt suggestion reopens the page in the foreground and removes it from the crypt', async () => {
    await store.setCrypt([{ id: 'c1', url: 'https://old.example/story', title: 'Old story', savedAt: 1 }]);
    render(<App />);
    const input = screen.getByRole('combobox');
    await waitFor(async () => {
      await userEvent.clear(input);
      await userEvent.type(input, 'old story');
      expect(screen.getAllByRole('option').some((o) => o.getAttribute('data-kind') === 'crypt')).toBe(true);
    });
    await pick('crypt');
    expect(await screen.findByText('Reopened "Old story" from the Crypt.')).toBeTruthy();
    const opened = [...fake.tabs.values()].find((t) => t.url === 'https://old.example/story');
    expect(opened?.active).toBe(true);
    expect(await store.getCrypt()).toEqual([]);
  });

  it('a web suggestion searches for it', async () => {
    fetchGoogle.mockResolvedValue(['cat food']);
    render(<App />);
    await userEvent.type(screen.getByRole('combobox'), 'cat');
    await pick('search');
    expect(fake.searches).toEqual([{ text: 'cat food', disposition: 'CURRENT_TAB' }]);
  });
});
