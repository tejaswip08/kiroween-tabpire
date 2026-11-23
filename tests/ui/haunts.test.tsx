// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('wxt/browser', async () => {
  const m = await import('../helpers/fakeBrowser');
  return { browser: m.browser };
});

import { fake } from '../helpers/fakeBrowser';
import { App } from '../../entrypoints/newtab/App';
import { MAX_HAUNTS } from '../../lib/store';
import { store } from '../../lib/store';

beforeEach(() => {
  fake.reset();
  const me = fake.addTab({ url: 'chrome-extension://fake-id/newtab.html', title: 'Tabpire', active: true });
  fake.currentTabId = me.id;
});
afterEach(cleanup);

const row = () => screen.getByRole('region', { name: 'Pinned pages' });
const addButton = () => within(row()).getByRole('button', { name: 'Add page' });
const openForm = async () => {
  await userEvent.click(addButton());
  return screen.getByRole('dialog', { name: 'Add a page' });
};

describe('pinned pages row', () => {
  it('shows each page as a link that opens in this tab, with an icon that falls back to a letter badge', async () => {
    await store.setHaunts([
      { url: 'https://github.com/', title: 'GitHub' },
      { url: 'https://example.com/docs', title: 'Docs' },
    ]);
    render(<App />);
    const link = await within(row()).findByRole('link', { name: /GitHub/ });
    expect(link.getAttribute('href')).toBe('https://github.com/');
    expect(link.getAttribute('target')).toBeNull();
    expect(link.getAttribute('referrerpolicy')).toBe('no-referrer');
    // The icon sources are tried in order; when every one fails the letter shows.
    const seen: string[] = [];
    for (let i = 0; i < 4; i++) {
      const img = link.querySelector('img');
      if (!img) break;
      seen.push(img.getAttribute('src')!);
      fireEvent.error(img);
    }
    expect(seen).toEqual([
      expect.stringContaining('/_favicon/?pageUrl=https%3A%2F%2Fgithub.com%2F'),
      'https://github.com/favicon.ico',
      'https://icons.duckduckgo.com/ip3/github.com.ico',
    ]);
    expect(link.querySelector('img')).toBeNull();
    expect(within(link).getByText('G')).toBeTruthy();
    expect(within(row()).getAllByRole('link')).toHaveLength(2);
  });

  it('ends with the Add page button', async () => {
    await store.setHaunts([{ url: 'https://github.com/', title: 'GitHub' }]);
    render(<App />);
    await within(row()).findByRole('link', { name: /GitHub/ });
    const items = within(row()).getAllByRole('listitem');
    expect(within(items[items.length - 1]!).getByRole('button', { name: 'Add page' })).toBeTruthy();
  });
});

describe('Add page form', () => {
  it('opens with focus in the address field and adds a page', async () => {
    render(<App />);
    const form = await openForm();
    const address = within(form).getByLabelText('Web address');
    expect(document.activeElement).toBe(address);
    await userEvent.type(address, 'example.com/docs');
    await userEvent.type(within(form).getByLabelText('Name (optional)'), 'My docs');
    await userEvent.click(within(form).getByRole('button', { name: 'Add' }));

    expect(await within(row()).findByRole('link', { name: /My docs/ })).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(await store.getHaunts()).toEqual([{ url: 'https://example.com/docs', title: 'My docs' }]);
    expect(document.activeElement).toBe(addButton());
  });

  it('names the page after the site when no name is given', async () => {
    render(<App />);
    const form = await openForm();
    await userEvent.type(within(form).getByLabelText('Web address'), 'https://www.example.com/{Enter}');
    expect(await within(row()).findByRole('link', { name: /example\.com/ })).toBeTruthy();
  });

  it('shows plain messages for bad addresses and keeps the form open', async () => {
    render(<App />);
    const form = await openForm();
    const address = within(form).getByLabelText('Web address');

    await userEvent.click(within(form).getByRole('button', { name: 'Add' }));
    expect((await within(form).findByRole('alert')).textContent).toBe('Type a web address, like example.com.');

    await userEvent.type(address, 'chrome://extensions');
    await userEvent.click(within(form).getByRole('button', { name: 'Add' }));
    await waitFor(() =>
      expect(within(form).getByRole('alert').textContent).toBe('Only web addresses that start with http or https can be added.'),
    );
    expect(address.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(await store.getHaunts()).toEqual([]);

    await userEvent.clear(address);
    await userEvent.type(address, 'not an address');
    await userEvent.click(within(form).getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(within(form).getByRole('alert').textContent).toContain('does not look like a web address'));
  });

  it('rejects a duplicate', async () => {
    await store.setHaunts([{ url: 'https://example.com/', title: 'Example' }]);
    render(<App />);
    await within(row()).findByRole('link', { name: /Example/ });
    const form = await openForm();
    await userEvent.type(within(form).getByLabelText('Web address'), 'example.com{Enter}');
    expect((await within(form).findByRole('alert')).textContent).toBe('That page is already in the list.');
    expect(await store.getHaunts()).toHaveLength(1);
  });

  it('closes with Escape and gives focus back to the button', async () => {
    render(<App />);
    await openForm();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(addButton());
  });

  it('closes with Cancel, and when clicking elsewhere', async () => {
    render(<App />);
    let form = await openForm();
    await userEvent.click(within(form).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    await openForm();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('dialog')).toBeNull();
    form = await openForm();
    expect(form).toBeTruthy();
  });

  it('has labelled fields', async () => {
    render(<App />);
    const form = await openForm();
    expect(within(form).getByLabelText('Web address')).toBeTruthy();
    expect(within(form).getByLabelText('Name (optional)')).toBeTruthy();
  });
});

describe('removing and the limit', () => {
  it('removes a page with its remove button', async () => {
    await store.setHaunts([
      { url: 'https://a.com/', title: 'Alpha' },
      { url: 'https://b.com/', title: 'Beta' },
    ]);
    render(<App />);
    await within(row()).findByRole('link', { name: /Alpha/ });
    const remove = within(row()).getByRole('button', { name: 'Remove Alpha' });
    expect(document.getElementById(remove.getAttribute('aria-describedby')!)!.textContent).toBe('Remove this page from the list');
    await userEvent.click(remove);
    await waitFor(() => expect(within(row()).queryByRole('link', { name: /Alpha/ })).toBeNull());
    expect(within(row()).getByRole('link', { name: /Beta/ })).toBeTruthy();
    expect((await store.getHaunts()).map((p) => p.title)).toEqual(['Beta']);
  });

  it('can reach the remove button with the keyboard', async () => {
    await store.setHaunts([{ url: 'https://a.com/', title: 'Alpha' }]);
    render(<App />);
    const link = await within(row()).findByRole('link', { name: /Alpha/ });
    link.focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(within(row()).getByRole('button', { name: 'Remove Alpha' }));
  });

  it('disables Add page at the limit, with the reason', async () => {
    await store.setHaunts(Array.from({ length: MAX_HAUNTS }, (_, i) => ({ url: `https://s${i}.com/`, title: `Site ${i}` })));
    render(<App />);
    await within(row()).findByRole('link', { name: /Site 0/ });
    const btn = addButton();
    expect(btn.getAttribute('aria-disabled')).toBe('true');
    expect(document.getElementById(btn.getAttribute('aria-describedby')!)!.textContent).toBe(
      `You can add up to ${MAX_HAUNTS} pages. Remove one first.`,
    );
    await userEvent.click(btn);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
