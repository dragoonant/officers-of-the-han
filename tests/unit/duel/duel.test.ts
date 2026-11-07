import { describe, expect, it } from 'vitest'
import type { Contestant, DuelSetup } from '../../../src/contracts/contest'
import {
  DEAL, autoDuel, createDuel, duelTells, hitBase, legalStances, startVigor, stepDuel, query, type DuelState, type Stance,
} from '../../../src/duel'
import { nextFloat } from '../../../src/shared/rng'

const who = (id: string, o: Partial<Contestant> & { war?: number } = {}): Contestant => ({
  id, name: id, stats: { war: o.war ?? 80, ldr: 50, int: 50, pol: 50, cha: 50 }, temperament: o.temperament ?? 'steady',
  health: o.health ?? 100, player: o.player ?? false,
})
const setup = (a: Partial<Contestant> & { war?: number } = {}, b: Partial<Contestant> & { war?: number } = {}, seed = 5, inBattle = false): DuelSetup => ({
  id: 'd1', seed, a: who('a', { player: true, ...a }), b: who('b', b), inBattle,
})

/** Play one round with a's stance chosen and b's committed stance forced. */
function round(st: DuelState, a: Stance, b: Stance) {
  const forced = structuredClone(st)
  forced.committed = { a: null, b }
  const rng = [...forced.rng] as [number, number, number, number]
  const ha = hitBase(forced.setup.a) + Math.floor(nextFloat(rng) * 5)
  const hb = hitBase(forced.setup.b) + Math.floor(nextFloat(rng) * 5)
  const r = stepDuel(forced, { stance: a })
  if (!r.ok) throw new Error(r.message)
  return { r, ha, hb, before: forced }
}

describe('D-DUEL-1 vigor', () => {
  it('D-DUEL-1 vigor = 40 + WAR / 2 + health / 10, spirit starts at 0', () => {
    const st = createDuel(setup({ war: 80, health: 100 }, { war: 60, health: 55 }))
    expect(st.vigor).toEqual({ a: 90, b: 75 }) // 40+40+10, 40+30+5.5 -> 75
    expect(startVigor(who('x', { war: 99, health: 30 }))).toBe(92)
    expect(st.spirit).toEqual({ a: 0, b: 0 })
  })
})

describe('D-DUEL-2 stances', () => {
  it('D-DUEL-2 Strike, Guard, Feint and Yield are always available; Mighty Blow only at spirit 100', () => {
    const st = createDuel(setup())
    expect(legalStances(st, 'a')).toEqual(['strike', 'guard', 'feint', 'yield'])
    const full = structuredClone(st)
    full.spirit.a = 100
    expect(legalStances(full, 'a')).toContain('mighty')
    const bad = stepDuel(st, { stance: 'mighty' })
    expect(bad.ok).toBe(false)
    expect(stepDuel(st, {} as never).ok).toBe(false)
    expect(stepDuel(st, { stance: 'zzz' as never }).ok).toBe(false)
  })
  it('D-DUEL-2 Yield ends the duel as a loss for the yielder', () => {
    const r = stepDuel(createDuel(setup()), { stance: 'yield' })
    expect(r.ok && r.state.outcome).toMatchObject({ winner: 'b', how: 'yield', duelId: 'd1' })
    expect(stepDuel(r.ok ? r.state : (null as never), { stance: 'strike' }).ok).toBe(false)
  })
})

describe('D-DUEL-3 resolution table', () => {
  const rows: ('strike' | 'guard' | 'feint' | 'mighty')[] = ['strike', 'guard', 'feint', 'mighty']
  const deal = {
    strike: { strike: 1, guard: 0, feint: 1.5, mighty: 1 },
    guard: { strike: 0.5, guard: 0, feint: 0, mighty: 0 },
    feint: { strike: 0, guard: 1, feint: 0, mighty: 0 },
    mighty: { strike: 2.5, guard: 1.25, feint: 2.5, mighty: 2.5 },
  } as const
  for (const me of rows) {
    for (const them of rows) {
      it(`D-DUEL-3 ${me} vs ${them}: I deal ${deal[me][them]}x, I take ${deal[them][me]}x`, () => {
        const base = createDuel(setup())
        base.spirit.a = 100
        const { r, ha, hb, before } = round(base, me, them)
        if (!r.ok) throw new Error('rejected')
        const dealt = deal[me][them] > 0 ? Math.max(1, Math.floor(ha * deal[me][them])) : 0
        const taken = deal[them][me] > 0 ? Math.max(1, Math.floor(hb * deal[them][me])) : 0
        // a Mighty Blow by b needs no spirit in this forced test
        expect(r.state.vigor.b).toBe(before.vigor.b - dealt)
        expect(r.state.vigor.a).toBe(before.vigor.a - taken)
      })
    }
  }
  it('D-DUEL-3 Feint beats Guard, Guard counters Strike, Strike beats Feint (named)', () => {
    const base = createDuel(setup())
    const f = round(base, 'feint', 'guard')
    expect(f.r.ok && f.r.state.vigor.b).toBeLessThan(base.vigor.b)
    const g = round(base, 'guard', 'strike')
    expect(g.r.ok && g.r.state.vigor.b).toBeLessThan(base.vigor.b) // my counter
    expect(g.r.ok && g.r.state.vigor.a).toBe(base.vigor.a)
    const s = round(base, 'strike', 'feint')
    expect(s.r.ok && s.r.state.vigor.a).toBe(base.vigor.a)
  })
  it('D-DUEL-3 a hit is 6 + WAR/8 + 0..4 before the factor', () => {
    expect(hitBase(who('x', { war: 80 }))).toBe(16)
    const base = createDuel(setup({ war: 80 }, { war: 80 }))
    for (let seed = 1; seed < 60; seed++) {
      const st = createDuel(setup({ war: 80 }, { war: 80 }, seed))
      const r = round(st, 'strike', 'strike')
      if (!r.r.ok) throw new Error('x')
      const taken = st.vigor.b - r.r.state.vigor.b
      expect(taken).toBeGreaterThanOrEqual(16)
      expect(taken).toBeLessThanOrEqual(20)
    }
    void base
  })
})

