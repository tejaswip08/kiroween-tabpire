// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StateLegend } from '../../entrypoints/newtab/components/StateLegend';
import { POPUP_DELAY_MS, TabCard } from '../../entrypoints/newtab/components/TabCard';
import { DAY_MS } from '../../lib/hunger';
import { buildCards, type RawTab } from '../../lib/view';

const NOW = 100 * DAY_MS;
const raw = (id: number, over: Partial<RawTab> = {}): RawTab => ({
  id, windowId: 1, url: `https://site${id}.com/`, title: `Page ${id}`, active: false, audible: false, discarded: false, pinned: false, lastAccessed: NOW - 1000, ...over,
});
const cardsOf = (tabs: RawTab[], garlic: string[] = []) => buildCards(tabs, undefined, 'chrome-extension://x/', garlic, NOW);
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('state legend', () => {
  const cards = cardsOf([
    raw(1), raw(2), raw(3, { lastAccessed: NOW - 2 * DAY_MS }), raw(4, { url: 'https://safe.com/' }),
  ], ['safe.com']);
  it('shows four chips with live counts and hints, and dims the empty ones', () => {
    render(<StateLegend cards={cards} filter={null} onToggle={() => {}} />);
    const chips = screen.getAllByRole('button');
    expect(chips.map((c) => c.querySelector('.legend-label')!.textContent)).toEqual(['Awake', 'Starving', 'Asleep', 'Protected']);
    expect(chips.map((c) => c.querySelector('.legend-count')!.textContent)).toEqual(['2', '1', '0', '1']);
    expect(chips.map((c) => c.querySelector('.legend-hint')!.textContent)).toEqual(['used < 1 day', 'idle 1 day+', 'in a coffin', 'garlic']);
    expect(chips[2]!.hasAttribute('data-empty')).toBe(true);
    expect(chips[0]!.hasAttribute('data-empty')).toBe(false);
  });
  it('reports the clicked state and marks the chosen chip as pressed', () => {
    const onToggle = vi.fn();
    render(<StateLegend cards={cards} filter="starving" onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button', { name: /Starving/ }));
    expect(onToggle).toHaveBeenCalledWith('starving');
    expect(screen.getByRole('button', { name: /Starving/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /Awake/ }).getAttribute('aria-pressed')).toBe('false');
  });
});

describe('card hover popup', () => {
  const renderCard = () => {
    const card = cardsOf([raw(1, { title: 'A very long page title for a tab', lastAccessed: NOW - 15 * 60 * 60 * 1000 })])[0]!;
    render(
      <ul>
        <TabCard card={card} busy={false} index={0} onAction={() => {}} />
      </ul>,
    );
    return document.querySelector('.card') as HTMLElement;
  };
  it('opens after the hover delay with the quote, the explanation and the facts, and closes on leave', () => {
    vi.useFakeTimers();
    const li = renderCard();
    fireEvent.mouseEnter(li);
    expect(document.querySelector('.card-popup')).toBeNull();
    act(() => void vi.advanceTimersByTime(POPUP_DELAY_MS - 10));
    expect(document.querySelector('.card-popup')).toBeNull();
    act(() => void vi.advanceTimersByTime(20));
    const pop = document.querySelector('.card-popup') as HTMLElement;
    expect(pop).not.toBeNull();
    expect(pop.getAttribute('role')).toBe('tooltip');
    expect(pop.textContent).toContain('A very long page title for a tab');
    expect(pop.textContent).toContain('Awake · Hunger 63%');
    expect(pop.textContent).toContain('You visited me 15 hours ago.');
    expect(pop.textContent).toContain('Used in the last day.');
    expect(within(pop).getByText('15 h ago')).toBeTruthy();
    expect(li.getAttribute('aria-describedby')).toBe(pop.id);
    fireEvent.mouseLeave(li);
    expect(document.querySelector('.card-popup')).toBeNull();
  });
  it('does not open when the pointer leaves early, and closes with Escape', () => {
    vi.useFakeTimers();
    const li = renderCard();
    fireEvent.mouseEnter(li);
    act(() => void vi.advanceTimersByTime(100));
    fireEvent.mouseLeave(li);
    act(() => void vi.advanceTimersByTime(1000));
    expect(document.querySelector('.card-popup')).toBeNull();
    fireEvent.mouseEnter(li);
    act(() => void vi.advanceTimersByTime(POPUP_DELAY_MS + 5));
    expect(document.querySelector('.card-popup')).not.toBeNull();
    fireEvent.keyDown(li, { key: 'Escape' });
    expect(document.querySelector('.card-popup')).toBeNull();
  });
});
