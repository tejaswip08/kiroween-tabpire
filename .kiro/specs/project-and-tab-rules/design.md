# Design: Project and tab rules (Spec 1)

## Overview

Spec 1 delivers a WXT extension skeleton, a pure rules module (`lib/hunger.ts`), a storage module (`lib/store.ts`), and property-based tests. The new tab page is a placeholder that proves the override works. All real UI comes in later specs.

The design keeps two boundaries sharp:

- `lib/hunger.ts` knows nothing about the browser or the clock. Inputs in, values out.
- `lib/store.ts` is the only code that touches `browser.storage.local`.

## File layout

```
tabpire-kiro/
  package.json            scripts: dev, build, build:firefox, typecheck, test
  tsconfig.json           extends .wxt/tsconfig.json, strict: true
  wxt.config.ts           manifest: name, description, permissions
  vitest.config.ts        node environment, include tests/**/*.test.ts
  entrypoints/
    newtab/
      index.html          new tab override (WXT turns this into chrome_url_overrides.newtab)
      main.tsx            React 19 root
      App.tsx             placeholder: tagline only
      style.css           plain CSS
  lib/
    hunger.ts             pure rules
    store.ts              storage.local wrapper
  tests/
    hunger.test.ts        property-based tests (fast-check)
    store.test.ts         example-based tests with a fake storage
```

## Manifest (`wxt.config.ts`)

- `name`: Tabpire.
- `description`: "Your tabs are draining you. Stake them."
- `permissions`: `["tabs", "storage", "alarms", "search"]`. No `host_permissions`, no `content_scripts`, no `web_accessible_resources` for remote origins.
- Build targets: `wxt build` (Chrome) and `wxt build -b firefox`. Both use Manifest V3 (`manifestVersion: 3`).
- Firefox needs `browser_specific_settings.gecko.id`. WXT config sets a placeholder id, `tabpire@example.invalid`, to be replaced before submission.

## `lib/hunger.ts`

### Types

```ts
export type VampireState = 'awake' | 'starving' | 'asleep' | 'protected';

export interface TabInfo {
  id: number;                 // stable per tab while the browser session lives
  url?: string;
  active: boolean;
  audible: boolean;
  discarded: boolean;
  lastAccessed?: number;      // epoch ms, absent when unknown
}

export const DAY_MS = 24 * 60 * 60 * 1000;
```

`TabInfo` is a plain subset of `browser.tabs.Tab`. Code outside the module maps a real tab to `TabInfo`. This keeps the module free of browser types.

### Functions

| Function | Signature | Behavior |
| --- | --- | --- |
| `siteOf` | `(url: string \| undefined) => string \| null` | Parses with `new URL`. Returns the hostname without a leading `www.` for `http:` and `https:` URLs. Returns `null` for anything else, including parse errors. |
| `hungerMs` | `(tab, now) => number` | `0` if the tab is active or audible, or `lastAccessed` is absent. Otherwise `max(0, now - lastAccessed)`. |
| `stateOf` | `(tab, garlic, now) => VampireState` | Applies the precedence below. |
| `estimateMb` | `(tab) => number` | See memory estimate. |
| `formatMb` | `(mb: number) => string` | `` `~${mb} MB` ``. Always has the "~". |

`garlic` is `readonly string[]` of site hostnames. `stateOf` builds the comparison from `siteOf(tab.url)`, so a tab with `siteOf === null` can never be Protected.

### State precedence

```
site = siteOf(tab.url)
if site !== null and garlic includes site  -> protected
else if tab.discarded                      -> asleep
else if tab.active or tab.audible          -> awake
else if tab.lastAccessed is absent         -> awake
else if now - tab.lastAccessed >= DAY_MS   -> starving
else                                       -> awake
```

This is a single `if` chain with a final `else`, so every input returns exactly one state. A last-used time in the future gives a negative difference, which is below `DAY_MS`, so the tab is Awake.

### Memory estimate

1. `site = siteOf(tab.url)`.
2. If `tab.discarded`, return `0`.
3. Pick a base in MB:
   - A table keyed by site, matched on the exact hostname or any parent domain (so `mail.google.com` is not matched by `google.com`, but `www.youtube.com` and `m.youtube.com` match `youtube.com`).
   - Table values (MB): `chatgpt.com` 520, `claude.ai` 450, `youtube.com` 350, `figma.com` 400, `mail.google.com` 300, `docs.google.com` 250, `notion.so` 300, `slack.com` 280, `discord.com` 300, `github.com` 180, `netflix.com` 400, `twitter.com` 250, `x.com` 250, `linkedin.com` 220, `meet.google.com` 450. The user supplied all values except ChatGPT and Claude, which come from the roadmap.
   - Fallback heuristics on the URL, first match wins:
     - no `site` (internal pages, missing URL): 80
     - hostname or path suggests video, streaming or maps (`video`, `watch`, `stream`, `maps`): 300
     - hostname or path suggests an app, docs or mail (`docs`, `mail`, `app`, `drive`, `notion`): 250
     - any other http(s) page: 150
4. Apply the variation. `h = fnv1a32(`${tab.id}:${site ?? tab.url ?? ''}`)`, `factor = 0.85 + (h % 10001) / 10000 * 0.30`. The factor lies in [0.85, 1.15].
5. `mb = Math.round(base * factor / 5) * 5`, then `Math.max(0, mb)`.

FNV-1a is used because it is short, has no dependency, and gives the same result on every run and platform. The estimate depends only on `tab.id`, the URL and `discarded`, so it does not change as the tab is used.

Rounding to 5 can move the result slightly outside ±15% of base for small bases (at most 2.5 MB). Tests allow for this.

