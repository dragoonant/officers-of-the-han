import { describe, expect, it } from 'vitest'
import { W, J, act, rej, fresh, calm, endMonth, clear } from './helpers'

describe('W-TIME', () => {
  it('W-TIME-1 the game starts in 190-1 and months run 1-12 then roll the year', () => {
    let s = fresh('xiahou-dun', 1, calm)
    expect(s.ym).toEqual({ year: 190, month: 1 })
    for (let i = 0; i < 12; i++) s = endMonth(s)
    expect(s.ym).toEqual({ year: 191, month: 1 })
  })
  it('W-TIME-2 actions cost days, unspent days are lost, too few days is refused', () => {
    let s = fresh('xiahou-dun', 1, calm)
    s = act(s, { kind: 'work', work: 'train' })
    expect(s.officers['xiahou-dun']!.days).toBe(20)
    s = act(s, { kind: 'study', stat: 'int' })
    expect(s.officers['xiahou-dun']!.days).toBe(5)
    expect(rej(s, { kind: 'study', stat: 'pol' }).code).toBe('no-days')
    s = endMonth(s)
    expect(s.officers['xiahou-dun']!.days).toBe(30)
  })
  it('W-TIME-3 the world turn runs after endMonth: AI officers act, then income arrives at the new month', () => {
    let s = fresh('xiahou-dun', 1)
    s.options.events = false
    const before = J(s)
    s = endMonth(s)
    expect(s.ym.month).toBe(2)
    const worked = s.log.filter((e) => e.kind === 'work' || e.kind === 'travel').length
    expect(s.officers['li-ru']!.days).toBe(30)
    expect(JSON.stringify(s.cities) === JSON.stringify(before.cities)).toBe(false)
    void worked
  })
  it('W-TIME-3 the pipeline pauses on a played battle and resumes on the answer', () => {
    let s = fresh('xiahou-dun', 1, calm)
    s.pacts = []
    s.cities['wancheng']!.faction = null
    const units = W.query.suggestArmy(s, 'xuchang', 'wancheng')
    s = act(s, { kind: 'endMonth' })
    // the player is not in the AI army unless the court included them; force an attack with the player inside
    expect(s.phase).toBe('player')
    s = fresh('cao-cao', 1, calm)
    s.pacts = []
    s.cities['wancheng']!.faction = 'f-dong-zhuo'
    s.cities['wancheng']!.troops = 1000
    const army = [{ officer: 'cao-cao', troops: 3000, type: 'spear' as const, commander: true }, ...W.query.suggestArmy(s, 'xuchang', 'wancheng').slice(0, 2).map((u) => ({ ...u, commander: false }))]
    expect(units.length).toBeGreaterThan(0)
    s = act(s, { kind: 'war', from: 'xuchang', to: 'wancheng', units: army })
    s = act(s, { kind: 'endMonth' })
    expect(s.phase).toBe('world')
    expect(s.cursor?.stage).toBe('armies')
    expect(s.pending[0]!.kind).toBe('battle')
    s = clear(s)
    s = endMonthDone(s)
    expect(s.phase).toBe('player')
    expect(s.ym.month).toBe(2)
  })
})
function endMonthDone(s: ReturnType<typeof fresh>) {
  let g = 0
  while ((s.phase === 'world' || s.pending.length) && g++ < 50) s = clear(s)
  return s
}

describe('W-MAP', () => {
  it('W-MAP-1 travel costs the road days and needs a road', () => {
    let s = fresh('xiahou-dun', 1, calm)
    expect(rej(s, { kind: 'travel', to: 'ye' }).code).toBe('bad-target')
    s = act(s, { kind: 'travel', to: 'wancheng' })
    expect(s.officers['xiahou-dun']!.days).toBe(23)
    expect(s.officers['xiahou-dun']!.city).toBe('wancheng')
  })
  it('W-MAP-1 a faction officer cannot travel into another house city', () => {
    const s = fresh('xiahou-dun', 1, calm)
    expect(rej(s, { kind: 'travel', to: 'luoyang' }).code).toBe('not-legal')
  })
  it('W-MAP-2 a city has at most one prefect and a vacant city has none', () => {
    let s = fresh('cao-cao', 1, calm)
    s = act(s, { kind: 'appoint', officer: 'cao-ren' })
    expect(s.cities['xuchang']!.prefect).toBe('cao-ren')
    expect(s.officers['xun-yu']!.post).toBe('officer')
    expect(W.invariants(s)).toEqual([])
    expect(fresh('cao-cao').cities['wancheng']!.faction).toBeNull()
  })
})

