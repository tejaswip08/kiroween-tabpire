// @vitest-environment jsdom
// "+N more" is a real button: it opens a panel listing every hidden tab with its actions; Escape or Close closes it.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('wxt/browser', async () => {
  const m = await import('../helpers/fakeBrowser');
  return { browser: m.browser };
});
// A small cards area: 800 x 600 measured 752 x 308, which holds one row of five slots.
vi.mock('../../entrypoints/newtab/hooks/useAreaSize', () => ({
  useAreaSize: () => [{ current: null }, { w: 752, h: 308, full: 308 }] as const,
}));
import { fake } from '../helpers/fakeBrowser';
import { App } from '../../entrypoints/newtab/App';
import { DAY_MS } from '../../lib/hunger';

beforeEach(() => {
  fake.reset();
  const me = fake.addTab({ url: 'chrome-extension://fake-id/newtab.html', active: true });
  fake.currentTabId = me.id;
  for (let i = 0; i < 19; i++) fake.addTab({ url: `https://site${i}.com/`, title: `Tab ${i}`, lastAccessed: Date.now() - (i % 3) * DAY_MS - i * 1000 });
});
afterEach(cleanup);

describe('hidden tabs', () => {
  it('shows the first cards and a "+N more" button that lists all the others, with their actions', async () => {
    render(<App />);
    const more = await screen.findByRole('button', { name: /\+15 more/ });
    expect(document.querySelectorAll('.card-grid > .card')).toHaveLength(4);
    await userEvent.click(more);
    const panel = screen.getByRole('dialog', { name: '15 more tabs' });
    const rows = panel.querySelectorAll('.hidden-row');
    expect(rows).toHaveLength(15);
    // Every hidden tab is listed once, none of them is also a card.
    const cardIds = [...document.querySelectorAll('.card-grid > .card')].map((c) => c.getAttribute('data-tab-id'));
    for (const r of rows) expect(cardIds).not.toContain(r.getAttribute('data-tab-id'));
    const first = rows[0] as HTMLElement;
    expect(within(first).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['Stake', 'Coffin', 'Crypt', 'Garlic']);
    expect(first.querySelector('.hidden-pill')!.textContent).toMatch(/Starving|Awake/);
    expect(first.textContent).toMatch(/~\d+ MB/);
    expect(document.activeElement?.textContent).toContain('Close');
  });
  it('runs an action from the panel', async () => {
    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: /\+15 more/ }));
    const row = screen.getByRole('dialog').querySelector('.hidden-row') as HTMLElement;
    const id = Number(row.getAttribute('data-tab-id'));
    await userEvent.click(within(row).getByRole('button', { name: 'Stake' }));
    await waitFor(() => expect(fake.tabs.has(id)).toBe(false));
  });
  it('closes with Escape and with Close, and gives focus back to the button', async () => {
    render(<App />);
    const more = await screen.findByRole('button', { name: /\+15 more/ });
    await userEvent.click(more);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(more);
    await userEvent.click(more);
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
