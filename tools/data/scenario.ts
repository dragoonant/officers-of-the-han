// Generator source: the 190 scenario (factions, city starts, officer starts, ties).
import type {
  CityDef, CityStart, FactionDef, OfficerAppearance, OfficerDef, OfficerStart, Post, RoadDef, ScenarioDef,
} from '../../src/contracts/data'

export const FACTION_ROWS: [string, string, string, string, string, string][] = [
  // code, id, name (ruler), ruler id, capital, glyph
  ['DZ', 'f-dong-zhuo', 'Dong Zhuo', 'dong-zhuo', 'luoyang', '董'],
  ['HF', 'f-han-fu', 'Han Fu', 'han-fu', 'ye', '韓'],
  ['YS', 'f-yuan-shao', 'Yuan Shao', 'yuan-shao', 'nanpi', '袁'],
  ['CC', 'f-cao-cao', 'Cao Cao', 'cao-cao', 'chenliu', '曹'],
  ['YU', 'f-yuan-shu', 'Yuan Shu', 'yuan-shu', 'wan', '袁'],
  ['SJ', 'f-sun-jian', 'Sun Jian', 'sun-jian', 'changsha', '孫'],
  ['LB', 'f-liu-biao', 'Liu Biao', 'liu-biao', 'xiangyang', '劉'],
  ['GZ', 'f-gongsun-zan', 'Gongsun Zan', 'gongsun-zan', 'beiping', '公'],
  ['LY', 'f-liu-yu', 'Liu Yu', 'liu-yu', 'ji', '劉'],
  ['GD', 'f-gongsun-du', 'Gongsun Du', 'gongsun-du', 'xiangping', '公'],
  ['KR', 'f-kong-rong', 'Kong Rong', 'kong-rong', 'beihai', '孔'],
  ['LD', 'f-liu-dai', 'Liu Dai', 'liu-dai', 'puyang', '劉'],
  ['TQ', 'f-tao-qian', 'Tao Qian', 'tao-qian', 'xiapi', '陶'],
  ['KZ', 'f-kong-zhou', 'Kong Zhou', 'kong-zhou', 'xuchang', '孔'],
  ['CW', 'f-chen-wen', 'Chen Wen', 'chen-wen', 'shouchun', '陳'],
  ['WL', 'f-wang-lang', 'Wang Lang', 'wang-lang', 'kuaiji', '王'],
  ['YB', 'f-yan-baihu', 'Yan Baihu', 'yan-baihu', 'wu', '嚴'],
  ['SX', 'f-shi-xie', 'Shi Xie', 'shi-xie', 'jiaozhi', '士'],
  ['LN', 'f-liu-yan', 'Liu Yan', 'liu-yan', 'chengdu', '劉'],
  ['ZL', 'f-zhang-lu', 'Zhang Lu', 'zhang-lu', 'hanzhong', '張'],
  ['MT', 'f-ma-teng', 'Ma Teng', 'ma-teng', 'wuwei', '馬'],
  ['HS', 'f-han-sui', 'Han Sui', 'han-sui', 'anding', '韓'],
  ['ZY', 'f-zhang-yang', 'Zhang Yang', 'zhang-yang', 'shangdang', '張'],
]
export const FAC: Record<string, string> = Object.fromEntries(FACTION_ROWS.map((r) => [r[0], r[1]]))

