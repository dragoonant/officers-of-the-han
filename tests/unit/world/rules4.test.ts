import { describe, expect, it } from 'vitest'
import type { BattleOutcome } from '../../../src/contracts/battle'
import { W, J, act, rej, fresh, calm, endMonth, tryRolls, clear } from './helpers'

describe('W-CRT', () => {
  it('W-CRT-APPOINT the ruler makes an officer prefect; the old prefect becomes an officer', () => {
    let s = fresh('cao-cao', 1, calm)
    s = act(s, { kind: 'appoint', officer: 'cao-ren' })
    expect(s.cities['xuchang']!.prefect).toBe('cao-ren')
    expect(s.officers['xun-yu']!.post).toBe('officer')
    expect(s.officers['cao-cao']!.days).toBe(29)
    expect(rej(fresh('xiahou-dun', 1, calm), { kind: 'appoint', officer: 'cao-ren' }).code).toBe('not-legal')
  })
  it('W-CRT-TRANSFER moves an officer to another faction city for 2 days', () => {
    let s = fresh('cao-cao', 1, calm)
    s = act(s, { kind: 'transfer', officer: 'cao-ren', to: 'wancheng' })
    expect(s.officers['cao-ren']!.city).toBe('wancheng')
    expect(s.officers['cao-ren']!.days).toBe(0)
    expect(s.officers['cao-cao']!.days).toBe(28)
    expect(rej(s, { kind: 'transfer', officer: 'cao-ren', to: 'luoyang' }).code).toBe('bad-target')
  })
  it('W-CRT-MISSION gives an officer a mission with the rule-set deadline', () => {
    let s = fresh('cao-cao', 1, calm)
    s = act(s, { kind: 'mission', officer: 'cao-ren', mission: { kind: 'develop', city: 'xuchang', work: 'farm', count: 2, done: 0, deadline: { year: 1, month: 1 } } })
    expect(s.officers['cao-ren']!.mission).toMatchObject({ kind: 'develop', done: 0, deadline: { year: 190, month: 1 } })
    expect(rej(s, { kind: 'mission', officer: 'cao-ren', mission: { kind: 'scout', city: 'ye', reached: false, deadline: { year: 1, month: 1 } } }).code).toBe('not-legal')
  })
  it('W-CRT-TRANSPORT moves gold, rice and troops at once between adjacent faction cities', () => {
    let s = fresh('cao-cao', 1, calm)
    const a = s.cities['xuchang']!
    const [g, r, t, tg] = [a.gold, a.rice, a.troops, s.cities['wancheng']!.troops]
    s = act(s, { kind: 'transport', from: 'xuchang', to: 'wancheng', gold: 100, rice: 200, troops: 300 })
    expect(s.cities['xuchang']!.gold).toBe(g - 100)
    expect(s.cities['xuchang']!.rice).toBe(r - 200)
    expect(s.cities['xuchang']!.troops).toBe(t - 300)
    expect(s.cities['wancheng']!.troops).toBe(tg + 300)
    expect(rej(s, { kind: 'transport', from: 'xuchang', to: 'wancheng', gold: 999999, rice: 0, troops: 0 }).code).toBe('no-gold')
  })
  it('W-CRT-WAR forms an army in a faction city; troops and rice come out of the city', () => {
    let s = fresh('cao-cao', 1, (x) => { calm(x); x.pacts = []; x.cities['wancheng']!.faction = null })
    const units = W.query.suggestArmy(s, 'xuchang', 'wancheng')
    const total = units.reduce((n, u) => n + u.troops, 0)
    const t0 = s.cities['xuchang']!.troops
    const r0 = s.cities['xuchang']!.rice
    s = act(s, { kind: 'war', from: 'xuchang', to: 'wancheng', units })
    expect(s.cities['xuchang']!.troops).toBe(t0 - total)
    expect(s.cities['xuchang']!.rice).toBe(r0 - Math.ceil(total / 100) * 2)
    expect(s.officers[units[0]!.officer]!.status).toBe('army')
    expect(W.invariants(s)).toEqual([])
    expect(rej(s, { kind: 'war', from: 'xuchang', to: 'xuchang', units: [] }).code).toBe('bad-target')
  })
  it('W-CRT-DIPLO the ruler sends an envoy; chance comes from the diplomacy formula', () => {
    const s = fresh('cao-cao', 1, calm)
    s.pacts = []
    const a = { kind: 'diplomacy' as const, envoy: 'cao-cao', faction: 'f-dong-zhuo', proposal: 'truce' as const, mode: 'roll' as const }
    expect(W.query.chanceOf(s, a)!.pct).toBeGreaterThanOrEqual(5)
    const done = tryRolls(s, a, (n) => n.pacts.some((p) => p.kind === 'truce'))
    expect(done.officers['cao-cao']!.days).toBe(25)
    expect(rej(fresh('xiahou-dun', 1, calm), { ...a, envoy: 'xiahou-dun' }).code).toBe('not-legal')
  })
  it('W-CRT-CAPTIVE recruit, release or execute a captive held in a faction city', () => {
    const mk = () => fresh('cao-cao', 1, (x) => { calm(x); const o = x.officers['lu-bu']!; o.status = 'captive'; o.city = 'xuchang'; o.faction = 'f-dong-zhuo'; o.post = 'officer' })
    let s = act(mk(), { kind: 'captive', officer: 'lu-bu', decision: 'release' })
    expect(s.officers['lu-bu']!.status).toBe('active')
    expect(s.officers['lu-bu']!.post).toBe('wanderer')
    s = mk()
    s.officers['xun-yu']!.loyalty = 90
    s = act(s, { kind: 'captive', officer: 'lu-bu', decision: 'execute' })
    expect(s.officers['lu-bu']!.status).toBe('dead')
    expect(s.officers['xun-yu']!.loyalty).toBe(85) // righteous -5
    const r = tryRolls(mk(), { kind: 'captive', officer: 'lu-bu', decision: 'recruit' }, (n) => n.officers['lu-bu']!.faction === 'f-cao-cao')
    expect(r.officers['lu-bu']!.status).toBe('active')
  })
  it('W-CRT-FOCUS a ruler or prefect sets the city focus', () => {
    const s = act(fresh('xun-yu', 1, calm), { kind: 'focus', city: 'xuchang', focus: 'farm' })
    expect(s.cities['xuchang']!.focus).toBe('farm')
    expect(rej(fresh('xiahou-dun', 1, calm), { kind: 'focus', city: 'xuchang', focus: 'farm' }).code).toBe('not-legal')
  })
})