describe('D-DUEL-4 spirit', () => {
  it('D-DUEL-4 +15 for taking damage, +10 for dealing it', () => {
    const base = createDuel(setup())
    const a = round(base, 'strike', 'strike')
    expect(a.r.ok && a.r.state.spirit).toEqual({ a: 25, b: 25 })
    const g = round(base, 'guard', 'strike') // I deal (counter), they deal 0
    expect(g.r.ok && g.r.state.spirit).toEqual({ a: 10, b: 15 })
    const f = round(base, 'strike', 'feint')
    expect(f.r.ok && f.r.state.spirit).toEqual({ a: 10, b: 15 })
  })
  it('D-DUEL-4 +10 on Guard-Guard and Feint-Feint', () => {
    const base = createDuel(setup())
    expect(round(base, 'guard', 'guard').r.ok && (round(base, 'guard', 'guard').r as { state: DuelState }).state.spirit).toEqual({ a: 10, b: 10 })
    expect((round(base, 'feint', 'feint').r as { state: DuelState }).state.spirit).toEqual({ a: 10, b: 10 })
  })
  it('D-DUEL-4 spirit caps at 100 and Mighty Blow sets the user\'s spirit to 0', () => {
    const base = createDuel(setup())
    base.spirit = { a: 100, b: 95 }
    const m = round(base, 'mighty', 'strike')
    expect(m.r.ok && m.r.state.spirit.a).toBe(0)
    expect(m.r.ok && m.r.state.spirit.b).toBe(100)
  })
})

describe('D-DUEL-5 ending', () => {
  it('D-DUEL-5 a duelist at 0 vigor is knocked out and loses', () => {
    let st = createDuel(setup({ war: 100, health: 100 }, { war: 0, health: 0 }))
    for (let i = 0; i < 20 && !st.outcome; i++) {
      const r = stepDuel(st, { stance: 'strike' })
      if (!r.ok) throw new Error(r.message)
      st = r.state
    }
    expect(st.outcome).toMatchObject({ how: 'knockout', winner: 'a' })
    expect(st.outcome!.vigorLeft.b).toBe(0)
  })
  it('D-DUEL-5 after 10 rounds with both standing it is a draw', () => {
    let st = createDuel(setup({ war: 80 }, { war: 80 }))
    for (let i = 0; i < 10; i++) {
      st = structuredClone(st)
      st.committed = { a: null, b: 'guard' }
      const r = stepDuel(st, { stance: 'guard' })
      if (!r.ok) throw new Error(r.message)
      st = r.state
    }
    expect(st.outcome).toMatchObject({ winner: null, how: 'draw', rounds: 10 })
  })
})

