# Tasks: 3D graveyard and the vampire (Spec 4)

After each task, `npm run typecheck` and `npm test` must pass. Requirement numbers refer to `requirements.md`. I never open image files or take screenshots in this spec. Visual checks are the user's, in Chrome.

Notes from checking the installed libraries (three 0.187, drei 10, postprocessing 6):
- `PCFSoftShadowMap` is deprecated since three r186. `PCFShadowMap` is now the soft filter, so the scene uses it.
- `BloomEffect` with `mipmapBlur` (the default) starts from a half-resolution image. Its `resolutionScale` option is deprecated. Half-resolution Bloom is therefore met by mipmap blur, and `QUALITY` records that instead of a scale number.
- `EffectComposer` has a `resolutionScale` prop that would shrink the whole picture. It stays at 1.

- [x] 1. Dependencies and config
  - [x] 1.1 Install `three`, `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`, `postprocessing` and `@types/three`.
    - _Requirements: 11.2, 12.5_
  - [x] 1.2 Create `lib/scene/config.ts` (`QUALITY`, `BUDGET`), `lib/scene/palette.ts` (cold, warm, accent colours and `hueOf`), `lib/scene/rng.ts` (seeded random). Tests: `palette.test.ts` (hue limits, helper on known colours).
    - _Requirements: 4.1, 11.2, 14.5_

- [x] 2. Pure scene logic
  - [x] 2.1 `lib/scene/meaning.ts` with `sceneState` and `approach`. Test: `meaning.test.ts` (caps, monotonic halo and fog, bad inputs, smooth approach).
    - _Requirements: 3.4, 5.2, 7.1 to 7.11, 14.1_
  - [x] 2.2 `lib/scene/flicker.ts`. Test: bounds, small steps, constant with reduced motion.
    - _Requirements: 4.6, 13.1_
  - [x] 2.3 `lib/scene/camera.ts`: rig, closed drift loop, field of view for aspect, `project`. Test: `camera.test.ts` (periodic, no jumps).
    - _Requirements: 5.7, 14.2_
  - [x] 2.4 `lib/scene/sky.ts`: moon direction, moon radii, cloud lanes and `cloudsAt`, `witchAt`, ghost and bat path helpers. Test: `sky.test.ts` (clouds never reach the moon halo; moon inside the empty band at 16:9, 16:10, 21:9 and at drift extremes; narrow window keeps the moon in view).
    - _Requirements: 3.1, 6.1, 14.3_
  - [x] 2.5 `lib/scene/layout.ts`: model catalogue and seeded layout. Test: `layout.test.ts` (deterministic, no overlap at full capacity, inside the ground, crypt in the left third, clear zones kept).
    - _Requirements: 2.1 to 2.3, 14.2_
  - [x] 2.6 `lib/scene/bus.ts` and `lib/scene/exitKinds.ts`. Test: marks are taken once, expire, Dawn order and stagger.
    - _Requirements: 10.2, 10.6_

- [x] 3. Pure vampire logic
  - [x] 3.1 `lib/vampire/rig.ts` (facing yaw, model size, eye fractions, coffin fit) and `lib/vampire/pose.ts` (`statePose`, `blendPose`, `lookAngles`). Test: `pose.test.ts`.
    - _Requirements: 9.1 to 9.8, 14.4_
  - [x] 3.2 `lib/vampire/exits.ts`: durations, Dawn stagger, the four timelines and the Coffin transition. Test: `exits.test.ts` (start equals idle, end is final, continuous, no NaN, at most 1600 ms).
    - _Requirements: 10.1 to 10.9, 14.4_

- [x] 4. Budget and network checks
  - [x] 4.1 `tests/budget.test.ts`: reads the Kaykit `.gltf` and `vampire.glb` JSON, counts instanced triangles from the catalogue, checks the draw call plan and the vampire triangle count against `BUDGET`.
    - _Requirements: 11.1, 14.6_
  - [x] 4.2 `tests/network.test.ts`: no host name in 3D code, no `Environment`, no drei `Text`, Draco off in each `useGLTF`, no `fetch`.
    - _Requirements: 12.1, 12.2, 14.7_

