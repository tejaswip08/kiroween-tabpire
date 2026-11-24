# Implementation Plan: Themes (Spec 5)

## Overview

Six themes (The Crypt, Pumpkin Patch, Witch's Forest, Frozen Cemetery, Blood Moon, Haunted Castle), a Themes panel and one saved choice that every Tabpire page reads. The work goes in this order: record the Crypt baseline before touching anything, raise the triangle budget, build the pure theme data and the storage and cache layers, add the hook and the CSS tokens, then move the 3D scene onto theme data (colours, models, layouts, props, weather), add the budget checks, the no-flash switch, the instant sky, the portraits, the panel and the Blood Bank and demo parity.

Each task is small enough to finish and check on its own. Requirement numbers refer to `requirements.md`, property numbers to `design.md`. After each task, `npm run typecheck` and `npm test` must pass. Tests are part of the task that adds the code, not separate optional tasks. Property tests use fast-check with 100 runs or more and are tagged `Feature: themes, Property N: <text>`. Properties over the six themes loop over `THEME_IDS`.

The Crypt must stay exactly as it is: from task 1 on, `tests/themeBaseline.test.ts` compares the Crypt against the stored baseline, and it must pass after every task.

## Tasks

- [x] 1. Crypt baseline fixture (first, before any other change)
  - [x] 1.1 Generate `tests/fixtures/crypt-baseline.json` from the code as it is now, before any other task changes anything. Use a one-off script (vite-node, or a temporary vitest file that writes the JSON and is deleted afterwards). Record: `COLD`, `WARM`, `ACCENT` from `lib/scene/palette.ts`; the `C` set from `entrypoints/newtab/layers/scene/colors.ts`; the colour literals that sit inside components today (moon light body `[0.462, 0.058, 0.023]` and dark body `[0.195, 0.018, 0.009]` in `Moon.tsx`, cloud body `[0.045, 0.045, 0.1]` and tint `[0.2, 0.07, 0.12]` in `Clouds.tsx`, the low-cloud body in `LowClouds.tsx`, the far-village silhouette in `FarVillage.tsx`, the ground base and tint in `Ground.tsx`), each read from the source file and not typed from the design; the three portrait halo colours from `GlowHalo.tsx` (starving `1.8, 0.1, 0.12`, Dawn `3.0, 1.0, 0.25` x 0.7, white-hot `3.0, 2.2, 1.6` x 0.7); the 41 custom properties of the `:root[data-theme='crypt']` block of `tokens.css`; and the full `buildLayout()` output at the default seed. Commit nothing else in this step.
    - Do not edit any source file in this step.
    - _Requirements: 2.1, 2.2, 2.3, 2.5_
  - [x] 1.2 Create `tests/themeBaseline.test.ts`. For now it checks that the fixture equals today's exports (`COLD`, `WARM`, `ACCENT`, `C`), that the `crypt` block of `tokens.css` holds the 41 recorded names with the recorded values (later tasks add names, so compare only the recorded names), and that `buildLayout()` deep-equals the recorded layout. Later tasks extend this file.
    - _Requirements: 2.5, 16.4_

- [x] 2. Triangle budget 200,000
  - In `lib/scene/config.ts` set `BUDGET.sceneTriangles` to `200_000` (update the comment: raised from 175,000 for the theme props; `sceneDrawCalls` stays 150). In `tests/budget.test.ts` and any other test text that names 175,000, update the numbers and wording to 200,000. `tests/depth.test.ts` uses `BUDGET.sceneTriangles` as a ratio base and needs no edit unless a test fails. The Crypt plan is 157,876 triangles and 122 draw calls, so the headroom is now 42,124 triangles and 28 draw calls.
    - _Requirements: 13.8_

- [x] 3. Theme catalogue
  - [x] 3.1 In `lib/scene/palette.ts` add `CRYPT_EXTRA` (the hex literals now in `colors.ts`: `skyMid`, `skyHorizon`, `haze`, `mushroom`, `cauldron`, `wisp`, `ghost`, `lowCloud`, `farSilhouette`, `groundBase`, `groundTint`) and `CRYPT_SHADER` (the linear shader literals: `moonLight`, `moonDark`, `cloudBody`, `cloudTint`). Take the values from the baseline fixture. Make `colors.ts` import `CRYPT_EXTRA` so `C` keeps its current values. Do not touch the shaders yet. Extend `tests/themeBaseline.test.ts`: `CRYPT_EXTRA` and `CRYPT_SHADER` equal the fixture, and `tests/palette.test.ts` still passes unchanged.
    - _Requirements: 2.1, 2.4_
  - [x] 3.2 Create `lib/themes.ts` with `THEME_IDS`, `ThemeId`, `DEFAULT_THEME`, `isThemeId`, `ScenePalette`, `SURFACE_TOKENS` (the 41 Crypt names plus `shade`, `popup-fill`, `quote-ink`), `SurfaceTokens`, `WeatherKind`, `Theme`, `THEMES` (six, in order, with the names and one-line descriptions) and `themeById`, as in the design. The Crypt scene palette is assembled from `COLD`, `WARM`, `ACCENT`, `CRYPT_EXTRA` and `CRYPT_SHADER`. The other five scene palettes and the six `surface` maps use the design tables (the first-pass values). The Crypt `shade`, `popup-fill` and `quote-ink` hold the old literals. The `Theme` type has no `props` field yet (task 11.2 adds it). The module imports no browser API, no `wxt/browser` and no `three`. Create `tests/themes.test.ts`: **Property 1** (`themeById` is total, `themeById(id).id === id`, unknown strings give the Crypt), **Property 2** (every theme has every scene key as `#rrggbb` or three numbers from 0 to 1, and every surface name; solid surface colours are `#rrggbb`), **Property 8** (warm colours `candle`, `lantern`, `jack`, `door` and `ember` have a hue from 10 to 50 degrees; for any two themes `skyTop`, `fog` and `moon` are not all equal; the Crypt and Blood Moon moon colours are red), plus unit tests for the six names and order, `DEFAULT_THEME`, one-line descriptions, and a source scan that `lib/themes.ts` imports no `three`, `wxt/browser` or browser API.
    - **Property 1: Theme lookup is total**
    - **Property 2: Every theme is complete**
    - **Property 8: Warm lights stay warm and themes stay apart**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 7.5, 8.3, 8.4, 8.5, 16.1, 16.2**
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 8.2, 8.3, 8.4, 8.5, 16.1, 16.2_
  - [x] 3.3 Extend `tests/themeBaseline.test.ts` with **Property 9** (Crypt part): `themeById('crypt').scene` equals the baseline palette (including the shader literals), and `themeById('crypt').surface` equals the baseline token map for the 41 recorded names. Extend `tests/palette.test.ts` so the existing red-moon hue test also runs for the Blood Moon palette (the Crypt tests stay unchanged).
    - **Property 9: The Crypt does not change**
    - **Validates: Requirements 2.1, 2.2, 2.4, 2.5, 8.3, 16.4**
    - _Requirements: 2.1, 2.2, 2.4, 2.5, 8.3, 16.4_

- [x] 4. Store: typed theme with fallback
  - In `lib/store.ts` take `ThemeId` and `DEFAULT_THEME` from `lib/themes.ts` (re-export them). `getTheme` returns `DEFAULT_THEME` for a missing value, a non-string and an unknown string, and for a failed read, without throwing. `setTheme` takes a `ThemeId` and writes `tabpire:theme`. Fix any caller that passes a plain string. Extend `tests/store.test.ts`: **Property 3** (round trip over all six ids; any other stored value reads as `'crypt'`) and unit cases for stored `undefined`, `null`, a number, an object and `'nope'`.
    - **Property 3: Stored theme round trip and unknown values**
    - **Validates: Requirements 4.2, 4.3, 4.4, 16.3**
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 16.3_

- [x] 5. Sky_Cache
  - [x] 5.1 Create `lib/themeCache.ts` (`SKY_CACHE_KEY = 'tabpire:sky-theme'`, `readCachedTheme`, `writeCachedTheme`, `clearCachedTheme`, `applyCachedTheme`). Every `localStorage` call is inside try/catch. It holds one Theme_Id and no tab data. It does nothing on import. Create `tests/themeCache.test.ts`: **Property 4** (round trip for every id; any stored string reads as a `ThemeId` or `null`; `applyCachedTheme` always sets a valid `data-theme`; when `localStorage` throws on every call, read, write and clear do not throw and the result is `'crypt'`) and a spy test that importing the module makes no storage call.
    - **Property 4: Sky_Cache is safe and round-trips**
    - **Validates: Requirements 12.3, 12.4, 12.5**
    - _Requirements: 12.3, 12.4, 12.5, 12.6_
  - [x] 5.2 Create `tests/noLocalStorage.test.ts`: walk `lib/`, `entrypoints/` and `demo/src/`, strip comments, and fail when `localStorage` or `sessionStorage` appears outside `lib/themeCache.ts`. Also fail when `lib/fakeBrowser.ts` imports `themeCache`. Confirm the existing `tests/fakeBrowser.test.ts` and `tests/demo/intercept.test.ts` storage-spy tests still pass.
    - _Requirements: 12.5, 16.10_

- [x] 6. Theme hook
  - Create `entrypoints/newtab/components/useTheme.ts` with `useTheme(): { themeId, setTheme, saveFailed }` as in the design: initial state `readCachedTheme() ?? DEFAULT_THEME`; one `store.getTheme()` read on mount; a `useLayoutEffect` that sets `document.documentElement.dataset.theme` and calls `writeCachedTheme`; `setTheme` ignores a non-`ThemeId`, applies, saves, reverts and bumps `saveFailed` when the write rejects, with a sequence number so a late failure of an old write never undoes a newer choice; `onStoreChange` sync that reads the theme only when `tabpire:theme` is among the changed keys and unsubscribes on unmount (a late `then` after unmount is dropped). Create `tests/ui/useTheme.test.tsx` with a fake `storage.onChanged`: **Property 15** (reads once per event that includes `tabpire:theme`, never for other keys, `themeId` equals the last valid value or the initial one, no listener after unmount), the same-id event makes no re-render, failed read and failed write paths, the sequence-number guard, and `data-theme` set on the root element.
    - **Property 15: Theme sync follows the storage events**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 16.8**
    - _Requirements: 4.4, 4.5, 4.6, 4.7, 5.1, 5.2, 5.3, 5.4, 12.3, 12.8, 16.8_

- [x] 7. Surface tokens in `tokens.css`
  - [x] 7.1 Add the three new tokens `--shade: rgba(10, 4, 16, 0.6)`, `--popup-fill: rgba(12, 7, 20, 0.96)` and `--quote-ink: #ffb3c4` to the Crypt block (the old literals), and use them in `cards.css`, `header.css` and `bloodbank.css` in place of the four literals. The Crypt page must look the same (same computed values). Extend `tests/css.test.ts` so no component stylesheet (including `bloodbank.css`) holds a colour literal other than black or white with or without alpha. Extend the baseline test: the 41 recorded names still match, and the three new names hold the literals above.
    - _Requirements: 2.2, 6.2, 6.3_
  - [x] 7.2 Add the five blocks `pumpkin`, `forest`, `frost`, `bloodmoon` and `castle` to `tokens.css` with exactly the same 44 property names as the Crypt block (the design table values for the core colours; the other tokens follow the Crypt pattern with the theme's hue). Solid colours are `#rrggbb`. Make `surface` in `lib/themes.ts` equal each block. Keep the HTML files at `data-theme="crypt"`.
    - _Requirements: 6.1, 6.4, 7.5_
  - [x] 7.3 Add the token tests. Extend `tests/contrast.test.ts` with **Property 5** for each theme (same checks and formula as today, reading each block from `tokens.css`; the Crypt tests keep running as they are). Add **Property 6** (four state colours distinct; each hue within 30 degrees of the Crypt hue for that state) and **Property 7** (each block defines exactly the `SURFACE_TOKENS` names and each value equals the theme's `surface`). Extend `tests/css.test.ts`: one block per theme with the same property set (Requirement 6.1), and `themePicker.css` (when it exists) uses tokens only. If a first-pass value fails a rule, adjust that token, not the rule.
    - **Property 5: Text and state colours are readable in every theme**
    - **Property 6: State colours keep their meaning**
    - **Property 7: The block in tokens.css equals the theme data**
    - **Validates: Requirements 2.2, 6.1, 6.4, 6.5, 7.1, 7.2, 7.3, 7.4**
    - _Requirements: 2.2, 6.1, 6.4, 6.5, 6.6, 7.1, 7.2, 7.3, 7.4, 7.5, 16.5, 16.10_

- [x] 8. Checkpoint - Ensure all tests pass
  - Run `npm run typecheck` and `npm test`. Confirm `tests/themeBaseline.test.ts` passes. Ensure all tests pass, ask the user if questions arise.

- [x] 9. Scene reads the active theme
  - [x] 9.1 Create `entrypoints/newtab/layers/scene/themeColors.ts` with `SceneTheme`, `SceneThemeContext` (default: the Crypt), `useSceneTheme` and `useColorSync(apply)` (runs `apply` once when the colour set changes, then asks for one redraw; never per frame). Add `sceneColorsFor(id)` to `colors.ts`: one `Color` per `ScenePalette` key (linear keys through `setRGB(..., LinearSRGBColorSpace)`), cached per theme. For the Crypt the values equal today's `C`. Tests: `sceneColorsFor('crypt')` equals the baseline `C` and shader literals; every theme returns a complete set; the same object is returned on repeated calls; `useColorSync` calls `apply` once per colour-set change and not on re-render.
    - _Requirements: 8.1, 8.6, 13.4_
  - [x] 9.2 Move the shader and component literals onto uniforms fed from the context, with no behaviour change in the Crypt: `Moon.tsx` (light and dark body), `Clouds.tsx` (body and tint), `LowClouds.tsx`, `FarVillage.tsx` (silhouette), `Ground.tsx` (base and tint; the 512 px canvas is redrawn once on a switch). Uniforms are created once and updated in `useColorSync`. The Moon stays a plain glowing disc with no face. Add a source test that these five files hold no hex or linear colour literal outside the imported constants, and that the existing layer tests still pass.
    - _Requirements: 2.1, 8.1, 8.2, 8.6_
  - [x] 9.3 Make the other scene parts read `useSceneTheme()`: `Sky`, `Mist`, `Embers`, `Ghosts`, `Wisps`, `CauldronFx`, `OpenCoffin`, `Glows` (adds the `torch` kind with the lantern colour), `Lights` (colours passed as props) and the fog in `SceneContents` (`fog.color` set in `useColorSync`, density still follows memory each frame). Memos that read `layout()` read `useSceneTheme().scene.layout`; for now the context holds `layout()` itself, so nothing changes in the Crypt. Test (jsdom with the existing r3f test helpers): rendering the scene under a non-Crypt `SceneThemeContext` value updates the uniforms and fog colour once, with no rebuild of meshes (same object identities before and after).
    - _Requirements: 8.1, 8.6, 13.4_

- [x] 10. Model catalogue additions
  - Add to `MODELS` in `lib/scene/layout.ts` the entries of the design table: `farm_barn`, `farm_silo`, `farm_corn`, `farm_pumpkin`, `farm_fence`, `forest_potion_a`, `forest_potion_b`, `forest_rock_large`, `forest_rocks`, `frost_pine_a`, `frost_pine_b`, `frost_pines`, `frost_rock`, `blood_column`, `blood_column_round`, `blood_pedestal`, `blood_ruins` (parts `Wall_Overgrown`, `Doors_RoundArch_Covered_2`), `castle_fortress`, `castle_wall_towers`, `castle_torch`, `castle_banner`, `castle_stone_wall`. Add the optional `recentre?: true` flag to `ModelInfo` (set on `forest_rocks`, `blood_ruins`, `castle_torch`) with no use yet. Create `tests/modelSizes.test.ts` (node environment): load each Quaternius entry with `GLTFLoader` and `MeshoptDecoder`, measure the bounding box, and compare `hx`, `hz`, `h` to 3 percent and `tris` exactly. Correct any entry whose measured value differs. `tests/layout.test.ts`, `tests/budget.test.ts` and `tests/modelPaths.test.ts` must pass unchanged, and every new entry has a file in `public/models`.
    - _Requirements: 9.8, 9.9, 13.7, 14.4_

- [x] 11. Per-theme layouts
  - [x] 11.1 In `lib/scene/layout.ts` add `'themed'` to `Group`, `'torch'` to `WarmSource.kind`, and make `collectParts` honour `recentre` (move the chosen parts so the footprint centre is at x = 0, z = 0 and the lowest point is at y = 0); no existing model sets the flag in the Crypt draw, so the Crypt is unchanged. `buildLayout` is not edited. Create `lib/scene/weather.ts` (pure) with `WeatherSpec` and `WEATHER` as in the design. Create `tests/weather.test.ts` with **Property 14** (every `count` is at most 2,000, every `reducedCount` is at most `count / 4`; the theme-to-weather mapping: snow for Frozen Cemetery, ash for Blood Moon, fireflies for Witch's Forest, leaves for Pumpkin Patch, embers for Haunted Castle, none for the Crypt). Set `weather` on each theme in `lib/themes.ts` accordingly.
    - **Property 14: Weather is bounded**
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.9**
    - _Requirements: 9.9, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.9_
  - [x] 11.2 Add `ThemeProps` (drop, swaps, adds, required) to the `Theme` type and fill the five prop tables in `lib/themes.ts` (the design per-theme table). Create `lib/scene/themeLayout.ts` with `themeScene(id, seed?)`: for the Crypt it returns `layout()` itself (same object); for the others it copies the base placements, keeps the pinned owl and crow trees, applies drops, swaps and adds with `mulberry32(THEME_SEED[id])` and the acceptance rules of the design, uses `group: 'themed'` and ids `theme-<model>-<n>`, pushes `torch` glows (not point lights), and returns `models`, `anchors` and `weather`. Create `tests/themeLayout.test.ts`: **Property 10** (base path, gate, crypt, fence, newGrave, coffin, candle placements and pinned trees unchanged for any seed), **Property 11** (themed placements inside the ground, no overlap with the same rule as `tests/layout.test.ts`, outside the path corridor and the crypt-door circle, not blocking the moon), **Property 12** (deterministic; every `required` model present for the default seed; every model is in `MODELS` and has a file under `public/models`). Extend `tests/themeBaseline.test.ts` with the layout part of **Property 9**: `themeScene('crypt').layout` deep-equals the baseline and is the same object as `layout()`.
    - **Property 9: The Crypt does not change**
    - **Property 10: Theme layouts never disturb the base**
    - **Property 11: Themed props fit the yard**
    - **Property 12: Theme layouts are deterministic and complete**
    - **Validates: Requirements 2.3, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 14.4, 16.4, 16.7**
    - _Requirements: 2.3, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.10, 14.3, 14.4, 16.7_

- [x] 12. Props batches
  - [x] 12.1 Create `entrypoints/newtab/layers/scene/ModelBatch.tsx`: one model per component, `useGLTF(modelFile(id), false, true)`, the same instanced-mesh build and the same `useFrame` as `Props.tsx` for the data-driven groups, one error boundary per model that logs `Tabpire: model failed to load: <file name>` (file name only) and renders nothing, and disposal of the instanced meshes and material or geometry clones in the effect cleanup. Make `Props.tsx` render one `ModelBatch` per model in `scene.models` from `useSceneTheme()`. For the Crypt the draw must be identical. Tests: a mocked `useGLTF` that throws for one model leaves the other batches drawn, logs the file name once and does not throw (Requirement 14.1, 14.5); disposal runs on unmount; `tests/network.test.ts` still passes (no `fetch(`, every `useGLTF` call passes `false` as the second argument).
    - _Requirements: 9.9, 13.5, 14.1, 14.3, 14.5_
  - [x] 12.2 Add the `frost_*` material treatment in `Props.tsx` (keyed on the id prefix): material clones with `color` `#e8f2ff`, `emissive` `#8fa9c2` at 0.5 and the original `map`, a cloned geometry with a `color` attribute lightening the top quarter toward snow white (`vertexColors: true`), darker blue-grey trunks, and no new file. Add warm glows for the lit torches, lanterns and candles of each theme from the theme's warm colours. Tests: `frost_*` batches use cloned materials (the shared model materials are not mutated), cloned materials and geometry are disposed on unmount, and a lit torch adds one `glows` entry and no point light.
    - _Requirements: 9.3, 9.10, 13.3, 13.5_

- [x] 13. Weather
  - Create `entrypoints/newtab/layers/scene/Weather.tsx`: one `<points>` with one `ShaderMaterial` (the pattern of `Embers.tsx`), a seed attribute filled once from `mulberry32`, a vertex shader with a define per kind (snow, ash, leaves, fireflies, embers with up to four anchors from `themeScene().anchors`), all motion from a `uTime` uniform, point size `uPixel * size / -mv.z` with `uPixel = gl.getPixelRatio()`, colours from `weatherA` and `weatherB`, `depthWrite` off, `renderOrder` 6, `frustumCulled` false, no blur and no lowered resolution. Reduced motion: `setDrawRange(0, reducedCount)` and `uTime` pinned. Render it from the scene contents when `scene.weather` is not null. The Crypt renders no Weather. Tests: the Crypt tree has no `points` for weather; each other theme has exactly one `points` object with a draw range equal to `count`; with reduced motion the draw range is `reducedCount` and `uTime` does not change between frames; no per-particle JavaScript (the position attribute is not rewritten after the first frame); the page-hidden path draws nothing through the existing `frameloop` rule.
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 10.10, 10.11_

- [x] 14. Per-theme budget
  - Extend `tests/budget.test.ts` with `describe.each(THEME_IDS)` and **Property 13**: the planned triangles (placements with the shadow pass, the shared extras and two per weather particle) are at most `BUDGET.sceneTriangles` (200,000), the planned draw calls (parts, shadow parts, the other draws and `OTHER_DRAWS.weather = 1` for a theme with weather) are at most `BUDGET.sceneDrawCalls`, the real lights are at most `BUDGET.maxPointLights`, and each placed model's `tris` equals its file. Add a check that `QUALITY` is unchanged and that the extension bundle stays within `BUDGET.maxBundleBytes` when the built output exists. If a theme is over the draw-call limit, reduce its adds in `lib/themes.ts` (the budget decides the final counts), then re-run `tests/themeLayout.test.ts` so the `required` models remain.
    - **Property 13: Every theme stays within the budget**
    - **Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.6, 13.7, 16.6**
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.6, 13.7, 16.6_

- [x] 15. Checkpoint - Ensure all tests pass
  - Run `npm run typecheck` and `npm test`. Confirm `tests/themeBaseline.test.ts`, `tests/budget.test.ts`, `tests/themeLayout.test.ts` and `tests/network.test.ts` pass. Ensure all tests pass, ask the user if questions arise.

- [x] 16. Switching without a blank flash
  - [x] 16.1 Give `SceneLayer` a `themeId` prop and add `ThemedScene` inside the `Canvas`: `const shown = useDeferredValue(themeId)`, `value = useMemo(() => sceneThemeFor(shown), [shown])`, and render `<SceneThemeContext value={value}><SceneContents /></SceneThemeContext>`. Pass `themeId` from `App.tsx` through `layers/hosts.tsx` (the hook is wired in task 20 for Blood Bank; `App` calls `useTheme()` here). Keep the manual gate as the fallback: a small `useThemeGate(themeId, loaders)` helper (preload the new files, then set the shown id) that `ThemedScene` can use instead of `useDeferredValue`, behind one constant so the fallback is a one-line change. Reduced motion: hard cut, no cross-fade. Create `tests/ui/themeGate.test.tsx` with **Property 18** and unit tests: a wrapper rendered with a scene loader that resolves later; while pending, the shown id is the old one and the old scene stays mounted (never empty); after it resolves, the new id is shown and the new scene is mounted; selecting a third theme while pending loads only the latest; a failing model file still completes the switch. Run the same tests against the gate helper.
    - **Property 18: The old scene stays until the new one is loaded**
    - **Validates: Requirements 11.1, 11.3, 11.9, 16.13**
    - _Requirements: 11.1, 11.2, 11.3, 11.5, 11.6, 11.7, 11.9, 16.13_
  - [x] 16.2 Create `entrypoints/newtab/layers/scene/preloadThemes.ts`: after the scene's first frame (`ReadySignal`), call `useGLTF.preload(modelFile(id), false, true)` for the models of the other themes that are not loaded yet, two per idle slot, through `requestIdleCallback` or `setTimeout(..., 200)` where it is missing, and stop on unmount. Only the extension's own files, through `assetUrl`. Tests: starts only after the first-frame signal, preloads each model once, uses `setTimeout` when `requestIdleCallback` is absent, stops on unmount, and makes no `fetch` call; `tests/network.test.ts` still passes.
    - _Requirements: 11.4, 11.8, 9.9_

- [x] 17. Instant sky and canvas fade
  - Create `entrypoints/newtab/bootTheme.ts` (one line: `applyCachedTheme()`) and make it the first import of `entrypoints/newtab/main.tsx` and `demo/src/main.tsx` (the Blood Bank gets it in task 20). Make the scene canvas fade in with the existing `.scene-canvas` opacity transition after the first drawn frame, and keep the reduced-motion rule that removes it (opacity only). Tests: a source test that `bootTheme` is the first import of both mains; with a cached `frost` value, `data-theme` is `frost` before React mounts; a missing, unreadable or unknown cache gives `crypt` and does not throw; the canvas fade uses `opacity` only (CSS test) and has no transition under `prefers-reduced-motion: reduce`.
    - _Requirements: 12.1, 12.2, 12.4, 12.7, 15.8_

- [x] 18. Portraits follow the theme, the halo stays Crypt
  - Make `PortraitLayer`, `hosts.tsx` and `PortraitLights.tsx` take the Active_Theme id: the portrait lights use that theme's scene palette, provided through `SceneThemeContext` with colours only, and `Niche.tsx` reads its state-colour tints from `themeById(id).surface`. In `GlowHalo.tsx` name the three halo colours as one exported constant `HALO_COLORS` (starving red, Dawn orange, white-hot flash, with the same numbers and multipliers as today) and read them from it; no theme data reaches `GlowHalo` or any other code that tints the vampire's own glow. Create `tests/portraitHalo.test.ts` with **Property 17**: for every theme, the halo colours equal the Crypt baseline values from the fixture, and `GlowHalo.tsx` imports nothing from `lib/themes` or `themeColors`. Add a portrait test that the niche tint for the same state differs between the Crypt and another theme and the lights follow the theme. Existing portrait tests pass unchanged.
    - **Property 17: The vampire halo stays on the Crypt values**
    - **Validates: Requirements 8.1, 16.14**
    - _Requirements: 8.1, 16.14_

- [x] 19. Themes panel and Themes button
  - [x] 19.1 Create `entrypoints/newtab/ThemePicker.tsx` and `styles/themePicker.css` with the pure `nextThemeIndex(index, key, count)`. A `div role="dialog" aria-modal="true" aria-label="Themes"` under the button; six buttons in `THEMES` order, each with a swatch from `theme.surface`, the name and the description; the Active_Theme has a check mark and `aria-pressed="true"`; roving `tabIndex`; a Close button after the list; Tab and Shift+Tab wrap inside the panel; Up, Left, Down, Right, Home and End move focus with wrap-around; Enter and Space select and the panel stays open; focus moves to the selected item on open; Escape closes and returns focus to the button; `pointerdown` outside the panel and button closes it; `outline: 2px solid var(--focus-ring)` on `:focus-visible`; width `min(360px, 100vw - 24px)`; no animation under `prefers-reduced-motion: reduce`, a short opacity and translate transition otherwise; tokens only, no colour literal. Create `tests/ui/themePicker.test.tsx`: **Property 16** on `nextThemeIndex` (stays 0 to 5 and matches a simple model with wrap-around) and the component examples (opens, six themes in order with name, description and swatch, selected mark and `aria-pressed`, focus on the selected item, Tab wraps, arrow keys, Enter and Space select, Escape returns focus, outside click closes, dialog has a name, 360 px render has no horizontal overflow class). With the Fake_Browser: selecting saves `tabpire:theme` and the page's `data-theme` changes.
    - **Property 16: Arrow keys move through the six themes**
    - **Validates: Requirements 3.9**
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12, 3.13, 15.2, 16.9_
  - [x] 19.2 Enable the Themes button in `components/Header.tsx` and `components/HeaderButton.tsx` (the button forwards a ref and passes `aria-haspopup="dialog"` and `aria-expanded`; it is no longer disabled; tooltip "Change how Tabpire looks: six themes."). `Header` gets `themeId` and `onTheme` and renders the `ThemePicker`. `App.tsx` passes the hook's values and shows the toast "Could not save your theme. It will reset next time." when `saveFailed` changes. Replace the test "disables Themes with 'Coming soon'" in `tests/ui/header.test.tsx` as the design says: no `aria-disabled`, `aria-haspopup="dialog"`, `aria-expanded="false"`, the new tooltip, and a click sets `aria-expanded="true"` and opens the dialog; the `setup` helper passes `themeId` and `onTheme`. Add an `App` test for the save-failed toast. The other header and app tests pass unchanged.
    - _Requirements: 3.1, 3.10, 4.6, 16.11_

- [x] 20. Blood Bank and demo parity
  - Make `entrypoints/bloodbank/BloodBank.tsx` call `useTheme()` and make `bloodbank/main.tsx` import `bootTheme` first (no save-failed notice there). In `demo/src/seed.ts` make `resetDemo` also call `clearCachedTheme()` and return the saved theme to `crypt` (the fake is cleared). Check that `DemoShell` renders the same `App`, `ThemePicker` and `BloodBank` components with no copy. Add the one-line note to `.kiro/specs/web-demo/requirements.md` (Requirement 3.2) and `.kiro/specs/web-demo/design.md` that the Sky_Cache (`lib/themeCache.ts`, one Theme_Id in `localStorage`, outside the Fake_Browser) is the documented exception to the no-`localStorage` rule. Create `tests/demo/theme.test.tsx` (jsdom, real hook on the seeded fake): pick a theme, move between `#/crypt` and `#/bloodbank` and the theme holds; the saved value is in the fake's `storage.local` and the cache holds the same id; Reset returns `data-theme` to `crypt`, the fake's theme to the default and clears the Sky_Cache; a theme change on one page reaches the other through `onStoreChange`; the Blood Bank shows no theme notice when a write fails. Extend `tests/demo/built.test.ts` expectations only if a model file is missing from `demo/dist` (it already requires every file under `public/models`).
    - _Requirements: 4.5, 4.6, 5.1, 12.5, 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8_

- [x] 21. Checkpoint - Ensure all tests pass
  - Run `npm run typecheck` and `npm test`. Confirm the Crypt baseline, budget, layout, picker, hook, halo and demo theme tests pass. Ensure all tests pass, ask the user if questions arise.

- [x] 22. Final checkpoint and commit
  - Run `npm run typecheck`, `npm test`, `npm run build` and `npm run demo:build`. Confirm the extension manifest is unchanged (same permissions, no host permissions), every model file used by a Props_Set is in `.output/chrome-mv3/models` and in `demo/dist/models`, and `tests/themeBaseline.test.ts` passes. Tick this task and every task above in this file, then commit with the message "Spec 5: themes (built with Kiro)". Ensure all tests pass, ask the user if questions arise.
    - _Requirements: 13.6, 14.4, 15.7, 16.11_

## Notes

- Tests are part of each task and are not optional, to match the earlier specs. Property tests are tagged `Feature: themes, Property N: <text>` and run 100 times or more with fast-check, except the properties over the six themes, which loop over `THEME_IDS`.
- Look checks in Chrome (palette values, pine tint, weather sizes, ruins scale, flicker on first paint, whether `useDeferredValue` leaves an empty frame) are done by hand by the user after the build. They are not automated tasks and no sub-agent runs them. If the user finds an empty frame during a switch, switch the one constant in task 16.1 to the manual gate. Record the result here when done.
- The Playwright MCP check that each theme can be selected in the live demo belongs to Spec 7's check procedure (Requirement 16.12) and has no task.
- Triangle budget: `BUDGET.sceneTriangles` is 200,000 from task 2 on. The Crypt plan is 157,876, so the headroom is 42,124 triangles and 28 draw calls. The budget test (task 14) decides the final prop counts per theme.
- The vampire halo (`GlowHalo` and its colours) stays on the Crypt values in every theme. The portrait niche tints and lights follow the theme.
- Never change the Crypt theme layout: a failure in `tests/themeBaseline.test.ts` always means the task that just ran must be fixed, not the fixture.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2"] },
    { "id": 2, "tasks": ["3.1"] },
    { "id": 3, "tasks": ["3.2"] },
    { "id": 4, "tasks": ["3.3", "4", "5.1", "7.1"] },
    { "id": 5, "tasks": ["5.2", "6", "7.2"] },
    { "id": 6, "tasks": ["7.3"] },
    { "id": 7, "tasks": ["8"] },
    { "id": 8, "tasks": ["9.1", "10"] },
    { "id": 9, "tasks": ["9.2", "11.1"] },
    { "id": 10, "tasks": ["9.3", "11.2"] },
    { "id": 11, "tasks": ["12.1", "13"] },
    { "id": 12, "tasks": ["12.2"] },
    { "id": 13, "tasks": ["14"] },
    { "id": 14, "tasks": ["15"] },
    { "id": 15, "tasks": ["16.1", "17"] },
    { "id": 16, "tasks": ["16.2", "18"] },
    { "id": 17, "tasks": ["19.1"] },
    { "id": 18, "tasks": ["19.2"] },
    { "id": 19, "tasks": ["20"] },
    { "id": 20, "tasks": ["21"] },
    { "id": 21, "tasks": ["22"] }
  ]
}
```