describe('W-MIS and W-PROP', () => {
  it('W-MIS-1 a develop mission counts work actions of that kind in that city and ends on success', () => {
    let s = fresh('xun-yu', 1, calm)
    s.officers['xun-yu']!.mission = { kind: 'develop', city: 'xuchang', work: 'farm', count: 2, done: 0, deadline: { year: 190, month: 1 } }
    s = act(s, { kind: 'work', work: 'farm' })
    expect(s.officers['xun-yu']!.mission).toMatchObject({ done: 1 })
    s = act(s, { kind: 'work', work: 'farm' })
    expect(s.officers['xun-yu']!.mission).toBeNull()
  })
  it('W-MIS-1 a scout mission needs a month end in the city and a month end back home', () => {
    let s = fresh('xun-yu', 1, calm)
    s.officers['xun-yu']!.mission = { kind: 'scout', city: 'wancheng', reached: false, deadline: { year: 190, month: 2 } }
    s.cities['wancheng']!.faction = 'f-dong-zhuo' // foreign
    s = act(s, { kind: 'travel', to: 'wancheng' })
    s = endMonth(s, true)
    expect(s.officers['xun-yu']!.mission).toMatchObject({ reached: true })
    s.cities['wancheng']!.faction = 'f-cao-cao'
    s = act(s, { kind: 'travel', to: 'xuchang' })
    const m0 = s.officers['xun-yu']!.merit
    s = endMonth(s, true)
    expect(s.officers['xun-yu']!.mission).toBeNull()
    expect(s.officers['xun-yu']!.merit).toBe(m0 + 150)
  })
  it('W-MIS-2 failing a deadline costs 50 merit and 5 friendship with the ruler', () => {
    let s = fresh('xun-yu', 1, calm)
    s.officers['xun-yu']!.mission = { kind: 'develop', city: 'xuchang', work: 'farm', count: 2, done: 0, deadline: { year: 190, month: 1 } }
    s.friendships['cao-cao|xun-yu'] = 50
    const m0 = s.officers['xun-yu']!.merit
    s = endMonth(s, true)
    expect(s.officers['xun-yu']!.merit).toBe(m0 - 50)
    expect(s.friendships['cao-cao|xun-yu']).toBeLessThanOrEqual(45)
  })
  it('W-MIS-2 success pays merit (develop +100) and +3 friendship with the ruler', () => {
    let s = fresh('xun-yu', 1, calm)
    s.officers['xun-yu']!.mission = { kind: 'develop', city: 'xuchang', work: 'order', count: 1, done: 0, deadline: { year: 190, month: 1 } }
    s.cities['xuchang']!.order = 50
    s.friendships['cao-cao|xun-yu'] = 50
    const m0 = s.officers['xun-yu']!.merit
    s = act(s, { kind: 'work', work: 'order' })
    expect(s.officers['xun-yu']!.merit).toBe(m0 + 20 + 100)
    expect(s.friendships['cao-cao|xun-yu']).toBe(53)
  })
  it('W-MIS-3 an officer holds at most one mission', () => {
    let s = fresh('cao-cao', 1, calm)
    const m = { kind: 'scout' as const, city: 'ye', reached: false, deadline: { year: 190, month: 1 } }
    s = act(s, { kind: 'mission', officer: 'cao-ren', mission: m })
    expect(rej(s, { kind: 'mission', officer: 'cao-ren', mission: m }).code).toBe('not-legal')
  })
  it('W-PROP-1 an officer proposes to the ruler; approval for war creates the army with the proposer as commander', () => {
    let s = fresh('xiahou-dun', 1, (x) => { calm(x); x.pacts = []; x.cities['wancheng']!.faction = null })
    const a = { kind: 'propose' as const, proposal: 'war' as const, to: 'wancheng' }
    const pct = W.query.chanceOf(s, a)!.pct
    expect(pct).toBe(Math.min(95, 30 + Math.floor(90 / 2) + 5 * 2 + 20))
    s = tryRolls(s, a, (n) => n.armies.length === 1)
    expect(s.armies[0]!.units.find((u) => u.commander)!.officer).toBe('xiahou-dun')
    expect(rej(s, a).code).toBe('not-legal') // once per month
  })
  it('W-PROP-1 prefect proposal makes the proposer prefect on approval', () => {
    let s = fresh('xiahou-dun', 1, calm)
    s = tryRolls(s, { kind: 'propose', proposal: 'prefect' }, (n) => n.cities['xuchang']!.prefect === 'xiahou-dun')
    expect(s.officers['xiahou-dun']!.post).toBe('prefect')
  })
})

