// @vitest-environment jsdom
// The full Blood Bank page: title, totals and rank, the hunt log, the crypt with search, Resurrect and Delete, and the
// garlic sites with Remove. It runs against the fake browser, as in the web demo.
import { readFileSync } from 'node:fs';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('wxt/browser', async () => {
  const m = await import('../helpers/fakeBrowser');
  return { browser: m.browser };
});
import { fake } from '../helpers/fakeBrowser';
import { store } from '../../lib/store';
import { BloodBank } from '../../entrypoints/bloodbank/BloodBank';

const NOW = Date.now();
beforeEach(() => {
  fake.reset();
});
afterEach(cleanup);

describe('Blood Bank page', () => {
  it('has the title, the sub line, the back button and empty texts', async () => {
    const { container } = render(<BloodBank />);
    expect(container.querySelector('.bb-scroll > main.bb')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'The Blood Bank' })).toBeTruthy();
    expect(screen.getByText('Everything you’ve reclaimed from the vampires. Stored only in this browser.')).toBeTruthy();
    expect(screen.getByRole('button', { name: '← Back to the Crypt' })).toBeTruthy();
    expect(await screen.findByText('No hunts yet. Open a new tab to meet your vampires.')).toBeTruthy();
    expect(screen.getByText('None yet. Hang garlic on a vampire to protect its site.')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'The crypt · 0' })).toBeTruthy();
    for (const label of ['Blood reclaimed', 'Vampires slain', 'Coffined', 'Hunter rank']) expect(screen.getByText(label)).toBeTruthy();
  });
  it('"← Back to the Crypt" opens the Crypt in the same tab', async () => {
    fake.currentTabId = fake.addTab({ url: 'chrome-extension://fake-id/bloodbank.html', active: true }).id;
    render(<BloodBank />);
    await userEvent.click(screen.getByRole('button', { name: '← Back to the Crypt' }));
    expect(fake.calls.some((c) => c.includes('newtab.html'))).toBe(true);
  });
  it('lists the hunt log newest first, with an icon, the time, the action, the title and its memory', async () => {
    await store.setStats({ staked: 3, coffined: 1, crypted: 1, dawns: 0, mbFreed: 970 });
    await store.setLog([
      { at: NOW - 3000, action: 'stake', site: 'a.com', title: 'First', mb: 450 },
      { at: NOW - 2000, action: 'coffin', site: 'b.com', title: 'Second', mb: 520 },
      { at: NOW - 1000, action: 'garlic', site: 'c.com' },
    ]);
    render(<BloodBank />);
    const log = (await screen.findByRole('heading', { level: 2, name: 'Hunt log' })).closest('section')!;
    await waitFor(() => expect(log.querySelectorAll('li')).toHaveLength(3));
    const rows = [...log.querySelectorAll('li')];
    expect(rows.map((r) => r.querySelector('.bb-log-action')!.textContent)).toEqual(['Garlic', 'Coffined', 'Staked']);
    expect(rows[1]!.querySelector('.bb-log-what')!.textContent).toBe('Second');
    expect(rows[1]!.querySelector('.bb-log-mb')!.textContent).toBe('~520 MB');
    expect(rows[0]!.querySelector('.bb-log-mb')!.textContent).toBe('');
    expect(rows[2]!.querySelector('.bb-log-icon svg')).toBeTruthy();
    expect(rows[2]!.querySelector('.bb-log-time')!.textContent).toMatch(/^\d\d:\d\d$/);
    const slain = screen.getByText('Vampires slain').closest('.bb-tile')!;
    await waitFor(() => expect(slain.querySelector('dd')!.textContent).toBe('3'));
    expect(screen.getByRole('img', { name: /next rank|Top rank/ })).toBeTruthy();
  });
  it('searches the crypt, resurrects a saved tab (reopens it and removes it) and deletes another', async () => {
    await store.setCrypt([
      { id: 'a', url: 'https://alpha.com/', title: 'Alpha page', savedAt: NOW - 2 },
      { id: 'b', url: 'https://beta.com/', title: 'Beta page', savedAt: NOW - 1 },
    ]);
    render(<BloodBank />);
    const saved = (await screen.findByRole('heading', { level: 2, name: 'The crypt · 2' })).closest('section')!;
    await userEvent.type(within(saved).getByRole('searchbox', { name: 'Search saved tabs' }), 'alp');
    await waitFor(() => expect(within(saved).queryByRole('link', { name: 'Beta page' })).toBeNull());
    expect(within(saved).getByRole('link', { name: 'Alpha page' }).getAttribute('href')).toBe('https://alpha.com/');
    await userEvent.click(within(saved).getByRole('button', { name: 'Resurrect' }));
    await waitFor(async () => expect((await store.getCrypt()).map((i) => i.id)).toEqual(['b']));
    expect([...fake.tabs.values()].some((t) => t.url === 'https://alpha.com/')).toBe(true);
    await userEvent.clear(within(saved).getByRole('searchbox'));
    await userEvent.click(await within(saved).findByRole('button', { name: 'Delete Beta page' }));
    await waitFor(async () => expect(await store.getCrypt()).toEqual([]));
    expect([...fake.tabs.values()].some((t) => t.url === 'https://beta.com/')).toBe(false);
  });
  it('lists the garlic sites and removes one', async () => {
    await store.setGarlic(['mail.google.com', 'claude.ai']);
    render(<BloodBank />);
    await userEvent.click(await screen.findByRole('button', { name: 'Remove garlic from claude.ai' }));
    await waitFor(async () => expect(await store.getGarlic()).toEqual(['mail.google.com']));
  });
  it('main.tsx imports BloodBank and the shared styles', () => {
    const src = readFileSync('entrypoints/bloodbank/main.tsx', 'utf8');
    expect(src).toMatch(/import\s*\{\s*BloodBank\s*\}\s*from\s*'\.\/BloodBank'/);
    expect(src).toMatch(/import '\.\.\/newtab\/styles';/);
  });
});
