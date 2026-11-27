import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { AdditiveBlending, Color, type InstancedMesh, Matrix4, MeshBasicMaterial } from 'three';
import { flicker } from '../../../../../lib/scene/flicker';
import { LANTERN_POST, gustAt, type FrostPlan } from '../../../../../lib/scene/uniqueScenes/frostPlan';
import { useDisplay } from '../display';
import { buildBar, buildCross, buildHangLantern, buildHookPost, buildLanternFlame, buildLanternHalo, buildRail, buildSlab } from './frostShapes';
import { disposeMesh, litMaterial, makeInstanced, placeAt } from './frostParts';
const FLAME = new Color('#ffa84d').multiplyScalar(0.92);
const swing = new Matrix4();
const out = new Matrix4();
/** Where a lantern hangs: the end of its post's arm, in the world. */
const hookOf = (l: FrostPlan['lanterns'][number]) => placeAt(l.x, 0, l.z, l.rotY).multiply(new Matrix4().makeTranslation(LANTERN_POST.armX, LANTERN_POST.hookY, 0));
/** The swing of lantern `i` at a time, in radians about its arm (x) and across it (z): small, uneven, a little more in a gust. */
export function lanternSwing(t: number, i: number): [number, number] {
  const g = gustAt(t);
  return [0.1 * g * Math.sin(t * 1.9 + i * 1.7) + 0.03 * Math.sin(t * 3.1 + i), 0.06 * g * Math.sin(t * 1.4 + i * 2.3) + 0.05 * g];
}
/**
 * Hanging lanterns beside the path: an iron hook post each, and a round lantern on a short chain that swings a little in the wind, its
 * flame flickering. The lanterns, the flames and their faint halos are one instanced mesh each (their matrices are written each frame,
 * four lanterns); under reduced motion they hang still and the flames burn steady.
 */
function Lanterns({ lanterns }: { lanterns: FrostPlan['lanterns'] }) {
  const display = useDisplay();
  const built = useMemo(() => {
    const hooks = lanterns.map(hookOf);
    const halo = new MeshBasicMaterial({ color: new Color('#ff9a3d'), transparent: true, opacity: 0.2, depthWrite: false, blending: AdditiveBlending, fog: false });
    const flame = makeInstanced(buildLanternFlame(), new MeshBasicMaterial({ color: FLAME, fog: false }), hooks, 'frost-lantern-flames');
    for (let i = 0; i < lanterns.length; i++) flame.setColorAt(i, new Color(1, 1, 1));
    return {
      hooks,
      posts: makeInstanced(buildHookPost(), litMaterial('#10203a', 0.4), lanterns.map((l) => placeAt(l.x, 0, l.z, l.rotY)), 'frost-lanterns', { castShadow: true }),
      bodies: makeInstanced(buildHangLantern(), litMaterial('#10203a', 0.4), hooks, 'frost-hanging-lanterns', { castShadow: true }),
      flame,
      halos: makeInstanced(buildLanternHalo(), halo, hooks, 'frost-lantern-halos', { renderOrder: 3 }),
    };
  }, [lanterns]);
  useEffect(() => () => [built.posts, built.bodies, built.flame, built.halos].forEach(disposeMesh), [built]);
  const lit = useMemo(() => new Color(), []);
  useFrame(() => {
    const t = display.time;
    const moving: InstancedMesh[] = [built.bodies, built.flame, built.halos];
    built.hooks.forEach((hook, i) => {
      const [ax, az] = display.reduced ? [0, 0] : lanternSwing(t, i);
      swing.makeRotationX(ax).multiply(new Matrix4().makeRotationZ(az));
      out.multiplyMatrices(hook, swing);
      for (const m of moving) m.setMatrixAt(i, out);
      // The instance colour multiplies the flame colour: a flicker near 1.
      built.flame.setColorAt(i, lit.setScalar(flicker(t, i + 1, display.reduced)));
    });
    for (const m of moving) m.instanceMatrix.needsUpdate = true;
    if (built.flame.instanceColor) built.flame.instanceColor.needsUpdate = true;
  });
  return (
    <>
      <primitive object={built.posts} />
      <primitive object={built.bodies} />
      <primitive object={built.flame} />
      <primitive object={built.halos} />
    </>
  );
}
/**
 * The graveyard, every repeat instanced (one draw call per kind):
 * - a few tilted, snow-capped tombstones spread out on both sides of the path (round slabs with a small skull, and crosses);
 * - the hanging lanterns along the path;
 * - the broken iron fences, half buried: one behind the graves and the house's own on both sides of its gate.
 */
export function FrostGraveyard({ plan }: { plan: FrostPlan }) {
  const meshes = useMemo(() => {
    const slab = plan.stones.filter((s) => s.kind === 'slab');
    const cross = plan.stones.filter((s) => s.kind === 'cross');
    const stoneAt = (s: (typeof plan.stones)[number]) => placeAt(s.x, -s.sink, s.z, s.rotY, s.scale, s.tilt);
    return [
      makeInstanced(buildSlab(), litMaterial('#0c1d38', 0.22), slab.map(stoneAt), 'frost-stones-slab', { castShadow: true, receiveShadow: true }),
      makeInstanced(buildCross(), litMaterial('#0c1d38', 0.22), cross.map(stoneAt), 'frost-stones-cross', { castShadow: true, receiveShadow: true }),
      makeInstanced(buildBar(), litMaterial('#10203a', 0.4), plan.bars.map((b) => placeAt(b.x, -b.sink, b.z, b.rotY, [1, b.height / 1.7, 1], [0, b.lean])), 'frost-fence-bars', { castShadow: true }),
      makeInstanced(buildRail(), litMaterial('#10203a', 0.4), plan.rails.map((r) => placeAt(r.x, r.y, r.z, r.rotY, [r.length, 1, 1], [0, r.lean])), 'frost-fence-rails', { castShadow: true }),
    ];
  }, [plan]);
  useEffect(() => () => meshes.forEach(disposeMesh), [meshes]);
  return (
    <>
      {meshes.map((m) => (
        <primitive key={m.name} object={m} />
      ))}
      <Lanterns lanterns={plan.lanterns} />
    </>
  );
}
