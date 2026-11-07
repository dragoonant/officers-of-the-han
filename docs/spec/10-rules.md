# 10 — World rules (v0.1, frozen for M1–M3)

This is an **original ruleset**. It is in the spirit of the officer-play Three Kingdoms strategy games: you are one officer among hundreds, every other officer lives under the same rules, and rank, ties and loyalty matter as much as armies. Every mechanic, formula and name here is ours. Numbers are first-pass values; change them only with a sim result, and log every change in `PLAN.md` "Rulings / balance log".

Rule ids in brackets (e.g. `[W-ECO-1]`) are what tests are named after. Battles are in `20-battle.md`, duels and debates in `30-duel-debate.md`, events in `40-events.md`, data in `12-data.md`.

All divisions floor unless the rule says otherwise. `clamp(x, lo, hi)`. `rng()` is the world's seeded sfc32 stream (`00-architecture.md`); `d100` = `1 + floor(rng() * 100)`; a check "chance p%" passes when `d100 <= p`.

## 1. Time and the map
- `[W-TIME-1]` One turn is one **month**. The 190 scenario starts in month 1 of year 190. Months run 1–12.
- `[W-TIME-2]` Every officer has **30 days** each month. Actions cost days. Unspent days are lost at month end. An officer with fewer days left than an action's cost cannot take it.
- `[W-TIME-3]` The month runs in this order: **(a) month start**: income (§3), salaries, coming of age, mission handout, AI courts (§10); **(b) the player's turn**: the player's officer acts, each action resolving at once; **(c) the world's turn** (after `endMonth`): every AI officer acts, in ascending officer id order; **(d) month end**: armies resolve (§7), captives, events (§9), deaths (§8), loyalty drift and defection (§5), mission deadlines. Then the next month starts.
- `[W-MAP-1]` The map is a graph of **cities** joined by **roads**. A road has `days` (travel cost, 5–25) and `terrain` (`plain | hills | mountain | river | marsh | forest`), which also picks the battle map (`20-battle.md` §1).
- `[W-MAP-2]` A city has: `population`, `farm`/`farmMax`, `trade`/`tradeMax`, `walls`/`wallsMax`, `order` (0–100), `troops`, `training` (0–100), `gold`, `rice`, an owning `faction` (or none: a **vacant** city), and at most one **prefect**.

## 2. Officers
- `[W-OFF-1]` Stats are 1–100: **War** (fighting, duels), **Leadership** (commanding troops, walls, training), **Intellect** (battle tactics, debate, search), **Politics** (farm, trade), **Charisma** (order, drafting, persuading, friendship).
- `[W-OFF-2]` Each officer also has: birth year, death year (may be null), `health` (0–100), `loyalty` (0–100, null for rulers and wanderers), `merit`, `gold` (personal purse), `temperament` (one of `righteous | ambitious | cautious | reckless | steady`), troop aptitude per type (`A | B | C`, see `20-battle.md`), a location (city, army, captive in a city) and ties (§4).
- `[W-OFF-3]` **Growth:** actions give 10 xp to the stat they use (Study and Drill give 30). At 100 xp a stat gains +1 (max 100) and the xp resets. Officers aged 55 or more gain no xp.
- `[W-OFF-4]` **Rank** comes from merit: 0 **Attendant**, 1,000 **Captain**, 3,000 **Colonel**, 6,000 **General**, 10,000 **Grand General**. A ruler always counts as Grand General. Troop cap per unit: 3,000 / 5,000 / 8,000 / 12,000 / 15,000. Monthly salary in gold: 10 / 20 / 35 / 55 / 80.
- `[W-OFF-5]` **Posts:** `ruler` (one per faction), `prefect` (one per city), `officer` (serves a faction), `wanderer` (serves no one). Viceroy is out of scope for v0.1 (PLAN D12).
- `[W-OFF-6]` **Age and appearance:** an officer is in the world from month 1 of their `appears` year (default birth + 16). Before that they do not exist for any rule.
- `[W-OFF-7]` **Expected tier** (used by loyalty): the sum of the five stats ≥ 400 → 4, ≥ 360 → 3, ≥ 320 → 2, ≥ 280 → 1, else 0.
- `[W-OFF-8]` **Health** recovers +10 at each month start (max 100). An officer with health below 30 cannot join an army or duel. Health 0 means death (§8).

