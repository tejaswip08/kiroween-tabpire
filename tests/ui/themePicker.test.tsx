// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import fc from 'fast-check';
import { useRef, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('wxt/browser', async () => {
  const m = await import('../helpers/fakeBrowser');
  return { browser: m.browser };
});
import { fake } from '../helpers/fakeBrowser';
import { ThemePicker, nextThemeIndex } from '../../entrypoints/newtab/ThemePicker';
import { useTheme } from '../../entrypoints/newtab/components/useTheme';
import { KEYS } from '../../lib/store';
import { ENABLED_THEMES as THEMES, type ThemeId } from '../../lib/themes';

// Feature: themes, Property 16: Arrow keys move through the six themes
describe('nextThemeIndex', () => {
  it('stays inside 0 to 5 and follows a wrap-around model', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5 }),
        fc.constantFrom('ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'Home', 'End', 'a', 'Tab'),
        (i, key) => {
          const n = nextThemeIndex(i, key, 6);
          expect(n).toBeGreaterThanOrEqual(0);
          expect(n).toBeLessThanOrEqual(5);
          const model: Record<string, number> = {
            ArrowUp: i === 0 ? 5 : i - 1,
            ArrowLeft: i === 0 ? 5 : i - 1,
            ArrowDown: i === 5 ? 0 : i + 1,
            ArrowRight: i === 5 ? 0 : i + 1,
            Home: 0,
            End: 5,
          };
          expect(n).toBe(model[key] ?? i);
        },
      ),
      { numRuns: 200 },
    );
  });
});

let lastThemeId: ThemeId = 'crypt';
function Harness({ initial = 'crypt' as ThemeId, startOpen = false }: { initial?: ThemeId; startOpen?: boolean }) {
  const [open, setOpen] = useState(startOpen);
  const [theme, setTheme] = useState<ThemeId>(initial);
  const btn = useRef<HTMLButtonElement>(null);
  lastThemeId = theme;
  return (
    <div>
      <button ref={btn} onClick={() => setOpen((o) => !o)}>
        Open
      </button>
      <p>outside</p>
      <ThemePicker open={open} themeId={theme} onSelect={setTheme} onClose={() => setOpen(false)} anchorRef={btn} />
    </div>
  );
}

const items = () => within(screen.getByRole('dialog')).getAllByRole('button').filter((b) => b.classList.contains('theme-item'));

beforeEach(() => {
  fake.reset();
  localStorage.clear();
});
afterEach(cleanup);

describe('ThemePicker', () => {
  it('renders nothing while closed and a named modal dialog when open', async () => {
    render(<Harness />);
    expect(screen.queryByRole('dialog')).toBeNull();
    await userEvent.click(screen.getByText('Open'));
    const d = screen.getByRole('dialog', { name: 'Themes' });
    expect(d.getAttribute('aria-modal')).toBe('true');
  });

  it('lists the enabled themes in order with name, description and a swatch', async () => {
    render(<Harness startOpen />);
    const list = items();
    expect(list).toHaveLength(4);
    list.forEach((el, i) => {
      const t = THEMES[i]!;
      expect(within(el).getByText(t.name)).toBeTruthy();
      expect(within(el).getByText(t.description)).toBeTruthy();
      const sw = el.querySelector('.theme-swatch') as HTMLElement;
      expect(sw.style.background).toContain('linear-gradient');
      expect(sw.style.background.toLowerCase()).toContain(
        t.surface['--sky-top'].startsWith('#') ? '' : t.surface['--sky-top'].toLowerCase(),
      );
    });
  });

  it('marks the active theme with aria-pressed and a check mark, and focuses it on open', async () => {
    render(<Harness initial="frost" />);
    await userEvent.click(screen.getByText('Open'));
    const list = items();
    list.forEach((el, i) => {
      const on = THEMES[i]!.id === 'frost';
      expect(el.getAttribute('aria-pressed')).toBe(String(on));
      expect(el.querySelector('.theme-check')!.textContent).toBe(on ? '✓' : '');
      expect(el.tabIndex).toBe(on ? 0 : -1);
    });
    expect(document.activeElement).toBe(list[3]);
  });

  it('wraps Tab and Shift+Tab inside the panel', async () => {
    render(<Harness startOpen />);
    const close = screen.getByRole('button', { name: 'Close' });
    expect(document.activeElement).toBe(items()[0]);
    await userEvent.tab();
    expect(document.activeElement).toBe(close);
    await userEvent.tab();
    expect(document.activeElement).toBe(items()[0]);
    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(close);
  });

  it('moves focus with arrow keys, Home and End, with wrap-around', async () => {
    render(<Harness startOpen />);
    const list = items();
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(list[1]);
    expect(list[1]!.tabIndex).toBe(0);
    expect(list[0]!.tabIndex).toBe(-1);
    await userEvent.keyboard('{ArrowUp}{ArrowUp}');
    expect(document.activeElement).toBe(list[3]);
    await userEvent.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(list[0]);
    await userEvent.keyboard('{End}');
    expect(document.activeElement).toBe(list[3]);
    await userEvent.keyboard('{Home}');
    expect(document.activeElement).toBe(list[0]);
    await userEvent.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(list[3]);
  });

  it('selects with Enter and Space, and stays open', async () => {
    render(<Harness startOpen />);
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(lastThemeId).toBe('pumpkin');
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard(' ');
    expect(lastThemeId).toBe('forest');
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(items()[2]!.getAttribute('aria-pressed')).toBe('true');
    expect(document.activeElement).toBe(items()[2]);
  });

  it('closes on Escape and returns focus to the button', async () => {
    render(<Harness startOpen />);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(screen.getByText('Open'));
  });

  it('closes on a pointer press outside, but not inside', async () => {
    render(<Harness startOpen />);
    await userEvent.click(items()[1]!);
    expect(screen.getByRole('dialog')).toBeTruthy();
    await userEvent.click(screen.getByText('outside'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes with the Close button and returns focus', async () => {
    render(<Harness startOpen />);
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(screen.getByText('Open'));
  });
});

describe('ThemePicker CSS (360 px)', () => {
  it('fits the viewport and uses a focus ring', async () => {
    const { readFileSync } = await import('node:fs');
    const css = readFileSync('entrypoints/newtab/styles/themePicker.css', 'utf8');
    expect(css).toContain('width: min(360px, 100vw - 24px)');
    expect(css).toContain('outline: 2px solid var(--focus-ring)');
    expect(css).not.toMatch(/overflow-x:\s*scroll/);
  });
});

describe('ThemePicker with the real hook and the Fake_Browser', () => {
  function Connected() {
    const { themeId, setTheme } = useTheme();
    const btn = useRef<HTMLButtonElement>(null);
    return (
      <>
        <button ref={btn}>Anchor</button>
        <ThemePicker open themeId={themeId} onSelect={setTheme} onClose={() => {}} anchorRef={btn} />
      </>
    );
  }
  it('saves tabpire:theme and changes data-theme', async () => {
    render(<Connected />);
    await act(async () => {});
    await userEvent.click(within(screen.getByRole('dialog')).getByText('Frozen Cemetery'));
    expect(document.documentElement.dataset.theme).toBe('frost');
    await waitFor(() => expect(fake.storage.get(KEYS.theme)).toBe('frost'));
  });
});
