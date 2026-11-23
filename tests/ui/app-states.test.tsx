// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
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
import { DAY_MS } from '../../lib/hunger';
import { store } from '../../lib/store';

beforeEach(() => {
  fake.reset();
  fetchGoogle.mockReset().mockResolvedValue([]);
  const me = fake.addTab({ url: 'chrome-extension://fake-id/newtab.html', title: 'Tabpire', active: true });
  fake.currentTabId = me.id;
});
afterEach(cleanup);

const dawn = () => screen.getByRole('button', { name: /Dawn/ });

describe('loading', () => {
  it('shows the header, search box, pinned row and same-size placeholder cards at once', () => {
    fake.addTab({ title: 'One', url: 'https://one.com/' });
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: 'Tabpire' })).toBeTruthy();
    expect(screen.getByRole('combobox')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Pinned pages' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add page' })).toBeTruthy();

    const loading = screen.getByLabelText('Loading open tabs');
    expect(loading.getAttribute('aria-busy')).toBe('true');
    const placeholders = loading.querySelectorAll('.card.card-skeleton');
    expect(placeholders.length).toBeGreaterThan(0);
    expect(screen.queryByRole('heading', { level: 3 })).toBeNull();
  });

  it('replaces the placeholders with the real cards', async () => {
    fake.addTab({ title: 'One', url: 'https://one.com/' });
    render(<App />);
    expect(await screen.findByRole('heading', { level: 3, name: 'One' })).toBeTruthy();
    expect(screen.queryByLabelText('Loading open tabs')).toBeNull();
  });
});

describe('no other tabs', () => {
  it('shows a friendly message and a disabled Dawn', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { level: 2, name: 'Nothing is draining memory' })).toBeTruthy();
    expect(screen.getByText(/No other tabs are open/)).toBeTruthy();
    expect(dawn().getAttribute('aria-disabled')).toBe('true');
    expect(screen.queryByRole('list', { name: /tabs/i })).toBeNull();
  });

  it('counts open tabs as 0', async () => {
    render(<App />);
    await screen.findByText('Nothing is draining memory');
    const openTabs = screen.getByText('Vampires').closest('div')!;
    expect(openTabs.textContent).toContain('0');
  });
});

describe('tabs but none starving', () => {
  it('shows the cards and keeps Dawn disabled', async () => {
    fake.addTab({ title: 'Fresh', url: 'https://f.com/', lastAccessed: Date.now() - 1000 });
    fake.addTab({ title: 'Protected', url: 'https://safe.com/', lastAccessed: Date.now() - 5 * DAY_MS });
    await store.setGarlic(['safe.com']);
    render(<App />);
    expect(await screen.findByRole('heading', { level: 3, name: 'Fresh' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 3, name: 'Protected' })).toBeTruthy();
    expect(screen.queryByText('Nothing is draining memory')).toBeNull();
    expect(dawn().getAttribute('aria-disabled')).toBe('true');
  });
});

describe('when the tabs cannot be read', () => {
  it('shows a plain message and Try again, which recovers', async () => {
    fake.addTab({ title: 'One', url: 'https://one.com/' });
    fake.failQuery = true;
    render(<App />);
    expect(await screen.findByRole('heading', { level: 2, name: 'Tabpire could not read your tabs' })).toBeTruthy();
    expect(screen.getByText(/Nothing was changed/)).toBeTruthy();

    fake.failQuery = false;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { level: 3, name: 'One' })).toBeTruthy();
    expect(screen.queryByText('Tabpire could not read your tabs')).toBeNull();
  });

  it('still shows the pinned pages and lets the search box work', async () => {
    await store.setHaunts([{ url: 'https://github.com/', title: 'GitHub' }]);
    fake.failQuery = true;
    render(<App />);
    await screen.findByText('Tabpire could not read your tabs');
    expect(await within(screen.getByRole('region', { name: 'Pinned pages' })).findByRole('link', { name: /GitHub/ })).toBeTruthy();

    await userEvent.type(screen.getByRole('combobox'), 'github');
    await waitFor(() => expect(screen.getAllByRole('option').some((o) => o.getAttribute('data-kind') === 'haunt')).toBe(true));
    await userEvent.keyboard('{Escape}');
    await userEvent.clear(screen.getByRole('combobox'));
    await userEvent.type(screen.getByRole('combobox'), 'bats{Enter}');
    expect(fake.searches).toEqual([{ text: 'bats', disposition: 'CURRENT_TAB' }]);
  });

  it('shows the stored reclaimed total even then', async () => {
    await store.setStats({ staked: 3, coffined: 0, crypted: 0, dawns: 0, mbFreed: 760 });
    fake.failQuery = true;
    render(<App />);
    await screen.findByText('Tabpire could not read your tabs');
    await waitFor(() => expect(screen.getByText('Blood reclaimed').closest('div')!.textContent).toContain('~760 MB'));
  });
});
