import { Bloom, EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { HalfFloatType } from 'three';
import { LOOK } from '../../../../lib/scene/config';

/**
 * Bloom on everything brighter than the threshold, a vignette and one tone-mapping step at the
 * end. Bloom uses mipmap blur, which starts from a half-resolution image. No multisampling.
 */
export function Effects() {
  return (
    <EffectComposer multisampling={0} frameBufferType={HalfFloatType}>
      <Bloom
        mipmapBlur
        intensity={LOOK.bloom.intensity}
        luminanceThreshold={LOOK.bloom.threshold}
        luminanceSmoothing={LOOK.bloom.smoothing}
        radius={LOOK.bloom.radius}
      />
      <Vignette offset={LOOK.vignette.offset} darkness={LOOK.vignette.darkness} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}
