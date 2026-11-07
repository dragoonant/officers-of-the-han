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
- (none yet)

## Change log
- 2026-11-07 v0.1 written at M0.
