// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TabCard } from '../../entrypoints/newtab/components/TabCard';
import { clearPortraitsReady, setPortraitReady } from '../../entrypoints/newtab/layers/portraitReady';
import { DAY_MS } from '../../lib/hunger';
import { buildCards } from '../../lib/view';

const NOW = 100 * DAY_MS;
const card = (id: number) =>
  buildCards(
    [{ id, windowId: 1, url: `https://s${id}.com/`, title: `T${id}`, active: false, audible: false, discarded: false, pinned: false, lastAccessed: NOW - 1000 }],
    undefined,
    'chrome-extension://x/',
    [],
    NOW,
  )[0]!;

afterEach(() => {
  cleanup();
  clearPortraitsReady();
});

describe('portrait slot and the 3D hole', () => {
  it('shows the 2D emblem and no hole until the vampire is ready', () => {
    render(<ul><TabCard card={card(1)} busy={false} index={0} onAction={() => {}} /></ul>);
    const li = document.querySelector('.card') as HTMLElement;
    expect(li.hasAttribute('data-3d')).toBe(false);
    expect(li.querySelector('.portrait-slot .emblem')).not.toBeNull();
    expect(li.querySelector('.portrait-slot')?.hasAttribute('data-portrait-slot')).toBe(true);
  });
  it('turns the hole on for the card that is ready, and only that card', () => {
    render(
      <ul>
        <TabCard card={card(1)} busy={false} index={0} onAction={() => {}} />
        <TabCard card={card(2)} busy={false} index={1} onAction={() => {}} />
      </ul>,
    );
    act(() => setPortraitReady(2, true));
    const [a, b] = [...document.querySelectorAll<HTMLElement>('.card')];
    expect(a!.dataset['3d']).toBeUndefined();
    expect(b!.dataset['3d']).toBe('on');
    // The emblem stays in the page and fades out with CSS, so there is no blank frame.
    expect(b!.querySelector('.emblem')).not.toBeNull();
    act(() => setPortraitReady(2, false));
    expect(b!.dataset['3d']).toBeUndefined();
  });
  it('keeps the hole while a card is exiting, so its exit animation can play', () => {
    render(<ul><TabCard card={card(3)} busy={false} index={0} exiting exitKind="stake" exitMs={1000} exitFadeDelayMs={740} onAction={() => {}} /></ul>);
    act(() => setPortraitReady(3, true));
    expect((document.querySelector('.card') as HTMLElement).dataset['3d']).toBe('on');
  });
});
