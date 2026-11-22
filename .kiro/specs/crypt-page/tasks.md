# Tasks: The Crypt new tab page (Spec 3)

Each task is small enough to finish and check on its own. Requirement numbers refer to `requirements.md`. After each task, `npm run typecheck` and `npm test` must pass.

- [x] 1. Dependencies and configuration
  - [x] 1.1 Install `@fontsource/grenze-gotisch`, `@fontsource/sora`, `@fontsource/outfit` and, as dev dependencies, `jsdom`, `@testing-library/react`, `@testing-library/user-event`. Confirm the latin weight files named in the design exist.
    - _Requirements: 1.2, 11.2_
  - [x] 1.2 Change `vitest.config.ts` to include `tests/**/*.test.{ts,tsx}`. Keep the Node environment as default; component tests opt in to jsdom per file. Add a one-line smoke test in `tests/ui/smoke.test.tsx` that renders a `<div>` to prove JSX tests run.
    - _Requirements: 11.2, 11.5_
  - [x] 1.3 Add `host_permissions: ['https://suggestqueries.google.com/*']` to `wxt.config.ts`. Set `data-theme="crypt"` on the `<html>` element in `entrypoints/newtab/index.html`.
    - _Requirements: 7.11, 10.4_

- [x] 2. Store and Spec 2 additions
  - [x] 2.1 Add `subscribe(listener)` to `lib/store.ts`, with tests: called for `tabpire:` keys in `local` only, ignores other keys and other areas, unsubscribes cleanly.
    - _Requirements: 3.4_
  - [x] 2.2 Add the `activate` option to `resurrect` in `lib/tabs.ts`, with a test that the tab opens active when asked and stays in the background by default.
    - _Requirements: 7.8_

- [x] 3. Pure view logic
  - [x] 3.1 Create `lib/view.ts`: `RawTab`, `Card`, `isCardTab`, `buildCards`, `idleLabel`, `vialFill`, `VIAL_TICK`, `formatMemory`, `sumMb`.
    - _Requirements: 3.1, 3.2, 4.2 to 4.4, 2.4_
  - [x] 3.2 Create `tests/view.test.ts`: property tests that cards are sorted by hunger then id, never include the current tab, own pages or blank pages, and include every other tab exactly once; property tests that `vialFill` stays within 0 to 1 and never decreases; examples for `idleLabel` in every range and the unknown case; `formatMemory` always starts with "~" and switches to GB at 1000.
    - _Requirements: 3.2, 4.3, 4.4, 11.1_
  - [x] 3.3 Create `lib/messages.ts` and `tests/messages.test.ts`: every action and failure reason gives the planned plain text; titles cut at 40 characters; Dawn singular and plural text.
    - _Requirements: 1.3, 5.7, 5.8, 6.3, 6.4, 11.1_
  - [x] 3.4 Create `lib/suggest.ts` and `tests/suggest.test.ts`: matching, ordering, three per group, group order, web cap of five, dedupe, `parseGoogleResponse` on good and bad shapes.
    - _Requirements: 7.3 to 7.5, 7.10, 11.1_
  - [x] 3.5 Create `lib/pinned.ts` and `tests/pinned.test.ts`: `checkAddress` examples, a property that non-web schemes are never accepted, `pinPage` rejecting `full` at 12 and `duplicate`, default name, `unpinPage`.
    - _Requirements: 8.4, 8.7, 8.8, 8.9, 11.1_

- [x] 4. Browser glue
  - [x] 4.1 Create `lib/google.ts` with `fetchGoogleSuggestions` and `tests/google.test.ts` using a mocked `fetch`: the URL carries only the encoded query; credentials omitted and no referrer; errors, bad status, bad JSON and the 1.5 second timeout give `[]`; aborting stops the request.
    - _Requirements: 7.5 to 7.7, 10.1_
  - [x] 4.2 Create `lib/nav.ts` (`searchWithDefaultEngine` for both Chrome and Firefox APIs, `openInThisTab`, `showTab`).
    - _Requirements: 7.1, 7.2, 7.8_
  - [x] 4.3 Extend `tests/helpers/fakeBrowser.ts` with `tabs.getCurrent`, `tabs.update`, `windows.update`, `search.query`, `runtime.getURL`, tab events and `storage.onChanged`, each with a way to fire it. Add tests for `lib/nav.ts` against it.
    - _Requirements: 7.1, 7.8, 11.2_

