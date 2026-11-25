// @vitest-environment jsdom
// The reusable rich tip: opens on hover and keyboard focus, has the prototype layout, stays on screen and never
// covers the button it belongs to.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Tooltip } from '../../entrypoints/newtab/components/Tooltip';
import { actionTip } from '../../lib/tips';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const content = actionTip('stake', { site: 'a.com', mb: 120, state: 'starving', info: { active: false, audible: false, lastAccessed: 1 }, hungerMs: 0 });

function setup(rect: { left: number; top: number; width: number; height: number }) {
  render(
    <Tooltip content={content}>
      {(d) => (
        <button type="button" {...d}>
          Stake
        </button>
      )}
    </Tooltip>,
  );
  const button = screen.getByRole('button', { name: 'Stake' });
  vi.spyOn(button, 'getBoundingClientRect').mockReturnValue({ ...rect, right: rect.left + rect.width, bottom: rect.top + rect.height, x: rect.left, y: rect.top, toJSON() {} } as DOMRect);
  const tip = screen.getByRole('tooltip', { hidden: true });
  Object.defineProperty(tip, 'offsetWidth', { value: 240 });
  Object.defineProperty(tip, 'offsetHeight', { value: 150 });
  return { button, tip };
}

describe('rich tip', () => {
  it('has an UPPERCASE title, the line in quotes, a bullet per point and a small note, and is the button’s description', () => {
    const { button, tip } = setup({ left: 500, top: 400, width: 28, height: 28 });
    expect(button.getAttribute('aria-describedby')).toBe(tip.id);
    expect(tip.querySelector('.tip-title')!.textContent).toBe('STAKE · CLOSE FOR GOOD');
    expect(tip.querySelector('.tip-says')!.textContent).toBe('“A stake? Through my heart?! …Fine. Take your blood back.”');
    expect([...tip.querySelectorAll('.tip-point')].map((p) => p.textContent)).toEqual(['Closes this tab now and gives you back ~120 MB.']);
    expect(tip.querySelector('.tip-note')!.textContent).toBe('Not saved anywhere. Want to read it later? Use Crypt instead.');
    // In a portal at the end of the body, so a scaled card never shrinks it.
    expect(tip.parentElement).toBe(document.body);
  });
  it('opens on hover above the button, and Escape closes it', () => {
    const { button, tip } = setup({ left: 500, top: 400, width: 28, height: 28 });
    expect(tip.hasAttribute('data-open')).toBe(false);
    act(() => void fireEvent.mouseEnter(button.parentElement!));
    expect(tip.getAttribute('data-open')).toBe('true');
    const top = parseFloat(tip.style.top);
    expect(top + 150).toBeLessThanOrEqual(400); // ends above the button: it never covers it
    fireEvent.keyDown(button, { key: 'Escape' });
    expect(tip.hasAttribute('data-open')).toBe(false);
  });
  it('flips beside or below a button at the top of the window, inside the window and off the button', () => {
    const { button, tip } = setup({ left: 2, top: 20, width: 28, height: 28 });
    act(() => void fireEvent.mouseEnter(button.parentElement!));
    const left = parseFloat(tip.style.left);
    const top = parseFloat(tip.style.top);
    expect(left).toBeGreaterThanOrEqual(8);
    expect(top).toBeGreaterThanOrEqual(8);
    const overlaps = left < 30 && left + 240 > 2 && top < 48 && top + 150 > 20;
    expect(overlaps).toBe(false);
  });
  it('opens on keyboard focus', () => {
    const { button, tip } = setup({ left: 500, top: 400, width: 28, height: 28 });
    vi.spyOn(button, 'matches').mockReturnValue(true);
    act(() => void fireEvent.focus(button));
    expect(tip.getAttribute('data-open')).toBe('true');
  });
});