// id -> [faction code, troops, training, order]
const CITY_START: Record<string, [string, number, number, number]> = {
  luoyang: ['DZ', 34000, 70, 60], 'chang-an': ['DZ', 16000, 60, 65], hongnong: ['DZ', 8000, 55, 55], hedong: ['DZ', 9000, 60, 55],
  ye: ['HF', 18000, 55, 70], nanpi: ['YS', 10000, 65, 70], ji: ['LY', 15000, 55, 75], beiping: ['GZ', 14000, 75, 65],
  xiangping: ['GD', 9000, 55, 60], pingyuan: ['GZ', 4000, 60, 60], beihai: ['KR', 7000, 50, 70], puyang: ['LD', 8000, 50, 60],
  chenliu: ['CC', 5000, 70, 70], xuchang: ['KZ', 5000, 45, 60], runan: ['-', 1500, 25, 45], xiaopei: ['-', 1200, 25, 50],
  xiapi: ['TQ', 10000, 50, 75], langya: ['TQ', 5000, 45, 65], shouchun: ['CW', 6000, 45, 60], lujiang: ['-', 2000, 30, 50],
  jianye: ['-', 1500, 25, 50], wu: ['YB', 7000, 50, 40], kuaiji: ['WL', 5000, 45, 65], yuzhang: ['-', 2500, 30, 55],
  chaisang: ['-', 1800, 30, 50], xiangyang: ['LB', 12000, 60, 70], wan: ['YU', 22000, 55, 55], xinye: ['YU', 6000, 50, 55],
  jiangling: ['LB', 7000, 55, 65], jiangxia: ['LB', 6000, 55, 60], changsha: ['SJ', 8000, 70, 65], wuling: ['-', 1500, 30, 55],
  lingling: ['-', 1500, 30, 55], guiyang: ['-', 1200, 30, 50], shangyong: ['-', 1000, 25, 45], hanzhong: ['ZL', 6000, 55, 65],
  zitong: ['LN', 4000, 45, 60], chengdu: ['LN', 10000, 50, 75], jiangzhou: ['LN', 5000, 45, 60], yongan: ['-', 1500, 30, 50],
  jianning: ['-', 1000, 25, 40], tianshui: ['-', 3000, 40, 50], anding: ['HS', 9000, 65, 50], wuwei: ['MT', 10000, 70, 55],
  jinyang: ['-', 3000, 35, 55], shangdang: ['ZY', 8000, 55, 60], jiaozhi: ['SX', 6000, 45, 70], nanhai: ['-', 1500, 30, 55],
}

const COALITION = ['YS', 'YU', 'HF', 'CC', 'SJ', 'LD', 'KR', 'GZ', 'ZY', 'KZ', 'TQ']
export const COALITION_IDS = COALITION.map((c) => FAC[c]!)

export const FRIENDSHIPS: [string, string, number][] = [
  ['liu-bei', 'guan-yu', 95], ['liu-bei', 'zhang-fei', 95], ['guan-yu', 'zhang-fei', 92],
  ['cao-cao', 'xiahou-dun', 80], ['cao-cao', 'xiahou-yuan', 72], ['cao-cao', 'cao-ren', 80], ['cao-cao', 'cao-hong', 85], ['cao-cao', 'cao-chun', 80],
  ['cao-cao', 'zhang-miao', 75], ['cao-cao', 'yuan-shao', 60], ['cao-cao', 'xu-you', 65], ['cao-cao', 'dian-wei', 60],
  ['sun-jian', 'cheng-pu', 80], ['sun-jian', 'huang-gai', 80], ['sun-jian', 'han-dang', 80], ['sun-jian', 'zhu-zhi', 70], ['sun-jian', 'zu-mao', 75],
  ['sun-ce', 'zhou-yu', 92], ['zhou-yu', 'lu-su', 70], ['sun-ce', 'sun-quan', 75], ['sun-ce', 'cheng-pu', 70],
  ['lu-bu', 'gao-shun', 70], ['lu-bu', 'zhang-liao', 60], ['lu-bu', 'dong-zhuo', 55], ['lu-bu', 'chen-gong', 20],
  ['diaochan', 'wang-yun', 75], ['li-jue', 'guo-si', 75], ['li-jue', 'zhang-ji', 60], ['jia-xu', 'niu-fu', 40],
  ['liu-bei', 'gongsun-zan', 65], ['liu-bei', 'lu-zhi', 60], ['gongsun-zan', 'lu-zhi', 65], ['liu-bei', 'jian-yong', 85],
  ['xun-yu', 'xun-you', 70], ['xun-yu', 'guo-jia', 50], ['kong-rong', 'taishi-ci', 55], ['kong-rong', 'zheng-xuan', 70],
  ['ma-teng', 'han-sui', 75], ['ma-teng', 'pang-de', 70], ['ma-chao', 'pang-de', 70],
  ['zhuge-liang', 'pang-tong', 65], ['zhuge-liang', 'xu-shu', 70], ['pang-tong', 'sima-hui', 60], ['zhuge-liang', 'sima-hui', 60],
  ['yuan-shao', 'xu-you', 65], ['ju-shou', 'tian-feng', 70], ['zhang-he', 'yan-liang', 40], ['bao-xin', 'yu-jin', 70],
  ['tao-qian', 'mi-zhu', 55], ['mi-zhu', 'sun-qian', 65], ['mi-zhu', 'chen-deng', 55], ['liu-biao', 'kuai-liang', 70], ['liu-biao', 'cai-mao', 55],
  ['wang-yun', 'cai-yong', 85], ['cai-yong', 'dong-zhuo', 60], ['sima-yi', 'sima-lang', 85],
  ['huang-zhong', 'wei-yan', 30],
]

