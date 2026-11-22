import { PerspectiveCamera, View } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import { setPortraitReady } from '../portraitReady';
import { BatForm } from './BatForm';
import { Coffin } from './Coffin';
import { EmberBurst } from './EmberBurst';
import { GlowHalo } from './GlowHalo';
import { Niche } from './Niche';
import { PortraitLights } from './PortraitLights';
import type { ExitRun, PortraitRef, PortraitState } from './shared';
import { useExitTriggers } from './useExitTriggers';
import { Vampire } from './Vampire';
import { ViewCamera } from './ViewCamera';
import { Zs } from './Zs';
import type { CardSlot } from './useCardSlots';
import { FRAME } from '../../../../lib/vampire/rig';

/** Marks the card ready after its view has drawn a few frames, so the emblem can fade out. */
function ReadyWhenDrawn({ id }: { id: number }) {
  const frames = useRef(0);
  useFrame(() => {
    if (++frames.current === 3) setPortraitReady(id, true);
  });
  useEffect(() => () => setPortraitReady(id, false), [id]);
  return null;
}

/** One card's view of the shared canvas. It follows the card's portrait slot. */
export function PortraitView({ slot }: { slot: CardSlot }) {
  const track = useMemo(() => ({ current: slot.el }), [slot.el]);
  const state = useRef<PortraitState | null>(null) as PortraitRef;
  const exitRun = useRef<ExitRun | null>(null);
  useExitTriggers(slot, exitRun);
  return (
    <View track={track}>
      <PerspectiveCamera makeDefault fov={FRAME.fov} near={0.1} far={20} position={[0, FRAME.centreY, FRAME.distance]} />
      <ViewCamera state={state} />
      <Niche state={slot.state} />
      <PortraitLights />
      <Suspense fallback={null}>
        <Vampire slotEl={slot.el} state={slot.state} seed={slot.id} poseRef={state} exitRun={exitRun} />
        <GlowHalo state={state} />
        <BatForm state={state} />
        <EmberBurst state={state} />
        <Coffin state={state} />
        <Zs state={state} />
        <ReadyWhenDrawn id={slot.id} />
      </Suspense>
    </View>
  );
}
