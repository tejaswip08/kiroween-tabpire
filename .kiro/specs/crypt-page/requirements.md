# Requirements: The Crypt new tab page (Spec 3)

## Introduction

This spec builds "The Crypt", the page that replaces the new tab. It shows one shrine card for every other open tab, a header with live stats and the Dawn button, a search box with suggestions, and a row of pinned pages. It uses the tab rules, actions and storage from Specs 1 and 2, and follows `.kiro/steering/style.md`.

Out of scope, because the roadmap assigns them to later specs: the 3D graveyard, moon and animated vampire (Spec 4), the theme panel and other themes (Spec 5), and the Blood Bank page and toolbar popup (Spec 6).

## Glossary

- **Card**: the shrine card that represents one open tab.
- **Rim**: the coloured edge of a card. Its colour shows the tab's state.
- **Vial**: the glass blood-vial hunger meter on a card.
- **Portrait slot**: the reserved area on a card where the vampire picture goes. Spec 4 puts the 3D vampire in it.
- **Pinned page**: a page the user saved in the row under the search box. It is not a browser-pinned tab.
- **Theme tokens**: the CSS custom properties that hold all colours.

## Decisions (settled)

1. **Google suggestions:** included, after the local matches. The typed text is sent to `suggestqueries.google.com`, and the manifest gains `host_permissions` for that one address. Tab data is never sent. This relaxes the "no host permissions" check from Spec 2.
2. **Themes and Blood Bank buttons:** rendered now and disabled, with the tooltip "Coming soon", so the header layout is final.
3. **Site icons:** the page uses the tab's own `favIconUrl` as the image, and falls back to a letter badge only when it is missing or fails to load. Note: when the browser does not have the icon cached, the image request goes to that site, which is a second network use besides suggestions. See Requirement 10.
4. **Blur:** the "no blur" rule means never lowering graphics quality. It does not ban frosted glass. The header stats panel gets a light backdrop blur of about 10 px, kept only if it holds 60 fps.

## Assumptions (please confirm or change)

1. **Which tabs get a card.** Every open tab in every window except the one showing The Crypt, other Tabpire pages, and blank new tab pages.
2. **Sorting.** Cards are sorted by idle time, longest first, with ties broken by tab id. Active and audible tabs have 0 idle time, so they come last.
3. **Hunger vial.** The vial is full at 3 days idle. A tick mark on the vial shows the 1 day line where a tab becomes Starving. This keeps the vial meaningful.
4. **Dawn button.** It is enabled when Dawn would close at least one tab, and the count is shown on it. The roadmap says "disabled when nothing is starving". A starving tab that is pinned or has no web URL is something Dawn will not close, and a button that does nothing when clicked would be confusing.
5. **Garlic on a protected card** turns into "Remove garlic" and calls Un-garlic from Spec 2.
6. **Site icon.** A card shows the tab's `favIconUrl` as an image, sized at its natural 16 px so it stays sharp, inside a rounded plate. It sends no referrer. If the icon is missing or fails to load, the card shows a letter badge made from the site name.
7. **Fonts.** Grenze Gotisch for the brand and headings, Sora for labels (stat labels, state badges, buttons, tooltips), Outfit for body text (tab titles, search text, messages).
8. **Glass.** The stats panel uses a translucent gradient, a light edge, a soft shadow, and a backdrop blur of about 10 px. It is the only element with a blur, and the blur is never animated. WHERE the browser does not support backdrop blur, the panel falls back to a more opaque fill.
9. **Portrait slot.** The card reserves the portrait slot now, so Spec 4 does not change the card layout. Until then the slot shows a flat vampire emblem drawn as SVG in the state's colour.
10. **Background.** Until Spec 4, the page background is a static night-sky gradient with a dark vignette.
11. **Tooltips** show the roadmap name and a plain-words explanation, for example "Stake: close this tab".
12. **Choosing a crypt suggestion** reopens that tab, brings it to the front, and removes it from the crypt. This adds an option to Resurrect from Spec 2 to open the tab in the foreground.
13. **Pinned pages** are limited to 12, accept http and https addresses, and each can be removed.
14. **Memory above 1000 MB** is shown in GB, for example "~1.4 GB", always with the "~".
15. **Live updates.** The page refreshes when tabs change, when data changes in any other Tabpire page, and once a minute for idle times.

