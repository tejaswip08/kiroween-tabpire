// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('wxt/browser', async () => {
  const m = await import('../helpers/fakeBrowser');
  return { browser: m.browser };
});
// The 3D layers are replaced by plain markers, so the page can be tested without WebGL.
const sceneInputs = vi.fn();
vi.mock('../../entrypoints/newtab/layers/SceneLayer', () => ({
  default: (props: { inputs: unknown }) => {
    sceneInputs(props.inputs);
    return <div data-testid="scene-layer" />;
  },
}));
vi.mock('../../entrypoints/newtab/layers/PortraitLayer', () => ({
  default: () => <div data-testid="portrait-layer" />,
}));
import { fake } from '../helpers/fakeBrowser';
import { App } from '../../entrypoints/newtab/App';
import { clearPortraitsReady, setPortraitReady } from '../../entrypoints/newtab/layers/portraitReady';
import { reportContextLost, reportContextRestored, resetWebglCheck } from '../../entrypoints/newtab/layers/useWebgl';
import { DAY_MS } from '../../lib/hunger';
import { store } from '../../lib/store';

function webgl(on: boolean) {
  if (on) {
    vi.stubGlobal('WebGL2RenderingContext', class {});
    const real = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(((tag: string) =>
      tag === 'canvas' ? ({ getContext: () => ({ getExtension: () => null }) } as unknown as HTMLCanvasElement) : real(tag)) as typeof document.createElement);
  }
}

beforeEach(() => {
  resetWebglCheck();
  sceneInputs.mockClear();
  fake.reset();
  const me = fake.addTab({ url: 'chrome-extension://fake-id/newtab.html', title: 'Tabpire', active: true });
  fake.currentTabId = me.id;
  fake.addTab({ title: 'Old one', url: 'https://old.com/', lastAccessed: Date.now() - 3 * DAY_MS });
  fake.addTab({ title: 'New one', url: 'https://new.com/', lastAccessed: Date.now() - 1000 });
});
afterEach(() => {
  cleanup();
  clearPortraitsReady();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('without WebGL', () => {
  it('keeps the gradient page and the 2D emblems, loads no 3D layer and shows no error', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { level: 3, name: 'Old one' })).toBeTruthy();
    await new Promise((r) => setTimeout(r, 60));
    expect(screen.queryByTestId('scene-layer')).toBeNull();
    expect(screen.queryByTestId('portrait-layer')).toBeNull();
    expect(document.querySelector('.scene-host, .portrait-host')).toBeNull();
    expect(document.querySelectorAll('.portrait-slot .emblem')).toHaveLength(2);
    expect(document.querySelector('[role="alert"]')).toBeNull();
    expect(document.querySelector('.card[data-3d]')).toBeNull();
  });
});

describe('with WebGL', () => {
  it('loads both layers after the page, inside aria-hidden containers, with the portrait host first', async () => {
    webgl(true);
    render(<App />);
    // The page content is there before any layer.
    expect(screen.getByRole('main')).toBeTruthy();
    expect(await screen.findByTestId('scene-layer')).toBeTruthy();
    expect(await screen.findByTestId('portrait-layer')).toBeTruthy();
    const scene = screen.getByTestId('scene-host');
    const portrait = screen.getByTestId('portrait-host');
    expect(scene.getAttribute('aria-hidden')).toBe('true');
    expect(portrait.getAttribute('aria-hidden')).toBe('true');
    expect(portrait.compareDocumentPosition(document.querySelector('.page')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
  it('gives the scene its numbers from the data', async () => {
    webgl(true);
    await store.setGarlic(['a.com', 'b.com']);
    render(<App />);
    await screen.findByTestId('scene-layer');
    await waitFor(() => {
      const last = sceneInputs.mock.calls.at(-1)?.[0];
      expect(last).toMatchObject({ cardCount: 2, starvingCount: 1, garlicCount: 2, dawnReady: true });
    });
  });
  it('shows the emblem until a vampire is ready, then switches that card only', async () => {
    webgl(true);
    render(<App />);
    const heading = await screen.findByRole('heading', { level: 3, name: 'Old one' });
    const card = heading.closest('.card') as HTMLElement;
    expect(card.hasAttribute('data-3d')).toBe(false);
    expect(card.querySelector('.emblem')).not.toBeNull();
    act(() => setPortraitReady(Number(card.dataset['tabId']), true));
    expect(card.dataset['3d']).toBe('on');
    const other = (await screen.findByRole('heading', { level: 3, name: 'New one' })).closest('.card') as HTMLElement;
    expect(other.hasAttribute('data-3d')).toBe(false);
  });
  it('falls back when the context is lost, and mounts the layers fresh when it returns', async () => {
    webgl(true);
    render(<App />);
    const id = Number(((await screen.findByRole('heading', { level: 3, name: 'Old one' })).closest('.card') as HTMLElement).dataset['tabId']);
    await screen.findByTestId('scene-layer');
    act(() => setPortraitReady(id, true));
    act(() => reportContextLost());
    expect(screen.getByTestId('scene-host').getAttribute('data-lost')).toBe('true');
    expect(screen.getByTestId('portrait-host').getAttribute('data-lost')).toBe('true');
    await waitFor(() => expect(document.querySelector('.card[data-3d]')).toBeNull());
    expect(document.querySelector('.emblem')).not.toBeNull();
    const before = screen.getByTestId('scene-layer');
    act(() => reportContextRestored());
    expect(screen.getByTestId('scene-host').getAttribute('data-lost')).toBe('false');
    await waitFor(() => expect(screen.getByTestId('scene-layer')).not.toBe(before));
    expect(await screen.findByTestId('portrait-layer')).toBeTruthy();
  });
});
