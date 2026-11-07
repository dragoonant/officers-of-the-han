# 20 — Hex field battle rules (v0.1, frozen for M2b–M3)

An **original** hex battle system (PLAN D2). It is deliberately unlike the sibling game three-kingdoms-tactics: hexes instead of squares, no facing, a per-unit initiative order instead of side phases, morale instead of Qi, and siege gates. Rule ids `[B-...]` name the tests.

The world hands the battle a `BattleSetup` and gets back a `BattleOutcome` (`src/contracts/battle.ts`). The battle has its own sfc32 stream seeded from the setup.

## 1. The field
- `[B-MAP-1]` Hexes use axial coordinates `(q, r)`, pointy-top, in a field of **15 columns × 11 rows** stored with an "odd-r" offset layout. The six neighbours of `(q, r)` are `(q+1,r) (q-1,r) (q,r+1) (q,r-1) (q+1,r-1) (q-1,r+1)`. Distance is the axial hex distance.
- `[B-MAP-2]` Terrain:

| Terrain | Move cost spear/cav/archer | Defence × (damage taken) | Burns | Notes |
|---|---|---|---|---|
| plain | 1/1/1 | 1.00 | yes | |
| grass | 1/1/1 | 1.00 | yes | fire spreads into it |
| forest | 2/3/2 | 0.80 | yes | |
| hill | 2/2/2 | 0.85 | no | archers on a hill +1 range |
| mountain | — | — | no | impassable |
| river | — | — | no | impassable |
| ford | 2/3/2 | 1.15 | no | |
| marsh | 3/4/3 | 1.10 | no | |
| road | 1/1/1 | 1.00 | no | |
| wall | — | — | no | impassable; the city wall |
| gate | 1/1/1 when broken, else — | 0.80 | no | has gate HP (`B-SIEGE-1`) |
| keep | 1/1/1 | 0.70 | no | the city's heart (`B-WIN-2`) |
| town | 1/1/1 | 0.85 | no | inside the walls |

