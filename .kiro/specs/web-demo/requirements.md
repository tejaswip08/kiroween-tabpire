# Requirements Document

## Introduction

This spec (Spec 7 in the roadmap) adds a static web demo so judges can try Tabpire from a URL without installing the extension. A new `demo/` Vite build renders the real Crypt new tab page, the real Blood Bank page and the real popup, against a fake `browser` API kept in memory and seeded with about 20 sample tabs. The demo is deployed to GitHub Pages by a GitHub Actions workflow.

Scope notes, based on the code as it stands today:

- **Popup.** Spec 6 has not been built. There is no popup entrypoint, and `wxt.config.ts` has only `action: { default_title }`. The demo's `/#/popup` route shows a "not built yet" placeholder. Spec 6 builds the popup and adds it to this route. This spec does not build the popup.
- **Blood Bank.** The page is written inline in `entrypoints/bloodbank/main.tsx` and mounts itself. To reuse it without copying, it is moved into an exported component. The extension page behaviour stays identical.
- **Fake browser.** `tests/helpers/fakeBrowser.ts` is a test-only fake. The demo reuses its logic by moving the shared part into a module under `lib/` that both the tests and the demo import. The test-only knobs (failure switches, call log) stay available to tests.
- **Themes.** Spec 5 has not been built. The demo shows whatever theme support exists at build time and needs no theme work of its own.
- **Unchanged.** Hunger state names (awake, starving, asleep, protected) and Dawn safety rules are not changed by this spec. The Crypt looks the same, but its page frame CSS changes from `100vh` to fill-the-container (Requirement 7.6).

## Glossary

- **Demo**: the static web build in `demo/`, opened in an ordinary browser tab.
- **Fake_Browser**: an in-memory implementation of the parts of `browser` that Tabpire uses (tabs, storage, alarms, search, runtime, windows, action), shared with the unit tests.
- **Sample_Data**: the seeded tabs, haunts (pinned pages, type `Haunt`), crypt entries and garlic sites the Demo starts with.
- **Router**: the hash router that picks the page from `location.hash`.
- **Demo_Banner**: the notice shown at the top of every Demo page.
- **Reset_Button**: the "Reset demo" button.
- **Crypt_Page**: the real new tab page under `entrypoints/newtab/`.
- **Blood_Bank_Page**: the real Blood Bank page under `entrypoints/bloodbank/`.
- **Popup_Page**: the toolbar popup. Spec 6 builds it. Until then the route shows a placeholder.
- **Dawn**: the action that closes every starving tab at once, as defined in Spec 2.
- **Pages_Workflow**: the GitHub Actions workflow that deploys `demo/dist` to GitHub Pages.
- **Scene**: the WebGL background canvas and the shared portrait canvas of the Crypt_Page.

## Requirements

### Requirement 1: Demo build and scripts

**User Story:** As a developer, I want separate demo scripts, so that I can run and build the demo without touching the extension build.

#### Acceptance Criteria

1. THE Demo SHALL be a Vite project rooted in `demo/` that imports the Crypt_Page and Blood_Bank_Page components from the existing source, with no copied component files.
2. WHEN `npm run demo:dev` runs, THE Demo SHALL start a Vite dev server for `demo/`.
3. WHEN `npm run demo:build` runs, THE Demo SHALL write a static site to `demo/dist`.
4. THE Demo build SHALL use a relative base path, so every script, style, font and model address resolves when the site is served from a sub-path such as `/<repo>/`.
5. WHEN `npm run build` runs, THE extension build output SHALL stay unchanged by the presence of `demo/`.
6. THE Demo build SHALL replace the `wxt/browser` import with the Fake_Browser through a Vite alias, so no extension page or `lib/` module needs an `if (demo)` branch. The only extension-side seams are the shared `assetUrl` helper (which reads `import.meta.env.BASE_URL` only and does not call `browser.runtime.getURL`) and a `capabilities` object whose defaults keep the extension behaviour.

### Requirement 2: Routing

**User Story:** As a judge, I want a link for each page, so that I can open the Crypt, Blood Bank or popup directly.

#### Acceptance Criteria