export const RIVALS: [string, string][] = [
  ['yuan-shao', 'yuan-shu'], ['yuan-shao', 'gongsun-zan'], ['liu-yu', 'gongsun-zan'], ['liu-dai', 'qiao-mao'],
  ['wang-yun', 'dong-zhuo'], ['mi-heng', 'cao-cao'], ['ju-shou', 'guo-tu'], ['shen-pei', 'guo-tu'],
]

export const OATHS: string[][] = [['liu-bei', 'guan-yu', 'zhang-fei'], ['ma-teng', 'han-sui']]

export const KIN: [string, 'parent' | 'child' | 'sibling' | 'spouse', string][] = [
  ['sun-jian', 'child', 'sun-ce'], ['sun-jian', 'child', 'sun-quan'], ['sun-jian', 'spouse', 'lady-wu'], ['sun-jian', 'sibling', 'sun-jing'],
  ['lady-wu', 'sibling', 'wu-jing'], ['lady-wu', 'child', 'sun-ce'], ['lady-wu', 'child', 'sun-quan'], ['sun-ce', 'sibling', 'sun-quan'],
  ['yuan-shao', 'sibling', 'yuan-shu'], ['zhang-lu', 'sibling', 'zhang-wei'], ['yuan-shao', 'child', 'yuan-tan'], ['yuan-shao', 'child', 'yuan-xi'], ['yuan-shao', 'child', 'yuan-shang'],
  ['yuan-tan', 'sibling', 'yuan-xi'], ['yuan-tan', 'sibling', 'yuan-shang'], ['yuan-xi', 'sibling', 'yuan-shang'],
  ['cao-cao', 'spouse', 'lady-bian'], ['cao-cao', 'child', 'cao-ang'], ['cao-ren', 'sibling', 'cao-chun'],
  ['liu-yan', 'child', 'liu-zhang'], ['ma-teng', 'child', 'ma-chao'], ['mi-zhu', 'sibling', 'mi-fang'], ['zhuge-jin', 'sibling', 'zhuge-liang'],
  ['xin-ping', 'sibling', 'xin-pi'], ['zhang-miao', 'sibling', 'zhang-chao'], ['shi-xie', 'sibling', 'shi-yi'], ['kuai-liang', 'sibling', 'kuai-yue'],
  ['da-qiao', 'sibling', 'xiao-qiao'], ['dong-zhuo', 'sibling', 'dong-min'], ['cai-yong', 'child', 'cai-yan'], ['sima-yi', 'sibling', 'sima-lang'],
  ['gongsun-du', 'child', 'gongsun-kang'], ['guan-yu', 'child', 'guan-ping'], ['yang-biao', 'child', 'yang-xiu'],
]
const INV = { parent: 'child', child: 'parent', sibling: 'sibling', spouse: 'spouse' } as const

export function hash01(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return ((h >>> 0) % 10000) / 10000
}

