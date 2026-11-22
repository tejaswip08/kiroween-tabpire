import { C } from '../scene/colors';

/** Warm light from the left, cold light from the right and behind, and a soft cold fill. Matches the scene. */
export function PortraitLights() {
  return (
    <>
      <hemisphereLight args={[C.hemiSky, C.hemiGround, 0.9]} />
      <directionalLight position={[-2.2, 2.4, 2.6]} color={C.candle} intensity={2.4} />
      <directionalLight position={[2.6, 1.6, -2]} color={C.rim} intensity={2.2} />
      <directionalLight position={[2, 0.5, 2.5]} color={C.hemiSky} intensity={0.55} />
    </>
  );
}
