# Implementation Plan: Popup and Blood Bank (Spec 6)

- [x] 1. Data for the Blood Bank
  - [x] 1.1 Store `mb` on log entries that freed memory (`lib/store.ts`, `lib/tabs.ts`), keep older entries valid. _Requirements: 2.3_
  - [x] 1.2 Add `forgetCrypt(id)` to `lib/tabs.ts`. _Requirements: 3.2_
  - [x] 1.3 Add the pure helpers in `lib/bloodbank.ts` with `tests/bloodbankData.test.ts`. _Requirements: 1.2, 2.1, 2.2, 3.1, 4.2_
- [x] 2. Blood Bank page
  - [x] 2.1 Header, sub line and "← Back to the Crypt". _Requirements: 1.1_
  - [x] 2.2 Stat tiles with the rank bar. _Requirements: 1.2_
  - [x] 2.3 Hunt log with icons, time, action, title and ~MB, and its empty text. _Requirements: 2.1, 2.2_
  - [x] 2.4 The crypt: search, links, Resurrect and Delete. _Requirements: 3.1, 3.2_
  - [x] 2.5 Garlic sites with Remove and the empty text. _Requirements: 4.1, 4.2_
  - [x] 2.6 Two columns on wide screens, themed styles, shared page styles in `main.tsx`; `tests/ui/bloodbank.test.tsx`. _Requirements: 5.1, 5.2_
- [x] 3. Toolbar popup
  - [x] 3.1 `entrypoints/popup/index.html`, `main.tsx`, `popup.css`, `Popup.tsx`, and `default_popup` in `wxt.config.ts`. _Requirements: 6.1_
  - [x] 3.2 Portrait with the starving look, eyebrow, heading and sub line (`lib/popupText.ts`). _Requirements: 6.2_
  - [x] 3.3 Wide Dawn button, disabled as "No one to burn". _Requirements: 6.3_
  - [x] 3.4 "Open the Crypt" and the Blood Bank button with the total reclaimed; `tests/ui/popup.test.tsx`. _Requirements: 6.4_
- [x] 4. Web demo
  - [x] 4.1 Replace the popup placeholder with `DemoPopup`; update the demo route and action tests. _Requirements: 7.1_
