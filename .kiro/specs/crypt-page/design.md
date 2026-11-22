# Design: The Crypt new tab page (Spec 3)

## Overview

The Crypt is a React page built on the Spec 1 rules and the Spec 2 actions. The design splits into three layers so that Specs 4 to 6 can add the 3D scene, themes and popup without reworking it:

1. **Pure logic** in `lib/` (view model, text, suggestions, pinned pages, messages). No browser APIs, fully testable.
2. **Browser glue** in `lib/` (search, navigation, suggestion fetch) and React hooks (live data).
3. **Components and CSS** in `entrypoints/newtab/`. All colours are theme tokens. The layout never depends on a theme.

## File layout

```
lib/
  view.ts           pure: which tabs get a card, sorting, idle text, vial fill, memory format
  messages.ts       pure: plain-word success and error messages for actions and Dawn
  suggest.ts        pure: local suggestion matching and merging; Google response parsing
  pinned.ts         pinned pages: address validation (pure) and add/remove (through the store)
  nav.ts            browser glue: search with default engine, switch to tab, open in this tab
  google.ts         browser glue: fetchGoogleSuggestions (the only network call)
  store.ts          + subscribe()
  tabs.ts           resurrect() gains an `activate` option
entrypoints/newtab/
  index.html, main.tsx
  App.tsx
  hooks/useCryptData.ts       live snapshot of tabs and stored data
  hooks/useToasts.ts          message queue
  hooks/useSuggestions.ts     local and Google suggestions for a query
  hooks/useExitingCards.ts    keeps removed cards on screen for one exit animation
  components/
    Header.tsx  StatsPanel.tsx  HeaderButton.tsx  DawnButton.tsx
    CardGrid.tsx  TabCard.tsx  Vial.tsx  PortraitSlot.tsx  SiteIcon.tsx
    ActionButton.tsx  Tooltip.tsx
    SearchBox.tsx  PinnedRow.tsx  AddPageForm.tsx
    Toasts.tsx  EmptyState.tsx  ErrorState.tsx
    icons.tsx
  styles/
    tokens.css  base.css  header.css  cards.css  search.css  pinned.css  toasts.css
tests/
  view.test.ts  messages.test.ts  suggest.test.ts  pinned.test.ts  google.test.ts
  css.test.ts  contrast.test.ts
  ui/*.test.tsx            component tests (jsdom)
  helpers/fakeBrowser.ts   extended
```

## Dependencies and config

- Runtime: `@fontsource/grenze-gotisch` (weights 600, 800), `@fontsource/sora` (400, 600), `@fontsource/outfit` (400, 500). Only the latin subset files are imported, e.g. `@fontsource/sora/latin-600.css`, which keeps the bundle small. Fonts ship inside the extension, with no font network use.
- Dev: `jsdom`, `@testing-library/react`, `@testing-library/user-event`.
- `vitest.config.ts`: `include: ['tests/**/*.test.{ts,tsx}']`. Component tests start with `// @vitest-environment jsdom`. Other tests keep the Node environment.
- `wxt.config.ts`: add `host_permissions: ['https://suggestqueries.google.com/*']`. Permissions stay `tabs`, `storage`, `alarms`, `search`.
- Firefox note: Firefox treats host permissions as grantable by the user. If it is not granted, the suggestion request fails and the box shows local suggestions only (Requirement 7.7).

## Pure logic

### `lib/view.ts`

```ts
export interface RawTab { id: number; windowId: number; url?: string; title?: string; favIconUrl?: string;
                          active: boolean; audible: boolean; discarded: boolean; pinned: boolean; lastAccessed?: number }
export interface Card { tab: RawTab; info: TabInfo; site: string | null; state: VampireState;
                        hungerMs: number; mb: number }

export const VIAL_FULL_MS = 3 * DAY_MS;

export function isCardTab(tab: RawTab, currentTabId: number | undefined, ownPrefix: string): boolean
export function buildCards(tabs: RawTab[], currentTabId, ownPrefix, garlic, now): Card[]   // filtered and sorted
export function idleLabel(card: Pick<Card,'info'|'hungerMs'>): string
export function vialFill(hungerMs: number): number        // 0..1
export const VIAL_TICK = DAY_MS / VIAL_FULL_MS            // 1/3
export function formatMemory(mb: number): string          // "~120 MB", "~1.4 GB"
export function sumMb(cards: Card[]): number
```

