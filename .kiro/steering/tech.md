# Tech

## Stack
- WXT (Manifest V3) for Chrome and Firefox. Import `browser` from `wxt/browser`. Permissions: tabs, storage, alarms, search, favicon.
- React 19 and strict TypeScript. Plain CSS with design tokens per theme (`entrypoints/newtab/styles/tokens.css`); no UI library.
- three.js with @react-three/fiber, drei and @react-three/postprocessing. One background canvas (the graveyard) and one shared
  portrait canvas for every card's vampire (drei `View`).
- Fonts bundled with @fontsource: Grenze Gotisch (titles), Sora (labels), Outfit (body).
- The web demo (`demo/`) is a Vite build of the real pages against a fake `browser` (`lib/fakeBrowser.ts`).

## Commands
- `npm run dev` / `npm run dev:firefox`: run the extension with hot reload.
- `npm run typecheck`: `wxt prepare` and `tsc --noEmit`.
- `npx vitest run` (or `npm test`): every test.
- `npm run build` / `npm run build:firefox`: the extension in `.output/`.
- `npm run demo:build`: the web demo in `demo/dist`. `npm run layout:check` then checks the real page layout in headless Chrome
  (800x600 up to 1920x1080, 19 tabs; no screenshots). `-- --write` records the card areas for `tests/pageLayout.test.ts`.
- `node tools/make-icons.mjs`: the extension icons in `public/icon/` from `tools/icon/bat.svg`.
- `node tools/check-css-animations.mjs`: keyframes animate only transform and opacity (also run by a hook on CSS save).

## Tests
- Vitest, Testing Library (jsdom for UI tests: `// @vitest-environment jsdom`) and fast-check property tests.
- Pure rules live in `lib/` with no browser APIs and no `Date.now()`: time is passed in. Test them with properties
  (every tab has one state, Dawn never touches the active, pinned, audible or garlic tabs, estimates are stable).
- Scene layouts are pure data (`lib/scene/`), checked by tests: inside the ground, no overlaps, clear of the moon and the cards.
  `Placer.fixed` throws in tests (MODE `test`) so a bad number fails at once; in the app it skips the prop and warns once.
- Only enabled themes (`ENABLED_THEME_IDS`) are built, preloaded and tested as runtime scenes. Disabled themes
  (`DISABLED_THEMES`: Blood Moon, Haunted Castle) keep their code and pure tests, but are not in the runtime registries.
- Change a test only when the requirement changed; say so in the commit.

## Performance rules
- Target 60 fps without making anything blurry or lower quality.
- Background canvas: dpr 1, no antialias, Bloom at half resolution, shadows refreshed every 20 frames.
- Portrait canvas: dpr up to 1.25 with antialias.
- One draw batch per model (instancing); stay inside `BUDGET` in `lib/scene/config.ts` (triangles, draw calls, point lights).
- CSS animations and transitions change only `transform` and `opacity`. No backdrop blur.
- Respect `prefers-reduced-motion`: no animation, scenes hold still.
- The page never scrolls. Cards shrink to fit down to the smallest scale (action buttons at least 28 px), then the
  hungriest are shown with a "+N more" card.
