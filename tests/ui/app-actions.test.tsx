// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('wxt/browser', async () => {
  const m = await import('../helpers/fakeBrowser');
  return { browser: m.browser };
});

import { browser, fake } from '../helpers/fakeBrowser';
import { App } from '../../entrypoints/newtab/App';
import { DAY_MS } from '../../lib/hunger';
import { store } from '../../lib/store';

const OLD = () => Date.now() - 3 * DAY_MS;
const FRESH = () => Date.now() - 1000;

beforeEach(() => {
  fake.reset();
  const me = fake.addTab({ url: 'chrome-extension://fake-id/newtab.html', title: 'Tabpire', active: true });
  fake.currentTabId = me.id;
});
afterEach(cleanup);

const cardFor = async (title: string) => {
  const heading = await screen.findByRole('heading', { level: 3, name: title });
  return heading.closest('.card') as HTMLElement;
};
const button = (card: HTMLElement, name: string | RegExp) => within(card).getByRole('button', { name });
/** The text of a button's tip: its title, the vampire's line, the points and the note, joined by " | ". */
const tipOf = (btn: HTMLElement) =>
  [...document.getElementById(btn.getAttribute('aria-describedby')!)!.querySelectorAll('.tip-title, .tip-says, .tip-point, .tip-note, .tip-text')]
    .map((e) => e.textContent)
    .join(' | ');
const isDisabled = (btn: HTMLElement) => btn.getAttribute('aria-disabled') === 'true';

describe('button enabling and tooltips', () => {
  it('disables Coffin for a tab in use, with the reason, and gives an asleep tab Wake and Stake only', async () => {
    fake.addTab({ title: 'In use', url: 'https://a.com/', active: true, windowId: 2 });
    fake.addTab({ title: 'Sleeping', url: 'https://b.com/', discarded: true, lastAccessed: OLD() });
    render(<App />);

    const inUse = button(await cardFor('In use'), 'Coffin');
    expect(isDisabled(inUse)).toBe(true);
    expect(tipOf(inUse)).toBe(
      'COFFIN · PUT TO SLEEP | “You’re looking at me right now. I can’t sleep while you watch.” | Switch to another tab first, then come back here to coffin this one.',
    );

    const sleeping = await cardFor('Sleeping');
    expect(within(sleeping).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['Wake', 'Stake']);
    expect(tipOf(button(sleeping, 'Wake'))).toContain('WAKE | “You called? I’m awake… and thirsty.”');
  });

  it('enables Coffin for a normal tab', async () => {
    fake.addTab({ title: 'Normal', url: 'https://a.com/', lastAccessed: FRESH() });
    render(<App />);
    expect(isDisabled(button(await cardFor('Normal'), 'Coffin'))).toBe(false);
  });

  it('disables Crypt and Garlic for a page without a web address', async () => {
    fake.addTab({ title: 'Extensions', url: 'chrome://extensions', lastAccessed: OLD() });
    render(<App />);
    const card = await cardFor('Extensions');
    expect(isDisabled(button(card, 'Crypt'))).toBe(true);
    expect(tipOf(button(card, 'Crypt'))).toContain('Only web pages can be saved to the crypt.');
    expect(isDisabled(button(card, 'Garlic'))).toBe(true);
    expect(tipOf(button(card, 'Garlic'))).toContain('Only web pages can be protected.');
    expect(isDisabled(button(card, 'Stake'))).toBe(false);
  });
});