- [x] 5. Page integration (no 3D code yet)
  - [x] 5.1 `entrypoints/newtab/layers/useWebgl.ts` (check once, context-loss flag) and `layers/LayerBoundary.tsx` (error boundary that falls back silently). Tests with a stubbed canvas.
    - _Requirements: 1.4, 1.5, 14.8_
  - [x] 5.2 Exit plumbing: `useExitingCards` takes a per-card exit kind and duration, `CardGrid` and `TabCard` pass them, `cards.css` uses `--exit-ms` and `--exit-fade-delay`. `App.tsx` marks exits for Stake, Crypt, Dawn and the Coffin transition and emits bus events. Tests: ghost durations per action, reduced motion removing ghosts, Dawn marking targets in card order.
    - _Requirements: 10.2 to 10.8, 14.8_
  - [x] 5.3 Portrait hole: split `.card` into outer shadows and a `::before` surface, add the CSS variables, the `data-3d` hook and the arch mask. Update `tests/css.test.ts` reader (ignore `;` inside quotes and brackets) and add mask checks. `PortraitSlot` shows the emblem until 3D is ready.
    - _Requirements: 8.3, 8.5, 8.9, 14.8_
  - [x] 5.4 `layers/FpsReadout.tsx` and its store; shown only when the address ends with `#fps`. Test.
    - _Requirements: 11.8, 14.8_
  - [x] 5.5 Lazy hosts in `App.tsx`: `SceneLayerHost` and `PortraitLayerHost` load only when WebGL is available. Tests with the layers mocked: fallback without WebGL, `aria-hidden` containers, emblem until ready.
    - _Requirements: 1.1 to 1.4, 8.8, 14.8_

- [x] 6. Scene canvas
  - [x] 6.1 `SceneLayer.tsx` with the canvas settings, fade-in, hidden-page pause, reduced-motion demand loop, context-loss handling, `CameraRig`, `ShadowTicker`, `FrameStats`.
    - _Requirements: 1.3, 1.6, 11.2, 11.4, 13.1, 13.2_
  - [x] 6.2 Sky dome with gradient, stars and horizon haze; Moon with halo; Effects (Bloom, Vignette, tone mapping).
    - _Requirements: 3.1 to 3.3, 5.3 to 5.5, 5.8_
  - [x] 6.3 Ground and Props: model loading, instancing, shadows, scale-in and fade-out of data-driven props, crypt doorway glow.
    - _Requirements: 2.1 to 2.6, 7.3 to 7.6, 7.9, 7.10_
  - [x] 6.4 Lights: moonlight with shadows, hemisphere, rim, six warm flickering points, glow pools and flame glows.
    - _Requirements: 3.5, 4.1 to 4.8_
  - [x] 6.5 Mist (three layers with warm tint), Embers with the Dawn burst.
    - _Requirements: 5.1, 5.2, 5.6, 7.2, 7.8_
  - [x] 6.6 Sky life: Clouds, Witch, Bats, Ghosts, driven by `sceneState` and the bus.
    - _Requirements: 6.1 to 6.5, 7.3, 7.4, 7.7_

- [x] 7. Portrait canvas
  - [x] 7.1 `PortraitLayer` with one `View` per card inside the canvas (drei's in-canvas form, so no `View.Port` is needed), the near-viewport mounting, the ready signal and the cursor tracker.
    - _Requirements: 8.1, 8.2, 8.6, 8.7, 8.10_
  - [x] 7.2 `Vampire` (model, per-card material with bend, dissolve and alpha), `Niche`, lights, starving glow, pose and blend wiring.
    - _Requirements: 8.4, 8.11, 9.1 to 9.4, 9.6, 9.7_
  - [x] 7.3 Asleep pose: `Coffin` (open), lying vampire, eyelids placed by raycast, `Zs`.
    - _Requirements: 9.5_
  - [x] 7.4 Exits: stake topple, dawn burn with embers, crypt bat form, coffin transition.
    - _Requirements: 10.1 to 10.4_
  - [x] 7.5 Portrait glow: the shared light Bloom, or the halo billboard fallback if Bloom does not suit several regions. Record which one is used here.
    - **Decision:** halo billboard (`portraits/GlowHalo.tsx`). A shared Bloom pass cannot follow drei `View`, because each view is drawn into its own scissor rectangle by a separate render call. The scene canvas keeps true Bloom.
    - _Requirements: 5.3_

- [x] 8. Final check
  - [x] 8.1 Run `npm run typecheck`, `npm test`, `npm run build` and `npm run build:firefox`. Confirm the manifests are unchanged (same permissions), the built size is under 12 MB, the 3D code is in its own chunk, and no network address appears in it.
    - _Requirements: 12.3, 12.5, 14.9, 14.10_
  - [x] 8.2 Write the Chrome check list for the user, with the exact files and numbers to change for facing and eyes. Done: `chrome-check.md` in this folder.
    - _Requirements: 14_
