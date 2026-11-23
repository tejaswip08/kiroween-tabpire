// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('wxt/browser', async () => {
  const m = await import('../helpers/fakeBrowser');
  return { browser: m.browser };
});

import { browser, events, fake, fire } from '../helpers/fakeBrowser';
import { useCrypt } from '../../entrypoints/newtab/components/useCrypt';
import { store } from '../../lib/store';

function Probe({ onData }: { onData?: (d: ReturnType<typeof useCrypt>) => void }) {
  const data = useCrypt();
  onData?.(data);
  return (
    <div>
      <p data-testid="status">{data.status}</p>
      <p data-testid="cards">{data.cards.map((c) => c.tab.title).join('|')}</p>
      <p data-testid="reclaimed">{data.stats.mbFreed}</p>
      <button onClick={data.reload}>reload</button>
    </div>
  );
}

const text = (id: string) => screen.getByTestId(id).textContent;

beforeEach(() => {
  fake.reset();
  const me = fake.addTab({ url: 'chrome-extension://fake-id/newtab.html', title: 'Tabpire', active: true });
  fake.currentTabId = me.id;
});
afterEach(cleanup);

describe('useCrypt', () => {
  it('starts loading, then shows a card for each other tab', async () => {
    fake.addTab({ title: 'One', url: 'https://one.com/' });
    fake.addTab({ title: 'Two', url: 'https://two.com/' });
    fake.addTab({ title: 'Blank', url: 'chrome://newtab/' });
    render(<Probe />);
    expect(text('status')).toBe('loading');
    await waitFor(() => expect(text('status')).toBe('ready'));
    expect(text('cards').split('|').sort()).toEqual(['One', 'Two']);
  });

  it('updates when a tab is created', async () => {
    fake.addTab({ title: 'One', url: 'https://one.com/' });
    render(<Probe />);
    await waitFor(() => expect(text('cards')).toBe('One'));

    fake.addTab({ title: 'Two', url: 'https://two.com/' });
    act(() => fire(events.onCreated, {}));
    await waitFor(() => expect(text('cards').split('|').sort()).toEqual(['One', 'Two']));
  });

  it('updates when a tab is removed', async () => {
    const one = fake.addTab({ title: 'One', url: 'https://one.com/' });
    fake.addTab({ title: 'Two', url: 'https://two.com/' });
    render(<Probe />);
    await waitFor(() => expect(text('cards').split('|')).toHaveLength(2));
    fake.tabs.delete(one.id);
    act(() => fire(events.onRemoved, one.id));
    await waitFor(() => expect(text('cards')).toBe('Two'));
  });

  it('updates the stats when another page writes data', async () => {
    render(<Probe />);
    await waitFor(() => expect(text('status')).toBe('ready'));
    expect(text('reclaimed')).toBe('0');
    await act(async () => {
      await store.setStats({ staked: 1, coffined: 0, crypted: 0, dawns: 0, mbFreed: 245 });
    });
    await waitFor(() => expect(text('reclaimed')).toBe('245'));
  });

  it('turns many events into one refresh', async () => {
    render(<Probe />);
    await waitFor(() => expect(text('status')).toBe('ready'));
    const spy = vi.spyOn(browser.tabs, 'query');
    act(() => {
      for (let i = 0; i < 20; i++) fire(events.onUpdated, 1, {}, {});
    });
    await waitFor(() => expect(spy).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 300));
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('drops a stale result that arrives after a newer one', async () => {
    fake.addTab({ title: 'Old', url: 'https://old.com/' });
    render(<Probe />);
    await waitFor(() => expect(text('cards')).toBe('Old'));

    const real = browser.tabs.query.bind(browser.tabs);
    let releaseSlow!: () => void;
    const slowGate = new Promise<void>((r) => (releaseSlow = r));
    const spy = vi
      .spyOn(browser.tabs, 'query')
      .mockImplementationOnce(async (info: object) => {
        const stale = await real(info); // taken now, with the old tab list
        await slowGate;
        return stale;
      });

    // First refresh starts and waits. Then the tab list changes and a second refresh finishes first.
    act(() => fire(events.onCreated, {}));
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    fake.tabs.clear();
    const me = fake.addTab({ url: 'chrome-extension://fake-id/newtab.html', active: true });
    fake.currentTabId = me.id;
    fake.addTab({ title: 'New', url: 'https://new.com/' });
    act(() => fire(events.onCreated, {}));
    await waitFor(() => expect(text('cards')).toBe('New'));

    await act(async () => {
      releaseSlow();
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(text('cards')).toBe('New');
    spy.mockRestore();
  });

  it('shows an error when the first load fails, and recovers on reload', async () => {
    fake.addTab({ title: 'One', url: 'https://one.com/' });
    fake.failQuery = true;
    render(<Probe />);
    await waitFor(() => expect(text('status')).toBe('error'));
    fake.failQuery = false;
    act(() => screen.getByText('reload').click());
    await waitFor(() => expect(text('status')).toBe('ready'));
    expect(text('cards')).toBe('One');
  });

  it('keeps the last good data when a later refresh fails', async () => {
    fake.addTab({ title: 'One', url: 'https://one.com/' });
    render(<Probe />);
    await waitFor(() => expect(text('cards')).toBe('One'));
    fake.failQuery = true;
    act(() => fire(events.onCreated, {}));
    await new Promise((r) => setTimeout(r, 300));
    expect(text('status')).toBe('ready');
    expect(text('cards')).toBe('One');
  });

  it('removes every listener when it unmounts', async () => {
    const { unmount } = render(<Probe />);
    await waitFor(() => expect(text('status')).toBe('ready'));
    expect(events.onCreated.listeners.length).toBe(1);
    expect(events.onStorageChanged.listeners.length).toBe(1);
    unmount();
    for (const e of [events.onCreated, events.onRemoved, events.onUpdated, events.onActivated, events.onAttached, events.onDetached, events.onReplaced, events.onStorageChanged]) {
      expect(e.listeners).toHaveLength(0);
    }
  });
});
