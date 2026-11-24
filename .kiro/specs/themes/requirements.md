# Requirements Document

## Introduction

This spec (Spec 5 in the roadmap) adds six themes and a Themes panel. A theme sets the colours of the 3D scene (sky, ground, fog, light, moon, clouds, ghosts, embers), the 3D props, the weather, and the colours of cards, buttons and panels. The choice is saved and applies to every Tabpire page: the new tab page, the Blood Bank and the web demo.

Facts about the code as it stands today:

- **Themes.** `ThemeId` in `lib/store.ts` is `string`, `DEFAULT_THEME` is `'crypt'`, and `store.getTheme` accepts any stored string. `tokens.css` has only `:root[data-theme='crypt']`. The three HTML files (`newtab`, `bloodbank`, `demo`) hard-code `data-theme="crypt"`. The Themes button in `Header.tsx` is disabled ("Coming soon"). There is no `lib/themes.ts`, `useTheme.ts` or `ThemePicker.tsx`.
- **Scene colours.** Scene colours are fixed in `lib/scene/palette.ts` (`COLD`, `WARM`, `ACCENT`) and `entrypoints/newtab/layers/scene/colors.ts` (`C`, which also holds `horizon`, `mid`, `haze`, `mushroom`, `cauldron`, `wisp`, `ghost`). The scene reads them from `C`.
- **Models.** `MODELS` in `lib/scene/layout.ts` lists the Kaykit models and three Quaternius families already used by The Crypt: `forest_twisted_a/b/c`, `forest_mushroom`, `forest_mushroom_king` and `forest_cauldron`. No `farm_*`, `frost_*`, `blood_*` or `castle_*` model is in `MODELS` yet.
- **Model files in `public/models/quaternius`:**
  - `farm_*`: barn, corn, fence, hay, pumpkin, silo, windmill.
  - `forest_*`: cauldron, mushroom, mushroom_king, potion_a, potion_b, rock_large, rocks, twisted_a, twisted_b, twisted_c.
  - `frost_*`: pine_a, pine_b, pines, rock.
  - `blood_*`: column, column_round, pedestal, ruins. There is no spire file, so columns and pedestals stand in for spires.
  - `castle_*`: banner, fortress, stone_wall, torch, wall_flag, wall_towers.
- **Budget.** `BUDGET` in `lib/scene/config.ts` allows 150 draw calls and 175,000 triangles for the scene today. This spec raises the triangle limit to 200,000 (Requirement 13.8). `tests/budget.test.ts` checks the limit against the model files for the current layout.
- **Storage.** `onStoreChange` already reports changes to `tabpire:*` keys, including `tabpire:theme`.
- **Demo.** The demo (Spec 7) aliases `wxt/browser` to an in-memory Fake_Browser and turns off network access through `lib/capabilities.ts`. Spec 7 forbids `localStorage`, `sessionStorage`, IndexedDB and cookies in the Fake_Browser only. The Fake_Browser keeps that rule. The Sky_Cache of this spec is the one documented exception and lives outside the Fake_Browser (Requirement 12).
- **Out of scope.** User-defined or editable themes, a different theme per page or per tab, time-of-day or automatic theme switching, new vampire models or poses, changes to hunger state names or Dawn rules, a popup theme (Spec 6 builds the popup and may read the theme later), and new Quaternius model files (the files above are used as they are).

## Glossary

