This is the full roadmap. Build only the spec I ask for; use the rest as context.

## Spec 1: Project and tab rules

> Create a browser extension called **Tabpire** ("Your tabs are draining you. Stake them.") with WXT (Manifest V3),
> React 19 and strict TypeScript, for Chrome and Firefox. It replaces the new tab page. Permissions: tabs, storage,
> alarms, search. Plain CSS, no UI library. Import `browser` from `wxt/browser`.
>
> Every open tab is a "vampire" with exactly one state:
> - **Awake**: active, audible, or used in the last day
> - **Starving**: idle for 1 day or more
> - **Asleep**: discarded
> - **Protected**: its site is on the garlic list
>
> Put all rules in a pure `lib/hunger.ts`, with no browser APIs and no `Date.now()` (time is passed in).
>
> Estimate each tab's memory from its site. Known heavy sites: chatgpt.com about 520 MB, claude.ai about 450 MB,
> YouTube, Figma, Gmail. Fall back to URL heuristics. The estimate must be stable per tab (±15% from a hash),
> rounded to 5 MB, and always shown with "~". Discarded tabs use about 0 MB.
>
> Write **property-based tests** with Vitest and fast-check for:
> - every tab has exactly one state
> - the estimate is stable and never negative
> - hunger never goes down while a tab stays unused
>
> `lib/store.ts` owns `browser.storage.local`: stats, action log, crypt (saved tabs), garlic sites, pinned pages, theme.

## Spec 2: Tab actions, Dawn, badge

> Add tab actions in `lib/tabs.ts`:
> - **Stake**: close the tab
> - **Coffin**: discard the tab to free memory
> - **Crypt**: save the tab, then close it
> - **Garlic**: protect the whole site
> - **Resurrect**: reopen a tab from the crypt
>
> **Dawn** closes every starving tab at once and saves each to the crypt first. It must NEVER touch the active tab,
> pinned tabs, tabs playing sound, or garlic sites. Add a property test for this.
>
> Every action adds its estimated memory to "reclaimed" and writes to the action log.
>
> A background script shows the starving count on the toolbar badge and refreshes it every minute (alarms).

## Spec 3: The Crypt new tab page

> Build the new tab page "The Crypt". Follow `.kiro/steering/style.md`. Fonts, bundled with @fontsource:
> Grenze Gotisch for titles, Sora for labels, Outfit for body text.
>
> **Header:** brand on the left; one centred glass stats panel (open tabs, estimated memory "~", memory reclaimed
> "~", each with an "est." tag); on the right, buttons for Themes, Blood Bank (blood orb icon) and Dawn
> (sunrise style, disabled when nothing is starving).
>
> **Cards:** one gothic shrine card per other open tab, sorted hungriest first. Each card has a rim colour by state,
> the site icon, title, state badge, idle time, estimated memory, and a blood-vial hunger meter. Icon buttons with
> tooltips: Stake, Coffin, Crypt, Garlic. Draw custom gradient SVG icons; no icon library.
>
> **Search box:** uses the browser's default search engine. Suggestions come from open tabs, pinned pages and the
> crypt first, then Google suggestions. Below it, a row of pinned pages with an "Add page" button.
>
> Respect `prefers-reduced-motion`. CSS animations only change transform and opacity.

## Spec 4: 3D graveyard and the vampire

> Add a full-screen 3D background with three.js, @react-three/fiber, drei and @react-three/postprocessing:
> - **Ground and props:** a night graveyard built from the GLB models in `public/models` (crypt, gate, fences, dead
>   and autumn trees, graves, pumpkins, candles, lanterns).
> - **Moon:** a camera-facing **blood-red moon with no face**, with a slowly pulsing halo.
> - **Atmosphere:** fog, moonlight shadows, ground mist, ember sparkles, Bloom and Vignette, a slow camera drift.
> - **Sky life:** soft round clouds that pass above and below the moon (never across it), a witch silhouette on a
>   broomstick, a flapping bat flock, and ghosts with a rippling hem.
>
> Every card shows the vampire model `public/models/vampire.glb` in ONE shared WebGL canvas (drei View). It has no
> skeleton, so animate the whole body:
> - Awake: breathes and looks at the cursor
> - Starving: hunched pacing with a red glow
> - Protected: leans back trembling
> - Each action has its own exit: Stake topples it backwards, Dawn burns it to embers, Crypt turns it into a bat,
>   Coffin sinks it into a rising coffin
>
> Performance target: **60 fps** without making anything blurry.
> - Background canvas: dpr 1, no antialias, Bloom at half resolution, shadows refreshed every 20 frames.
> - Portrait canvas: dpr up to 1.25 with antialias.

## Spec 5: Themes

> Add a Themes button that opens a panel with 6 themes: The Crypt, Pumpkin Patch, Witch's Forest, Frozen Cemetery,
> Blood Moon, Haunted Castle. Store the palettes in `lib/themes.ts`.
>
> - Each theme has its own sky, fog, light, moon, cloud, ghost and ember colours, AND its own 3D props that match
>   its name, using the Quaternius models in `public/models/quaternius`: barn, silo and corn; cauldron and twisted
>   trees; frosted pines; ruins and spires; castle and torches.
> - Weather to match: snow, ash, or fireflies.
> - Keep The Crypt exactly as it was in Spec 4.
> - The choice is saved and applies to every Tabpire page.
> - No blank flash: when switching, keep the old scene until the new one has loaded (useDeferredValue, preload on
>   idle). On a new tab, paint the cached sky colour at once and fade the canvas in over it.
> - Cards, buttons and panels also use the active theme's colours, keeping each state colour's meaning.

## Spec 6: Popup and Blood Bank

> - **Toolbar popup:** the starving count, estimated memory, a Dawn button, and "Open the Crypt".
> - **Blood Bank page:** total memory reclaimed, counts per action, a hunter rank that grows with tabs slain, the
>   action log (newest first), and the crypt list with Resurrect and Delete.

## Spec 7: Web demo for judges

> Judges need a URL they can open without installing the extension. Add a `demo/` web build (Vite) that renders the
> real Crypt, Blood Bank and popup against a fake `browser` API, with about 20 sample tabs (some starving, one
> playing sound, one protected) so every action works. Deploy it as a static site (GitHub Pages or Netlify).
> Use the Playwright MCP to open the demo and check that each action and theme works.

## Spec 8: Accounts (optional, only if time allows)

> Add optional email and password login with Amazon Cognito, and sync the crypt, pinned pages and theme to DynamoDB
> through API Gateway and Lambda (AWS CDK in `backend/`). Tabpire must still work fully without an account, and
