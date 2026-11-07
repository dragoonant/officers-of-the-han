# M4b handoff: result letter, ArmyForm, suggestArmy, Dong Zhuo balance

Branch `m4b` (worktree `oth-m4b`), not pushed, not merged. Two commits: UI/engine tasks 1-3, then the balance work.

## What changed
| Rule id | Change | Where |
|---|---|---|
| `W-WAR-10` | Every resolved battle the player was in, or whose attacker or defender is the player's house, sends one `letter` pending: who marched on whom and where, who won, troops lost per side, prisoners, slain, who holds the city. Numbers come from the outcome and final officer status. Replaces the loser-only "has fallen" letter. The world client shows it with the existing letter UI (`data-testid="letter"`). | `src/world/war.ts` (`battleLetter`) |
| `W-PROP-1` | `query.suggestArmy(s, from, to, proposer?)`: with a proposer the army is led by and fitted to them (`suggestArmyLedBy`, proposer first, sole commander, their best type). A `propose war` with no `units`, and its chance preview, use it (before, it could fail "the proposer leads the army"). The propose dialog calls it; spec `00-architecture.md` updated. | `src/world/war.ts`, `query.ts`, `rules.ts`, `Dialogs.tsx` |
| (client) | `ArmyForm` renders "Not available" when the route's cities are missing; the propose dialog says so when nothing can be proposed. Tested with `renderToStaticMarkup`. | `Dialogs.tsx` |
| `W-DIP-4` | A surrender demand is not legal (and has chance 0) against a house of more than 2 cities, or a ruler who is ambitious, reckless or righteous. | `rules.ts` (`surrenderBar`) |
| `W-DEATH-4` | Succession split: when a ruler of a house of 4+ cities dies, each non-capital prefect may break away (75 - loyalty - 40 if the heir is a child, max 70%) to the neighbouring house with the best CHA + friendship/2, or found a faction if none borders the city. `rebel` moved to `people.ts` as `rebelCity`. | `people.ts` |
| `W-AI-2` | War chance 60% -> 75%. | `src/ai/world/ruler.ts` |
| `W-AI-3` | Bug: a scout that reached its target walked home with the day budget and never counted. It now stays until month end. | `src/ai/world/officer.ts` |
| data | `burning-of-luoyang` also moves 20,000 troops from Luoyang to Chang'an (generator `tools/data/events.ts`, rebuilt `events.json`). The only data change; the other fixes are rules. | `tools/data/events.ts` |
| tool | `tools/sim.ts` prints the `M4b:` line (Dong Zhuo's house at 200, Cao Cao alive). | `tools/sim.ts` |

Specs edited first: `10-rules.md` (W-WAR-10, W-DIP-4, W-DEATH-4, W-AI-2, W-AI-3, change log), `00-architecture.md`, `40-events.md`, `13-balance.md` (M4b section); PLAN.md rulings added. Tests: `tests/unit/world/m4b.test.ts` (new), W-WAR-10 x2 in `rules4.test.ts`, W-DIP-4 and W-DEATH-4 in `rules5.test.ts`; `tests/e2e/battle-flow.spec.ts` ends the played battle with the result letter.

## Sim (10 seeds x 10 years; 30-seed run in `13-balance.md`)
| | before | after | 30 seeds |
|---|---|---|---|
| Dong Zhuo's house, cities at 200 | 13.2 | 4.4 | 5.2 |
| Cao Cao alive | 4 of 10 | 10 of 10 | 28 of 30 |
| famine / faction-year | 0.09 | 0.08 | 0.08 |
| wars / faction-year | 0.59 | 0.68 | 0.59 |
| invariant failures, stalls | 0, 0 | 0, 0 | 0, 0 |
| seeds with a house over 40% | 3 | 0 | 0 |
| Yuan Shao / Sun / Liu Biao alive | 6 / 10 / 9 | 10 / 7 / 10 | 30 / 26 / 30 |
| missions done / failed | 236 / 134 | 351 / 2 | 891 / 15 |
| factions at 200 | 13.4 | 17.9 | 18.6 |

## Open
- **Factions at 200 are 17.9, outside the 8-14 band.** Without Dong Zhuo eating the board, the 1.4x attack ratio gives a standoff (battles per year fall from ~350 in 190 to ~30 by 198). Needs a late-game pressure term or a wider band; not a regression in the targets I was given, but the world is quiet after about 195.
- The war count is still a cliff in `WAR_CHANCE` (70: 0.42, 75: 0.6-0.7, 80: 0.96). 75 is on the safe side but any AI change can move it; re-measure on 20-30 seeds.
- Cao Cao's survival also leaned on a data change (Luoyang's garrison going west with the court). If the owner prefers pure rules, the alternative is a second start city for Cao Cao; I did not do that.
- Dong Zhuo's house averages 4-5 cities, which is a plausible Li Jue regime but at the low end of "falls apart by 195-197"; `SPLIT_BASE` in `people.ts` tunes it.
- `W-WAR-10` letters can pile up in big AI wars when the player's house is attacked often (one per battle); no digest yet.
- The sim's player line ends early in 1-2 of 10 seeds (30 seeds: 5), so year-200 columns average fewer seeds.