- **Theme**: one of six named looks, identified by a Theme_Id.
- **Theme_Id**: the union `'crypt' | 'pumpkin' | 'forest' | 'frost' | 'bloodmoon' | 'castle'`.
- **Palette**: the full set of colours of one Theme, defined in `lib/themes.ts`. It has a scene part (sky, fog, light, moon, cloud, ghost and ember colours) and a surface part (the colour tokens in `tokens.css`).
- **Crypt_Theme**: the Theme with Theme_Id `crypt`, "The Crypt". It is the look of Spec 4 and the default.
- **Themes_Module**: `lib/themes.ts`, a pure module (no browser API, no three) with `THEMES`, `DEFAULT_THEME` and `themeById`.
- **Store**: `lib/store.ts`, the only module that touches `browser.storage.local`.
- **Theme_Hook**: `useTheme` in `entrypoints/newtab/components/useTheme.ts`. It reads the saved Theme_Id, applies it and saves changes.
- **Theme_Picker**: the panel in `entrypoints/newtab/ThemePicker.tsx`.
- **Themes_Button**: the header button labelled "Themes".
- **Active_Theme**: the Theme whose surface tokens are on the page. **Shown_Scene**: the Theme whose 3D scene is drawn. The two differ only while a new scene loads.
- **Scene**: the full-screen WebGL background of the Crypt_Page (Spec 4).
- **Props_Set**: the list of 3D models a Theme places in the Scene, with their positions.
- **Weather**: the particle effect of a Theme: snow (Frozen Cemetery), ash (Blood Moon), fireflies (Witch's Forest), falling autumn leaves (Pumpkin Patch) or a few drifting embers near the torches (Haunted Castle). The Crypt_Theme has none.
- **Surface_Tokens**: the CSS custom properties in `tokens.css`, such as `--card-top`, `--ink` and `--state-awake`.
- **State_Colours**: `--state-awake`, `--state-starving`, `--state-asleep` and `--state-protected`.
- **Sky_Cache**: a copy of the Active_Theme's Theme_Id kept in `localStorage`, which a page can read synchronously before React mounts. The Theme_Id selects the `[data-theme]` block of `tokens.css`, so it gives the page its sky colours (and every other Surface_Token) at once. It is a cache only. The saved choice stays in `browser.storage.local`.
- **Crypt_Page**: the new tab page. **Blood_Bank_Page**: the Blood Bank page. **Demo**: the static web build in `demo/`.
- **Fake_Browser**: the in-memory `browser` used by the Demo and by tests.
- **Budget**: the limits in `BUDGET` (`lib/scene/config.ts`): 150 scene draw calls and 200,000 scene triangles (raised from 175,000 by this spec, Requirement 13.8).

## Requirements

### Requirement 1: Theme catalogue

**User Story:** As a developer, I want all palettes in one pure module, so that every page and test reads the same theme data.

#### Acceptance Criteria

1. THE Themes_Module SHALL export the type `ThemeId` as the union `'crypt' | 'pumpkin' | 'forest' | 'frost' | 'bloodmoon' | 'castle'`.
2. THE Themes_Module SHALL export `THEMES` with exactly six entries, in this order and with these display names: `crypt` "The Crypt", `pumpkin` "Pumpkin Patch", `forest` "Witch's Forest", `frost` "Frozen Cemetery", `bloodmoon` "Blood Moon", `castle` "Haunted Castle".
3. THE Themes_Module SHALL export `DEFAULT_THEME` with the value `'crypt'`.
4. WHEN `themeById` is called with any string, THE Themes_Module SHALL return the Theme with that id, or the Crypt_Theme when no Theme has that id.
5. THE Palette of every Theme SHALL define a colour for each scene key: sky top, sky middle, sky horizon, haze, fog, ground, hemisphere sky, hemisphere ground, rim light, moonlight, moon (glow, light body and dark body), cloud (body and tint), ghost, ember, the warm light colours (candle, lantern, jack-o'-lantern, crypt door) and the glow colours of the mushroom, cauldron and wisp.
6. THE Palette of every Theme SHALL define a value for every Surface_Token that the Crypt_Theme defines in `tokens.css`.
7. THE Themes_Module SHALL import no browser API, no `wxt/browser` and no `three`.
8. THE Themes_Module SHALL give every Theme a short one-line description in plain words, for the Theme_Picker.
9. FOR ALL Theme_Ids in `THEMES`, `themeById(id).id` SHALL equal `id` (property test), and FOR ALL arbitrary strings, `themeById` SHALL return a defined Theme (property test).

### Requirement 2: The Crypt stays exactly as it is

**User Story:** As the owner of the design, I want The Crypt unchanged, so that adding themes does not alter the look the earlier specs settled.

#### Acceptance Criteria

1. THE Crypt_Theme scene colours SHALL equal today's values, including the colours now written inside shaders (the moon body and the cloud body and tint) and the ground colours in `Ground.tsx`, in `lib/scene/palette.ts` (`COLD`, `WARM`, `ACCENT`) and `entrypoints/newtab/layers/scene/colors.ts` (`horizon`, `mid`, `haze`, `mushroom`, `cauldron`, `wisp`, `ghost`).
2. THE Crypt_Theme Surface_Tokens SHALL equal today's values in the `:root[data-theme='crypt']` block of `tokens.css`. The few colours that are written inside component stylesheets today (Requirement 6.3) MAY become new Surface_Tokens whose Crypt_Theme value is the old literal, so the Crypt_Page looks the same.
3. WHILE the Shown_Scene is the Crypt_Theme, THE Scene SHALL place the same models at the same positions, rotations and scales as `buildLayout()` returns today, and SHALL add no Weather and no other prop.
4. THE existing palette tests (hue limits of cold and warm colours, red moon) SHALL keep passing unchanged for the Crypt_Theme.
5. A regression test SHALL fail WHEN any Crypt_Theme scene colour, any Crypt_Theme Surface_Token or the `buildLayout()` output differs from a stored snapshot of today's values.
6. THE Crypt_Page layout, including the header, cards, search box and haunts row, SHALL stay the same in every Theme. Themes change colours, props and Weather only.

### Requirement 3: Themes panel

**User Story:** As a user, I want a Themes button that opens a panel of six themes, so that I can choose the look of my tabs page.

#### Acceptance Criteria

1. THE Themes_Button SHALL be enabled and SHALL show a tooltip in plain words, replacing "Coming soon".
2. WHEN the user activates the Themes_Button, THE Theme_Picker SHALL open and list the six Themes in the order of `THEMES`, each with its name, its description and a swatch drawn from its own Palette.
3. THE Theme_Picker SHALL mark the Active_Theme as selected, using both a visible mark and the `aria-checked` or `aria-pressed` state.
4. WHEN the user selects a Theme, THE Theme_Hook SHALL apply it and save its Theme_Id through the Store.
5. WHEN the user presses Escape, THE Theme_Picker SHALL close and return focus to the Themes_Button.
6. WHEN the user clicks outside the Theme_Picker, THE Theme_Picker SHALL close.
7. WHEN the Theme_Picker opens, THE Theme_Picker SHALL move focus to the selected Theme.
8. WHILE the Theme_Picker is open, THE Theme_Picker SHALL keep Tab and Shift+Tab focus inside the panel.
9. WHILE the Theme_Picker is open, THE Theme_Picker SHALL let the user move between Themes with the arrow keys and choose one with Enter or Space.
10. THE Theme_Picker SHALL be a dialog with an accessible name, and THE Themes_Button SHALL expose `aria-haspopup="dialog"` and `aria-expanded`.
11. THE Theme_Picker SHALL show a visible focus ring on every control, using `--focus-ring`.
12. THE Theme_Picker SHALL use the Active_Theme's glass panel style and Surface_Tokens, and SHALL fit inside a 360 px wide viewport without horizontal scrolling.
13. WHILE the user has `prefers-reduced-motion: reduce`, THE Theme_Picker SHALL open and close with no animation.

### Requirement 4: Saved choice and unknown values

**User Story:** As a user, I want my theme remembered, so that every Tabpire page opens in the look I chose.

#### Acceptance Criteria

1. THE Store SHALL type `ThemeId` as the union of Requirement 1.1 (re-exported from the Themes_Module), and THE Store SHALL keep `DEFAULT_THEME` equal to `'crypt'`.
2. WHEN `store.getTheme` reads a stored value that is missing, not a string, or not one of the six Theme_Ids, THE Store SHALL return `DEFAULT_THEME` without throwing.
3. WHEN `store.setTheme` is called, THE Store SHALL write the Theme_Id under the key `tabpire:theme`.
4. FOR ALL Theme_Ids, `getTheme` after `setTheme(id)` SHALL return `id` (round-trip property).
5. WHEN a page opens, THE Theme_Hook SHALL read the saved Theme_Id and apply it to the Crypt_Page, the Blood_Bank_Page and the Demo.
6. IF reading or writing the theme fails, THEN THE Theme_Hook SHALL keep the current Theme and report the failure, and THE Crypt_Page SHALL show a plain-words notice that the choice could not be saved. THE Blood_Bank_Page has no notice area and SHALL keep the current Theme without a notice.
7. THE Theme_Hook SHALL set the `data-theme` attribute on the root element to the Active_Theme's Theme_Id.

### Requirement 5: Sync between open pages

**User Story:** As a user with several Tabpire pages open, I want a theme change to appear everywhere, so that the pages never disagree.

#### Acceptance Criteria

1. WHEN `tabpire:theme` changes in storage, THE Theme_Hook SHALL read the new value through `onStoreChange` and apply it, in every open Crypt_Page and Blood_Bank_Page.
2. WHEN `tabpire:theme` changes to the Active_Theme's own Theme_Id, THE Theme_Hook SHALL make no visible change.
3. WHEN a page unmounts, THE Theme_Hook SHALL remove its `onStoreChange` listener.
4. WHEN a change to a key other than `tabpire:theme` arrives, THE Theme_Hook SHALL not read the theme again.

### Requirement 6: Colours of cards, buttons and panels

**User Story:** As a user, I want cards, buttons and panels to match the theme, so that the page looks like one place.

#### Acceptance Criteria

1. THE `tokens.css` file SHALL have one `:root[data-theme='<id>']` block for each of the six Theme_Ids, and each block SHALL define the same set of custom properties.
2. THE Crypt_Page and Blood_Bank_Page components SHALL read every colour and shadow from Surface_Tokens, and SHALL not read a theme name.
3. THE CSS tests SHALL fail WHEN any component stylesheet (including `bloodbank.css`) holds a colour literal other than black or white with or without alpha (the neutral shadows and masks already in use). Tinted literals that exist today SHALL move into Surface_Tokens (Requirement 2.2).
4. THE State_Colours of every Theme SHALL keep their meaning: awake is a light, cool tone, starving is red, asleep is blue and protected is gold. The hue of each State_Colour SHALL stay within 30 degrees of the Crypt_Theme's hue for that state.
5. THE four State_Colours of every Theme SHALL be distinct from one another, and every state SHALL also keep its word label and badge shape, so that no state depends on colour alone.
6. THE hunger state names (Awake, Starving, Asleep, Protected) SHALL not change in any Theme.
7. WHEN the Active_Theme changes, THE Crypt_Page and Blood_Bank_Page SHALL update colours without a reload.

### Requirement 7: Text contrast in every Theme

**User Story:** As a user, I want readable text in every theme, so that no palette makes the page hard to read.

#### Acceptance Criteria

1. FOR ALL six Themes, `--ink` and `--ink-dim` SHALL have a contrast ratio of at least 4.5:1 on `--sky-top`, `--sky-bottom`, `--card-top`, `--card-bottom`, `--panel-solid`, `--button-top` and `--button-bottom`.
2. FOR ALL six Themes, each State_Colour SHALL have a contrast ratio of at least 4.5:1 on `--card-top` and `--card-bottom`.
3. FOR ALL six Themes, `--badge-ink` SHALL have a contrast ratio of at least 4.5:1 on `--badge-1` to `--badge-6`.
4. THE contrast tests SHALL run the same checks as `tests/contrast.test.ts` for each Theme, reading each Theme's solid colours from `tokens.css`.
5. THE Surface_Tokens that hold solid colours SHALL be written as `#rrggbb`, so the tests can read them.

### Requirement 8: Scene colours per Theme

**User Story:** As a user, I want each theme to have its own sky, fog, light, moon, clouds, ghosts and embers, so that the scene matches the theme's name.

#### Acceptance Criteria

1. WHEN the Shown_Scene is a Theme, THE Scene SHALL draw the sky, ground, fog, hemisphere light, rim light, moonlight, moon, clouds, ghosts and embers with the colours of that Theme's Palette. THE vampire portrait lights SHALL use the same Palette, and the tints of the portrait niches SHALL follow the Active_Theme's Surface_Tokens. THE vampire's own glow halo (`GlowHalo` and the red, orange and white-hot colours it takes for the starving pulse, Dawn and the Crypt flash, plus any other portrait code that tints the vampire's own glow) SHALL keep the Crypt_Theme's values in every Theme.
2. THE Moon of every Theme SHALL stay a plain glowing disc with no face and no eyes.
3. THE Palette of the Blood Moon Theme SHALL use a red moon, and the existing hue test SHALL check the red moon of the Crypt_Theme and the Blood Moon Theme.
4. THE Palette of every Theme SHALL keep its warm light colours (candle, lantern, jack-o'-lantern, ember) in the hue range 10 to 50 degrees, so that warm and cold light stay apart.
5. THE scene colours of one Theme SHALL differ from those of every other Theme in at least the sky top, fog and moon colours.
6. THE scene SHALL keep all its other behaviour from Spec 4 in every Theme: depth fog that follows memory, shadows refreshed every 20 frames, Bloom, Vignette and the slow camera drift.

### Requirement 9: Theme props from Quaternius models

**User Story:** As a user, I want each theme to have its own 3D props, so that the themes look different and not just recoloured.

#### Acceptance Criteria

1. WHEN the Shown_Scene is Pumpkin Patch, THE Scene SHALL place `farm_barn`, `farm_silo` and `farm_corn` models, and MAY place `farm_pumpkin`, `farm_hay`, `farm_fence` and `farm_windmill`.
2. WHEN the Shown_Scene is Witch's Forest, THE Scene SHALL place `forest_cauldron` and the `forest_twisted_a`, `forest_twisted_b` and `forest_twisted_c` trees, and MAY place `forest_mushroom`, `forest_mushroom_king`, `forest_potion_a`, `forest_potion_b`, `forest_rock_large` and `forest_rocks`.
3. WHEN the Shown_Scene is Frozen Cemetery, THE Scene SHALL place `frost_pine_a`, `frost_pine_b` and `frost_pines`, and MAY place `frost_rock`. THE pines SHALL be tinted pale blue-white, with a lighter snow colour on their upper parts, through material colour and vertex colour only, with no new model file.
4. WHEN the Shown_Scene is Blood Moon, THE Scene SHALL place `blood_ruins` (the same two parts the far village uses), and `blood_column`, `blood_column_round` and `blood_pedestal` as the spires, with no Quaternius file added.
5. WHEN the Shown_Scene is Haunted Castle, THE Scene SHALL place `castle_fortress` or `castle_wall_towers`, and `castle_torch`, and MAY place `castle_banner`, `castle_stone_wall` and `castle_wall_flag`.
6. THE Props_Set of each non-Crypt Theme SHALL keep the graveyard's gate path and the crypt entrance free, and SHALL not overlap any other placed model, using the same overlap rule `tests/layout.test.ts` applies to the Crypt_Theme.
7. THE Props_Set of each Theme SHALL be seeded and fixed, so that the same Theme always shows the same layout.
8. THE `MODELS` table SHALL list every model used by a Props_Set, with its footprint, height and triangle count, and a test SHALL compare each entry against its model file.
9. WHEN a Theme's props use a model that is not in the Crypt_Theme, THE Scene SHALL load the file through `modelFile` and `assetUrl`, so the path works in the extension, the dev server and the Demo.
10. WHERE the Theme places a lantern, candle or torch, THE prop SHALL give off a warm glow in the Theme's warm light colour, as the Crypt_Theme's candles do.

### Requirement 10: Weather

**User Story:** As a user, I want weather that matches the theme, so that Frozen Cemetery, Blood Moon and Witch's Forest feel alive.

#### Acceptance Criteria

1. WHEN the Shown_Scene is Frozen Cemetery, THE Scene SHALL draw falling snow.
2. WHEN the Shown_Scene is Blood Moon, THE Scene SHALL draw drifting ash.
3. WHEN the Shown_Scene is Witch's Forest, THE Scene SHALL draw fireflies.
4. WHEN the Shown_Scene is Pumpkin Patch, THE Scene SHALL draw slowly falling autumn leaves.
5. WHEN the Shown_Scene is Haunted Castle, THE Scene SHALL draw a few embers drifting up near the torches.
6. WHEN the Shown_Scene is The Crypt, THE Scene SHALL draw no Weather and SHALL stay as it is today.
7. THE Weather of each Theme SHALL be one draw call and no more than 2,000 particles, and all its motion SHALL be computed on the GPU from a time uniform, with no per-particle work in JavaScript.
8. THE Weather SHALL keep the sharpness of Spec 4: dpr 1, no blur filter, no lowered resolution.
9. WHILE the user has `prefers-reduced-motion: reduce`, THE Weather SHALL show fewer particles (at most a quarter of the normal count) standing still, and SHALL not animate them.
10. WHILE the page is hidden, THE Weather SHALL draw nothing, as the rest of the Scene does.
11. THE Weather colours SHALL come from the Theme's Palette.

### Requirement 11: Switching without a blank flash

**User Story:** As a user, I want a theme switch to look smooth, so that the screen never flashes blank or half-built.

#### Acceptance Criteria

1. WHEN the user selects a Theme, THE Crypt_Page SHALL update the Surface_Tokens at once and SHALL keep drawing the previous Shown_Scene until the new Theme's models are loaded.
2. THE Crypt_Page SHALL use `useDeferredValue` on the Theme, so the old scene stays drawn while the new scene builds.
3. WHEN the new Theme's models are loaded, THE Crypt_Page SHALL replace the Shown_Scene in one frame, with no frame in which the canvas is empty.
4. WHEN the page is idle after first paint, THE Crypt_Page SHALL preload the model files of the other Themes through `requestIdleCallback`, or `setTimeout` when it is not available.
5. WHEN the user selects a Theme again while a previous switch is still loading, THE Crypt_Page SHALL keep drawing the Shown_Scene and load only the latest choice.
6. IF a model file of the new Theme fails to load, THEN THE Crypt_Page SHALL apply requirement 14 and still complete the switch.
7. WHILE the user has `prefers-reduced-motion: reduce`, THE Crypt_Page SHALL replace the scene with no cross-fade.
8. THE preload SHALL make no network request outside the extension's own files.
9. THE Crypt_Page SHALL use `useDeferredValue` as the primary mechanism, and IF a manual check in Chrome shows an empty frame during a switch, THEN the Crypt_Page SHALL use a manual gate instead (preload the new files, then set the shown Theme_Id), with the same observable behaviour as Requirements 11.1 and 11.3.

### Requirement 12: Instant sky on a new tab

**User Story:** As a user, I want a new tab to show my theme's sky at once, so that I never see the default colour first.

#### Acceptance Criteria

1. WHEN the Crypt_Page, the Blood_Bank_Page or the Demo loads, THE page SHALL read the Sky_Cache and set `data-theme` on the root element before React mounts, so the page background shows the cached Theme's sky colours.
2. WHEN the Scene has drawn its first frame, THE Crypt_Page SHALL fade the canvas in over the painted sky, using opacity only.
3. WHEN the Active_Theme changes, THE Theme_Hook SHALL update the Sky_Cache with the new Theme_Id.
4. IF the Sky_Cache is missing, unreadable or holds an unknown value, THEN THE page SHALL use the Crypt_Theme's sky colours, and SHALL not throw.
5. THE Sky_Cache SHALL be stored in `localStorage` (in the extension and in the Demo), because the page can read it synchronously and the extension's content security policy forbids inline scripts. Every `localStorage` call SHALL be inside try/catch. ONLY the Sky_Cache module SHALL use `localStorage`. The Fake_Browser SHALL keep not using `localStorage`, `sessionStorage`, IndexedDB or cookies (Spec 7, Requirement 3.2), and the theme itself SHALL be saved through `browser.storage.local`.
6. THE Sky_Cache SHALL hold one Theme_Id and no tab data.
7. WHILE the user has `prefers-reduced-motion: reduce`, THE Crypt_Page SHALL show the canvas without the fade.
8. WHEN the saved Theme differs from the Sky_Cache, THE Theme_Hook SHALL correct `data-theme` and the Sky_Cache once the saved value has been read.

### Requirement 13: Performance budget in every Theme

**User Story:** As a user, I want every theme to run smoothly, so that a pretty theme never makes the page stutter.

#### Acceptance Criteria

1. FOR ALL six Themes, THE budget test SHALL add up the triangles of the planned scene (base layout, Props_Set and Weather, counting instances and the shadow pass as it does today, and counting each Weather particle as two triangles) and SHALL require no more than `BUDGET.sceneTriangles`.
2. FOR ALL six Themes, THE budget test SHALL count the draw calls of the planned scene and SHALL require no more than `BUDGET.sceneDrawCalls`.
3. FOR ALL six Themes, THE number of point lights SHALL stay at or below `BUDGET.maxPointLights`.
4. THE Scene SHALL keep `QUALITY` as it is in every Theme: background dpr 1, no antialias, Bloom at half resolution, shadows refreshed every 20 frames, portrait dpr up to 1.25 with antialias.
5. WHEN a Theme is not the Shown_Scene, THE Scene SHALL hold none of that Theme's instanced meshes, tinted material copies or Weather, and SHALL dispose of the old Theme's copies after the new scene replaces it. The decoded model files stay cached, so switching back is instant (about 4 MB of files in all).
6. THE total size of the extension bundle SHALL stay within `BUDGET.maxBundleBytes`, counting the new model files that are used.
7. THE budget test SHALL fail WHEN a prop file in the Props_Set differs from its `tris` entry in `MODELS`.
8. THE `BUDGET.sceneTriangles` limit SHALL be 200,000 (raised from 175,000), and `BUDGET.sceneDrawCalls` SHALL stay 150. THE budget test text SHALL state the new limit.

### Requirement 14: Missing model files

**User Story:** As a user, I want the scene to survive a missing or broken model file, so that one bad file never leaves a blank page.

#### Acceptance Criteria

1. IF a model file of the Shown_Scene's Props_Set fails to load, THEN THE Scene SHALL skip that prop, draw all other props and continue, and SHALL not throw.
2. IF the Theme's sky, ground or fog cannot be built, THEN THE Crypt_Page SHALL fall back to the existing Spec 4 Layer fallback and keep the Surface_Tokens of the Active_Theme.
3. THE Scene SHALL not leave a prop's slot empty in the layout of another prop, so that a skipped prop leaves no visible hole in the Theme's Weather or glow.
4. A test SHALL fail WHEN any model file named in a Props_Set is missing from `public/models` or from the built output.
5. THE Scene SHALL log a short message to the console for each model file that fails to load, with the file name only.

### Requirement 15: Extension and Demo parity

**User Story:** As a judge using the web demo, I want the Themes panel to work exactly as in the extension, so that I can try every theme from a URL.

#### Acceptance Criteria

1. THE Demo SHALL show the same Theme_Picker and Themes_Button as the Crypt_Page, from the same component, and the Demo SHALL not hold a copy.
2. WHEN a judge selects a Theme in the Demo, THE Demo SHALL save it through the Fake_Browser's in-memory `storage.local` and apply it to the Crypt_Page and the Blood_Bank_Page of the Demo.
3. WHEN a judge navigates between `#/crypt` and `#/bloodbank` in the Demo, THE Demo SHALL keep the chosen Theme.
4. WHEN a judge uses the Demo's reset button, THE Demo SHALL return the Theme to the Crypt_Theme.
5. THE Demo SHALL make no network request for a Theme, and SHALL use `assetUrl` for every model file, so the model paths work from the sub-path of the deployed site.
6. THE Demo SHALL save the Theme only through the Fake_Browser's `storage.local`. THE Demo SHALL use `localStorage` for the Sky_Cache only (Requirement 12.5), and the Demo's reset button SHALL clear the Sky_Cache.
7. THE Demo build SHALL include every model file of every Props_Set in `demo/dist`, and the existing built-output test SHALL check this.
8. THE `demo/index.html` and the extension HTML files SHALL start with `data-theme="crypt"`, until the Theme_Hook applies the saved Theme.

### Requirement 16: Tests and checks

**User Story:** As a developer, I want the theme rules tested, so that a later change cannot break a theme unnoticed.

#### Acceptance Criteria

1. A property test SHALL check that every Theme in `THEMES` has every required scene colour key and every required Surface_Token, each as a valid `#rrggbb` colour where a solid colour is required.
2. A property test SHALL check that `themeById` never returns `undefined`, for any string.
3. A property test SHALL check the round trip of Requirement 4.4, and a unit test SHALL check Requirement 4.2 for stored values `undefined`, `null`, a number, an object and `'nope'`.
4. A regression test SHALL check Requirement 2.5.
5. THE contrast tests SHALL check Requirement 7 for each Theme.
6. THE budget tests SHALL check Requirement 13 for each Theme.
7. A layout test SHALL check Requirement 9.6 and 9.7 for each Theme.
8. A hook test SHALL check Requirement 5, with a fake `storage.onChanged` event.
9. A component test SHALL check Requirement 3 (open, Escape, focus, arrow keys, selected mark) and Requirement 15.2 with the Fake_Browser.
10. A CSS test SHALL check Requirement 6.1 (one block per Theme, same property set). A source test SHALL check that only the Sky_Cache module uses `localStorage` or `sessionStorage`, and that the Fake_Browser does not import it.
11. THE existing tests SHALL keep passing, except `tests/ui/header.test.tsx`, whose "disables Themes" test SHALL change because the Themes_Button is now enabled (Requirement 3.1).
12. THE web-demo checks with the Playwright MCP that each theme can be selected belong to Spec 7's check procedure and are not part of this spec's automated tests. THE look checks in Chrome are done by hand by the user after the build and are not automated tasks.
13. A unit test SHALL check Requirement 11.1 and 11.3 with a deferred-switch wrapper (the "gate") and a loader that resolves later: while the loader is pending, the shown Theme_Id is the old one and the old scene stays mounted; after the loader resolves, the new Theme_Id is shown and the new scene is mounted.
14. A test SHALL check Requirement 8.1 for the halo: FOR ALL six Themes, the colours `GlowHalo` uses (starving red, Dawn orange, Crypt white-hot) equal the Crypt_Theme's values.
