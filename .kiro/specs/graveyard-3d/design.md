# Design: 3D graveyard and the vampire (Spec 4)

## Overview

Two WebGL canvases sit behind the Spec 3 page:

1. **Scene canvas.** The night graveyard, moon, sky life and atmosphere, with Bloom and Vignette.
2. **Portrait canvas.** One shared canvas that draws every card's vampire through drei `View`.

Everything that decides what appears (counts, pulse speed, fog density, layout, camera path, cloud lanes, poses, exit timelines, palette) is written as pure TypeScript with no `three` import, so Node tests can check it. The `three` and R3F code only reads those functions and draws. All 3D code loads in a separate chunk after the page's first paint.

Since I cannot look at pictures in this session, the design leans on numbers I can test (screen positions, budgets, hue ranges, timelines) and on an `#fps` readout so you can report what you see in Chrome.

## Libraries

| Package | Version at design time | Purpose |
| --- | --- | --- |
| `three` | 0.187 | rendering |
| `@react-three/fiber` | 9.x | React renderer for three (needs React 19, which we have) |
| `@react-three/drei` | 10.x | `View`, `useGLTF`, `Instances` helpers |
| `@react-three/postprocessing`, `postprocessing` | 3.x, 6.x | Bloom, Vignette, tone mapping |
| `@types/three` | 0.187 | types |

Exact APIs for the shadow filter type and the Bloom half-resolution option change between three and postprocessing releases. I will confirm both against the installed versions at the first task that uses them, and record the result in the task.

## File layout

```
lib/scene/                      pure code: no three, no browser APIs
  config.ts                     quality numbers and budgets (the one file to tune)
  palette.ts                    warm, cold and accent colours, hue helper
  meaning.ts                    sceneState(inputs): every count, pulse and density
  rng.ts                        seeded random numbers
  layout.ts                     seeded prop layout and the model catalogue
  camera.ts                     camera rig, drift loop, projection maths
  sky.ts                        moon direction, cloud lanes and positions
  flicker.ts                    gentle flame and light flicker
  exitKinds.ts                  which card is leaving by which action (tiny shared map)
  bus.ts                        small event bus: dawn, crypt, stake, coffin
lib/vampire/                    pure code
  rig.ts                        model size, facing, eye and coffin fit numbers
  pose.ts                       statePose(), blendPose(), lookAngles(), smoothing
  exits.ts                      exit and Coffin transition timelines
entrypoints/newtab/layers/      3D code, loaded lazily
  SceneLayer.tsx                default export. The scene canvas and its contents
  scene/                        Sky, Moon, Ground, Props, Lights, Mist, Embers, Clouds, Witch, Bats, Ghosts, Effects, CameraRig, ShadowTicker
  portraits/                    PortraitCanvas, PortraitView, Vampire, Niche, Coffin, BatForm, Zs, dissolve material
  FpsReadout.tsx
  useWebgl.ts                   WebGL check and context-loss handling
```

Spec 3 files that change: `App.tsx`, `PortraitSlot.tsx`, `TabCard.tsx`, `CardGrid.tsx`, `hooks/useExitingCards.ts`, `styles/cards.css`, `styles/base.css`, `main.tsx`, `tests/css.test.ts` (reader improvement). Layout and look of the page stay as they are.

## Layering on the page

Inside `#root` (which is already its own stacking context):

```
z-index -1   scene canvas        fixed, full window, behind everything
z-index  0   portrait canvas     fixed, full window, first in DOM order
(normal)     .page content       header, search, cards, toasts
```

- The scene canvas fades in over the Spec 3 gradient by changing `opacity`.
- The portrait canvas is transparent except inside each View rectangle.
- Both canvases have `pointer-events: none` and `aria-hidden="true"`.

### Why the portrait canvas sits below the cards

Tooltips, the suggestion list, the Add page form and messages all live above the card contents. A canvas drawn above the cards would paint over them. So the canvas sits below the cards, and each card has a **transparent hole** exactly where its portrait slot is. The vampire shows through the hole, and everything else on the card is above it.

Implementation, with the card's look unchanged:

