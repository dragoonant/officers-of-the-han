# M3c handoff: world client + battle/duel/debate integration

Branch `m3c-integ` (worktree `oth-integ`), merged with `main` (world balance, W-AI-5/6) before the final run. Not pushed.

## What broke, and what I fixed
1. **CSS class collision (the big one).** `world.css` and `battle.css` both style `.hud`, `.ticker`, `.actions` and `.chip`. Inside the world client the battle HUD was positioned by the world's top strip rules (side card on the left, action bar floating mid-screen, log gone). Fixed by renaming the world's classes to `whud`, `wticker`, `wactions`, `wchip` (world files only). Found only because a battle was played inside the world; the lab never loads `world.css`.
2. **Battle board re-initialised after every action.** `Letters.tsx` passed the live saved `BattleState` as `initial`, and `BattleScreen` re-runs `initBattle` when `initial` changes, so each `onChange` reset the AI switch, feed and camera. The letter now hands over the saved battle once, at mount (`useState`). `battle-flow.spec.ts` asserts the AI switch survives the first actions.
3. Duplicate `data-testid` on the world wrapper and the inner duel/debate/battle screens; wrappers are now `world-battle`, `world-duel`, `world-debate`.
4. Map: the tray opened pushed down with empty space; labels hid under the token and were cut. See below.
5. Playwright `reuseExistingServer`: a killed run leaves a `vite preview` serving a stale `dist`. If screenshots do not change, run `npm run build` first.

The text sweep found no `undefined` / `NaN` / `null` / `[object` / empty button in any screen it reached.

## Built
- `tests/e2e/battle-flow.spec.ts` (4 tests): a save with a pending battle (Cao Cao orders a `war` with himself commanding, built in Node by `tests/e2e/fixtures/make-saves.ts`, run under `tsx` from `fixtures/saves.ts`) opens via Continue, the battle letter, the board, AI at Instant to the end banner, the log carries the battle and the save advanced; reload mid-battle reopens the same day, `actionCount` and unit troops; a pending duel and a pending debate (diplomacy with mode `debate`) each open, play to an outcome and the world continues.
- `tests/e2e/text-sweep.spec.ts` (6 starts: ruler, prefect, officer, wanderer, created officer, one-officer faction ruler; each opens every picker that is available, every action tab and button, every city box, 30 officer cards, the four panels, then three months of letters answered with the first option and contests resolved by `world.auto`). Takes about 1.7 min. `SWEEP_LOG=1` prints each step. Needs test hooks `window.__game`, `__ui`, `__world` (set in `App.tsx`).
- `tests/e2e/screens.spec.ts` (`SHOTS=1`) writes the screenshots.
- Map (`MapView.tsx`, `geo.ts`): on open and on Continue the whole tray fits, then eases (650 ms, instant under reduced motion) to a comfortable zoom centred on the player's city; "Find me" button; player token sits upper-right of its mirror; label collision pass `placeLabels` (below, above, right, left, then diagonals; avoids mirrors, the token, road day numbers and the tray edge; the player's city and the selected city are placed first); lacquer halo on names and road days; approximate faint cloud-scroll hatching along Qinling, Taihang, Qilian, Min/Hengduan and Daba (`RANGES`, marked approximate).
- Title: lacquer tray frame, cloud scrolls flowing clockwise round the rim (CSS background animation, off under `prefers-reduced-motion`), title inlaid in ochre between two rules. Buttons and the disclaimer are unchanged.

## Screenshots (`docs/screens/`, deviceScaleFactor 2)
`title.png`, `map-on-open-desktop.png` (1280x800), `map-on-open-phone.png` (390x844), `world-battle-mid-fight.png` (battle inside the world, after 14 actions), `battle-result-chronicle.png` (see below). `map-midgame.png`, `phone-portrait.png` etc. are the old M3a shots and are stale.

## Engine requests (nothing under `src/world` etc. touched)
- There is **no battle result letter**: `resolveBattle` writes a `war` log line ("Dong Zhuo held Luoyang against Cao Cao.") and nothing else, so the world after a battle shows only the ticker and chronicle. A `letter` pending with the outcome (losses, captures, who holds the city) would close the loop; until then the board's end banner is the only report. I shot the chronicle instead.
- `query.suggestArmy(state, from, to, proposer?)`, a list of start-able officers, and `WorldState.players` (M3a requests, still open).
- Opening the `war` or `propose` dialog when its action is unavailable throws in `ArmyForm` (`Cannot read properties of undefined (reading 'training')`, from `defencePower` on a missing city) and blanks the page. Not reachable from the UI (the buttons are disabled); the sweep opens dialogs only for available actions.

## Not done / known
- A recruit by debate on a wanderer is not in the e2e (needs a wanderer in the player's city); the engine path is the same pending, covered via diplomacy.
- `lab.spec.ts` "mouse" test is flaky under software GL (pan distance 0.096 vs > 0.2 once in three runs); it passes alone and untouched by this work.
- Road day numbers still sit on the road mid-point and can touch a label at some zooms; labels avoid them where a clear place exists.
- Mountain hatching is faint by design; not verified against real geography.
- Reduced-motion title and map tween not screenshotted.
