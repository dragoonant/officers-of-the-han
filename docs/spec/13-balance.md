# 13 Balance (M4a)

Measured with `npm run sim -- --years 10 --seeds 10` on the real data (the autopilot plays the player's officer; seeds 1-10 pick 10 different officers). "Wars" is the number of `war` log lines seen after the first step; "battles" counts every resolved battle, so it is the better war count (the first month's armies are launched inside `newGame` and are not in the step events). Wars per faction-year use battles when the two differ.

Data versions: rows marked (old) used the data before the coordinator's verification pass (merge `0df1a73`); rows marked (new) used the merged data. The headline before/after uses (new) for both.

## Targets and result (new data)

| Measure | Target | Before | After |
|---|---|---|---|
| Famine lines per faction-year | < 1 | 0.30 (431) | 0.13 (208) |
| Famine in 190-1..190-9 | none for a faction that starts with rice | 336 lines, in 11 cities | 5 lines, all Runan (a city vacant at the start, 180 rice for 1,500 troops) |
| Wars per faction-year | 0.3-0.8 | 1.30 (1,881 battles) | 0.49 (746 battles) |
| Factions at 200 (mean) | 8-14 | 15.9 | 13.9 (range 10-17 by seed) |
| Seeds where one house holds over 40% of cities at 200 | at most 2 | 1 | 0 |
| Strong houses alive at 200 (of 10 seeds) | most seeds | Cao Cao 3, Yuan Shao 10, Sun 8, Liu Biao 8, Liu Yan/Zhang 10 | Cao Cao 5, Yuan Shao 8, Sun 9, Liu Biao 10, Liu Yan/Zhang 10 |
| Captures per battle | < 0.25 | 0.45 | 0.21 |
| Diplomacy lines per faction-year | < 1 | 1.46 (2,085) | 0.69 (1,064) |
| Missions done vs failed | done >= failed | 95 vs 259 | 238 vs 90 |
| Successions | explained | 179 | 113: ruler deaths are old age 66, scripted event deaths 28, executed 2; ruler captures only 15 (a faction's last city) |
| Invariant failures | 0 | 0 | 0 |

Cao Cao alive in 5 of 10 seeds is the one soft miss: he starts with one city (Chenliu, 5,000 troops) beside Dong Zhuo's 34,000-man Luoyang and the AI has no reason to spare him. See the handoff.

## Step by step (one change at a time, 10 seeds x 10 years)

| Step | wars | battles | captures | famine | diplomacy | missions done/failed | resign | succession | joins | factions 200 |
|---|---|---|---|---|---|---|---|---|---|---|
| (old) baseline | 2606 | 2654 | 1220 | 458 | 2242 | 106 / 221 | 116 | 206 | 1729 | 14.3 |
| (old) S1 missions: develop work must be below its cap and payable, scouts at most 15 days away, autopilot stops its random "variety" while on a mission | 3113 | 3096 | 1330 | 457 | 2187 | 183 / 80 | 119 | 218 | 1804 | 13.9 |
| (old) S2 W-AI-6 rice gate on drafting and on armies | 2041 | 2085 | 889 | 499 | 2059 | 147 / 178 | 112 | 203 | 1410 | 16.0 |
| (old) S2b armies sized to the job (smallest of 20/30/40/50/60/80%) | 939 | 1074 | 501 | 151 | 2551 | 125 / 214 | 61 | 135 | 1021 | 20.0 |
| (new) baseline after merging the data fixes | 1861 | 1881 | 843 | 431 | 2085 | 95 / 259 | 122 | 179 | 1347 | 15.9 |
| (new) W-WAR-5 capture 20% -> 10%, rulers retreat (80% armies, ratio 1.6) | 476 | 586 | 80 | 484 | 2386 | 134 / 169 | 70 | 106 | 597 | 20.9 |
| (new) same at ratio 1.4 | 2474 | 2503 | 753 | 488 | 2309 | 193 / 102 | 113 | 168 | 1275 | 15.4 |
| (new) same at ratio 1.2 | 4055 | 3930 | 1187 | 490 | 2018 | 170 / 121 | 163 | 195 | 1762 | 11.5 |
| (new) ratio 1.4, war chance 40% a month | 438 | 474 | 107 | 412 | 2256 | 88 / 217 | 73 | 115 | 645 | 20.0 |
| (new) + truce only without a pact, 8% (was 20%, alliance escalation) | 502 | 543 | 128 | 398 | 1071 | 143 / 160 | 94 | 114 | 701 | 19.8 |
| (new) + surrender demand at 3.5x troops, 6% | 477 | 522 | 75 | 406 | 994 | 50 / 293 | 57 | 95 | 605 | 15.2 |
| (new) + W-AI-5 peaceful opening and coalition target | 528 | 518 | 118 | 268 | 1155 | 243 / 153 | 95 | 120 | 716 | 13.8 |
| (new) war chance 60% | 844 | 835 | 172 | 260 | 1110 | 189 / 171 | 123 | 114 | 785 | 14.1 |
| (new) FINAL: + 25% army against an undefended city | 760 | 746 | 154 | 208 | 1064 | 238 / 90 | 116 | 113 | 784 | 13.9 |

Reading the sweep: the war count is a cliff, not a slope. With 80% armies and no throttle the attack ratio 1.2 / 1.4 / 1.6 gives 3.2 / 1.6 / 0.3 wars per faction-year, because a conquest leaves a weak garrison that invites an immediate counter-attack, and each counter-attack makes the next. A per-month war chance breaks that cascade; the surrender demand and the smaller factions' pact rate then supply the consolidation that wars alone no longer give. Single runs move by a few percent from RNG alone (the mission counts moved most), so compare trends, not decimals.

## What caused each symptom

- **Famine:** the AI drafted with no regard for rice, and an army that took a city put 80% of the source's troops into it with two months of rice. Fixed by `W-AI-6` and by sending only 25% against an undefended city. What remains in 191-192 is Dong Zhuo's huge garrisons (Luoyang pays 340 rice a month against 3,200 a year of income): a structural data matter.
- **Captures and successions:** 115 of 206 successions were captured rulers, and a captured ruler's successors were captured in the same battle one after another (Cao Cao's house went through four rulers in a month). Fixed by `W-WAR-5` (10% capture, rulers with another city retreat) and by capturing rulers last.
- **Missions:** the AI offered `develop` work that was already at its maximum (impossible), and the autopilot spent mission days on random actions.
- **Diplomacy spam:** a threatened ruler asked for a truce, then an alliance, every month at 20%, against the same house.
- **A war at the first step:** `newGame(190)` launched 13-15 armies in month 1. `W-AI-5` forbids AI armies for three months (`newGame` now has 0 armies, tested in `ai-balance.test.ts`); the coalition alliance fires at the end of month 1, so it binds before the first war can start, and its members prefer Dong Zhuo's cities while the flag stands.