- `[B-MAP-3]` **Generation** is seeded and pure: `generateField(setup)` builds the field from `setup.terrain` (the road's terrain from `W-MAP-1`) and `setup.siege`. Plain: mostly plain and grass, scattered forest. Hills: hill bands. Mountain: mountain edges leaving 2–3 passes. River: a river across the middle with 2–3 fords. Marsh: marsh patches. Forest: forest majority. A **siege** field (an attack on a city, always) puts the city on the defender's (east) side: a wall line on column 10 with one gate hex per 4 rows (at least 2), town hexes behind it and one keep hex at column 13, middle row. A field battle (an uprising: `W-ACT-UPRISE` fights a siege too) is not used in v0.1; every battle is a siege. The attacker deploys in columns 0–2, the defender in columns 11–14 (inside the walls).
- `[B-MAP-4]` Every generated field must leave a passable path from the attacker's deploy zone to every gate (a generator test).

## 2. Units
- `[B-UNIT-1]` A unit is one officer and their troops. Troops are hit points. A unit with 0 troops, or with 0 morale, **routs** and leaves the field (`B-ROUT-1`).
- `[B-UNIT-2]` Troop types and movement points: **spear** 4, **cavalry** 6, **archer** 4. Archers attack at range 1–2 (range 3 from a hill); spear and cavalry at range 1.
- `[B-UNIT-3]` **Type edge** (attacker's damage ×1.25): spear against cavalry, cavalry against archers, archers against spear.
- `[B-UNIT-4]` **Aptitude** of the officer for the unit's type: A ×1.10, B ×1.00, C ×0.85 to the damage the unit deals and divides the damage it takes (`B-DMG-1`).
- `[B-UNIT-5]` **Morale** 0–100 starts at `40 + training / 2` (training from the setup). The world's created officers and garrisons use the same rule.

## 3. Turn order
- `[B-TURN-1]` A battle is fought in **days**, at most `setup.maxDays` (20). Each day every unit acts once, in **initiative** order: LDR + 20 for cavalry, highest first; ties are broken by a seeded shuffle drawn once at the start of the day.
- `[B-TURN-2]` On its turn a unit may **move** and then take **one action**: attack, a tactic, a duel challenge, or wait. It may also act without moving. Once it acts, its turn ends.
- `[B-TURN-3]` **Zone of control:** a unit that enters a hex next to an enemy must stop. Units cannot pass through other units.
- `[B-TURN-4]` A **confused** unit (`B-TAC-CONFUSE`) skips its next turn. A **taunted** unit must, if it can, end its move closer to the taunter and attack it.
- `[B-TURN-5]` The side that controls a unit decides its actions: the player for the player's officer's unit and, when the player's officer is the commander, for every unit of that side. Otherwise the battle AI decides.

## 4. Attacks
- `[B-DMG-1]` Damage of an attack: `floor(troops_att * 0.12 * (A / D) * edge * apt_att / apt_def * terrainDef * surround * moraleMod * roll)` with
  - `A = 0.6 * WAR + 0.4 * LDR + 0.3 * training + 20` (attacker), `D = 0.7 * LDR + 0.3 * WAR + 0.3 * training + 20` (defender),
  - `edge` from `B-UNIT-3`, `apt` from `B-UNIT-4`, `terrainDef` from the defender's hex,
  - `surround = 1 + 0.10 *` the number of other attacking-side units next to the defender,
  - `moraleMod = 0.75 + morale_att / 200`,
  - `roll = 0.9 + 0.2 * rng()`,
  - **momentum:** cavalry that moved 3 or more hexes this turn before a melee attack ×1.30,
  - **oath bond:** ×1.10 if an oath sibling of the attacker is next to the defender,
  - minimum 1.
- `[B-DMG-2]` **Counter:** a melee attack (range 1) is answered by the defender at ×0.5 if the defender still has troops and is not an archer shooting at range. Archers attacked at range 1 counter at ×0.5 too.
- `[B-DMG-3]` **Morale:** a unit that takes damage loses `ceil(25 * damage / troops_before)` morale. A unit that deals damage with its own action gains +3.
- `[B-DMG-4]` An attack preview (`query.attackPreview`) shows min and max damage (roll 0.9 and 1.1), the counter range and every multiplier.

## 5. Tactics
- `[B-TAC-1]` Tactics an officer knows come from their stats: **Fire** INT ≥ 60, **Confuse** INT ≥ 75, **Taunt** WAR ≥ 75, **Rally** LDR ≥ 70, **Volley** archers with LDR ≥ 50.
- `[B-TAC-2]` A targeted tactic succeeds with chance `clamp(50 + INT_user − INT_target, 10, 95)`% (Fire on an empty hex uses `clamp(40 + INT_user / 2, 10, 95)`). A successful tactic gives the user +5 morale. The preview shows the chance.
- `[B-TAC-FIRE]` Range 2. Target a burnable hex (`B-MAP-2`). On success the hex burns for 2 days. A unit in a burning hex at the start of its turn loses 10% of its troops and 10 morale. At the end of each day each burning hex sets each burnable neighbour alight with chance 25%; a hex that has burned 2 days becomes `ash` (plain, not burnable).
- `[B-TAC-CONFUSE]` Range 2, an enemy unit: it skips its next turn.
- `[B-TAC-TAUNT]` Range 2, an enemy unit: it is taunted for its next turn (`B-TURN-4`).
- `[B-TAC-RALLY]` Self: the user and every allied unit next to it gain +15 morale (max 100). Always succeeds.
- `[B-TAC-VOLLEY]` Archers, range 2: attack every enemy unit in the target hex and its neighbours at ×0.6 damage, no counter.

## 6. Duels on the field
- `[B-DUEL-1]` A unit whose officer has WAR ≥ 60 and health ≥ 30 may challenge an adjacent enemy officer. The AI accepts if its WAR ≥ the challenger's WAR − 10, or it is `reckless`; otherwise it refuses and its unit loses 15 morale.
- `[B-DUEL-2]` The duel uses `30-duel-debate.md` §1. If the player's officer is one of the two, the player plays it (a pending duel inside the battle); otherwise it auto-resolves with the duel AI.
- `[B-DUEL-3]` The loser's unit loses 40 morale. A loser knocked out (vigor 0) is wounded (health −30) and, with chance 15%, **slain** (dies; the unit routs). A duel ending in a draw changes nothing.

## 7. Siege
- `[B-SIEGE-1]` Each gate hex has HP `100 + walls * 2` (walls from the setup). An attacker unit next to a gate may attack it: damage `floor(troops * 0.05 * (0.5 + LDR / 100))`; spear ×1.5. At HP 0 the gate is **broken** and becomes passable.
- `[B-SIEGE-2]` Archers inside the walls (on town hexes next to a wall or gate) may shoot over the wall at range 2.

## 8. Rout, victory and the outcome
- `[B-ROUT-1]` A routed unit leaves the field. Its officer is **captured** with chance `40 + 0.3 * (best WAR among adjacent enemies − own WAR)`% clamped to 10–80 (0 if no enemy was adjacent), otherwise escapes.
- `[B-WIN-1]` A side **loses** when its commander's unit routs, or when all its units have routed.
- `[B-WIN-2]` The attacker **wins** at once when one of its units ends its move on the keep.
- `[B-WIN-3]` If `maxDays` ends with both sides standing, the **defender wins**.
- `[B-OUT-1]` The `BattleOutcome` lists the winner, every unit's remaining troops, routed, captured and slain officers, duel results and merit: +150 per surviving winner, +300 for the winning commander, +30 per loser, +50 per enemy unit routed by that unit's own attack or tactic, and +100 for winning a duel.
- `[B-OUT-2]` The battle can be **auto-played** (both sides AI) headlessly from the same engine; the world uses `W-WAR-5` instead for speed, so this is for benches and tests.

## 9. Contract
```ts
createBattle(setup: BattleSetup): BattleState
legalActions(state): BattleAction[]           // never empty until state.outcome
step(state, action): { ok: true, state, events } | { ok: false, code, message }   // never throws
query.moveRange(state, unitId)                // reachable hexes and cost
query.attackTargets(state, unitId) / query.attackPreview(state, unitId, targetId)
query.tacticTargets(state, unitId, tacticId) / query.tacticPreview(state, unitId, tacticId, q, r)
query.initiative(state)                       // order for the rest of the day
query.outcome(state)                          // BattleOutcome once ended
```
Actions: `move{unit,q,r}`, `undoMove{unit}`, `attack{unit,target}`, `attackGate{unit,q,r}`, `tactic{unit,tactic,q,r}`, `challenge{unit,target}`, `duelResolved{result}` (only while a field duel is pending for the player), `wait{unit}`, `retreat{side}` (the player's side gives up: counts as `B-WIN-1`).

## Change log
- 2026-11-07 v0.1 written at M0.