- `.card` keeps its outer drop shadows and its content.
- The card's body gradient, rim and inset shadows move to `.card::before` (same sizes, same colours).
- While 3D is on for a card (`data-3d="on"`), `.card::before` gets an SVG mask that cuts out an arch shape of 96 x 112 px at the portrait slot's position. The mask uses `mask-composite: exclude` (Chrome 120 and newer, all Firefox versions in use).
- The slot's position comes from CSS variables built from the card's own border, padding and header height, so the hole and the slot cannot drift apart.
- The arch in the mask matches the slot's rounded shape, so the card's edge around the vampire is the same as in Spec 3.
- The data address in the mask is written with percent-encoded characters, so it holds no web address. The CSS test reader is changed to ignore `;` inside quotes and brackets.
- When 3D is off or not ready, there is no mask and the Spec 3 emblem shows as before.

## Config and palette (pure)

`config.ts` holds the numbers from the requirements in one place:

```ts
export const QUALITY = {
  sceneDpr: 1, sceneAntialias: false,
  bloomResolutionScale: 0.5,
  shadowMapSize: 2048, shadowRefreshFrames: 20,
  portraitDprMax: 1.25, portraitAntialias: true,
};
export const BUDGET = {
  sceneDrawCalls: 150, sceneTriangles: 175_000, // raised for the richer yard: see depth-and-life.md
  vampireTriangles: 15_000, maxPointLights: 6,
  maxExitMs: 1600, maxBundleBytes: 12 * 1024 * 1024,
};
```

`palette.ts` defines the colours as hex strings plus `hueOf(hex)`.

| Group | Colours (hue) |
| --- | --- |
| Cold | sky top `#0b0a2e` (244), fog `#2b2c66` (238), hemisphere sky `#3a40a8` (235), hemisphere ground `#1c1038` (262), rim light `#5a7dff` (226) |
| Warm | candle `#ffb347` (35), lantern `#ff9a3d` (29), jack-o'-lantern `#ff8a1c` (31), ember `#ff6a1f` (19), crypt doorway `#ffb066` (29) |
| Accent | moon `#ff2d45` (353), moonlight `#e2809c` (344) |

The hue test checks that every cold colour is 210 to 280 degrees and every warm colour is 10 to 50 degrees.

## Meaning (`meaning.ts`)

```ts
interface SceneInputs { cardCount; starvingCount; estimatedMb; cryptCount; crypted; garlicCount; staked; coffined; dawnReady }
interface SceneState {
  ghosts; bats; candles; newGraves; coffins;        // integers within caps
  haloPeriodS; haloAmplitude;                         // from hunger share
  fogFactor;                                          // 0.7 to 1.3
  emberRate;                                          // 0.15 to 1
  witch: boolean;
}
export function sceneState(i: SceneInputs): SceneState
```

- `share = cardCount > 0 ? clamp(starving / cardCount, 0, 1) : 0`
- `haloPeriodS = 6 + (2.5 - 6) * share`, `haloAmplitude = 0.06 + (0.20 - 0.06) * share`
- `fogFactor = 0.7 + 0.6 * clamp(estimatedMb / 8000, 0, 1)`
- Counts: `ghosts = min(cryptCount, 8)`, `bats = min(crypted, 24)`, `candles = min(garlicCount, 12)`, `newGraves = min(staked, 24)`, `coffins = min(coffined, 8)`. Inputs that are negative or not whole numbers are clamped and floored.
- `emberRate = 0.15 + 0.85 * clamp(starving / 12, 0, 1)`
- `witch = dawnReady`

In the scene, current values ease toward these targets (`approach(current, target, dt, rate)`), so changes are smooth (Requirement 7.10). New props rise or fade in over about 0.8 seconds, and removed ones fade out.

## Layout (`layout.ts`)

A seeded layout (mulberry32, fixed seed) produces placements for every model. It always makes the full capacity (24 new graves, 12 candles, 8 coffins) so that adding one never moves another, and the scene shows the first `n` of each.

Coordinates: x to the right, y up, z toward the camera. The ground spans x -30 to 30 and z -40 to 12. Camera rest position is (3, 2.4, 14) looking at (-1, 3.4, -10).