describe('running actions', () => {
  it('Stake closes the tab, shows a message, and updates the reclaimed figure', async () => {
    fake.addTab({ title: 'Doomed', url: 'https://chatgpt.com/c/1', lastAccessed: FRESH() });
    render(<App />);
    await userEvent.click(button(await cardFor('Doomed'), 'Stake'));

    expect(await screen.findByText(/^Staked Doomed · ~\d+ MB reclaimed$/)).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('heading', { level: 3, name: 'Doomed' })).toBeNull());
    expect(fake.tabs.size).toBe(1); // only The Crypt itself is left
    const reclaimed = screen.getByText('Blood reclaimed').closest('div')!;
    await waitFor(() => expect(reclaimed.textContent).not.toContain('~0 MB'));
  });

  it('Coffin puts the tab to sleep and the card turns Asleep', async () => {
    fake.addTab({ title: 'Napper', url: 'https://a.com/', lastAccessed: FRESH() });
    render(<App />);
    await userEvent.click(button(await cardFor('Napper'), 'Coffin'));
    expect(await screen.findByText(/^Napper sleeps in its coffin · ~\d+ MB freed$/)).toBeTruthy();
    await waitFor(async () => expect((await cardFor('Napper')).dataset.state).toBe('asleep'));
  });

  it('Crypt saves and closes the tab', async () => {
    fake.addTab({ title: 'Keeper', url: 'https://keep.com/page', lastAccessed: FRESH() });
    render(<App />);
    await userEvent.click(button(await cardFor('Keeper'), 'Crypt'));
    expect(await screen.findByText(/^Sealed Keeper in the crypt · ~\d+ MB reclaimed$/)).toBeTruthy();
    expect((await store.getCrypt()).map((i) => i.url)).toEqual(['https://keep.com/page']);
  });

  it('Garlic protects the site, the button becomes Remove garlic, and it can be undone', async () => {
    fake.addTab({ title: 'Protect me', url: 'https://safe.com/', lastAccessed: OLD() });
    render(<App />);
    let card = await cardFor('Protect me');
    expect(card.dataset.state).toBe('starving');

    await userEvent.click(button(card, 'Garlic'));
    expect(await screen.findByText('Garlic hung on safe.com. It will never be flagged.')).toBeTruthy();
    await waitFor(async () => expect((await cardFor('Protect me')).dataset.state).toBe('protected'));
    card = await cardFor('Protect me');
    expect(within(card).queryByRole('button', { name: 'Garlic' })).toBeNull();
    expect(tipOf(button(card, 'Remove garlic'))).toBe(
      'REMOVE GARLIC | “Finally, fresh air! I can feel my hunger coming back…” | Tabpire watches every safe.com tab again. | They can starve and be burned by Dawn like any other tab.',
    );
    expect(within(card).getAllByRole('button')).toHaveLength(1);

    await userEvent.click(button(card, 'Remove garlic'));
    expect(await screen.findByText('Garlic removed from safe.com')).toBeTruthy();
    await waitFor(async () => expect((await cardFor('Protect me')).dataset.state).toBe('starving'));
    expect(await store.getGarlic()).toEqual([]);
  });

  it('runs an action once, even when clicked twice, and disables the card meanwhile', async () => {
    fake.addTab({ title: 'Slow', url: 'https://slow.com/', lastAccessed: FRESH() });
    fake.addTab({ title: 'Other', url: 'https://other.com/', lastAccessed: FRESH() });
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const realRemove = browser.tabs.remove.bind(browser.tabs);
    const spy = vi.spyOn(browser.tabs, 'remove').mockImplementation(async (ids) => {
      await gate;
      return realRemove(ids);
    });
    render(<App />);
    const slow = await cardFor('Slow');
    const other = await cardFor('Other');

    await userEvent.click(button(slow, 'Stake'));
    await userEvent.click(button(slow, 'Stake'));

    await waitFor(() => expect(isDisabled(button(slow, 'Stake'))).toBe(true));
    for (const name of ['Coffin', 'Crypt', 'Garlic']) expect(isDisabled(button(slow, name))).toBe(true);
    expect(tipOf(button(slow, 'Stake'))).toBe('STAKE · CLOSE FOR GOOD | Please wait: another action is running.');
    expect(isDisabled(button(other, 'Stake'))).toBe(false);

    release();
    await screen.findByText(/^Staked Slow/);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('shows an error and leaves the card when the browser refuses', async () => {
    fake.addTab({ title: 'Stubborn', url: 'https://a.com/', lastAccessed: FRESH() });
    fake.failRemove.add('*');
    render(<App />);
    const card = await cardFor('Stubborn');
    await userEvent.click(button(card, 'Stake'));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('The browser would not do that. Nothing was changed.');
    expect(screen.getByRole('heading', { level: 3, name: 'Stubborn' })).toBeTruthy();
    await waitFor(() => expect(isDisabled(button(card, 'Stake'))).toBe(false));
    expect((await store.getStats()).staked).toBe(0);
  });

  it('shows an error when a tab is already gone', async () => {
    const tab = fake.addTab({ title: 'Ghost', url: 'https://a.com/', lastAccessed: FRESH() });
    render(<App />);
    const card = await cardFor('Ghost');
    fake.tabs.delete(tab.id); // closed elsewhere, before the page noticed
    await userEvent.click(button(card, 'Stake'));
    expect((await screen.findByRole('alert')).textContent).toContain('That tab is already gone.');
  });
});

