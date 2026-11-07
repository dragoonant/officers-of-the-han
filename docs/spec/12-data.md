# 12 — Data: schema, sources and the stat rubric (v0.1)

Content lives in `src/data/` as JSON, typed by `src/contracts/data.ts` and checked by `npm run validate:data` (`tools/validate-data.ts`) and a unit test. **The types file wins** over this page on any disagreement.

## 1. Files (scenario 190)
| File | What |
|---|---|
| `src/data/cities.json` | ~40 cities: id, name, province, real `lat`/`lon` of the seat (modern location), map `x`/`y` (derived, see §4), development numbers, `source` |
| `src/data/roads.json` | undirected roads: `a`, `b`, `days`, `terrain` |
| `src/data/scenarios/190.json` | start date, factions (id, name, ruler, capital, colour token, relations), city owners and numbers at the start, oath groups, starting friendships, flags |
| `src/data/officers.json` | every officer in any scenario (static facts: name, birth/death, sex, stats, temperament, aptitude, kin, `source`, `basis`) |
| `src/data/scenarios/190-officers.json` | where each officer is at the start of 190: faction, city, post, loyalty, merit, gold, `hidden` |
| `src/data/events.json` | historical events (`40-events.md`) |
| `src/data/generic-portraits.json` | portrait ids a created officer may pick |

## 2. Sources (KB rule 4: research before assuming)
- Each city, officer and event carries `source`: a chapter of the novel (`Romance ch.N`), *Records of the Three Kingdoms* (`Sanguozhi: <biography>`), *Book of the Later Han* (`Hou Hanshu`), or a page (the English Wikipedia article on the person or the commandery, cited by title). No stat, date or relation is invented without a `basis` line saying why.
- Birth and death years: the record where it gives them; otherwise the commonly cited estimate, marked `"estimate": true`.
- The 190 position of each officer (whose service, which city): the record for that year. Where the record is silent for 190, place them where the record next puts them and say so in `basis`.
- The novel's fictional people (for example Diaochan) are included with `source: Romance ch.N`.
- Raw source dumps stay in gitignored `docs/sources/`.

## 3. The stat rubric (PLAN D9: our own values)
Stats are set by us from the record and the novel with this rubric. They are **not** copied from any game.
- **War:** the novel's duel record and personal feats. 95–100 for the two or three peerless fighters of the age; 85–94 for famed champions; 70–84 for capable fighting generals; 50–69 for officers who fought but are not remembered for it; below 50 for civilians.
- **Leadership:** independent commands and their results. 90+ for commanders of decisive campaigns; 75–89 for trusted field commanders; 55–74 for subordinate commanders; below 55 for officers who did not command.
- **Intellect:** strategy, counsel and stratagems credited to them. 90+ for the great strategists; 75–89 for advisers whose plans are recorded; 55–74 for competent officers; lower for officers the novel shows as rash or easily fooled.
- **Politics:** governing, law, farming, finance. 85+ for chancellors and great administrators; 65–84 for good governors; 40–64 average; below 40 for officers who only fought.
- **Charisma:** the following they drew and how others answered them. 90+ for those men flocked to; 70–89 for respected leaders; 40–69 average; below 40 for the hated or the tyrannical.
- Officers that also appear in three-kingdoms-tactics keep that game's War, Intellect, Leadership and Charisma values unless the rubric clearly disagrees (log a `RULING:`), so the two games agree.
- Each officer's `basis` gives one line per stat that is 85+ or 30−.
- **Temperament** from the record's character: `righteous` (keeps faith at a cost), `ambitious` (seeks power, changes sides), `cautious` (avoids risk), `reckless` (rash, hot-headed), `steady` (none of these).
- **Aptitude:** `A` for the troop type the record shows them leading, `B` for types they could lead, `C` otherwise. Civilians are `C` in all three except the one they would least badly lead.

## 4. The map projection
`x = (lon − 97) * 30`, `y = (41.5 − lat) * 36`, rounded, so the map is about 900 × 800 units. The SVG map in the client is drawn in those units. Cities whose dots fall within 25 units of each other are nudged apart by hand with `"nudged": true`.

## 5. Scale of the 190 world
About 40 cities covering the thirteen provinces (Sili, Yu, Ji (Hebei), Yan, Xu, Qing, Jing, Yang, Yi, Liang, Bing, You, Jiao), roughly one city per one or two commanderies that mattered in the period. Roads follow the period's main routes; `days` from distance (about 1 day per 30 km by road, ×1.5 in mountains, min 5, max 25).

About 200 officers: every faction leader of 190, their notable officers, the notable wanderers (for example Zhao Yun, Taishi Ci, Gan Ning), and officers who come of age later in the period (`appears`), such as Zhuge Liang (appears 197) and Lu Xun. At least 30 hidden officers (`hidden: true`) to be found by search.

## 6. The validator checks
Ids unique and kebab-case; every reference resolves (city owners, rulers, kin, oath members, friendships, event refs); every officer has `source` and `basis`; stats 1–100; dates plausible (born < died, appears ≥ born + 12); each faction's ruler is in the faction and in one of its cities; each faction holds its capital; the road graph is connected; no two roads join the same pair; every city in a scenario has numbers within its maxima; at least 180 officers exist in 190 or appear by 200.

## Change log
- 2026-11-07 v0.1 written at M0.
- 2026-11-07 M1b: dates, courtesy names, 190 seats, coordinates and sources checked against English Wikipedia (`docs/handoff/m1b-verify.md`); scripts in `tools/data/verify/`. A city's lat/lon follows the Wikipedia article of the modern place on the seat.
