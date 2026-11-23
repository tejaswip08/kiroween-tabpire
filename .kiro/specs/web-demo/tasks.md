# Implementation Plan: Web demo (Spec 7)

## Overview

The demo is a second Vite build in `demo/` that renders the real Crypt and Blood Bank pages on top of an in-memory fake `browser`. The work goes in this order: share the fake, add the two small seams (`assetUrl`, `capabilities`), extract Blood Bank and fix the page frame layout in the extension, prove Dawn safety on the fake, then build the demo (build config, seed, interceptors, router and shell, startup wiring), then the built-output scan and the Pages workflow.

Each task is small enough to finish and check on its own. Requirement numbers refer to `requirements.md`, property numbers to `design.md`. After each task, `npm run typecheck` and `npm test` must pass. Tests are part of the task that adds the code, not separate optional tasks.

## Tasks

- [x] 1. Shared fake browser
  - [x] 1.1 Move `tests/helpers/fakeBrowser.ts` to `lib/fakeBrowser.ts` and make the old path `export * from '../../lib/fakeBrowser'`. Keep every current export (`fake`, `browser`, `events`, `fire`, `FakeTab`), the failure switches and the call log. Add: `favIconUrl` on `FakeTab`, `fake.autoEvents` (tab events fire after `remove`, `discard`, `create`, `update` when on), `fake.intercept` (called before `tabs.update` and `tabs.create`; `true` skips the change, the call log is still written), `fake.onSearch` and `search.query` (records, no network), `fake.extensionBase` with `runtime.getURL` using it, `oldValue` in `storage.onChanged`, per-listener error isolation, `tabs.getCurrent` returning `fake.currentTabId`, and `fake.clearData()` (clears tabs, storage, log, searches, alarms, badge and ids but keeps listeners and switches; `reset()` keeps its current meaning). No use of `localStorage`, `sessionStorage`, IndexedDB or cookies.
    - Existing tests must pass without edits.
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 11.2_
  - [x] 1.2 Create `tests/fakeBrowser.test.ts`. Unit tests: `tabs` (get, getCurrent, query, update, remove, discard, create), `alarms.create` replaces by name, `search.query` records and never calls `fetch`, `runtime.getURL`, `clearData` keeps listeners while `reset` removes them, a throwing listener does not stop the others, and spies on `Storage.prototype`, `indexedDB` and `document.cookie` show no use. Property tests with fast-check (100 runs or more, tagged `Feature: web-demo, Property N`): **Property 3** (storage events and round trip) and **Property 4** (tab events match tab changes against a simple model).
    - **Property 3: Storage events and round trip**
    - **Property 4: Tab events match tab changes**
    - **Validates: Requirements 3.3, 3.4**
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.7, 11.1_

- [x] 2. Base-aware asset paths
  - [x] 2.1 Create `lib/assetUrl.ts` with `assetUrl(path)`: reads `import.meta.env.BASE_URL` at call time (falls back to `/`), strips leading slashes from `path`, and never calls `browser.runtime.getURL`. Create `tests/assetUrl.test.ts` with **Property 2** over the bases `/`, `./` and `/repo/` and paths with or without a leading slash (starts with the base, no doubled slash, resolves under `<base>models/`), using `vi.stubEnv`.
    - **Property 2: Asset addresses resolve under the base**
    - **Validates: Requirements 1.4, 9.2**
    - _Requirements: 1.4, 9.1, 9.2_
  - [x] 2.2 Replace every hard-coded `'/models/...'` string with `assetUrl('models/...')`: `lib/scene/layout.ts` (`modelUrl`), and the `VAMPIRE_URL`, `COFFIN_URL`, `useGLTF.preload` calls, `OpenCoffin`, `FarVillage`, `Skeletons` and `Props` in `entrypoints/newtab/layers/`. Add a test that, with the default base, the produced addresses equal the old strings. `tests/layout.test.ts` and `tests/network.test.ts` must pass unchanged.
    - _Requirements: 9.1, 9.2, 1.5_

- [x] 3. Network capability flags
  - Create `lib/capabilities.ts` (`{ remoteSuggestions: true, remoteIcons: true }`). In `entrypoints/newtab/hooks/useSuggestions.ts`, skip the web effect and `fetchGoogleSuggestions` when `remoteSuggestions` is false. In `entrypoints/newtab/Haunts.tsx`, make `faviconSources` return only a tab icon that passes `SAFE_ICON_URL` when `remoteIcons` is false. Create `tests/demo/network.test.ts`: **Property 11** (no `fetch`, no `fetchGoogleSuggestions`, only local rows and the web-search row, for typed text of 2 or more characters) and **Property 12** (empty list or only the given tab icon, never another `http(s)` address). Add a check that the defaults (`true`) leave current behaviour unchanged.
    - **Property 11: No remote suggestions**
    - **Property 12: No remote icons**
    - **Validates: Requirements 8.2, 8.4**
    - _Requirements: 1.6, 8.2, 8.4_

