import { Canvas } from '@react-three/fiber';
import { PerspectiveCamera, View } from '@react-three/drei';
import { Suspense, type CSSProperties } from 'react';
import type { Stage } from '../../lib/hunger';
import { Kay, type KayName } from './kaykit';
import { Moonlight } from './kenney';
import { Vampire, type VampireProps } from './vampire';

const STONES: KayName[] = ['gravestone', 'gravemarker_A', 'gravemarker_B', 'gravestone'];

/** One tab's little graveyard island: dirt mound, its gravestone, a candle, and the vampire (or its coffin). */
function GraveDiorama(props: VampireProps) {
  const v = props.variant ?? 0;
  const resting = props.stage === 'coffin' && !props.fx;
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 1.15, 3.2]} fov={30} onUpdate={(c) => c.lookAt(0, 0.55, 0)} />
      <Moonlight stage={props.stage} candle={[0.6, 0.35, 0.15]} />
      <Kay name="floor_dirt_small" scale={[0.6, 0.4, 0.5]} shadows={false} />
      <Kay name={STONES[v % STONES.length]!} position={[0, 0, -0.5]} scale={v % 4 === 0 ? 0.55 : 0.75} rotation={[0, ((v % 5) - 2) * 0.06, 0]} />
      <Kay name={v % 2 ? 'candle_triple' : 'candle_melted'} position={[0.6, 0, 0.15]} scale={0.38} />
      {v % 3 === 0 && <Kay name="pumpkin_orange_jackolantern" position={[-0.6, 0, 0.18]} scale={0.21} rotation={[0, 0.5, 0]} />}
      {v % 3 === 1 && <Kay name="skull_candle" position={[-0.6, 0, 0.12]} scale={0.26} rotation={[0, 0.4, 0]} />}
      {v % 3 === 2 && <Kay name="pumpkin_yellow_small" position={[-0.6, 0, 0.15]} scale={0.42} />}
      {resting ? (
        <Kay name="coffin_decorated" position={[0, 0, 0.1]} scale={0.32} rotation={[0, 0.35, 0]} />
      ) : (
        <Vampire {...props} height={1.2} />
      )}
    </>
  );
}

/** A tab's vampire diorama drawn into the page's shared canvas. */
export function Portrait({ className, style, ...props }: VampireProps & { className?: string; style?: CSSProperties }) {
  return (
    <View className={className} style={style}>
      <Suspense fallback={null}>
        <GraveDiorama {...props} />
      </Suspense>
    </View>
  );
}

/** One full-page WebGL canvas that every <Portrait> renders into. Mount once per page. */
export function SharedCanvas() {
  return (
    <Canvas
      flat
      dpr={[1, 1.75]}
      eventSource={document.getElementById('root')!}
      eventPrefix="client"
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 2 }}
    >
      <View.Port />
    </Canvas>
  );
}

/** Self-contained canvas for small surfaces like the popup. */
export function StandaloneVampire({ style, ...props }: VampireProps & { style?: CSSProperties }) {
  return (
    <Canvas flat dpr={[1, 2]} gl={{ antialias: true, alpha: true }} style={style}>
      <Suspense fallback={null}>
        <GraveDiorama {...props} />
      </Suspense>
    </Canvas>
  );
}
