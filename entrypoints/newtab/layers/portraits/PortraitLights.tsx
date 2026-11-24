import { useSceneTheme } from '../scene/themeColors';
/** Warm light from the left, cold light from the right and behind, and a soft cold fill. Colours follow the active theme (Crypt: the scene's own). */
export function PortraitLights() {
  const { colors } = useSceneTheme();
  return (
    <>
      <hemisphereLight args={[colors.hemiSky, colors.hemiGround, 0.9]} />
      <directionalLight position={[-2.2, 2.4, 2.6]} color={colors.candle} intensity={2.4} />
      <directionalLight position={[2.6, 1.6, -2]} color={colors.rim} intensity={2.2} />
      <directionalLight position={[2, 0.5, 2.5]} color={colors.hemiSky} intensity={0.55} />
    </>
  );
}
