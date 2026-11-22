// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('wxt/browser', async () => {
  const m = await import('../helpers/fakeBrowser');
  return { browser: m.browser };
});
import { fake } from '../helpers/fakeBrowser';
import { App } from '../../entrypoints/newtab/App';
import { CardGrid } from '../../entrypoints/newtab/components/CardGrid';
import { markActionExit, markDawnExits } from '../../entrypoints/newtab/hooks/exitMarks';
import { EXIT_MS } from '../../entrypoints/newtab/hooks/useExitingCards';
import { DAY_MS } from '../../lib/hunger';
import { onSceneEvent, type SceneEvent } from '../../lib/scene/bus';
import { clearMarks, markExit, peekExit, takeTransition } from '../../lib/scene/exitKinds';
import { EXIT_MS as DURATIONS, dawnDelayMs } from '../../lib/vampire/exits';
import { buildCards, type RawTab } from '../../lib/view';

const NOW = 100 * DAY_MS;
const raw = (id: number, over: Partial<RawTab> = {}): RawTab => ({
  id, windowId: 1, url: `https://site${id}.com/`, title: `Page ${id}`, active: false, audible: false,
  discarded: false, pinned: false, lastAccessed: NOW - 1000, ...over,
});
const cardsOf = (tabs: RawTab[], garlic: string[] = []) => buildCards(tabs, undefined, 'chrome-extension://x/', garlic, NOW);
const grid = (cards: ReturnType<typeof cardsOf>) => (
  <CardGrid cards={cards} busyIds={new Set()} allBusy={false} onAction={() => {}} />
);

beforeEach(() => clearMarks());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('ghost durations per action', () => {
  const leave = (id: number, kind?: 'stake' | 'crypt' | 'dawn', order = 0) => {
    vi.useFakeTimers();
    const all = cardsOf([raw(1), raw(2), raw(3)]);
    const { rerender } = render(grid(all));
    if (kind) markExit(id, kind, order);
    rerender(grid(all.filter((c) => c.tab.id !== id)));
    return document.querySelector('.card-exiting') as HTMLElement;
  };
  const stays = (ms: number) => {
    act(() => void vi.advanceTimersByTime(ms));
    return document.querySelector('.card-exiting') !== null;
  };

  it.each([
    ['stake', DURATIONS.stake],
    ['crypt', DURATIONS.crypt],
  ] as const)('%s keeps the card for its own duration and fades only at the end', (kind, ms) => {
    const ghost = leave(2, kind);
    expect(ghost.dataset.exit).toBe(kind);
    expect(ghost.style.getPropertyValue('--exit-ms')).toBe(`${ms}ms`);
    expect(ghost.style.getPropertyValue('--exit-fade-delay')).toBe(`${ms - 260}ms`);
    expect(stays(ms - 10)).toBe(true);
    expect(stays(20)).toBe(false);
  });
  it('dawn waits longer for cards later in the order', () => {
    const ghost = leave(2, 'dawn', 3);
    const ms = DURATIONS.dawn + dawnDelayMs(3);
    expect(ghost.style.getPropertyValue('--exit-ms')).toBe(`${ms}ms`);
    expect(ghost.style.getPropertyValue('--exit-fade-delay')).toBe(`${ms - 260}ms`);
    expect(stays(ms - 10)).toBe(true);
    expect(stays(20)).toBe(false);
  });
  it('a card closed without an action fades and sinks in 260 ms, as before', () => {
    const ghost = leave(2);
    expect(EXIT_MS).toBe(260);
    expect(ghost.dataset.exit).toBe('none');
    expect(ghost.style.getPropertyValue('--exit-fade-delay')).toBe('0ms');
    expect(stays(EXIT_MS - 10)).toBe(true);
    expect(stays(20)).toBe(false);
  });
  it('uses a mark once and not for a different card', () => {
    leave(2, 'stake');
    expect(peekExit(2)).toBeUndefined();
  });
  it('removes the ghost at once with reduced motion, whatever the mark', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} }));
    const all = cardsOf([raw(1), raw(2)]);
    const { rerender } = render(grid(all));
    markExit(2, 'dawn', 0);
    rerender(grid([all[0]!]));
    expect(document.querySelector('.card-exiting')).toBeNull();
    expect(document.querySelectorAll('.card')).toHaveLength(1);
  });
});