## 3. Economy
- `[W-ECO-1]` **Gold:** at month start each owned city gains `trade * (50 + order) / 400` gold.
- `[W-ECO-2]` **Rice:** at the start of month 9 each owned city gains `farm * (50 + order) / 20` rice.
- `[W-ECO-3]` **Upkeep:** at month start each city pays `ceil(troops / 100)` rice. If it cannot, rice becomes 0, troops lose 10% (floor) and order −5.
- `[W-ECO-4]` **Salaries:** at month start each non-ruler officer of a faction is paid their rank salary from the gold of the city they are in, into their purse. If the city cannot pay, that officer gets nothing and loses 3 loyalty.
- `[W-ECO-5]` **Population:** at month start population grows by `population * order / 20000` (floor).
- `[W-ECO-6]` Vacant cities have no income or upkeep; their numbers stay as they are.

## 4. Ties
- `[W-TIE-1]` **Friendship** is one number 0–100 per unordered pair of officers. A pair with no entry is 20. Data may set starting values.
- `[W-TIE-2]` **Compatibility** of two temperaments: the same temperament +2; `righteous`–`ambitious` and `cautious`–`reckless` −2; any other pair 0.
- `[W-TIE-3]` **Oath siblings:** a group of 2–4 officers who swore an oath. Data may define groups (Liu Bei, Guan Yu and Zhang Fei). An officer is in at most one group.
- `[W-TIE-4]` **Spouse:** at most one per officer. **Kin:** `parent`, `child`, `sibling`, from data only.
- `[W-TIE-5]` **Rival:** a pair is rivals when their friendship is 5 or less, or data says so. Rivals never accept each other's recruitment, oath or marriage proposals.
- `[W-TIE-6]` **Bound to the lord:** an officer whose ruler is their oath sibling, spouse or kin has loyalty fixed at 100 and never defects or resigns under AI.
- `[W-TIE-7]` **Battle comrades:** officers in the same army each gain +2 friendship with each other when the battle ends, win or lose.

## 5. Loyalty and defection
- `[W-LOY-1]` At month end each non-ruler officer of a faction moves loyalty 2 points toward the target `T = clamp(40 + friendship(officer, ruler) / 2 + fit + mood, 0, 100)`. `fit` is +10 if their rank tier ≥ their expected tier (`W-OFF-7`), else −10. `mood`: righteous +10, steady +5, cautious 0, reckless 0, ambitious −10. If the gap is under 2, loyalty becomes T. `W-TIE-6` overrides this.
- `[W-LOY-2]` **Defection:** at month end an AI officer with loyalty below 30 resigns with chance `(30 − loyalty) * 2`% (`W-ACT-RESIGN`).
- `[W-LOY-3]` **Rebellion:** at month end an AI prefect who is `ambitious`, has loyalty below 25 and is not bound (`W-TIE-6`) rebels with chance 10%. Their city becomes a new faction with them as ruler. Officers in the city with loyalty below 50 join; the rest move to the old faction's nearest city (`W-WAR-8`).

## 6. Actions
Each action lists its day cost, who may take it and its effect. The player and the AI use the same actions (`00-architecture.md`, `legalActions`).

### 6.1 City work (officer of the city's faction, in the city; 10 days)
| Id | Gold cost (city) | Effect | Stat xp |
|---|---|---|---|
| `[W-WORK-FARM]` | 20 | farm += 4 + POL / 6 | POL |
| `[W-WORK-TRADE]` | 20 | trade += 4 + POL / 6 | POL |
| `[W-WORK-WALLS]` | 30 | walls += 4 + LDR / 6 | LDR |
| `[W-WORK-ORDER]` | 10 | order += 1 + CHA / 20 | CHA |
| `[W-WORK-TRAIN]` | 0 | training += 2 + LDR / 12 | LDR |
| `[W-WORK-DRAFT]` | ceil(n / 10) | n = min(population / 50, 300 + CHA × 5) new troops; population −n; order −2; training becomes `training * troops / (troops + n)` | CHA |

