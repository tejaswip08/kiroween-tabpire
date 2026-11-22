# Design: Tab actions, Dawn, badge (Spec 2)

## Overview

Spec 2 adds three pieces on top of Spec 1:

1. Pure additions to `lib/hunger.ts`: Dawn target selection, the starving count and the badge text.
2. `lib/tabs.ts`: the six actions and Dawn. It is the only code that changes tabs. It reads and writes data through `lib/store.ts`.
3. A background script and `lib/badge.ts` that keep the toolbar badge current.

No new permissions, no network use. The new tab page and buttons are Spec 3.

## File changes

```
lib/hunger.ts          + pinned on TabInfo, isDawnTarget, dawnTargets, countStarving, badgeText
lib/store.ts           + transact() lock helper
lib/tabs.ts            new: actions, Dawn, recording
lib/badge.ts           new: refreshBadge()
entrypoints/background.ts   new: alarm, startup and install hooks
tests/hunger.test.ts   updated: generate `pinned`
tests/dawn.test.ts     new: property tests for target selection and badge helpers
tests/tabs.test.ts     new: actions and Dawn against a fake browser
```

## Changes to `lib/hunger.ts` (still pure)

```ts
export interface TabInfo { /* Spec 1 fields */ pinned: boolean; }

export function isDawnTarget(tab: TabInfo, garlic: readonly string[], now: number): boolean {
  return (
    siteOf(tab.url) !== null &&          // http or https only
    !tab.pinned &&
    stateOf(tab, garlic, now) === 'starving'
  );
}

export function dawnTargets<T extends TabInfo>(tabs: readonly T[], garlic: readonly string[], now: number): T[] {
  return tabs.filter((t) => isDawnTarget(t, garlic, now));
}

export function countStarving(tabs: readonly TabInfo[], garlic: readonly string[], now: number): number {
  return tabs.filter((t) => stateOf(t, garlic, now) === 'starving').length;
}

export function badgeText(count: number): string {
  return count <= 0 ? '' : count > 999 ? '999+' : String(count);
}
```

The Dawn safety rule rests on `stateOf`. A Starving result already excludes active, audible, discarded and garlic tabs (Spec 1 precedence). `isDawnTarget` adds the two Dawn-only rules: not pinned, and a web URL. The property test checks the safety rules directly against the tab fields, so it does not just repeat the implementation.

Pinned tabs are counted by the badge as starving if they have been idle for a day. The badge describes tab state, and Dawn is stricter. This keeps the badge number equal to what Spec 3 shows as "starving".

## Changes to `lib/store.ts`

One new export:

```ts
export function transact<T>(fn: () => Promise<T>): Promise<T>
```

It runs `fn` while holding a lock, so read-modify-write sequences on stats, log, crypt and garlic do not lose updates.

- Primary: the Web Locks API, `navigator.locks.request('tabpire-store', fn)`. Locks are shared across the new tab page, popup and background script, so it covers every context that writes.
- Fallback when `navigator.locks` is missing (for example, in tests): a promise chain inside the current context.
- Rule: `fn` must not call `transact` again, since that would wait on its own lock. Each action takes the lock once for its writes.

## `lib/tabs.ts`

### Results

```ts
export type FailReason =
  | 'no-tab' | 'not-allowed' | 'no-site' | 'not-found' | 'save-failed' | 'browser-error';

export type ActionResult =
  | { ok: true; changed: boolean; mb: number }
  | { ok: false; reason: FailReason };

export type DawnResult =
  | { ok: true; closed: number; mb: number }
  | { ok: false; reason: FailReason };
```

`changed` is false only when Garlic finds the site already protected. Actions never throw to the caller. They catch browser and storage errors and return `ok: false`.

### Mapping a browser tab

`toTabInfo(tab)` converts a `browser.tabs.Tab` into `TabInfo`: `id`, `url`, `active`, `audible` (`tab.audible === true`), `discarded` (`tab.discarded === true`), `pinned`, `lastAccessed`. Tabs without an `id` are skipped everywhere.

