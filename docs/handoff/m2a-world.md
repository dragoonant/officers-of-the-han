# M2a handoff: world engine, world AI, sim

Branch `m2a-world` (worktree `oth-world`). Not pushed. Gates: `npm run typecheck` clean; `npm test` 116 tests in 7 files green; `npm run sim -- --fixture --years 10 --seeds 20` = 7187 steps in about 3 s, 0 invariant failures, 0 stalls, 0 rejected autopilot actions, 0 unknown log kinds, replay and JSON round trip checked on seeds 1-2.

## What is built
- `src/world/`: `core.ts` (data index, ctx, cloning, ties, logging), `people.ts` (membership, death, succession, faction found/destroy, `normalize`, `checkEnd`), `rules.ts` (legality `checkAction`, `costOf`, `applyAction`, every chance formula), `war.ts` (armies, defence formation, setups, outcome apply), `battle-auto.ts` (W-WAR-5 as a valid `BattleOutcome`, AI duel/debate formulas, outcome validation), `events.ts` (interpreter), `month.ts` (pipeline stages and month start), `step.ts` (newGame/legalActions/step/replay, RNG draw order at the top), `enumerate.ts`, `query.ts`, `invariants.ts`, `logkinds.ts` (`LOG_KINDS`), `types.ts` (query result types), `index.ts`.
- `src/ai/world/`: `officer.ts` (W-AI-3), `ruler.ts` (W-AI-2 court), `autopilot.ts` (W-AI-4).
- `tools/sim.ts`, `tests/fixtures/mini-world.ts` (6 cities, 3 factions + vacant city, 22 officers, 3 events), `tests/unit/world/*.test.ts` (named by rule id).

## Public API (`import { createWorldApi, world } from 'src/world'`)
- `createWorldApi(data: GameData): WorldEngine` where `WorldEngine = WorldApi & { query, auto, invariants, autopilot }`; `world` is the default instance on `GAME_DATA`.
- `newGame(opts)`, `legalActions(state)`, `step(state, action): StepResult`, `replay(opts, actions)`.
- `auto.battle(state, setup): BattleOutcome`, `auto.duel(setup): DuelOutcome`, `auto.debate(setup): DebateOutcome` (seeded from the setup; the sim and benches answer pendings with these).
- `invariants(state): string[]`, `autopilot(state, variety?): WorldAction`.
- `query`: `officerView(s,id)`, `cityView(s,id)`, `factionView(s,id)`, `actionsHere(s): ActionItem[]` (groups Work/People/Court/Travel/Self with days, gold, available, reason, chance), `targetsFor(s,kind)` (all legal instances of a kind), `can(s, kindOrAction): {ok,reason,days,gold}`, `chanceOf(s, action): {pct, what, alt?}|null`, `armyPower(s,{from,units})`, `defencePower(s,city)`, `defenceTroops`, `suggestArmy(s,from,to)`, `monthReport(s)`, `saveSummary(s)`, `workPreview`, `officerIds`, `cityIds`, `troopCap`, `salary`, `hiddenHere`, `isRival`, `isKin`.
- Pipeline: `endMonth` runs stages ai-officers, armies, captives, events, deaths, loyalty, missions, month-start from `state.cursor`; it pauses on any of battle, duel, debate, chooseDefenders, eventChoice, chooseSuccessor, captured and resumes after the answer. Pending contests carry a tag in `setup.id` (`ch|`, `rc|`, `dp|`, `ev|`) so no extra state field is needed.

## RULINGS
- RULING: E-4 contest substitution | when the player gets an event choice, `contest.a` is replaced by the player's officer, also inside `onWin`/`onLoss`/option effects that name the old id (coordinator note 1) | historical default is only a default | open
- RULING: E-3 alliance in options | on any non-zero option the player's faction is dropped from `alliance.factions` (coordinator note 2) | declining must not bind the player | open
- RULING: E-4 letters | no `letter` effect; a fired event sends a letter when `major` or the player is involved (note 4) | data.ts has no letter kind | open
- RULING: rivals | each `scenario.rivals` entry is read as a pair by index (note 5) | open
- RULING: E-3 `relation{a,b}` | a and b may be faction ids or officer ids (an officer means their current faction) | data does not say | open
- RULING: E-5 | an event is skipped (and re-checked each month, no roll) while any officer or faction named in its main `effects` is dead/unborn/destroyed | simplest reading | open
- RULING: W-WAR-6 | the winning commander gets 150 + 300 (additive, as B-OUT-1) | open
- RULING: W-MIS-1 | `campaign` is not a Mission kind in the contract; armies carry units instead. Deadlines are set by the engine (develop/envoy: this month; recruit/scout: end of next month), ignoring the supplied `deadline` | open
- RULING: W-MIS-2 | an envoy mission completes on the attempt: +200, +220 if refused | open
- RULING: W-CRT-TRANSFER | the officer moves at once and has 0 days this month (no state field for "arrives next month") | open
- RULING: W-ACT-GIFT | a ruler's `fromCity` reward may go to any officer of the faction in any city, paid from the ruler's city (or the capital if the ruler is away); needed so the AI court can reward W-AI-2 | open
- RULING: W-ACT-SEARCH | if a hidden officer is present and the find roll fails, the gold roll (50%) still applies | open
- RULING: W-WAR-3 | defenders are taken from the pool by prefect first then LDR+WAR; city troops not on the field stay home; a player who defends may omit themselves from the chosen defenders | open
- RULING: W-WAR-7 | a rebel (uprising) win founds a faction (commander ruler); a rebel loss captures every rebel; rebel training is 20 | open
- RULING: W-CAP/state | a captive keeps `faction` = old faction (needed for release/recruit); a captured ruler triggers succession first | open
- RULING: W-ACT-DUEL (AI vs AI) | WAR + health/10 + 20*rng each, within 3 is a draw; AI debates: INT + CHA/2 (with composure bonus) + 15*rng, ties to the asked side | open
- RULING: W-PROP-1 | AI officers never propose to a player ruler (no offer kind for it); AI officers do send recruit/oath/marry `offer`s to the player (rulers 20%, oath 15%, marriage 10%, per officer per month in the same city) | open
- RULING: W-AI-2/3 | AI rulers also do city work as officers; the AI keeps a gold reserve of 30 per officer in the city before spending on work; wanderers claim a vacant city when able; officers abroad without a mission walk home | open
- RULING: officers in data but absent from both `scenario.officers` and `appearances` stay `unborn` forever | open
- RULING: hidden officers start as wanderers with no faction | open
- RULING: W-ECO-4 | officers in an army are paid from their source city; officers standing in a foreign city are not paid | open
- RULING: log | only chronicle kinds (see `LOG_KINDS`) and entries naming the player are stored; the log is capped at 2000 entries | keeps 200-officer sims light | open

## Requested contract changes
None. (Tags in `setup.id` replace the new state fields I would otherwise have asked for.)

## Known gaps / not done
- Balance is untested on real data (the fixture is tiny); expect AI aggression and economy tuning in M4. The AI attacks any non-allied neighbour whenever P_att > 1.4 P_def, as specified.
- `uprise` has no AI user; AI never challenges or debates.
- Real-data sim not run (data was empty in this worktree); `npm run sim` falls back to the fixture with a notice.
- Tests were built for the fixture; none read `src/data`.
