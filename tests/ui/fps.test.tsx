// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FpsReadout } from '../../entrypoints/newtab/layers/FpsReadout';
import { createFpsStore, fpsRequested, fpsStore } from '../../entrypoints/newtab/layers/fpsStore';

afterEach(() => {
  cleanup();
  fpsStore.reset();
  window.history.replaceState(null, '', '/');
});

describe('fps store', () => {
  it('counts the frames of the last second and the worst frame', () => {
    const s = createFpsStore();
    for (let i = 0; i < 90; i++) s.record('scene', i * 20, i === 40 ? 33.3 : 16.7, 80, 31_000);
    // 90 frames, 20 ms apart: the last second holds 51 of them (times 780 to 1780).
    const snap = s.get();
    expect(snap.fps).toBeGreaterThan(40);
    expect(snap.fps).toBeLessThanOrEqual(51);
    expect(snap.scene).toEqual({ calls: 80, triangles: 31_000 });
  });
  it('keeps scene and portrait counts apart, and only the scene sets the rate', () => {
    const s = createFpsStore();
    s.record('portrait', 0, 16, 12, 98_000);
    s.record('scene', 300, 16, 70, 20_000);
    const snap = s.get();
    expect(snap.portrait).toEqual({ calls: 12, triangles: 98_000 });
    expect(snap.scene).toEqual({ calls: 70, triangles: 20_000 });
    expect(snap.fps).toBe(1);
  });
  it('tells subscribers at most every 250 ms', () => {
    const s = createFpsStore();
    let n = 0;
    s.subscribe(() => n++);
    for (let t = 0; t < 1000; t += 10) s.record('scene', t, 10, 1, 1);
    expect(n).toBe(4);
  });
  it('knows when the address asks for it', () => {
    expect(fpsRequested('chrome-extension://x/newtab.html#fps')).toBe(true);
    expect(fpsRequested('chrome-extension://x/newtab.html')).toBe(false);
    expect(fpsRequested('chrome-extension://x/newtab.html#fps2')).toBe(false);
  });
});

describe('FpsReadout', () => {
  it('is hidden without #fps', () => {
    render(<FpsReadout />);
    expect(document.querySelector('.fps-readout')).toBeNull();
  });
  it('shows frames, frame time, draw calls and triangles with #fps, and follows the address', () => {
    window.history.replaceState(null, '', '/#fps');
    render(<FpsReadout />);
    const box = document.querySelector('.fps-readout') as HTMLElement;
    expect(box).not.toBeNull();
    expect(box.getAttribute('aria-hidden')).toBe('true');
    act(() => fpsStore.record('scene', 1000, 16.7, 85, 31_200));
    act(() => fpsStore.record('portrait', 1001, 16.7, 12, 98_000));
    act(() => fpsStore.record('scene', 1300, 20.5, 85, 31_200));
    expect(box.textContent).toContain('fps');
    expect(box.textContent).toContain('worst 20.5 ms');
    expect(box.textContent).toContain('scene 85 calls, 31,200 tris');
    act(() => {
      window.history.replaceState(null, '', '/');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(document.querySelector('.fps-readout')).toBeNull();
  });
});