- `isCardTab` excludes: the current tab (`currentTabId`), tabs whose URL starts with `ownPrefix` (the extension's own URL, from `browser.runtime.getURL('')`), and blank new tab pages. Blank pages are matched against a fixed list: `chrome://newtab/`, `edge://newtab/`, `about:newtab`, `about:home`, `about:blank`. A tab with no URL yet (still loading) is kept.
- `buildCards` filters with `isCardTab`, derives `info` (Spec 2's `toTabInfo` logic, applied to `RawTab`), then `state = stateOf(info, garlic, now)`, `hungerMs = hungerMs(info, now)`, `mb = estimateMb(info)`. Sort: `hungerMs` descending, then `id` ascending.
- `idleLabel`: "In use now" when active or audible; "Idle time unknown" when `lastAccessed` is absent; "just now" under a minute; then "5 minutes idle", "1 hour idle", "3 days idle", with correct singular forms. The Starving threshold of 1 day reads as "1 day idle".
- `vialFill = min(1, hungerMs / VIAL_FULL_MS)`, never negative.
- `formatMemory(mb)`: below 1000, `formatMb(mb)` from Spec 1. From 1000, `~${(mb/1000).toFixed(1)} GB`. Always begins with "~".

### `lib/messages.ts`

```ts
export type Notice = { kind: 'ok' | 'error'; text: string };
export function actionNotice(action: 'stake'|'coffin'|'crypt'|'garlic'|'ungarlic', result: ActionResult, ctx: { title: string; site: string | null }): Notice
export function dawnNotice(result: DawnResult): Notice
```

Plain-word messages. Examples:

| Case | Text |
| --- | --- |
| Stake ok | `Closed "Page title". About ~120 MB freed.` |
| Coffin ok | `Put "Page title" to sleep. About ~120 MB freed.` |
| Crypt ok | `Saved "Page title" to the Crypt and closed it.` |
| Garlic ok / already | `example.com is now protected.` / `example.com was already protected.` |
| Ungarlic ok | `example.com is no longer protected.` |
| Dawn ok | `Dawn closed 4 tabs and saved them to the Crypt. About ~480 MB freed.` (singular forms handled) |
| Dawn zero | `No tabs were ready to close.` |
| `no-tab` | `That tab is already gone.` |
| `not-allowed` | `A tab that is in use cannot be put to sleep.` |
| `no-site` | `This page has no site, so it cannot be saved or protected.` |
| `save-failed` | `Could not save to the Crypt, so nothing was closed.` |
| `browser-error` | `The browser would not do that. Nothing was changed.` |

Titles in messages are cut to 40 characters with an ellipsis.

### `lib/suggest.ts`

```ts
export type SuggestionKind = 'tab' | 'pinned' | 'crypt' | 'search';
export interface Suggestion { id: string; kind: SuggestionKind; label: string; detail?: string;
                              tabId?: number; windowId?: number; url?: string; cryptId?: string; text?: string }
export const KIND_LABEL: Record<SuggestionKind, string> // "Open tab", "Pinned page", "Crypt", "Search"

export function localSuggestions(query: string, src: { tabs: RawTab[]; pinned: PinnedPage[]; crypt: CryptItem[] }): Suggestion[]
export function withWeb(local: Suggestion[], web: string[], query: string): Suggestion[]
export function parseGoogleResponse(json: unknown): string[]
```

- Matching: the query is trimmed, lower-cased and split on whitespace. A candidate matches when every word appears in `title + ' ' + url` (lower-case). Score: title starts with the first word (best), title contains it, only URL contains it. Highest score first, ties keep source order. At most 3 per group, groups in the fixed order tabs, pinned, crypt.
- `withWeb` appends at most 5 distinct web suggestions (case-insensitive, trimmed, skipping empty ones and ones equal to the query).
- `parseGoogleResponse` accepts the `["query", ["a","b"]]` shape and returns only string items. Any other shape gives `[]`.
- Open tab matches use all tabs that have a card (the page itself is never offered).

### `lib/pinned.ts`

```ts
export const MAX_PINNED = 12;
export type AddressCheck = { ok: true; url: string } | { ok: false; reason: 'empty' | 'invalid' | 'not-web' };
export function checkAddress(input: string): AddressCheck       // pure
export function pinnedLetter(page): string                      // for the letter badge
export async function pinPage(input: string, name?: string): Promise<{ ok: true } | { ok: false; reason: 'empty'|'invalid'|'not-web'|'full'|'duplicate' }>
export async function unpinPage(url: string): Promise<void>
```

- `checkAddress`: trims; if the text has no `scheme:` it prefixes `https://`; parses with `URL`; accepts `http:` and `https:` only; requires a non-empty hostname. The saved URL is `URL.href`.
- `pinPage` runs inside `transact`: reads the list, rejects `full` at 12 and `duplicate` when the same `href` exists, else saves `{ url, title: name || siteOf(url) }`. `unpinPage` filters by URL under `transact`.

## Browser glue

### `lib/store.ts`: `subscribe`

```ts
export function subscribe(listener: (changedKeys: string[]) => void): () => void
```

Wraps `browser.storage.onChanged` and calls the listener only for `local` changes whose keys start with `tabpire:`. Returns an unsubscribe function. This keeps `storage.local` mentions inside `store.ts`.

### `lib/tabs.ts`: `resurrect` option

`resurrect(itemId, now = Date.now(), options: { activate?: boolean } = {})`. With `activate`, the tab is created with `active: true`. Default stays background. Existing calls and tests do not change.

### `lib/nav.ts`

- `searchWithDefaultEngine(text)`: gets the current tab id, then calls `browser.search.query({ text, disposition: 'CURRENT_TAB' })` on Chrome. Firefox exposes `browser.search.search({ query, tabId })` instead, so the function uses whichever exists.
- `openInThisTab(url)`: `browser.tabs.update({ url })`.
- `showTab(tab)`: `browser.tabs.update(tab.id, { active: true })`, then `browser.windows.update(tab.windowId, { focused: true })`.

### `lib/google.ts`

```ts
export const SUGGEST_ORIGIN = 'https://suggestqueries.google.com';
export async function fetchGoogleSuggestions(query: string, signal: AbortSignal): Promise<string[]>
```

`fetch(`${SUGGEST_ORIGIN}/complete/search?client=firefox&q=${encodeURIComponent(query)}`, { signal, credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store' })`. A 1.5 second timeout is combined with the caller's signal. Any error, non-OK response, or bad shape returns `[]`. Only the typed query is in the request. This is the only `fetch` in the page code.

## Data flow and hooks

### `useCryptData()`

Returns `{ status: 'loading' | 'ready' | 'error', cards, rawTabs, garlic, stats, crypt, pinned, now, reload }`.

- **Snapshot:** `Promise.all` of `browser.tabs.query({})`, `browser.tabs.getCurrent()`, and `store.getGarlic/getStats/getCrypt/getPinned`. `buildCards` then runs with `now = Date.now()` taken once per snapshot.
- **Triggers:** tab events (`onCreated`, `onRemoved`, `onUpdated`, `onActivated`, `onAttached`, `onDetached`, `onReplaced`), `store.subscribe`, a 60 second interval, `visibilitychange` to visible, and `reload()`. Triggers feed one trailing debounce of 150 ms, so bursts of events cause one refresh, and the page updates well inside 1 second.
- **Order safety:** each refresh gets a sequence number. A result older than the newest applied one is dropped.
- **Errors:** a failed first load gives `status: 'error'`. A failed later refresh keeps the last good data and does not flash an error.
- **Cleanup:** every listener and timer is removed on unmount.

### `useToasts()`

Holds up to 3 notices. Each lasts 5 seconds, errors 8 seconds. Exposes `push(notice)`. `Toasts` renders a fixed region near the bottom centre: `role="status"` and `aria-live="polite"` for ok notices and `role="alert"` for errors. The container ignores pointer events, and each notice is small, so cards stay usable.

### `useSuggestions(query, local sources)`

- Local suggestions come from `useMemo(localSuggestions(...))`, so they appear on the same keystroke.
- Web suggestions: when `query.trim().length >= 2`, a 200 ms debounce starts a request with an `AbortController`. A new query aborts the previous request. Results are stored together with the query they belong to, and shown only when that query still equals the current one. Failures leave the web list empty.

### `useExitingCards(cards)`

Compares the card list across renders. A card that disappeared stays in the list for 220 ms, marked `exiting` (`aria-hidden`, no pointer events), at its old index, so its exit animation can play. When `prefers-reduced-motion` is set, cards disappear at once. This is how "the card leaves" is shown for Stake, Crypt and Dawn. Coffin changes the card in place (Asleep state).

## App behaviour

```
App
  Header (brand, StatsPanel, Themes, Blood Bank, DawnButton)
  main
    SearchBox
    PinnedRow
    CardGrid | EmptyState | ErrorState | loading skeleton
  Toasts
```

- **Actions:** `TabCard` calls `onAction(card, 'stake' | 'coffin' | 'crypt' | 'garlic' | 'ungarlic')`. `App` adds the tab id to a `busy` set, awaits the Spec 2 function, builds a notice with `actionNotice`, pushes it, then removes the id from `busy` and calls `reload()`. The card's buttons are disabled while its id is in `busy`.
- **Dawn:** `dawn()` from Spec 2. While it runs, a `dawnBusy` flag disables the Dawn button and every card's buttons. The result goes through `dawnNotice`. The Dawn count is `dawnTargets(cards.map(c => c.info), garlic, now).length`.
- **Search:** Enter with no highlighted suggestion calls `searchWithDefaultEngine`. A chosen suggestion runs by kind: tab, `showTab`; pinned, `openInThisTab`; crypt, `resurrect(id, now, { activate: true })`; search, `searchWithDefaultEngine(text)`.
- **Loading:** the header, search box and pinned row render at once from stored data. While tabs load, the grid area shows a fixed-height skeleton of the same size as the final grid's first row, so nothing jumps.

## Visual design

### Theme tokens (`styles/tokens.css`)

All colours and shadows are custom properties on `:root[data-theme='crypt']`, set by `index.html` as `data-theme="crypt"`. Spec 5 adds other `data-theme` blocks. Layout, sizes and spacing live in `base.css` and never read a theme name.

Starting values for The Crypt (to be tuned while building):

| Token | Value | Use |
| --- | --- | --- |
| `--sky-top`, `--sky-bottom` | `#0b0612`, `#26112e` | page gradient |
| `--ink` | `#f6eaf0` | main text |
| `--ink-dim` | `#c2adbd` | secondary text |
| `--card-top`, `--card-bottom` | `#2a1736`, `#1a0d24` | card body gradient |
| `--accent` | `#d6283f` | blood red: vial, focus, Dawn glow |
| `--state-awake` | `#66d9a0` | Awake rim and badge |
| `--state-starving` | `#ff6b6b` | Starving rim and badge |
| `--state-asleep` | `#8fa3ff` | Asleep rim and badge |
| `--state-protected` | `#f4d58a` | Protected rim and badge (garlic cream) |

A test computes the contrast ratio of each text colour against its backgrounds from this file and requires at least 4.5:1.

### Fonts

- Grenze Gotisch 800: brand "Tabpire", empty and error headings.
- Sora 600: stat labels and values, state badges, button labels, tooltips.
- Outfit 400 and 500: tab titles, idle and memory lines, search text, messages.

### Page and header

- Background: `--sky-*` linear gradient plus a fixed dark vignette (radial gradient). Static, no animation.
- Header: CSS grid `1fr auto 1fr`. Brand on the left with a small bat-wing mark drawn in SVG (it is the logo and nothing else). Buttons on the right. Under 900 px the grid becomes two rows: brand and buttons first, then the full-width stats panel.
- Stats panel: three figures with a divider. Each has a Sora label, a Sora value (tabular numbers) and a small "est." tag. The panel has a translucent gradient, a 1 px light edge, an inner top highlight, a soft outer shadow, and `backdrop-filter: blur(10px)`. A `@supports not (backdrop-filter: blur(1px))` rule raises the fill opacity. The blur is on a static element and is never transitioned.
- Header buttons: raised rounded buttons with a gradient icon and a Sora label. Themes and Blood Bank use `aria-disabled="true"` with the tooltip "Coming soon". The Dawn button has a sunrise gradient (dusk purple to warm gold) and its count shows in a small round badge. Disabled Dawn uses a muted version of the same gradient.

### Cards

Fixed card size: minimum width 300 px, height 236 px. Grid: `repeat(auto-fill, minmax(300px, 1fr))` with a 20 px gap.

```
+-----------------------------------+
| [icon] Title…               STATE |  row 1: icon plate, title (Outfit 500), state badge (Sora)
| +--------+  3 days idle     |vial| |  row 2: portrait slot 96x112 | idle + memory + site | vial
| | portrait|  ~120 MB        |    | |
| |  slot  |  example.com     |    | |
| +--------+                  +----+ |
| [Stake] [Coffin] [Crypt] [Garlic] |  row 3: four icon buttons
+-----------------------------------+
```

- **Shrine look:** the top corners are rounded like an arch (28 px), the bottom corners 14 px. The body is a vertical gradient with an inset top highlight and a layered outer shadow. The rim is a 3 px gradient edge in the state colour, built from a pseudo-element, so the rim and the card body stay sharp vector shapes.
- **Starving glow:** a pseudo-element with a soft red `box-shadow` pulses through `opacity` (0.35 to 0.9, 2.4 s, ease-in-out). This is the only looping animation on cards. Reduced motion turns it off and leaves it at a steady 0.6.
- **Hover and focus:** `transform: translateY(-4px)` with a slight `perspective` tilt, 160 ms. Only `transform` and `opacity` change.
- **Entry:** the first 12 cards fade and rise in with a 30 ms stagger (`opacity` and `transform`), once.
- **Exit:** 200 ms fade and sink with a small scale-down (`opacity`, `transform`).
- **Vial:** an SVG glass tube with a rounded bottom. Inside, a blood-red fill rectangle is drawn full height and scaled with `transform: scaleY(fill)` from the bottom, so the fill is a transform change and not a size change. A small glass highlight, a tick line at one third with a "1 day" label in the accessible text, and a cork cap complete it. Its `role="img"` label reads "Hunger meter: 3 days idle", using the same idle text as the card.
- **Portrait slot:** fixed 96 x 112 box with a rounded top and a soft inner gradient tinted by the state. It holds an SVG vampire emblem (cape and fangs, cute not scary) in the state colour. Spec 4 replaces the contents and keeps the box.
- **Letter badge and icon plate:** a 28 px rounded plate. With an icon, the `<img>` is 16 px, `alt=""`, `referrerPolicy="no-referrer"`, `decoding="async"`, `loading="lazy"`. When it errors, the component switches to the letter badge (the first letter of the site, on a colour chosen by `fnv1a32(site)` from six fixed `--badge-1` to `--badge-6` tokens).
- **Full title:** the title element carries a `title` attribute (hover). Each of the card's four action buttons also repeats the full title as a second line in its tooltip, which shows on hover and on keyboard focus. Cards are not focus stops, so this avoids hundreds of extra tab stops.
- **State badge:** pill with the state word in text, and a small shape that differs per state (dot, flame, moon, shield) so state is not only colour.

### Action buttons and tooltips

- Four 36 px round buttons per card, each with a custom gradient SVG: Stake (wooden stake with a sharp tip), Coffin (six-sided coffin with a lid line), Crypt (arched tomb door), Garlic (garlic bulb). "Remove garlic" uses the bulb with a slash. Header icons: Themes (half moon, half sun), Blood Bank (glossy blood orb), Dawn (sunrise over a horizon). Every gradient has a unique id from `useId`.
- Disabled buttons use `aria-disabled="true"` and stay focusable, so keyboard users can read why in the tooltip. Clicks on them do nothing.
- `Tooltip` is a CSS-and-ARIA tooltip: the button has `aria-describedby` pointing to a hidden `role="tooltip"` element that fades in (`opacity`, `transform`) on hover and `:focus-visible`. The text is "Stake: close this tab". For disabled buttons it is the reason, for example "Coffin: this tab is in use and cannot be put to sleep". Tooltips for the top row of cards open upward and never clip, since the card container allows overflow.

### Search and pinned row

- Search box: wide rounded input with a magnifier SVG, centred, max width 640 px, glass-like gradient (no blur). It follows the ARIA combobox pattern: `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`, `aria-autocomplete="list"`. The list has `role="listbox"`. Each option shows a Sora kind tag ("Open tab", "Pinned page", "Crypt", "Search"), the label, and a dim detail line. Arrow keys move, Enter chooses, Escape closes. Mouse hover highlights.
- Pinned row: a wrapping row of pill tiles with the letter badge and name, plus the "Add page" button last. A remove button (small x) appears on hover and keyboard focus of a tile. `AddPageForm` opens as a small popover under the button with two labelled inputs ("Web address", "Name (optional)"), Add and Cancel buttons, an inline error line, focus moved to the first field, focus returned to the button on close, and Escape to close.

### Motion and accessibility

- `@media (prefers-reduced-motion: reduce)` sets `animation: none` and `transition: none` for everything, and the JS exit list is skipped.
- All animations and transitions list only `transform` and `opacity` explicitly, never `all`.
- Focus ring: 2 px `--accent` outline with a light offset ring, always visible on `:focus-visible`.
- Landmarks: `header`, `main`, a labelled search region, and a labelled list for cards (`role="list"` on the grid, `role="listitem"` on cards).
- Contrast is checked by test (see Testing). State is always shown as a word and a shape.

## Local-first and permissions

- Two kinds of outbound traffic exist: the suggestion request (`lib/google.ts`) and the browser's own loading of tab icon images. Everything else, fonts and icons included, ships in the bundle.
- The page never reads `storage.local` directly. It uses the store.
- No analytics, no remote scripts, no CSP change.

## Testing

### Pure and glue tests (Node)

| File | What it checks |
| --- | --- |
| `view.test.ts` | Property: `buildCards` output is sorted by hunger descending then id, never contains the current tab, own pages, or blank tab pages, and every other tab appears exactly once. Property: `vialFill` is within 0 to 1 and never decreases as hunger grows. `idleLabel` examples for each range and the unknown case. `formatMemory` always starts with "~" and switches to GB at 1000. |
| `messages.test.ts` | Each action and failure reason gives the expected plain text. Titles are cut at 40 characters. Singular and plural Dawn text. |
| `suggest.test.ts` | Matching by title and URL, ordering, three per group, group order, web list cap of five, dedupe, `parseGoogleResponse` on good and bad shapes. |
| `google.test.ts` | With a mocked `fetch`: the URL contains only the encoded query, no credentials or referrer; any failure, bad status, bad JSON or timeout gives `[]`; abort stops the request. |
| `pinned.test.ts` | `checkAddress` examples and property (never accepts a non-web scheme); `pinPage` rejects `full` at 12 and `duplicate`; `unpinPage`; names default to the site. |
| `store.test.ts` (extended) | `subscribe` calls the listener for `tabpire:` keys in `local` only and unsubscribes cleanly. |
| `tabs.test.ts` (extended) | `resurrect` with `activate: true` creates an active tab; the default is unchanged. |
| `css.test.ts` | Every `animation`, `transition` and `@keyframes` in `entrypoints/newtab/styles` changes only `transform` and `opacity` (no `all`). `blur(` appears only as a `backdrop-filter` of at most 10 px on the `.stats-panel` rule. No `url(` with a host name. A scan of `lib/` and `entrypoints/newtab/` (comments removed) finds no web address with a host name except `suggestqueries.google.com`. |
| `contrast.test.ts` | Reads `tokens.css`, computes contrast for ink and ink-dim on the sky, card and panel backgrounds, and for each state colour on the card background. Requires at least 4.5. |

### Component tests (jsdom, `tests/ui/`)

The fake browser gains `tabs.getCurrent`, `tabs.update`, `windows.update`, `search.query`, `runtime.getURL`, and the tab and storage `onChanged` events with a way to fire them.

- **Header:** the three figures and their "est." tags; open tab count equals card count; memory sums; reclaimed from stats; Themes and Blood Bank are `aria-disabled` with "Coming soon".
- **Cards:** one card for each state with the right rim attribute, state word, idle text, memory text and vial label; the letter badge appears when there is no icon and when the image fires `error`; long titles keep a full-title attribute.
- **Actions:** Coffin is disabled with a reason for active and asleep tabs; Crypt and Garlic are disabled for non-web tabs; Garlic becomes "Remove garlic" on a Protected card and calls Un-garlic; a click runs the action once, shows the notice, and disables the card's buttons while it runs; a failure leaves the card and shows an error notice.
- **Dawn:** the count equals `dawnTargets`; disabled at zero with a reason; clicking runs Dawn, shows the notice, and disables everything while it runs.
- **Live updates:** firing a tab event refreshes the cards; a storage change updates the stats; stale refresh results are dropped.
- **Search:** typing shows local suggestions at once; Google suggestions appear after the debounce and only for 2 or more characters; a failed request leaves local ones; arrow keys, Enter and Escape work; each suggestion kind runs its action; Enter with no highlight runs the search.
- **Pinned:** clicking opens the page; the Add page form validates, adds, rejects duplicates, and disables at 12; remove works; Escape closes the form and returns focus.
- **States:** loading shows the final-size layout; no tabs shows the friendly message; a failed load shows "Try again", which reloads.

### Visual check

Component tests cannot judge how the page looks. After the build, I will load the built extension in Chromium with Playwright if it is available, and capture the page with a handful of sample tabs, at 360, 1280 and 2560 px wide. If Playwright cannot be used here, I will say so and ask you to load `.output/chrome-mv3` and look at the page. The 60 fps check for the stats panel blur cannot be automated here. I will keep the blur static and small, and measuring it stays your call when the 3D background arrives in Spec 4.

## Requirement coverage

| Requirement | Where it is met |
| --- | --- |
| 1 Look, fonts, motion | `styles/*`, tokens, fonts, `css.test.ts`, `contrast.test.ts` |
| 2 Header | `Header`, `StatsPanel`, `HeaderButton`, `DawnButton` |
| 3 Card list | `lib/view.ts`, `useCryptData`, `CardGrid` |
| 4 Card content | `TabCard`, `Vial`, `PortraitSlot`, `SiteIcon`, `idleLabel` |
| 5 Card actions | `ActionButton`, `Tooltip`, `lib/messages.ts`, `useToasts`, `App` |
| 6 Dawn | `DawnButton`, `dawnTargets`, `dawnNotice` |
| 7 Search | `SearchBox`, `useSuggestions`, `lib/suggest.ts`, `lib/google.ts`, `lib/nav.ts`, manifest host permission |
| 8 Pinned pages | `PinnedRow`, `AddPageForm`, `lib/pinned.ts` |
| 9 Empty, loading, error | `EmptyState`, `ErrorState`, loading skeleton |
| 10 Local-first | `lib/google.ts` as the only `fetch`, `css.test.ts` address scan |
| 11 Tests | the tests listed above |

## Open points

- The token colours and the card artwork are first drafts. They will be tuned against the visual check.
- The tab icon images are loaded by the browser from each site when it has no cached copy. This is the consequence of decision 3, and it is the one place where an open tab's address can reach the network.
- A card list of several hundred tabs renders without virtualisation. It should stay smooth up to about 300 tabs. Beyond that, Spec 4's shared canvas will need the list windowed, and that belongs in Spec 4.
