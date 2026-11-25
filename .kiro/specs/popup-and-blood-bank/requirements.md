# Requirements Document

## Introduction
This spec (Spec 6 in the roadmap) builds the full Blood Bank page and the toolbar popup, as in the earlier prototype.
Both read the same local data as the Crypt (`lib/store.ts`), follow the active theme, and work in the web demo against
the fake browser. No data leaves the browser.

## Glossary
- **Blood_Bank_Page**: `entrypoints/bloodbank/`, the history page.
- **Popup**: `entrypoints/popup/`, the toolbar action popup.
- **Hunt_Log**: the action log (`tabpire:log`), newest first.
- **Crypt_List**: the saved tabs (`tabpire:crypt`).
- **Garlic_List**: the protected sites (`tabpire:garlic`).

## Requirement 1: Blood Bank header and totals
**User Story:** As a user, I want to see what I reclaimed from my tabs, so the hunt feels worth it.
1. THE Blood_Bank_Page SHALL show the title "The Blood Bank", the sub line "Everything you've reclaimed from the vampires. Stored only in this browser." and a "← Back to the Crypt" button that opens the Crypt in the same tab.
2. THE Blood_Bank_Page SHALL show four stat tiles: Blood reclaimed (with "~"), Vampires slain, Coffined, and Hunter rank with a rank progress bar.

## Requirement 2: Hunt log
1. THE Blood_Bank_Page SHALL show "Hunt log" with one row per log entry, newest first: an icon per action, the time, the action word (Staked, Coffined, Sent to crypt, Resurrected, Garlic, Dawn), the tab title (or its site) and the entry's ~MB when it freed memory.
2. WHEN the log is empty, THE Blood_Bank_Page SHALL show "No hunts yet. Open a new tab to meet your vampires."
3. Every logged action that frees memory SHALL store its estimate on the entry (`mb`).

## Requirement 3: The crypt
1. THE Blood_Bank_Page SHALL show "The crypt · N" with a "Search saved tabs" box that filters by title, address and site.
2. Each saved tab SHALL show its site icon, its title as a link, a Resurrect button (reopens the tab and removes it from the crypt) and a Delete button (removes it without reopening).

## Requirement 4: Garlic sites
1. THE Blood_Bank_Page SHALL show "Garlic · protected sites" with each site and a Remove button.
2. WHEN no site is protected, THE Blood_Bank_Page SHALL show "None yet. Hang garlic on a vampire to protect its site."

## Requirement 5: Layout and theme
1. ON wide screens the hunt log SHALL be the left column and the crypt and garlic lists the right column; on narrow screens they stack.
2. THE Blood_Bank_Page and THE Popup SHALL use the active theme's tokens.

## Requirement 6: Toolbar popup
1. THE Popup SHALL be the manifest action's `default_popup`.
2. THE Popup SHALL show a small vampire portrait that has the starving look when any tab is starving, the eyebrow "Tabpire", the heading "N starving" or "All fed", and the sub line "N vampires · ~X draining".
3. THE Popup SHALL have a wide "Dawn · burn N" button that runs Dawn; WHEN nothing can be burned it SHALL be disabled and read "No one to burn".
4. THE Popup SHALL have "Open the Crypt" and a Blood Bank button that shows the total reclaimed; each opens its page.

## Requirement 7: Web demo
1. THE demo's `#/popup` route SHALL render the real Popup (no placeholder) and `#/bloodbank` the real Blood_Bank_Page, against the fake browser.
