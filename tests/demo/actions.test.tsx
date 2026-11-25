// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('wxt/browser', async () => {
  const m = await import('../../lib/fakeBrowser');
  return { browser: m.browser };
});
// The 3D layers are replaced by plain markers, so the Crypt mounts without WebGL.
vi.mock('../../entrypoints/newtab/layers/SceneLayer', () => ({
  default: () => <div data-testid="scene-layer" />,
}));
vi.mock('../../entrypoints/newtab/layers/PortraitLayer', () => ({
  default: () => <div data-testid="portrait-layer" />,
}));
import { fake } from '../../lib/fakeBrowser';
import { capabilities } from '../../lib/capabilities';
import { MAX_HAUNTS, store } from '../../lib/store';
import { resetWebglCheck } from '../../entrypoints/newtab/layers/useWebgl';
import { DemoShell } from '../../demo/src/DemoShell';
import { installInterceptors } from '../../demo/src/intercept';
import { seedDemo } from '../../demo/src/seed';

const SEEDED_CARDS = 19; // 20 seeded tabs, minus the Crypt tab itself

beforeEach(() => {
  resetWebglCheck();
  fake.reset();
  capabilities.remoteSuggestions = false;
  capabilities.remoteIcons = false;
  installInterceptors((route) => {
    window.location.hash = `#/${route}`;
  });
  seedDemo(Date.now());
  window.location.hash = '#/crypt';
});
afterEach(() => {
  cleanup();
  capabilities.remoteSuggestions = true;
  capabilities.remoteIcons = true;
  vi.restoreAllMocks();
});

const cardFor = async (title: string) => {
  const heading = await screen.findByRole('heading', { level: 3, name: title });
  return heading.closest('.card') as HTMLElement;
};
const button = (card: HTMLElement, name: string | RegExp) => within(card).getByRole('button', { name });
const cardCount = () => document.querySelectorAll('.card:not(.card-exiting)').length;
const vampires = () => screen.getByText('Vampires').closest('.stat')!.querySelector('.stat-value')!.textContent;
const notice = () => document.querySelector('.demo-notice')!.textContent;
const gone = (title: string) =>
  waitFor(() => expect(screen.queryByRole('heading', { level: 3, name: title })).toBeNull(), { timeout: 3000 });
const row = () => screen.getByRole('region', { name: 'Pinned pages' });
const searchBox = () => screen.getByRole('combobox');

async function mountCrypt() {
  render(<DemoShell />);
  await cardFor('Claude');
}

describe('demo actions on the Crypt', () => {
  it('Stake closes the tab, removes the card, and updates the badge, stats and log', async () => {
    await mountCrypt();
    expect(vampires()).toBe(String(SEEDED_CARDS));
    const before = await store.getStats();
    await userEvent.click(button(await cardFor('Claude'), 'Stake'));
    await gone('Claude');
    expect([...fake.tabs.values()].some((t) => t.title === 'Claude')).toBe(false);
    const after = await store.getStats();
    expect(after.staked).toBe(before.staked + 1);
    expect(after.mbFreed).toBeGreaterThan(before.mbFreed);
    expect((await store.getLog()).at(-1)?.action).toBe('stake');
    await waitFor(() => expect(vampires()).toBe(String(SEEDED_CARDS - 1)));
  });

  it('Coffin discards the tab and the card turns Asleep', async () => {
    await mountCrypt();
    await userEvent.click(button(await cardFor('Claude'), 'Coffin'));
    await waitFor(async () => expect((await cardFor('Claude')).dataset.state).toBe('asleep'));
    expect([...fake.tabs.values()].find((t) => t.title === 'Claude')?.discarded).toBe(true);
    expect(cardCount()).toBe(SEEDED_CARDS);
  });

  it('Crypt saves the tab, removes it, and Blood Bank counts the entry', async () => {
    await mountCrypt();
    const before = (await store.getCrypt()).length;
    await userEvent.click(button(await cardFor('Claude'), 'Crypt'));
    await gone('Claude');
    const crypt = await store.getCrypt();
    expect(crypt).toHaveLength(before + 1);
    expect(crypt.some((c) => c.url === 'https://claude.ai/chat/7f3e')).toBe(true);
    expect([...fake.tabs.values()].some((t) => t.title === 'Claude')).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: 'Blood Bank' }));
    const heading = await screen.findByRole('heading', { level: 2, name: /^The crypt · / });
    await waitFor(() => expect(heading.textContent).toBe(`The crypt · ${before + 1}`));
    const saved = heading.closest('section')!;
    expect(within(saved).getByRole('link', { name: 'Claude' })).toBeTruthy();
  });

  it('Garlic protects the site and every card of that site shows Protected', async () => {
    await mountCrypt();
    // github.com has an awake tab and a starving tab.
    const starving = 'Issue #1234 · vitejs/vite';
    expect((await cardFor(starving)).dataset.state).toBe('starving');
    await userEvent.click(button(await cardFor(starving), 'Garlic'));
    await waitFor(async () => expect((await cardFor(starving)).dataset.state).toBe('protected'));
    expect((await cardFor('Pull requests · tabpire/tabpire')).dataset.state).toBe('protected');
    expect(await store.getGarlic()).toContain('github.com');
  });

  it('Resurrect (from search) creates a tab and removes the crypt entry', async () => {
    await mountCrypt();
    const before = (await store.getCrypt()).length;
    await userEvent.type(searchBox(), 'Hacker News');
    const option = await waitFor(() => {
      const el = document.querySelector('[role="option"][data-kind="crypt"]');
      expect(el).toBeTruthy();
      return el as HTMLElement;
    });
    await userEvent.click(option);
    await waitFor(async () => expect(await store.getCrypt()).toHaveLength(before - 1));
    expect([...fake.tabs.values()].some((t) => t.url === 'https://news.ycombinator.com/')).toBe(true);
    expect((await store.getCrypt()).some((c) => c.url === 'https://news.ycombinator.com/')).toBe(false);
    expect(window.location.hash).toBe('#/crypt');
  });

  it('Dawn saves every starving tab to the crypt and closes it, sparing protected tabs', async () => {
    await mountCrypt();
    const cryptBefore = (await store.getCrypt()).length;
    const dawnButton = screen.getByRole('button', { name: /Dawn/ });
    expect(dawnButton.textContent).toBe('Dawn · burn 8');
    await userEvent.click(dawnButton);
    await waitFor(async () => expect(await store.getCrypt()).toHaveLength(cryptBefore + 8), { timeout: 3000 });
    await waitFor(() => expect(cardCount()).toBe(SEEDED_CARDS - 8), { timeout: 3000 });
    const open = [...fake.tabs.values()];
    expect(open.some((t) => t.title === 'Inbox – Gmail')).toBe(true); // pinned
    expect(open.some((t) => t.title === 'Roadmap – Notion')).toBe(true); // garlic
    expect(open.some((t) => t.title === 'Home / X')).toBe(false); // starving
    expect((await store.getStats()).dawns).toBe(3);
    await waitFor(() => expect(vampires()).toBe(String(SEEDED_CARDS - 8)));
  });
});

