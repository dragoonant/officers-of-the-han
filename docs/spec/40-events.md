# 40 — Historical events (v0.1)

Events are data (`src/data/events.json`, typed by `src/contracts/data.ts` `EventDef`). The world checks them at month end (`W-EVT-1`). Every event's text is written in our own words; the novel is the source of the story, not of the prose.

## 1. Rules
- `[E-1]` An event has an id, a title, a window `from`/`to` (year and month), **conditions** (all must hold), a monthly **chance** while its window is open and its conditions hold (100 = as soon as possible), **effects**, and an optional **choice** for the player.
- `[E-2]` Condition kinds: `officerAlive{id}`, `officerDead{id}`, `officerInFaction{id, faction}`, `officerIsRuler{id}`, `factionExists{id}`, `factionHoldsCity{faction, city}`, `flag{id}`, `notFlag{id}`, `date{from?, to?}`, `relationBelow{a, b, value}`.
- `[E-3]` Effect kinds: `setFlag{id}`, `moveOfficer{id, city}`, `joinFaction{id, faction, post?}`, `makeWanderer{id, city?}`, `killOfficer{id}`, `transferCity{city, faction}`, `moveCapital{faction, city}`, `setRuler{faction, id}`, `alliance{factions[], months}`, `endAlliance{factions[]}`, `relation{a, b, delta}`, `cityDelta{city, field, delta}`, `friendship{a, b, delta}`, `oath{ids[]}`, `marry{a, b}`, `item{officer, item}` (v0.1: items are flags such as `imperial-seal`), `letter{}` (always: the event's own text goes to the player).
- `[E-4]` **Player choice:** when an event lists `involves` and the player's officer is one of them (or the player's officer is the ruler of a faction listed in `involvesFaction`), the player gets a pending `eventChoice` with 2–3 options; each option has its own effects. Option 0 is the historical course and is what the AI always takes. An option may be marked `duel{a, b}` or `debate{a, b}`: the contest is played, and the option's `onWin`/`onLoss` effects apply.
- `[E-5]` An event whose referenced officers or factions no longer fit (for example someone already died) simply never fires. Alternate history is allowed to run on.
- `[E-6]` A **killOfficer** on a ruler triggers succession (`W-DEATH-3`); on the player's officer it triggers `W-DEATH-2`.

## 2. The 190–200 slate (first playable: at least 14)
The data agent writes these from the novel (chapters noted) and the record, with the conditions and effects needed to make them work on our map. Ids are fixed here so tests and later content can name them.

| Id | When (window) | What happens (historical course = option 0) | Player choice when involved |
|---|---|---|---|
| `coalition-forms` | 190-1 | The eastern lords swear the coalition against Dong Zhuo (ch. 5): an alliance among the coalition factions for 12 months; flag `coalition`. | A coalition ruler may refuse to join |
| `hulao-gate` | 190-1..190-4 | Lü Bu holds the pass; the three brothers fight him (ch. 5). Liu Bei's, Guan Yu's and Zhang Fei's friendship with each other +5; Liu Bei's renown (merit) +500. | If the player is one of the three, or any coalition officer with WAR 80+: duel Lü Bu |
| `burning-of-luoyang` | 190-2..190-6 | Dong Zhuo moves the capital to Chang'an and burns Luoyang (ch. 6): his capital moves; Luoyang loses most population, farm and trade, and (M4b) 20,000 of its troops march west with the court to Chang'an. | A Dong Zhuo officer may oppose it (debate Dong Zhuo) |
| `imperial-seal` | 190-3..191-6 | Sun Jian finds the imperial seal in a well at Luoyang (ch. 6): item `imperial-seal` to Sun Jian; relation Sun Jian–Yuan Shao −20. | If the player is Sun Jian: keep it or hand it to Yuan Shao |
| `coalition-breaks` | 190-6..191-3, needs `coalition` | The coalition falls apart (ch. 6): ends the alliance; flag `coalition-ended`. | |
| `ji-province` | 191-1..191-12 | Han Fu yields Ji province to Yuan Shao (ch. 7): Ye passes to Yuan Shao; Han Fu becomes a wanderer. | If the player is Han Fu: yield or resist |
| `sun-jian-falls` | 191-6..192-6 | Sun Jian dies at Xian Mountain fighting Liu Biao's Huang Zu (ch. 7): Sun Jian dies; Sun Ce succeeds. | If the player is Sun Jian: heed the warning and live |
| `chain-stratagem` | 192-1..192-6 | Wang Yun's plot with Diaochan (chs. 8–9): Lü Bu kills Dong Zhuo; Lü Bu becomes a wanderer leader. | If the player is Lü Bu or Diaochan: go along or refuse |
| `li-guo-seize` | after `chain-stratagem`, 192-4..192-12 | Li Jue and Guo Si take Chang'an (ch. 9): Dong Zhuo's faction passes to Li Jue; Wang Yun dies. | |
| `tao-qian-offers-xu` | 194-1..194-12 | The dying Tao Qian gives Xu province to Liu Bei (ch. 12): Tao Qian dies; Xiapi passes to Liu Bei's faction (or Liu Bei founds one there). | If the player is Liu Bei: accept or decline |
| `sun-ce-borrows` | 194-6..195-12 | Sun Ce trades the seal to Yuan Shu for troops and sets out east (ch. 15). | If the player is Sun Ce |
| `emperor-to-xu` | 196-1..196-12 | Cao Cao receives the emperor and moves him to Xuchang (ch. 14): flag `emperor-cao`; Cao Cao's faction +relation with all. | |
| `yuan-shu-emperor` | 197-1..197-12, needs `imperial-seal` on Yuan Shu's side | Yuan Shu declares himself emperor (ch. 17): every other faction's relation with him −30. | |
| `fall-of-xiapi` | 198-6..199-3 | Lü Bu falls at Xiapi (ch. 19): if Cao Cao's faction holds a city next to Lü Bu's, Lü Bu dies. | If the player is Lü Bu: a last duel |
| `peach-garden-reunion` | 190-1, once | Start-of-game letter for players who chose one of the three brothers: their oath (they start sworn). | |

More events may be added by the data agent from chs. 5–30 if they are cheap to express in the effect kinds above.

## Change log
- 2026-11-07 v0.1 written at M0.
