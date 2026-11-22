# Tasks: Tab actions, Dawn, badge (Spec 2)

Each task is small enough to finish and check on its own. Requirement numbers refer to `requirements.md`. After each task, `npm run typecheck` and `npm test` must pass.

- [x] 1. Pure rules in `lib/hunger.ts`
  - [x] 1.1 Add `pinned: boolean` to `TabInfo`. Update `tests/hunger.test.ts` so `tabArb` and the `tab()` helper generate it.
    - _Requirements: 7.3_
  - [x] 1.2 Add `isDawnTarget`, `dawnTargets`, `countStarving` and `badgeText`.
    - _Requirements: 7.2, 7.3, 7.8, 9.2, 9.3, 9.6_
  - [x] 1.3 Create `tests/dawn.test.ts` with property tests: no target is active, pinned, audible, discarded, on a garlic site or without a web URL (checked from the tab fields); every starving, unpinned, web-URL tab is a target; targets are an ordered subset of the input; `countStarving` matches the state; `badgeText` for 0, up to 999 and above.
    - _Requirements: 7.2, 7.3, 9.2, 9.3, 9.6, 10.1, 10.2_

- [x] 2. Storage lock in `lib/store.ts`
  - [x] 2.1 Add `transact(fn)` using `navigator.locks` with a promise-chain fallback. Add a test that overlapping transactions run one at a time, including when one throws.
    - _Requirements: 8.4_

- [x] 3. Actions in `lib/tabs.ts`
  - [x] 3.1 Create `lib/tabs.ts` with the result types, `toTabInfo` and `recordActions` (stats delta, `mbFreed`, log append, newest 200 kept, all under `transact`). Create `lib/badge.ts` with `refreshBadge`.
    - _Requirements: 8.1 to 8.5, 9.1, 9.6_
  - [x] 3.2 Create the fake browser for tests (`tabs`, `storage.local`, `action`, `alarms`, with failure switches and a call log) in `tests/helpers/fakeBrowser.ts`, mocked through `vi.mock('wxt/browser')`.
    - _Requirements: 10.3_
  - [x] 3.3 Implement `stake` and `coffin`, then tests: success updates tab, stats, `mbFreed` and log; a missing tab, an active tab or a discarded tab for Coffin and a thrown browser error change nothing.
    - _Requirements: 1.1 to 1.3, 2.1 to 2.3, 10.4_
  - [x] 3.4 Implement `crypt`, then tests: saves before closing, no duplicate URL, non-web URL fails, save failure leaves the tab open.
    - _Requirements: 3.1 to 3.5, 10.4_
  - [x] 3.5 Implement `garlic` and `ungarlic`, then tests: adds and removes the site, repeat Garlic returns "nothing changed" with no log row, Un-garlic of an unknown site fails, tabs on the site become protected and then normal again.
    - _Requirements: 4.1 to 4.5, 5.1 to 5.5, 10.4_
  - [x] 3.6 Implement `resurrect`, then tests: opens a background tab then removes the item, create failure keeps the item, unknown id fails, 0 MB reclaimed.
    - _Requirements: 6.1 to 6.5, 10.4_
  - [x] 3.7 Add tests for the log cap at 200, `mbFreed` never decreasing, every success writing a log entry, and ten simultaneous actions losing no update.
    - _Requirements: 8.1 to 8.4, 10.4_

- [x] 4. Dawn
  - [x] 4.1 Implement `dawn` as designed: fresh read, targets, save all, per-tab recheck, close with `allSettled`, remove crypt copies of skipped tabs, record, refresh badge.
    - _Requirements: 7.1 to 7.7_
  - [x] 4.2 Add fake-browser tests: closes only targets; every crypt write comes before any `remove`; a crypt write failure closes nothing; a tab that became active between query and close is skipped and its crypt copy removed; no targets gives zero with no writes; stats, `mbFreed` and one log row per closed tab are correct.
    - _Requirements: 7.1 to 7.7, 10.3_

- [x] 5. Badge and background script
  - [x] 5.1 Create `entrypoints/background.ts` with `defineBackground`: the one-minute `tabpire-badge` alarm, an `onAlarm` listener, `onInstalled` and `onStartup` listeners, and a refresh at load. Listeners are registered synchronously.
    - _Requirements: 9.1, 9.4_
  - [x] 5.2 Add tests: `refreshBadge` sets empty text for 0, the count for a few, and "999+" above 999; each action triggers a refresh; a failing refresh does not break an action. Add a text check that the background file creates the alarm and registers the three listeners.
    - _Requirements: 9.1 to 9.6_

- [x] 6. Final check
  - [x] 6.1 Run `npm run typecheck`, `npm test`, `npm run build` and `npm run build:firefox`. Confirm both manifests still list only `tabs`, `storage`, `alarms` and `search`, and have no host permissions.
    - _Requirements: 9.7, 10.5_