- [x] 4. Reusable pages and the page frame layout
  - [x] 4.1 Create `entrypoints/bloodbank/BloodBank.tsx` with the exported `BloodBank` component (the page body moved from `main.tsx`, rendered as `<div className="bb-scroll"><main className="bb">...</main></div>`; it imports `bloodbank.css`). Reduce `entrypoints/bloodbank/main.tsx` to fonts, `tokens.css`, `base.css`, the mount code and the `BloodBank` import. Add `tests/ui/bloodbank.test.tsx`: renders the same headings as before, "Back to The Crypt" calls `openCrypt({ sameTab: true })`, and a text check that `main.tsx` imports `BloodBank`.
    - _Requirements: 1.1, 2.7_
  - [x] 4.2 Create `entrypoints/newtab/styles.ts` (side-effect imports of the fonts and every CSS file that `entrypoints/newtab/main.tsx` imports today) and make `main.tsx` import it. Add a test that `main.tsx` imports `./styles` and no longer lists the CSS files.
    - _Requirements: 1.1, 2.7_
  - [x] 4.3 Fix the page frame layout in CSS. In `entrypoints/newtab/styles/base.css`: keep `html, body, #root { height: 100vh; overflow: hidden }`, add `#root { display: flex; flex-direction: column }`, and change `.page` from `height: 100vh` to `flex: 1 1 0; min-height: 0` (keep `display: flex; flex-direction: column; overflow: hidden`). In `entrypoints/bloodbank/bloodbank.css`: remove the `html, body, #root` override and add `.bb-scroll { flex: 1 1 0; min-height: 0; overflow: auto }`, so Blood Bank scrolls inside its own container and the two stylesheets can share a document. Update `tests/css.test.ts`: keep the `html, body, #root` assertion (`100vh`, `hidden`), and add that `#root` is a flex column, `.page` has `flex: 1 1 0`, `min-height: 0` and no `height: 100vh`, and no rule in the extension styles other than `html, body, #root` uses `100vh`. Add a test on `bloodbank.css`: no `html`, `body` or `#root` selector, and `.bb-scroll` has `overflow: auto` and `min-height: 0`.
    - _Requirements: 7.2, 7.6, 7.7, 2.7_

- [x] 5. Checkpoint - Ensure all tests pass
  - Run `npm run typecheck` and `npm test`. Ensure all tests pass, ask the user if questions arise.

- [x] 6. Dawn safety and action invariants on the fake
  - Create `tests/demo/dawn.test.ts` using the real `lib/tabs.ts` on the shared fake through `vi.mock('wxt/browser')`. Generators: tab sets with random `id`, https and non-web URLs, `active`, `audible`, `discarded`, `pinned` and `lastAccessed` around the one-day line, plus a garlic list drawn from the generated sites. Properties (100 runs or more, tagged): **Property 7** (after `dawn(now)` every active, pinned, audible and garlic-site tab is still open), **Property 8** (closed tabs equal `dawnTargets`, each closed URL is in the crypt, and every `set:tabpire:crypt` call comes before the first `remove`), **Property 9** (over random sequences of Stake, Coffin, Crypt, Garlic, Resurrect and Dawn, `mbFreed` never decreases and the crypt never holds two entries with the same URL).
    - **Property 7: Dawn spares protected tabs**
    - **Property 8: Dawn closes the other starving tabs, saved first**
    - **Property 9: Action sequences keep the invariants**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7**
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

- [x] 7. Demo build
  - [x] 7.1 Move the `noRemoteDraco` plugin from `wxt.config.ts` to `build/noRemoteDraco.ts` and import it in `wxt.config.ts`. Confirm the extension build output is unchanged (`npm run build`, same manifest and no Draco decoder address in the bundle).
    - _Requirements: 1.5, 8.5_
  - [x] 7.2 Create the demo project: `demo/vite.config.ts` (`root: 'demo'`, `base: './'`, `publicDir: '../public'`, `@vitejs/plugin-react`, `noRemoteDraco`, alias `wxt/browser` to `lib/fakeBrowser.ts`, `outDir: 'dist'`), `demo/index.html`, `demo/env.d.ts` (`vite/client`) and a minimal `demo/src/main.tsx` that renders a placeholder line. Add `@vitejs/plugin-react` as a dev dependency (pin the version), the scripts `demo:dev` (`vite --config demo/vite.config.ts`) and `demo:build` (`vite build --config demo/vite.config.ts`), and make `tsconfig.json` cover `demo/`. Add `demo/dist` to `.gitignore`. Add `tests/demo/config.test.ts` (text checks: relative base, alias, `noRemoteDraco` listed, scripts present). Confirm `npm run demo:build` writes `demo/dist` with `models/` copied.
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6, 8.5, 9.1, 11.6_

