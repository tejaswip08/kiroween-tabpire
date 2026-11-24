import type { SkyFeature } from '../../../../../lib/scene/uniqueScenes/types';
import { Aurora } from './Aurora';
import { Lightning } from './Lightning';
/**
 * Extra things in the sky of a unique theme: `aurora` (Frozen Cemetery) is drawn here, and `lightning` (Haunted Castle) brightens
 * the sky, the clouds and the moonlight now and then (`lightningSeed` decides when). The other themes ask for none, so they draw
 * nothing extra.
 */
export function SkyFeatures({ features, lightningSeed = 1 }: { features: readonly SkyFeature[]; lightningSeed?: number }) {
  return (
    <>
      {features.includes('aurora') && <Aurora />}
      {features.includes('lightning') && <Lightning seed={lightningSeed} />}
    </>
  );
}