## Requirements

### Requirement 1: Look, fonts and motion

**User story:** As a user, I want a polished cute-spooky page that feels solid and readable, so that cleaning up tabs is pleasant.

#### Acceptance criteria

1. THE page SHALL look cute-spooky with a 3D feel: raised cards with bevelled edges, layered shadows, and glass-like vials. It SHALL NOT show gore, skulls, or blood splatter.
2. THE page SHALL use Grenze Gotisch, Sora and Outfit as in assumption 7, loaded from `@fontsource` packages bundled with the extension. It SHALL NOT load fonts, scripts or stylesheets from the network.
3. THE page SHALL use plain words for every label, message and tooltip.
4. EVERY CSS animation and transition SHALL change only `transform` and `opacity`.
5. THE page SHALL NEVER lower graphics quality to gain speed: no downscaled or low-resolution rendering, no reduced image quality, and no blurry substitutes. All icons that Tabpire draws SHALL be vector SVG.
6. THE only blur on the page SHALL be a backdrop blur of at most 10 px on the header stats panel (assumption 8). IT SHALL be static and SHALL NOT be animated. IF it is measured to drop below 60 fps, THEN it SHALL be reduced or removed rather than other graphics being degraded.
7. WHEN the user's system asks for reduced motion, THE page SHALL turn off all animation and show state changes without movement.
8. ALL colours SHALL come from theme tokens, with The Crypt values defined in this spec, so Spec 5 can change colours without changing the layout.
9. THE state colours SHALL be: Awake, Starving, Asleep and Protected each with its own distinct colour. A state SHALL always also be shown as text, never by colour alone.
10. THE text SHALL meet a contrast ratio of at least 4.5:1 against its background.
11. EVERY interactive element SHALL be reachable and usable by keyboard, with a visible focus ring.
12. THE page SHALL work from 360 px to 2560 px wide.
13. THE document title SHALL be "Tabpire".
14. THE moon, when added in Spec 4, SHALL be a plain red glowing disc with no face. THIS spec SHALL NOT draw any moon with a face.

### Requirement 2: Header

**User story:** As a user, I want a header that shows the state of my browser at a glance, so that I know how much is draining memory.

#### Acceptance criteria

1. THE header SHALL show the brand "Tabpire" on the left, one centred glass stats panel, and the buttons Themes, Blood Bank and Dawn on the right.
2. THE stats panel SHALL show three figures: open tabs, estimated memory, and memory reclaimed.
3. THE open tabs figure SHALL be the number of cards.
4. THE estimated memory figure SHALL be the sum of the estimates for the cards, shown with "~".
5. THE memory reclaimed figure SHALL be `mbFreed` from the stored stats, shown with "~".
6. EACH of the three figures SHALL carry an "est." tag.
7. THE Blood Bank button SHALL show a blood orb icon.
8. THE Themes and Blood Bank buttons SHALL be disabled with the tooltip "Coming soon" (decision 2).
9. THE Dawn button SHALL use a sunrise style and be disabled when Dawn has no targets, with a tooltip that says why.
10. WHEN the width is too narrow for one row, THE header SHALL wrap so the stats panel stays fully visible.

### Requirement 3: Card list

**User story:** As a user, I want one card per other open tab, hungriest first, so that I can see what to deal with.

#### Acceptance criteria

1. THE page SHALL show one card for each tab described in assumption 1.
2. THE cards SHALL be sorted as in assumption 2.
3. WHEN a tab opens, closes, changes, or is activated, THE page SHALL update within 1 second without a reload.
4. WHEN data changes in another Tabpire page, THE page SHALL update to match.
5. THE page SHALL recompute states and idle times once a minute, using the current time passed in to the rules.
6. THE card layout SHALL be a responsive grid, and each card SHALL keep a stable position while its content changes, except for the sort order.
7. THE page SHALL handle at least 300 open tabs without freezing.

### Requirement 4: Card content

**User story:** As a user, I want each card to tell me what the tab is and how hungry it is, so that I can decide quickly.

#### Acceptance criteria