| Item | Model(s) | Placement |
| --- | --- | --- |
| Crypt | `crypt` | at (-13, 0, -17), turned to face the camera and the path, left third of the screen |
| Gate | `arch_gate` | at (-8, 0, -7), on the path |
| Path | `path_A/B/C`, `floor_dirt` | a bent line from the camera side to the gate and on to the crypt door |
| Fences | `fence`, `fence_broken`, `fence_pillar` | two runs along the graveyard edges, with a broken piece or two |
| Trees | `tree_dead_large`, `tree_dead_medium`, `tree_dead_large_decorated`, `tree_pine_orange_large`, `tree_pine_orange_medium`, `tree_pine_yellow_medium` | clusters on the left and right edges and at the back, with room kept clear around the moon's line of sight |
| Old graves (scenery) | `grave_A`, `grave_A_destroyed`, `grave_B`, `gravestone`, `gravemarker_A/B` | 10 spread across the middle |
| New graves (staked) | `gravestone`, `grave_B` | 24 slots in rows in front of the crypt |
| Coffins (put to sleep) | `coffin_decorated` | 8 slots near the fence |
| Candles (protected sites) | `candle_triple`, `candle_thin`, `candle_melted` | 12 slots on and between graves |
| Lanterns | `lantern_standing`, `post_lantern`, `lantern_hanging` | two at the gate, one hanging at the crypt, one on a post by the path |
| Pumpkins | `pumpkin_orange`, `pumpkin_orange_jackolantern`, `pumpkin_yellow_jackolantern`, `pumpkin_yellow_small` | beside the gate and the path; two jack-o'-lanterns are warm light sources |
| Small things | `skull`, `bone_A/B/C`, `ribcage`, `shrine`, `bench_decorated` | a few as ground detail |

Footprints use a circle for each model (radius from its bounding box). The generator places items by rejection sampling inside allowed zones and keeps a minimum gap, so props never overlap. The model catalogue in `layout.ts` also holds each model's file name, footprint radius, triangle count (read from the model files by the budget test) and whether it casts shadows.

### Models and instancing

- Models load with `useGLTF(path, false, false)` for the Kaykit `.gltf` files (no Draco, no meshopt needed) and `useGLTF(path, false, true)` for `vampire.glb` (meshopt). The `false` for Draco keeps the default decoder address out of the code.
- For each model, every mesh inside it becomes one `InstancedMesh` whose instance matrices are `placement x mesh local transform`. Result: one draw call per model part, however many copies.
- Instances use a fixed capacity and a `count` that follows the scene state. The first few frames of a new instance animate its scale with a small per-frame update, only while it is changing.
- Materials keep the original texture and sampling. I raise anisotropy to 4 and do not shrink anything.

## Camera (`camera.ts`)

- Perspective camera, field of view 40 degrees at 16:9, widened for narrower windows: `fov = 40 * clamp(1.78 / aspect, 1, 1.9)^0.6`, so the scene is not cut off on tall screens.
- Drift: `cameraDrift(t)` returns a position offset and a look-at offset on one ellipse with a 60 second period: `x = 0.55 sin(2*pi*t/60)`, `y = 0.22 sin(2*pi*t/60 + 1.1)`, `z = 0.4 sin(2*pi*t/60 + 2.2)`, and a look-at offset of one third of those. The path closes on itself and has no jumps.
- With reduced motion, the drift is fixed at `t = 0`.
- `project(point, camera, aspect)` returns screen coordinates from 0 to 1 and is used by tests and by the moon's placement.

## Sky (`sky.ts`)

- The sky is a dome that follows the camera's position (not its turning), so the moon and clouds sit at infinity and do not slide with the camera drift. Positions on it use azimuth and elevation in degrees.
- **Moon:** direction chosen so that, at the rest camera, it projects to about 86 percent across and 24 percent down a 16:9 window. The test checks the whole disc stays in the empty upper-right band (x from 0.76 to 1.0, y from 0.15 to 0.34 at 1280 x 800) at drift extremes and at 16:10, 16:9 and 21:9. On a window narrower than 1:1, it checks the moon is visible in the top third.
- **Moon size:** disc radius 2.2 degrees, halo radius 7 degrees.
- **Clouds:** `cloudLanes` has three lanes above the halo and three below it. Lane centres sit at least `haloRadius + cloudHalfHeight + 3 degrees` away from the moon's elevation, so the cloud's ellipse can never reach the halo. Each lane has its own speed and direction. `cloudsAt(t)` returns ellipses (centre, half-width, half-height) wrapped across a wide span. The test samples many times and checks the gap to the moon circle is always positive.
- **Witch:** a path `witchAt(progress)` along a gentle arc that passes in front of the moon once per flight. A flight takes 36 seconds. She is in the sky only while the witch flag is on. After Dawn, she gets a 6 second sweep-away: speed up and fly off the top.
- **Bats and ghosts** are described in the Scene section. They move in the shader, so the CPU does no per-bat work.

