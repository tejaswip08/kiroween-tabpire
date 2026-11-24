// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
import { capabilities } from '../../lib/capabilities';
import { KEYS, store } from '../../lib/store';
import { SKY_CACHE_KEY, readCachedTheme } from '../../lib/themeCache';
import { resetWebglCheck } from '../../entrypoints/newtab/layers/useWebgl';
import { DemoShell } from '../../demo/src/DemoShell';
import { seedDemo } from '../../demo/src/seed';
import { useTheme } from '../../entrypoints/newtab/components/useTheme';
const root = () => document.documentElement.dataset.theme;
function go(hash: string) {
  act(() => {
    window.location.hash = hash;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}
async function pick(name: string) {
  fireEvent.click(await screen.findByRole('button', { name: 'Themes' }));
  const dialog = await screen.findByRole('dialog', { name: 'Themes' });
  const item = Array.from(dialog.querySelectorAll('button.theme-item')).find((b) => b.textContent?.includes(name));
  expect(item).toBeTruthy();
  fireEvent.click(item!);
}
beforeEach(() => {
  resetWebglCheck();
  fake.reset();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  capabilities.remoteSuggestions = false;
  capabilities.remoteIcons = false;
  seedDemo(Date.now());
  window.location.hash = '#/crypt';
});
afterEach(() => {
  cleanup();
  capabilities.remoteSuggestions = true;
  capabilities.remoteIcons = true;
  vi.restoreAllMocks();
});
describe('demo theme', () => {
  it('holds a picked theme across #/crypt and #/bloodbank, in the fake and the cache', async () => {
    render(<DemoShell />);
    await pick('Frozen Cemetery');
    await waitFor(() => expect(root()).toBe('frost'));
    await waitFor(() => expect(fake.storage.get(KEYS.theme)).toBe('frost'));
    expect(localStorage.getItem(SKY_CACHE_KEY)).toBe('frost');
    expect(readCachedTheme()).toBe('frost');
    go('#/bloodbank');
    await screen.findByRole('main');
    await waitFor(() => expect(root()).toBe('frost'));
    go('#/crypt');
    await screen.findByRole('main');
    await waitFor(() => expect(root()).toBe('frost'));
    expect(await store.getTheme()).toBe('frost');
  });
  it('Blood Bank follows the saved theme when the cache is empty', async () => {
    await store.setTheme('castle');
    window.location.hash = '#/bloodbank';
    render(<DemoShell />);
    await screen.findByRole('main');
    await waitFor(() => expect(root()).toBe('castle'));
  });
  it('Reset returns data-theme to crypt, the saved theme to the default and clears the cache', async () => {
    render(<DemoShell />);
    await pick('Blood Moon');
    await waitFor(() => expect(root()).toBe('bloodmoon'));
    await waitFor(() => expect(localStorage.getItem(SKY_CACHE_KEY)).toBe('bloodmoon'));
    fireEvent.click(screen.getByRole('button', { name: 'Reset demo' }));
    await waitFor(() => expect(root()).toBe('crypt'));
    await waitFor(() => expect(localStorage.getItem(SKY_CACHE_KEY)).toBe('crypt')); // the remounted hook writes the default
    expect(fake.storage.get(KEYS.theme)).toBeUndefined();
    expect(await store.getTheme()).toBe('crypt');
  });
  it('Reset clears the Sky_Cache itself', async () => {
    const { resetDemo } = await import('../../demo/src/seed');
    await store.setTheme('frost');
    localStorage.setItem(SKY_CACHE_KEY, 'frost');
    document.documentElement.dataset.theme = 'frost';
    await resetDemo(Date.now());
    expect(localStorage.getItem(SKY_CACHE_KEY)).toBeNull();
    expect(root()).toBe('crypt');
    expect(await store.getTheme()).toBe('crypt');
  });
  it('a theme change on one page reaches another through onStoreChange', async () => {
    window.location.hash = '#/bloodbank';
    render(<DemoShell />);
    await screen.findByRole('main');
    await waitFor(() => expect(root()).toBe('crypt'));
    await act(async () => {
      await store.setTheme('pumpkin'); // written by "another page"
    });
    await waitFor(() => expect(root()).toBe('pumpkin'));
    expect(localStorage.getItem(SKY_CACHE_KEY)).toBe('pumpkin');
  });
  it('shows no theme notice on the Blood Bank when a write fails', async () => {
    window.location.hash = '#/bloodbank';
    render(<DemoShell />);
    await screen.findByRole('main');
    fake.failStorageSet.add(KEYS.theme);
    await act(async () => {
      await store.setTheme('castle').catch(() => {});
    });
    expect(document.body.textContent).not.toMatch(/save your theme/i);
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it('the shared hook reverts a failed write (the Crypt shows the notice)', async () => {
    function Probe() {
      const t = useTheme();
      return <button onClick={() => t.setTheme('castle')}>{`${t.themeId}:${t.saveFailed}`}</button>;
    }
    render(<Probe />);
    fake.failStorageSet.add(KEYS.theme);
    fireEvent.click(await screen.findByRole('button'));
    await waitFor(() => expect(screen.getByRole('button').textContent).toBe('crypt:1'));
  });
});