1. EACH card SHALL show: a rim coloured by state, the site icon (assumption 6), the tab title, a state badge in text, the idle time, the estimated memory with "~", the vial, and the portrait slot.
2. THE rim colour SHALL come from the state, as given by `stateOf` with the stored garlic list and the current time.
3. THE idle time SHALL read in plain words, such as "just now", "5 hours idle" or "3 days idle". WHEN the last-used time is unknown, it SHALL read "Idle time unknown".
4. THE vial fill SHALL be the idle time divided by 3 days, capped at full, with the 1 day tick mark.
5. THE vial SHALL also give a text alternative with the idle time, for screen readers.
6. WHEN the title is empty, THE card SHALL show the site name, or "Untitled tab".
7. LONG titles SHALL be cut with an ellipsis, with the full title available on hover and focus.
8. THE portrait slot SHALL have a fixed size and position, so that Spec 4 can fill it without changing the layout.
9. THE site icon SHALL be the tab's `favIconUrl` image, with no referrer sent, shown at its natural size. WHEN the URL is missing or the image fails to load, THE card SHALL show the letter badge instead, and SHALL NOT show a broken image.

### Requirement 5: Card actions

**User story:** As a user, I want to act on a tab from its card, so that I can free memory without leaving the page.

#### Acceptance criteria

1. EACH card SHALL have four icon buttons: Stake, Coffin, Crypt and Garlic.
2. EACH button SHALL be a custom gradient SVG icon with no icon library, with a tooltip on hover and keyboard focus and an accessible name (assumption 11).
3. ON a Protected card, THE Garlic button SHALL become "Remove garlic" and call Un-garlic (assumption 5).
4. THE buttons SHALL call the actions from Spec 2.
5. THE Coffin button SHALL be disabled, with the reason in its tooltip, for tabs that are active or already asleep.
6. THE Crypt and Garlic buttons SHALL be disabled, with the reason in the tooltip, for tabs without a web address.
7. WHEN an action succeeds, THE card SHALL leave or update, and a short message SHALL describe what happened in plain words, for example "Closed. About ~120 MB freed."
8. WHEN an action fails, THE card SHALL stay as it was, and a short message SHALL say what went wrong in plain words.
9. WHILE an action is running on a card, THE card's buttons SHALL be disabled so it cannot run twice.
10. MESSAGES SHALL be announced to screen readers and disappear after a few seconds, and SHALL not hide the cards.

### Requirement 6: Dawn

**User story:** As a user, I want to clean up all starving tabs with one click, so that I do not have to close them one by one.

#### Acceptance criteria

1. THE Dawn button SHALL show the number of tabs Dawn would close, taken from the same rule Dawn uses (`dawnTargets`).
2. WHEN clicked, THE button SHALL call Dawn from Spec 2.
3. WHEN Dawn finishes, THE page SHALL show a message with how many tabs were closed and saved to the Crypt, and the memory freed with "~".
4. WHEN Dawn fails, THE page SHALL show a plain message and SHALL state that no tabs were closed.
5. WHILE Dawn is running, THE Dawn button and the card buttons SHALL be disabled.

### Requirement 7: Search

**User story:** As a user, I want to search from the new tab page and jump to things I already have, so that I do not need the address bar.

#### Acceptance criteria

1. THE page SHALL have one search box that searches with the browser's default search engine, using the `search` permission.
2. WHEN the user presses Enter with text and no suggestion highlighted, THE page SHALL search that text in the current tab.
3. AS the user types, THE page SHALL show suggestions in this order: open tabs, pinned pages, crypt items, then Google suggestions.
4. LOCAL suggestions SHALL match the typed text against title and address, ignoring case, SHALL show at most 3 per group, and SHALL show instantly.
5. GOOGLE suggestions SHALL be requested only after at least 2 typed characters, after 200 ms of no typing, and SHALL show at most 5. A newer request SHALL cancel an older one.
6. THE only data sent to Google SHALL be the typed text. No tab, title, address or crypt data SHALL be sent.
7. IF the Google request fails, is slow, or the device is offline, THEN THE page SHALL show local suggestions only and SHALL NOT show an error.
8. CHOOSING an open tab suggestion SHALL switch to that tab and its window. CHOOSING a pinned page SHALL open it in the current tab. CHOOSING a crypt item SHALL reopen it in the foreground and remove it from the crypt (assumption 12). CHOOSING a Google suggestion SHALL search for it.
9. THE suggestion list SHALL work with the keyboard: Arrow keys move, Enter chooses, Escape closes. IT SHALL follow the combobox pattern for screen readers.
10. EACH suggestion SHALL show a plain label for its kind: "Open tab", "Pinned page", "Crypt" or "Search".
11. THE manifest SHALL gain `host_permissions` for the one suggestion address and nothing else (decision 1).