## Scene canvas

Settings: `dpr = 1`, `antialias: false`, `stencil: false`, `powerPreference: 'high-performance'`, shadows on, `frameloop: 'always'`. Renderer tone mapping is off. The composer applies one ACES tone mapping at the end, so glowing materials with values above 1 survive until Bloom.

### Lights

| Light | Colour | Notes |
| --- | --- | --- |
| Moonlight (directional) | `moonlight` rose, moderate | from the moon's direction, casts shadows, orthographic shadow box fitted to the graveyard, map 2048 |
| Hemisphere | cold sky blue-violet over deep violet ground | fills the shadows |
| Rim (directional, no shadow) | cold blue | from behind the props, separates silhouettes from the sky |
| Warm points (at most 6) | candle, lantern, jack-o'-lantern, crypt doorway tones | crypt doorway, two gate lanterns, hanging lantern, two jack-o'-lanterns; no shadows; range about 7 units; flicker from `flicker.ts` |

Warm light also appears without real lights:

- **Glow pools:** an additive, radial-gradient quad laid on the ground under every warm source and every lit candle (one instanced draw). It tints the ground and props around it in warm orange, so the warm and cold contrast shows on surfaces.
- **Flame and glass glow:** a small additive billboard with a bright HDR colour at each flame, lantern glass and jack-o'-lantern face. These feed Bloom.

### Shadows

- One shadow-casting light. Only the static props cast (`castShadow` on instanced prop meshes). Clouds, witch, bats, ghosts and embers do not.
- `shadow.autoUpdate = false`. A `ShadowTicker` sets `needsUpdate = true` every 20 frames, and right away when the counts change.
- The shadow filter is the soft type available in the installed three (see Libraries). Bias and normal bias are tuned so the ground does not show acne.

### Atmosphere

- **Fog layer 1:** `FogExp2` in the cold fog colour. Its density is `base * fogFactor`.
- **Fog layer 2: ground mist.** Four large horizontal planes at heights 0.2, 0.7, 1.4 and 2.4. Each uses a shader with layered value noise that scrolls at its own speed and direction. Alpha is low and scaled by `fogFactor`. The shader also adds a warm tint near each warm light (it gets up to 6 light positions as uniforms), which is the warm light visibly tinting the fog. `depthWrite: false`.
- **Fog layer 3: horizon haze.** A soft red-violet band at the horizon, centred on the moon's azimuth, drawn on the sky dome.
- **Sky dome shader:** gradient from deep indigo to warm violet-crimson near the horizon, a few faint stars from hashed noise, and the moon's scatter glow. No texture file.
- **Embers:** one `Points` object with 400 particles. Position is computed in the vertex shader from time, a per-particle seed and the ember rate, so the CPU does nothing per frame. A uniform `uBurst` decays after a Dawn event and speeds the embers up and out. Colour is warm HDR, so they bloom.
- **Moon:** a camera-facing disc in HDR red, plus two additive halo discs. The halo scale and brightness follow `1 + amplitude * sin(2*pi*t/period)`. Nothing else is drawn on the disc, no face. The moon billboards toward the camera each frame (one matrix).
- **Clouds:** one instanced draw of soft round puffs (radial-gradient alpha in the shader), five puffs per cloud, with cold bodies and rose edges toward the moon.
- **Witch:** a dark flat silhouette (hat, cloak, broom) built from a `ShapeGeometry` from hand-written points, with a slightly larger warm-tinted copy behind it for the rim. No shadow.
- **Bats:** one instanced mesh of a small bat shape (body plus two wing triangles). Wings flap in the vertex shader. Each bat's path is a Lissajous loop around a flock centre, from per-instance seeds. Count follows `bats`.
- **Ghosts:** up to 8 instances of a tall open cylinder. The vertex shader ripples the hem and bobs the body. The fragment shader draws a pale cold translucent body, two dark eye holes and a small mouth, with a soft edge. Placed low over the graves.
- **Post:** `EffectComposer` with `multisampling={0}`, a half-float buffer, then `Bloom` (mipmap blur, threshold just under 1, half resolution), `Vignette`, and `ToneMapping`.

### What blooms

Everything glowing uses HDR colours above the Bloom threshold and `toneMapped: false`: moon and halo, flames, lantern glass, jack-o'-lantern faces, crypt doorway glow, embers, ghost and bat edge glow, and (in the portrait canvas) the starving red glow and the Dawn burn edge. Lit surfaces stay below the threshold, so only glowing things bloom.

