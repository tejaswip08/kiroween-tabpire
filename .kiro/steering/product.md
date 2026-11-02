# Product: Tabpire

Tabpire is a browser extension (Chrome + Firefox) that turns every open tab into a vampire
draining your memory and attention. Built for the Kiroween 2026 Costume Contest.

## Core rule: the costume IS the function
Every spooky element must carry information or perform an action. Never add decoration
that means nothing.

| Spooky element | Meaning / action |
| --- | --- |
| Awake | Used in the last day, open now, or playing sound (greys gradually through the day) |
| Starving (red border, red glow) | Idle ≥ 1 day — worth killing |
| Asleep | In a coffin (discarded), uses no memory |
| Protected | Site has garlic, never hunted |
| Stake | Close the tab |
| Coffin | Discard (suspend) the tab, freeing memory |
| Crypt | Save the tab for later, then close it |
| Garlic | Protect a whole site from ever being flagged |
| Dawn | Burn every starving vampire at once, saving them to the Crypt |
| Blood Bank | Stats, feeding log, saved tabs, hunter rank |

## Naming rule
Each state has exactly ONE user-facing name (Awake, Starving, Asleep, Protected), used on the
legend, card badges and explainers alike. Never introduce a synonym.

## Principles
- Local-first. No backend, no analytics. Tab data never leaves the browser. Only pinned-page icons are
  fetched (site /favicon.ico, then DuckDuckGo's icon service), plus search-box suggestions from Google's
  suggestion service (host permission `suggestqueries.google.com`). Local suggestions (tabs, pages, crypt) come first.
- Minimal permissions: `tabs`, `storage`, `alarms`, `search` (search uses the browser's default engine).
- Nothing is lost by accident: Dawn never touches pinned, active, audible or garlic tabs.
- Memory figures are estimates; always label them with `~`.
