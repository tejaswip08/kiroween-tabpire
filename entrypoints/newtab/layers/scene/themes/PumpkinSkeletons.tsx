import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { Color, DoubleSide, Euler, InstancedMesh, Matrix4, MeshBasicMaterial, MeshStandardMaterial, Quaternion, Vector3, type BufferGeometry } from 'three';
import type { FencePost } from '../../../../../lib/scene/uniqueScenes/autumn';
import {
  HUNG, LOOSE_BONES, RISING, SITTING, riseAmount, riseOffset, skullsShown, type SkeletonSpot,
} from '../../../../../lib/scene/uniqueScenes/skeletons';
import { useDisplay } from '../display';
import { buildBoneyard, buildHungSkeleton, buildPostSkull, buildRisingSkeleton, buildSittingSkeleton } from './skeletonBuild';

const m4 = new Matrix4();
const q = new Quaternion();
const p = new Vector3();
const sc = new Vector3();
const e = new Euler();

/** Red-orange eyes, bright enough (above 1) for Bloom to give them a small glow. */
const EYE = new Color(3.2, 0.55, 0.12);
function materials(): [MeshStandardMaterial, MeshBasicMaterial] {
  return [
    new MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0, side: DoubleSide }),
    new MeshBasicMaterial({ color: EYE, toneMapped: false }),
  ];
}
function instanced(geometry: BufferGeometry, count: number, name: string): InstancedMesh {
  const mesh = new InstancedMesh(geometry, materials(), Math.max(1, count));
  mesh.count = count;
  mesh.name = name;
  mesh.frustumCulled = false;
  return mesh;
}
const put = (mesh: InstancedMesh, i: number, s: SkeletonSpot, y: number, rx = 0, rz = 0) => {
  q.setFromEuler(e.set(rx, s.rotY, rz, 'YXZ'));
  mesh.setMatrixAt(i, m4.compose(p.set(s.x, y, s.z), q, sc.setScalar(s.scale)));
};
function disposeMesh(mesh: InstancedMesh): void {
  mesh.geometry.dispose();
  for (const mat of mesh.material as MeshStandardMaterial[]) mat.dispose();
  mesh.dispose();
}

/** The fence posts the skulls sit on: nearest the camera first, alternating sides, so the first skulls are the easy ones to see. */
export function skullPosts(fence: readonly (readonly FencePost[])[]): FencePost[] {
  const sides = fence.map((side) => [...side].sort((a, b) => b.z - a.z));
  const out: FencePost[] = [];
  for (let i = 0; i < Math.max(...sides.map((s) => s.length)); i++) for (const s of sides) if (s[i]) out.push(s[i]!);
  return out;
}
/** Where the top of a post is, with its lean. */
const postTop = (f: FencePost): Vector3 => new Vector3(0, f.height, 0).applyEuler(new Euler(f.leanX, 0, f.leanZ)).add(new Vector3(f.x, f.y, f.z));

/**
 * The skeletons of the Pumpkin Patch (see `lib/scene/uniqueScenes/skeletons.ts` for what they mean): two strung up on posts,
 * swaying a little; one slumped against the tree; four clawing out of dirt mounds, as far out as the tabs are hungry; and a
 * skull on a fence post for every staked tab, on top of a few that are always there. All of them have glowing red eyes.
 * Reduced motion stops the sway and the clawing; the data still moves them.
 */
export function PumpkinSkeletons({ fence }: { fence: readonly (readonly FencePost[])[] }) {
  const display = useDisplay();
  const posts = useMemo(() => skullPosts(fence), [fence]);
  const built = useMemo(() => {
    const hung = instanced(buildHungSkeleton(), HUNG.length, 'skeleton-hung');
    const sitting = instanced(buildSittingSkeleton(), 1, 'skeleton-sitting');
    const rising = instanced(buildRisingSkeleton(), RISING.length, 'skeleton-rising');
    const skulls = instanced(buildPostSkull(), posts.length, 'skeleton-skulls');
    put(sitting, 0, SITTING, 0);
    sitting.instanceMatrix.needsUpdate = true;
    posts.forEach((f, i) => {
      const top = postTop(f);
      q.setFromEuler(e.set(f.leanX, Math.atan2(0.5 - f.x, 16 - f.z) + Math.sin(i * 2.3) * 0.5, f.leanZ));
      skulls.setMatrixAt(i, m4.compose(top.setY(top.y + 0.02), q, sc.setScalar(1)));
    });
    skulls.instanceMatrix.needsUpdate = true;
    const boneyard = buildBoneyard(RISING, LOOSE_BONES);
    return { hung, sitting, rising, skulls, boneyard };
  }, [posts]);
  useEffect(
    () => () => {
      for (const m of [built.hung, built.sitting, built.rising, built.skulls]) disposeMesh(m);
      built.boneyard.dispose();
    },
    [built],
  );
  useFrame(() => {
    const t = display.reduced ? 0 : display.time;
    // Strung up: a slow creaking sway about the post's foot.
    HUNG.forEach((s, i) => put(built.hung, i, s, 0, 0, display.reduced ? 0 : Math.sin(t * 0.7 + i * 2) * 0.025));
    built.hung.instanceMatrix.needsUpdate = true;
    // Rising: out of the ground as far as the hunger, with a small struggling rock.
    const k = riseAmount(display.emberRate);
    RISING.forEach((s, i) => {
      const rock = display.reduced ? 0 : Math.sin(t * 1.3 + i * 1.9) * 0.06;
      put(built.rising, i, s, riseOffset(k) + (display.reduced ? 0 : Math.abs(Math.sin(t * 0.9 + i)) * 0.03), rock * 0.5, rock);
    });
    built.rising.instanceMatrix.needsUpdate = true;
    // Skulls: one more for each staked tab.
    const shown = Math.floor(skullsShown(display.newGraves, posts.length));
    if (built.skulls.count !== shown) built.skulls.count = shown;
  });
  return (
    <>
      <primitive object={built.hung} />
      <primitive object={built.sitting} />
      <primitive object={built.rising} />
      <primitive object={built.skulls} />
      <mesh geometry={built.boneyard} name="skeleton-boneyard" frustumCulled={false}>
        <meshStandardMaterial vertexColors roughness={0.9} metalness={0} />
      </mesh>
    </>
  );
}