describe('Dawn from the page', () => {
  const makeStarving = (n: number) =>
    Array.from({ length: n }, (_, i) =>
      fake.addTab({ title: `Hungry ${i + 1}`, url: `https://hungry${i + 1}.com/`, lastAccessed: OLD() }),
    );
  const dawnButton = () => screen.getByRole('button', { name: /Dawn/ });

  it('counts exactly the tabs Dawn would close', async () => {
    makeStarving(2);
    fake.addTab({ title: 'Pinned', url: 'https://p.com/', pinned: true, lastAccessed: OLD() });
    fake.addTab({ title: 'Fresh', url: 'https://f.com/', lastAccessed: FRESH() });
    fake.addTab({ title: 'Internal', url: 'chrome://extensions', lastAccessed: OLD() });
    render(<App />);
    await cardFor('Fresh');
    expect(dawnButton().textContent).toBe('Dawn · burn 2');
    expect(isDisabled(dawnButton())).toBe(false);
  });

  it('is disabled when nothing is starving', async () => {
    fake.addTab({ title: 'Fresh', url: 'https://f.com/', lastAccessed: FRESH() });
    render(<App />);
    await cardFor('Fresh');
    expect(isDisabled(dawnButton())).toBe(true);
    expect(dawnButton().textContent).toBe('Dawn');
    expect(tipOf(dawnButton())).toBe(
      'DAWN | “No one is starving. The sun can wait.” | Nothing is starving right now. Dawn closes tabs that have been idle for over a day. | Never touches the tab you’re on, tabs playing sound, pinned tabs or garlic sites.',
    );
  });
  it('explains a starving tab it will not close, so the tooltip agrees with the header', async () => {
    fake.addTab({ title: 'Fresh', url: 'https://f.com/', lastAccessed: FRESH() });
    fake.addTab({ title: 'Pinned', url: 'https://p.com/', pinned: true, lastAccessed: OLD() });
    render(<App />);
    await cardFor('Fresh');
    expect(isDisabled(dawnButton())).toBe(true);
    expect(tipOf(dawnButton())).toContain('1 starving tab is kept safe (pinned).');
  });

  it('closes the starving tabs, saves them, and shows what happened', async () => {
    makeStarving(2);
    fake.addTab({ title: 'Fresh', url: 'https://f.com/', lastAccessed: FRESH() });
    render(<App />);
    await cardFor('Hungry 1');
    await userEvent.click(dawnButton());

    expect(await screen.findByText(/^Dawn burned 2 vampires · ~\d+ MB reclaimed\. They rest in the crypt\.$/)).toBeTruthy();
    expect((await store.getCrypt()).map((i) => i.url).sort()).toEqual(['https://hungry1.com/', 'https://hungry2.com/']);
    await waitFor(() => expect(screen.queryByRole('heading', { level: 3, name: 'Hungry 1' })).toBeNull());
    expect(screen.getByRole('heading', { level: 3, name: 'Fresh' })).toBeTruthy();
    await waitFor(() => expect(isDisabled(dawnButton())).toBe(true));
  });

  it('plays the sunrise over the whole screen when Dawn runs, and not under reduced motion', async () => {
    makeStarving(2);
    const { unmount } = render(<App />);
    await cardFor('Hungry 1');
    expect(screen.queryByTestId('sunrise')).toBeNull();
    await userEvent.click(dawnButton());
    expect(screen.getByTestId('sunrise').getAttribute('aria-hidden')).toBe('true');
    await screen.findByText(/^Dawn burned 2 vampires/);
    unmount();
    makeStarving(2);
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), addEventListener() {}, removeEventListener() {} }));
    try {
      render(<App />);
      await cardFor('Hungry 1');
      await userEvent.click(dawnButton());
      await screen.findByText(/^Dawn burned 2 vampires/);
      expect(screen.queryByTestId('sunrise')).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('disables Dawn and every card button while it runs', async () => {
    makeStarving(2);
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const realRemove = browser.tabs.remove.bind(browser.tabs);
    const spy = vi.spyOn(browser.tabs, 'remove').mockImplementation(async (ids) => {
      await gate;
      return realRemove(ids);
    });
    render(<App />);
    const card = await cardFor('Hungry 1');
    await userEvent.click(dawnButton());

    await waitFor(() => expect(dawnButton().getAttribute('aria-busy')).toBe('true'));
    expect(isDisabled(dawnButton())).toBe(true);
    expect(isDisabled(button(card, 'Stake'))).toBe(true);
    await userEvent.click(dawnButton());

    release();
    await screen.findByText(/^Dawn burned 2 vampires/);
    expect(spy).toHaveBeenCalledTimes(2); // one per tab, and the second click did nothing
    spy.mockRestore();
  });

  it('says no tabs were closed when saving to the Crypt fails', async () => {
    makeStarving(2);
    fake.failStorageSet.add('tabpire:crypt');
    render(<App />);
    await cardFor('Hungry 1');
    await userEvent.click(dawnButton());
    expect((await screen.findByRole('alert')).textContent).toContain('Could not save the tabs to the Crypt, so no tabs were closed.');
    expect(screen.getByRole('heading', { level: 3, name: 'Hungry 1' })).toBeTruthy();
    expect(fake.calls.some((c) => c.startsWith('remove:'))).toBe(false);
  });
});