describe('D-DUEL-6 AI tells', () => {
  const tells = (b: Partial<Contestant> & { war?: number }, mutate?: (s: DuelState) => void) => {
    const st = createDuel(setup({}, b))
    mutate?.(st)
    const t = duelTells(st, 'b')
    return Object.fromEntries(t.tells.map((x) => [x.stance, x.weight]))
  }
  it('D-DUEL-6 base Strike 40, Guard 30, Feint 30', () => {
    expect(tells({})).toEqual({ strike: 40, guard: 30, feint: 30 })
    const t = duelTells(createDuel(setup()), 'b')
    expect(t.tells.map((x) => x.pct)).toEqual([40, 30, 30])
    expect(query.duelTells(createDuel(setup()), 'b')).toEqual(t)
  })
  it('D-DUEL-6 temperaments shift the weights', () => {
    expect(tells({ temperament: 'reckless' })).toEqual({ strike: 60, guard: 20, feint: 20 })
    expect(tells({ temperament: 'cautious' })).toEqual({ strike: 30, guard: 50, feint: 20 })
    expect(tells({ temperament: 'ambitious' })).toEqual({ strike: 40, guard: 20, feint: 40 })
  })
  it('D-DUEL-6 below 30% vigor: Guard +15, Strike -15', () => {
    expect(tells({}, (s) => { s.vigor.b = Math.floor(s.vigorMax.b * 0.29) })).toEqual({ strike: 25, guard: 45, feint: 30 })
    expect(tells({}, (s) => { s.vigor.b = Math.ceil(s.vigorMax.b * 0.3) })).toEqual({ strike: 40, guard: 30, feint: 30 })
  })
  it('D-DUEL-6 Mighty Blow is always taken when available', () => {
    const st = createDuel(setup())
    st.spirit.b = 100
    const t = duelTells(st, 'b')
    expect(t.forced).toBe(true)
    expect(t.tells).toEqual([{ stance: 'mighty', weight: 1, pct: 100 }])
  })
  it('D-DUEL-6 only a cautious duelist yields, below 15% vigor against more than 3x its vigor', () => {
    const lowCautious = (temperament: Contestant['temperament'], mine: number, theirs: number) => {
      const st = createDuel(setup({}, { temperament }))
      st.vigor.b = mine
      st.vigor.a = theirs
      st.vigorMax.b = 100
      return duelTells(st, 'b').tells[0]!.stance === 'yield'
    }
    expect(lowCautious('cautious', 14, 43)).toBe(true)
    expect(lowCautious('cautious', 14, 42)).toBe(false) // not more than 3x
    expect(lowCautious('cautious', 15, 80)).toBe(false) // not below 15%
    expect(lowCautious('reckless', 5, 90)).toBe(false)
    expect(lowCautious('steady', 5, 90)).toBe(false)
  })
  it('D-DUEL-6 the committed stance is drawn when the round opens, from the shown tells, and the player cannot change it', () => {
    const counts: Record<string, number> = { strike: 0, guard: 0, feint: 0 }
    const n = 2000
    for (let seed = 1; seed <= n; seed++) counts[createDuel(setup({}, {}, seed)).committed.b!]!++
    expect(counts.strike! / n).toBeGreaterThan(0.35)
    expect(counts.strike! / n).toBeLessThan(0.45)
    expect(counts.guard! / n).toBeGreaterThan(0.25)
    expect(counts.feint! / n).toBeGreaterThan(0.25)
    const st = createDuel(setup())
    expect(st.committed.a).toBeNull()
    const picks = (['strike', 'guard', 'feint'] as const).map((s) => {
      const r = stepDuel(st, { stance: s })
      return r.ok ? r.state.log[0]!.b : null
    })
    expect(new Set(picks).size).toBe(1)
    expect(picks[0]).toBe(st.committed.b)
  })
})

describe('D-DUEL-7 outside battle', () => {
  it('D-DUEL-7 a knockout outside battle is just a result: no wounds, same engine', () => {
    const out = autoDuel(setup({ war: 100 }, { war: 10 }, 3, false))
    const inb = autoDuel(setup({ war: 100 }, { war: 10 }, 3, true))
    expect(out).toEqual(inb)
    expect(Object.keys(out).sort()).toEqual(['duelId', 'how', 'rounds', 'vigorLeft', 'winner'])
    expect(createDuel(setup({}, {}, 1, true)).setup.inBattle).toBe(true)
  })
})

describe('duel contract', () => {
  it('autoDuel ignores player flags, is deterministic and always finishes', () => {
    for (let seed = 1; seed < 200; seed++) {
      const s = setup({ war: 40 + (seed % 60), temperament: (['reckless', 'cautious', 'ambitious', 'steady', 'righteous'] as const)[seed % 5] }, { war: 90 - (seed % 50) }, seed)
      const o = autoDuel(s)
      expect(o).toEqual(autoDuel(s))
      expect(o.rounds).toBeLessThanOrEqual(10)
      expect(o.vigorLeft.a).toBeGreaterThanOrEqual(0)
      if (o.winner === null) expect(o.how).toBe('draw')
      else expect(['knockout', 'yield']).toContain(o.how)
    }
  })
  it('stepDuel never throws on garbage and never mutates its input', () => {
    const st = createDuel(setup())
    const snap = JSON.stringify(st)
    for (const g of [null, undefined, 5, 'x', {}, { stance: null }, { stance: 7 }, { stance: {} }, [], { stance: 'mighty' }]) {
      expect(() => stepDuel(st, g as never)).not.toThrow()
    }
    expect(JSON.stringify(st)).toBe(snap)
    expect(JSON.parse(JSON.stringify(st))).toEqual(st)
  })
  it('both sides AI: stepDuel without a player plays the committed stances', () => {
    let st = createDuel({ ...setup(), a: who('a'), b: who('b') })
    expect(st.committed.a).not.toBeNull()
    let mighty = 0
    while (!st.outcome) {
      for (const side of ['a', 'b'] as const) if (st.spirit[side] >= 100) { expect(st.committed[side]).toBe('mighty'); mighty++ }
      const r = stepDuel(st, {})
      if (!r.ok) throw new Error(r.message)
      st = r.state
    }
    expect(st.outcome.rounds).toBeGreaterThan(0)
    void mighty
  })
})
void DEAL