1. WHEN `location.hash` is `#/crypt`, THE Router SHALL render the Crypt_Page.
2. WHEN `location.hash` is `#/bloodbank`, THE Router SHALL render the Blood_Bank_Page.
3. WHEN `location.hash` is `#/popup`, THE Router SHALL render the "not built yet" placeholder inside a frame sized like a toolbar popup. Spec 6 replaces the placeholder with the Popup_Page.
4. WHEN `location.hash` is empty or unknown, THE Router SHALL render the Crypt_Page and set the hash to `#/crypt`.
5. WHEN `location.hash` changes, THE Router SHALL switch pages without a full reload and without clearing the Fake_Browser state.
6. THE placeholder on `#/popup` SHALL say that the popup is not built yet.
7. THE Router SHALL render the Crypt_Page and Blood_Bank_Page from the same exported components the extension entrypoints use, and the extension pages SHALL behave as before.

### Requirement 3: Fake browser API

**User Story:** As a developer, I want one in-memory `browser` that tests and the demo share, so that both exercise the same behaviour.

#### Acceptance Criteria

1. THE Fake_Browser SHALL implement every `browser` member that `lib/` and the Crypt_Page, Blood_Bank_Page and Popup_Page call: `tabs` (get, getCurrent, query, update, remove, discard, create and the tab events), `storage.local` (get, set) with `storage.onChanged`, `alarms` (create, onAlarm), `search` (query), `runtime` (getURL, onInstalled, onStartup), `windows.update` and `action` (setBadgeText, setBadgeBackgroundColor).
2. THE Fake_Browser SHALL keep all data in memory and SHALL NOT write to `localStorage`, `sessionStorage`, IndexedDB or cookies.
3. WHEN `storage.local.set` changes a key, THE Fake_Browser SHALL fire `storage.onChanged` listeners with the new value.
4. WHERE automatic events are switched on (the Demo switches them on, the unit tests keep firing events by hand), WHEN `tabs.remove`, `tabs.discard`, `tabs.create` or `tabs.update` changes a tab, THE Fake_Browser SHALL fire the matching tab event.
5. THE Fake_Browser SHALL expose the failure switches and the call log that `tests/helpers/fakeBrowser.ts` offers today, so the existing tests pass without changes to their assertions. `tests/helpers/fakeBrowser.ts` stays as a re-export of the shared module.
6. WHEN `tabs.getCurrent` runs, THE Fake_Browser SHALL return the tab that shows the Crypt_Page.
7. WHEN `search.query` runs, THE Fake_Browser SHALL record the search text and SHALL NOT contact any server.

### Requirement 4: Sample data

**User Story:** As a judge, I want a believable set of tabs on first load, so that every state and action is visible at once.

#### Acceptance Criteria

1. WHEN the Demo starts, THE Sample_Data SHALL create between 18 and 22 tabs with realistic titles and https URLs.
2. THE Sample_Data SHALL include at least 5 awake tabs, at least 5 starving tabs idle between 1 and 5 days, exactly 1 tab playing sound, exactly 1 discarded tab, and at least 1 tab on a garlic site.
3. THE Sample_Data SHALL include at least 1 pinned tab and 1 tab with `active: true` that shows the Crypt_Page.
4. THE Sample_Data SHALL put at least 2 sites on the garlic list.
5. THE Sample_Data SHALL include between 3 and 6 haunts, which is no more than `MAX_HAUNTS`.
6. THE Sample_Data SHALL include between 2 and 5 crypt entries, so Resurrect works on first load.
7. THE Sample_Data SHALL set each tab's `lastAccessed` to the current time minus a fixed idle offset (hours or days). THE Demo SHALL compute it at startup and recompute it on Reset_Button, reading the current time at that moment, never a fixed or build-time timestamp, so the Demo looks the same whenever it is opened. Crypt entry `savedAt` values, log entry `at` values and every other dated Sample_Data value SHALL be relative to the same current time.
8. FOR ALL Sample_Data tabs, `lib/hunger.ts` SHALL classify the tab into exactly one of awake, starving, asleep or protected, and the counts SHALL match criterion 2.
9. THE Sample_Data SHALL include a few non-starving stats and log entries, so the Blood_Bank_Page is not empty on first load.

### Requirement 5: Every action works