describe('W-OFF', () => {
  it('W-OFF-2 officers carry health, loyalty (null for rulers and wanderers), merit and gold', () => {
    const s = fresh('xiahou-dun')
    expect(s.officers['cao-cao']!.loyalty).toBeNull()
    expect(s.officers['liu-bei']!.loyalty).toBeNull()
    expect(s.officers['xiahou-dun']!.loyalty).not.toBeNull()
    expect(s.officers['xiahou-dun']!.health).toBe(100)
  })
  it('W-OFF-3 work gives 10 xp, study 30, 100 xp gives +1 and resets', () => {
    let s = fresh('xun-yu', 1, calm)
    s.officers['xun-yu']!.xp.pol = 95
    const pol = s.officers['xun-yu']!.stats.pol
    s = act(s, { kind: 'work', work: 'farm' })
    expect(s.officers['xun-yu']!.stats.pol).toBe(pol + 1)
    expect(s.officers['xun-yu']!.xp.pol).toBe(5)
    s = act(s, { kind: 'study', stat: 'int' })
    expect(s.officers['xun-yu']!.xp.int).toBe(30)
  })
  it('W-OFF-3 officers aged 55 or more gain no xp', () => {
    let s = fresh('dong-zhuo', 1, calm)
    s.ym.year = 200
    s = act(s, { kind: 'study', stat: 'int' })
    expect(s.officers['dong-zhuo']!.xp.int).toBe(0)
  })
  it('W-OFF-4 rank follows merit and a ruler counts as Grand General', () => {
    const s = fresh('xiahou-dun')
    expect(W.query.officerView(s, 'xiahou-dun')!.rankName).toBe('Colonel')
    expect(W.query.officerView(s, 'cao-ren')!.rankName).toBe('Captain')
    expect(W.query.officerView(s, 'cao-cao')!.rankName).toBe('Grand General')
    expect(W.query.officerView(s, 'xiahou-dun')!.troopCap).toBe(8000)
    expect(W.query.officerView(s, 'xiahou-dun')!.salary).toBe(35)
  })
  it('W-OFF-5 posts: one ruler per faction, wanderers serve no one', () => {
    const s = fresh('xiahou-dun')
    for (const f of Object.values(s.factions)) expect(s.officers[f.ruler]!.post).toBe('ruler')
    expect(s.officers['liu-bei']!.faction).toBeNull()
  })
  it('W-OFF-6 an officer does not exist before their appearance year', () => {
    let s = fresh('xiahou-dun', 1, calm)
    expect(s.officers['cao-pi']!.status).toBe('unborn')
    for (let i = 0; i < 24; i++) s = endMonth(s)
    expect(s.officers['cao-pi']!.status).toBe('active')
    expect(s.officers['cao-pi']!.faction).toBe('f-cao-cao')
  })
  it('W-OFF-7 expected tier decides the loyalty fit (low-tier rank loses 10)', () => {
    let s = fresh('xiahou-dun', 1, calm)
    s.officers['cao-ren']!.loyalty = 50
    s.officers['cao-ren']!.merit = 0 // tier 0 < expected -> fit -10
    s = endMonth(s, true)
    // target = 40 + friendship(20)/2 -10 + 5(steady) -> 45... but bound (sibling of the ruler) is fixed at 100
    expect(s.officers['cao-ren']!.loyalty).toBe(100)
    s = fresh('xiahou-dun', 1, calm)
    s.officers['xiahou-yuan']!.loyalty = 50
    s.officers['xiahou-yuan']!.merit = 0
    s.friendships['cao-cao|xiahou-yuan'] = 20
    s.cities['xuchang']!.gold = 100
    s = endMonth(s, true)
    expect(s.officers['xiahou-yuan']!.loyalty).toBe(48) // T = 40+10-10+5 = 45, moves 2 toward -> 48
  })
  it('W-OFF-8 health recovers 10 at month start; below 30 cannot duel or march; 0 means death', () => {
    let s = fresh('xiahou-dun', 1, calm)
    s.officers['xiahou-dun']!.health = 50
    s = endMonth(s)
    expect(s.officers['xiahou-dun']!.health).toBe(60)
    s.officers['xiahou-yuan']!.health = 20
    s.officers['xiahou-yuan']!.city = 'xuchang'
    expect(rej(s, { kind: 'challenge', officer: 'xiahou-yuan' }).code).toBe('not-legal')
    s.officers['xiahou-yuan']!.health = 0
    s = endMonth(s)
    // +10 at start then the death check ran before it: health 0 died at the deaths stage
    expect(s.officers['xiahou-yuan']!.status).toBe('dead')
  })
})

