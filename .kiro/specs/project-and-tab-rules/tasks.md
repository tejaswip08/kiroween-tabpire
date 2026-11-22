# Tasks: Project and tab rules (Spec 1)

Each task is small enough to finish and check on its own. Requirement numbers refer to `requirements.md`.

- [x] 1. Set up the project
  - [x] 1.1 Create `package.json` with WXT, React 19, `react-dom`, TypeScript, Vitest and fast-check, plus scripts `dev`, `build`, `build:firefox`, `typecheck` (`wxt prepare && tsc --noEmit`) and `test` (`vitest run`). Run `npm install`.
    - _Requirements: 1.1, 1.4, 1.8_
  - [x] 1.2 Create `tsconfig.json` extending `.wxt/tsconfig.json` with `strict: true`, and `vitest.config.ts` (Node environment, `tests/**/*.test.ts`).
    - _Requirements: 1.1, 6.1_
  - [x] 1.3 Create `wxt.config.ts` with name, the tagline as description, permissions `tabs`, `storage`, `alarms`, `search` (no host permissions), Manifest V3, and the placeholder Firefox add-on id.
    - _Requirements: 1.1, 1.2, 1.7, 1.9_
  - [x] 1.4 Add a `.gitignore` for `node_modules`, `.output` and `.wxt`.

- [x] 2. Placeholder new tab page
  - [x] 2.1 Create `entrypoints/newtab/index.html`, `main.tsx`, `App.tsx` and `style.css`. The page renders the tagline only, in plain CSS with no UI library.
    - _Requirements: 1.3, 1.6_
  - [x] 2.2 Run `npm run typecheck`, then `npm run build` and `npm run build:firefox`. Confirm both manifests are MV3, contain only the four permissions, and set the new tab override.
    - _Requirements: 1.1 to 1.4_

- [x] 3. Pure rules in `lib/hunger.ts`
  - [x] 3.1 Add the types (`VampireState`, `TabInfo`) and `DAY_MS`. Implement `siteOf` (http and https only, `www.` stripped, `null` otherwise, never throws).
    - _Requirements: 5.1, 5.2_
  - [x] 3.2 Implement `hungerMs(tab, now)`.
    - _Requirements: 3.1 to 3.4_
  - [x] 3.3 Implement `stateOf(tab, garlic, now)` as the single `if` chain from the design.
    - _Requirements: 2.1 to 2.7_
  - [x] 3.4 Implement the memory table with all 15 sites, matching an exact hostname or a parent domain. Add the URL fallback heuristics (80, 300, 250, 150).
    - _Requirements: 4.1 to 4.3_
  - [x] 3.5 Implement `fnv1a32`, `estimateMb` (discarded gives 0, ±15% variation, round to 5, never negative) and `formatMb` (always starts with `~`).
    - _Requirements: 4.4 to 4.9_

- [x] 4. Property-based tests in `tests/hunger.test.ts`
  - [x] 4.1 Add the shared arbitraries (`tabArb`, `garlicArb`, `nowArb`).
    - _Requirements: 6.1_
  - [x] 4.2 Test that every tab has exactly one state, using a reference classifier that evaluates each predicate separately. Test garlic gives protected, discarded non-garlic gives asleep, and absent `lastAccessed` gives awake.
    - _Requirements: 2.1 to 2.6, 6.2_
  - [x] 4.3 Test that the estimate is stable, never negative, a multiple of 5, 0 when discarded, and within ±15% of base plus 2.5 MB of rounding slack. Test `formatMb` always starts with `~`.
    - _Requirements: 4.4 to 4.8, 6.3_
  - [x] 4.4 Test that hunger never goes down for an unused tab as time increases, is never negative, and is 0 for active or audible tabs.
    - _Requirements: 3.2 to 3.4, 6.4_
  - [x] 4.5 Add example tests: every table site is within its band, subdomain matching (`m.youtube.com` matches, `calendar.google.com` does not match `docs.google.com`), `www.` stripping, and the 1 day boundary (exactly 1 day is starving, 1 ms less is awake).
    - _Requirements: 2.4, 2.5, 4.2_
  - [x] 4.6 Add the purity text check: `lib/hunger.ts` contains no `wxt/browser`, `browser.`, `chrome.`, `Date.now` or `new Date(`.
    - _Requirements: 5.2, 5.3_
  - [x] 4.7 Run `npm test` and confirm all tests pass.
    - _Requirements: 6.5_

- [x] 5. Storage in `lib/store.ts`
  - [x] 5.1 Add the data types, defaults, `tabpire:` keys and type-guard validators for the six kinds.
    - _Requirements: 7.2, 7.3, 7.4_
  - [x] 5.2 Implement the `store` object with a getter and setter for each kind, using `browser.storage.local` imported from `wxt/browser`. Let storage errors propagate; return the default for a missing or invalid value.
    - _Requirements: 7.1 to 7.6_
  - [x] 5.3 Write `tests/store.test.ts` with an in-memory fake of `storage.local` (`vi.mock('wxt/browser')`). Check defaults when empty, round trips, and defaults for wrong-shaped values.
    - _Requirements: 7.3 to 7.5_
  - [x] 5.4 Add the text check that no file under `lib/` other than `store.ts`, and none under `entrypoints/`, mentions `storage.local`, and that `store.ts` has no `storage.sync`, `fetch` or `XMLHttpRequest`.
    - _Requirements: 1.7, 7.1, 7.6_

- [x] 6. Final check
  - [x] 6.1 Run `npm run typecheck`, `npm test`, `npm run build` and `npm run build:firefox`. All must pass.
    - _Requirements: 1.4, 1.8, 6.5_
