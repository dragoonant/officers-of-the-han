# M2b handoff: battle, duel, debate engines and the battle AI

Branch `m2b-battle` (worktree `oth-battle`). Contracts in `src/contracts/*` and `src/shared/*` are untouched. `package.json` changed only by the `bench:battle` script.

## Gates (all green at handoff)
- `npm run typecheck` clean. `npm test`: **176 tests, 8 files** (battle 104 + fuzz/AI 15 = 119 incl. 18 map, 37 combat, 20 tactics, 30 duel/siege/outcome; duel 36; debate 20; scaffold 1).
- `npm run bench:battle` (default 150 battles, `-- 200 --seed=2` etc.): passes for seeds 1, 2, 3 at N=200.
  - AI vs AI attacker win rate by power ratio (attacker/defender, power = sum troops x (0.5 + (WAR+LDR)/200)): <0.7: 15%, 0.7-1: 50%, 1-1.4: 60%, 1.4-2: 85%, >2: 96%.
  - Average 11 days; rout reasons over 200 battles: keep-taken 103, time 50, commander-routed 47 (all-routed never happens because the commander rout comes first). ~0.4 duels and 2.8 fires per battle, 2 gates broken per battle.
  - AI vs random (evenly matched, 6 v 6, 4000 troops): AI as attacker 98-100%, AI as defender 100% (gate: 90%).
  - Speed: ~65 ms per full AI-vs-AI battle without checks (max ~250 ms with invariants on). Gate: under 300 ms.
  - Invariants checked after every step: no NaN, troops in [0, start], morale in [0,100], one unit per hex, nothing on impassable terrain, `legalActions` non-empty until the outcome (and empty after), day in range, every battle ends, `replay(setup, actions)` JSON-equals the live state, JSON round trip.