- [x] 8. Sample data and reset
  - Create `demo/src/seed.ts` with `seedDemo(now)` (pure function of `now` and the fake) and `resetDemo(now)` (`fake.clearData()`, one `await Promise.resolve()` tick, then `seedDemo`). Seed 20 tabs by the table in the design (Crypt tab active, 6 awake, 1 audible, 8 starving, 1 pinned starving, 2 garlic-site, 1 discarded) with `lastAccessed = now - idleMs` (idle offsets in hours or days only, at least 2 hours from the one-day line; crypt `savedAt` and log `at` are offsets from the same `now`; no fixed or build-time timestamps; `seedDemo` takes `now` as a parameter and never reads the clock), `data:image/svg+xml` icons from `letterIcon(site)`, and realistic https pages on sites in `KNOWN_SITE_MB`. Write garlic (2 sites), haunts (4), crypt (3), stats and a log of 8 entries through `browser.storage.local.set` with the `KEYS`. End by setting `fake.currentTabId` and `fake.autoEvents = true`. Create `tests/demo/seed.test.ts`: **Property 6** (counts, one audible, one discarded, one active, pinned and garlic tabs, state counts from `stateOf`, `lastAccessed` offsets, `data:image/` icons, store sizes) and **Property 10** (after random actions then `resetDemo(t)`, tabs ignoring ids, storage, garlic, haunts and crypt equal a fresh `seedDemo(t)`; resetting twice equals once). Add a test that runs `seedDemo` at two different `now` values (for example `0` and 10 years later) and gets the same classification counts and the same relative idle, `savedAt` and `at` offsets, and a test that Reset recomputes from the `Date.now()` read at reset time (fake timers moved forward between load and Reset).
    - **Property 6: Seed data is well formed**
    - **Property 10: Reset restores the sample data**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 7.3, 8.3**
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 7.3, 7.5, 8.3_