/** Mirrors every kin pair, in place, on the generated officer defs. */
export function applyKin(officers: OfficerDef[]): void {
  const byId = new Map(officers.map((o) => [o.id, o]))
  const add = (a: string, role: 'parent' | 'child' | 'sibling' | 'spouse', b: string) => {
    const o = byId.get(a)
    if (!o) throw new Error(`kin: unknown officer ${a}`)
    if (!o.kin.some((k) => k.id === b && k.role === role)) o.kin.push({ id: b, role })
  }
  for (const [a, role, b] of KIN) {
    add(a, role, b)
    add(b, INV[role], a)
  }
  for (const o of officers) o.kin.sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : x.role < y.role ? -1 : 1))
}

const SALARY = [10, 20, 35, 55, 80]
function rankOf(merit: number): number {
  return merit >= 10000 ? 4 : merit >= 6000 ? 3 : merit >= 3000 ? 2 : merit >= 1000 ? 1 : 0
}
const statSum = (o: OfficerDef) => o.stats.war + o.stats.ldr + o.stats.int + o.stats.pol + o.stats.cha

export interface LocRow { id: string; loc: string }

export function buildScenario(cities: CityDef[], roads: RoadDef[], officers: OfficerDef[], locs: LocRow[]): ScenarioDef {
  void roads
  const off = new Map(officers.map((o) => [o.id, o]))
  const factions: FactionDef[] = FACTION_ROWS.map(([, id, name, ruler, capital, glyph]) => ({ id, name, ruler, capital, color: 1, glyph }))
  // Colour the factions greedily so factions on neighbouring cities differ (14 pigments, docs/spec/50-presentation.md).
  const cityFac = new Map<string, string>()
  for (const [cid, v] of Object.entries(CITY_START)) if (v[0] !== '-') cityFac.set(cid, FAC[v[0]]!)
  const adj = new Map<string, Set<string>>()
  for (const r of roads) {
    const fa = cityFac.get(r.a)
    const fb = cityFac.get(r.b)
    if (fa && fb && fa !== fb) {
      if (!adj.has(fa)) adj.set(fa, new Set())
      if (!adj.has(fb)) adj.set(fb, new Set())
      adj.get(fa)!.add(fb)
      adj.get(fb)!.add(fa)
    }
  }
  const colour = new Map<string, number>()
  const order = [...factions].sort((a, b) => (adj.get(b.id)?.size ?? 0) - (adj.get(a.id)?.size ?? 0) || (a.id < b.id ? -1 : 1))
  for (const f of order) {
    const used = new Set([...(adj.get(f.id) ?? [])].map((n) => colour.get(n)).filter(Boolean))
    // least-used colour among those no neighbouring faction wears
    const count = new Map<number, number>()
    for (const v of colour.values()) count.set(v, (count.get(v) ?? 0) + 1)
    let c = 1
    for (let k = 1; k <= 14; k++) if (!used.has(k) && (count.get(k) ?? 0) < (count.get(c) ?? 0) + (used.has(c) ? 99 : 0)) c = k
    if (used.has(c)) { c = 1; while (used.has(c)) c++ }
    colour.set(f.id, c)
  }
  for (const f of factions) f.color = colour.get(f.id)!

  // ---- officers ----
  const starts: OfficerStart[] = []
  const appearances: OfficerAppearance[] = []
  const factionOfficers = new Map<string, string[]>()
  const rulerOf = new Map(FACTION_ROWS.map((r) => [r[1], r[3]]))
  const bound = new Set<string>()
  for (const g of OATHS) for (const a of g) for (const b of g) if (a !== b) bound.add(a + '|' + b)
  for (const { id, loc } of locs) {
    const o = off.get(id)
    if (!o) throw new Error(`loc for unknown officer ${id}`)
    const app = /^@(\d+) ([A-Z-]+)\/([a-z-]+)(!?)$/.exec(loc)
    if (app) {
      const code = app[2]!
      const a: OfficerAppearance = { id, year: Number(app[1]), city: app[3]!, faction: code === '-' ? null : FAC[code]! }
      if (app[4]) a.hidden = true
      appearances.push(a)
      continue
    }
    const m = /^([A-Z-]+)\/([a-z-]+)\/([rpow])(!?)$/.exec(loc)
    if (!m) throw new Error(`bad loc ${id}: ${loc}`)
    const hidden = m[4] === '!'
    const code = hidden ? '-' : m[1]!
    const postCode = hidden ? 'w' : m[3]!
    const post: Post = postCode === 'r' ? 'ruler' : postCode === 'p' ? 'prefect' : postCode === 'o' ? 'officer' : 'wanderer'
    const faction = code === '-' ? null : FAC[code]!
    if (faction && post === 'wanderer') throw new Error(`${id}: wanderer with faction`)
    const st: OfficerStart = { id, faction, city: m[2]!, post, loyalty: null, merit: 0, gold: 0 }
    if (hidden) st.hidden = true
    starts.push(st)
    if (faction) {
      if (!factionOfficers.has(faction)) factionOfficers.set(faction, [])
      factionOfficers.get(faction)!.push(id)
    }
  }
  // merit, loyalty, gold
  for (const s of starts) {
    const o = off.get(s.id)!
    const sum = statSum(o)
    const j = hash01(s.id)
    if (!s.faction) {
      s.merit = s.hidden ? 0 : Math.round(sum / 2 + j * 100)
      s.gold = s.hidden ? 50 + Math.round(j * 100) : 100 + Math.round(j * 200)
      continue
    }
    if (s.post === 'ruler') {
      s.merit = 12000
      s.gold = 500 + Math.round(j * 500)
      continue
    }
    s.merit = sum >= 440 ? 3200 : sum >= 400 ? 1800 : sum >= 360 ? 1200 : sum >= 320 ? 600 : 300
    if (s.post === 'prefect') s.merit = Math.max(s.merit, 1200)
    s.gold = 80 + rankOf(s.merit) * 100 + Math.round(j * 150)
    const mood = o.temperament === 'righteous' ? 10 : o.temperament === 'steady' ? 5 : o.temperament === 'ambitious' ? -10 : 0
    s.loyalty = Math.max(35, Math.min(95, 65 + mood + Math.round(j * 12)))
    const ruler = rulerOf.get(s.faction)!
    const kinOfRuler = KIN.some(([a, , b]) => (a === ruler && b === s.id) || (b === ruler && a === s.id))
    const oathWithRuler = [...bound].includes(s.id + '|' + ruler)
    if (kinOfRuler || oathWithRuler) s.loyalty = 100
  }
  // specific loyalty notes
  const setLoy = (id: string, v: number) => { const s = starts.find((x) => x.id === id); if (s && s.loyalty !== null) s.loyalty = v }
  setLoy('lu-bu', 58); setLoy('zhang-liao', 62); setLoy('xun-yu', 70); setLoy('yu-jin', 66); setLoy('zhang-he', 68)

  // ---- cities ----
  const cityStarts: CityStart[] = cities.map((c) => {
    const [code, troops, training, order] = CITY_START[c.id]!
    const owned = code !== '-'
    const j1 = hash01(c.id + 'f')
    const j2 = hash01(c.id + 't')
    const j3 = hash01(c.id + 'w')
    const fr = owned ? 0.62 + j1 * 0.2 : 0.38 + j1 * 0.15
    const tr = owned ? 0.6 + j2 * 0.22 : 0.35 + j2 * 0.15
    const wr = owned ? 0.65 + j3 * 0.2 : 0.4 + j3 * 0.15
    const farm = Math.round(c.farmMax * fr)
    const trade = Math.round(c.tradeMax * tr)
    const walls = Math.round(c.wallsMax * wr)
    const population = Math.round((c.farmMax * 220 + c.tradeMax * 80) * (0.85 + hash01(c.id + 'p') * 0.12) / 100) * 100
    const upkeep = Math.ceil(troops / 100)
    return {
      id: c.id,
      faction: owned ? FAC[code]! : null,
      population,
      farm,
      trade,
      walls,
      order,
      troops,
      training,
      gold: owned ? Math.round((2500 + trade * 6) / 100) * 100 : 300 + Math.round(trade),
      rice: Math.round((upkeep * 12 + farm * 6) / 100) * 100, // vacant cities too (M4a data request: claimants starved)
    }
  })
  // Economy tuning: each faction's monthly gold must cover its salary roll (W-ECO-1, W-OFF-4).
  const cityById = new Map(cityStarts.map((c) => [c.id, c]))
  const incomeOf = (c: CityStart) => Math.floor((c.trade * (50 + c.order)) / 400)
  const salaryRoll = (fid: string) => starts.filter((s) => s.faction === fid && s.post !== 'ruler').reduce((a, s) => a + SALARY[rankOf(s.merit)]!, 0)
  const tuning: string[] = []
  for (const f of factions) {
    const fc = cityStarts.filter((c) => c.faction === f.id)
    const incomeNow = () => fc.reduce((a, c) => a + incomeOf(c), 0)
    // 1) raise trade toward the max; 2) lift order; 3) demote the best-paid officers.
    for (const c of fc) {
      const def = cities.find((x) => x.id === c.id)!
      if (incomeNow() >= salaryRoll(f.id) * 1.15) break
      c.trade = Math.min(def.tradeMax, Math.max(c.trade, Math.round(def.tradeMax * 0.9)))
    }
    if (incomeNow() < salaryRoll(f.id) * 1.15) for (const c of fc) c.order = Math.min(90, c.order + 10)
    const paid = starts.filter((s) => s.faction === f.id && s.post !== 'ruler').sort((a, b) => b.merit - a.merit)
    for (const s of paid) {
      if (incomeNow() >= salaryRoll(f.id) * 1.15) break
      if (rankOf(s.merit) > 0) { s.merit = rankOf(s.merit) >= 2 ? 1200 : 500; tuning.push(s.id) }
    }
  }
  void cityById
  void tuning

  const relations: ScenarioDef['relations'] = []
  const putRel = (a: string, b: string, value: number) => {
    const i = relations.findIndex((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a))
    if (i >= 0) relations[i]!.value = value
    else relations.push({ a, b, value })
  }
  for (let i = 0; i < COALITION.length; i++) for (let j = i + 1; j < COALITION.length; j++) putRel(FAC[COALITION[i]!]!, FAC[COALITION[j]!]!, 60)
  const dzHate: Record<string, number> = { YS: 5, CC: 5, SJ: 5, YU: 8, HF: 10 }
  for (const c of COALITION) putRel(FAC.DZ!, FAC[c]!, dzHate[c] ?? 12)
  putRel(FAC.DZ!, FAC.MT!, 25); putRel(FAC.DZ!, FAC.HS!, 25)
  putRel(FAC.YS!, FAC.YU!, 40); putRel(FAC.YS!, FAC.GZ!, 45); putRel(FAC.YS!, FAC.HF!, 50)
  putRel(FAC.LY!, FAC.GZ!, 25); putRel(FAC.SJ!, FAC.LB!, 20); putRel(FAC.YU!, FAC.LB!, 25)
  putRel(FAC.MT!, FAC.HS!, 75); putRel(FAC.ZL!, FAC.LN!, 70); putRel(FAC.LB!, FAC.YU!, 25)

  return {
    id: '190',
    name: 'The Coalition against Dong Zhuo',
    year: 190,
    month: 1,
    blurb:
      'January 190. Dong Zhuo holds the child emperor at Luoyang and the east has sworn to pull him down. Yuan Shao, Cao Cao, Yuan Shu, Sun Jian and a dozen governors are raising armies, while Liu Bei, a minor officer, rides with Gongsun Zan.',
    factions,
    relations,
    cities: cityStarts,
    officers: starts,
    appearances,
    oaths: OATHS,
    friendships: FRIENDSHIPS.map(([a, b, value]) => ({ a, b, value })),
    rivals: RIVALS,
    flags: [],
  }
}
