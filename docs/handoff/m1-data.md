# M1 data handoff

Branch `m1-data`, four commits. Gates: `npm run typecheck`, `npm test` (15 tests), `npm run validate:data` all pass.

## What shipped
- **Cities:** 48 (all 13 provinces), real lat/lon of the ancient seat (modern site), x/y by the 12-data §4 projection; `hedong` and `xinye` nudged. **Roads:** 73, connected, no duplicates, days 5-25 from distance (see ruling 2).
- **Officers:** 195 in `officers.json` (161 start in 190, 34 appear 191-200; 37 hidden, all wanderers in their city). 34 have portraits (every sibling-game portrait that matches an id, copied to `public/portraits/`); `generic-portraits.json` lists the other 89 non-officer portraits (captain-*, bowang-*, bp-*, dz-*, gz-*, hulao-*, pc-*, pg-*, qz-*, vs-*, xiapi-*, xuzhou-*, changban-*, red-cliffs-*, generic-*, taiping-adept), also copied. The sibling game's cheng-yuanzhi, deng-mao, gong-jing, zhang-bao, zhang-liang are historical but dead by 190 or outside our cast, so they are neither copied nor generic.
- **Scenario 190:** 23 factions (Dong Zhuo with Luoyang, Chang'an, Hongnong, Hedong; Han Fu at Ye; Yuan Shao at Nanpi; Cao Cao at Chenliu; Yuan Shu at Wan and Xinye; Sun Jian at Changsha; Liu Biao at Xiangyang, Jiangling, Jiangxia; Gongsun Zan at Beiping and Pingyuan; Liu Yu at Ji; Gongsun Du; Kong Rong; Liu Dai at Puyang; Tao Qian at Xiapi and Langya; Kong Zhou at Xuchang; Chen Wen at Shouchun; Wang Lang at Kuaiji; Yan Baihu at Wu; Shi Xie at Jiaozhi; Liu Yan at Chengdu, Zitong, Jiangzhou; Zhang Lu at Hanzhong; Ma Teng at Wuwei; Han Sui at Anding; Zhang Yang at Shangdang), 15 vacant cities with militia, 11-member coalition (relation 60 pairwise), Dong Zhuo hostile (5-12), oath groups [Liu Bei, Guan Yu, Zhang Fei] and [Ma Teng, Han Sui], 60 friendships, 8 rival pairs, kin mirrored automatically.
- **Events:** 17 (the 15 of 40-events §2 with exact ids, plus `liu-zhang-succeeds` and `sun-ce-assassinated`). Option 0 equals the historical `effects` (the validator enforces it).
- **Tools:** `tools/data/{world,officers-a,officers-b,officers-c,scenario,events}.ts` are the source tables; `npx tsx tools/data/build.ts` regenerates every JSON file and copies portraits. `tools/data/checks.ts` holds the checks; `tools/validate-data.ts` and `tests/unit/data.test.ts` both run them. **Edit the tables, not the JSON.**
- Extra validator checks beyond 12-data §6: kin mirrored, one ruler per faction, officers of a faction stand in its cities, one prefect per city, hidden officers are faction-less wanderers, monthly gold covers the salary roll per faction, rice covers 9 months of upkeep, option 0 equals `effects`, portrait files exist, basis has a line for every stat >= 85 or <= 30.

## Sources
**No web research was done** (no WebFetch was used in this run, so `docs/sources/` is empty). Every date, lat/lon, post and relation is written from the model's knowledge of the Romance of the Three Kingdoms, the Sanguozhi, Hou Hanshu and the English Wikipedia articles cited per row in `source`. Treat all lat/lon as +-0.1 degree and every `estimate: true` year as unverified. A later pass with web access should spot-check the cities (lat/lon), the 190 positions marked "record dates 191" and the estimated birth years. Stats follow the rubric by our own judgement; the 36 officers also in three-kingdoms-tactics keep that game's war/int/lead(ldr)/cha, POL added by us.

## Rulings
RULING: city count | 48 cities, not about 40 | all 13 provinces needed several seats each for the Jing south, Yang and Yi | open
RULING: road days | `days = round(haversine * 1.3 / 30)`, x1.5 on mountain, clamped 5..25 | 12-data §5 gives only "about 1 day per 30 km"; 1.3 is a detour factor we chose | open
RULING: nudging | hedong and xinye are nudged by an automatic pass in `world.ts` (the lighter city moves to 26 units away), not by hand | 12-data §4 says by hand; same result, reproducible | open
RULING: Shangyong province | Yi (Hanzhong commandery until 219) | the commandery named Shangyong did not exist in 190 | open
RULING: Hedong | counted as Sili, seat Anyi (Xia county) | Hedong was a Sili commandery; gives Dong Zhuo's Niu Fu and Jia Xu a base | open
RULING: Liu Bei in 190 | prefect of Pingyuan under Gongsun Zan, with Guan Yu, Zhang Fei and Jian Yong; Pingyuan belongs to Gongsun Zan's faction | the record has Liu Bei with Gongsun Zan and magistrate of Pingyuan from about 191, and the novel places him at the coalition beside Gongsun Zan | open
RULING: Zhang Lu | ruler of a faction at Hanzhong at the start | record dates his rule of Hanzhong to 191 (after Su Gu); starting there gives the Way of the Five Pecks a faction | open
RULING: Cao Cao's base | Cao Cao holds Chenliu; his friend Zhang Miao, who was governor there, is an officer of his faction | the map has no second city for him in 190; Zhang Miao breaks with him only in 194 | open
RULING: Wang Kuang | placed with Yuan Shao at Nanpi | Henei has no city on our map | open
RULING: Sun family | Sun Ce (191), Sun Quan (198) appear at Changsha in faction f-sun-jian; Zhou Yu appears 191 as a wanderer at Lujiang; Lady Wu and Wu Jing start at Changsha | Changsha is the only city of the faction; the record has the family in Shu/Lujiang and then with Yuan Shu | open
RULING: Han Fu's staff | Ju Shou, Tian Feng, Shen Pei, Guo Tu, Xin Ping, Xin Pi, Zhang He, Wen Chou, Yan Liang, Bao Xin, Yu Jin and Xun Yu start with Han Fu at Ye and move to Yuan Shao in `ji-province` (except Xun Yu, who stays Han Fu's and becomes a wanderer when Ye falls? no: see open item below) | the record has Ji's officers serving Han Fu then Yuan Shao in 191; Wen Chou and Yan Liang are novel figures placed with Ji's governor | open
RULING: Xun Yu | starts with Han Fu but is NOT in the `ji-province` joinFaction list | he left for Cao Cao in 191 (record); the engine will leave him a wanderer when Han Fu's faction is destroyed | open
RULING: Yuan Shu's Nanyang | Wan and Xinye; Sun Jian is a separate faction rather than Yuan Shu's officer | Sun Jian governed Changsha and acted for Yuan Shu only nominally | open
RULING: single-officer factions | Gongsun Du, Kong Rong, Kong Zhou, Chen Wen, Yan Baihu have no officers beside the ruler (a few more have 1-2) | the record names no staff; hidden/wandering officers sit in or near their cities (Taishi Ci at Beihai, Yu Fan at Kuaiji, Zhang Zhao at Xiapi) so players can recruit them | open
RULING: vacant cities | runan, xiaopei, lujiang, jianye, yuzhang, chaisang, wuling, lingling, guiyang, shangyong, yongan, jianning, tianshui, jinyang, nanhai have no owner (militia 1,000-3,000) | no warlord of the period held them as a seat; Wuling/Lingling/Guiyang governors (Jin Xuan, Liu Du, Zhao Fan) are left out as they matter only from 208 | open
RULING: hidden officers | every `hidden` officer is a faction-less wanderer (`post: wanderer`); the generator forces this | W-ACT-SEARCH turns them into wanderers; the type allows a faction, the validator does not | open
RULING: faction colours | 14 pigments assigned greedily so factions on neighbouring cities differ; distant factions share | 23 factions, 14 colours | open
RULING: merit, loyalty, gold | generated: merit by stat sum (300-3,200; prefects >= 1,200; rulers 12,000), loyalty 65 +- temperament plus a hash jitter (100 for oath/kin of the ruler), gold by rank. A tuning pass raises trade/order, then lowers merit, until each faction's monthly gold >= 1.15x its salary roll | spec asks that gold cover salaries; no source gives a 190 merit | open
RULING: city numbers | farm/trade/walls are 60-85% of max for owned cities and 35-55% for vacant; population is (farmMax*220 + tradeMax*80)*0.85-0.97; rice is 12 months of upkeep plus 6x farm | spec leaves starting numbers to us | open
RULING: stats kept from the sibling game | e.g. Lu Bu war 100, Zhuge Liang int 100, Guan Yu war 97; lead -> ldr; pol is ours | 12-data §3 | open
RULING: Liu Xie | Emperor Xian appears 197 (age 16) as an officer of the Dong Zhuo/Li Jue faction at Chang'an, else a wanderer | the rules have no emperor; he is the same age as the cast of 197 | open
RULING: marriages | no spouse links beyond Sun Jian-Lady Wu and Cao Cao-Lady Bian (Zhou Yu-Xiao Qiao, Yuan Xi-Zhen Luo left out) | those marriages come in 197-200; no event in the slate marries them | open
RULING: officer disambiguation | no id collisions arose; `li-yan` is the Nanyang official (Zhengfang) who later served Shu/Wei, not Li Yan of Jiangzhou; `zhang-yan` (Heishan bandit) vs `zhang-yang` (Shangdang governor) differ by one letter; `liu-yan`, `liu-yu`, `liu-biao` unambiguous | ids are surname-given kebab-case | open
RULING: born years of late-listed men | Wei Yan, Meng Huo, Mi Fang, Xu Sheng, Pan Zhang, Li Yan and Jiang Ji are given born 172 (estimate) so they exist in 190 | the record gives no birth year | open
RULING: fictional people | Diao Chan (Romance ch.8) and Meng Huo (Romance ch.87, Huayang Guo Zhi) are included; Zhou Cang and Pei Yuanshao come from Romance ch.28 | 12-data §2 | open

