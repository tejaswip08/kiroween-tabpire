import { useEffect, useMemo } from 'react';
import type { PathKind, UniquePath } from '../../../../../lib/scene/uniqueScenes/types';
import { buildPathRibbon } from './shapes';

const PATH_COLOR: Record<Exclude<PathKind, 'none'>, string> = { dirt: '#7a5232', moss: '#35502f', flagstone: '#6a6a76', snow: '#6f8fb8' };

/** The track of a unique theme: one flat ribbon along its centre line. Nothing for a theme with no path. */
export function ThemePath({ path }: { path: UniquePath }) {
  const geometry = useMemo(() => (path.kind === 'none' || path.centre.length < 2 ? null : buildPathRibbon(path.centre, path.halfWidth)), [path]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  if (!geometry || path.kind === 'none') return null;
  return (
    <mesh geometry={geometry} receiveShadow name="theme-path">
      <meshStandardMaterial color={PATH_COLOR[path.kind]} roughness={1} metalness={0} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
    </mesh>
  );
}
