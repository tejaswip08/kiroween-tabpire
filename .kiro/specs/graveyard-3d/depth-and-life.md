# Depth and life (addendum to Spec 4)

The yard is built in depth layers, with small animated things and a mouse parallax. The layout of the path, gate, crypt and moon is unchanged.

## Layers

| Layer | What | Where it is made |
| --- | --- | --- |
| Far background | Hills with a village: Quaternius `farm_barn`, `farm_windmill` (its sails turn slowly), `castle_fortress`, two parts of `blood_ruins`, a crooked church with one lit window and a few houses. Everything is one dark silhouette mesh in the fog, with a few orange windows. | `lib/scene/depth.ts`, `layers/scene/FarVillage.tsx`, `farBuild.ts` |
| Far sky | Low clouds at three depths (some pass in front of the hills). They fade out around the moon, so they never cover it. | `lib/scene/depth.ts`, `LowClouds.tsx` |
| Midground | About 45 trees with leans, more graves with turns, leans and sizes, post_skull, shrine_candles, broken fences, glowing mushrooms, a bubbling cauldron, a half-open coffin. | `lib/scene/layout.ts`, `Props.tsx`, `CauldronFx.tsx`, `OpenCoffin.tsx` |
| Foreground life | Skeletons rising from three mounds, a black cat on a gravestone, crows, an owl, spiders on threads, cobwebs, will-o'-the-wisps. | `lib/scene/critters.ts`, `Skeletons.tsx`, `Cat.tsx`, `Crows.tsx`, `Owl.tsx`, `Spiders.tsx`, `Wisps.tsx` |

## Mouse parallax

The camera glides toward the pointer (spring, no overshoot): at most 1.3 sideways and 0.45 up or down, a few degrees of view. It moves, so near things shift more than far ones. It drifts back, more slowly, when the pointer leaves the window or stops for 2.5 seconds. It is off with reduced motion. Maths: `lib/scene/parallax.ts`.

## Budget

- Draw calls stay under 150 (about 120 measured). Repeated models are instanced; the far village is one mesh; each critter is one to three draw calls.
- The triangle limit is raised from 150,000 to 175,000 for the richer yard. The budget test counts every hidden instance and the shadow pass, so the real load is lower. To go back to 150,000, lower the number of trees (`backRow` in `layout.ts`) or graves (`variety` loop).
- Only the main props cast shadows (trees, the crypt, the gate, the pumpkins and lanterns).
