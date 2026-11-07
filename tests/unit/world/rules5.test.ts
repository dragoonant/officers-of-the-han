import { describe, expect, it } from 'vitest'
import type { WorldState } from '../../../src/contracts/world'
import { W, J, act, rej, fresh, calm, endMonth, tryRolls, clear } from './helpers'
import { MINI_WORLD, MINI_OPTS } from '../../fixtures/mini-world'
import { LOG_KIND_SET, LOG_KINDS } from '../../../src/world/logkinds'

describe('W-CAP', () => {
  const captive = (x: ReturnType<typeof fresh>, id = 'lu-bu') => { const o = x.officers[id]!; o.status = 'captive'; o.city = 'xuchang'; o.faction = 'f-dong-zhuo'; o.post = 'officer'; o.loyalty = 40 }
  it('W-CAP-1 a captive takes no actions and is not paid', () => {
    let s = fresh('cao-cao', 1, (x) => { calm(x); captive(x) })
    const g = s.officers['lu-bu']!.gold
    s = endMonth(s, true)
    expect(s.officers['lu-bu']!.gold).toBe(g)
    expect(rej({ ...s, player: 'lu-bu' }, { kind: 'rest' }).code).toBe('not-legal')
  })
  it('W-CAP-2 recruit chance clamp(30 + CHA_ruler/2 - loyalty_old/2 + friendship/2, 5, 90), 0 if bound', () => {
    const s = fresh('cao-cao', 1, (x) => { calm(x); captive(x); x.friendships['cao-cao|lu-bu'] = 40 })
    expect(W.query.chanceOf(s, { kind: 'captive', officer: 'lu-bu', decision: 'recruit' })!.pct).toBe(30 + 42 - 20 + 20)
    const b = fresh('cao-cao', 1, (x) => { calm(x); captive(x, 'cao-ren') ; x.officers['cao-ren']!.faction = 'f-cao-cao' })
    expect(W.query.chanceOf(b, { kind: 'captive', officer: 'cao-ren', decision: 'recruit' })!.pct).toBe(0)
  })
  it('W-CAP-3 at month start an AI ruler recruits, releases or executes captives; never the player', () => {
    let s = fresh('cao-cao', 1, (x) => { calm(x); x.cities['wancheng']!.faction = 'f-yuan-shao'; x.officers['lu-bu']!.status = 'captive'; x.officers['lu-bu']!.city = 'wancheng'; x.officers['lu-bu']!.faction = 'f-dong-zhuo'; x.officers['lu-bu']!.post = 'officer' })
    s.officers['yuan-shao']!.city = 'wancheng'
    s = endMonth(s, true)
    expect(s.officers['lu-bu']!.status).not.toBe('captive')
    // the player captive: a captured pending, never executed
    let p = fresh('lu-bu', 1, (x) => { calm(x); x.cities['wancheng']!.faction = 'f-yuan-shao'; const o = x.officers['lu-bu']!; o.status = 'captive'; o.city = 'wancheng'; o.post = 'officer' })
    p = act(p, { kind: 'endMonth' })
    expect(p.pending[0]!.kind).toBe('captured')
    p = act(p, { kind: 'answerCaptured', pending: p.pending[0]!.id, join: false })
    expect(p.officers['lu-bu']!.status).not.toBe('dead')
  })
})