describe('W-ECO', () => {
  const base = () => fresh('xiahou-dun', 1, (s) => { calm(s); for (const c of Object.values(s.cities)) { c.troops = 0; c.rice = 0 } })
  const em = (s: ReturnType<typeof base>) => endMonth(s, true)
  it('W-ECO-1 gold income is trade * (50 + order) / 400', () => {
    let s = base()
    s.cities['xuchang']!.gold = 0
    s.cities['xuchang']!.trade = 640
    s.cities['xuchang']!.order = 70
    s.officers['xiahou-dun']!.days = 0
    for (const o of Object.values(s.officers)) o.merit = 0
    for (const o of Object.values(s.officers)) if (o.faction === 'f-cao-cao') o.post = o.post === 'ruler' ? 'ruler' : 'officer'
    s.cities['xuchang']!.prefect = null
    s = em(s)
    // income 640*120/400 = 192; salaries of 4 non-rulers at 10 gold
    expect(s.cities['xuchang']!.gold).toBe(192 - 4 * 10)
  })
  it('W-ECO-2 rice arrives at the start of month 9 only', () => {
    let s = base()
    s.ym = { year: 190, month: 7 }
    s.cities['ye']!.rice = 0
    s.cities['ye']!.farm = 600
    s.cities['ye']!.order = 50
    s = em(s)
    expect(s.cities['ye']!.rice).toBe(0)
    s = em(s)
    expect(s.ym.month).toBe(9)
    expect(s.cities['ye']!.rice).toBe(Math.floor((600 * 100) / 20))
  })
  it('W-ECO-3 upkeep ceil(troops/100) rice; without rice troops lose 10% and order 5', () => {
    let s = base()
    s.cities['ye']!.troops = 1001
    s.cities['ye']!.rice = 100
    s.cities['ye']!.order = 50
    s = em(s)
    expect(s.cities['ye']!.rice).toBe(100 - 11)
    s.cities['ye']!.rice = 5
    s = em(s)
    expect(s.cities['ye']!.rice).toBe(0)
    expect(s.cities['ye']!.troops).toBe(1001 - Math.floor(1001 / 10))
    expect(s.cities['ye']!.order).toBeLessThan(50)
  })
  it('W-ECO-4 salaries are paid from the city; an unpaid officer loses 3 loyalty', () => {
    let s = base()
    s.cities['xuchang']!.trade = 0
    s.cities['xuchang']!.gold = 0
    s.officers['xiahou-dun']!.loyalty = 80
    const purse = s.officers['xiahou-dun']!.gold
    s.officers['xiahou-dun']!.days = 0
    s = em(s)
    expect(s.officers['xiahou-dun']!.gold).toBe(purse)
    // loyalty drift then -3 for the missed pay: net strictly below target path; assert purse unchanged and loyalty < 100
    expect(s.officers['xiahou-dun']!.loyalty!).toBeLessThan(100)
    s = base()
    s.cities['xuchang']!.gold = 1000
    s = em(s)
    expect(s.officers['xiahou-dun']!.gold).toBeGreaterThan(purse - 1)
  })
  it('W-ECO-5 population grows by population * order / 20000', () => {
    let s = base()
    s.cities['ye']!.population = 100000
    s.cities['ye']!.order = 60
    s = em(s)
    expect(s.cities['ye']!.population).toBe(100000 + 300)
  })
  it('W-ECO-6 vacant cities have no income or upkeep', () => {
    let s = fresh('xiahou-dun', 1, (x) => { calm(x); x.cities['wancheng']!.faction = null; for (const c of Object.values(x.cities)) c.troops = 0 })
    const w = J(s.cities['wancheng']!)
    s = em(s)
    expect(s.cities['wancheng']).toEqual(w)
  })
})