## Notes for the engine and presentation agents (open questions, not contract changes)
- **Contest placeholders.** `hulao-gate`, `burning-of-luoyang` and `fall-of-xiapi` options carry `contest.a` as the historical default officer (`guan-yu`, `yang-biao`, `lu-bu`). When the player is another officer in `involves`, the engine should replace `a` (and the same id inside `onWin`/`onLoss`) with the player's officer.
- **Coalition refusal.** `coalition-forms` option 1 allies only Yuan Shao, Yuan Shu, Han Fu, Cao Cao, Sun Jian and Kong Rong, and sets `coalition-refused`; the engine should drop the player's faction from the alliance list of option 0 or 1.
- **Effect order.** Events assume effects run in listed order (`tao-qian-offers-xu`: join, setRuler, kill; `ji-province`: transferCity before makeWanderer; `chain-stratagem`: kill then setRuler to Wang Yun so succession is overridden).
- **Items as flags.** `imperial-seal` sets both an `item` effect and a flag; `sun-ce-borrows` needs flag `imperial-seal` and not `seal-with-yuan-shao`, and `yuan-shu-emperor` needs `seal-with-yuan-shu`. If Sun Jian hands the seal to Yuan Shao, Sun Ce never pawns it and Yuan Shu never crowns himself (Yuan Shao holds it).
- **Fall of Xiapi adjacency.** The "Cao Cao's city next to Lu Bu's" condition is approximated by `factionHoldsCity f-cao-cao xuchang` plus flag `emperor-cao`.
- **`letter{}` effect** from 40-events §E-3 is not in the frozen `EventEffect` type, so no event uses it; `peach-garden-reunion` is `major: true` instead.
- **Appearance city.** `appearances` put officers in cities that may not belong to their faction (Sun Quan at Changsha in 198, Emperor Xian at Chang'an in 197); the engine should place them there and treat a faction mismatch as a wanderer.
- **Event dates.** Windows are in the table's order; events are data-ordered so `coalition-forms` runs before `hulao-gate` in 190-1.

## Left undone
- No web verification (see Sources). No `docs/sources/` dumps.
- No spouse data for Zhou Yu/Xiao Qiao, Sun Ce/Da Qiao, Yuan Xi/Zhen Luo.
- Zhang Fei's, Zhao Yun's and a few others' basis lines are short; the 180+ stat <= 30 lines for civilians are generated from templates (`build.ts` TAGS) where the row has none.
- Henei, Guangling, Donghai, Dai and Yuyang have no city; their governors (Wang Kuang, Zhang Chao, and others) are placed with the nearest faction.
- Portraits: 34 sibling-game portraits matched; the other 161 officers use the medallion.
