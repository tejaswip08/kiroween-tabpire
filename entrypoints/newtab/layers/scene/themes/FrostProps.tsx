import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { Color, type BufferGeometry, MeshBasicMaterial, type Mesh } from 'three';
import { flicker } from '../../../../../lib/scene/flicker';
import { STEEPLE, type FrostPlan, type PropKind } from '../../../../../lib/scene/uniqueScenes/frostPlan';
import { useDisplay } from '../display';
import {
  buildAngel, buildBones, buildCart, buildCoffin, buildCottageLights, buildGraveWithShovel, buildIronGate, buildLog, buildSteeple, buildSteepleLight,
  buildStump, buildWell,
} from './frostShapes';
import { disposeMesh, litMaterial, makeInstanced, placeAt } from './frostParts';
/** The shape of each kind, its material glow, and whether it casts a shadow (only the tall ones). */
const KINDS: Record<PropKind, { build: () => BufferGeometry; emissive: string; level: number; shadow: boolean }> = {
  angel: { build: buildAngel, emissive: '#1a3360', level: 0.45, shadow: true },
  grave: { build: buildGraveWithShovel, emissive: '#12294d', level: 0.35, shadow: false },
  coffin: { build: buildCoffin, emissive: '#12294d', level: 0.4, shadow: false },
  bones: { build: buildBones, emissive: '#1a3360', level: 0.45, shadow: false },
  well: { build: buildWell, emissive: '#12294d', level: 0.4, shadow: true },
  cart: { build: buildCart, emissive: '#12294d', level: 0.4, shadow: false },
  stump: { build: buildStump, emissive: '#12294d', level: 0.35, shadow: false },
  log: { build: buildLog, emissive: '#12294d', level: 0.35, shadow: false },
  ironGate: { build: buildIronGate, emissive: '#12294d', level: 0.4, shadow: true },
};
/** The far lights: faint, under the Bloom threshold, so they read as distant windows and never as blobs. */
const FAR_LIGHT = 0.95;
/**
 * The scary things on the snow, one instanced mesh per kind: a hooded stone angel with a cracked face, an open grave with a shovel, coffins,
 * skulls and bones, a frozen well, a cart stuck in the snow, broken stumps, fallen logs and leaning iron gates. Far back, the dark ruined
 * steeple and the windows of the far cottages glow faintly and flicker (they hold steady under reduced motion).
 */
export function FrostProps({ plan }: { plan: FrostPlan }) {
  const display = useDisplay();
  const built = useMemo(() => {
    const meshes = (Object.keys(KINDS) as PropKind[])
      .map((kind) => {
        const list = plan.props.filter((p) => p.kind === kind);
        if (!list.length) return null;
        const k = KINDS[kind];
        return makeInstanced(k.build(), litMaterial(k.emissive, k.level), list.map((p) => placeAt(p.x, 0, p.z, p.rotY, p.scale, p.tilt)), `frost-props-${kind}`, { castShadow: k.shadow, receiveShadow: true });
      })
      .filter((m): m is NonNullable<typeof m> => m !== null);
    const steepleAt = placeAt(STEEPLE.x, 0, STEEPLE.z, STEEPLE.rotY, STEEPLE.scale);
    const steeple = makeInstanced(buildSteeple(), litMaterial('#0e1c38', 0.5), [steepleAt], 'frost-far-steeple');
    const lightMat = new MeshBasicMaterial({ vertexColors: true, toneMapped: false, color: new Color(FAR_LIGHT, FAR_LIGHT, FAR_LIGHT) });
    const windows = makeInstanced(buildCottageLights(), lightMat, plan.cottages.map((c) => placeAt(c.x, 0, c.z, c.rotY, c.scale)), 'frost-far-windows');
    const belfry = makeInstanced(buildSteepleLight(), lightMat, [steepleAt], 'frost-far-belfry');
    return { meshes, steeple, windows, belfry, lightMat };
  }, [plan]);
  useEffect(() => () => [...built.meshes, built.steeple, built.windows, built.belfry].forEach((m) => disposeMesh(m as unknown as Mesh)), [built]);
  useFrame(() => {
    built.lightMat.color.setScalar(FAR_LIGHT * (display.reduced ? 1 : 0.7 + 0.3 * flicker(display.time * 0.5, 7)));
  });
  return (
    <>
      {built.meshes.map((m) => (
        <primitive key={m.name} object={m} />
      ))}
      <primitive object={built.steeple} />
      <primitive object={built.windows} />
      <primitive object={built.belfry} />
    </>
  );
}