describe('marking exits', () => {
  it('marks Dawn targets in card order and skips the others', () => {
    const cards = cardsOf([
      raw(1, { lastAccessed: NOW - 5 * DAY_MS }),
      raw(2, { lastAccessed: NOW - 1000 }),
      raw(3, { lastAccessed: NOW - 3 * DAY_MS }),
      raw(4, { lastAccessed: NOW - 4 * DAY_MS, pinned: true }),
      raw(5, { lastAccessed: NOW - 2 * DAY_MS }),
    ]);
    const { ids } = markDawnExits(cards, [], NOW, false);
    expect(ids).toEqual(cards.map((c) => c.tab.id).filter((id) => [1, 3, 5].includes(id)));
    ids.forEach((id, order) => expect(peekExit(id)).toMatchObject({ kind: 'dawn', order }));
    expect(peekExit(2)).toBeUndefined();
    expect(peekExit(4)).toBeUndefined();
  });
  it('takes Dawn marks back, and marks nothing with reduced motion', () => {
    const cards = cardsOf([raw(1, { lastAccessed: NOW - 5 * DAY_MS })]);
    markDawnExits(cards, [], NOW, false).undo();
    expect(peekExit(1)).toBeUndefined();
    markDawnExits(cards, [], NOW, true);
    expect(peekExit(1)).toBeUndefined();
  });
  it('marks stake and crypt as exits and coffin as a transition', () => {
    markActionExit('stake', 1, false);
    markActionExit('crypt', 2, false);
    const undo = markActionExit('coffin', 3, false);
    expect(peekExit(1)?.kind).toBe('stake');
    expect(peekExit(2)?.kind).toBe('crypt');
    undo();
    expect(takeTransition(3)).toBeUndefined();
    markActionExit('garlic', 4, false);
    expect(peekExit(4)).toBeUndefined();
    markActionExit('stake', 5, true);
    expect(peekExit(5)).toBeUndefined();
  });
});

describe('the page', () => {
  const OLD = () => Date.now() - 3 * DAY_MS;
  beforeEach(() => {
    fake.reset();
    const me = fake.addTab({ url: 'chrome-extension://fake-id/newtab.html', title: 'Tabpire', active: true });
    fake.currentTabId = me.id;
  });
  const events = () => {
    const seen: SceneEvent[] = [];
    onSceneEvent((e) => seen.push(e));
    return seen;
  };

  it('Stake plays the stake exit and tells the scene', async () => {
    fake.addTab({ title: 'Doomed', url: 'https://a.com/', lastAccessed: Date.now() - 1000 });
    fake.addTab({ title: 'Stays', url: 'https://b.com/', lastAccessed: Date.now() - 1000 });
    const seen = events();
    render(<App />);
    const card = (await screen.findByRole('heading', { level: 3, name: 'Doomed' })).closest('.card') as HTMLElement;
    await userEvent.click(within(card).getByRole('button', { name: 'Stake' }));
    await waitFor(() => expect(document.querySelector('.card-exiting')?.getAttribute('data-exit')).toBe('stake'));
    expect(seen).toContainEqual({ type: 'stake' });
  });
  it('Dawn burns every target in card order and tells the scene', async () => {
    [1, 2, 3].forEach((n) => fake.addTab({ title: `Hungry ${n}`, url: `https://h${n}.com/`, lastAccessed: OLD() }));
    fake.addTab({ title: 'Stays', url: 'https://b.com/', lastAccessed: Date.now() - 1000 });
    const seen = events();
    render(<App />);
    await screen.findByRole('heading', { level: 3, name: 'Hungry 1' });
    await userEvent.click(screen.getByRole('button', { name: /Dawn/ }));
    await waitFor(() => expect(document.querySelectorAll('.card-exiting[data-exit="dawn"]')).toHaveLength(3));
    const delays = [...document.querySelectorAll<HTMLElement>('.card-exiting')].map((c) => c.style.getPropertyValue('--exit-ms'));
    expect(new Set(delays).size).toBeGreaterThan(1);
    expect(seen).toContainEqual({ type: 'dawn', closed: 3 });
  });
});
