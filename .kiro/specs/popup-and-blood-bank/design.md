# Design: Popup and Blood Bank

## Data
- `lib/store.ts`: `LogEntry` gets an optional `mb` (validated as a finite number; older entries without it stay valid).
- `lib/tabs.ts`: `recordActions` writes `mb` on entries that freed memory. New `forgetCrypt(id)` deletes a saved tab. `resurrect` and `ungarlic` are reused.
- `lib/bloodbank.ts` (pure): `LOG_WORD`, `logTime(at, now)` ("14:05", "Yesterday 09:12", "3 Nov 18:40"), `logRows(log, now)` newest first, `searchCrypt(items, query)`, `bankTotals(stats)` (reclaimed, slain, coffined, rank, progress, note) and the empty texts.
- `lib/popupText.ts` (pure): `popupHeading`, `popupSub`, `popupDawn`.

## Blood Bank page (`entrypoints/bloodbank/BloodBank.tsx`)
- `useBloodBank()` loads stats, log, crypt and garlic, and reloads on every store change, so actions in other tabs show at once.
- Header, a `<dl>` of four tiles (the rank tile is wider and holds the rank bar), then `.bb-columns`: the hunt log section, and a side column with the crypt section (search box, list) and the garlic section.
- One action at a time (`busy`); buttons stay focusable with `aria-disabled`.
- `main.tsx` imports the Crypt's `styles.ts`, so the page has the same fonts, tokens, site icons and tips.

## Popup (`entrypoints/popup/`)
- `Popup` uses `useCrypt()` (tabs, garlic, stats), `dawnTargets` for the count, `dawn()` for the button and `openCrypt`/`openBloodBank` for the row. `onDone` closes the extension popup (`window.close`); the demo passes nothing.
- The portrait is the flat `VampireEmblem` (no WebGL in the popup, so it opens at once), framed in the state colour.
- `wxt.config.ts`: `action.default_popup = 'popup.html'`.

## Demo
- `demo/src/DemoPopup.tsx` renders `Popup` in a popup-sized frame; the placeholder is removed.

## Testing
- `tests/bloodbankData.test.ts`: the pure helpers.
- `tests/ui/bloodbank.test.tsx`: headings, tiles, empty texts, log order and ~MB, search, Resurrect, Delete, Remove garlic, back button.
- `tests/ui/popup.test.tsx`: words, starving look, Dawn, the two buttons and `onDone`, entrypoint and demo wiring.
- `tests/demo/actions.test.tsx` and `tests/demo/routes.test.tsx`: the pages inside the demo.
