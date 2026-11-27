// @vitest-environment jsdom
// "Hide tabs": the cards slide away so the whole scene shows, a bar brings them back, and the choice is saved.
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('wxt/browser', async () => {
  const m = await import('../helpers/fakeBrowser');
  return { browser: m.browser };
});
vi.mock('../../entrypoints/newtab/hooks/useAreaSize', () => ({
  useAreaSize: () => [{ current: null }, { w: 1400, h: 400, full: 400 }] as const,
}));
import { browser, fake } from '../helpers/fakeBrowser';
import { App } from '../../entrypoints/newtab/App';
import { KEYS, store } from '../../lib/store';

beforeEach(() => {
  fake.reset();
  const me = fake.addTab({ url: 'chrome-extension://fake-id/newtab.html', active: true });
  fake.currentTabId = me.id;
  for (let i = 0; i < 3; i++) fake.addTab({ url: `https://site${i}.com/`, title: `Tab ${i}`, lastAccessed: Date.now() });
});
afterEach(cleanup);

const area = () => document.querySelector('.cards-area')!;
const grid = () => document.querySelector('.card-grid')!;

describe('Hide tabs', () => {
  it('hides the cards, shows the bar, and brings them back', async () => {
    render(<App />);
    const toggle = await screen.findByRole('button', { name: 'Hide tabs' });
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    expect(area().hasAttribute('data-hidden')).toBe(false);

    await userEvent.click(toggle);
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(toggle.textContent).toBe('Show tabs');
    expect(area().hasAttribute('data-hidden')).toBe(true);
    expect(grid().hasAttribute('inert')).toBe(true);
    expect(document.querySelector('.cards-hidden-bar')!.textContent).toMatch(/3 vampires hidden/);
    // The chips stay.
    expect(screen.getByRole('list', { name: 'Filter by state' })).toBeTruthy();

    await userEvent.click(screen.getAllByRole('button', { name: 'Show tabs' }).find((b) => b.classList.contains('cards-hidden-show'))!);
    expect(area().hasAttribute('data-hidden')).toBe(false);
    expect(document.querySelector('.cards-hidden-bar')).toBeNull();
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
  });

  it('works from the keyboard', async () => {
    render(<App />);
    const toggle = await screen.findByRole('button', { name: 'Hide tabs' });
    toggle.focus();
    await userEvent.keyboard('{Enter}');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    await userEvent.keyboard(' ');
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
  });

  it('remembers the choice after a reload', async () => {
    const first = render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: 'Hide tabs' }));
    await waitFor(async () => expect(await store.getCardsHidden()).toBe(true));
    first.unmount();

    render(<App />);
    await waitFor(() => expect(area()?.hasAttribute('data-hidden')).toBe(true));
    expect(screen.getAllByRole('button', { name: 'Show tabs' })[0]!.getAttribute('aria-pressed')).toBe('true');
  });

  it('reads a missing or bad value as shown', async () => {
    expect(await store.getCardsHidden()).toBe(false);
    await browser.storage.local.set({ [KEYS.cardsHidden]: 'yes' });
    expect(await store.getCardsHidden()).toBe(false);
  });
});