- [x] 9. Notices and interceptors
  - Create `demo/src/notice.ts` (tiny event emitter, memory only) and `demo/src/intercept.ts` with `installInterceptors(navigate)`: set `fake.intercept` and `fake.onSearch` as designed (own `newtab.html` and `bloodbank.html` addresses change only the hash, other `tabs.update` URLs and `{ active: true }` raise a notice and are handled, unknown schemes are notice only, `tabs.create` with a web URL is not intercepted; search raises "Searched for ... (the extension uses your default search engine)."). Create `tests/demo/intercept.test.ts` with **Property 5** (for any URL passed to `tabs.update`, no tab's `url` changes, no tab leaves the map, one notice is raised, except the two own-page URLs which change only the hash) and examples for `create` and search.
    - **Property 5: Intercepted navigation changes nothing**
    - **Validates: Requirements 5.10**
    - _Requirements: 5.5, 5.7, 5.10, 3.7_

- [x] 10. Router and shell
  - [x] 10.1 Create `demo/src/route.ts` with `resolveRoute(hash)` and `useRoute()` (hash listener, `history.replaceState` redirect from unknown or empty to `#/crypt`), and `demo/src/PopupPlaceholder.tsx` (360 by 520 frame, "The popup is not built yet."). Create `tests/demo/route.test.ts` with **Property 1** (the three exact hashes with an optional trailing slash resolve, every other string is `null`) and a test that an unknown hash is replaced by `#/crypt`.
    - **Property 1: Route resolution**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.6_
  - [x] 10.2 Create `demo/src/DemoShell.tsx` and `demo/src/demo.css`: banner text from Requirement 7.1, "Reset demo" button (`resetDemo(Date.now())` then bump an epoch that remounts the page, route kept), nav links, an `aria-live="polite"` notice area that hides after 4 seconds, and a page error boundary ("This demo page failed. Reset the demo."). Layout: `.demo-strip { flex: 0 0 auto }` above `.demo-frame { flex: 1 1 0; min-height: 0; display: flex; flex-direction: column; position: relative; overflow: hidden }`, with no `100vh` rule. Pages: `App` from `entrypoints/newtab/App`, `BloodBank`, `PopupPlaceholder`. Create `tests/demo/routes.test.tsx` (jsdom): each route shows the banner and its landmark (`main` for Crypt and Blood Bank, the placeholder text for the popup), a hash change switches pages and keeps the fake state, Blood Bank and the placeholder never call `canvas.getContext`, a throwing page shows the error text with Reset still present, and `demo.css` has no `100vh` and a flexible `.demo-frame`.
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 2.7, 7.1, 7.2, 7.4, 7.6, 7.7, 9.8, 11.3_

- [x] 11. Checkpoint - Ensure all tests pass
  - Run `npm run typecheck` and `npm test`. Ensure all tests pass, ask the user if questions arise.

- [x] 12. Startup wiring and end-to-end tests
  - [x] 12.1 Replace the placeholder in `demo/src/main.tsx` with the real startup, in this order: set `capabilities` to false, `installInterceptors`, `seedDemo(Date.now())` (`Date.now()` read at startup; the Reset handler reads it again when pressed), import `entrypoints/newtab/styles` and the Blood Bank CSS, then render `DemoShell`. Pages must not run before the seed.
    - _Requirements: 1.1, 1.6, 3.6, 4.7, 7.5, 8.2, 8.4_
  - [x] 12.2 Create `tests/demo/actions.test.tsx` (jsdom, real `lib/tabs.ts` on the seeded fake). Examples: Stake, Coffin, Crypt, Garlic, Resurrect and Dawn give the results in Requirements 5.1 to 5.6; search shows the notice and calls `search.query`; Add page adds a haunt up to `MAX_HAUNTS`; Blood Bank shows earlier stats and log; a card link shows a notice and keeps the hash; the badge count and stats update without a reload; Reset after Stake and Dawn restores the seeded card count and stats and keeps the route.
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 5.11, 7.3, 7.4, 11.4_

- [x] 13. Built-output scan
  - Create `tests/demo/built.test.ts` (skipped when `demo/dist` is missing). Scan every `.html`, `.js` and `.css` file for `https?://` addresses. Allowed: namespace URIs (`http://www.w3.org/`), the project's own repository links, and an allowlist of third-party strings that are never fetched, each entry with a one-line reason in a comment (library code is not stripped). Any other address fails the test. Also check: no `gstatic.com` or `suggestqueries.google.com`, `index.html` has no root-absolute `src` or `href`, and `demo/dist/models` has every file under `public/models`. Run `npm run demo:build` and then the test, and fix real remote addresses with a build transform like `noRemoteDraco`.
    - _Requirements: 8.1, 8.5, 8.6, 8.7, 9.1_

- [x] 14. GitHub Pages workflow
  - Create `.github/workflows/pages.yml` as in the design (triggers `push` to `main` and `workflow_dispatch`; permissions `contents: read`, `pages: write`, `id-token: write`; `build` job runs `npm ci`, `npm run demo:build`, `npm test`, `upload-pages-artifact` with `demo/dist`; `deploy` job needs `build` and uses `deploy-pages`; a comment names the Pages source "GitHub Actions"). Add a short "Web demo" section to `README.md` (scripts, the Pages source setting). Create `tests/demo/workflow.test.ts` with text checks on the YAML: both triggers, exactly the three permissions, `demo:build` and test steps before `upload-pages-artifact`, `deploy` needs `build`, and the "GitHub Actions" comment.
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 15. Final checkpoint - Ensure all tests pass
  - Run `npm run typecheck`, `npm test`, `npm run build` and `npm run demo:build`. Confirm the extension manifest is unchanged (same permissions, no host permissions) and `demo/dist` exists. Ensure all tests pass, ask the user if questions arise.
    - _Requirements: 1.3, 1.5, 11.2, 11.6_

## Notes

- Tests are part of each task and are not optional, to match the earlier specs. Property tests are tagged `Feature: web-demo, Property N: <text>` and run 100 times or more with fast-check.
- Requirement 11.5 (Playwright MCP check of the deployed demo) is a manual step after deploy, so it has no task. Record its result in this file when done.
- The Blood Bank CSS change in task 4.3 is a real change to the extension styles. The Crypt and Blood Bank look the same, and the page still never scrolls.
- Spec 6 later replaces `PopupPlaceholder` with the real popup.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "3", "4.1", "4.2", "4.3"] },
    { "id": 1, "tasks": ["1.2", "2.2"] },
    { "id": 2, "tasks": ["5"] },
    { "id": 3, "tasks": ["6", "7.1", "8", "9", "10.1"] },
    { "id": 4, "tasks": ["7.2", "10.2"] },
    { "id": 5, "tasks": ["11"] },
    { "id": 6, "tasks": ["12.1"] },
    { "id": 7, "tasks": ["12.2", "13", "14"] },
    { "id": 8, "tasks": ["15"] }
  ]
}
```
