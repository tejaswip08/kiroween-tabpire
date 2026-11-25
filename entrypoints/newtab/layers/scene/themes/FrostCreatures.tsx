import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { type Group, type InstancedMesh, Matrix4, Mesh } from 'three';
import { type FrostAttached, type FrostPlan, howlAmount } from '../../../../../lib/scene/uniqueScenes/frostPlan';
import { useDisplay } from '../display';
import { Icicles } from './Icicles';
import {
  NECK, buildCrow, buildOwlBody, buildOwlHead, buildWolfBody, buildWolfEyes, buildWolfHead,
} from './frostShapes';
import { disposeMesh, glowMaterial, litMaterial, makeInstanced, placeAt } from './frostParts';
const EYES_BLUE = '#8fe0ff';
const REST = -0.2;
const RAISED = 0.95;
/** The pivot of a wolf's head: the base of its neck, turned a little. */
const headMatrix = (base: Matrix4, angle: number) => base.clone().multiply(new Matrix4().makeTranslation(NECK.x, NECK.y, 0)).multiply(new Matrix4().makeRotationZ(angle));
/**
 * A pack of three wolf silhouettes on the far ridge, with glowing ice-blue eyes. Two stand watching; the third slowly raises its head to
 * howl at the moon, holds it, and lowers it again. Under reduced motion it keeps its head down.
 */
function Wolves({ wolves }: { wolves: FrostPlan['wolves'] }) {
  const display = useDisplay();
  const neck = useRef<Group>(null);
  const howler = wolves.find((w) => w.howl);
  const built = useMemo(() => {
    const dark = () => litMaterial('#16305a', 0.45);
    const bases = wolves.map((w) => placeAt(w.x, w.y, w.z, w.rotY, w.scale));
    const still = wolves.map((w, i) => ({ w, base: bases[i]! })).filter((e) => !e.w.howl);
    const eyeMat = glowMaterial(EYES_BLUE, 2.4);
    const meshes: InstancedMesh[] = [
      makeInstanced(buildWolfBody(), dark(), bases, 'frost-wolves', { castShadow: true }),
      makeInstanced(buildWolfHead(), dark(), still.map((e) => headMatrix(e.base, REST)), 'frost-wolf-heads'),
      makeInstanced(buildWolfEyes(), eyeMat, still.map((e) => headMatrix(e.base, REST)), 'frost-wolf-eyes'),
    ];
    const head = new Mesh(buildWolfHead(), dark());
    head.name = 'frost-wolf-howl-head';
    const eyes = new Mesh(buildWolfEyes(), glowMaterial(EYES_BLUE, 2.4));
    eyes.name = 'frost-wolf-howl-eyes';
    return { meshes, head, eyes };
  }, [wolves]);
  useEffect(
    () => () => {
      built.meshes.forEach(disposeMesh);
      disposeMesh(built.head);
      disposeMesh(built.eyes);
    },
    [built],
  );
  useFrame(() => {
    if (neck.current) neck.current.rotation.z = display.reduced ? REST : REST + (RAISED - REST) * howlAmount(display.time);
  });
  return (
    <>
      {built.meshes.map((m) => (
        <primitive key={m.name} object={m} />
      ))}
      {howler && (
        <group position={[howler.x, howler.y, howler.z]} rotation={[0, howler.rotY, 0]} scale={howler.scale}>
          <group ref={neck} position={[NECK.x, NECK.y, 0]} rotation={[0, 0, REST]}>
            <primitive object={built.head} />
            <primitive object={built.eyes} />
          </group>
        </group>
      )}
    </>
  );
}
/** A snowy owl on a tombstone. Its head slowly turns from side to side and back (it holds still under reduced motion). */
function SnowyOwl({ owl }: { owl: FrostPlan['owl'] }) {
  const display = useDisplay();
  const head = useRef<Group>(null);
  const built = useMemo(() => {
    const body = new Mesh(buildOwlBody(), litMaterial('#3a5a8c', 0.5));
    body.name = 'frost-owl';
    body.castShadow = true;
    const top = new Mesh(buildOwlHead(), litMaterial('#3a5a8c', 0.5));
    top.name = 'frost-owl-head';
    return { body, top };
  }, []);
  useEffect(() => () => {
    disposeMesh(built.body);
    disposeMesh(built.top);
  }, [built]);
  useFrame(() => {
    if (head.current) head.current.rotation.y = display.reduced ? 0 : 0.7 * Math.sin(display.time * 0.28) * Math.abs(Math.sin(display.time * 0.11));
  });
  return (
    <group position={[owl.x, owl.y, owl.z]} rotation={[0, owl.rotY, 0]} scale={1.3}>
      <primitive object={built.body} />
      <group ref={head} position={[0, 0.58, 0.02]}>
        <primitive object={built.top} />
      </group>
    </group>
  );
}
/** Two crows sitting on the branches of the bare tree, and the icicles under its branches. */
function TreeThings({ attached }: { attached: FrostAttached }) {
  const crows = useMemo(() => makeInstanced(buildCrow(), litMaterial('#14305a', 0.5), attached.crows.map((c) => placeAt(c.x, c.y, c.z, c.rotY, 1.5)), 'frost-crows', { castShadow: true }), [attached]);
  useEffect(() => () => disposeMesh(crows), [crows]);
  return (
    <>
      <primitive object={crows} />
      <Icicles icicles={attached.treeIcicles} name="tree-icicles" />
    </>
  );
}
/** The creatures of the Frozen Cemetery: the wolves on the far ridge, the owl in the left corner, the crows on the bare tree. */
export function FrostCreatures({ plan, attached }: { plan: FrostPlan; attached: FrostAttached }) {
  return (
    <>
      <Wolves wolves={plan.wolves} />
      <SnowyOwl owl={plan.owl} />
      <TreeThings attached={attached} />
    </>
  );
}