### Recording

One helper writes stats and log together under one lock, so Spec 3's counters and history always agree:

```ts
recordActions(rows: { action: string; site: string | null; title?: string; mb: number }[], delta: Partial<Stats>, now: number)
```

Inside `transact`: read stats and log; add each delta field; add `sum(rows.mb)` to `mbFreed`; append one entry per row with `at: now`; keep the newest 200 entries (`slice(-200)`); write both. The log is stored oldest first. `mbFreed` only ever receives non-negative numbers.

### Actions

All actions take an optional `now` (default `Date.now()`) so tests control time. Memory is always estimated with `estimateMb(toTabInfo(tab))` before the action changes the tab. After a success, each action calls `refreshBadge()` and ignores its errors.

| Action | Steps | Failure |
| --- | --- | --- |
| `stake(tabId)` | `tabs.get`, estimate, `tabs.remove`, record `{staked: 1}` with action `stake`. | `no-tab` if the tab is gone, `browser-error` if removing throws. Nothing recorded. |
| `coffin(tabId)` | `tabs.get`. Refuse if `active` or `discarded`. Estimate, `tabs.discard`, record `{coffined: 1}`. | `no-tab`, `not-allowed`, `browser-error`. Nothing recorded. |
| `crypt(tabId)` | `tabs.get`. Need a site (`siteOf`). In `transact`: read crypt, add `{id: crypto.randomUUID(), url, title, savedAt: now}` unless that URL is already saved, write. Then `tabs.remove`. Record `{crypted: 1}`. | `no-tab`, `no-site` (not a web URL), `save-failed` (tab stays open), `browser-error` (item stays saved, tab stays open). |
| `garlic(tabId)` | `tabs.get`, need a site. In `transact`: add to garlic list if absent. Record with 0 MB only when added. | `no-tab`, `no-site`. Already protected returns `ok: true, changed: false` with no log entry. |
| `ungarlic(site)` | In `transact`: remove the site from the garlic list. Record action `ungarlic` with 0 MB. | `not-found` if the site is not in the list. |
| `resurrect(itemId)` | Read crypt, find item. `tabs.create({ url, active: false })`. Then in `transact`, remove the item from the crypt. Record action `resurrect` with 0 MB. | `not-found`, `browser-error` (item stays in crypt). |

Notes:

- Crypt saves the URL as given. A save duplicate check compares the full URL.
- Log entries use `site: siteOf(url)` and `title: tab.title` when it exists. For `ungarlic` the site is the argument and there is no title.
- Resurrect removes the item after the tab opens. If the second step fails, the item may remain after the tab opened, which means a duplicate rather than data loss.
- Coffin treats a thrown error as failure. It does not re-read the tab, because Chrome and Firefox differ in what `tabs.discard` returns.

### Dawn

`dawn(now = Date.now())`:

1. Read `tabs.query({})` and the garlic list. Map with `toTabInfo`, keeping the original tab for its title.
2. `targets = dawnTargets(infos, garlic, now)`. If empty, return `{ ok: true, closed: 0, mb: 0 }` with no writes.
3. Save all targets in one `transact`: add every target not already in the crypt, remember the ids of items just added. If this write throws, return `{ ok: false, reason: 'save-failed' }` and close nothing.
4. Close each target. Immediately before closing, `tabs.get(id)` and run `isDawnTarget` again on the fresh data. A tab that became active, audible or pinned in the meantime is skipped. A skipped tab's newly added crypt item is removed again in a final `transact`, so the crypt does not hold a copy of a tab that stayed open. Closes run with `Promise.allSettled`, so one failure does not stop the others, and failed closes are treated like skipped tabs.
5. For the tabs actually closed: `recordActions` with one row per tab (action `dawn`, its estimate), delta `{ dawns: 1, crypted: closed }`.
6. Return `{ ok: true, closed, mb }` and refresh the badge.

If the second check in step 4 rejects every target, `closed` is 0 and `dawns` is not incremented.