### Running states

- **Hidden page:** on `visibilitychange`, set the frame loop to `never`, and back to `always` when visible.
- **Reduced motion:** frame loop `demand`. Time is held at 0 (no drift, flicker, flap, drift of clouds or mist), and the scene redraws on data change and resize through `invalidate()`.
- **Context lost:** `webglcontextlost` is handled by switching to the fallback (gradient and emblems). On `webglcontextrestored`, the layer remounts.

## Vampire (`lib/vampire`, `portraits/`)

### The model

`vampire.glb` is one mesh of about 10,000 triangles with three WebP textures (base colour, normal, roughness and metallic), meshopt-compressed. It has no skeleton and no animation. It is about 1.0 tall, 0.72 wide and 0.57 deep after its node scale. `rig.ts` holds: model height, the yaw that makes it face the camera, and the fractions used to place the eyelids. The facing and the eye fractions are guesses I cannot check without seeing the model, so they are plain numbers in `rig.ts` with comments, and they are the first things to check in Chrome.

One cloned material per card (sharing the textures), patched with `onBeforeCompile` for:

- `uBend`: bends the body forward or back (hunch and lean) with a smooth curve over height.
- `uDissolve`, `uDissolveEdge`: a noise dissolve with a bright HDR orange edge, used by the Dawn burn.
- `uAlpha`: a fade for the end of exits.

Because the patch is the same for all clones, three compiles the shader once.

### Poses (`pose.ts`)

```ts
interface Pose { y; rotX; rotY; rotZ; scaleX; scaleY; scaleZ; bend; glow; lying; eyesClosed; breath }
statePose(state, t, seed): Pose            // idle pose with its motion
blendPose(a, b, k): Pose                    // smooth mix
lookAngles(dx, dy): { yaw, pitch }          // clamped cursor look
approach(current, target, dt, rate)         // frame-rate-independent smoothing
```

| State | Idle pose |
| --- | --- |
| Awake | breathes (scale y 1 to 1.025, scale x and z the opposite way), head and body turn toward the cursor within 25 degrees sideways and 12 degrees up and down |
| Starving | hunched (bend forward, head low), paces side to side with a turn at each end, red glow pulsing between 0.4 and 1 |
| Protected | leans back 14 degrees and trembles with fast, small rotations |
| Asleep | lying in the open coffin (`lying = 1`), eyes closed, slow breath, "z" letters rising |

Each card passes a seed from its tab id, so vampires do not move in step. When the state changes, the displayed pose blends toward the new one over 300 ms (`approach`).

### Eyes closed

The face is painted into the texture, so the eyes cannot be closed by moving geometry. For the Asleep pose, two dark curved eyelid arcs are placed on the face. At load, a raycast from the front at the eye fractions in `rig.ts` finds the face surface point and its normal, and the arcs are placed there, so they sit on the surface at the right depth. Only the two fractions can be off, and they are plain numbers.

### Asleep pose and "z" letters

- The open coffin is `coffin.glb` (body and lid nodes). The lid is moved aside and turned up so the coffin is open. The vampire lies on its back inside it (rotation about the x axis, scaled to fit the coffin).
- The "z" letters are three flat shapes drawn from a hand-written "Z" outline (`ShapeGeometry`). No font is needed. Each one floats up about 0.5, sways a little and fades out, staggered by one third of the loop. They glow cold blue and bloom.

### Portrait canvas

- `PortraitCanvas` is one R3F `Canvas`: `dpr` up to 1.25, `antialias: true`, `alpha: true`, transparent clear colour, no shadows, `frameloop` follows page visibility.
- Each card renders a drei `View` with `track` set to its portrait slot's inner box. Each View has its own camera and a small light rig: a warm key from the left, a cold rim from the right and back, and a soft cold fill. The camera fits the vampire (or the coffin) to the 96 x 112 box.
- **Niche:** a plane drawn first in each View: a soft radial glow tinted by the state colour on a dark background, matching the Spec 3 niche. Because the card has an arched hole, only the arch shows.
- **Starving glow:** a slightly larger back-face shell in additive red with a fresnel falloff, pulsing; HDR, so it blooms in a local Bloom pass on the portrait canvas (see below).
- **Cursor look:** a single `pointermove` listener on the window stores the cursor position. Each frame, a View reads its slot's rectangle once and computes the direction.
- **Only near views mount:** an `IntersectionObserver` with a margin of one screen mounts a card's View only when it is near the viewport. Others keep the DOM emblem. With 300 cards this keeps the number of live Views small. drei also skips drawing Views that are fully off screen.
- **Ready handling:** while the model loads, the card shows the emblem. When the first frame of its View has drawn, the card gets `data-3d="on"` (hole appears) and the emblem fades out by `opacity`.
- **Bloom in portraits:** one small `EffectComposer` is shared by the canvas with a light Bloom (same threshold), so the red glow, the burn edge, the "z" letters and the bat's eyes glow. It runs at half resolution too. If the composer does not work well together with `View` (it renders several scissor regions), the fallback is to give glowing parts a soft additive halo billboard instead of true Bloom. I will check this in the first portrait task and record which is used.