- `[W-WORK-1]` Every result is capped at its max (farmMax, tradeMax, wallsMax, 100). The city must hold the gold. Each work action gives the officer +20 merit.

### 6.2 Personal actions
- `[W-ACT-TRAVEL]` (road days) Move to a city joined by a road. A wanderer may go anywhere. A faction officer may go only to cities of their own faction, unless a mission names the destination (`W-MIS-1`). A ruler may travel too.
- `[W-ACT-VISIT]` (5 days) Visit another officer in the same city, not a captive: friendship += 3 + CHA / 25 + compatibility. Once per pair per month.
- `[W-ACT-BANQUET]` (10 days, 100 gold from the purse; ruler or prefect only) Every other officer of the same faction in the city: friendship with the host += 2 + CHA / 40. If the host is the ruler, each of those officers' loyalty +1.
- `[W-ACT-GIFT]` (1 day) Give g gold from the purse, g ≥ 50, to an officer in the same city: friendship += min(10, g / 25). If the giver is the receiver's ruler, loyalty += g / 20 instead (a **reward**; a ruler may pay it from the city's gold).
- `[W-ACT-SEARCH]` (10 days) If the city holds a hidden officer (data `hidden`, appeared, not yet found), chance `30 + INT / 2`% to find the one with the lowest id. That officer stops being hidden and becomes a wanderer in the city. Otherwise chance 50% to find `20 + POL / 2` gold for the purse; otherwise nothing. +10 merit when something is found.
- `[W-ACT-STUDY]` (15 days) +30 xp to INT or POL. `[W-ACT-DRILL]` (15 days) +30 xp to WAR or LDR.
- `[W-ACT-REST]` (10 days) Health +20.
- `[W-ACT-RECRUIT]` (5 days; actor serves a faction) Ask a wanderer in the same city to join the actor's faction. Chance `clamp(20 + CHA / 2 + friendship / 2 − 30 if the target has a rival in the faction, 5, 95)`%. When the player is the actor they may instead **debate** the target (`30-duel-debate.md` §2): a win means the target joins; a loss means friendship −5. On joining: post `officer`, loyalty `60 + friendship / 4`. Success gives the actor +100 merit.
- `[W-ACT-SERVE]` (5 days; wanderer) Ask the ruler or prefect in the same city to take you in. Chance `clamp(30 + (statSum − 250) / 3 + friendship(asker, ruler) / 2 + 20 if the faction has fewer than 5 officers, 5, 95)`%. Joining works as in `W-ACT-RECRUIT`.
- `[W-ACT-RESIGN]` (1 day; faction officer, not a ruler) Become a wanderer in the current city. Merit is kept. Friendship with the old ruler −20. Oath siblings in the same city who are not rulers and not bound to their own ruler follow.
- `[W-ACT-DUEL]` (5 days) Challenge an officer in the same city who is not your ruler and has health ≥ 30. The AI accepts if its WAR ≥ the challenger's WAR − 10 or it is `reckless`. The duel uses `30-duel-debate.md` §1 (no death outside battle: at 0 vigor the loser yields). Winner +50 merit; loser's friendship with the winner −5 unless oath siblings.
- `[W-ACT-OATH]` (1 day) Propose an oath to an officer in the same city: needs friendship ≥ 80, not rivals, and a combined group of at most 4. The AI accepts if compatibility ≥ 0. The groups merge.
- `[W-ACT-MARRY]` (1 day) Propose marriage to an officer in the same city: both unmarried and adult, friendship ≥ 70, not rivals. The AI accepts with chance `40 + (friendship − 70) * 2 + 10 * compatibility`%.
- `[W-ACT-CLAIM]` (10 days; wanderer in a vacant city, with at least one companion: a wanderer in the same city with friendship ≥ 60) Found a faction: the actor becomes ruler, the companions become officers, the city becomes theirs.
- `[W-ACT-UPRISE]` (10 days; wanderer in a city whose order is below 60) Raise an uprising: a rebel army of the actor (commander) and up to 4 companions as in `W-ACT-CLAIM`, each leading `300 + CHA × 5` troops, fights the city's garrison (`W-WAR-3`). A win founds a faction holding the city; a loss makes every rebel a captive.