## API
```ts
// src/battle (index.ts)
createBattle(setup: BattleSetup): BattleState
legalActions(state): BattleAction[]                       // [] only once state.outcome is set
step(state, action): { ok: true; state; events: BattleEvent[] } | { ok: false; code: RejectCode; message }  // never throws
replay(setup, actions): BattleState
generateField(setup: Pick<BattleSetup,'seed'|'terrain'|'walls'>): HexCell[]      // 165 cells, row-major odd-r (index = row*15 + col)
outcomeOf(state): BattleOutcome                           // the stored outcome; before the end, a provisional "defender holds" one
query.moveRange(state, unitId): {q,r,cost}[]              query.movePath(state, unitId, q, r): {q,r}[]
query.attackTargets(state, unitId): {target, range}[]     query.attackPreview(state, unitId, targetId, from?): AttackPreview | null
query.tacticTargets(state, unitId, tactic): {q,r,chance,unit}[]    query.tacticPreview(state, unitId, tactic, q, r): TacticPreview | null
query.initiative(state): string[]    query.outcome(state): BattleOutcome | null    query.activeUnit(state): BUnit | null
query.unitView(state, id): UnitView   query.hexAt(state, q, r): HexView | null   query.gateHp(state): {q,r,hp,max,broken}[]
query.knownTactics(state, id): TacticId[]   query.isPlayerUnit(state, id): boolean   query.canChallenge(state, unit): string[]
// hex.ts: hexToWorld(q, r, size) -> {x, z} (pointy-top), worldToHex, neighbors, hexDistance, offsetToAxial, axialToOffset,
//         hexIndex, indexToHex, inField, hexesWithin, FIELD_COLS=15, FIELD_ROWS=11
// field.ts: GATE_ROWS=[1,5,9], WALL_COL=10, KEEP_COL=13, KEEP_ROW=5, ATTACKER_COLS, DEFENDER_COLS
// sample.ts: sampleSetup({seed, ...}) deterministic BattleSetups for tests/bench (not used by the engine)

// Actions use a `kind` discriminant (types.ts BattleAction):
{kind:'move',unit,q,r} {kind:'undoMove',unit} {kind:'attack',unit,target} {kind:'attackGate',unit,q,r}
{kind:'tactic',unit,tactic,q,r} {kind:'challenge',unit,target} {kind:'duelResolved',result:DuelOutcome} {kind:'wait',unit} {kind:'retreat',side}
// TacticId = 'fire'|'confuse'|'taunt'|'rally'|'volley'. Unit ids equal officer ids (a duplicate garrison id gets "~2").

// src/duel
createDuel(setup: DuelSetup): DuelState     stepDuel(state, {stance?}): {ok,state,events}|{ok:false,code,message}
autoDuel(setup): DuelOutcome                query.duelTells(state, side): {side, tells:[{stance,weight,pct}], forced}   query.legalStances(state, side)
// stances: 'strike'|'guard'|'feint'|'mighty'|'yield'. The AI's stance is drawn when the round opens and stored in state.committed.

// src/debate
createDebate(setup: DebateSetup): DebateState   stepDebate(state, {tablet?}): ...   autoDebate(setup): DebateOutcome
query.debateTells(state, side): [{tablet,weight,pct,expectedDealt,expectedTaken}]   query.legalTablets(state, side)
// tablet ids are "<kind>-<power>", e.g. "scorn-4"; hands are face up in state.hands; AI commits first (state.committed).

// src/ai/battle
chooseBattleAction(state, unitId): BattleAction        // one action per call; call again after a `move` to get the action
chooseRandomAction(state, unitId), chooseAction(state, unitId, 'ai'|'random')
```
Client notes: a played turn is `move` (optional), then one of attack/attackGate/tactic/challenge/wait (the turn ends). `undoMove` is legal between them. A player duel sets `state.pendingDuel` (a `DuelSetup` plus `challenger`/`target` unit ids); `legalActions` then offers one canonical `duelResolved` (a draw) plus `retreat`; the client plays `src/duel` with `pendingDuel` as the setup (strip `challenger`/`target`) and answers with the real outcome. `state.playerSide` is derived from `setup.playerControls`; `query.isPlayerUnit` applies B-TURN-5. `events` carry everything the 3D client needs to animate (move paths, damage, counter, rout, ignite/ash, gate, dayStart with order).

## RNG draw order
Written at the top of `src/battle/step.ts` (battle), `src/duel/index.ts` and `src/debate/index.ts`. The field uses its own stream (`seed ^ 0x5bd1e995`), so previews and field generation never perturb the battle stream; previews never draw.

