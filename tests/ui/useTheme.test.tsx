// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import fc from 'fast-check';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('wxt/browser', async () => {
  const m = await import('../helpers/fakeBrowser');
  return { browser: m.browser };
});
import { browser, fake } from '../helpers/fakeBrowser';
import { useTheme, type ThemeState } from '../../entrypoints/newtab/components/useTheme';
import { store, KEYS } from '../../lib/store';
import { ENABLED_THEME_IDS, type ThemeId } from '../../lib/themes';
import { SKY_CACHE_KEY } from '../../lib/themeCache';

let latest: ThemeState;
let renders = 0;
function Probe() {
  latest = useTheme();
  renders++;
  return (
    <div>
      <p data-testid="theme">{latest.themeId}</p>
      <p data-testid="failed">{latest.saveFailed}</p>
    </div>
  );
}
const text = (id: string) => screen.getByTestId(id).textContent;

/** Writes a value the way another page would, so onChanged fires. */
const otherPageWrites = (key: string, value: unknown) => act(() => browser.storage.local.set({ [key]: value }));

beforeEach(() => {
  fake.reset();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  renders = 0;
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('useTheme: start', () => {
  it('starts on the crypt with no cache, and sets data-theme and the cache', async () => {
    render(<Probe />);
    expect(text('theme')).toBe('crypt');
    expect(document.documentElement.dataset.theme).toBe('crypt');
    expect(localStorage.getItem(SKY_CACHE_KEY)).toBe('crypt');
    await waitFor(() => expect(fake.calls).toEqual([]));
  });

  it('starts from the cached theme, then follows the saved one', async () => {
    localStorage.setItem(SKY_CACHE_KEY, 'frost');
    fake.storage.set(KEYS.theme, 'pumpkin');
    render(<Probe />);
    expect(text('theme')).toBe('frost');
    expect(document.documentElement.dataset.theme).toBe('frost');
    await waitFor(() => expect(text('theme')).toBe('pumpkin'));
    expect(document.documentElement.dataset.theme).toBe('pumpkin');
    expect(localStorage.getItem(SKY_CACHE_KEY)).toBe('pumpkin');
  });

  it('corrects a stale cache when nothing is saved', async () => {
    localStorage.setItem(SKY_CACHE_KEY, 'frost');
    render(<Probe />);
    await waitFor(() => expect(text('theme')).toBe('crypt'));
    expect(localStorage.getItem(SKY_CACHE_KEY)).toBe('crypt');
  });

  it('reads the saved theme once on mount', async () => {
    const spy = vi.spyOn(store, 'getTheme');
    render(<Probe />);
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    await act(async () => {});
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('keeps the current theme and counts a failed read', async () => {
    localStorage.setItem(SKY_CACHE_KEY, 'frost');
    vi.spyOn(store, 'getTheme').mockRejectedValue(new Error('read failed'));
    render(<Probe />);
    await waitFor(() => expect(text('failed')).toBe('1'));
    expect(text('theme')).toBe('frost');
    expect(document.documentElement.dataset.theme).toBe('frost');
  });
});

describe('useTheme: setTheme', () => {
  it('applies at once, then saves under tabpire:theme', async () => {
    render(<Probe />);
    await act(async () => {});
    act(() => latest.setTheme('pumpkin'));
    expect(text('theme')).toBe('pumpkin');
    expect(document.documentElement.dataset.theme).toBe('pumpkin');
    expect(localStorage.getItem(SKY_CACHE_KEY)).toBe('pumpkin');
    await waitFor(() => expect(fake.storage.get(KEYS.theme)).toBe('pumpkin'));
    expect(text('failed')).toBe('0');
  });

  it('ignores a value that is not a ThemeId', async () => {
    render(<Probe />);
    await act(async () => {});
    act(() => latest.setTheme('nope' as ThemeId));
    act(() => latest.setTheme(undefined as unknown as ThemeId));
    expect(text('theme')).toBe('crypt');
    expect(fake.calls).toEqual([]);
  });

  it('goes back to the previous theme and counts a failed write', async () => {
    render(<Probe />);
    await act(async () => {});
    fake.failStorageSet.add(KEYS.theme);
    act(() => latest.setTheme('frost'));
    expect(text('theme')).toBe('frost');
    await waitFor(() => expect(text('failed')).toBe('1'));
    expect(text('theme')).toBe('crypt');
    expect(document.documentElement.dataset.theme).toBe('crypt');
    expect(localStorage.getItem(SKY_CACHE_KEY)).toBe('crypt');
  });

  it('a late failure of an old write does not undo a newer choice', async () => {
    render(<Probe />);
    await act(async () => {});
    let rejectFirst: (e: Error) => void = () => {};
    const spy = vi
      .spyOn(store, 'setTheme')
      .mockImplementationOnce(() => new Promise<void>((_, rej) => (rejectFirst = rej)))
      .mockResolvedValueOnce(undefined);
    act(() => latest.setTheme('frost'));
    act(() => latest.setTheme('pumpkin'));
    expect(spy).toHaveBeenCalledTimes(2);
    await act(async () => rejectFirst(new Error('late')));
    expect(text('theme')).toBe('pumpkin');
    expect(document.documentElement.dataset.theme).toBe('pumpkin');
    expect(text('failed')).toBe('1'); // still reported
  });

  it('a failure of the newest write goes back to the theme before it', async () => {
    render(<Probe />);
    await act(async () => {});
    let rejectSecond: (e: Error) => void = () => {};
    vi.spyOn(store, 'setTheme')
      .mockResolvedValueOnce(undefined)
      .mockImplementationOnce(() => new Promise<void>((_, rej) => (rejectSecond = rej)));
    act(() => latest.setTheme('frost'));
    act(() => latest.setTheme('pumpkin'));
    await act(async () => rejectSecond(new Error('fail')));
    expect(text('theme')).toBe('frost');
  });

  it('a choice made while the first read is pending is not overwritten by it', async () => {
    let resolveRead: (id: ThemeId) => void = () => {};
    vi.spyOn(store, 'getTheme').mockImplementationOnce(() => new Promise<ThemeId>((res) => (resolveRead = res)));
    render(<Probe />);
    act(() => latest.setTheme('forest'));
    await act(async () => resolveRead('pumpkin'));
    expect(text('theme')).toBe('forest');
  });
});

describe('useTheme: sync (Property 15)', () => {
  it('applies a theme written by another page', async () => {
    render(<Probe />);
    await act(async () => {});
    await otherPageWrites(KEYS.theme, 'forest');
    await waitFor(() => expect(text('theme')).toBe('forest'));
    expect(document.documentElement.dataset.theme).toBe('forest');
  });

  it('makes no re-render when the event carries the active theme', async () => {
    localStorage.setItem(SKY_CACHE_KEY, 'frost');
    fake.storage.set(KEYS.theme, 'frost');
    render(<Probe />);
    await act(async () => {});
    const spy = vi.spyOn(store, 'getTheme');
    const before = renders;
    await otherPageWrites(KEYS.theme, 'frost');
    await act(async () => {});
    expect(spy).toHaveBeenCalledTimes(1);
    expect(renders).toBe(before);
  });

  it('counts a failed read on an event and keeps the theme', async () => {
    render(<Probe />);
    await act(async () => {});
    act(() => latest.setTheme('frost'));
    await act(async () => {});
    vi.spyOn(store, 'getTheme').mockRejectedValue(new Error('read failed'));
    await otherPageWrites(KEYS.theme, 'pumpkin');
    await waitFor(() => expect(text('failed')).toBe('1'));
    expect(text('theme')).toBe('frost');
  });

  it('removes its listener on unmount, and drops a read that finishes after it', async () => {
    const removed = vi.spyOn(browser.storage.onChanged, 'removeListener');
    const added = vi.spyOn(browser.storage.onChanged, 'addListener');
    const view = render(<Probe />);
    await act(async () => {});
    expect(added).toHaveBeenCalledTimes(1);
    const handler = added.mock.calls[0]![0];
    let resolveRead: (id: ThemeId) => void = () => {};
    vi.spyOn(store, 'getTheme').mockImplementationOnce(() => new Promise<ThemeId>((res) => (resolveRead = res)));
    handler({ [KEYS.theme]: { newValue: 'pumpkin' } }, 'local');
    view.unmount();
    expect(removed).toHaveBeenCalledWith(handler);
    const rendersAfter = renders;
    await act(async () => resolveRead('pumpkin'));
    expect(renders).toBe(rendersAfter);
    expect(document.documentElement.dataset.theme).not.toBe('pumpkin');
  });

  it('Feature: themes, Property 15: reads once per theme event, never for other keys, ends on the last valid value', async () => {
    const event = fc.oneof(
      fc.record({ key: fc.constant<string>(KEYS.theme), value: fc.constantFrom<unknown>(...ENABLED_THEME_IDS) }),
      fc.record({ key: fc.constant<string>(KEYS.theme), value: fc.constantFrom<unknown>('nope', 7, null, { a: 1 }) }),
      fc.record({
        key: fc.constantFrom(KEYS.stats, KEYS.crypt, KEYS.garlic, KEYS.haunts, KEYS.log),
        value: fc.constantFrom<unknown>('frost', 'pumpkin', 1),
      }),
    );
    await fc.assert(
      fc.asyncProperty(fc.array(event, { maxLength: 12 }), async (events) => {
        cleanup();
        fake.reset();
        localStorage.clear();
        const initial = 'pumpkin' as ThemeId;
        localStorage.setItem(SKY_CACHE_KEY, initial);
        fake.storage.set(KEYS.theme, initial);
        const added = vi.spyOn(browser.storage.onChanged, 'addListener');
        const removed = vi.spyOn(browser.storage.onChanged, 'removeListener');
        const view = render(<Probe />);
        await act(async () => {});
        const reads = vi.spyOn(store, 'getTheme');
        reads.mockClear();
        let expected: ThemeId = initial;
        let themeEvents = 0;
        for (const e of events) {
          // Change the value first, so every event is a real change on the fake.
          await otherPageWrites(e.key, e.value);
          await act(async () => {});
          if (e.key === KEYS.theme) {
            themeEvents++;
            if ((ENABLED_THEME_IDS as readonly unknown[]).includes(e.value)) expected = e.value as ThemeId;
            else expected = 'crypt'; // the store reads an unknown value as the default
          }
        }
        expect(reads).toHaveBeenCalledTimes(themeEvents);
        expect(text('theme')).toBe(events.some((e) => e.key === KEYS.theme) ? expected : initial);
        const handler = added.mock.calls[added.mock.calls.length - 1]![0];
        view.unmount();
        expect(removed.mock.calls.map((c) => c[0])).toContain(handler);
        vi.restoreAllMocks();
      }),
      { numRuns: 100 },
    );
  });
});
