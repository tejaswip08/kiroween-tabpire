import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { Color, DoubleSide, type InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import { flicker } from '../../../../../lib/scene/flicker';
import { HOUSE, housePoint, type FrostPlan } from '../../../../../lib/scene/uniqueScenes/frostPlan';
import { useDisplay } from '../display';
import { Icicles } from './Icicles';
import { buildCottage, buildFlagCloth, buildFlagPole, buildGateLeaf, buildHouse, buildHouseWindows, buildSmokePuff } from './frostShapes';
import { disposeMesh, litMaterial, makeInstanced, placeAt } from './frostParts';
import { addFlutter } from './frostWind';
/** Puffs of chimney smoke in the air at once. */
export const SMOKE_PUFFS = 9;
/** Seconds a puff takes from the chimney top until it is gone. */
const SMOKE_LIFE = 7;
/** The window light: faint, a little under the Bloom threshold, so it glows without turning into a blob. */
const WINDOW_LEVEL = 1.05;
const m4 = new Matrix4();
const q = new Quaternion();
const v = new Vector3();
const s = new Vector3();
/**
 * The haunted house at the end of the path, where your saved tabs wait (the crypt): one merged mesh (crooked walls, a sagging roof heavy
 * with snow, boarded windows, broken shutters, a leaning chimney), a faint light behind the boards that flickers (warm at the front, cold
 * blue at the side), icicles on its eaves, thin smoke from the chimney drifting with the wind, the broken gate in front, a tattered flag
 * flapping on a leaning pole, and two faded ruined cottages far back on the horizon. Under reduced motion the light, the smoke and the
 * flag hold still.
 */
export function FrostHouse({ plan }: { plan: FrostPlan }) {
  const display = useDisplay();
  const parts = useMemo(() => {
    const body = new Mesh(buildHouse(), litMaterial('#16305a', 0.5));
    body.castShadow = true;
    body.receiveShadow = true;
    body.name = 'frost-house';
    const lightMat = new MeshBasicMaterial({ vertexColors: true, toneMapped: false, fog: false, color: new Color(WINDOW_LEVEL, WINDOW_LEVEL, WINDOW_LEVEL) });
    const windows = new Mesh(buildHouseWindows(), lightMat);
    windows.name = 'frost-house-windows';
    const smoke = makeInstanced(
      buildSmokePuff(),
      new MeshBasicMaterial({ color: '#8d9cb8', transparent: true, opacity: 0.08, depthWrite: false }),
      Array.from({ length: SMOKE_PUFFS }, () => new Matrix4()),
      'frost-chimney-smoke',
      { renderOrder: 3 },
    );
    const gate = makeInstanced(
      buildGateLeaf(),
      litMaterial('#10203a', 0.4),
      plan.gate.map((g) => placeAt(g.x, 0, g.z, g.rotY + (g.side < 0 ? Math.PI : 0), 1, [0, g.lean * g.side])),
      'frost-gate',
      { castShadow: true },
    );
    const f = plan.flag;
    const pole = new Mesh(buildFlagPole(), litMaterial('#10203a', 0.4));
    pole.applyMatrix4(placeAt(f.x, 0, f.z, f.rotY, [1, f.height, 1], [0, f.lean]));
    pole.name = 'frost-flag-pole';
    const clothMat = addFlutter(new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, side: DoubleSide, emissive: new Color('#0e1c38'), emissiveIntensity: 0.5 }), 1.2);
    const cloth = new Mesh(buildFlagCloth(), clothMat);
    // The cloth hangs from the top of the leaning pole.
    const top = new Vector3(0, f.height, 0).applyMatrix4(placeAt(0, 0, 0, f.rotY, 1, [0, f.lean]));
    cloth.position.set(f.x + top.x, top.y - 0.04, f.z + top.z);
    cloth.rotation.set(0, f.rotY, 0);
    cloth.name = 'frost-flag';
    const cottages = makeInstanced(
      buildCottage(),
      litMaterial('#1d3561', 0.55),
      plan.cottages.map((c) => placeAt(c.x, 0, c.z, c.rotY, c.scale)),
      'frost-far-cottages',
    );
    return { body, windows, smoke, gate, pole, cloth, cottages };
  }, [plan]);
  useEffect(() => () => Object.values(parts).forEach((m) => disposeMesh(m as Mesh)), [parts]);
  const chimney = useMemo(() => new Vector3(...housePoint(HOUSE.chimneyX + 0.24, HOUSE.chimneyTop + 0.15, HOUSE.chimneyZ)), []);
  useFrame(() => {
    const t = display.reduced ? 0 : display.time;
    // A slow, uneven flicker, as if a candle burned somewhere inside.
    const k = WINDOW_LEVEL * (display.reduced ? 1 : 0.55 + 0.45 * flicker(t * 0.6, 3) * (0.85 + 0.15 * Math.sin(t * 0.37)));
    (parts.windows.material as MeshBasicMaterial).color.setScalar(k);
    // Smoke: each puff rises from the chimney, swells, drifts downwind and fades out by shrinking.
    const smoke = parts.smoke as InstancedMesh;
    for (let i = 0; i < SMOKE_PUFFS; i++) {
      const life = ((t / SMOKE_LIFE + i / SMOKE_PUFFS) % 1 + 1) % 1;
      const drift = life * life * (1.6 + 0.8 * Math.sin(t * 0.21 + i));
      v.set(chimney.x + drift + 0.15 * Math.sin(t * 0.9 + i * 2.3), chimney.y + life * 1.5, chimney.z + 0.2 * Math.sin(t * 0.5 + i));
      const size = (0.1 + life * 0.26) * (life > 0.75 ? Math.max(0, 1 - (life - 0.75) / 0.25) : 1) * Math.min(1, life * 8);
      s.set(size * 1.3, size, size);
      smoke.setMatrixAt(i, m4.compose(v, q.identity(), s));
    }
    smoke.instanceMatrix.needsUpdate = true;
  });
  return (
    <>
      <group position={[HOUSE.x, 0, HOUSE.z]} rotation={[0, HOUSE.rotY, 0]} scale={HOUSE.scale}>
        <primitive object={parts.body} />
        <primitive object={parts.windows} />
      </group>
      <primitive object={parts.smoke} />
      <primitive object={parts.gate} />
      <primitive object={parts.pole} />
      <primitive object={parts.cloth} />
      <primitive object={parts.cottages} />
      <Icicles icicles={plan.houseIcicles} name="house-icicles" />
    </>
  );
}
