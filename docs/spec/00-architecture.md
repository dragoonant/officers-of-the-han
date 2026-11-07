# 00 — Architecture and frozen contracts

The structure follows the owner's sibling games (KB `recipe.md`) and three-kingdoms-tactics (`docs/spec/00-architecture.md` there). Only the structure is reused; this game has its own rules and its own skin (`50-presentation.md`).

## Layers
```
src/contracts/  FROZEN types: data.ts, world.ts, battle.ts, contest.ts. The seams between the agents.
src/shared/     rng.ts (sfc32, d100, chance, childSeed, clamp).
src/data/       JSON content + index.ts loader (typed GameData).
src/world/      pure world engine: newGame, legalActions, step, replay, query.*, the month pipeline.
src/battle/     pure hex battle engine: createBattle, legalActions, step, query.*, generateField.
src/duel/       pure duel engine.     src/debate/   pure debate engine.
src/ai/world/   world AI (rulers, officers, the sim autopilot). src/ai/battle/  battle AI.
src/client/     React + R3F: store (sole caller of step), screens, map (SVG), battle board (R3F), letters.
tools/          validate-data.ts, sim.ts (10-year AI world runs + invariants), battle-bench.ts.
tests/unit      Vitest, named by rule id ("W-ECO-1 gold income", "B-DMG-1 type edge").
tests/e2e       Playwright: new game → act → end month → a battle → save/Continue; phone layout; KB rules 24–27.
```
**Engines are pure and deterministic:** no DOM, React, three, timers, `Date` or `Math.random`. All state is plain JSON (KB rule 22). `step` never throws: it returns `{ ok: false, code, message }`. States are immutable by convention: `step` returns a new object.

## World contract (`src/contracts/world.ts`)
```ts
newGame(opts: NewGameOptions): WorldState
legalActions(state): WorldAction[]   // never empty unless state.ended; while state.pending is non-empty, only answers to pending[0]
step(state, action): StepResult      // never throws
replay(opts, actions): WorldState    // replay(opts, log) deep-equals the live state
query.*(state, ...)                  // owns every number the UI shows
```
- **Parameterised actions** (`gift` gold, `transport` amounts, `war`/`propose` units, `mission`): `legalActions` lists one canonical instance of each kind that is possible now (for example `war` with `query.suggestArmy(state, from, to)`). `step` accepts any values that satisfy the rule and rejects the rest with `bad-target`. `query.can(state, kindOrAction)` answers "is this kind possible here, and why not" for the UI.
- **Pending decisions** are a queue (`state.pending`); while it is non-empty `legalActions` offers only answers to `pending[0]`. A played battle is a `battle` pending holding a `BattleSetup`; the client runs `src/battle` and answers with `resolveBattle{outcome}`. The world checks the outcome against the setup (same ids, troops ≤ start) and rejects a bad one (`bad-outcome`). Duels and debates work the same way.
- **The month pipeline** (`W-TIME-3`) is a resumable cursor in state, so `endMonth` can stop at a pending and the next answer continues it. The pipeline stages, in order: `ai-officers`, `armies`, `captives`, `events`, `deaths`, `loyalty`, `missions`, `month-start`. The month-start stage also runs the AI courts (`W-AI-2`) and then sets `phase: 'player'`.
- **Queries the client needs at least:** `officerView(id)` (name, portrait, stats, rank name, post, loyalty, ties with numbers, location, mission), `cityView(id)` (numbers, officers present, prefect, owner), `factionView(id)`, `actionsHere()` grouped as Work / People / Court / Travel / Self with each action's day and gold cost and the reason it is unavailable, `chanceOf(action)` for every rolled action, `armyPower(army)` and `defencePower(city)` (`W-WAR-5`), `suggestArmy(from, to, proposer?)` (with a proposer: an army led by and fitted to that officer, `W-PROP-1`), `monthReport()` (log entries of the last month), `saveSummary()` (KB rule 22 Continue line).
- **Determinism:** one sfc32 stream in `state.rng`. Each rule that draws says so; the world's draw order is written at the top of `src/world/step.ts`. Battles, duels and debates get child seeds (`childSeed`) drawn at the moment their setup is created.

## Battle, duel and debate contracts
See `20-battle.md` §9 and `30-duel-debate.md` §3. Types in `src/contracts/battle.ts` and `contest.ts`. Each has its own stream; the world never reads their internals, only their outcomes.

## Invariants (checked by `tools/sim.ts` after every step)
- Every officer has exactly one status (`unborn | active | army | captive | dead`); `active` and `captive` officers have a valid city; `army` officers are in exactly one army; `dead` officers are in no army, post or prefecture.
- Each living faction has ≥ 1 city, a living ruler in the faction with post `ruler`; each city has at most one prefect and the prefect is an active officer of the city's faction in that city.
- City numbers are integers within [0, max]; no negative gold, rice or troops; loyalty and friendship within [0, 100]; days within [0, 30].
- `legalActions` is non-empty until `ended`; the sim never stalls (a cap of 400 player actions per month).
- `replay(opts, actions)` deep-equals the live state; `JSON.parse(JSON.stringify(state))` deep-equals the state (plain JSON).
- Every log `kind` has a client line (a unit test lists the kinds).

## Saves (KB rule 22)
One versioned envelope under `localStorage['oth-save']`: `{ version, savedAt, opts: NewGameOptions, actions: WorldAction[], snapshot: WorldState, presentation: { battle?: BattleState } }`. Autosave after every accepted action and at game start. The snapshot reopens; the action list rides along for bug reports. A played battle in progress saves its `BattleState` too, so Continue reopens mid-battle.

## Change log
- 2026-11-07 v0.1 written at M0 (contracts frozen: `src/contracts/*.ts`).
- 2026-11-07 The world engine is built as `createWorldApi(data: GameData)` returning `{ newGame, legalActions, step, replay, query }` (the `WorldApi` methods plus `query`), so tests run on a fixture and the game on `GAME_DATA`. `src/world/index.ts` exports `world = createWorldApi(GAME_DATA)`.
