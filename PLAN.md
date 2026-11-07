# PLAN — Officers of the Han (working title)

An original browser strategy game set in the Three Kingdoms era, built as a spiritual successor to Koei's *Romance of the Three Kingdoms VIII* (2001): you play **one officer** in a living world, from wandering free officer to ruler, while every other officer lives the same life under AI. It is not affiliated with Koei Tecmo. It is not a port or a recreation: the rules (`docs/spec/10-rules.md`, `20-battle.md`, `30-duel-debate.md`), the names of systems, the text, the art and the music are ours. Historical people and events come from the public-domain novel and the historical record.

## Decisions (owner, 2026-11-07 — do not re-ask)
Asked through the multiple-choice UI before the owner went to sleep (two batches, 4 + 3).
- **D1** Home: a **new repo** the owner creates (suggested `dragoonant/officers-of-the-han`). Until it exists, work is pushed to the session branch `claude/festive-ptolemy-piwnlu` of `three-kingdoms-tactics` and the history moves over unchanged.
- **D2** Battles: **new hex field battles**, our own rules (`docs/spec/20-battle.md`), not the tactics game's square grid. Battles without the player's officer auto-resolve (`W-WAR-5`).
- **D3** First playable scope: **full map, one scenario**: all of China at city level (about 40 cities), about 200 officers, play as any officer.
- **D4** First scenario: **190, the coalition against Dong Zhuo**.
- **D5** Presentation concept: **Han lacquerware** (`docs/spec/50-presentation.md`): vermilion on black lacquer with cloud-scroll bands, the map as a painted lacquer tray, bronze-mirror dials, letters on silk.
- **D6** First playable pillars, all four chosen: **personal ties** (friendship, oath siblings, marriage, rivals), **duels and debates**, **novel events**, **create your own officer**.
- **D7** Overnight run approved: specs, data, the strategy engine, the hex battle engine, then a first playable on Pages. About 5–6M tokens, Sonnet implementers in worktrees, Workflows allowed, a push per stage, KB updates.

## Defaults taken (change any by saying so)
- **D8** Stack: the sibling stack (Vite 8, React 19, three 0.186 / R3F 9 / drei 10, zustand 5, TypeScript strict, Vitest, Playwright pinned to 1.63.0). Pages via GitHub Actions; the owner enables Source: GitHub Actions on the new repo.
- **D9** IP posture (as tactics D10): historical names from the novel and the record; our own stat values set from the record by our own rubric (`docs/spec/12-data.md` §3), never copied from any Koei game; no Koei names of systems, art, music or UI. README and title say "unofficial, non-commercial fan project, not affiliated with Koei Tecmo".
- **D10** World map is 2D (SVG painted lacquer tray, phone-first); battles are 3D (R3F hex board with the house figure style, KB rule 7). Duels and debates are 2D lacquer screens.
- **D11** Time: monthly turns, 30 days per officer per month, actions cost days (`W-TIME-*`). The player acts first each month, then the world.
- **D12** Posts in the first playable: Ruler, Prefect, Officer, Wanderer. Viceroy (region governor) comes later.
- **D13** Historical lifespans on by default (a setting); historical events on by default (a setting).
- **D14** The AI never executes the player's officer; if the player's officer dies, the player continues as an heir, oath sibling or close friend (`W-DEATH-2`).
- **D15** Portraits: the 128 tactics portraits are copied for the officers they match; every other officer gets a lacquer medallion with a cloud-scroll monogram (a designed card face, not a stand-in). Rendered or painted portraits for the rest arrive later at the same paths.
- **D16** Saves: KB rule 22 from the first playable; storage key `oth-save`.
- **D17** KB rules 24–27 (no text selection on long press, picking by tile, model loaded before shown, mouse controls) from the first playable.
- **D18** Audio: not in the first playable. The Audio Studio runs only on the owner's PC; a later session on the PC generates it.
- **D19** Working title "Officers of the Han" until the owner picks one.

## Milestones
| Id | What | Status |
|---|---|---|
| M0 | Scaffold, PLAN, specs 00/10/12/20/30/40/50, frozen contracts in `src/contracts/` | in progress |
| M1 | 190 data: cities, roads, factions, ~200 officers, ties, events, with sources and a validator | |
| M2a | World engine (`src/world`) + world AI + headless 10-year sim with invariants | |
| M2b | Hex battle engine (`src/battle`) + battle AI + bench; duel and debate engines (`src/duel`, `src/debate`) | |
| M3 | First playable on Pages: title, new game (pick or create officer), lacquer map, city/officer/letters screens, month loop, hex battle board, duel and debate screens, autosave + Continue, e2e | |
| M4 | Balance: sim + bench passes, AI tiers | |
| M5 | Art: portraits for every officer, battle figures per officer kit (owner PC for GPU) | |
| M6 | Audio (owner PC) | |
| M7 | Polish, Viceroy, more scenarios (184, 194, 200) | |

