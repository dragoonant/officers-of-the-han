# M4a handoff: world balance

Branch `m4a-balance` (worktree `oth-balance`), not pushed. Gates: `npm run typecheck` clean; `npm test` 339 tests green; `npm run sim -- --years 10 --seeds 10` 0 invariant failures, 0 stalls. Full tables and the one-change-at-a-time log are in `docs/spec/13-balance.md`. Data merged from main (verification pass) before the "new" baseline.

## Before / after (10 seeds x 10 years, merged data)
| | before | after | target |
|---|---|---|---|
| famine per faction-year | 0.30 | 0.13 | < 1 |
| famine in 190-1..190-9 | 336 | 5 (Runan, vacant at start) | none |
| wars per faction-year | 1.30 | 0.49 | 0.3-0.8 |
| factions at 200 | 15.9 | 13.9 | 8-14 |
| seeds with a house over 40% | 1 | 0 | <= 2 |
| captures per battle | 0.45 | 0.21 | < 0.25 |
| diplomacy per faction-year | 1.46 | 0.69 | < 1 |
| missions done / failed | 95 / 259 | 238 / 90 | done >= failed |
| successions | 179 | 113 | explained |

## Changes
- `src/ai/world/ruler.ts`: war chance 60% a slot a month; armies of 80% (25% against an undefended city), attack ratio unchanged at 1.4; `W-AI-6` rice gate for armies; `W-AI-5` peaceful opening (`peacefulOpening`, 3 months) and coalition target preference; truce asked only without a pact, 8%, no alliance escalation; surrender demand at 3.5x troops, 6%; mission offers only for work that can be done (not capped, gold for two actions) and scouts at most 15 road days away.
- `src/ai/world/officer.ts`: `monthsToHarvest`, `riceNeeded`; no draft unless the rice lasts to the harvest.
- `src/ai/world/autopilot.ts`: no random "variety" action while the player's officer holds a mission.
- `src/world/battle-auto.ts`, `src/world/war.ts` (rule `W-WAR-5`): capture 20% -> 10% (+20 with no retreat kept); a losing ruler with another city retreats instead of being captured; rulers are captured last.
- `tools/sim.ts`: new summary lines (faction-years, famine, wars and captures per faction-year and per battle, attacker wins, diplomacy rate, famine in the first 9 months of 190 by city, city counts per faction at 195 and 200, largest city share, strong houses alive, the player's final post).
- Spec: `10-rules.md` W-AI-2 rewritten, new W-AI-5 and W-AI-6, W-WAR-5 text, change log; new `13-balance.md`; PLAN.md rulings (W-WAR-5, W-AI-2, W-AI-5, W-AI-6, all `open`).
- Tests: new `tests/unit/world/ai-balance.test.ts` (newGame(190) has 0 armies; rice gate; opening); `rules6.test.ts` W-AI-2 war test now starts at 190-5; `tests/unit/client-world/store.test.ts` loop answers any pending with the first legal action (an event choice now appears at the first month end because RNG draws moved; no client code touched).

## Data requests (not edited)
- Vacant-at-start cities hold about 10% of the rice of owned ones (Runan 180 rice for 1,500 troops, Jianning 120 for 1,000): whoever claims one starves in month 5-8 unless it is given rice or the troops are lowered.
- Luoyang (34,000 troops, 3,206 rice a year income, 4,080 upkeep) and Wan (22,000 troops) run a structural rice deficit; 191-192 famine lines are mostly there. Lower their troops or raise farm/rice.
- Cao Cao starts with one city beside Dong Zhuo's stack; he survives to 200 in only 5 of 10 seeds. A second starting city, or smaller Dong Zhuo garrisons, would help.

## Not done / caveats
- Cao Cao survival (5 of 10) and factions at 200 (13.9, top of the 8-14 band) are the soft spots. Dong Zhuo still snowballs to about 10 cities; no brake on a leader was added.
- The war count is a cliff in the attack ratio (see 13-balance.md); the tuned values live in constants at the top of `ruler.ts` (`WAR_RATIO`, `WAR_CHANCE`, `DIPLO_CHANCE`, `SURRENDER_CHANCE`, `FRACTIONS`).
- No rice relief by transport between cities was built; the gates avoid the problem instead.
- No unit test for the `W-WAR-5` ruler-retreat branch (the sim shows 15 ruler captures per 10 seeds, all last-city cases).
- Sim seeds where the player's line ends (2 of 10) stop early, so the year-200 columns average fewer seeds.
- The old-data rows in 13-balance.md were measured before the data merge.
