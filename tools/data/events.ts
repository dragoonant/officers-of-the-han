// Generator source: the historical event slate (docs/spec/40-events.md). Text is our own wording.
import type { EventCond, EventDef, EventEffect, EventOption } from '../../src/contracts/data'
import { COALITION_IDS, FACTION_ROWS } from './scenario'

const ym = (year: number, month: number) => ({ year, month })
const alive = (id: string): EventCond => ({ kind: 'officerAlive', id })
const flag = (id: string): EventCond => ({ kind: 'flag', id })
const noFlag = (id: string): EventCond => ({ kind: 'notFlag', id })
const exists = (id: string): EventCond => ({ kind: 'factionExists', id })
const setFlag = (id: string): EventEffect => ({ kind: 'setFlag', id })
const rel = (a: string, b: string, delta: number): EventEffect => ({ kind: 'relation', a, b, delta })
const fr = (a: string, b: string, delta: number): EventEffect => ({ kind: 'friendship', a, b, delta })
const opt = (label: string, text: string, effects: EventEffect[], contest?: EventOption['contest']): EventOption => {
  const o: EventOption = { label, text, effects }
  if (contest) o.contest = contest
  return o
}
const ALL_FACTIONS = FACTION_ROWS.map((r) => r[1])

// ---- shared effect lists ----
const burnEffects: EventEffect[] = [
  { kind: 'moveCapital', faction: 'f-dong-zhuo', city: 'chang-an' },
  { kind: 'moveOfficer', id: 'dong-zhuo', city: 'chang-an' },
  { kind: 'cityDelta', city: 'luoyang', field: 'population', delta: -200000 },
  { kind: 'cityDelta', city: 'luoyang', field: 'farm', delta: -450 },
  { kind: 'cityDelta', city: 'luoyang', field: 'trade', delta: -650 },
  { kind: 'cityDelta', city: 'luoyang', field: 'walls', delta: -300 },
  { kind: 'cityDelta', city: 'luoyang', field: 'order', delta: -40 },
  { kind: 'cityDelta', city: 'chang-an', field: 'population', delta: 20000 },
  setFlag('luoyang-burned'),
]

