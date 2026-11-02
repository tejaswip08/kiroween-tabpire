# Design: Tabpire core

```
background.ts ── alarms(1 min) + tab events ──► badge = # starving
newtab (Crypt) ─┐
popup ──────────┼─ useCrypt() ── readTabs() + load() + now()
bloodbank ──────┘        │
                         ▼
               lib/hunger.ts  (pure rules: stageOf, pallor, appetiteMb, dawnTargets, rankFor)
               lib/tabs.ts    (stake, coffin, crypt, dawn, resurrect, toggleGarlic)
               lib/store.ts   (storage.local: stats, log, crypt, garlic, timeWarpMs)
```

## Data
- `TabLike`: id, url, title, favIconUrl, lastAccessed, active, audible, discarded, pinned.
- `Stats`: reclaimedMb, staked, coffined, crypted, dawns.
- `LogEntry`: at, action, title, url?, mb, count?.
- `CryptEntry`: url, title, favIconUrl?, at.

## Memory estimate
Stable Chrome has no per-tab memory API (`chrome.processes` is Dev channel only), so
`appetiteMb` = known-heavy-site table or 80 MB base, +150 MB if audible, 0 if discarded.

## Testing
- `tests/hunger.test.ts` uses fast-check properties for the safety rules (garlic never burned,
  Dawn never touches active/audible/pinned/coffined tabs, hunger monotonic, pallor in 0..1).
- Dev-only debug bar on the Crypt: time warp (+2 h / +1 day), spawn test tabs, reset.
