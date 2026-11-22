# Requirements: Tab actions, Dawn, badge (Spec 2)

## Introduction

This spec adds the six tab actions (Stake, Coffin, Crypt, Garlic, Un-garlic, Resurrect), the Dawn bulk action, the memory "reclaimed" counter with its action log, and a background script that shows the starving count on the toolbar badge. The code lives in `lib/tabs.ts` and a background entrypoint. It builds on `lib/hunger.ts` and `lib/store.ts` from Spec 1. The new tab page, buttons and tooltips belong to Spec 3 and are out of scope here.

## Glossary

- **Starving tab**: a tab whose state is Starving, as defined in Spec 1.
- **Reclaimed**: the running total of estimated memory freed by actions, stored as `mbFreed` in the stats.
- **Action log**: the list of past actions kept by `lib/store.ts`.
- **Crypt**: the saved-tab list kept by `lib/store.ts`.
- **Dawn target**: a tab that Dawn is allowed to close.

## Assumptions (please confirm or change)

1. **Reclaimed per action.** Stake, Coffin, Crypt and each Dawn-closed tab add that tab's estimated memory, computed before the action. Garlic, Un-garlic and Resurrect free nothing, so they add 0 MB. They are still written to the action log.
2. **Un-garlic is included.** Garlic adds a site to the garlic list, and Un-garlic removes it. The roadmap lists only Garlic, so Un-garlic is an addition you requested. It takes a hostname, not a tab, so a later spec can call it from a list of protected sites.
3. **Active tab.** Coffin cannot discard the active tab, because browsers refuse. Coffin on such a tab returns a "not allowed" result and changes nothing. Stake and Crypt on the active tab work, since the user chose them directly.
4. **Dawn skips tabs without an http or https URL.** Pages like `chrome://` or `about:` cannot be reliably reopened from the crypt. Dawn also skips every tab with `active: true` in any window, which is stricter than "the active tab" in the roadmap.
5. **Save before close.** Crypt and Dawn write to the crypt first. A tab is closed only after its save succeeded. If the save fails, the tab stays open.
6. **Resurrect order.** Resurrect opens the tab first, then removes the item from the crypt. If opening fails, the item stays in the crypt. The reopened tab opens in the background, so it does not steal focus from the Crypt page.
7. **Dawn stats.** One Dawn run adds 1 to `dawns`, adds the number of saved tabs to `crypted`, and adds their total estimate to `mbFreed`. It writes one log entry per closed tab, each with action `dawn`.
8. **Log size.** The action log keeps the newest 200 entries, so storage does not grow without limit.
9. **Spec 1 change.** `TabInfo` gains a `pinned: boolean` field, because Dawn needs it. The Spec 1 tests are updated to generate it.
10. **Badge.** The badge shows the number of starving tabs, with "999+" for larger counts. It is blank when the count is 0. It refreshes when the extension starts, every minute through an alarm, and after each action.

## Requirements

### Requirement 1: Stake

**User story:** As a user, I want to close a tab with one action, so that its memory is freed.

#### Acceptance criteria

1. WHEN Stake runs on a tab, THE system SHALL close that tab.
2. WHEN Stake succeeds, THE system SHALL add the tab's estimated memory to reclaimed, add 1 to `staked`, and write an action log entry with action `stake`.
3. IF the tab no longer exists, THEN THE system SHALL return a failed result and SHALL NOT change stats or log.

### Requirement 2: Coffin

**User story:** As a user, I want to discard a tab without closing it, so that I free memory but can come back to it.

#### Acceptance criteria

1. WHEN Coffin runs on a tab, THE system SHALL discard that tab.
2. WHEN Coffin succeeds, THE system SHALL add the tab's estimated memory, computed before the discard, to reclaimed, add 1 to `coffined`, and write a log entry with action `coffin`.
3. IF the tab is active, already discarded, or no longer exists, THEN THE system SHALL return a failed result and SHALL NOT change stats or log.

### Requirement 3: Crypt

**User story:** As a user, I want to save a tab and close it, so that I can reopen it later.

#### Acceptance criteria

1. WHEN Crypt runs on a tab with an http or https URL, THE system SHALL save its URL, title, a unique id and the save time to the crypt, and only then close the tab.
2. WHEN Crypt succeeds, THE system SHALL add the tab's estimated memory to reclaimed, add 1 to `crypted`, and write a log entry with action `crypt`.
3. IF saving to the crypt fails, THEN THE system SHALL leave the tab open and return a failed result.
4. IF the tab has no http or https URL, THEN THE system SHALL return a failed result and SHALL NOT change anything.
5. IF the same URL is already in the crypt, THEN THE system SHALL still close the tab, SHALL NOT add a duplicate item, and SHALL count the action as normal.

### Requirement 4: Garlic

**User story:** As a user, I want to protect a whole site, so that none of its tabs are ever starved or closed by Dawn.

#### Acceptance criteria