### Exits (`exits.ts`)

Each exit is a pure function of elapsed milliseconds that returns a pose and effect values.

| Kind | Duration | What happens |
| --- | --- | --- |
| `stake` | 1000 ms | topples backward (rotation about the feet, accelerating, one small bounce), drops out of the view, fades in the last 15 percent |
| `dawn` | 1300 ms + up to 300 ms stagger | dissolve 0 to 1 with a glowing edge that blooms, body rises slightly, embers rise from the dissolving surface (a small `Points` object per View) |
| `crypt` | 1200 ms | squashes and flashes into a bat (cross-fade at 35 percent), the bat flaps and flies up and out of the portrait |
| `coffin` | 1400 ms (a transition, the card stays) | coffin rises from below, vampire lies down and sinks into it, ends in the Asleep pose |
| `none` | 260 ms | fade and sink, as in Spec 3 (used when a tab closes for another reason) |

All exits last at most 1600 ms including stagger. The test checks this for every kind and every stagger.

### Wiring exits to the page

- `exitKinds.ts` holds a small map from tab id to `{ kind, order }`.
- In `App.tsx`, when an action succeeds, it marks the tab: `stake`, `crypt`. For Dawn it marks every tab that was a Dawn target, in card order, with kind `dawn`. For Coffin it marks a transition `coffin` for that tab.
- `useExitingCards` reads the mark when a card disappears and creates the ghost with `exitKind` and a duration from `exits.ts` (default 260 ms for unmarked). The ghost's CSS custom properties `--exit-ms` and `--exit-fade-delay` make the card body stay fully visible until the last 260 ms, then fade out with `opacity` and `transform`.
- When the Coffin transition mark exists and the card's state changes to Asleep, the portrait plays the coffin timeline then settles in the Asleep pose. If the card is Asleep for any other reason (page load, the browser discarded it), it simply shows the Asleep pose.
- The same events go to `bus.ts`: `stake` (small ember puff), `crypt` (a new bat appears in the sky flock), `dawn` (ember burst, the witch sweeps away), `coffin` (nothing in the sky: the new coffin appears in the grounds through the stats).
- With reduced motion, no marks are used: cards leave at once and Coffin switches straight to the Asleep pose.

## App integration

```
App
  <PortraitLayer/>   lazy; null until WebGL is confirmed; holds the portrait canvas
  <SceneLayerHost/>  lazy; null until WebGL is confirmed; holds the scene canvas
  .page ...          unchanged Spec 3 content
  <FpsReadout/>      only when the address ends with #fps
```

- `useWebgl()` makes a throwaway canvas and asks for a WebGL 2 context once. If it fails, nothing 3D is loaded, and the page stays as Spec 3.
- `App` builds `SceneInputs` from the data it already has: card count, starving count, memory sum, crypt length, stats and garlic. It passes them to the scene layer.
- A React error boundary around each layer turns any 3D failure into the fallback, with no message to the user.
- The `#fps` readout (small, bottom-left, over everything) shows frames per second (average of the last second), the worst frame time in the last second, and for each canvas the draw calls and triangles from `gl.info`. It resets the info each frame and reads it after the last pass, through R3F's after-effect hook.

## Performance plan

