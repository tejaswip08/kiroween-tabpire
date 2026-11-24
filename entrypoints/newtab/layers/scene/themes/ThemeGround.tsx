import { useEffect, useMemo } from 'react';
import type { GroundKind } from '../../../../../lib/scene/uniqueScenes/types';
import { useSceneTheme } from '../themeColors';
import { makeGroundTexture } from './shapes';

/**
 * The ground of a unique theme: one large plane painted with the 2D canvas for its kind (earth, moss, snow, cracked rock,
 * flagstone). The base colour and tint come from the theme's palette. It runs on past the props into the fog, so no edge shows.
 */
export function ThemeGround({ kind }: { kind: GroundKind }) {
  const { colors } = useSceneTheme();
  const base = `#${colors.groundBase.getHexString()}`;
  const map = useMemo(() => makeGroundTexture(kind, base), [kind, base]);
  useEffect(() => () => map.dispose(), [map]);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -40]} receiveShadow name="theme-ground">
      <planeGeometry args={[200, 200]} />
      <meshStandardMaterial map={map} color={colors.groundTint} roughness={1} metalness={0} />
    </mesh>
  );
}
