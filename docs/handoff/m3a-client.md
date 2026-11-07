# M3a handoff: world client

Branch `m3a-client` (worktree `oth-client`), merged with `main` after the board agent landed. Not pushed.

## What is built
- `src/client/App.tsx`, `src/main.tsx`, `index.html` (fonts as main's).
- `src/client/store/game.ts` (zustand; the sole caller of `world.step`; keeps opts, action list, snapshot, battle-in-progress; autosaves), `store/ui.ts` (panels, selected city, open dialog).
- `src/client/save/save.ts` (KB rule 22 envelope under `localStorage['oth-save']`, validation, Continue line, corrupt / missing-content / refused-storage results).
- `src/client/world/`: `Title`, `NewGame` (picker + creator), `MapView` (SVG tray, pan/pinch/wheel), `geo.ts` (approximate rivers), `Hud` (month dial, days dial, purse), `ActionBar`, `Dialogs` (all target pickers, mission/transport/diplomacy/propose forms, `ArmyForm`), `Letters` (every pending kind, hand-off to Battle/Duel/Debate screens), `Views` (officer card, city box, factions, chronicle), `End`, `logicons.ts`, `seam.tsx` (the only importer of `src/client/ui` and `src/client/contests`), `world.css` (layout only; tokens and ornaments come from `theme.css`).
- Tests: `tests/unit/client-world/*` (save round trip and failures, store autosave/Continue/replay, every LOG_KINDS kind has an icon, army/creator/geo logic) and `tests/e2e/world.spec.ts` (persistent-profile Continue, create an officer, corrupt save, phone portrait and landscape; `SHOTS=1` writes the screenshots).
- Screenshots (deviceScaleFactor 2) in `docs/screens/`: `title`, `officer-picker`, `map-midgame`, `city-box`, `letter`, `phone-portrait`.

## Run
`npm run dev`; gates: `npm run typecheck`, `npm test`, `npm run build`, `PW_PORT=5322 npx playwright test tests/e2e/world.spec.ts`.

## RULINGS
- RULING: picker | all officers active or marching at the start (not hidden) are offered; one who starts in an army says so on the card | Cao Cao and others must be playable | open
- RULING: seed | the default seed is `Date.now() % 1e9`, read in the client only, shown in an editable field | no hidden randomness | open
- RULING: a finished game clears its save (KB rule 22) and the end screen is held in memory only | rule 22 | open
- RULING: unavailable actions of one kind with the same reason collapse into one button (a house officer's ten travel targets) | readability on phones | open
- RULING: battle letter | a short silk letter ("Take the field") precedes the board; a resumed saved battle opens the board directly | gives context before a full-screen takeover | open
- RULING: propose-war army | start from `suggestArmy` with the player forced in as sole commander | `suggestArmy` has no proposer argument | open
- RULING: successions in the end summary | the lineage is rebuilt from the log (current player, the `begins.` line, `succession` entries) | no state field lists past players | open

## Requested engine changes
- `query.suggestArmy(state, from, to, proposer?)` so a proposing officer gets the engine's own army with them as commander.
- A `query` for the list of officers a game can start as (and whether each starts in an army), instead of building one `newGame` to read it.
- `WorldState.players: string[]` (lineage) would replace the log heuristic on the end screen.

## Not done / known gaps
- No mountain hatching on the tray (rivers, rim and roads only). Army arrows sit mid-road (no progress is stored).
- Created-officer portraits are the 123 generic sprites; there is no search or grouping in that strip.
- The BattleScreen mounts a canvas per battle (board handoff note); I do not hoist it.
- The picker does not filter by "marching at start".
- Fonts load from Google Fonts with system fallbacks; not verified by eye offline.