## RULINGs (all `open` for the coordinator)
- RULING: B-TURN-4 | a taunted unit that can attack its taunter (after a legal move, or now) has `wait`, other targets, tactics, gate attacks and challenges removed from `legalActions`; if it cannot reach, its moves are limited to hexes strictly closer and `wait` stays legal. The taunt ends after the unit's turn. So `wait` is not always legal in that one case; `legalActions` is never empty. | the rule says "must, if it can" | open
- RULING: B-DMG-1 | "moved 3 or more hexes" for cavalry momentum is the hex distance from the turn's start hex to the end hex (not path length); melee (range 1) only | independent of the path chosen | open
- RULING: B-DMG-2 | the counter uses the defender's troops and morale after the hit, and its own terrain/surround/oath at the attacker's hex; the preview range uses max damage for the counter minimum and min damage for the counter maximum | consistent with the order of play | open
- RULING: B-SIEGE-2 | ranged attacks have no line-of-sight rules at all, so any archer (range 1-2, 3 on a hill) shoots across a wall hex; the rule is therefore the general behaviour. Melee cannot cross because a wall line leaves distance 2 | simplest reading | open
- RULING: B-MAP-3 | gate rows are 1, 5 and 9 (11 rows / 4 = 3 gates); a road overlays the middle row (not over river/ford/mountain); columns 8-9 and the deploy columns 0-2 are always passable; B-MAP-4 is enforced by a repair pass that opens the gate's row. Attackers deploy front to back (spear/cavalry first, archers rearmost); defenders archers first on column 11 (shooting over the wall), commander at column 14 | spec silent on exact layout | open
- RULING: B-DUEL-1 | the AI acceptance rule applies to a target not controlled by the player; if the challenged officer is in `playerControls` the duel is always played (the player may Yield in it). A refusal ends the challenger's turn and costs the target's unit 15 morale (which may rout it) | spec only describes the AI acceptor | open
- RULING: B-DUEL-3 | morale -40 applies to the loser for knockout and yield (not draw); wound (-30 health, floored at 0) and the 15% slain roll only on knockout; slain units rout without a capture roll; a loser whose morale reaches 0 routs and may be captured; a challenger who wins a duel keeps its turn ended (the challenge was the action) | spec | open
- RULING: B-TAC-FIRE | fire cannot target a hex holding an ally (not offered, rejected by `step`); a hex is "burning for 2 days" meaning: units standing in it at the start of their turn take the damage; at each day end it first spreads (25% per burnable, not-yet-alight neighbour, in hex-index then direction order), then loses one day; at 0 it becomes `ash` (new terrain value, plain rules, not burnable). Burn kills credit the caster (merit +50) | spec | open
- RULING: B-TAC-RALLY / VOLLEY | rally gives the user +15 and the +5 success bonus, allies adjacent +15; volley targets any hex within 1-2 whose hex or neighbours hold an enemy, ignores the hill range bonus, gives the archer +3 (damage dealt) and +5 (tactic success) | literal reading | open
- RULING: B-WIN-1 | each side has exactly one commander (the first flagged in the setup, else best LDR); if both sides lose in one action the acting side wins; a unit that starts with 0 troops is routed from the start; `retreat` stays legal during a pending duel | edge cases | open
- RULING: B-OUT-1 | +30 goes to every unit of the losing side (routed or not); +150 only to winners still on the field; +300 to the winning commander on top; +50 per enemy routed by the unit's own attack, volley or fire (not by counters); +100 per duel won | spec | open
- RULING: B-TURN-5 | `step` does not check who is allowed to submit an action (the client/AI split is the caller's job); `query.isPlayerUnit` answers it | engine stays pure | open
- RULING: D-DUEL-3 | each hit is `floor(h * factor)`, at least 1 when the factor is above 0; both hit rolls are always drawn (a then b); both yielding, or both reaching 0 vigor in the same round, is a draw | determinism | open
- RULING: D-DUEL-6 | Mighty Blow (spirit 100) is checked before yielding; tells are shown as weights and rounded percentages; a below-30% vigor shift happens before the clamp at 0 | spec ambiguity | open
- RULING: D-DEB-4 | the stat bonus is floored (`floor(INT/20)`) so forces and damage are whole numbers; D-DEB-1 composure is floored after the bonus | whole numbers for the UI | open
- RULING: D-DEB-2/6 | players with no tablet to play (impossible in 6 rounds) would deal nothing; both at 0 composure goes to the defender (b); an AI-vs-AI state steps with `stepDebate(state, {})` | determinism | open

## Requested contract changes
None required. Suggestions for the coordinator: (1) export `BattleAction`/`BattleEvent` from `src/contracts/battle.ts` once the client settles on them (currently `src/battle/types.ts`); (2) the world should build `Contestant`s for field duels the same way it does for `W-ACT-DUEL`; the battle builds them from `BattleOfficer` itself.

## Not done / notes
- The 3D presentation is not part of this milestone. `events` are stable but untested by a client.
- AI weights (`W_EXPOSURE`, `W_PROGRESS`, `W_HOLD`, kill values) are tuned only until the bench gates and a sensible attacker win curve held; they live at the top of `src/ai/battle/index.ts`.
- The random tier picks uniformly among legal actions (never retreat or undo), seeded from the battle seed and action count.
- `tools/battle-bench.ts` also exports `playBattle` and `checkInvariants`, which the unit tests reuse.
