# Requirements: 3D graveyard and the vampire (Spec 4)

## Introduction

This spec adds the 3D look of Tabpire. A full-screen night graveyard sits behind The Crypt page. Each card shows a 3D vampire in its portrait slot, drawn by one shared WebGL canvas. The graveyard scene is lit with cold moonlight and shadows against warm candle, lantern and pumpkin light, with layered fog, bloom on everything that glows, and a slowly drifting camera.

It builds on Spec 3 (the page, the cards, the reserved portrait slot) and Spec 2 (the actions). It follows `.kiro/steering/style.md`. Out of scope: themes and their props (Spec 5), the popup and Blood Bank (Spec 6), the web demo (Spec 7).

## Glossary

- **Scene**: the full-screen background canvas with the graveyard, moon, sky and atmosphere.
- **Portrait canvas**: the one shared canvas that draws every card's vampire, using drei `View` regions.
- **View**: the rectangle on the portrait canvas that follows one card's portrait slot.
- **Warm light**: candle, lantern, jack-o'-lantern and ember light. **Cold light**: moonlit blue-violet fill, shadow tone and fog.
- **Bloom**: the glow added around very bright pixels.
- **Scenery**: places and things that set the stage: the crypt, gate, fences, ground, trees, lanterns, pumpkins and the old graves.
- **Symbols**: things that carry meaning: the moon, ghosts, bats, the witch, candles, new graves, coffins and embers.
- **Asleep pose**: the vampire lying in an open coffin with closed eyes.
- **Hunger share**: the number of starving tabs divided by the number of cards, from 0 to 1.

## Decisions (settled)

1. **Background resolution.** The background canvas uses pixel ratio 1, no antialiasing and half-resolution Bloom, as in the roadmap. These numbers live in one config file. After you read the `#fps` readout in Chrome, you can raise them if there is room.
2. **Meaning for every symbol.** Requirement 7 ties each symbol to your data. Scenery is exempt.
3. **The witch** appears only while Dawn is ready, and sweeps away after Dawn runs.
4. **The Asleep portrait** is the vampire sleeping inside an open coffin: eyes closed, a gentle breathing motion, and small "z" letters floating up. The Coffin exit ends in this pose.

## Assumptions (please confirm or change)

1. **Visual checks are yours.** I cannot open images or take screenshots in this session. I will verify the scene with tests of the maths and the budgets, and you review the look in Chrome. The page gets an `#fps` readout with frame time, draw calls and triangle count so you can report numbers back.
2. **Target machine:** a mid-range laptop (Apple M1 or Intel Iris Xe class) at 1920 x 1080, with Chrome and Firefox current.
3. **The scene is composed for a wide screen** and adapts to narrower ones by changing the field of view, not by dropping objects. The moon sits in the empty upper-right band and the crypt on the left, so the header controls and the cards do not hide them at 1280 px wide and up. Cards cover most of the screen when many tabs are open, so the scene shows most with few tabs or at the top of the page.
4. **Card layout does not change.** The 3D vampire fills the portrait slot that Spec 3 reserved. The page keeps all its Spec 3 text, tooltips, colours and layout.
5. **The 3D code loads after the page.** The header, search box and cards appear first. The scene and portraits fade in when ready.
6. **Models:** the Kaykit Halloween set in `public/models/kaykit` for the scene, `public/models/vampire.glb` for the vampire, and `public/models/coffin.glb` for the Coffin exit. The Quaternius models are for Spec 5.
7. **Cards may be exiting longer than before.** An action's exit animation can last up to about 1.5 seconds. The tab closes at once, as in Spec 2. Only the card's ghost stays on screen until its animation ends.
8. **During fast scrolling** a portrait can trail its card by up to one frame, because the browser scrolls the page and the canvas separately.

## Requirements

### Requirement 1: Scene layer, loading and fallback

**User story:** As a user, I want the 3D background to appear without slowing down or breaking the page, so that Tabpire is always usable.

#### Acceptance criteria

