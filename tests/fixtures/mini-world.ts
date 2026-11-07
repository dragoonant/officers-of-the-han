// A hand-built GameData for the world engine's tests and the sim: 6 cities, 3 factions + 1 vacant city, 22 officers.
// Contains: an oath group of 3 (Liu/Guan/Zhang, wanderers who can claim the vacant city), a married pair (Lu Bu / Diaochan),
// a parent and child (Cao Cao / Cao Pi, who comes of age in 192), a rival pair (Li Ru / Xun Yu), 2 hidden officers, 3 events.
import type { Aptitude, CityDef, EventDef, GameData, KinDef, OfficerDef, RoadDef, ScenarioDef, Temperament, TroopType } from '../../src/contracts/data'

type S5 = [number, number, number, number, number]
const apt = (pattern: string): Record<TroopType, Aptitude> => ({
  spear: pattern[0] as Aptitude,
  cavalry: pattern[1] as Aptitude,
  archer: pattern[2] as Aptitude,
})

function off(id: string, name: string, born: number, died: number | null, st: S5, t: Temperament, ap: string, kin: KinDef[] = [], extra: Partial<OfficerDef> = {}): OfficerDef {
  return {
    id, name, sex: 'm', born, died, stats: { war: st[0], ldr: st[1], int: st[2], pol: st[3], cha: st[4] }, temperament: t, aptitude: apt(ap), kin,
    source: 'fixture', basis: 'fixture officer for tests', ...extra,
  }
}

const city = (id: string, name: string, province: string, x: number, y: number): CityDef => ({
  id, name, province, lat: 30, lon: 110, x, y, farmMax: 1000, tradeMax: 1000, wallsMax: 500, source: 'fixture',
})

const cities: CityDef[] = [
  city('luoyang', 'Luoyang', 'Sili', 100, 100),
  city('changan', 'Changan', 'Sili', 30, 110),
  city('xuchang', 'Xuchang', 'Yu', 160, 140),
  city('ye', 'Ye', 'Ji', 150, 40),
  city('xiapi', 'Xiapi', 'Xu', 230, 120),
  city('wancheng', 'Wancheng', 'Jing', 100, 180),
]

const roads: RoadDef[] = [
  { a: 'luoyang', b: 'changan', days: 12, terrain: 'plain' },
  { a: 'luoyang', b: 'xuchang', days: 8, terrain: 'plain' },
  { a: 'luoyang', b: 'ye', days: 10, terrain: 'hills' },
  { a: 'xuchang', b: 'xiapi', days: 10, terrain: 'plain' },
  { a: 'xuchang', b: 'wancheng', days: 7, terrain: 'hills' },
  { a: 'ye', b: 'xiapi', days: 14, terrain: 'river' },
  { a: 'luoyang', b: 'wancheng', days: 9, terrain: 'forest' },
  { a: 'changan', b: 'wancheng', days: 15, terrain: 'mountain' },
]

