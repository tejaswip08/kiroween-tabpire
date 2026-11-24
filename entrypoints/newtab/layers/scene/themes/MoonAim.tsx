import { useThree } from '@react-three/fiber';
import { useLayoutEffect } from 'react';
import { themeScene } from '../../../../../lib/scene/themeLayout';
import type { ThemeId } from '../../../../../lib/themes';
import { aimMoon, useDisplay } from '../display';

/**
 * Points the moon the way the shown theme wants: a unique theme gives a screen target and a disc scale; the Crypt (and a
 * theme without a unique scene) gets the Crypt's moon back. It renders nothing. It commits with the scene it belongs to,
 * so a theme switch never moves the moon of the old scene.
 */
export function MoonAim({ id }: { id: ThemeId }) {
  const display = useDisplay();
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const moon = themeScene(id).unique?.moon ?? null;
  useLayoutEffect(() => {
    display.moonTarget = moon ? moon.target : null;
    display.moonScale = moon ? moon.scale : 1;
    const aspect = size.width > 0 && size.height > 0 ? size.width / size.height : 16 / 9;
    aimMoon(display, aspect);
    invalidate();
  }, [display, moon, size.width, size.height, invalidate]);
  return null;
}
