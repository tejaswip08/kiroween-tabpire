# Tech conventions

- Framework: WXT (Manifest V3) + React 19 + TypeScript (strict). Plain CSS, no UI library.
- Entrypoints live in `entrypoints/`: `background.ts`, `newtab/` (the Crypt), `popup/`, `bloodbank/`.
- `lib/hunger.ts` is **pure**: no `browser` imports, no `Date.now()`. Time is always passed in.
  All hunger/appetite/Dawn rules go here so they can be property-tested.
- `lib/store.ts` owns `browser.storage.local`. `lib/tabs.ts` owns tab actions.
- Import `browser` from `wxt/browser`, never use the `chrome` global directly (Firefox support).
- Every rule change in `lib/hunger.ts` needs a fast-check property in `tests/`.
- Dev-only features (time warp, spawn test tabs) must be gated by `import.meta.env.DEV`.
- Before claiming done: `npm run typecheck && npm test && npm run build`.