const officers: OfficerDef[] = [
  // Dong Zhuo's house
  off('dong-zhuo', 'Dong Zhuo', 140, 192, [85, 78, 60, 40, 30], 'ambitious', 'ABB'),
  off('lu-bu', 'Lu Bu', 160, 199, [99, 85, 40, 30, 55], 'reckless', 'BAB', [{ id: 'diaochan', role: 'spouse' }]),
  off('diaochan', 'Diaochan', 175, null, [20, 20, 70, 50, 90], 'cautious', 'CCC', [{ id: 'lu-bu', role: 'spouse' }], { sex: 'f' }),
  off('li-ru', 'Li Ru', 150, null, [30, 60, 92, 70, 50], 'ambitious', 'CCC'),
  off('hua-xiong', 'Hua Xiong', 155, null, [88, 70, 35, 30, 40], 'reckless', 'BAB'),
  off('li-jue', 'Li Jue', 150, null, [70, 68, 40, 35, 40], 'ambitious', 'BBB'),
  // Cao Cao's house
  off('cao-cao', 'Cao Cao', 155, null, [72, 95, 91, 90, 85], 'ambitious', 'AAB', [{ id: 'cao-pi', role: 'child' }, { id: 'cao-ren', role: 'sibling' }]),
  off('xiahou-dun', 'Xiahou Dun', 160, null, [92, 84, 55, 45, 70], 'righteous', 'ABB'),
  off('xiahou-yuan', 'Xiahou Yuan', 160, null, [90, 82, 50, 40, 60], 'steady', 'BAA'),
  off('cao-ren', 'Cao Ren', 168, null, [82, 85, 55, 50, 65], 'steady', 'AAB', [{ id: 'cao-cao', role: 'sibling' }]),
  off('xun-yu', 'Xun Yu', 163, null, [25, 40, 96, 95, 75], 'righteous', 'CCC'),
  off('cao-pi', 'Cao Pi', 187, null, [60, 65, 75, 80, 70], 'ambitious', 'BBB', [{ id: 'cao-cao', role: 'parent' }], { appears: 192 }),
  // Yuan Shao's house
  off('yuan-shao', 'Yuan Shao', 154, 202, [70, 80, 60, 65, 88], 'cautious', 'ABB'),
  off('yan-liang', 'Yan Liang', 160, null, [90, 70, 35, 30, 45], 'reckless', 'BAB'),
  off('wen-chou', 'Wen Chou', 160, null, [89, 70, 33, 30, 45], 'reckless', 'BAB'),
  off('tian-feng', 'Tian Feng', 155, null, [30, 60, 88, 82, 60], 'righteous', 'CCC'),
  off('ju-shou', 'Ju Shou', 155, null, [28, 55, 90, 80, 60], 'righteous', 'CCC'),
  // wanderers: the oath group
  off('liu-bei', 'Liu Bei', 161, null, [75, 78, 74, 75, 99], 'righteous', 'ABA'),
  off('guan-yu', 'Guan Yu', 160, null, [98, 90, 70, 55, 85], 'righteous', 'ABB'),
  off('zhang-fei', 'Zhang Fei', 165, null, [97, 78, 35, 30, 55], 'reckless', 'BAB'),
  // hidden
  off('zhuge-liang', 'Zhuge Liang', 181, null, [30, 90, 100, 95, 92], 'cautious', 'CCC'),
  off('pang-tong', 'Pang Tong', 179, null, [35, 70, 97, 80, 60], 'steady', 'CCC'),
]