describe('W-DEATH', () => {
  it('W-DEATH-1 an officer with a death year dies in that year at the drawn month; lifespans can be switched off', () => {
    let s = W.newGame({ ...MINI_OPTS('xiahou-dun'), options: { events: false } })
    s.pending = []
    expect(s.officers['dong-zhuo']!.deathYM!.year).toBe(192)
    const dm = s.officers['dong-zhuo']!.deathYM!
    for (let g = 0; g < 80 && s.officers['dong-zhuo']!.status !== 'dead'; g++) { s = endMonth(s) }
    expect(s.officers['dong-zhuo']!.status).toBe('dead')
    expect(s.ym.year * 12 + s.ym.month).toBeGreaterThanOrEqual(dm.year * 12 + dm.month)
    const off = W.newGame({ ...MINI_OPTS('xiahou-dun'), options: { lifespans: false } })
    expect(off.officers['dong-zhuo']!.deathYM).toBeNull()
  })
  it('W-DEATH-1 an officer without a death year dies after reaching age 75', () => {
    const s = W.newGame(MINI_OPTS('xiahou-dun'))
    expect(s.officers['xun-yu']!.deathYM!.year).toBe(163 + 75)
  })
  it('W-DEATH-2 when the player dies they choose a successor among kin, oath siblings or close friends; none ends the game', () => {
    let s = fresh('xiahou-dun', 1, calm)
    s.officers['xiahou-dun']!.health = 0
    s.friendships['cao-ren|xiahou-dun'] = 75
    s = act(s, { kind: 'endMonth' })
    expect(s.pending[0]!.kind).toBe('chooseSuccessor')
    const cands = (s.pending[0] as { candidates: string[] }).candidates
    expect(cands).toContain('cao-ren')
    s = act(s, { kind: 'chooseSuccessor', pending: s.pending[0]!.id, officer: 'cao-ren' })
    s = clear(s)
    expect(s.player).toBe('cao-ren')
    expect(s.phase).toBe('player')
    let e = fresh('hua-xiong', 1, calm)
    for (const id of Object.keys(e.friendships)) delete e.friendships[id]
    e.officers['hua-xiong']!.health = 0
    e = act(e, { kind: 'endMonth' })
    expect(e.phase).toBe('ended')
    expect(e.ended!.kind).toBe('chronicle-closes')
    expect(rej(e, { kind: 'endMonth' }).code).toBe('ended')
    expect(W.legalActions(e)).toEqual([])
  })
  it('W-DEATH-3 ruler succession: adult child, else oath sibling, else most merit; officers lose 10 loyalty', () => {
    let s = fresh('xiahou-dun', 1, calm)
    s.officers['cao-pi']!.status = 'active'; s.officers['cao-pi']!.city = 'xuchang'; s.officers['cao-pi']!.faction = 'f-cao-cao'; s.officers['cao-pi']!.post = 'officer'; s.officers['cao-pi']!.loyalty = 80
    s.ym.year = 205 // cao-pi is 18
    s.officers['cao-cao']!.health = 0
    s.officers['xiahou-yuan']!.loyalty = 90
    s = endMonth(s, true)
    expect(s.factions['f-cao-cao']!.ruler).toBe('cao-pi')
    expect(s.officers['cao-pi']!.post).toBe('ruler')
    expect(s.officers['xiahou-yuan']!.loyalty!).toBeLessThanOrEqual(80)
    let t = fresh('xiahou-dun', 1, calm)
    t.officers['cao-cao']!.health = 0
    t = endMonth(t, true)
    expect(t.factions['f-cao-cao']!.ruler).toBe('xiahou-dun') // most merit (4000)
    expect(W.invariants(t)).toEqual([])
  })
})

