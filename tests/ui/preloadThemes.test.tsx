// @vitest-environment jsdom
// Task 16.2: idle preload of the other themes' model files.
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const preloadSpy = vi.hoisted(() => vi.fn());
vi.mock('@react-three/drei', () => ({ useGLTF: Object.assign(() => ({}), { preload: preloadSpy }) }));

import {
  PRELOAD_FALLBACK_MS, PRELOAD_PER_SLOT, pendingFiles, resetPreloadState, scheduleIdle, startThemePreload, themeFiles, useThemePreload,
} from '../../entrypoints/newtab/layers/scene/preloadThemes';
import { DISABLED_THEMES, THEME_IDS } from '../../lib/themes';

const otherFiles = (current: (typeof THEME_IDS)[number]) => {
  const own = new Set(themeFiles(current));
  return new Set(THEME_IDS.filter((id) => id !== current && !DISABLED_THEMES.includes(id)).flatMap(themeFiles).filter((u) => !own.has(u)));
};

/** A manual idle scheduler: each `run()` is one idle slot. */
function manual() {
  let queued: (() => void) | undefined;
  const cancel = vi.fn(() => {
    queued = undefined;
  });
  return {
    schedule: vi.fn((fn: () => void) => {
      queued = fn;
      return cancel;
    }),
    cancel,
    run() {
      const fn = queued;
      queued = undefined;
      fn?.();
    },
    get pending() {
      return queued !== undefined;
    },
  };
}

beforeEach(() => {
  resetPreloadState();
  preloadSpy.mockClear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('startThemePreload', () => {
  it('loads two files per idle slot, each file once, only files of the other themes', () => {
    const preload = vi.fn();
    const s = manual();
    startThemePreload('crypt', { preload, schedule: s.schedule, asked: new Set() });
    expect(preload).not.toHaveBeenCalled(); // nothing until the first idle slot
    let slots = 0;
    while (s.pending && slots < 500) {
      const before = preload.mock.calls.length;
      s.run();
      slots++;
      expect(preload.mock.calls.length - before).toBeLessThanOrEqual(PRELOAD_PER_SLOT);
    }
    const urls = preload.mock.calls.map((c) => c[0] as string);
    expect(new Set(urls).size).toBe(urls.length);
    expect(new Set(urls)).toEqual(otherFiles('crypt'));
    for (const own of themeFiles('crypt')) expect(urls).not.toContain(own);
    expect(slots).toBe(Math.ceil(urls.length / PRELOAD_PER_SLOT) + 1); // the last slot finds nothing left
  });

  it('skips a file that was already asked for', () => {
    const asked = new Set<string>();
    const first = pendingFiles('crypt', asked)[0]!;
    asked.add(first);
    expect(pendingFiles('crypt', asked)).not.toContain(first);
  });

  it('stops when stopped: the queued slot is cancelled and nothing more loads', () => {
    const preload = vi.fn();
    const s = manual();
    const stop = startThemePreload('crypt', { preload, schedule: s.schedule, asked: new Set() });
    s.run();
    const n = preload.mock.calls.length;
    stop();
    expect(s.cancel).toHaveBeenCalled();
    s.run();
    expect(preload.mock.calls.length).toBe(n);
  });

  it('does not run a slot that was already due when it is stopped', () => {
    const preload = vi.fn();
    let due: (() => void) | undefined;
    const stop = startThemePreload('crypt', { preload, schedule: (fn) => ((due = fn), () => {}), asked: new Set() });
    stop();
    due?.();
    expect(preload).not.toHaveBeenCalled();
  });
});

describe('scheduleIdle', () => {
  it('uses requestIdleCallback when it exists', () => {
    const ric = vi.fn(() => 7);
    const cic = vi.fn();
    vi.stubGlobal('requestIdleCallback', ric);
    vi.stubGlobal('cancelIdleCallback', cic);
    const fn = vi.fn();
    const cancel = scheduleIdle(fn);
    expect(ric).toHaveBeenCalledWith(fn);
    cancel();
    expect(cic).toHaveBeenCalledWith(7);
  });

  it('uses setTimeout(…, 200) when requestIdleCallback is missing', () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestIdleCallback', undefined);
    const spy = vi.spyOn(globalThis, 'setTimeout');
    const fn = vi.fn();
    scheduleIdle(fn);
    expect(spy).toHaveBeenCalledWith(fn, PRELOAD_FALLBACK_MS);
    expect(PRELOAD_FALLBACK_MS).toBe(200);
    vi.advanceTimersByTime(199);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('cancels the timer', () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestIdleCallback', undefined);
    const fn = vi.fn();
    scheduleIdle(fn)();
    vi.advanceTimersByTime(1000);
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('useThemePreload', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('requestIdleCallback', undefined);
  });

  it('starts only after the first-frame signal', () => {
    const { rerender } = renderHook(({ ready }) => useThemePreload(ready, 'crypt'), { initialProps: { ready: false } });
    vi.advanceTimersByTime(5000);
    expect(preloadSpy).not.toHaveBeenCalled();
    rerender({ ready: true });
    expect(preloadSpy).not.toHaveBeenCalled(); // waits for an idle slot
    vi.advanceTimersByTime(PRELOAD_FALLBACK_MS);
    expect(preloadSpy).toHaveBeenCalledTimes(PRELOAD_PER_SLOT);
  });

  it('preloads each model once through useGLTF.preload(url, false, true), and stops on unmount', () => {
    const { unmount } = renderHook(() => useThemePreload(true, 'crypt'));
    vi.advanceTimersByTime(PRELOAD_FALLBACK_MS * 400);
    const calls = preloadSpy.mock.calls;
    const urls = calls.map((c) => c[0] as string);
    expect(new Set(urls).size).toBe(urls.length);
    expect(new Set(urls)).toEqual(otherFiles('crypt'));
    for (const c of calls) expect(c.slice(1)).toEqual([false, true]);
    expect(vi.getTimerCount()).toBe(0);
    // A second page mounts: nothing is requested twice.
    preloadSpy.mockClear();
    renderHook(() => useThemePreload(true, 'crypt'));
    vi.advanceTimersByTime(PRELOAD_FALLBACK_MS * 10);
    expect(preloadSpy).not.toHaveBeenCalled();
    unmount();
  });

  it('stops on unmount: no timer is left and nothing more loads', () => {
    const { unmount } = renderHook(() => useThemePreload(true, 'crypt'));
    vi.advanceTimersByTime(PRELOAD_FALLBACK_MS);
    const n = preloadSpy.mock.calls.length;
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(PRELOAD_FALLBACK_MS * 50);
    expect(preloadSpy.mock.calls.length).toBe(n);
  });

  it('reads only the extension\'s own files and makes no fetch call', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    renderHook(() => useThemePreload(true, 'frost'));
    vi.advanceTimersByTime(PRELOAD_FALLBACK_MS * 400);
    expect(preloadSpy).toHaveBeenCalled();
    for (const c of preloadSpy.mock.calls) expect(String(c[0])).toMatch(/^\/models\/(quaternius|kaykit)\/[\w.-]+\.(glb|gltf)$|^\/models\/coffin\.glb$/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