describe('W-WAR', () => {
  const setup = (defTroops = 1000) => fresh('cao-cao', 1, (x) => {
    calm(x); x.pacts = []
    x.cities['wancheng']!.faction = 'f-dong-zhuo'; x.cities['wancheng']!.troops = defTroops
    x.officers['li-jue']!.city = 'wancheng'
  })
  const unitsOf = (s: ReturnType<typeof setup>) => [{ officer: 'xiahou-dun', troops: 3500, type: 'spear' as const, commander: true }, { officer: 'xiahou-yuan', troops: 3500, type: 'archer' as const, commander: false }].filter((u) => s.officers[u.officer]!.city === 'xuchang')
  it('W-WAR-1 army rules: 1-5 units, rank cap, one commander, troops and rice from the city', () => {
    const s = setup()
    expect(rej(s, { kind: 'war', from: 'xuchang', to: 'wancheng', units: [] }).code).toBe('bad-target')
    expect(rej(s, { kind: 'war', from: 'xuchang', to: 'wancheng', units: [{ officer: 'cao-ren', troops: 9000, type: 'spear', commander: true }] }).code).toBe('bad-target')
    expect(rej(s, { kind: 'war', from: 'xuchang', to: 'wancheng', units: [{ officer: 'cao-ren', troops: 1000, type: 'spear', commander: false }] }).code).toBe('bad-target')
  })
  it('W-WAR-2 cannot attack an ally, a truce partner or an own city', () => {
    const s = setup()
    s.pacts.push({ a: 'f-cao-cao', b: 'f-dong-zhuo', kind: 'truce', until: { year: 191, month: 1 } })
    expect(rej(s, { kind: 'war', from: 'xuchang', to: 'wancheng', units: unitsOf(s) }).code).toBe('bad-target')
  })
  it('W-WAR-3 and W-WAR-5 a battle without the player auto-resolves at month end with a garrison when no officers defend', () => {
    let s = setup(2000)
    s.officers['li-jue']!.city = 'changan'
    s = act(s, { kind: 'war', from: 'xuchang', to: 'wancheng', units: unitsOf(s) })
    s = endMonth(s, true)
    expect(s.armies.some((a) => a.to === 'wancheng' && a.units.some((u) => u.officer === 'xiahou-dun'))).toBe(false)
    expect(s.log.some((e) => e.kind === 'battle')).toBe(true)
    expect(W.invariants(s)).toEqual([])
  })
  it('W-WAR-4 the player\'s army is played: a battle pending with a setup the client can run', () => {
    let s = setup()
    s = act(s, { kind: 'war', from: 'xuchang', to: 'wancheng', units: [{ officer: 'cao-cao', troops: 1000, type: 'cavalry', commander: true }, ...unitsOf(s).map((u) => ({ ...u, commander: false }))] })
    s = act(s, { kind: 'endMonth' })
    const p = s.pending[0]! as Extract<typeof s.pending[0], { kind: 'battle' }>
    expect(p.kind).toBe('battle')
    expect(p.setup.terrain).toBe('hills')
    expect(p.setup.playerControls).toContain('cao-cao')
    expect(p.setup.id).toMatch(/^190-01-a\d+$/)
    expect(p.setup.units.some((u) => u.side === 'defender')).toBe(true)
  })
  it('W-WAR-4 a defending player ruler picks defenders (chooseDefenders) before the battle', () => {
    let s = fresh('li-jue', 1, (x) => { calm(x); x.pacts = []; x.cities['wancheng']!.faction = 'f-dong-zhuo'; x.cities['wancheng']!.troops = 3000; x.officers['li-jue']!.city = 'wancheng'; x.officers['dong-zhuo']!.city = 'wancheng'; x.cities['wancheng']!.prefect = 'li-jue'; x.officers['li-jue']!.post = 'prefect' })
    s.armies.push({ id: 'a900', faction: 'f-cao-cao', from: 'xuchang', to: 'wancheng', rice: 100, units: [{ officer: 'xiahou-dun', troops: 5000, type: 'spear', commander: true }] })
    s.officers['xiahou-dun']!.status = 'army'
    s = act(s, { kind: 'endMonth' })
    expect(s.pending[0]!.kind).toBe('chooseDefenders')
    expect(rej(s, { kind: 'setDefenders', pending: s.pending[0]!.id, officers: ['cao-cao'] }).code).toBe('bad-target')
    s = act(s, { kind: 'setDefenders', pending: s.pending[0]!.id, officers: ['li-jue'] })
    expect(s.pending[0]!.kind).toBe('battle')
  })
  it('W-WAR-5 auto-resolve outcome matches the formula: strong attacker wins and the loser loses 50%+ of troops', () => {
    let s = setup(100)
    s.cities['wancheng']!.troops = 100
    s.officers['li-jue']!.city = 'changan'
    s = act(s, { kind: 'war', from: 'xuchang', to: 'wancheng', units: unitsOf(s) })
    s = endMonth(s, true)
    expect(s.cities['wancheng']!.faction).toBe('f-cao-cao')
    expect(s.cities['wancheng']!.troops).toBeGreaterThan(0)
  })
  it('W-WAR-6 merit: winners +150, the winning commander +300 more, losers +30', () => {
    let s = setup(100)
    s.officers['li-jue']!.city = 'wancheng'
    const m0 = J(s.officers)
    s = act(s, { kind: 'war', from: 'xuchang', to: 'wancheng', units: unitsOf(s) })
    s = endMonth(s, true)
    const d = (id: string) => s.officers[id]!.merit - m0[id]!.merit
    expect(d('xiahou-dun')).toBe(450)
    expect(d('xiahou-yuan')).toBe(150)
  })
  it('W-WAR-7 attacker wins: city passes, commander becomes prefect, 50% gold and rice kept, order -20', () => {
    let s = setup(100)
    s.officers['li-jue']!.city = 'changan'
    s.cities['wancheng']!.gold = 400
    s.cities['wancheng']!.order = 50
    s = act(s, { kind: 'war', from: 'xuchang', to: 'wancheng', units: unitsOf(s) })
    s = endMonth(s, true)
    const c = s.cities['wancheng']!
    expect(c.faction).toBe('f-cao-cao')
    expect(c.prefect).toBe('xiahou-dun')
    expect(c.gold).toBeLessThanOrEqual(200 + 1)
  })
  it('W-WAR-7 defender wins: the attackers return to the source city', () => {
    let s = setup(9000)
    s.cities['wancheng']!.walls = 500
    s.officers['li-jue']!.city = 'wancheng'
    s.officers['li-jue']!.stats = { war: 100, ldr: 100, int: 50, pol: 50, cha: 50 }
    s = act(s, { kind: 'war', from: 'xuchang', to: 'wancheng', units: [{ officer: 'cao-ren', troops: 3000, type: 'spear', commander: true }] })
    s = endMonth(s, true)
    expect(s.cities['wancheng']!.faction).toBe('f-dong-zhuo')
    expect(s.officers['cao-ren']!.status === 'active' || s.officers['cao-ren']!.status === 'captive').toBe(true)
    if (s.officers['cao-ren']!.status === 'active') expect(s.officers['cao-ren']!.city).toBe('xuchang')
  })
  it('W-WAR-8 retreat goes to the nearest faction city; with none the officer is captured', () => {
    let s = setup(100)
    s.cities['wancheng']!.troops = 100
    s.officers['li-jue']!.city = 'wancheng'
    s = act(s, { kind: 'war', from: 'xuchang', to: 'wancheng', units: unitsOf(s) })
    s = endMonth(s, true)
    const lj = s.officers['li-jue']!
    if (lj.status === 'active') expect(['luoyang', 'changan']).toContain(lj.city)
    else expect(lj.status).toBe('captive')
    expect(W.invariants(s)).toEqual([])
  })
  it('W-WAR-9 a faction with no cities is destroyed and its officers become wanderers', () => {
    let s = fresh('cao-cao', 1, (x) => { calm(x); x.pacts = []; x.cities['luoyang']!.faction = 'f-cao-cao'; x.cities['luoyang']!.troops = 10; x.cities['luoyang']!.prefect = null; for (const id of ['dong-zhuo', 'lu-bu', 'li-ru', 'diaochan']) x.officers[id]!.city = 'changan'; x.cities['luoyang']!.faction = 'f-cao-cao' })
    s.cities['changan']!.troops = 10
    s.cities['changan']!.walls = 0
    s.armies.push({ id: 'a901', faction: 'f-cao-cao', from: 'xuchang', to: 'changan', rice: 100, units: [{ officer: 'xiahou-dun', troops: 5000, type: 'cavalry', commander: true }] })
    s.officers['xiahou-dun']!.status = 'army'
    // Luoyang and Changan are not adjacent to xuchang; make a road-free direct hop via luoyang: use luoyang->changan
    s.armies[0]!.from = 'luoyang'
    s = endMonth(s, true)
    if (!s.factions['f-dong-zhuo']!.alive) expect(s.officers['li-ru']!.post === 'wanderer' || s.officers['li-ru']!.status === 'captive').toBe(true)
    expect(W.invariants(s)).toEqual([])
  })
  it('bad-outcome: a battle outcome that does not fit its setup is rejected', () => {
    let s = setup()
    s = act(s, { kind: 'war', from: 'xuchang', to: 'wancheng', units: [{ officer: 'cao-cao', troops: 6000, type: 'cavalry', commander: true }] })
    s = act(s, { kind: 'endMonth' })
    const p = s.pending[0]! as Extract<typeof s.pending[0], { kind: 'battle' }>
    const good = W.auto.battle(s, p.setup)
    const bad: BattleOutcome = { ...good, battleId: 'nope' }
    expect(rej(s, { kind: 'resolveBattle', pending: p.id, outcome: bad }).code).toBe('bad-outcome')
    const bad2: BattleOutcome = { ...good, units: good.units.map((u) => ({ ...u, troopsEnd: u.troopsStart + 1 })) }
    expect(rej(s, { kind: 'resolveBattle', pending: p.id, outcome: bad2 }).code).toBe('bad-outcome')
    const n = act(s, { kind: 'resolveBattle', pending: p.id, outcome: good })
    expect(n.armies.some((a) => a.id === p.armyId)).toBe(false)
    void clear
  })
})