1. THE scene SHALL fill the window behind all page content, SHALL NOT receive clicks, and SHALL be hidden from screen readers.
2. THE page SHALL render its header, search box, pinned pages and cards before the 3D code has loaded. THE 3D code SHALL load in a separate chunk after first paint.
3. UNTIL the scene is ready, THE page SHALL show the Spec 3 night-sky gradient. WHEN the scene is ready, THE scene canvas SHALL fade in over it by changing `opacity` only, with no blank or white flash.
4. IF WebGL is not available or fails to start, THEN THE page SHALL keep the gradient background and the 2D vampire emblems from Spec 3, and SHALL show no error to the user.
5. IF the WebGL context is lost, THEN THE page SHALL fall back as in 1.4 and SHALL try to restore the scene when the context returns.
6. WHILE the page is hidden (another tab is in front), THE scene and the portrait canvas SHALL stop drawing, and SHALL resume when the page is visible.
7. THE scene and portrait canvas SHALL load all models, textures and decoders from the extension's own files.

### Requirement 2: Ground and props

**User story:** As a user, I want a believable night graveyard, so that the page feels like a place.

#### Acceptance criteria

1. THE scene SHALL build a graveyard from the Kaykit models in `public/models/kaykit`: a crypt as the focal building, an arch gate, fences with pillars and broken sections, dead trees, autumn pine trees, graves and gravestones, pumpkins and jack-o'-lanterns, candles, standing and hanging lanterns, a dirt path and a dirt ground.
2. THE props SHALL be placed by a seeded layout, so every run gives the same arrangement.
3. NO two props SHALL overlap each other, and every prop SHALL stand on the ground.
4. THE scene SHALL repeat the same model with GPU instancing, so repeated props share one draw call per model part.
5. THE crypt SHALL have a warm glowing doorway, so that it reads as a lit building at night.
6. THE ground SHALL fade into fog at its far edge, so no edge is visible.

### Requirement 3: The moon

**User story:** As a user, I want a striking blood-red moon, so that the scene has a clear focal point.

#### Acceptance criteria

1. THE moon SHALL be a plain red glowing disc that always faces the camera.
2. THE moon SHALL have no face, no eyes and no other drawn features, as in `style.md`.
3. THE moon SHALL glow with Bloom and SHALL have a soft halo whose size and brightness pulse slowly.
4. THE halo pulse SHALL follow the hunger share (Requirement 7).
5. THE moon SHALL be the position of the main shadow-casting light.

### Requirement 4: Lighting, shadows and colour contrast

**User story:** As a user, I want rich lighting, so that the scene feels deep and dramatic.

#### Acceptance criteria

