// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LayerBoundary } from '../../entrypoints/newtab/layers/LayerBoundary';
import {
  detectWebgl, reportContextLost, reportContextRestored, resetWebglCheck, useWebgl,
} from '../../entrypoints/newtab/layers/useWebgl';

function stubCanvas(getContext: () => unknown) {
  const real = document.createElement.bind(document);
  return vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
    if (tag === 'canvas') return { getContext } as unknown as HTMLCanvasElement;
    return real(tag);
  }) as typeof document.createElement);
}

beforeEach(() => {
  resetWebglCheck();
  vi.stubGlobal('WebGL2RenderingContext', class {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('detectWebgl', () => {
  it('says no without a canvas when the browser has no WebGL 2 type', () => {
    vi.unstubAllGlobals();
    const spy = vi.spyOn(document, 'createElement');
    expect(detectWebgl()).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });
  it('says no when there is no context, and keeps the answer', () => {
    const spy = stubCanvas(() => null);
    expect(detectWebgl()).toBe(false);
    expect(detectWebgl()).toBe(false);
    expect(spy).toHaveBeenCalledTimes(1);
  });
  it('says yes when a context exists, and gives it back', () => {
    const lose = vi.fn();
    stubCanvas(() => ({ getExtension: () => ({ loseContext: lose }) }));
    expect(detectWebgl()).toBe(true);
    expect(lose).toHaveBeenCalledTimes(1);
  });
  it('says no when asking throws', () => {
    stubCanvas(() => {
      throw new Error('blocked');
    });
    expect(detectWebgl()).toBe(false);
  });
});

function Probe() {
  const w = useWebgl();
  return <p data-testid="p">{`${w.available}|${w.lost}|${w.epoch}`}</p>;
}

describe('useWebgl context loss', () => {
  it('flags a lost context and counts each return', () => {
    stubCanvas(() => ({ getExtension: () => null }));
    render(<Probe />);
    expect(screen.getByTestId('p').textContent).toBe('true|false|0');
    act(() => reportContextLost());
    expect(screen.getByTestId('p').textContent).toBe('true|true|0');
    act(() => reportContextLost());
    act(() => reportContextRestored());
    expect(screen.getByTestId('p').textContent).toBe('true|false|1');
    act(() => reportContextRestored());
    expect(screen.getByTestId('p').textContent).toBe('true|false|1');
  });
});

function Boom({ explode }: { explode: boolean }): React.ReactElement {
  if (explode) throw new Error('3D broke');
  return <p>layer ok</p>;
}

describe('LayerBoundary', () => {
  it('shows nothing, with no message, when the layer fails', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const onFail = vi.fn();
    const { container } = render(
      <LayerBoundary onFail={onFail}>
        <Boom explode />
      </LayerBoundary>,
    );
    expect(container.textContent).toBe('');
    expect(onFail).toHaveBeenCalledTimes(1);
  });
  it('tries again when the reset key changes', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { rerender, container } = render(
      <LayerBoundary resetKey={0}>
        <Boom explode />
      </LayerBoundary>,
    );
    expect(container.textContent).toBe('');
    rerender(
      <LayerBoundary resetKey={1}>
        <Boom explode={false} />
      </LayerBoundary>,
    );
    expect(screen.getByText('layer ok')).toBeTruthy();
  });
  it('passes a healthy layer through', () => {
    render(
      <LayerBoundary>
        <Boom explode={false} />
      </LayerBoundary>,
    );
    expect(screen.getByText('layer ok')).toBeTruthy();
  });
});
