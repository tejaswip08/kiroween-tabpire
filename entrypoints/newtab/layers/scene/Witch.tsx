import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { DoubleSide, type Group, type ShapeGeometry, Vector3 } from 'three';
import { onSceneEvent } from '../../../../lib/scene/bus';
import { WITCH_FLIGHT_S, witchAtInto } from '../../../../lib/scene/sky';
import { useDisplay } from './display';
import { makeBodyGeometry, makeBroomGeometry, makeCloakGeometry, rippleCloak } from './witchShape';

const R = 340;
/** One unit of the silhouette, as an angle on the sky. The whole witch is about 8 units long. */
const UNIT = R * Math.tan((1.45 * Math.PI) / 180);

type Mode = 'hidden' | 'flying' | 'leaving';

/**
 * The witch on her broomstick: a clear near-black side-on silhouette (#120818, unlit). She sits on the broom
 * with a pointed crooked hat, her ragged cloak streaming and rippling behind her, and bristles at the tail.
 * She glides across the sky in front of the moon with a slight bob, again and again with a short pause, and
 * sweeps off the top when Dawn runs. With reduced motion she holds still.
 */
export function Witch() {
  const display = useDisplay();
  const group = useRef<Group>(null);
  const geo = useMemo(() => {
    const cloak = makeCloakGeometry();
    return { broom: makeBroomGeometry(), body: makeBodyGeometry(), cloak, cloakBase: Float32Array.from(cloak.getAttribute('position').array) };
  }, []);
  const state = useRef({ mode: 'hidden' as Mode, progress: 0, leaveT: 0, wait: 0, out: { u: 0, v: 0, tilt: 0 } });
  const tmp = useMemo(() => new Vector3(), []);

  useEffect(
    () =>
      onSceneEvent((e) => {
        if (e.type === 'dawn' && state.current.mode === 'flying') {
          state.current.mode = display.reduced ? 'hidden' : 'leaving';
          state.current.leaveT = 0;
        }
      }),
    [display],
  );

  useFrame(({ camera }, rawDt) => {
    const g = group.current;
    if (!g) return;
    const dt = Math.min(rawDt, 0.1);
    const st = state.current;
    if (st.mode === 'hidden') {
      st.wait -= dt;
      if (st.wait <= 0 || display.reduced) {
        st.mode = 'flying';
        st.progress = display.reduced ? 0.3 : 0;
      }
    }
    if (st.mode === 'hidden') {
      g.visible = false;
      return;
    }
    if (!display.reduced) {
      if (st.mode === 'flying') {
        st.progress += dt / WITCH_FLIGHT_S;
        if (st.progress > 1) {
          st.mode = 'hidden';
          st.wait = 6;
          g.visible = false;
          return;
        }
      } else {
        st.leaveT += dt;
        st.progress = Math.min(0.98, st.progress + (dt / WITCH_FLIGHT_S) * 6);
        if (st.leaveT > 6) {
          st.mode = 'hidden';
          st.wait = 10;
          g.visible = false;
          return;
        }
      }
    }
    const t = display.time;
    const w = witchAtInto(st.progress, st.out);
    const lift = st.mode === 'leaving' ? st.leaveT * st.leaveT * 1.6 : 0;
    // A slight bob up and down, and a small rock with it.
    const bob = display.reduced ? 0 : Math.sin(t * 1.7) * 0.45;
    const tu = Math.tan((w.u * Math.PI) / 180);
    const tv = Math.tan(((w.v + lift + bob) * Math.PI) / 180);
    tmp.copy(display.moon).addScaledVector(display.moonRight, tu).addScaledVector(display.moonUp, tv).normalize();
    g.visible = true;
    g.position.copy(camera.position).addScaledVector(tmp, R);
    g.quaternion.copy(camera.quaternion);
    g.rotateZ(w.tilt + (display.reduced ? 0 : Math.sin(t * 1.7 + 0.6) * 0.04));
    g.scale.setScalar(UNIT);
    rippleCloak(geo.cloak as ShapeGeometry, geo.cloakBase, t, display.reduced ? 0 : 1);
  });

  // A flat near-black silhouette: a basic material, so no light or tone mapping can turn her pale.
  const dark = <meshBasicMaterial color="#120818" side={DoubleSide} depthWrite={false} toneMapped={false} fog={false} />;
  return (
    <group ref={group} visible={false} renderOrder={-70}>
      {[geo.broom, geo.body, geo.cloak].map((g, i) => (
        <mesh key={i} geometry={g} renderOrder={-70}>
          {dark}
        </mesh>
      ))}
    </group>
  );
}