describe('W-DIP', () => {
  it('W-DIP-1 relations default to 30 and a battle lowers them by 20', () => {
    let s = fresh('cao-cao', 1, (x) => { calm(x); x.pacts = []; x.cities['wancheng']!.faction = 'f-dong-zhuo'; x.cities['wancheng']!.troops = 50; x.officers['li-jue']!.city = 'changan' })
    expect(W.query.factionView(s, 'f-cao-cao')!.relations.find((r) => r.faction === 'f-dong-zhuo')!.value).toBe(30)
    s = act(s, { kind: 'war', from: 'xuchang', to: 'wancheng', units: [{ officer: 'xiahou-dun', troops: 3000, type: 'spear', commander: true }] })
    s = endMonth(s, true)
    expect(W.query.factionView(s, 'f-cao-cao')!.relations.find((r) => r.faction === 'f-dong-zhuo')!.value).toBeLessThanOrEqual(15)
  })
  it('W-DIP-2 alliance lasts 24 months with chance clamp(relation - 20 + CHA/4 + 10 if the target is weaker)', () => {
    const s = fresh('cao-cao', 1, (x) => { calm(x); x.pacts = [] })
    const a = { kind: 'diplomacy' as const, envoy: 'cao-cao', faction: 'f-yuan-shao', proposal: 'alliance' as const, mode: 'roll' as const }
    expect(W.query.chanceOf(s, a)!.pct).toBe(Math.max(5, Math.min(90, 50 - 20 + Math.floor(85 / 4) + (W.query.factionView(s, 'f-yuan-shao')!.totalTroops < W.query.factionView(s, 'f-cao-cao')!.totalTroops ? 10 : 0))))
    const d = tryRolls(s, a, (n) => n.pacts.some((p) => p.kind === 'alliance'))
    expect(d.pacts.find((p) => p.kind === 'alliance')!.until).toEqual({ year: 192, month: 1 })
    expect(d.pacts.length).toBe(1)
  })
  it('W-DIP-3 truce lasts 12 months, chance +10 over an alliance', () => {
    const s = fresh('cao-cao', 1, (x) => { calm(x); x.pacts = [] })
    const t = W.query.chanceOf(s, { kind: 'diplomacy', envoy: 'cao-cao', faction: 'f-yuan-shao', proposal: 'truce', mode: 'roll' })!.pct
    const a = W.query.chanceOf(s, { kind: 'diplomacy', envoy: 'cao-cao', faction: 'f-yuan-shao', proposal: 'alliance', mode: 'roll' })!.pct
    expect(t).toBe(Math.min(90, a + 10))
    const d = tryRolls(s, { kind: 'diplomacy', envoy: 'cao-cao', faction: 'f-yuan-shao', proposal: 'truce', mode: 'roll' }, (n) => n.pacts.length > 0)
    expect(d.pacts[0]!.until).toEqual({ year: 191, month: 1 })
  })
  it('W-DIP-4 demanding surrender needs 3x troops; yes merges the target into us', () => {
    const s = fresh('cao-cao', 1, (x) => { calm(x); x.pacts = []; x.cities['xuchang']!.troops = 80000 })
    const a = { kind: 'diplomacy' as const, envoy: 'cao-cao', faction: 'f-yuan-shao', proposal: 'surrender' as const, mode: 'roll' as const }
    expect(rej(fresh('cao-cao', 1, (x) => { calm(x); x.pacts = [] }), a).code).toBe('not-legal')
    const d = tryRolls(s, a, (n) => !n.factions['f-yuan-shao']!.alive)
    expect(d.cities['ye']!.faction).toBe('f-cao-cao')
    expect(d.officers['yuan-shao']!.faction).toBe('f-cao-cao')
    expect(d.officers['yuan-shao']!.post).toBe('officer')
    expect(W.invariants(d)).toEqual([])
  })
  it('W-DIP-4 (M4b) a proud ruler, or a house of 3+ cities, will not submit: the demand is not legal and the chance is 0', () => {
    const rich = (x: WorldState): void => { calm(x); x.pacts = []; x.cities['xuchang']!.troops = 80000 }
    // Dong Zhuo is ambitious: proud, however small
    const proud = fresh('cao-cao', 1, rich)
    const dz = { kind: 'diplomacy' as const, envoy: 'cao-cao', faction: 'f-dong-zhuo', proposal: 'surrender' as const, mode: 'roll' as const }
    expect(rej(proud, dz).message).toMatch(/proud/i)
    expect(W.query.chanceOf(proud, dz)?.pct ?? 0).toBe(0)
    // Yuan Shao is cautious, but with a third city he has somewhere to fall back to
    const big = fresh('cao-cao', 1, (x) => { rich(x); x.cities['wancheng']!.faction = 'f-yuan-shao'; x.cities['wancheng']!.troops = 100 })
    const ys = { ...dz, faction: 'f-yuan-shao' }
    expect(rej(big, ys).message).toMatch(/fall back/i)
    const small = fresh('cao-cao', 1, rich)
    expect(W.query.chanceOf(small, ys)!.pct).toBeGreaterThan(0)
  })
  it('W-DIP-5 success raises relation by 15, refusal lowers it by 5', () => {
    const s = fresh('cao-cao', 1, (x) => { calm(x); x.pacts = [] })
    const a = { kind: 'diplomacy' as const, envoy: 'cao-cao', faction: 'f-yuan-shao', proposal: 'truce' as const, mode: 'roll' as const }
    const yes = tryRolls(s, a, (n) => n.pacts.length > 0)
    expect(yes.relations['f-cao-cao|f-yuan-shao']).toBe(65)
    const no = tryRolls(s, a, (n) => n.pacts.length === 0)
    expect(no.relations['f-cao-cao|f-yuan-shao']).toBe(45)
  })
})

