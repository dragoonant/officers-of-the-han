import { describe, expect, it } from 'vitest'
import { W, J, act, rej, fresh, calm, endMonth, tryRolls, clear } from './helpers'

const wander = (s: ReturnType<typeof fresh>, id: string, city: string): void => { const o = s.officers[id]!; o.faction = null; o.post = 'wanderer'; o.loyalty = null; o.city = city; if (s.cities[city]!.prefect === id) s.cities[city]!.prefect = null }

describe('W-ACT', () => {
  it('W-ACT-TRAVEL a wanderer may go anywhere; a ruler only to own cities', () => {
    let s = fresh('liu-bei', 1, calm)
    s = act(s, { kind: 'travel', to: 'xuchang' })
    expect(s.officers['liu-bei']!.city).toBe('xuchang')
    const t = fresh('cao-cao', 1, calm)
    expect(rej(t, { kind: 'travel', to: 'luoyang' }).code).toBe('not-legal')
  })
  it('W-ACT-VISIT raises friendship by 3 + CHA/25 + compatibility, once per pair per month', () => {
    let s = fresh('xun-yu', 1, calm)
    s.friendships['cao-ren|xun-yu'] = 20
    s = act(s, { kind: 'visit', officer: 'cao-ren' })
    expect(s.friendships['cao-ren|xun-yu']).toBe(20 + 3 + 3 + 0) // CHA 75 / 25 = 3, righteous-steady 0
    expect(s.officers['xun-yu']!.days).toBe(25)
    expect(rej(s, { kind: 'visit', officer: 'cao-ren' }).code).toBe('not-legal')
  })
  it('W-ACT-BANQUET 100 gold from the purse; guests +2 + CHA/40 friendship; ruler hosts raise loyalty by 1', () => {
    let s = fresh('cao-cao', 1, calm)
    s.officers['cao-cao']!.gold = 300
    s.officers['xiahou-dun']!.loyalty = 50
    s.friendships['cao-cao|xiahou-yuan'] = 20
    s = act(s, { kind: 'banquet' })
    expect(s.officers['cao-cao']!.gold).toBe(200)
    expect(s.friendships['cao-cao|xiahou-yuan']).toBe(20 + 2 + Math.floor(85 / 40))
    expect(s.officers['xiahou-dun']!.loyalty).toBe(51)
    s.officers['cao-cao']!.gold = 50
    s.officers['cao-cao']!.days = 30
    expect(rej(s, { kind: 'banquet' }).code).toBe('no-gold')
  })
  it('W-ACT-GIFT friendship += min(10, g/25); a ruler\'s reward raises loyalty by g/20', () => {
    let s = fresh('xun-yu', 1, calm)
    s.officers['xun-yu']!.gold = 500
    s.friendships['cao-ren|xun-yu'] = 20
    s = act(s, { kind: 'gift', officer: 'cao-ren', gold: 100 })
    expect(s.friendships['cao-ren|xun-yu']).toBe(24)
    expect(s.officers['cao-ren']!.gold).toBe(200)
    expect(rej(s, { kind: 'gift', officer: 'cao-ren', gold: 10 }).code).toBe('bad-target')
    let r = fresh('cao-cao', 1, calm)
    r.officers['cao-ren']!.loyalty = 50
    const cg = r.cities['xuchang']!.gold
    r = act(r, { kind: 'gift', officer: 'cao-ren', gold: 100, fromCity: true })
    expect(r.officers['cao-ren']!.loyalty).toBe(55)
    expect(r.cities['xuchang']!.gold).toBe(cg - 100)
  })
  it('W-ACT-SEARCH finds the hidden officer (lowest id) as a wanderer, else maybe gold', () => {
    const s = fresh('liu-bei', 1, calm)
    const found = tryRolls(s, { kind: 'search' }, (n) => !n.officers['zhuge-liang']!.hidden)
    expect(found.officers['zhuge-liang']!.post).toBe('wanderer')
    expect(found.officers['zhuge-liang']!.city).toBe('wancheng')
    expect(found.officers['liu-bei']!.merit).toBe(810)
    expect(W.query.chanceOf(s, { kind: 'search' })!.pct).toBe(30 + 37)
    const g = fresh('xun-yu', 1, calm)
    const gold = tryRolls(g, { kind: 'search' }, (n) => n.officers['xun-yu']!.gold > g.officers['xun-yu']!.gold)
    expect(gold.officers['xun-yu']!.gold).toBe(g.officers['xun-yu']!.gold + 20 + Math.floor(95 / 2))
  })
  it('W-ACT-STUDY and W-ACT-DRILL give 30 xp for 15 days', () => {
    let s = fresh('xiahou-dun', 1, calm)
    s = act(s, { kind: 'drill', stat: 'war' })
    expect(s.officers['xiahou-dun']!.xp.war).toBe(30)
    expect(s.officers['xiahou-dun']!.days).toBe(15)
    s = act(s, { kind: 'study', stat: 'pol' })
    expect(s.officers['xiahou-dun']!.xp.pol).toBe(30)
  })
  it('W-ACT-REST gives +20 health for 10 days', () => {
    let s = fresh('xiahou-dun', 1, calm)
    s.officers['xiahou-dun']!.health = 50
    s = act(s, { kind: 'rest' })
    expect(s.officers['xiahou-dun']!.health).toBe(70)
    expect(s.officers['xiahou-dun']!.days).toBe(20)
  })
  it('W-ACT-RECRUIT chance clamp(20 + CHA/2 + friendship/2 (-30 with a rival in the house)); success gives +100 merit and loyalty 60 + friendship/4', () => {
    let s = fresh('cao-cao', 1, calm)
    s.officers['liu-bei']!.city = 'xuchang'
    s.friendships['cao-cao|liu-bei'] = 40
    const c = W.query.chanceOf(s, { kind: 'recruit', officer: 'liu-bei', mode: 'persuade' })!.pct
    expect(c).toBe(20 + 42 + 20)
    const ok = tryRolls(s, { kind: 'recruit', officer: 'liu-bei', mode: 'persuade' }, (n) => n.officers['liu-bei']!.faction === 'f-cao-cao')
    expect(ok.officers['liu-bei']!.loyalty).toBe(70)
    expect(ok.officers['liu-bei']!.post).toBe('officer')
    expect(ok.officers['cao-cao']!.merit).toBe(9100)
    const bad = tryRolls(s, { kind: 'recruit', officer: 'liu-bei', mode: 'persuade' }, (n) => n.officers['liu-bei']!.faction === null)
    expect(bad.officers['liu-bei']!.post).toBe('wanderer')
  })
  it('W-ACT-RECRUIT by debate opens a debate pending; a win joins, a loss costs 5 friendship', () => {
    let s = fresh('cao-cao', 1, calm)
    s.officers['liu-bei']!.city = 'xuchang'
    s.friendships['cao-cao|liu-bei'] = 40
    s = act(s, { kind: 'recruit', officer: 'liu-bei', mode: 'debate' })
    expect(s.pending[0]!.kind).toBe('debate')
    const p = s.pending[0]! as Extract<typeof s.pending[0], { kind: 'debate' }>
    const won = act(s, { kind: 'resolveDebate', pending: p.id, outcome: { debateId: p.setup.id, winner: 'a', rounds: 3, composureLeft: { a: 10, b: 0 } } })
    expect(won.officers['liu-bei']!.faction).toBe('f-cao-cao')
    const lost = act(s, { kind: 'resolveDebate', pending: p.id, outcome: { debateId: p.setup.id, winner: 'b', rounds: 3, composureLeft: { a: 0, b: 10 } } })
    expect(lost.friendships['cao-cao|liu-bei']).toBe(35)
    expect(rej(s, { kind: 'resolveDebate', pending: p.id, outcome: { debateId: 'wrong', winner: 'a', rounds: 1, composureLeft: { a: 1, b: 1 } } }).code).toBe('bad-outcome')
  })
  it('W-ACT-SERVE chance clamp(30 + (statSum-250)/3 + friendship/2 + 20 if the house is small)', () => {
    const s = fresh('liu-bei', 1, calm)
    s.officers['liu-bei']!.city = 'xuchang'
    s.friendships['cao-cao|liu-bei'] = 40
    const sum = 75 + 78 + 74 + 75 + 99
    expect(W.query.chanceOf(s, { kind: 'serve' })!.pct).toBe(Math.min(95, 30 + Math.floor((sum - 250) / 3) + 20))
    const joined = tryRolls(s, { kind: 'serve' }, (n) => n.officers['liu-bei']!.faction === 'f-cao-cao')
    expect(joined.officers['liu-bei']!.loyalty).toBe(70)
  })
  it('W-ACT-RESIGN becomes a wanderer, friendship with the ruler -20, sworn siblings follow', () => {
    let s = fresh('liu-bei', 1, calm)
    // put the oath trio into Cao Cao's house in xuchang
    for (const id of ['liu-bei', 'guan-yu', 'zhang-fei']) { const o = s.officers[id]!; o.faction = 'f-cao-cao'; o.post = 'officer'; o.loyalty = 40; o.city = 'xuchang' }
    s.friendships['cao-cao|liu-bei'] = 50
    s = act(s, { kind: 'resign' })
    expect(s.officers['liu-bei']!.post).toBe('wanderer')
    expect(s.friendships['cao-cao|liu-bei']).toBe(30)
    expect(s.officers['guan-yu']!.faction).toBeNull()
    expect(s.officers['zhang-fei']!.faction).toBeNull()
    expect(W.invariants(s)).toEqual([])
  })
  it('W-ACT-DUEL AI accepts if WAR >= challenger WAR - 10 or reckless; winner +50 merit; loser -5 friendship', () => {
    let s = fresh('xiahou-dun', 1, calm)
    s.officers['xun-yu']!.city = 'xuchang'
    const before = J(s)
    s = act(s, { kind: 'challenge', officer: 'xun-yu' }) // WAR 25 < 92-10, steady/righteous: declines
    expect(s.pending.length).toBe(0)
    expect(s.officers['xiahou-dun']!.days).toBe(25)
    expect(W.query.chanceOf(before, { kind: 'challenge', officer: 'xun-yu' })!.pct).toBe(0)
    let t = fresh('xiahou-dun', 1, calm)
    t = act(t, { kind: 'challenge', officer: 'xiahou-yuan' }) // WAR 90 >= 82
    expect(t.pending[0]!.kind).toBe('duel')
    const p = t.pending[0]! as Extract<typeof t.pending[0], { kind: 'duel' }>
    t.friendships['xiahou-dun|xiahou-yuan'] = 40
    const done = act(t, { kind: 'resolveDuel', pending: p.id, outcome: { duelId: p.setup.id, winner: 'a', how: 'knockout', rounds: 4, vigorLeft: { a: 10, b: 0 } } })
    expect(done.officers['xiahou-dun']!.merit).toBe(4050)
    expect(done.friendships['xiahou-dun|xiahou-yuan']).toBe(35)
    expect(rej(fresh('xiahou-dun', 1, calm), { kind: 'challenge', officer: 'cao-cao' }).code).toBe('not-legal')
  })
  it('W-ACT-OATH needs friendship 80, no rivalry; AI accepts when compatibility >= 0', () => {
    let s = fresh('xiahou-dun', 1, calm)
    expect(rej(s, { kind: 'oath', officer: 'cao-ren' }).code).toBe('not-legal')
    s.friendships['cao-ren|xiahou-dun'] = 85
    s = act(s, { kind: 'oath', officer: 'cao-ren' })
    expect(s.officers['cao-ren']!.oathGroup).toBe(s.officers['xiahou-dun']!.oathGroup)
    expect(s.officers['xiahou-dun']!.days).toBe(29)
  })
  it('W-ACT-MARRY needs friendship 70, both unmarried adults; AI accepts with chance 40 + (f-70)*2 + 10*compat', () => {
    const s = fresh('xiahou-dun', 1, calm)
    s.friendships['xiahou-dun|xiahou-yuan'] = 80
    expect(W.query.chanceOf(s, { kind: 'marry', officer: 'xiahou-yuan' })!.pct).toBe(40 + 20 + 0)
    const m = tryRolls(s, { kind: 'marry', officer: 'xiahou-yuan' }, (n) => n.officers['xiahou-dun']!.spouse === 'xiahou-yuan')
    expect(m.officers['xiahou-yuan']!.spouse).toBe('xiahou-dun')
    expect(rej(fresh('xiahou-dun', 1, calm), { kind: 'marry', officer: 'xiahou-yuan' }).code).toBe('not-legal')
  })
  it('W-ACT-CLAIM a wanderer with a companion founds a faction in a vacant city', () => {
    let s = fresh('liu-bei', 1, calm)
    s.cities['wancheng']!.faction = null
    s = act(s, { kind: 'claim' })
    const fid = s.officers['liu-bei']!.faction!
    expect(s.factions[fid]!.ruler).toBe('liu-bei')
    expect(s.cities['wancheng']!.faction).toBe(fid)
    expect(s.officers['guan-yu']!.faction).toBe(fid)
    expect(W.invariants(s)).toEqual([])
    expect(rej(fresh('liu-bei', 1, (x) => { calm(x); x.cities['wancheng']!.faction = null; x.officers['guan-yu']!.city = 'xuchang'; x.officers['zhang-fei']!.city = 'xuchang' }), { kind: 'claim' }).code).toBe('not-legal')
  })
  it('W-ACT-UPRISE a wanderer in a city with order below 60 raises rebels who fight the garrison at month end', () => {
    let s = fresh('liu-bei', 1, calm)
    s.cities['wancheng']!.faction = 'f-cao-cao'
    s.cities['wancheng']!.order = 30
    s.cities['wancheng']!.troops = 100
    s = act(s, { kind: 'uprise' })
    expect(s.armies.length).toBe(1)
    expect(s.armies[0]!.faction).toBeNull()
    expect(s.armies[0]!.units[0]!.troops).toBe(300 + 99 * 5)
    s = endMonth(s, true)
    expect(s.officers['liu-bei']!.faction).not.toBeNull()
    expect(W.invariants(s)).toEqual([])
    const t = fresh('liu-bei', 1, (x) => { calm(x); x.cities['wancheng']!.faction = 'f-cao-cao'; x.cities['wancheng']!.order = 80 })
    expect(rej(t, { kind: 'uprise' }).code).toBe('not-legal')
  })
})
void clear
