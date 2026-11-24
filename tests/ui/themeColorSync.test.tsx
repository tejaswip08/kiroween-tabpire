// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
const invalidate = vi.hoisted(() => vi.fn());
vi.mock('@react-three/fiber', () => ({ useThree: (sel: (s: { invalidate: () => void }) => unknown) => sel({ invalidate }) }));
import { SceneThemeContext, sceneThemeFor, useColorSync } from '../../entrypoints/newtab/layers/scene/themeColors';
import type { SceneColors } from '../../entrypoints/newtab/layers/scene/colors';

afterEach(() => {
  cleanup();
  invalidate.mockClear();
});
function Probe({ apply }: { apply: (c: SceneColors) => void }) {
  useColorSync(apply);
  return null;
}
describe('useColorSync', () => {
  it('applies once on mount, asks for one redraw, and not on a re-render with the same colours', () => {
    const apply = vi.fn();
    const { rerender } = render(<Probe apply={apply} />);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenLastCalledWith(sceneThemeFor('crypt').colors);
    expect(invalidate).toHaveBeenCalledTimes(1);
    rerender(<Probe apply={apply} />);
    rerender(<Probe apply={vi.fn()} />);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledTimes(1);
  });
  it('applies once per colour-set change', () => {
    const apply = vi.fn();
    const view = (id: 'crypt' | 'frost' | 'castle') => (
      <SceneThemeContext value={sceneThemeFor(id)}>
        <Probe apply={apply} />
      </SceneThemeContext>
    );
    const { rerender } = render(view('crypt'));
    rerender(view('crypt'));
    expect(apply).toHaveBeenCalledTimes(1);
    rerender(view('frost'));
    expect(apply).toHaveBeenCalledTimes(2);
    expect(apply).toHaveBeenLastCalledWith(sceneThemeFor('frost').colors);
    rerender(view('frost'));
    rerender(view('castle'));
    expect(apply).toHaveBeenCalledTimes(3);
    expect(invalidate).toHaveBeenCalledTimes(3);
  });
});
