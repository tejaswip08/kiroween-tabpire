# Themes: a unique scene per theme (addendum to the themes spec)

The first version of the themes spec kept the Crypt graveyard in every theme and added a few props. The themes
then looked almost the same. This addendum replaces that for the five non-Crypt themes: each one is its own scene,
with its own layout, centrepiece, ground, path, props, moon, sky and weather. **The Crypt stays exactly as it is.**

## Rules

1. **The Crypt is untouched.** `SceneContents`, `buildLayout()`, `tests/fixtures/crypt-baseline.json`, the Crypt
   budget (157,876 triangles, 123 draw calls) and every Crypt test stay as they are. A failing Crypt test means the
   change is wrong, never the fixture.
2. **No Crypt graveyard in the other themes.** No crypt building, gate, gravestone rows, fence line, coffins,
   path tiles, far village or Crypt critters (cat, crows, owl, spiders, cobwebs, skeletons, open coffin).
3. **Each theme is recognisable in under a second without colour**: its own centrepiece and silhouette.
4. **Each theme has its own scene component**, chosen by theme id. The themes share only the camera, the portrait
   canvas, the performance settings and generic building blocks (sky shader, moon disc, clouds, bats, ghosts, fog,
   lights, weather points, post effects). They are configured per theme, never copied.
5. **Grounded and in view.** Every model's lowest point sits on the ground (from its bounding box after scaling).
   Nothing in the near foreground is cut by the screen edge. No prop near the camera rises into the middle of the
   screen above the cards (see the view rules below).
6. **60 fps.** Instancing for repeated props (one `InstancedMesh` per model part). Every theme stays within
   `BUDGET.sceneTriangles` (200,000) and `BUDGET.sceneDrawCalls` (150), at most `BUDGET.maxPointLights` (6) real
   lights, weather at most 2,000 particles. Motion runs in shaders or as one matrix update per animated object.
   No blur, no lowered resolution. Reduced motion stops the animation.
7. **No-flash switch kept.** A theme's scene loads its files through `useGLTF(url, false, true)` inside the scene's
   `Suspense`, so `ThemedScene` keeps the old scene until the new one is ready. `themeScene(id).models` lists every
   file of the theme, so the gate loader and the idle preload (`preloadThemes.ts`) load exactly those files.
8. **No network**, no image files opened, no screenshots. Models through `modelFile`/`assetUrl` only.
9. **Cards and header unchanged.** No CSS change to the page layout.
10. **Distinct prop sets.** Among the five non-Crypt themes, no theme shares more than 30% of its model files with
    another: for every ordered pair (A, B), `|files(A) ∩ files(B)| <= 0.3 * |files(A)|`. Every theme has a
    `centrepiece` defined.

## Architecture

```
lib/scene/uniqueScenes/types.ts        UniqueSceneSpec (pure data), shared helpers (grounding, view checks)
lib/scene/uniqueScenes/<theme>.ts      buildPumpkinPatch(seed), buildWitchsForest(seed), ... (pure, seeded)
lib/scene/uniqueScenes/index.ts        UNIQUE_SCENES: Partial<Record<ThemeId, (seed) => UniqueSceneSpec>>
lib/scene/themeLayout.ts               themeScene(id): the Crypt as now; a unique theme returns its spec's layout,
                                       models, anchors and weather
entrypoints/newtab/layers/scene/themes/ThemeSceneRoot.tsx    shared, configurable layers + the theme component
entrypoints/newtab/layers/scene/themes/<Theme>Scene.tsx      PumpkinPatchScene, WitchsForestScene, ...
entrypoints/newtab/layers/scene/themes/index.ts             THEME_SCENES: id -> component
ThemedScene.tsx                        shown === 'crypt' or no unique scene yet ? <SceneContents/> : <ThemeSceneRoot id/>
```

`UniqueSceneSpec` (pure, no three.js) holds at least:

- `centrepiece`: the placement (model, x, z, rotY, scale) that makes the theme recognisable, and the ids of the
  placements that form it.
- `placements`: every model placement (group `themed` or `centre`), drawn with `SafeModelBatch`, one per model.
- `models`: the unique model ids with a file (for loading, preload and the distinctness test).
- `ground`: base colour, tint and texture kind (earth, moss, snow, cracked rock, flagstone).
- `path`: its kind (dirt track, mossy trail, none, flagstone) and its centre line.
- `moon`: screen target `{ x, y }` for an aspect, and a disc scale (1 is the Crypt size). The cloud keep-out and the
  tall-prop moon check scale with it.
- `sky`: features such as `aurora` or `lightning`.
- `lights` (at most 6 real point lights), `glows` (flames, windows, glowing mushrooms), `anchors` (ember sources),
  `ghostSpots`, `weather`, and flags for the shared layers (clouds, witch, bats multiplier, ghost tint, mist).
- `extras`: an upper bound of the triangles and draw calls of the theme's procedural parts (scarecrow, snow mounds,
  ice, lava cracks, blades, flags), used by the budget test.

The scene colours keep coming from `lib/themes.ts` (`THEMES[id].scene`); the spec can override only what the
theme brief needs.

### Shared data layers