| Area | Plan |
| --- | --- |
| Draw calls | about 24 prop parts, ground, path, sky, moon (3), mist (4), clouds, witch (2), bats, ghosts, embers, glow pools, flame glows, plus a shadow pass of the props and about 8 Bloom and tone-map passes. The test adds the numbers from the plan and requires at most 150. |
| Triangles | props by instancing: the budget test adds every instance of every model from the catalogue and requires at most 150,000 for the scene and 15,000 for one vampire. Expected scene total is below 60,000. |
| Per-frame CPU | one `useFrame` for time uniforms and light flicker (6 lights), one for the camera, one for ember and halo values. No object creation in loops. Instance matrices change only while props fade in or out. |
| Shadows | one map of 2048, redrawn every 20 frames. |
| Fill rate | mist layers are the heaviest transparent items. They are four planes at low alpha, and the first thing to cut if `#fps` shows a problem, along with the stats panel blur from Spec 3. |
| Memory | textures stay at full size. Models and textures load once and are shared. |
| First paint | the 3D chunk loads after the page paints. Models load while the gradient shows, then the canvas fades in. |

## Testing

All pure code has tests in Node. The 3D drawing code cannot run in jsdom, so component tests mock the layers.

| File | Checks |
| --- | --- |
| `meaning.test.ts` | property tests: every count within its cap, never negative, whole numbers; halo period and amplitude within limits and monotonic in the hunger share; fog within 0.7 to 1.3 and monotonic in memory; examples at the edges (0, cap, above cap, NaN-like inputs) |
| `layout.test.ts` | same seed, same layout; no two footprints overlap (full capacity); everything inside the ground; the path and moon clear zones respected |
| `camera.test.ts` | the drift is periodic (value at 0 equals value at 60 seconds), has no jumps, stays within its amplitude; the moon projects inside the empty band at 16:9, 16:10 and 21:9, at drift extremes; the crypt projects to the left third; narrow windows keep the moon in the top third |
| `sky.test.ts` | cloud ellipses never intersect the moon halo, at 5,000 sampled times; lanes wrap; witch path is continuous |
| `flicker.test.ts` | stays within 0.82 to 1.18, small steps between frames, equal to 1 with reduced motion |
| `palette.test.ts` | cold hues 210 to 280, warm hues 10 to 50, hue helper correct on known colours |
| `pose.test.ts` | for every state and many times: no NaN or infinity, every value within safe limits, `blendPose` at 0 and 1 returns its inputs, `lookAngles` clamped, `approach` never overshoots |
| `exits.test.ts` | every kind: start pose equals the idle pose, end pose is the final pose, values continuous, no NaN, duration at most 1600 ms with the largest Dawn stagger |
| `budget.test.ts` | reads the Kaykit `.gltf` and `vampire.glb` JSON, adds up triangles by instance counts and the draw call plan, and requires the budgets in `config.ts` |
| `network.test.ts` | text check: no host name in 3D code, no `Environment`, no drei `Text`, Draco off in every `useGLTF` call |
| `css.test.ts` (updated) | reader ignores `;` inside quotes and brackets; the mask uses a `data:` address with no host name; animations still only change `transform` and `opacity`; the one blur rule is still the stats panel |
| UI tests | with the layers mocked: fallback when WebGL is missing, emblem shown until the vampire is ready, both canvas containers `aria-hidden`, `#fps` readout only with `#fps`, exit ghost durations per action and the CSS properties they set, reduced motion removing ghosts, Dawn marking the targets in card order |

## What you will check in Chrome

After the build, open `chrome://extensions`, load `.output/chrome-mv3`, and open a new tab. Add `#fps` to the address to see the numbers. The things I cannot confirm myself:

1. The vampire faces the camera. If not, change the yaw in `lib/vampire/rig.ts`.
2. The closed eyelids sit on the eyes in the Asleep pose. If not, change the two eye fractions in `rig.ts`.
3. The moon is clear of the header and visible above the first row of cards.
4. The look: warm and cold contrast, fog layers, bloom strength. These are numbers in `config.ts` and `palette.ts`.
5. Frame rate in `#fps` with 15 cards, and with many tabs.

## Open points and risks

- **Facing and eye position** of the vampire are guessed (see above).
- **Bloom with several scissor regions** in the portrait canvas may need the halo-billboard fallback.
- **Scroll lag:** the portrait canvas redraws one frame after the page scrolls.
- **Mask support:** the card hole needs `mask-composite`. Where it is missing, the emblem stays (the mask is applied only when `CSS.supports('mask-composite', 'exclude')` is true).
- **Stats panel blur** over the animated scene costs frames on weaker GPUs. It is the first thing to reduce if `#fps` shows drops, then the mist layers.
- **Hidden scene:** many cards hide most of the background. The moon and crypt stay visible above the first row and in the gaps.