describe('demo search, haunts, links and Blood Bank', () => {
  it('search shows a notice with the text, calls search.query and stays on the page', async () => {
    await mountCrypt();
    await userEvent.type(searchBox(), 'vampire bats{Enter}');
    await waitFor(() => expect(fake.searches).toEqual([{ text: 'vampire bats', disposition: 'CURRENT_TAB' }]));
    await waitFor(() => expect(notice()).toContain('Searched for "vampire bats"'));
    expect(window.location.hash).toBe('#/crypt');
    expect(screen.getByRole('main')).toBeTruthy();
  });

  it('Add page adds a haunt, up to MAX_HAUNTS', async () => {
    await mountCrypt();
    const start = (await store.getHaunts()).length;
    expect(start).toBeLessThan(MAX_HAUNTS);
    for (let i = start; i < MAX_HAUNTS; i++) {
      await userEvent.click(within(row()).getByRole('button', { name: 'Add page' }));
      const form = screen.getByRole('dialog', { name: 'Add a page' });
      await userEvent.type(within(form).getByLabelText('Web address'), `extra${i}.example.com{Enter}`);
      await waitFor(async () => expect(await store.getHaunts()).toHaveLength(i + 1));
    }
    await waitFor(() => expect(within(row()).getAllByRole('link')).toHaveLength(MAX_HAUNTS));
    expect(within(row()).getByRole('button', { name: 'Add page' }).getAttribute('aria-disabled')).toBe('true');
  });

  it('Blood Bank shows the earlier stats and log', async () => {
    await mountCrypt();
    await userEvent.click(screen.getByRole('button', { name: 'Blood Bank' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'The Blood Bank' })).toBeTruthy();
    expect(window.location.hash).toBe('#/bloodbank');
    const slain = screen.getByText('Vampires slain').closest('.bb-tile')!;
    await waitFor(() => expect(slain.querySelector('dd')!.textContent).toBe('12'));
    const log = screen.getByRole('heading', { level: 2, name: 'Hunt log' }).closest('section')!;
    expect(within(log).getByText('Explore / Twitter')).toBeTruthy();
    expect(within(log).getAllByText('Dawn').length).toBe(1);
  });

  it('a tab suggestion shows a notice and keeps the hash', async () => {
    await mountCrypt();
    await userEvent.type(searchBox(), 'Figma');
    const option = await waitFor(() => {
      const el = document.querySelector('[role="option"][data-kind="tab"]');
      expect(el).toBeTruthy();
      return el as HTMLElement;
    });
    await userEvent.click(option);
    await waitFor(() => expect(notice()).toContain('In the extension this switches to'));
    expect(window.location.hash).toBe('#/crypt');
  });

  it('a haunt link shows a notice, does not navigate and keeps the hash', async () => {
    await mountCrypt();
    const link = await within(row()).findByRole('link', { name: /GitHub/ });
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    act(() => void link.dispatchEvent(click));
    expect(click.defaultPrevented).toBe(true);
    await waitFor(() => expect(notice()).toBe('In the extension this opens github.com.'));
    expect(window.location.hash).toBe('#/crypt');
  });
});

describe('reset', () => {
  it('after Stake and Dawn restores the seeded cards and stats and keeps the route', async () => {
    await mountCrypt();
    const seeded = await store.getStats();
    await userEvent.click(button(await cardFor('Claude'), 'Stake'));
    await gone('Claude');
    await userEvent.click(screen.getByRole('button', { name: /Dawn/ }));
    await waitFor(() => expect(cardCount()).toBeLessThan(SEEDED_CARDS - 1), { timeout: 3000 });
    expect((await store.getStats()).staked).toBe(seeded.staked + 1);

    await userEvent.click(screen.getByRole('button', { name: 'Reset demo' }));
    await waitFor(() => expect(cardCount()).toBe(SEEDED_CARDS), { timeout: 3000 });
    expect(await store.getStats()).toEqual(seeded);
    expect(await store.getCrypt()).toHaveLength(3);
    expect(window.location.hash).toBe('#/crypt');
    await waitFor(() => expect(vampires()).toBe(String(SEEDED_CARDS)));
  });
});