Ghosts (crypt items), bats, fog density (memory in use), embers (starving tabs), the witch and Dawn keep working in
every theme through the shared layers. The Crypt's data slots (new graves for staked tabs, coffins for put-to-sleep
tabs, candles for garlic sites) are Crypt-only.

### View rules (tested at the rest camera, aspects 16:10, 16:9 and 21:9)

- The centrepiece's horizontal centre projects into x 0.25 to 0.75, its top projects above y 0.46 (above the card
  band, which starts at about y 0.48), and it stays inside x 0.02 to 0.98.
- Any placement closer than 13 units (camera depth) is not cut by the screen edge (`cutByScreenEdge`), and, if its
  centre is within x 0.12 to 0.88, its top projects below y 0.5.
- Every placement is inside `GROUND`, and models with a file sit with their lowest point within 0.05 of y = 0.

## Theme briefs

1. **Pumpkin Patch** (farm at dusk). Centrepiece `farm_barn`, with `farm_silo` and `farm_windmill` (slowly turning
   blades, split with `lib/scene/windmill.ts`) behind it. Rows of `farm_corn` on both sides like a field, `farm_hay`
   bales, `farm_fence` along a dirt path, dozens of `farm_pumpkin` of different sizes, a few glowing
   jack-o'-lanterns, a scarecrow from simple shapes. Warm orange dusk sky, a big orange harvest moon low on the
   horizon, falling leaves. Ground: brown-orange earth.
2. **Witch's Forest** (a haunted red-green forest, after a painting). Two-tone light: a hot red-orange glow in the upper sky
   and on the left (a fire), eerie green mist in the distance and on the right. Dark red sky at the top, murky green at the
   horizon, thick green fog low on the ground. No moon disc. Huge gnarled `forest_twisted_a/b/c` in three layers of depth
   (bark mesh only, no leaf clumps, near-black silhouettes with orange rim light on the left and green on the right) close
   over a winding dirt path like a tunnel; the centrepiece is the tree that closes the tunnel at the end of the path. The
   biggest tree, left foreground, has a glowing jack-o'-lantern face; a fire of flickering cones burns at its foot beside a
   big `pumpkin_orange_jackolantern`. A big scarecrow (ragged coat, witch hat, straw hands) on a post in the right
   foreground and two small ones along the path, swaying. Three or four bright green ghosts bob among the branches on the
   right, one faint orange wisp on the left. A few crooked crosses and tiny tombstones, rough grass and small dark plants at
   the path edges. A small `forest_cauldron` with a green glow and a few small glowing `forest_mushroom` beside the path,
   fireflies. Ground: near-black. The centre of the path stays clear. Reduced motion stops the flicker, sway and bobbing.
3. **Frozen Cemetery** (snowy graveyard). Centrepiece: a frozen lake (a flat, slightly reflective ice disc) with a
   few tilted gravestones stuck in the ice, icicles on them. `frost_pine_a/b` and `frost_pines` heavy on both
   sides, `frost_rock` as ice boulders, snow mounds (white low-poly bumps). Pale blue-white ground, a cold
   silver-white moon, a dark navy sky with faint aurora bands, falling snow, ghosts tinted icy blue.
4. **Blood Moon** (ancient ruins). Centrepiece `blood_ruins` on a raised stone platform, with a ring of
   `blood_column` and `blood_column_round` (some broken or tilted) like a ritual circle, and `blood_pedestal` in the
   middle with a glowing red flame. Cracked dark-red ground with a few glowing lava-like cracks, dead trees only.
   A huge blood-red moon directly behind the ruins (twice the normal size), a deep crimson sky, falling ash, more
   bats. The ruins may stand in front of the moon on purpose.
5. **Haunted Castle** (castle courtyard). Centrepiece `castle_fortress`, large and close, filling the back, with
   `castle_wall_towers` and `castle_stone_wall` left and right as a courtyard wall. `castle_banner` and
   `castle_wall_flag` on the walls, gently swaying. `castle_torch` with flickering warm light along a straight
   flagstone path to the castle door. Lit yellow windows, a stormy dark blue-grey sky with occasional soft
   lightning flashes (brightness only), a pale moon behind a tower, embers near the torches.

## Tests

- `tests/uniqueScenes.test.ts`: for every unique theme, a centrepiece is defined and is one of its placements;
  the distinctness rule (rule 10); determinism for a seed; every placement inside `GROUND`; no overlaps between
  solid placements; the view rules; `themeScene(id).models` equals the spec's models; weather and lights limits.
- `tests/propSizes.test.ts` keeps checking that every Quaternius placement is drawn at its catalogue size, and gains
  a grounding check (lowest point within 0.05 of y = 0).
- `tests/budget.test.ts`: the plan of a unique theme counts its placements (with the shadow pass), its `extras`,
  the shared layers it turns on, and its weather. Crypt numbers unchanged.
- Existing tests that assumed the other themes reuse the Crypt layout (`tests/themeLayout.test.ts` and others) are
  rewritten to the new rule, never weakened for the Crypt.

## Order of work

1. Framework and Pumpkin Patch (the template), with the tests above for one theme.
2. Witch's Forest. 3. Frozen Cemetery. 4. Blood Moon. 5. Haunted Castle.
6. Remove the old add-to-the-Crypt code for themes, finish the cross-theme tests, run everything, commit.