- [x] 5. Styles foundation
  - [x] 5.1 Create `styles/tokens.css` with The Crypt values (sky, ink, card, accent, four state colours, six badge colours, shadows) under `:root[data-theme='crypt']`. Create `styles/base.css` with font imports, reset, page gradient, vignette, focus ring, the reduced-motion rule, and layout sizes.
    - _Requirements: 1.2, 1.7, 1.8, 1.9, 1.11_
  - [x] 5.2 Create `tests/contrast.test.ts` that reads `tokens.css` and requires 4.5:1 for ink and ink-dim on the sky, card and panel backgrounds, and for each state colour on the card background. Tune token values until it passes.
    - _Requirements: 1.10, 11.1_
  - [x] 5.3 Create `tests/css.test.ts`: every `animation`, `transition` and `@keyframes` in `entrypoints/newtab/styles` changes only `transform` and `opacity` and never uses `all`; `blur(` appears only as a `backdrop-filter` of at most 10 px on `.stats-panel`; no `url(` with a host name; no web address with a host name in `lib/` or `entrypoints/newtab/` except the suggestion address. It must pass now and keep guarding every later stylesheet.
    - _Requirements: 1.4 to 1.6, 10.2, 11.3, 11.4_

- [x] 6. Icons and shared components
  - [x] 6.1 Create `components/icons.tsx` with the custom gradient SVGs: Stake, Coffin, Crypt, Garlic, Remove garlic, Themes, Blood orb, Dawn, search magnifier, bat-wing brand mark, vampire emblem, and state shapes. Unique gradient ids via `useId`.
    - _Requirements: 1.5, 1.14, 2.7, 5.2_
  - [x] 6.2 Create `Tooltip.tsx` and `ActionButton.tsx` (`aria-disabled` and still focusable, tooltip via `aria-describedby`, fade through `opacity` and `transform`). Component tests: tooltip shows on hover and keyboard focus, disabled buttons ignore clicks and show their reason.
    - _Requirements: 5.2, 5.5, 5.6, 1.11, 11.2_
  - [x] 6.3 Create `SiteIcon.tsx` (favicon image at 16 px, no referrer, letter badge when missing or on `error`, no broken image) and `Vial.tsx` (glass tube, fill by `scaleY`, tick at one third, text label). Component tests for both.
    - _Requirements: 4.4, 4.5, 4.9, 11.2_

- [x] 7. Live data
  - [x] 7.1 Create `hooks/useCryptData.ts`: snapshot, tab events, `store.subscribe`, 60 second tick, visibility refresh, 150 ms debounce, sequence numbers so stale results are dropped, error handling that keeps the last good data, full cleanup on unmount.
    - _Requirements: 3.3 to 3.5, 9.4_
  - [x] 7.2 Component tests for the hook through a small test component: loads cards; a fired tab event updates cards; a storage change updates stats; a stale result is dropped; a failed first load gives `error` and `reload` recovers; listeners removed on unmount.
    - _Requirements: 3.3 to 3.5, 9.4, 11.2_

- [x] 8. Header
  - [x] 8.1 Create `Header.tsx`, `StatsPanel.tsx`, `HeaderButton.tsx`, `DawnButton.tsx` and `styles/header.css`: brand with mark, glass stats panel (translucent gradient, light edge, 10 px backdrop blur on `.stats-panel` only, opaque fallback), three figures with "est." tags, Themes and Blood Bank disabled with "Coming soon", Dawn sunrise button with count badge and disabled reason, wrapping under 900 px.
    - _Requirements: 1.6, 2.1 to 2.10, 6.1_
  - [x] 8.2 Component tests: the figures and tags, open tabs equals card count, memory sums, reclaimed comes from stats, Themes and Blood Bank are `aria-disabled` with "Coming soon", Dawn count and disabled state with its reason.
    - _Requirements: 2.2 to 2.9, 6.1, 11.2_

- [x] 9. Cards
  - [x] 9.1 Create `PortraitSlot.tsx`, `TabCard.tsx`, `CardGrid.tsx` and `styles/cards.css`: shrine card with arched top, state rim, state badge with shape and word, idle and memory lines, vial, fixed portrait slot, four action buttons, starving glow through `opacity`, hover lift through `transform`, entry animation, `role="list"` and `role="listitem"`.
    - _Requirements: 1.1, 1.9, 3.6, 4.1 to 4.8_
  - [x] 9.2 Create `hooks/useExitingCards.ts` for the 220 ms exit with reduced-motion skip, and use it in `CardGrid`.
    - _Requirements: 1.7, 5.7_
  - [x] 9.3 Component tests: one card per state with the right rim, state word, idle text, memory text and vial label; the letter badge when there is no icon and on image error; long titles keep the full title; empty titles fall back to the site name or "Untitled tab"; a removed card exits and is gone after 220 ms; with reduced motion it is gone at once.
    - _Requirements: 4.1 to 4.9, 11.2_

