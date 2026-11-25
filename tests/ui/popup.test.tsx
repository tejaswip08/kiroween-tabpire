// @vitest-environment jsdom
// The toolbar popup: portrait, "N starving" or "All fed", the vampires and memory, the wide Dawn button and the way to
// the Crypt and the Blood Bank.
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('wxt/browser', async () => {
  const m = await import('../helpers/fakeBrowser');
  return { browser: m.browser };
});
import { fake } from '../helpers/fakeBrowser';
import { DAY_MS } from '../../lib/hunger';
import { store } from '../../lib/store';
import { Popup } from '../../entrypoints/popup/Popup';
import { popupDawn, popupHeading, popupSub } from '../../lib/popupText';

beforeEach(() => fake.reset());
afterEach(cleanup);

describe('popup words', () => {
  it('heading, sub line and Dawn button', () => {
    expect(popupHeading(3)).toBe('3 starving');
    expect(popupHeading(0)).toBe('All fed');
    expect(popupSub(12, 2400)).toBe('12 vampires · ~2.4 GB draining');
    expect(popupSub(1, 120)).toBe('1 vampire · ~120 MB draining');
    expect(popupDawn(2)).toBe('Dawn · burn 2');
    expect(popupDawn(0)).toBe('No one to burn');
  });
});

describe('popup', () => {
  it('shows the starving look, the counts, and burns with Dawn', async () => {
    fake.addTab({ title: 'Old', url: 'https://old.com/', lastAccessed: Date.now() - 3 * DAY_MS });
    fake.addTab({ title: 'New', url: 'https://new.com/', lastAccessed: Date.now() - 1000 });
    await store.setStats({ staked: 1, coffined: 0, crypted: 0, dawns: 0, mbFreed: 450 });
    const { container } = render(<Popup />);
    expect(await screen.findByRole('heading', { level: 1, name: '1 starving' })).toBeTruthy();
    expect(container.querySelector('.popup')!.getAttribute('data-state')).toBe('starving');
    expect(screen.getByText('Tabpire')).toBeTruthy();
    expect(screen.getByText(/^2 vampires · ~\d+ MB draining$/)).toBeTruthy();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Blood Bank: ~450 MB reclaimed' })).toBeTruthy());
    const dawnBtn = screen.getByRole('button', { name: 'Dawn · burn 1' });
    await userEvent.click(dawnBtn);
    await waitFor(() => expect([...fake.tabs.values()].some((t) => t.title === 'Old')).toBe(false));
    expect(await screen.findByRole('heading', { level: 1, name: 'All fed' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'No one to burn' }).getAttribute('aria-disabled')).toBe('true');
  });
  it('opens the Crypt and the Blood Bank, then calls onDone', async () => {
    const onDone = vi.fn();
    render(<Popup onDone={onDone} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Open the Crypt' }));
    await waitFor(() => expect(fake.calls.some((c) => c.startsWith('create:') && c.includes('newtab.html'))).toBe(true));
    await userEvent.click(screen.getByRole('button', { name: /^Blood Bank/ }));
    await waitFor(() => expect(fake.calls.some((c) => c.includes('bloodbank.html'))).toBe(true));
    expect(onDone).toHaveBeenCalledTimes(2);
  });
  it('is an extension entrypoint, and the demo uses the real popup', () => {
    expect(readFileSync('entrypoints/popup/index.html', 'utf8')).toMatch(/src="\.\/main\.tsx"/);
    expect(readFileSync('demo/src/DemoShell.tsx', 'utf8')).toMatch(/<DemoPopup \/>/);
    expect(readFileSync('demo/src/DemoPopup.tsx', 'utf8')).toMatch(/entrypoints\/popup\/Popup/);
  });
});