**User Story:** As a judge, I want each button to do what it says, so that I can judge the product by using it.

#### Acceptance Criteria

1. WHEN a user chooses Stake on a card, THE Demo SHALL remove the tab from the Fake_Browser, update the stats and log, and remove the card from the Crypt_Page.
2. WHEN a user chooses Coffin on a card, THE Demo SHALL mark the tab discarded, and the card SHALL show the Asleep state.
3. WHEN a user chooses Crypt on a card, THE Demo SHALL save the tab to the crypt, remove the tab, and show the entry in the Blood_Bank_Page crypt list.
4. WHEN a user chooses Garlic on a card, THE Demo SHALL add the site to the garlic list, and every card of that site SHALL show the Protected state.
5. WHEN a user chooses Resurrect on a crypt entry, THE Demo SHALL create a tab from the entry and remove the entry from the crypt.
6. WHEN a user chooses Dawn, THE Demo SHALL save every starving tab to the crypt and close it.
7. WHEN a user submits a search, THE Demo SHALL call `search.query` on the Fake_Browser and SHALL show a notice with the search text instead of leaving the page.
8. WHEN a user adds a page through "Add page", THE Demo SHALL save a haunt and show it in the haunts row, up to `MAX_HAUNTS`.
9. WHEN a user opens Blood Bank from the Crypt_Page header, THE Router SHALL switch to `#/bloodbank` with the stats and log of earlier actions intact.
10. WHEN a user opens a card, a haunt or a crypt link that would navigate away, THE Demo SHALL show a notice and SHALL NOT leave the Demo page.
11. WHEN the Fake_Browser changes the tab list, THE Crypt_Page badge count and stats SHALL update without a reload.

### Requirement 6: Dawn safety in the fake browser

**User Story:** As a developer, I want Dawn's safety rules proven against the fake, so that the demo cannot show a destructive result.

#### Acceptance Criteria

1. WHEN Dawn runs against the Fake_Browser, THE Dawn action SHALL leave the active tab open.
2. WHEN Dawn runs against the Fake_Browser, THE Dawn action SHALL leave every pinned tab open.
3. WHEN Dawn runs against the Fake_Browser, THE Dawn action SHALL leave every audible tab open.
4. WHEN Dawn runs against the Fake_Browser, THE Dawn action SHALL leave every tab on a garlic site open.
5. WHEN Dawn runs against the Fake_Browser, THE Dawn action SHALL close every other starving tab and save each one to the crypt first.
6. FOR ALL generated sets of tabs, the tabs left open after Dawn SHALL include every active, pinned, audible and garlic tab (property test with fast-check).
7. FOR ALL generated action sequences on the Fake_Browser, THE stats `mbFreed` SHALL never decrease, and the crypt SHALL never hold two entries with the same URL.

### Requirement 7: Banner and reset

**User Story:** As a judge, I want to know it is a demo and be able to start over, so that I can try everything twice.

#### Acceptance Criteria

1. THE Demo_Banner SHALL appear on every Demo page and read "Demo: sample tabs, nothing leaves your browser. Install the extension for real tabs."
2. THE Demo_Banner SHALL keep the Crypt_Page header, cards and search box fully visible and usable.
3. WHEN a user chooses the Reset_Button, THE Demo SHALL restore the Fake_Browser, stats, log, crypt, haunts and garlic list to the Sample_Data, and SHALL recompute tab ages and every other dated value from the current time read when the Reset_Button is pressed, not from the time the Demo loaded.
4. WHEN a reset completes, THE Demo SHALL keep the current route.
5. WHEN a page is reloaded, THE Demo SHALL start from the Sample_Data.
6. THE Crypt_Page frame SHALL fill its container (the root element in the extension, the demo frame under the Demo_Banner in the Demo) instead of using its own viewport-height rule, so the Crypt_Page never scrolls with or without the Demo_Banner, and the extension keeps its no-scroll behaviour.
7. THE Blood_Bank_Page SHALL scroll inside its own container, and its styles SHALL NOT change the layout of the Crypt_Page when both are loaded in one document.

### Requirement 8: Nothing leaves the browser

**User Story:** As a judge, I want the demo to make no outside requests for tab data, so that the privacy claim holds in the demo too.

