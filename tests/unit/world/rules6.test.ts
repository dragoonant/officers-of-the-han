import { describe, expect, it } from 'vitest'
import { W, J, act, rej, fresh, calm, endMonth, clear } from './helpers'
import { MINI_OPTS, MINI_WORLD } from '../../fixtures/mini-world'
import { LOG_KIND_SET } from '../../../src/world/logkinds'
import type { WorldAction, WorldState } from '../../../src/contracts/world'
import { seedRng, nextFloat } from '../../../src/shared/rng'

describe('W-AI', () => {
  it('W-AI-1 and W-AI-3 AI officers do city work through the rules; results appear in the cities after the world turn', () => {
    let s = fresh('xiahou-dun', 1, (x) => { x.options.events = false; x.pacts = []; for (const c of Object.values(x.cities)) c.troops = 0 })
    const before = J(s.cities)
    s = endMonth(s)
    const changed = Object.keys(s.cities).filter((id) => JSON.stringify(s.cities[id]) !== JSON.stringify(before[id]))
    expect(changed.length).toBeGreaterThan(2)
    expect(W.invariants(s)).toEqual([])
  })
  it('W-AI-2 an AI ruler fills empty prefect posts at month start', () => {
    let s = fresh('xiahou-dun', 1, calm)
    s.cities['xuchang']!.prefect = null
    s.officers['xun-yu']!.post = 'officer'
    s = endMonth(s, true)
    expect(s.cities['xuchang']!.prefect).not.toBeNull()
  })
  it('W-AI-2 an AI ruler gives the player\'s officer a mission offer (60%) and attacks when P_att > 1.4 P_def', () => {
    const s = fresh('xiahou-dun', 1, (x) => { x.options.events = false; x.pacts = []; x.cities['wancheng']!.faction = null; x.cities['xuchang']!.troops = 8000 })
    let offers = 0
    let wars = 0
    for (let i = 1; i < 30; i++) {
      const t = J(s)
      t.rng = seedRng(i * 17)
      const r = W.step(t, { kind: 'endMonth' })
      if (!r.ok) continue
      if (r.state.pending.some((p) => p.kind === 'offer' && p.offer === 'mission')) offers++
      if (r.events.some((e) => e.kind === 'war' && e.text.includes('Xuchang'))) wars++
    }
    expect(offers).toBeGreaterThan(5)
    expect(wars).toBeGreaterThan(0)
  })
  it('W-AI-3 wanderers travel, ask to serve or search; they never act without days', () => {
    let s = fresh('xiahou-dun', 1, (x) => { x.options.events = false })
    const city0 = s.officers['liu-bei']!.city
    let moved = false
    for (let i = 0; i < 6; i++) { s = endMonth(s); if (s.officers['liu-bei']!.city !== city0 || s.officers['liu-bei']!.faction) moved = true }
    expect(moved).toBe(true)
  })
  it('W-AI-4 the autopilot answers every pending and keeps the sim moving', () => {
    let s = fresh('cao-cao', 1)
    for (let i = 0; i < 60; i++) { const a = W.autopilot(s); s = act(s, a) }
    expect(s.ym.year * 12 + s.ym.month).toBeGreaterThan(190 * 12 + 1)
    expect(W.invariants(s)).toEqual([])
  })
})

