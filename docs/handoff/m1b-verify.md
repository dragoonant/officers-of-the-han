# M1b data verification handoff

Branch `m1b-verify` (from `m1-data`). Gates after the last commit: `npx tsx tools/data/build.ts`, `npm run typecheck`, `npm test` (15 tests), `npm run validate:data` all pass.

## Method and sources actually read
- Wikipedia raw wikitext (en), saved under gitignored `docs/sources/`: the 26 `List of people of the Three Kingdoms (A..Z)` tables (I, U, V are empty stubs), 191 biography pages in `docs/sources/bio/`, and `Campaign against Dong Zhuo`, `Sun Jian`, `Two Qiaos`, `Lady Zhen`, `Battle of Yangcheng`, `Way of the Celestial Masters`, `Hanzhong Commandery` and 47 city/county articles (`docs/sources/cities/`).
- Repeatable scripts in `tools/data/verify/`: `fetch-bios.ts` (downloads each officer's article, follows redirects, has a title override table for namesakes; `chen-wen`, `cheng-yin`, `huang-wan`, `yang-hong`, `zhang-xun`, `zhang-chao`, `zhang-wei` have no article of their own and are skipped), `fetch-pages.sh`, `parse-lists.ts`, `compare-dates.ts`, `compare-courtesy.ts`, `verify-cities.ts`. Run in that order with network access; re-run `npx tsx tools/data/build.ts` after editing the tables.
- Not read: Sanguozhi, Hou Hanshu and Zizhi Tongjian themselves (no copies reachable); statements attributed to them come through the Wikipedia articles' citations only.
- Two namesake pitfalls found and fixed in the process: the first fetch of `lu-xun` returned the writer Lu Xun, `liu-xie` the critic Liu Xie (Emperor Xian is under `Emperor Xian of Han`), `zhang-xun` the 1854 general, `zhang-chao` a Qing writer. None of those pages is cited.

## Counts
- Officers checked: 195 (dates, courtesy name, source; 190 seat for every faction ruler and every officer whose article speaks of 189-191).
- Officers changed: 56 in dates/courtesy/estimate/kin (list below), 9 in 190 position, 195 in `source` (a `Wikipedia: <article>` citation appended to every row).
- Cities: 48 checked, 7 coordinates moved, 1 left unverified. Events: 17 checked, 2 windows moved, ji-province join list shortened.

## Changes (id, field, old -> new, source)
Source for every row is the officer's Wikipedia article (infobox/lead) or, where marked (L), the `List of people of the Three Kingdoms` table.
- hua-xiong died 190 -> 191 (Hua Xiong article: killed by Sun Jian at Yangren, April 191; the novel's Hulao kill stays in the event)
- gao-shun died 198 -> 199 (Lu Bu article: executed with Lu Bu 7 Feb 199; list says 198, the Chinese year)
- cai-yong born 133 -> 132; ma-midi born 143 -> 140 and courtesy Wensheng -> Wengshu (L); bao-xin born 151 -> 152
- han-fu died 191 -> 192 (Han Fu article citing Sima Biao); xin-ping died 205 -> 204; xin-pi died 224 -> 235
- zhang-yan died 206 -> 205 (article gives "180s-205", death year unknown, still `estimate`); gao-gan born 173 -> 168 (L, still estimate)
- li-dian born 174 -> 180, died 209 -> 217, courtesy Manchang -> Mancheng, now `estimate` (article: c.180 to c.217), so he is a child in 190 and appears at 196 with Cao Cao
- lady-bian born 161 -> 159, now `estimate` (article: 159 or 161)
- han-dang died 226 -> 227; zhou-tai died 220 -> 223; chen-qun died 236 -> 237 (7 Feb 237); zhu-zhi courtesy Jun'ai -> Junli
- liu-yan born 140 -> 132 (L, estimate); liu-zhang now `estimate` (article: birth unknown, death c.220; we keep 219 per list); zhang-lu born 165 -> 163 (L, estimate)
- zhang-wei born 170 -> 172, no longer estimate (L); yan-pu born 165 -> 163, died null -> 231, no longer estimate (L: Yan Pu); ma-teng now `estimate` (birth unrecorded; died 212 kept, list says 211)
- yan-gang died 191 -> 192 (L); lu-zhi born 139 -> 140, now `estimate` (article "before late 140s?"); gongsun-kang born 180 -> 172, died 221 -> 210 (L; article: died between 209 and Dec 220)
- qiao-mao died 191 -> 190 and courtesy Gongxu -> Yuanwei; kong-zhou died 191 -> 190 (article: c.190); mi-fang died 220 -> 223; cao-bao died 195 -> 196; zang-ba born 165 -> 162
- chen-wu born 178 -> 177, courtesy Wenxiao -> Zilie; zhu-huan died 249 -> 238 (the old row had Zhu Ran's year), courtesy Xiuyu -> Xiumu; zhu-ran died 248 -> 249; xiang-lang born 170 -> 165, courtesy Wenlin -> Juda; liang-xing died 211 -> 212 (L)
- jiang-ji born 172 -> 188, courtesy Ziyi -> Zitong (L), no longer estimate; moved from a hidden wanderer at Shouchun in 190 to an appearance at 204
- yuan-shao, yuan-shu, wang-ling: `estimate` removed (article gives birth and death years); wang-ling courtesy Wenshu -> Yanyun
- huang-zhong, cao-chun, kong-rong: `estimate` added (birth year unrecorded, or 151/153)
- courtesy only: huang-wan Zichun -> Ziyan, yuan-tan Xianxi -> Xiansi, sun-jing Yitai -> Youtai, sima-hui Dezao -> Decao, zhang-song Yongnian -> Ziqiao, yang-fu Yizhou -> Yishan, zhang-yang Zhizhong -> Zhishu, feng-ji Yuanpi -> Yuantu; added li-ru Wenyou, li-jue Zhiran, dong-min Shuying, chunyu-qiong Zhongjian, chen-wen Yuanti, sun-ben Boyang
- 190 seats: wen-chou, yan-liang, tian-feng Han Fu/Ye -> Yuan Shao/Nanpi; bao-xin, yu-jin Han Fu/Ye -> Cao Cao/Chenliu; dong-zhao Zhang Yang/Shangdang -> Yuan Shao/Nanpi; zhao-yun wanderer at Nanpi -> wanderer at Beiping; li-dian and jiang-ji start -> appearance (see above)
- kin added: yuan-shao <-> yuan-shu (half-brothers, Yuan Shu article), zhang-lu <-> zhang-wei (younger brother, Zhang Lu article)
- events: `fall-of-xiapi` window 198-6..199-3 -> 198-10..199-2 (Lu Bu died 7 Feb 199); `sun-ce-assassinated` 200-4..200-12 -> 200-4..200-5 (Sun Ce died 5 May 200); `ji-province` join lists no longer name tian-feng, wen-chou, yan-liang, bao-xin, yu-jin (they no longer start with Han Fu)
- cities (lat, lon): luoyang 34.72,112.60 -> 34.62,112.45; ye 36.33,114.55 -> 36.33,114.62; beihai 36.71,118.83 -> 36.70,118.75; xiapi 34.33,117.95 -> 34.40,117.89; langya 35.05,118.35 -> 35.10,118.36; lujiang 31.46,117.00 -> 31.46,116.95; kuaiji 30.00,120.58 -> 30.05,120.58 (each now matches the article of the modern place to 0.05 degree or better). Re-projection by 12-data section 4 followed from the rebuild; the automatic nudge pass now moves hedong, puyang (new) and xinye, and no two dots are closer than 25 units. Every city `source` now ends with "lat/lon checked against Wikipedia: <article>".

Confirmed unchanged (article agrees): about 90 officers' years, including all of Zhuge Liang, Zhou Yu, Sun Ce, Sun Jian, Liu Bei, Ma Chao, Lu Su, Guo Jia, Xun Yu, Xun You, Zhong Yao, Jia Xu, Tao Qian, Kong Rong, Shi Xie, Zheng Xuan, Liu Biao, Wang Yun, Zhang Liao, Sun Quan, Cao Cao.

## Rulings
RULING: Liu Bei in 190 | prefect of Pingyuan under Gongsun Zan with Guan Yu, Zhang Fei, Jian Yong | Wikipedia (Liu Bei): joined the campaign against Dong Zhuo in 190, then went to Gongsun Zan (service 189-194); Gongsun Zan made him Pingyuan chancellor in 191, so the Pingyuan post is a year early and is kept as a simplification | confirmed
RULING: Gongsun Zan as a faction | stays an independent faction at Beiping | Wikipedia (Gongsun Zan) has him nominally under Governor Liu Yu of You until 191 while holding 10,000 men at Youbeiping; our Liu Yu faction at Ji is separate | confirmed
RULING: Zhang Lu | ruler of Hanzhong at the start | English Wikipedia (Zhang Lu, Liu Yan) says Liu Yan sent him against Su Gu and he held Hanzhong afterwards but gives no year; the 191 in the previous notes could not be re-found | confirmed (date unverified, see unresolved)
RULING: Han Fu's staff | Ju Shou, Shen Pei, Guo Tu, Xin Ping, Xin Pi, Zhang He, Xun Yu start with Han Fu at Ye | Wikipedia: Ju Shou, Shen Pei, Guo Tu, Xin Ping and Zhang He began under Han Fu and went to Yuan Shao in 191 (Xun Yu's article says he first served Yuan Shao, the Sanguozhi gloss has Han Fu receive him; kept with Han Fu); Xin Pi's article names only Yuan Shao, kept with his brother | confirmed
RULING: Tian Feng, Wen Chou, Yan Liang | start with Han Fu | Wikipedia: Yuan Shao recruited Tian Feng around 190; Wen Chou and Yan Liang are Yuan Shao's generals in the record and Romance ch.5 | changed (now Yuan Shao at Nanpi)
RULING: Bao Xin and Yu Jin | start with Han Fu | Wikipedia (Bao Xin): in early 190 he joined the coalition with his own troops and allied with Cao Cao; Yu Jin served Bao Xin until 192 | changed (now Cao Cao at Chenliu)
RULING: Dong Zhao | starts with Zhang Yang | Wikipedia (Dong Zhao): served Yuan Shao first, then fled to Zhang Yang | changed (now Yuan Shao at Nanpi); Zhang Yang's faction now has only its ruler
RULING: Xun Yu | leaves for Cao Cao in 191, not in the ji-province list | Wikipedia (Xun Yu): went to Cao Cao in 191 | confirmed
RULING: Zhang Yang | ruler at Shangdang | Wikipedia (Zhang Yang): held Shangdang by 190 and joined Yuan Shao at Henei; Dong Zhuo made him Henei administrator only after that | confirmed
RULING: Zhao Yun | hidden wanderer near Ji province | Wikipedia (Zhao Yun): joined Gongsun Zan in 191, nothing for 190; place him where the record next puts him | changed (visible wanderer at Beiping)
RULING: Sun family (Lady Wu, Wu Jing, Sun Ce, Sun Quan) at Changsha | kept | Wikipedia (Zhou Yu, Sun Ce) puts Sun Jian's family at Shouchun and then Shu in Lujiang in 190-191 and Sun Ce at Qu'e and Danyang afterwards, so Changsha is wrong historically, but the sun-jian-falls event needs the heirs in the faction and the map has no other Sun city | confirmed (as a modelling choice only)
RULING: Sun Jian's death | window 191-6..192-6 | Wikipedia (Sun Jian) says 191 (Xianshan, ambushed by Huang Zu), with "191?" in the lead; some sources say 192 | confirmed
RULING: Li Dian | appears at 196 | Wikipedia gives c.180, so in 190 he is about ten | changed
RULING: Kuai Liang and Kuai Yue as brothers | kept | Wikipedia (Kuai Liang) notes only the novel makes them brothers; the record does not state their relationship | confirmed (novel)
RULING: marriages | no new spouse links | Wikipedia: Yuan Xi-Lady Zhen "in the middle of Jian'an" (196-220), Zhou Yu-Xiao Qiao and Sun Ce-Da Qiao after the fall of Wan in the late 190s, Liu Bei's wives are not in the cast; kin is not date-gated, so a link would exist from 190 | confirmed (Sun Jian-Lady Wu and Cao Cao-Lady Bian were married long before 190 and stay)
RULING: Guan Ping | child of Guan Yu | Wikipedia (Guan Ping): adopted son and nephew of Guan Yu | confirmed
RULING: Wei Yan, Huang Zhong, Wen Pin, Cai Mao with Liu Biao in 190 | kept | Wikipedia: Wen Ping served Liu Biao at Xiangyang before 208; Huang Zhong and Wei Yan are first dated under Liu Biao / Liu Bei in 200-208, nothing for 190 | confirmed (record silent)
RULING: other previous rulings (city count, road days, nudging, Shangyong, Hedong, Cao Cao's base, Wang Kuang, Xun Yu, Yuan Shu's Nanyang, single-officer factions, vacant cities, hidden officers, colours, merit, city numbers, stats, Liu Xie, officer ids, fictional people) | untouched | they are design decisions, not facts | confirmed
RULING: city coordinates | the Wikipedia article of the modern place sets lat/lon to 0.01 whenever ours differed by more than 0.05; Luoyang therefore uses the city article, not the Han-Wei ruins 15 km east | one rule, and the 0.15 degree shift is under five map units | changed
RULING: Li Yan (Nanyang) | one person | Wikipedia: Li Yan, courtesy Zhengfang, of Nanyang, served Liu Biao, Liu Zhang and Shu Han, died 234; the previous note that he was a different man from "Li Yan of Jiangzhou" is wrong | changed (note only)

## Unresolved
- Zhang Lu's year of taking Hanzhong (English Wikipedia is silent; the old note said 191).
- Lingling: the district article has no coordinates and the Yongzhou city article (26.42, 111.61) is the prefecture centre 0.19 degree north of the old Lingling seat; ours (26.23, 111.61) is kept unverified.
- Tao Qian died 194 or 195 (Wikipedia); `tao-qian-offers-xu` stays 194-1..194-12. `emperor-to-xu` and `yuan-shu-emperor` stay year-wide (the articles fetched give only the year).
- Birth years still estimated with no source: about 120 officers (every row still flagged `estimate`). Disagreements kept as estimates: Lady Bian (159/161), Kong Rong (151/153), Cai Yan (170/178), Gongsun Du (150 article, 154 list), Cui Yan (160 article, 163 list), Liu Zhang's death (219 list, c.220 article), Gongsun Kang's death, Sima Hui (173 ours, 147 list).
- Courtesy names not found in any fetched page: ju-shou (Gongyu), bao-xin (Yuanjie), zu-mao (Zihui), huang-zu (Jigen); Yan Xiang (Yuan Shu's adviser) may be Yan Xiang of the 163-200 article or a different man, so his dates stay estimates; Shi Yi (Shi Xie's brother) has no article.
- Dong Min, Xin Pi and others keep estimated birth years; stats were not touched.
- Officers in other seats whose 190 post is only "record silent" (Sun Qian, Zou Jing, Chen Deng, Zhang Chao, Wei Yan and similar) were not individually reviewed.
- Cai Mao's lead reads "190-208" and Cheng Pu's "170-210" (floruit ranges, not births); ours stay.