1. THE scene SHALL contrast cold light with warm light. THE cold palette (shadows, fog, hemisphere fill, rim light) SHALL have hues between 210 and 280 degrees. THE warm palette (candles, lanterns, jack-o'-lanterns, embers, crypt doorway) SHALL have hues between 10 and 50 degrees.
2. THE moon SHALL cast soft shadows from the props onto the ground, using one directional shadow-casting light.
3. THE shadows SHALL be refreshed every 20 frames and not every frame. THE shadow map SHALL stay sharp: no lower than 2048 by 2048.
4. ONLY static props SHALL cast shadows. Moving things (clouds, witch, bats, ghosts, embers) SHALL NOT.
5. THE scene SHALL have warm point lights near the crypt doorway, the lanterns and the jack-o'-lanterns. IT SHALL use at most 6 real point lights. Other glowing things SHALL be lit by glowing materials and Bloom instead of real lights.
6. THE warm lights SHALL flicker gently, with a different pattern for each light.
7. THE warm light SHALL visibly tint nearby ground, props and fog, so the warm and cold contrast is seen on surfaces and not only in the colour of the lights.
8. A cold hemisphere light SHALL fill the shadows with blue-violet, and a cold rim light SHALL separate the props from the sky.

### Requirement 5: Atmosphere

**User story:** As a user, I want fog, glow and drifting motion, so that the scene feels alive.

#### Acceptance criteria

1. THE scene SHALL have at least three distinct fog layers: depth fog over the whole scene, low ground mist drifting at different speeds and heights, and a glow of haze near the horizon around the moon.
2. THE fog density SHALL follow the estimated memory in use (Requirement 7).
3. EVERY glowing thing SHALL bloom: the moon and its halo, candle flames, lantern glass, jack-o'-lantern faces, the crypt doorway, embers, the Dawn burn, the bat and ghost glows, and the red glow of starving vampires.
4. BLOOM SHALL be drawn at half the scene's resolution (Requirement 11), SHALL use only values above a brightness threshold, and SHALL leave unlit surfaces unchanged.
5. THE scene SHALL have a Vignette that darkens the edges.
6. THE scene SHALL have ember sparkles that rise slowly from the ground and fade.
7. THE camera SHALL drift slowly in a small closed loop, with no sudden jumps.
8. THE sky SHALL be a gradient from deep indigo at the top to a warm violet-crimson near the horizon, with a few faint stars.

### Requirement 6: Sky life

**User story:** As a user, I want things moving in the sky, so that the background has life without being busy.

#### Acceptance criteria

1. THE sky SHALL have soft round clouds that drift above and below the moon and SHALL NEVER cross the moon's disc or its halo as seen from the camera.
2. THE witch on a broomstick SHALL be a dark silhouette with a faint warm rim, flying slowly across the sky.
3. THE bats SHALL be a flock of small silhouettes with flapping wings.
4. THE ghosts SHALL be pale translucent figures with a rippling hem, drifting low over the graves.
5. NONE of these SHALL cast shadows or block the header, search box or cards.

### Requirement 7: Meaning

**User story:** As a user, I want every spooky thing in the scene to mean something about my tabs, so that the scene tells me the state of my browser.

#### Acceptance criteria

1. THE moon halo SHALL pulse faster and stronger as the hunger share rises. At share 0, the period SHALL be 6 seconds and the amplitude 6 percent. At share 1, the period SHALL be 2.5 seconds and the amplitude 20 percent. Values in between SHALL change smoothly.
2. THE ground mist and depth fog SHALL get thicker as the estimated memory in use rises. From no memory to 8000 MB, density SHALL rise from 70 percent to 130 percent of its base value, and SHALL stay at those limits outside this range.
3. THE number of ghosts SHALL equal the number of items in the Crypt, up to 8.
4. THE number of bats in the sky flock SHALL equal the number of tabs saved with Crypt or Dawn (`crypted` in the stats), up to 24.
5. THE number of lit candles SHALL equal the number of protected sites in the garlic list, up to 12.
6. THE number of new graves SHALL equal the number of tabs staked (`staked` in the stats), up to 24. THE number of coffins in the grounds SHALL equal the number of tabs put to sleep (`coffined` in the stats), up to 8.
7. THE witch SHALL be in the sky only while Dawn would close at least one tab. WHEN Dawn finishes, THE witch SHALL sweep away.
8. THE ember sparkles SHALL rise faster and in greater number as the number of starving tabs rises, and SHALL burst upward when Dawn runs.
9. THE scenery (Requirement 2) SHALL always be present, whatever the data.
10. THE scene SHALL change smoothly when the data changes. Added things SHALL fade or rise in, and removed things SHALL fade out.
11. THE counts and values above SHALL come from one pure function, so they can be tested.

### Requirement 8: Vampire portraits on one shared canvas

**User story:** As a user, I want each tab to be a small 3D vampire, so that the cards feel alive.

#### Acceptance criteria

1. EVERY card SHALL show `public/models/vampire.glb` in its portrait slot. ALL vampires SHALL be drawn by ONE shared canvas using drei `View`, not one canvas per card.
2. EACH View SHALL follow its portrait slot's position and size as the page scrolls and resizes.
3. THE vampire SHALL stay inside the portrait slot's arched niche. NO part of it SHALL be drawn outside the slot.
4. THE portrait SHALL draw its own niche background tinted by the state colour, so the card looks the same as in Spec 3.
5. TOOLTIPS, the suggestion list, the Add page form and messages SHALL always appear above the portraits.
6. VIEWS that are off screen SHALL NOT be drawn.
7. THE portrait canvas SHALL render at a pixel ratio of up to 1.25 with antialiasing. THE vampire textures SHALL NOT be shrunk.
8. THE portrait canvas SHALL be transparent, hidden from screen readers, and SHALL NOT receive clicks.
9. UNTIL a card's vampire is ready, THE card SHALL show the 2D emblem from Spec 3, and SHALL then switch with a fade of `opacity`.
10. THE vampire model SHALL be loaded once and shared by all cards.
11. THE portrait lighting SHALL be warm from one side and cold from the other, to match the scene.

### Requirement 9: Vampire states

**User story:** As a user, I want the vampire's pose to tell me the tab's state, so that I can read the page at a glance.

#### Acceptance criteria

1. THE vampire has no skeleton, so every animation SHALL move or reshape the whole body.
2. AN Awake vampire SHALL breathe (a slow rise and fall with a small squash and stretch) and SHALL turn its head and body toward the cursor, within a limited angle.
3. A Starving vampire SHALL stand hunched and pace side to side, with a pulsing red glow.
4. A Protected vampire SHALL lean back and tremble.
5. AN Asleep vampire SHALL be shown lying asleep inside an open coffin, with its eyes closed, a gentle breathing motion, and small "z" letters that float up, drift sideways a little, and fade out (decision 4). THE coffin SHALL use `public/models/coffin.glb` with its lid open.
6. WHEN a card's state changes, THE portrait SHALL blend smoothly to the new pose with no pop.
7. EACH vampire SHALL start its animation at a different time, so a row of vampires does not move in step.
8. THE pose maths SHALL be pure functions of the state, the time and the cursor direction, so they can be tested.

### Requirement 10: Action exits

**User story:** As a user, I want each action to have its own exit, so that using Tabpire is satisfying.

#### Acceptance criteria

1. WHEN Stake succeeds, THE vampire SHALL topple backwards and fall out of view.
2. WHEN Dawn succeeds, EACH closed tab's vampire SHALL burn to embers, with a glowing edge that blooms and embers that rise. THE burns SHALL be staggered by a short delay per card.
3. WHEN Crypt succeeds, THE vampire SHALL turn into a bat that flies up and out of the portrait and joins the bat flock in the sky.
4. WHEN Coffin succeeds, THE open coffin (`public/models/coffin.glb`) SHALL rise from the bottom of the portrait, THE vampire SHALL lie down and sink into it, and the animation SHALL end in the Asleep pose of Requirement 9.5, with eyes closed and "z" letters rising.
5. WHEN a tab closes without a Tabpire action (for example, the user closes it), THE card SHALL fade out and sink, as in Spec 3.
6. THE tab SHALL close at the moment the action succeeds, as in Spec 2. THE exit animation SHALL NOT delay or block any action.
7. THE card SHALL stay on screen, with its buttons disabled, until its exit animation ends. No exit SHALL last longer than 1.6 seconds.
8. WITH reduced motion, THE card SHALL leave at once, as in Spec 3, and no exit animation SHALL play. THE Coffin action SHALL switch straight to the Asleep pose.
9. THE exit timelines SHALL be pure functions of elapsed time, so they can be tested.

### Requirement 11: Performance without lowering sharpness

**User story:** As a user, I want smooth 60 fps, so that the page feels fast.

#### Acceptance criteria

1. THE page SHALL target 60 fps on the machine in assumption 2, with a scene of at most 150 draw calls and 150,000 triangles, and a portrait canvas of at most 15,000 triangles for each drawn vampire.
2. THE scene canvas SHALL render at pixel ratio 1 with no antialiasing, and Bloom at half resolution, as in decision 1. THESE values SHALL live in one config file.
3. THE page SHALL NOT lower resolution, texture size, shadow map size or model detail to gain speed, and SHALL NOT change quality automatically while running.
4. THE shadow map SHALL refresh every 20 frames.
5. THE scene SHALL NOT create new objects inside the frame loop, and its animation SHALL use shared uniforms and instanced attributes.
6. THE scene SHALL draw nothing while the page is hidden (Requirement 1.6).
7. THE addition of 3D SHALL NOT delay the first paint of the header and cards.
8. WHEN the address ends with `#fps`, THE page SHALL show a small readout of frames per second, frame time, draw calls and triangles for the scene and the portrait canvas. THE readout SHALL be hidden otherwise.
9. THE blur of the stats panel (Spec 3) SHALL stay unchanged unless the `#fps` readout shows it costing frames, in which case I will reduce or remove it and report it.

### Requirement 12: Local-first and packaging

**User story:** As a user, I want no surprise network use, so that I can trust the extension.

#### Acceptance criteria

1. THE scene and portraits SHALL load no model, texture, font, environment map, decoder or script from the network.
2. THE page SHALL NOT use drei helpers that fetch from the network, such as `Environment` presets, `Text`, or the default Draco decoder path.
3. THE manifest permissions and the content security policy SHALL stay as they were after Spec 3.
4. THE only network request from the page SHALL remain the search suggestion request and the tab icons (Spec 3 Requirement 10).
5. THE 3D libraries SHALL be bundled in a separate chunk, and the total size of the built extension SHALL stay under 12 MB.

### Requirement 13: Motion and accessibility

**User story:** As a user who is sensitive to motion, I want the page to be calm when I ask for it, so that I can use it comfortably.

#### Acceptance criteria

1. WHEN the system asks for reduced motion, THE camera SHALL not drift, the clouds, witch, bats and ghosts SHALL not move, embers SHALL not rise, flames SHALL not flicker, the moon halo SHALL not pulse, and the vampires SHALL hold still in their state pose.
2. WITH reduced motion, THE scene SHALL draw only when something changes, not every frame.
3. THE scene and portrait canvases SHALL be hidden from assistive technology. ALL meaning in the scene SHALL also be available as text on the page (the stats, the card states and the Crypt list), so no information is only in the picture.
4. THE 3D layers SHALL NOT reduce the text contrast required in Spec 3.

### Requirement 14: Tests and checks

**User story:** As a developer, I want the maths and budgets tested, so that the scene stays correct and fast even though it cannot be checked by screenshot here.

#### Acceptance criteria

1. THE pure scene function SHALL be tested, with property-based tests, for: every count within its cap, the halo period and amplitude within their limits and never decreasing as the hunger share rises, fog density within 70 to 130 percent and never decreasing as memory rises, and smooth change between values.
2. THE layout generator SHALL be tested for: the same seed giving the same layout, no overlapping props, and every prop inside the ground.
3. THE cloud paths SHALL be tested to never cross the moon's disc or halo, for any time.
4. THE pose maths and exit timelines SHALL be tested for: no NaN or infinite values, values within safe limits, continuity at the start and end of each timeline, and every exit lasting at most 1.6 seconds.
5. THE colour palette SHALL be tested for the hue limits in Requirement 4.1.
6. A BUDGET test SHALL read the Kaykit and vampire files, add up the triangles of the planned scene (counting instances) and the vampire, and require the totals to stay within Requirement 11.1.
7. A TEXT check SHALL confirm that the scene and portrait code load no web address with a host name, use no `Environment` preset and no `Text` helper, and set the Draco decoder off.
8. COMPONENT tests SHALL confirm that the page works with the 3D layers mocked out: the fallback when WebGL is missing, the 2D emblem until the vampire is ready, `aria-hidden` on both canvases, the `#fps` readout showing only with `#fps`, and the exit duration of each action.
9. ALL tests SHALL run with `npm test` and pass with the Spec 1 to 3 tests.
10. `npm run typecheck`, `npm run build` and `npm run build:firefox` SHALL pass.