## `lib/store.ts`

### Data model

```ts
export interface Stats { staked: number; coffined: number; crypted: number; dawns: number; mbFreed: number; }
export interface ActionLogEntry { at: number; action: string; site: string | null; title?: string; }
export interface CryptItem { id: string; url: string; title: string; savedAt: number; }
export interface PinnedPage { url: string; title: string; }
export type ThemeId = string;
```

`action` is a plain string because the action set is defined in Spec 2. `ThemeId` is a string for the same reason, with Spec 5 defining the values. These three fields are my guess at a minimal shape. Specs 2 and 5 may add fields. Adding optional fields later will not break stored data.

Defaults: `stats` all zeros, `log` `[]`, `crypt` `[]`, `garlic` `[]`, `pinned` `[]`, `theme` `'crypt'`.

### Storage keys

One key per kind, prefixed `tabpire:`: `tabpire:stats`, `tabpire:log`, `tabpire:crypt`, `tabpire:garlic`, `tabpire:pinned`, `tabpire:theme`.

### API

```ts
export const store = {
  getStats(): Promise<Stats>;            setStats(v: Stats): Promise<void>;
  getLog(): Promise<ActionLogEntry[]>;   setLog(v: ActionLogEntry[]): Promise<void>;
  getCrypt(): Promise<CryptItem[]>;      setCrypt(v: CryptItem[]): Promise<void>;
  getGarlic(): Promise<string[]>;        setGarlic(v: string[]): Promise<void>;
  getPinned(): Promise<PinnedPage[]>;    setPinned(v: PinnedPage[]): Promise<void>;
  getTheme(): Promise<ThemeId>;          setTheme(v: ThemeId): Promise<void>;
};
```

Each getter reads one key with `browser.storage.local.get(key)`, runs a hand-written validator, and returns the stored value if valid or the default if the key is missing or invalid. A thrown storage error is not swallowed, since a failed read is different from a bad value. Validators are small type guards, so no schema library is added.

The module only imports from `wxt/browser`. It never uses `storage.sync`, `fetch`, or `XMLHttpRequest`.

## Placeholder new tab page

`index.html` loads `main.tsx`, which renders `App` with the tagline. This only proves the override and the React 19 and CSS pipeline. It uses no spooky decoration, which keeps to the rule that spooky elements must mean something.

## Testing strategy

### `tests/hunger.test.ts` (fast-check)

Shared arbitraries: `tabArb` (all fields random, `url` drawn from http, https, internal and undefined), `garlicArb` (arrays of hostnames, including ones taken from the generated tab), and `nowArb`.

| Property | Requirements |
| --- | --- |
| `stateOf` returns one of the four states, and exactly one: the result is in the set, and a reference classifier that computes each predicate separately finds exactly one true | 2.1 to 2.5, 6.2 |
| A tab with a garlic site is always `protected`. A discarded non-garlic tab is always `asleep` | 2.2, 2.3 |
| Absent `lastAccessed` and not protected, not asleep gives `awake` | 2.6 |
| `estimateMb` called twice with the same input gives the same value. The result is `>= 0`, a multiple of 5, and `0` when discarded | 4.5 to 4.7, 6.3 |
| For non-discarded tabs, the estimate stays within ±15% of the base plus 2.5 MB of rounding slack | 4.4 |
| `formatMb(n)` always starts with `~` | 4.8 |
| For an unused tab (not active, not audible, fixed `lastAccessed`) and `t1 <= t2`, `hungerMs(t1) <= hungerMs(t2)` | 3.3, 6.4 |
| `hungerMs >= 0` for any input, and `0` for active or audible tabs | 3.2, 3.4 |
| `siteOf` never throws on arbitrary strings | 2.7 support |

Example-based cases cover every site in the table (each estimate within the ±15% band of its base, plus rounding) and subdomain matching (`m.youtube.com` matches, `calendar.google.com` does not match `docs.google.com`), `www.` stripping, and the boundary at exactly 1 day (starving) and 1 ms less (awake).

### Static checks for requirement 5

A test reads `lib/hunger.ts` as text and asserts it contains no `wxt/browser`, `browser.`, `chrome.`, `Date.now`, or `new Date(` text. This is crude but cheap, and it will fail the build if someone breaks the purity rule.

### `tests/store.test.ts`

Uses `vi.mock('wxt/browser')` with an in-memory `storage.local` fake. Checks that each kind returns its default when empty, round-trips a written value, and returns the default when the stored value has the wrong shape (for example `tabpire:garlic` set to a number). A text check asserts that no other file under `lib/` or `entrypoints/` mentions `storage.local`, covering requirement 7.1 until later specs add more code.

### Tooling

Vitest runs in the Node environment, since none of this code needs a DOM. `npm test` runs `vitest run`. `npm run typecheck` runs `wxt prepare && tsc --noEmit`. The `wxt prepare` step generates `.wxt/tsconfig.json`, which `tsconfig.json` extends.

## Requirement coverage

| Requirement | Where it is met |
| --- | --- |
| 1 Extension project | `wxt.config.ts`, `entrypoints/newtab`, `package.json` scripts |
| 2 Tab states | `stateOf`, `siteOf` |
| 3 Hunger | `hungerMs` |
| 4 Memory estimate | `estimateMb`, `formatMb` |
| 5 Pure module | no imports in `hunger.ts`, static check test |
| 6 Property tests | `tests/hunger.test.ts` |
| 7 Local storage | `lib/store.ts`, `tests/store.test.ts` |

## Open points

- The Firefox add-on id is a placeholder.
- Store field shapes for the log, stats and crypt are minimal and may be extended in Specs 2, 3 and 5.