#### Acceptance Criteria

1. THE Demo SHALL make no network request to a host other than its own origin.
2. WHEN the user types in the search box, THE Demo SHALL show suggestions from open tabs, haunts and the crypt only, and SHALL NOT call `lib/google.ts` or `suggestqueries.google.com`.
3. THE Demo SHALL give each Sample_Data tab a bundled `data:image` icon, and SHALL NOT request an icon from any third-party host.
4. WHEN the Crypt_Page asks for a haunt icon, THE Demo SHALL use a bundled letter or generic icon and SHALL NOT request `/favicon.ico` from the haunt's site or `/_favicon/`.
5. THE Demo build SHALL bundle fonts, models and styles, and SHALL NOT load them from a CDN, including the Draco decoder address from the existing `noRemoteDraco` rule.
6. THE Demo SHALL include no analytics and no remote logging.
7. A test SHALL fail when a built Demo file contains an http or https address other than the project's own repository links, namespace URIs and third-party strings that are never fetched. Each such allowlisted string SHALL carry a one-line reason in the test, and library code SHALL NOT be stripped to avoid listing it.

### Requirement 9: 3D scene, assets and WebGL fallback

**User Story:** As a judge on any machine, I want the demo to load and stay usable, so that a missing GPU does not hide the product.

#### Acceptance Criteria

1. THE Demo build SHALL copy `public/models` into `demo/dist/models`, and every model address used by the Scene SHALL resolve under the relative base.
2. THE Demo SHALL load models through a base-aware path helper, so the same Scene code works at `/models/...` in the extension and under a sub-path on GitHub Pages.
3. THE Demo SHALL render the real Scene and portrait canvases on the Crypt_Page.
4. IF WebGL is not available, THEN THE Crypt_Page SHALL show the same flat fallback background and card portraits that the extension shows, and every action SHALL keep working.
5. IF the WebGL context is lost, THEN THE Demo SHALL handle it through the existing `webglcontextlost` and `webglcontextrestored` handling, and SHALL NOT show a blank page.
6. IF a model file fails to load, THEN THE Crypt_Page SHALL stay usable and SHALL show the existing layer error state.
7. WHEN the Crypt_Page is shown, THE Demo SHALL keep the existing performance rules: background dpr 1 without antialias, portrait dpr up to 1.25 with antialias.
8. WHERE the Blood_Bank_Page or Popup_Page has no 3D content, THE Demo SHALL render them without creating a WebGL context.

### Requirement 10: GitHub Pages deployment

**User Story:** As a maintainer, I want a push to publish the demo, so that judges always see the latest version.

#### Acceptance Criteria

1. WHEN a commit is pushed to the default branch, THE Pages_Workflow SHALL install dependencies, run the tests, run `npm run demo:build` and deploy `demo/dist` to GitHub Pages.
2. THE Pages_Workflow SHALL allow a manual run through `workflow_dispatch`.
3. THE Pages_Workflow SHALL request only the permissions `contents: read`, `pages: write` and `id-token: write`.
4. IF the tests or the build fail, THEN THE Pages_Workflow SHALL stop without deploying.
5. THE Pages_Workflow SHALL be stored in `.github/workflows/`, and the README or workflow comments SHALL state that Pages must be set to the "GitHub Actions" source.

### Requirement 11: Verification

**User Story:** As a maintainer, I want the demo checked automatically and by hand, so that regressions do not reach judges.

#### Acceptance Criteria

1. THE test suite SHALL cover the Fake_Browser with unit tests for tabs, storage events, alarms, search and runtime.
2. THE test suite SHALL pass the existing tests unchanged after the Fake_Browser moves to its shared module.
3. THE test suite SHALL mount each Demo route in jsdom and check that the Demo_Banner and the page's main landmark appear.
4. THE test suite SHALL check that Reset_Button restores the Sample_Data after Stake and Dawn.
5. WHEN the Demo is deployed, THE maintainer SHALL use the Playwright MCP to open the Demo and check that each action, search, Add page, Blood Bank and Reset work (manual check, recorded in the tasks).
6. WHEN `npm run typecheck` runs, THE Demo source SHALL pass strict TypeScript with no errors.