## Rulings / balance log
Format: `RULING: <rule> | <what we did> | <why> | <status>`.
- RULING: B-TURN-4 | a taunted unit that can attack its taunter (after a legal move, or now) has `wait`, other targets, tactics, gate attacks and challenges removed from `legalActions`; if it cannot reach, its moves are limited to hexes strictly closer and `wait` stays legal. The taunt ends after the unit's turn. So `wait` is not always legal in that one case; `legalActions` is never empty. | the rule says "must, if it can" | accepted (coordinator 2026-11-07)
- RULING: B-DMG-1 | "moved 3 or more hexes" for cavalry momentum is the hex distance from the turn's start hex to the end hex (not path length); melee (range 1) only | independent of the path chosen | accepted (coordinator 2026-11-07)
- RULING: B-DMG-2 | the counter uses the defender's troops and morale after the hit, and its own terrain/surround/oath at the attacker's hex; the preview range uses max damage for the counter minimum and min damage for the counter maximum | consistent with the order of play | accepted (coordinator 2026-11-07)
- RULING: B-SIEGE-2 | ranged attacks have no line-of-sight rules at all, so any archer (range 1-2, 3 on a hill) shoots across a wall hex; the rule is therefore the general behaviour. Melee cannot cross because a wall line leaves distance 2 | simplest reading | accepted (coordinator 2026-11-07)
- RULING: B-MAP-3 | gate rows are 1, 5 and 9 (11 rows / 4 = 3 gates); a road overlays the middle row (not over river/ford/mountain); columns 8-9 and the deploy columns 0-2 are always passable; B-MAP-4 is enforced by a repair pass that opens the gate's row. Attackers deploy front to back (spear/cavalry first, archers rearmost); defenders archers first on column 11 (shooting over the wall), commander at column 14 | spec silent on exact layout | accepted (coordinator 2026-11-07)
- RULING: B-DUEL-1 | the AI acceptance rule applies to a target not controlled by the player; if the challenged officer is in `playerControls` the duel is always played (the player may Yield in it). A refusal ends the challenger's turn and costs the target's unit 15 morale (which may rout it) | spec only describes the AI acceptor | accepted (coordinator 2026-11-07)
- RULING: B-DUEL-3 | morale -40 applies to the loser for knockout and yield (not draw); wound (-30 health, floored at 0) and the 15% slain roll only on knockout; slain units rout without a capture roll; a loser whose morale reaches 0 routs and may be captured; a challenger who wins a duel keeps its turn ended (the challenge was the action) | spec | accepted (coordinator 2026-11-07)
- RULING: B-TAC-FIRE | fire cannot target a hex holding an ally (not offered, rejected by `step`); a hex is "burning for 2 days" meaning: units standing in it at the start of their turn take the damage; at each day end it first spreads (25% per burnable, not-yet-alight neighbour, in hex-index then direction order), then loses one day; at 0 it becomes `ash` (new terrain value, plain rules, not burnable). Burn kills credit the caster (merit +50) | spec | accepted (coordinator 2026-11-07)
- RULING: B-TAC-RALLY / VOLLEY | rally gives the user +15 and the +5 success bonus, allies adjacent +15; volley targets any hex within 1-2 whose hex or neighbours hold an enemy, ignores the hill range bonus, gives the archer +3 (damage dealt) and +5 (tactic success) | literal reading | accepted (coordinator 2026-11-07)
- RULING: B-WIN-1 | each side has exactly one commander (the first flagged in the setup, else best LDR); if both sides lose in one action the acting side wins; a unit that starts with 0 troops is routed from the start; `retreat` stays legal during a pending duel | edge cases | accepted (coordinator 2026-11-07)
- RULING: B-OUT-1 | +30 goes to every unit of the losing side (routed or not); +150 only to winners still on the field; +300 to the winning commander on top; +50 per enemy routed by the unit's own attack, volley or fire (not by counters); +100 per duel won | spec | accepted (coordinator 2026-11-07)
- RULING: B-TURN-5 | `step` does not check who is allowed to submit an action (the client/AI split is the caller's job); `query.isPlayerUnit` answers it | engine stays pure | accepted (coordinator 2026-11-07)
- RULING: D-DUEL-3 | each hit is `floor(h * factor)`, at least 1 when the factor is above 0; both hit rolls are always drawn (a then b); both yielding, or both reaching 0 vigor in the same round, is a draw | determinism | accepted (coordinator 2026-11-07)
- RULING: D-DUEL-6 | Mighty Blow (spirit 100) is checked before yielding; tells are shown as weights and rounded percentages; a below-30% vigor shift happens before the clamp at 0 | spec ambiguity | accepted (coordinator 2026-11-07)
- RULING: D-DEB-4 | the stat bonus is floored (`floor(INT/20)`) so forces and damage are whole numbers; D-DEB-1 composure is floored after the bonus | whole numbers for the UI | accepted (coordinator 2026-11-07)
- RULING: D-DEB-2/6 | players with no tablet to play (impossible in 6 rounds) would deal nothing; both at 0 composure goes to the defender (b); an AI-vs-AI state steps with `stepDebate(state, {})` | determinism | accepted (coordinator 2026-11-07)

## Change log
- 2026-11-07 v0.1 written at M0.