describe('W-NEW and W-END', () => {
  it('W-NEW-1 a created officer starts as a wanderer with 300 gold and 0 merit, stats validated', () => {
    const s = W.newGame({ scenario: '190', seed: 3, officer: { name: 'Test Hero', sex: 'f', born: 170, stats: { war: 95, ldr: 95, int: 95, pol: 95, cha: 95 }, temperament: 'steady', bestType: 'archer', city: 'ye' } })
    const id = s.player
    const o = s.officers[id]!
    expect(o.post).toBe('wanderer')
    expect(o.gold).toBe(300)
    expect(o.merit).toBe(0)
    expect(o.stats.war + o.stats.ldr + o.stats.int + o.stats.pol + o.stats.cha).toBeLessThanOrEqual(320)
    expect(o.custom!.aptitude).toEqual({ spear: 'B', cavalry: 'B', archer: 'A' })
    expect(W.query.officerView(s, id)!.name).toBe('Test Hero')
    expect(W.invariants(s)).toEqual([])
  })
  it('W-NEW-1 an existing officer who exists at the start can be played; an unborn one cannot', () => {
    expect(() => W.newGame(MINI_OPTS('cao-pi'))).toThrow()
    expect(W.newGame(MINI_OPTS('lu-bu')).player).toBe('lu-bu')
  })
  it('W-END-1 when one faction holds every city the game ends (unified / another unified)', () => {
    let s = fresh('cao-cao', 1, (x) => { calm(x); for (const c of Object.values(x.cities)) c.faction = 'f-cao-cao'; x.cities['luoyang']!.faction = 'f-dong-zhuo'; x.cities['changan']!.faction = 'f-dong-zhuo'; x.cities['ye']!.faction = 'f-dong-zhuo'; x.cities['xiapi']!.faction = 'f-dong-zhuo'; x.cities['luoyang']!.prefect = null; x.pacts = [] })
    expect(s.phase).toBe('player')
    s.armies.push({ id: 'a950', faction: 'f-cao-cao', from: 'xuchang', to: 'luoyang', rice: 10, units: [{ officer: 'xiahou-dun', troops: 100, type: 'spear', commander: true }] })
    // not adjacent-checked at resolve; make everything else Cao's by transfer of cities through an event-free path
    for (const id of ['changan', 'ye', 'xiapi']) s.cities[id]!.faction = 'f-cao-cao'
    s.officers['xiahou-dun']!.status = 'army'
    s.cities['luoyang']!.troops = 0
    s = endMonth(s, true)
    expect(s.phase).toBe('ended')
    expect(s.ended!.kind).toBe('unified')
    const t = fresh('lu-bu', 1)
    expect(t.ended).toBeNull()
  })
  it('W-END-2 the chronicle closes when the player\'s line ends (see W-DEATH-2)', () => {
    let s = fresh('hua-xiong', 1, calm)
    s.officers['hua-xiong']!.health = 0
    s = act(s, { kind: 'endMonth' })
    expect(s.ended!.kind).toBe('chronicle-closes')
  })
  it('W-END-3 the log keeps the player\'s life for the end screen', () => {
    let s = fresh('xun-yu', 1, calm)
    s = act(s, { kind: 'work', work: 'farm' })
    expect(s.log.some((e) => e.officers.includes('xun-yu') && e.kind === 'work')).toBe(true)
    expect(W.query.saveSummary(s).line).toContain('Xun Yu')
  })
})

describe('queries', () => {
  it('actionsHere groups actions with costs and reasons; can() explains', () => {
    const s = fresh('xiahou-dun', 1, calm)
    const items = W.query.actionsHere(s)
    expect(new Set(items.map((i) => i.group))).toEqual(new Set(['Work', 'People', 'Court', 'Travel', 'Self']))
    const w = items.find((i) => i.kind === 'work' && i.label === 'Farm work')!
    expect(w.days).toBe(10); expect(w.gold).toBe(20); expect(w.available).toBe(true)
    const appoint = items.find((i) => i.kind === 'appoint')!
    expect(appoint.available).toBe(false); expect(appoint.reason).toBeTruthy()
    expect(W.query.can(s, 'war').ok).toBe(false)
    expect(W.query.cityView(s, 'xuchang')!.incomeGold).toBe(Math.floor(650 * 120 / 400))
    expect(W.query.factionView(s, 'f-cao-cao')!.cities).toEqual(['wancheng', 'xuchang'])
    expect(W.query.defencePower(s, 'xuchang').power).toBeGreaterThan(0)
    expect(W.query.monthReport(s)).toBeInstanceOf(Array)
  })
})

