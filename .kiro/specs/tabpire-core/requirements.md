# Requirements: Tabpire core

## R1 The Crypt (new tab page)
- WHEN the user opens a new tab THEN the system SHALL show every other open tab as a vampire card.
- Each card SHALL show the tab title, favicon pendant, hunger stage, idle time and estimated memory.
- Cards SHALL be sorted hungriest first (starving, feeding, fresh, coffin, garlic).

## R2 Hunger stages
- A tab on a garlic-protected site SHALL be `garlic`.
- A discarded tab SHALL be `coffin`.
- An active or audible tab SHALL be `feeding`.
- Otherwise idle ≥ 1 day SHALL be `starving`, else `fresh`. (There is no in-between state; pallor and the hunger bar show progress through the day.)
- Hunger and pallor SHALL never decrease while a tab stays unused.

## R3 Actions
- Stake SHALL close the tab and log the estimated memory reclaimed.
- Coffin SHALL discard the tab (not allowed for the active tab).
- Crypt SHALL save the tab's URL/title to the Crypt and close it.
- Garlic SHALL toggle protection for the tab's whole host.
- Dawn SHALL close all starving tabs that are not pinned, saving each to the Crypt.

## R4 Toolbar
- The toolbar badge SHALL show the number of starving vampires, refreshed at least every minute.
- The popup SHALL offer Dawn, Open the Crypt and Blood Bank.

## R5 Blood Bank
- SHALL show memory reclaimed, vampires slain, coffined count and hunter rank.
- SHALL show a feeding log (newest first, max 500 entries).
- SHALL list Crypt entries with search and Resurrect (reopen + remove from Crypt).
- SHALL list garlic sites with Remove.

## R6 Privacy
- The extension SHALL make no network requests and SHALL store data only in `storage.local`.
