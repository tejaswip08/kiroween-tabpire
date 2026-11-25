// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('wxt/browser', async () => {
  const m = await import('../../lib/fakeBrowser');
  return { browser: m.browser };
});
// The 3D layers are replaced by plain markers, so the Crypt mounts without WebGL.
vi.mock('../../entrypoints/newtab/layers/SceneLayer', () => ({
  default: () => <div data-testid="scene-layer" />,
}));
vi.mock('../../entrypoints/newtab/layers/PortraitLayer', () => ({
  default: () => <div data-testid="portrait-layer" />,
}));
import { fake } from '../../lib/fakeBrowser';
import { resetWebglCheck } from '../../entrypoints/newtab/layers/useWebgl';
import { BANNER_TEXT, DemoShell, ERROR_TEXT } from '../../demo/src/DemoShell';
import { seedDemo } from '../../demo/src/seed';

function go(hash: string) {
  act(() => {
    window.location.hash = hash;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}

beforeEach(() => {
  resetWebglCheck();
  fake.reset();
  seedDemo(Date.now());
  window.location.hash = '#/crypt';
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('demo routes', () => {
  it('shows the banner and the Crypt landmark on #/crypt', async () => {
    render(<DemoShell />);
    expect(screen.getByText(BANNER_TEXT)).toBeTruthy();
    expect(await screen.findByRole('main')).toBeTruthy();
  });

  it('shows the banner and the Blood Bank landmark on #/bloodbank', async () => {
    window.location.hash = '#/bloodbank';
    render(<DemoShell />);
    expect(screen.getByText(BANNER_TEXT)).toBeTruthy();
    expect(await screen.findByRole('main')).toBeTruthy();
  });

  it('shows the banner and the real popup on #/popup', () => {
    window.location.hash = '#/popup';
    render(<DemoShell />);
    expect(screen.getByText(BANNER_TEXT)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open the Crypt' })).toBeTruthy();
  });

  it('switches pages on a hash change and keeps the fake state', async () => {
    render(<DemoShell />);
    await screen.findByRole('main');
    const before = [...fake.tabs.keys()];
    expect(before.length).toBeGreaterThan(0);
    go('#/popup');
    expect(screen.getByRole('button', { name: 'Open the Crypt' })).toBeTruthy();
    expect(document.querySelector('main.main')).toBeNull();
    go('#/bloodbank');
    expect(await screen.findByRole('main')).toBeTruthy();
    expect([...fake.tabs.keys()]).toEqual(before);
    expect(screen.getByText(BANNER_TEXT)).toBeTruthy();
  });

  it('never calls canvas.getContext on Blood Bank or the popup', async () => {
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext');
    window.location.hash = '#/bloodbank';
    render(<DemoShell />);
    await screen.findByRole('main');
    go('#/popup');
    expect(screen.getByRole('button', { name: 'Open the Crypt' })).toBeTruthy();
    expect(spy).not.toHaveBeenCalled();
  });

  it('shows the error text with Reset still present when a page throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    function Boom(): never {
      throw new Error('boom');
    }
    render(<DemoShell pageFor={() => <Boom />} />);
    expect(screen.getByText(ERROR_TEXT)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reset demo' })).toBeTruthy();
    expect(screen.getByText(BANNER_TEXT)).toBeTruthy();
  });

  it('Reset keeps the route and reads the clock when pressed', async () => {
    window.location.hash = '#/popup';
    render(<DemoShell />);
    const now = vi.spyOn(Date, 'now').mockReturnValue(5_000_000_000_000);
    fireEvent.click(screen.getByRole('button', { name: 'Reset demo' }));
    await waitFor(() => expect(now).toHaveBeenCalled());
    await waitFor(() =>
      expect([...fake.tabs.values()].some((t) => t.lastAccessed === 5_000_000_000_000 - 60 * 1000)).toBe(true),
    );
    expect(window.location.hash).toBe('#/popup');
    expect(screen.getByRole('button', { name: 'Open the Crypt' })).toBeTruthy();
  });
});

describe('demo.css', () => {
  const css = readFileSync('demo/src/demo.css', 'utf8');
  it('has no 100vh rule', () => {
    expect(css).not.toMatch(/100vh/);
  });
  it('makes .demo-frame flexible and .demo-strip fixed', () => {
    const frame = css.match(/\.demo-frame\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(frame).toMatch(/flex:\s*1 1 0/);
    expect(frame).toMatch(/min-height:\s*0/);
    expect(frame).toMatch(/flex-direction:\s*column/);
    expect(frame).toMatch(/overflow:\s*hidden/);
    expect(css.match(/\.demo-strip\s*\{([^}]*)\}/)?.[1] ?? '').toMatch(/flex:\s*0 0 auto/);
  });
});