describe('whole-engine properties', () => {
  it('replay equals live state and the state is plain JSON', () => {
    const opts = MINI_OPTS('xiahou-dun', 7)
    let s = W.newGame(opts)
    const acts: WorldAction[] = []
    for (let i = 0; i < 120 && s.phase !== 'ended'; i++) {
      const a = W.autopilot(s)
      const r = W.step(s, a)
      expect(r.ok).toBe(true)
      if (r.ok) { acts.push(a); s = r.state }
      expect(JSON.parse(JSON.stringify(s))).toEqual(s)
    }
    expect(W.replay(opts, acts)).toEqual(s)
  })
  it('step does not mutate its input', () => {
    const s = fresh('xiahou-dun', 1)
    const copy = J(s)
    W.step(s, { kind: 'endMonth' })
    W.step(s, { kind: 'work', work: 'farm' })
    expect(s).toEqual(copy)
  })
  it('legalActions is never empty and every one is accepted', () => {
    let s = W.newGame(MINI_OPTS('cao-cao', 11))
    for (let i = 0; i < 80 && s.phase !== 'ended'; i++) {
      const legal = W.legalActions(s)
      expect(legal.length).toBeGreaterThan(0)
      for (const a of legal.slice(0, 40)) expect(W.step(s, a).ok).toBe(true)
      s = act(s, legal[(i * 7) % legal.length]!)
    }
  })
  it('step never throws on 2000 garbage or random actions and rejects without changing state', () => {
    const rng = seedRng(99)
    let s = W.newGame(MINI_OPTS('xiahou-dun', 5))
    const kinds = ['ack', 'choose', 'work', 'travel', 'visit', 'war', 'gift', 'oath', 'endMonth', 'resolveBattle', 'mission', 'transport', 'diplomacy', 'propose', 'nope', 'setDefenders', 'chooseSuccessor', 'captive']
    const strs = ['xuchang', 'ye', 'cao-cao', 'p1', 'p2', '', 'zzz', 'f-cao-cao', 'lu-bu']
    const pick = <T,>(a: T[]): T => a[Math.floor(nextFloat(rng) * a.length)]!
    for (let i = 0; i < 2000; i++) {
      const g: Record<string, unknown> = { kind: pick(kinds) }
      for (const f of ['pending', 'officer', 'to', 'from', 'faction', 'envoy']) if (nextFloat(rng) < 0.6) g[f] = nextFloat(rng) < 0.1 ? 5 : pick(strs)
      g['work'] = pick(['farm', 'x', 'draft']); g['gold'] = pick([-5, 50, 1e9, 0.5]); g['option'] = pick([0, 1, 99, -1]); g['units'] = pick([[], [{ officer: 'cao-cao', troops: -4 }], 'zz'])
      g['outcome'] = pick([null, {}, { battleId: 'x' }]); g['accept'] = true; g['mode'] = 'roll'; g['proposal'] = pick(['truce', 'war', 'zz'])
      const before = JSON.stringify(s)
      const r = W.step(s, g as unknown as WorldAction)
      if (!r.ok) { expect(r.message.startsWith('internal') ? JSON.stringify(g) + r.message : '').toBe(''); expect(JSON.stringify(s)).toBe(before) }
      else if (nextFloat(rng) < 0.3) s = r.state
      if (i % 50 === 0) { const l = W.legalActions(s); const a = l[l.length - 1]!; const r2 = W.step(s, a); if (r2.ok) s = r2.state }
    }
    expect(W.invariants(s)).toEqual([])
  })
  it('a 5-year fixture sim has 0 invariant failures, no stalls, only known log kinds', () => {
    for (const seed of [1, 2, 3, 4]) {
      let s = W.newGame(MINI_OPTS(['cao-cao', 'xiahou-dun', 'liu-bei', 'lu-bu'][seed - 1]!, seed))
      let perMonth = 0
      let last = 0
      while (s.phase !== 'ended' && s.ym.year < 195) {
        const a = W.autopilot(s)
        const r = W.step(s, a)
        expect(r.ok).toBe(true)
        if (!r.ok) break
        s = r.state
        for (const e of r.events) expect(LOG_KIND_SET.has(e.kind)).toBe(true)
        expect(W.invariants(s)).toEqual([])
        const m = s.ym.year * 12 + s.ym.month
        if (m !== last) { last = m; perMonth = 0 } else expect(++perMonth).toBeLessThan(400)
      }
    }
  })
})
void MINI_WORLD; void clear; void rej