### Requirement 8: Pinned pages

**User story:** As a user, I want a row of my favourite pages under the search box, so that I can open them in one click.

#### Acceptance criteria

1. THE pinned pages row SHALL sit below the search box and show each page with its letter badge and title.
2. CLICKING a pinned page SHALL open it in the current tab.
3. THE row SHALL end with an "Add page" button.
4. THE "Add page" button SHALL open a small form with an address field and an optional name field. The form SHALL accept only http and https addresses, show a plain message for a bad one, and default the name to the site name.
5. THE form SHALL be usable by keyboard and SHALL close on Escape.
6. EACH pinned page SHALL have a remove button with a tooltip, visible on hover and keyboard focus.
7. THE row SHALL hold at most 12 pages. AT 12, THE "Add page" button SHALL be disabled with a tooltip that says why.
8. PINNED pages SHALL be stored with the pinned pages data from Spec 1.
9. ADDING an address that is already pinned SHALL not create a duplicate.

### Requirement 9: Empty, loading and error states

**User story:** As a user, I want the page to say what is going on when there is nothing to show, so that it never looks broken.

#### Acceptance criteria

1. WHILE data loads, THE page SHALL show the header and search box in their final positions, with no layout jump when the cards arrive.
2. WHEN there are no other open tabs, THE page SHALL show a friendly message, in plain words, that nothing is draining memory.
3. WHEN there are tabs but none is Starving, THE page SHALL still show the cards, with Dawn disabled.
4. IF reading tabs or storage fails, THEN THE page SHALL show a plain message and a "Try again" button, and the search box and pinned pages SHALL still work where possible.

### Requirement 10: Local-first and permissions

**User story:** As a user, I want my tab data to stay in my browser, so that I can trust the extension.

#### Acceptance criteria

1. THE only requests THE page SHALL make itself are the suggestion request in Requirement 7 and the tab icon images in Requirement 4.9. THE tab icon images are the only way tab-related addresses can reach the network, because the browser may fetch an icon that it has not cached. THE page SHALL send no tab titles, addresses or crypt data in any request.
2. THE page SHALL NOT load remote fonts, scripts, stylesheets or other images, and SHALL NOT load tab icons for pinned pages (they use the letter badge).
3. THE page SHALL read and write stored data only through `lib/store.ts`.
4. THE manifest permissions SHALL remain `tabs`, `storage`, `alarms` and `search`, plus the one host permission in Requirement 7.
5. THE extension's content security policy SHALL stay at the browser default.

### Requirement 11: Tests and quality

**User story:** As a developer, I want the page's logic tested, so that it keeps working as the 3D scene and themes arrive.

#### Acceptance criteria

1. PURE helpers SHALL cover: sorting, idle time text, vial fill, memory formatting, which tabs get a card, suggestion matching and merging, and pinned page validation. EACH SHALL have tests, with property-based tests for sorting and vial fill.
2. COMPONENT tests SHALL cover: header figures, a card for each state, button enabling and tooltips, Garlic turning into Remove garlic, message display, Dawn count and disabled state, search keyboard behaviour, and the Add page form.
3. A TEXT check SHALL confirm that all CSS animations and transitions change only `transform` and `opacity`, and that `blur(` appears only as a `backdrop-filter` of at most 10 px on the stats panel rule.
4. A TEXT check SHALL confirm no web address with a host name appears in page code or styles except the suggestion address.
5. THE tests SHALL run with `npm test` and pass with the Spec 1 and Spec 2 tests.
6. `npm run typecheck`, `npm run build` and `npm run build:firefox` SHALL pass.