- [x] 10. Actions, Dawn and messages
  - [x] 10.1 Create `hooks/useToasts.ts`, `Toasts.tsx` and `styles/toasts.css` (up to 3 notices, 5 and 8 second lifetimes, `role="status"` and `role="alert"`, pointer events passed through).
    - _Requirements: 5.10_
  - [x] 10.2 Wire the card buttons in `App.tsx`: busy set, Spec 2 actions, `actionNotice`, reload after, Coffin and Crypt and Garlic enabling rules and tooltips, Garlic becoming Remove garlic on Protected cards.
    - _Requirements: 5.1 to 5.9_
  - [x] 10.3 Wire Dawn: count from `dawnTargets`, run `dawn()`, `dawnNotice`, disable Dawn and all card buttons while it runs.
    - _Requirements: 6.1 to 6.5_
  - [x] 10.4 Component tests: Coffin disabled for active and asleep tabs with a reason; Crypt and Garlic disabled for non-web tabs; each action runs once and shows its notice; a failure leaves the card and shows an error; buttons disabled while running; Garlic then Remove garlic; Dawn count, run, notice, failure notice, and disabled while running.
    - _Requirements: 5.1 to 5.10, 6.1 to 6.5, 11.2_

- [x] 11. Search
  - [x] 11.1 Create `hooks/useSuggestions.ts`: instant local suggestions, Google suggestions after 2 characters and a 200 ms pause, older requests aborted, results shown only for the current query, failures give an empty web list.
    - _Requirements: 7.3 to 7.7_
  - [x] 11.2 Create `SearchBox.tsx` and `styles/search.css`: combobox pattern, grouped listbox with kind tags, Arrow, Enter and Escape keys, mouse hover, Enter with no highlight runs the search, each kind runs its action (tab, pinned, crypt with `activate`, search).
    - _Requirements: 7.1 to 7.4, 7.8 to 7.10_
  - [x] 11.3 Component tests: local suggestions on the same keystroke; web suggestions only after the debounce and from 2 characters; a failed request keeps local ones with no error; keyboard use; each kind runs the right action; ARIA attributes are correct.
    - _Requirements: 7.1 to 7.10, 11.2_

- [x] 12. Pinned pages
  - [x] 12.1 Create `PinnedRow.tsx`, `AddPageForm.tsx` and `styles/pinned.css`: tiles, "Add page" popover with labelled fields, inline errors, focus handling, Escape, remove button on hover and focus, disabled at 12 with a tooltip.
    - _Requirements: 8.1 to 8.9_
  - [x] 12.2 Component tests: clicking opens the page in this tab; the form adds a page, rejects bad and duplicate addresses with plain messages, defaults the name, closes on Escape and returns focus; remove works; "Add page" disables at 12.
    - _Requirements: 8.1 to 8.9, 11.2_

- [x] 13. Page states and assembly
  - [x] 13.1 Create `EmptyState.tsx`, `ErrorState.tsx` (with "Try again") and the loading skeleton with the final grid's first-row height. Assemble `App.tsx`, `main.tsx` and the `<title>`.
    - _Requirements: 1.13, 9.1 to 9.4_
  - [x] 13.2 Component tests for `App`: loading layout is stable, no tabs shows the friendly message, tabs with none starving show cards and a disabled Dawn, a failed load shows "Try again" and recovers, search and pinned still work when tabs fail to load.
    - _Requirements: 9.1 to 9.4, 11.2_

- [x] 14. Visual check and polish
  - [x] 14.1 Build the extension and, if Playwright is available, load it in Chromium and capture the page with sample tabs at 360, 1280 and 2560 px wide. Review the screenshots against `style.md` (cute not gory, no face on any moon, plain words, sharp graphics) and fix layout, spacing and colour problems found. If Playwright cannot be used, say so and ask the user to load `.output/chrome-mv3` and report what they see.
    - _Requirements: 1.1, 1.5, 1.12_
    - _Checked manually by the user._ Screenshots were skipped at the user's request.
  - [x] 14.2 Re-run `tests/contrast.test.ts` and `tests/css.test.ts` after any style change.
    - _Requirements: 1.4, 1.10, 11.3_

- [x] 15. Final check
  - [x] 15.1 Run `npm run typecheck`, `npm test`, `npm run build` and `npm run build:firefox`. Confirm both manifests list only `tabs`, `storage`, `alarms` and `search`, plus the one host permission for `https://suggestqueries.google.com/*`. Confirm the built page code contains the suggestion `fetch` only.
    - _Requirements: 10.1 to 10.5, 11.5, 11.6_
