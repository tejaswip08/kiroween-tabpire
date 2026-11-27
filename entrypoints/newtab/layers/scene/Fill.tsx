import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { Color, InstancedMesh, Matrix4, MeshBasicMaterial, MeshStandardMaterial, SphereGeometry, Vector3 } from 'three';
import type { ModelId, Placement } from '../../../../lib/scene/layout';
import { cauldronFxAt } from '../../../../lib/scene/uniqueScenes/forest';
import type { FillFirefly, FillPlan } from '../../../../lib/scene/uniqueScenes/fill';
import { CauldronFx } from './CauldronFx';
import { useDisplay } from './display';
import { fillGeometry, fogGeometry, fogTexture } from './fillShapes';
import { SafeModelBatch, compose, type ModelLook, type ModelSway } from './ModelBatch';
import { useSceneTheme } from './themeColors';

/** The Witch's Forest draws its rocks mossy; the fill's rocks match. */
const LOOKS: Partial<Record<ModelId, ModelLook>> = {
  forest_rocks: { color: '#7f9a74' },
  forest_rock_large: { color: '#7f9a74' },
};

/** The Frozen Cemetery's small pines sway in its wind. */
const FROST_SWAY: ModelSway = { strength: 0.03 };
const tmp = new Matrix4();

/** One kind of small shape, instanced: one draw call for all of them. */
function ShapeBatch({ model, theme, placements }: { model: ModelId; theme: FillPlan['theme']; placements: readonly Placement[] }) {
  const built = useMemo(() => {
    const fog = model === 'fill_fog';
    const geometry = fog ? fogGeometry() : fillGeometry(model, theme);
    if (!geometry) return null;
    const texture = fog ? fogTexture() : null;
    const material = fog
      ? new MeshBasicMaterial({ map: texture, color: new Color('#a596cf'), transparent: true, opacity: 0.3, depthWrite: false })
      : new MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, flatShading: true });
    const mesh = new InstancedMesh(geometry, material, placements.length);
    mesh.frustumCulled = false;
    mesh.receiveShadow = !fog;
    mesh.name = model;
    if (fog) mesh.renderOrder = 2;
    placements.forEach((p, i) => mesh.setMatrixAt(i, compose(p, 1, tmp)));
    mesh.instanceMatrix.needsUpdate = true;
    return { mesh, geometry, material, texture };
  }, [model, theme, placements]);
  useEffect(
    () => () => {
      if (!built) return;
      built.geometry.dispose();
      built.material.dispose();
      built.texture?.dispose();
      built.mesh.dispose();
    },
    [built],
  );
  return built ? <primitive object={built.mesh} /> : null;
}

const GLOW = new Color(2.6, 2.1, 0.7);
/** Fireflies hovering low over the ground. They bob and drift a little; with reduced motion they hold still. */
function Fireflies({ spots }: { spots: readonly FillFirefly[] }) {
  const display = useDisplay();
  const mesh = useMemo(() => {
    const m = new InstancedMesh(new SphereGeometry(0.06, 6, 5), new MeshBasicMaterial({ color: GLOW, toneMapped: false }), spots.length);
    m.frustumCulled = false;
    return m;
  }, [spots.length]);
  useEffect(() => () => {
    mesh.geometry.dispose();
    (mesh.material as MeshBasicMaterial).dispose();
    mesh.dispose();
  }, [mesh]);
  const v = useMemo(() => new Vector3(), []);
  useFrame(() => {
    const t = display.reduced ? 0 : display.time;
    spots.forEach((s, i) => {
      v.set(s.x + Math.sin(t * 0.4 + s.seed * 2.1) * 0.5, s.y + Math.sin(t * 0.9 + s.seed) * 0.15, s.z + Math.cos(t * 0.33 + s.seed * 1.7) * 0.5);
      mesh.setMatrixAt(i, tmp.makeTranslation(v.x, v.y, v.z));
    });
    mesh.instanceMatrix.needsUpdate = true;
  });
  return <primitive object={mesh} />;
}

/**
 * The fill of the theme (`lib/scene/uniqueScenes/fill.ts`): the small props that make the empty ground feel alive. Models are drawn
 * one batch per model, the small shapes one instanced mesh per kind. They all stand behind the cards, below the chips row.
 */
export function FillProps() {
  const { scene } = useSceneTheme();
  const fill = scene.fill;
  const groups = useMemo(() => {
    if (!fill) return { files: [], shapes: [], pots: [] as Placement[] };
    const by = new Map<ModelId, Placement[]>();
    for (const p of fill.placements) by.set(p.model, [...(by.get(p.model) ?? []), p]);
    const entries = [...by.entries()];
    return {
      files: entries.filter(([id]) => fill.models.includes(id)),
      shapes: entries.filter(([id]) => id.startsWith('fill_')),
      pots: by.get('forest_cauldron') ?? [],
    };
  }, [fill]);
  if (!fill) return null;
  return (
    <>
      {groups.files.map(([id, placements]) => (
        <SafeModelBatch key={id} id={id} placements={placements} look={LOOKS[id]} sway={fill.theme === 'frost' && id === 'frost_pines' ? FROST_SWAY : undefined} />
      ))}
      {groups.shapes.map(([id, placements]) => (
        <ShapeBatch key={id} model={id} theme={fill.theme} placements={placements} />
      ))}
      {groups.pots.map((p) => (
        <CauldronFx key={p.id} at={cauldronFxAt(p)} />
      ))}
      {fill.fireflies.length > 0 && <Fireflies spots={fill.fireflies} />}
    </>
  );
}
