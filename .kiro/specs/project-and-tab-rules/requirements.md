# Requirements: Project and tab rules (Spec 1)

## Introduction

Tabpire is a Chrome and Firefox extension that replaces the new tab page. It treats every open tab as a "vampire" that drains memory. This spec covers the project setup, the pure tab rules in `lib/hunger.ts`, and the storage layer in `lib/store.ts`. Tab actions, Dawn, the badge, the Crypt page, themes, popup, demo and accounts belong to later specs and are out of scope.

## Glossary

- **Tab**: an open browser tab as reported by the `tabs` API.
- **Vampire**: Tabpire's name for a tab. Every tab is exactly one vampire.
- **Hunger**: the time a tab has been idle, measured in milliseconds.
- **Garlic list**: the set of sites the user marked as protected.
- **Crypt**: the list of tabs the user saved for later.

## Assumptions (please confirm or change)

1. **State precedence.** When more than one rule could apply, the first match wins: Protected, then Asleep, then Awake, then Starving. A garlic site stays Protected even when discarded. A discarded tab stays Asleep even if its last-used time is old.
2. **Awake means** active, audible, or last used less than 24 hours ago. Starving means none of those and idle 24 hours or more.
3. **A site** is identified by its hostname, with a leading `www.` removed.
4. **Tabs without a usable URL** (for example `chrome://` or `about:` pages, or no URL) use the fallback memory estimate and are never given a site entry in the garlic list.
5. **Tooling:** Node with npm. Scripts `typecheck` and `test` must exist, because two save hooks already call them.

## Requirements

### Requirement 1: Extension project

**User story:** As a user, I want Tabpire to open as my new tab page in Chrome and Firefox, so that I see my tabs every time I open one.

#### Acceptance criteria

1. THE project SHALL be a WXT extension using Manifest V3, React 19 and strict TypeScript.
2. THE manifest SHALL request exactly these permissions: `tabs`, `storage`, `alarms`, `search`.
3. THE extension SHALL override the new tab page with a Tabpire page.
4. THE project SHALL build for both Chrome and Firefox.
5. THE source SHALL import the browser API from `wxt/browser`.
6. THE UI SHALL use plain CSS with no UI component library.
7. THE manifest SHALL declare no host permissions and no network permissions, and the code SHALL make no network requests with tab data.
8. THE project SHALL define `npm run typecheck` and `npm test` scripts.
9. THE project tagline "Your tabs are draining you. Stake them." SHALL appear in the extension description.

### Requirement 2: Tab states

**User story:** As a user, I want each tab to have one clear state, so that I can see which tabs are costing me memory.

#### Acceptance criteria

1. THE state function SHALL return exactly one of: Awake, Starving, Asleep, Protected, for every possible tab input.
2. WHEN the tab's site is on the garlic list, THE state function SHALL return Protected.
3. WHEN the tab is discarded and its site is not on the garlic list, THE state function SHALL return Asleep.
4. WHEN the tab is active, audible, or was last used less than 1 day before the supplied current time, and the tab is neither Protected nor Asleep, THE state function SHALL return Awake.
5. WHEN the tab was last used 1 day or more before the supplied current time, and is not active, audible, discarded or on the garlic list, THE state function SHALL return Starving.
6. WHEN a tab has no last-used time, THE state function SHALL treat its idle time as unknown and return Awake, so that Tabpire never marks a tab Starving without evidence.
7. THE state function SHALL accept the current time as a parameter.

### Requirement 3: Hunger

**User story:** As a user, I want a hunger value for each tab, so that I can tell which tabs have been idle longest.

#### Acceptance criteria

1. THE hunger function SHALL return the idle time in milliseconds, computed from the supplied current time and the tab's last-used time.
2. THE hunger value SHALL never be negative. IF the last-used time is later than the current time, THEN THE hunger function SHALL return 0.
3. WHILE a tab stays unused, THE hunger value SHALL not decrease as the supplied current time increases.
4. WHEN the tab is active or audible, THE hunger function SHALL return 0.

### Requirement 4: Memory estimate

**User story:** As a user, I want an approximate memory figure per tab, so that I can see how much each vampire drains.

#### Acceptance criteria

1. THE estimate function SHALL base its value on the tab's site.
2. THE estimate function SHALL use these base values for known heavy sites: chatgpt.com about 520 MB and claude.ai about 450 MB. It SHALL also include base values for YouTube, Figma and Gmail.
3. WHEN the site is not a known heavy site, THE estimate function SHALL fall back to URL heuristics.
4. THE estimate function SHALL vary the base value by at most ±15%, using a hash of a stable tab identifier.
5. THE estimate SHALL be the same every time it is computed for the same tab and the same inputs.
6. THE estimate SHALL be rounded to the nearest 5 MB and SHALL never be negative.
7. WHEN the tab is discarded, THE estimate function SHALL return about 0 MB.
8. THE display formatter SHALL always prefix the estimate with "~", for example "~520 MB".
9. THE estimate function SHALL use no browser APIs and no `Date.now()`.

### Requirement 5: Pure rules module

**User story:** As a developer, I want the rules isolated from the browser, so that they are easy to test.

#### Acceptance criteria

1. THE file `lib/hunger.ts` SHALL contain all state, hunger and memory-estimate rules.
2. THE file `lib/hunger.ts` SHALL not import or reference any browser API.
3. THE file `lib/hunger.ts` SHALL not call `Date.now()` or `new Date()` without an argument. All time SHALL be passed in.

### Requirement 6: Property-based tests

**User story:** As a developer, I want property-based tests for the rules, so that edge cases are found automatically.

#### Acceptance criteria

1. THE tests SHALL use Vitest and fast-check.
2. THE tests SHALL check that every generated tab has exactly one state.
3. THE tests SHALL check that the estimate is stable for the same input and is never negative.
4. THE tests SHALL check that hunger never goes down while a tab stays unused.
5. THE tests SHALL live under `tests/` and SHALL run with `npm test`.

### Requirement 7: Local storage layer

**User story:** As a user, I want my data kept on my device, so that my tab data never leaves the browser.

#### Acceptance criteria

1. THE file `lib/store.ts` SHALL be the only module that reads or writes `browser.storage.local`.
2. THE store SHALL hold: stats, action log, crypt (saved tabs), garlic sites, pinned pages, and theme.
3. WHEN a key has no stored value, THE store SHALL return a defined default for it.
4. IF a stored value has an unexpected shape, THEN THE store SHALL return the default for that key instead of throwing.
5. THE store SHALL offer read and write functions for each of the six data kinds.
6. THE store SHALL use `browser.storage.local` only, and SHALL not use `storage.sync` or any network call.