const scenario: ScenarioDef = {
  id: '190',
  name: 'Fixture 190',
  year: 190,
  month: 1,
  blurb: 'A small world for tests.',
  factions: [
    { id: 'f-dong-zhuo', name: 'Dong Zhuo', ruler: 'dong-zhuo', capital: 'luoyang', color: 1, glyph: 'D' },
    { id: 'f-cao-cao', name: 'Cao Cao', ruler: 'cao-cao', capital: 'xuchang', color: 2, glyph: 'C' },
    { id: 'f-yuan-shao', name: 'Yuan Shao', ruler: 'yuan-shao', capital: 'ye', color: 3, glyph: 'Y' },
  ],
  relations: [{ a: 'f-cao-cao', b: 'f-yuan-shao', value: 50 }],
  cities: [
    { id: 'luoyang', faction: 'f-dong-zhuo', population: 90000, farm: 500, trade: 600, walls: 300, order: 60, troops: 9000, training: 60, gold: 2500, rice: 8000 },
    { id: 'changan', faction: 'f-dong-zhuo', population: 70000, farm: 450, trade: 500, walls: 280, order: 55, troops: 6000, training: 50, gold: 1500, rice: 6000 },
    { id: 'xuchang', faction: 'f-cao-cao', population: 80000, farm: 550, trade: 650, walls: 250, order: 70, troops: 8000, training: 65, gold: 2500, rice: 7000 },
    { id: 'ye', faction: 'f-yuan-shao', population: 100000, farm: 600, trade: 650, walls: 320, order: 65, troops: 10000, training: 55, gold: 3000, rice: 9000 },
    { id: 'xiapi', faction: 'f-yuan-shao', population: 60000, farm: 400, trade: 450, walls: 200, order: 50, troops: 4000, training: 40, gold: 1200, rice: 4000 },
    { id: 'wancheng', faction: null, population: 40000, farm: 300, trade: 300, walls: 150, order: 40, troops: 0, training: 20, gold: 400, rice: 1000 },
  ],
  officers: [
    { id: 'dong-zhuo', faction: 'f-dong-zhuo', city: 'luoyang', post: 'ruler', loyalty: null, merit: 12000, gold: 500 },
    { id: 'lu-bu', faction: 'f-dong-zhuo', city: 'luoyang', post: 'officer', loyalty: 70, merit: 5000, gold: 200 },
    { id: 'diaochan', faction: 'f-dong-zhuo', city: 'luoyang', post: 'officer', loyalty: 75, merit: 500, gold: 100 },
    { id: 'li-ru', faction: 'f-dong-zhuo', city: 'luoyang', post: 'prefect', loyalty: 80, merit: 3500, gold: 200 },
    { id: 'hua-xiong', faction: 'f-dong-zhuo', city: 'changan', post: 'prefect', loyalty: 70, merit: 2500, gold: 100 },
    { id: 'li-jue', faction: 'f-dong-zhuo', city: 'changan', post: 'officer', loyalty: 65, merit: 1200, gold: 100 },
    { id: 'cao-cao', faction: 'f-cao-cao', city: 'xuchang', post: 'ruler', loyalty: null, merit: 9000, gold: 400 },
    { id: 'xiahou-dun', faction: 'f-cao-cao', city: 'xuchang', post: 'officer', loyalty: 85, merit: 4000, gold: 150 },
    { id: 'xiahou-yuan', faction: 'f-cao-cao', city: 'xuchang', post: 'officer', loyalty: 80, merit: 3000, gold: 100 },
    { id: 'cao-ren', faction: 'f-cao-cao', city: 'xuchang', post: 'officer', loyalty: 90, merit: 2000, gold: 100 },
    { id: 'xun-yu', faction: 'f-cao-cao', city: 'xuchang', post: 'prefect', loyalty: 85, merit: 3500, gold: 200 },
    { id: 'yuan-shao', faction: 'f-yuan-shao', city: 'ye', post: 'ruler', loyalty: null, merit: 10000, gold: 600 },
    { id: 'yan-liang', faction: 'f-yuan-shao', city: 'ye', post: 'officer', loyalty: 70, merit: 3200, gold: 100 },
    { id: 'wen-chou', faction: 'f-yuan-shao', city: 'xiapi', post: 'prefect', loyalty: 70, merit: 3100, gold: 100 },
    { id: 'tian-feng', faction: 'f-yuan-shao', city: 'ye', post: 'prefect', loyalty: 75, merit: 2800, gold: 150 },
    { id: 'ju-shou', faction: 'f-yuan-shao', city: 'xiapi', post: 'officer', loyalty: 75, merit: 1500, gold: 100 },
    { id: 'liu-bei', faction: null, city: 'wancheng', post: 'wanderer', loyalty: null, merit: 800, gold: 300 },
    { id: 'guan-yu', faction: null, city: 'wancheng', post: 'wanderer', loyalty: null, merit: 600, gold: 100 },
    { id: 'zhang-fei', faction: null, city: 'wancheng', post: 'wanderer', loyalty: null, merit: 500, gold: 100 },
    { id: 'zhuge-liang', faction: null, city: 'wancheng', post: 'wanderer', loyalty: null, merit: 0, gold: 50, hidden: true },
    { id: 'pang-tong', faction: null, city: 'xuchang', post: 'wanderer', loyalty: null, merit: 0, gold: 50, hidden: true },
  ],
  appearances: [{ id: 'cao-pi', year: 192, city: 'xuchang', faction: 'f-cao-cao' }],
  oaths: [['liu-bei', 'guan-yu', 'zhang-fei']],
  friendships: [
    { a: 'cao-cao', b: 'xiahou-dun', value: 90 },
    { a: 'liu-bei', b: 'guan-yu', value: 95 },
    { a: 'liu-bei', b: 'zhang-fei', value: 95 },
    { a: 'guan-yu', b: 'zhang-fei', value: 90 },
    { a: 'lu-bu', b: 'diaochan', value: 85 },
  ],
  rivals: [['li-ru', 'xun-yu']],
  flags: [],
}

