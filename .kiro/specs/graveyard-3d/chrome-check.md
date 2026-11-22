# What to check in Chrome (Spec 4)

Load it: `npm run build`, open `chrome://extensions`, turn on Developer mode, choose "Load unpacked", pick `.output/chrome-mv3`, open a new tab. Add `#fps` to the address to see frames per second, worst frame time, and draw calls and triangles for each canvas. (Firefox: `npm run build:firefox`, load `.output/firefox-mv3`.)

I could not look at the pictures, so these are the things only your eyes can confirm.

## 1. Things I guessed (change a number, rebuild)

| What to look at | If it is wrong | File and number |
| --- | --- | --- |
| The vampire faces you | It looks away or sideways: try `Math.PI`, then `Math.PI / 2` or `-Math.PI / 2` | `lib/vampire/rig.ts`, `VAMPIRE.facingYaw` (now `0`) |
| In the Asleep card the closed eyelids sit on the eyes | Lids too high or low: change `eyeY` (now `0.8`, share of height). Too wide or narrow apart: `eyeX` (now `0.16`, share of width). Lid size: `eyelidWidth` (now `0.11`) | `lib/vampire/rig.ts`, `VAMPIRE` |
| The Asleep vampire lies on its back inside the coffin, face up | Sinks too deep or floats: `y` and `z` in `coffinFit()`. Lid in the way: `lidOpenAngle` (now `1.15`) and `lidOpenShift` | `lib/vampire/rig.ts` |
| The crypt doorway glow sits on the door | Moves it: `CRYPT_DOOR_LOCAL` (now x 0, y 1.3, z 4.05). Its size is `args={[1.9, 2.7]}` | `lib/scene/layout.ts`; `layers/scene/Props.tsx` |

## 2. The scene

1. The red moon sits in the upper right, clear of the header buttons, with a soft halo and no face. Resize the window to 1280 px wide and to a tall narrow shape: the moon stays visible.
2. Clouds drift above and below the moon and never cover it.
3. Warm and cold contrast: orange glow near the crypt door, the gate lanterns and the jack-o'-lanterns, on the ground and in the mist, against blue-violet shadows.
4. Mist layers drift at different speeds. Fog thickens with more open tabs (memory estimate).
5. Shadows of graves and trees fall on the ground and refresh a little at a time (every 20 frames) without flicker.
6. Everything that glows blooms: moon, flames, lanterns, doorway, embers. Nothing else does.
7. The camera drifts very slowly and never jumps.
8. With Crypt items there are ghosts (up to 8). With saved tabs, bats (up to 24). With protected sites, lit candles (up to 12). Staked tabs add new graves, put-to-sleep tabs add coffins in the left yard. When Dawn would close tabs, a witch crosses the sky; after Dawn she sweeps away.
9. The look numbers (bloom strength, fog, light strength) are in one block: `lib/scene/config.ts`, `LOOK`.

## 3. The cards

1. Each card shows a 3D vampire inside the arch. Until it loads you see the flat emblem, then it fades. The card looks as it did before around it.
2. Awake: breathes and turns its head toward your cursor. Starving: hunched, paces, pulsing red glow. Protected: leans back and trembles. Asleep: in the open coffin, eyes closed, little "z" letters rise.
3. Tooltips, the suggestion list and messages are above the portraits.
4. Scroll fast: a portrait may trail its card by one frame (known, from two canvases).
5. Exits: Stake (topples back), Crypt (turns into a bat that flies up), Dawn (burns to embers, one card after another), Coffin (coffin rises, the vampire lies down, ends asleep). A tab closed some other way fades and sinks.

## 4. Speed and fallbacks

1. `#fps`: aim for 60 fps with 15 tabs. Report the draw calls and triangles. Software rendering in my test gave about 76 draw calls and 90,000 triangles, with a peak near 142,000 on the frame the shadow map refreshes (limit 150,000). Per vampire: about 10,000 triangles.
2. If frames drop: the stats panel blur (Spec 3) first, then the mist layers (`Mist.tsx`), as designed.
3. Turn on "reduce motion" in the system settings: nothing drifts or moves, and cards leave at once.
4. Switch to another tab and back: drawing stops and resumes.
5. Firefox: the vampire model is compressed with meshopt, which uses WebAssembly. If Firefox blocks it under the extension's policy, the cards keep the flat emblem and the scene still shows. Tell me if so.
