# Spite Block — prototype

A seated, hands-first mixed-reality block puzzle: you vs. **The Dealer**, a smug floating mask that picks every 4th piece to be as bad for you as possible.
Stack: **Three.js + raw WebXR** (`immersive-ar` + `hand-tracking`), Vite. IWSDK was not used in this prototype (see Known gaps).

## Run
```bash
npm install
npm run dev        # http://localhost:5173  (desktop mode)
npm test           # vitest: game logic + adversary
npm run build      # static files in dist/
npm run preview    # serve dist/ on :4173
node test/screens.mjs      # v1 screenshots (preview running)
node test/screens-v2.mjs   # v2 polish screenshots → screens/v2-*.png
```

## Desktop controls
Arrows/WASD move (relative to camera) · Q/E rotate Y · R/F rotate X · T/G rotate Z · Space slam · Shift soft-drop · C bank · V veto · B fire rage · P pause · N new run · mouse drag orbit, wheel zoom. Difficulty, Daily seed and Voice toggles are in the panel.

## Quest (hands)
WebXR needs HTTPS. Deploy `dist/` (below) and open the URL in **Quest Browser**, tap **Enter AR**, allow hand tracking (put controllers down). The tank is placed ~45 cm in front of you, below eye level.
- Pinch near the falling piece → grab; drag to move across columns; roll the wrist ~70° → one 90° turn on the dominant axis.
- Open palm swiped down fast over the tank (or pinch + flick down) → slam.
- Pinch the brass pocket (left), or release a held piece inside it → bank.
- Poke the "?" envelope with your index finger while the Dealer shows his tell → veto.
- Rage full → red cube appears (right). Pinch it, flick it at the Dealer (or release it at his face) → 30 s stun.
Local testing on Quest: `npm run dev -- --host` + `adb reverse tcp:5173 tcp:5173`, then open `http://localhost:5173` on the headset.

## Deploy
- **GitHub Pages:** `npm run build`, push `dist/` to a `gh-pages` branch (e.g. `npx gh-pages -d dist`). `base: './'` is already set.
- **Vercel:** import the repo; build `npm run build`, output `dist`. Or `npx vercel deploy dist`.

## Rules implemented
5×5×12 glass tank; 9 original 3–5-cube polycubes (Pebble, Elbow, Stair, Tripod, Plank, Slab, Hook, Twist, Spite) in material families; gravity 1.2 s → 0.45 s; full-layer clears (100 ×1/3/6/10); "cracks" (≥80% layer for 3 drops); Spite clear +500; 8-minute cap = win; game over on blocked spawn; hold once per piece.
Adversary (`src/adversary.js`): for each piece, enumerate every orientation × column, hard-drop, score with `H = −a·height − b·holes − c·bumpiness + d·cleared − e·wellDepth`; the player's value is the best placement; Dealer picks the worst (cruelty Easy 0.4 / Normal 0.7 / Spiteful 0.95, else 2nd/3rd worst). Mercy: stack within 3 of the top → middle-ranked piece. Stun → random pick. Profile bias nudges toward pieces you died on.
Tell/veto: one of 4 tells (smirk, drumroll, look-away, yawn) is the run's real "cruel" tell; veto on it → fair piece, wrong → −1 rage pip.
Voice: 62 PG-13 gameplay-only lines (`src/lines.js`) via `speechSynthesis` + captions (DOM and an in-world panel for AR).
Memory: best score, runs, deaths by piece, holds, veto accuracy, daily best — localStorage `spiteblock.profile.v1`.

## Presentation (v2 polish pass)
- **Dealer** (`src/dealer.js`): porcelain mask with top hat, gold cheek swirls, brows, blinking eyelids, pupils that track the falling piece, lip-synced mouth (speechSynthesis word-boundary pulses, syllable fallback), floating 5-finger gloves. Expressions: smirk, eye-roll, yawn, drumroll fingers (the tells), flustered, grumpy, gloat (game over), stunned (spin + stars), hit recoil.
- **Look**: RoomEnvironment PMREM reflections, MeshPhysical per family (frosted glass, cork with sheen, polished brass, clearcoat enamel, iridescent obsidian for Spite), rounded bevels, fresnel ghost shader, rim glow on hand-held piece, transmission glass panes (High) with brass posts/frames, etched grid, brass stand, gradient contact shadow + shadow catcher (both work in passthrough).
- **VFX** (`src/fx.js`, instanced, 1 draw call each): clear shatter + sparks + layer flash, slam sparks + tank shake, envelope flip-and-burst reveal on AI pick, rage cube glow + trail, Dealer hit sparks.
- **Audio** (`src/audio.js`): all synthesized with WebAudio — move tick, rotate, slam thud, lock, clear chime (rises with multi-clears), veto stamp, wrong-veto buzz, rage charge/fire, stun boing, envelope, game-over phrase, and a procedural lounge loop (ii–V–I–vi electric-piano chords, walking bass, brushed hats). Toggles: Music (M), SFX, Voice. Audio starts on first click/key (browser autoplay rule).
- **Quality toggle** High / Low (Quest): Low = pixel ratio 1, no shadow map, alpha glass instead of transmission, XR framebuffer 0.85. Shadow map capped at 1024 (512 on Low). Choice saved in localStorage.

## Known gaps
- **Hand tracking has never run on a headset.** All gesture thresholds are the plan's starting values; tank placement in AR is head-relative (no table plane/anchor yet).
- Veto is poke-only (no point-and-dwell ray); no gaze; no left-handed mode, tutorial, or on-hand glow/tick sounds.
- Pebble is a 4-cube flat T (the plan's 2-cube domino would break the 3–5 cube rule).
- Search runs on the main thread (no Web Worker); 1-ply only.
- Voice is the browser's built-in TTS (quality varies; Quest Browser support unverified).
- **Performance on Quest is unmeasured.** Headless Chrome uses software rendering (~11–14 fps there, which says nothing about a GPU). Draw calls were not counted; tank trim and Dealer parts are separate meshes, not instanced; start on Low on Quest and profile with OVR Metrics.
- Lip-sync is approximate (boundary events are per word; Quest Browser may not fire them — fallback animation then).
- Trademark/trade-dress self-review still to be written down.
