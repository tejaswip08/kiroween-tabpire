import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { modelFile, type Placement } from '../../../../../lib/scene/layout';
import type { SwayModel } from '../../../../../lib/scene/uniqueScenes/castleParts';
import { useDisplay } from '../display';
import { buildBatches, disposeBatches } from '../ModelBatch';
import { applySway, type SwayClock } from './swayBuild';
/**
 * The clock of the swaying cloths of a scene: one pair of uniforms for all of them. JavaScript only sets these two numbers once
 * a frame; the sway itself runs in the vertex shader. With reduced motion the cloth stands still (amplitude 0).
 */
export function useSwayClock(): SwayClock {
  const display = useDisplay();
  const clock = useMemo<SwayClock>(() => ({ time: { value: 0 }, amp: { value: 1 } }), []);
  useFrame(() => {
    clock.time.value = display.reduced ? 0 : display.time;
    clock.amp.value = display.reduced ? 0 : 1;
  });
  return clock;
}
/**
 * One model with a cloth that sways (a banner or a wall flag), instanced like every other prop. The cloth part has its own
 * shader copy of the material; the poles, brackets and bars keep the file's materials and stand still. Suspends while the file loads.
 */
export function SwayBatch({ id, placements, clock }: { id: SwayModel; placements: readonly Placement[]; clock: SwayClock }) {
  const gltf = useGLTF(modelFile(id), false, true);
  const built = useMemo(() => {
    const root = Array.isArray(gltf) ? gltf[0]!.scene : gltf.scene;
    const { batches, owned } = buildBatches(id, root, placements);
    applySway(id, batches, clock, owned);
    return { batches, owned };
  }, [gltf, id, placements, clock]);
  useEffect(() => () => disposeBatches(built.batches, built.owned), [built]);
  return (
    <>
      {built.batches.map((b, i) => (
        <primitive key={i} object={b.mesh} />
      ))}
    </>
  );
}