### 6.3 Court actions
- `[W-CRT-APPOINT]` (ruler, 1 day) Make an officer of the faction prefect of the city they are in. The old prefect becomes an officer.
- `[W-CRT-TRANSFER]` (ruler, 2 days) Move an officer of the faction to another faction city. They arrive at the next month start.
- `[W-CRT-MISSION]` (ruler, 1 day) Give an officer a mission (§6.4).
- `[W-CRT-TRANSPORT]` (ruler or that city's prefect, 5 days) Move gold, rice or troops from a faction city to a road-adjacent faction city, at once.
- `[W-CRT-WAR]` (ruler, 10 days) Form an army in any faction city (§7) and send it to an adjacent city. A prefect cannot order war; they propose it (`W-PROP-1`).
- `[W-CRT-DIPLO]` (ruler, 5 days) Send an envoy officer of the faction (may be the ruler) to another faction with a proposal (`W-DIP-*`). When the envoy is the player's officer, the player may debate the other ruler instead of rolling: a win means yes.
- `[W-CRT-CAPTIVE]` (ruler, 1 day each) For a captive held in a faction city: **recruit** (chance `W-CAP-2`), **release** (the captive becomes a wanderer in an adjacent city of their old faction if any, else in the same city), or **execute** (death; every officer of the faction who is `righteous` loses 5 loyalty).
- `[W-CRT-FOCUS]` (prefect or ruler, 1 day) Set a city's work focus for AI officers: `balanced | farm | trade | military | defense`.

### 6.4 Missions and proposals
- `[W-MIS-1]` A **mission** has a kind, a target and a deadline (end of the current month unless stated). Kinds: `develop{city, work, count}` (do `count` work actions of that kind in that city), `recruit{officer}` (deadline end of next month), `scout{city}` (be in that city at any month end, then be back in a faction city by the next month's end; travel there is allowed), `envoy{faction, proposal}` (the actor acts as `W-CRT-DIPLO`'s envoy), `campaign{army}` (the officer is placed in an army; see `W-WAR-1`).
- `[W-MIS-2]` Success gives merit: develop +100, recruit +200, scout +150, envoy +200 (+20 if refused), and friendship with the ruler +3. Failing a deadline: merit −50 (not below 0) and friendship with the ruler −5.
- `[W-MIS-3]` An officer holds at most one mission (campaign excluded).
- `[W-PROP-1]` (1 day, once per month; faction officer or prefect) **Propose** to the ruler, who must be in the same city or be the player: `war{from, to}` (the proposer leads the army), `alliance{faction}` or `truce{faction}` (the proposer is envoy), or `prefect` (the proposer becomes prefect of their city). The AI ruler approves with chance `clamp(30 + friendship / 2 + 5 * rank tier + context, 5, 95)`%. `context` for war: +20 if the army's power is above 1.4× the defence (`W-WAR-5`), −30 if below 1.0×. Approval for war creates the army with the proposer as commander.

## 7. War
- `[W-WAR-1]` An **army** has a source city, a target city joined by a road, and 1–5 units. A unit is an officer of the faction in the source city (not in another army, health ≥ 30), a troop count ≤ their rank cap, and a troop type. The units' troops come out of the city and must fit in it. The army carries `ceil(total troops / 100) * 2` rice from the city. Exactly one unit is the **commander**.
- `[W-WAR-2]` The target must not be the attacker's own city, an ally's, or under truce with the attacker. Allies and truces: `W-DIP-*`.
- `[W-WAR-3]` At month end each army resolves in creation order. If the target is vacant or holds no troops, it falls at once. Otherwise the **defence** forms: up to 5 officers of the defending faction in the city with health ≥ 30. The prefect leads, else the officer with the highest LDR + WAR; the rest are taken by LDR + WAR, highest first. The city's troops are split evenly, each unit capped at its rank cap. A city with troops but no officers defends with one **garrison** unit: stats all 40, troops min(city troops, 5,000), aptitude B.
- `[W-WAR-4]` If the player's officer is in either army, or is the defending prefect or ruler in the city, the battle is played (`20-battle.md`). When the player commands the defence, they choose the defenders (a pending `chooseDefenders`). Otherwise the battle auto-resolves.
- `[W-WAR-5]` **Auto-resolve:** for each side, `P = Σ troops * (0.6 + (WAR + LDR) / 250) * (0.7 + training / 333)` over its units (use the source city's training for the attacker). The defence's P is ×`(1 + 0.6 * walls / wallsMax)`. The attacker wins if `P_att * (0.85 + 0.3 * rng()) > P_def`. With `q = P_loser / P_winner` (≤ 1), each winning unit loses `troops * 0.35 * q` and each losing unit loses `troops * (0.5 + 0.3 * (1 − q))`. Each losing officer is captured with chance 10% (+20 if they have no city to retreat to). A losing ruler whose faction holds another city retreats there and is never captured (`W-WAR-8`).
- `[W-WAR-6]` **Merit:** winners +150 each, the winning commander +300; losers +30 each. A played battle uses the merit in its `BattleOutcome`.
- `[W-WAR-7]` **Attacker wins:** the city passes to the attacker. The attacking officers move in, their surviving troops become the city's troops, and the commander becomes prefect. The city keeps 50% of its gold and rice and loses 20 order. Defending officers not captured retreat (`W-WAR-8`). **Defender wins:** the surviving attackers and their troops return to the source city.
- `[W-WAR-8]` **Retreat:** to the faction city nearest by road days (ties: lowest city id). If the faction has no other city, the officer is captured.
- `[W-WAR-9]` A faction with no cities is destroyed. Its ruler and officers who are not captured become wanderers where they stand.

## 8. Captives, death and succession
- `[W-CAP-1]` A captive is held in a city of the captor's faction, takes no actions and is not paid.
- `[W-CAP-2]` Recruit chance: `clamp(30 + CHA_ruler / 2 − loyalty_old / 2 + friendship(captive, ruler) / 2, 5, 90)`%, and 0 if the captive is bound to their old ruler (`W-TIE-6`).
- `[W-CAP-3]` At month start an AI ruler deals with each captive: recruit; if that fails, release (80%) or execute (20%, never if the ruler is `righteous`). The AI never executes the player's officer (PLAN D14). When the player's officer is captive, the player gets a `captured` letter: join the captor (if the captor offers, chance as above) or refuse (released as `W-CRT-CAPTIVE`).
- `[W-DEATH-1]` **Lifespans** (setting, on by default): at world creation each officer with a death year gets a death month `1 + floor(rng() * 12)`. At that month end they die. Officers without a death year die in the month end after reaching age 75. With the setting off, officers die only of health 0.
- `[W-DEATH-2]` When the player's officer dies, the player picks a successor (pending `chooseSuccessor`) from living officers who are their kin, oath siblings, or friends at 60 or more. With none, the game ends (`W-END-2`).
- `[W-DEATH-3]` **Ruler succession:** the ruler's adult child in the faction, else an oath sibling in the faction, else the faction officer with the most merit. The successor becomes ruler (loyalty null); every officer's loyalty −10.

## 9. Diplomacy and events
- `[W-DIP-1]` Each pair of factions has a **relation** 0–100 (default 30, data may set it). A battle between two factions lowers it by 20 for both.
- `[W-DIP-2]` **Alliance** (24 months): chance `clamp(relation − 20 + CHA_envoy / 4 + 10 if the target is the weaker by total troops, 5, 90)`%. Allies cannot attack each other.
- `[W-DIP-3]` **Truce** (12 months): as alliance +10. Truce partners cannot attack each other.
- `[W-DIP-4]` **Demand surrender:** allowed only when our total troops are at least 3× the target's. Chance `clamp((ratio − 3) * 15 + CHA_envoy / 10, 0, 60)`%. On yes, every city and officer of the target joins us; their ruler becomes an officer.
- `[W-DIP-5]` On success the relation +15; on refusal −5.
- `[W-EVT-1]` Historical events (setting, on by default) are data (`40-events.md`) and are checked at month end in data order. Each fires at most once.

## 10. The AI (summary; details in `src/ai/world/README.md`)
- `[W-AI-1]` The AI uses `legalActions` and `step` like the player, plus the court decisions at month start. It reads the world RNG only in ascending id order (determinism).
- `[W-AI-2]` **Ruler, each month start:** fill empty prefect posts (highest POL + LDR); move officers from cities with more than 4 to faction cities with fewer than 2; give the player's officer a mission with chance 60% if the player serves them (develop the weakest work that is not at its maximum and that the city can pay for twice, recruit a wanderer present, or scout an enemy neighbour at most 15 road days away); deal with captives; reward officers with loyalty below 60 (100 gold) while the capital has over 500 gold. Then, for each war slot (one; two with 9+ cities), with chance 60% a ruler looks for a war: from a border city, an army of its best 5 officers by LDR + WAR with 80% of its troops (25% against a city with no defence) against an adjacent hostile city, if `P_att > 1.4 * P_def` and `W-AI-6` holds. The player's officer is in that army whenever they are in that city and healthy. When threatened (a neighbour faction with over 1.5× our total troops) and bound by no pact with it, a ruler asks it for a truce (8% a month). A ruler with at least 3.5× the troops of an adjacent faction and no pact with it demands its surrender (6% a month, `W-DIP-4`).
- `[W-AI-3]` **Officer, each month:** follow its mission; otherwise do city work for the city's focus (the weakest ratio of farm, trade, order and walls, with border cities training and drafting while troops are under 5,000), and with 20% visit the friend in the city it likes most. Wanderers travel, ask to serve (30% when a non-rival ruler or prefect is present) or search.
- `[W-AI-5]` **Peaceful opening:** in the first three months of a scenario no AI ruler (and not the sim autopilot) sends an army, so a new game starts with no army on the march. While the flag `coalition` is set and `coalition-ended` is not, the AI rulers named in the `coalition-forms` alliance prefer Dong Zhuo's house as the target of a war.
- `[W-AI-6]` **Rice before troops:** an AI officer does not draft unless the city's rice covers `(months until the next harvest + 1) * ceil(troops / 100)` for the enlarged garrison, and a ruler does not send an army unless the city's rice, less what the army carries, covers the same for the troops left at home. (The harvest is at the start of month 9, `W-ECO-2`.)
- `[W-AI-4]` The AI makes the player's officer's choices only in the sim (the `autopilot` policy).

## 11. Your officer
- `[W-NEW-1]` A new game picks either an existing officer who exists in the start month (any post) or a **created officer**: name 1–24 characters, birth year 150–174, five stats each 20–95 with a total of at most 320, a temperament, one troop type at aptitude A and the others B, a portrait from the generic set or the medallion, a start city. A created officer starts as a wanderer with 300 gold and 0 merit.
- `[W-END-1]` If one faction holds every city the game ends: **unified** if it is the player's faction, else **another unified**.
- `[W-END-2]` If the player's line ends (`W-DEATH-2` with no successor), the game ends: **the chronicle closes**.
- `[W-END-3]` The end screen summarises the player's officers' lives from the event log: posts held, battles, duels, ties made.

## Change log
- 2026-11-07 v0.1 written at M0.
- M4a balance: `W-AI-2` retuned (war chance, army size, truce rate, surrender demand, mission choice), new `W-AI-5` and `W-AI-6`; `W-WAR-5` capture 20% -> 10%, rulers with another city retreat instead of being captured. Further AI entries follow in `13-balance.md`.