describe('W-EVT', () => {
  it('W-EVT-1 events fire once in their window when conditions hold; a major one sends the player a letter', () => {
    let s = fresh('cao-cao', 1, (x) => { x.options.events = true })
    s = act(s, { kind: 'endMonth' })
    s = clear(s)
    expect(s.firedEvents).toContain('coalition-forms')
    expect(s.flags).toContain('coalition')
    expect(s.pacts.some((p) => p.kind === 'alliance')).toBe(true)
    for (let i = 0; i < 3; i++) s = endMonth(s)
    expect(s.firedEvents.filter((e) => e === 'coalition-forms').length).toBe(1)
  })
  it('W-EVT-1 events can be switched off', () => {
    let s = fresh('cao-cao', 1, calm)
    s = endMonth(s, true)
    expect(s.firedEvents).toEqual([])
  })
  it('E-4 the player involved gets an eventChoice; option 1 plays the duel and the result applies onWin/onLoss', () => {
    let s = fresh('xiahou-dun', 1, (x) => { x.options.events = true; x.ym = { year: 190, month: 2 } })
    s = act(s, { kind: 'endMonth' })
    let guard = 0
    while (s.pending[0]?.kind === 'letter' && guard++ < 6) s = act(s, { kind: 'ack', pending: s.pending[0].id })
    expect(s.pending[0]!.kind).toBe('eventChoice')
    const pid = s.pending[0]!.id
    const d = act(s, { kind: 'choose', pending: pid, option: 1 })
    expect(d.pending[0]!.kind).toBe('duel')
    const p = d.pending[0]! as Extract<typeof d.pending[0], { kind: 'duel' }>
    expect(p.context).toBe('event')
    const win = act(d, { kind: 'resolveDuel', pending: p.id, outcome: { duelId: p.setup.id, winner: 'a', how: 'knockout', rounds: 3, vigorLeft: { a: 5, b: 0 } } })
    expect(win.flags).toContain('gate-won')
    const lose = act(d, { kind: 'resolveDuel', pending: p.id, outcome: { duelId: p.setup.id, winner: 'b', how: 'knockout', rounds: 3, vigorLeft: { a: 0, b: 5 } } })
    expect(lose.flags).not.toContain('gate-won')
    expect(rej(s, { kind: 'choose', pending: pid, option: 9 }).code).toBe('bad-target')
  })
  it('E-4 the AI always takes the historical course (no choice when the player is not involved)', () => {
    let s = fresh('cao-cao', 1, (x) => { x.options.events = true; x.ym = { year: 190, month: 2 } })
    s = clear(act(s, { kind: 'endMonth' }))
    expect(s.flags).toContain('gate-held')
  })
  it('E-5 an event whose officers have died never fires; E-6 killing a ruler triggers succession', () => {
    let s = fresh('cao-cao', 1, (x) => { x.options.events = true; x.ym = { year: 192, month: 1 }; x.officers['dong-zhuo']!.status = 'dead'; x.officers['dong-zhuo']!.city = null; x.officers['dong-zhuo']!.faction = null; x.officers['dong-zhuo']!.post = 'wanderer'; x.factions['f-dong-zhuo']!.ruler = 'lu-bu'; x.officers['lu-bu']!.post = 'ruler' })
    for (let i = 0; i < 5; i++) s = endMonth(s)
    expect(s.firedEvents).not.toContain('tyrant-falls')
    let t = fresh('cao-cao', 1, (x) => { x.options.events = true; x.ym = { year: 192, month: 1 } })
    for (let i = 0; i < 6 && !t.flags.includes('tyrant-dead'); i++) t = endMonth(t)
    expect(t.officers['dong-zhuo']!.status).toBe('dead')
    expect(t.factions['f-dong-zhuo']!.alive).toBe(true)
    expect(t.officers[t.factions['f-dong-zhuo']!.ruler]!.post).toBe('ruler')
  })
})

describe('log kinds', () => {
  it('every log kind has a sample line', () => {
    for (const k of LOG_KINDS) expect(k.sample.length).toBeGreaterThan(3)
    expect(LOG_KIND_SET.size).toBe(LOG_KINDS.length)
  })
})

describe('W-DEATH-4 succession split (M4b)', () => {
  const house = (seed: number, loyalty: number, cities = 4) => fresh('xiahou-dun', seed, (x) => {
    calm(x); x.pacts = []
    const mine = ['luoyang', 'changan', 'wancheng', 'xiapi'].slice(0, cities)
    for (const id of mine) { x.cities[id]!.faction = 'f-dong-zhuo'; x.cities[id]!.prefect = null }
    x.officers['hua-xiong']!.city = 'changan'; x.cities['changan']!.prefect = 'hua-xiong'
    const place: [string, string][] = [['li-jue', 'wancheng'], ['diaochan', 'xiapi']]
    for (const [oid, cid] of place) if (mine.includes(cid)) { const o = x.officers[oid]!; o.city = cid; o.post = 'prefect'; x.cities[cid]!.prefect = oid }
    for (const oid of ['hua-xiong', 'li-jue', 'diaochan']) x.officers[oid]!.loyalty = loyalty
    x.officers['dong-zhuo']!.health = 0
    x.cities['xiapi']!.faction = cities >= 4 ? 'f-dong-zhuo' : x.cities['xiapi']!.faction
  })
  it('W-DEATH-4 a ruler of a 4-city house dies: low-loyalty prefects of other cities may break away, to a neighbour or on their own', () => {
    let splits = 0
    for (let seed = 1; seed <= 25; seed++) {
      const s = endMonth(house(seed, 10), true)
      expect(W.invariants(s)).toEqual([])
      const reb = s.log.filter((e) => e.kind === 'rebel' && /broke away/.test(e.text))
      splits += reb.length
      for (const e of reb) expect(e.city).not.toBe('luoyang') // the capital never splits
    }
    expect(splits).toBeGreaterThan(0)
  })
  it('W-DEATH-4 loyal prefects (loyalty 100), and houses of fewer than 4 cities, do not split', () => {
    for (let seed = 1; seed <= 15; seed++) {
      expect(endMonth(house(seed, 100), true).log.some((e) => e.kind === 'rebel')).toBe(false)
      expect(endMonth(house(seed, 10, 3), true).log.some((e) => e.kind === 'rebel' && /broke away/.test(e.text))).toBe(false)
    }
  })
})