export const EVENTS: EventDef[] = [
  {
    id: 'peach-garden-reunion',
    title: 'The Oath in the Peach Garden',
    from: ym(190, 1), to: ym(190, 1), chance: 100,
    conditions: [alive('liu-bei'), alive('guan-yu'), alive('zhang-fei')],
    text: 'Three men who met at a recruiting notice in a Zhuo county market once swore a brotherhood under blossoming peach trees: one house, one fate. Tonight, camped far from home in the north, they renew the vow over a plain meal. Their friendship holds as long as they live.',
    effects: [{ kind: 'oath', ids: ['liu-bei', 'guan-yu', 'zhang-fei'] }, setFlag('peach-oath')],
    involves: ['liu-bei', 'guan-yu', 'zhang-fei'],
    major: true,
    source: 'Romance ch.1',
  },
  {
    id: 'coalition-forms',
    title: 'The Lords Swear Against Dong Zhuo',
    from: ym(190, 1), to: ym(190, 1), chance: 100,
    conditions: [exists('f-yuan-shao'), exists('f-cao-cao'), alive('dong-zhuo')],
    text: 'Word goes round the east that Dong Zhuo has made himself the master of a captive court. Governors send riders to Yuan Shao at Bohai. A sacrificial ox is slain, blood is smeared on lips, and eleven banners are raised under Yuan Shao as head of the alliance. Each man brings what soldiers he has; none trusts another more than he must.',
    effects: [{ kind: 'alliance', factions: COALITION_IDS, months: 12 }, setFlag('coalition'), { kind: 'merit', id: 'yuan-shao', delta: 500 }],
    involvesFaction: COALITION_IDS,
    options: [
      opt('Swear the oath and march', 'You put your seal under the pact. For a year the allied lords will not turn on each other.',
        [{ kind: 'alliance', factions: COALITION_IDS, months: 12 }, setFlag('coalition'), { kind: 'merit', id: 'yuan-shao', delta: 500 }]),
      opt('Stay out of the pact', 'You send regrets and keep your army at home. The others swear without you, and they remember it.',
        [
          { kind: 'alliance', factions: ['f-yuan-shao', 'f-yuan-shu', 'f-han-fu', 'f-cao-cao', 'f-sun-jian', 'f-kong-rong'], months: 12 },
          setFlag('coalition'), setFlag('coalition-refused'),
        ]),
    ],
    major: true,
    source: 'Romance ch.5',
  },
  {
    id: 'hulao-gate',
    title: 'The Fight at Hulao Gate',
    from: ym(190, 1), to: ym(190, 4), chance: 100,
    conditions: [flag('coalition'), alive('lu-bu'), alive('liu-bei'), alive('guan-yu'), alive('zhang-fei')],
    text: 'Dong Zhuo has put Lu Bu on the pass at Hulao. Every general of the alliance who rides at him is driven back. Then Zhang Fei charges, Guan Yu and Liu Bei circle behind him, and for a long hour three men fight the best fighter alive until he wheels his horse and retreats. The allied camp rings with it.',
    effects: [fr('liu-bei', 'guan-yu', 5), fr('liu-bei', 'zhang-fei', 5), fr('guan-yu', 'zhang-fei', 5), { kind: 'merit', id: 'liu-bei', delta: 500 }, setFlag('hulao-fought')],
    involves: ['liu-bei', 'guan-yu', 'zhang-fei', 'sun-jian', 'gongsun-zan', 'xiahou-dun', 'xiahou-yuan', 'cao-ren', 'wen-chou', 'yan-liang', 'zhang-he', 'huang-gai'],
    options: [
      opt('Watch from the line', 'The brothers carry the day while the camp watches.',
        [fr('liu-bei', 'guan-yu', 5), fr('liu-bei', 'zhang-fei', 5), fr('guan-yu', 'zhang-fei', 5), { kind: 'merit', id: 'liu-bei', delta: 500 }, setFlag('hulao-fought')]),
      opt('Ride out against Lu Bu', 'You spur forward alone and the whole line goes quiet.',
        [setFlag('hulao-fought')],
        {
          kind: 'duel', a: 'guan-yu', b: 'lu-bu',
          onWin: [{ kind: 'merit', id: 'guan-yu', delta: 800 }, fr('guan-yu', 'liu-bei', 3), rel('f-dong-zhuo', 'f-yuan-shao', -5), setFlag('lu-bu-beaten')],
          onLoss: [{ kind: 'merit', id: 'guan-yu', delta: 100 }, setFlag('lu-bu-held')],
        }),
    ],
    source: 'Romance ch.5',
  },
  {
    id: 'burning-of-luoyang',
    title: 'The Capital Goes Up in Flames',
    from: ym(190, 2), to: ym(190, 6), chance: 60,
    conditions: [{ kind: 'factionHoldsCity', faction: 'f-dong-zhuo', city: 'luoyang' }, { kind: 'officerIsRuler', id: 'dong-zhuo' }, alive('dong-zhuo')],
    text: 'Dong Zhuo cannot hold the road to the east, so he decides not to hold the east at all. The court is marched west to Chang\'an, the rich families are driven after it, and the palaces and ancestral temples of Luoyang are fired behind them. For days the sky over the Luo plain is black.',
    effects: burnEffects,
    involves: ['yang-biao', 'huang-wan'],
    options: [
      opt('Let the court move', 'The order is carried out to the letter.', burnEffects),
      opt('Argue against the move', 'You stand up in the council and refuse to be silent.',
        [setFlag('capital-contested')],
        {
          kind: 'debate', a: 'yang-biao', b: 'dong-zhuo',
          onWin: [setFlag('capital-stays'), { kind: 'cityDelta', city: 'luoyang', field: 'order', delta: 5 }, { kind: 'merit', id: 'yang-biao', delta: 300 }],
          onLoss: [...burnEffects, fr('yang-biao', 'dong-zhuo', -15)],
        }),
    ],
    major: true,
    source: 'Romance ch.6',
  },
  {
    id: 'imperial-seal',
    title: 'The Seal in the Well',
    from: ym(190, 3), to: ym(191, 6), chance: 50,
    conditions: [alive('sun-jian'), flag('luoyang-burned'), noFlag('imperial-seal')],
    text: 'Sun Jian\'s soldiers clear the ruined palace grounds and fish a body from a well. About its neck hangs a box wrapped in red silk: the jade seal of the empire. His advisers urge him to slip away with it before the others learn. A secret kept among a thousand men is not kept for long.',
    effects: [{ kind: 'item', officer: 'sun-jian', item: 'imperial-seal' }, setFlag('imperial-seal'), rel('f-sun-jian', 'f-yuan-shao', -20)],
    involves: ['sun-jian'],
    options: [
      opt('Keep the seal and slip away', 'You tell no one and take the seal home. Yuan Shao hears of it within weeks.',
        [{ kind: 'item', officer: 'sun-jian', item: 'imperial-seal' }, setFlag('imperial-seal'), rel('f-sun-jian', 'f-yuan-shao', -20)]),
      opt('Hand it to Yuan Shao', 'You lay the box before the allied chief. He thanks you warmly, and now the coalition is his to speak for.',
        [{ kind: 'item', officer: 'yuan-shao', item: 'imperial-seal' }, setFlag('imperial-seal'), setFlag('seal-with-yuan-shao'), rel('f-sun-jian', 'f-yuan-shao', 10), { kind: 'merit', id: 'sun-jian', delta: 400 }]),
    ],
    source: 'Romance ch.6',
  },
  {
    id: 'coalition-breaks',
    title: 'The Alliance Falls Apart',
    from: ym(190, 6), to: ym(191, 3), chance: 40,
    conditions: [flag('coalition')],
    text: 'Months of feasting and no marching have drained the allied camp. Grain runs low, two lords come to blows over a ration, and the commanders drift home one by one. Cao Cao rides out alone after Dong Zhuo, is beaten at Xingyang, and returns to find nobody left to scold.',
    effects: [
      { kind: 'endAlliance', factions: COALITION_IDS }, setFlag('coalition-ended'),
      rel('f-yuan-shao', 'f-yuan-shu', -10), rel('f-yuan-shao', 'f-cao-cao', -5), rel('f-liu-dai', 'f-kong-zhou', -10),
    ],
    major: true,
    source: 'Romance ch.6',
  },
  {
    id: 'ji-province',
    title: 'Han Fu Yields Ji Province',
    from: ym(191, 1), to: ym(191, 12), chance: 40,
    conditions: [exists('f-han-fu'), exists('f-yuan-shao'), { kind: 'factionHoldsCity', faction: 'f-han-fu', city: 'ye' }, alive('han-fu'), flag('coalition-ended')],
    text: 'Han Fu has the grain and cannot decide what to do with it. Yuan Shao has the name and no land. Messengers come and go with soft words, an army on the border, and finally the plain advice of Han Fu\'s own staff. At last Han Fu signs over Ye and rides out of his own city with a few servants.',
    effects: [
      { kind: 'transferCity', city: 'ye', faction: 'f-yuan-shao' },
      { kind: 'makeWanderer', id: 'han-fu', city: 'ye' },
      ...['ju-shou', 'tian-feng', 'shen-pei', 'guo-tu', 'xin-ping', 'xin-pi', 'zhang-he', 'wen-chou', 'yan-liang', 'bao-xin', 'yu-jin'].map<EventEffect>((id) => ({ kind: 'joinFaction', id, faction: 'f-yuan-shao', post: 'officer' })),
      setFlag('yuan-shao-ji'),
    ],
    involves: ['han-fu'],
    options: [
      opt('Yield Ye to Yuan Shao', 'You sign the deed and walk out of Ye. Your staff goes over to Yuan Shao.', [
        { kind: 'transferCity', city: 'ye', faction: 'f-yuan-shao' }, { kind: 'makeWanderer', id: 'han-fu', city: 'ye' },
        ...['ju-shou', 'tian-feng', 'shen-pei', 'guo-tu', 'xin-ping', 'xin-pi', 'zhang-he', 'wen-chou', 'yan-liang', 'bao-xin', 'yu-jin'].map<EventEffect>((id) => ({ kind: 'joinFaction', id, faction: 'f-yuan-shao', post: 'officer' })),
        setFlag('yuan-shao-ji'),
      ]),
      opt('Hold Ye against him', 'You shut the gates and call the staff to the walls. Yuan Shao does not forget the insult.',
        [rel('f-han-fu', 'f-yuan-shao', -30), setFlag('ji-contested')]),
    ],
    source: 'Romance ch.7',
  },
  {
    id: 'sun-jian-falls',
    title: 'Sun Jian Dies at Xian Mountain',
    from: ym(191, 6), to: ym(192, 6), chance: 40,
    conditions: [alive('sun-jian'), alive('sun-ce'), alive('liu-biao'), exists('f-sun-jian'), exists('f-liu-biao'), { kind: 'officerIsRuler', id: 'sun-jian' }],
    text: 'Sun Jian rides out alone at dusk to follow a beaten Huang Zu into the hills south of Xiangyang. In the stony defile above Xian Mountain, archers and rolling stones are waiting. He is found there the next morning. His son Sun Ce takes the family\'s soldiers and sorrow home.',
    effects: [{ kind: 'killOfficer', id: 'sun-jian' }, { kind: 'setRuler', faction: 'f-sun-jian', id: 'sun-ce' }, rel('f-sun-jian', 'f-liu-biao', -30)],
    involves: ['sun-jian'],
    options: [
      opt('Ride on into the hills', 'The scouts were right to be afraid.',
        [{ kind: 'killOfficer', id: 'sun-jian' }, { kind: 'setRuler', faction: 'f-sun-jian', id: 'sun-ce' }, rel('f-sun-jian', 'f-liu-biao', -30)]),
      opt('Heed the warning and turn back', 'Cheng Pu\'s caution carries the day, and Huang Zu escapes. You live to fight Liu Biao again.',
        [rel('f-sun-jian', 'f-liu-biao', -10), { kind: 'merit', id: 'sun-jian', delta: 300 }, setFlag('sun-jian-lives')]),
    ],
    major: true,
    source: 'Romance ch.7',
  },
  {
    id: 'chain-stratagem',
    title: 'The Chain of Beauty and Betrayal',
    from: ym(192, 1), to: ym(192, 6), chance: 60,
    conditions: [alive('dong-zhuo'), alive('lu-bu'), alive('wang-yun'), alive('diaochan'), { kind: 'officerInFaction', id: 'lu-bu', faction: 'f-dong-zhuo' }],
    text: 'Wang Yun promises his singer to Dong Zhuo in the morning and to Lu Bu at night. Dong Zhuo takes her to his own house. Lu Bu, passing at a gate with his halberd, hears what he should not. A few days later at the palace gate, under a pretence of ceremony, Lu Bu\'s halberd does what the court could not.',
    effects: [
      { kind: 'killOfficer', id: 'dong-zhuo' }, { kind: 'setRuler', faction: 'f-dong-zhuo', id: 'wang-yun' },
      { kind: 'makeWanderer', id: 'lu-bu', city: 'chang-an' }, fr('lu-bu', 'diaochan', 30), fr('lu-bu', 'wang-yun', 15), setFlag('dong-zhuo-dead'),
    ],
    involves: ['lu-bu', 'diaochan'],
    options: [
      opt('Go along with Wang Yun', 'The halberd falls, and the tyrant with it.', [
        { kind: 'killOfficer', id: 'dong-zhuo' }, { kind: 'setRuler', faction: 'f-dong-zhuo', id: 'wang-yun' },
        { kind: 'makeWanderer', id: 'lu-bu', city: 'chang-an' }, fr('lu-bu', 'diaochan', 30), fr('lu-bu', 'wang-yun', 15), setFlag('dong-zhuo-dead'),
      ]),
      opt('Refuse the plot', 'You will not play the part Wang Yun has written. Wang Yun keeps his own counsel from you from then on.',
        [fr('lu-bu', 'wang-yun', -20), fr('lu-bu', 'dong-zhuo', 10), setFlag('chain-refused')]),
    ],
    major: true,
    source: 'Romance ch.8-9',
  },
  {
    id: 'li-guo-seize',
    title: 'Li Jue and Guo Si Take Chang\'an',
    from: ym(192, 4), to: ym(192, 12), chance: 70,
    conditions: [flag('dong-zhuo-dead'), alive('li-jue'), alive('guo-si'), alive('wang-yun')],
    text: 'With Dong Zhuo dead, Wang Yun refuses to pardon his soldiers, and the Xiliang men, afraid of the axe, decide to be feared instead. Li Jue and Guo Si march on Chang\'an with jailed men and spare horses. In eight days the gates open, Wang Yun is hanged on the wall, and Lu Bu rides out alone through the east gate.',
    effects: [
      { kind: 'setRuler', faction: 'f-dong-zhuo', id: 'li-jue' }, { kind: 'killOfficer', id: 'wang-yun' },
      { kind: 'moveOfficer', id: 'lu-bu', city: 'wan' }, setFlag('li-jue-regime'),
    ],
    major: true,
    source: 'Romance ch.9',
  },
  {
    id: 'tao-qian-offers-xu',
    title: 'Tao Qian Offers Xu Province',
    from: ym(194, 1), to: ym(194, 12), chance: 40,
    conditions: [alive('tao-qian'), alive('liu-bei'), exists('f-tao-qian')],
    text: 'Cao Cao\'s armies have burned their way through Xu, and Tao Qian is dying. He sends for Liu Bei and puts the governor\'s seals in his hands. Liu Bei says no twice, three times. The officers of Xu, down to the humblest clerk, kneel in the hall until he says yes.',
    effects: [
      { kind: 'joinFaction', id: 'liu-bei', faction: 'f-tao-qian', post: 'officer' }, { kind: 'moveOfficer', id: 'liu-bei', city: 'xiapi' },
      { kind: 'setRuler', faction: 'f-tao-qian', id: 'liu-bei' }, { kind: 'killOfficer', id: 'tao-qian' },
      ...['guan-yu', 'zhang-fei', 'jian-yong'].map<EventEffect>((id) => ({ kind: 'joinFaction', id, faction: 'f-tao-qian', post: 'officer' })),
      setFlag('liu-bei-xu'),
    ],
    involves: ['liu-bei'],
    options: [
      opt('Accept Xu Province', 'After refusing three times you take the seals. The land of Xu is yours to defend.', [
        { kind: 'joinFaction', id: 'liu-bei', faction: 'f-tao-qian', post: 'officer' }, { kind: 'moveOfficer', id: 'liu-bei', city: 'xiapi' },
        { kind: 'setRuler', faction: 'f-tao-qian', id: 'liu-bei' }, { kind: 'killOfficer', id: 'tao-qian' },
        ...['guan-yu', 'zhang-fei', 'jian-yong'].map<EventEffect>((id) => ({ kind: 'joinFaction', id, faction: 'f-tao-qian', post: 'officer' })),
        setFlag('liu-bei-xu'),
      ]),
      opt('Decline and support the old guard', 'You refuse and ask Cao Bao to hold the province. Tao Qian dies content, but Xu is divided.', [
        { kind: 'killOfficer', id: 'tao-qian' }, { kind: 'setRuler', faction: 'f-tao-qian', id: 'cao-bao' }, fr('liu-bei', 'cao-bao', 10), { kind: 'merit', id: 'liu-bei', delta: 200 },
      ]),
    ],
    major: true,
    source: 'Romance ch.12',
  },
  {
    id: 'liu-zhang-succeeds',
    title: 'Liu Yan Dies; Liu Zhang Takes Yi',
    from: ym(194, 6), to: ym(194, 12), chance: 50,
    conditions: [alive('liu-yan'), alive('liu-zhang'), { kind: 'officerIsRuler', id: 'liu-yan' }, exists('f-liu-yan')],
    text: 'A fire has taken the governor\'s hall, and sores and grief take Liu Yan. The local families who profit from a mild lord choose his youngest son, who is easy to persuade. Liu Zhang assumes the seals of Yi province in the year the old man dies.',
    effects: [{ kind: 'killOfficer', id: 'liu-yan' }, { kind: 'setRuler', faction: 'f-liu-yan', id: 'liu-zhang' }],
    source: 'Sanguozhi: Biography of Liu Yan',
  },
  {
    id: 'sun-ce-borrows',
    title: 'Sun Ce Pawns the Seal',
    from: ym(194, 6), to: ym(195, 12), chance: 40,
    conditions: [alive('sun-ce'), flag('imperial-seal'), noFlag('seal-with-yuan-shao'), exists('f-yuan-shu'), alive('yuan-shu'), { kind: 'officerIsRuler', id: 'sun-ce' }],
    text: 'Sun Ce holds his father\'s old followers but no place to put them. He takes the seal he guards to Yuan Shu and leaves it as a pledge for three thousand soldiers and five hundred horses. Then he turns his men east, to the unguarded Yangtze, and the country below the river.',
    effects: [
      { kind: 'item', officer: 'yuan-shu', item: 'imperial-seal' }, setFlag('seal-with-yuan-shu'),
      { kind: 'transferCity', city: 'jianye', faction: 'f-sun-jian' }, { kind: 'moveCapital', faction: 'f-sun-jian', city: 'jianye' },
      ...['sun-ce', 'cheng-pu', 'huang-gai', 'han-dang', 'zhu-zhi'].map<EventEffect>((id) => ({ kind: 'moveOfficer', id, city: 'jianye' })),
      rel('f-sun-jian', 'f-yuan-shu', 20),
    ],
    involves: ['sun-ce'],
    options: [
      opt('Pawn the seal for an army', 'Yuan Shu counts out the soldiers. You cross the river with your father\'s men.', [
        { kind: 'item', officer: 'yuan-shu', item: 'imperial-seal' }, setFlag('seal-with-yuan-shu'),
        { kind: 'transferCity', city: 'jianye', faction: 'f-sun-jian' }, { kind: 'moveCapital', faction: 'f-sun-jian', city: 'jianye' },
        ...['sun-ce', 'cheng-pu', 'huang-gai', 'han-dang', 'zhu-zhi'].map<EventEffect>((id) => ({ kind: 'moveOfficer', id, city: 'jianye' })),
        rel('f-sun-jian', 'f-yuan-shu', 20),
      ]),
      opt('Keep the seal and cross with what you have', 'You keep the seal and go east with only your followers. It will be a harder road.', [
        { kind: 'transferCity', city: 'jianye', faction: 'f-sun-jian' }, { kind: 'moveCapital', faction: 'f-sun-jian', city: 'jianye' },
        ...['sun-ce', 'cheng-pu', 'huang-gai', 'han-dang', 'zhu-zhi'].map<EventEffect>((id) => ({ kind: 'moveOfficer', id, city: 'jianye' })),
        setFlag('seal-with-sun'),
      ]),
    ],
    source: 'Romance ch.15',
  },
  {
    id: 'emperor-to-xu',
    title: 'The Emperor Comes to Xu',
    from: ym(196, 1), to: ym(196, 12), chance: 60,
    conditions: [alive('cao-cao'), exists('f-cao-cao'), { kind: 'officerIsRuler', id: 'cao-cao' }],
    text: 'The wandering emperor has crossed the burned country with a few servants and wild rice for food. Cao Cao meets him on the Yellow River road, lodges him at Xu, and begins to speak for him. Every governor in the empire now has to decide what to call a letter that comes with the imperial seal on it.',
    effects: [
      { kind: 'transferCity', city: 'xuchang', faction: 'f-cao-cao' }, { kind: 'moveCapital', faction: 'f-cao-cao', city: 'xuchang' },
      setFlag('emperor-cao'),
      ...ALL_FACTIONS.filter((f) => f !== 'f-cao-cao').map<EventEffect>((f) => rel('f-cao-cao', f, 8)),
    ],
    major: true,
    source: 'Romance ch.14',
  },
  {
    id: 'yuan-shu-emperor',
    title: 'Yuan Shu Takes the Throne',
    from: ym(197, 1), to: ym(197, 12), chance: 50,
    conditions: [flag('seal-with-yuan-shu'), exists('f-yuan-shu'), alive('yuan-shu'), { kind: 'officerIsRuler', id: 'yuan-shu' }],
    text: 'Yuan Shu has the seal in his chest and a prophecy about his family in his head. He calls an assembly in his hall, puts on the robes, and names a new reign. Not one of his officers who knew what that meant is willing to stand beside him. The rest of the empire remembers it for him.',
    effects: [
      setFlag('yuan-shu-emperor'),
      ...ALL_FACTIONS.filter((f) => f !== 'f-yuan-shu').map<EventEffect>((f) => rel('f-yuan-shu', f, -30)),
    ],
    major: true,
    source: 'Romance ch.17',
  },
  {
    id: 'fall-of-xiapi',
    title: 'The Fall of Xiapi',
    from: ym(198, 6), to: ym(199, 3), chance: 50,
    conditions: [alive('lu-bu'), alive('cao-cao'), flag('emperor-cao'), { kind: 'factionHoldsCity', faction: 'f-cao-cao', city: 'xuchang' }],
    text: 'Cao Cao has the Si and Yi rivers turned onto the walls of Xiapi, and the water stands to the eaves. Lu Bu\'s officers lose hope, his own sleep fails, and one night his lieutenants bind him as he lies. He pleads with Cao Cao on the tower. Liu Bei reminds Cao Cao how Lu Bu treated his masters.',
    effects: [
      { kind: 'killOfficer', id: 'lu-bu' }, { kind: 'killOfficer', id: 'gao-shun' }, { kind: 'killOfficer', id: 'chen-gong' },
      { kind: 'merit', id: 'cao-cao', delta: 800 }, setFlag('lu-bu-fell'),
    ],
    involves: ['lu-bu'],
    options: [
      opt('Be taken at Xiapi', 'The bonds hold. The end comes at the White Gate tower.', [
        { kind: 'killOfficer', id: 'lu-bu' }, { kind: 'killOfficer', id: 'gao-shun' }, { kind: 'killOfficer', id: 'chen-gong' },
        { kind: 'merit', id: 'cao-cao', delta: 800 }, setFlag('lu-bu-fell'),
      ]),
      opt('Ride out for a last duel', 'You cut your bonds and ride for the gate with halberd in hand. Guan Yu rides to meet you.', [setFlag('lu-bu-last-stand')], {
        kind: 'duel', a: 'lu-bu', b: 'guan-yu',
        onWin: [{ kind: 'makeWanderer', id: 'lu-bu', city: 'xiaopei' }, setFlag('lu-bu-escaped'), { kind: 'merit', id: 'lu-bu', delta: 400 }],
        onLoss: [{ kind: 'killOfficer', id: 'lu-bu' }, { kind: 'killOfficer', id: 'gao-shun' }, { kind: 'killOfficer', id: 'chen-gong' }, setFlag('lu-bu-fell')],
      }),
    ],
    major: true,
    source: 'Romance ch.19',
  },
  {
    id: 'sun-ce-assassinated',
    title: 'Sun Ce Falls to the Hunters',
    from: ym(200, 4), to: ym(200, 12), chance: 40,
    conditions: [alive('sun-ce'), alive('sun-quan'), { kind: 'officerIsRuler', id: 'sun-ce' }, exists('f-sun-jian')],
    text: 'Sun Ce has killed the Wu governor, Xu Gong, and the governor\'s three retainers have sworn revenge. Out hunting ahead of his guards on a fine horse, he meets them in a thicket. A poisoned arrow takes his cheek. He sends for his brother and tells him how to run the house: use the elders for the war, the new men for the plans.',
    effects: [{ kind: 'killOfficer', id: 'sun-ce' }, { kind: 'setRuler', faction: 'f-sun-jian', id: 'sun-quan' }, fr('sun-quan', 'zhou-yu', 10)],
    major: true,
    source: 'Romance ch.29',
  },
]
