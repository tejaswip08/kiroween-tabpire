// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CardGrid } from '../../entrypoints/newtab/components/CardGrid';
import { TabCard } from '../../entrypoints/newtab/components/TabCard';
import { EXIT_MS } from '../../entrypoints/newtab/hooks/useExitingCards';
import { DAY_MS } from '../../lib/hunger';
import { buildCards, type RawTab } from '../../lib/view';

const NOW = 100 * DAY_MS;

const raw = (id: number, over: Partial<RawTab> = {}): RawTab => ({
  id,
  windowId: 1,
  url: `https://site${id}.com/`,
  title: `Page ${id}`,
  active: false,
  audible: false,
  discarded: false,
  pinned: false,
  lastAccessed: NOW - 1000,
  ...over,
});

const cardsOf = (tabs: RawTab[], garlic: string[] = []) => buildCards(tabs, undefined, 'chrome-extension://x/', garlic, NOW);
const cardOf = (tab: RawTab, garlic: string[] = []) => cardsOf([tab], garlic)[0]!;

const renderCard = (tab: RawTab, opts: { garlic?: string[]; busy?: boolean } = {}) => {
  const onAction = vi.fn();
  render(
    <ul>
      <TabCard card={cardOf(tab, opts.garlic)} busy={opts.busy ?? false} index={0} onAction={onAction} />
    </ul>,
  );
  return { onAction, card: document.querySelector('.card') as HTMLElement };
};

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('TabCard by state', () => {
  const cases: [string, RawTab, string[], string, string, string][] = [
    ['awake', raw(1, { lastAccessed: NOW - 2 * 60 * 60 * 1000 }), [], 'Awake', '2 h', '2 hours idle'],
    ['starving', raw(2, { lastAccessed: NOW - 2 * DAY_MS }), [], 'Starving', '2 d', '2 days idle'],
    ['asleep', raw(3, { discarded: true, lastAccessed: NOW - 2 * DAY_MS }), [], 'Asleep', '2 d', '2 days idle'],
    ['protected', raw(4, { url: 'https://safe.com/', lastAccessed: NOW - 2 * DAY_MS }), ['safe.com'], 'Protected', '2 d', '2 days idle'],
  ];

  it.each(cases)('%s card shows its rim, state word, idle text, memory and hunger bar', (state, tab, garlic, word, age, idle) => {
    const { card } = renderCard(tab, { garlic });
    expect(card.dataset.state).toBe(state);
    expect(within(card).getByText(word)).toBeTruthy();
    expect(within(card).getByText(age)).toBeTruthy();
    expect(within(card).getByText(/^~\d+ MB$/)).toBeTruthy();
    expect(within(card).getByRole('img', { name: `Hunger meter: ${idle}` })).toBeTruthy();
    expect(card.querySelector('.portrait-slot')?.getAttribute('data-state')).toBe(state);
  });

  it('shows a state shape beside the word, so state is not only colour', () => {
    const { card } = renderCard(cases[1]![1]);
    expect(card.querySelector('.state-badge svg')).not.toBeNull();
  });

  it('fills the hunger bar in proportion to idle time, full at one day', () => {
    const { card } = renderCard(raw(1, { lastAccessed: NOW - 0.5 * DAY_MS }));
    expect(card.querySelector('.hunger-bar')?.getAttribute('data-fill')).toBe('0.500');
  });

  it('shows the site and a plain note for non-web pages', () => {
    expect(renderCard(raw(1, { url: 'https://www.example.com/a' })).card.textContent).toContain('example.com');
    cleanup();
    expect(renderCard(raw(2, { url: 'chrome://extensions' })).card.textContent).toContain('Not a web page');
  });

  it('shows In use now for the active tab', () => {
    const { card } = renderCard(raw(1, { active: true, lastAccessed: NOW - 5 * DAY_MS }));
    expect(within(card).getByText('now')).toBeTruthy();
    expect(within(card).getByRole('img', { name: 'Hunger meter: In use now' })).toBeTruthy();
  });
});