1. WHEN Garlic runs on a tab, THE system SHALL add the tab's site, as defined by `siteOf` in Spec 1, to the garlic list.
2. WHEN Garlic succeeds, THE system SHALL write a log entry with action `garlic` and SHALL add 0 MB to reclaimed.
3. IF the site is already in the garlic list, THEN THE system SHALL NOT add a duplicate, SHALL write no log entry, and SHALL return a successful result that says nothing changed.
4. IF the tab has no site, THEN THE system SHALL return a failed result and SHALL NOT change anything.
5. AFTER Garlic, every open tab on that site SHALL have the state Protected.

### Requirement 5: Un-garlic

**User story:** As a user, I want to remove protection from a site, so that its tabs can starve and be closed again.

#### Acceptance criteria

1. WHEN Un-garlic runs on a site that is in the garlic list, THE system SHALL remove that site from the garlic list.
2. WHEN Un-garlic succeeds, THE system SHALL write a log entry with action `ungarlic` and SHALL add 0 MB to reclaimed.
3. IF the site is not in the garlic list, THEN THE system SHALL return a failed result and SHALL NOT change anything.
4. THE action SHALL accept a site (hostname) so that it can be run from a tab or from a list of protected sites in a later spec.
5. AFTER Un-garlic, open tabs on that site SHALL be classified by the normal rules, and no longer be Protected.

### Requirement 6: Resurrect

**User story:** As a user, I want to reopen a saved tab, so that I can get back to it.

#### Acceptance criteria

1. WHEN Resurrect runs on a crypt item, THE system SHALL open a new background tab with the item's URL.
2. WHEN the tab opens successfully, THE system SHALL remove the item from the crypt and write a log entry with action `resurrect`.
3. IF opening the tab fails, THEN THE system SHALL keep the item in the crypt and return a failed result.
4. IF the item is not in the crypt, THEN THE system SHALL return a failed result.
5. THE system SHALL add 0 MB to reclaimed for Resurrect.

### Requirement 7: Dawn

**User story:** As a user, I want to close all starving tabs at once without losing them, so that I can clean up in one click.

#### Acceptance criteria

1. WHEN Dawn runs, THE system SHALL read the current tabs at that moment, and SHALL NOT rely on an earlier list.
2. THE Dawn targets SHALL be exactly the tabs that are Starving, are not pinned, and have an http or https URL.
3. THE system SHALL NEVER include in Dawn targets any tab that is active, pinned, audible, discarded, or on a garlic site.
4. THE system SHALL save every target to the crypt before closing any of them.
5. IF saving to the crypt fails, THEN THE system SHALL close no tabs and return a failed result.
6. WHEN Dawn succeeds, THE system SHALL close each target, add the total of their estimated memory to reclaimed, update stats as in assumption 7, and write one log entry per closed tab.
7. IF there are no targets, THEN THE system SHALL change nothing and return a successful result with zero tabs closed.
8. THE target selection SHALL be a pure function with no browser APIs, so it can be tested on its own.

### Requirement 8: Reclaimed counter and action log

**User story:** As a user, I want a running total and a history of what Tabpire did, so that I can see its effect.

#### Acceptance criteria

1. THE system SHALL keep the reclaimed total as `mbFreed` in the stats and SHALL never decrease it.
2. EVERY action that succeeds SHALL write at least one log entry with the time, action name, site, and tab title when one exists.
3. THE action log SHALL keep only the newest 200 entries.
4. WHEN actions run in quick succession, THE system SHALL NOT lose any stats or log update.
5. THE system SHALL access storage only through `lib/store.ts`.

### Requirement 9: Starving badge

**User story:** As a user, I want to see how many tabs are starving without opening Tabpire, so that I know when to run Dawn.

#### Acceptance criteria

1. A background script SHALL show the number of starving tabs as the toolbar badge text.
2. WHEN the count is 0, THE badge text SHALL be empty.
3. WHEN the count is above 999, THE badge text SHALL be "999+".
4. THE background script SHALL refresh the badge when the extension starts, when installed, and every 1 minute through an alarm.
5. THE system SHALL refresh the badge after each action finishes.
6. THE badge count SHALL use the same state rules as the rest of the extension, with the garlic list from the store and the current time passed in.
7. THE manifest SHALL NOT gain any permission beyond `tabs`, `storage`, `alarms` and `search`.

### Requirement 10: Tests

**User story:** As a developer, I want Dawn's safety rules proven by tests, so that it can never close the wrong tab.

#### Acceptance criteria

1. A property-based test SHALL show that for any generated tabs and garlic list, no Dawn target is active, pinned, audible, discarded, on a garlic site, or lacking an http or https URL.
2. A property-based test SHALL show that every tab that is Starving, not pinned and has an http or https URL is a Dawn target.
3. A test with a fake browser SHALL show that Dawn closes only the targets, saves each target to the crypt before closing, and closes nothing when saving fails.
4. TESTS SHALL cover each action's success and failure paths, the stats and log changes, and the log cap.
5. THE tests SHALL run with `npm test` and SHALL pass alongside the Spec 1 tests.