const events: EventDef[] = [
  {
    id: 'coalition-forms', title: 'The coalition is sworn', from: { year: 190, month: 1 }, to: { year: 190, month: 12 }, chance: 100,
    conditions: [{ kind: 'factionExists', id: 'f-cao-cao' }, { kind: 'factionExists', id: 'f-yuan-shao' }, { kind: 'notFlag', id: 'coalition' }],
    text: 'The lords of the east swear to march together.',
    effects: [{ kind: 'alliance', factions: ['f-cao-cao', 'f-yuan-shao'], months: 12 }, { kind: 'setFlag', id: 'coalition' }],
    major: true, source: 'fixture',
  },
  {
    id: 'gate-duel', title: 'Lu Bu holds the gate', from: { year: 190, month: 2 }, to: { year: 190, month: 8 }, chance: 100,
    conditions: [{ kind: 'officerAlive', id: 'lu-bu' }, { kind: 'officerAlive', id: 'xiahou-dun' }],
    text: 'Lu Bu rides out alone. Someone must answer him.',
    effects: [{ kind: 'friendship', a: 'xiahou-dun', b: 'lu-bu', delta: -10 }, { kind: 'setFlag', id: 'gate-held' }],
    involves: ['xiahou-dun'],
    options: [
      { label: 'Hold the line', text: 'The line holds; no one rides out.', effects: [{ kind: 'friendship', a: 'xiahou-dun', b: 'lu-bu', delta: -10 }, { kind: 'setFlag', id: 'gate-held' }] },
      {
        label: 'Duel Lu Bu', text: 'Xiahou Dun rides out.', effects: [{ kind: 'setFlag', id: 'gate-duel' }],
        contest: {
          kind: 'duel', a: 'xiahou-dun', b: 'lu-bu',
          onWin: [{ kind: 'merit', id: 'xiahou-dun', delta: 500 }, { kind: 'setFlag', id: 'gate-won' }],
          onLoss: [{ kind: 'merit', id: 'xiahou-dun', delta: -100 }, { kind: 'friendship', a: 'xiahou-dun', b: 'lu-bu', delta: -5 }],
        },
      },
    ],
    source: 'fixture',
  },
  {
    id: 'tyrant-falls', title: 'The tyrant falls', from: { year: 192, month: 1 }, to: { year: 192, month: 6 }, chance: 60,
    conditions: [{ kind: 'officerAlive', id: 'dong-zhuo' }, { kind: 'officerIsRuler', id: 'dong-zhuo' }],
    text: 'A plot in the palace ends the tyrant.',
    effects: [{ kind: 'killOfficer', id: 'dong-zhuo' }, { kind: 'setFlag', id: 'tyrant-dead' }],
    involves: ['li-ru'],
    options: [
      { label: 'Let it happen', text: 'The plot runs its course.', effects: [{ kind: 'killOfficer', id: 'dong-zhuo' }, { kind: 'setFlag', id: 'tyrant-dead' }] },
      {
        label: 'Warn Dong Zhuo', text: 'Li Ru goes to argue for the tyrant.', effects: [],
        contest: { kind: 'debate', a: 'li-ru', b: 'dong-zhuo', onWin: [{ kind: 'setFlag', id: 'tyrant-warned' }], onLoss: [{ kind: 'killOfficer', id: 'dong-zhuo' }] },
      },
    ],
    major: true, source: 'fixture',
  },
]

export const MINI_WORLD: GameData = { cities, roads, officers, events, scenarios: [scenario], genericPortraits: ['gen-1', 'gen-2'] }
export const MINI_OPTS = (officer: string, seed = 1) => ({ scenario: '190', seed, officer })
