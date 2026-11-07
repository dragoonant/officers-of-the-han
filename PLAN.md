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
| M0 | Scaffold, PLAN, specs 00/10/12/20/30/40/50, frozen contracts in `src/contracts/` | done |
| M1 | 190 data: cities, roads, factions, ~200 officers, ties, events, with sources and a validator | done (M1b verified against Wikipedia) |
| M2a | World engine (`src/world`) + world AI + headless 10-year sim with invariants | done |
| M2b | Hex battle engine (`src/battle`) + battle AI + bench; duel and debate engines (`src/duel`, `src/debate`) | done |
| M3 | First playable on Pages: title, new game (pick or create officer), lacquer map, city/officer/letters screens, month loop, hex battle board, duel and debate screens, autosave + Continue, e2e | done; live on Pages 2026-11-07 |
| M4 | Balance: sim + bench passes, AI tiers | M4a and M4b done (Dong Zhuo dominance fixed); open: factions at 200 above the band, a quiet late game |
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

- RULING: E-4 contest substitution | when the player gets an event choice, `contest.a` is replaced by the player's officer, also inside `onWin`/`onLoss`/option effects that name the old id (coordinator note 1) | historical default is only a default | accepted (coordinator 2026-11-07)
- RULING: E-3 alliance in options | on any non-zero option the player's faction is dropped from `alliance.factions` (coordinator note 2) | declining must not bind the player | accepted (coordinator 2026-11-07)
- RULING: E-4 letters | no `letter` effect; a fired event sends a letter when `major` or the player is involved (note 4) | data.ts has no letter kind | accepted (coordinator 2026-11-07)
- RULING: rivals | each `scenario.rivals` entry is read as a pair by index (note 5) | accepted (coordinator 2026-11-07)
- RULING: E-3 `relation{a,b}` | a and b may be faction ids or officer ids (an officer means their current faction) | data does not say | accepted (coordinator 2026-11-07)
- RULING: E-5 | an event is skipped (and re-checked each month, no roll) while any officer or faction named in its main `effects` is dead/unborn/destroyed | simplest reading | accepted (coordinator 2026-11-07)
- RULING: W-WAR-6 | the winning commander gets 150 + 300 (additive, as B-OUT-1) | accepted (coordinator 2026-11-07)
- RULING: W-MIS-1 | `campaign` is not a Mission kind in the contract; armies carry units instead. Deadlines are set by the engine (develop/envoy: this month; recruit/scout: end of next month), ignoring the supplied `deadline` | accepted (coordinator 2026-11-07)
- RULING: W-MIS-2 | an envoy mission completes on the attempt: +200, +220 if refused | accepted (coordinator 2026-11-07)
- RULING: W-CRT-TRANSFER | the officer moves at once and has 0 days this month (no state field for "arrives next month") | accepted (coordinator 2026-11-07)
- RULING: W-ACT-GIFT | a ruler's `fromCity` reward may go to any officer of the faction in any city, paid from the ruler's city (or the capital if the ruler is away); needed so the AI court can reward W-AI-2 | accepted (coordinator 2026-11-07)
- RULING: W-ACT-SEARCH | if a hidden officer is present and the find roll fails, the gold roll (50%) still applies | accepted (coordinator 2026-11-07)
- RULING: W-WAR-3 | defenders are taken from the pool by prefect first then LDR+WAR; city troops not on the field stay home; a player who defends may omit themselves from the chosen defenders | accepted (coordinator 2026-11-07)
- RULING: W-WAR-7 | a rebel (uprising) win founds a faction (commander ruler); a rebel loss captures every rebel; rebel training is 20 | accepted (coordinator 2026-11-07)
- RULING: W-CAP/state | a captive keeps `faction` = old faction (needed for release/recruit); a captured ruler triggers succession first | accepted (coordinator 2026-11-07)
- RULING: W-ACT-DUEL (AI vs AI) | WAR + health/10 + 20*rng each, within 3 is a draw; AI debates: INT + CHA/2 (with composure bonus) + 15*rng, ties to the asked side | accepted (coordinator 2026-11-07)
- RULING: W-PROP-1 | AI officers never propose to a player ruler (no offer kind for it); AI officers do send recruit/oath/marry `offer`s to the player (rulers 20%, oath 15%, marriage 10%, per officer per month in the same city) | accepted (coordinator 2026-11-07)
- RULING: W-AI-2/3 | AI rulers also do city work as officers; the AI keeps a gold reserve of 30 per officer in the city before spending on work; wanderers claim a vacant city when able; officers abroad without a mission walk home | accepted (coordinator 2026-11-07)
- RULING: officers in data but absent from both `scenario.officers` and `appearances` stay `unborn` forever | accepted (coordinator 2026-11-07)
- RULING: hidden officers start as wanderers with no faction | accepted (coordinator 2026-11-07)
- RULING: W-ECO-4 | officers in an army are paid from their source city; officers standing in a foreign city are not paid | accepted (coordinator 2026-11-07)
- RULING: log | only chronicle kinds (see `LOG_KINDS`) and entries naming the player are stored; the log is capped at 2000 entries | keeps 200-officer sims light | accepted (coordinator 2026-11-07)
- RULING: W-WAR-5 | capture chance 20% -> 10% (+20 with no retreat unchanged); a losing ruler with another city retreats instead of being captured | sim 10x10: captures/battle 0.45 -> see docs/spec/13-balance.md; 115 of 206 successions were captured rulers | open
- RULING: W-AI-2 war throttle | the AI looks for a war with 60% chance per slot per month; armies are 80% of the city's troops (25% against an undefended city); threat truce 20% -> 8% and only without a pact; new surrender demand at 3.5x troops (6%/month) | sim 10x10: wars/faction-year 1.30 -> 0.49, diplomacy 1.46 -> 0.69, factions at 200 15.9 -> 13.9 | open
- RULING: W-AI-5 | no AI war in the first 3 months of a scenario; coalition members prefer Dong Zhuo's cities while the `coalition` flag stands | coordinator request: newGame(190) had 13-15 armies on the march | open
- RULING: W-AI-6 | AI drafts and sends armies only with enough rice to the next harvest | sim: early-190 famine lines 336 -> 5 | open
- RULING: sim on real data (10 seeds x 10 years, 2026-11-07) | 0 invariant failures, 0 stalls; factions 23 -> 14.3 by 200; 458 famine lines, 2,242 diplomacy attempts, 1,220 captures, missions failed 2:1 over done | first-pass numbers; tune in M4 (rice economy, AI diplomacy rate, capture rate, mission choice) | open
- RULING: client-AI | the battle AI runs on the main thread with a 0 or 320 ms timeout per action, not in a Web Worker | a full AI action is a few ms; simpler | accepted (coordinator 2026-11-07)
- RULING: move-tiles | tiles the player may move to are painted ochre with a slow shimmer ("available", 50-presentation.md), attack/tactic targets dashed vermilion, chosen target and selected unit solid vermilion; the unit's own tile gets an ochre ring | spec colours, malachite ground made verdigris unreadable | accepted (coordinator 2026-11-07)
- RULING: pigments | sides take a pigment from a pool of eight that contrast with the board (azurite, orpiment, lead white, madder, indigo, plum, sienna, slate), hashed from the faction id, never equal for both sides | spec lists 14 but some match terrain | accepted (coordinator 2026-11-07)
- RULING: confirm-tap | an attack, tactic or challenge target is picked by one tap and confirmed by a second tap on it or the Confirm button, whose cost line carries the `query.attackPreview` / `tacticPreview` numbers | phone-safe | accepted (coordinator 2026-11-07)
- RULING: gate-preview | the engine has no preview for gate attacks; the button shows gate strength from `query.hexAt` | none exists | accepted (coordinator 2026-11-07)
- RULING: D-DUEL-3 | hit base is 6 + floor(WAR / 8) (was unfloored, the duel screen showed "Hit 18.125+") | whole numbers on screen, as D-DEB-4 | accepted (coordinator 2026-11-07)
- RULING: picker | all officers active or marching at the start (not hidden) are offered; one who starts in an army says so on the card | Cao Cao and others must be playable | accepted (coordinator 2026-11-07)
- RULING: seed | the default seed is `Date.now() % 1e9`, read in the client only, shown in an editable field | no hidden randomness | accepted (coordinator 2026-11-07)
- RULING: a finished game clears its save (KB rule 22) and the end screen is held in memory only | rule 22 | accepted (coordinator 2026-11-07)
- RULING: unavailable actions of one kind with the same reason collapse into one button (a house officer's ten travel targets) | readability on phones | accepted (coordinator 2026-11-07)
- RULING: battle letter | a short silk letter ("Take the field") precedes the board; a resumed saved battle opens the board directly | gives context before a full-screen takeover | accepted (coordinator 2026-11-07)
- RULING: propose-war army | start from `suggestArmy` with the player forced in as sole commander | `suggestArmy` has no proposer argument | accepted (coordinator 2026-11-07)
- RULING: successions in the end summary | the lineage is rebuilt from the log (current player, the `begins.` line, `succession` entries) | no state field lists past players | accepted (coordinator 2026-11-07)
- RULING: 190 data, vacant cities | rice = upkeep*12 + farm*6 like owned cities (was upkeep*12: Runan 180 rice for 1,500 troops) | M4a data request: claimants starved by month 5; after: 0 famine in 190-1..9, 0.09 famine per faction-year, wars 0.59 per faction-year, captures 0.18 per battle (10 seeds x 10 years) | accepted (coordinator 2026-11-07)
- RULING: balance follow-up | Dong Zhuo's house (Li Jue after 192) averaged 11.9-13.2 cities by 200 and Cao Cao survived in 4 of 10 seeds | closed by the M4b rulings below (W-DIP-4, W-DEATH-4, burning of Luoyang, W-AI-3 scout, W-AI-2 war chance); see docs/spec/13-balance.md | accepted (M4b)
- RULING: W-WAR-10 | a resolved battle that involves the player (officer in it, or their faction attacker/defender) sends one `letter` pending with attacker, defender, city, winner, losses, prisoners, slain and the city's holder; replaces the loser-only 'has fallen' letter | M3c handoff: the player had no feedback after a battle | open
- RULING: W-PROP-1 army | `query.suggestArmy(s, from, to, proposer?)` returns an army with the proposer first and sole commander (`suggestArmyLedBy`); a `propose war` without units and the AI/query chance preview use it too, so a proposal that omits units no longer fails 'the proposer leads the army'; replaces the M3a 'propose-war army' client workaround | M3a/M3c request | open
- RULING: W-DIP-4 (M4b) | a surrender demand is not legal, and its chance is 0, against a house of more than 2 cities or a ruler who is ambitious, reckless or righteous | cause 1 of the snowball: Dong Zhuo demanded surrender at 3.5x troops (chance up to 60%) and swallowed whole houses (4 of 6 Cao Cao endings were "submitted to Dong Zhuo") | 10 seeds: Dong Zhuo 13.2 -> 9.9 cities, Cao Cao 4 -> 7 alive | open
- RULING: W-DEATH-4 (M4b) | when a ruler of a house of 4+ cities dies, each prefect of a non-capital city may break away (75 - loyalty - 40 if the heir is a child, max 70%), going to the neighbouring house whose ruler has the best CHA + friendship/2, or founding a faction when none borders the city | cause 2: nothing happened after Dong Zhuo's death except loyalty -10, so his successors kept every city; history has Li Jue and Guo Si losing the empire's west | Dong Zhuo's house 9.9 -> about 4 cities | open
- RULING: W-AI-2 war chance (M4b) | 60% -> 75% a slot a month; ratio 1.4 and army sizes unchanged | with Dong Zhuo tamed the world went quiet after 192 (wars 0.34 per faction-year); 75% gives 0.59-0.68 (the cliff is at 80-85%) | open
- RULING: W-AI-3 scout (M4b) | a scout that has reached the scouted city stays until the month ends | bug: on a 5-day road the officer shuttled home and back with its days, ending the month away, and failed the same scout every month (autopilot mission fails 134 -> 2) | accepted
- RULING: burning of Luoyang (data, M4b) | the event also moves 20,000 troops from Luoyang to Chang'an (generator `tools/data/events.ts`) | the 34,000-man Luoyang garrison was the one army that could reach Chenliu in the first spring; Cao Cao fell to it in 7 of 9 deaths even after the rule changes (10/20 seeds alive -> 20/20 with this) | open

## Change log
- 2026-11-07 v0.1 written at M0.

- 2026-11-07 M3c (integration): world and battle CSS shared `.hud`, `.ticker`, `.actions` and `.chip`; the world's are now `whud`, `wticker`, `wactions` and `wchip`. The battle letter hands the saved battle to `BattleScreen` once, on mount, so a save no longer resets the board. Wrapper test ids are `world-battle`, `world-duel` and `world-debate`. Engine requests left open: a battle result letter, `suggestArmy` with a proposer, a list of startable officers, and a guard in `ArmyForm` when `war` or `propose` is unavailable (`docs/handoff/m3c-integ.md`).