The second check narrows, but does not remove, the gap between the check and the close. A tab activated within that window could still be closed. The browser offers no atomic "close if idle" call, so this residual gap is accepted.

## Badge: `lib/badge.ts` and `entrypoints/background.ts`

`refreshBadge(now = Date.now())`: query all tabs, read the garlic list, count with `countStarving`, then call `browser.action.setBadgeText({ text: badgeText(count) })` and `setBadgeBackgroundColor` once with a deep red.

`entrypoints/background.ts` uses `defineBackground`. All listeners are registered synchronously when the script loads, as service workers require:

- `browser.alarms.create('tabpire-badge', { periodInMinutes: 1 })` at load. Re-creating an alarm with the same name replaces it, so there is no duplicate.
- `browser.alarms.onAlarm`: refresh when the alarm name matches.
- `browser.runtime.onInstalled` and `browser.runtime.onStartup`: refresh.
- A refresh also runs once at load, so the badge is right after the worker wakes.

Errors in a refresh are caught and ignored, since the next minute retries.

## Testing

### `tests/dawn.test.ts` (fast-check)

Uses the same arbitraries as Spec 1, now with `pinned`.

| Property | Requirement |
| --- | --- |
| For any tabs and garlic list, no target is active, pinned, audible, discarded, on a garlic site, or without a web URL. Checked from the tab fields, not through `stateOf`. | 7.3, 10.1 |
| Every tab that `stateOf` calls starving, is not pinned and has a web URL is a target. | 7.2, 10.2 |
| `dawnTargets` is a subset of the input and keeps order. | 7.2 |
| `countStarving` equals the number of tabs with state starving. | 9.6 |
| `badgeText`: empty for 0, the number up to 999, `999+` above. | 9.2, 9.3 |

### `tests/tabs.test.ts`

Uses `vi.mock('wxt/browser')` with an in-memory fake that provides `tabs` (`get`, `query`, `remove`, `discard`, `create`), `storage.local`, `action` and `alarms`. The real `lib/store.ts` runs on top of it. The fake lets a test make any call throw and records call order.

Cases:

- Stake, Coffin, Crypt, Garlic, Un-garlic, Resurrect: success changes the tab, stats, log and `mbFreed` as specified.
- Failure paths: missing tab, active tab for Coffin, non-web URL for Crypt, save failure leaves the tab open, Resurrect create failure keeps the item, Un-garlic of an unknown site.
- Garlic twice adds one entry and one log row. After Garlic, `stateOf` for tabs on that site is protected, and after Un-garlic it is not.
- Crypt does not duplicate an existing URL but still closes the tab.
- Dawn: closes only targets, saves each target before any `remove` call (checked by call order), closes nothing when the crypt write throws, skips a target that became active between the query and the close, and reports zero for no targets.
- Quick succession: ten actions started together lose no stats or log update.
- The log keeps only the newest 200 entries.
- `refreshBadge` sets the text for 0, a few, and more than 999 starving tabs.

`entrypoints/background.ts` is a thin wiring file. A text check confirms that it creates the one-minute alarm and registers the three listeners.

## Requirement coverage

| Requirement | Where it is met |
| --- | --- |
| 1 Stake, 2 Coffin, 3 Crypt | `stake`, `coffin`, `crypt` in `lib/tabs.ts` |
| 4 Garlic, 5 Un-garlic | `garlic`, `ungarlic` |
| 6 Resurrect | `resurrect` |
| 7 Dawn | `dawn`, `isDawnTarget`, `dawnTargets` |
| 8 Reclaimed and log | `recordActions`, `transact` |
| 9 Badge | `badgeText`, `countStarving`, `lib/badge.ts`, `entrypoints/background.ts` |
| 10 Tests | `tests/dawn.test.ts`, `tests/tabs.test.ts` |

## Open points

- A tab activated in the few milliseconds between the final check and the close can still be closed by Dawn. No browser API closes a tab conditionally.
- The badge counts pinned starving tabs, while Dawn does not close them.