describe('TabCard titles and icons', () => {
  it('keeps the full title for long titles', () => {
    const long = 'A very long title '.repeat(10).trim();
    const { card } = renderCard(raw(1, { title: long }));
    const heading = within(card).getByRole('heading', { level: 3 });
    expect(heading.textContent).toBe(long);
    expect(heading.getAttribute('title')).toBe(long);
  });

  it('repeats the full title in every button tooltip, so keyboard users can read it on focus', () => {
    const long = 'A very long title that will be cut with an ellipsis on the card '.repeat(3).trim();
    const { card } = renderCard(raw(1, { title: long }));
    const buttons = within(card).getAllByRole('button');
    expect(buttons).toHaveLength(4);
    for (const button of buttons) {
      const tip = document.getElementById(button.getAttribute('aria-describedby')!)!;
      expect(tip.querySelector('.tip-note')?.textContent).toBe(long);
      expect(tip.querySelector('.tip-text')?.textContent).not.toBe(long);
    }
  });

  it('falls back to the site name, then "Untitled tab"', () => {
    expect(within(renderCard(raw(1, { title: '  ' })).card).getByRole('heading').textContent).toBe('site1.com');
    cleanup();
    expect(within(renderCard(raw(2, { title: '', url: 'chrome://extensions' })).card).getByRole('heading').textContent).toBe('Untitled tab');
  });

  it('shows the tab icon, and a letter badge when there is none', () => {
    const { card } = renderCard(raw(1, { favIconUrl: 'https://site1.com/icon.png' }));
    expect(card.querySelector('img')?.getAttribute('src')).toBe('https://site1.com/icon.png');
    cleanup();
    const second = renderCard(raw(2, { favIconUrl: undefined }));
    expect(second.card.querySelector('img')).toBeNull();
    expect(within(second.card).getByText('S')).toBeTruthy();
  });

  it('switches to the letter badge when the image fails to load', () => {
    const { card } = renderCard(raw(1, { favIconUrl: 'https://site1.com/icon.png' }));
    fireEvent.error(card.querySelector('img')!);
    expect(card.querySelector('img')).toBeNull();
    expect(within(card).getByText('S')).toBeTruthy();
  });
});

describe('CardGrid', () => {
  const grid = (cards: ReturnType<typeof cardsOf>) => (
    <CardGrid cards={cards} busyIds={new Set()} allBusy={false} onAction={() => {}} />
  );

  it('is a labelled list with one item per card, in order', () => {
    const cards = cardsOf([raw(1, { lastAccessed: NOW - DAY_MS }), raw(2, { lastAccessed: NOW - 3 * DAY_MS }), raw(3)]);
    render(grid(cards));
    expect(screen.getByRole('heading', { level: 2 }).textContent).toContain('Open tabs');
    const items = screen.getAllByRole('listitem');
    expect(items.map((i) => (i as HTMLElement).dataset.tabId)).toEqual(['2', '1', '3']);
  });

  it('keeps a removed card for one exit animation, then drops it', () => {
    vi.useFakeTimers();
    const all = cardsOf([raw(1), raw(2), raw(3)]);
    const { rerender } = render(grid(all));
    rerender(grid(all.filter((c) => c.tab.id !== 2)));

    const exiting = document.querySelector('.card-exiting') as HTMLElement;
    expect(exiting).not.toBeNull();
    expect(exiting.dataset.tabId).toBe('2');
    expect(exiting.getAttribute('aria-hidden')).toBe('true');
    expect(exiting.hasAttribute('inert')).toBe(true);
    // It stays at its old position.
    expect([...document.querySelectorAll('.card')].map((c) => (c as HTMLElement).dataset.tabId)).toEqual(['1', '2', '3']);
    // Screen readers see only the live cards.
    expect(screen.getAllByRole('listitem')).toHaveLength(2);

    act(() => void vi.advanceTimersByTime(EXIT_MS + 5));
    expect(document.querySelector('.card-exiting')).toBeNull();
    expect(document.querySelectorAll('.card')).toHaveLength(2);
  });

  it('drops a removed card at once with reduced motion', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} }));
    const all = cardsOf([raw(1), raw(2)]);
    const { rerender } = render(grid(all));
    rerender(grid([all[0]!]));
    expect(document.querySelector('.card-exiting')).toBeNull();
    expect(document.querySelectorAll('.card')).toHaveLength(1);
  });

  it('does not show an exiting copy of a card that came back', () => {
    vi.useFakeTimers();
    const all = cardsOf([raw(1), raw(2)]);
    const { rerender } = render(grid(all));
    rerender(grid([all[0]!]));
    rerender(grid(all));
    expect(document.querySelector('.card-exiting')).toBeNull();
    expect(document.querySelectorAll('.card')).toHaveLength(2);
    act(() => void vi.advanceTimersByTime(EXIT_MS + 5));
    expect(document.querySelectorAll('.card')).toHaveLength(2);
  });

  it('has a fixed-size portrait slot on every card', () => {
    render(grid(cardsOf([raw(1), raw(2, { discarded: true })])));
    expect(document.querySelectorAll('.portrait-slot')).toHaveLength(2);
  });
});

beforeEach(() => {
  document.body.innerHTML = '';
});
