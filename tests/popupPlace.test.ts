import { describe, expect, it } from 'vitest';
import { placePopup, type Rect } from '../lib/popupPlace';

const VW = 1280;
const VH = 800;
const W = 320;
const H = 300;
const card = (left: number, top: number, w = 220, h = 380): Rect => ({ left, top, right: left + w, bottom: top + h });
const inside = (p: { left: number; top: number }) => p.left >= 8 && p.top >= 8 && p.left + W <= VW - 8 && p.top + H <= VH - 8;

describe('placePopup', () => {
  it('goes above the card, centred on it, when there is room', () => {
    const p = placePopup(card(500, 400), W, H, VW, VH);
    expect(p.side).toBe('above');
    expect(p.left).toBe(500 + 110 - W / 2);
    expect(p.top + H).toBeLessThanOrEqual(400 - 12);
    expect(inside(p)).toBe(true);
  });
  it('slides along the edge so it stays on screen for the first and last cards', () => {
    const first = placePopup(card(10, 400), W, H, VW, VH);
    const last = placePopup(card(VW - 230, 400), W, H, VW, VH);
    expect(first.left).toBe(8);
    expect(last.left).toBe(VW - W - 8);
    expect(inside(first) && inside(last)).toBe(true);
  });
  it('moves to the right side, and flips to the left near the right edge, when there is no room above', () => {
    const right = placePopup(card(100, 150), W, H, VW, VH);
    expect(right.side).toBe('right');
    expect(right.left).toBe(100 + 220 + 12);
    const left = placePopup(card(VW - 260, 150), W, H, VW, VH);
    expect(left.side).toBe('left');
    expect(left.left + W).toBeLessThanOrEqual(VW - 260 - 12);
    expect(inside(right) && inside(left)).toBe(true);
  });
  it('does not overlap the card when it sits beside it', () => {
    for (const x of [20, 300, 900, 1040]) {
      const c = card(x, 120);
      const p = placePopup(c, W, H, VW, VH);
      if (p.side === 'right') expect(p.left).toBeGreaterThanOrEqual(c.right);
      if (p.side === 'left') expect(p.left + W).toBeLessThanOrEqual(c.left);
    }
  });
  it('always returns a spot inside a window that is just big enough', () => {
    const p = placePopup(card(300, 60, 200, 300), W, H, 700, 420);
    expect(p.left).toBeGreaterThanOrEqual(8);
    expect(p.top).toBeGreaterThanOrEqual(8);
  });
});
