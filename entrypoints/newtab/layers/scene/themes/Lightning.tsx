import { useFrame } from '@react-three/fiber';
import { useEffect } from 'react';
import { lightningAt } from '../../../../../lib/scene/lightning';
import { useDisplay } from '../display';
/**
 * Soft lightning: once in a while (every 8 to 20 seconds, from a seed) the sky and the clouds get a little brighter and the
 * moonlight and the hemisphere light a little stronger, then fade. It only writes one number, `display.flash` (0 to 1); the sky,
 * the clouds and the lights read it. There are no bolts and no geometry. Under reduced motion the number stays 0.
 */
export function Lightning({ seed }: { seed: number }) {
  const display = useDisplay();
  useFrame(() => {
    display.flash = display.reduced ? 0 : lightningAt(display.time, seed, false);
  }, -9);
  useEffect(
    () => () => {
      display.flash = 0;
    },
    [display],
  );
  return null;
}
