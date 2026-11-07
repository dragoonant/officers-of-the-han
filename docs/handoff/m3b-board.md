# M3b handoff: hex board, duel, debate, lacquerware ui, lab

Branch `m3b-board`. Nothing under `src/battle`, `src/duel`, `src/debate`, `src/ai`, `src/world`, `src/contracts`, `src/shared` was touched. Edits outside my paths: `vite.config.ts` (`lab` input only), `index.html` (fonts link), `src/main.tsx` (lab link).

## Play it
`npm run dev`, open `/lab.html` (built: `/officers-of-the-han/lab.html`). Tabs Battle (seed, terrain, play as attacker or defender, named or anonymous officers), Duel, Debate. `?speed=instant|fast`, `?q=low` (no shadows, dpr 1), `?perf=1` (fps), `?aa=0`. In a battle: tap a ochre tile to move, Attack / Tactic / Challenge / Wait / Undo move / Retreat in the bar; tapping an attackable enemy picks it, tapping it again (or Confirm) strikes. "Let the AI command" hands over your units.

## Component props (frozen seam, `src/client/contests/index.ts`)
```ts
<BattleScreen setup: BattleSetup; initial?: BattleState; onChange?: (s: BattleState) => void; onDone: (o: BattleOutcome) => void />
<DuelScreen setup: DuelSetup; onDone: (o: DuelOutcome) => void />
<DebateScreen setup: DebateSetup; onDone: (o: DebateOutcome) => void />
```
Pass a stable `setup` (re-creating it restarts the battle). `onDone` fires once, when the player presses Continue (`outcomeOf(state)` for battles). Import `src/client/theme.css` and call `installNoSelect()` once. UI kit props: `src/client/ui/README.md`. Only one `BattleScreen` at a time (module store `src/client/battle/store.ts`).

## Structure
`src/client/battle`: `store.ts` (controller: engine state, presented state, director, AI driver, UI mode), `director.ts` (beats, Normal/Fast/Instant), `pres.ts` (presented-state cursor, re-synced to engine state after each step), `eventLines.ts` (a line for every event kind; typed so a missing kind fails typecheck, plus unit test), `marks.ts` (tile painting from `legalActions`/`query`), `Terrain/Figures/Marks/Effects.tsx`, `CameraRig.tsx` + `mapController.ts` + `cameraModel.ts` (rule 27, key `oth-mouse`), `Hud.tsx`, `figures/` (donor rig kit, trimmed: generic officer with ochre-trimmed black lacquer armour, faction-pigment sash and plume; troop figures in the pigment; each compacted to a skinned mesh).
Picking is by hex only: the camera controller intersects the tap ray with the tile plane; figures and effects have no pointer handlers (rule 25). AI runs on the main thread, one action per timeout (0 ms at Instant, 320 ms otherwise); not a worker (RULING below).

## Gates
`npm run typecheck`, `npm test` (195 tests, new: `tests/unit/client/eventLines.test.ts`, `hexLayout.test.ts`), `npm run build`, `PW_PORT=5321 npx playwright test tests/e2e/lab.spec.ts` (6 tests: AI battle to outcome, tap behind a figure, mouse controls, phone 390x844 HUD + no selection, duel, debate) all pass.

## Screenshots (deviceScaleFactor 2, `docs/screens/`)
`battle-mid-fight.png`, `duel.png`, `debate.png`, `phone-battle.png`.

## Why it cannot be confused with three-kingdoms-tactics
No sand ground (black lacquer tray with a vermilion inlay line), no tent ring, lanterns, bamboo slips, seal stamp or hanging banners; hex tiles (not squares) in malachite, celadon, umber, azurite, carbon grey with vermilion-and-black wall blocks and an ochre keep; faction pigments (azurite, madder, plum, ...) instead of jade/ochre; Josefin Sans caps and Nunito Sans (no Ma Shan Zheng); panels are chamfered black lacquer boxes with a red field and a vermilion cloud-scroll band; the initiative order is a row of small bronze mirrors with saw-tooth rims. Side by side the board silhouette (green hex plate in a black tray), the chrome and the type differ at a glance. I compared against the donor's code and look, not a fresh run of the donor.

## RULINGs
- RULING: client-AI | the battle AI runs on the main thread with a 0 or 320 ms timeout per action, not in a Web Worker | a full AI action is a few ms; simpler | open
- RULING: move-tiles | tiles the player may move to are painted ochre with a slow shimmer ("available", 50-presentation.md), attack/tactic targets dashed vermilion, chosen target and selected unit solid vermilion; the unit's own tile gets an ochre ring | spec colours, malachite ground made verdigris unreadable | open
- RULING: pigments | sides take a pigment from a pool of eight that contrast with the board (azurite, orpiment, lead white, madder, indigo, plum, sienna, slate), hashed from the faction id, never equal for both sides | spec lists 14 but some match terrain | open
- RULING: confirm-tap | an attack, tactic or challenge target is picked by one tap and confirmed by a second tap on it or the Confirm button, whose cost line carries the `query.attackPreview` / `tacticPreview` numbers | phone-safe | open
- RULING: gate-preview | the engine has no preview for gate attacks; the button shows gate strength from `query.hexAt` | none exists | open

## Not done / known
- Figures are procedural and built when a battle mounts (about half a second); no GLB loading so rule 26 is moot. The canvas is mounted per battle, not one persistent renderer for the whole session (recipe-scene-start-hitch): the world client should keep the `BattleScreen` mounted or hoist the Canvas if the hitch matters.
- Troop bars over units are plain flat bars; troop-figure animation copies the officer's clip.
- Phone portrait fits the 11x15 board to width, so it is small; pinch to zoom. Landscape phone not screenshotted.
- Fire/ash visuals are simple cones; no smoke. Camera does not auto-follow the active unit.
- No audio. `window.__oth` and `window.__marks` are test hooks.
- Software-GL perf not measured beyond e2e passing; `?perf=1` shows fps.
