// @vitest-environment jsdom
// Reset demo remounts the page. The old 3D canvases give their context back as they go (React Three Fiber calls
// forceContextLoss, which fires webglcontextlost); that must not hide the new 3D scene and portraits.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect, useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('wxt/browser', async () => {
  const m = await import('../../lib/fakeBrowser');
  return { browser: m.browser };
});
// Each fake layer has a real canvas that the layer watches, like the real layers, and loses its context on unmount.
function FakeLayer({ id }: { id: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const canvas = document.createElement('canvas');
    ref.current!.appendChild(canvas);
    void import('../../entrypoints/newtab/layers/useWebgl').then((m) => m.watchContext(canvas));
    return () => {
      // After React has removed the layer from the page.
      setTimeout(() => canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true })), 0);
    };
  }, []);
  return <div data-testid={id} ref={ref} />;
}
vi.mock('../../entrypoints/newtab/layers/SceneLayer', () => ({ default: () => <FakeLayer id="scene-layer" /> }));
vi.mock('../../entrypoints/newtab/layers/PortraitLayer', () => ({ default: () => <FakeLayer id="portrait-layer" /> }));
import { fake } from '../../lib/fakeBrowser';
import { resetWebglCheck, reportContextLost, useWebgl, watchContext } from '../../entrypoints/newtab/layers/useWebgl';
import { DemoShell } from '../../demo/src/DemoShell';
import { seedDemo } from '../../demo/src/seed';
import { renderHook } from '@testing-library/react';
import { readFileSync } from 'node:fs';

function webgl() {
  vi.stubGlobal('WebGL2RenderingContext', class {});
  const real = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string, o?: ElementCreationOptions) => {
    const el = real(tag, o);
    if (tag === 'canvas') (el as HTMLCanvasElement).getContext = (() => ({ getExtension: () => null })) as never;
    return el;
  }) as typeof document.createElement);
}
beforeEach(() => {
  resetWebglCheck();
  fake.reset();
  seedDemo(Date.now());
  window.location.hash = '#/crypt';
  webgl();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Reset demo', () => {
  it('keeps the 3D scene and the portraits running', { timeout: 30000 }, async () => {
    render(<DemoShell />);
    await screen.findByTestId('scene-layer', {}, { timeout: 8000 });
    await screen.findByTestId('portrait-layer', {}, { timeout: 8000 });
    fireEvent.click(screen.getByRole('button', { name: 'Reset demo' }));
    // Let the old canvases lose their context.
    await act(async () => new Promise((r) => setTimeout(r, 30)));
    await waitFor(() => {
      expect(screen.getByTestId('scene-host').getAttribute('data-lost')).toBe('false');
      expect(screen.getByTestId('portrait-host').getAttribute('data-lost')).toBe('false');
    }, { timeout: 8000 });
    expect(screen.getByTestId('scene-layer')).toBeTruthy();
    expect(screen.getByTestId('portrait-layer')).toBeTruthy();
  });
});

describe('watchContext', () => {
  it('reports a real context loss of a canvas in the page, and ignores one from a canvas that was removed', () => {
    const { result } = renderHook(() => useWebgl());
    const gone = document.createElement('canvas');
    document.body.appendChild(gone);
    watchContext(gone);
    gone.remove();
    act(() => void gone.dispatchEvent(new Event('webglcontextlost', { cancelable: true })));
    expect(result.current.lost).toBe(false);
    const live = document.createElement('canvas');
    document.body.appendChild(live);
    watchContext(live);
    act(() => void live.dispatchEvent(new Event('webglcontextlost', { cancelable: true })));
    expect(result.current.lost).toBe(true);
    live.remove();
    void reportContextLost;
  });
  it('is what both 3D layers use for their canvas', () => {
    for (const f of ['SceneLayer', 'PortraitLayer']) {
      const src = readFileSync(`entrypoints/newtab/layers/${f}.tsx`, 'utf8');
      expect(src, f).toMatch(/watchContext\(gl\.domElement\)/);
      expect(src, f).not.toMatch(/webglcontextlost/);
    }
  });
});
