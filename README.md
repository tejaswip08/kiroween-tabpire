# 🧛 Tabpire

**Your tabs are draining you. Stake them.**

Tabpire turns every open browser tab into a vampire. The longer you ignore a tab, the paler
and hungrier it gets, until it's starving and glowing red. Open a new tab to face them in the Crypt.

| Action | What it does |
| --- | --- |
| 🗡 Stake | Close the tab |
| ⚰ Coffin | Suspend the tab to free memory |
| 🏺 Crypt | Save for later, then close |
| 🧄 Garlic | Never flag this site |
| ☀ Dawn | Burn every starving vampire at once (saved to the Crypt) |

The **Blood Bank** tracks memory reclaimed, a feeding log, your saved tabs and your hunter rank.

Local-first: no backend, no analytics, nothing about your tabs leaves the browser. The only network requests are
icons for your pinned pages (from the site itself, or DuckDuckGo's icon service) and search suggestions
(what you type in the search box goes to Google's suggestion service, as in Chrome's address bar). Permissions: `tabs`, `storage`, `alarms`, `search`. The Crypt has a search bar with suggestions (your open tabs, pinned pages and crypt first, then web suggestions; searches use your browser's default engine) and up to 10 pinned pages you can add, edit and remove, like bookmarks.
Memory per tab is an estimate (stable Chrome doesn't expose per-tab memory to extensions).

## Run it

```bash
npm install
npm run dev            # opens Chrome with Tabpire loaded and hot reload
npm run dev:firefox    # same, in Firefox
```

The dev build shows a debug bar at the bottom of the Crypt: time warp (+2 h / +1 day) so you can
see vampires go pale and starve instantly, and "Spawn test tabs".

### Install a build manually
```bash
npm run build
```
Then open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and pick
`.output/chrome-mv3`.

## Test
```bash
npm run typecheck
npm test               # fast-check property tests for the hunger and Dawn safety rules
```

## Built with Kiro
Specs, steering docs and hooks live in [`.kiro/`](.kiro). Built for the Kiroween 2026 Costume Contest.

## Credits
3D models (CC0): [Halloween Bits](https://kaylousberg.itch.io/halloween-bits) by Kay Lousberg (KayKit) and
[Graveyard Kit](https://kenney.nl/assets/graveyard-kit) by Kenney, in `public/models/`.

The Count (vampire mascot): our own concept art generated with Meshy, turned into a 3D model with
Tripo AI (free plan: public, non-commercial). Source art in `art/vampire-concept.png`.

## License
MIT (code). Kenney and KayKit models are CC0. The vampire model is for non-commercial use.
