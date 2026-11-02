# Visual style: cute-spooky 3D graveyard

- Characters and props: Kenney Graveyard Kit (CC0) glTF models in `public/models/`, rendered with
  React Three Fiber into ONE shared canvas (`components/three/Portrait.tsx`, drei `View`).
- Backdrop: a full 3D graveyard (`components/three/GraveyardScene.tsx`) built from KayKit Halloween Bits
  (CC0): crypt, gate, fences, autumn/dead trees, graves, jack-o'-lanterns, candles, lanterns; moonlight
  shadows, fog, ground mist, ember sparkles, bloom and a slow camera drift. Sky life is low-poly 3D in the same scene
  (`components/three/SkyLife.tsx`): faceted clouds drifting in layers, witches on broomsticks, a bat flock and
  floating ghosts, plus 3D stars. Only the corner cobweb is SVG. Nothing in the scene may be flat 2D art.
- Every glowing thing (pumpkins, candles, lanterns, moon) uses a flickering `Flame` light + bloom.
- Each tab is a small graveyard island (gravestone, candle, prop) with the Kenney vampire.
- The Count (`components/three/vampire.tsx`): custom Tripo model (no skeleton), animated with whole-body
  motion. fresh=breathe + look at cursor, feeding=happy bounce, starving=hunched pacing + red glow,
  garlic=leans back trembling, turned away. stake=topples backwards, burn=ember glow + float away,
  crypt=spinning hop → bat, coffin=sinks as the coffin rises, cheer=spinning hop.
- Mood: cute, not gory.
- Palette (see `components/theme.css`): night `#120e22`, crypt purple `#1d1838`/`#3c3489`,
  mist `#cecbf6`, bone `#f1efe8`, blood `#a32d2d`/`#e24b4a`, garlic green `#97c459`.
- Fonts (bundled via @fontsource, no network): Grenze Gotisch for display titles, Cormorant SC for
  small-caps labels and badges, Manrope for body text and numbers.
- Motion is meaningful: breathe = alive, twitch + eye glow = starving, drip = feeding,
  dust = staked. Always respect `prefers-reduced-motion`.
- Copy is short and playful but always says what happens ("Crypt" tooltip: "Save for later and close").
